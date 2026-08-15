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
    /* `epoch` is the room's identity across the relay's own life. Rooms live in
       memory, and the deployed relay restarts on every push — so mid-lesson a
       reconnecting host silently recreates its room *empty*, wearing the same
       code. The host cannot tell that from an ordinary reconnect unless the room
       says who it is: same epoch on `ready` means "I still hold what you told
       me", a new one means "I know nothing — tell me everything again". */
    r = { epoch: Math.random().toString(36).slice(2, 10),
          host:null, players:new Map(), teams:[], solo:false, armed:false, locked:null,
          mode:'buzz', prompt:'', options:[], team:null, responses:new Map(),
          spent:new Set(), cooling:new Map(), cards:new Map(), emptiedAt:0,
          answerSecs:0, rethink:false, secs:0, armedAt:0, multi:1, send:false,
          /* How many options one phone may hold, per team index — because teams
             are not the same size, and "one player's share of a four-word answer"
             is four words split between however many phones that team has. Null
             means the room-wide `multi` applies to everybody, which is every
             round that existed before this. */
          multiByTeam:null,
          /* The options a phone is offered, per team index. Null means the whole
             room is asked the same thing, which is every round that existed before
             this. It is the second thing a round carries that differs by team, and
             the first where the *question* differs rather than the rules: a race
             in which each team climbs its own ladder gives each side a different
             set of words still to place. */
          optionsByTeam:null,
          /* Which of those options are already *settled* for this phone, per team
             index. Null means none are, which is every round that existed before
             this. It is the answer to a fault a real class found: an ordering race
             used to shrink each side's list as they placed words, so the layout
             moved under a thumb mid-question and a reconnecting phone came back
             with no record of what it had already done. The list stays whole and
             this says which entries are finished with. Carried, never read — the
             relay does not learn what settled means. */
          doneByTeam:null,
          /* The prompt one phone is shown, per player id. Null means everybody
             reads the room-wide prompt, which is every round that existed before
             this. It is the first thing a round carries that differs by *player*
             rather than by team — an information gap puts a different view of one
             sentence on every handset, and the gap between those views is the
             lesson. The relay carries the strings without reading them, exactly
             as it never learns an answer. */
          promptByPlayer:null,
          /* Whether a reply in this round is a state the player is *holding*
             rather than an answer they have *given*. A held reply leaves with the
             phone that holds it: a student who walks out mid-round must not go on
             occupying two of their team's four words with nobody able to drop
             them. A given answer stays — the teacher wants to see what the class
             typed even if a handset died afterwards. Off unless the host says so,
             so nothing that existed before this changes. */
          /* One line saying how this question is being played — "A team answers
             only when all of them agree". The round's own words, carried and never
             read, exactly like the prompt. It is not the question, so it lives
             beside it rather than in it: a teacher who set one rule on one board
             and another on the next cannot remember which is running, and the
             handset is the one screen actually in the room's hands. */
          note:'',
          holds:false };
    rooms.set(code, r);
  }
  return r;
}
function pushEvent(res, event, data){
  try{ res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }catch(e){}
}
function toHost(room, event, data){ if(room.host) pushEvent(room.host, event, data); }
function toPlayers(room, event, data){ room.players.forEach(p=>pushEvent(p.res, event, data)); }
/* The same event with a payload built per recipient. Needed the moment anything a
   round carries differs by team — a player's pick cap does, because it is their
   share of one answer and teams are different sizes. */
function toEachPlayer(room, event, build){
  room.players.forEach(p=>pushEvent(p.res, event, build(p)));
}
/* What this phone is being offered. Falls through to the room-wide list for any
   team the host did not name, so a host that knows nothing about per-team options
   behaves exactly as it did before they existed. */
function optionsFor(room, team){
  const per = room.optionsByTeam;
  if(per){
    const mine = per[Math.max(0, Number(team) || 0)];
    if(Array.isArray(mine)) return mine;
  }
  return room.options;
}

/* Which of this phone's options are finished with. Empty for any team the host did
   not name, so a host that knows nothing about settled options behaves exactly as it
   did before they existed. */
function doneFor(room, team){
  const per = room.doneByTeam;
  if(per){
    const mine = per[Math.max(0, Number(team) || 0)];
    if(Array.isArray(mine)) return mine;
  }
  return [];
}

/* What this phone is asked. Falls through to the room-wide prompt for any player
   the host did not name, so a host that knows nothing about per-player prompts
   behaves exactly as it did before they existed — and so does a latecomer the
   host has not yet dealt a view. */
