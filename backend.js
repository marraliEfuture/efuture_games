/* ============================================================
   EFUTURE GAMES — accesso ai dati (usato dall'app e da classifica.html)
   Supabase quando config.js è compilato, altrimenti modalità demo
   (tutto resta nel browser di questo dispositivo).
   Nessuna password: il giocatore è identificato dalla sua email.
   ============================================================ */
(function(){
"use strict";
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v===null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const CFG = window.EFG_CONFIG || {};
const remote = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const sb = remote ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth:{ persistSession:false } }) : null;
const normEmail = e => String(e||'').trim().toLowerCase();

async function rpc(fn, args){
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}
const one = d => Array.isArray(d) ? d[0] : d;
const missing = e => /PGRST202|does not exist|Could not find the function/i.test(String(e && (e.code + ' ' + e.message)));

const Backend = remote ? {
  remote:true,
  async current(){ return store.get('efgSessionLive', null); },
  // nickname o email già usati? null se il database non ha ancora la funzione
  // nome (con l'azienda) o email già usati? null se il database non ha ancora la funzione
  async checkSignup({ name, email, azienda }){
    const a = { p_email:normEmail(email), p_name:String(name||'').trim() };
    try { return one(await rpc('efg_signup_check', Object.assign({ p_azienda:String(azienda||'').trim() }, a))); }
    catch(e){ if (!missing(e)) throw e; }
    try { return one(await rpc('efg_signup_check', a)); }   // database senza supabase-campi-registrazione.sql
    catch(e){ if (missing(e)) return null; throw e; }
  },
  // azienda e cellulare (supabase-campi-registrazione.sql); con il database vecchio si registra senza
  async signUp({ name, email, azienda, phone }){
    let r;
    try { r = one(await rpc('efg_register', { p_email:normEmail(email), p_name:name, p_azienda:String(azienda||'').trim(), p_phone:String(phone||'').trim() || null })); }
    catch(e){ if (!missing(e)) throw e; r = one(await rpc('efg_register', { p_email:normEmail(email), p_name:name })); }
    const u = { id:r.pid, email:r.email || normEmail(email), nickname:r.name };   // senza email: il server dà un identificativo interno
    store.set('efgSessionLive', u); return { user:u };
  },
  async signIn(email){
    const r = one(await rpc('efg_login', { p_email:normEmail(email) }));
    if (!r) throw new Error('not found');
    const u = { id:r.pid, email:normEmail(email), nickname:r.name };
    store.set('efgSessionLive', u); return { user:u };
  },
  async signOut(){ store.set('efgSessionLive', null); },
  // nome, azienda e se manca l'azienda obbligatoria (null se il database non ha ancora la funzione)
  async profile(user){
    try { return one(await rpc('efg_profilo', { p_email:user.email })); }
    catch(e){ if (missing(e)) return null; throw e; }
  },
  async setCompany(user, azienda){ return one(await rpc('efg_set_azienda', { p_email:user.email, p_azienda:String(azienda||'').trim() })); },
  async submit(user, game, score, levels){ return !!(await rpc('efg_submit', { p_email:user.email, p_game:game, p_score:score, p_levels:levels })); },
  // game: 'all' (somma dei 4 giochi) oppure l'id del gioco → [{pid, name, levels, score, games, bonus}] ordinati
  // nella generale "bonus" sono i punti del Bonus Recensione già compresi in score
  async board(game, group){
    const rows = await this.boardRows(game, group);
    if (game === 'all' && rows.length){
      try { const b = new Map(((await rpc('efg_recensione_bonus', {})) || []).map(x => [x.pid, x.punti])); rows.forEach(r => { if (b.has(r.pid)) r.bonus = b.get(r.pid); }); }
      catch(e){}   // funzione non ancora creata su Supabase: niente etichetta, i punti restano giusti
    }
    return rows;
  },
  async boardRows(game, group){
    if (group && group !== 'tutti'){
      try { return (await rpc('efg_board_group', { p_game:game, p_group:group })) || []; }
      catch(e){ if (!/efg_board_group|PGRST202|does not exist/i.test(String(e && (e.code + ' ' + e.message)))) throw e; }
      // funzione non ancora creata su Supabase: classifica completa, segnalata come NON filtrata
      const all = (await rpc('efg_board', { p_game:game })) || [];
      all.filtroMancante = true; return all;
    }
    return (await rpc('efg_board', { p_game:game })) || [];
  },
  // impostazioni scelte in admin: { vista_default, recensione_punti, recensione_link } (null se mancano)
  async settings(){
    try { return one(await rpc('efg_impostazioni', {})); }
    catch(e){ if (/efg_impostazioni|PGRST202|does not exist/i.test(String(e && (e.code + ' ' + e.message)))) return null; throw e; }
  },
  // numero dell'ultimo reset fatto dall'admin (null se nessuno o se il database non ha ancora la funzione)
  async resetId(){
    try { return one(await rpc('efg_reset_id', {})) || null; }
    catch(e){ if (/efg_reset_id|PGRST202|does not exist/i.test(String(e && (e.code + ' ' + e.message)))) return null; throw e; }
  },
  // Bonus Recensione: { link, clic, ok, punti } (null se il database non ha ancora le funzioni)
  async review(user){
    try { return one(await rpc('efg_recensione_info', { p_email:user ? user.email : '' })); }
    catch(e){ if (/efg_recensione_info|PGRST202|does not exist/i.test(String(e && (e.code + ' ' + e.message)))) return null; throw e; }
  },
  async reviewClick(user){ return one(await rpc('efg_recensione_click', { p_email:user.email })); },
  // countdown di apertura/chiusura: { mode:'apertura'|'chiusura'|null, ends_at, minutes, now }
  async gate(){
    try { return one(await rpc('efg_gate_state', {})) || { mode:null }; }
    catch(e){ if (/efg_gate_state|PGRST202|does not exist/i.test(String(e && (e.code + ' ' + e.message)))) return { mode:null }; throw e; }
  },
} : {
  remote:false,
  async current(){ return store.get('efgSession3', null); },
  async checkSignup({ name, email, azienda }){
    const users = store.get('efgDemoUsers3', {}), n = String(name||'').trim().toLowerCase(), a = String(azienda||'').trim().toLowerCase();
    return { nome_usato: !!n && Object.values(users).some(u => String(u.name).trim().toLowerCase() === n && String(u.azienda||'').trim().toLowerCase() === a), email_usata: !!users[normEmail(email)] };
  },
  async signUp({ name, email, azienda }){
    const users = store.get('efgDemoUsers3', {}); const key = normEmail(email) || ('demo' + Date.now().toString(36) + '@senza-email.invalid');
    if (users[key]) throw new Error('already registered');
    if ((await this.checkSignup({ name, email:'', azienda })).nome_usato) throw new Error('name taken');
    users[key] = { pid:'local-'+Date.now().toString(36), email:key, name, azienda:String(azienda||'').trim() };
    store.set('efgDemoUsers3', users);
    const u = { id:users[key].pid, email:key, nickname:name }; store.set('efgSession3', u); return { user:u };
  },
  async signIn(email){
    const x = store.get('efgDemoUsers3', {})[normEmail(email)];
    if (!x) throw new Error('not found');
    const u = { id:x.pid, email:x.email, nickname:x.name }; store.set('efgSession3', u); return { user:u };
  },
  async signOut(){ store.set('efgSession3', null); },
  async submit(user, game, score, levels){
    const rows = store.get('efgDemoScores4', {}); const k = user.email + '|' + game; const o = rows[k];
    if (o && (o.levels > levels || (o.levels === levels && o.score >= score))) return false;
    rows[k] = { email:user.email, game, score, levels }; store.set('efgDemoScores4', rows); return true;
  },
  async board(game, group){
    const isEf = e => /@([a-z0-9-]+\.)*efuture\.it$/i.test(String(e || '').trim());
    const users = store.get('efgDemoUsers3', {});
    const tot = {};
    for (const r of Object.values(store.get('efgDemoScores4', {}))){
      if (game !== 'all' && r.game !== game) continue;
      if (group === 'efuture' && !isEf(r.email)) continue;
      if (group === 'ospiti' && isEf(r.email)) continue;
      const u = users[r.email]; if (!u) continue;
      const t = tot[r.email] = tot[r.email] || { pid:u.pid, name:(u.azienda ? u.azienda + ' - ' : '') + u.name, azienda:u.azienda || null, nome:u.name, levels:0, score:0, games:0 };
      t.score += r.score; t.levels += r.levels || 0; if ((r.levels||0) > 0) t.games++;
    }
    return Object.values(tot).sort((a,b)=>b.levels-a.levels || b.score-a.score).slice(0,50);
  },
};

