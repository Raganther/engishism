/* ================= Quickfire — the sixth game, and the first in its own file =================

   Every other skin is a geometry with a question hidden behind each cell: a tile,
   a hexagon, a rung, a word on a track, a square on a card. There is nothing to
   choose here. Fifteen questions go up in a row against a clock, and the only
   decisions in the room are made on the handsets.

   **The first game extracted from the engine**, chosen because it is the least
   entangled: no clue card, no board geometry, no turns. What it proves is the
   contract an external game lives on — it registers into `window.HubGames`
   (loading after `hub-games.js`, before the engine, exactly as `rounds/*.js`
   register into `Kit.round`), declares its stage markup (`stageHTML`) and its
   round-host entry (`roundHost`) instead of editing the engine's skeleton and
   table, and reaches the engine's shared machinery through `window.HubEnv` —
   inside hooks only, never at parse time, because this file loads first.

   What is genuinely this skin's: every team scores, and what they score depends
   on how fast they were. Nothing else in the app scores by time. `level` is
   ignored — a ladder needs difficulty, a straight run does not. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  /* The engine's lent capabilities — resolved at call time, because the engine
     loads after this file and `HubEnv` does not exist yet at parse. */
  const E = () => window.HubEnv;

  /* Quickfire reads Millionaire's bank rather than owning one — see the
     registration. Held separately because `load()` runs per game and a shared
     variable would tie the two games' content screens together for no gain. */
  let KAHOOT_BANK          = [];
  let KAHOOT_SECTION_NAMES = {};
  let KAHOOT_TOPIC_NAMES   = {};

  let kQueue = [], kAt = -1, kCurrent = null, kAsked = 0;
  let kPaid = null, kOver = false;

  const kSecs      = () => Number(S.get('kSeconds', 'kahoot')) || 20;
  const kBase      = () => Number(S.get('kPoints',  'kahoot')) || 100;
  const kWanted    = () => Number(S.get('kQuestions', 'kahoot')) || 15;
  const kLeft      = () => K.round.clock.left();
  const kLive      = () => !!kCurrent && !kOver;

  /* This board's round-host entry — merged into the engine's ROUND_HOSTS at its
     init, so the shared adapter never learns the table gained a row from a file. */
  const HOST = {
    game:'kahoot', stage:'play-kahoot',
    /* No clue card here — the options are the stage, exactly as on the
       Millionaire board. F3.8.9's second caller: the mount is a declared fact. */
    mount: () => document.getElementById('k-options'),
    commit:'k-commit',
    live: () => kLive(),
    turn: () => E().activeTeam(),
    /* **The one thing about this skin that is genuinely new.** Every other board
       has a slot that one team takes. Here the question belongs to nobody, every
       team answers it, and each is paid for its own answer at its own speed — the
       settle path pays each right team as it settles instead of ending on the
       first. */
    scoreEach: true,
    /* How long a question runs, and what a slow right answer keeps — the two
       declared facts a board needs to score by speed. The curve itself is a
       shared rule (`PAY_RULES.clock`), so this skin owns no arithmetic about
       time; what it owns is the decision that time matters here. */
    clock: () => kSecs(),
    step:  () => 5,
    worth: () => kBase(),
    /* The clock is the opponent, so a tap is a commitment — changing your mind
       after seeing where the room went is the opposite of what this board
       measures. */
    lockIn: true,
    /* The only host that uses what the rule decided: it has no slot, so the rule
       is the whole payment. */
    win: (team, points) => kPay(team, points),
    // counts, not team dots: the interesting fact is how much of the room got it
    countVotes: () => true,
    commitText: () => 'Lock it in'
  };

  /* Quickfire's three weights. All classroom questions rather than design ones —
     every one is a guess until a class has met them. */
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

  /* The two buttons exist only after the engine injects the stage, so they are
     wired on the first `load` rather than at parse — the one ordering fact an
     external game's DOM work has to respect. */
  let wired = false;
  function wire(){
    if(wired) return;
    wired = true;
    /* `k-commit` is the shared round commit — the same button every host
       declares, for the teacher playing with no relay in the room. `k-next` is
       the only thing on this board that advances: there is no tile to click. */
    document.getElementById('k-commit').addEventListener('click', ()=> E().roundCommit());
    document.getElementById('k-next').addEventListener('click', ()=> nextKahoot());
  }

  window.HubGames.register({
    id:'kahoot', title:'Quickfire',
    /* After the five in-engine boards, which sit at the default 50 — this file
       loads before the engine, and without the number it would jump to the front
       of every card row and settings tab. */
    order: 60,
    /* `scoreEach` already pays every competitor for its own answer at its own
       speed — exactly the individual model — so solo needed no scoring work. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="21" r="13"/><path d="M20 13 L20 21 L26 25"/><path d="M14 6 L26 6"/><path d="M20 6 L20 8"/></svg>',
      blurb:'Fifteen questions against the clock. Every team answers every one, and the faster you are the more it pays.',
      badge:'Best for: fast revision, everyone in at once' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'QUICKFIRE',
            sub:'Fifteen questions. No turns. The clock is the opponent.', accent:'#2BD9C4' },
    /* Consumed, not authored — the bank is Millionaire's, already
       `{prompt, answer, distractors}`, so three units gained this game free. */
    hasBank: u => (u.millionaireBank || []).length >= 5,
    roundHost: HOST,
    stageHTML: `
      <!-- Quickfire. The first board with no geometry at all: a straight run of
           questions against a clock, so there is nothing to choose and nothing to
           claim. The round mounts into #k-options exactly as on the Millionaire
           stage. Declared here and injected by the engine — an external game does
           not edit the skeleton. -->
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
      </div></div>`,
    /* A latecomer is a new competitor mid-run; the team bar under the board just
       got a name taller, so the fit is what needs re-running. */
    onRoster(){ fitKahoot(); },
    load(u){ wire();
             KAHOOT_BANK          = u.millionaireBank || [];
             KAHOOT_SECTION_NAMES = u.millionaireSectionNames || {};
             KAHOOT_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => KAHOOT_BANK,
    renderContent: renderKahootContent,
    startButton:   kahootStartButton,
    start(){ startKahoot(); },
    fit:       fitKahoot,
    onResize:  fitKahoot,
    tension(){ kTension(); },
    expects:     () => (kCurrent && kCurrent.answer) || '',
    phonePrompt: () => (kCurrent && kCurrent.prompt) || '',
    askingNow:   () => kLive(),
    /* Every question is a round, and always the same one — built from the bank
       the way Millionaire builds it, so the bank never learns the word "choice". */
    asRound:     q => E().asChoiceRound(q),
    phoneRound(){ return E().roundForPhones(); },
    wantsVote:   () => E().roundLive(),
    onVoteReply(all){ if(E().roundLive()) E().roundOnReplies(all); }
  });

  function kAsRound(q){ return E().asChoiceRound(q); }

  function renderKahootContent(list, help){
    help.textContent = 'Pick which sections to draw from. Questions are shuffled, and the run stops after the number set in ⚙.';
    E().groupCheckboxes(list, KAHOOT_BANK, KAHOOT_TOPIC_NAMES, KAHOOT_SECTION_NAMES);
  }
  function kahootStartButton(btn){
    const n = Math.min(kWanted(), selectedKahoot().length);
    btn.textContent = n ? 'Start — ' + n + ' questions' : 'Pick at least one section';
    btn.disabled = !n;
  }
  function selectedKahoot(){
    return KAHOOT_BANK.filter(i => E().selectedContent().includes(E().groupOf(i)));
  }

  function startKahoot(){
    kQueue = E().shuffle(selectedKahoot().slice()).slice(0, kWanted());
    kAt = -1; kCurrent = null; kAsked = 0; kOver = false;
    kStopClock();
    document.getElementById('k-next').style.display = 'none';
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
       whichever board asked last — the trap `roundOf` carries a note about. */
    E().roundEnd();                   // the previous question's handsets stand down
    const found = E().roundOf(kAsRound(kCurrent), 'kahoot');
    document.getElementById('k-question').textContent = '';
    E().drawPrompt(document.getElementById('k-question'), kAsRound(kCurrent), 'kahoot');
    /* Opening the round arms the room. Every question here is a round, so there
       is no ordinary-question path to fall back to. */
    if(!(found && E().roundOpen(found))) E().askPhones(kCurrent.prompt, 'kahoot');

    kStartClock();
    kTension();
    fitKahoot();
  }

  /* The shared clock, painted onto this stage — the painting is all a host should
     ever own of a clock, because the number itself is what the value curve reads
     and there can only be one of those. */
  function kStartClock(){
    K.round.clock.start({ secs: E().roundClockSecs(HOST),
                          onTick: kPaintClock, onEnd: kTimeUp });
  }
  function kStopClock(){ K.round.clock.stop(); }
  function kPaintClock(left){
    const el = document.getElementById('k-secs');
    if(!el) return;
    const secs = left == null ? K.round.clock.left() : left;
    el.textContent = Math.ceil(secs);
    document.getElementById('k-clock').classList.toggle('low', secs <= 5);
  }

  /* Time up is a fact, not a verdict — the same rule Jeopardy's answer clock
     follows. The round is ended so thirty handsets stop taking taps, the answer
     is revealed because nothing else on this board ever would. */
  function kTimeUp(){
    if(kOver) return;
    E().Sound.play('timeup');
    kEndQuestion();
  }

  /* One definition of "this question is over", whoever decided it — the clock,
     or the teacher committing with no phones in the room. Two paths that end a
     question differently is the bug that shape invites. */
  function kEndQuestion(){
    if(kOver) return;
    kOver = true;
    kStopClock();
    kPaintClock();
    /* Reveal before ending: the options stay on screen here, so ending without
       revealing leaves four live-looking options and no answer. */
    E().revealOpenRound();
    E().roundEnd();
    const got = Object.keys(kPaid || {}).length;
    document.getElementById('k-hint').textContent =
      got ? (got === 1 ? 'One team got it.' : got + ' teams got it.') : 'Nobody got that one.';
    document.getElementById('k-next').style.display = 'inline-block';
    document.getElementById('k-next').textContent =
      kAt + 1 >= kQueue.length ? 'See the results' : 'Next question';
    kTension();
    /* The movement is this board's whole point — the shared standings replace the
       leaderboard that used to squeeze inside this stage. Not on the last
       question: the final results are one beat later, and two tables in a row is
       one too many. */
    if(E().standingsWanted('kahoot') && kAt + 1 < kQueue.length){
      E().showStandings({ eyebrow:'Question ' + kAsked + ' of ' + kQueue.length,
                          title: got ? (got === 1 ? 'One team got it' : got + ' teams got it')
                                     : 'Nobody got that one',
                          action:'Next question' });
    }
  }

  /* What this skin pays. Called once per team by the shared settle path, and the
     amount is the running rule's — this board has no slot, so there is nothing
     for it to decide beyond passing it on. */
  function kPay(team, points){
    if(!kPaid || kPaid[team] != null) return kPaid ? kPaid[team] : 0;
    /* Through `award`, so the receipt and the scoreboard repaint come free.
       `streak:false`: every team answers every question, so a run would only
       measure who has been right most recently — which the points already say. */
    const rec = K.round.results.of(team) || {};
    const paid = E().award(team, points || 0, { streak:false,
      why: 'quickfire · ' + E().payRuleLabel('kahoot') +
           (rec.seconds != null ? ' · ' + rec.seconds.toFixed(1) + 's' : '') });
    kPaid[team] = paid;
    /* The no-relay path ends the question here: with no phones the teacher's
       commit runs the shared take path, so the round is finished by the time this
       is called — without noticing, the board sat on a dead question. */
    if(E().roundDone()) setTimeout(kEndQuestion, 0);
    return paid;
  }

  function finishKahoot(){
    kCurrent = null; kOver = true;
    kStopClock();
    document.getElementById('k-next').style.display = 'none';
    document.getElementById('k-count').textContent = 'Finished';
    const rank = E().teams().map((t, i) => ({ i, name:t.name, pts:t.score }))
                            .sort((a, b) => b.pts - a.pts);
    const top  = rank[0];
    const tie  = rank.filter(r => r.pts === top.pts);
    E().showResult({
      eyebrow: kQueue.length + ' questions',
      title:   tie.length > 1 ? 'A tie' : top.name + ' wins',
      sub:     tie.length > 1
                 ? tie.map(r => r.name).join(' and ') + ' — ' + top.pts + ' each'
                 : top.pts + ' points',
      tone:    'gold',
      actions: [{ label:'New run', onPick: startKahoot }]
    });
  }

  /* Fit the **wrapper**, not the stage — the scoreboard sat below the stage once,
     and sizing the stage to the floor pushed the board off the bottom.
     `floor:true` because a handset genuinely cannot fit this much. */
  function fitKahoot(){
    const wrap = document.getElementById('k-wrap');
    if(!wrap || window.HubGames.active() !== 'kahoot') return;
    K.fitToScreen(wrap, { min:260, gap:18, floor:true });
  }

  function kTension(){
    const stage = document.getElementById('play-kahoot');
    if(!stage) return;
    const on = E().themeOf('kahoot') === 'gameshow' && window.HubGames.active() === 'kahoot';
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); E().Sound.bedStop(); return; }
    /* Two ingredients, like Race: how far through the run, and whether a question
       is live this second — a board sitting on a revealed answer should not be as
       tense as one with four seconds left. */
    const through = kQueue.length ? kAsked / kQueue.length : 0;
    const urgent  = kLive() && kSecs() ? 1 - (kLeft() / kSecs()) : 0;
    const t = Math.min(1, through * 0.6 + urgent * 0.4);
    stage.style.setProperty('--tension', t.toFixed(3));
    if(kLive() && E().motionOK()) E().Sound.bedStart(t); else E().Sound.bedStop();
  }
})();
