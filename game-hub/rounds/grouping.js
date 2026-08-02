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

  const colourOf = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';

  K.round.register('grouping', {
    label: 'Connections',
    blurb: 'Eight words, four that belong together. The room assembles them from their phones.',

    /* An item carries a `group`, or it is not this round. Asked this way so a host
       never has to learn the field name. */
    /* The item field this round owns. The normaliser copies it across on its own,
       so nobody has to remember to widen a whitelist — see `Kit.round.fields()`. */
    field: 'group',

    claims(item){ return !!(item && item.group && Array.isArray(item.group.pick)); },

    /* The authored item becomes the round's own state. Anything malformed returns
       null and the host plays it as an ordinary question — the same way a
       mis-authored question form declines to plain text rather than rendering
       nonsense. */
    setup(item){
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
        words:  shuffle(pick.concat(rest)),
        chosen: [],     // what the teacher has clicked, with no phones in the room
        picks:  {},     // team index -> the union of that team's players' picks
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
      mount.innerHTML = '';
      mount.className = 'round-grouping';

      const grid = document.createElement('div');
      grid.className = 'group-words';
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
        /* The teacher's own selection is a neutral dashed ring and never a team
           colour: on a round every team is playing at once, nothing the teacher
           clicks belongs to anybody. */
        if(s.chosen.indexOf(w) !== -1) b.classList.add('chosen');
        const holders = Object.keys(s.picks).filter(t => (s.picks[t]||[]).indexOf(w) !== -1);
        if(holders.length){
          b.classList.add('held');
          const dots = document.createElement('span');
          dots.className = 'gdots';
          holders.forEach(t=>{
            const d = document.createElement('span');
            d.className = 'gdot';
            d.style.background = colourOf(Number(t));
            d.title = c.teamName ? c.teamName(Number(t)) : ('Team ' + (Number(t)+1));
            dots.appendChild(d);
          });
          b.appendChild(dots);
        }
        if(c.onPick) b.addEventListener('click', ()=> c.onPick(w));
        grid.appendChild(b);
      });
      mount.appendChild(grid);

      /* How close each team is, named and counted. Complete means it is about to be
         judged; over means they have to agree to drop some, and saying so is what
         turns being over into a conversation rather than an error. */
      const names = c.teams || [];
      const sizes = c.sizes || [];
      const line  = document.createElement('div');
      line.className = 'group-tally';
      names.forEach((name, i)=>{
        const n = (s.picks[i] || []).length;
        // a team with neither a phone nor a pick says nothing rather than sitting at 0/4
        if(!n && !sizes[i]) return;
        const chip = document.createElement('span');
        chip.className = 'group-count';
        chip.style.borderColor = colourOf(i);
        chip.textContent = name + ' ' + n + '/' + s.need + (n > s.need ? ' — too many' : '');
        if(sizes[i]){
          /* "two each" is the rule the teacher has to be able to say out loud, and
             it moves on its own whenever somebody joins or drops. */
          const tail = document.createElement('small');
          tail.textContent = ' · ' + sizes[i] + (sizes[i] === 1 ? ' phone, ' : ' phones, ') +
                             K.round.shares(s.need, [sizes[i]])[0] + ' each';
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

    /* Answering it on the board: the four light where they stand, which is the
       thing worth seeing. The host still prints the answer line, because "which
       four" and "why those four" are different questions. */
    reveal(mount, s, ctx){
      s.done = true;
      s.chosen = [];
      this.render(mount, s, ctx);
      return 0;                       // never in place of the answer line
    },

    /* ---------- the handsets ----------
       Everything past `mode` and `options` is carried to the relay unread, so the
       round can ask for a shape the engine has never heard of. */
    arm(s, ctx){
      const c = ctx || {};
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

    saidOf(who, r, s){
      return who + (r.hits === s.need - 1 ? ': one away…' : ': not a group.');
    },

    settleMs: 700
  });

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
})();
