/* ================= Race to the Board — extracted from the engine into its own file =================

   Target words sit on screen; the teacher reads a gapped sentence and a student runs
   to the projector and touches the word. The screen isn't a touchscreen, so the
   teacher clicks the word the student touched. One team plays at a time against the
   clock (timed), or both race the same word (head-to-head) — which keeps scoring
   unambiguous: the engine can't tell who tapped, but it always knows whose round it is.

   **Third of the four originals to leave hub-engine.js.** Like Millionaire it mounts a
   round on its own stage rather than the clue card, so it needs no clue-card surface.
   Unlike Millionaire it holds no per-team parallel array — its state is per word and
   per queue, and `active` it reads fresh — so it needs no onTeamsChanged hook. Its one
   reach past the round adapter is the floor winner (who buzzed in first, for the
   head-to-head award), lent as `HubEnv.floorWinner`.

   The board's own play stage is injected as `stageHTML`; the content-screen mode
   picker (`#race-mode`, `#race-rules`) stays in the engine skeleton, the same as
   Blockbusters' rules note, and this file only drives it. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  const E = () => window.HubEnv;

  let RACE_BANK          = [];
  let RACE_SECTION_NAMES = {};
  let RACE_TOPIC_NAMES   = {};

  const RACE_MIN_WORDS     = 10;   // playable from a single lesson section
  const RACE_MAX_WORDS     = 18;   // beyond this the words stop being readable at distance
  const RACE_ROUND_SECONDS = 60;

  let raceMode    = 'h2h';  // 'h2h' = both teams race the same word; 'timed' = one team per round
  let raceWords   = [];     // [{word, section, found, by}] — what's on the board
  let raceQueue   = [];     // prompts still to ask; a missed one goes to the back
  let raceCurrent = null;
  let raceRunning = false;
  let racePending = null;   // {w, el} — correct word clicked, waiting on "who got it?"
  /* Who has already missed the sentence currently up, so a team cannot buzz straight
     back in and retry a word it just got wrong. */
  let raceFailed  = new Set();
  let raceClaim   = null;   // the shared team chooser, built on first load

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

  /* This board's round-host entry — merged into the engine's ROUND_HOSTS at init. Race
     owns the *card* (the scattered words are the answer surface), so a round here mounts
     on the prompt strip rather than opening a clue over the board. */
  const HOST = {
    game:'race', stage:'play-race',
    mount: () => document.getElementById('race-round'),
    commit:'race-commit',
    live: () => !!raceCurrent && raceRunning !== false && !!E().roundState(),
    turn: () => E().activeTeam(),
    /* A word is worth a point, so a round is worth a point — paid through the same path
       a touched word is, which is what makes the strip, the streak and the scoreboard
       follow without this knowing about any of it. */
    win:  team => { awardRaceRound(team); return 1; },
    worth: () => 1,
    step:  () => 1,
    /* Two people at the screen, and in head-to-head nobody is on turn — so a round here
       is the whole room's, exactly as a Connections tile is. */
    teamMode: true
  };

  S.register({ id:'raceRescatter', group:'Race to the Board', type:'toggle', default:true, games:['race'],
    label:'Re-scatter after every claim', help:'Moves the words each time one is won, so nobody wins on memory alone.' });
  S.register({ id:'raceRoundSeconds', group:'Race to the Board', type:'select', default:60, games:['race'],
    label:'Timed round length', help:'Only used in timed team rounds.',
    options:[{value:45,label:'45 seconds'},{value:60,label:'60 seconds'},{value:90,label:'90 seconds'}] });
  S.register({ id:'raceShowSection', group:'Race to the Board', adv:true, type:'toggle', default:true, games:['race'],
    label:'Show the section tag', help:'The small 5A / 5B label above the sentence.' });

  /* The board's controls and the mode picker exist only after the engine injects the
     stage (and the mode picker lives in the always-present content screen), so they are
     wired on the first load rather than at parse. */
  let wired = false;
  function wire(){
    if(wired) return;
    wired = true;
    raceClaim = K.claimTeam({
      mount:  document.getElementById('race-claim'),
      onPick: i => awardRaceWord(i)
    });
    document.querySelectorAll('#race-mode input[name="racemode"]').forEach(r=>{
      r.addEventListener('change', ()=>{ raceMode = r.value; renderRaceRules(); });
    });
    document.getElementById('race-start').addEventListener('click', startRaceRound);
    document.getElementById('race-skip').addEventListener('click', ()=>{
      if(!raceRunning || !raceCurrent) return;
      if(racePending){ racePending.el.classList.remove('pending'); racePending=null; hideClaimBar(); }
      raceQueue.push(raceCurrent);
      nextRacePrompt();
    });
  }

  window.HubGames.register({
    id:'race', title:'Race to the Board',
    order: 52,   // keeps its slot ahead of Millionaire(53)/Bingo(55)/Quickfire(60)
    /* Two people at the screen is what this board *is*, so individuals suit it better
       than teams. The one rough edge is the claim chooser — with sixteen people the
       teacher picks from sixteen chips — and phones in `type` mode remove it outright,
       because a typed word already carries who produced it. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="6" rx="1.5"/><rect x="21" y="9" width="15" height="6" rx="1.5"/><rect x="5" y="20" width="15" height="6" rx="1.5"/><rect x="24" y="24" width="12" height="6" rx="1.5"/><path d="M13 36 L20 30 L27 36"/></svg>',
      blurb:'Target words scattered on screen. Read the sentence aloud &mdash; a student runs up and touches the missing word.',
      badge:'Best for: getting them out of their seats' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'RACE TO THE BOARD',
            sub:'On your marks. Listen for the gap. Get there first.',
            accent:'#3DFFA8', titleVw:'6.4vw' },
    hasBank: u => (u.raceBank||[]).length > 0,
    roundHost: HOST,
    stageHTML: `
      <!-- Race to the Board. The scattered words are the answer surface; a round mounts
           into #race-round, under the prompt and above the bar. Declared here and
           injected by the engine. -->
      <div id="play-race">
        <div id="race-prompt"></div>
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
            <button id="race-commit" style="display:none;">Check</button>
          </div>
        </div>
        <div id="race-words"></div>
      </div>`,
    load(u){ wire();
             RACE_BANK          = u.raceBank || [];
             RACE_SECTION_NAMES = u.raceSectionNames || {};
             RACE_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => RACE_BANK,
    // head-to-head has no "whose turn" — both teams are at the board at once
    turnTeam: () => raceMode==='h2h' ? -1 : E().activeTeam(),
    onSetting(id){
      if(id==='raceShowSection' && raceCurrent) setRacePrompt(raceCurrent);
      if(id==='raceRoundSeconds' && raceMode==='timed' && !raceRunning){
        E().timerSetDuration(Number(S.get('raceRoundSeconds', 'race')) || 60);
      }
    },
    renderContent: renderRaceContent,
    startButton:   raceStartButton,
    start(){
      buildRaceBoard();
      E().syncBuzzRoom();
      E().timerSetDuration(Number(S.get('raceRoundSeconds', 'race')) || 60);
    },
    expects:     () => (raceCurrent && raceCurrent.answer) || '',
    phonePrompt: () => (raceCurrent && raceCurrent.prompt) || '',
    askingNow:   () => !!raceCurrent,
    // a team that has already missed this sentence cannot buzz back in on it
    buzzEntitled: b => raceCanTry(b.team),
    phoneRound(){ return E().roundForPhones(); },
    wantsVote:   () => E().roundLive(),
    onVoteReply(all){ if(E().roundLive()) E().roundOnReplies(all); },
    /* The typed word is the claim here too, and awarding it deals the next sentence —
       so this returns *after* the award and the engine names the student on the strip,
       which outlives the re-arm. */
    onTypedWin(b){
      if(!raceCurrent) return null;
      const w = raceWords.find(x => x.word === raceCurrent.answer);
      if(!w || w.found) return null;
      const el = [...document.querySelectorAll('#race-words .race-word')]
                   .find(n => n.textContent === w.word) || null;
      E().Sound.play(document.getElementById('play-race').classList.contains('lit') ? 'sting' : 'correct');
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

  function renderRaceContent(list, help){
    document.getElementById('race-rules').style.display='block';
    document.getElementById('race-mode').style.display='block';
    renderRaceRules();
    help.textContent = "Pick the topics that feed the board — the vocabulary and the grammar of each section are separate, so you can drill just what you taught. Every word on screen is a target word from your selection.";
    E().groupCheckboxes(list, RACE_BANK, RACE_TOPIC_NAMES, RACE_SECTION_NAMES);
  }

  function raceStartButton(btn){
    const total = RACE_BANK.filter(E().inPlay).length;
    E().startGate(btn, { picked: E().selectedContent().length > 0, total, need: RACE_MIN_WORDS,
      short: `Need ${RACE_MIN_WORDS} words for a board`,
      ready: `Build board — ${Math.min(total, RACE_MAX_WORDS)} of ${total} words, shuffled` });
  }

  function renderRaceRules(){
    document.getElementById('race-rules').innerHTML = RACE_MODE_RULES[raceMode];
  }

  function buildRaceBoard(){
    const chosen = RACE_BANK.filter(E().inPlay);
    /* **The board is built from the words, the queue from everything.** An ordinary
       item puts its answer on the board as a tile; a round item has no single answer,
       so it contributes no tile and is simply a question in the queue. */
    const words  = E().shuffle(chosen.filter(c => !raceIsRound(c))).slice(0, RACE_MAX_WORDS);
    const rounds = chosen.filter(raceIsRound);
    const picked = words;
    raceWords   = picked.map(p=>({ word:p.answer, section:p.section, found:false, by:-1 }));
    raceQueue   = E().shuffle(picked.concat(rounds));
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

  /* Spread the words over the whole field so students genuinely have to cross the room.
     A jittered grid, never random placement, because it can never overlap — unreadable
     words are worse than tidy ones. The top strip is left free: on a wall-mounted
     projector the very top is out of reach, and that's where the sentence lives. */
  function scatterRaceWords(){
    const field = document.getElementById('race-words');
    const tiles = [...field.querySelectorAll('.race-word')];
    if(!tiles.length) return;

    field.style.setProperty('--rs', 1);            // reset any previous down-scaling
    const W = field.clientWidth;
    // nothing is measurable while the play screen is still hidden — the caller re-runs
    // this once the screen is up
    const avail = W < 50 ? 0 : K.fitToScreen(field, { min:240, gap:10 });
    if(!avail) return;

    /* Shrink the type until the grid genuinely fits, then place one word per cell. Two
       things make "one per cell" insufficient, and both bit at 1280x720 with the
       longest words: the tilt grows the box (a rotated element occupies more room than
       its layout size, proportional to width — so long words collide vertically), and
       the jitter can eat the whole margin. So size the cells to the *grown* box, and
       keep a gutter the jitter can't spend. */
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
    E().shuffle(slots);

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
    // the shared renderer draws the blank the same way every game does. Never revealed
    // here: the answer is a word on the board for a student to find.
    E().drawPrompt(sent, { text:item.prompt, answer:item.answer, type:item.type }, 'race');
    el.appendChild(sec); el.appendChild(sent);
  }

  /* A round item has no single answer, so it puts no word on the board. Recognised
     before the tile loop, because "is this a round" is a question about the item and
     "is its word still on the board" is a question about the board. */
  const raceIsRound = item => !!K.round.of(item);

  function nextRacePrompt(){
    while(raceQueue.length){
      const item = raceQueue.shift();
      if(raceIsRound(item)){
        raceCurrent = item; raceFailed = new Set();
        setRacePrompt(item); updateRaceBar();
        /* Opening the round arms the room, exactly as on every other host. A round that
           fails to set up falls through to the ordinary path. */
        if(!raceOpenRound(item)) E().askPhones(item.prompt, 'race');
        rTension();
        return;
      }
      const w = raceWords.find(x=>x.word===item.answer);
      if(w && !w.found){
        raceCurrent=item; raceFailed = new Set(); setRacePrompt(item); updateRaceBar();
        /* Through askPhones, not armBuzzers: both modes ask the room, so `phoneMode`
           is honoured — one team on the clock (timed) or two racing (h2h), and a buzz
           from anyone not entitled is refused by buzzEntitled. */
        E().askPhones(item.prompt, 'race');
        // the sentence going up is the starting gun — that is the moment they run
        if(document.getElementById('play-race').classList.contains('lit')) E().Sound.crack();
        rTension();
        return;
      }
    }
    raceCurrent=null;
    endRaceRound(true);
  }

  /* The two calls a host makes: name yourself at `roundOf`, then open. */
  function raceOpenRound(item){
    E().roundEnd();
    /* **The item the round is playing**, which the shared re-ask reads through
       `currentClueItem` — without it a round button that moves the question redrew the
       board and left thirty handsets on the previous one. */
    E().setClueItem(item);
    const found = E().roundOf(item, 'race');
    const opened = found ? E().roundOpen(found) : null;
    document.getElementById('race-round').style.display = opened ? 'block' : 'none';
    if(opened) scatterRaceWords();     // the stage just changed height under the board
    return !!opened;
  }

  /* A round pays a point, the same as a touched word, and the board moves on. There is
     no tile to colour, so this is the short version of `awardRaceWord`. */
  function awardRaceRound(team){
    E().award(team, 1, { why:'race round' });
    raceCurrent = null;
    document.getElementById('race-round').style.display = 'none';
    setTimeout(()=>{ if(raceRunning) nextRacePrompt(); else updateRaceBar(); }, 700);
  }

  function startRaceRound(){
    if(!raceWords.some(w=>!w.found)) return;
    raceRunning=true;
    if(raceMode==='timed'){ E().timerReset(); E().timerStart(); }
    nextRacePrompt();
  }

  function endRaceRound(cleared){
    raceRunning=false;
    hideClaimBar();
    /* A round outlives nothing here: the clock stopping ends the question, so the
       handsets stand down and the mount goes with them. */
    E().roundEnd();
    document.getElementById('race-round').style.display = 'none';
    E().resetBuzzers();
    // the sentence on screen when the clock stopped hasn't been answered — put it back
    // in the queue, or its word could never be claimed and the board never clears
    if(raceCurrent){
      const w = raceWords.find(x=>x.word===raceCurrent.answer);
      if(w && !w.found) raceQueue.push(raceCurrent);
    }
    raceCurrent=null;
    E().timerStop();
    const showy = document.getElementById('play-race').classList.contains('lit');
    E().Sound.bedStop();
    if(cleared){
      if(showy){ E().Sound.fanfare(); setTimeout(()=>E().Sound.applause(2400), 640); }
      else E().Sound.play('clear');
      setRaceMessage('Board cleared — final scores are in the team bar.');
    } else {
      E().Sound.play(showy ? 'klaxon' : 'end');
      E().nextTurn();                   // timed mode: hand the board to the next team
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
    const teams    = E().teams();
    const active   = E().activeTeam();
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

  /* Race's tension curve. No rung, tile value or line to a target — but two things that
     matter at once: how much of the board is gone, and whether a race is happening
     right now. A sentence going up is the moment students leave their chairs, so it
     counts for nearly as much as a nearly-empty board. Deliberately the same in both
     modes — the timed header clock already goes red under ten seconds. */
  function rDeal(){
    E().dealStagger('play-race', document.getElementById('race-words'), wrap => {
      [...wrap.querySelectorAll('.race-word')].forEach((el, i)=> el.style.setProperty('--i', i));
    }, 1800);
  }

  function rTension(){
    E().stageTension('race', (stage) => {
      const done  = raceWords.filter(w=>w.found).length;
      const clear = raceWords.length ? done/raceWords.length : 0;
      const live  = !!(raceRunning && raceCurrent);
      stage.classList.toggle('running', live);
      return { t: Math.min(1, 0.6*clear + (live ? 0.4 : 0)), live };
    });
  }

  function raceCanTry(teamIdx){
    /* In a timed round only the team whose round it is may buzz. Head-to-head has both
       teams at the board at once; timed is one team against the clock, so a buzz from
       the bench would steal a word off someone else's score. */
    if(raceMode === 'timed' && teamIdx !== E().activeTeam()) return false;
    return !S.get('stealOnWrong', 'race') || !raceFailed.has(teamIdx);
  }

  function onRaceWordClick(w, el){
    if(!raceRunning || !raceCurrent || w.found || racePending) return;
    const showy = document.getElementById('play-race').classList.contains('lit');
    const teams = E().teams();
    if(w.word === raceCurrent.answer){
      E().Sound.play(showy ? 'sting' : 'correct');
      el.classList.remove('wrong');
      if(raceMode==='h2h'){
        const bw = E().floorWinner();
        if(bw && teams[bw.team]){
          // a phone already told us who got in first — no need to ask
          racePending = { w, el };
          awardRaceWord(bw.team, el);
          return;
        }
        // nobody buzzed (or no buzzers at all) — fall back to asking, minus anyone who
        // has already had their shot at this sentence
        racePending = { w, el };
        el.classList.add('pending');
        showClaimBar();
      } else {
        awardRaceWord(E().activeTeam(), el);
      }
    } else {
      E().Sound.play(showy ? 'klaxon' : 'wrong');
      el.classList.add('wrong');
      setTimeout(()=>el.classList.remove('wrong'), 600);
      if(raceMode==='timed'){
        // keep the pace up: no penalty, but move on — the sentence returns later
        raceQueue.push(raceCurrent);
        nextRacePrompt();
      } else {
        /* h2h: the sentence stays up so the other team can steal it. Only record a
           failure when a phone actually told us who it was — head-to-head has no team
           on turn, so blaming `active` would invent a fact and lock a team out of a
           sentence they may never have tried. */
        const bw = E().floorWinner();
        if(bw && teams[bw.team]) raceFailed.add(bw.team);
        // only the racing modes have a floor to hand back; in 'write' the whole class
        // is answering and there is nothing to re-open
        if(E().room() && E().phoneRaces()) E().armBuzzers(raceCurrent.prompt);
      }
    }
  }

  // Award the pending (or, in timed mode, the just-clicked) word to a team.
  function awardRaceWord(teamIdx, elOverride){
    const hit = racePending || { w: raceWords.find(x=>x.word===raceCurrent.answer), el:elOverride||null };
    if(!hit.w) return;
    hit.w.found = true;
    hit.w.by    = teamIdx;
    E().award(teamIdx, 1, { why:'word · ' + (hit.w.word || '') });
    E().markRun(teamIdx, true);
    racePending = null;
    hideClaimBar();
    E().resetBuzzers();
    E().renderScorebar();
    if(S.get('raceRescatter', 'race')){
      renderRaceWords();   // re-scatter, so nobody wins on remembering where a word sat
    } else if(hit.el){
      hit.el.classList.remove('pending');
      hit.el.classList.add('found', 'team-'+Math.min(teamIdx,3));
    }
    rTension();
    nextRacePrompt();
  }

  function showClaimBar(){
    /* **A live round owns the verdict**, so this board's own way of awarding stands
       down while one is open — otherwise the chooser is a second way to pay for the
       same question. */
    if(E().roundLive()){ hideClaimBar(); return; }
    const teams = E().teams();
    const allow = teams.map((_, i) => i).filter(raceCanTry);
    raceClaim.show(teams, allow.length ? allow : null);
  }
  function hideClaimBar(){
    if(raceClaim) raceClaim.hide();
    if(racePending && racePending.el) racePending.el.classList.remove('pending');
  }
})();
