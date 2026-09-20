/* Stack in ten seconds — the third skill round.
   ===============================================
   A handful of loose tiles and a clock. Pile them as high as you can; the height
   of the highest tile AT REST when the clock ends is the answer, as a share of the
   table, so a phone's size never matters. The record ranks by it.

   The clock is the round's own duration on the arm (`secs`), counted on each phone
   from its own paint like every question clock; the phone measures and sends at
   its own buzzer (`tableWire` on the phone, the same rule `measure` applies to
   the card's table at Check). Physics is the shelf's default table — gravity on,
   tiles rain in and stack — and the round's shape is `Kit.round.skill`'s, so this
   file is the tile count, the clock and the measure. */
(function(){
  const K = window.HubKit;
  if(!K || !K.round) return;

  const LETTERS = 'STACKUPHIGH'.split('');
  const nOf = v => Math.max(2, Math.min(11, Number(v) || 6));
  const secsOf = v => Math.max(3, Math.min(60, Number(v) || 10));

  K.round.skill('stack', {
    label: 'Stack in ten seconds',
    field: 'stack',
    key: 'h',                            // the top of the highest resting tile, a share of the table
    sample: { q: 'Stack the tiles as high as you can before the clock ends.', stack: { n: 6, secs: 10 } },
    editor: {
      labelA: 'How many tiles (2–11)', labelB: 'Seconds on the clock',
      build(text, a, b, prev){ return { q: text, stack: { n: nOf(a), secs: secsOf(b) } }; },
      read(item){ return { q: item.q || '', a: String((item.stack && item.stack.n) || 6), b: String((item.stack && item.stack.secs) || 10) }; }
    },
    state(item){ const n = nOf(item.stack.n); return { n, secs: secsOf(item.stack.secs), labels: LETTERS.slice(0, n) }; },
    result(h){
      const pct = Math.round(Math.max(0, Math.min(1, h)) * 100);
      return { h, score: pct, label: pct + ' high', text: 'stacked to ' + pct + '% of the table' };
    },
    /* The board face holds the whole pile: the tiles rain in, and Check measures
       the top of the highest tile at rest — the rule the phone applies at its buzzer. */
    table: {
      height: 340,
      deal(table, s){ table.slots(0); table.setPieces(s.labels); }
    },
    measure(s){
      const t = s._table, cv = s._canvas; if(!t || !cv) return NaN;
      const h = cv.clientHeight; if(!h) return NaN;
      const half = t.tileSize() / 2; let top = h;
      t.loose().forEach(p => { if(Math.abs(p.vx) + Math.abs(p.vy) < 1 && p.y - half < top) top = p.y - half; });
      return Math.max(0, Math.min(1, (h - top) / h));
    },
    arm: s => ({ options: s.labels, stack: { n: s.n }, secs: s.secs, rethink: true }),
    cue: 'Check reads the pile.',
    tell: (name, r) => name + ' ' + r.text,
    said: (who, r) => who + ' ' + (r.label ? 'stacked ' + r.label : 'stacked')
  });
})();
