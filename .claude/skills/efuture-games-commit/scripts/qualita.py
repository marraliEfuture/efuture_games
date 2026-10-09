#!/usr/bin/env python3
"""Efuture Games - controlli di qualità per il pannello admin (Admin > Qualità).

Analizza il repository e scrive:
  docs/qualita/ultimo.json   ultimo controllo, con l'elenco di ogni test e i dettagli
  docs/qualita/storico.json  un riepilogo per data (trend di spazio, vulnerabilità, esiti)

Aree: codice, database (file SQL), prestazioni, spazio occupato, vulnerabilità.
Il database online non viene contattato: si controllano i file supabase*.sql.

Uso:
  python3 qualita.py              controlla il repository e aggiorna oggi nello storico
  python3 qualita.py --storico    ricostruisce lo storico dai commit (l'ultimo di ogni giorno)
  python3 qualita.py --no-browser salta le prove nel browser (tempi di caricamento)
Il repository è EFG_REPO, altrimenti quello che contiene questo script, altrimenti la cartella corrente.
Non scrive mai segreti: dei codici trovati riporta solo file e riga.
"""
import json, os, re, shutil, subprocess, sys, tempfile, time
from datetime import date, datetime, timezone
from pathlib import Path

def find_repo():
    if os.environ.get("EFG_REPO"): return Path(os.environ["EFG_REPO"])
    for d in Path(__file__).resolve().parents:
        if (d / "config.js").exists(): return d
    return Path.cwd()

REPO = find_repo()
SKIP_DIRS = {".git", "node_modules", "docs/qualita"}
SQL_ORDER = ["supabase.sql", "supabase-classifica-gruppi.sql", "supabase-countdown.sql", "supabase-privacy-utenti.sql", "supabase-tipi-utenti.sql"]

def files(root, exts=None):
    out = []
    for p in root.rglob("*"):
        rel = p.relative_to(root).as_posix()
        if any(rel == s or rel.startswith(s + "/") for s in SKIP_DIRS): continue
        if p.is_file() and (exts is None or p.suffix.lower() in exts): out.append(p)
    return sorted(out)

def T(nome, esito, dettaglio="", gravita=None, **extra):
    t = {"nome": nome, "esito": esito, "dettaglio": dettaglio}
    if gravita: t["gravita"] = gravita
    t.update(extra); return t

def rel(root, p): return p.relative_to(root).as_posix()
def kb(n): return round(n / 1024, 1)

# ---------------------------------------------------------------- codice
INLINE_RE = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>", re.I)
def check_js(code, label):
    try:
        r = subprocess.run(["node", "-e", "try{new Function(require('fs').readFileSync(0,'utf8'))}catch(e){console.log(e.message);process.exit(1)}"],
                           input=code, text=True, capture_output=True, timeout=20)
        return r.returncode == 0, r.stdout.strip()
    except Exception as e:
        return None, str(e)

