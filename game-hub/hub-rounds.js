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
        modes: null
      }, def || {});
      return ROUNDS[String(id)];
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
    shares, settle, poll, agreement
  };
})();
