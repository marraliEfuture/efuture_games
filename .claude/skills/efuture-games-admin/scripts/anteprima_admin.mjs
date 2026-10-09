// Efuture Games - anteprima del pannello admin con un database finto.
// Apre admin.html in Chromium, entra con una chiave qualsiasi e salva una schermata
// per ogni sezione del menu (PC), il menu aperto, il popup Modifica e la sezione Utenti su telefono.
// Uso: node anteprima_admin.mjs <cartella di uscita> [sezione ...]
// Sezioni: players log backup reset key links videos tutorials skills qr
// Il repository è EFG_REPO, altrimenti quello che contiene la skill, altrimenti la cartella corrente.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PW = ['/opt/node-tools/node_modules/playwright/index.mjs', 'playwright'];
let pw; for (const p of PW) { try { pw = await import(p); break; } catch (e) {} }
if (!pw) { console.error('Playwright non trovato'); process.exit(1); }
const { chromium } = pw;

const REPO = process.env.EFG_REPO || (() => {
  for (let d = path.dirname(fileURLToPath(import.meta.url)); d !== path.dirname(d); d = path.dirname(d))
    if (fs.existsSync(path.join(d, 'config.js'))) return d;
  return process.cwd();
})();
const OUT = path.resolve(process.argv[2] || 'anteprima-admin');
const ALL = ['players', 'log', 'backup', 'reset', 'key', 'links', 'videos', 'tutorials', 'skills', 'qr'];
const WANT = process.argv.slice(3).length ? process.argv.slice(3) : ALL;
fs.mkdirSync(OUT, { recursive: true });

// database finto: risponde alle chiamate efg_admin_* con dati di prova (nessun dato vero)
const FAKE = `window.__calls = [];
const now = Date.now(), iso = m => new Date(now - m*60000).toISOString();
const players = [
  {name:'Anna', email:'anna@esempio.it', created_at:iso(300), tipo:'giocatore', giochi:3, livelli:7, punti:820, dettaglio:{sysadmin:{livelli:3,punti:400}, coretech:{livelli:2,punti:300}, timenet:{livelli:2,punti:120}}},
  {name:'Bruno', email:'bruno@esempio.it', created_at:iso(200), tipo:'giocatore', disabilitato:true, giochi:1, livelli:2, punti:150, dettaglio:{inncloud:{livelli:2,punti:150}}},
  {name:'Marta', email:'marta@efuture.it', created_at:iso(100), tipo:'admin_giocatore', giochi:2, livelli:4, punti:410, dettaglio:{coretech:{livelli:3,punti:310}, timenet:{livelli:1,punti:100}}},
  {name:'Luca', email:'luca@efuture.it', created_at:iso(50), tipo:'admin', giochi:0, livelli:0, punti:0, dettaglio:null}];
const logs = [
  {id:3, at:iso(5), kind:'partita', email:'anna@esempio.it', game:'coretech', detail:{livelli:2, punti:300, record:true}},
  {id:2, at:iso(20), kind:'accesso', email:'bruno@esempio.it', detail:{esito:'ok'}},
  {id:1, at:iso(60), kind:'registrazione', email:'marta@efuture.it', detail:{nome:'Marta'}}];
const backups = [{id:1, creato:iso(120), nota:'prima della gara', giocatori:3, punteggi:6}];
window.supabase = { createClient: () => ({ rpc: async (fn, a) => {
  window.__calls.push(fn);
  switch (fn){
    case 'efg_admin_login': return {data:{giocatori:players.length, punteggi:6, eventi:logs.length, backup:backups.length, ultimo_backup:backups[0].creato}};
    case 'efg_admin_players': return {data:players};
    case 'efg_admin_set_tipo': { const p = players.find(x => x.email === a.p_email); if (p) p.tipo = a.p_tipo; return {data:{ok:true, nome:p && p.name, tipo:a.p_tipo}}; }
    case 'efg_admin_set_disabilitato': { const p = players.find(x => x.email === a.p_email); if (p) p.disabilitato = !!a.p_on; return {data:{ok:true, nome:p && p.name}}; }
    case 'efg_admin_delete_player': { const i = players.findIndex(x => x.email === a.p_email); const n = i >= 0 ? players[i].name : ''; if (i >= 0) players.splice(i, 1); return {data:{ok:true, nome:n, punteggi:0}}; }
    case 'efg_admin_logs': return {data:logs};
    case 'efg_admin_backups': return {data:backups};
    default: return {data:null};
  }
}})};`;

const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const errs = [];
async function open(vp){
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.route('**/vendor/supabase.js*', rt => rt.fulfill({ contentType: 'text/javascript', body: FAKE }));
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(REPO, 'admin.html'));
  await pg.waitForTimeout(400);
  await pg.fill('#key', 'anteprima');
  await pg.click('#fLogin button[type=submit]');
  await pg.waitForTimeout(800);
  return { ctx, pg };
}

// apre il menu a comparsa (se c'è il pulsante Menu) e sceglie una sezione
async function goTo(pg, s){
  const btn = await pg.$('#menuBtn');
  if (btn && await btn.isVisible()){ await btn.click(); await pg.waitForTimeout(300); }
  const tab = await pg.$('.side .tab[data-tab="' + s + '"]');
  if (!tab) return false;
  await tab.click(); await pg.waitForTimeout(500);
  return true;
}
// PC: menu aperto, una schermata per sezione, popup Modifica
{
  const { ctx, pg } = await open({ width: 1366, height: 820 });
  const mb = await pg.$('#menuBtn');
  if (mb && await mb.isVisible()){
    await mb.click(); await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(OUT, '00-menu.png') }); console.log(path.join(OUT, '00-menu.png'));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  }
  const ed = await pg.$('#pTable .btn.edit');
  if (ed){
    await ed.click(); await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(OUT, '00-modifica.png') }); console.log(path.join(OUT, '00-modifica.png'));
    const c = await pg.$('#peClose'); if (c) await c.click(); await pg.waitForTimeout(200);
  }
  for (const [i, s] of WANT.entries()){
    if (!await goTo(pg, s)){ console.log('sezione non trovata nel menu:', s); continue; }
    const f = path.join(OUT, String(i + 1).padStart(2, '0') + '-' + s + '.png');
    await pg.screenshot({ path: f, fullPage: true });
    console.log(f);
  }
  await ctx.close();
}
// telefono: sezione Utenti
{
  const { ctx, pg } = await open({ width: 412, height: 860 });
  const f = path.join(OUT, '00-telefono.png');
  await pg.screenshot({ path: f, fullPage: true });
  console.log(f);
  await ctx.close();
}
await browser.close();
console.log(errs.length ? 'errori JavaScript:\n- ' + errs.join('\n- ') : 'nessun errore JavaScript');
