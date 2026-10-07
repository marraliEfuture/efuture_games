# Efuture Games

## Skill

Le skill di Efuture Games devono appartenere all'account claude.ai dell'utente, non solo al repository, così si possono usare in tutte le chat.

Quando crei o modifichi una skill:
- mettila in `.claude/skills/efuture-games-<nome>/` (il nome deve iniziare con `efuture-games-`);
- scrivi SKILL.md e la parte in italiano, in modo semplice;
- deve funzionare anche fuori dal repository: nei comandi usa `<skill>/...` invece di `.claude/skills/...` e copia la sezione "Dove lavorare" delle altre skill (clone del repository pubblico ed `EFG_REPO`);
- alla fine crea lo zip con `python3 .claude/skills/efuture-games-skills/scripts/pacchetti.py <scratchpad>/skill-zip <nome>`, invialo all'utente e ricordagli di caricarlo in claude.ai → Impostazioni → Capacità → Skill.
