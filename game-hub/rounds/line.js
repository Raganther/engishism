/* Flick to the line — the first skill round.
   ============================================
   No question. Each phone gets one tile and a line across the top of its table;
   flick the tile so it stops as close to the line as you can — past it is nothing.
   The round hands back a RESULT, not a right answer: how far short the tile stopped,
   as a share of the table's height, so a phone's own size never matters. The
   record ranks by it (`score` on `results.note` — closest first, anyone past the
   line last) and the card wears the distance where a question round wears a time.

   What this round owes the tiers, and how it pays: it never scores (a skin reads
   the place and says what it is worth — Jeopardy could pay the closest the clue's
   value, Flip could treat a slot like a Box); it never runs a clock (the host's
   question clock rides the arm as ever); it draws its lanes through the shelf.
   The measurement is the shelf's too (`Kit.table`'s `onRest`), so the next skill
   round — Plinko, the stack — reads the same event.

   Two faces, chosen by whether phones are in the room, like every physics round:
   phones → each handset runs the table (`mode:'table'` with `line`), one flick,
   the tile's resting height comes back as `ny:0.6123`; no phones → the card's own
   table, the teacher's finger, one flick for the team on turn. */
(function(){
  const K = window.HubKit;
  if(!K || !K.round) return;

  const AT = 0.28;                       // the line's default height: a share from the top
  const PAST = -1000;                    // past the line ranks below every short stop

  /* A reply is the tile's resting centre as a share of the table's height. */
  const parse = v => { const m = String(v == null ? '' : v).match(/ny:([0-9.]+)/); return m ? Number(m[1]) : NaN; };
  /* The result: short of the line by so many hundredths of the table, or past it. */
  function result(ny, at){
    const gap = ny - at;                // positive = short of the line
    const over = gap < 0;
    const cm = Math.round(Math.abs(gap) * 100);
    return { over, gap, score: over ? PAST - cm : -cm,
             /* the pill's word is short — it shares a fixed column with the place —
                and the lane's cell says it in full */
             label: over ? 'past' : (cm === 0 ? 'on it' : cm + ' short'),
             text:  over ? 'past the line' : (cm === 0 ? 'on the line' : cm + ' short of the line') };
  }

  K.round.register('line', {
    label: 'Flick to the line',
    field: 'line',
    claims: item => !!(item && item.line),
    sample: { q: 'Flick the tile as close to the line as you can. Past it is nothing.', line: { at: AT } },
    /* The workshop's two fields: the words on the card, and where the line sits as
       a share of the table's height from the top. */
    editor: {
      labelA: 'Line height, 0.05–0.95 from the top', labelB: null,
      build(text, a, b, prev){ const at = Number(a); return { q: text, line: { at: (at > 0.05 && at < 0.95) ? at : AT } }; },
      read(item){ return { q: item.q || '', a: String((item.line && item.line.at) || AT) }; }
    },
    settleMs: 300,
    check(item){
      const at = Number(item && item.line && item.line.at);
      if(item.line && item.line.at != null && !(at > 0.05 && at < 0.95)) return ['the line must sit between 0.05 and 0.95 of the table\'s height'];
      return [];
    },
    setup(item, ctx){
      if(!item || !item.line) return null;
      const at = Number(item.line.at);
      return { text: item.q || item.text || 'Flick the tile to the line',
               at: (at > 0.05 && at < 0.95) ? at : AT,
               need: 1, chosen: [], picks: {}, results: {}, done: false, cardCells: [], verdict: null, mode: 'flick' };
    },

    /* ---------- the card ---------- */
    render(mount, s, ctx){
      const c = ctx || {};
      const face = K.round.face(s, c);
      /* The card is redrawn whole; a live table survives it (cardTable re-hangs its
         own canvas), and the phones face has no table on the card at all. */
      mount.innerHTML = '';
      /* No phones: the card IS the table — one tile, the line, the teacher flicks
         for the team on turn; the rest reads exactly as a phone's reply would. */
      if(face === 'board' && !s.done){
        const team = (c.team == null ? (c.forTeam || 0) : c.team);
        K.round.cardTable(mount, s, {
          height: 300, say: false,
          table: { line: s.at, onRest: r => {
            if(s.done) return;
            s.picks[team] = ['ny:' + r.ny.toFixed(4)];
            mount.dispatchEvent(new CustomEvent('round:arranged', { bubbles: true }));
          } },
          /* a shuffleboard: no gravity, some drag, one tile at rest at the bottom */
          deal: table => { table.slots(0); table.setPieces([]); table.setFeel({ gravity: 0, frictionAir: 0.045 });
                           table.addPiece('GO', { x: s._canvas.clientWidth / 2, y: s._canvas.clientHeight * 0.86, vx: 0, vy: 0 }); }
        });
        const say = document.createElement('p');
        say.className = 'line-say group-say';
        say.textContent = s.say || (s.text + ' — flick the tile.');
        mount.appendChild(say);
        return;
      }
      /* Phones (or the finished board): a lane per competitor, the result in it. */
      if(s._canvas){ s._canvas.remove(); s._canvas = null; s._table = null; }
      K.round.lanes(mount, c, {
        kind: 'line',
        lane: t => {
          const r = s.results[t];
          return { cells: r ? [{ text: r.text, got: !r.over, cls: r.over ? 'over' : '' }] : [{ text: '', cls: 'gap' }],
                   full: !!r && !r.over, tone: r ? (r.over ? 'bad' : 'good') : null };
        }
      });
      const say = document.createElement('p');
      say.className = 'line-say group-say';
      say.textContent = s.say || s.text;
      mount.appendChild(say);
    },

    /* ---------- the phones ---------- */
    arm(s, ctx){
      const c = ctx || {};
      return {
        mode: 'table', prompt: c.prompt === false ? 'Flick the tile to the line' : s.text,
        options: ['GO'],
        line: s.at,                        // the shelf paints it; the relay carries it
        multi: 1, holds: true, rethink: false,
        team: (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },
    read(replies, s, ctx){
      if(!(replies && replies.length)) return s.picks || {};
      const picks = {};
      (replies || []).forEach(r => {
        const ny = parse(r && r.value);
        if(!Number.isFinite(ny)) return;
        const t = Number(r.team) || 0;
        picks[t] = ['ny:' + ny.toFixed(4)];
      });
      return picks;
    },
    answerKey: answer => String((answer || [])[0] || ''),
    answerText(answer, s){ const ny = parse((answer || [])[0]); return Number.isFinite(ny) ? result(ny, s.at).text : ''; },
    judge(answer, s, team, ctx){
      const ny = parse((answer || [])[0]);
      if(!Number.isFinite(ny)) return { verdict: 'incomplete', hits: 0 };
      const r = result(ny, s.at);
      /* Every measured flick "finishes": the ranking is the score, not the verdict. */
      return { verdict: 'right', hits: 1, done: true, score: r.score, label: r.label };
    },
    accept(answer, s, team, ctx){
      const ny = parse((answer || [])[0]);
      if(!Number.isFinite(ny)) return;
      s.results[team] = Object.assign({ ny }, result(ny, s.at));
      const name = (ctx && ctx.teamName) ? ctx.teamName(team) : ('Team ' + (team + 1));
      s.say = name + ': ' + s.results[team].text;
    },
    saidOf(who, r, s){ return who + ' stopped ' + (r.label || 'somewhere'); },
    /* The read-out for the room bench's Autopilot: nothing to hand a robot — a flick
       is a finger — so the bench leaves this round to a person. */
    solution(){ return null; }
  });
})();
