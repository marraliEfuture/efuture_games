/* Efuture Games - "console portatile" in verticale (vedi gameboy.css).
   Aggiunge solo le parti decorative (led, scritta, griglia altoparlante) e i due
   tastini centrali MODE / AVVIA-PAUSA; in verticale sposta i tasti indicati
   (data-a / data-b) nella coppia A/B e li rimette al loro posto in orizzontale.
   Non tocca la logica dei giochi: i tastini premono i pulsanti che esistono già.
   Attributi dello <script>:
     data-a, data-b   id dei pulsanti da usare come A e B (facoltativi)
     data-select      id del pulsante "Istruzioni" (non più usato dai tastini)
     data-pause       id del pulsante pausa
     data-primary     selettore del pulsante principale dentro un overlay visibile
     data-paused      id dell'overlay di pausa */
(function(){
  var s = document.currentScript, d = (s && s.dataset) || {}, doc = document;
  /* stili delle visualizzazioni (sempre attivi, anche quando gameboy.css è spento) */
  var VIEW_CSS = [
    'html:not([data-view=game]) .gb-top,html:not([data-view=game]) .gb-brand,html:not([data-view=game]) .gb-grille,html:not([data-view=game]) .gb-pills,html:not([data-view=game]) .gb-ab{display:none!important}',
    '.gb-view{flex:0 0 auto;width:32px;height:32px;margin:0;padding:0;border-radius:8px;border:1px solid var(--line,#cddcea);background:var(--panel-2,#f2f7fc);color:var(--text,#0d2b45);font:15px/1 system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
    '.gb-view:active{transform:translateY(1px)}',
    '.gb-viewtoast{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translate(-50%,-8px);z-index:60;padding:7px 14px;border-radius:999px;background:#0d2b45;color:#fff;font:600 12px/1.3 "IBM Plex Mono",ui-monospace,monospace;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}',
    '.gb-viewtoast.on{opacity:1;transform:translate(-50%,0)}',
    /* in verticale con la scocca il cambio di visualizzazione è sul tastino MODE */
    '@media (orientation:portrait){html[data-view=game] .gb-view{display:none}}',
    /* tempo della gara (lo manda l\'app): nell\'angolo dello schermo, o nella riga della scocca */
    '.gb-clock{font:10px/1 "Press Start 2P","IBM Plex Mono",monospace;color:#ffb04a;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.gb-clock.warn{color:#ff5d56}',
    '.gb-clock:empty{display:none}',
    '#stage>.gb-clock{position:absolute;top:6px;left:6px;z-index:4;padding:6px 10px;border-radius:999px;background:rgba(13,43,69,.85);box-shadow:0 2px 6px rgba(0,0,0,.25);pointer-events:none}',
    /* in gara un solo timer: quello alla rovescia dell'app (il contatore di Efuture Bros si nasconde) */
    'html.efg-hub #timerWrap{display:none!important}',
    /* computer con mouse e tastiera: niente joystick o piste di trascinamento, al loro posto i tasti da usare */
    '.gb-keys{display:none;margin:0;padding:10px 12px;text-align:center;font:600 12px/1.5 "IBM Plex Mono",ui-monospace,monospace;color:var(--dim,#4a6580)}',
    '.gb-keys kbd{display:inline-block;min-width:1.6em;padding:1px 6px;margin:0 2px;border:1px solid var(--line,#cddcea);border-bottom-width:2px;border-radius:5px;background:var(--panel,#fff);color:var(--text,#0d2b45);font:inherit}',
    '@media (hover:hover) and (pointer:fine){html[data-efg-game=coretech] #joy,html[data-efg-game=timenet] #strip,html[data-efg-game=inncloud] #strip,html[data-efg-game=inncloud] #fireBtn{display:none!important}.gb-keys{display:block}}',
    /* Dark: stessi giochi, interfaccia scura (il campo di gioco disegnato resta com\'è) */
    'html[data-view=dark]{color-scheme:dark;--bg:#0e1621;--panel:#172230;--panel-2:#1e2b3b;--line:#33465c;--text:#e7eef6;--dim:#a3b6ca;--text-dim:#a3b6ca;--coin:#ffb04a;--ef-yellow:#ffb04a}',
    'html[data-view=dark][data-efg-game=coretech]{--ct-light:#8ab8e6;--navy:#8ac4f0}',
    'html[data-view=dark][data-efg-game=timenet]{--ct-light:#7cc0ea;--sun:#ffb04a;--coin:#ffb04a}',
    'html[data-view=dark][data-efg-game=inncloud]{--ct-light:#ff7a7a;--tn-light:#ff7a7a;--coin:#8ac4f0;--navy:#8ac4f0;--hack:#4fd47f}',
    'html[data-view=dark],html[data-view=dark] body{background:var(--bg)}',
    'html[data-view=dark] .gb-viewtoast{background:#f2f7fc;color:#0d2b45}',
    'html[data-view=dark] .overlay{background:rgba(9,15,23,.82)}',
    /* Efuture Bros: barra, sfondo, titoli e comandi scuri */
    'html[data-view=dark][data-efg-game=sysadmin] #hud{background:linear-gradient(180deg,#1a2533,var(--panel-2) 90%)}',
    'html[data-view=dark][data-efg-game=sysadmin] #stage{background:#0b121b}',
    'html[data-view=dark][data-efg-game=sysadmin] .card h1{color:#8ac4f0}',
    'html[data-view=dark][data-efg-game=sysadmin] #controls{background:linear-gradient(0deg,#0e1621,var(--panel-2) 85%)}',
    'html[data-view=dark][data-efg-game=sysadmin] #joy{background:radial-gradient(circle at 50% 45%,#2a3a4d 0%,#1e2b3b 60%,#16202c 100%);box-shadow:inset 0 2px 8px rgba(0,0,0,.4),0 3px 0 #0b121b}',
    'html[data-view=dark][data-efg-game=sysadmin] button.game-btn.secondary{background:#1e2b3b;color:#e7eef6;border-color:#33465c;box-shadow:0 4px 0 #0b121b}',
    'html[data-view=dark][data-efg-game=sysadmin] #btnSpecial:not(.unlocked){background:#243244;color:#6f86a0}',
    /* Timenet e inncloud: pista di trascinamento scura */
    'html[data-view=dark][data-efg-game=timenet] #strip{background:linear-gradient(180deg,#1e2b3b,#16202c);border-color:#3b5670}',
    'html[data-view=dark][data-efg-game=inncloud] #strip{background:linear-gradient(180deg,#1e2b3b,rgba(192,0,0,.18));border-color:#4a3440}'
  ].join('\n');
  var $ = function(id){ return id ? doc.getElementById(id) : null; };
  var app = $('app'), hud = $('hud'), controls = $('controls');
  if (!app || !hud || !controls) return;
  var root = doc.documentElement;

  /* ---------- visualizzazione: Game (scocca in verticale), Light (chiaro), Dark (scuro) ----------
     La sceglie il giocatore con il pulsante in alto (vale per tutti e 4 i giochi, salvata sul
     telefono in efgView); finché non sceglie vale quella decisa in admin (efgViewDefault,
     scritta dall'app), altrimenti Game. In Light e Dark la scocca è spenta. */
  var VIEWS = ['light', 'dark', 'game'];   // ordine del tastino MODE: Normal → Dark → Game
  var VIEW_ICON = { game:'🎮', light:'☀', dark:'☾' }, VIEW_NAME = { game:'Game', light:'Normal', dark:'Dark' };
  function storeGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function readView(){
    var v = storeGet('efgView'); if (VIEWS.indexOf(v) >= 0) return v;
    v = storeGet('efgViewDefault'); if (VIEWS.indexOf(v) >= 0) return v;
    return 'game';
  }
  var view = readView();
  var gameId = (location.pathname.match(/games\/([a-z]+)\//) || [])[1] || '';
  if (gameId) root.setAttribute('data-efg-game', gameId);
  var sheet = null;
  Array.prototype.forEach.call(doc.querySelectorAll('link[rel=stylesheet]'), function(l){ if (/gameboy\.css/.test(l.getAttribute('href') || '')) sheet = l; });
  var themeMeta = doc.querySelector('meta[name=theme-color]'), themeLight = themeMeta ? themeMeta.getAttribute('content') : '#eef4fa';
  /* fuori dalla vista Game le parti della scocca restano nascoste anche con gameboy.css spento */
  var vstyle = mk0('style'); vstyle.textContent = VIEW_CSS; doc.head.appendChild(vstyle);
  function mk0(tag){ return doc.createElement(tag); }
  function applyView(){
    var game = view === 'game';
    root.setAttribute('data-view', view);
    root.classList.toggle('gb', game);
    if (d.game){ if (game) root.setAttribute('data-gb', d.game); else root.removeAttribute('data-gb'); }
    if (sheet) sheet.disabled = !game;
    if (themeMeta) themeMeta.setAttribute('content', view === 'dark' ? '#0e1621' : themeLight);
    if (vbtn){ vbtn.textContent = VIEW_ICON[view]; vbtn.title = 'Visualizzazione: ' + VIEW_NAME[view] + ' (tocca per cambiare)'; vbtn.setAttribute('aria-label', vbtn.title); }
  }
  /* pulsante in alto, accanto alla pausa (o in fondo alla barra) */
  var vbtn = mk0('button'); vbtn.type = 'button'; vbtn.id = 'viewBtn'; vbtn.className = 'gb-view';
  var pauseEl = $(d.pause);
  if (pauseEl && hud.contains(pauseEl)) pauseEl.parentNode.insertBefore(vbtn, pauseEl); else hud.appendChild(vbtn);
  var vtoast = mk0('div'); vtoast.className = 'gb-viewtoast'; vtoast.setAttribute('role', 'status'); doc.body.appendChild(vtoast);
  function nextView(){
    view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
    try { localStorage.setItem('efgView', view); } catch(e){}
    applyView(); relayout();
    vtoast.textContent = VIEW_ICON[view] + ' Visualizzazione ' + VIEW_NAME[view];
    vtoast.classList.add('on'); clearTimeout(vtoast.t); vtoast.t = setTimeout(function(){ vtoast.classList.remove('on'); }, 1400);
    vbtn.blur();
  }
  vbtn.addEventListener('click', nextView);
  ['pointerdown','pointerup','touchstart'].forEach(function(t){ vbtn.addEventListener(t, function(e){ e.stopPropagation(); }); });
  applyView();

  function mk(tag, cls, html){ var e = doc.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; }
  function shown(el){ return !!el && el.getClientRects().length > 0; }

  var top = mk('div', 'gb-top', '<span class="gb-led"></span><span class="gb-on">ON</span><span class="gb-lines"></span><span class="gb-clock"></span>');
  top.setAttribute('aria-hidden', 'true');
  hud.parentNode.insertBefore(top, hud);

  var brand = mk('div', 'gb-brand', '<i>EFUTURE</i> <b>GAMES</b>');
  brand.setAttribute('aria-hidden', 'true');
  controls.parentNode.insertBefore(brand, controls);

  var grille = mk('div', 'gb-grille', '<i></i><i></i><i></i><i></i><i></i><i></i>');
  grille.setAttribute('aria-hidden', 'true');
  app.appendChild(grille);

  /* tastini centrali */
  var pills = mk('div', 'gb-pills');
  var bSel = mk('button', 'gb-pill', '<i></i><span>MODE</span>');
  var bStart = mk('button', 'gb-pill', '<i></i><span>PAUSA</span>');
  bSel.type = bStart.type = 'button';
  bSel.id = 'gbSelect'; bStart.id = 'gbStart';
  bSel.setAttribute('aria-label', 'Cambia visualizzazione: Normal, Dark o Game');
  pills.appendChild(bSel); pills.appendChild(bStart);
  controls.appendChild(pills);
  var lblStart = bStart.querySelector('span');

  /* i comandi dei giochi ascoltano anche il pointerdown sulla fascia comandi:
     i tastini e la coppia A/B non devono far partire trascinamenti o lanci */
  function shield(el){ ['pointerdown','pointerup'].forEach(function(t){ el.addEventListener(t, function(e){ e.stopPropagation(); }); }); }
  shield(pills);

  /* attiva al rilascio del dito (alcuni giochi bloccano il click sui comandi touch) */
  function press(el, fn){
    var pid = null, last = 0;
    el.addEventListener('pointerdown', function(e){ pid = e.pointerId; el.classList.add('down'); });
    function off(){ pid = null; el.classList.remove('down'); }
    el.addEventListener('pointerup', function(e){ if (pid === e.pointerId){ off(); last = Date.now(); fn(); } });
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('click', function(){ if (Date.now() - last > 700) fn(); });
    el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }

  var pauseBtn = $(d.pause), pausedOv = $(d.paused);
  function primary(){
    if (!d.primary) return null;
    var list = doc.querySelectorAll(d.primary);
    for (var i = 0; i < list.length; i++) if (shown(list[i]) && !list[i].disabled) return list[i];
    return null;
  }
  function startMode(){
    if (pausedOv && shown(pausedOv)) return 'pause';
    return primary() ? 'go' : 'pause';
  }
  press(bSel, nextView);
  press(bStart, function(){
    if (startMode() === 'go'){ var p = primary(); if (p) p.click(); }
    else if (pauseBtn) pauseBtn.click();
  });
  /* all'app (modalità gara): c'è una schermata del gioco aperta (titolo, pausa, tra un livello e l'altro)?
     Se no si sta giocando e l'app nasconde la sua barra in alto */
  var inHub = window.parent && window.parent !== window, menuSent = null;
  function menuOpen(){
    var ovs = doc.querySelectorAll('.overlay');
    for (var i = 0; i < ovs.length; i++) if (shown(ovs[i])) return true;
    return false;
  }
  /* fuori dalla gara: fuochi d'artificio sulla schermata finale del gioco (in gara li accende l'app sul risultato) */
  var winOv = $('ov-win') || $('ov-victory'), winShown = false;
  function celebrate(){
    if (window.EFGFuochi){ window.EFGFuochi.start(7); return; }
    var sc = doc.createElement('script'); sc.src = new URL('../fuochi.js', s.src).href;
    sc.onload = function(){ if (window.EFGFuochi && shown(winOv)) window.EFGFuochi.start(7); };
    doc.head.appendChild(sc);
  }
  function refresh(){
    if (winOv && !inHub){
      var w = shown(winOv);
      if (w && !winShown) celebrate();
      else if (!w && winShown && window.EFGFuochi) window.EFGFuochi.stop();
      winShown = w;
    }
    if (inHub){ var m = menuOpen(); if (m !== menuSent){ menuSent = m; try { window.parent.postMessage({ type:'efg-ui', menu:m }, '*'); } catch(e){} } }
    if (!pills.getClientRects().length) return;
    var t = startMode() === 'go' ? 'AVVIA' : 'PAUSA';
    if (lblStart.textContent !== t) lblStart.textContent = t;
  }
  setInterval(refresh, 300); refresh();

  /* in gara la schermata iniziale mostra il record di gara (lo stesso della home: livelli e punti di gara),
     non il punteggio interno del gioco, che ha un'altra scala */
  if (inHub) root.classList.add('efg-hub');
  if (inHub){
    var rec = new URLSearchParams(location.search).get('rec');
    var own = ['bestLine', 'bestTimeLineTitle', 'bestDebugLineTitle'].map($).filter(Boolean);
    if (own.length){
      var st = mk0('style'); st.textContent = '#bestLine,#bestTimeLineTitle,#bestDebugLineTitle{display:none!important}'; doc.head.appendChild(st);
      var rp = mk('p', 'dim gb-rec'); rp.style.color = 'var(--ok,#1f9d55)';
      rp.innerHTML = 'Record in gara: <b></b>'; rp.querySelector('b').textContent = rec || 'nessuno, gioca!';
      own[0].parentNode.insertBefore(rp, own[0]);
    }
  }

  var KEYS = {
    coretech: '<kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> o <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> per muovere la C · <kbd>P</kbd> pausa',
    timenet: '<kbd>←</kbd><kbd>→</kbd> o <kbd>A</kbd><kbd>D</kbd> per muovere il delfino · <kbd>Spazio</kbd> per lanciare · <kbd>P</kbd> pausa',
    inncloud: '<kbd>←</kbd><kbd>→</kbd> o <kbd>A</kbd><kbd>D</kbd> per muoverti · <kbd>Spazio</kbd> per sparare · <kbd>P</kbd> pausa'
  };
  if (KEYS[gameId]){ var kh = mk('p', 'gb-keys', KEYS[gameId]); controls.insertBefore(kh, controls.firstChild); }

  /* in gara tutte le schermate iniziali hanno in cima la stessa riga delle regole (come Efuture Bros) */
  if (inHub && !$('kickerLv')){
    var tc = doc.querySelector('#ov-title .card');
    if (tc){
      var kk = mk('p', 'gb-kicker', '3 livelli &middot; 1 minuto &middot; 3 vite');
      kk.style.cssText = 'margin:0;font:600 11px/1.3 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--dim,#4a6580)';
      tc.insertBefore(kk, tc.firstChild);
    }
  }

  /* in gara "Torna ai giochi" sta dentro le schermate del gioco (titolo e pausa): la barra dell'app non serve
     e non copre punti e vite. L'app chiede conferma se la partita è in corso. */
  if (inHub){
    [['btnHow', 'btnStart'], ['btnResume']].forEach(function(ids){
      var ref = null; ids.some(function(id){ ref = $(id); return !!ref; });
      if (!ref || !ref.parentNode) return;
      var sib = ref.parentNode.querySelector('.alt, .secondary');
      var bx = mk('button', sib ? sib.className.replace(/\s*gb-[ab]\b/g, '') : 'btn alt', '← Torna ai giochi');
      bx.type = 'button'; bx.removeAttribute('id');
      bx.addEventListener('click', function(){ try { window.parent.postMessage({ type:'efg-exit' }, '*'); } catch(e){} });
      ref.parentNode.appendChild(bx);
    });
  }

  /* tempo della gara mandato dall'app: nella riga in alto della scocca, altrimenti nell'angolo dello schermo */
  var stageEl = $('stage'), clocks = [top.querySelector('.gb-clock')];
  if (stageEl){ var ck = mk('span', 'gb-clock'); ck.setAttribute('aria-hidden', 'true'); stageEl.appendChild(ck); clocks.push(ck); }
  window.addEventListener('message', function(e){
    var m = e.data; if (!m || m.type !== 'efg-clock' || e.source !== window.parent) return;
    clocks.forEach(function(c){ c.textContent = m.text || ''; c.classList.toggle('warn', !!m.warn); });
  });

  /* coppia A/B: in verticale i pulsanti indicati vengono spostati qui */
  var ab = null, moves = [];
  [['b', d.b], ['a', d.a]].forEach(function(p){
    var el = $(p[1]); if (!el) return;
    if (!ab){ ab = mk('div', 'gb-ab'); shield(ab); controls.appendChild(ab); }
    var mark = doc.createComment('gb:' + p[1]);
    el.parentNode.insertBefore(mark, el);
    moves.push({ el: el, mark: mark, cls: 'gb-' + p[0] });
    /* alcuni giochi annullano il touchstart sulla fascia comandi (niente click dal dito):
       nella coppia A/B il pulsante scatta al rilascio, senza doppioni col click */
    var down = null, upAt = 0, own = false;
    el.addEventListener('pointerdown', function(e){ if (el.parentNode === ab) down = e.pointerId; });
    el.addEventListener('pointerup', function(e){
      if (el.parentNode !== ab || down !== e.pointerId) return;
      down = null; upAt = Date.now(); own = true; el.click(); own = false;
    });
    el.addEventListener('pointercancel', function(){ down = null; });
    el.addEventListener('click', function(e){
      if (el.parentNode === ab && !own && Date.now() - upAt < 700){ e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  });
  var mq = window.matchMedia('(orientation:portrait)');
  function place(){
    var portrait = mq.matches && view === 'game';
    moves.forEach(function(m){
      if (portrait){ if (m.el.parentNode !== ab){ ab.appendChild(m.el); m.el.classList.add(m.cls); } }
      else if (m.el.parentNode === ab){ m.mark.parentNode.insertBefore(m.el, m.mark); m.el.classList.remove(m.cls); }
    });
  }
  function relayout(){ place(); refresh(); requestAnimationFrame(function(){ window.dispatchEvent(new Event('resize')); }); }
  place();
  if (mq.addEventListener) mq.addEventListener('change', relayout); else if (mq.addListener) mq.addListener(relayout);
  /* i caratteri arrivano dopo: ricalcola le misure del gioco a pagina caricata */
  window.addEventListener('load', function(){ window.dispatchEvent(new Event('resize')); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function(){ window.dispatchEvent(new Event('resize')); });
})();
