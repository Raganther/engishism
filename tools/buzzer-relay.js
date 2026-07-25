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
    r = { host:null, players:new Map(), teams:[], armed:false, locked:null, emptiedAt:0 };
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

  pushEvent(res, 'joined', { id, name, team, teams:room.teams, armed:room.armed, locked:room.locked });
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
        // stamped here so every buzz is judged at the same point on the wire —
        // fairer than trusting phone clocks or whoever the host hears from first
        room.locked = { id:p.id, name:p.name, team:p.team, at:Date.now() };
        room.armed  = false;
        toHost(room, 'buzz', room.locked);
        toPlayers(room, 'locked', room.locked);
        return sendJSON(res, 200, { ok:true, locked:true });
      }
      case 'arm':
        room.armed = true; room.locked = null;
        toPlayers(room, 'armed', { prompt: String(msg.prompt||'').slice(0,200) });
        return sendJSON(res, 200, { ok:true });
      case 'disarm':
        room.armed = false;
        toPlayers(room, 'disarmed', {});
        return sendJSON(res, 200, { ok:true });
      case 'reset':
        room.armed = false; room.locked = null;
        toPlayers(room, 'reset', {});
        return sendJSON(res, 200, { ok:true });
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