def area_codice(root):
    tests = []
    for p in files(root, {".js"}):
        r = rel(root, p)
        if r.startswith("vendor/") or r.startswith(".claude/"): continue
        src = p.read_text(encoding="utf-8", errors="replace")
        if src.lstrip().startswith(("import ", "export ")) or "import(" in src[:400] or p.suffix == ".mjs": continue
        ok, msg = check_js(src, r)
        if ok is None: tests.append(T("Sintassi JavaScript: " + r, "avviso", "node non disponibile: " + msg)); continue
        tests.append(T("Sintassi JavaScript: " + r, "ok" if ok else "errore", "nessun errore" if ok else msg))
    for p in files(root, {".html"}):
        r = rel(root, p)
        if r.startswith(".claude/"): continue
        src = p.read_text(encoding="utf-8", errors="replace")
        blocks = [b for b in INLINE_RE.findall(src) if b.strip()]
        bad = []
        for i, b in enumerate(blocks):
            ok, msg = check_js(b, r)
            if ok is False: bad.append("script %d: %s" % (i + 1, msg))
        tests.append(T("Script nella pagina: " + r, "errore" if bad else "ok", "; ".join(bad) or "%d script senza errori" % len(blocks)))
        ids = re.findall(r'\bid="([^"]+)"', src)
        dup = sorted({i for i in ids if ids.count(i) > 1})
        tests.append(T("Id duplicati: " + r, "avviso" if dup else "ok", ", ".join(dup) if dup else "nessuno"))
        missing = []
        for m in re.finditer(r'\b(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"', src):
            u = m.group(1)
            if re.match(r"^(https?:|mailto:|tel:|data:|javascript:|intent:|//)", u) or "${" in u or "'" in u or "+" in u: continue
            if not (p.parent / u).exists(): missing.append(u)
        tests.append(T("Collegamenti locali esistenti: " + r, "errore" if missing else "ok", ", ".join(sorted(set(missing))) if missing else "tutti presenti"))
    sw = root / "sw.js"
    if sw.exists():
        s = sw.read_text(encoding="utf-8")
        assets = re.findall(r'"([^"]+)"', s[s.find("ASSETS"):s.find("]", s.find("ASSETS"))]) if "ASSETS" in s else []
        miss = [a for a in assets if a not in ("./",) and not (root / a).exists()]
        tests.append(T("File della cache offline (sw.js)", "errore" if miss else "ok", ", ".join(miss) if miss else "%d file, tutti presenti" % len(assets)))
        m = re.search(r"efuture-games-v(\d+)", s); v = m.group(1) if m else None
        diff = []
        for p in [root / "index.html", root / "classifica.html", root / "admin.html"]:
            if p.exists():
                for x in set(re.findall(r"\.js\?v=(\d+)", p.read_text(encoding="utf-8"))):
                    if x != v: diff.append("%s usa v%s" % (p.name, x))
        tests.append(T("Versione uguale in tutti i file", "errore" if diff else "ok", "; ".join(diff) if diff else "v%s ovunque" % v))
    return tests

# ---------------------------------------------------------------- database
FUNC_RE = re.compile(r"create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([\s\S]*?)\$\$([\s\S]*?)\$\$", re.I)
def area_db(root):
    tests = []
    sqls = [root / f for f in SQL_ORDER if (root / f).exists()] + [p for p in sorted(root.glob("supabase*.sql")) if p.name not in SQL_ORDER]
    if not sqls: return [T("File SQL", "avviso", "nessun file supabase*.sql")]
    defs = {}
    alltext = ""
    for p in sqls:
        s = p.read_text(encoding="utf-8"); alltext += "\n" + s
        for m in FUNC_RE.finditer(s):
            defs[m.group(1)] = (p.name, m.group(2), m.group(3))   # l'ultima definizione nell'ordine di esecuzione vince
    tests.append(T("File SQL letti", "ok", ", ".join(p.name for p in sqls) + " (nell'ordine di esecuzione)"))
    tables = re.findall(r"create\s+table\s+if\s+not\s+exists\s+public\.(\w+)", alltext, re.I)
    norls = [t for t in sorted(set(tables)) if not re.search(r"alter\s+table\s+public\.%s\s+enable\s+row\s+level\s+security" % t, alltext, re.I)]
    tests.append(T("RLS attiva su tutte le tabelle", "errore" if norls else "ok", ("senza RLS: " + ", ".join(norls)) if norls else "%d tabelle protette" % len(set(tables))))
    nosp = [n for n, (f, head, body) in defs.items() if "security definer" in head.lower() and "search_path" not in head.lower()]
    tests.append(T("search_path fissato nelle funzioni security definer", "errore" if nosp else "ok", ", ".join(sorted(nosp)) if nosp else "%d funzioni controllate" % len(defs)))
    noauth = [n for n, (f, head, body) in defs.items() if n.startswith("efg_admin_") and n not in ("efg_admin_auth", "efg_admin_init") and "efg_admin_auth" not in body]
    tests.append(T("Funzioni admin che controllano la chiave", "errore" if noauth else "ok", ", ".join(sorted(noauth)) if noauth else "tutte le funzioni efg_admin_* chiamano efg_admin_auth"))
    norev = [n for n in defs if not re.search(r"revoke[\s\S]{0,400}?public\.%s\s*\(" % n, alltext, re.I)]
    tests.append(T("Permessi revocati a 'public' per ogni funzione", "avviso" if norev else "ok", ", ".join(sorted(norev)) if norev else "tutte le funzioni hanno un revoke"))
    granted = re.findall(r"grant\s+[\w,\s]+\s+on\s+(?:table\s+)?public\.(\w+)\s+to\s+anon", alltext, re.I)
    tests.append(T("Nessun accesso diretto alle tabelle da 'anon'", "errore" if granted else "ok", ", ".join(granted) if granted else "il sito usa solo funzioni efg_*"))
    plain = [n for n, (f, head, body) in defs.items() if re.search(r"(?:insert\s+into|update)\s+efg_admin\b", body, re.I) and "crypt(" not in body]
    tests.append(T("Chiavi admin solo cifrate (bcrypt)", "errore" if plain else "ok", ", ".join(plain) if plain else "crypt(…, gen_salt('bf')) per chiave principale e personali" if "gen_salt('bf')" in alltext else "nessuna chiave nel codice"))
    bg = defs.get("efg_board_group")
    if bg and "admin_key_hash" in alltext:
        tests.append(T("Classifica filtrata esclude i disabilitati", "ok" if "disabilitato" in bg[2] else "avviso", "definizione finale in " + bg[0]))
    tests.append(T("Funzioni del database", "ok", "%d funzioni efg_*: %s" % (len(defs), ", ".join(sorted(defs)))))
    return tests

