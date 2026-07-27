/* ================= Game Hub — shared kit =================
   Things more than one game needs, solved once. Everything here is stateless:
   anything that needs game state takes it as a parameter, so the kit never
   reaches into the engine's closure and can be used by whatever comes next.

     Kit.fitToScreen(el)          fill the space between the header and the floor
     Kit.floorTop()               the y a board may not cross — one definition
     Kit.anim.register(...)       add an interchangeable animation
     Kit.anim.get(feature, name)  look one up by the setting's current value
     Kit.prompt.register(...)     add a question form every game can draw
     Kit.claimTeam({...})         "which team gets this?" chips + number keys
     Kit.shapeOf(origin, target)  the shape a clicked element is drawn with

   Loads after hub-settings.js and before hub-engine.js. =================== */
window.HubKit = (function(){
  'use strict';

  /* ---------- where the floor is ----------
     The bottom edge a board may not cross. This used to be "the top of the team
     bar", hard-coded into the fit in one place and into the layout tests in three
     others — so moving the bar meant four separate right answers and any one of
     them could be missed. It is one function now: the bar only takes space away
     from a board while it is actually *below* it, which since it moved into the
     header it no longer is. Ask, don't assume, and the next move is an edit here. */
  function floorTop(){
    const bar = document.getElementById('scorebar');
    if(bar && bar.offsetHeight && getComputedStyle(bar).position === 'fixed')
      return bar.getBoundingClientRect().top;
    return window.innerHeight;
  }

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
    /* `floor:true` says this board has a hard minimum it cannot scale below.
       Jeopardy shrinks its type and Race re-scatters, so they can always be made
       to fit; Millionaire's four options each carry a 34px letter circle, so
       below a certain height there is no honest fit and forcing one collapses
       the grid rows underneath their own content — which is what painted the
       ladder straight through the answers on a phone. Measure what the content
       actually needs, and when the screen can't give it, hand the height back
       and let the page scroll instead of lying about the fit. */
    // Bottom padding on an ancestor sits *below* this element, so the space it
    // needs is more than its own height. Ignoring it slid Race's last row of words
    // 3px under the team bar the moment the game show stage added padding — the
    // sort of thing that only shows up on one screen size, so measure it rather
    // than guessing a bigger gap.
    let below = 0;
    for(let p = el.parentElement; p && p !== document.body; p = p.parentElement){
      below += parseFloat(getComputedStyle(p).paddingBottom) || 0;
    }
    const h = Math.max(min, floorTop() - top - gap - below);
    if(o.floor){
      el.style.height = '';
      if(el.scrollHeight > h + 1){ el.style.removeProperty('height'); return 0; }
    }
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

  /* ---------- how a question is drawn ----------
     Question *forms* — gap fill, anagram, odd one out — were only ever a
     convention: they existed in how a prompt happened to be worded, and every game
     pushed the string through `textContent`. The one exception proved the point,
     Race hand-rolling a `.gap` span inside its own prompt renderer.

     This makes the form a first-class thing any game can draw. A type registers
     once and every game can use it, exactly as `anim` works for animations:

       Kit.prompt.register('anagram', {
         games:['jeopardy','blockbusters','race'],   // omit for "suits all"
         render(mount, item){…}, reveal(mount, item){…}
       });

     Two rules that make this safe to adopt gradually:
     - **An item with no `type` still renders.** The items authored before this
       existed are untouched, and a prompt containing `___` is recognised as a gap
       fill without being labelled one — so the majority get the better rendering
       for free.
     - **A type may name the games it suits.** Not every form survives every board:
       an anagram in Millionaire is given away by its own four options, and odd-one-
       out in Race is given away by the board. Declaring that beats discovering it.

     Items arrive normalised as `{ text, answer, type? }`, so the kit never learns
     that Jeopardy calls it `q` and Blockbusters calls it `clue`. */
  const prompt = (function(){
    const impls = Object.create(null);

    function typeOf(item){
      if(item && item.type) return item.type;
      return /___+/.test(String((item && item.text) || '')) ? 'gap' : null;
    }
    function suits(type, game){
      const impl = impls[type];
      if(!impl) return false;
      return !Array.isArray(impl.games) || !game || impl.games.indexOf(game) !== -1;
    }

    /* Draw `item` into `mount`, falling back to plain text for anything with no
       renderer. Returns the type used, or null when it fell back. */
    function render(mount, item, game){
      if(!mount) return null;
      const type = typeOf(item);
      const impl = type && impls[type];
      mount.classList.remove('prompt-revealed');
      if(impl && impl.render && suits(type, game)){
        mount.innerHTML = '';
        mount.dataset.promptType = type;
        impl.render(mount, item);
        return type;
      }
      mount.textContent = String((item && item.text) || '');
      delete mount.dataset.promptType;
      return null;
    }

    /* Answer the question in place — the word dropping into the blank rather than
       appearing underneath it. Returns how long it runs, or 0 when the type can't
       (or shouldn't), which tells the caller to fall back to its own answer line. */
    function reveal(mount, item){
      const type = mount && mount.dataset.promptType;
      const impl = type && impls[type];
      const ms = (impl && impl.reveal) ? (impl.reveal(mount, item) || 0) : 0;
      // one marker every form sets, so anything asking "has this been answered?"
      // needs to know about forms in general, not about any particular one
      if(ms) mount.classList.add('prompt-revealed');
      return ms;
    }

    return {
      register(type, impl){ impls[type] = impl; return impl; },
      render, reveal, suits,
      types(){ return Object.keys(impls); }
    };
  })();

  /* The first type, and the one that pays for the mechanism on its own: most of the
     authored items already contain `___`, so they gain a real blank without a single
     edit to the content. */
  prompt.register('gap', {
    render(mount, item){
      const parts = String((item && item.text) || '').split(/___+/);
      parts.forEach((part, i)=>{
        if(part) mount.appendChild(document.createTextNode(part));
        if(i < parts.length - 1){
          const gap = document.createElement('span');
          gap.className = 'prompt-gap';
          // real text, not a CSS ::after — a blank that isn't in the DOM can't be
          // read by anything that inspects the sentence, and Race's own renderer
          // put it there for that reason
          gap.textContent = '?';
          mount.appendChild(gap);
        }
      });
    },
    reveal(mount, item){
      const gaps = [...mount.querySelectorAll('.prompt-gap')];
      const answer = String((item && item.answer) || '').trim();
      /* An answer only belongs in a blank if it is the word the sentence is
         missing. Three kinds aren't: too long to fit, alternatives ("forbidden /
         not permitted"), and ones carrying a teacher's note ("he was made
         REDUNDANT (adjective)"). Decline those and let the caller print them on
         its own answer line, which is what that line is for. */
      if(!gaps.length || !answer) return 0;
      if(answer.length > 26 || /[\/(]/.test(answer)) return 0;
      const words = answer.split(/\s+/);
      // two blanks and two words means one word each; anything else repeats the
      // whole answer, which is right for "it slipped my ___ / it crossed my ___"
      const fill = (gaps.length > 1 && words.length === gaps.length)
                 ? words : gaps.map(()=>answer);
      gaps.forEach((g, i)=>{ g.textContent = fill[i]; g.classList.add('filled'); });
      return 520;
    }
  });

  /* Every form below parses what it needs out of the prompt it was given, exactly
     as `gap` reads `___`. That keeps the item shape at `{text, answer, type}`, so
     adding a form touches no game and no content field — only the authoring
     convention for that form's own prompts. Each declines to plain text when the
     prompt or answer isn't shaped for it, because a form that renders nonsense in
     front of a class is worse than one that renders as an ordinary sentence. */

  /* Unscramble the answer. Blockbusters is the natural home — its answers are
     already single words with a known initial — and Millionaire is excluded because
     its four options hand you the letters. */
  const scramble = word => {
    const letters = word.split('');
    for(let i = letters.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    // a "scramble" that lands on the answer is not a question
    return letters.join('') === word && word.length > 1 ? scramble(word) : letters.join('');
  };

  prompt.register('anagram', {
    games:['jeopardy','blockbusters'],
    render(mount, item){
      const answer = String((item && item.answer) || '').trim();
      const text   = String((item && item.text) || '');
      if(!/^[A-Za-z'-]{2,14}$/.test(answer)){ mount.textContent = text; return; }
      if(text){
        const lead = document.createElement('span');
        lead.className = 'prompt-lead';
        lead.textContent = text;
        mount.appendChild(lead);
      }
      const row = document.createElement('span');
      row.className = 'prompt-anagram';
      scramble(answer).split('').forEach(ch => {
        const t = document.createElement('span');
        t.className = 'prompt-tile';
        t.textContent = ch;
        row.appendChild(t);
      });
      // the order to land in, so reveal can sort without re-reading the answer
      [...row.children].forEach(t => t.dataset.ch = t.textContent.toLowerCase());
      mount.appendChild(row);
    },
    reveal(mount, item){
      const row = mount.querySelector('.prompt-anagram');
      const answer = String((item && item.answer) || '').trim();
      if(!row || !answer) return 0;
      const tiles = [...row.children];
      if(tiles.length !== answer.length) return 0;

      /* FLIP: measure, reorder, then animate each tile from where it was to where
         it now is. Animating positions directly would fight the layout. */
      const before = tiles.map(t => t.getBoundingClientRect().left);
      const pool = tiles.slice();
      const ordered = answer.toLowerCase().split('').map(ch => {
        const i = pool.findIndex(t => t.dataset.ch === ch);
        return i === -1 ? null : pool.splice(i, 1)[0];
      });
      if(ordered.some(t => !t)) return 0;
      ordered.forEach(t => row.appendChild(t));
      // the tiles move via the Web Animations API, which the stylesheet's
      // reduced-motion block cannot reach — so honour it here instead
      const still = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(still){ ordered.forEach(t => t.classList.add('landed')); return 1; }
      ordered.forEach((t, i) => {
        const delta = before[tiles.indexOf(t)] - t.getBoundingClientRect().left;
        t.classList.add('landed');
        if(!delta) return;
        t.animate([{ transform:`translateX(${delta}px)` }, { transform:'none' }],
                  { duration: 620, delay: i * 26, easing:'cubic-bezier(.2,.85,.3,1)', fill:'both' });
      });
      return 620 + tiles.length * 26;
    }
  });

  /* Sentence scramble: the words of the answer, out of order. The anagram type
     does this to the letters of a word; this does it to the words of a sentence,
     which is the form that actually tests **word order** — where a relative clause
     interrupts the main clause, whether a preposition fronts (`of which`, `to
     whom`), where the commas fall. A gap fill cannot ask any of that, because the
     sentence is already built.

     Jeopardy only: the answer is a whole sentence, so Blockbusters (one word, fixed
     initial) and Race (single-word board tiles) structurally cannot host it. */
  prompt.register('scramble', {
    games:['jeopardy'],
    render(mount, item){
      const answer = String((item && item.answer) || '').trim();
      const text   = String((item && item.text) || '');
      const words  = answer.split(/\s+/).filter(Boolean);
      if(words.length < 3 || words.length > 14){ mount.textContent = text; return; }
      if(text){
        const lead = document.createElement('span');
        lead.className = 'prompt-lead';
        lead.textContent = text;
        mount.appendChild(lead);
      }
      const row = document.createElement('span');
      row.className = 'prompt-scramble';
      // shuffle, and never hand back the sentence already in order
      let order = words.slice(), tries = 0;
      do {
        for(let i = order.length - 1; i > 0; i--){
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
      } while(order.join(' ') === answer && ++tries < 8);
      order.forEach(w=>{
        const chip = document.createElement('span');
        chip.className = 'prompt-word';
        chip.textContent = w;
        chip.dataset.w = w;
        row.appendChild(chip);
      });
      mount.appendChild(row);
    },
    reveal(mount, item){
      const row = mount.querySelector('.prompt-scramble');
      const answer = String((item && item.answer) || '').trim();
      if(!row || !answer) return 0;
      const chips = [...row.children];
      const words = answer.split(/\s+/).filter(Boolean);
      if(chips.length !== words.length) return 0;

      // same FLIP as the anagram, one level up: measure, reorder, animate the gap
      const before = chips.map(c => c.getBoundingClientRect());
      const pool = chips.slice();
      const ordered = words.map(w=>{
        const i = pool.findIndex(c => c.dataset.w === w);
        return i === -1 ? null : pool.splice(i, 1)[0];
      });
      if(ordered.some(c => !c)) return 0;
      ordered.forEach(c => row.appendChild(c));
      const still = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ordered.forEach((c, i)=>{
        c.classList.add('landed');
        if(still) return;
        const was = before[chips.indexOf(c)], now = c.getBoundingClientRect();
        const dx = was.left - now.left, dy = was.top - now.top;
        if(!dx && !dy) return;
        c.animate([{ transform:`translate(${dx}px, ${dy}px)` }, { transform:'none' }],
                  { duration: 640, delay: i * 28, easing:'cubic-bezier(.2,.85,.3,1)', fill:'both' });
      });
      return still ? 1 : 640 + chips.length * 28;
    }
  });

  /* Odd one out. The candidates live in the prompt separated by `/`, which is how
     these were already being written by hand. Not offered to Race, where the board
     itself would give the answer away. */
  const oddCandidates = text => {
    const tail = String(text || '').split(':').pop();
    const parts = tail.split('/').map(s => s.trim()).filter(Boolean);
    return parts.length >= 3 ? parts : null;
  };

  prompt.register('oddoneout', {
    games:['jeopardy','blockbusters'],
    render(mount, item){
      const text  = String((item && item.text) || '');
      const parts = oddCandidates(text);
      if(!parts){ mount.textContent = text; return; }
      if(text.indexOf(':') !== -1){
        const lead = document.createElement('span');
        lead.className = 'prompt-lead';
        lead.textContent = text.slice(0, text.indexOf(':') + 1);
        mount.appendChild(lead);
      }
      const row = document.createElement('span');
      row.className = 'prompt-odd';
      parts.forEach(p => {
        const chip = document.createElement('span');
        chip.className = 'prompt-chip';
        chip.textContent = p;
        row.appendChild(chip);
      });
      mount.appendChild(row);
    },
    reveal(mount, item){
      const chips = [...mount.querySelectorAll('.prompt-chip')];
      const answer = String((item && item.answer) || '').trim().toLowerCase();
      if(!chips.length || !answer) return 0;
      const hit = chips.filter(c => c.textContent.trim().toLowerCase() === answer);
      if(hit.length !== 1) return 0;          // the answer must be one of the chips
      chips.forEach(c => c.classList.add(c === hit[0] ? 'odd' : 'belongs'));
      return 620;
    }
  });

  /* Error correction. The wrong words are marked in the prompt with *asterisks*,
     and the answer replaces them. Millionaire suits this one — its options are
     candidate corrections, not a give-away. */
  prompt.register('errorfix', {
    games:['jeopardy','millionaire','race'],
    render(mount, item){
      const text  = String((item && item.text) || '');
      const parts = text.split(/\*([^*]+)\*/);
      if(parts.length < 3){ mount.textContent = text; return; }
      parts.forEach((part, i) => {
        if(!part) return;
        if(i % 2 === 0){ mount.appendChild(document.createTextNode(part)); return; }
        const bad = document.createElement('span');
        bad.className = 'prompt-error';
        bad.textContent = part;
        mount.appendChild(bad);
      });
    },
    reveal(mount, item){
      const bad = mount.querySelector('.prompt-error');
      const answer = String((item && item.answer) || '').trim();
      if(!bad || !answer) return 0;
      if(answer.length > 30 || /[\/(]/.test(answer)) return 0;   // same declines as `gap`
      bad.textContent = answer;
      bad.classList.add('fixed');
      return 560;
    }
  });

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

  /* ---------- judging a typed answer ----------
     A phone that types the answer needs the app to decide whether it is right, and
     "=== the bank's string" is not that decision: a C1 student typing `judgement`
     for `judgment`, or `the verdict` for `verdict`, has produced the word. Three
     verdicts rather than two, because **a near miss is information the teacher
     wants** — it is the difference between not knowing the word and not being able
     to spell it, and those need different responses in the room.

       Kit.answer.judge('verdct', 'verdict')   // 'close'

     Deliberately not a fuzzy search: it compares one typed string against one
     expected string, so it is safe to run on every buzz. */
  function normAnswer(s){
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')   // café → cafe
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g,' ')                       // punctuation is not the point
      .replace(/\b(a|an|the)\b/g,' ')                    // "the verdict" answers "verdict"
      .replace(/\s+/g,' ').trim();
  }

  /* Levenshtein, bounded: anything past `max` stops early, because the only
     question asked of it is "within one or two?" */
  function editDistance(a, b, max){
    if(a === b) return 0;
    if(Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({length:b.length+1}, (_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const row = [i];
      let best = i;
      for(let j=1;j<=b.length;j++){
        const cost = a.charCodeAt(i-1) === b.charCodeAt(j-1) ? 0 : 1;
        row[j] = Math.min(prev[j] + 1, row[j-1] + 1, prev[j-1] + cost);
        if(row[j] < best) best = row[j];
      }
      if(best > max) return max + 1;      // every path is already too expensive
      prev = row;
    }
    return prev[b.length];
  }

  const answer = {
    normalise: normAnswer,
    /* 'right' | 'close' | 'wrong'. The tolerance scales with the word, because one
       wrong letter in `jury` is a different kind of error from one in
       `incarceration` — three letters and twelve are not the same guess. */
    judge(typed, expected){
      const t = normAnswer(typed), e = normAnswer(expected);
      if(!t || !e) return 'wrong';
      if(t === e) return 'right';
      const tol = e.length >= 9 ? 2 : e.length >= 5 ? 1 : 0;
      if(!tol) return 'wrong';
      return editDistance(t, e, tol) <= tol ? 'close' : 'wrong';
    }
  };

  return { fitToScreen, floorTop, anim, prompt, claimTeam, passTurn, shapeOf, answer };
})();
