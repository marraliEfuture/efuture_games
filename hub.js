(function(){
"use strict";

/* ================= GAMES ================= */
// unlock codes are checked against SHA-256("efg:" + CODE without dashes, upper case)
const GAMES = [
  { id:'sysadmin', name:'SysAdmin Runner',   sponsor:'Efuture',  icon:'img/g-sysadmin.png', path:'games/sysadmin/index.html',
    hash:'d11666b04b40ab1e45c11191ae7aa717be9c9275f64b633525559dc8895d936b' },
  { id:'coretech', name:'CoreTech Pac',      sponsor:'CoreTech', icon:'img/g-coretech.png', path:'games/coretech/index.html',
    hash:'8b9458de8fd04f3d7303d6317f3731330b0966acae29322d30b911291191fd9a' },
  { id:'timenet',  name:'Timenet Breakout',  sponsor:'Timenet',  icon:'img/g-timenet.png',  path:'games/timenet/index.html',
    hash:'29daa7b03dd7231bbec63c61643ed7a24c31dd0ae2123fb2c9b28d3e11a8ed9c' },
  { id:'inncloud', name:'Inncloud Invaders', sponsor:'Inncloud', icon:'img/g-inncloud.png', path:'games/inncloud/index.html',
    hash:'28efc8bdf7a8836e85fec8d0de3baf9c00aa3e7e1eb48afd909776897c40ebb3' },
];
const byId = Object.fromEntries(GAMES.map(g=>[g.id, g]));
const LEVELS = 3, LEVEL_SECONDS = 60, TOTAL = LEVELS*LEVEL_SECONDS;   // score = seconds left out of 180

/* ================= HELPERS ================= */
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v===null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
async function sha256(txt){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const normCode = c => String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function normPhone(p){
  let s = String(p||'').replace(/[^\d+]/g,'');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) s = '+39' + s;        // Italian numbers by default
  return s;
}
const validPhone = p => /^\+\d{8,15}$/.test(p);
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
let toastT = 0;
function toast(msg, ms){ const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(()=>{ t.hidden = true; }, ms||3200); }
function setMsg(el, text, kind){ el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); }
function openModal(id){ $(id).hidden = false; }
$('btnHelp').addEventListener('click', ()=>openModal('mHelp'));
document.querySelectorAll('.modal').forEach(m=>{
  m.addEventListener('click', e=>{ if ((e.target === m && m.id !== 'mResult') || e.target.closest('[data-close]')){ m.hidden = true; if (m.id === 'mUnlock') stopCam(); } });
});
document.addEventListener('keydown', e=>{ if (e.key === 'Escape'){ ['mUnlock','mAuth','mBoard','mInstall','mHelp'].forEach(id=>$(id).hidden = true); stopCam(); } });

/* ================= STATE ================= */
let unlocked = new Set(store.get('efgUnlocked', []));
// best result per game on this device: { l: levels passed (0-3), s: points }
let bests = store.get('efgBests4', {});
const better = (a, b) => !b || a.l > b.l || (a.l === b.l && a.s > b.s);
const fmtRes = r => r.l + '/' + LEVELS + ' liv · ' + r.s + ' pt';
let session = null;                          // {id, email, nickname}
let gate = { mode:null }, gateOffset = 0, lastPhase = null;   // countdown di apertura/chiusura

/* ================= BACKEND (backend.js) ================= */
const Backend = window.EFG_BACKEND, friendly = window.EFG_FRIENDLY, remote = Backend.remote;

/* ================= LOBBY ================= */
function renderGrid(){
  const grid = $('grid'); grid.innerHTML = '';
  for (const g of GAMES){
    const open = unlocked.has(g.id);
    const b = document.createElement('button');
    b.className = 'game ' + (open ? 'open' : 'locked'); b.type = 'button';
    b.setAttribute('aria-label', g.name + (open ? ', gioca' : ', bloccato'));
    const img = document.createElement('img'); img.src = g.icon; img.alt = '';
    const name = document.createElement('span'); name.className = 'name'; name.textContent = g.name;
    const st = document.createElement('span'); st.className = 'state'; st.textContent = open ? 'Gioca ▶' : 'Da sbloccare';
    const best = document.createElement('span'); best.className = 'best';
    if (bests[g.id]){ best.innerHTML = 'Record: <b></b>'; best.querySelector('b').textContent = fmtRes(bests[g.id]); }
    b.append(img, name, st, best);
    const gp = gatePhase().phase, blocked = gp === 'prima' || gp === 'chiuso';
    if (blocked){ b.disabled = true; b.setAttribute('aria-label', g.name + (gp === 'prima' ? ', non ancora aperto' : ', gara chiusa')); }
    b.addEventListener('click', ()=>{ if (isBlocked()) return; open ? play(g) : askUnlock(g); });
    grid.appendChild(b);
  }
}
function renderDock(){
  $('dockOut').hidden = !!session; $('dockIn').hidden = !session; $('who').hidden = !session;
  if (session){ $('who').textContent = 'Ciao, '; const b = document.createElement('b'); b.textContent = session.nickname; $('who').append(b); }
  const mn = $('modeNote'); mn.hidden = false;
  mn.textContent = remote ? 'Classifica online · v22' : 'Modalità demo: account e classifica restano su questo telefono. · v22';
}

/* ================= UNLOCK: camera + code ================= */
let pendingGame = null;
function askUnlock(g){
  pendingGame = g;
  $('uIcon').src = g.icon; $('uTitle').textContent = g.name;
  $('uQrText').textContent = 'Trovi il QR allo stand ' + g.sponsor + '. Apri la fotocamera e inquadralo.';
  $('uCode').value = ''; setMsg($('uMsg'), ''); setMsg($('camMsg'), '');
  $('camBox').hidden = true; $('btnCam').hidden = false;
  openModal('mUnlock');
}
async function unlockWith(code){
  const h = await sha256('efg:' + normCode(code));
  const g = GAMES.find(x=>x.hash === h);
  if (!g) return null;
  unlocked.add(g.id); store.set('efgUnlocked', [...unlocked]); renderGrid();
  return g;
}
function codeFromText(t){
  try { const u = new URL(t); const c = u.searchParams.get('sblocca'); if (c) return c; } catch(e){}
  return t;
}
async function unlocked_ok(g){
  stopCam(); $('mUnlock').hidden = true; toast(g.name + ' sbloccato!');
  if (pendingGame && g.id === pendingGame.id) play(g);
}
$('uForm').addEventListener('submit', async e=>{
  e.preventDefault();
  if (!normCode($('uCode').value)) return setMsg($('uMsg'), 'Scrivi il codice che trovi sotto il QR.', 'err');
  const g = await unlockWith($('uCode').value);
  if (!g) return setMsg($('uMsg'), 'Codice non valido. Controlla le lettere e riprova.', 'err');
  unlocked_ok(g);
});

let camStream = null, camRAF = 0, camCanvas = null;
async function startCam(){
  setMsg($('camMsg'), '');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.jsQR){
    return setMsg($('camMsg'), 'Questo telefono non permette di aprire la fotocamera qui: usa la fotocamera del telefono o inserisci il codice.', 'err');
  }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
  } catch(err){
    return setMsg($('camMsg'), 'Non ho accesso alla fotocamera. Consenti l\'accesso nelle impostazioni o inserisci il codice.', 'err');
  }
  const v = $('camVideo'); v.srcObject = camStream; await v.play().catch(()=>{});
  $('camBox').hidden = false; $('btnCam').hidden = true;
  camCanvas = camCanvas || document.createElement('canvas');
  const ctx = camCanvas.getContext('2d', { willReadFrequently:true });
  let busy = false;
  const scan = async ()=>{
    if (!camStream) return;
    if (v.readyState >= 2 && !busy){
      const w = 480, h = Math.round(480 * (v.videoHeight / v.videoWidth || 1));
      camCanvas.width = w; camCanvas.height = h; ctx.drawImage(v, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const hit = window.jsQR(img.data, w, h, { inversionAttempts:'dontInvert' });
      if (hit && hit.data){
        busy = true;
        const g = await unlockWith(codeFromText(hit.data));
        if (g){ if (navigator.vibrate) navigator.vibrate(60); unlocked_ok(g); return; }
        setMsg($('camMsg'), 'Questo QR non sblocca nessun gioco.', 'err'); setTimeout(()=>{ busy = false; }, 1200);
      }
    }
    camRAF = requestAnimationFrame(scan);
  };
  camRAF = requestAnimationFrame(scan);
}
function stopCam(){
  cancelAnimationFrame(camRAF);
  if (camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream = null; }
  const v = $('camVideo'); if (v) v.srcObject = null;
}
$('btnCam').addEventListener('click', startCam);

