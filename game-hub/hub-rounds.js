/* ================= Question rounds — the shared shelf =================
   A **round** is a question that is *played*, as opposed to a question that is
   merely drawn. `Kit.prompt` (in hub-kit.js) is the drawing contract — `render` and
   `reveal`, no time, no turns, no phones — and six question forms live there. This
   is the tier above it: a question that arms handsets, collects from several
   students at once, and decides for itself when it has been answered.

   The point of it being here rather than inside a game is the one thing the whole
   design turns on: **a round is authored and iterated in the playground, and a game
   show simply calls it by name.** The card the projector shows and the behaviour of
   the phones are the same code in both places, so what you tune on the bench is
   literally what a class meets — not a second implementation that resembles it.

     Kit.round.register('grouping', { setup, render, arm, read, judge });
     const r = Kit.round.get('grouping');

   **Every hook is optional except `setup` and `render`.** A simple round draws a
   card and stops; a complex one fills in the rest. That is the same "declare what
   you need, the rest defaults to nothing" shape the game registry uses, and it is
   what lets one contract cover both a gap fill and Connections.

   | hook | answers |
   |---|---|
   | `setup(item, ctx)`    | the authored item -> the round's own state, or null if it cannot |
   | `render(mount, s, c)` | draw the card into `mount` — the projector's view |
   | `arm(s, c)`           | what the handsets are put into; the payload goes to the relay unread |
   | `read(replies, s, c)` | the room's replies -> one answer per team |
   | `judge(answer, s, t, c)` | is that answer right, how close, and is the round over |
   | `accept(answer, s, t, c)`| commit a correct answer, when being right is not yet the end |
   | `modes`               | the ways this question can be played, if more than one |
   | `settleMs`            | how long to wait after the last tap before judging |

   **What a round never contains: scoring, turns, timers, the board.** Those belong
   to whatever is hosting it — Jeopardy pays a tile, the workbench pays nothing. A
   round that knew about points could not be plugged into two different games, which
   is the whole reason this file exists.

   `ctx` is what the host lends the round: the team list, who is on turn, the team
   colours, and the sizes of each team. It is passed in rather than reached for,
   because the bench has no team bar and the hub does.

   **Every hook takes it, including the three that judge.** `read`, `judge` and
   `accept` were the odd ones out and it showed the moment a round needed to know
   *how many students are on a team* — the ordering round holds a rung until all of
   them agree, and `ctx.sizes` is the only place that number exists. Stashing it in
   the round's own state from `arm()` would have worked and would have been a lie:
   the size is the host's live fact, not something the round was told once. It is
   the last parameter on each, so a round that ignores it is unaffected. */
