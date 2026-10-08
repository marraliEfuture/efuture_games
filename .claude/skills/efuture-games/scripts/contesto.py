#!/usr/bin/env python3
"""Efuture Games - carica in un colpo solo tutto il contesto del progetto.

Stampa: stato del progetto, mappa dei file, skill, link (artifact compresi),
sessioni di Claude Code ricavate dai commit, ultimi commit e la memoria
condivisa (memoria.md). Non stampa segreti: niente codici di sblocco,
chiavi o contenuto di config.js oltre a PUBLIC_URL.

Uso:  python3 contesto.py            tutto
      python3 contesto.py --breve    senza mappa dei file e con meno commit
"""
import json, re, subprocess, sys
from collections import OrderedDict
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SKILLS = SKILL.parent
REPO = SKILLS.parents[1]
BREVE = "--breve" in sys.argv

# cosa contiene ogni file o cartella del sito (i file nuovi compaiono come "(da descrivere)")
RUOLI = {
    "index.html": "app dei giocatori (home con i 4 giochi, registrazione, classifica)",
    "hub.js": "logica dell'app: sblocco, gara, punteggi, countdown, installazione",
    "backend.js": "collegamento a Supabase (o modalità demo sul telefono)",
    "config.js": "SUPABASE_URL, chiave anon pubblica e PUBLIC_URL del sito",
    "classifica.html": "classifica da proiettare (filtri, QR, countdown)",
    "admin.html": "pannello admin: giocatori, registro, QR, link, skills, video, tutorial, backup, chiave, reset",
    "sw.js": "service worker: cache offline e versione dell'app (efuture-games-vN)",
    "manifest.webmanifest": "manifest della PWA installabile",
    "supabase.sql": "database principale (da eseguire nel SQL Editor di Supabase)",
    "supabase-classifica-gruppi.sql": "filtro Giocatori Ospiti/Efuture della classifica",
    "supabase-countdown.sql": "countdown di apertura e chiusura della gara",
    "supabase-privacy-utenti.sql": "niente cellulare + Elimina giocatore dall'admin",
    "LEGGIMI.txt": "guida completa del progetto (contiene i codici di sblocco: non ripeterli)",
    "README.md": "descrizione breve del repository",
    ".nojekyll": "serve a GitHub Pages",
    "games/": "i 4 giochi: sysadmin, coretech, timenet, inncloud (ognuno con index.html)",
    "qr/": "QR stampabili (app + 4 sblocchi) e stampa.html",
    "tutorial/": "immagini dei tutorial della scheda Tutorial dell'admin",
    "video/": "video utili (mp4 + copertina jpg) della scheda Video dell'admin",
    "img/": "loghi Efuture e immagini dei giochi",
    "icons/": "icone dell'app",
    "fonts/": "font locali",
    "vendor/": "librerie esterne (supabase-js, jsQR, qrcode)",
    ".claude/": "skill di Claude Code del progetto",
}


def git(*a):
    r = subprocess.run(["git", "-C", str(REPO), *a], capture_output=True, text=True)
    return r.stdout.strip()


def titolo(t):
    print(f"\n## {t}\n")


print("# EFUTURE GAMES – CONTESTO DEL PROGETTO")