// QR scanned with the phone's own camera app: the link opens the app with ?sblocca=CODE
(async function unlockFromUrl(){
  const u = new URL(location.href);
  const code = u.searchParams.get('sblocca');
  if (!code) return;
  const g = await unlockWith(code);
  history.replaceState(null, '', location.pathname);
  toast(g ? g.name + ' sbloccato! Toccalo per giocare.' : 'Questo QR non è valido.', 4200);
})();

/* ================= PLAY (competition mode: 3 levels x 60 s) ================= */
let playing = null, runUsed = 0;
function play(g){
  if (isBlocked()){ toast(gatePhase().phase === 'prima' ? 'I giochi non sono ancora aperti.' : 'La gara è chiusa.'); return; }
  playing = g; runUsed = 0;
  $('playerTitle').textContent = g.name;
  $('playerClock').textContent = '';
  $('frame').src = g.path + '?hub=1';
  $('player').hidden = false; $('mResult').hidden = true;
  document.body.style.overflow = 'hidden';
}
function closePlayer(){
  $('player').hidden = true; $('mResult').hidden = true; $('frame').src = 'about:blank'; playing = null;
  document.body.style.overflow = ''; renderGrid();
}
$('btnBack').addEventListener('click', closePlayer);
$('rsHome').addEventListener('click', closePlayer);
$('rsAgain').addEventListener('click', ()=>{ const g = playing; if (g) play(g); });

