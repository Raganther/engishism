/* Stack in ten seconds — the third skill round.
   ===============================================
   A handful of loose tiles and a clock. Pile them as high as you can; the height
   of the highest tile AT REST when the clock ends is the answer, as a share of the
   table, so a phone's size never matters. The record ranks by it.

   The clock is the round's own duration on the arm (`secs`), counted on each phone
   from its own paint like every question clock; the phone measures and sends at
   its own buzzer (`tableWire` on the phone, the same measure the card's Check
   takes from the card's table). Physics is the shelf's default table — gravity on,
   tiles rain in and stack — nothing new for this one to declare. */
(function(){
  const K = window.HubKit;
  if(!K || !K.round) return;

  const LETTERS = 'STACKUPHIGH'.split('');
  const parse = v => { const m = String(v == null ? '' : v).match(/h:([0-9.]+)/); return m ? Number(m[1]) : NaN; };
  /* The board face has no wire: what the teacher holds is the pile itself
     (`PILE`), and judging it is measuring it — at Check, so the height is the
     pile's at the click, exactly as a phone's is the pile's at its buzzer. */
  const PILE = 'pile';
  const heightOf = (answer, s) => { const v = (answer || [])[0]; return v === PILE ? measure(s) : parse(v); };
  function result(h){
    const pct = Math.round(Math.max(0, Math.min(1, h)) * 100);
    return { h, score: pct, label: pct + ' high', text: 'stacked to ' + pct + '% of the table' };
  }
  /* the card's own measure, the same rule the phone applies: the top of the
     highest tile at rest, as a share of the canvas */
  function measure(s){
    const t = s._table, cv = s._canvas; if(!t || !cv) return NaN;
    const h = cv.clientHeight; if(!h) return NaN;
    const half = t.tileSize() / 2; let top = h;
    t.loose().forEach(p => { if(Math.abs(p.vx) + Math.abs(p.vy) < 1 && p.y - half < top) top = p.y - half; });
    return Math.max(0, Math.min(1, (h - top) / h));
  }

  K.round.register('stack', {
    label: 'Stack in ten seconds',
    field: 'stack',
    claims: item => !!(item && item.stack),
    sample: { q: 'Stack the tiles as high as you can before the clock ends.', stack: { n: 6, secs: 10 } },
    editor: {
      labelA: 'How many tiles (2–11)', labelB: 'Seconds on the clock',
      build(text, a, b, prev){ return { q: text, stack: { n: Math.max(2, Math.min(11, Number(a) || 6)), secs: Math.max(3, Math.min(60, Number(b) || 10)) } }; },
      read(item){ return { q: item.q || '', a: String((item.stack && item.stack.n) || 6), b: String((item.stack && item.stack.secs) || 10) }; }
    },
    settleMs: 300,
    check(item){ return []; },
    setup(item, ctx){
      if(!item || !item.stack) return null;
      const n = Math.max(2, Math.min(11, Number(item.stack.n) || 6));
      return { text: item.q || item.text || 'Stack the tiles', n, secs: Math.max(3, Math.min(60, Number(item.stack.secs) || 10)),
               labels: LETTERS.slice(0, n),
               need: 1, chosen: [], picks: {}, results: {}, done: false, cardCells: [], verdict: null, mode: 'flick' };
    },

    render(mount, s, ctx){
      const c = ctx || {};
      const face = K.round.face(s, c);
      mount.innerHTML = '';
      if(face === 'board' && !s.done){
        K.round.cardTable(mount, s, { height: 340, say: false,
          deal: table => { table.slots(0); table.setPieces(s.labels); } });
        s.chosen = [PILE];
        const say = document.createElement('p');
        say.className = 'line-say group-say';
        say.textContent = s.say || (s.text + ' — Check reads the pile.');
        mount.appendChild(say);
        return;
      }
      if(s._canvas){ s._canvas.remove(); s._canvas = null; s._table = null; }
      K.round.lanes(mount, c, {
        kind: 'stack',
        lane: t => {
          const r = s.results[t];
          return { cells: r ? [{ text: r.text, got: true }] : [{ text: '', cls: 'gap' }], full: !!r, tone: r ? 'good' : null };
        }
      });
      const say = document.createElement('p');
      say.className = 'line-say group-say';
      say.textContent = s.say || s.text;
      mount.appendChild(say);
    },

    arm(s, ctx){
      const c = ctx || {};
      return { mode: 'table', prompt: c.prompt === false ? 'Stack the tiles' : s.text, options: s.labels,
               stack: { n: s.n }, secs: s.secs,
               bare: true,   // the whole phone screen is the table; the prompt overlays it once
               multi: 1, holds: true, rethink: true,
               team: (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null };
    },
    read(replies, s, ctx){
      if(!(replies && replies.length)) return s.picks || {};
      const picks = {};
      (replies || []).forEach(r => { const h = parse(r && r.value); if(Number.isFinite(h)) picks[Number(r.team) || 0] = ['h:' + h.toFixed(3)]; });
      return picks;
    },
    answerKey: answer => String((answer || [])[0] || ''),
    answerText(answer, s){ const h = heightOf(answer, s); return Number.isFinite(h) ? result(h).text : ''; },
    judge(answer, s, team, ctx){
      const h = heightOf(answer, s);
      if(!Number.isFinite(h)) return { verdict: 'incomplete', hits: 0 };
      const r = result(h);
      return { verdict: 'right', hits: 1, done: true, score: r.score, label: r.label };
    },
    accept(answer, s, team, ctx){
      const h = heightOf(answer, s);
      if(!Number.isFinite(h)) return;
      s.results[team] = result(h);
      const name = (ctx && ctx.teamName) ? ctx.teamName(team) : ('Team ' + (team + 1));
      s.say = name + ' ' + s.results[team].text;
    },
    saidOf(who, r, s){ return who + ' ' + (r.label ? 'stacked ' + r.label : 'stacked'); },
    solution(){ return null; }
  });
})();