# ---------------------------------------------------------------- prestazioni
def page_weight(root, page):
    src = page.read_text(encoding="utf-8", errors="replace"); total = page.stat().st_size; seen = set()
    for u in re.findall(r'\b(?:src|href)="([^"#?]+)', src) + re.findall(r"url\(([^)\"']+)\)", src):
        if re.match(r"^(https?:|data:|mailto:|//|javascript:)", u) or u.endswith(".html"): continue
        f = (page.parent / u)
        if f.is_file() and f.resolve() not in seen and f.suffix.lower() not in (".mp4", ".webm"):
            seen.add(f.resolve()); total += f.stat().st_size
    return total, len(seen)

def area_prestazioni(root, browser=True):
    tests = []
    pages = [root / "index.html", root / "classifica.html", root / "admin.html"] + sorted(root.glob("games/*/index.html"))
    for p in pages:
        if not p.exists(): continue
        w, n = page_weight(root, p)
        es = "errore" if w > 4 * 1024 * 1024 else "avviso" if w > 1.5 * 1024 * 1024 else "ok"
        tests.append(T("Peso della pagina: " + rel(root, p), es, "%s KB con %d risorse locali (soglie: 1500 KB avviso, 4000 KB errore)" % (kb(w), n), valore=kb(w)))
    big = [(rel(root, p), p.stat().st_size) for p in files(root) if p.stat().st_size > 500 * 1024 and p.suffix.lower() not in (".mp4", ".webm")]
    tests.append(T("File grandi (oltre 500 KB, video esclusi)", "avviso" if big else "ok", "; ".join("%s %s KB" % (f, kb(s)) for f, s in big) if big else "nessuno"))
    imgs = [(rel(root, p), p.stat().st_size) for p in files(root, {".png", ".jpg", ".jpeg", ".webp", ".gif"}) if p.stat().st_size > 300 * 1024]
    tests.append(T("Immagini pesanti (oltre 300 KB)", "avviso" if imgs else "ok", "; ".join("%s %s KB" % (f, kb(s)) for f, s in imgs) if imgs else "nessuna"))
    sw = root / "sw.js"
    if sw.exists():
        s = sw.read_text(encoding="utf-8"); seg = s[s.find("ASSETS"):s.find("]", s.find("ASSETS"))]
        tot = sum((root / a).stat().st_size for a in re.findall(r'"([^"]+)"', seg) if a != "./" and (root / a).is_file())
        tests.append(T("Download della cache offline al primo avvio", "avviso" if tot > 5 * 1024 * 1024 else "ok", "%s KB scaricati da sw.js per giocare offline" % kb(tot), valore=kb(tot)))
    if browser:
        tests += prove_browser(root)
    return tests

