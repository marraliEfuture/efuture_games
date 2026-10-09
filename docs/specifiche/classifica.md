# Classifica da proiettare

## In breve

`classifica.html` è la pagina da aprire su un PC collegato a uno schermo o al ledwall. Mostra:
- le classifiche dei 4 giochi;
- la classifica generale;
- un QR grande per aprire l'app.

Si aggiorna da sola ogni 15 s. Righe nuove e cambi di posizione sono animati. Con i pulsanti si sceglie cosa mostrare e le scelte restano salvate. Da qui un amministratore avvia il countdown di apertura o di chiusura della gara. Usa `backend.js`, quindi funziona anche in modalità demo.

Indirizzo: `https://marraliefuture.github.io/efuture_games/classifica.html`. Script caricati: `config.js?v=N`, `vendor/supabase.js`, `backend.js?v=N` e uno script nella pagina.

## Cosa si vede

Dall'alto in basso:

1. **Barra scura:** "CARE Conference 2026 · Efuture Games" e la pillola "Classifica live".
2. **Intestazione bianca:**
   - titolo "Classifica Efuture Games" ("Classifica" in azzurro) con "CARE Conference Edition";
   - a destra:
     - stato con un pallino: verde pulsante se la classifica è raggiungibile, rosso se no;
     - pulsanti **📺 Proietta**, **⏱ Countdown** e **Admin** (link ad `admin.html`).
