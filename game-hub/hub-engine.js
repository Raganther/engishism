/* ================= Game Hub — shared engine =================
   Renders the UI and runs Jeopardy + Blockbusters from unit content.
   Units register themselves into `window.UNITS` (see game-hub/content/unit-*.js).
   Flow: choose unit -> choose game -> choose sections -> play.
   If only one unit is loaded (a per-unit shell), the unit step is skipped.

   Teams/scores live in one shared roster shown in an always-present team bar,
   so you can move between games and units without losing team names or points.
   Both games feed the same scores; a Reset points button clears them. */
(function(){
  'use strict';

  const UNITS = window.UNITS || (window.UNIT ? [window.UNIT] : []);
  if(!UNITS.length){ throw new Error('hub-engine: no units loaded — include a content file (window.UNITS) before hub-engine.js'); }

  const S = window.HubSettings;
  if(!S){ throw new Error('hub-engine: game-hub/hub-settings.js must load before hub-engine.js'); }

  const Kit = window.HubKit;
  if(!Kit){ throw new Error('hub-engine: game-hub/hub-kit.js must load before hub-engine.js'); }

  /* Which build is actually running — read from this script's own ?v= stamp, so the
     HTML stays the single source of truth. Shown in the settings panel: a cached old
     copy of the engine is otherwise invisible and looks like the fix never landed. */
  window.HUB_BUILD = (function(){
    const el = document.currentScript ||
               [...document.querySelectorAll('script[src*="hub-engine.js"]')].pop();
    const m = el && el.src && el.src.match(/[?&]v=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : 'dev';
  })();

  /* ---- `?desktop=1` — the projected layout, on a handset ----
     The phone layout is for a *teacher checking a lesson*: it compacts the chrome,
     lets the board scroll, and keeps everything reachable under a thumb. That is
     the right thing when you are teaching, and the wrong thing when you are away
     from the laptop and want to see **what the room will actually see** — the
     board at projector proportions, with the columns and the fit it will really
     have.

     So: `game-hub.html?desktop=1` lays the page out at a projector's 1280 and lets
     the browser scale it down, exactly as `phone-bench.html` already does with a
     board in a frame. The media queries key off width, so pinning the width is the
     whole mechanism — none of the handset tiers match at 1280 and nothing else has
     to know this mode exists.

     A number sets the width (`?desktop=1440`) for checking a wider screen; `1` or
     an empty value means 1280, which is what the layout suites assert against and
     therefore the honest default. Text will be small — pinch to read. That is the
     trade for seeing the real thing rather than a reflowed version of it. */
  (function(){
    const m = String(location.search).match(/[?&]desktop=([^&]*)/);
    if(!m) return;
    const asked = parseInt(m[1], 10);
    const w = (asked && asked >= 480) ? asked : 1280;
    let tag = document.querySelector('meta[name="viewport"]');
    if(!tag){ tag = document.createElement('meta'); tag.name = 'viewport'; document.head.appendChild(tag); }
    /* `initial-scale` is deliberately not set: letting the browser choose the
       fit-to-screen scale is what makes 1280 land inside a 390px phone, and
       pinning it to 1 would put the board off the right edge instead. */
    tag.setAttribute('content', 'width=' + w);
    document.documentElement.dataset.desktopPreview = w;
  })();

  /* ================= GAME REGISTRY =================
     A game declares itself once, here, and the engine drives it through this
     contract instead of asking `if (activeGame === 'jeopardy')` in nine places.
     What that buys:

     - **A checklist that cannot be half-finished.** Every hook has a no-op default,
       so a new game runs the moment it is registered and grows features by filling
       hooks in — rather than working everywhere except the two branch points you
       didn't know about.
     - **Shared by default.** The chrome, team bar, timer, sounds, kit services, the
       clue card, the end-of-round banner and the whole game-show skin apply to any
       registered game without it asking. A game only writes code for what makes it
       different.
     - **Divergent by declaration.** Where games genuinely differ — how tense the
       board is right now, what the ident looks like — that is a hook or a `variant`
       setting, not a branch.

     The hooks, all optional:
       load(unit)            pull this game's banks out of a unit
       hasBank(unit)         does this unit offer the game at all?
       renderContent(list,help)  the section/category picker
       startButton(btn)      enable and label the start button
       start()               build the board (screen is still hidden)
       fit()                 measure and size — runs once the screen is visible
       deal()                the board's entrance animation
       tension()             set `--tension` and drive the music bed
       onResize()            re-fit after a window resize
       onTimerEnd()          the header countdown reached zero
       onWrong(teamIdx)      a team missed it — return true if the game opened a
                             steal and will finish the beat itself, false to let
                             the shared path close the question as before

     Hooks run only while their game is the active one, so none of them needs to
     check. Registration order is the order the cards appear on the game screen. */
  /* The registry lives in `hub-games.js` now — loading before the game files and
     before this engine, the `hub-rounds.js` → `rounds/*.js` → engine pattern. The
     six built-ins still declare themselves below because their logic shares this
     closure; an external game file registers into the same registry and the
     engine, loading last, consumes everything already registered. */
  if(!window.HubGames) throw new Error('hub-games.js must load before hub-engine.js');
  const GAMES = window.HubGames.all();
  const registerGame = def => window.HubGames.register(def);
  const HUB_GAME_TITLES = window.HUB_GAME_TITLES;

  const gameDef  = id => window.HubGames.get(id === undefined ? activeGame : id);
  const gameIds  = () => GAMES.map(g => g.id);
  /* Run a hook on the game being played. Every call site used to be an if-chain
     that a new game had to be threaded into by hand. */
  function hook(name, ...args){
    const g = gameDef();
    return (g && typeof g[name] === 'function') ? g[name](...args) : undefined;
  }

  /* ---------- which boards can host a round ----------
     A round is drawn in the shared clue card, so it is literally the same code
     whichever board opened it. What differs is only what the *host* contributes,
     and it comes to four facts: whose settings scope it, which modal mode it
     belongs to, which stage is lit (so the sting only plays under the skin), and
     what a team taking it is worth.

     Declared rather than branched, so the adapter further down never learns the
     name of the game it is running inside — which is what made a second host cheap
     rather than a rewrite. A third one is an entry in this table.

     **It sits up here so the settings below can be derived from it**, rather than
     from a list of game names typed out a second time. `games: gameIds()` was
     exactly that mistake once and it made the fifth game a second-class citizen;
     anything that names the games is a bug waiting for the next one.

     `win` returns what it paid, because the phone strip names the student *and*
     the amount, and a tile and a hexagon are worth completely different things.
     Everything it references is either a hoisted function or read at call time, so
     the table can be declared before any of it exists. */
  /* **Where the round is drawn is the host's, not the adapter's.** Two of these open
     the shared clue card; Millionaire has no card at all and draws its question
     inline on its own stage, so the mount is a declared fact like everything else.
     `render(mount, s, ctx)` always took a mount — it was the adapter that assumed
     which one, which is what made "a round on a stage" look like a contract change
     when it is really one more row in this table.

     `live()` replaced `modalMode === modal` for the same reason: a game with no
     modal could never answer that question. `commit` names the button that judges
     what the teacher has picked, because Millionaire's is its own "Final answer?"
     rather than the clue card's Check. */
  const CARD_MOUNT = () => {
    const text = document.getElementById('clue-text');
    let host = document.getElementById('clue-group');
    if(!host || host.parentNode !== text){
      if(host) host.remove();
      host = document.createElement('div');
      host.id = 'clue-group'; host.className = 'clue-group';
      text.appendChild(host);
    }
    return host;
  };
  /* **Every board's host entry is declared in its own game file now** — `roundHost` on
     its registration — and merged here, before ROUND_GAMES and the round settings
     derive from the table. Game files load before this engine (the rounds pattern), so
     every declaration is already in by the time this runs; the table starts empty and
     nothing here names a game. */
  const ROUND_HOSTS = {};
  window.HubGames.ids().forEach(g => {
    const d = window.HubGames.get(g);
    if(d && d.roundHost && !ROUND_HOSTS[g]) ROUND_HOSTS[g] = d.roundHost;
  });
  const ROUND_GAMES = Object.keys(ROUND_HOSTS);
  // the first-registered host is the resting default until a clue names its own board
  let roundHost = ROUND_HOSTS[ROUND_GAMES[0]] || null;

  /* ---------- how a question's points are split ----------
     **Four rules, written once each, and a board picks one.** This is the answer to
     "how does each skin score differently" and the answer is deliberately *not* a
     function per game: five boards each doing their own arithmetic is the hand-kept
     list this project has paid for more than any other, and it would leave a teacher
     unable to try a different feel without somebody editing code. A board names its
     starting rule, `roundPay` is a settings row, and switching Jeopardy to `equal`
     mid-lesson for a class that is finding it brutal is two taps on the room bench.

     **They live here rather than in a round**, because a round may not score — that
     is the one rule keeping a round portable. And not on `Kit`, because what a
     question is worth is the *skin's* business.

     `rows` is `Kit.round.results.finished()` — who got there, in order, each carrying
     how much clock was left when they did. `baseFor(who)` is the host's `worth()`,
     asked per competitor because a Millionaire rung is a different number for each of
     them. What comes back is `{ who: points }` and nothing else: no board work, no
     turns, no tiles.

     **The fifth rule goes in this table.** Not into a game. */
  const PAY_RULES = {
    winner: {
      label:'Winner takes all — only the first to get it scores',
      pay(rows, baseFor, o){
        return rows.length ? { [rows[0].who]: payRound(baseFor(rows[0].who), o.step) } : {};
      }
    },
    podium: {
      /* The rule the whole change was for: until results carried a *position*,
         nothing anywhere could see that somebody came third. */
      label:'Podium — first, second and third all score, less each time',
      pay(rows, baseFor, o){
        const share = [1, o.second, o.third];
        const out = {};
        rows.slice(0, 3).forEach((r, i) => {
          const v = payRound(baseFor(r.who) * share[i], o.step);
          if(v > 0) out[r.who] = v;
        });
        return out;
      }
    },
    clock: {
      /* Kahoot's own curve, chosen rather than invented: full marks for an instant
         answer, `floor` of it for one arriving as the clock dies. It rewards knowing
         over guessing without making a slow right answer worthless.

         **With no clock running it pays the floor, flat** — which is every board but
         Quickfire, where a tile is read out at the teacher's pace and there is no
         fraction to decay against. What is left to say there is "you got there, but
         not first", and that is exactly the floor. */
      label:'By the clock — everyone right scores, and faster is worth more',
      pay(rows, baseFor, o){
        const out = {};
        rows.forEach(r => {
          const frac = Kit.round.clock.running() ? r.fraction : 0;
          out[r.who] = payRound(baseFor(r.who) * (o.floor + (1 - o.floor) * frac), o.step);
        });
        return out;
      }
    },
    equal: {
      /* No speed advantage at all. For a class where the race is the thing putting
         students off answering — which is the case this whole change exists for, and
         the fastest way to find out whether it is true of a given group. */
      label:'Everyone right scores the same',
      pay(rows, baseFor, o){
        const out = {};
        rows.forEach(r => { out[r.who] = payRound(baseFor(r.who), o.step); });
        return out;
      }
    }
  };

  /* Rounded to the board's own unit, because a scoreboard reading 92 and 87 is
     arithmetic nobody at the back of a room can follow. Never below one unit: a right
     answer that pays nothing reads as not having counted. */
  function payRound(v, step){
    const s = Number(step) || 1;
    return Math.max(s, Math.round(v / s) * s);
  }

  /* What each competitor is paid for this question, whichever rule is running. One
     definition, so the standings screen and the payout can never disagree about a
     number the room is looking at. */
  function roundPayout(host){
    const h = host || roundHost;
    const rule = PAY_RULES[S.get('roundPay', h.game)] || PAY_RULES.winner;
    const baseFor = who => (h.worth ? Number(h.worth(who)) || 0 : 0);
    return rule.pay(Kit.round.results.finished(), baseFor, {
      step:   h.step ? (Number(h.step()) || 1) : 1,
      floor:  Number(S.get('roundPayFloor',  h.game)),
      second: Number(S.get('roundPaySecond', h.game)),
      third:  Number(S.get('roundPayThird',  h.game))
    });
  }

  /* One definition of "this board runs its questions against a clock", asked of the
     host rather than of the game's name, so a seventh board answers it by declaring
     one fact. `clock` is a function because the seconds come from a ⚙ range a teacher
     can move between questions. */
  function roundClockSecs(host){
    const h = host || roundHost;
    return h && h.clock ? (Number(h.clock()) || 0) : 0;
  }

  /* ---- feature switches. Adding a feature? Register it here and the settings
     panel picks it up automatically — there is no panel markup to edit. ---- */
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

  /* ---- phones: one mode, not four switches ----
     These began as four independent toggles and immediately contradicted each
     other — with typing and buzzing both on, one had to silently win, and it was
     decided by a hard-coded precedence nobody could see. A dynamic is a *choice*
     between iterations, so it is one variant with named values: pick one, compare
     it against another next round, no combination that means nothing.

     A variant may name the games it suits, so a dynamic only appears on the boards
     it works on.

     Voting is *not* one of these values, deliberately. It is not an alternative to
     buzzing or typing — it is what the phones do for the few seconds Ask the class
     is running, and then they go back to whatever mode says. Making it a mode meant
     choosing between a class that can buzz and a class that can vote, when the
     Millionaire round wants both at different moments. So the mode is what the
     phones do *for a question*, and the lifeline borrows the room. */
  /* `phoneMode` used to be registered here, by hand, with its four values written
     out. It is `round_default` now and the row is built from what the default round
     declares — same loop, same shape as `round_grouping`. See `rounds/default.js`
     and the registration block below. */

  /* Two weights for the typing race, both here rather than in the source because
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

  /* The migrations that used to sit here — three booleans into `phoneMode`, and
     the retired `vote` value — moved below the round-setting registration, because
     both now write `round_default` and `S.set` cannot write an id that has not been
     registered yet. Same trap `migrateRoundSettings` already carried a note about. */

  /* ---- competitive dynamics ----
     All per-game, so a teacher can run steal in Jeopardy and not in Blockbusters and
     compare. **Nothing here ever deducts points**: a steal transfers the chance, not
     the score, which keeps the decision recorded in the Millionaire section below
     (never taking anything away) true of the whole app.

     Steal and keep-control default ON — they only add ways to score, and between
     them they fix the thing that most flattens a room: nothing being at stake when
     it is not your turn. The streak defaults off because it changes how big the
     numbers get, which is a taste question. */
  /* Named games rather than '*', deliberately: a steal is a question passing to the
     other team, and Bingo has no such beat — a wrong tap costs nothing and the call
     stays open for everybody. Divergence by declaration is the point; the bug is
     only when a list is standing in for "all of them". */
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

  /* A grouping clue is the one clue every team can genuinely play at the same time,
     and whether they should is a teaching decision rather than a number to tune —
     which is what makes it a variant. The whole room racing is the Connections
     dynamic and the reason the clue is worth having; the team on turn alone is the
     ordinary Jeopardy contract, and is the right answer for a class where one team
     is running away with it. Written as a switch because a choice between
     iterations is exactly what a variant is for, and the room bench is where a
     teacher tries the other one between rounds. */
  /* One row per round that offers ways to be played, built from what each round
     declares. The engine never learns what a mode *means* — it hands the chosen
     value back through `ctx.mode` and the round does the rest. Registered here with
     everything else, because a setting registered later than init is a row the
     panel has already been built without. */
  /* `Questions`, not `Jeopardy`, and the ids carry no game in them — a round is
     drawn in the shared clue card and every board that opens one hosts the same
     code. A group is a game's own when everything in it names exactly one game, so
     naming two is what puts these where they belong without a list anywhere. */
  /* A round may say how its own row should read. Every shaped round wants the same
     thing — offered to the boards that can host one, filed under Questions — so
     saying nothing gets that. The **default round** wants neither: it applies to all
     five games, because every game has phones, and it belongs beside the other phone
     switches where a teacher has always found it. Declared by the round rather than
     branched on here, or this loop would grow an `if (id === 'default')` and the next
     round like it would need a second one. */
  (Kit.round ? Kit.round.ids() : []).forEach(id => {
    const def = Kit.round.get(id);
    if(!def || !def.modes || !def.modes.length) return;
    const own = def.modeSetting || {};
    /* A host may declare which mode suits its board — the round says what modes
       exist, the skin says which one its geometry wants, and neither learns the
       other's business. Two ways to say it, and the general one comes second so a
       named exception always wins:

       `modeDefaults[id]` names a mode for one round, for a board with a reason
       peculiar to that round — Jeopardy's ordering ladder is the only one.

       `teamMode:true` says "this board is team-based, so give me whichever mode
       each round calls its whole-team one" (`teamMode` on the round). That is the
       one that scales: a round registered next month lands on the right mode with
       no host edited, where the per-round list had to be joined by hand.

       Both are checked against the round's own list, because a default naming a
       mode that does not exist would select nothing and look exactly like the
       setting being ignored. */
    const perGame = {};
    ROUND_GAMES.forEach(g => {
      const host = ROUND_HOSTS[g];
      const want = (host.modeDefaults || {})[id] || (host.teamMode ? def.teamMode : null);
      if(want && def.modes.some(m => m.value === want)) perGame[g] = want;
    });
    S.register({ id:'round_' + id, type:'variant',
      group: own.group || 'Questions',
      /* Team rules and whole-class rules are two different lessons, so how a
         round is played forks by room type: a change made while a solo room is
         up is the individuals' value, and individuals follow the team-room
         value until set apart. The storage and the row wording are the
         registry's (`byRoster` in hub-settings.js); this line only opts in. */
      byRoster: true,
      default: def.modes[0].value,
      defaults: Object.keys(perGame).length ? perGame : undefined,
      games: own.games || ROUND_GAMES,
      label: own.label || ('How ' + (def.label || id) + ' is played'),
      variants: def.modes.slice(),
      help: own.help || 'The same question played more than one way. These are different lessons rather than two speeds of the same one, so it is a teaching choice.',
      /* The row says what the room will actually play. In a room of individuals a
         whole-team mode resolves to the round's solo mode at play time
         (`roundModeOf` — "everyone agrees" is meaningless for a competitor of
         one), and a row that went on showing the team wording was the pane
         quietly disagreeing with the board beside it. Mirrors roundModeOf's
         conditions exactly, including the teacher's override outranking it. */
      stateNote: g => {
        if(!def.teamMode || !Roster.solo()) return null;
        if(S.get('round_' + id, g) !== def.teamMode) return null;
        if(S.hasOverride('round_' + id, g)) return null;
        const solo = def.modes.filter(m => m.value !== def.teamMode)[0];
        return solo ? 'A room of individuals — playing as “' + solo.label + '”' : null;
      } });

    /* A round may declare a SECOND axis — how the answer is entered (drag vs flick) —
       kept apart from the team rule because they are orthogonal: either input can
       carry either rule. Built the same way `round_<id>` is, from the round's own
       `inputs` list, so a round with no `inputs` grows no row. Not `byRoster`: the
       input method is not a team-vs-individual choice the way the team rule is, so
       one value serves both room types. */
    if(def.inputs && def.inputs.length){
      S.register({ id:'round_' + id + '_input', type:'variant',
        group: own.group || 'Questions',
        default: def.inputs[0].value,
        games: own.games || ROUND_GAMES,
        label: 'How ' + (def.label || id) + ' is entered',
        variants: def.inputs.slice(),
        help: 'How the answer is put into the slots — dragged into place, or flicked in with the physics. Set apart from how the answer is decided.' });
    }
  });


  /* The Questions-group round settings (Everyone-finishes, the pay split, the crowd
     reveal, the commit beat, the commentary, the question-type dressing) are defined
     once in hub-round-settings.js so the question bench can register the SAME rows.
     Handed the engine symbols the definitions reference; runs BEFORE the migrations
     below, which write some of these ids. */
  registerRoundSettings(S, {
    roundGames:  ROUND_GAMES,
    isScoreEach: g => !!(ROUND_HOSTS[g] && ROUND_HOSTS[g].scoreEach),
    isOnCard:    g => !!(ROUND_HOSTS[g] && ROUND_HOSTS[g].onCard),
    payVariants: Object.keys(PAY_RULES).map(k => ({ value:k, label:PAY_RULES[k].label })),
    solo:        () => Roster.solo()
  });

  /* Rounds were Jeopardy's alone for the first three, so their switches were named
     and grouped as Jeopardy's: `jGroupWho`, and `jRound_<id>` per round. A second
     board hosts rounds now, and a shared setting carrying one game's initial in its
     id is a name that will be wrong for as long as it exists.

     **A per-game override is exactly what a teacher set deliberately**, so it is
     translated rather than left behind under a key nothing reads any more. The old
     key being present is itself the signal — asking whether the new id is unset
     never fires, because `register()` seeds every master with its default — and
     `drop()` is what makes this run once, before anybody can have chosen a new
     value. Registered above this, or `set` would be writing to an id that does not
     exist yet. */
  /* The old Classic bundle wrote `jFinalRound:true` into storage on every device
     that ever picked it — including the accident that ran a final clue at the
     first ef-2a class. The bundle no longer writes it; this forgets what it wrote,
     so the final clue is off everywhere until a teacher turns it on knowingly. */
  (function retireClassicFinal(){
    S.drop(['jFinalRound'].concat(gameIds().map(g => 'jFinalRound@' + g)));
  })();

  (function migrateRoundSettings(){
    const ids  = Kit.round ? Kit.round.ids() : [];
    const pairs = [['jGroupWho', 'roundWho']]
      .concat(ids.map(id => ['jRound_' + id, 'round_' + id]));
    const dead = [];
    [''].concat(gameIds().map(g => '@' + g)).forEach(sfx => {
      pairs.forEach(([old, now]) => {
        const had = S.raw(old + sfx);
        if(had != null) S.set(now, had, sfx ? sfx.slice(1) : null);
        dead.push(old + sfx);
      });
    });
    S.drop(dead);
  })();

  /* `phoneMode` became `round_default` — the same value, read off a round instead of
     a hand-written setting. Three generations of stored value have to survive it, and
     they run in age order because a newer choice must win:

       phoneWrite / phoneBuzzGames   three booleans, before modes existed
       phoneMode: 'vote'             a value whose variant was deleted
       phoneMode: off|buzz|write|type

     **A per-game override is exactly what a teacher set deliberately**, so every one
     is carried across rather than quietly ignored — which is why this walks the game
     suffixes rather than translating the master alone.

     Two traps, both already paid for once and restated because this is the third
     migration to meet them. **The old key still being present is itself the signal
     that nothing has chosen yet**: asking whether `round_default` is unset never
     fires, because `register()` seeds every master with its default. And **`drop()`
     is what makes this run once** — it happens on the first load of this build,
     before anybody can have picked a new value, so a later choice cannot be
     overwritten. */
  (function migrateDefaultRound(){
    const dead = [];
    [''].concat(gameIds().map(g => '@' + g)).forEach(sfx => {
      const at = sfx ? sfx.slice(1) : null;
      /* Oldest first. Precedence between the two booleans is the one the old code
         actually used at question time: write beat buzz. `phoneVote` translates to
         nothing — voting stopped being a mode and happens whenever a room exists, so
         a teacher who had only that switched on wants the default and gets the class
         vote anyway. */
      const pick = S.raw('phoneWrite'+sfx) ? 'write'
                 : S.raw('phoneBuzzGames'+sfx) ? 'buzz' : null;
      if(pick) S.set('round_default', pick, at);
      ['phoneWrite','phoneBuzzGames','phoneVote'].forEach(id => dead.push(id + sfx));

      /* Then the mode itself, so a stored one overwrites anything derived above.
         `vote` names a variant that no longer exists, and a value nothing matches is
         worse than a wrong one — the phones go quiet while the panel still claims a
         dynamic is running. It becomes `off`, which is what that teacher had in
         effect for everything except the lifeline. */
      const had = S.raw('phoneMode'+sfx);
      if(had != null) S.set('round_default', had === 'vote' ? 'off' : had, at);
      dead.push('phoneMode' + sfx);
    });
    S.drop(dead);
  })();

  /* Per-round values were a scope for one afternoon and are gone: every round now
     follows its game, which is the rule a teacher can hold in their head. The keys
     they wrote would simply stop being read, and a value sitting in storage that
     nothing reads is the quiet kind of wrong — it reappears the moment anybody
     restores the scope and applies a choice made about a different build. So they
     are cleared rather than orphaned.

     **Nothing is promoted to the game.** A per-round value was set to make one
     round differ from its game, so lifting it up would apply to every round the
     opposite of what the teacher meant. `~` is the separator that build used, and
     it appears in no other key. */
  (function dropRoundScoped(){
    const dead = (S.keys ? S.keys() : []).filter(k => k.indexOf('~') !== -1);
    if(dead.length) S.drop(dead);
  })();

  /* One-time: split a stored `round_<id>` value of 'flick' — the old single picker's
     third option — into the two axes it became. Faithful mapping, because old flick
     judged first-to-spell: input='flick' + rule='first'. Input is not byRoster, so
     its one value covers both room types, and a solo-only 'flick' still lands. The
     `!solo` mode value is dropped so it follows the migrated team value rather than
     lingering as a variant the picker no longer offers. The presence of a 'flick'
     value is itself the signal (register() seeds the input default, so asking whether
     the new key is unset never fires — the same trap the migrations above carry), and
     after this pass no 'flick' remains, so it runs once. */
  (function migrateRoundInput(){
    const ids = Kit.round ? Kit.round.ids() : [];
    const dead = [];
    ids.forEach(id => {
      const def = Kit.round.get(id);
      if(!def || !def.inputs || !def.inputs.length) return;
      const modeKey = 'round_' + id, inKey = 'round_' + id + '_input';
      [''].concat(gameIds().map(g => '@' + g)).forEach(sfx => {
        const game = sfx ? sfx.slice(1) : null;
        [sfx, sfx + '!solo'].forEach(full => {
          if(String(S.raw(modeKey + full)) !== 'flick') return;
          S.set(inKey, 'flick', game);   // one value serves both room types (not byRoster)
          if(full.indexOf('!solo') === -1) S.set(modeKey, 'first', game);
          else dead.push(modeKey + full);
        });
      });
    });
    if(dead.length) S.drop(dead);
  })();

  // the two games with a turn that can be *kept*: Race and Bingo have no pick to
  // hand over, and Millionaire's ladder rotates by design
  S.register({ id:'keepControl', group:'Competition', type:'toggle', default:true,
    games:['jeopardy','blockbusters'],
    label:'Keep the board on a correct answer',
    help:'A team that answers correctly picks again instead of handing over. Runs build, which is what steal is there to punish.' });

  /* Registered exactly like every other weight, which is the point: the panel and
     the Lab both grow a row for it without either being edited. */

  /* `'*'`, not a list: this rides on award(), which every game that scores calls,
     so naming the games that existed when it was written left the fifth one out. */
  S.register({ id:'streak', group:'Competition', adv:true, type:'toggle', default:false,
    games:'*',
    label:'Streak bonus',
    help:'Two in a row scores 1.5×, three or more scores 2×. A wrong answer resets it.' });

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
     bench choosing the hexagon is the cheapest fix for that.

     It lives in the phones group rather than the Blockbusters one because that is
     where a teacher looks for "what do the phones do" — but it is deliberately not
     a `phoneMode` *value*. A mode is a choice between things that cannot both be
     true during a question; this is a button that borrows the room for ten seconds
     between questions and hands it straight back, exactly like Ask the class. Making
     it a mode would mean a Blockbusters class could pick the hexagon or buzz on the
     clue, never both, when the round wants both at different moments. */
  S.register({ id:'bbTeamVote', group:'Phones', type:'toggle', default:true,
    games:['blockbusters'],
    label:'The team picks its hexagon on their phones',
    help:'Adds a button that asks the team on turn which letter to attack. Their votes land beside the legend and the hexagons light up; you still click the one that plays. Works alongside whatever the phones are doing during a clue. Needs a room; with no phones the button stays hidden.' });

  /* Blockbusters' own settings (bbWinRoute, bbEdges) moved with the game into
     game-hub/games/blockbusters.js. The shared keepControl (Competition) and bbTeamVote
     (Phones) stay here, in their shared groups. */

  /* A skin, not a rewrite. Game show is the default: the app is a classroom
     presentation tool and the lit look is what makes a class sit up, so it should be
     what you get without going and finding a setting. DCU remains one switch away and
     is unchanged.

     The skin covers the whole app, setup screens included — choosing a unit under
     stage lights is part of the moment. Which value applies: the game's own setting
     once a game is picked, the master before that. */
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


  /* Millionaire's own settings (mLifelines, mFinalAnswer, mConferSeconds) moved with
     the game into game-hub/games/millionaire.js. Its retirements stay here, because a
     migration drops an old key on every device whether or not that game is loaded. */
  /* **`mBuzzRole` was retired here, and the reason is worth keeping.** It asked what
     a buzz wins in Millionaire — name the speaker for the team on turn, take the
     question outright, or nothing — which was a real question while a rung was an
     ordinary clue that armed the handsets as buzzers.

     Its ladder became a round host: `phoneRound()` returns the Multiple Choice round
     for every live question, so the round owns the handsets and there is no buzzer
     for a role to be given to. Between questions nothing is open, and a buzz arriving
     then is refused and the room disarmed. So the setting could not fire in either
     state, and **a control a teacher can pick that changes nothing is worse than no
     control** — it reads as a broken game rather than as an absent feature.

     What is *not* decided by removing it: whether a buzz should pick who speaks for
     the team **before** the round takes the room, which is what `speaker` was always
     for and is a new beat rather than this switch. That stays open — see Next. */
  (function dropBuzzRole(){
    S.drop([''].concat(gameIds().map(g => '@' + g)).map(sfx => 'mBuzzRole' + sfx));
  })();
  (function dropRoundTune(){
    // the clue-card Tune pill is gone — settings live in the room bench now, so its switch retires
    S.drop([''].concat(gameIds().map(g => '@' + g)).map(sfx => 'roundTune' + sfx));
  })();

  /* **Who is competing: sides, or people.** Deliberately *not* per game. It is a
     fact about the room — the roster persists across games and unit switches, so a
     lesson cannot be in teams on one board and individual on the next without the
     scoreboard being rebuilt underneath the class. Which boards *can* do it is the
     game's own `solo` declaration, and the game screen only offers those; this row
     says what the room is doing.

     Registered with no `games`, the same as the relay address, because a per-game
     override here would offer a control that cannot mean anything. */
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

  /* Race's own settings (raceRescatter, raceRoundSeconds, raceShowSection) moved with
     the game into game-hub/games/race.js. */

  /* ---- sound: synthesised, so it needs no audio files and still works offline ---- */
  const Sound = (function(){
    const LEVEL = { quiet:0.035, med:0.09, loud:0.2 };
    // how loud the bed sits under the master volume; `off` is a real 0, so the
    // nodes are never built rather than being built and left silent
    const BED_MIX = { normal:0.30, quiet:0.12, off:0 };
    const VOICES = {
      correct:[{f:660,d:0.09},{f:990,d:0.13}],
      wrong:  [{f:180,d:0.16,type:'sawtooth'},{f:120,d:0.18,type:'sawtooth'}],
      claim:  [{f:523,d:0.07},{f:784,d:0.07},{f:1047,d:0.14}],
      end:    [{f:440,d:0.14},{f:330,d:0.2}],
      clear:  [{f:523,d:0.1},{f:659,d:0.1},{f:784,d:0.1},{f:1047,d:0.28}],
      flip:   [{f:240,to:820,d:0.3,type:'sine'}],
      reveal: [{f:880,d:0.07},{f:1319,d:0.19}],
      // game-show cues. Original riffs, not the shows' own music — everything here
      // is oscillators, so there is nothing to license and nothing to download.
      lock:   [{f:150,to:60,d:0.22,type:'sine'},{f:70,to:190,d:0.5,type:'sawtooth'}],
      klaxon: [{f:196,d:0.3,type:'square'},{f:185,d:0.42,type:'square'}],
      sting:  [{f:392,d:0.1,type:'square'},{f:523,d:0.1,type:'square'},{f:784,d:0.34,type:'square'}]
    };
    let ctx=null;
    function audio(){
      if(ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{ ctx = new AC(); }catch(e){ ctx=null; }
      return ctx;
    }
    function play(name){
      if(!S.get('sound', activeGame)) return;
      const seq = VOICES[name]; if(!seq) return;
      const ac = audio(); if(!ac) return;
      if(ac.state==='suspended' && ac.resume) ac.resume();
      const peak = LEVEL[S.get('soundVolume', activeGame)] || LEVEL.med;
      let at = ac.currentTime;
      seq.forEach(n=>{
        const osc=ac.createOscillator(), gain=ac.createGain();
        osc.type = n.type || 'triangle';
        osc.frequency.setValueAtTime(n.f, at);
        if(n.to) osc.frequency.exponentialRampToValueAtTime(n.to, at+n.d);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(peak, at+0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at+n.d);
        osc.connect(gain); gain.connect(ac.destination);
        osc.start(at); osc.stop(at+n.d+0.02);
        at += n.d*0.85;
      });
    }

    function level(){ return LEVEL[S.get('soundVolume', activeGame)] || LEVEL.med; }
    function bedMix(){
      const v = BED_MIX[S.get('musicBed', activeGame)];
      return (v === undefined) ? BED_MIX.normal : v;
    }
    function live(){
      if(!S.get('sound', activeGame)) return null;
      const ac = audio(); if(!ac) return null;
      if(ac.state==='suspended' && ac.resume) ac.resume();
      return ac;
    }

    /* Applause is filtered noise, not a sample — a burst of white noise through a
       bandpass lands close enough to a room clapping, and keeps the app offline. */
    function applause(ms){
      const ac = live(); if(!ac) return;
      const secs = (ms || 2200) / 1000;
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * secs), ac.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0; i<d.length; i++){
        // a slow random envelope on top of the noise gives it a hand-clap texture
        // rather than the flat hiss plain noise produces
        d[i] = (Math.random()*2 - 1) * (0.45 + 0.55*Math.random());
      }
      const src = ac.createBufferSource(); src.buffer = buf;
      const band = ac.createBiquadFilter(); band.type='bandpass'; band.frequency.value=1600; band.Q.value=0.7;
      const gain = ac.createGain();
      const t = ac.currentTime, peak = level()*0.9;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t+0.12);
      gain.gain.setValueAtTime(peak, t+secs*0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t+secs);
      src.connect(band); band.connect(gain); gain.connect(ac.destination);
      src.start(t); src.stop(t+secs+0.05);
    }

    /* Starting pistol. Same noise buffer as the applause, but the envelope is the
       whole sound: three milliseconds of attack and a 90ms tail through a highpass
       is a crack, where applause's slow swell is a room. */
    function crack(){
      const ac = live(); if(!ac) return;
      const secs = 0.16;
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate*secs), ac.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0; i<d.length; i++) d[i] = Math.random()*2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf;
      const hp = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=900;
      const gain = ac.createGain();
      const t = ac.currentTime, peak = level()*1.5;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t+0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t+0.09);
      src.connect(hp); hp.connect(gain); gain.connect(ac.destination);
      src.start(t); src.stop(t+secs);
    }

    /* Brass-ish rising figure for a cleared ladder — sawtooth under a lowpass is a
       serviceable horn section at classroom-speaker resolution. */
    function fanfare(){
      const ac = live(); if(!ac) return;
      const notes = [[392,0.14],[523,0.14],[659,0.14],[784,0.5]];
      let at = ac.currentTime, peak = level();
      notes.forEach(([f,d])=>{
        [1, 1.005, 2].forEach((mult, i)=>{      // slight detune + an octave = body
          const osc=ac.createOscillator(), g=ac.createGain(), lp=ac.createBiquadFilter();
          osc.type='sawtooth'; osc.frequency.setValueAtTime(f*mult, at);
          lp.type='lowpass'; lp.frequency.value=2600;
          const amp = peak * (i===2 ? 0.32 : 0.55);
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(amp, at+0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, at+d);
          osc.connect(lp); lp.connect(g); g.connect(ac.destination);
          osc.start(at); osc.stop(at+d+0.02);
        });
        at += d*0.92;
      });
    }

    /* ---- the think-music bed ----
       Runs while a question is live and stops the moment it is answered, so it
       never talks over the teacher reading out the result. Tension (0–1, driven by
       the rung) speeds the pulse up and opens the filter, which is most of what
       makes the top of a ladder feel different from the bottom. */
    let bed = null;
    function bedStart(tension){
      const ac = live(); if(!ac){ bedStop(); return; }
      if(!bedMix()){ bedStop(); return; }      // switched off in ⚙ — cues still play
      if(bed){ bedSet(tension); return; }
      const out  = ac.createGain();  out.gain.value = 0;
      const lp   = ac.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=7;
      const o1   = ac.createOscillator(); o1.type='sawtooth'; o1.frequency.value=55;    // A1
      const o2   = ac.createOscillator(); o2.type='sawtooth'; o2.frequency.value=82.41; // E2
      const lfo  = ac.createOscillator(); lfo.type='sine';
      const lfoG = ac.createGain();
      o1.connect(lp); o2.connect(lp); lp.connect(out); out.connect(ac.destination);
      lfo.connect(lfoG); lfoG.connect(out.gain);       // pulse, like a slow heartbeat
      [o1,o2,lfo].forEach(o=>o.start());
      bed = { out, lp, lfo, lfoG, oscs:[o1,o2,lfo] };
      bedSet(tension);
    }
    function bedSet(tension){
      if(!bed) return;
      const ac = audio(); if(!ac) return;
      const mix = bedMix();
      // turned off mid-question: fade the running bed out rather than leaving it
      // playing until the next beat happens to restart it
      if(!mix){ bedStop(); return; }
      const t = Math.max(0, Math.min(1, tension || 0));
      const base = level() * mix * (0.55 + 0.45*t);
      const now  = ac.currentTime;
      bed.out.gain.cancelScheduledValues(now);
      bed.out.gain.setTargetAtTime(base, now, 0.25);
      bed.lfoG.gain.setTargetAtTime(base*0.85, now, 0.25);
      bed.lfo.frequency.setTargetAtTime(0.9 + 1.5*t, now, 0.4);   // 54 → 144 bpm
      bed.lp.frequency.setTargetAtTime(260 + 520*t, now, 0.4);
    }
    function bedStop(){
      if(!bed) return;
      const ac = audio(), b = bed; bed = null;
      if(!ac){ return; }
      const now = ac.currentTime;
      b.out.gain.cancelScheduledValues(now);
      b.out.gain.setTargetAtTime(0.0001, now, 0.12);
      // let it fade before tearing the nodes down, or the stop clicks
      setTimeout(()=>{ try{ b.oscs.forEach(o=>o.stop()); b.out.disconnect(); }catch(e){} }, 600);
    }

    return { play, applause, crack, fanfare, bedStart, bedSet, bedStop };
  })();

  /* ---- UI skeleton (identical for every unit) ---- */
  const SKELETON = `
    <header>
      <div>
        <div class="eyebrow"></div>
        <h1 id="page-title">Game Hub</h1>
      </div>
      <div class="header-right">
        <span id="build-tag" title="App version — the settings cog moved to the room bench, so the build shows here">Build ${window.HUB_BUILD || 'dev'}</span>
        <div id="timer-widget">
          <button id="tmr-minus" title="−15 seconds">−</button>
          <span id="tmr-display">0:30</span>
          <button id="tmr-toggle" title="Start / pause">▶</button>
          <button id="tmr-reset" title="Reset">↺</button>
          <button id="tmr-plus" title="+15 seconds">+</button>
        </div>
        <button id="new-game-btn">↺ New game</button>
      </div>
    </header>
    <div class="geo-band"></div>

    <!-- The room, on every screen rather than only during a game. A class cannot
         join a room they cannot see the code for, and the whole of setup — picking a
         unit, a game, the sections — is exactly when they are walking in and getting
         their phones out. It was inside #screen-play, so the code appeared at the
         moment it stopped being useful. Above the screens rather than fixed, so the
         board still measures around it the way it always did. -->
    <div id="buzzer-chip" style="display:none;"></div>

    <!-- SCREEN 0: choose unit -->
    <div class="screen" id="screen-unit-select">
      <p class="intro" id="unit-intro">Choose a unit to gamify.</p>
      <div class="unit-grid" id="unit-grid"></div>
    </div>

    <!-- SCREEN 1: choose game -->
    <div class="screen" id="screen-game-select">
      <span class="back-link" id="change-unit" style="display:none;">&larr; Change unit</span>
      <p class="intro"></p>
      <!-- A board missing from this screen with nothing saying why reads as a bug.
           Filled by applyGameAvailability, and empty in team play. -->
      <p class="roster-note" id="roster-note" style="display:none;"></p>
      <div class="game-grid"></div>
    </div>

    <!-- SCREEN 2: choose content -->
    <div class="screen" id="screen-content-select">
      <span class="back-link" id="back-to-games">&larr; Back to game choice</span>
      <!-- **Teams or individuals is a setup decision, decided here.** It cannot
           usefully be changed once a board is running: sixteen people cannot be
           regrouped into four teams without rebuilding the roster, and rebuilding it
           bins a lesson's points. So it is asked before the game starts, next to the
           other how-shall-we-run-it choices (Race's mode picker is right below), and
           the bar's own switch stands down while a game is on. -->
      <div id="roster-pick">
        <div class="mode-title">Who is competing?</div>
        <div id="roster-pick-opts"></div>
        <p class="helptext" id="roster-pick-note"></p>
      </div>
      <p class="helptext" id="content-helptext"></p>
      <!-- Narrow by round type. Built from whatever is in this game's bank, and
           hidden when there is nothing to choose between. -->
      <div id="round-filter" style="display:none;"></div>
      <div id="content-list"></div>
      <div class="rules-note" id="blockbusters-rules" style="display:none;">
        <span class="team-tag tag-gold">YELLOW</span> connects a path of hexagons from the <strong>left</strong> edge to the <strong>right</strong> edge.<br>
        <span class="team-tag tag-silver">BLUE</span> connects a path from the <strong>top</strong> edge to the <strong>bottom</strong> edge.<br>
        Click a hexagon, read the clue aloud &mdash; the answer starts with the letter shown. Correct = claim it. Wrong = the other team can steal it.
      </div>
      <div id="race-mode" style="display:none;">
        <div class="mode-title">How do you want to run it?</div>
        <label class="mode-opt">
          <input type="radio" name="racemode" value="h2h" checked>
          <span><strong>Head-to-head</strong> &mdash; both teams at the board at once. First to touch the word wins the point. No clock.</span>
        </label>
        <label class="mode-opt">
          <input type="radio" name="racemode" value="timed">
          <span><strong>Timed team rounds</strong> &mdash; one team at a time, as many as they can before the clock runs out.</span>
        </label>
      </div>
      <div class="rules-note" id="race-rules" style="display:none;"></div>
      <button id="start-btn" disabled>Select content to continue</button>
    </div>

    <!-- SCREEN 3: play -->
    <div class="screen" id="screen-play">
      <!-- Everything the class does, in one place, for every game and every mode:
           who buzzed, who typed what, what the room answered, who just scored. It
           used to be four different places — the chip, the clue card, under the race
           sentence, under the Millionaire question — so the same event looked
           different on every board and moved the board while it did it. Fixed
           height, so what it says can never reflow the game. -->
      <div id="phone-bar" style="display:none;"></div>
    </div>

    <!-- title sequence. Empty and inert unless a game show themed game opens it. -->
    <div id="intro-overlay" aria-hidden="true">
      <div class="intro-sweep"></div>
      <div class="intro-bulbs"></div>
      <div id="intro-inner">
        <div id="intro-eyebrow"></div>
        <div id="intro-title"></div>
        <div id="intro-sub"></div>
      </div>
      <div id="intro-skip">Press any key to skip</div>
    </div>

    <!-- Persistent team bar, under the board and visible on every screen. It rode
         in the header for one build; back down here because the header is for the
         teacher's instruments and the bar is the game's state — the room reads it,
         not just the teacher. Kit.floorTop() is what keeps boards off it. -->
    <div id="scorebar"></div>

    <!-- end-of-round banner. Deliberately a banner and not a full-screen modal: the
         whole point of a Blockbusters win is the route lit up on the board behind it,
         so this sits above the team bar and leaves the board visible. -->
    <div id="result-modal">
      <div id="result-card">
        <div id="result-eyebrow"></div>
        <h2 id="result-title"></h2>
        <p id="result-sub"></p>
        <div id="result-actions"></div>
      </div>
    </div>

    <!-- The standings, between questions. **A sibling of every stage, not inside
         one** — the same place the clue card, the join lobby and the result banner
         live, and for the same reason: it is the container's surface that any board
         borrows. Quickfire's own leaderboard was inside the play-kahoot stage, which
         is exactly why it was squeezed and ran off a 720px board.
         (No backticks in here: the skeleton is a template literal, and one closes it.)
         It replaces the round-winner banner rather than following it: one moment
         that names who took the question *and* shows everyone else moving beats two
         screens back to back. -->
    <div id="standings-modal">
      <div id="standings-card">
        <div id="standings-eyebrow"></div>
        <h2 id="standings-title"></h2>
        <div id="standings-rows"></div>
        <button id="standings-go" type="button">Continue</button>
        <!-- The debugging way into the score report: quiet, but on the screen a
             teacher is looking at when a number reads wrong. -->
        <button id="standings-report" type="button">score report</button>
      </div>
    </div>
    <div id="report-modal">
      <div id="report-card">
        <h2>Score report</h2>
        <p class="rp-note">Per question: what each team actually gained against what
        the payout said it should. A red line is a discrepancy.</p>
        <div id="report-body"></div>
        <div class="rp-actions">
          <button id="report-clear" type="button">Clear ledger</button>
          <button id="report-close" type="button">Close</button>
        </div>
      </div>
    </div>


    <!-- the join lobby: thrown on the projector so a class can scan in -->
    <div id="join-modal">
      <div id="join-card">
        <div id="join-eyebrow">Scan to join</div>
        <div id="join-qr"></div>
        <div id="join-code"></div>
        <div id="join-url"></div>
        <div id="join-count"></div>
        <!-- Who is in, each removable. The way out of a phantom: a handset that
             died without closing its connection stays on the roster, inflates its
             team's size, and quietly breaks every share and every all-agree gate.
             Nothing else can remove it, so the teacher can. -->
        <div id="join-roster"></div>
        <button id="join-close" type="button">Close</button>
      </div>
    </div>

    <!-- shared clue modal -->
    <div id="clue-modal">
      <div id="clue-card">
        <div id="clue-front"><span id="clue-front-text"></span></div>
        <div id="clue-back">
        <!-- Inside the back face, not on the card: the card is a 3D flip context
             whose faces carry the counter-rotation, so a child of the card itself
             renders mirrored. Everything readable lives on a face. -->
        <div id="clue-topline"></div>
        <div id="clue-section"></div>
        <div id="clue-text"></div>
        <!-- Daily Double / Final: the bet is placed before the clue is shown, so
             this stands where the clue will be rather than beside it. -->
        <div id="wager-panel" style="display:none;">
          <div id="wager-who"></div>
          <div id="wager-amount">0</div>
          <div id="wager-range"></div>
          <div id="wager-steps"></div>
          <div id="wager-quick"></div>
        </div>
        <div id="clue-answer"></div>
        <div id="clue-actions">
          <button id="hint-btn" style="display:none;">Need a hand?</button>
          <button id="group-btn" style="display:none;">Check these</button>
          <button id="wager-ok" style="display:none;">Lock it in</button>
          <button id="reveal-btn">Reveal answer</button>
          <button id="correct-btn" style="display:none;">✓ Correct</button>
          <button id="wrong-btn" style="display:none;">✗ Wrong</button>
          <div id="clue-claim"></div>
          <button id="skip-btn" style="display:none;">No claim / close</button>
          <button id="close-btn" style="display:none;">Close</button>
        </div>
        </div>
      </div>
    </div>`;

  const root = document.getElementById('game-hub-root') || document.body;
  root.innerHTML = SKELETON;
  /* An external game's stage panel — `stageHTML` on its registration — goes in
     beside the in-skeleton stages, before anything measures. Only when the
     skeleton does not already hold the id, so an in-engine game moving to its
     own file can carry its markup with it without a collision on the way. */
  /* Anchored on `#phone-bar`, the last fixed sibling before the stages, because every
     board is external now — including Jeopardy, whose `#play-jeopardy` used to be the
     in-skeleton anchor. Stages are appended in registration order, so Jeopardy (order
     50) lands first, right after the phone bar, exactly where it sat before. */
  window.HubGames.ids().forEach(g => {
    const d = window.HubGames.get(g);
    if(!d || !d.stageHTML || document.getElementById(d.stage)) return;
    const host = document.getElementById('phone-bar');
    if(host && host.parentNode){
      const t = document.createElement('template');
      t.innerHTML = d.stageHTML.trim();
      host.parentNode.appendChild(t.content);
    }
  });

  /* ---- current unit content (set by loadUnit) ---- */
  let UNIT = null;

  // Which games a unit can actually offer — a unit without a bank for a game
  // simply doesn't show that card, so units can adopt new games one at a time.
  /* Two reasons a board may not be on offer, and they are the same kind of reason:
     it has no content for this unit, or it is not built for the way the room is
     competing. Both are the game's own declaration — `hasBank` and `solo` — so a
     seventh board answers for itself and nothing here holds a list. */
  function suitsRoster(g){ return !Roster.solo() || g.solo; }
  function gamesFor(u){
    return GAMES.filter(g => g.hasBank(u) && suitsRoster(g)).map(g => g.id);
  }

  /* Split out of `loadUnit` because the roster mode can change while a unit is
     already loaded, and re-running `loadUnit` would reload every bank to redraw
     some cards. */
  function applyGameAvailability(){
    if(!UNIT) return;
    const available = gamesFor(UNIT);
    document.querySelectorAll('.game-card').forEach(c=>{
      c.style.display = available.includes(c.dataset.game) ? 'block' : 'none';
    });
    const note = document.getElementById('roster-note');
    if(note){
      const hidden = GAMES.filter(g => g.hasBank(UNIT) && !suitsRoster(g));
      note.textContent = hidden.length
        ? 'Playing as individuals — ' + hidden.map(g => g.title).join(', ') +
          (hidden.length === 1 ? ' is' : ' are') + ' built for teams and not shown.'
        : '';
      note.style.display = hidden.length ? 'block' : 'none';
    }
  }

  function loadUnit(u){
    UNIT = u;
    GAMES.forEach(g => g.load(u));
    applyGameAvailability();
    document.querySelector('.eyebrow').textContent = u.label || '';
    document.querySelector('#screen-game-select p.intro').textContent = u.intro || '';
    if(u.label){ document.title = u.label + ' — Game Hub'; }
  }

  /* ================= UNIT SELECT ================= */
  function renderUnitSelect(){
    const grid=document.getElementById('unit-grid'); grid.innerHTML='';
    UNITS.forEach(u=>{
      const c=u.card||{};
      const el=document.createElement('div');
      el.className='unit-card';
      el.innerHTML = `<span class="unit-num">${c.num||u.id||'Unit'}</span>`+
        `<h2>${c.title||''}</h2><p>${c.blurb||''}</p>`+
        `<div class="games">${gamesFor(u).map(g=>`<span>${HUB_GAME_TITLES[g]}</span>`).join('')}</div>`;
      el.addEventListener('click', ()=>{ loadUnit(u); document.getElementById('page-title').textContent='Game Hub'; showScreen('screen-game-select'); });
      grid.appendChild(el);
    });
  }

  /* ================= STATE / NAVIGATION ================= */
  let activeGame = null;
  let selectedContent = [];

  /* A team is data, never DOM: renderScorebar() tears the whole bar down and
     rebuilds it on every score change, so anything held in an element is destroyed.
     `run` is the current unbroken streak of correct answers. */
  /* **A competitor, not a team.** The scoreboard has always held teams because
     that is all a class-facing board has ever had, but nothing in the shape says
     "team": a name, a score and a streak fit one person exactly as well. Widening
     the meaning here is what lets the roster later be built from the phones in the
     room rather than from the + Team button, without every board learning about it
     — the 60-odd places that read `roster[i].name` and `roster[i].score` do not
     care what put it there.

     `id` is new and is the thing solo play cannot do without. An index is a
     competitor's identity everywhere today, which is why removing one is a special
     case rather than a splice, and it is why the first live class paid a win to a
     team that no longer existed. A person has to be matched to their handset
     across a reconnect, and an index cannot do that. The round record reads it
     now — `Kit.round.results` stamps each row with it and `remap` follows it when
     the roster shifts under a live question — and the solo seat map stores it. */
  let nextCompetitorId = 1;
  /* `auto` means "nobody chose this name" — it is the placeholder the app starts
     with, not something a teacher typed. It is what lets the first two students to
     join a solo room take the two default slots instead of landing under them, and
     it is cleared the moment anybody renames one. */
  function newTeam(name, auto){
    return { id:'c' + (nextCompetitorId++), name, score:0, run:0, auto:!!auto };
  }

  /* Teams could be added and never removed, so a class that split four ways one
     lesson carried four teams into the next one. Removing is more than a splice,
     because a team's *index* is its identity in more than one place:
       - `active`, which has to follow the team it pointed at rather than the slot;
       - `bbSideAt`, which team is up within each Blockbusters alliance;
       - and any game holding per-team state keyed by index — the ladder Millionaire
         climbs — which is told through the `onTeamsChanged` hook rather than reached
         into by name here, so an extracted game re-aligns its own state.
     Two is the floor: every board is built for at least two sides. */
  function removeTeam(i){
    if(teams.length <= Roster.floor() || !teams[i]) return;
    // points are a lesson's worth of work — a mis-tap must not silently bin them
    if(teams[i].score !== 0 &&
       !confirm('Remove ' + teams[i].name + '? They have ' + teams[i].score + ' points.')) return;
    teams.splice(i, 1);
    // a team was removed at index i: the active board shifts its own per-team state
    // (Millionaire's ladder, Blockbusters' side-turn) through the hook
    hook('onTeamsChanged', i);
    if(active > i) active--;
    if(active >= teams.length) active = teams.length - 1;
    /* The phones' indices shift with the board's, or the two disagree for the
       rest of the lesson — the first live class paid a Drag the Letters win to a
       team that no longer existed, because every joined phone kept the number it
       joined under. The relay renumbers its players, tells each moved phone, and
       answers with a roster refresh that re-deals, re-shares and re-reads. */
    if(buzzHost) buzzHost.remap(i);
    renderScorebar();
    hook('onRoster');   // the active board repaints anything that names teams
    hook('onResize');
    /* Last, after the phones have been renumbered and the board repainted: a live
       round recorded its answers under the team numbers that just shifted, so it is
       re-put on the new roster rather than left to pay the wrong side. A no-op when
       no clue is open, which is every removal but a mid-question one. */
    roundRebuildForRoster();
  }

  /* The roster: whoever is competing for points, persisting across games AND unit
     switches until Reset. Still called `teams` throughout, because it is read in
     about sixty places and a rename would be churn with no gain — what matters is
     that the *meaning* is now "the competitors" and only `Roster` decides what
     goes in it. In team play a teacher fills it with the + Team button. In solo
     play it would be filled from the phones that have joined, and every board
     would be unaffected. */
  let teams = [newTeam('Team 1', true), newTeam('Team 2', true)];

  /* **The one seam.** Everything that *reads* the roster keeps indexing the array
     directly, which is fine and stays. What goes through here is everything that
     *changes* it — because that is the only part that differs between a room of
     teams and a room of people, and putting it in one place is what stops solo
     play from being sixty edits.

     `mode` reads the `roster` setting rather than holding a copy of it. A stored
     mode is a second answer to a question the settings already answer, and the two
     would differ the first time somebody changed it mid-lesson. */
  const Roster = {
    get mode(){ return S.get('roster') === 'solo' ? 'solo' : 'teams'; },
    solo(){ return this.mode === 'solo'; },
    all(){ return teams; },
    at(i){ return teams[i] || null; },
    count(){ return teams.length; },
    indexes(){ return teams.map((_, i) => i); },
    byId(id){ return teams.find(t => t.id === id) || null; },
    /* Two is the floor in team play — every board is built for at least two
       sides — and the caller is the team bar, which hides its own remove control
       there. Named here so a solo roster can answer differently. */
    floor(){ return 2; },
    add(name){
      const fallback = (this.solo() ? 'Player ' : 'Team ') + (teams.length + 1);
      teams.push(newTeam(name || fallback, !name));
      return teams.length;
    },
    label(){ return this.solo() ? 'player' : 'team'; },
    /* Capitalised for a button; the lowercase one is for a tooltip mid-sentence. */
    Label(){ const l = this.label(); return l.charAt(0).toUpperCase() + l.slice(1); }
  };

  /* The room bench's handle on the team bar, same-origin only. `ensure` grows and
     never shrinks: the teacher's team bar stays the sole owner of teams, and the
     bench applying a 4×4 preset is automating the teacher's own + Team clicks —
     removal stays a decision a human makes, because a team can be holding points. */
  window.HubTeams = {
    count(){ return teams.length; },
    ensure(n){
      /* Eight was the cap when this only ever grew a team bar. A room of
         individuals is a class, so the ceiling is a class. */
      n = Math.max(0, Math.min(40, Number(n) || 0));
      let grew = false;
      while(teams.length < n){ Roster.add(); grew = true; }
      if(grew){ renderScorebar(); hook('onRoster'); }
      return teams.length;
    },
    /* **Exactly n, which is what a classroom-division preset means.** `ensure` only
       ever grew, so the room bench's 4×4 → 3×3 → 2×2 left the board on four teams
       while the rack showed two — the bench quietly disagreeing with the board it is
       there to mirror, which makes it useless for the one job it has.

       Shrinking is still not free, and the reason `ensure` was grow-only stands:
       removing a team can bin points somebody earned. But that reason belongs to a
       lesson in progress, not to setting the room up — so this refuses rather than
       asks, and says which it did. The caller is a preset button, not a person
       deciding; a confirm dialog behind a remote control is nobody's idea of a
       question. `removeTeam` keeps its own confirm for the human path. */
    size(n){
      n = Math.max(Roster.floor(), Math.min(40, Number(n) || 0));
      const playing = document.getElementById('screen-play').classList.contains('active');
      const held    = teams.some(t => t.score !== 0);
      if(teams.length > n && (playing || held))
        return { count: teams.length, refused: playing ? 'a game is running' : 'a team has points' };
      while(teams.length > n) removeTeam(teams.length - 1);
      this.ensure(n);
      return { count: teams.length };
    }
  };
  let active = 0;   // jeopardy: selected/active team index

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    hideResult();                       // a banner belongs to the round that raised it
    document.getElementById('new-game-btn').style.display = (id==='screen-play') ? 'inline-block' : 'none';
    document.getElementById('timer-widget').style.display = (id==='screen-play') ? 'flex' : 'none';
    // these boards size themselves around the team bar, so they don't need the body
    // padding that keeps the bar clear of the other screens
    document.body.classList.toggle('play-fit',
      id==='screen-play' && !!(gameDef() && gameDef().fitsScreen));
    if(id!=='screen-play') timerStop();
    applyTheme();
    if(id!=='screen-play'){
      Sound.bedStop();
      // `lit` marks a stage that is being played; leaving the play screen ends that,
      // and a stale one would light up again the moment the panel is shown
      // ask the registry for the stages rather than restating them: a fifth game
      // was otherwise a stage that never got its `.lit` cleared
      gameIds().forEach(id => {
        const el = document.getElementById(gameDef(id).stage);
        if(el) el.classList.remove('lit');
      });
    }
    renderScorebar();   // team bar is always visible; refresh its highlight/cues
  }

  /* ================= THEME =================
     A skin is a body class and a block of CSS overrides, not a second stylesheet —
     the DCU look is one switch away and entirely untouched by any of this. */
  function themeOf(game){ return S.get('theme', game || activeGame) || 'dcu'; }
  /* The skin is on everywhere, not just the play screen — a lit board reached through
     a white setup screen loses the moment before it starts. `themeOf()` resolves to
     the active game's setting once one is chosen and the master value before that,
     so picking a unit uses whatever the teacher's default is. */
  function applyTheme(){
    document.body.classList.toggle('theme-gameshow', themeOf() === 'gameshow');
  }
  S.onChange(id=>{ if(id === 'theme') applyTheme(); });   // ⚙ changes show at once
  /* Switching who is competing has to reach the screen it changes: the game cards,
     because half of them are no longer on offer, and the team bar, because its add
     button and its remove tooltips are named after what a competitor is. Neither is
     rebuilt on a timer, so a setting read once at build time is a setting the
     panel cannot change live — the Daily Double paid for that lesson. */
  /* **Each mode keeps its own roster, and switching swaps between them.**
     Reported as "it won't switch back", and the picker was innocent: the setting,
     the radio and the bar all flipped: what did not change was the *list*, so teams
     mode showed three competitors called Ana, Ben and Cara and looked exactly like
     the solo it had just left.

     A roster of people and a roster of teams are two different lists, and neither
     can be derived from the other — so both are kept, and going back and forth costs
     nothing. Without this, switching to solo would bin whatever teams a teacher had
     set up and switching back would leave the class as competitors, which is why the
     switch felt broken in both directions. */
  const rosterStash = Object.create(null);
  /* **The phones have a roster mode too, and forgetting that scrambled a class.**
     Solo seats every handset into its own competitor, which overwrites the team the
     student picked when they joined — so coming back to teams left each phone
     holding the *index* it had been seated at, now pointing at whatever team happens
     to sit there. Four phones went Team 1/1/2/2 → solo → Team 2/3/4/1, silently, and
     their answers would have scored for the wrong side.

     The board already keeps two rosters and swaps between them; this is the same
     idea one layer out. What the teams roster remembers is where each *player* was,
     by player id — never by index, for the reason `soloSeat` is keyed that way. */
  const teamSeat = Object.create(null);     // playerId -> the side this student chose
  let reseatTeams = false;                  // set on the way back, cleared once done
  function swapRoster(to){
    const from = to === 'solo' ? 'teams' : 'solo';
    reseatTeams = to === 'teams';
    /* Only `soloSeat` — who owns which row — is stashed. There used to be a second
       map beside it recording the index last sent to each phone, and it had to be
       stashed, cleared and restored in step with this one; it is gone, because
       seating now compares against what the room believes rather than against a
       memory of what it was told. */
    rosterStash[from] = { list: teams.slice(),
                          seat: Object.assign({}, soloSeat) };
    const back = rosterStash[to];
    teams.length = 0;
    Object.keys(soloSeat).forEach(k => delete soloSeat[k]);
    if(back){
      back.list.forEach(t => teams.push(t));
      Object.assign(soloSeat, back.seat);
    }else{
      /* Two placeholders rather than none: every board is built for at least two
         sides, and in solo the first two students to join claim them rather than
         landing under two empty rows. */
      const word = to === 'solo' ? 'Player ' : 'Team ';
      teams.push(newTeam(word + '1', true), newTeam(word + '2', true));
    }
    /* The roster was replaced wholesale, so any game holding per-team state keyed by
       index resets it (the ladder Millionaire climbs) — told through the hook rather
       than reached into here — and `active`, an index into the old list, goes to 0. */
    hook('onTeamsChanged', -1);
    active = 0;
    /* The seats we just cleared have to be re-sent, or every phone keeps the number
       it was given under the old roster — the index-shift bug that paid a win to a
       team that no longer existed, one switch over. */
    lastPushedTeams = null;
  }

  S.onChange(id=>{
    if(id !== 'roster') return;
    swapRoster(Roster.mode);
    applyGameAvailability();
    renderRosterPick();
    renderScorebar();
    /* Seat whoever is already in the room rather than waiting for the next phone —
       in solo that fills the roster on the spot, and in teams it puts each handset
       back on the side its student chose. */
    if(buzzHost){ seatSoloPlayers(buzzHost.players()); seatTeamPlayers(buzzHost.players()); }
  });

  function motionOK(){
    try{ return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return true; }
  }

  /* ---- title sequence ----
     One sequence, per-game copy and colour — so the next game to want an ident is a
     line in INTROS, not another animation. Always skippable and always short: four
     seconds times four games times every lesson is real teaching time. Resolves
     when it's done or the moment anybody skips it, so callers can just await it. */
  const INTROS = {
    millionaire: { eyebrow:'Cambridge Empower C1', title:'MILLIONAIRE',
                   sub:'Eight rungs. One team at a time. No safety net.',
                   accent:'#FFC83D' },
    jeopardy:    { eyebrow:'Cambridge Empower C1', title:'JEOPARDY',
                   sub:'Pick your category. Pick your price. Answer it.',
                   accent:'#4FC3FF' },
    // violet, because the board's own yellow and blue are structural and both have
    // to read against whatever the stage is
    blockbusters:{ eyebrow:'Cambridge Empower C1', title:'BLOCKBUSTERS',
                   sub:'Yellow goes across. Blue goes down. Build your line.',
                   accent:'#C77DFF' },
    // a four-word title needs a smaller cap than a one-word one, or it runs off
    // the screen at the shared 11vw
    race:        { eyebrow:'Cambridge Empower C1', title:'RACE TO THE BOARD',
                   sub:'On your marks. Listen for the gap. Get there first.',
                   accent:'#3DFFA8', titleVw:'6.4vw' }
  };
  const introShown = Object.create(null);      // per session, for the 'once' setting

  function wantsIntro(game){
    if(themeOf(game) !== 'gameshow' || !INTROS[game]) return false;
    const mode = S.get('intro', game);
    if(mode === 'off') return false;
    if(mode === 'once' && introShown[game]) return false;
    return true;
  }

  function runIntro(game){
    const cfg = INTROS[game];
    introShown[game] = true;
    const el = document.getElementById('intro-overlay');
    document.getElementById('intro-eyebrow').textContent = cfg.eyebrow;
    document.getElementById('intro-title').textContent   = cfg.title;
    document.getElementById('intro-sub').textContent     = cfg.sub;
    el.style.setProperty('--accent', cfg.accent);
    el.style.setProperty('--title-vw', cfg.titleVw || '11vw');

    const ms = motionOK() ? 3600 : 1200;
    el.classList.toggle('still', !motionOK());
    el.classList.add('on');

    return new Promise(resolve=>{
      let done = false;
      const finish = ()=>{
        if(done) return; done = true;
        clearTimeout(timer);
        document.removeEventListener('keydown', skip, true);
        el.removeEventListener('click', skip);
        el.classList.remove('on', 'still');
        resolve();
      };
      const skip = e=>{ if(e.type==='keydown' && e.key==='Escape') return; finish(); };
      const timer = setTimeout(finish, ms);
      document.addEventListener('keydown', skip, true);
      el.addEventListener('click', skip);

      if(motionOK()){
        Sound.play('lock');
        setTimeout(()=>Sound.play('sting'), 620);
        setTimeout(()=>Sound.fanfare(), 1150);
      } else {
        Sound.play('sting');
      }
    });
  }

  /* ---- end-of-round banner ----
     One banner for any game that reaches an ending, so the next game to need one
     writes no markup. It sits above the team bar rather than over the board,
     because what a class wants to look at when a round ends is the board.

       showResult({ eyebrow, title, sub, tone:'gold'|'silver'|null,
                    actions:[{label, primary, onPick}] }) */
  let resultOnHide = null;
  /* Which showing of the banner is which. A banner that hides itself on a timer
     must only hide *its own* showing — a stale timer from a round's winner moment
     firing into the game's final results would take them down mid-read. */
  let resultSeq = 0;
  function showResult(cfg){
    const modal = document.getElementById('result-modal');
    resultSeq++;
    resultOnHide = cfg.onHide || null;
    document.getElementById('result-eyebrow').textContent = cfg.eyebrow || '';
    document.getElementById('result-title').textContent   = cfg.title || '';
    document.getElementById('result-sub').textContent     = cfg.sub || '';
    document.getElementById('result-card').className      = cfg.tone ? 'tone-'+cfg.tone : '';

    const acts = document.getElementById('result-actions');
    acts.innerHTML='';
    (cfg.actions||[]).forEach(a=>{
      const b=document.createElement('button');
      b.type='button'; b.textContent=a.label;
      if(a.primary) b.className='primary';
      b.addEventListener('click', ()=>{ hideResult(); if(a.onPick) a.onPick(); });
      acts.appendChild(b);
    });

    // sit above whatever the floor is — the team bar when it was down here, the
    // bottom of the screen now that it isn't. Same question every fit asks.
    modal.style.bottom = (window.innerHeight - Kit.floorTop() + 16) + 'px';
    modal.classList.add('on');
    if(cfg.onShow) cfg.onShow();
  }
  function hideResult(){
    document.getElementById('result-modal').classList.remove('on');
    const fn = resultOnHide; resultOnHide = null;
    if(fn) fn();
  }
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){ hideResult(); hideStandings(); }
  });

  /* ================= the standings, between questions =================
     **A running total cannot show movement, which is the whole reason this needed
     new state.** `score` is one number per competitor with no history, so nothing
     could say a team was third and is now first — and that, rather than the number
     itself, is what a class watches. The team bar carries the totals all game; this
     carries the *change*, which is only interesting for a moment and then is not.

     Two snapshots and nothing else: the scores as the question opened, and the
     ranking as the standings were last shown. Gains come from the first, arrows from
     the second. Deliberately not a per-question log — nothing yet asks "what happened
     in question four", and a store nobody reads is a store that goes stale silently.

     **It reads `teams`, exactly as the bottom strip does.** One source of numbers:
     two scoreboards that count separately will eventually disagree, and the one on
     the wall is the one thirty students believe. */
  let standingsBefore = null;      // score per competitor when the question opened
  let standingsRank   = null;      // place per competitor when last shown

  /* ---------- the score report ----------
     **A per-question ledger, for checking that points were given correctly** —
     asked for after the first ef-2a class paid a team 600 on a 500 card and nobody
     could say from where. One entry per question: the scores as it opened, the
     scores when the next one opened, the results record and the expected payout at
     the moment the slot paid. Actual gain (after minus before) against expected is
     the whole diagnostic: a discrepancy names the question it happened in.

     Persisted in localStorage so it survives into the staffroom after a lesson;
     capped, and cleared from the report screen rather than automatically, because
     the ledger of the game that just went wrong is the one thing not to throw
     away. Display only — nothing in the app reads it back. */
  const REPORT_KEY = 'engishism.scoreReport';
  let scoreReport = [];
  try{ scoreReport = JSON.parse(localStorage.getItem(REPORT_KEY) || '[]') || []; }catch(e){}
  function reportSave(){
    try{ localStorage.setItem(REPORT_KEY, JSON.stringify(scoreReport.slice(-200))); }catch(e){}
  }
  function reportCloseEntry(){
    const e = scoreReport[scoreReport.length - 1];
    if(e && !e.after){ e.after = teams.map(t => t.score); reportSave(); }
  }
  function reportOpenEntry(label){
    reportCloseEntry();
    scoreReport.push({ label, when: new Date().toISOString().slice(0, 19),
                       build: window.HUB_BUILD || null,
                       names: teams.map((t, i) => teamName(i)),
                       before: teams.map(t => t.score),
                       after: null, expected: null, results: null });
    reportSave();
  }
  /* A divider, written when a board starts. The ledger persists across games and
     across deploys — "Jeopardy" twice in one lesson is two different games the
     labels alone cannot separate, and which build produced an entry is the first
     question when a score reads wrongly after a fix. Closed as it is written
     (`after` set), so ledgerNote can never mistake it for an open question and a
     movement can never land inside it. */
  function reportGameStart(){
    reportCloseEntry();
    scoreReport.push({ divider: true, label: 'new game · ' + (activeGame || '?'),
                       when: new Date().toISOString().slice(0, 19),
                       build: window.HUB_BUILD || null,
                       names: [], before: [], after: [] });
    reportSave();
  }
  /* ---------- every point movement, named ----------
     The report used to *diff* scores and infer what happened, which is exactly how
     an unexplained 600 stays unexplained: a movement the diff cannot attribute
     reads as a mystery rather than as a line item. Every path that touches a score
     now writes a move — `{t, d, why}` — into the open entry, and the renderer
     checks the sum of a team's moves against its actual gain, so anything that
     still bypasses the ledger names itself as a discrepancy instead of hiding.

     **Called before the score moves, always.** A note that has to open its own
     entry snapshots `before` as it opens, and a snapshot taken after the movement
     would swallow it — the gain would read 0 against a move that says otherwise,
     a false alarm manufactured by the instrument itself. */
  function ledgerNote(team, delta, why){
    let e = scoreReport[scoreReport.length - 1];
    if(!e || e.after){
      /* A movement outside any question — a manual correction, a plain tile, the
         final clue — still lands somewhere with its name on it. */
      reportOpenEntry('between questions · ' + (activeGame || 'setup'));
      e = scoreReport[scoreReport.length - 1];
    }
    (e.moves = e.moves || []).push({ t: Number(team), d: delta, why: String(why || '') });
    reportSave();
  }
  /* Called after the slot pays. Expected = the slot at what it actually paid, plus
     the payout table's share for every other competitor the record says finished. */
  function reportPayout(slotTeam, paid){
    const e = scoreReport[scoreReport.length - 1];
    if(!e) return;
    e.results = Kit.round.results.list();
    const pay = roundPayout();
    e.expected = teams.map((t, i) =>
      i === slotTeam ? (paid || 0)
      : ((Kit.round.results.of(i) || {}).done ? (pay[i] || 0) : 0));
    reportSave();
  }
  window.HubReport = {
    list(){ return scoreReport.slice(); },
    clear(){ scoreReport = []; reportSave(); },
    show(){ renderScoreReport(); }
  };
  function renderScoreReport(){
    reportCloseEntry();
    const modal = document.getElementById('report-modal');
    const body  = document.getElementById('report-body');
    if(!modal || !body) return;
    body.innerHTML = '';
    if(!scoreReport.length){
      body.textContent = 'Nothing recorded yet \u2014 the ledger starts when a question opens.';
    }
    scoreReport.slice(-60).forEach(e=>{
      if(e.divider){
        const gh = document.createElement('div');
        gh.className = 'rp-game';
        gh.textContent = e.label + '   ' + (e.when || '') +
                         (e.build ? '   · build ' + e.build : '');
        body.appendChild(gh);
        return;
      }
      const row = document.createElement('div');
      row.className = 'rp-q';
      const h = document.createElement('div');
      /* An entry names its build only when it is not this one — a report read
         after a deploy says which entries predate the fix, and a normal report
         stays quiet. */
      h.className = 'rp-label';
      h.textContent = e.label + '   ' + (e.when || '') +
        (e.build && e.build !== window.HUB_BUILD ? '   · build ' + e.build : '');
      row.appendChild(h);
      const after = e.after || teams.map(t => t.score);
      (e.names || []).forEach((nm, i)=>{
        const gain  = (after[i] || 0) - (e.before[i] || 0);
        const moves = (e.moves || []).filter(m => m.t === i);
        const sum   = moves.reduce((a, m) => a + (m.d || 0), 0);
        const exp   = e.expected ? (e.expected[i] || 0) : null;
        if(!gain && !exp && !moves.length) return;
        /* With moves the check is exact: the sum of what the ledger says happened
           against what actually happened. A movement that bypassed the ledger \u2014
           the class of thing the unexplained 600 was \u2014 shows as the difference.
           Entries from before the ledger fall back to the old expected diff. */
        const off = moves.length ? sum !== gain : (exp != null && exp !== gain);
        const line = document.createElement('div');
        line.className = 'rp-team' + (off ? ' off' : '');
        const r = (e.results || []).filter(x => x.who === i)[0];
        line.textContent = nm + ': ' + (gain >= 0 ? '+' : '') + gain +
          (moves.length && off ? '  (the moves say ' + (sum >= 0 ? '+' : '') + sum + ')' : '') +
          (!moves.length && exp != null ? '  (expected ' + (exp >= 0 ? '+' : '') + exp + ')' : '') +
          (r ? '  \u00b7 ' + (r.done ? 'finished ' + ordinalReport(r.place) : 'answered') +
               ' at ' + (r.seconds || 0).toFixed(1) + 's' : '');
        row.appendChild(line);
        moves.forEach(m=>{
          const mv = document.createElement('div');
          mv.className = 'rp-move';
          mv.textContent = (m.d >= 0 ? '+' : '') + m.d + '  \u00b7 ' + (m.why || 'unlabelled');
          row.appendChild(mv);
        });
      });
      body.appendChild(row);
    });
    modal.classList.add('on');
  }
  function ordinalReport(n){ return n + ({1:'st',2:'nd',3:'rd'}[n] || 'th'); }

  function standingsOpen(){
    standingsBefore = teams.map(t => t.score);
    reportOpenEntry(activeGame + ' \u00b7 ' + ((roundDef() || {}).label || 'question') +
                    (currentClueValue ? ' \u00b7 ' + currentClueValue : ''));
  }

  /* Ordered, with the gain and the movement worked out. Separate from the drawing so
     a check can ask what the room is being shown without reading the DOM. */
  function standingsRows(){
    const was = standingsBefore || [];
    const rows = teams.map((t, i) => ({ i, name:t.name, pts:t.score,
                                        gain: t.score - (was[i] == null ? t.score : was[i]) }))
                      .sort((a, b) => b.pts - a.pts || a.i - b.i)
                      .map((r, n) => Object.assign(r, { place: n + 1 }));
    rows.forEach(r => {
      const before = standingsRank ? standingsRank[r.i] : null;
      /* No arrow the first time, rather than an arrow claiming everybody rose from
         nowhere. A competitor who joined mid-run has no previous place either. */
      r.moved = before == null ? 0 : before - r.place;
    });
    return rows;
  }

  function showStandings(cfg){
    const o = cfg || {};
    const rows = standingsRows();
    const host = document.getElementById('standings-rows');
    if(!host) return;
    document.getElementById('standings-eyebrow').textContent = o.eyebrow || '';
    document.getElementById('standings-title').textContent   = o.title || 'Standings';
    document.getElementById('standings-go').textContent      = o.action || 'Continue';

    /* **How many fit, measured against the floor that moves** — the same rule
       Quickfire's own leaderboard already followed and the reason its logic is here
       rather than there. The bar is taller with sixteen names on it than with two, so
       `Kit.floorTop()` is asked rather than restated. Columns come out of the rows,
       capped at four: past that a name is narrower than the names people have. */
    const rowH   = 38;
    const room   = Math.max(rowH, Kit.floorTop() - 210);
    const perCol = Math.max(1, Math.floor(room / rowH));
    const cols   = Math.max(1, Math.min(4, Math.ceil(rows.length / perCol)));
    const shown  = Math.min(rows.length, cols * perCol);
    host.style.setProperty('--scols', String(cols));
    host.style.setProperty('--srows', String(Math.max(1, Math.ceil(shown / cols))));
    host.classList.toggle('crowd', cols > 1);

    /* Built rather than templated: a competitor's name is typed by a teacher and
       `innerHTML` would take whatever they typed literally. */
    host.innerHTML = '';
    rows.slice(0, shown).forEach(r => {
      const row = document.createElement('div');
      row.className = 'st-row' + (r.gain > 0 ? ' scored' : '') +
                      (r.i === o.winner ? ' took' : '');
      const add = (cls, text) => {
        const el = document.createElement('span');
        el.className = cls; el.textContent = text; row.appendChild(el);
        return el;
      };
      add('st-place', String(r.place));
      /* Up, down, or held — as an arrow rather than a number, because "third to
         first" is read off the shape and nobody at the back is doing subtraction. */
      const mv = add('st-move', r.moved > 0 ? '▲' : r.moved < 0 ? '▼' : '·');
      mv.classList.add(r.moved > 0 ? 'up' : r.moved < 0 ? 'down' : 'level');
      add('st-name', r.name);
      add('st-pts',  String(r.pts));
      add('st-gain', r.gain > 0 ? '+' + r.gain : '');
      host.appendChild(row);
    });
    /* When even four columns cannot hold the room, say so rather than hiding the
       tail — the honest picture, and the one a leaderboard is for anyway. */
    if(rows.length > shown){
      const more = document.createElement('div');
      more.className = 'st-more';
      more.textContent = '+' + (rows.length - shown) + ' more';
      host.appendChild(more);
    }

    /* ---- the shuffle: open on the old order, then glide to the new ----
       **The movement is the picture; the arrows only describe it.** For a beat the
       rows sit where they were *before* this question — old slot, old place number —
       then everything slides to where it is now. Pure display: the DOM is already in
       the new order, each row is translated back to its old slot and released, so
       nothing downstream can ever read the old arrangement as data.

       The old slot is the row's position sorted by the *previous* ranking — the same
       `standingsRank` the arrows read — with newcomers holding their new slot (they
       have nowhere to arrive from). Rects are measured off the final layout, so the
       columns' flow never needs knowing.

       Skipped under `navigator.webdriver`: the suite reads place numbers off the
       rows, and for 0.9s they are deliberately the old ones. A check that wants the
       shuffle sets `window.HUB_SHUFFLE_ANYWAY` first — the same opt-in shape as the
       room bench's `?rack=auto`. */
    const drawn = [...host.querySelectorAll('.st-row')];
    const moving = rows.slice(0, shown).some(r => r.moved !== 0);
    const wantShuffle = S.get('standingsShuffle', activeGame) && moving &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      (!navigator.webdriver || window.HUB_SHUFFLE_ANYWAY);

    standingsRank = {};
    rows.forEach(r => { standingsRank[r.i] = r.place; });
    document.getElementById('standings-modal').classList.add('on');

    if(wantShuffle){
      const seen = rows.slice(0, shown);
      /* Every shown row's old slot, unique by construction: sort by previous place
         (new place stands in for a newcomer), new place breaking ties. */
      const oldOrder = seen.slice().sort((a, b) =>
        ((a.moved ? a.place + a.moved : a.place) - (b.moved ? b.place + b.moved : b.place)) ||
        (a.place - b.place));
      const slotOf = {};
      oldOrder.forEach((r, n) => { slotOf[r.i] = n; });
      const rects = drawn.map(el => el.getBoundingClientRect());
      host.classList.add('shuffling');            // transitions off while placing
      seen.forEach((r, n) => {
        const from = rects[slotOf[r.i]], here = rects[n];
        drawn[n].style.transform =
          'translate(' + (from.left - here.left) + 'px,' + (from.top - here.top) + 'px)';
        // the old place number rides in the old slot; the new one arrives with the move
        drawn[n].querySelector('.st-place').textContent = String(r.place + r.moved);
      });
      /* The release is guarded by a sequence, the `resultSeq` lesson: a stale timer
         from a previous open must not let a later shuffle go early. */
      const seq = ++showStandings.seq;
      setTimeout(()=>{
        if(seq !== showStandings.seq) return;
        host.classList.remove('shuffling');       // transitions back on — release
        seen.forEach((r, n) => {
          drawn[n].style.transform = '';
          drawn[n].querySelector('.st-place').textContent = String(r.place);
        });
      }, 1000);
    }
  }
  showStandings.seq = 0;

  function hideStandings(){
    document.getElementById('standings-modal').classList.remove('on');
  }

  /* Two competitors is a scoreboard nobody needs a screen for, and on a board with
     one question every few seconds it is an interruption rather than a moment. Asked
     here rather than at each call site so the answer cannot differ per board. */
  function standingsWanted(game){
    return !!S.get('roundWinBanner', game || activeGame) && teams.length >= 2;
  }

  /* The cards are built from the registry, so a game's icon, copy and badge live
     in its declaration rather than in a block of markup someone has to remember to
     edit. The CSS hangs off `.game-card[data-game]`, which is unchanged. */
  function renderGameCards(){
    const grid = document.querySelector('.game-grid');
    grid.innerHTML = '';
    GAMES.forEach(g=>{
      const card = document.createElement('div');
      card.className = 'game-card';
      card.dataset.game = g.id;
      card.innerHTML = g.card.icon +
        '<h3>' + g.title + '</h3>' +
        '<p>' + g.card.blurb + '</p>' +
        '<span class="badge">' + g.card.badge + '</span>';
      card.addEventListener('click', ()=>chooseGame(card.dataset.game));
      grid.appendChild(card);
    });
  }

  function chooseGame(id){
    activeGame = id;
    window.HubGames.setActive(id);
    S.setContext(activeGame);          // ⚙ opens on this game's tab from here on
    document.getElementById('page-title').textContent = HUB_GAME_TITLES[activeGame] || 'Game Hub';
    renderContentScreen();
    showScreen('screen-content-select');
  }
  renderGameCards();
  // the registry's redraw handle — a game registered after init can still get a card
  window.HubGames._bindRenderCards(renderGameCards);

  document.getElementById('change-unit').addEventListener('click', ()=>{
    document.getElementById('page-title').textContent='Game Hub';
    document.querySelector('.eyebrow').textContent = 'Cambridge Empower C1 · Classroom games';
    showScreen('screen-unit-select');
  });

  document.getElementById('back-to-games').addEventListener('click', ()=>{
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

  document.getElementById('new-game-btn').addEventListener('click', ()=>{
    activeGame=null; window.HubGames.setActive(null); selectedContent=[];
    S.setContext(null);
    // park, don't close: the class stays joined on the same code for the next game
    parkBuzzRoom();
    document.getElementById('page-title').textContent='Game Hub';
    showScreen('screen-game-select');
  });

  /* ================= PERSISTENT TEAM BAR ================= */
  function renderScorebar(){
    const bar=document.getElementById('scorebar'); bar.innerHTML='';
    const playing = document.getElementById('screen-play').classList.contains('active');

    /* ---------- who is competing, on the bar rather than three clicks into settings ----------
       It lived in the settings panel first and that was the wrong home: it sits on the
       *All games* tab, because it is a room-wide fact rather than a per-game one, so a
       teacher had to leave the board, find the All games tab, hunt down Competition and
       change it there — for the one fact that the bar already *is*.

       The bar is where it belongs because the bar *is* the roster — add, rename,
       remove and reset all live here, it is on every screen, and switching it changes
       what the bar itself shows, so cause and effect are in one place. Sticky to the
       left edge, so a class of sixteen names scrolling past never takes it off screen. */
    /* **Not while a game is on.** The decision is made on the setup screen, because
       it cannot be un-made usefully once a board is running — sixteen people do not
       regroup into four teams without the roster being rebuilt, and rebuilding it
       bins the points. Leaving a control there that flips a label and changes
       nothing else is worse than not offering it. */
    if(!playing) bar.appendChild(rosterSwitch());

    /* Who is highlighted as on turn, and what a chip wears, are the game's own
       facts now — `turnTeam()` and `teamDecor(i)` on the registry, replacing the
       by-name branches that a new game had to be threaded into by hand. */
    const g  = playing ? gameDef() : null;
    const hi = !playing ? -1 : (g && g.turnTeam) ? g.turnTeam() : active;
    const step = (g && g.nudgeStep) || 1;   // manual +/- correction, in the game's own unit
    teams.forEach((t, i)=>{
      const el=document.createElement('div'); el.className='team'+(i===hi?' active':'');
      const dot = g ? (g.teamDecor(i) || '') : '';
      // two is the floor — every board is built for at least two sides — so the
      // remove button only appears above it, and it never appears on the last two
      // the remove control hides at the floor, so the floor is asked rather than restated
    const del = teams.length > Roster.floor()
      ? `<button class="tdel" title="Remove ${Roster.label()}">×</button>` : '';
      el.innerHTML = `${dot}<input class="tname" value="${t.name}"><button class="minus">−</button><span class="score">${t.score}</span><button class="plus">+</button>${del}`;
      el.addEventListener('click', (ev)=>{
        if(ev.target.closest('button') || ev.target.classList.contains('tname')) return;
        active = i; renderScorebar();
      });
      el.querySelector('.tname').addEventListener('change', e=>{
        t.name = e.target.value; t.auto = false; pushTeamNames(); });
      // noted before the score moves (the ledger's ordering rule) — a teacher's
      // correction used to be indistinguishable in the report from a scoring bug
      el.querySelector('.minus').addEventListener('click', ()=>{ ledgerNote(i, -step, 'teacher correction'); t.score-=step; renderScorebar(); });
      el.querySelector('.plus').addEventListener('click', ()=>{ ledgerNote(i, step, 'teacher correction'); t.score+=step; renderScorebar(); });
      const delBtn = el.querySelector('.tdel');
      if(delBtn) delBtn.addEventListener('click', ()=> removeTeam(i));
      bar.appendChild(el);
    });
    const addBtn=document.createElement('button'); addBtn.id='add-team-btn';
    addBtn.textContent='+ ' + Roster.Label();
    addBtn.addEventListener('click', ()=>{ Roster.add(); renderScorebar(); });
    bar.appendChild(addBtn);
    // icon-only in the header: the words cost more room than the button is worth,
    // and the tooltip still says what it does
    const resetBtn=document.createElement('button'); resetBtn.className='reset-btn';
    resetBtn.textContent='↺'; resetBtn.title='Reset points';
    resetBtn.addEventListener('click', ()=>{
      teams.forEach((t, i)=>{ if(t.score) ledgerNote(i, -t.score, 'points reset'); t.score=0; t.run=0; });
      renderScorebar(); });
    bar.appendChild(resetBtn);
    /* The active game repaints anything it hangs off the scores — Jeopardy's Together
       class-total line. Fires wherever the bar redraws, so no score-changing path has
       to remember it by hand (it was four hand-kept `renderClassLine()` calls). */
    hook('onScoreShown');
    // adding a team, or renaming one, has to reach the phones — this is the one
    // place that runs on any change to the list, and the push skips a no-op
    pushTeamNames();
  }

  /* **One definition of the teams-or-solo control**, drawn in two places: the team
     bar between games, and the setup screen where the decision actually belongs. Two
     copies would be two things that could disagree about what the current mode is,
     which is the defect this project has paid for most. */
  const ROSTER_MODES = [
    { value:'teams', label:'Teams',
      blurb:'A name is a group of students. They pick a side when they join.' },
    { value:'solo',  label:'Individuals',
      blurb:'Everyone against everyone. The roster fills itself from the phones as they join.' }
  ];
  function rosterSwitch(){
    const seg = document.createElement('div');
    seg.id = 'roster-mode';
    ROSTER_MODES.forEach(m=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.value === 'solo' ? 'Solo' : m.label;   // the bar has no room for a sentence
      b.dataset.mode = m.value;
      b.className = (Roster.mode === m.value) ? 'on' : '';
      b.title = m.blurb;
      b.addEventListener('click', ()=>{ if(Roster.mode !== m.value) S.set('roster', m.value); });
      seg.appendChild(b);
    });
    return seg;
  }

  /* The setup screen's version: the same two values with room to say what each one
     means, because this is where a teacher chooses rather than corrects. */
  function renderRosterPick(){
    const mount = document.getElementById('roster-pick-opts');
    if(!mount) return;
    mount.innerHTML = '';
    ROSTER_MODES.forEach(m=>{
      const el = document.createElement('label');
      el.className = 'mode-opt' + (Roster.mode === m.value ? ' on' : '');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'rostermode'; input.value = m.value;
      input.checked = Roster.mode === m.value;
      input.addEventListener('change', ()=>{ if(input.checked) S.set('roster', m.value); });
      const txt = document.createElement('span');
      const strong = document.createElement('strong'); strong.textContent = m.label;
      txt.appendChild(strong);
      txt.appendChild(document.createTextNode(' \u2014 ' + m.blurb));
      el.appendChild(input); el.appendChild(txt);
      mount.appendChild(el);
    });
    /* What the room actually is right now, so the choice is made against the truth
       rather than against a guess: how many have joined, and what the roster holds. */
    const note = document.getElementById('roster-pick-note');
    if(note){
      note.textContent = Roster.solo()
        ? (buzzPlayers
            ? buzzPlayers + (buzzPlayers === 1 ? ' phone has joined' : ' phones have joined') +
              ' \u2014 ' + teams.length + ' on the roster.'
            : 'Nobody has joined yet. Players appear here as they scan the code above.')
        : teams.length + ' teams. Add, rename or remove them on the bar below.';
    }
  }

  function nextTurn(){ if(teams.length){ active=Kit.passTurn(teams.length, active); renderScorebar(); } }

  /* What to call a team when it has to be named in prose — a strip chip, a dot's
     tooltip, a board saying who just took a tile. A team index can outrun the list
     (a reply from a handset still holding a team that has since been removed), so
     this never returns undefined. */
  /* One definition of what a competitor is called, fallback included — a round's
     `ctx.teamName`, every banner and every phone push read through it. */
  function teamName(i){ return teams[i] ? teams[i].name : ('Team ' + (Number(i) + 1)); }

  /* ---------- one scoring path, so a mechanic is written once ----------
     Every award in the app goes through here. `opts.steal` halves the value (you
     get the chance the other team dropped, not the full prize) and `opts.streak`
     applies the run multiplier. Nothing ever subtracts: a missed question costs the
     opportunity, never the score. Returns what was actually awarded so the caller
     can say so on screen. */
  function award(teamIdx, base, opts){
    const t = teams[teamIdx];
    if(!t || !base) return 0;
    const o = opts || {};
    const halved = o.steal && !S.get('stealFullValue', activeGame);
    let value = halved ? base / 2 : base;
    /* The run is counted *before* this answer, so award() is always called before
       markRun(): the first answer of a streak pays face value, the second 1.5x and
       the third double. Marking first made the very first answer pay a bonus for a
       run that had not happened yet. */
    const mult = (o.streak !== false && S.get('streak', activeGame)) ? runMultiplier(t.run) : 1;
    value *= mult;
    /* Rounded to the game's own declared unit — `payStep`, 50 on the boards that
       score in hundreds (half a $100 tile is 50, and rounding that to the nearest
       100 handed a steal the full value), 1 everywhere else. Every value those
       boards produce is already a multiple of 50, so this rounds nothing away. */
    const g = gameDef();
    const step = (g && g.payStep) || 1;
    value = Math.max(step, Math.round(value / step) * step);
    /* The receipt line carries award's own arithmetic — the *paid* number with what
       was done to it on the way — because a report reader cannot re-derive a half
       or a multiplier from settings that may have changed since. */
    ledgerNote(teamIdx, value,
      (o.why || 'points') +
      (o.steal ? (halved ? ' · steal ½' : ' · steal') : '') +
      (mult > 1 ? ' · streak ×' + mult : ''));
    t.score += value;
    renderScorebar();
    return value;
  }

  // two in a row is worth a little, three or more is worth doubling — and it has to
  // be visible in the moment or it is just arithmetic nobody notices
  function runMultiplier(run){ return run >= 2 ? 2 : run === 1 ? 1.5 : 1; }

  /* A correct answer extends that team's run and breaks everyone else's; a wrong one
     breaks their own. Kept in one place because four games would otherwise each get
     it slightly wrong. */
  function markRun(teamIdx, correct){
    if(!teams[teamIdx]) return;
    if(!correct){ teams[teamIdx].run = 0; return; }
    teams.forEach((t, i)=>{ t.run = (i === teamIdx) ? t.run + 1 : 0; });
  }

  /* The shared deal-in stagger for every board that reveals its cells with the
     `.dealing` class and a per-cell `--i` the keyframe reads. Does nothing unless the
     board is lit and motion is allowed — a class waiting on a re-triggered animation
     is what this guards. The game's `stagger(container)` runs only after that guard,
     and sets `--i` on its own cells however it selects them; `ms` is how long the
     class stays on and MUST match the CSS animation length. (Bingo deals a different
     way — inline `animation` strings per cell — so it is not one of these.) */
  function dealStagger(stageId, container, stagger, ms){
    const stage = document.getElementById(stageId);
    if(!container || !stage || !stage.classList.contains('lit') || !motionOK()) return;
    stagger(container);
    container.classList.remove('dealing'); void container.offsetWidth;
    container.classList.add('dealing');
    setTimeout(()=>container.classList.remove('dealing'), ms);
  }

  /* The shared stage-tension gate. Every game show heats its board the same way:
     light the stage under the game-show skin, write a 0–1 `--tension` the CSS reads,
     and run the think-music bed while a question is live. Only two things are the
     game's own — the tension value and whether the bed should play — so a game hands
     those back from `compute(stage)`, which runs **only while the stage is lit** (the
     same early-out every copy had, so a game still computes nothing when it is off
     screen). Returns whether the stage is lit, for a game with extra lit-only work
     (Race toggles `.running`). A game whose stage markup is absent — an external file
     loaded before its board — is a safe no-op. Exposed on HubEnv for the external
     games, which reach `themeOf`/`activeGame`/`Sound`/`motionOK` only through it. */
  function stageTension(id, compute){
    const stage = document.getElementById('play-' + id);
    if(!stage) return false;
    const on = themeOf(id) === 'gameshow' && activeGame === id;
    stage.classList.toggle('lit', on);
    if(!on){ stage.style.removeProperty('--tension'); Sound.bedStop(); return false; }
    const { t, live } = compute(stage);
    stage.style.setProperty('--tension', t.toFixed(3));
    if(live && motionOK()) Sound.bedStart(t); else Sound.bedStop();
    return true;
  }

  /* ================= CONTENT SCREEN ================= */
  /* The round-type filter, above the list and on every board. Built from the round
     types **actually in this game's bank for this unit** — asked, never listed — so
     a board with nothing but Multiple Choice offers one chip and a unit that has
     not been converted offers none at all, which is the honest picture rather than
     a row of controls that would narrow nothing.

     It hides itself below two types: a filter with a single option is a control
     that cannot change anything, and a filter with none is a lie. */
  /* The game declares its own bank — this was a five-way switch on the game's
     name, the exact shape the registry exists to remove. */
  function bankForFilter(){
    const g = gameDef();
    return g ? (g.bank() || []) : [];
  }
  function renderRoundFilter(){
    const strip = document.getElementById('round-filter');
    if(!strip) return;
    /* Millionaire and Quickfire build their round when the rung opens, so the raw
       item says nothing — `asRound` is how a game declares what its bank becomes,
       and the chip on each row already reads through it. */
    const g = gameDef();
    const asRound = (g && g.asRound) || (x => x);
    const kinds = [];
    bankForFilter().forEach(it=>{
      const id = roundTypeOf(asRound(it));
      if(kinds.indexOf(id) === -1) kinds.push(id);
    });
    strip.innerHTML = '';
    if(kinds.length < 2){ strip.style.display='none'; selectedRounds.clear(); return; }
    strip.style.display = '';
    const label = document.createElement('span');
    label.className = 'rf-label'; label.textContent = 'Round types';
    strip.appendChild(label);
    kinds.forEach(id=>{
      const def = Kit.round && Kit.round.get ? Kit.round.get(id) : null;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rf-chip' + (selectedRounds.has(id) ? ' on' : '');
      b.dataset.round = id;
      b.textContent = id === 'plain' ? 'Plain question' : ((def && def.label) || id);
      b.addEventListener('click', ()=>{
        if(selectedRounds.has(id)) selectedRounds.delete(id); else selectedRounds.add(id);
        redrawContent();
      });
      strip.appendChild(b);
    });
    if(selectedRounds.size){
      const all = document.createElement('button');
      all.type='button'; all.className='rf-chip rf-all'; all.textContent='Show all';
      all.addEventListener('click', ()=>{ selectedRounds.clear(); redrawContent(); });
      strip.appendChild(all);
    }
  }
  /* A filter change rebuilds the list, so the ticks are gone — which is right: a
     tick on a row the filter has just removed would still be counted by
     `selectedContent` and would put back exactly what the teacher filtered out. */
  function redrawContent(){
    const list = document.getElementById('content-list');
    const help = document.getElementById('content-helptext');
    list.innerHTML=''; selectedContent=[];
    const g = gameDef();
    if(g) g.renderContent(list, help);
    renderRoundFilter();
    updateStartButton();
  }
  function renderContentScreen(){
    const list = document.getElementById('content-list');
    const help = document.getElementById('content-helptext');
    const rulesNote = document.getElementById('blockbusters-rules');
    const raceNote  = document.getElementById('race-rules');
    list.innerHTML='';
    selectedContent=[];
    selectedRounds.clear();          // a fresh game starts with everything in play
    raceNote.style.display='none';
    document.getElementById('race-mode').style.display='none';

    rulesNote.style.display='none';        // a game that wants it turns it on
    /* Asked on every game, because every board plays both ways now — and asked here
       rather than left to whatever the last lesson used, so the teacher sees what
       they are about to start. */
    renderRosterPick();
    const g = gameDef();
    if(g) g.renderContent(list, help);
    renderRoundFilter();
    updateStartButton();
  }

  /* Most games pick whole sections; Jeopardy picks named categories. Both end up
     as `.cat-check` rows, so one builder covers them. */
  /* What a teacher can tick. Jeopardy has always offered its named categories;
     the other three offered only the section, so "5A" meant 25 crime words *and*
     nine relative pronouns in one lump with no way to pick the half you taught.

     An item's group is its `topic` when it has one and its `section` otherwise, so
     a bank that has not been tagged behaves exactly as before. Counts are computed
     from the bank at render time rather than written into the label by hand —
     the hand-written ones have drifted before, and the content gate exists to
     catch that. */
  const groupOf = item => (item && item.topic) || (item && item.section) || '';

  /* ---------- the two axes a teacher picks along ----------
     Content is filed on **three** facts and only two of them are authored: the
     section (5A) and the topic (5A-vocab) are written on every item, and the round
     type is *derived* from the item's own fields by `Kit.round.of()` — never
     labelled, so a round written next month files its own content for free.

     Picking used to happen along one axis and it differed by board: Jeopardy's
     rows are round types, everybody else's are topics. So "just the Connections"
     was answerable on one board and not on the other four, for no reason a teacher
     could see. `selectedRounds` is the missing axis, and because both axes end in
     one predicate, a board narrows by calling `inPlay` rather than by learning
     about either of them.

     Empty means all — the honest default for a filter nobody has touched, and it
     keeps every existing board exactly as it was. */
  let selectedRounds = new Set();
  const roundTypeOf = item => {
    const hit = Kit.round && Kit.round.of ? Kit.round.of(item) : null;
    return hit ? hit.id : 'plain';
  };
  const typeAllowed = item => !selectedRounds.size || selectedRounds.has(roundTypeOf(item));
  /* Both axes at once. This replaced `selectedContent.includes(groupOf(x))`, which
     was written out in eight places — so the round-type half would have had to be
     threaded into all eight by hand, which is the defect this project has paid for
     most. One predicate, and a seventh game gets both axes by filtering with it. */
  const inPlay = item => selectedContent.includes(groupOf(item)) && typeAllowed(item);
  /* A Jeopardy category is filtered whole, never clue by clue: the board indexes
     tiles by row and a column short of one clue is `undefined`, not a shorter
     column. Each category is one round type in the converted units, so whole-column
     filtering is also what a teacher means; a mixed category shows if any of its
     clues qualifies, and its chip already says it is mixed. */
  const catAllowed = cat => !selectedRounds.size || (cat.clues || []).some(typeAllowed);

  /* ---------- what kind of questions are behind a tick box ----------
     Reported as: on the content screen you cannot tell a clue the room **plays** on
     their phones from one the teacher simply reveals — and those are two completely
     different lessons, so choosing between them blind is choosing blind.

     **Asked of the round registry, never labelled on the category.** A category that
     declared "I hold rounds" would be a second copy of a fact its items already
     carry, and it would be wrong the first time somebody edited one — the same
     list-kept-in-step-by-hand defect this project keeps paying for. `Kit.round.of()`
     reads the item's own fields, so a round written next month labels its content
     here with nothing added.

     One helper for every board, because all three content builders end up as
     `.cat-check` rows: Jeopardy picks named categories, the rest pick sections, and
     a teacher should not have to learn two vocabularies for one distinction. It is
     the same split the question bench draws in its menu. */
  function contentKind(items){
    const seen = {};
    let plain = 0;
    (items || []).forEach(it => {
      /* Through the game's own normaliser first. A round can be *derived* rather
         than authored — Millionaire's is — and asking the raw item then reports a
         whole ladder of rounds as ordinary questions. */
      const hit = Kit.round.of(hook('asRound', it) || it);
      if(hit) seen[hit.id] = (seen[hit.id] || 0) + 1; else plain++;
    });
    const ids = Object.keys(seen);
    const label = id => (Kit.round.get(id) || {}).label || id;
    if(!ids.length)                    return { cls:'q', text:'Question' };
    if(!plain && ids.length === 1)     return { cls:'r', text:'Round \u00b7 ' + label(ids[0]) };
    if(!plain)                         return { cls:'r', text:'Rounds \u00b7 ' + ids.length + ' types' };
    const n = ids.reduce((a, id) => a + seen[id], 0);
    return { cls:'m', text:'Mixed \u00b7 ' + n + ' round' + (n === 1 ? '' : 's') };
  }
  const kindChip = items => {
    const k = contentKind(items);
    return `<span class="kind kind-${k.cls}">${k.text}</span>`;
  };

  /* ---- one shape for every content screen ----
     A teacher picking content should not have to learn a second vocabulary
     because they picked a different board. Jeopardy grouped its rows under
     section headings and showed no counts; every other game showed a flat list
     with counts and no headings, and repeated the section inside each row's own
     label. Same job, two layouts, and the markup was written out twice.

     The standard, and it is the same whatever the board and whatever the unit:

         <section heading>
         [ ] [5A]  Topic or round             ROUND · CONNECTIONS   (n)

     the tick, the section tag, what the row *is*, and what kind of questions are
     behind it. `contentRow` builds it and `sectionHeading` draws the heading, so
     a sixth game gets the layout by calling them rather than by copying it. */
  function sectionHeading(list, text){
    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = text;
    list.appendChild(label);
  }
  function contentRow(list, { value, section, label, items, count }){
    const div = document.createElement('label');
    div.className = 'cat-check';
    const n = count == null ? (items || []).length : count;
    div.innerHTML = `<input type="checkbox" value="${value}">` +
                    (section ? `<span class="tag">${section}</span>` : '') +
                    `<span class="name">${label}</span>` +
                    kindChip(items || []) +
                    `<span class="count">${n}</span>`;
    div.querySelector('input').addEventListener('change', onContentToggle);
    faceToggle(div, items || []);
    list.appendChild(div);
  }

  /* ---- the face toggle: Drag/Flick, Ladder/Stack, per row ----
     A row whose round declares a `physics` face gets a two-way toggle, so a board
     can carry a flicked category beside a dragged one instead of playing every clue
     of a round the one way the game-wide row says. The choice is written onto the
     row's own items (`item.physics`, a boolean) — the same objects a clue opens
     from — and the resolvers below read it off the open clue ahead of the setting.
     Untouched, a row shows what the game-wide row would do, so the toggle is also
     the place a teacher sees which face a category is about to play. Kept on the
     items rather than in a table keyed by row id, so a fifth board that draws rows
     through contentRow gets it without learning what a category is. */
  function physicsOf(items){
    let found = null;                                  // {id, def} — the def carries no id of its own
    for(const it of items){
      const hit = Kit.round.of(hook('asRound', it) || it);
      if(!hit || !hit.def.physics) return null;      // a plain question or a round with one face
      if(found && found.def !== hit.def) return null; // a mixed row has no single face to flip
      found = hit;
    }
    return found;
  }
  function faceToggle(row, items){
    const rnd = physicsOf(items);
    if(!rnd || !items.length) return;
    const ph = rnd.def.physics;
    const setting = ph.axis === 'input'
      ? S.get('round_' + rnd.id + '_input', activeGame) === ph.value
      : S.get('round_' + rnd.id, activeGame) === ph.value;
    const picked = typeof items[0].physics === 'boolean' ? items[0].physics : setting;
    const box = document.createElement('span');
    box.className = 'face';
    box.title = 'How this category is played on the card and the phones';
    [[false, ph.off], [true, ph.on]].forEach(([on, text]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = text; b.dataset.face = on ? 'on' : 'off';
      if(picked === on) b.classList.add('on');
      b.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();   // inside a <label>: a plain click would flip the tick
        items.forEach(it => { it.physics = on; });
        box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      });
      box.appendChild(b);
    });
    row.insertBefore(box, row.querySelector('.count'));
  }
  /* A topic name is authored with its section on the front — "5A · Relative
     clauses" — which was right when the row was the only thing on screen. With a
     heading above it and a tag beside it the section is now said three times, so
     the row drops it. */
  const stripSection = (label, sec) =>
    String(label).replace(new RegExp('^\\s*' + sec + '\\s*[·\\-–]\\s*', 'i'), '');

  function groupCheckboxes(list, bank, topicNames, sectionNames){
    const seen = [];
    bank.forEach(i=>{ const g = groupOf(i); if(g && seen.indexOf(g) === -1) seen.push(g); });
    // keep the reading order of the bank, which is section order
    seen.sort();
    let lastSection = null;
    seen.forEach(g=>{
      /* Counts follow the filter, so the number beside a topic is how many
         questions that tick actually puts in play — not how many exist. */
      const items = bank.filter(i => groupOf(i) === g && typeAllowed(i));
      if(!items.length) return;             // nothing of the chosen kinds in here
      const sec = String(g).split('-')[0];
      if(sec !== lastSection){
        /* The section name without its own count — the rows carry those, and a
           heading that also counted would be a second number to keep in step. */
        const head = (sectionNames && sectionNames[sec])
          ? String(sectionNames[sec]).replace(/\s*\(\d+[^)]*\)\s*$/, '')
          : sec;
        sectionHeading(list, head);
        lastSection = sec;
      }
      const raw = (topicNames && topicNames[g]) ||
                  (sectionNames && sectionNames[g] && sectionNames[g].split('·').slice(1).join('·').replace(/\s*\(\d+[^)]*\)\s*$/, '')) ||
                  g;
      contentRow(list, { value:g, section:sec, label:stripSection(raw, sec), items });
    });
  }

  function sectionCheckboxes(list, names){
    Object.keys(names).forEach(sec=>{
      const div=document.createElement('label');
      div.className='cat-check';
      div.innerHTML = `<input type="checkbox" value="${sec}"><span class="tag">${sec}</span><span class="name">${names[sec].split('·')[1]}</span>`;
      div.querySelector('input').addEventListener('change', onContentToggle);
      list.appendChild(div);   // dead code — see the note above; it would want contentRow
    });
  }

  function onContentToggle(){
    selectedContent = [...document.querySelectorAll('#content-list input:checked')].map(i=>i.value);
    updateStartButton();
  }

  /* Each game says whether the selection is playable and what the button should
     read. Saying *why* it isn't playable yet is the point — "add another section"
     beats a greyed-out button with no explanation. */
  function updateStartButton(){
    const btn = document.getElementById('start-btn');
    const g = gameDef();
    if(g) g.startButton(btn);
  }

  /* The start button for a board that fills from a shuffled pool: disabled until a
     section is picked and the pool is deep enough, carrying the label that says which.
     `short` is the board's own "Need N …" line and `ready` its "Build …"/"Deal …" one;
     the empty prompt and the "— N selected, add another topic" tail are identical for
     every such board, which is what this owns. (Jeopardy counts categories, Millionaire
     needs a full ladder and Quickfire just needs one section — each a different gate,
     so none of those three is one of these.) On HubEnv for the external games. */
  function startGate(btn, o){
    if(!o.picked){ btn.disabled = true; btn.textContent = 'Select at least one section'; return; }
    if(o.total < o.need){
      btn.disabled = true;
      btn.textContent = `${o.short} — ${o.total} selected, add another topic`;
      return;
    }
    btn.disabled = false;
    btn.textContent = o.ready;
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  document.getElementById('start-btn').addEventListener('click', ()=>{
    const g = gameDef();
    if(!g) return;
    GAMES.forEach(x => { document.getElementById(x.stage).style.display='none'; });
    document.getElementById(g.stage).style.display='block';
    // a new game is a new lesson: whatever a round was keeping per student goes
    roundKeepReset();
    reportGameStart();
    g.start();
    syncBuzzRoom();
    showScreen('screen-play');
    g.fit();          // no board can be measured until the play screen is visible
    timerReset();

    /* The intro plays over the finished board rather than before it is built, so
       the first thing behind the titles is the real thing, and skipping drops you
       straight into a game that is already running. */
    const curtainUp = id=>{
      if(activeGame !== id) return;          // they navigated away mid-titles
      const d = gameDef(id);
      if(d){ d.tension(); d.deal(); }
    };
    if(wantsIntro(activeGame)){
      const id = activeGame;
      runIntro(id).then(()=>curtainUp(id));
    } else {
      curtainUp(activeGame);
    }
  });

  /* ================= SHARED CLUE MODAL ================= */
  let currentTile=null, modalMode=null, currentClueValue=0;
  let currentClueItem=null;      // what the shared renderer needs to answer in place

  // Blockbusters' board is structurally two-team — yellow crosses, blue descends —
  // so the shared chooser is deliberately restricted rather than generalised here.
  /* One chooser, two callers: Blockbusters claims a hex with it, and Jeopardy offers a
     steal with it. One instance rather than two — each would register its own document
     keydown listener — and the pick routes through the active game's declared
     `onClaimPick`, so this shared chooser no longer branches on the game's name. Both
     card games that use it (Jeopardy's steal, Blockbusters' claim) declare one; a game
     that shows the chooser without declaring the pick is the only way to reach null. */
  const clueClaim = Kit.claimTeam({
    mount:  document.getElementById('clue-claim'),
    onPick: i => { const g = gameDef(activeGame);
                   return (g && g.onClaimPick) ? g.onClaimPick(i) : null; }
  });

  /* Everything in the strip goes away; each opener then shows what it wants. The
     ids used to be typed out here, which is the defect class this project has paid
     for most — a new button had to be threaded into the list by hand and nothing
     complained if you missed one. `wager-ok` never was threaded in, so a bet left
     standing outlived every one of these calls. Asked of the strip now, so the next
     button is covered by existing. */
  function hideAllActionButtons(){
    document.querySelectorAll('#clue-actions > button')
      .forEach(b => { b.style.display = 'none'; });
    const own = document.getElementById('round-actions');
    if(own) own.innerHTML = '';
    /* A won round renames Close to say who it pays, and this is the one call every
       opener makes — so the wording is put back here rather than by each of the six
       places that show the button. A stale "Close — Team 2 takes it" over the next
       clue is exactly the kind of thing nobody notices until a lesson. */
    const close = document.getElementById('close-btn');
    if(close) close.textContent = 'Close';
    clueClaim.hide();
  }

  /* ================= A GROUPING CLUE =================
     Connections inside a tile: eight words on the card, four of which belong
     together, and the room assembles the four from their phones. It is the first
     dynamic carried over from the question bench that is a **round** in the full
     sense, and that is the headline. `Kit.prompt` is a *rendering* contract —
     render and reveal, with no time, no turns and no phones anywhere in it — so
     none of this could live there however much it looks like a question form. Story
     Reveal ported cheaply because the hub already had hints costing clue value;
     grouping had nothing to land on.

     What it does not need to build is the half the relay already grew and nothing
     in the hub had ever used: multi-pick, and `multiByTeam` — a per-phone cap
     derived from that team's size, so four words assembled by four phones is one
     each and by two phones is two each. That share is the mechanic rather than a
     detail: a team holding five between them is over, and has to talk one of them
     down. Being over is a state, not an error — nothing is stripped.

     Every team plays at once and the first to settle a correct set takes the tile.
     A wrong set costs nothing but the time, exactly as it costs nothing in
     Connections' race: the other team is the pressure, and a class that is charged
     for a guess stops guessing. */
  let roundState = null;         // the round's own state while a grouping clue is open
  let roundSettler = null;  // its debounce-and-remember, from the shared shelf

  /* How long the *card* waits before the tile leaves. The settle delay is the
     round's own business and lives with it; this one is Jeopardy's, because it is
     about a tile flipping away rather than about when an answer is complete. */
  /* A beat between the four words lighting up and the card flipping away. Without
     it the room never sees which four it was: the answer and the card leaving would
     land in the same frame. */
  const ROUND_TAKE_MS   = 700;
  /* Two different questions, and using the wrong one is a live trap. `roundClue()`
     is "this clue is a grouping clue", true until the card closes. `roundLive()` is
     "the round is still being played", which stops the moment it is taken or
     revealed. The steal and the deduction ask the first — they run *after* Reveal,
     so asking the second would have silently let both back in. */
  function roundClue(){ return !!roundState; }
  function roundLive(){ return !!roundState && !roundState.done; }


  /* ---------- the adapter ----------
     Everything the round *is* — the card, the phone payload, the union of a team's
     picks, the judging — lives in `game-hub/rounds/grouping.js` and is shared with
     the playground. What is left here is only what Jeopardy contributes: where the
     card is mounted, what a team winning is worth, and what happens to the tile.

     That split is the whole point. A round that knew about tiles could not be
     plugged into a second game, and a game that held the round could not have it
     tuned anywhere but inside itself. */
  let roundId = null;                 // which round this clue is running
  function roundDef(){ return roundId ? Kit.round.get(roundId) : null; }

  // what the round is lent: the team list, their sizes, and what a click means here
  /* The field list and the guard shapes live in `Kit.round.ctx` now — one builder,
     shared with the question bench, so the bench playing a round IS this container
     playing a round. What is written here is only what the hub actually owns: its
     settings scope, its keep store, and the host facts below. */
  function roundCtx(id){
    return Kit.round.ctx({
      teams: teams.map((t, i) => teamName(i)),
      // positional beside teams: the identity the record follows across a roster shift
      ids: teams.map(t => t.id),
      buzz: buzzHost,
      live: roundLive,
      setting: k => S.get(k, activeGame),
      /* **State that outlives one question — the contract addition, and the last one
         on the build order.** Every hook a round has is handed one question and
         forgets it afterwards, which is right for a question and wrong for anything
         a *student* carries: a bingo card and its marks, a hand, a secret role, a
         personal scorecard.

         Keyed by player id, because that is the only identity that survives a phone
         dropping off the wifi and coming back — a competitor's index shifts and a
         name is not unique. Scoped to the round *type*, so a bingo round keeps its
         cards across all of its own calls and a different round starts clean, and
         cleared when a game starts, because a new game is a new lesson.

         The relay was already doing the hard half: it holds a card per player across
         a reconnect. What was missing was a way for a round to put one there, which
         is `cardsByPlayer` on the arm. This is the host's half — anything a round
         wants to remember that the phones do not need to see. */
      keep: roundKeepFor(id || roundId),
      /* The host facts — what this board contributes on top of the shared list.
         Laid over the defaults, so a field absent here means the builder's
         no-phones, whole-room answer. */
      host: {
        /* **Whether the question stays open after somebody gets it right**, which a
           round has to know because "I am finished" and "the round is over" are the
           same field on the same object — `state.done`. Written by a round that meant
           only the first, it ends the question for everybody: the ordering race set it
           the moment one team's ladder filled, which froze the card, stopped the replies
           being read and locked every other team out of finishing theirs. Overridden
           here rather than left to the builder's plain read, because a board that
           scores by place (`scoreEach`) already keeps everyone in. */
        openToAll: openToAllNow(),
        teamName,
        /* **Individuals, so there is nothing to assemble.** A lane exists to show a
           team building one answer out of several handsets — how many have committed,
           whether they agree. A competitor of one has neither question to answer: they
           have answered or they have not, and the option counts already say how many
           of the room have. Twenty-five lanes on a board is also simply unreadable. */
        solo:   Roster.solo(),
        prompt: !!S.get('phonePrompt', roundHost.game),
        // `null` is the whole room; a scoped round belongs to the team on turn
        team:   S.get('roundWho', roundHost.game) === 'turn' ? roundHost.turn() : null,
        mode:   roundModeOf(id || roundId),
        // the input axis (drag/flick), beside the team rule; null for a round with no `inputs`
        input:  roundInputOf(id || roundId),
        // which lane the teacher's own clicks act on, when a round gives each team one
        forTeam: roundHost.turn(),
        /* A host may collect votes and not show them yet — Millionaire's Ask the class
           is the only caller, and it is what leaves that lifeline something to buy now
           that the round asks the room on every question anyway. */
        hideVotes: !!(roundHost.hideVotes && roundHost.hideVotes()),
        /* **Whether a tap is final belongs to the skin, not the round.** On a tile the
           room is negotiating and a player must be able to move their vote — that is
           the whole mechanic in `agree` mode. On a board where the clock is the
           opponent, being able to change your answer after watching the count is the
           opposite of the game. So the host says which it is and the round honours it,
           except where honouring it would break the round's own contract. */
        lockIn: !!roundHost.lockIn,
        /* How the room's votes read: a count of people, or a dot per team. See the
           note in `choice.js` — it is the same data answering two questions. */
        countVotes: !!(roundHost.countVotes && roundHost.countVotes()),
        onPick: roundTeacherPick
      }
    });
  }

  /* Which round this clue wants, asked of the registry rather than named here — so
     a round written next month is playable the day a bank item carries its field,
     with no engine change at all. That is the whole return on the extraction. */
  /* The host is named here rather than at `roundOpen`, because `setup` is handed a
     `ctx` and the ctx is scoped to whichever board is asking — the mode, who is
     entitled and how many are on that team all read the host. Asking first and
     declaring second would set up the round against the *previous* board. */
  function roundOf(item, host){
    roundHost = ROUND_HOSTS[host] || ROUND_HOSTS[ROUND_GAMES[0]];
    const hit = Kit.round.of(item);
    if(!hit) return null;
    const st = hit.def.setup(item, roundCtx(hit.id));
    return st ? { id:hit.id, state:st } : null;
  }

  /* **Opening a round arms the room.** It used to only draw the card, and telling
     thirty handsets what was being asked was left to the host — four call sites,
     each responsible for remembering the same thing, with nothing complaining if one
     forgot. Quickfire forgot, and the report was "the board shows four options and
     my phone says waiting for the teacher": the card right, the round live, and the
     two ends never connected. Blockbusters had already shipped the mirror image of
     it, declaring the arming and forgetting the replies.

     That is the defect class this project keeps paying for — a hand-kept obligation
     where a declaration belongs — so the obligation is gone. A host now arms only
     when *no* round opened, written as one expression (`if(!roundOpen(x)) …`) so it
     cannot be half-done the way two separate statements could.

     Deliberately not solved by making `askPhones` idempotent: several callers re-arm
     the same question on purpose — a new rung in an ordering climb, a Millionaire
     steal handing the question to another team — and a guard there would silently
     turn those into no-ops. */
  function roundOpen(found, opts){
    if(!found) return null;
    roundId = found.id;
    /* Settings that fork by round read this rather than taking an argument, so the
       two places `roundId` moves are the two places it is announced. Said here and
       in `roundEnd` only — a third caller would be a third thing to forget. */
    S.setRound(roundId);
    roundState   = found.state;
    roundSettler = Kit.round.settle(roundDef().settleMs, roundSettle);
    /* A new question, so a new record of who gets there. Opened here rather than by
       each host, for the same reason arming moved here: four call sites each
       responsible for remembering the same thing is the obligation this function
       exists to delete. */
    /* On the roster-shift rebuild the record is remapped, never wiped: rows follow
       their competitor's id to its new index, and whoever already answered stays
       answered. Wiping it here was the old behaviour, and it meant removing a team
       mid-question also erased the other teams' places. */
    if(opts && opts.rebuild) Kit.round.results.remap(teams.map(t => t.id));
    else Kit.round.results.open();
    /* The scores as this question opened, so the standings can show what it changed.
       Beside the results record because they answer halves of one question and a
       second call site is a second thing to forget. Re-read on a rebuild too — the
       baseline is per-index and the indices just shifted. */
    standingsOpen();
    roundReplies = [];    // nobody has answered *this* question yet
    sendMisses = {};      // a new question starts every phone's escalation from cold
    sendCooling = {};     // and nobody carries a visible wait into it
    renderRound();
    askPhones(currentPhonePrompt(), roundHost.game);
    return roundState;
  }

  /* Which way a round is being played, when it offers more than one. The row is
     built from what the round *declares*, so the engine never learns what a mode
     means — and a round added later gets its own row for free. */
  /* The input axis's resolver — simpler than roundModeOf: input has no whole-team
     mode to fall away in a solo room, so it is just the stored value (or the
     round's default). Null for a round that declares no `inputs`. */
  /* The open clue's own face, when the picker gave it one — `item.physics` is the
     Drag/Flick (Ladder/Stack) toggle on its content row, copied onto the clue with
     the rest of its source fields. Undefined means "whatever the game-wide row
     says", which is every clue on a board nobody toggled. */
  function clueFace(def, axis){
    if(!def || !def.physics || def.physics.axis !== axis) return undefined;
    const it = currentClueItem;
    return (it && typeof it.physics === 'boolean') ? it.physics : undefined;
  }
  function roundInputOf(id){
    const def = id ? Kit.round.get(id) : null;
    if(!def || !def.inputs || !def.inputs.length) return null;
    const face = clueFace(def, 'input');
    if(face === true)  return def.physics.value;
    if(face === false) return (def.inputs.find(i => i.value !== def.physics.value) || def.inputs[0]).value;
    return S.get('round_' + id + '_input', roundHost.game);
  }

  function roundModeOf(id){
    const def = id ? Kit.round.get(id) : null;
    if(!def || !def.modes || !def.modes.length) return null;
    const key  = 'round_' + id;
    const game = roundHost.game;
    let mode = S.get(key, game);
    /* The picker's face wins over the row: Stack when the category was picked as
       Stack; the row's own non-physics mode (or the first one) when it was picked
       as Ladder while the row says Stack. */
    const face = clueFace(def, 'mode');
    if(face === true) return def.physics.value;
    if(face === false && mode === def.physics.value)
      mode = (def.modes.find(m => m.value !== def.physics.value) || def.modes[0]).value;
    /* **A board's `teamMode` ask only means anything in a room of teams.** Jeopardy
       and Blockbusters say "give me whichever mode each round calls its whole-team
       one", which is right when a name is four students who have to agree — and is
       nonsense when a name is one person. Worse than nonsense in practice: with
       every competitor a team of one, `agree` is satisfied the instant anybody taps,
       so several correct answers land inside the same settle window and which of
       them takes the question comes down to the order teams are read in rather than
       who was first. Reported as the *second* right answer winning.

       Resolved here rather than at registration, because the roster mode is a live
       fact and a setting's default is computed once. A teacher's own override still
       wins — this only replaces the board's silent default. */
    if(Roster.solo() && def.teamMode && mode === def.teamMode &&
       !S.hasOverride(key, game)){
      const solo = def.modes.filter(m => m.value !== def.teamMode)[0];
      if(solo) return solo.value;
    }
    return mode;
  }

  /* The round the phones are put into, read through `phoneRound()` so it reaches the
     relay by the same path Bingo's cards do and the mode is not consulted. */
  function roundForPhones(){
    return roundLive() ? roundDef().arm(roundState, roundCtx()) : null;
  }

  /* Somebody joined a team or dropped off one, so the shares have moved. Pushed on
     its own rather than re-armed, because a fresh arm clears every handset's picks
     and a latecomer walking in must not wipe what the rest of the team had just
     agreed on. */
  function roundPushShares(){
    if(!buzzHost || !roundLive()) return;
    const arm = roundDef().arm(roundState, roundCtx());
    if(arm && arm.multiByTeam) buzzHost.shares(arm.multiByTeam);
    /* Per-player views move with the roster exactly as shares do — the
       information gap recuts its deal, and only the phones whose view changed
       hear about it. */
    if(arm && arm.promptByPlayer && Object.keys(arm.promptByPlayer).length)
      buzzHost.prompts(arm.promptByPlayer);
  }

  /* **A team removed mid-question re-numbers every team after it, and the live
     round recorded its answers under the old numbers** — the arrival stamps
     (`hostAt`), the slot it had decided (`hostTook`), the round's own committed
     per-team state (a climb's lanes, a Connections verdict), and the placement
     record settlement pays from. Left alone, the next settle pays the side now
     sitting where a scored one used to — the exact index-shift bug `remap` fixes
     one layer down for the phones. Rather than splice six differently-shaped maps
     by hand — a field list that rots the day a round adds a seventh — the question
     is simply re-put on the new roster: `setup` hands back clean state,
     `roundOpen` reopens the who-answered record and the standings baseline, and
     the just-remapped phones re-read into it. What is lost is only the current,
     *unfinished* question's phone progress, and only when a teacher deletes a team
     mid-clue — already a rare, deliberate, confirm-gated act (the preset roster
     shrink refuses outright while a game is running). Asking the room beats
     remembering a number that has moved. */
  function roundRebuildForRoster(){
    if(!roundLive() || !currentClueItem) return;
    const found = roundOf(currentClueItem, roundHost.game);
    if(found) roundOpen(found, { rebuild:true });
  }

  /* The card's own box, inside `#clue-text` the way the hint is — so the class is
     still reading the instruction while they work. `drawPrompt` owns that element
     and clears it, so this always runs after it. */
  function renderRound(){
    if(!roundState){
      const stale = document.getElementById('clue-group');
      if(stale) stale.remove();
      return;
    }
    const host = roundHost.mount();
    if(!host) return;
    roundDef().render(host, roundState, roundCtx());
    renderRoundButton();
  }

  /* The no-phones path, and it is not a fallback — a teacher with a dead relay has
     to be able to play this clue, which is the rule every playground page owes too.
     Clicking the words assembles a set on the board and the button judges it. */
  /* The teacher's own working answer. `push` order is load-bearing for a round
     whose answer is a *sequence* — an ordering card numbers them as they are
     clicked — and harmless for one whose answer is a set. */
  function roundTeacherPick(w){
    if(!roundLive()) return;
    const cap = roundCap();
    const at = roundState.chosen.indexOf(w);
    if(at !== -1) roundState.chosen.splice(at, 1);
    else if(roundState.chosen.length < cap) roundState.chosen.push(w);
    /* **A single pick moves; it does not have to be cleared first.** With a cap of
       one, a full selection used to swallow the click, so choosing B after A did
       nothing at all — you had to click A again to release it. On Millionaire that
       is the "say the letter, then lock it in" beat, where moving the nomination is
       the whole point of the pause. Only at a cap of one: where several are being
       assembled, deselecting to make room is the right gesture. */
    else if(cap === 1) roundState.chosen = [w];
    renderRound();
    /* The host may have chrome of its own that follows the nomination — Millionaire's
       hint line reads "Locked on X". Without this it only refreshed on the next full
       board render, so the line lagged a beat behind the option that was lit. */
    if(roundHost.repaint) roundHost.repaint();
    /* Millionaire with "Final answer?" switched off answers on the click, as it
       always did. Declared by the host rather than branched on here, so the two-beat
       pause stays the default everywhere else. */
    if(roundHost.autoCommit && roundHost.autoCommit() && roundState.chosen.length === cap) roundCommit();
  }
  /* How many the teacher may hold at once. An ordering climb wants one at a time —
     the ladder takes the next rung, not the whole scale. The question bench had
     this written out a second time, so the sum lives on the shelf now. */
  function roundCap(){ return Kit.round.cap(roundDef(), roundState, roundCtx()); }

  /* The teacher's own set, judged by the same function a team's is. Right lights the
     four and takes the tile for whoever is on turn; wrong shakes them and costs
     nothing, exactly as it costs a team nothing. */
  /* The teacher's own answer, judged. A function rather than a button handler,
     because two buttons reach it now: the clue card's Check, and Millionaire's
     "Final answer?" — the same beat wearing the show's clothes. Adapter code, not
     any game's: it lived in the Jeopardy region for a year because that is where
     the clue card grew up, and moved here when the adapter lost its j prefix. */
  function roundCommit(){
    /* `roundCap()`, not the whole answer: an ordering climb asks for one word at a
       time, so guarding on the full scale meant the button could be pressed and
       silently did nothing. */
    if(!roundLive()) return;
    /* The teacher's answer is the tray's picks — or, on a physics face, the tiles
       docked on the board's own table (`cardCells`), which the tray never sees. */
    const picked = roundState.chosen.length ? roundState.chosen.slice()
                 : (roundState.cardCells || []).filter(Boolean);
    if(picked.length !== roundCap()) return;
    const def = roundDef();
    /* The teacher's own answer, which deliberately does not go through `read()` — so
       a round that holds a rung until every handset agrees does not hold *this* one.
       A class with one phone in a drawer has to stay playable, and the teacher is the
       authority when they click. */
    const ctx = roundCtx();
    /* Who a teacher's own answer scores for. `active` by default, which is what the
       two card boards have always done — a round arriving did not change whose
       answer the teacher was entering. Millionaire needs its own, because after a
       steal the question belongs to a team that is not `active`, and that is exactly
       the moment the difference shows. */
    const team = roundHost.scorer ? roundHost.scorer() : active;
    const r = def.judge(picked, roundState, team, ctx);
    if(r.verdict === 'right'){
      def.accept(picked.slice(), roundState, team, ctx);
      roundState.chosen = [];
      /* The teacher's own answer goes on the record too, with no arrival stamp — a
         click carries none, and sorting last is right: it is a judgement made after
         the room has had its go. */
      Kit.round.results.note(team, { done: r.done !== false || !!roundState.done,
                                     id: (teams[team] || {}).id });
      if(r.done !== false || roundState.done){ roundTake(team); return; }
      roundState.say = 'Yes — keep going.'; roundState.sayTeam = team;
      Sound.play('correct');
      renderRound();
      roundSendDone();
      if(buzzHost && roundReasks()) askPhones(currentClueItem.text, roundHost.game);
      return;
    }
    /* A wrong answer costs nothing on a tile or a hexagon — the other team is the
       pressure. On a ladder it ends the go, which is the show's whole tension, so
       the host is asked first and only boards with no opinion fall through. */
    if(roundHost.miss && roundHost.miss(team, r)) return;
    roundState.say = def.saidOf('Not that', r, roundState).replace(/^Not that: /, '');
    roundState.sayTeam = team;
    Sound.play('wrong');
    /* Shake what they picked, *then* let it go. Leaving the selection standing meant
       the next click deselected instead of choosing, so the teacher's second attempt
       silently did nothing — worst on an ordering climb, where one word is the whole
       answer and the button just sat there disabled. */
    const shaking = [...roundHost.mount().querySelectorAll('.gword.chosen')];
    shaking.forEach(el=>{
      el.classList.add('shake');
      setTimeout(()=> el.classList.remove('shake'), 380);
    });
    setTimeout(()=>{ if(roundLive()){ roundState.chosen = []; renderRound(); } }, 380);
    renderRound();
  }
  document.getElementById('group-btn').addEventListener('click', roundCommit);
  // a tile docking on a physics face is not a render: re-read the Check count
  document.addEventListener('round:arranged', ()=>{ if(roundLive()) renderRoundButton(); });

  /* Where a round's own buttons go: beside the host's commit button, whichever
     element that is — the clue card's Check, Millionaire's "Final answer?",
     Quickfire's "Lock it in". Created next to it rather than written into the
     skeleton, the same move `CARD_MOUNT` makes for the card, so a fourth host
     needs no markup of its own. */
  function roundActionsMount(){
    const btn = document.getElementById(roundHost.commit);
    if(!btn || !btn.parentNode) return null;
    let box = document.getElementById('round-actions');
    if(!box || box.previousSibling !== btn){
      if(box) box.remove();
      box = document.createElement('span');
      box.id = 'round-actions'; box.className = 'round-actions';
      btn.parentNode.insertBefore(box, btn.nextSibling);
    }
    return box;
  }

  function renderRoundButton(){
    const btn = document.getElementById(roundHost.commit);
    if(!btn) return;
    const on = roundLive() && roundHost.live();
    // minted only once a round is actually live — an ordinary clue's strip is the hub's
    const box = on ? roundActionsMount() : document.getElementById('round-actions');
    btn.style.display = on ? 'inline-block' : 'none';
    if(!on){ if(box) box.innerHTML = ''; return; }
    /* The commit button is the host's — it scores — and everything beside it is
       the round's. The wording of the host's is still the host's when it has one:
       Millionaire's is the show's "Final answer?", which is the same beat and must
       not read as "Check it". */
    const list = Kit.round.actions(roundDef(), roundState, roundCtx(),
                                   { commitText: roundHost.commitText,
                                     hints: !!S.get('roundHints', roundHost.game) });
    if(!list.length) return;
    btn.disabled = !!list[0].disabled;
    btn.textContent = list[0].label;
    Kit.round.strip(box, list, roundPress);
  }

  /* A round's own button, pressed. It may change the question and may not score —
     scoring is what `roundCommit` is, and that is the host's beat.

     **What the host owes afterwards depends on what actually changed, and getting
     that wrong throws the room's answers away.** A re-ask is an *arm*, and an arm
     clears the relay's collected replies and resets every handset — right when a
     round has moved on (the ordering climb fills a rung, so the next question is a
     different one), and badly wrong when only the card changed. Every hint but that
     one is card-only: a letter shown on the projector, an option taken off it. Those
     used to re-arm anyway, so pressing Hint wiped what thirty students had already
     dragged or typed.

     So a round says which it was: `'card'` for "redraw me, leave the phones alone",
     anything else truthy for "the question moved". */
  function roundPress(id){
    if(!roundLive()) return;
    const changed = Kit.round.press(roundDef(), id, roundState, roundCtx());
    if(!changed) return;
    if(changed !== 'card'){
      roundState.chosen = [];
      if(buzzHost && currentClueItem) askPhones(currentClueItem.text, roundHost.game);
    }
    renderRound();
  }

  /* Replies off the wire. The round works out what each team is holding; this only
     decides what that is worth on a Jeopardy board. */
  /* **Who answered first, which the picks themselves do not say.** `read()` hands
     back one answer per competitor and nothing about when each arrived — so the
     settle used to take `verdicts[0]`, which is the *lowest index* among the correct
     ones rather than the earliest. With two or three teams that is invisible; with
     sixteen individuals it is the reported bug, where a later right answer takes the
     tile off an earlier one for no reason anybody in the room can see.

     Stamped with a counter rather than a clock: nothing here needs to know how long
     ago, only what came before what, and a counter cannot disagree with anything.
     The stamp moves only when a competitor's answer actually *changes*, so somebody
     re-reading their own reply does not lose their place. */
  /* One store per round type, thrown away when a game starts. `all()` copies, so a
     round cannot hand its own store out and have it mutated behind its back. */
  let roundKeep = null;
  function roundKeepFor(id){
    const key = String(id || '');
    if(!roundKeep || roundKeep.id !== key) roundKeep = { id:key, store:new Map() };
    const store = roundKeep.store;
    return {
      get: pid => store.get(String(pid)),
      set: (pid, v) => { store.set(String(pid), v); return v; },
      has: pid => store.has(String(pid)),
      all: () => { const out = {}; store.forEach((v, k) => { out[k] = v; }); return out; },
      clear: () => store.clear()
    };
  }
  function roundKeepReset(){ roundKeep = null; }

  let roundSeq = 0;
  /* **This answers "when did each team's answer arrive", which is not the same
     question as "who got it right".** `Kit.round.results` records the second and
     consumes the first: several teams can settle inside one tick, so the moment a
     reply landed and the moment it was judged are different numbers, and only this
     knows the first one. It stamps every team whose answer changed, right or wrong,
     because a team that was wrong at 1s and right at 5s arrived at 5s.

     **Namespaced, because the state object belongs to the round.** This was
     `roundState.at`, and the bingo round uses `s.at` for which call it is reading — so
     the host quietly replaced a number with a map of stamps and the next `s.at++`
     produced NaN, which rendered as "all twelve called" one press in. Nothing warned
     about it and nothing could: two files writing different meanings into one field
     on the same object is a collision only a name can prevent.
     **The rule: anything the host stores on a round's state carries `host` in its
     name.** A round's own fields are the round's to choose freely. */
  /* The identity of an answer, for the arrival stamp and the settle memory. A set
     round's answer is the same answer in any order, so it is sorted; a round that
     declares `ordered` -- the drag rounds, where the order IS the answer -- keys on
     the sequence itself. **Sorting those erased the difference between a wrong
     order and the right one**: a team that completed the sentence first-but-wrong
     kept its early arrival stamp, and when they finally fixed the order the record
     placed them 1st -- reported from the first ef-2a class, a team badged and paid
     first that the whole room had watched come last. */
  function roundKeyOf(list){
    const seq = (list || []).slice();
    if(!(roundDef() || {}).ordered) seq.sort();
    return seq.join('\u0000');
  }

  function roundStamp(){
    if(!roundState) return;
    const at = roundState.hostAt || (roundState.hostAt = {});
    Object.keys(roundState.picks || {}).forEach(t=>{
      const key = roundKeyOf(roundState.picks[t]);
      if(!at[t] || at[t].key !== key) at[t] = { key, n: ++roundSeq };
    });
  }
  const roundAt = t => ((roundState && roundState.hostAt && roundState.hostAt[t]) || { n: Infinity }).n;

  function roundOnReplies(all){
    if(!roundLive()) return;
    /* Kept so a verdict can be addressed at **whoever actually answered**, rather
       than at everyone the roster happens to place on that competitor. */
    roundReplies = Array.isArray(all) ? all : [];
    roundState.picks = roundDef().read(all, roundState, roundCtx());
    roundStamp();
    renderRound();
    roundSettler.bump();
  }

  function roundSettle(){
    if(!roundLive()) return;
    /* The decision structure — freshness, ordering, accept, the finished forks,
       the record — is `Kit.round.resolve`, shared with the question bench. What
       is written here is only this board's effects. */
    Kit.round.resolve(roundDef(), roundState, roundCtx(), {
      settler: roundSettler,
      at: roundAt,
      scoreEach: !!roundHost.scoreEach,
      draw: renderRound,
      miss: (team, r) => roundMiss(team, r),
      right: roundRight,
      take: roundTake,
      again: roundAgain
    });
  }

  /* What a right answer *is* on a board — the recognition beat, the phone tell
     and the pay, split from the ending (see the note above `roundTake`: being
     right and the question being over are two different things). Called by the
     spine for every fresh accepted right, with `finished` already decided. */
  function roundRight(team, r, finished){
    /* Said to the phone that sent it, and only to that phone. True either way,
       and the last word of a ladder deserves the same green as the first. */
    roundSendRight(team, !finished);
    roundSendDone();
    if(roundHost.scoreEach || openToAllNow()){
      /* The board says who got it, the moment they do — only on the boards that
         lost it when the question stopped ending on a right answer. Quickfire
         never named a team per answer: every competitor answers every question
         there, so its feedback is the strip and the standings. */
      if(!roundHost.scoreEach){
        roundState.say = teamName(team) + ' has it.'; roundState.sayTeam = team;
        Sound.play(document.getElementById(roundHost.stage).classList.contains('lit')
                   ? 'sting' : 'correct');
      }
      if(!finished){
        /* A step, not a win. The card already says so; what the room needs is
           the next question — the spine re-asks once, after the loop. */
        roundState.say = teamName(team) + ' — yes.'; roundState.sayTeam = team;
        return;
      }
      if(!roundHost.scoreEach && roundState.hostTook == null){
        roundState.hostTook = team;     // the slot, paid when the question ends
        return;
      }
      const paid = roundHost.scoreEach
                     ? roundHost.win(team, roundPayout()[team] || 0)
                     : roundPayLate(team);
      notePhoneScore(teamName(team), team, null, paid || 0);
      return;
    }
    if(!finished){
      roundState.say = teamName(team) + ' — yes.'; roundState.sayTeam = team;
      Sound.play('correct');
    }
    // finished on a slot board: the spine calls roundTake, which owns the beat
  }

  /* A step moved the question on — the next rung is a new question, unless the
     round says it is not. */
  function roundAgain(){
    if(buzzHost && currentClueItem && roundReasks()) askPhones(currentClueItem.text, roundHost.game);
  }

  /* Whether this board keeps a question open after somebody has it right. Only the
     boards with a slot can answer it — Quickfire has none, so it is already true
     there by construction and asking would be a second way to say one thing. */
  function openToAllNow(){
    return !roundHost.scoreEach && !!S.get('roundOpenToAll', roundHost.game);
  }

  /* A right answer that was not first. It takes nothing — the slot is somebody
     else's — so it cannot go through `win()`, which is the function that pays *and*
     clears the tile, advances the line, ends the go. It is paid what the running rule
     decided instead.

     No streak and no `markRun`: a run is about holding the board, and this team has
     not taken anything. Paying a bonus for a second-place answer would also make the
     run multiplier the fastest way to score on a board where nobody is first. */
  function roundPayLate(team){
    const points = roundPayout()[team] || 0;
    if(!points || !teams[team]) return 0;
    /* The receipt cites the rule and the record — which pay rule was running, what
       place the record gave this team and how long they took — because "second at
       4.3s under podium" is checkable after the lesson and "+150" is not. */
    const rec   = Kit.round.results.of(team) || {};
    const place = Kit.round.results.place(team);
    return award(team, points, { streak:false,
      why: (PAY_RULES[S.get('roundPay', roundHost.game)] || PAY_RULES.winner).label +
           (isFinite(place) ? ' · ' + ordinalReport(place) : '') +
           (rec.seconds != null ? ' · ' + rec.seconds.toFixed(1) + 's' : '') });
  }

  /* ---------- the wrong-Send penalty, individuals only ----------
     How many wrong commits each phone has made *this question*, by player id —
     not a cache of anybody's index, and it dies with the question (`roundOpen`
     resets it). The cooldown rides the wire the type mode built and the infogap
     already reuses: `buzzHost.judge(id, 'wrong', {note, coolMs})` puts that
     phone alone on a displayed countdown. Time, never points — a round may not
     score, and this is the host's fact about pacing, so no round learns it. */
  let roundReplies = [];

  /* **Who to say this to.** A verdict on one competitor's answer belongs to the
     phones that produced it — the replies the host has just read — and only falls
     back to "everyone the roster puts on that competitor" when there are none,
     which is the teacher answering on the room's behalf.

     Asking the roster first was the bug waiting to happen: `p.team` is what the
     relay believes, and a phone that has joined or come back but not yet been
     seated is still reading as competitor 0. In a room of individuals that means
     one student's wrong Send putting somebody else on a countdown. Reported from a
     class of sixteen. A reply carries the id of the phone that sent it, so this
     cannot address the wrong person however stale a seat is. */
  function roundPhonesOf(team){
    if(!buzzHost) return [];
    const t = Number(team);
    const answered = (roundReplies || []).filter(r => r && Number(r.team) === t);
    if(answered.length) return answered.map(r => ({ id:r.id, name:r.name, team:t }));
    return (buzzHost.players() || []).filter(p => Number(p.team) === t)
             .map(p => ({ id:p.id, name:p.name, team:t }));
  }

  let sendMisses = {};
  /* Who is cooling right now, so the *room* can see it and not only the phone in
     the hand. Keyed by player id — never an index — and question-scoped: cleared
     wherever `sendMisses` is, so it is the record of one question rather than a
     roster cache with an invalidation table row. `until` is a wall-clock deadline
     because the strip re-reads it on a ticker; the phone counts its own down from
     the duration it was sent, exactly as every other clock here works. */
  let sendCooling = {};
  function roundSendPenalty(team, note){
    if(!Roster.solo() || !buzzHost) return 0;
    if(!S.get('roundSend', roundHost.game)) return 0;
    const secs = Number(S.get('roundSendCool', roundHost.game)) || 0;
    if(!secs) return 0;
    const ramp = !!S.get('roundSendRamp', roundHost.game);
    let waited = 0;
    /* In a solo room a competitor is one phone, and `p.team` is the relay's own
       record — the truth, since the seat seam fix. Ask the room, do not keep a
       copy of what it was told. */
    roundPhonesOf(team).forEach(p=>{
      const n = (sendMisses[p.id] || 0) + 1;
      sendMisses[p.id] = n;
      const ms = Math.round(secs * 1000 * (ramp ? n : 1));
      buzzHost.judge(p.id, 'wrong', { note: note || 'Not that one', coolMs: ms });
      sendCooling[p.id] = { name: p.name, team: Number(p.team), until: Date.now() + ms };
      waited = Math.max(waited, Math.round(ms / 1000));
    });
    renderPhoneBar();
    return waited;
  }

  /* **Tell this competitor's phones their commit landed.** The wrong half of this
     already existed as the Send penalty; the right half never did, because a correct
     answer used to be followed by a room-wide re-arm that said it implicitly. A round
     that declines the re-ask (`reasks`) has nothing else to speak with, so the phone
     is told directly — the same per-player wire the penalty rides, which no other
     handset hears and which no arm has to clear. */
  function roundSendRight(team, more){
    if(!buzzHost) return;
    /* Whether there is another one to send is the *host's* fact — it is the round
       saying `done` — so the phone is told rather than left to guess. A round that
       ends on a right answer would otherwise invite the player to keep going. */
    const note = more ? 'Yes — now the next one' : 'Yes — that finishes it';
    roundPhonesOf(team).forEach(p=>{ buzzHost.judge(p.id, 'right', { note }); });
  }

  /* **Push which options are now settled, without arming.** One definition of what
     "settled" means — the round's own `arm`, asked for it — so there is no second
     copy to drift. A round that names no `doneByTeam` pushes nothing, which is every
     round but the ordering one. The stored copy on the relay is what a reconnecting
     phone is handed back, so a player's record of their own ladder survives a
     reload; marking it live off the verdict alone would lose it on the first drop. */
  function roundSendDone(){
    const def = roundDef();
    if(!buzzHost || !roundState || !def || typeof def.done !== 'function') return;
    const per = def.done(roundState, roundCtx());
    if(Array.isArray(per)) buzzHost.done(per);
  }

  /* Whether a partial right answer changes what the phones are being asked. A round
     that says nothing means yes, which is what every round did before an ordering
     race asked to be left alone. */
  function roundReasks(){
    const def = roundDef();
    if(!def || !roundState || typeof def.reasks !== 'function') return true;
    return def.reasks(roundState) !== false;
  }

  function roundMiss(team, r){
    /* Wrong costs nothing but the time. The tile is still on the table, the other
       team is still assembling, and a class charged for a guess stops guessing. */
    const def = roundDef();
    const mode = S.get('roundCommentary', roundHost.game) || 'headline';
    /* The verdict, name-free, for the handset and the lane — both already know whose
       it is. A round that does not describe its own misses falls back to the plain
       note, so this stays correct for every round, not only the ones that opt in. */
    const rich = (typeof def.missNote === 'function') ? def.missNote(r, roundState) : 'Not that one';
    const wait = roundSendPenalty(team, S.get('roundHintPhone', roundHost.game) ? rich : 'Not that one');
    /* Stored per team so a lane or a feed can draw it; kept in every mode so flipping
       the setting mid-question has something to show. */
    roundState.verdictBy = roundState.verdictBy || {};
    roundState.verdictBy[team] = { text: rich, ok:false, at: Date.now() };
    /* The say line names the wait *once*, as part of the headline; the live countdown
       belongs to the strip. But that single overwriting headline is a blur in a room
       of individuals, so it is written only when the verdict is *meant* for it: in
       headline mode always, and in lane mode only for a round that cannot show its own
       miss (grouping can, and leaves the headline free for hints). Off writes nothing
       and leans on the running count. */
    const ownLane = (mode === 'lane') && (typeof def.missNote === 'function');
    if(mode === 'headline' || (mode === 'lane' && !ownLane)){
      roundState.say = def.saidOf(teamName(team), r, roundState)
                     + (wait ? ' · waiting ' + wait + 's' : '');
      roundState.sayTeam = team;   // whose miss this is — or the line wears the last one's colour
    }
    Sound.play('wrong');
    renderRound();
    notePhoneMiss(teamName(team), team, (roundState.picks[team] || []).join(', '), 'wrong');
    document.querySelectorAll('#clue-group .gword').forEach(el=>{
      if((roundState.picks[team] || []).indexOf(el.dataset.word) === -1) return;
      el.classList.add('shake');
      setTimeout(()=> el.classList.remove('shake'), 380);
    });
  }

  function roundTake(team){
    roundSettler.stop();
    roundState.done = true;
    roundState.say  = teamName(team) + ' has it.'; roundState.sayTeam = team;
    renderRound();
    Sound.play(document.getElementById(roundHost.stage).classList.contains('lit')
               ? 'sting' : 'correct');
    /* The class produced the answer and the host judged it, so there is nothing left
       for the teacher to confirm — the same rule a typed word has always followed.
       A beat first, or the four lighting up and the card leaving land in one frame
       and the room never sees which four it was. */
    const label = (roundDef() || {}).label || 'Round';
    /* **Payable from this instant, not from the end of the beat.** The beat is a
       pause so the room sees which four lit before the card changes — but the win
       itself must not live inside a timer: a teacher clicking Close within a
       second of the answer landing used to hit the timeout's `!roundState` guard and
       the payout silently never happened. Found by the suite driving exactly that
       click; a real teacher on a fast board would hit it too. Close already knows
       how to pay whatever `roundWin` holds. */
    if(roundHolds()) roundWin = { team, label };
    setTimeout(()=>{
      if(!roundState) return;                 // the teacher closed the card in the meantime
      if(roundHolds()) roundHold(team, label);
      else roundPaySlot({ team, label });
    }, ROUND_TAKE_MS);
  }

  /* Whether this board waits for the teacher before taking a won round off screen.
     Only the boards that put a round on the shared clue card can: Millionaire and
     Quickfire mount on their own stage, where the options are still there after the
     question ends and there is no card to hold. Read from the host's declared `onCard`
     rather than by comparing its `mount` to `CARD_MOUNT` — an external game file's mount
     is a wrapper around `E().cardMount()`, never that reference — so a third card board
     arrives already correct by declaring the fact. */
  function roundHolds(){
    return !!roundHost.onCard &&
           S.get('roundWinClose', roundHost.game) !== 'auto';
  }

  /* The card a team has just won, held open. **What is waiting is the payout, not
     the animation** — the alternative was to pay now and defer only the flip, which
     means splitting `closeModal` out of both hosts' `win()` and then re-running the
     board's after-work (a cleared Jeopardy board, a finished Blockbusters line) by
     hand from somewhere else. Deferring the whole thing keeps one path: Close
     presses the same button the round used to press for itself.

     The residual, stated rather than hidden: leaving the play screen without
     closing loses the points. Close is the only button on screen, so the only way
     there is abandoning the board — which already scores nothing on an ordinary
     clue left open, so it is the behaviour this board has always had. */
  let roundWin = null;
  function roundHold(team, label){
    roundWin = { team, label };
    /* **The prompt first, then the round — that order is load-bearing.** The round's
       card is mounted *inside* `#clue-text`, and `Kit.prompt.reveal` rewrites that
       element, so revealing the prompt second tore out the card that had just been
       drawn: the sentence, the letters or the four options simply never appeared. It
       depends on the clue's own question form, which is why it showed up as "the
       answer sometimes doesn't come up". The Reveal *button* has always done it in
       this order; this path had it backwards. */
    const inPlace = Kit.prompt.reveal(document.getElementById('clue-text'), currentClueItem);
    document.getElementById('clue-answer').style.display = inPlace ? 'none' : 'block';
    /* The answer, out on the card. This is the round's own `reveal` — the same one
       the Reveal button calls — because "what the answer was" is the round's to
       draw and there is no second version of it. Asked of `roundHost.mount()` rather
       than by id, because that is what puts the card back when the prompt has just
       replaced everything inside `#clue-text`. */
    roundDef().reveal(roundHost.mount(), roundState, roundCtx());
    // `reveal` speaks for the round; who took it is the host's, so it is said after
    roundState.say = teamName(team) + ' has it.'; roundState.sayTeam = team;
    renderRound();
    roundStandDown();
    hook('onFloorClear');         // the answer is out; whatever answer clock a game runs is over
    hideAllActionButtons();
    const close = document.getElementById('close-btn');
    close.textContent = 'Close — ' + teamName(team) + ' takes it';
    close.style.display = 'inline-block';
  }

  /* Paying a won round out. Reached either straight away (`auto`) or from the Close
     press, and it is the same function both ways so the two cannot drift. */
  function roundPaySlot(p){
    const value = currentClueValue;
    const paid = roundHost.win(p.team);
    notePhoneScore(teamName(p.team), p.team, null, paid || value);
    reportPayout(p.team, paid || value);
    /* **The winner's moment, which is now the standings.** The strip's note holds a
       second and a half and the card is already leaving, so from the back of a room a
       win was over before anybody could read whose it was — the first live class asked
       for this by name. What replaced the banner is one screen rather than two: it
       names who took it *and* shows everybody else moving, which is the thing that
       makes finishing second worth doing. It waits for the teacher rather than
       leaving by itself, because a table takes longer to read than a name. */
    if(standingsWanted(roundHost.game)){
      showStandings({ eyebrow: p.label,
                      title: teamName(p.team) + ' takes it — +' + (paid || value),
                      winner: p.team });
    }
  }

  /* The round is over — because the tile was taken, or because the teacher closed
     the card on it. Say the true thing to thirty handsets rather than leaving eight
     words up with a dead button: that is what "not asking them at all" did to the
     Daily Double, and it reads as broken rather than deliberate. */
  function roundEnd(){
    roundWin = null;         // whatever closed the card, nothing is waiting on it now
    if(!roundState) return;
    roundStandDown();
    roundState = null; roundSettler = null; roundId = null;
    S.setRound(null);        // back to the game's own value for anything that forks by round
    const host = document.getElementById('clue-group');
    if(host) host.remove();
    clearReplies();
    /* Anybody who left mid-question was held on the roster until now, because
       renumbering the competitors under a live round reattaches its per-team state
       to the wrong people. The question is over, so the tidy-up is safe — and it has
       to be asked for here rather than waited for, since the next roster event might
       be a whole lesson away. */
    if(buzzHost) seatSoloPlayers(buzzHost.players());
  }

  /* Telling thirty handsets the question is over, *without* taking the card down
     with it. The two used to be one function because they had only ever happened
     together; a won round that stays on screen splits them — the phones must stand
     down the moment the answer is out, or the room is holding a live-looking button
     for a question that has been decided, but the card is the whole point of
     waiting. The strip is deliberately not cleared here: who answered is what the
     teacher is about to read out. */
  function roundStandDown(){
    if(roundSettler) roundSettler.stop();
    if(buzzHost){
      buzzWinner = null;
      lastAsk = { mode:'off', prompt:'' };
      buzzHost.disarm();
      renderBuzzChip();
    }
  }

  /* ---- the card flip ----------------------------------------------------------
     The clue card grows out of the tile you clicked and turns over, so the tile
     itself appears to flip rather than a dialog appearing on top of it. Done with
     the Web Animations API against the real element rects, so it lands exactly on
     the tile whatever the board size. Falls back to an instant open when the
     animation is switched off or the machine asks for reduced motion. */
  const FLIP_OPEN_MS  = 1150;   // grow, hold on the value, then turn
  const FLIP_CLOSE_MS = 1000;   // turn back to the value, then settle into the tile
  const FLIP_HOLD_MS  = 550;    // beat before the card leaves, once it's been answered
  const FLIP_SPEEDS   = { relaxed:1.35, normal:1, snappy:0.72 };
  function flipMs(base){ return Math.round(base * (FLIP_SPEEDS[S.get('flipSpeed', activeGame)] || 1)); }

  // The card's own untransformed box. Measuring while a rotateY is applied gives the
  // projected box, which skews the maths and makes the card land off its tile.
  function naturalRect(card){
    const prev = card.style.transform;
    card.style.transform = 'none';
    const r = card.getBoundingClientRect();
    card.style.transform = prev;
    return r;
  }

  // 'off' is a variant like any other; reduced-motion overrides whatever is chosen
  function flipEnabled(){
    if(S.get('cardFlip', activeGame) === 'off') return false;
    try{ return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return true; }
  }

  // transform that maps the card onto `origin`'s position and size
  function originTransform(card, origin, deg){
    const c = naturalRect(card);
    const o = origin.getBoundingClientRect();
    if(!c.width || !c.height) return `rotateY(${deg}deg)`;
    const sx = Math.max(0.05, o.width / c.width);
    const sy = Math.max(0.05, o.height / c.height);
    const dx = (o.left + o.width/2) - (c.left + c.width/2);
    const dy = (o.top + o.height/2) - (c.top + c.height/2);
    return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) rotateY(${deg}deg)`;
  }

  /* The animations are registered rather than hard-coded, so a new one is a
     Kit.anim.register call plus a line in the `cardFlip` variants list — no
     branching in the game code and no panel edit.
       open(card, origin, ms, helpers)  -> Animation | null
       close(card, origin, ms, hold, helpers)
     `helpers.at(deg)` gives the transform that lands the card on its origin. */
  Kit.anim.register('cardFlip', 'grow-turn', {
    // the original, unchanged: grow out of the tile still showing its value, hold a
    // beat, then turn. Easing per segment, not across the whole run — one curve over
    // the lot makes the early phase rush and the hold on the value disappear. The
    // rotation segments are linear because an eased turn puts peak angular speed
    // exactly at the edge-on point, where the card appears to snap through.
    // rotation is 0° at .46 and 180° at 1, so it is edge-on halfway between
    edgeOn: { open: 0.73, close: 0.23 },
    open(card, origin, ms, h){
      return card.animate([
        { transform: h.at(0), opacity: 0.9, offset: 0, easing: 'cubic-bezier(.2,.85,.3,1)' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(0deg)',   opacity: 1, offset: 0.46, easing: 'linear' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity: 1, offset: 1 }
      ], { duration: ms, easing: 'linear' });
    },
    // keep turning the same way rather than reversing, come back to full size showing
    // the value, hold it a beat, then settle into the tile on a decelerating curve
    close(card, origin, ms, hold, h){
      return card.animate([
        { transform:'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity:1, offset:0,    easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.46, easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.58, easing:'cubic-bezier(.34,0,.2,1)' },
        { transform: h.at(360), opacity:0.9, offset:1 }
      ], { duration: ms, delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  /* Starts as whatever you actually clicked and unfolds into the card: a hexagon in
     Blockbusters, the tile's own corner radius in Jeopardy, and whatever a future
     board is drawn with — the shape is read off the element rather than assumed, so
     no new animation has to be written per board.
     The shape is animated on the two faces, not the card: clip-path on an element
     with transform-style:preserve-3d flattens it, which would kill the flip. */
  Kit.anim.register('cardFlip', 'morph', {
    edgeOn: { open: 0.73, close: 0.23 },        // same card keyframes as grow-turn
    open(card, origin, ms, h){
      morphFaces(card, origin, Math.round(ms*0.62), 0, false);
      return card.animate([
        { transform: h.at(0), opacity: 0.9, offset: 0, easing: 'cubic-bezier(.2,.85,.3,1)' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(0deg)',   opacity: 1, offset: 0.46, easing: 'linear' },
        { transform: 'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity: 1, offset: 1 }
      ], { duration: ms, easing: 'linear' });
    },
    close(card, origin, ms, hold, h){
      // fold back only over the closing stretch, once the card starts shrinking
      morphFaces(card, origin, Math.round(ms*0.42), (hold||0) + Math.round(ms*0.58), true);
      return card.animate([
        { transform:'translate(0px,0px) scale(1,1) rotateY(180deg)', opacity:1, offset:0,    easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.46, easing:'linear' },
        { transform:'translate(0px,0px) scale(1,1) rotateY(360deg)', opacity:1, offset:0.58, easing:'cubic-bezier(.34,0,.2,1)' },
        { transform: h.at(360), opacity:0.9, offset:1 }
      ], { duration: ms, delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  function morphFaces(card, origin, ms, delay, reverse){
    const faces = [document.getElementById('clue-front'), document.getElementById('clue-back')];
    faces.forEach(f=>{
      if(!f) return;
      // the shape is read against the face, not the card: the rounding lives on the
      // faces, so measuring the card would morph the corners to square
      const shape = Kit.shapeOf(origin, f);
      if(!shape) return;
      const kf = [{}, {}];
      kf[0][shape.prop] = reverse ? shape.to : shape.from;
      kf[1][shape.prop] = reverse ? shape.from : shape.to;
      f.animate(kf, { duration: ms, delay: delay||0,
                      easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' });
    });
  }

  Kit.anim.register('cardFlip', 'turn-only', {
    // no travel: the card is already where it belongs and simply turns over. Quicker,
    // and much less movement across the screen for a class that finds the grow busy.
    edgeOn: { open: 0.65, close: 0.33 },
    open(card, origin, ms, h){
      return card.animate([
        { transform:'scale(0.94) rotateY(0deg)',   opacity:0.6, offset:0,   easing:'cubic-bezier(.3,.9,.4,1)' },
        { transform:'scale(1) rotateY(0deg)',      opacity:1,   offset:0.3, easing:'linear' },
        { transform:'scale(1) rotateY(180deg)',    opacity:1,   offset:1 }
      ], { duration: Math.round(ms*0.8), easing:'linear' });
    },
    close(card, origin, ms, hold, h){
      return card.animate([
        { transform:'scale(1) rotateY(180deg)', opacity:1,   offset:0,    easing:'linear' },
        { transform:'scale(1) rotateY(360deg)', opacity:1,   offset:0.66, easing:'cubic-bezier(.4,0,.2,1)' },
        { transform:'scale(0.94) rotateY(360deg)', opacity:0, offset:1 }
      ], { duration: Math.round(ms*0.7), delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  Kit.anim.register('cardFlip', 'rise', {
    // no 3D at all — the card rises into place and drops back. The fallback when a
    // classroom machine can't hold a frame rate through a rotation, and it still
    // needs the 180deg so the clue face is the one showing.
    edgeOn: { open: 0, close: 1 },              // the value face never faces us at all
    open(card, origin, ms, h){
      return card.animate([
        { transform:'translateY(34px) scale(0.92) rotateY(180deg)', opacity:0, offset:0, easing:'cubic-bezier(.2,.9,.3,1)' },
        { transform:'translateY(0px) scale(1) rotateY(180deg)',     opacity:1, offset:1 }
      ], { duration: Math.round(ms*0.5), easing:'linear' });
    },
    close(card, origin, ms, hold, h){
      return card.animate([
        { transform:'translateY(0px) scale(1) rotateY(180deg)',     opacity:1, offset:0, easing:'cubic-bezier(.5,0,.75,.5)' },
        { transform:'translateY(28px) scale(0.94) rotateY(180deg)', opacity:0, offset:1 }
      ], { duration: Math.round(ms*0.45), delay: hold||0, easing:'linear', fill:'forwards' });
    }
  });

  /* Snapshot the origin transforms *before* the card's own transform is touched.
     originTransform measures via naturalRect, which forces a synchronous reflow;
     doing that after mutating the card delays the animation start by about a frame.
     Measuring first keeps the timing identical to the pre-kit implementation. */
  function originHelpers(card, origin){
    const cache = Object.create(null);
    [0, 180, 360].forEach(d => { cache[d] = originTransform(card, origin, d); });
    return { at: deg => (deg in cache) ? cache[deg] : originTransform(card, origin, deg) };
  }

  /* Take the value face off the screen the moment it turns away from the room.
     `backface-visibility:hidden` is on both faces and is *not* honoured on
     #clue-front here — captured frame by frame, the value stays painted and
     mirrored from about 100° to 180°, which is the "$100 reads backwards" report.
     It was invisible for so long because the only thing that ever hid the face was
     the `.flipped` class, and that arrives in onfinish, after the turn is over.

     So don't infer it from the geometry — drive it. Each variant declares the
     offset where its rotation is edge-on, and the face is switched at exactly that
     point. `visibility` animates discretely, which is what is wanted: a hard cut on
     the frame the face turns away, no fade to see through.

     Both faces are driven, not just the value face. Hiding only the front revealed
     what the mirrored face had been masking: the clue face is not painted during the
     turn either, so the card went blank for about four frames instead. Neither face's
     `backface-visibility` is doing anything useful here, so the swap is explicit and
     exactly one face is on screen at every instant.

     This is deliberately additive. backface-visibility and the .flipped rule both
     stay; a fifth variant that forgets to declare `edgeOn` still animates, it just
     falls back to the old behaviour rather than breaking. */
  /* Take the timing from the animation the variant actually returned rather than
     from the duration we asked for: turn-only runs at ms*0.8 and rise at ms*0.5, so
     passing the unscaled figure put the guard on a longer timeline than the turn and
     left one frame of mirrored value on screen. Reading it back means a variant can
     scale its own duration however it likes and the guard still lands. */
  function guardFace(anim, ms, at, closing){
    const front = document.getElementById('clue-front');
    const back  = document.getElementById('clue-back');
    if(!front || !back || at === undefined || at === null) return null;
    const t = anim && anim.effect && anim.effect.getTiming ? anim.effect.getTiming() : null;
    const dur   = t && typeof t.duration === 'number' ? t.duration : ms;
    const delay = t && typeof t.delay === 'number' ? t.delay : 0;
    const clamp = Math.min(1, Math.max(0, at));

    // one face on screen at every instant: they swap at the edge-on frame
    const swap = (el, from, to) => {
      const kf = clamp <= 0 ? [{ visibility:to,   offset:0 }, { visibility:to,   offset:1 }]
               : clamp >= 1 ? [{ visibility:from, offset:0 }, { visibility:from, offset:1 }]
               : [{ visibility:from, offset:0 }, { visibility:from, offset:clamp - 0.0001 },
                  { visibility:to,   offset:clamp }, { visibility:to, offset:1 }];
      return el.animate(kf, { duration: Math.max(1, dur), delay: delay, fill:'forwards' });
    };
    if(closing){ swap(front, 'hidden', 'visible'); return swap(back, 'visible', 'hidden'); }
    swap(front, 'visible', 'hidden');
    return swap(back, 'hidden', 'visible');
  }

  /* Every game draws its questions through here so the switch is read in one place.
     Off means plain text — which is exactly what the fallback path already does for
     an unrecognised form, so nothing special-cases it. */
  function drawPrompt(mount, item, game){
    if(S.get('promptForms', game)) return Kit.prompt.render(mount, item, game);
    mount.classList.remove('prompt-revealed');
    mount.textContent = String((item && item.text) || '');
    delete mount.dataset.promptType;
    return null;
  }

  function currentFlip(){
    if(!flipEnabled()) return null;
    // an animation chosen on the master tab may not suit this game — fall back
    // rather than silently doing nothing
    const want    = S.get('cardFlip', activeGame);
    const allowed = S.variantsFor('cardFlip', activeGame).map(v => v.value);
    const name    = allowed.indexOf(want) !== -1 ? want : 'grow-turn';
    return Kit.anim.get('cardFlip', name);
  }

  /* ---- dragging the card out of the way ----
     The card is centred on the screen, and the thing the teacher needs to see is
     sometimes exactly behind it — the tile they are about to take, a hexagon the
     other team is one answer from. Now that the board is visible through the layer,
     being able to shove the card aside is the other half of that.

     Written into `translate`, not `transform`: the flip animates transform through
     the Web Animations API, and an offset living in the same property would be
     overwritten by the next keyframe — or would fight the landing. They are
     separate longhands and compose, so a card can be dragged mid-flip and still
     land on its tile. */
  let cardOffset = { x:0, y:0 };
  function setCardOffset(x, y){
    cardOffset = { x, y };
    const card = document.getElementById('clue-card');
    if(card) card.style.translate = (x || y) ? (x + 'px ' + y + 'px') : '';
  }
  (function makeCardDraggable(){
    const card = document.getElementById('clue-card');
    if(!card) return;
    let from = null;
    card.addEventListener('pointerdown', e=>{
      // never steal a press meant for a control: the answer buttons and the team
      // chips live on this card, and they are what it is for
      if(e.target.closest('button, input, select, textarea, a, #clue-claim')) return;
      if(e.button !== 0 && e.pointerType === 'mouse') return;
      from = { px:e.clientX, py:e.clientY, x:cardOffset.x, y:cardOffset.y };
      document.body.classList.add('clue-dragging');
      try{ card.setPointerCapture(e.pointerId); }catch(_){}
    });
    card.addEventListener('pointermove', e=>{
      if(!from) return;
      /* Clamp so it can never be dragged off the screen entirely. Measured from the
         card's own rect rather than a guessed size, because the card is 720px on a
         TV and the width of a handset. */
      const r = card.getBoundingClientRect();
      const keep = 80;                       // this much of it stays reachable
      let x = from.x + (e.clientX - from.px);
      let y = from.y + (e.clientY - from.py);
      const left = r.left - cardOffset.x, top = r.top - cardOffset.y;
      x = Math.max(keep - left - r.width, Math.min(window.innerWidth - left - keep, x));
      y = Math.max(keep - top - r.height,  Math.min(window.innerHeight - top - keep, y));
      setCardOffset(x, y);
    });
    const end = e=>{
      if(!from) return;
      from = null;
      document.body.classList.remove('clue-dragging');
      try{ card.releasePointerCapture(e.pointerId); }catch(_){}
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  })();


  function openClueCard(origin){
    const modal = document.getElementById('clue-modal');
    const card  = document.getElementById('clue-card');
    /* A new clue arrives centred. Keeping the last drag would land the flip's
       opening animation somewhere the tile is not, and the offset was a decision
       about the *previous* question. */
    setCardOffset(0, 0);
    document.getElementById('clue-front-text').textContent =
      origin ? (origin.dataset.face || origin.textContent) : '';
    /* The card lives outside the stage, so it cannot inherit --tension the way the
       boards do. Feed it the same number, and let the game say how hot its clue is:
       `cardGlow` is a declared fact on the game rather than a branch on its name here,
       so a card game added later heats its own card without editing this shared
       opener. A game that declares none opens the card cold. */
    const glow = gameDef(activeGame);
    card.style.setProperty('--tension',
      ((glow && glow.cardGlow) ? glow.cardGlow() : 0).toFixed(3));
    modal.style.display = 'flex';
    /* The board is visible again but it is not *live*: every action while a clue is
       open belongs to the card, and the 90% scrim used to be what stopped a stray
       click opening a second clue over the first. Seeing the board and being able to
       click it are different requests; this keeps the first and refuses the second. */
    document.body.classList.add('clue-open');
    card.getAnimations().forEach(a=>a.cancel());
    ['clue-front','clue-back'].forEach(id=>{
      const f=document.getElementById(id);
      if(f){ f.getAnimations().forEach(a=>a.cancel()); f.style.clipPath=''; f.style.borderRadius=''; }
    });
    card.classList.remove('flipped');

    const impl = currentFlip();
    if(!impl || !origin){
      card.style.transform = 'rotateY(180deg)';   // rest showing the clue face
      card.classList.add('flipped');
      return;
    }
    const helpers = originHelpers(card, origin);   // measure before mutating
    card.style.transform = 'rotateY(180deg)';
    Sound.play('flip');
    const ms   = flipMs(FLIP_OPEN_MS);
    const anim = impl.open(card, origin, ms, helpers);
    guardFace(anim, ms, impl.edgeOn && impl.edgeOn.open, false);
    if(anim) anim.onfinish = ()=> card.classList.add('flipped');
    else card.classList.add('flipped');
  }

  /* **Opening a round (or an ordinary clue) on the shared card — the invariant core.**
     Three card hosts — `jeopardy.js`, `blockbusters.js`, `connections.js` — each opened
     the card with the same dozen steps in the same load-bearing order, and copies drift:
     one already had (the `onCard` reveal bug during the Jeopardy extraction). This is that
     sequence, once. A host keeps its own pre-work (before the call) and post-work (after,
     off the returned round): the Daily Double wager, the hex chooser, the review
     answer-reveal, tension and hints are genuinely a game's own and stay there.

       o = { game, mode, origin, item, source, topline, section,
             ask=true, open=true, buttons={reveal:true,close:true}, skipText }

     - `origin` is the tile/hex in play: it becomes `currentTile` (so scoring knows which to
       mark used) and the card's flip source; `null` for a board with no tile (Connections).
     - `source` is the raw bank object — the round's authored fields are carried from it onto
       `item` here, the copy every host used to write by hand and could forget.
     - `open:false` keeps the round from arming the room (a replayed Jeopardy tile asks
       nobody); `ask:false` suppresses the ordinary-question fallback (a Daily Double belongs
       to one team). Returns the live round, or null. */
  function openRoundOnCard(o){
    /* Captured before any mutation: a Daily Double already opened the card for its wager,
       and re-opening would re-flip it. Everyone else opens onto a closed card. */
    const wasOpen = document.getElementById('clue-modal').style.display === 'flex';
    currentTile = o.origin || null;
    modalMode   = o.mode;
    document.getElementById('clue-topline').textContent = o.topline || '';
    document.getElementById('clue-section').textContent = o.section || '';
    /* **The item travels whole.** `item` is the host's normalised aliases (Jeopardy
       calls a prompt `q`; the kit never learns that) and `source` is the authored
       bank object — everything the item does not already define is carried across,
       so the item on the card IS the authored question plus the aliases, not a
       filtered copy of it. This used to be a whitelist of *claimed* fields
       (`Kit.round.fields()` plus a hand-carried `round`), and the filter dropped a
       feature three times — `reveal` when Story Reveal shipped, `order` the day the
       whitelist was written, and an explicit `round:` override last, which the filter
       dropped so a clue pinned to one round silently played as whichever round claimed
       its shape. A field only a future round reads is carried today, by construction. The item wins where
       both define a key, so an alias can never be overwritten by the raw shape. */
    if(o.source){
      Object.keys(o.source).forEach(f => {
        if(o.item[f] === undefined) o.item[f] = o.source[f];
      });
    }
    currentClueItem = o.item;
    // roundOf names the host, so setup's ctx is scoped to this board — before roundOpen.
    const rnd = roundOf(o.item, o.game);
    if(rnd) o.item.answer = rnd.state.answer;   // a round's answer is derived, not authored
    drawPrompt(document.getElementById('clue-text'), o.item, o.game);
    roundEnd();                                 // stand the previous handsets down
    /* A round arms the room as it opens; the ordinary-question fallback covers the rest.
       Neither fires for a replayed tile (open:false, ask:false). */
    const opened = (rnd && o.open !== false) ? roundOpen(rnd) : null;
    if(!opened && o.ask !== false) askPhones(o.item.text, o.game);
    const ans = document.getElementById('clue-answer');
    ans.textContent = o.item.answer || '';
    ans.style.display = 'none';
    hideAllActionButtons();
    const b = o.buttons || { reveal:true, close:true };
    if(b.reveal) document.getElementById('reveal-btn').style.display = 'inline-block';
    if(b.close)  document.getElementById('close-btn').style.display  = 'inline-block';
    if(b.skip){
      const s = document.getElementById('skip-btn');
      s.textContent = o.skipText || 'Skip';
      s.style.display = 'inline-block';
    }
    renderRoundButton();                        // AFTER hideAllActionButtons — mints Check
    if(!wasOpen) openClueCard(o.origin || null);// the DD card is already open; don't re-flip
    return rnd;
  }

  /* `then` runs once the card is out of the way — a board that wants to animate
     after a clue (Blockbusters lighting up a winning route) would otherwise do it
     behind the card. */
  function closeModal(hold, then){
    hook('onFloorClear');   // a game's answer clock, if it runs one, stops with the card
    roundEnd();
    const modal  = document.getElementById('clue-modal');
    const card   = document.getElementById('clue-card');
    const origin = currentTile;
    currentTile=null; modalMode=null;          // clear state now; the animation is cosmetic

    let finished = false;
    const done = ()=>{
      if(finished) return; finished = true;
      modal.style.display='none';
      card.getAnimations().forEach(a=>a.cancel());
      // the face guard fills forwards on both faces, so drop it or they stay stuck
      ['clue-front','clue-back'].forEach(id=>{
        const f = document.getElementById(id);
        if(f) f.getAnimations().forEach(a=>a.cancel());
      });
      card.style.transform=''; card.classList.remove('flipped');
      document.body.classList.remove('clue-open');
      if(then) then();
    };
    const impl = currentFlip();
    if(!impl || !origin || !modal.style.display || modal.style.display==='none'){ done(); return; }

    card.getAnimations().forEach(a=>a.cancel());
    const helpers = originHelpers(card, origin);   // measure before mutating
    card.style.transform = 'rotateY(180deg)';
    card.classList.remove('flipped');          // the value has to be showable again
    // every close implementation uses fill:'forwards' — without it the card reverts
    // to full size for a frame before the modal hides, which reads as "it warps back in"
    const ms = flipMs(FLIP_CLOSE_MS);
    const anim = impl.close(card, origin, ms, hold||0, helpers);
    // coming back, the value face must stay off screen until it is facing the room
    guardFace(anim, ms, impl.edgeOn && impl.edgeOn.close, true);
    if(!anim){ done(); return; }
    anim.onfinish = done;
    anim.oncancel = ()=>{ if(!finished) done(); };
  }

  document.getElementById('reveal-btn').addEventListener('click', ()=>{
    /* **An open round has already decided who took it — revealing is what ends it.**
       The slot was held back so the rest of the room could finish, so this hands over
       to the ordinary take beat rather than to Correct/Wrong: the tile, the turn, the
       banner and the ending are all in there and none of them should have a second
       version. A question nobody got right has no `hostTook` and reveals as always. */
    if(roundLive() && roundState.hostTook != null){ roundTake(roundState.hostTook); return; }
    hook('onFloorClear');      // the answer is out; whatever answer clock a game runs is over
    Sound.play('reveal');
    // The word drops into the blank rather than only appearing underneath it —
    // the sentence completing itself is the moment a class actually watches. When
    // the renderer managed that, the separate answer line is just the same word
    // twice; when it couldn't (a long or explanatory answer) it is still needed.
    const inPlace = Kit.prompt.reveal(document.getElementById('clue-text'), currentClueItem);
    document.getElementById('clue-answer').style.display = inPlace ? 'none' : 'block';
    /* A grouping clue answers itself on the board: the four light up where they
       stand, which is the thing worth seeing. The answer line still prints them,
       because "which four" and "why those four" are different questions and the
       teacher is about to say the second one out loud. */
    if(roundLive()){
      if(roundSettler) roundSettler.stop();   // the answer is out; nothing left to judge
      roundDef().reveal(document.getElementById('clue-group'), roundState, roundCtx());
      renderRoundButton();
      /* The round has stopped judging, so a board that scores by claiming needs the
         chooser put back — declared as `onRoundReveal` on the game rather than named
         here, so a card game added later says for itself whether a revealed round still
         needs awarding by hand. */
      const rr = gameDef(activeGame);
      if(rr && rr.onRoundReveal) rr.onRoundReveal();
    }
    /* What a revealed clue then offers — Correct/Wrong on a hand-scored tile — is the
       game's, declared as `onClueReveal` rather than switched on the game's name here.
       A board that scores another way (Blockbusters claims) declares none. Jeopardy's
       own reveal also carries the Final's team-by-team settle, which used to be a
       `jFinalState` branch here. */
    const cr = gameDef(activeGame);
    if(cr && cr.onClueReveal) cr.onClueReveal();
  });

  /* Correct, Wrong and Close are the shared clue card's buttons, but what they *do* is
     the game's — a tile scored by hand, the deduction, the steal, the board's own
     lighting restored on close. Declared as `onClueCorrect`/`onClueWrong`/`onClueClose`
     rather than switched on the game's name here; a board that scores another way
     (Blockbusters claims) declares none, and Close falls back to just shutting the card. */
  document.getElementById('correct-btn').addEventListener('click', ()=>{
    const g = gameDef(activeGame);
    if(g && g.onClueCorrect) g.onClueCorrect();
  });
  document.getElementById('wrong-btn').addEventListener('click', ()=>{
    const g = gameDef(activeGame);
    if(g && g.onClueWrong) g.onClueWrong();
  });

  document.getElementById('close-btn').addEventListener('click', ()=>{
    /* A round that has been won is waiting on this press to pay: the win closes the
       card itself, exactly as it did when it closed it a second after the answer
       landed. Cleared first, so the close it triggers cannot come back round here. */
    if(roundWin){ const p = roundWin; roundWin = null; roundPaySlot(p); return; }
    const g = gameDef(activeGame);
    if(g && g.onClueClose) g.onClueClose(); else closeModal(0);
  });

  /* Skip belongs to whichever game put the card up. Blockbusters uses it to leave a
     hex unclaimed; Jeopardy now uses it to decline a steal, which it must have —
     offering the question with no way to say "nobody wants it" strands the teacher
     on a card with every other button hidden. */
  /* The docked settings drawer ("Lab") and its L-key toggle are gone — a game's
     settings are changed from the room bench now, not on the board. */

  document.getElementById('buzzer-chip').addEventListener('click', ()=>{
    if(buzzHost) joinPanelOpen() ? hideJoinPanel() : showJoinPanel();
  });
  document.getElementById('join-close').addEventListener('click', hideJoinPanel);
  /* The standings wait for the teacher rather than leaving on a timer, because a
     table takes longer to read than a name — and on a board where the next question
     is one press away, whoever is reading it is the one deciding when to move on. */
  document.getElementById('standings-go').addEventListener('click', hideStandings);
  document.getElementById('standings-report').addEventListener('click', ()=> renderScoreReport());
  document.getElementById('report-close').addEventListener('click', ()=>
    document.getElementById('report-modal').classList.remove('on'));
  document.getElementById('report-clear').addEventListener('click', ()=>{
    window.HubReport.clear();
    renderScoreReport();
  });
  document.getElementById('join-modal').addEventListener('click', e=>{
    if(e.target.id === 'join-modal') hideJoinPanel();      // click the backdrop to dismiss
  });

  document.getElementById('skip-btn').addEventListener('click', ()=>{
    // a card game's own "nobody claimed it" — Blockbusters leaves the hex unclaimed,
    // Jeopardy declines a steal. Both route null through their own onClaimPick.
    const g = gameDef(activeGame);
    if(g && g.onClaimPick) g.onClaimPick(null);
  });

  /* **The shared "choice bank item, as a round" adapter**, exposed as
     `HubEnv.asChoiceRound` and kept in the engine when Millionaire left, because it is
     not that game's alone: Quickfire draws Millionaire's bank the same way. A bank item
     carrying `{answer, distractors}` and no `choice:` field is not a round the registry
     can see; this builds one, without the round ever learning the bank calls a prompt
     `prompt`. Two copies would be two things that could disagree about what a question is. */
  function mAsRound(q){
    if(!q || !q.distractors) return q;
    return { text:q.prompt, answer:q.answer, type:q.type,
             choice:{ options:[q.answer, ...q.distractors], answer:q.answer } };
  }

  /* ================= PHONE BUZZERS =================
     Optional layer. Students join on their phones and buzz for the right to answer;
     the buzz says which team, so a correct word can be scored without the teacher
     deciding who was first. Everything degrades: no relay, no room, no change —
     the manual "who touched it first?" chooser is still there underneath. */
  let buzzHost = null;      // the room, while one is open
  let buzzWinner = null;    // {id,name,team} — who has the floor right now
  let buzzPlayers = 0;
  let buzzLanHost = '';     // address the relay says phones can reach it on
  let buzzEpoch = null;     // which *instance* of the room the relay reports

  /* The room that came back is not the room this page was talking to. Rooms live
     in the relay's memory and the deployed relay restarts on every push — so a
     reconnecting host recreates its room *empty*, under the same code, and every
     `ready` after that looks exactly like an ordinary reconnect. The hub keeps
     several memories of what it has already told the room precisely so a
     reconnect stays quiet; against a new room, every one of them is a lie, and
     the question was never re-armed — so a phone that rejoined landed on
     "Waiting for the teacher" over a board showing a live round. Void the lot,
     and the ready handler's own re-ask and team push then say everything again. */
  function roomForgot(){
    lastAsk = null;          // the room has been told no question
    lastPushedTeams = null;  // ...and no team names
    buzzWinner = null;       // the relay's lock died with the room
    classReplies = null;     // so did every collected reply
    /* **The solo seats need no clearing here any more, and that is the point.**
       A recreated room re-registers each phone with its page-load team — 0 for a
       bench rack — and this used to have to void a map of what each phone had
       last been told, or the new room was never told the seats at all and every
       answer arrived as competitor 0's ("Ana has it" whoever answered, after a
       deploy restarted the relay under a solo rack). `seatSoloPlayers` compares
       against the room's own record now, so those phones simply disagree with
       their seats and are re-sent on the next roster event, with nothing here
       having to remember. `soloSeat` — who owns which row — is the host's own
       record and was never the problem. */
    /* Whatever the active game told the room died with it too — Bingo's dealt
       cards and their marks are the worked example. The game declares the
       re-telling (`onRoomForgot`), because only it knows what it had said. */
    hook('onRoomForgot');
  }

  function buzzersOn(){ return S.get('buzzers') && window.HubBuzzer; }

  // What students should type in. localhost is right for this machine but useless
  // to a phone, so show the LAN address the relay reported instead.
  function joinAddress(){
    try{
      const u = new URL('join.html', location.href);
      let host = u.host;
      if(/^(localhost|127\.0\.0\.1)/.test(host) && buzzLanHost) host = buzzLanHost;
      return host + u.pathname;
    }catch(e){ return 'join.html'; }
  }

  /* The full join URL, code included, so a scan lands a student on the name screen
     with nothing left to type. Built from the same address the chip shows, which is
     the relay's own origin — the one address phones can actually reach. */
  function joinURL(){
    try{
      const u = new URL('join.html', location.href);
      if(/^(localhost|127\.0\.0\.1)/.test(u.host) && buzzLanHost) u.host = buzzLanHost;
      if(buzzHost) u.searchParams.set('code', buzzHost.code);
      /* Carry the build stamp so a new deploy hands out a NEW join URL — join.html is
         the one shell nothing else busts, so a phone that scanned an old QR keeps its
         cached, pre-upgrade shell (a `table` arm it does not understand falls back to a
         buzzer). A fresh `?v=` is a fresh cache key, so the scan fetches the current
         shell. `HUB_BUILD` is derived from the engine's own `?v=`, so it is always live;
         join.html ignores the extra param. The typed address (`joinAddress`) stays clean
         — a student cannot type a stamp — and the build-watch pill covers that path. */
      if(window.HUB_BUILD && window.HUB_BUILD !== 'dev') u.searchParams.set('v', window.HUB_BUILD);
      return u.toString();
    }catch(e){ return 'join.html'; }
  }

  /* Draw the QR into the lobby. The encoder is vendored (hub-qr.js) rather than
     fetched, because this has to work with no internet at all. Error correction 'M'
     and an auto type number: a classroom projector is a forgiving scanning target,
     but a phone at the back of the room is not. */
  function renderJoinQR(){
    const box = document.getElementById('join-qr');
    if(!box) return;
    box.innerHTML = '';
    const make = window.qrcode;
    if(typeof make !== 'function'){ box.textContent = ''; return; }   // no encoder, code still shown
    try{
      const q = make(0, 'M');
      q.addData(joinURL());
      q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    }catch(e){ box.textContent = ''; }
  }

  function showJoinPanel(){
    if(!buzzHost) return;
    document.getElementById('join-code').textContent = buzzHost.code;
    document.getElementById('join-url').textContent  = joinAddress();
    renderJoinQR();
    renderJoinCount();
    document.getElementById('join-modal').classList.add('on');
  }
  function hideJoinPanel(){ document.getElementById('join-modal').classList.remove('on'); }
  function joinPanelOpen(){ return document.getElementById('join-modal').classList.contains('on'); }
  function renderJoinCount(){
    const el = document.getElementById('join-count');
    if(el) el.textContent = buzzPlayers + (buzzPlayers === 1 ? ' phone joined' : ' phones joined');
    renderJoinRoster();
  }

  /* Every joined phone, in its team's colour, each with a remove control. Kicking
     asks the relay; the relay tells the phone (so a live one kicked by mistake
     says what happened and can rejoin in two taps), drops it, and the 'leave'
     that comes back is what heals the room — shares recompute and the replies in
     hand are re-read, both already wired to the roster changing. No confirm
     dialog: the teacher is mid-lesson, and the cost of a mis-tap is a student
     rejoining, not losing work. */
  function renderJoinRoster(){
    const box = document.getElementById('join-roster');
    if(!box) return;
    box.innerHTML = '';
    if(!buzzHost) return;
    buzzHost.players().forEach(p=>{
      const row = document.createElement('span');
      row.className = 'join-player';
      row.style.setProperty('--team', HubBuzzer.teamColour(p.team));
      const nm = document.createElement('b');
      nm.textContent = p.name;
      const off = document.createElement('button');
      off.type = 'button'; off.textContent = '×';
      off.title = 'Remove this phone from the game';
      off.addEventListener('click', ()=> buzzHost && buzzHost.kick(p.id));
      row.appendChild(nm); row.appendChild(off);
      box.appendChild(row);
    });
  }

  /* The chip is *in* the layout above the board, exactly like the replies panel —
     and it changes height on its own schedule. Opening a room is asynchronous, so it
     appears *after* the board has been fitted; then it grows again as phones join, as
     buzzers go live, as a typed answer arrives. Nothing re-fitted, so the board kept
     the height it had when the chip wasn't there and everything below was pushed off
     the bottom of the screen — Millionaire's "Final answer?" and the last rung of the
     ladder, with `body.play-fit` hiding the overflow so you couldn't even scroll to
     them. Measure around the redraw and re-fit only when the height actually moved;
     most renders change text alone and must not cost a reflow of every board. */
  function renderBuzzChip(state){
    const chip = document.getElementById('buzzer-chip');
    if(!chip) return;
    const before = chip.getBoundingClientRect().height;
    drawBuzzChip(chip, state);
    if(Math.abs(chip.getBoundingClientRect().height - before) > 0.5) hook('onResize');
    // the two are one instrument: the chip says which room, the strip says what the
    // room is doing, and every caller wants both current
    renderPhoneBar();
  }

  /* The chip is the room's identity and nothing else: how to join, the code, how
     many are in, whether the buzzers are live. It used to swap all of that out for
     whoever had just buzzed — so the moment a student got in, the class still
     joining lost the address off the screen. Who did what now has its own strip
     underneath (`renderPhoneBar`), which is the same strip in every game. */
  function drawBuzzChip(chip, state){
    if(!buzzHost){ chip.style.display='none'; return; }
    chip.style.display='flex';
    chip.className = state==='won' ? 'won' : (state==='armed' || state==='asking' ? 'armed' : '');
    chip.innerHTML='';
    const add=(cls,txt)=>{ const s=document.createElement('span'); s.className=cls; s.textContent=txt; chip.appendChild(s); };
    // the join address, so it can be read off the screen instead of the terminal
    add('buzz-join', joinAddress());
    add('buzz-code', 'code ' + buzzHost.code);
    /* The room outlives the game, so it is on screen in games that do not use it.
       Say so, rather than leaving a live-looking code above an idle class. And say
       *how* idle: in Millionaire the phones still vote when Ask the class is used,
       so "idle here" would read as "don't bother joining" to a room that is about
       to be asked something. */
    if(activeGame && defaultMode(activeGame) === 'off')
      add('buzz-idle', hook('roomNote') || (classVotes() ? 'votes only' : 'idle here'));
    add('buzz-scan', 'show QR');
    add('buzz-count', buzzPlayers + (buzzPlayers===1 ? ' phone' : ' phones'));
    if(state==='armed') add('buzz-live', 'buzzers live');
    // while the class is answering, the count is the thing the teacher watches
    if(state==='asking' && classReplies){
      add('buzz-live', classReplies.total + ' of ' + (classReplies.of || buzzPlayers) + ' in');
    }
  }

  /* ---- one strip for everything the class does ----
     Where a student's name appears used to depend on the game *and* the mode: a buzz
     went on the chip, typed answers went into the clue card in Jeopardy, under the
     sentence in Race, under the question in Millionaire — four layouts for one idea,
     and three of them moved the board as they filled.

     So it is one bar, in one place, in every game. Two rules make it work:
       · **Fixed height.** It is as tall when empty as when full, so what the class
         does can never resize the board underneath. A full class scrolls sideways
         rather than growing downwards.
       · **It outlives the question.** A word claimed in Race re-arms the phones
         within a frame, so anything shown only while the buzz was live was gone
         before the room could read it — which is exactly the "it just moved on with
         no indication who got it" problem. What it says stands until the next thing
         happens. */
  let lastScored = null;    // {name, team, value, points} — who took the last question
  function notePhoneScore(name, team, value, points){
    lastScored = { name, team, value, points };
    renderPhoneBar();
  }
  /* A miss is the most useful thing on the strip — who is nearly there, and how.
     `lastTyped` is what the typing race already uses for exactly this, so a tapped
     wrong word reads the same way rather than inventing a second shape. */
  function notePhoneMiss(name, team, value, verdict){
    lastTyped = { name, team, value, verdict:(verdict === 'close' ? 'close' : 'wrong') };
    renderPhoneBar();
  }

  function renderPhoneBar(){
    const bar = document.getElementById('phone-bar');
    if(!bar) return;
    const before = bar.getBoundingClientRect().height;
    drawPhoneBar(bar);
    // the strip is fixed-height by design, so this should never fire — it is here
    // for the one case that does change it: the room opening or closing
    if(Math.abs(bar.getBoundingClientRect().height - before) > 0.5) hook('onResize');
  }

  function drawPhoneBar(bar){
    if(!buzzHost){ bar.style.display='none'; bar.innerHTML=''; return; }
    bar.style.display='flex';
    bar.innerHTML='';
    const add=(cls,txt)=>{ const s=document.createElement('span'); s.className=cls; s.textContent=txt; bar.appendChild(s); return s; };
    const teamChip = i => { const s = add('pb-team team-'+Math.min(i,3), teamName(i)); return s; };

    /* Two voices, and they were one function until the commentary arrived. The
       *headline* is whatever loudest thing is true right now, and it early-returns
       out of five branches, which is right — only one of them can be the headline.
       The cooling chips are not a sixth branch: they are true *alongside* whichever
       won, so they are appended after it rather than competing with it. */
    bar.className = phoneBarHeadline(add, teamChip);
    drawCooling(add);
  }

  function phoneBarHeadline(add, teamChip){
    // 1. somebody has the floor — the loudest thing that can be true
    if(buzzWinner){
      add('pb-name', buzzWinner.name);
      teamChip(buzzWinner.team);
      if(buzzWinner.value != null) add('pb-typed', '\u201C' + buzzWinner.value + '\u201D');
      add('pb-note', buzzWinner.value != null ? 'got it' : 'buzzed in');
      return 'won';
    }
    // 2. the last question was taken by a phone — said plainly, and it stays said
    if(lastScored){
      add('pb-name', lastScored.name);
      teamChip(lastScored.team);
      if(lastScored.value) add('pb-typed', '\u201C' + lastScored.value + '\u201D');
      add('pb-points', '+' + lastScored.points);
      return 'scored';
    }
    // 3. a miss: who is nearly there, and how, is the most useful thing on screen
    if(lastTyped){
      add('pb-name', lastTyped.name);
      add('pb-typed', '\u201C' + lastTyped.value + '\u201D');
      add('pb-verdict', lastTyped.verdict === 'close' ? 'check the spelling' : 'not yet');
      return 'missed';
    }
    // 4. the whole room answering — the count, then what they wrote
    if(classReplies && classReplies.all.length){
      add('pb-count', classReplies.total + ' of ' + (classReplies.of || buzzPlayers || '?'));
      classReplies.all.forEach(r=>{
        const chip = add('pb-reply team-' + Math.min(r.team, 3), r.name + ': ' + r.value);
        chip.title = teamName(r.team);
      });
      return 'replies';
    }
    // 5. nothing yet — but the strip still holds its height, so the board never moves
    add('pb-idle', phoneBarHint());
    return 'idle';
  }

  /* Who is still cooling, soonest free first, with the seconds the room should read.
     **Filtered against the live roster**, because a phone kicked mid-penalty leaves
     the room and its chip has to go with it — the same rule a held reply already
     follows. Expired entries are dropped as they are found, so the map cannot outlive
     its own deadlines even before `roundOpen` empties it. */
  function coolingNow(){
    const now  = Date.now();
    const here = new Set(((buzzHost && buzzHost.players()) || []).map(p => String(p.id)));
    const live = [];
    Object.keys(sendCooling).forEach(id=>{
      const c = sendCooling[id];
      if(c.until <= now){ delete sendCooling[id]; return; }
      if(!here.has(String(id))) return;
      live.push({ name:c.name, team:c.team, left: Math.ceil((c.until - now) / 1000) });
    });
    return live.sort((a,b)=> a.left - b.left);
  }

  /* Self-stopping by construction: every tick disarms itself and re-renders, and the
     render arms it again only while a chip is still live. So a finished countdown
     costs nothing, and there is no second place holding an interval that a question
     ending, a game changing or a room closing would each have to remember to clear. */
  let coolTicker = null;
  function coolTick(){
    if(coolTicker) return;
    coolTicker = setInterval(()=>{
      clearInterval(coolTicker); coolTicker = null;
      renderPhoneBar();
    }, 500);
  }

  function drawCooling(add){
    const live = coolingNow();
    if(!live.length) return;
    live.forEach(c=>{
      /* The team class rides along so the chip keeps the shape a reply chip has, but
         the paint is amber and stays amber: what this says is *waiting*, and it is
         solo-only by construction, where there are no sides for a colour to name. */
      const chip = add('pb-cooling team-' + Math.min(c.team, 3),
                       c.name + ' · wait ' + c.left + 's');
      chip.title = c.name + ' sent a wrong answer — waiting ' + c.left + 's';
    });
    coolTick();
  }

  function phoneBarHint(){
    if(!activeGame) return 'Waiting for the class';
    if(voteLive())  return 'The class is voting';
    /* A game driving its own round outranks the mode here, exactly as it does at
       the arming end — it supplies the mode rather than a second answer, so there is
       still one map. Without it a grouping clue said "Phones are idle here" over a
       room that had just been handed eight words, with the chip beside it saying the
       opposite. */
    const own  = hook('phoneRound');
    const mode = own ? own.mode : defaultMode(activeGame);
    return mode === 'buzz'  ? 'Waiting for a buzz'
         : mode === 'type'  ? 'Waiting for someone to type it'
         : mode === 'write' ? 'Waiting for the class to answer'
         : mode === 'vote'  ? 'The class is choosing'
         : mode === 'card'  ? 'Waiting for the class'
         : 'Phones are idle here';
  }

  /* "not reachable" on its own sends you hunting. Nearly always the cause is the
     page itself — the GitHub Pages copy has no relay behind it — so say which
     problem this is rather than that there is one. */
  function buzzerProblem(){
    const relay = (S.get('buzzerRelay')||'').trim();
    if(relay) return 'no relay answering at ' + relay;
    if(location.protocol === 'file:')
      return 'opened as a file — run: node tools/buzzer-relay.js, then open the address it prints';
    if(/(^|\.)github\.io$/i.test(location.hostname))
      return 'this is the GitHub Pages copy, which has no relay behind it — open the hosted copy instead, or set a Relay address in the settings panel';
    return 'no relay at ' + location.host + ' — is node tools/buzzer-relay.js running?';
  }

  /* Which games want a phone room is now a question of what is switched on, not a
     hard-coded "race only". Asked on every game start, so turning a prototype on
     mid-lesson takes effect at the next round rather than needing a reload. */
  /* The mode decides, in every game. Race head-to-head used to open a room and arm
     buzzers whatever the setting said — a leftover from when buzzers were a
     Race-only feature — which made "Nothing — phones idle" a lie in the one game
     phones were actually used in, and made every other mode unreachable there.
     One rule now: off means no room.

     With one exception, and it is the reason voting stopped being a mode: Ask the
     class votes on the phones whenever there are phones, so Millionaire wants a
     room even at `off`. "Nothing during a question" is still honest there — the
     phones sit idle until a lifeline is used — but a room that only opens once
     somebody presses the lifeline is a room nobody has joined yet, and a class
     cannot scan, type a code and pick a team while the question is on screen. */
  /* A room whenever the feature is on, in every game — which is a reversal, and a
     deliberate one. "Off means no room" was written to keep "Nothing — phones idle"
     honest, but it made the join address disappear entirely, and a class cannot
     join a room that does not exist yet. It also read as a *game* being different
     from the others when it was only configured differently: the same report came
     in twice, once for Bingo and once for Jeopardy, both times as "the code line is
     missing here".

     The two facts were being conflated. **Whether a room exists** is a property of
     the lesson — the teacher wants phones today. **What the phones do during a
     question** is the mode, and `off` is a perfectly good answer to that: the chip
     says `idle here`, so nothing pretends otherwise. Exceptions had already been
     carved out for Millionaire's lifelines and Bingo's cards; this makes the rule
     the exception's shape rather than the other way round. */
  /* **A room exists whenever phones are switched on, game or no game.** It used to
     need `activeGame`, so the code only appeared once a board was already running —
     which is the moment it stops being useful. The whole of setup is when a class is
     walking in and getting their phones out, and they cannot join a room that does
     not exist yet. Same reversal this file already made once for `phoneMode: off`,
     and for the same reason: *whether a room exists* is a property of the lesson,
     and *what the phones do in a question* is a property of the game. Conflating
     them is what hid the code both times. */
  function phonesWanted(){ return !!S.get('buzzers'); }
  /* Both votes are worth a room even when nothing else on the board wants one:
     Millionaire's Ask the class, and Blockbusters asking the team on turn which
     hexagon to attack. */
  function classVotes(){ return !!hook('wantsVote'); }
  /* ---- one room per lesson ----
     A room used to be torn down with the game, because that is where its code
     happened to be created — so changing games minted a new 5-digit code and the
     whole class had to rejoin, rescan and retype their names. A lesson is two or
     three games; the room outlives all of them.

     So there are two different things, and only one of them is "close":
       park  — nothing for the phones in *this* game. Disarm, keep the room, keep
               everyone joined; their screens say the teacher is between questions.
       drop  — the buzzer feature itself is off, or the relay is being changed.
               Only then does the code go. */
  function syncBuzzRoom(){
    if(!phonesWanted()){ parkBuzzRoom(); return; }
    // an existing room is reused, so ask it for whatever this game has already
    // dealt — Millionaire deals its first question inside start()
    if(buzzHost) reaskPhones(); else openBuzzRoom();
    /* The chip has to be redrawn on *both* routes, not only when parking. What it
       says depends on the game — `idle here`, `votes only`, or nothing — and the
       game has only just changed. It used to be right by accident: every game with
       the mode off went through parkBuzzRoom, which redraws. Now that a room can
       outlive the mode, Blockbusters and Millionaire take the other route and the
       chip kept whatever the previous game had made it say. */
    renderBuzzChip();
    hook('onRoomSync');   // the active game repaints room-facing chrome (Blockbusters' vote button)
  }

  function parkBuzzRoom(){
    hideJoinPanel();
    clearReplies();
    buzzWinner = null; lastTyped = null; lastScored = null; lastAsk = null;
    if(buzzHost) buzzHost.disarm();
    renderBuzzChip();
    hook('onRoomSync');   // the active game repaints room-facing chrome (Blockbusters' vote button)
  }

  /* **Nothing is open to the room — disarm and say so.** Jeopardy's Daily Double belongs
     to one team alone, so the handsets are stood down as its wager opens; without this a
     phone still armed from the previous clue could buzz into a bet. A narrower cousin of
     `parkBuzzRoom`: it disarms and repaints but keeps the room and the roster, because
     the room is still the lesson's — only this one question excludes it. Lent to a card
     game through HubEnv. */
  function standDownPhones(){
    buzzWinner = null;
    lastAsk = { mode:'off', prompt:'' };
    if(buzzHost) buzzHost.disarm();
    renderBuzzChip();
    renderPhoneBar();
  }

  /* The code outlives the *page*, not just the game. Reloading the hub — which is
     the standard fix for a stale shell, and the first thing anyone does when
     something looks wrong — would otherwise mint a new code and throw the class
     out mid-lesson. Remembered per device with the relay it belongs to, and only
     for as long as a lesson could plausibly run. */
  const ROOM_KEY = 'engishism.gamehub.room';
  const ROOM_TTL = 6 * 60 * 60 * 1000;
  /* **A board opened inside the room bench takes no part in that memory**, and
     without this the bench quietly steals a live lesson's room. The memory is per
     *device*, so a bench board — same origin, same storage — read the code the
     teaching hub had stored and connected to the very same room. The relay allows
     one host and the newest wins, so the real board was replaced on its own room
     while its chip went on showing the code. Confirmed: hub on 80873, bench on
     80873.

     A rig is not a lesson. The bench's board mints its own code every time and
     stores nothing, so the two are independent and can be open side by side — which
     is the whole point of having a bench. `bench=1` is the flag the bench already
     passed for its own reasons; it means exactly this. */
  const BENCHED = /[?&]bench=1\b/.test(location.search);
  function rememberedRoom(relay){
    if(BENCHED) return null;
    try{
      const r = JSON.parse(window.localStorage.getItem(ROOM_KEY) || 'null');
      if(!r || r.relay !== relay || !/^\d{4,6}$/.test(String(r.code))) return null;
      return (Date.now() - r.at < ROOM_TTL) ? String(r.code) : null;
    }catch(e){ return null; }
  }
  function rememberRoom(code, relay){
    if(BENCHED) return;
    try{ window.localStorage.setItem(ROOM_KEY, JSON.stringify({ code, relay, at:Date.now() })); }
    catch(e){}
  }
  function forgetRoom(){ try{ window.localStorage.removeItem(ROOM_KEY); }catch(e){} }

  /* **Opening a room retries, because the common failure is a relay that is merely
     asleep.** This was one attempt, and a hosted relay on a free plan spins down
     when idle and takes the better part of a minute to wake — so the first load of
     a lesson failed, the chip settled on "no relay", and nothing tried again for
     the rest of the hour. The class cannot join a room that was never opened, and
     nothing on screen said it was worth waiting.

     Backed off rather than hammered, and it says `Connecting…` while it is trying:
     a room that is about to exist and one that never will are different facts. */
  let buzzTries = 0;
  const BUZZ_WAITS = [1500, 3000, 5000, 8000, 12000, 15000, 15000, 15000];
  function retryBuzzRoom(){
    const wait = BUZZ_WAITS[buzzTries++];
    const chip = document.getElementById('buzzer-chip');
    if(chip){
      chip.style.display = 'flex'; chip.className = 'off';
      chip.textContent = wait == null ? buzzerProblem() : 'Connecting…';
    }
    if(wait == null) return;
    // re-checked on the way in: the teacher may have switched phones off meanwhile
    setTimeout(()=>{ if(buzzersOn() && !buzzHost) openBuzzRoom(); }, wait);
  }

  function openBuzzRoom(){
    if(!buzzersOn() || buzzHost) return;
    const relay = S.get('buzzerRelay') || '';
    /* Still asks the relay for a code even when reusing one: the reply also carries
       the LAN address the join link needs, and an unclaimed code costs nothing —
       a room only exists once a host connects to it. */
    HubBuzzer.newCode(relay).then(info=>{
      const code = (info && info.code) ? (rememberedRoom(relay) || info.code) : null;
      buzzLanHost = (info && info.lan) || '';
      // no relay answered — say so, and keep trying, because it may only be waking
      if(!code){ retryBuzzRoom(); return; }
      buzzTries = 0;
      rememberRoom(code, relay);
      buzzHost = HubBuzzer.host({ relay, code });
      /* The room this page is hosting, stated rather than scraped — the same
         convention the playground pages use, so anything looking in from outside
         (the phone bench, a test) asks one question of any board: what room are
         you running? Without it the only handle was the chip's text, which is
         prose and changes with the mode. */
      window.HubHost = buzzHost;
      buzzHost.on('ready',   d=>{ if(d.epoch && buzzEpoch && d.epoch !== buzzEpoch) roomForgot();
                                  if(d.epoch) buzzEpoch = d.epoch;
                                  buzzPlayers=(d.players||[]).length; pushTeamNames();
                                  renderBuzzChip(); renderJoinCount(); reaskPhones();
                                  /* The room arrives after the board is built, so
                                     anything a game paints from the room has to be
                                     painted here — Bingo's dealt cards, Millionaire's
                                     Ask-the-class button, Blockbusters' vote button
                                     all shipped that bug once each, by name. The
                                     game declares it now. */
                                  hook('onRoomReady'); });
      /* **Which side a student is on, recorded from the one event that can only be
         their own choice.** See `rememberSides` for why nothing else will do. */
      buzzHost.on('join', p=> rememberSides(p));
      buzzHost.on('players', list=>{ buzzPlayers=list.length;
                                     /* First, because everything below is judged
                                        against the roster and in a solo room this
                                        is what the roster *is*. */
                                     seatSoloPlayers(list);
                                     renderBuzzChip(); renderJoinCount();
                                     // a game holding per-player state hears every
                                     // roster push — a latecomer gets a bingo card
                                     hook('onPlayers', list);
                                     /* …and a team that just grew or shrank gets a
                                        new share of the group. Pushed, never
                                        re-armed: a latecomer must not wipe what the
                                        rest of their team had already agreed on. */
                                     roundPushShares(); renderRound();
                                     /* …and what the replies already in hand *mean*
                                        has changed with it. A round that waits for a
                                        whole team is judged against the roster, so a
                                        team of three sitting at 2 becomes unanimous
                                        the moment the third phone drops off — and
                                        nothing else would ever tell it, because a
                                        leaver sends no reply. A student whose phone
                                        dies must not be able to freeze their team. */
                                     reReadReplies(); });
      buzzHost.on('buzz',    onBuzz);
      buzzHost.on('response', onResponse);
      renderBuzzChip();
    /* A rejected request, not merely a null code — an unreachable relay throws
       rather than answering, and without this the failure was unhandled and the
       chip kept whatever it had said before. */
    }).catch(retryBuzzRoom);
  }

  function dropBuzzRoom(){
    hideJoinPanel();
    forgetRoom();
    if(buzzHost){ buzzHost.close(); buzzHost=null; window.HubHost = null; }
    buzzEpoch=null;
    buzzWinner=null; buzzPlayers=0; lastTyped=null; lastScored=null;
    // the room is gone: a game holding a board vote clears it (Blockbusters' hex vote)
    hook('onRoomDrop');
    const chip=document.getElementById('buzzer-chip');
    if(chip) chip.style.display='none';
  }

  /* Switching the feature off, or pointing it at a different relay, is the one
     thing that genuinely ends a room — everything else parks it. */
  S.onChange(id=>{
    if(id !== 'buzzers' && id !== 'buzzerRelay') return;
    dropBuzzRoom();
    syncBuzzRoom();
  });

  /* Changing what the phones do is exactly the thing the Lab exists for, so it has
     to take effect on this question rather than the next game. Never a drop: the
     room is the lesson's, and switching a dynamic must not make thirty people
     rejoin. `syncBuzzRoom` opens, re-asks or parks as the new value requires —
     including opening one for Ask the class when the mode itself is off. */
  S.onChange(id=>{
    if(id !== 'round_default' && id !== 'mLifelines' && id !== 'bbTeamVote') return;
    syncBuzzRoom();
    hook('onRoomSync');   // the active game repaints room-facing chrome (Blockbusters' vote button)
  });

  /* ---------- individual play: the roster is whoever has joined ----------
     In team play a teacher fills the roster with the + Player button and a student
     picks which side they are on. In individual play neither of those is a question
     anybody can answer: a person *is* a competitor, so the roster is the room.

     **Keyed by player id, mapped to the competitor's id, and never to an index.**
     Both ends of that would be wrong as an index: a phone reconnects under the same
     player id, which is what makes a seat survive a dropped connection, and a
     competitor's index shifts the moment one above it is removed — which is exactly
     the bug that paid a Drag the Letters win to a team that no longer existed.

     **A phone that leaves keeps its seat.** A student whose battery dies has still
     played, and their score is a lesson's work; binning a competitor because a
     handset went quiet would be the same mistake the team bar's confirm exists to
     stop. They come back to the same slot. */
  /* Keyed by player id and holding a competitor **id**, so nothing in it shifts when
     a row is removed. The map that used to sit beside it held an *index* — what each
     phone was last told — and every way that could go stale was a separate bug; it is
     gone, and `seatSoloPlayers` asks the room instead. */
  const soloSeat = Object.create(null);   // playerId -> competitor id

  /* **The other direction, which the roster did not have: a competitor who has gone.**
     The rule above — a phone that leaves keeps its seat — was written for a student
     whose battery dies mid-lesson, and it is right for exactly that. Applied to
     *every* departure it made the roster a one-way ratchet: seven phones on the room
     bench, then five removed, and the board still listed everybody. The bench cannot
     mirror a room it can only add to.

     **What the original rule was actually protecting is a score**, and that is what
     this keeps: a competitor holding points stays whatever their handset does, and
     their seat stays with them so they come back to the same row. One who never
     scored is not a lesson's work, it is clutter, and it goes with the phone.

     Never below the floor, because a board with nothing on it is not a state worth
     reaching — the two placeholders are where an empty room starts and where it
     returns to. */
  function dropDepartedSolo(list){
    if(!Roster.solo()) return false;
    /* **Never while a question is open.** Dropping a competitor closes the gap in
       `teams`, so every index above it moves — and a live round's per-team state is
       keyed by index: the ladders, the picks, the agreement counts, who took the
       slot, the arrival record. A phone that dies mid-question would hand its ladder
       to whoever sat below it. *Scores are safe either way* — they ride the
       competitor object and move with it, and a competitor holding points is never
       dropped at all — but the round's own state does not, and there is no reason it
       should have to: a student mid-question is not clutter. The tidy-up happens
       when the question ends, which is the moment the state it would scramble stops
       existing. The `onTeamsChanged` hook below is the same problem solved bluntly for
       a game's own per-team state (Millionaire's ladders); this is why nothing else
       needs that treatment. */
    if(roundLive()) return false;
    const here = Object.create(null);
    (list || []).forEach(p=>{ if(p && p.id) here[p.id] = true; });
    let dropped = false;
    Object.keys(soloSeat).forEach(pid=>{
      if(here[pid] || teams.length <= Roster.floor()) return;
      const comp = Roster.byId(soloSeat[pid]);
      if(comp && comp.score !== 0) return;      // played and scored: the row is theirs
      const i = comp ? teams.indexOf(comp) : -1;
      if(i >= 0){ teams.splice(i, 1); dropped = true; }
      delete soloSeat[pid];
    });
    if(dropped){
      /* Every seat above the hole has moved. That used to need a second map voided
         here — what each phone was last told was now a lie about all of them — and
         it is structural instead: the shifted phones disagree with their new index
         and `seatSoloPlayers` re-sends them on the next roster event. A game holding
         per-team state keyed by index resets it through the hook, the same as a team
         removal. */
      hook('onTeamsChanged', -1);
      if(active >= teams.length) active = Math.max(0, teams.length - 1);
    }
    return dropped;
  }

  function seatSoloPlayers(list){
    if(!Roster.solo() || !buzzHost) return;
    let changed = dropDepartedSolo(list);
    (list || []).forEach(p=>{
      if(!p || !p.id) return;
      let comp = soloSeat[p.id] ? Roster.byId(soloSeat[p.id]) : null;
      if(!comp){
        /* An unclaimed placeholder first — the two the app starts with. Otherwise a
           room of six reads "Team 1 · Team 2 · Ana · Ben · Cara · Dan", with two
           empty rows nobody put there. Unclaimed means auto-named, unscored and not
           already somebody's seat. */
        const taken = Object.keys(soloSeat).map(k => soloSeat[k]);
        comp = teams.find(t => t.auto && !t.score && taken.indexOf(t.id) === -1);
        if(!comp){ Roster.add(p.name); comp = teams[teams.length - 1]; }
        comp.name = p.name || comp.name;
        comp.auto = false;
        soloSeat[p.id] = comp.id;
        changed = true;
      }
      const at = teams.indexOf(comp);
      /* **Seat whenever the room disagrees with the seat, and keep no memory of
         what was sent.** This used to compare against a `soloSeatAt` map —
         playerId → the index last POSTed — because `seat` did not come back to the
         host and `p.team` was therefore always the join-time value, so comparing
         against it would have re-POSTed forever. `HubBuzzer.seat` writes the new
         value into the host's own copy now, which is what makes this terminate:
         one pass, then the two agree.

         **The map had to go rather than gain a fourth invalidation point.** Every
         way its record could stop being true was a separate bug — a relay restart
         (the room forgets, the phones rejoin on their page-load team), a competitor
         dropped (every index above the hole moves), a roster swap — and each was
         fixed by remembering to clear it somewhere. The one that survived all of
         that was a race: sixteen phones joining at once fire sixteen roster pushes,
         each replacing the host's list wholesale, and any phone whose seat had not
         yet reached the relay came back on team 0 with the local write discarded.
         The map then said "already seated", so it was never re-sent, and with no
         further roster event it stayed wrong all lesson — one student capped at
         half the answer and unable to finish. Reported twice.

         Comparing against what the room actually believes needs no invalidation at
         all: after a restart, a drop or a swap the phones simply disagree, and the
         next roster event puts them right. */
      if(at >= 0 && Number(p.team) !== at) buzzHost.seat(p.id, at);
    });
    if(changed){ renderScorebar(); renderRosterPick(); hook('onRoster'); }
  }

  /* The other half of the swap: put every handset back on the side its student
     chose, once, on the way back from solo.

     **Once, not continuously**, and that is the whole design. In teams mode the
     student owns which side they are on — they pick it when they join and may change
     it from their own phone — so a host that re-asserted a team on every roster event
     would quietly overrule them. This fires on the transition and clears its own
     flag. A player nobody remembers (they joined during solo) lands on team 0, which
     is where a new phone lands anyway. */
  /* **Recorded from the join, and from nothing else — which took three attempts.**
     A student's side is a fact about *them*: they pick it on the join screen, and
     going to solo and back has to be able to put them there again.

     Attempt one read every player's current team off the relay whenever the roster
     mode changed. That is the value **solo has just overwritten**, so the first round
     trip worked and the next recorded the solo seats as if they were the students'
     choices — four phones flipped teams → solo → teams → solo → teams and collapsed
     onto Team 1, which is exactly the "flip back and forth and they all turn blue"
     report.

     Attempt two recorded the first sighting in the roster and never rewrote it. Also
     wrong, and it failed identically: a join is processed in more than one step, so
     the first roster event a new phone appears in can still carry team 0 — and being
     write-once, that zero was permanent.

     What both attempts shared is re-deriving a choice from a list the **host itself
     writes to**. The relay names the joining player on its own event, with the team
     that handset sent, and nothing the host does produces one of those. So this is
     driven by `join` and overwrites freely: a student changing side goes through
     "Not you?", which rejoins, which is another join. Skipped in solo, where a
     competitor index means something else entirely. */
  /* **Still the student's own choice, not a seat the host wrote** — the question a
     reader will have now that `seat` updates the host's copy. Guarded on `!solo`, and
     seats are only ever sent in a room of individuals or on the way back into teams,
     so on the way *out* of teams nothing has overwritten `p.team`: it is the side the
     student picked when they joined, which is exactly what this has to remember. */
  function rememberSides(p){
    if(Roster.solo() || !p || !p.id) return;
    teamSeat[p.id] = Number(p.team) || 0;
  }

  function seatTeamPlayers(list){
    if(!reseatTeams || Roster.solo() || !buzzHost) return;
    reseatTeams = false;
    (list || []).forEach(p=>{
      if(!p || !p.id) return;
      const want = Math.min(teamSeat[p.id] || 0, Math.max(0, teams.length - 1));
      /* **Sent unconditionally, and it stays that way — but the original reason is
         no longer the reason.** The first version compared against `p.team` and sent
         only on a difference, which concluded every phone was already right and sent
         nothing while every phone sat on its solo index. That was because `seat` did
         not come back to the host, so `p.team` was the value from the last *join*.

         `HubBuzzer.seat` keeps the host's copy current now (see the note there, and
         the cache table in CLAUDE.md), so `p.team` here *is* trustworthy and the
         comparison would work. It is still not worth making: this runs **once per
         switch**, so a handful of extra posts costs nothing, and a conditional send
         would buy that nothing in exchange for depending on the local copy being
         right. Unconditional is the cheaper contract. */
      buzzHost.seat(p.id, want);
    });
  }

  /* The phones need the team list, not just at the start: a team renamed mid-lesson
     or a fifth added has to reach every handset, because the name on the phone is
     how a student knows which score on the board is theirs. Called from
     renderScorebar, which is the one place that runs on any change to the teams —
     and skipped when nothing about the list actually moved, because that render
     also runs on every point scored and a POST per point is a waste of the room's
     wifi. */
  let lastPushedTeams = null;
  function pushTeamNames(){
    if(!buzzHost) return;
    const names = teams.map(t=>t.name);
    const solo = Roster.solo();
    /* The mode is part of the key: switching to individuals changes nothing about
       the names, and the join screen has to hear about it anyway. */
    const key = names.join('\u0000') + '\u0001' + solo;
    if(key === lastPushedTeams) return;
    lastPushedTeams = key;
    buzzHost.setTeams(names, solo);
  }

  /* Ask the whole class rather than racing for the floor. `mode` is 'vote' (pick
     one of the options) or 'answer' (type it). Replies arrive on onResponse.
     `team` narrows it to one side of the room — Blockbusters asks the team on turn
     which hexagon to attack — and the phones that are not entitled show the
     question with no controls rather than a button that would be discarded. */
  let classReplies = null;         // {mode, tally, all, of} while a round is open

  function askClass(prompt, mode, options, team){
    if(!buzzHost) return false;
    classReplies = { mode, tally:{}, all:[], total:0, of:buzzPlayers };
    buzzWinner = null;
    buzzHost.arm(prompt || '', { mode, options: options || [],
                                 team: (team == null ? null : Number(team)),
                                 keepSpent: !S.get('phoneOneEach', activeGame) });
    renderBuzzChip('asking');
    return true;
  }

  function onResponse(d){
    if(!d) return;
    /* A game may consume a raw reply before the shared collect-and-count path —
       a tap on a bingo card is a typed answer without the typing, judged per
       player against that player's own card, and it is nobody's team answer. */
    if(d.latest && hook('onPhoneReply', d.latest)) return;
    classReplies = { mode:(classReplies && classReplies.mode) || 'answer',
                     tally:d.tally || {}, all:d.all || [], total:d.total || 0, of:d.of || 0 };
    /* Where the numbers go is the game's business — Millionaire paints them on its
       four options, Blockbusters counts letters in a strip beside the legend. Same
       vote object, same recount, different board. */
    hook('onVoteReply', classReplies.all);
    renderReplies();
    renderBuzzChip('asking');
  }

  /* The same replies, read again. Nothing new has arrived — what changed is the room
     they are being read against, which is the roster. Separate from `onResponse`
     because there is no `latest`, no new tally and no chip to repaint: the only thing
     that can differ is what the game makes of what it already has. */
  function reReadReplies(){
    if(classReplies && (classReplies.all || []).length) hook('onVoteReply', classReplies.all);
  }

  /* One entry point for "a question just went up, ask the room". One mode is live
     at a time — that is what `phoneMode` being a variant rather than four switches
     buys — so this is a lookup, not a precedence. */
  /* What the room was last told, so a re-ask that changes nothing can stay silent.
     An `arm` is not free: it clears the relay's lock and its collected responses,
     and on the handset it resets the button. So a repeated one is visible as a
     flicker even when nothing is wrong. */
  let lastAsk = null;

  /* Which of the default round's four modes is chosen for this game. One name for
     it, because it is read in eight places and every one of them used to spell out
     a setting id that has now changed once. */
  function defaultMode(game){ return S.get('round_default', game || activeGame); }

  /* What the room should be in right now: the game's own round if it has one, the
     **default round** otherwise. One definition, so arming and re-asking cannot
     disagree — they did, and a reconnect then replaced a bingo card with a buzzer.

     **There is always a round now** (F3.8.16). This used to return the game's round
     *or else* a bare mode read off `phoneMode`, and that `or else` was the last place
     in the app where a question might not be a round. An ordinary question is handled
     by `rounds/default.js`, whose four modes are the old `phoneMode` values, so what
     comes back here is the same shape either way and every caller downstream stopped
     needing to know which it got. */
  function phoneRoundNow(game, prompt){
    const own = hook('phoneRound');
    /* Everything after `options` is carried through rather than interpreted: what a
       multi-pick reply means, or whose round it is, is the game's business exactly
       as it is the relay's business to carry it and not to read it. `undefined`
       drops out of the JSON, so a game that says nothing about them — which is four
       of the five, and Bingo's cards — arms exactly as it did before. */
    /* **`keepSpent` defaults to what the setting promises, not to true.** It used to
       default to true for any round, which was invisible while all five shaped
       rounds set `rethink:true` — the relay never marks a player spent when they are
       allowed to change their mind, so the list was always empty and never needed
       clearing. Quickfire is the first round to ask for a locked-in answer, and the
       two together meant a student answered question one and was refused for the
       rest of the run with "you have already answered this one".

       The honest default is the one `phoneOneEach` describes on its own row: *one
       answer each per question*, so a new question clears the list. Bingo still asks
       to keep it explicitly, because a card and its marks are the thing that has to
       outlive the call. */
    /* Spread, not a key list. This used to copy `multi`, `multiByTeam`, `holds`,
       `rethink` and `team` by name — a photograph of what rounds carried the day it
       was written, and it had already gone stale: `optionsByTeam` was never in it,
       so a re-ask silently dropped the ordering race's per-team pools, and
       `promptByPlayer` would have been dropped the day the information gap shipped.
       Carrying the object itself is what "carried through rather than interpreted"
       actually means. */
    if(own) return Object.assign({}, own, {
                     prompt: own.prompt || '', options: own.options || [],
                     keepSpent: own.keepSpent != null
                                  ? own.keepSpent
                                  : !S.get('phoneOneEach', game) });
    /* `isDefault` is what `askPhones` reads instead of asking whether a game declared
       a round. The four shared dynamics below it — buzz, type, write, idle — are hub
       services rather than this round's private code: they carry the answer clock,
       the cooldown, the one-answer-each rule and the reply strip, and a shaped round
       arms the relay directly because by definition it wants none of them. */
    return { mode: defaultMode(game), prompt: prompt || '', options: [], isDefault: true };
  }

  function askPhones(prompt, game){
    if(!buzzHost) return;
    const round = phoneRoundNow(game, prompt);
    lastAsk = { mode: round.mode, prompt: round.prompt };
    /* A shaped round arms directly: the four dynamics below are hub services the
       default round asks for by name, and a shaped round wants none of them. Asked
       as "is this the default round" rather than "did the game declare one",
       because those stopped being the same question — there is a round either
       way now. */
    if(!round.isDefault){
      /* `lastTyped` as well as `lastScored`: a new question retires *both* halves of
         the last one. The shared modes get this from `armBuzzers`, which clears it
         unless the arm is a reopen — a game driving its own round never goes through
         there, so a grouping clue's "not a group" would have sat on the strip over
         the next clue, naming a team for a question that had gone. */
      clearReplies(); lastScored = null; lastTyped = null; buzzWinner = null;
      /* The commit beat: in a room of individuals a tap round holds its taps
         until the player presses Send (`roundSend`). Decided here, not by the
         round — the roster mode is the host's live fact — and only for the tap
         dynamics: buzz already is a commit, and write/type have their own Send. */
      if((round.mode === 'vote' || round.mode === 'arrange' || round.mode === 'table') &&
         Roster.solo() && S.get('roundSend', game)) round.send = true;
      /* Previews only mean anything where a tap is *held* — with no Send the tap is
         already the answer and the bar has always followed it. So this rides on the
         back of `send` rather than being a second thing to keep in step. */
      if(round.send && S.get('crowdLive', game)) round.preview = true;
      /* The whole payload, not a key list — same reasoning as `phoneRoundNow`'s
         spread, and it is the same bug paid for at the same moment. The relay
         ignores what it does not know. */
      buzzHost.arm(round.prompt, round);
      renderBuzzChip('asking');
      renderPhoneBar();
      return;
    }
    clearReplies();
    /* A new question retires the last result. It has to survive the *previous*
       question's re-arm — Race re-arms within a frame of a word being claimed — but
       it must not sit over the next one. */
    lastScored = null;
    // the question only travels if the teacher wants it to — sometimes the point
    // is that they read the board, not their hand
    if(!S.get('phonePrompt', game)) prompt = '';
    const mode = round.mode;
    if(mode === 'write')     askClass(prompt, 'answer');
    else if(mode === 'buzz') armBuzzers(prompt);
    else if(mode === 'type') armBuzzers(prompt, { mode:'type' });
    /* `off` is a state to put the phones *into*, not an absence of one. A room now
       outlives the mode — Millionaire keeps one open for Ask the class — so leaving
       a game that was buzzing, or closing a vote with the mode off, would otherwise
       leave thirty handsets showing a live button for a question that has gone. */
    else if(buzzHost){ buzzWinner = null; buzzHost.disarm(); renderBuzzChip(); }
  }

  /* Opening the room is asynchronous — it fetches a code — so a game that deals its
     first question during start() has already asked the phones before there were any
     phones to ask. Millionaire deals on start, so its opening question reached
     nobody. Re-ask whatever is live the moment the room is up. */
  function reaskPhones(){
    if(!buzzHost || !activeGame) return;
    /* A vote in progress outranks the mode: re-asking here would replace the four
       options on every phone with a buzzer, mid-vote, and the votes already cast
       would be the only ones counted. Whoever closes the vote re-asks. */
    if(voteLive()) return;
    /* And so does somebody holding the floor. This runs on every `ready` from the
       relay — which is *every reconnection of the host's stream*, not just the
       first — and re-arming clears `buzzWinner`, so a student's buzz was being
       silently thrown away and the buzzers reopened a moment later. On classroom
       wifi that is not an edge case; it is what a dropped connection does. The job
       here is "the room came back, tell it what is being asked", never "cancel what
       is in progress". The relay still holds the lock, so a phone reconnecting
       mid-buzz is told who got in. */
    if(buzzWinner) return;
    /* The same rule, for the mode where nobody takes the floor. In `write` the whole
       room answers, so what a re-ask would destroy is not one student's buzz but
       every answer already given — the relay clears its responses on `arm`. Two of
       four vanished in the strip suite and it looked like the strip losing them; the
       host had asked twice, because a `ready` arrives on *every* reconnection of its
       stream. A class on school wifi reconnects all lesson, so half the room's
       answers disappearing is the normal case, not the edge one. */
    if(classReplies && classReplies.all && classReplies.all.length) return;
    if(!hook('askingNow')) return;
    /* Nothing has changed, so there is nothing to say. `ready` arrives on every
       reconnection of the host's stream, and re-arming an already-armed room resets
       every handset's button — which is what the room sees as the buzzer flickering
       on and off. Re-asking is for telling a room that came back *what is being
       asked*, so if it already knows, stay quiet. */
    const prompt = currentPhonePrompt();
    const want = phoneRoundNow(activeGame, prompt);
    if(lastAsk && lastAsk.mode === want.mode && lastAsk.prompt === want.prompt) return;
    askPhones(prompt, activeGame);
  }

  /* A vote is open on the board — the fact lives here rather than in each caller, the
     same reason `Kit.floorTop()` exists. Asked of the active game, because only a game
     that borrows the phones for a board vote (Blockbusters) knows; the rest answer the
     default false. */
  function voteLive(){ return !!hook('voteLive'); }

  function clearReplies(){
    classReplies = null;
    renderPhoneBar();
  }

  /* Answers used to be drawn wherever the current game happened to have room — the
     clue card, under the race sentence, under the Millionaire question — which is
     three layouts for one idea, and two of them grew the page as the class typed.
     They go in the standard strip now, like everything else the class does. */
  function renderReplies(){ renderPhoneBar(); }

  /* `opts.mode` picks the shape ('type' carries a typed answer with the buzz);
     `opts.reopen` says this is the same question coming back after a wrong answer,
     which is what stops every other phone losing what it was halfway through
     typing. */
  function armBuzzers(prompt, opts){
    buzzWinner=null;
    hook('onFloorClear');   // the floor is open again, so a game's answer clock stops
    // a reopen is the same question, so the miss that caused it stays on the chip —
    // clearing it here wiped the one piece of information the teacher wanted
    if(!(opts && opts.reopen)) lastTyped=null;
    /* The answer clock travels with the arm so the relay can hand it to whichever
       phone takes the floor — and to the room watching them. How long the floor lasts
       is the game's own rule, declared as `floorSeconds()` rather than switched on the
       game's name here (Jeopardy's is `jAnswerSeconds`). A typing race needs no clock —
       the typed word is judged the instant it arrives — so it is gated out here, which
       is a shared truth about floors rather than any one game's setting. */
    const answerSecs = typingRace() ? 0 : (Number(hook('floorSeconds')) || 0);
    if(buzzHost) buzzHost.arm(prompt||'', Object.assign(
      { mode: typingRace() ? 'type' : 'buzz', answerSecs: answerSecs || undefined }, opts||{}));
    renderBuzzChip('armed');
  }
  function typingRace(){ return !!activeGame && defaultMode(activeGame) === 'type'; }
  /* The mode where the whole room answers rather than one phone taking the floor.
     Nobody wins the question, so nothing about the round should behave as if
     somebody had — the turn rotates instead of being kept. */
  function everyoneAnswers(){ return !!activeGame && defaultMode(activeGame) === 'write'; }
  // the modes where one phone takes the floor, as opposed to the whole room answering
  function phoneRaces(){
    const m = activeGame ? defaultMode(activeGame) : 'off';
    return m === 'buzz' || m === 'type';
  }
  function resetBuzzers(){
    buzzWinner=null;
    if(buzzHost) buzzHost.reset();
    renderBuzzChip();
  }

  /* What the room is being asked for right now, so a typed answer can be judged
     against it. Each game already holds it; this is the one place that knows where.
     Returns '' when nothing is open, which declines the buzz rather than guessing. */
  /* Both tile games ask this, and it used to be written out at the one call site
     that needed it — `modal.style.display === 'flex'`. A game should not have to
     know how the shared modal is hidden. */
  function clueIsOpen(){
    const modal = document.getElementById('clue-modal');
    return !!(currentClueItem && modal && modal.style.display === 'flex');
  }

  function expectedAnswer(){ return hook('expects') || ''; }

  let lastTyped = null;      // {name, value, verdict} — what the chip shows the teacher

  /* A buzz carrying text is the typing race: the floor goes to the first student to
     *produce* the word, not the first to hit a button. Judged here and only here —
     the relay never learns the answer, so it can never be asked for it.

     A miss costs time, not points. That is the same decision every other mechanic
     in this app makes, and it matters more here: the student who is closest to the
     word is the one most likely to buzz early and get it slightly wrong. */
  function judgeTypedBuzz(b){
    const expected = expectedAnswer();
    const verdict  = expected ? Kit.answer.judge(b.value, expected) : 'wrong';
    const strict   = S.get('typeStrict', activeGame);
    const accepted = verdict === 'right' || (verdict === 'close' && !strict);
    lastTyped = { name:b.name, value:b.value, verdict };

    if(accepted){
      if(buzzHost) buzzHost.judge(b.id, verdict, { coolMs:0,
        note: verdict === 'close' ? 'Close — check your spelling' : 'You got it!' });
      return true;
    }
    const coolMs = Math.round((Number(S.get('typeCooldown', activeGame)) || 0) * 1000);
    if(buzzHost) buzzHost.judge(b.id, 'wrong', { coolMs,
      note: verdict === 'close' ? 'Not quite — check your spelling' : 'Not quite' });
    Sound.play('wrong');
    // the question is still live for everybody else, so put the floor back — as a
    // reopen, or every other phone loses the word it was halfway through typing
    armBuzzers(currentPhonePrompt(), { mode:'type', reopen:true });
    renderBuzzChip('armed');
    return false;
  }

  /* The prompt as the phones currently have it, for a re-arm. Re-deriving it would
     mean each game answering the same question twice. */
  function currentPhonePrompt(){
    // the question only travels if the teacher wants it to — sometimes the point is
    // that they read the board, not their hand
    if(!S.get('phonePrompt', activeGame)) return '';
    return hook('phonePrompt') || '';
  }

  function onBuzz(b){
    /* Refusing a buzz is not the same as ignoring one: the relay locks the room on
       the *first* buzz whoever it came from, so a phone that is not entitled would
       hold the lock and the team that is could never get in. Re-arming clears the
       lock and puts the floor back. Race's steal rule and Millionaire's `speaker`
       role are both this, and both used to be written out here by name. */
    if(b && hook('buzzEntitled', b) === false){
      /* Re-arming is right when the question is still open — it clears the relay's
         lock so the team that *is* entitled can get in. It is wrong when nothing is
         open to the room at all: a Daily Double belongs to one team, so re-arming
         there would put the buzzers back for a question nobody may answer. Two
         different refusals, and the difference is whether a question is live. */
      /* Put the room back into whatever it *should* be in — which is not always a
         buzzer. `armBuzzers` was written when the only shared dynamics were the
         phone modes, so it hard-codes one: a game that owns its round would have had
         its round replaced by a buzzer, by the very code meant to recover from a
         stray buzz. Same shape as every other list that named what it should have
         asked. `askPhones` consults `phoneRound()` and re-establishes the real one.

         It costs the round's collected replies, because the relay clears them on any
         arm — but the buzz has already taken the room out of the round (it sets
         `armed:false` and locks), so there is nothing left to protect. */
      if(hook('askingNow')){
        if(hook('phoneRound')) askPhones(currentPhonePrompt(), activeGame);
        else armBuzzers(currentPhonePrompt());
      }
      else if(buzzHost){ buzzWinner = null; buzzHost.disarm(); renderBuzzChip(); }
      return;
    }

    if(b && b.value != null && !judgeTypedBuzz(b)) return;
    buzzWinner = b;
    // the game reacts to who has the floor — the tile games select that team, and
    // Millionaire's `floor` role moves the question onto their ladder
    if(b) hook('onBuzzTaken', b);
    Sound.play('claim');
    renderBuzzChip('won');

    /* A typed word *is* the claim, in every game — the student produced the answer
       and the host judged it, so there is nothing left for the teacher to confirm.
       A plain buzz is the opposite case and stays a two-step: it says who wants the
       floor, the answer is spoken in the room, and the teacher marks it. That is the
       whole difference between the two modes at the scoring end.

       The game says what scoring means on its board and hands back what it paid;
       `null` means it did not score, so the floor stays where it is. */
    if(b && b.value != null && teams[b.team]){
      const paid = hook('onTypedWin', b);
      if(paid != null){
        /* The floor is given up as part of scoring: the question is over, so leaving
           a winner standing would keep the strip saying "got it" instead of what
           they got. `notePhoneScore` outlives the re-arm, which matters because
           several games deal the next question immediately. */
        buzzWinner = null;
        notePhoneScore(b.name, b.team, b.value, paid);
      }
    }
  }

  // one listener for every board, now and later — a new game gets re-fitted on
  // resize by declaring onResize, not by being added to a list here
  window.addEventListener('resize', ()=>{ hook('onResize'); });


  /* ================= TIMER (teacher-controlled) ================= */
  let tmrDuration=30, tmrLeft=30, tmrTick=null;
  const tmrDisplay = document.getElementById('tmr-display');
  const tmrToggle  = document.getElementById('tmr-toggle');

  function fmt(s){ const m=Math.floor(s/60), ss=s%60; return m+':'+String(ss).padStart(2,'0'); }
  function timerRender(){
    tmrDisplay.textContent = fmt(Math.max(0, tmrLeft));
    tmrDisplay.classList.toggle('urgent', tmrLeft<=10);
    tmrToggle.textContent = tmrTick ? '⏸' : '▶';
  }
  function timerStart(){
    if(tmrTick) return;
    if(tmrLeft<=0) tmrLeft=tmrDuration;
    tmrTick=setInterval(()=>{
      tmrLeft--;
      if(tmrLeft<=0){
        tmrLeft=0; clearInterval(tmrTick); tmrTick=null;
        // whichever game is up decides what running out of time means; only a
        // timed race round currently does anything with it
        hook('onTimerEnd');
      }
      timerRender();
    }, 1000);
    timerRender();
  }
  function timerStop(){ if(tmrTick){ clearInterval(tmrTick); tmrTick=null; } timerRender(); }
  function timerReset(){ timerStop(); tmrLeft=tmrDuration; timerRender(); }
  function timerSetDuration(s){ tmrDuration=s; tmrLeft=s; timerRender(); }
  function timerAdjust(delta){ if(tmrTick) return; tmrDuration=Math.min(300, Math.max(15, tmrDuration+delta)); tmrLeft=tmrDuration; timerRender(); }

  tmrToggle.addEventListener('click', ()=> tmrTick ? timerStop() : timerStart());
  document.getElementById('tmr-reset').addEventListener('click', timerReset);
  document.getElementById('tmr-minus').addEventListener('click', ()=> timerAdjust(-15));
  document.getElementById('tmr-plus').addEventListener('click', ()=> timerAdjust(+15));
  timerRender();

  /* ================= INIT ================= */
  document.querySelector('.eyebrow').textContent = 'Cambridge Empower C1 · Classroom games';
  document.getElementById('change-unit').style.display = (UNITS.length>1) ? 'inline-block' : 'none';
  /* **The board carries no settings UI of its own** — no gear, no clue-card Tune pill,
     no docked drawer. Every setting is edited from the room bench's one panel, which
     reaches this board's registry through the frame (`win.HubSettings`). The registry
     still lives here and every value still applies; only the on-board way to *open* it
     is gone, so there is one place to change anything and it cannot disagree with
     itself. `HubSettings` needs no init on the board — nothing here opens the panel;
     the room bench builds it on demand through the frame. */
  renderScorebar();   // team bar visible from the very first screen

  // settings that change what's already on screen take effect without a restart
  S.onChange((id)=>{
    /* The bed is the only sound that is *already playing* when the panel is open,
       so it is the only one that has to be re-decided on the spot. Re-running the
       game's tension hook does that: it is the single place that knows whether a
       question is live, and it starts or stops the bed accordingly. */
    if(id==='musicBed' || id==='sound' || id==='soundVolume') hook('tension');
    /* What a game does about its own settings changing mid-board is the game's —
       `onSetting` on the registry. This was five by-name branches (three
       Jeopardy, two Race) that a sixth game would have had to join by hand.
       `hook` fires only for the active game, which is what they all guarded. */
    hook('onSetting', id);
  });
  /* ---------- what the engine lends a game that lives in its own file ----------
     A game inside this closure reaches everything; one outside it reaches only
     what is published here, called from inside hooks (never at parse — game files
     load before this engine, so at their parse time none of this exists yet).
     **Grown only as an extracted game proves the need** — each member has a
     caller in `games/*.js`, which is what keeps this a contract rather than a
     mirror of the whole closure. Quickfire is the first caller. */
  function revealOpenRound(){
    if(roundState && !roundState.shown) roundDef().reveal(roundHost.mount(), roundState, roundCtx());
  }
  function roundDoneNow(){ return !!(roundState && roundState.done); }
  window.HubEnv = {
    // scoring and the receipt
    award, ledgerNote, markRun,
    payRuleLabel: g => (PAY_RULES[S.get('roundPay', g)] || PAY_RULES.winner).label,
    // the round adapter — a host names itself at roundOf, so no closure state moves
    roundCommit, roundEnd, roundOf, roundOpen, roundClockSecs,
    roundForPhones, roundLive, roundOnReplies,
    revealOpenRound, roundDone: roundDoneNow,
    renderRound, currentPhonePrompt,
    /* The live round's own object, for a host that reaches into it — Millionaire's
       50:50 hides two options and its steal clears the nomination. A getter, because
       `roundState` is replaced wholesale each question. */
    roundState: () => roundState,
    /* The item the shared round re-ask paths read `.text` from. A host that mounts a
       round on its own stage sets it as its clue opens (the card games set it in
       `openClueCard`). */
    setClueItem: it => { currentClueItem = it; },
    // surfaces and the room
    drawPrompt, askPhones, armBuzzers, resetBuzzers,
    showResult, hideResult, showStandings, standingsWanted,
    notePhoneScore, notePhoneMiss,
    /* The shared deal-in stagger (Jeopardy, Blockbusters and Race all fly their board
       in the same way) and the phone-mode query Race reads to decide whether a wrong
       touch re-arms the buzzers. */
    dealStagger, phoneRaces,
    /* Who holds the floor right now, or null — Race reads it to award a head-to-head
       touch to whoever buzzed in first. Distinct from clearFloor, which drops it. */
    floorWinner: () => buzzWinner,
    // content, roster, presentation
    groupCheckboxes, sectionHeading, contentRow, groupOf, inPlay, shuffle,
    /* The content-screen helpers a card game's own renderer reaches for: `catAllowed`
       filters a Jeopardy category by the round-type chips, `stripSection` trims a
       redundant "5A" off a row label. */
    catAllowed: c => catAllowed(c), stripSection,
    /* Whether the whole room answered this question (`write` mode), so a board that
       keeps control on a correct answer knows nobody earned the next pick. */
    everyoneAnswers,
    /* Nothing is open to the room right now — disarm the handsets and repaint, keeping
       the room and roster (Jeopardy's Daily Double belongs to one team alone). */
    standDownPhones,
    selectedContent: () => selectedContent,
    teams: () => teams, teamName, nextTurn, Roster,
    activeTeam: () => active,
    setActiveTeam: i => { if(teams[i]) active = i; },
    /* The live relay host, or null — a game holding per-player state deals and
       judges through it. The relay still never learns an answer. */
    room: () => buzzHost,
    syncBuzzRoom, reaskPhones,
    // nobody holds the floor any more, and the chip stops saying so
    clearFloor: () => { buzzWinner = null; renderBuzzChip(); },
    renderScorebar, themeOf, motionOK, Sound, stageTension, startGate,
    timerSetDuration, timerStart, timerStop, timerReset,
    asChoiceRound: q => mAsRound(q),
    /* **The shared clue card, lent to a card game in its own file.** The card is a hub
       surface a game borrows, not a thing it owns — Blockbusters opens it over a
       hexagon, says which game's clue is up (`modalMode`) and which tile it flipped
       from (`currentTile`), and closes it; the shared reveal/close handlers read that
       state, which is why both need a getter and a setter here. `clueClaim` is the one
       team chooser both card games share, exposed narrowly. */
    openClueCard, openRoundOnCard, closeModal, hideAllActionButtons, renderRoundButton, clueIsOpen,
    askClass, parkBuzzRoom,
    // the shared clue-card mount, so a card game's round host draws into the same box
    cardMount: CARD_MOUNT,
    modalMode: () => modalMode,
    setModalMode: m => { modalMode = m; },
    currentTile: () => currentTile,
    setCurrentTile: t => { currentTile = t; },
    /* **What the tile in play is worth.** Held in the engine because the standings
       report labels an entry with it (`standingsOpen`); written by the card game whose
       clue is up. A board with no dollar value (Blockbusters) simply leaves it 0. */
    clueValue: () => currentClueValue,
    setClueValue: v => { currentClueValue = v; },
    /* Is a grouping clue open (true until the card closes), distinct from `roundLive`
       (true only while it is still being played) — Jeopardy's steal and deduction ask
       the first, because they run after Reveal. */
    roundClue: () => roundClue(),
    clueItem: () => currentClueItem,
    clueClaimShow: (t, allow) => clueClaim.show(t, allow),
    clueClaimHide: () => clueClaim.hide(),
    flipHoldMs: () => flipMs(FLIP_HOLD_MS),
    activeGameId: () => activeGame
  };

  if(UNITS.length===1){
    loadUnit(UNITS[0]);
    showScreen('screen-game-select');
  } else {
    renderUnitSelect();
    showScreen('screen-unit-select');
  }
  /* Open the room now rather than when a board starts, so the code is on the wall
     while the class is still walking in. Nothing else about it changes: the room is
     the lesson's, it parks between games, and only switching phones off ends it. */
  syncBuzzRoom();

})();
