/* ================= Game Hub — shared kit =================
   Things more than one game needs, solved once. Everything here is stateless:
   anything that needs game state takes it as a parameter, so the kit never
   reaches into the engine's closure and can be used by whatever comes next.

     Kit.fitToScreen(el)          fill the space between the header and team bar
     Kit.anim.register(...)       add an interchangeable animation
     Kit.anim.get(feature, name)  look one up by the setting's current value
     Kit.claimTeam({...})         "which team gets this?" chips + number keys
     Kit.shapeOf(origin, target)  the shape a clicked element is drawn with

   Loads after hub-settings.js and before hub-engine.js. =================== */
window.HubKit = (function(){
  'use strict';

  /* ---------- fill the screen, never scroll ----------
     A board that runs off the bottom is useless: a teacher can't scroll the
     projected image mid-game. Three games worked this out separately before this
     existed. Returns the height applied, or 0 when the element isn't measurable
     yet (the play screen is still hidden), which every caller treats as "try again
     once it's visible". */
  function fitToScreen(el, opts){
    if(!el) return 0;
    const o    = opts || {};
    const min  = o.min  === undefined ? 220 : o.min;
    const gap  = o.gap  === undefined ? 14  : o.gap;
    const top  = el.getBoundingClientRect().top;
    if(top <= 0) return 0;
    const bar  = document.getElementById('scorebar');
    const barH = (bar && bar.offsetHeight) || 76;
    const h    = Math.max(min, window.innerHeight - top - barH - gap);
    el.style.height = h + 'px';
    return h;
  }

  /* ---------- interchangeable implementations ----------
     A feature can ship several versions and let the teacher pick between them.
     Register each one; the settings entry lists them as `variants` and its current
     value is the name to look up. Adding another is a register() call — no panel
     edit, no branching in the game code. */
  const anim = (function(){
    const impls = Object.create(null);      // feature -> name -> implementation
    return {
      register(feature, name, impl){
        (impls[feature] = impls[feature] || Object.create(null))[name] = impl;
        return impl;
      },
      get(feature, name){
        const set = impls[feature];
        if(!set) return null;
        return set[name] || null;
      },
      names(feature){ return Object.keys(impls[feature] || {}); }
    };
  })();

  /* ---------- what shape was clicked ----------
     So an animation can start from the *actual* shape of the thing you clicked
     rather than assuming a rectangle: a Blockbusters hexagon unfolds into the card,
     a Jeopardy tile grows from its own corner radius, and a future board of some
     other shape needs no new animation written for it.

     Returns { prop, from, to } ready to hand to element.animate(), or null when
     the element is a plain rectangle and there is nothing to morph.

     The polygon case is exact for shapes whose points already lie on their bounding
     box — hexagons, octagons, rectangles, which is what a game board realistically
     uses. A shape with points *inside* the box (a diamond, say) would need its own
     destination and is not worth guessing at until something needs it. */
  function shapeOf(origin, target){
    if(!origin) return null;
    const cs = getComputedStyle(origin);

    const clip = (cs.clipPath || cs.webkitClipPath || '').trim();
    if(clip && clip.indexOf('polygon') === 0){
      const box = polygonToBox(clip);
      if(box) return { prop:'clipPath', from:clip, to:box };
    }

    const from = (cs.borderRadius || '').trim();
    const to   = target ? (getComputedStyle(target).borderRadius || '').trim() : '';
    if(from && to && from !== to) return { prop:'borderRadius', from, to };
    return null;
  }

  /* Push every point of a polygon out to its bounding box, keeping the point count
     and order so the browser can interpolate between the two. A point already on an
     edge stays put; one sitting on a left/right edge slides to the nearer corner. */
  function polygonToBox(clip){
    const inner = clip.slice(clip.indexOf('(') + 1, clip.lastIndexOf(')'));
    const pts = inner.split(',').map(p => p.trim().split(/\s+/));
    if(!pts.length || pts.some(p => p.length !== 2)) return null;

    const num = v => parseFloat(v);
    const at  = (v, lo, hi) => Math.abs(v - lo) < 0.5 || Math.abs(v - hi) < 0.5;

    const out = pts.map(([xs, ys]) => {
      const x = num(xs), y = num(ys);
      if(isNaN(x) || isNaN(y)) return null;
      if(at(x, 0, 100)) return x + '% ' + (y <= 50 ? '0%' : '100%');   // on a side edge
      if(at(y, 0, 100)) return x + '% ' + y + '%';                     // already on top/bottom
      return (x <= 50 ? '0%' : '100%') + ' ' + (y <= 50 ? '0%' : '100%');
    });
    return out.some(p => p === null) ? null : 'polygon(' + out.join(', ') + ')';
  }

  /* ---------- "which team gets this?" ----------
     One screen can't tell the engine who spoke, buzzed or touched first, so the
     teacher supplies that one fact. Chips plus number keys, so it can be answered
     without looking down at the laptop.

       const claim = Kit.claimTeam({ mount: el, onPick: i => … });
       claim.show(teams, [0,1]);   // allow is optional; omit for every team
       claim.hide();

     `allow` exists because some boards are structurally two-team — Blockbusters'
     yellow-across / blue-down geometry means a third team has nowhere to play — so
     offering every team there would break the game rather than generalise it. */
  function claimTeam(cfg){
    const mount  = cfg.mount;
    const onPick = cfg.onPick || function(){};
    let live = null;                        // indices currently offered

    function render(teams, allow){
      mount.innerHTML = '';
      live = (allow && allow.length ? allow : teams.map((_, i) => i))
               .filter(i => teams[i]);
      live.forEach((idx, n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'claim-team team-' + Math.min(idx, 3);
        const k = document.createElement('span');
        k.className = 'claim-key'; k.textContent = String(n + 1);
        b.appendChild(k);
        b.appendChild(document.createTextNode(teams[idx].name));
        b.addEventListener('click', () => onPick(idx));
        mount.appendChild(b);
      });
    }

    function show(teams, allow){
      render(teams, allow);
      mount.style.visibility = 'visible';
    }
    function hide(){ mount.style.visibility = 'hidden'; live = null; }
    function isOpen(){ return !!live && mount.style.visibility === 'visible'; }

    document.addEventListener('keydown', e => {
      if(!isOpen()) return;
      if(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const n = parseInt(e.key, 10);
      if(n >= 1 && n <= live.length){ e.preventDefault(); onPick(live[n - 1]); }
    });

    return { show, hide, isOpen };
  }

  /* ---------- whose turn ---------- */
  function passTurn(count, current){
    return count ? (current + 1) % count : 0;
  }

  return { fitToScreen, anim, claimTeam, passTurn, shapeOf };
})();
