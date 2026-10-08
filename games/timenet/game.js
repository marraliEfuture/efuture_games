(function(){
"use strict";

/* ================= EFUTURE GAMES: competition mode =================
   Opened from the Efuture Games app (?hub=1): only 3 levels, at most
   60 seconds of play each. The time used is sent to the app, which
   turns the seconds left out of 180 into the score.                 */
const EFG = { on: /[?&]hub=1\b/.test(location.search), max:3, limit:60, used:0, times:[], livesAt:[], tickT:0, done:false };
function efgPost(m){ try { if (window.parent !== window) window.parent.postMessage(Object.assign({type:'efg'}, m), '*'); } catch(e){} }


/* ================= CONSTANTS ================= */
const W = 360, H = 600;                  // logical field
const WATER_Y = 512;                     // sea surface (07/10: alzato, il delfino non tocca più la barra in basso)
const DOLPHIN_TOP = 494;                 // where the ball bounces off the dolphin
let BALL_R = 8;                          // set per level: big ball first, smaller later
let COLS = 12, BW = 28, BH = 14;         // set per level from the map
const BX0 = 12, BY0 = 28;                // 08/10: muro più in alto (era 64), sopra solo la riga dei timer/ora
const HUD_Y = 14;                        // in-canvas power timers + level clock (era 50)
const BIG_BALL = 1.7;                    // ball radius multiplier while TEMPO (T) is active
const TN_DARK = '#195087', TN_LIGHT = '#46a0d2', TN_MID = '#2d74a8', SUN = '#ffcf4a';

// a light 1 hit · b dark 1 hit · g 2 hits · h 3 hits · x steel · o gold (always drops a capsule)
const LEVELS = [
  // the wall always covers the whole logo; 12 blocks at first, then 20, 30, 42, 56
  { clock:"08:00", name:"Apertura", text:"12 blocchi: dietro c'è il logo.",
    speed:430, dw:98, bh:50.0, r:12.5, map:[
    "abba",
    "baob",
    "abba"]},
  { clock:"10:30", name:"Riunione", text:"20 blocchi. I blu medi: 2 colpi.",
    speed:365, dw:92, bh:37.5, r:11, map:[
    "gaaag",
    "abbba",
    "baoab",
    "gaaag"]},
  { clock:"13:00", name:"Pausa pranzo", text:"30 blocchi, angoli da 2 colpi.",
    speed:395, dw:86, bh:30.0, r:9.5, map:[
    "gggggg",
    "gabbag",
    "abooba",
    "gabbag",
    "gggggg"]},
  { clock:"16:00", name:"Scadenza", text:"42 blocchi. Il logo appare alla fine.", revealAtEnd:true,
    speed:435, dw:80, bh:25.0, r:8, map:[
    "ggggggg",
    "ggaaagg",
    "gabbbag",
    "gbbobbg",
    "ggaaagg",
    "ggggggg"]},
  { clock:"18:00", name:"Chiusura", text:"56 blocchi. Ultimo sforzo!", revealAtEnd:true,
    speed:470, dw:74, bh:21.43, r:7, map:[
    "gggggggg",
    "gggggggg",
    "ggabbagg",
    "ggboobgg",
    "ggabbagg",
    "gggggggg",
    "gggggggg"]},
];
const BRICK = {
  a:{hp:1, pts:50,  color:TN_LIGHT},
  b:{hp:1, pts:50,  color:TN_DARK},
  g:{hp:2, pts:100, color:TN_MID},
  h:{hp:3, pts:150, color:'#123a66'},
  x:{hp:Infinity, pts:0, color:'#8a9bb0'},
  o:{hp:1, pts:200, color:SUN},
};
const POWERS = {
  C:{label:'CONNESSI',    note:'3 palloni', color:TN_LIGHT},
  S:{label:'SICURI',      note:'rete', color:TN_DARK},
  V:{label:'SODDISFATTI', note:'delfino grande', color:'#3fbf8f'},
  T:{label:'TEMPO',       note:'pallone grande e lento', color:'#b48cff'},
  L:{label:'+1 PALLONE',  note:'vita extra', color:'#ff5d56'},
};

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
let best = store.get('timenetBreakBest', 0);
let reached = store.get('timenetBreakReached', 0);

/* ================= AUDIO ================= */
let audioOn = store.get('timenetBreakSound', true), actx = null;
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
const sfx = {
  brick(n){ beep(440 + (n%6)*70, 0.07, 'square', 0.05); },
  hard(){ beep(200, 0.06, 'square', 0.05); },
  steel(){ beep(1200, 0.04, 'triangle', 0.04); },
  dolphin(){ beep(660, 0.09, 'sine', 0.07, 990); },
  wall(){ beep(300, 0.03, 'triangle', 0.03); },
  power(){ [660,880,1100].forEach((f,i)=>setTimeout(()=>beep(f,0.08,'square',0.045),i*70)); },
  lost(){ beep(500, 0.6, 'sawtooth', 0.05, 80); },
  clear(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.14,'square',0.05),i*120)); },
  start(){ [392,494,587,784].forEach((f,i)=>setTimeout(()=>beep(f,0.12,'square',0.045),i*110)); },
  splash(){ beep(180, 0.4, 'sawtooth', 0.03, 60); },
};
function refreshSoundBtn(){ $('soundBtn').textContent = audioOn ? '♪' : '×'; $('soundBtn').style.opacity = audioOn?1:.55; }

