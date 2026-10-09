(function(){
"use strict";

/* ================= EFUTURE GAMES: competition mode =================
   Opened from the Efuture Games app (?hub=1): only 3 levels, at most
   60 seconds of play each. The time used is sent to the app, which
   turns the seconds left out of 180 into the score.                 */
const EFG = { on: /[?&]hub=1\b/.test(location.search), max:3, limit:60, used:0, times:[], livesAt:[], tickT:0, done:false };
function efgPost(m){ try { if (window.parent !== window) window.parent.postMessage(Object.assign({type:'efg'}, m), '*'); } catch(e){} }


/* ================= CONSTANTS ================= */
const W = 360, H = 600;
const SHIP_Y = 548;
const TOP_Y = 34, BOSS_TOP_Y = 116;   // first row of the formation: just below the drone lane (y = 16)
const FIRE_CD = 0.3, FIRE_CD_X2 = 0.18; // manual fire: shortest time between two shots (normal / double shot)
const RED = '#c00000', RED_HI = '#ff3b3b', INK = '#272727', CLOUD = '#ffffff', HACK = '#13a04a';
const NAVY = '#0d2b45', OUTLINE = '#56718a';   // light theme: text and cloud outline on the pale sky
const PX = 3;                                   // size of one sprite pixel

// original pixel sprites (two frames each). X = body, W = white, G = green glow, R = dark detail
const SPRITES = {
  B: { color:HACK, pts:10, frames:[[
    "...X...X...",
    "....X.X....",
    "...XXXXX...",
    "X.XXWXWXX.X",
    ".XXXXXXXXX.",
    "X.XXRXRXX.X",
    ".XXXXXXXXX.",
    "X..XXXXX..X",
    "....X.X...."],[
    "..X.....X..",
    "...X...X...",
    "...XXXXX...",
    ".XXXWXWXXX.",
    "X.XXXXXXX.X",
    ".XXXRXRXXX.",
    "X.XXXXXXX.X",
    "...XXXXX...",
    "...X...X..."]]},
  V: { color:'#7b47d6', pts:20, frames:[[
    "X....X....X",
    ".X...X...X.",
    "..XXXXXXX..",
    ".XXWXXXWXX.",
    "XXXXXXXXXXX",
    ".XXXRRRXXX.",
    "..XXXXXXX..",
    ".X...X...X.",
    "X....X....X"],[
    ".....X.....",
    "..X..X..X..",
    "..XXXXXXX..",
    ".XXWXXXWXX.",
    "XXXXXXXXXXX",
    ".XXXXRXXXX.",
    "..XXXXXXX..",
    "..X..X..X..",
    ".....X....."]]},
  K: { color:'#4f6478', pts:30, frames:[[   // the hacker: hood + glowing face
    "...XXXXX...",
    "..XXXXXXX..",
    ".XXRRRRRXX.",
    ".XRGGRGGRX.",
    ".XRRRRRRRX.",
    ".XRRGRGRRX.",
    ".XXRGGGRXX.",
    "XXXXRRRXXXX",
    "XX.XXXXX.XX"],[
    "...XXXXX...",
    "..XXXXXXX..",
    ".XXRRRRRXX.",
    ".XRGGRGGRX.",
    ".XRRRRRRRX.",
    ".XRRRRRRRX.",
    ".XXRGGGRXX.",
    "XXXXRRRXXXX",
    ".XX.XXX.XX."]]},
};
const DRONE = ["....XXX....","..XXXXXXX..",".XXGXGXGXX.","XXXXXXXXXXX","..XX...XX.."];

const LEVELS = [
  { name:"Login sospetto", text:"Tre file lente: prendi la mira.",
    rows:['K','V','B'],             cols:8, speed:16, fire:0.55, bspeed:170 },
  { name:"Phishing",       text:"Virus via email: più file, più veloci.",
    rows:['K','V','V','B'],         cols:8, speed:20, fire:0.85, bspeed:185 },
  { name:"Malware",        text:"Cinque file, più colpi. Usa le nuvolette.",
    rows:['K','V','V','B','B'],     cols:8, speed:24, fire:1.15, bspeed:200 },
  { name:"Botnet",         text:"Hacker coordinati, più aggressivi.",
    rows:['K','K','V','V','B','B'], cols:8, speed:23, fire:1.3, bspeed:210 },
  { name:"Ransomware",     text:"Boss finale: svuota la sua barra.",
    rows:['V','B'],                 cols:7, speed:22, fire:1.1, bspeed:220, boss:true },
];

/* ================= DOM ================= */
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const stage = $('stage');
const ov = { title:$('ov-title'), level:$('ov-level'), clear:$('ov-clear'), over:$('ov-over'), win:$('ov-win'), pause:$('ov-pause') };
function showOnly(o){ for (const k in ov) ov[k].hidden = (ov[k] !== o); }
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v===null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
let best = store.get('inncloudInvBest', 0);
let reached = store.get('inncloudInvReached', 0);

/* ================= AUDIO ================= */
let audioOn = store.get('inncloudInvSound', true), actx = null;
function beep(freq, dur, type, vol, slide){
  if (!audioOn) return;
  try{
    if (!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type||'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t+dur);
    g.gain.setValueAtTime(vol||0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+dur+0.02);
  }catch(e){}
}
let marchStep = 0;
const sfx = {
  shoot(){ beep(880, 0.05, 'square', 0.025, 440); },
  kill(){ beep(220, 0.12, 'sawtooth', 0.05, 60); },
  march(){ beep([98,87,78,73][marchStep++ % 4], 0.08, 'square', 0.05); },
  hit(){ beep(140, 0.5, 'sawtooth', 0.06, 40); },
  drone(){ beep(1200, 0.06, 'triangle', 0.03, 900); },
  boss(){ beep(160, 0.09, 'square', 0.05, 120); },
  clear(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.14,'square',0.05),i*120)); },
  start(){ [330,392,523,659].forEach((f,i)=>setTimeout(()=>beep(f,0.12,'square',0.045),i*110)); },
};
function refreshSoundBtn(){ $('soundBtn').textContent = audioOn ? '♪' : '×'; $('soundBtn').style.opacity = audioOn?1:.55; }

