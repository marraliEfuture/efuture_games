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

const Backend = remote ? {
  remote:true,
  async current(){ return store.get('efgSessionLive', null); },
  async signUp({ name, phone, email }){
    const r = one(await rpc('efg_register', { p_email:normEmail(email), p_name:name, p_phone:phone }));
    const u = { id:r.pid, email:normEmail(email), nickname:r.name };
    store.set('efgSessionLive', u); return { user:u };
  },
  async signIn(email){
    const r = one(await rpc('efg_login', { p_email:normEmail(email) }));
    if (!r) throw new Error('not found');
    const u = { id:r.pid, email:normEmail(email), nickname:r.name };
    store.set('efgSessionLive', u); return { user:u };
  },
  async signOut(){ store.set('efgSessionLive', null); },
  async submit(user, game, score, levels){ return !!(await rpc('efg_submit', { p_email:user.email, p_game:game, p_score:score, p_levels:levels })); },
  // game: 'all' (somma dei 4 giochi) oppure l'id del gioco → [{pid, name, levels, score, games}] ordinati
  async board(game, group){
    if (group && group !== 'tutti'){
      try { return (await rpc('efg_board_group', { p_game:game, p_group:group })) || []; }
      catch(e){ if (!/efg_board_group|PGRST202|does not exist/i.test(String(e && (e.code + ' ' + e.message)))) throw e; }
      // funzione non ancora creata su Supabase: classifica completa
    }
    return (await rpc('efg_board', { p_game:game })) || [];
  },
} : {
  remote:false,
  async current(){ return store.get('efgSession3', null); },
  async signUp({ name, phone, email }){
    const users = store.get('efgDemoUsers3', {}); const key = normEmail(email);
    if (users[key]) throw new Error('already registered');
    users[key] = { pid:'local-'+Date.now().toString(36), email:key, name, phone };
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
    const isEf = e => /@efuture\.it$/i.test(e || '');
    const users = store.get('efgDemoUsers3', {});
    const tot = {};
    for (const r of Object.values(store.get('efgDemoScores4', {}))){
      if (game !== 'all' && r.game !== game) continue;
      if (group === 'efuture' && !isEf(r.email)) continue;
      if (group === 'ospiti' && isEf(r.email)) continue;
      const u = users[r.email]; if (!u) continue;
      const t = tot[r.email] = tot[r.email] || { pid:u.pid, name:u.name, levels:0, score:0, games:0 };
      t.score += r.score; t.levels += r.levels || 0; if ((r.levels||0) > 0) t.games++;
    }
    return Object.values(tot).sort((a,b)=>b.levels-a.levels || b.score-a.score).slice(0,50);
  },
};

function friendly(err){
  const m = String(err && err.message || err);
  if (/fetch|network/i.test(m)) return 'Nessuna connessione con il server: controlla la rete e riprova.';
  if (/not found/i.test(m)) return 'Nessun giocatore registrato con questa email: usa Registrati.';
  if (/already registered|duplicate/i.test(m)) return 'Questa email è già registrata: usa Accedi.';
  if (/invalid email/i.test(m)) return 'Email non valida.';
  if (/invalid name/i.test(m)) return 'Il nome deve avere da 2 a 20 caratteri.';
  return m;
}

window.EFG_BACKEND = Backend;
window.EFG_FRIENDLY = friendly;
})();
