#!/usr/bin/env node
/* ================= Buzzer relay =================
   Phones and the teacher's laptop never talk to each other directly — they both
   connect to this, exactly like Kahoot. That matters because school WiFi usually
   blocks device-to-device traffic, and a relay sidesteps it.

   Zero dependencies: SSE downstream, POST upstream, plain node http. Run it with
   nothing but Node installed:

       node tools/buzzer-relay.js

   It also serves the site itself, so the hub and the join page come from the same
   origin as the relay. That is deliberate: a page served over https from GitHub
   Pages is not allowed to talk to a plain-http relay on the local network, so on
   the LAN everything has to come from here.

   Endpoints:
     GET  /buzzer/stream?room=CODE&role=host
     GET  /buzzer/stream?room=CODE&role=player&id=..&name=..&team=..
     POST /buzzer/send      {room, id, type, ...}
     GET  /buzzer/health
================================================================================ */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const ROOM_GRACE_MS = 5 * 60 * 1000;   // a host refresh shouldn't destroy the room

/** rooms: code -> { host, players:Map<id,{id,name,team,res}>, teams:[], armed, locked, emptiedAt } */
const rooms = new Map();

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2', '.md':'text/markdown; charset=utf-8'
};

function send(res, code, body, headers){
  res.writeHead(code, Object.assign({ 'Cache-Control':'no-store' }, headers||{}));
  res.end(body);
}
function sendJSON(res, code, obj){
  send(res, code, JSON.stringify(obj), { 'Content-Type':'application/json; charset=utf-8' });
}

/* ---------- rooms ---------- */
function makeCode(){
  let code;
  do { code = String(Math.floor(10000 + Math.random()*90000)); } while(rooms.has(code));
  return code;
}
function getRoom(code, create){
  let r = rooms.get(code);
  if(!r && create){
    /* `mode` is what the phones are being asked for this round: 'buzz' races for
       the floor, 'vote' collects one choice each, 'answer' collects typed text,
       'type' races for the floor *carrying* a typed answer. `responses` holds one
       entry per player for the collecting modes — the racing modes keep using
       `locked`, which is a different thing: first past the post rather than
       everybody's answer.

       `cooling` is what makes a wrong typed answer cost something without costing
       points: that player alone is out until their timestamp passes, while the
       room stays open for everyone else.

       `team` is set when a round belongs to one team rather than the room —
       Blockbusters asks the team on turn which hexagon to attack, and the other
       side of the room is watching, not choosing. Null means everybody. */
    /* `cards` is the first thing the relay holds that outlives a question. A buzz,
       an answer and a vote are all per-question and forgotten; a bingo card has to
       survive the next call *and* the phone dropping off the wifi and coming back,
       which is the whole reason it lives here rather than only on the host. The
       host still deals them and still judges the taps — the relay never learns
       which word is the right one, exactly as it never learns a typed answer. */
    r = { host:null, players:new Map(), teams:[], armed:false, locked:null,
          mode:'buzz', prompt:'', options:[], team:null, responses:new Map(),
          spent:new Set(), cooling:new Map(), cards:new Map(), emptiedAt:0,
          answerSecs:0, rethink:false, secs:0, armedAt:0, multi:1 };
    rooms.set(code, r);
  }
  return r;
}
function pushEvent(res, event, data){
  try{ res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }catch(e){}
}
function toHost(room, event, data){ if(room.host) pushEvent(room.host, event, data); }
function toPlayers(room, event, data){ room.players.forEach(p=>pushEvent(p.res, event, data)); }
function roster(room){
  return [...room.players.values()].map(p=>({ id:p.id, name:p.name, team:p.team }));
}

// drop rooms that have been empty a while, so a long-running relay doesn't leak
setInterval(()=>{
  const now = Date.now();
  rooms.forEach((r, code)=>{
    const empty = !r.host && r.players.size===0;
    if(empty && !r.emptiedAt) r.emptiedAt = now;
    if(!empty) r.emptiedAt = 0;
    if(r.emptiedAt && now - r.emptiedAt > ROOM_GRACE_MS) rooms.delete(code);
  });
}, 30000).unref();

