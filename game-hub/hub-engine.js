/* ================= Game Hub — shared engine =================
   Renders the UI and runs Jeopardy + Blockbusters from a unit's content.
   Expects a global `window.UNIT` (see game-hub/content/unit-*.js) to be
   defined BEFORE this script loads. All unit-specific text and content comes
   from that object; nothing unit-specific lives in here. */
(function(){
  'use strict';

  const UNIT = window.UNIT;
  if(!UNIT){ throw new Error('hub-engine: window.UNIT is not defined — load the unit content file before hub-engine.js'); }

  /* ---- UI skeleton (identical for every unit) ---- */
  const SKELETON = `
    <header>
      <div>
        <div class="eyebrow"></div>
        <h1 id="page-title">Game Hub</h1>
      </div>
      <button id="new-game-btn">↺ New game</button>
    </header>
    <div class="geo-band"></div>

    <!-- SCREEN 1: choose game -->
    <div class="screen active" id="screen-game-select">
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
          <span><span class="dot" style="background:var(--gold)"></span> Yellow: left &rarr; right</span>
          <span><span class="dot" style="background:var(--silver)"></span> Blue: top &rarr; bottom</span>
        </div>
        <div id="hexwrap"></div>
      </div>
    </div>

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
          <button id="gold-btn" style="display:none;">Yellow claims it</button>
          <button id="silver-btn" style="display:none;">Blue claims it</button>
          <button id="skip-btn" style="display:none;">No claim / close</button>
          <button id="close-btn" style="display:none;">Close</button>
        </div>
      </div>
    </div>`;

  const root = document.getElementById('game-hub-root') || document.body;
  root.innerHTML = SKELETON;

  /* ---- populate unit-specific text ---- */
  document.querySelector('.eyebrow').textContent = UNIT.label || '';
  document.querySelector('#screen-game-select p.intro').textContent = UNIT.intro || '';
  if(UNIT.label){ document.title = UNIT.label + ' — Game Hub'; }

  /* ---- unit content ---- */
  const JEOPARDY_SECTION_LABELS   = UNIT.jeopardySectionLabels || {};
  const JEOPARDY_CATEGORIES       = UNIT.jeopardyCategories || [];
  const BLOCKBUSTERS_BANK         = UNIT.blockbustersBank || [];
  const BLOCKBUSTERS_SECTION_NAMES= UNIT.blockbustersSectionNames || {};

  /* ================= STATE / NAVIGATION ================= */
  let activeGame = null;
  let selectedContent = [];
  let pool = [];
  let scores = {};

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('new-game-btn').style.display = (id==='screen-play') ? 'inline-block' : 'none';
    document.getElementById('scorebar').style.display = (id==='screen-play' && activeGame==='jeopardy') ? 'flex' : 'none';
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

  document.getElementById('back-to-games').addEventListener('click', ()=>{
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

  document.getElementById('new-game-btn').addEventListener('click', ()=>{
    activeGame=null; selectedContent=[]; pool=[]; scores={};
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

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
      buildScorebar();
    } else {
      document.getElementById('play-jeopardy').style.display='none';
      document.getElementById('play-blockbusters').style.display='block';
      pool = BLOCKBUSTERS_BANK.filter(c=>selectedContent.includes(c.section));
      for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
      pool = pool.slice(0, 18);   // classic 5/4/5/4 board holds 18
      buildBlockbustersBoard();
    }
    showScreen('screen-play');
  });

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
  function buildScorebar(){ scores={'Team 1':0,'Team 2':0}; renderScorebar(); }
  function renderScorebar(){
    const bar=document.getElementById('scorebar'); bar.innerHTML='';
    Object.keys(scores).forEach(name=>{
      const el=document.createElement('div'); el.className='team';
      el.innerHTML = `<input class="tname" value="${name}" data-orig="${name}"><button class="minus" data-d="-100">−</button><span class="score">${scores[name]}</span><button class="plus" data-d="100">+</button>`;
      el.querySelector('.tname').addEventListener('change', e=>{
        const old=e.target.dataset.orig, val=scores[old];
        delete scores[old]; scores[e.target.value]=val; e.target.dataset.orig=e.target.value;
      });
      el.querySelector('.minus').addEventListener('click', ()=>{
        scores[el.querySelector('.tname').value]-=100;
        el.querySelector('.score').textContent=scores[el.querySelector('.tname').value];
      });
      el.querySelector('.plus').addEventListener('click', ()=>{
        scores[el.querySelector('.tname').value]+=100;
        el.querySelector('.score').textContent=scores[el.querySelector('.tname').value];
      });
      bar.appendChild(el);
    });
    const addBtn=document.createElement('button'); addBtn.id='add-team-btn'; addBtn.textContent='+ Team';
    addBtn.addEventListener('click', ()=>{ scores['Team '+(Object.keys(scores).length+1)]=0; renderScorebar(); });
    bar.appendChild(addBtn);
  }

  /* ================= BLOCKBUSTERS ================= */
  function buildBlockbustersBoard(){
    const wrap=document.getElementById('hexwrap');
    wrap.innerHTML='';

    // Measure actual hex width from the CSS variable
    const probe=document.createElement('div');
    probe.className='hex'; probe.style.visibility='hidden';
    wrap.appendChild(probe);
    const w = probe.getBoundingClientRect().width || 90;
    probe.remove();

    const h = w * 1.1547;          // height of a pointy-top hex
    const gap = Math.max(3, w*0.05);
    const colStep = w + gap;        // horizontal distance between hexes in a row
    const rowStep = h * 0.75 + gap*0.5; // vertical: rows overlap by 1/4 height

    // Classic Blockbusters board: 5 columns x 4 rows, alternating 5/4/5/4 = 18 hexes.
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
  let currentTile=null, modalMode=null;

  function openJeopardyClue(cat, clue, tile){
    if(tile.classList.contains('used')) return;
    currentTile=tile; modalMode='jeopardy';
    document.getElementById('clue-topline').textContent = cat.name + ' · $' + clue.v;
    document.getElementById('clue-section').textContent = cat.section;
    document.getElementById('clue-text').textContent = clue.q;
    const ansEl=document.getElementById('clue-answer'); ansEl.style.display='none'; ansEl.textContent=clue.a;
    document.getElementById('gold-btn').style.display='none';
    document.getElementById('silver-btn').style.display='none';
    document.getElementById('skip-btn').style.display='none';
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
    document.getElementById('gold-btn').style.display='inline-block';
    document.getElementById('silver-btn').style.display='inline-block';
    document.getElementById('skip-btn').style.display='inline-block';
    document.getElementById('close-btn').style.display='none';
    document.getElementById('clue-modal').style.display='flex';
  }

  document.getElementById('reveal-btn').addEventListener('click', ()=>{
    document.getElementById('clue-answer').style.display='block';
  });
  document.getElementById('close-btn').addEventListener('click', ()=>{
    document.getElementById('clue-modal').style.display='none';
    if(currentTile && modalMode==='jeopardy'){
      currentTile.classList.add('used'); currentTile.textContent='';
    }
    currentTile=null;
  });
  function claimHex(claim){
    document.getElementById('clue-modal').style.display='none';
    if(currentTile && modalMode==='blockbusters' && claim){
      currentTile.classList.add(claim==='gold' ? 'claimed-gold' : 'claimed-silver');
      currentTile.textContent='';
    }
    currentTile=null;
  }
  document.getElementById('gold-btn').addEventListener('click', ()=>claimHex('gold'));
  document.getElementById('silver-btn').addEventListener('click', ()=>claimHex('silver'));
  document.getElementById('skip-btn').addEventListener('click', ()=>claimHex(null));

})();