titolo("Stato")
cfg = (REPO / "config.js").read_text(encoding="utf-8") if (REPO / "config.js").exists() else ""
url = re.search(r'PUBLIC_URL:\s*"([^"]+)"', cfg)
sw = (REPO / "sw.js").read_text(encoding="utf-8") if (REPO / "sw.js").exists() else ""
ver = re.search(r"efuture-games-v(\d+)", sw)
ramo = git("rev-parse", "--abbrev-ref", "HEAD")
print(f"- Sito pubblicato: {url.group(1) if url else '(PUBLIC_URL non trovato)'}  (GitHub Pages dal ramo main)")
print(f"- Repository: https://github.com/marraliEfuture/efuture_games")
print(f"- Versione dell'app nel ramo corrente: v{ver.group(1) if ver else '?'}")
print(f"- Ramo corrente: {ramo}  ·  ultimo commit: {git('log', '-1', '--format=%h %ad %s', '--date=short')}")
if git("rev-parse", "--verify", "-q", "origin/main"):
    vm = re.search(r"efuture-games-v(\d+)", git("show", "origin/main:sw.js"))
    print(f"- Online (origin/main): v{vm.group(1) if vm else '?'}  ·  {git('log', '-1', '--format=%h %ad %s', '--date=short', 'origin/main')}")
    avanti = git("rev-list", "--count", "origin/main..HEAD")
    if avanti and avanti != "0":
        print(f"- Il ramo corrente ha {avanti} commit non ancora su main (non ancora online)")
mod = git("status", "--short")
print(f"- Modifiche non salvate: {len(mod.splitlines()) if mod else 0}")
for l in mod.splitlines()[:15]:
    print(f"    {l}")

if not BREVE:
    titolo("File del progetto")
    for p in sorted(REPO.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        if p.name == ".git":
            continue
        nome = p.name + ("/" if p.is_dir() else "")
        print(f"- {nome:34} {RUOLI.get(nome, '(da descrivere)')}")

titolo("Skill del progetto (.claude/skills)")
for f in sorted(SKILLS.glob("*/SKILL.md")):
    m = re.match(r"---\s*\n(.*?)\n---", f.read_text(encoding="utf-8"), re.S)
    meta = dict(re.findall(r"^(\w+):\s*(.+)$", m.group(1), re.M)) if m else {}
    desc = meta.get("description", "(nessuna descrizione)").split(". Usala")[0]
    print(f"- /{meta.get('name', f.parent.name)}: {desc}")

titolo("Link, artifact e chat (efuture-games-links/links.json)")
lj = SKILLS / "efuture-games-links" / "links.json"
if lj.exists():
    links = json.loads(lj.read_text(encoding="utf-8"))
    base = url.group(1) if url else ""
    for gruppo, voci in links.items():
        if gruppo.startswith("_"):
            continue
        for v in voci:
            u = v.get("url") or base + v.get("percorso", "")
            print(f"- [{gruppo}] {v['nome']}: {u}")

titolo("Sessioni di Claude Code (dai commit)")
log = git("log", "--format=%h%x1f%ad%x1f%s%x1f%(trailers:key=Claude-Session,valueonly,separator=%x2C)", "--date=short")
sessioni = OrderedDict()
for riga in log.splitlines():
    h, d, s, sess = (riga.split("\x1f") + [""] * 4)[:4]
    if not sess or s.startswith("Merge "):
        continue
    for x in sess.split(","):
        sessioni.setdefault(x.strip(), []).append((d, s))
for i, (sess, commits) in enumerate(sessioni.items()):
    date = sorted({d for d, _ in commits})
    print(f"- {sess}  ({date[0]}{' → ' + date[-1] if len(date) > 1 else ''}, {len(commits)} commit)")
    for d, s in commits[: (3 if BREVE else 6)]:
        print(f"    · {s}")
    if len(commits) > (3 if BREVE else 6):
        print(f"    · … altri {len(commits) - (3 if BREVE else 6)}")
senza = sum(1 for r in log.splitlines() if not r.split("\x1f")[3:4] or not r.split("\x1f")[3])
print(f"(i commit senza link di sessione – fatti a mano, merge o sessioni più vecchie – sono {senza})")

titolo("Ultimi commit")
print(git("log", f"-{8 if BREVE else 20}", "--no-merges", "--format=- %h %ad %s", "--date=short"))

titolo("Memoria condivisa (efuture-games/memoria.md)")
mem = SKILL / "memoria.md"
print(mem.read_text(encoding="utf-8").strip() if mem.exists() else "(memoria.md non trovato)")
