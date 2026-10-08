/* Efuture Games - "console portatile" in verticale (vedi gameboy.css).
   Aggiunge solo le parti decorative (led, scritta, griglia altoparlante) e i due
   tastini centrali ISTRUZIONI / AVVIA-PAUSA; in verticale sposta i tasti indicati
   (data-a / data-b) nella coppia A/B e li rimette al loro posto in orizzontale.
   Non tocca la logica dei giochi: i tastini premono i pulsanti che esistono già.
   Attributi dello <script>:
     data-a, data-b   id dei pulsanti da usare come A e B (facoltativi)
     data-select      id del pulsante "Istruzioni"
     data-pause       id del pulsante pausa
     data-primary     selettore del pulsante principale dentro un overlay visibile
     data-paused      id dell'overlay di pausa */
(function(){
  var s = document.currentScript, d = (s && s.dataset) || {}, doc = document;
  var $ = function(id){ return id ? doc.getElementById(id) : null; };
  var app = $('app'), hud = $('hud'), controls = $('controls');
  if (!app || !hud || !controls) return;
  doc.documentElement.classList.add('gb');
  if (d.game) doc.documentElement.setAttribute('data-gb', d.game);

  function mk(tag, cls, html){ var e = doc.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; }
  function shown(el){ return !!el && el.getClientRects().length > 0; }

  var top = mk('div', 'gb-top', '<span class="gb-led"></span><span class="gb-on">ON</span><span class="gb-lines"></span>');
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
  var bSel = mk('button', 'gb-pill', '<i></i><span>ISTRUZIONI</span>');
  var bStart = mk('button', 'gb-pill', '<i></i><span>PAUSA</span>');
  bSel.type = bStart.type = 'button';
  bSel.id = 'gbSelect'; bStart.id = 'gbStart';
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

  var selTarget = $(d.select), pauseBtn = $(d.pause), pausedOv = $(d.paused);
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
  press(bSel, function(){ if (shown(selTarget)) selTarget.click(); });
  press(bStart, function(){
    if (startMode() === 'go'){ var p = primary(); if (p) p.click(); }
    else if (pauseBtn) pauseBtn.click();
  });
  function refresh(){
    if (!pills.getClientRects().length) return;
    bSel.classList.toggle('off', !shown(selTarget));
    var t = startMode() === 'go' ? 'AVVIA' : 'PAUSA';
    if (lblStart.textContent !== t) lblStart.textContent = t;
  }
  setInterval(refresh, 300); refresh();

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
    var portrait = mq.matches;
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