/* ---------- SSE ---------- */
function openStream(req, res, q){
  const code = (q.get('room')||'').trim();
  const role = q.get('role')==='host' ? 'host' : 'player';
  if(!/^\d{4,6}$/.test(code)) return sendJSON(res, 400, { error:'bad room code' });

  const room = getRoom(code, role==='host');
  if(!room) return sendJSON(res, 404, { error:'no such room' });

  res.writeHead(200, {
    'Content-Type':'text/event-stream; charset=utf-8',
    'Cache-Control':'no-cache, no-transform',
    'Connection':'keep-alive',
    'X-Accel-Buffering':'no'
  });
  res.write(': open\n\n');
  const beat = setInterval(()=>{ try{ res.write(': ping\n\n'); }catch(e){} }, 20000);
  beat.unref();

  if(role==='host'){
    /* One host stream per room, and the one that arrives last wins. But simply
       ending the other leaves it looking like a network drop, so its EventSource
       reconnects — which ends *this* one, which reconnects, forever. Two hub tabs
       on the same room therefore ping-ponged, and every reconnect fires `ready`,
       which re-asks the phones: the buzzer flickering on and off on every handset
       in the room while the connection itself was fine. Say it was replaced, so the
       loser knows to stay down. */
    if(room.host && room.host !== res){
      try{ pushEvent(room.host, 'replaced', { room:code }); room.host.end(); }catch(e){}
    }
    room.host = res;
    room.emptiedAt = 0;
    pushEvent(res, 'ready', { room:code, players:roster(room) });
    req.on('close', ()=>{ clearInterval(beat); if(room.host===res) room.host=null; });
    return;
  }

  const id   = (q.get('id')||'').slice(0,40) || String(Math.random()).slice(2,10);
  const name = ((q.get('name')||'').trim() || 'Player').slice(0,24);
  const team = Math.max(0, Math.min(7, parseInt(q.get('team'),10) || 0));
  /* A phone that reconnects arrives with the same id, so this replaces its entry.
     End the stream it is replacing rather than leaving it open — the host does the
     same with its own stream, and without it a flapping connection leaks one
     response object per reconnect. */
  const prev = room.players.get(id);
  if(prev && prev.res && prev.res !== res){ try{ prev.res.end(); }catch(e){} }
  room.players.set(id, { id, name, team, res });
  room.emptiedAt = 0;

  /* A student joining mid-question has to arrive into that question, not into a
     blank screen until the next one. Students trickle in — somebody's phone is
     always locked, or on the wrong WiFi, or joining thirty seconds late — so the
     room's current state travels with the join. */
  pushEvent(res, 'joined', {
    id, name, team, teams:room.teams, armed:room.armed, locked:lockedNow(room),
    mode:room.mode, prompt:room.prompt, options:room.options, turnTeam:room.team,
    spent:[...room.spent],
    rethink: room.rethink, secs: secsLeft(room), multi: room.multi,
    /* what this phone already chose, so a reload comes back with its own vote
       showing rather than looking like it never answered */
    yours: (room.responses.get(id) || {}).value || null,
    cooling:[...room.cooling].map(([pid,until])=>({ id:pid, until })),
    card: room.cards.get(id) || null
  });
  toHost(room, 'join', { id, name, team, players:roster(room) });

  req.on('close', ()=>{
    clearInterval(beat);
    /* Only if this is still *this* stream. A reconnecting phone re-registers under
       the same id, and the old stream's close arrives *after* the new one has been
       stored — so an unguarded delete removed the connection that had just come
       back. The phone then found itself out of the room, reconnected, and was
       removed again: the buzzer flickering on and off on a handset with nothing
       wrong with it. The host stream has always had this guard; the player path
       was missing it. */
    const cur = room.players.get(id);
    if(!cur || cur.res !== res) return;
    room.players.delete(id);
    toHost(room, 'leave', { id, name, players:roster(room) });
  });
}

