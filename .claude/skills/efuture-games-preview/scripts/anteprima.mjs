// Efuture Games - anteprima dell'app su un telefono simulato (Chromium + Playwright).
// Uso: node anteprima.mjs CARTELLA_DI_USCITA [--desktop]
// Serve i file del repository in locale (come su GitHub Pages, sotto /efuture_games/),
// apre l'app come la vede un giocatore e salva gli screenshot:
//   00-anteprima.png    tutte le schermate del telefono affiancate (da mostrare per prima)
//   01-home.png         la home
//   02-installa.png     il riquadro "Installa l'app", solo se il browser lo propone
//   03-classifica.png   la classifica da proiettare (PC)
//   04..07-<gioco>.png  la schermata iniziale di ogni gioco
// Stampa anche gli errori JavaScript trovati nelle pagine.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PW = ['/opt/node-tools/node_modules/playwright/index.mjs', 'playwright'];
let pw; for (const p of PW) { try { pw = await import(p); break; } catch (e) {} }
if (!pw) { console.error('Playwright non trovato'); process.exit(1); }
const { chromium, devices } = pw;

// repository: EFG_REPO, altrimenti quello che contiene la skill, altrimenti la cartella corrente
const REPO = process.env.EFG_REPO || (() => {
  for (let d = path.dirname(fileURLToPath(import.meta.url)); d !== path.dirname(d); d = path.dirname(d))
    if (fs.existsSync(path.join(d, 'config.js'))) return d;
  return process.cwd();
})();
const OUT = path.resolve(process.argv[2] || 'anteprima');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.mp4':'video/mp4', '.txt':'text/plain' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (!u.pathname.startsWith('/efuture_games/')) { res.writeHead(404); return res.end(); }
  let f = path.join(REPO, decodeURIComponent(u.pathname.slice('/efuture_games/'.length)));
  if (!f.startsWith(REPO)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/efuture_games/`;

const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const { defaultBrowserType, ...phone } = devices['Pixel 7'];
const errors = [];
const shots = [];
async function page(ctxOpts){
  const ctx = await browser.newContext(ctxOpts);
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${p.url()}: ${e.message}`));
  // il database online non serve per l'anteprima: senza rete l'app va in modalità demo
  await p.route(/supabase\.co/, r => r.abort());
  return [ctx, p];
}
async function shot(p, name){ const f = path.join(OUT, name); await p.screenshot({ path: f }); shots.push(f); }

// home + riquadro di installazione
let [ctx, p] = await page(phone);
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
const modal = await p.$('#mInstall:not([hidden])');
if (modal) {
  await shot(p, '02-installa.png');
  await p.evaluate(() => { const m = document.getElementById('mInstall'); if (m) m.hidden = true; });
}
await shot(p, '01-home.png');
await ctx.close();

// classifica (schermo da PC)
[ctx, p] = await page({ viewport: { width: 1366, height: 768 } });
await p.goto(BASE + 'classifica.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
await shot(p, '03-classifica.png');
await ctx.close();

// giochi
const games = ['sysadmin', 'coretech', 'timenet', 'inncloud'];
for (const [i, g] of games.entries()) {
  [ctx, p] = await page(phone);
  await p.goto(BASE + `games/${g}/index.html`, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await shot(p, `0${4 + i}-${g}.png`);
  await ctx.close();
}

// un'unica immagine con home e giochi affiancati
{
  const phoneShots = shots.filter(f => /0[14-7]-/.test(path.basename(f))).sort();
  const imgs = phoneShots.map(f => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('');
  const [c, pg] = await page({ viewport: { width: 1600, height: 700 }, deviceScaleFactor: 1 });
  await pg.setContent(`<style>body{margin:0;background:#041a2c;display:flex;gap:12px;padding:12px;align-items:flex-start}img{height:676px;border-radius:10px}</style>${imgs}`);
  const w = await pg.evaluate(() => document.body.scrollWidth);
  await pg.setViewportSize({ width: w, height: 700 });
  await shot(pg, '00-anteprima.png');
  await c.close();
}

await browser.close(); server.close();
shots.sort();
for (const f of shots) console.log(f);
console.log(errors.length ? 'ERRORI JS:\n - ' + errors.join('\n - ') : 'nessun errore JavaScript');
