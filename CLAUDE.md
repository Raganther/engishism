# Engishism — ESL Classroom Presentation App

Web-based games for ESL teachers to present English lessons on a classroom TV.
Pure HTML/CSS/vanilla JS, **no build step**, fully offline-capable, deployed to
GitHub Pages. Teacher-driven and class-facing — students don't touch the device.

- **Live:** https://raganther.github.io/engishism/
- **Repo:** public (GitHub Pages serves from `main`) — pushing to `main` deploys.

## How to talk to me
**Short. Plain words. Say the thing, then why, then stop.**
- Explain from the ground up — what the problem actually is — rather than naming it.
- No jargon. If a term is unavoidable, say what it means in the same sentence.
- Simple language, the way you'd explain it to a bright teenager.
- No walls of text. A long answer is usually a sign the thinking isn't finished.
- Don't list options I won't pursue. Give one recommendation.

## How this file works
**Only what is true now.** The axioms, the ethos, where everything is, and the
registries the project grows through. Nothing else.

**No history.** Not a fixed bug, not a suite count, not the three wrong diagnoses, not
"we built X". If a lesson from a fix is general it becomes an **axiom** below, stated as
a rule; if it is not worth an axiom it is not worth keeping. **git log is the history** —
the commit subject says what changed, the body says why and what proved it, and the
bodies here run twenty to thirty lines because that is where the reasoning goes.

**No list a tool can print.** Every hand-kept list in this project has drifted. If the
code can be asked, ask it — see "Asking the code" below, and apply the same rule to this
file: a table here that a registry already knows is a bug waiting to happen.

**This file is loaded at the start of every session; skills are not.** A *procedure* —
the checklist for doing a kind of job — is a skill in `.claude/skills/`, pulled up at the
moment it is needed. This file says what is true; a skill says how to do a thing.

**The workspace is ephemeral** — re-cloned each session, thrown away after. Anything
worth keeping is committed and pushed.

**The clone is shallow** (a few days of commits). `git fetch --unshallow` when the
history matters, and **ask the remote for what is deployed** — `git ls-remote origin
refs/heads/main`, or a fresh `git fetch`. `origin/main` inside a fresh clone is a
photograph taken when the workspace was made. `tools/where-are-we.js` settles it at
session start.

## The axioms
**Solve it once, use it anywhere.** That is the whole philosophy; the six below are how
it is kept, and everything else in this file is an application of one of them.

1. **Ask before you write.** The expensive mistake here is never a hard bug — it is a
   second copy of something that already exists, and the reason it happens is that nobody
   looked. `node tools/shelf.js` is the asking, and it runs before any edit to shared
   code.
2. **One fact, one home.** The bottom of the board was written down in four places before
   it became `Kit.floorTop()`. Two copies of a fact are two facts that will disagree.
3. **Things declare themselves.** A game, a round, a form, a skill announces itself to a
   registry and nothing holds a list of them. A hand-typed array of ids, an
   `if (activeGame === …)` branch, a checklist item that must be remembered — each is the
   same defect, and it is the most repeated bug in this codebase.
4. **Shared code takes what it needs and hands back an answer.** No globals, no
   assumptions about the caller's page. `Kit.vote` is the model: you pass it replies, it
   hands back counts, the transport stays the caller's. That is what lets one piece of
   code run in a game, on the bench and on a playground page.
5. **Two callers prove a shared tool**, and the first is rewired in the same change. One
   caller is a guess about an API. Extract what is already duplicated, never what might
   be.
6. **The dependency arrow points one way:** `playground/` → `game-hub/`, never back.

**The round is the thing that travels.** A question dynamic works in any game show
because it knows nothing about scoring, turns or tiles — that is the modularity actually
paying out, and the direction to keep pushing. A *skin* is a game show itself, so a game
does not get a skin; it is one.

### The room — not philosophy, the shape of the place
Four facts about a classroom that outrank anything above when they conflict.

- **The board never scrolls and never runs off the screen.** Nobody can scroll a
  projected image mid-game. A handset in the hand is the deliberate exception.
- **Degradation is non-negotiable.** No relay must leave every page fully playable
  teacher-only. Absent feature, not broken app.
- **The teacher decides and the teacher clicks.** Students never touch the device; phones
  are advisory input, and votes land on the board as counts.
- **Setup stays under 30 seconds.** Anything new that adds a screen before a game starts
  must remove one somewhere else.

## The map — where everything is
**Three generations coexist**, and `index.html` links all three.