window.addEventListener('message', async e=>{
  const d = e.data;
  if (!d || d.type !== 'efg' || !playing || e.source !== $('frame').contentWindow) return;
  if (d.ev === 'start'){ runUsed = 0; $('playerClock').textContent = ''; return; }
  if (d.ev === 'tick'){
    const left = Math.max(0, LEVEL_SECONDS - d.t);
    const clk = $('playerClock');
    clk.textContent = 'Liv ' + d.level + '/' + LEVELS + ' · ⏱ ' + fmt(left);
    clk.classList.toggle('warn', left <= 10);
    return;
  }
  if (d.ev === 'result') showResult(playing, !!d.ok, d.reason, Number(d.seconds)||0, Number(d.level)||1, Number(d.used)||0, Array.isArray(d.times) ? d.times.map(Number) : null, Array.isArray(d.lives) ? d.lives.map(Number) : null);
});

// ogni livello superato vale: numero del livello x secondi che avanzano sul suo minuto x vite rimaste
// es. livello 1 finito a 35 s con 2 vite → 1 x 25 x 2 = 50; livello 2 con 20 s e 3 vite → 2 x 20 x 3 = 120.
// Un livello non finito vale 0; alla fine si sommano i livelli superati.
async function showResult(g, ok, reason, seconds, level, used, times, lives){
  if (!times){ const n = ok ? LEVELS : Math.max(0, level - 1); times = Array.from({length:n}, ()=> n ? used / n : 0); }
  times = times.slice(0, LEVELS);
  const levels = times.length;
  const parts = times.map((t, i)=>{ const left = Math.max(0, Math.round(LEVEL_SECONDS - t)); const v = Math.max(0, (lives && lives[i] !== undefined) ? lives[i] : 1); return { n:i+1, left, v, pts:(i+1)*left*v }; });
  const score = parts.reduce((a, p)=> a + p.pts, 0);
  const res = { l:levels, s:score };
  $('rsIcon').src = g.icon; $('rsGame').textContent = g.name;
  $('rsTitle').textContent = ok ? 'Tre livelli completati!' : (reason === 'time' ? 'Tempo scaduto' : 'Vite finite');
  $('rsScore').textContent = score;
  $('rsLine').textContent = 'punti · ' + levels + (levels === 1 ? ' livello superato' : ' livelli superati') + ' su ' + LEVELS;
  $('rsLevels').textContent = levels + '/' + LEVELS;
  $('rsTime').textContent = fmt(times.reduce((a,b)=>a+b,0));
  $('rsCalc').textContent = parts.length ? parts.map(p=> p.n + '×' + p.left + '×' + p.v).join(' + ') + ' = ' + score : '';
  const prev = bests[g.id];
  const isBest = levels > 0 && better(res, prev);
  if (isBest){ bests[g.id] = res; store.set('efgBests4', bests); }
  $('rsBest').textContent = bests[g.id] ? fmtRes(bests[g.id]) : '—';
  const msg = $('rsMsg');
  if (levels === 0) setMsg(msg, 'Supera almeno un livello entro il minuto per entrare in classifica.' + (prev ? ' Il tuo record resta valido.' : ''));
  else if (!isBest) setMsg(msg, 'Il tuo record resta ' + fmtRes(prev) + ': in classifica conta solo il risultato migliore.');
  else if (!session) setMsg(msg, 'Nuovo record! Registrati o accedi per entrare in classifica.', 'ok');
  else {
    setMsg(msg, 'Nuovo record! Salvo in classifica…', 'ok');
    try { await Backend.submit(session, g.id, score, levels); setMsg(msg, 'Nuovo record salvato in classifica!', 'ok'); }
    catch(err){ setMsg(msg, 'Non riesco a salvare in classifica: ' + friendly(err), 'err'); }
  }
  $('mResult').hidden = false;
}

