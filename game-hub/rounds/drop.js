/* ================= The word drop round =================
   A word falls toward the group bins at the foot of the card, Tetris-shaped:
   the room votes on their phones for the bin it belongs in, the tile slides
   toward whatever the room is currently saying, and where it is when it lands
   is the room's answer. Each word falls a little faster than the last.

     { text:'Which group does each word belong to?',
       drop:{ buckets:['Noun','Verb'],
              words:[ {w:'verdict', b:'Noun'}, {w:'acquit', b:'Verb'}, … ] } }

   **The vote steers, the landing judges.** Every earlier round settles when the
   replies settle; this is the first where *time* closes the question — which is
   the whole Tetris of it. The round runs its own fall clock and asks the host
   for the next word through `ctx.again()` (re-arm the phones, redraw me), the
   same voice `accept` already uses to climb a ladder — only the trigger is a
   timer rather than a right answer. A host that does not lend `again` gets a
   teacher-clicked game: the bins are buttons, and a click lands the tile now.

   **Co-op, class against the board — deliberately.** One tile cannot slide two
   ways at once, so a per-team race would need a lane per team and that is a
   second iteration if the first one earns it. Scoring is a streak drawn on the
   card, not points: rounds never score, hosts do.

   **A re-render must not restart the fall.** The bench redraws the card on
   every vote that arrives — that is how the steering shows — so the tile's
   position is computed from the fall's own start time on every render, and the
   CSS transition covers only the *remaining* time. Rebuild the DOM mid-flight
   and the word continues from where it was.

   **Bench-first experiment.** No game show hosts it yet: the hub's ctx does not
   lend `again`, and a Jeopardy tile opening it would run teacher-clicked. Wire a
   host only after the bench version has been judged worth it. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('drop.js needs hub-rounds.js loaded first'); return; }

  /* All guesses until a class plays it: the first word falls in 9s, each landing
     shaves 700ms, nothing falls faster than 4s. */
  const FALL0 = 9000, FALL_MIN = 4000, FALL_STEP = 700;
  const MIN_WORDS = 3, MAX_WORDS = 14;

  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* Where the tile should sit horizontally, as a fraction across the field:
     under its bin when the room leads with one, centred when nobody has said. */
  function aimX(s){
    const i = s.lead ? s.buckets.indexOf(s.lead) : -1;
    if(i === -1) return 0.5;
    return (i + 0.5) / s.buckets.length;
  }

  function landNow(s, ctx, clicked){
    if(s._timer){ clearTimeout(s._timer); s._timer = null; }
    if(s.done || s.at >= s.queue.length) return;
    const w = s.queue[s.at];
    const said = clicked || s.lead || null;
    const ok = said === w.b;
    s.results.push({ w: w.w, b: w.b, said, ok });
    if(ok){ s.streak++; s.best = Math.max(s.best, s.streak); }
    else s.streak = 0;
    s.say = ok ? ('Yes — ' + w.w + ' is ' + w.b + '.')
               : (said ? ('No — ' + w.w + ' is ' + w.b + ', not ' + said + '.')
                       : ('Nobody said — ' + w.w + ' is ' + w.b + '.'));
    s.at++;
    s.fallMs = Math.max(FALL_MIN, s.fallMs - FALL_STEP);
    s.votes = {}; s.lead = null; s._t0 = 0;
    if(s.at >= s.queue.length) s.done = true;   // the summary carries the score
    /* The host re-arms the phones for the next word and redraws — or, without
       a relay, just redraws and the next fall starts. */
    if(ctx && ctx.again) ctx.again();
  }

  function score(s){
    const right = s.results.filter(r => r.ok).length;
    return right + ' of ' + s.results.length + ' sorted, best streak ' + s.best;
  }

  K.round.register('drop', {
    label: 'Word Drop',
    blurb: 'A word falls toward the group bins — the room votes to steer it before it lands.',

    sample: { text: 'Which group does each word belong to?',
              drop: { buckets: ['Noun', 'Verb'],
                      words: [ {w:'verdict', b:'Noun'}, {w:'acquit', b:'Verb'},
                               {w:'testimony', b:'Noun'}, {w:'convict', b:'Verb'},
                               {w:'jury', b:'Noun'}, {w:'sentence', b:'Verb'} ] } },
    field: 'drop',

    /* One field for the whole game: `Group: word, word | Group: word, word`.
       Two fields would separate the bins from the words that belong in them,
       and the pairing is the entire question. */
    editor: {
      labelA:'The groups — Group: word, word | Group: word, word',
      labelB:null,
      build: (text, a) => {
        const buckets = [], words = [];
        String(a || '').split(/[|;\n]+/).forEach(seg=>{
          const i = seg.indexOf(':');
          if(i === -1) return;
          const b = seg.slice(0, i).trim();
          if(!b) return;
          buckets.push(b);
          K.round.list(seg.slice(i + 1)).forEach(w => words.push({ w, b }));
        });
        return { text, drop:{ buckets, words } };
      },
      read: it => {
        const d = it.drop || {};
        const by = {};
        (d.words || []).forEach(x => { (by[x.b] = by[x.b] || []).push(x.w); });
        return { q: it.text || '',
                 a: (d.buckets || []).map(b => b + ': ' + (by[b] || []).join(', ')).join(' | '),
                 b: '' };
      }
    },

    claims(item){ return !!(item && item.drop && item.drop.words); },

    setup(item, ctx){
      const d = item && item.drop;
      if(!d) return null;
      const buckets = (d.buckets || []).map(x => String(x).trim()).filter(Boolean);
      const words = (d.words || []).filter(x => x && x.w && buckets.indexOf(String(x.b)) !== -1)
                                   .map(x => ({ w: String(x.w).trim(), b: String(x.b) }));
      if(buckets.length < 2 || buckets.length > 4) return null;
      if(words.length < MIN_WORDS || words.length > MAX_WORDS) return null;
      return {
        text: String((item && item.text) || 'Which group does each word belong to?'),
        buckets,
        queue: K.round.shuffle(words.slice()),
        at: 0,
        fallMs: FALL0,
        votes: {}, lead: null,
        results: [],
        streak: 0, best: 0,
        answer: words.map(x => x.w + ' → ' + x.b).join(', '),
        /* The bench's shared plumbing reads these off every round's state —
           `chosen` for the Check button, `need` for the teacher's pick cap,
           `picks` before the first reply. This round uses none of them (the
           bins are its own buttons and nothing settles by replies), but a
           state without them crashes the draw. */
        chosen: [], picks: {}, need: 1,
        say: '', shown: false, done: false,
        _t0: 0, _timer: null, _word: -1
      };
    },

    /* ---------- the projector's view ---------- */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-drop';

      if(s.done || s.shown){
        const sum = document.createElement('div');
        sum.className = 'drop-summary';
        s.results.forEach(r=>{
          const row = document.createElement('div');
          row.className = 'drop-result ' + (r.ok ? 'ok' : 'miss');
          row.textContent = r.w + ' → ' + r.b + (r.ok ? '' : (r.said ? ('  (the room said ' + r.said + ')') : '  (nobody said)'));
          sum.appendChild(row);
        });
        const n = document.createElement('div');
        n.className = 'drop-score';
        n.textContent = score(s);
        sum.appendChild(n);
        mount.appendChild(sum);
        if(s.say && !s.shown){
          const say = document.createElement('div');
          say.className = 'group-say good';
          say.textContent = s.say;
          mount.appendChild(say);
        }
        return;
      }

      const w = s.queue[s.at];

      const head = document.createElement('div');
      head.className = 'drop-head';
      head.textContent = (s.at + 1) + ' / ' + s.queue.length +
                         (s.streak > 1 ? ('  ·  streak ' + s.streak) : '');
      mount.appendChild(head);

      const field = document.createElement('div');
      field.className = 'drop-field';

      const tile = document.createElement('div');
      tile.className = 'gword drop-tile';
      tile.textContent = w.w;

      /* The fall is owned by the round's own clock, so a re-render — which
         happens on every vote — resumes it rather than restarting it. */
      if(!s._t0 || s._word !== s.at){
        s._t0 = Date.now(); s._word = s.at;
        if(s._timer) clearTimeout(s._timer);
        s._timer = setTimeout(()=> landNow(s, c), s.fallMs);
      }
      const elapsed = Math.min(s.fallMs, Date.now() - s._t0);
      const left = Math.max(0, s.fallMs - elapsed);
      const from = (elapsed / s.fallMs) * 100;
      tile.style.setProperty('--x', (aimX(s) * 100) + '%');
      if(reduced()){
        /* No motion: the tile holds mid-field and the header counts down. */
        tile.style.top = '40%';
        head.textContent += '  ·  ' + Math.ceil(left / 1000) + 's';
      }else{
        tile.style.transition = 'none';
        tile.style.top = from + '%';
        requestAnimationFrame(()=> requestAnimationFrame(()=>{
          tile.style.transition = 'top ' + left + 'ms linear, left 400ms ease';
          tile.style.top = '84%';
        }));
      }
      field.appendChild(tile);

      const bins = document.createElement('div');
      bins.className = 'drop-bins';
      s.buckets.forEach(b=>{
        const bin = document.createElement('button');
        bin.type = 'button';
        bin.className = 'drop-bin' + (s.lead === b ? ' lead' : '');
        bin.textContent = b;
        const n = s.votes[b];
        if(n){
          const count = document.createElement('span');
          count.className = 'drop-count';
          count.textContent = String(n);
          bin.appendChild(count);
        }
        /* The teacher's click is the room's answer, landed now — the no-relay
           path, and the rescue when the class is shouting rather than voting. */
        bin.addEventListener('click', ()=> landNow(s, c, b));
        bins.appendChild(bin);
      });
      field.appendChild(bins);
      mount.appendChild(field);

      if(s.say){
        const say = document.createElement('div');
        say.className = 'group-say';
        say.textContent = s.say;
        mount.appendChild(say);
      }
    },

    /* The other round with more to do: the tile is falling on a clock of its own
       and nothing else will stop it. */
    reveal(mount, s, ctx){
      if(s._timer){ clearTimeout(s._timer); s._timer = null; }
      K.round.finish(s);
      this.render(mount, s, ctx);
      return 0;
    },

    /* ---------- the handsets ----------
       One plain vote per word, rethink on — the steering *is* the room changing
       its mind. A fresh arm per word is deliberate: the last word's votes must
       not steer this one. `null` when the game is over: nothing for the phones. */
    arm(s, ctx){
      if(s.done || s.at >= s.queue.length) return null;
      const c = ctx || {};
      const w = s.queue[s.at];
      return {
        mode:    'vote',
        prompt:  c.prompt === false ? 'Which group?' : ('Which group: ' + w.w.toUpperCase() + '?'),
        options: s.buckets.slice(),
        multi:   1,
        rethink: true,
        holds:   false,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    /* The whole room's count per bin — co-op, so teams are summed. Returns no
       picks: nothing settles by replies, the landing is the judge. */
    read(replies, s, ctx){
      const p = K.round.poll(replies, { valid: b => s.buckets.indexOf(b) !== -1 });
      const tally = {};
      Object.keys(p.votes).forEach(t=>{
        const f = p.votes[t].for;
        Object.keys(f).forEach(b => { tally[b] = (tally[b] || 0) + f[b]; });
      });
      s.votes = tally;
      s.lead = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || null;
      return {};
    },

    judge(){ return { verdict:'incomplete', hits:0 }; },

    check(item){
      const d = (item && item.drop) || {};
      const buckets = (d.buckets || []).map(x => String(x).trim()).filter(Boolean);
      const words = d.words || [];
      const bad = [];
      if(buckets.length < 2) bad.push('Needs at least two groups to sort into.');
      if(buckets.length > 4) bad.push(buckets.length + ' groups is more bins than a falling word can be steered between — 4 is the most.');
      const seenB = {};
      buckets.forEach(b => { if(seenB[b.toLowerCase()]) bad.push('The group “' + b + '” is listed twice.'); seenB[b.toLowerCase()] = true; });
      if(words.length < MIN_WORDS) bad.push('Only ' + words.length + ' word' + (words.length === 1 ? '' : 's') + ' — ' + MIN_WORDS + ' is the least that makes a game.');
      if(words.length > MAX_WORDS) bad.push(words.length + ' words; past ' + MAX_WORDS + ' the round outstays the energy it makes.');
      const seenW = {};
      words.forEach(x=>{
        const w = String((x && x.w) || '').trim();
        if(!w) return;
        if(x.b == null || buckets.indexOf(String(x.b)) === -1)
          bad.push('“' + w + '” is filed under “' + x.b + '”, which is not one of the groups — it could never land right.');
        if(seenW[w.toLowerCase()]) bad.push('“' + w + '” falls twice — the second landing teaches nothing.');
        seenW[w.toLowerCase()] = true;
        if(w.length > 24) bad.push('“' + w + '” is too long for a falling tile.');
      });
      return bad;
    },

    settleMs: 300
  });
})();
