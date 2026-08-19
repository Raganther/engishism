/* ================= Buzzer client =================
   Shared by the teacher's hub (as host) and the students' join page (as player).
   Talks to tools/buzzer-relay.js: an EventSource downstream, fetch POST upstream.

     const host = HubBuzzer.host({ relay:'', code:'12345' });
     host.on('buzz', b => …);      // {id, name, team, at, value?}
     host.arm('the sentence');     // let them buzz
     host.reset();                 // clear the lock, nobody armed

   The relay defaults to the page's own origin, which is what you get when the
   relay is serving the site. Point `relay` at a hosted URL to use one instead.

   Nothing here throws if the relay is missing — the hub has to keep working with
   no buzzers at all, so a failed connection is just a 'status' event. */
window.HubBuzzer = (function(){
  'use strict';

  /* ---------- the team palette ----------
     A team's colour has to be the same fact on the projector and in the hand: a
     student holding an orange handset is on the orange team, and the dots beside
     their team's words on the board are orange. It lives here because this is the
     one file the board and the handset both load, so the two ends agree by
     construction rather than by two lists being kept in step — and it costs the
     relay nothing, which is right, since a colour is presentation and the relay
     deliberately learns as little as it can.

     Indexed by team number, which both ends already have. Chosen to stay apart
     under projector wash and the commonest colour blindness: blue, orange, green,
     violet, yellow, pink — never red-against-green as the first pair. */
  const TEAM_COLOURS = ['#00A0DF','#E8743B','#7BC043','#A162E8','#E8C547','#E85A8A'];
  function teamColour(i){
    const n = (Number(i) >= 0 ? Number(i) : 0) | 0;
    if(n < TEAM_COLOURS.length) return TEAM_COLOURS[n];
    /* Past the brand palette, which only a room of individuals reaches — teams never
       run to seven. Cycling the six repeated a colour every seventh player; instead
       spread the extra hues by the golden angle, so no two players share a colour at
       any class size. Teams (0–5) are untouched. */
    const hue = Math.round(((n - TEAM_COLOURS.length) * 137.508 + 165) % 360);
    return 'hsl(' + hue + ', 60%, 60%)';
  }

  /* ---------- how many words go on a line ----------
     The same argument as the palette, one row over. A shuffled sentence broken
     six-and-three on the projector and five-and-four in the hand is one question
     wearing two shapes, and a student looking up from their phone has to find
     their place again before they can do anything with what they saw. So where
     the line breaks is **one fact**, and it lives in the one file the board and
     the handset both load — rather than each end wrapping to its own width,
     which is what made them differ in the first place, a clue card being 636px
     wide and a handset 390.

     **Four to a line at most, and never an orphan.** The rows are taken first
     and the words spread evenly across them, so nine words are 3·3·3 and not
     4·4·1. A single box on a line of its own reads as a mistake and is exactly
     where a thumb aims first — a lesson the anagram row has already paid for.

     It costs the relay nothing, which is right: how a word is *drawn* is
     presentation, and the relay deliberately learns as little as it can. */
  const WORD_MAX = 4;
  function wordCols(n){
    const count = Math.max(1, Math.floor(Number(n) || 1));
    const rows  = Math.ceil(count / WORD_MAX);
    return Math.ceil(count / rows);
  }

  function emitter(){
    const map = Object.create(null);
    return {
      on(ev, fn){ (map[ev] = map[ev] || []).push(fn); return this; },
      emit(ev, data){ (map[ev]||[]).forEach(fn=>{ try{ fn(data); }catch(e){ console.error(e); } }); }
    };
  }

  function base(relay){
    const r = (relay || '').replace(/\/+$/,'');
    return r;   // '' means same origin
  }

  function post(relay, msg){
    return fetch(base(relay) + '/buzzer/send', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(msg)
    }).then(r=>r.json()).catch(()=>({ error:'unreachable' }));
  }

  function stream(relay, params, ev){
    const qs  = new URLSearchParams(params).toString();
    const url = base(relay) + '/buzzer/stream?' + qs;
    /* EventSource only retries *network* failures. An HTTP error — the relay up
       but the room not there — is final: the source goes CLOSED and never tries
       again. That is exactly what a relay restart produces (rooms live in its
       memory, and the deployed one restarts on every push): the phones and the
       host race to reconnect, the host's first success recreates the room, and
       every phone that got there first was answered 404 and died — still saying
       "reconnecting…", which was a lie. So a CLOSED source is reopened here,
       backed off, invisibly to the caller: the relay re-sends the full joined
       state on every connection, so coming back through a fresh EventSource is
       the same as coming back through the browser's own retry. */
    let src, closed = false, opened = false, wait = 1000;
    const handlers = [];       // re-attached to every reopened source
    function connect(){
      src = new EventSource(url);
      src.onopen  = ()=>{ opened = true; wait = 1000; ev.emit('status', { state:'connected' }); };
      src.onerror = ()=>{
        ev.emit('status', { state: opened ? 'reconnecting' : 'unreachable' });
        if(src.readyState === 2 && !closed){      // CLOSED: the browser has given up
          setTimeout(()=>{ if(!closed) connect(); }, wait);
          wait = Math.min(15000, wait * 2);
        }
      };
      /* Another tab or device took this room over. Retrying would take it back and
         start a fight neither can win — each reconnection re-asks the phones, so the
         whole room's buzzers flicker. Close for good and say so. */
      src.addEventListener('replaced', ()=>{
        closed = true;
        try{ src.close(); }catch(e){}
        ev.emit('status', { state:'replaced' });
      });
      /* Kicked is final for the same reason: the stream retries everything else,
         and a kicked phone that quietly reconnected would undo the teacher's one
         tool against a phantom. The page hears the event itself and decides what
         to show. */
      src.addEventListener('kicked', ()=>{
        closed = true;
        try{ src.close(); }catch(e){}
      });
      handlers.forEach(h => src.addEventListener(h[0], h[1]));
    }
    connect();
    return {
      addEventListener(name, fn){ handlers.push([name, fn]); src.addEventListener(name, fn); },
      close(){ closed = true; try{ src.close(); }catch(e){} }
    };
  }

  function host(opts){
    const relay = opts.relay || '';
    const code  = String(opts.code || '');
    const ev    = emitter();
    const src   = stream(relay, { room:code, role:'host' }, ev);
    let players = [];

    ['ready','join','leave','buzz','response'].forEach(name=>{
      src.addEventListener(name, e=>{
        let d = {}; try{ d = JSON.parse(e.data); }catch(_){}
        if(d.players) players = d.players;
        if(name==='ready') ev.emit('ready', d);
        else if(name==='buzz') ev.emit('buzz', d);
        else if(name==='response') ev.emit('response', d);
        else {
          /* **A student arriving is a different fact from the roster changing**, and
             this used to flatten the two into one `players` event — so the *only*
             moment a handset's team is unambiguously the student's own choice was
             thrown away, and anything downstream had to re-derive it from a roster
             the host itself also writes to. Carried through when the relay names who
             joined; the seat path re-emits `join` with the roster alone, and has no
             `id`, which is exactly the difference worth keeping. */
          if(name === 'join' && d && d.id) ev.emit('join', d);
          ev.emit('players', players);
        }
      });
    });

    return {
      code, on: ev.on,
      players: ()=>players.slice(),
      /* Per-player state, which is new: everything else here is per-question and
         forgotten. The host deals the cards and judges the taps; the relay only
         stores and carries them, so it still never learns an answer. */
      deal: cards => post(relay, { room:code, type:'deal', cards }),
      mark: (id, word) => post(relay, { room:code, type:'mark', id, word }),
      nope: (id, word) => post(relay, { room:code, type:'nope', id, word }),
      /* `arm(text)` still races for the floor. `arm(text, {mode:'vote', options})`
         or `{mode:'answer'}` asks the whole class instead, and the answers arrive
         on the 'response' event rather than 'buzz'. */
      arm:      (prompt, opts) => post(relay, Object.assign(
                  { room:code, type:'arm', prompt }, opts || {})),
      /* Tell one phone what its typed answer was worth. Only the host can do this:
         the relay never learns the answer, so it cannot be asked for it. */
      judge:    (id, verdict, opts) => post(relay, Object.assign(
                  { room:code, type:'judge', id, verdict }, opts || {})),
      /* Remove one phone from the room — the teacher's way out of a phantom. The
         relay tells the phone first, so a live handset kicked by mistake knows. */
      kick:     id => post(relay, { room:code, type:'kick', id }),
      /* A team was removed on the host: shift every joined phone's team index to
         match, because an index is a team's identity on both ends and the first
         live class paid a win to a team that no longer existed. */
      remap:    removed => post(relay, { room:code, type:'remap', removed }),
      /* One phone's competitor, named by the host. `remap` renumbers everybody after
         a removal; this seats one person, which is what individual play is made of.

         **The local record is updated here, and that line is the whole fix for a bug
         class that recurred four times.** `seat` is one-way: the relay sets its own
         copy and tells the phone, but pushes no roster back to the host — so
         `players()` goes on reporting the team each handset arrived with. In a room
         of individuals every phone joins as team 0 and is then seated onto its own
         competitor, so without this the host believes several people share one
         competitor. That is not cosmetic: `sizes` is counted from it, a share is
         `ceil(need/size)`, and a student told their share of a four-word answer is
         two **cannot finish the question**. Reported from the room bench, and it
         would have happened in class.

         Correct rather than a patch, because the relay's record *is* right: the next
         genuine roster event overwrites this with the same value. What the local
         write buys is the gap between the seat and that push. */
      seat:     (id, team) => {
        const p = players.find(x => x && x.id === id);
        if(p) p.team = team;
        return post(relay, { room:code, type:'seat', id, team });
      },
      /* How many options one phone may hold, per team. Separate from `arm` on
         purpose: a team's share changes when somebody joins or drops, and a fresh
         arm would clear every handset's picks — throwing away a negotiation in
         progress because a latecomer walked in. This changes the cap and leaves
         what they are holding alone. */
      shares:   per    => post(relay, { room:code, type:'shares', multiByTeam:per }),
      /* The deal of per-player views moved under a live round — same shape as
         `shares`: pushed, never re-armed, so nobody's half-typed word is wiped. */
      prompts:  per    => post(relay, { room:code, type:'prompts', promptByPlayer:per }),
      /* Which of a phone's options are finished with — the same shape again, and
         for the same reason. It is also what a reconnecting phone is handed back,
         so a player's record of their own ladder survives a reload. */
      done:     per    => post(relay, { room:code, type:'done', doneByTeam:per }),
      /* One pulse on every handset: the board has revealed something, look up.
         Same shape as `shares` and `prompts` — pushed, never re-armed, so nothing
         anybody is holding is touched. It carries that it happened and never what
         was revealed; the thing itself exists only on the wall, which is the whole
         point of sending this at all. */
      nudge:    kind   => post(relay, { room:code, type:'nudge', kind }),
      disarm:   ()     => post(relay, { room:code, type:'disarm' }),
      reset:    ()     => post(relay, { room:code, type:'reset' }),
      setTeams: (names, solo) => post(relay, { room:code, type:'teams', teams:names,
                                              solo: solo === undefined ? undefined : !!solo }),
      close:    ()     => { try{ src.close(); }catch(e){} }
    };
  }

  /* **"This is only what I am looking at."** A reply carrying this prefix is a
     *preview* — the word a player currently has selected, sent before they commit —
     and it exists so the projector's reveal bar can follow the room's thinking
     rather than only its finished answers. The relay never learns any of it: it
     stores one value per player and what that value *means* has always been the
     host's business, which is exactly why this needed no wire change. It lives here
     because it is the one file the board and the handset both load, the same reason
     the team palette and `wordCols` do. Read lazily everywhere, so load order
     cannot matter. */
  const PREVIEW = '\u0001';

  function player(opts){
    const relay = opts.relay || '';
    const code  = String(opts.code || '');
    const id    = opts.id || (String(Date.now()) + String(Math.random()).slice(2,6));
    const ev    = emitter();
    const src   = stream(relay, { room:code, role:'player', id, name:opts.name||'Player', team:opts.team||0 }, ev);

    ['joined','armed','disarmed','locked','reset','teams','judged','card','marked','nope',
     'shares','kicked','team','prompt','nudge','done'].forEach(name=>{
      src.addEventListener(name, e=>{
        let d = {}; try{ d = JSON.parse(e.data); }catch(_){}
        ev.emit(name, d);
      });
    });

    return {
      id, code, on: ev.on,
      // in 'type' rounds the buzz carries what they wrote — the race is to produce
      // the word, so pressing the button without it would be the old reflex game
      buzz:    v => post(relay, { room:code, type:'buzz', id,
                                  value: v == null ? undefined : String(v) }),
      respond: v => post(relay, { room:code, type:'respond', id, value:v }),
      close: ()=>{ try{ src.close(); }catch(e){} }
    };
  }

  // resolves {code, lan} — lan is the address a phone can reach, which is not
  // localhost even when that is what the teacher's browser is showing
  function newCode(relay){
    return fetch(base(relay) + '/buzzer/newcode').then(r=>r.json())
      .then(d=> d && d.code ? d : null)
      .catch(()=>null);
  }

  return { host, player, newCode, teamColour, TEAM_COLOURS, wordCols, PREVIEW };
})();

