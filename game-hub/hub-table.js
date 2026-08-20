/* ===================== Kit.table — the physics table ======================
   A bounded 2D physics space you drop lettered pieces into slots. It is the
   shelf the throw dynamic runs on: pieces you flick around, a row of answer
   slots they suck into, and a read() of what landed where.

   Transport-agnostic on purpose (axiom 4): it takes canvas-space coordinates
   in grab/move/drop and hands back an arrangement — it knows nothing about
   pointers, phones, the relay or the board. The caller wires the DOM and the
   coordinate conversion, judges the arrangement, and owns the loop. That is
   what lets the SAME table back the standalone Throw Lab, a board-operated
   round on the bench, and (later) a phone-local round — each a different
   caller with a different transport.

   It attaches as window.HubKit.table, exactly as hub-rounds.js attaches
   window.HubKit.round. Loads AFTER matter.min.js (needs window.Matter) and
   hub-kit.js (needs window.HubKit).

   Kit.table({ canvas, gravity, restitution, frictionAir, size, power, swing,
               snap, onArrange }) -> {
     reset(), setPieces(labels[]), slots(n), place(i,label),
     read()->string, cells()->string[], filled()->bool, setResult(res),
     setFeel(partial), resize(),
     grab(id,x,y), move(id,x,y), drop(id), heldBy(id), anyHeld(),
     step(), draw()
   }
   onArrange(read, filled) fires whenever a piece docks or is pulled out.
   setResult('right'|'wrong'|null) tints filled slots — judging stays the
   caller's; the table only paints the tint it is handed.
   ========================================================================== */
