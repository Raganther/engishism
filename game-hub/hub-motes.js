/* ===================== HubMotes — points fly from one point to another =============
   A pin-prick stream of little discs that leave one place on the screen and are sucked
   into another — the picture of points travelling, so a class sees a score LEAVE one
   row and ARRIVE at the next rather than reading that it happened. Lifted off Battle
   Scrabble's score FX, which is now its first caller; the hub's standings screen is the
   second.

   Built like Kit.vote (axiom 4): it owns nothing but its own overlay. You hand it a
   FROM and a TO — each an element (re-measured every frame, so a moving row still
   catches its motes) or a fixed {x,y} — and how many, and it flies them:

     HubMotes.fly({ from, to, count, hue, radius, speed, stagger,
                    onArrive(k), onDone }) -> { cancel() }

   `onArrive(k)` fires once per disc as it lands (k is 0-based arrival order) — the seam
   a caller tweens a number on; `onDone` fires once when a flight's last disc is home.
   Under prefers-reduced-motion nothing flies: every `onArrive` and the `onDone` fire at
   once, so the number still lands and the beat still completes.

   `HubMotes.count()` is the probe window — the harness cannot see motion, so it counts.
   `HubMotes.point(el)` is the centre of an element in viewport coords, for a caller
   that wants to aim at a fixed spot.

   No dependencies; attaches as window.HubMotes and, when the kit is on the page, as
   Kit.motes. Flat filled circles only — no per-tile shadowBlur, which is what stutters
   a phone — and a wall-clock step so a 120Hz phone flies them at the same speed as a
   60Hz board. */
(function(){
  'use strict';

  let canvas = null, ctx = null, motes = [], raf = 0, last = 0;

  function ensure(){
    if(canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'hub-motes';
    // Over everything the room reads — the standings sit at a high z-index and the
    // motes must fly ABOVE them — but never catching a pointer.
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80;';
    (document.body || document.documentElement).appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize(){
    if(!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // draw in CSS px
  }

  /* An element's centre, or a plain point handed straight back. Re-read every frame
     for a flight whose TO is an element, because a standings row slides to its new
     rank while its motes are in the air. */
  function point(t){
    if(!t) return null;
    if(t.nodeType === 1){
      const r = t.getBoundingClientRect();
      if(!r.width && !r.height && !r.left && !r.top) return null;   // detached
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    if(typeof t.x === 'number' && typeof t.y === 'number') return { x: t.x, y: t.y };
    return null;
  }
  function reduced(){
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function fly(o){
    o = o || {};
    const count = Math.max(0, Math.round(Number(o.count) || 0));
    const from  = point(o.from);
    const flight = { to: o.to, remaining: count, arrived: 0, done: false,
                     onArrive: typeof o.onArrive === 'function' ? o.onArrive : null,
                     onDone:   typeof o.onDone   === 'function' ? o.onDone   : null };
    const finish = () => { if(flight.done) return; flight.done = true; if(flight.onDone) try{ flight.onDone(); }catch(e){ console.warn('motes onDone', e); } };
    const arrive = () => { const k = flight.arrived++; if(flight.onArrive) try{ flight.onArrive(k); }catch(e){ console.warn('motes onArrive', e); } };

    // No motion wanted, no origin, or nothing to fly: land it all now, keep the beat.
    if(!count || !from || reduced() || !point(o.to)){
      for(let k = 0; k < count; k++) arrive();
      finish();
      return { cancel(){} };
    }
    ensure();
    const hue = o.hue || '#F7C948', radius = Number(o.radius) || 5;
    const speed = Number(o.speed) || 1.2, stagger = Math.max(0, Number(o.stagger) || 0);
    const now = performance.now();
    for(let k = 0; k < count; k++){
      const a = Math.PI * 2 * Math.random(), sp = 0.06 + Math.random() * 0.12;
      motes.push({ flight,
                   x: from.x + (Math.random() - 0.5) * 16, y: from.y + (Math.random() - 0.5) * 16,
                   vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.05,
                   r: radius * (0.8 + Math.random() * 0.5), hue,
                   born: now, launch: now + k * stagger, speed, arrived: false });
    }
    start();
    return { cancel(){ motes.forEach(m => { if(m.flight === flight){ m.arrived = true; } }); finish(); } };
  }

  function start(){ if(!raf){ last = performance.now(); raf = requestAnimationFrame(loop); } }
  function loop(){
    const now = performance.now();
    const dt = Math.min(60, now - last); last = now;
    step(dt, now);
    raf = motes.length ? requestAnimationFrame(loop) : 0;
  }
  function step(dt, now){
    if(!ctx) return;
    // one target measurement per flight per frame
    const targets = new Map();
    for(const m of motes) if(!targets.has(m.flight)) targets.set(m.flight, point(m.flight.to));
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const pull = 0.0016;
    for(const m of motes){
      if(m.arrived) continue;
      if(now < m.launch){ draw(m, now); continue; }   // staggered: held at its start for a beat
      const t = targets.get(m.flight);
      if(t){
        const dx = t.x - m.x, dy = t.y - m.y, dist = Math.hypot(dx, dy) || 1;
        m.vx += (dx / dist) * pull * m.speed * dt;
        m.vy += (dy / dist) * pull * m.speed * dt;
        m.vx *= 0.9; m.vy *= 0.9;                       // drag: they curve in rather than orbit
        m.x += m.vx * dt; m.y += m.vy * dt;
        if(dist < 20){ m.arrived = true; land(m.flight); }
      } else if(now - m.born > 400){ m.arrived = true; land(m.flight); }   // target vanished
      draw(m, now);
    }
    // sweep arrived / stale, firing each flight's callbacks
    for(const m of motes){
      if(!m.arrived && now - m.born > 6000){ m.arrived = true; land(m.flight); }
    }
    motes = motes.filter(m => !m.arrived);
  }
  function land(flight){
    if(flight.onArrive) try{ flight.onArrive(flight.arrived++); }catch(e){ console.warn('motes onArrive', e); }
    if(--flight.remaining <= 0 && !flight.done){ flight.done = true; if(flight.onDone) try{ flight.onDone(); }catch(e){ console.warn('motes onDone', e); } }
  }
  function draw(m, now){
    const age = now - m.born;
    ctx.globalAlpha = age < 120 ? age / 120 : 1;    // a quick fade-in
    ctx.fillStyle = m.hue;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  const HubMotes = { fly, point, count: () => motes.length,
                     /* test/teardown: drop everything in flight without firing callbacks */
                     clear(){ motes = []; if(ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); } };
  window.HubMotes = HubMotes;
  if(window.HubKit) window.HubKit.motes = HubMotes;
})();