function promptFor(room, id){
  const per = room.promptByPlayer;
  if(per && typeof per[id] === 'string') return per[id];
  return room.prompt;
}

/* One phone's cap. Falls through to the room-wide `multi` for any team the host
   did not name, so a host that knows nothing about shares behaves exactly as it
   did before per-team caps existed. */
function capFor(room, team){
  const per = room.multiByTeam;
  if(per && per.length){
    const n = Math.floor(Number(per[Math.max(0, Number(team) || 0)]));
    if(n >= 1) return Math.min(12, n);
  }
  return room.multi;
}
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
  /* TCP keepalive, so a handset that vanished without closing — screen locked
     hard, walked off the wifi — errors its socket in tens of seconds instead of
     lingering as a phantom player that inflates its team's size. The pings above
     only *send*; a dead peer swallows them silently for as long as the OS keeps
     buffering. This is for the phantoms nobody notices; the teacher's kick is for
     the one they do. */
  try{ res.socket.setKeepAlive(true, 10000); }catch(e){}

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
    pushEvent(res, 'ready', { room:code, players:roster(room), epoch:room.epoch });
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
    id, name, team, teams:room.teams, solo:room.solo,
    armed:room.armed, locked:lockedNow(room),
    mode:room.mode, prompt:promptFor(room, id), note:room.note,
    options:optionsFor(room, team), done:doneFor(room, team), turnTeam:room.team,
    spent:[...room.spent],
    rethink: room.rethink, secs: secsLeft(room), multi: capFor(room, team),
    send: !!room.send,
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
    dropPlayer(room, id);
  });
}

/* One definition of a player leaving, because it now happens two ways — the
   stream closing, and the teacher kicking a phantom — and two copies would be two
   things that could disagree about what leaving means.

   A held reply leaves with the phone holding it. Without this a student who
   walks out mid-round goes on occupying two of their team's four words for the
   rest of the game, with nobody able to drop them and the host still counting
   them — the team is simply stuck. A *given* answer stays put: the teacher
   wants to see what the class typed even from a handset that died afterwards.
   Which of the two this is, is the host's declaration on the arm. */
