/* ================= Round settings — the Questions group, defined once =================
   The round settings (Everyone-finishes, the pay split, the crowd reveal, the commit
   beat, the commentary) used to live inline in hub-engine.js, so ONLY a full hub board
   populated them — which is why the room bench borrows a board's registry and the
   question bench had to hard-code their defaults. They move here so BOTH the engine and
   the question bench can register the exact same definitions from one home (axiom 2).

   It is a plain function, not a self-running IIFE, because the two callers hand in the
   engine symbols the definitions reference — and the bench has none of them:

     registerRoundSettings(S, {
       roundGames,           // the games that host rounds; [] on the bench → master-only
       isScoreEach(game),    // host.scoreEach — the roundOpenToAll filter
       isOnCard(game),       // host.onCard    — the roundWinClose filter
       payVariants,          // the pay rules as {value,label}[] (from PAY_RULES)
       solo()                // Roster.solo() — read by crowdLive's stateNote
     })

   With `roundGames = []` every `games: roundGames` row registers master-only (no per-game
   tab), which is exactly what the bench wants: one master value it reads with S.get(id).

   Loads AFTER hub-settings.js (needs window.HubSettings' register machinery) and, in the
   hub, BEFORE hub-engine.js (whose migrations write these ids). check-syntax walks
   game-hub/ so this file is checked with no manifest edit. */