3. **Barra del countdown**, se attivo: grande, blu notte.
4. **Pulsanti di visualizzazione:** Classifica, Top, Giocatori, QR.
5. **Area principale:**
   - **4 riquadri, uno per gioco**, disposti 2×2. Ognuno ha icona, nome e sottotitolo `Top N · livelli, poi punti`, con il gruppo se filtrato. Riga: posizione, nome, `L/3 liv`, punti.
   - **Classifica generale**, in un riquadro blu notte a destra dei giochi. Sottotitolo "Somma dei record nei 4 giochi · livelli, poi punti". Etichetta arancio "Solo utenti Efuture" o "Solo ospiti" se filtrata. Riga: posizione, nome, `G/4 giochi · L/12 liv`, punti.
   - **QR grande** (`qr/qr-app.svg`, il link di installazione dell'app) con "Gioca anche tu · Inquadra il QR con la fotocamera". La dimensione si adatta allo schermo: `min(20vw, (100vh − 440px) ÷ 2)`, cioè metà della misura usata fino alla v44; a schermo intero `min(22vw, (100vh − 290px) ÷ 2)`. Sotto i 900 px (QR sotto la classifica e non di fianco) resta di massimo 380 px.
6. **Nota demo**, solo in modalità demo.
7. **Piè di pagina:** "Sblocca i giochi agli stand", le regole "3 livelli per gioco, 1 minuto ciascuno · punti = livello × secondi avanzati × vite" e, a destra, il logo Efuture bianco.

Podio: 1° arancio, 2° azzurro, 3° pesca. Lista vuota: "Ancora nessun punteggio. Sarai il primo?".

**Layout:**

| Larghezza | Disposizione |
|---|---|
| ≥ 1200 px (ledwall, TV) | Spazi compatti, tutto in una schermata |
| ≤ 900 px | Una colonna, generale in alto. QR non fisso (massimo 380 px) |
| ≤ 560 px | Giochi in una colonna |

Stile del sito efuture.it:
- font: Montserrat per i titoli, Poppins per i testi;
- colori: fondo `#f8f8f9`, blu notte `#002238`, azzurro `#8ad0ff`, arancio pulsanti `#ff6d00`.

## Pulsanti di visualizzazione e parametri URL

| Gruppo | Valori | Predefinito | Parametro URL | Effetto |
|---|---|---|---|---|
| Classifica | Generale / Giochi / Tutti | Giochi | `classifica=generale\|giochi\|tutti` | Solo la generale / solo i 4 giochi / entrambi |
| Top | 3 / 5 / 10 | 5 | `top=3\|5\|10` | Righe mostrate per **ogni** classifica, generale compresa |
| Giocatori | Ospiti / Efuture / Tutti | Tutti | `giocatori=ospiti\|efuture\|tutti` | Filtro per gruppo (vedi sotto) |
| QR | Sì / No | Sì | `qr=si\|no` (accetta anche `1`/`0`) | Mostra o nasconde il QR grande |

- **Priorità:** parametro URL valido, poi scelta salvata, poi predefinito.
- Le scelte si salvano a ogni cambio in `localStorage` alla chiave `efgBoardView3`. Restano su quello schermo.
- Esempio: `classifica.html?classifica=tutti&top=10&giocatori=efuture&qr=no`.
- **Tastiera:** i gruppi funzionano come radiogroup, con le frecce ← → che passano da un valore all'altro.
- Cambiare Top o Giocatori ridisegna le liste senza animazioni e ricarica subito.

**Filtro Giocatori:**
- **Efuture:** email che finisce con `@efuture.it`, sottodomini compresi (per esempio `@reparto.efuture.it`). Maiuscole e spazi non contano.
- **Ospiti:** tutti gli altri.
- Con Ospiti o Efuture la pagina chiama `efg_board_group`; con Tutti chiama `efg_board`.
- Se `efg_board_group` non esiste su Supabase (`supabase-classifica-gruppi.sql` non eseguito), la pagina mostra **tutti** i giocatori. Nello stato in alto compare: "⚠ Filtro Giocatori non attivo: eseguire supabase-classifica-gruppi.sql su Supabase (mostro tutti) · ora".

## Dati, ordine e aggiornamento

- A ogni aggiornamento la pagina chiede in parallelo 5 classifiche: `all` e i 4 giochi. Ognuna restituisce al massimo 50 righe `{pid, name, levels, score, games}`. Le email non arrivano mai alla pagina.
- **Ordine del server:** livelli superati, poi punti, poi chi ha fatto il record prima. Anche la pagina, in `render()`, ordina per livelli e poi per punti (ordinamento stabile) e taglia a Top N.
- **Frequenza:** ogni **15 s** (`EVERY`), più quando la pagina torna visibile. In demo anche all'evento `storage`, cioè quando l'app scrive nello stesso browser.
- **Stato:**
  - riuscito: "Live · aggiornata alle hh:mm:ss";
  - errore: "Classifica non raggiungibile (*messaggio*), riprovo…" e pallino rosso.

## Animazioni

- Ogni giocatore ha la sua riga, riconosciuta dal `pid`, che viene riusata tra un aggiornamento e l'altro.
- Animazione FLIP:
  - chi sale o scende scorre alla nuova posizione in 700 ms;
  - una riga nuova entra da sinistra con dissolvenza in 650 ms;
  - una riga con livelli o punti cambiati si colora di arancio chiaro per 2,5 s (`.fresh`).
- Nessuna animazione al primo caricamento, dopo un cambio di Top o Giocatori, o con `prefers-reduced-motion`.

## Countdown (pulsante ⏱ Countdown)

La finestra "Countdown della gara" contiene:
- lo **stato attuale**:
  - "Nessun countdown attivo…";
  - "Attivo: apertura tra …";
  - "Attivo: chiusura tra …";
  - "Gara chiusa… Stop per riaprire";
  - "Apertura completata…";
- **Tipo:** Apertura / Chiusura, con una spiegazione;
- **Minuti:** da 1 a 1440, predefinito 10;
- **Chiave admin**, solo online;
- pulsanti **▶ Start**, **■ Stop**, **Chiudi**.

**Comportamento:**
- **Apertura:** fino allo zero i 4 giochi sono bloccati per tutti, poi si aprono da soli.
- **Chiusura:** si gioca fino allo zero. Poi i giochi si bloccano, una partita in corso viene chiusa e il server rifiuta i punteggi (tolleranza di 10 s).
- **Stop:** annulla il countdown e i giochi tornano liberi. Riapre anche una gara chiusa.

**Online:**
- Start e Stop chiamano `efg_admin_gate(p_key, p_mode, p_minutes)`, con `p_mode` = `apertura`, `chiusura` o `stop`.
- Se la chiave è giusta viene ricordata in `sessionStorage` (`efgAdminKey`, solo per quella scheda e condivisa con `admin.html` nella stessa scheda). Se è sbagliata viene dimenticata.
- Messaggi:
  - funzione assente: "esegui prima supabase-countdown.sql…";
  - chiave mancante: "scrivi la chiave admin".
- Il blocco dopo 8 chiavi sbagliate in 10 minuti vale anche qui, perché il controllo è lo stesso dell'admin.

**Demo:** la riga della chiave è nascosta e il countdown si salva in `efgDemoGate` del browser.

**Barra del countdown:**
- testi:
  - "I giochi si aprono tra m:ss";
  - "La gara si chiude tra m:ss", con le cifre rosse nell'ultimo minuto;
  - "🏁 Gara chiusa · classifica definitiva", su fondo rosso scuro;
- sopra un'ora il formato è h:mm:ss;
- l'ora è quella del server, con lo scarto calcolato da `now`;
- lo stato si rilegge ogni **10 s** e si ridisegna ogni secondo.

## Proietta (secondo monitor) e schermo intero

- Il pulsante **📺 Proietta** (al posto del vecchio "Schermo intero") apre la classifica in una **nuova finestra sul secondo monitor** (ledwall o proiettore), con gli stessi filtri (`?…&proietta=1`, nome finestra `efgLedwall`). La finestra da cui si preme resta dov'è: se è aperta dall'admin, il primo monitor resta sull'admin e non si chiedono di nuovo le credenziali.
- Con Chrome o Edge usa la Window Management API (`getScreenDetails`) per posizionare la finestra (`window.open` con `popup,left,top,width,height`) sull'altro schermo, preferendo uno non principale:
  - la prima volta il browser chiede il permesso "Gestione finestre"; se la finestra viene bloccata, il messaggio dice "premi di nuovo";
  - se il permesso c'è già, gli schermi si leggono all'apertura della pagina;
  - senza secondo monitor, senza permesso o con altri browser la finestra si apre normale (1280×760) e un messaggio in basso dice di trascinarla sull'altro schermo.
- **Finestra proiettata** (`?proietta=1`): un velo scuro dice "Clicca qui per lo schermo intero"; il clic la mette a schermo intero **su quel monitor**. Il pulsante lì si chiama **Schermo intero** e mette o toglie lo schermo intero senza spostare la finestra. Uscendo dallo schermo intero il velo ricompare.
- A schermo intero si nascondono Countdown, Admin e i pulsanti di visualizzazione. La barra del countdown resta visibile e il QR diventa più grande.

## Modalità demo

Senza Supabase compare la nota "Modalità demo: il database online non è ancora configurato, qui vedi solo i punteggi fatti su questo dispositivo." I dati sono quelli del `localStorage` del browser (vedi [app-giocatori.md](app-giocatori.md#modalità-demo-e-online)).

---
Ultimo aggiornamento: 07/10/2026 (v27)
