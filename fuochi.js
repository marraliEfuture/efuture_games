/* Efuture Games - fuochi d'artificio per festeggiare la fine di un gioco.
   EFGFuochi.start(secondi) li accende su tutto lo schermo (sopra a tutto, non blocca i tocchi);
   EFGFuochi.stop() li spegne. Usato dall'app (risultato della gara) e dai giochi (schermata finale). */
(function(){
  var COLORS = ['#f18c22', '#ffd23f', '#ffffff', '#5ee0ff', '#4fd47f', '#ff8ad8', '#3d7fb0'];
  var cv = null, ctx = null, raf = 0, until = 0, nextAt = 0, rockets = [], sparks = [], last = 0, W = 0, H = 0, dpr = 1;
  function size(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function launch(){
    rockets.push({ x: W * (0.15 + Math.random() * 0.7), y: H + 10, vx: (Math.random() - 0.5) * 60,
      vy: -(H * (0.9 + Math.random() * 0.35)), ty: H * (0.15 + Math.random() * 0.35),
      c: COLORS[Math.floor(Math.random() * COLORS.length)] });
  }
  function burst(r){
    var n = 46 + Math.floor(Math.random() * 24), c2 = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (var i = 0; i < n; i++){
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.2, sp = 90 + Math.random() * 170;
      sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.55 + Math.random() * 0.4, c: i % 3 ? r.c : c2 });
    }
  }
  function frame(ts){
    var dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    if (ts < until && ts >= nextAt){ launch(); if (Math.random() < 0.35) launch(); nextAt = ts + 280 + Math.random() * 420; }
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = rockets.length - 1; i >= 0; i--){
      var r = rockets[i];
      r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 420 * dt;
      ctx.fillStyle = r.c; ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, 7); ctx.fill();
      if (r.y <= r.ty || r.vy >= 0){ burst(r); rockets.splice(i, 1); }
    }
    for (var j = sparks.length - 1; j >= 0; j--){
      var s = sparks[j];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.985; s.vy = s.vy * 0.985 + 110 * dt; s.life -= s.decay * dt;
      if (s.life <= 0){ sparks.splice(j, 1); continue; }
      ctx.globalAlpha = Math.min(1, s.life * 1.4); ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (ts < until || rockets.length || sparks.length) raf = requestAnimationFrame(frame); else stop();
  }
  function start(sec){
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) sec = Math.min(sec || 6, 2.5);
    if (!cv){
      cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483000;pointer-events:none';
      ctx = cv.getContext('2d');
      window.addEventListener('resize', function(){ if (cv && cv.parentNode) size(); });
    }
    if (!cv.parentNode) document.body.appendChild(cv);
    size();
    var now = performance.now();
    until = now + (sec || 6) * 1000; nextAt = now; last = 0;
    for (var k = 0; k < 3; k++) launch();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function stop(){
    cancelAnimationFrame(raf); raf = 0; rockets = []; sparks = []; until = 0;
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
  }
  window.EFGFuochi = { start: start, stop: stop };
})();