/* ================= AUTH (senza password) ================= */
function showAuth(view){
  $('fSignup').hidden = view !== 'signup'; $('fLogin').hidden = view !== 'login';
  $('tabSignup').classList.toggle('on', view === 'signup'); $('tabLogin').classList.toggle('on', view === 'login');
  $('aTitle').textContent = view === 'signup' ? 'Registrati' : 'Accedi';
  ['sMsg','lMsg'].forEach(id=>setMsg($(id), ''));
}
$('tabSignup').onclick = ()=>showAuth('signup');
$('tabLogin').onclick = ()=>showAuth('login');
$('btnAuth').onclick = ()=>{ showAuth('signup'); openModal('mAuth'); };
const validEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function loggedIn(user){
  session = user; $('mAuth').hidden = true; renderDock(); toast('Benvenuto, ' + session.nickname + '!');
  for (const g of GAMES){ const b = bests[g.id]; if (b && b.l > 0){ try { await Backend.submit(session, g.id, b.s, b.l); } catch(e){} } }   // records made before logging in
}
$('fSignup').addEventListener('submit', async e=>{
  e.preventDefault();
  const name = $('sName').value.trim(), phone = normPhone($('sPhone').value), email = $('sEmail').value.trim();
  const m = $('sMsg');
  if (name.length < 2 || name.length > 20) return setMsg(m, 'Il nome deve avere da 2 a 20 caratteri.', 'err');
  if (!validPhone(phone)) return setMsg(m, 'Scrivi un numero di cellulare valido, ad esempio +39 333 1234567.', 'err');
  if (!validEmail(email)) return setMsg(m, 'Scrivi un indirizzo email valido.', 'err');
  setMsg(m, 'Un attimo…');
  try { const r = await Backend.signUp({ name, phone, email }); loggedIn(r.user); }
  catch(err){ setMsg(m, friendly(err), 'err'); }
});
$('fLogin').addEventListener('submit', async e=>{
  e.preventDefault(); const m = $('lMsg');
  const email = $('lEmail').value.trim();
  if (!validEmail(email)) return setMsg(m, 'Scrivi l\'email con cui ti sei registrato.', 'err');
  setMsg(m, 'Un attimo…');
  try { const r = await Backend.signIn(email); loggedIn(r.user); }
  catch(err){ setMsg(m, friendly(err), 'err'); }
});
$('btnLogout').onclick = async ()=>{ await Backend.signOut(); session = null; renderDock(); toast('Sei uscito.'); };

