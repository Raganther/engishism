/* ================= Jeopardy — extracted from the engine into its own file =================

   The category board: five point values a column, teams pick a tile, answer, bank the
   points. **Last of the four originals to leave hub-engine.js, and the game the shared
   clue card was built around** — so what moved is small next to what had to be
   *untangled*. The card, its flip, the reveal/wrong/close/skip/correct buttons and the
   round adapter are all hub surfaces this board merely borrows; they stay in the engine
   and reach this game through declared hooks (`onClueReveal`, `onClueCorrect`,
   `onClueWrong`, `onClueClose`, `onClaimPick`, `onFloorClear`, `onScoreShown`,
   `cardGlow`). What is genuinely Jeopardy's — the board, the Daily Double wager, the
   steal, the answer clock, Together mode, hints and the Final clue — is here.

   `modalMode` is `'jeopardy'` for a live tile and `'review'` for a replayed one; both
   are values this game owns on the shared, engine-held `modalMode` string. The shared
   `currentClueValue` stays in the engine (the standings report reads it) and this game
   writes it through `E().setClueValue`. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  const E = () => window.HubEnv;

  let JEOPARDY_SECTION_LABELS = {};
  let JEOPARDY_CATEGORIES     = [];

  let jeoRows      = 0;
  let jBoardTotal  = 0;      // captured at build time: tiles keep their value when used
  let jHintsUsed   = 0;
  let jWager       = null;   // { team, amount, min, max, then } while a bet is being placed
  let jSteal       = null;   // { from, to } while a stolen clue is live
  let jDoubleTeam  = null;   // the team that found a Daily Double, while it is live
  let jFinalState  = null;
  let jFinalWasPlayed = false;
  let jFinalMark   = null;

  const PAY_STEP = 50;   // Jeopardy pays and rounds on the same 50 grid — one home for it

  /* This board's round-host entry — merged into the engine's ROUND_HOSTS at init. It
     draws its round into the shared clue card, so its mount is the shared card box. */
  const HOST = {
    game:'jeopardy', stage:'play-jeopardy',
    /* Draws its round into the shared clue card. Declared as a fact rather than inferred
       from `mount` identity, because an external file's mount is a wrapper around
       `E().cardMount()` and never the engine's own `CARD_MOUNT` reference — so the
       engine reads `onCard` to know a won round waits on the card here. */
    mount: () => E().cardMount(), onCard: true, commit:'group-btn',
    live: () => E().modalMode() === 'jeopardy',
    turn: () => E().activeTeam(),
    win:  team => jCorrect(team),
    /* **What the question is worth to a team that was not first** — the tile is the
       slot and the slot pays in full; this is what is left for everybody else who
       still got there. Rounded to 50 like everything else on this board. */
    worth: () => E().clueValue(),
    step:  () => PAY_STEP,
    /* **This board is team-based, so every round it hosts waits for the whole team.**
       A tile is a team's answer rather than a thumb's. Each round declares which of its
       modes is the whole-team one (`teamMode`), so a round written next month arrives
       already playing the way the board wants. */
    teamMode: true,
    /* Ordering's modes ask *how many ladders*, not *who has to agree* — and on a
       team-vs-team board a shared climb reads as a single ladder however many teams are
       playing. The drag rounds default to `first`, and a classroom decided it. */
    modeDefaults: { ordering:'race' }
  };

  /* Jeopardy's settings and the Rules ruleset are declared in
     game-hub/games/jeopardy-settings.js, loaded before this file — apart from the
     board's logic so the question bench can hold them. The behaviour they drive is
     below. */

  /* The hint and wager buttons live in the shared clue card (the skeleton), so they
     only exist after the engine injects it — wired on the first load rather than at
     parse, the same as Blockbusters' vote button. The reveal/correct/wrong/close/skip
     buttons stay the engine's and route back here through hooks. */
  let wired = false;
  function wire(){
    if(wired) return;
    wired = true;
    document.getElementById('hint-btn').addEventListener('click', () => {
      const item = E().clueItem();
      if(!item) return;
      const cost = jHintCost();
      jHintsUsed++;
      E().setClueValue(Math.max(50, E().clueValue() - cost));
      const hint = document.createElement('div');
      hint.className = 'clue-hint';
      hint.textContent = jHintText(jHintsUsed, item);
      document.getElementById('clue-text').appendChild(hint);
      // the topline is where the value lives, so it has to say what the clue is worth now
      const top = document.getElementById('clue-topline');
      top.textContent = top.textContent.replace(/\$\d+/, '$' + E().clueValue());
      E().Sound.play('reveal');
      renderHintButton();
    });
    document.getElementById('wager-ok').addEventListener('click', () => {
      if(!jWager) return;
      const bet = jWager.amount, then = jWager.then;
      closeWager();
      if(then) then(bet);
    });
  }

  window.HubGames.register({
    id:'jeopardy', title:'Jeopardy',
    order: 50,   // the originals sit at 50; Jeopardy is first
    /* A tile is answered by whoever is on turn, and one person is as good a turn as
       four — nothing on this board assumes several handsets behind a name. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="9" height="7" rx="1"/><rect x="15.5" y="6" width="9" height="7" rx="1"/><rect x="27" y="6" width="9" height="7" rx="1"/><rect x="4" y="16.5" width="9" height="7" rx="1"/><rect x="15.5" y="16.5" width="9" height="7" rx="1"/><rect x="27" y="16.5" width="9" height="7" rx="1"/><rect x="4" y="27" width="9" height="7" rx="1"/><rect x="15.5" y="27" width="9" height="7" rx="1"/><rect x="27" y="27" width="9" height="7" rx="1"/></svg>',
      blurb:'Category board, five point values each. Teams pick a tile, answer, bank the points.',
      badge:'Best for: mixed vocab &amp; grammar' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'JEOPARDY',
            sub:'Pick your category. Pick your price. Answer it.', accent:'#4FC3FF' },
    hasBank: u => (u.jeopardyCategories||[]).length > 0,
    fitsScreen: true,
    roundHost: HOST,
    stageHTML: `
      <!-- Jeopardy. The category board; a clue opens on the shared card over a tile.
           Declared here and injected by the engine. -->
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
      </div>`,
    load(u){ wire();
             JEOPARDY_SECTION_LABELS = u.jeopardySectionLabels || {};
             JEOPARDY_CATEGORIES     = u.jeopardyCategories || []; },
    bank: () => JEOPARDY_CATEGORIES.reduce((a,c)=> a.concat(c.clues||[]), []),
    // scores in hundreds: corrections nudge by 100, payouts round to 50
    nudgeStep: 100, payStep: PAY_STEP,
    onSetting(id){
      if(id==='jTogether' || id==='jTarget' || id==='jRules'){ renderClassLine(); fitJeopardyBoard(); }
      /* Changing the ruleset mid-board reaches the board. Planting only among the
         unplayed tiles is what keeps that honest — see jPlantDailyDoubles. */
      if((id==='jDailyDoubles' || id==='jRules') &&
         document.getElementById('screen-play').classList.contains('active')) jPlantDailyDoubles();
      if(id==='jHints') renderHintButton();
    },
    renderContent: renderJeopardyContent,
    startButton:   jeopardyStartButton,
    start(){ buildJeopardyBoard(); E().timerSetDuration(30); },
    /* The clue card is the question, so `expects`/`phonePrompt` read the shared item. */
    expects:     () => (E().clueItem() && E().clueItem().answer) || '',
    phonePrompt: () => (E().clueItem() && E().clueItem().text) || '',
    /* A Daily Double belongs to the team that found it — no race, no phones — and a
       wager is being placed on the board rather than answered in the room. */
    askingNow:   () => E().clueIsOpen() && jDoubleTeam == null && !jWager,
    /* A Daily Double is answered by the team that found it, alone; a grouping clue
       refuses because every team is playing it at once and there is no floor to take. */
    buzzEntitled: () => jDoubleTeam == null && !jWager && !E().roundLive(),
    /* The final clue is the one beat where every team answers at once, privately — the
       game owns the round while it runs. A grouping clue owns it for the same reason. */
    phoneRound(){
      if(E().roundLive()) return E().roundForPhones();
      if(!jFinalState || !jFinalState.asking) return null;
      return { mode:'write',
               prompt: S.get('phonePrompt', 'jeopardy') ? (jFinalState.clue.q || '') : '' };
    },
    /* A room is worth having open for a grouping clue even at `phoneMode: off`, and the
       chip has to say so. */
    wantsVote:   () => E().roundLive(),
    roomNote:    () => E().roundLive() ? 'find the group' : null,
    onVoteReply(all){ E().roundOnReplies(all); },
    /* The buzz decides who answers, so it selects that team. A plain buzz starts the
       answer clock; a typed one does not — the word was already judged. */
    onBuzzTaken(b){ const teams = E().teams();
                    if(teams[b.team]){ E().setActiveTeam(b.team); E().renderScorebar(); }
                    if(b.value == null) jClockStart(); },
    onTypedWin(b){ return E().clueItem() ? (jCorrect(b.team) || 1) : null; },
    fit:      fitJeopardyBoard,
    deal:     jDeal,
    tension(){ jTension(); },
    onResize: fitJeopardyBoard,
    /* **How hot this game's clue card arrives**, 0–1, so the shared card reuses the
       same `--tension` contract the boards do. A $500 clue opens hotter than a $100. */
    cardGlow(){
      if(!E().clueValue()) return 0;
      const { lo, hi } = jValueRange();
      return hi > lo ? (E().clueValue() - lo) / (hi - lo) : 1;
    },
    /* **On reveal this board shows Correct/Wrong**, because a tile is scored by hand.
       The Final settles team-by-team, so it takes the reveal over here rather than
       showing a single pair of buttons. */
    onClueReveal(){
      if(jFinalState){
        E().timerStop();
        document.getElementById('reveal-btn').style.display='none';
        document.getElementById('close-btn').style.display='none';
        jFinalSettle();
        return;
      }
      document.getElementById('reveal-btn').style.display='none';
      document.getElementById('close-btn').style.display='none';
      const cb=document.getElementById('correct-btn');
      cb.textContent = '✓ Correct +$' + E().clueValue();
      cb.style.display='inline-block';
      document.getElementById('wrong-btn').style.display='inline-block';
    },
    /* The shared Correct button, over here: a typed win takes the same path. */
    onClueCorrect(){
      if(jFinalState && jFinalMark){ const f = jFinalMark; jFinalMark = null; f(true); return; }
      jCorrect(null);
    },
    /* The shared Wrong button: the deduction, the steal offer, the tile burn and the
       turn pass are all this board's. */
    onClueWrong(){
      if(jFinalState && jFinalMark){ const f = jFinalMark; jFinalMark = null; f(false); return; }
      const teams = E().teams();
      const showy = document.getElementById('play-jeopardy').classList.contains('lit');
      E().Sound.bedStop();
      if(showy){ E().Sound.play('klaxon'); jFlash('wrong'); }
      else E().Sound.play('wrong');
      const missed = (jDoubleTeam != null) ? jDoubleTeam : (jSteal ? jSteal.to : E().activeTeam());
      E().markRun(missed, false);
      /* The show takes the value off you, and a Daily Double takes the bet — but not on
         a grouping clue, where `missed` is only "whoever happened to be on turn". */
      if(S.get('jDeduct', 'jeopardy') && teams[missed] && E().modalMode() === 'jeopardy' && !E().roundClue()){
        E().ledgerNote(missed, -E().clueValue(), 'wrong answer · deduction rule');
        teams[missed].score -= E().clueValue();
        E().renderScorebar();
      }
      // a Daily Double is answered by one team alone, so there is no steal to open
      if(jDoubleTeam == null && jOfferSteal(missed)) return;
      const tile = E().currentTile();
      if(tile){ tile.classList.add('used'); }   // keeps its value, faded
      jSteal = null; jDoubleTeam = null;
      document.getElementById('clue-card').classList.remove('daily-double');
      E().closeModal(E().flipHoldMs(), jAfterClue);
      E().nextTurn();
    },
    /* The shared Close button, once the engine has paid any won round: restore the
       board's own lighting, close any open wager. */
    onClueClose(){
      closeWager();
      jDoubleTeam = null;
      document.getElementById('clue-card').classList.remove('daily-double');
      const wasJeopardy = E().modalMode()==='jeopardy' || E().modalMode()==='review';
      E().closeModal(0, wasJeopardy ? ()=>jTension() : null);
    },
    /* The shared claim chooser is this board's steal picker: picking a team takes the
       steal for them, and Skip (`null`) declines it. A steal is the only time Jeopardy
       shows the chooser. */
    onClaimPick(i){
      if(i == null){ if(jSteal) jDeclineSteal(); return null; }
      return jSteal ? jTakeSteal(i) : null;
    },
    /* The answer is out, or the floor has been handed back — stop the answer clock. */
    onFloorClear(){ jClockStop(); },
    /* How many seconds a team has on the floor once it buzzes in — the answer clock the
       relay hands to the phone that takes the floor. 0 turns it off. */
    floorSeconds(){ return Number(S.get('jAnswerSeconds', 'jeopardy')) || 0; },
    /* The scorebar redrew, so the Together class-total line follows it. */
    onScoreShown(){ renderClassLine(); }
  });

  /* The name a category shows. A category that plays a round takes that round's label
     as its default name — the single home for it, so the board heading, the content
     screen and the clue topline can't drift. An explicit `name` still wins. */
  function categoryName(cat){
    if(cat && cat.name) return cat.name;
    const clue = cat && cat.clues && cat.clues[0];
    const hit  = (clue && K.round && K.round.of) ? K.round.of(clue) : null;
    return (hit && hit.def && hit.def.label) || '';
  }

  function buildJeopardyBoard(){
    const cats = JEOPARDY_CATEGORIES.filter(c=>E().selectedContent().includes(c.id) && E().catAllowed(c));
    const board = document.getElementById('board');
    /* The count goes in a custom property and the stylesheet owns the track size —
       an inline `repeat(n, 1fr)` could not be overridden by a media query. */
    board.style.setProperty('--jcols', cats.length);
    board.innerHTML='';
    cats.forEach(cat=>{
      const h=document.createElement('div');
      h.className='cat-header'; h.textContent=categoryName(cat);
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

  function jDeal(){
    E().dealStagger('play-jeopardy', document.getElementById('board'), board => {
      // stagger on the diagonal, not on DOM order: row+column caps the wave at
      // rows+columns steps and reads as a sweep across the board rather than a queue.
      const cols = Math.max(1, board.querySelectorAll('.cat-header').length);
      [...board.children].forEach((el, i)=>
        el.style.setProperty('--i', Math.floor(i/cols) + (i % cols)));
    }, 1600);
  }

  /* ---- Jeopardy's tension curve ----
     What's at stake on the tile in play, with a slow floor that rises as the board
     empties. A $500 clue late in a game is the hottest moment on the board. */
  function jValueRange(){
    const vals = [];
    JEOPARDY_CATEGORIES.filter(c=>E().selectedContent().includes(c.id) && E().catAllowed(c))
      .forEach(c=>c.clues.forEach(cl=>vals.push(cl.v)));
    return vals.length ? { lo:Math.min(...vals), hi:Math.max(...vals) } : { lo:0, hi:1 };
  }

  function jTension(atStake){
    E().stageTension('jeopardy', () => {
      const tiles = [...document.querySelectorAll('#board .tile')];
      const done  = tiles.filter(t=>t.classList.contains('used')).length;
      const floor = tiles.length ? done/tiles.length : 0;
      let stake = 0;
      if(atStake){
        const { lo, hi } = jValueRange();
        stake = hi > lo ? (atStake - lo)/(hi - lo) : 1;
      }
      // think music while a clue is on the table and unanswered
      return { t: Math.min(1, 0.45*floor + 0.55*stake), live: !!atStake };
    });
  }

  /* The whole board has to be reachable without scrolling. Height is driven by the
     space actually available and the rows share what's left; the type scales to
     whatever row height results. */
  function fitJeopardyBoard(){
    const board = document.getElementById('board');
    if(!board.children.length || !jeoRows) return;
    if(!K.fitToScreen(board)) return;        // play screen not visible yet
    board.style.gridTemplateRows = `auto repeat(${jeoRows}, minmax(0, 1fr))`;

    const tile = board.querySelector('.tile');
    if(tile){
      const th = tile.getBoundingClientRect().height;
      board.style.setProperty('--jt', Math.max(0.5, Math.min(1.3, th/84)).toFixed(3));
    }
    fitCategoryHeadings(board);
  }

  /* A category name has to fit the column it sits in, not the viewport. The longest
     *word* is the constraint: spaces can wrap, a word cannot break without becoming
     unreadable. Measured on a canvas so it costs no reflow. */
  function fitCategoryHeadings(board){
    const heads = [...board.querySelectorAll('.cat-header')];
    if(!heads.length) return;
    const cs   = getComputedStyle(heads[0]);
    const ctx  = fitCategoryHeadings._ctx ||
                (fitCategoryHeadings._ctx = document.createElement('canvas').getContext('2d'));
    ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    /* Letter-spacing is em-based and canvas does not apply it, so add it back per
       character. Being em-based it scales with the answer, so the ratio holds. */
    const fs      = parseFloat(cs.fontSize) || 12;
    const trackEm = (parseFloat(cs.letterSpacing) || 0) / fs;
    let widest = 1;
    heads.forEach(h => h.textContent.trim().toUpperCase().split(/\s+/).forEach(w => {
      widest = Math.max(widest, ctx.measureText(w).width + w.length * trackEm * 100);
    }));
    const padding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const avail   = Math.max(10, heads[0].clientWidth - padding);
    /* The floor is a legibility floor, not a fitting one — below 10.5px the word is
       allowed to break instead (overflow-wrap in the stylesheet). */
    const px = (avail / (widest / 100)) * 0.96;
    board.style.setProperty('--jch', Math.max(10.5, Math.min(14.1, px)).toFixed(2) + 'px');
  }

  /* ================= TOGETHER: THE CLASS AGAINST THE BOARD =================
     The scores still belong to teams, but the *game* is played against a number.
     Pooling at the display and at the ending keeps this a mode rather than a second
     scoring system. */
  function jTogether(){ return E().activeGameId() === 'jeopardy' && !!S.get('jTogether', 'jeopardy'); }

  function jClassTotal(){ return E().teams().reduce((n, t) => n + (t.score || 0), 0); }

  // what the whole board is worth, so a target can be a share of it
  function jBoardWorth(){
    return [...document.querySelectorAll('#board .tile')]
      .reduce((n, t) => n + (Number((t.dataset.face || t.textContent).replace(/\D/g, '')) || 0), 0);
  }

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
     A hint is either **authored** (`reveal:[…]`) or generated from the spelling. Each
     hint takes a slice off what the clue is worth, so the class spends its own progress
     rather than being punished. */
  function jHintLayers(item){
    return (item && Array.isArray(item.reveal)) ? item.reveal.filter(Boolean) : [];
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
  function jHintsLeft(item){
    const layers = jHintLayers(item);
    return (layers.length ? layers.length : 2) - jHintsUsed;
  }
  /* On the same 50 grid the scoring uses, so shown and paid stay identical. */
  function jHintCost(){
    const pct = Number(S.get('jHintCost', 'jeopardy')) || 30;
    return Math.max(50, Math.round(E().clueValue() * pct / 100 / 50) * 50);
  }

  function renderHintButton(){
    const btn = document.getElementById('hint-btn');
    if(!btn) return;
    const item = E().clueItem();
    /* Hints were built for `together`; an **authored** reveal is how the clue was
       written, so a competitive board should be able to offer it too. Still behind
       `jHints`; items without `reveal` are exactly as gated as before. */
    const authored = jHintLayers(item).length > 0;
    const on = (jTogether() || authored) && S.get('jHints', 'jeopardy') && E().modalMode() === 'jeopardy' &&
               item && jHintsLeft(item) > 0 && !jWager && E().clueValue() > 50;
    btn.style.display = on ? 'inline-block' : 'none';
    if(on){
      btn.textContent = (jHintsUsed === 0 ? 'Need a hand? (−$' : 'One more? (−$') + jHintCost() + ')';
    }
  }

  /* ---- Daily Doubles ----
     Hidden at build time and never drawn differently. Re-plantable, and it has to be:
     picking Classic mid-board sets the switch and the board must gain one. Planting
     among the tiles **still unplayed** is what makes it safe. */
  function jPlantDailyDoubles(){
    const want = Math.min(Number(S.get('jDailyDoubles', 'jeopardy')) || 0, 3);
    const all  = [...document.querySelectorAll('#board .tile')];
    all.forEach(t => delete t.dataset.dd);
    const tiles = all.filter(t => !t.classList.contains('used'));
    if(!want || !tiles.length) return;
    /* Weighted towards the bottom of the board, as the show does it. */
    const pool = E().shuffle(tiles.slice()).sort((a, b) =>
      (Number(b.dataset.row) || 0) - (Number(a.dataset.row) || 0));
    pool.slice(0, Math.max(1, Math.min(want, Math.ceil(tiles.length / 4))))
        .forEach(t => { t.dataset.dd = '1'; });
  }

  /* ---- the wager ---- */
  function jMaxWager(team){
    // the show: your score, or the biggest clue on the board, whichever is greater
    const teams = E().teams();
    const hi = jValueRange().hi || 0;
    return Math.max(hi, (teams[team] && teams[team].score) || 0);
  }

  function renderWager(){
    if(!jWager) return;
    const t = E().teams()[jWager.team];
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

  /* The teacher places the bet, like every other click. The buttons are the amounts a
     room actually says out loud. */
  function openWager(team, opts){
    const max = opts.max != null ? opts.max : jMaxWager(team);
    jWager = { team, min: opts.min || 0, max, amount: opts.start != null ? opts.start : Math.min(max, 200),
               then: opts.then };
    document.getElementById('wager-panel').style.display = 'block';
    document.getElementById('clue-text').style.display = 'none';
    document.getElementById('clue-answer').style.display = 'none';
    E().hideAllActionButtons();
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

  /* ---- the content screen ---- */
  function renderJeopardyContent(list, help){
    help.textContent = "Pick which categories to include — the board builds itself from your selection (choose at least 3).";
    let lastSection=null;
    JEOPARDY_CATEGORIES.forEach(cat=>{
      if(!E().catAllowed(cat)) return;
      if(cat.section!==lastSection){
        E().sectionHeading(list, JEOPARDY_SECTION_LABELS[cat.section] || cat.section);
        lastSection=cat.section;
      }
      E().contentRow(list, { value:cat.id, section:cat.section,
                             label:E().stripSection(categoryName(cat), cat.section), items:cat.clues });
    });
  }

  function jeopardyStartButton(btn){
    const picked = E().selectedContent().length;
    btn.disabled = picked < 3;
    btn.textContent = picked < 3
      ? `Select at least 3 categories to build the board (${picked} chosen)`
      : `Build board with ${picked} categories`;
  }

  /* ---- opening a clue over a tile: this board borrows the shared clue card ---- */
  function openJeopardyClue(cat, clue, tile){
    const review = tile.classList.contains('used');
    E().setCurrentTile(tile);
    E().setModalMode(review ? 'review' : 'jeopardy');
    E().setClueValue(clue.v);
    jSteal = null;
    jDoubleTeam = null;
    /* A Daily Double is a bet placed before the clue is seen, so the card opens on the
       wager and the clue is not drawn until it is locked in. Only the team that found
       it may answer — no buzzers, no steal. */
    if(!review && tile.dataset.dd){
      delete tile.dataset.dd;
      jDoubleTeam = E().activeTeam();
      /* Tell the phones the room is not being asked — disarming says the true thing:
         nothing is open to you, this one belongs to one team. */
      E().standDownPhones();
      E().openClueCard(tile);
      document.getElementById('clue-topline').textContent = 'DAILY DOUBLE';
      document.getElementById('clue-section').textContent = cat.section;
      document.getElementById('clue-card').classList.add('daily-double');
      if(document.getElementById('play-jeopardy').classList.contains('lit')) E().Sound.play('sting');
      else E().Sound.play('claim');
      openWager(E().activeTeam(), { max: jMaxWager(E().activeTeam()),
                          then: bet => { E().setClueValue(bet); jShowClue(cat, clue, tile, false); } });
      return;
    }
    // openRoundOnCard opens the card itself now; the Daily Double opened it earlier for
    // the wager and jShowClue will not re-flip it.
    jShowClue(cat, clue, tile, review);
  }

  // everything that was openJeopardyClue's body, so the Daily Double can run it
  // *after* its bet rather than duplicating it
  function jShowClue(cat, clue, tile, review){
    const dd = jDoubleTeam != null;
    /* The topline carries the value, so it is the host's to compose — a Daily Double says
       the bet, an ordinary tile its price, a replay marks itself. */
    const topline =
      dd ? ('DAILY DOUBLE · ' + categoryName(cat) + ' · $' + E().clueValue())
         : (categoryName(cat) + ' · $' + clue.v + (review ? '  ·  review' : ''));
    /* `reveal` rides along with the normalised shape (the kit never learns Jeopardy calls
       a prompt `q`); `source:clue` is what carries whatever else a registered round claims
       — a grouping set's `group` — onto the item without this host naming each field. */
    const item = { text:clue.q, answer:clue.a, type:clue.type, reveal:clue.reveal };
    /* The shared open sequence, once. What stays here is genuinely Jeopardy's: a replayed
       tile arms nobody and opens no round (`open:false`), a Daily Double belongs to one
       team so nothing is asked (`ask:false`), and review reveals the answer at once. */
    E().openRoundOnCard({
      game:'jeopardy', mode: review ? 'review' : 'jeopardy', origin:tile,
      item, source:clue,
      topline, section:cat.section,
      open: !review, ask: (!review && !dd),
      buttons: { reveal: !review, close: true }
    });
    if(review){
      // already played — show everything, score nothing: the answer prints on its own
      // line unless the form already revealed it inline.
      document.getElementById('clue-answer').style.display =
        K.prompt.reveal(document.getElementById('clue-text'), item) ? 'none' : 'block';
    }
    jTension(review ? 0 : (dd ? Math.max(clue.v, E().clueValue()) : clue.v));
    jHintsUsed = 0;
    renderHintButton();   // toggles the fixed #hint-btn; after the strip is (re)built
  }

  /* ---- the answer clock ----
     Starts when a team takes the floor — the buzz, not the clue opening. Its own
     countdown on the clue card rather than the header timer: that widget is the
     teacher's instrument. Time up is a fact the room hears, not a verdict. Runs on
     `Kit.round.clock`, shared with Quickfire's question clock. */
  function jClockStop(){
    K.round.clock.stop();
    const el = document.getElementById('clue-clock');
    if(el) el.remove();
    const card = document.getElementById('clue-card');
    if(card) card.classList.remove('overtime');
  }
  function jClockStart(){
    jClockStop();
    const secs = Number(S.get('jAnswerSeconds', 'jeopardy')) || 0;
    if(!secs || E().activeGameId() !== 'jeopardy' || !E().clueIsOpen()) return;
    const el = document.createElement('span');
    el.id = 'clue-clock';
    document.getElementById('clue-topline').appendChild(el);
    K.round.clock.start({
      secs,
      onTick(left){
        const n = Math.ceil(left);
        el.textContent = String(n);
        el.classList.toggle('urgent', n <= 3);
      },
      onEnd(){
        el.textContent = '0';
        el.classList.add('urgent');
        document.getElementById('clue-card').classList.add('overtime');
        E().Sound.play('klaxon');
      }
    });
  }

  /* ---------- the steal ----------
     A missed clue is offered to the room for half the points; the team that missed it
     is excluded. Returns true when it has taken the beat (which stands the wrong-answer
     path down); false means "close it as before". */
  function jOfferSteal(teamIdx){
    /* A grouping clue has no rebound: every team was assembling it at once, nobody was
       excluded, so there is nothing to offer. It burns the tile and passes the turn. */
    if(E().roundClue()) return false;
    if(!S.get('stealOnWrong', 'jeopardy')) return false;
    if(jSteal) return false;                       // one steal per clue, then it's gone
    const teams = E().teams();
    const others = teams.map((_, i) => i).filter(i => i !== teamIdx);
    if(!others.length) return false;
    jSteal = { from: teamIdx, to: others[0] };

    /* Put the answer away again — offering the steal with the answer on screen just
       invites the other team to read it out. The stealing team gets the same question. */
    E().drawPrompt(document.getElementById('clue-text'), E().clueItem(), 'jeopardy');
    document.getElementById('clue-answer').style.display = 'none';

    E().hideAllActionButtons();
    const line = document.getElementById('clue-topline');
    // what the card offers has to be what award() will pay — shown and paid must agree
    line.textContent = line.textContent.replace(/ · steal.*$/, '') + '  ·  steal for ' +
                       Math.round(E().clueValue() / (S.get('stealFullValue','jeopardy') ? 1 : 2));
    E().clueClaimShow(teams, others);
    const skip = document.getElementById('skip-btn');
    skip.textContent = 'No steal / close';
    skip.style.display = 'inline-block';
    return true;
  }

  /* Nobody wanted it: burn the tile and pass the turn. */
  function jDeclineSteal(){
    jSteal = null;
    const tile = E().currentTile();
    if(tile) tile.classList.add('used');
    E().clueClaimHide();
    E().closeModal(0, jAfterClue);
    E().nextTurn();
  }

  /* Someone claimed the steal: that team now owns the question, so re-open the normal
     reveal path with them on the hook. */
  function jTakeSteal(teamIdx){
    jSteal.to = teamIdx;
    E().clueClaimHide();
    document.getElementById('reveal-btn').style.display = 'inline-block';
    document.getElementById('close-btn').style.display  = 'inline-block';
    jClockStart();     // the stealing team is on the floor now, same rule as a buzz
  }

  /* Paying a tile out, as a function rather than only as a button handler: a typed
     answer judged right on the host is the same event as ✓ Correct. `to` names the team
     when something other than the turn decides it — a steal, or the phone. */
  function jCorrect(to){
    const teams = E().teams();
    const showy = document.getElementById('play-jeopardy').classList.contains('lit');
    const value = E().clueValue();
    // a Daily Double belongs to whoever found it, whatever the turn has done since
    const team  = (jDoubleTeam != null) ? jDoubleTeam
                : (to != null) ? to : (jSteal ? jSteal.to : E().activeTeam());
    E().Sound.bedStop();
    if(showy){
      E().Sound.play('sting'); jFlash('right');
      // the top of the board is worth a round of applause
      if(value >= jValueRange().hi) setTimeout(()=>E().Sound.applause(1500), 260);
    } else {
      E().Sound.play('correct');
    }
    const tile = E().currentTile();
    if(tile){ tile.classList.add('used'); }   // keeps its value, faded
    let paid = 0;
    if(teams.length){
      paid = E().award(team, value, { steal: !!jSteal && team === jSteal.to,
                                  why: (jDoubleTeam != null) ? 'daily double bet' : 'tile ' + value });
      E().markRun(team, true);
    }
    jSteal = null; jDoubleTeam = null;
    document.getElementById('clue-card').classList.remove('daily-double');
    E().closeModal(E().flipHoldMs(), jAfterClue);
    /* A team that answers keeps the board, and steal is what stops that running away —
       but in `write` there is no winning it: the whole room answered, so the turn
       rotates and everyone gets one. */
    if(!S.get('keepControl', 'jeopardy') || E().everyoneAnswers()) E().nextTurn();
    return paid;
  }

  /* A slow wash over the board on the result — same 1.5Hz ceiling and reduced-motion
     opt-out as Millionaire's. */
  function jFlash(kind){
    const stage = document.getElementById('play-jeopardy');
    if(!stage.classList.contains('lit') || !E().motionOK()) return;
    stage.classList.remove('flash-right','flash-wrong');
    void stage.offsetWidth;
    stage.classList.add(kind==='right' ? 'flash-right' : 'flash-wrong');
    setTimeout(()=>stage.classList.remove('flash-right','flash-wrong'), 900);
  }

  /* Once the card is back on its tile: reset the lights, and if that was the last tile,
     call the game. */
  function jAfterClue(){
    if(E().activeGameId() !== 'jeopardy') return;
    jTension();
    const tiles = [...document.querySelectorAll('#board .tile')];
    if(!tiles.length || tiles.some(t=>!t.classList.contains('used'))) return;
    if(S.get('jFinalQuestion', 'jeopardy') && jFinalCanRun()) jStartFinal();
    else jFinish();
  }

  /* ================= THE FINAL CLUE =================
     Everyone bets what they like, so last place can win from there. Three beats — bet,
     answer, settle — and the teacher drives all three. A team on nothing or less cannot
     bet. */
  function jFinalPlayers(){
    const teams = E().teams();
    return teams.map((t, i) => i).filter(i => teams[i] && teams[i].score > 0);
  }
  function jFinalClue(){
    /* Prefer a clue the room has *not* seen: the categories left off the board. */
    const onBoard = new Set(E().selectedContent());
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
    if(document.getElementById('play-jeopardy').classList.contains('lit')) E().Sound.play('sting');
    E().showResult({
      eyebrow:'Jeopardy · the final clue',
      title:'One more clue',
      sub:'The category is ' + jFinalState.cat.name + '. Every team bets what it likes — ' +
          'a team in last can still win.',
      actions:[{ label:'Take the bets', primary:true, onPick:jFinalNextBet }]
    });
  }

  /* Each team in turn, on the card the rest of the game already uses. */
  function jFinalNextBet(){
    if(!jFinalState) return;
    if(jFinalState.at >= jFinalState.order.length){ jFinalAsk(); return; }
    const teams = E().teams();
    const team = jFinalState.order[jFinalState.at];
    E().setModalMode('jeopardy');
    E().setCurrentTile(null);
    jSteal = null; jDoubleTeam = null;
    document.getElementById('clue-topline').textContent = 'FINAL · ' + jFinalState.cat.name;
    document.getElementById('clue-section').textContent = jFinalState.cat.section;
    document.getElementById('clue-card').classList.add('daily-double');
    E().openClueCard(null);
    openWager(team, { max: teams[team].score, then: bet => {
      jFinalState.bets[team] = bet;
      jFinalState.at++;
      E().closeModal(0, jFinalNextBet);
    } });
  }

  function jFinalAsk(){
    const st = jFinalState;
    if(!st) return;
    st.asking = true;          // from here the room writes, whatever the mode says
    E().setClueValue(0);
    E().setCurrentTile(null);
    E().setModalMode('jeopardy');
    document.getElementById('clue-card').classList.remove('daily-double');
    document.getElementById('clue-topline').textContent = 'FINAL CLUE · ' + st.cat.name;
    document.getElementById('clue-section').textContent = st.cat.section;
    const item = { text:st.clue.q, answer:st.clue.a, type:st.clue.type };
    E().setClueItem(item);
    E().drawPrompt(document.getElementById('clue-text'), item, 'jeopardy');
    document.getElementById('clue-text').style.display = '';
    const ans = document.getElementById('clue-answer');
    ans.textContent = st.clue.a; ans.style.display = 'none';
    E().hideAllActionButtons();
    document.getElementById('reveal-btn').style.display = 'inline-block';
    E().openClueCard(null);
    E().askPhones(st.clue.q, 'jeopardy');     // every team writes this one
    E().timerSetDuration(30); E().timerStart();
    jTension(jValueRange().hi);
  }

  /* Settling it: each team that bet is marked right or wrong, lowest score first as the
     show does it, and the bet is added or taken away. */
  function jFinalSettle(){
    const st = jFinalState;
    if(!st) return;
    st.asking = false;         // answers are in; the phones go back to the mode
    const teams = E().teams();
    const pending = st.order.filter(i => st.marked[i] == null);
    if(!pending.length){ jFinalState = null; jFinalWasPlayed = true; jFinish(); return; }
    const team = pending.sort((a, b) => teams[a].score - teams[b].score)[0];
    E().hideAllActionButtons();
    document.getElementById('clue-topline').textContent =
      teams[team].name + ' bet $' + (st.bets[team] || 0);
    const mark = (right) => {
      st.marked[team] = right;
      if(st.bets[team]) E().ledgerNote(team, (right ? 1 : -1) * st.bets[team],
                                   right ? 'final clue · bet won' : 'final clue · bet lost');
      teams[team].score += (right ? 1 : -1) * (st.bets[team] || 0);
      E().markRun(team, right);
      E().renderScorebar();
      E().Sound.play(right ? 'correct' : 'wrong');
      jFinalSettle();
    };
    const ok = document.getElementById('correct-btn');
    const no = document.getElementById('wrong-btn');
    ok.style.display = 'inline-block'; no.style.display = 'inline-block';
    ok.textContent = '✓ ' + teams[team].name + ' +$' + (st.bets[team] || 0);
    no.textContent = '✗ ' + teams[team].name + ' −$' + (st.bets[team] || 0);
    jFinalMark = mark;
  }

  function jFinish(){
    const wasFinal = jFinalWasPlayed;
    jFinalWasPlayed = false;
    E().closeModal(0, null);
    /* Together: there is nobody to rank. */
    if(jTogether()){ jFinishTogether(); return; }
    const teams = E().teams();
    const ranked = teams.map((t,i)=>({ t, i })).sort((a,b)=>b.t.score - a.t.score);
    const top    = ranked[0];
    if(!top) return;
    const drawn  = ranked.length > 1 && ranked[1].t.score === top.t.score;
    if(document.getElementById('play-jeopardy').classList.contains('lit')){
      E().Sound.fanfare(); setTimeout(()=>E().Sound.applause(2400), 700);
    } else {
      E().Sound.play('clear');
    }
    E().showResult({
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
      if(lit){ E().Sound.fanfare(); setTimeout(()=>E().Sound.applause(2400), 700); } else E().Sound.play('clear');
    } else {
      E().Sound.play('clear');
    }
    E().showResult({
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
})();