function dropPlayer(room, id){
  const p = room.players.get(id);
  if(!p) return;
  room.players.delete(id);
  const dropped = room.holds && room.responses.delete(id);
  toHost(room, 'leave', { id, name:p.name, players:roster(room) });
  // the host's picture of the round has to change with it, or nothing tells it
  if(dropped) toHost(room, 'response', Object.assign(
    { latest:null, left:id, of:room.players.size }, tallyOf(room)));
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
        room.multiByTeam = readShares(msg.multiByTeam);
        /* See the room's own note: a held reply leaves with its phone, a given
           answer does not. */
        room.holds   = !!msg.holds;
        /* `send` asks each handset to hold its taps until the player presses
           Send — the commit beat for a room of individuals, where a tap judged
           the instant it lands makes guessing free. Carried unread, like
           everything else on the arm: what committing means is the host's. */
        room.send    = !!msg.send;
        room.secs    = Math.max(0, Math.min(900, Number(msg.secs) || 0));
        room.armedAt = Date.now();
        /* 'card' is a round where each phone answers off its own bingo card. It
           collects like 'answer' rather than racing like 'buzz' — everybody taps,
           and the host judges each tap against that player's card. */
        /* 'arrange' is a round where each phone puts a set of tiles into an order —
           the anagram's letters into boxes. It collects like a multi-pick vote and
           the reply is the same `|`-joined list in the order they were placed; what
           differs is only what the handset draws, which is the handset's business
           and not the relay's. The relay learns nothing new by carrying it. */
        room.mode  = ['buzz','vote','answer','type','card','arrange'].indexOf(msg.mode) !== -1 ? msg.mode : 'buzz';
        /* Was six, which is right for a question with four answers and wrong for
           "which of the letters still on the board" — a Blockbusters board opens
           with eighteen. The phone lays short options out as a keypad rather than a
           list, so the cap is about what fits a hand, not what fits a question. */
        room.options = Array.isArray(msg.options) ? msg.options.slice(0,20).map(o=>String(o).slice(0,80)) : [];
        /* Same cap per team as the room-wide list: what fits a hand, not what fits
           a question. A non-array entry falls through to `options` for that team. */
        room.doneByTeam = Array.isArray(msg.doneByTeam)
          ? msg.doneByTeam.slice(0,60).map(list => Array.isArray(list)
              ? list.slice(0,20).map(o => String(o).slice(0,40)) : [])
          : null;
        room.optionsByTeam = Array.isArray(msg.optionsByTeam)
          ? msg.optionsByTeam.slice(0,60).map(list => Array.isArray(list)
              ? list.slice(0,20).map(o=>String(o).slice(0,80)) : null)
          : null;
        /* Same discipline as the per-team lists: bounded, stringified, carried
           unread. Keyed by player id because that is what survives a reconnect —
           a phone that drops and returns arrives under the same id and is shown
           the same view, which is what makes a gap hold still mid-round. */
        room.promptByPlayer = (msg.promptByPlayer && typeof msg.promptByPlayer === 'object')
          ? Object.keys(msg.promptByPlayer).slice(0,60).reduce((out, id) => {
              out[String(id).slice(0,40)] = String(msg.promptByPlayer[id] == null ? '' : msg.promptByPlayer[id]).slice(0,200);
              return out;
            }, {})
          : null;
        room.team  = (msg.team === 0 || Number(msg.team) > 0) ? Number(msg.team) : null;
        /* A round dealing, or re-dealing, its own per-player cards. Carried unread
           like everything else on the arm — the relay never learns which word is
           the right one, exactly as it never learns a typed answer. */
        dealCards(room, msg.cardsByPlayer, false);
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
        room.note   = String(msg.note||'').slice(0,120);
        /* Built per recipient rather than broadcast, because `multi` is now that
           player's share of the answer and their team decides it. Everything else
           in here is the same for the whole room. */
        toEachPlayer(room, 'armed', p => ({ prompt: promptFor(room, p.id),
                                   note: room.note,
                                   mode: room.mode, options: optionsFor(room, p.team),
                                   done: doneFor(room, p.team),
                                   /* `turnTeam`, not `team`: the join payload already
                                      carries the player's own team under that name, and
                                      the phone runs both through the same handler. */
                                   turnTeam: room.team,
                                   spent: [...room.spent], reopen: !!msg.reopen,
                                   rethink: room.rethink, secs: room.secs,
                                   send: !!room.send,
                                   multi: capFor(room, p.team),
                                   /* This phone's own card, if the room holds one. On
                                      the arm as well as the join, because a round
                                      updates its marks by re-arming and a card that
                                      only travelled on `joined` would freeze on the
                                      first call. */
                                   card: room.cards.get(p.id) || null,
                                   cooling: [...room.cooling].map(([id,until])=>({ id, until })) }));
        return sendJSON(res, 200, { ok:true });
      }
      /* A team's share of the answer changed — somebody joined it or dropped off
         it — without the question itself changing. Deliberately not an `arm`: a
         fresh arm clears every handset's picks, and a latecomer walking in must
         not wipe what four other people had just agreed on. So the cap moves and
         what they are holding stays, which also means a phone can be left holding
         more than its new share. That is the honest state and the team resolves it
         by talking, which is the point of the mode — the handset says so and
         refuses to add more. */
      /* Which options are settled has moved — somebody placed a word — without the
         question itself changing. Deliberately not an `arm`, for exactly the reason
         `shares` and `prompts` are not: a fresh arm clears every handset, and in a
         race of sixteen people somebody settles a word every second or two. Only
         while a round is open, and the stored copy is what a reconnecting phone is
         given back, which is the half a live-only push would miss. */
      case 'done': {
        if(!room.armed) return sendJSON(res, 200, { ok:true, ignored:'not armed' });
        room.doneByTeam = Array.isArray(msg.doneByTeam)
          ? msg.doneByTeam.slice(0,60).map(list => Array.isArray(list)
              ? list.slice(0,20).map(o => String(o).slice(0,40)) : [])
          : null;
        toEachPlayer(room, 'done', p => ({ done: doneFor(room, p.team) }));
        return sendJSON(res, 200, { ok:true });
      }
      case 'shares': {
        room.multiByTeam = readShares(msg.multiByTeam);
        toEachPlayer(room, 'shares', p => ({ multi: capFor(room, p.team) }));
        return sendJSON(res, 200, { ok:true });
      }
      /* The per-player prompts moved — somebody joined or left, so the deal was
         recut — without the question itself changing. Deliberately not an `arm`,
         for the same reason `shares` is not: a fresh arm clears every handset,
         and a latecomer walking in must not wipe what everyone else was typing.
         Only the phones whose view changed hear anything, and only while a round
         is open — a room with nothing asked has nothing to re-view. */
      case 'prompts': {
        if(!room.armed) return sendJSON(res, 200, { ok:true, ignored:'not armed' });
        const per = (msg.promptByPlayer && typeof msg.promptByPlayer === 'object') ? msg.promptByPlayer : {};
        const cur = room.promptByPlayer || (room.promptByPlayer = {});
        Object.keys(per).slice(0,60).forEach(id=>{
          const key = String(id).slice(0,40);
          const view = String(per[id] == null ? '' : per[id]).slice(0,200);
          if(cur[key] === view) return;          // a view that did not move says nothing
          cur[key] = view;
          const p = room.players.get(key);
          if(p) pushEvent(p.res, 'prompt', { prompt: view });
        });
        return sendJSON(res, 200, { ok:true });
      }
      /* **Look up — the board has just filled something in.** The crowd reveal
         happens on the projector, and a room of sixteen heads bent over their own
         handsets is exactly the room that misses it. So what travels is a moment,
         not a picture: every phone pulses once and goes quiet again.

         Deliberately *not* the reveal meter itself. That bar is damped and public
         on purpose; in the hand it would be private and probeable — tap a word,
         watch your own bar twitch, and a sharp student reads the answer off it one
         word at a time. So this carries that something landed and never which part,
         which leaves nothing here to read.

         Not an `arm`, for the same reason `shares` and `prompts` are not: a fresh
         arm clears every handset. This touches nothing anybody is holding. */
      case 'nudge': {
        if(!room.armed) return sendJSON(res, 200, { ok:true, ignored:'not armed' });
        toPlayers(room, 'nudge', { kind: String(msg.kind || 'reveal').slice(0,24) });
        return sendJSON(res, 200, { ok:true });
      }
      case 'disarm':
        room.armed = false; room.prompt = ''; room.team = null; room.promptByPlayer = null;
        // the rule described that question; it must not survive into the next one
        room.note = '';
        toPlayers(room, 'disarmed', {});
        return sendJSON(res, 200, { ok:true });
      case 'reset':
        room.armed = false; room.locked = null; room.prompt = ''; room.team = null;
        room.promptByPlayer = null; room.note = '';
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
        const { all, tally } = tallyOf(room);
        toHost(room, 'response', { latest:{ id:p.id, name:p.name, team:p.team, value },
                                   total: all.length, of: room.players.size,
                                   tally, all });
        return sendJSON(res, 200, { ok:true });
      }
      /* One card per player, dealt by the host. Sent as {id: [words]} so a class of
         thirty is one request rather than thirty. */
      case 'deal': {
        return sendJSON(res, 200, { ok:true, dealt: dealCards(room, msg.cards, true) });
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
        room.teams = Array.isArray(msg.teams) ? msg.teams.slice(0,60).map(t=>String(t).slice(0,24)) : [];
        /* **Whether the room is a set of teams or a set of people**, carried so the
           join screen can stop asking a student which team they are on — in solo
           there is nothing to pick, because the host gives every phone a slot of
           its own the moment it arrives. Carried, never acted on: the relay does
           not learn what a competitor is, only that the phone should not be asked.
           Sticky when the key is absent, so a plain names push does not silently
           put the room back into teams. */
        if('solo' in msg) room.solo = !!msg.solo;
        toPlayers(room, 'teams', { teams:room.teams, solo:room.solo });
        return sendJSON(res, 200, { ok:true });

      /* **One phone's competitor, set by the host.** `remap` renumbers everybody
         after a removal; this names one. It is what individual play is made of —
         a person arrives, the host gives them their own slot, and their handset is
         told so the pill in their hand is right. Same bookkeeping as `remap`, one
         player wide. */
      case 'seat': {
        const p = room.players.get(String(msg.id || ''));
        if(!p) return sendJSON(res, 200, { ok:true, ignored:'not in room' });
        const n = Math.max(0, Math.min(59, Math.floor(Number(msg.team) || 0)));
        /* **A team change invalidates everything scoped to a team**, and which of
           this phone's options are settled is one of those. It bit on a reconnect:
           a rejoining handset registers on the team it *loaded* with, is seated a
           moment later, and was left holding the previous occupant's ladder — the
           whole of somebody else's, marked as its own. */
        if(p.team !== n){ p.team = n; pushEvent(p.res, 'team', { team:n });
                          pushEvent(p.res, 'done', { done: doneFor(room, n) }); }
        return sendJSON(res, 200, { ok:true });
      }

      /* A team was removed on the host. A team's index is its identity — on the
         board, in every reply's attribution, and here — so every player above the
         removed slot shifts down one, and a player *on* it lands on team 0 with
         their handset told, so the pill in their hand says where they now are.
         Without this the first live class paid a win to a team that no longer
         existed: the phones kept their old numbers, the board renumbered, and the
         two disagreed for the rest of the lesson. */
      case 'remap': {
        const gone = Math.max(0, Math.floor(Number(msg.removed)));
        room.players.forEach(p=>{
          const was = p.team;
          if(p.team === gone) p.team = 0;
          else if(p.team > gone) p.team = p.team - 1;
          if(p.team !== was){ pushEvent(p.res, 'team', { team:p.team });
                              pushEvent(p.res, 'done', { done: doneFor(room, p.team) }); }
        });
        /* The host's picture refreshes through the same event a join uses, which
           is what re-deals, re-shares and re-reads everything downstream. */
        toHost(room, 'join', { players:roster(room) });
        return sendJSON(res, 200, { ok:true });
      }

      /* The teacher removes one phone — the way out of a phantom that joined a
         team and died without closing, which the room otherwise counts forever.
         The phone is told before it is cut, so a live handset kicked by mistake
         says what happened instead of showing "reconnecting…" over a room it is
         no longer in. The bookkeeping is the same leaving a stream-close does. */
      case 'kick': {
        const p = room.players.get(String(msg.id || ''));
        if(!p) return sendJSON(res, 200, { ok:true, ignored:'not in room' });
        pushEvent(p.res, 'kicked', {});
        try{ p.res.end(); }catch(e){}
        dropPlayer(room, p.id);
        return sendJSON(res, 200, { ok:true });
      }
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
/* Everybody's replies and the count against each value. Two callers now: a reply
   arriving, and a held reply leaving with the phone that held it. */
/* **Storing one player's card and telling that phone.** Two callers: the `deal`
   message, which is how the Bingo skin has always dealt, and the `arm` message,
   which is how a *round* does it — a round cannot send its own relay messages, so
   the card rides the arm it was already sending. That is the whole of "state that
   outlives one question" on this side: the relay was already keeping cards across
   calls and across a phone dropping off the wifi; what was missing was a way for a
   round to put one here.

   `[words]` is the old shape and stays; `{words, marked}` is the round's, because a
   round updates marks by re-arming rather than by sending a second message. `push`
   is false on an arm, where the per-recipient payload carries the card anyway and a
   second event would only make the handset draw twice. */
function dealCards(room, cards, push){
  if(!cards || typeof cards !== 'object') return 0;
  let n = 0;
  Object.keys(cards).slice(0, 60).forEach(pid => {
    const v = cards[pid];
    const raw = Array.isArray(v) ? v : (v && Array.isArray(v.words) ? v.words : null);
    if(!raw || !raw.length) return;
    const words  = raw.slice(0,25).map(w => String(w).slice(0,40));
    const marked = (v && Array.isArray(v.marked))
      ? words.map((_, i) => !!v.marked[i]) : words.map(()=>false);
    room.cards.set(String(pid).slice(0,40), { words, marked });
    n++;
    if(push){ const p = room.players.get(pid); if(p) pushEvent(p.res, 'card', { words, marked }); }
  });
  return n;
}

function tallyOf(room){
  const all = [...room.responses.values()];
  const tally = {};
  all.forEach(r => { tally[r.value] = (tally[r.value] || 0) + 1; });
  return { all, total: all.length, tally };
}

/* Per-team caps off the wire. Null for anything that is not a list, which is what
   restores the room-wide `multi` — so a host can hand shares back as easily as it
   set them. */
/* **Sixty, not eight.** Every per-team list here was capped at 8, written when a
   team was a team and four was a big room. A room of *individuals* makes a
   competitor per student, so the cap silently threw away everybody from the ninth
   person on: their share, their options and their settled words all fell through to
   the room-wide value with nothing anywhere saying so. It was reported as "Kira
   cannot select the first answer" — she was the eleventh handset, never learned
   which words were already on her own ladder, kept re-tapping one, and every reply
   was correctly dropped as a stale tap. The roster is capped at 60 and `seat` clamps
   to 0-59, so 60 is the number these have to agree with. */
function readShares(v){
  if(!Array.isArray(v) || !v.length) return null;
  return v.slice(0, 60).map(n => Math.max(1, Math.min(12, Math.floor(Number(n)) || 1)));
}

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
    return sendJSON(res, 200, { ok:true, teams:room.teams, solo:!!room.solo,
                                players:room.players.size });
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
