/* ================= The game registry =================
   A game declares itself once and the engine drives it through this contract.
   There used to be nine `if (activeGame === 'jeopardy')` branch points and a new
   game had to be threaded into every one by hand, with nothing complaining if
   you missed one — the defect class this project has paid for most.

   **Its own file now, loading before the game files and the engine** — the same
   pattern as `hub-rounds.js` → `rounds/*.js` → engine: the registry publishes,
   game files register into it, the engine loads last and consumes everything.
   That ordering is what retired the "register before init or the game is
   invisible" trap for external game files: by the time the engine's init runs,
   every registration has already happened.

   Every hook is optional and defaults to a no-op, so a game runs the moment it
   is registered and grows by filling hooks in — the checklist cannot be
   half-finished. Hooks fire only while their game is active, so none of them
   checks whose turn it is to exist. */
window.HubGames = (function(){
  'use strict';

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
      asRound:      function(item){ return item; },
      /* **Whether this board works with one person per competitor.** Not every one
         does, and it is a fact about the *geometry* rather than about the questions:
         Millionaire draws a ladder each and thirty ladders is not a board,
         Blockbusters has exactly two routes across it, and Race is two people
         physically at the screen. Jeopardy, Bingo and Quickfire are fine with it.
         Declared rather than discovered, the same shape as `hasBank` — and `false`
         by default, because teams is what every board here was built for and a new
         one should have to say it has thought about the other. */
      solo:         false,
      /* **The roster changed under a live board.** In team play that only happens
         when a teacher presses a button between games; in individual play a student
         walking in late *is* a new competitor, mid-question, and a board that draws
         its own picture of who is playing has to hear about it. Quickfire's
         leaderboard is the first caller — without this a latecomer scored and never
         appeared on it. A no-op for every board that reads `teams` at draw time. */
      onRoster:     NO_OP,
      /* A team was removed (`i>=0`, at that index) or the roster was replaced
         wholesale (`i<0`). A game holding **per-team state keyed by index** — a
         parallel array like Millionaire's ladders — re-aligns it here; the engine
         used to reach into that state by name. A no-op for every board whose per-team
         state is rebuilt on entry or keyed by the competitor rather than the slot. */
      onTeamsChanged: NO_OP,
      /* ---- the room's own beats, for games that hold per-player state ----
         Bingo forced all three onto the contract: it is the one game whose state
         the phone layer used to reach by name. `onRoomReady` fires when the
         relay's room (re)connects — Millionaire repaints Ask-the-class here,
         Blockbusters its vote button, Bingo deals cards. `onPlayers` fires on
         every roster push from the room — a student joining mid-round gets a
         card. `onRoomForgot` fires when the relay restarted and the room's
         memory died — whatever this game told the room, it must tell again
         (Bingo re-deals every hand, marks included). `onPhoneReply` sees each
         raw reply before the shared collect-and-count path; return true to
         consume it (a bingo tap marks one player's own card and is nobody's
         team answer). */
      onRoomReady:  NO_OP,
      onPlayers:    NO_OP,
      onRoomForgot: NO_OP,
      /* The room was dropped entirely (buzzers switched off, or pointed at another
         relay) — distinct from onRoomForgot's "relay restarted, re-deal". A game holding
         a board vote clears it here (Blockbusters' hexagon vote). */
      onRoomDrop:   NO_OP,
      /* The room state changed — opened, parked, or a phone setting flipped — so a game
         repaints its room-facing chrome (Blockbusters' vote button). A repaint, not a
         reset: onRoomDrop clears, this only redraws. */
      onRoomSync:   NO_OP,
      onPhoneReply: function(){ return false; },
      /* Is a board vote open right now? Only a game that borrows every phone for a whole
         vote (Blockbusters) answers true; the shared phone bar and re-ask read it. */
      voteLive:     function(){ return false; },
      /* ---- declared facts that used to be `activeGame ===` branches ----
         Each of these replaced a by-name switch in shared code. Declared, a game
         registered next month is correct by default. */
      /* The items this game's content-screen round filter counts over. */
      bank:         function(){ return []; },
      /* The unit a manual ± correction moves in, and the unit a payout is
         rounded to. The two boards that score in hundreds nudge by 100 and pay
         in 50s — half a $100 tile is 50, and rounding that to the nearest 100
         handed a steal the full value. Everything else moves in single points. */
      nudgeStep:    1,
      payStep:      1,
      /* A setting changed mid-board that this game wants to react to — repaint
         a line, re-plant a hidden tile, re-read a clock. Fires only while this
         game is active, exactly as the hand-written branches guarded. */
      onSetting:    NO_OP,
      /* Which team the scorebar highlights as "on turn" (Blockbusters rotates
         within sides; Race head-to-head has no turn at all → return -1), and
         any extra markup a team's chip carries (Blockbusters' side-colour dot). */
      turnTeam:     null,      // null = the shared `active` index
      teamDecor:    function(){ return ''; },
      /* ---- what an external game file declares instead of editing the engine ----
         Its stage markup (`#play-<id>`, injected into the play screen at engine
         init when the skeleton does not already hold it) and its ROUND_HOSTS
         entry (merged by the engine before the round settings are built). The
         in-engine games declare neither: their stages are in the skeleton and
         their host entries in the table, exactly as before. */
      stageHTML:    null,
      roundHost:    null,
      /* Where this game sits among the cards and the settings tabs. External
         files load *before* the engine, so without this a game moving to its own
         file would jump to the front of every list — the built-ins sit at 50 in
         registration order, and a former built-in keeps its old seat by number. */
      order:        50
    }, def);
    GAMES.push(g);
    GAMES.sort((a, b) => (a.order - b.order) || 0);   // stable: ties keep registration order
    GAME_BY_ID[g.id] = g;
    HUB_GAME_TITLES[g.id] = g.title;
    return g;
  }

  /* Which game the board is playing right now, or null between games. Told by the
     engine (`setActive`), read by the room bench's tune pane; the registry keeps
     it because the engine's own variable is closure-private. */
  let current = null;
  /* The engine binds its card renderer here — the registry cannot know how cards
     are drawn, only that somebody may ask for them to be redrawn. */
  let renderCardsFn = NO_OP;

  return {
    register: def => registerGame(def),
    get:      id  => GAME_BY_ID[id] || null,
    ids:      ()  => GAMES.map(g => g.id),
    /* The live array itself, for the engine's own iteration — not a copy, so the
       engine and the registry can never disagree about what is registered. */
    all:      ()  => GAMES,
    hooksOf:  id  => Object.keys(GAME_BY_ID[id] || {}),
    renderCards: () => renderCardsFn(),
    _bindRenderCards: fn => { renderCardsFn = fn || NO_OP; },
    active:    () => current,
    setActive: id => { current = id || null; }
  };
})();
