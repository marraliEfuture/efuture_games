(function(){
"use strict";

/* ================= EFUTURE GAMES: competition mode =================
   Opened from the Efuture Games app (?hub=1): only 3 levels, at most
   60 seconds of play each. The time used is sent to the app, which
   turns the seconds left out of 180 into the score.                 */
const EFG = { on: /[?&]hub=1\b/.test(location.search), max:3, limit:60, used:0, times:[], livesAt:[], tickT:0, done:false };
function efgPost(m){ try { if (window.parent !== window) window.parent.postMessage(Object.assign({type:'efg'}, m), '*'); } catch(e){} }


/* ================= DATA ================= */
const MAZES = [
 [
  "#############",
  "#o..     ..o#",
  "#.# ##### #.#",
  "#     B     #",
  "# #  #-#  # #",
  "# # #GGG# # #",
  "#.  #####  .#",
  "#.#.     .#.#",
  "#...# P #...#",
  "#o#... ...#o#",
  "#...........#",
  "#############"
 ],
 [
  "#################",
  "#o...       ...o#",
  "#.#### ### ####.#",
  "#..           ..#",
  "# ## # ### # ## #",
  "#    #  B  #    #",
  "# ##   #-#   ## #",
  "# ## ##GGG## ## #",
  "#    #######    #",
  "#.##    P    ##.#",
  "#... ## # ## ...#",
  "#o##.##   ##.##o#",
  "#....## # ##....#",
  "#....... .......#",
  "#################"
 ],
 [
  "###################",
  "#.....       .....#",
  "#.##.# ##### #.##.#",
  "#..  #   #   #  ..#",
  "#### ### # ### ####",
  "#### #   B   # ####",
  "#### # ##-## # ####",
  "       #GGG#       ",
  "#### # ##### # ####",
  "#### #       # ####",
  "####.# ##### #.####",
  "#.....   #   .....#",
  "#.##.### # ###.##.#",
  "#o.#.... P ....#.o#",
  "#....#...#...#....#",
  "#.................#",
  "###################"
 ],
 [
  "###################",
  "#o...............o#",
  "#.###.###.###.###.#",
  "#.#.....#.#.....#.#",
  "#.#.###.....###.#.#",
  "#.................#",
  "####.### # ###.####",
  "####.#   B   #.####",
  "####.# ##-## #.####",
  "    .  #GGG#  .    ",
  "####.# ##### #.####",
  "####.#       #.####",
  "####.# ##### #.####",
  "#.................#",
  "#.###.#.###.#.###.#",
  "#...#.#..P..#.#...#",
  "###.#.#.###.#.#.###",
  "#o....#..#..#....o#",
  "#.###.##.#.##.###.#",
  "#.................#",
  "###################"
 ],
 [
  "###################",
  "#o..#.........#..o#",
  "#.#.#.##.#.##.#.#.#",
  "#.#...#..#..#...#.#",
  "#.###.#.###.#.###.#",
  "#.................#",
  "####.### # ###.####",
  "####.#   B   #.####",
  "####.# ##-## #.####",
  "    .  #GGG#  .    ",
  "####.# ##### #.####",
  "####.#       #.####",
  "####.# ##### #.####",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#o.#.#...P...#.#.o#",
  "##.#.###.#.###.#.##",
  "#....#...#...#....#",
  "#.####.#####.####.#",
  "#.................#",
  "###################"
 ]
];


let COLS = 19, ROWS = 21;          // set per level: mazes grow from level to level
let HOUSE_EXIT = {x:9, y:7};       // tile just above the door (the 'B' in the map)
let HOUSE_IN   = {x:9, y:9};       // centre of the bug house
let TUNNEL_ROW = -1;               // row that wraps around the screen, if any

const LEVELS = [
  { name:"Rete aziendale",  text:"Primo giro di pulizia: due bug lenti e patch lunghe. Prendi confidenza con il labirinto.",
    pac:6.0, bug:3.9, fright:2.4, frightTime:8.0, bugs:2, rand:0.40, release:[0,6],        cycle:[7,18,7,18,5,999] },
  { name:"Server farm",     text:"Arriva un terzo bug. Corridoi più lunghi, occhio agli angoli.",
    pac:6.2, bug:4.4, fright:2.5, frightTime:6.5, bugs:3, rand:0.28, release:[0,4,9],     cycle:[7,20,6,20,5,999] },
  { name:"Cloud ibrido",    text:"Quattro bug in circolazione, ognuno con il suo carattere.",
    pac:6.3, bug:4.9, fright:2.6, frightTime:5.0, bugs:4, rand:0.16, release:[0,3,7,11],  cycle:[6,20,5,20,4,999] },
  { name:"Data center",     text:"I bug sono più svegli e più veloci. La patch dura poco: usala bene.",
    pac:6.0, bug:5.4, fright:2.8, frightTime:3.8, bugs:4, rand:0.08, release:[0,2,4,7],   cycle:[5,22,4,22,3,999] },
  { name:"Core di sistema", text:"Livello finale: bug quasi veloci quanto te e patch lampo. Ripulisci il core!",
    pac:6.2, bug:5.9, fright:3.0, frightTime:2.6, bugs:4, rand:0.03, release:[0,1,2.5,4], cycle:[4,24,3,24,2,999] },
];

const BUGS = [
  { name:"Glitch", color:"#ff5d56", home:{x:18,y:-2} }, // chases you directly
  { name:"Loop",   color:"#ff8ad8", home:{x:0, y:-2} }, // aims ahead of you
  { name:"Leak",   color:"#5ee0ff", home:{x:18,y:22} }, // flanks with Glitch
  { name:"Crash",  color:"#ffae42", home:{x:0, y:22} }, // shy: backs off when close
];

const DIR = {
  left:{x:-1,y:0,a:Math.PI,  n:'left'},
  right:{x:1,y:0,a:0,        n:'right'},
  up:{x:0,y:-1,a:-Math.PI/2, n:'up'},
  down:{x:0,y:1,a:Math.PI/2, n:'down'},
};
const OPP = {left:DIR.right, right:DIR.left, up:DIR.down, down:DIR.up};
const DIR_ORDER = [DIR.up, DIR.left, DIR.down, DIR.right]; // classic tie-break order

const C_BLUE = '#4b8ac9', C_BLUE_L = '#a5c4e4', C_DEEP = '#2f6399';
const COIN = '#ffcf4a';

/* ================= DOM ================= */
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const stage = $('stage');
const ov = { title:$('ov-title'), level:$('ov-level'), clear:$('ov-clear'), over:$('ov-over'), win:$('ov-win'), pause:$('ov-pause') };
function showOnly(o){ for (const k in ov) ov[k].hidden = (ov[k] !== o); }

/* ================= STORAGE ================= */
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v===null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
let best = store.get('coretechPacBest', 0);
let reached = store.get('coretechPacReached', 0); // highest level index unlocked

/* ================= AUDIO (tiny chiptune blips) ================= */
let audioOn = store.get('coretechPacSound', true), actx = null;
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
let wakaFlip = false;
const sfx = {
  coin(){ wakaFlip=!wakaFlip; beep(wakaFlip?520:390, 0.06, 'triangle', 0.06); },
  patch(){ beep(220,0.25,'square',0.05,880); },
  eat(){ beep(300,0.18,'square',0.06,1200); },
  die(){ beep(700,0.9,'sawtooth',0.05,60); },
  clear(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.14,'square',0.05),i*120)); },
  start(){ [392,523,659,523,784].forEach((f,i)=>setTimeout(()=>beep(f,0.12,'square',0.045),i*110)); },
};
function refreshSoundBtn(){ $('soundBtn').textContent = audioOn ? '♪' : '×'; $('soundBtn').style.opacity = audioOn?1:.55; }

