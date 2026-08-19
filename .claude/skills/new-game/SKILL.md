---
name: new-game
description: Build a new game for the Engishism Classroom Game Hub, or wire an existing one into the shared layer properly. Use this whenever the user wants to add a game, a board, or a new activity to the hub (Jeopardy/Blockbusters/Race/Millionaire/Bingo are the existing five), when they ask why a new game behaves differently from the others, or when a game is missing the join code, the settings rows, the phone dynamics or the layout guarantee. Also use it when reviewing a half-finished game before it ships.
covers:
  - "game-hub/games/*.js"
  - "game-hub/hub-games.js"
---

# Adding a game to the Game Hub

A game declares itself once and the engine drives it through two contracts. Get the
declaration right and the game inherits the chrome, the team bar, scoring, the timer,
the banner, every sound, every `Kit.*` service, the phone strip, the room, and the
layout guarantee — including features that do not exist yet.

**The failure mode here is never a crash.** Every hook has a safe default, so a
game with a missing hook runs and quietly does nothing in one specific respect. That
is why this is a checklist rather than advice: the compiler will not help you, and
neither will the tests unless you get to step 7.

## 0. Before anything: a new game is a **skin**, not a question machine

The direction of the project (`CLAUDE.md`, "Where this is going") is that a game show
provides context, geometry, scoring and turns around a **question slot**, and what
goes in the slot is a **round** — built on `playground/question-bench.html` and called
by name. A round brings its own card, its own phone dynamic and its own judging.

So before writing any question handling into a new game, ask: **is this a round?** If
your game needs the class to assemble, order, choose or type an answer, that behaviour
belongs in a round where every other game show can reuse it — not in your game where
it is the sixth private copy.

Write into the game only what is genuinely the *skin's*: the board, how a slot is
chosen, what winning a slot is worth, and whose turn it is.

The existing five predate this and each carries its own phone handling; that is the
state being moved away from, not a pattern to copy.

**Hosting rounds is a declaration, not an adapter.** Add an entry to `ROUND_HOSTS` in
`hub-engine.js` naming the four things only your board knows:

```js
myboard: {
  game:'myboard', modal:'myboard', stage:'play-myboard',
  turn: () => whoIsUp(),               // whose round it is when it is scoped to a team
  win:  team => claimIt(team) || 1     // what taking it is worth here; return what it paid
}
```

Then two calls where your clue opens: `roundOf(item, 'myboard')` **before**
`askPhones` (the host must be named before `setup` reads the ctx, or the round is set
up against the previous board), and `roundOpen(found)` if it found one. Carry the
round's fields across with `Kit.round.fields()` rather than naming them. Quickfire and
Millionaire mount the round on their **own board** this way.

**If your board opens the shared clue card instead** (declare `onCard:true` and
`mount:() => E().cardMount()`), do **not** hand-write that sequence — the whole
~dozen-step open (those two calls, the field-copy, drawing the prompt, standing the old
handsets down, the answer line and the button strip, all in one load-bearing order) is
`E().openRoundOnCard(o)`. Call it and keep only your board's own pre-work before it and
post-work off the round it returns. Jeopardy, Blockbusters and the Connections probe are
the three; copy the thinnest, Connections' `openConnectionsClue` (one call), and read
`openRoundOnCard`'s own header for what each field does. Hand-copying the sequence is the
exact drift that broke a card once.

`ROUND_HOSTS` lives above the settings block so the round settings' `games` list is
derived from it — do not type the game names out again anywhere.

**Your board's own way of awarding a question must stand down while a round is live.**
A round judges itself and pays through `win()`, so anything else that awards the same
slot is a second, conflicting route to it. Jeopardy hides Correct/Wrong until Reveal;
Blockbusters hides its team chooser. Whatever yours is, hide it and put it back on
Reveal — a class that never got there still needs awarding by hand.

## 1. Register it — its own file first, the cluster second

