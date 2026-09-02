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
     reset(), setPieces(labels[]), slots(n | {cols,rows,top,pile,bar}), place(i,label),
     addPiece(label, {x,y,vx,vy,spin,hue,shot}), openSides({l,r}),
     read()->string, cells()->string[], filled()->bool, loose(),
     setResult(res[, slotIdx]), slotBox(i), tileSize(),
     setFeel(partial), feel(), resize(), pt(event),
     grab(id,x,y), move(id,x,y), drop(id), heldBy(id), heldCh(id), anyHeld(),
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
     seeds its feel from the defaults (a caller MAY still override a dial at
     construction, but after the size standardisation none does — every physics
     space takes its size and feel from here, and a game only picks its own
     shape), and the playground Tune panels BUILD themselves via Kit.table.dialsPanel
     — so a new dial appears on every panel by being declared here, and a tuned
     value is one edit that every caller inherits (Battle Scrabble, the round
     physics modes, join.html's table mode, Throw Lab).

     The values in this table are the truth for EVERY device. On top of them
     sits one explicit, per-device overlay: the Tune panels' Save button
     writes the current feel to localStorage, and every table built on that
     device then inherits it (a caller's own constructor override still wins
     — the flick card keeps its size). This is deliberately not the silent
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
    { k:'dock',        label:'Place below', min:2,   max:30,   step:1,     def:14,   fmt:v => String(v) },                   // dock-on-release only below this speed (px/step)
    /* Grid LOOK — the visual framework every grid caller inherits, tuned here and
       nowhere else. MULTIPLIERS on the shelf's own defaults, so ×1 is exactly
       today's look and nothing moves until tuned. `gridLine` scales the slot
       outline (draw-only, live); `gridGap` scales the space between cells (layout,
       so it lands on the next deal). Corner radius is deliberately NOT a dial: it
       is shared with the physics chamfer set when a tile is built, and the two
       must match or the drawn corner overhangs the collision hull. */
    { k:'gridLine',    label:'Grid line',   min:0.5, max:3,    step:0.25,  def:1,    fmt:v => '×' + v.toFixed(2) },
    { k:'gridGap',     label:'Grid gap',    min:0,   max:3,    step:0.25,  def:1,    fmt:v => '×' + v.toFixed(2) },
    /* LOOKS — the effects every table paints, each a draw-only dial (live, no
       setFeel branch, 0 = off). An effect is paint from a STAMP the shelf wrote
       when the fact happened (a tile landed, a slot was judged, a word completed)
       and never a body impulse: the physics is untouched and a phone at 120Hz
       draws the same picture as the board at 60. Tuned on Throw Lab's Looks
       block, against the phone's painted surface AND a card round's transparent
       one, because a halo composites differently on each. */
    { k:'pop',         label:'Landing pop', min:0,   max:0.5,  step:0.02,  def:0.18, fmt:v => '×' + v.toFixed(2) },   // scale overshoot after a dock
    { k:'glow',        label:'Correct glow',min:0,   max:1,    step:0.05,  def:0.7,  fmt:v => v.toFixed(2) },          // halo strength behind a right tile
    { k:'shake',       label:'Wrong shake', min:0,   max:14,   step:1,     def:6,    fmt:v => v + 'px' },              // paint offset on a wrong tile
    { k:'party',       label:'Word burst',  min:0,   max:3,    step:0.25,  def:1,    fmt:v => '×' + v.toFixed(2) }     // particle count when a word completes
  ];

  /* A colour with its alpha replaced — hex (#rgb, #rrggbb) or rgb()/rgba(); anything
     else is handed back as is. The halo sprite's gradient needs the theme colour
     fading to transparent, and a theme hands it over as either shape. */
  function withAlpha(col, a){
    const c = String(col || '').trim();
    let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if(m){
      let h = m[1]; if(h.length === 3) h = h.split('').map(x => x + x).join('');
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    m = c.match(/^rgba?\(([^)]+)\)$/i);
    if(m){ const parts = m[1].split(',').slice(0, 3).map(x => x.trim()); return `rgba(${parts.join(',')},${a})`; }
    return c;
  }

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
    /* Rotation lock is a per-round BEHAVIOUR, not a tuned number, so it is not
       a dial: it carries no slider, is never written into the saved feel, and
       a round declares it once at construction.
         default (unset / false)  every tile rotates, whatever its shape — a
                                   word rectangle swings and tumbles exactly
                                   like a square letter
         true                     freeze every tile's rotation flat
       For now the shapes behave identically by default; a round that wants its
       word tiles pinned flat opts in with lockRot:true, and later rounds can
       carry their own physics. `rotLocked()` reads it; setPieces uses it for
       the deal angle, normalizeMass for the inertia freeze. Held live through
       setFeel + a re-deal, which is how Throw Lab flips it. */
    feel.lockRot = opts.lockRot;
    function rotLocked(){ return !!feel.lockRot; }
    /* Upright settling is the THIRD rotation behaviour, between free tumble and
       the hard freeze. A round wants it when its tiles are WIDE words that must
       read the right way up and pile tidily, but a stack of them looks dead if
       they cannot lean at all (lockRot). So an upright tile still rotates — it
       tumbles in flight and leans where it is propped — but it is dealt flat, it
       barely bounces, and once it slows it settles: its wobble is bled off so a
       tile alone on the floor comes to rest truly flat (not the few degrees the
       free solver leaves), and a tile trying to balance on its narrow edge is
       tipped back down. What it never does is force flat: a genuine lean against
       a neighbour, under the edge angle, is left exactly as the contacts hold it.
       Opt-in per round like lockRot; `settleUpright()` in the step does the work,
       setPieces/addPiece deal it flat and quiet its bounce. lockRot wins if both
       are set (a frozen tile has no rotation to settle). */
    feel.upright = opts.upright;
    function upright(){ return !rotLocked() && !!feel.upright; }
    /* Whether loose tiles are swept OUT of the grid. "No tile may rest inside the
       grid" is the crossword rule Battle Scrabble needs — a loose tile must never
       sit on a placed word — so a resting loose tile over a filled slot gets a
       sideways shove and a spin. That reads as a JIGGLE in a slots-as-bins game
       (a category sort), where a flicked tile SHOULD rest naturally near the grid:
       parked above a filled slot it was kicked (~4px) and spun (0.12rad) every
       250ms and never settled. On by default (BS and the arrangement rounds keep
       it); a game that wants natural rest opts out with sweepGrid:false. */
    feel.sweepGrid = opts.sweepGrid !== false;
    /* The play SURFACE the canvas paints under everything — the design-once LOOK,
       tuned on Throw Lab and inherited by every caller. Before this the background
       was the host page's CSS on the canvas element, so the look drifted per page
       and a phone needed a bordered "inner box"; now the canvas paints its own
       surface and any caller that sizes it full-bleed gets the identical play area,
       no per-page CSS. Resolved opts → Throw Lab's saved overlay → default, exactly
       like a feel dial, so the colour is set in ONE place. A caller may pass
       `surface:null` for a transparent canvas — the board's clue card IS its surface,
       so `Kit.round.cardTable` opts out and the card shows through; a phone has no
       card, so it keeps the painted default. */
    feel.surface = opts.surface !== undefined ? opts.surface
                 : (saved && saved.surface != null ? saved.surface : '#0e1230');
    engine.gravity.y = feel.gravity;
    engine.constraintIterations = 6;   // pulls a held piece to the finger harder each frame, so a fast drag lags less

    let cssW = 0, cssH = 0, dpr = 1;
    let tile;                    // effective tile WIDTH = the fitted slot size (see fitTiles)
    let tileH;                   // effective tile HEIGHT — equals tile except in a bar grid
    let walls = [];
    let pieces = [];       // { body, ch, hue, slot, dock, pinned }
    let slots = [];        // { x, y, w, h, piece }
    /* A deal asked for before the canvas has a size — the hub's clue card renders
       its round while the modal is still display:none, so every board-face round
       dealt into a 0px world, the spread came out negative, and the first real
       resize clamped the whole hand against the left wall (a column of word tiles
       on top of the first slot). The hand waits here until sizeToCanvas() has a
       real box to deal it into. */
    let pendingDeal = null;
    /* Slots given away — slot index -> label. A hint's move: the tile flies into
       its slot and is pinned there. Kept as a map so a give asked for before the
       deal lands (see pendingDeal), or after a re-deal, is honoured when the tiles
       exist. */
    const given = new Map();
    let result = null;     // tint for filled slots: null | 'right' | 'wrong'
    /* Per-slot tint overrides — setResult(res, [indices]) scopes the glow to
       one word's slots, so a grid can show a green word and a red run at once.
       setResult(res) with no indices stays the global tint and clears these. */
    const resultMap = new Map();
    /* ---- the looks: theme palette, stamps, and what draw() builds from them ----
       `palette` is read from the canvas's CSS custom properties once per real
       resize (the card declares --gw-good/--gw-bad/... per theme; a phone has none
       and keeps these literals, which are the colours the table always had). The
       tile text stays dark whatever the theme: the tile fills are fixed bright
       hues, and a theme's light ink would vanish on a yellow tile. */
    const palette = { good:'#6FB04A', bad:'#E2603B', accent:'#FFC83D', line:'#39414f', lineHot:'#5a6473', ink:'#101318' };
    function readPalette(){
      let cs = null;
      try{ cs = getComputedStyle(canvas); }catch(e){ return; }
      const get = (name, fb) => { const v = cs.getPropertyValue(name); return v && v.trim() ? v.trim() : fb; };
      palette.good    = get('--gw-good', '#6FB04A');
      palette.bad     = get('--gw-bad',  '#E2603B');
      palette.accent  = get('--gold',    '#FFC83D');
      palette.line    = get('--gw-line', '#39414f');
      palette.lineHot = get('--gw-hot',  '#5a6473');
      halos.clear();   // sprites carry a colour and a size; both may have moved
    }
    const resultAt = new Map();   // slot -> when it was last judged (the shake's clock)
    let resultAt0 = 0;            // the unscoped judgement's clock
    let wordAt = 0;               // when a word last completed right (the burst's clock)
    let partyFrom = null;         // the slots that word occupied, or null for all right slots
    let wasRight = false;         // unscoped: so a repeated setResult('right') is one burst, not many
    const rightKeys = new Set();  // scoped: which idx-groups are currently right
    const halos = new Map();      // `${colour}|${w}|${h}` -> pre-rendered halo sprite
    let particles = null;         // the live burst, or null
    let lastDraw = 0;
    function clearResult(){ result = null; resultMap.clear(); resultAt.clear(); resultAt0 = 0; wasRight = false; rightKeys.clear(); }
    function setResult(res, idx){
      const t = now();
      if(idx){
        for(const i of idx){ if(res == null) resultMap.delete(i); else resultMap.set(i, res); resultAt.set(i, t); }
        const key = idx.join(',');
        if(res === 'right' && !rightKeys.has(key)){ wordAt = t; partyFrom = idx.slice(); particles = null; }
        if(res === 'right') rightKeys.add(key); else rightKeys.delete(key);
      } else {
        result = res; resultMap.clear(); resultAt0 = t;
        if(res === 'right' && !wasRight && filled()){ wordAt = t; partyFrom = null; particles = null; }
        wasRight = res === 'right';
      }
    }
    /* The halo behind a right tile: one offscreen sprite per colour and size, a
       soft elliptical gradient from the theme colour to nothing, blitted with
       the glow dial as its alpha. Never ctx.shadowBlur — a blurred shadow per
       tile per frame is what makes a phone stutter. */
    function haloFor(col, w, h){
      const key = col + '|' + Math.round(w) + '|' + Math.round(h);
      let sp = halos.get(key);
      if(sp) return sp;
      const W = Math.ceil(w * 2.2), H = Math.ceil(h * 2.2);
      sp = document.createElement('canvas'); sp.width = W; sp.height = H;
      const g = sp.getContext('2d');
      g.translate(W/2, H/2); g.scale(W/2, H/2);
      const grad = g.createRadialGradient(0, 0, 0.30, 0, 0, 1);
      grad.addColorStop(0,    withAlpha(col, 0.55));
      grad.addColorStop(0.55, withAlpha(col, 0.18));
      grad.addColorStop(1,    withAlpha(col, 0));
      g.fillStyle = grad; g.fillRect(-1, -1, 2, 2);
      halos.set(key, sp);
      return sp;
    }
    function spawnBurst(){
      const from = partyFrom
        ? partyFrom.map(i => slots[i]).filter(Boolean)
        : slots.filter((s, i) => s.piece && (resultMap.get(i) || result) === 'right');
      if(!from.length){ particles = []; return; }
      const n = Math.round(24 * feel.party);
      particles = [];
      for(let k = 0; k < n; k++){
        const s = from[k % from.length];
        const a = -Math.PI/2 + (Math.random() - 0.5) * 1.6, sp = 2.2 + Math.random() * 2.6;
        particles.push({ x: s.x + (Math.random() - 0.5) * s.w * 0.6, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                         r: 2 + Math.random() * 2.5, col: Math.random() < 0.5 ? palette.accent : palette.good });
      }
    }
    tile = feel.size;            // until the first fit, a tile is its requested size
    // Drag stiffness from the swing dial. Firm enough to track the finger without
    // visible lag; the gravity swing survives because it is the piece pivoting
    // under gravity about the pinned point, which the linear spring does not damp.
    const stiffnessOf = sw => 1 - sw * 0.7;   // 1.0 (rigid) .. 0.30 (loose)

    // Multi-touch: one grip per pointer id.
    const grips = new Map();   // id -> { body, constraint, fingerStart, anchor }

    function report(){ if(given.size) unmetGives(); if(opts.onArrange) opts.onArrange(read(), filled()); }

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
      /* No layout box (the card hidden, detached, mid-swap) means nothing to size
         to — NOT a 1px world. Sized to 1px, the walls closed in and the resize's
         own keep-inside clamp pinned every tile to the top-left corner; the next
         real measure then let the whole hand fall from there, which reads as the
         deal happening again. Leave the world as it was; ensureSized() and the next
         real resize take over when there is a box to measure. */
      if(!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = Math.max(1, Math.round(w));
      cssH = Math.max(1, Math.round(h));
      readPalette();
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
        const s2 = tile / 2, h2 = (tileH || tile) / 2;
        const nx = clamp(b.position.x, open.l ? -Infinity : s2, open.r ? Infinity : cssW - s2);
        const ny = clamp(b.position.y, h2, cssH - h2);
        if(nx !== b.position.x || ny !== b.position.y){
          Body.setPosition(b, { x: nx, y: ny });
          Body.setVelocity(b, { x: 0, y: 0 });
        }
      }
      // the hand that was dealt while the canvas had no size lands now, into the real world
      if(pendingDeal && !unmeasured()){ const hand = pendingDeal; pendingDeal = null; setPieces(hand); }
    }
    /* Declare slots or deal a hand BEFORE the first resize() and the canvas has
       no measured size yet (cssW/cssH are 0). Slot dims computed against 0 come
       out at a fallback size, the tiles are built to THAT, and the first real
       resize then rescales them non-uniformly — which is exactly what stretches
       a round corner into an ellipse and makes wide word tiles overlap at the
       corners. The ordering round deals then resizes; Throw Lab resizes then
       deals and never hit it. So the shelf measures itself before it builds:
       call order stops mattering, and a caller that already sized sees a no-op.
       Guarded on the canvas actually having a layout box to measure. */
    function ensureSized(){
      if((cssW <= 1 || cssH <= 1) && (canvas.offsetWidth || canvas.offsetHeight)) sizeToCanvas();
    }
    const unmeasured = () => cssW <= 1 || cssH <= 1;
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
      const nh = slots.length ? slots[0].h : nt;   // bar slots are wide-and-short; square slots keep h = w
      if(tileH == null) tileH = tile;
      if(pieces.length && (Math.abs(nt - tile) > 0.5 || Math.abs(nh - tileH) > 0.5)){
        const fx = nt / tile, fy = nh / tileH;
        for(const p of pieces) Body.scale(p.body, fx, fy);
      }
      tile = nt; tileH = nh;
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
      /* Rotation freeze, when this world locks it (rotLocked()): a wide word
         tile must stay readable and cannot sensibly balance on its narrow
         edge, and a rectangle tipped onto that edge is what turned a contained
         pile into a cascade. setInertia(Infinity) leaves a tile with no
         rotational response, so no collision or drag force can ever spin it;
         dealt flat with zero angular velocity and no torque that can act, it
         stays flat forever — no per-frame correction, nothing to oscillate.
         setDensity above recomputes inertia from area, so the freeze is
         re-applied here, the one choke point every fit/scale/deal passes
         through — which is also what un-freezes a tile the moment a round (or
         Throw Lab) clears the lock: the real inertia is simply left in place. */
      if(rotLocked() && !b.isStatic) Body.setInertia(b, Infinity);
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
      /* An OPEN side still gets a LIP: a short wall at the bottom, the height
         of the pile band, turning the pile into a tray. Without it the open
         edge ran the full height of the screen and a resting tile nudged
         along the floor drifted out to a neighbour without ever being thrown.
         A real throw arcs above the band and leaves exactly as before. */
      const lipH = lipHeight();
      if(lipH > 0){
        if(open.l) walls.push(Bodies.rectangle(-t/2,   cssH - lipH/2, t, lipH, o));
        if(open.r) walls.push(Bodies.rectangle(cssW + t/2, cssH - lipH/2, t, lipH, o));
      }
      Composite.add(engine.world, walls);
    }
    // the tray lip is exactly the pile band — one fact, one home (the grid spec)
    function lipHeight(){ return grid ? (grid.pile != null ? grid.pile : 130) : 0; }
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
          /* too fresh to leave: the edge is a soft wall for the arrival beat.
             The bounce is HEAVY (35%, was 80%) — at 80% a hard arrival
             crossed the receiving screen in a blink and then pinballed
             between the two open edges, shedding almost nothing per bounce,
             which read as "the tile came in faster than it was thrown". One
             thud off the far wall and it settles. */
          const v = p.body.velocity;
          if((crossL && v.x < 0) || (crossR && v.x > 0))
            Body.setVelocity(p.body, { x: -v.x * 0.35, y: v.y });
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
      ensureSized();   // build the tiles at the real slot size, even if dealt before resize()
      if(pieces.length) Composite.remove(engine.world, pieces.map(p => p.body));
      pieces = [];
      const chars = (labels || []).slice();
      if(unmeasured()){ pendingDeal = chars; return; }   // no world to spread a hand across yet — see pendingDeal
      pendingDeal = null;
      /* Build each tile at the size it will actually be — the slot it drops
         into, if the caller declared its slots first (a bar round does),
         otherwise a feel.size square (every deal-before-slots caller). This
         is why a WIDE word tile is built as a rectangle rather than a square
         stretched into one: Body.scale with different x/y factors turns the
         round corner into an ELLIPSE (a 9px corner becomes ~27px across and
         ~8px tall), while draw() rounds it a uniform ~8px — so the graphic
         overhung the collision hull by the difference and neighbouring tiles
         looked like they overlapped at the corners. Built at real w×h the
         chamfer stays a matched ~8px and the picture sits on the physics. A
         square tile is unchanged: its slot is square, so w==h and there was
         never a non-uniform stretch to distort. */
      const bw = slots.length ? slots[0].w : feel.size;
      const bh = slots.length ? slots[0].h : feel.size;
      /* Dealt in ROWS, column-aligned: as many across as the canvas seats, the
         rest in rows above that fall later onto the ones below. A hand of wide
         word tiles spread evenly across a width they could not all fit came down
         as a fan — each landing half on its neighbour, the heap leaning like a
         dropped deck — and a fan of words cannot be read. Stacked in columns the
         heap is a tidy pile of legible words; a hand of square letters that fits
         one row comes out exactly as it always did. */
      const dgap = 6;
      const perRow = Math.max(1, Math.min(chars.length, Math.floor((cssW - 24 + dgap) / (bw + dgap))));
      const rowW = perRow * bw + (perRow - 1) * dgap;
      const rowX0 = (cssW - rowW) / 2 + bw/2;
      chars.forEach((ch, i) => {
        const col = i % perRow, row = Math.floor(i / perRow);
        const x = rowX0 + col * (bw + dgap);
        const y = bh/2 + 20 + row * (bh + 30) + (col % 2) * 6;
        const body = Bodies.rectangle(x, y, bw, bh, {
          chamfer:{ radius: Math.max(1, Math.round(Math.min(bw, bh) * 0.16)) },
          // Upright tiles barely bounce — a 0.45 restitution wide tile cartwheels
          // on landing and lands on an edge, which is the mess upright exists to
          // stop. The dial still rules a free or locked deal (the throw's lip
          // bounce lives on it). One home for the number: min with the dial.
          restitution: upright() ? Math.min(feel.restitution, 0.08) : feel.restitution,
          frictionAir: feel.frictionAir,
          friction: 0.3, density: 0.0016
        });
        // A locked or upright tile is dealt flat (locked stays flat; upright
        // settles flat); a free tile gets the scattered tilt and tumbles.
        Body.setAngle(body, (rotLocked() || upright()) ? 0 : (Math.random() - 0.5) * 0.3);
        // hold: a fresh deal's rain must not leak out through an open side
        // while it settles — the edge reflects it back in until this expires
        pieces.push({ body, ch: String(ch), hue: HUES[i % HUES.length],
                      slot: null, dock: null, hold: now() + 1500 });
      });
      Composite.add(engine.world, pieces.map(p => p.body));
      // Bodies are already at the slot size; fitTiles is a no-op scale here and
      // just normalizes the mass (a no-slots deal is still a square to fit later).
      tile = bw; tileH = bh;
      fitTiles();
      for(const k of given.keys()) applyGive(k);   // slots already given away take their tiles from the fresh deal
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
        restitution: upright() ? Math.min(feel.restitution, 0.08) : feel.restitution,
        frictionAir: feel.frictionAir,
        friction: 0.3, density: 0.0016
      });
      if(tile !== s || (tileH || s) !== s) Body.scale(body, tile / s, (tileH || s) / s);
      normalizeMass(body);   // addPiece never passes fitTiles, so weigh it here
      Body.setVelocity(body, { x: o.vx || 0, y: o.vy || 0 });
      Body.setAngularVelocity(body, clamp(o.spin || 0, -1, 1));
      /* A shot arrival gets a short hold too — without it a tile entering at
         speed can carom off another piece and leave again through the edge it
         came in by, and two open boards ping-pong one tile forever. */
      /* tag: an opaque value the caller attaches to a shot piece and gets back
         in onKnock — the shelf never reads it (axiom 4). Battle Scrabble puts
         the thrower's name here so the victim's flash can say who hit them. */
      pieces.push({ body, ch: String(label), hue: o.hue || HUES[pieces.length % HUES.length],
                    slot: null, dock: null, shot: o.shot ? now() : 0, tag: o.tag,
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
        if(!hit || hit.slot == null || hit.pinned) continue;   // a given tile cannot be knocked out
        const v = shot.body.velocity;
        if(Math.hypot(v.x, v.y) < KNOCK_MIN) continue;
        freeSlotOf(hit);
        hit.dock = null;   // a tile knocked MID-GLIDE keeps no tween: its slot is gone, and a tick on slots[null] threw
        Body.setStatic(hit.body, false);
        Body.setVelocity(hit.body, { x: v.x * 0.6, y: v.y * 0.6 - 2 });
        shot.shot = 0;
        clearResult();
        report();
        /* after report(): the page's onArrange has re-read the board, so a
           handler that broadcasts state broadcasts the post-knock truth */
        if(opts.onKnock) opts.onKnock({ ch: hit.ch, tag: shot.tag });
      }
    });

    /* ---- slots (the zones a piece lands in) ----
       Two shapes, one flat row-major array either way: slots(n) is the original
       centred row; slots({cols, rows}) is a grid — words read across each row
       and down each column, and cells()/read()/place(i) index it unchanged. */
    function slotDims(n){
      const margin = 16, gap = Math.max(6, Math.round(feel.size * 0.12 * feel.gridGap));
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
    function gridDims(g){
      const { top, pile, bar } = g;
      let cols = g.cols, rows = g.rows;
      const margin = 12, gap = Math.max(4, Math.round(feel.size * 0.10 * feel.gridGap));
      const yTop = top != null ? top : margin;    // room for a caller's own chrome above row 0
      /* bar: slots sized to the WORD, not the row — height fits the column
         exactly as a square grid does; width is measured from the longest
         label at the slot's own font size (draw()'s 0.56 ratio) plus
         padding, clamped to the row so a long scale never overflows. A
         square grid keeps one size for both, unchanged. */
      if(bar){
        /* A bar pile is whole words, not letter squares — several genuinely
           do not fit side by side, so the fixed 130px band tuned for a
           compact letter heap left five words with nowhere to go but on top
           of each other. Estimate a tile's nominal width (the longest label,
           measured) BEFORE the band is sized, work out how many of those fit
           per row and so how many rows the pile needs, then size the band to
           hold them — capped at half the card so the ladder itself keeps the
           rest. An explicit `pile` still wins outright, exactly as before.

           **A word tile is at least a third of the row wide.** Measured alone,
           a five-word ladder came out 121px wide on a 636px card — a rung you
           could not read from the back — and its heap stood five deep, which
           is what left word tiles resting on their edges. A third seats
           exactly three across, so the heap is two rows for a scale and the
           rung is a rung; on a handset the measured word is already wider
           than a third and nothing changes.

           **`cols:'auto'` wraps the row to fit** — as many slots across as
           tiles of that width seat, the rest on the rows below, row-major so
           slot i is still the i-th word. A nine-word sentence in ONE row was
           nine 62px boxes with the words shrunk to fit them; wrapped it is
           three rows of three at a width the word can be read at. The count
           comes from the labels (or `count`) rather than cols×rows. */
        const usable = cssW - margin*2;
        const third = Math.max(60, Math.floor((usable + gap) / 3) - gap);
        const rowMaxFor = k => Math.max(60, Math.floor((usable - gap*(k-1)) / k));
        const labels = bar.labels && bar.labels.length ? bar.labels : null;
        const measure = h => {
          if(!labels) return Math.round(rowMaxFor(cols === 'auto' ? 1 : cols) * 0.62);
          ctx.font = `700 ${Math.round(h*0.56)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
          const widest = Math.max(...labels.map(w => ctx.measureText(String(w)).width));
          return Math.max(60, Math.round(widest / 0.88) + 24);
        };
        let n = g.count || (labels ? labels.length : 0) || (cols === 'auto' ? 0 : cols * rows);
        if(!(n > 0)) n = 1;
        /* Three facts decide each other: the tile's WIDTH (the longest word at the
           tile's font, which follows its height), how many tiles that width seats
           per row (the pile's rows, and the slot columns when wrapping), and the
           tile's HEIGHT (what is left of the canvas once the slot rows and the
           heap's rows share it). Measured at the nominal height alone, a handset
           chose one column for a nine-word sentence because the words were wide
           at 56px — and then drew 35px slots two of which would have fitted. So
           the three are settled together, a few rounds until the width stops
           moving; the heap's rows are then derived from the same height rather
           than capped at a fraction, so the picture always adds up. */
        const auto = cols === 'auto';
        let sh = feel.size, perRow = 1, wAt = Math.max(measure(sh), third);
        for(let k = 0; k < 6; k++){
          perRow = Math.max(1, Math.min(n, Math.floor((usable + gap) / (wAt + gap))));
          if(auto){ cols = perRow; rows = Math.ceil(n / cols); }
          const pileRows = Math.ceil(n / perRow);
          const next = pile != null
            ? Math.floor((cssH - yTop - pile - gap*(rows-1)) / rows)
            : Math.floor((cssH - yTop - margin) / (rows + pileRows)) - gap;
          sh = Math.max(24, Math.min(feel.size, next));
          const w2 = Math.max(measure(sh), third);
          if(w2 === wAt) break;
          wAt = w2;
        }
        const rowMax = rowMaxFor(cols);
        /* rowMax can be 0 or negative on the very first frame (canvas not yet
           laid out, cssW still 0) — floored at 60 before it clamps anything,
           or a genuinely-narrow reading fed straight into Math.min went
           negative and drew a piece with a negative roundRect radius. */
        const sw = Math.max(60, Math.min(rowMax, wAt));
        const x0 = (cssW - (cols*sw + (cols-1)*gap)) / 2;
        return { gap, sw, sh, x0, y0: yTop + sh/2, cols, rows, count: n };
      }
      if(cols === 'auto'){ cols = Math.max(1, Math.round(Math.sqrt(g.count || 1))); rows = Math.ceil((g.count || 1) / cols); }
      const pileH = pile != null ? pile : 130;    // the loose-tile band below the grid (a settled heap is 1-2 tiles deep)
      const sw = Math.max(20, Math.min(feel.size,
        Math.floor((cssW - margin*2 - gap*(cols-1)) / cols),
        Math.floor((cssH - yTop - pileH - gap*(rows-1)) / rows)));
      const x0 = (cssW - (cols*sw + (cols-1)*gap)) / 2;
      const y0 = yTop + sw/2;
      return { gap, sw, sh: sw, x0, y0, cols, rows, count: g.count || cols * rows };
    }
    let grid = null;               // {cols, rows} when the slots are a grid
    function makeSlots(spec){
      ensureSized();   // measure before computing slot dims, even if slots are declared before resize()
      slots = []; grid = null;
      if(!spec){ fitTiles(); return; }
      if(typeof spec === 'object'){
        grid = { cols: spec.cols, rows: spec.rows, top: spec.top, pile: spec.pile,
                 count: spec.count || (spec.cols === 'auto' && spec.labels ? spec.labels.length : null),
                 bar: spec.bar ? { labels: spec.labels || null } : null };
        const d = gridDims(grid);
        for(let i = 0; i < d.count; i++){
          const r = Math.floor(i / d.cols), c = i % d.cols;
          slots.push({ x: d.x0 + c*(d.sw+d.gap) + d.sw/2, y: d.y0 + r*(d.sh+d.gap), w: d.sw, h: d.sh, piece: null });
        }
      } else {
        const n = spec;
        const { gap, sw, x0, y } = slotDims(n);
        for(let i = 0; i < n; i++) slots.push({ x: x0 + i*(sw+gap) + sw/2, y, w: sw, h: sw, piece: null });
      }
      fitTiles();
      if(open.l || open.r) buildWalls();   // the tray lip follows the grid's pile band
    }
    function layoutSlots(){          // recompute geometry on resize, keeping placed pieces
      const n = slots.length; if(!n) return;
      if(grid){
        const { gap, sw, sh, x0, y0, cols } = gridDims(grid);
        slots.forEach((s, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          s.x = x0 + c*(sw+gap) + sw/2; s.y = y0 + r*(sh+gap); s.w = sw; s.h = sh;
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
      const cap = (slots.length ? Math.min(slots[0].w, slots[0].h) : feel.size) * 0.85;
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
        if(raw >= 1){ b.dock = null; b.landed = t; Body.setAngle(b.body, 0); report(); }   // arrangement changed once it is home; `landed` is the pop's clock
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

    /* ---- a given tile: the hint's move ----
       Fly the free tile carrying `label` into slot i on the same suck-and-spin glide
       a finger's release uses, and PIN it: a given tile is a fact on the board, not
       a move to undo, so grab refuses it and a knock passes it by. A wrong occupant
       is popped out first; the right tile already home is simply pinned; the right
       tile sitting in another slot is pulled from there. Remembered per slot, so a
       give asked for before the deal has landed (the card was still hidden — see
       pendingDeal) or across a re-deal is honoured once the tiles exist, and the
       arrangement report re-tries any give a held tile was blocking. */
    function give(i, label){
      if(i < 0 || i >= slots.length) return false;
      given.set(i, String(label));
      return applyGive(i);
    }
    function applyGive(i){
      const label = given.get(i), s = slots[i];
      if(label == null || !s) return false;
      if(s.piece && s.piece.ch === label){ s.piece.pinned = true; return true; }
      const held = heldBodies();
      let p = pieces.find(pp => pp.slot == null && !pp.dock && !held.has(pp.body) && pp.ch === label);
      if(!p) p = pieces.find(pp => pp.ch === label && !pp.pinned && !held.has(pp.body));   // docked in the wrong slot
      if(!p) return false;
      if(s.piece && s.piece !== p) pop(s.piece);
      if(p.slot != null){ freeSlotOf(p); }
      p.dock = null; p.shot = 0; p.pinned = true;
      startDock(p, i);
      return true;
    }
    // a wrong occupant leaves its slot with a small hop, so the eviction reads as a move
    function pop(p){
      freeSlotOf(p); p.dock = null;
      Body.setStatic(p.body, false);
      Body.setVelocity(p.body, { x: (Math.random() - 0.5) * 4, y: -6 });
      Body.setAngularVelocity(p.body, (Math.random() - 0.5) * 0.2);
    }
    function unmetGives(){
      for(const i of given.keys()){
        const s = slots[i];
        if(s && !(s.piece && s.piece.ch === given.get(i))) applyGive(i);
      }
    }

    /* ---- input surface (one grip per pointer id) ---- */
    function heldBodies(){ const set = new Set(); for(const g of grips.values()) set.add(g.body); return set; }
    function grab(id, x, y){
      // Strict hit first (a stack grabs the piece you're over), then a forgiving
      // nearest-centre fallback (a fat fingertip lands slightly off a small tile).
      // A piece another finger holds is off-limits, or two fingers fight over it.
      const taken = heldBodies();
      // a pinned (given) tile is a fact on the board, not a move to undo — neither a
      // hit nor the forgiving nearest-centre fallback may pick it up
      const free = pieces.filter(p => !taken.has(p.body) && !p.pinned).map(p => p.body);
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
        if(p.pinned) continue;
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
      if(upright()) settleUpright();
      tickDocks();
      tickExits();
      if(t - lastSweep > 250){ lastSweep = t; sweepResters(); }
    }
    /* Settle a wide tile flat once it stops flying, without ever forcing a lean
       flat. Runs only for an upright() world, on loose tiles that have slowed to
       near rest — a tile still crossing the table under a flick is left alone.
       Two forces, and only these:
         · a wobble bleed (ANG_DAMP) so a lone tile's residual tilt dies into a
           true flat rest instead of the couple of degrees the free solver leaves;
         · a restoring kick, and ONLY past LEAN_MAX — a tile more than a lean away
           from UPRIGHT (text-up, angle 0) gets nudged back toward it. The target
           is 0, not the nearest flat: a word rotated to π lies flat but reads
           upside down, and a tile that must be read has one right way up. So this
           tips a tile off its narrow edge (~90°) AND rights one that has flopped
           inverted (~180°). Under LEAN_MAX nothing is applied, so a tile genuinely
           propped against a neighbour keeps exactly the lean the contact gives it.
       Gravity still does the real flattening of an unsupported tile; this only
       lets it come to rest upright and refuses the angles a readable tile must
       never hold — on its edge, or on its head. */
    const SETTLE_SPEED = 3;      // px/step — above this the tile is still in flight, untouched
    const ANG_DAMP = 0.8;        // per-frame angular-velocity bleed for a slow tile
    const LEAN_MAX = 0.72;       // rad (~41°) — beyond this from upright is tipped back
    const EDGE_KICK = 0.05;      // rad/step restoring velocity past LEAN_MAX
    const TAU = Math.PI * 2;
    function settleUpright(){
      const held = grips.size ? heldBodies() : null;
      for(const p of pieces){
        const b = p.body;
        if(b.isStatic || p.slot != null || p.dock || (held && held.has(b))) continue;
        if(Math.hypot(b.velocity.x, b.velocity.y) > SETTLE_SPEED) continue;   // still flying
        let err = b.angle % TAU;                                 // distance from UPRIGHT (0)
        if(err > Math.PI) err -= TAU; else if(err <= -Math.PI) err += TAU;   // normalise to (-π, π]
        let av = b.angularVelocity * ANG_DAMP;                   // bleed the wobble → a true rest
        if(err > LEAN_MAX) av -= EDGE_KICK;                      // past a lean (edge, or inverted) → right it
        else if(err < -LEAN_MAX) av += EDGE_KICK;
        Body.setAngularVelocity(b, av);
      }
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
      if(!grid || !feel.sweepGrid) return;   // a sort wants loose tiles to rest naturally
      const held = heldBodies();
      for(const p of pieces){
        if(p.slot != null || p.dock || p.body.isStatic || held.has(p.body)) continue;
        const b = p.body;
        if(Math.hypot(b.velocity.x, b.velocity.y) > 0.5) continue;
        const onWord = slots.some(s => s.piece &&
          Math.abs(b.position.x - s.x) < s.w * 0.75 &&
          b.position.y < s.y && s.y - b.position.y < s.h * 1.4);
        if(onWord){
          Body.setVelocity(b, { x: b.position.x < cssW/2 ? 4 : -4, y: 1 });
          Body.setAngularVelocity(b, 0.12);
        }
      }
    }
    function draw(){
      const t = now();
      const dt = lastDraw ? Math.min(50, t - lastDraw) : 16; lastDraw = t;
      ctx.clearRect(0, 0, cssW, cssH);
      /* The canvas paints its own play surface (design-once look). `surface:null`
         leaves it transparent — the board's clue card showing through. */
      if(feel.surface){ ctx.fillStyle = feel.surface; ctx.fillRect(0, 0, cssW, cssH); }
      const resOf = i => resultMap.get(i) || result;
      const judgedAt = i => resultMap.has(i) ? (resultAt.get(i) || 0) : resultAt0;
      slots.forEach((s, i) => {       // answer slots, behind the pieces; filled slots glow by result
        const res = resOf(i);
        const r = Math.round(Math.min(s.w, s.h)*0.16);
        ctx.save();
        /* empty slots: a thin SOLID tile-shaped outline — the dashed marching
           ants read as placeholder chrome; a quiet tile silhouette reads as
           "a tile goes here". Filled slots keep the heavier stroke so the
           right/wrong glow stays visible from arm's length. */
        ctx.lineWidth = (s.piece ? 2.5 : 1.25) * feel.gridLine;
        ctx.strokeStyle = s.piece
          ? (res === 'right' ? palette.good : res === 'wrong' ? palette.bad : palette.lineHot)
          : palette.line;
        roundRect(ctx, s.x - s.w/2, s.y - s.h/2, s.w, s.h, r);
        ctx.stroke();
        ctx.restore();
      });
      /* The correct glow: a pre-rendered halo behind every right tile, breathing
         slowly (about one breath a second) so a finished word reads as alive
         rather than merely outlined. Drawn behind the pieces so the letters stay
         crisp on top of it. */
      if(feel.glow > 0){
        const pulse = 0.6 + 0.4 * Math.sin(t / 160);
        ctx.save();
        ctx.globalAlpha = Math.min(1, feel.glow * pulse);
        slots.forEach((s, i) => {
          if(!s.piece || resOf(i) !== 'right') return;
          const sp = haloFor(palette.good, s.w, s.h);
          ctx.drawImage(sp, s.x - sp.width/2, s.y - sp.height/2);
        });
        ctx.restore();
      }
      /* the tray lips, drawn faintly — a tile bouncing off an invisible wall
         at the bottom corner would read as a glitch; a visible rim reads as
         the tray it is */
      const lipH = lipHeight();
      if(lipH > 0 && (open.l || open.r)){
        ctx.save();
        ctx.strokeStyle = palette.line; ctx.lineWidth = 3;
        ctx.beginPath();
        if(open.l){ ctx.moveTo(1.5, cssH); ctx.lineTo(1.5, cssH - lipH); }
        if(open.r){ ctx.moveTo(cssW - 1.5, cssH); ctx.lineTo(cssW - 1.5, cssH - lipH); }
        ctx.stroke();
        ctx.restore();
      }
      const breath = (wordAt && t - wordAt < 500) ? 1 + 0.04 * Math.sin(Math.PI * (t - wordAt) / 500) : 1;
      for(const b of pieces){
        const p = b.body.position, docking = !!b.dock, inSlot = b.slot != null;
        const th = tileH || tile;
        let w, h, ang;
        if(docking){ const sl = slots[b.slot];
          w = tile + (sl.w - tile) * b.dock.p; h = th + (sl.h - th) * b.dock.p; ang = b.body.angle; }
        else if(inSlot){ const sl = slots[b.slot]; w = sl.w; h = sl.h; ang = 0; }
        else { w = tile; h = th; ang = b.body.angle; }
        const r = Math.round(Math.min(w, h)*0.16);
        /* The paint-only effects. `sc` scales the tile about its centre, `dx`
           slides it; neither touches the body, so what the physics knows is
           exactly what it knew. */
        let sc = 1, dx = 0;
        if(inSlot){
          const res = resOf(b.slot);
          if(feel.pop > 0 && b.landed){                      // the landing pop: a swell that settles
            const u = (t - b.landed) / 320;
            if(u < 1) sc *= 1 + feel.pop * Math.sin(Math.PI * u) * (1 - u);
          }
          if(res === 'right') sc *= breath;                   // the whole word breathes once when it completes
          if(res === 'wrong' && feel.shake > 0){              // the wrong shake: a shudder that dies out
            const ms = t - judgedAt(b.slot);
            if(ms >= 0 && ms < 360) dx = feel.shake * Math.sin(ms / 18) * Math.exp(-ms / 120);
          }
        }
        ctx.save();
        ctx.translate(p.x + dx, p.y);
        ctx.rotate(ang);
        if(sc !== 1) ctx.scale(sc, sc);
        ctx.fillStyle = b.hue;
        roundRect(ctx, -w/2, -h/2, w, h, r);
        ctx.fill();
        if(b.pinned){   // the given mark: a thin inner ring, the tile's own colour showing through
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
          roundRect(ctx, -w/2 + 3, -h/2 + 3, w - 6, h - 6, Math.max(1, r - 2));
          ctx.stroke();
        }
        ctx.fillStyle = palette.ink;
        /* Text fits the tile: a single letter draws at the tuned 0.56 ratio;
           a longer label (a bar tile's whole word) is measured and the font
           shrunk until it fits the width, with a floor so it stays a word
           rather than a smudge. */
        let fs = Math.round(h*0.56);
        ctx.font = `700 ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        if(b.ch.length > 1){
          const max = w * 0.88, tw = ctx.measureText(b.ch).width;
          if(tw > max){
            fs = Math.max(9, Math.floor(fs * max / tw));
            ctx.font = `700 ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`;
          }
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.ch, 0, Math.round(h*0.03));
        ctx.restore();
      }
      /* The word burst: a handful of dots from the finished word's slots, gold
         and green, under a little paint-space gravity, gone inside a second.
         Spawned on the first frame after the word completed, dropped when they
         expire, so a table with no burst pays nothing per frame. */
      if(wordAt && feel.party > 0){
        const age = t - wordAt;
        if(age < 800){
          if(!particles) spawnBurst();
          const k = dt / 16.7, fade = 1 - age / 800;
          ctx.save();
          for(const q of particles){
            q.x += q.vx * k; q.y += q.vy * k; q.vy += 0.12 * k;
            ctx.globalAlpha = fade;
            ctx.fillStyle = q.col;
            ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        } else if(particles){ particles = null; }
      } else if(particles){ particles = null; }   // the dial went to 0 mid-burst: drop it
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
      /* Flipping the rotation lock live: re-normalise every loose tile so the
         freeze applies (or lifts) without waiting for the next deal —
         normalizeMass recomputes the real inertia and re-freezes only if the
         lock is now on. Snap a newly-locked tile flat so it does not sit
         mid-tumble. Throw Lab re-deals on the toggle too, but this makes the
         change correct on its own. */
      if('lockRot' in next){
        for(const p of pieces){
          const b = p.body;
          if(b.isStatic) continue;
          normalizeMass(b);
          if(rotLocked()){ Body.setAngle(b, 0); Body.setAngularVelocity(b, 0); }
        }
      }
    }

    return {
      reset(){ clearGrips(); if(pieces.length) Composite.remove(engine.world, pieces.map(p => p.body)); pieces = []; slots = []; grid = null; pendingDeal = null; given.clear(); clearResult(); wordAt = 0; particles = null; },
      setPieces, addPiece, slots: makeSlots, place, give, openSides,
      read, cells, filled, setResult,
      /* the loose pieces (not slotted), letter + colour + height + velocity +
         angle — a driven test's only window onto what is lying on the table,
         since read() sees slots alone. vx/vy are what a release just imparted;
         `ang` (radians) is how the bench proves a bar tile stayed flat. */
      loose: () => pieces.filter(p => p.slot == null)
                         .map(p => ({ ch: p.ch, hue: p.hue, x: Math.round(p.body.position.x), y: Math.round(p.body.position.y),
                                      vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y),
                                      ang: +p.body.angle.toFixed(3) })),
      /* slot geometry + the fitted tile size, for callers that aim or assert
         at real coordinates (the suite fires its test shots at a slot's row) */
      slotBox: i => slots[i] ? { x: slots[i].x, y: slots[i].y, w: slots[i].w, h: slots[i].h } : null,
      /* the docked piece's BODY centre for slot i — a docked tile must sit
         dead on its slot centre whatever happened on the way in, and the
         suite asserts the two agree */
      pieceAt: i => (slots[i] && slots[i].piece)
        ? { x: slots[i].piece.body.position.x, y: slots[i].piece.body.position.y } : null,
      /* suite-only: displace a docked body off its slot, standing in for
         whatever strands one in the wild — the re-seat sweep must undo it */
      _nudgeDocked: i => { const s = slots[i]; if(s && s.piece) Body.setPosition(s.piece.body, { x: s.x + 6, y: s.y + 5 }); },
      tileSize: () => tile,
      /* the looks, for a driven test: the palette in use, the live burst's size,
         how many halo sprites are cached, and when the last word completed */
      fx: () => ({ palette: Object.assign({}, palette), particles: particles ? particles.length : 0,
                   halos: halos.size, wordAt, landed: pieces.filter(p => p.landed).length }),
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
      /* the label of the piece a pointer is holding, for a tap-to-place caller
         (join.html's tap table) that grabs to identify a tile, then places it into
         a slot by name rather than dragging it there. Read-only; null if nothing held. */
      heldCh: id => { const g = grips.get(id); const p = g && pieceOf(g.body); return p ? p.ch : null; },
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
