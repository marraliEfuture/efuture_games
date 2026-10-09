#!/usr/bin/env python3
"""Efuture Games - crea uno zip per ogni skill efuture-games-*, pronto da caricare sul tuo account claude.ai
(Impostazioni > Capacità > Skill > Carica skill). Uso: pacchetti.py <cartella di uscita> [nome-skill ...]"""
import re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # .claude/skills
out = Path(sys.argv[1] if len(sys.argv) > 1 else "skill-zip")
nomi = sys.argv[2:]
out.mkdir(parents=True, exist_ok=True)
errori = 0
for d in sorted(ROOT.glob("efuture-games*")):   # anche la skill principale efuture-games
    if nomi and d.name not in nomi:
        continue
    testo = (d / "SKILL.md").read_text(encoding="utf-8")
    m = re.match(r"---\s*\n(.*?)\n---", testo, re.S)
    meta = dict(re.findall(r"^(\w+):\s*(.+)$", m.group(1), re.M)) if m else {}
    problemi = [p for p, ok in [
        ("manca il nome", meta.get("name") == d.name),
        ("descrizione mancante o più lunga di 1024 caratteri", 0 < len(meta.get("description", "")) <= 1024),
        ("usa ancora il percorso .claude/skills/efuture-games-…: usa <skill>/", ".claude/skills/efuture-games-" not in testo),
    ] if not ok]
    if problemi:
        errori += 1
        print(f"NO  {d.name}: " + "; ".join(problemi))
        continue
    z = out / f"{d.name}.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as f:
        for p in sorted(d.rglob("*")):
            if p.is_file() and "__pycache__" not in p.parts:
                f.write(p, p.relative_to(d.parent).as_posix())
    print(f"OK  {z}")
sys.exit(1 if errori else 0)