/* ---------- is this page the build the server has? ----------
   A browser can hold a stale shell in memory across deploys: it asks for the old
   `?v=`, gets its own cached assets, and shows the previous build with no error
   anywhere — `HUB_BUILD` reports the stamp the shell *asked for*, so even the ⚙
   footer agrees with the lie. That has cost real debugging rounds, because a
   stale page and a broken fix look identical from the outside.

   So the page checks for itself: its own stamp (read off its script/link tags,
   the same derivation HUB_BUILD makes) against the stamp in a freshly fetched
   copy of its own HTML — nothing new to keep in step, both sides are derived.
   When they differ, a small fixed pill offers a reload; it never forces one,
   because the teacher decides. It lives here because this is the one file
   nearly every stamped page loads, board and handset alike.

   Tapping navigates to the same URL with a changed `fresh=` param — a different
   URL is what actually defeats an in-app browser's cache, where a plain reload
   hands back the same stale copy. The room memory is localStorage, so the class
   stays joined across it. */
(function buildWatch(){
  if (location.protocol === 'file:') return;   // no server to be newer, and fetch is blocked
  // the suite serves exactly what it serves; window.HUB_BUILDWATCH_ANYWAY opts a
  // check back in, the same shape as ?rack=auto and HUB_SHUFFLE_ANYWAY
  if (navigator.webdriver && !window.HUB_BUILDWATCH_ANYWAY) return;
  // the date shape is load-bearing: classic.html carries ?v=picture / ?v=unit1,
  // which are content selectors, not build stamps
  const STAMP = /[?&]v=(20[0-9]{6}[a-z]*)/;
  function stampIn(text){ const m = STAMP.exec(text || ''); return m ? m[1] : ''; }
  let mine = '';
  document.querySelectorAll('script[src],link[href]').forEach(el => {
    if (!mine) mine = stampIn(el.getAttribute('src') || el.getAttribute('href'));
  });
  if (!mine) return;                           // an unstamped page has no build to be stale against

  let chip = null, lastLook = 0;
  function show(server){
    if (!chip){
      chip = document.createElement('div');
      chip.id = 'build-chip';
      // fixed in a corner on purpose: anything that occupies layout space above a
      // board owes it a re-fit, and a chip that can appear mid-lesson must not.
      // Styled inline because the playground pages load none of the hub's CSS.
      chip.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:300;' +
        'font-family:ui-monospace,monospace;font-size:0.78rem;letter-spacing:0.04em;' +
        'text-transform:uppercase;padding:8px 14px;border-radius:999px;cursor:pointer;' +
        'background:#12263F;color:#fff;border:1px solid rgba(255,255,255,0.35);' +
        'box-shadow:0 4px 14px rgba(0,0,0,0.25);';
      chip.addEventListener('click', () => {
        const u = new URL(location.href);
        u.searchParams.set('fresh', chip.dataset.server || 'now');
        location.href = u.href;
      });
      document.body.appendChild(chip);
    }
    chip.dataset.server = server;
    chip.textContent = 'new version · tap to reload';
    chip.title = 'This page is running build ' + mine + '; the site is on ' + server +
                 '. Tapping loads the new one — the room code is kept.';
  }
  function look(){
    lastLook = Date.now();
    fetch(location.pathname, { cache:'no-store' })
      .then(r => r.ok ? r.text() : '')
      .catch(() => '')
      .then(html => {
        const server = stampIn(html);
        if (!server) return;                   // unknown is not stale
        if (server !== mine) show(server);
        else if (chip){ chip.remove(); chip = null; }
      });
  }
  setTimeout(look, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastLook > 5 * 60 * 1000) look();
  });
})();