/* ---------- upstream ---------- */
function handleSend(req, res){
  let body='';
  req.on('data', c=>{ body += c; if(body.length > 4096) req.destroy(); });
  req.on('end', ()=>{
    let msg; try{ msg = JSON.parse(body||'{}'); }catch(e){ return sendJSON(res,400,{error:'bad json'}); }
    const room = rooms.get(String(msg.room||''));
    if(!room) return sendJSON(res, 404, { error:'no such room' });

    switch(msg.type){
      case 'buzz': {
        const p = room.players.get(msg.id);
        if(!p) return sendJSON(res, 404, { error:'not in room' });
        if(!room.armed) return sendJSON(res, 200, { ok:true, ignored:'not armed' });
        if(room.locked) return sendJSON(res, 200, { ok:true, ignored:'already locked' });
        const until = room.cooling.get(p.id) || 0;
        if(until > Date.now())
          return sendJSON(res, 200, { ok:true, ignored:'cooling', until });
        // stamped here so every buzz is judged at the same point on the wire —
        // fairer than trusting phone clocks or whoever the host hears from first
        room.locked = { id:p.id, name:p.name, team:p.team, at:Date.now() };
        /* The answer clock, if the host armed with one. A duration, not a deadline:
           each phone counts down from receipt, so phone clocks never need to agree
           with anybody. Display only — the host's own clock is the authority. */
        if(room.answerSecs) room.locked.secs = room.answerSecs;
        // in 'type' the buzz carries what they wrote; the relay never judges it,
        // because only the host knows the answer — and a phone that could ask the
        // relay would be a phone that could be asked for the answer
        if(room.mode === 'type') room.locked.value = String(msg.value == null ? '' : msg.value).slice(0,120);
        room.armed  = false;
        toHost(room, 'buzz', room.locked);
        toPlayers(room, 'locked', room.locked);
        return sendJSON(res, 200, { ok:true, locked:true });
      }

      /* The host's verdict on one typed answer. Wrong puts that player on ice for
         `coolMs` and nobody else, so the room can stay open — which is the whole
         shape of this dynamic: everyone keeps typing, a miss costs you time rather
         than costing your team points. */
      case 'judge': {
        const p = room.players.get(msg.id);
        if(!p) return sendJSON(res, 404, { error:'not in room' });
        const cool = Math.max(0, Math.min(30000, Number(msg.coolMs) || 0));
        const until = cool ? Date.now() + cool : 0;
        if(until) room.cooling.set(p.id, until); else room.cooling.delete(p.id);
        pushEvent(p.res, 'judged', { verdict:String(msg.verdict||'wrong'),
                                     note:String(msg.note||'').slice(0,120), until });
        return sendJSON(res, 200, { ok:true, until });
      }
      case 'arm': {
        room.armed = true; room.locked = null;
        // seconds to answer once somebody takes the floor; 0 = no clock
        room.answerSecs = Math.max(0, Math.min(120, Number(msg.answerSecs) || 0));
        /* `rethink` lets a player change their reply while the round is open —
           the whole point of a team vote is that they argue and move. The
           responses map is keyed by player id, so a second reply simply replaces
           the first and the tally recomputes. `secs` is how long the round runs,
           counted from here so a late joiner can be told what is left. */
        room.rethink = !!msg.rethink;
        /* How many options one phone may hold at once. 1 is a vote; more is a
           *selection*, which is what a team racing to assemble a group needs —
           a team of two phones cannot build a four-word answer one vote each.
           The relay only carries it: what a multi-pick reply means is the host's
           business, exactly as it never learns what an answer means. */
        room.multi   = Math.max(1, Math.min(12, Number(msg.multi) || 1));
        room.secs    = Math.max(0, Math.min(900, Number(msg.secs) || 0));
        room.armedAt = Date.now();
        /* 'card' is a round where each phone answers off its own bingo card. It
           collects like 'answer' rather than racing like 'buzz' — everybody taps,
           and the host judges each tap against that player's card. */
        room.mode  = ['buzz','vote','answer','type','card'].indexOf(msg.mode) !== -1 ? msg.mode : 'buzz';
        /* Was six, which is right for a question with four answers and wrong for
           "which of the letters still on the board" — a Blockbusters board opens
           with eighteen. The phone lays short options out as a keypad rather than a
           list, so the cap is about what fits a hand, not what fits a question. */
        room.options = Array.isArray(msg.options) ? msg.options.slice(0,20).map(o=>String(o).slice(0,80)) : [];
        room.team  = (msg.team === 0 || Number(msg.team) > 0) ? Number(msg.team) : null;
        room.responses = new Map();
        // a new round clears who has already had a go, unless the host is
        // deliberately continuing one (spending is how "one each" is enforced)
        if(!msg.keepSpent) room.spent = new Set();
        /* `reopen` is the same question coming back after a wrong answer, not a new
           one. It matters on the handset: a fresh arm clears the box, and clearing
           it would throw away what somebody was halfway through typing when
           somebody else guessed wrong. Cooling timers survive a reopen and are
           cleared by a genuinely new question. */
        const now = Date.now();
        if(msg.reopen){ room.cooling.forEach((t,id)=>{ if(t <= now) room.cooling.delete(id); }); }
        else room.cooling = new Map();
        room.prompt = String(msg.prompt||'').slice(0,200);
        toPlayers(room, 'armed', { prompt: room.prompt,
                                   mode: room.mode, options: room.options,
                                   /* `turnTeam`, not `team`: the join payload already
                                      carries the player's own team under that name, and
                                      the phone runs both through the same handler. */
                                   turnTeam: room.team,
                                   spent: [...room.spent], reopen: !!msg.reopen,
                                   rethink: room.rethink, secs: room.secs,
                                   multi: room.multi,
                                   cooling: [...room.cooling].map(([id,until])=>({ id, until })) });
        return sendJSON(res, 200, { ok:true });
      }
      case 'disarm':
        room.armed = false; room.prompt = ''; room.team = null;
        toPlayers(room, 'disarmed', {});
        return sendJSON(res, 200, { ok:true });
      case 'reset':
        room.armed = false; room.locked = null; room.prompt = ''; room.team = null;
        room.responses = new Map(); room.spent = new Set(); room.cooling = new Map();
        room.cards = new Map();
        toPlayers(room, 'reset', {});
        return sendJSON(res, 200, { ok:true });

      /* One entry per player, for the modes where everybody answers rather than
         racing. Deliberately separate from 'buzz': that one is first-past-the-post
         and locks the room, this one stays open so the whole class can reply. */
      case 'respond': {
        const p = room.players.get(msg.id);
        if(!p) return sendJSON(res, 404, { error:'not in room' });
        if(!room.armed) return sendJSON(res, 200, { ok:true, ignored:'not armed' });
        if(room.mode === 'buzz') return sendJSON(res, 200, { ok:true, ignored:'buzz round' });
        /* A bingo tap is not "your one answer this round": a wrong tap is meant to
           be followed by another, and the next call reuses the same open round. So
           spending — which is what enforces one-each — does not apply to cards. */
        if(room.mode !== 'card' && !room.rethink && room.spent.has(p.id))
          return sendJSON(res, 200, { ok:true, ignored:'already answered' });
        /* A round can belong to one team. The phone is told and shows no controls,
           so this only catches the ones that cannot have been told — a handset that
           joined mid-round, or one still holding the previous question. */
        if(room.team != null && p.team !== room.team)
          return sendJSON(res, 200, { ok:true, ignored:'not your team' });
        const value = String(msg.value == null ? '' : msg.value).slice(0, 120);
        room.responses.set(p.id, { id:p.id, name:p.name, team:p.team, value });
        if(room.mode !== 'card' && !room.rethink) room.spent.add(p.id);
        const all = [...room.responses.values()];
        const tally = {};
        all.forEach(r2 => { tally[r2.value] = (tally[r2.value] || 0) + 1; });
        toHost(room, 'response', { latest:{ id:p.id, name:p.name, team:p.team, value },
                                   total: all.length, of: room.players.size,
                                   tally, all });
        return sendJSON(res, 200, { ok:true });
      }
      /* One card per player, dealt by the host. Sent as {id: [words]} so a class of
         thirty is one request rather than thirty. */
      case 'deal': {
        const cards = (msg.cards && typeof msg.cards === 'object') ? msg.cards : {};
        Object.keys(cards).forEach(pid => {
          const words = Array.isArray(cards[pid]) ? cards[pid].slice(0,25).map(w=>String(w).slice(0,40)) : [];
          if(!words.length) return;
          const card = { words, marked:words.map(()=>false) };
          room.cards.set(pid, card);
          const p = room.players.get(pid);
          if(p) pushEvent(p.res, 'card', card);
        });
        return sendJSON(res, 200, { ok:true, dealt:Object.keys(cards).length });
      }
      /* The host judged a tap and it was right. The relay stores the mark so a
         phone that reconnects gets its card back with the marks still on it. */
      case 'mark': {
        const card = room.cards.get(msg.id);
        if(!card) return sendJSON(res, 200, { ok:true, ignored:'no card' });
        const i = card.words.indexOf(String(msg.word||''));
        if(i === -1) return sendJSON(res, 200, { ok:true, ignored:'not on card' });
        card.marked[i] = true;
        const p = room.players.get(msg.id);
        if(p) pushEvent(p.res, 'marked', { index:i, word:card.words[i], marked:card.marked });
        return sendJSON(res, 200, { ok:true });
      }
      // the host judged a tap and it was wrong — only that phone hears about it
      case 'nope': {
        const p = room.players.get(msg.id);
        if(p) pushEvent(p.res, 'nope', { word:String(msg.word||'') });
        return sendJSON(res, 200, { ok:true });
      }
      case 'teams':
        room.teams = Array.isArray(msg.teams) ? msg.teams.slice(0,8).map(t=>String(t).slice(0,24)) : [];
        toPlayers(room, 'teams', { teams:room.teams });
        return sendJSON(res, 200, { ok:true });
      default:
        return sendJSON(res, 400, { error:'unknown type' });
    }
  });
}

