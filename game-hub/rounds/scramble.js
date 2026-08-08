/* ================= The word order round =================
   A sentence with its words shuffled, and a slot for each. The room drags the
   words into order.

   **The second round grown out of a question form, and the first that cost almost
   nothing** — which is the point of having built the anagram one first. `arrange`
   already existed as a phone mode, the relay already carried it, and the handset
   already reported the order things were placed in. What is here is a round file
   and a layout that suits words rather than letters. Budget the next one against
   this, not against the anagram.

   As with the anagram, the **form it grew out of is untouched**: `Kit.prompt`'s
   `scramble` still draws the words and re-sorts them on reveal, for a board with no
   phones, and the five items already authored keep behaving exactly as they did.
   The two are keyed by different fields:

     { text:'Word order:', type:'scramble', answer:'The witness has retracted it' }  form
     { text:'Word order:', scramble:{ sentence:'The witness has retracted it' } }    round

   **Repeated words are the same problem repeated letters were**, and are solved the
   same way: `the` appears twice in most C1 sentences, every pick in this app is
   keyed by its text, so the card gives each chip a token (`the#4`, drawn as `the`)
   and the handset keys by slot. `judge` strips the token so both arrive in one
   shape. Author a sentence with a repeated word before believing any change here. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('scramble.js needs hub-rounds.js loaded first'); return; }

  const colourOf = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';
  const bare = x => String(x == null ? '' : x).replace(/#\d+$/, '');
  const norm = x => bare(x).trim().toLowerCase();
  const MIN = 3;
  /* The relay caps `multi` at 12, so a longer sentence could not be armed — and
     twelve chips is already past what a handset lays out without becoming fiddly. */
  const MAX = 12;

  const wordsOf = str => String(str || '').trim().split(/\s+/).filter(Boolean);

  K.round.register('scramble', {
    label: 'Drag the Words',
    blurb: 'A shuffled sentence, and a slot for each word.',

    modes: [
      { value:'first', label:'First team to order it takes it' },
      { value:'agree', label:'A team answers only when all of them order it the same' }
    ],
    teamMode: 'agree',

    /* Declared, not only described above, so `tools/question-types.js` can print it. */
    sample: { text:"Put the words in order.",
              scramble:{ sentence:"The jury reached the verdict after four hours" } },
    field: 'scramble',

    editor: {
      labelA:'The sentence in its correct order — this is the answer',
      labelB:null,
      build: (text, a) => ({ text, scramble:{ sentence:String(a || '').trim() } }),
      read: it => ({ q:it.text || '', a:(it.scramble || {}).sentence || '', b:'' })
    },

    claims(item){ return !!(item && item.scramble && item.scramble.sentence); },

    setup(item, ctx){
      const sc = item && item.scramble;
      if(!sc) return null;
      const sentence = String(sc.sentence || '').trim();
      const words = wordsOf(sentence);
      if(words.length < MIN || words.length > MAX) return null;
      const chips = words.map((w, i) => ({ w, id: w + '#' + i }));
      /* Re-shuffled until it is not the sentence itself. On a short sentence the
         shuffle lands on the answer often enough to be worth the loop, and a
         "scramble" that is already in order is not a puzzle. */
      let pool = shuffle(chips.slice());
      for(let n = 0; n < 12 && pool.map(c => c.w).join(' ') === sentence; n++)
        pool = shuffle(chips.slice());
      return {
        text:  String((item && item.text) || 'Put the words in order.'),
        sentence,
        words,
        answer: sentence,
        pool,
        need:  words.length,
        mode:  (ctx && ctx.mode === 'agree') ? 'agree' : 'first',
        chosen: [],
        picks: {}, leading: {}, votes: {}, by: {}, got: {},
        hint: [],                      // slot indexes given away, in no order
        say: '', shown: false, done: false
      };
    },

    /* ---------- the projector's view ----------
       The slots read as a sentence forming, left to right, and they are allowed to
       grow as words land — which is the opposite of the ordering ladder's rule that
       every rung is the same box. The reason is what the thing *is*: a ladder is a
       column several teams are compared down, so a rung that resizes makes the
       lanes stop lining up; a sentence is one line being built, and a slot sized to
       the word it will hold would give away the answer's shape before anybody
       placed anything. */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-scramble' + (s.mode === 'agree' ? ' agreeing' : '');

      const held = s.chosen.slice();

      const line = document.createElement('div');
      line.className = 'scr-line';
      /* **Every slot is one width — the widest word's.** The handset learned this
         first and for the same reason, reported from the room bench: content-sized
         slots re-flow the row every time something lands in one, so the sentence
         jumps and the card changes height under the room. A hint made it obvious,
         because a slot going from `7` to `retracted` moves every slot after it.

         Uniform, not sized-to-its-own-word: a slot as wide as the word it is
         waiting for would give away the answer's shape before anybody placed
         anything. The tray underneath already shows every word, so one width gives
         nothing away. */
      const widest = s.words.reduce((n, w) => Math.max(n, w.length), 1);
      line.style.setProperty('--scr-w', (widest + 1) + 'ch');
      for(let i = 0; i < s.need; i++){
        const b = document.createElement('div');
        b.className = 'scr-slot';
        const tok = held[i];
        if(tok){
          b.classList.add('filled');
          b.textContent = bare(tok);
          if(c.onPick && !s.shown) b.addEventListener('click', ()=> c.onPick(tok));
        }else if((s.hint || []).indexOf(i) !== -1){
          // a given-away word, in an empty slot — see `hint` below
          b.classList.add('hinted');
          b.textContent = s.words[i];
        }else{
          // a number, not an empty box: on a line of ten it is the only way to see
          // which slot is which without counting from the left every time
          b.textContent = String(i + 1);
          b.classList.add('empty');
        }
        if(s.shown){ b.className = 'scr-slot filled right'; b.textContent = s.words[i]; }
        line.appendChild(b);
      }

      const tray = document.createElement('div');
      tray.className = 'scr-tray';
      s.pool.forEach(t=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gword scr-chip';
        b.dataset.word = t.id;
        b.textContent = t.w;
        if(held.indexOf(t.id) !== -1 || s.shown) b.classList.add('spent');
        if(c.onPick && !s.shown && held.indexOf(t.id) === -1)
          b.addEventListener('click', ()=> c.onPick(t.id));
        tray.appendChild(b);
      });

      mount.appendChild(tray);
      mount.appendChild(line);
      /* Now the tray is laid out, take the width from the widest chip actually
         rendered. The `ch` estimate above is a guess — `ch` is the width of a zero
         and a proportional font's `w` and `m` are wider — so the longest word could
         still overflow its slot and grow it, which is the re-flow this is here to
         stop. One read, once per render, off elements that are already on screen.
         Falls back to the estimate when the card is not laid out yet. */
      let widest_px = 0;
      Array.prototype.forEach.call(tray.children, el => {
        widest_px = Math.max(widest_px, el.getBoundingClientRect().width);
      });
      if(widest_px > 0) line.style.setProperty('--scr-w', Math.ceil(widest_px) + 'px');

      /* **A lane per team, and the sentence itself rather than a count.**
         This used to be one chip per team reading "1/9", on the reasoning that a
         sentence is too long to redraw four times on a clue card. Playing it showed
         that reasoning was wrong in the way that matters: a number tells the room
         *that* somebody is ahead and nothing about what they have got, so there is
         nothing to watch and nothing to learn from. The ordering round reached the
         same conclusion for the same reason — the ladder is the picture.

         **Only correct placements show.** A word appears in a team's lane when it is
         in the slot it belongs in; everything else stays blank. That is deliberate
         and it is the whole dynamic: it turns the board into several sentences
         completing at once, and a team that is behind can read a word off a team
         that is ahead. Being copied is the cost of being in front, which is what
         makes it a race rather than four separate exercises.

         Showing wrong placements would do the opposite — it would broadcast one
         team's mistakes to the room, and a lane full of words in the wrong order is
         unreadable at projector distance anyway. */
      /* Drawn by `Kit.round.lanes` — the shared standard owns which teams show
         (all of them, from the moment the round opens), the colour, the agree
         chip; this round supplies only what a cell holds and when it lights:
         `mustHold` — any member in a race, the whole team when they must agree. */
      /* Drawn once the round is over too. A won card stays on screen now, and who
         got there is the most interesting thing left on it — the lanes vanishing at
         the moment of the win is exactly what was reported. */
      {
        K.round.lanes(mount, c, {
          kind: 'scr',
          progressed: Object.keys(s.got || {}),
          lane(t){
            const gotRow = (s.got || {})[t] || [];
            const need = K.round.mustHold(s.mode, c, t);
            const cells = [];
            let right = 0;
            for(let i = 0; i < s.need; i++){
              const ok = (gotRow[i] || 0) >= need;
              if(ok) right++;
              cells.push({ got: ok, text: ok ? s.words[i] : '' });
            }
            return {
              cells,
              count: right + '/' + s.need,
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

    reveal(mount, s, ctx){
      s.done = true; s.shown = true; s.chosen = [];
      /* **What the room did is kept, not wiped.** These used to be cleared here, and
         it was invisible while a won card flipped away within a second — now that it
         stays up until the teacher closes it, clearing them took the team lanes off
         the screen at exactly the moment there was finally time to read them. The
         card shrank as it did so, which was a second warp on top. */
      this.render(mount, s, ctx);
      return 0;
    },

    /* ---------- the handsets ----------
       The same `arrange` mode the anagram uses, unchanged — it takes a list of
       strings and reports the order they were placed in, and a word is only a
       longer string than a letter. That it needed nothing new is the whole return
       on having built the anagram round first. */
    arm(s, ctx){
      const c = ctx || {};
      return {
        mode:    'arrange',
        prompt:  c.prompt === false ? 'Put the words in order' : (s.text || 'Put the words in order'),
        options: s.pool.map(t => t.w),
        multi:   s.need,
        holds:   true,
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    read(replies, s, ctx){
      /* `Kit.round.arrangement` — the drag rounds' shared reader: positional
         (gaps stay gaps), per-position counts for the lanes, full sequences
         tallied for agree mode. See the shelf note in hub-rounds.js. */
      const p = K.round.arrangement(replies, {
        need:   s.need,
        clean:  bare,
        wordAt: i => s.words[i],
        legal:  placed => fits(placed, s.words),
        sizes:  (ctx && ctx.sizes) || [],
        mode:   s.mode
      });
      s.leading = p.leading; s.votes = p.votes; s.by = p.by; s.got = p.got;
      return p.picks;
    },

    /* ---------- the hint ----------
       One word, in its slot, at a **random** empty position — the same shape as Drag
       the Letters and for the same reason, only more so here: a sentence read from
       the left is a run-up, so *"The jury …"* hands over most of what comes next and
       the second hint costs nothing. A word pinned at position seven is one fact
       about the sentence and leaves the rest to be worked out.

       The card only, exactly as the letters are: nobody's tray is re-dealt, the word
       is read off the projector and still has to be placed. **Never the last word** —
       one slot left is one chip left, so the sentence finishes itself. */
    hintsLeft(s){
      return Math.max(0, s.need - 1 - (s.hint || []).length);
    },

    hint(s){
      if(!this.hintsLeft(s)) return false;
      const open = [];
      for(let i = 0; i < s.need; i++) if((s.hint || []).indexOf(i) === -1) open.push(i);
      if(!open.length) return false;
      const at = shuffle(open)[0];
      s.hint = (s.hint || []).concat([at]);
      s.say  = 'Hint: word ' + (at + 1) + ' is "' + s.words[at] + '".';
      /* `'card'` — the projector changed and the handsets did not, so the host must
         **not** re-arm. An arm resets every phone and clears the replies the relay
         is holding, which on a hint means throwing away what the room has already
         dragged or typed for the sake of a letter on a wall. */
      return 'card';
    },

    judge(answer, s){
      const seq = (answer || []).map(bare);
      if(seq.length !== s.need) return { verdict:'incomplete', hits:0 };
      /* Compared case-insensitively, because a sentence's first word is capitalised
         and a student who put it third has still put it third — marking that wrong
         on a capital letter would be marking the wrong thing. */
      const right = seq.map(w => w.toLowerCase()).join(' ') === s.sentence.toLowerCase();
      const hits = seq.reduce((n, w, i) => n + (norm(w) === norm(s.words[i]) ? 1 : 0), 0);
      return { verdict: right ? 'right' : 'wrong', hits };
    },

    saidOf(who, r, s){
      if(!r || r.verdict === 'incomplete') return who + ': not finished yet.';
      return who + ': not it — ' + (r.hits || 0) + ' of ' + s.need + ' words are in the right place.';
    },

    check(item){
      const sc = (item && item.scramble) || {};
      const raw = String(sc.sentence || '').trim();
      const bad = [];
      if(!raw) return ['Needs a sentence to shuffle.'];
      const words = wordsOf(raw);
      if(words.length < MIN)
        bad.push('“' + raw + '” is ' + words.length + ' word' + (words.length === 1 ? '' : 's') +
                 ' — ' + MIN + ' is the least that has an order to get wrong.');
      if(words.length > MAX)
        bad.push('“' + raw + '” is ' + words.length + ' words; ' + MAX +
                 ' is the most a handset can arrange.');
      /* The one a reader misses, exactly as the anagram's giveaway clue is: a prompt
         that quotes the sentence it is asking for hands over the answer, and looks
         completely ordinary written down. */
      const text = String((item && item.text) || '').trim();
      if(text && text.toLowerCase().indexOf(raw.toLowerCase()) !== -1)
        bad.push('The prompt contains the sentence itself, which gives it away.');
      return bad;
    },

    settleMs: 700
  });

  /* Every word in the sequence is one this sentence actually has, counted rather
     than merely present — so three `the`s are rejected against a sentence holding
     two. Case-insensitive, because the first word arrives capitalised. */
  function fits(seq, words){
    if(!seq.length || seq.length > words.length) return false;
    const left = {};
    words.forEach(w => { const k = norm(w); left[k] = (left[k] || 0) + 1; });
    return seq.every(w => (left[norm(w)] = (left[norm(w)] || 0) - 1) >= 0);
  }

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
})();
