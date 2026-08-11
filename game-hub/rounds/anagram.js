/* ================= The anagram round =================
   Scrambled letters, and a row of empty boxes under them. The room drags the
   letters into the boxes until the word is spelled.

   **This is the first round grown out of a question *form*, and the difference
   between the two is the whole point of it existing.** `Kit.prompt`'s `anagram`
   form draws scattered letters and re-sorts them on reveal: the class shouts the
   word and the teacher judges. That form is untouched and still ships — a board
   with no phones wants exactly it. This is the same question *played*: every
   handset gets the letters, the arrangement is the answer, and the round decides
   for itself when a team has it.

   So the two coexist deliberately, keyed by what the item carries:

     { text:'the decision a jury delivers', type:'anagram', answer:'Verdict' }   form
     { text:'the decision a jury delivers', anagram:{ word:'Verdict' } }         round

   Nothing already authored changes behaviour. The eight `type:'anagram'` items in
   Units 4 and 5 stay forms, because a round claiming them would silently convert
   shipped content that a teacher has been using — the one thing a new round must
   never do.

   **Two ways to play it:**

   - **`first`** — the first team to spell the word takes it. The race everybody
     expects from an anagram.
   - **`agree`** — a team's answer counts only when *every* player on it has
     arranged the same word. Slower and much harder, and the argument is the
     lesson: on a four-phone team a race is won by the fastest thumb while the
     other three watch. Being split draws no verdict at all — the card shows how
     far off they are and the room works out what to talk about.

   **Why the letters are not shared across a team's handsets**, which is what
   `Kit.round.shares` exists for and what grouping does: an arrangement is a
   *sequence*, and a sequence cannot be merged. Two students holding three letters
   each do not combine into one word — somebody has to decide the order, and the
   moment they do the other handset is a spectator. So every phone holds every
   letter and the negotiation happens out loud, which is the same conclusion the
   ordering round reached about a scale.

   **Duplicate letters are the thing this round is really built around.** `SENTENCE`
   has three Es, and both ends used to key a pick by its *text* — so tapping one E
   would light all three and the word could never be assembled at all. The card
   solves it with a token per tile (`E#3`, displayed as `E`) and the handset solves
   it by slot index, and `judge` strips the token so both arrive in the same shape.
   Author a word with repeated letters before believing any change to this file. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('anagram.js needs hub-rounds.js loaded first'); return; }


  /* A tile's identity on the card. The letter alone cannot be one — see the header
     — and `#` can never appear in a letter, so the two are unambiguous in both
     directions. The handset sends bare letters, which `bare()` leaves alone: that
     is what lets the teacher's clicks and the room's drags arrive as one shape
     without the phone ever learning the token format. */
  const bare = x => String(x == null ? '' : x).replace(/#\d+$/, '');
  const MIN = 3;
  /* The relay caps `multi` at 12, so a longer word could not be armed anyway — and
     twelve scrambled letters is already past what a class reads off a projector. */
  const MAX = 12;

  K.round.register('anagram', {
    label: 'Drag the Letters',
    blurb: 'Scrambled letters, and boxes to drag them into.',

    modes: [
      { value:'first', label:'First team to spell it takes it' },
      { value:'agree', label:'A team answers only when all of them spell the same word' }
    ],
    /* The whole-team mode, for a board that asks for one — see `teamMode` in
       hub-rounds.js. A tile is a team's answer, not the fastest thumb's. */
    teamMode: 'agree',

    /* Declared, not only described above, so `tools/question-types.js` can print it. */
    sample: { text:"the decision a jury delivers", anagram:{ word:"verdict" } },
    field: 'anagram',

    /* Two fields, not three — `labelB:null`, the same thing a question form
       says. The editor declares its own shape rather than the bench asking
       what kind of thing is being edited. */
    editor: {
      labelA:'The word to scramble — this is the answer',
      labelB:null,
      build: (text, a) => ({ text, anagram:{ word:String(a || '').trim() } }),
      read: it => ({ q:it.text || '', a:(it.anagram || {}).word || '', b:'' })
    },

    claims(item){ return !!(item && item.anagram && item.anagram.word); },

    setup(item, ctx){
      const a = item && item.anagram;
      if(!a) return null;
      const word = String(a.word || '').trim().toUpperCase();
      if(!/^[A-Z]{3,}$/.test(word) || word.length > MAX) return null;
      const letters = word.split('');
      /* Tokens carry the tile's original position, which is only an identity — the
         card never reads the number back, and the scramble below moves the tiles
         around it. */
      const tiles = letters.map((ch, i) => ({ ch, id: ch + '#' + i }));
      /* Re-scrambled until it is not the word itself. A one-letter-off "scramble"
         that happens to come out as the answer is not a puzzle, and with a short
         word it comes up often enough to be worth the loop. */
      let pool = K.round.shuffle(tiles.slice());
      for(let n = 0; n < 12 && pool.map(t => t.ch).join('') === word; n++)
        pool = K.round.shuffle(tiles.slice());
      return {
        text:  String((item && item.text) || ''),
        word,
        answer: word,
        pool,                              // the scrambled tiles, in the order drawn
        need:  word.length,
        mode:  (ctx && ctx.mode === 'agree') ? 'agree' : 'first',
        chosen: [],                        // the teacher's own arrangement, as tokens
        /* The same three-way split grouping, ordering and choice all keep, and for
           the same reason: `picks` is what gets judged, `leading` is what the card
           draws while a team is still working, `votes` is the count behind it. */
        picks: {}, leading: {}, votes: {}, by: {}, got: {},
        hint: [],                          // slot indexes given away, in no order
        say: '', shown: false, done: false
      };
    },

    /* ---------- the projector's view ----------
       The tray on top and the boxes under it, which is exactly what the handset
       draws — so a student looking up from their phone finds the same puzzle in the
       same shape rather than a second version of it. */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-anagram' + (s.mode === 'agree' ? ' agreeing' : '');

      /* The teacher's own arrangement, and the no-relay path: click a letter to
         place it, click a box to send it back. Degradation is the rule — every
         round owes a path where the teacher clicks and judges — and here it is also
         what a Daily Double needs, where the phones are excluded by the game. */
      const held = s.chosen.slice();

      /* The crowd reveal: slots enough of the room already has fill in beside the
         hint's, wearing the same mark. The rules — big rooms only, never the last
         part, hints count toward the cap — are the shelf's, not re-derived here. */
      const known = (s.hint || []).concat(K.round.crowdKnown(c, {
        keys: Array.from({ length: s.need }, (_, i) => i),
        count: i => Object.keys(s.got || {}).filter(t =>
          ((s.got[t] || [])[i] || 0) >= K.round.mustHold(s.mode, c, t)).length,
        started: Object.keys(s.leading || {}).length,
        given: s.hint || []
      }));

      const boxes = document.createElement('div');
      boxes.className = 'ana-boxes';
      for(let i = 0; i < s.need; i++){
        const b = document.createElement('div');
        b.className = 'ana-box';
        const tok = held[i];
        if(tok){
          b.classList.add('filled');
          b.textContent = bare(tok);
          if(c.onPick && !s.shown) b.addEventListener('click', ()=> c.onPick(tok));
        } else if(known.indexOf(i) !== -1){
          /* A given-away letter, in its own box. Only in an *empty* box: writing
             over what the teacher has placed would make the card disagree with the
             tray, and the box the hint is about is the one nobody has filled. */
          b.classList.add('hinted');
          b.textContent = s.word[i];
        }
        if(s.shown){ b.classList.add('right'); b.textContent = s.word[i]; }
        boxes.appendChild(b);
      }

      const tray = document.createElement('div');
      tray.className = 'ana-tray';
      s.pool.forEach(t=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gword ana-tile';
        b.dataset.word = t.id;
        b.textContent = t.ch;
        if(held.indexOf(t.id) !== -1) b.classList.add('spent');
        if(s.shown) b.classList.add('spent');
        if(c.onPick && !s.shown && held.indexOf(t.id) === -1)
          b.addEventListener('click', ()=> c.onPick(t.id));
        tray.appendChild(b);
      });

      mount.appendChild(tray);
      mount.appendChild(boxes);

      /* Each team's lane is the answer slowly populating — **only the correctly
         placed letters appear**, in their own positions. The first draft drew
         each team's furthest arrangement and the first live class read several
         half-wrong sequences at once as a wall of jumbled words; the second drew
         anonymous progress squares, which avoided the mess and informed nobody.
         Drawn by `Kit.round.lanes` — the shared standard owns which teams show
         (all of them, from the moment the round opens), the colour, the agree
         chip; this round supplies only what a cell holds and when it lights:
         `mustHold` — any member in a race, the whole team when they must agree. */
      /* Drawn once the round is over too. A won card stays on screen now, and who
         got there is the most interesting thing left on it — the lanes vanishing at
         the moment of the win is exactly what was reported. */
      {
        K.round.lanes(mount, c, {
          kind: 'ana',
          progressed: Object.keys(s.got || {}),
          lane(t){
            const row = (s.got || {})[t] || [];
            const need = K.round.mustHold(s.mode, c, t);
            const cells = [];
            let right = 0;
            for(let i = 0; i < s.need; i++){
              const ok = (row[i] || 0) >= need;
              if(ok) right++;
              cells.push({ got: ok, text: ok ? s.word[i] : '', colour: true });
            }
            return {
              cells,
              count: right + ' of ' + s.need,
              agree: s.mode === 'agree' ? K.round.agreement(s, c, t) : null,
              full: right === s.need
            };
          }
        });
      }

      /* Always drawn, empty or not — see `Kit.round.say`. An appearing line was
         what made the card jump on the first hint. */
      K.round.say(mount, s);
    },


    /* ---------- the handsets ----------
       The letters in the order the card draws them, so the tray in the hand matches
       the tray on the wall. `arrange` is the one mode a form could never have: it
       draws boxes under the letters and the phone reports the order they were put
       in, which is the answer itself rather than a vote about one. */
    arm(s, ctx){
      const c = ctx || {};
      return {
        mode:    'arrange',
        prompt:  c.prompt === false ? 'Spell the word' : (s.text || 'Spell the word'),
        /* Bare letters, duplicates and all. The handset keys a tile by its slot
           rather than by its text, so three Es are three tiles there — and because
           it sends letters rather than tokens, `bare()` makes the two paths one
           shape without the phone ever learning what a token is. */
        options: s.pool.map(t => t.ch),
        multi:   s.need,
        holds:   true,
        /* An arrangement is worked out by moving letters, so a phone must be able
           to take one back out. Without it the first drop is final, which is not a
           puzzle. */
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    /* Not `Kit.round.poll`, and the reason is the shape of the answer rather than a
       preference: `poll` takes the *first legal word* out of a reply, which is right
       for a vote and for a rung. Here the whole ordered sequence is the answer, so
       nothing about picking one item out of it applies. What is shared with poll is
       the shape it hands back — `answers` / `leading` / `votes` — so the card and
       `Kit.round.agreement` read it exactly as they read the other three rounds. */
    read(replies, s, ctx){
      /* `Kit.round.arrangement` — the drag rounds' shared reader: positional
         (gaps stay gaps), per-position counts for the lanes, full sequences
         tallied for agree mode, a missing roster count never freezing anything.
         This was hand-written here and in scramble.js, and the two drifted —
         which is what moved it to the shelf. */
      const p = K.round.arrangement(replies, {
        need:   s.need,
        clean:  x => bare(x).toUpperCase(),
        wordAt: i => s.word[i],
        legal:  placed => fits(placed, s.word),
        sizes:  (ctx && ctx.sizes) || [],
        mode:   s.mode
      });
      s.leading = p.leading; s.votes = p.votes; s.by = p.by; s.got = p.got;
      return p.picks;
    },

    /* ---------- the hint ----------
       One letter, in its own box, at a **random** empty slot. Filling from the left
       was the first build and it gives away more than one letter's worth: `V E _ _`
       is a run-up a class can guess the rest of, so the second hint is nearly free —
       and it is the same hint every time, so a class replaying the clue learns
       nothing new. A random slot pins exactly one position and leaves the shape of
       the word genuinely open.

       **The card only.** The handsets are not re-dealt a partly-filled tray — a
       student still has to find and place the letter themselves, and they read which
       one off the projector, which is what the projector is for. That also keeps the
       hint free of the relay, so it works with no room at all.

       **Never the last letter.** With one box left there is one tile left, so the
       word is finished either way. */
    hintsLeft(s){
      return Math.max(0, s.need - 1 - (s.hint || []).length);
    },

    hint(s){
      if(!this.hintsLeft(s)) return false;
      const open = [];
      for(let i = 0; i < s.need; i++) if((s.hint || []).indexOf(i) === -1) open.push(i);
      if(!open.length) return false;
      const at = K.round.shuffle(open)[0];
      s.hint = (s.hint || []).concat([at]);
      s.say  = 'Hint: letter ' + (at + 1) + ' is ' + s.word[at] + '.';
      /* `'card'` — the projector changed and the handsets did not, so the host must
         **not** re-arm. An arm resets every phone and clears the replies the relay
         is holding, which on a hint means throwing away what the room has already
         dragged or typed for the sake of a letter on a wall. */
      return 'card';
    },

    judge(answer, s){
      /* `bare` is what makes the teacher's tokens and the room's letters one shape.
         The teacher clicks `E#3`; a handset sends `E`; both judge identically. */
      const seq = (answer || []).map(x => bare(x).toUpperCase());
      if(seq.length !== s.need) return { verdict:'incomplete', hits:0 };
      const right = seq.join('') === s.word;
      /* Hits are letters standing in the right place, which is the only useful
         thing to say about a wrong arrangement — "four of seven are where they
         belong" is something a class can act on. */
      const hits = seq.reduce((n, ch, i) => n + (ch === s.word[i] ? 1 : 0), 0);
      return { verdict: right ? 'right' : 'wrong', hits };
    },

    saidOf(who, r, s){
      if(!r || r.verdict === 'incomplete') return who + ': not finished yet.';
      return who + ': not it — ' + (r.hits || 0) + ' of ' + s.need + ' letters are in the right place.';
    },

    /* What is wrong with an authored item, in the author's language. The last check
       is the one a reader misses: an anagram whose own clue contains the word gives
       itself away completely, and it looks perfectly normal written down. */
    check(item){
      const a = (item && item.anagram) || {};
      const raw = String(a.word || '').trim();
      const bad = [];
      if(!raw) return ['Needs a word to scramble.'];
      const word = raw.toUpperCase();
      if(!/^[A-Z]+$/.test(word))
        bad.push('“' + raw + '” has something other than letters in it — a space, a hyphen or a digit cannot be a tile.');
      if(word.length < MIN) bad.push('“' + raw + '” is too short to scramble — ' + MIN + ' letters is the least.');
      if(word.length > MAX) bad.push('“' + raw + '” is ' + word.length + ' letters; ' + MAX + ' is the most a handset can arrange.');
      const text = String((item && item.text) || '').trim();
      if(!text) bad.push('Needs a clue — the scrambled letters on their own are a word search, not a question.');
      else if(new RegExp('\\b' + word + '\\b', 'i').test(text))
        bad.push('The clue contains the answer “' + raw + '”, which gives it away.');
      return bad;
    },

    settleMs: 600
  });

  /* Every letter in the sequence is one this word actually has, counted rather than
     merely present — so `EEE` is rejected against a word holding one E. */
  function fits(seq, word){
    if(!seq.length || seq.length > word.length) return false;
    const left = {};
    word.split('').forEach(ch => { left[ch] = (left[ch] || 0) + 1; });
    return seq.every(ch => (left[ch] = (left[ch] || 0) - 1) >= 0);
  }

})();
