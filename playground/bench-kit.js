/* ================= Bench kit — what every question game needs =================
   The middle tier. `hub-kit.js` is what the *games* share; this is what the
   **question bench** shares — the playground pages where a dynamic is tried out
   before anything reaches a lesson.

   It exists because the same code was written twice within two days: `openRoom`
   was nearly byte-for-byte identical in connections.html and the prompt lab, and
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

  /* ---------- a team's colour ----------
     Delegated to `hub-buzzer.js` rather than held here, because the projector and
     the handset both load that file and a team's colour has to be the same fact in
     both places. Guarded: every bench page must stay playable with no phone layer
     at all, and a missing colour is not a reason for a board to fail. */
  const teamColour = i => (window.HubBuzzer && HubBuzzer.teamColour)
                          ? HubBuzzer.teamColour(i) : '#00A0DF';

  /* ---------- teams ----------
     Who is playing, whose turn it is, and what they have scored. Every question
     game on the bench needs exactly this and Connections had written all of it;
     the second game asking for the same thing is what moved it here.

     The turn is *this* module's, but what a turn change means is not — so `onTurn`
     fires and the page decides (Connections re-asks the phones, because its vote
     belongs to the team on turn). `onChange` fires when the roster itself moves,
     which is when the relay needs the new names.

       const teams = BenchKit.teams({ mount:$('teams'), onTurn(){…}, onChange(){…} });
       teams.list()      [{name, score}]
       teams.active()    index, or -1 when the page has said nobody is on turn
       teams.setActive(i)
       teams.score(i, n) add n to team i and repaint
       teams.pass()      hand the turn to the next team
       teams.sizes(host) phones per team, from the room's roster
       teams.reset()     zero the scores, keep the names  */
  function teams(opts){
    const o = opts || {};
    const mount = o.mount;
    const max = o.max || 6;
    let list = (o.names || ['Team 1','Team 2']).map(n => ({ name:n, score:0 }));
    let active = 0;
    /* A page with no turn — a race, where every team plays at once — says so by
       setting -1 rather than by the bar guessing from some other state. */
    let turnShown = true;

    function render(){
      if(!mount) return;
      mount.innerHTML = '';
      list.forEach((t, i)=>{
        const b = document.createElement('button');
        b.className = 'team-chip' + (turnShown && i === active ? ' active' : '');
        b.dataset.team = String(i);
        b.style.borderColor = teamColour(i);
        b.innerHTML = '<span class="tname"></span><span class="score"></span>';
        b.querySelector('.tname').textContent = t.name;
        b.querySelector('.score').textContent = t.score;
        b.title = 'Click: their turn · double-click: rename';
        b.addEventListener('click', ()=> setActive(i));
        b.addEventListener('dblclick', ()=>{
          const n = prompt('Team name', t.name);
          if(n && n.trim()){ t.name = n.trim(); render(); fire('change'); }
        });
        mount.appendChild(b);
      });
      if(list.length < max){
        const add = document.createElement('button');
        add.id = 'add-team'; add.textContent = '+ Team';
        add.addEventListener('click', ()=>{
          list.push({ name:'Team ' + (list.length + 1), score:0 });
          render(); fire('change');
        });
        mount.appendChild(add);
      }
    }
    function fire(what){
      if(what === 'turn' && o.onTurn) o.onTurn(active);
      if(what === 'change' && o.onChange) o.onChange(list.slice());
    }
    function setActive(i){ active = i; render(); fire('turn'); }

    render();
    return {
      list: ()=> list,
      names: ()=> list.map(t=>t.name),
      active: ()=> (turnShown ? active : -1),
      at: i => list[i],
      nameAt: i => (list[i] ? list[i].name : 'Team ' + (Number(i) + 1)),
      colour: teamColour,
      setActive,
      /* The turn moves on, and it is the module's business how — a page should not
         have to know that six teams wrap round to zero. */
      pass(){ setActive((active + 1) % list.length); },
      showTurn(on){ turnShown = !!on; render(); },
      score(i, n){ if(list[i]) list[i].score += n; render(); },
      reset(){ list.forEach(t=> t.score = 0); render(); },
      /* How many phones each team has, from the room's roster. Returns a count per
         team index, so a page can turn it into whatever it needs — Connections
         turns it into a per-player share of a four-word answer. */
      sizes(host){
        const n = list.map(()=> 0);
        (host ? host.players() : []).forEach(p=>{
          const t = Math.max(0, Number(p.team) || 0);
          if(n[t] != null) n[t]++;
        });
        return n;
      },
      render
    };
  }

  /* ---------- the board's clock ----------
     The teacher's copy of the countdown the handsets are running. The phones count
     their own down from a duration sent with the arm, so this never agrees a time
     with anybody — it is the same number started at the same moment.

     What expiry *means* is the page's business, not this module's, so it calls
     back rather than deciding: Connections closes the vote and leaves the board to
     the teacher, because nothing on this bench is ever decided automatically. */
  function clock(opts){
    const o = opts || {};
    const el = o.mount;
    let timer = null;
    function stop(){
      if(timer){ clearInterval(timer); timer = null; }
      if(el){ el.textContent = ''; el.classList.remove('urgent'); }
    }
    function start(secs){
      stop();
      if(!secs || !el) return;
      let left = secs;
      const paint = ()=>{
        el.textContent = left + 's';
        el.classList.toggle('urgent', left <= 10);
      };
      paint();
      timer = setInterval(()=>{
        left--;
        if(left <= 0){
          clearInterval(timer); timer = null;
          el.textContent = 'time';
          if(o.onEnd) o.onEnd();
          return;
        }
        paint();
      }, 1000);
    }
    return { start, stop, running(){ return !!timer; } };
  }

  /* ---------- the mistake budget ----------
     Dots that go out. Both games so far run one; a page that does not want a
     budget simply never builds one. */
  function mistakes(opts){
    const o = opts || {};
    const mount = o.mount;
    const max = o.max || 4;
    let spent = 0;
    function render(){
      if(!mount) return;
      mount.innerHTML = '';
      for(let i = 0; i < max; i++){
        const s = document.createElement('span');
        s.className = 'dot' + (i < spent ? ' spent' : '');
        mount.appendChild(s);
      }
    }
    render();
    return {
      spend(){ spent++; render(); return spent >= max; },   // true = that was the last one
      reset(){ spent = 0; render(); },
      left(){ return Math.max(0, max - spent); },
      out(){ return spent >= max; },
      render
    };
  }

  /* ---------- turns, or a race ----------
     Two games declared this identically before a third wanted it, which is the
     signal to move it. The *setting* is shared; what a mode means to a board never
     will be, so each page still writes its own `applyMode` — this only supplies
     the declaration and the question "are we racing".

       settings = BenchKit.settings(mount, [BenchKit.modeSetting(), …], onChange)
       BenchKit.racing(settings)      // true when the picker says race

     `labels` lets a game name its own modes without redeclaring the control:
     Connections races over a set, the thermometer over a ladder. */
  function modeSetting(labels){
    const l = labels || {};
    return { id:'play-mode', label:'How the teams play', default:'turns', options:[
      { value:'turns', label: l.turns || 'Turns — one team at a time' },
      { value:'race',  label: l.race  || 'Race — both teams at once' } ] };
  }
  function racing(settings){ return !!settings && settings.get('play-mode') === 'race'; }

  /* ---------- judging what a student typed ----------
     Delegates to the hub's `Kit.answer.judge`, which returns 'right' | 'close' |
     'wrong' with a tolerance that scales with the word — one wrong letter in
     `jury` is a different kind of error from one in `incarceration`. Kept behind a
     guard because a bench page must stay playable with no hub kit loaded at all,
     and there the honest fallback is an exact match rather than a crash. */
  function judge(typed, expected){
    /* `window.HubKit`, not `Kit` — the hub aliases it to `Kit` inside its own
       closure, and reaching for that name out here found nothing, fell silently
       through to the exact match below, and downgraded every near miss to a flat
       "wrong". A guard that hides a wiring mistake is worse than none, so the
       fallback now says so. */
    const K = window.HubKit;
    if(K && K.answer && K.answer.judge) return K.answer.judge(typed, expected);
    const norm = v => String(v == null ? '' : v).trim().toLowerCase();
    return norm(typed) && norm(typed) === norm(expected) ? 'right' : 'wrong';
  }
  /* Whether the real judge is available. A page that cares about the difference
     between "close" and "wrong" can say so rather than quietly losing a verdict. */
  judge.full = () => !!(window.HubKit && HubKit.answer && HubKit.answer.judge);

  /* ---------- letting an answer settle before judging it ----------
     A race has no teacher click, so the board judges a team's answer by itself —
     and an answer arriving from several phones arrives *in pieces*. Four picks
     landing one at a time would otherwise be judged three times on the way up, and
     the wrong verdicts are the ones the room would see first.

     So `poke()` on every reply, and `run` fires once the stream goes quiet.
     `fresh(team, key)` is the other half — without it a team sitting on a wrong
     answer is re-judged on every stray reply and the board shouts at them again
     for a mistake they already made. `reset()` when the board itself changes,
     because then every answer is worth trying again.

     Two callers with genuinely different candidates: Connections settles on a
     *set* of four, the thermometer on a team's *leading word*. That is what makes
     this a shared shape rather than one game's helper. */
  function settle(ms, run){
    let timer = null;
    let tried = {};
    return {
      poke(){
        if(timer) clearTimeout(timer);
        timer = setTimeout(()=>{ timer = null; run(); }, ms || 700);
      },
      // true the first time this team offers this answer, and remembers it
      fresh(team, key){
        const seen = tried[team] || (tried[team] = []);
        if(seen.indexOf(key) !== -1) return false;
        seen.push(key);
        return true;
      },
      reset(){ tried = {}; },
      stop(){ if(timer){ clearTimeout(timer); timer = null; } }
    };
  }

  /* ---------- who is winning a vote ----------
     The top `n` options by count, highest first, ignoring anything with no votes.
     Connections wants four (a group), the thermometer wants one (a slot). */
  function leading(votes, n){
    return Object.entries(votes || {})
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, n || 1))
      .map(([w]) => w);
  }

  return { room, settings, teams, clock, mistakes, leading, settle,
           modeSetting, racing, judge, teamColour, relay: RELAY };
})();