/* ================= STATE ================= */
let state = 'title', prevState = null;
let lvIndex = 0, L = LEVELS[0];
let score = 0, levelStartScore = 0, lives = 3, levelKills = 0, levelTime = 0;
let ship = { x:W/2, inv:0, fireCd:0, fireMax:FIRE_CD, dead:0 };
const DOT_R = 4.5;                // same size as the dot of the "i"
let shots = [], ebul = [], parts = [], toasts = [];
let foes = [], total = 0, fx = 0, fdir = 1, fy = 0, frame = 0, frameT = 0, fireT = 0;
let drone = null, droneT = 8, doubleT = 0;
let walls = [];
let boss = null;
let targetX = null, keyDir = 0;
let clock = 0, scale = 1, dpr = 1;
let intro = null;

const SPR_W = 11*PX, SPR_H = 9*PX, GAP_Y = 10;
let GAP_X = 6;

function loadLevel(i){
  lvIndex = i; L = LEVELS[i];
  foes = [];
  // the formation must leave room to march sideways: never wider than the field minus ~60px
  GAP_X = Math.max(2, Math.min(6, (W - 60 - L.cols*SPR_W) / Math.max(1, L.cols-1)));
  const gw = L.cols*SPR_W + (L.cols-1)*GAP_X;
  const x0 = (W - gw)/2, y0 = L.boss ? BOSS_TOP_Y : TOP_Y;
  L.rows.forEach((t, r)=>{
    for (let c=0;c<L.cols;c++) foes.push({ t, x:x0 + c*(SPR_W+GAP_X), y:y0 + r*(SPR_H+GAP_Y), alive:true, c });
  });
  total = foes.length; fx = 0; fy = 0; fdir = 1; frame = 0; frameT = 0; fireT = 0;
  shots = []; ebul = []; parts = []; toasts = [];
  drone = null; droneT = 7 + Math.random()*5; doubleT = 0;
  boss = L.boss ? { x:W/2, y:62, vx:55, hp:20, max:20, t:0, shotT:1.4, flash:0 } : null;
  buildWalls();
  ship = { x:W/2, inv:1.2, fireCd:0.25, fireMax:0.25, dead:0 };
  fireQ = 0;
  levelKills = 0; levelTime = 0;
}