**The preferred home for a new game is its own file, `game-hub/games/<id>.js`** —
Quickfire lives this way and is the model to copy. The file registers into
`window.HubGames.register({...})`, declares its stage markup as `stageHTML` and
its ROUND_HOSTS entry as `roundHost` (the engine injects and merges both at
init), reaches engine machinery through `window.HubEnv` **inside hooks only**
(the engine loads after your file, so `HubEnv` does not exist at parse), wires
its DOM listeners on first `load()` (the stage does not exist at parse either),
and declares `order` (built-ins sit at 50) so it does not jump to the front of
the card row. Add its `<script>` tag to the four shells between
`game-hub/hub-games.js` and `hub-engine.js`. Loading before the engine is what
retires the register-before-init trap for you.

The in-engine alternative: `registerGame({...})` calls live together near the
top of `game-hub/hub-engine.js`, before `S.register(...)` and before init.
**There, the ordering is load-bearing and nothing enforces it.**

Two silent failures come from getting it wrong in-engine, and both have happened:

- **After `renderGameCards()` runs at init** → the game is in `HubGames.ids()`,
  passes `hasBank`, and simply has no card on the game screen.
- **After the settings block** → every shared setting registered `games:'*'` still
  finds it, but any setting written with a hard-coded list will not. Which leads to:

**Never write a list of game names.** `games:'*'` asks the registry when it matters.
A literal list is a photograph of the games that existed when the line was written,
and it is the single most repeated bug in this codebase — it has cost four debugging
rounds across the `.lit` stage list, the `play-fit` list, the settings `games`
arrays, and a test asserting "four games are registered". If a list genuinely must
name games (an anagram in Millionaire is given away by its own four options), leave a
comment saying why it is not `'*'`.

## 2. Declare the game

```js
registerGame({
  id:'bullseye', title:'Bullseye',
  card:  { icon:'<svg class="game-icon" …>', blurb:'…', badge:'Best for: …' },
  intro: { eyebrow:'…', title:'BULLSEYE', sub:'…', accent:'#39E27A' },
  hasBank: u => (u.bullseyeBank || []).length > 0,
  fitsScreen: true,          // false only if the board scales itself (Blockbusters)
  load(u){…}, renderContent(list, help){…}, startButton(btn){…},
  start(){…}, fit(){…}, deal(){…}, tension(){…}, onResize(){…},
  onTimerEnd(){…}, onWrong(teamIdx){…}
});
```

`stage` defaults to `play-<id>`, which must match a panel you add to `SKELETON` on
the play screen. Every hook is optional; a game grows by filling them in.

## 3. Declare the phone contract

All optional, all defaulting to a no-op. Declare them and the game inherits buzzing,
everyone-types, type-then-buzz, the class vote, the activity strip and automatic
scoring. Leave them out and its phones are idle — a correct, visible state rather than
a half-wired one.

**`hub-games.js` declares every default in one block and that block is the contract** —
the set grows, so do not trust a count, here or anywhere. Beside the ten below sit the
room's beats (`onRoomReady`, `onPlayers`, `onRoster`, `onRoomForgot`, `onPhoneReply`,
`asRound`) and the declarations that replaced `activeGame` branches (`bank`,
`teamDecor`, `solo`).

```js
expects()        // what a typed answer is judged against
phonePrompt()    // what the handset shows
askingNow()      // is a question open right now
buzzEntitled(b)  // false refuses this buzz — the engine re-arms (see below)
onBuzzTaken(b)   // somebody has the floor
onTypedWin(b)    // typed and correct: score it, return the points (null = it didn't)
wantsVote()      // does this game ever ask the room something
onVoteReply(all) // where the counts get painted
roomNote()       // what the chip says when the game wants a room without a mode
phoneRound()     // the game drives the phones itself; null = the default round
```

**Refusing a buzz is not ignoring one.** The relay locks the room on the *first*
buzz whoever sent it, so a phone that is not entitled would hold the lock and the
team that is could never get in. `buzzEntitled` returning false makes the engine
re-arm, which clears it.

**`onTypedWin` returns what it paid**, so the engine can name the student on the
strip without knowing what scoring means on your board — a tile, a hexagon, a word,
a bingo square.

