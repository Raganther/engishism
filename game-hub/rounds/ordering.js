/* ================= The ordering round — "Word Thermometer" =================
   A set of words that belong on a scale, and the room has to put them in order:
   `annoyed → irritated → livid → furious → incensed`. Grouping asks *does this
   belong?*; this asks *how much?* — which is the harder question and the one C1
   students plateau on. They know "angry" and "furious"; the distance between
   *irritated* and *livid* is what they are actually short of.

   **Two ways to play it, and they are genuinely different lessons rather than two
   speeds of one.** The host picks with `ctx.mode`:

   - **`climb`** — the ladder fills one rung at a time from the cold end. Everyone
     votes on what comes next, it locks in, and its gloss prints as it lands. Slower,
     but every student is in every decision and the teacher gets five teachable
     moments instead of one.
   - **`whole`** — each team taps out a complete order and the board scores it. Fast
     and competitive; one verdict at the end.

   **A sequence is not a set, and that is the whole reason this was built second.**
   Grouping merges a team's phones with a union — four words from four handsets are
   one answer. An order cannot be merged: two students tapping different sequences
   do not combine into a third. So in `whole` a team's answer is the fullest single
   submission among its players, and the board names whose it is. That is not a
   compromise, it is what the shape actually permits, and it is the kind of thing
   only a second question type could reveal.

   Authoring shape — the scale is written cold-end first, which is the answer:

     { text:"Put these in order, mildest first.",
       order:{ scale:["annoyed","irritated","angry","livid","furious"],
               low:"mildly bothered", high:"absolutely raging",
               gloss:{ livid:"so angry you have gone quiet." } } }

   `gloss` is optional per word and is what turns a right answer into a taught one.
   No separate answer field: the scale *is* the answer. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('ordering.js needs hub-rounds.js loaded first'); return; }

  const colourOf = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';

  K.round.register('ordering', {
    label: 'Word Thermometer',
    blurb: 'Words on a scale, weakest to strongest. The room puts them in order.',

    /* Both modes are offered to whatever is hosting, so a host builds its picker
       from this rather than knowing the round's business. The bench puts it in a
       dropdown; the hub registers it as a setting. */
    modes: [
      { value:'climb', label:'One rung at a time — the room fills the ladder together' },
      { value:'whole', label:'All at once — each team taps out a whole order' }
    ],

    /* The item field this round owns. The normaliser copies it across on its own,
       so nobody has to remember to widen a whitelist — see `Kit.round.fields()`. */
    field: 'order',

    claims(item){ return !!(item && item.order && Array.isArray(item.order.scale)); },

    setup(item, ctx){
      const o = item && item.order;
      if(!o || !Array.isArray(o.scale) || o.scale.length < 3) return null;
      const scale = o.scale.map(String);
      const mode = (ctx && ctx.mode === 'whole') ? 'whole' : 'climb';
      return {
        text:   String((item && item.text) || ''),
        answer: scale.join(' → '),
        scale,
        need:   scale.length,
        low:    String(o.low  || 'weakest'),
        high:   String(o.high || 'strongest'),
        gloss:  o.gloss || {},
        mode,
        placed: [],                 // locked in from the cold end, `climb` only
        pool:   shuffle(scale.slice()),
        chosen: [],                 // the teacher's own working order, with no phones
        picks:  {},                 // team -> that team's proposed order
        by:     {},                 // team -> whose phone it came from, `whole` only
        say:    '',
        done:   false
      };
    },

    /* ---------- the projector's view ----------
       The ladder is the picture. A shared pool with dots on it was the first build
       of the bench game and it made a race you had to be *told* the result of; you
       want to see how far up each side has got without reading a scoreboard. */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-ordering';

      const ladder = document.createElement('div');
      ladder.className = 'ord-ladder';

      const cap = (txt, cls) => {
        const e = document.createElement('div');
        e.className = 'ord-cap ' + cls; e.textContent = txt; return e;
      };
      ladder.appendChild(cap(s.high, 'hot'));

      // drawn top-down, so the strongest is at the top where the room expects it
      for(let i = s.need - 1; i >= 0; i--){
        const rung = document.createElement('div');
        rung.className = 'ord-rung';
        const word = s.placed[i] || (s.done ? s.scale[i] : null);
        const isNext = !s.done && s.mode === 'climb' && i === s.placed.length;
        if(word){
          rung.classList.add('filled');
          if(s.done && s.placed[i] !== s.scale[i]) rung.classList.add('wrong');
          const w = document.createElement('span');
          w.className = 'ord-word'; w.textContent = word;
          rung.appendChild(w);
          const g = s.gloss && s.gloss[word];
          if(g){
            const note = document.createElement('small');
            note.className = 'ord-gloss'; note.textContent = g;
            rung.appendChild(note);
          }
        } else if(isNext){
          rung.classList.add('next');
          rung.textContent = 'next?';
        } else {
          rung.classList.add('empty');
          rung.textContent = '';
        }
        ladder.appendChild(rung);
      }
      ladder.appendChild(cap(s.low, 'cold'));
      mount.appendChild(ladder);

      /* What is left to place. In `climb` this is the ballot; in `whole` it is just
         the words, because each team is building its own order on their phones. */
      const left = s.mode === 'climb' ? s.pool.filter(w => s.placed.indexOf(w) === -1) : s.pool;
      if(!s.done && left.length){
        const pool = document.createElement('div');
        pool.className = 'ord-pool';
        left.forEach(w=>{
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'gword'; b.dataset.word = w;
          const t = document.createElement('span');
          t.className = 'gw-text';
          const at = s.chosen.indexOf(w);
          // the teacher's own working order is numbered, because a sequence needs it
          t.textContent = at === -1 ? w : (at + 1) + '. ' + w;
          b.appendChild(t);
          if(at !== -1) b.classList.add('chosen');
          const holders = Object.keys(s.picks).filter(t2 => (s.picks[t2]||[]).indexOf(w) !== -1);
          if(holders.length){
            b.classList.add('held');
            const dots = document.createElement('span');
            dots.className = 'gdots';
            holders.forEach(t2=>{
              const d = document.createElement('span');
              d.className = 'gdot';
              d.style.background = colourOf(Number(t2));
              d.title = c.teamName ? c.teamName(Number(t2)) : ('Team ' + (Number(t2)+1));
              dots.appendChild(d);
            });
            b.appendChild(dots);
          }
          if(c.onPick) b.addEventListener('click', ()=> c.onPick(w));
          pool.appendChild(b);
        });
        mount.appendChild(pool);
      }

      /* Each team's proposal, in their own colour and in their own order — the thing
         a shared pool could never show. In `climb` it is one word; in `whole` it is
         the run they have tapped out so far. */
      const names = c.teams || [];
      const line = document.createElement('div');
      line.className = 'group-tally';
      names.forEach((name, i)=>{
        const set = s.picks[i] || [];
        if(!set.length) return;
        const chip = document.createElement('span');
        chip.className = 'group-count';
        chip.style.borderColor = colourOf(i);
        chip.textContent = name + ' · ' + set.join(' → ') +
                           (s.mode === 'whole' ? ' (' + set.length + '/' + s.need + ')' : '');
        if(s.mode === 'whole' && s.by[i]){
          const tail = document.createElement('small');
          tail.textContent = ' · ' + s.by[i] + ' is driving';
          chip.appendChild(tail);
        }
        line.appendChild(chip);
      });
      if(line.children.length) mount.appendChild(line);

      if(s.say){
        const say = document.createElement('div');
        say.className = 'group-say' + (s.done ? ' good' : '');
        say.textContent = s.say;
        mount.appendChild(say);
      }
    },

    reveal(mount, s, ctx){
      s.done = true;
      s.placed = s.scale.slice();       // the whole ladder, in the right order
      s.chosen = [];
      this.render(mount, s, ctx);
      return 0;
    },

    /* ---------- the handsets ----------
       `climb` is one tap: which word comes next. `whole` is the whole order, tapped
       in sequence — the relay preserves the order taps were made in, so a sequence
       needs nothing the phones do not already do. */
    arm(s, ctx){
      const c = ctx || {};
      const left = s.mode === 'climb' ? s.pool.filter(w => s.placed.indexOf(w) === -1) : s.pool;
      const label = s.mode === 'climb'
        ? ('Which comes next? (' + (s.placed.length + 1) + ' of ' + s.need + ')')
        : ('Tap all ' + s.need + ' in order, weakest first');
      return {
        mode:    'vote',
        prompt:  c.prompt === false ? label : (s.text || label),
        options: left.slice(),
        multi:   s.mode === 'climb' ? 1 : s.need,
        /* No per-team share here, and that is the shape rather than an omission: an
           order cannot be assembled from pieces the way a set can, so splitting it
           across handsets would produce fragments nothing can merge. */
        multiByTeam: null,
        holds:   true,
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    /* **A sequence cannot be merged.** Grouping unions a team's phones because four
       words from four handsets are one answer whatever order they arrived in. Two
       students tapping different orders do not combine into a third — so a team's
       answer is the fullest single submission among its players, and the board says
       whose. In `climb` there is only ever one word, so the leading vote wins. */
    read(replies, s){
      const out = {}, who = {};
      const best = {};
      (replies || []).forEach(r=>{
        const t = Number(r && r.team) || 0;
        const seq = String((r && r.value) == null ? '' : r.value)
                      .split('|').filter(Boolean)
                      .filter(w => s.pool.indexOf(w) !== -1);
        if(!seq.length) return;
        if(s.mode === 'climb'){
          // one tap each: the team's answer is whatever most of them said
          const tally = best[t] || (best[t] = {});
          tally[seq[0]] = (tally[seq[0]] || 0) + 1;
          who[t] = r.name;
        } else if(!out[t] || seq.length > out[t].length){
          out[t] = seq; who[t] = r.name;
        }
      });
      if(s.mode === 'climb'){
        Object.keys(best).forEach(t=>{
          const tally = best[t];
          const lead = Object.keys(tally).sort((a,b)=> tally[b] - tally[a])[0];
          if(lead) out[t] = [lead];
        });
      }
      s.by = who;
      return out;
    },

    judge(answer, s){
      const seq = answer || [];
      if(s.mode === 'climb'){
        if(seq.length !== 1) return { verdict:'incomplete', hits:0 };
        const want = s.scale[s.placed.length];
        const right = String(seq[0]).toLowerCase() === String(want).toLowerCase();
        return { verdict: right ? 'right' : 'wrong', hits: right ? 1 : 0,
                 // the round ends when the last rung is filled, not on the first right answer
                 done: right && s.placed.length + 1 === s.need };
      }
      if(seq.length !== s.need) return { verdict:'incomplete', hits:0 };
      const hits = seq.filter((w, i) =>
        String(w).toLowerCase() === String(s.scale[i]).toLowerCase()).length;
      return { verdict: hits === s.need ? 'right' : 'wrong', hits, done: hits === s.need };
    },

    /* Commit a correct answer. Grouping has nothing to commit — being right *is* the
       ending — so it leaves this out and the default does nothing. An ordering climb
       is the case that needed it: right means progress, not the end. */
    accept(answer, s){
      if(s.mode !== 'climb') { s.placed = (answer || []).slice(); return; }
      s.placed = s.placed.concat(answer || []);
      if(s.placed.length >= s.need) s.done = true;
    },

    saidOf(who, r, s){
      if(s.mode === 'climb') return who + ': not that one yet.';
      return who + (r.hits >= s.need - 2 ? ': close — two are the wrong way round.'
                                         : ': not the right order.');
    },

    settleMs: 700
  });

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
})();
