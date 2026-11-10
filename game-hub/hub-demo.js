/* ================= Demo mode — the glowing "press here next" =================
   For a visitor who has never seen the board: a recruiter opening a link, nobody
   beside them to say which button the teacher would press. Off unless the URL asks
   for it (`?demo=1` deals the World Quiz, `?demo=<unit id>` another unit), so a
   class never sees it.

   What it does, and nothing more:
   - the visitor walks the real setup screens, so they SEE the range — every unit,
     every game, the topics — but everything off the one demo path is greyed out
     and cannot be clicked, and the path itself glows: the unit, Flip, Start;
   - on the topic screen it ticks every topic of the demo unit and locks the list,
     the round filter and the teams/individuals choice, so Start is always live;
   - from then on, every quarter second, it finds the ONE thing to press next and
     makes it pulse, with a short label beside it.

   It READS the board and locks what is off the path; the only thing it ever writes
   is the topic ticks a teacher would have made. No setting is written, so a teacher
   who opens the demo link in their own browser keeps their settings. Nothing in the
   engine or in Flip knows it exists. */
(function(){
  'use strict';
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  if(!demo) return;
  const UNIT_ID = (demo === '1' || demo === 'true') ? 'world-quiz' : demo;

  const css = `
    @keyframes hd-demo-pulse {
      0%,100% { box-shadow: 0 0 0 3px #ffd84d, 0 0 14px 4px rgba(255,216,77,.75); }
      50%     { box-shadow: 0 0 0 6px #ffd84d, 0 0 30px 12px rgba(255,216,77,.95); }
    }
    /* Paint only: a glow must never move what it lights (position/z-index here
       knocked the absolutely placed intro panel out from under the click). */
    .hd-demo-next { animation: hd-demo-pulse 1.1s ease-in-out infinite !important; }
    .hd-demo-off { opacity: .38 !important; filter: grayscale(1) !important;
                   pointer-events: none !important; cursor: default !important; }
    .hd-demo-fixed { pointer-events: none !important; opacity: .9; }
    .hd-demo-tip { position: fixed; z-index: 9999; pointer-events: none;
      background: #ffd84d; color: #111; font: 700 15px/1.2 Arial, Helvetica, sans-serif;
      padding: 7px 12px; border-radius: 8px; box-shadow: 0 3px 0 #111; white-space: nowrap;
      transition: opacity .15s; }
    .hd-demo-tip::after { content:''; position:absolute; left:50%; margin-left:-7px;
      border:7px solid transparent; }
    .hd-demo-tip.below::after { top:-14px; border-bottom-color:#ffd84d; }
    .hd-demo-tip.above::after { bottom:-14px; border-top-color:#ffd84d; }
    #hd-demo-banner { position: fixed; z-index: 9998; left: 10px; bottom: 7px; max-width: 340px;
      pointer-events: none; background: rgba(17,17,17,.9); color: #fff;
      font: 600 12px/1.25 Arial, Helvetica, sans-serif; padding: 4px 10px;
      border-radius: 8px; border: 2px solid #ffd84d; }
    #hd-demo-banner small { display:block; font-weight:400; opacity:.8; }
    @media (max-width: 1100px) { #hd-demo-banner { display:none; } }
    @media (prefers-reduced-motion: reduce) {
      .hd-demo-next { animation: none !important; box-shadow: 0 0 0 5px #ffd84d !important; }
    }`;

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const shown = el => {
    if(!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  /* ---------- the path, and everything off it ---------- */
  function demoUnitCard(){
    const i = (window.UNITS || []).findIndex(u => u.id === UNIT_ID);
    return i < 0 ? null : $$('#unit-grid .unit-card')[i] || null;
  }
  const off = (el, yes) => el && el.classList.toggle('hd-demo-off', !!yes);
  /* Run every tick: the engine rebuilds a screen whenever it is shown, so a lock
     applied once would be gone on the next visit. */
  function lockPath(){
    const mine = demoUnitCard();
    $$('#unit-grid .unit-card').forEach(c => off(c, mine && c !== mine));
    $$('.game-card').forEach(g => off(g, g.dataset.game !== 'flip'));
    if(shown($('#screen-content-select'))){
      $$('#content-list input').forEach(b => { if(!b.checked) b.click(); });
      ['#round-filter', '#roster-pick'].forEach(s => off($(s), true));
      /* The demo unit's own topics are what is being shown off: readable, ticked,
         just not clickable — not greyed like everything off the path. */
      const list = $('#content-list'); if(list) list.classList.add('hd-demo-fixed');
    }
  }

  /* ---------- the one thing to press next ---------- */
  function phones(){
    const c = $('#buzzer-chip .buzz-count');
    const n = c ? parseInt(c.textContent, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }
  function next(){
    if(shown($('#join-modal.on'))) return [[$('#join-close'), 'Done? Close this']];
    if(shown($('#intro-overlay.on'))) return [[$('#intro-overlay'), 'Click to skip the intro']];
    if(shown($('#result-modal.on'))){
      const b = $('#result-actions button'); return b ? [[b, 'Play again']] : [];
    }
    if(shown($('#standings-modal.on'))) return [[$('#standings-go'), 'The scores — press Continue']];
    const pick = $('#flip-pick.on');
    if(shown(pick)){
      const row = $('.flip-pick-line.leading', pick) || $('.flip-pick-line.live', pick);
      return row ? [[row, 'Choose one']] : [];
    }
    const modal = $('#clue-modal');
    if(modal && modal.style.display === 'flex'){
      if(shown($('#clue-intro'))) return [[$('#clue-intro'), 'Click here to start the question']];
      const close = $('#close-btn');
      /* Somebody got it: the round has judged it and is only holding the card so
         the room sees the answer. Pay it after the same beat — nothing to decide. */
      if(shown(close) && /takes it/.test(close.textContent)){ settle(close); return [[close, 'Right! Points coming…']]; }
      const ok = $('#correct-btn'), no = $('#wrong-btn');
      /* Correct/Wrong only ever show when NOBODY got it: a right answer on the
         board's Check or on a phone is judged and paid by the round itself. In
         class that is the teacher's call (an answer said aloud); a visitor has
         nothing to decide, so the demo closes the card for them — no points. */
      if(shown(ok) && close && shown(close)){ settle(close); return [[close, 'Nobody got it, so no points. Moving on…']]; }
      if(shown(ok)) return [[ok, 'Was it right? You decide'], [no, '']];
      const rev = $('#reveal-btn');
      /* No phones: the visitor plays the card's own table — drag tiles in, then
         Check. With phones, the hand does it and the board waits for Reveal. */
      const check = $('[data-action="commit"]', modal);
      if(shown(check) && !check.disabled) return [[check, 'Check your answer']];
      const table = $('canvas', modal);
      if(!phones() && shown(table)) return [[table, 'Drag your answer into the boxes, then Check', 'below']];   // above would cover the question
      /* With phones, the board waits for Reveal in case someone is still answering.
         Once as many have finished as there are phones (capped at the number of
         competitors — a team of two phones finishes once), there is nobody left:
         reveal for the visitor, and the round pays whoever got it. Unusual rooms
         fall through to the hint. */
      if(shown(rev) && phones() && allIn()){ settle(rev); return [[rev, 'Everyone has answered: revealing…']]; }
      if(shown(rev)) return [[rev, phones() ? 'Answer on your phone, then Reveal' : 'Think of the answer, then Reveal']];
      if(shown(close)) return [[close, 'Close the card']];
      return [];
    }
    if(shown($('#screen-unit-select'))){
      const c = demoUnitCard();
      const u = (window.UNITS || []).find(x => x.id === UNIT_ID);
      return c ? [[c, 'Start here: ' + ((u && u.card && u.card.title) || 'this one'), 'below']] : [];
    }
    if(shown($('#screen-game-select'))){
      const g = $('.game-card[data-game="flip"]');
      return shown(g) ? [[g, 'Play Flip', 'below']] : [];
    }
    if(shown($('#screen-content-select'))){
      const s = $('#start-btn');
      return shown(s) ? [[s, 'Topics chosen for you: press here']] : [];
    }
    /* The board. The QR comes first: the phone is the point of the thing, so until a
       phone is in, the visitor has opened the QR, or twenty seconds have passed (no
       phone to hand), only the QR glows. Then whose turn it is glows and carries the
       words, and the glow hops from card to card at random — any of them will do. */
    const scan = $('#buzzer-chip .buzz-scan');
    const onBoard = shown($('#flip-grid'));
    if(onBoard && !boardSince) boardSince = Date.now();
    if(shown($('#join-modal.on'))) qrSeen = true;
    if(scan && shown(scan) && !phones() && !qrSeen && Date.now() - boardSince < 20000)
      return [[scan, 'Step 1: tap here, then scan the QR with your phone', 'below']];
    const out = [];
    const turn = $('#flip-turn');
    const card = hopCard();
    if(turn && shown(turn) && card) out.push([turn, '← their turn: click any card', 'right']);
    else if(card) out.push([card, 'Pick any card']);
    if(card && out[0][0] !== card) out.push([card, '']);
    if(scan && shown(scan) && !phones()) out.push([scan, 'Join on your phone: tap here', 'below']);
    return out;
  }
  let boardSince = 0, qrSeen = false, hop = null, hopAt = 0;
  function hopCard(){
    const free = $$('#flip-grid .flip-card').filter(c => !c.classList.contains('used') && !c.disabled);
    if(!free.length) return null;
    if(!hop || !free.includes(hop) || Date.now() - hopAt > 1200){
      const others = free.filter(c => c !== hop);
      hop = (others.length ? others : free)[Math.floor(Math.random() * (others.length || free.length))];
      hopAt = Date.now();
    }
    return hop;
  }

  function allIn(){
    const R = window.HubKit && window.HubKit.round && window.HubKit.round.results;
    if(!R || !R.finished) return false;
    const teams = $$('.team').length || 1;
    return R.finished().length >= Math.min(phones(), teams);
  }

  /* The card's last press, made for the visitor: one Close per card, after a beat
     long enough to read the answer. Re-checked when it fires, so a visitor who
     clicked it first is not clicked twice. */
  let settling = null;
  function settle(close){
    if(settling) return;
    const label = close.textContent;
    settling = setTimeout(() => {
      settling = null;
      if(shown(close) && close.textContent === label) close.click();
    }, 2500);
  }

  /* ---------- drawing it ---------- */
  let lit = [];
  const tips = [];
  function tip(i){
    if(!tips[i]){ const t = document.createElement('div'); t.className = 'hd-demo-tip'; document.body.appendChild(t); tips[i] = t; }
    return tips[i];
  }
  function place(t, el, text, prefer){
    if(!text){ t.style.opacity = 0; return; }
    t.textContent = text; t.style.opacity = 1;
    const r = el.getBoundingClientRect();
    const w = t.offsetWidth, h = t.offsetHeight;
    // beside it, in the strip — for a label whose space above and below is the board
    t.classList.toggle('side', prefer === 'right');
    if(prefer === 'right'){
      t.classList.remove('below', 'above');
      t.style.top  = Math.max(4, r.top + r.height / 2 - h / 2) + 'px';
      t.style.left = Math.min(innerWidth - w - 6, r.right + 14) + 'px';
      return;
    }
    const below = prefer === 'below' ? (r.bottom + h + 14 < innerHeight) : (r.top - h - 14 < 4);
    t.classList.toggle('below', below); t.classList.toggle('above', !below);
    const top = below ? r.bottom + 12 : r.top - h - 12;
    const left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2));
    t.style.top = Math.max(4, Math.min(innerHeight - h - 4, top)) + 'px';
    t.style.left = left + 'px';
  }
  /* The setup screens scroll (only the board may not), and the one thing to press
     can sit below the fold — the World Quiz card, the Start button. Bring it into
     view once, when it becomes the target, and never fight the visitor after. */
  let brought = null;
  function bringIntoView(el){
    if(!el || el === brought) return;
    brought = el;
    const r = el.getBoundingClientRect();
    if(r.top < 60 || r.bottom > innerHeight - 70) el.scrollIntoView({ block:'center', behavior:'smooth' });
  }
  function tick(){
    lockPath();
    const want = next().filter(p => p[0] && shown(p[0]));
    lit.forEach(el => { if(!want.some(p => p[0] === el)) el.classList.remove('hd-demo-next'); });
    lit = want.map(p => p[0]);
    if(lit[0]) bringIntoView(lit[0]);
    lit.forEach(el => el.classList.add('hd-demo-next'));
    want.forEach((p, i) => place(tip(i), p[0], p[1], p[2]));
    for(let i = want.length; i < tips.length; i++) tips[i].style.opacity = 0;
  }

  function boot(){
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const banner = document.createElement('div'); banner.id = 'hd-demo-banner';
    banner.innerHTML = 'Demo: press whatever is glowing<small>Greyed out: other units and games, locked for the demo</small>';
    document.body.appendChild(banner);
    setInterval(tick, 250);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.HubDemo = { next };     // the probe's window: what would be lit now
})();
