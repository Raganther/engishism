/* ---- app-wide settings, declared so any surface can render them ----
   Every setting a game inherits by existing — Sound, Phones, Competition, the Clue
   card, Presentation, the roster and the relay — registered as pure declarative data,
   apart from the engine that reacts to them. This is the same split `hub-round-settings.js`
   already embodies: registration lives here so the question bench (the app's single
   settings surface) and the hub board both hold the whole registry; the onChange
   handlers and readers that make each setting *do* something stay in `hub-engine.js`.

   Self-registers into `window.HubSettings` on load — `register()` is idempotent, so a
   page that loads this file more than once, or after the engine, is harmless. Load it
   after `hub-settings.js` and before `hub-engine.js`. The per-game settings live beside
   their games in `game-hub/games/<id>-settings.js`; the round-mode rows (which need the
   hosts) are built by `registerRoundModeSettings` in `hub-round-settings.js`. */
window.registerAppSettings = function(S){
  /* ---- sound: synthesised, so it needs no audio files and still works offline ---- */
  S.register({ id:'sound', group:'Sound', type:'toggle', default:true, games:'*',
    label:'Sound effects', help:'Short tones for a right answer, a wrong one, and a cleared board.' });
  S.register({ id:'soundVolume', group:'Sound', type:'select', default:'med', games:'*',
    label:'Volume', help:'Classroom speakers are usually louder than they sound at your desk.',
    options:[{value:'quiet',label:'Quiet'},{value:'med',label:'Medium'},{value:'loud',label:'Loud'}] });
  /* The music bed is the one sound that runs *continuously* under a live question,
     so it is the one a teacher may want gone while keeping the cues. Volume alone
     could not do that — turning it down takes the right-answer tone with it. */
  S.register({ id:'musicBed', group:'Sound', type:'select', default:'normal', games:'*',
    adv:true, label:'Background music', help:'Music that plays under a question nobody has answered yet. Off leaves every other sound alone.',
    options:[{value:'normal',label:'On'},{value:'quiet',label:'On, quieter'},{value:'off',label:'Off'}] });

  /* ---- phones ----
     Two weights for the typing race, both here rather than in the source because
     the right numbers are a classroom question. A wrong answer costs *time*, never
     points — long enough to hurt, short enough that they stay in the round. */
  S.register({ id:'typeCooldown', group:'Phones', adv:true, type:'range', default:3,
    min:0, max:10, step:0.5, unit:'s', games:'*',
    label:'Wait after a wrong buzz',
    help:'How long that phone is out before it can buzz again. Nobody loses points; they lose the race.' });

  S.register({ id:'typeStrict', group:'Phones', adv:true, type:'toggle', default:false,
    games:'*',
    label:'Spelling has to be exact',
    help:'Off: a near miss takes the floor and the phone is told to check its spelling. On: only the exact word counts.' });

  S.register({ id:'phoneOneEach', group:'Phones', type:'toggle', default:true,
    games:'*',
    label:'One answer each per question',
    help:'A student who has answered cannot answer again until the next question. Stops the fastest thumbs owning the game.' });

  S.register({ id:'phonePrompt', group:'Phones', type:'toggle', default:true,
    games:'*',
    label:'Show the question on the phones',
    help:'The back of the room reads its own screen. Off keeps their eyes on the board.' });

  /* ---- competitive dynamics ----
     Named games rather than '*', deliberately: a steal is a question passing to the
     other team, and Bingo has no such beat — a wrong tap costs nothing and the call
     stays open for everybody. Divergence by declaration is the point; the bug is
     only when a list is standing in for "all of them". **Nothing here ever deducts
     points**: a steal transfers the chance, not the score. */
  S.register({ id:'stealOnWrong', group:'Competition', type:'toggle', default:true,
    games:['jeopardy','blockbusters','millionaire','race'],
    label:'Steal on a wrong answer',
    help:'A missed question passes to the other team for one shot at the points. Off: a wrong answer simply ends the question, as before.' });

  /* Only the two games that score in values: a Blockbusters hex is one point and a
     Race word is one word, so halving them has nothing to halve. */
  S.register({ id:'stealFullValue', group:'Competition', under:'stealOnWrong', type:'toggle', default:false,
    games:['jeopardy','millionaire'],
    label:'Steal pays the full value',
    help:'As the show plays the rebound — a stolen question earns everything it was worth. Off: a steal pays half, so the miss still cost something.' });

  // the two games with a turn that can be *kept*: Race and Bingo have no pick to
  // hand over, and Millionaire's ladder rotates by design
  S.register({ id:'keepControl', group:'Competition', type:'toggle', default:true,
    games:['jeopardy','blockbusters'],
    label:'Keep the board on a correct answer',
    help:'A team that answers correctly picks again instead of handing over. Runs build, which is what steal is there to punish.' });

  /* `'*'`, not a list: this rides on award(), which every game that scores calls,
     so naming the games that existed when it was written left the fifth one out. */
  S.register({ id:'streak', group:'Competition', adv:true, type:'toggle', default:false,
    games:'*',
    label:'Streak bonus',
    help:'Two in a row scores 1.5×, three or more scores 2×. A wrong answer resets it.' });

  /* ---- clue card ---- */
  // only the two games that open a clue card have a card to animate
  S.register({ id:'cardFlip', group:'Clue card', type:'variant', default:'morph',
    games:['jeopardy','blockbusters'],
    label:'Card animation', help:'How the clue card arrives. Try them mid-game and keep whichever reads best in your room.',
    variants:[{value:'off',       label:'None — opens instantly'},
              {value:'morph',     label:'Unfold from the shape you clicked'},
              {value:'grow-turn', label:'Grow, then turn over'},
              {value:'turn-only', label:'Turn on the spot'},
              {value:'rise',      label:'Rise up — no 3D'}] });

  S.register({ id:'flipSpeed', group:'Clue card', under:'cardFlip', type:'select', default:'normal',
    games:['jeopardy','blockbusters'],
    label:'Flip speed', help:'How long the card takes to turn over and come back.',
    options:[{value:'relaxed',label:'Relaxed'},{value:'normal',label:'Normal'},{value:'snappy',label:'Snappy'}] });

  /* Blockbusters' weakness is that two students play and twenty-eight watch. The
     bench choosing the hexagon is the cheapest fix for that. It lives in the phones
     group rather than the Blockbusters one because that is where a teacher looks for
     "what do the phones do" — but it is deliberately not a `phoneMode` value; it
     borrows the room for ten seconds between questions, exactly like Ask the class. */
  S.register({ id:'bbTeamVote', group:'Phones', type:'toggle', default:true,
    games:['blockbusters'],
    label:'The team picks its hexagon on their phones',
    help:'Adds a button that asks the team on turn which letter to attack. Their votes land beside the legend and the hexagons light up; you still click the one that plays. Works alongside whatever the phones are doing during a clue. Needs a room; with no phones the button stays hidden.' });

  /* ---- presentation ----
     A skin, not a rewrite. Game show is the default: the app is a classroom
     presentation tool and the lit look is what makes a class sit up. DCU remains one
     switch away and is unchanged. The skin covers the whole app, setup screens included. */
  S.register({ id:'theme', group:'Presentation', type:'variant', default:'gameshow',
    games:'*',
    label:'Look and feel', help:'Game show mode darkens the room and adds chase lights, an intro and music. DCU is the school-colours look.',
    variants:[{value:'gameshow', label:'Game show — lights, music, intro'},
              {value:'dcu',      label:'DCU — school colours'}] });

  S.register({ id:'intro', group:'Presentation', adv:true, type:'select', default:'once',
    games:'*',
    label:'Title sequence', help:'The lights-and-logo opening. Any key or click skips it.',
    options:[{value:'once',  label:'Once per session'},
             {value:'every', label:'Every round'},
             {value:'off',   label:'Never'}] });

  /* **Who is competing: sides, or people.** Deliberately *not* per game — it is a
     fact about the room, persisting across games and unit switches. Registered with
     no `games`, the same as the relay address, because a per-game value here would
     offer a control that cannot mean anything. */
  S.register({ id:'roster', group:'Competition', type:'variant', default:'teams',
    label:'Who is competing',
    help:'Teams is the classroom default. Individuals gives everybody their own score, and only the boards built for it are offered.',
    variants:[{ value:'teams', label:'Teams — a name is a group of students' },
              { value:'solo',  label:'Individuals — everyone against everyone' }] });

  S.register({ id:'buzzers', group:'Phones', type:'toggle', default:false,
    label:'Phone buzzers', help:'Students join on their phones and buzz to win the right to answer. Needs a relay — this will not work from the GitHub Pages copy. See docs/buzzers.md.' });
  S.register({ id:'buzzerRelay', group:'Phones', adv:true, type:'text', default:'',
    label:'Relay address', placeholder:'same site as this page',
    help:'Leave blank unless you run your own relay server elsewhere — then put its https address here.' });
};

// declare itself into whatever registry is present — no caller holds a list
if(window.HubSettings) window.registerAppSettings(window.HubSettings);