function buildWalls(){
  walls = [];
  // each firewall is a small pixel cloud
  const shape = [
    "....XXXX....",
    "..XXXXXXX.X.",
    ".XXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    ".XXXXXXXXXX."];
  const cs = 4, n = 4, ww = 12*cs, gap = (W - n*ww)/(n+1);
  for (let k=0;k<n;k++){
    const bx = gap + k*(ww+gap), by = 468;
    shape.forEach((row, r)=>[...row].forEach((ch, c)=>{ if (ch==='X') walls.push({ x:bx+c*cs, y:by+r*cs, s:cs }); }));
  }
}

/* ================= UPDATE ================= */
function aliveFoes(){ return foes.filter(f=>f.alive); }
function foeBox(f){ return { x:f.x+fx, y:f.y+fy, w:SPR_W, h:SPR_H }; }
function hit(a, b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

function update(dt){
  clock += dt;
  if (state === 'intro'){ updateIntro(dt); return; }
  updateParts(dt);
  if (state !== 'play') return;
  levelTime += dt;
  if (EFG.on && !EFG.done){
    EFG.tickT -= dt;
    if (EFG.tickT <= 0){ EFG.tickT = 0.25; efgPost({ev:'tick', level:lvIndex+1, max:EFG.max, t:levelTime, used:EFG.used}); }
    if (levelTime >= EFG.limit){ efgEnd(false, 'time'); return; }
  }

  // ship
  if (ship.dead > 0){
    ship.dead -= dt;
    if (ship.dead <= 0){ if (lives <= 0){ gameOver(); return; } ship.x = W/2; ship.inv = 1.8; }
  } else {
    if (keyDir){ targetX = null; ship.x += keyDir*260*dt; }
    else if (targetX !== null) ship.x += (targetX - ship.x) * Math.min(1, dt*16);
    ship.x = Math.max(24, Math.min(W-24, ship.x));
    if (ship.inv > 0) ship.inv -= dt;
    // red shots (the dot of the "i"), only when the player fires: SPARA, Space / ArrowUp / Z, mouse button.
    // Holding fires again as soon as the cooldown allows; a tap is remembered for a moment.
    if (ship.fireCd > 0) ship.fireCd -= dt;
    const maxShots = doubleT > 0 ? 6 : 3;
    if ((fireHeld() || fireQ > 0) && ship.fireCd <= 0 && shots.length < maxShots){
      fireQ = 0;
      ship.fireCd = ship.fireMax = doubleT > 0 ? FIRE_CD_X2 : FIRE_CD;
      if (doubleT > 0){ shots.push({x:ship.x-6, y:SHIP_Y-12}); shots.push({x:ship.x+6, y:SHIP_Y-12}); }
      else shots.push({ x:ship.x, y:SHIP_Y-12 });
      sfx.shoot();
    }
  }
  if (fireQ > 0) fireQ -= dt;
  if (doubleT > 0) doubleT -= dt;

  // formation
  const alive = aliveFoes();
  const frac = total ? alive.length/total : 0;
  const speed = L.speed * (1 + 2.4*(1-frac)) * (1 + Math.min(0.5, fy/400));
  fx += fdir * speed * dt;
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of alive){ minX = Math.min(minX, f.x+fx); maxX = Math.max(maxX, f.x+fx+SPR_W); maxY = Math.max(maxY, f.y+fy+SPR_H); }
  if (alive.length && ((fdir > 0 && maxX > W-6) || (fdir < 0 && minX < 6))){
    fdir = -fdir; fy += 12;
  }
  frameT -= dt * (0.6 + 2*(1-frac));
  if (frameT <= 0){ frameT = 0.5; frame ^= 1; if (alive.length) sfx.march(); }
  if (alive.length && maxY >= SHIP_Y - 18){ lives = 0; killShip(); }
  // attackers crash into firewalls
  for (const f of alive){ const b = foeBox(f); for (const w of walls) if (!w.dead && hit(b, {x:w.x,y:w.y,w:w.s,h:w.s})) w.dead = true; }

  // enemy fire: pick the lowest attacker of a column, prefer the ones above the ship
  fireT -= dt;
  if (fireT <= 0 && alive.length){
    fireT = (0.7 + Math.random()*0.8) / L.fire;
    const cols = {};
    for (const f of alive) if (!cols[f.c] || f.y > cols[f.c].y) cols[f.c] = f;
    const shooters = Object.values(cols);
    shooters.sort((a,b)=>Math.abs(a.x+fx-ship.x) - Math.abs(b.x+fx-ship.x));
    const s = Math.random() < 0.55 ? shooters[0] : shooters[Math.floor(Math.random()*shooters.length)];
    ebul.push({ x:s.x+fx+SPR_W/2, y:s.y+fy+SPR_H, vy:L.bspeed, vx:0, ch:Math.random()<0.5?'0':'1' });
  }

  // boss
  if (boss && boss.hp > 0){
    boss.t += dt; boss.x += boss.vx*dt;
    if (boss.x < 60 || boss.x > W-60){ boss.vx = -boss.vx; boss.x = Math.max(60, Math.min(W-60, boss.x)); }
    if (boss.flash > 0) boss.flash -= dt;
    boss.shotT -= dt;
    if (boss.shotT <= 0){
      const angry = boss.hp < boss.max/2;
      boss.shotT = angry ? 1.25 : 1.8;
      const n = angry ? 5 : 3;
      for (let i=0;i<n;i++){ const a = (i-(n-1)/2)*0.28; ebul.push({ x:boss.x, y:boss.y+34, vy:Math.cos(a)*L.bspeed, vx:Math.sin(a)*L.bspeed, ch:i%2?'1':'0' }); }
      sfx.boss();
    }
  }

  // drone (bonus): crossing the top, drops a double-shot patch when hit
  droneT -= dt;
  if (!drone && droneT <= 0 && !boss){ drone = { x: Math.random()<0.5 ? -30 : W+30, y:16, vx:0 }; drone.vx = drone.x < 0 ? 70 : -70; sfx.drone(); }
  if (drone){ drone.x += drone.vx*dt; if (drone.x < -40 || drone.x > W+40){ drone = null; droneT = 12 + Math.random()*8; } }

  // player shots
  for (const s of shots){
    s.y -= 520*dt;
    if (s.y < -10){ s.dead = true; continue; }
    const sb = { x:s.x-3, y:s.y-3, w:6, h:6 };
    for (const f of alive){ if (!f.alive) continue; if (hit(sb, foeBox(f))){ killFoe(f); s.dead = true; break; } }
    if (s.dead) continue;
    if (drone && hit(sb, {x:drone.x-17, y:drone.y-8, w:34, h:16})){
      const pts = [100,150,200,300][Math.floor(Math.random()*4)];
      score += pts; burst(drone.x, drone.y, HACK, 18); toast('+' + pts + ' · DOPPIO COLPO', RED);
      doubleT = 10; drone = null; droneT = 14; s.dead = true; sfx.kill(); continue;
    }
    for (const b of ebul){ if (!b.dead && Math.abs(b.x - s.x) < 6 && Math.abs(b.y - s.y) < 8){ b.dead = true; s.dead = true; burst(s.x, s.y, RED_HI, 5); break; } }
    if (s.dead) continue;
    if (boss && boss.hp > 0 && hit(sb, {x:boss.x-34, y:boss.y-30, w:68, h:66})){
      s.dead = true; boss.hp--; boss.flash = 0.08; score += 25; burst(s.x, s.y, RED_HI, 4);
      if (boss.hp <= 0){ score += 2000; for (let i=0;i<5;i++) burst(boss.x + (Math.random()-0.5)*60, boss.y + (Math.random()-0.5)*50, i%2?HACK:'#4f6478', 20); sfx.kill(); toast('RANSOMWARE SCONFITTO +2000', NAVY); for (const f of foes) f.alive = false; }
    }
  }
  shots = shots.filter(s=>!s.dead);

  // enemy bullets
  for (const b of ebul){
    b.y += b.vy*dt; b.x += b.vx*dt;
    if (b.y > H+10){ b.dead = true; continue; }
    const bb = { x:b.x-3, y:b.y-5, w:6, h:10 };
    for (const w of walls) if (!w.dead && hit(bb, {x:w.x,y:w.y,w:w.s,h:w.s})){ w.dead = true; b.dead = true; break; }
    if (b.dead) continue;
    if (ship.dead <= 0 && ship.inv <= 0 && hit(bb, {x:ship.x-20, y:SHIP_Y-8, w:40, h:18})){ b.dead = true; killShip(); }
  }
  ebul = ebul.filter(b=>!b.dead);

  // cleared?
  if (!aliveFoes().length && (!boss || boss.hp <= 0)) levelCleared();
  updateHud();
}

function killFoe(f){
  f.alive = false; levelKills++;
  const k = SPRITES[f.t]; score += k.pts;
  const b = foeBox(f); burst(b.x + SPR_W/2, b.y + SPR_H/2, k.color, 12); sfx.kill();
}
function killShip(){
  if (ship.dead > 0) return;
  lives--; ship.dead = 1.4; sfx.hit(); burst(ship.x, SHIP_Y, OUTLINE, 26); burst(ship.x, SHIP_Y, RED_HI, 10);
  ebul = []; updateHud();
}

function updateParts(dt){
  for (const p of parts){ p.x += p.vx*dt; p.y += p.vy*dt; p.vy += (p.g!==undefined?p.g:200)*dt; p.t -= dt; }
  parts = parts.filter(p=>p.t>0);
  for (const t of toasts) t.t -= dt;
  toasts = toasts.filter(t=>t.t>0);
}
function burst(x, y, c, n){
  for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, v = 40 + Math.random()*150;
    parts.push({ x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, t:0.4 + Math.random()*0.4, c, s:PX }); }
}
function toast(text, color){ toasts.push({ text, color, t:2.2 }); }