BROWSER_JS = r"""
const fs = require('fs'), path = require('path');
(async () => {
  let pw; for (const p of ['/opt/node-tools/node_modules/playwright/index.js', 'playwright']) { try { pw = require(p); break; } catch (e) {} }
  if (!pw) { console.log(JSON.stringify({ errore: 'Playwright non disponibile' })); return; }
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const b = await pw.chromium.launch({ executablePath: exe });
  const out = [];
  for (const rel of JSON.parse(process.argv[1])) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 860 } });
    await ctx.route(/supabase\.co/, r => r.abort());
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    const t0 = Date.now();
    try { await pg.goto('file://' + path.join(process.argv[2], rel), { waitUntil: 'load', timeout: 15000 }); } catch (e) { errs.push('caricamento: ' + e.message); }
    const ms = Date.now() - t0;
    const nav = await pg.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.domContentLoadedEventEnd) : null; }).catch(() => null);
    out.push({ rel, ms, dom: nav, errori: errs });
    await ctx.close();
  }
  await b.close();
  console.log(JSON.stringify({ pagine: out }));
})();
"""
def prove_browser(root):
    pages = [p for p in ["index.html", "classifica.html", "admin.html", "games/sysadmin/index.html", "games/coretech/index.html", "games/timenet/index.html", "games/inncloud/index.html"] if (root / p).exists()]
    try:
        r = subprocess.run(["node", "-e", BROWSER_JS, json.dumps(pages), str(root)], capture_output=True, text=True, timeout=180)
        data = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:
        return [T("Caricamento nel browser", "avviso", "prova non eseguita: " + str(e)[:200])]
    if "errore" in data: return [T("Caricamento nel browser", "avviso", "prova non eseguita: " + data["errore"])]
    tests = []
    for x in data["pagine"]:
        es = "errore" if x["errori"] else ("avviso" if x["ms"] > 3000 else "ok")
        d = "caricata in %d ms (DOM pronto in %s ms) su telefono simulato, file locali, database escluso" % (x["ms"], x["dom"])
        if x["errori"]: d += " · errori JavaScript: " + " | ".join(x["errori"][:3])
        tests.append(T("Caricamento nel browser: " + x["rel"], es, d, valore=x["ms"]))
    return tests

# ---------------------------------------------------------------- spazio
def area_spazio(root):
    per = {}; tot = 0
    for p in files(root):
        r = rel(root, p); top = r.split("/")[0] if "/" in r else "(file principali)"
        per[top] = per.get(top, 0) + p.stat().st_size; tot += p.stat().st_size
    tests = [T("Spazio totale del sito", "avviso" if tot > 50 * 1024 * 1024 else "ok", "%s MB (limite consigliato GitHub Pages: 1 GB)" % round(tot / 1048576, 2), valore=kb(tot))]
    for k, v in sorted(per.items(), key=lambda x: -x[1]):
        tests.append(T("Cartella " + k, "ok", "%s KB" % kb(v), valore=kb(v)))
    return tests, {"totale_kb": kb(tot), "cartelle_kb": {k: kb(v) for k, v in per.items()}}