// demo: il clic sul Bonus Recensione resta su questo dispositivo (nessun admin che lo conferma)
if (!Backend.remote){
  Backend.settings = async () => null;
  Backend.resetId = async () => null;
  Backend.profile = async () => null;
  Backend.review = async user => ({ link:null, clic:!!(user && store.get('efgDemoReview', {})[user.email]), ok:false, punti:200 });
  Backend.reviewClick = async user => { const r = store.get('efgDemoReview', {}); r[user.email] = r[user.email] || new Date().toISOString(); store.set('efgDemoReview', r); return Backend.review(user); };
}
// pagina delle recensioni Google di efuture: il link scelto in admin, altrimenti la ricerca su Google Maps
window.EFG_REVIEW_URL = link => link || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('efuture recensioni');

// demo: countdown salvato su questo dispositivo (app e classifica aperte nello stesso browser lo condividono)
if (!Backend.remote){
  Backend.gate = async () => Object.assign({ mode:null }, store.get('efgDemoGate', {}), { now:new Date().toISOString() });
  Backend.gateSet = async (mode, minutes) => {
    if (!mode || mode === 'stop') store.set('efgDemoGate', { mode:null });
    else store.set('efgDemoGate', { mode, minutes, ends_at:new Date(Date.now() + minutes * 60000).toISOString() });
    return Backend.gate();
  };
}
// stato della gara in un istante: 'libero' | 'prima' (giochi chiusi fino all'apertura) | 'aperto' | 'chiuso'
window.EFG_GATE_PHASE = (g, nowMs) => {
  if (!g || !g.mode || !g.ends_at) return { phase:'libero', left:0 };
  const left = Math.max(0, Math.round((new Date(g.ends_at).getTime() - nowMs) / 1000));
  if (g.mode === 'apertura') return left > 0 ? { phase:'prima', left } : { phase:'aperto', left:0, justOpened:true };
  return left > 0 ? { phase:'aperto', left, closing:true } : { phase:'chiuso', left:0 };
};

function friendly(err){
  const m = String(err && err.message || err);
  if (/gara chiusa/i.test(m)) return 'La gara è chiusa: i punteggi non vengono più registrati.';
  if (/account disabilitato/i.test(m)) return 'Il tuo account è stato disabilitato: chiedi agli organizzatori.';
  if (/fetch|network/i.test(m)) return 'Nessuna connessione con il server: controlla la rete e riprova.';
  if (/not found/i.test(m)) return 'Nessun giocatore registrato con questa email: usa Registrati.';
  if (/name taken|efg_players_name_unique/i.test(m)) return 'Nickname già utilizzato: scegline un altro.';
  if (/already registered|duplicate/i.test(m)) return 'Indirizzo email già utilizzato: usa Accedi oppure un\'altra email.';
  if (/invalid email/i.test(m)) return 'Email non valida.';
  if (/invalid name/i.test(m)) return 'Il nome deve avere da 2 a 20 caratteri.';
  return m;
}

window.EFG_BACKEND = Backend;
window.EFG_FRIENDLY = friendly;
})();
