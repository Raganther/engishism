/* Flick to the line — the first skill round.
   ============================================
   No question. Each phone gets one tile and a line across the top of its table;
   flick the tile so it stops as close to the line as you can — past it is nothing.
   The result is how far short the tile stopped, as a share of the table's height,
   so a phone's own size never matters. The record ranks by it (closest first,
   anyone past the line last) and the card wears the distance where a question
   round wears a time.

   Everything a skill round shares — the two faces, the rest as the held answer,
   the read/judge/accept shape, the lanes, the arm — is `Kit.round.skill`'s. What
   is here is the line: where it sits, what a rest means against it, and the
   shuffleboard the board face plays on (no gravity, some drag). The measurement
   is the shelf's (`Kit.table`'s `onRest`, its `line`). */
(function(){
  const K = window.HubKit;
  if(!K || !K.round) return;

  const AT = 0.28;                       // the line's default height: a share from the top
  const PAST = -1000;                    // past the line ranks below every short stop
  const atOf = v => { const at = Number(v); return (at > 0.05 && at < 0.95) ? at : AT; };

  K.round.skill('line', {
    label: 'Flick to the line',
    field: 'line',
    key: 'ny', digits: 4,                // the tile's resting centre, a share of the table's height
    sample: { q: 'Flick the tile as close to the line as you can. Past it is nothing.', line: { at: AT } },
    /* The workshop's two fields: the words on the card, and where the line sits as
       a share of the table's height from the top. */
    editor: {
      labelA: 'Line height, 0.05–0.95 from the top', labelB: null,
      build(text, a, b, prev){ return { q: text, line: { at: atOf(a) } }; },
      read(item){ return { q: item.q || '', a: String((item.line && item.line.at) || AT) }; }
    },
    check(item){
      const at = Number(item && item.line && item.line.at);
      if(item.line && item.line.at != null && !(at > 0.05 && at < 0.95)) return ['the line must sit between 0.05 and 0.95 of the table\'s height'];
      return [];
    },
    state(item){ return { at: atOf(item.line.at) }; },
    /* The result: short of the line by so many hundredths of the table, or past it. */
    result(ny, s){
      const gap = ny - s.at;             // positive = short of the line
      const over = gap < 0;
      const cm = Math.round(Math.abs(gap) * 100);
      return { score: over ? PAST - cm : -cm, good: !over, over, gap,
               /* the pill's word is short — it shares a fixed column with the place —
                  and the lane's cell says it in full */
               label: over ? 'past' : (cm === 0 ? 'on it' : cm + ' short'),
               text:  over ? 'past the line' : (cm === 0 ? 'on the line' : cm + ' short of the line') };
    },
    /* The board face: a shuffleboard — one tile at rest at the bottom, the line
       painted by the shelf, the teacher's flick for the team on turn. */
    table: {
      height: 300,
      opts: s => ({ line: s.at }),
      deal(table, s){ table.slots(0); table.setPieces([]); table.setFeel({ gravity: 0, frictionAir: 0.045 });
                      table.addPiece('GO', { x: s._canvas.clientWidth / 2, y: s._canvas.clientHeight * 0.86, vx: 0, vy: 0 }); },
      rest: r => r.ny
    },
    arm: s => ({ line: s.at }),          // the shelf paints it; the relay carries it
    cue: 'flick the tile.',
    said: (who, r) => who + ' stopped ' + (r.label || 'somewhere')
  });
})();