| Path | What it owns |
|---|---|
| `game-hub.html` | **the app.** Loads every content file + the engine. Per-unit deep links: `game-hub-unit4.html`, `game-hub-unit5.html`; the test board is `game-hub-lab.html` |
| `game-hub/hub-engine.js` | **layer 1 alone now** — no game logic left in-closure. Injects the UI skeleton, renders every screen, the team bar, the timer, the shared clue card and its buttons (which route to the active game through hooks) |
| `game-hub/hub-games.js` | **the game registry.** Its own file, loading before the game files and the engine, which is what retires the register-before-init trap |
| `game-hub/games/*.js` | **every game lives here now** — one file each: `jeopardy.js`, `blockbusters.js`, `race.js`, `millionaire.js`, `quickfire.js`, `bingo.js`. `quickfire.js` is the model to copy |
| `game-hub/hub-kit.js` | **`Kit`** — the shelf every *game* calls, plus the `Kit.prompt` question forms |
| `game-hub/hub-rounds.js` | **`Kit.round`** — the shelf every *round* calls, and the round registry |
| `game-hub/rounds/*.js` | one file per round. `default.js` is the ordinary question |
| `game-hub/hub-settings.js` | the settings registry and panel. **Loads before `hub-engine.js`**, with `hub-kit.js` — the engine throws without either |
| `game-hub/hub-buzzer.js` | the phone client, shared by the hub (host) and `join.html` (players) |
| `game-hub/hub.css` | all shared styling, DCU theme and game-show skin. The one place to restyle |
| `game-hub/hub-rounds.css` | the round card's own styling. **Not `hub.css`** — a playground page cannot load that without taking the whole hub theme |
| `game-hub/hub-qr.js` | vendored QR encoder (qrcode-generator, MIT), unmodified. Vendored because the app must run offline with no build step |
| `game-hub/content/*.js` | data-only banks, one file per unit; each does `window.UNITS.push({…})` |
| `join.html` | the students' page |
| `tools/buzzer-relay.js` | zero-dependency Node relay **and** static server. `docs/buzzers.md` |
| `playground/question-bench.html` | the workshop for rounds *and* forms |
| `playground/phone-bench.html` | the whole room on one screen — board plus a rack of real handsets |
| `playground/connections.html`, `thermometer.html`, `story-reveal.html` | standalone prototypes — see "The playground" |
| `playground/bench-kit.js` | **`BenchKit`** — the shelf a playground page calls |
| `playground/lab-forms.js` | experimental question forms. **No game ever loads this** |
| `tools/` | the harness — see "The harness" |
| `.claude/skills/` | the procedures |
| `docs/`, `material/` | specs, brand, coursebook scans, the classroom log |

**Load order in the shells is load-bearing**: `hub-games.js` (the registry) → the
`games/*.js` files (which register into it) → `hub-engine.js` (which consumes
everything). Same shape as `hub-rounds.js` → `rounds/*.js` → engine.

**The older two generations are kept, not deleted.** `app.html` → `engine/unit-app.js`
(with `engine/events.js` and `engine/session.js`) is a paused unit-first rebuild;
`classic.html` → `engine/engine.js` is the legacy topic-first engine, and it still holds
four team-building games (`bunker`, `desert-island`, `it-helpdesk`, `scam-or-legit`) that
exist nowhere else.

**Where the layering leaks, and it is worth knowing before trusting it:** every game is
its own file now, but the shared clue card was built *around* Jeopardy, so layer 1 still
carries Jeopardy-shaped surfaces the games reach through hooks — the card's
reveal/correct/wrong/close/skip buttons route to `onClueReveal`/`onClueCorrect`/
`onClueWrong`/`onClueClose`/`onClaimPick`, the answer clock stops via `onFloorClear`, the
Together class-line repaints via `onScoreShown`. **Opening the card is shared now:** a card
host calls `E().openRoundOnCard(o)` — the ~dozen-step open sequence in its load-bearing
order, once — and keeps its own pre-work before it and post-work off the round it returns
(the Daily Double wager, the hex chooser, the review answer-reveal). Parts of layer 1 were
generalised *from* one game and still show it — `showResult()`'s `tone` is gold/silver,
`Kit.claimTeam`'s `allow` exists for Blockbusters' two-team geometry. Read layer 1 as "what
happens to be shared so far".

**Docs worth knowing by name:**
- `docs/game-hub-requirements.md` — the spec. **The agreed direction (§3.8–§3.10), the
  build order, the tagged-pool model (§3.11) and the whole-product sketch (§3.12) live
  there, not here.** Read before designing anything.
- `docs/feedback.md` — the classroom log, one entry per real run, template at the top.
  The only data no suite can produce; a run reported in chat goes there first.
- `docs/design-reference.md` — DCU International Academy brand.
- `docs/buzzers.md` — running the relay for a lesson.

## The tiers — where a change belongs
Getting this wrong costs a refactor, so it is the first question about any change.

```
GAME HUB      the container: units, teams, scores, timer, settings, phone room
GAME SHOW     a skin with question slots. Owns geometry, scoring, turns
ROUND         a question that is played: card + phone dynamic + judging
CONTENT       per-game banks inside a unit file
```

**This is a classroom session container, not a quiz engine.** What it provides is teams,
scores, turns, a projected surface, a timer, and thirty handsets that can each be put
into a *different* state. A game show is one thing you can do with that; nothing in the
container requires a question.

| Tier | Owns | Test |
|---|---|---|
| **Container** | teams, scores, the timer widget, the phone room, settings, the clue card *as a surface*, the standings screen, the phone strip, **the record of who answered and when** | true whatever game is on screen |
| **Skin** | geometry, turns, what a question is worth, what winning is, the ending | true for this board, whatever question is in the slot |
| **Round** | the card's contents, the phone dynamic, merging several students into one answer, judging | true wherever it is hosted — which is what makes it portable |

**A round never contains scoring, turns, timers, the board or a tile.** That single rule
is what makes a round portable, and it is why the scoring split exists: **who got there
and when is the container's; what a position is worth is the skin's.**
`Kit.round.results` records order and timing for everybody, and the skin **names** one of
the shared `PAY_RULES` and declares `worth` and `step`. A skin does not do its own
arithmetic — five boards each writing their own sums is a hand-kept list in another form.

**A host is four declared facts, not an adapter.** `ROUND_HOSTS` in `hub-engine.js`
names, per board: which game's settings scope the round, which modal mode it belongs to,
which stage is lit, and what a team taking it is worth. Everything else — card, phones,
merging, judging — is the round's and is shared. A new host is a row in that table plus
two calls where its clue opens.

