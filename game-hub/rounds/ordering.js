/* ================= The ordering round — "Word Thermometer" =================
   A set of words that belong on a scale, and the room has to put them in order:
   `annoyed → irritated → livid → furious → incensed`. Grouping asks *does this
   belong?*; this asks *how much?* — which is the harder question and the one C1
   students plateau on. They know "angry" and "furious"; the distance between
   *irritated* and *livid* is what they are actually short of.

   **Two ways to play it, and they are genuinely different lessons rather than two
   speeds of one.** The host picks with `ctx.mode`:

   - **`climb`** — one shared ladder, filled a rung at a time from the cold end.
     Everyone votes on what comes next, it locks in, and its gloss prints as it lands.
     Slower, but every student is in every decision and the teacher gets five
     teachable moments instead of one.
   - **`race`** — a ladder each, side by side, and the first team to fill theirs takes
     the question. Each team has placed different words and so has a different set
     left, which is why this is the one round that asks each team a *different*
     question (`optionsByTeam`).

   **A sequence is not a set, and that is the whole reason this was built second.**
   Grouping merges a team's phones with a union — four words from four handsets are
   one answer whatever order they arrived in. An order cannot be merged: two students
   tapping different words do not combine into a third. So a team answers **one rung
   at a time**, and the rung does not land until every player on that team has picked
   it. A majority used to be enough, which let three students carry a fourth who was
   never asked to commit; the argument that brings the fourth round is the lesson,
   not an obstacle to it.

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
      { value:'climb', label:'One ladder — the whole room fills it together' },
      { value:'race',  label:'A ladder each — teams race to finish theirs first' }
    ],

    /* The item field this round owns. The normaliser copies it across on its own,
       so nobody has to remember to widen a whitelist — see `Kit.round.fields()`. */
    field: 'order',

    claims(item){ return !!(item && item.order && Array.isArray(item.order.scale)); },

    setup(item, ctx){
      const o = item && item.order;
      if(!o || !Array.isArray(o.scale) || o.scale.length < 3) return null;
      const scale = o.scale.map(String);
      const mode = (ctx && ctx.mode === 'race') ? 'race' : 'climb';
      /* One lane per team in a race, so each side has its own ladder and its own
         remaining words. The picture is the point: you can see who is two rungs up
         without reading a scoreboard, which a shared pool with dots on it could
         never show. */
      const lanes = {};
      if(mode === 'race') ((ctx && ctx.teams) || []).forEach((_, i) => { lanes[i] = []; });
      return {
        text:   String((item && item.text) || ''),
        answer: scale.join(' → '),
        scale,
        need:   scale.length,
        low:    String(o.low  || 'weakest'),
        high:   String(o.high || 'strongest'),
        gloss:  o.gloss || {},
        mode,
        placed: [],                 // the shared ladder, `climb` only
        lanes,                      // team -> that team's own ladder, `race` only
        pool:   shuffle(scale.slice()),
        chosen: [],                 // the teacher's own working order, with no phones
        /* Three facts about what the room is saying, and they are deliberately not
           one. `picks` is a team's *committed* answer — the thing that gets judged —
           and it only exists once the whole team agrees. `leading` is what most of
           them are saying right now, which is what the card draws while they argue.
           `votes` is the count behind it, so the room can see how far off agreeing
           they are. Collapsing these back into one field is how a majority would
           quietly start winning rungs again. */
        picks:  {},                 // team -> the answer the whole team has agreed on
        leading:{},                 // team -> the word most of them are saying, for the card
        votes:  {},                 // team -> { for:{word:n}, said, agreed }
        by:     {},                 // team -> whose phone the answer came from
        won:    null,               // the team that finished first, `race` only
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
      mount.className = 'round-ordering' + (s.mode === 'race' ? ' racing' : '');

      const cap = (txt, cls) => {
        const e = document.createElement('div');
        e.className = 'ord-cap ' + cls; e.textContent = txt; return e;
      };

      /* One ladder, drawn top-down so the strongest sits where a room expects it.
         `placed` is stored cold-end-first because that is the order it is filled in,
         and the two are deliberately not the same thing. */
      const drawLadder = (placed, team, withCaps) => {
        const lane = document.createElement('div');
        lane.className = 'ord-lane';
        if(team != null){
          const who = document.createElement('div');
          who.className = 'ord-who';
          who.style.color = colourOf(team);
          if(s.won === team) who.classList.add('won');
          const nm = document.createElement('span');
          nm.className = 'ord-name';
          nm.textContent = c.teamName ? c.teamName(team) : ('Team ' + (team + 1));
          who.appendChild(nm);
          /* **How many of them agree, on the team's own label rather than on a rung.**
             It has to sit outside the ladder: a count on the `next` rung makes that
             one rung two lines tall, the lanes stop lining up with each other, and
             the ladder goes back to lurching — the exact bug the equal-height rungs
             were written to kill. */
          const ag = agreement(s, c, team);
          if(ag){
            const n = document.createElement('small');
            n.className = 'ord-agree' + (ag.all ? ' all' : '');
            n.textContent = ag.agreed + '/' + ag.size;
            who.appendChild(n);
          }
          lane.appendChild(who);
        }
        const ladder = document.createElement('div');
        ladder.className = 'ord-ladder';
        if(withCaps) ladder.appendChild(cap(s.high, 'hot'));
        for(let i = s.need - 1; i >= 0; i--){
          const rung = document.createElement('div');
          rung.className = 'ord-rung';
          const word = placed[i] || (s.done && team == null ? s.scale[i] : null);
          const isNext = !s.done && i === placed.length;
          if(word){
            rung.classList.add('filled');
            if(team != null) rung.style.borderColor = colourOf(team);
            const w = document.createElement('span');
            w.className = 'ord-word'; w.textContent = word;
            rung.appendChild(w);
            /* The gloss is the teaching, and it prints as the word lands — the one
               moment the room is looking straight at it. Only on a shared ladder:
               four lanes of glosses is a wall of text nobody reads. */
            const g = s.mode === 'climb' && s.gloss && s.gloss[word];
            if(g){
              const note = document.createElement('small');
              note.className = 'ord-gloss'; note.textContent = g;
              rung.appendChild(note);
            }
          } else if(isNext){
            rung.classList.add('next');
            /* A team's own next answer, shown in the rung it is aimed at rather than
               in a list somewhere else — so you watch it land or shake. It is the
               *leading* word, not the agreed one: the room has to be able to see what
               it is converging on while it is still arguing, or a team a vote short
               of unanimous would look like a team that had done nothing. */
            const guess = team != null && (s.leading[team] || [])[0];
            rung.textContent = guess || 'next?';
            if(guess) rung.classList.add('guessing');
          } else {
            rung.classList.add('empty');
          }
          ladder.appendChild(rung);
        }
        if(withCaps) ladder.appendChild(cap(s.low, 'cold'));
        lane.appendChild(ladder);
        return lane;
      };

      if(s.mode === 'race'){
        /* The two ends of the scale are a property of the *question*, not of each
           team, so they are named once above and below the lanes. Repeating them per
           lane put four copies of "the highest praise there is" across the card,
           which is three copies of noise and the height of another rung. */
        mount.appendChild(cap(s.high, 'hot'));
        const lanes = document.createElement('div');
        lanes.className = 'ord-lanes';
        Object.keys(s.lanes).map(Number).sort((a,b)=>a-b).forEach(t=>{
          lanes.appendChild(drawLadder(s.lanes[t], t, false));
        });
        mount.appendChild(lanes);
        mount.appendChild(cap(s.low, 'cold'));
      } else {
        mount.appendChild(drawLadder(s.placed, null, true));
      }

      /* What is left to place. On a shared ladder this is the ballot; in a race each
         team has its own remaining words on their phones, so the card shows the full
         set as a reminder of what is in play. */
      /* **In a race the card keeps every word, always.** Each team has placed
         different ones, so removing a word because *some* team used it makes the
         card lie to the other three — and filtering by the teacher's own lane made
         the shared list shrink as Team 1 climbed, which reads as words vanishing for
         no reason anybody else can see. The card is the reference list of what is in
         play; each team's own remaining set is on their handsets, where it belongs.
         On one shared ladder there is only one lane, so a placed word really is
         gone and the pool follows it. */
      const left = s.mode === 'race'
        ? s.pool.slice()
        : s.pool.filter(w => s.placed.indexOf(w) === -1);
      // …but the teacher's own lane still marks what it has used, so a click that
      // could only be wrong is visibly so
      const mine = s.mode === 'race' ? (s.lanes[c.forTeam || 0] || []) : s.placed;
      if(!s.done && left.length){
        const pool = document.createElement('div');
        pool.className = 'ord-pool';
        left.forEach(w=>{
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'gword'; b.dataset.word = w;
          const t = document.createElement('span');
          t.className = 'gw-text';
          const at = s.chosen.indexOf(w);
          t.textContent = at === -1 ? w : (at + 1) + '. ' + w;
          b.appendChild(t);
          if(at !== -1) b.classList.add('chosen');
          if(s.mode === 'race' && mine.indexOf(w) !== -1) b.classList.add('spent');
          if(s.mode === 'climb'){
            /* A dot for **any** team with a vote on this word, not just the ones
               leading with it. Now that a rung waits for a whole team, the useful
               thing on the card is where they disagree — a tally saying "1/2" with
               nothing showing what the other student wants tells the room it is
               stuck without telling it what to argue about. The ring still marks the
               word a team is leading with, so which is which stays readable. */
            const votes  = s.votes || {};
            const wants  = Object.keys(votes).filter(t2 => ((votes[t2].for || {})[w] || 0) > 0);
            const leads  = Object.keys(s.leading).filter(t2 => (s.leading[t2]||[]).indexOf(w) !== -1);
            const holders = wants.length ? wants : leads;
            if(leads.length) b.classList.add('leading');
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
          }
          if(c.onPick) b.addEventListener('click', ()=> c.onPick(w));
          pool.appendChild(b);
        });
        mount.appendChild(pool);
      }

      /* On a shared ladder there is no per-team header to hang the count on, so it
         goes in a strip of its own — the same chips a grouping card counts with. It
         says the same thing the race's lane labels say: this is how close your team
         is to agreeing, and nothing lands until it reads 4/4. */
      if(s.mode === 'climb' && !s.done){
        const chips = ((c.sizes || []).map((_, i) => i))
          .map(t => ({ t, ag: agreement(s, c, t) }))
          .filter(x => x.ag);
        if(chips.length){
          const tally = document.createElement('div');
          tally.className = 'group-tally';
          chips.forEach(({ t, ag })=>{
            const chip = document.createElement('span');
            chip.className = 'group-count' + (ag.all ? ' all' : '');
            chip.style.borderColor = colourOf(t);
            const lead = (s.leading[t] || [])[0];
            chip.textContent = (c.teamName ? c.teamName(t) : ('Team ' + (t + 1)))
                             + (lead ? ' · ' + lead + ' ' : ' ');
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
      s.done = true;
      s.placed = s.scale.slice();       // the whole ladder, in the right order
      Object.keys(s.lanes || {}).forEach(t => { s.lanes[t] = s.scale.slice(); });
      s.chosen = [];
      // the answer is out, so what the room was part-way to agreeing is no longer news
      s.picks = {}; s.leading = {}; s.votes = {};
      this.render(mount, s, ctx);
      return 0;
    },

    /* ---------- the handsets ----------
       `climb` is one tap: which word comes next. `whole` is the whole order, tapped
       in sequence — the relay preserves the order taps were made in, so a sequence
       needs nothing the phones do not already do. */
    arm(s, ctx){
      const c = ctx || {};
      const teams = c.teams || [];
      const leftFor = placed => s.pool.filter(w => (placed || []).indexOf(w) === -1);
      const label = s.mode === 'race'
        ? 'Which comes next on your ladder?'
        : ('Which comes next? (' + (s.placed.length + 1) + ' of ' + s.need + ')');
      const arm = {
        mode:    'vote',
        prompt:  c.prompt === false ? label : (s.text || label),
        options: leftFor(s.mode === 'race' ? [] : s.placed),
        multi:   1,
        /* No per-team share: an order cannot be assembled from pieces the way a set
           can, so splitting it across handsets would produce fragments nothing can
           merge. One tap each, and the team argues out loud. */
        multiByTeam: null,
        holds:   true,
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
      /* **A race asks each team a different question**, because each has placed
         different words and so has a different set left. That is `optionsByTeam` —
         built for this shape and used by nothing until now. A team not named falls
         through to the room-wide list, so nothing else in the app is affected. */
      if(s.mode === 'race'){
        arm.optionsByTeam = teams.map((_, i) => leftFor(s.lanes[i] || []));
      }
      return arm;
    },

    /* **A sequence cannot be merged**, which is what the second round was written
       to find out. Grouping unions a team's phones because four words from four
       handsets are one answer whatever order they arrived in; two students tapping
       different orders do not combine into a third. So a team answers one rung at a
       time and the team argues out loud about which — which is also why a race
       needs no share and no per-phone cap. */
    /* **The whole team, or nobody.** A rung used to land on whatever most of the team
       had said, which meant three students could carry a fourth who was never asked
       to commit — and on a two-phone team it meant one student playing and one
       watching. The rung now waits until *every* player on that team has chosen, and
       chosen the same word. Getting there is the lesson: they have to talk each other
       round, which is the whole reason a scale is worth playing rather than telling.
       Being split is not being wrong, so it draws no verdict at all — the card shows
       `2/4` and the room works out for itself what is missing.

       Two things it must never do. It must not deadlock on a number it does not
       have: with no relay, or before the host has counted anybody, `size` is 0 and
       the leading vote lands exactly as it used to. And it must not lock the teacher
       out — their own Check button never comes through here, so a class with one
       phone in a drawer is still playable. */
    read(replies, s, ctx){
      const p = K.round.poll(replies, {
        sizes: (ctx && ctx.sizes) || [],
        unanimous: true,
        /* A word already on that team's ladder is a stale tap, not an answer — and
           in a race that is a *different* set of words per team, which is why this
           takes the team and the shared helper does not try to guess it. */
        valid(w, t){
          if(s.pool.indexOf(w) === -1) return false;
          const placed = s.mode === 'race' ? (s.lanes[t] || []) : s.placed;
          return placed.indexOf(w) === -1;
        }
      });
      s.leading = p.leading; s.votes = p.votes; s.by = p.by;
      return p.answers;
    },

    judge(answer, s, team){
      const seq = answer || [];
      if(seq.length !== 1) return { verdict:'incomplete', hits:0 };
      const placed = (s.mode === 'race' && team != null) ? (s.lanes[team] || []) : s.placed;
      const want = s.scale[placed.length];
      const right = String(seq[0]).toLowerCase() === String(want || '').toLowerCase();
      return { verdict: right ? 'right' : 'wrong', hits: right ? 1 : 0,
               /* The round ends when *a* ladder is full, not on the first right
                  answer — in a race that is the team that finishes theirs first. */
               done: right && placed.length + 1 === s.need };
    },

    /* Commit a correct answer. Grouping leaves this out — being right *is* the
       ending there — and a climb is the case that needed it: right means progress. */
    accept(answer, s, team){
      const word = (answer || [])[0];
      if(!word) return;
      if(s.mode === 'race' && team != null){
        const lane = s.lanes[team] || (s.lanes[team] = []);
        lane.push(word);
        /* The answer has landed, so it stops being that team's *guess* — otherwise
           the rung above shows the word that was just locked in below it, which
           reads as the team proposing something they have already placed. The count
           goes with it: a lane still reading 4/4 over an empty rung says the team has
           agreed on something when in fact they have not been asked yet. */
        delete s.picks[team]; delete s.leading[team]; delete s.votes[team];
        if(lane.length >= s.need){ s.done = true; s.won = team; }
        return;
      }
      s.placed.push(word);
      s.picks = {}; s.leading = {}; s.votes = {};
      if(s.placed.length >= s.need) s.done = true;
    },

    saidOf(who, r, s){ return who + ': not that one yet.'; },

    settleMs: 700
  });

  // on the shelf, because the multiple choice card counts the same way
  const agreement = (s, c, team) => K.round.agreement(s, c, team);

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
})();
