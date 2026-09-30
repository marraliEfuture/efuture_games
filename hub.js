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
document.querySelectorAll('.modal').forEach(m=>{
  m.addEventListener('click', e=>{ if ((e.target === m && m.id !== 'mResult') || e.target.closest('[data-close]')){ m.hidden = true; if (m.id === 'mUnlock') stopCam(); } });
});
document.addEventListener('keydown', e=>{ if (e.key === 'Escape'){ ['mUnlock','mAuth','mBoard'].forEach(id=>$(id).hidden = true); stopCam(); } });

/* ================= STATE ================= */
let unlocked = new Set(store.get('efgUnlocked', []));
let bests = store.get('efgBestsTime', {});   // best score (seconds left) per game on this device
let session = null;                          // {id, email, nickname}

/* ================= BACKEND =================
   Supabase when configured in config.js, otherwise a demo that
   keeps everything on this device (SMS codes are shown on screen). */
const CFG = window.EFG_CONFIG || {};
const remote = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const sb = remote ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const userOf = u => u ? { id:u.id, email:u.email, nickname:(u.user_metadata && u.user_metadata.nickname) || (u.email||'').split('@')[0] || 'Giocatore' } : null;

const Backend = remote ? {
  async current(){ const { data } = await sb.auth.getSession(); return userOf(data && data.session && data.session.user); },
  async signUp({ name, password, phone, email }){
    const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ nickname:name, phone } } });
    if (error) throw error;
    if (!data.session) return { needsConfirm:true };
    // attach the mobile number to the account, so it can be used to recover the password
    try { await sb.auth.updateUser({ phone }); } catch(e){}
    return { user:userOf(data.session.user) };
  },
  async signIn(email, password){ const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return { user:userOf(data.user) }; },
  async signOut(){ await sb.auth.signOut(); },
  async sendOtp(phone){ const { error } = await sb.auth.signInWithOtp({ phone, options:{ shouldCreateUser:false } }); if (error) throw error; return {}; },
  async resetWithOtp(phone, token, password){
    const { data, error } = await sb.auth.verifyOtp({ phone, token, type:'sms' }); if (error) throw error;
    const up = await sb.auth.updateUser({ password }); if (up.error) throw up.error;
    return { user:userOf(data.user) };
  },
  async submit(user, game, score){
    const { data } = await sb.from('scores').select('score').eq('user_id', user.id).eq('game', game).maybeSingle();
    if (data && data.score >= score) return false;          // keep only the best result
    const { error } = await sb.from('scores').upsert({ user_id:user.id, game, score, nickname:user.nickname, updated_at:new Date().toISOString() });
    if (error) throw error; return true;
  },
  async board(game){
    let q = sb.from('scores').select('user_id,nickname,game,score');
    if (game !== 'all') q = q.eq('game', game).order('score', { ascending:false }).limit(50);
    const { data, error } = await q; if (error) throw error; return data || [];
  },
} : {
  async current(){ return store.get('efgDemoSession', null); },
  async signUp({ name, password, phone, email }){
    const users = store.get('efgDemoUsers2', {}); const key = email.toLowerCase();
    if (users[key]) throw new Error('already registered');
    users[key] = { id:'local-'+Date.now().toString(36), email:key, nickname:name, phone, pw: await sha256('pw:'+password) };
    store.set('efgDemoUsers2', users);
    const u = { id:users[key].id, email:key, nickname:name }; store.set('efgDemoSession', u); return { user:u };
  },
  async signIn(email, password){
    const u = store.get('efgDemoUsers2', {})[email.toLowerCase()];
    if (!u || u.pw !== await sha256('pw:'+password)) throw new Error('Invalid login');
    const s = { id:u.id, email:u.email, nickname:u.nickname }; store.set('efgDemoSession', s); return { user:s };
  },
  async signOut(){ store.set('efgDemoSession', null); },
  async sendOtp(phone){
    const u = Object.values(store.get('efgDemoUsers2', {})).find(x=>x.phone === phone);
    if (!u) throw new Error('Nessun account con questo cellulare.');
    const code = String(Math.floor(100000 + Math.random()*900000));
    store.set('efgDemoOtp', { phone, code, exp:Date.now() + 5*60*1000 });
    return { demoCode:code };
  },
  async resetWithOtp(phone, token, password){
    const o = store.get('efgDemoOtp', null);
    if (!o || o.phone !== phone || o.code !== token || Date.now() > o.exp) throw new Error('Token has expired or is invalid');
    const users = store.get('efgDemoUsers2', {}); const u = Object.values(users).find(x=>x.phone === phone);
    u.pw = await sha256('pw:'+password); store.set('efgDemoUsers2', users); store.set('efgDemoOtp', null);
    const s = { id:u.id, email:u.email, nickname:u.nickname }; store.set('efgDemoSession', s); return { user:s };
  },
  async submit(user, game, score){
    const rows = store.get('efgDemoScores2', {}); const k = user.id + '|' + game;
    if (rows[k] && rows[k].score >= score) return false;
    rows[k] = { user_id:user.id, nickname:user.nickname, game, score }; store.set('efgDemoScores2', rows); return true;
  },
  async board(game){
    const rows = Object.values(store.get('efgDemoScores2', {}));
    return game === 'all' ? rows : rows.filter(r=>r.game===game).sort((a,b)=>b.score-a.score).slice(0,50);
  },
};
function friendly(err){
  const m = String(err && err.message || err);
  if (/fetch|network/i.test(m)) return 'Nessuna connessione con il server: controlla la rete e riprova.';
  if (/Invalid login/i.test(m)) return 'Email o password non corretti.';
  if (/already registered|already been registered/i.test(m)) return 'Esiste già un account con questa email: usa Accedi.';
  if (/expired|invalid/i.test(m) && /token|otp/i.test(m)) return 'Codice SMS non valido o scaduto. Richiedine uno nuovo.';
  if (/Signups not allowed for otp|not found|No user/i.test(m)) return 'Nessun account con questo cellulare.';
  if (/sms|phone provider|Unsupported phone/i.test(m)) return 'Invio SMS non disponibile al momento. Contatta lo stand Efuture.';
  if (/Password should|at least 6/i.test(m)) return 'La password deve avere almeno 6 caratteri.';
  return m;
}

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
    if (bests[g.id] !== undefined){ best.innerHTML = 'Record: <b></b> pt'; best.querySelector('b').textContent = bests[g.id]; }
    b.append(img, name, st, best);
    b.addEventListener('click', ()=> open ? play(g) : askUnlock(g));
    grid.appendChild(b);
  }
}
function renderDock(){
  $('dockOut').hidden = !!session; $('dockIn').hidden = !session; $('who').hidden = !session;
  if (session){ $('who').textContent = 'Ciao, '; const b = document.createElement('b'); b.textContent = session.nickname; $('who').append(b); }
  $('modeNote').hidden = remote;
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
  if (d.ev === 'result') showResult(playing, !!d.ok, d.reason, Number(d.seconds)||0, d.level);
});

