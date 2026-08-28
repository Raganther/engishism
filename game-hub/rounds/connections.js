/* ================= The connections round — "Connections 4×4" =================
   Sixteen words that split into FOUR hidden groups of four. This is the NYT
   puzzle, and it is a different, harder lesson from the `grouping` round next door
   (which is single-group: "find the four, the rest are decoys"). Here every word
   belongs to exactly one group and the difficulty is the OVERLAP — a word that
   looks like it could join two groups — not distractors. `grouping` stays; this is
   its sibling, the way `anagram` and `scramble` are siblings: shared helpers,
   separate files, separate content fields.

   It is the one round where matter.js carries MEANING rather than decorating a tap:
   **the row a tile lands in IS the group it belongs to.** Flicking a tile into a
   row is the act of claiming its category, exactly as dragging a word up the
   thermometer *is* ranking it. Column within a row is irrelevant — judging reads
   only "which four words share a row."

   Two modes, and they share everything but the interaction:
     · matter — flick the 16 tiles into four rows (physics). The flagship.
     · tap    — tap a word into a row (no physics). The accessible face and the
                no-relay degradation.
   Both arm the SAME 4-row grid and send back the SAME wire (a row-major cell
   list), so `read`/`judge`/lanes are one path. Teams and individuals are one path
   too: a team's answer is the MAJORITY ROW PER WORD across its phones, and a room
   of individuals is just teams of one — the room type only changes what the board
   *draws* (lanes vs a leaderboard), which `Kit.round.lanes` decides on its own.

   Authoring shape — four labelled groups of four, and the label is the teaching
   payoff (naming the category is half the lesson):

     { text:"Find the four groups of four.",
       connections:{ groups:[
         { label:"Ways of cooking",     words:["grilled","steamed","roasted","fried"] },
         { label:"Done to vegetables",  words:["chopped","sliced","peeled","grated"] },
         { label:"Court roles",         words:["judge","jury","witness","clerk"] },
         { label:"Verdicts",            words:["guilty","acquitted","cleared","convicted"] } ] } }

   No `answer` field — the groups ARE the answer. What is deliberately not here:
   scoring, turns, timers, the board. A host pays a tile when this says a team has
   it; the bench pays nothing. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('connections.js needs hub-rounds.js loaded first'); return; }

  const COLS = 4, ROWS = 4, N = 16, NG = 4;
  const norm = w => String(w == null ? '' : w).trim().toLowerCase();

  /* The authored four groups, or null if this item is not ours / is malformed. */
  function groupsOf(item){
    const c = item && item.connections;
    if(!c || !Array.isArray(c.groups)) return null;
    const groups = c.groups.filter(g => g && Array.isArray(g.words));
    return groups.length ? groups : null;
  }

  /* A 16-cell ROW-MAJOR arrangement (the wire, or the board table's cells) into a
     word→row map. Row is derived: the grid is `cols` wide, so cell i sits at row
     floor(i/cols). Empty cells drop out. */
  function rowOfCells(cells){
    const rowOf = {};
    (cells || []).forEach((w, i) => { if(w) rowOf[norm(w)] = Math.floor(i / COLS); });
    return rowOf;
  }

  /* A team's answer from its phones: the MAJORITY ROW PER WORD. Every phone holds
     every tile and arranges all sixteen, so several arrangements are merged by
     asking, for each word, which row the most of that team's phones put it in.
     Solo is a team of one, so its majority is simply its own grid — same code. */
  function mergeRows(cellsList){
    const votes = {};                 // word → { row: count }
    (cellsList || []).forEach(cells => {
      (cells || []).forEach((w, i) => {
        if(!w) return;
        const word = norm(w), row = Math.floor(i / COLS);
        (votes[word] || (votes[word] = {}))[row] = (votes[word][row] || 0) + 1;
      });
    });
    const rowOf = {};
    Object.keys(votes).forEach(word => {
      let best = -1, bestN = 0;
      Object.keys(votes[word]).forEach(r => { if(votes[word][r] > bestN){ bestN = votes[word][r]; best = Number(r); } });
      rowOf[word] = best;
    });
    return rowOf;
  }

  /* Which authored groups are solved by an arrangement: a group is solved when all
     four of its words share ONE row AND that row holds no other word (exactly the
     four). Order-insensitive within and across rows; each 4-set matches at most one
     group, so there is no assignment ambiguity. Returns the solved group indices. */
  function solvedGroups(rowOf, groups){
    rowOf = rowOf || {};
    const perRow = {};
    Object.keys(rowOf).forEach(w => { const r = rowOf[w]; if(r >= 0) perRow[r] = (perRow[r] || 0) + 1; });
    const out = [];
    groups.forEach((g, gi) => {
      const rows = g.words.map(w => rowOf[norm(w)]);
      const r0 = rows[0];
      const allSame = rows.every(r => r != null && r >= 0 && r === r0);
      if(allSame && perRow[r0] === g.words.length) out.push(gi);
    });
    return out;
  }

  K.round.register('connections', {
    label: 'Connections 4×4',
    blurb: 'Sixteen words, four hidden groups of four. The room sorts them into rows — flick or tap.',

    /* Two modes, and the row in ⚙ builds itself from this (declaring `modes` is the
       whole act). `tap` is the default — the accessible face and the no-relay path —
       and `matter` is the physics one, chosen when a class has the phones for it.
       `byRoster` (the hub adds it) keeps teams and individuals on separate choices,
       so a teacher can flick with individuals and tap with teams, or any mix. */
    modes: [
      { value:'tap',    label:'Tap — tap each word into a group' },
      { value:'matter', label:'Flick — throw the words into their groups (physics)' }
    ],
    teamMode: null,
    modeSetting: { group:'Questions', label:'Connections',
                   help:'How the room sorts the sixteen words into four groups.' },

    field: 'connections',
    sample: { text:"Find the four groups of four.",
              connections:{ groups:[
                { label:"Ways of cooking",    words:["grilled","steamed","roasted","fried"] },
                { label:"Done to vegetables", words:["chopped","sliced","peeled","grated"] },
                { label:"Court roles",        words:["judge","jury","witness","clerk"] },
                { label:"Verdicts",           words:["guilty","acquitted","cleared","convicted"] } ] } },

    /* Four groups do not fit grouping's two-field editor, so a custom one: the
       whole puzzle in one field, one group per line as "Label: w, w, w, w". The
       prompt is the other field. */
    editor: {
      /* One line, because the bench's field is a single-line input: the four groups
         separated by “;”, each as “Label: word, word, word, word”. (Newlines work
         too, for anywhere the field is multi-line.) */
      labelA:'The four groups — “Label: w, w, w, w” separated by “;”',
      labelB:null,     // two fields: the prompt (q), and the groups block (a)
      build: (text, a) => ({ text, connections:{ groups: parseGroups(a) } }),
      read: it => ({ q: it.text || '',
                     a: (((it.connections || {}).groups) || [])
                          .map(g => (g.label || '') + ': ' + (g.words || []).join(', ')).join(' ; ') })
    },

    claims(item){ const g = groupsOf(item); return !!(g && g.length); },

    setup(item, ctx){
      const groups = groupsOf(item);
      if(!groups || groups.length !== NG) return null;
      const clean = groups.map(g => ({ label:String(g.label || ''), words:(g.words || []).map(String) }));
      if(clean.some(g => g.words.length !== NG)) return null;
      const words = [];
      clean.forEach(g => g.words.forEach(w => words.push(w)));
      if(words.length !== N) return null;
      const c = ctx || {};
      const mode = (c.mode === 'matter' || c.mode === 'tap') ? c.mode : 'tap';
      return {
        text:   String((item && item.text) || ''),
        groups: clean,
        answer: clean.map(g => g.label + ': ' + g.words.join(', ')).join('  ·  '),
        words:  K.round.shuffle(words.slice()),
        cols:   COLS, rows: ROWS,
        need:   N,
        mode,
        picks:    {},   // team → { rowOf, cells } from read()
        chosen:   [],   // required by the bench plumbing even though a partition uses none of it
        cardCells: [],  // the matter board-face table's current cells (no phones)
        verdictBy: {},
        say: '', done: false
      };
    },

    /* ---------- the projector's view ---------- */
    render(mount, s, ctx){
      const c = ctx || {};
      /* Deliberately NOT cleared at the top: the matter face reuses its live
         `Kit.round.cardTable` canvas across the bench's per-beat re-renders, and a
         clear here would detach it and restart the physics every frame. Each branch
         that builds fresh clears its own mount; the matter branch leaves the canvas
         alone so cardTable's reuse guard can keep it. */

      /* Over → the solved board: the four groups, labelled, each on its own row.
         A static picture never argues with the answer line. */
      if(s.done){
        if(s._canvas){ s._table = null; s._canvas = null; }
        mount.innerHTML = '';
        mount.className = 'round-connections';
        mount.appendChild(groupsBoard(s.groups, s.groups.map((_, i) => i)));
        K.round.say(mount, s);
        return;
      }

      /* Phones present → the board is the room's scoreboard: a lane per competitor,
         four group-slots filling as that competitor solves groups. Same standard
         every played round draws, and `Kit.round.lanes` switches to a counts-only
         leaderboard above five competitors on its own. */
      if(c.roster && c.roster.length){
        if(s._canvas){ s._table = null; s._canvas = null; }
        mount.innerHTML = '';
        mount.className = 'round-connections';
        K.round.lanes(mount, c, {
          kind: 'conn',
          progressed: Object.keys(s.picks || {}),
          lane(t){
            const ans = s.picks[t] || {};
            const solved = solvedGroups(ans.rowOf, s.groups);
            const cells = [];
            for(let i = 0; i < NG; i++){
              if(i < solved.length) cells.push({ got:true, text: s.groups[solved[i]].label });
              else cells.push({ got:false });
            }
            return { cells, count: solved.length + '/' + NG + ' groups', full: solved.length === NG,
                     tone: solved.length === NG ? 'good' : null };
          }
        });
        K.round.say(mount, s);
        return;
      }

      /* No phones → the card IS the play surface. matter: the physics 4×4 grid,
         teacher-flicked. tap: sixteen chips the teacher taps into rows. Either way
         a panel of four group slots lights as rows become valid. */
      if(s.mode === 'matter'){
        K.round.cardTable(mount, s, {
          handle: '__connGrid',
          height: Math.min(460, 150 + ROWS * 64),
          frame(canvas){
            mount.innerHTML = '';
            mount.className = 'round-connections';
            mount.appendChild(canvas);
            mount.appendChild(groupsPanel(s));
          },
          deal(table){
            table.slots({ cols:COLS, rows:ROWS, bar:true, labels:s.words });
            table.setPieces(s.words);
          },
          table: {
            upright: true,
            onArrange(){
              const table = s._table;
              s.cardCells = table.cells().slice();
              s.chosen = s.cardCells.filter(Boolean);   // the bench Check counter reads length
              refreshPanel(mount, s);
            }
          }
        });
        return;
      }

      /* tap, no phones → sixteen chips laid into four rows. Tapping a chip cycles it
         to the next row (0→1→2→3→loose). The teacher's arrangement lives in
         `s.cardCells` (row-major), the same shape the physics face fills, so read()
         and the panel are shared. */
      tapBoard(mount, s, c);
      mount.appendChild(groupsPanel(s));
      K.round.say(mount, s);
    },

    /* ---------- the handsets ---------- */
    arm(s, ctx){
      const c = ctx || {};
      const arm = {
        mode:    'table',
        prompt:  c.prompt === false ? 'Sort the sixteen into four groups'
                                    : (s.text || 'Sort the sixteen into four groups'),
        options: s.words.slice(),
        cols:    s.cols, rows: s.rows, bar: true, upright: true,
        multi:   s.need,
        holds:   true,
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
      /* tap mode → the handset places by tapping, not flicking. Carried unread to
         the relay; join.html's table mode reads it. */
      if(s.mode === 'tap') arm.tap = true;
      return arm;
    },

    /* ---------- the room's replies → one answer per competitor ----------
       Each phone sends its whole 16-cell arrangement (row-major, empties kept). A
       competitor's answer is the majority row per word across its phones. With no
       phones the matter/tap board table IS the input, reported as competitor 0. */
    read(replies, s){
      if(!(replies && replies.length))
        return { 0: { rowOf: rowOfCells(s.cardCells), cells: (s.cardCells || []).slice() } };
      const byTeam = {};
      replies.forEach(r => {
        const t = Number(r && r.team) || 0;
        const cells = String((r && r.value) == null ? '' : r.value).split('|');
        (byTeam[t] || (byTeam[t] = [])).push(cells);
      });
      const out = {};
      Object.keys(byTeam).forEach(t => { out[t] = { rowOf: mergeRows(byTeam[t]) }; });
      return out;
    },

    /* ---------- the verdict ----------
       Count the solved groups in this competitor's arrangement. Right (and over)
       only when all four are solved; incomplete until all sixteen are placed;
       otherwise wrong, carrying how many groups are right so the say line can help. */
    judge(answer, s){
      /* Phones send a merged `{rowOf}`; the teacher's own Check (no phones) sends a
         flat list, so fall back to the board arrangement in `cardCells`, which is
         where both the matter and tap board faces keep the teacher's rows. */
      const rowOf = (answer && answer.rowOf) ? answer.rowOf : rowOfCells(s.cardCells);
      const placed = Object.keys(rowOf).length;
      const solved = solvedGroups(rowOf, s.groups).length;
      if(placed < s.need) return { verdict:'incomplete', hits: solved };
      return { verdict: solved === NG ? 'right' : 'wrong', hits: solved, done: solved === NG };
    },

    check(item){
      const groups = groupsOf(item);
      const bad = [];
      if(!groups) return ['Needs a `connections` block with four groups.'];
      if(groups.length !== NG) bad.push(groups.length + ' groups — needs exactly ' + NG + '.');
      const seen = Object.create(null);
      let total = 0;
      groups.forEach((g, i) => {
        const ws = (g.words || []).map(w => String(w).trim()).filter(Boolean);
        total += ws.length;
        if(ws.length !== NG) bad.push('Group ' + (i + 1) + ' (' + (g.label || '?') + ') has ' + ws.length + ' words — needs ' + NG + '.');
        if(!String(g.label || '').trim()) bad.push('Group ' + (i + 1) + ' has no label — the label is the teaching payoff.');
        ws.forEach(w => {
          const k = w.toLowerCase();
          /* A word in two groups makes the puzzle ambiguous — it could sit in either
             row and both would judge as belonging. */
          if(seen[k]) bad.push('Word appears in two groups: “' + w + '”.');
          seen[k] = true;
        });
      });
      if(total > 20) bad.push(total + ' words, over the relay’s cap of 20 — the phones would be offered fewer than the board shows.');
      /* The prompt must not name a group, which gives a category away. Best-effort:
         flag a prompt that contains a group label verbatim. */
      const q = String((item && item.text) || '').toLowerCase();
      if(!q.trim()) bad.push('Needs a prompt.');
      groups.forEach(g => { const L = String(g.label || '').trim().toLowerCase();
        if(L && q.indexOf(L) !== -1) bad.push('The prompt names a group (“' + g.label + '”) — that gives a category away.'); });
      return bad;
    },

    missNote(r){
      return r.hits === NG - 1 ? 'Three groups right — one row is wrong.' : (r.hits + ' of ' + NG + ' groups.');
    },
    saidOf(who, r){ return who + ': ' + this.missNote(r).toLowerCase(); },

    settleMs: 800
  });

  /* ---------- local view helpers (this round's own; nothing shared yet) ---------- */

  // "Label: w, w, w, w" groups, separated by ";" or newlines → [{label, words}]
  function parseGroups(text){
    return String(text || '').split(/[;\n]+/).map(line => {
      const m = line.split(':');
      if(m.length < 2) return null;
      const label = m.shift().trim();
      const words = K.round.list(m.join(':'));
      return words.length ? { label, words } : null;
    }).filter(Boolean);
  }

  // the solved-board: one row per group, its label and its four words
  function groupsBoard(groups, solvedIdx){
    const wrap = document.createElement('div');
    wrap.className = 'conn-board';
    (solvedIdx || groups.map((_, i) => i)).forEach(gi => {
      const g = groups[gi];
      const row = document.createElement('div');
      row.className = 'conn-grp solved';
      const lab = document.createElement('div');
      lab.className = 'conn-grp-label';
      lab.textContent = g.label;
      row.appendChild(lab);
      const words = document.createElement('div');
      words.className = 'conn-grp-words';
      g.words.forEach(w => { const t = document.createElement('span'); t.className = 'conn-w'; t.textContent = w; words.appendChild(t); });
      row.appendChild(words);
      wrap.appendChild(row);
    });
    return wrap;
  }

  // four group slots that light as rows become valid groups (no-phones board face)
  function groupsPanel(s){
    const panel = document.createElement('div');
    panel.className = 'conn-panel';
    panel.dataset.panel = '1';
    fillPanel(panel, s);
    return panel;
  }
  function fillPanel(panel, s){
    panel.innerHTML = '';
    const rowOf = rowOfCells(s.cardCells);
    const solved = solvedGroups(rowOf, s.groups);
    for(let i = 0; i < NG; i++){
      const slot = document.createElement('div');
      slot.className = 'conn-slot' + (i < solved.length ? ' solved' : '');
      slot.textContent = i < solved.length ? s.groups[solved[i]].label : '· · ·';
      panel.appendChild(slot);
    }
  }
  function refreshPanel(mount, s){
    const panel = mount.querySelector('[data-panel]');
    if(panel) fillPanel(panel, s);
  }

  // the tap board: sixteen chips arranged into four rows; a tap cycles a chip's row
  function tapBoard(mount, s, c){
    mount.innerHTML = '';
    mount.className = 'round-connections';
    // cardCells is row-major over cols*rows; ensure it exists as a fixed-length grid
    if(!Array.isArray(s.cardCells) || s.cardCells.length !== N) s.cardCells = new Array(N).fill('');
    s.chosen = s.cardCells.filter(Boolean);   // the bench Check counter reads length
    const grid = document.createElement('div');
    grid.className = 'conn-tap';
    grid.style.setProperty('--conn-cols', COLS);
    // draw the four rows, each a row of slots; and a loose tray for unplaced words
    const placed = {};
    s.cardCells.forEach(w => { if(w) placed[norm(w)] = true; });
    const rows = document.createElement('div');
    rows.className = 'conn-rows';
    for(let r = 0; r < ROWS; r++){
      const row = document.createElement('div');
      row.className = 'conn-row';
      for(let col = 0; col < COLS; col++){
        const w = s.cardCells[r * COLS + col] || '';
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'conn-cell' + (w ? ' filled' : '');
        cell.textContent = w;
        if(w && c && !s.done) cell.addEventListener('click', () => cycle(mount, s, c, w));
        row.appendChild(cell);
      }
      rows.appendChild(row);
    }
    grid.appendChild(rows);
    // the loose tray
    const tray = document.createElement('div');
    tray.className = 'conn-tray';
    s.words.forEach(w => {
      if(placed[norm(w)]) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'conn-chip';
      chip.textContent = w;
      if(c && !s.done) chip.addEventListener('click', () => place(mount, s, c, w));
      tray.appendChild(chip);
    });
    grid.appendChild(tray);
    mount.appendChild(grid);
  }

  // place a loose word into the first row with a free cell
  function place(mount, s, c, w){
    for(let r = 0; r < ROWS; r++){
      for(let col = 0; col < COLS; col++){
        if(!s.cardCells[r * COLS + col]){ s.cardCells[r * COLS + col] = w; return redrawTap(mount, s, c); }
      }
    }
  }
  // cycle a placed word to the next row (or back to the tray)
  function cycle(mount, s, c, w){
    const at = s.cardCells.indexOf(w);
    if(at === -1) return;
    const row = Math.floor(at / COLS);
    s.cardCells[at] = '';
    const next = row + 1;
    if(next < ROWS){
      for(let col = 0; col < COLS; col++){
        if(!s.cardCells[next * COLS + col]){ s.cardCells[next * COLS + col] = w; break; }
      }
    }
    redrawTap(mount, s, c);
  }
  function redrawTap(mount, s, c){
    tapBoard(mount, s, c);
    mount.appendChild(groupsPanel(s));
    K.round.say(mount, s);
  }

})();
