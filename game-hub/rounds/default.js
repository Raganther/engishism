/* The default round — an ordinary question, played.
   ==================================================

   Every other round in this folder is a question *shape*: a set of words with four
   that belong together, a scale to order, four options to choose between. This one
   has no shape at all. It wraps a question that was authored as plain text — a gap
   fill, a definition, a word transformation — and says what the handsets do while
   the room answers it.

   **Why it exists, and why it is not a helper.** Until this file, `phoneRound()`
   returning `null` meant "there is no round here, so the phone *mode* decides", and
   the engine carried a branch for the two cases. That branch was the last place the
   app believed a question might not be a round. It is gone: `phoneRoundNow()` falls
   back to this round, so there is always one, and `round_default` is built from the
   `modes` below by exactly the same loop that builds `round_grouping` — the pattern
   that was already working for the five shaped rounds, now covering the other 99%
   of the content. Spec F3.8.16.

   **The four modes are the old `phoneMode` values, unchanged and in the same
   order**, because a teacher must not be able to tell that anything moved. The
   stored value is migrated across in `hub-engine.js`, per game override included.

   **`internal: true` keeps it out of the workshops.** The question bench and
   `dev.html` list `Kit.round.ids()` so a round written next month appears without
   being typed in anywhere — right for a round you author content for, wrong for
   this one, which has no card of its own to draw and no fields to edit. Declared
   rather than filtered by name, so the next round like it needs no code change.

   **It deliberately claims nothing.** `Kit.round.of(item)` still returns null for an
   ordinary question, which is what the content-screen chip, the clue path and the
   content gate all read. A default round that claimed every item would report every
   category in both units as holding rounds, and would push every gap fill through a
   `render()` that does not exist — the card for an ordinary question belongs to
   `Kit.prompt`, and that is the right home for it. What this round owns is the
   room, not the card. */
(function(){
  const K = window.HubKit;
  if(!K || !K.round) return;

  K.round.register('default', {
    label: 'Ordinary question',
    internal: true,

    /* No `field` and no `claims`, so nothing is ever routed here by the item — the
       engine reaches for it by name when a question wants no other round. */

    /* How the row is registered in ⚙. Every other round is offered to the three
       boards that can host one, under Questions; this one applies to every game
       that has phones — which is all five — and belongs beside the other phone
       switches, where a teacher has always found it. Declared here rather than
       special-cased in the engine's registration loop: the loop reads whatever a
       round says about its own setting and falls back to the shaped-round wording
       when a round says nothing. */
    modeSetting: {
      games: '*',
      group: 'Phones',
      label: 'What the phones do',
      help:  'Pick one dynamic to try. Switch between them between rounds and see which your class learns more from.'
    },

    modes: [
      { value:'off',   label:'Nothing — phones idle' },
      { value:'buzz',  label:'Buzz for the floor — fastest thumb wins' },
      { value:'write', label:'Everyone types — no race, you see every answer' },
      /* Not offered in Millionaire for the same reason it never gets an anagram:
         the four options hand you the word, so typing it is a typing race rather
         than a language one. Bingo is offered it — a typed word marks that team's
         square through `onTypedWin`, exactly as it claims a tile elsewhere. */
      { value:'type',  label:'Type it, then buzz — a race to produce the word',
        games:['jeopardy','blockbusters','race','bingo'] }
    ],

    /* An ordinary question is always playable — that is the whole point of a
       default. `setup` succeeds on anything so that `check()` never reports a
       teachable question as broken, which matters because the content gate asks
       every round what is wrong with the items it claims. This one claims none, so
       it is never asked; the honest answer is here anyway. */
    setup(item){ return { item: item || null }; },
    check(){ return []; }
  });
})();