/* ================= STATE ================= */
let state = 'title', prevState = null;
let lvIndex = 0, L = LEVELS[0];
let bricks = [], breakable = 0;
let balls = [], caps = [], parts = [], toasts = [];
let score = 0, levelStartScore = 0, lives = 3, levelBroken = 0, levelTime = 0;
let dolphin = { x:W/2, w:98, face:1, nod:0, hop:0 };
let bigTimer = 0, slowTimer = 0, net = false, speedMul = 1;
let targetX = null, keyDir = 0;
let clock = 0, scale = 1, dpr = 1;
let intro = null;

let cells = [], revealLayer = null, reveal = null, endRevealAt = null;   // logo panel uncovered as bricks break
function buildReveal(){
  const rows = L.map.length;
  reveal = { x:BX0, y:BY0, w:COLS*BW, h:rows*BH };
  const k = 3;                                   // render the panel at 3x for crisp slices
  revealLayer = document.createElement('canvas');
  revealLayer.width = reveal.w*k; revealLayer.height = reveal.h*k;
  const c = revealLayer.getContext('2d'); c.scale(k, k);
  const img = $('logoImg');
  if (img && img.naturalWidth){
    const pad = 10, maxW = reveal.w - pad*2, maxH = reveal.h - pad*2;
    const s = Math.min(maxW/img.naturalWidth, maxH/img.naturalHeight);
    const lw = img.naturalWidth*s, lh = img.naturalHeight*s;
    c.drawImage(img, (reveal.w-lw)/2, (reveal.h-lh)/2, lw, lh);
    // light theme: the logo keeps its own Timenet blues on the pale field
  }
}
function loadLevel(i){
  lvIndex = i; L = LEVELS[i];
  COLS = L.map[0].length; BW = (W - BX0*2)/COLS; BH = L.bh; BALL_R = L.r;
  bricks = []; breakable = 0;
  L.map.forEach((row, r)=>{
    [...row].forEach((ch, c)=>{
      if (ch === '.') return;
      const k = BRICK[ch];
      bricks.push({ x:BX0 + c*BW, y:BY0 + r*BH, w:BW, h:BH, t:ch, hp:k.hp, max:k.hp, flash:0 });
      if (k.hp !== Infinity) breakable++;
    });
  });
  cells = bricks.filter(b=>b.hp !== Infinity).map(b=>({ x:b.x, y:b.y, w:b.w, h:b.h, open:0 }));
  buildReveal(); endRevealAt = null;
  levelBroken = 0; levelTime = 0;
  bigTimer = 0; slowTimer = 0; net = false; caps = []; parts = []; toasts = [];
  resetBall();
}
function resetBall(){
  speedMul = 1; bigTimer = 0; slowTimer = 0;
  dolphin.x = W/2; dolphin.w = L.dw;
  balls = [{ x:W/2, y:DOLPHIN_TOP-BALL_R, vx:0, vy:0, stuck:true, spin:0, s:1 }];
  caps = [];
}
function rad(b){ return BALL_R * (b.s || 1); }   // current radius of a ball (grows with TEMPO)
function ballSpeed(){ return L.speed * speedMul * (slowTimer>0 ? 0.68 : 1); }
function launch(){
  for (const b of balls){
    if (!b.stuck) continue;
    b.stuck = false;
    const s = ballSpeed(), ang = (Math.random()*0.5 + 0.25) * (dolphin.face>0?1:-1);
    b.vx = Math.sin(ang)*s; b.vy = -Math.cos(ang)*s;
    dolphin.nod = 0.25; sfx.dolphin();
  }
}

/* ================= UPDATE ================= */
function update(dt){
  clock += dt;
  if (state === 'intro'){ updateIntro(dt); return; }
  if (state !== 'play') { updateParts(dt); return; }
  levelTime += dt;
  if (EFG.on && !EFG.done){
    EFG.tickT -= dt;
    if (EFG.tickT <= 0){ EFG.tickT = 0.25; efgPost({ev:'tick', level:lvIndex+1, max:EFG.max, t:levelTime, used:EFG.used}); }
    if (levelTime >= EFG.limit){ efgEnd(false, 'time'); return; }
  }

  // dolphin
  const prevX = dolphin.x;
  const targetW = L.dw * (bigTimer>0 ? 1.4 : 1);
  dolphin.w += (targetW - dolphin.w) * Math.min(1, dt*8);
  if (keyDir) targetX = null, dolphin.x += keyDir * 440 * dt;
  else if (targetX !== null) dolphin.x += (targetX - dolphin.x) * Math.min(1, dt*18);
  dolphin.x = Math.max(dolphin.w/2, Math.min(W - dolphin.w/2, dolphin.x));
  if (Math.abs(dolphin.x - prevX) > 0.4) dolphin.face = dolphin.x > prevX ? 1 : -1;
  dolphin.nod = Math.max(0, dolphin.nod - dt);
  if (bigTimer > 0) bigTimer -= dt;
  if (slowTimer > 0){ slowTimer -= dt; if (slowTimer <= 0) retimeBalls(); }

  // balls
  for (const b of balls){
    growBall(b, dt);
    if (b.stuck){ b.x = dolphin.x + dolphin.face*dolphin.w*0.5; b.y = DOLPHIN_TOP - rad(b) + 2 + Math.sin(clock*6)*1.5; continue; }
    const sp = Math.hypot(b.vx, b.vy), steps = Math.ceil(sp*dt/4);
    const h = dt/steps;
    for (let i=0;i<steps && !b.dead;i++) stepBall(b, h);
    b.spin += (b.vx/rad(b)) * dt;
  }
  const alive = balls.filter(b=>!b.dead);
  if (alive.length === 0){ loseBall(); return; }
  balls = alive;

  // capsules
  for (const c of caps){
    c.y += 130*dt; c.rot += dt*3;
    if (c.y + 9 >= DOLPHIN_TOP && c.y - 9 <= DOLPHIN_TOP + 14 && Math.abs(c.x - dolphin.x) < dolphin.w/2 + 8){ c.dead = true; applyPower(c.k); }
    if (c.y > H + 20) c.dead = true;
  }
  caps = caps.filter(c=>!c.dead);
  for (const br of bricks) if (br.flash>0) br.flash -= dt;
  for (const c of cells) if (c.open > 0 && c.open < 1) c.open = Math.min(1, c.open + dt*3);
  updateParts(dt);
  updateHud();
}