**Which skins can host which rounds is about contention, not answer shape.** A round
wants the card and the phones; a skin conflicts only if it already owns one. Jeopardy,
Blockbusters and Millionaire own neither — a tile, a hexagon or a rung merely opens one —
so all three host any round. Bingo owns every phone, so it can host a round card-only,
teacher-judged, which every round already owes as its no-relay path. Race owns the card
itself, because its scattered words *are* the board.

**The clue card is not inside any stage.** `#clue-modal` is a sibling of every
`#play-<game>`, which is why `openClueCard` sets `--tension` on it by hand. A hub surface
that skins borrow.

**"The timer" is three clocks.** The header countdown is the *hub's* — the teacher's
instrument, and nothing may overwrite what they set. Jeopardy's answer clock is the
*skin's*, and starts on the buzz rather than on the clue opening. A round's own clock is
the *round's*, sent once as a duration with the arm, so no handset agrees the time with
anybody.

### Three layers, and the blast radius of each
| Layer | What it is | Changing it costs |
|---|---|---|
| **1 · Template** | what every game gets by existing: the skin, team bar, scoring, timer, clue card, `showResult()`, all `Sound.*`, all `Kit.*`, the content gate | highest risk — touches everything |
| **2 · Game** | board logic, stage CSS, its `tension()` source | low, isolated to one game |
| **3 · Content** | the banks | near-zero engineering risk, **highest cost in hours** |

**Layer 1 points two opposite ways, and which one you are adding matters:** a **service**
every game calls (`Kit.fitToScreen`, `Sound.applause`, `showResult`) is inherited for
free by games that do not exist yet; a **hook** the engine calls (`start()`, `fit()`,
`tension()`, `onResize()`) means every game *may* now have to answer it.

**Two axes cut across all three layers.** *Variants and per-game settings* — `cardFlip`
is layer 1, `bbWinRoute` is layer 2, `theme` is layer 1 applied per game, all the same
mechanism: shared by default, divergent by declaration. *Units* — content is a matrix of
games × units with `hasBank()` at each intersection, so a unit offering only two games is
a supported state rather than a gap.

## The registries — how the project grows
Six registries: **games** (`hub-games.js`), **rounds** (`hub-rounds.js`), **question
forms** (`Kit.prompt`), **settings** (`hub-settings.js`), **variants** (`Kit.anim` and
its kin), and **skills** (`.claude/skills/`). Adding to one is how the project grows
without anything being edited to know about it.

**The declaration forms are not here.** What fields `registerGame`, `Kit.round.register`,
`Kit.prompt.register` and `S.register` take is in the skill that covers adding one —
`new-game`, `new-round`, `new-question-form`, `new-mode` — which is loaded at the moment
you need it and holds more than a summary could. What follows is what is true about the
registries whether or not you are adding to one, and the traps that bite from outside.

### What every registry guarantees
- **Every hook is optional and defaults to a no-op**, and hooks only fire while their
  owner is active — which is why no hook checks `activeGame`.
- **Declaring is the whole wiring.** A game that registers gets the skin, team bar,
  scoring, timer, clue card, `showResult()`, every `Sound.*`, every `Kit.*`, the content
  gate and the phone strip for free. It declares `card`, `intro`, `hasBank`, `fitsScreen`,
  `order` and its phone hooks. Genuinely its own are board logic, stage CSS, its
  `tension()` source and its bank shape.
- **A game's home is its own file**, `game-hub/games/<id>.js`; `quickfire.js` is the model.
  Every game is extracted now — `hub-engine.js` registers none — so a new game is a new
  file plus a `<script>` between `hub-games.js` and `hub-engine.js` in the four shells,
  and nothing about the engine is edited. A card game (one that opens the shared clue
  card) declares `roundHost` with `onCard: true` and reaches the card's buttons through
  the `onClue*` hooks; `jeopardy.js` and `blockbusters.js` are the two.
- **Draw a question with `drawPrompt(mount, item, '<gameid>')`**, never `textContent` —
  that is what gets a game gap fills, anagrams, odd-one-out and error correction. A game
  writing its own prompt gets none of them.

### Phones reach a board through hooks, never by name
Declare them and a game inherits buzzing, everyone-types, type-then-buzz, the class vote
and the activity strip; leave them out and its phones are idle, which is a correct state
rather than a broken one. **`hub-games.js` declares every default in one block, and that
block is the contract** — do not trust a count written anywhere, because the set grows.
`HubGames.hooksOf(id)` says what a given game actually answers.

Two hazards live out here, not in the adding:
- **Refusing a buzz is not ignoring one.** The relay locks the room on the *first* buzz
  whoever sent it, so an unentitled phone would hold the lock and the entitled team could
  never get in. `buzzEntitled` returning false makes the engine re-arm, which clears it —
  and **what it re-arms is `phoneRound()`'s answer, not a buzzer** — hard-coding
  `armBuzzers` there would replace a game's own round with the thing it just refused.
- **`phoneRound()` is for a game that *is* the phone dynamic.** Return a round and the
  default round gets no say; otherwise two dynamics arm the same handset and fight, which
  is invisible until a reconnect replaces one with the other. **What it returns past
  `{mode, prompt, options}` is carried to the relay, not read**, so a game can use a shape
  the engine has never heard of. It was a whitelist until a multi-pick silently became a
  plain vote.