function efgEnd(ok, reason){
  if (EFG.done) return;
  EFG.done = true;
  if (!ok) state = 'over';
  efgPost({ev:'result', ok, reason: reason||'', level:lvIndex+1, max:EFG.max, used:EFG.used, times:EFG.times.slice(), lives:EFG.livesAt.slice(), seconds: EFG.used + (ok ? 0 : levelTime)});
}
function levelCleared(){
  if (EFG.on && !EFG.done){
    EFG.used += levelTime; EFG.times.push(levelTime); EFG.livesAt.push(lives);
    efgPost({ev:'tick', level:lvIndex+1, max:EFG.max, t:levelTime, used:EFG.used});
    if (lvIndex + 1 >= EFG.max){ state = 'clear'; sfx.clear(); efgEnd(true); return; }
  }
  state = 'clear'; sfx.clear();
  reached = Math.max(reached, Math.min(lvIndex+1, LEVELS.length-1)); store.set('inncloudInvReached', reached);
  if (score > best){ best = score; store.set('inncloudInvBest', best); }
  updateHud();
  setTimeout(()=>{
    if (lvIndex === LEVELS.length-1){ win(); return; }
    $('clearTitle').textContent = 'Livello ' + (lvIndex+1) + ' superato!';
    $('clearScore').textContent = score; $('clearBugs').textContent = levelKills; $('clearTime').textContent = fmt(levelTime);
    showOnly(ov.clear);
  }, 1100);
}
function gameOver(){
  if (EFG.on && !EFG.done) efgEnd(false, 'lives');
  state = 'over';
  if (score > best){ best = score; store.set('inncloudInvBest', best); }
  $('overScore').textContent = score; $('overLvl').textContent = (lvIndex+1) + '/' + (EFG.on ? EFG.max : 5);
  showOnly(ov.over);
}
function win(){
  state = 'win';
  const isRecord = score >= best;
  if (score > best){ best = score; store.set('inncloudInvBest', best); }
  reached = 0; store.set('inncloudInvReached', 0);
  $('winScore').textContent = score; $('winBest').textContent = best;
  $('winRecord').textContent = isRecord ? 'Nuovo record!' : 'Record da battere: ' + best;
  showOnly(ov.win);
}
function fmt(s){ s=Math.floor(s); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

/* ================= INTRO: the red dot shoots the first hacker ================= */
const LOGO = { w:280, x:(W-280)/2, y:250, nw:720, nh:138, dotX:16, dotY:16.5, dotR:16.5 };
function playIntro(){ state = 'intro'; showOnly(null); updateHud(); intro = { t:0, dot:null, hacker:{ x:W/2, y:-40 }, boom:false }; parts = []; }
function endIntro(){ if (state === 'intro'){ intro = null; parts = []; showLevelCard(0); } }
function updateIntro(dt){
  const I = intro; I.t += dt;
  const k = LOGO.w/LOGO.nw;
  // hacker drops in over the logo
  if (!I.boom) I.hacker.y = Math.min(150, -40 + Math.max(0, I.t-0.5)*260);
  // the red dot leaves the "i" and flies at it
  if (I.t > 1.3 && !I.dot && !I.boom){ I.dot = { x:LOGO.x + LOGO.dotX*k, y:LOGO.y + LOGO.dotY*k }; sfx.shoot(); }
  if (I.dot){
    const tx = I.hacker.x, ty = I.hacker.y + 12;
    const dx = tx - I.dot.x, dy = ty - I.dot.y, d = Math.hypot(dx,dy);
    const step = 520*dt;
    if (d <= step){ I.dot = null; I.boom = true; I.boomT = I.t; burst(tx, ty, HACK, 30); burst(tx, ty, '#4f6478', 20); sfx.kill(); }
    else { I.dot.x += dx/d*step; I.dot.y += dy/d*step; }
  }
  updateParts(dt);
  if (I.t > 4.3) endIntro();
}
function renderIntro(){
  const I = intro;
  drawSky();
  const img = $('logoImg'), k = LOGO.w/LOGO.nw, lh = LOGO.nh*k;
  // after the shot, the logo badge slides down and turns into the cloud ship
  const morph = I.boom ? Math.min(1, (I.t - I.boomT - 0.5)/0.9) : 0;
  if (morph < 1){
    ctx.globalAlpha = 1 - Math.max(0, morph);
    const pad = 12, y = LOGO.y + Math.max(0,morph)*120;
    ctx.fillStyle = '#ffffff'; roundRect(ctx, LOGO.x-pad, y-pad, LOGO.w+pad*2, lh+pad*2, 12); ctx.fill(); ctx.strokeStyle = '#cddcea'; ctx.lineWidth = 1; ctx.stroke();
    if (img && img.naturalWidth){
      ctx.drawImage(img, LOGO.x, y, LOGO.w, lh);
      if (I.dot || I.boom){ ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(LOGO.x + LOGO.dotX*k, y + LOGO.dotY*k, LOGO.dotR*k + 1.5, 0, Math.PI*2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  if (morph > 0){
    const sy = LOGO.y + lh/2 + (SHIP_Y - LOGO.y - lh/2) * easeOut(morph);
    ctx.globalAlpha = Math.min(1, morph*1.5); drawShip(W/2, sy, 1); ctx.globalAlpha = 1;
  }
  if (!I.boom) drawSprite(SPRITES.K, Math.floor(clock*3)%2, I.hacker.x - SPR_W/2, I.hacker.y);
  if (I.dot) drawShot(I.dot.x, I.dot.y, 4);
  drawParts();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if (I.boom && I.t > I.boomT + 1.4){ ctx.fillStyle = NAVY; ctx.font = "16px 'Press Start 2P', monospace"; ctx.fillText('INVADERS', W/2, 250); }
  ctx.fillStyle = OUTLINE; ctx.font = "8px 'Press Start 2P', monospace"; ctx.fillText('TOCCA PER SALTARE', W/2, H - 14);
}
function easeOut(t){ return 1 - Math.pow(1-t, 3); }

/* ================= FLOW ================= */
function showLevelCard(i){
  if (EFG.on) lives = 3;   // gara: 3 vite per ogni livello
  if (EFG.on && i === 0){ EFG.used = 0; EFG.times = []; EFG.livesAt = []; EFG.done = false; efgPost({ev:'start'}); }
  loadLevel(i); levelStartScore = score;
  state = 'levelcard';
  $('lvTag').textContent = 'Livello ' + (i+1) + '/' + (EFG.on ? EFG.max : 5);
  $('lvName').textContent = L.name;
  $('lvText').textContent = L.text;
  updateHud();
  $('btnGo').onclick();   // niente spiegazione prima del livello: si gioca subito
}
function startGame(from){ score = 0; lives = 3; showLevelCard(from||0); }
$('btnStart').onclick = ()=>{ score = 0; lives = 3; playIntro(); };
$('btnContinue').onclick = ()=> startGame(reached);
$('btnGo').onclick = ()=>{ showOnly(null); state = 'play'; sfx.start(); };
$('btnNext').onclick = ()=> showLevelCard(lvIndex+1);
$('btnRetry').onclick = ()=>{ lives = 3; score = levelStartScore; showLevelCard(lvIndex); };
$('btnMenu').onclick = toMenu;
$('btnAgain').onclick = ()=>{ score = 0; lives = 3; playIntro(); };
$('btnResume').onclick = togglePause;
$('btnPauseMenu').onclick = toMenu;
$('pauseBtn').onclick = togglePause;
$('soundBtn').onclick = ()=>{ audioOn = !audioOn; store.set('inncloudInvSound', audioOn); refreshSoundBtn(); if (audioOn) beep(660,0.08,'square',0.05); };
function toMenu(){ state = 'title'; refreshTitle(); showOnly(ov.title); updateHud(); }
function togglePause(){
  if (state==='play'){ prevState = state; state = 'paused'; showOnly(ov.pause); }
  else if (state==='paused'){ state = prevState || 'play'; showOnly(null); }
}
function refreshTitle(){
  if (EFG.on){ setTimeout(()=>{ $('btnContinue').hidden = true; }, 0); }
  $('bestLine').hidden = !(best > 0); $('bestVal').textContent = best;
  $('btnContinue').hidden = !(reached > 0); $('continueLvl').textContent = reached+1;
}

/* ================= INPUT ================= */
function fieldX(clientX){ const r = canvas.getBoundingClientRect(); return (clientX - r.left) / r.width * W; }
let drag = null;                      // the one finger that moves the cloud (strip or field)
const firePtrs = new Set();           // fingers / pointers holding SPARA (multi-touch: drag + fire together)
let fireQ = 0, mouseFire = false;     // fireQ: a tap waiting for the cooldown (seconds left)
function fireHeld(){ return firePtrs.size > 0 || mouseFire || !!(keys[' '] || keys.ArrowUp || keys.z || keys.Z); }
function pressFire(){ if (state === 'play') fireQ = 0.25; }
function onDown(e){
  if (state === 'intro'){ endIntro(); return; }
  if (e.target.closest && e.target.closest('.overlay')) return;
  if (state !== 'play') return;
  if (e.pointerType === 'mouse'){ if (e.button === 0 && e.currentTarget === stage){ mouseFire = true; pressFire(); } return; }
  if (drag) return;
  drag = { id:e.pointerId, sx:e.clientX, start:ship.x, strip: e.currentTarget.id === 'controls' };
  if (!drag.strip) targetX = fieldX(e.clientX);
}
function onMove(e){
  if (state !== 'play') return;
  if (e.pointerType === 'mouse' && !drag){ targetX = fieldX(e.clientX); return; }
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.strip){ const r = canvas.getBoundingClientRect(); targetX = drag.start + (e.clientX - drag.sx)/r.width*W*1.3; }
  else targetX = fieldX(e.clientX);
}
stage.addEventListener('pointerdown', onDown);
$('controls').addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
function onUp(e){
  if (drag && e.pointerId === drag.id) drag = null;
  if (e.pointerType === 'mouse') mouseFire = false;
  if (firePtrs.delete(e.pointerId) && !firePtrs.size) fireBtn.classList.remove('down');
}
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
// SPARA: tap = one shot, hold = repeated shots. It never starts a drag of the cloud.
const fireBtn = $('fireBtn');
fireBtn.addEventListener('pointerdown', e=>{
  e.stopPropagation(); e.preventDefault();
  if (state === 'intro'){ endIntro(); return; }
  firePtrs.add(e.pointerId); fireBtn.classList.add('down'); pressFire();
});
fireBtn.addEventListener('lostpointercapture', onUp);
fireBtn.addEventListener('contextmenu', e=>e.preventDefault());
fireBtn.addEventListener('keydown', e=>{ if (e.key === 'Enter'){ e.preventDefault(); pressFire(); } });
const keys = {};
window.addEventListener('keydown', e=>{
  if (state === 'intro'){ e.preventDefault(); endIntro(); return; }
  if (['ArrowLeft','ArrowRight','ArrowUp',' ','a','d','A','D','z','Z'].includes(e.key)) e.preventDefault();
  if (!keys[e.key] && [' ','ArrowUp','z','Z'].includes(e.key)) pressFire();
  keys[e.key] = true;
  if (e.key==='p' || e.key==='P' || e.key==='Escape') togglePause();
  if (e.key==='Enter'){
    if (!ov.title.hidden) $('btnStart').click();
    else if (!ov.level.hidden) $('btnGo').click();
    else if (!ov.clear.hidden) $('btnNext').click();
  }
  updateKeyDir();
}, {passive:false});
window.addEventListener('keyup', e=>{ keys[e.key] = false; updateKeyDir(); });
function updateKeyDir(){ keyDir = ((keys.ArrowRight||keys.d||keys.D)?1:0) - ((keys.ArrowLeft||keys.a||keys.A)?1:0); }

/* ================= RENDER ================= */
function fit(){
  const r = stage.getBoundingClientRect();
  const w = r.width - 12, h = r.height - 12;
  scale = Math.max(0.3, Math.min(w/W, h/H));
  dpr = Math.min(window.devicePixelRatio||1, 2.5);
  canvas.style.width = (W*scale)+'px'; canvas.style.height = (H*scale)+'px';
  canvas.width = Math.round(W*scale*dpr); canvas.height = Math.round(H*scale*dpr);
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', ()=>setTimeout(fit, 200));
function roundRect(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

// drifting clouds in three depths, like an old parallax scroller
const CLOUDS = [];
for (let i=0;i<9;i++){ const depth = i%3; CLOUDS.push({ x:(i*131)%W, y:40 + ((i*197)%460), w:60 + depth*40 + (i*13)%30, d:depth }); }
const STARS = Array.from({length:36}, (_,i)=>({ x:(i*89)%W, y:(i*61)%560 + 6, p:i }));
function drawCloudShape(c, x, y, w, color){
  // one path, one fill: overlapping puffs never darken each other when the colour is translucent
  const h = w*0.36;
  const puff = (cx, cy, r)=>{ c.moveTo(cx + r, cy); c.arc(cx, cy, r, 0, Math.PI*2); };
  c.fillStyle = color;
  c.beginPath();
  puff(x - w*0.28, y, h*0.55);
  puff(x - w*0.02, y - h*0.35, h*0.75);
  puff(x + w*0.26, y - h*0.05, h*0.6);
  puff(x - w*0.42 + h*0.25, y + h*0.25, h*0.25);
  puff(x + w*0.42 - h*0.25, y + h*0.25, h*0.25);
  c.moveTo(x - w*0.42 + h*0.25, y); c.rect(x - w*0.42 + h*0.25, y, w*0.84 - h*0.5, h*0.5);
  c.fill('nonzero');
}
// the inncloud wordmark as a light "sky billboard": faint at first, clearer as the attackers fall
let skyLogo = null;
function buildSkyLogo(){
  const img = $('logoImg'); if (!img || !img.naturalWidth) return null;
  const w = 300, h = w*img.naturalHeight/img.naturalWidth, k = 3;
  const c = document.createElement('canvas'); c.width = w*k; c.height = h*k;
  const o = c.getContext('2d'); o.scale(k,k);
  o.drawImage(img, 0, 0, w, h);
  o.globalCompositeOperation = 'source-in'; o.fillStyle = '#004675'; o.fillRect(0, 0, w, h);
  o.globalCompositeOperation = 'source-over';
  // keep the red dot of the "i" red
  const dk = w/LOGO.nw; o.fillStyle = RED; o.beginPath(); o.arc(LOGO.dotX*dk, LOGO.dotY*dk, LOGO.dotR*dk, 0, Math.PI*2); o.fill();
  return { c, w, h };
}
function logoClarity(){
  if (state === 'title') return 0.16;
  if (!total) return 0.1;
  const gone = 1 - foes.filter(f=>f.alive).length/total;
  const bossPart = boss ? (1 - Math.max(0,boss.hp)/boss.max) : gone;
  const p = boss ? (gone*0.4 + bossPart*0.6) : gone;
  return 0.07 + p*0.38;
}
function drawSkyLogo(){
  if (!skyLogo) skyLogo = buildSkyLogo();
  if (!skyLogo) return;
  const a = logoClarity() * 0.45;   // navy wordmark on a light sky: keep it a soft watermark
  const y = 300 + Math.sin(clock*0.4)*6;
  ctx.globalAlpha = a;
  ctx.drawImage(skyLogo.c, (W - skyLogo.w)/2, y - skyLogo.h/2, skyLogo.w, skyLogo.h);
  ctx.globalAlpha = 1;
}
function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#cfe3f5'); g.addColorStop(0.7,'#e4f0fa'); g.addColorStop(1,'#f2f7fc');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  for (const s of STARS){ ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.3*Math.sin(clock*1.7 + s.p)})`; ctx.fillRect(s.x, s.y, 1.5, 1.5); }
  if (state !== 'intro') drawSkyLogo();
  for (const cl of CLOUDS){
    const sp = [6, 12, 20][cl.d];
    let x = ((cl.x + clock*sp) % (W + cl.w*2)) - cl.w;
    const a = [0.35, 0.48, 0.6][cl.d];
    drawCloudShape(ctx, x, cl.y, cl.w, `rgba(255,255,255,${a})`);
  }
}
function drawSprite(S, fr, x, y, override){
  const m = S.frames[fr];
  for (let r=0;r<m.length;r++) for (let c=0;c<m[r].length;c++){
    const ch = m[r][c]; if (ch === '.') continue;
    ctx.fillStyle = override || (ch==='X' ? S.color : ch==='W' ? '#ffffff' : ch==='G' ? HACK : '#1a1d22');
    ctx.fillRect(x + c*PX, y + r*PX, PX, PX);
  }
}
function drawShip(x, y, a, dotK){
  // the inncloud cloud, with the red dot of the "i" as its cannon; dotK 0..1 = how much of the dot has grown back
  if (dotK === undefined) dotK = 1;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(13,43,69,0.22)'; ctx.beginPath(); ctx.ellipse(0, 14, 22, 3, 0, 0, Math.PI*2); ctx.fill();
  // outline so the white cloud stays visible on the pale sky
  for (const [ox, oy] of [[-2,0],[2,0],[0,-2],[0,2],[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]]) drawCloudShape(ctx, ox, 2+oy, 44, OUTLINE);
  drawCloudShape(ctx, 0, 2, 44, CLOUD);
  ctx.fillStyle = '#cfd4da'; ctx.fillRect(-18, 8, 36, 3);
  if (dotK > 0.05){
    const r = DOT_R*dotK;
    ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(0, -8 - 4*dotK, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-r*0.3, -8 - 4*dotK - r*0.3, r*0.3, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function drawShot(x, y, r){
  ctx.fillStyle = 'rgba(255,59,59,0.35)'; ctx.beginPath(); ctx.arc(x, y+4, r*0.8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = RED_HI; ctx.beginPath(); ctx.arc(x - r*0.3, y - r*0.3, r*0.4, 0, Math.PI*2); ctx.fill();
}
function drawBoss(){
  const b = boss, x = b.x, y = b.y;
  ctx.save(); ctx.translate(x, y);
  const body = b.flash > 0 ? '#c00000' : '#4f6478';
  // shackle
  ctx.strokeStyle = body; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, -8, 20, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = body; roundRect(ctx, -32, -10, 64, 46, 6); ctx.fill();
  ctx.fillStyle = '#1a1d22'; roundRect(ctx, -26, -4, 52, 34, 4); ctx.fill();
  // skull on the lock face
  ctx.fillStyle = HACK;
  const px = 3, skull = ["..XXXXX..",".XXXXXXX.","XX..X..XX","XX..X..XX",".XXXXXXX.","..X.X.X..","..XXXXX.."];
  skull.forEach((row, r)=>[...row].forEach((ch, c)=>{ if (ch==='X') ctx.fillRect(-13.5 + c*px, 0 + r*px, px, px); }));
  ctx.fillStyle = '#ff5d56'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign='center'; ctx.fillText('PAY $', 0, 44);
  ctx.restore();
  // health bar
  ctx.fillStyle = 'rgba(13,43,69,0.15)'; ctx.fillRect(40, 14, W-80, 6);
  ctx.fillStyle = RED_HI; ctx.fillRect(40, 14, (W-80)*(b.hp/b.max), 6);
  ctx.fillStyle = NAVY; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign='center'; ctx.fillText('RANSOMWARE', W/2, 8);
}
function drawParts(){
  for (const p of parts){ ctx.globalAlpha = Math.max(0, Math.min(1, p.t*2)); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
}
function render(){
  ctx.setTransform(dpr*scale, 0, 0, dpr*scale, 0, 0);
  if (state === 'intro' && intro){ renderIntro(); return; }
  drawSky();
  if (state === 'title'){ drawShip(W/2, SHIP_Y, 1); return; }
  // ground line
  ctx.fillStyle = 'rgba(13,43,69,0.25)'; ctx.fillRect(0, SHIP_Y + 20, W, 1);
  // firewalls: little clouds that wear away under the hackers' code
  for (const w of walls){ if (w.dead) continue; ctx.fillStyle = (Math.floor(w.x/4 + w.y/4) % 2) ? '#7f9bb6' : '#9bb3ca'; ctx.fillRect(w.x, w.y, w.s, w.s); }
  // attackers
  for (const f of foes){ if (!f.alive) continue; drawSprite(SPRITES[f.t], frame, f.x+fx, f.y+fy); }
  if (boss && boss.hp > 0) drawBoss();
  if (drone){ const S = { color:'#4f6478', frames:[DRONE, DRONE] }; drawSprite(S, 0, drone.x - 16.5, drone.y - 7.5); }
  // enemy code bullets
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign='center'; ctx.textBaseline='middle';
  for (const b of ebul){ ctx.fillStyle = HACK; ctx.fillText(b.ch, b.x, b.y); ctx.fillStyle='rgba(19,160,74,0.3)'; ctx.fillText(b.ch, b.x, b.y-7); }
  // player shots
  for (const s of shots) drawShot(s.x, s.y, DOT_R);
  // ship
  if (ship.dead <= 0 && !(ship.inv > 0 && Math.floor(clock*14)%2)) drawShip(ship.x, SHIP_Y, 1, state==='play' ? Math.max(0, Math.min(1, 1 - ship.fireCd/ship.fireMax)) : 1);
  drawParts();
  // status
  ctx.textBaseline='middle';
  if (doubleT > 0){ ctx.textAlign='left'; ctx.fillStyle = RED; ctx.font = "7px 'Press Start 2P', monospace"; ctx.fillText('x2 ' + Math.ceil(doubleT), 8, H-14); }
  ctx.textAlign='center';
  toasts.forEach((t, i)=>{ ctx.globalAlpha = Math.min(1, t.t*1.5); ctx.fillStyle = t.color; ctx.font = "8px 'Press Start 2P', monospace"; ctx.fillText(t.text, W/2, 420 - i*16); });
  ctx.globalAlpha = 1;
}
function updateHud(){
  $('score').textContent = score;
  const lv = $('lives'); const n = Math.max(0, lives);
  if (lv.childElementCount !== n){ lv.innerHTML = ''; for (let i=0;i<n;i++){ const d=document.createElement('span'); d.className='life'; lv.appendChild(d); } }
  $('levelName').innerHTML = (state==='title' || state==='intro') ? 'inncloud Invaders' : `<b>Liv. ${lvIndex+1}/${EFG.on ? EFG.max : 5}</b> · ${L.name}`;
}
function drawLegend(){
  const draw = (id, fn)=>{ const c = $(id).getContext('2d'); c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,44,44); fn(c); };
  draw('lgShot', c=>{ c.fillStyle=RED; c.beginPath(); c.arc(22,24,9,0,7); c.fill(); c.fillStyle=RED_HI; c.beginPath(); c.arc(19,21,3.5,0,7); c.fill(); });
  draw('lgBug', c=>{ const m=SPRITES.B.frames[0]; m.forEach((row,r)=>[...row].forEach((ch,col)=>{ if(ch==='.')return; c.fillStyle = ch==='X'?HACK:ch==='W'?'#fff':'#1a1d22'; c.fillRect(5+col*3,8+r*3,3,3); })); });
  draw('lgWall', c=>{ ["....XXXX....","..XXXXXXX.X.",".XXXXXXXXXXX","XXXXXXXXXXXX","XXXXXXXXXXXX",".XXXXXXXXXX."].forEach((row,r)=>[...row].forEach((ch,col)=>{ if(ch==='.')return; c.fillStyle=((col+r)%2)?'#7f9bb6':'#9bb3ca'; c.fillRect(1+col*3.5,12+r*3.5,3.5,3.5); })); });
}

/* ================= LOOP ================= */
let last = 0;
function loop(ts){
  const t = ts/1000; let dt = t - last; last = t;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 1/30);
  if (state !== 'paused') update(dt);
  render();
  requestAnimationFrame(loop);
}
loadLevel(0); fit(); refreshTitle(); refreshSoundBtn(); updateHud(); drawLegend();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLegend);
requestAnimationFrame(ts=>{ last = ts/1000; requestAnimationFrame(loop); });
document.addEventListener('visibilitychange', ()=>{ if (document.hidden && state==='play') togglePause(); });
})();