/* ================= GAME STATE ================= */
let state = 'title';   // title | levelcard | ready | play | dying | clear | over | win | paused
let prevState = null;
let lvIndex = 0, L = LEVELS[0];
let grid = [];         // chars
let dots = [];         // 0 none, 1 coin, 2 patch
let dotsLeft = 0;
let score = 0, levelStartScore = 0, lives = 3, levelBugsEaten = 0, levelTime = 0;
let player, bugs = [];
let globalMode = 'scatter', modeIdx = 0, modeTimer = 0;
let frightTimer = 0, eatCombo = 0;
let readyTimer = 0, dyingTimer = 0;
let popups = [];
let desired = null;
let mazeLayer = null, T = 20, dpr = 1;
let clock = 0;
let introT = 0, introBites = 0;
const INTRO = { hold:0.7, speed:300, tail:0.7 };           // speed in logo pixels per second
const LOGO_W = 720, LOGO_H = 156, LOGO_C_END = 97, LOGO_C_CX = 48, LOGO_C_R = 76;
const BITES = [150, 245, 310, 380, 455, 505, 585, 675];     // roughly one per letter of "oreTech"
function introDuration(){ return INTRO.hold + (LOGO_W + LOGO_C_R*2 - LOGO_C_CX)/INTRO.speed + INTRO.tail; }
function playIntro(){ state = 'intro'; introT = 0; introBites = 0; showOnly(null); updateHud(); }
function endIntro(){ if (state === 'intro') showLevelCard(0); }

function tileAt(x, y){
  if (y < 0 || y >= ROWS) return '#';
  x = ((x % COLS) + COLS) % COLS;
  return grid[y][x];
}
function passable(x, y, e){
  const ch = tileAt(x, y);
  if (ch === '#') return false;
  if (ch === '-' || ch === 'G'){
    return !!(e && e.isBug && (e.mode==='house' || e.mode==='exit' || e.mode==='eaten'));
  }
  return true;
}

function loadLevel(i){
  lvIndex = i; L = LEVELS[i];
  grid = MAZES[i].map(r => r.split(''));
  ROWS = grid.length; COLS = grid[0].length;
  const bpos = findChar('B'); HOUSE_EXIT = { x:bpos.x, y:bpos.y }; HOUSE_IN = { x:bpos.x, y:bpos.y+2 };
  TUNNEL_ROW = grid.findIndex(r => r[0] !== '#' && r[COLS-1] !== '#');
  BUGS[0].home = {x:COLS-1, y:-2}; BUGS[1].home = {x:0, y:-2}; BUGS[2].home = {x:COLS-1, y:ROWS+1}; BUGS[3].home = {x:0, y:ROWS+1};
  dots = []; dotsLeft = 0;
  for (let y=0;y<ROWS;y++){
    dots[y] = [];
    for (let x=0;x<COLS;x++){
      const ch = grid[y][x];
      dots[y][x] = ch==='.' ? 1 : ch==='o' ? 2 : 0;
      if (dots[y][x]) dotsLeft++;
    }
  }
  levelBugsEaten = 0; levelTime = 0;
  fit();
  resetActors();
}