### A round is four things at once
The card the projector draws, what the handsets are put into, how several students' taps
become one team answer, and whether that answer is right. That is why it is a tier and
not a helper.

- **`ctx` is handed in and never reached for**, and read **fresh at call time**, which is
  why `read`, `judge` and `accept` all take it. Students join and drop all lesson; a size
  the round was told once is a lie by the third question. It is also why the question
  bench works: it has no team bar, passes its own `ctx`, and no round can tell.
  **`roundCtx()` in `hub-engine.js` is the field list**, and a copy of it written anywhere
  else is a copy that will be wrong.
- **The ordinary question is a round too** — `rounds/default.js`, registered as
  `round_default`. It deliberately declares no `field` and no `claims`, so
  `Kit.round.of(item)` returns null for a gap fill: the content-screen chip, the clue path
  and the content gate all read `of()`, and a default round that claimed every item would
  push every gap fill through a `render()` that does not exist. **The card for an ordinary
  question belongs to `Kit.prompt`.** What this round owns is the room.
- **One name per round, and the id is not it.** A round has an **id**, which is code, and
  a **label**, which is the only name a human should ever see. The label lives in the
  round's own `register()`, and the category a board draws it in, the Lab heading, the
  bench menu and any doc copy it exactly — it has drifted three ways at once before,
  because a category name is a hand-typed string in a content file. Two labels are
  deliberately unlike their ids: `anagram` and `scramble` are each *also* a question form,
  and the bench namespaces them (`r:anagram` / `f:anagram`) after the round silently
  shadowed the form.

### A question form is how a prompt is drawn
No phones, no judging — register one and every game can draw it. **A type names the games
it suits**, because an anagram in Millionaire is given away by its own four options.

- **Untyped items still render.** A prompt containing `___` is recognised as a gap fill
  without being labelled one; anything else falls back to plain text. That is what made
  the forms adoptable rather than a migration.
- **Declining is the designed failure**, so a form that refuses an item leaves bare text
  and the answer prints on its own line instead.
- **Two stages, and the isolation is structural.** Experimental forms live in
  `playground/lab-forms.js`, which **no game loads**. Registered in `hub-kit.js` a form is
  live in every game the moment a bank item carries its type, so **graduating is moving
  the block between the two files; the code does not change.** Being on a playground page
  does not make a form separate — one was written straight into the kit and was therefore
  shipped, invisible only because no content used it.

### A setting — the panel builds itself
`S.register(...)` and the panel grows the row. Always pass the game when reading one:
`S.get('myThing', activeGame)`.

- **Naming `games` makes it per-game overridable.** The panel grows an *All games* tab
  plus one tab per game; a game follows the master until overridden. `S.setContext` opens
  ⚙ on the game being played.
- **A game can carry its own default** (`defaults:{jeopardy:'agree'}`), ranking below a
  teacher's override and *above* the master — deliberately, because such a game does not
  follow the master and pretending it did would make the All-games row a control that
  silently does nothing.
- **Storage:** `id` is the master, `id@game` an override, and `byRoster:true` keeps a
  second value for rooms of individuals under `…!solo`. Values persist in `localStorage`
  per device; a browser blocking storage on `file://` falls back to memory and says so.
- **Two axes and deliberately not three.** A per-round scope was built, shipped and
  retired the same day: it worked, and it read as complicated in front of the person it
  was for, which is the only test that counts. **Every round inherits its game's value.**
  What is kept is the *fact* of which round is open — `S.setRound` at the two seams where
  `roundId` moves, `S.roundNow()` to read it — because the room bench opens its rules
  band on the question that is up and the board is the only thing that knows. A fact
  something asks for, not a scope nothing needed.
- **A retired scope's keys get dropped, not orphaned.** `S.keys()` finds them by shape;
  a value nothing reads is the quiet kind of wrong, because it comes back the day the
  scope does and applies a choice made about a different build. Nothing is promoted
  either — a per-round value existed to make one round *differ*.
- **Every control carries `data-setting="id"`.** The panel does not need it; anything
  looking *at* the panel does, and without it the only handle on a control is prose.
- **The stuck default.** `register()` seeds every master value into `localStorage` the
  first time a device runs the app, so **changing a `default:` in code never reaches a
  browser that already ran the old build** — the key is present and the new default is
  ignored forever. It reads exactly like a bug in the feature. Changing a shipped default
  means migrating it, or telling the teacher to flip it once.
- **Replacing a setting is a migration, not a deletion.** A per-game override is something
  a teacher set deliberately, so `S.raw(key)` and `S.drop(keys)` exist. String literals
  that are storage keys of old builds must survive any rename.
- **A ruleset is a named bundle that writes the smaller switches**, never a second code
  path and never a value that shadows them. Every row a bundle touches carries an advisory
  note — "Classic sets this to 10s" — beside the control, which stays the truth.

**One gear, two forms.** ⚙ outside a game opens the full panel; **during play it opens the
docked drawer** for that game (`L` toggles it), and a change made there is **an override
for that game**, never the master — which is what makes trying an idea mid-round safe.
Both are `buildRow`, so a new setting appears in both by being registered. The drawer owes
three things, each of which was a bug first: **stop short of the header** (`fitLab()`
measures both edges); **make the board give up the width** (`body.lab-open` insets the
screen and `hook('onResize')` re-fits, or the drawer hides the options you are trying to
watch); and **stack its rows** at narrow widths.

