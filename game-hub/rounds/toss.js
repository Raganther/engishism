/* ===================== Toss — the physics anagram round =====================
   Scrambled letters as PHYSICAL tiles you flick around a space and drop into
   answer slots, instead of the careful drag of the `anagram` round. It shares
   that round's content shape (item.anagram.word) — physical, not drag.

   TWO FACES, decided by whether phones are in the room (ctx.roster):

   - **No phones → the card is the play surface.** The round renders a <canvas> into
     the clue card and runs Kit.table on it, operated directly (mouse on the bench,
     touch on a projector — Race is the precedent). The table reports through
     onArrange; the board judges read()===word and tints the slots. This is the
     no-relay / bench path. The clue card is transform:scale()-d, so the
     pointer→canvas conversion divides by the painted/natural ratio; Kit.table
     measures the natural box (offsetWidth), so the two agree. render() is idempotent:
     the bench redraws on every beat, so a live table is reused (re-fitted), not rebuilt.

   - **Phones present → each handset runs its OWN Kit.table** (join.html's `table`
     mode), and the card becomes the scoreboard: a lane per team filling as letters
     land in the right boxes (Kit.round.lanes, exactly as the drag rounds). `arm`
     sends `mode:'table'`; `read` merges the handsets' arrangements with
     Kit.round.arrangement, the same positional |-joined wire the drag rounds use.

   Declares NO `field`/`claims` for now: it is bench-selected (?type=r:toss) and,
   later, routed by an explicit round:'toss' on a bank item.
   ========================================================================== */
