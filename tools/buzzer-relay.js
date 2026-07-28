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
    r = { host:null, players:new Map(), teams:[], armed:false, locked:null,
          mode:'buzz', prompt:'', options:[], team:null, responses:new Map(),
          spent:new Set(), cooling:new Map(), emptiedAt:0 };
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
    if(room.host && room.host !== res){ try{ room.host.end(); }catch(e){} }
    room.host = res;
    room.emptiedAt = 0;
    pushEvent(res, 'ready', { room:code, players:roster(room) });
    req.on('close', ()=>{ clearInterval(beat); if(room.host===res) room.host=null; });
    return;
  }

  const id   = (q.get('id')||'').slice(0,40) || String(Math.random()).slice(2,10);
  const name = ((q.get('name')||'').trim() || 'Player').slice(0,24);
  const team = Math.max(0, Math.min(7, parseInt(q.get('team'),10) || 0));
  room.players.set(id, { id, name, team, res });
  room.emptiedAt = 0;

  /* A student joining mid-question has to arrive into that question, not into a
     blank screen until the next one. Students trickle in — somebody's phone is
     always locked, or on the wrong WiFi, or joining thirty seconds late — so the
     room's current state travels with the join. */
  pushEvent(res, 'joined', {
    id, name, team, teams:room.teams, armed:room.armed, locked:room.locked,
    mode:room.mode, prompt:room.prompt, options:room.options, turnTeam:room.team,
    spent:[...room.spent],
    cooling:[...room.cooling].map(([pid,until])=>({ id:pid, until }))
  });
  toHost(room, 'join', { id, name, team, players:roster(room) });

  req.on('close', ()=>{
    clearInterval(beat);
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
        room.mode  = ['buzz','vote','answer','type'].indexOf(msg.mode) !== -1 ? msg.mode : 'buzz';
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
        if(room.spent.has(p.id)) return sendJSON(res, 200, { ok:true, ignored:'already answered' });
        /* A round can belong to one team. The phone is told and shows no controls,
           so this only catches the ones that cannot have been told — a handset that
           joined mid-round, or one still holding the previous question. */
        if(room.team != null && p.team !== room.team)
          return sendJSON(res, 200, { ok:true, ignored:'not your team' });
        const value = String(msg.value == null ? '' : msg.value).slice(0, 120);
        room.responses.set(p.id, { id:p.id, name:p.name, team:p.team, value });
        room.spent.add(p.id);
        const all = [...room.responses.values()];
        const tally = {};
        all.forEach(r2 => { tally[r2.value] = (tally[r2.value] || 0) + 1; });
        toHost(room, 'response', { latest:{ id:p.id, name:p.name, team:p.team, value },
                                   total: all.length, of: room.players.size,
                                   tally, all });
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
