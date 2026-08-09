/* ================= The bingo round =================
   A card of nine words in every student's hand, a run of clues read out, and the
   first person to line three up takes it.

   **This is the round the "state that outlives one question" addition exists for**,
   and it is the first thing here that is not question-shaped. Every other round is
   set up, played and discarded; a bingo card has to survive the next call, the call
   after that, and the student's phone dropping off the wifi in between. Two halves
   made it possible and neither is in this file:

     ctx.keep        the host's store, keyed by player id, scoped to this round and
                     thrown away when a game starts. Anything a *student* carries.
     cardsByPlayer   on the arm — a round cannot send the relay its own messages, so
                     the card and its marks ride the arm that was going anyway.

   **One authored item is a whole game of bingo, not one call.** That is the shape
   that fits: a card is drawn from a pool, and the pool is only knowable if the item
   holds every call. So the round runs its own sequence, and the teacher moves it on
   with a declared button rather than a clock — which is what a teacher does anyway,
   because they are the one reading the clue aloud.

     { text:"Crime and justice",
       bingo:{ calls:[ {clue:"The decision a jury delivers.", answer:"verdict"}, … ] } }

   **The pool is the answers**, not a second list to keep in step. Twelve calls give
   a pool of twelve and a card of nine, so no two cards are the same and nobody is
   holding a card that is finished before the game is.

   **What it does not contain, like every round: scoring.** It says who has a line;
   the host pays whatever a line is worth on that board. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('bingo.js needs hub-rounds.js loaded first'); return; }

  const SIDE = 3;                 // a 3x3 card, which is what a phone holds comfortably
  const CARD = SIDE * SIDE;
  /* Three spare words is the least that makes two cards differ; below that everybody
     is holding the same nine and the game is a race to hear your own word. */
  const MIN_POOL = CARD + 3;

  const norm = x => String(x == null ? '' : x).trim().toLowerCase();

  /* The lines of a 3x3: three across, three down, two diagonals. Derived rather than
     typed out, so a 4x4 card would need no new list. */
  const LINES = (()=>{
    const out = [];
    for(let r = 0; r < SIDE; r++) out.push(Array.from({length:SIDE}, (_, c) => r*SIDE + c));
    for(let c = 0; c < SIDE; c++) out.push(Array.from({length:SIDE}, (_, r) => r*SIDE + c));
    out.push(Array.from({length:SIDE}, (_, i) => i*SIDE + i));
    out.push(Array.from({length:SIDE}, (_, i) => i*SIDE + (SIDE - 1 - i)));
    return out;
  })();

  const hasLine = marked => LINES.some(line => line.every(i => marked[i]));

  K.round.register('bingo', {
    label: 'Bingo',
    blurb: 'A card of nine words each. Listen for yours; three in a row wins.',
    field: 'bingo',

    /* One way to play it. A "first to a full card" variant is the obvious second and
       is a number rather than a lesson, so it is a setting if anybody wants it. */

    sample: { text:"Bingo — crime and justice",
              bingo:{ calls:[
                { clue:"The decision a jury delivers.",            answer:"verdict" },
                { clue:"Kept in prison while waiting for trial.",  answer:"custody" },
                { clue:"Money paid so you can wait at home.",      answer:"bail" },
                { clue:"What the witnesses give the court.",       answer:"evidence" },
                { clue:"Asking a higher court to look again.",     answer:"appeal" },
                { clue:"What the judge hands down at the end.",    answer:"sentence" },
                { clue:"Saying guilty or not guilty at the start.", answer:"plea" },
                { clue:"The twelve who decide.",                   answer:"jury" },
                { clue:"Formally accused of a crime.",             answer:"charged" },
                { clue:"Found not guilty and released.",           answer:"acquitted" },
                { clue:"Found guilty by a court.",                 answer:"convicted" },
                { clue:"A punishment paid in money.",              answer:"fine" }
              ] } },

    /* **Two comma lists paired by position**, which is the shape every other round's
       editor already has — and the bench's fields are single-line inputs, so a
       one-call-per-line format is silently flattened into one long line. Found by
       the card coming up blank with nothing saying why. `Kit.round.list` is the
       shared parser three other rounds use. */
    editor: {
      labelA:'The words — one per square, comma separated',
      labelB:'The clues, in the same order',
      build: (text, a, b) => {
        const words = K.round.list(a), clues = K.round.list(b);
        return { text, bingo:{ calls: words.map((w, i) => ({ clue: clues[i] || w, answer: w })) } };
      },
      read: it => {
        const calls = (it.bingo || {}).calls || [];
        return { q: it.text || '',
                 a: calls.map(c => c.answer).join(', '),
                 b: calls.map(c => c.clue).join(', ') };
      }
    },

    claims(item){ return !!(item && item.bingo && (item.bingo.calls || []).length); },

    setup(item, ctx){
      const calls = ((item && item.bingo && item.bingo.calls) || [])
                      .filter(c => c && c.clue && c.answer);
      const pool = [];
      calls.forEach(c => { if(pool.indexOf(c.answer) === -1) pool.push(c.answer); });
      if(pool.length < MIN_POOL) return null;
      return {
        text:  String((item && item.text) || 'Listen for your words.'),
        calls: K.round.shuffle(calls.slice()),
        pool,
        at:    0,                    // which call is being read
        answer: '',                  // the answer line, filled as calls are read
        winner: null,                // playerId of whoever lined up first
        winnerTeam: null,
        marks: {},                   // playerId -> how many they have marked, for the card
        /* The bench's shared plumbing reads these off every state whether the round
           uses them or not — Word Drop found that the hard way. */
        chosen: [], picks: {}, need: 1,
        say: '', shown: false, done: false
      };
    },

    /* ---------- the projector's view ----------
       **Not thirty cards.** The board shows the room: the call being read, how many
       people are in, and who is close — which is the only thing a projector can
       usefully add when the card itself is in every hand. */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-bingo';

      const call = s.calls[s.at];

      const clue = document.createElement('div');
      clue.className = 'bg-call';
      if(s.shown || !call){
        clue.textContent = 'All ' + s.calls.length + ' called.';
      }else{
        const n = document.createElement('span');
        n.className = 'bg-num';
        n.textContent = 'Call ' + (s.at + 1) + ' of ' + s.calls.length;
        const t = document.createElement('span');
        t.className = 'bg-clue';
        t.textContent = call.clue;
        clue.appendChild(n); clue.appendChild(t);
      }
      mount.appendChild(clue);

      /* The words already called, so a student who missed one can still find it and a
         teacher can see what is left. Struck through rather than removed: a list that
         shrinks tells you nothing about what has gone. */
      const pool = document.createElement('div');
      pool.className = 'bg-pool';
      s.pool.forEach(w=>{
        const el = document.createElement('span');
        const called = s.calls.slice(0, s.at + (s.shown ? s.calls.length : 0))
                              .some(x => norm(x.answer) === norm(w));
        el.className = 'bg-word' + (called ? ' called' : '');
        el.textContent = w;
        pool.appendChild(el);
      });
      mount.appendChild(pool);

      /* Who is close. One row per player rather than per team, because a card is a
         person's — the one place in this app where that is true — and the interesting
         fact at the back of the room is "somebody needs one more". */
      const roster = (c.roster || []).slice();
      if(roster.length){
        const rows = document.createElement('div');
        rows.className = 'bg-players';
        roster.slice(0, 24).forEach(p=>{
          const got = Number(s.marks[p.id]) || 0;
          const el = document.createElement('div');
          el.className = 'bg-player' + (s.winner === p.id ? ' won' : (got >= 2 ? ' close' : ''));
          el.style.setProperty('--team', K.round.teamColour(p.team));
          const nm = document.createElement('b'); nm.textContent = p.name;
          const ct = document.createElement('span'); ct.textContent = got + '/' + CARD;
          el.appendChild(nm); el.appendChild(ct);
          rows.appendChild(el);
        });
        mount.appendChild(rows);
      }

      K.round.say(mount, s);
    },

    /* ---------- the handsets ----------
       Every phone holds its own card, dealt on the first arm from whoever is in the
       room and re-sent on every call with its marks — which is how a mark reaches a
       handset at all, since a round has no second message to send. A student who
       walks in on call four is dealt a card there and then; they are behind, which is
       the honest state and the same one they would be in on paper. */
    arm(s, ctx){
      const c = ctx || {};
      const call = s.calls[s.at];
      if(!call || s.done || s.shown) return null;    // nothing left to ask
      const keep = c.keep;
      const cards = {};
      (c.roster || []).forEach(p=>{
        if(!p || !p.id) return;
        let card = keep && keep.get(p.id);
        if(!card){
          card = { words: K.round.shuffle(s.pool.slice()).slice(0, CARD),
                   marked: Array.from({length:CARD}, ()=> false) };
          if(keep) keep.set(p.id, card);
        }
        cards[p.id] = card;
        s.marks[p.id] = card.marked.filter(Boolean).length;
      });
      return {
        mode:   'card',
        prompt: c.prompt === false ? '' : call.clue,
        cardsByPlayer: cards,
        /* A tap is not a vote and must not be spent: a student taps once per call,
           and the next call is a fresh question on the same card. */
        keepSpent: false,
        rethink:   true
      };
    },

    /* A tap is judged against *that player's own card*, which is why this does its
       work per reply rather than per team. Marking is not judging — it is what the
       reply did to the student's card — so it happens here, and `judge` answers the
       only team-shaped question there is: has anybody on this team got a line. */
    read(replies, s, ctx){
      const c = ctx || {};
      const keep = c.keep;
      const call = s.calls[s.at];
      const picks = {};
      if(!call || !keep) return picks;
      (replies || []).forEach(r=>{
        if(!r || !r.id) return;
        const card = keep.get(r.id);
        if(!card) return;
        const at = card.words.findIndex((w, i) => !card.marked[i] && norm(w) === norm(r.value));
        /* Tapped a word that is not this call's answer, or not on their card at all:
           nothing happens and nothing is said on the projector. Being wrong in bingo
           is private, which is most of why it is a kind game to play. */
        if(at === -1 || norm(call.answer) !== norm(r.value)) return;
        card.marked[at] = true;
        keep.set(r.id, card);
        s.marks[r.id] = card.marked.filter(Boolean).length;
        if(!s.winner && hasLine(card.marked)){
          s.winner = r.id;
          s.winnerTeam = Number(r.team) || 0;
          s.say = r.name + ' has a line.';
        }
      });
      if(s.winner && s.winnerTeam != null) picks[s.winnerTeam] = ['line'];
      return picks;
    },

    judge(answer, s, team){
      const won = s.winner && Number(s.winnerTeam) === Number(team);
      return won ? { verdict:'right', done:true } : { verdict:'incomplete' };
    },

    /* ---------- the teacher's own controls ----------
       Reading the clue aloud is the teacher's job and so is deciding when the room
       has had long enough, which is why this advances on a button rather than a
       clock. It is also the whole no-relay path: with no phones, the teacher reads
       every call and the round simply never has a winner to declare. */
    actions(s){
      if(s.shown || s.done) return [];
      const last = s.at >= s.calls.length - 1;
      return [{ id:'next', label: last ? 'Last call read' : 'Next call', disabled: last }];
    },

    press(id, s){
      if(id !== 'next' || s.at >= s.calls.length - 1) return false;
      s.at++;
      s.say = '';
      return true;         // the question moved: redraw and re-arm
    },

    /* One word off the current call, which is what a hint is here: the class is
       stuck on what the clue means rather than on where it is. Never the last call,
       because by then the word is the only one left uncalled. */
    hintsLeft(s){
      return (s.shown || s.done) ? 0 : (s.say.indexOf('starts with') === -1 ? 1 : 0);
    },

    hint(s){
      const call = s.calls[s.at];
      if(!call || !this.hintsLeft(s)) return false;
      s.say = 'It starts with "' + String(call.answer).charAt(0).toUpperCase() + '".';
      return 'card';       // the projector changed; leave the handsets alone
    },

    check(item){
      const calls = ((item && item.bingo && item.bingo.calls) || []);
      const bad = [];
      if(!calls.length) return ['Needs a list of calls — a clue and its answer each.'];
      const seen = {};
      calls.forEach(c=>{
        if(!c || !c.clue || !c.answer){ bad.push('Every call needs both a clue and an answer.'); return; }
        if(/\s/.test(String(c.answer).trim()))
          bad.push('“' + c.answer + '” is more than one word — a bingo square holds one.');
        const k = norm(c.answer);
        if(seen[k]) bad.push('“' + c.answer + '” is called twice; one square cannot be marked twice.');
        seen[k] = true;
        /* The one a reader misses: a clue containing its own answer marks itself. */
        if(String(c.clue).toLowerCase().indexOf(k) !== -1)
          bad.push('The clue for “' + c.answer + '” contains the answer.');
      });
      const pool = Object.keys(seen).length;
      if(pool < MIN_POOL)
        bad.push(pool + ' different words is not enough for a card of ' + CARD +
                 ' — ' + MIN_POOL + ' is the least that makes two cards differ.');
      return bad;
    },

    settleMs: 400
  });

})();
