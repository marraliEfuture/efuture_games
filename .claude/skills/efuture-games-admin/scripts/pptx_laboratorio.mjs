// Efuture Games - i PowerPoint delle 5 sessioni del Laboratorio (Admin › Formazione › Laboratorio).
// Uso:  NODE_PATH=<cartella>/node_modules node pptx_laboratorio.mjs [CARTELLA_DI_USCITA]
//   (pptxgenjs: npm install --prefix <cartella> pptxgenjs ; Playwright come per l'anteprima)
// Senza cartella scrive in <repo>/presentazioni/. Crea:
//   1-laboratorio-ai.pptx          le 20 slide di laboratorio.html come immagini (+ i 2 video)
//   2-forza4-claude.pptx           il tutorial Forza 4 (testi modificabili) + video
//   3-foglio-attivita.pptx         il tutorial del foglio "Attività giornaliere" + video
//   4-efuture-games.pptx           i 4 giochi degli stand, regole e QR dell'app
//   5-classifica-premiazione.pptx  regole della classifica, fasi Live / Finale e podio da compilare
// Testi dei tutorial: tutorial/tutorials.js. Le immagini dei giochi sono fatte al momento.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pptxgen; try { pptxgen = require('pptxgenjs'); } catch (e) { console.error('pptxgenjs non trovato: npm install --prefix <cartella> pptxgenjs e poi NODE_PATH=<cartella>/node_modules'); process.exit(1); }
const JSZip = require(require.resolve('jszip', { paths: [require.resolve('pptxgenjs')] }));
const PW = ['/opt/node-tools/node_modules/playwright/index.mjs', 'playwright'];
let pw; for (const p of PW) { try { pw = await import(p); break; } catch (e) {} }
if (!pw) { console.error('Playwright non trovato'); process.exit(1); }

const REPO = process.env.EFG_REPO || (() => {
  for (let d = path.dirname(fileURLToPath(import.meta.url)); d !== path.dirname(d); d = path.dirname(d))
    if (fs.existsSync(path.join(d, 'config.js'))) return d;
  return process.cwd();
})();
const OUT = path.resolve(process.argv[2] || path.join(REPO, 'presentazioni'));
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(OUT, '.tmp-'));
const R = f => path.join(REPO, f);

/* ---------- server locale e screenshot ---------- */
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.mp4':'video/mp4' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let f = path.join(REPO, decodeURIComponent(u.pathname));
  if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await pw.chromium.launch();

// laboratorio.html: una immagine per slide (1920×1080, senza comandi)
const lab = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await lab.goto(BASE + 'laboratorio.html?rec=1#1'); await lab.waitForTimeout(1200);
const LAB = await lab.evaluate(() => [...document.querySelectorAll('#stage section.slide')].map(s => ({
  label: s.getAttribute('aria-label'), video: s.querySelector('video') ? s.querySelector('video').getAttribute('src') : null,
  poster: s.querySelector('video') ? s.querySelector('video').getAttribute('poster') : null, text: s.innerText.replace(/\s+\n/g, '\n').trim() })));
