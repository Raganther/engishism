---
name: new-game
description: Build a new game for the Engishism Classroom Game Hub, or wire an existing one into the shared layer properly. Use this whenever the user wants to add a game, a board, or a new activity to the hub (Jeopardy/Blockbusters/Race/Millionaire/Bingo are the existing five), when they ask why a new game behaves differently from the others, or when a game is missing the join code, the settings rows, the phone dynamics or the layout guarantee. Also use it when reviewing a half-finished game before it ships.
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

## 1. Register it in the cluster, before the settings block

`registerGame({...})` calls live together near the top of `game-hub/hub-engine.js`,
before `S.register(...)` and before init. **This is load-bearing and nothing
enforces it.**

Two silent failures come from getting it wrong, and both have happened:

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

Ten hooks, all optional, all defaulting to a no-op. Declare them and the game
inherits buzzing, everyone-types, type-then-buzz, the class vote, the activity strip
and automatic scoring. Leave them out and its phones are idle — a correct, visible
state rather than a half-wired one.

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
phoneRound()     // the game drives the phones itself; null = phoneMode decides
```

**Refusing a buzz is not ignoring one.** The relay locks the room on the *first*
buzz whoever sent it, so a phone that is not entitled would hold the lock and the
team that is could never get in. `buzzEntitled` returning false makes the engine
re-arm, which clears it.

**`onTypedWin` returns what it paid**, so the engine can name the student on the
strip without knowing what scoring means on your board — a tile, a hexagon, a word,
a bingo square.

**`phoneRound()` is for a game that *is* the phone dynamic** (Bingo's cards). If you
return a round, `phoneMode` gets no say — otherwise the mode and your dynamic arm the
same handset and fight, which is invisible until a reconnect re-asks and replaces one
with the other.

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

```bash
sed -i 's/?v=[0-9a-z]*/?v=YYYYMMDDx/g' game-hub.html game-hub-unit4.html game-hub-unit5.html join.html
```

**Bump the stamp or the fix looks like it never shipped** — browsers keep serving
cached JS and CSS. The settings panel footer shows the build, so ⚙ tells you which
version is actually running. Push to `main`; Render and GitHub Pages follow in ~40s.

Then update the **Current status** section of `CLAUDE.md`. That file is the project's
memory and the workspace is rebuilt every session; anything not committed is lost.

## The five-minute review

If you are checking a game someone else wired up, these five catch nearly everything:

1. Is `registerGame` in the cluster, above the settings block?
2. Does any line in the change name games in a literal list?
3. Does the game answer `expects`, `phonePrompt` and `askingNow` itself?
4. Does it use `drawPrompt` and `Kit.floorTop()` rather than its own versions?
5. Does the join code appear in it with the phone mode off?