**`phoneRound()` is for a game that *is* the phone dynamic** (Bingo's cards,
Jeopardy's grouping clue). If you return a round, the default round gets no say — otherwise
the mode and your dynamic arm the same handset and fight, which is invisible until a
reconnect re-asks and replaces one with the other.

**What you return past `{mode, prompt, options}` is carried to the relay, not read.**
`multi`, `multiByTeam`, `holds`, `rethink` and `team` all pass straight through, so a
game can use a round shape the engine has never heard of — the same way the relay
carries them without learning what they mean. It was a whitelist until the grouping
clue, which asked for a multi-pick and silently got a plain vote.

**And a refused buzz re-arms *your* round, not a buzzer.** `buzzEntitled` returning
false makes the engine put the room back the way it should be, which it works out by
asking `phoneRound()` again. If you are debugging a round that turns into a buzzer
after somebody taps a stale handset, that is the path.

## 4. Content: consume, don't author, if you can

Authoring is by far the most expensive part of a unit. Before designing a new bank
shape, check whether an existing one already carries what you need behind a
predicate. Bingo consumes `blockbustersBank` (single-word, unique answers with a clue
each) and **both units gained a fifth game with zero authoring**.

If you do need a bank, `hasBank(u)` decides whether the game is offered for a unit,
so a unit can adopt the game one at a time. Add the integrity rules to
`testContentIntegrity` — a duplicated prompt, an answer that breaks your board's
constraint, a rung with no question behind it.

## 5. Draw the question with the shared renderer

Use `drawPrompt(mount, {text, answer, type}, '<gameid>')` rather than
`textContent`. That is what makes gap fills, anagrams, odd-one-out and error
correction render properly — a game that writes its own prompt gets none of them,
and this was Race's original mistake.

## 6. Obey the layout contract

Three things every board owes the room: **nothing below the floor, nothing off the
right edge, no text cut off.**

- `Kit.floorTop()` is the one definition of the bottom edge. Ask for it; never
  restate it.
- `Kit.fitToScreen(el, {min, gap, floor})` does the measuring. `floor:true` hands
  the height back when the content genuinely cannot fit, rather than forcing one.
- **Measure layout, not paint.** `getBoundingClientRect()` includes ancestor
  transforms and animations; `offsetWidth`/`offsetHeight` do not. Measuring a rect
  mid-transition spaced Blockbusters' hexes for a 92px hex that rendered at 110.
- **Anything that can occupy vertical space above a board owes it a re-fit** — the
  room chip and the replies panel both learned this the hard way.

## 7. Verify — and prove the test can fail

The shared suites find your game through the registry, so `fit`, `phone`,
`gameshow`, `lab`, `registry` and `joinbar` cover it the day it registers. That is
most of the integration risk gone for free.

```bash
node tools/check-syntax.js                                   # seconds, catches silent CSS deletion
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=fit,phone,registry,lab,joinbar,gameshow
```

Then add a `--only=<gameid>` suite for the board's own logic. Two rules that have
each already paid for themselves:

- **Prove a new test fails on the bug it was written for**, by reverting the fix and
  re-running. Twice this project has shipped a test that passed on the broken build.
- **Screenshot it, don't only measure it.** Numbers said Millionaire's ladder cleared
  the options by 22px; the screenshot showed `100` stranded on a second row. Both
  facts were true — the assertion was answering a question nobody had asked.

Write assertions about **what must be true**, not about where something currently
is. "No student's phone is armed during a question" survives a redesign; "there is no
join code on screen" is a decision, and it will fail the next time that decision
changes.

## 8. Ship it

**`ship-it` owns this** — the cache-stamp command (and why the `20YYMMDD` shape is
load-bearing), pushing to `main`, and what goes in the commit body vs. `CLAUDE.md`. A new
game touches files under `game-hub/`, so the stamp bump is not optional. The one
game-specific line for `CLAUDE.md`: if the game changed a contract, added a shelf or
opened something unfinished, say so; if it merely exists, the registries already say it
and the file needs nothing.

## The five-minute review

If you are checking a game someone else wired up, these five catch nearly everything:

1. Its own file: is the `<script>` between `hub-games.js` and `hub-engine.js` in all
   four shells? In-engine: is `registerGame` in the cluster, above the settings block?
2. Does any line in the change name games in a literal list?
3. Does the game answer `expects`, `phonePrompt` and `askingNow` itself?
4. Does it use `drawPrompt` and `Kit.floorTop()` rather than its own versions?
5. Does the join code appear in it with the phone mode off?
