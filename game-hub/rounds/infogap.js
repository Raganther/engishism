/* ================= The information gap round =================
   One sentence, its key words starred by the author — and every phone on a team
   shown a *different* view of it: your own key word is blanked, your teammates'
   key words are visible on yours. Nobody's screen holds the whole sentence, so
   the only way to fill your blank is to ask the people beside you. The speaking
   is not decoration on the task; it is the task — which is why this dynamic is
   rated the way it is in ESL, and why it is nearly impossible to run on paper.

     { text:'Ask your team for your missing words.',
       infogap:{ sentence:'The jury *deliberated* for four hours before reaching a *unanimous* verdict' } }

   **The starred word is the authoring convention**, the same asterisks the
   `errorfix` form already uses. The stars mark what is hidden; everything else is
   scenery every phone shows.

   **This is the first round to put a different prompt on every handset**, which
   is what `promptByPlayer` on the relay exists for — carried per player id, never
   read, exactly as the relay never learns an answer. Per *player*, not per team,
   because the gap this round teaches across is between two students sitting next
   to each other; a per-team gap would put it between competitors instead.

   **The card blanks every key word**, always. The projector is the one screen the
   whole room reads, so a word visible there is a word nobody has to ask for. What
   the card shows instead is each team's sentence filling in as words land — and a
   team that is behind can read a word off a team that is ahead, exactly as Drag
   the Words decided: being copied is the cost of being in front.

   **A typed word only counts against your own blank.** The words you can see are
   yours to say out loud, not to type — crediting them would let one student do the
   whole round silently, which is the opposite of what it is for.

   **The deal is sticky by player id**: a phone that drops and rejoins arrives
   under the same id and is dealt the same view, a newcomer takes the
   least-covered gap, and nobody's blank hops to a different word because
   somebody else walked in. The deal follows the roster — the hosts push a recut
   through the relay's `prompts` message on every join and leave, so a phone that
   joined after the arm is not left on the all-blanks fallback. A team smaller
   than the number of gaps plays the first ones and the rest stay blank scenery;
   a team larger doubles students up on a gap, and then *each* of them has to
   produce it. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('infogap.js needs hub-rounds.js loaded first'); return; }

  const colourOf = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';
  const MIN = 2;              // one gap is a gap fill, not a gap between students
  const MAX = 5;              // past this a sentence stops being one sentence
  const BLANK = '____';
  const tokOf  = ti => 'slot#' + ti;
  const tiOf   = tok => Number(String(tok).replace(/^slot#/, ''));

  /* A token is a word with its punctuation riding along: `*unanimous*,` is the
     target `unanimous` and a comma the sentence keeps either way. */
  function parse(raw){
    const toks = String(raw || '').trim().split(/\s+/).filter(Boolean);
    const words = [], targets = [];
    toks.forEach(t=>{
      const m = t.match(/^\*([^*]+)\*(.*)$/);
      if(m){ targets.push({ i: words.length, word: m[1] }); words.push({ w: m[1], tail: m[2] || '' }); }
      else words.push({ w: t, tail: '' });
    });
    return { words, targets };
  }

  function cleanSentence(words){ return words.map(t => t.w + t.tail).join(' '); }

  /* The sentence as one player sees it: their own gap blanked, every other key
     word UPPERCASE — so a student can see at a glance which of their words the
     rest of the team is going to ask for. */
  function viewFor(s, hideTi){
    return s.words.map((t, i)=>{
      const ti = s.targets.findIndex(g => g.i === i);
      if(ti === -1) return t.w + t.tail;
      if(ti === hideTi) return BLANK + t.tail;
      return t.w.toUpperCase() + t.tail;
    }).join(' ');
  }

  /* Everybody's fallback — a latecomer the deal never reached, and the room-wide
     prompt: the same all-blanks view the projector shows. */
  function viewBlanked(s){
    return s.words.map((t, i)=>{
      const isTarget = s.targets.some(g => g.i === i);
      return (isTarget ? BLANK : t.w) + t.tail;
    }).join(' ');
  }

  /* Which gaps team `t` is playing. Fewer phones than gaps plays the first ones;
     no phones at all (the teacher's path, or no relay) plays them all. */
  function liveFor(s, t){
    const all = s.targets.map((_, ti) => ti);
    const live = s.liveOf && s.liveOf[t];
    return (live && live.length) ? live : all;
  }

  /* Deal the views. Recut from the fresh roster on every arm *and* on every
     roster change (the hosts push the recut through `prompts`), so the deal is
     **sticky**: a phone that already holds a gap keeps it — mid-round a student's
     blank must not hop to a different word because somebody else walked in — and
     a newcomer takes the least-covered live gap. `s.got` is keyed by gap, so a
     recut never takes back a word a team has already earned. */
  function assignAll(s, ctx){
    const roster = (ctx && ctx.roster) || [];
    const byTeam = {};
    roster.forEach(p => { (byTeam[Number(p.team) || 0] = byTeam[Number(p.team) || 0] || []).push(p); });
    const prev = s.assign || {};
    s.assign = {};   // player id -> { t, ti }
    s.liveOf = {};   // team -> [ti]
    Object.keys(byTeam).forEach(t=>{
      const players = byTeam[t].slice().sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
      const live = s.targets.map((_, ti) => ti).slice(0, Math.max(1, Math.min(s.targets.length, players.length)));
      s.liveOf[t] = live;
      const count = {};
      live.forEach(ti => { count[ti] = 0; });
      players.forEach(p=>{
        const was = prev[p.id];
        if(was && was.t === Number(t) && live.indexOf(was.ti) !== -1){
          s.assign[p.id] = was; count[was.ti]++;
        }
      });
      players.forEach(p=>{
        if(s.assign[p.id]) return;
        const ti = live.slice().sort((a, b) => count[a] - count[b] || a - b)[0];
        s.assign[p.id] = { t: Number(t), ti };
        count[ti]++;
      });
    });
  }

  function markGot(s, t, ti, id){
    const box = s.got[t] || (s.got[t] = {});
    const ids = box[ti] || (box[ti] = []);
    if(ids.indexOf(id) === -1) ids.push(id);
  }

  /* A gap is filled for a team when every player it was dealt to — every one
     still in the room — has produced it. One player per gap is the common case
     and reads as "any"; doubled up, both have to say it, which is the same
     whole-team-or-nobody line the ordering round drew. `'teacher'` fills it
     unconditionally, because the teacher's click never goes through the roster. */
  function gapDone(s, t, ti, ctx){
    const ids = ((s.got[t] || {})[ti]) || [];
    if(ids.indexOf('teacher') !== -1) return true;
    const present = ((ctx && ctx.roster) || []).map(p => p.id);
    const assigned = Object.keys(s.assign || {}).filter(id =>
      s.assign[id].t === Number(t) && s.assign[id].ti === ti && present.indexOf(id) !== -1);
    if(!assigned.length) return ids.length > 0;
    return assigned.every(id => ids.indexOf(id) !== -1);
  }

  K.round.register('infogap', {
    label: 'Information Gap',
    blurb: 'Each phone hides a different word of one sentence — the team talks to fill its blanks.',

    sample: { text: 'Ask your team for your missing words.',
              infogap: { sentence: 'The jury *deliberated* for four hours before reaching a *unanimous* verdict' } },
    field: 'infogap',

    claims(item){ return !!(item && item.infogap && item.infogap.sentence); },

    setup(item, ctx){
      const ig = item && item.infogap;
      if(!ig) return null;
      const { words, targets } = parse(ig.sentence);
      if(targets.length < MIN || targets.length > MAX) return null;
      const s = {
        text: String((item && item.text) || 'Ask your team for your missing words.'),
        words, targets,
        sentence: cleanSentence(words),
        answer: targets.map(g => g.word).join(', '),
        need: targets.length,
        assign: {}, liveOf: {},
        got: {},                 // team -> { ti: [player ids] } — cumulative, never recomputed
        saidBy: {},              // player id -> last value judged, so a verdict is sent once
        chosen: [],
        say: '', shown: false, done: false
      };
      assignAll(s, ctx);
      return s;
    },

    /* ---------- the projector's view ----------
       The sentence with every key word blanked and numbered, then a lane per team
       filling in. Only landed words show — a lane is a sentence completing, not a
       record of guesses. */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-infogap';

      const line = document.createElement('div');
      line.className = 'ig-line';
      s.words.forEach((t, i)=>{
        const ti = s.targets.findIndex(g => g.i === i);
        if(ti === -1){
          const w = document.createElement('span');
          w.className = 'ig-word';
          w.textContent = t.w + t.tail;
          line.appendChild(w);
          return;
        }
        const b = document.createElement('span');
        b.className = 'gword ig-slot';
        b.dataset.word = tokOf(ti);
        const picked = s.chosen.indexOf(tokOf(ti)) !== -1;
        if(s.shown){ b.classList.add('filled', 'right'); b.textContent = s.targets[ti].word; }
        else if(picked){ b.classList.add('filled', 'picked'); b.textContent = s.targets[ti].word; }
        else { b.classList.add('empty'); b.textContent = String(ti + 1); }
        /* The teacher's path: the class says a word out loud, the teacher clicks
           its blank and the word appears — then Check. Degradation is the rule,
           not a fallback: with no relay this is the whole round. */
        if(c.onPick && !s.shown) b.addEventListener('click', ()=> c.onPick(tokOf(ti)));
        line.appendChild(b);
        if(t.tail){
          const p = document.createElement('span');
          p.className = 'ig-word ig-tail';
          p.textContent = t.tail;
          line.appendChild(p);
        }
      });
      mount.appendChild(line);

      const lanes = Object.keys(s.got).map(Number)
        .filter(t => Object.keys(s.got[t] || {}).length);
      if(lanes.length && !s.shown){
        const wrap = document.createElement('div');
        wrap.className = 'ig-lanes';
        lanes.sort((a,b)=>a-b).forEach(t=>{
          const live = liveFor(s, t);
          const lane = document.createElement('div');
          lane.className = 'ig-lane';
          lane.style.setProperty('--lane', colourOf(t));

          const who = document.createElement('span');
          who.className = 'ig-lane-who';
          who.textContent = c.teamName ? c.teamName(t) : ('Team ' + (t + 1));
          lane.appendChild(who);

          const row = document.createElement('div');
          row.className = 'ig-lane-row';
          let done = 0;
          live.forEach(ti=>{
            const cell = document.createElement('span');
            if(gapDone(s, t, ti, c)){ cell.className = 'ig-cell got'; cell.textContent = s.targets[ti].word; done++; }
            else { cell.className = 'ig-cell gap'; cell.textContent = String(ti + 1); }
            row.appendChild(cell);
          });
          lane.appendChild(row);

          const n = document.createElement('span');
          n.className = 'ig-lane-n';
          n.textContent = done + '/' + live.length;
          if(done === live.length) lane.classList.add('full');
          lane.appendChild(n);
          wrap.appendChild(lane);
        });
        mount.appendChild(wrap);
      }

      if(s.say){
        const say = document.createElement('div');
        say.className = 'group-say' + (s.done ? ' good' : '');
        say.textContent = s.say;
        mount.appendChild(say);
      }
    },

    reveal(mount, s, ctx){
      s.done = true; s.shown = true; s.chosen = [];
      this.render(mount, s, ctx);
      return 0;
    },

    /* ---------- the handsets ----------
       `answer` mode — everyone types, rethink on so the relay replaces rather
       than spends. What is new is `promptByPlayer`: each phone reads its own view
       of the sentence, and the relay carries the strings without reading them. */
    arm(s, ctx){
      const c = ctx || {};
      assignAll(s, c);
      const perPlayer = {};
      Object.keys(s.assign).forEach(id => { perPlayer[id] = viewFor(s, s.assign[id].ti); });
      return {
        mode:    'answer',
        prompt:  c.prompt === false ? (s.text || 'Ask your team for your missing words.') : viewBlanked(s),
        promptByPlayer: perPlayer,
        options: [],
        /* Not a pick cap — `answer` mode has no picks. It is what the bench's
           teacher-path cap reads, so the teacher can select every gap. */
        multi:   s.need,
        rethink: true,
        holds:   false,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    read(replies, s, ctx){
      const c = ctx || {};
      (replies || []).forEach(r=>{
        const id = r && r.id;
        const job = id != null && s.assign[String(id)];
        if(!job) return;                       // a phone the deal never reached
        const value = String((r && r.value) == null ? '' : r.value).trim();
        if(!value) return;
        const fresh = s.saidBy[id] !== value;
        s.saidBy[id] = value;
        const want = s.targets[job.ti].word;
        const v = K.answer.judge(value, want);
        if(v === 'right'){
          markGot(s, job.t, job.ti, String(id));
          if(fresh && c.verdict) c.verdict(id, 'right', 'You got it — ' + want);
          return;
        }
        /* Both misses come back as `wrong`, because that is the one verdict the
           handset reopens the box for — the note carries the difference. A miss
           costs a moment, never points; the retry is the round. */
        if(fresh && c.verdict){
          if(v === 'close') c.verdict(id, 'wrong', 'So close — check the spelling', 1500);
          else              c.verdict(id, 'wrong', 'Not that one — ask your team', 2500);
        }
      });
      const picks = {};
      Object.keys(s.got).forEach(t=>{
        const live = liveFor(s, Number(t));
        if(live.every(ti => gapDone(s, Number(t), ti, c)))
          picks[t] = live.map(tokOf);
      });
      return picks;
    },

    judge(answer, s, team, ctx){
      const set = (answer || []).map(tiOf).filter(ti => ti >= 0 && ti < s.need);
      const live = liveFor(s, team);
      const hits = live.filter(ti => set.indexOf(ti) !== -1).length;
      if(hits < live.length) return { verdict:'incomplete', hits };
      return { verdict:'right', hits };
    },

    accept(answer, s, team){
      (answer || []).map(tiOf).forEach(ti => {
        if(ti >= 0 && ti < s.need) markGot(s, Number(team) || 0, ti, 'teacher');
      });
      s.chosen = [];
      s.done = true;
    },

    saidOf(who, r, s){
      return who + ': ' + (r && r.hits || 0) + ' of ' + s.need + ' gaps filled — keep asking.';
    },

    check(item){
      const ig = (item && item.infogap) || {};
      const raw = String(ig.sentence || '').trim();
      if(!raw) return ['Needs a sentence with the key words marked *like this*.'];
      const bad = [];
      const { words, targets } = parse(raw);
      if(targets.length < MIN)
        bad.push('Only ' + targets.length + ' word is starred — ' + MIN +
                 ' is the least that puts a gap between two students. Mark them *like this*.');
      if(targets.length > MAX)
        bad.push(targets.length + ' words are starred; ' + MAX +
                 ' is the most one sentence carries before it stops being a sentence.');
      const seen = {};
      targets.forEach(g=>{
        const k = g.word.toLowerCase();
        if(seen[k]) bad.push('“' + g.word + '” is starred twice — one answer would fill both gaps, so the second asks nothing.');
        seen[k] = true;
      });
      /* The relay caps a prompt at 200 characters, and a view is the sentence
         nearly whole — past the cap a handset would read a truncated sentence and
         nothing anywhere would say why. */
      if(cleanSentence(words).length > 180)
        bad.push('The sentence is ' + cleanSentence(words).length +
                 ' characters; past 180 it no longer fits on a handset.');
      return bad;
    },

    settleMs: 500
  });
})();
