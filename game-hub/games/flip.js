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
   purpose. **The phones carry both**: a Steal or Swap goes to the winner's own
   handset (the rest of the room sees "Ana is choosing"), a Gift to every handset, and
   either lands on the board as a lit chip the teacher confirms — one click, or Enter.
   The teacher's click stays because a steal is the one beat a teacher may want to
   veto; without a relay the chooser is the teacher's alone, as it always was.

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
  /* The comeback arithmetic — steal, swap, gift, bounty, the box and the deal — is the
     shelf's (`hub-twist.js`), shared with Flip Party. This file keeps the board, the
     chooser, the phones and the beats; the shelf hands back moves and a sentence. */
  const T = window.HubTwist;
  /* Resolved at call time: the engine loads after this file, so `HubEnv` does not
     exist at parse. */
  const E = () => window.HubEnv;

  let POOL = [], TOPIC_NAMES = {}, SECTION_NAMES = {};
  let cards = [];              // the dealt board: {n, item, twist, used}
  let cur = null;              // the card on the clue card right now
  let pending = null;          // {team, twist} — a twist waiting for the beat after the question
  let holding = null;          // the twist whose target is being chosen right now
  let awaitingStandings = false;
  /* The room's say in a twist, while the chooser is open: {kind, vote, team}. `kind`
     is 'pick' (a Steal or a Swap — the winner's own phone chooses, the room watches) or
     'gift' (every phone votes who receives). `vote` is the Kit.vote doing the counting. */
  let twistVote = null;
  let over = false;
  /* The chooser is the leaderboard: one row per competitor, ranked, and the card
     decides which rows are live. `pickRows` is what is drawn right now, in rank order,
     each knowing its competitor and whether the card allows it. */
  let pickRows = [];
  /* The Box card's held effects, all keyed by competitor index, all cleared on a new
     deal: a shield waiting for the next steal, swap or bounty aimed at its holder; a
     turn to lose; and the one competitor who picks the next card whatever the turn
     order says. Small, and read at exactly one seam each. */
  let shields = new Set(), skips = new Set(), nextPicker = null;
  /* The three boxes being shown right now, their contents already drawn, and the
     amount this card paid the winner — what an Empty box takes back. */
  let boxes = null, paidNow = 0, revealing = false;
  let advanceAfterStandings = false;   // a twist standings is up; its Continue passes the turn
  /* The Box's Plinko drop on the board: the round-shaped state `Kit.round.cardTable`
     keeps its table on (`_table`, `_canvas`, `_loopId`), plus who is dropping and the
     kind each bin holds. Null between drops. */
  let drop = null;

  const size   = () => Number(S.get('flipSize',   'flip')) || 25;
  const base   = () => Number(S.get('flipPoints', 'flip')) || 100;
  const share  = () => Number(S.get('flipSteal',  'flip')) || 0.34;
  const twistPct = () => Number(S.get('flipTwists', 'flip'));
  const wantSwap = () => !!S.get('flipSwap', 'flip');
  const lastPicks = () => !!S.get('flipLastPicks', 'flip');
  const marked   = () => !!S.get('flipMarked', 'flip');
  const catchUp  = () => Math.max(1, Number(S.get('flipCatchUp', 'flip')) || 1);
  const headStartMs = () => Math.max(0, Number(S.get('flipHeadStart', 'flip')) || 0) * 1000;
  const wantBounty  = () => !!S.get('flipBounty', 'flip');
  const swapScope   = () => S.get('flipSwapScope', 'flip') || 'next';
  const wantBoxes   = () => !!S.get('flipBoxes', 'flip');
  const boxLoad     = () => Math.max(0, Math.min(1, Number(S.get('flipBoxLoad', 'flip'))));

  /* **Where a competitor stands, as a 0..1 share of the spread** — 0 at the top, 1 at
     the bottom, everyone between on the slope of their gap. The one number both
     catch-up devices read, so they cannot disagree about who is behind. A room with
     no spread (all level, or one competitor) is 0 for everybody. */
  /* Is anybody actually ahead of anybody — the room has a spread. With everyone level
     there is no leader to wait, and no head start to give. */
  const scores = () => E().teams().map(x => x.score);
  const names  = () => E().teams().map((x, i) => E().teamName(i));
  const spread = () => T.spread(scores());
  const behind = t => T.behind(scores(), t);
  /* What THIS competitor earns for the card: the base, scaled up by how far behind
     they are — the shelf's catch-up worth, rounded to the board's unit. */
  const cardWorthFor = t => T.worth(cardWorth(), scores(), t, { catchUp: catchUp(), step: 10 });

  /* ---- the faces of a card, and what a box can hold: the shelf's tables ----
     `target` is the only thing the board has to branch on: a twist that needs somebody
     chosen stops the game for one beat and asks. Everything else is arithmetic. */
  const TW  = T.kinds;
  const BOX = T.BOX;

  const HOST = {
    game:'flip', stage:'play-flip',
    mount: () => E().cardMount(), onCard: true, commit:'group-btn',
    live: () => E().modalMode() === 'flip',
    turn: () => E().activeTeam(),
    /* Every card pays the same base; what a Double changes is the base, so the pay
       rule underneath (everyone-scores by default) doubles for everybody who finished
       rather than only for the winner. The twist is the card's, not one player's. */
    worth: who => cardWorthFor(who),
    step:  () => 10,
    /* How long this competitor's phone waits before it shows the question — the
       leader waits the full head start, last place none, the rest on the slope.
       The engine carries it on the arm and charges the wait to their stopwatch. */
    headStart: who => spread() ? Math.round(headStartMs() * (1 - behind(who))) : 0,
    win:   team => flipWin(team),
    /* The eyebrow on the question's own standings: the twist by name, so a DOUBLE —
       which has no beat of its own after the question — still announces itself, and a
       Steal/Swap/Gift names the card the room is about to see resolve. */
    payEyebrow: () => cur && cur.twist && cur.twist !== 'plain'
                 ? (TW[cur.twist].label + ' · Card ' + cur.n + (cur.twist === 'double' ? ' — pays double' : ''))
                 : null,
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
    /* Enter takes the row the room lit — the teacher's one-key confirm. A number key
       picks the nth LIVE row, so a veto is the same gesture as before. */
    document.addEventListener('keydown', e => {
      if(!holding) return;
      if(e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
      if(holding.twist === 'box') return;   // a drop is not a pick: the chip decides
      const take = applyTwist;
      if(e.key === 'Enter'){
        const who = litPick();
        if(who != null){ e.preventDefault(); take(who); }
        return;
      }
      const n = parseInt(e.key, 10);
      if(n >= 1){
        const live = pickRows.filter(r => r.live);
        if(live[n - 1]){ e.preventDefault(); take(live[n - 1].who); }
      }
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
    wantsVote:   () => E().roundLive() || !!twistVote,
    roomNote:    () => !twistVote ? null
                     : twistVote.kind === 'gift' ? 'vote who gets it'
                     : twistVote.kind === 'drop' ? E().teamName(twistVote.team) + ' is dropping'
                     : E().teamName(twistVote.team) + ' is choosing',
    onVoteReply(all){
      /* Two things can be asking the room, never at once: the question's own round
         while the card is open, and the twist's chooser after it has closed. */
      if(E().roundLive()){ E().roundOnReplies(all); return; }
      if(twistVote) paintTwistVote(all);
    },
    /* The Box's drop, streamed from the winner's phone: its field once (`f:`), its
       chip's position as it moves (`c:`), and the landing (`bin:`), which is the
       one that counts. Consumed here so the shared tally never sees them. */
    onPhoneReply(r){ return dropReply(r); },
    /* The round the phones play, plus the twist's name so each handset paints the
       STEAL/SWAP/GIFT band above the question — the stakes, before they answer. */
    phoneRound(){ const r = E().roundForPhones(); if(r && cur && cur.twist && cur.twist !== 'plain') r.twist = cur.twist; return r; },
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
    onStandingsDone(){
      if(awaitingStandings){ awaitingStandings = false; runPending(); return; }
      if(advanceAfterStandings){ advanceAfterStandings = false; advance(); }
    }
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
    dealTwists(cards);
    cur = null; pending = null; awaitingStandings = false; over = false; twistVote = null;
    shields = new Set(); skips = new Set(); nextPicker = null; boxes = null; paidNow = 0; revealing = false;
    const cardEl = document.getElementById('clue-card');
    if(cardEl) cardEl.className = cardEl.className.replace(/\bflip-tw\S*/g, '').trim();
    hidePicker();
    passToLast();
    renderGrid(cols);
    paintBar();
    fitFlip();
    flipTension();
  }

  /* The shelf deals: weighted to the back rows, the Swap forced deepest, Steal leading
     the cycle. This only says which switches are on and writes the kinds onto the cards. */
  function dealTwists(list){
    const kinds = T.deal(list.map(c => c.row), { pct: twistPct(), swap: wantSwap(), bounty: wantBounty(), boxes: wantBoxes() });
    list.forEach((c, i) => { c.twist = kinds[i] || 'plain'; });
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
      /* The number, and under it the column the question came from — its human name,
         never the section code — so a pick is a choice of topic rather than a blind
         number. The twist stays hidden; the topic is not a secret. */
      const num = document.createElement('span');
      num.className = 'flip-card-n'; num.textContent = String(c.n);
      b.appendChild(num);
      if(c.item.catName){
        const topic = document.createElement('span');
        topic.className = 'flip-card-topic'; topic.textContent = c.item.catName;
        b.appendChild(topic);
      }
      /* **A marked card says something is on it, never what.** Reported from a run:
         with every card identical, "last place picks" is a coin flip rather than a
         decision, and the room cannot see that the back rows are loaded — which is
         the whole shape of the game, kept secret from the people playing it. The
         marker gives the picker a real choice and makes the rising volatility
         visible, while the twist itself stays hidden: a marked card might be the
         Steal that saves you or the Double that helps the leader, and that gamble is
         the point. Off (`flipMarked`) restores the blind board. */
      if(c.twist !== 'plain' && marked()) b.classList.add('marked');
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
  /* The card's second line: the twist's rule in concrete numbers, so a class reads
     what is at stake before the question rather than a bare label. */
  function ruleLine(kind){
    const pct = Math.round(share() * 100);
    switch(kind){
      case 'steal':  return 'Win it and take ' + pct + '% of the gap off someone ahead of you.';
      case 'swap':   return 'Win it and swap scores with ' + (swapScope() === 'next' ? 'the player just above you' : 'anyone ahead of you') + '.';
      case 'gift':   return 'Win it and the room votes who else gets the same points.';
      case 'bounty': return 'Finish ahead of the leader and take ' + pct + '% of their lead.';
      case 'double': return 'This card is worth double for everyone who gets it.';
      case 'box':    return 'Win it and drop a chip — a prize or a forfeit, more prizes the further behind you are.';
      default: return '';
    }
  }
  /* A NON-consuming shield check for previews and flights — the real `shielded`
     deletes the shield, so calling the shelf's arithmetic to preview a steal would
     spend it before the teacher even chose. */
  const peekShield = t => shields.has(t);

  function openCard(card, el){
    if(over || card.used || picking() || revealing) return;
    if(E().clueIsOpen()) return;
    cur = card;
    /* Who is in front as this card opens — the Bounty's target, fixed now so that the
       question's own payout cannot move it. Null when nobody is clearly in front. */
    const ts = E().teams();
    const top = ts.length ? Math.max.apply(null, ts.map(x => x.score)) : 0;
    const leaders = ts.map((x, i) => i).filter(i => ts[i].score === top);
    card.leader = (leaders.length === 1 && ts.length > 1) ? leaders[0] : null;
    E().setClueValue(cardWorth());
    const tw = TW[card.twist];
    /* **The twist is an event, not a caption.** It was the card's topline — gold on
       navy, in the corner of a screen-wide card, beside the question — and a class
       could not read it. The card wears the twist's own colour now and the topline
       becomes a band across it, the same way a Daily Double restyles the card
       rather than adding furniture to it. */
    const cardEl = document.getElementById('clue-card');
    cardEl.className = cardEl.className.replace(/\bflip-tw\S*/g, '').trim();
    if(card.twist !== 'plain') cardEl.classList.add('flip-tw', 'flip-tw-' + card.twist);
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
      section: (card.twist !== 'plain' ? ruleLine(card.twist) : '') || tw.note || card.item.catName || '',
      buttons:{ reveal:true, close:true }
    });
  }

  /* What a round pays. The base is `worth()` and the rule underneath decides the
     split; what this adds is the twist, which is held over to the beat after the
     standings so the room actually sees it happen. */
  function flipWin(team){
    const paid = E().award(team, cardWorthFor(team), { why:'flip · card ' + (cur ? cur.n : '?') });
    paidNow = Number(paid) || cardWorthFor(team);
    E().markRun(team, true);
    useCard();
    pending = pendingFor(team);
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
      const paid = E().award(team, cardWorthFor(team), { why:'flip · card ' + (cur ? cur.n : '?') });
      paidNow = Number(paid) || cardWorthFor(team);
      E().markRun(team, true);
      pending = pendingFor(team);
    } else {
      if(missed) E().markRun(E().activeTeam(), false);
      pending = null;
    }
    useCard();
    awaitingStandings = false;
    E().closeModal(E().flipHoldMs(), runPending);
  }

  /* The beat this card owes after the question, if any: a twist with a target wants
     a chooser; a Bounty wants its settlement. Read off the card while it is still
     `cur`, because the beat runs after the standings, when it no longer is. */
  function pendingFor(team){
    if(!cur) return null;
    if(cur.twist === 'bounty') return { team, twist:'bounty', leader: cur.leader };
    return TW[cur.twist].target ? { team, twist: cur.twist } : null;
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
    if(p.twist === 'bounty'){ applyBounty(p); return; }
    if(p.twist === 'box'){ holding = p; showBoxes(p); return; }
    const targets = targetsFor(p.team, TW[p.twist].target, p.twist);
    if(!targets.length){
      /* Nothing to do and it must SAY so: a Steal won by the player already in front
         is the leader discovering that the one card they wanted is the one card they
         cannot use, which is the mechanic working rather than a bug. */
      flash(T.nothing(p.twist, p.team, names()));
      advance();
      return;
    }
    holding = p;
    showPicker(p, targets);
  }
  /* Who a twist may be aimed at — the shelf's rule: upward only for a steal and a
     swap, downward for a gift, the next one up alone for a leapfrog swap. */
  function targetsFor(team, dir, twist){
    return T.targets(scores(), team, twist, { swapNext: swapScope() === 'next' });
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
    box.dataset.tw = p.twist;                 // the chooser wears the twist's colour band
    renderPickRows(p, targets);
    document.getElementById('flip-pick-tally').textContent = '';
    /* The phones get a say — advisory, like every vote here: the pick lands on the
       board as a lit chip and the teacher clicks it. */
    askPhones(p, targets);
    fitFlip();
  }
  function hidePicker(){
    holding = null;
    /* The gift vote borrows every handset in the room for a few seconds. Whichever way
       it ends — voted, chosen over, or skipped — they have to be given back, or the
       next question opens onto phones still showing a vote. */
    if(twistVote){ twistVote = null; E().standDownPhones(); }
    const box = document.getElementById('flip-pick');
    if(box){ box.classList.remove('on', 'said'); delete box.dataset.tw; }
    const row = document.getElementById('flip-pick-row');
    if(row) row.innerHTML = '';
    if(row) row.classList.remove('boxes', 'opened', 'drop');
    pickRows = [];
    boxes = null;
    if(drop){ drop._loopId = (drop._loopId || 0) + 1; if(drop._canvas) drop._canvas.remove(); drop = null; }
  }

  /* ---------- the Box: three closed boxes, one pick, loaded by place ----------
     The contents are drawn as the boxes appear, so the pick is a real one — the
     other two open afterwards to show what was passed over, which is the drama.
     **The bag is loaded by the winner's place**: a prize's chance runs from
     ½ − load/2 for the leader to ½ + load/2 for last place, everyone between on the
     slope. `load` 0 is a fair box for everybody; 1 is a near certainty either way. */
  const DROP_BINS = 7;
  function showBoxes(p){
    /* **The Box is a Plinko drop now.** Seven bins, each holding a box content drawn
       from the same loaded bag (by the winner's place), the labels on the board for
       the room to read before the chip falls. The winner drops on their own phone
       and the board mirrors the fall; with no phones the teacher pulls the chip
       here. The bin it rests in is applied exactly as an opened box was. */
    const kinds = T.boxes(scores(), p.team, { load: boxLoad(), count: DROP_BINS });
    boxes = kinds;
    const labels = kinds.map(k => BOX[k].short || BOX[k].name);
    const say = document.getElementById('flip-pick-say');
    const box = document.getElementById('flip-pick');
    say.textContent = E().teamName(p.team) + ' drops a chip — the bins are loaded for ' + ordinal(ranking().filter(r => r.who === p.team)[0].place) + ' place';
    box.classList.remove('said');
    box.classList.add('on');
    box.dataset.tw = 'box';
    const mount = document.getElementById('flip-pick-row');
    mount.innerHTML = '';
    mount.classList.remove('crowd', 'opened', 'boxes');
    mount.classList.add('drop');
    pickRows = [];
    document.getElementById('flip-pick-tally').textContent = '';
    /* The winner's own phone gets the table; the board draws what it sends. */
    const asked = E().askClass('Pull the chip off the ledge and let go', 'table', ['●'], p.team,
                               { plinko: { rows: 6, bins: labels, mirror: true }, bare: true, rethink: true, multi: 1, holds: true, twist: 'box' });
    twistVote = asked ? { kind: 'drop', vote: K.vote.open({ options: labels, team: p.team }), team: p.team } : null;
    drop = { team: p.team, kinds, labels, mirrored: asked, done: false, need: 1, chosen: [], picks: {}, cardCells: [] };
    const height = Math.max(240, Math.min(420, (window.innerHeight || 720) - 350));   // under the room chip on a 720 board
    const table = K.round.cardTable(mount, drop, {
      height, say: false, driven: asked, handle: '__flipDrop',   // a driven test's window onto the drop
      table: { surface: '#0e1230', onRest: r => { if(!drop || drop.done || asked) return; dropLanded(table.binOf(r.x)); } },
      deal: t => { t.slots(0); t.setPieces([]); t.pegs({ rows: 6, shelf: true }); t.bins(labels);
                   if(!asked){ const at = t.ledge(); t.addPiece('●', { x: at.x, y: at.y, vx: 0, vy: 0, round: true }); } }
    });
    /* As tall as the chooser can be — cardTable caps a canvas for the clue card's
       chrome, which the chooser does not carry — and phone-shaped when it mirrors
       a phone; the teacher's own is squarer. */
    if(drop._canvas) drop._canvas.style.height = height + 'px';
    dropSize(asked ? 0.58 : 0.8);
    document.getElementById('flip-pick-tally').textContent = asked ? 'Waiting for ' + E().teamName(p.team) + "'s drop…" : 'Pull the chip off the ledge for them.';
    fitFlip();
  }
  function dropSize(aspect){
    if(!drop || !drop._canvas) return;
    const h = parseFloat(drop._canvas.style.height) || 340;
    drop._canvas.style.width = Math.round(h * Math.max(0.35, Math.min(1.6, aspect))) + 'px';
    if(drop._table) drop._table.resize();
  }
  function dropReply(r){
    if(!drop || drop.done || !r || Number(r.team) !== drop.team) return false;
    const v = String(r.value || '');
    if(v.startsWith('f:')){
      const n = v.slice(2).split(',').map(Number);
      if(n.length >= 6 && n.every(Number.isFinite) && drop._table){
        dropSize(n[5]);
        drop._table.pegs({ shelf: true, lattice: { cols: n[0], rows: n[1], top: n[2], bot: n[3], ledge: n[4] } });
      }
      return true;
    }
    if(v.startsWith('c:')){
      const n = v.slice(2).split(',').map(Number);
      if(n.length === 2 && n.every(Number.isFinite) && drop._table) drop._table.drive(n[0], n[1]);
      return true;
    }
    const m = v.match(/^bin:(\d+)$/);
    if(m){ if(drop._table) drop._table.land(Number(m[1])); dropLanded(Number(m[1])); return true; }
    return false;
  }
  /* The chip is down: name the bin, let the burst play, then apply the box. */
  function dropLanded(i){
    if(!drop || drop.done) return;
    drop.done = true;
    const k = drop.kinds[Math.max(0, Math.min(drop.kinds.length - 1, i))];
    const team = drop.team;
    holding = null;
    if(twistVote){ twistVote = null; E().standDownPhones(); }
    revealing = true;
    document.getElementById('flip-pick-say').textContent = BOX[k].name.toUpperCase() + ' — ' + BOX[k].blurb + '.';
    document.getElementById('flip-pick-tally').textContent = '';
    E().Sound.play(BOX[k].prize ? 'sting' : 'wrong');
    setTimeout(() => { revealing = false; hidePicker(); applyBox(team, k); }, 2400);
  }
  /* The effect of a box is the shelf's; this applies the moves, keeps what the shelf
     says to hold, and opens the steal chooser when a box chains into one. */
  function applyBox(team, k){
    if(!E().teams()[team] || over){ advance(); return; }
    const res = T.box(k, scores(), team, { paid: paidNow, worth: cardWorthFor(team), step: 10, names: names() });
    if(res.chain === 'steal'){ pending = { team, twist:'steal' }; runPending(); return; }
    if(res.hold === 'shield') shields.add(team);
    if(res.hold === 'skip')   skips.add(team);
    if(res.hold === 'extra')  nextPicker = team;
    E().standingsMark();
    apply(res.moves);
    if(!told(res.eyebrow, res.said, res.who, res.moves)) advance();
  }
  /* Every move the shelf hands back lands through the one home for a signed score move. */
  function apply(moves){
    (moves || []).forEach(m => E().adjust(m.who, m.delta, 'flip · ' + m.why));
  }
  /* A shield answers a move aimed at its holder: the move fizzles, the shield is
     spent, and the board says so. One rule for a steal, a swap and a bounty. */
  function shielded(target){
    if(!shields.has(target)) return false;
    shields.delete(target);
    return true;
  }

  /* ---------- the leaderboard as the chooser ----------
     The room could not keep track of who was winning while the chooser showed bare
     names, so the chooser IS the standings: every competitor, ranked, place and score
     on their own tile, exactly as the between-question screen draws them. The card
     decides which rows are live; the rest stay, greyed, with the reason — so the class
     sees the whole board and why each name is or is not in play. */
  const ordinal = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');
  function ranking(){
    const ts = E().teams();
    const rows = ts.map((t, i) => ({ who:i, name:t.name, pts:t.score }))
                   .sort((a, b) => b.pts - a.pts || a.who - b.who);
    /* Standard competition ranking: level scores share a place. */
    rows.forEach((r, n) => { r.place = (n > 0 && rows[n - 1].pts === r.pts) ? rows[n - 1].place : n + 1; });
    return rows;
  }
  /* The line a phone shows for a competitor, and the value its reply carries: the
     leaderboard line, so a student is choosing from the standings in their hand. */
  const lineOf = r => ordinal(r.place) + ' · ' + r.name + ' · ' + r.pts;
  function reasonOff(p, r){
    if(r.who === p.team) return 'that is you';
    const dir = TW[p.twist].target;
    if(dir === 'above') return p.twist === 'swap' && swapScope() === 'next' ? 'not the next one up' : 'below ' + E().teamName(p.team);
    return 'ahead of ' + E().teamName(p.team);
  }
  /* What this target would gain or lose, previewed on its row before anybody
     chooses — the shelf's own arithmetic, run with a non-consuming shield. Overwritten
     by the vote count once phones reply, so it is the "before" picture. */
  function previewTail(p, who){
    const o = { share: share(), worth: cardWorth(), step: 10, names: names(), shielded: peekShield };
    const res = p.twist === 'swap' ? T.swap(scores(), p.team, who, o)
              : p.twist === 'gift' ? T.gift(scores(), p.team, who, o)
              :                      T.steal(scores(), p.team, who, o);
    if(res.blocked) return '\u{1F6E1} blocked';
    const mv = (res.moves || []).find(m => m.who === who);
    const d = mv ? mv.delta : 0;
    if(p.twist === 'gift') return '+' + d;
    if(p.twist === 'swap') return (d >= 0 ? '+' : '\u2212') + Math.abs(d);
    return '\u2212' + Math.abs(d);
  }
  function renderPickRows(p, targets){
    const mount = document.getElementById('flip-pick-row');
    mount.innerHTML = '';
    const live = new Set(targets);
    pickRows = ranking().map(r => Object.assign(r, { live: live.has(r.who), line: lineOf(r) }));
    let key = 0;
    pickRows.forEach(r => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'flip-pick-line st-row' + (r.live ? ' live' : ' inert');
      row.setAttribute('data-team', r.who);
      if(window.HubBuzzer && window.HubBuzzer.teamColour)
        row.style.setProperty('--tile', window.HubBuzzer.teamColour(r.who));
      const cell = (cls, text) => { const el = document.createElement('span'); el.className = cls; el.textContent = text; row.appendChild(el); return el; };
      cell('st-place', ordinal(r.place));
      cell('flip-pick-key', r.live ? String(++key) : '');
      cell('st-name', r.name + (shields.has(r.who) ? ' \u{1F6E1}' : ''));
      cell('st-pts', String(r.pts));
      cell('flip-pick-tail', r.live ? previewTail(p, r.who) : reasonOff(p, r));
      row.disabled = !r.live;
      if(r.live) row.addEventListener('click', () => applyTwist(r.who));
      mount.appendChild(row);
    });
    mount.classList.toggle('crowd', pickRows.length > 8);
  }
  const rowOf = who => document.querySelector('#flip-pick-row .flip-pick-line[data-team="' + who + '"]');

  /* **Who decides a twist is who the card says.** A Steal or a Swap is the winner's
     choice, so the chooser goes to the winner's phone alone — `askClass` narrowed to
     their team, which the relay enforces and every other handset shows as "Ana is
     choosing". A Gift is the room's choice, so every phone votes. In a room of
     individuals a team is one phone, so "the winner's team" is the winner. No relay:
     `askClass` returns false and the chooser stays the teacher's, exactly as before.

     The phones are offered the target names as options, so a reply's `value` is a
     name. `Kit.vote` does the counting — a recount from the full list every time, so
     a student who changes their mind is counted once — and this only paints. */
  function askPhones(p, targets){
    /* The ballot is the leaderboard line of each live row, and **no phone is offered
       its own line**: a gift vote used to go to every phone with the same list and
       students voted for themselves. The relay hands each competitor its own list. */
    const rows  = pickRows.filter(r => r.live);
    const lines = rows.map(r => r.line);
    const gift  = p.twist === 'gift';
    const team  = gift ? null : p.team;
    const ask   = gift            ? 'Who should get the gift?'
                : p.twist === 'swap' ? 'Swap — with whom?'
                :                      'Steal — from whom?';
    const byTeam = E().teams().map((t, i) => rows.filter(r => r.who !== i).map(r => r.line));
    /* Each line in its competitor's colour — the same colour the board draws the
       row in, so the ballot in the hand matches the chooser on the wall. */
    const hues = {};
    if(window.HubBuzzer && window.HubBuzzer.teamColour) rows.forEach(r => { hues[r.line] = window.HubBuzzer.teamColour(r.who); });
    const vote = K.vote.open({ options: lines, team });
    twistVote = E().askClass(ask, 'vote', lines, team, { optionsByTeam: byTeam, optionHues: hues, twist: p.twist })
              ? { kind: gift ? 'gift' : 'pick', vote, team: p.team } : null;
  }
  /* The count lands on the chip the teacher is about to click, in the chooser's own
     order (one chip per option, as offered), and the chip in front is ringed. The
     line beneath says what the room decided — "Ana picked Gia", or the leader and
     the count, or that it is tied — the thing a teacher wants to know before clicking. */
  function paintTwistVote(all){
    if(!twistVote || twistVote.kind === 'drop') return;
    const vote   = twistVote.vote;
    const counts = vote.apply(all);
    pickRows.forEach(r => {
      const row = rowOf(r.who);
      if(!row) return;
      row.classList.remove('leading');
      if(!r.live) return;
      const tail = row.querySelector('.flip-pick-tail');
      const n = counts[r.line] || 0;
      tail.textContent = n ? (twistVote.kind === 'gift' ? n + (n === 1 ? ' vote' : ' votes') : '✓') : '';
    });
    const lead = vote.leader();
    const leadRow = lead && !lead.tied ? pickRows.filter(r => r.line === lead.option)[0] : null;
    if(leadRow){ const row = rowOf(leadRow.who); if(row) row.classList.add('leading'); }
    const el = document.getElementById('flip-pick-tally');
    if(!el) return;
    if(!lead){ el.textContent = ''; return; }
    if(lead.tied){ el.textContent = 'Tied at ' + lead.n; return; }
    const name = leadRow ? leadRow.name : lead.option;
    /* One voice is a pick, not a poll: a Steal in a room of individuals is the
       winner's one reply, and the board says whose it was. */
    el.textContent = (twistVote.kind === 'pick' && vote.total() === 1)
      ? E().teamName(twistVote.team) + ' picked ' + name + ' — click to confirm'
      : name + ' leads · ' + lead.n + ' of ' + vote.total();
  }
  /* The competitor whose row the room lit, if any — Enter confirms it. */
  function litPick(){
    const row = document.querySelector('#flip-pick-row .flip-pick-line.leading');
    return row ? Number(row.getAttribute('data-team')) : null;
  }

  /* The Bounty settles itself — the shelf's arithmetic over the record (the phones'
     stopwatch order). A Bounty the leader wins is the leader defending their lead, and
     the sentence says so. */
  function applyBounty(p){
    const rows = (K.round && K.round.results) ? K.round.results.finished() : [];
    const res = T.bounty(scores(), p.leader, rows.map(r => ({ who: r.who, place: r.place })),
                         { share: share(), step: 10, names: names(), shielded });
    if(!res.moves.length && !res.blocked){ flash(res.said); advance(); return; }
    E().standingsMark();
    apply(res.moves);
    E().Sound.play(res.blocked ? 'wrong' : 'sting');
    if(!told(res.eyebrow, res.said, res.who, res.moves)) advance();
  }

  /* The teacher confirmed a target: the shelf does the arithmetic (a steal moves half
     the closing amount each way, so the thief never overtakes on a steal alone; a swap
     trades; a gift pays the room's choice), this applies it and shows the beat. */
  function applyTwist(target){
    const p = holding;
    if(!p) return;
    hidePicker();
    const ts = E().teams();
    if(!ts[target] || !ts[p.team]){ advance(); return; }
    const o = { share: share(), worth: cardWorth(), step: 10, names: names(), shielded };
    const res = p.twist === 'swap' ? T.swap(scores(), p.team, target, o)
              : p.twist === 'gift' ? T.gift(scores(), p.team, target, o)
              :                      T.steal(scores(), p.team, target, o);
    /* The move is its own beat on the leaderboard: baseline first, so the standings
       that follow show this move alone and shuffle from the places last shown. */
    E().standingsMark();
    apply(res.moves);
    E().Sound.play(res.blocked ? 'wrong' : 'sting');
    if(!told(res.eyebrow, res.said, res.who, res.moves)) advance();
  }

  /* **A reversal is watched on the leaderboard, not read off a line.** A class could
     not follow the twists because the standings only ever showed the question: the
     points moved under a one-line message and nobody saw Gia drop. With the standings
     screen on, the twist gets its own — the eyebrow is the card, the title the move,
     the rows shuffling from where the question left them to where the twist put them.
     With the standings off, the line is all there is, as before. */
  /* The shelf's moves become the standings' flights: each gain sourced from a loss
     (the leader, for a bounty's many takers) or from the pot (a gift has no losing
     row). The number that flies is the gain. */
  function flightsFromMoves(moves){
    const gains = (moves || []).filter(m => m.delta > 0);
    const loss  = (moves || []).filter(m => m.delta < 0);
    return gains.map(g => ({ from: loss.length ? loss[0].who : null, to: g.who, amount: g.delta }));
  }
  /* **A reversal is watched on the leaderboard, and the points are seen to travel.**
     The standings open on the pre-move numbers and the twist's points fly from the
     losing row to the gaining one (`moves`), so the class sees the score leave one
     name and arrive at another rather than reading it. Returns whether a standings
     opened — the caller advances the turn itself when it did not (standings off), and
     otherwise the turn waits for the standings' Continue (`onStandingsDone`). */
  /* **The phones share the beat.** Each handset hears its own line of the reversal:
     the loser sees its loss in red with the buzz, the winner its gain in green, and
     everyone else the sentence in the twist's colour — so the move is legible in the
     hand as well as on the wall. No relay: `room()` is null and this simply does
     nothing, like every other phone touch here. */
  function sendTell(text, moves){
    const room = E().room && E().room();
    if(!room || !room.tell) return;
    const hue = i => (window.HubBuzzer && window.HubBuzzer.teamColour) ? window.HubBuzzer.teamColour(i) : '';
    const by = {};
    E().teams().forEach((t, i) => {
      const mv = (moves || []).find(m => m.who === i && m.delta !== 0);
      by[i] = mv
        ? { kind: mv.delta > 0 ? 'gain' : 'loss', delta: mv.delta, text, hue: hue(i) }
        : { kind: 'note', delta: 0, text, hue: '' };
    });
    room.tell(by);
  }
  function told(label, text, who, moves){
    sendTell(text, moves);
    if(E().standingsWanted('flip')){
      E().showStandings({ eyebrow: label, title: text, winner: who, moves: flightsFromMoves(moves) });
      advanceAfterStandings = true;
      return true;
    }
    flash(text);
    return false;
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
    /* A Pick-again box outranks the turn order once; a Lose-a-turn box is spent the
       moment the turn would have been theirs. */
    if(nextPicker != null && ts[nextPicker]){
      const who = nextPicker; nextPicker = null;
      E().setActiveTeam(who); E().renderScorebar(); return;
    }
    nextPicker = null;
    if(!lastPicks()){
      E().nextTurn();
      for(let guard = 0; guard < ts.length && skips.has(E().activeTeam()); guard++){ skips.delete(E().activeTeam()); E().nextTurn(); }
      return;
    }
    const order = ts.map((t, i) => i).sort((a, b) => ts[a].score - ts[b].score || a - b);
    let low = order[0];
    for(const i of order){ if(!skips.has(i)){ low = i; break; } skips.delete(i); }
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

  /* A driven test's window — the same kind of handle as Battle Scrabble's `__bs` and
     the drop's `__flipDrop`. Read-only facts about the board plus the two entry points
     a headless test needs: open a card of a named twist, and run its post-question
     beat (the chooser or the settlement) without a phone. Never used by the game. */
  window.__flip = {
    cards: () => cards.map(c => ({ n:c.n, twist:c.twist, used:c.used })),
    state: () => ({ cur: cur && cur.n, holding: holding && holding.twist, over, advanceAfterStandings }),
    /* Open the first unused card carrying this twist (or any card by number), as the
       active team, exactly as a click would. */
    open: want => {
      const c = cards.find(x => !x.used && (typeof want === 'number' ? x.n === want : x.twist === want));
      if(c && c.el){ openCard(c, c.el); return c.n; }
      return null;
    },
    /* Force the beat after the question for the card on the clue card, as if `team`
       just won it — the seam the question normally reaches through flipWin. */
    winNow: team => { paidNow = cardWorthFor(team); E().markRun(team, true); useCard();
                      pending = pendingFor(team); awaitingStandings = false;
                      E().closeModal(E().flipHoldMs(), runPending); },
    pick: who => applyTwist(who),
    /* Land the Box chip in bin `i` without a flick — the drop's `onRest` seam, for a
       headless test of the Box's prize/forfeit and the beat it chains into. */
    dropBin: i => { if(drop && drop._table && drop._table.land) drop._table.land(i); dropLanded(i); },
    picking: () => picking()
  };
})();
