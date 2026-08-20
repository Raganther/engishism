/* ===================== Toss — the physics anagram round =====================
   Scrambled letters as PHYSICAL tiles you flick around a space and drop into
   answer slots, instead of the careful drag of the `anagram` round. It shares
   that round's content shape (item.anagram.word) — physical, not drag.

   The card IS the play surface here: the round renders a <canvas> into the clue
   card and runs Kit.table on it, operated directly (mouse on the bench, touch on
   a projector — Race is the precedent for a board-operated round). The table
   reports the arrangement through onArrange; this round judges read()===word and
   tints the slots. No lanes, no team bar — the canvas owns the card.

   The clue card is transform:scale()-d, so the pointer→canvas conversion divides
   by the painted/natural ratio; Kit.table measures the natural box (offsetWidth),
   so the two agree. render() is idempotent: the bench redraws on every beat, so a
   live table is reused (just re-fitted) rather than rebuilt.

   Declares NO `field`/`claims` for now: it is bench-selected (?type=r:toss) and,
   later, routed by an explicit round:'toss' on a bank item. `arm` falls back to
   the existing drag-anagram phone dynamic until join.html gains a `table` mode
   (step 4), so phones are not dead.
   ========================================================================== */
(function(){
  'use strict';
  const K = window.HubKit;
  const MAX = 12;

  const clean = w => String(w || '').toUpperCase().replace(/[^A-Z]/g, '');
  function scramble(word){                 // shelf shuffle, retried until it isn't the answer
    const chars = word.split('');
    let out = K.round.shuffle(chars.slice());
    for(let n = 0; n < 12 && word.length > 1 && out.join('') === word; n++) out = K.round.shuffle(chars.slice());
    return out;
  }

  K.round.register('toss', {
    label: 'Toss',
    blurb: 'Scrambled letters as physical tiles — flick them into the slots to spell the word.',
    sample: { text: 'the decision a jury delivers', anagram: { word: 'verdict' } },
    modes: [ K.round.mode.first, K.round.mode.agree ],
    teamMode: 'agree',
    settleMs: 600,
    // The workshop editor: one field, the word (same shape as anagram.js), so the
    // bench can build { text, anagram:{ word } } and seed from the sample.
    editor: {
      labelA: 'The word',
      labelB: null,
      build: (text, a) => ({ text, anagram: { word: String(a || '').trim() } }),
      read: it => ({ q: (it && it.text) || '', a: (it && it.anagram && it.anagram.word) || '', b: '' })
    },

    setup(item){
      const word = clean(item && item.anagram && item.anagram.word);
      if(!/^[A-Z]{3,}$/.test(word) || word.length > MAX) return null;
      return {
        text: String((item && item.text) || 'Spell the word'),
        word, answer: word,
        cardAnswer: '', verdict: null, done: false, chosen: []
      };
    },

    render(mount, s, ctx){
      // Reuse the live table if its canvas is still mounted — the bench calls
      // render on every beat, and rebuilding would restart the physics.
      if(s._table && s._canvas && s._canvas.isConnected){ s._table.resize(); return; }
      mount.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.className = 'toss-canvas';
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '340px';
      canvas.style.touchAction = 'none';
      mount.appendChild(canvas);
      s._canvas = canvas;

      const table = K.table({
        canvas, size: 64,
        onArrange(read, full){
          s.cardAnswer = read;
          const res = full ? (read === s.word ? 'right' : 'wrong') : null;
          s.verdict = res; s.done = (res === 'right');
          table.setResult(res);
        }
      });
      s._table = table;
      table.setPieces(scramble(s.word));
      table.slots(s.word.length);

      // Pointer → table, converting client coords into the canvas's NATURAL space:
      // the card is scaled, so divide the painted offset by the painted/natural ratio.
      function pt(e){
        const r = canvas.getBoundingClientRect();
        const scale = (r.width / canvas.offsetWidth) || 1;
        return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
      }
      canvas.addEventListener('pointerdown', e => {
        const p = pt(e);
        if(table.grab(e.pointerId, p.x, p.y)) canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', e => { if(table.heldBy(e.pointerId)){ const p = pt(e); table.move(e.pointerId, p.x, p.y); } });
      function end(e){ if(table.heldBy(e.pointerId)){ table.drop(e.pointerId); try{ canvas.releasePointerCapture(e.pointerId); }catch(_){} } }
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);

      // Self-driving loop; stops itself when the canvas leaves the DOM (new question).
      (function loop(){ if(!canvas.isConnected) return; table.step(); table.draw(); requestAnimationFrame(loop); })();
      // Size after layout — the card scales AFTER render (fitAll), and may mount
      // before it is visible, so re-fit on the next frame, guarded by isConnected.
      requestAnimationFrame(() => { if(canvas.isConnected) table.resize(); });
      table.resize();
    },

    // The card is the input, so read() reports the card's own arrangement (team 0).
    read(replies, s){ return { 0: (s.cardAnswer || '').split('') }; },
    judge(answer, s){
      const seq = (answer || []).map(x => String(x).toUpperCase());
      if(seq.length !== s.word.length) return { verdict: 'incomplete', hits: 0 };
      const right = seq.join('') === s.word;
      const hits = seq.reduce((n, ch, i) => n + (ch === s.word[i] ? 1 : 0), 0);
      return { verdict: right ? 'right' : 'wrong', hits };
    },

    // Phone fallback: the existing drag-anagram, until join.html gains a table mode (step 4).
    arm(s, ctx){
      const c = ctx || {};
      return {
        mode: 'arrange',
        prompt: c.prompt === false ? 'Spell the word' : (s.text || 'Spell the word'),
        options: scramble(s.word), multi: s.word.length, holds: true, rethink: true,
        team: (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    check(item){
      const word = clean(item && item.anagram && item.anagram.word);
      const errs = [];
      if(!word) errs.push('Toss needs an anagram.word.');
      else if(!/^[A-Z]{3,}$/.test(word)) errs.push('The word must be letters only, at least three.');
      else if(word.length > MAX) errs.push('The word is too long (max ' + MAX + ' letters).');
      if(word && item && item.text && String(item.text).toUpperCase().indexOf(word) !== -1) errs.push('The clue gives the word away.');
      return errs;
    }
  });
})();
