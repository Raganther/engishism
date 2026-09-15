/* ---- Flip's settings, declared apart from the game ----
   Self-registers into `window.HubSettings` on load, so the question bench holds them
   too. Every number here is a guess until a class has met it — which is why the ones
   that change how the game *feels* are marked `quick`.

   The board's whole reason for existing is that a runaway leader is not fun, so the
   two settings that matter most are the steal's share and how thickly the twists are
   spread. Both are meant to be flipped between lessons, not trusted. */
window.registerFlipSettings = function(S){
  S.register({ id:'flipSize', group:'Flip', type:'variant', default:'25', games:['flip'],
    label:'Board size',
    help:'How many cards. A smaller board plays faster and leaves fewer twists in it.',
    variants:[
      {value:'9',  label:'3 × 3 — nine cards'},
      {value:'16', label:'4 × 4 — sixteen cards'},
      {value:'25', label:'5 × 5 — twenty-five cards'}
    ] });

  S.register({ id:'flipPoints', group:'Flip', type:'range', default:100, quick:true,
    min:20, max:500, step:20, unit:'', games:['flip'],
    label:'A card is worth',
    help:'Every card pays the same. What separates them is the twist on the back, not the value.' });

  /* **The mechanic the whole board exists for.** A steal closes this share of the gap
     between the winner and somebody ahead of them, so the size of the correction is
     set by the size of the problem and nothing has to be tuned per class. At ½ the
     steal lands the two level, which reads as dramatic and final; at ⅓ it leaves the
     leader ahead and the chase alive, which is why it is the default. */
  S.register({ id:'flipSteal', group:'Flip', type:'range', default:0.34, quick:true,
    min:0.1, max:0.5, step:0.02, unit:'×', games:['flip'],
    label:'A steal closes this much of the gap',
    help:'You take half of it from them and keep half — so the gap closes by this share and you can never overtake on a steal alone. Only ever upward: the leader cannot steal.' });

  /* Density, not a list of which cards carry what. The game weights the twists toward
     the back rows itself; this only says how many there are to weight. */
  S.register({ id:'flipTwists', group:'Flip', type:'range', default:40, quick:true,
    min:0, max:70, step:10, unit:'%', games:['flip'],
    label:'How many cards carry a twist',
    help:'The rest are plain points. Twists are dealt toward the end of the board, so the game gets more volatile as it goes rather than less. 0 turns the whole mechanic off and leaves a plain quiz board.' });

  /* Removable, asked for by name: trading scores outright is the biggest moment on the
     board and the one most likely to produce a genuinely upset student. One per board
     when it is on; when it is off that card deals as a steal instead. */
  S.register({ id:'flipSwap', group:'Flip', type:'toggle', default:true, quick:true,
    games:['flip'],
    label:'Include the Swap card',
    help:'One card on the board lets whoever wins it trade scores with anyone above them. It is the biggest reversal in the game. Off deals a Steal in its place.' });

  /* **A marked card says something is on it, never what.** With every card identical
     the picker has no decision to make and the room cannot see that the back rows are
     loaded — which is the shape of the whole game, kept secret from the people playing
     it. Which way it plays better is a classroom question, which is why it is a
     switch rather than a decision. */
  S.register({ id:'flipMarked', group:'Flip', type:'toggle', default:true, quick:true,
    games:['flip'],
    label:'Mark the cards that carry a twist',
    help:'A star on the face-down card. It says something will happen, never what — so picking one is a gamble, and the room can see the last rows filling up with them. Off is a completely blind board.' });

  S.register({ id:'flipLastPicks', group:'Flip', type:'toggle', default:true, games:['flip'],
    label:'Last place picks the next card',
    help:'Being behind hands you the board. Off rotates the turn the ordinary way, which lets a strong player keep choosing.' });
};

if(window.HubSettings) window.registerFlipSettings(window.HubSettings);