function findChar(ch){
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) if (MAZES[lvIndex][y][x]===ch) return {x,y};
  return {x:9,y:15};
}

function resetActors(){
  const p = findChar('P');
  player = { x:p.x, y:p.y, dir:DIR.right, moving:true, mouth:0, isBug:false };
  desired = DIR.right;
  bugs = [];
  const hx = HOUSE_EXIT.x, hy = HOUSE_IN.y;
  const starts = [ {x:hx,y:HOUSE_EXIT.y,mode:'scatter',dir:DIR.left}, {x:hx,y:hy,mode:'house',dir:DIR.left}, {x:hx-1,y:hy,mode:'house',dir:DIR.right}, {x:hx+1,y:hy,mode:'house',dir:DIR.left} ];
  for (let i=0;i<L.bugs;i++){
    const s = starts[i];
    bugs.push({ id:i, ...BUGS[i], x:s.x, y:s.y, dir:s.dir, mode:s.mode, isBug:true, release:L.release[i]||0, reverse:false, wob:Math.random()*6 });
  }
  globalMode = 'scatter'; modeIdx = 0; modeTimer = L.cycle[0];
  frightTimer = 0; eatCombo = 0; popups = [];
  readyTimer = 1.8;
}

/* ================= MOVEMENT ================= */
function wrapX(e){ if (e.x < -0.5) e.x += COLS; else if (e.x > COLS-0.5) e.x -= COLS; }

function stepEntity(e, speed, dt, decide){
  let rem = speed*dt, guard = 0;
  while (rem > 1e-6 && guard++ < 8){
    const cx = Math.round(e.x), cy = Math.round(e.y);
    const atCenter = Math.abs(e.x-cx) < 1e-4 && Math.abs(e.y-cy) < 1e-4;
    if (atCenter){
      e.x = cx; e.y = cy; wrapX(e);
      const tx = Math.round(e.x);
      decide(e, tx, cy);
      if (!e.dir || !passable(tx+e.dir.x, cy+e.dir.y, e)){ e.moving = false; return; }
      e.moving = true;
      const step = Math.min(rem, 1);
      e.x += e.dir.x*step; e.y += e.dir.y*step; rem -= step;
      if (step === 1){ e.x = Math.round(e.x); e.y = Math.round(e.y); }
    } else {
      let d;
      if (e.dir.x){ const t = e.dir.x>0 ? Math.floor(e.x)+1 : Math.ceil(e.x)-1; d = Math.abs(t-e.x); }
      else        { const t = e.dir.y>0 ? Math.floor(e.y)+1 : Math.ceil(e.y)-1; d = Math.abs(t-e.y); }
      const step = Math.min(rem, d);
      e.x += e.dir.x*step; e.y += e.dir.y*step; rem -= step;
      if (step === d){ e.x = Math.round(e.x); e.y = Math.round(e.y); }
    }
    wrapX(e);
  }
}

function playerDecide(e, x, y){
  eatAt(x, y);
  if (desired && passable(x+desired.x, y+desired.y, e)) e.dir = desired;
}

function eatAt(x, y){
  x = ((x % COLS) + COLS) % COLS;
  const d = dots[y] && dots[y][x];
  if (!d) return;
  dots[y][x] = 0; dotsLeft--;
  if (d === 1){ score += 10; sfx.coin(); }
  else {
    score += 50; sfx.patch();
    frightTimer = L.frightTime; eatCombo = 0;
    for (const b of bugs){
      if (b.mode==='chase' || b.mode==='scatter' || b.mode==='fright'){ if (b.mode!=='fright') b.reverse = true; b.mode = 'fright'; }
    }
  }
  if (dotsLeft <= 0) levelCleared();
}

function bugTarget(b){
  const px = Math.round(player.x), py = Math.round(player.y), pd = player.dir || DIR.left;
  if (b.mode === 'scatter') return b.home;
  switch (b.id){
    case 0: return {x:px, y:py};
    case 1: return {x:px + pd.x*4, y:py + pd.y*4};
    case 2: {
      const ax = px + pd.x*2, ay = py + pd.y*2, g = bugs[0];
      return g ? {x: ax*2 - Math.round(g.x), y: ay*2 - Math.round(g.y)} : {x:px,y:py};
    }
    case 3: {
      const dx = b.x-px, dy = b.y-py;
      return (dx*dx+dy*dy > 64) ? {x:px, y:py} : b.home;
    }
  }
  return {x:px, y:py};
}

function bugDecide(b, x, y){
  if (b.mode === 'house'){
    if (!passable(x+b.dir.x, y+b.dir.y, b)) b.dir = OPP[b.dir.n];
    return;
  }
  if (b.mode === 'exit' && x===HOUSE_EXIT.x && y===HOUSE_EXIT.y){
    b.mode = globalMode; b.dir = DIR.left;
  }
  if (b.mode === 'eaten'){
    if (x===HOUSE_EXIT.x && y===HOUSE_EXIT.y) b.goingIn = true;
    if (b.goingIn && x===HOUSE_IN.x && y===HOUSE_IN.y){ b.goingIn = false; b.mode = 'exit'; b.dir = DIR.up; return; }
  }
  if (b.reverse){
    b.reverse = false;
    const r = OPP[b.dir.n];
    if (passable(x+r.x, y+r.y, b)){ b.dir = r; return; }
  }
  const opts = DIR_ORDER.filter(d => d !== OPP[b.dir.n] && passable(x+d.x, y+d.y, b));
  if (!opts.length){ b.dir = OPP[b.dir.n]; return; }
  if (b.mode === 'fright' || (b.mode!=='eaten' && b.mode!=='exit' && Math.random() < L.rand)){
    b.dir = opts[Math.floor(Math.random()*opts.length)]; return;
  }
  let target;
  if (b.mode === 'exit') target = HOUSE_EXIT;
  else if (b.mode === 'eaten') target = b.goingIn ? HOUSE_IN : HOUSE_EXIT;
  else target = bugTarget(b);
  let bestD = Infinity, pick = opts[0];
  for (const d of opts){
    const nx = x+d.x, ny = y+d.y, dd = (nx-target.x)**2 + (ny-target.y)**2;
    if (dd < bestD){ bestD = dd; pick = d; }
  }
  b.dir = pick;
}