**Organisation is derived, not listed.** A game's view leads with Ruleset, then the game's
own groups, then the shared ones in a fixed order (Competition, Questions, Phones, Clue
card, Presentation, Sound). "Own" means every setting in the group names exactly one game
— so a sixth game's group sorts itself without being listed anywhere. **Within a group the
shape is derived too:** a setting that declares `under:'parentId'` (optionally `when:value`)
nests indented under its parent and greys while the parent is off or unmatched; one that
declares `adv:true` sinks below a foldable Advanced divider. A dependent slider whose
effect a teacher cannot see is what read as noise — the field is how it stops.

### The vocabulary — "mode" means three different things
Say which one. The interface gets this right (`jRules` is registered with
`label:'Rules'`); prose is what drifts.

| Say this | Values | Scope | What it is |
|---|---|---|---|
| **Ruleset** | Classic · Hub · Together | a whole game show | a named bundle that **writes** the smaller settings |
| **Round mode** | first · agree · climb · race | one question | how that question is played. Declared by the round |
| **Default-round mode** | off · buzz · write · type | one *ordinary* question | what the handsets do when no shaped round owns them |

They nest rather than compete: a ruleset sets the other two, so "which mode is in charge"
is never a real question — the switches are the truth.

## Asking the code
Nothing in this file lists what exists. Ask:

```bash
node tools/shelf.js            # every Kit.round / Kit / BenchKit helper, with its shape
node tools/question-types.js   # every round and question form, with its item shape
```
Both load the registries rather than holding a list, so a thing added next month appears
with nobody editing anything. `shelf.js` also names **what has been written three times**
across the round files, and doubles as a hook before any edit to shared code.
`dev.html` is the browser-side index of skills and pages.

In a page, `window.HubGames.ids()` / `.get(id)` is the game registry, `Kit.round.ids()`
and `Kit.round.authored()` the rounds, `Kit.prompt.types()` / `.info(type)` the forms.
**The layout suites ask the registry for the stage to assert against**, which is why a
fifth game is covered the day it calls `registerGame`.

## Screens — one layout contract
Every game owes the room the same three things, whatever its board is made of:
**nothing below the floor, nothing off the right edge, no text cut off.** The floor is
`Kit.floorTop()` and the tests ask for it rather than restating it.

- **`Kit.fitToScreen(el, {min,gap,floor})`** — `floor:true` hands the height back when
  content genuinely cannot fit rather than forcing one. Millionaire asks for it; Jeopardy
  and Race do not, because they can always be made to fit. Forcing a height collapsed the
  option grid under its own content.
- **`grid-auto-rows: minmax(min-content, 1fr)`** is the structural guarantee that a row
  can never shrink under its content — without it a fix is only "there happens to be
  enough room now".
- **A count belongs in a custom property, not an inline style.** `--jcols` rather than an
  inline `repeat(n, 1fr)`, because an inline style cannot be overridden by a media query.
- **Size type from what was rendered, not from the viewport.** A `vw`-sized heading stays
  the same width however narrow its column gets. Measure on a canvas so it costs no
  reflow, take the **longest word** as the constraint (spaces wrap, words cannot), add
  **letter-spacing back per character** (it is em-based and canvas does not apply it —
  across a ten-letter word at `0.09em` that is a fifth of the column), and keep a
  **legibility floor**: sizing purely to fit reached 8px, which passed the assertion and
  could not be read from the back of a room.

**Handsets are a preview device, not the projected board**, and two rules invert there
deliberately: **the board may scroll**, because a phone in the hand is not a projector;
and **nothing is hidden, only compacted**, because the timer and the scores are what a
teacher reaches for. Chrome is capped at 200px on a 390×844 screen and sits two pixels
under it — **the thing that eats it is another header button**, so measure the group, not
the button.

## Content
**Per-game banks inside a unit file**, filed by unit, shaped per game. A unit is one
content file plus a `<script>` line in `game-hub.html`; `gamesFor()` means a unit only
shows the games it has a bank for, so adopting a new game one unit at a time is a
supported state.

**A new round's content must be authored in the shapes that already exist** — run
`node tools/question-types.js` for the shape of each. The procedure is the
`author-content` skill.

**What each game will not forgive:**
- **Blockbusters** — answers are one word, and `letter` must be its initial. (Only for
  ordinary clues: a hosted round's answer is judged by the round, and the letter is the
  hexagon's *name*, used for display, the clue topline and the picking vote. The win
  condition searches claimed hexagons without reading it.)
- **Race** — answers become board tiles, so single words, never duplicating another
  answer in that bank.
- **Jeopardy** — categories stay grouped by section in array order, or the content screen
  prints a section heading twice.
- **Millionaire** — two questions per rung per section, because the ladder is *per team*
  and with one they both meet the identical question on the way up.

**Keep the forms mixed.** Reach for a word transformation, error correction, odd one out,
register choice, collocation or definition before another gap fill. Extra items need no
engine change — every game filters by section and shuffles, so more items is more
variety. **Grammar Focus pages are content too and the format will not remind you**:
Jeopardy's named categories give grammar a slot, the other banks are flat lists, and
authoring drifts to vocabulary. Match the point to the format — relative pronouns are
ideal Race tiles and wrong for Blockbusters, where **W** is ambiguous across
who/whom/whose/where/when/why.

**No prompt may appear in two banks.** The same *answer* in several games is the design
working (spaced retrieval from different angles); the same *prompt* is what per-game
authoring exists to avoid. Enforced, over every unit in `window.UNITS`:
```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=content     # ~20s
```
It catches what no engine test can: a duplicated prompt, a Blockbusters answer whose
initial doesn't match its hexagon, two Race items competing for one tile, a Millionaire
rung with nothing behind it, section labels whose counts have drifted.

