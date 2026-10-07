#!/usr/bin/env python3
"""Efuture Games - controlli prima del commit e aumento della versione dell'app.

Uso:
  python3 prepara.py controlla          controlli e basta
  python3 prepara.py versione           controlli + versione v(N) -> v(N+1)

Controlli:
  - ogni file elencato in ASSETS di sw.js esiste (se ne manca uno, il service
    worker non si installa e l'app non funziona più offline né si installa);
  - sintassi di tutti i .js del sito (node --check), vendor/ esclusi;
  - la versione è la stessa ovunque: sw.js (CACHE), ?v=N negli html, "· vN" in hub.js.
La versione va aumentata quando cambiano file del sito, così i telefoni che hanno
già l'app scaricano la nuova copia.
"""
import json, os, re, shutil, subprocess, sys
from pathlib import Path

# repository: EFG_REPO, altrimenti quello che contiene la skill, altrimenti la cartella corrente
REPO = Path(os.environ.get("EFG_REPO") or next((p for p in Path(__file__).resolve().parents if (p / "config.js").exists()), Path.cwd()))
PATTERNS = [  # (file glob, regex con il numero nel gruppo 1, sostituzione)
    ("sw.js", r"efuture-games-v(\d+)", "efuture-games-v{n}"),
    ("*.html", r"\.js\?v=(\d+)", ".js?v={n}"),
    ("hub.js", r"· v(\d+)'", "· v{n}'"),
]


def versions():
    found = {}
    for glob, rx, _ in PATTERNS:
        for f in REPO.glob(glob):
            for m in re.finditer(rx, f.read_text(encoding="utf-8")):
                found.setdefault(int(m.group(1)), set()).add(f.name)
    return found


def check():
    errors = []
    sw = (REPO / "sw.js").read_text(encoding="utf-8")
    m = re.search(r"const ASSETS = (\[.*?\]);", sw, re.S)
    assets = json.loads(m.group(1)) if m else []
    if not assets:
        errors.append("sw.js: elenco ASSETS non trovato")
    for a in assets:
        if a not in ("./",) and not (REPO / a).is_file():
            errors.append(f"sw.js: il file in cache '{a}' non esiste")
    if shutil.which("node"):
        for f in sorted(REPO.rglob("*.js")):
            rel = f.relative_to(REPO)
            if rel.parts[0] in ("vendor", ".git", ".claude", "node_modules"):
                continue
            r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
            if r.returncode:
                errors.append(f"{rel}: errore di sintassi\n{r.stderr.strip()}")
    else:
        print("node non trovato: controllo di sintassi JS saltato")
    v = versions()
    if len(v) != 1:
        errors.append("versioni diverse nei file: " + ", ".join(f"v{k} in {sorted(fs)}" for k, fs in sorted(v.items())))
    return errors, (max(v) if v else None)


def bump(cur):
    new = cur + 1
    for glob, rx, rep in PATTERNS:
        for f in REPO.glob(glob):
            t = f.read_text(encoding="utf-8")
            t2 = re.sub(rx, lambda m: m.group(0).replace(m.group(1), str(new)) if m.group(1) == str(cur) else m.group(0), t)
            if t2 != t:
                f.write_text(t2, encoding="utf-8")
    return new


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "controlla"
    errors, cur = check()
    if errors:
        print("CONTROLLI NON SUPERATI:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print(f"controlli OK (versione attuale v{cur})")
    if mode == "versione":
        new = bump(cur)
        errors, now = check()
        if errors or now != new:
            print("aumento di versione non riuscito:", errors or now)
            sys.exit(1)
        print(f"versione aumentata: v{cur} -> v{new}")


if __name__ == "__main__":
    main()