/* ---------- static files ---------- */
function serveStatic(req, res, pathname){
  let rel = decodeURIComponent(pathname);
  if(rel === '/' ) rel = '/index.html';
  const file = path.join(ROOT, rel);
  if(!file.startsWith(ROOT)) return send(res, 403, 'forbidden');
  fs.stat(file, (err, st)=>{
    if(err || !st.isFile()) return send(res, 404, 'not found');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type':type, 'Cache-Control':'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

/* What is left of a round's clock, computed here where the round was stamped —
   a phone is never asked to compare its clock with the relay's. */
function secsLeft(room){
  if(!room.armed || !room.secs) return 0;
  return Math.max(0, Math.round(room.secs - (Date.now() - room.armedAt)/1000));
}

/* A late joiner lands mid-lock with the clock already running, so the duration it
   is sent is what is *left*, computed here where the lock was stamped — a phone can
   never be asked to compare its clock with the relay's. */
function lockedNow(room){
  if(!room.locked || !room.locked.secs) return room.locked;
  const left = Math.max(0, Math.round(room.locked.secs - (Date.now() - room.locked.at)/1000));
  return Object.assign({}, room.locked, { secs: left });
}

/* ---------- server ---------- */
const server = http.createServer((req, res)=>{
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return send(res, 204, '');

  if(p === '/buzzer/health')  return sendJSON(res, 200, { ok:true, rooms:rooms.size });
  if(p === '/buzzer/newcode') return sendJSON(res, 200, { code: makeCode(), lan: lanHost() });
  /* What a phone needs *before* it joins: which teams there are. The join screen
     used to offer a hard-coded two, so a class split into four could only pick from
     the first half — and the names, which the teacher had renamed to something the
     room recognises, never reached the phone until after the choice was made.
     Team names are the only thing here; a room's questions and answers are not. */
  if(p === '/buzzer/room'){
    const room = rooms.get(String(url.searchParams.get('code') || ''));
    if(!room) return sendJSON(res, 404, { error:'no such room' });
    return sendJSON(res, 200, { ok:true, teams:room.teams, players:room.players.size });
  }
  if(p === '/buzzer/stream')  return openStream(req, res, url.searchParams);
  if(p === '/buzzer/send' && req.method==='POST') return handleSend(req, res);
  if(p.startsWith('/buzzer/')) return sendJSON(res, 404, { error:'unknown endpoint' });

  if(req.method !== 'GET') return send(res, 405, 'method not allowed');
  serveStatic(req, res, p);
});

function lanAddresses(){
  return Object.values(os.networkInterfaces()).flat()
    .filter(n=>n && n.family==='IPv4' && !n.internal).map(n=>n.address);
}
function lanHost(){
  const a = lanAddresses()[0];
  return a ? a + ':' + PORT : '';
}

server.listen(PORT, ()=>{
  const lan = lanAddresses();
  console.log('\n  Engishism buzzer relay\n');
  console.log('  Teacher (this machine):  http://localhost:' + PORT + '/game-hub.html');
  lan.forEach(ip=>console.log('  Students (same WiFi):    http://' + ip + ':' + PORT + '/join.html'));
  if(!lan.length) console.log('  (no LAN address found — students will need a hosted relay)');
  console.log('\n  Stop with Ctrl-C\n');
});