function updateParts(dt){
  for (const p of parts){ p.x += p.vx*dt; p.y += p.vy*dt; p.vy += (p.g||500)*dt; p.t -= dt; }
  parts = parts.filter(p=>p.t>0);
  for (const t of toasts) t.t -= dt;
  toasts = toasts.filter(t=>t.t>0);
}

/* TEMPO makes the ball big (x1.7) as well as slow, so it reads as a bonus.
   The radius changes smoothly, and it only grows where the bigger ball
   fits (walls and bricks): it can never end up stuck inside them.     */
function ballFits(b, r){
  if (b.x - r < 0 || b.x + r > W || b.y - r < 0) return false;
  for (const br of bricks) if (b.x + r > br.x && b.x - r < br.x + br.w && b.y + r > br.y && b.y - r < br.y + br.h) return false;
  return true;
}
function growBall(b, dt){
  const s = b.s || 1, target = slowTimer > 0 ? BIG_BALL : 1;
  if (Math.abs(target - s) < 0.002){ b.s = target; return; }
  let n = s + (target - s) * Math.min(1, dt*7);
  if (Math.abs(target - n) < 0.01) n = target;
  if (n > s && !b.stuck && !ballFits(b, BALL_R*n)) return;   // wait for room before growing
  b.s = n;
}
function stepBall(b, h){
  const R = rad(b);
  b.x += b.vx*h;
  if (b.x - R < 0){ b.x = R; b.vx = Math.abs(b.vx); sfx.wall(); }
  if (b.x + R > W){ b.x = W - R; b.vx = -Math.abs(b.vx); sfx.wall(); }
  if (hitBricks(b, 'x')) return;
  b.y += b.vy*h;
  if (b.y - R < 0){ b.y = R; b.vy = Math.abs(b.vy); sfx.wall(); }
  if (hitBricks(b, 'y')) return;
  // dolphin
  const half = dolphin.w/2;
  if (b.vy > 0 && b.y + R >= DOLPHIN_TOP && b.y + R <= DOLPHIN_TOP + 16 && b.x > dolphin.x - half - R && b.x < dolphin.x + half + R){
    const rel = Math.max(-1, Math.min(1, (b.x - dolphin.x)/half));
    const ang = rel * 1.05;                 // up to ~60° from vertical
    speedMul = Math.min(1.3, speedMul * 1.015);
    const s = ballSpeed();
    b.vx = Math.sin(ang)*s; b.vy = -Math.cos(ang)*s;
    b.y = DOLPHIN_TOP - R;
    dolphin.nod = 0.22; sfx.dolphin();
    return;
  }
  // safety net
  if (net && b.vy > 0 && b.y + R >= H - 18){
    b.y = H - 18 - R; b.vy = -Math.abs(b.vy); net = false;
    toast('Salvato!', TN_DARK); sfx.dolphin();
    return;
  }
  if (b.y - R > H){ b.dead = true; splash(b.x); }
}

function hitBricks(b, axis){
  const R = rad(b);
  for (const br of bricks){
    if (b.x + R <= br.x || b.x - R >= br.x + br.w || b.y + R <= br.y || b.y - R >= br.y + br.h) continue;
    if (axis === 'x'){ if (b.vx > 0) b.x = br.x - R; else b.x = br.x + br.w + R; b.vx = -b.vx; }
    else            { if (b.vy > 0) b.y = br.y - R; else b.y = br.y + br.h + R; b.vy = -b.vy; }
    // never let the ball settle into an almost-horizontal path
    const s = Math.hypot(b.vx, b.vy);
    if (Math.abs(b.vy) < s*0.3){ b.vy = Math.sign(b.vy||-1)*s*0.3; b.vx = Math.sign(b.vx)*Math.sqrt(s*s - b.vy*b.vy); }
    damage(br);
    return true;
  }
  return false;
}

