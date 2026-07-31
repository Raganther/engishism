/* ================= Bench kit — what every question game needs =================
   The middle tier. `hub-kit.js` is what the *games* share; this is what the
   **question bench** shares — the playground pages where a dynamic is tried out
   before anything reaches a lesson.

   It exists because the same code was written twice within two days: `openRoom`
   was nearly byte-for-byte identical in connections.html and prompt-lab.html, and
   a third question game would have made it three. The rule that keeps this honest
   is **extract what is already duplicated, not what might be** — a playground's
   value is that pages are allowed to be weird, and abstracting a sandbox too early
   kills the thing it is for.

     BenchKit.room({mount, board, on:{…}})   the room: code, chip, join panel, QR
     BenchKit.settings(mount, defs, onChange) a toolbar that builds itself

   What is deliberately NOT here yet: teams and the round (turns vs race, the
   clock, rethink, multi-pick, judging a set). Those are near-certainly shared —
   nothing about "how does a team assemble an answer" is Connections-specific — but
   they have one caller so far, and an API shaped by one caller is a guess. They
   move here when the second question game asks for them.

   Loads after hub-buzzer.js (and hub-qr.js, if the page wants a QR).
   ============================================================================ */
window.BenchKit = (function(){
  'use strict';

  const params = new URLSearchParams(location.search);
  const RELAY  = params.get('relay') || '';

  /* ---------- the room ----------
     Opens a room on the relay, renders the chip that shows it, and owns the join
     panel behind it. The page gets the host back and does its own arming — what a
     round *means* is the game's business, exactly as the relay never learns what
     an answer means.

     Degradation is the contract: no relay reachable means `on.ready` never fires
     and the chip says so, and the page must stay playable teacher-only. Every
     playground page is checked for that. */
  function room(opts){
    const o = opts || {};
    const board = o.board || '';
    const on = o.on || {};
    let host = null, lan = '', count = 0;

    const mount = o.mount || document.body;
    const chip = document.createElement('span');
    chip.id = 'room-chip';
    chip.textContent = 'phones off';
    chip.title = 'Nobody can join until a relay is reachable.';
    mount.appendChild(chip);

    // the panel lives here rather than in every page's markup
    const panel = document.createElement('div');
    panel.id = 'join-panel';
    panel.innerHTML =
      '<div id="join-card">' +
        '<div class="code" id="join-code"></div>' +
        '<div class="url" id="join-url"></div>' +
        '<div id="join-qr"></div>' +
        '<div id="join-count"></div>' +
        '<a id="bench-link" href="phone-bench.html">Simulate phones beside the board →</a>' +
        '<span class="aside">The bench opens this page as its board and racks the handsets ' +
          'next to it, so you can watch several phones and the question together. ' +
          'The code above is for real phones.</span>' +
      '</div>';
    document.body.appendChild(panel);
    panel.addEventListener('click', e=>{ if(e.target === panel) panel.classList.remove('on'); });

    function base(){
      if(RELAY) return RELAY;
      if(location.protocol === 'file:') return lan ? 'http://' + lan : '';
      return location.origin;
    }
    function paintChip(){
      if(!host){ chip.textContent = 'phones off'; return; }
      chip.innerHTML = 'CODE <b></b> · ' + count + ' in';
      chip.querySelector('b').textContent = host.code;
    }
    chip.addEventListener('click', ()=>{
      if(!host) return;
      document.getElementById('join-code').textContent = host.code;
      document.getElementById('join-url').textContent  = base().replace(/^https?:\/\//,'') + '/join.html';
      document.getElementById('join-count').textContent = count + ' joined';
      const box = document.getElementById('join-qr');
      box.innerHTML = '';
      try{
        const q = window.qrcode(0, 'M');
        q.addData(base() + '/join.html?code=' + host.code);
        q.make();
        box.innerHTML = q.createSvgTag({ cellSize:7, margin:0, scalable:true });
      }catch(e){}
      /* The bench loads *this page* as its board, so the phones sit beside the
         game rather than in a tab of their own — passing only a code left you with
         handsets and nothing to watch them act on. */
      document.getElementById('bench-link').href =
        'phone-bench.html' + (board ? '?board=' + encodeURIComponent(board) : '');
      panel.classList.add('on');
    });

    if(window.HubBuzzer){
      HubBuzzer.newCode(RELAY).then(d=>{
        if(!d){ paintChip(); return; }
        lan = d.lan || '';
        host = HubBuzzer.host({ relay:RELAY, code:d.code });
        /* What room this page is hosting, stated rather than scraped — the phone
           bench asks exactly this of whatever board it has loaded, so it needs to
           know nothing about which game is being played. */
        window.HubHost = host;
        host.on('ready',   ()=>{ paintChip(); if(on.ready) on.ready(host); });
        host.on('players', ()=>{ count = host.players().length; paintChip();
                                 if(on.players) on.players(host.players()); });
        if(on.response) host.on('response', on.response);
        paintChip();
      }).catch(()=>paintChip());
    }

    return {
      host(){ return host; },
      relay: RELAY,
      players(){ return count; },
      close(){ if(panel) panel.classList.remove('on'); }
    };
  }

  /* ---------- the settings strip ----------
     The same idea as the hub's settings registry, one tier down: a page declares
     what it offers and the toolbar builds itself, so a control that every question
     game wants — how long the team gets, how the teams play — is written once and
     inherited rather than hand-rolled per page.

     Each def: {id, label, default, options:[{value,label}], number?}. The `id`
     becomes the element id, so anything looking *at* the strip (a test, the bench)
     has a stable handle rather than prose. */
  function settings(mount, defs, onChange){
    const els = {};
    (defs || []).forEach(d=>{
      const sel = document.createElement('select');
      sel.id = d.id;
      sel.setAttribute('aria-label', d.label || d.id);
      if(d.label) sel.title = d.label;
      (d.options || []).forEach(o=>{
        const op = document.createElement('option');
        op.value = String(o.value); op.textContent = o.label;
        if(String(o.value) === String(d.default)) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', ()=>{ if(onChange) onChange(d.id, get(d.id)); });
      if(mount) mount.appendChild(sel);
      els[d.id] = { el: sel, number: !!d.number };
    });
    function get(id){
      const e = els[id];
      if(!e) return undefined;
      return e.number ? (Number(e.el.value) || 0) : e.el.value;
    }
    return { get, el(id){ return els[id] && els[id].el; } };
  }

  return { room, settings, relay: RELAY };
})();
