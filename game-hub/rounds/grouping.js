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
        hint:   [],     // words given away as belonging to the group, one per press
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
        /* A hinted word is marked as *in the group* and stays fully playable — it
           narrows the search rather than answering it, and a word that could not
           then be picked would make the hint cost the class a slot. */
        if(!s.done && (s.hint || []).indexOf(w) !== -1) b.classList.add('hinted');
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
      if(!s.done){
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
            let count = picks.length + '/' + s.need + (picks.length > s.need ? ' — too many' : '');
            if(sizes[t]){
              /* "two each" is the rule the teacher has to be able to say out
                 loud, and it moves on its own whenever somebody joins or drops. */
              count += ' · ' + sizes[t] + (sizes[t] === 1 ? ' phone, ' : ' phones, ') +
                       K.round.shares(s.need, [sizes[t]])[0] + ' each';
            }
            return { cells, count };
          }
        });
      }

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
      s.say = 'Hint: ' + next + ' is one of them.';
      return true;
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
