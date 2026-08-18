/* ================= Game Hub — shared engine =================
   Renders the UI and runs Jeopardy + Blockbusters from unit content.
   Units register themselves into `window.UNITS` (see game-hub/content/unit-*.js).
   Flow: choose unit -> choose game -> choose sections -> play.
   If only one unit is loaded (a per-unit shell), the unit step is skipped.

   Teams/scores live in one shared roster shown in an always-present team bar,
   so you can move between games and units without losing team names or points.
   Both games feed the same scores; a Reset points button clears them. */
(function(){
  'use strict';

  const UNITS = window.UNITS || (window.UNIT ? [window.UNIT] : []);
  if(!UNITS.length){ throw new Error('hub-engine: no units loaded — include a content file (window.UNITS) before hub-engine.js'); }

  const S = window.HubSettings;
  if(!S){ throw new Error('hub-engine: game-hub/hub-settings.js must load before hub-engine.js'); }

  const Kit = window.HubKit;
  if(!Kit){ throw new Error('hub-engine: game-hub/hub-kit.js must load before hub-engine.js'); }

  /* Which build is actually running — read from this script's own ?v= stamp, so the
     HTML stays the single source of truth. Shown in the settings panel: a cached old
     copy of the engine is otherwise invisible and looks like the fix never landed. */
  window.HUB_BUILD = (function(){
    const el = document.currentScript ||
               [...document.querySelectorAll('script[src*="hub-engine.js"]')].pop();
    const m = el && el.src && el.src.match(/[?&]v=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : 'dev';
  })();

  /* ---- `?desktop=1` — the projected layout, on a handset ----
     The phone layout is for a *teacher checking a lesson*: it compacts the chrome,
     lets the board scroll, and keeps everything reachable under a thumb. That is
     the right thing when you are teaching, and the wrong thing when you are away
     from the laptop and want to see **what the room will actually see** — the
     board at projector proportions, with the columns and the fit it will really
     have.

     So: `game-hub.html?desktop=1` lays the page out at a projector's 1280 and lets
     the browser scale it down, exactly as `phone-bench.html` already does with a
     board in a frame. The media queries key off width, so pinning the width is the
     whole mechanism — none of the handset tiers match at 1280 and nothing else has
     to know this mode exists.

     A number sets the width (`?desktop=1440`) for checking a wider screen; `1` or
     an empty value means 1280, which is what the layout suites assert against and
     therefore the honest default. Text will be small — pinch to read. That is the
     trade for seeing the real thing rather than a reflowed version of it. */
  (function(){
    const m = String(location.search).match(/[?&]desktop=([^&]*)/);
    if(!m) return;
    const asked = parseInt(m[1], 10);
    const w = (asked && asked >= 480) ? asked : 1280;
    let tag = document.querySelector('meta[name="viewport"]');
    if(!tag){ tag = document.createElement('meta'); tag.name = 'viewport'; document.head.appendChild(tag); }
    /* `initial-scale` is deliberately not set: letting the browser choose the
       fit-to-screen scale is what makes 1280 land inside a 390px phone, and
       pinning it to 1 would put the board off the right edge instead. */
    tag.setAttribute('content', 'width=' + w);
    document.documentElement.dataset.desktopPreview = w;
  })();

  /* ================= GAME REGISTRY =================
     A game declares itself once, here, and the engine drives it through this
     contract instead of asking `if (activeGame === 'jeopardy')` in nine places.
     What that buys:

     - **A checklist that cannot be half-finished.** Every hook has a no-op default,
       so a new game runs the moment it is registered and grows features by filling
       hooks in — rather than working everywhere except the two branch points you
       didn't know about.
     - **Shared by default.** The chrome, team bar, timer, sounds, kit services, the
       clue card, the end-of-round banner and the whole game-show skin apply to any
       registered game without it asking. A game only writes code for what makes it
       different.
     - **Divergent by declaration.** Where games genuinely differ — how tense the
       board is right now, what the ident looks like — that is a hook or a `variant`
       setting, not a branch.

     The hooks, all optional:
       load(unit)            pull this game's banks out of a unit
       hasBank(unit)         does this unit offer the game at all?
       renderContent(list,help)  the section/category picker
       startButton(btn)      enable and label the start button
       start()               build the board (screen is still hidden)
       fit()                 measure and size — runs once the screen is visible
       deal()                the board's entrance animation
       tension()             set `--tension` and drive the music bed
       onResize()            re-fit after a window resize
       onTimerEnd()          the header countdown reached zero
       onWrong(teamIdx)      a team missed it — return true if the game opened a
                             steal and will finish the beat itself, false to let
                             the shared path close the question as before

     Hooks run only while their game is the active one, so none of them needs to
     check. Registration order is the order the cards appear on the game screen. */
  /* The registry lives in `hub-games.js` now — loading before the game files and
     before this engine, the `hub-rounds.js` → `rounds/*.js` → engine pattern. The
     six built-ins still declare themselves below because their logic shares this
     closure; an external game file registers into the same registry and the
     engine, loading last, consumes everything already registered. */
  if(!window.HubGames) throw new Error('hub-games.js must load before hub-engine.js');
  const GAMES = window.HubGames.all();
  const registerGame = def => window.HubGames.register(def);
  const HUB_GAME_TITLES = window.HUB_GAME_TITLES;

  const gameDef  = id => window.HubGames.get(id === undefined ? activeGame : id);
  const gameIds  = () => GAMES.map(g => g.id);
  /* Run a hook on the game being played. Every call site used to be an if-chain
     that a new game had to be threaded into by hand. */
  function hook(name, ...args){
    const g = gameDef();
    return (g && typeof g[name] === 'function') ? g[name](...args) : undefined;
  }

  /* The four games. Hooks call functions defined further down the file — they run
     at play time, not at registration, so the ordering is fine and each game's
     declaration can sit here where all four can be compared side by side. */
  registerGame({
    id:'jeopardy', title:'Jeopardy',
    /* A tile is answered by whoever is on turn, and one person is as good a turn
       as four — nothing on this board assumes several handsets behind a name. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="9" height="7" rx="1"/><rect x="15.5" y="6" width="9" height="7" rx="1"/><rect x="27" y="6" width="9" height="7" rx="1"/><rect x="4" y="16.5" width="9" height="7" rx="1"/><rect x="15.5" y="16.5" width="9" height="7" rx="1"/><rect x="27" y="16.5" width="9" height="7" rx="1"/><rect x="4" y="27" width="9" height="7" rx="1"/><rect x="15.5" y="27" width="9" height="7" rx="1"/><rect x="27" y="27" width="9" height="7" rx="1"/></svg>',
      blurb:'Category board, five point values each. Teams pick a tile, answer, bank the points.',
      badge:'Best for: mixed vocab &amp; grammar' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'JEOPARDY',
            sub:'Pick your category. Pick your price. Answer it.', accent:'#4FC3FF' },
    hasBank: u => (u.jeopardyCategories||[]).length > 0,
    load(u){ JEOPARDY_SECTION_LABELS = u.jeopardySectionLabels || {};
             JEOPARDY_CATEGORIES     = u.jeopardyCategories || []; },
    bank: () => JEOPARDY_CATEGORIES.reduce((a,c)=> a.concat(c.clues||[]), []),
    // scores in hundreds: corrections nudge by 100, payouts round to 50
    nudgeStep: 100, payStep: 50,
    onSetting(id){
      if(id==='jTogether' || id==='jTarget' || id==='jRules'){ renderClassLine(); hook('onResize'); }
      /* Changing the ruleset mid-board reaches the board. Planting only among the
         unplayed tiles is what keeps that honest — see jPlantDailyDoubles. */
      if((id==='jDailyDoubles' || id==='jRules') &&
         document.getElementById('screen-play').classList.contains('active')) jPlantDailyDoubles();
      if(id==='jHints') renderHintButton();
    },
    renderContent: renderJeopardyContent,
    startButton:   jeopardyStartButton,
    start(){ buildJeopardyBoard(); timerSetDuration(30); },
    /* The clue card is the question in both tile games, so both answer these the
       same way — shared by coincidence of mechanism, not by inheritance. */
    expects:     () => (currentClueItem && currentClueItem.answer) || '',
    phonePrompt: () => (currentClueItem && currentClueItem.text) || '',
    /* A Daily Double belongs to the team that found it — no race, no phones — and a
       wager is being placed on the board rather than answered in the room. Saying so
       here is what stops a reconnection re-arming the buzzers mid-bet: `askingNow`
       is the one place that decides whether a question is open to the room. */
    askingNow:   () => clueIsOpen() && jDoubleTeam == null && !jWager,
    /* A Daily Double is answered by the team that found it, alone: no race to win,
       so a buzz already in flight when the wager opened is refused rather than
       taking a floor that does not exist. A grouping clue refuses for the opposite
       reason — every team is playing it at once, and there is no floor to take. */
    buzzEntitled: () => jDoubleTeam == null && !jWager && !roundLive(),
    /* The final clue is the one beat of Jeopardy where every team answers at once,
       privately, against the clock — that is the whole mechanic, and a buzzer would
       hand it to one thumb. So the game owns the round while it runs, exactly as
       Bingo owns it while the cards are in their hands, and `phoneMode` picks up
       again afterwards. */
    phoneRound(){
      /* A grouping clue owns the round for the same reason: it *is* the phone
         dynamic, so the mode has nothing to say about eight words to assemble. */
      if(roundLive()) return roundForPhones();
      if(!jFinalState || !jFinalState.asking) return null;
      return { mode:'write',
               prompt: S.get('phonePrompt', 'jeopardy') ? (jFinalState.clue.q || '') : '' };
    },
    /* A room is worth having open for a grouping clue even at `phoneMode: off`, the
       same shape as Millionaire's Ask the class and Bingo's cards — and the chip has
       to say so, because "idle here" reads as "don't bother joining" to a room that
       is about to be handed eight words. */
    wantsVote:   () => roundLive(),
    roomNote:    () => roundLive() ? 'find the group' : null,
    onVoteReply(all){ roundOnReplies(all); },
    // the buzz decides who answers, so it selects that team: the teacher stops
    // being the one who chooses, which is the whole point of buzzing for a tile
    /* A plain buzz starts the answer clock; a typed one does not — the typed word
       has already been judged by the time the floor is taken, so there is nothing
       left to time. */
    onBuzzTaken(b){ if(teams[b.team]){ active = b.team; renderScorebar(); }
                    if(b.value == null) jClockStart(); },
    onTypedWin(b){ return currentClueItem ? (jCorrect(b.team) || 1) : null; },
    fit:      fitJeopardyBoard,
    deal:     jDeal,
    tension(){ jTension(); },
    onResize: fitJeopardyBoard,
    onWrong:  jOfferSteal
  });

  registerGame({
    id:'blockbusters', title:'Blockbusters',
    /* **Two routes across the board, and any number of people on them.** `bbSideOf`
       is index parity and has split four teams into two alliances since the day this
       board seated more than two — individuals need nothing new. Points stay yours;
       the line belongs to your half of the room, which is the one place on any board
       where solo and team play are the same game. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4 L33 11.5 L33 26.5 L20 34 L7 26.5 L7 11.5 Z"/><path d="M20 13 L26 16.5 L26 23.5 L20 27 L14 23.5 L14 16.5 Z"/></svg>',
      blurb:'Hexagon board. Yellow connects left&rarr;right, Blue connects top&rarr;bottom, by answering letter clues.',
      badge:'Best for: single-word / short-answer vocab' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'BLOCKBUSTERS',
            sub:'Yellow goes across. Blue goes down. Build your line.', accent:'#C77DFF' },
    hasBank: u => (u.blockbustersBank||[]).length > 0,
    fitsScreen: false,        // this board scales around the banner rather than fitting
    load(u){ BLOCKBUSTERS_BANK          = u.blockbustersBank || [];
             BLOCKBUSTERS_SECTION_NAMES = u.blockbustersSectionNames || {};
             BLOCKBUSTERS_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => BLOCKBUSTERS_BANK,
    /* The *team* on turn — only the side index while there are two teams; with
       four it rotates within each side. And every chip wears its side's colour,
       because a hexagon belongs to a side while points belong to a team. */
    turnTeam: () => bbTeamOnTurn(),
    teamDecor: i => `<span class="dot" style="background:${bbSideOf(i)===0?'var(--yellow)':'var(--blue)'}"></span>`,
    renderContent: renderBlockbustersContent,
    startButton:   blockbustersStartButton,
    start(){
      pool = shuffle(BLOCKBUSTERS_BANK.filter(inPlay));
      pool = pool.slice(0, BB_TOTAL);
      buildBlockbustersBoard();
      bbTurn=0; bbSideAt=[0,0]; renderBBTurn(); bbClearOutcome();
      bbVote=null; bbVoting=false; renderBBVote();
      timerSetDuration(30);
    },
    expects:     () => (currentClueItem && currentClueItem.answer) || '',
    phonePrompt: () => (currentClueItem && currentClueItem.text) || '',
    askingNow:   () => clueIsOpen(),
    onBuzzTaken(b){ if(teams[b.team]){ active = b.team; renderScorebar(); } },
    onTypedWin(b){ return currentClueItem ? (claimHex(b.team) || 1) : null; },
    /* Two completely different questions can be open on these handsets, and only one
       at a time: the round in the clue card, or the team choosing which hexagon to
       attack. `openBlockbustersClue` ends the vote before it opens a round, so they
       are mutually exclusive by construction — but the round is asked first anyway,
       because it is the one that owns the card. */
    wantsVote:   () => roundLive() || !!S.get('bbTeamVote', 'blockbusters'),
    /* **The replies have to come back in, not just go out.** Arming the phones for a
       round and never routing what they send is silent: the handsets look right, the
       card looks right, and every tap is dropped on the floor. That is exactly what
       shipped when this board became a round host — `phoneRound()` was declared and
       this was not. */
    onVoteReply(all){
      if(roundLive()){ roundOnReplies(all); return; }
      if(bbVote){ bbVote.apply(all); renderBBVote(); }
    },
    /* A hexagon can open a round, and a round owns the handsets while it runs —
       the same reason Jeopardy's tile does. The mode is not consulted, because
       what the phones are put into *is* the question here. */
    phoneRound(){ return roundForPhones(); },
    // the vote button names the team on turn, and the room arrives after the board
    onRoomReady(){ renderBBVote(); },
    fit:      layoutBlockbustersBoard,
    deal:     bbDeal,
    tension(){ bbTension(); },
    onResize: layoutBlockbustersBoard
  });

  registerGame({
    id:'race', title:'Race to the Board',
    /* Two people at the screen is what this board *is*, so individuals suit it
       better than teams do. The one rough edge is the claim chooser — with sixteen
       people the teacher picks from sixteen chips — and phones in `type` mode remove
       it outright, because a typed word already carries who produced it. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="6" rx="1.5"/><rect x="21" y="9" width="15" height="6" rx="1.5"/><rect x="5" y="20" width="15" height="6" rx="1.5"/><rect x="24" y="24" width="12" height="6" rx="1.5"/><path d="M13 36 L20 30 L27 36"/></svg>',
      blurb:'Target words scattered on screen. Read the sentence aloud &mdash; a student runs up and touches the missing word.',
      badge:'Best for: getting them out of their seats' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'RACE TO THE BOARD',
            sub:'On your marks. Listen for the gap. Get there first.',
            accent:'#3DFFA8', titleVw:'6.4vw' },
    hasBank: u => (u.raceBank||[]).length > 0,
    load(u){ RACE_BANK          = u.raceBank || [];
             RACE_SECTION_NAMES = u.raceSectionNames || {};
             RACE_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => RACE_BANK,
    // head-to-head has no "whose turn" — both teams are at the board at once
    turnTeam: () => raceMode==='h2h' ? -1 : active,
    onSetting(id){
      if(id==='raceShowSection' && raceCurrent) setRacePrompt(raceCurrent);
      if(id==='raceRoundSeconds' && raceMode==='timed' && !raceRunning){
        timerSetDuration(Number(S.get('raceRoundSeconds', 'race')) || 60);
      }
    },
    renderContent: renderRaceContent,
    startButton:   raceStartButton,
    start(){
      buildRaceBoard();
      syncBuzzRoom();
      timerSetDuration(Number(S.get('raceRoundSeconds', 'race')) || 60);
    },
    expects:     () => (raceCurrent && raceCurrent.answer) || '',
    phonePrompt: () => (raceCurrent && raceCurrent.prompt) || '',
    askingNow:   () => !!raceCurrent,
    // a team that has already missed this sentence cannot buzz back in on it
    buzzEntitled: b => raceCanTry(b.team),
    /* **The two wires a phone dynamic needs, and declaring one looks exactly like
       declaring both.** Blockbusters shipped with only the first and every tap was
       dropped on the floor with nothing anywhere saying so. */
    phoneRound(){ return roundForPhones(); },
    wantsVote:   () => roundLive(),
    onVoteReply(all){ if(roundLive()) roundOnReplies(all); },
    /* The typed word is the claim here too, and awarding it deals the next sentence
       — so this returns *after* the award and the engine names the student on the
       strip, which outlives the re-arm. */
    onTypedWin(b){
      if(!raceCurrent) return null;
      const w = raceWords.find(x => x.word === raceCurrent.answer);
      if(!w || w.found) return null;
      const el = [...document.querySelectorAll('#race-words .race-word')]
                   .find(n => n.textContent === w.word) || null;
      Sound.play(document.getElementById('play-race').classList.contains('lit') ? 'sting' : 'correct');
      racePending = { w, el };
      awardRaceWord(b.team, el);
      return 1;
    },
    fit:      scatterRaceWords,
    deal:     rDeal,
    tension(){ rTension(); },
    onResize(){ if(raceWords.length) scatterRaceWords(); },
    onTimerEnd(){ if(raceMode==='timed' && raceRunning) endRaceRound(false); }
  });

  registerGame({
    id:'millionaire', title:'Millionaire',
    /* **It draws one ladder, not one per competitor** — `renderMillionaire` reads
       `mTeamState(active)`, so twenty-five people is twenty-five *stored* ladders
       and one on screen. This was excluded on the assumption that it drew them all,
       which reading the code disproved. What is true is that turns rotate, so with a
       big class each person answers rarely — a pacing warning, not a broken board,
       and the game card says so. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 34 L8 26"/><path d="M16 34 L16 20"/><path d="M24 34 L24 14"/><path d="M32 34 L32 7"/><path d="M4 34 L36 34"/></svg>',
      blurb:'Four options, rising difficulty. Teams climb their own ladder, with 50:50, Ask the class and Confer to spend.',
      badge:'Best for: spotting the near-miss answer' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'MILLIONAIRE',
            sub:'Eight rungs. One team at a time. No safety net.', accent:'#FFC83D' },
    hasBank: u => (u.millionaireBank||[]).length > 0,
    load(u){ MILLIONAIRE_BANK          = u.millionaireBank || [];
             MILLIONAIRE_SECTION_NAMES = u.millionaireSectionNames || {};
             MILLIONAIRE_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => MILLIONAIRE_BANK,
    // scores in hundreds: corrections nudge by 100, payouts round to 50
    nudgeStep: 100, payStep: 50,
    renderContent: renderMillionaireContent,
    startButton:   millionaireStartButton,
    start(){ buildMillionaire();
             timerSetDuration(Number(S.get('mConferSeconds', 'millionaire')) || 30); },
    expects:     () => (mCurrent && mCurrent.q && mCurrent.q.answer) || '',
    phonePrompt: () => (mCurrent && mCurrent.q && mCurrent.q.prompt) || '',
    askingNow:   () => !!(mCurrent && !mAnswered),
    /* **No buzz hooks, and that is a statement rather than an omission.** This board
       used to answer `buzzEntitled` and `onBuzzTaken` against `mBuzzRole`; the ladder
       hosts a round now, so a live question puts the four options in every hand and
       there is no buzzer to be entitled to. Between questions `askingNow()` is false
       and the engine disarms. Both hooks default to a no-op, which is the correct
       state here — see the note where `mBuzzRole` was dropped. */
    // no onTypedWin: typing is not offered here, for the same reason it never gets
    // an anagram — the four options hand you the word
    /* Every question is a round now, so the handsets are the round's for the whole
       of it. Declaring `phoneRound` without `onVoteReply` is the failure that shipped
       on Blockbusters: the room arms correctly and every tap lands on the floor. */
    phoneRound(){ return roundForPhones(); },
    asRound:     q => mAsRound(q),
    /* Ask the class disables itself with no room to reveal from, and this board
       deals its first question inside `start()` — before the code has come back.
       Without this repaint a lesson opening here found the lifeline greyed out
       for the whole first question. */
    onRoomReady(){ renderMillionaire(); },
    wantsVote:   () => roundLive() || !!S.get('mLifelines', 'millionaire'),
    roomNote:    () => roundLive() ? 'pick an answer' : null,
    onVoteReply(all){ if(roundLive()) roundOnReplies(all); },
    fit:      fitMillionaire,
    tension(){ mTension(); },
    onResize: fitMillionaire
  });

  /* ---------- which boards can host a round ----------
     A round is drawn in the shared clue card, so it is literally the same code
     whichever board opened it. What differs is only what the *host* contributes,
     and it comes to four facts: whose settings scope it, which modal mode it
     belongs to, which stage is lit (so the sting only plays under the skin), and
     what a team taking it is worth.

     Declared rather than branched, so the adapter further down never learns the
     name of the game it is running inside — which is what made a second host cheap
     rather than a rewrite. A third one is an entry in this table.

     **It sits up here so the settings below can be derived from it**, rather than
     from a list of game names typed out a second time. `games: gameIds()` was
     exactly that mistake once and it made the fifth game a second-class citizen;
     anything that names the games is a bug waiting for the next one.

     `win` returns what it paid, because the phone strip names the student *and*
     the amount, and a tile and a hexagon are worth completely different things.
     Everything it references is either a hoisted function or read at call time, so
     the table can be declared before any of it exists. */
  /* **Where the round is drawn is the host's, not the adapter's.** Two of these open
     the shared clue card; Millionaire has no card at all and draws its question
     inline on its own stage, so the mount is a declared fact like everything else.
     `render(mount, s, ctx)` always took a mount — it was the adapter that assumed
     which one, which is what made "a round on a stage" look like a contract change
     when it is really one more row in this table.

     `live()` replaced `modalMode === modal` for the same reason: a game with no
     modal could never answer that question. `commit` names the button that judges
     what the teacher has picked, because Millionaire's is its own "Final answer?"
     rather than the clue card's Check. */
  const CARD_MOUNT = () => {
    const text = document.getElementById('clue-text');
    let host = document.getElementById('clue-group');
    if(!host || host.parentNode !== text){
      if(host) host.remove();
      host = document.createElement('div');
      host.id = 'clue-group'; host.className = 'clue-group';
      text.appendChild(host);
    }
    return host;
  };
  const ROUND_HOSTS = {
    jeopardy: {
      game:'jeopardy', stage:'play-jeopardy',
      mount: CARD_MOUNT, commit:'group-btn',
      live: () => modalMode === 'jeopardy',
      turn: () => active,
      win:  team => jCorrect(team),
      /* **What the question is worth to a team that was not first** — see
         `roundOpenToAll`. The tile is the slot and the slot pays in full; this is
         what is left for everybody else who still got there. Rounded to 50 like
         everything else on this board, because `award` already rounds a steal that
         way and two roundings that disagree is a card saying one number and a
         scoreboard showing another. */
      worth: () => currentClueValue,
      /* The board's payout unit, read from the game's own `payStep` rather than
         re-typed here — so this and `award` (which rounds through the same
         `payStep`) can never disagree about a number the room is looking at. */
      step:  () => gameDef('jeopardy').payStep,
      /* Which of a round's modes suits *this board*, when that differs from the
         round's own first choice. Jeopardy is team-based — a tile is a team's
         answer, not a thumb's — so a multiple choice here waits for the whole
         team to agree rather than paying the fastest tap, and the ordering
         ladder is a ladder *each*: on a board where teams compete for a tile,
         one shared ladder reads as a single ladder however many teams there are.
         Declared facts, not stored values: the teacher's ⚙ row still overrides
         them, and the panel says they are this board's own defaults. */
      /* **This board is team-based, so every round it hosts waits for the whole
         team.** A tile is a team's answer rather than a thumb's: with first-tap-wins
         the fastest student takes it and the other three never have to commit to
         anything, which is the opposite of the lesson. Asked for as one fact rather
         than named per round — each round declares which of its modes is the
         whole-team one (`teamMode`), so a round written next month arrives on this
         board already playing the way the board wants. The list this replaced had
         to be added to by hand, with nothing complaining if you missed a round. */
      teamMode: true,
      /* The rounds that are not that shape, so they are still named. Ordering's
         modes ask *how many ladders*, not *who has to agree* — and on a
         team-vs-team board a shared climb reads as a single ladder however many
         teams are playing, which is exactly how it was reported.

         **The drag rounds default to `first`, and a classroom decided it.** In
         `agree`, every member must independently build the identical word and the
         card only lights a letter the whole team holds — so a team that split the
         work "completed the word and it was not displayed", twice in one lesson,
         and the students named the drag rounds the ones they disliked because
         they are hard. First-member-with-it keeps the race and lets a team divide
         the labour; a teacher who wants the argument back has the ⚙ row. */
      /* The drag rounds carried `first` here for one day, from the ef-2a class
         report ("a team that split the spelling looked like it had done nothing").
         The user tested it and chose the agreement dynamic back: one phone's
         letters lighting the card alone reads worse than the invisible-word cost,
         which the room bench's mode row can trade away per lesson. */
      modeDefaults: { ordering:'race' }
    },
    blockbusters: {
      game:'blockbusters', stage:'play-blockbusters',
      mount: CARD_MOUNT, commit:'group-btn',
      live: () => modalMode === 'blockbusters',
      /* Whose turn it is here is the team whose *side* is up. A four-team class
         plays as two alliances, so the round belongs to whoever is actually at the
         board rather than to `active`, which follows the last buzz. */
      turn: () => bbTeamOnTurn(),
      /* A hexagon is worth what the board says a hexagon is worth — the floor is
         there because a round that paid nothing would read as not having counted. */
      win:  team => claimHex(team) || 1,
      /* A hexagon is one point, and a point is the smallest thing this board has —
         so a team that gets there second is paid the same 1. That is not the floor
         failing, it is the board having no smaller unit: what being first buys here
         is the *square*, which is what wins the game, and no amount of points is
         that. Declared rather than left out so the row exists to be tuned. */
      worth: () => 1,
      step:  () => 1,
      /* **This board is team-based too, and it had been playing as though it were
         not.** Jeopardy declared this and Blockbusters did not, so every round here
         fell to its own first mode — first tap wins — which on a yellow-versus-blue
         board means the fastest thumb on the side that is up answers while the rest
         of their alliance never has to commit to anything. That is the exact
         objection that put the declaration on Jeopardy; there was no reason for the
         two to differ, only an omission. Ordering is *not* named here the way it is
         on Jeopardy: only one side is at the board at a time, so a shared climb
         reads as the one ladder it is. The drag rounds wore `first` here for one
         day — reverted with Jeopardy's, the user's call after testing. */
      teamMode: true
    },
    millionaire: {
      game:'millionaire', stage:'play-millionaire',
      /* No clue card: the options are the stage. This is F3.8.9 — a round handed a
         mount that is not the card — and it cost this line plus honouring it below. */
      mount: () => document.getElementById('m-options'),
      commit:'m-final',
      /* A question is on screen and has not been answered. There is no modal to ask
         about, which is exactly why `modalMode` could not stay the test. */
      live: () => !!mCurrent && !mAnswered,
      /* The team the question was dealt to — which is not `active` after a steal,
         and the steal is precisely when the difference matters. */
      turn: () => (mCurrent ? mCurrent.team : active),
      scorer: () => (mCurrent ? mCurrent.team : active),
      win:  team => mPayRung(team),
      /* The rung the team being paid is standing on — read per team, because every
         competitor climbs its own ladder here and "what this question is worth" is
         a different number for each of them. */
      worth: team => M_LADDER[Math.min(mTeamState(team == null ? active : team).rung,
                                       M_LADDER.length - 1)],
      // the board's payout unit, read from the game's own payStep (see Jeopardy's host)
      step:  () => gameDef('millionaire').payStep,
      /* The class votes on every question now, so the counts exist from the first
         tap. Holding them back is what leaves Ask the class worth spending. */
      hideVotes: () => !mTally,
      /* Ask the class is about the whole room, not about which team said what —
         there is only one team answering at a time on this board anyway. */
      countVotes: () => true,
      commitText: () => 'Final answer?',
      repaint: () => mSayHint(),
      autoCommit: () => !S.get('mFinalAnswer', 'millionaire'),
      /* On this board a wrong answer ends the go — the steal, then the rung stands.
         Every other host lets one cost nothing but the time. */
      miss: team => mMissed(team)
    },
    /* **The fifth host, and the one the build order kept last for a reason.** Race
       owns the *card* — the scattered words are the answer surface — so a round
       here cannot open a clue over the board the way Jeopardy's tile does. It gets
       the prompt strip as its mount instead, which is the same declared fact
       Millionaire and Quickfire use, and the board sits idle for that one question.

       That is the honest shape of it: a Race bank can hold both kinds. An ordinary
       item puts its answer on the board as a tile and a student runs to touch it; a
       round item has no single answer, so it contributes no tile and is played on
       the handsets instead. Mixing them is a teaching decision — a burst of running
       broken by a question the whole room assembles — and nothing here forces it. */
    race: {
      game:'race', stage:'play-race',
      mount: () => document.getElementById('race-round'),
      commit:'race-commit',
      live: () => !!raceCurrent && raceRunning !== false && roundClue(),
      turn: () => active,
      /* A word is worth a point on this board, so a round is worth a point. Paid
         through the same path a touched word is, which is what makes the strip, the
         streak and the scoreboard all follow without this knowing about any of it. */
      win:  team => { awardRaceRound(team); return 1; },
      /* Same as a hexagon: a word is one point and there is nothing smaller. */
      worth: () => 1,
      step:  () => 1,
      /* Two people at the screen, and in head-to-head nobody is on turn — so a round
         here is the whole room's, exactly as a Connections tile is. */
      teamMode: true
    }
  };
  /* An external game file cannot edit the table above, so it declares its entry —
     `roundHost` on its registration — and it is merged here, before ROUND_GAMES
     and the round settings derive from the table. Game files load before this
     engine (the rounds pattern), so every declaration is already in. */
  window.HubGames.ids().forEach(g => {
    const d = window.HubGames.get(g);
    if(d && d.roundHost && !ROUND_HOSTS[g]) ROUND_HOSTS[g] = d.roundHost;
  });
  const ROUND_GAMES = Object.keys(ROUND_HOSTS);
  let roundHost = ROUND_HOSTS.jeopardy;

  /* ---------- how a question's points are split ----------
     **Four rules, written once each, and a board picks one.** This is the answer to
     "how does each skin score differently" and the answer is deliberately *not* a
     function per game: five boards each doing their own arithmetic is the hand-kept
     list this project has paid for more than any other, and it would leave a teacher
     unable to try a different feel without somebody editing code. A board names its
     starting rule, `roundPay` is a settings row, and switching Jeopardy to `equal`
     mid-lesson for a class that is finding it brutal is two taps on the room bench.

     **They live here rather than in a round**, because a round may not score — that
     is the one rule keeping a round portable. And not on `Kit`, because what a
     question is worth is the *skin's* business.

     `rows` is `Kit.round.results.finished()` — who got there, in order, each carrying
     how much clock was left when they did. `baseFor(who)` is the host's `worth()`,
     asked per competitor because a Millionaire rung is a different number for each of
     them. What comes back is `{ who: points }` and nothing else: no board work, no
     turns, no tiles.

     **The fifth rule goes in this table.** Not into a game. */
  const PAY_RULES = {
    winner: {
      label:'Winner takes all — only the first to get it scores',
      pay(rows, baseFor, o){
        return rows.length ? { [rows[0].who]: payRound(baseFor(rows[0].who), o.step) } : {};
      }
    },
    podium: {
      /* The rule the whole change was for: until results carried a *position*,
         nothing anywhere could see that somebody came third. */
      label:'Podium — first, second and third all score, less each time',
      pay(rows, baseFor, o){
        const share = [1, o.second, o.third];
        const out = {};
        rows.slice(0, 3).forEach((r, i) => {
          const v = payRound(baseFor(r.who) * share[i], o.step);
          if(v > 0) out[r.who] = v;
        });
        return out;
      }
    },
    clock: {
      /* Kahoot's own curve, chosen rather than invented: full marks for an instant
         answer, `floor` of it for one arriving as the clock dies. It rewards knowing
         over guessing without making a slow right answer worthless.

         **With no clock running it pays the floor, flat** — which is every board but
         Quickfire, where a tile is read out at the teacher's pace and there is no
         fraction to decay against. What is left to say there is "you got there, but
         not first", and that is exactly the floor. */
      label:'By the clock — everyone right scores, and faster is worth more',
      pay(rows, baseFor, o){
        const out = {};
        rows.forEach(r => {
          const frac = Kit.round.clock.running() ? r.fraction : 0;
          out[r.who] = payRound(baseFor(r.who) * (o.floor + (1 - o.floor) * frac), o.step);
        });
        return out;
      }
    },
    equal: {
      /* No speed advantage at all. For a class where the race is the thing putting
         students off answering — which is the case this whole change exists for, and
         the fastest way to find out whether it is true of a given group. */
      label:'Everyone right scores the same',
      pay(rows, baseFor, o){
        const out = {};
        rows.forEach(r => { out[r.who] = payRound(baseFor(r.who), o.step); });
        return out;
      }
    }
  };

  /* Rounded to the board's own unit, because a scoreboard reading 92 and 87 is
     arithmetic nobody at the back of a room can follow. Never below one unit: a right
     answer that pays nothing reads as not having counted. */
  function payRound(v, step){
    const s = Number(step) || 1;
    return Math.max(s, Math.round(v / s) * s);
  }

  /* What each competitor is paid for this question, whichever rule is running. One
     definition, so the standings screen and the payout can never disagree about a
     number the room is looking at. */
  function roundPayout(host){
    const h = host || roundHost;
    const rule = PAY_RULES[S.get('roundPay', h.game)] || PAY_RULES.winner;
    const baseFor = who => (h.worth ? Number(h.worth(who)) || 0 : 0);
    return rule.pay(Kit.round.results.finished(), baseFor, {
      step:   h.step ? (Number(h.step()) || 1) : 1,
      floor:  Number(S.get('roundPayFloor',  h.game)),
      second: Number(S.get('roundPaySecond', h.game)),
      third:  Number(S.get('roundPayThird',  h.game))
    });
  }

  /* One definition of "this board runs its questions against a clock", asked of the
     host rather than of the game's name, so a seventh board answers it by declaring
     one fact. `clock` is a function because the seconds come from a ⚙ range a teacher
     can move between questions. */
  function roundClockSecs(host){
    const h = host || roundHost;
    return h && h.clock ? (Number(h.clock()) || 0) : 0;
  }

  /* ---- feature switches. Adding a feature? Register it here and the settings
     panel picks it up automatically — there is no panel markup to edit. ---- */
  S.register({ id:'sound', group:'Sound', type:'toggle', default:true, games:'*',
    label:'Sound effects', help:'Short tones for a right answer, a wrong one, and a cleared board.' });
  S.register({ id:'soundVolume', group:'Sound', type:'select', default:'med', games:'*',
    label:'Volume', help:'Classroom speakers are usually louder than they sound at your desk.',
    options:[{value:'quiet',label:'Quiet'},{value:'med',label:'Medium'},{value:'loud',label:'Loud'}] });
  /* The music bed is the one sound that runs *continuously* under a live question,
     so it is the one a teacher may want gone while keeping the cues. Volume alone
     could not do that — turning it down takes the right-answer tone with it. */
  S.register({ id:'musicBed', group:'Sound', type:'select', default:'normal', games:'*',
    adv:true, label:'Background music', help:'Music that plays under a question nobody has answered yet. Off leaves every other sound alone.',
    options:[{value:'normal',label:'On'},{value:'quiet',label:'On, quieter'},{value:'off',label:'Off'}] });

  /* ---- phones: one mode, not four switches ----
     These began as four independent toggles and immediately contradicted each
     other — with typing and buzzing both on, one had to silently win, and it was
     decided by a hard-coded precedence nobody could see. A dynamic is a *choice*
     between iterations, so it is one variant with named values: pick one, compare
     it against another next round, no combination that means nothing.

     A variant may name the games it suits, so a dynamic only appears on the boards
     it works on.

     Voting is *not* one of these values, deliberately. It is not an alternative to
     buzzing or typing — it is what the phones do for the few seconds Ask the class
     is running, and then they go back to whatever mode says. Making it a mode meant
     choosing between a class that can buzz and a class that can vote, when the
     Millionaire round wants both at different moments. So the mode is what the
     phones do *for a question*, and the lifeline borrows the room. */
  /* `phoneMode` used to be registered here, by hand, with its four values written
     out. It is `round_default` now and the row is built from what the default round
     declares — same loop, same shape as `round_grouping`. See `rounds/default.js`
     and the registration block below. */

  /* Two weights for the typing race, both here rather than in the source because
     the right numbers are a classroom question. A wrong answer costs *time*, never
     points — long enough to hurt, short enough that they stay in the round. */
  S.register({ id:'typeCooldown', group:'Phones', adv:true, type:'range', default:3,
    min:0, max:10, step:0.5, unit:'s', games:'*',
    label:'Wait after a wrong buzz',
    help:'How long that phone is out before it can buzz again. Nobody loses points; they lose the race.' });

  S.register({ id:'typeStrict', group:'Phones', adv:true, type:'toggle', default:false,
    games:'*',
    label:'Spelling has to be exact',
    help:'Off: a near miss takes the floor and the phone is told to check its spelling. On: only the exact word counts.' });

  S.register({ id:'phoneOneEach', group:'Phones', type:'toggle', default:true,
    games:'*',
    label:'One answer each per question',
    help:'A student who has answered cannot answer again until the next question. Stops the fastest thumbs owning the game.' });

  S.register({ id:'phonePrompt', group:'Phones', type:'toggle', default:true,
    games:'*',
    label:'Show the question on the phones',
    help:'The back of the room reads its own screen. Off keeps their eyes on the board.' });

  /* The migrations that used to sit here — three booleans into `phoneMode`, and
     the retired `vote` value — moved below the round-setting registration, because
     both now write `round_default` and `S.set` cannot write an id that has not been
     registered yet. Same trap `migrateRoundSettings` already carried a note about. */

  /* ---- competitive dynamics ----
     All per-game, so a teacher can run steal in Jeopardy and not in Blockbusters and
     compare. **Nothing here ever deducts points**: a steal transfers the chance, not
     the score, which keeps the decision recorded in the Millionaire section below
     (never taking anything away) true of the whole app.

     Steal and keep-control default ON — they only add ways to score, and between
     them they fix the thing that most flattens a room: nothing being at stake when
     it is not your turn. The streak defaults off because it changes how big the
     numbers get, which is a taste question. */
  /* Named games rather than '*', deliberately: a steal is a question passing to the
     other team, and Bingo has no such beat — a wrong tap costs nothing and the call
     stays open for everybody. Divergence by declaration is the point; the bug is
     only when a list is standing in for "all of them". */
  S.register({ id:'stealOnWrong', group:'Competition', type:'toggle', default:true,
    games:['jeopardy','blockbusters','millionaire','race'],
    label:'Steal on a wrong answer',
    help:'A missed question passes to the other team for one shot at the points. Off: a wrong answer simply ends the question, as before.' });

  /* Only the two games that score in values: a Blockbusters hex is one point and a
     Race word is one word, so halving them has nothing to halve. */
  S.register({ id:'stealFullValue', group:'Competition', under:'stealOnWrong', type:'toggle', default:false,
    games:['jeopardy','millionaire'],
    label:'Steal pays the full value',
    help:'As the show plays the rebound — a stolen question earns everything it was worth. Off: a steal pays half, so the miss still cost something.' });

  /* ---- Jeopardy's classic rules ----
     The TV game has three things this board never had: a hidden tile you bet on
     before seeing the clue, a final clue everyone wagers on, and a wrong answer
     that costs you. They are separate switches because they are separately useful
     — but `jRules` sets all three at once, because "play it like the show" is one
     decision a teacher makes, not three. */
  S.register({ id:'jRules', group:'Jeopardy', type:'variant', default:'hub', games:['jeopardy'],
    label:'Rules',
    help:'A whole way of playing, including what the phones do. Picking one writes the switches below — so they always say what will actually happen, and you can still change any of them afterwards.',
    variants:[
      {value:'hub',      label:'Hub — nothing is ever taken away'},
      {value:'classic',  label:'Classic — as the show plays it'},
      {value:'together', label:'Together — the class against the board'}
    ] });

  /* ---- Together: the class against the board ----
     Every other ruleset here sets teams against each other. This one sets the room
     against a number, which is a different feeling in a classroom and suits a group
     that competition makes anxious rather than sharp. Three switches, each useful on
     its own:

     - the scores pool, so nobody is behind;
     - there is a target to beat, so it is still a game;
     - the class can buy help, so being stuck has a way out that is not failure. */
  S.register({ id:'jTogether', group:'Jeopardy', type:'toggle', default:false, games:['jeopardy'],
    label:'The class plays as one',
    help:'Every team\'s points count toward a single class total, and the round ends against a target rather than by ranking the teams.' });

  S.register({ id:'jTarget', group:'Jeopardy', under:'jTogether', type:'range', default:60,
    min:0, max:100, step:5, unit:'%', games:['jeopardy'],
    label:'Target to beat',
    help:'How much of the board the class is aiming for. 0 turns the target off and the class simply collects what it can.' });

  S.register({ id:'jHints', group:'Jeopardy', type:'toggle', default:false, games:['jeopardy'],
    label:'Class can buy a hint',
    help:'A stuck class can buy the first letter, then the length. Each hint costs part of what the clue is worth — progress traded, not points taken.' });

  S.register({ id:'jHintCost', group:'Jeopardy', under:'jHints', type:'range', default:30,
    min:10, max:50, step:10, unit:'%', games:['jeopardy'],
    label:'What a hint costs',
    help:'Each hint takes this much off the value of the clue it is used on.' });

  /* A grouping clue is the one clue every team can genuinely play at the same time,
     and whether they should is a teaching decision rather than a number to tune —
     which is what makes it a variant. The whole room racing is the Connections
     dynamic and the reason the clue is worth having; the team on turn alone is the
     ordinary Jeopardy contract, and is the right answer for a class where one team
     is running away with it. Written as a switch because a choice between
     iterations is exactly what a variant is for, and the room bench is where a
     teacher tries the other one between rounds. */
  /* One row per round that offers ways to be played, built from what each round
     declares. The engine never learns what a mode *means* — it hands the chosen
     value back through `ctx.mode` and the round does the rest. Registered here with
     everything else, because a setting registered later than init is a row the
     panel has already been built without. */
  /* `Questions`, not `Jeopardy`, and the ids carry no game in them — a round is
     drawn in the shared clue card and every board that opens one hosts the same
     code. A group is a game's own when everything in it names exactly one game, so
     naming two is what puts these where they belong without a list anywhere. */
  /* A round may say how its own row should read. Every shaped round wants the same
     thing — offered to the boards that can host one, filed under Questions — so
     saying nothing gets that. The **default round** wants neither: it applies to all
     five games, because every game has phones, and it belongs beside the other phone
     switches where a teacher has always found it. Declared by the round rather than
     branched on here, or this loop would grow an `if (id === 'default')` and the next
     round like it would need a second one. */
  (Kit.round ? Kit.round.ids() : []).forEach(id => {
    const def = Kit.round.get(id);
    if(!def || !def.modes || !def.modes.length) return;
    const own = def.modeSetting || {};
    /* A host may declare which mode suits its board — the round says what modes
       exist, the skin says which one its geometry wants, and neither learns the
       other's business. Two ways to say it, and the general one comes second so a
       named exception always wins:

       `modeDefaults[id]` names a mode for one round, for a board with a reason
       peculiar to that round — Jeopardy's ordering ladder is the only one.

       `teamMode:true` says "this board is team-based, so give me whichever mode
       each round calls its whole-team one" (`teamMode` on the round). That is the
       one that scales: a round registered next month lands on the right mode with
       no host edited, where the per-round list had to be joined by hand.

       Both are checked against the round's own list, because a default naming a
       mode that does not exist would select nothing and look exactly like the
       setting being ignored. */
    const perGame = {};
    ROUND_GAMES.forEach(g => {
      const host = ROUND_HOSTS[g];
      const want = (host.modeDefaults || {})[id] || (host.teamMode ? def.teamMode : null);
      if(want && def.modes.some(m => m.value === want)) perGame[g] = want;
    });
    S.register({ id:'round_' + id, type:'variant',
      group: own.group || 'Questions',
      /* Team rules and whole-class rules are two different lessons, so how a
         round is played forks by room type: a change made while a solo room is
         up is the individuals' value, and individuals follow the team-room
         value until set apart. The storage and the row wording are the
         registry's (`byRoster` in hub-settings.js); this line only opts in. */
      byRoster: true,
      default: def.modes[0].value,
      defaults: Object.keys(perGame).length ? perGame : undefined,
      games: own.games || ROUND_GAMES,
      label: own.label || ('How ' + (def.label || id) + ' is played'),
      variants: def.modes.slice(),
      help: own.help || 'The same question played more than one way. These are different lessons rather than two speeds of the same one, so it is a teaching choice.',
      /* The row says what the room will actually play. In a room of individuals a
         whole-team mode resolves to the round's solo mode at play time
         (`roundModeOf` — "everyone agrees" is meaningless for a competitor of
         one), and a row that went on showing the team wording was the pane
         quietly disagreeing with the board beside it. Mirrors roundModeOf's
         conditions exactly, including the teacher's override outranking it. */
      stateNote: g => {
        if(!def.teamMode || !Roster.solo()) return null;
        if(S.get('round_' + id, g) !== def.teamMode) return null;
        if(S.hasOverride('round_' + id, g)) return null;
        const solo = def.modes.filter(m => m.value !== def.teamMode)[0];
        return solo ? 'A room of individuals — playing as “' + solo.label + '”' : null;
      } });
  });

  /* Only the boards where a round has a slot one team takes — Quickfire's
     `scoreEach` pays every team as it answers and its clock ends the question, so
     there is no single winning moment to announce. Derived from the host's own
     declaration rather than naming the game, so a seventh board sorts itself. */
  /* **This was the winner banner and is now the standings, so every board gets it** —
     including the ones with no slot to win, which is why the `scoreEach` filter came
     off. Quickfire is the board the movement matters most on: fifteen questions and
     nothing else punctuating them. */
  S.register({ id:'roundWinBanner', group:'Questions', type:'toggle', default:true, quick:true,
    games: ROUND_GAMES,
    label:'Standings between questions',
    help:'After each question, a screen naming who took it and showing everybody rising and falling. It waits for you rather than leaving on a timer. Off keeps the board on screen and says nothing.' });

  /* The standings open on the *old* order for a beat, then everybody glides to
     their new place — the movement itself, not only the arrows describing it. */
  S.register({ id:'standingsShuffle', group:'Questions', under:'roundWinBanner', type:'toggle', default:true,
    games: ROUND_GAMES,
    label:'Standings shuffle into place',
    help:'The screen opens showing the order before this question, holds a moment, then the rows slide to the new order. Off shows the new order at once.' });

  /* **How a question's points are split, and the whole answer to "custom behaviour
     per game".** A board names its starting rule through `defaults`, which ranks
     below a teacher's override and above the master — so Jeopardy opens on the podium
     and Quickfire on the clock without either holding any arithmetic, and the panel
     says in as many words that it is the game's own default rather than a control
     that silently does nothing. The variants are built from `PAY_RULES`, so a fifth
     rule is a table entry and this row grows on its own. */
  S.register({ id:'roundPay', group:'Questions', type:'variant', default:'winner',
    games: ROUND_GAMES,
    defaults:{ jeopardy:'podium', kahoot:'clock' },
    label:'How the points are split',
    variants: Object.keys(PAY_RULES).map(k => ({ value:k, label:PAY_RULES[k].label })),
    help:'Who scores when more than one team gets it right. The tile, hexagon or rung still goes to whoever was first — this is the points only.' });

  S.register({ id:'roundPaySecond', group:'Questions', under:'roundPay', when:'podium', type:'range', default:0.6,
    min:0.1, max:0.9, step:0.1, unit:'×', games:ROUND_GAMES,
    label:'Second place is worth',
    help:"Second place scores this share of the question's value." });
  S.register({ id:'roundPayThird', group:'Questions', under:'roundPay', when:'podium', type:'range', default:0.3,
    min:0.1, max:0.9, step:0.1, unit:'×', games:ROUND_GAMES,
    label:'Third place is worth',
    help:"Third place scores this share of the question's value." });
  S.register({ id:'roundPayFloor', group:'Questions', under:'roundPay', when:'clock', type:'range', default:0.5,
    min:0.1, max:0.9, step:0.1, unit:'×', games:ROUND_GAMES,
    label:'A last-second right answer is worth',
    help:"The least a right answer can score, as a share of the full value — and with no clock running, what every answer after the first is worth." });

  /* Offered only to the boards that *have* a slot to lock. Quickfire plays this way
     already and has nothing to switch, so a row there would be a control that reads
     as a choice and is not one. Derived from the host's own declaration, so a
     seventh board sorts itself.

     **On, now that there is something for the rest of the room to play for.** It
     shipped off for one build and the reason was honest then: holding the slot back
     changes a beat three boards have always had, and a right answer that was not
     first scored nothing worth having. With the podium and the standings screen there
     is now a reason to keep working after somebody else has it, which is the whole
     point of the change.

     It still costs the teacher a press — Reveal, then Close, where a won round used
     to take itself — and no class has met it. The switch is what puts the old race
     back, in one tap on the room bench. */
  /* **Forked by room type, and this one is not a formality.** Unlike the crowd
     reveal — which gates on room size, so ordinary team play never meets it — this
     applies identically in both rooms and the right answer genuinely differs. With
     three teams the race for the tile *is* the game, and first-takes-it is the beat
     three boards have always had. With sixteen individuals the same rule locks
     fifteen people out of a question they are half way through, which is the
     lockout this setting exists to remove. Individuals follow the team-room value
     until set apart, so nothing moves for anybody until a solo room chooses. */
  S.register({ id:'roundOpenToAll', group:'Questions', type:'toggle', default:true, quick:true,
    byRoster: true,
    games: ROUND_GAMES.filter(g => !ROUND_HOSTS[g].scoreEach),
    label:'Everyone finishes, not just the first',
    help:'A right answer stops closing the question. The first team still takes the tile at full value when you reveal; everyone else who gets there still scores, for less. Off is the old race.' });

  /* **The crowd reveal — what the room collectively knows fills in on the card.**
     Only in a big room (7+ competitors, where the lanes have stood down): a letter,
     word or rung appears once this share of the players who have started already
     have it, so nothing on the wall is any one player's answer. In a small room the
     lanes already show the dynamic — a team's correct letters are readable off its
     lane — so this stays out of the way there. The rule and the never-the-last-part
     cap live in `Kit.round.crowdKnown`; this row is only the number. */
  S.register({ id:'crowdReveal', group:'Questions', type:'range', default:40, quick:true, adv:true,
    min:0, max:90, step:5, unit:'%', games:'*',
    label:'Reveal what the room knows',
    help:'In a big room, a part of the answer fills in once this share of active players have it. 0 switches it off. Never the last part — that stays yours to reveal.' });

  /* The reveal's companion: one anonymous bar filling toward the next reveal —
     anticipation the room can watch without learning which part is coming. The
     rules (never per word, hidden at the cap, damped) live in
     `Kit.round.crowdMeter`; this row only switches the picture. */
  S.register({ id:'crowdMeter', group:'Questions', type:'toggle', default:true, quick:true,
    games:'*', under:'crowdReveal',
    label:'Meter toward the next reveal',
    help:'A bar on the card filling as the room converges on its next reveal, without saying which part. Hidden when nothing more can reveal. Needs the reveal above to be on.' });

  /* **The commit beat for a room of individuals.** A competitor of one has no
     agreement friction, so a tap is judged the instant it lands and a wrong tap
     costs nothing — which makes button-mashing the winning strategy on any tap
     round. Send is the friction: taps only select, the answer counts when the
     player commits it, and a wrong commit puts that phone alone on a countdown.

     **Solo only, gated in code rather than forked with `byRoster`** — the roster
     mode is already the live gate (the `crowdReveal` rule: check for an existing
     gate before forking). In a team room the live taps *are* the negotiation the
     lanes and the agreement fractions read, so Send there would starve the
     picture the mode exists for. These rows say so. */
  S.register({ id:'roundSend', group:'Phones', type:'toggle', default:true, quick:true,
    games:'*',
    label:'Individuals press Send',
    help:'In a room of individuals, taps only select — the answer counts when the player presses Send. Stops guess-and-check. Team rooms are never affected.' });
  S.register({ id:'roundSendCool', group:'Phones', type:'range', default:3, quick:true,
    min:0, max:15, step:1, unit:'s', games:'*', under:'roundSend',
    label:'Wrong answer wait',
    help:'A wrong Send locks that phone alone for this long, with the countdown in their hand. 0 is no wait. Individuals only.' });
  /* **What the reveal bar follows.** Off, it counts what the room has *committed*,
     which is what the commit beat made it: a selection costs nothing, so counting
     selections would turn the bar into a free oracle — choose, watch it twitch, then
     send what it told you. On, it counts what people currently have *selected*,
     which is livelier and is how the bar behaved before Send existed. The leak is
     real and small: the bar is collective and damped, so one person barely moves it.
     Offered as a switch because which of the two teaches better is a question about
     a room, not about code. */
  S.register({ id:'crowdLive', group:'Questions', type:'toggle', default:false,
    quick:true, byRoster:true, games:'*', under:'crowdReveal',
    /* **Reported as broken because the row could not say it was inert.** A preview
       only exists where a tap is *held*, which is the commit beat, which is a room
       of individuals — so in a team room a tap is already the answer, the bar has
       always followed it, and this switch has nothing left to turn on. Toggling it
       there changes precisely nothing, correctly, and silently. Proved with six
       handsets: `preview` on the arm is false in a team room with the switch on and
       true in a solo room with the switch on.

       Said through `stateNote` rather than in `help` because it is a fact about the
       room in front of the teacher, not a property of the setting — and the third
       line is the one that catches everybody, since anything riding the arm cannot
       reach the question already on screen. */
    stateNote(game){
      if(!Roster.solo())
        return 'A team room has no Send, so a tap is already the answer and the bar ' +
               'always follows it — this switch only does something for a room of individuals.';
      if(!S.get('roundSend', game))
        return 'Needs “Individuals press Send” on — without Send a tap is already the answer.';
      return 'Rides the next arm, so it lands on the following question, not the one open now.';
    },
    label:'Reveal bar follows selections',
    help:'The bar fills as people choose, before they press Send — livelier, and closer to how it felt without the Send button. Off, it only counts answers that have actually been sent.' });
  S.register({ id:'roundSendRamp', group:'Phones', under:'roundSend', type:'toggle', default:true,
    games:'*',
    label:'The wait grows',
    help:'Each wrong Send on the same question adds the wait again — 3s, then 6s, then 9s — so the second guess is a real decision. Individuals only.' });

  /* **The card stops leaving on its own when a round is won.** Reported from a real
     board: the four words light up, the tile flips away, and the room is left with
     no answer on screen and no idea who took it. The round pays the moment it is
     won *because* the class produced the answer and the host judged it — there is
     nothing left to confirm — but "nothing to confirm" was read as "nothing to
     read", and those are different. The teacher closes it now; the payout and the
     winner banner ride on that press, so the beat is one thing rather than two.
     Every round on a card board inherits it, because the wait is the host's. */
  S.register({ id:'roundWinClose', group:'Questions', adv:true, type:'variant', default:'teacher',
    games: ROUND_GAMES.filter(g => ROUND_HOSTS[g].mount === CARD_MOUNT),
    label:'When a round is won',
    variants:[{ value:'teacher', label:'Keep the card up — the answer stays on screen until you close it' },
              { value:'auto',    label:'Close the card straight away' }],
    help:'A won round used to flip the card away within a second of the answer landing. Keeping it up leaves the answer and the winning team on screen for as long as you want to talk about them.' });

  /* Offered wherever a round can be hosted, including the two boards with no card:
     a hint changes the question rather than the card, so Millionaire and Quickfire
     get it too. Which rounds actually offer a button is the round's own business —
     one that declares no `hint` shows none, whatever this says. */
  S.register({ id:'roundHints', group:'Questions', type:'toggle', default:true,
    games:ROUND_GAMES, label:'Hint button on a round',
    help:'Gives away one part of the answer — a word of the group, a wrong option struck out, a letter into its slot, the next rung. Press again for the next part. It never gives away the last part; that is what Reveal is for. Costs nothing.' });

  S.register({ id:'roundWho', group:'Questions', type:'variant', default:'room',
    games:ROUND_GAMES, label:'Who plays a round',
    variants:[{ value:'room', label:'The whole class races — first team to get it takes the square' },
              { value:'turn', label:'Only the team on turn' }],
    help:'A round asks the room to assemble an answer on their phones. It can be a race between every team, or belong to the team whose turn it is like any other clue.' });

  /* ---- how a wrong answer is announced ----
     The `say` line is one overwriting headline: right for a team room where one team
     answers at a time, a blur in a room of individuals where a dozen misses a second
     thrash it. So where a verdict lands is a switch, kept per room type because the
     headline is only a problem in the solo room. The count already says how close a
     player is, which is why "off" is a real choice and not a loss of information. */
  S.register({ id:'roundCommentary', group:'Questions', type:'variant', default:'headline',
    games:ROUND_GAMES, byRoster:true, quick:true, label:'Where a verdict shows',
    variants:[{ value:'headline', label:'One headline on top of the card — the last thing that happened' },
              { value:'lane',     label:'On the player’s own lane, where it stays until their next try' },
              { value:'off',      label:'Nowhere — the "3/4 right" count already says how close they are' }],
    help:'A "one away" / "not a group" can share one headline (fine for teams, a blur for sixteen individuals), sit on each player’s own row where it stays put, or stay off the board and leave the running count to say it.' });
  S.register({ id:'roundHintPhone', group:'Questions', type:'toggle', default:false,
    games:ROUND_GAMES, byRoster:true, quick:true, label:'Tell the phone how close',
    help:'On, a wrong answer tells the handset how close it was — "One away…" or "Not a group" — instead of a plain "Not that one". It never says which word is wrong, only how far off.' });

  /* Rounds were Jeopardy's alone for the first three, so their switches were named
     and grouped as Jeopardy's: `jGroupWho`, and `jRound_<id>` per round. A second
     board hosts rounds now, and a shared setting carrying one game's initial in its
     id is a name that will be wrong for as long as it exists.

     **A per-game override is exactly what a teacher set deliberately**, so it is
     translated rather than left behind under a key nothing reads any more. The old
     key being present is itself the signal — asking whether the new id is unset
     never fires, because `register()` seeds every master with its default — and
     `drop()` is what makes this run once, before anybody can have chosen a new
     value. Registered above this, or `set` would be writing to an id that does not
     exist yet. */
  /* The old Classic bundle wrote `jFinalRound:true` into storage on every device
     that ever picked it — including the accident that ran a final clue at the
     first ef-2a class. The bundle no longer writes it; this forgets what it wrote,
     so the final clue is off everywhere until a teacher turns it on knowingly. */
  (function retireClassicFinal(){
    S.drop(['jFinalRound'].concat(gameIds().map(g => 'jFinalRound@' + g)));
  })();

  (function migrateRoundSettings(){
    const ids  = Kit.round ? Kit.round.ids() : [];
    const pairs = [['jGroupWho', 'roundWho']]
      .concat(ids.map(id => ['jRound_' + id, 'round_' + id]));
    const dead = [];
    [''].concat(gameIds().map(g => '@' + g)).forEach(sfx => {
      pairs.forEach(([old, now]) => {
        const had = S.raw(old + sfx);
        if(had != null) S.set(now, had, sfx ? sfx.slice(1) : null);
        dead.push(old + sfx);
      });
    });
    S.drop(dead);
  })();

  /* `phoneMode` became `round_default` — the same value, read off a round instead of
     a hand-written setting. Three generations of stored value have to survive it, and
     they run in age order because a newer choice must win:

       phoneWrite / phoneBuzzGames   three booleans, before modes existed
       phoneMode: 'vote'             a value whose variant was deleted
       phoneMode: off|buzz|write|type

     **A per-game override is exactly what a teacher set deliberately**, so every one
     is carried across rather than quietly ignored — which is why this walks the game
     suffixes rather than translating the master alone.

     Two traps, both already paid for once and restated because this is the third
     migration to meet them. **The old key still being present is itself the signal
     that nothing has chosen yet**: asking whether `round_default` is unset never
     fires, because `register()` seeds every master with its default. And **`drop()`
     is what makes this run once** — it happens on the first load of this build,
     before anybody can have picked a new value, so a later choice cannot be
     overwritten. */
  (function migrateDefaultRound(){
    const dead = [];
    [''].concat(gameIds().map(g => '@' + g)).forEach(sfx => {
      const at = sfx ? sfx.slice(1) : null;
      /* Oldest first. Precedence between the two booleans is the one the old code
         actually used at question time: write beat buzz. `phoneVote` translates to
         nothing — voting stopped being a mode and happens whenever a room exists, so
         a teacher who had only that switched on wants the default and gets the class
         vote anyway. */
      const pick = S.raw('phoneWrite'+sfx) ? 'write'
                 : S.raw('phoneBuzzGames'+sfx) ? 'buzz' : null;
      if(pick) S.set('round_default', pick, at);
      ['phoneWrite','phoneBuzzGames','phoneVote'].forEach(id => dead.push(id + sfx));

      /* Then the mode itself, so a stored one overwrites anything derived above.
         `vote` names a variant that no longer exists, and a value nothing matches is
         worse than a wrong one — the phones go quiet while the panel still claims a
         dynamic is running. It becomes `off`, which is what that teacher had in
         effect for everything except the lifeline. */
      const had = S.raw('phoneMode'+sfx);
      if(had != null) S.set('round_default', had === 'vote' ? 'off' : had, at);
      dead.push('phoneMode' + sfx);
    });
    S.drop(dead);
  })();

  /* Per-round values were a scope for one afternoon and are gone: every round now
     follows its game, which is the rule a teacher can hold in their head. The keys
     they wrote would simply stop being read, and a value sitting in storage that
     nothing reads is the quiet kind of wrong — it reappears the moment anybody
     restores the scope and applies a choice made about a different build. So they
     are cleared rather than orphaned.

     **Nothing is promoted to the game.** A per-round value was set to make one
     round differ from its game, so lifting it up would apply to every round the
     opposite of what the teacher meant. `~` is the separator that build used, and
     it appears in no other key. */
  (function dropRoundScoped(){
    const dead = (S.keys ? S.keys() : []).filter(k => k.indexOf('~') !== -1);
    if(dead.length) S.drop(dead);
  })();

  S.register({ id:'jDailyDoubles', group:'Jeopardy', adv:true, type:'range', default:0,
    min:0, max:3, step:1, unit:' hidden', games:['jeopardy'],
    label:'Daily Doubles',
    help:'Tiles that hide a wager instead of a value. The team that finds one bets before seeing the clue, and answers it alone.' });

  S.register({ id:'jFinalQuestion', group:'Jeopardy', adv:true, type:'toggle', default:false, games:['jeopardy'],
    label:'Final clue',
    help:'When the board clears, every team bets what they like on one last clue. A team in last place can still win, so nobody gives up early.' });

  S.register({ id:'jDeduct', group:'Jeopardy', adv:true, type:'toggle', default:false, games:['jeopardy'],
    label:'Wrong answers cost the value',
    help:'As the show does it — and scores can go negative. Off by default: a class that goes 500 down early stops trying.' });

  S.register({ id:'jAnswerSeconds', group:'Jeopardy', adv:true, type:'range', default:0,
    min:0, max:30, step:5, unit:'s', games:['jeopardy'],
    label:'Answer clock',
    help:'Seconds to answer once a team takes the floor (buzzes in). Time up is a klaxon, not a verdict — the teacher still marks it. 0 = no clock.' });

  // the two games with a turn that can be *kept*: Race and Bingo have no pick to
  // hand over, and Millionaire's ladder rotates by design
  S.register({ id:'keepControl', group:'Competition', type:'toggle', default:true,
    games:['jeopardy','blockbusters'],
    label:'Keep the board on a correct answer',
    help:'A team that answers correctly picks again instead of handing over. Runs build, which is what steal is there to punish.' });

  /* Registered exactly like every other weight, which is the point: the panel and
     the Lab both grow a row for it without either being edited. */

  /* `'*'`, not a list: this rides on award(), which every game that scores calls,
     so naming the games that existed when it was written left the fifth one out. */
  S.register({ id:'streak', group:'Competition', adv:true, type:'toggle', default:false,
    games:'*',
    label:'Streak bonus',
    help:'Two in a row scores 1.5×, three or more scores 2×. A wrong answer resets it.' });

  S.register({ id:'promptForms', group:'Questions', type:'toggle', default:true,
    games:'*',
    label:'Draw the question type',
    help:'Gap fills show a real blank, anagrams show letter tiles, odd-one-out shows chips. Off prints every question as plain text.' });

  // only the two games that open a clue card have a card to animate
  S.register({ id:'cardFlip', group:'Clue card', type:'variant', default:'morph',
    games:['jeopardy','blockbusters'],
    label:'Card animation', help:'How the clue card arrives. Try them mid-game and keep whichever reads best in your room.',
    variants:[{value:'off',       label:'None — opens instantly'},
              {value:'morph',     label:'Unfold from the shape you clicked'},
              {value:'grow-turn', label:'Grow, then turn over'},
              {value:'turn-only', label:'Turn on the spot'},
              {value:'rise',      label:'Rise up — no 3D'}] });

  S.register({ id:'flipSpeed', group:'Clue card', under:'cardFlip', type:'select', default:'normal',
    games:['jeopardy','blockbusters'],
    label:'Flip speed', help:'How long the card takes to turn over and come back.',
    options:[{value:'relaxed',label:'Relaxed'},{value:'normal',label:'Normal'},{value:'snappy',label:'Snappy'}] });

  /* Blockbusters' weakness is that two students play and twenty-eight watch. The
     bench choosing the hexagon is the cheapest fix for that.

     It lives in the phones group rather than the Blockbusters one because that is
     where a teacher looks for "what do the phones do" — but it is deliberately not
     a `phoneMode` *value*. A mode is a choice between things that cannot both be
     true during a question; this is a button that borrows the room for ten seconds
     between questions and hands it straight back, exactly like Ask the class. Making
     it a mode would mean a Blockbusters class could pick the hexagon or buzz on the
     clue, never both, when the round wants both at different moments. */
  S.register({ id:'bbTeamVote', group:'Phones', type:'toggle', default:true,
    games:['blockbusters'],
    label:'The team picks its hexagon on their phones',
    help:'Adds a button that asks the team on turn which letter to attack. Their votes land beside the legend and the hexagons light up; you still click the one that plays. Works alongside whatever the phones are doing during a clue. Needs a room; with no phones the button stays hidden.' });

  S.register({ id:'bbWinRoute', group:'Blockbusters', adv:true, type:'variant', default:'trace',
    games:['blockbusters'],
    label:'Winning route', help:'How the completed line is shown when a team connects its two edges.',
    variants:[{value:'trace', label:'Light up along the route'},
              {value:'pulse', label:'Flash the whole route at once'},
              {value:'off',   label:'Just mark it — no animation'}] });

  S.register({ id:'bbEdges', group:'Blockbusters', adv:true, type:'toggle', default:true,
    games:['blockbusters'],
    label:'Team edges around the board',
    help:'Yellow teeth down the sides and blue along the top and bottom, so which way each team has to connect is on the board itself.' });

  /* A skin, not a rewrite. Game show is the default: the app is a classroom
     presentation tool and the lit look is what makes a class sit up, so it should be
     what you get without going and finding a setting. DCU remains one switch away and
     is unchanged.

     The skin covers the whole app, setup screens included — choosing a unit under
     stage lights is part of the moment. Which value applies: the game's own setting
     once a game is picked, the master before that. */
  S.register({ id:'theme', group:'Presentation', type:'variant', default:'gameshow',
    games:'*',
    label:'Look and feel', help:'Game show mode darkens the room and adds chase lights, an intro and music. DCU is the school-colours look.',
    variants:[{value:'gameshow', label:'Game show — lights, music, intro'},
              {value:'dcu',      label:'DCU — school colours'}] });

  S.register({ id:'intro', group:'Presentation', adv:true, type:'select', default:'once',
    games:'*',
    label:'Title sequence', help:'The lights-and-logo opening. Any key or click skips it.',
    options:[{value:'once',  label:'Once per session'},
             {value:'every', label:'Every round'},
             {value:'off',   label:'Never'}] });


  S.register({ id:'mLifelines', group:'Millionaire', type:'toggle', default:true, games:['millionaire'],
    label:'Lifelines', help:'50:50, Ask the class, and Confer — one use each per team.' });
  /* The show's beat, not a confirmation dialog: picking an option is the team saying
     a letter out loud, and the reveal waits for the host to ask. The pause is where
     the room gets to shout at them to change it — which is the whole point, so this
     defaults on. Off restores the one-click reveal for a class that needs the pace. */
  S.register({ id:'mFinalAnswer', group:'Millionaire', type:'toggle', default:true, games:['millionaire'],
    label:'Final answer?',
    help:'A picked option locks in highlighted and waits for "Final answer?" before the reveal. The team can change their mind until then. Off reveals on the first click.' });
  /* **`mBuzzRole` was retired here, and the reason is worth keeping.** It asked what
     a buzz wins in Millionaire — name the speaker for the team on turn, take the
     question outright, or nothing — which was a real question while a rung was an
     ordinary clue that armed the handsets as buzzers.

     Its ladder became a round host: `phoneRound()` returns the Multiple Choice round
     for every live question, so the round owns the handsets and there is no buzzer
     for a role to be given to. Between questions nothing is open, and a buzz arriving
     then is refused and the room disarmed. So the setting could not fire in either
     state, and **a control a teacher can pick that changes nothing is worse than no
     control** — it reads as a broken game rather than as an absent feature.

     What is *not* decided by removing it: whether a buzz should pick who speaks for
     the team **before** the round takes the room, which is what `speaker` was always
     for and is a new beat rather than this switch. That stays open — see Next. */
  (function dropBuzzRole(){
    S.drop([''].concat(gameIds().map(g => '@' + g)).map(sfx => 'mBuzzRole' + sfx));
  })();
  (function dropRoundTune(){
    // the clue-card Tune pill is gone — settings live in the room bench now, so its switch retires
    S.drop([''].concat(gameIds().map(g => '@' + g)).map(sfx => 'roundTune' + sfx));
  })();

  S.register({ id:'mConferSeconds', group:'Millionaire', under:'mLifelines', type:'select', default:30, games:['millionaire'],
    label:'Confer time', help:'How long a team gets to consult when they use Confer.',
    options:[{value:30,label:'30 seconds'},{value:45,label:'45 seconds'},{value:60,label:'60 seconds'}] });

  /* **Who is competing: sides, or people.** Deliberately *not* per game. It is a
     fact about the room — the roster persists across games and unit switches, so a
     lesson cannot be in teams on one board and individual on the next without the
     scoreboard being rebuilt underneath the class. Which boards *can* do it is the
     game's own `solo` declaration, and the game screen only offers those; this row
     says what the room is doing.

     Registered with no `games`, the same as the relay address, because a per-game
     override here would offer a control that cannot mean anything. */
  S.register({ id:'roster', group:'Competition', type:'variant', default:'teams',
    label:'Who is competing',
    help:'Teams is the classroom default. Individuals gives everybody their own score, and only the boards built for it are offered.',
    variants:[{ value:'teams', label:'Teams — a name is a group of students' },
              { value:'solo',  label:'Individuals — everyone against everyone' }] });

  S.register({ id:'buzzers', group:'Phones', type:'toggle', default:false,
    label:'Phone buzzers', help:'Students join on their phones and buzz to win the right to answer. Needs a relay — this will not work from the GitHub Pages copy. See docs/buzzers.md.' });
  S.register({ id:'buzzerRelay', group:'Phones', adv:true, type:'text', default:'',
    label:'Relay address', placeholder:'same site as this page',
    help:'Leave blank unless you run your own relay server elsewhere — then put its https address here.' });

  S.register({ id:'raceRescatter', group:'Race to the Board', type:'toggle', default:true, games:['race'],
    label:'Re-scatter after every claim', help:'Moves the words each time one is won, so nobody wins on memory alone.' });
  S.register({ id:'raceRoundSeconds', group:'Race to the Board', type:'select', default:60, games:['race'],
    label:'Timed round length', help:'Only used in timed team rounds.',
    options:[{value:45,label:'45 seconds'},{value:60,label:'60 seconds'},{value:90,label:'90 seconds'}] });
  S.register({ id:'raceShowSection', group:'Race to the Board', adv:true, type:'toggle', default:true, games:['race'],
    label:'Show the section tag', help:'The small 5A / 5B label above the sentence.' });

  /* ---- sound: synthesised, so it needs no audio files and still works offline ---- */
  const Sound = (function(){
    const LEVEL = { quiet:0.035, med:0.09, loud:0.2 };
    // how loud the bed sits under the master volume; `off` is a real 0, so the
    // nodes are never built rather than being built and left silent
    const BED_MIX = { normal:0.30, quiet:0.12, off:0 };
    const VOICES = {
      correct:[{f:660,d:0.09},{f:990,d:0.13}],
      wrong:  [{f:180,d:0.16,type:'sawtooth'},{f:120,d:0.18,type:'sawtooth'}],
      claim:  [{f:523,d:0.07},{f:784,d:0.07},{f:1047,d:0.14}],
      end:    [{f:440,d:0.14},{f:330,d:0.2}],
      clear:  [{f:523,d:0.1},{f:659,d:0.1},{f:784,d:0.1},{f:1047,d:0.28}],
      flip:   [{f:240,to:820,d:0.3,type:'sine'}],
      reveal: [{f:880,d:0.07},{f:1319,d:0.19}],
      // game-show cues. Original riffs, not the shows' own music — everything here
      // is oscillators, so there is nothing to license and nothing to download.
      lock:   [{f:150,to:60,d:0.22,type:'sine'},{f:70,to:190,d:0.5,type:'sawtooth'}],
      klaxon: [{f:196,d:0.3,type:'square'},{f:185,d:0.42,type:'square'}],
      sting:  [{f:392,d:0.1,type:'square'},{f:523,d:0.1,type:'square'},{f:784,d:0.34,type:'square'}]
    };
    let ctx=null;
    function audio(){
      if(ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{ ctx = new AC(); }catch(e){ ctx=null; }
      return ctx;
    }
    function play(name){
      if(!S.get('sound', activeGame)) return;
      const seq = VOICES[name]; if(!seq) return;
      const ac = audio(); if(!ac) return;
      if(ac.state==='suspended' && ac.resume) ac.resume();
      const peak = LEVEL[S.get('soundVolume', activeGame)] || LEVEL.med;
      let at = ac.currentTime;
      seq.forEach(n=>{
        const osc=ac.createOscillator(), gain=ac.createGain();
        osc.type = n.type || 'triangle';
        osc.frequency.setValueAtTime(n.f, at);
        if(n.to) osc.frequency.exponentialRampToValueAtTime(n.to, at+n.d);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(peak, at+0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at+n.d);
        osc.connect(gain); gain.connect(ac.destination);
        osc.start(at); osc.stop(at+n.d+0.02);
        at += n.d*0.85;
      });
    }

    function level(){ return LEVEL[S.get('soundVolume', activeGame)] || LEVEL.med; }
    function bedMix(){
      const v = BED_MIX[S.get('musicBed', activeGame)];
      return (v === undefined) ? BED_MIX.normal : v;
    }
    function live(){
      if(!S.get('sound', activeGame)) return null;
      const ac = audio(); if(!ac) return null;
      if(ac.state==='suspended' && ac.resume) ac.resume();
      return ac;
    }

    /* Applause is filtered noise, not a sample — a burst of white noise through a
       bandpass lands close enough to a room clapping, and keeps the app offline. */
    function applause(ms){
      const ac = live(); if(!ac) return;
      const secs = (ms || 2200) / 1000;
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * secs), ac.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0; i<d.length; i++){
        // a slow random envelope on top of the noise gives it a hand-clap texture
        // rather than the flat hiss plain noise produces
        d[i] = (Math.random()*2 - 1) * (0.45 + 0.55*Math.random());
      }
      const src = ac.createBufferSource(); src.buffer = buf;
      const band = ac.createBiquadFilter(); band.type='bandpass'; band.frequency.value=1600; band.Q.value=0.7;
      const gain = ac.createGain();
      const t = ac.currentTime, peak = level()*0.9;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t+0.12);
      gain.gain.setValueAtTime(peak, t+secs*0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t+secs);
      src.connect(band); band.connect(gain); gain.connect(ac.destination);
      src.start(t); src.stop(t+secs+0.05);
    }

    /* Starting pistol. Same noise buffer as the applause, but the envelope is the
       whole sound: three milliseconds of attack and a 90ms tail through a highpass
       is a crack, where applause's slow swell is a room. */
    function crack(){
      const ac = live(); if(!ac) return;
      const secs = 0.16;
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate*secs), ac.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0; i<d.length; i++) d[i] = Math.random()*2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf;
      const hp = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=900;
      const gain = ac.createGain();
      const t = ac.currentTime, peak = level()*1.5;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t+0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t+0.09);
      src.connect(hp); hp.connect(gain); gain.connect(ac.destination);
      src.start(t); src.stop(t+secs);
    }

    /* Brass-ish rising figure for a cleared ladder — sawtooth under a lowpass is a
       serviceable horn section at classroom-speaker resolution. */
    function fanfare(){
      const ac = live(); if(!ac) return;
      const notes = [[392,0.14],[523,0.14],[659,0.14],[784,0.5]];
      let at = ac.currentTime, peak = level();
      notes.forEach(([f,d])=>{
        [1, 1.005, 2].forEach((mult, i)=>{      // slight detune + an octave = body
          const osc=ac.createOscillator(), g=ac.createGain(), lp=ac.createBiquadFilter();
          osc.type='sawtooth'; osc.frequency.setValueAtTime(f*mult, at);
          lp.type='lowpass'; lp.frequency.value=2600;
          const amp = peak * (i===2 ? 0.32 : 0.55);
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(amp, at+0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, at+d);
          osc.connect(lp); lp.connect(g); g.connect(ac.destination);
          osc.start(at); osc.stop(at+d+0.02);
        });
        at += d*0.92;
      });
    }

    /* ---- the think-music bed ----
       Runs while a question is live and stops the moment it is answered, so it
       never talks over the teacher reading out the result. Tension (0–1, driven by
       the rung) speeds the pulse up and opens the filter, which is most of what
       makes the top of a ladder feel different from the bottom. */
    let bed = null;
    function bedStart(tension){
      const ac = live(); if(!ac){ bedStop(); return; }
      if(!bedMix()){ bedStop(); return; }      // switched off in ⚙ — cues still play
      if(bed){ bedSet(tension); return; }
      const out  = ac.createGain();  out.gain.value = 0;
      const lp   = ac.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=7;
      const o1   = ac.createOscillator(); o1.type='sawtooth'; o1.frequency.value=55;    // A1
      const o2   = ac.createOscillator(); o2.type='sawtooth'; o2.frequency.value=82.41; // E2
      const lfo  = ac.createOscillator(); lfo.type='sine';
      const lfoG = ac.createGain();
      o1.connect(lp); o2.connect(lp); lp.connect(out); out.connect(ac.destination);
      lfo.connect(lfoG); lfoG.connect(out.gain);       // pulse, like a slow heartbeat
      [o1,o2,lfo].forEach(o=>o.start());
      bed = { out, lp, lfo, lfoG, oscs:[o1,o2,lfo] };
      bedSet(tension);
    }
    function bedSet(tension){
      if(!bed) return;
      const ac = audio(); if(!ac) return;
      const mix = bedMix();
      // turned off mid-question: fade the running bed out rather than leaving it
      // playing until the next beat happens to restart it
      if(!mix){ bedStop(); return; }
      const t = Math.max(0, Math.min(1, tension || 0));
      const base = level() * mix * (0.55 + 0.45*t);
      const now  = ac.currentTime;
      bed.out.gain.cancelScheduledValues(now);
      bed.out.gain.setTargetAtTime(base, now, 0.25);
      bed.lfoG.gain.setTargetAtTime(base*0.85, now, 0.25);
      bed.lfo.frequency.setTargetAtTime(0.9 + 1.5*t, now, 0.4);   // 54 → 144 bpm
      bed.lp.frequency.setTargetAtTime(260 + 520*t, now, 0.4);
    }
    function bedStop(){
      if(!bed) return;
      const ac = audio(), b = bed; bed = null;
      if(!ac){ return; }
      const now = ac.currentTime;
      b.out.gain.cancelScheduledValues(now);
      b.out.gain.setTargetAtTime(0.0001, now, 0.12);
      // let it fade before tearing the nodes down, or the stop clicks
      setTimeout(()=>{ try{ b.oscs.forEach(o=>o.stop()); b.out.disconnect(); }catch(e){} }, 600);
    }

    return { play, applause, crack, fanfare, bedStart, bedSet, bedStop };
  })();

  /* ---- UI skeleton (identical for every unit) ---- */
  const SKELETON = `
    <header>
      <div>
        <div class="eyebrow"></div>
        <h1 id="page-title">Game Hub</h1>
      </div>
      <div class="header-right">
        <span id="build-tag" title="App version — the settings cog moved to the room bench, so the build shows here">Build ${window.HUB_BUILD || 'dev'}</span>
        <div id="timer-widget">
          <button id="tmr-minus" title="−15 seconds">−</button>
          <span id="tmr-display">0:30</span>
          <button id="tmr-toggle" title="Start / pause">▶</button>
          <button id="tmr-reset" title="Reset">↺</button>
          <button id="tmr-plus" title="+15 seconds">+</button>
        </div>
        <button id="new-game-btn">↺ New game</button>
      </div>
    </header>
    <div class="geo-band"></div>

    <!-- The room, on every screen rather than only during a game. A class cannot
         join a room they cannot see the code for, and the whole of setup — picking a
         unit, a game, the sections — is exactly when they are walking in and getting
         their phones out. It was inside #screen-play, so the code appeared at the
         moment it stopped being useful. Above the screens rather than fixed, so the
         board still measures around it the way it always did. -->
    <div id="buzzer-chip" style="display:none;"></div>

    <!-- SCREEN 0: choose unit -->
    <div class="screen" id="screen-unit-select">
      <p class="intro" id="unit-intro">Choose a unit to gamify.</p>
      <div class="unit-grid" id="unit-grid"></div>
    </div>

    <!-- SCREEN 1: choose game -->
    <div class="screen" id="screen-game-select">
      <span class="back-link" id="change-unit" style="display:none;">&larr; Change unit</span>
      <p class="intro"></p>
      <!-- A board missing from this screen with nothing saying why reads as a bug.
           Filled by applyGameAvailability, and empty in team play. -->
      <p class="roster-note" id="roster-note" style="display:none;"></p>
      <div class="game-grid"></div>
    </div>

    <!-- SCREEN 2: choose content -->
    <div class="screen" id="screen-content-select">
      <span class="back-link" id="back-to-games">&larr; Back to game choice</span>
      <!-- **Teams or individuals is a setup decision, decided here.** It cannot
           usefully be changed once a board is running: sixteen people cannot be
           regrouped into four teams without rebuilding the roster, and rebuilding it
           bins a lesson's points. So it is asked before the game starts, next to the
           other how-shall-we-run-it choices (Race's mode picker is right below), and
           the bar's own switch stands down while a game is on. -->
      <div id="roster-pick">
        <div class="mode-title">Who is competing?</div>
        <div id="roster-pick-opts"></div>
        <p class="helptext" id="roster-pick-note"></p>
      </div>
      <p class="helptext" id="content-helptext"></p>
      <!-- Narrow by round type. Built from whatever is in this game's bank, and
           hidden when there is nothing to choose between. -->
      <div id="round-filter" style="display:none;"></div>
      <div id="content-list"></div>
      <div class="rules-note" id="blockbusters-rules" style="display:none;">
        <span class="team-tag tag-gold">YELLOW</span> connects a path of hexagons from the <strong>left</strong> edge to the <strong>right</strong> edge.<br>
        <span class="team-tag tag-silver">BLUE</span> connects a path from the <strong>top</strong> edge to the <strong>bottom</strong> edge.<br>
        Click a hexagon, read the clue aloud &mdash; the answer starts with the letter shown. Correct = claim it. Wrong = the other team can steal it.
      </div>
      <div id="race-mode" style="display:none;">
        <div class="mode-title">How do you want to run it?</div>
        <label class="mode-opt">
          <input type="radio" name="racemode" value="h2h" checked>
          <span><strong>Head-to-head</strong> &mdash; both teams at the board at once. First to touch the word wins the point. No clock.</span>
        </label>
        <label class="mode-opt">
          <input type="radio" name="racemode" value="timed">
          <span><strong>Timed team rounds</strong> &mdash; one team at a time, as many as they can before the clock runs out.</span>
        </label>
      </div>
      <div class="rules-note" id="race-rules" style="display:none;"></div>
      <button id="start-btn" disabled>Select content to continue</button>
    </div>

    <!-- SCREEN 3: play -->
    <div class="screen" id="screen-play">
      <!-- Everything the class does, in one place, for every game and every mode:
           who buzzed, who typed what, what the room answered, who just scored. It
           used to be four different places — the chip, the clue card, under the race
           sentence, under the Millionaire question — so the same event looked
           different on every board and moved the board while it did it. Fixed
           height, so what it says can never reflow the game. -->
      <div id="phone-bar" style="display:none;"></div>
      <div id="play-jeopardy">
        <!-- Together mode: one number for the whole room, and how far it has to go.
             Hidden entirely otherwise, so the competitive game is untouched. -->
        <div id="j-class" style="display:none;">
          <div id="j-class-line">
            <span id="j-class-score"></span>
            <span id="j-class-target"></span>
          </div>
          <div id="j-class-bar"><div id="j-class-fill"></div></div>
        </div>
        <div id="board"></div>
      </div>
      <div id="play-blockbusters">
        <div id="legend">
          <span class="legend-gold"><span class="dot" style="background:var(--gold)"></span> Yellow: left &rarr; right</span>
          <span class="legend-silver"><span class="dot" style="background:var(--silver)"></span> Blue: top &rarr; bottom</span>
          <button id="bb-ask" style="display:none;">Team picks</button>
          <span id="bb-tally" style="display:none;"></span>
        </div>
        <div id="hexwrap"></div>
      </div>
      <div id="play-race">
        <div id="race-prompt"></div>
        <!-- Where a round draws, when the bank hands this board one. Under the
             prompt and above the bar, so the question reads top to bottom exactly as
             it does on a clue card; empty and out of the flow the rest of the time. -->
        <div id="race-round" style="display:none;"></div>
        <div id="race-bar">
          <div id="race-status"></div>
          <div id="race-claim">
            <span class="claim-q">Who touched it first?</span>
            <div id="race-claim-teams"></div>
          </div>
          <div class="race-actions">
            <button id="race-start">&#9654; Start</button>
            <button id="race-skip" style="display:none;">Skip this one</button>
            <!-- The round's commit button, beside this board's own controls the way
                 Millionaire's "Final answer?" sits beside its ladder. Hidden until a
                 round opens; the round declares anything else it wants. -->
            <button id="race-commit" style="display:none;">Check</button>
          </div>
        </div>
        <div id="race-words"></div>
      </div>
      <div id="play-millionaire">
        <div id="m-bar">
          <div id="m-turn"></div>
          <div id="m-lifelines">
            <button class="lifeline" data-life="fifty">50:50</button>
            <button class="lifeline" data-life="class">Ask the class</button>
            <button class="lifeline" data-life="confer">Confer</button>
          </div>
        </div>
        <div id="m-main">
          <div id="m-stage">
            <div id="m-question"></div>
            <div id="m-options"></div>
            <div id="m-foot">
              <span id="m-hint"></span>
              <button id="m-final" style="display:none;">Final answer?</button>
              <button id="m-next" style="display:none;">Next team</button>
              <button id="m-done-count" style="display:none;">Done counting</button>
            </div>
          </div>
          <div id="m-ladder"></div>
        </div>
      </div>

    </div>

    <!-- title sequence. Empty and inert unless a game show themed game opens it. -->
    <div id="intro-overlay" aria-hidden="true">
      <div class="intro-sweep"></div>
      <div class="intro-bulbs"></div>
      <div id="intro-inner">
        <div id="intro-eyebrow"></div>
        <div id="intro-title"></div>
        <div id="intro-sub"></div>
      </div>
      <div id="intro-skip">Press any key to skip</div>
    </div>

    <!-- Persistent team bar, under the board and visible on every screen. It rode
         in the header for one build; back down here because the header is for the
         teacher's instruments and the bar is the game's state — the room reads it,
         not just the teacher. Kit.floorTop() is what keeps boards off it. -->
    <div id="scorebar"></div>

    <!-- end-of-round banner. Deliberately a banner and not a full-screen modal: the
         whole point of a Blockbusters win is the route lit up on the board behind it,
         so this sits above the team bar and leaves the board visible. -->
    <div id="result-modal">
      <div id="result-card">
        <div id="result-eyebrow"></div>
        <h2 id="result-title"></h2>
        <p id="result-sub"></p>
        <div id="result-actions"></div>
      </div>
    </div>

    <!-- The standings, between questions. **A sibling of every stage, not inside
         one** — the same place the clue card, the join lobby and the result banner
         live, and for the same reason: it is the container's surface that any board
         borrows. Quickfire's own leaderboard was inside the play-kahoot stage, which
         is exactly why it was squeezed and ran off a 720px board.
         (No backticks in here: the skeleton is a template literal, and one closes it.)
         It replaces the round-winner banner rather than following it: one moment
         that names who took the question *and* shows everyone else moving beats two
         screens back to back. -->
    <div id="standings-modal">
      <div id="standings-card">
        <div id="standings-eyebrow"></div>
        <h2 id="standings-title"></h2>
        <div id="standings-rows"></div>
        <button id="standings-go" type="button">Continue</button>
        <!-- The debugging way into the score report: quiet, but on the screen a
             teacher is looking at when a number reads wrong. -->
        <button id="standings-report" type="button">score report</button>
      </div>
    </div>
    <div id="report-modal">
      <div id="report-card">
        <h2>Score report</h2>
        <p class="rp-note">Per question: what each team actually gained against what
        the payout said it should. A red line is a discrepancy.</p>
        <div id="report-body"></div>
        <div class="rp-actions">
          <button id="report-clear" type="button">Clear ledger</button>
          <button id="report-close" type="button">Close</button>
        </div>
      </div>
    </div>


    <!-- the join lobby: thrown on the projector so a class can scan in -->
    <div id="join-modal">
      <div id="join-card">
        <div id="join-eyebrow">Scan to join</div>
        <div id="join-qr"></div>
        <div id="join-code"></div>
        <div id="join-url"></div>
        <div id="join-count"></div>
        <!-- Who is in, each removable. The way out of a phantom: a handset that
             died without closing its connection stays on the roster, inflates its
             team's size, and quietly breaks every share and every all-agree gate.
             Nothing else can remove it, so the teacher can. -->
        <div id="join-roster"></div>
        <button id="join-close" type="button">Close</button>
      </div>
    </div>

    <!-- shared clue modal -->
    <div id="clue-modal">
      <div id="clue-card">
        <div id="clue-front"><span id="clue-front-text"></span></div>
        <div id="clue-back">
        <!-- Inside the back face, not on the card: the card is a 3D flip context
             whose faces carry the counter-rotation, so a child of the card itself
             renders mirrored. Everything readable lives on a face. -->
        <div id="clue-topline"></div>
        <div id="clue-section"></div>
        <div id="clue-text"></div>
        <!-- Daily Double / Final: the bet is placed before the clue is shown, so
             this stands where the clue will be rather than beside it. -->
        <div id="wager-panel" style="display:none;">
          <div id="wager-who"></div>
          <div id="wager-amount">0</div>
          <div id="wager-range"></div>
          <div id="wager-steps"></div>
          <div id="wager-quick"></div>
        </div>
        <div id="clue-answer"></div>
        <div id="clue-actions">
          <button id="hint-btn" style="display:none;">Need a hand?</button>
          <button id="group-btn" style="display:none;">Check these</button>
          <button id="wager-ok" style="display:none;">Lock it in</button>
          <button id="reveal-btn">Reveal answer</button>
          <button id="correct-btn" style="display:none;">✓ Correct</button>
          <button id="wrong-btn" style="display:none;">✗ Wrong</button>
          <div id="clue-claim"></div>
          <button id="skip-btn" style="display:none;">No claim / close</button>
          <button id="close-btn" style="display:none;">Close</button>
        </div>
        </div>
      </div>
    </div>`;

  const root = document.getElementById('game-hub-root') || document.body;
  root.innerHTML = SKELETON;
  /* An external game's stage panel — `stageHTML` on its registration — goes in
     beside the in-skeleton stages, before anything measures. Only when the
     skeleton does not already hold the id, so an in-engine game moving to its
     own file can carry its markup with it without a collision on the way. */
  window.HubGames.ids().forEach(g => {
    const d = window.HubGames.get(g);
    if(!d || !d.stageHTML || document.getElementById(d.stage)) return;
    const anchor = document.getElementById('play-jeopardy');
    if(anchor && anchor.parentNode){
      const t = document.createElement('template');
      t.innerHTML = d.stageHTML.trim();
      anchor.parentNode.appendChild(t.content);
    }
  });

  /* ---- current unit content (set by loadUnit) ---- */
  let UNIT = null;
  let JEOPARDY_SECTION_LABELS   = {};
  let JEOPARDY_CATEGORIES       = [];
  let BLOCKBUSTERS_BANK         = [];
  let BLOCKBUSTERS_SECTION_NAMES= {};
  let BLOCKBUSTERS_TOPIC_NAMES  = {};
  let RACE_BANK                 = [];
  let RACE_SECTION_NAMES        = {};
  let RACE_TOPIC_NAMES          = {};
  let MILLIONAIRE_BANK          = [];
  let MILLIONAIRE_SECTION_NAMES = {};
  let MILLIONAIRE_TOPIC_NAMES   = {};

  // Which games a unit can actually offer — a unit without a bank for a game
  // simply doesn't show that card, so units can adopt new games one at a time.
  /* Two reasons a board may not be on offer, and they are the same kind of reason:
     it has no content for this unit, or it is not built for the way the room is
     competing. Both are the game's own declaration — `hasBank` and `solo` — so a
     seventh board answers for itself and nothing here holds a list. */
  function suitsRoster(g){ return !Roster.solo() || g.solo; }
  function gamesFor(u){
    return GAMES.filter(g => g.hasBank(u) && suitsRoster(g)).map(g => g.id);
  }

  /* Split out of `loadUnit` because the roster mode can change while a unit is
     already loaded, and re-running `loadUnit` would reload every bank to redraw
     some cards. */
  function applyGameAvailability(){
    if(!UNIT) return;
    const available = gamesFor(UNIT);
    document.querySelectorAll('.game-card').forEach(c=>{
      c.style.display = available.includes(c.dataset.game) ? 'block' : 'none';
    });
    const note = document.getElementById('roster-note');
    if(note){
      const hidden = GAMES.filter(g => g.hasBank(UNIT) && !suitsRoster(g));
      note.textContent = hidden.length
        ? 'Playing as individuals — ' + hidden.map(g => g.title).join(', ') +
          (hidden.length === 1 ? ' is' : ' are') + ' built for teams and not shown.'
        : '';
      note.style.display = hidden.length ? 'block' : 'none';
    }
  }

  function loadUnit(u){
    UNIT = u;
    GAMES.forEach(g => g.load(u));
    applyGameAvailability();
    document.querySelector('.eyebrow').textContent = u.label || '';
    document.querySelector('#screen-game-select p.intro').textContent = u.intro || '';
    if(u.label){ document.title = u.label + ' — Game Hub'; }
  }

  /* ================= UNIT SELECT ================= */
  function renderUnitSelect(){
    const grid=document.getElementById('unit-grid'); grid.innerHTML='';
    UNITS.forEach(u=>{
      const c=u.card||{};
      const el=document.createElement('div');
      el.className='unit-card';
      el.innerHTML = `<span class="unit-num">${c.num||u.id||'Unit'}</span>`+
        `<h2>${c.title||''}</h2><p>${c.blurb||''}</p>`+
        `<div class="games">${gamesFor(u).map(g=>`<span>${HUB_GAME_TITLES[g]}</span>`).join('')}</div>`;
      el.addEventListener('click', ()=>{ loadUnit(u); document.getElementById('page-title').textContent='Game Hub'; showScreen('screen-game-select'); });
      grid.appendChild(el);
    });
  }

  /* ================= STATE / NAVIGATION ================= */
  let activeGame = null;
  let selectedContent = [];
  let pool = [];

  /* A team is data, never DOM: renderScorebar() tears the whole bar down and
     rebuilds it on every score change, so anything held in an element is destroyed.
     `run` is the current unbroken streak of correct answers. */
  /* **A competitor, not a team.** The scoreboard has always held teams because
     that is all a class-facing board has ever had, but nothing in the shape says
     "team": a name, a score and a streak fit one person exactly as well. Widening
     the meaning here is what lets the roster later be built from the phones in the
     room rather than from the + Team button, without every board learning about it
     — the 60-odd places that read `roster[i].name` and `roster[i].score` do not
     care what put it there.

     `id` is new and is the thing solo play cannot do without. An index is a
     competitor's identity everywhere today, which is why removing one is a special
     case rather than a splice, and it is why the first live class paid a win to a
     team that no longer existed. A person has to be matched to their handset
     across a reconnect, and an index cannot do that. Nothing reads it yet; it is
     minted now so that a competitor created today is already addressable. */
  let nextCompetitorId = 1;
  /* `auto` means "nobody chose this name" — it is the placeholder the app starts
     with, not something a teacher typed. It is what lets the first two students to
     join a solo room take the two default slots instead of landing under them, and
     it is cleared the moment anybody renames one. */
  function newTeam(name, auto){
    return { id:'c' + (nextCompetitorId++), name, score:0, run:0, auto:!!auto };
  }

  /* Teams could be added and never removed, so a class that split four ways one
     lesson carried four teams into the next one. Removing is more than a splice,
     because a team's *index* is its identity in three other places:
       - `active`, which has to follow the team it pointed at rather than the slot;
       - `mState`, Millionaire's per-team ladder, which is a parallel array;
       - `bbSideAt`, which team is up within each Blockbusters alliance.
     Two is the floor: every board is built for at least two sides. */
  function removeTeam(i){
    if(teams.length <= Roster.floor() || !teams[i]) return;
    // points are a lesson's worth of work — a mis-tap must not silently bin them
    if(teams[i].score !== 0 &&
       !confirm('Remove ' + teams[i].name + '? They have ' + teams[i].score + ' points.')) return;
    teams.splice(i, 1);
    if(Array.isArray(mState)) mState.splice(i, 1);
    if(active > i) active--;
    if(active >= teams.length) active = teams.length - 1;
    bbSideAt = [0, 0];
    /* The phones' indices shift with the board's, or the two disagree for the
       rest of the lesson — the first live class paid a Drag the Letters win to a
       team that no longer existed, because every joined phone kept the number it
       joined under. The relay renumbers its players, tells each moved phone, and
       answers with a roster refresh that re-deals, re-shares and re-reads. */
    if(buzzHost) buzzHost.remap(i);
    renderScorebar();
    if(activeGame === 'blockbusters'){ renderBBTurn(); renderBBVote(); }
    hook('onResize');
  }

  /* The roster: whoever is competing for points, persisting across games AND unit
     switches until Reset. Still called `teams` throughout, because it is read in
     about sixty places and a rename would be churn with no gain — what matters is
     that the *meaning* is now "the competitors" and only `Roster` decides what
     goes in it. In team play a teacher fills it with the + Team button. In solo
     play it would be filled from the phones that have joined, and every board
     would be unaffected. */
  let teams = [newTeam('Team 1', true), newTeam('Team 2', true)];

  /* **The one seam.** Everything that *reads* the roster keeps indexing the array
     directly, which is fine and stays. What goes through here is everything that
     *changes* it — because that is the only part that differs between a room of
     teams and a room of people, and putting it in one place is what stops solo
     play from being sixty edits.

     `mode` reads the `roster` setting rather than holding a copy of it. A stored
     mode is a second answer to a question the settings already answer, and the two
     would differ the first time somebody changed it mid-lesson. */
  const Roster = {
    get mode(){ return S.get('roster') === 'solo' ? 'solo' : 'teams'; },
    solo(){ return this.mode === 'solo'; },
    all(){ return teams; },
    at(i){ return teams[i] || null; },
    count(){ return teams.length; },
    indexes(){ return teams.map((_, i) => i); },
    byId(id){ return teams.find(t => t.id === id) || null; },
    /* Two is the floor in team play — every board is built for at least two
       sides — and the caller is the team bar, which hides its own remove control
       there. Named here so a solo roster can answer differently. */
    floor(){ return 2; },
    add(name){
      const fallback = (this.solo() ? 'Player ' : 'Team ') + (teams.length + 1);
      teams.push(newTeam(name || fallback, !name));
      return teams.length;
    },
    label(){ return this.solo() ? 'player' : 'team'; },
    /* Capitalised for a button; the lowercase one is for a tooltip mid-sentence. */
    Label(){ const l = this.label(); return l.charAt(0).toUpperCase() + l.slice(1); }
  };

  /* The room bench's handle on the team bar, same-origin only. `ensure` grows and
     never shrinks: the teacher's team bar stays the sole owner of teams, and the
     bench applying a 4×4 preset is automating the teacher's own + Team clicks —
     removal stays a decision a human makes, because a team can be holding points. */
  window.HubTeams = {
    count(){ return teams.length; },
    ensure(n){
      /* Eight was the cap when this only ever grew a team bar. A room of
         individuals is a class, so the ceiling is a class. */
      n = Math.max(0, Math.min(40, Number(n) || 0));
      let grew = false;
      while(teams.length < n){ Roster.add(); grew = true; }
      if(grew){ renderScorebar(); hook('onRoster'); }
      return teams.length;
    },
    /* **Exactly n, which is what a classroom-division preset means.** `ensure` only
       ever grew, so the room bench's 4×4 → 3×3 → 2×2 left the board on four teams
       while the rack showed two — the bench quietly disagreeing with the board it is
       there to mirror, which makes it useless for the one job it has.

       Shrinking is still not free, and the reason `ensure` was grow-only stands:
       removing a team can bin points somebody earned. But that reason belongs to a
       lesson in progress, not to setting the room up — so this refuses rather than
       asks, and says which it did. The caller is a preset button, not a person
       deciding; a confirm dialog behind a remote control is nobody's idea of a
       question. `removeTeam` keeps its own confirm for the human path. */
    size(n){
      n = Math.max(Roster.floor(), Math.min(40, Number(n) || 0));
      const playing = document.getElementById('screen-play').classList.contains('active');
      const held    = teams.some(t => t.score !== 0);
      if(teams.length > n && (playing || held))
        return { count: teams.length, refused: playing ? 'a game is running' : 'a team has points' };
      while(teams.length > n) removeTeam(teams.length - 1);
      this.ensure(n);
      return { count: teams.length };
    }
  };
  let active = 0;   // jeopardy: selected/active team index
  let bbTurn = 0;   // blockbusters: whose turn (0 = Yellow/teams[0], 1 = Blue/teams[1])

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    hideResult();                       // a banner belongs to the round that raised it
    document.getElementById('new-game-btn').style.display = (id==='screen-play') ? 'inline-block' : 'none';
    document.getElementById('timer-widget').style.display = (id==='screen-play') ? 'flex' : 'none';
    // these boards size themselves around the team bar, so they don't need the body
    // padding that keeps the bar clear of the other screens
    document.body.classList.toggle('play-fit',
      id==='screen-play' && !!(gameDef() && gameDef().fitsScreen));
    if(id!=='screen-play') timerStop();
    applyTheme();
    if(id!=='screen-play'){
      Sound.bedStop();
      // `lit` marks a stage that is being played; leaving the play screen ends that,
      // and a stale one would light up again the moment the panel is shown
      // ask the registry for the stages rather than restating them: a fifth game
      // was otherwise a stage that never got its `.lit` cleared
      gameIds().forEach(id => {
        const el = document.getElementById(gameDef(id).stage);
        if(el) el.classList.remove('lit');
      });
    }
    renderScorebar();   // team bar is always visible; refresh its highlight/cues
  }

  /* ================= THEME =================
     A skin is a body class and a block of CSS overrides, not a second stylesheet —
     the DCU look is one switch away and entirely untouched by any of this. */
  function themeOf(game){ return S.get('theme', game || activeGame) || 'dcu'; }
  /* The skin is on everywhere, not just the play screen — a lit board reached through
     a white setup screen loses the moment before it starts. `themeOf()` resolves to
     the active game's setting once one is chosen and the master value before that,
     so picking a unit uses whatever the teacher's default is. */
  function applyTheme(){
    document.body.classList.toggle('theme-gameshow', themeOf() === 'gameshow');
  }
  S.onChange(id=>{ if(id === 'theme') applyTheme(); });   // ⚙ changes show at once
  /* Switching who is competing has to reach the screen it changes: the game cards,
     because half of them are no longer on offer, and the team bar, because its add
     button and its remove tooltips are named after what a competitor is. Neither is
     rebuilt on a timer, so a setting read once at build time is a setting the
     panel cannot change live — the Daily Double paid for that lesson. */
  /* **Each mode keeps its own roster, and switching swaps between them.**
     Reported as "it won't switch back", and the picker was innocent: the setting,
     the radio and the bar all flipped: what did not change was the *list*, so teams
     mode showed three competitors called Ana, Ben and Cara and looked exactly like
     the solo it had just left.

     A roster of people and a roster of teams are two different lists, and neither
     can be derived from the other — so both are kept, and going back and forth costs
     nothing. Without this, switching to solo would bin whatever teams a teacher had
     set up and switching back would leave the class as competitors, which is why the
     switch felt broken in both directions. */
  const rosterStash = Object.create(null);
  /* **The phones have a roster mode too, and forgetting that scrambled a class.**
     Solo seats every handset into its own competitor, which overwrites the team the
     student picked when they joined — so coming back to teams left each phone
     holding the *index* it had been seated at, now pointing at whatever team happens
     to sit there. Four phones went Team 1/1/2/2 → solo → Team 2/3/4/1, silently, and
     their answers would have scored for the wrong side.

     The board already keeps two rosters and swaps between them; this is the same
     idea one layer out. What the teams roster remembers is where each *player* was,
     by player id — never by index, for the reason `soloSeat` is keyed that way. */
  const teamSeat = Object.create(null);     // playerId -> the side this student chose
  let reseatTeams = false;                  // set on the way back, cleared once done
  function swapRoster(to){
    const from = to === 'solo' ? 'teams' : 'solo';
    reseatTeams = to === 'teams';
    /* Only `soloSeat` — who owns which row — is stashed. There used to be a second
       map beside it recording the index last sent to each phone, and it had to be
       stashed, cleared and restored in step with this one; it is gone, because
       seating now compares against what the room believes rather than against a
       memory of what it was told. */
    rosterStash[from] = { list: teams.slice(),
                          seat: Object.assign({}, soloSeat) };
    const back = rosterStash[to];
    teams.length = 0;
    Object.keys(soloSeat).forEach(k => delete soloSeat[k]);
    if(back){
      back.list.forEach(t => teams.push(t));
      Object.assign(soloSeat, back.seat);
    }else{
      /* Two placeholders rather than none: every board is built for at least two
         sides, and in solo the first two students to join claim them rather than
         landing under two empty rows. */
      const word = to === 'solo' ? 'Player ' : 'Team ';
      teams.push(newTeam(word + '1', true), newTeam(word + '2', true));
    }
    /* Millionaire's ladders are a parallel array and `active` is an index — both are
       about the list that has just been replaced. */
    if(Array.isArray(mState)) mState.length = 0;
    active = 0;
    /* The seats we just cleared have to be re-sent, or every phone keeps the number
       it was given under the old roster — the index-shift bug that paid a win to a
       team that no longer existed, one switch over. */
    lastPushedTeams = null;
  }

  S.onChange(id=>{
    if(id !== 'roster') return;
    swapRoster(Roster.mode);
    applyGameAvailability();
    renderRosterPick();
    renderScorebar();
    /* Seat whoever is already in the room rather than waiting for the next phone —
       in solo that fills the roster on the spot, and in teams it puts each handset
       back on the side its student chose. */
    if(buzzHost){ seatSoloPlayers(buzzHost.players()); seatTeamPlayers(buzzHost.players()); }
  });

  function motionOK(){
    try{ return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return true; }
  }

  /* ---- title sequence ----
     One sequence, per-game copy and colour — so the next game to want an ident is a
     line in INTROS, not another animation. Always skippable and always short: four
     seconds times four games times every lesson is real teaching time. Resolves
     when it's done or the moment anybody skips it, so callers can just await it. */
  const INTROS = {
    millionaire: { eyebrow:'Cambridge Empower C1', title:'MILLIONAIRE',
                   sub:'Eight rungs. One team at a time. No safety net.',
                   accent:'#FFC83D' },
    jeopardy:    { eyebrow:'Cambridge Empower C1', title:'JEOPARDY',
                   sub:'Pick your category. Pick your price. Answer it.',
                   accent:'#4FC3FF' },
    // violet, because the board's own yellow and blue are structural and both have
    // to read against whatever the stage is
    blockbusters:{ eyebrow:'Cambridge Empower C1', title:'BLOCKBUSTERS',
                   sub:'Yellow goes across. Blue goes down. Build your line.',
                   accent:'#C77DFF' },
    // a four-word title needs a smaller cap than a one-word one, or it runs off
    // the screen at the shared 11vw
    race:        { eyebrow:'Cambridge Empower C1', title:'RACE TO THE BOARD',
                   sub:'On your marks. Listen for the gap. Get there first.',
                   accent:'#3DFFA8', titleVw:'6.4vw' }
  };
  const introShown = Object.create(null);      // per session, for the 'once' setting

  function wantsIntro(game){
    if(themeOf(game) !== 'gameshow' || !INTROS[game]) return false;
    const mode = S.get('intro', game);
    if(mode === 'off') return false;
    if(mode === 'once' && introShown[game]) return false;
    return true;
  }

  function runIntro(game){
    const cfg = INTROS[game];
    introShown[game] = true;
    const el = document.getElementById('intro-overlay');
    document.getElementById('intro-eyebrow').textContent = cfg.eyebrow;
    document.getElementById('intro-title').textContent   = cfg.title;
    document.getElementById('intro-sub').textContent     = cfg.sub;
    el.style.setProperty('--accent', cfg.accent);
    el.style.setProperty('--title-vw', cfg.titleVw || '11vw');

    const ms = motionOK() ? 3600 : 1200;
    el.classList.toggle('still', !motionOK());
    el.classList.add('on');

    return new Promise(resolve=>{
      let done = false;
      const finish = ()=>{
        if(done) return; done = true;
        clearTimeout(timer);
        document.removeEventListener('keydown', skip, true);
        el.removeEventListener('click', skip);
        el.classList.remove('on', 'still');
        resolve();
      };
      const skip = e=>{ if(e.type==='keydown' && e.key==='Escape') return; finish(); };
      const timer = setTimeout(finish, ms);
      document.addEventListener('keydown', skip, true);
      el.addEventListener('click', skip);

      if(motionOK()){
        Sound.play('lock');
        setTimeout(()=>Sound.play('sting'), 620);
        setTimeout(()=>Sound.fanfare(), 1150);
      } else {
        Sound.play('sting');
      }
    });
  }

  /* ---- end-of-round banner ----
     One banner for any game that reaches an ending, so the next game to need one
     writes no markup. It sits above the team bar rather than over the board,
     because what a class wants to look at when a round ends is the board.

       showResult({ eyebrow, title, sub, tone:'gold'|'silver'|null,
                    actions:[{label, primary, onPick}] }) */
  let resultOnHide = null;
  /* Which showing of the banner is which. A banner that hides itself on a timer
     must only hide *its own* showing — a stale timer from a round's winner moment
     firing into the game's final results would take them down mid-read. */
  let resultSeq = 0;
  function showResult(cfg){
    const modal = document.getElementById('result-modal');
    resultSeq++;
    resultOnHide = cfg.onHide || null;
    document.getElementById('result-eyebrow').textContent = cfg.eyebrow || '';
    document.getElementById('result-title').textContent   = cfg.title || '';
    document.getElementById('result-sub').textContent     = cfg.sub || '';
    document.getElementById('result-card').className      = cfg.tone ? 'tone-'+cfg.tone : '';

    const acts = document.getElementById('result-actions');
    acts.innerHTML='';
    (cfg.actions||[]).forEach(a=>{
      const b=document.createElement('button');
      b.type='button'; b.textContent=a.label;
      if(a.primary) b.className='primary';
      b.addEventListener('click', ()=>{ hideResult(); if(a.onPick) a.onPick(); });
      acts.appendChild(b);
    });

    // sit above whatever the floor is — the team bar when it was down here, the
    // bottom of the screen now that it isn't. Same question every fit asks.
    modal.style.bottom = (window.innerHeight - Kit.floorTop() + 16) + 'px';
    modal.classList.add('on');
    if(cfg.onShow) cfg.onShow();
  }
  function hideResult(){
    document.getElementById('result-modal').classList.remove('on');
    const fn = resultOnHide; resultOnHide = null;
    if(fn) fn();
  }
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){ hideResult(); hideStandings(); }
  });

  /* ================= the standings, between questions =================
     **A running total cannot show movement, which is the whole reason this needed
     new state.** `score` is one number per competitor with no history, so nothing
     could say a team was third and is now first — and that, rather than the number
     itself, is what a class watches. The team bar carries the totals all game; this
     carries the *change*, which is only interesting for a moment and then is not.

     Two snapshots and nothing else: the scores as the question opened, and the
     ranking as the standings were last shown. Gains come from the first, arrows from
     the second. Deliberately not a per-question log — nothing yet asks "what happened
     in question four", and a store nobody reads is a store that goes stale silently.

     **It reads `teams`, exactly as the bottom strip does.** One source of numbers:
     two scoreboards that count separately will eventually disagree, and the one on
     the wall is the one thirty students believe. */
  let standingsBefore = null;      // score per competitor when the question opened
  let standingsRank   = null;      // place per competitor when last shown

  /* ---------- the score report ----------
     **A per-question ledger, for checking that points were given correctly** —
     asked for after the first ef-2a class paid a team 600 on a 500 card and nobody
     could say from where. One entry per question: the scores as it opened, the
     scores when the next one opened, the results record and the expected payout at
     the moment the slot paid. Actual gain (after minus before) against expected is
     the whole diagnostic: a discrepancy names the question it happened in.

     Persisted in localStorage so it survives into the staffroom after a lesson;
     capped, and cleared from the report screen rather than automatically, because
     the ledger of the game that just went wrong is the one thing not to throw
     away. Display only — nothing in the app reads it back. */
  const REPORT_KEY = 'engishism.scoreReport';
  let scoreReport = [];
  try{ scoreReport = JSON.parse(localStorage.getItem(REPORT_KEY) || '[]') || []; }catch(e){}
  function reportSave(){
    try{ localStorage.setItem(REPORT_KEY, JSON.stringify(scoreReport.slice(-200))); }catch(e){}
  }
  function reportCloseEntry(){
    const e = scoreReport[scoreReport.length - 1];
    if(e && !e.after){ e.after = teams.map(t => t.score); reportSave(); }
  }
  function reportOpenEntry(label){
    reportCloseEntry();
    scoreReport.push({ label, when: new Date().toISOString().slice(0, 19),
                       build: window.HUB_BUILD || null,
                       names: teams.map((t, i) => teamName(i)),
                       before: teams.map(t => t.score),
                       after: null, expected: null, results: null });
    reportSave();
  }
  /* A divider, written when a board starts. The ledger persists across games and
     across deploys — "Jeopardy" twice in one lesson is two different games the
     labels alone cannot separate, and which build produced an entry is the first
     question when a score reads wrongly after a fix. Closed as it is written
     (`after` set), so ledgerNote can never mistake it for an open question and a
     movement can never land inside it. */
  function reportGameStart(){
    reportCloseEntry();
    scoreReport.push({ divider: true, label: 'new game · ' + (activeGame || '?'),
                       when: new Date().toISOString().slice(0, 19),
                       build: window.HUB_BUILD || null,
                       names: [], before: [], after: [] });
    reportSave();
  }
  /* ---------- every point movement, named ----------
     The report used to *diff* scores and infer what happened, which is exactly how
     an unexplained 600 stays unexplained: a movement the diff cannot attribute
     reads as a mystery rather than as a line item. Every path that touches a score
     now writes a move — `{t, d, why}` — into the open entry, and the renderer
     checks the sum of a team's moves against its actual gain, so anything that
     still bypasses the ledger names itself as a discrepancy instead of hiding.

     **Called before the score moves, always.** A note that has to open its own
     entry snapshots `before` as it opens, and a snapshot taken after the movement
     would swallow it — the gain would read 0 against a move that says otherwise,
     a false alarm manufactured by the instrument itself. */
  function ledgerNote(team, delta, why){
    let e = scoreReport[scoreReport.length - 1];
    if(!e || e.after){
      /* A movement outside any question — a manual correction, a plain tile, the
         final clue — still lands somewhere with its name on it. */
      reportOpenEntry('between questions · ' + (activeGame || 'setup'));
      e = scoreReport[scoreReport.length - 1];
    }
    (e.moves = e.moves || []).push({ t: Number(team), d: delta, why: String(why || '') });
    reportSave();
  }
  /* Called after the slot pays. Expected = the slot at what it actually paid, plus
     the payout table's share for every other competitor the record says finished. */
  function reportPayout(slotTeam, paid){
    const e = scoreReport[scoreReport.length - 1];
    if(!e) return;
    e.results = Kit.round.results.list();
    const pay = roundPayout();
    e.expected = teams.map((t, i) =>
      i === slotTeam ? (paid || 0)
      : ((Kit.round.results.of(i) || {}).done ? (pay[i] || 0) : 0));
    reportSave();
  }
  window.HubReport = {
    list(){ return scoreReport.slice(); },
    clear(){ scoreReport = []; reportSave(); },
    show(){ renderScoreReport(); }
  };
  function renderScoreReport(){
    reportCloseEntry();
    const modal = document.getElementById('report-modal');
    const body  = document.getElementById('report-body');
    if(!modal || !body) return;
    body.innerHTML = '';
    if(!scoreReport.length){
      body.textContent = 'Nothing recorded yet \u2014 the ledger starts when a question opens.';
    }
    scoreReport.slice(-60).forEach(e=>{
      if(e.divider){
        const gh = document.createElement('div');
        gh.className = 'rp-game';
        gh.textContent = e.label + '   ' + (e.when || '') +
                         (e.build ? '   · build ' + e.build : '');
        body.appendChild(gh);
        return;
      }
      const row = document.createElement('div');
      row.className = 'rp-q';
      const h = document.createElement('div');
      /* An entry names its build only when it is not this one — a report read
         after a deploy says which entries predate the fix, and a normal report
         stays quiet. */
      h.className = 'rp-label';
      h.textContent = e.label + '   ' + (e.when || '') +
        (e.build && e.build !== window.HUB_BUILD ? '   · build ' + e.build : '');
      row.appendChild(h);
      const after = e.after || teams.map(t => t.score);
      (e.names || []).forEach((nm, i)=>{
        const gain  = (after[i] || 0) - (e.before[i] || 0);
        const moves = (e.moves || []).filter(m => m.t === i);
        const sum   = moves.reduce((a, m) => a + (m.d || 0), 0);
        const exp   = e.expected ? (e.expected[i] || 0) : null;
        if(!gain && !exp && !moves.length) return;
        /* With moves the check is exact: the sum of what the ledger says happened
           against what actually happened. A movement that bypassed the ledger \u2014
           the class of thing the unexplained 600 was \u2014 shows as the difference.
           Entries from before the ledger fall back to the old expected diff. */
        const off = moves.length ? sum !== gain : (exp != null && exp !== gain);
        const line = document.createElement('div');
        line.className = 'rp-team' + (off ? ' off' : '');
        const r = (e.results || []).filter(x => x.who === i)[0];
        line.textContent = nm + ': ' + (gain >= 0 ? '+' : '') + gain +
          (moves.length && off ? '  (the moves say ' + (sum >= 0 ? '+' : '') + sum + ')' : '') +
          (!moves.length && exp != null ? '  (expected ' + (exp >= 0 ? '+' : '') + exp + ')' : '') +
          (r ? '  \u00b7 ' + (r.done ? 'finished ' + ordinalReport(r.place) : 'answered') +
               ' at ' + (r.seconds || 0).toFixed(1) + 's' : '');
        row.appendChild(line);
        moves.forEach(m=>{
          const mv = document.createElement('div');
          mv.className = 'rp-move';
          mv.textContent = (m.d >= 0 ? '+' : '') + m.d + '  \u00b7 ' + (m.why || 'unlabelled');
          row.appendChild(mv);
        });
      });
      body.appendChild(row);
    });
    modal.classList.add('on');
  }
  function ordinalReport(n){ return n + ({1:'st',2:'nd',3:'rd'}[n] || 'th'); }

  function standingsOpen(){
    standingsBefore = teams.map(t => t.score);
    reportOpenEntry(activeGame + ' \u00b7 ' + ((roundDef() || {}).label || 'question') +
                    (currentClueValue ? ' \u00b7 ' + currentClueValue : ''));
  }

  /* Ordered, with the gain and the movement worked out. Separate from the drawing so
     a check can ask what the room is being shown without reading the DOM. */
  function standingsRows(){
    const was = standingsBefore || [];
    const rows = teams.map((t, i) => ({ i, name:t.name, pts:t.score,
                                        gain: t.score - (was[i] == null ? t.score : was[i]) }))
                      .sort((a, b) => b.pts - a.pts || a.i - b.i)
                      .map((r, n) => Object.assign(r, { place: n + 1 }));
    rows.forEach(r => {
      const before = standingsRank ? standingsRank[r.i] : null;
      /* No arrow the first time, rather than an arrow claiming everybody rose from
         nowhere. A competitor who joined mid-run has no previous place either. */
      r.moved = before == null ? 0 : before - r.place;
    });
    return rows;
  }

  function showStandings(cfg){
    const o = cfg || {};
    const rows = standingsRows();
    const host = document.getElementById('standings-rows');
    if(!host) return;
    document.getElementById('standings-eyebrow').textContent = o.eyebrow || '';
    document.getElementById('standings-title').textContent   = o.title || 'Standings';
    document.getElementById('standings-go').textContent      = o.action || 'Continue';

    /* **How many fit, measured against the floor that moves** — the same rule
       Quickfire's own leaderboard already followed and the reason its logic is here
       rather than there. The bar is taller with sixteen names on it than with two, so
       `Kit.floorTop()` is asked rather than restated. Columns come out of the rows,
       capped at four: past that a name is narrower than the names people have. */
    const rowH   = 38;
    const room   = Math.max(rowH, Kit.floorTop() - 210);
    const perCol = Math.max(1, Math.floor(room / rowH));
    const cols   = Math.max(1, Math.min(4, Math.ceil(rows.length / perCol)));
    const shown  = Math.min(rows.length, cols * perCol);
    host.style.setProperty('--scols', String(cols));
    host.style.setProperty('--srows', String(Math.max(1, Math.ceil(shown / cols))));
    host.classList.toggle('crowd', cols > 1);

    /* Built rather than templated: a competitor's name is typed by a teacher and
       `innerHTML` would take whatever they typed literally. */
    host.innerHTML = '';
    rows.slice(0, shown).forEach(r => {
      const row = document.createElement('div');
      row.className = 'st-row' + (r.gain > 0 ? ' scored' : '') +
                      (r.i === o.winner ? ' took' : '');
      const add = (cls, text) => {
        const el = document.createElement('span');
        el.className = cls; el.textContent = text; row.appendChild(el);
        return el;
      };
      add('st-place', String(r.place));
      /* Up, down, or held — as an arrow rather than a number, because "third to
         first" is read off the shape and nobody at the back is doing subtraction. */
      const mv = add('st-move', r.moved > 0 ? '▲' : r.moved < 0 ? '▼' : '·');
      mv.classList.add(r.moved > 0 ? 'up' : r.moved < 0 ? 'down' : 'level');
      add('st-name', r.name);
      add('st-pts',  String(r.pts));
      add('st-gain', r.gain > 0 ? '+' + r.gain : '');
      host.appendChild(row);
    });
    /* When even four columns cannot hold the room, say so rather than hiding the
       tail — the honest picture, and the one a leaderboard is for anyway. */
    if(rows.length > shown){
      const more = document.createElement('div');
      more.className = 'st-more';
      more.textContent = '+' + (rows.length - shown) + ' more';
      host.appendChild(more);
    }

    /* ---- the shuffle: open on the old order, then glide to the new ----
       **The movement is the picture; the arrows only describe it.** For a beat the
       rows sit where they were *before* this question — old slot, old place number —
       then everything slides to where it is now. Pure display: the DOM is already in
       the new order, each row is translated back to its old slot and released, so
       nothing downstream can ever read the old arrangement as data.

       The old slot is the row's position sorted by the *previous* ranking — the same
       `standingsRank` the arrows read — with newcomers holding their new slot (they
       have nowhere to arrive from). Rects are measured off the final layout, so the
       columns' flow never needs knowing.

       Skipped under `navigator.webdriver`: the suite reads place numbers off the
       rows, and for 0.9s they are deliberately the old ones. A check that wants the
       shuffle sets `window.HUB_SHUFFLE_ANYWAY` first — the same opt-in shape as the
       room bench's `?rack=auto`. */
    const drawn = [...host.querySelectorAll('.st-row')];
    const moving = rows.slice(0, shown).some(r => r.moved !== 0);
    const wantShuffle = S.get('standingsShuffle', activeGame) && moving &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      (!navigator.webdriver || window.HUB_SHUFFLE_ANYWAY);

    standingsRank = {};
    rows.forEach(r => { standingsRank[r.i] = r.place; });
    document.getElementById('standings-modal').classList.add('on');

    if(wantShuffle){
      const seen = rows.slice(0, shown);
      /* Every shown row's old slot, unique by construction: sort by previous place
         (new place stands in for a newcomer), new place breaking ties. */
      const oldOrder = seen.slice().sort((a, b) =>
        ((a.moved ? a.place + a.moved : a.place) - (b.moved ? b.place + b.moved : b.place)) ||
        (a.place - b.place));
      const slotOf = {};
      oldOrder.forEach((r, n) => { slotOf[r.i] = n; });
      const rects = drawn.map(el => el.getBoundingClientRect());
      host.classList.add('shuffling');            // transitions off while placing
      seen.forEach((r, n) => {
        const from = rects[slotOf[r.i]], here = rects[n];
        drawn[n].style.transform =
          'translate(' + (from.left - here.left) + 'px,' + (from.top - here.top) + 'px)';
        // the old place number rides in the old slot; the new one arrives with the move
        drawn[n].querySelector('.st-place').textContent = String(r.place + r.moved);
      });
      /* The release is guarded by a sequence, the `resultSeq` lesson: a stale timer
         from a previous open must not let a later shuffle go early. */
      const seq = ++showStandings.seq;
      setTimeout(()=>{
        if(seq !== showStandings.seq) return;
        host.classList.remove('shuffling');       // transitions back on — release
        seen.forEach((r, n) => {
          drawn[n].style.transform = '';
          drawn[n].querySelector('.st-place').textContent = String(r.place);
        });
      }, 1000);
    }
  }
  showStandings.seq = 0;

  function hideStandings(){
    document.getElementById('standings-modal').classList.remove('on');
  }

  /* Two competitors is a scoreboard nobody needs a screen for, and on a board with
     one question every few seconds it is an interruption rather than a moment. Asked
     here rather than at each call site so the answer cannot differ per board. */
  function standingsWanted(game){
    return !!S.get('roundWinBanner', game || activeGame) && teams.length >= 2;
  }

  /* The cards are built from the registry, so a game's icon, copy and badge live
     in its declaration rather than in a block of markup someone has to remember to
     edit. The CSS hangs off `.game-card[data-game]`, which is unchanged. */
  function renderGameCards(){
    const grid = document.querySelector('.game-grid');
    grid.innerHTML = '';
    GAMES.forEach(g=>{
      const card = document.createElement('div');
      card.className = 'game-card';
      card.dataset.game = g.id;
      card.innerHTML = g.card.icon +
        '<h3>' + g.title + '</h3>' +
        '<p>' + g.card.blurb + '</p>' +
        '<span class="badge">' + g.card.badge + '</span>';
      card.addEventListener('click', ()=>chooseGame(card.dataset.game));
      grid.appendChild(card);
    });
  }

  function chooseGame(id){
    activeGame = id;
    window.HubGames.setActive(id);
    S.setContext(activeGame);          // ⚙ opens on this game's tab from here on
    document.getElementById('page-title').textContent = HUB_GAME_TITLES[activeGame] || 'Game Hub';
    renderContentScreen();
    showScreen('screen-content-select');
  }
  renderGameCards();
  // the registry's redraw handle — a game registered after init can still get a card
  window.HubGames._bindRenderCards(renderGameCards);

  document.getElementById('change-unit').addEventListener('click', ()=>{
    document.getElementById('page-title').textContent='Game Hub';
    document.querySelector('.eyebrow').textContent = 'Cambridge Empower C1 · Classroom games';
    showScreen('screen-unit-select');
  });

  document.getElementById('back-to-games').addEventListener('click', ()=>{
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

  document.getElementById('new-game-btn').addEventListener('click', ()=>{
    activeGame=null; window.HubGames.setActive(null); selectedContent=[]; pool=[]; raceRunning=false;
    S.setContext(null);
    // park, don't close: the class stays joined on the same code for the next game
    parkBuzzRoom();
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

  /* ================= PERSISTENT TEAM BAR ================= */
  function renderScorebar(){
    const bar=document.getElementById('scorebar'); bar.innerHTML='';
    const playing = document.getElementById('screen-play').classList.contains('active');

    /* ---------- who is competing, on the bar rather than three clicks into settings ----------
       It lived in the settings panel first and that was the wrong home: it sits on the
       *All games* tab, because it is a room-wide fact rather than a per-game one, so a
       teacher had to leave the board, find the All games tab, hunt down Competition and
       change it there — for the one fact that the bar already *is*.

       The bar is where it belongs because the bar *is* the roster — add, rename,
       remove and reset all live here, it is on every screen, and switching it changes
       what the bar itself shows, so cause and effect are in one place. Sticky to the
       left edge, so a class of sixteen names scrolling past never takes it off screen. */
    /* **Not while a game is on.** The decision is made on the setup screen, because
       it cannot be un-made usefully once a board is running — sixteen people do not
       regroup into four teams without the roster being rebuilt, and rebuilding it
       bins the points. Leaving a control there that flips a label and changes
       nothing else is worse than not offering it. */
    if(!playing) bar.appendChild(rosterSwitch());

    /* Who is highlighted as on turn, and what a chip wears, are the game's own
       facts now — `turnTeam()` and `teamDecor(i)` on the registry, replacing the
       by-name branches that a new game had to be threaded into by hand. */
    const g  = playing ? gameDef() : null;
    const hi = !playing ? -1 : (g && g.turnTeam) ? g.turnTeam() : active;
    const step = (g && g.nudgeStep) || 1;   // manual +/- correction, in the game's own unit
    teams.forEach((t, i)=>{
      const el=document.createElement('div'); el.className='team'+(i===hi?' active':'');
      const dot = g ? (g.teamDecor(i) || '') : '';
      // two is the floor — every board is built for at least two sides — so the
      // remove button only appears above it, and it never appears on the last two
      // the remove control hides at the floor, so the floor is asked rather than restated
    const del = teams.length > Roster.floor()
      ? `<button class="tdel" title="Remove ${Roster.label()}">×</button>` : '';
      el.innerHTML = `${dot}<input class="tname" value="${t.name}"><button class="minus">−</button><span class="score">${t.score}</span><button class="plus">+</button>${del}`;
      el.addEventListener('click', (ev)=>{
        if(ev.target.closest('button') || ev.target.classList.contains('tname')) return;
        active = i; renderScorebar();
      });
      el.querySelector('.tname').addEventListener('change', e=>{
        t.name = e.target.value; t.auto = false; pushTeamNames(); });
      // noted before the score moves (the ledger's ordering rule) — a teacher's
      // correction used to be indistinguishable in the report from a scoring bug
      el.querySelector('.minus').addEventListener('click', ()=>{ ledgerNote(i, -step, 'teacher correction'); t.score-=step; renderScorebar(); renderClassLine(); });
      el.querySelector('.plus').addEventListener('click', ()=>{ ledgerNote(i, step, 'teacher correction'); t.score+=step; renderScorebar(); renderClassLine(); });
      const delBtn = el.querySelector('.tdel');
      if(delBtn) delBtn.addEventListener('click', ()=> removeTeam(i));
      bar.appendChild(el);
    });
    const addBtn=document.createElement('button'); addBtn.id='add-team-btn';
    addBtn.textContent='+ ' + Roster.Label();
    addBtn.addEventListener('click', ()=>{ Roster.add(); renderScorebar(); });
    bar.appendChild(addBtn);
    // icon-only in the header: the words cost more room than the button is worth,
    // and the tooltip still says what it does
    const resetBtn=document.createElement('button'); resetBtn.className='reset-btn';
    resetBtn.textContent='↺'; resetBtn.title='Reset points';
    resetBtn.addEventListener('click', ()=>{
      teams.forEach((t, i)=>{ if(t.score) ledgerNote(i, -t.score, 'points reset'); t.score=0; t.run=0; });
      renderScorebar(); renderClassLine(); });
    bar.appendChild(resetBtn);
    // adding a team, or renaming one, has to reach the phones — this is the one
    // place that runs on any change to the list, and the push skips a no-op
    pushTeamNames();
  }

  /* **One definition of the teams-or-solo control**, drawn in two places: the team
     bar between games, and the setup screen where the decision actually belongs. Two
     copies would be two things that could disagree about what the current mode is,
     which is the defect this project has paid for most. */
  const ROSTER_MODES = [
    { value:'teams', label:'Teams',
      blurb:'A name is a group of students. They pick a side when they join.' },
    { value:'solo',  label:'Individuals',
      blurb:'Everyone against everyone. The roster fills itself from the phones as they join.' }
  ];
  function rosterSwitch(){
    const seg = document.createElement('div');
    seg.id = 'roster-mode';
    ROSTER_MODES.forEach(m=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.value === 'solo' ? 'Solo' : m.label;   // the bar has no room for a sentence
      b.dataset.mode = m.value;
      b.className = (Roster.mode === m.value) ? 'on' : '';
      b.title = m.blurb;
      b.addEventListener('click', ()=>{ if(Roster.mode !== m.value) S.set('roster', m.value); });
      seg.appendChild(b);
    });
    return seg;
  }

  /* The setup screen's version: the same two values with room to say what each one
     means, because this is where a teacher chooses rather than corrects. */
  function renderRosterPick(){
    const mount = document.getElementById('roster-pick-opts');
    if(!mount) return;
    mount.innerHTML = '';
    ROSTER_MODES.forEach(m=>{
      const el = document.createElement('label');
      el.className = 'mode-opt' + (Roster.mode === m.value ? ' on' : '');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'rostermode'; input.value = m.value;
      input.checked = Roster.mode === m.value;
      input.addEventListener('change', ()=>{ if(input.checked) S.set('roster', m.value); });
      const txt = document.createElement('span');
      const strong = document.createElement('strong'); strong.textContent = m.label;
      txt.appendChild(strong);
      txt.appendChild(document.createTextNode(' \u2014 ' + m.blurb));
      el.appendChild(input); el.appendChild(txt);
      mount.appendChild(el);
    });
    /* What the room actually is right now, so the choice is made against the truth
       rather than against a guess: how many have joined, and what the roster holds. */
    const note = document.getElementById('roster-pick-note');
    if(note){
      note.textContent = Roster.solo()
        ? (buzzPlayers
            ? buzzPlayers + (buzzPlayers === 1 ? ' phone has joined' : ' phones have joined') +
              ' \u2014 ' + teams.length + ' on the roster.'
            : 'Nobody has joined yet. Players appear here as they scan the code above.')
        : teams.length + ' teams. Add, rename or remove them on the bar below.';
    }
  }

  function nextTurn(){ if(teams.length){ active=Kit.passTurn(teams.length, active); renderScorebar(); } }

  /* What to call a team when it has to be named in prose — a strip chip, a dot's
     tooltip, a board saying who just took a tile. A team index can outrun the list
     (a reply from a handset still holding a team that has since been removed), so
     this never returns undefined. */
  /* One definition of what a competitor is called, fallback included — a round's
     `ctx.teamName`, every banner and every phone push read through it. */
  function teamName(i){ return teams[i] ? teams[i].name : ('Team ' + (Number(i) + 1)); }

  /* ---------- one scoring path, so a mechanic is written once ----------
     Every award in the app goes through here. `opts.steal` halves the value (you
     get the chance the other team dropped, not the full prize) and `opts.streak`
     applies the run multiplier. Nothing ever subtracts: a missed question costs the
     opportunity, never the score. Returns what was actually awarded so the caller
     can say so on screen. */
  function award(teamIdx, base, opts){
    const t = teams[teamIdx];
    if(!t || !base) return 0;
    const o = opts || {};
    const halved = o.steal && !S.get('stealFullValue', activeGame);
    let value = halved ? base / 2 : base;
    /* The run is counted *before* this answer, so award() is always called before
       markRun(): the first answer of a streak pays face value, the second 1.5x and
       the third double. Marking first made the very first answer pay a bonus for a
       run that had not happened yet. */
    const mult = (o.streak !== false && S.get('streak', activeGame)) ? runMultiplier(t.run) : 1;
    value *= mult;
    /* Rounded to the game's own declared unit — `payStep`, 50 on the boards that
       score in hundreds (half a $100 tile is 50, and rounding that to the nearest
       100 handed a steal the full value), 1 everywhere else. Every value those
       boards produce is already a multiple of 50, so this rounds nothing away. */
    const g = gameDef();
    const step = (g && g.payStep) || 1;
    value = Math.max(step, Math.round(value / step) * step);
    /* The receipt line carries award's own arithmetic — the *paid* number with what
       was done to it on the way — because a report reader cannot re-derive a half
       or a multiplier from settings that may have changed since. */
    ledgerNote(teamIdx, value,
      (o.why || 'points') +
      (o.steal ? (halved ? ' · steal ½' : ' · steal') : '') +
      (mult > 1 ? ' · streak ×' + mult : ''));
    t.score += value;
    renderScorebar();
    renderClassLine();
    return value;
  }

  // two in a row is worth a little, three or more is worth doubling — and it has to
  // be visible in the moment or it is just arithmetic nobody notices
  function runMultiplier(run){ return run >= 2 ? 2 : run === 1 ? 1.5 : 1; }

  /* A correct answer extends that team's run and breaks everyone else's; a wrong one
     breaks their own. Kept in one place because four games would otherwise each get
     it slightly wrong. */
  function markRun(teamIdx, correct){
    if(!teams[teamIdx]) return;
    if(!correct){ teams[teamIdx].run = 0; return; }
    teams.forEach((t, i)=>{ t.run = (i === teamIdx) ? t.run + 1 : 0; });
  }

  /* ================= JEOPARDY ================= */
  let jeoRows = 0;

  function buildJeopardyBoard(){
    const cats = JEOPARDY_CATEGORIES.filter(c=>selectedContent.includes(c.id) && catAllowed(c));
    const board = document.getElementById('board');
    /* The count goes in a custom property and the stylesheet owns the track size.
       Writing `repeat(n, 1fr)` inline meant no media query could change it — a
       handset needs a fixed column width and a board that scrolls sideways, and
       an inline style cannot be overridden from CSS without !important. */
    board.style.setProperty('--jcols', cats.length);
    board.innerHTML='';
    cats.forEach(cat=>{
      const h=document.createElement('div');
      h.className='cat-header'; h.textContent=cat.name;
      board.appendChild(h);
    });
    jeoRows = Math.max(...cats.map(c=>c.clues.length));
    for(let r=0;r<jeoRows;r++){
      cats.forEach(cat=>{
        const clue=cat.clues[r];
        const tile=document.createElement('div');
        tile.className='tile'; tile.textContent='$'+clue.v;
        tile.dataset.row = r;
        tile.addEventListener('click', ()=> openJeopardyClue(cat, clue, tile));
        board.appendChild(tile);
      });
    }
    jPlantDailyDoubles();
    // captured now: tiles keep their value when used, but a rebuilt board may differ
    jBoardTotal = jBoardWorth();
    renderClassLine();
    fitJeopardyBoard();
    jTension();
  }

  /* In the lit theme the board deals itself in rather than simply appearing. The
     stagger is a CSS variable per cell, so there is no JS animation to keep in
     step — and like every other board measurement here, it can only run once the
     play screen is actually visible. */
  /* The shared deal-in stagger for every board that reveals its cells with the
     `.dealing` class and a per-cell `--i` the keyframe reads. Does nothing unless the
     board is lit and motion is allowed — a class waiting on a re-triggered animation
     is what this guards. The game's `stagger(container)` runs only after that guard,
     and sets `--i` on its own cells however it selects them; `ms` is how long the
     class stays on and MUST match the CSS animation length. (Bingo deals a different
     way — inline `animation` strings per cell — so it is not one of these.) */
  function dealStagger(stageId, container, stagger, ms){
    const stage = document.getElementById(stageId);
    if(!container || !stage || !stage.classList.contains('lit') || !motionOK()) return;
    stagger(container);
    container.classList.remove('dealing'); void container.offsetWidth;
    container.classList.add('dealing');
    setTimeout(()=>container.classList.remove('dealing'), ms);
  }

  function jDeal(){
    dealStagger('play-jeopardy', document.getElementById('board'), board => {
      // stagger on the diagonal, not on DOM order: a 12x6 board is 72 cells, so a flat
      // stagger takes 3 seconds and the class is waiting on it. Row+column caps the
      // wave at rows+columns steps — under a second — and reads as a sweep across the
      // board rather than a queue.
      const cols = Math.max(1, board.querySelectorAll('.cat-header').length);
      [...board.children].forEach((el, i)=>
        el.style.setProperty('--i', Math.floor(i/cols) + (i % cols)));
    }, 1600);
  }

  /* ---- Jeopardy's tension curve ----
     Millionaire has a ladder; Jeopardy's equivalent is what's at stake on the tile
     in play, with a slow floor that rises as the board empties. So a $500 clue
     late in a game is the brightest, hottest moment on the board, and an opening
     $100 is the coolest — which is what the show's lighting actually does.
     Same `--tension` contract as Millionaire, so the CSS is shared. */
  function jValueRange(){
    const vals = [];
    JEOPARDY_CATEGORIES.filter(c=>selectedContent.includes(c.id) && catAllowed(c))
      .forEach(c=>c.clues.forEach(cl=>vals.push(cl.v)));
    return vals.length ? { lo:Math.min(...vals), hi:Math.max(...vals) } : { lo:0, hi:1 };
  }
  /* The shared stage-tension gate. Every game show heats its board the same way:
     light the stage under the game-show skin, write a 0–1 `--tension` the CSS reads,
     and run the think-music bed while a question is live. Only two things are the
     game's own — the tension value and whether the bed should play — so a game hands
     those back from `compute(stage)`, which runs **only while the stage is lit** (the
     same early-out every copy had, so a game still computes nothing when it is off
     screen). Returns whether the stage is lit, for a game with extra lit-only work
     (Race toggles `.running`). A game whose stage markup is absent — an external file
     loaded before its board — is a safe no-op. Exposed on HubEnv for the external
     games, which reach `themeOf`/`activeGame`/`Sound`/`motionOK` only through it. */
  function stageTension(id, compute){
    const stage = document.getElementById('play-' + id);
    if(!stage) return false;
    const on = themeOf(id) === 'gameshow' && activeGame === id;
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return false; }
    const { t, live } = compute(stage);
    stage.style.setProperty('--tension', t.toFixed(3));
    if(live && motionOK()) Sound.bedStart(t); else Sound.bedStop();
    return true;
  }

  function jTension(atStake){
    stageTension('jeopardy', () => {
      const tiles = [...document.querySelectorAll('#board .tile')];
      const done  = tiles.filter(t=>t.classList.contains('used')).length;
      const floor = tiles.length ? done/tiles.length : 0;
      let stake = 0;
      if(atStake){
        const { lo, hi } = jValueRange();
        stake = hi > lo ? (atStake - lo)/(hi - lo) : 1;
      }
      // think music while a clue is on the table and unanswered — the show's own
      // habit, and the reason a class stops talking and starts thinking
      return { t: Math.min(1, 0.45*floor + 0.55*stake), live: !!atStake };
    });
  }

  /* The whole board has to be reachable without scrolling — a teacher can't scroll
     the projected image mid-game. Tiles used to take their height from a fixed 3:2
     aspect ratio, so the fewer categories you picked the taller they grew and the
     board ran off the bottom. Height is now driven by the space actually available
     and the rows share what's left; the type scales to whatever row height results. */
  function fitJeopardyBoard(){
    const board = document.getElementById('board');
    if(!board.children.length || !jeoRows) return;
    if(!Kit.fitToScreen(board)) return;        // play screen not visible yet
    board.style.gridTemplateRows = `auto repeat(${jeoRows}, minmax(0, 1fr))`;

    const tile = board.querySelector('.tile');
    if(tile){
      const th = tile.getBoundingClientRect().height;
      board.style.setProperty('--jt', Math.max(0.5, Math.min(1.3, th/84)).toFixed(3));
    }
    fitCategoryHeadings(board);
  }

  /* A category name has to fit the column it sits in, not the viewport. The type
     was sized with `1.05vw`, which holds it at 13px however narrow the column
     gets, so a 16-category board at 1280px gave each heading 51px of room and cut
     "Employment & Sectors" off mid-word — on the projected screen, where the
     heading is how the class knows what the column is.

     The longest *word* is the constraint: spaces can wrap, a word cannot break
     without becoming unreadable. Measured on a canvas rather than by growing the
     text and re-reading the layout, so it costs no reflow. If the webfont hasn't
     loaded (offline, which is a supported way to run this) the fallback face
     measures slightly differently, hence the 0.96 margin. */
  function fitCategoryHeadings(board){
    const heads = [...board.querySelectorAll('.cat-header')];
    if(!heads.length) return;
    const cs   = getComputedStyle(heads[0]);
    const ctx  = fitCategoryHeadings._ctx ||
                (fitCategoryHeadings._ctx = document.createElement('canvas').getContext('2d'));
    ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    /* Letter-spacing is em-based (the game show skin triples it to 0.09em) and
       canvas does not apply it, so add it back per character. Across a ten-letter
       word that is 0.9em — a fifth of a 51px column, the difference between
       fitting and clipping rather than a rounding detail. Being em-based it
       scales with the answer, so the ratio holds whatever size we land on. */
    const fs      = parseFloat(cs.fontSize) || 12;
    const trackEm = (parseFloat(cs.letterSpacing) || 0) / fs;
    let widest = 1;
    heads.forEach(h => h.textContent.trim().toUpperCase().split(/\s+/).forEach(w => {
      widest = Math.max(widest, ctx.measureText(w).width + w.length * trackEm * 100);
    }));
    const padding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const avail   = Math.max(10, heads[0].clientWidth - padding);
    /* The floor is a legibility floor, not a fitting one. Sizing purely to make
       the longest word fit reached 8px on a 16-category board — not clipped, and
       not readable from the back of a room either, which is the requirement that
       actually matters. Below 10.5px the word is allowed to break instead
       (overflow-wrap in the stylesheet), because two readable lines beat one
       unreadable one. A board this crowded is a sign to pick fewer sections. */
    const px = (avail / (widest / 100)) * 0.96;
    board.style.setProperty('--jch', Math.max(10.5, Math.min(14.1, px)).toFixed(2) + 'px');
  }

  /* ================= TOGETHER: THE CLASS AGAINST THE BOARD =================
     The scores still belong to teams — the team bar is the app's spine and every
     game feeds it — but the *game* is played against a number. Pooling at the
     display and at the ending, rather than changing how award() works, is what
     keeps this a mode rather than a second scoring system. */
  function jTogether(){ return activeGame === 'jeopardy' && !!S.get('jTogether', 'jeopardy'); }

  function jClassTotal(){ return teams.reduce((n, t) => n + (t.score || 0), 0); }

  // what the whole board is worth, so a target can be a share of it rather than a
  // number a teacher has to invent
  function jBoardWorth(){
    return [...document.querySelectorAll('#board .tile')]
      .reduce((n, t) => n + (Number((t.dataset.face || t.textContent).replace(/\D/g, '')) || 0), 0);
  }
  let jBoardTotal = 0;      // captured at build time: tiles keep their value when used

  function jTargetScore(){
    const pct = Number(S.get('jTarget', 'jeopardy')) || 0;
    return pct ? Math.round(jBoardTotal * pct / 100) : 0;
  }

  function renderClassLine(){
    const box = document.getElementById('j-class');
    if(!box) return;
    if(!jTogether()){ box.style.display = 'none'; return; }
    box.style.display = 'block';
    const got = jClassTotal(), target = jTargetScore();
    document.getElementById('j-class-score').textContent = 'Class $' + got;
    document.getElementById('j-class-target').textContent =
      target ? ('target $' + target) : ('board $' + jBoardTotal);
    const pct = target ? Math.min(100, Math.round(got / target * 100))
                       : (jBoardTotal ? Math.round(got / jBoardTotal * 100) : 0);
    const fill = document.getElementById('j-class-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('done', !!target && got >= target);
  }

  /* ---- asking the board for a hand ----
     A cooperative round needs a way to be stuck that is not failure. Each hint takes
     a slice off what the clue is worth, so the class is spending its own progress
     rather than being punished — and the decision to spend it is itself a
     conversation, which is the point. */
  let jHintsUsed = 0;

  /* A hint is either **authored** or generated. An item carrying `reveal:[…]` says
     what its next layer is — a definition, then the word in use, then its shape —
     which is the question bench's Story Reveal dynamic inside a tile: the clue opens
     terse and each layer costs a slice of what the tile pays. Anything without
     `reveal` falls back to the spelling hints, so 589 authored items are untouched
     and an author opts in per item rather than per bank. */
  function jHintLayers(item){
    const list = (item && Array.isArray(item.reveal)) ? item.reveal.filter(Boolean) : [];
    return list;
  }
  function jHintText(n, item){
    const layers = jHintLayers(item);
    if(layers.length) return layers[n - 1] || '';
    const word = String((item && item.answer) || '').trim();
    if(!word) return '';
    if(n === 1) return 'It starts with ' + word[0].toUpperCase() + '.';
    return word[0].toUpperCase() + ' ' + '_ '.repeat(Math.max(0, word.length - 1)).trim() +
           '  (' + word.length + ' letters)';
  }
  /* How many hints this clue has left. Two for a generated pair; an authored item
     has exactly as many as it was written with, so a reveal clue is never offered a
     layer that does not exist — the button standing there doing nothing is worse
     than it not being there. */
  function jHintsLeft(item){
    const layers = jHintLayers(item);
    return (layers.length ? layers.length : 2) - jHintsUsed;
  }

  /* On the same 50 grid the scoring uses. `award()` rounds Jeopardy values to 50s so
     that half of a $100 tile is worth 50 rather than being handed back in full — so
     a hint that leaves $49 on the card and then pays $50 is the card telling the room
     something untrue. Costing in 50s keeps shown and paid identical. */
  function jHintCost(){
    const pct = Number(S.get('jHintCost', 'jeopardy')) || 30;
    return Math.max(50, Math.round(currentClueValue * pct / 100 / 50) * 50);
  }

  function renderHintButton(){
    const btn = document.getElementById('hint-btn');
    if(!btn) return;
    /* Hints were built for `together`, where spending a slice of a clue is the
       cooperative mechanic and the hint itself is a crutch generated from the
       spelling. An **authored** reveal is a different thing: it is how the clue was
       written — a definition, then the word in use, then its shape — so it belongs
       to the clue rather than to a ruleset, and a competitive board should be able
       to offer it too. Still behind `jHints`, so a teacher can switch the whole
       idea off; and items without `reveal` are exactly as gated as before. */
    const authored = jHintLayers(currentClueItem).length > 0;
    const on = (jTogether() || authored) && S.get('jHints', 'jeopardy') && modalMode === 'jeopardy' &&
               currentClueItem && jHintsLeft(currentClueItem) > 0 && !jWager && currentClueValue > 50;
    btn.style.display = on ? 'inline-block' : 'none';
    if(on){
      btn.textContent = (jHintsUsed === 0 ? 'Need a hand? (−$' : 'One more? (−$') + jHintCost() + ')';
    }
  }

  document.getElementById('hint-btn').addEventListener('click', () => {
    if(!currentClueItem) return;
    const cost = jHintCost();
    jHintsUsed++;
    currentClueValue = Math.max(50, currentClueValue - cost);
    const hint = document.createElement('div');
    hint.className = 'clue-hint';
    hint.textContent = jHintText(jHintsUsed, currentClueItem);
    document.getElementById('clue-text').appendChild(hint);
    // the topline is where the value lives, so it has to say what the clue is worth now
    const top = document.getElementById('clue-topline');
    top.textContent = top.textContent.replace(/\$\d+/, '$' + currentClueValue);
    Sound.play('reveal');
    renderHintButton();
  });

  /* ================= JEOPARDY: THE CLASSIC RULES =================
     Three things the show has that this board never did. Each is its own switch;
     `jRules` is the preset that sets all three, because "play it like the show" is
     one decision rather than three. Choosing a preset *writes* the switches rather
     than shadowing them, so the rows underneath always say what is actually going
     to happen — and a teacher can then change one without leaving the preset in a
     state that lies. */
  /* **What the phones do is part of the mode, not a separate decision.** It was
     missing from these bundles at first, and the result read as the phone setting
     "overriding" the mode — it was not overriding anything, the mode simply had no
     opinion, so the row kept whatever it had last. A mode that describes how the
     round is played and says nothing about thirty handsets is only describing half
     of it.

     Writing it here rather than special-casing the phone layer keeps the property
     that makes presets debuggable: **the row in ⚙ always shows what will actually
     happen**, and a teacher who wants a different dynamic can change it afterwards
     without the mode quietly contradicting them. */
  const J_PRESETS = {
    // the plain game: the teacher marks, the phones sit out
    hub:     { jDailyDoubles:0, jDeduct:false,
               jTogether:false, jHints:false, round_default:'off',
               stealOnWrong:true, stealFullValue:false, keepControl:true, jAnswerSeconds:0 },
    // the show is a race for the floor, so that is what the handsets are for
    /* The show opens a missed clue to the other contestants and lets a correct
       answer keep the board, so the ruleset says both rather than leaving them to
       whatever was set last. */
    /* The show gives you seconds on the floor, and so does this — started by the
       buzz, ended by a klaxon the teacher can overrule. It is here and not in the
       other two bundles' spirit: a cooperative round should not have a countdown
       pressuring the class, and the plain hub game has no buzz to start it from. */
    /* The rebound pays in full, as the show plays it: whoever rings in after a miss
       earns what the clue was worth, not a consolation half. */
    /* `jFinalRound` is deliberately NOT written by Classic any more — deactivated
       after the first ef-2a class: it confused the room, gave everybody points at
       the moment the class expected a winner screen, and occupied the end-of-game
       beat. The toggle stays registered (default off) for a teacher who chooses
       it knowingly; the migration below clears the value Classic wrote onto
       devices before this. */
    classic: { jDailyDoubles:1, jDeduct:true,
               jTogether:false, jHints:false, round_default:'buzz',
               stealOnWrong:true, stealFullValue:true, keepControl:true, jAnswerSeconds:10 },
    /* Everything that sets one team against another is off here, and that is the
       whole mode: no hidden wager to find first, no steal, nothing deducted, no
       final round to overtake anyone in. What is left is the board and the room —
       and everyone types, because a clue paying what the class produced is the
       cooperative mechanic rather than a race anybody can lose. */
    together:{ jDailyDoubles:0, jDeduct:false,
               jTogether:true,  jHints:true, round_default:'write',
               stealOnWrong:false, stealFullValue:false, keepControl:false, jAnswerSeconds:0 }
  };
  /* Hand the bundles to the panel: the picker gets its own "Ruleset" section at
     the top of Jeopardy's settings, and every row a bundle touches says what the
     chosen mode set it to — so a teacher can see which switches belong to the
     mode without the mode owning them. */
  S.describePresets('jRules', J_PRESETS);
  let jApplyingPreset = false;
  S.onChange(id => {
    if(id !== 'jRules' || jApplyingPreset) return;
    const preset = J_PRESETS[S.get('jRules', 'jeopardy')];
    if(!preset) return;
    jApplyingPreset = true;
    Object.keys(preset).forEach(k => S.set(k, preset[k], 'jeopardy'));
    jApplyingPreset = false;
  });

  /* ---- Daily Doubles ----
     Hidden at build time and never drawn differently, because the whole point is
     that nobody knows where they are. `dataset` rather than a class, so no
     stylesheet can accidentally give one away. */
  /* Re-plantable, and it has to be. The modes only appear in the Lab, which only
     exists once a game is running — so picking Classic mid-board set the switch to 1
     and the board still had none, because planting happened at build time. Reported
     from a full playthrough: "no Daily Double ever appeared."

     Planting among the tiles **still unplayed** is what makes this safe: a Daily
     Double is hidden, so one that appears on an unplayed tile is indistinguishable
     from one that was always there — and a tile already answered must not become
     one, or a clue the room has seen would pay a wager. */
  function jPlantDailyDoubles(){
    const want = Math.min(Number(S.get('jDailyDoubles', 'jeopardy')) || 0, 3);
    const all  = [...document.querySelectorAll('#board .tile')];
    all.forEach(t => delete t.dataset.dd);
    const tiles = all.filter(t => !t.classList.contains('used'));
    if(!want || !tiles.length) return;
    /* Weighted towards the bottom of the board, as the show does it: a Daily Double
       on a $100 clue is worth nothing to find. Two passes of a shuffle biased by
       row keeps it simple without ever being predictable. */
    const pool = shuffle(tiles.slice()).sort((a, b) =>
      (Number(b.dataset.row) || 0) - (Number(a.dataset.row) || 0));
    pool.slice(0, Math.max(1, Math.min(want, Math.ceil(tiles.length / 4))))
        .forEach(t => { t.dataset.dd = '1'; });
  }

  let jWager = null;      // { team, amount, min, max, then } while a bet is being placed

  function jMaxWager(team){
    // the show: your score, or the biggest clue on the board, whichever is greater
    const hi = jValueRange().hi || 0;
    return Math.max(hi, (teams[team] && teams[team].score) || 0);
  }

  function renderWager(){
    if(!jWager) return;
    const t = teams[jWager.team];
    document.getElementById('wager-who').textContent =
      (t ? t.name : 'Team') + ' — ' + (t ? '$' + t.score : '');
    document.getElementById('wager-amount').textContent = '$' + jWager.amount;
    document.getElementById('wager-range').textContent =
      'anything from $' + jWager.min + ' to $' + jWager.max;
  }

  function setWager(v){
    if(!jWager) return;
    jWager.amount = Math.max(jWager.min, Math.min(jWager.max, Math.round(v)));
    renderWager();
  }

  /* The teacher places the bet, like every other click in this app — students never
     touch the device. The buttons are the amounts a room actually says out loud. */
  function openWager(team, opts){
    const max = opts.max != null ? opts.max : jMaxWager(team);
    jWager = { team, min: opts.min || 0, max, amount: opts.start != null ? opts.start : Math.min(max, 200),
               then: opts.then };
    document.getElementById('wager-panel').style.display = 'block';
    document.getElementById('clue-text').style.display = 'none';
    document.getElementById('clue-answer').style.display = 'none';
    hideAllActionButtons();
    document.getElementById('wager-ok').style.display = 'inline-block';

    const steps = document.getElementById('wager-steps');
    steps.innerHTML = '';
    [-500, -100, +100, +500].forEach(d => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wager-step';
      b.textContent = (d > 0 ? '+' : '−') + Math.abs(d);
      b.addEventListener('click', () => setWager(jWager.amount + d));
      steps.appendChild(b);
    });
    const quick = document.getElementById('wager-quick');
    quick.innerHTML = '';
    [['Nothing', () => jWager.min], ['Half', () => Math.round(jWager.max / 2)],
     ['Everything', () => jWager.max]].forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wager-quick-btn';
      b.textContent = label;
      b.addEventListener('click', () => setWager(fn()));
      quick.appendChild(b);
    });
    renderWager();
  }

  function closeWager(){
    jWager = null;
    document.getElementById('wager-panel').style.display = 'none';
    document.getElementById('clue-text').style.display = '';
    document.getElementById('wager-ok').style.display = 'none';
  }

  document.getElementById('wager-ok').addEventListener('click', () => {
    if(!jWager) return;
    const bet = jWager.amount, then = jWager.then;
    closeWager();
    if(then) then(bet);
  });

  /* ================= CONTENT SCREEN ================= */
  /* The round-type filter, above the list and on every board. Built from the round
     types **actually in this game's bank for this unit** — asked, never listed — so
     a board with nothing but Multiple Choice offers one chip and a unit that has
     not been converted offers none at all, which is the honest picture rather than
     a row of controls that would narrow nothing.

     It hides itself below two types: a filter with a single option is a control
     that cannot change anything, and a filter with none is a lie. */
  /* The game declares its own bank — this was a five-way switch on the game's
     name, the exact shape the registry exists to remove. */
  function bankForFilter(){
    const g = gameDef();
    return g ? (g.bank() || []) : [];
  }
  function renderRoundFilter(){
    const strip = document.getElementById('round-filter');
    if(!strip) return;
    /* Millionaire and Quickfire build their round when the rung opens, so the raw
       item says nothing — `asRound` is how a game declares what its bank becomes,
       and the chip on each row already reads through it. */
    const g = gameDef();
    const asRound = (g && g.asRound) || (x => x);
    const kinds = [];
    bankForFilter().forEach(it=>{
      const id = roundTypeOf(asRound(it));
      if(kinds.indexOf(id) === -1) kinds.push(id);
    });
    strip.innerHTML = '';
    if(kinds.length < 2){ strip.style.display='none'; selectedRounds.clear(); return; }
    strip.style.display = '';
    const label = document.createElement('span');
    label.className = 'rf-label'; label.textContent = 'Round types';
    strip.appendChild(label);
    kinds.forEach(id=>{
      const def = Kit.round && Kit.round.get ? Kit.round.get(id) : null;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rf-chip' + (selectedRounds.has(id) ? ' on' : '');
      b.dataset.round = id;
      b.textContent = id === 'plain' ? 'Plain question' : ((def && def.label) || id);
      b.addEventListener('click', ()=>{
        if(selectedRounds.has(id)) selectedRounds.delete(id); else selectedRounds.add(id);
        redrawContent();
      });
      strip.appendChild(b);
    });
    if(selectedRounds.size){
      const all = document.createElement('button');
      all.type='button'; all.className='rf-chip rf-all'; all.textContent='Show all';
      all.addEventListener('click', ()=>{ selectedRounds.clear(); redrawContent(); });
      strip.appendChild(all);
    }
  }
  /* A filter change rebuilds the list, so the ticks are gone — which is right: a
     tick on a row the filter has just removed would still be counted by
     `selectedContent` and would put back exactly what the teacher filtered out. */
  function redrawContent(){
    const list = document.getElementById('content-list');
    const help = document.getElementById('content-helptext');
    list.innerHTML=''; selectedContent=[];
    const g = gameDef();
    if(g) g.renderContent(list, help);
    renderRoundFilter();
    updateStartButton();
  }
  function renderContentScreen(){
    const list = document.getElementById('content-list');
    const help = document.getElementById('content-helptext');
    const rulesNote = document.getElementById('blockbusters-rules');
    const raceNote  = document.getElementById('race-rules');
    list.innerHTML='';
    selectedContent=[];
    selectedRounds.clear();          // a fresh game starts with everything in play
    raceNote.style.display='none';
    document.getElementById('race-mode').style.display='none';

    rulesNote.style.display='none';        // a game that wants it turns it on
    /* Asked on every game, because every board plays both ways now — and asked here
       rather than left to whatever the last lesson used, so the teacher sees what
       they are about to start. */
    renderRosterPick();
    const g = gameDef();
    if(g) g.renderContent(list, help);
    renderRoundFilter();
    updateStartButton();
  }

  /* Most games pick whole sections; Jeopardy picks named categories. Both end up
     as `.cat-check` rows, so one builder covers them. */
  /* What a teacher can tick. Jeopardy has always offered its named categories;
     the other three offered only the section, so "5A" meant 25 crime words *and*
     nine relative pronouns in one lump with no way to pick the half you taught.

     An item's group is its `topic` when it has one and its `section` otherwise, so
     a bank that has not been tagged behaves exactly as before. Counts are computed
     from the bank at render time rather than written into the label by hand —
     the hand-written ones have drifted before, and the content gate exists to
     catch that. */
  const groupOf = item => (item && item.topic) || (item && item.section) || '';

  /* ---------- the two axes a teacher picks along ----------
     Content is filed on **three** facts and only two of them are authored: the
     section (5A) and the topic (5A-vocab) are written on every item, and the round
     type is *derived* from the item's own fields by `Kit.round.of()` — never
     labelled, so a round written next month files its own content for free.

     Picking used to happen along one axis and it differed by board: Jeopardy's
     rows are round types, everybody else's are topics. So "just the Connections"
     was answerable on one board and not on the other four, for no reason a teacher
     could see. `selectedRounds` is the missing axis, and because both axes end in
     one predicate, a board narrows by calling `inPlay` rather than by learning
     about either of them.

     Empty means all — the honest default for a filter nobody has touched, and it
     keeps every existing board exactly as it was. */
  let selectedRounds = new Set();
  const roundTypeOf = item => {
    const hit = Kit.round && Kit.round.of ? Kit.round.of(item) : null;
    return hit ? hit.id : 'plain';
  };
  const typeAllowed = item => !selectedRounds.size || selectedRounds.has(roundTypeOf(item));
  /* Both axes at once. This replaced `selectedContent.includes(groupOf(x))`, which
     was written out in eight places — so the round-type half would have had to be
     threaded into all eight by hand, which is the defect this project has paid for
     most. One predicate, and a seventh game gets both axes by filtering with it. */
  const inPlay = item => selectedContent.includes(groupOf(item)) && typeAllowed(item);
  /* A Jeopardy category is filtered whole, never clue by clue: the board indexes
     tiles by row and a column short of one clue is `undefined`, not a shorter
     column. Each category is one round type in the converted units, so whole-column
     filtering is also what a teacher means; a mixed category shows if any of its
     clues qualifies, and its chip already says it is mixed. */
  const catAllowed = cat => !selectedRounds.size || (cat.clues || []).some(typeAllowed);

  /* ---------- what kind of questions are behind a tick box ----------
     Reported as: on the content screen you cannot tell a clue the room **plays** on
     their phones from one the teacher simply reveals — and those are two completely
     different lessons, so choosing between them blind is choosing blind.

     **Asked of the round registry, never labelled on the category.** A category that
     declared "I hold rounds" would be a second copy of a fact its items already
     carry, and it would be wrong the first time somebody edited one — the same
     list-kept-in-step-by-hand defect this project keeps paying for. `Kit.round.of()`
     reads the item's own fields, so a round written next month labels its content
     here with nothing added.

     One helper for every board, because all three content builders end up as
     `.cat-check` rows: Jeopardy picks named categories, the rest pick sections, and
     a teacher should not have to learn two vocabularies for one distinction. It is
     the same split the question bench draws in its menu. */
  function contentKind(items){
    const seen = {};
    let plain = 0;
    (items || []).forEach(it => {
      /* Through the game's own normaliser first. A round can be *derived* rather
         than authored — Millionaire's is — and asking the raw item then reports a
         whole ladder of rounds as ordinary questions. */
      const hit = Kit.round.of(hook('asRound', it) || it);
      if(hit) seen[hit.id] = (seen[hit.id] || 0) + 1; else plain++;
    });
    const ids = Object.keys(seen);
    const label = id => (Kit.round.get(id) || {}).label || id;
    if(!ids.length)                    return { cls:'q', text:'Question' };
    if(!plain && ids.length === 1)     return { cls:'r', text:'Round \u00b7 ' + label(ids[0]) };
    if(!plain)                         return { cls:'r', text:'Rounds \u00b7 ' + ids.length + ' types' };
    const n = ids.reduce((a, id) => a + seen[id], 0);
    return { cls:'m', text:'Mixed \u00b7 ' + n + ' round' + (n === 1 ? '' : 's') };
  }
  const kindChip = items => {
    const k = contentKind(items);
    return `<span class="kind kind-${k.cls}">${k.text}</span>`;
  };

  /* ---- one shape for every content screen ----
     A teacher picking content should not have to learn a second vocabulary
     because they picked a different board. Jeopardy grouped its rows under
     section headings and showed no counts; every other game showed a flat list
     with counts and no headings, and repeated the section inside each row's own
     label. Same job, two layouts, and the markup was written out twice.

     The standard, and it is the same whatever the board and whatever the unit:

         <section heading>
         [ ] [5A]  Topic or round             ROUND · CONNECTIONS   (n)

     the tick, the section tag, what the row *is*, and what kind of questions are
     behind it. `contentRow` builds it and `sectionHeading` draws the heading, so
     a sixth game gets the layout by calling them rather than by copying it. */
  function sectionHeading(list, text){
    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = text;
    list.appendChild(label);
  }
  function contentRow(list, { value, section, label, items, count }){
    const div = document.createElement('label');
    div.className = 'cat-check';
    const n = count == null ? (items || []).length : count;
    div.innerHTML = `<input type="checkbox" value="${value}">` +
                    (section ? `<span class="tag">${section}</span>` : '') +
                    `<span class="name">${label}</span>` +
                    kindChip(items || []) +
                    `<span class="count">${n}</span>`;
    div.querySelector('input').addEventListener('change', onContentToggle);
    list.appendChild(div);
  }
  /* A topic name is authored with its section on the front — "5A · Relative
     clauses" — which was right when the row was the only thing on screen. With a
     heading above it and a tag beside it the section is now said three times, so
     the row drops it. */
  const stripSection = (label, sec) =>
    String(label).replace(new RegExp('^\\s*' + sec + '\\s*[·\\-–]\\s*', 'i'), '');

  function groupCheckboxes(list, bank, topicNames, sectionNames){
    const seen = [];
    bank.forEach(i=>{ const g = groupOf(i); if(g && seen.indexOf(g) === -1) seen.push(g); });
    // keep the reading order of the bank, which is section order
    seen.sort();
    let lastSection = null;
    seen.forEach(g=>{
      /* Counts follow the filter, so the number beside a topic is how many
         questions that tick actually puts in play — not how many exist. */
      const items = bank.filter(i => groupOf(i) === g && typeAllowed(i));
      if(!items.length) return;             // nothing of the chosen kinds in here
      const sec = String(g).split('-')[0];
      if(sec !== lastSection){
        /* The section name without its own count — the rows carry those, and a
           heading that also counted would be a second number to keep in step. */
        const head = (sectionNames && sectionNames[sec])
          ? String(sectionNames[sec]).replace(/\s*\(\d+[^)]*\)\s*$/, '')
          : sec;
        sectionHeading(list, head);
        lastSection = sec;
      }
      const raw = (topicNames && topicNames[g]) ||
                  (sectionNames && sectionNames[g] && sectionNames[g].split('·').slice(1).join('·').replace(/\s*\(\d+[^)]*\)\s*$/, '')) ||
                  g;
      contentRow(list, { value:g, section:sec, label:stripSection(raw, sec), items });
    });
  }

  function sectionCheckboxes(list, names){
    Object.keys(names).forEach(sec=>{
      const div=document.createElement('label');
      div.className='cat-check';
      div.innerHTML = `<input type="checkbox" value="${sec}"><span class="tag">${sec}</span><span class="name">${names[sec].split('·')[1]}</span>`;
      div.querySelector('input').addEventListener('change', onContentToggle);
      list.appendChild(div);   // dead code — see the note above; it would want contentRow
    });
  }

  function renderJeopardyContent(list, help){
    help.textContent = "Pick which categories to include — the board builds itself from your selection (choose at least 3).";
    let lastSection=null;
    JEOPARDY_CATEGORIES.forEach(cat=>{
      if(!catAllowed(cat)) return;
      if(cat.section!==lastSection){
        sectionHeading(list, JEOPARDY_SECTION_LABELS[cat.section] || cat.section);
        lastSection=cat.section;
      }
      contentRow(list, { value:cat.id, section:cat.section,
                         label:stripSection(cat.name, cat.section), items:cat.clues });
    });
  }

  function renderBlockbustersContent(list, help){
    document.getElementById('blockbusters-rules').style.display='block';
    help.textContent = "Pick the topics that feed the board. Each clue's answer starts with the letter shown on its hexagon.";
    groupCheckboxes(list, BLOCKBUSTERS_BANK, BLOCKBUSTERS_TOPIC_NAMES, BLOCKBUSTERS_SECTION_NAMES);
  }

  function renderMillionaireContent(list, help){
    help.textContent = "Pick the topics that feed the ladder. Each team climbs its own eight rungs, taking turns, and the questions get harder as they go.";
    groupCheckboxes(list, MILLIONAIRE_BANK, MILLIONAIRE_TOPIC_NAMES, MILLIONAIRE_SECTION_NAMES);
  }

  function renderRaceContent(list, help){
    document.getElementById('race-rules').style.display='block';
    document.getElementById('race-mode').style.display='block';
    renderRaceRules();
    help.textContent = "Pick the topics that feed the board \u2014 the vocabulary and the grammar of each section are separate, so you can drill just what you taught. Every word on screen is a target word from your selection.";
    groupCheckboxes(list, RACE_BANK, RACE_TOPIC_NAMES, RACE_SECTION_NAMES);
  }

  function onContentToggle(){
    selectedContent = [...document.querySelectorAll('#content-list input:checked')].map(i=>i.value);
    updateStartButton();
  }

  /* Each game says whether the selection is playable and what the button should
     read. Saying *why* it isn't playable yet is the point — "add another section"
     beats a greyed-out button with no explanation. */
  function updateStartButton(){
    const btn = document.getElementById('start-btn');
    const g = gameDef();
    if(g) g.startButton(btn);
  }

  /* The start button for a board that fills from a shuffled pool: disabled until a
     section is picked and the pool is deep enough, carrying the label that says which.
     `short` is the board's own "Need N …" line and `ready` its "Build …"/"Deal …" one;
     the empty prompt and the "— N selected, add another topic" tail are identical for
     every such board, which is what this owns. (Jeopardy counts categories, Millionaire
     needs a full ladder and Quickfire just needs one section — each a different gate,
     so none of those three is one of these.) On HubEnv for the external games. */
  function startGate(btn, o){
    if(!o.picked){ btn.disabled = true; btn.textContent = 'Select at least one section'; return; }
    if(o.total < o.need){
      btn.disabled = true;
      btn.textContent = `${o.short} — ${o.total} selected, add another topic`;
      return;
    }
    btn.disabled = false;
    btn.textContent = o.ready;
  }

  function jeopardyStartButton(btn){
    btn.disabled = selectedContent.length < 3;
    btn.textContent = selectedContent.length < 3
      ? `Select at least 3 categories to build the board (${selectedContent.length} chosen)`
      : `Build board with ${selectedContent.length} categories`;
  }

  function blockbustersStartButton(btn){
    const total = BLOCKBUSTERS_BANK.filter(inPlay).length;
    startGate(btn, { picked: selectedContent.length > 0, total, need: BB_TOTAL,
      short: `Need ${BB_TOTAL} clues for a full board`,
      ready: `Build board — ${BB_TOTAL} of ${total} clues, shuffled` });
  }

  function millionaireStartButton(btn){
    const pool = MILLIONAIRE_BANK.filter(inPlay);
    const rungs = new Set(pool.map(q=>q.level));
    const missing = M_LADDER.map((_,i)=>i+1).filter(l=>!rungs.has(l));
    btn.disabled = selectedContent.length===0 || missing.length>0;
    btn.textContent = selectedContent.length===0 ? 'Select at least one section'
      : missing.length ? `Not enough for a full ladder — nothing at level ${missing.join(', ')}`
      : `Build ladder — ${pool.length} questions across 8 rungs`;
  }

  function raceStartButton(btn){
    const total = RACE_BANK.filter(inPlay).length;
    startGate(btn, { picked: selectedContent.length > 0, total, need: RACE_MIN_WORDS,
      short: `Need ${RACE_MIN_WORDS} words for a board`,
      ready: `Build board — ${Math.min(total, RACE_MAX_WORDS)} of ${total} words, shuffled` });
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  document.getElementById('start-btn').addEventListener('click', ()=>{
    const g = gameDef();
    if(!g) return;
    GAMES.forEach(x => { document.getElementById(x.stage).style.display='none'; });
    document.getElementById(g.stage).style.display='block';
    // a new game is a new lesson: whatever a round was keeping per student goes
    roundKeepReset();
    reportGameStart();
    g.start();
    syncBuzzRoom();
    showScreen('screen-play');
    g.fit();          // no board can be measured until the play screen is visible
    timerReset();

    /* The intro plays over the finished board rather than before it is built, so
       the first thing behind the titles is the real thing, and skipping drops you
       straight into a game that is already running. */
    const curtainUp = id=>{
      if(activeGame !== id) return;          // they navigated away mid-titles
      const d = gameDef(id);
      if(d){ d.tension(); d.deal(); }
    };
    if(wantsIntro(activeGame)){
      const id = activeGame;
      runIntro(id).then(()=>curtainUp(id));
    } else {
      curtainUp(activeGame);
    }
  });

  /* ================= BLOCKBUSTERS ================= */
  const BB_ROWS  = [5,4,5,4];                        // the classic board
  const BB_TOTAL = BB_ROWS.reduce((a,b)=>a+b,0);    // how many clues fill it — derive, never re-type

  /* ---- more than two teams on a two-sided board ----
     The board is structurally two-sided: yellow connects left→right, blue connects
     top→bottom, and there is no third route for a third team to win by. So a class
     split into four cannot each have their own colour here — but they can all play,
     as **two alliances**: odd teams on yellow, even on blue, each scoring its own
     points while the *line* belongs to a side.

     `bbSideOf` is the whole mechanism, and with exactly two teams it is the identity
     — team 0 is yellow, team 1 is blue — so nothing about the two-team game changes.
     Within a side the teams take it in turn, so a four-team class rotates
     Lions → Tigers → Bears → Wolves across the two colours rather than two students
     playing the whole game. */
  function bbSideOf(teamIdx){ return teamIdx % 2; }
  function bbTeamsOn(side){ return teams.map((_, i) => i).filter(i => bbSideOf(i) === side); }
  let bbSideAt = [0, 0];   // which of that side's teams is up next
  function bbTeamOnTurn(){
    const list = bbTeamsOn(bbTurn);
    if(!list.length) return bbTurn;                    // no team on this side yet
    return list[bbSideAt[bbTurn] % list.length];
  }
  // the side's turn has been used, so the next one goes to that side's next team
  function bbAdvanceSide(side){
    const list = bbTeamsOn(side);
    if(list.length > 1) bbSideAt[side] = (bbSideAt[side] + 1) % list.length;
  }

  function renderBBTurn(){
    const g=document.querySelector('#legend .legend-gold');
    const s=document.querySelector('#legend .legend-silver');
    if(g) g.classList.toggle('active-turn', bbTurn===0);
    if(s) s.classList.toggle('active-turn', bbTurn===1);
    /* Name who is actually playing each colour. With two teams this says what the
       team bar already says; with four it is the only place that says which of
       Lions and Bears is up. */
    /* Marked with a class, never shouted in the markup: the name a teacher typed is
       the name that should be in the DOM, and anything reading the legend — a test,
       a screen reader — should see it as typed. CSS does the emphasis. */
    const label = (el, side) => {
      if(!el) return;
      const list = bbTeamsOn(side);
      const on   = bbTeamOnTurn();
      let host = el.querySelector('.legend-teams');
      if(!host){ host = document.createElement('span'); host.className = 'legend-teams'; el.appendChild(host); }
      host.innerHTML = '';
      list.forEach((i, k) => {
        if(k) host.appendChild(document.createTextNode(' / '));
        const n = document.createElement('span');
        n.className = 'legend-team' + (i === on && bbTurn === side ? ' on' : '');
        n.textContent = teams[i] ? teams[i].name : ('Team ' + (i+1));
        host.appendChild(n);
      });
      if(list.length) host.insertBefore(document.createTextNode(' — '), host.firstChild);
    };
    label(g, 0);
    label(s, 1);
  }

  /* ---- the bench votes for the hexagon ----
     Blockbusters' weakness is that two students play and the rest watch: one
     person picks the hex, one person answers, and a class of thirty has nothing to
     do between clues. So the team on turn chooses its next hexagon on their phones
     — every one of them, not the loudest one — and the counts land on the board.

     Deliberately advisory. The teacher still clicks the hex, because that is the
     app's constraint everywhere (students never touch the device) and because a
     vote that opened a clue by itself would make a mis-tap unrecoverable. The
     leading hexagon is outlined; taking their advice is one click, ignoring it is
     a different click. */
  let bbVote = null;      // Kit.vote while the team is choosing
  let bbVoting = false;   // ...and whether it is still open

  // What is left to attack. Two hexes can carry the same letter, so the options are
  // the *distinct* letters — a vote names a letter and the board shows every hex
  // holding it, which is also how a student reading the board would say it.
  function bbOpenLetters(){
    const out = [];
    document.querySelectorAll('#hexwrap .hex').forEach(h=>{
      if(h.classList.contains('claimed-gold') || h.classList.contains('claimed-silver')) return;
      const l = (h.dataset.letter || h.textContent || '').trim();
      if(l && out.indexOf(l) === -1) out.push(l);
    });
    return out;
  }

  function bbAskTeam(){
    if(!buzzHost || bbWon) return;
    const letters = bbOpenLetters();
    if(!letters.length) return;
    const onTurn = bbTeamOnTurn();
    bbVote   = Kit.vote.open({ options:letters, team:onTurn });
    bbVoting = true;
    const who = teams[onTurn] ? teams[onTurn].name : (bbTurn === 0 ? 'Yellow' : 'Blue');
    askClass(who + ' — which letter next?', 'vote', letters, onTurn);
    renderBBVote();
  }

  /* Closing hands the phones back — the vote borrows the room, it does not own it.
     Unlike Millionaire's Done voting there is no question live to hand them back
     *to*: the team has chosen, and the clue they chose has not been opened yet. So
     the phones go quiet and the next hexagon arms them, which is what `phoneMode`
     already does on every other board.

     `keep` leaves the numbers up: they are the team's decision, and the teacher is
     about to click on the hexagon they name. */
  function bbCloseVote(keep){
    if(!bbVoting) return;
    bbVoting = false;
    if(bbVote) bbVote.close();
    if(!keep) bbVote = null;
    if(activeGame === 'blockbusters') parkBuzzRoom();
    renderBBVote();
  }

  /* Where the numbers go was the one thing here that had to be got wrong first.
     A count drawn *on* the hexagon reads perfectly until two hexagons share a
     letter — and they nearly always do, because a board of eighteen from a vocab
     bank clusters on common initials. One vote for R then painted "1" on three
     separate hexagons, which any room would read as three votes.

     So the vote is for a **letter**, and the letters are counted once, in a strip
     beside the legend. The board's job is to show where that lands: every hexagon
     carrying the leading letter lights up, which is also the honest picture —
     the team said R, there are three, and the teacher picks which. */
  // its own button, filed with its own game — it sat in the Millionaire block once
  document.getElementById('bb-ask').addEventListener('click', ()=>{
    if(bbVoting) bbCloseVote(true); else bbAskTeam();
  });
  function renderBBVote(){
    const btn = document.getElementById('bb-ask');
    const on  = activeGame === 'blockbusters' && !!buzzHost && !bbWon &&
                S.get('bbTeamVote', 'blockbusters');
    if(btn){
      btn.style.display = on ? 'inline-block' : 'none';
      const onTurn = bbTeamOnTurn();
      btn.textContent = bbVoting ? 'Done choosing'
                                 : ((teams[onTurn] ? teams[onTurn].name : 'Team') + ' picks');
      btn.className = bbVoting ? 'voting' : '';
    }
    const lead  = bbVote && bbVote.leader();
    const strip = document.getElementById('bb-tally');
    if(strip){
      const rows = bbVote ? bbVote.options.filter(o=>bbVote.counts[o] > 0)
                                 .sort((a,b)=>bbVote.counts[b] - bbVote.counts[a]) : [];
      strip.innerHTML = '';
      strip.style.display = rows.length ? 'inline-flex' : 'none';
      rows.forEach(o=>{
        const el = document.createElement('span');
        el.className = 'bb-vote-count' + (lead && !lead.tied && o === lead.option ? ' lead' : '');
        el.dataset.letter = o;
        el.textContent = o + ' ' + bbVote.counts[o];
        strip.appendChild(el);
      });
    }
    document.querySelectorAll('#hexwrap .hex').forEach(h=>{
      const letter = (h.dataset.letter || h.textContent || '').trim();
      const claimed = h.classList.contains('claimed-gold') || h.classList.contains('claimed-silver');
      h.classList.toggle('pick', !!lead && !lead.tied && !claimed && letter === lead.option);
    });
  }

  function buildBlockbustersBoard(){
    const wrap=document.getElementById('hexwrap');
    wrap.innerHTML='';
    let idx=0;
    BB_ROWS.forEach((size, r)=>{
      for(let c=0; c<size; c++){
        const clueObj = pool[idx++];
        if(!clueObj) return;
        const hex=document.createElement('div');
        hex.className='hex';
        hex.textContent=clueObj.letter;
        /* The letter also lives in a data attribute: claiming a hex empties its
           text, and the vote still has to know which letter that hex was. */
        hex.dataset.letter=clueObj.letter;
        hex.dataset.row=r; hex.dataset.col=c;
        hex.addEventListener('click', ()=> openBlockbustersClue(clueObj, hex));
        wrap.appendChild(hex);
      }
    });
    layoutBlockbustersBoard();
  }

  /* Positions are worked out from the hexagons' *rendered* width, which is a vw
     clamp — so this can only run once the play screen is visible. It used to be
     done at build time behind a hidden screen, where the measurement came back 0
     and fell back to a hard-coded 90px step: at 1440px wide the hexes render at
     116px and so overlapped by 21px. Kept separate from building so a resize
     repositions without rebuilding, which also means claimed hexes keep their
     colour instead of being restored by index. */
  function layoutBlockbustersBoard(){
    const wrap  = document.getElementById('hexwrap');
    const hexes = [...wrap.querySelectorAll('.hex')];
    if(!hexes.length) return false;

    /* `offsetWidth`, not `getBoundingClientRect()`: the rect is the *painted* width,
       so an ancestor's scale is baked into it. `#play-blockbusters` carries a 350ms
       transform transition, and the banner scales the board to sit above it — so
       "New board" cleared the scale and measured one frame later, mid-transition,
       at 0.84 of the real size. The hexes were then spaced for a 92px hex and
       rendered at 110, overlapping by 41px; a resize fixed it, which is exactly why
       leaving and coming back looked fine. Layout width ignores both that and the
       hexes' own deal animation. */
    const w = hexes[0].offsetWidth || hexes[0].getBoundingClientRect().width;
    if(!w) return false;                 // not on screen yet — caller re-runs later

    const h       = w * 1.1547;
    const gap     = Math.max(4, w * 0.06);
    const colStep = w + gap;
    // a vertical step of gap leaves only gap*cos(30) between the slanted edges, so
    // diagonal neighbours looked tighter than side-by-side ones; this evens them up
    const rowStep = h * 0.75 + gap * 1.1547;
    const boardW  = Math.max(...BB_ROWS) * colStep - gap;

    /* ---- the team edges ----
       The show's own grammar, drawn rather than only written in the legend: a
       yellow band down each side (yellow crosses left to right), a blue band along
       the top and the bottom (blue descends) — **continuous zig-zag ribbons that
       follow the outer contour of the hexagons**, not straight bars, because a
       straight bar cuts across the notches and separate teeth read as decoration.
       Each band is one div clipped to a polygon traced from the same measured
       geometry the board is laid out from: the inner path hugs the silhouette a
       breath off the faces, the outer path is the same points shifted out by the
       band's thickness. Rebuilt on every layout, because every number here comes
       from the measured hex width. */
    wrap.querySelectorAll('.bb-band').forEach(e => e.remove());
    const edges = S.get('bbEdges', 'blockbusters');
    const bt  = w * 0.18;                // band thickness
    const bg  = gap * 0.8;               // breathing room off the hex faces
    const pad = edges ? bt + bg + 2 : 0;

    hexes.forEach(hex=>{
      const r = +hex.dataset.row, c = +hex.dataset.col;
      const rowW   = BB_ROWS[r] * colStep - gap;
      const startX = (boardW - rowW) / 2;
      hex.style.left = (pad + startX + c*colStep) + 'px';
      hex.style.top  = (pad + r*rowStep) + 'px';
    });

    if(edges){
      const band = (cls, pts)=>{
        const d = document.createElement('div');
        d.className = 'bb-band ' + cls;
        d.style.clipPath = 'polygon(' +
          pts.map(p => (p[0] + pad).toFixed(1) + 'px ' + (p[1] + pad).toFixed(1) + 'px').join(', ') + ')';
        wrap.appendChild(d);
      };
      const sx = r => (boardW - (BB_ROWS[r] * colStep - gap)) / 2;
      const R  = BB_ROWS.length;

      /* The side silhouette is each row's two left (or right) corners; joining
         them across the rows gives the diagonals for free, because a staggered
         row's corner *is* diagonally adjacent to its neighbour's. */
      const leftIn = [], rightIn = [];
      for(let r = 0; r < R; r++){
        const y = r * rowStep;
        leftIn.push( [sx(r) - bg, y + 0.25*h], [sx(r) - bg, y + 0.75*h]);
        const X = sx(r) + BB_ROWS[r] * colStep - gap + bg;
        rightIn.push([X, y + 0.25*h], [X, y + 0.75*h]);
      }
      band('gold', leftIn.concat(leftIn.slice().reverse().map(p => [p[0] - bt, p[1]])));
      band('gold', rightIn.concat(rightIn.slice().reverse().map(p => [p[0] + bt, p[1]])));

      /* Top and bottom trace each boundary hex's point: corner, tip, corner. */
      const topIn = [], botIn = [];
      const yb = (R - 1) * rowStep;
      for(let c = 0; c < BB_ROWS[0]; c++){
        const x = sx(0) + c * colStep;
        topIn.push([x, 0.25*h - bg], [x + w/2, -bg], [x + w, 0.25*h - bg]);
      }
      for(let c = 0; c < BB_ROWS[R-1]; c++){
        const x = sx(R-1) + c * colStep;
        botIn.push([x, yb + 0.75*h + bg], [x + w/2, yb + h + bg], [x + w, yb + 0.75*h + bg]);
      }
      band('blue', topIn.concat(topIn.slice().reverse().map(p => [p[0], p[1] - bt])));
      band('blue', botIn.concat(botIn.slice().reverse().map(p => [p[0], p[1] + bt])));
    }

    wrap.style.width  = (boardW + 2*pad) + 'px';
    wrap.style.height = ((BB_ROWS.length-1)*rowStep + h + 2*pad) + 'px';
    return true;
  }

  /* ---- has anybody actually won? ----------------------------------------------
     Until now a completed line did nothing at all — the teacher had to spot it and
     call it. The board is a honeycomb, so "connected" needs the real geometry.

     A row is inset by (widest − its size) / 2 columns, which is exactly what the
     layout above does with startX, so a hex's position across the board is
     `inset + col`. Two hexes touch when that distance is 1 within a row, or ½ in
     the row above or below. Deriving it from BB_ROWS rather than hard-coding the
     5/4/5/4 pattern means changing the board shape needs no change here. */
  const BB_WIDEST = Math.max(...BB_ROWS);
  function bbAcross(r, c){ return (BB_WIDEST - BB_ROWS[r]) / 2 + c; }

  function bbNeighbours(r, c){
    const x = bbAcross(r, c), out = [];
    for(let rr = Math.max(0, r-1); rr <= Math.min(BB_ROWS.length-1, r+1); rr++){
      for(let cc = 0; cc < BB_ROWS[rr]; cc++){
        if(rr===r && cc===c) continue;
        const d = Math.abs(bbAcross(rr, cc) - x);
        if(Math.abs(d - (rr===r ? 1 : 0.5)) < 0.01) out.push([rr, cc]);
      }
    }
    return out;
  }

  function bbHexAt(r, c){
    return document.querySelector('#hexwrap .hex[data-row="'+r+'"][data-col="'+c+'"]');
  }
  function bbOwner(hex){
    return !hex ? null
         : hex.classList.contains('claimed-gold')   ? 0
         : hex.classList.contains('claimed-silver') ? 1 : null;
  }

  /* Shortest connected path across the board, or null. Yellow crosses left→right,
     blue descends top→bottom.

     An edge hex is one whose *position across the board* is at the extreme, not
     simply the first in its row: the short rows are inset by half a hexagon, so
     counting their end hexes as edges would let yellow "win" with a line floating
     in the middle of the board, touching neither side. That also restores the
     asymmetry the real game has — yellow needs 5 hexes, blue 4.

     `passable` is what makes one walk answer two questions: pass "hexes this team
     owns" to find a finished route, or "owns or nobody owns" to ask whether the
     team can still get there at all. BFS, so the route it returns is the shortest
     one — which is also the one that traces best. */
  function bbRoute(team, passable){
    const last = BB_ROWS.length - 1;
    const isStart = (r,c) => team===0 ? bbAcross(r,c)===0 : r===0;
    const isEnd   = (r,c) => team===0 ? bbAcross(r,c)===BB_WIDEST-1 : r===last;
    const key = (r,c) => r+','+c;
    const from = new Map();
    const queue = [];

    for(let r=0; r<=last; r++) for(let c=0; c<BB_ROWS[r]; c++){
      if(isStart(r,c) && passable(r,c)){ from.set(key(r,c), null); queue.push([r,c]); }
    }
    while(queue.length){
      const cell = queue.shift();
      if(isEnd(cell[0], cell[1])){
        const path = [];
        for(let at = cell; at; at = from.get(key(at[0], at[1]))) path.unshift(at);
        return path;
      }
      bbNeighbours(cell[0], cell[1]).forEach(n=>{
        if(from.has(key(n[0], n[1])) || !passable(n[0], n[1])) return;
        from.set(key(n[0], n[1]), cell);
        queue.push(n);
      });
    }
    return null;
  }

  /* A win, a dead board, or nothing yet. "Blocked" is a real Blockbusters ending:
     once neither team can reach its far edge even using every unclaimed hex, the
     round is over however many hexes are left, and saying so beats playing on to
     no conclusion. */
  function bbOutcome(){
    const owns = t => (r,c) => bbOwner(bbHexAt(r,c)) === t;
    for(const team of [0,1]){
      const path = bbRoute(team, owns(team));
      if(path) return { type:'win', team, path };
    }
    const open = t => !!bbRoute(t, (r,c)=>{
      const hex = bbHexAt(r,c);
      if(!hex) return false;
      const o = bbOwner(hex);
      return o === null || o === t;
    });
    if(!open(0) && !open(1)) return { type:'blocked' };
    return null;
  }

  /* ---- Blockbusters' tension curve ----
     Millionaire reads the rung and Jeopardy reads what's at stake on the tile. This
     board has neither, but it has something better: **how close anybody is to
     winning**. Cheapest route to a finished line, where your own hexes are free,
     an unclaimed one costs the question you'd have to answer to take it, and the
     other team's are walls. One hex from a line is as tense as this game gets, and
     the lights say so before the class has worked it out.

     Dijkstra rather than the plain BFS `bbRoute` uses, because here the edges have
     different costs. Eighteen cells, so a linear scan for the nearest node is the
     right amount of machinery. */
  function bbStepsToWin(team){
    const last = BB_ROWS.length - 1;
    const isStart = (r,c) => team===0 ? bbAcross(r,c)===0 : r===0;
    const isEnd   = (r,c) => team===0 ? bbAcross(r,c)===BB_WIDEST-1 : r===last;
    const key = (r,c) => r+','+c;
    const stepOnto = (r,c) => {
      const owner = bbOwner(bbHexAt(r,c));
      if(!bbHexAt(r,c)) return null;            // board short of clues
      return owner===team ? 0 : owner===null ? 1 : null;   // null = the other team
    };

    const dist = new Map(), settled = new Set();
    const relax = (r,c,v) => {
      const k = key(r,c), cur = dist.get(k);
      if(cur === undefined || v < cur) dist.set(k, v);
    };
    for(let r=0; r<=last; r++) for(let c=0; c<BB_ROWS[r]; c++){
      if(!isStart(r,c)) continue;
      const cost = stepOnto(r,c);
      if(cost !== null) relax(r,c,cost);
    }
    for(;;){
      let bestKey = null, bestVal = Infinity;
      dist.forEach((v,k)=>{ if(!settled.has(k) && v < bestVal){ bestVal = v; bestKey = k; } });
      if(bestKey === null) return Infinity;     // no line left for this team
      settled.add(bestKey);
      const parts = bestKey.split(','), r = +parts[0], c = +parts[1];
      if(isEnd(r,c)) return bestVal;
      bbNeighbours(r,c).forEach(n=>{
        const cost = stepOnto(n[0], n[1]);
        if(cost !== null) relax(n[0], n[1], bestVal + cost);
      });
    }
  }

  function bbTension(clueOpen){
    stageTension('blockbusters', () => {
      // the shortest line anyone could ever need: blue's four rows beats yellow's five
      const shortest = Math.min(BB_WIDEST, BB_ROWS.length);
      const need = Math.min(bbStepsToWin(0), bbStepsToWin(1));
      const raw = !isFinite(need) ? 0
                : need >= shortest ? 0
                : (shortest - need) / (shortest - 1);
      return { t: Math.max(0, Math.min(1, raw)), live: !!clueOpen };
    });
  }

  /* The honeycomb builds itself rather than appearing. Staggered on row+col, the
     same diagonal wave Jeopardy deals with, so it reads as the board assembling. */
  function bbDeal(){
    dealStagger('play-blockbusters', document.getElementById('hexwrap'), wrap => {
      [...wrap.querySelectorAll('.hex')].forEach(hex=>
        hex.style.setProperty('--i', (+hex.dataset.row) + (+hex.dataset.col)));
    }, 1600);
  }

  /* ---- lighting up the route ----
     Registered as variants, so another way of showing it is a register() call and
     one line in the setting above — see "Solve once, use anywhere" in CLAUDE.md.
     Each takes the winner's glow colour and returns how long it will take, so the
     banner can wait for it to land.

     The glow is the team's own colour, not white: the board sits on a white page,
     so a white halo is invisible and a brightness flash on yellow just washes it
     out. `.route` holds the same glow at rest and the keyframes end on it, so
     there's no flicker when the animation hands back to CSS. */
  const BB_GLOW = ['rgba(255,194,14,0.95)', 'rgba(0,160,223,0.95)'];   // yellow, blue
  const bbLit   = g => 'brightness(1) drop-shadow(0 0 14px ' + g + ')';
  const bbPeak  = g => 'brightness(1.18) drop-shadow(0 0 30px ' + g + ')';

  Kit.anim.register('winRoute', 'trace', {
    run(hexes, glow){
      const step = 155, ms = 430;
      hexes.forEach((hex, i)=>{
        setTimeout(()=>hex.classList.add('route'), i*step);
        hex.animate([
          { transform:'scale(1)',    filter:'brightness(1) drop-shadow(0 0 0 ' + glow + ')' },
          { transform:'scale(1.22)', filter:bbPeak(glow), offset:0.42 },
          { transform:'scale(1)',    filter:bbLit(glow) }
        ], { duration:ms, delay:i*step, easing:'cubic-bezier(.3,.85,.4,1)' });
      });
      return (hexes.length-1)*step + ms;
    }
  });

  Kit.anim.register('winRoute', 'pulse', {
    run(hexes, glow){
      const ms = 620;
      hexes.forEach(hex=>{
        hex.classList.add('route');
        hex.animate([
          { transform:'scale(1)',    filter:bbLit(glow) },
          { transform:'scale(1.16)', filter:bbPeak(glow), offset:0.5 },
          { transform:'scale(1)',    filter:bbLit(glow) }
        ], { duration:ms, iterations:2, easing:'ease-in-out' });
      });
      return ms*2;
    }
  });

  // still marks the route — "off" means no animation, not no answer
  Kit.anim.register('winRoute', 'off', {
    run(hexes){ hexes.forEach(hex=>hex.classList.add('route')); return 0; }
  });

  function runWinRoute(hexes, team){
    const reduced = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const name = reduced ? 'off' : S.get('bbWinRoute', activeGame);
    // fall back rather than silently do nothing if the setting names one we lack
    const impl = Kit.anim.get('winRoute', name) || Kit.anim.get('winRoute', 'off');
    return impl.run(hexes, BB_GLOW[team] || BB_GLOW[0]) || 0;
  }

  let bbWon = null;   // set once the round has an ending; the board stops taking clicks

  /* The board isn't sized to fit the screen the way the other three are, and at
     720p it already fills nearly all of it — so the banner would cover the bottom
     row, hiding half of a blue top-to-bottom route seconds after lighting it up.
     Shrink the whole panel into what's left instead of sliding it, which is the
     only move that keeps every hex of the route on screen. Purely visual and
     reversed the moment the banner goes. */
  function bbFitAroundBanner(){
    const play  = document.getElementById('play-blockbusters');
    const card  = document.getElementById('result-card');
    const modal = document.getElementById('result-modal');
    play.style.transform = '';
    // the banner's top from its own offset, not its rect: it is mid-slide-in, and
    // its rect would report wherever the animation currently has it
    const cardTop = window.innerHeight - (parseFloat(modal.style.bottom) || 92) - card.offsetHeight;
    const box     = play.getBoundingClientRect();
    const room    = cardTop - box.top - 14;
    if(box.height <= room || room <= 0) return;
    play.style.transformOrigin = 'top center';
    play.style.transform = 'scale(' + Math.max(0.5, room / box.height).toFixed(3) + ')';
  }
  function bbDropBoard(){
    const play = document.getElementById('play-blockbusters');
    play.style.transform = '';
    play.style.transformOrigin = '';
  }

  function bbClearOutcome(){
    bbWon = null;
    bbDropBoard();
    const wrap = document.getElementById('hexwrap');
    wrap.classList.remove('won', 'route-shown');
    wrap.querySelectorAll('.hex.route').forEach(hex=>{
      hex.getAnimations().forEach(a=>a.cancel());
      hex.classList.remove('route');
    });
    hideResult();
  }

  function bbFinish(outcome){
    bbWon = outcome;
    // the round has an ending: there is nothing left to choose, so the vote goes
    // and the phones go back to the mode
    bbCloseVote(false);
    const wrap = document.getElementById('hexwrap');
    wrap.classList.add('won');

    if(outcome.type !== 'win'){
      Sound.play('end');
      showResult({
        eyebrow:'Blockbusters',
        title:'Board blocked',
        sub:'Neither team can reach its far side now — nobody completes a line.',
        actions:[{ label:'New board', primary:true, onPick:bbPlayAgain }],
        onShow:bbFitAroundBanner, onHide:bbDropBoard
      });
      return;
    }

    const team  = outcome.team;
    const hexes = outcome.path.map(cell=>bbHexAt(cell[0], cell[1])).filter(Boolean);
    wrap.classList.add('route-shown');
    const ms = runWinRoute(hexes, team);

    setTimeout(()=>{
      // the trace takes a couple of seconds; "New game" or "New board" in that
      // window must not be followed by a banner for a round that's already gone
      if(bbWon !== outcome) return;
      if(wrap.closest('.lit')){ Sound.fanfare(); setTimeout(()=>Sound.applause(2400), 620); }
      else Sound.play('clear');
      showResult({
        eyebrow:'Blockbusters',
        title: ((teams[team] && teams[team].name) || (team===0 ? 'Yellow' : 'Blue')) + ' wins!',
        sub: (team===0 ? 'Left to right' : 'Top to bottom') +
             ' in ' + hexes.length + ' hexagons.',
        tone: team===0 ? 'gold' : 'silver',
        actions:[{ label:'New board', primary:true, onPick:bbPlayAgain },
                 { label:'Leave it up', onPick:function(){} }],
        onShow:bbFitAroundBanner, onHide:bbDropBoard
      });
    }, ms + 140);
  }

  // same sections, freshly shuffled. Scores stay — the team bar carries across
  // games and units by design, so a new board shouldn't wipe it either.
  function bbPlayAgain(){
    bbClearOutcome();
    pool = shuffle(BLOCKBUSTERS_BANK.filter(inPlay)).slice(0, BB_TOTAL);
    buildBlockbustersBoard();
    bbTurn=0; bbSideAt=[0,0]; renderBBTurn();
    bbVote=null; bbVoting=false; renderBBVote();
    bbTension(); bbDeal();
  }

  /* ================= SHARED CLUE MODAL ================= */
  let currentTile=null, modalMode=null, currentClueValue=0;
  let currentClueItem=null;      // what the shared renderer needs to answer in place

  // Blockbusters' board is structurally two-team — yellow crosses, blue descends —
  // so the shared chooser is deliberately restricted rather than generalised here.
  /* One chooser, two callers: Blockbusters claims a hex with it, and Jeopardy now
     offers a steal with it. Route on the mode rather than giving Jeopardy a second
     instance — each instance registers its own document keydown listener. */
  const clueClaim = Kit.claimTeam({
    mount:  document.getElementById('clue-claim'),
    onPick: i => (modalMode === 'jeopardy' && jSteal) ? jTakeSteal(i) : claimHex(i)
  });

  /* Everything in the strip goes away; each opener then shows what it wants. The
     ids used to be typed out here, which is the defect class this project has paid
     for most — a new button had to be threaded into the list by hand and nothing
     complained if you missed one. `wager-ok` never was threaded in, so a bet left
     standing outlived every one of these calls. Asked of the strip now, so the next
     button is covered by existing. */
  function hideAllActionButtons(){
    document.querySelectorAll('#clue-actions > button')
      .forEach(b => { b.style.display = 'none'; });
    const own = document.getElementById('round-actions');
    if(own) own.innerHTML = '';
    /* A won round renames Close to say who it pays, and this is the one call every
       opener makes — so the wording is put back here rather than by each of the six
       places that show the button. A stale "Close — Team 2 takes it" over the next
       clue is exactly the kind of thing nobody notices until a lesson. */
    const close = document.getElementById('close-btn');
    if(close) close.textContent = 'Close';
    clueClaim.hide();
  }

  /* ================= A GROUPING CLUE =================
     Connections inside a tile: eight words on the card, four of which belong
     together, and the room assembles the four from their phones. It is the first
     dynamic carried over from the question bench that is a **round** in the full
     sense, and that is the headline. `Kit.prompt` is a *rendering* contract —
     render and reveal, with no time, no turns and no phones anywhere in it — so
     none of this could live there however much it looks like a question form. Story
     Reveal ported cheaply because the hub already had hints costing clue value;
     grouping had nothing to land on.

     What it does not need to build is the half the relay already grew and nothing
     in the hub had ever used: multi-pick, and `multiByTeam` — a per-phone cap
     derived from that team's size, so four words assembled by four phones is one
     each and by two phones is two each. That share is the mechanic rather than a
     detail: a team holding five between them is over, and has to talk one of them
     down. Being over is a state, not an error — nothing is stripped.

     Every team plays at once and the first to settle a correct set takes the tile.
     A wrong set costs nothing but the time, exactly as it costs nothing in
     Connections' race: the other team is the pressure, and a class that is charged
     for a guess stops guessing. */
  let roundState = null;         // the round's own state while a grouping clue is open
  let roundSettler = null;  // its debounce-and-remember, from the shared shelf

  /* How long the *card* waits before the tile leaves. The settle delay is the
     round's own business and lives with it; this one is Jeopardy's, because it is
     about a tile flipping away rather than about when an answer is complete. */
  /* A beat between the four words lighting up and the card flipping away. Without
     it the room never sees which four it was: the answer and the card leaving would
     land in the same frame. */
  const ROUND_TAKE_MS   = 700;
  /* Two different questions, and using the wrong one is a live trap. `roundClue()`
     is "this clue is a grouping clue", true until the card closes. `roundLive()` is
     "the round is still being played", which stops the moment it is taken or
     revealed. The steal and the deduction ask the first — they run *after* Reveal,
     so asking the second would have silently let both back in. */
  function roundClue(){ return !!roundState; }
  function roundLive(){ return !!roundState && !roundState.done; }


  /* ---------- the adapter ----------
     Everything the round *is* — the card, the phone payload, the union of a team's
     picks, the judging — lives in `game-hub/rounds/grouping.js` and is shared with
     the playground. What is left here is only what Jeopardy contributes: where the
     card is mounted, what a team winning is worth, and what happens to the tile.

     That split is the whole point. A round that knew about tiles could not be
     plugged into a second game, and a game that held the round could not have it
     tuned anywhere but inside itself. */
  let roundId = null;                 // which round this clue is running
  function roundDef(){ return roundId ? Kit.round.get(roundId) : null; }

  // what the round is lent: the team list, their sizes, and what a click means here
  function roundCtx(id){
    /* `p.team` is the truth for this, in both kinds of room — `HubBuzzer`'s `seat`
       keeps the host's own copy current, which it did not always do. See the note
       there: a stale copy counted two phones onto one competitor and halved that
       person's share of the answer. Fixed at the seam rather than here, so the
       three other readers of `players()` are correct too. */
    const sizes = teams.map(()=>0);
    if(buzzHost) buzzHost.players().forEach(p=>{
      const t = Number(p.team);
      if(t >= 0 && t < sizes.length) sizes[t]++;
    });
    return {
      teams:  teams.map((t, i) => teamName(i)),
      sizes,
      /* **Whether the question stays open after somebody gets it right**, which a
         round has to know because "I am finished" and "the round is over" are the
         same field on the same object — `state.done`. Written by a round that meant
         only the first, it ends the question for everybody: the ordering race set it
         the moment one team's ladder filled, which froze the card, stopped the replies
         being read and locked every other team out of finishing theirs. Exactly the
         lockout this whole change exists to remove, expressed one tier down.

         So the host lends the rule and the round says "this team has finished"
         instead. Only rounds that can be finished by one competitor while others are
         still working need to read it. */
      openToAll: openToAllNow(),
      /* The crowd-reveal threshold as a fraction, lent the same way. 0 is off;
         the shelf helper treats *absent* as its own default, so the bench needs
         no wiring — which is why this is `?? 0` and never `|| 0.4`. */
      crowdReveal: (Number(S.get('crowdReveal', activeGame)) || 0) / 100,
      /* The meter's switch, lent the same way: the shelf treats absent as on,
         so only an explicit false stands it down and the bench inherits it. */
      crowdMeter: S.get('crowdMeter', activeGame) !== false,
      /* Whether the reveal counts what the room has *selected* as well as what it
         has sent. Lent rather than read, so the question bench inherits it with no
         wiring — the same contract the threshold already follows. */
      crowdLive: !!S.get('crowdLive', activeGame),
      /* Where a round's wrong-answer verdict is announced — a headline, each player's
         own lane, or nowhere (the running count already says how close they are). Lent
         so the round owns the presentation and the bench inherits the default. */
      commentary: S.get('roundCommentary', activeGame) || 'headline',
      /* **Look up.** The crowd reveal lands on the projector, which is worth
         nothing to a room of sixteen reading their own handsets — so when one
         lands, every phone pulses once. The shelf decides *when* (it is the only
         thing that knows the revealed set just grew); this decides whether there
         is a room to tell and whether a question is still open. The second guard
         matters: `crowdKnown` is also called on the reveal render, when the answer
         is going up anyway and nobody needs sending anywhere. */
      nudge: kind => { if(buzzHost && roundLive()) buzzHost.nudge(kind); },
      /* Who is in the room, read fresh like `sizes` — the information gap deals a
         view per player, and a deal cut from a stale roster misses whoever just
         walked in. */
      roster: buzzHost ? buzzHost.players() : [],
      /* A verdict for one phone, lent rather than reached for — the round says how
         a typed word was received and the host owns the wire. */
      verdict: (id, verdict, note, coolMs) => { if(buzzHost) buzzHost.judge(id, verdict, { note, coolMs }); },
      teamName,
      /* **State that outlives one question — the contract addition, and the last one
         on the build order.** Every hook a round has is handed one question and
         forgets it afterwards, which is right for a question and wrong for anything
         a *student* carries: a bingo card and its marks, a hand, a secret role, a
         personal scorecard.

         Keyed by player id, because that is the only identity that survives a phone
         dropping off the wifi and coming back — a competitor's index shifts and a
         name is not unique. Scoped to the round *type*, so a bingo round keeps its
         cards across all of its own calls and a different round starts clean, and
         cleared when a game starts, because a new game is a new lesson.

         The relay was already doing the hard half: it holds a card per player across
         a reconnect. What was missing was a way for a round to put one there, which
         is `cardsByPlayer` on the arm. This is the host's half — anything a round
         wants to remember that the phones do not need to see. */
      keep: roundKeepFor(id || roundId),
      /* **Individuals, so there is nothing to assemble.** A lane exists to show a
         team building one answer out of several handsets — how many have committed,
         whether they agree. A competitor of one has neither question to answer: they
         have answered or they have not, and the option counts already say how many
         of the room have. Twenty-five lanes on a board is also simply unreadable. */
      solo:   Roster.solo(),
      prompt: !!S.get('phonePrompt', roundHost.game),
      // `null` is the whole room; a scoped round belongs to the team on turn
      team:   S.get('roundWho', roundHost.game) === 'turn' ? roundHost.turn() : null,
      mode:   roundModeOf(id || roundId),
      // which lane the teacher's own clicks act on, when a round gives each team one
      forTeam: roundHost.turn(),
      /* A host may collect votes and not show them yet — Millionaire's Ask the class
         is the only caller, and it is what leaves that lifeline something to buy now
         that the round asks the room on every question anyway. */
      hideVotes: !!(roundHost.hideVotes && roundHost.hideVotes()),
      /* **Whether a tap is final belongs to the skin, not the round.** On a tile the
         room is negotiating and a player must be able to move their vote — that is
         the whole mechanic in `agree` mode. On a board where the clock is the
         opponent, being able to change your answer after watching the count is the
         opposite of the game. So the host says which it is and the round honours it,
         except where honouring it would break the round's own contract. */
      lockIn: !!roundHost.lockIn,
      /* How the room's votes read: a count of people, or a dot per team. See the
         note in `choice.js` — it is the same data answering two questions. */
      countVotes: !!(roundHost.countVotes && roundHost.countVotes()),
      onPick: roundTeacherPick
    };
  }

  /* Which round this clue wants, asked of the registry rather than named here — so
     a round written next month is playable the day a bank item carries its field,
     with no engine change at all. That is the whole return on the extraction. */
  /* The host is named here rather than at `roundOpen`, because `setup` is handed a
     `ctx` and the ctx is scoped to whichever board is asking — the mode, who is
     entitled and how many are on that team all read the host. Asking first and
     declaring second would set up the round against the *previous* board. */
  function roundOf(item, host){
    roundHost = ROUND_HOSTS[host] || ROUND_HOSTS.jeopardy;
    const hit = Kit.round.of(item);
    if(!hit) return null;
    const st = hit.def.setup(item, roundCtx(hit.id));
    return st ? { id:hit.id, state:st } : null;
  }

  /* **Opening a round arms the room.** It used to only draw the card, and telling
     thirty handsets what was being asked was left to the host — four call sites,
     each responsible for remembering the same thing, with nothing complaining if one
     forgot. Quickfire forgot, and the report was "the board shows four options and
     my phone says waiting for the teacher": the card right, the round live, and the
     two ends never connected. Blockbusters had already shipped the mirror image of
     it, declaring the arming and forgetting the replies.

     That is the defect class this project keeps paying for — a hand-kept obligation
     where a declaration belongs — so the obligation is gone. A host now arms only
     when *no* round opened, written as one expression (`if(!roundOpen(x)) …`) so it
     cannot be half-done the way two separate statements could.

     Deliberately not solved by making `askPhones` idempotent: several callers re-arm
     the same question on purpose — a new rung in an ordering climb, a Millionaire
     steal handing the question to another team — and a guard there would silently
     turn those into no-ops. */
  function roundOpen(found){
    if(!found) return null;
    roundId = found.id;
    /* Settings that fork by round read this rather than taking an argument, so the
       two places `roundId` moves are the two places it is announced. Said here and
       in `roundEnd` only — a third caller would be a third thing to forget. */
    S.setRound(roundId);
    roundState   = found.state;
    roundSettler = Kit.round.settle(roundDef().settleMs, roundSettle);
    /* A new question, so a new record of who gets there. Opened here rather than by
       each host, for the same reason arming moved here: four call sites each
       responsible for remembering the same thing is the obligation this function
       exists to delete. */
    Kit.round.results.open();
    /* The scores as this question opened, so the standings can show what it changed.
       Beside the results record because they answer halves of one question and a
       second call site is a second thing to forget. */
    standingsOpen();
    roundReplies = [];    // nobody has answered *this* question yet
    sendMisses = {};      // a new question starts every phone's escalation from cold
    sendCooling = {};     // and nobody carries a visible wait into it
    renderRound();
    askPhones(currentPhonePrompt(), roundHost.game);
    return roundState;
  }

  /* Which way a round is being played, when it offers more than one. The row is
     built from what the round *declares*, so the engine never learns what a mode
     means — and a round added later gets its own row for free. */
  function roundModeOf(id){
    const def = id ? Kit.round.get(id) : null;
    if(!def || !def.modes || !def.modes.length) return null;
    const key  = 'round_' + id;
    const game = roundHost.game;
    const mode = S.get(key, game);
    /* **A board's `teamMode` ask only means anything in a room of teams.** Jeopardy
       and Blockbusters say "give me whichever mode each round calls its whole-team
       one", which is right when a name is four students who have to agree — and is
       nonsense when a name is one person. Worse than nonsense in practice: with
       every competitor a team of one, `agree` is satisfied the instant anybody taps,
       so several correct answers land inside the same settle window and which of
       them takes the question comes down to the order teams are read in rather than
       who was first. Reported as the *second* right answer winning.

       Resolved here rather than at registration, because the roster mode is a live
       fact and a setting's default is computed once. A teacher's own override still
       wins — this only replaces the board's silent default. */
    if(Roster.solo() && def.teamMode && mode === def.teamMode &&
       !S.hasOverride(key, game)){
      const solo = def.modes.filter(m => m.value !== def.teamMode)[0];
      if(solo) return solo.value;
    }
    return mode;
  }

  /* The round the phones are put into, read through `phoneRound()` so it reaches the
     relay by the same path Bingo's cards do and the mode is not consulted. */
  function roundForPhones(){
    return roundLive() ? roundDef().arm(roundState, roundCtx()) : null;
  }

  /* Somebody joined a team or dropped off one, so the shares have moved. Pushed on
     its own rather than re-armed, because a fresh arm clears every handset's picks
     and a latecomer walking in must not wipe what the rest of the team had just
     agreed on. */
  function roundPushShares(){
    if(!buzzHost || !roundLive()) return;
    const arm = roundDef().arm(roundState, roundCtx());
    if(arm && arm.multiByTeam) buzzHost.shares(arm.multiByTeam);
    /* Per-player views move with the roster exactly as shares do — the
       information gap recuts its deal, and only the phones whose view changed
       hear about it. */
    if(arm && arm.promptByPlayer && Object.keys(arm.promptByPlayer).length)
      buzzHost.prompts(arm.promptByPlayer);
  }

  /* The card's own box, inside `#clue-text` the way the hint is — so the class is
     still reading the instruction while they work. `drawPrompt` owns that element
     and clears it, so this always runs after it. */
  function renderRound(){
    if(!roundState){
      const stale = document.getElementById('clue-group');
      if(stale) stale.remove();
      return;
    }
    const host = roundHost.mount();
    if(!host) return;
    roundDef().render(host, roundState, roundCtx());
    renderRoundButton();
  }

  /* The no-phones path, and it is not a fallback — a teacher with a dead relay has
     to be able to play this clue, which is the rule every playground page owes too.
     Clicking the words assembles a set on the board and the button judges it. */
  /* The teacher's own working answer. `push` order is load-bearing for a round
     whose answer is a *sequence* — an ordering card numbers them as they are
     clicked — and harmless for one whose answer is a set. */
  function roundTeacherPick(w){
    if(!roundLive()) return;
    const cap = roundCap();
    const at = roundState.chosen.indexOf(w);
    if(at !== -1) roundState.chosen.splice(at, 1);
    else if(roundState.chosen.length < cap) roundState.chosen.push(w);
    /* **A single pick moves; it does not have to be cleared first.** With a cap of
       one, a full selection used to swallow the click, so choosing B after A did
       nothing at all — you had to click A again to release it. On Millionaire that
       is the "say the letter, then lock it in" beat, where moving the nomination is
       the whole point of the pause. Only at a cap of one: where several are being
       assembled, deselecting to make room is the right gesture. */
    else if(cap === 1) roundState.chosen = [w];
    renderRound();
    /* The host may have chrome of its own that follows the nomination — Millionaire's
       hint line reads "Locked on X". Without this it only refreshed on the next full
       board render, so the line lagged a beat behind the option that was lit. */
    if(roundHost.repaint) roundHost.repaint();
    /* Millionaire with "Final answer?" switched off answers on the click, as it
       always did. Declared by the host rather than branched on here, so the two-beat
       pause stays the default everywhere else. */
    if(roundHost.autoCommit && roundHost.autoCommit() && roundState.chosen.length === cap) roundCommit();
  }
  /* How many the teacher may hold at once. An ordering climb wants one at a time —
     the ladder takes the next rung, not the whole scale. The question bench had
     this written out a second time, so the sum lives on the shelf now. */
  function roundCap(){ return Kit.round.cap(roundDef(), roundState, roundCtx()); }

  /* The teacher's own set, judged by the same function a team's is. Right lights the
     four and takes the tile for whoever is on turn; wrong shakes them and costs
     nothing, exactly as it costs a team nothing. */
  /* The teacher's own answer, judged. A function rather than a button handler,
     because two buttons reach it now: the clue card's Check, and Millionaire's
     "Final answer?" — the same beat wearing the show's clothes. Adapter code, not
     any game's: it lived in the Jeopardy region for a year because that is where
     the clue card grew up, and moved here when the adapter lost its j prefix. */
  function roundCommit(){
    /* `roundCap()`, not the whole answer: an ordering climb asks for one word at a
       time, so guarding on the full scale meant the button could be pressed and
       silently did nothing. */
    if(!roundLive() || roundState.chosen.length !== roundCap()) return;
    const def = roundDef();
    /* The teacher's own answer, which deliberately does not go through `read()` — so
       a round that holds a rung until every handset agrees does not hold *this* one.
       A class with one phone in a drawer has to stay playable, and the teacher is the
       authority when they click. */
    const ctx = roundCtx();
    /* Who a teacher's own answer scores for. `active` by default, which is what the
       two card boards have always done — a round arriving did not change whose
       answer the teacher was entering. Millionaire needs its own, because after a
       steal the question belongs to a team that is not `active`, and that is exactly
       the moment the difference shows. */
    const team = roundHost.scorer ? roundHost.scorer() : active;
    const r = def.judge(roundState.chosen, roundState, team, ctx);
    if(r.verdict === 'right'){
      def.accept(roundState.chosen.slice(), roundState, team, ctx);
      roundState.chosen = [];
      /* The teacher's own answer goes on the record too, with no arrival stamp — a
         click carries none, and sorting last is right: it is a judgement made after
         the room has had its go. */
      Kit.round.results.note(team, { done: r.done !== false || !!roundState.done });
      if(r.done !== false || roundState.done){ roundTake(team); return; }
      roundState.say = 'Yes — keep going.';
      Sound.play('correct');
      renderRound();
      roundSendDone();
      if(buzzHost && roundReasks()) askPhones(currentClueItem.text, roundHost.game);
      return;
    }
    /* A wrong answer costs nothing on a tile or a hexagon — the other team is the
       pressure. On a ladder it ends the go, which is the show's whole tension, so
       the host is asked first and only boards with no opinion fall through. */
    if(roundHost.miss && roundHost.miss(team, r)) return;
    roundState.say = def.saidOf('Not that', r, roundState).replace(/^Not that: /, '');
    Sound.play('wrong');
    /* Shake what they picked, *then* let it go. Leaving the selection standing meant
       the next click deselected instead of choosing, so the teacher's second attempt
       silently did nothing — worst on an ordering climb, where one word is the whole
       answer and the button just sat there disabled. */
    const shaking = [...roundHost.mount().querySelectorAll('.gword.chosen')];
    shaking.forEach(el=>{
      el.classList.add('shake');
      setTimeout(()=> el.classList.remove('shake'), 380);
    });
    setTimeout(()=>{ if(roundLive()){ roundState.chosen = []; renderRound(); } }, 380);
    renderRound();
  }
  document.getElementById('group-btn').addEventListener('click', roundCommit);

  /* Where a round's own buttons go: beside the host's commit button, whichever
     element that is — the clue card's Check, Millionaire's "Final answer?",
     Quickfire's "Lock it in". Created next to it rather than written into the
     skeleton, the same move `CARD_MOUNT` makes for the card, so a fourth host
     needs no markup of its own. */
  function roundActionsMount(){
    const btn = document.getElementById(roundHost.commit);
    if(!btn || !btn.parentNode) return null;
    let box = document.getElementById('round-actions');
    if(!box || box.previousSibling !== btn){
      if(box) box.remove();
      box = document.createElement('span');
      box.id = 'round-actions'; box.className = 'round-actions';
      btn.parentNode.insertBefore(box, btn.nextSibling);
    }
    return box;
  }

  function renderRoundButton(){
    const btn = document.getElementById(roundHost.commit);
    if(!btn) return;
    const on = roundLive() && roundHost.live();
    // minted only once a round is actually live — an ordinary clue's strip is the hub's
    const box = on ? roundActionsMount() : document.getElementById('round-actions');
    btn.style.display = on ? 'inline-block' : 'none';
    if(!on){ if(box) box.innerHTML = ''; return; }
    /* The commit button is the host's — it scores — and everything beside it is
       the round's. The wording of the host's is still the host's when it has one:
       Millionaire's is the show's "Final answer?", which is the same beat and must
       not read as "Check it". */
    const list = Kit.round.actions(roundDef(), roundState, roundCtx(),
                                   { commitText: roundHost.commitText,
                                     hints: !!S.get('roundHints', roundHost.game) });
    if(!list.length) return;
    btn.disabled = !!list[0].disabled;
    btn.textContent = list[0].label;
    Kit.round.strip(box, list, roundPress);
  }

  /* A round's own button, pressed. It may change the question and may not score —
     scoring is what `roundCommit` is, and that is the host's beat.

     **What the host owes afterwards depends on what actually changed, and getting
     that wrong throws the room's answers away.** A re-ask is an *arm*, and an arm
     clears the relay's collected replies and resets every handset — right when a
     round has moved on (the ordering climb fills a rung, so the next question is a
     different one), and badly wrong when only the card changed. Every hint but that
     one is card-only: a letter shown on the projector, an option taken off it. Those
     used to re-arm anyway, so pressing Hint wiped what thirty students had already
     dragged or typed.

     So a round says which it was: `'card'` for "redraw me, leave the phones alone",
     anything else truthy for "the question moved". */
  function roundPress(id){
    if(!roundLive()) return;
    const changed = Kit.round.press(roundDef(), id, roundState, roundCtx());
    if(!changed) return;
    if(changed !== 'card'){
      roundState.chosen = [];
      if(buzzHost && currentClueItem) askPhones(currentClueItem.text, roundHost.game);
    }
    renderRound();
  }

  /* Replies off the wire. The round works out what each team is holding; this only
     decides what that is worth on a Jeopardy board. */
  /* **Who answered first, which the picks themselves do not say.** `read()` hands
     back one answer per competitor and nothing about when each arrived — so the
     settle used to take `verdicts[0]`, which is the *lowest index* among the correct
     ones rather than the earliest. With two or three teams that is invisible; with
     sixteen individuals it is the reported bug, where a later right answer takes the
     tile off an earlier one for no reason anybody in the room can see.

     Stamped with a counter rather than a clock: nothing here needs to know how long
     ago, only what came before what, and a counter cannot disagree with anything.
     The stamp moves only when a competitor's answer actually *changes*, so somebody
     re-reading their own reply does not lose their place. */
  /* One store per round type, thrown away when a game starts. `all()` copies, so a
     round cannot hand its own store out and have it mutated behind its back. */
  let roundKeep = null;
  function roundKeepFor(id){
    const key = String(id || '');
    if(!roundKeep || roundKeep.id !== key) roundKeep = { id:key, store:new Map() };
    const store = roundKeep.store;
    return {
      get: pid => store.get(String(pid)),
      set: (pid, v) => { store.set(String(pid), v); return v; },
      has: pid => store.has(String(pid)),
      all: () => { const out = {}; store.forEach((v, k) => { out[k] = v; }); return out; },
      clear: () => store.clear()
    };
  }
  function roundKeepReset(){ roundKeep = null; }

  let roundSeq = 0;
  /* **This answers "when did each team's answer arrive", which is not the same
     question as "who got it right".** `Kit.round.results` records the second and
     consumes the first: several teams can settle inside one tick, so the moment a
     reply landed and the moment it was judged are different numbers, and only this
     knows the first one. It stamps every team whose answer changed, right or wrong,
     because a team that was wrong at 1s and right at 5s arrived at 5s.

     **Namespaced, because the state object belongs to the round.** This was
     `roundState.at`, and the bingo round uses `s.at` for which call it is reading — so
     the host quietly replaced a number with a map of stamps and the next `s.at++`
     produced NaN, which rendered as "all twelve called" one press in. Nothing warned
     about it and nothing could: two files writing different meanings into one field
     on the same object is a collision only a name can prevent.
     **The rule: anything the host stores on a round's state carries `host` in its
     name.** A round's own fields are the round's to choose freely. */
  /* The identity of an answer, for the arrival stamp and the settle memory. A set
     round's answer is the same answer in any order, so it is sorted; a round that
     declares `ordered` -- the drag rounds, where the order IS the answer -- keys on
     the sequence itself. **Sorting those erased the difference between a wrong
     order and the right one**: a team that completed the sentence first-but-wrong
     kept its early arrival stamp, and when they finally fixed the order the record
     placed them 1st -- reported from the first ef-2a class, a team badged and paid
     first that the whole room had watched come last. */
  function roundKeyOf(list){
    const seq = (list || []).slice();
    if(!(roundDef() || {}).ordered) seq.sort();
    return seq.join('\u0000');
  }

  function roundStamp(){
    if(!roundState) return;
    const at = roundState.hostAt || (roundState.hostAt = {});
    Object.keys(roundState.picks || {}).forEach(t=>{
      const key = roundKeyOf(roundState.picks[t]);
      if(!at[t] || at[t].key !== key) at[t] = { key, n: ++roundSeq };
    });
  }
  const roundAt = t => ((roundState && roundState.hostAt && roundState.hostAt[t]) || { n: Infinity }).n;

  function roundOnReplies(all){
    if(!roundLive()) return;
    /* Kept so a verdict can be addressed at **whoever actually answered**, rather
       than at everyone the roster happens to place on that competitor. */
    roundReplies = Array.isArray(all) ? all : [];
    roundState.picks = roundDef().read(all, roundState, roundCtx());
    roundStamp();
    renderRound();
    roundSettler.bump();
  }

  function roundSettle(){
    if(!roundLive()) return;
    const def = roundDef();
    const ctx = roundCtx();
    const verdicts = Object.keys(roundState.picks).map(t => ({
      team: Number(t), set: roundState.picks[t], r: def.judge(roundState.picks[t], roundState, Number(t), ctx)
    })).filter(v => v.r.verdict !== 'incomplete');
    /* The right answer is resolved before any wrong one. Two teams can settle in the
       same tick, and taking them in arrival order puts "not a group" on screen
       *after* the other team has already taken the tile — the board announcing the
       wrong headline for a question that has moved on. */
    /* **A slot one team takes, or a question everybody answers.** Every board until
       Quickfire had a slot — a tile, a hexagon, a rung — so the first right answer
       ended the question and took it. A straight run of questions has no slot: the
       question belongs to nobody, each team answers it, and each is paid for its own
       answer. Declared by the host rather than branched on the game's name, and
       false everywhere else, so the three boards above are untouched.

       The settler's per-team memory is what stops a team being paid twice: a right
       answer settles once, and `win()` itself is idempotent per team. */
    /* Earliest right answer, not lowest index — see `roundStamp`. The teacher's own
       clicks carry no stamp and sort last, which is correct: a click is a judgement
       made after the room has had its go. */
    const rights = verdicts.filter(v => v.r.verdict === 'right')
                           .sort((a, b) => roundAt(a.team) - roundAt(b.team));

    /* **The question does not end because somebody was right.** Two boards' worth of
       reasons, and they are the same reason: the first team to get there locks
       everybody else out, so the rest of the room stops working on a question they
       had not finished. On Quickfire there is no slot to lock — every team answers
       every question — and `roundOpenToAll` is that same beat on a board that *does*
       have one.

       The slot still belongs to whoever was first, and it still pays in full. What
       changes is that it is **held back** rather than paid now: the tile, the turn,
       the banner and the ending are the ordinary take beat, run when the question
       actually ends (the teacher reveals, or their own Check decides it). Everybody
       else who still gets there is paid whatever the running rule says their position
       is worth — less than the slot, which is what keeps being first worth something.

       **Being right and the question being over are two different things, and this
       branch once conflated them.** They were one function — `roundTake` set the
       line naming the team, played the sting, *and* paid the tile, stopped the
       settler and closed the card. Holding the question open meant that function no
       longer ran when a team got it right, so the recognition went with the ending
       and a correct answer produced nothing but a sound. Reported straight back from
       a board, and correctly: a round that cannot say "yes, that's it" is not a round
       any more.

       So the two halves of that function are split here. What a right answer *is* —
       the line, the sound, the round's own marking — happens every time one lands.
       What ends the question is the teacher's, and nothing below touches it.

       (There was a second reason given for the silence: that naming the team would
       leak the answer to the rooms still working. It does not. No round prints *what*
       a team answered in a way that naming them adds to, and Connections already puts
       every team's picked words in its own lane.) */
    if(roundHost.scoreEach || openToAllNow()){
      /* **Misses first, so a right answer has the last word.** Both can settle in one
         tick, and whichever runs last owns the say line. "Team 2 has it" is the more
         useful headline than "Team 3 — not that one", and on a board where nothing is
         taken until the teacher ends it, the order costs nothing else. */
      if(!roundHost.scoreEach){
        verdicts.filter(v => v.r.verdict !== 'right').forEach(v => {
          if(!roundSettler.fresh(v.team, roundKeyOf(v.set))) return;
          roundMiss(v.team, v.r);
        });
      }
      let again = false;              // did any right answer move the question on
      rights.forEach(v => {
        if(!roundSettler.fresh(v.team, 'ok:' + roundKeyOf(v.set))) return;
        def.accept(v.set, roundState, v.team, ctx);
        /* Said to the phone that sent it, and only to that phone. Before the
           finished/not-finished fork, because "your answer landed" is true either
           way and the last word of a ladder deserves the same green as the first. */
        const finished = v.r.done !== false || !!roundState.done;
        roundSendRight(v.team, !finished);
        roundSendDone();
        /* The board says who got it, the moment they do — the same wording and the
           same stage-aware sound the take beat has always used, so nothing new is
           invented and the room hears what it has always heard.

           **Only on the boards that lost it.** Quickfire never named a team per
           answer: every competitor answers every question there, so a line and a
           sting each would be sixteen of them in twenty seconds. Its feedback is the
           strip and the standings, and that is unchanged. */
        if(!roundHost.scoreEach){
          roundState.say = teamName(v.team) + ' has it.';
          Sound.play(document.getElementById(roundHost.stage).classList.contains('lit')
                     ? 'sting' : 'correct');
        }
        /* **On the record before anything is paid.** `done` is what separates getting
           a piece right from finishing: an ordering climb is correct once per rung,
           and a rule paying every correct answer would pay one question five times.
           `at` is the arrival stamp, so the order is the room's rather than this
           loop's. */
        /* **Getting a rung right is not finishing the ladder**, and paying on the
           first one was a real bug: an ordering race is correct once per word, so the
           slot went to whoever got the *first word* rather than to whoever completed
           a ladder. `done` is the round saying which of the two just happened. */
        Kit.round.results.note(v.team, { at: roundAt(v.team), done: finished });
        if(!finished){
          /* A step, not a win. The card already says so; what the room needs is the
             next question — for an ordering race that is a different set of words per
             team, because the one just placed has left their pool. */
          roundState.say = teamName(v.team) + ' — yes.';
          again = true;
          return;
        }
        if(!roundHost.scoreEach && roundState.hostTook == null){
          roundState.hostTook = v.team;     // the slot, paid when the question ends
          return;                       // said and sounded above, like every other right answer
        }
        const paid = roundHost.scoreEach
                       ? roundHost.win(v.team, roundPayout()[v.team] || 0)
                       : roundPayLate(v.team);
        notePhoneScore(teamName(v.team), v.team, null, paid || 0);
      });
      /* **A partial right answer moves the question on, so the room has to be asked
         again.** The single-winner path has always done this and the open branch did
         not, which is what left a placed word still sitting in its team's list on
         every handset — the round could not progress because the phones were still
         offering a word that had already been used. Once, after the loop, rather than
         per team: an arm is room-wide and several teams can settle in one tick. */
      if(again && buzzHost && currentClueItem){
        roundSettler.reset();       // the question changed; every answer is worth trying again
        if(roundReasks()) askPhones(currentClueItem.text, roundHost.game);
      }
      renderRound();
      return;                       // the clock or the teacher ends it, not the first right answer
    }

    const won = rights[0];
    if(won){
      /* On the record here too, so the standings screen can say who got there
         whichever way the question was played. */
      Kit.round.results.note(won.team, { at: roundAt(won.team),
                                        done: won.r.done !== false || !!roundState.done });
      /* Right does not always mean the round is over. A grouping clue ends the
         moment a team has the set; an ordering climb has four more rungs to fill,
         so the round says which happened and this only pays the tile when it is
         genuinely finished. Getting this wrong would have scored a $400 tile on the
         first correct rung.

         **The default is that it ends.** `done !== false` rather than `done` — a
         round that has never had to think about progress says nothing, and saying
         nothing must mean the ordinary case. Defaulting the other way made a
         correct grouping card report "yes, keep going" and never pay out, which is
         exactly the kind of silent wrong-way-round a second caller exists to find. */
      def.accept(won.set, roundState, won.team, ctx);
      const over = won.r.done !== false || !!roundState.done;
      roundSendRight(won.team, !over);
      roundSendDone();
      if(over){ roundTake(won.team); return; }
      roundState.say = teamName(won.team) + ' — yes.';
      roundSettler.reset();          // the question moved on, so every answer is worth trying again
      renderRound();
      Sound.play('correct');
      // the next rung is a new question — unless the round says it is not
      if(roundReasks()) askPhones(currentClueItem.text, roundHost.game);
      return;
    }
    verdicts.forEach(v=>{
      if(!roundSettler.fresh(v.team, roundKeyOf(v.set))) return;
      roundMiss(v.team, v.r);
    });
  }

  /* Whether this board keeps a question open after somebody has it right. Only the
     boards with a slot can answer it — Quickfire has none, so it is already true
     there by construction and asking would be a second way to say one thing. */
  function openToAllNow(){
    return !roundHost.scoreEach && !!S.get('roundOpenToAll', roundHost.game);
  }

  /* A right answer that was not first. It takes nothing — the slot is somebody
     else's — so it cannot go through `win()`, which is the function that pays *and*
     clears the tile, advances the line, ends the go. It is paid what the running rule
     decided instead.

     No streak and no `markRun`: a run is about holding the board, and this team has
     not taken anything. Paying a bonus for a second-place answer would also make the
     run multiplier the fastest way to score on a board where nobody is first. */
  function roundPayLate(team){
    const points = roundPayout()[team] || 0;
    if(!points || !teams[team]) return 0;
    /* The receipt cites the rule and the record — which pay rule was running, what
       place the record gave this team and how long they took — because "second at
       4.3s under podium" is checkable after the lesson and "+150" is not. */
    const rec   = Kit.round.results.of(team) || {};
    const place = Kit.round.results.place(team);
    return award(team, points, { streak:false,
      why: (PAY_RULES[S.get('roundPay', roundHost.game)] || PAY_RULES.winner).label +
           (isFinite(place) ? ' · ' + ordinalReport(place) : '') +
           (rec.seconds != null ? ' · ' + rec.seconds.toFixed(1) + 's' : '') });
  }

  /* ---------- the wrong-Send penalty, individuals only ----------
     How many wrong commits each phone has made *this question*, by player id —
     not a cache of anybody's index, and it dies with the question (`roundOpen`
     resets it). The cooldown rides the wire the type mode built and the infogap
     already reuses: `buzzHost.judge(id, 'wrong', {note, coolMs})` puts that
     phone alone on a displayed countdown. Time, never points — a round may not
     score, and this is the host's fact about pacing, so no round learns it. */
  let roundReplies = [];

  /* **Who to say this to.** A verdict on one competitor's answer belongs to the
     phones that produced it — the replies the host has just read — and only falls
     back to "everyone the roster puts on that competitor" when there are none,
     which is the teacher answering on the room's behalf.

     Asking the roster first was the bug waiting to happen: `p.team` is what the
     relay believes, and a phone that has joined or come back but not yet been
     seated is still reading as competitor 0. In a room of individuals that means
     one student's wrong Send putting somebody else on a countdown. Reported from a
     class of sixteen. A reply carries the id of the phone that sent it, so this
     cannot address the wrong person however stale a seat is. */
  function roundPhonesOf(team){
    if(!buzzHost) return [];
    const t = Number(team);
    const answered = (roundReplies || []).filter(r => r && Number(r.team) === t);
    if(answered.length) return answered.map(r => ({ id:r.id, name:r.name, team:t }));
    return (buzzHost.players() || []).filter(p => Number(p.team) === t)
             .map(p => ({ id:p.id, name:p.name, team:t }));
  }

  let sendMisses = {};
  /* Who is cooling right now, so the *room* can see it and not only the phone in
     the hand. Keyed by player id — never an index — and question-scoped: cleared
     wherever `sendMisses` is, so it is the record of one question rather than a
     roster cache with an invalidation table row. `until` is a wall-clock deadline
     because the strip re-reads it on a ticker; the phone counts its own down from
     the duration it was sent, exactly as every other clock here works. */
  let sendCooling = {};
  function roundSendPenalty(team, note){
    if(!Roster.solo() || !buzzHost) return 0;
    if(!S.get('roundSend', roundHost.game)) return 0;
    const secs = Number(S.get('roundSendCool', roundHost.game)) || 0;
    if(!secs) return 0;
    const ramp = !!S.get('roundSendRamp', roundHost.game);
    let waited = 0;
    /* In a solo room a competitor is one phone, and `p.team` is the relay's own
       record — the truth, since the seat seam fix. Ask the room, do not keep a
       copy of what it was told. */
    roundPhonesOf(team).forEach(p=>{
      const n = (sendMisses[p.id] || 0) + 1;
      sendMisses[p.id] = n;
      const ms = Math.round(secs * 1000 * (ramp ? n : 1));
      buzzHost.judge(p.id, 'wrong', { note: note || 'Not that one', coolMs: ms });
      sendCooling[p.id] = { name: p.name, team: Number(p.team), until: Date.now() + ms };
      waited = Math.max(waited, Math.round(ms / 1000));
    });
    renderPhoneBar();
    return waited;
  }

  /* **Tell this competitor's phones their commit landed.** The wrong half of this
     already existed as the Send penalty; the right half never did, because a correct
     answer used to be followed by a room-wide re-arm that said it implicitly. A round
     that declines the re-ask (`reasks`) has nothing else to speak with, so the phone
     is told directly — the same per-player wire the penalty rides, which no other
     handset hears and which no arm has to clear. */
  function roundSendRight(team, more){
    if(!buzzHost) return;
    /* Whether there is another one to send is the *host's* fact — it is the round
       saying `done` — so the phone is told rather than left to guess. A round that
       ends on a right answer would otherwise invite the player to keep going. */
    const note = more ? 'Yes — now the next one' : 'Yes — that finishes it';
    roundPhonesOf(team).forEach(p=>{ buzzHost.judge(p.id, 'right', { note }); });
  }

  /* **Push which options are now settled, without arming.** One definition of what
     "settled" means — the round's own `arm`, asked for it — so there is no second
     copy to drift. A round that names no `doneByTeam` pushes nothing, which is every
     round but the ordering one. The stored copy on the relay is what a reconnecting
     phone is handed back, so a player's record of their own ladder survives a
     reload; marking it live off the verdict alone would lose it on the first drop. */
  function roundSendDone(){
    const def = roundDef();
    if(!buzzHost || !roundState || !def || typeof def.done !== 'function') return;
    const per = def.done(roundState, roundCtx());
    if(Array.isArray(per)) buzzHost.done(per);
  }

  /* Whether a partial right answer changes what the phones are being asked. A round
     that says nothing means yes, which is what every round did before an ordering
     race asked to be left alone. */
  function roundReasks(){
    const def = roundDef();
    if(!def || !roundState || typeof def.reasks !== 'function') return true;
    return def.reasks(roundState) !== false;
  }

  function roundMiss(team, r){
    /* Wrong costs nothing but the time. The tile is still on the table, the other
       team is still assembling, and a class charged for a guess stops guessing. */
    const def = roundDef();
    const mode = S.get('roundCommentary', roundHost.game) || 'headline';
    /* The verdict, name-free, for the handset and the lane — both already know whose
       it is. A round that does not describe its own misses falls back to the plain
       note, so this stays correct for every round, not only the ones that opt in. */
    const rich = (typeof def.missNote === 'function') ? def.missNote(r, roundState) : 'Not that one';
    const wait = roundSendPenalty(team, S.get('roundHintPhone', roundHost.game) ? rich : 'Not that one');
    /* Stored per team so a lane or a feed can draw it; kept in every mode so flipping
       the setting mid-question has something to show. */
    roundState.verdictBy = roundState.verdictBy || {};
    roundState.verdictBy[team] = { text: rich, ok:false, at: Date.now() };
    /* The say line names the wait *once*, as part of the headline; the live countdown
       belongs to the strip. But that single overwriting headline is a blur in a room
       of individuals, so it is written only when the verdict is *meant* for it: in
       headline mode always, and in lane mode only for a round that cannot show its own
       miss (grouping can, and leaves the headline free for hints). Off writes nothing
       and leans on the running count. */
    const ownLane = (mode === 'lane') && (typeof def.missNote === 'function');
    if(mode === 'headline' || (mode === 'lane' && !ownLane)){
      roundState.say = def.saidOf(teamName(team), r, roundState)
                     + (wait ? ' · waiting ' + wait + 's' : '');
    }
    Sound.play('wrong');
    renderRound();
    notePhoneMiss(teamName(team), team, (roundState.picks[team] || []).join(', '), 'wrong');
    document.querySelectorAll('#clue-group .gword').forEach(el=>{
      if((roundState.picks[team] || []).indexOf(el.dataset.word) === -1) return;
      el.classList.add('shake');
      setTimeout(()=> el.classList.remove('shake'), 380);
    });
  }

  function roundTake(team){
    roundSettler.stop();
    roundState.done = true;
    roundState.say  = teamName(team) + ' has it.';
    renderRound();
    Sound.play(document.getElementById(roundHost.stage).classList.contains('lit')
               ? 'sting' : 'correct');
    /* The class produced the answer and the host judged it, so there is nothing left
       for the teacher to confirm — the same rule a typed word has always followed.
       A beat first, or the four lighting up and the card leaving land in one frame
       and the room never sees which four it was. */
    const label = (roundDef() || {}).label || 'Round';
    /* **Payable from this instant, not from the end of the beat.** The beat is a
       pause so the room sees which four lit before the card changes — but the win
       itself must not live inside a timer: a teacher clicking Close within a
       second of the answer landing used to hit the timeout's `!roundState` guard and
       the payout silently never happened. Found by the suite driving exactly that
       click; a real teacher on a fast board would hit it too. Close already knows
       how to pay whatever `roundWin` holds. */
    if(roundHolds()) roundWin = { team, label };
    setTimeout(()=>{
      if(!roundState) return;                 // the teacher closed the card in the meantime
      if(roundHolds()) roundHold(team, label);
      else roundPaySlot({ team, label });
    }, ROUND_TAKE_MS);
  }

  /* Whether this board waits for the teacher before taking a won round off screen.
     Only the two boards that put a round on the clue card can: Millionaire and
     Quickfire mount on their own stage, where the options are still there after the
     question ends and there is no card to hold. Derived from `mount` rather than
     named per game, so a third card board arrives already correct. */
  function roundHolds(){
    return roundHost.mount === CARD_MOUNT &&
           S.get('roundWinClose', roundHost.game) !== 'auto';
  }

  /* The card a team has just won, held open. **What is waiting is the payout, not
     the animation** — the alternative was to pay now and defer only the flip, which
     means splitting `closeModal` out of both hosts' `win()` and then re-running the
     board's after-work (a cleared Jeopardy board, a finished Blockbusters line) by
     hand from somewhere else. Deferring the whole thing keeps one path: Close
     presses the same button the round used to press for itself.

     The residual, stated rather than hidden: leaving the play screen without
     closing loses the points. Close is the only button on screen, so the only way
     there is abandoning the board — which already scores nothing on an ordinary
     clue left open, so it is the behaviour this board has always had. */
  let roundWin = null;
  function roundHold(team, label){
    roundWin = { team, label };
    /* **The prompt first, then the round — that order is load-bearing.** The round's
       card is mounted *inside* `#clue-text`, and `Kit.prompt.reveal` rewrites that
       element, so revealing the prompt second tore out the card that had just been
       drawn: the sentence, the letters or the four options simply never appeared. It
       depends on the clue's own question form, which is why it showed up as "the
       answer sometimes doesn't come up". The Reveal *button* has always done it in
       this order; this path had it backwards. */
    const inPlace = Kit.prompt.reveal(document.getElementById('clue-text'), currentClueItem);
    document.getElementById('clue-answer').style.display = inPlace ? 'none' : 'block';
    /* The answer, out on the card. This is the round's own `reveal` — the same one
       the Reveal button calls — because "what the answer was" is the round's to
       draw and there is no second version of it. Asked of `roundHost.mount()` rather
       than by id, because that is what puts the card back when the prompt has just
       replaced everything inside `#clue-text`. */
    roundDef().reveal(roundHost.mount(), roundState, roundCtx());
    // `reveal` speaks for the round; who took it is the host's, so it is said after
    roundState.say = teamName(team) + ' has it.';
    renderRound();
    roundStandDown();
    jClockStop();                 // the answer is out; whatever the clock said is over
    hideAllActionButtons();
    const close = document.getElementById('close-btn');
    close.textContent = 'Close — ' + teamName(team) + ' takes it';
    close.style.display = 'inline-block';
  }

  /* Paying a won round out. Reached either straight away (`auto`) or from the Close
     press, and it is the same function both ways so the two cannot drift. */
  function roundPaySlot(p){
    const value = currentClueValue;
    const paid = roundHost.win(p.team);
    notePhoneScore(teamName(p.team), p.team, null, paid || value);
    reportPayout(p.team, paid || value);
    /* **The winner's moment, which is now the standings.** The strip's note holds a
       second and a half and the card is already leaving, so from the back of a room a
       win was over before anybody could read whose it was — the first live class asked
       for this by name. What replaced the banner is one screen rather than two: it
       names who took it *and* shows everybody else moving, which is the thing that
       makes finishing second worth doing. It waits for the teacher rather than
       leaving by itself, because a table takes longer to read than a name. */
    if(standingsWanted(roundHost.game)){
      showStandings({ eyebrow: p.label,
                      title: teamName(p.team) + ' takes it — +' + (paid || value),
                      winner: p.team });
    }
  }

  /* The round is over — because the tile was taken, or because the teacher closed
     the card on it. Say the true thing to thirty handsets rather than leaving eight
     words up with a dead button: that is what "not asking them at all" did to the
     Daily Double, and it reads as broken rather than deliberate. */
  function roundEnd(){
    roundWin = null;         // whatever closed the card, nothing is waiting on it now
    if(!roundState) return;
    roundStandDown();
    roundState = null; roundSettler = null; roundId = null;
    S.setRound(null);        // back to the game's own value for anything that forks by round
    const host = document.getElementById('clue-group');
    if(host) host.remove();
    clearReplies();
    /* Anybody who left mid-question was held on the roster until now, because
       renumbering the competitors under a live round reattaches its per-team state
       to the wrong people. The question is over, so the tidy-up is safe — and it has
       to be asked for here rather than waited for, since the next roster event might
       be a whole lesson away. */
    if(buzzHost) seatSoloPlayers(buzzHost.players());
  }

  /* Telling thirty handsets the question is over, *without* taking the card down
     with it. The two used to be one function because they had only ever happened
     together; a won round that stays on screen splits them — the phones must stand
     down the moment the answer is out, or the room is holding a live-looking button
     for a question that has been decided, but the card is the whole point of
     waiting. The strip is deliberately not cleared here: who answered is what the
     teacher is about to read out. */
  function roundStandDown(){
    if(roundSettler) roundSettler.stop();
    if(buzzHost){
      buzzWinner = null;
      lastAsk = { mode:'off', prompt:'' };
      buzzHost.disarm();
      renderBuzzChip();
    }
  }

  function openJeopardyClue(cat, clue, tile){
    const review = tile.classList.contains('used');
    currentTile=tile; modalMode = review ? 'review' : 'jeopardy'; currentClueValue=clue.v;
    jSteal = null;
    jDoubleTeam = null;
    /* A Daily Double is a bet placed before the clue is seen, so the card opens on
       the wager and the clue is not drawn until it is locked in. Only the team that
       found it may answer — no buzzers, no steal — which is why the phones are not
       asked and the steal path is closed off below. */
    if(!review && tile.dataset.dd){
      delete tile.dataset.dd;
      jDoubleTeam = active;
      /* Tell the phones the room is not being asked. Not asking them at all was the
         first version and it left the *previous* question on every handset with a
         dead button — which reads as broken rather than deliberate, and left a phone
         still armed from that clue able to buzz in mid-wager. Disarming says the
         true thing: nothing is open to you, this one belongs to one team. */
      if(buzzHost){ buzzWinner = null; lastAsk = { mode:'off', prompt:'' };
                    buzzHost.disarm(); renderBuzzChip(); renderPhoneBar(); }
      openClueCard(tile);
      document.getElementById('clue-topline').textContent = 'DAILY DOUBLE';
      document.getElementById('clue-section').textContent = cat.section;
      document.getElementById('clue-card').classList.add('daily-double');
      if(document.getElementById('play-jeopardy').classList.contains('lit')) Sound.play('sting');
      else Sound.play('claim');
      openWager(active, { max: jMaxWager(active),
                          then: bet => { currentClueValue = bet; jShowClue(cat, clue, tile, false); } });
      return;
    }
    jShowClue(cat, clue, tile, review);
    openClueCard(tile);
  }

  // everything that was openJeopardyClue's body, so the Daily Double can run it
  // *after* its bet rather than duplicating it
  function jShowClue(cat, clue, tile, review){
    const dd = jDoubleTeam != null;
    document.getElementById('clue-topline').textContent =
      dd ? ('DAILY DOUBLE · ' + cat.name + ' · $' + currentClueValue)
         : (cat.name + ' · $' + clue.v + (review ? '  ·  review' : ''));
    document.getElementById('clue-section').textContent = cat.section;
    /* `reveal` and `group` ride along with the normalised shape. The normalisation
       exists so the kit never learns that Jeopardy calls a prompt `q` — but it is a
       whitelist, so anything an author adds to an item is invisible downstream
       until it is named here. That is the real friction in carrying a question
       dynamic across from the bench: `reveal` was silently dropped once and the
       hint button simply never appeared, with nothing anywhere saying why. */
    currentClueItem = { text:clue.q, answer:clue.a, type:clue.type, reveal:clue.reveal };
    /* Whatever field a registered round claims, carried across by asking the
       registry rather than by naming them here. Naming them is what silently
       dropped `reveal` when Story Reveal shipped and `order` the day the second
       round was written — the symptom both times being the feature simply never
       appearing. */
    Kit.round.fields().forEach(f => { if(clue[f] !== undefined) currentClueItem[f] = clue[f]; });
    /* A grouping clue's answer *is* its set, so it is derived rather than authored —
       two copies of one fact are two things that can drift, which is how a hexagon
       came to show `U` over an answer beginning with I. */
    /* Set up once and keep it: `setup` shuffles, so asking twice would draw one
       order for the answer line and another for the card. */
    const grp = roundOf(currentClueItem, 'jeopardy');
    if(grp) currentClueItem.answer = grp.state.answer;
    drawPrompt(document.getElementById('clue-text'), currentClueItem, 'jeopardy');
    /* Before `askPhones`, which consults `phoneRound()` — and `phoneRound()` cannot
       answer until the round exists. Also after `drawPrompt`, which owns `#clue-text`
       and clears it. */
    roundEnd();
    /* A Daily Double still gets its words — it is only the *phones* that a Daily
       Double excludes, because the clue belongs to the team that found it. Without
       the round the tile would open on an instruction with nothing to pick from,
       and the wager would be unanswerable. The team names their four out loud and
       the teacher clicks them, which is the no-relay path doing a second job;
       `jCorrect` already routes the payout to `jDoubleTeam` whoever is passed in. */
    // A round arms the room as it opens, so this covers the ordinary clues only.
    // A replayed tile asks nobody, and a Daily Double belongs to one team alone.
    const opened = (!review && grp) ? roundOpen(grp) : null;
    if(!review && !dd && !opened) askPhones(clue.q, 'jeopardy');
    const ansEl=document.getElementById('clue-answer');
    ansEl.textContent = currentClueItem.answer || clue.a || '';
    hideAllActionButtons();
    if(review){
      // already played — show everything, score nothing
      ansEl.style.display =
        Kit.prompt.reveal(document.getElementById('clue-text'), currentClueItem) ? 'none' : 'block';
      document.getElementById('close-btn').style.display='inline-block';
    } else {
      ansEl.style.display='none';
      document.getElementById('reveal-btn').style.display='inline-block';
      document.getElementById('close-btn').style.display='inline-block';
    }
    jTension(review ? 0 : (dd ? Math.max(clue.v, currentClueValue) : clue.v));
    jHintsUsed = 0;
    renderHintButton();
    /* After `hideAllActionButtons()`, which is the whole reason this is here rather
       than inside `roundOpen` — the round has to exist before `askPhones` asks the
       game what it is, and the buttons are cleared after that. */
    renderRoundButton();
  }

  function openBlockbustersClue(clueObj, hex){
    if(bbWon) return;                        // the round has an ending; nothing left to claim
    if(hex.classList.contains('claimed-gold') || hex.classList.contains('claimed-silver')) return;
    currentTile=hex; modalMode='blockbusters';
    /* The letter stays on the topline whatever is behind the hexagon. It is the
       hexagon's *name* — how a team says which one they are attacking, and what the
       picking vote counts — and it stopped being a promise about the answer's first
       letter the day a hexagon could open a round. A grouping set has four answers
       and an ordering scale has five; neither has an initial to match. */
    document.getElementById('clue-topline').textContent = clueObj.letter;
    document.getElementById('clue-section').textContent = clueObj.section;
    currentClueItem = { text:clueObj.clue, answer:clueObj.answer, type:clueObj.type };
    /* Whatever field a registered round claims, carried across by asking the
       registry rather than by naming them here — the same normalisation Jeopardy
       does, and for the same reason: naming them by hand is what silently dropped
       a feature twice, the symptom being that it simply never appeared. */
    Kit.round.fields().forEach(f => { if(clueObj[f] !== undefined) currentClueItem[f] = clueObj[f]; });
    /* Set up once and keep it: `setup` shuffles, so asking twice would draw one
       order for the answer line and another for the card. A round's answer is
       derived from the round rather than authored beside it, because two copies of
       one fact are two things that can drift. */
    const rnd = roundOf(currentClueItem, 'blockbusters');
    if(rnd) currentClueItem.answer = rnd.state.answer;
    /* Opening a hex answers the vote's question, so it ends there rather than
       waiting for the button — and it must end *before* askPhones, or the arm
       below would be overwritten by a vote nobody is still taking. */
    bbVoting = false; bbVote = null; renderBBVote();
    drawPrompt(document.getElementById('clue-text'), currentClueItem, 'blockbusters');
    /* After `drawPrompt`, which owns `#clue-text` and clears it, and before
       `askPhones`, which consults `phoneRound()` — and `phoneRound()` cannot say
       what the handsets want until the round exists. */
    roundEnd();
    if(!(rnd && roundOpen(rnd))) askPhones(clueObj.clue, 'blockbusters');
    const ansEl=document.getElementById('clue-answer'); ansEl.style.display='none';
    ansEl.textContent = currentClueItem.answer || clueObj.answer || '';
    hideAllActionButtons();
    document.getElementById('reveal-btn').style.display='inline-block';
    /* Every team that exists, not the first two. `allow` used to be [0,1] because
       the board is two-sided — but the side a team plays for is `bbSideOf`, so a
       four-team class can all answer; their hex simply takes their side's colour.

       A live round judges itself and pays the hexagon out of `roundHost.win`, so
       the chooser would be a second way to award the same square — it stands down
       until the round is over, exactly as Jeopardy's Correct and Wrong do, and the
       reveal puts it back for a class that never got there. */
    if(!rnd) clueClaim.show(teams, teams.map((_, i) => i));
    const bbSkip = document.getElementById('skip-btn');
    bbSkip.textContent = 'No claim / close';
    bbSkip.style.display='inline-block';
    /* After `hideAllActionButtons()`, which is the whole reason it is down here:
       the round's Check button is one of the buttons that clears. */
    renderRoundButton();
    bbTension(true);                 // think music while the clue is on the table
    openClueCard(hex);
  }

  /* ---- the card flip ----------------------------------------------------------
     The clue card grows out of the tile you clicked and turns over, so the tile
     itself appears to flip rather than a dialog appearing on top of it. Done with
     the Web Animations API against the real element rects, so it lands exactly on
     the tile whatever the board size. Falls back to an instant open when the
     animation is switched off or the machine asks for reduced motion. */
  const FLIP_OPEN_MS  = 1150;   // grow, hold on the value, then turn
  const FLIP_CLOSE_MS = 1000;   // turn back to the value, then settle into the tile
  const FLIP_HOLD_MS  = 550;    // beat before the card leaves, once it's been answered
  const FLIP_SPEEDS   = { relaxed:1.35, normal:1, snappy:0.72 };
  function flipMs(base){ return Math.round(base * (FLIP_SPEEDS[S.get('flipSpeed', activeGame)] || 1)); }

  // The card's own untransformed box. Measuring while a rotateY is applied gives the
  // projected box, which skews the maths and makes the card land off its tile.
  function naturalRect(card){
    const prev = card.style.transform;
    card.style.transform = 'none';
    const r = card.getBoundingClientRect();
    card.style.transform = prev;
    return r;
  }

  // 'off' is a variant like any other; reduced-motion overrides whatever is chosen
  function flipEnabled(){
    if(S.get('cardFlip', activeGame) === 'off') return false;
    try{ return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return true; }
  }

  // transform that maps the card onto `origin`'s position and size
  function originTransform(card, origin, deg){
    const c = naturalRect(card);
    const o = origin.getBoundingClientRect();
    if(!c.width || !c.height) return `rotateY(${deg}deg)`;
    const sx = Math.max(0.05, o.width / c.width);
    const sy = Math.max(0.05, o.height / c.height);
    const dx = (o.left + o.width/2) - (c.left + c.width/2);
    const dy = (o.top + o.height/2) - (c.top + c.height/2);
    return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) rotateY(${deg}deg)`;
  }

  /* The animations are registered rather than hard-coded, so a new one is a
     Kit.anim.register call plus a line in the `cardFlip` variants list — no
     branching in the game code and no panel edit.
       open(card, origin, ms, helpers)  -> Animation | null
       close(card, origin, ms, hold, helpers)
     `helpers.at(deg)` gives the transform that lands the card on its origin. */
  Kit.anim.register('cardFlip', 'grow-turn', {
    // the original, unchanged: grow out of the tile still showing its value, hold a
    // beat, then turn. Easing per segment, not across the whole run — one curve over
    // the lot makes the early phase rush and the hold on the value disappear. The
    // rotation segments are linear because an eased turn puts peak angular speed
    // exactly at the edge-on point, where the card appears to snap through.
    // rotation is 0° at .46 and 180° at 1, so it is edge-on halfway between
    edgeOn: { open: 0.73, close: 0.23 },
    open(card, origin, ms, h){
      return card.animate([
        { transform: h.at(0), opacity: 0.9, offset: 0, easing: 'cubic-bezier(.2,.85,.3,1)' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(0deg)',   opacity: 1, offset: 0.46, easing: 'linear' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity: 1, offset: 1 }
      ], { duration: ms, easing: 'linear' });
    },
    // keep turning the same way rather than reversing, come back to full size showing
    // the value, hold it a beat, then settle into the tile on a decelerating curve
    close(card, origin, ms, hold, h){
      return card.animate([
        { transform:'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity:1, offset:0,    easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.46, easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.58, easing:'cubic-bezier(.34,0,.2,1)' },
        { transform: h.at(360), opacity:0.9, offset:1 }
      ], { duration: ms, delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  /* Starts as whatever you actually clicked and unfolds into the card: a hexagon in
     Blockbusters, the tile's own corner radius in Jeopardy, and whatever a future
     board is drawn with — the shape is read off the element rather than assumed, so
     no new animation has to be written per board.
     The shape is animated on the two faces, not the card: clip-path on an element
     with transform-style:preserve-3d flattens it, which would kill the flip. */
  Kit.anim.register('cardFlip', 'morph', {
    edgeOn: { open: 0.73, close: 0.23 },        // same card keyframes as grow-turn
    open(card, origin, ms, h){
      morphFaces(card, origin, Math.round(ms*0.62), 0, false);
      return card.animate([
        { transform: h.at(0), opacity: 0.9, offset: 0, easing: 'cubic-bezier(.2,.85,.3,1)' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(0deg)',   opacity: 1, offset: 0.46, easing: 'linear' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity: 1, offset: 1 }
      ], { duration: ms, easing: 'linear' });
    },
    close(card, origin, ms, hold, h){
      // fold back only over the closing stretch, once the card starts shrinking
      morphFaces(card, origin, Math.round(ms*0.42), (hold||0) + Math.round(ms*0.58), true);
      return card.animate([
        { transform:'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity:1, offset:0,    easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.46, easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.58, easing:'cubic-bezier(.34,0,.2,1)' },
        { transform: h.at(360), opacity:0.9, offset:1 }
      ], { duration: ms, delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  function morphFaces(card, origin, ms, delay, reverse){
    const faces = [document.getElementById('clue-front'), document.getElementById('clue-back')];
    faces.forEach(f=>{
      if(!f) return;
      // the shape is read against the face, not the card: the rounding lives on the
      // faces, so measuring the card would morph the corners to square
      const shape = Kit.shapeOf(origin, f);
      if(!shape) return;
      const kf = [{}, {}];
      kf[0][shape.prop] = reverse ? shape.to : shape.from;
      kf[1][shape.prop] = reverse ? shape.from : shape.to;
      f.animate(kf, { duration: ms, delay: delay||0,
                      easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' });
    });
  }

  Kit.anim.register('cardFlip', 'turn-only', {
    // no travel: the card is already where it belongs and simply turns over. Quicker,
    // and much less movement across the screen for a class that finds the grow busy.
    edgeOn: { open: 0.65, close: 0.33 },
    open(card, origin, ms, h){
      return card.animate([
        { transform:'scale(0.94) rotateY(0deg)',   opacity:0.6, offset:0,   easing:'cubic-bezier(.3,.9,.4,1)' },
        { transform:'scale(1) rotateY(0deg)',      opacity:1,   offset:0.3, easing:'linear' },
        { transform:'scale(1) rotateY(180deg)',    opacity:1,   offset:1 }
      ], { duration: Math.round(ms*0.8), easing:'linear' });
    },
    close(card, origin, ms, hold, h){
      return card.animate([
        { transform:'scale(1) rotateY(180deg)', opacity:1,   offset:0,    easing:'linear' },
        { transform:'scale(1) rotateY(360deg)', opacity:1,   offset:0.66, easing:'cubic-bezier(.4,0,.2,1)' },
        { transform:'scale(0.94) rotateY(360deg)', opacity:0, offset:1 }
      ], { duration: Math.round(ms*0.7), delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  Kit.anim.register('cardFlip', 'rise', {
    // no 3D at all — the card rises into place and drops back. The fallback when a
    // classroom machine can't hold a frame rate through a rotation, and it still
    // needs the 180deg so the clue face is the one showing.
    edgeOn: { open: 0, close: 1 },              // the value face never faces us at all
    open(card, origin, ms, h){
      return card.animate([
        { transform:'translateY(34px) scale(0.92) rotateY(180deg)', opacity:0, offset:0, easing:'cubic-bezier(.2,.9,.3,1)' },
        { transform:'translateY(0px) scale(1) rotateY(180deg)',     opacity:1, offset:1 }
      ], { duration: Math.round(ms*0.5), easing:'linear' });
    },
    close(card, origin, ms, hold, h){
      return card.animate([
        { transform:'translateY(0px) scale(1) rotateY(180deg)',     opacity:1, offset:0, easing:'cubic-bezier(.5,0,.75,.5)' },
        { transform:'translateY(28px) scale(0.94) rotateY(180deg)', opacity:0, offset:1 }
      ], { duration: Math.round(ms*0.45), delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  /* Snapshot the origin transforms *before* the card's own transform is touched.
     originTransform measures via naturalRect, which forces a synchronous reflow;
     doing that after mutating the card delays the animation start by about a frame.
     Measuring first keeps the timing identical to the pre-kit implementation. */
  function originHelpers(card, origin){
    const cache = Object.create(null);
    [0, 180, 360].forEach(d => { cache[d] = originTransform(card, origin, d); });
    return { at: deg => (deg in cache) ? cache[deg] : originTransform(card, origin, deg) };
  }

  /* Take the value face off the screen the moment it turns away from the room.
     `backface-visibility:hidden` is on both faces and is *not* honoured on
     #clue-front here — captured frame by frame, the value stays painted and
     mirrored from about 100° to 180°, which is the "$100 reads backwards" report.
     It was invisible for so long because the only thing that ever hid the face was
     the `.flipped` class, and that arrives in onfinish, after the turn is over.

     So don't infer it from the geometry — drive it. Each variant declares the
     offset where its rotation is edge-on, and the face is switched at exactly that
     point. `visibility` animates discretely, which is what is wanted: a hard cut on
     the frame the face turns away, no fade to see through.

     Both faces are driven, not just the value face. Hiding only the front revealed
     what the mirrored face had been masking: the clue face is not painted during the
     turn either, so the card went blank for about four frames instead. Neither face's
     `backface-visibility` is doing anything useful here, so the swap is explicit and
     exactly one face is on screen at every instant.

     This is deliberately additive. backface-visibility and the .flipped rule both
     stay; a fifth variant that forgets to declare `edgeOn` still animates, it just
     falls back to the old behaviour rather than breaking. */
  /* Take the timing from the animation the variant actually returned rather than
     from the duration we asked for: turn-only runs at ms*0.8 and rise at ms*0.5, so
     passing the unscaled figure put the guard on a longer timeline than the turn and
     left one frame of mirrored value on screen. Reading it back means a variant can
     scale its own duration however it likes and the guard still lands. */
  function guardFace(anim, ms, at, closing){
    const front = document.getElementById('clue-front');
    const back  = document.getElementById('clue-back');
    if(!front || !back || at === undefined || at === null) return null;
    const t = anim && anim.effect && anim.effect.getTiming ? anim.effect.getTiming() : null;
    const dur   = t && typeof t.duration === 'number' ? t.duration : ms;
    const delay = t && typeof t.delay === 'number' ? t.delay : 0;
    const clamp = Math.min(1, Math.max(0, at));

    // one face on screen at every instant: they swap at the edge-on frame
    const swap = (el, from, to) => {
      const kf = clamp <= 0 ? [{ visibility:to,   offset:0 }, { visibility:to,   offset:1 }]
               : clamp >= 1 ? [{ visibility:from, offset:0 }, { visibility:from, offset:1 }]
               : [{ visibility:from, offset:0 }, { visibility:from, offset:clamp - 0.0001 },
                  { visibility:to,   offset:clamp }, { visibility:to, offset:1 }];
      return el.animate(kf, { duration: Math.max(1, dur), delay: delay, fill:'forwards' });
    };
    if(closing){ swap(front, 'hidden', 'visible'); return swap(back, 'visible', 'hidden'); }
    swap(front, 'visible', 'hidden');
    return swap(back, 'hidden', 'visible');
  }

  /* Every game draws its questions through here so the switch is read in one place.
     Off means plain text — which is exactly what the fallback path already does for
     an unrecognised form, so nothing special-cases it. */
  function drawPrompt(mount, item, game){
    if(S.get('promptForms', game)) return Kit.prompt.render(mount, item, game);
    mount.classList.remove('prompt-revealed');
    mount.textContent = String((item && item.text) || '');
    delete mount.dataset.promptType;
    return null;
  }

  function currentFlip(){
    if(!flipEnabled()) return null;
    // an animation chosen on the master tab may not suit this game — fall back
    // rather than silently doing nothing
    const want    = S.get('cardFlip', activeGame);
    const allowed = S.variantsFor('cardFlip', activeGame).map(v => v.value);
    const name    = allowed.indexOf(want) !== -1 ? want : 'grow-turn';
    return Kit.anim.get('cardFlip', name);
  }

  /* ---- dragging the card out of the way ----
     The card is centred on the screen, and the thing the teacher needs to see is
     sometimes exactly behind it — the tile they are about to take, a hexagon the
     other team is one answer from. Now that the board is visible through the layer,
     being able to shove the card aside is the other half of that.

     Written into `translate`, not `transform`: the flip animates transform through
     the Web Animations API, and an offset living in the same property would be
     overwritten by the next keyframe — or would fight the landing. They are
     separate longhands and compose, so a card can be dragged mid-flip and still
     land on its tile. */
  let cardOffset = { x:0, y:0 };
  function setCardOffset(x, y){
    cardOffset = { x, y };
    const card = document.getElementById('clue-card');
    if(card) card.style.translate = (x || y) ? (x + 'px ' + y + 'px') : '';
  }
  (function makeCardDraggable(){
    const card = document.getElementById('clue-card');
    if(!card) return;
    let from = null;
    card.addEventListener('pointerdown', e=>{
      // never steal a press meant for a control: the answer buttons and the team
      // chips live on this card, and they are what it is for
      if(e.target.closest('button, input, select, textarea, a, #clue-claim')) return;
      if(e.button !== 0 && e.pointerType === 'mouse') return;
      from = { px:e.clientX, py:e.clientY, x:cardOffset.x, y:cardOffset.y };
      document.body.classList.add('clue-dragging');
      try{ card.setPointerCapture(e.pointerId); }catch(_){}
    });
    card.addEventListener('pointermove', e=>{
      if(!from) return;
      /* Clamp so it can never be dragged off the screen entirely. Measured from the
         card's own rect rather than a guessed size, because the card is 720px on a
         TV and the width of a handset. */
      const r = card.getBoundingClientRect();
      const keep = 80;                       // this much of it stays reachable
      let x = from.x + (e.clientX - from.px);
      let y = from.y + (e.clientY - from.py);
      const left = r.left - cardOffset.x, top = r.top - cardOffset.y;
      x = Math.max(keep - left - r.width, Math.min(window.innerWidth - left - keep, x));
      y = Math.max(keep - top - r.height,  Math.min(window.innerHeight - top - keep, y));
      setCardOffset(x, y);
    });
    const end = e=>{
      if(!from) return;
      from = null;
      document.body.classList.remove('clue-dragging');
      try{ card.releasePointerCapture(e.pointerId); }catch(_){}
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  })();


  function openClueCard(origin){
    const modal = document.getElementById('clue-modal');
    const card  = document.getElementById('clue-card');
    /* A new clue arrives centred. Keeping the last drag would land the flip's
       opening animation somewhere the tile is not, and the offset was a decision
       about the *previous* question. */
    setCardOffset(0, 0);
    document.getElementById('clue-front-text').textContent =
      origin ? (origin.dataset.face || origin.textContent) : '';
    /* The card lives outside the stage, so it cannot inherit --tension the way the
       boards do. Feed it the same number: a $500 clue arrives hotter than a $100,
       reusing the contract rather than inventing a second one. */
    let stake = 0;
    if(activeGame === 'jeopardy' && currentClueValue){
      const { lo, hi } = jValueRange();
      stake = hi > lo ? (currentClueValue - lo) / (hi - lo) : 1;
    }
    card.style.setProperty('--tension', stake.toFixed(3));
    modal.style.display = 'flex';
    /* The board is visible again but it is not *live*: every action while a clue is
       open belongs to the card, and the 90% scrim used to be what stopped a stray
       click opening a second clue over the first. Seeing the board and being able to
       click it are different requests; this keeps the first and refuses the second. */
    document.body.classList.add('clue-open');
    card.getAnimations().forEach(a=>a.cancel());
    ['clue-front','clue-back'].forEach(id=>{
      const f=document.getElementById(id);
      if(f){ f.getAnimations().forEach(a=>a.cancel()); f.style.clipPath=''; f.style.borderRadius=''; }
    });
    card.classList.remove('flipped');

    const impl = currentFlip();
    if(!impl || !origin){
      card.style.transform = 'rotateY(180deg)';   // rest showing the clue face
      card.classList.add('flipped');
      return;
    }
    const helpers = originHelpers(card, origin);   // measure before mutating
    card.style.transform = 'rotateY(180deg)';
    Sound.play('flip');
    const ms   = flipMs(FLIP_OPEN_MS);
    const anim = impl.open(card, origin, ms, helpers);
    guardFace(anim, ms, impl.edgeOn && impl.edgeOn.open, false);
    if(anim) anim.onfinish = ()=> card.classList.add('flipped');
    else card.classList.add('flipped');
  }

  /* `then` runs once the card is out of the way — a board that wants to animate
     after a clue (Blockbusters lighting up a winning route) would otherwise do it
     behind the card. */
  function closeModal(hold, then){
    jClockStop();
    roundEnd();
    const modal  = document.getElementById('clue-modal');
    const card   = document.getElementById('clue-card');
    const origin = currentTile;
    currentTile=null; modalMode=null;          // clear state now; the animation is cosmetic

    let finished = false;
    const done = ()=>{
      if(finished) return; finished = true;
      modal.style.display='none';
      card.getAnimations().forEach(a=>a.cancel());
      // the face guard fills forwards on both faces, so drop it or they stay stuck
      ['clue-front','clue-back'].forEach(id=>{
        const f = document.getElementById(id);
        if(f) f.getAnimations().forEach(a=>a.cancel());
      });
      card.style.transform=''; card.classList.remove('flipped');
      document.body.classList.remove('clue-open');
      if(then) then();
    };
    const impl = currentFlip();
    if(!impl || !origin || !modal.style.display || modal.style.display==='none'){ done(); return; }

    card.getAnimations().forEach(a=>a.cancel());
    const helpers = originHelpers(card, origin);   // measure before mutating
    card.style.transform = 'rotateY(180deg)';
    card.classList.remove('flipped');          // the value has to be showable again
    // every close implementation uses fill:'forwards' — without it the card reverts
    // to full size for a frame before the modal hides, which reads as "it warps back in"
    const ms = flipMs(FLIP_CLOSE_MS);
    const anim = impl.close(card, origin, ms, hold||0, helpers);
    // coming back, the value face must stay off screen until it is facing the room
    guardFace(anim, ms, impl.edgeOn && impl.edgeOn.close, true);
    if(!anim){ done(); return; }
    anim.onfinish = done;
    anim.oncancel = ()=>{ if(!finished) done(); };
  }

  document.getElementById('reveal-btn').addEventListener('click', ()=>{
    /* **An open round has already decided who took it — revealing is what ends it.**
       The slot was held back so the rest of the room could finish, so this hands over
       to the ordinary take beat rather than to Correct/Wrong: the tile, the turn, the
       banner and the ending are all in there and none of them should have a second
       version. A question nobody got right has no `hostTook` and reveals as always. */
    if(roundLive() && roundState.hostTook != null){ roundTake(roundState.hostTook); return; }
    jClockStop();      // the answer is out; whatever the clock was saying is over
    Sound.play('reveal');
    // The word drops into the blank rather than only appearing underneath it —
    // the sentence completing itself is the moment a class actually watches. When
    // the renderer managed that, the separate answer line is just the same word
    // twice; when it couldn't (a long or explanatory answer) it is still needed.
    const inPlace = Kit.prompt.reveal(document.getElementById('clue-text'), currentClueItem);
    document.getElementById('clue-answer').style.display = inPlace ? 'none' : 'block';
    /* A grouping clue answers itself on the board: the four light up where they
       stand, which is the thing worth seeing. The answer line still prints them,
       because "which four" and "why those four" are different questions and the
       teacher is about to say the second one out loud. */
    if(roundLive()){
      if(roundSettler) roundSettler.stop();   // the answer is out; nothing left to judge
      roundDef().reveal(document.getElementById('clue-group'), roundState, roundCtx());
      renderRoundButton();
      /* The round has stopped judging, so the hexagon needs a hand to award it
         again. Blockbusters has no Correct button — claiming *is* how that board
         scores — so revealing a round clue has to put the chooser back or the
         square can only be left unclaimed. */
      if(modalMode === 'blockbusters') clueClaim.show(teams, teams.map((_, i) => i));
    }
    /* The final settles team by team rather than once, so revealing it hands over
       to that sequence instead of showing a single pair of buttons. */
    if(jFinalState){
      timerStop();
      document.getElementById('reveal-btn').style.display='none';
      document.getElementById('close-btn').style.display='none';
      jFinalSettle();
      return;
    }
    if(modalMode==='jeopardy'){
      document.getElementById('reveal-btn').style.display='none';
      document.getElementById('close-btn').style.display='none';
      const cb=document.getElementById('correct-btn');
      cb.textContent = '✓ Correct +$' + currentClueValue;
      cb.style.display='inline-block';
      document.getElementById('wrong-btn').style.display='inline-block';
    }
  });

  // Jeopardy: award the tile's value to the selected team, then pass the turn.
  /* ---------- the steal ----------
     A missed clue used to burn the tile and pass the turn, so a team had no reason
     to listen while the other one answered. Now the card stays open, the answer
     stays hidden, and the room is offered the question for half the points. The
     team that just missed it is excluded — `allow` on the shared chooser exists for
     exactly this kind of restriction.

     Returns true when it has taken the beat, which tells the shared wrong-answer
     path to stand down; false means "close it as before" and covers the switch
     being off, a two-team board where nobody is left to offer, and the second miss. */
  let jSteal = null;               // { from, to } while a stolen clue is live
  let jDoubleTeam = null;          // the team that found a Daily Double, while it is live

  /* ---------- the answer clock ----------
     Starts when a team takes the floor — the buzz, not the clue opening, because
     the teacher reads the clue aloud at their own pace and the pressure belongs on
     the team that claimed the right to answer. Its own countdown on the clue card
     rather than the header timer: that widget is the teacher's instrument, and a
     clock that reset it on every buzz would overwrite whatever they had set.

     Time up is a fact the room hears, not a verdict: klaxon, red pulse, and the
     buttons stay exactly as they were. The teacher controls everything is the
     app's constraint, and auto-marking wrong mid-sentence would fight it.

     **It runs on `Kit.round.clock` now, and that is the point of the shelf.** This
     and Quickfire's question clock were the same thirty lines written twice, and
     only one of them could ever have been read by a value curve. What is left here
     is what genuinely belongs to this board: where the number is painted, and that
     running out of time changes nothing. */
  function jClockStop(){
    Kit.round.clock.stop();
    const el = document.getElementById('clue-clock');
    if(el) el.remove();
    document.getElementById('clue-card').classList.remove('overtime');
  }
  function jClockStart(){
    jClockStop();
    const secs = Number(S.get('jAnswerSeconds', 'jeopardy')) || 0;
    if(!secs || activeGame !== 'jeopardy' || !clueIsOpen()) return;
    const el = document.createElement('span');
    el.id = 'clue-clock';
    document.getElementById('clue-topline').appendChild(el);
    Kit.round.clock.start({
      secs,
      onTick(left){
        const n = Math.ceil(left);
        el.textContent = String(n);
        el.classList.toggle('urgent', n <= 3);
      },
      /* The clock is stopped by the time this runs, so the mark it leaves has to be
         painted here rather than by a tick that will not come again. */
      onEnd(){
        el.textContent = '0';
        el.classList.add('urgent');
        document.getElementById('clue-card').classList.add('overtime');
        Sound.play('klaxon');
      }
    });
  }

  function jOfferSteal(teamIdx){
    /* A grouping clue has no rebound, because it had no floor. The steal exists so
       a team that was shut out of a question gets it when the team holding it
       misses — but every team was assembling this one at once, and nobody was
       excluded, so there is nothing to offer and nobody to offer it to. It burns
       the tile and passes the turn, as a miss did before the steal existed. */
    if(roundClue()) return false;
    if(!S.get('stealOnWrong', 'jeopardy')) return false;
    if(jSteal) return false;                       // one steal per clue, then it's gone
    const others = teams.map((_, i) => i).filter(i => i !== teamIdx);
    if(!others.length) return false;
    jSteal = { from: teamIdx, to: others[0] };

    /* Put the answer away again. Correct/Wrong only appear *after* Reveal, so by the
       time a miss is recorded the answer is on screen — offering the steal from
       there just invites the other team to read it out. Redraw the question
       unanswered; the stealing team gets the same question the first team had. */
    drawPrompt(document.getElementById('clue-text'), currentClueItem, 'jeopardy');
    document.getElementById('clue-answer').style.display = 'none';

    hideAllActionButtons();
    const line = document.getElementById('clue-topline');
    // what the card offers has to be what award() will pay — shown and paid must agree
    line.textContent = line.textContent.replace(/ · steal.*$/, '') + '  ·  steal for ' +
                       Math.round(currentClueValue / (S.get('stealFullValue','jeopardy') ? 1 : 2));
    clueClaim.show(teams, others);
    const skip = document.getElementById('skip-btn');
    skip.textContent = 'No steal / close';
    skip.style.display = 'inline-block';
    return true;
  }

  /* Nobody wanted it: burn the tile and pass the turn, exactly as a miss did before
     any of this existed. */
  function jDeclineSteal(){
    jSteal = null;
    if(currentTile) currentTile.classList.add('used');
    clueClaim.hide();
    closeModal(0, jAfterClue);
    nextTurn();
  }

  /* Someone claimed the steal: that team now owns the question, so re-open the
     normal reveal path with them on the hook. */
  function jTakeSteal(teamIdx){
    jSteal.to = teamIdx;
    clueClaim.hide();
    document.getElementById('reveal-btn').style.display = 'inline-block';
    document.getElementById('close-btn').style.display  = 'inline-block';
    jClockStart();     // the stealing team is on the floor now, same rule as a buzz
  }

  /* Paying a tile out, as a function rather than only as a button handler: a typed
     answer judged right on the host is the same event as the teacher pressing
     ✓ Correct, and the two must not drift. `to` names the team when something other
     than the turn decides it — a steal, or the phone that produced the word. */
  function jCorrect(to){
    const showy = document.getElementById('play-jeopardy').classList.contains('lit');
    const value = currentClueValue;
    // a Daily Double belongs to whoever found it, whatever the turn has done since
    const team  = (jDoubleTeam != null) ? jDoubleTeam
                : (to != null) ? to : (jSteal ? jSteal.to : active);
    Sound.bedStop();
    if(showy){
      Sound.play('sting'); jFlash('right');
      // the top of the board is worth a round of applause
      if(value >= jValueRange().hi) setTimeout(()=>Sound.applause(1500), 260);
    } else {
      Sound.play('correct');
    }
    if(currentTile){ currentTile.classList.add('used'); }   // keeps its value, faded
    let paid = 0;
    if(teams.length){
      paid = award(team, value, { steal: !!jSteal && team === jSteal.to,
                                  why: (jDoubleTeam != null) ? 'daily double bet' : 'tile ' + value });
      markRun(team, true);
    }
    jSteal = null; jDoubleTeam = null;
    document.getElementById('clue-card').classList.remove('daily-double');
    closeModal(flipMs(FLIP_HOLD_MS), jAfterClue);
    /* A team that answers keeps the board, and steal is what stops that running
       away — but "keep the board" is a reward for winning the question, and in
       `write` there is no winning it: the whole room answered. Nobody has earned
       the next pick, so the turn rotates and everyone gets one. */
    if(!S.get('keepControl', 'jeopardy') || everyoneAnswers()) nextTurn();
    return paid;
  }
  document.getElementById('correct-btn').addEventListener('click', ()=>{
    if(jFinalState && jFinalMark){ const f = jFinalMark; jFinalMark = null; f(true); return; }
    jCorrect(null);
  });
  document.getElementById('wrong-btn').addEventListener('click', ()=>{
    if(jFinalState && jFinalMark){ const f = jFinalMark; jFinalMark = null; f(false); return; }
    const showy = document.getElementById('play-jeopardy').classList.contains('lit');
    Sound.bedStop();
    if(showy){ Sound.play('klaxon'); jFlash('wrong'); }
    else Sound.play('wrong');
    const missed = (jDoubleTeam != null) ? jDoubleTeam : (jSteal ? jSteal.to : active);
    markRun(missed, false);
    /* The show takes the value off you, and a Daily Double takes the bet. Off by
       default here: a class that goes 500 down in the first two minutes stops
       trying, which is the opposite of what any of this is for. Scores may go
       negative — that is the rule, not an accident. */
    /* …but not on a grouping clue, where `missed` is only "whoever happened to be
       on turn". Every team was playing it at once, so charging one of them is
       charging the wrong people — the same reason `keepControl` stands down when
       the whole room answered. */
    if(S.get('jDeduct', 'jeopardy') && teams[missed] && modalMode === 'jeopardy' && !roundClue()){
      ledgerNote(missed, -currentClueValue, 'wrong answer · deduction rule');
      teams[missed].score -= currentClueValue;
      renderScorebar();
    }
    // a Daily Double is answered by one team alone, so there is no steal to open
    if(jDoubleTeam == null && hook('onWrong', missed)) return;
    if(currentTile){ currentTile.classList.add('used'); }   // keeps its value, faded
    jSteal = null; jDoubleTeam = null;
    document.getElementById('clue-card').classList.remove('daily-double');
    closeModal(flipMs(FLIP_HOLD_MS), jAfterClue);
    nextTurn();
  });

  document.getElementById('close-btn').addEventListener('click', ()=>{
    /* A round that has been won is waiting on this press to pay: the win closes the
       card itself, exactly as it did when it closed it a second after the answer
       landed. Cleared first, so the close it triggers cannot come back round here. */
    if(roundWin){ const p = roundWin; roundWin = null; roundPaySlot(p); return; }
    closeWager();
    jDoubleTeam = null;
    document.getElementById('clue-card').classList.remove('daily-double');
    const wasJeopardy = modalMode==='jeopardy' || modalMode==='review';
    closeModal(0, wasJeopardy ? ()=>jTension() : null);
  });

  /* A slow wash over the board on the result — same 1.5Hz ceiling and the same
     reduced-motion opt-out as Millionaire's. */
  function jFlash(kind){
    const stage = document.getElementById('play-jeopardy');
    if(!stage.classList.contains('lit') || !motionOK()) return;
    stage.classList.remove('flash-right','flash-wrong');
    void stage.offsetWidth;
    stage.classList.add(kind==='right' ? 'flash-right' : 'flash-wrong');
    setTimeout(()=>stage.classList.remove('flash-right','flash-wrong'), 900);
  }

  /* Once the card is back on its tile: reset the lights to the board's own level,
     and if that was the last tile, call the game. A cleared board used to do
     nothing at all — the same gap Blockbusters had. */
  function jAfterClue(){
    if(activeGame !== 'jeopardy') return;
    jTension();
    const tiles = [...document.querySelectorAll('#board .tile')];
    if(!tiles.length || tiles.some(t=>!t.classList.contains('used'))) return;
    if(S.get('jFinalQuestion', 'jeopardy') && jFinalCanRun()) jStartFinal();
    else jFinish();
  }

  /* ================= THE FINAL CLUE =================
     The reason the show never feels decided early: everyone bets what they like, so
     last place can win from there and nobody has mentally left the room by the last
     five minutes. Three beats — bet, answer, settle — and the teacher drives all
     three, as with everything else here.

     A team on nothing or less cannot bet, which is the show's rule and also the
     sensible one: there is nothing to wager with. */
  let jFinalState = null;
  let jFinalWasPlayed = false;

  function jFinalPlayers(){
    return teams.map((t, i) => i).filter(i => teams[i] && teams[i].score > 0);
  }
  function jFinalClue(){
    /* Prefer a clue the room has *not* seen: the categories that were left off the
       board. Only if the teacher picked everything does it fall back to a played
       one, which is worth knowing rather than pretending. */
    const onBoard = new Set(selectedContent);
    const spare = JEOPARDY_CATEGORIES.filter(c => !onBoard.has(c.id));
    const from  = spare.length ? spare : JEOPARDY_CATEGORIES.filter(c => onBoard.has(c.id));
    const cat   = from[Math.floor(Math.random() * from.length)];
    if(!cat || !cat.clues || !cat.clues.length) return null;
    const clue = cat.clues[Math.floor(Math.random() * cat.clues.length)];
    return { cat, clue, unseen: spare.length > 0 };
  }
  function jFinalCanRun(){
    return jFinalPlayers().length > 0 && !!jFinalClue();
  }

  function jStartFinal(){
    const picked = jFinalClue();
    if(!picked){ jFinish(); return; }
    jFinalState = { cat:picked.cat, clue:picked.clue, unseen:picked.unseen,
                    order:jFinalPlayers(), bets:{}, at:0, marked:{} };
    if(document.getElementById('play-jeopardy').classList.contains('lit')) Sound.play('sting');
    showResult({
      eyebrow:'Jeopardy · the final clue',
      title:'One more clue',
      sub:'The category is ' + jFinalState.cat.name + '. Every team bets what it likes — ' +
          'a team in last can still win.',
      actions:[{ label:'Take the bets', primary:true, onPick:jFinalNextBet }]
    });
  }

  /* Each team in turn, on the card the rest of the game already uses. The bet is
     placed knowing only the category, which is the whole tension of it. */
  function jFinalNextBet(){
    if(!jFinalState) return;
    if(jFinalState.at >= jFinalState.order.length){ jFinalAsk(); return; }
    const team = jFinalState.order[jFinalState.at];
    modalMode = 'jeopardy';
    currentTile = null;
    jSteal = null; jDoubleTeam = null;
    document.getElementById('clue-topline').textContent = 'FINAL · ' + jFinalState.cat.name;
    document.getElementById('clue-section').textContent = jFinalState.cat.section;
    document.getElementById('clue-card').classList.add('daily-double');
    openClueCard(null);
    openWager(team, { max: teams[team].score, then: bet => {
      jFinalState.bets[team] = bet;
      jFinalState.at++;
      closeModal(0, jFinalNextBet);
    } });
  }

  function jFinalAsk(){
    const st = jFinalState;
    if(!st) return;
    st.asking = true;          // from here the room writes, whatever the mode says
    currentClueValue = 0;
    currentTile = null;
    modalMode = 'jeopardy';
    document.getElementById('clue-card').classList.remove('daily-double');
    document.getElementById('clue-topline').textContent = 'FINAL CLUE · ' + st.cat.name;
    document.getElementById('clue-section').textContent = st.cat.section;
    currentClueItem = { text:st.clue.q, answer:st.clue.a, type:st.clue.type };
    drawPrompt(document.getElementById('clue-text'), currentClueItem, 'jeopardy');
    document.getElementById('clue-text').style.display = '';
    const ans = document.getElementById('clue-answer');
    ans.textContent = st.clue.a; ans.style.display = 'none';
    hideAllActionButtons();
    document.getElementById('reveal-btn').style.display = 'inline-block';
    openClueCard(null);
    askPhones(st.clue.q, 'jeopardy');     // every team writes this one
    timerSetDuration(30); timerStart();
    jTension(jValueRange().hi);
  }

  /* Settling it: each team that bet is marked right or wrong, lowest score first as
     the show does it, and the bet is added or taken away. */
  function jFinalSettle(){
    const st = jFinalState;
    if(!st) return;
    st.asking = false;         // answers are in; the phones go back to the mode
    const pending = st.order.filter(i => st.marked[i] == null);
    if(!pending.length){ jFinalState = null; jFinalWasPlayed = true; jFinish(); return; }
    const team = pending.sort((a, b) => teams[a].score - teams[b].score)[0];
    hideAllActionButtons();
    document.getElementById('clue-topline').textContent =
      teams[team].name + ' bet $' + (st.bets[team] || 0);
    const mark = (right) => {
      st.marked[team] = right;
      if(st.bets[team]) ledgerNote(team, (right ? 1 : -1) * st.bets[team],
                                   right ? 'final clue · bet won' : 'final clue · bet lost');
      teams[team].score += (right ? 1 : -1) * (st.bets[team] || 0);
      markRun(team, right);
      renderScorebar();
      Sound.play(right ? 'correct' : 'wrong');
      jFinalSettle();
    };
    const ok = document.getElementById('correct-btn');
    const no = document.getElementById('wrong-btn');
    ok.style.display = 'inline-block'; no.style.display = 'inline-block';
    ok.textContent = '✓ ' + teams[team].name + ' +$' + (st.bets[team] || 0);
    no.textContent = '✗ ' + teams[team].name + ' −$' + (st.bets[team] || 0);
    jFinalMark = mark;
  }
  let jFinalMark = null;

  function jFinish(){
    const wasFinal = jFinalWasPlayed;
    jFinalWasPlayed = false;
    closeModal(0, null);
    /* Together: there is nobody to rank. The class either reached the number or it
       did not, and either way the sentence is about what the room did. */
    if(jTogether()){ jFinishTogether(); return; }
    const ranked = teams.map((t,i)=>({ t, i })).sort((a,b)=>b.t.score - a.t.score);
    const top    = ranked[0];
    if(!top) return;
    const drawn  = ranked.length > 1 && ranked[1].t.score === top.t.score;
    if(document.getElementById('play-jeopardy').classList.contains('lit')){
      Sound.fanfare(); setTimeout(()=>Sound.applause(2400), 700);
    } else {
      Sound.play('clear');
    }
    showResult({
      eyebrow: wasFinal ? 'Jeopardy · after the final clue' : 'Jeopardy · board cleared',
      title: drawn ? 'It\'s a tie!' : (top.t.name + ' wins!'),
      sub: drawn ? ranked.filter(r=>r.t.score===top.t.score).map(r=>r.t.name).join(' and ') +
                   ' finish level on $' + top.t.score + '.'
                 : 'Final score $' + top.t.score + '.',
      tone: !drawn && top.i < 2 ? (top.i===0 ? 'gold' : 'silver') : null,
      actions:[{ label:'Close', primary:true, onPick:function(){} }]
    });
  }

  function jFinishTogether(){
    const got = jClassTotal(), target = jTargetScore();
    const beat = target > 0 && got >= target;
    const lit  = document.getElementById('play-jeopardy').classList.contains('lit');
    if(beat || !target){
      if(lit){ Sound.fanfare(); setTimeout(()=>Sound.applause(2400), 700); } else Sound.play('clear');
    } else {
      Sound.play('clear');
    }
    showResult({
      eyebrow:'Jeopardy · together',
      title: !target ? ('The class scored $' + got)
           : beat    ? 'Target beaten!'
                     : ('$' + (target - got) + ' short'),
      sub: !target ? 'Board cleared.'
         : ('The class took $' + got + ' of a $' + target + ' target, from a board worth $' +
            jBoardTotal + '.'),
      tone: beat ? 'gold' : null,
      actions:[{ label:'Close', primary:true, onPick:function(){} }]
    });
  }

  // Blockbusters: claim (or skip) a hex, award +1 to the claiming team, pass turn.
  function claimHex(idx){
    const claimed = idx != null && idx >= 0 && !!teams[idx];
    const side    = claimed ? bbSideOf(idx) : null;
    const showy = document.getElementById('play-blockbusters').classList.contains('lit');
    Sound.bedStop();
    if(claimed) Sound.play(showy ? 'sting' : 'claim');
    let paid = 0;
    if(currentTile && modalMode==='blockbusters' && claimed){
      // the hexagon belongs to a *side* — that is what a line is made of — while the
      // points belong to the team that answered
      currentTile.classList.add(side===0 ? 'claimed-gold' : 'claimed-silver');
      currentTile.textContent='';
      // a hex taken by the side that wasn't on turn is a steal, and scores as one
      paid = award(idx, 1, { steal: side !== bbTurn, why:'hexagon' });
      markRun(idx, true);
    }
    // work out the ending now, but let the card land before showing it
    const outcome = claimed ? bbOutcome() : null;
    closeModal(claimed ? flipMs(FLIP_HOLD_MS) : 0,
               outcome ? ()=>bbFinish(outcome) : ()=>bbTension());
    /* Keeping the board on a correct answer: the team on turn that claims its own
       hex goes again. A steal or a skip always hands over — otherwise a team that
       lost the question would keep the turn it just failed to use. */
    /* Whoever answered has used their side's go, so that side's next team is up
       when it comes round again — including when the side keeps the board, which is
       what stops one student on an alliance answering every question. A no-op with
       two teams, where each side has exactly one. */
    if(claimed) bbAdvanceSide(side);
    const kept = claimed && side === bbTurn && S.get('keepControl', 'blockbusters');
    if(!kept) bbTurn = Kit.passTurn(2, bbTurn);
    renderBBTurn();
    renderBBVote();      // the button names the team whose turn it now is
    renderScorebar();
    return paid;
  }
  /* Skip belongs to whichever game put the card up. Blockbusters uses it to leave a
     hex unclaimed; Jeopardy now uses it to decline a steal, which it must have —
     offering the question with no way to say "nobody wants it" strands the teacher
     on a card with every other button hidden. */
  /* The docked settings drawer ("Lab") and its L-key toggle are gone — a game's
     settings are changed from the room bench now, not on the board. */

  document.getElementById('buzzer-chip').addEventListener('click', ()=>{
    if(buzzHost) joinPanelOpen() ? hideJoinPanel() : showJoinPanel();
  });
  document.getElementById('join-close').addEventListener('click', hideJoinPanel);
  /* The standings wait for the teacher rather than leaving on a timer, because a
     table takes longer to read than a name — and on a board where the next question
     is one press away, whoever is reading it is the one deciding when to move on. */
  document.getElementById('standings-go').addEventListener('click', hideStandings);
  document.getElementById('standings-report').addEventListener('click', ()=> renderScoreReport());
  document.getElementById('report-close').addEventListener('click', ()=>
    document.getElementById('report-modal').classList.remove('on'));
  document.getElementById('report-clear').addEventListener('click', ()=>{
    window.HubReport.clear();
    renderScoreReport();
  });
  document.getElementById('join-modal').addEventListener('click', e=>{
    if(e.target.id === 'join-modal') hideJoinPanel();      // click the backdrop to dismiss
  });

  document.getElementById('skip-btn').addEventListener('click', ()=>{
    if(modalMode === 'jeopardy' && jSteal){ jDeclineSteal(); return; }
    claimHex(null);
  });

  /* ================= MILLIONAIRE =================
     Four options, rising difficulty. Every team climbs its **own** ladder and turns
     alternate, which answers the open question in spec §9.5: parallel ladders give
     each team a full arc, and interleaving the turns means nobody sits out for eight
     questions the way a one-team-at-a-time run would.

     Scoring is additive — a correct answer banks that rung's value and nothing is
     ever taken away. §4.4 wanted safe havens so a late mistake doesn't wipe a team
     out; not losing anything in the first place solves that more simply, and it
     keeps this game consistent with the shared team bar the others feed. A wrong
     answer costs the turn, and the team tries that rung again with a different
     question next time round. */
  const M_LADDER = [100, 200, 300, 500, 800, 1200, 1600, 2000];

  let mState   = [];     // per team: {rung, used:Set<prompt>, lifelines:{}}
  let mCurrent = null;   // {q, options[], team}
  let mAnswered = false;
  /* Ask the class runs on this board's own state, not Kit.vote — the counts are
     painted straight from the phone replies as they arrive. `mTally` is a boolean:
     true once the class has voted, which spends the lifeline and keeps its counts on
     the options. (Blockbusters' hexagon vote is the one that uses Kit.vote.) */
  let mTally   = null;   // true once Ask the class has run — the lifeline is spent
  /* Counting is not the same thing as having counts. While the teacher is tapping
     hands, a click on an option adds a hand; once the count is in, a click has to
     answer the question — otherwise the round dead-ends with the votes on screen
     and no way to play them. With phones voting there is no tapping at all, so the
     board is never a tally pad in the first place. */
  let mCounting = false;
  /* A phone vote is open: the counts are arriving over the wire rather than off
     the teacher's fingers. Distinct from `mCounting` because the board behaves
     oppositely — clicking an option answers the question — and distinct from
     `mTally` because the votes outlive the vote being open. It is what says the
     phones are borrowed, so closing it hands them back to `phoneMode`. */
  let mVoting = false;
  /* The option the team has said out loud but not locked in. Held separately from
     the answer because it is reversible: until "Final answer?" it can move to any
     other option, or be thrown away entirely by a lifeline. */
  let mPicked  = null;

  /* One definition of "this bank item, as a round". The deal uses it and so does the
     content screen, through the `asRound` hook — two copies would be two things that
     could disagree about what a question is. */
  function mAsRound(q){
    if(!q || !q.distractors) return q;
    return { text:q.prompt, answer:q.answer, type:q.type,
             choice:{ options:[q.answer, ...q.distractors], answer:q.answer } };
  }

  function mTeamState(i){
    if(!mState[i]) mState[i] = { rung:0, used:new Set(), lifelines:{ fifty:true, class:true, confer:true } };
    return mState[i];
  }

  function buildMillionaire(){
    mState = []; mCurrent = null; mAnswered = false; mTally = null; mCounting = false;
    mVoting = false; mPicked = null;
    teams.forEach((t,i)=>mTeamState(i));
    active = 0;
    renderScorebar();
    nextMillionaireQuestion();
  }

  function pickQuestion(team){
    const st   = mTeamState(team);
    const rung = Math.min(st.rung, M_LADDER.length-1);
    const pool = MILLIONAIRE_BANK.filter(q=>selectedContent.includes(groupOf(q)) && q.level === rung+1);
    if(!pool.length) return null;
    const fresh = pool.filter(q=>!st.used.has(q.prompt));
    return shuffle((fresh.length ? fresh : pool).slice())[0];
  }

  function nextMillionaireQuestion(){
    mAnswered = false; mTally = null; mCounting = false; mVoting = false; mPicked = null;
    const st = mTeamState(active);

    if(st.rung >= M_LADDER.length){       // this team has topped out
      renderMillionaire();
      showMillionaireMessage((teams[active] ? teams[active].name : 'Team') + ' has cleared the ladder!');
      Sound.bedStop();
      if(document.getElementById('play-millionaire').classList.contains('lit')){
        Sound.fanfare(); setTimeout(()=>Sound.applause(2600), 700);
      } else {
        Sound.play('clear');
      }
      return;
    }
    const q = pickQuestion(active);
    if(!q){
      renderMillionaire();
      showMillionaireMessage('No question left at this level for the sections you picked.');
      return;
    }
    st.used.add(q.prompt);
    mCurrent = { q, team:active };
    /* **Normalised into a round, not migrated in the bank.** The item stays
       `{prompt, answer, distractors, level}` — the ladder still needs `level`, and
       the round has never learned that this bank calls a prompt `prompt`. Exactly
       the move `jShowClue` makes turning `q` into `text`, so all 52 authored items
       became rounds with no content edit at all. The round shuffles the options. */
    currentClueItem = mAsRound(q);
    const found = roundOf(currentClueItem, 'millionaire');
    roundEnd();
    const opened = found ? roundOpen(found) : null;
    renderMillionaire();
    /* A new question ends any borrowing: the phones go back to whatever the mode
       says, the same as in the tile games. Voting is not a mode any more, so there
       is nothing to exempt here — it comes and goes inside a question. Only when no
       round opened, because opening one has already armed the room. */
    if(!opened) askPhones(q.prompt, 'millionaire');
  }

  function showMillionaireMessage(text){
    roundEnd();
    document.getElementById('m-question').textContent = text;
    document.getElementById('m-options').innerHTML = '';
    document.getElementById('m-hint').textContent = '';
    document.getElementById('m-next').style.display = 'inline-block';
    document.getElementById('m-done-count').style.display = 'none';
    document.getElementById('m-final').style.display = 'none';
  }

  function renderMillionaire(){
    const turnEl = document.getElementById('m-turn');
    const st = mTeamState(active);
    const rung = Math.min(st.rung, M_LADDER.length-1);
    turnEl.textContent = (teams[active] ? teams[active].name : 'Team') +
                         ' · playing for ' + M_LADDER[rung];

    // lifelines belong to the team whose turn it is
    document.querySelectorAll('#m-lifelines .lifeline').forEach(btn=>{
      const on = S.get('mLifelines', 'millionaire');
      btn.style.display = on ? 'inline-block' : 'none';
      const needsRoom = btn.dataset.life === 'class' && !buzzHost;
      btn.disabled = !on || !st.lifelines[btn.dataset.life] || !mCurrent || mAnswered || needsRoom;
      btn.title = needsRoom ? 'No phones in the room — nothing to reveal' : '';
      btn.classList.toggle('spent', !st.lifelines[btn.dataset.life]);
    });

    renderLadder();
    mTension();          // one place keeping the lights and the music in step
    if(!mCurrent) return;

    drawPrompt(document.getElementById('m-question'),
                      { text:mCurrent.q.prompt, answer:mCurrent.q.answer, type:mCurrent.q.type },
                      'millionaire');
    /* **The options are the multiple choice round now**, drawn into this game's own
       stage rather than a clue card — which is the whole of F3.8.9, and cost one
       `mount` fact in `ROUND_HOSTS`. What was here before was the same question drawn
       a second way: its own A/B/C/D, its own picked state, its own vote counts, none
       of it reachable from any other board. */
    renderRound();

    mSayHint();
    document.getElementById('m-next').style.display = 'none';
    /* No "Done voting" any more, and its absence is the point: the round holds the
       room for the whole question, so there is no borrowing to hand back. */
    document.getElementById('m-done-count').style.display = 'none';
    /* `m-final` is the round's commit button now, shown and worded by
       `renderRoundButton` — setting it here as well is how the two would disagree. */
  }

  /* ---- how tense it should feel right now ----
     The ladder already holds the only number this needs: rung 0 of 8 is a warm-up,
     rung 7 is the last question of the night. One value drives both halves of the
     atmosphere — the CSS reads `--tension` to close the spotlight in and pull the
     colour towards red, and the think-music bed uses it for tempo and brightness.
     Nothing here runs unless the game show skin is on. */
  function mTension(){
    stageTension('millionaire', () => {
      const st = mTeamState(active);
      // the bed plays under a live question and stops the moment one is answered, so
      // it never runs under the teacher reading out the result
      return { t: Math.min(st.rung, M_LADDER.length-1) / (M_LADDER.length-1),
               live: !!(mCurrent && !mAnswered) };
    });
  }

  /* A short light wash over the stage — the show's "lights change on the answer".
     Capped well under 3Hz and skipped entirely for reduced motion: a projected
     full-screen strobe in front of a class you don't have medical histories for is
     not a risk worth taking for a flourish. */
  function mFlash(kind){
    const stage = document.getElementById('play-millionaire');
    if(!stage.classList.contains('lit') || !motionOK()) return;
    stage.classList.remove('flash-right','flash-wrong');
    void stage.offsetWidth;                        // restart the animation
    stage.classList.add(kind === 'right' ? 'flash-right' : 'flash-wrong');
    setTimeout(()=>stage.classList.remove('flash-right','flash-wrong'), 900);
  }

  /* Same rule as the other boards: fill the screen, never scroll. The stage takes
     whatever is left under the header and above the team bar, and the options and
     ladder stretch into it. */
  function fitMillionaire(){
    Kit.fitToScreen(document.getElementById('m-main'), { min:260, gap:12, floor:true });
  }

  function renderLadder(){
    const wrap = document.getElementById('m-ladder');
    wrap.innerHTML = '';
    for(let i = M_LADDER.length - 1; i >= 0; i--){
      const row = document.createElement('div');
      row.className = 'm-rung';
      const st = mTeamState(active);
      if(i < st.rung)  row.classList.add('cleared');
      if(i === st.rung) row.classList.add('here');
      const n = document.createElement('span'); n.className='m-rung-n'; n.textContent = i+1;
      const v = document.createElement('span'); v.className='m-rung-v'; v.textContent = M_LADDER[i];
      row.appendChild(n); row.appendChild(v);
      wrap.appendChild(row);
    }
  }

  /* The line under the options. Its own function because a nomination refreshes it
     without redrawing the whole board. */
  function mSayHint(){
    if(!mCurrent || mAnswered) return;
    const nom = mNominated();
    document.getElementById('m-hint').textContent =
      nom      ? 'Locked on ' + nom + ' — or pick another option to change it.'
      : mTally ? 'The class has voted — their picks are on the options.'
      : '';
  }

  /* What the team has nominated, read off the round rather than kept beside it.
     `mPicked` used to be a second copy of this and the two could disagree. */
  function mNominated(){ return (roundState && roundState.chosen && roundState.chosen[0]) || null; }

  /* Everything a question ending does to the board, whichever way it ended. */
  function mEndQuestion(){
    /* **Show which one was right.** On a tile the card flips away and nobody needs
       telling; here the options stay on screen for the rest of the beat, so ending
       without revealing leaves four live-looking options and no answer. `reveal`
       also clears the lock, which is what stops the nomination outliving the
       question it belonged to. */
    if(roundState && !roundState.shown) roundDef().reveal(roundHost.mount(), roundState, roundCtx());
    mAnswered = true;
    mVoting = false; mCounting = false;
    document.getElementById('m-done-count').style.display = 'none';
    document.getElementById('m-final').style.display = 'none';
    renderScorebar();
    renderLadder();
    // the ladder now shows the new rung lit, so the stage has to agree — without
    // this the lights stayed on the old rung until the next question was dealt
    mTension();
    document.querySelectorAll('#m-lifelines .lifeline').forEach(b=>b.disabled = true);
    document.getElementById('m-next').style.display = 'inline-block';
  }

  /* The round says a team has it; this says what that is worth here. Called through
     `ROUND_HOSTS.millionaire.win`, and it returns what it paid because the phone
     strip names the student and the amount. */
  function mPayRung(team){
    const st = mTeamState(team);
    const value = M_LADDER[Math.min(st.rung, M_LADDER.length - 1)];
    const paid = award(team, value, { steal: !!(mCurrent && mCurrent.stolen),
                                      why: 'rung ' + value });
    markRun(team, true);
    st.rung += 1;
    document.getElementById('m-hint').textContent = '+' + paid;
    if(document.getElementById('play-millionaire').classList.contains('lit') &&
       st.rung >= M_LADDER.length - 1) setTimeout(()=>Sound.applause(1600), 300);
    mEndQuestion();
    return paid;
  }

  /* A wrong answer on this board is not free, which is the one place Millionaire
     genuinely differs from every other host: it ends the go. Offer the rung to the
     next team once — without that a wrong answer is dead air for everyone else in
     the room — and otherwise reveal and move on.

     Returns true either way, because the generic "costs nothing, try again" path
     below it would be wrong here in both cases. */
  function mMissed(team){
    markRun(team, false);
    const st = mTeamState(team);
    const others = teams.map((_, i) => i).filter(i => i !== team);
    if(S.get('stealOnWrong', 'millionaire') && mCurrent && !mCurrent.stolen && others.length){
      mCurrent.stolen = true;
      mCurrent.team   = others[0];
      if(roundState) roundState.chosen = [];
      document.getElementById('m-hint').textContent =
        (teams[mCurrent.team] ? teams[mCurrent.team].name : 'The other team') +
        ' can steal it for ' + Math.round(M_LADDER[Math.min(st.rung, M_LADDER.length-1)] /
                                          (S.get('stealFullValue','millionaire') ? 1 : 2));
      if(document.getElementById('play-millionaire').classList.contains('lit')){
        Sound.play('klaxon'); mFlash('wrong');
      } else Sound.play('wrong');
      renderRound();
      renderScorebar();
      /* The question now belongs to the other team, so the room is asked again —
         a scoped round would otherwise still be entitled to the team that missed. */
      askPhones(mCurrent.q.prompt, 'millionaire');
      return true;
    }
    if(document.getElementById('play-millionaire').classList.contains('lit')){
      Sound.play('klaxon'); mFlash('wrong');
    } else Sound.play('wrong');
    Sound.bedStop();
    document.getElementById('m-hint').textContent = 'No points — same rung next time round.';
    mEndQuestion();
    return true;
  }

  /* ---- lifelines ---- */
  function useLifeline(kind){
    const st = mTeamState(active);
    if(!mCurrent || mAnswered || !st.lifelines[kind]) return;
    st.lifelines[kind] = false;
    /* Reaching for a lifeline is reconsidering, so it throws away the nomination —
       which also means 50:50 can never remove the option that is currently locked on. */
    mPicked = null;

    if(kind === 'fifty'){
      /* Two wrong options out of play. `hidden` is the round's — "narrow the
         choice" is a generic hint mechanic rather than a Millionaire feature — so
         they stay on screen struck through and leave the handsets entirely. */
      if(roundState){
        const wrong = roundState.options.filter(o => o !== roundState.answer);
        roundState.hidden = shuffle(wrong.slice()).slice(0, 2);
        renderRound();
        if(buzzHost) askPhones(mCurrent.q.prompt, 'millionaire');
      }
      Sound.play('reveal');
    } else if(kind === 'class'){
      /* **The class has already voted.** The round asks the room on every question,
         so this no longer borrows the phones and runs a second vote against them —
         which was two dynamics arming one handset, the bug this project has already
         paid for. It reveals the counts the round is holding, which is what makes
         it still worth spending rather than free.

         With no relay there is nothing to reveal, so the button is not offered —
         see `renderMillionaire`. That is a real loss against the old hands-in-the-air
         tally, and the honest trade for the round owning the room. */
      mTally = true;
      Sound.play('reveal');
      renderMillionaire();
    } else if(kind === 'confer'){
      timerSetDuration(Number(S.get('mConferSeconds', 'millionaire')) || 30);
      timerReset(); timerStart();
    }
    renderMillionaire();
  }

  document.querySelectorAll('#m-lifelines .lifeline').forEach(btn=>{
    btn.addEventListener('click', ()=>useLifeline(btn.dataset.life));
  });
  document.getElementById('m-final').addEventListener('click', roundCommit);
  document.getElementById('m-next').addEventListener('click', ()=>{
    timerStop();
    active = Kit.passTurn(teams.length, active);
    renderScorebar();
    nextMillionaireQuestion();
  });
  /* Done counting stops the *counting*, and deliberately keeps the numbers: they
     are what the team is deciding on. Clearing them was the other half of the
     dead end — the only way out of tally mode also threw away the vote. */
  document.getElementById('m-done-count').addEventListener('click', ()=>{
    const wasVoting = mVoting;
    mCounting = false;
    mVoting   = false;
    /* Give the phones back. Without this the room stays on the four options for the
       rest of the question, so a class set to buzz for the floor lost the buzzer the
       moment a lifeline was used — the borrowing has to end as explicitly as it
       started. `askPhones` re-arms whatever the mode is, including disarming when
       it is off. */
    if(wasVoting && mCurrent && !mAnswered) askPhones(currentPhonePrompt(), 'millionaire');
    renderMillionaire();
  });

  /* ================= PHONE BUZZERS =================
     Optional layer. Students join on their phones and buzz for the right to answer;
     the buzz says which team, so a correct word can be scored without the teacher
     deciding who was first. Everything degrades: no relay, no room, no change —
     the manual "who touched it first?" chooser is still there underneath. */
  let buzzHost = null;      // the room, while one is open
  let buzzWinner = null;    // {id,name,team} — who has the floor right now
  let buzzPlayers = 0;
  let buzzLanHost = '';     // address the relay says phones can reach it on
  let buzzEpoch = null;     // which *instance* of the room the relay reports

  /* The room that came back is not the room this page was talking to. Rooms live
     in the relay's memory and the deployed relay restarts on every push — so a
     reconnecting host recreates its room *empty*, under the same code, and every
     `ready` after that looks exactly like an ordinary reconnect. The hub keeps
     several memories of what it has already told the room precisely so a
     reconnect stays quiet; against a new room, every one of them is a lie, and
     the question was never re-armed — so a phone that rejoined landed on
     "Waiting for the teacher" over a board showing a live round. Void the lot,
     and the ready handler's own re-ask and team push then say everything again. */
  function roomForgot(){
    lastAsk = null;          // the room has been told no question
    lastPushedTeams = null;  // ...and no team names
    buzzWinner = null;       // the relay's lock died with the room
    classReplies = null;     // so did every collected reply
    /* **The solo seats need no clearing here any more, and that is the point.**
       A recreated room re-registers each phone with its page-load team — 0 for a
       bench rack — and this used to have to void a map of what each phone had
       last been told, or the new room was never told the seats at all and every
       answer arrived as competitor 0's ("Ana has it" whoever answered, after a
       deploy restarted the relay under a solo rack). `seatSoloPlayers` compares
       against the room's own record now, so those phones simply disagree with
       their seats and are re-sent on the next roster event, with nothing here
       having to remember. `soloSeat` — who owns which row — is the host's own
       record and was never the problem. */
    /* Whatever the active game told the room died with it too — Bingo's dealt
       cards and their marks are the worked example. The game declares the
       re-telling (`onRoomForgot`), because only it knows what it had said. */
    hook('onRoomForgot');
  }

  function buzzersOn(){ return S.get('buzzers') && window.HubBuzzer; }

  // What students should type in. localhost is right for this machine but useless
  // to a phone, so show the LAN address the relay reported instead.
  function joinAddress(){
    try{
      const u = new URL('join.html', location.href);
      let host = u.host;
      if(/^(localhost|127\.0\.0\.1)/.test(host) && buzzLanHost) host = buzzLanHost;
      return host + u.pathname;
    }catch(e){ return 'join.html'; }
  }

  /* The full join URL, code included, so a scan lands a student on the name screen
     with nothing left to type. Built from the same address the chip shows, which is
     the relay's own origin — the one address phones can actually reach. */
  function joinURL(){
    try{
      const u = new URL('join.html', location.href);
      if(/^(localhost|127\.0\.0\.1)/.test(u.host) && buzzLanHost) u.host = buzzLanHost;
      if(buzzHost) u.searchParams.set('code', buzzHost.code);
      return u.toString();
    }catch(e){ return 'join.html'; }
  }

  /* Draw the QR into the lobby. The encoder is vendored (hub-qr.js) rather than
     fetched, because this has to work with no internet at all. Error correction 'M'
     and an auto type number: a classroom projector is a forgiving scanning target,
     but a phone at the back of the room is not. */
  function renderJoinQR(){
    const box = document.getElementById('join-qr');
    if(!box) return;
    box.innerHTML = '';
    const make = window.qrcode;
    if(typeof make !== 'function'){ box.textContent = ''; return; }   // no encoder, code still shown
    try{
      const q = make(0, 'M');
      q.addData(joinURL());
      q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    }catch(e){ box.textContent = ''; }
  }

  function showJoinPanel(){
    if(!buzzHost) return;
    document.getElementById('join-code').textContent = buzzHost.code;
    document.getElementById('join-url').textContent  = joinAddress();
    renderJoinQR();
    renderJoinCount();
    document.getElementById('join-modal').classList.add('on');
  }
  function hideJoinPanel(){ document.getElementById('join-modal').classList.remove('on'); }
  function joinPanelOpen(){ return document.getElementById('join-modal').classList.contains('on'); }
  function renderJoinCount(){
    const el = document.getElementById('join-count');
    if(el) el.textContent = buzzPlayers + (buzzPlayers === 1 ? ' phone joined' : ' phones joined');
    renderJoinRoster();
  }

  /* Every joined phone, in its team's colour, each with a remove control. Kicking
     asks the relay; the relay tells the phone (so a live one kicked by mistake
     says what happened and can rejoin in two taps), drops it, and the 'leave'
     that comes back is what heals the room — shares recompute and the replies in
     hand are re-read, both already wired to the roster changing. No confirm
     dialog: the teacher is mid-lesson, and the cost of a mis-tap is a student
     rejoining, not losing work. */
  function renderJoinRoster(){
    const box = document.getElementById('join-roster');
    if(!box) return;
    box.innerHTML = '';
    if(!buzzHost) return;
    buzzHost.players().forEach(p=>{
      const row = document.createElement('span');
      row.className = 'join-player';
      row.style.setProperty('--team', HubBuzzer.teamColour(p.team));
      const nm = document.createElement('b');
      nm.textContent = p.name;
      const off = document.createElement('button');
      off.type = 'button'; off.textContent = '×';
      off.title = 'Remove this phone from the game';
      off.addEventListener('click', ()=> buzzHost && buzzHost.kick(p.id));
      row.appendChild(nm); row.appendChild(off);
      box.appendChild(row);
    });
  }

  /* The chip is *in* the layout above the board, exactly like the replies panel —
     and it changes height on its own schedule. Opening a room is asynchronous, so it
     appears *after* the board has been fitted; then it grows again as phones join, as
     buzzers go live, as a typed answer arrives. Nothing re-fitted, so the board kept
     the height it had when the chip wasn't there and everything below was pushed off
     the bottom of the screen — Millionaire's "Final answer?" and the last rung of the
     ladder, with `body.play-fit` hiding the overflow so you couldn't even scroll to
     them. Measure around the redraw and re-fit only when the height actually moved;
     most renders change text alone and must not cost a reflow of every board. */
  function renderBuzzChip(state){
    const chip = document.getElementById('buzzer-chip');
    if(!chip) return;
    const before = chip.getBoundingClientRect().height;
    drawBuzzChip(chip, state);
    if(Math.abs(chip.getBoundingClientRect().height - before) > 0.5) hook('onResize');
    // the two are one instrument: the chip says which room, the strip says what the
    // room is doing, and every caller wants both current
    renderPhoneBar();
  }

  /* The chip is the room's identity and nothing else: how to join, the code, how
     many are in, whether the buzzers are live. It used to swap all of that out for
     whoever had just buzzed — so the moment a student got in, the class still
     joining lost the address off the screen. Who did what now has its own strip
     underneath (`renderPhoneBar`), which is the same strip in every game. */
  function drawBuzzChip(chip, state){
    if(!buzzHost){ chip.style.display='none'; return; }
    chip.style.display='flex';
    chip.className = state==='won' ? 'won' : (state==='armed' || state==='asking' ? 'armed' : '');
    chip.innerHTML='';
    const add=(cls,txt)=>{ const s=document.createElement('span'); s.className=cls; s.textContent=txt; chip.appendChild(s); };
    // the join address, so it can be read off the screen instead of the terminal
    add('buzz-join', joinAddress());
    add('buzz-code', 'code ' + buzzHost.code);
    /* The room outlives the game, so it is on screen in games that do not use it.
       Say so, rather than leaving a live-looking code above an idle class. And say
       *how* idle: in Millionaire the phones still vote when Ask the class is used,
       so "idle here" would read as "don't bother joining" to a room that is about
       to be asked something. */
    if(activeGame && defaultMode(activeGame) === 'off')
      add('buzz-idle', hook('roomNote') || (classVotes() ? 'votes only' : 'idle here'));
    add('buzz-scan', 'show QR');
    add('buzz-count', buzzPlayers + (buzzPlayers===1 ? ' phone' : ' phones'));
    if(state==='armed') add('buzz-live', 'buzzers live');
    // while the class is answering, the count is the thing the teacher watches
    if(state==='asking' && classReplies){
      add('buzz-live', classReplies.total + ' of ' + (classReplies.of || buzzPlayers) + ' in');
    }
  }

  /* ---- one strip for everything the class does ----
     Where a student's name appears used to depend on the game *and* the mode: a buzz
     went on the chip, typed answers went into the clue card in Jeopardy, under the
     sentence in Race, under the question in Millionaire — four layouts for one idea,
     and three of them moved the board as they filled.

     So it is one bar, in one place, in every game. Two rules make it work:
       · **Fixed height.** It is as tall when empty as when full, so what the class
         does can never resize the board underneath. A full class scrolls sideways
         rather than growing downwards.
       · **It outlives the question.** A word claimed in Race re-arms the phones
         within a frame, so anything shown only while the buzz was live was gone
         before the room could read it — which is exactly the "it just moved on with
         no indication who got it" problem. What it says stands until the next thing
         happens. */
  let lastScored = null;    // {name, team, value, points} — who took the last question
  function notePhoneScore(name, team, value, points){
    lastScored = { name, team, value, points };
    renderPhoneBar();
  }
  /* A miss is the most useful thing on the strip — who is nearly there, and how.
     `lastTyped` is what the typing race already uses for exactly this, so a tapped
     wrong word reads the same way rather than inventing a second shape. */
  function notePhoneMiss(name, team, value, verdict){
    lastTyped = { name, team, value, verdict:(verdict === 'close' ? 'close' : 'wrong') };
    renderPhoneBar();
  }

  function renderPhoneBar(){
    const bar = document.getElementById('phone-bar');
    if(!bar) return;
    const before = bar.getBoundingClientRect().height;
    drawPhoneBar(bar);
    // the strip is fixed-height by design, so this should never fire — it is here
    // for the one case that does change it: the room opening or closing
    if(Math.abs(bar.getBoundingClientRect().height - before) > 0.5) hook('onResize');
  }

  function drawPhoneBar(bar){
    if(!buzzHost){ bar.style.display='none'; bar.innerHTML=''; return; }
    bar.style.display='flex';
    bar.innerHTML='';
    const add=(cls,txt)=>{ const s=document.createElement('span'); s.className=cls; s.textContent=txt; bar.appendChild(s); return s; };
    const teamChip = i => { const s = add('pb-team team-'+Math.min(i,3), teamName(i)); return s; };

    /* Two voices, and they were one function until the commentary arrived. The
       *headline* is whatever loudest thing is true right now, and it early-returns
       out of five branches, which is right — only one of them can be the headline.
       The cooling chips are not a sixth branch: they are true *alongside* whichever
       won, so they are appended after it rather than competing with it. */
    bar.className = phoneBarHeadline(add, teamChip);
    drawCooling(add);
  }

  function phoneBarHeadline(add, teamChip){
    // 1. somebody has the floor — the loudest thing that can be true
    if(buzzWinner){
      add('pb-name', buzzWinner.name);
      teamChip(buzzWinner.team);
      if(buzzWinner.value != null) add('pb-typed', '\u201C' + buzzWinner.value + '\u201D');
      add('pb-note', buzzWinner.value != null ? 'got it' : 'buzzed in');
      return 'won';
    }
    // 2. the last question was taken by a phone — said plainly, and it stays said
    if(lastScored){
      add('pb-name', lastScored.name);
      teamChip(lastScored.team);
      if(lastScored.value) add('pb-typed', '\u201C' + lastScored.value + '\u201D');
      add('pb-points', '+' + lastScored.points);
      return 'scored';
    }
    // 3. a miss: who is nearly there, and how, is the most useful thing on screen
    if(lastTyped){
      add('pb-name', lastTyped.name);
      add('pb-typed', '\u201C' + lastTyped.value + '\u201D');
      add('pb-verdict', lastTyped.verdict === 'close' ? 'check the spelling' : 'not yet');
      return 'missed';
    }
    // 4. the whole room answering — the count, then what they wrote
    if(classReplies && classReplies.all.length){
      add('pb-count', classReplies.total + ' of ' + (classReplies.of || buzzPlayers || '?'));
      classReplies.all.forEach(r=>{
        const chip = add('pb-reply team-' + Math.min(r.team, 3), r.name + ': ' + r.value);
        chip.title = teamName(r.team);
      });
      return 'replies';
    }
    // 5. nothing yet — but the strip still holds its height, so the board never moves
    add('pb-idle', phoneBarHint());
    return 'idle';
  }

  /* Who is still cooling, soonest free first, with the seconds the room should read.
     **Filtered against the live roster**, because a phone kicked mid-penalty leaves
     the room and its chip has to go with it — the same rule a held reply already
     follows. Expired entries are dropped as they are found, so the map cannot outlive
     its own deadlines even before `roundOpen` empties it. */
  function coolingNow(){
    const now  = Date.now();
    const here = new Set(((buzzHost && buzzHost.players()) || []).map(p => String(p.id)));
    const live = [];
    Object.keys(sendCooling).forEach(id=>{
      const c = sendCooling[id];
      if(c.until <= now){ delete sendCooling[id]; return; }
      if(!here.has(String(id))) return;
      live.push({ name:c.name, team:c.team, left: Math.ceil((c.until - now) / 1000) });
    });
    return live.sort((a,b)=> a.left - b.left);
  }

  /* Self-stopping by construction: every tick disarms itself and re-renders, and the
     render arms it again only while a chip is still live. So a finished countdown
     costs nothing, and there is no second place holding an interval that a question
     ending, a game changing or a room closing would each have to remember to clear. */
  let coolTicker = null;
  function coolTick(){
    if(coolTicker) return;
    coolTicker = setInterval(()=>{
      clearInterval(coolTicker); coolTicker = null;
      renderPhoneBar();
    }, 500);
  }

  function drawCooling(add){
    const live = coolingNow();
    if(!live.length) return;
    live.forEach(c=>{
      /* The team class rides along so the chip keeps the shape a reply chip has, but
         the paint is amber and stays amber: what this says is *waiting*, and it is
         solo-only by construction, where there are no sides for a colour to name. */
      const chip = add('pb-cooling team-' + Math.min(c.team, 3),
                       c.name + ' · wait ' + c.left + 's');
      chip.title = c.name + ' sent a wrong answer — waiting ' + c.left + 's';
    });
    coolTick();
  }

  function phoneBarHint(){
    if(!activeGame) return 'Waiting for the class';
    if(voteLive())  return 'The class is voting';
    /* A game driving its own round outranks the mode here, exactly as it does at
       the arming end — it supplies the mode rather than a second answer, so there is
       still one map. Without it a grouping clue said "Phones are idle here" over a
       room that had just been handed eight words, with the chip beside it saying the
       opposite. */
    const own  = hook('phoneRound');
    const mode = own ? own.mode : defaultMode(activeGame);
    return mode === 'buzz'  ? 'Waiting for a buzz'
         : mode === 'type'  ? 'Waiting for someone to type it'
         : mode === 'write' ? 'Waiting for the class to answer'
         : mode === 'vote'  ? 'The class is choosing'
         : mode === 'card'  ? 'Waiting for the class'
         : 'Phones are idle here';
  }

  /* "not reachable" on its own sends you hunting. Nearly always the cause is the
     page itself — the GitHub Pages copy has no relay behind it — so say which
     problem this is rather than that there is one. */
  function buzzerProblem(){
    const relay = (S.get('buzzerRelay')||'').trim();
    if(relay) return 'no relay answering at ' + relay;
    if(location.protocol === 'file:')
      return 'opened as a file — run: node tools/buzzer-relay.js, then open the address it prints';
    if(/(^|\.)github\.io$/i.test(location.hostname))
      return 'this is the GitHub Pages copy, which has no relay behind it — open the hosted copy instead, or set a Relay address in the settings panel';
    return 'no relay at ' + location.host + ' — is node tools/buzzer-relay.js running?';
  }

  /* Which games want a phone room is now a question of what is switched on, not a
     hard-coded "race only". Asked on every game start, so turning a prototype on
     mid-lesson takes effect at the next round rather than needing a reload. */
  /* The mode decides, in every game. Race head-to-head used to open a room and arm
     buzzers whatever the setting said — a leftover from when buzzers were a
     Race-only feature — which made "Nothing — phones idle" a lie in the one game
     phones were actually used in, and made every other mode unreachable there.
     One rule now: off means no room.

     With one exception, and it is the reason voting stopped being a mode: Ask the
     class votes on the phones whenever there are phones, so Millionaire wants a
     room even at `off`. "Nothing during a question" is still honest there — the
     phones sit idle until a lifeline is used — but a room that only opens once
     somebody presses the lifeline is a room nobody has joined yet, and a class
     cannot scan, type a code and pick a team while the question is on screen. */
  /* A room whenever the feature is on, in every game — which is a reversal, and a
     deliberate one. "Off means no room" was written to keep "Nothing — phones idle"
     honest, but it made the join address disappear entirely, and a class cannot
     join a room that does not exist yet. It also read as a *game* being different
     from the others when it was only configured differently: the same report came
     in twice, once for Bingo and once for Jeopardy, both times as "the code line is
     missing here".

     The two facts were being conflated. **Whether a room exists** is a property of
     the lesson — the teacher wants phones today. **What the phones do during a
     question** is the mode, and `off` is a perfectly good answer to that: the chip
     says `idle here`, so nothing pretends otherwise. Exceptions had already been
     carved out for Millionaire's lifelines and Bingo's cards; this makes the rule
     the exception's shape rather than the other way round. */
  /* **A room exists whenever phones are switched on, game or no game.** It used to
     need `activeGame`, so the code only appeared once a board was already running —
     which is the moment it stops being useful. The whole of setup is when a class is
     walking in and getting their phones out, and they cannot join a room that does
     not exist yet. Same reversal this file already made once for `phoneMode: off`,
     and for the same reason: *whether a room exists* is a property of the lesson,
     and *what the phones do in a question* is a property of the game. Conflating
     them is what hid the code both times. */
  function phonesWanted(){ return !!S.get('buzzers'); }
  /* Both votes are worth a room even when nothing else on the board wants one:
     Millionaire's Ask the class, and Blockbusters asking the team on turn which
     hexagon to attack. */
  function classVotes(){ return !!hook('wantsVote'); }
  /* ---- one room per lesson ----
     A room used to be torn down with the game, because that is where its code
     happened to be created — so changing games minted a new 5-digit code and the
     whole class had to rejoin, rescan and retype their names. A lesson is two or
     three games; the room outlives all of them.

     So there are two different things, and only one of them is "close":
       park  — nothing for the phones in *this* game. Disarm, keep the room, keep
               everyone joined; their screens say the teacher is between questions.
       drop  — the buzzer feature itself is off, or the relay is being changed.
               Only then does the code go. */
  function syncBuzzRoom(){
    if(!phonesWanted()){ parkBuzzRoom(); return; }
    // an existing room is reused, so ask it for whatever this game has already
    // dealt — Millionaire deals its first question inside start()
    if(buzzHost) reaskPhones(); else openBuzzRoom();
    /* The chip has to be redrawn on *both* routes, not only when parking. What it
       says depends on the game — `idle here`, `votes only`, or nothing — and the
       game has only just changed. It used to be right by accident: every game with
       the mode off went through parkBuzzRoom, which redraws. Now that a room can
       outlive the mode, Blockbusters and Millionaire take the other route and the
       chip kept whatever the previous game had made it say. */
    renderBuzzChip();
    renderBBVote();
  }

  function parkBuzzRoom(){
    hideJoinPanel();
    clearReplies();
    buzzWinner = null; lastTyped = null; lastScored = null; lastAsk = null;
    if(buzzHost) buzzHost.disarm();
    renderBuzzChip();
    renderBBVote();
  }

  /* The code outlives the *page*, not just the game. Reloading the hub — which is
     the standard fix for a stale shell, and the first thing anyone does when
     something looks wrong — would otherwise mint a new code and throw the class
     out mid-lesson. Remembered per device with the relay it belongs to, and only
     for as long as a lesson could plausibly run. */
  const ROOM_KEY = 'engishism.gamehub.room';
  const ROOM_TTL = 6 * 60 * 60 * 1000;
  /* **A board opened inside the room bench takes no part in that memory**, and
     without this the bench quietly steals a live lesson's room. The memory is per
     *device*, so a bench board — same origin, same storage — read the code the
     teaching hub had stored and connected to the very same room. The relay allows
     one host and the newest wins, so the real board was replaced on its own room
     while its chip went on showing the code. Confirmed: hub on 80873, bench on
     80873.

     A rig is not a lesson. The bench's board mints its own code every time and
     stores nothing, so the two are independent and can be open side by side — which
     is the whole point of having a bench. `bench=1` is the flag the bench already
     passed for its own reasons; it means exactly this. */
  const BENCHED = /[?&]bench=1\b/.test(location.search);
  function rememberedRoom(relay){
    if(BENCHED) return null;
    try{
      const r = JSON.parse(window.localStorage.getItem(ROOM_KEY) || 'null');
      if(!r || r.relay !== relay || !/^\d{4,6}$/.test(String(r.code))) return null;
      return (Date.now() - r.at < ROOM_TTL) ? String(r.code) : null;
    }catch(e){ return null; }
  }
  function rememberRoom(code, relay){
    if(BENCHED) return;
    try{ window.localStorage.setItem(ROOM_KEY, JSON.stringify({ code, relay, at:Date.now() })); }
    catch(e){}
  }
  function forgetRoom(){ try{ window.localStorage.removeItem(ROOM_KEY); }catch(e){} }

  /* **Opening a room retries, because the common failure is a relay that is merely
     asleep.** This was one attempt, and a hosted relay on a free plan spins down
     when idle and takes the better part of a minute to wake — so the first load of
     a lesson failed, the chip settled on "no relay", and nothing tried again for
     the rest of the hour. The class cannot join a room that was never opened, and
     nothing on screen said it was worth waiting.

     Backed off rather than hammered, and it says `Connecting…` while it is trying:
     a room that is about to exist and one that never will are different facts. */
  let buzzTries = 0;
  const BUZZ_WAITS = [1500, 3000, 5000, 8000, 12000, 15000, 15000, 15000];
  function retryBuzzRoom(){
    const wait = BUZZ_WAITS[buzzTries++];
    const chip = document.getElementById('buzzer-chip');
    if(chip){
      chip.style.display = 'flex'; chip.className = 'off';
      chip.textContent = wait == null ? buzzerProblem() : 'Connecting…';
    }
    if(wait == null) return;
    // re-checked on the way in: the teacher may have switched phones off meanwhile
    setTimeout(()=>{ if(buzzersOn() && !buzzHost) openBuzzRoom(); }, wait);
  }

  function openBuzzRoom(){
    if(!buzzersOn() || buzzHost) return;
    const relay = S.get('buzzerRelay') || '';
    /* Still asks the relay for a code even when reusing one: the reply also carries
       the LAN address the join link needs, and an unclaimed code costs nothing —
       a room only exists once a host connects to it. */
    HubBuzzer.newCode(relay).then(info=>{
      const code = (info && info.code) ? (rememberedRoom(relay) || info.code) : null;
      buzzLanHost = (info && info.lan) || '';
      // no relay answered — say so, and keep trying, because it may only be waking
      if(!code){ retryBuzzRoom(); return; }
      buzzTries = 0;
      rememberRoom(code, relay);
      buzzHost = HubBuzzer.host({ relay, code });
      /* The room this page is hosting, stated rather than scraped — the same
         convention the playground pages use, so anything looking in from outside
         (the phone bench, a test) asks one question of any board: what room are
         you running? Without it the only handle was the chip's text, which is
         prose and changes with the mode. */
      window.HubHost = buzzHost;
      buzzHost.on('ready',   d=>{ if(d.epoch && buzzEpoch && d.epoch !== buzzEpoch) roomForgot();
                                  if(d.epoch) buzzEpoch = d.epoch;
                                  buzzPlayers=(d.players||[]).length; pushTeamNames();
                                  renderBuzzChip(); renderJoinCount(); reaskPhones();
                                  /* The room arrives after the board is built, so
                                     anything a game paints from the room has to be
                                     painted here — Bingo's dealt cards, Millionaire's
                                     Ask-the-class button, Blockbusters' vote button
                                     all shipped that bug once each, by name. The
                                     game declares it now. */
                                  hook('onRoomReady'); });
      /* **Which side a student is on, recorded from the one event that can only be
         their own choice.** See `rememberSides` for why nothing else will do. */
      buzzHost.on('join', p=> rememberSides(p));
      buzzHost.on('players', list=>{ buzzPlayers=list.length;
                                     /* First, because everything below is judged
                                        against the roster and in a solo room this
                                        is what the roster *is*. */
                                     seatSoloPlayers(list);
                                     renderBuzzChip(); renderJoinCount();
                                     // a game holding per-player state hears every
                                     // roster push — a latecomer gets a bingo card
                                     hook('onPlayers', list);
                                     /* …and a team that just grew or shrank gets a
                                        new share of the group. Pushed, never
                                        re-armed: a latecomer must not wipe what the
                                        rest of their team had already agreed on. */
                                     roundPushShares(); renderRound();
                                     /* …and what the replies already in hand *mean*
                                        has changed with it. A round that waits for a
                                        whole team is judged against the roster, so a
                                        team of three sitting at 2 becomes unanimous
                                        the moment the third phone drops off — and
                                        nothing else would ever tell it, because a
                                        leaver sends no reply. A student whose phone
                                        dies must not be able to freeze their team. */
                                     reReadReplies(); });
      buzzHost.on('buzz',    onBuzz);
      buzzHost.on('response', onResponse);
      renderBuzzChip();
    /* A rejected request, not merely a null code — an unreachable relay throws
       rather than answering, and without this the failure was unhandled and the
       chip kept whatever it had said before. */
    }).catch(retryBuzzRoom);
  }

  function dropBuzzRoom(){
    hideJoinPanel();
    forgetRoom();
    if(buzzHost){ buzzHost.close(); buzzHost=null; window.HubHost = null; }
    buzzEpoch=null;
    buzzWinner=null; buzzPlayers=0; lastTyped=null; lastScored=null;
    bbVote=null; bbVoting=false; renderBBVote();
    const chip=document.getElementById('buzzer-chip');
    if(chip) chip.style.display='none';
  }

  /* Switching the feature off, or pointing it at a different relay, is the one
     thing that genuinely ends a room — everything else parks it. */
  S.onChange(id=>{
    if(id !== 'buzzers' && id !== 'buzzerRelay') return;
    dropBuzzRoom();
    syncBuzzRoom();
  });

  /* Changing what the phones do is exactly the thing the Lab exists for, so it has
     to take effect on this question rather than the next game. Never a drop: the
     room is the lesson's, and switching a dynamic must not make thirty people
     rejoin. `syncBuzzRoom` opens, re-asks or parks as the new value requires —
     including opening one for Ask the class when the mode itself is off. */
  S.onChange(id=>{
    if(id !== 'round_default' && id !== 'mLifelines' && id !== 'bbTeamVote') return;
    syncBuzzRoom();
    renderBBVote();
  });

  /* ---------- individual play: the roster is whoever has joined ----------
     In team play a teacher fills the roster with the + Player button and a student
     picks which side they are on. In individual play neither of those is a question
     anybody can answer: a person *is* a competitor, so the roster is the room.

     **Keyed by player id, mapped to the competitor's id, and never to an index.**
     Both ends of that would be wrong as an index: a phone reconnects under the same
     player id, which is what makes a seat survive a dropped connection, and a
     competitor's index shifts the moment one above it is removed — which is exactly
     the bug that paid a Drag the Letters win to a team that no longer existed.

     **A phone that leaves keeps its seat.** A student whose battery dies has still
     played, and their score is a lesson's work; binning a competitor because a
     handset went quiet would be the same mistake the team bar's confirm exists to
     stop. They come back to the same slot. */
  /* Keyed by player id and holding a competitor **id**, so nothing in it shifts when
     a row is removed. The map that used to sit beside it held an *index* — what each
     phone was last told — and every way that could go stale was a separate bug; it is
     gone, and `seatSoloPlayers` asks the room instead. */
  const soloSeat = Object.create(null);   // playerId -> competitor id

  /* **The other direction, which the roster did not have: a competitor who has gone.**
     The rule above — a phone that leaves keeps its seat — was written for a student
     whose battery dies mid-lesson, and it is right for exactly that. Applied to
     *every* departure it made the roster a one-way ratchet: seven phones on the room
     bench, then five removed, and the board still listed everybody. The bench cannot
     mirror a room it can only add to.

     **What the original rule was actually protecting is a score**, and that is what
     this keeps: a competitor holding points stays whatever their handset does, and
     their seat stays with them so they come back to the same row. One who never
     scored is not a lesson's work, it is clutter, and it goes with the phone.

     Never below the floor, because a board with nothing on it is not a state worth
     reaching — the two placeholders are where an empty room starts and where it
     returns to. */
  function dropDepartedSolo(list){
    if(!Roster.solo()) return false;
    /* **Never while a question is open.** Dropping a competitor closes the gap in
       `teams`, so every index above it moves — and a live round's per-team state is
       keyed by index: the ladders, the picks, the agreement counts, who took the
       slot, the arrival record. A phone that dies mid-question would hand its ladder
       to whoever sat below it. *Scores are safe either way* — they ride the
       competitor object and move with it, and a competitor holding points is never
       dropped at all — but the round's own state does not, and there is no reason it
       should have to: a student mid-question is not clutter. The tidy-up happens
       when the question ends, which is the moment the state it would scramble stops
       existing. `mState.length = 0` below is the same problem solved bluntly for
       Millionaire's ladders; this is why nothing else needs that treatment. */
    if(roundLive()) return false;
    const here = Object.create(null);
    (list || []).forEach(p=>{ if(p && p.id) here[p.id] = true; });
    let dropped = false;
    Object.keys(soloSeat).forEach(pid=>{
      if(here[pid] || teams.length <= Roster.floor()) return;
      const comp = Roster.byId(soloSeat[pid]);
      if(comp && comp.score !== 0) return;      // played and scored: the row is theirs
      const i = comp ? teams.indexOf(comp) : -1;
      if(i >= 0){ teams.splice(i, 1); dropped = true; }
      delete soloSeat[pid];
    });
    if(dropped){
      /* Every seat above the hole has moved. That used to need a second map voided
         here — what each phone was last told was now a lie about all of them — and
         it is structural instead: the shifted phones disagree with their new index
         and `seatSoloPlayers` re-sends them on the next roster event. */
      if(Array.isArray(mState)) mState.length = 0;
      if(active >= teams.length) active = Math.max(0, teams.length - 1);
    }
    return dropped;
  }

  function seatSoloPlayers(list){
    if(!Roster.solo() || !buzzHost) return;
    let changed = dropDepartedSolo(list);
    (list || []).forEach(p=>{
      if(!p || !p.id) return;
      let comp = soloSeat[p.id] ? Roster.byId(soloSeat[p.id]) : null;
      if(!comp){
        /* An unclaimed placeholder first — the two the app starts with. Otherwise a
           room of six reads "Team 1 · Team 2 · Ana · Ben · Cara · Dan", with two
           empty rows nobody put there. Unclaimed means auto-named, unscored and not
           already somebody's seat. */
        const taken = Object.keys(soloSeat).map(k => soloSeat[k]);
        comp = teams.find(t => t.auto && !t.score && taken.indexOf(t.id) === -1);
        if(!comp){ Roster.add(p.name); comp = teams[teams.length - 1]; }
        comp.name = p.name || comp.name;
        comp.auto = false;
        soloSeat[p.id] = comp.id;
        changed = true;
      }
      const at = teams.indexOf(comp);
      /* **Seat whenever the room disagrees with the seat, and keep no memory of
         what was sent.** This used to compare against a `soloSeatAt` map —
         playerId → the index last POSTed — because `seat` did not come back to the
         host and `p.team` was therefore always the join-time value, so comparing
         against it would have re-POSTed forever. `HubBuzzer.seat` writes the new
         value into the host's own copy now, which is what makes this terminate:
         one pass, then the two agree.

         **The map had to go rather than gain a fourth invalidation point.** Every
         way its record could stop being true was a separate bug — a relay restart
         (the room forgets, the phones rejoin on their page-load team), a competitor
         dropped (every index above the hole moves), a roster swap — and each was
         fixed by remembering to clear it somewhere. The one that survived all of
         that was a race: sixteen phones joining at once fire sixteen roster pushes,
         each replacing the host's list wholesale, and any phone whose seat had not
         yet reached the relay came back on team 0 with the local write discarded.
         The map then said "already seated", so it was never re-sent, and with no
         further roster event it stayed wrong all lesson — one student capped at
         half the answer and unable to finish. Reported twice.

         Comparing against what the room actually believes needs no invalidation at
         all: after a restart, a drop or a swap the phones simply disagree, and the
         next roster event puts them right. */
      if(at >= 0 && Number(p.team) !== at) buzzHost.seat(p.id, at);
    });
    if(changed){ renderScorebar(); renderRosterPick(); hook('onRoster'); }
  }

  /* The other half of the swap: put every handset back on the side its student
     chose, once, on the way back from solo.

     **Once, not continuously**, and that is the whole design. In teams mode the
     student owns which side they are on — they pick it when they join and may change
     it from their own phone — so a host that re-asserted a team on every roster event
     would quietly overrule them. This fires on the transition and clears its own
     flag. A player nobody remembers (they joined during solo) lands on team 0, which
     is where a new phone lands anyway. */
  /* **Recorded from the join, and from nothing else — which took three attempts.**
     A student's side is a fact about *them*: they pick it on the join screen, and
     going to solo and back has to be able to put them there again.

     Attempt one read every player's current team off the relay whenever the roster
     mode changed. That is the value **solo has just overwritten**, so the first round
     trip worked and the next recorded the solo seats as if they were the students'
     choices — four phones flipped teams → solo → teams → solo → teams and collapsed
     onto Team 1, which is exactly the "flip back and forth and they all turn blue"
     report.

     Attempt two recorded the first sighting in the roster and never rewrote it. Also
     wrong, and it failed identically: a join is processed in more than one step, so
     the first roster event a new phone appears in can still carry team 0 — and being
     write-once, that zero was permanent.

     What both attempts shared is re-deriving a choice from a list the **host itself
     writes to**. The relay names the joining player on its own event, with the team
     that handset sent, and nothing the host does produces one of those. So this is
     driven by `join` and overwrites freely: a student changing side goes through
     "Not you?", which rejoins, which is another join. Skipped in solo, where a
     competitor index means something else entirely. */
  /* **Still the student's own choice, not a seat the host wrote** — the question a
     reader will have now that `seat` updates the host's copy. Guarded on `!solo`, and
     seats are only ever sent in a room of individuals or on the way back into teams,
     so on the way *out* of teams nothing has overwritten `p.team`: it is the side the
     student picked when they joined, which is exactly what this has to remember. */
  function rememberSides(p){
    if(Roster.solo() || !p || !p.id) return;
    teamSeat[p.id] = Number(p.team) || 0;
  }

  function seatTeamPlayers(list){
    if(!reseatTeams || Roster.solo() || !buzzHost) return;
    reseatTeams = false;
    (list || []).forEach(p=>{
      if(!p || !p.id) return;
      const want = Math.min(teamSeat[p.id] || 0, Math.max(0, teams.length - 1));
      /* **Sent unconditionally, and it stays that way — but the original reason is
         no longer the reason.** The first version compared against `p.team` and sent
         only on a difference, which concluded every phone was already right and sent
         nothing while every phone sat on its solo index. That was because `seat` did
         not come back to the host, so `p.team` was the value from the last *join*.

         `HubBuzzer.seat` keeps the host's copy current now (see the note there, and
         the cache table in CLAUDE.md), so `p.team` here *is* trustworthy and the
         comparison would work. It is still not worth making: this runs **once per
         switch**, so a handful of extra posts costs nothing, and a conditional send
         would buy that nothing in exchange for depending on the local copy being
         right. Unconditional is the cheaper contract. */
      buzzHost.seat(p.id, want);
    });
  }

  /* The phones need the team list, not just at the start: a team renamed mid-lesson
     or a fifth added has to reach every handset, because the name on the phone is
     how a student knows which score on the board is theirs. Called from
     renderScorebar, which is the one place that runs on any change to the teams —
     and skipped when nothing about the list actually moved, because that render
     also runs on every point scored and a POST per point is a waste of the room's
     wifi. */
  let lastPushedTeams = null;
  function pushTeamNames(){
    if(!buzzHost) return;
    const names = teams.map(t=>t.name);
    const solo = Roster.solo();
    /* The mode is part of the key: switching to individuals changes nothing about
       the names, and the join screen has to hear about it anyway. */
    const key = names.join('\u0000') + '\u0001' + solo;
    if(key === lastPushedTeams) return;
    lastPushedTeams = key;
    buzzHost.setTeams(names, solo);
  }

  /* Ask the whole class rather than racing for the floor. `mode` is 'vote' (pick
     one of the options) or 'answer' (type it). Replies arrive on onResponse.
     `team` narrows it to one side of the room — Blockbusters asks the team on turn
     which hexagon to attack — and the phones that are not entitled show the
     question with no controls rather than a button that would be discarded. */
  let classReplies = null;         // {mode, tally, all, of} while a round is open

  function askClass(prompt, mode, options, team){
    if(!buzzHost) return false;
    classReplies = { mode, tally:{}, all:[], total:0, of:buzzPlayers };
    buzzWinner = null;
    buzzHost.arm(prompt || '', { mode, options: options || [],
                                 team: (team == null ? null : Number(team)),
                                 keepSpent: !S.get('phoneOneEach', activeGame) });
    renderBuzzChip('asking');
    return true;
  }

  function onResponse(d){
    if(!d) return;
    /* A game may consume a raw reply before the shared collect-and-count path —
       a tap on a bingo card is a typed answer without the typing, judged per
       player against that player's own card, and it is nobody's team answer. */
    if(d.latest && hook('onPhoneReply', d.latest)) return;
    classReplies = { mode:(classReplies && classReplies.mode) || 'answer',
                     tally:d.tally || {}, all:d.all || [], total:d.total || 0, of:d.of || 0 };
    /* Where the numbers go is the game's business — Millionaire paints them on its
       four options, Blockbusters counts letters in a strip beside the legend. Same
       vote object, same recount, different board. */
    hook('onVoteReply', classReplies.all);
    renderReplies();
    renderBuzzChip('asking');
  }

  /* The same replies, read again. Nothing new has arrived — what changed is the room
     they are being read against, which is the roster. Separate from `onResponse`
     because there is no `latest`, no new tally and no chip to repaint: the only thing
     that can differ is what the game makes of what it already has. */
  function reReadReplies(){
    if(classReplies && (classReplies.all || []).length) hook('onVoteReply', classReplies.all);
  }

  /* One entry point for "a question just went up, ask the room". One mode is live
     at a time — that is what `phoneMode` being a variant rather than four switches
     buys — so this is a lookup, not a precedence. */
  /* What the room was last told, so a re-ask that changes nothing can stay silent.
     An `arm` is not free: it clears the relay's lock and its collected responses,
     and on the handset it resets the button. So a repeated one is visible as a
     flicker even when nothing is wrong. */
  let lastAsk = null;

  /* Which of the default round's four modes is chosen for this game. One name for
     it, because it is read in eight places and every one of them used to spell out
     a setting id that has now changed once. */
  function defaultMode(game){ return S.get('round_default', game || activeGame); }

  /* What the room should be in right now: the game's own round if it has one, the
     **default round** otherwise. One definition, so arming and re-asking cannot
     disagree — they did, and a reconnect then replaced a bingo card with a buzzer.

     **There is always a round now** (F3.8.16). This used to return the game's round
     *or else* a bare mode read off `phoneMode`, and that `or else` was the last place
     in the app where a question might not be a round. An ordinary question is handled
     by `rounds/default.js`, whose four modes are the old `phoneMode` values, so what
     comes back here is the same shape either way and every caller downstream stopped
     needing to know which it got. */
  function phoneRoundNow(game, prompt){
    const own = hook('phoneRound');
    /* Everything after `options` is carried through rather than interpreted: what a
       multi-pick reply means, or whose round it is, is the game's business exactly
       as it is the relay's business to carry it and not to read it. `undefined`
       drops out of the JSON, so a game that says nothing about them — which is four
       of the five, and Bingo's cards — arms exactly as it did before. */
    /* **`keepSpent` defaults to what the setting promises, not to true.** It used to
       default to true for any round, which was invisible while all five shaped
       rounds set `rethink:true` — the relay never marks a player spent when they are
       allowed to change their mind, so the list was always empty and never needed
       clearing. Quickfire is the first round to ask for a locked-in answer, and the
       two together meant a student answered question one and was refused for the
       rest of the run with "you have already answered this one".

       The honest default is the one `phoneOneEach` describes on its own row: *one
       answer each per question*, so a new question clears the list. Bingo still asks
       to keep it explicitly, because a card and its marks are the thing that has to
       outlive the call. */
    /* Spread, not a key list. This used to copy `multi`, `multiByTeam`, `holds`,
       `rethink` and `team` by name — a photograph of what rounds carried the day it
       was written, and it had already gone stale: `optionsByTeam` was never in it,
       so a re-ask silently dropped the ordering race's per-team pools, and
       `promptByPlayer` would have been dropped the day the information gap shipped.
       Carrying the object itself is what "carried through rather than interpreted"
       actually means. */
    if(own) return Object.assign({}, own, {
                     prompt: own.prompt || '', options: own.options || [],
                     keepSpent: own.keepSpent != null
                                  ? own.keepSpent
                                  : !S.get('phoneOneEach', game) });
    /* `isDefault` is what `askPhones` reads instead of asking whether a game declared
       a round. The four shared dynamics below it — buzz, type, write, idle — are hub
       services rather than this round's private code: they carry the answer clock,
       the cooldown, the one-answer-each rule and the reply strip, and a shaped round
       arms the relay directly because by definition it wants none of them. */
    return { mode: defaultMode(game), prompt: prompt || '', options: [], isDefault: true };
  }

  function askPhones(prompt, game){
    if(!buzzHost) return;
    const round = phoneRoundNow(game, prompt);
    lastAsk = { mode: round.mode, prompt: round.prompt };
    /* A shaped round arms directly: the four dynamics below are hub services the
       default round asks for by name, and a shaped round wants none of them. Asked
       as "is this the default round" rather than "did the game declare one",
       because those stopped being the same question — there is a round either
       way now. */
    if(!round.isDefault){
      /* `lastTyped` as well as `lastScored`: a new question retires *both* halves of
         the last one. The shared modes get this from `armBuzzers`, which clears it
         unless the arm is a reopen — a game driving its own round never goes through
         there, so a grouping clue's "not a group" would have sat on the strip over
         the next clue, naming a team for a question that had gone. */
      clearReplies(); lastScored = null; lastTyped = null; buzzWinner = null;
      /* The commit beat: in a room of individuals a tap round holds its taps
         until the player presses Send (`roundSend`). Decided here, not by the
         round — the roster mode is the host's live fact — and only for the tap
         dynamics: buzz already is a commit, and write/type have their own Send. */
      if((round.mode === 'vote' || round.mode === 'arrange') &&
         Roster.solo() && S.get('roundSend', game)) round.send = true;
      /* Previews only mean anything where a tap is *held* — with no Send the tap is
         already the answer and the bar has always followed it. So this rides on the
         back of `send` rather than being a second thing to keep in step. */
      if(round.send && S.get('crowdLive', game)) round.preview = true;
      /* The whole payload, not a key list — same reasoning as `phoneRoundNow`'s
         spread, and it is the same bug paid for at the same moment. The relay
         ignores what it does not know. */
      buzzHost.arm(round.prompt, round);
      renderBuzzChip('asking');
      renderPhoneBar();
      return;
    }
    clearReplies();
    /* A new question retires the last result. It has to survive the *previous*
       question's re-arm — Race re-arms within a frame of a word being claimed — but
       it must not sit over the next one. */
    lastScored = null;
    // the question only travels if the teacher wants it to — sometimes the point
    // is that they read the board, not their hand
    if(!S.get('phonePrompt', game)) prompt = '';
    const mode = round.mode;
    if(mode === 'write')     askClass(prompt, 'answer');
    else if(mode === 'buzz') armBuzzers(prompt);
    else if(mode === 'type') armBuzzers(prompt, { mode:'type' });
    /* `off` is a state to put the phones *into*, not an absence of one. A room now
       outlives the mode — Millionaire keeps one open for Ask the class — so leaving
       a game that was buzzing, or closing a vote with the mode off, would otherwise
       leave thirty handsets showing a live button for a question that has gone. */
    else if(buzzHost){ buzzWinner = null; buzzHost.disarm(); renderBuzzChip(); }
  }

  /* Opening the room is asynchronous — it fetches a code — so a game that deals its
     first question during start() has already asked the phones before there were any
     phones to ask. Millionaire deals on start, so its opening question reached
     nobody. Re-ask whatever is live the moment the room is up. */
  function reaskPhones(){
    if(!buzzHost || !activeGame) return;
    /* A vote in progress outranks the mode: re-asking here would replace the four
       options on every phone with a buzzer, mid-vote, and the votes already cast
       would be the only ones counted. Whoever closes the vote re-asks. */
    if(voteLive()) return;
    /* And so does somebody holding the floor. This runs on every `ready` from the
       relay — which is *every reconnection of the host's stream*, not just the
       first — and re-arming clears `buzzWinner`, so a student's buzz was being
       silently thrown away and the buzzers reopened a moment later. On classroom
       wifi that is not an edge case; it is what a dropped connection does. The job
       here is "the room came back, tell it what is being asked", never "cancel what
       is in progress". The relay still holds the lock, so a phone reconnecting
       mid-buzz is told who got in. */
    if(buzzWinner) return;
    /* The same rule, for the mode where nobody takes the floor. In `write` the whole
       room answers, so what a re-ask would destroy is not one student's buzz but
       every answer already given — the relay clears its responses on `arm`. Two of
       four vanished in the strip suite and it looked like the strip losing them; the
       host had asked twice, because a `ready` arrives on *every* reconnection of its
       stream. A class on school wifi reconnects all lesson, so half the room's
       answers disappearing is the normal case, not the edge one. */
    if(classReplies && classReplies.all && classReplies.all.length) return;
    if(!hook('askingNow')) return;
    /* Nothing has changed, so there is nothing to say. `ready` arrives on every
       reconnection of the host's stream, and re-arming an already-armed room resets
       every handset's button — which is what the room sees as the buzzer flickering
       on and off. Re-asking is for telling a room that came back *what is being
       asked*, so if it already knows, stay quiet. */
    const prompt = currentPhonePrompt();
    const want = phoneRoundNow(activeGame, prompt);
    if(lastAsk && lastAsk.mode === want.mode && lastAsk.prompt === want.prompt) return;
    askPhones(prompt, activeGame);
  }

  /* Both games' votes, asked as one question — the fact lives here rather than in
     each caller, the same reason `Kit.floorTop()` exists. */
  function voteLive(){ return mVoting || bbVoting; }

  function clearReplies(){
    classReplies = null;
    renderPhoneBar();
  }

  /* Answers used to be drawn wherever the current game happened to have room — the
     clue card, under the race sentence, under the Millionaire question — which is
     three layouts for one idea, and two of them grew the page as the class typed.
     They go in the standard strip now, like everything else the class does. */
  function renderReplies(){ renderPhoneBar(); }

  /* `opts.mode` picks the shape ('type' carries a typed answer with the buzz);
     `opts.reopen` says this is the same question coming back after a wrong answer,
     which is what stops every other phone losing what it was halfway through
     typing. */
  function armBuzzers(prompt, opts){
    buzzWinner=null;
    jClockStop();      // the floor is open again, so nobody is on the clock
    // a reopen is the same question, so the miss that caused it stays on the chip —
    // clearing it here wiped the one piece of information the teacher wanted
    if(!(opts && opts.reopen)) lastTyped=null;
    /* The answer clock travels with the arm so the relay can hand it to whichever
       phone takes the floor — and to the room watching them. Jeopardy-only: it is
       that game's rule, started by its buzz, and a typing race needs no clock on
       the floor because the typed word is judged the instant it arrives. */
    const answerSecs = (activeGame === 'jeopardy' && !typingRace())
      ? (Number(S.get('jAnswerSeconds', 'jeopardy')) || 0) : 0;
    if(buzzHost) buzzHost.arm(prompt||'', Object.assign(
      { mode: typingRace() ? 'type' : 'buzz', answerSecs: answerSecs || undefined }, opts||{}));
    renderBuzzChip('armed');
  }
  function typingRace(){ return !!activeGame && defaultMode(activeGame) === 'type'; }
  /* The mode where the whole room answers rather than one phone taking the floor.
     Nobody wins the question, so nothing about the round should behave as if
     somebody had — the turn rotates instead of being kept. */
  function everyoneAnswers(){ return !!activeGame && defaultMode(activeGame) === 'write'; }
  // the modes where one phone takes the floor, as opposed to the whole room answering
  function phoneRaces(){
    const m = activeGame ? defaultMode(activeGame) : 'off';
    return m === 'buzz' || m === 'type';
  }
  function resetBuzzers(){
    buzzWinner=null;
    if(buzzHost) buzzHost.reset();
    renderBuzzChip();
  }

  /* What the room is being asked for right now, so a typed answer can be judged
     against it. Each game already holds it; this is the one place that knows where.
     Returns '' when nothing is open, which declines the buzz rather than guessing. */
  /* Both tile games ask this, and it used to be written out at the one call site
     that needed it — `modal.style.display === 'flex'`. A game should not have to
     know how the shared modal is hidden. */
  function clueIsOpen(){
    const modal = document.getElementById('clue-modal');
    return !!(currentClueItem && modal && modal.style.display === 'flex');
  }

  function expectedAnswer(){ return hook('expects') || ''; }

  let lastTyped = null;      // {name, value, verdict} — what the chip shows the teacher

  /* A buzz carrying text is the typing race: the floor goes to the first student to
     *produce* the word, not the first to hit a button. Judged here and only here —
     the relay never learns the answer, so it can never be asked for it.

     A miss costs time, not points. That is the same decision every other mechanic
     in this app makes, and it matters more here: the student who is closest to the
     word is the one most likely to buzz early and get it slightly wrong. */
  function judgeTypedBuzz(b){
    const expected = expectedAnswer();
    const verdict  = expected ? Kit.answer.judge(b.value, expected) : 'wrong';
    const strict   = S.get('typeStrict', activeGame);
    const accepted = verdict === 'right' || (verdict === 'close' && !strict);
    lastTyped = { name:b.name, value:b.value, verdict };

    if(accepted){
      if(buzzHost) buzzHost.judge(b.id, verdict, { coolMs:0,
        note: verdict === 'close' ? 'Close — check your spelling' : 'You got it!' });
      return true;
    }
    const coolMs = Math.round((Number(S.get('typeCooldown', activeGame)) || 0) * 1000);
    if(buzzHost) buzzHost.judge(b.id, 'wrong', { coolMs,
      note: verdict === 'close' ? 'Not quite — check your spelling' : 'Not quite' });
    Sound.play('wrong');
    // the question is still live for everybody else, so put the floor back — as a
    // reopen, or every other phone loses the word it was halfway through typing
    armBuzzers(currentPhonePrompt(), { mode:'type', reopen:true });
    renderBuzzChip('armed');
    return false;
  }

  /* The prompt as the phones currently have it, for a re-arm. Re-deriving it would
     mean each game answering the same question twice. */
  function currentPhonePrompt(){
    // the question only travels if the teacher wants it to — sometimes the point is
    // that they read the board, not their hand
    if(!S.get('phonePrompt', activeGame)) return '';
    return hook('phonePrompt') || '';
  }

  function onBuzz(b){
    /* Refusing a buzz is not the same as ignoring one: the relay locks the room on
       the *first* buzz whoever it came from, so a phone that is not entitled would
       hold the lock and the team that is could never get in. Re-arming clears the
       lock and puts the floor back. Race's steal rule and Millionaire's `speaker`
       role are both this, and both used to be written out here by name. */
    if(b && hook('buzzEntitled', b) === false){
      /* Re-arming is right when the question is still open — it clears the relay's
         lock so the team that *is* entitled can get in. It is wrong when nothing is
         open to the room at all: a Daily Double belongs to one team, so re-arming
         there would put the buzzers back for a question nobody may answer. Two
         different refusals, and the difference is whether a question is live. */
      /* Put the room back into whatever it *should* be in — which is not always a
         buzzer. `armBuzzers` was written when the only shared dynamics were the
         phone modes, so it hard-codes one: a game that owns its round would have had
         its round replaced by a buzzer, by the very code meant to recover from a
         stray buzz. Same shape as every other list that named what it should have
         asked. `askPhones` consults `phoneRound()` and re-establishes the real one.

         It costs the round's collected replies, because the relay clears them on any
         arm — but the buzz has already taken the room out of the round (it sets
         `armed:false` and locks), so there is nothing left to protect. */
      if(hook('askingNow')){
        if(hook('phoneRound')) askPhones(currentPhonePrompt(), activeGame);
        else armBuzzers(currentPhonePrompt());
      }
      else if(buzzHost){ buzzWinner = null; buzzHost.disarm(); renderBuzzChip(); }
      return;
    }

    if(b && b.value != null && !judgeTypedBuzz(b)) return;
    buzzWinner = b;
    // the game reacts to who has the floor — the tile games select that team, and
    // Millionaire's `floor` role moves the question onto their ladder
    if(b) hook('onBuzzTaken', b);
    Sound.play('claim');
    renderBuzzChip('won');

    /* A typed word *is* the claim, in every game — the student produced the answer
       and the host judged it, so there is nothing left for the teacher to confirm.
       A plain buzz is the opposite case and stays a two-step: it says who wants the
       floor, the answer is spoken in the room, and the teacher marks it. That is the
       whole difference between the two modes at the scoring end.

       The game says what scoring means on its board and hands back what it paid;
       `null` means it did not score, so the floor stays where it is. */
    if(b && b.value != null && teams[b.team]){
      const paid = hook('onTypedWin', b);
      if(paid != null){
        /* The floor is given up as part of scoring: the question is over, so leaving
           a winner standing would keep the strip saying "got it" instead of what
           they got. `notePhoneScore` outlives the re-arm, which matters because
           several games deal the next question immediately. */
        buzzWinner = null;
        notePhoneScore(b.name, b.team, b.value, paid);
      }
    }
  }

  /* ================= RACE TO THE BOARD =================
     Target words sit on screen; the teacher reads a gapped sentence and a student
     runs to the projector screen and touches the word. The screen isn't a
     touchscreen, so the teacher clicks the word the student touched.
     One team plays at a time against the clock, which keeps scoring unambiguous —
     the engine can't tell who tapped, but it always knows whose round it is. */
  const RACE_MIN_WORDS     = 10;   // §3.4: playable from a single lesson section
  const RACE_MAX_WORDS     = 18;   // beyond this the words stop being readable at distance
  const RACE_ROUND_SECONDS = 60;

  let raceMode    = 'h2h';  // 'h2h' = both teams race the same word; 'timed' = one team per round
  let raceWords   = [];     // [{word, section, found, by}] — what's on the board
  let raceQueue   = [];     // prompts still to ask; a missed one goes to the back
  let raceCurrent = null;
  let raceRunning = false;
  let racePending = null;   // {w, el} — correct word clicked, waiting on "who got it?"

  const RACE_MODE_RULES = {
    h2h: `Both teams send a student to the board at the same time. Read the sentence aloud &mdash; the
          <strong>first student to touch the right word wins the point</strong>.<br>
          The projector screen isn't a touchscreen, so <strong>you click the word they touched</strong>, then
          say who got there first (click the team, or just press <strong>1</strong> or <strong>2</strong>).<br>
          A wrong touch flashes red and costs nothing &mdash; the sentence stays up, so the other team can steal it.
          No clock: the game ends when the board is cleared.`,
    timed:`One team is up at a time. Press <strong>Start</strong> and read the sentence aloud &mdash;
          a student runs to the screen and <strong>touches the missing word</strong>.<br>
          The projector screen isn't a touchscreen, so <strong>you click the word they touched</strong> on your laptop:
          right = it lights up and scores +1, wrong = a red flash and the sentence comes back later.<br>
          Keep going until the timer runs out, then the next team is up. The game ends when the board is cleared.`
  };

  function renderRaceRules(){
    document.getElementById('race-rules').innerHTML = RACE_MODE_RULES[raceMode];
  }

  document.querySelectorAll('#race-mode input[name="racemode"]').forEach(r=>{
    r.addEventListener('change', ()=>{ raceMode = r.value; renderRaceRules(); });
  });

  function buildRaceBoard(){
    const chosen = RACE_BANK.filter(inPlay);
    /* **The board is built from the words, the queue from everything.** An ordinary
       item puts its answer on the board as a tile a student runs to touch; a round
       item has no single answer, so it contributes no tile and is simply a question
       in the queue. Splitting them here is what lets one bank hold both without the
       board trying to scatter a Connections set. */
    const words  = shuffle(chosen.filter(c => !raceIsRound(c))).slice(0, RACE_MAX_WORDS);
    const rounds = chosen.filter(raceIsRound);
    const picked = words;
    raceWords   = picked.map(p=>({ word:p.answer, section:p.section, found:false, by:-1 }));
    raceQueue   = shuffle(picked.concat(rounds));
    raceCurrent = null;
    raceRunning = false;
    racePending = null;
    hideClaimBar();
    renderRaceWords();
    setRacePrompt(null);
    updateRaceBar();
  }

  function renderRaceWords(){
    const wrap=document.getElementById('race-words');
    wrap.innerHTML='';
    raceWords.forEach(w=>{
      const el=document.createElement('button');
      el.className='race-word'+(w.found?' found team-'+Math.min(w.by,3):'');
      el.textContent=w.word;
      el.addEventListener('click', ()=>onRaceWordClick(w, el));
      wrap.appendChild(el);
    });
    scatterRaceWords();
  }

  /* Spread the words over the whole field rather than a centred block, so students
     genuinely have to cross the room. A jittered grid is used instead of random
     placement because it can never overlap — unreadable words are worse than tidy ones.
     The top strip is left free: on a wall-mounted projector the very top of the image
     is out of reach for shorter students, and that's where the sentence lives anyway. */
  function scatterRaceWords(){
    const field = document.getElementById('race-words');
    const tiles = [...field.querySelectorAll('.race-word')];
    if(!tiles.length) return;

    field.style.setProperty('--rs', 1);            // reset any previous down-scaling
    const W = field.clientWidth;
    // nothing is measurable while the play screen is still hidden — the caller
    // re-runs this once the screen is up
    const avail = W < 50 ? 0 : Kit.fitToScreen(field, { min:240, gap:10 });
    if(!avail) return;

    /* Shrink the type until the grid genuinely fits, then place one word per cell.
       Two things make "one per cell" insufficient on its own, and both bit at
       1280x720 with the longest words in the bank:

       - **The tilt grows the box.** Each word is rotated up to TILT degrees, and a
         rotated element occupies more room than its layout size — a 288px-wide tile
         at 1.5 degrees is about 8px taller. That is proportional to the tile's
         *width*, so it is the long words that collide vertically.
       - **The jitter can eat the whole margin.** Placing anywhere in the cell means
         one word can sit hard against the right edge of its cell and the next hard
         against the left edge of the next, leaving nothing between them.

       So: size the cells to the *grown* box, and keep a gutter the jitter can't
       spend. */
    const TILT = 1.5, SIN_T = Math.sin(TILT * Math.PI / 180), GUTTER = 12;
    let cols=1, rows=tiles.length, maxW=0, maxH=0, scale=1;
    for(let attempt=0; attempt<7; attempt++){
      field.style.setProperty('--rs', scale.toFixed(3));
      maxW = Math.max(...tiles.map(t=>t.offsetWidth));
      maxH = Math.max(...tiles.map(t=>t.offsetHeight));
      const boxW = maxW + maxH*SIN_T + GUTTER + 8;
      const boxH = maxH + maxW*SIN_T + GUTTER + 6;
      cols = Math.min(tiles.length, Math.max(1, Math.floor(W / boxW)));
      rows = Math.ceil(tiles.length / cols);
      if(rows * boxH <= avail || scale <= 0.6) break;
      scale = Math.max(0.6, scale * Math.sqrt(avail / (rows * boxH)) * 0.97);
    }

    const cellW = W / cols, cellH = avail / rows;
    const slots = [];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) slots.push({r,c});
    shuffle(slots);

    tiles.forEach((el, i)=>{
      const s = slots[i]; if(!s) return;
      const tw = el.offsetWidth, th = el.offsetHeight;
      // the tilt is about the centre, so half its growth hangs off each side
      const padX = (th * SIN_T) / 2, padY = (tw * SIN_T) / 2;
      const freeX = Math.max(0, cellW - tw - GUTTER - 2*padX);
      const freeY = Math.max(0, cellH - th - GUTTER - 2*padY);
      const x = s.c*cellW + GUTTER/2 + padX + Math.random()*freeX;
      const y = s.r*cellH + GUTTER/2 + padY + Math.random()*freeY;
      el.style.left = Math.round(Math.max(padX, Math.min(W - tw - padX, x))) + 'px';
      el.style.top  = Math.round(Math.max(padY, Math.min(avail - th - padY, y))) + 'px';
      el.style.transform = `rotate(${(Math.random()*2*TILT - TILT).toFixed(2)}deg)`;
    });
  }

  function setRaceMessage(text){
    const el=document.getElementById('race-prompt');
    el.classList.remove('live');
    el.innerHTML='';
    const s=document.createElement('span'); s.className='race-idle'; s.textContent=text;
    el.appendChild(s);
  }

  function setRacePrompt(item){
    if(!item){ setRaceMessage('Press Start round when the team is ready.'); return; }
    const el=document.getElementById('race-prompt');
    el.classList.add('live');
    el.innerHTML='';
    const sec=document.createElement('span'); sec.className='race-sec';
    sec.textContent = S.get('raceShowSection', 'race') ? item.section : '';
    const sent=document.createElement('span'); sent.className='race-sentence';
    // this used to build its own gap span — the shared renderer is that idea
    // generalised, so every game draws a blank the same way. Never revealed here:
    // the answer is a word on the board for a student to find.
    drawPrompt(sent, { text:item.prompt, answer:item.answer, type:item.type }, 'race');
    el.appendChild(sec); el.appendChild(sent);
  }

  /* A round item has no single answer, so it puts no word on the board and the
     tile-matching loop above would drop it. Recognised before that loop rather than
     inside it, because "is this a round" is a question about the item and "is its
     word still on the board" is a question about the board. */
  const raceIsRound = item => !!Kit.round.of(item);

  function nextRacePrompt(){
    while(raceQueue.length){
      const item = raceQueue.shift();
      if(raceIsRound(item)){
        raceCurrent = item; raceFailed = new Set();
        setRacePrompt(item); updateRaceBar();
        /* Opening the round arms the room, exactly as it does on every other host —
           written as one expression so the two can never be half-done. A round that
           fails to set up falls through to the ordinary path. */
        if(!raceOpenRound(item)) askPhones(item.prompt, 'race');
        rTension();
        return;
      }
      const w = raceWords.find(x=>x.word===item.answer);
      if(w && !w.found){
        raceCurrent=item; raceFailed = new Set(); setRacePrompt(item); updateRaceBar();
        /* Through askPhones, not armBuzzers: Race used to arm a buzzer directly,
           which meant `phoneMode` had no effect here at all — picking "everyone
           types" for Race silently kept giving the room a buzzer. */
        /* Timed rounds ask the room too. This was `if(raceMode==='h2h')`, so half of
           Race ignored `phoneMode` entirely — pick "everyone types" for a timed round
           and the phones sat idle with nothing saying why. One team is on the clock
           rather than two racing, so a buzz from anyone else is refused below; what
           the phones are *for* here is typing the word before the runner finds it. */
        askPhones(item.prompt, 'race');
        // the sentence going up is the starting gun — that is the moment they run
        if(document.getElementById('play-race').classList.contains('lit')) Sound.crack();
        rTension();
        return;
      }
    }
    raceCurrent=null;
    endRaceRound(true);
  }

  /* The two calls a host makes: name yourself at `roundOf`, because `setup` is
     handed a ctx scoped to whichever board is asking, and then open. */
  function raceOpenRound(item){
    roundEnd();
    /* **The item the round is playing, which every other host sets and this one did
       not.** `roundPress` re-asks the room through `currentClueItem`, so without it a
       round button that moves the question — bingo's next call — redrew the board and
       left thirty handsets on the previous one. */
    currentClueItem = item;
    const found = roundOf(item, 'race');
    const opened = found ? roundOpen(found) : null;
    document.getElementById('race-round').style.display = opened ? 'block' : 'none';
    if(opened) hook('onResize');       // the stage just changed height under the board
    return !!opened;
  }

  /* A round pays a point, the same as a touched word, and then the board moves on —
     which is what `awardRaceWord` does for a word. There is no tile to colour here,
     so this is the short version of that path: score, name the student on the strip,
     next sentence. */
  function awardRaceRound(team){
    award(team, 1, { why:'race round' });
    raceCurrent = null;
    document.getElementById('race-round').style.display = 'none';
    setTimeout(()=>{ if(raceRunning) nextRacePrompt(); else updateRaceBar(); }, 700);
  }

  function startRaceRound(){
    if(!raceWords.some(w=>!w.found)) return;
    raceRunning=true;
    if(raceMode==='timed'){ timerReset(); timerStart(); }
    nextRacePrompt();
  }

  function endRaceRound(cleared){
    raceRunning=false;
    hideClaimBar();
    /* A round outlives nothing here: the clock stopping ends the question, so the
       handsets stand down and the mount goes with them. */
    roundEnd();
    document.getElementById('race-round').style.display = 'none';
    resetBuzzers();
    // the sentence on screen when the clock stopped hasn't been answered — put it
    // back in the queue, or its word could never be claimed and the board never clears
    if(raceCurrent){
      const w = raceWords.find(x=>x.word===raceCurrent.answer);
      if(w && !w.found) raceQueue.push(raceCurrent);
    }
    raceCurrent=null;
    timerStop();
    const showy = document.getElementById('play-race').classList.contains('lit');
    Sound.bedStop();
    if(cleared){
      if(showy){ Sound.fanfare(); setTimeout(()=>Sound.applause(2400), 640); }
      else Sound.play('clear');
      setRaceMessage('Board cleared — final scores are in the team bar.');
    } else {
      Sound.play(showy ? 'klaxon' : 'end');
      nextTurn();                       // timed mode: hand the board to the next team
      setRacePrompt(null);
    }
    updateRaceBar();
    rTension();
  }

  function updateRaceBar(){
    const status   = document.getElementById('race-status');
    const startBtn = document.getElementById('race-start');
    const skipBtn  = document.getElementById('race-skip');
    const left     = raceWords.filter(w=>!w.found).length;
    const teamName = (teams[active] && teams[active].name) || 'Team';
    if(raceMode==='h2h'){
      status.textContent = left ? `First touch wins · ${left} word${left===1?'':'s'} left` : 'All words found';
      startBtn.textContent = '▶ Start';
    } else {
      status.textContent = left ? `${teamName} is up · ${left} word${left===1?'':'s'} left` : 'All words found';
      startBtn.textContent = `▶ Start round — ${teamName}`;
    }
    startBtn.style.display = (!raceRunning && left) ? 'inline-block' : 'none';
    skipBtn.style.display  = (raceRunning && left) ? 'inline-block' : 'none';
  }

  /* ---- Race's tension curve ----
     The other three read a rung, a tile's value and the distance to a line. This
     game has none of those, but it has two things that matter at once: **how much
     of the board is gone**, and **whether a race is actually happening right now**.
     A sentence going up is the moment students leave their chairs, so it counts for
     nearly as much as a nearly-empty board — and the last word on the board with a
     sentence live is the loudest this game gets, which is exactly right.

     Deliberately the same in both modes. Timed rounds already have the header
     clock going red under ten seconds; driving the stage off the clock as well
     would mean the lights say something different from the number beside them. */
  /* The words fly in — but only on the opening scatter. Race re-scatters after every
     claim, and a full fly-in each time would put an animation between the teacher
     and the next sentence a dozen times a game. The re-scatter instead glides, which
     the CSS does for free once `.lit` puts a transition on left/top. */
  function rDeal(){
    dealStagger('play-race', document.getElementById('race-words'), wrap => {
      [...wrap.querySelectorAll('.race-word')].forEach((el, i)=> el.style.setProperty('--i', i));
    }, 1800);
  }

  function rTension(){
    stageTension('race', (stage) => {
      const done  = raceWords.filter(w=>w.found).length;
      const clear = raceWords.length ? done/raceWords.length : 0;
      const live  = !!(raceRunning && raceCurrent);
      stage.classList.toggle('running', live);
      return { t: Math.min(1, 0.6*clear + (live ? 0.4 : 0)), live };
    });
  }

  /* Who has already missed the sentence currently up. Head-to-head re-opened the
     buzzers after a wrong touch but recorded nothing, so the team that had just got
     it wrong could buzz straight back in and try again — which is not a steal, it is
     a retry, and it left the other team with nothing to win. */
  let raceFailed = new Set();

  function raceCanTry(teamIdx){
    /* In a timed round only the team whose round it is may buzz. Head-to-head is the
       mode where both teams are at the board at once; timed is explicitly one team
       against the clock, so a buzz from the bench would steal a word off someone
       else's score. */
    if(raceMode === 'timed' && teamIdx !== active) return false;
    return !S.get('stealOnWrong', 'race') || !raceFailed.has(teamIdx);
  }

  function onRaceWordClick(w, el){
    if(!raceRunning || !raceCurrent || w.found || racePending) return;
    const showy = document.getElementById('play-race').classList.contains('lit');
    if(w.word === raceCurrent.answer){
      Sound.play(showy ? 'sting' : 'correct');
      el.classList.remove('wrong');
      if(raceMode==='h2h'){
        if(buzzWinner && teams[buzzWinner.team]){
          // a phone already told us who got in first — no need to ask
          racePending = { w, el };
          awardRaceWord(buzzWinner.team, el);
          return;
        }
        // nobody buzzed (or no buzzers at all) — fall back to asking, minus anyone
        // who has already had their shot at this sentence
        racePending = { w, el };
        el.classList.add('pending');
        showClaimBar();
      } else {
        awardRaceWord(active, el);
      }
    } else {
      Sound.play(showy ? 'klaxon' : 'wrong');
      el.classList.add('wrong');
      setTimeout(()=>el.classList.remove('wrong'), 600);
      if(raceMode==='timed'){
        // keep the pace up: no penalty, but move on — the sentence returns later
        raceQueue.push(raceCurrent);
        nextRacePrompt();
      } else {
        /* h2h: the sentence stays up so the other team can steal it. Only record a
           failure when a phone actually told us who it was — head-to-head has no
           team on turn (both are at the board at once, which is why the engine asks
           after a correct touch). Blaming `active` here would invent a fact the app
           does not have and lock a team out of a sentence they may never have tried. */
        if(buzzWinner && teams[buzzWinner.team]) raceFailed.add(buzzWinner.team);
        // only the racing modes have a floor to hand back; in 'write' the whole
        // class is answering and there is nothing to re-open
        if(buzzHost && phoneRaces()) armBuzzers(raceCurrent.prompt);
      }
    }
  }

  // Award the pending (or, in timed mode, the just-clicked) word to a team.
  function awardRaceWord(teamIdx, elOverride){
    const hit = racePending || { w: raceWords.find(x=>x.word===raceCurrent.answer), el:elOverride||null };
    if(!hit.w) return;
    hit.w.found = true;
    hit.w.by    = teamIdx;
    award(teamIdx, 1, { why:'word · ' + (hit.w.word || '') });
    markRun(teamIdx, true);
    racePending = null;
    hideClaimBar();
    resetBuzzers();
    renderScorebar();
    if(S.get('raceRescatter', 'race')){
      renderRaceWords();   // re-scatter, so nobody wins on remembering where a word sat
    } else if(hit.el){
      hit.el.classList.remove('pending');
      hit.el.classList.add('found', 'team-'+Math.min(teamIdx,3));
    }
    rTension();
    nextRacePrompt();
  }

  const raceClaim = Kit.claimTeam({
    mount:  document.getElementById('race-claim'),
    onPick: i => awardRaceWord(i)
  });
  function showClaimBar(){
    /* **A live round owns the verdict**, so this board's own way of awarding stands
       down while one is open — otherwise the chooser is a second way to pay for the
       same question. Blockbusters' team chooser learned this first. */
    if(roundLive()){ hideClaimBar(); return; }
    const allow = teams.map((_, i) => i).filter(raceCanTry);
    raceClaim.show(teams, allow.length ? allow : null);
  }
  function hideClaimBar(){
    raceClaim.hide();
    if(racePending && racePending.el) racePending.el.classList.remove('pending');
  }

  document.getElementById('race-start').addEventListener('click', startRaceRound);
  document.getElementById('race-skip').addEventListener('click', ()=>{
    if(!raceRunning || !raceCurrent) return;
    if(racePending){ racePending.el.classList.remove('pending'); racePending=null; hideClaimBar(); }
    raceQueue.push(raceCurrent);
    nextRacePrompt();
  });

  // one listener for every board, now and later — a new game gets re-fitted on
  // resize by declaring onResize, not by being added to a list here
  window.addEventListener('resize', ()=>{ hook('onResize'); });


  /* ================= TIMER (teacher-controlled) ================= */
  let tmrDuration=30, tmrLeft=30, tmrTick=null;
  const tmrDisplay = document.getElementById('tmr-display');
  const tmrToggle  = document.getElementById('tmr-toggle');

  function fmt(s){ const m=Math.floor(s/60), ss=s%60; return m+':'+String(ss).padStart(2,'0'); }
  function timerRender(){
    tmrDisplay.textContent = fmt(Math.max(0, tmrLeft));
    tmrDisplay.classList.toggle('urgent', tmrLeft<=10);
    tmrToggle.textContent = tmrTick ? '⏸' : '▶';
  }
  function timerStart(){
    if(tmrTick) return;
    if(tmrLeft<=0) tmrLeft=tmrDuration;
    tmrTick=setInterval(()=>{
      tmrLeft--;
      if(tmrLeft<=0){
        tmrLeft=0; clearInterval(tmrTick); tmrTick=null;
        // whichever game is up decides what running out of time means; only a
        // timed race round currently does anything with it
        hook('onTimerEnd');
      }
      timerRender();
    }, 1000);
    timerRender();
  }
  function timerStop(){ if(tmrTick){ clearInterval(tmrTick); tmrTick=null; } timerRender(); }
  function timerReset(){ timerStop(); tmrLeft=tmrDuration; timerRender(); }
  function timerSetDuration(s){ tmrDuration=s; tmrLeft=s; timerRender(); }
  function timerAdjust(delta){ if(tmrTick) return; tmrDuration=Math.min(300, Math.max(15, tmrDuration+delta)); tmrLeft=tmrDuration; timerRender(); }

  tmrToggle.addEventListener('click', ()=> tmrTick ? timerStop() : timerStart());
  document.getElementById('tmr-reset').addEventListener('click', timerReset);
  document.getElementById('tmr-minus').addEventListener('click', ()=> timerAdjust(-15));
  document.getElementById('tmr-plus').addEventListener('click', ()=> timerAdjust(+15));
  timerRender();

  /* ================= INIT ================= */
  document.querySelector('.eyebrow').textContent = 'Cambridge Empower C1 · Classroom games';
  document.getElementById('change-unit').style.display = (UNITS.length>1) ? 'inline-block' : 'none';
  /* **The board carries no settings UI of its own** — no gear, no clue-card Tune pill,
     no docked drawer. Every setting is edited from the room bench's one panel, which
     reaches this board's registry through the frame (`win.HubSettings`). The registry
     still lives here and every value still applies; only the on-board way to *open* it
     is gone, so there is one place to change anything and it cannot disagree with
     itself. `HubSettings` needs no init on the board — nothing here opens the panel;
     the room bench builds it on demand through the frame. */
  renderScorebar();   // team bar visible from the very first screen

  // settings that change what's already on screen take effect without a restart
  S.onChange((id)=>{
    /* The bed is the only sound that is *already playing* when the panel is open,
       so it is the only one that has to be re-decided on the spot. Re-running the
       game's tension hook does that: it is the single place that knows whether a
       question is live, and it starts or stops the bed accordingly. */
    if(id==='musicBed' || id==='sound' || id==='soundVolume') hook('tension');
    /* What a game does about its own settings changing mid-board is the game's —
       `onSetting` on the registry. This was five by-name branches (three
       Jeopardy, two Race) that a sixth game would have had to join by hand.
       `hook` fires only for the active game, which is what they all guarded. */
    hook('onSetting', id);
  });
  /* ---------- what the engine lends a game that lives in its own file ----------
     A game inside this closure reaches everything; one outside it reaches only
     what is published here, called from inside hooks (never at parse — game files
     load before this engine, so at their parse time none of this exists yet).
     **Grown only as an extracted game proves the need** — each member has a
     caller in `games/*.js`, which is what keeps this a contract rather than a
     mirror of the whole closure. Quickfire is the first caller. */
  function revealOpenRound(){
    if(roundState && !roundState.shown) roundDef().reveal(roundHost.mount(), roundState, roundCtx());
  }
  function roundDoneNow(){ return !!(roundState && roundState.done); }
  window.HubEnv = {
    // scoring and the receipt
    award, ledgerNote, markRun,
    payRuleLabel: g => (PAY_RULES[S.get('roundPay', g)] || PAY_RULES.winner).label,
    // the round adapter — a host names itself at roundOf, so no closure state moves
    roundCommit, roundEnd, roundOf, roundOpen, roundClockSecs,
    roundForPhones, roundLive, roundOnReplies,
    revealOpenRound, roundDone: roundDoneNow,
    // surfaces and the room
    drawPrompt, askPhones, armBuzzers, resetBuzzers,
    showResult, hideResult, showStandings, standingsWanted,
    notePhoneScore, notePhoneMiss,
    // content, roster, presentation
    groupCheckboxes, sectionHeading, contentRow, groupOf, inPlay, shuffle,
    selectedContent: () => selectedContent,
    teams: () => teams, teamName, nextTurn, Roster,
    activeTeam: () => active,
    setActiveTeam: i => { if(teams[i]) active = i; },
    /* The live relay host, or null — a game holding per-player state deals and
       judges through it. The relay still never learns an answer. */
    room: () => buzzHost,
    syncBuzzRoom, reaskPhones,
    // nobody holds the floor any more, and the chip stops saying so
    clearFloor: () => { buzzWinner = null; renderBuzzChip(); },
    renderScorebar, themeOf, motionOK, Sound, stageTension, startGate,
    timerSetDuration, timerStart, timerStop, timerReset,
    asChoiceRound: q => mAsRound(q)
  };

  if(UNITS.length===1){
    loadUnit(UNITS[0]);
    showScreen('screen-game-select');
  } else {
    renderUnitSelect();
    showScreen('screen-unit-select');
  }
  /* Open the room now rather than when a board starts, so the code is on the wall
     while the class is still walking in. Nothing else about it changes: the room is
     the lesson's, it parks between games, and only switching phones off ends it. */
  syncBuzzRoom();

})();
