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

  /* ---- feature switches. Adding a feature? Register it here and the settings
     panel picks it up automatically — there is no panel markup to edit. ---- */
  S.register({ id:'sound', group:'Sound', type:'toggle', default:true, games:['jeopardy','blockbusters','race','millionaire'],
    label:'Sound effects', help:'Short tones for a right answer, a wrong one, and a cleared board.' });
  S.register({ id:'soundVolume', group:'Sound', type:'select', default:'med', games:['jeopardy','blockbusters','race','millionaire'],
    label:'Volume', help:'Classroom speakers are usually louder than they sound at your desk.',
    options:[{value:'quiet',label:'Quiet'},{value:'med',label:'Medium'},{value:'loud',label:'Loud'}] });

  S.register({ id:'cardFlip', group:'Clue card', type:'variant', default:'grow-turn',
    games:['jeopardy','blockbusters'],
    label:'Card animation', help:'How the clue card arrives. Try them mid-game and keep whichever reads best in your room.',
    variants:[{value:'off',       label:'None — opens instantly'},
              {value:'grow-turn', label:'Grow, then turn over'},
              {value:'turn-only', label:'Turn on the spot'},
              {value:'rise',      label:'Rise up — no 3D'}] });

  S.register({ id:'flipSpeed', group:'Clue card', type:'select', default:'normal',
    games:['jeopardy','blockbusters'],
    label:'Flip speed', help:'How long the card takes to turn over and come back.',
    options:[{value:'relaxed',label:'Relaxed'},{value:'normal',label:'Normal'},{value:'snappy',label:'Snappy'}] });

  S.register({ id:'mLifelines', group:'Millionaire', type:'toggle', default:true, games:['millionaire'],
    label:'Lifelines', help:'50:50, Ask the class, and Confer — one use each per team.' });
  S.register({ id:'mConferSeconds', group:'Millionaire', type:'select', default:30, games:['millionaire'],
    label:'Confer time', help:'How long a team gets to consult when they use Confer.',
    options:[{value:30,label:'30 seconds'},{value:45,label:'45 seconds'},{value:60,label:'60 seconds'}] });

  S.register({ id:'buzzers', group:'Phone buzzers', type:'toggle', default:false,
    label:'Phone buzzers', help:'Students join on their phones and buzz to win the right to answer. Needs a relay — this will not work from the GitHub Pages copy. See docs/buzzers.md.' });
  S.register({ id:'buzzerRelay', group:'Phone buzzers', type:'text', default:'',
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
    const VOICES = {
      correct:[{f:660,d:0.09},{f:990,d:0.13}],
      wrong:  [{f:180,d:0.16,type:'sawtooth'},{f:120,d:0.18,type:'sawtooth'}],
      claim:  [{f:523,d:0.07},{f:784,d:0.07},{f:1047,d:0.14}],
      end:    [{f:440,d:0.14},{f:330,d:0.2}],
      clear:  [{f:523,d:0.1},{f:659,d:0.1},{f:784,d:0.1},{f:1047,d:0.28}],
      flip:   [{f:240,to:820,d:0.3,type:'sine'}],
      reveal: [{f:880,d:0.07},{f:1319,d:0.19}]
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
    return { play };
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
      <div class="game-grid">
        <div class="game-card" data-game="jeopardy">
          <svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="9" height="7" rx="1"/><rect x="15.5" y="6" width="9" height="7" rx="1"/><rect x="27" y="6" width="9" height="7" rx="1"/><rect x="4" y="16.5" width="9" height="7" rx="1"/><rect x="15.5" y="16.5" width="9" height="7" rx="1"/><rect x="27" y="16.5" width="9" height="7" rx="1"/><rect x="4" y="27" width="9" height="7" rx="1"/><rect x="15.5" y="27" width="9" height="7" rx="1"/><rect x="27" y="27" width="9" height="7" rx="1"/></svg>
          <h3>Jeopardy</h3>
          <p>Category board, five point values each. Teams pick a tile, answer, bank the points.</p>
          <span class="badge">Best for: mixed vocab &amp; grammar</span>
        </div>
        <div class="game-card" data-game="blockbusters">
          <svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4 L33 11.5 L33 26.5 L20 34 L7 26.5 L7 11.5 Z"/><path d="M20 13 L26 16.5 L26 23.5 L20 27 L14 23.5 L14 16.5 Z"/></svg>
          <h3>Blockbusters</h3>
          <p>Hexagon board. Yellow connects left&rarr;right, Blue connects top&rarr;bottom, by answering letter clues.</p>
          <span class="badge">Best for: single-word / short-answer vocab</span>
        </div>
        <div class="game-card" data-game="race">
          <svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="6" rx="1.5"/><rect x="21" y="9" width="15" height="6" rx="1.5"/><rect x="5" y="20" width="15" height="6" rx="1.5"/><rect x="24" y="24" width="12" height="6" rx="1.5"/><path d="M13 36 L20 30 L27 36"/></svg>
          <h3>Race to the Board</h3>
          <p>Target words scattered on screen. Read the sentence aloud &mdash; a student runs up and touches the missing word.</p>
          <span class="badge">Best for: getting them out of their seats</span>
        </div>
        <div class="game-card" data-game="millionaire">
          <svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 34 L8 26"/><path d="M16 34 L16 20"/><path d="M24 34 L24 14"/><path d="M32 34 L32 7"/><path d="M4 34 L36 34"/></svg>
          <h3>Millionaire</h3>
          <p>Four options, rising difficulty. Teams climb their own ladder, with 50:50, Ask the class and Confer to spend.</p>
          <span class="badge">Best for: spotting the near-miss answer</span>
        </div>
      </div>
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
      <div id="play-jeopardy">
        <div id="board"></div>
      </div>
      <div id="play-blockbusters">
        <div id="legend">
          <span class="legend-gold"><span class="dot" style="background:var(--gold)"></span> Yellow: left &rarr; right</span>
          <span class="legend-silver"><span class="dot" style="background:var(--silver)"></span> Blue: top &rarr; bottom</span>
        </div>
        <div id="hexwrap"></div>
      </div>
      <div id="play-race">
        <div id="race-prompt"></div>
        <div id="race-bar">
          <div id="race-status"></div>
          <div id="buzzer-chip" style="display:none;"></div>
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
              <button id="m-next" style="display:none;">Next team</button>
              <button id="m-done-count" style="display:none;">Done counting</button>
            </div>
          </div>
          <div id="m-ladder"></div>
        </div>
      </div>
    </div>

    <!-- persistent team bar (always visible, all screens) -->
    <div id="scorebar"></div>

    <!-- shared clue modal -->
    <div id="clue-modal">
      <div id="clue-card">
        <div id="clue-front"><span id="clue-front-text"></span></div>
        <div id="clue-back">
        <div id="clue-topline"></div>
        <div id="clue-section"></div>
        <div id="clue-text"></div>
        <div id="clue-answer"></div>
        <div id="clue-actions">
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
  let RACE_BANK                 = [];
  let RACE_SECTION_NAMES        = {};
  let MILLIONAIRE_BANK          = [];
  let MILLIONAIRE_SECTION_NAMES = {};

  const GAME_TITLES = { jeopardy:'Jeopardy', blockbusters:'Blockbusters',
                        race:'Race to the Board', millionaire:'Millionaire' };
  window.HUB_GAME_TITLES = GAME_TITLES;      // the settings panel labels its tabs with these

  // Which games a unit can actually offer — a unit without a bank for a game
  // simply doesn't show that card, so units can adopt new games one at a time.
  function gamesFor(u){
    const g=[];
    if((u.jeopardyCategories||[]).length) g.push('jeopardy');
    if((u.blockbustersBank||[]).length)   g.push('blockbusters');
    if((u.raceBank||[]).length)           g.push('race');
    if((u.millionaireBank||[]).length)    g.push('millionaire');
    return g;
  }

  function loadUnit(u){
    UNIT = u;
    JEOPARDY_SECTION_LABELS    = u.jeopardySectionLabels || {};
    JEOPARDY_CATEGORIES        = u.jeopardyCategories || [];
    BLOCKBUSTERS_BANK          = u.blockbustersBank || [];
    BLOCKBUSTERS_SECTION_NAMES = u.blockbustersSectionNames || {};
    RACE_BANK                  = u.raceBank || [];
    RACE_SECTION_NAMES         = u.raceSectionNames || {};
    MILLIONAIRE_BANK           = u.millionaireBank || [];
    MILLIONAIRE_SECTION_NAMES  = u.millionaireSectionNames || {};
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
        `<div class="games">${gamesFor(u).map(g=>`<span>${GAME_TITLES[g]}</span>`).join('')}</div>`;
      el.addEventListener('click', ()=>{ loadUnit(u); document.getElementById('page-title').textContent='Game Hub'; showScreen('screen-game-select'); });
      grid.appendChild(el);
    });
  }

  /* ================= STATE / NAVIGATION ================= */
  let activeGame = null;
  let selectedContent = [];
  let pool = [];

  // shared team roster — persists across games AND unit switches until Reset
  let teams = [{name:'Team 1',score:0},{name:'Team 2',score:0}];
  let active = 0;   // jeopardy: selected/active team index
  let bbTurn = 0;   // blockbusters: whose turn (0 = Yellow/teams[0], 1 = Blue/teams[1])

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('new-game-btn').style.display = (id==='screen-play') ? 'inline-block' : 'none';
    document.getElementById('timer-widget').style.display = (id==='screen-play') ? 'flex' : 'none';
    // these boards size themselves around the team bar, so they don't need the body
    // padding that keeps the bar clear of the other screens
    document.body.classList.toggle('play-fit',
      id==='screen-play' && (activeGame==='race' || activeGame==='jeopardy' || activeGame==='millionaire'));
    if(id!=='screen-play') timerStop();
    renderScorebar();   // team bar is always visible; refresh its highlight/cues
  }

  document.querySelectorAll('.game-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      activeGame = card.dataset.game;
      S.setContext(activeGame);        // ⚙ opens on this game's tab from here on
      document.getElementById('page-title').textContent = GAME_TITLES[activeGame] || 'Game Hub';
      renderContentScreen();
      showScreen('screen-content-select');
    });
  });

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
    closeBuzzRoom();
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

  /* ================= PERSISTENT TEAM BAR ================= */
  function renderScorebar(){
    const bar=document.getElementById('scorebar'); bar.innerHTML='';
    const playing = document.getElementById('screen-play').classList.contains('active');
    // head-to-head has no "whose turn" — both teams are at the board at once
    const hi = !playing ? -1
             : (activeGame==='blockbusters') ? bbTurn
             : (activeGame==='race' && raceMode==='h2h') ? -1
             : active;
    const step = (activeGame==='jeopardy' || activeGame==='millionaire') ? 100 : 1;   // manual +/- correction step
    teams.forEach((t, i)=>{
      const el=document.createElement('div'); el.className='team'+(i===hi?' active':'');
      const dot = (activeGame==='blockbusters' && i<2)
        ? `<span class="dot" style="background:${i===0?'var(--yellow)':'var(--blue)'}"></span>` : '';
      el.innerHTML = `${dot}<input class="tname" value="${t.name}"><button class="minus">−</button><span class="score">${t.score}</span><button class="plus">+</button>`;
      el.addEventListener('click', (ev)=>{
        if(ev.target.closest('button') || ev.target.classList.contains('tname')) return;
        active = i; renderScorebar();
      });
      el.querySelector('.tname').addEventListener('change', e=>{ t.name = e.target.value; pushTeamNames(); });
      el.querySelector('.minus').addEventListener('click', ()=>{ t.score-=step; renderScorebar(); });
      el.querySelector('.plus').addEventListener('click', ()=>{ t.score+=step; renderScorebar(); });
      bar.appendChild(el);
    });
    const addBtn=document.createElement('button'); addBtn.id='add-team-btn'; addBtn.textContent='+ Team';
    addBtn.addEventListener('click', ()=>{ teams.push({name:'Team '+(teams.length+1), score:0}); renderScorebar(); });
    bar.appendChild(addBtn);
    const resetBtn=document.createElement('button'); resetBtn.className='reset-btn'; resetBtn.textContent='↺ Reset points';
    resetBtn.addEventListener('click', ()=>{ teams.forEach(t=>t.score=0); renderScorebar(); });
    bar.appendChild(resetBtn);
  }

  function nextTurn(){ if(teams.length){ active=Kit.passTurn(teams.length, active); renderScorebar(); } }

  /* ================= JEOPARDY ================= */
  let jeoRows = 0;

  function buildJeopardyBoard(){
    const cats = JEOPARDY_CATEGORIES.filter(c=>selectedContent.includes(c.id));
    const board = document.getElementById('board');
    board.style.gridTemplateColumns = `repeat(${cats.length}, 1fr)`;
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
        tile.addEventListener('click', ()=> openJeopardyClue(cat, clue, tile));
        board.appendChild(tile);
      });
    }
    fitJeopardyBoard();
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
  }

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

    if(activeGame==='jeopardy'){
      rulesNote.style.display='none';
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
        div.innerHTML = `<input type="checkbox" value="${cat.id}"><span class="tag">${cat.section}</span><span class="name">${cat.name}</span>`;
        div.querySelector('input').addEventListener('change', onContentToggle);
        list.appendChild(div);
      });
      updateStartButton();
    }

    if(activeGame==='blockbusters'){
      rulesNote.style.display='block';
      help.textContent = "Pick which sections feed the board. Each clue's answer starts with the letter shown on its hexagon.";
      Object.keys(BLOCKBUSTERS_SECTION_NAMES).forEach(sec=>{
        const div=document.createElement('label');
        div.className='cat-check';
        div.innerHTML = `<input type="checkbox" value="${sec}"><span class="tag">${sec}</span><span class="name">${BLOCKBUSTERS_SECTION_NAMES[sec].split('·')[1]}</span>`;
        div.querySelector('input').addEventListener('change', onContentToggle);
        list.appendChild(div);
      });
      updateStartButton();
    }

    if(activeGame==='millionaire'){
      rulesNote.style.display='none';
      help.textContent = "Pick which sections feed the ladder. Each team climbs its own eight rungs, taking turns, and the questions get harder as they go.";
      Object.keys(MILLIONAIRE_SECTION_NAMES).forEach(sec=>{
        const div=document.createElement('label');
        div.className='cat-check';
        div.innerHTML = `<input type="checkbox" value="${sec}"><span class="tag">${sec}</span><span class="name">${MILLIONAIRE_SECTION_NAMES[sec].split('·')[1]}</span>`;
        div.querySelector('input').addEventListener('change', onContentToggle);
        list.appendChild(div);
      });
      updateStartButton();
    }

    if(activeGame==='race'){
      rulesNote.style.display='none';
      raceNote.style.display='block';
      document.getElementById('race-mode').style.display='block';
      renderRaceRules();
      help.textContent = "Pick which sections feed the board. Every word on screen is a target word from your selection, so a wrong tap is still worth talking about.";
      Object.keys(RACE_SECTION_NAMES).forEach(sec=>{
        const div=document.createElement('label');
        div.className='cat-check';
        div.innerHTML = `<input type="checkbox" value="${sec}"><span class="tag">${sec}</span><span class="name">${RACE_SECTION_NAMES[sec].split('·')[1]}</span>`;
        div.querySelector('input').addEventListener('change', onContentToggle);
        list.appendChild(div);
      });
      updateStartButton();
    }
  }

  function onContentToggle(){
    selectedContent = [...document.querySelectorAll('#content-list input:checked')].map(i=>i.value);
    updateStartButton();
  }

  function updateStartButton(){
    const btn = document.getElementById('start-btn');
    if(activeGame==='jeopardy'){
      btn.disabled = selectedContent.length < 3;
      btn.textContent = selectedContent.length < 3
        ? `Select at least 3 categories to build the board (${selectedContent.length} chosen)`
        : `Build board with ${selectedContent.length} categories`;
    } else if(activeGame==='blockbusters'){
      const total = BLOCKBUSTERS_BANK.filter(c=>selectedContent.includes(c.section)).length;
      btn.disabled = selectedContent.length===0 || total < 18;
      if(selectedContent.length===0){
        btn.textContent = 'Select at least one section';
      } else if(total < 18){
        btn.textContent = `Need 18 clues for a full board — ${total} selected, add another section`;
      } else {
        btn.textContent = `Build board — 18 of ${total} clues, shuffled`;
      }
    } else if(activeGame==='millionaire'){
      const pool = MILLIONAIRE_BANK.filter(q=>selectedContent.includes(q.section));
      const rungs = new Set(pool.map(q=>q.level));
      const missing = M_LADDER.map((_,i)=>i+1).filter(l=>!rungs.has(l));
      btn.disabled = selectedContent.length===0 || missing.length>0;
      if(selectedContent.length===0){
        btn.textContent = 'Select at least one section';
      } else if(missing.length){
        btn.textContent = `Not enough for a full ladder — nothing at level ${missing.join(', ')}`;
      } else {
        btn.textContent = `Build ladder — ${pool.length} questions across 8 rungs`;
      }
    } else if(activeGame==='race'){
      const total = RACE_BANK.filter(c=>selectedContent.includes(c.section)).length;
      btn.disabled = total < RACE_MIN_WORDS;
      if(selectedContent.length===0){
        btn.textContent = 'Select at least one section';
      } else if(total < RACE_MIN_WORDS){
        btn.textContent = `Need ${RACE_MIN_WORDS} words for a board — ${total} selected, add another section`;
      } else {
        const onBoard = Math.min(total, RACE_MAX_WORDS);
        btn.textContent = `Build board — ${onBoard} of ${total} words, shuffled`;
      }
    }
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  document.getElementById('start-btn').addEventListener('click', ()=>{
    ['play-jeopardy','play-blockbusters','play-race','play-millionaire'].forEach(id=>{
      document.getElementById(id).style.display='none';
    });
    if(activeGame==='jeopardy'){
      document.getElementById('play-jeopardy').style.display='block';
      buildJeopardyBoard();
      timerSetDuration(30);
    } else if(activeGame==='blockbusters'){
      document.getElementById('play-blockbusters').style.display='block';
      pool = shuffle(BLOCKBUSTERS_BANK.filter(c=>selectedContent.includes(c.section)));
      pool = pool.slice(0, 18);   // classic 5/4/5/4 board holds 18
      buildBlockbustersBoard();
      bbTurn=0; renderBBTurn();
      timerSetDuration(30);
    } else if(activeGame==='millionaire'){
      document.getElementById('play-millionaire').style.display='block';
      buildMillionaire();
      timerSetDuration(Number(S.get('mConferSeconds', 'millionaire')) || 30);
    } else if(activeGame==='race'){
      document.getElementById('play-race').style.display='block';
      buildRaceBoard();
      if(raceMode==='h2h') openBuzzRoom(); else closeBuzzRoom();
      timerSetDuration(Number(S.get('raceRoundSeconds', 'race')) || 60);
    }
    showScreen('screen-play');
    // neither board can be measured until the play screen is actually visible
    if(activeGame==='race')       scatterRaceWords();
    if(activeGame==='jeopardy')   fitJeopardyBoard();
    if(activeGame==='millionaire') fitMillionaire();
    timerReset();
  });

  /* ================= BLOCKBUSTERS ================= */
  function renderBBTurn(){
    const g=document.querySelector('#legend .legend-gold');
    const s=document.querySelector('#legend .legend-silver');
    if(g) g.classList.toggle('active-turn', bbTurn===0);
    if(s) s.classList.toggle('active-turn', bbTurn===1);
  }

  function buildBlockbustersBoard(){
    const wrap=document.getElementById('hexwrap');
    wrap.innerHTML='';

    const probe=document.createElement('div');
    probe.className='hex'; probe.style.visibility='hidden';
    wrap.appendChild(probe);
    const w = probe.getBoundingClientRect().width || 90;
    probe.remove();

    const h = w * 1.1547;
    const gap = Math.max(3, w*0.05);
    const colStep = w + gap;
    const rowStep = h * 0.75 + gap*0.5;

    const rowSizes = [5,4,5,4];
    const widest = 5;
    const boardW = widest*colStep - gap;
    let idx=0;

    rowSizes.forEach((size, r)=>{
      const rowW = size*colStep - gap;
      const startX = (boardW - rowW)/2;
      for(let c=0; c<size; c++){
        const clueObj = pool[idx++];
        if(!clueObj) return;
        const hex=document.createElement('div');
        hex.className='hex';
        hex.textContent=clueObj.letter;
        hex.style.left = (startX + c*colStep) + 'px';
        hex.style.top  = (r*rowStep) + 'px';
        hex.addEventListener('click', ()=> openBlockbustersClue(clueObj, hex));
        wrap.appendChild(hex);
      }
    });

    wrap.style.width  = boardW + 'px';
    wrap.style.height = ((rowSizes.length-1)*rowStep + h) + 'px';
  }

  window.addEventListener('resize', ()=>{
    if(activeGame==='blockbusters' && pool.length){
      const claimed=[...document.querySelectorAll('#hexwrap .hex')].map(hx=>
        hx.classList.contains('claimed-gold') ? 'gold' :
        hx.classList.contains('claimed-silver') ? 'silver' : null);
      buildBlockbustersBoard();
      [...document.querySelectorAll('#hexwrap .hex')].forEach((hx,i)=>{
        if(claimed[i]==='gold'){ hx.classList.add('claimed-gold'); hx.textContent=''; }
        if(claimed[i]==='silver'){ hx.classList.add('claimed-silver'); hx.textContent=''; }
      });
    }
  });

  /* ================= SHARED CLUE MODAL ================= */
  let currentTile=null, modalMode=null, currentClueValue=0;

  // Blockbusters' board is structurally two-team — yellow crosses, blue descends —
  // so the shared chooser is deliberately restricted rather than generalised here.
  const clueClaim = Kit.claimTeam({
    mount:  document.getElementById('clue-claim'),
    onPick: i => claimHex(i)
  });

  function hideAllActionButtons(){
    ['reveal-btn','correct-btn','wrong-btn','skip-btn','close-btn']
      .forEach(id=>{ document.getElementById(id).style.display='none'; });
    clueClaim.hide();
  }

  function openJeopardyClue(cat, clue, tile){
    const review = tile.classList.contains('used');
    currentTile=tile; modalMode = review ? 'review' : 'jeopardy'; currentClueValue=clue.v;
    document.getElementById('clue-topline').textContent =
      cat.name + ' · $' + clue.v + (review ? '  ·  review' : '');
    document.getElementById('clue-section').textContent = cat.section;
    document.getElementById('clue-text').textContent = clue.q;
    const ansEl=document.getElementById('clue-answer');
    ansEl.textContent=clue.a;
    hideAllActionButtons();
    if(review){
      // already played — show everything, score nothing
      ansEl.style.display='block';
      document.getElementById('close-btn').style.display='inline-block';
    } else {
      ansEl.style.display='none';
      document.getElementById('reveal-btn').style.display='inline-block';
      document.getElementById('close-btn').style.display='inline-block';
    }
    openClueCard(tile);
  }

  function openBlockbustersClue(clueObj, hex){
    if(hex.classList.contains('claimed-gold') || hex.classList.contains('claimed-silver')) return;
    currentTile=hex; modalMode='blockbusters';
    document.getElementById('clue-topline').textContent = clueObj.letter;
    document.getElementById('clue-section').textContent = clueObj.section;
    document.getElementById('clue-text').textContent = clueObj.clue;
    const ansEl=document.getElementById('clue-answer'); ansEl.style.display='none'; ansEl.textContent=clueObj.answer;
    hideAllActionButtons();
    document.getElementById('reveal-btn').style.display='inline-block';
    clueClaim.show(teams, [0, 1]);
    document.getElementById('skip-btn').style.display='inline-block';
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

  Kit.anim.register('cardFlip', 'turn-only', {
    // no travel: the card is already where it belongs and simply turns over. Quicker,
    // and much less movement across the screen for a class that finds the grow busy.
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

  function currentFlip(){
    if(!flipEnabled()) return null;
    return Kit.anim.get('cardFlip', S.get('cardFlip', activeGame));
  }

  function openClueCard(origin){
    const modal = document.getElementById('clue-modal');
    const card  = document.getElementById('clue-card');
    document.getElementById('clue-front-text').textContent =
      origin ? (origin.dataset.face || origin.textContent) : '';
    modal.style.display = 'flex';
    card.getAnimations().forEach(a=>a.cancel());
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
    const anim = impl.open(card, origin, flipMs(FLIP_OPEN_MS), helpers);
    if(anim) anim.onfinish = ()=> card.classList.add('flipped');
    else card.classList.add('flipped');
  }

  function closeModal(hold){
    const modal  = document.getElementById('clue-modal');
    const card   = document.getElementById('clue-card');
    const origin = currentTile;
    currentTile=null; modalMode=null;          // clear state now; the animation is cosmetic

    let finished = false;
    const done = ()=>{
      if(finished) return; finished = true;
      modal.style.display='none';
      card.getAnimations().forEach(a=>a.cancel());
      card.style.transform=''; card.classList.remove('flipped');
    };
    const impl = currentFlip();
    if(!impl || !origin || !modal.style.display || modal.style.display==='none'){ done(); return; }

    card.getAnimations().forEach(a=>a.cancel());
    const helpers = originHelpers(card, origin);   // measure before mutating
    card.style.transform = 'rotateY(180deg)';
    card.classList.remove('flipped');          // the value has to be showable again
    // every close implementation uses fill:'forwards' — without it the card reverts
    // to full size for a frame before the modal hides, which reads as "it warps back in"
    const anim = impl.close(card, origin, flipMs(FLIP_CLOSE_MS), hold||0, helpers);
    if(!anim){ done(); return; }
    anim.onfinish = done;
    anim.oncancel = ()=>{ if(!finished) done(); };
  }

  document.getElementById('reveal-btn').addEventListener('click', ()=>{
    Sound.play('reveal');
    document.getElementById('clue-answer').style.display='block';
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
  document.getElementById('correct-btn').addEventListener('click', ()=>{
    Sound.play('correct');
    if(currentTile){ currentTile.classList.add('used'); }   // keeps its value, faded
    if(teams.length){ teams[active].score += currentClueValue; }
    closeModal(flipMs(FLIP_HOLD_MS));
    nextTurn();
  });
  document.getElementById('wrong-btn').addEventListener('click', ()=>{
    Sound.play('wrong');
    if(currentTile){ currentTile.classList.add('used'); }   // keeps its value, faded
    closeModal(flipMs(FLIP_HOLD_MS));
    nextTurn();
  });

  document.getElementById('close-btn').addEventListener('click', ()=>{ closeModal(); });

  // Blockbusters: claim (or skip) a hex, award +1 to the claiming team, pass turn.
  function claimHex(idx){
    const claimed = (idx === 0 || idx === 1);
    if(claimed) Sound.play('claim');
    if(currentTile && modalMode==='blockbusters' && claimed){
      currentTile.classList.add(idx===0 ? 'claimed-gold' : 'claimed-silver');
      currentTile.textContent='';
      if(teams[idx]) teams[idx].score++;
    }
    closeModal(claimed ? flipMs(FLIP_HOLD_MS) : 0);
    bbTurn = Kit.passTurn(2, bbTurn);
    renderBBTurn();
    renderScorebar();
  }
  document.getElementById('skip-btn').addEventListener('click', ()=>claimHex(null));

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
  let mTally   = null;   // option -> hand count, while Ask the class is running

  function mTeamState(i){
    if(!mState[i]) mState[i] = { rung:0, used:new Set(), lifelines:{ fifty:true, class:true, confer:true } };
    return mState[i];
  }

  function buildMillionaire(){
    mState = []; mCurrent = null; mAnswered = false; mTally = null;
    teams.forEach((t,i)=>mTeamState(i));
    active = 0;
    renderScorebar();
    nextMillionaireQuestion();
  }

  function pickQuestion(team){
    const st   = mTeamState(team);
    const rung = Math.min(st.rung, M_LADDER.length-1);
    const pool = MILLIONAIRE_BANK.filter(q=>selectedContent.includes(q.section) && q.level === rung+1);
    if(!pool.length) return null;
    const fresh = pool.filter(q=>!st.used.has(q.prompt));
    return shuffle((fresh.length ? fresh : pool).slice())[0];
  }

  function nextMillionaireQuestion(){
    mAnswered = false; mTally = null;
    const st = mTeamState(active);

    if(st.rung >= M_LADDER.length){       // this team has topped out
      renderMillionaire();
      showMillionaireMessage((teams[active] ? teams[active].name : 'Team') + ' has cleared the ladder!');
      Sound.play('clear');
      return;
    }
    const q = pickQuestion(active);
    if(!q){
      renderMillionaire();
      showMillionaireMessage('No question left at this level for the sections you picked.');
      return;
    }
    st.used.add(q.prompt);
    mCurrent = { q, team:active, options: shuffle([q.answer, ...q.distractors].slice()) };
    renderMillionaire();
  }

  function showMillionaireMessage(text){
    document.getElementById('m-question').textContent = text;
    document.getElementById('m-options').innerHTML = '';
    document.getElementById('m-hint').textContent = '';
    document.getElementById('m-next').style.display = 'inline-block';
    document.getElementById('m-done-count').style.display = 'none';
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
      btn.disabled = !on || !st.lifelines[btn.dataset.life] || !mCurrent || mAnswered;
      btn.classList.toggle('spent', !st.lifelines[btn.dataset.life]);
    });

    renderLadder();
    if(!mCurrent) return;

    document.getElementById('m-question').textContent = mCurrent.q.prompt;
    const wrap = document.getElementById('m-options');
    wrap.innerHTML = '';
    mCurrent.options.forEach((opt, i)=>{
      const b = document.createElement('button');
      b.className = 'm-option';
      b.dataset.opt = opt;
      const letter = document.createElement('span');
      letter.className = 'm-letter'; letter.textContent = 'ABCD'[i];
      const text = document.createElement('span');
      text.className = 'm-text'; text.textContent = opt;
      b.appendChild(letter); b.appendChild(text);
      if(mCurrent.removed && mCurrent.removed.indexOf(opt) !== -1){
        b.classList.add('removed'); b.disabled = true;
      }
      if(mTally){
        const n = document.createElement('span');
        n.className = 'm-votes'; n.textContent = mTally[opt] || 0;
        b.appendChild(n);
      }
      b.addEventListener('click', ()=>onOptionClick(opt, b));
      wrap.appendChild(b);
    });

    document.getElementById('m-hint').textContent = mTally
      ? 'Counting hands — tap an option for each hand, then Done counting.'
      : '';
    document.getElementById('m-next').style.display = 'none';
    document.getElementById('m-done-count').style.display = mTally ? 'inline-block' : 'none';
  }

  /* Same rule as the other boards: fill the screen, never scroll. The stage takes
     whatever is left under the header and above the team bar, and the options and
     ladder stretch into it. */
  function fitMillionaire(){
    Kit.fitToScreen(document.getElementById('m-main'), { min:260, gap:12 });
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

  function onOptionClick(opt, btn){
    if(!mCurrent) return;
    if(mCurrent.removed && mCurrent.removed.indexOf(opt) !== -1) return;
    if(mTally){                          // counting hands, not answering
      mTally[opt] = (mTally[opt] || 0) + 1;
      btn.querySelector('.m-votes').textContent = mTally[opt];
      return;
    }
    if(mAnswered) return;
    mAnswered = true;

    const correct = (opt === mCurrent.q.answer);
    const st = mTeamState(mCurrent.team);
    document.querySelectorAll('#m-options .m-option').forEach(b=>{
      if(b.dataset.opt === mCurrent.q.answer) b.classList.add('right');
      else if(b === btn) b.classList.add('picked-wrong');
      b.disabled = true;
    });

    if(correct){
      Sound.play('correct');
      const value = M_LADDER[Math.min(st.rung, M_LADDER.length-1)];
      if(teams[mCurrent.team]) teams[mCurrent.team].score += value;
      st.rung += 1;
      document.getElementById('m-hint').textContent = '+' + value;
    } else {
      Sound.play('wrong');
      document.getElementById('m-hint').textContent = 'No points — same rung next time round.';
    }
    renderScorebar();
    renderLadder();
    document.querySelectorAll('#m-lifelines .lifeline').forEach(b=>b.disabled = true);
    document.getElementById('m-next').style.display = 'inline-block';
  }

  /* ---- lifelines ---- */
  function useLifeline(kind){
    const st = mTeamState(active);
    if(!mCurrent || mAnswered || !st.lifelines[kind]) return;
    st.lifelines[kind] = false;

    if(kind === 'fifty'){
      const wrong = mCurrent.options.filter(o=>o !== mCurrent.q.answer);
      mCurrent.removed = shuffle(wrong.slice()).slice(0, 2);
      Sound.play('reveal');
    } else if(kind === 'class'){
      mTally = {};
      mCurrent.options.forEach(o=>{ mTally[o] = 0; });
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
  document.getElementById('m-next').addEventListener('click', ()=>{
    timerStop();
    active = Kit.passTurn(teams.length, active);
    renderScorebar();
    nextMillionaireQuestion();
  });
  document.getElementById('m-done-count').addEventListener('click', ()=>{
    mTally = null;
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

  function renderBuzzChip(state){
    const chip = document.getElementById('buzzer-chip');
    if(!chip) return;
    if(!buzzHost){ chip.style.display='none'; return; }
    chip.style.display='flex';
    chip.className = state==='won' ? 'won' : (state==='armed' ? 'armed' : '');
    chip.innerHTML='';
    const add=(cls,txt)=>{ const s=document.createElement('span'); s.className=cls; s.textContent=txt; chip.appendChild(s); };
    if(buzzWinner){
      add('buzz-name', buzzWinner.name);
      add('buzz-team', teams[buzzWinner.team] ? teams[buzzWinner.team].name : ('Team '+(buzzWinner.team+1)));
    } else {
      // the join address, so it can be read off the screen instead of the terminal
      add('buzz-join', joinAddress());
      add('buzz-code', 'code ' + buzzHost.code);
      add('buzz-count', buzzPlayers + (buzzPlayers===1 ? ' phone' : ' phones'));
      if(state==='armed') add('buzz-live', 'buzzers live');
    }
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

  function openBuzzRoom(){
    if(!buzzersOn() || buzzHost) return;
    const relay = S.get('buzzerRelay') || '';
    HubBuzzer.newCode(relay).then(info=>{
      const code = info && info.code;
      buzzLanHost = (info && info.lan) || '';
      if(!code){                     // no relay — say why, and carry on without it
        const chip=document.getElementById('buzzer-chip');
        if(chip){ chip.style.display='flex'; chip.className='off';
                  chip.textContent = buzzerProblem(); }
        return;
      }
      buzzHost = HubBuzzer.host({ relay, code });
      buzzHost.on('ready',   d=>{ buzzPlayers=(d.players||[]).length; pushTeamNames(); renderBuzzChip(); });
      buzzHost.on('players', list=>{ buzzPlayers=list.length; renderBuzzChip(); });
      buzzHost.on('buzz',    onBuzz);
      renderBuzzChip();
    });
  }

  function closeBuzzRoom(){
    if(buzzHost){ buzzHost.close(); buzzHost=null; }
    buzzWinner=null; buzzPlayers=0;
    const chip=document.getElementById('buzzer-chip');
    if(chip) chip.style.display='none';
  }

  function pushTeamNames(){
    if(buzzHost) buzzHost.setTeams(teams.map(t=>t.name));
  }

  function armBuzzers(prompt){
    buzzWinner=null;
    if(buzzHost) buzzHost.arm(prompt||'');
    renderBuzzChip('armed');
  }
  function resetBuzzers(){
    buzzWinner=null;
    if(buzzHost) buzzHost.reset();
    renderBuzzChip();
  }

  function onBuzz(b){
    buzzWinner = b;
    Sound.play('claim');
    renderBuzzChip('won');
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
    const picked = shuffle(RACE_BANK.filter(c=>selectedContent.includes(c.section)))
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

    // Shrink the type until the grid genuinely fits. Cells are sized to the widest
    // and tallest word, so once the grid fits, no two words can overlap.
    let cols=1, rows=tiles.length, maxW=0, maxH=0, scale=1;
    for(let attempt=0; attempt<7; attempt++){
      field.style.setProperty('--rs', scale.toFixed(3));
      maxW = Math.max(...tiles.map(t=>t.offsetWidth));
      maxH = Math.max(...tiles.map(t=>t.offsetHeight));
      cols = Math.min(tiles.length, Math.max(1, Math.floor(W / (maxW + 20))));
      rows = Math.ceil(tiles.length / cols);
      if(rows * (maxH + 18) <= avail || scale <= 0.6) break;
      scale = Math.max(0.6, scale * Math.sqrt(avail / (rows * (maxH + 18))) * 0.97);
    }

    const cellW = W / cols, cellH = avail / rows;
    const slots = [];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) slots.push({r,c});
    shuffle(slots);

    tiles.forEach((el, i)=>{
      const s = slots[i]; if(!s) return;
      const tw = el.offsetWidth, th = el.offsetHeight;
      const x = s.c*cellW + Math.random()*Math.max(0, cellW - tw);
      const y = s.r*cellH + Math.random()*Math.max(0, cellH - th);
      el.style.left = Math.round(Math.max(0, Math.min(W - tw, x))) + 'px';
      el.style.top  = Math.round(Math.max(0, Math.min(avail - th, y))) + 'px';
      el.style.transform = `rotate(${(Math.random()*3-1.5).toFixed(2)}deg)`;
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
    item.prompt.split(/___+/).forEach((part,i,arr)=>{
      sent.appendChild(document.createTextNode(part));
      if(i<arr.length-1){
        const gap=document.createElement('span'); gap.className='gap'; gap.textContent='?';
        sent.appendChild(gap);
      }
    });
    el.appendChild(sec); el.appendChild(sent);
  }

  function nextRacePrompt(){
    while(raceQueue.length){
      const item = raceQueue.shift();
      const w = raceWords.find(x=>x.word===item.answer);
      if(w && !w.found){
        raceCurrent=item; setRacePrompt(item); updateRaceBar();
        if(raceMode==='h2h') armBuzzers(item.prompt);
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
    if(cleared){
      Sound.play('clear');
      setRaceMessage('Board cleared — final scores are in the team bar.');
    } else {
      Sound.play('end');
      nextTurn();                       // timed mode: hand the board to the next team
      setRacePrompt(null);
    }
    updateRaceBar();
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

  function onRaceWordClick(w, el){
    if(!raceRunning || !raceCurrent || w.found || racePending) return;
    if(w.word === raceCurrent.answer){
      Sound.play('correct');
      el.classList.remove('wrong');
      if(raceMode==='h2h'){
        if(buzzWinner && teams[buzzWinner.team]){
          // a phone already told us who got in first — no need to ask
          racePending = { w, el };
          awardRaceWord(buzzWinner.team, el);
          return;
        }
        // nobody buzzed (or no buzzers at all) — fall back to asking
        racePending = { w, el };
        el.classList.add('pending');
        showClaimBar();
      } else {
        awardRaceWord(active, el);
      }
    } else {
      Sound.play('wrong');
      el.classList.add('wrong');
      setTimeout(()=>el.classList.remove('wrong'), 600);
      if(raceMode==='timed'){
        // keep the pace up: no penalty, but move on — the sentence returns later
        raceQueue.push(raceCurrent);
        nextRacePrompt();
      } else {
        // h2h: the sentence stays up, so re-open the buzzers for the steal
        if(buzzHost) armBuzzers(raceCurrent.prompt);
      }
    }
  }

  // Award the pending (or, in timed mode, the just-clicked) word to a team.
  function awardRaceWord(teamIdx, elOverride){
    const hit = racePending || { w: raceWords.find(x=>x.word===raceCurrent.answer), el:elOverride||null };
    if(!hit.w) return;
    hit.w.found = true;
    hit.w.by    = teamIdx;
    if(teams[teamIdx]) teams[teamIdx].score++;
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
    nextRacePrompt();
  }

  const raceClaim = Kit.claimTeam({
    mount:  document.getElementById('race-claim'),
    onPick: i => awardRaceWord(i)
  });
  function showClaimBar(){ raceClaim.show(teams); }
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

  window.addEventListener('resize', ()=>{
    if(activeGame==='race' && raceWords.length) scatterRaceWords();
    if(activeGame==='jeopardy') fitJeopardyBoard();
    if(activeGame==='millionaire') fitMillionaire();
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
        // a timed race round is the one thing the clock actually ends
        if(activeGame==='race' && raceMode==='timed' && raceRunning){ endRaceRound(false); }
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
  S.mount(document.querySelector('.header-right'));   // gear button + panel
  renderScorebar();   // team bar visible from the very first screen

  // settings that change what's already on screen take effect without a restart
  S.onChange((id)=>{
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