function bugSpeed(b){
  if (b.mode==='eaten') return 11;
  if (b.mode==='house') return 2.2;
  if (b.mode==='exit') return 3.2;
  const inTunnel = Math.round(b.y)===TUNNEL_ROW && (b.x < 4 || b.x > COLS-5);
  let s = b.mode==='fright' ? L.fright : L.bug;
  // the last few coins make bugs a touch faster, like the arcade
  if (b.mode!=='fright' && dotsLeft < 20) s *= 1.06;
  return inTunnel ? s*0.55 : s;
}

/* ================= UPDATE ================= */
function update(dt){
  clock += dt;
  if (state === 'intro'){
    introT += dt;
    const cx = LOGO_C_CX + Math.max(0, introT - INTRO.hold)*INTRO.speed;
    while (introBites < BITES.length && cx + LOGO_C_R*0.2 >= BITES[introBites]){ introBites++; sfx.coin(); }
    if (introT >= introDuration()) endIntro();
    return;
  }
  if (state === 'ready'){ readyTimer -= dt; if (readyTimer <= 0) state = 'play'; return; }
  if (state === 'dying'){
    dyingTimer -= dt;
    if (dyingTimer <= 0){
      if (lives <= 0){ gameOver(); }
      else { resetActors(); state = 'ready'; }
    }
    return;
  }
  if (state !== 'play') return;
  levelTime += dt;
  if (EFG.on && !EFG.done){
    EFG.tickT -= dt;
    if (EFG.tickT <= 0){ EFG.tickT = 0.25; efgPost({ev:'tick', level:lvIndex+1, max:EFG.max, t:levelTime, used:EFG.used}); }
    if (levelTime >= EFG.limit){ efgEnd(false, 'time'); return; }
  }

  // scatter / chase cycle (paused while patch is active)
  if (frightTimer > 0){
    frightTimer -= dt;
    if (frightTimer <= 0){
      frightTimer = 0;
      for (const b of bugs) if (b.mode==='fright') b.mode = globalMode;
    }
  } else {
    modeTimer -= dt;
    if (modeTimer <= 0){
      modeIdx = Math.min(modeIdx+1, L.cycle.length-1);
      modeTimer = L.cycle[modeIdx];
      globalMode = (modeIdx % 2 === 0) ? 'scatter' : 'chase';
      for (const b of bugs) if (b.mode==='chase' || b.mode==='scatter'){ b.mode = globalMode; b.reverse = true; }
    }
  }

  // player: instant reversal mid-corridor feels responsive on touch
  if (desired && player.dir && desired === OPP[player.dir.n]) player.dir = desired;
  stepEntity(player, L.pac, dt, playerDecide);
  if (state !== 'play') return; // level may have been cleared while eating
  // eat the coin under the player even when passing between centres quickly
  if (player.moving) player.mouth += dt*14;

  for (const b of bugs){
    if (b.mode === 'house'){
      b.release -= dt;
      if (b.release <= 0){ b.mode = 'exit'; }
    }
    stepEntity(b, bugSpeed(b), dt, bugDecide);
    b.wob += dt*10;
  }

  // collisions
  for (const b of bugs){
    const dx = b.x - player.x, dy = b.y - player.y;
    let ddx = dx; if (Math.abs(ddx) > COLS/2) ddx -= Math.sign(ddx)*COLS;
    if (ddx*ddx + dy*dy < 0.45){
      if (b.mode === 'fright'){
        eatCombo++; const pts = 200 * Math.pow(2, eatCombo-1);
        score += pts; levelBugsEaten++;
        popups.push({x:b.x, y:b.y, text:String(pts), t:1});
        b.mode = 'eaten'; b.goingIn = false; sfx.eat();
      } else if (b.mode !== 'eaten'){
        loseLife(); return;
      }
    }
  }
  for (const p of popups) p.t -= dt;
  popups = popups.filter(p => p.t > 0);
  updateHud();
}

function loseLife(){
  lives--; state = 'dying'; dyingTimer = 1.5; sfx.die(); updateHud();
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
  reached = Math.max(reached, Math.min(lvIndex+1, LEVELS.length-1)); store.set('coretechPacReached', reached);
  if (score > best){ best = score; store.set('coretechPacBest', best); }
  updateHud();
  setTimeout(()=>{
    if (lvIndex === LEVELS.length-1){ win(); return; }
    $('clearTitle').textContent = 'Livello ' + (lvIndex+1) + ' completato!';
    $('clearScore').textContent = score;
    $('clearBugs').textContent = levelBugsEaten;
    $('clearTime').textContent = fmt(levelTime);
    showOnly(ov.clear);
  }, 900);
}

