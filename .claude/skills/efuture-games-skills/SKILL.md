---
name: efuture-games-skills
description: Mostra tutte le skill di Efuture Games, con cosa fa ognuna e quando usarla, e prepara gli zip per caricarle sull'account claude.ai così si possono usare anche nelle chat. Usala quando l'utente chiede quali skill o comandi esistono per l'app, a cosa servono, "cosa posso chiederti" su efuture_games, o come avere le skill nelle chat e nel suo account.
---

# Efuture Games – elenco delle skill

Rispondi all'utente in italiano. `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).

## Elenco

1. Leggi l'elenco aggiornato delle skill, così compaiono sempre anche quelle aggiunte dopo:
   ```
   python3 <skill>/scripts/elenco.py
   ```
2. Mostra una tabella con tre colonne:
   - **Comando** (`/nome`);
   - **A cosa serve**: una frase semplice, tratta dalla descrizione, senza gergo tecnico;
   - **Esempio di richiesta**: una frase che l'utente può scrivere per usarla, ad esempio "dammi i QR da stampare".
   Includi anche questa skill.
3. Sotto la tabella aggiungi due righe:
   - come si usano: scrivere `/nome` oppure chiederlo a parole;
   - dove si trovano: le skill appartengono all'account claude.ai dell'utente, così si usano in tutte le chat e sessioni. L'originale sta in `.claude/skills/` nel repository: quando cambia, va ricaricato sull'account (vedi sotto).
4. Se una skill ha una descrizione mancante o poco chiara, segnalalo e proponi di correggerla.

## Caricare le skill sull'account

Serve quando l'utente vuole le skill nelle chat, oppure dopo che una skill è stata creata o modificata nel repository.

1. Crea gli zip nello scratchpad (aggiungi i nomi delle skill per farne solo alcune):
   ```
   python3 <skill>/scripts/pacchetti.py <scratchpad>/skill-zip
   ```
   Lo script controlla ogni skill. Se una risulta "NO", correggi il problema indicato e rilancialo.
2. Invia gli zip all'utente con SendUserFile (display `attach`).
3. Spiega come caricarli: claude.ai → **Impostazioni → Capacità → Skill → Carica skill**, uno zip alla volta. Se la skill c'è già sull'account, va prima eliminata e poi ricaricata.