(function(){
  'use strict';
  const K = window.HubKit;
  const MAX = 12;

  const clean = w => String(w || '').toUpperCase().replace(/[^A-Z]/g, '');
  // Every letter in a placed sequence is one this word actually has, counted rather
  // than merely present — so a stale reply spelling EEE is dropped against a word
  // holding one E. The drag rounds' `Kit.round.arrangement` calls this as `legal`.
  function fits(seq, word){
    if(!seq.length || seq.length > word.length) return false;
    const left = {};
    word.split('').forEach(ch => { left[ch] = (left[ch] || 0) + 1; });
    return seq.every(ch => (left[ch] = (left[ch] || 0) - 1) >= 0);
  }
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
    // The answer is a SEQUENCE, so the host stamps arrival by the order the letters
    // are in — a team that spells it first, in order, places ahead of one that had the
    // letters earlier but jumbled. The drag rounds set this for the same reason.
    ordered: true,
    settleMs: 600,
    // The workshop editor: one field, the word (same shape as anagram.js), so the
    // bench can build { text, anagram:{ word } } and seed from the sample.
    editor: {
      labelA: 'The word',
      labelB: null,
      build: (text, a) => ({ text, anagram: { word: String(a || '').trim() } }),
      read: it => ({ q: (it && it.text) || '', a: (it && it.anagram && it.anagram.word) || '', b: '' })
    },

    setup(item, ctx){
      const word = clean(item && item.anagram && item.anagram.word);
      if(!/^[A-Z]{3,}$/.test(word) || word.length > MAX) return null;
      return {
        text: String((item && item.text) || 'Spell the word'),
        word, answer: word, need: word.length,
        // A stable scramble, fixed once: the phones spawn exactly these pieces and
        // a reconnect re-arms with the same set, so a restored arrangement lines up.
        pieces: scramble(word),
        mode: (ctx && ctx.mode === 'agree') ? 'agree' : 'first',
        // The lanes' three-way split, kept exactly as the drag rounds keep it.
        picks: {}, leading: {}, votes: {}, by: {}, got: {},
        say: '', cardAnswer: '', verdict: null, done: false, chosen: []
      };
    },

    render(mount, s, ctx){
      const c = ctx || {};
      // **Phones present → they run the physics on their own screens, and the card
      // becomes the scoreboard.** A lane per team fills as letters land in the right
      // boxes — the same standard the drag rounds draw. No canvas here; the students
      // are looking at their hands. (Board-operated / no-relay is the branch below.)
      if(c.roster && c.roster.length){
        if(s._canvas){ s._table = null; s._canvas = null; }   // drop any live board table; clearing the mount stops its loop
        mount.innerHTML = '';
        mount.className = 'round-toss' + (s.mode === 'agree' ? ' agreeing' : '');
        K.round.lanes(mount, c, {
          kind: 'toss',
          progressed: Object.keys(s.got || {}),
          lane(t){
            const row = (s.got || {})[t] || [];
            const need = K.round.mustHold(s.mode, c, t);
            const cells = []; let right = 0;
            for(let i = 0; i < s.need; i++){
              const ok = (row[i] || 0) >= need;
              if(ok) right++;
              cells.push({ got: ok, text: ok ? s.word[i] : '', colour: true });
            }
            return {
              cells,
              count: right + ' of ' + s.need,
              agree: s.mode === 'agree' ? K.round.agreement(s, c, t) : null,
              full: right === s.need
            };
          }
        });
        K.round.say(mount, s);
        return;
      }
      // No phones → board-operated: the physics runs on the card, mouse/touch driven.
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
      table.setPieces(s.pieces);
      table.slots(s.word.length);

      // Pointer → table: the shelf maps client coords into the canvas's NATURAL
      // space (the card is scaled, so the painted/natural ratio divides out).
      const pt = e => table.pt(e);
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

    // **Phones in play → merge every handset's arrangement into one team answer**,
    // positionally, exactly as the drag rounds do (`Kit.round.arrangement`). The wire
    // is |-joined slot letters with gaps preserved — what the phone's `tableWire()`
    // sends. Stashes leading/votes/by/got for the lanes; returns the committed picks.
    // **No phones → the card is the input**, so it reports the card's own arrangement
    // (team 0), judged on the board by the canvas's own onArrange.
    read(replies, s, ctx){
      if(replies && replies.length){
        const p = K.round.arrangement(replies, {
          need:   s.need,
          clean:  x => String(x).toUpperCase(),
          wordAt: i => s.word[i],
          legal:  placed => fits(placed, s.word),
          sizes:  (ctx && ctx.sizes) || [],
          mode:   s.mode
        });
        s.leading = p.leading; s.votes = p.votes; s.by = p.by; s.got = p.got;
        return p.picks;
      }
      return { 0: (s.cardAnswer || '').split('') };
    },
    judge(answer, s){
      const seq = (answer || []).map(x => String(x).toUpperCase());
      if(seq.length !== s.word.length) return { verdict: 'incomplete', hits: 0 };
      const right = seq.join('') === s.word;
      const hits = seq.reduce((n, ch, i) => n + (ch === s.word[i] ? 1 : 0), 0);
      return { verdict: right ? 'right' : 'wrong', hits };
    },

    // What a wrong arrangement is told — the commentary line the host reads on a miss.
    // The engine calls this UNGUARDED (a round without it crashes on the first wrong
    // answer), and it is what the open-question path shows per player. Same shape as
    // anagram's: letters in the right place is the only useful thing to say.
    saidOf(who, r, s){
      if(!r || r.verdict === 'incomplete') return who + ': not finished yet.';
      return who + ': not it — ' + (r.hits || 0) + ' of ' + s.need + ' letters are in the right place.';
    },

    // **The phones run their OWN Kit.table** (join.html's `table` mode). The arm
    // carries the scrambled letters to spawn as pieces; the slot count is the word
    // length. Same shape as the drag round's `arrange`, one word changed — `mode` —
    // because a phone that can't run the physics falls back to plain text, not to a
    // broken screen (join.html's setMode leaves an unknown mode showing nothing new).
    arm(s, ctx){
      const c = ctx || {};
      return {
        mode: 'table',
        prompt: c.prompt === false ? 'Spell the word' : (s.text || 'Spell the word'),
        options: s.pieces, multi: s.word.length, holds: true, rethink: true,
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