/* ================= LEADERBOARD ================= */
let boardTab = 'all';
function renderBoardTabs(){
  const tabs = $('bTabs'); tabs.innerHTML = '';
  [['all','Totale'], ...GAMES.map(g=>[g.id, g.name])].forEach(([id, label])=>{
    const t = document.createElement('button'); t.type = 'button'; t.className = 'tab' + (id===boardTab?' on':''); t.textContent = label;
    t.onclick = ()=>{ boardTab = id; renderBoardTabs(); loadBoard(); };
    tabs.appendChild(t);
  });
}
function boardMessage(text){ const list = $('bList'); list.innerHTML = ''; const li = document.createElement('li'); li.className = 'empty'; li.style.cssText = 'display:block;background:none'; li.textContent = text; list.appendChild(li); }
async function loadBoard(){
  boardMessage('Carico la classifica…');
  let rows;
  try { rows = await Backend.board(boardTab); } catch(e){ return boardMessage('Classifica non raggiungibile: controlla la connessione.'); }
  if (!rows.length) return boardMessage('Ancora nessun punteggio. Gioca e sii il primo!');
  const list = $('bList'); list.innerHTML = '';
  rows.forEach((r, i)=>{
    const li = document.createElement('li'); if (session && r.pid === session.id) li.className = 'me';
    const a = document.createElement('span'); a.className = 'r'; a.textContent = i+1;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = r.name;
    const s = document.createElement('span'); s.className = 's'; s.textContent = (boardTab === 'all' ? (r.games||0) + '/' + GAMES.length + ' giochi · ' + (r.levels||0) + '/' + LEVELS*GAMES.length : (r.levels||0) + '/' + LEVELS) + ' liv · ' + r.score + ' pt';
    li.append(a, n, s); list.appendChild(li);
  });
}
$('btnBoard').onclick = ()=>{
  $('bNote').textContent = (boardTab === 'all' ? 'Totale = somma dei record nei 4 giochi. Prima contano i livelli superati, poi i punti. ' : '') + (remote ? '' : 'Modalità demo: solo i giocatori di questo telefono.');
  renderBoardTabs(); openModal('mBoard'); loadBoard();
};

/* ================= INSTALLA L'APP =================
   Android/Chrome: usa la richiesta di installazione del browser (beforeinstallprompt).
   iPhone/iPad: Safari non ha una richiesta automatica, quindi mostriamo le istruzioni.
   Si apre da sola alla prima visita e ogni volta che si arriva da un QR. */
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
// Samsung Internet crea il pacchetto dell'app con un formato vecchio e Google Play Protect lo blocca:
// lì non usiamo la sua installazione ma proponiamo Chrome (o il collegamento sulla schermata Home)
const isSamsung = /SamsungBrowser/i.test(ua);
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const fromQr = /[?&](sblocca|installa)=/.test(location.search);
if (/[?&]installa=/.test(location.search)) history.replaceState(null, '', location.pathname);
let installEvt = null, autoShown = false;
// "già installata" vale solo 3 giorni e non conta quando si arriva dal QR o da Samsung Internet
// (l'installazione può essere stata bloccata da Play Protect o l'app disinstallata)
function installedRecently(){ const t = store.get('efgInstalled', 0); return typeof t === 'number' && Date.now() - t < 3*24*3600*1000; }
function canInstall(){ return !isStandalone() && window.top === window && (fromQr || isSamsung || !installedRecently()); }
function openInstall(){
  if (!canInstall()) return;
  autoShown = true;
  $('iAuto').hidden = !installEvt || isSamsung;
  $('iIos').hidden = !(isIOS && !installEvt);
  $('iSamsung').hidden = !isSamsung;
  $('iAndroid').hidden = !(!isIOS && !installEvt && isAndroid && !isSamsung);
  if (!installEvt && !isIOS && !isAndroid) return;          // computer senza richiesta del browser: niente finestra
  openModal('mInstall');
}
function updateInstallBtn(){ $('btnInstall').hidden = !(canInstall() && (installEvt || isIOS || isAndroid)); }
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault(); if (isSamsung) return;
  installEvt = e; updateInstallBtn();
  if (autoInstallDue()) setTimeout(openInstall, 600);
});
window.addEventListener('appinstalled', ()=>{ installEvt = null; store.set('efgInstalled', Date.now()); $('mInstall').hidden = true; updateInstallBtn(); toast('App installata: la trovi nella schermata Home.'); });
$('btnDoInstall').onclick = async ()=>{
  if (!installEvt) return;
  const e = installEvt; installEvt = null;
  e.prompt();
  try { const r = await e.userChoice; if (r && r.outcome === 'accepted') store.set('efgInstalled', Date.now()); } catch(err){}
  $('mInstall').hidden = true; updateInstallBtn();
};
$('btnInstallLater').onclick = ()=>{ store.set('efgInstallLater', Date.now()); $('mInstall').hidden = true; };
$('btnInstall').onclick = openInstall;
$('btnOpenChrome').href = 'intent://' + location.host + location.pathname + '?installa=1#Intent;scheme=https;package=com.android.chrome;end';
$('mInstall').addEventListener('click', e=>{ if (e.target === $('mInstall') || e.target.closest('[data-close]')) store.set('efgInstallLater', Date.now()); });
function autoInstallDue(){
  if (autoShown || !canInstall()) return false;
  const later = store.get('efgInstallLater', 0);
  return fromQr || !later || Date.now() - later > 2*3600*1000;   // dal QR sempre; altrimenti al massimo ogni 2 ore
}
(function autoInstall(){
  updateInstallBtn();
  if (!autoInstallDue()) return;
  // iPhone: istruzioni subito; Android: aspetta la richiesta del browser, se non arriva mostra le istruzioni
  setTimeout(()=>{ if (autoInstallDue() && (isIOS || (isAndroid && !installEvt))) openInstall(); }, isIOS ? 1200 : 3500);
})();

