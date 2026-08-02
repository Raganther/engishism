# Engishism — ESL Classroom Presentation App

Web-based games for ESL teachers to present English lessons on a classroom TV.
Pure HTML/CSS/vanilla JS, **no build step**, fully offline-capable, deployed to
GitHub Pages. Teacher-driven and class-facing — students don't touch the device.

- **Live:** https://raganther.github.io/engishism/
- **Repo:** public (GitHub Pages serves from `main`) — pushing to `main` deploys.

## How this file works (native, no harness)
This `CLAUDE.md` is loaded automatically at the start of every session, so it is
the project's memory. The repo is re-cloned fresh each session (the workspace is
ephemeral), so **anything worth keeping must be committed and pushed.** Continuity
= this file (kept current) + `git log` (what changed) + `docs/` (specs). At the
end of a work session, update the **Current status** / **Next** sections below and
commit. No hooks, no roadmap file, no domain-file discipline required.

## Run
```bash
git add -A && git commit -m "..."   # save
git push                            # deploy to GitHub Pages
```

**Bump the cache stamp whenever you change a file under `game-hub/`.** Every asset is
linked as `…?v=YYYYMMDDx` in the three page shells; without a bump, Chrome keeps serving
the cached JS/CSS and a fix looks like it never shipped (this has already cost one
debugging round). Change it in all three shells together:
```bash
sed -i '' 's/?v=[0-9a-z]*/?v=20260729k/g' game-hub.html game-hub-unit4.html game-hub-unit5.html join.html   # macOS
```
The engine reads its own `?v=` and exposes it as `window.HUB_BUILD`; the settings panel
footer shows it, so **"Build …" in ⚙ tells you which version is actually running.**

