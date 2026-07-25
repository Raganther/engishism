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
sed -i '' 's/?v=[0-9a-z]*/?v=20260728d/g' game-hub.html game-hub-unit4.html game-hub-unit5.html join.html   # macOS
```
The engine reads its own `?v=` and exposes it as `window.HUB_BUILD`; the settings panel
footer shows it, so **"Build …" in ⚙ tells you which version is actually running.**

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

## Solve once, use anywhere
Anything more than one game needs lives in `hub-kit.js`, not in a game:

| Service | Replaces | Used by |
|---|---|---|
| `Kit.fitToScreen(el, {min,gap})` | three separate header/team-bar measurements | Jeopardy, Race, Millionaire |
| `Kit.anim.register/get(feature,name)` | hard-coded animation keyframes | the clue card, and whatever comes next |
| `Kit.claimTeam({mount,onPick})` | Blockbusters' two buttons + Race's own bar | Blockbusters (`allow:[0,1]`), Race |
| `Kit.shapeOf(origin,target)` | animations assuming everything is a rectangle | the `morph` card animation |
| `Kit.passTurn(count,current)` | four ad hoc rotations | all four games |

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

Still missing for Unit 5: **5D entirely** (the writing lesson — opinion essay and
linking for addition/reinforcement, both very gameable), pronunciation beyond one
item, the p66 crime idioms, and anything from the reading texts.

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

`type:'select'` takes `options:[{value,label}]`. `S.onChange(fn)` is for settings that
should change what's already on screen without restarting the game. Values persist in
`localStorage` per device; a browser that blocks storage on `file://` silently falls
back to memory for the session (the panel says so).

## Source material & specs
- `material/empower-c1-unit-4/`, `material/empower-c1-unit-5/` — Cambridge Empower
  C1 workbook page scans (indexed by page/section) the game content is authored from.
- `docs/game-hub-requirements.md` — the MVP spec (per-game content model, game tier
  analysis, success criteria). The key open metric: realistic authoring time per unit.
- `docs/design-reference.md` — DCU International Academy brand (navy/sky-blue/yellow/cream).
- `.claude/*.md` — older experimental domain notes (product vision, lesson pipeline,
  activity schemas). Reference only; not required reading.

## Current status
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
  the body padding while they're up. Both re-fit on resize. Jeopardy tiles used to
  take their height from a fixed 3:2 aspect ratio, so fewer categories meant taller
  tiles and up to 1400px of hidden board — don't reintroduce a fixed aspect ratio.
  Blockbusters is the same lesson in a different disguise: `layoutBlockbustersBoard()`
  spaces the hexes from their **rendered** width (a `vw` clamp), so it must run after
  `showScreen('screen-play')` — measuring behind a hidden screen returned 0, fell back
  to a hard-coded 90px step, and the hexes overlapped by 21px at 1440px wide. Building
  and laying out are separate, and positions come from `data-row`/`data-col`, so a
  resize repositions without rebuilding and claimed hexes keep their colour.
- **Phone buzzers (first draft, no classroom run yet).** Students open `join.html`,
  enter a 5-digit room code + name + team, and get one big buzzer. In **Race to the
  Board head-to-head** a sentence arms the buzzers; the first buzz takes the floor and
  *carries the team*, so a correct word scores automatically and the "who touched it
  first?" chooser never appears. Wrong word = no penalty, buzzers re-open for a steal.
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
- **Game show mode** — a second skin, **Millionaire and Jeopardy**. `theme` is a variant
  setting (`dcu` | `gameshow`); `body.theme-gameshow` goes on when a themed game
  reaches the play screen and comes off when you leave, so the chrome never
  half-changes (a neon board over a navy team bar reads as broken). The DCU theme
  is the default and is untouched — the skin is pure override.
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
    Millionaire: spotlight closing in, chase lights down both sides, gold.
    Jeopardy: blue starfield, gold-on-navy tiles, a board that **deals itself in**
    on the diagonal (`jDeal`). `--tension` is the same contract in both, but the
    number comes from somewhere different — Millionaire's rung vs Jeopardy's
    *value at stake* over a floor that rises as the board empties, so a $500 late
    on is the hottest the board ever gets. **Stagger on `row+col`, never DOM
    order**: a 12×6 board is 72 cells, and a flat stagger runs for 3 seconds with
    the class waiting on it.
- **A cleared Jeopardy board now ends the game** — `jFinish()` ranks the teams,
  handles a tie, and raises the shared `showResult()` banner. Theme-independent;
  the game-show skin just adds the fanfare and applause on top. Same gap
  Blockbusters had.
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
  - **The faces need separate z planes** (`translateZ(2px)`). Coplanar faces z-fight
    and the front bleeds through mirrored — that's what made `$500` read as `005`.
    `#clue-card.flipped #clue-front{visibility:hidden}` is the belt-and-braces.
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
- **Game show mode covers Millionaire and Jeopardy; Blockbusters and Race are next.**
  Adding one is: the game in `theme`'s and `intro`'s `games` arrays, an `INTROS`
  entry, and its stage rules in the skin block of `hub.css` — no engine change.
  Sketched: Blockbusters, honeycomb assembling itself, applause on the winning route
  (`showResult` and the route trace are already there, so this is nearly all CSS);
  Race, stadium wash and a starting pistol. **Still untried in a real room** — check
  the music bed isn't fighting the teacher's voice on classroom speakers, and whether
  the title sequence is still welcome by the fourth round.
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
NODE_PATH=$(npm root -g) node tools/smoke-test.js        # ~11 min, 170 checks
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=jeopardy,fit   # while iterating
```
Drives all four games in a real browser and checks the things that have actually
broken before: boards running off screen, the flip landing on the wrong tile, settings
not persisting, buzzers not degrading when the relay is gone. Starts its own relay,
exits non-zero on any failure. `--url=` tests a deployed copy instead.

## Verifying UI changes
Playwright + Chromium are available (global `playwright`, browser at
`/opt/pw-browsers`). Open a hub via `file://…` and exercise it to confirm changes
render and play before committing.
