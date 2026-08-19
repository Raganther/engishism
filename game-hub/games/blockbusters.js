/* ================= Blockbusters — extracted from the engine into its own file =================

   A hexagon board: Yellow connects left→right, Blue connects top→bottom, by answering
   letter clues. More than two teams play as two alliances (odd teams Yellow, even Blue),
   each scoring its own points while the *line* belongs to a side.

   **Fourth-from-last of the originals to leave hub-engine.js, and the first card game to
   go.** Unlike Millionaire and Race it borrows the shared clue card — it opens a clue
   over a hexagon, claims the hex, flips the card away — so it reaches a wider slice of
   the engine through `window.HubEnv`: the card opener/closer, the shared team chooser,
   and the `modalMode`/`currentTile` the shared reveal/close handlers read. The card is a
   hub surface a game borrows, not a thing it owns.

   Its per-side turn (`bbSideAt`) is a parallel-by-index array like Millionaire's ladder,
   so it re-aligns on a roster change through the declared `onTeamsChanged` hook; its
   board vote answers `voteLive`, and clears on `onRoomDrop`. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  const E = () => window.HubEnv;

  let BLOCKBUSTERS_BANK          = [];
  let BLOCKBUSTERS_SECTION_NAMES = {};
  let BLOCKBUSTERS_TOPIC_NAMES   = {};

  const BB_ROWS   = [5,4,5,4];                        // the classic board
  const BB_TOTAL  = BB_ROWS.reduce((a,b)=>a+b,0);    // how many clues fill it — derive, never re-type
  const BB_WIDEST = Math.max(...BB_ROWS);

  let pool     = [];      // the clues on the board this game
  let bbTurn   = 0;       // whose turn (0 = Yellow/teams[0], 1 = Blue/teams[1])
  let bbSideAt = [0, 0];  // which of that side's teams is up next
  let bbVote   = null;    // Kit.vote while the team is choosing
  let bbVoting = false;   // ...and whether it is still open
  let bbWon    = null;    // set once the round has an ending; the board stops taking clicks

  /* This board's round-host entry — merged into the engine's ROUND_HOSTS at init. It
     draws its round into the shared clue card, so its mount is the shared card box. */
  const HOST = {
    game:'blockbusters', stage:'play-blockbusters',
    mount: () => E().cardMount(), commit:'group-btn',
    live: () => E().modalMode() === 'blockbusters',
    /* Whose turn it is here is the team whose *side* is up — with four teams the round
       belongs to whoever is actually at the board rather than to `active`. */
    turn: () => bbTeamOnTurn(),
    /* A hexagon is worth what the board says — the floor is there because a round that
       paid nothing would read as not having counted. */
    win:  team => claimHex(team) || 1,
    worth: () => 1,
    step:  () => 1,
    /* This board is team-based: a hexagon is a side's answer, not a thumb's, so every
       round it hosts waits for the whole side rather than paying the fastest tap. */
    teamMode: true
  };

  /* Blockbusters' own settings (the shared keepControl/bbTeamVote stay in the engine). */
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

  /* The board's own controls exist only after the engine injects the stage, so the
     hexagon vote button is wired on the first load rather than at parse. */
  let wired = false;
  function wire(){
    if(wired) return;
    wired = true;
    document.getElementById('bb-ask').addEventListener('click', ()=>{
      if(bbVoting) bbCloseVote(true); else bbAskTeam();
    });
  }

  window.HubGames.register({
    id:'blockbusters', title:'Blockbusters',
    order: 51,   // keeps its slot between Jeopardy(50) and Race(52)/Millionaire(53)
    /* Two routes across the board, and any number of people on them. Points stay yours;
       the line belongs to your half of the room — the one place on any board where solo
       and team play are the same game. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4 L33 11.5 L33 26.5 L20 34 L7 26.5 L7 11.5 Z"/><path d="M20 13 L26 16.5 L26 23.5 L20 27 L14 23.5 L14 16.5 Z"/></svg>',
      blurb:'Hexagon board. Yellow connects left&rarr;right, Blue connects top&rarr;bottom, by answering letter clues.',
      badge:'Best for: single-word / short-answer vocab' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'BLOCKBUSTERS',
            sub:'Yellow goes across. Blue goes down. Build your line.', accent:'#C77DFF' },
    hasBank: u => (u.blockbustersBank||[]).length > 0,
    fitsScreen: false,        // this board scales around the banner rather than fitting
    roundHost: HOST,
    stageHTML: `
      <!-- Blockbusters. The hexagon honeycomb; a clue opens on the shared card over a
           hexagon. Declared here and injected by the engine. -->
      <div id="play-blockbusters">
        <div id="legend">
          <span class="legend-gold"><span class="dot" style="background:var(--gold)"></span> Yellow: left &rarr; right</span>
          <span class="legend-silver"><span class="dot" style="background:var(--silver)"></span> Blue: top &rarr; bottom</span>
          <button id="bb-ask" style="display:none;">Team picks</button>
          <span id="bb-tally" style="display:none;"></span>
        </div>
        <div id="hexwrap"></div>
      </div>`,
    load(u){ wire();
             BLOCKBUSTERS_BANK          = u.blockbustersBank || [];
             BLOCKBUSTERS_SECTION_NAMES = u.blockbustersSectionNames || {};
             BLOCKBUSTERS_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => BLOCKBUSTERS_BANK,
    /* The *team* on turn, and every chip wears its side's colour, because a hexagon
       belongs to a side while points belong to a team. */
    turnTeam: () => bbTeamOnTurn(),
    teamDecor: i => `<span class="dot" style="background:${bbSideOf(i)===0?'var(--yellow)':'var(--blue)'}"></span>`,
    renderContent: renderBlockbustersContent,
    startButton:   blockbustersStartButton,
    start(){
      pool = E().shuffle(BLOCKBUSTERS_BANK.filter(E().inPlay));
      pool = pool.slice(0, BB_TOTAL);
      buildBlockbustersBoard();
      bbTurn=0; bbSideAt=[0,0]; renderBBTurn(); bbClearOutcome();
      bbVote=null; bbVoting=false; renderBBVote();
      E().timerSetDuration(30);
    },
    expects:     () => (E().clueItem() && E().clueItem().answer) || '',
    phonePrompt: () => (E().clueItem() && E().clueItem().text) || '',
    askingNow:   () => E().clueIsOpen(),
    onBuzzTaken(b){ if(E().teams()[b.team]){ E().setActiveTeam(b.team); E().renderScorebar(); } },
    onTypedWin(b){ return E().clueItem() ? (claimHex(b.team) || 1) : null; },
    /* Two questions can be open on these handsets, one at a time: the round in the clue
       card, or the team choosing which hexagon to attack. `openBlockbustersClue` ends
       the vote before it opens a round, so they are mutually exclusive by construction. */
    wantsVote:   () => E().roundLive() || !!S.get('bbTeamVote', 'blockbusters'),
    onVoteReply(all){
      if(E().roundLive()){ E().roundOnReplies(all); return; }
      if(bbVote){ bbVote.apply(all); renderBBVote(); }
    },
    phoneRound(){ return E().roundForPhones(); },
    onRoomReady(){ renderBBVote(); },
    onRoster(){ renderBBTurn(); renderBBVote(); },
    /* **A team removed re-aligns which of a side's teams is up.** `bbSideAt` is a
       parallel array; the engine hands the change through the hook and the game resets
       it, the same as Millionaire's ladder. A full reset is what the old inline path did. */
    onTeamsChanged(){ bbSideAt = [0, 0]; },
    /* Is a board vote open right now — the hexagon-picking vote borrows every phone. */
    voteLive:    () => bbVoting,
    /* The room was dropped entirely, so a half-open vote goes with it. */
    onRoomDrop(){ bbVote=null; bbVoting=false; renderBBVote(); },
    /* The room opened, parked, or a phone setting flipped — repaint the vote button. */
    onRoomSync(){ renderBBVote(); },
    /* Blockbusters has no Correct button — claiming *is* how it scores — so the shared
       chooser's pick is its scoring path, and "nobody claimed it" (skip) is `null`. */
    onClaimPick(i){ return claimHex(i); },
    fit:      layoutBlockbustersBoard,
    deal:     bbDeal,
    tension(){ bbTension(); },
    /* Revealing a round clue re-offers the claim chooser: a round stops judging on
       reveal, and without the chooser a hexagon opened by a round could only be left
       unclaimed. Fires only while a round is live. */
    onRoundReveal(){ E().clueClaimShow(E().teams(), E().teams().map((_, i) => i)); },
    onResize: layoutBlockbustersBoard
  });

  function renderBlockbustersContent(list, help){
    document.getElementById('blockbusters-rules').style.display='block';
    help.textContent = "Pick the topics that feed the board. Each clue's answer starts with the letter shown on its hexagon.";
    E().groupCheckboxes(list, BLOCKBUSTERS_BANK, BLOCKBUSTERS_TOPIC_NAMES, BLOCKBUSTERS_SECTION_NAMES);
  }

  function blockbustersStartButton(btn){
    const total = BLOCKBUSTERS_BANK.filter(E().inPlay).length;
    E().startGate(btn, { picked: E().selectedContent().length > 0, total, need: BB_TOTAL,
      short: `Need ${BB_TOTAL} clues for a full board`,
      ready: `Build board — ${BB_TOTAL} of ${total} clues, shuffled` });
  }

  /* ---- more than two teams on a two-sided board ----
     `bbSideOf` is index parity — team 0 is Yellow, team 1 is Blue — so with exactly two
     teams it is the identity and nothing about that game changes. Within a side the
     teams take it in turn. */
  function bbSideOf(teamIdx){ return teamIdx % 2; }
  function bbTeamsOn(side){ return E().teams().map((_, i) => i).filter(i => bbSideOf(i) === side); }
  function bbTeamOnTurn(){
    const list = bbTeamsOn(bbTurn);
    if(!list.length) return bbTurn;                    // no team on this side yet
    return list[bbSideAt[bbTurn] % list.length];
  }
  function bbAdvanceSide(side){
    const list = bbTeamsOn(side);
    if(list.length > 1) bbSideAt[side] = (bbSideAt[side] + 1) % list.length;
  }

  function renderBBTurn(){
    const teams = E().teams();
    const g=document.querySelector('#legend .legend-gold');
    const s=document.querySelector('#legend .legend-silver');
    if(g) g.classList.toggle('active-turn', bbTurn===0);
    if(s) s.classList.toggle('active-turn', bbTurn===1);
    /* Name who is actually playing each colour — marked with a class, never shouted in
       the markup: the name a teacher typed is the name in the DOM, and CSS does the
       emphasis. */
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

  // What is left to attack — the *distinct* letters, since two hexes can carry the same.
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
    if(!E().room() || bbWon) return;
    const teams = E().teams();
    const letters = bbOpenLetters();
    if(!letters.length) return;
    const onTurn = bbTeamOnTurn();
    bbVote   = K.vote.open({ options:letters, team:onTurn });
    bbVoting = true;
    const who = teams[onTurn] ? teams[onTurn].name : (bbTurn === 0 ? 'Yellow' : 'Blue');
    E().askClass(who + ' — which letter next?', 'vote', letters, onTurn);
    renderBBVote();
  }

  /* Closing hands the phones back — the vote borrows the room, it does not own it.
     `keep` leaves the numbers up: they are the team's decision, and the teacher is about
     to click on the hexagon they name. */
  function bbCloseVote(keep){
    if(!bbVoting) return;
    bbVoting = false;
    if(bbVote) bbVote.close();
    if(!keep) bbVote = null;
    if(E().activeGameId() === 'blockbusters') E().parkBuzzRoom();
    renderBBVote();
  }

  /* The vote is for a **letter** (counted once in a strip beside the legend), because a
     count drawn *on* a hexagon reads as several votes when two hexes share a letter. The
     board shows where it lands: every hexagon carrying the leading letter lights up. */
  function renderBBVote(){
    const teams = E().teams();
    const btn = document.getElementById('bb-ask');
    const on  = E().activeGameId() === 'blockbusters' && !!E().room() && !bbWon &&
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
        // the letter also lives in a data attribute: claiming a hex empties its text
        hex.dataset.letter=clueObj.letter;
        hex.dataset.row=r; hex.dataset.col=c;
        hex.addEventListener('click', ()=> openBlockbustersClue(clueObj, hex));
        wrap.appendChild(hex);
      }
    });
    layoutBlockbustersBoard();
  }

  /* Positions are worked out from the hexagons' *rendered* width, so this only runs once
     the play screen is visible. Kept separate from building so a resize repositions
     without rebuilding, which means claimed hexes keep their colour. */
  function layoutBlockbustersBoard(){
    const wrap  = document.getElementById('hexwrap');
    const hexes = [...wrap.querySelectorAll('.hex')];
    if(!hexes.length) return false;

    /* `offsetWidth`, not `getBoundingClientRect()`: the rect is the painted width, so an
       ancestor's scale (the 350ms transform transition, the banner shrink) bakes in. */
    const w = hexes[0].offsetWidth || hexes[0].getBoundingClientRect().width;
    if(!w) return false;                 // not on screen yet — caller re-runs later

    const h       = w * 1.1547;
    const gap     = Math.max(4, w * 0.06);
    const colStep = w + gap;
    const rowStep = h * 0.75 + gap * 1.1547;
    const boardW  = Math.max(...BB_ROWS) * colStep - gap;

    /* ---- the team edges ---- continuous zig-zag ribbons following the hex contour,
       each one div clipped to a polygon traced from the same measured geometry the board
       is laid out from. Rebuilt on every layout. */
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

      const leftIn = [], rightIn = [];
      for(let r = 0; r < R; r++){
        const y = r * rowStep;
        leftIn.push( [sx(r) - bg, y + 0.25*h], [sx(r) - bg, y + 0.75*h]);
        const X = sx(r) + BB_ROWS[r] * colStep - gap + bg;
        rightIn.push([X, y + 0.25*h], [X, y + 0.75*h]);
      }
      band('gold', leftIn.concat(leftIn.slice().reverse().map(p => [p[0] - bt, p[1]])));
      band('gold', rightIn.concat(rightIn.slice().reverse().map(p => [p[0] + bt, p[1]])));

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

  /* ---- has anybody won? ---- the board is a honeycomb, so "connected" needs the real
     geometry. A hex's position across the board is `inset + col`; two hexes touch when
     that distance is 1 within a row, or ½ in the row above or below. Derived from BB_ROWS
     rather than hard-coding 5/4/5/4. */
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

  /* Shortest connected path across the board, or null. An edge hex is one whose position
     across the board is at the extreme, not simply the first in its row. `passable` makes
     one walk answer two questions: owned hexes (a finished route) or owned-or-nobody's
     (can this team still get there). BFS, so the route is the shortest and traces best. */
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

  /* A win, a dead board, or nothing yet. "Blocked" is a real ending: once neither team
     can reach its far edge even using every unclaimed hex, the round is over. */
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

  /* ---- Blockbusters' tension curve ---- how close anybody is to winning: cheapest route
     to a finished line, own hexes free, an unclaimed one costing the question, the other
     team's a wall. Dijkstra, because the edges have different costs. */
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
    E().stageTension('blockbusters', () => {
      const shortest = Math.min(BB_WIDEST, BB_ROWS.length);
      const need = Math.min(bbStepsToWin(0), bbStepsToWin(1));
      const raw = !isFinite(need) ? 0
                : need >= shortest ? 0
                : (shortest - need) / (shortest - 1);
      return { t: Math.max(0, Math.min(1, raw)), live: !!clueOpen };
    });
  }

  /* The honeycomb builds itself, staggered on row+col — the same diagonal wave Jeopardy
     deals with, so it reads as the board assembling. */
  function bbDeal(){
    E().dealStagger('play-blockbusters', document.getElementById('hexwrap'), wrap => {
      [...wrap.querySelectorAll('.hex')].forEach(hex=>
        hex.style.setProperty('--i', (+hex.dataset.row) + (+hex.dataset.col)));
    }, 1600);
  }

  /* ---- lighting up the route ---- registered as variants, so another way of showing it
     is a register() call and one line in the setting. Each takes the winner's glow colour
     and returns how long it takes, so the banner can wait for it to land. */
  const BB_GLOW = ['rgba(255,194,14,0.95)', 'rgba(0,160,223,0.95)'];   // yellow, blue
  const bbLit   = g => 'brightness(1) drop-shadow(0 0 14px ' + g + ')';
  const bbPeak  = g => 'brightness(1.18) drop-shadow(0 0 30px ' + g + ')';

  K.anim.register('winRoute', 'trace', {
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

  K.anim.register('winRoute', 'pulse', {
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

  K.anim.register('winRoute', 'off', {
    run(hexes){ hexes.forEach(hex=>hex.classList.add('route')); return 0; }
  });

  function runWinRoute(hexes, team){
    const reduced = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const name = reduced ? 'off' : S.get('bbWinRoute', 'blockbusters');
    const impl = K.anim.get('winRoute', name) || K.anim.get('winRoute', 'off');
    return impl.run(hexes, BB_GLOW[team] || BB_GLOW[0]) || 0;
  }

  /* The board isn't sized to fit the screen, and at 720p it fills nearly all of it — so
     the banner would cover the bottom row, hiding half of a blue route. Shrink the whole
     panel into what's left instead of sliding it. Purely visual and reversed with it. */
  function bbFitAroundBanner(){
    const play  = document.getElementById('play-blockbusters');
    const card  = document.getElementById('result-card');
    const modal = document.getElementById('result-modal');
    play.style.transform = '';
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
    E().hideResult();
  }

  function bbFinish(outcome){
    bbWon = outcome;
    // the round has an ending: the vote goes and the phones go back to the mode
    bbCloseVote(false);
    const wrap = document.getElementById('hexwrap');
    wrap.classList.add('won');

    if(outcome.type !== 'win'){
      E().Sound.play('end');
      E().showResult({
        eyebrow:'Blockbusters',
        title:'Board blocked',
        sub:'Neither team can reach its far side now — nobody completes a line.',
        actions:[{ label:'New board', primary:true, onPick:bbPlayAgain }],
        onShow:bbFitAroundBanner, onHide:bbDropBoard
      });
      return;
    }

    const team  = outcome.team;
    const teams = E().teams();
    const hexes = outcome.path.map(cell=>bbHexAt(cell[0], cell[1])).filter(Boolean);
    wrap.classList.add('route-shown');
    const ms = runWinRoute(hexes, team);

    setTimeout(()=>{
      // the trace takes a couple of seconds; a new game in that window must not be
      // followed by a banner for a round that's already gone
      if(bbWon !== outcome) return;
      if(wrap.closest('.lit')){ E().Sound.fanfare(); setTimeout(()=>E().Sound.applause(2400), 620); }
      else E().Sound.play('clear');
      E().showResult({
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

  // same sections, freshly shuffled. Scores stay — the team bar carries across.
  function bbPlayAgain(){
    bbClearOutcome();
    pool = E().shuffle(BLOCKBUSTERS_BANK.filter(E().inPlay)).slice(0, BB_TOTAL);
    buildBlockbustersBoard();
    bbTurn=0; bbSideAt=[0,0]; renderBBTurn();
    bbVote=null; bbVoting=false; renderBBVote();
    bbTension(); bbDeal();
  }

  /* ---- opening a clue over a hexagon: this board borrows the shared clue card ---- */
  function openBlockbustersClue(clueObj, hex){
    if(bbWon) return;                        // the round has an ending; nothing left to claim
    if(hex.classList.contains('claimed-gold') || hex.classList.contains('claimed-silver')) return;
    E().setCurrentTile(hex); E().setModalMode('blockbusters');
    /* The letter stays on the topline whatever is behind the hexagon — it is the
       hexagon's *name*, how a team says which one they are attacking, not a promise about
       the answer's first letter (a grouping set has four answers, an ordering scale five). */
    document.getElementById('clue-topline').textContent = clueObj.letter;
    document.getElementById('clue-section').textContent = clueObj.section;
    const item = { text:clueObj.clue, answer:clueObj.answer, type:clueObj.type };
    // whatever field a registered round claims, carried across by asking the registry
    K.round.fields().forEach(f => { if(clueObj[f] !== undefined) item[f] = clueObj[f]; });
    E().setClueItem(item);
    /* Set up once and keep it: a round's answer is derived from the round rather than
       authored beside it, because two copies of one fact can drift. */
    const rnd = E().roundOf(item, 'blockbusters');
    if(rnd) item.answer = rnd.state.answer;
    /* Opening a hex answers the vote's question, so it ends here — before askPhones, or
       the arm below would be overwritten by a vote nobody is still taking. */
    bbVoting = false; bbVote = null; renderBBVote();
    E().drawPrompt(document.getElementById('clue-text'), item, 'blockbusters');
    /* After drawPrompt (which owns #clue-text) and before askPhones, which consults
       phoneRound() — and that cannot say what the handsets want until the round exists. */
    E().roundEnd();
    if(!(rnd && E().roundOpen(rnd))) E().askPhones(clueObj.clue, 'blockbusters');
    const ansEl=document.getElementById('clue-answer'); ansEl.style.display='none';
    ansEl.textContent = item.answer || clueObj.answer || '';
    E().hideAllActionButtons();
    document.getElementById('reveal-btn').style.display='inline-block';
    /* Every team that exists, not the first two: the side a team plays for is bbSideOf,
       so a four-team class can all answer. A live round judges itself and pays the hex
       through roundHost.win, so the chooser stands down until the round is over and the
       reveal puts it back for a class that never got there. */
    if(!rnd) E().clueClaimShow(E().teams(), E().teams().map((_, i) => i));
    const bbSkip = document.getElementById('skip-btn');
    bbSkip.textContent = 'No claim / close';
    bbSkip.style.display='inline-block';
    // after hideAllActionButtons(), which clears the round's Check button
    E().renderRoundButton();
    bbTension(true);                 // think music while the clue is on the table
    E().openClueCard(hex);
  }

  function claimHex(idx){
    const teams   = E().teams();
    const claimed = idx != null && idx >= 0 && !!teams[idx];
    const side    = claimed ? bbSideOf(idx) : null;
    const showy = document.getElementById('play-blockbusters').classList.contains('lit');
    E().Sound.bedStop();
    if(claimed) E().Sound.play(showy ? 'sting' : 'claim');
    let paid = 0;
    const tile = E().currentTile();
    if(tile && E().modalMode()==='blockbusters' && claimed){
      // the hexagon belongs to a *side* — that is what a line is made of — while the
      // points belong to the team that answered
      tile.classList.add(side===0 ? 'claimed-gold' : 'claimed-silver');
      tile.textContent='';
      // a hex taken by the side that wasn't on turn is a steal, and scores as one
      paid = E().award(idx, 1, { steal: side !== bbTurn, why:'hexagon' });
      E().markRun(idx, true);
    }
    // work out the ending now, but let the card land before showing it
    const outcome = claimed ? bbOutcome() : null;
    E().closeModal(claimed ? E().flipHoldMs() : 0,
               outcome ? ()=>bbFinish(outcome) : ()=>bbTension());
    /* Keeping the board on a correct answer: the team on turn that claims its own hex
       goes again. A steal or a skip always hands over. Whoever answered has used their
       side's go, so that side's next team is up when it comes round. */
    if(claimed) bbAdvanceSide(side);
    const kept = claimed && side === bbTurn && S.get('keepControl', 'blockbusters');
    if(!kept) bbTurn = K.passTurn(2, bbTurn);
    renderBBTurn();
    renderBBVote();      // the button names the team whose turn it now is
    E().renderScorebar();
    return paid;
  }
})();
