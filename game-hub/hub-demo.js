/* ================= Demo mode — the glowing "press here next" =================
   For a visitor who has never seen the board: a recruiter opening a link, nobody
   beside them to say which button the teacher would press. Off unless the URL asks
   for it (`?demo=1`, or `?demo=general-knowledge-2` to pick the unit), so a class
   never sees it.

   What it does, and nothing more:
   - walks the setup screens itself (the General Knowledge unit, Flip, every
     category, Start, the title sequence), so the visitor lands on the board;
   - every quarter second, finds the ONE thing to press next and makes it pulse,
     with a short label beside it.

   It only READS the board: it looks at which screen, card or panel is showing and
   clicks nothing after setup. Nothing in the engine or in Flip knows it exists —
   the same shape as Kit.vote: it takes what is on the page and hands back a hint.
   No settings are written, so a teacher who opens the demo link on their own
   browser finds their own settings untouched. */
(function(){
  'use strict';
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  if(!demo) return;
  const UNIT = (demo === '1' || demo === 'true') ? 'General Knowledge' : null;
  const UNIT_ID = UNIT ? null : demo;

  const css = `
    @keyframes hd-demo-pulse {
      0%,100% { box-shadow: 0 0 0 3px #ffd84d, 0 0 14px 4px rgba(255,216,77,.75); }
      50%     { box-shadow: 0 0 0 6px #ffd84d, 0 0 30px 12px rgba(255,216,77,.95); }
    }
    /* Paint only: a glow must never move what it lights (position/z-index here
       knocked the absolutely placed intro panel out from under the click). */
    .hd-demo-next { animation: hd-demo-pulse 1.1s ease-in-out infinite !important; }
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
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, ms){
    for(let t = 0; t < ms; t += 150){ const v = fn(); if(v) return v; await sleep(150); }
    return null;
  }

  /* ---------- setup: straight to the board ---------- */
  async function setup(){
    const card = await waitFor(() => $$('#unit-grid .unit-card').find(c => {
      const h = $('h2', c); if(!h) return false;
      if(UNIT_ID) return (window.UNITS || []).some((u, i) => u.id === UNIT_ID && $$('#unit-grid .unit-card')[i] === c);
      return h.textContent.trim() === UNIT;
    }), 8000);
    if(!card) return;
    card.click();
    const flip = await waitFor(() => { const g = $('.game-card[data-game="flip"]'); return shown(g) && g; }, 4000);
    if(!flip) return;
    flip.click();
    const boxes = await waitFor(() => { const b = $$('#content-list input'); return b.length && b; }, 4000);
    if(!boxes) return;
    boxes.forEach(b => { if(!b.checked) b.click(); });
    const start = await waitFor(() => { const s = $('#start-btn'); return s && !s.disabled && s; }, 3000);
    if(start) start.click();
    // the title sequence: any key skips it
    const ov = await waitFor(() => $('#intro-overlay.on'), 2500);
    if(ov) document.dispatchEvent(new KeyboardEvent('keydown', { key:' ', code:'Space', bubbles:true }));
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
      if(shown(close) && /takes it/.test(close.textContent)) return [[close, 'Give them the points']];
      const ok = $('#correct-btn'), no = $('#wrong-btn');
      if(shown(ok)) return [[ok, 'Was it right? You decide'], [no, '']];
      const rev = $('#reveal-btn');
      /* No phones: the visitor plays the card's own table — drag tiles in, then
         Check. With phones, the hand does it and the board waits for Reveal. */
      const check = $('[data-action="commit"]', modal);
      if(shown(check) && !check.disabled) return [[check, 'Check your answer']];
      const table = $('canvas', modal);
      if(!phones() && shown(table)) return [[table, 'Drag your answer into the boxes, then Check', 'below']];   // above would cover the question
      if(shown(rev)) return [[rev, phones() ? 'Answer on your phone, then Reveal' : 'Think of the answer, then Reveal']];
      if(shown(close)) return [[close, 'Close the card']];
      return [];
    }
    if(shown($('#screen-unit-select'))){
      const c = $$('#unit-grid .unit-card').find(x => /General Knowledge/.test(x.textContent));
      return c ? [[c, 'Start here']] : [];
    }
    if(shown($('#screen-game-select'))){
      const g = $('.game-card[data-game="flip"]');
      if(shown(g)) return [[g, 'Play Flip']];
      const s = $('#start-btn'); return shown(s) ? [[s, 'Start the game']] : [];
    }
    const card = $$('#flip-grid .flip-card').find(c => !c.classList.contains('used') && !c.disabled);
    const out = [];
    if(card) out.push([card, 'Pick any card']);
    const scan = $('#buzzer-chip .buzz-scan');
    if(scan && shown(scan) && !phones()) out.push([scan, 'Play on your phone: tap here for the QR']);
    return out;
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
    const below = prefer === 'below' ? (r.bottom + h + 14 < innerHeight) : (r.top - h - 14 < 4);
    t.classList.toggle('below', below); t.classList.toggle('above', !below);
    const top = below ? r.bottom + 12 : r.top - h - 12;
    const left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2));
    t.style.top = Math.max(4, Math.min(innerHeight - h - 4, top)) + 'px';
    t.style.left = left + 'px';
  }
  function tick(){
    const want = next().filter(p => p[0] && shown(p[0]));
    lit.forEach(el => { if(!want.some(p => p[0] === el)) el.classList.remove('hd-demo-next'); });
    lit = want.map(p => p[0]);
    lit.forEach(el => el.classList.add('hd-demo-next'));
    want.forEach((p, i) => place(tip(i), p[0], p[1], p[2]));
    for(let i = want.length; i < tips.length; i++) tips[i].style.opacity = 0;
  }

  function boot(){
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const banner = document.createElement('div'); banner.id = 'hd-demo-banner';
    banner.innerHTML = 'Demo: press whatever is glowing<small>Built for B1 Italian teenage learners</small>';
    document.body.appendChild(banner);
    setInterval(tick, 250);
    setup();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.HubDemo = { next };     // the probe's window: what would be lit now
})();
