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
  const GAMES = [];
  const GAME_BY_ID = Object.create(null);
  const NO_OP = function(){};
  // the settings panel labels its per-game tabs from this
  const HUB_GAME_TITLES = {};
  window.HUB_GAME_TITLES = HUB_GAME_TITLES;

  function registerGame(def){
    if(!def || !def.id) throw new Error('registerGame: a game needs an id');
    if(GAME_BY_ID[def.id]) return GAME_BY_ID[def.id];
    const g = Object.assign({
      title: def.id,
      stage: 'play-' + def.id,     // the id of its panel on the play screen
      card:  { icon:'', blurb:'', badge:'' },
      intro: null,                 // no ident = no title sequence, and that's fine
      hasBank: function(){ return false; },
      // is this board sized to the screen? every one so far is except Blockbusters,
      // which scales itself around the end-of-round banner instead
      fitsScreen: true,
      load: NO_OP, renderContent: NO_OP, startButton: NO_OP,
      start: NO_OP, fit: NO_OP, deal: NO_OP, tension: NO_OP,
      onResize: NO_OP, onTimerEnd: NO_OP, onWrong: NO_OP,
      /* ---- the phone contract ----
         These six are what a game owes the room, and they are the reason every
         phone dynamic reaches every board. They were `if (activeGame === …)` chains
         inside the phone layer until a fifth game proved the point: buzzing,
         everyone-types, type-then-buzz and the class vote each had to be threaded
         through four functions by hand, and nothing complained if one was missed.
         Declare these and a new game inherits all of it, including modes that do
         not exist yet. Leave them out and its phones are simply idle — a visible,
         correct state rather than a half-wired one. */
      expects:      function(){ return ''; },    // what a typed answer is judged against
      phonePrompt:  function(){ return ''; },    // what the handset shows
      askingNow:    function(){ return false; }, // is a question open right now
      buzzEntitled: function(){ return true; },  // false = refuse this buzz, engine re-arms
      onBuzzTaken:  NO_OP,                       // somebody has the floor
      onTypedWin:   function(){ return null; },  // typed and correct: score it, return the points
      /* The vote is the second half of the contract. A vote is not a phone *mode* —
         it borrows every phone in the room for the few seconds it runs and then
         gives them back — so a game says whether it ever asks the room something
         (which is what keeps a room open at `phoneMode:off`), and what to do with
         the replies as they land. */
      wantsVote:    function(){ return false; },
      onVoteReply:  NO_OP,
      /* What the room chip says when `phoneMode` is off but the game still wants a
         room. The default is the vote, because that was the only reason to have one
         — but "votes only" over a game where every phone is holding a bingo card is
         simply wrong, and the chip is the thing a class reads while deciding
         whether to bother joining. */
      roomNote:     function(){ return null; },
      /* `phoneMode` says what a phone does during a question — buzz, write, type —
         and that is right for a board every phone is watching. Some games *are* the
         phone dynamic: Bingo with the cards in their hands has nine words to tap,
         and a buzzer over the top of that is not a choice between iterations, it is
         two dynamics fighting. A game returning `{mode, prompt, options}` here owns
         the round; `null` means the mode decides, which is what four of the five
         games always want. */
      phoneRound:   function(){ return null; },
      /* **How this game's bank item becomes a round**, when the round is derived
         rather than authored. Millionaire's items carry `{answer, distractors}` and
         no `choice:` field, so `Kit.round.of()` cannot see a round in the data — the
         game builds one when the question opens. Declared here, that same knowledge
         is available to anything else that needs to ask, and the content screen was
         the first: without it a ladder of rounds read as "Question".

         Identity by default, so a game whose bank carries its round fields outright
         (Jeopardy, Blockbusters) declares nothing. */
      asRound:      function(item){ return item; }
    }, def);
    GAMES.push(g);
    GAME_BY_ID[g.id] = g;
    HUB_GAME_TITLES[g.id] = g.title;
    return g;
  }

  /* Exposed so a game can eventually live in its own file and register itself,
     the way units already do with `window.UNITS`. The four built-ins still declare
     themselves below because their logic shares this closure; moving them out is a
     mechanical follow-up, not a change of contract. */
  window.HubGames = {
    register: def => registerGame(def),
    get:      id  => GAME_BY_ID[id] || null,
    ids:      ()  => GAMES.map(g => g.id),
    hooksOf:  id  => Object.keys(GAME_BY_ID[id] || {}),
    renderCards: () => renderGameCards()
  };

  const gameDef  = id => GAME_BY_ID[id === undefined ? activeGame : id] || null;
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
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="9" height="7" rx="1"/><rect x="15.5" y="6" width="9" height="7" rx="1"/><rect x="27" y="6" width="9" height="7" rx="1"/><rect x="4" y="16.5" width="9" height="7" rx="1"/><rect x="15.5" y="16.5" width="9" height="7" rx="1"/><rect x="27" y="16.5" width="9" height="7" rx="1"/><rect x="4" y="27" width="9" height="7" rx="1"/><rect x="15.5" y="27" width="9" height="7" rx="1"/><rect x="27" y="27" width="9" height="7" rx="1"/></svg>',
      blurb:'Category board, five point values each. Teams pick a tile, answer, bank the points.',
      badge:'Best for: mixed vocab &amp; grammar' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'JEOPARDY',
            sub:'Pick your category. Pick your price. Answer it.', accent:'#4FC3FF' },
    hasBank: u => (u.jeopardyCategories||[]).length > 0,
    load(u){ JEOPARDY_SECTION_LABELS = u.jeopardySectionLabels || {};
             JEOPARDY_CATEGORIES     = u.jeopardyCategories || []; },
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
    buzzEntitled: () => jDoubleTeam == null && !jWager && !jGroupLive(),
    /* The final clue is the one beat of Jeopardy where every team answers at once,
       privately, against the clock — that is the whole mechanic, and a buzzer would
       hand it to one thumb. So the game owns the round while it runs, exactly as
       Bingo owns it while the cards are in their hands, and `phoneMode` picks up
       again afterwards. */
    phoneRound(){
      /* A grouping clue owns the round for the same reason: it *is* the phone
         dynamic, so the mode has nothing to say about eight words to assemble. */
      if(jGroupLive()) return jGroupRound();
      if(!jFinalState || !jFinalState.asking) return null;
      return { mode:'write',
               prompt: S.get('phonePrompt', 'jeopardy') ? (jFinalState.clue.q || '') : '' };
    },
    /* A room is worth having open for a grouping clue even at `phoneMode: off`, the
       same shape as Millionaire's Ask the class and Bingo's cards — and the chip has
       to say so, because "idle here" reads as "don't bother joining" to a room that
       is about to be handed eight words. */
    wantsVote:   () => jGroupLive(),
    roomNote:    () => jGroupLive() ? 'find the group' : null,
    onVoteReply(all){ jGroupOnReplies(all); },
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
    renderContent: renderBlockbustersContent,
    startButton:   blockbustersStartButton,
    start(){
      pool = shuffle(BLOCKBUSTERS_BANK.filter(c=>selectedContent.includes(groupOf(c))));
      pool = pool.slice(0, 18);          // classic 5/4/5/4 board holds 18
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
    wantsVote:   () => jGroupLive() || !!S.get('bbTeamVote', 'blockbusters'),
    /* **The replies have to come back in, not just go out.** Arming the phones for a
       round and never routing what they send is silent: the handsets look right, the
       card looks right, and every tap is dropped on the floor. That is exactly what
       shipped when this board became a round host — `phoneRound()` was declared and
       this was not. */
    onVoteReply(all){
      if(jGroupLive()){ jGroupOnReplies(all); return; }
      if(bbVote){ bbVote.apply(all); renderBBVote(); }
    },
    /* A hexagon can open a round, and a round owns the handsets while it runs —
       the same reason Jeopardy's tile does. The mode is not consulted, because
       what the phones are put into *is* the question here. */
    phoneRound(){ return jGroupRound(); },
    fit:      layoutBlockbustersBoard,
    deal:     bbDeal,
    tension(){ bbTension(); },
    onResize: layoutBlockbustersBoard
  });

  registerGame({
    id:'race', title:'Race to the Board',
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
    renderContent: renderMillionaireContent,
    startButton:   millionaireStartButton,
    start(){ buildMillionaire();
             timerSetDuration(Number(S.get('mConferSeconds', 'millionaire')) || 30); },
    expects:     () => (mCurrent && mCurrent.q && mCurrent.q.answer) || '',
    phonePrompt: () => (mCurrent && mCurrent.q && mCurrent.q.prompt) || '',
    askingNow:   () => !!(mCurrent && !mAnswered),
    /* The ladder is per team with a fixed turn order so everyone gets a full arc,
       and "fastest thumb wins" cuts against that on purpose — so a buzz means
       whatever `mBuzzRole` says it means. `speaker` refuses a buzz from a team that
       is not on turn; the engine re-arms so the entitled team can still get in. */
    buzzEntitled(b){
      if(!teams[b.team]) return true;
      if(S.get('mBuzzRole', 'millionaire') !== 'speaker') return true;
      return b.team === (mCurrent ? mCurrent.team : active);
    },
    onBuzzTaken(b){
      if(!teams[b.team] || S.get('mBuzzRole', 'millionaire') !== 'floor') return;
      if(!mCurrent || mAnswered) return;
      mCurrent.team = b.team;
      active = b.team;               // the turn strip, lifelines and ladder follow
      if(jGroup) jGroup.chosen = []; // a new team decides for itself
      renderScorebar();
      renderMillionaire();
    },
    // no onTypedWin: typing is not offered here, for the same reason it never gets
    // an anagram — the four options hand you the word
    /* Every question is a round now, so the handsets are the round's for the whole
       of it. Declaring `phoneRound` without `onVoteReply` is the failure that shipped
       on Blockbusters: the room arms correctly and every tap lands on the floor. */
    phoneRound(){ return jGroupRound(); },
    asRound:     q => mAsRound(q),
    wantsVote:   () => jGroupLive() || !!S.get('mLifelines', 'millionaire'),
    roomNote:    () => jGroupLive() ? 'pick an answer' : null,
    onVoteReply(all){ if(jGroupLive()) jGroupOnReplies(all); },
    fit:      fitMillionaire,
    tension(){ mTension(); },
    onResize: fitMillionaire
  });

  /* Bingo is the fifth game and it was built as a test of the framework: how much
     of what the other four needed does a new board get for free? It consumes the
     **Blockbusters bank** rather than one of its own — the answers there are
     already single words with a clue each, which is exactly a bingo call — so both
     units gained a fifth game with no authoring at all. That is a preview of the
     pooled-content idea: a game declaring what it can consume, instead of a bank
     being written for it. */
  registerGame({
    id:'bingo', title:'Bingo',
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="30" height="30" rx="2"/><path d="M15 5 L15 35 M25 5 L25 35 M5 15 L35 15 M5 25 L35 25"/><path d="M7 17 L13 23 M13 17 L7 23" stroke-width="2.4"/><path d="M27 27 L33 33 M33 27 L27 33" stroke-width="2.4"/></svg>',
      blurb:'Every team gets a card of words. Read a clue &mdash; the first team to answer marks it off. Three in a row wins.',
      badge:'Best for: whole-class listening, everyone in at once' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'BINGO',
            sub:'Nine words each. Listen for yours. Three in a row.', accent:'#FF7AC8' },
    /* Same bank Blockbusters uses: single-word answers with a clue apiece. A card
       needs nine distinct words and the call list wants a few spare. */
    hasBank: u => bingoWordsIn(u.blockbustersBank || []).length >= BINGO_POOL,
    load(u){ BINGO_BANK          = u.blockbustersBank || [];
             BINGO_SECTION_NAMES = u.blockbustersSectionNames || {};
             BINGO_TOPIC_NAMES   = u.topicNames || {}; },
    renderContent: renderBingoContent,
    startButton:   bingoStartButton,
    /* Cards on phones needs a room even at `phoneMode: off` — the cards *are* the
       dynamic, so the mode has nothing to say about it. Same shape as Millionaire
       keeping a room open for Ask the class. */
    wantsVote:   () => bingoOnPhones(),
    roomNote:    () => bingoOnPhones() ? 'cards on phones' : null,
    /* With the cards in their hands the phones have a job already, so the mode does
       not get a say — nine words to tap is the dynamic. With the cards on the board
       this returns null and buzz / everyone-types / type-then-buzz work exactly as
       they do in the other games. */
    phoneRound(){
      if(!bingoOnPhones() || !bingoCurrent) return null;
      return { mode:'card',
               prompt: S.get('phonePrompt', 'bingo') ? (bingoCurrent.clue || bingoCurrent.prompt || '') : '',
               keepSpent:true };
    },
    expects:     () => (bingoCurrent && bingoCurrent.answer) || '',
    phonePrompt: () => (bingoCurrent && (bingoCurrent.clue || bingoCurrent.prompt)) || '',
    askingNow:   () => !!bingoCurrent && !bingoWon,
    /* Typed and correct marks their square, the way it claims a tile elsewhere. A
       word that is not on their card is still a right answer — the strip says so —
       but there is nothing to mark, so it pays nothing rather than declining. */
    onTypedWin(b){
      const card = bingoCards[b.team];
      if(!bingoCurrent || !card) return null;
      const ci = card.words.findIndex((w, i) => !card.marked[i] && w.answer === bingoCurrent.answer);
      return ci >= 0 ? (markBingoCell(b.team, ci) || 1) : 0;
    },
    start(){ startBingo(); },
    fit:      fitBingoCards,
    deal:     bingoDeal,
    tension(){ bingoTension(); },
    onResize: fitBingoCards
  });

  /* Quickfire — the sixth game, and the first with no board at all.
     ==============================================================

     Every other skin is a geometry with a question hidden behind each cell: a tile,
     a hexagon, a rung, a word on a track, a square on a card. There is nothing to
     choose here. Fifteen questions go up in a row against a clock, and the only
     decisions in the room are made on the handsets.

     **It was built as the cheapest possible test of two claims**, and it is worth
     recording which:

     1. *A skin costs almost nothing now.* It writes no question handling at all —
        the Multiple Choice round draws the card, arms the phones, merges each
        team's taps and judges them. What is written here is a sequence, a clock and
        a scoreboard.
     2. *A game can consume a bank rather than author one.* It reads
        `millionaireBank`, which is already `{prompt, answer, distractors}` — exactly
        a multiple choice question — so **three units gained a sixth game with no
        content written at all.** Bingo did this first against `blockbustersBank`;
        this is the second caller, which is what makes it a pattern.

     **What is genuinely this skin's**, and therefore what is actually new code:
     every team scores, and what they score depends on how fast they were. Nothing
     else in the app scores by time. `level` is ignored — a ladder needs difficulty,
     a straight run does not. */
  let kQueue = [], kAt = -1, kCurrent = null, kAsked = 0;
  let kStartedAt = 0, kTick = null, kPaid = null, kOver = false;

  const kSecs      = () => Number(S.get('kSeconds', 'kahoot')) || 20;
  const kBase      = () => Number(S.get('kPoints',  'kahoot')) || 100;
  const kWanted    = () => Number(S.get('kQuestions', 'kahoot')) || 15;
  const kLeft      = () => Math.max(0, kSecs() - (Date.now() - kStartedAt) / 1000);
  const kLive      = () => !!kCurrent && !kOver;

  /* The whole point of the skin, in one function. Full marks for an instant answer,
     half for one that arrives as the clock dies — which is Kahoot's own curve, and
     it is chosen rather than invented: it rewards knowing over guessing without
     making a slow right answer worthless. Rounded to 5 so the scoreboard stays
     readable from the back of a room. */
  function kValue(){
    const frac = kSecs() > 0 ? Math.max(0, Math.min(1, kLeft() / kSecs())) : 1;
    return Math.max(5, Math.round((kBase() * (0.5 + 0.5 * frac)) / 5) * 5);
  }

  registerGame({
    id:'kahoot', title:'Quickfire',
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="21" r="13"/><path d="M20 13 L20 21 L26 25"/><path d="M14 6 L26 6"/><path d="M20 6 L20 8"/></svg>',
      blurb:'Fifteen questions against the clock. Every team answers every one, and the faster you are the more it pays.',
      badge:'Best for: fast revision, everyone in at once' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'QUICKFIRE',
            sub:'Fifteen questions. No turns. The clock is the opponent.', accent:'#2BD9C4' },
    /* Consumed, not authored — see the note above. */
    hasBank: u => (u.millionaireBank || []).length >= 5,
    load(u){ KAHOOT_BANK          = u.millionaireBank || [];
             KAHOOT_SECTION_NAMES = u.millionaireSectionNames || {};
             KAHOOT_TOPIC_NAMES   = u.topicNames || {}; },
    renderContent: renderKahootContent,
    startButton:   kahootStartButton,
    start(){ startKahoot(); },
    fit:       fitKahoot,
    onResize:  fitKahoot,
    /* Rising as the run goes on, so the skin tightens towards the last question
       rather than sitting at one pitch for fifteen of them. */
    tension(){ kTension(); },
    /* The clock is the game, so the header timer running out is not this board's
       business — its own countdown ends each question. */
    expects:     () => (kCurrent && kCurrent.answer) || '',
    phonePrompt: () => (kCurrent && kCurrent.prompt) || '',
    askingNow:   () => kLive(),
    /* Every question is a round, and it is always the same one. The engine builds it
       from the bank the way Millionaire does, so the bank never learns the word
       "choice" and no content was edited to make this game exist. */
    asRound:     q => kAsRound(q),
    phoneRound(){ return jGroupRound(); },
    wantsVote:   () => jGroupLive(),
    onVoteReply(all){ if(jGroupLive()) jGroupOnReplies(all); }
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
      win:  team => jCorrect(team)
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
      win:  team => claimHex(team) || 1
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
    kahoot: {
      game:'kahoot', stage:'play-kahoot',
      /* No clue card here either — the options are the stage, exactly as on the
         Millionaire board. This is the second caller for F3.8.9, which is what makes
         the mount a declared fact rather than Millionaire's private exception. */
      mount: () => document.getElementById('k-options'),
      commit:'k-commit',
      live: () => kLive(),
      turn: () => active,
      /* **The one thing about this skin that is genuinely new.** Every other board
         has a slot that one team takes: a tile, a hexagon, a rung. Here the question
         belongs to nobody, every team answers it, and each is paid for its own
         answer at its own speed. So the settle path pays each right team as it
         settles instead of ending on the first — see `scoreEach` below. */
      scoreEach: true,
      /* The clock is the opponent, so a tap is a commitment. Changing your mind
         after seeing where the room went is the opposite of what this board is
         measuring — and the speed score has already been decided by then. */
      lockIn: true,
      win: team => kPay(team),
      /* Counts, not team dots: on a tile the interesting fact is which team went
         where, and here it is how much of the room got it. */
      countVotes: () => true,
      commitText: () => 'Lock it in'
    }
  };
  const ROUND_GAMES = Object.keys(ROUND_HOSTS);
  let roundHost = ROUND_HOSTS.jeopardy;

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
    label:'Think-music drone', help:'The low pulse under an unanswered question. Off leaves every other sound alone.',
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
  S.register({ id:'typeCooldown', group:'Phones', type:'range', default:3,
    min:0, max:10, step:0.5, unit:'s', games:'*',
    label:'Wait after a wrong answer',
    help:'How long that phone is out before it can buzz again. Nobody loses points; they lose the race.' });

  S.register({ id:'typeStrict', group:'Phones', type:'toggle', default:false,
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
  S.register({ id:'stealFullValue', group:'Competition', type:'toggle', default:false,
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

  S.register({ id:'jTarget', group:'Jeopardy', type:'range', default:60,
    min:0, max:100, step:5, unit:'%', games:['jeopardy'],
    label:'Target to beat',
    help:'How much of the board the class is aiming for. 0 turns the target off and the class simply collects what it can.' });

  S.register({ id:'jHints', group:'Jeopardy', type:'toggle', default:false, games:['jeopardy'],
    label:'The class can ask for a hand',
    help:'A stuck class can buy the first letter, then the length. Each hint costs part of what the clue is worth — progress traded, not points taken.' });

  S.register({ id:'jHintCost', group:'Jeopardy', type:'range', default:30,
    min:10, max:50, step:10, unit:'%', games:['jeopardy'],
    label:'What a hint costs',
    help:'Each hint takes this much off the value of the clue it is used on.' });

  /* A grouping clue is the one clue every team can genuinely play at the same time,
     and whether they should is a teaching decision rather than a number to tune —
     which is what makes it a variant. The whole room racing is the Connections
     dynamic and the reason the clue is worth having; the team on turn alone is the
     ordinary Jeopardy contract, and is the right answer for a class where one team
     is running away with it. Written as a switch because a choice between
     iterations is exactly what a variant is for, and the drawer is where a teacher
     tries the other one between rounds. */
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
    S.register({ id:'round_' + id, type:'variant',
      group: own.group || 'Questions',
      default: def.modes[0].value,
      games: own.games || ROUND_GAMES,
      label: own.label || ('How ' + (def.label || id) + ' is played'),
      variants: def.modes.slice(),
      help: own.help || 'The same question played more than one way. These are different lessons rather than two speeds of the same one, so it is a teaching choice.' });
  });

  S.register({ id:'roundWho', group:'Questions', type:'variant', default:'room',
    games:ROUND_GAMES, label:'Who plays a round',
    variants:[{ value:'room', label:'The whole class races — first team to get it takes the square' },
              { value:'turn', label:'Only the team on turn' }],
    help:'A round asks the room to assemble an answer on their phones. It can be a race between every team, or belong to the team whose turn it is like any other clue.' });

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

  S.register({ id:'jDailyDoubles', group:'Jeopardy', type:'range', default:0,
    min:0, max:3, step:1, unit:' hidden', games:['jeopardy'],
    label:'Daily Doubles',
    help:'Tiles that hide a wager instead of a value. The team that finds one bets before seeing the clue, and answers it alone.' });

  S.register({ id:'jFinalRound', group:'Jeopardy', type:'toggle', default:false, games:['jeopardy'],
    label:'Final clue',
    help:'When the board clears, every team bets what they like on one last clue. A team in last place can still win, so nobody gives up early.' });

  S.register({ id:'jDeduct', group:'Jeopardy', type:'toggle', default:false, games:['jeopardy'],
    label:'Wrong answers cost the value',
    help:'As the show does it — and scores can go negative. Off by default: a class that goes 500 down early stops trying.' });

  S.register({ id:'jAnswerSeconds', group:'Jeopardy', type:'range', default:0,
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
  /* Cards on the board or cards in their hands. The board version is two to four
     cards a class shares and watches; the phone version gives every student their
     own, which is what bingo actually is — and it is the first dynamic where the
     room holds state between questions rather than answering one and forgetting it.
     Board stays the default and the fallback: no relay, no wifi, or phones banned
     that week and the game still runs. */
  S.register({ id:'bingoCards', group:'Bingo', type:'variant', default:'board', games:['bingo'],
    label:'Where the cards live',
    help:'On the board is one card per team, shared. On the phones is one card per student.',
    variants:[
      {value:'board',  label:'On the board — one card per team'},
      {value:'phones', label:'On the phones — one card each'}
    ] });

  S.register({ id:'bingoPoints', group:'Bingo', type:'range', default:1,
    min:1, max:5, step:1, unit:' pts', games:['bingo'],
    label:'Points per square',
    help:'What marking a word off is worth. A line ends the round whatever this is.' });

  /* `'*'`, not a list: this rides on award(), which every game that scores calls,
     so naming the games that existed when it was written left the fifth one out. */
  S.register({ id:'streak', group:'Competition', type:'toggle', default:false,
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

  S.register({ id:'flipSpeed', group:'Clue card', type:'select', default:'normal',
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

  S.register({ id:'bbWinRoute', group:'Blockbusters', type:'variant', default:'trace',
    games:['blockbusters'],
    label:'Winning route', help:'How the completed line is shown when a team connects its two edges.',
    variants:[{value:'trace', label:'Light up along the route'},
              {value:'pulse', label:'Flash the whole route at once'},
              {value:'off',   label:'Just mark it — no animation'}] });

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

  S.register({ id:'intro', group:'Presentation', type:'select', default:'once',
    games:'*',
    label:'Title sequence', help:'The lights-and-logo opening. Any key or click skips it.',
    options:[{value:'once',  label:'Once per session'},
             {value:'every', label:'Every round'},
             {value:'off',   label:'Never'}] });

  /* Quickfire's three weights. All of them are classroom questions rather than
     design ones — how long a C1 class needs to read four options, how many
     questions is a lesson slot rather than an endurance test, and how hard speed
     should be rewarded — so they are ranges in ⚙ rather than numbers in the source.
     Every one is a guess until a class has met them. */
  S.register({ id:'kQuestions', group:'Quickfire', type:'range', default:15,
    min:5, max:30, step:1, unit:'', games:['kahoot'],
    label:'Questions in a run',
    help:'The run ends after this many. Fewer if the sections you picked hold fewer.' });

  S.register({ id:'kSeconds', group:'Quickfire', type:'range', default:20,
    min:5, max:60, step:5, unit:'s', games:['kahoot'],
    label:'Seconds per question',
    help:'How long the room has to read the question and answer it. The clock is the whole game here.' });

  S.register({ id:'kPoints', group:'Quickfire', type:'range', default:100,
    min:20, max:500, step:20, unit:'', games:['kahoot'],
    label:'Points for a right answer',
    help:'What an instant answer pays. One that arrives as the clock dies pays half, and everything in between scales.' });

  S.register({ id:'mLifelines', group:'Millionaire', type:'toggle', default:true, games:['millionaire'],
    label:'Lifelines', help:'50:50, Ask the class, and Confer — one use each per team.' });
  /* The show's beat, not a confirmation dialog: picking an option is the team saying
     a letter out loud, and the reveal waits for the host to ask. The pause is where
     the room gets to shout at them to change it — which is the whole point, so this
     defaults on. Off restores the one-click reveal for a class that needs the pace. */
  S.register({ id:'mFinalAnswer', group:'Millionaire', type:'toggle', default:true, games:['millionaire'],
    label:'Final answer?',
    help:'A picked option locks in highlighted and waits for "Final answer?" before the reveal. The team can change their mind until then. Off reveals on the first click.' });
  /* What a buzz is *for* is a different question in Millionaire than in the tile
     games, and it has no single right answer — which is why it is a variant rather
     than a decision taken here. The ladder is per team and the turn order is fixed
     so that everyone gets a full arc (§9.5), and "fastest thumb wins" cuts straight
     across that. So: does the buzz pick the student, or take the turn?
       speaker — names who answers for the team already on turn; a buzz from the
                 other team is refused and the room re-armed, so the entitled team
                 can still get in. Turn order and both ladders are untouched.
       floor   — whoever buzzes first takes the question and plays it on their own
                 ladder. Fastest thumb, like Jeopardy. Gives up the even arc.
       off     — the buzz shows on the chip and changes nothing on the board. What
                 it did before this setting existed. */
  S.register({ id:'mBuzzRole', group:'Millionaire', type:'variant', default:'speaker',
    games:['millionaire'],
    label:'What a buzz wins',
    help:'Millionaire has a fixed turn order so every team gets a full ladder. This decides whether a buzz picks who speaks for the team on turn, or takes the turn outright.',
    variants:[{value:'speaker', label:'Picks who answers for the team on turn'},
              {value:'floor',   label:'Takes the question — played on their ladder'},
              {value:'off',     label:'Nothing — the buzz is just shown'}] });

  S.register({ id:'mConferSeconds', group:'Millionaire', type:'select', default:30, games:['millionaire'],
    label:'Confer time', help:'How long a team gets to consult when they use Confer.',
    options:[{value:30,label:'30 seconds'},{value:45,label:'45 seconds'},{value:60,label:'60 seconds'}] });

  S.register({ id:'buzzers', group:'Phones', type:'toggle', default:false,
    label:'Phone buzzers', help:'Students join on their phones and buzz to win the right to answer. Needs a relay — this will not work from the GitHub Pages copy. See docs/buzzers.md.' });
  S.register({ id:'buzzerRelay', group:'Phones', type:'text', default:'',
    label:'Relay address', placeholder:'same site as this page',
    help:'Leave empty when the page is being served by the relay itself — which is the simplest setup. Otherwise the https address of a hosted relay.' });

  S.register({ id:'raceRescatter', group:'Race to the Board', type:'toggle', default:true, games:['race'],
    label:'Re-scatter after every claim', help:'Moves the words each time one is won, so nobody wins on memory alone.' });
  S.register({ id:'raceRoundSeconds', group:'Race to the Board', type:'select', default:60, games:['race'],
    label:'Timed round length', help:'Only used in timed team rounds.',
    options:[{value:45,label:'45 seconds'},{value:60,label:'60 seconds'},{value:90,label:'90 seconds'}] });
  S.register({ id:'raceShowSection', group:'Race to the Board', type:'toggle', default:true, games:['race'],
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

    <!-- SCREEN 0: choose unit -->
    <div class="screen" id="screen-unit-select">
      <p class="intro" id="unit-intro">Choose a unit to gamify.</p>
      <div class="unit-grid" id="unit-grid"></div>
    </div>

    <!-- SCREEN 1: choose game -->
    <div class="screen" id="screen-game-select">
      <span class="back-link" id="change-unit" style="display:none;">&larr; Change unit</span>
      <p class="intro"></p>
      <div class="game-grid"></div>
    </div>

    <!-- SCREEN 2: choose content -->
    <div class="screen" id="screen-content-select">
      <span class="back-link" id="back-to-games">&larr; Back to game choice</span>
      <p class="helptext" id="content-helptext"></p>
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
      <div id="buzzer-chip" style="display:none;"></div>
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
        <div id="race-bar">
          <div id="race-status"></div>
          <div id="race-claim">
            <span class="claim-q">Who touched it first?</span>
            <div id="race-claim-teams"></div>
          </div>
          <div class="race-actions">
            <button id="race-start">&#9654; Start</button>
            <button id="race-skip" style="display:none;">Skip this one</button>
          </div>
        </div>
        <div id="race-words"></div>
      </div>
      <div id="play-bingo">
        <div id="bingo-prompt"></div>
        <div id="bingo-bar">
          <div id="bingo-status"></div>
          <div class="bingo-actions">
            <button id="bingo-start">&#9654; First word</button>
            <button id="bingo-skip" style="display:none;">Nobody had it</button>
          </div>
        </div>
        <div id="bingo-cards"></div>
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

      <!-- Quickfire. The first board with no geometry at all: a straight run of
           questions against a clock, so there is nothing to choose and nothing to
           claim. The round mounts into #k-options exactly as it does on the
           Millionaire stage — F3.8.9 again, and this is the second caller that
           proves the mount is a declared fact rather than Millionaire's exception. -->
      <div id="play-kahoot"><div id="k-wrap">
        <div id="k-bar">
          <div id="k-count"></div>
          <div id="k-clock"><span id="k-secs"></span></div>
        </div>
        <div id="k-stage">
          <div id="k-question"></div>
          <div id="k-options"></div>
          <div id="k-foot">
            <span id="k-hint"></span>
            <button id="k-commit" style="display:none;">Lock it in</button>
            <button id="k-next" style="display:none;">Next question</button>
          </div>
        </div>
        <div id="k-board"></div>
      </div></div>
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

    <!-- The docked form of settings: the current game's controls, reachable
         without leaving the round. Same registry, same rows as the panel — this
         is ⚙'s shape while a game is being played. -->
    <div id="lab-drawer">
      <div id="lab-head">
        <span id="lab-title">Settings</span>
        <span>
          <button id="lab-all" type="button">All games</button>
          <button id="lab-close" type="button">Close</button>
        </span>
      </div>
      <div id="lab-body"></div>
      <div id="lab-foot">Changes apply to this game only, and take effect on the next question.</div>
    </div>

    <!-- the join lobby: thrown on the projector so a class can scan in -->
    <div id="join-modal">
      <div id="join-card">
        <div id="join-eyebrow">Scan to join</div>
        <div id="join-qr"></div>
        <div id="join-code"></div>
        <div id="join-url"></div>
        <div id="join-count"></div>
        <button id="join-close" type="button">Close</button>
      </div>
    </div>

    <!-- shared clue modal -->
    <div id="clue-modal">
      <div id="clue-card">
        <div id="clue-front"><span id="clue-front-text"></span></div>
        <div id="clue-back">
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
  /* Quickfire reads Millionaire's bank rather than owning one — see its registration.
     Held separately anyway, because `load()` runs per game and a shared variable
     would tie the two games' content screens together for no gain. */
  let KAHOOT_BANK               = [];
  let KAHOOT_SECTION_NAMES      = {};
  let KAHOOT_TOPIC_NAMES        = {};

  // Which games a unit can actually offer — a unit without a bank for a game
  // simply doesn't show that card, so units can adopt new games one at a time.
  function gamesFor(u){ return GAMES.filter(g => g.hasBank(u)).map(g => g.id); }

  function loadUnit(u){
    UNIT = u;
    GAMES.forEach(g => g.load(u));
    const available = gamesFor(u);
    document.querySelectorAll('.game-card').forEach(c=>{
      c.style.display = available.includes(c.dataset.game) ? 'block' : 'none';
    });
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
  function newTeam(name){ return { name, score:0, run:0 }; }

  /* Teams could be added and never removed, so a class that split four ways one
     lesson carried four teams into the next one. Removing is more than a splice,
     because a team's *index* is its identity in three other places:
       - `active`, which has to follow the team it pointed at rather than the slot;
       - `mState`, Millionaire's per-team ladder, which is a parallel array;
       - `bbSideAt`, which team is up within each Blockbusters alliance.
     Two is the floor: every board is built for at least two sides. */
  function removeTeam(i){
    if(teams.length <= 2 || !teams[i]) return;
    // points are a lesson's worth of work — a mis-tap must not silently bin them
    if(teams[i].score !== 0 &&
       !confirm('Remove ' + teams[i].name + '? They have ' + teams[i].score + ' points.')) return;
    teams.splice(i, 1);
    if(Array.isArray(mState)) mState.splice(i, 1);
    if(active > i) active--;
    if(active >= teams.length) active = teams.length - 1;
    bbSideAt = [0, 0];
    renderScorebar();
    if(activeGame === 'blockbusters'){ renderBBTurn(); renderBBVote(); }
    hook('onResize');
  }

  // shared team roster — persists across games AND unit switches until Reset
  let teams = [newTeam('Team 1'), newTeam('Team 2')];
  let active = 0;   // jeopardy: selected/active team index
  let bbTurn = 0;   // blockbusters: whose turn (0 = Yellow/teams[0], 1 = Blue/teams[1])

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    hideResult();                       // a banner belongs to the round that raised it
    document.getElementById('new-game-btn').style.display = (id==='screen-play') ? 'inline-block' : 'none';
    if(id!=='screen-play') closeLab();
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
  function showResult(cfg){
    const modal = document.getElementById('result-modal');
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
    if(e.key==='Escape') hideResult();
  });

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
    S.setContext(activeGame);          // ⚙ opens on this game's tab from here on
    document.getElementById('page-title').textContent = HUB_GAME_TITLES[activeGame] || 'Game Hub';
    renderContentScreen();
    showScreen('screen-content-select');
  }
  renderGameCards();

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
    activeGame=null; selectedContent=[]; pool=[]; raceRunning=false;
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
    // head-to-head has no "whose turn" — both teams are at the board at once
    const hi = !playing ? -1
             /* the *team* playing this turn, which is only the side index while
                there are two teams — with four it rotates within each side */
             : (activeGame==='blockbusters') ? bbTeamOnTurn()
             : (activeGame==='race' && raceMode==='h2h') ? -1
             : active;
    const step = (activeGame==='jeopardy' || activeGame==='millionaire') ? 100 : 1;   // manual +/- correction step
    teams.forEach((t, i)=>{
      const el=document.createElement('div'); el.className='team'+(i===hi?' active':'');
      // in Blockbusters every team wears its *side's* colour, not just the first two
      const dot = (activeGame==='blockbusters')
        ? `<span class="dot" style="background:${bbSideOf(i)===0?'var(--yellow)':'var(--blue)'}"></span>` : '';
      // two is the floor — every board is built for at least two sides — so the
      // remove button only appears above it, and it never appears on the last two
      const del = teams.length > 2 ? `<button class="tdel" title="Remove team">×</button>` : '';
      el.innerHTML = `${dot}<input class="tname" value="${t.name}"><button class="minus">−</button><span class="score">${t.score}</span><button class="plus">+</button>${del}`;
      el.addEventListener('click', (ev)=>{
        if(ev.target.closest('button') || ev.target.classList.contains('tname')) return;
        active = i; renderScorebar();
      });
      el.querySelector('.tname').addEventListener('change', e=>{ t.name = e.target.value; pushTeamNames(); });
      el.querySelector('.minus').addEventListener('click', ()=>{ t.score-=step; renderScorebar(); renderClassLine(); });
      el.querySelector('.plus').addEventListener('click', ()=>{ t.score+=step; renderScorebar(); renderClassLine(); });
      const delBtn = el.querySelector('.tdel');
      if(delBtn) delBtn.addEventListener('click', ()=> removeTeam(i));
      bar.appendChild(el);
    });
    const addBtn=document.createElement('button'); addBtn.id='add-team-btn'; addBtn.textContent='+ Team';
    addBtn.addEventListener('click', ()=>{ teams.push(newTeam('Team '+(teams.length+1))); renderScorebar(); });
    bar.appendChild(addBtn);
    // icon-only in the header: the words cost more room than the button is worth,
    // and the tooltip still says what it does
    const resetBtn=document.createElement('button'); resetBtn.className='reset-btn';
    resetBtn.textContent='↺'; resetBtn.title='Reset points';
    resetBtn.addEventListener('click', ()=>{ teams.forEach(t=>{ t.score=0; t.run=0; }); renderScorebar(); renderClassLine(); });
    bar.appendChild(resetBtn);
    // adding a team, or renaming one, has to reach the phones — this is the one
    // place that runs on any change to the list, and the push skips a no-op
    pushTeamNames();
  }

  function nextTurn(){ if(teams.length){ active=Kit.passTurn(teams.length, active); renderScorebar(); } }

  /* What to call a team when it has to be named in prose — a strip chip, a dot's
     tooltip, a board saying who just took a tile. A team index can outrun the list
     (a reply from a handset still holding a team that has since been removed), so
     this never returns undefined. */
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
    let value = (o.steal && !S.get('stealFullValue', activeGame)) ? base / 2 : base;
    /* The run is counted *before* this answer, so award() is always called before
       markRun(): the first answer of a streak pays face value, the second 1.5x and
       the third double. Marking first made the very first answer pay a bonus for a
       run that had not happened yet. */
    if(o.streak !== false && S.get('streak', activeGame)) value *= runMultiplier(t.run);
    /* Round to 50s, not 100s, in the games that score in hundreds. Half of a $100
       tile is 50, and rounding that to the nearest 100 hands back the full value —
       the steal was silently paying the same as answering it correctly. Every value
       these two games produce (halves of 100–500 and of the ladder, times 1.5 or 2)
       is already a multiple of 50, so this rounds nothing away. */
    const step = (activeGame==='jeopardy' || activeGame==='millionaire') ? 50 : 1;
    value = Math.max(step, Math.round(value / step) * step);
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
    const cats = JEOPARDY_CATEGORIES.filter(c=>selectedContent.includes(c.id));
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
  function jDeal(){
    const board = document.getElementById('board');
    if(!document.getElementById('play-jeopardy').classList.contains('lit') || !motionOK()) return;
    // stagger on the diagonal, not on DOM order: a 12x6 board is 72 cells, so a flat
    // stagger takes 3 seconds and the class is waiting on it. Row+column caps the
    // wave at rows+columns steps — under a second — and reads as a sweep across the
    // board rather than a queue.
    const cols = Math.max(1, board.querySelectorAll('.cat-header').length);
    [...board.children].forEach((el, i)=>
      el.style.setProperty('--i', Math.floor(i/cols) + (i % cols)));
    board.classList.remove('dealing'); void board.offsetWidth;
    board.classList.add('dealing');
    setTimeout(()=>board.classList.remove('dealing'), 1600);
  }

  /* ---- Jeopardy's tension curve ----
     Millionaire has a ladder; Jeopardy's equivalent is what's at stake on the tile
     in play, with a slow floor that rises as the board empties. So a $500 clue
     late in a game is the brightest, hottest moment on the board, and an opening
     $100 is the coolest — which is what the show's lighting actually does.
     Same `--tension` contract as Millionaire, so the CSS is shared. */
  function jValueRange(){
    const vals = [];
    JEOPARDY_CATEGORIES.filter(c=>selectedContent.includes(c.id))
      .forEach(c=>c.clues.forEach(cl=>vals.push(cl.v)));
    return vals.length ? { lo:Math.min(...vals), hi:Math.max(...vals) } : { lo:0, hi:1 };
  }
  function jTension(atStake){
    const stage = document.getElementById('play-jeopardy');
    const on = themeOf('jeopardy')==='gameshow' && activeGame==='jeopardy';
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return; }

    const tiles = [...document.querySelectorAll('#board .tile')];
    const done  = tiles.filter(t=>t.classList.contains('used')).length;
    const floor = tiles.length ? done/tiles.length : 0;

    let stake = 0;
    if(atStake){
      const { lo, hi } = jValueRange();
      stake = hi > lo ? (atStake - lo)/(hi - lo) : 1;
    }
    const t = Math.min(1, 0.45*floor + 0.55*stake);
    stage.style.setProperty('--tension', t.toFixed(3));

    // think music while a clue is on the table and unanswered — the show's own
    // habit, and the reason a class stops talking and starts thinking
    if(atStake && motionOK()) Sound.bedStart(t);
    else Sound.bedStop();
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

  /* The teacher's own set, judged by the same function a team's is. Right lights the
     four and takes the tile for whoever is on turn; wrong shakes them and costs
     nothing, exactly as it costs a team nothing. */
  /* The teacher's own answer, judged. A function rather than a button handler,
     because two buttons reach it now: the clue card's Check, and Millionaire's
     "Final answer?" — the same beat wearing the show's clothes. */
  function roundCommit(){
    /* `jRoundCap()`, not the whole answer: an ordering climb asks for one word at a
       time, so guarding on the full scale meant the button could be pressed and
       silently did nothing. */
    if(!jGroupLive() || jGroup.chosen.length !== jRoundCap()) return;
    const def = jRoundDef();
    /* The teacher's own answer, which deliberately does not go through `read()` — so
       a round that holds a rung until every handset agrees does not hold *this* one.
       A class with one phone in a drawer has to stay playable, and the teacher is the
       authority when they click. */
    const ctx = jGroupCtx();
    /* Who a teacher's own answer scores for. `active` by default, which is what the
       two card boards have always done — a round arriving did not change whose
       answer the teacher was entering. Millionaire needs its own, because after a
       steal the question belongs to a team that is not `active`, and that is exactly
       the moment the difference shows. */
    const team = roundHost.scorer ? roundHost.scorer() : active;
    const r = def.judge(jGroup.chosen, jGroup, team, ctx);
    if(r.verdict === 'right'){
      def.accept(jGroup.chosen.slice(), jGroup, team, ctx);
      jGroup.chosen = [];
      if(r.done !== false || jGroup.done){ jGroupTake(team); return; }
      jGroup.say = 'Yes — keep going.';
      Sound.play('correct');
      renderJGroup();
      if(buzzHost) askPhones(currentClueItem.text, roundHost.game);
      return;
    }
    /* A wrong answer costs nothing on a tile or a hexagon — the other team is the
       pressure. On a ladder it ends the go, which is the show's whole tension, so
       the host is asked first and only boards with no opinion fall through. */
    if(roundHost.miss && roundHost.miss(team, r)) return;
    jGroup.say = def.saidOf('Not that', r, jGroup).replace(/^Not that: /, '');
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
    setTimeout(()=>{ if(jGroupLive()){ jGroup.chosen = []; renderJGroup(); } }, 380);
    renderJGroup();
  }
  document.getElementById('group-btn').addEventListener('click', roundCommit);

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
    hub:     { jDailyDoubles:0, jFinalRound:false, jDeduct:false,
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
    classic: { jDailyDoubles:1, jFinalRound:true,  jDeduct:true,
               jTogether:false, jHints:false, round_default:'buzz',
               stealOnWrong:true, stealFullValue:true, keepControl:true, jAnswerSeconds:10 },
    /* Everything that sets one team against another is off here, and that is the
       whole mode: no hidden wager to find first, no steal, nothing deducted, no
       final round to overtake anyone in. What is left is the board and the room —
       and everyone types, because a clue paying what the class produced is the
       cooperative mechanic rather than a race anybody can lose. */
    together:{ jDailyDoubles:0, jFinalRound:false, jDeduct:false,
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
  function renderContentScreen(){
    const list = document.getElementById('content-list');
    const help = document.getElementById('content-helptext');
    const rulesNote = document.getElementById('blockbusters-rules');
    const raceNote  = document.getElementById('race-rules');
    list.innerHTML='';
    selectedContent=[];
    raceNote.style.display='none';
    document.getElementById('race-mode').style.display='none';

    rulesNote.style.display='none';        // a game that wants it turns it on
    const g = gameDef();
    if(g) g.renderContent(list, help);
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

  function groupCheckboxes(list, bank, topicNames, sectionNames){
    const seen = [];
    bank.forEach(i=>{ const g = groupOf(i); if(g && seen.indexOf(g) === -1) seen.push(g); });
    // keep the reading order of the bank, which is section order
    seen.sort();
    seen.forEach(g=>{
      const items = bank.filter(i => groupOf(i) === g);
      const n = items.length;
      const label = (topicNames && topicNames[g]) ||
                    (sectionNames && sectionNames[g] && sectionNames[g].split('·').slice(1).join('·').replace(/\s*\(\d+[^)]*\)\s*$/, '')) ||
                    g;
      const sec = String(g).split('-')[0];
      const div = document.createElement('label');
      div.className = 'cat-check';
      div.innerHTML = `<input type="checkbox" value="${g}"><span class="tag">${sec}</span>` +
                      `<span class="name">${label} <em>(${n})</em></span>` + kindChip(items);
      div.querySelector('input').addEventListener('change', onContentToggle);
      list.appendChild(div);
    });
  }

  function sectionCheckboxes(list, names){
    Object.keys(names).forEach(sec=>{
      const div=document.createElement('label');
      div.className='cat-check';
      div.innerHTML = `<input type="checkbox" value="${sec}"><span class="tag">${sec}</span><span class="name">${names[sec].split('·')[1]}</span>`;
      div.querySelector('input').addEventListener('change', onContentToggle);
      list.appendChild(div);
    });
  }

  function renderJeopardyContent(list, help){
    help.textContent = "Pick which categories to include — the board builds itself from your selection (choose at least 3).";
    let lastSection=null;
    JEOPARDY_CATEGORIES.forEach(cat=>{
      if(cat.section!==lastSection){
        const label=document.createElement('div');
        label.className='section-label';
        label.textContent = JEOPARDY_SECTION_LABELS[cat.section] || cat.section;
        list.appendChild(label);
        lastSection=cat.section;
      }
      const div=document.createElement('label');
      div.className='cat-check';
      div.innerHTML = `<input type="checkbox" value="${cat.id}"><span class="tag">${cat.section}</span>` +
                      `<span class="name">${cat.name}</span>` + kindChip(cat.clues);
      div.querySelector('input').addEventListener('change', onContentToggle);
      list.appendChild(div);
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

  function jeopardyStartButton(btn){
    btn.disabled = selectedContent.length < 3;
    btn.textContent = selectedContent.length < 3
      ? `Select at least 3 categories to build the board (${selectedContent.length} chosen)`
      : `Build board with ${selectedContent.length} categories`;
  }

  function blockbustersStartButton(btn){
    const total = BLOCKBUSTERS_BANK.filter(c=>selectedContent.includes(groupOf(c))).length;
    btn.disabled = selectedContent.length===0 || total < 18;
    btn.textContent = selectedContent.length===0 ? 'Select at least one section'
      : total < 18 ? `Need 18 clues for a full board — ${total} selected, add another topic`
      : `Build board — 18 of ${total} clues, shuffled`;
  }

  function millionaireStartButton(btn){
    const pool = MILLIONAIRE_BANK.filter(q=>selectedContent.includes(groupOf(q)));
    const rungs = new Set(pool.map(q=>q.level));
    const missing = M_LADDER.map((_,i)=>i+1).filter(l=>!rungs.has(l));
    btn.disabled = selectedContent.length===0 || missing.length>0;
    btn.textContent = selectedContent.length===0 ? 'Select at least one section'
      : missing.length ? `Not enough for a full ladder — nothing at level ${missing.join(', ')}`
      : `Build ladder — ${pool.length} questions across 8 rungs`;
  }

  function raceStartButton(btn){
    const total = RACE_BANK.filter(c=>selectedContent.includes(groupOf(c))).length;
    btn.disabled = total < RACE_MIN_WORDS;
    btn.textContent = selectedContent.length===0 ? 'Select at least one section'
      : total < RACE_MIN_WORDS ? `Need ${RACE_MIN_WORDS} words for a board — ${total} selected, add another topic`
      : `Build board — ${Math.min(total, RACE_MAX_WORDS)} of ${total} words, shuffled`;
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
  const BB_ROWS = [5,4,5,4];       // the classic board

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

    hexes.forEach(hex=>{
      const r = +hex.dataset.row, c = +hex.dataset.col;
      const rowW   = BB_ROWS[r] * colStep - gap;
      const startX = (boardW - rowW) / 2;
      hex.style.left = (startX + c*colStep) + 'px';
      hex.style.top  = (r*rowStep) + 'px';
    });

    wrap.style.width  = boardW + 'px';
    wrap.style.height = ((BB_ROWS.length-1)*rowStep + h) + 'px';
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
    const stage = document.getElementById('play-blockbusters');
    const on = themeOf('blockbusters')==='gameshow' && activeGame==='blockbusters';
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return; }

    // the shortest line anyone could ever need: blue's four rows beats yellow's five
    const shortest = Math.min(BB_WIDEST, BB_ROWS.length);
    const need = Math.min(bbStepsToWin(0), bbStepsToWin(1));
    const t = !isFinite(need) ? 0
            : need >= shortest ? 0
            : (shortest - need) / (shortest - 1);
    stage.style.setProperty('--tension', Math.max(0, Math.min(1, t)).toFixed(3));

    if(clueOpen && motionOK()) Sound.bedStart(t);
    else Sound.bedStop();
  }

  /* The honeycomb builds itself rather than appearing. Staggered on row+col, the
     same diagonal wave Jeopardy deals with, so it reads as the board assembling. */
  function bbDeal(){
    const wrap = document.getElementById('hexwrap');
    if(!document.getElementById('play-blockbusters').classList.contains('lit') || !motionOK()) return;
    [...wrap.querySelectorAll('.hex')].forEach(hex=>
      hex.style.setProperty('--i', (+hex.dataset.row) + (+hex.dataset.col)));
    wrap.classList.remove('dealing'); void wrap.offsetWidth;
    wrap.classList.add('dealing');
    setTimeout(()=>wrap.classList.remove('dealing'), 1600);
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
    pool = shuffle(BLOCKBUSTERS_BANK.filter(c=>selectedContent.includes(groupOf(c)))).slice(0, 18);
    buildBlockbustersBoard();
    bbTurn=0; bbSideAt=[0,0]; renderBBTurn();
    bbVote=null; bbVoting=false; renderBBVote();
    bbTension(); bbDeal();
  }

  /* ================= BINGO =================
     The fifth game, and deliberately the first one written *after* the framework
     settled — so what it had to reach into is the measure of how well the framework
     ports. It scores, times, skins, fits, ends and talks to the phones through the
     shared layer; what it owns is a card, a call and a line.

     Its content is not its own. `blockbustersBank` is already a list of
     single-word answers with a clue each, which is exactly what a bingo call is,
     so both units gained this game with no authoring. */
  let BINGO_BANK = [], BINGO_SECTION_NAMES = {}, BINGO_TOPIC_NAMES = {};
  const BINGO_SIZE = 3;                 // 3x3 card, so a line is three
  const BINGO_POOL = 12;                // shared words in play: 9 per card + spares
  let bingoWords   = [];                // the words in play this round
  let bingoCards   = [];                // per team: { words:[…], marked:[bool…] }
  let bingoCurrent = null;              // the call on the table
  let bingoQueue   = [];
  let bingoWon     = null;
  let bingoRunning = false;

  /* A word can only be a bingo call if it is one word and unique in the round —
     two cells reading the same thing makes "mark it off" ambiguous. Same class of
     constraint as Race's board, and it lives with the game that needs it rather
     than in the content. */
  function bingoWordsIn(bank){
    const seen = new Set();
    return bank.filter(c => {
      const a = String(c.answer || '').trim();
      if(!a || /\s/.test(a)) return false;
      const k = a.toLowerCase();
      if(seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  function renderBingoContent(list, help){
    help.textContent = "Pick the topics that feed the cards. Every team gets nine of the same pool of words, so the same clue can be worth marking for more than one of them — the first to answer takes it.";
    groupCheckboxes(list, bingoWordsIn(BINGO_BANK), BINGO_TOPIC_NAMES, BINGO_SECTION_NAMES);
  }

  function bingoStartButton(btn){
    const total = bingoWordsIn(BINGO_BANK).filter(c => selectedContent.includes(groupOf(c))).length;
    btn.disabled = selectedContent.length === 0 || total < BINGO_POOL;
    btn.textContent = selectedContent.length === 0 ? 'Select at least one section'
      : total < BINGO_POOL ? `Need ${BINGO_POOL} words — ${total} selected, add another topic`
      : `Deal the cards — ${BINGO_POOL} of ${total} words`;
  }

  function startBingo(){
    const pool = shuffle(bingoWordsIn(BINGO_BANK).filter(c => selectedContent.includes(groupOf(c))));
    bingoWords = pool.slice(0, BINGO_POOL);
    dealBingoCards();
    bingoQueue   = shuffle(bingoWords.slice());
    bingoCurrent = null;
    bingoWon     = null;
    bingoRunning = false;
    bingoHands = new Map();
    if(bingoOnPhones()){ bingoDealHands(); renderBingoRoom(); }
    else buildBingoCards();
    setBingoMessage(bingoOnPhones()
      ? 'Cards are on the phones. Press First word when the class is ready.'
      : 'Press First word when the class is ready.');
    document.getElementById('bingo-start').style.display = 'inline-block';
    document.getElementById('bingo-skip').style.display  = 'none';
    document.getElementById('bingo-prompt').classList.remove('live');
    document.getElementById('bingo-prompt').textContent = '';
    syncBuzzRoom();
    timerSetDuration(30);
  }

  /* Every team gets nine of the same pool, shuffled — so the cards overlap and a
     call is usually live for more than one team, which is what makes it a race
     rather than a set of parallel solitaires. Re-dealt on a team being added or
     removed, because a card without a team is not a thing. */
  function dealBingoCards(){
    bingoCards = teams.map(() => {
      const words = shuffle(bingoWords.slice()).slice(0, BINGO_SIZE * BINGO_SIZE);
      return { words, marked: words.map(() => false) };
    });
  }

  /* The call goes out as a `card` round: every phone shows its own nine words and
     taps one. `phonePrompt` still decides whether the clue travels with it — off is
     arguably the better lesson, because then it is listening rather than reading. */
  function askBingoCards(w){
    if(!buzzHost) return;
    bingoDealHands();
    // the shared path: `phoneRound` above tells it this is a card round
    askPhones(w.clue || w.prompt || '', 'bingo');
  }

  function buildBingoCards(){
    const wrap = document.getElementById('bingo-cards');
    wrap.innerHTML = '';
    if(bingoCards.length !== teams.length) dealBingoCards();
    teams.forEach((t, ti) => {
      const card = document.createElement('div');
      card.className = 'bingo-card';
      card.dataset.team = ti;
      const head = document.createElement('div');
      head.className = 'bingo-name';
      head.textContent = t.name;
      const grid = document.createElement('div');
      grid.className = 'bingo-grid';
      bingoCards[ti].words.forEach((w, ci) => {
        const cell = document.createElement('button');
        cell.className = 'bingo-cell' + (bingoCards[ti].marked[ci] ? ' marked' : '');
        cell.type = 'button';
        cell.textContent = w.answer;
        cell.dataset.team = ti; cell.dataset.cell = ci;
        cell.addEventListener('click', () => onBingoCell(ti, ci));
        grid.appendChild(cell);
      });
      card.appendChild(head); card.appendChild(grid);
      wrap.appendChild(card);
    });
    fitBingoCards();
  }

  function setBingoMessage(txt){
    document.getElementById('bingo-status').textContent = txt;
  }

  function setBingoPrompt(item){
    const el = document.getElementById('bingo-prompt');
    el.innerHTML = '';
    if(!item){ el.classList.remove('live'); return; }
    el.classList.add('live');
    const sec = document.createElement('span'); sec.className = 'bingo-sec';
    sec.textContent = item.section || '';
    const body = document.createElement('span'); body.className = 'bingo-clue';
    // the shared renderer, so a gap fill or an anagram draws here exactly as it
    // does on the other four boards — this game wrote no prompt code at all
    drawPrompt(body, { text:item.clue || item.prompt, answer:item.answer, type:item.type }, 'bingo');
    el.appendChild(sec); el.appendChild(body);
  }

  /* A call is only worth making while somebody could still mark it — which is the
     cards on the board, or the cards in their hands, depending on where they are. */
  function bingoLiveFor(word){
    const held = bingoOnPhones() ? [...bingoHands.values()] : bingoCards;
    return held.some(c => c.words.some((w, i) => !c.marked[i] && w.answer === word.answer));
  }

  /* A word stays in the bag while anybody could still use it, so a call nobody took
     comes round again rather than being spent. Without this a class of thirty runs
     out of calls long before anybody has a line. */
  function bingoRequeue(word){
    if(word && bingoLiveFor(word) && bingoQueue.indexOf(word) === -1) bingoQueue.push(word);
  }

  function nextBingoCall(){
    bingoRequeue(bingoCurrent);
    while(bingoQueue.length){
      const w = bingoQueue.shift();
      if(bingoLiveFor(w)){
        bingoCurrent = w;
        bingoRunning = true;
        setBingoPrompt(w);
        setBingoMessage('Who has it? Click the word on their card.');
        document.getElementById('bingo-start').style.display = 'none';
        document.getElementById('bingo-skip').style.display  = 'inline-block';
        if(bingoOnPhones()){
          askBingoCards(w);
          /* On phones a call is not a race: everybody holding that word marks it,
             so the call stays open and the teacher moves on when the room has had
             long enough. On the board it *is* a race — one team gets the square —
             so there the call closes as soon as somebody takes it. */
          document.getElementById('bingo-start').style.display = 'inline-block';
          document.getElementById('bingo-start').textContent   = '▶ Next word';
          document.getElementById('bingo-skip').style.display  = 'none';
          setBingoMessage('Everyone who has it, tap it. Next word when you are ready.');
        } else {
          askPhones(w.clue || w.prompt || '', 'bingo');
        }
        Sound.play('reveal');
        bingoTension();
        return;
      }
    }
    // everything on every card is marked and nobody has a line
    bingoCurrent = null; bingoRunning = false;
    setBingoPrompt(null);
    setBingoMessage('Every word has gone and no one has a line.');
    document.getElementById('bingo-skip').style.display = 'none';
    bingoFinish({ type:'blocked' });
  }

  /* ---- cards in their hands ----
     The board version is two to four cards a class shares and watches; this gives
     every student their own, which is what bingo actually is and what fixes the
     weakness it shares with Blockbusters — two people play and the rest watch.

     Three rules it is built on:
     - **The host deals and the host judges.** The relay stores a card so a phone
       that drops off the wifi gets it back with its marks, but it is never told
       which word the clue means, exactly as it is never told a typed answer.
     - **A tap is a typed answer without the typing**, so it arrives through the
       same path as `write` and is judged by `Kit.answer.judge` against `expects()`.
     - **A student's line scores for their team**, so the team bar and everything
       hanging off it stays true rather than needing a parallel system. */
  let bingoHands = new Map();   // playerId -> { name, team, words:[…], marked:[…] }

  function bingoOnPhones(){
    return activeGame === 'bingo' && S.get('bingoCards', 'bingo') === 'phones';
  }

  function bingoDealHands(){
    if(!bingoOnPhones() || !buzzHost || !bingoWords.length) return;
    const roster = buzzHost.players();
    const out = {};
    let dealt = 0;
    roster.forEach(p => {
      if(bingoHands.has(p.id)){
        // already holding a card: keep it, or a late joiner would reshuffle the room
        const h = bingoHands.get(p.id);
        h.name = p.name; h.team = p.team;
        return;
      }
      const words = shuffle(bingoWords.slice()).slice(0, BINGO_SIZE * BINGO_SIZE);
      bingoHands.set(p.id, { name:p.name, team:p.team, words, marked:words.map(()=>false) });
      out[p.id] = words.map(w => w.answer);
      dealt++;
    });
    if(dealt) buzzHost.deal(out);
    renderBingoRoom();
  }

  /* A tap, judged. Right marks their square and scores for their team; wrong costs
     nothing but a moment, the same trade the typing race makes. */
  function onBingoTap(r){
    if(!bingoOnPhones() || !bingoCurrent || bingoWon) return false;
    const hand = bingoHands.get(r.id);
    if(!hand) return false;
    const verdict = Kit.answer.judge(r.value, bingoCurrent.answer);
    const ok = verdict === 'right' || (verdict === 'close' && !S.get('typeStrict', 'bingo'));
    if(!ok){
      buzzHost.nope(r.id, r.value);
      notePhoneMiss(hand.name, hand.team, r.value, verdict);
      return true;
    }
    const i = hand.words.findIndex((w, n) => !hand.marked[n] && w.answer === bingoCurrent.answer);
    if(i === -1){ buzzHost.nope(r.id, r.value); return true; }
    hand.marked[i] = true;
    buzzHost.mark(r.id, hand.words[i].answer);
    const paid = award(hand.team, Number(S.get('bingoPoints', 'bingo')) || 1, {}) || 1;
    notePhoneScore(hand.name, hand.team, r.value, paid);
    Sound.play('claim');
    const line = bingoHandLine(hand);
    if(line){ bingoFinishHand(r.id, hand, line); return true; }
    renderBingoRoom();
    bingoTension();
    return true;
  }

  function bingoHandLine(hand){
    return bingoLines().find(line => line.every(i => hand.marked[i])) || null;
  }

  function bingoFinishHand(id, hand, line){
    bingoWon = { type:'win', player:id, hand, line, team:hand.team };
    bingoRunning = false;
    renderBingoRoom();          // the winning card's own progress was a call behind
    document.getElementById('bingo-skip').style.display  = 'none';
    document.getElementById('bingo-start').style.display = 'none';
    /* Disarm, don't reset. A reset clears the cards off every phone — and the first
       thing that happens after a line is the teacher reading it back off the
       winner's card, which is hard to do when their phone has just gone blank. The
       cards clear on New cards, which is where a new round starts. */
    buzzWinner = null;
    if(buzzHost) buzzHost.disarm();
    renderBuzzChip();
    const lit = document.getElementById('play-bingo').classList.contains('lit');
    if(lit){ Sound.fanfare(); setTimeout(() => Sound.applause(2400), 620); }
    else Sound.play('clear');
    showResult({
      eyebrow:'Bingo',
      title: hand.name + ' has a line!',
      // the teacher reads the card back, which is what bingo has always done and is
      // a speaking beat rather than dead time
      sub:   'Playing for ' + (teams[hand.team] ? teams[hand.team].name : 'their team') +
             ' — check the card: ' + line.map(i => hand.words[i].answer).join(', '),
      tone:  hand.team === 0 ? 'gold' : 'silver',
      actions:[{ label:'New cards', primary:true, onPick:bingoPlayAgain },
               { label:'Leave it up', onPick:function(){} }]
    });
  }

  /* With thirty cards there is nothing useful to draw of them, so the board shows
     what the room needs: how many have it, and who is one square away. */
  function renderBingoRoom(){
    const wrap = document.getElementById('bingo-cards');
    if(!bingoOnPhones()){ return; }
    wrap.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'bingo-room';
    const hands = [...bingoHands.values()];
    if(!hands.length){
      panel.innerHTML = '<p class="bingo-room-note">Cards are dealt as students join. ' +
                        'Nobody has one yet.</p>';
      wrap.appendChild(panel);
      return;
    }
    const close = hands.map(h => ({ h, best: Math.max.apply(null,
      bingoLines().map(l => l.filter(i => h.marked[i]).length)) }))
      .sort((a, b) => b.best - a.best);
    const head = document.createElement('div');
    head.className = 'bingo-room-head';
    head.textContent = hands.length + (hands.length === 1 ? ' card in play' : ' cards in play');
    panel.appendChild(head);
    const list = document.createElement('div');
    list.className = 'bingo-room-list';
    close.slice(0, 12).forEach(({ h, best }) => {
      const chip = document.createElement('span');
      chip.className = 'bingo-room-chip team-' + Math.min(h.team, 3) + (best >= BINGO_SIZE - 1 ? ' hot' : '');
      chip.textContent = h.name + ' · ' + best + '/' + BINGO_SIZE;
      list.appendChild(chip);
    });
    panel.appendChild(list);
    wrap.appendChild(panel);
    fitBingoCards();
  }

  /* A test hook, not a game feature: the answer to the call is deliberately not in
     the DOM (the class has to work it out), so a scripted round has no other way to
     know which square is the right one. */
  // a test hook: the re-ask path is what a reconnection triggers, and it is the
  // one that used to replace a card with a buzzer
  window.__reask = function(){ reaskPhones(); };
  window.__bingoAnswer = function(){ return bingoCurrent ? bingoCurrent.answer : null; };
  window.__bingoProbe = function(){
    if(!bingoCurrent || !bingoCards[0]) return -1;
    return bingoCards[0].words.findIndex((w, i) => !bingoCards[0].marked[i] && w.answer === bingoCurrent.answer);
  };

  function onBingoCell(ti, ci){
    if(bingoWon) return;
    const card = bingoCards[ti];
    if(!card || card.marked[ci]) return;
    if(!bingoCurrent){ setBingoMessage('Press First word to make a call.'); return; }
    if(card.words[ci].answer !== bingoCurrent.answer){
      // a wrong square costs nothing — the call stays up and another team can take it
      const el = document.querySelector(`.bingo-cell[data-team="${ti}"][data-cell="${ci}"]`);
      if(el){ el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 420); }
      Sound.play('wrong');
      return;
    }
    markBingoCell(ti, ci);
  }

  function markBingoCell(ti, ci){
    const card = bingoCards[ti];
    card.marked[ci] = true;
    const el = document.querySelector(`.bingo-cell[data-team="${ti}"][data-cell="${ci}"]`);
    if(el) el.classList.add('marked');
    const paid = award(ti, Number(S.get('bingoPoints', 'bingo')) || 1, {});
    markRun(ti, true);
    Sound.play('claim');
    active = ti; renderScorebar();
    const line = bingoLine(ti);
    if(line){ bingoFinish({ type:'win', team:ti, line }); return paid; }
    bingoCurrent = null; bingoRunning = false;
    setBingoPrompt(null);
    setBingoMessage('Marked. Next word when you are ready.');
    document.getElementById('bingo-start').style.display = 'inline-block';
    document.getElementById('bingo-start').textContent   = '▶ Next word';
    document.getElementById('bingo-skip').style.display  = 'none';
    resetBuzzers();
    bingoTension();
    return paid;
  }

  /* Rows, columns and both diagonals of a BINGO_SIZE square, worked out from the
     size rather than written down — the same reason Blockbusters' adjacency comes
     from BB_ROWS. Change the card to 4x4 and the win logic follows. */
  function bingoLines(){
    const n = BINGO_SIZE, out = [];
    for(let r = 0; r < n; r++) out.push(Array.from({length:n}, (_, c) => r*n + c));
    for(let c = 0; c < n; c++) out.push(Array.from({length:n}, (_, r) => r*n + c));
    out.push(Array.from({length:n}, (_, i) => i*n + i));
    out.push(Array.from({length:n}, (_, i) => i*n + (n-1-i)));
    return out;
  }
  function bingoLine(ti){
    const card = bingoCards[ti];
    if(!card) return null;
    return bingoLines().find(line => line.every(i => card.marked[i])) || null;
  }
  // how close the nearest team is to a line, as 0..1 — the tension source
  function bingoBest(){
    let best = 0;
    bingoCards.forEach(card => {
      bingoLines().forEach(line => {
        const got = line.filter(i => card.marked[i]).length;
        if(got > best) best = got;
      });
    });
    return best;
  }

  function bingoFinish(outcome){
    bingoWon = outcome;
    bingoRunning = false;
    document.getElementById('bingo-skip').style.display  = 'none';
    document.getElementById('bingo-start').style.display = 'none';
    resetBuzzers();
    if(outcome.type !== 'win'){
      Sound.play('end');
      showResult({ eyebrow:'Bingo', title:'Cards full', sub:'Every word has gone without a line.',
                   actions:[{ label:'New cards', primary:true, onPick:bingoPlayAgain }] });
      return;
    }
    outcome.line.forEach(i => {
      const el = document.querySelector(`.bingo-cell[data-team="${outcome.team}"][data-cell="${i}"]`);
      if(el) el.classList.add('line');
    });
    const lit = document.getElementById('play-bingo').classList.contains('lit');
    if(lit){ Sound.fanfare(); setTimeout(() => Sound.applause(2400), 620); }
    else Sound.play('clear');
    showResult({
      eyebrow:'Bingo',
      title: ((teams[outcome.team] && teams[outcome.team].name) || 'Team') + ' has a line!',
      sub:   'Three in a row.',
      tone:  outcome.team === 0 ? 'gold' : 'silver',
      actions:[{ label:'New cards', primary:true, onPick:bingoPlayAgain },
               { label:'Leave it up', onPick:function(){} }]
    });
  }

  function bingoPlayAgain(){
    hideResult();
    bingoHands = new Map();
    if(buzzHost) buzzHost.reset();
    document.querySelectorAll('#bingo-cards .bingo-cell.line').forEach(el => el.classList.remove('line'));
    document.getElementById('bingo-start').textContent = '▶ First word';
    startBingo();
    bingoDeal();
  }

  function fitBingoCards(){
    const wrap = document.getElementById('bingo-cards');
    if(!wrap || !document.getElementById('play-bingo').offsetParent) return;
    // the shared fit: no per-game measuring of the header and the team bar
    Kit.fitToScreen(wrap, { min:120, gap:12, floor:true });
  }

  function bingoDeal(){
    if(bingoOnPhones()) return;      // nothing on the board to deal in
    const cells = [...document.querySelectorAll('#bingo-cards .bingo-cell')];
    cells.forEach(el => { el.style.removeProperty('animation'); void el.offsetWidth; });
    cells.forEach((el, i) => {
      const card = +el.dataset.team, cell = +el.dataset.cell;
      // stagger across the card, not down the DOM: four cards of nine is 36 cells
      el.style.animation = `bingoDeal .34s ${(card * 40 + cell * 26)}ms both`;
    });
  }

  function bingoTension(){
    const stage = document.getElementById('play-bingo');
    const on = themeOf('bingo') === 'gameshow' && activeGame === 'bingo';
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return; }
    // one square off a line is as tense as this board gets
    const best = bingoOnPhones()
      ? [...bingoHands.values()].reduce((m, h) => Math.max(m,
          ...bingoLines().map(l => l.filter(i => h.marked[i]).length)), 0)
      : bingoBest();
    const t = Math.max(0, Math.min(1, (best - 1) / (BINGO_SIZE - 1)));
    stage.style.setProperty('--tension', t.toFixed(3));
    if(bingoRunning && bingoCurrent && !bingoWon) Sound.bedStart(t); else Sound.bedStop();
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

  function hideAllActionButtons(){
    ['reveal-btn','correct-btn','wrong-btn','skip-btn','close-btn','hint-btn','group-btn']
      .forEach(id=>{ document.getElementById(id).style.display='none'; });
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
  let jGroup = null;         // the round's own state while a grouping clue is open
  let jGroupSettler = null;  // its debounce-and-remember, from the shared shelf

  /* How long the *card* waits before the tile leaves. The settle delay is the
     round's own business and lives with it; this one is Jeopardy's, because it is
     about a tile flipping away rather than about when an answer is complete. */
  /* A beat between the four words lighting up and the card flipping away. Without
     it the room never sees which four it was: the answer and the card leaving would
     land in the same frame. */
  const J_GROUP_TAKE_MS   = 700;

  /* Two different questions, and using the wrong one is a live trap. `jGroupClue()`
     is "this clue is a grouping clue", true until the card closes. `jGroupLive()` is
     "the round is still being played", which stops the moment it is taken or
     revealed. The steal and the deduction ask the first — they run *after* Reveal,
     so asking the second would have silently let both back in. */
  function jGroupClue(){ return !!jGroup; }
  function jGroupLive(){ return !!jGroup && !jGroup.done; }


  /* ---------- the adapter ----------
     Everything the round *is* — the card, the phone payload, the union of a team's
     picks, the judging — lives in `game-hub/rounds/grouping.js` and is shared with
     the playground. What is left here is only what Jeopardy contributes: where the
     card is mounted, what a team winning is worth, and what happens to the tile.

     That split is the whole point. A round that knew about tiles could not be
     plugged into a second game, and a game that held the round could not have it
     tuned anywhere but inside itself. */
  let jRoundId = null;                 // which round this clue is running
  function jRoundDef(){ return jRoundId ? Kit.round.get(jRoundId) : null; }

  // what the round is lent: the team list, their sizes, and what a click means here
  function jGroupCtx(id){
    const sizes = teams.map(()=>0);
    if(buzzHost) buzzHost.players().forEach(p=>{
      const t = Number(p.team);
      if(t >= 0 && t < sizes.length) sizes[t]++;
    });
    return {
      teams:  teams.map((t, i) => teamName(i)),
      sizes,
      teamName,
      prompt: !!S.get('phonePrompt', roundHost.game),
      // `null` is the whole room; a scoped round belongs to the team on turn
      team:   S.get('roundWho', roundHost.game) === 'turn' ? roundHost.turn() : null,
      mode:   jRoundMode(id || jRoundId),
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
      onPick: jGroupTeacherPick
    };
  }

  /* Which round this clue wants, asked of the registry rather than named here — so
     a round written next month is playable the day a bank item carries its field,
     with no engine change at all. That is the whole return on the extraction. */
  /* The host is named here rather than at `jGroupOpen`, because `setup` is handed a
     `ctx` and the ctx is scoped to whichever board is asking — the mode, who is
     entitled and how many are on that team all read the host. Asking first and
     declaring second would set up the round against the *previous* board. */
  function jGroupOf(item, host){
    roundHost = ROUND_HOSTS[host] || ROUND_HOSTS.jeopardy;
    const hit = Kit.round.of(item);
    if(!hit) return null;
    const st = hit.def.setup(item, jGroupCtx(hit.id));
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
     when *no* round opened, written as one expression (`if(!jGroupOpen(x)) …`) so it
     cannot be half-done the way two separate statements could.

     Deliberately not solved by making `askPhones` idempotent: several callers re-arm
     the same question on purpose — a new rung in an ordering climb, a Millionaire
     steal handing the question to another team — and a guard there would silently
     turn those into no-ops. */
  function jGroupOpen(found){
    if(!found) return null;
    jRoundId = found.id;
    jGroup   = found.state;
    jGroupSettler = Kit.round.settle(jRoundDef().settleMs, jGroupSettle);
    renderJGroup();
    askPhones(currentPhonePrompt(), roundHost.game);
    return jGroup;
  }

  /* Which way a round is being played, when it offers more than one. The row is
     built from what the round *declares*, so the engine never learns what a mode
     means — and a round added later gets its own row for free. */
  function jRoundMode(id){
    const def = id ? Kit.round.get(id) : null;
    if(!def || !def.modes || !def.modes.length) return null;
    return S.get('round_' + id, roundHost.game);
  }

  /* The round the phones are put into, read through `phoneRound()` so it reaches the
     relay by the same path Bingo's cards do and the mode is not consulted. */
  function jGroupRound(){
    return jGroupLive() ? jRoundDef().arm(jGroup, jGroupCtx()) : null;
  }

  /* Somebody joined a team or dropped off one, so the shares have moved. Pushed on
     its own rather than re-armed, because a fresh arm clears every handset's picks
     and a latecomer walking in must not wipe what the rest of the team had just
     agreed on. */
  function jGroupPushShares(){
    if(!buzzHost || !jGroupLive()) return;
    const arm = jRoundDef().arm(jGroup, jGroupCtx());
    if(arm && arm.multiByTeam) buzzHost.shares(arm.multiByTeam);
  }

  /* The card's own box, inside `#clue-text` the way the hint is — so the class is
     still reading the instruction while they work. `drawPrompt` owns that element
     and clears it, so this always runs after it. */
  function renderJGroup(){
    if(!jGroup){
      const stale = document.getElementById('clue-group');
      if(stale) stale.remove();
      return;
    }
    const host = roundHost.mount();
    if(!host) return;
    jRoundDef().render(host, jGroup, jGroupCtx());
    renderJGroupButton();
  }

  /* The no-phones path, and it is not a fallback — a teacher with a dead relay has
     to be able to play this clue, which is the rule every playground page owes too.
     Clicking the words assembles a set on the board and the button judges it. */
  /* The teacher's own working answer. `push` order is load-bearing for a round
     whose answer is a *sequence* — an ordering card numbers them as they are
     clicked — and harmless for one whose answer is a set. */
  function jGroupTeacherPick(w){
    if(!jGroupLive()) return;
    const cap = jRoundCap();
    const at = jGroup.chosen.indexOf(w);
    if(at !== -1) jGroup.chosen.splice(at, 1);
    else if(jGroup.chosen.length < cap) jGroup.chosen.push(w);
    /* **A single pick moves; it does not have to be cleared first.** With a cap of
       one, a full selection used to swallow the click, so choosing B after A did
       nothing at all — you had to click A again to release it. On Millionaire that
       is the "say the letter, then lock it in" beat, where moving the nomination is
       the whole point of the pause. Only at a cap of one: where several are being
       assembled, deselecting to make room is the right gesture. */
    else if(cap === 1) jGroup.chosen = [w];
    renderJGroup();
    /* The host may have chrome of its own that follows the nomination — Millionaire's
       hint line reads "Locked on X". Without this it only refreshed on the next full
       board render, so the line lagged a beat behind the option that was lit. */
    if(roundHost.repaint) roundHost.repaint();
    /* Millionaire with "Final answer?" switched off answers on the click, as it
       always did. Declared by the host rather than branched on here, so the two-beat
       pause stays the default everywhere else. */
    if(roundHost.autoCommit && roundHost.autoCommit() && jGroup.chosen.length === cap) roundCommit();
  }
  /* How many the teacher may hold at once. An ordering climb wants one at a time —
     the ladder takes the next rung, not the whole scale. */
  function jRoundCap(){
    const arm = jGroup ? jRoundDef().arm(jGroup, jGroupCtx()) : null;
    return Math.max(1, Math.min(jGroup ? jGroup.need : 1, (arm && arm.multi) || 1));
  }

  function renderJGroupButton(){
    const btn = document.getElementById(roundHost.commit);
    if(!btn) return;
    const on = jGroupLive() && roundHost.live();
    btn.style.display = on ? 'inline-block' : 'none';
    if(!on) return;
    const cap = jRoundCap();
    btn.disabled = jGroup.chosen.length !== cap;
    /* The wording is the host's when it has one: Millionaire's button is the show's
       "Final answer?", which is the same beat and must not read as "Check it". */
    btn.textContent = roundHost.commitText ? roundHost.commitText(cap, jGroup.chosen.length)
      : (cap === 1 ? 'Check it'
        : ('Check these ' + cap + ' (' + jGroup.chosen.length + '/' + cap + ')'));
  }

  /* Replies off the wire. The round works out what each team is holding; this only
     decides what that is worth on a Jeopardy board. */
  function jGroupOnReplies(all){
    if(!jGroupLive()) return;
    jGroup.picks = jRoundDef().read(all, jGroup, jGroupCtx());
    renderJGroup();
    jGroupSettler.bump();
  }

  function jGroupSettle(){
    if(!jGroupLive()) return;
    const def = jRoundDef();
    const ctx = jGroupCtx();
    const verdicts = Object.keys(jGroup.picks).map(t => ({
      team: Number(t), set: jGroup.picks[t], r: def.judge(jGroup.picks[t], jGroup, Number(t), ctx)
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
    if(roundHost.scoreEach){
      verdicts.filter(v => v.r.verdict === 'right').forEach(v => {
        if(!jGroupSettler.fresh(v.team, 'ok:' + v.set.slice().sort().join('|'))) return;
        def.accept(v.set, jGroup, v.team, ctx);
        const paid = roundHost.win(v.team);
        notePhoneScore(teamName(v.team), v.team, null, paid || 0);
      });
      renderJGroup();
      return;                       // the clock ends the question, not the first right answer
    }

    const won = verdicts.filter(v => v.r.verdict === 'right')[0];
    if(won){
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
      def.accept(won.set, jGroup, won.team, ctx);
      if(won.r.done !== false || jGroup.done){ jGroupTake(won.team); return; }
      jGroup.say = teamName(won.team) + ' — yes.';
      jGroupSettler.reset();          // the question moved on, so every answer is worth trying again
      renderJGroup();
      Sound.play('correct');
      askPhones(currentClueItem.text, roundHost.game);  // the next rung is a new question
      return;
    }
    verdicts.forEach(v=>{
      if(!jGroupSettler.fresh(v.team, v.set.slice().sort().join('|'))) return;
      jGroupMiss(v.team, v.r);
    });
  }

  function jGroupMiss(team, r){
    /* Wrong costs nothing but the time. The tile is still on the table, the other
       team is still assembling, and a class charged for a guess stops guessing. */
    jGroup.say = jRoundDef().saidOf(teamName(team), r, jGroup);
    Sound.play('wrong');
    renderJGroup();
    notePhoneMiss(teamName(team), team, (jGroup.picks[team] || []).join(', '), 'wrong');
    document.querySelectorAll('#clue-group .gword').forEach(el=>{
      if((jGroup.picks[team] || []).indexOf(el.dataset.word) === -1) return;
      el.classList.add('shake');
      setTimeout(()=> el.classList.remove('shake'), 380);
    });
  }

  function jGroupTake(team){
    jGroupSettler.stop();
    jGroup.done = true;
    jGroup.say  = teamName(team) + ' has it.';
    renderJGroup();
    Sound.play(document.getElementById(roundHost.stage).classList.contains('lit')
               ? 'sting' : 'correct');
    /* The class produced the answer and the host judged it, so there is nothing left
       for the teacher to confirm — the same rule a typed word has always followed.
       A beat first, or the four lighting up and the card leaving land in one frame
       and the room never sees which four it was. */
    const value = currentClueValue;
    setTimeout(()=>{
      if(!jGroup) return;                 // the teacher closed the card in the meantime
      const paid = roundHost.win(team);
      notePhoneScore(teamName(team), team, null, paid || value);
    }, J_GROUP_TAKE_MS);
  }

  /* The round is over — because the tile was taken, or because the teacher closed
     the card on it. Say the true thing to thirty handsets rather than leaving eight
     words up with a dead button: that is what "not asking them at all" did to the
     Daily Double, and it reads as broken rather than deliberate. */
  function jGroupEnd(){
    if(!jGroup) return;
    if(jGroupSettler) jGroupSettler.stop();
    jGroup = null; jGroupSettler = null; jRoundId = null;
    const host = document.getElementById('clue-group');
    if(host) host.remove();
    if(buzzHost){
      buzzWinner = null;
      lastAsk = { mode:'off', prompt:'' };
      buzzHost.disarm();
      renderBuzzChip();
    }
    clearReplies();
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
    const grp = jGroupOf(currentClueItem, 'jeopardy');
    if(grp) currentClueItem.answer = grp.state.answer;
    drawPrompt(document.getElementById('clue-text'), currentClueItem, 'jeopardy');
    /* Before `askPhones`, which consults `phoneRound()` — and `phoneRound()` cannot
       answer until the round exists. Also after `drawPrompt`, which owns `#clue-text`
       and clears it. */
    jGroupEnd();
    /* A Daily Double still gets its words — it is only the *phones* that a Daily
       Double excludes, because the clue belongs to the team that found it. Without
       the round the tile would open on an instruction with nothing to pick from,
       and the wager would be unanswerable. The team names their four out loud and
       the teacher clicks them, which is the no-relay path doing a second job;
       `jCorrect` already routes the payout to `jDoubleTeam` whoever is passed in. */
    // A round arms the room as it opens, so this covers the ordinary clues only.
    // A replayed tile asks nobody, and a Daily Double belongs to one team alone.
    const opened = (!review && grp) ? jGroupOpen(grp) : null;
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
       than inside `jGroupOpen` — the round has to exist before `askPhones` asks the
       game what it is, and the buttons are cleared after that. */
    renderJGroupButton();
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
    const rnd = jGroupOf(currentClueItem, 'blockbusters');
    if(rnd) currentClueItem.answer = rnd.state.answer;
    /* Opening a hex answers the vote's question, so it ends there rather than
       waiting for the button — and it must end *before* askPhones, or the arm
       below would be overwritten by a vote nobody is still taking. */
    bbVoting = false; bbVote = null; renderBBVote();
    drawPrompt(document.getElementById('clue-text'), currentClueItem, 'blockbusters');
    /* After `drawPrompt`, which owns `#clue-text` and clears it, and before
       `askPhones`, which consults `phoneRound()` — and `phoneRound()` cannot say
       what the handsets want until the round exists. */
    jGroupEnd();
    if(!(rnd && jGroupOpen(rnd))) askPhones(clueObj.clue, 'blockbusters');
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
    renderJGroupButton();
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
    jGroupEnd();
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
    if(jGroupLive()){
      if(jGroupSettler) jGroupSettler.stop();   // the answer is out; nothing left to judge
      jRoundDef().reveal(document.getElementById('clue-group'), jGroup, jGroupCtx());
      renderJGroupButton();
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
     app's constraint, and auto-marking wrong mid-sentence would fight it. */
  let jClockTick = null;
  function jClockStop(){
    if(jClockTick){ clearInterval(jClockTick); jClockTick = null; }
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
    let left = secs;
    const paint = ()=>{ el.textContent = String(left); el.classList.toggle('urgent', left <= 3); };
    paint();
    jClockTick = setInterval(()=>{
      left--;
      if(left <= 0){
        clearInterval(jClockTick); jClockTick = null;
        el.textContent = '0'; el.classList.add('urgent');
        document.getElementById('clue-card').classList.add('overtime');
        Sound.play('klaxon');
        return;
      }
      paint();
    }, 1000);
  }

  function jOfferSteal(teamIdx){
    /* A grouping clue has no rebound, because it had no floor. The steal exists so
       a team that was shut out of a question gets it when the team holding it
       misses — but every team was assembling this one at once, and nobody was
       excluded, so there is nothing to offer and nobody to offer it to. It burns
       the tile and passes the turn, as a miss did before the steal existed. */
    if(jGroupClue()) return false;
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
      paid = award(team, value, { steal: !!jSteal && team === jSteal.to });
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
    if(S.get('jDeduct', 'jeopardy') && teams[missed] && modalMode === 'jeopardy' && !jGroupClue()){
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
    if(S.get('jFinalRound', 'jeopardy') && jFinalCanRun()) jStartFinal();
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
      paid = award(idx, 1, { steal: side !== bbTurn });
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
  /* The Lab: only the game being played, changeable mid-round. ⚙ still shows
     everything at once; this exists so trying a different dynamic is two taps
     rather than a hunt through other games' tabs. */
  /* The drawer stops short of the header and the team bar rather than covering
     them. That is not tidiness: both hold controls a teacher reaches for *while*
     the drawer is open — New game, the timer, ⚙, and the ± score buttons — and a
     full-height panel swallowed every one of them. Both edges are measured
     because the header wraps at narrow widths and the team bar grows a row when
     a team is added, so neither height is a constant. */
  function fitLab(){
    const d = document.getElementById('lab-drawer');
    if(!d) return;
    const band = document.querySelector('.geo-band');
    const bar  = document.getElementById('scorebar');
    const top  = band ? Math.max(0, band.getBoundingClientRect().bottom) : 0;
    const barFixed = bar && getComputedStyle(bar).position === 'fixed';
    const bottom = barFixed
      ? Math.max(0, window.innerHeight - bar.getBoundingClientRect().top) : 0;
    d.style.top = top + 'px';
    d.style.bottom = bottom + 'px';
  }

  function openLab(){
    if(!activeGame) return;
    document.getElementById('lab-title').textContent =
      ((window.HUB_GAME_TITLES && window.HUB_GAME_TITLES[activeGame]) || 'Game') + ' settings';
    S.renderFor(document.getElementById('lab-body'), activeGame);
    fitLab();
    document.getElementById('lab-drawer').classList.add('on');
    document.body.classList.add('lab-open');
    hook('onResize');
  }
  function closeLab(){
    document.getElementById('lab-drawer').classList.remove('on');
    document.body.classList.remove('lab-open');
    hook('onResize');
  }
  function labOpen(){ return document.getElementById('lab-drawer').classList.contains('on'); }

  document.getElementById('lab-close').addEventListener('click', closeLab);
  // the rare cross-game edit mid-round: the drawer hands over to the full panel
  document.getElementById('lab-all').addEventListener('click', ()=>{ closeLab(); S.open(); });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && labOpen()){ closeLab(); return; }   // it is settings now
    if(e.key !== 'l' && e.key !== 'L') return;
    if(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if(document.getElementById('screen-play').classList.contains('active')){
      e.preventDefault(); labOpen() ? closeLab() : openLab();
    }
  });

  document.getElementById('buzzer-chip').addEventListener('click', ()=>{
    if(buzzHost) joinPanelOpen() ? hideJoinPanel() : showJoinPanel();
  });
  document.getElementById('join-close').addEventListener('click', hideJoinPanel);
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
  /* The vote itself (Kit.vote), once Ask the class has run — and `mTally` is its
     counts, kept as a name because the board renders them. One implementation now
     serves this and Blockbusters' hexagon vote; what differs between them is who
     may vote and what the numbers are drawn on, which is all the kit takes. */
  let mVote    = null;
  let mTally   = null;   // option -> vote count, once Ask the class has run
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
    mState = []; mCurrent = null; mAnswered = false; mVote = null; mTally = null; mCounting = false;
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
    mAnswered = false; mVote = null; mTally = null; mCounting = false; mVoting = false; mPicked = null;
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
    const found = jGroupOf(currentClueItem, 'millionaire');
    jGroupEnd();
    const opened = found ? jGroupOpen(found) : null;
    renderMillionaire();
    /* A new question ends any borrowing: the phones go back to whatever the mode
       says, the same as in the tile games. Voting is not a mode any more, so there
       is nothing to exempt here — it comes and goes inside a question. Only when no
       round opened, because opening one has already armed the room. */
    if(!opened) askPhones(q.prompt, 'millionaire');
  }

  function showMillionaireMessage(text){
    jGroupEnd();
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
    renderJGroup();

    mSayHint();
    document.getElementById('m-next').style.display = 'none';
    /* No "Done voting" any more, and its absence is the point: the round holds the
       room for the whole question, so there is no borrowing to hand back. */
    document.getElementById('m-done-count').style.display = 'none';
    /* `m-final` is the round's commit button now, shown and worded by
       `renderJGroupButton` — setting it here as well is how the two would disagree. */
  }

  /* ---- how tense it should feel right now ----
     The ladder already holds the only number this needs: rung 0 of 8 is a warm-up,
     rung 7 is the last question of the night. One value drives both halves of the
     atmosphere — the CSS reads `--tension` to close the spotlight in and pull the
     colour towards red, and the think-music bed uses it for tempo and brightness.
     Nothing here runs unless the game show skin is on. */
  /* ================= Quickfire =================
     A sequence, a clock and a scoreboard. Everything about the *question* — the
     card, the handsets, merging several students into one team answer, judging it —
     belongs to the Multiple Choice round and none of it is written here. */

  function kAsRound(q){ return mAsRound(q); }   // same bank shape, one definition

  function renderKahootContent(list, help){
    help.textContent = 'Pick which sections to draw from. Questions are shuffled, and the run stops after the number set in ⚙.';
    groupCheckboxes(list, KAHOOT_BANK, KAHOOT_TOPIC_NAMES, KAHOOT_SECTION_NAMES);
  }
  function kahootStartButton(btn){
    const n = Math.min(kWanted(), selectedKahoot().length);
    btn.textContent = n ? 'Start — ' + n + ' questions' : 'Pick at least one section';
    btn.disabled = !n;
  }
  function selectedKahoot(){
    return KAHOOT_BANK.filter(i => selectedContent.includes(groupOf(i)));
  }

  function startKahoot(){
    kQueue = shuffle(selectedKahoot().slice()).slice(0, kWanted());
    kAt = -1; kCurrent = null; kAsked = 0; kOver = false;
    kStopClock();
    document.getElementById('k-next').style.display = 'none';
    renderKahootBoard();
    nextKahoot();
  }

  /* The run ends when the queue does. There is no board to clear and no line to
     complete, so this is the only ending. */
  function nextKahoot(){
    kAt++;
    if(kAt >= kQueue.length){ finishKahoot(); return; }
    kCurrent = kQueue[kAt];
    kAsked++;
    kPaid = Object.create(null);
    kOver = false;
    document.getElementById('k-next').style.display = 'none';
    document.getElementById('k-hint').textContent = '';
    document.getElementById('k-count').textContent = 'Question ' + kAsked + ' of ' + kQueue.length;

    /* Name the host before the round is set up, or `setup` reads a ctx scoped to
       whichever board asked last — the trap `jGroupOf` carries a note about. */
    jGroupEnd();                       // the previous question's handsets stand down
    const found = jGroupOf(kAsRound(kCurrent), 'kahoot');
    document.getElementById('k-question').textContent = '';
    drawPrompt(document.getElementById('k-question'), kAsRound(kCurrent), 'kahoot');
    /* Opening the round arms the room — see `jGroupOpen`. Every question here is a
       round, so there is no ordinary-question path to fall back to. */
    if(!(found && jGroupOpen(found))) askPhones(kCurrent.prompt, 'kahoot');

    kStartedAt = Date.now();
    kStartClock();
    hook('tension');
    fitKahoot();
  }

  function kStartClock(){
    kStopClock();
    kPaintClock();
    kTick = setInterval(()=>{
      kPaintClock();
      if(kLeft() <= 0) kTimeUp();
    }, 100);
  }
  function kStopClock(){ if(kTick) clearInterval(kTick); kTick = null; }
  function kPaintClock(){
    const el = document.getElementById('k-secs');
    if(!el) return;
    const left = kLeft();
    el.textContent = Math.ceil(left);
    document.getElementById('k-clock').classList.toggle('low', left <= 5);
  }

  /* Time up is a fact, not a verdict — the same rule Jeopardy's answer clock
     follows. The round is ended so thirty handsets stop taking taps, the answer is
     revealed because nothing else on this board ever would, and the teacher moves
     on when the room has had a moment to look at it. */
  function kTimeUp(){
    if(kOver) return;
    Sound.play('timeup');
    kEndQuestion();
  }

  /* One definition of "this question is over", whoever decided it — the clock, or
     the teacher committing an answer with no phones in the room. Two paths that end
     a question differently is the bug that shape invites, and this project has
     already paid for it once in `lockIn`. */
  function kEndQuestion(){
    if(kOver) return;
    kOver = true;
    kStopClock();
    kPaintClock();
    /* Reveal before ending. On a tile the card flips away and nobody needs telling;
       here the options stay on screen, so ending without revealing leaves four
       live-looking options and no answer — the same fix Millionaire needed. */
    if(jGroup && !jGroup.shown) jRoundDef().reveal(roundHost.mount(), jGroup, jGroupCtx());
    jGroupEnd();
    const got = Object.keys(kPaid || {}).length;
    document.getElementById('k-hint').textContent =
      got ? (got === 1 ? 'One team got it.' : got + ' teams got it.') : 'Nobody got that one.';
    document.getElementById('k-next').style.display = 'inline-block';
    document.getElementById('k-next').textContent =
      kAt + 1 >= kQueue.length ? 'See the results' : 'Next question';
    renderKahootBoard();
    hook('tension');
  }

  /* What this skin pays, and the only thing about it that is genuinely new.
     Called once per team, by the shared settle path, the moment that team's answer
     settles — so the clock is read at the moment they answered rather than at the
     end of the question. Returns what it paid, like every other host's `win`. */
  function kPay(team){
    if(!kPaid || kPaid[team] != null) return kPaid ? kPaid[team] : 0;
    /* Through `award`, like every other board, so a streak bonus and the scoreboard
       repaint come for free rather than being re-implemented here. `streak:false`:
       every team answers every question, so a "run" would only measure who has been
       right most recently, which is what the points already say. */
    const paid = award(team, kValue(), { streak:false });
    kPaid[team] = paid;
    renderKahootBoard();
    /* **The no-relay path ends the question here.** With phones in the room several
       teams settle independently and the clock decides when the question is over.
       With none, the teacher picks the answer and commits, which runs the shared
       take-and-end path — so the round is already finished by the time this is
       called, and without noticing that the board would sit on a dead question with
       no way forward. Degradation is the rule, not a fallback. */
    if(jGroup && jGroup.done) setTimeout(kEndQuestion, 0);
    return paid;
  }

  /* A live scoreboard beside the question, ordered, so the room can see the race
     rather than being told the result at the end. The team bar carries the same
     numbers; this one carries the *order*, which is what a run of fifteen is about. */
  function renderKahootBoard(){
    const host = document.getElementById('k-board');
    if(!host) return;
    const rows = teams.map((t, i) => ({ i, name:t.name, pts:t.score }))
                      .sort((a, b) => b.pts - a.pts);
    /* Built rather than templated, because a team name is typed by a teacher and
       `innerHTML` would take whatever they typed literally. `renderScorebar` builds
       its rows the same way for the same reason. */
    host.innerHTML = '';
    rows.forEach((r, place) => {
      const gain = kPaid ? kPaid[r.i] : null;
      const row  = document.createElement('div');
      row.className = 'k-row' + (gain != null ? ' scored' : '');
      const add = (cls, text) => {
        const el = document.createElement('span');
        el.className = cls; el.textContent = text; row.appendChild(el);
      };
      add('k-place', String(place + 1));
      add('k-name',  r.name);
      add('k-pts',   String(r.pts));
      if(gain != null) add('k-gain', '+' + gain);
      host.appendChild(row);
    });
  }

  function finishKahoot(){
    kCurrent = null; kOver = true;
    kStopClock();
    document.getElementById('k-next').style.display = 'none';
    document.getElementById('k-count').textContent = 'Finished';
    renderKahootBoard();
    const rank = teams.map((t, i) => ({ i, name:t.name, pts:t.score }))
                      .sort((a, b) => b.pts - a.pts);
    const top  = rank[0];
    const tie  = rank.filter(r => r.pts === top.pts);
    showResult({
      eyebrow: kQueue.length + ' questions',
      title:   tie.length > 1 ? 'A tie' : top.name + ' wins',
      sub:     tie.length > 1
                 ? tie.map(r => r.name).join(' and ') + ' — ' + top.pts + ' each'
                 : top.pts + ' points',
      tone:    'gold',
      actions: [{ label:'New run', onClick: startKahoot }]
    });
  }

  /* Fit the **wrapper**, not the stage. The scoreboard sits below the stage, so
     sizing the stage to the floor pushed the board off the bottom of the screen —
     the numbers all passed and the screenshot showed it immediately. `floor:true`
     because a handset genuinely cannot fit fifteen-point type, four options and a
     four-team board, and forcing it collapses the options the way it did on the
     Millionaire ladder. */
  function fitKahoot(){
    const wrap = document.getElementById('k-wrap');
    if(!wrap || activeGame !== 'kahoot') return;
    Kit.fitToScreen(wrap, { min:260, gap:18, floor:true });
  }

  function kTension(){
    const stage = document.getElementById('play-kahoot');
    if(!stage) return;
    const on = themeOf('kahoot') === 'gameshow' && activeGame === 'kahoot';
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return; }
    /* Two ingredients, like Race: how far through the run we are, and whether a
       question is actually live this second. A board sitting on a revealed answer
       should not be as tense as one with four seconds left. */
    const through = kQueue.length ? kAsked / kQueue.length : 0;
    const urgent  = kLive() && kSecs() ? 1 - (kLeft() / kSecs()) : 0;
    const t = Math.min(1, through * 0.6 + urgent * 0.4);
    stage.style.setProperty('--tension', t.toFixed(3));
    if(kLive() && motionOK()) Sound.bedStart(t); else Sound.bedStop();
  }

  function mTension(){
    const stage = document.getElementById('play-millionaire');
    const on    = themeOf('millionaire') === 'gameshow' && activeGame === 'millionaire';
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return; }

    const st = mTeamState(active);
    const t  = Math.min(st.rung, M_LADDER.length-1) / (M_LADDER.length-1);
    stage.style.setProperty('--tension', t.toFixed(3));

    // the bed plays under a live question and stops the moment one is answered, so
    // it never runs under the teacher reading out the result
    if(mCurrent && !mAnswered && motionOK()) Sound.bedStart(t);
    else Sound.bedStop();
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
  function mNominated(){ return (jGroup && jGroup.chosen && jGroup.chosen[0]) || null; }

  /* Everything a question ending does to the board, whichever way it ended. */
  function mEndQuestion(){
    /* **Show which one was right.** On a tile the card flips away and nobody needs
       telling; here the options stay on screen for the rest of the beat, so ending
       without revealing leaves four live-looking options and no answer. `reveal`
       also clears the lock, which is what stops the nomination outliving the
       question it belonged to. */
    if(jGroup && !jGroup.shown) jRoundDef().reveal(roundHost.mount(), jGroup, jGroupCtx());
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
    const paid = award(team, value, { steal: !!(mCurrent && mCurrent.stolen) });
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
      if(jGroup) jGroup.chosen = [];
      document.getElementById('m-hint').textContent =
        (teams[mCurrent.team] ? teams[mCurrent.team].name : 'The other team') +
        ' can steal it for ' + Math.round(M_LADDER[Math.min(st.rung, M_LADDER.length-1)] /
                                          (S.get('stealFullValue','millionaire') ? 1 : 2));
      if(document.getElementById('play-millionaire').classList.contains('lit')){
        Sound.play('klaxon'); mFlash('wrong');
      } else Sound.play('wrong');
      renderJGroup();
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
      if(jGroup){
        const wrong = jGroup.options.filter(o => o !== jGroup.answer);
        jGroup.hidden = shuffle(wrong.slice()).slice(0, 2);
        renderJGroup();
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

  document.getElementById('bb-ask').addEventListener('click', ()=>{
    if(bbVoting) bbCloseVote(true); else bbAskTeam();
  });

  document.querySelectorAll('#m-lifelines .lifeline').forEach(btn=>{
    btn.addEventListener('click', ()=>useLifeline(btn.dataset.life));
  });
  document.getElementById('m-final').addEventListener('click', roundCommit);
  /* Quickfire's two. `k-commit` is the shared round commit — the same button every
     host declares, for the teacher playing with no relay in the room. `k-next` is
     the only thing on this board that advances, because there is no tile to click. */
  document.getElementById('k-commit').addEventListener('click', roundCommit);
  document.getElementById('k-next').addEventListener('click', ()=>{ nextKahoot(); });
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

    // 1. somebody has the floor — the loudest thing that can be true
    if(buzzWinner){
      bar.className = 'won';
      add('pb-name', buzzWinner.name);
      teamChip(buzzWinner.team);
      if(buzzWinner.value != null) add('pb-typed', '\u201C' + buzzWinner.value + '\u201D');
      add('pb-note', buzzWinner.value != null ? 'got it' : 'buzzed in');
      return;
    }
    // 2. the last question was taken by a phone — said plainly, and it stays said
    if(lastScored){
      bar.className = 'scored';
      add('pb-name', lastScored.name);
      teamChip(lastScored.team);
      if(lastScored.value) add('pb-typed', '\u201C' + lastScored.value + '\u201D');
      add('pb-points', '+' + lastScored.points);
      return;
    }
    // 3. a miss: who is nearly there, and how, is the most useful thing on screen
    if(lastTyped){
      bar.className = 'missed';
      add('pb-name', lastTyped.name);
      add('pb-typed', '\u201C' + lastTyped.value + '\u201D');
      add('pb-verdict', lastTyped.verdict === 'close' ? 'check the spelling' : 'not yet');
      return;
    }
    // 4. the whole room answering — the count, then what they wrote
    if(classReplies && classReplies.all.length){
      bar.className = 'replies';
      add('pb-count', classReplies.total + ' of ' + (classReplies.of || buzzPlayers || '?'));
      classReplies.all.forEach(r=>{
        const chip = add('pb-reply team-' + Math.min(r.team, 3), r.name + ': ' + r.value);
        chip.title = teamName(r.team);
      });
      return;
    }
    // 5. nothing yet — but the strip still holds its height, so the board never moves
    bar.className = 'idle';
    add('pb-idle', phoneBarHint());
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
  function phonesWanted(){
    if(!activeGame) return false;
    return !!S.get('buzzers');
  }
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
  function rememberedRoom(relay){
    try{
      const r = JSON.parse(window.localStorage.getItem(ROOM_KEY) || 'null');
      if(!r || r.relay !== relay || !/^\d{4,6}$/.test(String(r.code))) return null;
      return (Date.now() - r.at < ROOM_TTL) ? String(r.code) : null;
    }catch(e){ return null; }
  }
  function rememberRoom(code, relay){
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
      buzzHost.on('ready',   d=>{ buzzPlayers=(d.players||[]).length; pushTeamNames();
                                  renderBuzzChip(); renderJoinCount(); reaskPhones();
                                  bingoDealHands();
                                  // the room arrives after the board is built, so the
                                  // button that needs one has to be painted here
                                  renderBBVote();
                                  /* Same trap, one game over, and it had been live
                                     since Ask the class started reading the round's
                                     counts: the lifeline disables itself when there
                                     is no room to reveal anything from, and
                                     Millionaire deals its first question inside
                                     `start()` — before the code has come back. So a
                                     lesson that opened on Millionaire found Ask the
                                     class greyed out for the whole first question,
                                     saying there were no phones in a room the class
                                     had just joined. Nothing re-painted it. */
                                  if(activeGame === 'millionaire') renderMillionaire(); });
      buzzHost.on('players', list=>{ buzzPlayers=list.length; renderBuzzChip(); renderJoinCount();
                                     // a student who joins mid-round gets a card
                                     bingoDealHands();
                                     /* …and a team that just grew or shrank gets a
                                        new share of the group. Pushed, never
                                        re-armed: a latecomer must not wipe what the
                                        rest of their team had already agreed on. */
                                     jGroupPushShares(); renderJGroup();
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
    const key = names.join('\u0000');
    if(key === lastPushedTeams) return;
    lastPushedTeams = key;
    buzzHost.setTeams(names);
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
    /* A tap on a bingo card arrives as an ordinary response — it is a typed answer
       without the typing — but it is judged per player and marks that player's own
       card, so it is handled before the shared collect-and-count path. */
    if(bingoOnPhones() && d.latest && onBingoTap(d.latest)) return;
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
    if(own) return { mode: own.mode, prompt: own.prompt || '', options: own.options || [],
                     keepSpent: own.keepSpent !== false,
                     multi: own.multi, multiByTeam: own.multiByTeam,
                     holds: own.holds, rethink: own.rethink, team: own.team };
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
      buzzHost.arm(round.prompt, { mode:round.mode, options:round.options,
                                   keepSpent:round.keepSpent,
                                   multi:round.multi, multiByTeam:round.multiByTeam,
                                   holds:round.holds, rethink:round.rethink,
                                   team:round.team });
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
    const picked = shuffle(RACE_BANK.filter(c=>selectedContent.includes(groupOf(c))))
                     .slice(0, RACE_MAX_WORDS);
    raceWords   = picked.map(p=>({ word:p.answer, section:p.section, found:false, by:-1 }));
    raceQueue   = shuffle(picked.slice());
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

  function nextRacePrompt(){
    while(raceQueue.length){
      const item = raceQueue.shift();
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

  function startRaceRound(){
    if(!raceWords.some(w=>!w.found)) return;
    raceRunning=true;
    if(raceMode==='timed'){ timerReset(); timerStart(); }
    nextRacePrompt();
  }

  function endRaceRound(cleared){
    raceRunning=false;
    hideClaimBar();
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
    const wrap = document.getElementById('race-words');
    if(!document.getElementById('play-race').classList.contains('lit') || !motionOK()) return;
    [...wrap.querySelectorAll('.race-word')].forEach((el, i)=> el.style.setProperty('--i', i));
    wrap.classList.remove('dealing'); void wrap.offsetWidth;
    wrap.classList.add('dealing');
    setTimeout(()=>wrap.classList.remove('dealing'), 1800);
  }

  function rTension(){
    const stage = document.getElementById('play-race');
    const on = themeOf('race')==='gameshow' && activeGame==='race';
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return; }

    const done  = raceWords.filter(w=>w.found).length;
    const clear = raceWords.length ? done/raceWords.length : 0;
    const live  = !!(raceRunning && raceCurrent);
    const t = Math.min(1, 0.6*clear + (live ? 0.4 : 0));
    stage.style.setProperty('--tension', t.toFixed(3));
    stage.classList.toggle('running', live);

    if(live && motionOK()) Sound.bedStart(t);
    else Sound.bedStop();
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
    award(teamIdx, 1, {});
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
  window.addEventListener('resize', ()=>{ hook('onResize'); if(labOpen()) fitLab(); });

  document.getElementById('bingo-start').addEventListener('click', nextBingoCall);
  document.getElementById('bingo-skip').addEventListener('click', () => {
    // nobody had it: the word goes back in the bag rather than out of the game
    if(bingoCurrent) bingoQueue.push(bingoCurrent);
    bingoCurrent = null; bingoRunning = false;
    setBingoPrompt(null);
    setBingoMessage('Put back. Next word when you are ready.');
    document.getElementById('bingo-start').style.display = 'inline-block';
    document.getElementById('bingo-start').textContent   = '▶ Next word';
    document.getElementById('bingo-skip').style.display  = 'none';
    resetBuzzers();
    bingoTension();
  });

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
  /* One settings entrance, whose form suits the moment: mid-game the gear opens
     the docked drawer for the game being played (the board gives up the width, so
     a rule can be changed and the next question watched under it); everywhere
     else it opens the full panel. The drawer's "All games" button reaches the
     panel for the rare cross-game edit mid-round. */
  S.mount(document.querySelector('.header-right'), ()=>{
    const playing = activeGame &&
      document.getElementById('screen-play').classList.contains('active');
    if(playing){ labOpen() ? closeLab() : openLab(); }
    else S.open();
  });
  renderScorebar();   // team bar visible from the very first screen

  // settings that change what's already on screen take effect without a restart
  S.onChange((id)=>{
    /* The bed is the only sound that is *already playing* when the panel is open,
       so it is the only one that has to be re-decided on the spot. Re-running the
       game's tension hook does that: it is the single place that knows whether a
       question is live, and it starts or stops the bed accordingly. */
    if(id==='musicBed' || id==='sound' || id==='soundVolume') hook('tension');
    if((id==='jTogether' || id==='jTarget' || id==='jRules') && activeGame==='jeopardy'){
      renderClassLine(); hook('onResize');
    }
    /* Changing the ruleset mid-board now reaches the board. Planting only among the
       unplayed tiles is what keeps that honest — see jPlantDailyDoubles. */
    if((id==='jDailyDoubles' || id==='jRules') && activeGame==='jeopardy' &&
       document.getElementById('screen-play').classList.contains('active')){
      jPlantDailyDoubles();
    }
    if(id==='jHints' && activeGame==='jeopardy') renderHintButton();
    if(id==='raceShowSection' && activeGame==='race' && raceCurrent) setRacePrompt(raceCurrent);
    if(id==='raceRoundSeconds' && activeGame==='race' && raceMode==='timed' && !raceRunning){
      timerSetDuration(Number(S.get('raceRoundSeconds', 'race')) || 60);
    }
  });
  if(UNITS.length===1){
    loadUnit(UNITS[0]);
    showScreen('screen-game-select');
  } else {
    renderUnitSelect();
    showScreen('screen-unit-select');
  }

})();
