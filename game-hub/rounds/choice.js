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

  const colourOf = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';
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

    /* Declared, not only described above, so `tools/question-types.js` can print it. */
    sample: { text:"Which verb goes with 'a sentence', when a judge delivers one?",
              choice:{ options:["pass","make","do","give"], answer:"pass" } },
    field: 'choice',

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
        /* Once the answer is out the options stop being a question: the right one
           lights and the rest stand down, rather than four tiles still inviting a
           click that can no longer mean anything. */
        if(s.shown) b.classList.add(same(w, s.answer) ? 'right' : 'spent');

        /* A dot for **every** team with a vote on this option, not just the ones
           leading with it. That is the whole picture in `agree` mode — a team on
           3/4 with nothing showing where the fourth student went tells the room it
           is stuck without telling it what to argue about — and it is worth having
           in `first` too, where it is simply who went for what. */
        /* A host may hold the counts back — Millionaire collects a vote on every
           question but only shows it when the team spends Ask the class, which is
           what turns "the class already answered" into something still worth
           spending. Nothing else sets it, so every other board is unaffected. */
        const votes  = c.hideVotes ? {} : (s.votes || {});
        const wants  = Object.keys(votes).filter(t2 => ((votes[t2].for || {})[w] || 0) > 0);
        const leads  = c.hideVotes ? []
                     : Object.keys(s.leading).filter(t2 => (s.leading[t2]||[]).indexOf(w) !== -1);
        if(leads.length) b.classList.add('leading');
        if(wants.length && !s.shown){
          b.classList.add('held');
          /* **A count, not dots, when the host asks for one.** Which is right depends
             on the question the room is being asked: on a tile the interesting fact
             is *which teams* went where, and on Millionaire's Ask the class it is
             *how many people* did — "12 said B" is the lifeline, and four coloured
             dots are not. Same data, and the host says which reading it wants. */
          if(c.countVotes){
            const n = Object.keys(votes)
              .reduce((a, t2) => a + ((votes[t2].for || {})[w] || 0), 0);
            const tag = document.createElement('span');
            tag.className = 'mc-votes'; tag.textContent = n;
            b.appendChild(tag);
          } else {
            const dots = document.createElement('span');
            dots.className = 'gdots';
            wants.forEach(t2=>{
              const d = document.createElement('span');
              d.className = 'gdot';
              d.style.background = colourOf(Number(t2));
              d.title = c.teamName ? c.teamName(Number(t2)) : ('Team ' + (Number(t2)+1));
              dots.appendChild(d);
            });
            b.appendChild(dots);
          }
        }

        if(c.onPick && !s.shown && !gone) b.addEventListener('click', ()=> c.onPick(w));
        grid.appendChild(b);
      });
      mount.appendChild(grid);

      /* How close each team is to agreeing. Only in `agree` mode: in a race the
         count is not what anybody is waiting for, and a strip that says nothing is
         still a strip taking height off a clue card. */
      if(s.mode === 'agree' && !s.done && !c.hideVotes){
        const chips = ((c.sizes || []).map((_, i) => i))
          .map(t => ({ t, ag: K.round.agreement(s, c, t) }))
          .filter(x => x.ag);
        if(chips.length){
          const tally = document.createElement('div');
          tally.className = 'group-tally';
          chips.forEach(({ t, ag })=>{
            const chip = document.createElement('span');
            chip.className = 'group-count' + (ag.all ? ' all' : '');
            chip.style.borderColor = colourOf(t);
            chip.textContent = (c.teamName ? c.teamName(t) : ('Team ' + (t + 1))) + ' ';
            const n = document.createElement('small');
            n.textContent = ag.agreed + '/' + ag.size;
            chip.appendChild(n);
            tally.appendChild(chip);
          });
          mount.appendChild(tally);
        }
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
           something — and in `agree` mode it would make the round unplayable, since
           talking somebody round is the entire mechanic. */
        rethink: true,
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