function damage(br){
  br.flash = 0.12;
  if (br.hp === Infinity){ sfx.steel(); return; }
  br.hp--;
  if (br.hp > 0){ sfx.hard(); score += 10; return; }
  score += BRICK[br.t].pts; levelBroken++; breakable--;
  sfx.brick(levelBroken);
  burst(br.x + br.w/2, br.y + br.h/2, BRICK[br.t].color, 10);
  bricks.splice(bricks.indexOf(br), 1);
  for (const c of cells) if (c.x === br.x && c.y === br.y && !c.open) c.open = 0.001;
  if (br.t === 'o' || Math.random() < 0.09) dropCapsule(br.x + br.w/2, br.y + br.h/2);
  if (breakable <= 0) levelCleared();
}

function dropCapsule(x, y){
  const r = Math.random();
  const k = r < 0.05 ? 'L' : r < 0.32 ? 'C' : r < 0.56 ? 'S' : r < 0.8 ? 'V' : 'T';
  caps.push({ x, y, k, rot:0 });
}

function applyPower(k){
  sfx.power(); toast(POWERS[k].label + ' · ' + POWERS[k].note, POWERS[k].color);
  score += 100;
  if (k === 'C'){
    const add = [];
    for (const b of balls.slice(0,3)){
      if (b.stuck) continue;
      const s = Math.hypot(b.vx, b.vy);
      for (const d of [-0.45, 0.45]){
        const a = Math.atan2(b.vx, -b.vy) + d;
        add.push({ x:b.x, y:b.y, vx:Math.sin(a)*s, vy:-Math.abs(Math.cos(a)*s), stuck:false, spin:0, s:b.s||1 });
      }
    }
    if (!add.length){ launch(); return applyPower('C'); }
    balls.push(...add);
  } else if (k === 'S'){ net = true; }
  else if (k === 'V'){ bigTimer = 15; }
  else if (k === 'T'){ slowTimer = 10; retimeBalls(); }
  else if (k === 'L'){ lives = Math.min(EFG.on ? 3 : 6, lives+1); }
}
function retimeBalls(){
  const s = ballSpeed();
  for (const b of balls){ if (b.stuck) continue; const c = Math.hypot(b.vx,b.vy)||1; b.vx *= s/c; b.vy *= s/c; }
}

function toast(text, color){ toasts.push({ text, color, t:2.2 }); }
function burst(x, y, color, n){
  for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, v = 60 + Math.random()*140;
    parts.push({ x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v - 60, t:0.5 + Math.random()*0.3, c:color, s:2 + Math.random()*2 }); }
}
function splash(x){
  sfx.splash();
  for (let i=0;i<14;i++){ const a = -Math.PI/2 + (Math.random()-0.5)*1.4, v = 120 + Math.random()*160;
    parts.push({ x, y:WATER_Y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, t:0.7, c:'#7cc0e6', s:2.5 }); }
}