function gameOver(){
  if (EFG.on && !EFG.done) efgEnd(false, 'lives');
  state = 'over';
  if (score > best){ best = score; store.set('coretechPacBest', best); }
  $('overScore').textContent = score; $('overLvl').textContent = (lvIndex+1) + '/' + (EFG.on ? EFG.max : 5);
  showOnly(ov.over);
}

function win(){
  state = 'win';
  const isRecord = score >= best;
  if (score > best){ best = score; store.set('coretechPacBest', best); }
  reached = 0; store.set('coretechPacReached', 0);
  $('winScore').textContent = score; $('winBest').textContent = best;
  $('winRecord').textContent = isRecord ? 'Nuovo record!' : 'Record da battere: ' + best;
  showOnly(ov.win);
}

function fmt(s){ s=Math.floor(s); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

/* ================= FLOW ================= */
function showLevelCard(i){
  if (EFG.on) lives = 3;   // gara: 3 vite per ogni livello
  if (EFG.on && i === 0){ EFG.used = 0; EFG.times = []; EFG.livesAt = []; EFG.done = false; efgPost({ev:'start'}); }
  loadLevel(i);
  levelStartScore = score;
  state = 'levelcard';
  $('lvTag').textContent = 'Livello ' + (i+1) + '/' + (EFG.on ? EFG.max : 5);
  $('lvName').textContent = L.name;
  $('lvText').textContent = L.text + ' Bug in gioco: ' + L.bugs + '.';
  showOnly(ov.level); updateHud();
}
function startGame(fromLevel){
  score = 0; lives = 3;
  showLevelCard(fromLevel||0);
}
$('btnStart').onclick = ()=>{ score = 0; lives = 3; playIntro(); };
$('btnContinue').onclick = ()=> startGame(reached);
$('btnGo').onclick = ()=>{ showOnly(null); state = 'ready'; readyTimer = 1.8; sfx.start(); };
$('btnNext').onclick = ()=> showLevelCard(lvIndex+1);
$('btnRetry').onclick = ()=>{ lives = 3; score = levelStartScore; showLevelCard(lvIndex); };
$('btnMenu').onclick = toMenu;
$('btnAgain').onclick = ()=>{ score = 0; lives = 3; playIntro(); };
$('btnResume').onclick = togglePause;
$('btnPauseMenu').onclick = toMenu;
$('pauseBtn').onclick = togglePause;
$('soundBtn').onclick = ()=>{ audioOn = !audioOn; store.set('coretechPacSound', audioOn); refreshSoundBtn(); if (audioOn) beep(660,0.08,'square',0.05); };
function toMenu(){ state = 'title'; refreshTitle(); showOnly(ov.title); updateHud(); }
function togglePause(){
  if (state==='play' || state==='ready'){ prevState = state; state = 'paused'; showOnly(ov.pause); }
  else if (state==='paused'){ state = prevState || 'play'; showOnly(null); }
}
function refreshTitle(){
  if (EFG.on){ setTimeout(()=>{ $('btnContinue').hidden = true; }, 0); }
  $('bestLine').hidden = !(best > 0); $('bestVal').textContent = best;
  $('btnContinue').hidden = !(reached > 0); $('continueLvl').textContent = reached+1;
}

/* ================= INPUT ================= */
function setDesired(d){ desired = d; }
const KEYMAP = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down',A:'left',D:'right',W:'up',S:'down'};
window.addEventListener('keydown', e=>{
  if (state === 'intro'){ e.preventDefault(); endIntro(); return; }
  if (KEYMAP[e.key]){ e.preventDefault(); setDesired(DIR[KEYMAP[e.key]]); }
  else if (e.key==='p' || e.key==='P' || e.key==='Escape') togglePause();
  else if (e.key==='Enter'){
    if (!ov.title.hidden) $('btnStart').click();
    else if (!ov.level.hidden) $('btnGo').click();
    else if (!ov.clear.hidden) $('btnNext').click();
  }
}, {passive:false});

// swipe anywhere on the maze
let sw = null;
stage.addEventListener('pointerdown', e=>{ if (state === 'intro'){ endIntro(); return; } if (e.target.closest('.overlay')) return; sw = {x:e.clientX, y:e.clientY}; });
stage.addEventListener('pointermove', e=>{
  if (!sw) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
  setDesired(Math.abs(dx) > Math.abs(dy) ? (dx>0?DIR.right:DIR.left) : (dy>0?DIR.down:DIR.up));
  sw = {x:e.clientX, y:e.clientY};
});
['pointerup','pointercancel','pointerleave'].forEach(t=>stage.addEventListener(t, ()=>{ sw = null; }));

// d-pad (tap sets the next turn, like a joystick nudge)
[['dUp','up'],['dLeft','left'],['dRight','right'],['dDown','down']].forEach(([id,n])=>{
  const el = $(id);
  el.addEventListener('pointerdown', e=>{ e.preventDefault(); setDesired(DIR[n]); el.classList.add('active'); });
  ['pointerup','pointerleave','pointercancel'].forEach(t=>el.addEventListener(t, ()=>el.classList.remove('active')));
  el.addEventListener('contextmenu', e=>e.preventDefault());
});

/* ================= RENDER ================= */
function fit(){
  const r = stage.getBoundingClientRect();
  const w = r.width - 12, h = r.height - 12;
  T = Math.max(8, Math.floor(Math.min(w/COLS, h/ROWS)));
  dpr = Math.min(window.devicePixelRatio||1, 2.5);
  canvas.style.width = (COLS*T)+'px'; canvas.style.height = (ROWS*T)+'px';
  canvas.width = Math.round(COLS*T*dpr); canvas.height = Math.round(ROWS*T*dpr);
  if (grid.length) buildMazeLayer();
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', ()=>setTimeout(fit, 200));

function isWallCh(ch){ return ch==='#'; }
function buildMazeLayer(){
  const W = COLS*T, H = ROWS*T;
  mazeLayer = document.createElement('canvas');
  mazeLayer.width = Math.round(W*dpr); mazeLayer.height = Math.round(H*dpr);
  const m = mazeLayer.getContext('2d');
  m.setTransform(dpr,0,0,dpr,0,0);
  m.fillStyle = '#060a12'; m.fillRect(0,0,W,H);
  // faint grid, like an old CRT
  m.strokeStyle = 'rgba(75,138,201,0.05)'; m.lineWidth = 1;
  for (let x=0;x<=COLS;x++){ m.beginPath(); m.moveTo(x*T,0); m.lineTo(x*T,H); m.stroke(); }
  for (let y=0;y<=ROWS;y++){ m.beginPath(); m.moveTo(0,y*T); m.lineTo(W,y*T); m.stroke(); }
  // wall masses
  const wall = (x,y)=> y<0||y>=ROWS||x<0||x>=COLS ? true : isWallCh(grid[y][x]);
  const inset = T*0.28;
  m.fillStyle = '#0c1a30';
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++){
    if (!wall(x,y)) continue;
    const l = !wall(x-1,y)?inset:0, r = !wall(x+1,y)?inset:0, t = !wall(x,y-1)?inset:0, b = !wall(x,y+1)?inset:0;
    m.fillRect(x*T+l, y*T+t, T-l-r, T-t-b);
  }
  // neon outline along every wall edge that faces a corridor
  m.strokeStyle = C_BLUE; m.lineWidth = Math.max(1.5, T*0.1); m.lineCap = 'round';
  m.shadowColor = 'rgba(75,138,201,0.7)'; m.shadowBlur = T*0.35;
  m.beginPath();
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++){
    if (!wall(x,y)) continue;
    const X=x*T, Y=y*T;
    const openL = x>0 && !wall(x-1,y), openR = x<COLS-1 && !wall(x+1,y), openT = y>0 && !wall(x,y-1), openB = y<ROWS-1 && !wall(x,y+1);
    const x1 = X + (openL?inset:0), x2 = X+T-(openR?inset:0), y1 = Y+(openT?inset:0), y2 = Y+T-(openB?inset:0);
    if (openT){ m.moveTo(x1, y1); m.lineTo(x2, y1); }
    if (openB){ m.moveTo(x1, y2); m.lineTo(x2, y2); }
    if (openL){ m.moveTo(x1, y1); m.lineTo(x1, y2); }
    if (openR){ m.moveTo(x2, y1); m.lineTo(x2, y2); }
    // connect outline across neighbouring wall tiles
    if (openT && x<COLS-1 && wall(x+1,y) && !wall(x+1,y-1)){ m.moveTo(x2,y1); m.lineTo(X+T,y1); }
    if (openT && x>0 && wall(x-1,y) && !wall(x-1,y-1)){ m.moveTo(X,y1); m.lineTo(x1,y1); }
    if (openB && x<COLS-1 && wall(x+1,y) && !wall(x+1,y+1)){ m.moveTo(x2,y2); m.lineTo(X+T,y2); }
    if (openB && x>0 && wall(x-1,y) && !wall(x-1,y+1)){ m.moveTo(X,y2); m.lineTo(x1,y2); }
    if (openL && y<ROWS-1 && wall(x,y+1) && !wall(x-1,y+1)){ m.moveTo(x1,y2); m.lineTo(x1,Y+T); }
    if (openL && y>0 && wall(x,y-1) && !wall(x-1,y-1)){ m.moveTo(x1,Y); m.lineTo(x1,y1); }
    if (openR && y<ROWS-1 && wall(x,y+1) && !wall(x+1,y+1)){ m.moveTo(x2,y2); m.lineTo(x2,Y+T); }
    if (openR && y>0 && wall(x,y-1) && !wall(x+1,y-1)){ m.moveTo(x2,Y); m.lineTo(x2,y1); }
  }
  m.stroke();
  m.shadowBlur = 0;
  // bug-house door
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) if (grid[y][x]==='-'){
    m.fillStyle = '#ff8ad8'; m.fillRect(x*T+T*0.1, y*T+T*0.42, T*0.8, T*0.16);
  }
}

