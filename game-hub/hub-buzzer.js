/* ================= Buzzer client =================
   Shared by the teacher's hub (as host) and the students' join page (as player).
   Talks to tools/buzzer-relay.js: an EventSource downstream, fetch POST upstream.

     const host = HubBuzzer.host({ relay:'', code:'12345' });
     host.on('buzz', b => …);      // {id, name, team, at}
     host.arm('the sentence');     // let them buzz
     host.reset();                 // clear the lock, nobody armed

   The relay defaults to the page's own origin, which is what you get when the
   relay is serving the site. Point `relay` at a hosted URL to use one instead.

   Nothing here throws if the relay is missing — the hub has to keep working with
   no buzzers at all, so a failed connection is just a 'status' event. */
window.HubBuzzer = (function(){
  'use strict';

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
    return src;
  }

  function host(opts){
    const relay = opts.relay || '';
    const code  = String(opts.code || '');
    const ev    = emitter();
    const src   = stream(relay, { room:code, role:'host' }, ev);
    let players = [];

    ['ready','join','leave','buzz'].forEach(name=>{
      src.addEventListener(name, e=>{
        let d = {}; try{ d = JSON.parse(e.data); }catch(_){}
        if(d.players) players = d.players;
        if(name==='ready') ev.emit('ready', d);
        else if(name==='buzz') ev.emit('buzz', d);
        else ev.emit('players', players);
      });
    });

    return {
      code, on: ev.on,
      players: ()=>players.slice(),
      arm:      prompt => post(relay, { room:code, type:'arm', prompt }),
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

    ['joined','armed','disarmed','locked','reset','teams'].forEach(name=>{
      src.addEventListener(name, e=>{
        let d = {}; try{ d = JSON.parse(e.data); }catch(_){}
        ev.emit(name, d);
      });
    });

    return {
      id, code, on: ev.on,
      buzz:  ()=> post(relay, { room:code, type:'buzz', id }),
      close: ()=>{ try{ src.close(); }catch(e){} }
    };
  }

  function newCode(relay){
    return fetch(base(relay) + '/buzzer/newcode').then(r=>r.json()).then(d=>d.code)
      .catch(()=>null);
  }

  return { host, player, newCode };
})();
