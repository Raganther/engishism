/* ================= The grouping round — "Connections" =================
   Eight words, four of which belong together. Every phone in the room is armed with
   a multi-pick selection, a team's answer is the **union of its players' picks**,
   and a set is judged the moment it settles.

   This file is the whole question type: the card the projector shows, what the
   handsets are put into, how several students' taps become one team answer, and
   whether that answer is right. A game show calls it by name and gets all four; it
   is authored and iterated in the playground and the game show is only a host.

   **What is deliberately not here: scoring, turns, timers, the board.** Jeopardy
   pays a tile and passes a turn when this says a team has it; the bench pays
   nothing. A round that knew about points could only ever live in one game.

   Authoring shape, and there is exactly one place the truth lives:

     { q:"Four of these belong in a courtroom. Find the four.",
       group:{ pick:["verdict","jury","testimony","acquittal"],
               with: ["sabbatical","promotion","redundancy","overtime"] } }

   No `answer` field — the answer *is* `pick`, and writing it twice is two facts
   that can drift apart. The decoys must be a coherent group of their own or the
   round is a spotting exercise rather than a discrimination; that is the one
   authoring rule no check can make for you. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('grouping.js needs hub-rounds.js loaded first'); return; }


  K.round.register('grouping', {
    label: 'Connections',
    blurb: 'Eight words, four that belong together. The room assembles them from their phones.',

    /* Two ways to play, on the `mode` axis. `tap` is the original — a multi-pick
       vote, the team answer the union of its players' taps. `flick` is a physics
       face: eight word tiles and a row of four slots, drag the four that belong
       into the row. **`principal:false`**: the vote stays the default (this round
       has always voted), flick is turned on per category from the content screen's
       Tap/Flick toggle. Only when phones are absent does the physics run on the
       card; with phones each handset runs its own table (the `mode:'table'` arm)
       and the card is the scoreboard. */
    modes: [ { value:'tap', label:'Tap the words' }, { value:'flick', label:'Flick the words in' } ],
    physics: { axis:'mode', value:'flick', on:'Flick', off:'Tap', principal:false },

    /* An item carries a `group`, or it is not this round. Asked this way so a host
       never has to learn the field name. */
    /* The item field this round owns. The normaliser copies it across on its own,
       so nobody has to remember to widen a whitelist — see `Kit.round.fields()`. */
    /* The authoring shape, declared rather than only described in the comment above,
       so a tool can print it and an author never has to read the source. */
    sample: { text:"Four of these are ways of cooking food. Find the four.",
              group:{ pick:["grilled","steamed","roasted","fried"],
                      with:["chopped","sliced","peeled","grated"] } },
    field: 'group',

    /* How the workshop writes one. The decoys are their own field because they
       are their own decision: four cooking verbs against four random words is a
       spotting exercise, against four *preparation* verbs it is the lesson. */
    editor: {
      labelA:'The words that belong together',
      labelB:'The decoys — they must be a coherent group of their own',
      build: (text, a, b) => ({ text, group:{ pick:K.round.list(a), with:K.round.list(b) } }),
      read: it => ({ q:it.text || '', a:((it.group||{}).pick||[]).join(', '),
                     b:((it.group||{}).with||[]).join(', ') })
    },

    claims(item){ return !!(item && item.group && Array.isArray(item.group.pick)); },

    /* The authored item becomes the round's own state. Anything malformed returns
       null and the host plays it as an ordinary question — the same way a
       mis-authored question form declines to plain text rather than rendering
       nonsense. */
    setup(item, ctx){
      const g = item && item.group;
      if(!g || !Array.isArray(g.pick) || g.pick.length < 2) return null;
      const pick = g.pick.map(String);
      const rest = (Array.isArray(g.with) ? g.with : []).map(String)
                     .filter(w => pick.indexOf(w) === -1);
      if(!rest.length) return null;
      return {
        text:   String((item && item.text) || ''),
        answer: pick.join(', '),
        pick,
        need:   pick.length,
        words:  K.round.shuffle(pick.concat(rest)),
        mode:   (ctx && ctx.mode === 'flick') ? 'flick' : 'tap',   // flick = the physics face; tap = the vote
        cardCells: [],  // what is docked on the board flick face (the host's Check reads it)
        verdict:   null,// the flick face's live right/wrong tint, cleared while a tile moves
        chosen: [],     // what the teacher has clicked, with no phones in the room
        hint:   [],     // words given away as belonging to the group, one per press
        picks:  {},     // team index -> the union of that team's players' picks
        verdictBy: {},  // team index -> its last verdict, for the lane / feed to draw
        say:    '',
        done:   false
      };
    },

    /* ---------- the projector's view ----------
       Two columns, which is the same rule the handset uses for a list this long. A
       set of words is something you choose *between*, so they have to be seen at
       once and be comparable at a glance — and the card and the phone showing the
       same shape is what makes them one question rather than two.

       `ctx.onPick` is how the host says a word was clicked. It is a callback rather
       than the round doing it directly, because "the teacher clicked a word" means
       different things on a clue card and on a bench. */
    render(mount, s, ctx){
      const c = ctx || {};

      /* ---------- FLICK: the physics face ----------
         Eight word tiles and a row of four slots — flick the four that belong
         into the row. Only the board face (no phones, still live) runs the
         physics on the card; with phones each handset runs its own table and the
         card falls through to the word grid + lanes below. A settled row of four
         is judged as a set against the group (order irrelevant). */
      if(s.mode === 'flick' && !s.done && K.round.face(s, c) === 'board'){
        const table = K.round.cardTable(mount, s, {
          handle: '__grpFlick',     // place() fires no onArrange — a probe places then reads state
          height: 300,
          frame(canvas){
            mount.innerHTML = '';
            mount.className = 'round-grouping';
            mount.appendChild(canvas);
          },
          deal(t){
            /* Four word-wide slots in a row (`count:4` — eight labels would build
               eight), the eight tiles heaped below. */
            t.slots({ cols:s.need, rows:1, bar:true, labels:s.words, count:s.need, top:8 });
            t.setPieces(s.words.slice());
          },
          table: {
            upright: true,
            onArrange(){
              const table = s._table;              // built inside cardTable; read it back off state
              const cells = table.cells();
              s.cardCells = cells.slice();
              s.chosen = cells.filter(Boolean);
              if(s.chosen.length === s.need){
                const want = s.pick.map(w => String(w).toLowerCase());
                const ok = s.chosen.every(w => want.indexOf(String(w).toLowerCase()) !== -1);
                s.verdict = ok ? 'right' : 'wrong';
                table.setResult(s.verdict);
              } else {
                s.verdict = null;
                table.setResult(null);
              }
            }
          }
        });
        return;
      }
      // Any DOM path (tap, or flick with phones, or a decided round) tears down a
      // stale flick canvas so the word grid is not drawn under a live physics loop.
      if(s._canvas){ s._table = null; s._canvas = null; }

      mount.innerHTML = '';
      mount.className = 'round-grouping';

      const grid = document.createElement('div');
      grid.className = 'group-words';
      /* The crowd reveal: an in-group word enough of the room is already holding
         gets the hint mark — confirmed rather than answered, exactly what a hint
         does. Big rooms only, never the fourth word; the rules are the shelf's. */
      const cw = {
        keys: s.pick,
        count: w => Object.keys(s.picks || {})
                      .filter(t => (s.picks[t] || []).indexOf(w) !== -1).length,
        started: Object.keys(s.picks || {}).length,
        given: s.hint || [],
        sig: s.pick.join('|')
      };
      const known = (s.hint || []).concat(K.round.crowdKnown(c, cw));
      s.words.forEach(w=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gword';
        b.dataset.word = w;
        const label = document.createElement('span');
        label.className = 'gw-text';
        label.textContent = w;
        b.appendChild(label);
        // once it is over, the four that were right say so whoever found them
        if(s.done && s.pick.indexOf(w) !== -1) b.classList.add('right');
        /* A hinted word is marked as *in the group* and stays fully playable — it
           narrows the search rather than answering it, and a word that could not
           then be picked would make the hint cost the class a slot. */
        if(!s.done && known.indexOf(w) !== -1) b.classList.add('hinted');
        /* The teacher's own selection is a neutral dashed ring and never a team
           colour: on a round every team is playing at once, nothing the teacher
           clicks belongs to anybody. */
        if(s.chosen.indexOf(w) !== -1) b.classList.add('chosen');
        const holders = Object.keys(s.picks).filter(t => (s.picks[t]||[]).indexOf(w) !== -1);
        if(holders.length) b.classList.add('held');
        if(c.onPick) b.addEventListener('click', ()=> c.onPick(w));
        grid.appendChild(b);
      });
      mount.appendChild(grid);

      /* A lane per team — drawn by `Kit.round.lanes`, the shared standard. What
         a Connections lane holds is the team's *current picks*, not verified
         answers: a grouping answer is only ever judged as a whole set, so the
         picks are the only live fact there is to show. */
      const sizes = c.sizes || [];
      /* Drawn once the round is over too. A won card stays on screen now, and who
         got there is the most interesting thing left on it — the lanes vanishing at
         the moment of the win is exactly what was reported. */
      {
        K.round.lanes(mount, c, {
          kind: 'grp',
          progressed: Object.keys(s.picks || {}),
          lane(t){
            const picks = s.picks[t] || [];
            const cells = [];
            const slots = Math.max(s.need, picks.length);
            for(let i = 0; i < slots; i++){
              if(picks[i]) cells.push({ got: true, text: picks[i], cls: i >= s.need ? 'over' : '' });
              else cells.push({ got: false });
            }
            /* **This team has the set.** Every other round shows a correct answer in
               its own lane — a green lane on Multiple Choice, letters landing in
               place on the drag rounds, a rung filling on the thermometer. This one
               showed nothing at all while the question stayed open, because its only
               mark is the four words lighting on the board and that is gated on
               `s.done` — the round being *over*, which now waits for the teacher.

               Marking the lane rather than the board is the point: the four words are
               the answer, so lighting them would hand it to every team still hunting,
               while a green lane says "they have it" and nothing about what it is.
               Their own four are already printed in their own lane either way. */
            const correct = picks.filter(w => s.pick.some(p =>
                              String(p).toLowerCase() === String(w).toLowerCase())).length;
            const has = picks.length === s.need && correct === s.need;

            /* **The count is how many they have right, not how many they picked.** It
               tells a player they are close without ever saying which word is the wrong
               one — the group stays a puzzle, the board just says how far off. Safe to
               show on the shared board because a lane only moves on a *sent* answer
               (previews are off unless the teacher turns on crowdLive), so it cannot be
               toggled one word at a time to binary-search the four. */
            let count = correct + '/' + s.need + ' right' + (picks.length > s.need ? ' · too many' : '');
            if(sizes[t]){
              /* "two each" is the rule the teacher has to be able to say out
                 loud, and it moves on its own whenever somebody joins or drops. */
              count += ' · ' + sizes[t] + (sizes[t] === 1 ? ' phone, ' : ' phones, ') +
                       K.round.shares(s.need, [sizes[t]])[0] + ' each';
            }
            /* In lane mode the verdict rides this player's own line, where it stays
               until their next try instead of flashing past on a shared headline. Never
               on a lane that already has the set — a green "4/4 right" beside "one away"
               reads as a contradiction. */
            if(c.commentary === 'lane' && !has && s.verdictBy && s.verdictBy[t])
              count += ' · ' + s.verdictBy[t].text;
            return { cells, count, tone: has ? 'good' : null };
          }
        });
      }

      /* The reveal meter — how close the room is to the next word lighting,
         never which word. Always called: a decided round gets the row hidden
         rather than removed (`live`), because the meter leaving moved the card
         at exactly the moment the room looks at it. */
      cw.live = !s.done;
      K.round.crowdMeter(mount, c, cw);

      /* Always drawn, empty or not — see `Kit.round.say`. An appearing line was
         what made the card jump on the first hint. */
      K.round.say(mount, s);
    },

    /* Answering it on the board: the four light where they stand, which is the
       thing worth seeing. The host still prints the answer line, because "which
       four" and "why those four" are different questions. */

    /* ---------- the handsets ----------
       Everything past `mode` and `options` is carried to the relay unread, so the
       round can ask for a shape the engine has never heard of. */
    arm(s, ctx){
      const c = ctx || {};
      /* flick → each handset runs its own Kit.table: eight word tiles and a row of
         `need` slots, flick the ones that belong into the row. `count:need` builds
         a row of slots rather than one per label. The wire back is the docked cells
         (`|`-joined), which is the SAME shape a multi-pick vote sends, so `read`
         merges them by union unchanged. */
      if(s.mode === 'flick'){
        return {
          mode:    'table',
          prompt:  c.prompt === false ? ('Find the group of ' + s.need) : (s.text || ('Find the group of ' + s.need)),
          options: s.words.slice(),
          cols: s.need, rows: 1, count: s.need, bar: true, upright: true,
          bare:    true,   // the minimal full-bleed phone — the words are the puzzle
          multi:   s.need,
          holds:   true,
          rethink: true,
          team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
        };
      }
      return {
        mode:    'vote',
        /* A label, not a sentence, when the host is not sending the question: eight
           options already fill a handset and every line of instruction is a line of
           words pushed off the screen. */
        prompt:  c.prompt === false ? ('Find the group of ' + s.need) : (s.text || ('Find the group of ' + s.need)),
        options: s.words.slice(),
        multi:   s.need,
        multiByTeam: (c.sizes && c.sizes.length) ? K.round.shares(s.need, c.sizes) : null,
        /* A pick is a state a phone is *holding*, not an answer it has given, so it
           leaves with the phone — otherwise a student who walks out goes on
           occupying two of their team's words with nobody able to drop them. */
        holds:   true,
        /* The whole point is that a team argues and moves, so a tap must be able to
           replace the last one. */
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    /* A team's answer is the **union of its players' picks**, because a team of two
       phones could never assemble four words at one vote each — and the union is
       also what forces the negotiation, since six words up means agreeing which two
       to drop. */
    read(replies, s){
      /* Board flick, no phones: the answer is the set docked on the card, as team 0.
         With phones the docked cells arrive as ordinary replies (`|`-joined, the same
         shape a multi-pick vote sends), so they fall through to the union below. */
      if(s && s.mode === 'flick' && !(replies && replies.length))
        return { 0: (s.cardCells || []).filter(Boolean) };
      const out = {};
      (replies || []).forEach(r=>{
        const t = Number(r && r.team) || 0;
        const set = out[t] || (out[t] = []);
        String((r && r.value) == null ? '' : r.value).split('|').filter(Boolean).forEach(w=>{
          if(s.words.indexOf(w) !== -1 && set.indexOf(w) === -1) set.push(w);
        });
      });
      return out;
    },

    /* ---------- the green ----------
       Which of a phone's words are finished with — and here it is all-or-nothing: a
       team's four go green together the instant its picks *are* the group, and nothing
       shows before that. A partial or a wrong pick is left plain on purpose, because
       the whole point of this round is that a guess costs a look at the board rather
       than a per-word tell on the handset.

       Pushed by the host without a re-arm (`roundSendDone`), so the four light on the
       phones of whoever found them and on nobody else's — the board still keeps the
       answer to itself, marking the lane rather than the words. Same array-indexed-by-
       team shape the ordering round's `settled` returns; a team the roster does not
       reach gets `[]`, which the phone reads as "nothing settled". */
    done(s, ctx){
      const teams = (ctx && ctx.teams) || [];
      const want  = s.pick.map(w => String(w).toLowerCase());
      return teams.map((_, t) => {
        const set  = s.picks[t] || [];
        const hits = set.filter(w => want.indexOf(String(w).toLowerCase()) !== -1).length;
        return (set.length === s.need && hits === s.need) ? s.pick.slice() : [];
      });
    },

    /* ---------- the hint ----------
       One word named as belonging to the group. That is the right size of give-away
       here because the search is combinatorial: eight words with four to find is 70
       possible sets, and naming one takes it to 35, then 20, then 10 — a real cut
       each time without ever handing over the answer.

       **Never the last one.** With three of four named the fourth is whichever
       remaining word makes a group, so the set is decided — and a hint that decides
       the answer is Reveal, which is already a button. */
    hintsLeft(s){
      return Math.max(0, s.need - 1 - (s.hint || []).length);
    },

    hint(s){
      const next = s.pick.filter(w => (s.hint || []).indexOf(w) === -1)[0];
      if(!next || !this.hintsLeft(s)) return false;
      s.hint = (s.hint || []).concat([next]);
      s.say = 'Hint: ' + next + ' is one of them.'; s.sayTeam = null;
      /* `'card'` — the projector changed and the handsets did not, so the host must
         **not** re-arm. An arm resets every phone and clears the replies the relay
         is holding, which on a hint means throwing away what the room has already
         dragged or typed for the sake of a letter on a wall. */
      return 'card';
    },

    // is this team's set complete, and if so is it the group
    judge(answer, s){
      const set  = answer || [];
      const want = s.pick.map(w => w.toLowerCase());
      const hits = set.filter(w => want.indexOf(String(w).toLowerCase()) !== -1).length;
      if(set.length !== s.need) return { verdict:'incomplete', hits };
      /* `done` because being right *is* the ending here — there is nothing left to
         fill in. An ordering climb is the round that needed the distinction. */
      return { verdict: hits === s.need ? 'right' : 'wrong', hits, done: hits === s.need };
    },

    // how a wrong set is described — "one away" is worth saying and costs nothing
    check(item){
      const g = (item && item.group) || {};
      if(!Array.isArray(g.pick)) return ['Needs the words that belong together.'];
      const pick = g.pick.map(w => String(w).trim()).filter(Boolean);
      const rest = (Array.isArray(g.with) ? g.with : []).map(w => String(w).trim()).filter(Boolean);
      const bad = [];
      if(pick.length < 2) bad.push('Needs at least 2 words to find.');
      if(!rest.length) bad.push('Has no decoys, so there is nothing to discriminate.');
      /* A word appearing twice makes the union ambiguous: a team holding it once
         would be judged against a set that contains it twice. */
      const seen = Object.create(null);
      pick.concat(rest).forEach(w => {
        const k = w.toLowerCase();
        if(seen[k]) bad.push('Word appears twice: “' + w + '”.');
        seen[k] = true;
      });
      if(pick.length + rest.length > 20)
        bad.push((pick.length + rest.length) + ' words, over the relay’s cap of 20 — the phones would be offered fewer than the board shows.');
      if(!String((item && item.text) || '').trim()) bad.push('Needs a question.');
      return bad;
    },

    /* The verdict on its own, with no name — the handset and the player's lane both
       already know whose it is. `saidOf` builds the headline from it, so "one away"
       lives in one place and cannot drift between the two. */
    missNote(r, s){
      return r.hits === s.need - 1 ? 'One away…' : 'Not a group.';
    },
    saidOf(who, r, s){
      return who + ': ' + this.missNote(r, s).toLowerCase();
    },

    settleMs: 700
  });

})();