// link alla classifica sempre verso il sito pubblico (anche dall'anteprima in Claude)
try { const pu = (window.EFG_CONFIG || {}).PUBLIC_URL; if (pu) $('lnkBoard').href = pu.replace(/\/?$/, '/') + 'classifica.html'; } catch(e){}

/* ================= COUNTDOWN DI APERTURA / CHIUSURA =================
   Lo fa partire un amministratore dalla classifica. L'ora è quella del server,
   così tutti i telefoni vedono lo stesso conto alla rovescia. */
function gatePhase(){ return window.EFG_GATE_PHASE(gate, Date.now() + gateOffset); }
function isBlocked(){ const p = gatePhase().phase; return p === 'prima' || p === 'chiuso'; }
async function loadGate(){
  try { const g = await Backend.gate(); if (g){ gate = g; if (g.now) gateOffset = new Date(g.now).getTime() - Date.now(); } } catch(e){}
  renderGate();
}
function renderGate(){
  const ph = gatePhase(), bar = $('gateBar');
  const fmtLong = s => s >= 3600 ? Math.floor(s / 3600) + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') : fmt(s);
  bar.hidden = ph.phase === 'libero' || (ph.phase === 'aperto' && !ph.closing);
  if (ph.phase === 'prima'){ bar.className = 'gatebar wait'; $('gateTxt').textContent = '🔒 I giochi si aprono tra'; $('gateClock').textContent = fmtLong(ph.left); }
  else if (ph.phase === 'aperto' && ph.closing){ bar.className = 'gatebar closing' + (ph.left <= 60 ? ' warn' : ''); $('gateTxt').textContent = '⏳ La gara si chiude tra'; $('gateClock').textContent = fmtLong(ph.left); }
  else if (ph.phase === 'chiuso'){ bar.className = 'gatebar closed'; $('gateTxt').textContent = '🏁 Gara chiusa: la classifica è definitiva'; $('gateClock').textContent = ''; }
  if (ph.phase !== lastPhase){
    const was = lastPhase; lastPhase = ph.phase; renderGrid();
    if (was === 'prima' && ph.phase === 'aperto') toast('I giochi sono aperti: buon divertimento!');
    if (ph.phase === 'chiuso' && was !== null){ if (playing){ closePlayer(); } toast('Tempo scaduto: la gara è chiusa.', 4500); }
  }
}
setInterval(renderGate, 1000);
setInterval(loadGate, 15000);
document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) loadGate(); });
window.addEventListener('storage', e=>{ if (e.key === 'efgDemoGate') loadGate(); });   // demo: countdown avviato dalla classifica nello stesso browser

/* ================= BOOT ================= */
renderGrid(); renderDock(); loadGate();
Backend.current().then(u=>{ session = u; renderDock(); });
})();
