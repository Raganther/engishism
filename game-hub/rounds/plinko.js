/* Plinko drop — the second skill round.
   ======================================
   A chip on a ledge at the top, a field of pegs, a row of bins along the bottom
   with a worth written in each. Pull the chip off the ledge and let go; gravity
   and the pegs decide, with the skill in where you let go and how you nudge it.
   The result is the bin it came to rest in; the record ranks by the bin's worth.

   Everything physical is the shelf's (`Kit.table`: `pegs`, `bins`, `binOf`,
   `ledge`, a round `addPiece`, the rest event) and everything a skill round
   shares is `Kit.round.skill`'s, so this file is the bins' worth and the
   sentences. No scoring here — a skin reads the place, or the bin's worth off
   the result, and says what it pays. */
(function(){
  const K = window.HubKit;
  if(!K || !K.round) return;

  const BINS = ['0', '1', '3', '5', '3', '1', '0'];
  const binsOf = list => (Array.isArray(list) && list.length >= 2) ? list.map(String).slice(0, 12) : BINS.slice();
  const rowsOf = n => Math.max(2, Math.min(12, Number(n) || 6));
  const worthOf = (bins, i) => { const n = Number(bins[i]); return Number.isFinite(n) ? n : (bins.length - Math.abs(i - (bins.length - 1) / 2)); };

  K.round.skill('plinko', {
    label: 'Plinko drop',
    field: 'plinko',
    key: 'bin', digits: 0,               // the bin the chip came to rest in
    sample: { q: 'Drop the chip. Where it lands is what you get.', plinko: { bins: BINS.slice(), rows: 6 } },
    editor: {
      labelA: 'Bins, left to right — a worth each, commas between', labelB: 'Peg rows',
      build(text, a, b, prev){ return { q: text, plinko: { bins: binsOf(K.round.list(a)), rows: rowsOf(b) } }; },
      read(item){ return { q: item.q || '', a: ((item.plinko && item.plinko.bins) || BINS).join(', '), b: String((item.plinko && item.plinko.rows) || 6) }; }
    },
    check(item){
      const bins = item && item.plinko && item.plinko.bins;
      if(bins && (!Array.isArray(bins) || bins.length < 2)) return ['needs at least two bins'];
      return [];
    },
    state(item){ return { bins: binsOf(item.plinko.bins), rows: rowsOf(item.plinko.rows) }; },
    result(i, s){
      if(i < 0 || i >= s.bins.length) return null;
      const w = worthOf(s.bins, i);
      return { bin: i, worth: w, score: w, good: w > 0, label: String(s.bins[i]),
               text: 'landed in ' + s.bins[i] };
    },
    /* The board face: the field and the bins, one chip on the ledge, the rest
       reported as the bin under it. */
    table: {
      height: 380,
      deal(table, s){ table.slots(0); table.setPieces([]); table.pegs({ rows: s.rows, shelf: true }); table.bins(s.bins);
                      const at = table.ledge(); table.addPiece('●', { x: at.x, y: at.y, vx: 0, vy: 0, round: true }); },
      rest: (r, s) => s._table.binOf(r.x)
    },
    arm: s => ({ options: ['●'], plinko: { rows: s.rows, bins: s.bins } }),
    cue: 'pull the chip off the ledge.',
    tell: (name, r) => name + ' ' + r.text,
    said: (who, r) => who + ' ' + (r.label ? 'landed in ' + r.label : 'dropped')
  });
})();
