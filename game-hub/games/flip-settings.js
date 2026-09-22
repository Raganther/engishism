/* ---- Flip's settings, declared apart from the game ----
   Self-registers into `window.HubSettings` on load, so the question bench holds them
   too. Every number here is a guess until a class has met it — which is why the ones
   that change how the game *feels* are marked `quick`.

   The board's whole reason for existing is that a runaway leader is not fun, so the
   two settings that matter most are the steal's share and how thickly the twists are
   spread. Both are meant to be flipped between lessons, not trusted. */
window.registerFlipSettings = function(S){
  /* **A ruleset for the room you actually have.** The standard rules balance a mixed
     class; a class with one student far out in front needs the comeback devices turned
     well up, and the balance bench (`tools/party-sim.js`) is where the numbers came
     from: under the standard rules a 90% player beat two 40% players ten games out of
     ten; with catch-up 4, steal 0.8 and twists 80% they won six, the lead changed hands
     nine times a game and every game finished close. Picking one WRITES the three rows
     below, so they always say what will happen and any of them can be changed after. */
  /* The bundles' numbers and labels live on the twist shelf (`HubTwist.rulesets`), the
     one home the party lobby's switch reads too; this row only maps them onto the
     settings ids. The shelf loads before every settings file in the shells and the
     question bench. */
  const RS = (window.HubTwist || {}).rulesets;
  if(!RS) throw new Error('flip-settings: hub-twist.js must load before this file');
  S.register({ id:'flipRules', group:'Flip', type:'variant', default:'mixed', games:['flip'],
    label:'Rules',
    help:'A whole balance at once. Picking one writes the three comeback settings below — so they always say what will actually happen, and you can still change any of them afterwards.',
    variants: Object.keys(RS).map(k => ({ value:k, label:RS[k].label })) });

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
     steal lands the two level — a class said ⅓ "feels like you should take more", so
     ½ is the default and the slider runs past it. A device seeded with ⅓ is migrated
     once in hub-engine.js (`migrateFlipClassRun`). */
  S.register({ id:'flipSteal', group:'Flip', type:'range', default:0.5, quick:true,
    min:0.1, max:0.8, step:0.02, unit:'×', games:['flip'],
    label:'A steal closes this much of the gap',
    help:'You take half of it from them and keep half — so the gap closes by this share and you can never overtake on a steal alone. Only ever upward: the leader cannot steal.' });

  /* Density, not a list of which cards carry what. The game weights the twists toward
     the back rows itself; this only says how many there are to weight. 60% by default —
     at 40% a leader could coast through the end of the board; a device seeded with 40
     is migrated once in hub-engine.js (`migrateFlipTwists`). */
  S.register({ id:'flipTwists', group:'Flip', type:'range', default:60, quick:true,
    min:0, max:90, step:10, unit:'%', games:['flip'],
    label:'How many cards carry a twist',
    help:'The rest are plain points. Twists are dealt toward the end of the board, so the game gets more volatile as it goes rather than less. 0 turns the whole mechanic off and leaves a plain quiz board.' });

  /* Removable, asked for by name: trading scores outright is the biggest moment on the
     board and the one most likely to produce a genuinely upset student. One per board
     when it is on; when it is off that card deals as a steal instead. */
  S.register({ id:'flipSwap', group:'Flip', type:'toggle', default:true, quick:true,
    games:['flip'],
    label:'Include the Swap card',
    help:'One card on the board lets whoever wins it trade scores with anyone above them. It is the biggest reversal in the game. Off deals a Steal in its place.' });
  /* A swap with the person directly above is small and frequent; a swap with the
     leader is the cliff a class found disheartening. */
  S.register({ id:'flipSwapScope', group:'Flip', type:'select', default:'next', under:'flipSwap',
    games:['flip'],
    label:'A swap reaches',
    help:'Next above only keeps it a leapfrog — one place, never a cliff. Anyone above is the full reversal.',
    options:[{value:'next',label:'The person directly above'},{value:'any',label:'Anyone above'}] });

  /* **A marked card says something is on it, never what.** With every card identical
     the picker has no decision to make and the room cannot see that the back rows are
     loaded — which is the shape of the whole game, kept secret from the people playing
     it. Which way it plays better is a classroom question, which is why it is a
     switch rather than a decision. */
  S.register({ id:'flipMarked', group:'Flip', type:'toggle', default:true, quick:true,
    games:['flip'],
    label:'Mark the cards that carry a twist',
    help:'A star on the face-down card. It says something will happen, never what — so picking one is a gamble, and the room can see the last rows filling up with them. Off is a completely blind board.' });

  /* **Help comes from being behind, not from winning a card.** A class showed that
     every comeback card only helps whoever just won it — which is rarely the student
     at the bottom. These two are automatic, scale with the gap, and name nobody. */
  /* Off by default (1): every player earns the same for the same card — the
     teacher's call; the Runaway ruleset still turns it up. */
  S.register({ id:'flipCatchUp', group:'Flip', type:'range', default:1, quick:true,
    min:1, max:5, step:0.1, unit:'×', games:['flip'],
    label:'Behind earns more',
    help:'What last place earns for a right answer, as a multiple of what the leader earns for the same card. Everyone in between is on a slope by the gap. 1 turns it off.' });
  /* Off by default: with the clocks visible on every phone and every pill, the wait
     read as the board and the phones disagreeing, and the slider is the fairer place
     for that decision than a default. A device seeded with 2 is migrated once in
     hub-engine.js (`migrateFlipHeadStart`). */
  S.register({ id:'flipHeadStart', group:'Flip', type:'range', default:0, quick:true,
    min:0, max:5, step:0.5, unit:'s', games:['flip'],
    label:'Head start for whoever is behind',
    help:'With phones in the room, the leader\'s handset shows the question this many seconds after last place\'s; everyone between is on a slope by the gap. Their stopwatch is charged the wait, so the head start is real — and the wait shows beside their time on the phone and the card. 0 is off. Nothing happens without phones.' });

  /* A twist that aims at the leader by rule, not by a chooser: whoever beats their
     time takes a bite of the lead. Everyone below has a target; the leader feels it. */
  S.register({ id:'flipBounty', group:'Flip', type:'toggle', default:true, quick:true,
    games:['flip'],
    label:'Include the Bounty card',
    help:'One card on the board puts a price on the leader: everyone who finishes it ahead of the leader takes a share of the gap off them. Aimed by the rules, never by a vote or a pick.' });

  /* **Loaded boxes.** A twist card whose winner opens one of three closed boxes — a
     prize or a forfeit — from a bag loaded by their PLACE: mostly prizes at the bottom
     of the table, mostly forfeits at the top. The one twist that is a choice and a
     gamble at once, and it still helps by position rather than by winning. */
  S.register({ id:'flipBoxes', group:'Flip', type:'toggle', default:true, quick:true,
    games:['flip'],
    label:'Include the Box cards',
    help:'Every third twist after the named ones is a Box: win it and drop a Plinko chip on your phone, the board showing the drop. Seven bins hold Double, Steal, Shield or Pick again — or Share, Lose a turn or Empty — dealt by your place.' });
  S.register({ id:'flipBoxLoad', group:'Flip', type:'range', default:0.7, quick:true, under:'flipBoxes',
    min:0, max:1, step:0.1, unit:'', games:['flip'],
    label:'How loaded the boxes are',
    help:'0 deals a fair board for everyone. At 1 last place sees a board of prizes and the leader a board of forfeits. Everyone between is on the slope.' });

  /* Off by default: a class read "last place picks" as naming the loser every turn,
     not as help. The switch stays for a room that likes it. A device seeded with the
     old default is migrated once in hub-engine.js (`migrateFlipClassRun`). */
  S.register({ id:'flipLastPicks', group:'Flip', type:'toggle', default:false, games:['flip'],
    label:'Last place picks the next card',
    help:'Being behind hands you the board. Off rotates the turn the ordinary way, which lets a strong player keep choosing.' });

  /* ---- the rulesets: each one writes the three comeback dials ----
     Measured on the balance bench, not guessed (see the Rules row above). The steal's
     share and the twist density are the two the class already tuned; the catch-up
     multiple is the lever that decided the runaway case — 3 and 4 both worked, 4 was
     the closer game. */
  const FLIP_PRESETS = {};
  Object.keys(RS).forEach(k => { FLIP_PRESETS[k] = { flipCatchUp: RS[k].catchUp, flipSteal: RS[k].steal, flipTwists: RS[k].twists }; });
  S.describePresets('flipRules', FLIP_PRESETS);
  let flipApplyingPreset = false;
  S.onChange((id, value, game, change) => {
    // The originating tab already wrote the whole bundle; reapplying it from a
    // storage event would overwrite any later manual choice.
    if(change && change.external) return;
    if(id !== 'flipRules' || flipApplyingPreset) return;
    const preset = FLIP_PRESETS[S.get('flipRules', 'flip')];
    if(!preset) return;
    flipApplyingPreset = true;
    Object.keys(preset).forEach(k => S.set(k, preset[k], 'flip'));
    flipApplyingPreset = false;
  });
};

if(window.HubSettings) window.registerFlipSettings(window.HubSettings);
