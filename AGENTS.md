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
sed -i '' 's/?v=[0-9a-z]*/?v=20260726a/g' game-hub.html game-hub-unit4.html game-hub-unit5.html   # macOS
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
   - `game-hub/hub-settings.js` — settings registry + panel (⚙ in the header).
     **Must load before hub-engine.js** (the engine throws without it).
   - `game-hub/hub-buzzer.js` — phone-buzzer client, shared by the hub (host) and
     `join.html` (players). Optional; absent relay = absent feature, nothing breaks.
   - `tools/buzzer-relay.js` — zero-dependency Node relay **and** static server for
     buzzer lessons. `join.html` is the students' page. See `docs/buzzers.md`.
   - `game-hub/hub.css` — shared styling (DCU theme); the one place to restyle.
   - `game-hub/content/unit-4.js`, `unit-5.js` — data-only content banks; each does
     `window.UNITS.push({ id, label, card, jeopardy…, blockbusters… })`.
   - Games: **Jeopardy**, **Blockbusters** and **Race to the Board**. Per-game content
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

## Adding a feature (settings-first)
Every new feature gets a switch. Register it at the top of `hub-engine.js` and the
panel builds its own row — **there is no panel markup to edit**:

```js
S.register({ id:'myThing', group:'Race to the Board', type:'toggle', default:true,
             label:'Human-readable name', help:'One line on what it does.' });
// then, wherever it matters:
if(S.get('myThing')) { … }
```
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
  **3 games** (Jeopardy, Blockbusters, Race to the Board), shared engine, DCU-branded.
- **Race to the Board** (Unit 5 only so far, 36 prompts across 5A–5C): target words
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
- **Persistent shared team bar** on every screen: team names + points survive
  moving between games, units, and setup screens (nothing resets on navigation).
  Both games feed one score — Jeopardy awards the tile value to the selected team;
  Blockbusters awards +1 per claimed hex to Yellow/Blue (teams[0]/[1]).
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
- **Phone buzzers (first draft, no classroom run yet).** Students open `join.html`,
  enter a 5-digit room code + name + team, and get one big buzzer. In **Race to the
  Board head-to-head** a sentence arms the buzzers; the first buzz takes the floor and
  *carries the team*, so a correct word scores automatically and the "who touched it
  first?" chooser never appears. Wrong word = no penalty, buzzers re-open for a steal.
  - Phones never talk to the laptop directly — school WiFi blocks that. Both ends
    connect out to `tools/buzzer-relay.js`, the same shape as Kahoot.
  - **The relay serves the site too, deliberately**: an https GitHub Pages page may not
    talk to a plain-http LAN relay (mixed content). For a buzzer lesson, run the hub
    from the relay. A hosted https relay lifts that restriction — ⚙ → Relay address.
  - **Everything degrades**: buzzers off, relay dead, or WiFi gone → the hub behaves
    exactly as before with the manual chips / `1`-`2` keys. Verified for all three.
- **Settings panel** (⚙ in the header, Esc or click-away to close), built from a
  registry so a new feature's switch appears by registering it — see "Adding a
  feature" above. Currently: sound on/off, volume, race re-scatter, race round
  length, race section tag. Saved per device; **Reset to defaults** restores all.
- **Sound effects** — synthesised with Web Audio (no audio files, so offline still
  works): rising tone for right, buzz for wrong, chime on a Blockbusters claim,
  fanfare on a cleared board, low tone when a timed round expires, a swoop on the
  card flip and a chime on the answer reveal.
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
- Author Unit 4's race bank (4A–4D) once the format is settled; Unit 4 currently
  shows only Jeopardy + Blockbusters.
- Measure authoring cost per unit (the number the demo pitch hinges on). Race is the
  cheapest data point so far: 36 prompts, no distractors.
- Fill Unit 4's Jeopardy gap — the card claims 4A–4D but only 4A/4B have categories.
- Small wins: "steal" in Blockbusters (wrong → other team claims); winner banner
  when a Jeopardy board is cleared; self-host fonts for true offline.
- Product-line decision: is the Game Hub now the product, with #2/#3 as legacy?

## Constraints
- No build step; must run by opening a file. Fully offline (use `<script src>`,
  not `fetch`, which browsers block on `file://`).
- Works on a standard classroom TV/browser; large fonts, high contrast, readable at distance.
- Teacher controls everything; students never touch the device. (Race to the Board is
  the one game students are physically involved in — they touch the *projected image*,
  which isn't a touchscreen, so the teacher still does every click.)
- Repo is **public** — don't commit anything that shouldn't be internet-visible.

## Verifying UI changes
Playwright + Chromium are available (global `playwright`, browser at
`/opt/pw-browsers`). Open a hub via `file://…` and exercise it to confirm changes
render and play before committing.