**What no check can catch is sourcing.** Whether an item is actually the English the unit
teaches is a person reading `material/` against the bank.

## The playground — prototypes with phones, outside the hub
The lane between a prototype and the hub. A playground page is a **standalone
self-contained HTML file** — no `registerGame`, no hub engine, no hub skin, zero risk to
the teaching tool — but it borrows the **phone room** (`hub-buzzer.js` + the relay +
`join.html`), which is game-agnostic.

- **Develop the game out fully here first**; port a dynamic into the hub only after a
  real classroom run. Three possible fates, decided later: stay standalone, graduate
  whole via `registerGame`, or distil the question dynamic into a `Kit.prompt` form.
- **Content lives in a marked block at the top of the file**, so a teacher can edit it.
- **Votes are advisory** and **no relay must leave the page fully playable teacher-only**
  — the `playground` suite asserts it.

**Four tiers, and knowing which one a thing belongs to is the whole discipline:** the
**page** (a board's own puzzle) · the **bench** (`bench-kit.js` — room, settings, teams,
clock) · the **round** (`Kit.round` + `rounds/*.js`, shared by the question bench and
every game show) · the **hub** (`Kit.prompt`, `registerGame`). Graduating upward is the
same two-stage isolation the question forms have. **The round tier is the one a teacher's
ideas travel on**, which is why nothing in a round may know about scoring, turns or
tiles.

**`bench-kit.js` is the middle shelf**, governed by the two-callers rule: extract what is
already duplicated, not what might be. A playground's value is that pages are allowed to be
weird, and abstracting a sandbox too early kills the thing it is for. Ask
`node tools/shelf.js` for its contents. Two things the second game taught: **a shared
component must not know about one game's modes** (the team bar takes `showTurn(false)`
rather than reading `racing()` itself), and **shadowing bites at the extraction seam** —
a local `const clock` silently became a call on a `<select>` when the shared countdown
took that name.

**`question-bench.html` is the workshop for rounds *and* forms.** A phone dynamic cannot
be judged from the phone — what it produces lands on the card — so rounds are built here
with card and handsets side by side. Game shows call the **registry**, never the bench.
Its menu lists whatever the registries hold in three groups (rounds · forms in the kit ·
forms lab only), draws at board size against the hub's own stylesheet, and reports which
of the three outcomes happened. **Ask the room** puts the question on the handsets as an
everyone-types round and judges with `Kit.answer.judge`, exactly as a game would, so a
form can be tried before a single bank item is authored for it.

**`phone-bench.html` is the whole room on one screen** — the projected board left, a rack
of simulated handsets right, both the **real pages in iframes on the real relay**. It
works against any board because it asks one question of whatever it loaded:
**`window.HubHost` — what room are you running?** That is a stated convention, which is
why the bench needs to know nothing about the game. Five rules it is built on:
- **A simulated phone never touches the seat.** Every iframe shares the page's
  localStorage, and the one seat key belongs to the real phone.
- **Phones are appended once and never re-parented** — moving an iframe reloads it, which
  drops its stream.
- **The board renders at a projector's logical width (1280) and is scaled to fit**, never
  past 1:1. A board re-fitting itself to a 500px pane is not the board under test.
- **And so does every racked phone — 390×844, scaled to its column.** Laying one out at
  the column's real width gives `join.html` less room than a real handset has, and the
  bench then misreports the one thing it exists to show. A scaled element still occupies
  its full layout size, so the iframe needs a clip box with an explicit height.
- **The phones follow the board's room**, re-pointed deliberately when it changes — a
  playground board mints a fresh code every load, which otherwise leaves every racked
  phone connected to a room nobody is hosting.

## The harness — what watches the project
**Six hooks in `.claude/settings.json`, and none of them blocks** — a reminder that fires
every time is one you stop reading. Each speaks only in the case it was written for: `shelf.js` before an edit to shared code;
`memory-check.js` before a commit, only when this file is not in it; `suite-check.js`
before a smoke run, only when the run is long; `where-are-we.js` at session start;
`which-skill.js` before an edit — through the edit tools **or through Bash**, since most
surgery here is `sed -i` and heredocs — naming the skill that covers the file or saying
**no skill covers it**, which is the case to tell the user about before starting; and
`skill-check.js` after, asking once per skill per session whether the checklist held.

**Eleven skills in `.claude/skills/`, and a skill declares the files it covers.** `covers:`
in its own frontmatter is the territory it claims, so a skill written next month is
picked up with nothing else edited. Which one you want follows the tiers: a skin is
`new-game`, a question that is played is `new-round`, a way of drawing a prompt is
`new-question-form`, a bundle of switches is `new-mode`, something every game inherits is
`shared-surface`, changing a round that already works is `tune-round`, writing questions
is `author-content`, the deploy seam is `ship-it`, phones are `phone-debug`, anything
that watches the project is `harness`, and a skill itself is `check-a-skill`.
- **Quote the globs.** A bare `*.html` in YAML is an alias reference, not a string.
- **A skill cannot correct itself**, and only one thing guards it mechanically:
  `check-syntax` fails on a skill naming a symbol that appears **nowhere** in the source,
  because a backticked word absent from ~30k lines is a dead symbol rather than English.
  **It catches a rename, never wrong advice.** The other half is replaying a real past
  bug against the skill that covered it — `check-a-skill` is that procedure, and the
  thing it looks for is a skill whose every word is true and which never asks a question
  it should ask.
