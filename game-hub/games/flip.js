/* ================= Flip — the comeback board =================

   **Built for one reported failure: a student went out in front and nobody could
   catch him, and the rest of the class stopped trying.** That is not a scoring bug.
   It is what happens when a board's drama *decays* — points are permanent, the tiles
   left get fewer, and winning a question hands you the next pick — so the outcome is
   settled long before the lesson is. The thing a class runs out of is not points, it
   is the ability to imagine winning.

   So the rule this whole skin is written to: **at every moment, every player must be
   able to point at how they could still win.** Three mechanics, and nothing else here
   matters as much:

   1. **The twist is on the back of the card, and the twists are dealt toward the end
      of the board.** Volatility GROWS as the game goes on instead of shrinking. The
      last row is where the reversals live, which is exactly where Jeopardy has none.
   2. **A steal closes a share of the GAP, never a fixed number.** Two thousand behind
      and you take a big bite; a hundred behind and you take a nibble. The size of the
      correction is set by the size of the problem, with nothing to tune per class.
      **Only ever upward** — you take from somebody ahead of you, never from somebody
      behind — which removes the pile-on-the-weakest failure by construction and makes
      the leader the one competitor who cannot steal at all.
   3. **Last place picks the next card.** Being behind hands you the board. Position,
      not performance, so it cannot be farmed by tanking.

   **Why a target is never chosen by a class vote.** "Everyone vote for who loses
   points" is a popularity contest with a scoreboard attached, and the student it
   lands on knows exactly what happened. Steals and swaps are chosen by the player who
   won the card and constrained to competitors above them, so the choice reads as
   tactics rather than as a judgement about a person. The one place the room does vote
   is **Gift**, where the vote decides who *receives* — the generous direction, on
   purpose.

   **It authors no content.** A card board has no categories to fill, so this flattens
   whatever `jeopardyCategories` the unit already carries into one pool and deals from
   it. Every unit in the project gains the game for free, and every round type in it
   plays unchanged — which is the round tier paying out: the board is new, the
   questions are not.

   What is genuinely this skin's: the grid, which card is worth what, who picks next,
   and the five twists. Everything else — the card, the phones, the judging, the pay
   rule — is borrowed. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  /* Resolved at call time: the engine loads after this file, so `HubEnv` does not
     exist at parse. */
  const E = () => window.HubEnv;

  let POOL = [], TOPIC_NAMES = {}, SECTION_NAMES = {};
  let cards = [];              // the dealt board: {n, item, twist, used}
  let cur = null;              // the card on the clue card right now
  let pending = null;          // {team, twist} — a twist waiting for the beat after the question
  let holding = null;          // the twist whose target is being chosen right now
  let awaitingStandings = false;
  let giftVoting = false;
  let over = false;
  let picker = null;           // the shared team chooser, on this board's own mount

  const size   = () => Number(S.get('flipSize',   'flip')) || 25;
  const base   = () => Number(S.get('flipPoints', 'flip')) || 100;
  const share  = () => Number(S.get('flipSteal',  'flip')) || 0.34;
  const twistPct = () => Number(S.get('flipTwists', 'flip'));
  const wantSwap = () => !!S.get('flipSwap', 'flip');
  const lastPicks = () => !!S.get('flipLastPicks', 'flip');

  /* ---- the five faces of a card ----
     `target` is the only thing the board has to branch on: a twist that needs somebody
     chosen stops the game for one beat and asks. Everything else is arithmetic. */
  const TW = {
    plain:  { label:'', topline:'',        target:null,
              note:'' },
    double: { label:'DOUBLE', topline:'DOUBLE', target:null,
              note:'This card is worth double.' },
    steal:  { label:'STEAL',  topline:'STEAL',  target:'above',
              note:'Win it and take a bite out of somebody ahead of you.' },
    gift:   { label:'GIFT',   topline:'GIFT',   target:'below',
              note:'Win it and the class votes who else gets the same points.' },
    swap:   { label:'SWAP',   topline:'SWAP',   target:'above',
              note:'Win it and trade scores with anyone ahead of you.' }
  };

  const HOST = {
    game:'flip', stage:'play-flip',
    mount: () => E().cardMount(), onCard: true, commit:'group-btn',
    live: () => E().modalMode() === 'flip',
    turn: () => E().activeTeam(),
    /* Every card pays the same base; what a Double changes is the base, so the pay
       rule underneath (everyone-scores by default) doubles for everybody who finished
       rather than only for the winner. The twist is the card's, not one player's. */
    worth: () => cardWorth(),
    step:  () => 10,
    win:   team => flipWin(team),
    /* The four on a Connections card are a team's answer, so a hosted round waits for
       the whole team rather than paying the fastest thumb. Degrades correctly in a
       room of individuals, where a team of one agrees with itself. */
    teamMode: true
  };

  function cardWorth(){
    return base() * (cur && cur.twist === 'double' ? 2 : 1);
  }

  let wired = false;
  function wire(){
    if(wired) return;
    wired = true;
    /* The stage exists only after the engine injects it, so the chooser is built on
       the first `load` rather than at parse. */
    picker = K.claimTeam({
      mount: document.getElementById('flip-pick-row'),
      onPick: i => applyTwist(i)
    });
    document.getElementById('flip-skip').addEventListener('click', ()=>{
      /* Declining is allowed and has to be: a steal with one obvious target is not a
         decision, and a teacher who wants the game to move on should not have to
         invent one. */
      pending = null; hidePicker(); advance();
    });
  }

  window.HubGames.register({
    id:'flip', title:'Flip',
    order: 55,                     // after the five built-ins, before the Quickfire card
    /* Nothing here draws a per-competitor picture, so a room of individuals works
       exactly as a room of teams does — and the catch-up mechanics matter MORE with
       sixteen people than with three. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="14" height="18" rx="2.5"/><rect x="21" y="12" width="14" height="18" rx="2.5"/><path d="M25 20 L31 20"/><path d="M28 17 L28 23"/></svg>',
      blurb:'A grid of face-down cards. Every card is a question; some are a reversal. Steals close the gap, so nobody runs away with it.',
      badge:'Best for: a class where one student always wins' },
    intro:{ eyebrow:'Huddle', title:'FLIP',
            sub:'Nobody is safe and nobody is out of it.', accent:'#E86FA0' },
    /* Consumed, never authored: the smallest board is nine cards, so a unit with a
       Jeopardy bank at all can play this. */
    hasBank: u => flatten(u).length >= 9,
    fitsScreen: true,
    roundHost: HOST,
    payStep: 10,
    nudgeStep: 10,
    stageHTML: `
      <!-- Flip. A square grid of face-down cards over a strip that says whose pick it
           is, and — for the one beat after a steal, swap or gift — a row of chips
           naming who can be targeted. The question itself is on the shared clue card,
           so there is no question markup here at all. -->
      <div id="play-flip"><div id="flip-wrap">
        <div id="flip-bar">
          <div id="flip-turn"></div>
          <div id="flip-left"></div>
        </div>
        <div id="flip-grid"></div>
        <div id="flip-pick">
          <div id="flip-pick-say"></div>
          <div id="flip-pick-row"></div>
          <div id="flip-pick-tally"></div>
          <button id="flip-skip" type="button">Skip it</button>
        </div>
      </div></div>`,

    load(u){ wire();
             POOL          = flatten(u);
             TOPIC_NAMES   = topicNamesOf(u);
             SECTION_NAMES = u.jeopardySectionLabels || {}; },
    bank: () => POOL,
    renderContent: renderFlipContent,
    startButton:   flipStartButton,
    start(){ startFlip(); },
    fit:      fitFlip,
    onResize: fitFlip,
    onRoster(){ paintBar(); fitFlip(); },
    tension(){ flipTension(); },

    /* ---- the phone contract. The round IS the phone dynamic, exactly as on the two
       other card boards; a plain clue falls through to the ordinary round. ---- */
    expects:     () => (E().clueItem() && E().clueItem().answer) || '',
    phonePrompt: () => (E().clueItem() && E().clueItem().text) || '',
    askingNow:   () => E().clueIsOpen(),
    buzzEntitled: () => !E().roundLive(),
    /* True while a question is open OR while the room is voting on a gift — the chip
       has to keep the room open across both, and the vote happens after the round has
       already stood the handsets down. */
    wantsVote:   () => E().roundLive() || giftVoting,
    roomNote:    () => giftVoting ? 'vote who gets it' : null,
    onVoteReply(all){
      /* Two things can be asking the room, never at once: the question's own round
         while the card is open, and the gift vote after it has closed. */
      if(E().roundLive()){ E().roundOnReplies(all); return; }
      if(giftVoting) paintGiftVote(all);
    },
    phoneRound(){ return E().roundForPhones(); },
    onTypedWin: () => null,

    /* ---- the clue card's buttons ----
       A round judges and pays itself through `win`. A plain clue is scored by hand,
       which is the Jeopardy pattern: Correct and Wrong appear on Reveal. */
    onClueReveal(){
      if(E().roundLive()) return;             // the round's own reveal already ran
      document.getElementById('correct-btn').style.display = 'inline-block';
      document.getElementById('wrong-btn').style.display   = 'inline-block';
    },
    /* A revealed round still needs awarding by hand when nobody got there — the same
       seam Blockbusters uses. */
    onRoundReveal(){
      document.getElementById('correct-btn').style.display = 'inline-block';
      document.getElementById('wrong-btn').style.display   = 'inline-block';
    },
    onClueCorrect(){ handScore(E().activeTeam(), false); },
    onClueWrong(){   handScore(null, true); },
    /* Closing an unanswered card is not a wrong answer — nobody's run breaks for a
       question the room never got to. */
    onClueClose(){   handScore(null, false); },
    /* **The twist runs here, not on the card.** The engine shows the standings from
       inside its own pay path, so a reversal applied during `win` would happen behind
       that screen and the room would never see it. After it is dismissed the board is
       back in front of the class with every score on it, which is the right moment for
       "and now you take 400 off the leader". */
    onStandingsDone(){ if(awaitingStandings){ awaitingStandings = false; runPending(); } }
  });

  /* ---------- content: flattened, never authored ----------
     A Jeopardy clue lives inside a category and carries neither the section nor the
     category on itself, so both are stamped on as the pool is built — `topic` is what
     `groupOf` reads, which is what makes the shared content screen and the round-type
     chips work here with nothing added. The clue objects are copied rather than
     mutated: the same unit object is what Jeopardy plays from. */
  function flatten(u){
    const out = [];
    (u.jeopardyCategories || []).forEach(cat => {
      (cat.clues || []).forEach(clue => {
        /* `catName` is carried for the card's second line. `section` is a filing code
           ("AD") and was reaching the projector as one; the column's human name is
           what a room can actually use — the same context a Jeopardy category header
           gives, on a board that has no headers. */
        out.push(Object.assign({}, clue, { topic: cat.id, section: cat.section, catName: cat.name }));
      });
    });
    return out;
  }
  function topicNamesOf(u){
    const names = {};
    (u.jeopardyCategories || []).forEach(cat => { names[cat.id] = cat.name; });
    return names;
  }

  function renderFlipContent(list, help){
    help.textContent = 'Pick which sets of questions to shuffle into the board. The cards are dealt face down, so nobody knows which one carries a reversal.';
    E().groupCheckboxes(list, POOL, TOPIC_NAMES, SECTION_NAMES);
  }
  const chosen = () => POOL.filter(E().inPlay);
  function flipStartButton(btn){
    const n = chosen().length, want = size();
    btn.disabled = n < 9;
    btn.textContent = n < 9
      ? 'Pick at least nine questions (' + n + ' so far)'
      : (n < want ? 'Deal ' + fitBoard(n) + ' cards — that is all the questions picked'
                  : 'Deal ' + want + ' cards');
  }
  /* The board is square, so a short pool steps down a whole size rather than leaving
     holes in the grid — an absent cell is a cell a teacher will click. */
  function fitBoard(n){
    return n >= 25 ? 25 : n >= 16 ? 16 : 9;
  }

  /* ---------- the deal ----------
     **Where a twist lands is the whole design, so it is weighted rather than random.**
     A card's chance of carrying one rises with its row, so the first row is almost
     always plain points and the last row is where the game turns over. The Swap, when
     it is in, is forced into the final row: it is the biggest reversal on the board
     and it is worth nothing to the design if it comes out third. */
  function startFlip(){
    const pool = E().shuffle(chosen().slice());
    const n    = Math.min(fitBoard(pool.length), size());
    const cols = Math.round(Math.sqrt(n));
    cards = pool.slice(0, n).map((item, i) => ({ n:i + 1, item, twist:'plain', used:false, row: Math.floor(i / cols) }));
    dealTwists(cards, cols);
    cur = null; pending = null; awaitingStandings = false; over = false; giftVoting = false;
    hidePicker();
    passToLast();
    renderGrid(cols);
    paintBar();
    fitFlip();
    flipTension();
  }

  function dealTwists(list, cols){
    const want = Math.round(list.length * (twistPct() / 100));
    if(!want) return;
    const rows = Math.ceil(list.length / cols);
    /* Weighted sampling without replacement: a card in the last row is `rows`× as
       likely as one in the first, squared so the tail really is the tail. */
    const bag = list.map((c, i) => ({ i, w: Math.pow(c.row + 1, 2) }));
    const slots = [];
    while(slots.length < want && bag.length){
      const total = bag.reduce((a, b) => a + b.w, 0);
      let r = Math.random() * total, hit = 0;
      for(; hit < bag.length; hit++){ r -= bag[hit].w; if(r <= 0) break; }
      slots.push(bag.splice(Math.min(hit, bag.length - 1), 1)[0].i);
    }
    /* The order the kinds are handed out in matters on a small board: Steal is the
       mechanic the game exists for, so it is dealt first and most. */
    const kinds = [];
    if(wantSwap()) kinds.push('swap');
    kinds.push('gift');
    while(kinds.length < want) kinds.push(kinds.length % 2 ? 'double' : 'steal');
    kinds.length = want;

    /* Swap into the deepest slot there is, so the biggest reversal cannot come out
       early. Everything else takes the slots as they were sampled. */
    if(kinds[0] === 'swap' && slots.length){
      const deepest = slots.reduce((a, b) => (list[b].row >= list[a].row ? b : a), slots[0]);
      const at = slots.indexOf(deepest);
      slots.splice(at, 1); slots.unshift(deepest);
      if(rows > 1 && list[deepest].row === 0) kinds[0] = 'steal';   // nowhere deep to put it
    }
    slots.forEach((idx, k) => { list[idx].twist = kinds[k] || 'steal'; });
  }

  function renderGrid(cols){
    const grid = document.getElementById('flip-grid');
    grid.innerHTML = '';
    grid.style.setProperty('--fcols', cols);
    cards.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'flip-card';
      b.dataset.n = c.n;
      /* Face down means face down: nothing about the twist is in the DOM until the
         card is played, because a class with the inspector open is a class that knows
         where the Swap is. The hue is by position so the grid reads as a board rather
         than as a spreadsheet, and says nothing about what is behind it. */
      b.style.setProperty('--fhue', (K.table && K.table.hues ? K.table.hues : ['#00A0DF'])[(c.n - 1) % 7]);
      b.textContent = String(c.n);
      b.addEventListener('click', ()=> openCard(c, b));
      c.el = b;
      grid.appendChild(b);
    });
    /* The same diagonal sweep the other boards deal on — row+column, so the wave
       crosses the grid rather than queueing down the DOM. */
    E().dealStagger('play-flip', grid, g => {
      [...g.children].forEach((el, i) =>
        el.style.setProperty('--i', Math.floor(i / cols) + (i % cols)));
    }, 1400);
  }

  /* ---------- playing a card ---------- */
  function openCard(card, el){
    if(over || card.used || picking()) return;
    if(E().clueIsOpen()) return;
    cur = card;
    E().setClueValue(cardWorth());
    const tw = TW[card.twist];
    /* **The twist is revealed as the card opens, not after it is won.** Knowing the
       stakes before the question is what makes the room lean in — the leader knows
       they have to win this one, and everybody else knows it is their chance. Told
       afterwards it would be a lottery result rather than a reason to try. */
    const topline = (tw.topline ? tw.topline + '  ·  ' : '') + 'Card ' + card.n;
    E().openRoundOnCard({
      game:'flip', mode:'flip', origin: el,
      item:{ text: card.item.q || card.item.text || '', answer: card.item.a, type: card.item.type },
      source: card.item,
      topline,
      /* The twist's own line under the topline, and the column's name when there is no
         twist to announce. Never the raw section code. */
      section: tw.note || card.item.catName || '',
      buttons:{ reveal:true, close:true }
    });
  }

  /* What a round pays. The base is `worth()` and the rule underneath decides the
     split; what this adds is the twist, which is held over to the beat after the
     standings so the room actually sees it happen. */
  function flipWin(team){
    const paid = E().award(team, cardWorth(), { why:'flip · card ' + (cur ? cur.n : '?') });
    E().markRun(team, true);
    useCard();
    pending = (cur && TW[cur.twist].target) ? { team, twist: cur.twist } : null;
    awaitingStandings = E().standingsWanted('flip');
    E().closeModal(E().flipHoldMs(), ()=>{
      /* With the standings off there is no later beat to wait for, so the twist runs
         as the card leaves. */
      if(!awaitingStandings) runPending();
    });
    return paid;
  }

  /* A plain clue scored by hand, or a card nobody took. `team` null means nobody. */
  function handScore(team, missed){
    if(!E().clueIsOpen()) return;
    if(team != null && E().teams()[team]){
      E().award(team, cardWorth(), { why:'flip · card ' + (cur ? cur.n : '?') });
      E().markRun(team, true);
      pending = (cur && TW[cur.twist].target) ? { team, twist: cur.twist } : null;
    } else {
      if(missed) E().markRun(E().activeTeam(), false);
      pending = null;
    }
    useCard();
    awaitingStandings = false;
    E().closeModal(E().flipHoldMs(), runPending);
  }

  function useCard(){
    if(!cur) return;
    cur.used = true;
    if(cur.el){ cur.el.classList.add('used'); cur.el.disabled = true;
                cur.el.textContent = TW[cur.twist].label || String(cur.n); }
  }

  /* ---------- the twist, on the board, after the question ---------- */
  function runPending(){
    const p = pending;
    pending = null;
    if(!p || over){ advance(); return; }
    const targets = targetsFor(p.team, TW[p.twist].target);
    if(!targets.length){
      /* Nothing to do and it must SAY so: a Steal won by the player already in front
         is the leader discovering that the one card they wanted is the one card they
         cannot use, which is the mechanic working rather than a bug. */
      flash(TW[p.twist].label + ' — ' + (TW[p.twist].target === 'above'
              ? 'nobody is ahead of ' + E().teamName(p.team) + '. Nothing to take.'
              : 'nobody is behind ' + E().teamName(p.team) + '.'));
      advance();
      return;
    }
    holding = p;
    showPicker(p, targets);
  }
  /* Who a twist may be aimed at. **Upward only for a steal and a swap** — that single
     constraint is what makes the mechanic a catch-up device rather than a way for the
     strong to farm the weak, and it is why the leader can never steal. A gift points
     the other way, at the people below. */
  function targetsFor(team, dir){
    const ts = E().teams();
    const mine = ts[team] ? ts[team].score : 0;
    return ts.map((t, i) => i)
             .filter(i => i !== team && ts[i] &&
                          (dir === 'above' ? ts[i].score > mine : ts[i].score < mine));
  }

  function picking(){ return !!holding; }

  function showPicker(p, targets){
    const say = document.getElementById('flip-pick-say');
    const box = document.getElementById('flip-pick');
    const pct = Math.round(share() * 100);
    say.textContent =
      p.twist === 'steal' ? E().teamName(p.team) + ' takes ' + pct + '% of the gap — from whom?'
    : p.twist === 'swap'  ? E().teamName(p.team) + ' swaps scores — with whom?'
    :                       'The room votes: who else gets ' + cardWorth() + '?';
    /* **`said` off before `on` goes on.** The flash after a reversal borrows this same
       box and hides the chips inside it, and its own timeout deliberately leaves the
       class alone when a chooser has opened over it — so the chooser has to clear it
       or it renders with no chips and no way out. Found by driving two twists back to
       back. */
    box.classList.remove('said');
    box.classList.add('on');
    picker.show(E().teams(), targets);
    document.getElementById('flip-pick-tally').textContent = '';
    /* The one vote on this board, and it is the generous one. Advisory, like every
       vote here: the counts land on the board and the teacher clicks. */
    if(p.twist === 'gift') startGiftVote(targets);
    fitFlip();
  }
  function hidePicker(){
    holding = null;
    /* The gift vote borrows every handset in the room for a few seconds. Whichever way
       it ends — voted, chosen over, or skipped — they have to be given back, or the
       next question opens onto phones still showing a vote. */
    if(giftVoting){ giftVoting = false; E().standDownPhones(); }
    const box = document.getElementById('flip-pick');
    if(box) box.classList.remove('on', 'said');
    if(picker) picker.hide();
  }

  function startGiftVote(targets){
    const names = targets.map(i => E().teamName(i));
    giftVoting = !!E().askClass('Who should get the gift?', 'vote', names);
  }
  function paintGiftVote(all){
    const counts = {};
    (all || []).forEach(r => { const v = String((r && r.text) || r || '').trim();
                               if(v) counts[v] = (counts[v] || 0) + 1; });
    const line = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
                       .map(k => k + ' · ' + counts[k]).join('   ');
    const el = document.getElementById('flip-pick-tally');
    if(el) el.textContent = line;
  }

  /* **The arithmetic the whole board is for.** A steal moves half the closing amount
     each way, so the gap shuts by `share` and the thief can never overtake on a steal
     alone — being caught is a thing a class accepts, being leapfrogged by a card is
     not. Rounded to the board's own unit so the scoreboard stays readable. */
  function applyTwist(target){
    const p = holding;
    if(!p) return;
    hidePicker();
    const ts = E().teams();
    if(!ts[target] || !ts[p.team]){ advance(); return; }
    const step = 10;
    if(p.twist === 'swap'){
      const a = ts[p.team].score, b = ts[target].score;
      E().adjust(p.team, b - a, 'flip · swap with ' + E().teamName(target));
      E().adjust(target, a - b, 'flip · swap with ' + E().teamName(p.team));
      flash(E().teamName(p.team) + ' and ' + E().teamName(target) + ' have swapped scores.');
    } else if(p.twist === 'steal'){
      const gap  = ts[target].score - ts[p.team].score;
      const move = Math.max(step, Math.round((gap * share() / 2) / step) * step);
      E().adjust(target, -move, 'flip · stolen by ' + E().teamName(p.team));
      E().adjust(p.team,  move, 'flip · steal from ' + E().teamName(target));
      flash(E().teamName(p.team) + ' takes ' + move + ' off ' + E().teamName(target) + '.');
    } else {
      E().adjust(target, cardWorth(), 'flip · gift from ' + E().teamName(p.team));
      flash(E().teamName(target) + ' gets ' + cardWorth() + ' as well.');
    }
    E().Sound.play('sting');
    advance();
  }

  /* ---------- whose pick, and the ending ---------- */
  function advance(){
    if(over) return;
    if(cards.every(c => c.used)){ finish(); return; }
    passToLast();
    paintBar();
    flipTension();
  }

  /* **Last place picks.** Position rather than performance, so it cannot be farmed:
     tanking a question to get the pick costs more than the pick is worth. Ties go to
     whoever is earliest in the roster, which is arbitrary and needs to be — any rule
     that broke the tie by something a player controls would be the thing to game. */
  function passToLast(){
    const ts = E().teams();
    if(!ts.length) return;
    if(!lastPicks()){ E().nextTurn(); return; }
    let low = 0;
    ts.forEach((t, i) => { if(t.score < ts[low].score) low = i; });
    E().setActiveTeam(low);
    E().renderScorebar();
  }

  function paintBar(){
    const turn = document.getElementById('flip-turn');
    const left = document.getElementById('flip-left');
    if(!turn || !left) return;
    const ts = E().teams();
    const n  = cards.filter(c => !c.used).length;
    turn.textContent = ts.length
      ? (lastPicks() ? E().teamName(E().activeTeam()) + ' is last — their pick'
                     : E().teamName(E().activeTeam()) + ' picks')
      : '';
    left.textContent = n + (n === 1 ? ' card left' : ' cards left');
  }

  /* A line across the board for the beat after a reversal — the room has to be told
     what just happened to the numbers it is looking at, and the scoreboard alone does
     not say who did it to whom. */
  function flash(text){
    const say = document.getElementById('flip-pick-say');
    const box = document.getElementById('flip-pick');
    if(!say || !box) return;
    say.textContent = text;
    box.classList.add('on', 'said');
    setTimeout(()=>{
      if(picking()) return;        // a target is being chosen in the same box — leave it up
      box.classList.remove('on', 'said'); fitFlip();
    }, 2600);
  }

  function finish(){
    over = true;
    cur = null;
    hidePicker();
    const rank = E().teams().map((t, i) => ({ i, name:t.name, pts:t.score }))
                            .sort((a, b) => b.pts - a.pts);
    const top = rank[0];
    if(!top) return;
    const tie = rank.filter(r => r.pts === top.pts);
    E().showResult({
      eyebrow: cards.length + ' cards',
      title:   tie.length > 1 ? 'A tie' : top.name + ' wins',
      sub:     tie.length > 1 ? tie.map(r => r.name).join(' and ') + ' — ' + top.pts + ' each'
                              : top.pts + ' points',
      tone:    'gold',
      actions: [{ label:'New board', primary:true, onPick: startFlip }]
    });
  }

  function fitFlip(){
    const wrap = document.getElementById('flip-wrap');
    if(!wrap || window.HubGames.active() !== 'flip') return;
    K.fitToScreen(wrap, { min:260, gap:18 });
  }

  /* Two ingredients, the same shape as Race and Quickfire: how far through the board,
     and whether the end of it is close. The back rows are where the twists are, so
     the skin's lights climbing toward them is telling the truth. */
  function flipTension(){
    E().stageTension('flip', ()=>{
      const n = cards.length || 1;
      const played = cards.filter(c => c.used).length;
      return { t: Math.min(1, played / n), live: !over };
    });
  }
})();
