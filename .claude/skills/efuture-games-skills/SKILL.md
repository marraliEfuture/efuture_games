---
name: efuture-games-skills
description: Mostra tutte le skill di Efuture Games presenti nel progetto, con cosa fa ognuna e quando usarla. Usala quando l'utente chiede quali skill o comandi esistono per l'app, a cosa servono, o "cosa posso chiederti" su efuture_games.
---

# Efuture Games – elenco delle skill

Rispondi all'utente in italiano.

1. Leggi l'elenco aggiornato delle skill del progetto, così compaiono sempre anche quelle aggiunte dopo:
   ```
   python3 .claude/skills/efuture-games-skills/scripts/elenco.py
   ```
2. Mostra una tabella con tre colonne:
   - **Comando** (`/nome`);
   - **A cosa serve**: una frase semplice, tratta dalla descrizione, senza gergo tecnico;
   - **Esempio di richiesta**: una frase che l'utente può scrivere per usarla, ad esempio "dammi i QR da stampare".
   Includi anche questa skill.
3. Sotto la tabella aggiungi due righe:
   - come si usano: scrivere `/nome` oppure chiederlo a parole;
   - dove si trovano: `.claude/skills/` nel repository. Vengono caricate solo nelle sessioni aperte su questo repository.
4. Se una skill ha una descrizione mancante o poco chiara, segnalalo e proponi di correggerla.