async function showResult(g, ok, reason, seconds, level){
  const score = ok ? Math.max(0, Math.round(TOTAL - seconds)) : 0;
  $('rsIcon').src = g.icon; $('rsGame').textContent = g.name;
  $('rsTitle').textContent = ok ? 'Tre livelli completati!' : (reason === 'time' ? 'Tempo scaduto' : 'Vite finite');
  $('rsScore').textContent = score;
  $('rsLine').textContent = ok ? 'punti · secondi rimasti sui 3 minuti' : 'punti · al livello ' + level + ' di ' + LEVELS;
  $('rsTime').textContent = ok ? fmt(seconds) : '—';
  const prev = bests[g.id];
  const isBest = ok && (prev === undefined || score > prev);
  if (isBest){ bests[g.id] = score; store.set('efgBestsTime', bests); }
  else if (prev === undefined){ bests[g.id] = 0; store.set('efgBestsTime', bests); }
  $('rsBest').textContent = bests[g.id];
  const msg = $('rsMsg');
  if (!ok) setMsg(msg, 'Completa i 3 livelli entro un minuto ciascuno per fare punti. Il record precedente resta valido.');
  else if (!isBest) setMsg(msg, 'Il tuo record resta ' + prev + ': in classifica conta solo il risultato migliore.');
  else if (!session) setMsg(msg, 'Nuovo record! Registrati o accedi per entrare in classifica.', 'ok');
  else {
    setMsg(msg, 'Nuovo record! Salvo in classifica…', 'ok');
    try { await Backend.submit(session, g.id, score); setMsg(msg, 'Nuovo record salvato in classifica!', 'ok'); }
    catch(err){ setMsg(msg, 'Non riesco a salvare in classifica: ' + friendly(err), 'err'); }
  }
  $('mResult').hidden = false;
}

/* ================= AUTH ================= */
function showAuth(view){
  $('fSignup').hidden = view !== 'signup'; $('fLogin').hidden = view !== 'login'; $('fRecover').hidden = view !== 'recover';
  $('aTabs').hidden = view === 'recover';
  $('tabSignup').classList.toggle('on', view === 'signup'); $('tabLogin').classList.toggle('on', view === 'login');
  $('aTitle').textContent = view === 'signup' ? 'Registrati' : view === 'login' ? 'Accedi' : 'Recupera password';
  ['sMsg','lMsg','rMsg'].forEach(id=>setMsg($(id), ''));
  if (view === 'recover'){ $('otpStep').hidden = true; $('rOtp').value = ''; $('rPass').value = ''; }
}
$('tabSignup').onclick = ()=>showAuth('signup');
$('tabLogin').onclick = ()=>showAuth('login');
$('btnForgot').onclick = ()=>showAuth('recover');
$('btnBackLogin').onclick = ()=>showAuth('login');
$('btnAuth').onclick = ()=>{ showAuth('signup'); openModal('mAuth'); };