# ---------------------------------------------------------------- vulnerabilità
def area_vuln(root):
    tests = []
    text_files = [p for p in files(root, {".js", ".html", ".css", ".json", ".md", ".txt", ".sql", ".webmanifest", ".py", ".mjs"})]
    def scan(rx, only=None, exclude=()):
        hits = []
        for p in text_files:
            r = rel(root, p)
            if only and not only(r): continue
            if any(r.startswith(e) for e in exclude): continue
            for i, line in enumerate(p.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                if re.search(rx, line): hits.append("%s:%d" % (r, i))
        return hits
    h = scan(r"-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9]{20,}|service_role")
    h = [x for x in h if not x.startswith(".claude/skills/efuture-games-commit/scripts/qualita.py")]
    tests.append(T("Chiavi segrete nel codice (service_role, chiavi private, token)", "errore" if h else "ok", "trovate in: " + ", ".join(h[:10]) if h else "nessuna", gravita="alta" if h else None))
    codes = scan(r"(?<![A-Z0-9])(?!ABC-1234)[A-Z]{3}-\d{4}(?![0-9])", only=lambda r: not r.startswith(("docs/qualita", ".claude/skills/efuture-games-commit/scripts/qualita.py")))
    pub = [x for x in codes if not x.startswith(".claude/")]
    tests.append(T("Codici di sblocco leggibili dal sito pubblico", "avviso" if pub else "ok",
                   ("compaiono in: " + ", ".join(sorted({x.split(':')[0] for x in pub})) + ". Chi apre questi file dal sito li legge senza passare dallo stand.") if pub else "nessun codice in chiaro nei file pubblicati",
                   gravita="media" if pub else None))
    tb = scan(r'target="_blank"(?![^>]*rel="[^"]*noopener)', only=lambda r: r.endswith(".html"))
    tests.append(T("Link esterni senza rel=noopener", "avviso" if tb else "ok", ", ".join(tb[:10]) if tb else "tutti protetti", gravita="bassa" if tb else None))
    http = scan(r'(?:src|href)="http://', only=lambda r: r.endswith(".html"))
    tests.append(T("Risorse caricate senza HTTPS", "avviso" if http else "ok", ", ".join(http[:10]) if http else "nessuna", gravita="media" if http else None))
    ext = scan(r'<script[^>]+src="https?://', only=lambda r: r.endswith(".html"))
    tests.append(T("Script da siti esterni (CDN)", "avviso" if ext else "ok", ", ".join(ext[:10]) if ext else "tutte le librerie sono locali in vendor/", gravita="bassa" if ext else None))
    inner = scan(r"\.innerHTML\s*=\s*[^'\"`;]*\+|\.innerHTML\s*\+=", only=lambda r: r.endswith((".html", ".js")) and not r.startswith(("vendor/", ".claude/")))
    tests.append(T("innerHTML con testo composto (rischio XSS da verificare)", "avviso" if inner else "ok",
                   ("%d punti: " % len(inner)) + ", ".join(inner[:12]) if inner else "nessuno", gravita="bassa" if inner else None))
    sql = "\n".join((root / f).read_text(encoding="utf-8") for f in SQL_ORDER if (root / f).exists())
    nosp = [m.group(1) for m in FUNC_RE.finditer(sql) if "security definer" in m.group(2).lower() and "search_path" not in m.group(2).lower()]
    tests.append(T("Funzioni del database senza search_path", "errore" if nosp else "ok", ", ".join(sorted(set(nosp))) if nosp else "nessuna", gravita="alta" if nosp else None))
    hub = root / "hub.js"
    if hub.exists() and "SHA-256" in hub.read_text(encoding="utf-8") or (hub.exists() and "crypto.subtle" in hub.read_text(encoding="utf-8")):
        tests.append(T("Sblocco dei giochi verificato sul telefono", "avviso", "i codici sono confrontati con un hash nell'app: con 10.000 combinazioni per gioco si possono ricavare. Va bene per l'evento, non per premi di valore.", gravita="bassa"))
    lock = "fails >= 8" in sql
    tests.append(T("Blocco dei tentativi sulla chiave admin", "ok" if lock else "avviso", "8 tentativi sbagliati in 10 minuti bloccano l'accesso (conteggio globale)" if lock else "nessun blocco trovato", gravita=None if lock else "media"))
    return tests

# ---------------------------------------------------------------- riepilogo
def esiti(tests):
    c = {"ok": 0, "avviso": 0, "errore": 0}
    for t in tests: c[t["esito"]] = c.get(t["esito"], 0) + 1
    return c
def gravita(tests):
    c = {"alta": 0, "media": 0, "bassa": 0}
    for t in tests:
        if t.get("gravita"): c[t["gravita"]] += 1
    return c

def run(root, browser=True):
    cod = area_codice(root); db = area_db(root); pr = area_prestazioni(root, browser); sp, spd = area_spazio(root); vu = area_vuln(root)
    sw = root / "sw.js"; m = re.search(r"efuture-games-v(\d+)", sw.read_text(encoding="utf-8")) if sw.exists() else None
    return {
        "versione": "v" + m.group(1) if m else "?",
        "aree": {
            "codice": {"titolo": "Codice", "test": cod, "esiti": esiti(cod)},
            "db": {"titolo": "Database", "test": db, "esiti": esiti(db)},
            "prestazioni": {"titolo": "Prestazioni", "test": pr, "esiti": esiti(pr)},
            "spazio": {"titolo": "Spazio occupato", "test": sp, "esiti": esiti(sp), "totale_kb": spd["totale_kb"], "cartelle_kb": spd["cartelle_kb"]},
            "vulnerabilita": {"titolo": "Vulnerabilità", "test": vu, "esiti": esiti(vu), "gravita": gravita(vu)},
        },
    }

def sintesi(day, commit, rep):
    a = rep["aree"]
    return {"data": day, "commit": commit, "versione": rep["versione"],
            "esiti": {k: v["esiti"] for k, v in a.items()},
            "spazio_kb": a["spazio"]["totale_kb"], "cartelle_kb": a["spazio"]["cartelle_kb"],
            "vulnerabilita": a["vulnerabilita"]["gravita"]}

def git(*args, cwd=REPO):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True).stdout.strip()

