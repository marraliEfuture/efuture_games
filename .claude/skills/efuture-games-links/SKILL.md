---
name: efuture-games-links
description: Propone tutti i link di Efuture Games — app, installazione, classifica, admin, GitHub, Claude (artifact e sessioni) e ChatGPT — in un elenco pronto da copiare. Usala quando l'utente chiede i link, gli indirizzi o "dove trovo" l'app, la classifica, l'admin o le chat del gioco.
---

# Efuture Games – tutti i link

Rispondi all'utente in italiano.

## Procedura

1. Leggi `PUBLIC_URL` da `config.js`: è la base dei link del sito. Leggi poi `.claude/skills/efuture-games-links/links.json`.
2. Costruisci i link:
   - **sito:** `PUBLIC_URL` + `percorso` per ogni voce;
   - **github, claude, chatgpt:** `url` così com'è;
   - **ultime sessioni Claude Code:** prendi i link `Claude-Session:` distinti dagli ultimi commit (`git log -30 --format=%B | grep Claude-Session | awk '!s[$0]++'`, i più recenti prima) e mostra al massimo i 3 più recenti.
3. Se il tool `Artifact` è disponibile, fai `action: "list"` e controlla gli artifact di Claude:
   - aggiungi quelli del gioco che mancano in `links.json`: titoli "Efuture Games", "SysAdmin", "CoreTech", "Timenet", "Inncloud";
   - segnala quelli in `links.json` che non esistono più.
   Non modificare `links.json` senza chiedere.
4. Mostra un'unica risposta con una sezione per gruppo, nell'ordine: **Sito** (App, Installazione, Classifica, Admin), **GitHub**, **Claude**, **ChatGPT**. Ogni link è cliccabile e ha una nota breve.
5. Se la sezione `chatgpt` è vuota, scrivi "nessun link salvato" e chiedi all'utente il link da aggiungere.
6. Se l'utente dà nuovi link o correzioni, aggiorna `links.json` e proponi di salvarlo con la skill `efuture-games-commit`.

## Note

- Non mostrare mai la chiave admin né i codici di sblocco: i link vanno bene, i segreti no.
- Il link del QR di installazione è quello con `?installa=1`. I link di sblocco (`?sblocca=…`) contengono i codici: non elencarli qui, sono nella skill `efuture-games-qr`.