async function loggedIn(user){
  session = user; $('mAuth').hidden = true; renderDock(); toast('Benvenuto, ' + session.nickname + '!');
  for (const g of GAMES){ if (bests[g.id] > 0){ try { await Backend.submit(session, g.id, bests[g.id]); } catch(e){} } }   // records made before logging in
}
$('fSignup').addEventListener('submit', async e=>{
  e.preventDefault();
  const name = $('sName').value.trim(), password = $('sPass').value, phone = normPhone($('sPhone').value), email = $('sEmail').value.trim();
  const m = $('sMsg');
  if (name.length < 2 || name.length > 20) return setMsg(m, 'Il nome deve avere da 2 a 20 caratteri.', 'err');
  if (password.length < 6) return setMsg(m, 'La password deve avere almeno 6 caratteri.', 'err');
  if (!validPhone(phone)) return setMsg(m, 'Scrivi un numero di cellulare valido, ad esempio +39 333 1234567.', 'err');
  setMsg(m, 'Un attimo…');
  try {
    const r = await Backend.signUp({ name, password, phone, email });
    if (r.needsConfirm){ setMsg(m, 'Ti abbiamo mandato una email: conferma l\'indirizzo e poi accedi.', 'ok'); return; }
    loggedIn(r.user);
  } catch(err){ setMsg(m, friendly(err), 'err'); }
});
$('fLogin').addEventListener('submit', async e=>{
  e.preventDefault(); const m = $('lMsg'); setMsg(m, 'Un attimo…');
  try { const r = await Backend.signIn($('lEmail').value.trim(), $('lPass').value); loggedIn(r.user); }
  catch(err){ setMsg(m, friendly(err), 'err'); }
});
$('btnSendOtp').onclick = async ()=>{
  const phone = normPhone($('rPhone').value), m = $('rMsg');
  if (!validPhone(phone)) return setMsg(m, 'Scrivi il cellulare usato in registrazione, ad esempio +39 333 1234567.', 'err');
  setMsg(m, 'Invio il codice…');
  try {
    const r = await Backend.sendOtp(phone);
    $('otpStep').hidden = false; $('btnSendOtp').textContent = 'Invia di nuovo';
    setMsg(m, r.demoCode ? 'Modalità demo: il codice SMS è ' + r.demoCode : 'Codice inviato via SMS a ' + phone + '.', 'ok');
  } catch(err){ setMsg(m, friendly(err), 'err'); }
};
$('fRecover').addEventListener('submit', async e=>{
  e.preventDefault();
  const phone = normPhone($('rPhone').value), token = $('rOtp').value.replace(/\D/g,''), password = $('rPass').value, m = $('rMsg');
  if (token.length !== 6) return setMsg(m, 'Il codice SMS ha 6 cifre.', 'err');
  if (password.length < 6) return setMsg(m, 'La nuova password deve avere almeno 6 caratteri.', 'err');
  setMsg(m, 'Un attimo…');
  try { const r = await Backend.resetWithOtp(phone, token, password); toast('Password aggiornata.'); loggedIn(r.user); }
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
  if (boardTab === 'all'){
    const tot = {};
    for (const r of rows){ const t = tot[r.user_id] = tot[r.user_id] || { user_id:r.user_id, nickname:r.nickname, score:0 }; t.score += r.score; t.nickname = r.nickname; }
    rows = Object.values(tot).sort((a,b)=>b.score-a.score).slice(0,50);
  }
  if (!rows.length) return boardMessage('Ancora nessun punteggio. Gioca e sii il primo!');
  const list = $('bList'); list.innerHTML = '';
  rows.forEach((r, i)=>{
    const li = document.createElement('li'); if (session && r.user_id === session.id) li.className = 'me';
    const a = document.createElement('span'); a.className = 'r'; a.textContent = i+1;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = r.nickname;
    const s = document.createElement('span'); s.className = 's'; s.textContent = r.score + ' pt';
    li.append(a, n, s); list.appendChild(li);
  });
}
$('btnBoard').onclick = ()=>{
  $('bNote').textContent = (boardTab === 'all' ? 'Totale = somma dei record nei 4 giochi (massimo 720). ' : '') + (remote ? '' : 'Modalità demo: solo i giocatori di questo telefono.');
  renderBoardTabs(); openModal('mBoard'); loadBoard();
};

/* ================= BOOT ================= */
renderGrid(); renderDock();
Backend.current().then(u=>{ session = u; renderDock(); });
if (remote) sb.auth.onAuthStateChange((_e, s)=>{ if (!s){ session = null; renderDock(); } });
})();