**The stamp busts the assets and nothing busts the shell — know this before debugging
a "it didn't deploy" report.** `game-hub.html` carries no stamp of its own, so a browser
holding the old shell asks for the *old* `?v=`, gets its own cached assets, and shows the
previous build with no error anywhere. It cost a round in July 2026: a phone showed the
pre-fix Millionaire 50 seconds after Pages finished building, and the deploy was fine.
Two tells that you are looking at a stale shell rather than a broken fix: raw `___` in a
prompt (means `Kit.prompt` isn't running at all) and ⚙ reporting the old build number.
The fix from the user's side is a query string on the page URL —
`game-hub.html?fresh=1` — which forces a fresh shell; in-app browsers (Facebook,
Instagram) hold it hardest and often ignore pull-to-refresh. **Not yet fixed properly:**
the shell should send `Cache-Control` of its own so a stale one cannot strand anybody
on old assets.

## Architecture — three generations coexist
1. **Classroom Game Hub (current focus).** The MVP demo. One consolidated app;
   flow is **choose unit → choose game → choose sections → play**.
   - `game-hub.html` — the app: loads every unit content file + the engine
     (linked from index.html). Units register into `window.UNITS`.
   - `game-hub-unit4.html`, `game-hub-unit5.html` — per-unit deep-links (load one
     unit; the engine auto-skips the unit-select step).
   - `game-hub/hub-engine.js` — all game logic + injected UI skeleton; renders the
     unit/game/section/play screens, the persistent team bar, and the timer.
   - `game-hub/hub-kit.js` — **shared kit: solve once, use anywhere.** Stateless
     services every game can call — `fitToScreen`, the `anim` variant registry, the
     `claimTeam` chooser, `passTurn`. Nothing here touches engine state; it all takes
     parameters, so a new game gets these for free.
   - `game-hub/hub-settings.js` — settings registry + panel (⚙ in the header).
     **Both must load before hub-engine.js** (the engine throws without either).
   - `game-hub/hub-buzzer.js` — phone-buzzer client, shared by the hub (host) and
     `join.html` (players). Optional; absent relay = absent feature, nothing breaks.
   - `tools/buzzer-relay.js` — zero-dependency Node relay **and** static server for
     buzzer lessons. `join.html` is the students' page. See `docs/buzzers.md`.
   - `game-hub/hub.css` — shared styling (DCU theme); the one place to restyle.
   - `game-hub/content/unit-4.js`, `unit-5.js` — data-only content banks; each does
     `window.UNITS.push({ id, label, card, jeopardy…, blockbusters… })`.
   - Games: **Jeopardy**, **Blockbusters**, **Race to the Board** and **Millionaire**.
     Per-game content
     model (content lives in data, separate from the engine). **Adding a unit = one
     content file + a `<script>` line in game-hub.html.** A unit only shows the games
     it has a bank for (`gamesFor()`), so units can adopt a new game one at a time.

2. **Unit-first whiteboard app (earlier rebuild, paused).**
   - `index.html` (landing) → `app.html` → `engine/unit-app.js`; 1 unit, 2 games
     (Picture Choice, Sentence Builder), shared `engine/interactions/tile-tray.js`.

3. **Legacy topic-first engine.**
   - `classic.html` → `engine/engine.js`; 18 activity types, topics, lessons, plus
     4 standalone team-building games (`bunker`, `desert-island`, `it-helpdesk`,
     `scam-or-legit`). Reachable via the landing page's "Classic games" link.

`index.html` links all three (Choose a unit / Game Hub / Classic games).

## Three layers, and where a change belongs
Everything below fits one of three layers plus two things that cut across all of them.
Knowing which you are touching tells you the blast radius before you start.

| Layer | What it is | Changing it costs |
|---|---|---|
| **1 · Template** | What every game gets by existing: the skin (chrome *and* setup screens), team bar, scoring, timer, clue card + flip variants, `showResult()`, all `Sound.*`, all `Kit.*`, the content gate | Highest engineering risk, touches everything — this is what the smoke suite is for |
| **2 · Game** | Board logic, stage CSS, its `tension()` source. Free-form within the registry contract | Low risk, isolated to one game |
| **3 · Content** | The banks — shaped per game (§3.2), organised per unit | Near-zero engineering risk, **highest cost in your hours** — 589 items across two units |

**Layer 1 is really two things pointing opposite ways**, and the distinction matters
when adding a feature:
- **Services the game calls** — `Kit.fitToScreen`, `Sound.applause`, `showResult`.
  Write once, every game inherits, including games that don't exist yet. A richer
  clock is this kind of change.
- **Hooks the engine calls** — `start()`, `fit()`, `tension()`, `onResize()`. Adding a
  new beat to the round (`onTeamChange()`, say) means every game *may* respond.

**Two axes cut across all three layers:**
- **Variants + per-game settings.** `cardFlip` is layer 1, `bbWinRoute` is layer 2,
  `theme` is layer 1 applied per game — same mechanism, any of them overridable from
  that game's settings tab. Shared by default, divergent by declaration.
- **Units.** Content is a **matrix of games × units** with `hasBank()` at each
  intersection, so Unit 4 offering only Jeopardy and Blockbusters is a supported
  state, not a gap.

**Where the layering leaks — worth knowing before trusting it:** `hub-engine.js` holds
layer 1 *and* all four layer-2 games in one closure, so the boundary is conceptual, not
physical. And parts of layer 1 were generalised *from* specific games and still show it
— `showResult()`'s `tone` is gold/silver, `Kit.claimTeam`'s `allow` exists for
Blockbusters' two-team geometry, and the clue card is only used by Jeopardy and
Blockbusters. Read layer 1 as "what happens to be shared so far", not "what is
inherently shared".

## Adding a game — the registry
A game declares itself once and the engine drives it through that contract. There
used to be **nine** `if (activeGame === 'jeopardy')` branch points — build, fit,
curtain-up, resize, timer-expiry, content screen, start button — and a new game had
to be threaded into every one by hand, with nothing complaining if you missed one.

```js
registerGame({
  id:'bullseye', title:'Bullseye',
  card:  { icon:'<svg…>', blurb:'…', badge:'Best for: …' },
  intro: { eyebrow:'…', title:'BULLSEYE', sub:'…', accent:'#39E27A' },
  hasBank: u => (u.bullseyeBank||[]).length > 0,
  load(u){…}, renderContent(list, help){…}, startButton(btn){…},
  start(){…}, fit(){…}, deal(){…}, tension(){…}, onResize(){…}, onTimerEnd(){…}
});
```

**Every hook is optional and defaults to a no-op**, so a game runs the moment it is
registered and grows by filling hooks in — the checklist can't be half-finished.
Hooks only fire while their game is active, so none of them checks `activeGame`.

| Free, no code | One declaration | Genuinely per-game |
|---|---|---|
| skin (chrome + setup screens), team bar, scoring, timer, clue card + flip variants, `showResult()` banner, every `Sound.*`, every `Kit.*`, content-integrity gate, the phone strip, the layout contract | `card` (icon/blurb/badge), `intro` ident, `hasBank`, `fitsScreen`, the settings `games` arrays via `gameIds()`, **the phone contract's six hooks** | board logic, stage CSS, `tension()` source, content bank shape |

**Register before init, or the game is invisible.** `renderGameCards()` runs during
init, so a `registerGame` call placed after it leaves a game that is in
`HubGames.ids()`, passes `hasBank`, and has no card on the game screen. Nothing
errors. Keep registrations in the cluster at the top of `hub-engine.js`.

### The phone contract — what a game owes the room
Phones reach a board through six hooks, not through the engine knowing the game's
name. Declare them and the game inherits buzzing, everyone-types, type-then-buzz,
the class vote and the activity strip; leave them out and its phones are idle,
which is a correct state rather than a broken one.

```js
expects()        // what a typed answer is judged against
phonePrompt()    // what the handset shows
askingNow()      // is a question open right now
buzzEntitled(b)  // false refuses this buzz — the engine re-arms, see below
onBuzzTaken(b)   // somebody has the floor
onTypedWin(b)    // typed and correct: score it, return the points (null = it didn't)
wantsVote()      // does this game ever ask the room something
onVoteReply(all) // where the counts get painted
```

**Refusing a buzz is not ignoring one.** The relay locks the room on the *first*
buzz whoever sent it, so a phone that isn't entitled would hold the lock and the
team that is could never get in — `buzzEntitled` returning false makes the engine
re-arm, which clears it. Race's steal rule and Millionaire's `speaker` role are both
this, and were both written out by name in `onBuzz` until the fifth game proved the
point. **What it re-arms is `phoneRound()`'s answer, not a buzzer** — hard-coding
`armBuzzers` there meant the recovery from a stray buzz would replace a game's own
round with the thing it had just refused, which killed a grouping clue outright.

`window.HubGames.register(...)` is exposed so a game can eventually live in its own
file the way units do via `window.UNITS`; the four built-ins still declare themselves
inside `hub-engine.js` because their logic shares that closure. Moving them out is
mechanical and hasn't been done.

**A shared feature reaches every game, including future ones, by living in the
shared layer** — the header timer is one widget, so a richer clock is one change.
Where games should *diverge*, use a `variant` setting (`cardFlip`, `bbWinRoute`,
`theme` all do): register the implementations, list them as variants, and the panel
builds the per-game override rows itself. Shared by default, divergent by declaration.

## Solve once, use anywhere
Anything more than one game needs lives in `hub-kit.js`, not in a game:

| Service | Replaces | Used by |
|---|---|---|
| `Kit.fitToScreen(el, {min,gap,floor})` | three separate header/team-bar measurements | Jeopardy, Race, Millionaire |
| `Kit.anim.register/get(feature,name)` | hard-coded animation keyframes | the clue card, and whatever comes next |
| `Kit.claimTeam({mount,onPick})` | Blockbusters' two buttons + Race's own bar | Blockbusters (`allow:[0,1]`), Race |
| `Kit.shapeOf(origin,target)` | animations assuming everything is a rectangle | the `morph` card animation |
| `Kit.passTurn(count,current)` | four ad hoc rotations | all four games |
| `Kit.prompt.register/render/reveal` | a question's *form* being a convention in how the prompt was worded | all four games |
| `Kit.answer.judge(typed, expected)` | `===` deciding whether a student produced the word | the typing race; any game that ever accepts typed input |
| `Kit.vote.open({options,team})` | Millionaire's Ask the class being the only way to ask the room to choose | Ask the class; Blockbusters' hexagon vote |

**Deliberately *not* on the shelf: the grouping round.** Its union-of-a-team's-picks
and its settle-with-a-memory are the same two ideas `BenchKit` holds one tier down,
so the pull to extract them is real — and it is one caller, which is a guess rather
than an API. It lives in `hub-engine.js` with Jeopardy's other clue mechanics until a
second board wants it; **rewiring the first caller is what proves an extraction**, and
there is nothing to rewire yet. Written so the move is mechanical when that happens.

### Question forms are a registry too
A question's *form* — gap fill, anagram, odd one out — used to exist only in how the
prompt happened to be worded; every game pushed the string through `textContent`, and
the one exception proved it (Race hand-rolled a `.gap` span in its own renderer).
`Kit.prompt` makes the form something any game can draw:

```js
Kit.prompt.register('anagram', {
  games:['jeopardy','blockbusters','race'],    // omit for "suits all"
  render(mount, item){…}, reveal(mount, item){…}
});
```

**Five forms are in the kit.** `gap` is inferred from `___`; the rest need an explicit
`type:` on the item, because inferring them would silently re-type the items authored
before they existed. Each parses what it needs out of the prompt, exactly as `gap`
reads `___`, so **the item shape stays `{text, answer, type}` and adding a form touches
no game and no content field** — only the authoring convention for its own prompts:

| Form | Author it like this | Suits | Reveal |
|---|---|---|---|
| `gap` | `"held in ___"` | all four | the answer drops into the blank |
| `anagram` | `"Unscramble: the decision a jury delivers."` + `answer:"Verdict"` | jeopardy, blockbusters | the letters re-sort into the answer |
| `scramble` | `"Word order:"` + a whole-sentence `answer` | jeopardy | the words re-sort into the sentence |
| `oddoneout` | `"Which does NOT belong: verdict / jury / sabbatical"` | jeopardy, blockbusters | the odd chip lights, the rest stand down |
| `errorfix` | `"You *must to* wear a helmet."` + `answer:"must"` | jeopardy, millionaire, race | the struck words swap for the answer |

Two more are **experimental**, in `playground/lab-forms.js` — `bridge`
(`"FIRE -> ___ -> SHOP"` + `answer:"work"`) and `realfake` (admit or reject a
spelling). They are not in the kit, so no game can draw them yet.

The separators are load-bearing: **`/` between odd-one-out candidates** (with an optional
lead-in before a `:`), **`*asterisks*` around the words to correct**, and **`->` between
bridge links, exactly one of them `___`**. Get them wrong and the form declines to plain
text rather than rendering nonsense — which is the intended failure, but it looks like
"the type did nothing", and `render()` still hands back the type because the form *ran*.
The tell is that a declining form leaves **no element children** — bare text — which is
how the prompt lab tells the two apart.

**`bridge` would be the first form to suit every board** if graduated, and the reason is
worth keeping: its answer is one ordinary word, so a hexagon can key it by its initial
and a Race tile can hold it, while Millionaire's four options are candidate links you
still have to test against *both* neighbours rather than a give-away. The reveal names
the compounds (`firework · workshop`) because the answer alone doesn't explain itself.

**Millionaire never gets an anagram** — its four options hand you the letters. Race never
gets an odd-one-out — the board gives it away. That is what `games:[…]` is for, and the
smoke test asserts both directions.

**Density is the open problem, not the mechanism.** 24 typed items against 589 is
**4.1%**, so a Blockbusters board of 18 hexes expects ~1.6 of them and a Millionaire rung
(filtered by section *and* level) may go a whole game without one. Playing a real round
found the odd-one-out and never reached the anagram. If these forms are worth keeping,
the next step is more items, not more code — Millionaire needs the most because its
per-rung filtering makes three items nearly invisible.

Three properties that make it adoptable rather than a migration:
- **Untyped items still render.** A prompt containing `___` is recognised as a gap
  fill without being labelled one, so **336 of the 565 authored items gained a real
  blank with no content edits at all.** Anything else falls back to plain text.
- **A type names the games it suits.** Not every form survives every board — an
  anagram in Millionaire is given away by its own four options, odd-one-out in Race
  is given away by the board. Declare it rather than discover it.
- **`reveal()` returns how long it runs, or 0 if it declined.** An answer only belongs
  in a blank if it is the word the sentence is missing, so the gap type declines three
  kinds: over 26 characters, alternatives (`forbidden / not permitted`), and ones
  carrying a teacher's note (`he was made REDUNDANT (adjective)`). Those print on the
  answer line, which is what that line is for; when the blank *did* fill, the answer
  line stands down rather than showing the same word twice.
- **The blank's `?` is real text, not a CSS `::after`.** Race's original renderer put
  it in the DOM and that was right — a placeholder that only exists in CSS can't be
  read by anything inspecting the sentence, which broke a test the moment it moved.

Items arrive normalised as `{text, answer, type?}`, so the kit never learns that
Jeopardy calls it `q` and Blockbusters calls it `clue`.

**Interchangeable implementations.** A feature can ship several versions and let the
teacher choose. Register each, list them as `variants`, and the setting's value is the
name to look up:

```js
Kit.anim.register('cardFlip', 'rise', { open(card, origin, ms, h){…}, close(…){…} });
S.register({ id:'cardFlip', type:'variant', default:'grow-turn',
             variants:[{value:'rise', label:'Rise up — no 3D'}, …] });
```
A variant may name the games it suits (`{value:'x', games:['blockbusters']}`) and the
panel filters each tab accordingly; `currentFlip()` falls back to `grow-turn` rather
than silently doing nothing if a game is set to one it isn't offered.

Adding another is those two lines — no branching in game code, no panel edit. `h.at(deg)`
gives the transform landing the card on its origin; the helpers are **snapshotted before
the card's transform is touched**, because measuring after forces a reflow that delays
the start by about a frame.

`allow` on `claimTeam` exists because some boards are structurally two-team —
Blockbusters' yellow-across / blue-down geometry gives a third team nowhere to play — so
it is restricted there rather than generalised.

### Asking the room to choose
`Kit.vote` is the counting half of a vote — options, a live count against each, a
leader, and **who is entitled**. The transport is not in it (that is the engine's
room), so it takes replies as a parameter and hands back numbers. Two games use it
for opposite questions: Millionaire asks the whole class *what the answer is*,
Blockbusters asks **one team** *which hexagon to attack*.

`team` is why it is a service rather than four lines copied twice. A round can
belong to one side of the room, and that has to be true in three places at once —
the relay stores it, the phones that are not entitled show the question with no
controls (`turnTeam`, deliberately not `team`: the join payload already uses that
name for the player's own team, and the handset runs both through one handler), and
the count drops anything that arrives anyway. The third is not paranoia: a phone
that joined mid-vote, or one still holding the previous question, has been told
nothing.

**Where the numbers go is a content question, not a styling one.** Millionaire draws
its counts on the four options, which is exactly right there. Blockbusters cannot:
two hexagons routinely carry the same letter — a board of eighteen from a vocabulary
bank clusters on common initials — so one vote for `R` painted "1" on three
hexagons, which any room reads as three votes. The vote is for a *letter*, so the
letters are counted once in a strip beside the legend, and the board's job is to
show where that lands: every hexagon carrying the leading letter lights up. That is
also the honest picture — the team said R, there are three, the teacher picks which.

**The hexagon's `clip-path` crops an outline and a box-shadow away entirely**, so the
leading hex is marked with a `drop-shadow` filter and a fill change, the same reason
the winning route uses one. And in the game show skin the fill has to change: the
skin already glows violet, so a slightly bigger violet glow marks nothing.

## Screens: one layout contract, asked of whatever is registered
Every game owes the room the same three things, whatever its board is made of:
**nothing below the floor, nothing off the right edge, no text cut off.** The floor is
`Kit.floorTop()` — it was the top of the team bar until the bar moved into the header,
and the tests ask for it rather than restating it. That is
checked by the `fit` (computer) and `phone` (handset) suites, and neither carries a list
of games — both ask the engine:

```js
window.HubGames.ids().map(id => ({ id, title, stage: window.HubGames.get(id).stage }))
```

Assertions run against the **stage the registry names**, so there is no per-game selector
to drift and **a fifth game is covered the day it calls `registerGame`**. This is the
same move as `hasBank()` and the content gate: the check finds the game rather than
waiting to be told. CSS inheritance gives a new game the chrome; only this gives it the
guarantee — which is the difference worth understanding before adding a game.

**It earned itself immediately.** The hard-coded list it replaced had been passing for
months while Jeopardy's category headings were **cut off mid-word on the desktop** — 12
of them at 1280×720. The type was sized `1.05vw`, i.e. from the *viewport*, so it stayed
at 13.4px however narrow the column got, and a 16-category board gives each heading 51px.
`fitCategoryHeadings()` now measures the column actually rendered, on a canvas so it
costs no reflow, with the **longest word** as the constraint (spaces wrap, words cannot).
Two traps in that measurement:
- **Letter-spacing is em-based and canvas does not apply it.** The game show skin triples
  it to `0.09em`; across a ten-letter word that is 0.9em, a fifth of the column — the
  difference between fitting and clipping, not a rounding detail. Add it back per
  character.
- **The floor is a legibility floor, not a fitting one.** Sizing purely to fit reached
  8px: not clipped, not readable from the back of a room, and it *passed the assertion*.
  It is 10.5px now, with long words breaking instead. **16 categories at 1280px is still
  only 10.5px — the answer is picking fewer sections, not more CSS.**

### Handsets — a preview device, not the projected board
The app is for a classroom TV and that is not changing, but a teacher checks a lesson on
their phone. Two rules invert there, deliberately:
- **The board may scroll.** "Never scroll" exists because nobody can scroll a projected
  image mid-game. A phone in the hand is not that, and forcing the fit is what broke
  Millionaire.
- **Nothing is hidden, only compacted.** The timer and the scores are what a teacher
  reaches for. Chrome went 323px → 198px on a 390×844 screen (`@media` tiers at 760px
  and 480px), against a hard cap of 200 in the `phone` suite. **The cap is two pixels
  away, and the thing that eats it is another header button**: the Lab button cost 31px
  the day it was added, because `.header-right` wrapped onto a third row rather than
  overflowing. Measure the group, not the button — at 360px it has 332px to fill and the
  four controls came to 353. The timer gave up the difference; it is the biggest item
  there.

Three fixes worth not re-deriving:
- **`Kit.fitToScreen(el, {floor:true})`** hands the height back when the content genuinely
  cannot fit, rather than forcing one. Millionaire asks for it; Jeopardy and Race do not,
  because they *can* always be made to fit (one scales its type, the other re-scatters).
  Forcing a height collapsed the option grid's rows under their own content and the
  ladder painted straight through answers B, C and D.
- **`grid-auto-rows: minmax(min-content, 1fr)`** on `#m-options` is the structural
  guarantee a row can never shrink under its content. Without it the fix is only "there
  happens to be enough room now".
- **`--jcols` instead of an inline `repeat(n, 1fr)`.** The column count lives in a custom
  property so the stylesheet owns the track size; an inline style cannot be overridden by
  a media query. That is what lets a handset give Jeopardy fixed-width columns and scroll
  the board sideways — 16 categories across 390px is 22px a column, which fits by every
  measurement and is readable by none.

**Measure the elements, never their container.** The first version of the phone test
compared the ladder against `#m-options`, whose box had collapsed to 50px while its
options overflowed 259px past it — so it saw no collision and called an unreadable game
fine. It passed on the broken build. A layout assertion that has never failed on the bug
it was written for is not yet a test.

## Authoring content (keep the question forms mixed)
An audit of Unit 5 found **71% of all items were gap fills**, which the four different
boards had been disguising. Extra items were added rather than rewriting any, bringing
it to **55%**. When authoring, reach for these before another gap fill:

| Form | Example | Fits |
|---|---|---|
| Word transformation | "Change 'convict' into the noun for the court's decision." | all four |
| Error correction | "Correct it: 'You must to wear a helmet.'" | Jeopardy, Millionaire, Race |
| Odd one out | "Which does NOT belong: verdict / jury / sabbatical?" | Jeopardy, Millionaire |
| Register / formality | "Which is the formal version?" | Millionaire |
| Collocation | "Which verb goes with 'a sentence'?" | Millionaire |
| Opposite / definition | "The opposite of a guilty verdict." | Blockbusters, Race |

Extra items need **no engine change** — every game filters its bank by section and
shuffles, so more items simply means more variety per play. Three constraints:
**Blockbusters** answers are one word and `letter` must be its initial; **Race**
answers become board tiles, so they must be single words and never duplicate another
answer in that bank; **Jeopardy** categories must stay grouped by section in array
order or the content screen prints a section heading twice.

**Grammar Focus pages are content too, and they were nearly missed.** An audit found
5A relative clauses (p146) had **three** items that genuinely tested a relative
pronoun, all in one Jeopardy category — so playing any other game gave zero practice
on the unit's own grammar. 5B obligation (p147) fared better at 27. Both are now
covered across Jeopardy, Race and Millionaire. Two lessons worth keeping:
- **Jeopardy's named categories gave grammar a slot; the other three banks are flat
  lists, so authoring drifted to vocabulary.** When adding a unit, check the Grammar
  Focus pages explicitly — the format will not remind you.
- **Match the point to the format.** Relative pronouns are ideal Race tiles (one word
  each, none repeating, so all nine sit on the board and picking the right one is a
  real discrimination). Millionaire suits them because p146 exercise b is *already*
  written as a four-way choice, so the book's own distractors transfer. Blockbusters
  is the wrong home — single-word answers keyed by an initial make **W** ambiguous
  across who/whom/whose/where/when/why.

**No prompt may appear in two banks.** An audit found 21 prompts copy-pasted across
2–4 banks, nearly all word transformations added during the vary-the-forms pass —
the letter of that request, but it broke §3.2. Same *answer* in several games is the
design working (spaced retrieval from different angles); same *prompt* is the thing
per-game authoring exists to avoid. Each game now keeps the shape it suits —
transformations in Jeopardy's "Change the Word", definitions in Blockbusters, gapped
sentences in Race, four-option discriminations in Millionaire. This is now
**enforced**, not a convention:
```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=content
```
`testContentIntegrity` runs over every unit in `window.UNITS`, so a new unit is
checked for free. It catches the things no engine test can: a duplicated prompt, a
Blockbusters answer whose initial doesn't match its hexagon, two Race items competing
for one tile, a Millionaire rung with no question behind it, and section labels whose
counts have drifted from the bank. **It found eight real defects in Unit 4 the day it
was written** — including a hexagon showing `U` whose answer was *Irresistible*.

**Both units now carry all four games across all four sections.** Unit 5 is 319 items,
Unit 4 is 246 — **565 in total**. Two things learned filling the gaps:
- **The writing lesson was as gameable as any other section**, once you stop treating
  it as "an essay". The linkers are vocabulary (and make excellent Race tiles, like
  the relative pronouns), and the paragraph functions are a fixed, testable structure.
  5D was skipped for months on the assumption it wouldn't fit; that was wrong.
- **A ladder needs two questions per rung, not one.** Millionaire's ladder is *per
  team*, so with one question per rung both teams meet the identical question on the
  way up. Every section now carries at least two at every rung.

Still missing: Unit 5's pronunciation beyond one item, the p66 crime idioms, and
anything from the reading texts; Unit 4's p54 review page.

## Adding a feature (settings-first)
Every new feature gets a switch. Register it at the top of `hub-engine.js` and the
panel builds its own row — **there is no panel markup to edit**:

```js
S.register({ id:'myThing', group:'Race to the Board', type:'toggle', default:true,
             games:['race'],                       // which games it applies to
             label:'Human-readable name', help:'One line on what it does.' });
// then, wherever it matters — always pass the game:
if(S.get('myThing', activeGame)) { … }
```
**Naming `games` makes it per-game overridable.** The panel grows an *All games* tab
holding the master value plus one tab per game; a game follows the master until
explicitly overridden, and each row says which it is doing. ⚙ opens on the tab for
whatever is being played (`S.setContext`). Omit `games` for infrastructure that isn't
per-game — the buzzer relay address, for instance.

Storage: `id` is the master, `id@game` is an override. Settings written before scoping
existed are master values under the same keys, so nothing needed migrating — there is a
smoke test pinning that.

`type:'select'` takes `options:[{value,label}]`; `type:'range'` takes
`{min,max,step,unit}` and is what makes a **weight** tunable from the interface rather
than from the source — cooldowns, point values, round lengths. It stores a number, not
a string (a `step` with a decimal point parses as a float), because a weight arriving as
`"4"` compares and concatenates wrongly everywhere it is used. `S.onChange(fn)` is for
settings that should change what's already on screen without restarting the game. Values
persist in `localStorage` per device; a browser that blocks storage on `file://` silently
falls back to memory for the session (the panel says so).

**Every control carries `data-setting="id"`.** The panel doesn't need it — it holds the
definition in a closure — but anything looking *at* the panel does, and without it the
only handle on a control is its label, which is prose.

### One gear, two forms: the panel and the drawer
There is **one settings entrance** — ⚙ — and its form suits the moment: outside a
game it opens the full panel (tabs: All games + one per game); **during play it
opens the docked drawer** for the game being played (`L` also toggles it), whose
"All games" button hands over to the full panel for the rare cross-game edit. The
drawer is `S.renderFor(mount, game)` — the same `buildRow` the panel uses, filtered
to one game — so a new setting appears in both by being registered, and a change
made in the drawer is **an override for that game**, never the master, which is
what makes trying an idea mid-round safe. There is no separate Lab button any more.

**How a game's settings view is organised** (panel game tab and drawer alike):
the **Ruleset** section leads (any picker registered with `presets`, or handed them
via `S.describePresets(id, bundles)`), then the game's own groups, then the shared
ones in a fixed order (Competition, Questions, Phones, Clue card, Presentation,
Sound); on All games the shared groups lead instead. "Own" is derived — a group is
a game's own when everything in it names exactly one game — so a sixth game's group
sorts itself without being listed anywhere. Group headers fold (per session, not
persisted). **Every row a ruleset bundle touches carries a note** — "Classic sets
this to 10s" — advisory beside the control, which stays the truth; the mode writes
switches, it never holds them.

Three things it has to do, each of which was a bug first:
- **Stop short of the header.** It holds every control a teacher reaches for *while* the
  drawer is open — New game, the timer, ⚙, and now the ± score buttons too — and a
  full-height panel swallowed the lot. `fitLab()` measures both edges rather than
  assuming either; it already asked whether the team bar was `fixed` before subtracting
  it, which is why it needed no change when the bar moved.
- **Make the board give up the width rather than covering it.** `body.lab-open` insets
  the screen and `hook('onResize')` re-fits; without it the drawer hid two of
  Millionaire's four options, which defeats the point of changing a rule and watching the
  next question play under it. Dropped on handsets, where there is no width to give.
- **Stack its rows.** At 420px a variant's option text is a sentence, so label-beside-
  control squeezed the label to one word per line and still overflowed.

### Replacing a setting
`S.raw(key)` and `S.drop(keys)` exist for one job: a setting that gets replaced leaves
values behind under keys nothing reads any more, and **a per-game override is exactly
what a teacher set deliberately**, so it must be translated rather than silently ignored.
`migratePhoneModes` in `hub-engine.js` is the worked example — three booleans became one
`phoneMode` variant. Two traps it paid for:
- **The old key still being present *is* the signal that nothing has chosen yet.** Asking
  whether the new id is unset never fires on the master value, because `register()` seeds
  every master with its default.
- **`drop()` is what makes it run once**, and it runs before anyone can have picked a new
  value, so a later choice can't be overwritten.

## Skills — the procedures, separated from the history
`.claude/skills/` holds four invocable checklists. This file is the project's
*memory*; those are its *procedures*, pulled up at the moment they are needed rather
than remembered from 1,400 lines.
- **`new-game`** — the two contracts, registration order, the layout rules, which
  suites cover a game for free, and the five-minute review for a game someone else
  wired up.
- **`new-mode`** — a mode is a named bundle of settings, never a second code path.
  The preset pattern, and why a preset writes the switches rather than shadowing.
- **`new-question-form`** — the two stages (lab-only vs in the kit) and why the
  isolation is structural, the render/reveal contract, declining rather than
  rendering nonsense, and the step that decides whether a form exists at all:
  authoring items for it.
- **`new-round`** — the tier above a form: a question the room *plays*. The
  form-or-round test, what a round must never contain, why the card's palette is
  fallbacks rather than declarations, and the two traps the grouping round paid for
  (the normalisation whitelist, and "is a round clue" vs "is the round still live").
- **`phone-debug`** — the five shapes every phone bug so far has taken, and the one
  question that separates them ("does the phone still show its room number?").

**The new-game review found a real defect the day it was written**: Bingo was
silently excluded from `type` mode because that variant's `games` list predated it,
while the Millionaire exclusion beside it had a stated reason. That is the argument
for the checklist in one line — the rule was already written down here, and was
still missed.

## The playground — prototypes with phones, outside the hub
`playground/` is the lane between the Learning-games repo's prototypes
(github.com/Raganther/Learning-games- — 16 solo word-game prototypes plus the
research catalog in `research/game-dynamics.md`) and the hub. A playground page is
a **standalone self-contained HTML file**: no `registerGame`, no hub engine, no hub
skin, zero risk to the teaching tool — but it borrows the **phone room** (`hub-buzzer.js`
+ the relay + `join.html`), which is game-agnostic and needs no phone-side changes
for vote/write/buzz/card dynamics. The deliberate rules:
- **Develop the game out fully here first**; port sub-dynamics into the hub loop
  only after a real classroom run. Three possible fates per game, decided later:
  stay a standalone class game, graduate whole via `registerGame`, or distil just
  its question dynamic into a `Kit.prompt` form.
- **Content lives in a marked block at the top of the file** (the prototypes'
  convention — teachers can edit it).
- **Degradation is non-negotiable**: no relay must leave the page fully playable
  teacher-only. The `playground` smoke suite asserts it.
- **Votes are advisory** (students never touch the device): they land on the board
  as counts, the teacher clicks.

**`bench-kit.js` — the middle tier, and the rule that governs it.** `hub-kit.js`
is what the *games* share; this is what the **question bench** shares. It exists
because the same code was written twice in two days: `openRoom` was nearly
byte-for-byte identical in `connections.html` and `prompt-lab.html`, and a third
question game would have made it three. It holds `BenchKit.room({mount, board,
on})` — the code, the chip, the join panel, the QR, the bench link, and
`window.HubHost` — and `BenchKit.settings(mount, defs, onChange)`, a toolbar that
builds itself from declarations, the same idea as `HubSettings` one tier down.

**The rule is: extract what is already duplicated, not what might be.** A
playground's value is that pages are allowed to be weird, and abstracting a
sandbox too early kills the thing it is for. **The second game is what moves
something onto the shelf, and Word Thermometer has now done exactly that**: it
needed teams, the clock, the mistake budget and the vote-leader, so all four moved
and Connections was rewired onto them in the same change. Rewiring the first game
is not optional — without it the "shelf" is a second copy under a new name, and
the 52 unchanged Connections checks are what prove it was behaviour-neutral.

| On the shelf | What it does |
|---|---|
| `BenchKit.room` | code, chip, join panel, QR, bench link, `window.HubHost` |
| `BenchKit.settings` | a toolbar that builds itself from declarations |
| `BenchKit.teams` | chips, add/rename, turn, scores, colours, `sizes(host)`, relay name push |
| `BenchKit.clock` | the board's countdown; `onEnd` so each game decides what expiry *means* |
| `BenchKit.mistakes` | the dots budget |
| `BenchKit.leading` | top-n options by vote — Connections wants 4, the thermometer wants 1 |
| `BenchKit.settle` | debounce + "already judged" memory, for a race with no teacher click |
| `BenchKit.modeSetting` / `racing` | the turns-vs-race declaration all three games share |
| `BenchKit.judge` | typed answers, through `HubKit.answer.judge` — right / close / wrong |
| `BenchKit.teamColour` | delegates to `hub-buzzer.js`, so the palette has one home |

**Still deliberately in Connections:** the per-team pick share (`shareFor`,
`shares`, `pushShares`, `teamPicks`) and race mode. The thermometer votes one word
per slot, so multi-pick still has one caller — it moves when a third game wants a
team to assemble a multi-part answer.

**Two things the second game taught immediately.** A shared component must not have
to know about one game's modes — `renderTeams` used to read `racing()` directly, so
the bar now takes `showTurn(false)` and a race says so rather than the bar guessing.
And **shadowing bites at the extraction seam**: `applyMode` had a local
`const clock = settings.el('vote-secs')`, which silently became a call on a
`<select>` the moment the shared countdown took that name.

Four tiers now, and knowing which one a thing belongs to is the whole discipline:
**the page** (Connections' 16-word board, the lab's form menu) · **the bench**
(`bench-kit.js` — room, settings, teams, clock) · **the round** (`Kit.round` +
`game-hub/rounds/*.js` — a question that is *played*, shared by the question bench
and every game show) · **the hub** (`Kit.prompt` forms, `registerGame`). Graduating
upward is the same two-stage isolation the question forms have.

**The round tier is the one a teacher's ideas travel on.** A question type is
authored and iterated on `question-bench.html` — card and phones side by side — and
a game show then calls it by name. That is why nothing in a round may know about
scoring, turns or tiles: those are the host's, and a round holding one could never
be plugged into a second game.

**`phone-bench.html` — the whole room on one screen.** The projected board on the
left, a rack of simulated handsets on the right; both are the **real pages in
iframes on the real relay** (phones self-join via `?auto=1&name=&team=`), so a tap
on a phone lands on the board exactly as it would in class. It exists because
**a phone dynamic cannot be judged from the phone** — what it produces lands on the
board, and testing across two tabs means never seeing cause and effect at once.
Works against any board, hub or playground, because it asks one question of
whatever it loaded: **`window.HubHost` — what room are you running?** That is now a
stated convention (the hub sets it beside `buzzHost`, the playground pages already
did), so the code is picked up automatically and never copied by hand, and the
bench needs to know nothing about which game is being played. `?board=…` opens one
straight away. Four rules paid for in advance:
- **A simulated phone never touches the seat** (`SIMULATED` guards `rememberSeat`
  and `resume` in join.html) — every iframe shares the page's localStorage, and the
  one seat key belongs to the real phone.
- **Phones are appended once and never re-parented** — moving an iframe reloads
  it, which drops its stream; only the column headers repaint on the team poll.
- **The board renders at a projector's logical width (1280) and is scaled to fit**,
  never past 1:1 — a board re-fitting itself to a 500px pane is not the board under
  test, and an upscaled one shows a size no room renders at.
- **And so does every racked phone — 390×844, scaled to the column.** The same rule,
  and it was missed on the phones for months: they were laid out at the rack
  column's 264px directly, which left `join.html` 220px for its options, under the
  288px two columns need. So a sixteen-word vote appeared on the bench as one long
  scrolling list with ten words below the fold, while every real handset showed two
  columns — **the bench misreporting the one thing it exists to show**, and reported
  as "can we stop having to scroll". A scaled element still occupies its full layout
  size, so the iframe needs a clip box with an explicit height or the card is 844px
  tall around 571px of picture. Asserted on the frame's *inner* width, not the card.
- **The phones follow the board's room.** A playground board mints a fresh code
  every time it loads, so re-opening the board left every racked phone in a room
  nobody was hosting — connected, showing a room number, and deaf to the board
  beside it. Reported as "Connections no longer interacts with the phones", and
  the tell was the phone's room number differing from the board's, exactly as
  `phone-debug` says. Re-pointing an iframe is a *deliberate* rejoin, which is a
  different thing from the incidental reload that re-parenting causes.
- **The stage re-fits on a `ResizeObserver`, not on window resize.** The pane
  narrows when a phone is added, which is not a window resize — without it the board
  kept the scale it opened with and was **clipped 115px off its right edge** the
  moment a phone appeared. The screenshot found that; the assertions had not,
  because they asked what the scale was and never whether the board still fitted.
  Same lesson as the hub's buzzer chip: *anything that changes size around a board
  owes it a re-fit.*
The `bench` suite drives all of it, including the hub as a board (start Jeopardy
inside the frame, buzz from a bench phone, assert it reaches `#phone-bar`).

**`prompt-lab.html` — the question forms, on their own, with a room.** A form could
only ever be met by finding a bank item that happened to carry its type, which is
why three of them sat at 4% of the content and a round could pass without meeting
one. The lab **lists whatever `Kit.prompt` holds** (`types()` + the new `info(type)`,
never a list kept in step by hand, so a form registered later appears for free),
draws it at board size against the hub's own stylesheet, reveals it, and reports
which of the three outcomes happened — drawn, *declined to plain text*, or no form
at all. **Ask the room** puts the same question on the handsets as an everyone-types
round and judges the replies with `Kit.answer.judge`, exactly as a game would. So a
form can be tried before a single bank item is authored for it. `promptlab` suite.

**A form has two stages, and the isolation is structural, not a convention.**
Experimental forms live in **`playground/lab-forms.js`**, which the lab loads and
**no game ever does** — a game loads `hub-kit.js` and nothing else. Registered in
`hub-kit.js` a form is live in every game the moment a bank item carries its type.
**Graduating is moving the block between the two files; the code does not change**,
because what is written in the lab file is already the shared contract. The lab's
menu groups the forms by stage (`In the kit` / `Lab only`), reading the set of kit
forms captured between the two `<script>` tags — the one moment the two are
distinguishable. This matters because *the playground page being separate does not
make the form separate*: `bridge` was written straight into the kit and was
therefore shipped, invisible only because no content used it. It lives in the lab
file now.

**Portability is checked, not intended.** The `promptlab` suite drops
`lab-forms.js` into a real hub page, starts Jeopardy, and asserts every form it
registers draws *and* reveals on a live clue card. It iterates whatever the file
registers, so a form added next month is covered without the check being edited,
and one that quietly depends on something only the lab has fails the day it is
written rather than at graduation. The procedure is
`.claude/skills/new-question-form`.

Current pages: **`connections.html`** — ESL Connections (find four groups of four;
groups encode collocations/phrasal verbs/spelling/register; solving a group unlocks
its mini-lesson). `?p=N` pins a puzzle (tests use `?p=1`). **Two ways to play the
same board**, picked from the toolbar — the first dynamic here to prove the
playground's point, that one board can host several:
- **Turns** — the team on turn votes one word each from their phones (team-scoped,
  counts badge the tiles, top four glow), the teacher locks in four tiles and
  submits; a wrong guess passes the turn and the vote moves with it; shared pool of
  four mistakes.
- **Race** — no turn: every team plays at once, and **a team's own four picks are
  its guess**, so the teacher never re-enters them. Each phone holds up to four
  words (`multi` on the arm) because a team of two could never assemble a group at
  one vote each; a team's selection is the **union** of its players' picks, which
  is what forces them to agree — six words up means dropping two. Both teams' picks
  sit on the board at once in team colours, with a live `n/4` per team. A set of
  exactly four is judged as soon as it settles (debounced, and remembered so a
  wrong four is not re-judged until it changes); a wrong four costs nothing but the
  time, because the race itself is the pressure. First team to a real group takes
  it, scores it, and the words leave the board for everybody.

## Source material & specs
- `material/empower-c1-unit-4/`, `material/empower-c1-unit-5/` — Cambridge Empower
  C1 workbook page scans (indexed by page/section) the game content is authored from.
- `docs/game-hub-requirements.md` — the MVP spec (per-game content model, game tier
  analysis, success criteria). The key open metric: realistic authoring time per unit.
- `docs/design-reference.md` — DCU International Academy brand (navy/sky-blue/yellow/cream).
- `.claude/*.md` — older experimental domain notes (product vision, lesson pipeline,
  activity schemas). Reference only; not required reading.

## Current status
- **The bench authors content now, not just question types.** It held one throwaway
  sample and forgot it on reload, so it could be used to iterate a *type* and never
  to write questions — which is the job the moment a type is finished. It now keeps
  a **set**: prev/next/add/duplicate/delete, persisted in `localStorage`, loadable
  from any category that already exists, and exportable as a Jeopardy category that
  pastes straight into a unit file.
  - **A round says why an item is wrong, not just that it is.** `check(item)` joins
    the round contract and returns sentences an author can read; `setup()` returning
    null already said *that* something was wrong. It went on the shelf rather than
    into the bench because the rules were about to exist twice — **the content gate
    had its own per-round block**, which is knowledge the round already has. The
    gate now asks the registry, so a round written next month is audited the day it
    ships with `smoke-test.js` untouched.
  - **The split: the round owns what makes the *question* invalid, the host owns
    what makes its own *bank* untidy.** "Needs at least two options" is the round's.
    "Also carries an `a` field" stays in the gate, because `a` is Jeopardy's word for
    an answer and no round should ever learn it. For the same reason the gate
    normalises `q`→`text` before checking, exactly as `jShowClue` does.
  - **There is no save button.** Every keystroke lands in the bank, because an editor
    with a live preview *and* a save button is one where the two disagree — and what
    you would lose is the question you were in the middle of. The card still redraws
    on Ask or on moving between questions: rebuilding it on each character would
    throw away a round the room was part-way through answering.
  - **A round trip must not lose what the editor has no field for.** The editor has
    three inputs and an ordering item has four things in it — the glosses have no
    input at all, so `build(text, a, b, prev)` carries them forward. Loading a
    category and exporting it back used to strip the teaching off every step,
    silently. Asserted.
  - **The export knows Jeopardy's shape, and that is allowed.** The bench is a
    *tool*, not a runtime module, so its output format costs the layering nothing —
    and a Jeopardy category is the only thing that can consume these today. When a
    neutral question pool exists this becomes the second exporter rather than a
    rewrite. Values are 100–500 by position, which is why five is the number the
    bench nudges you towards.
  - **Still missing for the stated goal**: nothing consumes a *pool*; content is
    still four hand-authored banks per unit. See the composability item under Next —
    that is the migration, and it is a project rather than a refactor.
- **Plain multiple choice is the third round, and it cost a `<script>` line.**
  `game-hub/rounds/choice.js` — a question and four answers, `choice:{options,
  answer}`. Eleventh category on the Lab board (`L6 · Multiple Choice`).
  **The engine gained nothing to host it**: the clue normaliser asks
  `Kit.round.fields()`, the tile asks `Kit.round.of()`, and ⚙ builds its mode row
  from `modes`. That is the whole return on the round registry, stated as a
  measurement rather than a claim.
  - **It is the control case, and that is why it is on the Lab board.** It is the
    dullest question type there on purpose: if a form does not beat four options on
    a clue drawn from the same vocabulary, it is not earning the code it costs.
  - **The two rounds before it *shaped* the contract, so of course they fitted.**
    This one was written against it unchanged, which is a different and better
    piece of evidence. The only thing it needed was already there.
  - **Two modes.** `first` — the first team with the right answer takes it, the
    standard quiz beat. `agree` — a team's answer only counts once every player on
    that team has picked the same option, exactly as the thermometer plays, and for
    the same reason: on a four-phone team a race is won by the fastest thumb and the
    other three never commit to anything.
  - **The answer is authored as the option itself, never a letter or an index.** The
    options are shuffled per clue — authors put the answer first and a class works
    that out in about two questions — so a letter could not survive, and an index is
    off by one forever the first time somebody writes 1 meaning the first. A typo
    then matches nothing and `setup` returns null, so the card says the question is
    incomplete rather than marking the wrong answer right. **This is the one defect a
    reader cannot catch** — a clue with a mistyped answer looks completely normal and
    is simply impossible to get right — so the content gate checks it by name.
  - **The letters are a card-side affordance only.** A/B/C/D is what lets a teacher
    say "who went for B?" out loud; the phones get the words, where a letter would
    be noise on a screen that is nothing but options. Card and handset carry the
    same four in the same order, asserted.
  - **`Kit.round.poll` and `Kit.round.agreement` came off the back of it**, because
    the tally-leading-unanimity trio was written twice in a day. The rule held:
    ordering was rewired onto them in the same change and its checks passed
    unchanged, which is what makes it a shelf rather than a second copy under a new
    name. What stays in each round is `valid(word, team)` — which words are legal
    differs completely (ordering rejects a word already on that team's ladder, a
    choice rejects anything that is not one of its four).
  - **The bench editor is a table now, not a chain of `if (type === …)`.** Two shapes
    were two branches and that was fine; the third is what turns it into a list kept
    in step with the registry by hand, which is the shape this project keeps paying
    for.
- **A question is a thing you can pick up and plug in now — `Kit.round`.** The
  grouping round used to be ~300 lines inside `hub-engine.js`; it is one file,
  `game-hub/rounds/grouping.js`, holding all four things a question type is: **the
  card the projector draws, what the handsets are put into, how several students'
  taps become one team answer, and whether that answer is right**. A game show calls
  it by name and gets all four.
  - **This is the tier above `Kit.prompt`, not a replacement for it.** `Kit.prompt`
    is a *rendering* contract — render and reveal, no time, no turns, no phones —
    and six question forms live there quite happily. A round is a question that is
    *played*. Every hook past `setup` and `render` is optional, so a simple type is
    two functions and Connections uses everything; that is the same "declare what
    you need" shape the game registry uses.
  - **What a round never contains: scoring, turns, timers, the board.** Jeopardy
    pays a tile and passes a turn when the round says a team has it; the bench pays
    nothing. A round that knew about points could only ever live in one game — and
    when something you want to tune is missing from the bench, that is the boundary
    telling you it belongs to the host.
  - **`playground/question-bench.html` is the second caller, and that is the point.**
    A shelf with one caller is a guess. The bench draws the card *through the
    registry* — the same code a Jeopardy tile runs — with a rack of real handsets
    beside it, so a question is authored and iterated where you can see the card and
    the phones react together. All 56 grouping checks passed unchanged across the
    extraction, which is what makes it a refactor rather than a rewrite.
  - **The card's styling had to leave `hub.css`.** A playground page cannot load that
    file to get the card — it carries the whole hub theme — so the card's innards are
    `game-hub/hub-rounds.css`, loaded by both. The game-show overrides ride along in
    it, scoped to `body.theme-gameshow`, which never matches on a bench page.
  - **A shared card cannot assume its host's background**, and only a second host
    proved it: the palette was the hub's light theme hard-coded, so on the dark bench
    the words rendered as white blocks — the round looking wrong in the one place it
    exists to be tuned. It reads six custom properties now, and **the defaults are
    fallbacks inside each `var()`, never a declaration block**: a declaration on the
    round's own element out-specifies anything the host sets on an ancestor, which is
    exactly how the first attempt failed and looked like the host being ignored.
  - **In a race the card keeps every word.** Each team has placed different ones, so
    removing a word because *some* team used it makes the card lie to the other
    three — and filtering by the teacher's own lane made the shared list shrink as
    Team 1 climbed, which reads as words vanishing for no reason anybody else can
    see. The card is the reference list of what is in play; each team's own remaining
    set is on their handsets. Only the teacher's own lane dims what it has used.
  - **The bench makes teams, and racks its phones a row per team.** A round can give
    each team its own board, so two was not enough to try one — and the rack now
    reads the way the room does: a labelled row per team, phones filling the teams
    evenly, so which handsets belong together is visible at a glance. Rows are added
    and never re-parented, because moving an iframe reloads it and drops its stream.
    Four teams is the cap, which is where a clue card stops being readable.
  - **Four to a row, and it is a divisor rather than a maximum.** Every row is sized
    as if it held four, so a team of two draws the same size as a team of four and
    simply leaves the space — sizing by whatever the busiest row happened to hold
    made handsets change size as teams filled up, which is exactly the instability
    the card is protected from and the rack should be too. Capped at 0.62: a phone
    drawn much bigger stops being something you glance at beside the card and starts
    competing with it. **Width divides, height scrolls** — constraining by height as
    well shrank every handset to the floor while a third of the pane sat empty, and a
    phone too small to read is a phone you cannot judge a dynamic from.
  - **The bench racks twenty phones, and the ceiling is the transport's — which is
    not the same everywhere.** Every live page holds one event stream open forever:
    the board's, plus one per racked handset. Over **HTTP/1.1** a browser allows six
    connections per origin, so at five phones that is six and the request carrying a
    tap has nothing left to travel on — **the phone marks the word, the board never
    hears it, and the round looks broken while both ends are behaving perfectly.**
    That is the local relay, and it was measured. Over **HTTP/2**, which the deployed
    site speaks, streams share one connection and none of it applies. The cap is
    twenty and the bench **says which situation you are in** rather than pretending
    one number is true everywhere. A class never meets any of it: thirty handsets are
    thirty separate browsers. *(This corrects an earlier note here that gave four as
    the ceiling — that was the local measurement generalised too far.)*
  - **The card never gives up width; the phones do.** Adding a handset used to
    squeeze the card, which defeats the whole page: a card that changes size when you
    rack a phone is not the card a class meets. The card is drawn at a projector's
    720px and *scaled* — the room bench's rule applied to a card rather than a board,
    because re-laying it out narrower reflows the words into a layout no projector
    renders. The editor sits under it at the same width rather than spanning the
    page, which was pushing the rack over.
  - **Still deliberately separate: `playground/connections.html`.** The full 16-word,
    four-group game is not a question card — it is a whole game that happens to share
    a mechanic, and forcing it through the round contract would change a working page
    to prove a point the bench already proves. The shared pieces it could adopt
    (`Kit.round.shares`, `Kit.round.settle`) duplicate `BenchKit`'s by four lines; that
    is a smaller problem than a refactor nobody asked for.
- **Ordering is the second round, and the contract held.** `game-hub/rounds/
  ordering.js` — Word Thermometer as a clue: five words on a scale, a ladder on the
  card, and the room puts them in order. One file, **no engine change to host it**,
  which is the whole return on the extraction. Ninth… tenth category on the Lab
  board (`L5 · Word Thermometer`), and it plays on the bench and in Jeopardy from
  the same code.
  - **Two ways to play it, both real lessons.** `climb` fills one shared ladder a
    rung at a time from the cold end — everyone votes on what comes next, it locks,
    its gloss prints as it lands, so a five-word scale is five teachable moments.
    `race` gives **every team its own ladder, side by side**, and the first team to
    finish theirs takes the question. The picker is built from what the round
    *declares* (`modes`), so neither the bench nor the hub learns what a mode means;
    the hub turns it into a ⚙ row automatically.
  - **The race needed the last unused thing on the relay.** Each team has placed
    different words, so each has a different set left — which means **each team must
    be asked a different question**. That is `optionsByTeam`, built for the
    thermometer's bench game and used by nothing until now. A team not named falls
    through to the room-wide list, so nothing else in the app is affected.
  - **The ladder is the picture, which is the whole reason for a lane each.** You can
    see who is two rungs up without reading a scoreboard, and a team's next answer
    appears in the rung it is aimed at — so the room watches it land or shake rather
    than reading a verdict afterwards. Fits a projector at two, three and four teams
    (152px a lane at four), asserted at each.
  - **The game-show skin now sets the card's *palette* rather than one round's word
    tiles.** It restyled `.gword` directly, so the second round inherited nothing and
    the ordering ladder's empty rungs kept the light theme's border on a dark card —
    invisible. Any round drawn in that card is now correct by construction, including
    ones not written yet. **A theme that names one round's classes is a bug waiting
    for the next round**, the same shape as every other list that named what it
    should have asked.
  - **A sequence is not a set, and that is what the second round was for.** Grouping
    merges a team's phones with a union — four words from four handsets are one
    answer. An order cannot be merged: two students tapping different words do not
    combine into a third. That is what killed the first "everyone submits a whole
    order" mode and replaced it with a lane each: a race asks one rung at a time, so
    nothing has to be merged and every team argues out loud instead.
  - **The whole team, or nobody — a rung waits for unanimity.** It used to land on
    whatever *most* of a team had said, so three students could carry a fourth who
    was never asked to commit, and on a two-phone team it meant one playing and one
    watching. Every player on the team now has to pick the same word. Both modes,
    because the reason is the same in each.
    - **Being split is not being wrong**, so it draws no verdict at all — no shake,
      no "not that one". A team that disagrees has done the interesting part; telling
      them off for it is the opposite of the lesson.
    - **What the card shows instead is the count**, and it goes on the *team's label*
      — the lane header in a race, a tally chip on a shared ladder. Never on a rung:
      a count inside the `next` rung makes that one rung two lines tall, the lanes
      stop lining up, and the ladder lurches again. Same bug, one grid over.
    - **The leading word still shows while they argue.** `picks` is the team's agreed
      answer and is the only thing judged; `leading` is what most of them are saying
      and is what the card draws. Collapsing them back into one field is exactly how
      a majority would quietly start winning rungs again.
    - **The card says where they disagree, not just that they do.** Every word a team
      has a vote on carries that team's dot; the one they lead with is filled. A
      tally reading `1/2` with nothing showing what the other student wants tells the
      room it is stuck without telling it what to argue about.
    - **Three ways it must never lock up**, all checked. With no count to be
      unanimous against (`sizes[t]` is 0 — no relay, or nobody counted yet) the
      leading vote lands exactly as before, so a missing number can never freeze a
      round. The teacher's own Check never goes through `read()`, so one phone in a
      drawer does not make a clue unfinishable. And **a phone that drops out shrinks
      its team rather than freezing it** — see below.
    - **A leaver who never voted was the one case nothing recomputed.** The gate is
      against the roster, so a team of three sitting at 2 is unanimous the moment the
      third handset drops off. The relay already had half of this: a *held* reply
      leaves with the phone holding it, so a leaver who had voted triggers a
      `response` and the round re-judges. A leaver who never voted sends nothing, and
      both hosts only ever re-read the room when a reply arrives — so the roster
      shrank and the team stayed stuck, with only the teacher's Check to get out of
      it. Both hosts now re-read the replies they already hold when the roster
      changes: **nothing new has arrived, what changed is the room they are being
      read against.** Proved by reverting — the tally sits at `1/2` after the handset
      is gone.
    - **Rejoining needed no work at all**, which is worth knowing before anybody
      builds it twice. The phone stores its seat (code, name, team *and player id*)
      in `localStorage`, so a reload or a dropped connection comes back to the same
      room, the same team and the same identity — which is why a bingo card survives
      one. A QR for a different room outranks the seat, and "Not you?" forgets it;
      both are deliberate.
    - **`read`, `judge` and `accept` take `ctx` now**, like every other hook already
      did. They were the odd ones out and it showed the moment a round needed to know
      how many students are on a team. Stashing the size in the round's own state
      from `arm()` would have worked and would have been a lie — the size is the
      host's live fact, not something the round was told once.
  - **A right answer is not always an ending, and defaulting that wrongly is silent.**
    A grouping card is over the moment a team has the set; an ordering climb has four
    more rungs. `judge` returns `done`, and the host treats **`done !== false`** as
    the end — a round that has never had to think about progress says nothing, and
    saying nothing must mean the ordinary case. Defaulting the other way made a
    correct grouping card report *"yes, keep going"* and never pay out.
  - **The normalisation whitelist bit again, exactly as written down.** `order` was
    not in it, so the clue drew as plain text with nothing anywhere saying why —
    the same failure `reveal` had when Story Reveal shipped. It is not a whitelist
    now: each round declares the item field it owns and `Kit.round.fields()` is
    asked, so **a round added later is carried through without anybody remembering.**
  - **Nothing new was needed from the phones.** A handset already sends its taps in
    the order they were made, so a sequence is expressible with no drag-and-drop and
    no `join.html` change at all.
  - **Empty rungs cost 44px each to say nothing** and pushed a five-step ladder past
    both edges of a 1280x720 clue card. Making them a thin line bought the height
    back and cost the thing the ladder is *for*: as each word landed the rungs above
    resized, so the column shifted and progress read as the ladder lurching rather
    than filling — and with a lane each, no two teams' rungs lined up with one
    another. **A ladder whose rungs move is not a ladder.** Every rung is the same
    box now, filled or not, differing only in opacity; the height comes back from
    making *every* rung shorter, which costs type size and nothing structural. The
    card is asserted on screen at 1280x720 and 390x844, which neither `fit` nor
    `phone` would have caught because neither opens a clue card.
  - **A wrong check now releases the teacher's words.** Leaving them selected meant
    the next click deselected instead of choosing, so a second attempt silently did
    nothing — worst on a climb, where one word is the whole answer and the button
    just sat there disabled.
- **A grouping clue: Connections inside a Jeopardy tile, and the first bench dynamic
  that needed real engine work.** Eight words on the clue card, four that belong
  together; every phone in the room is armed with a multi-pick selection, a team's
  answer is the **union of its players' picks**, and a set of four is judged the
  moment it settles. First team to a real group takes the tile and it scores
  normally. Ninth category on the Lab board (`L4 · Find the Four`).
  - **Story Reveal ported cheaply and this did not, and the difference is the whole
    lesson.** Reveal landed on `jHints`/`jHintCost`, which was already the same
    mechanic. Grouping had nothing to land on: it is ~330 lines in `hub-engine.js`
    with its own state, arming, settle and judge, where Reveal was a field name in a
    whitelist. `Kit.prompt` could never have held it — that is `render`/`reveal`, no
    time, no turns, no phones. **Budget the next dynamic against this one, not
    against Reveal.**
  - **Nothing on the phone side had to be built.** `multiByTeam` and multi-pick were
    grown for Connections' race and used by nothing in the hub; the share
    (`ceil(4/size)`, so two phones hold two words each) is the mechanic rather than
    a detail, and being over your share is a state, not an error. This is the first
    thing to prove that the relay work generalised.
  - **`phoneRound()` now carries what it returns instead of interpreting it.** It
    was `{mode, prompt, options, keepSpent}` — a whitelist that silently dropped
    `multi`, `multiByTeam`, `holds`, `rethink` and `team`, so a game could ask for a
    round the relay already supported and get a plain vote. Carried through
    verbatim now, exactly as the relay carries them without reading them.
    `undefined` drops out of the JSON, so Bingo's arm is unchanged on the wire.
  - **Refusing a buzz re-armed a *buzzer*, which is the bug this shape keeps
    producing.** The recovery path in `onBuzz` hard-coded `armBuzzers` — written
    when the only dynamics were the phone modes — so a stray buzz during a grouping
    round would have been "recovered" by replacing the round with the very thing the
    game had said it did not want, leaving the class unable to finish the clue at
    all. It asks `phoneRound()` now. **Anything that names the shared dynamic is a
    bug waiting for the next game**, same as `gameIds()` and the `.lit` stage list.
  - **`jGroupWho` is the switch, and it is the only one worth having.** Whether the
    whole class races for the tile or it belongs to the team on turn is a *teaching*
    decision — a choice between iterations, which is what a variant is for — where
    the settle delay and the eight-words-four-to-find are guessed numbers that want
    a classroom run, not a slider. Scoping costs one line because `team` on the arm
    already reaches all three places it has to: the relay stores it, an unentitled
    phone shows the question with no controls, and a reply that arrives anyway is
    dropped.
  - **A wrong four costs nothing but the time**, as in Connections' race: the other
    team is the pressure, and a class charged for a guess stops guessing. The right
    answer is resolved before any wrong one, because two teams can settle in the
    same tick and arrival order put *"not a group"* on screen after the tile had
    already gone.
  - **`jGroupClue()` and `jGroupLive()` are different questions, and mixing them is a
    live trap.** The first is "this clue is a grouping clue", true until the card
    closes; the second is "the round is still being played", which stops the moment
    it is taken or revealed. Correct and Wrong only exist *after* Reveal, so the two
    guards below asked the first — written against the second they would have looked
    right, passed a casual read, and silently let both rules back in.
  - **Nobody held the floor, and two of Jeopardy's rules assume somebody did.** The
    steal exists so a team shut out of a question gets it when the team holding it
    misses; `jDeduct` charges the team that missed. On a clue every team was
    assembling at once there is nobody to exclude and nobody to charge — `missed`
    is only "whoever happened to be on turn", and on a Classic board that team was
    docked **$200 for a clue the whole room was playing**. Both stand down now, from
    the one fact rather than two special cases.
  - **The teacher can play it with no relay at all** — click four words on the card
    and Check. Not a fallback; degradation is the rule, and this is the first hub
    clue that would have broken it. It then did a second job for free: **a Daily
    Double on a grouping tile** looked like two contradictory dynamics, but what a
    Daily Double excludes is the *phones*, not the words — the finding team names
    their four aloud and the teacher clicks them, and `jCorrect` was already routing
    a Daily Double's payout to whoever found it. Without the round the tile opened
    on an instruction with nothing to pick from and the wager was unanswerable.
  - **Two CSS rules that had never applied, both found by looking rather than
    measuring.** (1) The game-show styling was hung off `#play-jeopardy.lit`, but the
    clue card sits *outside* the stage — which is exactly why `openClueCard` has to
    set `--tension` on it by hand — so it reached nothing; `.clue-hint` had the same
    dead selector and had never applied since hints shipped. Both are scoped to
    `#clue-card` now. (2) `#clue-actions button` sets `border:none` and
    out-specifies a bare `#hint-btn` or `#group-btn` (1,0,1 against 1,0,0), so the
    outline those two secondary buttons are meant to have was never drawn; the
    parent id is in the selector to win that. **CSS has no way to say a rule lost**,
    so both of these looked merely plain rather than broken, and no assertion would
    ever have caught either.
  - **The Lab board had no test coverage at all** until this — the Reveal categories
    shipped untested last session. `grouping` suite (56 checks) drives the round,
    the no-phones path, both settings of `jGroupWho`, the Daily Double, a miss under
    Classic's rules, an ordinary
    clue on the same card, and the card's own fit at 1280x720 and 390x844 — neither
    `fit` nor `phone` opens a clue card, so a set of words overflowing it would have
    passed both. The content gate now opens the Lab shell too, so those nine
    categories are finally audited. **Five of the fixes above were proved by
    reverting them and watching the right check go red**, which is how the `-200/0`
    was found rather than reasoned about.
- **The Lab board is a mixing desk: one question type per category.** A category is
  Jeopardy's unit of choice, so making each one a single form turns the section
  screen into a way of comparing them — pick three forms, play a board, and judge
  each against the others in the same round. **Eleven categories over six sections**:
  six forms (gap, anagram, odd one out, error fix, word order, **word bridge**),
  two Reveal, and three rounds — **grouping**, **ordering** and **multiple choice**.
  Every clue is drawn from the same small vocabulary field on purpose, so the only
  thing that varies is *how it was asked*. **Multiple choice is the control**: a form
  that cannot beat four options on the same vocabulary is not earning its code.
  - **`bridge` graduated the day a bank actually used it**, which is what it had
    been waiting for since it was written — a form with no content is a form the
    class never meets. The move was the documented one: the block out of
    `playground/lab-forms.js` and into `hub-kit.js`, no rewrite, and `hub.css`
    already carried its styling.
  - **Every category needs all five values.** Jeopardy indexes tiles by row, so a
    category short of one is not a narrower column — it is
    `Cannot read properties of undefined`. Four-clue reveal categories crashed the
    board build.
  - **A $100 tile affords exactly one reveal layer**, so author one at $100 and two
    from $200 up. Eight categories × 5 fits 1280×720 exactly.
  - **The `promptlab` suite named `bridge` as the experimental form**, so graduating
    it failed the check for the right reason with the wrong message. It derives the
    two sets now — whatever the lab file registers beyond what the kit holds is
    experimental *by definition*. The same "a literal list is a photograph" bug the
    game registry keeps paying for, met in a test this time.
- **The first question dynamic has been carried from the bench into a game show.**
  `game-hub-lab.html` + `game-hub/content/unit-lab.js` — a Lab unit **not loaded by
  `game-hub.html`**, so it is reachable only from its own shell and never appears in
  front of a class. Story Reveal was the port: a clue opens terse and each authored
  layer costs a slice of what the tile pays. Same engine, same clue card, same
  scoring, same phones — a special engine would have proved nothing about the real
  one. Verified live: $200 → $150 → $100 across two layers, then the button stands
  down because the clue has no third.
  - **These dynamics are not question forms, and that is the headline.** `Kit.prompt`
    is a *rendering* contract — `render`/`reveal`, no time, no turns, no phones. A
    bench dynamic is a **round**. Reveal ported cheaply only because the hub already
    had `jHints`/`jHintCost`, which is the same mechanic. **Grouping has since been
    built as a real mini-round** (see above) and cost what that predicted;
    **ordering is still open**, and is the harder one.
  - **The normalisation is a whitelist, and that is the real friction.** A clue
    becomes `{text, answer, type, reveal, group}` on open so the kit never learns
    Jeopardy calls a prompt `q` — so `reveal` was silently dropped once and the hint
    button never appeared. **Anything an author adds to an item is invisible
    downstream until it is named there.** `group` was added to it deliberately as
    the first line of the next dynamic, which is what that warning was for.
  - **An authored reveal belongs to the clue, not to a ruleset.** Hints were gated
    behind `together`, where a generated spelling hint is a cooperative crutch. A
    layer somebody wrote is how the clue was *written*, so it is offered on a
    competitive board too — still behind `jHints`, and items without `reveal` are
    exactly as gated as before.
  - **A $100 tile affords one layer, not two.** Hints cost a minimum of $50 against
    a $50 floor, so cheap tiles run out. Arguably right, but author two layers only
    from $200 up or the second is never seen.
- **Story Reveal is the third bench game, and the first that is typed.** A word
  behind three clues — definition, then the word in use, then its shape — revealed
  one at a time, worth a point less each time. Teams **type**; the board judges.
  - **A misspelling is its own verdict.** Every other bench round is a vote, where
    an answer is a choice; this is the first where a student *produces* the word,
    so `HubKit.answer.judge` finally has a caller out here. `redundent` shows as
    **nearly** in amber and does not take the word — "produced it but mis-spelled
    it" is a different fact about a student from "did not know it".
  - **The guard hid the wiring mistake.** `BenchKit.judge` reached for `window.Kit`,
    which does not exist — the hub aliases `HubKit` to `Kit` inside its own closure
    — so it fell silently through to an exact match and downgraded every near miss
    to a flat wrong. **A guard that hides a wiring error is worse than none**;
    `judge.full()` now says which one is running.
  - **The reply strip belongs to the word, not the round.** A wrong answer passes
    the turn, which re-asks the phones within a frame, and `askPhones` was clearing
    the strip — so what the class typed vanished as it was typed. Exactly the bug
    the hub's `lastScored` already paid for, met again one tier down.
  - **The third caller moved the mode picker onto the shelf.** All three games had
    declared turns-vs-race identically; that is `BenchKit.modeSetting` now, with
    each game naming its own modes (*a ladder each*, *both teams at once*,
    *anyone can answer*). What a mode *means* stays in the game, as it must.
- **The thermometer's race is one ladder per team, and it needed a new thing from
  the relay.** Two teams, two ladders; four teams, four — all climbing the same
  scale side by side, so **the climb is the picture** and a class can see who is
  two rungs up without reading a scoreboard. A shared board was the first build and
  it made a race you had to be told the result of.
  - **Each team's pool diverges, so each team's phones must be asked a different
    question.** That is `optionsByTeam` on the relay — the *second* thing a round
    carries per team, and the first where the **question** differs rather than the
    rules. It rides the per-recipient `armed` payload built for the pick shares, and
    falls through to the room-wide `options` for any team not named, so every
    existing game is untouched.
  - **A team's guess is drawn in the rung it is aimed at**, on their own ladder, in
    italic until it settles. That is what replaced a shared pool with dots on it:
    you watch each side's next answer appear where it will land, then lock or shake.
  - **Independent ladders removed a bug rather than adding one.** With a shared slot
    both teams could settle in the same tick and the wrong verdict could land after
    the right one; with a ladder each, no team's answer can end another's round.
  - Fits a projector at two, three and four teams (1280×720, nothing clipped) — the
    suite asserts it, because column width is what a fourth team costs.
- **The thermometer races too, and the third shared piece came out of it.**
  Picked from the toolbar like Connections'.
  - **A race over a *sequence* is not a race over a *set*.** Connections settles on
    a team's four; this settles on a team's leading word. Both need the same pair —
    debounce, because a team's answer arrives from several phones one at a time,
    and a memory, or a team sitting on a wrong answer is told off again on every
    stray reply. That pair is `BenchKit.settle` now, and **Connections was rewired
    onto it in the same change** — the second caller is what made it a service
    rather than one game's helper.
  - **The right answer is resolved before any wrong one.** Both teams can settle in
    the same tick, and taking them in arrival order put *"Team 2: not that one"* on
    screen **after** Team 1 had already won the slot — the board announcing the
    wrong headline for a question that had moved on.
  - **Everything a race removes the recovery path for is removed with it** — the
    turn, the mistake budget, `Reveal this one`, and the clock. That last one is
    Connections' lesson applied without having to re-learn it: expiry disarms every
    handset, and a race has no teacher control left to recover with.
  - `lockIn(word, team)` is one definition for a slot filling, whoever decided it —
    teacher click, settled race vote, or a reveal (`team == null`, so nobody
    scores). Two paths disagreeing about scoring is the bug that shape invites.
- **The bench has a second game, and the shelf grew because of it.**
  `playground/thermometer.html` — Word Thermometer: order words along a scale
  (`annoyed → irritated → angry → livid → furious → incensed`), slots filling from
  the cold end, the team on turn voting on their phones for the next one and the
  teacher clicking. Right keeps the turn, wrong spends a mistake and passes it,
  finishing unlocks the mini-lesson. **Five scales** — anger, formality of requests,
  certainty, frequency, praise — each with a per-word gloss that prints when the
  word locks in, which is what turns a right answer into a taught one.
  - **The answer is a *sequence*, not a set**, which is why this was the right
    second game: two genuinely different callers shape a shared API, two
    near-identical ones only flatter it. `BenchKit.leading(votes, n)` exists in
    that shape precisely because Connections wants four and this wants one.
  - **Four things moved onto the shelf and Connections moved with them** — see
    "The playground" for the table and the two lessons the seam taught.
  - **`Reveal this one` costs the point, not a mistake.** A class that cannot
    separate *livid* from *furious* learns more from being shown than from four
    wrong guesses, and nobody got it wrong, so the budget is untouched.
  - **It fits a projector, and only the screenshot said so.** The first build was
    **167px over** at 1280×720 and cut the mistake dots off the bottom; the slots
    are sized `clamp(36px, 5.4vh, 56px)` now and the suite pins `scrollHeight <=
    innerHeight` *and* the dots' bottom edge. Connections is still 63px over —
    known, not fixed, and the reason the check lives on the new game rather than
    being made a bench-wide rule today.
  - Linked from `index.html` and offered in the room bench's board picker.
    `thermometer` suite, 24 checks including the no-relay degradation every
    playground page owes.
- **Connections plays two ways, and the bench grew a middle tier.** The board can
  now be played as **turns** (unchanged) or as a **race** — no turn, both teams at
  once, each team's picks live on the projector in its own colour, and a team's own
  four *is* its guess, so the teacher never re-enters it. See "The playground" for
  the mechanics and why each phone holds up to four rather than one.
  - **A team's answer is the union of its players' picks**, which is what makes a
    small team possible *and* what forces the negotiation: six words up means
    agreeing which two to drop.
  - **A set of four is judged when it settles**, debounced — four picks arriving
    from four phones would otherwise be judged three times on the way up — and
    remembered per team, so a wrong four is not re-judged until it changes.
  - **The clock stands down in a race, and that was a dead end rather than a
    preference.** The round clock disarms every handset when it expires; turns mode
    recovers because the teacher still has Submit, but a race hides Submit — so on
    the **default 60s** a race board reached one minute with no phone able to tap
    and no control on screen to click, and only Restart got out of it. The clock
    now goes the way the mistake dots and Submit already do, on the board *and* on
    the handsets: a race's pressure is the other team, which is the same reason a
    wrong four costs nothing there. **The general shape: a control that a mode
    removes the recovery path for has to be removed with it** — the two race checks
    were proved against the reverted fix.
  - **A player's share of the four comes from their team's size.** One phone holds
    all four, two hold two each, four hold one each (`ceil(4/size)`). One room-wide
    cap could not say that, because teams are not the same size — and a team of
    four each holding four words is not a negotiation, it is four separate answers.
    It is a *share*, not a quota: a team holding five between them is over and has
    to talk one of them down, which is the mechanic.
    - **`multi` is now per team on the relay** (`multiByTeam`), delivered on a
      per-recipient `armed` payload rather than one broadcast — the first thing a
      round carries that differs by team. Falls through to the room-wide `multi`
      for any team not named, so every existing game is untouched.
    - **A share that moves is pushed, never re-armed.** A fresh arm clears every
      handset's picks, so a latecomer walking in would wipe what the rest of the
      team had just agreed on — the same rule as the hub's "a re-ask never cancels
      what is in progress". `host.shares([…])` moves the cap and leaves the picks.
    - **Being over your share is a state, not an error.** Nothing is stripped: the
      handset says "Drop 1 — it is 1 each now" and refuses to add. Forcing a trim
      would take a word off a student who did nothing wrong.
  - **A held reply leaves with the phone that holds it.** A dropped phone's picks
    used to sit in `room.responses` forever, still counted toward its team's union,
    with nobody able to drop them — the team was simply stuck. But a *typed* answer
    must stay, because the teacher wants to see what the class wrote even from a
    handset that died. So the host declares which kind of round it is (`holds` on
    the arm) rather than the relay guessing, and the leave path recomputes the
    tally and tells the host. **The distinction is holding versus having given.**
  - **The highlight is neutral; only the dots carry the team.** The pick ring took
    the colour of whichever team grabbed a word *first*, which paints a contested
    word as one team's and leaves the other's dot reading as a footnote on somebody
    else's pick. Both sets have to be equally legible — a team reading what the
    other side is assembling is what makes the race a language task rather than a
    speed one. The teacher's own click is a neutral dashed outline for the same
    reason: on a race board nothing is theirs to lock in. Asserted as a property
    (two words held by different teams look identical), so restyling the ring
    cannot quietly re-encode the team in it.
  - **One team palette, in `hub-buzzer.js`.** A team's colour has to be the same
    fact on the projector and in the hand, so it lives in the one file both ends
    load rather than in two lists kept in step — and it costs the relay nothing,
    which is right, since a colour is presentation. The handset paints its team
    pill, its join-screen swatches and its held words with it, so a student matches
    the colour in their hand to the dots on the board without being told which are
    theirs. The hub's own team bar has not adopted it yet.
  - **Race has no ending but solving all four.** Turns mode has the mistake budget;
    a race that stalls on the last group runs until somebody gets it. A whole-game
    clock — "as many groups as you can in 90 seconds" — is the obvious candidate
    and would reuse the setting that just stood down, but it invents a third
    guessed number on top of the two the classroom run is meant to settle. Open,
    deliberately.
  - **`playground/bench-kit.js` is the new tier**: what every *question game*
    shares, as `hub-kit.js` is what every *game* shares. It exists because
    `openRoom` had already been written twice in two days. Teams and the round are
    deliberately still in Connections — one caller is a guess, not an API. The rule
    and the three tiers are in "The playground".
- **The bench's phones are real handsets now, scaled — they were 264px wide.**
  Reported as "each form lists each word underneath it, which means you have to
  scroll down". The two-column layout was working: it just cannot fit two 140px
  columns into the 220px `join.html` had inside a 264px rack column, so the bench
  showed a layout no phone shows and ten of sixteen words sat below the fold. The
  board had had the fix since the bench was written (render at the projector's
  logical width, scale to the pane); the phones never got it. **A scaled thing
  still occupies its full layout size**, so the iframe needed a clip box with an
  explicit height. The two checks were proved against the reverted build —
  `inner:264, cols:1, scrolls:true, offscreen:10`.
  - **The bare bench opens empty and that reads as broken.** `index.html` links it
    with no `?board=`, so the projector pane is blank while the picker already says
    "Playground · Connections" — selected but not opened. Opening the picker's
    default on load would fix it; not done yet.
- **Question forms have a rig now, and a sixth form to prove it.** `playground/
  prompt-lab.html` lists every registered form, draws and reveals it at board size,
  and pushes the same question to phones — see "The playground". It exists because
  a form previously had nowhere to be seen: you had to find a bank item carrying
  its type, which is the same reason density is the open problem. The menu asks
  `Kit.prompt.types()`/`info()`, so **a form written next month appears in it
  without the lab being touched**.
  - **`bridge` is the new form** — `FIRE -> ___ -> SHOP` answered by `work` — and
    the **first that suits every board**, because its answer is one ordinary word.
    The reveal names the compounds it built, since the answer alone doesn't explain
    itself. See the forms table for the authoring convention.
  - **A form that declines is not a form that did nothing**, and `render()` cannot
    tell you which happened — it returns the type whenever the form *ran*. The
    absence of element children is the tell, and the lab reports it; that
    distinction was a bug in the lab before it was a line in the docs.
  - **A form now has two stages, because a separate *page* is not a separate
    *form*.** Experimental forms live in `playground/lab-forms.js`, which no game
    loads; `hub-kit.js` is the shipped shelf. Graduating is moving the block.
    `bridge` went straight into the kit at first — shipped, invisible only for
    want of content — and has been pulled back to the lab file, which is where a
    form being experimented with belongs. **Portability is proved, not promised:**
    the suite drops the lab file into a real hub page and asserts every form in it
    draws and reveals on a live Jeopardy clue card, iterating whatever the file
    registers so future forms are covered for free.
    `.claude/skills/new-question-form` is the procedure.
- **The room bench: the board and its phones on one screen.** `playground/
  phone-bench.html` now carries the **projected board too**, not just the
  handsets — because a phone dynamic can only be judged by what it does to the
  board, and two tabs never show cause and effect together. Any board works
  (hub or playground) because the bench asks `window.HubHost` what room the page
  is running — **a stated convention now, on the hub as well** — so the code is
  never copied by hand. See "The playground" for the four rules it pays up front
  (seat isolation, no iframe re-parenting, projector-width scaling capped at 1:1,
  and the `ResizeObserver` re-fit that a screenshot caught and the assertions had
  missed). `bench` suite covers it, hub board included.
- **The playground exists, and Connections is its first game.** `playground/
  connections.html` (linked from index.html) — see "The playground" section for
  the rules of this lane. Ported from the Learning-games prototype with its five
  puzzles intact; classroom-adapted with teams, turn rotation and team-scoped
  phone voting over the existing relay, phones untouched. The `playground` suite
  (15 checks) drives the whole loop including a phone and the no-relay
  degradation. Next candidates the user likes: story reveal, emoji idioms, word
  bridges, word thermometer, close words, double agents, perfect partners.
- **One settings entrance, and the game view is organised.** The separate Lab
  button is gone: ⚙ during play opens the docked drawer for the game being played
  (`L` still toggles it; Escape closes it), everywhere else the full panel; the
  drawer's "All games" button hands over to the panel for cross-game edits. Panel
  game tabs and the drawer are now literally the same rows (`buildRow`), so a
  control cannot behave differently depending on the door. Organisation: Ruleset
  section first (pickers registered with `presets` / `S.describePresets`), then the
  game's own groups, then shared groups in a fixed order; All games leads with the
  shared groups instead; headers fold. Rows a ruleset bundle touches say what the
  chosen mode set them to ("Classic sets this to 10s") — advisory, because a mode
  writes switches rather than holding them. The two phone groups merged into one
  `Phones` group. `lab` suite covers the routing, the handover, the ruleset
  section, the notes and the folding; `scoping` pins the drawer-for-the-game
  behaviour that replaced "⚙ opens on the current game's tab".
- **Classic has an answer clock, started by the buzz.** `jAnswerSeconds` (Jeopardy
  group, 0 = off; the `classic` preset writes 10, `hub` and `together` write 0)
  gives the team on the floor that many seconds. Decisions worth keeping:
  - **The buzz starts it, never the clue opening** — the teacher reads aloud at
    their own pace, and the pressure belongs on the team that claimed the right to
    answer. A steal claim restarts it (`jTakeSteal`), a typed buzz never starts it
    (the word is judged the instant it arrives — nothing left to time).
  - **Time up is a fact, not a verdict**: klaxon, a two-beat red pulse on the card
    (`overtime`), and the buttons stay exactly as they were. The teacher controls
    everything is the app's constraint, and auto-marking wrong mid-sentence would
    fight it.
  - **Its own countdown on the clue card, not the header timer** — that widget is
    the teacher's instrument, and a clock that reset it on every buzz would
    overwrite whatever they had set. (The final clue does borrow the header timer,
    which is right there: one clock for one all-room beat, started once.)
  - **The phones watch the same countdown as a duration, not a deadline** — sent
    once with the relay's `locked` event, counted down from receipt, so phone
    clocks never need agreeing with anybody. Display only; the host expires it. A
    late joiner gets what is *left*, computed on the relay where the lock was
    stamped. Stops on `armed`/`disarmed`/`judged`/`reset`.
  - `jclock` suite covers the whole beat: preset writes, buzz starts, clue-open
    doesn't, expiry flags without deciding, reveal retires it, phone follows.
- **Classic pays the rebound in full.** Asked as "turn steal off, the show doesn't
  have it" — the show *does* (a missed clue opens to the other contestants), what
  differed was the price: ours paid half, the show pays full. `stealFullValue`
  (Competition group, default off, games jeopardy+millionaire — the two that score
  in values; a hex or a word has nothing to halve) is written on by `classic` and
  off by `hub`/`together`. The card's "steal for X" and Millionaire's hint read the
  same setting as `award()`, because shown and paid must agree — the `competition`
  suite asserts offer, payout and the answer clock starting on the steal claim.
- **A scanned code outranks the remembered seat.** Reported as "the QR skips the
  name-and-team screen and goes straight to the button". The seat memory
  (`engishism.seat`) auto-rejoined on load without comparing its stored code to the
  `?code=` the QR just put in the URL — so a phone that had ever joined a room
  auto-joined *that* room, skipped the join screen, and sat deaf to every team
  change in the room actually scanned. The URL code is an explicit statement of
  which room the phone belongs in: when it differs from the seat, the seat is last
  lesson's — forget it, keep the name, show the join screen. Same code (or no code
  in the URL) still resumes, which is the reload-mid-lesson feature working.
  - **The join screen's team list now re-asks every 4s while it is up.** It was
    fetched once per code, so a team added after the page loaded was only pickable
    by students who had not opened it yet. Joined phones already got pushes over
    the stream; the join screen has no stream, so it polls.
  - **A matching code still resumes — so the play screen carries the way out.**
    The first report survived the fix, because the phone's seat was for the *same*
    room the QR named: resume ran by design, and a phone holding a seat in the
    current room could never reach the name-and-team screen again by any path.
    "Not you? Change name or team" on the play screen forgets the seat, closes the
    stream and returns to the join form with the code and name still filled.
  - All three checks live in `jointeams`/`phoneteams` and the first two were
    proved against the reverted fix (3 checks fail on the old build).
- **Jeopardy has a third ruleset: `together`, the class against the board.** Every
  other mode sets teams against each other; this one sets the room against a number,
  for a group competition makes anxious rather than sharp. Written from the
  `new-mode` skill, which is what it was written to be tested by.
  - **The scores pool at the display and at the ending, not in `award()`.** Teams
    still hold their own points — the team bar is the app's spine — but the game is
    played and finished against one class total. That is what keeps this a mode
    rather than a second scoring system.
  - **The target is a share of what the board is actually worth** (`jTarget`, 60% by
    default), so a teacher never has to invent a number, and it re-reads correctly
    for any board size.
  - **Hints are the cooperative mechanic**, and they cost *the clue*, not the class:
    a first letter, then the length, each taking a slice off what that clue pays.
    Being stuck gets a way out that is not failure, and deciding whether to spend is
    itself a conversation.
  - **Costed in 50s, because `award()` rounds to 50s.** A hint leaving $349 on the
    card and then paying $350 is the card telling the room something untrue; the
    check asserts shown and paid are identical.
  - **The preset switches *off* everything that pits teams against each other** —
    steal, keep-the-board, Daily Doubles, deduction. A preset that only ever adds
    would leave a steal running under a cooperative round.
- **A mode picked mid-board has to reach the board.** Reported from a full Classic
  playthrough: "no Daily Double ever appeared." The switch said 1 and the board had
  none — **the modes only appear in the Lab, and the Lab only exists once a game is
  running**, so picking Classic wrote the setting after the board had already been
  built and planted. Planting is now re-runnable and hooked to the setting.
  - **It plants among the tiles still unplayed**, which is what makes a mid-round
    change honest: a Daily Double is hidden, so one appearing on an unplayed tile is
    indistinguishable from one that was always there — while a tile the room has
    already answered must never become one, or a clue they have seen would pay a
    wager.
  - The general lesson: **a setting that is read once, at build time, is not a
    setting the Lab can change.** Anything a teacher may pick mid-round needs a path
    from `S.onChange` back to the board.
- **The final clue owns the phones; a Daily Double asks nobody.** Two beats of
  Classic where the mode is the wrong answer, both fixed through the contract rather
  than by special-casing the phone layer.
  - **The final clue is the one moment every team answers at once**, privately,
    against the clock — a buzzer hands the last question of the game to one thumb.
    `phoneRound()` returns a `write` round while it runs, so the beat differs while
    the mode stays `buzz`, and the check asserts exactly that pair.
  - **A Daily Double belongs to the team that found it**, so no question is open to
    the room. That is `askingNow()` returning false during the bet — which is what
    stops a reconnection re-arming the buzzers mid-wager, a latent bug of the same
    shape as the flicker.
  - **Not asking the phones is not the same as telling them nothing.** The first
    version simply skipped `askPhones`, which left the *previous* question on every
    handset with a dead button — indistinguishable from broken, and a phone still
    armed from that clue could buzz in mid-wager. It disarms now, which says the true
    thing: nothing here is open to you.
  - **Refusing a buzz has two shapes, and the difference is whether a question is
    live.** Re-arming is right when one is — it clears the relay's lock so the team
    that *is* entitled can get in. It is wrong when nothing is open at all, because
    it puts the buzzers back for a question nobody may answer. `onBuzz` now disarms
    in that case instead.
  - **The steal and keep-the-board are written into the presets too**, because the
    show does both and a ruleset that leaves them to whatever was set last is only
    describing part of itself.
- **What the phones do is part of a mode, not a separate decision.** Reported as
  "the modes have no control over the phones — `What the phones do` still controls
  them". It was not overriding anything: `phoneMode` was simply missing from the
  bundles, so the row kept whatever it had last. A mode that describes how a round
  is played and says nothing about thirty handsets describes half of it. Hub is
  `off` (the teacher marks), Classic is `buzz` (the show is a race for the floor),
  Together is `write` (a clue pays what the class produced). **Written, not
  shadowed** — the row in ⚙ still says what will actually happen, and a teacher can
  change it afterwards without the mode contradicting them.
- **A room now exists whenever phones are switched on — a deliberate reversal.**
  Reported twice, once for Bingo and once for Jeopardy, both as "the code line is
  missing in this game". Neither was about the game: `phoneMode` was `off`, and
  `off` used to mean **no room at all**, so there was no code on screen and a class
  cannot join a room that does not exist.
  - **Two facts were being conflated.** *Whether a room exists* is a property of the
    lesson — the teacher wants phones today. *What the phones do during a question*
    is the mode, and `off` is a perfectly good answer to that.
  - "Off means no room" was written to keep "Nothing — phones idle" honest, but the
    chip already says `idle here`, so nothing pretends otherwise. Exceptions had
    been carved out for Millionaire's lifelines and Bingo's cards; this makes the
    rule the exception's shape rather than the other way round.
  - The `joinbar` suite asserts it across **all five games**, so the next game
    inherits it.
- **Jeopardy plays as the show plays it, if you ask it to.** Three rules the TV
  game has that this board never did, each its own switch, all three set at once by
  `jRules` — because "play it like the show" is one decision a teacher makes, not
  three.
  - **Daily Double.** A hidden tile, planted at build time and weighted towards the
    bottom of the board (one on a $100 clue is worth nothing to find). It opens on
    a **bet placed before the clue is drawn**, capped at the show's rule — your
    score or the biggest clue on the board, whichever is greater. The team that
    found it answers alone: no phones, no steal.
  - **Nothing on the tile may give it away**, so it is `dataset` rather than a class
    — no stylesheet can leak it by accident, and the check asserts a Daily Double
    tile is identical to every other one.
  - **The final clue.** The board clearing no longer ends the game: the category is
    named, every team in credit bets what it likes, one clue goes up, and it settles
    **lowest score first** as the show does it. A team in last can win from there,
    which is the whole reason it exists — the smoke test drives exactly that case.
  - **Wrong answers can cost the value**, negative scores and all. Off by default:
    a class 500 down in the first two minutes stops trying, which is the opposite of
    what any of this is for.
  - **A preset writes the switches rather than shadowing them**, so the rows in ⚙
    always say what will actually happen and a teacher can change one afterwards
    without the preset quietly lying. That is the general shape for modes — a mode
    is a named bundle of settings, not a second code path.
- **A mode and a game's own dynamic were fighting over the same handset.**
  Reported as "when I select buzz mode a button appears on the phone screen" while
  playing Bingo with the cards on phones. `phoneMode` says what a phone does during
  a question, which is right for a board every phone is *watching* — but a bingo
  card in the hand already is the dynamic, and a buzzer over the top of it is not a
  choice between iterations, it is two things arming the same phone. Worse, the two
  disagreed *asynchronously*: the card round armed first and any reconnect re-asked
  with the mode, so the buzzer arrived a moment later and replaced the card.
  - **`phoneRound()` joins the contract**: a game returning `{mode, prompt, options}`
    owns the round, `null` (the default, and what four of the five games always
    want) means the mode decides.
  - **One definition, so arming and re-asking cannot disagree** — `phoneRoundNow()`
    is what both consult. That was the actual defect; the conflict was visible only
    because the two paths answered the question differently.
  - **With the cards on the board the mode matters again**, and the check asserts
    both directions — buzz is a buzzer there, and is refused a card round.
- **A setting's `games` list was a snapshot, so the fifth game was a second-class
  citizen.** Reported as "the new game's format is different — the join code only
  appears if I pick the phone option". Every shared setting registered with
  `games: gameIds()`, which is **evaluated once**, in the settings block near the
  top of `hub-engine.js` — a photograph of the four games that existed then. Bingo
  registered after it and was silently absent from `phoneMode`, `phonePrompt`,
  `theme`, `intro` and both sound settings: its ⚙ and its Lab were quietly narrower
  than every other game's, and with no phone mode available no room ever opened, so
  the join chip never appeared.
  - **`games:'*'` asks the registry when it matters** instead of holding a list, so
    this is now true for a game registered at any point.
  - **The check registers a bare game *after* everything has loaded** and asserts it
    is offered every shared setting — reverting one setting to `gameIds()` fails it.
  - The contract itself was fine; what leaked was *configuration*. Same shape as the
    `.lit` stage list and the `play-fit` list: **anything that names the games is a
    bug waiting for the next game.**
- **Bingo puts a card in every student's hand.** `bingoCards` picks where the cards
  live: `board` (one per team, shared, the default and the fallback) or `phones`
  (one per student). The phone version is what bingo actually is, and it is the fix
  for the weakness it shares with Blockbusters — two people play and the rest watch.
  - **The relay now holds state that outlives a question.** Everything else it does
    is per-question and forgotten; a card has to survive the next call *and* a phone
    dropping off the wifi. It stores the card and the marks — **but the host deals
    them and the host judges every tap**, so the relay still never learns which word
    the clue means, exactly as it never learns a typed answer.
  - **A tap is a typed answer without the typing**, so it arrives through the
    existing `respond` path and is judged by `Kit.answer.judge` against `expects()`.
    Marking, scoring, the strip naming who got it and the banner were all free.
  - **A call stays open on phones and closes on the board**, and that is the game
    rather than an inconsistency: everyone holding the word marks it, so the teacher
    moves on when the room has had long enough. A word nobody took goes back in the
    bag (`bingoRequeue`) or a class of thirty runs out of calls before anyone lines
    up.
  - **A student's line scores for their team**, so the team bar stays true and you
    get individual engagement without losing class-vs-class.
  - **The board shows the room, not thirty cards**: how many are in play and who is
    one square away, with the near-winners lit.
  - **The winning card stays on the phone.** Ending the round *disarms* rather than
    resets, because the first thing that happens after a line is the teacher reading
    it back off the winner's handset.
  - **The phone remembers its seat** (`localStorage`), so a reload rejoins the same
    room under the **same id** — which is what makes the card come back with its
    marks. A new id would have been dealt a second card and stranded the first. It
    also ends the retype-the-code-mid-round problem for every game.
  - `roomNote()` joined the contract because the chip said `votes only` over a game
    where every phone holds a card.
- **The buzzer flickering on and off was two bugs, and the second one was the
  visible one.** Reported from a real round; the phone kept its room number
  throughout, which is what said the connection was fine and the *armed state* was
  cycling.
  - **Two hub tabs on one room fight forever.** Only one host stream may be live and
    the newest wins — but ending the loser silently is indistinguishable from a
    network drop, so its `EventSource` reconnects, which ends the winner, which
    reconnects. **Every one of those `ready` events re-asks the phones**, and an
    `arm` resets the button on every handset. The relay now sends a `replaced`
    event before ending the stream and the client closes for good.
  - **A re-ask that changes nothing now says nothing.** This is the general fix and
    it does not depend on knowing why `ready` repeated: an `arm` is not free — it
    clears the relay's lock and its collected responses, and resets the handset — so
    the engine remembers what the room was last told and stays quiet if it still
    holds. Re-asking is for telling a room that came back *what is being asked*.
  - The first fix (below) was real and shipped, but it was **not** what the room was
    seeing. Worth remembering: *the phone keeping its room number* was the detail
    that separated the two.
- **A reconnecting phone was being thrown out of the room it had just rejoined.**
  Reported from a real round as "the buzzer oscillates between on and off, like
  it's disconnecting and reconnecting" — it was, in a loop. An event stream
  re-registers the phone under the same id, but the **old stream's `close` fires
  after the new one is stored**, and the handler deleted by id without checking
  whether the stream closing was still the live one. So the phone that had just
  come back was removed, found itself out of the room, reconnected, and was removed
  again. **The host stream has had this guard since it was written; the player path
  never did** — one line apart, and only the host's was ever exercised by a test.
  The `reconnect` suite drives it over raw HTTP, because the race is between two
  connections and a browser's `EventSource` will not let a test hold both.
- **The phone contract: six hooks, and the branch points are gone.** Buzzing,
  everyone-types, type-then-buzz and the class vote used to reach a board through
  `if (activeGame === …)` chains inside four functions — `expectedAnswer`,
  `currentPhonePrompt`, `reaskPhones`'s liveness check and `onBuzz`. **The phone
  layer now has zero of them** (32 `activeGame` branches across the engine became
  21, and none of the survivors are in the phone code). A game declares:

  | Hook | What it answers |
  |---|---|
  | `expects()` | what a typed answer is judged against |
  | `phonePrompt()` | what the handset shows |
  | `askingNow()` | is a question open right now |
  | `buzzEntitled(b)` | `false` refuses this buzz — the engine re-arms |
  | `onBuzzTaken(b)` | somebody has the floor |
  | `onTypedWin(b)` | typed and correct: score it, return the points (`null` = didn't) |
  | `wantsVote()` / `onVoteReply(all)` | the vote half — whether the game ever asks the room, and where the counts are painted |
| `roomNote()` | what the chip says when a game wants a room without a phone mode |
| `phoneRound()` | the game drives the phones itself (Bingo's cards, Jeopardy's grouping clue); `null` = `phoneMode` decides. Whatever it returns beyond `{mode, prompt, options}` — `multi`, `multiByTeam`, `holds`, `rethink`, `team` — is **carried to the relay, not interpreted**, so a game can use a round shape the engine has never heard of |

  - **Every hook defaults to a no-op**, so a game that declares none has idle
    phones — a visible, correct state rather than a half-wired one.
  - **Refusing is not ignoring**, and that fact now lives in one place: the relay
    locks the room on the *first* buzz whoever sent it, so a phone that isn't
    entitled would hold the lock and keep the entitled team out. Race's steal rule
    and Millionaire's `speaker` role are both `buzzEntitled` returning false.
  - **`onTypedWin` returns what it paid**, so the engine can name the student on the
    strip without knowing what scoring means on that board — a tile, a hexagon, a
    word, a bingo square.
  - The registry suite asserts both that the hooks exist **and that every game
    answers them itself**, so a sixth game with idle phones fails rather than
    quietly shipping.
- **Bingo — the fifth game, built as a test of the framework.** 3x3 cards per team
  from a shared 12-word pool; read the clue, the first team to answer marks it off,
  three in a row wins. It has **no bank of its own** — it consumes
  `blockbustersBank` through a predicate (single-word, unique answers with a clue
  each), so **both units gained a fifth game with zero authoring**. That is the
  pooled-content idea working in miniature, on real content.
  - **172 of 173 shared checks covered it without being told it exists**, because
    `fit`, `phone`, `gameshow` and `lab` ask the registry rather than carrying a
    list. The one failure was a test asserting *four* games are registered — now
    registry-driven, since a suite that breaks when you add a game is the opposite
    of what it is for.
  - **A game registered after init is invisible.** Bingo registered fine, appeared
    in `HubGames.ids()`, and never got a card, because `renderGameCards()` had
    already run. Silent, and it cost a debugging round: **registration order is
    load-bearing and nothing says so.**
  - Two lists that were hard-coded became registry-driven on the spot: clearing
    `.lit` from every stage, and which boards get `body.play-fit` (now a
    `fitsScreen` flag, false only for Blockbusters).
- **A re-ask was destroying answers the room had already given.** The rule that
  protects a live buzz — *re-asking means "the room came back, tell it what is being
  asked", never "cancel what is in progress"* — had no equivalent for `write`, where
  nobody takes the floor. The relay clears its responses on `arm`, and `ready`
  arrives on **every reconnection of the host's stream**, so two of four answers
  vanished. It looked like the strip losing them; the host had asked twice. A class
  on school wifi reconnects all lesson, so this is the normal case, not the edge one.
- **Three bugs from the first real run of the four-team build.**
  - **A reset board overlapped its own hexagons.** The won board is scaled down to
    sit above the banner, and `#play-blockbusters` carries a **350ms transform
    transition** — so "New board" cleared the scale and laid out one frame later,
    mid-transition, measuring the hexes at 0.84 of their real size through
    `getBoundingClientRect()`. They were spaced for a 92px hex and rendered at 110.
    `offsetWidth` is the layout width and ignores ancestor transforms *and* the
    hexes' own deal animation. **A resize fixed it, which is exactly why leaving the
    game and coming back looked fine** — and why it read as a rendering glitch
    rather than a measurement one. Same lesson as `naturalRect()` on the card flip:
    **a rect is what is painted, not what is laid out.**
  - **Teams could be added and never removed**, so a class that split four ways one
    lesson carried four teams into the next. A team's *index* is its identity in
    three other places — `active`, Millionaire's per-team `mState`, and `bbSideAt` —
    so `removeTeam` is not a splice. Two is the floor: every board is built for at
    least two sides, and the buttons disappear there. Points are a lesson's work, so
    removing a team that has any asks first.
  - **Six teams ran off the side of the join screen.** The team buttons were a flex
    row, so on a 360px handset each got 50px and the last sat past the edge — a
    student on Sharks could not pick Sharks. It is a wrapping grid now; checked at
    320/360/390px.
- **One strip for everything the class does — `#phone-bar`.** Where a student's name
  appeared used to depend on the game *and* the mode: a buzz went on the room chip
  (replacing the join address the class was still reading), a typed answer went into
  the clue card in Jeopardy, under the sentence in Race, under the question in
  Millionaire. Four layouts for one idea, and three of them moved the board as they
  filled. It is now one element, in one place, in every game.
  - **Fixed height is the contract.** It is as tall empty as full, so what the class
    does can never resize the board underneath; a full class scrolls sideways. That
    is what `repliesHost()` — which picked a different parent per game — existed to
    work around, and it is gone.
  - **The chip is the room's identity, the strip is the room's activity.** They are
    two facts and the chip used to swap the first out for the second, so one buzz
    took the join address off screen while the class was still typing it in.
  - **It outlives the question.** Race re-arms within a frame of a word being
    claimed, so anything shown only while the buzz was live was gone before the room
    could read it — which is exactly "it just moved on with no indication who got it
    right". `lastScored` stands until the next question is asked.
  - Five states, one per thing that can be true: somebody has the floor, somebody
    just scored (`+points`), somebody missed, the room is answering, or nothing yet.
- **Blockbusters seats more than two teams, as two alliances.** The board is
  structurally two-sided — yellow crosses, blue descends — so a third team has no
  route to win by, and the answer card was hard-coded to the first two teams. Now
  every team appears on it and scores its own points; `bbSideOf` (index parity) says
  which colour their hexagon takes, and the *line* belongs to a side.
  - **With two teams every part of this is the identity**, so the two-team game is
    untouched — that is the property that made it safe to do at all.
  - Within a side the teams rotate (`bbSideAt`), including when the side keeps the
    board, so one student on an alliance cannot answer every question.
  - The legend names who is playing each colour and underlines whoever is up; with
    two teams that repeats the team bar, with four it is the only place that says
    whether Lions or Bears is on.
- **The phone says which room it is in**, all lesson. A student who joined on the
  wrong code, or drifted into the class next door's game, had no way to tell —
  every screen after joining looked identical whichever room it was.
- **A buzz was being thrown away by the room reconnecting**, and it had been there
  the whole time the phones have existed. `reaskPhones()` runs on every `ready` from
  the relay — which is **every reconnection of the host's stream, not just the
  first** — and it re-arms, which clears `buzzWinner`. So a student buzzed, and
  moments later their buzz vanished and the buzzers reopened. On school wifi that is
  not an edge case, it is what a dropped connection does; it just never looked like
  a bug because the room simply went back to being open.
  - The rule is the same one the vote already had: **re-asking means "the room came
    back, tell it what is being asked", never "cancel what is in progress"**. It now
    declines while anybody holds the floor, and the relay still holds the lock, so a
    phone reconnecting mid-buzz is told who got in.
  - The regression test drives it through a **settings change** rather than a
    reconnect, deliberately: that reaches the same path, and changing a dynamic in
    the Lab mid-question must not take the floor off whoever is standing on it
    either. Proved by reverting the fix — three checks fail, including one that had
    been failing for other reasons and was read as a Race steal problem.
- **The clue card floats over the board instead of blacking it out.** It carried a
  90%-opaque backdrop across the whole screen, so opening a clue hid the thing the
  room was playing on — which tiles were gone, which hexagons were still open, the
  score. No scrim now, and **the card can be dragged** by grabbing anywhere that
  isn't a control.
  - **The drag is written to `translate`, never `transform`.** The flip animates
    transform through the Web Animations API, so an offset in the same property is
    wiped by the next keyframe or fights the landing. They are separate longhands
    and compose, so a card can be dragged mid-flip and still land on its tile.
  - **Visible and clickable are different requests.** The scrim was also what
    stopped a stray click opening a second clue over the first, so `body.clue-open`
    drops pointer events on the play screen — the card and the team bar keep theirs,
    because correcting a score mid-clue is a real thing a teacher does.
  - The offset resets on every open: an old drag was a decision about the previous
    question, and the opening animation has to land on its own tile.
- **The team bar is back under the board; the timer stays in the header.** The
  header is the teacher's instruments; the bar is the game's state and the room
  reads it. It keeps the compact styling it grew while it lived in the header, so
  the strip costs ~37px rather than the 84px it did originally.
  - **`Kit.floorTop()` earned itself twice now.** The bar has moved out of the
    boards' way and back again, and neither move needed a single fit or layout
    assertion edited — they all ask for the floor rather than restating where it is.
- **Who the points belong to, per mode.** The three phone modes answer that question
  differently and now actually do:
  - **`write`** — the whole room answers, so nobody won the question. `keepControl`
    is a reward for winning it, so applying it here left one team picking every tile
    for a whole game. The turn rotates instead.
  - **`buzz`** — the buzz says who wants the floor and highlights that team; the
    answer is spoken in the room, so the teacher still marks it. Unchanged, and now
    pinned by a test.
  - **`type`** — the student produced the answer in writing and the host judged it,
    so **it scores automatically**, to that team, in every game. Race had this from
    the start; the tile games did not, so the same student doing the same thing
    scored on one board and waited for a click on the other.
- **The phones offer the teams that exist.** The join screen hard-coded two buttons,
  so a class split into four could only pick from the first half, and a team renamed
  to something the room answers to still read "Team 2" on every handset. The phone
  asks the relay (`GET /buzzer/room?code=…`, team names only) as soon as there is a
  code to ask about, and `pushTeamNames` now runs from `renderScorebar` — the one
  place that runs on any change to the list — skipping when nothing moved, because
  that render also fires on every point scored.
- **The bench picks the hexagon.** Blockbusters' real weakness was never the board,
  it was that two students play and the rest watch. The team on turn now chooses its
  next hexagon on their phones — `Team picks` in the legend row asks them, their
  votes land in a strip beside it, and every hexagon carrying the leading letter
  lights up. Setting `bbTeamVote`, on by default; no room, no button.
  - **Advisory on purpose.** The teacher still clicks the hexagon. Students never
    touch the device is the app's constraint everywhere, and a vote that opened a
    clue by itself would make a mis-tap unrecoverable.
  - **A vote can belong to one team**, which is new and reaches three places: the
    relay stores it, the phones that are not entitled show the question with no
    controls, and `Kit.vote` drops what arrives anyway — see "Asking the room to
    choose". Millionaire's Ask the class went onto the same service, so there is one
    implementation rather than two.
  - **Opening a hexagon ends the vote**, before `askPhones`, or the clue's arm is
    immediately overwritten by a vote nobody is still taking.
  - **A vote is a negotiation, so a player can move it.** `rethink` on the arm
    lets a phone tap another option and have its reply replace the first — the
    relay keys replies by player id, so the tally follows and nothing is
    double-counted. Without it the first tap was final, which is a submission,
    not a team agreeing on something. `spent` is not set for a rethink round, so
    a reload comes back able to change its mind too — and the join payload
    carries `yours`, this phone's current choice, so it comes back *showing* it.
  - **A round can carry a clock**, sent once as a duration with the arm and
    counted down on each handset from receipt, so no phone ever compares clocks
    with anybody; a phone joining mid-round is told what is **left**, computed on
    the relay where the round was stamped. Expiry is a fact, not a verdict: the
    phones stop taking taps and say so, the board says so, and **the teacher still
    clicks** — the same rule as Jeopardy's answer clock.
  - **A vote you have to scroll is a vote you cannot make.** Sixteen options fit
    no handset as full-width rows, and choosing between things means seeing them
    at once — so more than six word-length options lay out as **two columns**
    (`.opts.compact`), which fits all sixteen on a 360×640 phone with nothing off
    screen. The minimum column is 140px, not 100: three columns on a 390px phone
    broke `consequently` mid-letter, which is worse than a longer list. And the
    prompt for a list like that is a **label** — "Pick a word" — because every
    line of instruction is a line of words pushed off the screen.
  - The relay's option cap was **6, now 20**: right for a question with four answers,
    wrong for "which letter is still on the board". The phone lays short options out
    as a keypad rather than a list, so the cap is what fits a hand.
- **Voting is not a mode — it is what Ask the class does with whatever room is
  open.** `vote` was one of `phoneMode`'s values, which made it a *choice against*
  buzzing and typing: a Millionaire round could have a class that buzzes or a class
  that votes, never both, and the vote was unreachable unless the teacher had set
  that one value. But the two answer different questions. **A mode says what a phone
  is for during a question; the lifeline borrows every phone in the room for the few
  seconds it runs, then gives them back.** So `phoneMode` is now `off` / `buzz` /
  `write` / `type` and the lifeline votes whenever `buzzHost` exists — including at
  `off`, which is what a teacher who has never opened ⚙ is running.
  - **`off` had to stop meaning "no room".** `phonesWanted()` returned false at
    `off`, so the room a vote needs would not exist — and one opened *by* the
    lifeline is a room nobody has joined, with a class that cannot scan a code while
    the question is on screen. Millionaire now keeps a room open whenever lifelines
    are on, and the chip says `votes only` rather than `idle here`, which would read
    as "don't bother joining" to a room about to be asked something.
  - **The borrowing ends as explicitly as it starts**, and that is what `mVoting` is
    for — distinct from `mCounting` (the board behaves oppositely: a click answers)
    and from `mTally` (the counts outlive the vote being open). **Done voting** hands
    the phones back via `askPhones`; without it a class set to buzz lost its buzzer
    for the rest of the question the moment a lifeline was used. Answering closes it
    too. `reaskPhones()` declines while a vote is live, or a phone joining mid-vote
    would replace four options with a buzzer on every handset and only the votes
    already cast would count.
  - **`off` is a state to put the phones *into*, not the absence of one.** Now that a
    room outlives the mode, `askPhones` disarms at `off` — otherwise closing a vote,
    or leaving a game that was buzzing, left thirty handsets showing a live button
    for a question that had gone.
  - **A value naming a variant that no longer exists is worse than a wrong one** —
    nothing matches it, so the phones go quiet while the panel still claims a dynamic
    is running. `migrateVoteMode` rewrites any stored `vote` to `off`. It needs no
    dropped key to run once: after it, nothing reads `vote` and nothing can write it.
  - Changing `phoneMode` or `mLifelines` now re-syncs the room on the spot rather
    than at the next game, which is the point of the Lab. Never a drop — the room is
    the lesson's, and switching a dynamic must not make thirty people rejoin.
- **A comment can ship without the line it describes.** `nextRacePrompt()` still read
  `if(raceMode==='h2h') askPhones(…)` under a paragraph explaining that timed rounds
  ask too — the previous commit's prose landed and its one-line change did not, and
  the suite caught it only because a *different* test run happened to include it.
  Fixed; timed rounds ask now.
- **Anything above the board must re-fit it, and the buzzer chip wasn't.** The chip
  sits *in* the layout above the stage, and it changes height on its own schedule:
  opening a room is asynchronous, so it appears **after** the board has been fitted,
  and it grows again as phones join and as buzzers go live. Nothing re-fitted, so the
  board kept the height it had when the chip wasn't there and everything below was
  pushed 19px off the bottom — Millionaire's "Final answer?" and the last rung of the
  ladder — with `body.play-fit`'s `overflow:hidden` making it unscrollable. Found in
  class, not by a test. `renderBuzzChip` now measures around its own redraw and calls
  `hook('onResize')` only when the height actually moved. The replies panel already
  did this (`repliesHost`); the chip is the same case and was simply missed — **so the
  rule is the layout, not the widget: anything that can occupy vertical space above a
  board owes it a re-fit.**
- **Hover was out-specifying the locked-in answer.** `.m-option:hover:not(:disabled)`
  beats `.m-option.picked` on specificity, so the option a teacher had just clicked
  kept its hover paint for as long as the pointer stayed on it — which is precisely
  when they are looking at it. Both hover rules now carry `:not(.picked)`. The check
  compares **hovered-and-picked against hovered-and-not-picked**: comparing a picked
  option against a resting one passed on the broken build, because a hovered option
  always differs from an unhovered one.
- **The team bar rides in the header now, not across the bottom of the board.** It
  was `position:fixed` at the foot of the screen and covered the one thing a
  classroom display cannot spare. It now sits in `.header-right` beside the timer,
  styled to match it, above the geo-band. **Measured, not assumed** (Millionaire,
  1280×720): chrome 163px → **80px**, and the header itself went 94px → 80px, so the
  board gained 83px and the strip got *smaller*. On a 390px handset chrome went
  185px → 139px. The timer, Lab and New game each gave up a few pixels to pay for it.
  - **`Kit.floorTop()` is the one definition of the bottom edge**, and it exists
    because this fact was written down in four places — the fit, and three separate
    layout assertions — so moving the bar meant four right answers and any one could
    be missed. It returns the bar's top only while the bar is actually `fixed`, and
    the viewport bottom otherwise. `fitToScreen`, `showResult`'s clearance and every
    layout test ask it.
  - **Nothing in the header may wrap; everything shrinks.** Wrapping is precisely how
    the strip grew — title 384px + cluster 883px is 45px over, so the cluster dropped
    to a second row and the header went 72px → 130px. The title absorbs the whole
    shrink (`flex:1 1 auto`) and the cluster none (`flex:0 0 auto`); the eyebrow
    ellipsises, the bar scrolls sideways. Sharing the shrink even 20:1 still took 4px
    off the cluster, which was enough for the bar to clip its own Reset button.
  - **Below 1100px the cluster takes its own header row**, and below 760px the bar
    takes one within it. A percentage `flex-basis` on a child of a shrink-to-fit
    parent is circular — that threw the page **679px off its right edge** on a phone
    and read as "the bar overflows" when it was "the bar asked its parent how wide it
    was while the parent was asking the bar". `min-width:100%` breaks the loop.
  - **A malformed CSS comment silently deleted the rule that mattered** and cost a
    debugging round: an edit left a paragraph outside its `/* */`, the parser
    discarded everything up to the stray `*/`, and the header behaved as though the
    rule had never been written. CSS fails silently — there is no syntax error to
    see. If a rule appears to do nothing, check the comment above it before the rule.
- **Millionaire answers in two beats: pick, then "Final answer?".** A click nominates
  an option — yellow, pulsing, nothing revealed and nothing scored — and the reveal
  waits for the button. Until then another click *moves* the nomination and any
  lifeline throws it away, which is the point: the pause is where the room gets to
  talk the team out of it. Setting `mFinalAnswer` (Millionaire group, default on);
  off restores the old one-click reveal. Implementation note: `onOptionClick` now only
  nominates, and `revealMillionaire(opt)` holds everything that used to follow it —
  so the steal path, which reopens the question, gets both beats for free.
- **A buzz means whatever `mBuzzRole` says it means, in Millionaire.** The tile games
  (Jeopardy, Blockbusters) already let a buzz pick the answering team; Millionaire's
  ladder is per-team with a fixed turn order so every team gets a full arc, and
  "fastest thumb wins" cuts against that on purpose. Three behaviours, all offered:
  `speaker` (default) — the buzz picks who answers for the team already on turn, and
  a buzz from the other team is refused and the room re-armed so the entitled team can
  still get in; `floor` — whoever buzzes first takes the question onto their own
  ladder, like the tile games; `off` — the buzz is shown on the chip and changes
  nothing, which is what buzzing in Millionaire did before this setting existed.
- **Race timed rounds now actually ask the phones.** `nextRacePrompt()` had
  `if(raceMode==='h2h') askPhones(...)`, so a timed round ignored `phoneMode`
  entirely — picking "everyone types" for a timed round left the phones idle with
  nothing saying why. Timed rounds ask now too; `raceCanTry()` restricts a timed
  round's buzz to the team whose round it is, so a phone on the bench can't steal a
  word off someone else's score.
- **Deployed.** The build stamp is in the three shells and `join.html`; ⚙ reports
  whichever one is actually running, which is how a stale shell announces itself.
- **The settings drawer is how a dynamic gets tried.** ⚙ during play (or `L`) opens
  the docked drawer for the game being played, without leaving the board — see "One
  gear, two forms" above. It exists because prototyping was the bottleneck:
  comparing two ideas meant ⚙ → find the right tab → change → close → restart, and
  by then the round was over. Everything registered shows up in it for free, so the
  next dynamic is a `S.register` call and nothing else.
- **Works on a phone as well as a computer**, and both are enforced by the layout
  contract above rather than assumed — see "Screens: one layout contract". Jeopardy
  scrolls sideways on a handset with legible columns; Millionaire's ladder is a
  horizontal strip; chrome is 198px instead of 323px. **Verified only in Chromium's
  device emulation** — real handset browser chrome (URL bar, gesture area) shrinks the
  visible height further and changes it as you scroll, which nothing here models.
- Game Hub MVP live as **one consolidated app** (`game-hub.html`): choose unit →
  game → sections → play. **2 units** (Unit 4 Consciousness, Unit 5 Fairness),
  **4 games** (Jeopardy, Blockbusters, Race to the Board, Millionaire), shared engine,
  DCU-branded. 3 of the 4 are spec Tier 1 — content-agnostic, so they transfer to any
  unit, which is what makes the "this scales to the coursebook" claim defensible.
- **Race to the Board** (Unit 5 only so far, 48 prompts across 5A–5C): target words
  scattered across the screen, teacher reads a **gapped sentence**, a student runs to
  the projector screen and touches the word, teacher clicks it on the laptop.
  **Two modes**, picked on the content screen:
  - **Head-to-head (default)** — both teams at the board, first touch wins. The engine
    can't know who touched, so after a correct click you say who got it: click the team
    chip or press `1`/`2`. Wrong touch = red flash, sentence stays up so the other team
    can steal. No clock; ends when the board is cleared.
  - **Timed team rounds** — one team per 60s round, then the board passes on. Wrong tap
    advances and the sentence returns to the queue later.
  - Board caps at 18 words and **re-scatters after every claim** so position can't be
    memorised; a jittered-grid layout guarantees no overlap and shrinks the type
    (`--rs`) if the field is too small. Claimed words carry the team's colour.
    **One word per cell is not sufficient on its own** — two things broke it once
    the banks grew longer words. The ±1.5° tilt makes a 288px-wide tile ~8px
    *taller* than its layout box (the growth is proportional to **width**, so it is
    the long words that collide vertically), and unrestricted jitter lets one word
    sit hard against its cell's right edge and the next hard against the following
    cell's left edge. Cells are now sized to the **rotated** box and a 12px gutter
    is withheld from the jitter. Verified over 240 randomised scatters at four sizes.
  **Distractors aren't authored** — every other word on the board is a real target
  word from the selection. Spec §4.4 updated to match as-built.
- **Millionaire** (Unit 5 only, 52 questions across 5A–5C): four
  options, rising difficulty, teams take turns. Decisions taken, all recorded in
  spec §4.4:
  - **Parallel ladders, interleaved turns** — settles the open question in §9.5.
    Each team climbs its own 8 rungs (100/200/300/500/800/1200/1600/2000) so
    everyone gets a full arc, but the turn passes every question so nobody sits out.
  - **Additive scoring, so no safe havens.** §4.4 wanted safe havens to stop a late
    mistake wiping a team out; never deducting solves it more simply and keeps the
    shared team bar consistent. Wrong = lose the turn, retry that rung later with a
    different question.
  - **Lifelines**, one use each per team, switchable off: **50:50** (state lives on
    `mCurrent.removed`, so a re-render can't wipe it), **Ask the class**, and
    **Confer** (runs the header timer).
    **Counting is not the same as having counts** — `mCounting` vs `mTally`, and
    conflating them dead-ended the round in class. While the teacher taps hands a
    click adds a hand; once the count is in, a click has to *answer*, or the votes
    sit on screen with no way to play them. Two consequences: with phones voting
    there is no tapping at all, so the board is never a tally pad; and **Done
    counting keeps the numbers**, because they are what the team is deciding on.
    **Ask the class is a phone vote whenever there is a room** — not a `phoneMode`
    to pick, see Current status — and hands in the air when there isn't.
  - Every section covers all 8 rungs, so one section fills a ladder (§3.4).
- **Persistent shared team bar** on every screen: team names + points survive
  moving between games, units, and setup screens (nothing resets on navigation).
  Both games feed one score — Jeopardy awards the tile value to the selected team;
  Blockbusters awards +1 per claimed hex to Yellow/Blue (teams[0]/[1]).
- **Blockbusters knows when someone has won.** A completed line used to do nothing
  at all. `bbOutcome()` runs after every claim: BFS over the honeycomb for a
  connected route, then the winning hexes light up and a banner names the team.
  - **Adjacency comes from `BB_ROWS`, not hard-coded.** A row is inset by
    `(widest − size)/2` columns — exactly what the layout does with `startX` — so a
    hex's position across the board is `inset + col`, and two hexes touch at a
    distance of 1 within a row or ½ between rows. Change the board shape and the
    win logic follows.
  - **An edge is the board's extreme, not the end of a row.** Counting a short row's
    end hex as an edge let yellow "win" with a line floating mid-board touching
    neither side. Restricting yellow to the long rows also restores the real game's
    asymmetry — yellow needs 5 hexes, blue 4.
  - **Blocked is an ending too**: when neither team can reach its far side even
    using every unclaimed hex. Mostly catches a board short of clues.
  - **The glow is the winning team's colour.** The board sits on a white page, so a
    white halo is invisible and a brightness flash on yellow just washes it out.
    `BB_GLOW` in the engine and `.hex.route.claimed-*` in the CSS must stay in step.
  - The route animation is a **variant** (`bbWinRoute`: `trace` / `pulse` / `off`),
    registered in `Kit.anim` under `winRoute`. Each takes the glow colour and
    returns how long it will run, so the banner waits for it to land.
  - `showResult({eyebrow,title,sub,tone,actions,onShow,onHide})` is the shared
    end-of-round banner — the next game that reaches an ending writes no markup.
    It's a banner, not a modal, so the board stays visible; Blockbusters is the one
    board not sized to fit the screen, so `bbFitAroundBanner()` scales it into
    what's left rather than letting the banner cover the route it just lit.
  **↺ Reset points** zeroes scores but keeps names; +/- for manual correction;
  rename + add-team; active-team / whose-turn highlight.
- Teacher **countdown timer** in the header on the play screen (start/pause, reset,
  ±15s, red under 10s).
- **Boards fit the screen — never scroll.** Jeopardy (`fitJeopardyBoard`) and Race
  (`scatterRaceWords`) measure the space left between the header and `Kit.floorTop()`
  and size themselves to it, scaling their type down if needed; `body.play-fit` drops
  the body padding while they're up. Both re-fit on resize.
  **`Kit.fitToScreen` subtracts ancestor bottom padding**, because that padding sits
  *below* the element and so is space the element still needs. Skipping it slid Race's
  last row 3px under the team bar the moment the game-show stage added its own
  padding — visible at 1280×720 only, which is why this is measured rather than
  covered by a bigger fudge factor. Jeopardy tiles used to
  take their height from a fixed 3:2 aspect ratio, so fewer categories meant taller
  tiles and up to 1400px of hidden board — don't reintroduce a fixed aspect ratio.
  Blockbusters is the same lesson in a different disguise: `layoutBlockbustersBoard()`
  spaces the hexes from their **rendered** width (a `vw` clamp), so it must run after
  `showScreen('screen-play')` — measuring behind a hidden screen returned 0, fell back
  to a hard-coded 90px step, and the hexes overlapped by 21px at 1440px wide. Building
  and laying out are separate, and positions come from `data-row`/`data-col`, so a
  resize repositions without rebuilding and claimed hexes keep their colour.
- **Phones — run one class, learned one thing.** Students open `join.html` (or scan the
  QR), enter a 5-digit room code + name + team. Everyone connected first time; the
  dynamic itself was the problem — a room of buzzers **just makes everyone mash the
  button as fast as possible**, which is a reflex test, not a language one. So what the
  phones do is now **one `phoneMode` variant, not several toggles**: `off` / `buzz` /
  `write` / `type`. They began as independent booleans and immediately contradicted each
  other — with typing and buzzing both on, one had to silently win, decided by a
  hard-coded precedence nobody could see. **A dynamic is a choice between iterations**,
  which is a variant. `phonePrompt` decides whether the question appears on the handset
  at all (off keeps their eyes on the board), and `phoneOneEach` stops the fastest thumbs
  owning it.
  - In **Race to the Board head-to-head** a sentence arms the buzzers; the first buzz
    takes the floor and *carries the team*, so a correct word scores automatically and the
    "who touched it first?" chooser never appears. Wrong word = no penalty, buzzers
    re-open for a steal.
  - **The mode decides in every game — including Race, which used to be exempt.**
    Race head-to-head opened a room and armed buzzers *whatever the setting said*, a
    leftover from when buzzers were a Race-only feature. That made "Nothing — phones
    idle" a lie in the one game phones were actually used in, and made every other
    mode unreachable there. **Behaviour change:** Race now needs `phoneMode` set to
    `buzz` (or `type`) before phones do anything, the same as the other three.
  - **Every mode reaches every game through `askPhones`, and that took a bug to
    establish.** Race armed a buzzer *directly*, so `phoneMode` had no effect on the
    one game phones were actually being used in — picking "everyone types" kept
    handing the room a buzzer. Millionaire never called `askPhones` at all. Two
    things that had to follow:
    - **The replies panel goes where the question is.** It was hard-coded to the clue
      card, which Race and Millionaire do not have, so those games collected answers
      and the room saw nothing. `repliesHost()` picks the card when a clue is open and
      the game's own question area otherwise, and the board re-fits, because thirty
      answers is several rows of panel.
    - **Opening a room is asynchronous.** Millionaire deals its first question inside
      `start()`, before the code has come back — so that question was asked before
      there was anybody to ask. `reaskPhones()` runs when the room is ready.
  - **One room per lesson, not per game.** A room used to be torn down with the game,
    because that is where its code happened to be created — so changing games minted a
    new 5-digit code and the whole class had to rejoin, rescan and retype their names
    mid-lesson. There are two different things and only one of them is "close":
    **park** (nothing for the phones in *this* game — disarm, keep everyone joined,
    and the chip says `idle here` rather than showing a live-looking code above a room
    with nothing to do) and **drop** (the feature is switched off or the relay address
    changed, which is the only thing that ends a room). Leaving a game parks.
  - **A student who joins mid-question lands in it.** The relay sends the room's live
    state with the `joined` event and the phone runs the same path an arm does.
    Students trickle in — late, wrong WiFi, locked phone — so "you see nothing until
    the next question" is the common case, not the edge case.
  - **The teacher sees what was typed, right or wrong** — the strip carries the name,
    the word in quotes, and a verdict. A miss is the most useful thing on it: who is
    nearly there, and how, is exactly what you would want mid-round. It survives the
    re-arm for the same reason. **Everything the class does goes in that one strip**,
    the same one in every game — see Current status.
  - **`type` is the answer to that class.** The student writes the word, *then* buzzes:
    the button is dead until the box has something in it, so the race is to **produce**
    the word while still reading the board. Judged on the host and only there — the relay
    never learns the answer, so it can never be asked for it. Three decisions, all
    switchable:
    - **A miss costs time, not points** (`typeCooldown`, default 3s). That phone alone
      waits it out while the room stays open, which is why the re-arm is a **`reopen`**:
      a plain arm clears the box, and clearing it throws away the half-word somebody else
      was racing to finish.
    - **Three verdicts, not two.** `Kit.answer.judge` returns `right` / `close` / `wrong`;
      `close` takes the floor and tells the phone to check its spelling, unless
      `typeStrict` is on. "Produced the word but mis-spelled it" is a different fact
      about a student from "didn't know it", and the room should hear it differently.
      Tolerance scales with length (0 under 5 letters, 1, then 2 from 9), and **no two
      answers in either Race bank are within it** — a smoke check, because a collision
      would hand somebody the wrong word.
    - **The phone does not spell it for them** — `autocorrect`, `autocapitalize` and
      `spellcheck` are all off, or the handset finishes the word.
    - **In Race the typed word is the claim**: the student named it, so it scores without
      the teacher clicking. A plain buzz still needs the click, because a raised thumb
      doesn't say which word they meant. Not offered in Millionaire, for the same reason
      it never gets an anagram — four options hand you the word.
    - **A verdict has to outlive the next question.** Race re-arms the instant a word is
      claimed, so "Yes!" lasted about a frame; it now holds for 1.5s over anything the
      next arm wants to say.
  - Phones never talk to the laptop directly — school WiFi blocks that. Both ends
    connect out to `tools/buzzer-relay.js`, the same shape as Kahoot.
  - **The relay serves the site too, deliberately**: an https GitHub Pages page may not
    talk to a plain-http LAN relay (mixed content). So the relay's own address is the
    one to use in class — for the hub *and* the join page.
  - **Deploying it is the intended setup** (`Dockerfile` + `render.yaml`, Render
    blueprint): one https origin serves hub + join + relay, nothing runs on the
    classroom laptop, and it survives WiFi that blocks phone→laptop traffic.
    Running `node tools/buzzer-relay.js` locally is the no-account alternative.
    **Buzzers can never work from the GitHub Pages URL** — no relay behind it; the
    bar says so explicitly.
  - **Everything degrades**: buzzers off, relay dead, or WiFi gone → the hub behaves
    exactly as before with the manual chips / `1`-`2` keys. Verified for all three.
- **Game show mode is the default**, on all four games *and* the setup screens.
  `theme` is a variant setting (`gameshow` | `dcu`); `body.theme-gameshow` is applied
  by `applyTheme()` from `showScreen`, so it covers unit-select, game-select and
  section-select too — a lit board reached through a white setup screen loses the
  moment before it starts. `themeOf()` resolves to the active game's setting once one
  is chosen and the **master** value before that. DCU is one switch away and is pure
  override — nothing in the base stylesheet changed.
  - `.lit` marks *a stage being played* and is cleared on leaving the play screen, or
    a stale one lights up again the next time that panel is shown.
  - **The game-selector icons animate what their game does** — Jeopardy's tiles light
    along the diagonal, Blockbusters' inner hex pulses inside the outer, Race's bars
    run left-to-right, Millionaire's ladder climbs. Pure CSS on the existing SVG
    children keyed off `.game-card[data-game]`, so there is no new markup and adding
    a game's icon animation is one rule. Hover speeds up only that card's icon.
  - **`--tension` is the whole idea.** `mTension()` turns the rung the team is
    playing for into one 0–1 number on `#play-millionaire`; the CSS reads it to
    close the spotlight in and pull the wash from blue towards red, and the
    think-music bed reads it for tempo and filter. One number, both halves of the
    atmosphere. Adding a mood to some other beat = another CSS rule, no new state.
  - **Sound is still all synthesised** (offline). New: `Sound.bedStart/bedSet/bedStop`
    (a looping bed with an LFO heartbeat — it plays only under a live unanswered
    question, so it never runs while the teacher reads out a result),
    `Sound.applause` (filtered white noise, not a sample), `Sound.fanfare`
    (detuned sawtooth through a lowpass), plus `lock` / `klaxon` / `sting` voices.
    Original riffs, deliberately not the shows' own music.
  - **Title sequence**: `INTROS[game]` holds the copy and accent colour, `runIntro()`
    plays one shared sequence and resolves when it ends *or* is skipped. Adding
    Jeopardy's ident is an entry in `INTROS`, not another animation. It plays over
    the finished board, so skipping drops you into a game already running.
    `intro` setting: once per session (default) / every round / off.
  - **Nothing flashes faster than ~1.5Hz** and no flash is full-screen white — this
    is projected at students whose medical histories you don't have. Every animation
    in the skin is switched off under `prefers-reduced-motion`, which also shortens
    the intro to a still card rather than removing it.
  - Escape is deliberately *not* the skip key — it belongs to the settings panel.
  - **Each game gets its own signature, not one sparkle applied four times.**
    Millionaire: gold, chase lights down both sides, a spotlight closing in.
    Jeopardy: blue starfield, gold-on-navy tiles, a board that **deals itself in**
    on the diagonal (`jDeal`). Blockbusters: violet honeycomb lattice — violet
    because yellow and blue are *game state* on that board and both have to stay
    legible — with the hexes assembling themselves (`bbDeal`). Race: floodlit green
    track with lane markings, words flying in, and a **starting pistol** the moment
    a sentence goes up (`Sound.crack` — the same noise buffer as the applause, but
    the envelope is the whole sound: 3ms of attack through a highpass).
  - **`--tension` is one contract fed from three different places**, which is the
    whole trick: Millionaire's rung; Jeopardy's *value at stake* over a floor that
    rises as the board empties; Blockbusters' **distance to a finished line**
    (`bbStepsToWin` — Dijkstra, your hexes free, unclaimed cost the question you'd
    have to answer, the opponent's are walls; one hex from a win reads 1.0); and
    Race's **board cleared plus whether a race is live this second** — the only one
    with two ingredients, because a sentence going up is when students leave their
    chairs. A fifth game needs a new source, not new plumbing.
  - **Stagger on `row+col`, never DOM order**: a 12×6 Jeopardy board is 72 cells,
    and a flat stagger runs for 3 seconds with the class waiting on it.
  - **`--title-vw`** exists because a four-word title at the shared 11vw cap runs
    off the screen. When measuring the title in a test, wait for the slam to land:
    it holds at `scale(2.4)` through its delay, so an early rect reports it two and
    a half times its real width.
  - **Two specificity traps, both already paid for.** `body.theme-gameshow
    #play-blockbusters.lit .hex.claimed-gold` out-specifies `.hex.route.claimed-gold`,
    so the skin silently cancelled the winning-route glow until the route rules were
    scoped to `.lit` too. And setting `border-color` on the themed `#result-card`
    out-specifies `.tone-silver`, painting a blue team's winner banner gold. Both
    have smoke-test checks.
- **A cleared Jeopardy board now ends the game** — `jFinish()` ranks the teams,
  handles a tie, and raises the shared `showResult()` banner. Theme-independent;
  the game-show skin just adds the fanfare and applause on top. Same gap
  Blockbusters had.
- **The clue card is skinned and flips correctly.** It had *zero* game show rules, so
  a lit board opened a white DCU card; the value face now takes the Jeopardy tile's own
  gradient, so the card reads as that tile rising off the board. It sits outside the
  stage and so cannot inherit `--tension` — `openClueCard` sets it, and a `$500` clue
  arrives hotter than a `$100`. DCU is untouched, and a check asserts both directions.
- **Settings panel** (⚙ in the header, Esc or click-away to close), built from a
  registry so a new feature's switch appears by registering it — see "Adding a
  feature" above. Currently: sound on/off, volume, race re-scatter, race round
  length, race section tag. Saved per device; **Reset to defaults** restores all.
- **Sound effects** — synthesised with Web Audio (no audio files, so offline still
  works): rising tone for right, buzz for wrong, chime on a Blockbusters claim,
  fanfare on a cleared board, low tone when a timed round expires, a swoop on the
  card flip and a chime on the answer reveal.
- **Card animation** is a **variant** setting, per game, switchable mid-game:
  **`morph`** (the default) reads the shape of whatever was clicked via `Kit.shapeOf`
  and unfolds from it — a genuine hexagon in Blockbusters, the tile's own corner
  radius in Jeopardy, and any future board shape for free. `grow-turn` is the previous
  behaviour, `turn-only` has no travel, `rise` avoids 3D entirely (the fallback if a
  machine stutters), `off` opens instantly. Registered in `Kit.anim`.
  Two things that will bite: **clip-path is animated on the two faces, not the card** —
  on an element with `transform-style:preserve-3d` it flattens the 3D and kills the
  flip; and the shape is measured **against a face**, because the corner rounding lives
  there, so measuring the card would morph the corners square.
- **Card flip** (Jeopardy + Blockbusters): clicking a tile grows the clue card out of
  that tile and turns it over — front face carries the tile's own `$400` / letter,
  back carries the clue. Uses the Web Animations API against the live element rects
  (`openClueCard` / `closeModal` in hub-engine.js), so it lands on the right tile at
  any board size. Shape: **grow at full value, then turn** (open, 1150ms); answer →
  **550ms hold**, turn back to the value at full size, hold, then settle into the tile
  (close, 1000ms). `flipSpeed` scales all three. Four things that will bite if touched:
  - **Ease each keyframe segment, not the whole run.** One curve across the lot makes
    the early phase rush and the hold on the value vanish.
  - **Rotation segments must be `linear`.** An eased turn puts peak angular speed
    exactly at the edge-on point, where the projected width collapses — so the card
    snaps through. Constant rate roughly halved the worst per-frame jump (206px → 85px).
  - **The closing animation needs `fill:'forwards'`.** Without it the card reverts to
    full size for one frame before the modal hides, which reads as "it warps back in".
    The landing segment must also *decelerate*; an accelerating curve there was the
    other half of that complaint.
  - **The faces are swapped explicitly, not by `backface-visibility`.** That guard was
    real but inactive for the whole animation — `.flipped` is added in `onfinish`,
    after the turn is over — so captured frame by frame the value was painted
    **mirrored from about 100° to 180°** on every variant, ~135ms each time a clue
    opened. Hiding it then exposed what it had been covering: the clue face was not
    painted during the turn either, so the card went **blank for four frames**.
    `backface-visibility` was culling the face that should have shown while leaving
    the one that should not, so it is gone from both faces. `guardFace()` swaps them
    at the edge-on frame; each variant declares `edgeOn:{open,close}`, and the guard
    **takes its timing from the animation the variant returned**, because `turn-only`
    runs at `ms*0.8` and `rise` at `ms*0.5` and a fixed figure left one mirrored frame.
    Separate z planes (`translateZ(2px)`) and the `.flipped` rule both stay.
  - Measure with `naturalRect()`, never a live `getBoundingClientRect()` — a rotated
    card reports its *projected* box, and the maths then lands it off its tile.
  Honours the `cardFlip` setting **and** `prefers-reduced-motion`; with either off it
  opens instantly, exactly as before.
- **Spent Jeopardy tiles keep their value, faded, and stay clickable** — clicking one
  reopens the clue with the answer already showing, marked "· review" in the topline,
  with no scoring buttons. Nothing about the game state changes.
- DCU reskin: light theme, geometric band, uppercase grotesk, game-card icons.
- To change unit mid-session: game screen → "New game" → "Change unit".

## Next
- **Ordering as a clue is the next dynamic, and it is the harder one.** Grouping
  worked because a set has no order: judging it is a comparison, and every team can
  assemble one at once from a pool the relay already knows how to hand out. A
  thermometer clue has to model a *sequence* — which slot is being filled, what a
  partially-built ladder looks like on a card the size of a clue, and whether the
  room fills it cold-end-first (a walk, so one team at a time) or all at once. The
  relay needs nothing new; the shape does.
- **Nothing on the bench or in the Lab has met a class, and the guessed numbers are
  piling up.** The 700ms settle and the 4-mistake budget from the bench, Story
  Reveal's 5→3 drop, and now the grouping clue's 700ms take-beat and its
  eight-words-four-to-find. Eight may be too many to read from the back of a room;
  the only way to find out is to play it.
- **Type-then-buzz has never met a class.** It is built, switchable and tested, but every
  number in it is a guess: 3 seconds for a miss, one letter of tolerance at five letters,
  spelling forgiven by default. Run it against plain `buzz` from the Lab between rounds —
  that is what the drawer is for. The specific unknowns: whether thirty phones typing
  kills the pace, whether the cooldown feels like a punishment or a pause, and whether
  students look at the board at all once there is a box in their hand.
- **The shell can strand a user on old assets.** `game-hub.html` carries no cache stamp
  of its own, so a browser holding it loads the previous build silently — see "Run".
  Give the shell a `Cache-Control` meta of its own. Small, and it removes a whole class
  of "it didn't deploy" confusion.
- **More typed items, especially Millionaire's.** The three new question forms work but
  sit at 4.1% of the content, so a round can pass without meeting one. Mechanism done,
  content thin — see "Question forms are a registry too".
- **A phone check on a real handset**, not Chromium emulation. Jeopardy sideways-scroll
  is the part most likely to feel wrong under a thumb.
- **Content composability is the open architectural question**, and it is a project
  rather than a refactor. Today each game has its own bank shape (`jeopardyBank`,
  `blockbustersBank`, `raceBank`, `millionaireBank`) and the content gate *enforces* no
  shared prompts — deliberate, because answer shape genuinely differs (Blockbusters needs
  a one-word answer whose initial matches its hexagon, Race needs unique single words,
  Millionaire needs four options). The composable version is one pool per unit with items
  declaring what they are (`{text, answer, options?, forms:[…]}`) and each game declaring
  what it can consume, so the engine matches items to games instead of four banks being
  authored by hand. That roughly halves authoring cost — the metric the demo pitch hinges
  on — but it migrates 565 items, so extend the content gate first.
- **Jeopardy at 16 categories is legible, not comfortable** (10.5px headings at 1280px).
  Either cap the categories per board or nudge the teacher toward fewer sections on the
  content screen. Not a CSS problem.
- **Buzzers need a real class.** Only ever driven by scripted browsers. Unknowns:
  latency on real handsets, whether the school WiFi allows the LAN route at all
  (one-minute test in `docs/buzzers.md`), and whether phones are a net win or a
  behaviour problem. Not wired into Jeopardy/Blockbusters yet — picking which team
  answers a tile is the obvious next use.
- **Sound is a first pass** — five synthesised cues. Worth checking on real classroom
  speakers; if they're thin, the fix is a richer envelope, not sample files (offline).
- **Race to the Board — head-to-head + full-screen scatter shipped; awaiting a real
  classroom run.** Variations discussed but not built, roughly in priority order:
  **relay** (each team lines up, one student per sentence — stops the two fastest
  students owning the game), **wager** (call 1 or 3 points before hearing the sentence),
  **class vs. the clock** (no teams, one shared score), **sweep** rounds ("touch *all*
  the words to do with punishment"), **director & toucher** (one student directs another
  by language alone — highest speaking value of the lot), and further prompt types that
  reuse the same mechanic for free: definition, word-form change, collocation, odd one
  out, error correction, pronunciation/stress. Deliberately not built: continuous drifting
  words — the teacher has to click a moving target while a student shadows the beam.
- Author Unit 4's race + millionaire banks (4A–4D); Unit 4 still shows only
  Jeopardy + Blockbusters.
- **Millionaire authoring cost is now measurable**: 36 four-option questions for one
  unit — the single biggest content job so far, and the number to quote when asked
  what a unit costs.
- **The phone dynamics still to try**, now that a vote is a shared service and can
  belong to one team: a **confidence wager** in Jeopardy (1/2/3 before the clue turns
  over, paid at that multiple — a vote, quiet, and individual rather than a race);
  **buzzers to pick which team answers a tile**; an **exit ticket** at the end-of-round
  banner, which would be one `onFinish` hook plus `write` mode and would reach every
  game including future ones; and **personal scorecards**, the big one, because it
  means the relay holds state across questions.
- **The Race "director" dynamic is the highest language value and the least code** —
  the sentence goes only to the seated students' phones, never the board, so they
  have to talk the runner onto the word without saying it. Worth running verbally in
  one lesson before building anything.
- Measure authoring cost per unit (the number the demo pitch hinges on). Race is the
  cheapest data point so far: 36 prompts, no distractors.
- Fill Unit 4's Jeopardy gap — the card claims 4A–4D but only 4A/4B have categories.
- Small wins: "steal" in Blockbusters (wrong → other team claims); self-host fonts
  for true offline — also what a chunkier display face for the game-show wordmarks
  would need.
- **Game show mode is now on all four games and has never been in front of a class.**
  That is the gap: check the music bed isn't fighting the teacher's voice on the
  classroom speakers, whether the title sequence is still welcome by the fourth
  round (the once-per-session default is a guess, not evidence), and whether the
  lights lift the energy or tip a class over. Adding a fifth game's ident is its
  name in `theme`'s and `intro`'s `games` arrays, an `INTROS` entry, its stage rules
  in the skin block of `hub.css`, and a source for `--tension`.
- Product-line decision: is the Game Hub now the product, with #2/#3 as legacy?

## Constraints
- No build step; must run by opening a file. Fully offline (use `<script src>`,
  not `fetch`, which browsers block on `file://`).
- Works on a standard classroom TV/browser; large fonts, high contrast, readable at distance.
- Teacher controls everything; students never touch the device. (Race to the Board is
  the one game students are physically involved in — they touch the *projected image*,
  which isn't a touchscreen, so the teacher still does every click.)
- Repo is **public** — don't commit anything that shouldn't be internet-visible.

## Before you push — gate by blast radius, not by habit
**Match the check to what the change can break.** A 25-minute gate on every change is
a gate that gets skipped or truncated, which is worse than a smaller one that actually
runs. Pick the row, run it, push.

| What you changed | Run this | Costs |
|---|---|---|
| **Content** (a bank, a unit file) | `--only=content` | ~20s |
| **One game's own logic** (board, its `tension()`, its stage CSS) | `--only=<game>` | ~40s |
| **Shared layer 1** — `hub-kit.js`, the header, the team bar, the clue card, `hub.css` outside one stage, settings, the fit | `--only=millionaire,fit,phone,card,turns,gameshow,lab,registry,competition` | ~4 min |
| **A playground page** (`playground/*.html`, `bench-kit.js`, `lab-forms.js`) | `--only=playground,promptlab,bench,qbench` | ~1 min |
| **A question round** (`hub-rounds.js`, `hub-rounds.css`, `rounds/*.js`) | `--only=qbench,grouping,card,gameshow` | ~4 min |
| **The Lab board** (`unit-lab.js`, `game-hub-lab.html`, a clue that runs a round) | `--only=grouping,content,jeopardy,card` | ~2 min |
| **Phones / relay** — `hub-buzzer.js`, `buzzer-relay.js`, `join.html` | add `,buzzers,phonemodes,teamvote,phoneteams,degradation,reconnect,playground,bench` | +6 min |
| **Before a lesson you will actually teach from**, or on request | the full suite | ~25 min |

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=millionaire,fit,phone   # the usual
NODE_PATH=$(npm root -g) node tools/smoke-test.js                                # 51 suites
```

**Two cheap pre-flights that cost seconds and have each already paid for themselves:**
```bash
node tools/check-syntax.js          # JS parses, CSS comments/braces balance
```
A malformed CSS comment **silently deletes every rule after it** — the parser skips to
the next `*/` and there is no error anywhere. That cost a debugging round on the team
bar: the header behaved as though the rule had never been written. CSS has no compiler
to catch this, so this stands in for one.

**Push straight to `main`.** Render redeploys in ~40s and GitHub Pages follows, so the
phone can check it immediately. Bump the cache stamp or the phone will not see it.
Drives all four games in a real browser and checks the things that have actually
broken before: boards running off screen, text cut off, the flip landing on the wrong
tile, settings not persisting, buzzers not degrading when the relay is gone. Starts its
own relay, exits non-zero on any failure. `--url=` tests a deployed copy instead.

**Do not pipe it through `tail` in a way that swallows the exit code** — `node … | tail`
reports the *pipe's* status, so a red run looks green. Redirect to a file instead; you
also get progress while it runs, which `tail` denies you for 15 minutes.

**When a shared behaviour changes, grep for the assumption before re-running.** Three
separate helpers in the suite compared `#m-question`'s text against the raw prompt, and
`Kit.prompt` rendering `___` as a blank broke all three. They were found one at a time
across three full runs, because each was treated as a one-off. The lesson is *search
for the duplicate*, not *run everything* — three full runs did not find them any faster
than one grep would have. Better still, give the fact **one home** so it cannot be
duplicated: that is what `Kit.floorTop()` is, after the same thing happened again with
the bottom of the board written down in four places.

## Verifying UI changes
Playwright + Chromium are available (global `playwright`, browser at
`/opt/pw-browsers`). Open a hub via `file://…` and exercise it to confirm changes
render and play before committing.

**Screenshot it, don't only measure it.** Numbers said Millionaire's ladder cleared the
options by 22px; the screenshot showed `100` stranded alone on a second row reading
`200…2000` then `100`. Both facts were true — the assertion was answering a question
nobody had asked. A layout change is not verified until it has been looked at, at the
size it broke.

**Prove a new layout test fails on the bug it was written for**, by reverting the fix and
re-running. Twice this session a test passed on the broken build: once measuring a
container instead of the elements overflowing it, once because a different change had
already freed enough room. The second case also showed a "fix" that did nothing —
`floor:true` never fired until a 360×560 viewport was added, and only then earned
its place.

What the agent can and cannot check: stills, layout and text, yes. **Motion is not
visible to it** — animation is inferred from computed styles and timings, never watched.
**Audio is entirely unverifiable**; every `Sound.*` claim in this file rests on the code
being correct, not on anyone having heard it.
