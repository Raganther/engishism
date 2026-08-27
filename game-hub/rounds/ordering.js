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
     left — so each side is told which of the words it has already placed, and marks
     them, rather than being handed a shorter list (`doneByTeam`).

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


  /* Which of a phone's options are finished with, per team — the round's own record
     of each ladder, in the shape the wire wants. Defined out here because two things
     need it and neither may be the other's side effect: `arm` sends it with the
     question, and the host pushes it on its own between arms. */
  function settled(s, ctx){
    const teams = (ctx && ctx.teams) || [];
    return s.mode === 'race'
      ? teams.map((_, i) => (s.lanes[i] || []).slice())
      : teams.map(() => s.placed.slice());
  }

  K.round.register('ordering', {
    label: 'Word Thermometer',
    blurb: 'Words on a scale, weakest to strongest. The room puts them in order.',

    /* Both modes are offered to whatever is hosting, so a host builds its picker
       from this rather than knowing the round's business. The bench puts it in a
       dropdown; the hub registers it as a setting. */
    modes: [
      { value:'climb', label:'One ladder — the whole room fills it together' },
      { value:'race',  label:'A ladder each — teams race to finish theirs first' },
      /* The physics face: the words are Kit.table tiles flicked into a vertical
         ladder of bar slots — order IS position. The first physics mode on an
         existing round; the identity experiment the classroom A/Bs against drag. */
      { value:'stack', label:'Stack — flick the words into order' }
    ],

    /* The item field this round owns. The normaliser copies it across on its own,
       so nobody has to remember to widen a whitelist — see `Kit.round.fields()`. */
    /* Declared, not only described above, so `tools/question-types.js` can print it. */
    sample: { text:"Put these in order — mildest first.",
              order:{ scale:["annoyed","irritated","angry","livid","furious"],
                      low:"mildly bothered", high:"absolutely raging",
                      gloss:{ livid:"so angry you have gone quiet." } } },
    field: 'order',

    editor: {
      labelA:'The scale, weakest first — this is the answer',
      labelB:'The two ends of the scale, separated by |',
      /* `prev` is what the item already was. The editor has three fields and an
         ordering item has four things in it — the glosses have no field, so
         without carrying them forward, loading a category and saving it back
         would silently strip the teaching off every step. A round trip that
         loses data is worse than no round trip. */
      build: (text, a, b, prev) => {
        const ends = String(b || '').split('|').map(x => x.trim());
        const scale = K.round.list(a);
        const was = (prev && prev.order && prev.order.gloss) || {};
        const gloss = {};
        scale.forEach(w => { if(was[w]) gloss[w] = was[w]; });
        return { text, order:{ scale, low:ends[0] || 'weakest',
                               high:ends[1] || 'strongest', gloss } };
      },
      read: it => ({ q:it.text || '', a:((it.order||{}).scale||[]).join(', '),
                     b:((it.order||{}).low || '') + ' | ' + ((it.order||{}).high || '') })
    },

    claims(item){ return !!(item && item.order && Array.isArray(item.order.scale)); },

    setup(item, ctx){
      const o = item && item.order;
      if(!o || !Array.isArray(o.scale) || o.scale.length < 3) return null;
      const scale = o.scale.map(String);
      const mode = (ctx && (ctx.mode === 'race' || ctx.mode === 'stack')) ? ctx.mode : 'climb';
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
        pool:   K.round.shuffle(scale.slice()),
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
        hint:   0,                  // scale positions given away from the cold end, `race` only
        got:    {},                 // team -> per-slot right counts, `stack` only (the arrangement stash)
        cardCells: [],              // the board table's own ladder, `stack` with no phones
        verdict: null,              // the board table's live verdict, `stack` only
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
          who.style.color = K.round.teamColour(team);
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
          /* Who finished, in what order — the shared badge the lane standard
             draws, called by name here because this is the one round with its
             own per-team header. The record is the host's; the round only asks. */
          const badge = K.round.placeBadge(team);
          if(badge) who.appendChild(badge);
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
            /* **The team's colour is on the lane's name, not on its rungs.** A filled
               rung means one thing — the room got this one right — and the green says
               so; painting the same box in the team's colour as well made it read as
               two different signals fighting over one border. Which lane is whose is
               already answered at the top of the lane, once, where a name is. */
            rung.classList.add('filled');
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
            if(guess){
              rung.classList.add('guessing');
              /* **Three things a guess can be, and the room should be able to tell
                 them apart from the back.** The other rounds' lanes already say this
                 with a tone; a ladder had only "there is a word here".

                 `split` — the team has not settled on one word yet. Amber, because
                 being split is not being wrong: it is the argument, which is the
                 part of this round worth having.

                 `miss` — they agree, and it is not the word that comes next. Red.
                 It gives nothing away that the round has not already said out loud
                 in the say line, and it is what lets a team read the board and learn
                 from a rival's dead end rather than only from their own.

                 Neither, and it simply stands as the current proposal. */
              const ag = agreement(s, c, team);
              const want = s.scale[placed.length];
              if(ag && !ag.all) rung.classList.add('split');
              else if(String(guess).toLowerCase() !== String(want || '').toLowerCase())
                rung.classList.add('miss');
            }
          } else {
            rung.classList.add('empty');
          }
          ladder.appendChild(rung);
        }
        if(withCaps) ladder.appendChild(cap(s.low, 'cold'));
        lane.appendChild(ladder);
        return lane;
      };

      /* ---------- STACK: the physics face ----------
         Slot 0 is the TOP of the ladder — the hot end — so slot i holds
         scale[need-1-i]. Decided once, here; read()/judge() use the same map. */
      if(s.mode === 'stack'){
        /* After the reveal the truth is a plain filled ladder — the physics is
           over, and a static picture never argues with the answer line. */
        if(s.revealed || s.done){
          if(s._canvas){ s._table = null; s._canvas = null; }
          mount.appendChild(drawLadder((s.revealed ? s.scale : s.placed).slice(), null, true));
          K.round.say(mount, s);
          return;
        }
        /* Phones present → each handset runs its own table (join.html's table
           mode, a 1-column bar ladder) and the card is the room's picture: a
           ladder per team, a rung filled once that team has the right word in
           that slot. Same standard as toss's lanes, drawn as ladders because
           the ladder IS this round's identity. */
        if(c.roster && c.roster.length){
          if(s._canvas){ s._table = null; s._canvas = null; }
          const teams = ((c.teams) || []).map((_, i) => i);
          mount.appendChild(cap(s.high, 'hot'));
          const lanes = document.createElement('div');
          lanes.className = 'ord-lanes';
          teams.forEach(t => {
            const row = (s.got || {})[t] || [];
            const lane = document.createElement('div');
            lane.className = 'ord-lane';
            const who = document.createElement('div');
            who.className = 'ord-who';
            who.style.color = K.round.teamColour(t);
            const nm = document.createElement('span');
            nm.className = 'ord-name';
            nm.textContent = c.teamName ? c.teamName(t) : ('Team ' + (t + 1));
            who.appendChild(nm);
            const badge = K.round.placeBadge(t);
            if(badge) who.appendChild(badge);
            lane.appendChild(who);
            const ladder = document.createElement('div');
            ladder.className = 'ord-ladder';
            for(let slot = 0; slot < s.need; slot++){     // slot 0 already IS the top
              const rung = document.createElement('div');
              rung.className = 'ord-rung';
              if((row[slot] || 0) >= 1){
                rung.classList.add('filled');
                const w = document.createElement('span');
                w.className = 'ord-word'; w.textContent = s.scale[s.need - 1 - slot];
                rung.appendChild(w);
              } else {
                rung.classList.add('empty');
                rung.innerHTML = '&nbsp;';
              }
              ladder.appendChild(rung);
            }
            lane.appendChild(ladder);
            lanes.appendChild(lane);
          });
          mount.appendChild(lanes);
          mount.appendChild(cap(s.low, 'cold'));
          K.round.say(mount, s);
          return;
        }
        /* No phones → the card is the play surface: Kit.table with a 1-column
           ladder of BAR slots (wide word tiles), toss's board-face wiring
           copied — reuse a live table across the bench's re-renders, shelf
           pointer mapping (the scaled card divides out), self-stopping loop. */
        if(s._table && s._canvas && s._canvas.isConnected){ s._table.resize(); return; }
        mount.appendChild(cap(s.high, 'hot'));
        const canvas = document.createElement('canvas');
        canvas.className = 'toss-canvas';
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = Math.min(430, 170 + s.need * 42) + 'px';
        canvas.style.touchAction = 'none';
        mount.appendChild(canvas);
        mount.appendChild(cap(s.low, 'cold'));
        s._canvas = canvas;
        const table = K.table({
          canvas,
          onArrange(read, full){
            const cells = table.cells();
            s.cardCells = cells.slice();
            if(full){
              const ok = cells.every((w, i) =>
                String(w).toLowerCase() === String(s.scale[s.need - 1 - i]).toLowerCase());
              s.verdict = ok ? 'right' : 'wrong';
              table.setResult(s.verdict);
            } else {
              s.verdict = null;
              table.setResult(null);
            }
          }
        });
        s._table = table;
        /* Slots before pieces: the pile's own spread math (hub-table.js) reads
           the declared slot width, if any, so it spreads a hand of wide word
           tiles across the room they actually need instead of the room five
           square letters need — the reverse order once landed them dropped
           already overlapping. */
        table.slots({ cols: 1, rows: s.need, bar: true, top: 8, labels: s.pool });
        table.setPieces(s.pool);
        const pt = e => table.pt(e);
        canvas.addEventListener('pointerdown', e => {
          const p = pt(e);
          if(table.grab(e.pointerId, p.x, p.y)) canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener('pointermove', e => { if(table.heldBy(e.pointerId)){ const p = pt(e); table.move(e.pointerId, p.x, p.y); } });
        const end = e => { if(table.heldBy(e.pointerId)){ table.drop(e.pointerId); try{ canvas.releasePointerCapture(e.pointerId); }catch(_){} } };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        (function loop(){ if(!canvas.isConnected) return; table.step(); table.draw(); requestAnimationFrame(loop); })();
        requestAnimationFrame(() => { if(canvas.isConnected) table.resize(); });
        table.resize();
        /* a driven test's handle — world.place fires no onArrange, so a probe
           places and then reads state; same kind of window as __bs */
        window.__ordStack = { table, state: s };
        K.round.say(mount, s);
        return;
      }

      if(s.mode === 'race'){
        /* The two ends of the scale are a property of the *question*, not of each
           team, so they are named once above and below the lanes. Repeating them per
           lane put four copies of "the highest praise there is" across the card,
           which is three copies of noise and the height of another rung. */
        const teams = Object.keys(s.lanes).map(Number).sort((a,b)=>a-b);
        /* **Above the lane ceiling a ladder each is a squished grid you cannot read
           the words off**, which is worse than no picture. Same rule as the shared
           lanes — a count, never a mode — and the same replacement: the crowd
           picture, rungs climbed as counts, finishers in order. Each player's own
           ladder is on their handset. */
        if(teams.length > 5){
          /* **One shared reference scale, with what the room collectively knows on
             it.** A ladder fills from the cold end, so the crowd-known rungs are a
             prefix; each shows its word with the hint mark once enough of the room
             has climbed past it. The rules — the threshold, never the last rung —
             are the shelf's. */
          const cw = {
            keys: Array.from({ length: s.need }, (_, i) => i),
            /* Climbed past this rung — or, when the host is counting selections,
               standing on it with the right word chosen. That second half is the
               whole of the "reveal bar follows selections" experiment: nothing about
               *what* is revealed changes, only how soon the room gets there. */
            count: i => teams.filter(t => {
              const lane = s.lanes[t] || [];
              if(lane.length > i) return true;
              if(!c.crowdLive || lane.length !== i) return false;
              const lead = (s.leading || {})[t];
              return !!lead && String(lead[0]).toLowerCase() ===
                               String(s.scale[i] || '').toLowerCase();
            }).length,
            started: teams.filter(t => (s.lanes[t] || []).length || (s.leading || {})[t]).length,
            given: [],
            sig: s.scale.join('|')
          };
          const knownRungs = K.round.crowdKnown(c, cw);
          /* The reference ladder is drawn from the first render, all rungs
             empty — it used to appear only once a reveal had landed, which
             dropped a whole ladder into the card mid-question and shoved
             everything under it. An empty ladder is the picture of what is
             being climbed; the reveals fill it in place. */
          {
            const lane = document.createElement('div');
            lane.className = 'ord-lane';
            const ladder = document.createElement('div');
            ladder.className = 'ord-ladder';
            ladder.appendChild(cap(s.high, 'hot'));
            for(let i = s.need - 1; i >= 0; i--){
              const rung = document.createElement('div');
              rung.className = 'ord-rung';
              if(s.shown || knownRungs.indexOf(i) !== -1){
                rung.classList.add(s.shown ? 'filled' : 'hinted');
                const w = document.createElement('span');
                w.className = 'ord-word'; w.textContent = s.scale[i];
                rung.appendChild(w);
              } else {
                rung.classList.add('empty');
                rung.innerHTML = '&nbsp;';
              }
              ladder.appendChild(rung);
            }
            ladder.appendChild(cap(s.low, 'cold'));
            lane.appendChild(ladder);
            mount.appendChild(lane);
          }
          /* The reveal meter — how close the room is to the next rung lighting
             on the reference ladder, never which team is about to clear it. A
             decided round holds the row hidden (`live`) so the card never moves. */
          cw.live = !s.shown && !s.done;
          K.round.crowdMeter(mount, c, cw);
          K.round.crowd(mount, c, { entries: teams
            .filter(t => (s.lanes[t] || []).length || (s.leading || {})[t])
            .map(t => ({ who: t,
              label: (c.teamName ? c.teamName(t) : ('Team ' + (t + 1))) +
                     ' ' + (s.lanes[t] || []).length + '/' + s.need })) });
        } else {
          mount.appendChild(cap(s.high, 'hot'));
          const lanes = document.createElement('div');
          lanes.className = 'ord-lanes';
          teams.forEach(t=>{
            lanes.appendChild(drawLadder(s.lanes[t], t, false));
          });
          mount.appendChild(lanes);
          mount.appendChild(cap(s.low, 'cold'));
        }
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
          const at = s.chosen.indexOf(w);
          /* A word whose place on the scale has been given away carries its number.
             Only ever set in a race — a climb's hint places the word, so it leaves
             the pool rather than being labelled in it. */
          const pos = s.scale.indexOf(w);
          const hinted = pos !== -1 && (s.hint || 0) > pos;
          /* **The number's column is always there, empty or not.** Putting the digit
             inside the word's own text made the chip wider the moment it got one, so
             the pool re-flowed and the card changed height — on a hint, and equally
             on the teacher's own click, which had been doing it since this round was
             written. A fixed gutter costs one character of width and nothing moves. */
          const num = document.createElement('span');
          num.className = 'gw-num';
          num.textContent = at !== -1 ? (at + 1) + '.' : hinted ? (pos + 1) + '.' : '';
          b.appendChild(num);
          const t = document.createElement('span');
          t.className = 'gw-text';
          t.textContent = w;
          b.appendChild(t);
          if(at !== -1) b.classList.add('chosen');
          if(hinted) b.classList.add('hinted');
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
                d.style.background = K.round.teamColour(Number(t2));
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
            chip.style.borderColor = K.round.teamColour(t);
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

      /* Always drawn, empty or not — see `Kit.round.say`. An appearing line was
         what made the card jump on the first hint. */
      K.round.say(mount, s);
    },

    /* One of the two rounds with more to do than the default: the answer here *is*
       the ladder, so every rung fills in. `finish` first, then the extra. */
    reveal(mount, s, ctx){
      K.round.finish(s);
      /* **A race keeps every team's own ladder; only a climb fills itself in.**
         Filling the lanes with the right answer wiped the one thing worth looking at
         when a round ends — how far each team actually got. Four identical ladders
         say nothing about a race that was won by one rung. A lane can only ever hold
         correct placements (`accept` pushes on a right answer and nothing else), so
         what is left standing is a true picture, and the answer itself is on the
         card's own answer line where it always was.

         A climb is the opposite case: there is one ladder, it *is* the answer, and
         filling it is the reveal. */
      if(s.mode === 'stack'){ s.revealed = true; s._table = null; s._canvas = null; }
      else if(s.mode !== 'race') s.placed = s.scale.slice();
      /* What the room was part-way to agreeing stops being news once the answer is
         out — and in a race it would leave a guess sitting above a finished lane. */
      s.picks = {}; s.leading = {}; s.votes = {};
      this.render(mount, s, ctx);
      return 0;
    },

    /* ---------- the hint ----------
       **A class that cannot separate *livid* from *furious* learns more from being
       shown than from four wrong guesses.** The bench thermometer has had this
       since it was written, and this round had it first in the hub as a button of
       its own — it is the hint now, which is the same thing under the name every
       other round uses for it, so a teacher meets one affordance rather than five.

       One rung, from the cold end, with its gloss. **The gloss is the whole point**:
       a word shown without one is a spoiler rather than a lesson.

       Only on a shared ladder. In a race each team has its own, so a shown word
       would go either to one team or to all of them, and neither is a lesson —
       `null` rather than `0`, which is how the strip knows to offer no button at
       all instead of a disabled one. */
    hintsLeft(s){
      /* Never the last one: with one step left there is exactly one word left, so
         showing it teaches nothing — and on a shared ladder it would end the round
         with nobody having answered, which is a question about scoring and therefore
         not this round's to answer. */
      return s.mode === 'climb'
        ? Math.max(0, s.need - s.placed.length - 1)
        : Math.max(0, s.need - (s.hint || 0) - 1);
    },

    hint(s){
      if(!this.hintsLeft(s)) return false;
      const gloss = w => (s.gloss && s.gloss[w] ? ' — ' + s.gloss[w] : '');
      if(s.mode === 'climb'){
        const word = s.scale[s.placed.length];
        if(!word) return false;
        s.placed.push(word);
        s.picks = {}; s.leading = {}; s.votes = {};
        /* No gloss here: the rung it just landed in prints it, and printing it twice
           costs a second line on a card that is already the tallest of the five. */
        s.say = 'Shown: ' + word + '.'; s.sayTeam = null;
        /* The one hint that genuinely moves the question: a rung has landed, so the
           remaining words are different and every handset has to be asked again. */
        return true;
      }
      /* **A race gets a hint about the *scale*, not about anybody's ladder.** The
         first version offered none here, on the reasoning that placing a word would
         give it either to one team or to all of them — true, and the answer is not
         to place it. Naming which word sits at a given position on the scale is one
         fact about the question, identical for every team, and each still has to
         drag it onto their own ladder. So the pool marks it with its number and the
         card prints its gloss, which is the teaching either way.

         Counted from the cold end because that is the end the scale is read from,
         and it is a property of the question rather than of any team's progress —
         which is exactly what makes it fair to give to four lanes at once. */
      const n = s.hint || 0;
      const word = s.scale[n];
      if(!word) return false;
      s.hint = n + 1;
      s.say = 'Hint: number ' + s.hint + ' on the scale is ' + word + gloss(word); s.sayTeam = null;
      /* `'card'` — the projector changed and the handsets did not, so the host must
         **not** re-arm. An arm resets every phone and clears the replies the relay
         is holding, which on a hint means throwing away what the room has already
         dragged or typed for the sake of a letter on a wall. */
      return 'card';
    },

    /* ---------- the handsets ----------
       `climb` is one tap: which word comes next. `whole` is the whole order, tapped
       in sequence — the relay preserves the order taps were made in, so a sequence
       needs nothing the phones do not already do. */
    arm(s, ctx){
      const c = ctx || {};
      /* stack → each handset runs its own physics ladder (join.html's table
         mode). cols/rows/bar shape the slots into the 1-column bar ladder;
         join.html threads them straight into Kit.table. The wire back is the
         |-joined cells the drag rounds use — nothing new for the relay. */
      if(s.mode === 'stack'){
        return {
          mode: 'table',
          prompt: s.text || 'Flick the words into order — strongest at the top',
          options: s.pool.slice(),
          cols: 1, rows: s.need, bar: true,
          multi: s.need, holds: true, rethink: true,
          team: (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
        };
      }
      const label = s.mode === 'race'
        ? 'Which comes next on your ladder?'
        : ('Which comes next? (' + (s.placed.length + 1) + ' of ' + s.need + ')');
      const arm = {
        mode:    'vote',
        /* the question line the handset shows — built here since this round
           was written and never sent until the stack mode found the gap */
        prompt:  label,
        /* **Every word, always, in the one order the pool was shuffled into.**
           It used to send only what that side had left, which read as the answer
           being *taken away*: a class of sixteen found that the box under a thumb
           moved every time anybody placed anything, and a reconnecting phone came
           back with a shorter list and no record of its own ladder. What is placed
           is said by `doneByTeam` instead, so the list never moves and a settled
           word is marked rather than removed. */
        options: s.pool.slice(),
        multi:   1,
        /* No per-team share: an order cannot be assembled from pieces the way a set
           can, so splitting it across handsets would produce fragments nothing can
           merge. One tap each, and the team argues out loud. */
        multiByTeam: null,
        holds:   true,
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
      arm.doneByTeam = settled(s, ctx);
      return arm;
    },

    /* **Which of a phone's options are finished with, per team.** A race and a climb
       differ in whose ladder is whose, not in what is on offer: in a race each side
       has placed different words, so what is settled is per team; in a climb there is
       one ladder and everybody has settled the same words. Either way the phone is
       told which of its own options are done and marks them, rather than being handed
       a shorter list that moves every box below it.

       Its own hook rather than something read back off `arm()`, because the host
       pushes this between arms and calling a round's `arm` for its side effects is
       how a bingo hand would get re-dealt to read one field. One definition either
       way — `arm` calls it too. */
    done: settled,

    /* **Does a right answer change what the phones are being asked?** The host
       re-asks the room after a partial right answer, and an arm wipes every handset
       — the selection in every hand, and any reply still in flight. That is correct
       for a climb, where one shared ladder really has moved on for everybody. It is
       badly wrong for a race: sixteen people each climbing their own ladder means
       somebody is right every second or two, and each of those was throwing away
       fifteen other people's half-made answers. Reported as answers that simply did
       not register, and it got worse the fuller the room.

       Nothing room-wide changes in a race now — the options are the whole pool and
       what a player has settled is told to that player alone — so there is nothing
       left for a re-ask to say. */
    reasks(s){ return s.mode !== 'race'; },

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
      if(s.mode === 'stack'){
        if(replies && replies.length){
          const p = K.round.arrangement(replies, {
            need:   s.need,
            clean:  x => String(x).trim(),
            wordAt: i => s.scale[s.need - 1 - i],     // slot 0 = the hot end (top)
            legal:  placed => placed.every(w => s.pool.indexOf(w) !== -1) &&
                              new Set(placed).size === placed.length,
            sizes:  (ctx && ctx.sizes) || [],
            mode:   s.mode
          });
          s.leading = p.leading; s.votes = p.votes; s.by = p.by; s.got = p.got;
          return p.picks;
        }
        return { 0: (s.cardCells || []).slice() };
      }
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
      if(s.mode === 'stack'){
        const seq = (answer || []).map(x => String(x).toLowerCase());
        if(seq.length !== s.need || seq.some(x => !x)) return { verdict:'incomplete', hits:0 };
        const hits = seq.reduce((n, w, i) =>
          n + (w === String(s.scale[s.need - 1 - i]).toLowerCase() ? 1 : 0), 0);
        return { verdict: hits === s.need ? 'right' : 'wrong', hits, done: hits === s.need };
      }
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
    accept(answer, s, team, ctx){
      if(s.mode === 'stack'){
        /* The whole ladder landed at once. `done` ends the QUESTION (the host's
           meaning of the word), so it follows the host's open-question rule
           exactly as race does: `won` records first to finish, never
           overwritten, and the room stays open when the host says so. */
        if(s.won == null && team != null) s.won = team;
        if(!(ctx && ctx.openToAll)) s.done = true;
        return;
      }
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
        /* **One team finishing its ladder is not the round finishing.** `done` is read
           by the host as "this question is over" — it is the same field on the same
           object — so setting it here froze the card the moment the first team filled
           their lane: replies stopped being read and every other team was locked out
           of completing a ladder they were half way up. That is precisely the lockout
           the open question exists to remove, written one tier down.

           `won` is still the first to get there, and never overwritten: that is who
           takes the slot. What changes is only whether the rest of the room is allowed
           to carry on, which is the host's rule and is lent through `ctx`. */
        if(lane.length >= s.need){
          if(s.won == null) s.won = team;
          if(!(ctx && ctx.openToAll)) s.done = true;
        }
        return;
      }
      s.placed.push(word);
      s.picks = {}; s.leading = {}; s.votes = {};
      if(s.placed.length >= s.need) s.done = true;
    },

    check(item){
      const o = (item && item.order) || {};
      if(!Array.isArray(o.scale)) return ['Needs a scale — the words in order, weakest first.'];
      const scale = o.scale.map(w => String(w).trim()).filter(Boolean);
      const bad = [];
      if(scale.length < 3) bad.push('A scale needs at least 3 steps.');
      if(scale.length > 20) bad.push(scale.length + ' steps, over the relay’s cap of 20 — the phones would be offered fewer words than the board shows.');
      const seen = Object.create(null);
      scale.forEach(w => {
        const k = w.toLowerCase();
        if(seen[k]) bad.push('Step appears twice: “' + w + '”.');
        seen[k] = true;
      });
      /* Both ends named, or the ladder is a list of words with no direction — which
         is the one thing that makes it an ordering question rather than a set. */
      if(!o.low || !o.high) bad.push('Needs both ends of the scale named.');
      /* The gloss is the teaching. Without one a right answer is a sorting exercise:
         the class gets it right and learns nothing about why. */
      scale.forEach(w => {
        if(!o.gloss || !o.gloss[w]) bad.push('No gloss for “' + w + '” — a step with no gloss teaches nothing.');
      });
      if(!String((item && item.text) || '').trim()) bad.push('Needs a question.');
      return bad;
    },

    saidOf(who, r, s){
      if(s.mode === 'stack'){
        if(!r || r.verdict === 'incomplete') return who + ': ladder not full yet.';
        return who + ': not it — ' + (r.hits || 0) + ' of ' + s.need + ' rungs are right.';
      }
      return who + ': not that one yet.';
    },

    settleMs: 700
  });

  // on the shelf, because the multiple choice card counts the same way
  const agreement = (s, c, team) => K.round.agreement(s, c, team);

})();
