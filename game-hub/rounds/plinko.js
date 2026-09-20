/* Plinko drop — the second skill round.
   ======================================
   A chip on a ledge at the top, a field of pegs, a row of bins along the bottom
   with a worth written in each. Pull the chip off the ledge and let go; gravity
   and the pegs decide, with the skill in where you let go and how you nudge it.
   The result is the bin it came to rest in; the record ranks by the bin's worth.

   Everything physical is the shelf's (`Kit.table`: `pegs`, `bins`, `binOf`, a
   round `addPiece`, the rest event), so this file is the bins' worth and the
   sentences. No scoring here — a skin reads the place, or the bin's worth off the
   result, and says what it pays. */
(function(){
  const K = window.HubKit;
  if(!K || !K.round) return;

  const BINS = ['0', '1', '3', '5', '3', '1', '0'];
  const parse = v => { const m = String(v == null ? '' : v).match(/bin:(\d+)/); return m ? Number(m[1]) : NaN; };
  const worthOf = (bins, i) => { const n = Number(bins[i]); return Number.isFinite(n) ? n : (bins.length - Math.abs(i - (bins.length - 1) / 2)); };
  function result(i, bins){
    const w = worthOf(bins, i);
    return { bin: i, worth: w, score: w, label: String(bins[i] != null ? bins[i] : i + 1),
             text: 'landed in ' + (bins[i] != null ? bins[i] : ('bin ' + (i + 1))) };
  }

  K.round.register('plinko', {
    label: 'Plinko drop',
    field: 'plinko',
    claims: item => !!(item && item.plinko),
    sample: { q: 'Drop the chip. Where it lands is what you get.', plinko: { bins: BINS.slice(), rows: 6 } },
    editor: {
      labelA: 'Bins, left to right — a worth each, commas between', labelB: 'Peg rows',
      build(text, a, b, prev){
        const bins = String(a || '').split(',').map(x => x.trim()).filter(Boolean);
        return { q: text, plinko: { bins: bins.length >= 2 ? bins.slice(0, 12) : BINS.slice(), rows: Math.max(2, Math.min(12, Number(b) || 6)) } };
      },
      read(item){ return { q: item.q || '', a: ((item.plinko && item.plinko.bins) || BINS).join(', '), b: String((item.plinko && item.plinko.rows) || 6) }; }
    },
    settleMs: 300,
    check(item){
      const bins = item && item.plinko && item.plinko.bins;
      if(bins && (!Array.isArray(bins) || bins.length < 2)) return ['needs at least two bins'];
      return [];
    },
    setup(item, ctx){
      if(!item || !item.plinko) return null;
      const bins = (Array.isArray(item.plinko.bins) && item.plinko.bins.length >= 2) ? item.plinko.bins.map(String).slice(0, 12) : BINS.slice();
      return { text: item.q || item.text || 'Drop the chip', bins, rows: Math.max(2, Math.min(12, Number(item.plinko.rows) || 6)),
               need: 1, chosen: [], picks: {}, results: {}, done: false, cardCells: [], verdict: null, mode: 'flick' };
    },

    render(mount, s, ctx){
      const c = ctx || {};
      const face = K.round.face(s, c);
      mount.innerHTML = '';
      if(face === 'board' && !s.done){
        const team = (c.team == null ? (c.forTeam || 0) : c.team);
        K.round.cardTable(mount, s, {
          height: 380, say: false,
          table: { onRest: r => {
            if(s.done) return;
            s.picks[team] = ['bin:' + s._table.binOf(r.x)];
            s.chosen = s.picks[team].slice();   // the board's Check judges what is held, and a rest is it
            mount.dispatchEvent(new CustomEvent('round:arranged', { bubbles: true }));
          } },
          deal: table => { table.slots(0); table.setPieces([]); table.pegs({ rows: s.rows, shelf: true }); table.bins(s.bins);
                           const at = table.ledge(); table.addPiece('●', { x: at.x, y: at.y, vx: 0, vy: 0, round: true }); }
        });
        const say = document.createElement('p');
        say.className = 'line-say group-say';
        say.textContent = s.say || (s.text + ' — pull the chip off the ledge.');
        mount.appendChild(say);
        return;
      }
      if(s._canvas){ s._canvas.remove(); s._canvas = null; s._table = null; }
      K.round.lanes(mount, c, {
        kind: 'plinko',
        lane: t => {
          const r = s.results[t];
          return { cells: r ? [{ text: r.text, got: r.worth > 0, cls: r.worth > 0 ? '' : 'over' }] : [{ text: '', cls: 'gap' }],
                   full: !!r && r.worth > 0, tone: r ? (r.worth > 0 ? 'good' : 'bad') : null };
        }
      });
      const say = document.createElement('p');
      say.className = 'line-say group-say';
      say.textContent = s.say || s.text;
      mount.appendChild(say);
    },

    arm(s, ctx){
      const c = ctx || {};
      return { mode: 'table', prompt: c.prompt === false ? 'Drop the chip' : s.text, options: ['●'],
               plinko: { rows: s.rows, bins: s.bins },
               bare: true,   // the whole phone screen is the table; the prompt overlays it once
               multi: 1, holds: true, rethink: false,
               team: (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null };
    },
    read(replies, s, ctx){
      if(!(replies && replies.length)) return s.picks || {};
      const picks = {};
      (replies || []).forEach(r => { const i = parse(r && r.value); if(Number.isFinite(i)) picks[Number(r.team) || 0] = ['bin:' + i]; });
      return picks;
    },
    answerKey: answer => String((answer || [])[0] || ''),
    answerText(answer, s){ const i = parse((answer || [])[0]); return Number.isFinite(i) ? result(i, s.bins).text : ''; },
    judge(answer, s, team, ctx){
      const i = parse((answer || [])[0]);
      if(!Number.isFinite(i) || i < 0 || i >= s.bins.length) return { verdict: 'incomplete', hits: 0 };
      const r = result(i, s.bins);
      return { verdict: 'right', hits: 1, done: true, score: r.score, label: r.label };
    },
    accept(answer, s, team, ctx){
      const i = parse((answer || [])[0]);
      if(!Number.isFinite(i)) return;
      s.results[team] = result(i, s.bins);
      const name = (ctx && ctx.teamName) ? ctx.teamName(team) : ('Team ' + (team + 1));
      s.say = name + ' ' + s.results[team].text;
    },
    saidOf(who, r, s){ return who + ' ' + (r.label ? 'landed in ' + r.label : 'dropped'); },
    solution(){ return null; }
  });
})();