for (let i = 0; i < LAB.length; i++){
  await lab.evaluate(n => { location.hash = '#' + n; }, i + 1); await lab.waitForTimeout(700);
  LAB[i].png = path.join(TMP, 'lab-' + (i + 1) + '.jpg'); await lab.screenshot({ path: LAB[i].png, type: 'jpeg', quality: 85 });
}
// i 4 giochi: un momento di gioco (modalità libera, subito dopo Inizia)
const GAMES = [
  { id:'sysadmin', name:'Efuture Bros', stand:'Efuture', ico:'img/g-sysadmin.png', genre:'Platform a scorrimento',
    text:'Sei il sistemista di guardia: attraversa le stanze dei clienti, salta sui bug o lancia il mouse, evita trappole e burroni e risolvi il ticket.',
    how:'Frecce per correre · tasto per saltare e lanciare' },
  { id:'coretech', name:'CoreTech Pac', stand:'CoreTech', ico:'img/g-coretech.png', genre:'Labirinto',
    text:'Guidi la C di CoreTech: mangia tutte le monetine e scappa dai bug. Con il floppy della patch, per qualche secondo sei tu a mangiare i bug.',
    how:'Joystick per muoversi nel labirinto' },
  { id:'timenet', name:'Timenet Breakout', stand:'Timenet', ico:'img/g-timenet.png', genre:'Rompi-mattoncini',
    text:'Il delfino di Timenet fa rimbalzare il pallone contro il muro di mattoncini. Ogni livello è un’ora della giornata lavorativa.',
    how:'Trascina il dito per muovere il delfino' },
  { id:'inncloud', name:'inncloud Invaders', stand:'inncloud', ico:'img/g-inncloud.png', genre:'Sparatutto spaziale',
    text:'La nuvola di inncloud spara da sola contro bug, virus e hacker. Ogni fila eliminata carica un colpo LASER. Ripàrati dietro i firewall.',
    how:'Trascina per muoverti · LASER quando è verde' },
];
const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
for (const g of GAMES){
  await ph.goto(BASE + 'games/' + g.id + '/index.html'); await ph.waitForTimeout(900);
  await ph.click('#btnStart').catch(() => {}); await ph.waitForTimeout(600);
  if (g.id === 'sysadmin') await ph.getByText('Risolvi!').click().catch(() => {});   // chiude la scheda del ticket
  else { const r = await (await ph.$('canvas')).boundingBox(); await ph.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); }   // salta l'intro
  await ph.waitForTimeout(2800);
  const box = await ph.evaluate(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  g.png = path.join(TMP, 'g-' + g.id + '.png'); g.ratio = box.width / box.height;
  await ph.screenshot({ path: g.png, clip: box });
}
await browser.close(); server.close();

/* ---------- stile comune ---------- */
const THEME = { name:'Efuture', headFontFace:'Calibri', bodyFontFace:'Calibri', colors: {
  dk1:'0D2B45', lt1:'FFFFFF', dk2:'002238', lt2:'EEF4FA', accent1:'F18C22', accent2:'8AD0FF', accent3:'0B3A5C', accent4:'4A9FD8', accent5:'FFD2A1', accent6:'2FA36B', hlink:'0B6FB8', folHlink:'6A4C93' } };
