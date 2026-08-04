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

  const colourOf = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';

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

    field: 'anagram',

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
      let pool = shuffle(tiles.slice());
      for(let n = 0; n < 12 && pool.map(t => t.ch).join('') === word; n++)
        pool = shuffle(tiles.slice());
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
        picks: {}, leading: {}, votes: {}, by: {},
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

      /* What each team has built so far, in their own colour. This is the round's
         whole picture on a projector: you can see one team three letters in and
         another nearly finished without reading a scoreboard, which is the same
         reason the ordering race gives every team its own ladder. */
      const lanes = Object.keys(s.leading)
        .map(Number)
        .filter(t => (s.leading[t] || []).length);
      if(lanes.length && !s.shown){
        const wrap = document.createElement('div');
        wrap.className = 'ana-teams';
        lanes.sort((a,b)=>a-b).forEach(t=>{
          const row = document.createElement('div');
          row.className = 'ana-team';
          const who = document.createElement('span');
          who.className = 'ana-who';
          who.style.borderColor = colourOf(t);
          who.textContent = c.teamName ? c.teamName(t) : ('Team ' + (t + 1));
          /* How close they are to agreeing, on the team's own label rather than in
             the letters. A count inside the boxes makes one box two lines tall and
             the rows stop lining up — the same bug the ordering ladder paid for,
             one grid over. */
          const ag = s.mode === 'agree' ? K.round.agreement(s, c, t) : null;
          if(ag){
            const n = document.createElement('small');
            n.textContent = ag.agreed + '/' + ag.size;
            if(ag.all) who.classList.add('all');
            who.appendChild(n);
          }
          row.appendChild(who);
          const seq = document.createElement('span');
          seq.className = 'ana-seq';
          (s.leading[t] || []).forEach(ch=>{
            const el = document.createElement('span');
            el.className = 'ana-mini';
            el.style.borderColor = colourOf(t);
            el.textContent = bare(ch);
            seq.appendChild(el);
          });
          const left = s.need - (s.leading[t] || []).length;
          if(left > 0){
            const rest = document.createElement('small');
            rest.className = 'ana-left';
            rest.textContent = left + ' to go';
            seq.appendChild(rest);
          }
          row.appendChild(seq);
          wrap.appendChild(row);
        });
        mount.appendChild(wrap);
      }

      if(s.say){
        const say = document.createElement('div');
        say.className = 'group-say' + (s.done ? ' good' : '');
        say.textContent = s.say;
        mount.appendChild(say);
      }
    },

    reveal(mount, s, ctx){
      s.done = true; s.shown = true; s.chosen = [];
      s.picks = {}; s.leading = {}; s.votes = {};
      this.render(mount, s, ctx);
      return 0;
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
      const sizes = (ctx && ctx.sizes) || [];
      const tally = {}, said = {}, by = {}, best = {};
      (replies || []).forEach(r=>{
        const t = Number(r && r.team) || 0;
        const seq = String((r && r.value) == null ? '' : r.value)
                      .split('|').map(x => bare(x).toUpperCase()).filter(Boolean);
        // a reply carrying letters this word does not have is a stale tap from a
        // previous clue, not a wrong answer to this one
        if(!fits(seq, s.word)) return;
        said[t] = (said[t] || 0) + 1;
        by[t] = r.name;
        /* The furthest anybody on the team has got is what the card draws. It is
           deliberately not the same thing as the team's answer: in `agree` mode a
           team can be watching one student build the word and still have nothing
           that counts, and showing the progress is what stops that reading as a
           board that has frozen. */
        if(!best[t] || seq.length > best[t].length) best[t] = seq;
        if(seq.length !== s.need) return;
        const box = tally[t] || (tally[t] = {});
        const key = seq.join('');
        box[key] = (box[key] || 0) + 1;
      });
      const picks = {}, leading = {}, votes = {};
      Object.keys(best).forEach(t => { leading[t] = best[t]; });
      Object.keys(tally).forEach(t=>{
        const box  = tally[t];
        const lead = Object.keys(box).sort((a,b)=> box[b] - box[a])[0];
        if(lead == null) return;
        const agreed = box[lead];
        votes[t] = { for:box, said:said[t] || 0, agreed };
        const size = Number(sizes[t]) || 0;
        /* A missing count never freezes a round — with no relay, or before anybody
           has been counted, the leading arrangement lands exactly as it would
           without the gate. Same rule as `Kit.round.poll`. */
        if(s.mode !== 'agree' || !size || agreed >= size) picks[t] = lead.split('');
      });
      s.leading = leading; s.votes = votes; s.by = by;
      return picks;
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

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
})();