(function(){
  'use strict';
  if(!window.Matter || !window.HubKit) return;   // load order guard
  const M = window.Matter;
  const { Engine, Composite, Bodies, Body, Query, Constraint } = M;

  /* palette for the pieces: distinguishable, high-contrast on dark */
  const HUES = ['#00A0DF','#F5C542','#E2603B','#6FB04A','#B36FD1','#3BB0A8','#E86FA0'];

  const now = () => (window.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  function roundRect(ctx, x, y, w, h, r){
    if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  function makeTable(opts){
    opts = opts || {};
    const canvas = opts.canvas;
    const ctx = canvas.getContext('2d');
    const engine = Engine.create();
    engine.gravity.y = opts.gravity != null ? opts.gravity : 0.9;
    engine.constraintIterations = 6;   // pulls a held piece to the finger harder each frame, so a fast drag lags less

    let cssW = 0, cssH = 0, dpr = 1;
    let walls = [];
    let pieces = [];       // { body, ch, hue, slot, dock }
    let slots = [];        // { x, y, w, h, piece }
    let result = null;     // tint for filled slots: null | 'right' | 'wrong'
    const feel = {
      restitution: opts.restitution != null ? opts.restitution : 0.45,
      frictionAir: opts.frictionAir != null ? opts.frictionAir : 0.01,
      size:        opts.size != null ? opts.size : 82,
      power:       opts.power != null ? opts.power : 1.3,
      swing:       opts.swing != null ? opts.swing : 0.4,   // 0 = rigid (tracks the finger), 1 = loose (dangles)
      snap:        opts.snap != null ? opts.snap : 380      // dock glide duration in ms
    };
    // Drag stiffness from the swing dial. Firm enough to track the finger without
    // visible lag; the gravity swing survives because it is the piece pivoting
    // under gravity about the pinned point, which the linear spring does not damp.
    const stiffnessOf = sw => 1 - sw * 0.7;   // 1.0 (rigid) .. 0.30 (loose)

    // Multi-touch: one grip per pointer id.
    const grips = new Map();   // id -> { body, constraint, fingerStart, anchor }

    function report(){ if(opts.onArrange) opts.onArrange(read(), filled()); }

    /* ---- canvas + walls ---- */
    function sizeToCanvas(){
      // Natural (layout) size, NOT the painted size. A caller may live inside a
      // transform:scale()-d card (the hub clue card is), where getBoundingClientRect
      // reports the scaled paint; offsetWidth/Height are the untransformed layout box,
      // so the physics runs at full resolution in card-natural coordinates and the
      // caller converts pointer coords by the same scale. At scale 1 (Throw Lab) the
      // two measures are identical.
      const w = canvas.offsetWidth || canvas.getBoundingClientRect().width;
      const h = canvas.offsetHeight || canvas.getBoundingClientRect().height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = Math.max(1, Math.round(w));
      cssH = Math.max(1, Math.round(h));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildWalls();
      layoutSlots();
    }
    function buildWalls(){
      if(walls.length) Composite.remove(engine.world, walls);
      const t = 200; // thick, so a fast piece cannot tunnel through in one step
      const o = { isStatic:true, restitution:0.4, friction:0.2 };
      walls = [
        Bodies.rectangle(cssW/2, cssH + t/2, cssW + t*2, t, o),   // floor
        Bodies.rectangle(cssW/2, -t/2,        cssW + t*2, t, o),   // ceiling
        Bodies.rectangle(-t/2,   cssH/2,      t, cssH + t*2, o),   // left
        Bodies.rectangle(cssW + t/2, cssH/2,  t, cssH + t*2, o)    // right
      ];
      Composite.add(engine.world, walls);
    }

    /* ---- pieces ---- */
    function setPieces(labels){
      if(pieces.length) Composite.remove(engine.world, pieces.map(p => p.body));
      pieces = [];
      const s = feel.size, chars = (labels || []).slice();
      const spread = Math.min(cssW - s, chars.length * (s + 10));
      const startX = (cssW - spread) / 2 + s/2;
      chars.forEach((ch, i) => {
        const x = chars.length > 1 ? startX + (spread - s) * (i/(chars.length-1)) : cssW/2;
        const y = s/2 + 20 + (i % 2) * 8;
        const body = Bodies.rectangle(x, y, s, s, {
          chamfer:{ radius: Math.round(s*0.16) },
          restitution: feel.restitution, frictionAir: feel.frictionAir,
          friction: 0.3, density: 0.0016
        });
        Body.setAngle(body, (Math.random() - 0.5) * 0.3);
        pieces.push({ body, ch: String(ch), hue: HUES[i % HUES.length], slot: null, dock: null });
      });
      Composite.add(engine.world, pieces.map(p => p.body));
    }

    /* ---- slots (the zones a piece lands in): a centred row of n ---- */
    function slotDims(n){
      const margin = 16, gap = Math.max(6, Math.round(feel.size * 0.12));
      const sw = Math.max(36, Math.min(feel.size, Math.floor((cssW - margin*2 - gap*(n-1)) / n)));
      const rowW = n*sw + (n-1)*gap, x0 = (cssW - rowW) / 2, y = Math.round(cssH * 0.46);
      return { gap, sw, x0, y };
    }
    function makeSlots(n){
      slots = [];
      if(!n) return;
      const { gap, sw, x0, y } = slotDims(n);
      for(let i = 0; i < n; i++) slots.push({ x: x0 + i*(sw+gap) + sw/2, y, w: sw, h: sw, piece: null });
    }
    function layoutSlots(){          // recompute geometry on resize, keeping placed pieces
      const n = slots.length; if(!n) return;
      const { gap, sw, x0, y } = slotDims(n);
      slots.forEach((s, i) => {
        s.x = x0 + i*(sw+gap) + sw/2; s.y = y; s.w = sw; s.h = sw;
        if(s.piece) Body.setPosition(s.piece.body, { x: s.x, y: s.y });
      });
    }
    function pieceOf(body){ for(const p of pieces) if(p.body === body) return p; return null; }
    function freeSlotOf(piece){ if(piece && piece.slot != null){ const s = slots[piece.slot]; if(s) s.piece = null; piece.slot = null; } }
    function slotNear(x, y){         // nearest EMPTY slot within capture range, or -1
      let best = -1, bestD = Infinity;
      slots.forEach((s, i) => { if(s.piece) return; const dx = s.x - x, dy = s.y - y, d = dx*dx + dy*dy; if(d < bestD){ bestD = d; best = i; } });
      const cap = (slots.length ? slots[0].w : feel.size) * 0.85;
      return (best >= 0 && bestD <= cap*cap) ? best : -1;
    }

    /* ---- the suck-and-spin dock ---- */
    function startDock(piece, i){
      const s = slots[i];
      s.piece = piece; piece.slot = i;
      Body.setStatic(piece.body, true);          // hand the tile to the tween, not gravity
      Body.setVelocity(piece.body, { x:0, y:0 });
      Body.setAngularVelocity(piece.body, 0);
      const a = piece.body.angle;
      piece.dock = {
        t0: now(), dur: Math.max(80, feel.snap),
        fromX: piece.body.position.x, fromY: piece.body.position.y,
        fromA: a, toA: Math.round(a / (Math.PI*2)) * (Math.PI*2),   // nearest upright — spins the short way
        p: 0
      };
    }
    function tickDocks(){
      const t = now();
      for(const b of pieces){
        const dk = b.dock; if(!dk) continue;
        let raw = (t - dk.t0) / dk.dur; if(raw > 1) raw = 1;
        const e = raw*raw*raw*(raw*(raw*6 - 15) + 10);   // smootherstep — a soft magnetic pull
        dk.p = e;
        const s = slots[b.slot];
        Body.setPosition(b.body, { x: dk.fromX + (s.x - dk.fromX)*e, y: dk.fromY + (s.y - dk.fromY)*e });
        Body.setAngle(b.body, dk.fromA + (dk.toA - dk.fromA)*e);
        if(raw >= 1){ b.dock = null; Body.setAngle(b.body, 0); report(); }   // arrangement changed once it is home
      }
    }

    /* ---- readout ---- */
    function read(){ return slots.map(s => s.piece ? s.piece.ch : '').join(''); }
    /* Positional read: one entry per slot, an empty slot kept as '' rather than
       collapsed. `read()` concatenates (the spelled word); a caller that must send
       the arrangement over a wire and have gaps survive — a phone feeding the
       drag rounds' positional merge — joins these with a separator instead. */
    function cells(){ return slots.map(s => s.piece ? s.piece.ch : ''); }
    function filled(){ return slots.length > 0 && slots.every(s => s.piece); }

    /* Drop a lettered piece straight into a slot, no glide — the reconnect path.
       A handset that dropped off the wifi mid-arrangement is re-armed with the
       same pieces and its last-sent wire; this puts each letter back where it was
       without re-running the dock tween or firing onArrange (the caller already
       knows the arrangement it is restoring). Matches by free piece of that letter,
       so duplicate letters each find their own tile. */
    function place(i, label){
      if(i < 0 || i >= slots.length || slots[i].piece) return false;
      const held = heldBodies();
      const p = pieces.find(pp => pp.slot == null && !pp.dock && !held.has(pp.body) && pp.ch === String(label));
      if(!p) return false;
      const s = slots[i];
      s.piece = p; p.slot = i; p.dock = null;
      Body.setStatic(p.body, true);
      Body.setPosition(p.body, { x: s.x, y: s.y });
      Body.setAngle(p.body, 0);
      Body.setVelocity(p.body, { x:0, y:0 });
      Body.setAngularVelocity(p.body, 0);
      return true;
    }

    /* ---- input surface (one grip per pointer id) ---- */
    function heldBodies(){ const set = new Set(); for(const g of grips.values()) set.add(g.body); return set; }
    function grab(id, x, y){
      // Strict hit first (a stack grabs the piece you're over), then a forgiving
      // nearest-centre fallback (a fat fingertip lands slightly off a small tile).
      // A piece another finger holds is off-limits, or two fingers fight over it.
      const taken = heldBodies();
      const free = pieces.filter(p => !taken.has(p.body)).map(p => p.body);
      const hit = Query.point(free, { x, y });
      const body = hit.length ? hit[hit.length - 1] : nearest(x, y, taken);
      if(!body) return false;
      const gp = pieceOf(body);
      if(gp) gp.dock = null;   // grabbing mid-glide cancels the dock
      if(gp && gp.slot != null){ freeSlotOf(gp); result = null; report(); }
      if(body.isStatic) Body.setStatic(body, false);
      Body.setVelocity(body, { x:0, y:0 });
      Body.setAngularVelocity(body, 0);
      // Drag through a spring anchored at the grabbed point. pointB is a
      // WORLD-oriented offset from the centre (Matter does not re-rotate it), so
      // it must NOT be converted into the body's local frame or a rotated tile
      // lurches its far side under the cursor. The off-centre pull makes torque,
      // which is what swings the tile.
      let dx = x - body.position.x, dy = y - body.position.y;
      const maxR = feel.size * 0.6, len = Math.hypot(dx, dy);
      if(len > maxR){ dx = dx / len * maxR; dy = dy / len * maxR; }
      const anchor = { x: body.position.x + dx, y: body.position.y + dy };
      const constraint = Constraint.create({
        pointA: { x: anchor.x, y: anchor.y }, bodyB: body, pointB: { x: dx, y: dy },
        stiffness: stiffnessOf(feel.swing), damping: 0.1, length: 0
      });
      Composite.add(engine.world, constraint);
      grips.set(id, { body, constraint, fingerStart: { x, y }, anchor });
      return true;
    }
    function nearest(x, y, exclude){
      let best = null, bestD = Infinity;
      for(const p of pieces){
        if(exclude && exclude.has(p.body)) continue;
        const dx = p.body.position.x - x, dy = p.body.position.y - y, d = dx*dx + dy*dy;
        if(d < bestD){ bestD = d; best = p.body; }
      }
      const tol = feel.size * 0.9;
      return (best && bestD <= tol*tol) ? best : null;
    }
    function move(id, x, y){
      const g = grips.get(id);
      if(!g) return;
      // Move the anchor by the finger's delta from grab (not to the raw finger),
      // so an off-tile forgiving grab keeps its small constant gap and never snaps.
      g.constraint.pointA.x = g.anchor.x + (x - g.fingerStart.x);
      g.constraint.pointA.y = g.anchor.y + (y - g.fingerStart.y);
    }
    function drop(id){
      const g = grips.get(id);
      if(!g) return;
      Composite.remove(engine.world, g.constraint);
      const b = g.body, piece = pieceOf(b);
      grips.delete(id);
      const near = slotNear(b.position.x, b.position.y);
      if(near >= 0 && piece){ startDock(piece, near); return; }   // dropped over a slot: suck it home
      const p = feel.power, cap = 55;
      Body.setVelocity(b, { x: clamp(b.velocity.x * p, -cap, cap), y: clamp(b.velocity.y * p, -cap, cap) });
      Body.setAngularVelocity(b, clamp(b.angularVelocity * p, -1, 1));
    }
    function clearGrips(){
      for(const g of grips.values()) Composite.remove(engine.world, g.constraint);
      grips.clear();
    }

    /* ---- step + default draw. Matter does the physics; we do the draw. ---- */
    function step(){
      Engine.update(engine, 1000/60);
      tickDocks();
    }
    function draw(){
      ctx.clearRect(0, 0, cssW, cssH);
      for(const s of slots){          // answer slots, behind the pieces; filled row glows by result
        const half = s.w/2, r = Math.round(s.w*0.16);
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = s.piece
          ? (result === 'right' ? '#6FB04A' : result === 'wrong' ? '#E2603B' : '#5a6473')
          : '#39414f';
        if(!s.piece) ctx.setLineDash([6, 7]);
        roundRect(ctx, s.x - half, s.y - half, s.w, s.w, r);
        ctx.stroke();
        ctx.restore();
      }
      for(const b of pieces){
        const p = b.body.position, docking = !!b.dock, inSlot = b.slot != null;
        let s, ang;
        if(docking){ s = feel.size + (slots[b.slot].w - feel.size) * b.dock.p; ang = b.body.angle; }
        else if(inSlot){ s = slots[b.slot].w; ang = 0; }
        else { s = feel.size; ang = b.body.angle; }
        const r = Math.round(s*0.16);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = b.hue;
        roundRect(ctx, -s/2, -s/2, s, s, r);
        ctx.fill();
        ctx.fillStyle = '#101318';
        ctx.font = `700 ${Math.round(s*0.56)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.ch, 0, Math.round(s*0.03));
        ctx.restore();
      }
    }

    function setFeel(next){
      Object.assign(feel, next);
      if(next.gravity != null) engine.gravity.y = next.gravity;
      if(next.restitution != null || next.frictionAir != null){
        for(const b of pieces){
          if(next.restitution != null) b.body.restitution = feel.restitution;
          if(next.frictionAir != null) b.body.frictionAir = feel.frictionAir;
        }
      }
      if(next.swing != null){
        const k = stiffnessOf(feel.swing);
        for(const g of grips.values()) g.constraint.stiffness = k;
      }
    }

    return {
      reset(){ clearGrips(); if(pieces.length) Composite.remove(engine.world, pieces.map(p => p.body)); pieces = []; slots = []; result = null; },
      setPieces, slots: makeSlots, place,
      read, cells, filled, setResult(res){ result = res; },
      setFeel, resize: sizeToCanvas,
      grab, move, drop,
      heldBy: id => grips.has(id), anyHeld: () => grips.size > 0,
      step, draw
    };
  }

  window.HubKit.table = makeTable;
})();
