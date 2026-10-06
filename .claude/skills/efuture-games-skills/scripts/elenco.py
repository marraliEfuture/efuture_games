#!/usr/bin/env python3
"""Efuture Games - elenca le skill del progetto (.claude/skills/*/SKILL.md) con nome e descrizione."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # .claude/skills
for f in sorted(ROOT.glob("*/SKILL.md")):
    m = re.match(r"---\s*\n(.*?)\n---", f.read_text(encoding="utf-8"), re.S)
    meta = dict(re.findall(r"^(\w+):\s*(.+)$", m.group(1), re.M)) if m else {}
    extra = sorted(p.relative_to(f.parent).as_posix() for p in f.parent.rglob("*") if p.is_file() and p.name != "SKILL.md")
    print(f"/{meta.get('name', f.parent.name)}")
    print(f"  {meta.get('description', '(nessuna descrizione)')}")
    if extra:
        print("  file: " + ", ".join(extra))
    print()