- **A skill's own file is the one `.md` the procedure hook can see.** `which-skill.js`
  skips markdown, because every other `.md` here is notes, specs or the classroom log
  and warning about those is the noise that kills the signal — a skill file is the
  single exception, derived from where the skills live rather than named.

**`check-syntax` is the one that always runs**, two seconds, every change, no exceptions:
```bash
node tools/check-syntax.js
```
It stands in for the compiler CSS does not have — **a malformed comment silently deletes
every rule to the next `*/`**, with no error anywhere, and the page merely looks plain
rather than broken. It walks directories rather than carrying a list, and asserts both
directions of every pairing it knows (`dev.html`'s links against the skills, the relay's
`armed` keys against `joined`, every literal path in a `covers:` list against the disk) —
a one-directional assertion lets a renamed file leave a skill silently covering nothing.

## Run and ship
```bash
git add -A && git commit -m "..."   # save
git push                            # deploy; Pages and Render follow in ~40s
```
**Push straight to `main`.** The commit message is the project's history — the subject
says what changed, the body says why and what proved it.

**Bump the cache stamp whenever you change a file under `game-hub/`.** Every asset is
linked as `…?v=YYYYMMDDx`; without a bump Chrome serves the cached JS/CSS and a fix looks
like it never shipped. **Find the pages, never list them:**
```bash
sed -i "s/?v=20[0-9]\{6\}[a-z]*/?v=20260816a/g" $(grep -rl '?v=20[0-9]\{6\}' --include=*.html . | grep -v node_modules)
```
**The date shape in that pattern is load-bearing** — `classic.html` carries `?v=picture`
and `?v=unit1`, which are content selectors, and a looser `?v=[0-9a-z]*` rewrites them
into a broken page. The engine reads its own `?v=` and exposes it as `window.HUB_BUILD`,
so **"Build …" in ⚙ tells you which version is actually running.**

