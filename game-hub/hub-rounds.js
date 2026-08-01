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
   | `read(replies, s)`    | the room's replies -> one answer per team |
   | `judge(answer, s, t)` | is that answer right, how close, and is the round over |
   | `accept(answer, s, t)`| commit a correct answer, when being right is not yet the end |
   | `modes`               | the ways this question can be played, if more than one |
   | `settleMs`            | how long to wait after the last tap before judging |

   **What a round never contains: scoring, turns, timers, the board.** Those belong
   to whatever is hosting it — Jeopardy pays a tile, the workbench pays nothing. A
   round that knew about points could not be plugged into two different games, which
   is the whole reason this file exists.

   `ctx` is what the host lends the round: the team list, who is on turn, the team
   colours, and the sizes of each team. It is passed in rather than reached for,
   because the bench has no team bar and the hub does. */
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
        /* Ways the same question can be played, if it has more than one. A host
           builds its picker from this rather than knowing the round's business —
           the bench puts it in a dropdown, the hub registers it as a setting. */
        modes: null
      }, def || {});
      return ROUNDS[String(id)];
    },
    get(id){ return ROUNDS[String(id)] || null; },
    ids(){ return Object.keys(ROUNDS); },
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
    shares, settle
  };
})();
