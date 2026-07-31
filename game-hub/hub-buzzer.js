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
    const n = Number(i);
    return TEAM_COLOURS[((n >= 0 ? n : 0) | 0) % TEAM_COLOURS.length];
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
    const src = new EventSource(base(relay) + '/buzzer/stream?' + qs);
    let opened = false;
    src.onopen  = ()=>{ opened = true; ev.emit('status', { state:'connected' }); };
    src.onerror = ()=>{
      // EventSource retries on its own; report the state and let the UI decide
      ev.emit('status', { state: opened ? 'reconnecting' : 'unreachable' });
    };
    /* Another tab or device took this room over. Retrying would take it back and
       start a fight neither can win — each reconnection re-asks the phones, so the
       whole room's buzzers flicker. Close for good and say so. */
    src.addEventListener('replaced', ()=>{
      try{ src.close(); }catch(e){}
      ev.emit('status', { state:'replaced' });
    });
    return src;
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
        else ev.emit('players', players);
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
      /* How many options one phone may hold, per team. Separate from `arm` on
         purpose: a team's share changes when somebody joins or drops, and a fresh
         arm would clear every handset's picks — throwing away a negotiation in
         progress because a latecomer walked in. This changes the cap and leaves
         what they are holding alone. */
      shares:   per    => post(relay, { room:code, type:'shares', multiByTeam:per }),
      disarm:   ()     => post(relay, { room:code, type:'disarm' }),
      reset:    ()     => post(relay, { room:code, type:'reset' }),
      setTeams: names  => post(relay, { room:code, type:'teams', teams:names }),
      close:    ()     => { try{ src.close(); }catch(e){} }
    };
  }

  function player(opts){
    const relay = opts.relay || '';
    const code  = String(opts.code || '');
    const id    = opts.id || (String(Date.now()) + String(Math.random()).slice(2,6));
    const ev    = emitter();
    const src   = stream(relay, { room:code, role:'player', id, name:opts.name||'Player', team:opts.team||0 }, ev);

    ['joined','armed','disarmed','locked','reset','teams','judged','card','marked','nope',
     'shares'].forEach(name=>{
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

  return { host, player, newCode, teamColour, TEAM_COLOURS };
})();