def main():
    out = REPO / "docs" / "qualita"; out.mkdir(parents=True, exist_ok=True)
    sf = out / "storico.json"
    storico = json.loads(sf.read_text(encoding="utf-8")) if sf.exists() else []
    if "--storico" in sys.argv:
        seen = {}
        for line in git("log", "--format=%cd %H", "--date=short").splitlines():
            d, h = line.split(); seen.setdefault(d, h)
        for d, h in sorted(seen.items()):
            tmp = Path(tempfile.mkdtemp())
            subprocess.run("git archive %s | tar -x -C %s" % (h, tmp), shell=True, cwd=REPO)
            rep = run(tmp, browser=False)
            storico = [s for s in storico if s["data"] != d] + [sintesi(d, h[:7], rep)]
            shutil.rmtree(tmp, ignore_errors=True)
            print("storico", d, h[:7], rep["versione"])
    rep = run(REPO, browser="--no-browser" not in sys.argv)
    day = date.today().isoformat()
    rep["data"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rep["commit"] = git("rev-parse", "--short", "HEAD")
    storico = sorted([s for s in storico if s["data"] != day] + [sintesi(day, rep["commit"], rep)], key=lambda s: s["data"])
    (out / "ultimo.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    sf.write_text(json.dumps(storico, ensure_ascii=False, indent=1), encoding="utf-8")
    for k, v in rep["aree"].items():
        e = v["esiti"]; print("%-14s ok %d · avvisi %d · errori %d" % (v["titolo"], e["ok"], e["avviso"], e["errore"]))
    print("spazio %s KB · vulnerabilità %s · storico %d giorni" % (rep["aree"]["spazio"]["totale_kb"], rep["aree"]["vulnerabilita"]["gravita"], len(storico)))

if __name__ == "__main__":
    main()
