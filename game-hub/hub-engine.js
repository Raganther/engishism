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
    </div>

    <!-- persistent team bar (always visible, all screens) -->
    <div id="scorebar"></div>

    <!-- shared clue modal -->
    <div id="clue-modal">
      <div id="clue-card">
        <div id="clue-topline"></div>
        <div id="clue-section"></div>
        <div id="clue-text"></div>
        <div id="clue-answer"></div>
        <div id="clue-actions">
          <button id="reveal-btn">Reveal answer</button>
          <button id="correct-btn" style="display:none;">✓ Correct</button>
          <button id="wrong-btn" style="display:none;">✗ Wrong</button>
          <button id="gold-btn" style="display:none;">Yellow claims it</button>
          <button id="silver-btn" style="display:none;">Blue claims it</button>
          <button id="skip-btn" style="display:none;">No claim / close</button>
          <button id="close-btn" style="display:none;">Close</button>
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

  function loadUnit(u){
    UNIT = u;
    JEOPARDY_SECTION_LABELS    = u.jeopardySectionLabels || {};
    JEOPARDY_CATEGORIES        = u.jeopardyCategories || [];
    BLOCKBUSTERS_BANK          = u.blockbustersBank || [];
    BLOCKBUSTERS_SECTION_NAMES = u.blockbustersSectionNames || {};
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
        `<div class="games"><span>Jeopardy</span><span>Blockbusters</span></div>`;
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
    if(id!=='screen-play') timerStop();
    renderScorebar();   // team bar is always visible; refresh its highlight/cues
  }

  document.querySelectorAll('.game-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      activeGame = card.dataset.game;
      document.getElementById('page-title').textContent =
        activeGame==='jeopardy' ? 'Jeopardy' : 'Blockbusters';
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
    activeGame=null; selectedContent=[]; pool=[];
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

  /* ================= PERSISTENT TEAM BAR ================= */
  function renderScorebar(){
    const bar=document.getElementById('scorebar'); bar.innerHTML='';
    const playing = document.getElementById('screen-play').classList.contains('active');
    const hi = playing ? (activeGame==='blockbusters' ? bbTurn : active) : -1;
    const step = (activeGame==='blockbusters') ? 1 : 100;   // manual +/- correction step
    teams.forEach((t, i)=>{
      const el=document.createElement('div'); el.className='team'+(i===hi?' active':'');
      const dot = (activeGame==='blockbusters' && i<2)
        ? `<span class="dot" style="background:${i===0?'var(--yellow)':'var(--blue)'}"></span>` : '';
      el.innerHTML = `${dot}<input class="tname" value="${t.name}"><button class="minus">−</button><span class="score">${t.score}</span><button class="plus">+</button>`;
      el.addEventListener('click', (ev)=>{
        if(ev.target.closest('button') || ev.target.classList.contains('tname')) return;
        active = i; renderScorebar();
      });
      el.querySelector('.tname').addEventListener('change', e=>{ t.name = e.target.value; });
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

  function nextTurn(){ if(teams.length){ active=(active+1)%teams.length; renderScorebar(); } }

  /* ================= JEOPARDY ================= */
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
    const maxRows = Math.max(...cats.map(c=>c.clues.length));
    for(let r=0;r<maxRows;r++){
      cats.forEach(cat=>{
        const clue=cat.clues[r];
        const tile=document.createElement('div');
        tile.className='tile'; tile.textContent='$'+clue.v;
        tile.addEventListener('click', ()=> openJeopardyClue(cat, clue, tile));
        board.appendChild(tile);
      });
    }
  }

  /* ================= CONTENT SCREEN ================= */
  function renderContentScreen(){
    const list = document.getElementById('content-list');
    const help = document.getElementById('content-helptext');
    const rulesNote = document.getElementById('blockbusters-rules');
    list.innerHTML='';
    selectedContent=[];

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
    }
  }

  document.getElementById('start-btn').addEventListener('click', ()=>{
    if(activeGame==='jeopardy'){
      document.getElementById('play-jeopardy').style.display='block';
      document.getElementById('play-blockbusters').style.display='none';
      buildJeopardyBoard();
    } else {
      document.getElementById('play-jeopardy').style.display='none';
      document.getElementById('play-blockbusters').style.display='block';
      pool = BLOCKBUSTERS_BANK.filter(c=>selectedContent.includes(c.section));
      for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
      pool = pool.slice(0, 18);   // classic 5/4/5/4 board holds 18
      buildBlockbustersBoard();
      bbTurn=0; renderBBTurn();
    }
    showScreen('screen-play');
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

  function hideAllActionButtons(){
    ['reveal-btn','correct-btn','wrong-btn','gold-btn','silver-btn','skip-btn','close-btn']
      .forEach(id=>{ document.getElementById(id).style.display='none'; });
  }

  function openJeopardyClue(cat, clue, tile){
    if(tile.classList.contains('used')) return;
    currentTile=tile; modalMode='jeopardy'; currentClueValue=clue.v;
    document.getElementById('clue-topline').textContent = cat.name + ' · $' + clue.v;
    document.getElementById('clue-section').textContent = cat.section;
    document.getElementById('clue-text').textContent = clue.q;
    const ansEl=document.getElementById('clue-answer'); ansEl.style.display='none'; ansEl.textContent=clue.a;
    hideAllActionButtons();
    document.getElementById('reveal-btn').style.display='inline-block';
    document.getElementById('close-btn').style.display='inline-block';
    document.getElementById('clue-modal').style.display='flex';
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
    document.getElementById('gold-btn').style.display='inline-block';
    document.getElementById('silver-btn').style.display='inline-block';
    document.getElementById('skip-btn').style.display='inline-block';
    document.getElementById('clue-modal').style.display='flex';
  }

  function closeModal(){ document.getElementById('clue-modal').style.display='none'; currentTile=null; modalMode=null; }

  document.getElementById('reveal-btn').addEventListener('click', ()=>{
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
    if(currentTile){ currentTile.classList.add('used'); currentTile.textContent=''; }
    if(teams.length){ teams[active].score += currentClueValue; }
    closeModal();
    nextTurn();
  });
  document.getElementById('wrong-btn').addEventListener('click', ()=>{
    if(currentTile){ currentTile.classList.add('used'); currentTile.textContent=''; }
    closeModal();
    nextTurn();
  });

  document.getElementById('close-btn').addEventListener('click', ()=>{ closeModal(); });

  // Blockbusters: claim (or skip) a hex, award +1 to the claiming team, pass turn.
  function claimHex(claim){
    if(currentTile && modalMode==='blockbusters' && claim){
      const idx = (claim==='gold') ? 0 : 1;
      currentTile.classList.add(claim==='gold' ? 'claimed-gold' : 'claimed-silver');
      currentTile.textContent='';
      if(teams[idx]) teams[idx].score++;
    }
    closeModal();
    bbTurn = (bbTurn===0) ? 1 : 0;
    renderBBTurn();
    renderScorebar();
  }
  document.getElementById('gold-btn').addEventListener('click', ()=>claimHex('gold'));
  document.getElementById('silver-btn').addEventListener('click', ()=>claimHex('silver'));
  document.getElementById('skip-btn').addEventListener('click', ()=>claimHex(null));

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
      if(tmrLeft<=0){ tmrLeft=0; clearInterval(tmrTick); tmrTick=null; }
      timerRender();
    }, 1000);
    timerRender();
  }
  function timerStop(){ if(tmrTick){ clearInterval(tmrTick); tmrTick=null; } timerRender(); }
  function timerReset(){ timerStop(); tmrLeft=tmrDuration; timerRender(); }
  function timerAdjust(delta){ if(tmrTick) return; tmrDuration=Math.min(300, Math.max(15, tmrDuration+delta)); tmrLeft=tmrDuration; timerRender(); }

  tmrToggle.addEventListener('click', ()=> tmrTick ? timerStop() : timerStart());
  document.getElementById('tmr-reset').addEventListener('click', timerReset);
  document.getElementById('tmr-minus').addEventListener('click', ()=> timerAdjust(-15));
  document.getElementById('tmr-plus').addEventListener('click', ()=> timerAdjust(+15));
  timerRender();

  /* ================= INIT ================= */
  document.querySelector('.eyebrow').textContent = 'Cambridge Empower C1 · Classroom games';
  document.getElementById('change-unit').style.display = (UNITS.length>1) ? 'inline-block' : 'none';
  renderScorebar();   // team bar visible from the very first screen
  if(UNITS.length===1){
    loadUnit(UNITS[0]);
    showScreen('screen-game-select');
  } else {
    renderUnitSelect();
    showScreen('screen-unit-select');
  }

})();