const W = 13.333, H = 7.5;
function newDeck(title){
  const p = new pptxgen(); p.layout = 'LAYOUT_WIDE'; p.author = 'Efuture'; p.company = 'Efuture'; p.title = title;
  p.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = p.SchemeColor;
  const logo = { image: { path: R('img/efuture-logo-white.png'), x: W - 2.15, y: 0.42, w: 1.6, h: 0.42 } };
  const num = { x: W - 1.0, y: H - 0.55, w: 0.6, h: 0.3, color: C.background1, fontSize: 11, align: 'right' };
  p.defineSlideMaster({ title: 'EFG_COPERTINA', background: { color: C.text2 }, objects: [logo,
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.9, y: 1.9, w: 10.5, h: 0.5, fontSize: 18, bold: true, charSpacing: 6, color: C.accent2, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.9, y: 2.45, w: 11.4, h: 1.9, fontSize: 54, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.9, y: 4.5, w: 10.5, h: 1.4, fontSize: 22, color: C.background2, valign: 'top', align: 'left', margin: 0 }, text: '' } }] });
  p.defineSlideMaster({ title: 'EFG_SCURA', background: { color: C.text2 }, slideNumber: num, objects: [logo,
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.7, y: 0.5, w: 9.5, h: 0.4, fontSize: 14, bold: true, charSpacing: 4, color: C.accent2, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.9, w: 10.5, h: 0.95, fontSize: 34, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } }] });
  p.defineSlideMaster({ title: 'EFG_CHIARA', background: { color: C.background2 }, slideNumber: { ...num, color: C.text2 }, objects: [
    { image: { path: R('img/efuture-logo.png'), x: W - 2.15, y: 0.42, w: 1.6, h: 0.42 } },
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.7, y: 0.5, w: 9.5, h: 0.4, fontSize: 14, bold: true, charSpacing: 4, color: C.accent1, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.9, w: 10.5, h: 0.95, fontSize: 34, bold: true, color: C.text2, valign: 'top', align: 'left', margin: 0 }, text: '' } }] });
  // tutorial: immagine su fondo chiaro a sinistra, testo su fondo scuro a destra
  p.defineSlideMaster({ title: 'EFG_TUTORIAL', background: { color: C.text2 }, slideNumber: num, objects: [
    { rect: { x: 0, y: 0, w: 7.4, h: H, fill: { color: C.background2 } } },
    { image: { path: R('img/efuture-logo-white.png'), x: W - 1.95, y: 0.42, w: 1.45, h: 0.38 } },
    { placeholder: { options: { name: 'kicker', type: 'body', x: 7.95, y: 1.05, w: 4.9, h: 0.35, fontSize: 12, bold: true, charSpacing: 3, color: C.accent2, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'step', type: 'body', x: 7.95, y: 1.45, w: 4.9, h: 0.4, fontSize: 16, bold: true, color: C.accent1, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 7.95, y: 1.9, w: 4.9, h: 1.3, fontSize: 28, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 7.95, y: 3.25, w: 4.9, h: 1.75, fontSize: 15, color: C.background2, valign: 'top', align: 'left', margin: 0 }, text: '' } }] });
  p.defineSlideMaster({ title: 'EFG_IMMAGINE', background: { color: '000000' }, objects: [] });
  return { p, C };
}
async function save(p, file){
  const f = path.join(OUT, file); await p.writeFile({ fileName: f });
  const zip = await JSZip.loadAsync(fs.readFileSync(f)); const part = 'ppt/theme/theme1.xml';
  const SL = ['dk1','lt1','dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
  const sch = '<a:clrScheme name="Efuture">' + SL.map(k => '<a:' + k + '><a:srgbClr val="' + THEME.colors[k] + '"/></a:' + k + '>').join('') + '</a:clrScheme>';
  zip.file(part, (await zip.file(part).async('string')).replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => sch).replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, h) => h + 'Efuture"'));
  // pptxgenjs ripete <a:pPr> a metà paragrafo (testo con grassetti): resta solo quello iniziale
  for (const n of Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))){
    const x = await zip.file(n).async('string');
    zip.file(n, x.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (all, body) => '<a:p>' + body.replace(/(?!^)<a:pPr\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/a:pPr>)/g, '') + '</a:p>'));
  }
  fs.writeFileSync(f, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(f);
}
// testo dei tutorial (<p>, <ul><li>, <b>) → paragrafi modificabili
const dec = t => t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function paras(html){
  const out = [];
  for (const m of html.matchAll(/<(p|li)>([\s\S]*?)<\/\1>/g)){
    const runs = m[2].split(/(<b>[\s\S]*?<\/b>)/).filter(Boolean).map(s => s.startsWith('<b>') ? { text: dec(s.slice(3, -4)), options: { bold: true } } : { text: dec(s.replace(/<[^>]+>/g, '')), options: {} });
    runs[0].options.paraSpaceAfter = 6; if (m[1] === 'li') runs[0].options.bullet = true;   // opzioni del paragrafo solo sul primo pezzo
    runs[runs.length - 1].options.breakLine = true; out.push(...runs);
  }
  if (out.length) delete out[out.length - 1].options.breakLine;
  return out;
}
const plain = html => dec(html.replace(/<li>/g, '\n• ').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')).trim();
function imgFit(file, x, y, w, h, ratio){   // immagine intera dentro il riquadro, centrata
  let iw = w, ih = w / ratio; if (ih > h){ ih = h; iw = h * ratio; }
  return { path: file, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih };
}
function kicker(s, t){ s.addText(t, { placeholder: 'kicker' }); }
function cover(d, sec, k, title, sub){
  const s = d.p.addSlide({ masterName: 'EFG_COPERTINA', sectionTitle: sec });
  kicker(s, k); s.addText(title, { placeholder: 'title' }); if (sub) s.addText(sub, { placeholder: 'body' });
  return s;
}
function videoSlide(d, sec, title, video, poster, kick){
  const s = d.p.addSlide({ masterName: 'EFG_SCURA', sectionTitle: sec });
  kicker(s, kick || 'VIDEO'); s.addText(title, { placeholder: 'title' });
  s.addMedia({ type: 'video', path: R(video), cover: fs.readFileSync(R(poster)).toString('base64').replace(/^/, 'data:image/jpeg;base64,'), x: 1.9, y: 1.95, w: 9.53, h: 5.36, objectName: 'Video' });
  s.addNotes('Video: clic sul riquadro per avviarlo (in PowerPoint). File: ' + video);
}

/* ---------- 1. Laboratorio AI: le slide di laboratorio.html ---------- */
{
  const d = newDeck('Laboratorio AI'); d.p.addSection({ title: 'Laboratorio AI' });
  for (const L of LAB){
    const s = d.p.addSlide({ masterName: 'EFG_IMMAGINE', sectionTitle: 'Laboratorio AI' });
    if (L.video) s.addMedia({ type: 'video', path: R(L.video), cover: 'data:image/jpeg;base64,' + fs.readFileSync(L.png).toString('base64'), x: 0, y: 0, w: W, h: H, objectName: 'Video' });
    else s.addImage({ path: L.png, x: 0, y: 0, w: W, h: H, altText: L.label, objectName: 'Slide' });
    s.addNotes(L.label + (L.video ? '\nVideo: clic per avviarlo.' : '') + (L.text ? '\n\n' + L.text : ''));
  }
  await save(d.p, '1-laboratorio-ai.pptx');
}

/* ---------- 2 e 3. i tutorial ---------- */
const src = fs.readFileSync(R('tutorial/tutorials.js'), 'utf8'); const window = {}; new Function('window', src)(window);
async function tutorialDeck(id, file, video, poster, short){
  const secs = new Set();
  const T = window.EFG_TUTORIALS.find(t => t.id === id); const d = newDeck(T.title); const name = short || T.short || T.title;
  T.slides.forEach((sl, i) => {
    const sec = i === 0 ? 'Introduzione' : /^Passo/.test(sl.k) ? 'Passo dopo passo' : i < 2 ? 'Introduzione' : 'Conclusione';
    if (!secs.has(sec)){ secs.add(sec); d.p.addSection({ title: sec }); }
    const s = d.p.addSlide({ masterName: 'EFG_TUTORIAL', sectionTitle: sec });
    s.addImage({ ...imgFit(R('tutorial/' + id + '/' + sl.img), 0.4, 0.4, 6.6, 6.7, 1200 / 700), altText: sl.h, objectName: 'Immagine', rounding: false });
    s.addText('TUTORIAL · ' + name.toUpperCase(), { placeholder: 'kicker' });
    s.addText(sl.k, { placeholder: 'step' }); s.addText(sl.h, { placeholder: 'title' });
    s.addText(paras(sl.html), { placeholder: 'body' });
    let y = 5.1;
    if (sl.prompt){
      s.addShape(d.p.ShapeType.rect, { x: 7.95, y, w: 0.06, h: 1.35, fill: { color: d.C.accent1 }, line: { type: 'none' }, objectName: 'Linea prompt' });
      s.addText('“' + sl.prompt + '”', { x: 8.1, y, w: 4.75, h: 1.35, fontSize: 13, italic: true, color: d.C.background1, fill: { color: d.C.accent3 }, valign: 'middle', margin: [6, 10, 6, 10], isTextBox: true, objectName: 'Prompt' });
      y += 1.5;
    }
    if (sl.time) s.addText('⏱ ' + sl.time, { x: 7.95, y, w: 3.2, h: 0.4, fontSize: 13, color: d.C.accent5, shape: d.p.ShapeType.roundRect, rectRadius: 0.2, fill: { color: d.C.accent3 }, align: 'center', margin: 0, isTextBox: true, objectName: 'Tempo' });
    s.addNotes(sl.k + ' – ' + sl.h + '\n\n' + plain(sl.html) + (sl.prompt ? '\n\nPrompt da scrivere: ' + sl.prompt : '') + (sl.time ? '\nTempo: ' + sl.time : ''));
    if (i === 0) videoSlide(d, sec, 'Il tutorial in video', video, poster, 'VIDEO · ' + name.toUpperCase());
  });
  await save(d.p, file);
}
await tutorialDeck('forza4', '2-forza4-claude.pptx', 'video/forza4-claude.mp4', 'video/forza4-claude.jpg');
await tutorialDeck('sheets', '3-foglio-attivita.pptx', 'video/sheets-claude.mp4', 'video/sheets-claude.jpg', 'Foglio con Claude');

/* ---------- 4. Efuture Games: i 4 giochi degli stand ---------- */
function stat(d, s, x, y, big, small){
  s.addShape(d.p.ShapeType.roundRect, { x, y, w: 3.6, h: 2.3, rectRadius: 0.15, fill: { color: d.C.background1 }, line: { color: 'D5E3F0', width: 1 }, objectName: 'Riquadro ' + small });
  s.addText(big, { x, y: y + 0.25, w: 3.6, h: 1.25, fontSize: 66, bold: true, color: d.C.accent1, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'Numero ' + small });
  s.addText(small, { x, y: y + 1.5, w: 3.6, h: 0.55, fontSize: 18, color: d.C.text2, align: 'center', margin: 0, isTextBox: true, objectName: 'Etichetta ' + small });
}
{
  const d = newDeck('Efuture Games');
  d.p.addSection({ title: 'Introduzione' });
  const c = cover(d, 'Introduzione', 'I 4 GIOCHI DEGLI STAND', 'Efuture Games', 'Efuture · CoreTech · Timenet · inncloud');
  GAMES.forEach((g, i) => c.addImage({ path: R(g.ico), x: 0.9 + i * 1.15, y: 5.85, w: 0.9, h: 0.9, altText: g.name, objectName: 'Icona ' + g.name }));
  c.addNotes('Quattro videogiochi, uno per ogni stand: si giocano dal telefono con l’app Efuture Games.');
  const r = d.p.addSlide({ masterName: 'EFG_CHIARA', sectionTitle: 'Introduzione' });
  kicker(r, 'LE REGOLE'); r.addText('Come si gioca', { placeholder: 'title' });
  stat(d, r, 0.7, 2.1, '3', 'livelli per gioco'); stat(d, r, 4.87, 2.1, '1’', 'minuto per livello'); stat(d, r, 9.03, 2.1, '3', 'vite per livello');
  r.addText([{ text: 'Punti = ', options: { bold: true } }, { text: 'livello × secondi avanzati × vite' }], { x: 0.7, y: 4.75, w: 11.93, h: 0.6, fontSize: 22, color: d.C.text2, align: 'center', margin: 0, isTextBox: true, objectName: 'Formula' });
  r.addText('Ogni gioco si sblocca allo stand del suo sponsor, inquadrando il QR.', { x: 0.7, y: 5.45, w: 11.93, h: 0.5, fontSize: 18, color: d.C.text1, align: 'center', margin: 0, isTextBox: true, objectName: 'Sblocco' });
  r.addNotes('In gara contano i primi 3 livelli, ognuno con 1 minuto e 3 vite. Il punteggio: livello × secondi avanzati × vite rimaste. Prima contano i livelli superati, poi i punti. I giochi si sbloccano agli stand con il QR.');
  d.p.addSection({ title: 'I giochi' });
  for (const g of GAMES){
    const s = d.p.addSlide({ masterName: 'EFG_SCURA', sectionTitle: 'I giochi' });
    kicker(s, 'STAND ' + g.stand.toUpperCase() + ' · ' + g.genre.toUpperCase()); s.addText(g.name, { placeholder: 'title' });
    s.addImage({ path: R(g.ico), x: 0.7, y: 2.2, w: 1.3, h: 1.3, altText: g.name, objectName: 'Icona' });
    s.addText(g.text, { x: 0.7, y: 3.75, w: 7.2, h: 1.6, fontSize: 20, color: d.C.background1, valign: 'top', margin: 0, isTextBox: true, objectName: 'Descrizione' });
    s.addText('🎮  ' + g.how, { x: 0.7, y: 5.55, w: 7.2, h: 0.5, fontSize: 16, color: d.C.accent5, margin: 0, isTextBox: true, objectName: 'Comandi' });
    const box = imgFit(g.png, 8.6, 1.55, 4.1, 5.5, g.ratio);
    s.addShape(d.p.ShapeType.roundRect, { x: box.x - 0.12, y: box.y - 0.12, w: box.w + 0.24, h: box.h + 0.24, rectRadius: 0.12, fill: { color: d.C.accent3 }, line: { type: 'none' }, objectName: 'Cornice' });
    s.addImage({ ...box, altText: 'Una partita di ' + g.name, objectName: 'Schermata' });
    s.addNotes(g.name + ' (stand ' + g.stand + '): ' + g.text + ' Comandi: ' + g.how + '.');
  }
  d.p.addSection({ title: 'Si parte' });
  const q = d.p.addSlide({ masterName: 'EFG_CHIARA', sectionTitle: 'Si parte' });
  kicker(q, 'SI PARTE'); q.addText('Scarica l’app e gioca', { placeholder: 'title' });
  q.addImage({ path: R('qr/qr-app.png'), x: 0.9, y: 2.0, w: 4.4, h: 4.4, altText: 'QR dell’app Efuture Games', objectName: 'QR app' });
  q.addText([{ text: 'Inquadra il QR', options: { bold: true, breakLine: true } }, { text: 'con la fotocamera del telefono e registrati.', options: { breakLine: true } }, { text: ' ', options: { breakLine: true } },
    { text: 'Poi passa agli stand: ', options: { bold: true } }, { text: 'a ogni stand sblocchi il suo gioco.' }],
    { x: 6.0, y: 2.6, w: 6.4, h: 3.0, fontSize: 24, color: d.C.text2, valign: 'top', margin: 0, isTextBox: true, objectName: 'Istruzioni' });
  q.addNotes('Il QR apre l’app Efuture Games. Dopo la registrazione i giochi si sbloccano agli stand.');
  await save(d.p, '4-efuture-games.pptx');
}

/* ---------- 5. Classifica e premiazione ---------- */
{
  const d = newDeck('Classifica e premiazione');
  d.p.addSection({ title: 'Introduzione' });
  cover(d, 'Introduzione', 'EFUTURE GAMES', 'Classifica e premiazione', 'Chi ha fatto più strada nei 4 giochi?').addNotes('Apertura della premiazione.');
  d.p.addSection({ title: 'Le regole' });
  const a = d.p.addSlide({ masterName: 'EFG_CHIARA', sectionTitle: 'Le regole' });
  kicker(a, 'COME SI VINCE'); a.addText('Due classifiche', { placeholder: 'title' });
  const card = (s, x, t, lines) => {
    s.addShape(d.p.ShapeType.roundRect, { x, y: 2.1, w: 5.75, h: 3.9, rectRadius: 0.15, fill: { color: d.C.background1 }, line: { color: 'D5E3F0', width: 1 }, objectName: 'Riquadro ' + t });
    s.addText(t, { x: x + 0.4, y: 2.4, w: 5.0, h: 0.6, fontSize: 24, bold: true, color: d.C.accent1, margin: 0, isTextBox: true, objectName: 'Titolo ' + t });
    s.addText(lines.map((l, i) => ({ text: l, options: { bullet: true, breakLine: i < lines.length - 1 } })), { x: x + 0.4, y: 3.15, w: 5.0, h: 2.6, fontSize: 20, color: d.C.text2, valign: 'top', margin: 0, paraSpaceAfter: 10, isTextBox: true, objectName: 'Testo ' + t });
  };
  card(a, 0.7, 'Classifica di ogni gioco', ['conta il record di ognuno', 'prima i livelli superati, poi i punti', 'a parità vince chi ha fatto il record prima']);
  card(a, 6.88, 'Classifica generale', ['somma dei record nei 4 giochi', '+ i punti del ⭐ Bonus Recensione', 'prima i livelli, poi i punti']);
  a.addNotes('Ogni gioco ha la sua classifica: prima i livelli superati, poi i punti. La classifica generale somma i record dei 4 giochi più il bonus recensione.');
  const f = d.p.addSlide({ masterName: 'EFG_SCURA', sectionTitle: 'Le regole' });
  kicker(f, 'SULLO SCHERMO'); f.addText('Le due fasi della classifica', { placeholder: 'title' });
  const fase = (x, t, lines) => {
    f.addShape(d.p.ShapeType.roundRect, { x, y: 2.1, w: 5.75, h: 3.9, rectRadius: 0.15, fill: { color: d.C.accent3 }, line: { type: 'none' }, objectName: 'Riquadro ' + t });
    f.addText(t, { x: x + 0.4, y: 2.4, w: 5.0, h: 0.6, fontSize: 26, bold: true, color: d.C.background1, margin: 0, isTextBox: true, objectName: 'Titolo ' + t });
    f.addText(lines.map((l, i) => ({ text: l, options: { bullet: true, breakLine: i < lines.length - 1 } })), { x: x + 0.4, y: 3.15, w: 5.0, h: 2.6, fontSize: 20, color: d.C.background2, valign: 'top', margin: 0, paraSpaceAfter: 10, isTextBox: true, objectName: 'Testo ' + t });
  };
  fase(0.7, '🟢 Live', ['durante l’evento', 'i 4 giochi, top 3 di ognuno', 'ospiti e sponsor', 'QR per scaricare l’app']);
  fase(6.88, '🏆 Finale', ['alla premiazione', 'solo la classifica generale', 'top 10, solo ospiti', 'una posizione alla volta, dalla 10ª alla 1ª']);
  f.addNotes('Dalla pagina Classifica dell’admin si sceglie la Fase. In Finale ogni “Prossima posizione” fa comparire una riga, dalla 10ª alla 1ª.');
  d.p.addSection({ title: 'Premiazione' });
  const cl = d.p.addSlide({ masterName: 'EFG_SCURA', sectionTitle: 'Premiazione' });
  kicker(cl, 'LA CLASSIFICA'); cl.addText('E ora... la classifica!', { placeholder: 'title' });
  cl.addText('Passa alla classifica dal vivo (Admin › Classifica › Fase 🏆 Finale)', { x: 0.7, y: 2.0, w: 11.9, h: 0.5, fontSize: 18, color: d.C.accent2, margin: 0, isTextBox: true, objectName: 'Istruzione' });
  cl.addText('10 · 9 · 8 · 7 · 6 · 5 · 4', { x: 0.7, y: 3.2, w: 11.9, h: 1.4, fontSize: 60, bold: true, color: d.C.background1, align: 'center', margin: 0, isTextBox: true, objectName: 'Conto alla rovescia' });
  cl.addText('…e poi il podio', { x: 0.7, y: 4.8, w: 11.9, h: 0.7, fontSize: 28, italic: true, color: d.C.accent1, align: 'center', margin: 0, isTextBox: true, objectName: 'Podio' });
  cl.addNotes('Qui si passa alla pagina della classifica in fase Finale e si fa comparire una posizione alla volta.');
  const pd = d.p.addSlide({ masterName: 'EFG_SCURA', sectionTitle: 'Premiazione' });
  kicker(pd, 'IL PODIO'); pd.addText('I vincitori', { placeholder: 'title' });
  const POD = [{ n: '2°', x: 1.0, h: 2.3, col: d.C.accent2 }, { n: '1°', x: 4.92, h: 3.1, col: d.C.accent1 }, { n: '3°', x: 8.84, h: 1.7, col: d.C.accent5 }];
  for (const b of POD){
    const y = H - 0.55 - b.h;
    pd.addText([{ text: 'Nome Cognome', options: { bold: true, fontSize: 22, breakLine: true } }, { text: 'Azienda', options: { fontSize: 16 } }], { x: b.x, y: y - 1.15, w: 3.5, h: 1.0, color: d.C.background1, align: 'center', valign: 'bottom', margin: 0, isTextBox: true, objectName: 'Vincitore ' + b.n });
    pd.addText(b.n, { x: b.x, y, w: 3.5, h: b.h, shape: d.p.ShapeType.rect, fill: { color: b.col }, fontSize: 54, bold: true, color: d.C.text2, align: 'center', valign: 'top', margin: [14, 0, 0, 0], isTextBox: true, objectName: 'Gradino ' + b.n });
  }
  pd.addNotes('Scrivi qui nome e azienda dei primi tre (dalla classifica Finale), oppure lascia questa slide come sfondo della foto di gruppo.');
  const g = cover(d, 'Premiazione', 'GRAZIE A TUTTI', 'Grazie per aver giocato!', 'Efuture · CoreTech · Timenet · inncloud');
  GAMES.forEach((x, i) => g.addImage({ path: R(x.ico), x: 0.9 + i * 1.15, y: 5.85, w: 0.9, h: 0.9, altText: x.name, objectName: 'Icona ' + x.name }));
  g.addNotes('Ringraziamenti agli sponsor degli stand.');
  await save(d.p, '5-classifica-premiazione.pptx');
}
fs.rmSync(TMP, { recursive: true, force: true });