**The stamp busts the assets and nothing busts the shell.** `game-hub.html` carries no
stamp of its own, so a browser holding the old shell asks for the *old* `?v=`, gets its
own cached assets, and shows the previous build with no error anywhere. Two tells that
you are looking at a stale shell rather than a broken fix: **raw `___` in a prompt**
(`Kit.prompt` isn't running at all) and **⚙ reporting the old build number**. The fix
from the user's side is `game-hub.html?fresh=1`; in-app browsers hold it hardest and
often ignore pull-to-refresh.

### Testing — the default is none
**Run no test suite unless the user asks for one.** Not a preference, a rule. The tests
open a real browser and play the games, which is worth it when nobody is watching the
screen — but the user *is* watching, on the real site and a real phone, and for most
changes their eyes are faster and better than four minutes of robot. **Three things are
banned outright:** the full suite unasked, starting a run and then continuing to edit,
and anything over five minutes without asking first.

**Three cases where I stop and say the risk in one line and let the user choose:**
something all the games share (one mistake breaks five boards and only the opened one
gets noticed); phones or the relay (the user cannot check it alone, and the suite fakes
thirty handsets in seconds); content in bulk (20 seconds, and it catches what eyes
cannot). Everything else — one game's board, one stage's CSS, a new setting, docs, this
file — just push. **What that costs, honestly:** some breaks don't show on the screen
being looked at. That is the accepted trade; say so when it's likely.

**The one exception worth keeping** is a small hand-written drive for phone work at class
scale — sixteen handsets, three minutes. That is the only thing the user's own eyes
genuinely cannot do.

**If a test is run, match it to what changed.** A 25-minute gate is one that gets skipped
or truncated, which is worse than a small one that runs.

| What changed | Run | Costs |
|---|---|---|
| Content (a bank, a unit file) | `--only=content` | ~20s |
| One game's own logic | `--only=<game>` | ~40s |
| Shared layer 1 | `--only=millionaire,fit,phone,card,turns,gameshow,lab,registry,competition` | ~4 min |
| A playground page | `--only=playground,forms,bench,qbench` | ~1 min |
| A round | `--only=qbench,grouping,anagram,card,gameshow` | ~4 min |
| The Lab board | `--only=grouping,content,jeopardy,card` | ~2 min |
| Phones / relay | add `,buzzers,phonemodes,teamvote,phoneteams,degradation,reconnect,playground,bench` | +6 min |
| Before a lesson you will teach from, or on request | the full suite | ~25 min |

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=… > /tmp/run.txt
```
- **Never pipe through `tail`** — that reports the *pipe's* exit code, so a red run looks
  green. Redirect to a file; you also get progress while it runs.
- **`pgrep -f smoke-test.js` matches the waiting shell itself**, so `until ! pgrep …`
  never finishes. Use `ps -eo args | grep "[s]moke-test"`.
- **One throw takes the rest of a suite.** `.innerText()` on a locator matching nothing
  waits thirty seconds and throws while the argument is being built. **A red total is
  trustworthy; a green-looking partial is not** — check which sections ran.
- **When a shared behaviour changes, grep for the assumption before re-running.** Three
  helpers compared a rendered prompt against the raw string and broke together; one grep
  would have found all three, and three full runs did not.
- **Prove a red is pre-existing** with `git worktree add /tmp/base <sha>` — no stashing,
  about a minute.

**Verifying UI changes** (when a check has been agreed, or something is being debugged):
Playwright + Chromium are available, browser at `/opt/pw-browsers`; open a hub via
`file://…`. Stills, layout and text are checkable. **Motion is not visible to the agent**
— animation is inferred from computed styles, never watched. **Audio is entirely
unverifiable.**

## Constraints
- No build step; must run by opening a file. Fully offline — use `<script src>`, not
  `fetch`, which browsers block on `file://`.
- Standard classroom TV/browser; large fonts, high contrast, readable at distance.
- Teacher controls everything. Race to the Board is the one game students are physically
  involved in — they touch the *projected image*, which isn't a touchscreen.
- Repo is **public** — nothing committed that shouldn't be internet-visible.

## Open
What is true and unfinished. Not a changelog — an item leaves when it closes.

**Build `20260819a`.** Three coursebooks, ~760 authored items, six games, nine rounds.
Every game now lives in its own file under `game-hub/games/`; `hub-engine.js` is layer 1
only.

**Open-question tuning is guessed, not measured.** The open-question work — a right
answer no longer locks the room out, position and time recorded, standings after every
question, the solo commit beat with its escalating cooldown, the crowd reveal and its
meter. Every number in it is a guess (the 60/30 podium shares, the 0.5 floor, 3s
escalating to 9s, the 40% reveal), which is why the settings are marked `quick` — they
are meant to be flipped, not trusted. Three things to watch the first time a class meets
it, likeliest wrong first: whether standings after *every* question drags
(`roundWinBanner` turns it off), whether the podium beats `equal`, and whether the extra
Reveal-then-Close press costs too much (`roundOpenToAll` off restores the race).

**Being chased right now — the room bench hosts no room.** Four symptoms, all
downstream of one thing: the board mints no code, so the bench's box stays empty and
has to be typed; a typed code names a room nobody is hosting, so the phones never
leave `#screen-join` — which is the team picker, hence "stuck on a team selection
screen"; no host means no roster push, so teams-or-individuals never reaches them;
and the bench's own names never arrive because its phones join by URL only after it
has a code.

**It is not the code that shipped today.** `main` was reverted whole to the build
before the Connections work and the symptoms stayed, which eliminates both that and
the two bench reads after it. Nor does it reproduce: a clean Chromium against a
locally-run relay with **Phone buzzers on** auto-fills the code, racks a phone,
carries names, and flips the rack the moment the board's team bar goes Solo.

So the difference is the environment, and there are three candidates, likeliest
first. **The relay is not answering** — Render's free instance sleeps when idle and
every push restarts it, and six went out in one afternoon. **The wrong copy** —
GitHub Pages has no relay behind it at all, so phones can never work there. **Phone
buzzers switched off** on that device — `openBuzzRoom` returns immediately without
it and the board hosts nothing, silently.

Three answers settle it, and no more work should be guessed at until they are in:
what `/buzzer/health` says on the same address the bench is opened from, what build
⚙ reports, and whether the board's own chip shows five digits.

**Known broken:**
- The ordering climb card is 726px on a 720 board with the action strip on.
- **The clue card covers the phone strip** — on Jeopardy and Blockbusters the cooling
  countdown sits behind the card for exactly the seconds it describes. The precedent is
  `#buzzer-chip` at z-index 51 over the card's 50, which would draw across the card's own
  topline, so it wants a decision rather than a reflex.
- **An index is not an identity.** Every round keys per-team state by index; keying by
  the competitor id every competitor already carries is the real answer, and it touches
  every round. Related and **not** broken, but the thing to check before adding a third:
  a cache of somebody else's index needs a stated invalidation point, and there are
  exactly two. `players` in `hub-buzzer.js` is replaced wholesale by every relay event
  carrying a roster, so it is only ever as fresh as the last message — and it reports
  each handset's **join-time** team, which is not the truth in a room of individuals.
  `teamSeat` in `hub-engine.js` is the side a student chose, written only on `join` and
  clamped to the current team count when read, so removing a team cannot strand it. A
  third cache that used to exist was **deleted rather than fixed**, by asking the room
  instead of remembering what it was told; that is the cheaper answer.
- **The shell has no `Cache-Control`**, so a stale shell can strand a browser on old
  assets with no error anywhere.

**Deferred with a stated trigger:**
- **The relay's per-player declaration.** Adding one per-player fact is seven hand edits
  in four places, easiest missed being the join payload — which fails only for students
  whose wifi dropped. The reliability half is taken (`check-syntax` compares the arm and
  join key sets); the trigger for the rest is **the next round that wants a new
  per-player fact**, not before.
- **`typeCooldown`, `typeStrict`, `phoneOneEach`** are registered globally rather than as
  the default round's own tuning.
- **Bingo and Race are not extracted** onto their rounds. Last on purpose: nothing left
  to learn from them that a third host would not teach more cheaply. Race needs more than
  a mount — its answers *are* the board.
- **Content filing (the tagged pool, §3.11)** is decided against for now. Content stays
  in per-game banks.

**Content owed:** NEF-1 still carries simple questions on Jeopardy and Blockbusters. Unit
5's six ordering scales are plausible C1 English the unit never teaches — an audit against
`material/` is owed on all three units. The newer question forms sit at 4.1% of items, so
a round can pass without meeting one; Millionaire's per-rung filtering makes three items
nearly invisible. Unit 4's race and millionaire banks, and its Jeopardy 4C/4D categories.

**Open questions only a classroom answers:** whether thirty phones typing kills the pace
and whether the cooldown reads as punishment or pause; whether the music bed fights the
teacher's voice on classroom speakers; and **a phone check on a real handset**, since
Chromium emulation does not model browser chrome changing height as you scroll.
