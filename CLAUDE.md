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
| skin (chrome + setup screens), team bar, scoring, timer, clue card + flip variants, `showResult()` banner, every `Sound.*`, every `Kit.*`, content-integrity gate | `card` (icon/blurb/badge), `intro` ident, `hasBank`, the settings `games` arrays via `gameIds()` | board logic, stage CSS, `tension()` source, content bank shape |

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

**Four forms are registered.** `gap` is inferred from `___`; the other three need an
explicit `type:` on the item, because inferring them would silently re-type the items
authored before they existed. Each parses what it needs out of the prompt, exactly as
`gap` reads `___`, so **the item shape stays `{text, answer, type}` and adding a form
touches no game and no content field** — only the authoring convention for its own
prompts:

| Form | Author it like this | Suits | Reveal |
|---|---|---|---|
| `gap` | `"held in ___"` | all four | the answer drops into the blank |
| `anagram` | `"Unscramble: the decision a jury delivers."` + `answer:"Verdict"` | jeopardy, blockbusters | the letters re-sort into the answer |
| `oddoneout` | `"Which does NOT belong: verdict / jury / sabbatical"` | jeopardy, blockbusters | the odd chip lights, the rest stand down |
| `errorfix` | `"You *must to* wear a helmet."` + `answer:"must"` | jeopardy, millionaire, race | the struck words swap for the answer |

The separators are load-bearing: **`/` between odd-one-out candidates** (with an optional
lead-in before a `:`), and **`*asterisks*` around the words to correct**. Get them wrong
and the form declines to plain text rather than rendering nonsense — which is the
intended failure, but it looks like "the type did nothing".

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

## Screens: one layout contract, asked of whatever is registered
Every game owes the room the same three things, whatever its board is made of:
**nothing under the team bar, nothing off the right edge, no text cut off.** That is
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

### The Lab: this game's switches, inside this game
⚙ exists to see everything at once; the **Lab drawer** (`Lab` in the header, or `L`)
exists to change one thing mid-round without hunting through other games' tabs. It is
`S.renderFor(mount, game)` — the same rows the panel builds, filtered to one game — so a
new setting appears in it by being registered, exactly as in the panel. A change made
there is **an override for that game**, never the master, which is what makes trying an
idea mid-round safe.

Three things it has to do, each of which was a bug first:
- **Stop short of the header and the team bar.** Both hold controls a teacher reaches for
  *while* it is open — New game, the timer, ⚙, the ± score buttons — and a full-height
  panel swallowed every one. `fitLab()` measures both edges (the header wraps at narrow
  widths, the team bar grows a row when a team is added, so neither is a constant).
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

## Source material & specs
- `material/empower-c1-unit-4/`, `material/empower-c1-unit-5/` — Cambridge Empower
  C1 workbook page scans (indexed by page/section) the game content is authored from.
- `docs/game-hub-requirements.md` — the MVP spec (per-game content model, game tier
  analysis, success criteria). The key open metric: realistic authoring time per unit.
- `docs/design-reference.md` — DCU International Academy brand (navy/sky-blue/yellow/cream).
- `.claude/*.md` — older experimental domain notes (product vision, lesson pipeline,
  activity schemas). Reference only; not required reading.

## Current status
- **Deployed.** Build `20260729u`, 503 checks green. The branch in use is
  `claude/product-status-gxqp9l`; merging it to `main` is what deploys.
- **The Lab drawer is how a dynamic gets tried.** `Lab` in the header (or `L`) opens
  the game being played, and only that game, without leaving the board — see "The Lab"
  above. It exists because prototyping was the bottleneck: comparing two ideas meant
  ⚙ → find the right tab → change → close → restart, and by then the round was over.
  Everything registered shows up in it for free, so the next dynamic is a `S.register`
  call and nothing else.
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
    `mCurrent.removed`, so a re-render can't wipe it), **Ask the class** (hands
    tallied on screen by tapping options — the phone layer does not vote yet), and
    **Confer** (runs the header timer).
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
  (`scatterRaceWords`) measure the space left under the header and above the team bar
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
  `write` / `vote` (vote only in Millionaire, which is the only board with four options
  to vote on). They began as independent booleans and immediately contradicted each
  other — with typing and buzzing both on, one had to silently win, decided by a
  hard-coded precedence nobody could see. **A dynamic is a choice between iterations**,
  which is a variant. `phonePrompt` decides whether the question appears on the handset
  at all (off keeps their eyes on the board), and `phoneOneEach` stops the fastest thumbs
  owning it.
  - In **Race to the Board head-to-head** a sentence arms the buzzers; the first buzz
    takes the floor and *carries the team*, so a correct word scores automatically and the
    "who touched it first?" chooser never appears. Wrong word = no penalty, buzzers
    re-open for a steal.
  - **The teacher sees what was typed, right or wrong** — the chip carries the name, the
    word in quotes, and a verdict. A miss is the most useful thing on that chip: who is
    nearly there, and how, is exactly what you would want mid-round. It survives the
    re-arm for the same reason.
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
- Obvious next use of the phone layer: **Ask the class as a real vote** rather than
  counting hands, and buzzers to pick which team answers a Jeopardy tile.
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

## Before you push
```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js        # ~23 min, 503 checks, 31 suites
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=jeopardy,fit,phone   # while iterating
```
Drives all four games in a real browser and checks the things that have actually
broken before: boards running off screen, text cut off, the flip landing on the wrong
tile, settings not persisting, buzzers not degrading when the relay is gone. Starts its
own relay, exits non-zero on any failure. `--url=` tests a deployed copy instead.

**Do not pipe it through `tail` in a way that swallows the exit code** — `node … | tail`
reports the *pipe's* status, so a red run looks green. Redirect to a file instead; you
also get progress while it runs, which `tail` denies you for 15 minutes.

**A partial run is not evidence for a change to anything shared.** Three separate helpers
in the suite compared `#m-question`'s text against the raw prompt, and `Kit.prompt`
rendering `___` as a blank broke all three. They were found and fixed one at a time
across three full runs, because each was treated as a one-off instead of prompting a
search for the same pattern elsewhere. **When a shared behaviour changes, grep for the
assumption before re-running.**

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