(function(){
  'use strict';

  window.registerRoundSettings = function(S, ctx){
    ctx = ctx || {};
    const roundGames  = ctx.roundGames  || [];
    const isScoreEach = ctx.isScoreEach || (() => false);
    const isOnCard    = ctx.isOnCard    || (() => false);
    const payVariants = ctx.payVariants || [];
    const solo        = ctx.solo        || (() => false);

    /* **This was the winner banner and is now the standings, so every board gets it** —
       including the ones with no slot to win, which is why the `scoreEach` filter came
       off. Quickfire is the board the movement matters most on: fifteen questions and
       nothing else punctuating them. */
    S.register({ id:'roundWinBanner', group:'Questions', type:'toggle', default:true, quick:true,
      games: roundGames,
      label:'Standings between questions',
      help:'After each question, a screen naming who took it and showing everybody rising and falling. It waits for you rather than leaving on a timer. Off keeps the board on screen and says nothing.' });

    /* The standings open on the *old* order for a beat, then everybody glides to
       their new place — the movement itself, not only the arrows describing it. */
    S.register({ id:'standingsShuffle', group:'Questions', under:'roundWinBanner', type:'toggle', default:true,
      games: roundGames,
      label:'Standings shuffle into place',
      help:'The screen opens showing the order before this question, holds a moment, then the rows slide to the new order. Off shows the new order at once.' });

    /* **How a question's points are split, and the whole answer to "custom behaviour
       per game".** A board names its starting rule through `defaults`, which ranks
       below a teacher's override and above the master — so Jeopardy opens on the podium
       and Quickfire on the clock without either holding any arithmetic, and the panel
       says in as many words that it is the game's own default rather than a control
       that silently does nothing. The variants are built from `PAY_RULES`, so a fifth
       rule is a table entry and this row grows on its own. */
    S.register({ id:'roundPay', group:'Questions', type:'variant', default:'winner',
      games: roundGames,
      defaults:{ jeopardy:'podium', kahoot:'clock' },
      label:'How the points are split',
      variants: payVariants,
      help:'Who scores when more than one team gets it right. The tile, hexagon or rung still goes to whoever was first — this is the points only.' });

    S.register({ id:'roundPaySecond', group:'Questions', under:'roundPay', when:'podium', type:'range', default:0.6,
      min:0.1, max:0.9, step:0.1, unit:'×', games:roundGames,
      label:'Second place is worth',
      help:"Second place scores this share of the question's value." });
    S.register({ id:'roundPayThird', group:'Questions', under:'roundPay', when:'podium', type:'range', default:0.3,
      min:0.1, max:0.9, step:0.1, unit:'×', games:roundGames,
      label:'Third place is worth',
      help:"Third place scores this share of the question's value." });
    S.register({ id:'roundPayFloor', group:'Questions', under:'roundPay', when:'clock', type:'range', default:0.5,
      min:0.1, max:0.9, step:0.1, unit:'×', games:roundGames,
      label:'A last-second right answer is worth',
      help:"The least a right answer can score, as a share of the full value — and with no clock running, what every answer after the first is worth." });

    /* Offered only to the boards that *have* a slot to lock. Quickfire plays this way
       already and has nothing to switch, so a row there would be a control that reads
       as a choice and is not one. Derived from the host's own declaration, so a
       seventh board sorts itself.

       **On, now that there is something for the rest of the room to play for.** It
       shipped off for one build and the reason was honest then: holding the slot back
       changes a beat three boards have always had, and a right answer that was not
       first scored nothing worth having. With the podium and the standings screen there
       is now a reason to keep working after somebody else has it, which is the whole
       point of the change.

       It still costs the teacher a press — Reveal, then Close, where a won round used
       to take itself — and no class has met it. The switch is what puts the old race
       back, in one tap on the room bench. */
    /* **Forked by room type, and this one is not a formality.** Unlike the crowd
       reveal — which gates on room size, so ordinary team play never meets it — this
       applies identically in both rooms and the right answer genuinely differs. With
       three teams the race for the tile *is* the game, and first-takes-it is the beat
       three boards have always had. With sixteen individuals the same rule locks
       fifteen people out of a question they are half way through, which is the
       lockout this setting exists to remove. Individuals follow the team-room value
       until set apart, so nothing moves for anybody until a solo room chooses. */
    S.register({ id:'roundOpenToAll', group:'Questions', type:'toggle', default:true, quick:true,
      byRoster: true,
      games: roundGames.filter(g => !isScoreEach(g)),
      label:'Everyone finishes, not just the first',
      help:'A right answer stops closing the question. The first team still takes the tile at full value when you reveal; everyone else who gets there still scores, for less. Off is the old race.' });

    /* **The crowd reveal — what the room collectively knows fills in on the card.**
       Only in a big room (7+ competitors, where the lanes have stood down): a letter,
       word or rung appears once this share of the players who have started already
       have it, so nothing on the wall is any one player's answer. In a small room the
       lanes already show the dynamic — a team's correct letters are readable off its
       lane — so this stays out of the way there. The rule and the never-the-last-part
       cap live in `Kit.round.crowdKnown`; this row is only the number. */
    S.register({ id:'crowdReveal', group:'Questions', type:'range', default:40, quick:true, adv:true,
      min:0, max:90, step:5, unit:'%', games:'*',
      label:'Reveal what the room knows',
      help:'In a big room, a part of the answer fills in once this share of active players have it. 0 switches it off. Never the last part — that stays yours to reveal.' });

    /* The reveal's companion: one anonymous bar filling toward the next reveal —
       anticipation the room can watch without learning which part is coming. The
       rules (never per word, hidden at the cap, damped) live in
       `Kit.round.crowdMeter`; this row only switches the picture. */
    S.register({ id:'crowdMeter', group:'Questions', type:'toggle', default:true, quick:true,
      games:'*', under:'crowdReveal',
      label:'Meter toward the next reveal',
      help:'A bar on the card filling as the room converges on its next reveal, without saying which part. Hidden when nothing more can reveal. Needs the reveal above to be on.' });

    /* **The commit beat for a room of individuals.** A competitor of one has no
       agreement friction, so a tap is judged the instant it lands and a wrong tap
       costs nothing — which makes button-mashing the winning strategy on any tap
       round. Send is the friction: taps only select, the answer counts when the
       player commits it, and a wrong commit puts that phone alone on a countdown.

       **Solo only, gated in code rather than forked with `byRoster`** — the roster
       mode is already the live gate (the `crowdReveal` rule: check for an existing
       gate before forking). In a team room the live taps *are* the negotiation the
       lanes and the agreement fractions read, so Send there would starve the
       picture the mode exists for. These rows say so. */
    S.register({ id:'roundSend', group:'Phones', type:'toggle', default:true, quick:true,
      games:'*',
      label:'Individuals press Send',
      help:'In a room of individuals, taps only select — the answer counts when the player presses Send. Stops guess-and-check. Team rooms are never affected.' });
    S.register({ id:'roundSendCool', group:'Phones', type:'range', default:3, quick:true,
      min:0, max:15, step:1, unit:'s', games:'*', under:'roundSend',
      label:'Wrong answer wait',
      help:'A wrong Send locks that phone alone for this long, with the countdown in their hand. 0 is no wait. Individuals only.' });
    /* **What the reveal bar follows.** Off, it counts what the room has *committed*,
       which is what the commit beat made it: a selection costs nothing, so counting
       selections would turn the bar into a free oracle — choose, watch it twitch, then
       send what it told you. On, it counts what people currently have *selected*,
       which is livelier and is how the bar behaved before Send existed. The leak is
       real and small: the bar is collective and damped, so one person barely moves it.
       Offered as a switch because which of the two teaches better is a question about
       a room, not about code. */
    S.register({ id:'crowdLive', group:'Questions', type:'toggle', default:false,
      quick:true, byRoster:true, games:'*', under:'crowdReveal',
      /* **Reported as broken because the row could not say it was inert.** A preview
         only exists where a tap is *held*, which is the commit beat, which is a room
         of individuals — so in a team room a tap is already the answer, the bar has
         always followed it, and this switch has nothing left to turn on. Toggling it
         there changes precisely nothing, correctly, and silently. Proved with six
         handsets: `preview` on the arm is false in a team room with the switch on and
         true in a solo room with the switch on.

         Said through `stateNote` rather than in `help` because it is a fact about the
         room in front of the teacher, not a property of the setting — and the third
         line is the one that catches everybody, since anything riding the arm cannot
         reach the question already on screen. */
      stateNote(game){
        if(!solo())
          return 'A team room has no Send, so a tap is already the answer and the bar ' +
                 'always follows it — this switch only does something for a room of individuals.';
        if(!S.get('roundSend', game))
          return 'Needs “Individuals press Send” on — without Send a tap is already the answer.';
        return 'Rides the next arm, so it lands on the following question, not the one open now.';
      },
      label:'Reveal bar follows selections',
      help:'The bar fills as people choose, before they press Send — livelier, and closer to how it felt without the Send button. Off, it only counts answers that have actually been sent.' });
    S.register({ id:'roundSendRamp', group:'Phones', under:'roundSend', type:'toggle', default:true,
      games:'*',
      label:'The wait grows',
      help:'Each wrong Send on the same question adds the wait again — 3s, then 6s, then 9s — so the second guess is a real decision. Individuals only.' });

    /* **The card stops leaving on its own when a round is won.** Reported from a real
       board: the four words light up, the tile flips away, and the room is left with
       no answer on screen and no idea who took it. The round pays the moment it is
       won *because* the class produced the answer and the host judged it — there is
       nothing left to confirm — but "nothing to confirm" was read as "nothing to
       read", and those are different. The teacher closes it now; the payout and the
       winner banner ride on that press, so the beat is one thing rather than two.
       Every round on a card board inherits it, because the wait is the host's. */
    S.register({ id:'roundWinClose', group:'Questions', adv:true, type:'variant', default:'teacher',
      games: roundGames.filter(g => isOnCard(g)),
      label:'When a round is won',
      variants:[{ value:'teacher', label:'Keep the card up — the answer stays on screen until you close it' },
                { value:'auto',    label:'Close the card straight away' }],
      help:'A won round used to flip the card away within a second of the answer landing. Keeping it up leaves the answer and the winning team on screen for as long as you want to talk about them.' });

    /* Offered wherever a round can be hosted, including the two boards with no card:
       a hint changes the question rather than the card, so Millionaire and Quickfire
       get it too. Which rounds actually offer a button is the round's own business —
       one that declares no `hint` shows none, whatever this says. */
    S.register({ id:'roundHints', group:'Questions', type:'toggle', default:true,
      games:roundGames, label:'Hint button on a round',
      help:'Gives away one part of the answer — a word of the group, a wrong option struck out, a letter into its slot, the next rung. Press again for the next part. It never gives away the last part; that is what Reveal is for. Costs nothing.' });

    S.register({ id:'roundWho', group:'Questions', type:'variant', default:'room',
      games:roundGames, label:'Who plays a round',
      variants:[{ value:'room', label:'The whole class races — first team to get it takes the square' },
                { value:'turn', label:'Only the team on turn' }],
      help:'A round asks the room to assemble an answer on their phones. It can be a race between every team, or belong to the team whose turn it is like any other clue.' });

    /* ---- how a wrong answer is announced ----
       The `say` line is one overwriting headline: right for a team room where one team
       answers at a time, a blur in a room of individuals where a dozen misses a second
       thrash it. So where a verdict lands is a switch, kept per room type because the
       headline is only a problem in the solo room. The count already says how close a
       player is, which is why "off" is a real choice and not a loss of information. */
    S.register({ id:'roundCommentary', group:'Questions', type:'variant', default:'headline',
      games:roundGames, byRoster:true, quick:true, label:'Where a verdict shows',
      variants:[{ value:'headline', label:'One headline on top of the card — the last thing that happened' },
                { value:'lane',     label:'On the player’s own lane, where it stays until their next try' },
                { value:'off',      label:'Nowhere — the "3/4 right" count already says how close they are' }],
      help:'A "one away" / "not a group" can share one headline (fine for teams, a blur for sixteen individuals), sit on each player’s own row where it stays put, or stay off the board and leave the running count to say it.' });
    S.register({ id:'roundHintPhone', group:'Questions', type:'toggle', default:false,
      games:roundGames, byRoster:true, quick:true, label:'Tell the phone how close',
      help:'On, a wrong answer tells the handset how close it was — "One away…" or "Not a group" — instead of a plain "Not that one". It never says which word is wrong, only how far off.' });

    /* The question-type dressing: gap fills show a real blank, anagrams show tiles.
       `games:'*'` (every board can draw a typed prompt), so it rides here with the
       other round rows rather than being stranded in the engine. */
    S.register({ id:'promptForms', group:'Questions', type:'toggle', default:true,
      games:'*',
      label:'Draw the question type',
      help:'Gap fills show a real blank, anagrams show letter tiles, odd-one-out shows chips. Off prints every question as plain text.' });
  };
})();