function drawCoin(c, x, y, s){
  c.fillStyle = COIN;
  c.beginPath(); c.arc(x, y, s, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#b8860b'; c.lineWidth = Math.max(0.8, s*0.35); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.beginPath(); c.arc(x - s*0.3, y - s*0.3, s*0.28, 0, Math.PI*2); c.fill();
}

function drawFloppy(c, x, y, s, t){
  const k = s*(1 + Math.sin(t*6)*0.08);
  c.save(); c.translate(x, y);
  c.shadowColor = 'rgba(165,196,228,0.9)'; c.shadowBlur = k*0.8;
  c.fillStyle = C_BLUE; c.fillRect(-k, -k, k*2, k*2);
  c.shadowBlur = 0;
  c.fillStyle = '#dfe9f5'; c.fillRect(-k*0.55, -k, k*1.1, k*0.7);          // metal shutter
  c.fillStyle = C_BLUE;    c.fillRect(k*0.12, -k*0.9, k*0.22, k*0.5);
  c.fillStyle = '#ffffff'; c.fillRect(-k*0.7, k*0.05, k*1.4, k*0.8);         // label
  c.fillStyle = C_DEEP;    c.fillRect(-k*0.55, k*0.3, k*1.1, k*0.12); c.fillRect(-k*0.55, k*0.55, k*0.8, k*0.12);
  c.restore();
}

function drawC(c, x, y, r, angle, open, color){
  // the CoreTech "C": a thick ring with square ends; the gap is the mouth
  const lw = r*0.62;
  c.save(); c.translate(x, y); c.rotate(angle);
  c.strokeStyle = color || C_BLUE; c.lineWidth = lw; c.lineCap = 'butt';
  c.shadowColor = 'rgba(75,138,201,0.8)'; c.shadowBlur = r*0.5;
  c.beginPath(); c.arc(0, 0, r - lw/2, open, Math.PI*2 - open); c.stroke();
  c.restore();
}

function drawBug(c, b, x, y, s, t){
  const fr = b.mode === 'fright';
  const blinking = fr && frightTimer < 1.6 && Math.floor(t*8) % 2 === 0;
  const body = b.mode==='eaten' ? null : fr ? (blinking ? '#e8eef7' : '#2340a8') : b.color;
  const wob = Math.sin(b.wob)*s*0.08;
  c.save(); c.translate(x, y);
  if (body){
    // legs
    c.strokeStyle = fr ? (blinking?'#9aa9c0':'#1a2f80') : shade(b.color, -0.35); c.lineWidth = Math.max(1, s*0.12); c.lineCap='round';
    for (let i=-1;i<=1;i++){
      const ly = i*s*0.32, sw = (i%2===0?1:-1)*wob;
      c.beginPath(); c.moveTo(-s*0.5, ly); c.lineTo(-s*0.95, ly + s*0.18 + sw); c.stroke();
      c.beginPath(); c.moveTo(s*0.5, ly);  c.lineTo(s*0.95, ly + s*0.18 - sw); c.stroke();
    }
    // antennae
    c.beginPath(); c.moveTo(-s*0.2, -s*0.62); c.lineTo(-s*0.45, -s*1.0 + wob); c.stroke();
    c.beginPath(); c.moveTo(s*0.2, -s*0.62);  c.lineTo(s*0.45, -s*1.0 - wob); c.stroke();
    // body
    c.fillStyle = body;
    c.beginPath(); c.ellipse(0, 0, s*0.62, s*0.72, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(-s*0.62, s*0.05, s*1.24, s*0.1);
  }
  // eyes (look where the bug is going)
  const d = b.dir || DIR.left, ex = d.x*s*0.12, ey = d.y*s*0.12;
  if (fr && body){
    c.fillStyle = blinking ? '#d0302b' : '#ffd9e8';
    c.fillRect(-s*0.3, -s*0.25, s*0.18, s*0.18); c.fillRect(s*0.12, -s*0.25, s*0.18, s*0.18);
    c.strokeStyle = blinking ? '#d0302b' : '#ffd9e8'; c.lineWidth = Math.max(1, s*0.09);
    c.beginPath(); c.moveTo(-s*0.35, s*0.3);
    for (let i=0;i<4;i++) c.lineTo(-s*0.35 + (i+0.5)*s*0.175, s*(i%2?0.3:0.16)), c.lineTo(-s*0.35+(i+1)*s*0.175, s*0.3);
    c.stroke();
  } else {
    for (const sx of [-1,1]){
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(sx*s*0.24, -s*0.18, s*0.19, s*0.23, 0, 0, Math.PI*2); c.fill();
      c.fillStyle = '#10214a'; c.beginPath(); c.arc(sx*s*0.24 + ex, -s*0.18 + ey, s*0.1, 0, Math.PI*2); c.fill();
    }
  }
  c.restore();
}

function shade(hex, f){
  const n = parseInt(hex.slice(1),16); let r=n>>16, g=(n>>8)&255, b=n&255;
  r = Math.round(r*(1+f)); g = Math.round(g*(1+f)); b = Math.round(b*(1+f));
  const cl = v=>Math.max(0,Math.min(255,v));
  return '#'+[cl(r),cl(g),cl(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function renderIntro(){
  const W = COLS*T, H = ROWS*T;
  ctx.fillStyle = '#060a12'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(75,138,201,0.06)'; ctx.lineWidth = 1;
  for (let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*T,0); ctx.lineTo(x*T,H); ctx.stroke(); }
  for (let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*T); ctx.lineTo(W,y*T); ctx.stroke(); }
  const img = $('logoImg');
  const k = (W*0.8)/LOGO_W, x0 = (W - LOGO_W*k)/2, y0 = H*0.44 - LOGO_H*k/2;
  const moving = introT >= INTRO.hold;
  const cx = LOGO_C_CX + Math.max(0, introT - INTRO.hold)*INTRO.speed;   // logo units
  // letters still to be eaten: everything to the right of the C's mouth
  const cut = moving ? Math.max(LOGO_C_END, cx + LOGO_C_R*0.15) : 0;
  if (img && img.complete && img.naturalWidth && cut < LOGO_W){
    const sx = cut * img.naturalWidth/LOGO_W;
    ctx.drawImage(img, sx, 0, img.naturalWidth - sx, img.naturalHeight, x0 + cut*k, y0, (LOGO_W-cut)*k, LOGO_H*k);
  }
  if (moving){
    const open = 0.12*Math.PI + (Math.sin(introT*16)*0.5+0.5)*0.24*Math.PI;
    // hide whatever is inside the C's circle: letters vanish as they enter the mouth
    ctx.fillStyle = '#060a12'; ctx.beginPath(); ctx.arc(x0 + cx*k, y0 + LOGO_H*k*0.49, LOGO_C_R*k*1.02, 0, Math.PI*2); ctx.fill();
    drawC(ctx, x0 + cx*k, y0 + LOGO_H*k*0.49, LOGO_C_R*k, 0, open);
    // crumbs where the last letter was bitten
    ctx.fillStyle = COIN;
    for (let i=0;i<introBites;i++){
      const age = (cx - BITES[i]) / INTRO.speed; if (age > 0.5) continue;
      for (let j=0;j<3;j++){ const a = j*2.1 + i; ctx.globalAlpha = 1-age*2;
        ctx.beginPath(); ctx.arc(x0 + (BITES[i] - 20)*k + Math.cos(a)*age*60*k, y0 + LOGO_H*k*0.5 + Math.sin(a)*age*60*k, Math.max(1.5,T*0.08), 0, Math.PI*2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (cut >= LOGO_W - 1){
    ctx.fillStyle = COIN; ctx.font = `${Math.max(10, T*0.9)}px 'Press Start 2P', monospace`;
    ctx.fillText('PAC', W/2, y0 + LOGO_H*k*0.5);
  }
  ctx.fillStyle = 'rgba(143,165,191,0.8)'; ctx.font = `${Math.max(7, T*0.34)}px 'Press Start 2P', monospace`;
  ctx.fillText('TOCCA PER SALTARE', W/2, H*0.86);
}

function render(){
  if (state === 'intro'){ ctx.setTransform(dpr,0,0,dpr,0,0); renderIntro(); return; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if (mazeLayer) ctx.drawImage(mazeLayer, 0, 0, COLS*T, ROWS*T);
  else { ctx.fillStyle = '#060a12'; ctx.fillRect(0,0,COLS*T,ROWS*T); }
  if (!grid.length) return;
  // coins & patches
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++){
    const d = dots[y][x]; if (!d) continue;
    const cx = (x+0.5)*T, cy = (y+0.5)*T;
    if (d===1) drawCoin(ctx, cx, cy, T*0.12);
    else drawFloppy(ctx, cx, cy, T*0.3, clock + x);
  }
  // player
  const px = (player.x+0.5)*T, py = (player.y+0.5)*T;
  if (state === 'dying'){
    const k = 1 - Math.max(0, dyingTimer-0.3)/1.2;
    const open = 0.25*Math.PI + k*0.75*Math.PI;
    if (open < Math.PI*0.99) drawC(ctx, px, py, T*0.53*(1-k*0.3), player.dir.a - Math.PI/2*0, open);
  } else {
    const open = 0.1*Math.PI + (Math.sin(player.mouth)*0.5+0.5)*0.22*Math.PI;
    drawC(ctx, px, py, T*0.53, (player.dir||DIR.left).a, open);
    if (player.x < 0.5) drawC(ctx, px + COLS*T, py, T*0.53, (player.dir||DIR.left).a, open);
    if (player.x > COLS-1.5) drawC(ctx, px - COLS*T, py, T*0.53, (player.dir||DIR.left).a, open);
  }
  // bugs
  if (state !== 'dying' || dyingTimer > 1.2){
    for (const b of bugs) drawBug(ctx, b, (b.x+0.5)*T, (b.y+0.5)*T, T*0.5, clock);
  }
  // popups
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(7, T*0.38)}px 'Press Start 2P', monospace`;
  for (const p of popups){ ctx.fillStyle = `rgba(255,207,74,${Math.min(1,p.t*1.5)})`; ctx.fillText(p.text, (p.x+0.5)*T, (p.y+0.5)*T - (1-p.t)*T); }
  // READY
  if (state === 'ready'){
    ctx.font = `${Math.max(8, T*0.55)}px 'Press Start 2P', monospace`;
    ctx.fillStyle = COIN; ctx.fillText('PRONTI!', (COLS/2)*T, (HOUSE_IN.y+2.5)*T);
  }
}

function updateHud(){
  $('score').textContent = score;
  const lv = $('lives'); const n = Math.max(0, lives);
  if (lv.childElementCount !== n){ lv.innerHTML = ''; for (let i=0;i<n;i++){ const d=document.createElement('span'); d.className='life'; lv.appendChild(d); } }
  $('levelName').innerHTML = (state==='title') ? 'CoreTech Pac' : `<b>Liv. ${lvIndex+1}/${EFG.on ? EFG.max : 5}</b> · ${L.name}`;
}

/* legend icons on the title card */
function drawLegend(){
  const c1 = $('lgCoin').getContext('2d'); drawCoin(c1, 22, 22, 7);
  const c2 = $('lgBug').getContext('2d'); drawBug(c2, {mode:'chase', color:'#ff5d56', dir:DIR.right, wob:0}, 22, 24, 13, 0);
  const c3 = $('lgPatch').getContext('2d'); drawFloppy(c3, 22, 22, 12, 0);
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

/* ================= BOOT ================= */
loadLevel(0); fit(); refreshTitle(); refreshSoundBtn(); updateHud(); drawLegend();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ buildMazeLayer(); drawLegend(); });
requestAnimationFrame(ts=>{ last = ts/1000; requestAnimationFrame(loop); });
document.addEventListener('visibilitychange', ()=>{ if (document.hidden && (state==='play'||state==='ready')) togglePause(); });
})();
