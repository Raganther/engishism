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

## Architecture — three generations coexist
1. **Classroom Game Hub (current focus).** The MVP demo. One consolidated app;
   flow is **choose unit → choose game → choose sections → play**.
   - `game-hub.html` — the app: loads every unit content file + the engine
     (linked from index.html). Units register into `window.UNITS`.
   - `game-hub-unit4.html`, `game-hub-unit5.html` — per-unit deep-links (load one
     unit; the engine auto-skips the unit-select step).
   - `game-hub/hub-engine.js` — all game logic + injected UI skeleton; renders the
     unit/game/section/play screens, the persistent team bar, and the timer.
   - `game-hub/hub.css` — shared styling (DCU theme); the one place to restyle.
   - `game-hub/content/unit-4.js`, `unit-5.js` — data-only content banks; each does
     `window.UNITS.push({ id, label, card, jeopardy…, blockbusters… })`.
   - Games: **Jeopardy** and **Blockbusters**. Per-game content model (content lives
     in data, separate from the engine). **Adding a unit = one content file + a
     `<script>` line in game-hub.html.**

2. **Unit-first whiteboard app (earlier rebuild, paused).**
   - `index.html` (landing) → `app.html` → `engine/unit-app.js`; 1 unit, 2 games
     (Picture Choice, Sentence Builder), shared `engine/interactions/tile-tray.js`.

3. **Legacy topic-first engine.**
   - `classic.html` → `engine/engine.js`; 18 activity types, topics, lessons, plus
     4 standalone team-building games (`bunker`, `desert-island`, `it-helpdesk`,
     `scam-or-legit`). Reachable via the landing page's "Classic games" link.

`index.html` links all three (Choose a unit / Game Hub / Classic games).

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
  **2 games** (Jeopardy, Blockbusters), shared engine, DCU-branded.
- **Persistent shared team bar** on every screen: team names + points survive
  moving between games, units, and setup screens (nothing resets on navigation).
  Both games feed one score — Jeopardy awards the tile value to the selected team;
  Blockbusters awards +1 per claimed hex to Yellow/Blue (teams[0]/[1]).
  **↺ Reset points** zeroes scores but keeps names; +/- for manual correction;
  rename + add-team; active-team / whose-turn highlight.
- Teacher **countdown timer** in the header on the play screen (start/pause, reset,
  ±15s, red under 10s).
- DCU reskin: light theme, geometric band, uppercase grotesk, game-card icons.
- To change unit mid-session: game screen → "New game" → "Change unit".

## Next
- Measure authoring cost per unit (the number the demo pitch hinges on).
- A third game format (Millionaire or Bullseye, per the spec — both transfer well).
- Small wins: "steal" in Blockbusters (wrong → other team claims); winner banner
  when a Jeopardy board is cleared; self-host fonts for true offline.
- Product-line decision: is the Game Hub now the product, with #2/#3 as legacy?

## Constraints
- No build step; must run by opening a file. Fully offline (use `<script src>`,
  not `fetch`, which browsers block on `file://`).
- Works on a standard classroom TV/browser; large fonts, high contrast, readable at distance.
- Teacher controls everything; students don't touch the device.
- Repo is **public** — don't commit anything that shouldn't be internet-visible.

## Verifying UI changes
Playwright + Chromium are available (global `playwright`, browser at
`/opt/pw-browsers`). Open a hub via `file://…` and exercise it to confirm changes
render and play before committing.