(function(){
  'use strict';

  const K = window.HubKit;
  if(!K){ console.error('hub-rounds.js needs hub-kit.js loaded first'); return; }

  const ROUNDS = Object.create(null);

  /* ---------- the two helpers every team-based round needs ---------- */

  /* A player's share of an answer that takes several parts. Four words assembled by
     four phones is one each; by two phones it is two each. It is a *share*, not a
     quota — nobody has to hold all of theirs, and a team holding more than the
     whole between them is over and has to talk one of them down. That argument is
     the mechanic, which is why nothing is ever stripped automatically.

     A team with no phones gets the whole thing, which is the right answer for a
     round being driven from one handset or none. */
  function shares(need, sizes){
    return (sizes || []).map(n =>
      Math.max(1, Math.min(need, Math.ceil(need / Math.max(1, Number(n) || 1)))));
  }

  /* What a room of handsets is saying, per team. Two rounds now need the identical
     four facts out of a pile of replies — who said what, what most of a team is
     saying, how many of them agree, and whether that is the whole team — so it lives
     here rather than twice. The second caller is what moved it: written once it was
     ordering's business, written twice it is the bench's.

     What is *not* in here is which words are legal, because that is the round's own
     business and differs completely: ordering rejects a word already on that team's
     ladder, a multiple choice rejects anything that is not one of its four. That is
     `valid(word, team)`.

       const p = Kit.round.poll(replies, { valid, sizes, unanimous:true });
       p.answers   // team -> [word]   the team's *committed* answer; what gets judged
       p.leading   // team -> [word]   what most of them are saying; what the card draws
       p.votes     // team -> { for:{word:n}, said, agreed }
       p.by        // team -> the last name to reply

     **`answers` and `leading` are deliberately not the same map.** With `unanimous`
     set, a team short of agreement has a leading word and no answer — the card shows
     what they are converging on while nothing lands. Collapsing the two is how a
     majority quietly starts winning again.

     **A missing count never freezes a round.** With no relay, or before the host has
     counted anybody, `sizes[t]` is 0 and the leading vote is the answer exactly as it
     would be without the gate. A round that deadlocks on a number it does not have is
     worse than one that never asked for unanimity. */
  function poll(replies, opts){
    const o = opts || {};
    const ok = o.valid || (()=> true);
    const sizes = o.sizes || [];
    const tally = {}, said = {}, by = {};
    (replies || []).forEach(r=>{
      const t = Number(r && r.team) || 0;
      /* The relay preserves the order taps were made in and joins them with `|`, so
         the first legal word is the one meant — a sequence needs nothing more than
         this, which is why no round has ever needed drag-and-drop. */
      const pick = String((r && r.value) == null ? '' : r.value)
                     .split('|').filter(Boolean)
                     .find(w => ok(w, t));
      if(pick == null) return;
      const box = tally[t] || (tally[t] = {});
      box[pick] = (box[pick] || 0) + 1;
      // the relay keys replies by player, so one reply is one person
      said[t] = (said[t] || 0) + 1;
      by[t] = r.name;
    });
    const answers = {}, leading = {}, votes = {};
    Object.keys(tally).forEach(t=>{
      const box  = tally[t];
      const lead = Object.keys(box).sort((a,b)=> box[b] - box[a])[0];
      if(lead == null) return;
      const agreed = box[lead];
      leading[t] = [lead];
      votes[t]   = { for:box, said:said[t] || 0, agreed };
      const size = Number(sizes[t]) || 0;
      if(!o.unanimous || !size || agreed >= size) answers[t] = [lead];
    });
    return { answers, leading, votes, by };
  }

  /* How close a team is to agreeing, or null when there is nobody to count. The size
     is read from the host at draw time rather than from anything the round stored,
     because students join and drop all lesson and a stale count is worse than none —
     it would show a team as one short of a rung it had already earned. */
  function agreement(state, ctx, team){
    const size = Number(((ctx && ctx.sizes) || [])[team]) || 0;
    if(!size) return null;
    const agreed = ((state.votes || {})[team] || {}).agreed || 0;
    return { size, agreed, all: agreed >= size };
  }

  /* Debounce, plus a memory of what has already been ruled on. Both halves are
     needed and each was learned separately: four picks arriving from four phones
     would be judged three times on the way up, and a team sitting on a wrong answer
     would be told off again on every stray reply from anybody in the room.

       const s = Kit.round.settle(700, () => …);
       s.bump();                       // a reply landed
       if(!s.fresh(team, key)) return; // already ruled on this exact answer
       s.reset();                      // the question changed; everything is worth trying again

     `BenchKit.settle` is the same idea one tier down and predates this; the bench
     keeps its own until a page is rewired, because two copies of four lines is a
     smaller problem than a page changing behaviour in a refactor nobody asked for. */
  function settle(ms, fn){
    let timer = null;
    let seen  = Object.create(null);
    return {
      bump(){
        if(timer) clearTimeout(timer);
        timer = setTimeout(()=>{ timer = null; fn(); }, ms);
      },
      fresh(key, value){
        if(seen[key] === value) return false;
        seen[key] = value;
        return true;
      },
      reset(){ if(timer) clearTimeout(timer); timer = null; seen = Object.create(null); },
      stop(){ if(timer) clearTimeout(timer); timer = null; }
    };
  }

  /* ---------- the lane standard ----------
     Every round that builds an answer up draws the same picture: a lane per team,
     on the card from the moment the round opens, blank cells filling as that
     team gets there. This was four hand-written copies (anagram, scramble,
     infogap, grouping) before it was a shelf, and the cost was exactly what
     hand-copies cost: "all teams from the start" was a four-file edit, and the
     agree-gating fix existed in one round for days while another lacked it.

     The round supplies only what a lane contains — `lane(t)` returns
     `{cells:[{text, got, cls, colour}], count, agree:{agreed,size,all}, full}` —
     and this owns everything the standard promises: which teams draw (all of
     them, or only the scoped one), the order, the colour, the name, the agree
     chip, the count. A rule change here reaches every round at once, including
     ones not written yet. */
  function laneTeams(ctx, progressed){
    const c = ctx || {};
    if(c.team === 0 || Number(c.team) > 0) return [Number(c.team)];
    const all = (c.teams || []).map((_, i) => i);
    (progressed || []).map(Number).forEach(t => { if(all.indexOf(t) === -1) all.push(t); });
    return all;
  }

  /* How many of a team must hold a thing for it to light: any member in a race,
     the whole team when they must agree — and a missing roster count falls back
     to "any" rather than freezing the lane, because a number the host does not
     have must never lock a card. */
  function mustHold(mode, ctx, t){
    const size = Number(((ctx && ctx.sizes) || [])[t]) || 0;
    return (mode === 'agree' && size) ? size : 1;
  }

  function lanes(mount, ctx, opts){
    const o = opts || {};
    const teams = laneTeams(ctx, o.progressed);
    if(!teams.length) return null;
    const colour = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';
    const wrap = document.createElement('div');
    wrap.className = 'rlanes' + (o.kind ? ' rlanes-' + o.kind : '');
    teams.sort((a, b) => a - b).forEach(t=>{
      const spec = o.lane ? (o.lane(t) || {}) : {};
      const lane = document.createElement('div');
      lane.className = 'rlane' + (spec.full ? ' full' : '');
      lane.style.setProperty('--lane', colour(t));

      const who = document.createElement('span');
      who.className = 'rl-who' + (spec.agree && spec.agree.all ? ' all' : '');
      who.textContent = (ctx && ctx.teamName) ? ctx.teamName(t) : ('Team ' + (t + 1));
      if(spec.agree){
        const a = document.createElement('small');
        a.textContent = spec.agree.agreed + '/' + spec.agree.size;
        who.appendChild(a);
      }
      lane.appendChild(who);

      const row = document.createElement('span');
      row.className = 'rl-row';
      (spec.cells || []).forEach(cs=>{
        const cell = document.createElement('span');
        cell.className = 'rl-cell ' + (cs.got ? 'got' : 'gap') + (cs.cls ? ' ' + cs.cls : '');
        if(cs.text != null && cs.text !== '') cell.textContent = cs.text;
        if(cs.colour) cell.style.borderColor = colour(t);
        row.appendChild(cell);
      });
      lane.appendChild(row);

      if(spec.count != null){
        const n = document.createElement('span');
        n.className = 'rl-n';
        n.textContent = spec.count;
        lane.appendChild(n);
      }
      wrap.appendChild(lane);
    });
    mount.appendChild(wrap);
    return wrap;
  }

  /* ---------- reading a round whose reply is a sequence ----------
     The drag rounds' shared reader. The wire carries every box in box order,
     empties included — **positional, and kept that way**: compacting slid a word
     placed in box 2 down to box 1 and lit a slot nobody filled, a bug paid for
     once per round until this became one function. Returns, per team: the
     committed answer when the mode's bar is met (`picks`), the furthest attempt
     (`leading`), the vote tally (`votes`), who spoke last (`by`), and how many
     members hold the right thing at each position (`got`) — which is what the
     lanes light from, gated by `mustHold`. */
  function arrangement(replies, o){
    const clean = o.clean || (x => x);
    const norm = x => String(clean(x)).trim().toLowerCase();
    const tally = {}, said = {}, by = {}, best = {}, got = {};
    (replies || []).forEach(r=>{
      const t = Number(r && r.team) || 0;
      const seq = String((r && r.value) == null ? '' : r.value).split('|').map(x => clean(x));
      const placed = seq.filter(Boolean);
      if(!placed.length) return;
      // entries the answer does not contain: a stale reply from a previous question
      if(o.legal && !o.legal(placed)) return;
      said[t] = (said[t] || 0) + 1;
      by[t] = r.name;
      const row = got[t] || (got[t] = []);
      seq.forEach((w, i)=>{
        if(w && norm(w) === norm(o.wordAt(i))) row[i] = (row[i] || 0) + 1;
      });
      if(!best[t] || placed.length > best[t].filter(Boolean).length) best[t] = seq;
      if(placed.length !== o.need) return;
      const box = tally[t] || (tally[t] = {});
      const key = seq.join('|');
      box[key] = (box[key] || 0) + 1;
    });
    const picks = {}, leading = {}, votes = {};
    Object.keys(best).forEach(t => { leading[t] = best[t]; });
    Object.keys(tally).forEach(t=>{
      const box  = tally[t];
      const lead = Object.keys(box).sort((a, b) => box[b] - box[a])[0];
      if(lead == null) return;
      const agreed = box[lead];
      votes[t] = { for:box, said:said[t] || 0, agreed };
      const size = Number((o.sizes || [])[t]) || 0;
      if(o.mode !== 'agree' || !size || agreed >= size) picks[t] = lead.split('|');
    });
    return { picks, leading, votes, by, got };
  }

  /* ---------- how many the teacher may hold at once ----------
     An ordering climb asks for one word at a time — the ladder takes the next rung,
     not the whole scale — so this is the round's own answer and not its `need`. It
     was written identically in the engine (`jRoundCap`) and on the question bench
     (`capOf`), which is what puts it here: the two agreed today and nothing made
     them keep agreeing. */
  function cap(def, state, ctx){
    if(!def || !state) return 1;
    const a = def.arm(state, ctx);
    return Math.max(1, Math.min(state.need || 1, (a && a.multi) || 1));
  }

  /* ---------- the buttons a round wants in the action strip ----------
     **The commit button is the host's and the rest are the round's**, which is the
     whole tier split written as a list. Committing *scores* — it pays a tile, a
     hexagon or a rung — so a round could never own it; what a round owns is
     anything that changes its own question, and until now it could not have any of
     those at all, because `group-btn` is one element and one element is one button.

     So a round declares `actions(state, ctx)` returning what it wants **beside**
     the commit button, and handles a press through `press(id, state, ctx)`. It
     never restates the commit button, which is why a round that declares nothing
     needs no change.

       { actions(s, c){ return [{ id:'show', label:'Show this one' }]; },
         press(id, s, c){ if(id === 'show'){ …; return true; } } }

     (Written as one object literal rather than two bare lines because `shelf.js`
     reads a signature by finding the name at the start of a line, and an example
     laid out like a definition is one it will believe over the real one.)

     The default commit wording lived in two places — the engine and the bench —
     and the bench had grown an `Answered` state the engine had not. One home now;
     a host with its own word for the beat passes `commitText`, which is how
     Millionaire's button reads "Final answer?" without this file learning what
     Millionaire is. */
  function actions(def, state, ctx, opts){
    const o = opts || {};
    if(!def || !state) return [];
    const n = cap(def, state, ctx);
    const held = (state.chosen || []).length;
    const commit = {
      id:'commit', primary:true,
      disabled: !!state.done || held !== n,
      label: o.commitText ? o.commitText(n, held)
           : state.done ? 'Answered'
           : n === 1 ? 'Check it'
           : ('Check these ' + n + ' (' + held + '/' + n + ')')
    };
    const own = (def.actions ? def.actions(state, ctx) : null) || [];
    return [commit].concat(own.filter(a => a && a.id && a.id !== 'commit'));
  }

  /* Draw a round's own buttons into a mount — the commit button is not among them,
     because it is the host's and already lives in the host's own strip. Rebuilt
     rather than reconciled: the list is two or three buttons that change with the
     question, and a stale one is worse than a repaint nobody can see. */
  function strip(mount, list, onPress){
    if(!mount) return null;
    mount.innerHTML = '';
    (list || []).filter(a => a && !a.primary).forEach(a=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'round-action';
      b.dataset.action = a.id;
      b.textContent = a.label == null ? a.id : a.label;
      b.disabled = !!a.disabled;
      if(onPress) b.addEventListener('click', () => onPress(a.id));
      mount.appendChild(b);
    });
    return mount;
  }

  window.HubKit.round = {
    register(id, def){
      ROUNDS[String(id)] = Object.assign({
        settleMs: 700,
        setup(){ return null; },
        render(){},
        arm(){ return null; },
        read(){ return {}; },
        judge(){ return { verdict:'wrong', hits:0 }; },
        /* `t` is which team is being judged, and it is not decoration: a round can
           give each team its own board — the ordering race gives each a ladder — so
           whether an answer is right depends on where *that* team has got to. */
        /* Commit a correct answer to the round's state. Grouping leaves this out —
           being right *is* the ending there — and ordering's climb is the case that
           needed it: a right answer means progress, not the end. So `judge` says
           whether the *round* is over (`done`) and this is where getting there is
           recorded. */
        accept(){},
        /* **Why an authored item is not usable**, as a list of sentences — empty
           means it is fine. `setup` returning null already says *that* something is
           wrong; this says *what*, which is the difference between an editor that
           helps and one that goes blank at you.

           It exists because the rules were about to be written twice: the content
           gate had its own per-round block, and the bench needed the same knowledge
           to tell an author what is missing. Two callers, so it goes on the shelf —
           and a round added next month is checked by both for free, the same way
           `fields()` carries its item field through.

           **The round owns what makes the question invalid; the host owns what makes
           its own bank untidy.** "Needs at least two options" is the round's. "Also
           carries an `a` field" is Jeopardy's, because `a` is Jeopardy's word for an
           answer and no round should ever learn it.

           The default is derived rather than empty, so a round that declares nothing
           still reports the one thing every round knows. */
        check(item){ return this.setup(item, {}) ? [] : ['This question is not complete.']; },
        /* Ways the same question can be played, if it has more than one. A host
           builds its picker from this rather than knowing the round's business —
           the bench puts it in a dropdown, the hub registers it as a setting. */
        modes: null,
        /* **How this round's question is written**, for the workshop's three
           fields: `{labelA, labelB, build(text, a, b, prev), read(item)}`.
           `labelB:null` means two fields rather than three.

           It lives on the round for the same reason `check()` does: the bench
           had a hand-kept table of these, and a round missing its row opened on
           the *previous* type's sample saying "not complete yet" with nothing
           naming the gap — which caught two rounds in a row. It was also a
           second copy of the sample values, and the two had already drifted.
           The starting values are `read(sample)` now, so there is one source.

           A round that declares none gets a generic two-field editor, which is
           enough to see its card and wrong only in its labels. */
        editor: null,
        /* **The buttons this round wants beside the host's commit button**, and
           what a press of one means. Declared rather than hard-wired because the
           strip was a hand-listed skeleton and `group-btn` is a single element —
           so a round could have exactly one button, which is the one thing that
           blocked round designs outright.

           `actions(state, ctx)` returns `[{id, label, disabled}]`; `press(id,
           state, ctx)` does the thing and returns truthy if the card changed, at
           which point the host redraws and re-asks the handsets. Neither may
           score: that is the commit button's, and the commit button is the
           host's. A round that declares neither is exactly as it was. */
        actions: null,
        press(){ return false; }
      }, def || {});

      /* **Every arm says how this question is being played**, in the round's own
         words. A teacher sets *first team wins* on one board and *everyone must
         agree* on another and cannot then remember which is running, and the
         handset — the one screen that is actually in the room's hands — said
         nothing about it at all.

         Stamped here rather than in each round's `arm()` because there are eight
         call sites that build one across the hub and the bench, and a round added
         next month would have to remember. The label is the round's **own** `modes`
         declaration, so there is no second wording to drift: it is the same string
         the ⚙ row and the bench's dropdown show. A round with one way to play says
         nothing, which is correct — there is no choice to report. A round that sets
         its own `note` keeps it.

         `arm()` returning null still means "nothing left to ask" and is passed
         straight back; the relay carries `note` without reading it, as it carries
         everything else it was not told about. */
      const r = ROUNDS[String(id)];
      const armed = r.arm;
      r.arm = function(state, ctx){
        const a = armed.call(this, state, ctx);
        if(!a || a.note != null || !Array.isArray(this.modes) || this.modes.length < 2) return a;
        const want = (ctx && ctx.mode) || this.modes[0].value;
        const hit  = this.modes.filter(m => m.value === want)[0] || this.modes[0];
        if(hit && hit.label) a.note = hit.label;
        return a;
      };
      return r;
    },
    get(id){ return ROUNDS[String(id)] || null; },
    ids(){ return Object.keys(ROUNDS); },
    /* The rounds you can write a question for. `ids()` is every round the engine
       knows, which is what the settings panel wants — it needs a row for the default
       round too. A workshop wants something narrower: the default round wraps an
       ordinary question, so it has no card to draw and no fields to edit, and
       listing it would offer an author a blank page.

       Declared by the round (`internal`) rather than filtered by name here, so the
       next round of its kind needs no change to this file — and two callers, the
       question bench and `dev.html`, which is what makes it a shelf rather than a
       guess at an API. */
    authored(){ return Object.keys(ROUNDS).filter(id => !ROUNDS[id].internal); },
    /* Whatever round an item wants, asked what is wrong with it. `[]` for an item no
       round claims, because that is an ordinary question rather than a broken one. */
    checkItem(item){
      const hit = this.of(item);
      return hit ? (hit.def.check(item) || []) : [];
    },
    /* Every item field any registered round claims. A host copies these across when
       it normalises a question, so **a round added later is carried through without
       anybody remembering to widen a whitelist**. That whitelist has now silently
       dropped a feature twice — `reveal` when Story Reveal shipped, `order` the day
       this was written — and both times the symptom was the feature simply never
       appearing, with nothing anywhere saying why. */
    fields(){ return Object.keys(ROUNDS).map(id => ROUNDS[id].field).filter(Boolean); },
    /* Which round an authored item wants, or null for an ordinary question. Asked
       rather than told, so a game does not have to learn every round's field name —
       the same move `hasBank()` makes for content. */
    of(item){
      if(!item) return null;
      const named = item.round && ROUNDS[item.round];
      if(named) return { id:item.round, def:named };
      for(const id of Object.keys(ROUNDS)){
        if(ROUNDS[id].claims && ROUNDS[id].claims(item)) return { id, def:ROUNDS[id] };
      }
      return null;
    },
    shares, settle, poll, agreement, lanes, mustHold, arrangement, cap, actions, strip,
    /* A comma-separated field as a list. Three rounds' editors parse one, which
       is what puts it here rather than in each of them. */
    list(str){ return String(str == null ? '' : str).split(',').map(w => w.trim()).filter(Boolean); }
  };
})();