function loseBall(){
  lives--; sfx.lost(); updateHud();
  if (lives <= 0){ gameOver(); return; }
  resetBall(); toast('Tocca per rilanciare', '#0d2b45');
}

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
  if (L.revealAtEnd) endRevealAt = clock;
  reached = Math.max(reached, Math.min(lvIndex+1, LEVELS.length-1)); store.set('timenetBreakReached', reached);
  if (score > best){ best = score; store.set('timenetBreakBest', best); }
  updateHud();
  const doneIdx = lvIndex;
  setTimeout(()=>{
    if (state !== 'clear' || lvIndex !== doneIdx) return;
    if (lvIndex === LEVELS.length-1){ win(); return; }
    $('clearTitle').textContent = 'Ore ' + L.clock + ' completate!';
    $('clearScore').textContent = score; $('clearBugs').textContent = levelBroken; $('clearTime').textContent = fmt(levelTime);
    showOnly(ov.clear);
  }, L.revealAtEnd ? 1900 : 900);
}
function gameOver(){
  if (EFG.on && !EFG.done) efgEnd(false, 'lives');
  state = 'over';
  if (score > best){ best = score; store.set('timenetBreakBest', best); }
  $('overScore').textContent = score; $('overLvl').textContent = (lvIndex+1) + '/' + (EFG.on ? EFG.max : 5);
  showOnly(ov.over);
}
function win(){
  state = 'win';
  const isRecord = score >= best;
  if (score > best){ best = score; store.set('timenetBreakBest', best); }
  reached = 0; store.set('timenetBreakReached', 0);
  $('winScore').textContent = score; $('winBest').textContent = best;
  $('winRecord').textContent = isRecord ? 'Nuovo record!' : 'Record da battere: ' + best;
  showOnly(ov.win);
}
function fmt(s){ s=Math.floor(s); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

/* ================= INTRO: the dolphin breaks the logo ================= */
function playIntro(){
  state = 'intro'; showOnly(null); updateHud();
  intro = { t:0, hit:false, ball:null, logoParts:null };
}
function endIntro(){ if (state === 'intro'){ intro = null; parts = []; showLevelCard(0); } }
const LOGO_BOX = { w:300, x:(W-300)/2, y:150 };
function logoH(){ const img = $('logoImg'); return img && img.naturalWidth ? LOGO_BOX.w * img.naturalHeight/img.naturalWidth : 107; }
function updateIntro(dt){
  const I = intro; I.t += dt;
  // 0.0-0.8 logo alone · 0.8-1.7 dolphin leaps · at 1.25 throws the ball · ball hits the logo · shatter · end at 4.2
  if (I.t > 1.25 && !I.ball && !I.hit){ I.ball = { x:W/2 - 10, y:430, vx:20, vy:-620, spin:0 }; sfx.dolphin(); }
  if (I.ball){
    I.ball.x += I.ball.vx*dt; I.ball.y += I.ball.vy*dt; I.ball.spin += dt*8;
    if (!I.hit && I.ball.y < LOGO_BOX.y + logoH()*0.7){ I.hit = true; shatterLogo(I.ball.x, I.ball.y); I.ball.vy = 380; I.ball.vx = -60; sfx.brick(3); }
    if (I.ball.y > H + 20) I.ball = null;
  }
  if (I.t > 1.7 && !I.splashed){ I.splashed = true; splash(W/2 + 40); }
  updateParts(dt);
  if (I.t > 4.2) endIntro();
}
function shatterLogo(hx, hy){
  const img = $('logoImg'); if (!img || !img.naturalWidth) return;
  const w = LOGO_BOX.w, h = Math.round(logoH());
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const o = off.getContext('2d'); o.drawImage(img, 0, 0, w, h);
  let data; try { data = o.getImageData(0,0,w,h).data; } catch(e){ return; }
  const cell = 5;
  for (let y=0;y<h;y+=cell) for (let x=0;x<w;x+=cell){
    const i = ((y+2)*w + (x+2))*4; if (data[i+3] < 120) continue;
    const px = LOGO_BOX.x + x, py = LOGO_BOX.y + y;
    const dx = px - hx, dy = py - hy, d = Math.hypot(dx,dy)+1;
    const v = 80 + 9000/(d+40);
    parts.push({ x:px, y:py, vx:dx/d*v + (Math.random()-0.5)*40, vy:dy/d*v - 120 - Math.random()*80, g:520, t:1.6 + Math.random()*0.8,
                 c:`rgb(${data[i]},${data[i+1]},${data[i+2]})`, s:cell-0.5, sq:true });
  }
}
function renderIntro(){
  const I = intro;
  drawSea();
  const img = $('logoImg'), lh = logoH();
  if (!I.hit){
    // logo on its light badge, as it appears on paper
    const pad = 14;
    ctx.fillStyle = '#ffffff'; roundRect(ctx, LOGO_BOX.x - pad, LOGO_BOX.y - pad, LOGO_BOX.w + pad*2, lh + pad*2, 12); ctx.fill();
    ctx.strokeStyle = '#cddcea'; ctx.lineWidth = 1; ctx.stroke();
    if (img && img.naturalWidth) ctx.drawImage(img, LOGO_BOX.x, LOGO_BOX.y, LOGO_BOX.w, lh);
  }
  drawParts();
  // dolphin leap: arc out of the water and back
  const lt = (I.t - 0.8)/0.9;
  if (lt > 0 && lt < 1){
    const x = W/2 - 90 + lt*180, y = WATER_Y + 10 - Math.sin(lt*Math.PI)*170, rot = (lt-0.5)*1.6;
    drawDolphin(x, y, 110, 1, rot);
  } else {
    drawDolphin(W/2, WATER_Y - 2 + Math.sin(clock*3)*2, 98, 1, 0, lt >= 1 ? 0 : -0.2);
  }
  if (I.ball) drawBeachBall(I.ball.x, I.ball.y, BALL_R+1, I.ball.spin);
  if (I.hit && I.t > 2.6){
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = TN_DARK; ctx.font = "16px 'Press Start 2P', monospace"; ctx.fillText('BREAKOUT', W/2, 220);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign='center';
  ctx.fillText('TOCCA PER SALTARE', W/2, H - 14);
}

/* ================= FLOW ================= */
function showLevelCard(i){
  if (EFG.on) lives = 3;   // gara: 3 vite per ogni livello
  if (EFG.on && i === 0){ EFG.used = 0; EFG.times = []; EFG.livesAt = []; EFG.done = false; efgPost({ev:'start'}); }
  loadLevel(i); levelStartScore = score;
  state = 'levelcard';
  $('lvTag').textContent = L.clock + ' · Livello ' + (i+1) + '/' + (EFG.on ? EFG.max : 5);
  $('lvName').textContent = L.name;
  $('lvText').textContent = L.text;
  showOnly(ov.level); updateHud();
}
function startGame(from){ score = 0; lives = 3; showLevelCard(from||0); }
$('btnStart').onclick = ()=>{ score = 0; lives = 3; playIntro(); };
$('btnContinue').onclick = ()=> startGame(reached);
$('btnGo').onclick = ()=>{ showOnly(null); state = 'play'; sfx.start(); toast('Tocca per lanciare', '#0d2b45'); };
$('btnNext').onclick = ()=> showLevelCard(lvIndex+1);
$('btnRetry').onclick = ()=>{ lives = 3; score = levelStartScore; showLevelCard(lvIndex); };
$('btnMenu').onclick = toMenu;
$('btnAgain').onclick = ()=>{ score = 0; lives = 3; playIntro(); };
$('btnResume').onclick = togglePause;
$('btnPauseMenu').onclick = toMenu;
$('pauseBtn').onclick = togglePause;
$('soundBtn').onclick = ()=>{ audioOn = !audioOn; store.set('timenetBreakSound', audioOn); refreshSoundBtn(); if (audioOn) beep(660,0.08,'square',0.05); };
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
let drag = null;
function onDown(e){
  if (state === 'intro'){ endIntro(); return; }
  if (e.target.closest && e.target.closest('.overlay')) return;
  if (state !== 'play') return;
  drag = { sx:e.clientX, sy:e.clientY, moved:false, startDolphin:dolphin.x, strip: e.currentTarget.id === 'controls' };
  if (!drag.strip) targetX = fieldX(e.clientX);
}
function onMove(e){
  if (state !== 'play') return;
  if (e.pointerType === 'mouse' && !drag){ targetX = fieldX(e.clientX); return; }
  if (!drag) return;
  if (Math.abs(e.clientX - drag.sx) > 8) drag.moved = true;
  if (drag.strip){
    // the strip works like a trackpad: finger movement moves the dolphin
    const r = canvas.getBoundingClientRect();
    targetX = drag.startDolphin + (e.clientX - drag.sx) / r.width * W * 1.3;
  } else targetX = fieldX(e.clientX);
}
function onUp(){
  if (drag && !drag.moved) launch();
  drag = null;
}
stage.addEventListener('pointerdown', onDown);
$('controls').addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', ()=>{ drag = null; });

const keys = {};
window.addEventListener('keydown', e=>{
  if (state === 'intro'){ e.preventDefault(); endIntro(); return; }
  if (['ArrowLeft','ArrowRight',' ','a','d','A','D'].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if (e.key === ' ' && state === 'play') launch();
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

const STARS = Array.from({length:40}, (_,i)=>({ x:(i*97)%W, y:(i*53)%300 + 8, p:i*0.7 }));
function drawReveal(){
  if (!revealLayer || L.revealAtEnd) return;       // levels 4-5 keep the logo hidden until the end
  const k = revealLayer.width / reveal.w;
  for (const c of cells){
    if (!c.open) continue;
    ctx.globalAlpha = c.open;
    ctx.drawImage(revealLayer, (c.x-reveal.x)*k, (c.y-reveal.y)*k, c.w*k, c.h*k, c.x, c.y, c.w, c.h);
  }
  ctx.globalAlpha = 1;
}
function drawEndReveal(){
  if (!revealLayer || !L.revealAtEnd || endRevealAt === null) return;
  ctx.globalAlpha = Math.min(1, (clock - endRevealAt)/0.7);
  ctx.drawImage(revealLayer, reveal.x, reveal.y, reveal.w, reveal.h);
  ctx.globalAlpha = 1;
}
function drawSea(){
  const g = ctx.createLinearGradient(0,0,0,WATER_Y);
  g.addColorStop(0,'#f7fbfe'); g.addColorStop(1,'#d5e8f5');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,WATER_Y);
  for (const s of STARS){ ctx.fillStyle = `rgba(70,160,210,${0.12 + 0.1*Math.sin(clock*2 + s.p)})`; ctx.fillRect(s.x, s.y, 2, 2); }
  // sun setting on the horizon, 80s style
  const sg = ctx.createLinearGradient(0, WATER_Y-70, 0, WATER_Y);
  sg.addColorStop(0,'rgba(241,140,34,0.0)'); sg.addColorStop(1,'rgba(241,140,34,0.14)');
  ctx.fillStyle = sg; ctx.fillRect(0, WATER_Y-70, W, 70);
  // water
  const wg = ctx.createLinearGradient(0,WATER_Y,0,H);
  wg.addColorStop(0, TN_MID); wg.addColorStop(1, TN_DARK);
  ctx.fillStyle = wg; ctx.fillRect(0, WATER_Y, W, H-WATER_Y);
  ctx.strokeStyle = 'rgba(191,230,247,0.5)'; ctx.lineWidth = 1.5;
  for (let row=0; row<3; row++){
    ctx.beginPath();
    for (let x=0; x<=W; x+=6){ const y = WATER_Y + 4 + row*14 + Math.sin(x*0.06 + clock*(2+row) + row)*2; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke(); ctx.strokeStyle = `rgba(191,230,247,${0.3-row*0.08})`;
  }
  if (net){
    ctx.strokeStyle = 'rgba(191,230,247,0.85)'; ctx.lineWidth = 1;
    for (let x=0; x<W; x+=10){ ctx.beginPath(); ctx.moveTo(x, H-22); ctx.lineTo(x+10, H-12); ctx.moveTo(x+10, H-22); ctx.lineTo(x, H-12); ctx.stroke(); }
    ctx.fillStyle = TN_LIGHT; ctx.fillRect(0, H-23, W, 2);
  }
}

function drawBrick(br){
  const k = BRICK[br.t];
  let col = k.color;
  ctx.fillStyle = br.flash > 0 ? '#ffffff' : col;
  ctx.fillRect(br.x+1, br.y+1, br.w-2, br.h-2);
  ctx.strokeStyle = 'rgba(13,43,69,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(br.x+1.5, br.y+1.5, br.w-3, br.h-3);
  if (br.t === 'b' || br.t === 'h'){ ctx.strokeStyle = 'rgba(159,211,239,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(br.x+1.5, br.y+1.5, br.w-3, br.h-3); }
  // bevel, like an old arcade tile
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(br.x+1, br.y+1, br.w-2, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(br.x+1, br.y+br.h-3, br.w-2, 2);
  if (br.t === 'x'){ ctx.fillStyle='#5b6b80'; const ry = br.y + br.h/2 - 1; ctx.fillRect(br.x+4, ry, 2, 2); ctx.fillRect(br.x+br.w-6, ry, 2, 2); }
  if (br.max > 1 && br.max !== Infinity){
    // cracks show remaining hits
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
    const hits = br.max - br.hp;
    const X = f=>br.x + br.w*f, Y = f=>br.y + br.h*f;
    if (hits >= 1){ ctx.beginPath(); ctx.moveTo(X(.28), Y(.15)); ctx.lineTo(X(.42), Y(.57)); ctx.lineTo(X(.32), Y(.86)); ctx.stroke(); }
    if (hits >= 2){ ctx.beginPath(); ctx.moveTo(X(.72), Y(.2)); ctx.lineTo(X(.6), Y(.64)); ctx.lineTo(X(.78), Y(.86)); ctx.stroke(); }
  }
  if (br.t === 'o'){ ctx.fillStyle = '#7a5a00'; ctx.font = Math.round(br.h*0.5) + "px 'Press Start 2P', monospace"; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★', br.x+br.w/2, br.y+br.h/2+1); }
}

function drawBeachBall(x, y, r, spin){
  const cols = ['#ffffff', TN_LIGHT, SUN, '#ffffff', TN_DARK, '#ff5d56'];
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  for (let i=0;i<6;i++){ ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,i*Math.PI/3,(i+1)*Math.PI/3); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x, y, r*0.22, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(13,43,69,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x - r*0.4, y - r*0.45, r*0.22, 0, Math.PI*2); ctx.fill();
}

// an original, cartoon blue dolphin; drawn facing right, mirrored for left
/* delfino Timenet (immagine fornita); finché non è caricata si usa il disegno vettoriale */
const DOLPHIN_IMG = new Image(); let dolphinImgOk = false;
DOLPHIN_IMG.onload = ()=>{ dolphinImgOk = true; }; DOLPHIN_IMG.src = 'img/delfino.png';
function drawDolphin(x, y, w, face, rot, nod){
  if (dolphinImgOk && DOLPHIN_IMG.naturalWidth){
    const dw = w*0.92, dh = dw * DOLPHIN_IMG.naturalHeight / DOLPHIN_IMG.naturalWidth;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot||0);
    ctx.scale(-face, 1);                       // l'immagine guarda a sinistra
    ctx.rotate((nod||0)*0.6);
    ctx.shadowColor = 'rgba(13,43,69,0.55)'; ctx.shadowBlur = 4;
    ctx.drawImage(DOLPHIN_IMG, -dw/2, -dh*0.42, dw, dh);
    ctx.restore();
    return;
  }
  const s = w/100;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot||0); ctx.scale(face*s, s);
  ctx.rotate(-(nod||0)*0.6);
  // tail flukes
  ctx.fillStyle = TN_DARK;
  ctx.beginPath(); ctx.moveTo(-40, 2); ctx.quadraticCurveTo(-54, -12, -62, -16); ctx.quadraticCurveTo(-56, 0, -60, 16); ctx.quadraticCurveTo(-52, 10, -40, 8); ctx.closePath(); ctx.fill();
  // dorsal fin
  ctx.beginPath(); ctx.moveTo(-8, -14); ctx.quadraticCurveTo(0, -34, 10, -34); ctx.quadraticCurveTo(4, -24, 10, -13); ctx.closePath(); ctx.fill();
  // body
  const bg = ctx.createLinearGradient(0, -18, 0, 16);
  bg.addColorStop(0, TN_MID); bg.addColorStop(0.55, TN_LIGHT); bg.addColorStop(1, '#bfe6f7');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-44, 4);
  ctx.bezierCurveTo(-30, -20, 10, -22, 30, -12);   // back
  ctx.quadraticCurveTo(40, -8, 44, -2);             // forehead (melon)
  ctx.quadraticCurveTo(54, -1, 60, 2);              // beak top
  ctx.quadraticCurveTo(58, 7, 44, 7);               // beak underside
  ctx.bezierCurveTo(24, 16, -20, 16, -44, 4);       // belly
  ctx.closePath(); ctx.fill();
  // belly highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(-20, 9); ctx.quadraticCurveTo(10, 15, 40, 7); ctx.quadraticCurveTo(10, 11, -20, 9); ctx.fill();
  // flipper
  ctx.fillStyle = TN_DARK;
  ctx.beginPath(); ctx.moveTo(6, 8); ctx.quadraticCurveTo(0, 20, -8, 24); ctx.quadraticCurveTo(0, 14, -2, 8); ctx.closePath(); ctx.fill();
  // eye + smile
  ctx.fillStyle = '#0b1d38'; ctx.beginPath(); ctx.arc(36, -4, 2.6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(36.8, -4.8, 0.9, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#0b1d38'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(46, 4); ctx.quadraticCurveTo(52, 6, 58, 3); ctx.stroke();
  ctx.restore();
}

function drawCapsule(c){
  const P = POWERS[c.k];
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.fillStyle = P.color; roundRect(ctx, -13, -7, 26, 14, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(13,43,69,0.45)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, -11, -6, 22, 4, 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(c.k==='V' ? '✓' : c.k==='L' ? '+' : c.k, 0, 1);
  ctx.restore();
}

function drawParts(){
  for (const p of parts){
    ctx.globalAlpha = Math.max(0, Math.min(1, p.t*1.6));
    ctx.fillStyle = p.c;
    if (p.sq) ctx.fillRect(p.x, p.y, p.s, p.s);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI*2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function render(){
  ctx.setTransform(dpr*scale, 0, 0, dpr*scale, 0, 0);
  if (state === 'intro' && intro){ renderIntro(); return; }
  drawSea();
  if (state === 'title'){ drawDolphin(W/2, WATER_Y - 2 + Math.sin(clock*3)*2, 98, 1, 0); return; }
  drawReveal();
  for (const br of bricks) drawBrick(br);
  drawEndReveal();
  for (const c of caps) drawCapsule(c);
  // dolphin bobbing in the water
  const bob = Math.sin(clock*3)*1.5;
  drawDolphin(dolphin.x, WATER_Y - 4 + bob, dolphin.w*1.12, dolphin.face, 0, dolphin.nod);
  for (const b of balls){
    const R = rad(b), g = (R/BALL_R - 1) / (BIG_BALL - 1);   // 0 normal .. 1 fully big
    if (g > 0.02){
      // soft violet halo (the TEMPO colour): the big ball is a bonus
      const hr = R * (1.55 + 0.1*Math.sin(clock*8));
      const hg = ctx.createRadialGradient(b.x, b.y, R*0.8, b.x, b.y, hr);
      hg.addColorStop(0, `rgba(180,140,255,${0.55*g})`); hg.addColorStop(1, 'rgba(180,140,255,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(b.x, b.y, hr, 0, Math.PI*2); ctx.fill();
    }
    drawBeachBall(b.x, b.y, R, b.spin);
  }
  drawParts();
  // timers for active powers
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = "7px 'Press Start 2P', monospace";
  let tx = 8;
  if (bigTimer > 0){ ctx.fillStyle = '#1f8a63'; ctx.fillText('✓ ' + Math.ceil(bigTimer), tx, HUD_Y); tx += 46; }
  if (slowTimer > 0){ ctx.fillStyle = '#7a4fd6'; ctx.fillText('T ' + Math.ceil(slowTimer), tx, HUD_Y); tx += 46; }
  if (net){ ctx.fillStyle = TN_DARK; ctx.fillText('S rete', tx, HUD_Y); }
  // clock of the level, top right
  ctx.textAlign = 'right'; ctx.fillStyle = '#56718a'; ctx.fillText(L.clock, W-8, HUD_Y);
  // toasts
  ctx.textAlign = 'center';
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.lineJoin = 'round';
  toasts.forEach((t, i)=>{ ctx.globalAlpha = Math.min(1, t.t*1.5); const y = 430 - i*16;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4; ctx.strokeText(t.text, W/2, y);
    ctx.fillStyle = t.color; ctx.fillText(t.text, W/2, y); });
  ctx.globalAlpha = 1;
}

function updateHud(){
  $('score').textContent = score;
  const lv = $('lives'); const n = Math.max(0, lives);
  if (lv.childElementCount !== n){ lv.innerHTML = ''; for (let i=0;i<n;i++){ const d=document.createElement('span'); d.className='life'; lv.appendChild(d); } }
  $('levelName').innerHTML = (state==='title' || state==='intro') ? 'Timenet Breakout' : `<b>${L.clock}</b> · ${L.name}`;
}

function drawLegend(){
  const save = [ctx, scale];
  const draw = (id, fn)=>{ const c = $(id).getContext('2d'); c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,44,44); fn(c); };
  draw('lgBrick', c=>{ c.fillStyle=TN_LIGHT; c.fillRect(4,8,36,12); c.fillStyle=TN_DARK; c.fillRect(4,24,36,12); c.fillStyle='rgba(255,255,255,.3)'; c.fillRect(4,8,36,2); c.fillRect(4,24,36,2); });
  draw('lgBall', c=>{ const cols=['#fff',TN_LIGHT,SUN,'#fff',TN_DARK,'#ff5d56']; for(let i=0;i<6;i++){ c.fillStyle=cols[i]; c.beginPath(); c.moveTo(22,22); c.arc(22,22,15,i*Math.PI/3,(i+1)*Math.PI/3); c.fill(); } c.fillStyle='#fff'; c.beginPath(); c.arc(22,22,3.5,0,7); c.fill(); });
  draw('lgPow', c=>{ c.fillStyle=TN_LIGHT; roundRect(c,4,13,36,18,9); c.fill(); c.fillStyle='#fff'; c.font="11px 'Press Start 2P', monospace"; c.textAlign='center'; c.textBaseline='middle'; c.fillText('C',22,23); });
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
