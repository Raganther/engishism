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
               snap, dock, onArrange, onExit }) -> {
     reset(), setPieces(labels[]), slots(n | {cols,rows}), place(i,label),
     addPiece(label, {x,y,vx,vy,spin,hue,shot}), openSides({l,r}),
     read()->string, cells()->string[], filled()->bool, loose(),
     setResult(res[, slotIdx]), slotBox(i), tileSize(),
     setFeel(partial), feel(), resize(), pt(event),
     grab(id,x,y), move(id,x,y), drop(id), heldBy(id), anyHeld(),
     step(), draw()
   }
   Kit.table.dials is the feel-dial registry (one home for every tuning
   default); Kit.table.dialsPanel(mount, world, {onChange}) builds a Tune
   panel from it — see the DIALS table below.
   onExit({ch,hue,side,vx,vy,ny}) fires when a free piece leaves through an
   open side — the throw dynamic's exit door; see openSides.
   onArrange(read, filled) fires whenever a piece docks or is pulled out.
   setResult('right'|'wrong'|null) tints filled slots — judging stays the
   caller's; the table only paints the tint it is handed.
   ========================================================================== */
(function(){
  'use strict';
  if(!window.Matter || !window.HubKit) return;   // load order guard
  const M = window.Matter;
  const { Engine, Composite, Bodies, Body, Query, Constraint, Events } = M;

  /* palette for the pieces: distinguishable, high-contrast on dark */
  const HUES = ['#00A0DF','#F5C542','#E2603B','#6FB04A','#B36FD1','#3BB0A8','#E86FA0'];

  /* ---- the feel dials: ONE home for every touch-tuning number ----
     Each dial declares its default, range, label and print format. makeTable
     seeds its feel from the defaults (a caller may still override at
     construction — the toss round's card wants size:64), and the playground
     Tune panels BUILD themselves from this table via Kit.table.dialsPanel —
     so a new dial appears on every panel by being declared here, and a tuned
     value is one edit that every caller inherits (Battle Scrabble, the toss
     round, join.html's table mode, Throw Lab).

     The values in this table are the truth for EVERY device. On top of them
     sits one explicit, per-device overlay: the Tune panels' Save button
     writes the current feel to localStorage, and every table built on that
     device then inherits it (a caller's own constructor override still wins
     — the toss card keeps its size). This is deliberately not the silent
     seeding that makes the settings panel's stuck-default trap: a save only
     exists because someone pressed Save, the panels SAY when one is active,
     and Reset clears it. It reaches one device only — graduating a tuned
     feel to every student's phone still means writing it here, once.
     Throw Lab is the bench where the experimenting happens. */
  const FEEL_STORE = 'engishism.tableFeel';
  function savedFeel(){
    try{
      const o = JSON.parse(localStorage.getItem(FEEL_STORE) || 'null');
      return (o && o.v) ? o.v : null;
    }catch(e){ return null; }   // storage blocked (some file:// browsers) = no overlay
  }
  const DIALS = [
    { k:'gravity',     label:'Gravity',     min:0,   max:2,    step:0.05,  def:0.9,  fmt:v => v.toFixed(2) },
    { k:'restitution', label:'Bounce',      min:0,   max:0.95, step:0.05,  def:0.45, fmt:v => v.toFixed(2) },
    { k:'frictionAir', label:'Air drag',    min:0,   max:0.08, step:0.005, def:0.01, fmt:v => v.toFixed(3) },
    /* steps must land on the defaults — a range input SNAPS an off-grid value
       to the nearest step, and the suite compares slider to feel exactly */
    { k:'size',        label:'Box size',    min:40,  max:140,  step:2,     def:56,   fmt:v => v + 'px' },
    /* 0 = rigid (the tile tracks the finger), 1 = loose (dangles from the
       touch point). Started at 0.4 as the designed charm of the dynamic;
       0.4 and then 0.25 both read as lag on a real handset, where the finger
       hides the tile — so the default is OFF and the dial is its trial. */
    { k:'swing',       label:'Swing',       min:0,   max:1,    step:0.05,  def:0,    fmt:v => v.toFixed(2) },
    /* damping 0, grabArm 0, reach 1.5, snap 200, dock 14: the first real
       phone-tuned feel, saved on the bench 2026-08-25 — a fully rigid grab
       centred dead under the finger, maximum fat-finger reach, quick docks,
       forgiving placement. */
    { k:'damping',     label:'Wobble damp', min:0,   max:0.5,  step:0.05,  def:0,    fmt:v => v.toFixed(2) },
    /* how far off-centre the grab may pin, as a fraction of the box — the
       pendulum's arm. 0 recentres every grab under the finger. */
    { k:'grabArm',     label:'Grab arm',    min:0,   max:0.6,  step:0.05,  def:0,    fmt:v => '×' + v.toFixed(2) },
    /* the fat-finger forgiveness: how near a miss still grabs the nearest
       loose tile, as a fraction of the box */
    { k:'reach',       label:'Grab reach',  min:0.3, max:1.5,  step:0.1,   def:1.5,  fmt:v => '×' + v.toFixed(1) },
    { k:'power',       label:'Throw power', min:0.4, max:3,    step:0.1,   def:1.3,  fmt:v => '×' + v.toFixed(1) },
    { k:'snap',        label:'Snap',        min:150, max:800,  step:10,    def:200,  fmt:v => (v/1000).toFixed(2) + 's' },   // dock glide ms
    { k:'dock',        label:'Place below', min:2,   max:30,   step:1,     def:14,   fmt:v => String(v) }                    // dock-on-release only below this speed (px/step)
  ];

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
    /* Every feel number seeds from the DIALS table above, under this
       device's saved overlay if one was explicitly Saved on a Tune panel.
       A caller's constructor override wins for its own world only. */
    const saved = savedFeel();
    const feel = {};
    for(const d of DIALS){
      feel[d.k] = opts[d.k] != null ? opts[d.k]
                : (saved && saved[d.k] != null) ? saved[d.k]
                : d.def;
    }
    engine.gravity.y = feel.gravity;
    engine.constraintIterations = 6;   // pulls a held piece to the finger harder each frame, so a fast drag lags less

    let cssW = 0, cssH = 0, dpr = 1;
    let tile;                    // effective tile size = the fitted slot size (see fitTiles)
    let walls = [];
    let pieces = [];       // { body, ch, hue, slot, dock }
    let slots = [];        // { x, y, w, h, piece }
    let result = null;     // tint for filled slots: null | 'right' | 'wrong'
    /* Per-slot tint overrides — setResult(res, [indices]) scopes the glow to
       one word's slots, so a grid can show a green word and a red run at once.
       setResult(res) with no indices stays the global tint and clears these. */
    const resultMap = new Map();
    function clearResult(){ result = null; resultMap.clear(); }
    function setResult(res, idx){
      if(idx){ for(const i of idx){ if(res == null) resultMap.delete(i); else resultMap.set(i, res); } }
      else { result = res; resultMap.clear(); }
    }
    tile = feel.size;            // until the first fit, a tile is its requested size
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
      fitTiles();
      /* A resize can SHRINK the world — the Tune drawer opening takes the
         stage's height — and a loose tile left below the new floor is outside
         the walls, falls forever, and "disappears" when the drawer closes.
         A resize must never eat a tile: pull any free body back inside the
         new bounds. Open sides stay open (a tile mid-exit is not yanked
         back); docked tiles are static and follow their slots instead. */
      for(const p of pieces){
        const b = p.body;
        if(b.isStatic) continue;
        const s2 = tile / 2;
        const nx = clamp(b.position.x, open.l ? -Infinity : s2, open.r ? Infinity : cssW - s2);
        const ny = clamp(b.position.y, s2, cssH - s2);
        if(nx !== b.position.x || ny !== b.position.y){
          Body.setPosition(b, { x: nx, y: ny });
          Body.setVelocity(b, { x: 0, y: 0 });
        }
      }
    }
    /* A loose tile is the SAME size as the slot it drops into. The slots shrink to fit
       the row (slotDims caps at feel.size, then reduces for width/count), so a piece left
       at feel.size looks bigger than its box. `tile` is that fitted size; scale the bodies
       to it so the physics matches the drawn square, and the draw uses it for loose pieces. */
    function fitTiles(){
      /* A loose tile is the SAME size as a slot square, always. When slots
         exist their fitted width IS the tile size; with none, fit for the
         piece count. Called from makeSlots/setPieces/addPiece as well as
         resize — the old resize-only fit left a first deal's tiles at
         feel.size, visibly larger than the slots they drop into. */
      const nt = slots.length ? slots[0].w
                              : slotDims(Math.max(pieces.length, 1)).sw;
      if(pieces.length && Math.abs(nt - tile) > 0.5){
        const f = nt / tile;
        for(const p of pieces) Body.scale(p.body, f, f);
      }
      tile = nt;
      for(const p of pieces) normalizeMass(p.body);
    }
    /* Every tile weighs what a 34px tile weighs, whatever size the layout dealt —
       34px at the build density 0.0016 is where the drag feel was last tuned (the
       classroom-photos build). Body.scale scales mass with AREA, so when the grid
       fix grew a phone's tiles from 33px to 43px every tile got 1.7x heavier — and
       the drag spring, tuned on the lighter tiles, sagged and swung: the tile hung
       visibly below the finger and wobbled. Same rule as the wall-clock step and
       the fixed pile band: the feel numbers must not depend on what screen the
       game landed on. Static (docked) tiles are skipped — their mass is pinned by
       setStatic, and they re-normalize on the next fit once knocked loose. */
    function normalizeMass(b){
      if(!b.isStatic && b.area > 0) Body.setDensity(b, 0.0016 * (34 * 34) / b.area);
    }
    /* The sides can OPEN — the throw dynamic's exit doors. With a side open its
       wall is simply not built, a piece that crosses that edge leaves the world,
       and step() reports it through onExit (letter, hue, side, velocity, height)
       so the caller can send it wherever tiles travel to. Both sides closed is
       the default and the walls behave exactly as before. */
    const open = { l:false, r:false };
    function openSides(o2){
      const l = !!(o2 && o2.l), r = !!(o2 && o2.r);
      if(l === open.l && r === open.r) return;
      open.l = l; open.r = r;
      buildWalls();
    }
    function buildWalls(){
      if(walls.length) Composite.remove(engine.world, walls);
      const t = 200; // thick, so a fast piece cannot tunnel through in one step
      const o = { isStatic:true, restitution:0.4, friction:0.2 };
      walls = [
        Bodies.rectangle(cssW/2, cssH + t/2, cssW + t*2, t, o),   // floor
        Bodies.rectangle(cssW/2, -t/2,        cssW + t*2, t, o)    // ceiling
      ];
      if(!open.l) walls.push(Bodies.rectangle(-t/2,   cssH/2, t, cssH + t*2, o));   // left
      if(!open.r) walls.push(Bodies.rectangle(cssW + t/2, cssH/2, t, cssH + t*2, o)); // right
      Composite.add(engine.world, walls);
    }
    /* A free piece fully past an open edge has left: take it out of the world
       and hand it to the caller with everything a receiving table needs to
       continue its flight. Held, docking and slotted pieces never exit — a drag
       past the edge only counts once the finger lets go. */
    function tickExits(){
      if((!open.l && !open.r) || !opts.onExit || !pieces.length) return;
      const held = grips.size ? heldBodies() : null;
      const out = [];
      for(const p of pieces){
        if(p.slot != null || p.dock || (held && held.has(p.body))) continue;
        const x = p.body.position.x, m = tile * 0.6;
        const crossL = open.l && x < -m, crossR = open.r && x > cssW + m;
        if(!crossL && !crossR) continue;
        if(p.hold && now() < p.hold){
          // too fresh to leave: the edge is a soft wall for the arrival beat
          const v = p.body.velocity;
          if((crossL && v.x < 0) || (crossR && v.x > 0))
            Body.setVelocity(p.body, { x: -v.x * 0.8, y: v.y });
          continue;
        }
        out.push({ p, side: crossL ? 'l' : 'r' });
      }
      for(const o2 of out){
        const b = o2.p.body;
        Composite.remove(engine.world, b);
        pieces = pieces.filter(q => q !== o2.p);
        opts.onExit({ ch: o2.p.ch, hue: o2.p.hue, side: o2.side,
                      vx: b.velocity.x, vy: b.velocity.y,
                      ny: clamp(b.position.y / cssH, 0, 1) });
      }
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
        // hold: a fresh deal's rain must not leak out through an open side
        // while it settles — the edge reflects it back in until this expires
        pieces.push({ body, ch: String(ch), hue: HUES[i % HUES.length],
                      slot: null, dock: null, hold: now() + 1500 });
      });
      Composite.add(engine.world, pieces.map(p => p.body));
      // Bodies are built at feel.size; fitTiles brings them to the slot size.
      tile = feel.size;
      fitTiles();
    }

    /* Add ONE piece without touching the rest — the arrival path for a tile
       thrown from another player's table. Spawned wherever the caller says,
       moving however the caller says (the thrown tile keeps the speed and
       trajectory it left the other screen with), and it is an ordinary piece
       from then on: grabbable, dockable, read by read(). `hue` lets the caller
       colour it (a thrown tile arrives wearing the colour it wore on the
       thrower's board); `shot:true` arms the knock rule below for its first
       hard impact. */
    function addPiece(label, o){
      o = o || {};
      const s = feel.size;
      const body = Bodies.rectangle(o.x != null ? o.x : cssW/2, o.y != null ? o.y : s, s, s, {
        chamfer:{ radius: Math.round(s*0.16) },
        restitution: feel.restitution, frictionAir: feel.frictionAir,
        friction: 0.3, density: 0.0016
      });
      if(tile !== s) Body.scale(body, tile / s, tile / s);
      normalizeMass(body);   // addPiece never passes fitTiles, so weigh it here
      Body.setVelocity(body, { x: o.vx || 0, y: o.vy || 0 });
      Body.setAngularVelocity(body, clamp(o.spin || 0, -1, 1));
      /* A shot arrival gets a short hold too — without it a tile entering at
         speed can carom off another piece and leave again through the edge it
         came in by, and two open boards ping-pong one tile forever. */
      pieces.push({ body, ch: String(label), hue: o.hue || HUES[pieces.length % HUES.length],
                    slot: null, dock: null, shot: o.shot ? now() : 0,
                    hold: o.shot ? now() + 900 : 0 });
      Composite.add(engine.world, body);
    }

    /* The knock: a shot piece (addPiece with shot:true) that lands its first
       hard hit on a SLOTTED tile punches it out of its slot — the word breaks
       physically, nothing is deleted. Slotted tiles are static, so without
       this rule a projectile merely bounces off a finished word. One knock
       per shot, and the flag ages out so a tile that rolled to rest is just
       a tile. Grabbing a shot tile also disarms it (see grab). */
    const KNOCK_MIN = 6, SHOT_MS = 4000;
    Events.on(engine, 'collisionStart', ev => {
      for(const pair of ev.pairs){
        const a = pieceOf(pair.bodyA), b = pieceOf(pair.bodyB);
        const shot = (a && a.shot) ? a : (b && b.shot) ? b : null;
        if(!shot) continue;
        if(now() - shot.shot > SHOT_MS){ shot.shot = 0; continue; }
        const hit = shot === a ? b : a;
        if(!hit || hit.slot == null) continue;
        const v = shot.body.velocity;
        if(Math.hypot(v.x, v.y) < KNOCK_MIN) continue;
        freeSlotOf(hit);
        hit.dock = null;   // a tile knocked MID-GLIDE keeps no tween: its slot is gone, and a tick on slots[null] threw
        Body.setStatic(hit.body, false);
        Body.setVelocity(hit.body, { x: v.x * 0.6, y: v.y * 0.6 - 2 });
        shot.shot = 0;
        clearResult();
        report();
      }
    });

    /* ---- slots (the zones a piece lands in) ----
       Two shapes, one flat row-major array either way: slots(n) is the original
       centred row; slots({cols, rows}) is a grid — words read across each row
       and down each column, and cells()/read()/place(i) index it unchanged. */
    function slotDims(n){
      const margin = 16, gap = Math.max(6, Math.round(feel.size * 0.12));
      const sw = Math.max(36, Math.min(feel.size, Math.floor((cssW - margin*2 - gap*(n-1)) / n)));
      const rowW = n*sw + (n-1)*gap, x0 = (cssW - rowW) / 2, y = Math.round(cssH * 0.46);
      return { gap, sw, x0, y };
    }
    /* Grid squares fit the width AND the height left after a FIXED pile band —
       the loose tiles rest in a dense heap that needs the same ~150px on any
       screen, so the band is absolute, never a fraction. The first classroom
       photos are why: a real phone's stage is shorter than the bench's (browser
       chrome top and bottom), and a fractional budget shrank the squares — and
       with them every tile — well below what the bench showed. With the fixed
       band both screens converge on the width-driven size and finally match. */
    function gridDims(cols, rows, top, pile){
      const margin = 12, gap = Math.max(4, Math.round(feel.size * 0.10));
      const yTop = top != null ? top : margin;    // room for a caller's own chrome above row 0
      const pileH = pile != null ? pile : 130;    // the loose-tile band below the grid (a settled heap is 1-2 tiles deep)
      const sw = Math.max(20, Math.min(feel.size,
        Math.floor((cssW - margin*2 - gap*(cols-1)) / cols),
        Math.floor((cssH - yTop - pileH - gap*(rows-1)) / rows)));
      const x0 = (cssW - (cols*sw + (cols-1)*gap)) / 2;
      const y0 = yTop + sw/2;
      return { gap, sw, x0, y0 };
    }
    let grid = null;               // {cols, rows} when the slots are a grid
    function makeSlots(spec){
      slots = []; grid = null;
      if(!spec){ fitTiles(); return; }
      if(typeof spec === 'object'){
        grid = { cols: spec.cols, rows: spec.rows, top: spec.top, pile: spec.pile };
        const { gap, sw, x0, y0 } = gridDims(grid.cols, grid.rows, grid.top, grid.pile);
        for(let r = 0; r < grid.rows; r++)
          for(let c = 0; c < grid.cols; c++)
            slots.push({ x: x0 + c*(sw+gap) + sw/2, y: y0 + r*(sw+gap), w: sw, h: sw, piece: null });
      } else {
        const n = spec;
        const { gap, sw, x0, y } = slotDims(n);
        for(let i = 0; i < n; i++) slots.push({ x: x0 + i*(sw+gap) + sw/2, y, w: sw, h: sw, piece: null });
      }
      fitTiles();
    }
    function layoutSlots(){          // recompute geometry on resize, keeping placed pieces
      const n = slots.length; if(!n) return;
      if(grid){
        const { gap, sw, x0, y0 } = gridDims(grid.cols, grid.rows, grid.top, grid.pile);
        slots.forEach((s, i) => {
          const r = Math.floor(i / grid.cols), c = i % grid.cols;
          s.x = x0 + c*(sw+gap) + sw/2; s.y = y0 + r*(sw+gap); s.w = sw; s.h = sw;
          if(s.piece) Body.setPosition(s.piece.body, { x: s.x, y: s.y });
        });
        return;
      }
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
        /* a glide whose slot is gone (knocked out, rebuilt, any race) must
           DIE, not dereference slots[null] — that throw killed the page's
           whole rAF loop once, silently */
        if(b.slot == null || !slots[b.slot]){ b.dock = null; continue; }
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
      if(gp && gp.shot) gp.shot = 0;   // picked up, it's an ordinary tile now
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
      /* The arm cap is the pendulum's length — the grabArm dial. At 0.6 a fat
         finger on a tile's corner pinned it a whole half-tile off centre and
         the tile dangled below the touch point; near the centre the pin
         tracks. 0 recentres every grab dead under the finger. */
      const maxR = feel.size * feel.grabArm, len = Math.hypot(dx, dy);
      if(len > maxR){ dx = dx / len * maxR; dy = dy / len * maxR; }
      const anchor = { x: body.position.x + dx, y: body.position.y + dy };
      const constraint = Constraint.create({
        pointA: { x: anchor.x, y: anchor.y }, bodyB: body, pointB: { x: dx, y: dy },
        /* The damping dial: enough settles the pendulum in a beat (0.1
           wobbled), too much fights the chase — damping resists the body's
           velocity toward a MOVING finger, so every extra point is drag lag.
           Safe at modest values now the throw rides the finger's velocity,
           not the damped body's. */
        stiffness: stiffnessOf(feel.swing), damping: feel.damping, length: 0
      });
      Composite.add(engine.world, constraint);
      grips.set(id, { body, constraint, fingerStart: { x, y }, anchor,
                      hist: [{ x, y, t: now() }] });   // recent finger track — the dock/flick signal
      return true;
    }
    function nearest(x, y, exclude){
      let best = null, bestD = Infinity;
      for(const p of pieces){
        if(exclude && exclude.has(p.body)) continue;
        const dx = p.body.position.x - x, dy = p.body.position.y - y, d = dx*dx + dy*dy;
        if(d < bestD){ bestD = d; best = p.body; }
      }
      const tol = feel.size * feel.reach;   // the fat-finger dial
      return (best && bestD <= tol*tol) ? best : null;
    }
    function move(id, x, y){
      const g = grips.get(id);
      if(!g) return;
      // Move the anchor by the finger's delta from grab (not to the raw finger),
      // so an off-tile forgiving grab keeps its small constant gap and never snaps.
      g.constraint.pointA.x = g.anchor.x + (x - g.fingerStart.x);
      g.constraint.pointA.y = g.anchor.y + (y - g.fingerStart.y);
      g.hist.push({ x, y, t: now() });
      if(g.hist.length > 8) g.hist.shift();
    }
    /* How the FINGER was moving at release, as a velocity vector in px per
       physics step. Matter's constraint solver moves a dragged body
       positionally — and the drag damper brakes it besides — so the body's
       own velocity under-reports even a violent flick: the finger track is
       the honest gesture signal. Only the last ~120ms count: a drag that
       pauses over a slot before letting go reads as stationary. */
    function gripVel(g){
      const cut = now() - 120;
      const h = (g.hist || []).filter(e => e.t >= cut);
      if(h.length < 2) return { x: 0, y: 0 };
      const a = h[0], z = h[h.length - 1];
      const k = (1000 / 60) / Math.max(8, z.t - a.t);
      return { x: (z.x - a.x) * k, y: (z.y - a.y) * k };
    }
    function drop(id){
      const g = grips.get(id);
      if(!g) return;
      Composite.remove(engine.world, g.constraint);
      const b = g.body, piece = pieceOf(b);
      grips.delete(id);
      /* Dock only a SLOW release — a deliberate placement. A piece released
         mid-flick is a throw, and sucking it into whichever empty slot it
         happened to pass over turned every throw over a grid into an
         accidental placement. feel.dock is the boundary; the speed is the
         larger of the body's and the finger's (see gripVel). */
      const fv = gripVel(g);
      const fSpeed = Math.hypot(fv.x, fv.y), bSpeed = Math.hypot(b.velocity.x, b.velocity.y);
      const speed = Math.max(bSpeed, fSpeed);
      const near = speed < feel.dock ? slotNear(b.position.x, b.position.y) : -1;
      if(near >= 0 && piece){ startDock(piece, near); return; }   // dropped over a slot: suck it home
      /* The THROW rides the stronger signal too. It used to ride the body's
         velocity alone, and the day the drag damper went up every flick died
         at the release point: the damper had bled the body's speed while the
         finger was plainly flicking — classified as a throw, thrown with
         nothing. The finger vector also makes the tile fly the way the
         GESTURE moved, which the position-corrected body never quite did. */
      const v = fSpeed > bSpeed ? fv : b.velocity;
      const p = feel.power, cap = 55;
      Body.setVelocity(b, { x: clamp(v.x * p, -cap, cap), y: clamp(v.y * p, -cap, cap) });
      Body.setAngularVelocity(b, clamp(b.angularVelocity * p, -1, 1));
    }
    function clearGrips(){
      for(const g of grips.values()) Composite.remove(engine.world, g.constraint);
      grips.clear();
    }

    /* ---- step + default draw. Matter does the physics; we do the draw. ----
       step() is called once per animation frame by every caller, but frames
       are NOT 60Hz everywhere: a 120Hz phone calls twice as often, and one
       fixed update per call ran the whole game at double speed there — the
       drag spring whipped held tiles into a frenzy. So step() keeps a wall-
       clock accumulator and runs however many fixed 60Hz updates the elapsed
       time has earned (capped at 4 — a backgrounded tab must not fast-forward
       on return; the remainder is dropped). Synchronous back-to-back calls
       (the driven tests) earn at most the cap between them. */
    const STEP_MS = 1000/60;
    let stepLast = 0, stepAcc = 0;
    function step(){
      /* One throw in here killed the caller's whole rAF loop once — the page
         froze mid-glide with tiles stranded off their slots and no error
         anywhere. The loop must survive any single bad state: log it, drop
         every glide (the known killer), and let the re-seat sweep put docked
         tiles back on centre. */
      try{ stepBody(); }
      catch(e){
        if(stepFails++ < 3) console.error('Kit.table step failed (recovering):', e);
        for(const p of pieces) p.dock = null;
      }
    }
    let stepFails = 0;
    function stepBody(){
      const t = now();
      if(!stepLast) stepLast = t - STEP_MS;   // first call runs exactly one update
      stepAcc += t - stepLast;
      stepLast = t;
      if(stepAcc > STEP_MS * 4) stepAcc = STEP_MS * 4;
      while(stepAcc >= STEP_MS){
        Engine.update(engine, STEP_MS);
        stepAcc -= STEP_MS;
        /* A held tile may swing under gravity but never windmill: the spring's
           off-centre pull adds torque every update, and on a fast drag it
           compounds into a crazy spin before release. */
        for(const g of grips.values()){
          const av = g.body.angularVelocity;
          if(av > 0.6 || av < -0.6) Body.setAngularVelocity(g.body, clamp(av, -0.6, 0.6));
        }
      }
      tickDocks();
      tickExits();
      if(t - lastSweep > 250){ lastSweep = t; sweepResters(); }
    }
    /* A loose tile may never come to REST inside the grid. Settled flat on a
       docked tile — a slow release onto a full cell, or a thrown tile that
       petered out on a formed word — it sits a few px off a cell centre and
       reads as a broken dock (a classroom screenshot showed a word column
       wearing two such imposters). A slow loose tile lying on an occupied
       cell gets a firm kick toward the board's centre — deliberately INWARD,
       never toward an open side, or the kick itself would gift the tile to a
       neighbour — and tumbles home to the pile, where loose tiles live. Held
       tiles, gliding docks, and anything still moving are left alone: the
       rain and real throws cross the grid at speed. */
    let lastSweep = 0;
    function sweepResters(){
      /* The re-seat: DOCKED MEANS CENTRED, enforced rather than trusted.
         Real handsets have produced docked tiles stranded a few px off their
         slot (a frozen loop was one cause; a classroom screenshot proved at
         least one more) — whatever moved them, a settled docked tile that
         has drifted more than a pixel is put back on its centre. Gliding
         tiles are mid-tween and left to arrive. */
      for(const s of slots){
        if(!s.piece || s.piece.dock) continue;
        const b = s.piece.body;
        if(Math.abs(b.position.x - s.x) > 1 || Math.abs(b.position.y - s.y) > 1)
          Body.setPosition(b, { x: s.x, y: s.y });
      }
      if(!grid) return;
      const held = heldBodies();
      for(const p of pieces){
        if(p.slot != null || p.dock || p.body.isStatic || held.has(p.body)) continue;
        const b = p.body;
        if(Math.hypot(b.velocity.x, b.velocity.y) > 0.5) continue;
        const onWord = slots.some(s => s.piece &&
          Math.abs(b.position.x - s.x) < s.w * 0.75 &&
          b.position.y < s.y && s.y - b.position.y < s.w * 1.4);
        if(onWord){
          Body.setVelocity(b, { x: b.position.x < cssW/2 ? 4 : -4, y: 1 });
          Body.setAngularVelocity(b, 0.12);
        }
      }
    }
    function draw(){
      ctx.clearRect(0, 0, cssW, cssH);
      slots.forEach((s, i) => {       // answer slots, behind the pieces; filled slots glow by result
        const res = resultMap.get(i) || result;
        const half = s.w/2, r = Math.round(s.w*0.16);
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = s.piece
          ? (res === 'right' ? '#6FB04A' : res === 'wrong' ? '#E2603B' : '#5a6473')
          : '#39414f';
        if(!s.piece) ctx.setLineDash([6, 7]);
        roundRect(ctx, s.x - half, s.y - half, s.w, s.w, r);
        ctx.stroke();
        ctx.restore();
      });
      for(const b of pieces){
        const p = b.body.position, docking = !!b.dock, inSlot = b.slot != null;
        let s, ang;
        if(docking){ s = tile + (slots[b.slot].w - tile) * b.dock.p; ang = b.body.angle; }
        else if(inSlot){ s = slots[b.slot].w; ang = 0; }
        else { s = tile; ang = b.body.angle; }
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
      if(next.swing != null || next.damping != null){
        const k = stiffnessOf(feel.swing);
        for(const g of grips.values()){ g.constraint.stiffness = k; g.constraint.damping = feel.damping; }
      }
    }

    return {
      reset(){ clearGrips(); if(pieces.length) Composite.remove(engine.world, pieces.map(p => p.body)); pieces = []; slots = []; grid = null; clearResult(); },
      setPieces, addPiece, slots: makeSlots, place, openSides,
      read, cells, filled, setResult,
      /* the loose pieces (not slotted), letter + colour + height + velocity —
         a driven test's only window onto what is lying on the table, since
         read() sees slots alone. vx/vy are what a release just imparted. */
      loose: () => pieces.filter(p => p.slot == null)
                         .map(p => ({ ch: p.ch, hue: p.hue, y: Math.round(p.body.position.y),
                                      vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y) })),
      /* slot geometry + the fitted tile size, for callers that aim or assert
         at real coordinates (the suite fires its test shots at a slot's row) */
      slotBox: i => slots[i] ? { x: slots[i].x, y: slots[i].y, w: slots[i].w } : null,
      /* the docked piece's BODY centre for slot i — a docked tile must sit
         dead on its slot centre whatever happened on the way in, and the
         suite asserts the two agree */
      pieceAt: i => (slots[i] && slots[i].piece)
        ? { x: slots[i].piece.body.position.x, y: slots[i].piece.body.position.y } : null,
      /* suite-only: displace a docked body off its slot, standing in for
         whatever strands one in the wild — the re-seat sweep must undo it */
      _nudgeDocked: i => { const s = slots[i]; if(s && s.piece) Body.setPosition(s.piece.body, { x: s.x + 6, y: s.y + 5 }); },
      tileSize: () => tile,
      /* a loose tile's mass — the suite pins that it is the same on every
         screen size, because the drag spring is tuned against it */
      tileMass: () => { const p = pieces.find(q => !q.body.isStatic); return p ? p.body.mass : 0; },
      /* Client event -> this canvas's NATURAL coordinate space. The canvas can be
         painted at another size than its layout box (the scaled clue card), or the
         layout box can drift from what a finger actually touches on a real phone
         (browser zoom, font scaling, pinch) — either way the painted/natural ratio
         maps the touch back onto the physics, and a raw clientX-rect offset lands
         the grab ABOVE the tile, worst at the bottom of a stretched canvas. Four
         callers each wrote this mapping; two of them wrote it without the ratio,
         which is that bug. The shelf is its one home now. */
      pt: e => {
        const r = canvas.getBoundingClientRect();
        const sx = (r.width / canvas.offsetWidth) || 1, sy = (r.height / canvas.offsetHeight) || 1;
        return { x: (e.clientX - r.left) / sx, y: (e.clientY - r.top) / sy };
      },
      setFeel, resize: sizeToCanvas,
      /* the current feel, construction overrides included — what a Tune
         panel seeds its sliders from */
      feel: () => Object.assign({}, feel),
      grab, move, drop,
      heldBy: id => grips.has(id), anyHeld: () => grips.size > 0,
      step, draw
    };
  }

  /* ---- the Tune panel, built from the dials ----
     A page hands a mount and its world; one .ctl row per dial appears (the
     playground pages' own slider styling), seeded from the world's CURRENT
     feel — construction overrides included — and wired to setFeel. The pages
     hold no copy of any default: the row count and every number come from
     DIALS, so a dial declared there grows every panel with nothing edited.
     opts.onChange(key, value) lets a page react (Battle Scrabble re-deals
     when the box size moves). */
  makeTable.dialsPanel = function(mount, world, opts){
    const f = world.feel();
    DIALS.forEach(d => {
      const row = document.createElement('div');
      row.className = 'ctl'; row.dataset.dial = d.k;
      const lab = document.createElement('label'); lab.textContent = d.label;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.id = 's-' + d.k;
      inp.min = d.min; inp.max = d.max; inp.step = d.step; inp.value = f[d.k];
      const out = document.createElement('span');
      out.className = 'val'; out.id = 'v-' + d.k;
      const show = v => { out.textContent = d.fmt(v); };
      inp.addEventListener('input', () => {
        const v = +inp.value; show(v);
        const patch = {}; patch[d.k] = v;
        world.setFeel(patch);
        if(opts && opts.onChange) opts.onChange(d.k, v);
      });
      show(f[d.k]);
      row.appendChild(lab); row.appendChild(inp); row.appendChild(out);
      mount.appendChild(row);
    });

    /* Save / Reset, plus a line that always says which feel this device is
       on — a saved overlay that nobody can see is the stuck-default trap,
       so visibility is the price of having Save at all. Save writes the
       CURRENT feel; every table built on this device inherits it from then
       on. Reset clears the save and walks this world (and the sliders) back
       to the code defaults. */
    const act = document.createElement('div');
    act.dataset.dialActions = '1';
    act.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button'; saveBtn.id = 'dial-save'; saveBtn.textContent = 'Save feel';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button'; resetBtn.id = 'dial-reset'; resetBtn.textContent = 'Reset dials ↺';
    const note = document.createElement('span');
    note.id = 'dial-note';
    note.style.cssText = 'font-size:0.72rem;opacity:0.75;';
    const sayState = () => {
      note.textContent = savedFeel() ? 'Saved feel active on this device'
                                     : 'Using the code defaults';
    };
    saveBtn.addEventListener('click', () => {
      const v = {};
      const cur = world.feel();
      DIALS.forEach(d => { v[d.k] = cur[d.k]; });
      try{ localStorage.setItem(FEEL_STORE, JSON.stringify({ v })); }catch(e){}
      sayState();
    });
    resetBtn.addEventListener('click', () => {
      try{ localStorage.removeItem(FEEL_STORE); }catch(e){}
      const cur = world.feel(), patch = {};
      DIALS.forEach(d => {
        if(cur[d.k] !== d.def){
          patch[d.k] = d.def;
          const inp = document.getElementById('s-' + d.k), out = document.getElementById('v-' + d.k);
          if(inp) inp.value = d.def;
          if(out) out.textContent = d.fmt(d.def);
        }
      });
      world.setFeel(patch);
      if(opts && opts.onChange) Object.keys(patch).forEach(k => opts.onChange(k, patch[k]));
      sayState();
    });
    sayState();
    act.appendChild(saveBtn); act.appendChild(resetBtn); act.appendChild(note);
    mount.appendChild(act);
  };
  makeTable.dials = DIALS;
  window.HubKit.table = makeTable;
})();
