/* ================= The multiple choice round =================
   A question and four answers, one of them right. The plainest question type there
   is, and the last one to be built — which is the right way round: grouping and
   ordering were built first because they are the ones that *shaped* the contract,
   and this is the one that proves the contract holds for something ordinary.

   **It needed no engine change to be hosted.** The Jeopardy adapter did not learn a
   thing: the clue normaliser asks `Kit.round.fields()`, the tile asks
   `Kit.round.of(item)`, and the ⚙ row for its modes is built from `modes`. Loading
   the file is the whole integration, and that is the return on the extraction rather
   than a claim about it.

   **Two ways to play it, and they are a real teaching choice:**

   - **`first`** — the first team with the right answer takes the question. The
     standard quiz beat, and what a Jeopardy tile expects.
   - **`agree`** — a team's answer only counts once *every* player on that team has
     picked the same option. The same rule the word thermometer plays by, for the
     same reason: on a four-phone team a race is won by the fastest thumb and the
     other three never have to commit to anything. Slower, and the argument is the
     lesson. Being split draws no verdict at all — the card shows how far off they
     are and the room works out what to talk about.

   Authoring shape:

     { text:"Which verb goes with 'a sentence'?",
       choice:{ options:["pass","make","do","give"], answer:"pass" } }

   **The answer is written as the option itself, never as a letter or an index.**
   A letter would have to survive the shuffle, and an index is silently off-by-one
   forever the first time somebody writes 1 meaning the first. Written as the word,
   a typo matches nothing and `setup` returns null, so the card says the question is
   not complete instead of quietly marking the wrong answer right.

   **The options are shuffled per clue**, because authors put the answer first and a
   class works that out in about two questions. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('choice.js needs hub-rounds.js loaded first'); return; }

  /* No team palette here any more: the lanes own the colour, as they do for every
     other round that draws one. This round used to paint it onto the option a team
     had picked, which is the leak the lanes were brought in to close. */
  const same = (a, b) => String(a || '').trim().toLowerCase() ===
                         String(b || '').trim().toLowerCase();
  const LETTERS = 'ABCDEFGH';

  K.round.register('choice', {
    label: 'Multiple Choice',
    blurb: 'One question, four answers. The room picks one.',

    modes: [
      { value:'first', label:'First team with the right answer takes it' },
      { value:'agree', label:'A team answers only when all of them agree' }
    ],
    teamMode: 'agree',

    /* Declared, not only described above, so `tools/question-types.js` can print it. */
    sample: { text:"Which verb goes with 'a sentence', when a judge delivers one?",
              choice:{ options:["pass","make","do","give"], answer:"pass" } },
    field: 'choice',

    editor: {
      labelA:'The options — they are shuffled, so order does not matter',
      labelB:'The right one, written out as it appears above',
      build: (text, a, b) => ({ text, choice:{ options:K.round.list(a), answer:String(b || '').trim() } }),
      read: it => ({ q:it.text || '', a:((it.choice||{}).options||[]).join(', '),
                     b:(it.choice||{}).answer || '' })
    },

    claims(item){ return !!(item && item.choice && Array.isArray(item.choice.options)); },

    setup(item, ctx){
      const o = item && item.choice;
      if(!o || !Array.isArray(o.options)) return null;
      const options = o.options.map(x => String(x).trim()).filter(Boolean);
      // two is the least that is a choice at all; more than eight stops being one
      if(options.length < 2 || options.length > 8) return null;
      /* The answer has to *be* one of the options. Anything else is an authoring
         slip, and returning null here is what turns it into a visible "this question
         is not complete" rather than a clue nobody can ever get right. */
      const answer = options.find(w => same(w, o.answer));
      if(!answer) return null;
      return {
        text:    String((item && item.text) || ''),
        answer,
        options: shuffle(options.slice()),
        need:    1,
        mode:    (ctx && ctx.mode === 'agree') ? 'agree' : 'first',
        chosen:  [],                // the teacher's own pick, with no phones
        /* Options a **host** has taken out of play — Millionaire's 50:50 is the
           first caller. Generic on purpose: "narrow the choice" is a hint mechanic
           any board might want, and the round only has to honour it. They stay on
           screen struck through rather than vanishing, because watching two go is
           the drama; they leave the handsets entirely, because a phone offering a
           tap that cannot count is just broken. */
        hidden:  [],
        /* Options the **hint** has taken off the card. Deliberately a separate list
           from `hidden`, because the two do opposite things at the two ends of the
           room: a host's 50:50 stays on screen struck through *and leaves every
           handset* — watching two go is the drama a lifeline is spent on — whereas a
           hint takes the box off the card and **leaves the phones exactly as they
           were**. See `hint` below for why. */
        hint:    [],
        /* The same three-way split the ordering round keeps, and for the same
           reason: `picks` is what gets judged, `leading` is what the card draws
           while a team argues, `votes` is the count behind it. */
        picks:   {},
        leading: {},
        votes:   {},
        by:      {},
        say:     '',
        shown:   false,             // the answer is out, so the options stop being live
        done:    false
      };
    },

    /* ---------- the projector's view ----------
       Two columns, which is the shape a handset lays four short options out in — so
       the card and the phone read as the same question rather than two versions of
       it. The letter is a card-side affordance only: it is what lets a teacher say
       "who went for B?" out loud, and it is not sent to the phones, where the words
       are the whole screen and a letter would just be noise. */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-choice' + (s.mode === 'agree' ? ' agreeing' : '');

      const grid = document.createElement('div');
      grid.className = 'mc-options';
      s.options.forEach((w, i)=>{
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'gword mc-opt'; b.dataset.word = w;

        const key = document.createElement('span');
        key.className = 'mc-letter'; key.textContent = LETTERS[i] || '·';
        b.appendChild(key);

        const t = document.createElement('span');
        t.className = 'gw-text'; t.textContent = w;
        b.appendChild(t);

        if(s.chosen.indexOf(w) !== -1) b.classList.add('chosen');
        const gone = (s.hidden || []).indexOf(w) !== -1;
        if(gone){ b.classList.add('removed'); b.disabled = true; }
        /* **A hinted option goes invisible; its cell stays.** A crossed-out box
           still costs a slot on the projector and the room still reads it, so the
           box has to go — but *removing the element* re-flows the grid and the whole
           card jumps a row every time a hint is pressed, which is worse than the
           thing it fixed. `visibility` empties the box and holds its place, so the
           card is exactly as tall after four hints as before one.

           It also keeps A/B/C/D where they were: a teacher who said "who went for
           C?" before the hint means the same option after it. */
        if((s.hint || []).indexOf(w) !== -1 && !s.shown){
          b.classList.add('gone'); b.disabled = true;
        }
        /* Once the answer is out the options stop being a question: the right one
           lights and the rest stand down, rather than four tiles still inviting a
           click that can no longer mean anything. */
        if(s.shown) b.classList.add(same(w, s.answer) ? 'right' : 'spent');

        /* **Nothing on an option says who went for it.** The dots that used to sit
           here painted a team's colour on the option it had picked, which on a
           projector is the class reading each other's answers off the board — the
           opposite of what a multiple choice is asking. Where a team is up to is
           the lanes' job below, and the lanes deliberately say *how many have
           answered* without saying what they answered.

           The one exception is the host asking for a **count**: Millionaire's Ask
           the class is a lifeline the team has spent to see exactly this, so "12
           said B" is the whole point of it and is not a leak. Nothing else sets
           `countVotes`, so every other board shows nothing on the options. */
        const votes = c.hideVotes ? {} : (s.votes || {});
        if(c.countVotes && !s.shown){
          const n = Object.keys(votes)
            .reduce((a, t2) => a + ((votes[t2].for || {})[w] || 0), 0);
          if(n){
            b.classList.add('held');
            const tag = document.createElement('span');
            tag.className = 'mc-votes'; tag.textContent = n;
            b.appendChild(tag);
          }
        }

        if(c.onPick && !s.shown && !gone) b.addEventListener('click', ()=> c.onPick(w));
        grid.appendChild(b);
      });
      mount.appendChild(grid);

      /* A lane per team, the shared standard — the same picture Connections, Drag
         the Letters and Drag the Words draw, so a class meets one way of reading
         "where is each team up to" whatever the question is. This used to be a row
         of chips in `agree` mode and nothing at all in a race, which made the same
         fact look like two different features.

         **A cell is a person, not an answer.** One box per handset on the team,
         filled as that student commits — so the room can see a team is waiting on
         one more without seeing what anybody chose. That is the whole difference
         from the dots this replaced: the count is public, the answer is not.

         `hideVotes` still silences it, because Millionaire holds the room's vote
         back until the team spends Ask the class. */
      /* Drawn once the round is over too. A won card stays on screen now, and who
         got there is the most interesting thing left on it — the lanes vanishing at
         the moment of the win is exactly what was reported. */
      if(!c.hideVotes){
        K.round.lanes(mount, c, {
          kind: 'mc',
          progressed: Object.keys(s.votes || {}),
          lane(t){
            const v = (s.votes || {})[t] || {};
            const said = v.said || 0;
            /* With no roster count — no relay, or nobody counted yet — the lane
               shows what has arrived rather than nothing, the same rule
               `mustHold` follows: a number the host does not have must never
               make a card say less than it knows. */
            const size  = Number((c.sizes || [])[t]) || said;
            const cells = [];
            for(let i = 0; i < Math.max(size, said, 1); i++) cells.push({ got: i < said });

            /* **What the filled lane turned out to mean**, which is three
               different things and used to be one. `full` alone washed the lane
               green the moment everybody had answered — so a team split three
               ways and a team that had agreed on the wrong option both read as
               the good outcome, which is the opposite of the information the
               room needs.

               `said` is how many have answered; `agreed` is how many of those
               hold the *leading* option. Everyone answered and all said the same
               thing is a committed answer, and then it is simply right or wrong.
               Everyone answered and they did not is the **argument**, which is
               the interesting state and the one worth marking amber rather than
               green — a team is not finished because it has stopped typing. */
            const all      = !!size && said >= size;
            const oneMind  = all && said > 0 && (v.agreed || 0) >= said;
            const lead     = ((s.leading || {})[t] || [])[0];
            const tone = !all      ? null
                       : !oneMind  ? 'warn'
                       : same(lead, s.answer) ? 'good' : 'bad';

            /* **No count beside the boxes.** The boxes *are* the count — two boxes
               filled of three is "2/3" said twice — and in `agree` mode the lane
               header already carries a fraction of its own, how many hold the
               leading answer. Two similar fractions on one lane read as a bug
               rather than as two facts. */
            return {
              cells,
              agree: s.mode === 'agree' ? K.round.agreement(s, c, t) : null,
              tone,
              /* `full` is the drag rounds' "assembled the whole thing" and would
                 wash this lane green underneath the tone. The tone is the whole
                 answer here. */
              full: false
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
       The options exactly as the card draws them, in the same order, so a student
       looking up from their phone finds what they just tapped in the same place. */
    arm(s, ctx){
      const c = ctx || {};
      return {
        mode:    'vote',
        prompt:  c.prompt === false ? 'Pick an answer' : (s.text || 'Pick an answer'),
        options: s.options.filter(w => (s.hidden || []).indexOf(w) === -1),
        multi:   1,
        /* No share. One option is the whole answer, so there is nothing to split
           across a team's handsets — what a team divides here is the argument, not
           the answer. */
        multiByTeam: null,
        holds:   true,
        /* A vote is a negotiation, so a player can move it. Without this the first
           tap is final, which is a submission rather than a team agreeing on
           something.

           **A host may ask for the opposite** (`lockIn`), and Quickfire does: when
           the clock is the opponent, changing your answer after watching the count
           is the opposite of what the board measures. **But never in `agree` mode**,
           where talking somebody round is the entire mechanic and a final first tap
           would make the round unplayable. The round protects its own contract
           rather than trusting the host to know that. */
        rethink: !(c.lockIn && s.mode !== 'agree'),
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    read(replies, s, ctx){
      const p = K.round.poll(replies, {
        sizes: (ctx && ctx.sizes) || [],
        unanimous: s.mode === 'agree',
        // anything that is not one of the options is a stale tap from a previous clue
        valid: w => s.options.indexOf(w) !== -1 && (s.hidden || []).indexOf(w) === -1
      });
      s.leading = p.leading; s.votes = p.votes; s.by = p.by;
      return p.answers;
    },

    /* ---------- the hint ----------
       One wrong option off the card. It is 50:50's idea, and it is deliberately
       **not** 50:50's mechanism, because the two want opposite things at the two
       ends of the room:

       - the **card** loses the box entirely. A struck-out option still costs a slot
         and the room still reads it; taking it away makes what is left the whole
         question, which is the point of asking for a hint.
       - the **phones keep it**. Re-arming would redraw four buttons as three under
         thirty thumbs mid-question, which moves the option somebody was about to
         tap — and a student who then picks the one that has gone from the board has
         told the teacher something worth knowing. A lifeline is different: it is
         *spent*, so the class watching two options leave their own handsets is what
         it was spent on.

       So this keeps its own list. `hidden` is still the host's — Millionaire's
       50:50 — and still behaves exactly as it did.

       **Never below two on the card.** One option left is not a choice, it is the
       answer, and giving away the answer is Reveal. On four options that is two
       hints. The two mechanics do not fight: each only ever removes an option the
       other has left alone, and neither can ever remove the right one. */
    hintsLeft(s){
      return Math.max(0, s.options.length - (s.hidden || []).length
                                          - (s.hint   || []).length - 2);
    },

    hint(s){
      if(!this.hintsLeft(s)) return false;
      const out = shuffle(s.options.filter(w =>
        !same(w, s.answer) &&
        (s.hidden || []).indexOf(w) === -1 &&
        (s.hint   || []).indexOf(w) === -1))[0];
      if(!out) return false;
      s.hint = (s.hint || []).concat([out]);
      // the teacher cannot un-click a box that is no longer on screen
      s.chosen = (s.chosen || []).filter(w => w !== out);
      s.say = 'Hint: it is not ' + out + '.';
      /* The phones keep all four, so there is nothing to re-arm — which is the
         whole reason this hint has its own list instead of using `hidden`. */
      /* `'card'` — the projector changed and the handsets did not, so the host must
         **not** re-arm. An arm resets every phone and clears the replies the relay
         is holding, which on a hint means throwing away what the room has already
         dragged or typed for the sake of a letter on a wall. */
      return 'card';
    },

    judge(answer, s){
      const pick = (answer || [])[0];
      if(!pick) return { verdict:'incomplete', hits:0 };
      const right = same(pick, s.answer);
      /* No `done`, so the host's default applies and being right ends the question —
         which for a multiple choice is simply true. Ordering had to say otherwise
         because a right rung is progress; there is no progress to make here. */
      return { verdict: right ? 'right' : 'wrong', hits: right ? 1 : 0 };
    },

    /* What is wrong with an authored item, in the author's language. The last one is
       the reason this hook exists at all: a clue whose answer is not one of its own
       options looks completely normal to a reader and is simply impossible to get
       right, so it has to be *said* rather than left to a null. */
    check(item){
      const o = (item && item.choice) || {};
      const opts = Array.isArray(o.options) ? o.options.map(w => String(w).trim()).filter(Boolean) : [];
      const bad = [];
      if(!Array.isArray(o.options)) return ['Needs a list of options.'];
      if(opts.length < 2) bad.push('Needs at least 2 options to be a choice at all.');
      if(opts.length > 8) bad.push(opts.length + ' options — more than 8 stops being a choice.');
      const seen = Object.create(null);
      opts.forEach(w => {
        const k = w.toLowerCase();
        if(seen[k]) bad.push('Option appears twice: “' + w + '”.');
        seen[k] = true;
      });
      if(!String(o.answer || '').trim()) bad.push('Needs an answer.');
      else if(!opts.some(w => w.toLowerCase() === String(o.answer).trim().toLowerCase()))
        bad.push('The answer “' + o.answer + '” is not one of the options — nobody could ever get this right.');
      if(!String((item && item.text) || '').trim()) bad.push('Needs a question.');
      return bad;
    },

    saidOf(who){ return who + ': not that one.'; },

    settleMs: 700
  });

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
})();
