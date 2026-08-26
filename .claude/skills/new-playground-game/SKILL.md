---
name: new-playground-game
description: Build a standalone game in the Engishism playground — its own page, its own rules, optionally its own phone pages — outside the hub but on the shared phone room and physics shelves. Use this whenever the user wants a new game idea developed independently of the game hub, a multiplayer game where phones run a full game page rather than join.html, a physics game on Kit.table, or asks why a playground game misbehaves on the Room bench or on a real handset. Also use it when deciding whether an idea is a playground game, a round, or a hub game.
covers:
  - "playground/battle-scrabble.html"
  - "playground/battle-scrabble-board.html"
  - "playground/throw-lab.html"
  - "playground/phone-bench.html"
  - "playground/bench-kit.js"
  - "playground/phone-profiles.js"
  - "playground/word-list.js"
  - "game-hub/hub-table.js"
---

# Building a standalone playground game

A **playground game** is a complete game that lives outside the hub: its own page(s),
its own rules, its own ending — zero risk to the teaching tool — but built on the
shared shelves so its organs are portable from day one. Battle Scrabble
(`battle-scrabble.html` + `battle-scrabble-board.html`) is the worked example.

## 1. Are you in the right skill?

| The idea is… | Skill |
|---|---|
| a question a game show asks (card + phones + judging) | `new-round` |
| a way a prompt is drawn | `new-question-form` |
| a board inside the hub, inheriting teams/scores/timer | `new-game` |
| **a whole game of its own, developed independently** | **this one** |

The size test: a round never scores and lives inside one question slot. The moment the
idea owns points, a clock, a winner, or players acting on each other, it is a game.
**Three fates, decided only after a real classroom run:** stay standalone, graduate
whole via `registerGame`, or distil its dynamic into a round (the toss round is
Battle Scrabble's dynamic distilled — same `Kit.table`, none of the session).

## 2. The lane's non-negotiables

- **Standalone, self-contained page(s).** No hub engine, no hub skin, no `registerGame`.
- **Content in a marked block at the top**, so a teacher can edit it. A big word list is
  its own vendored file (`word-list.js`) — the app runs offline with no build step.
- **No relay must leave it fully playable teacher-only.** The playground suite asserts
  this for every page. Solo play is the degradation path, not a demo mode.
- **A plain URL is the solo game.** Room chrome (join strip, opponent UI) appears only
  when a room is real.

## 3. The room — two declared facts and the bench follows

The board page opens its room with `BenchKit.room({ mount, board, joinPath, on:{…} })`.
Two globals are the whole contract with the rest of the system:

- **`window.HubHost`** — what room this page is hosting. BenchKit sets it for you.
- **`window.HubPhonePage`** — what page the phones run. Set automatically from
  `joinPath` when you name one (Battle Scrabble names its own phone page; the QR and
  the Room bench both follow it). Name none and phones get join.html.

That pair is ALL `phone-bench.html` needs: it racks any board it has never heard of.
Open it as `phone-bench.html?board=<your-board>.html`, and add your board to its
`#board-pick` menu.

## 4. Full-page phones

- **Own seat key** (e.g. `engishism.battle.seat`), never join.html's `engishism.seat`.
  Reconnect = same stored id, same seat; the board keeps seats append-only so a
  drop-and-return cannot shuffle who neighbours whom.
- **The `?auto=1` simulated-phone contract, via `HubBuzzer.sim()`** — returns null on a
  real phone, else `{code, name, id, team}`. When simulated: **never write or read the
  seat** (every bench iframe shares one localStorage; one seat key would be fought
  over), mint a fresh id unless one is handed in, and join immediately with no UI.
  Implement it with `sim()`, never by re-parsing the URL — the contract has one home.

## 5. The wire

- Up: `respond()` — **the relay truncates at 120 chars**. JSON tagged `t`, plus a
  per-phone sequence `q`; the receiver drops `q <= lastQ[t]` — **per message TYPE**,
  because the relay stores one value per player and REPLAYS it on reconnect, and a
  replay is of one stored value. One shared counter is the bug, not a simplification:
  two messages sent in the same tick are two concurrent POSTs on two sockets, nothing
  orders them, and when the later `q` arrives first the earlier message is dropped as
  a "replay" — permanently, if the sender dedupes at send time.
- Down: `host.nope(id, json)` — per-phone push, no length cap.
- **Unknown `t` is silently ignored on both ends.** That is the compat rule; it is what
  makes a new message additive.
- **The board routes, it never interprets.** Player-to-player traffic (a thrown tile, a
  live word) goes phone → board → target phone with the payload carried whole. The
  board is the only authority on who neighbours whom.
- Start rides `arm({mode:'answer', rethink:true, secs})` — `rethink` is what lets a
  phone respond repeatedly; hold the room armed a few seconds past time-up so finals
  land.

## 6. Physics: Kit.table (`game-hub/hub-table.js`)

The shelf every physics game shares (throw-lab, the toss round, join.html's table
mode, Battle Scrabble). Surface: `slots(n | {cols,rows,top})`, `setPieces`,
`addPiece(label,{x,y,vx,vy,hue,shot})`, `openSides({l,r})` + `onExit` (the door a
travelling tile leaves through), `place`, `read`/`cells`, scoped
`setResult(res, slotIdx)`, `grab/move/drop`, `step`, `draw`, and the test windows
`loose()`, `slotBox(i)`, `tileSize()`.

Paid-for traps — every one cost a debugging session:

- **It is transport-agnostic (axiom 4).** It takes canvas-space coords and hands back
  answers; the page owns pointers, wire, and judging. Divide pointer coords by any
  CSS `transform: scale` — the table sizes to the *natural* offsetWidth.
- **`step()` advances by wall clock, not by call count.** Never assume one call = one
  tick: a 120Hz phone calls twice as often, and per-call stepping ran the game at
  double speed there. Emulation is 60Hz and will never show this.
- **A dragged body's velocity under-reports** — Matter moves it by position
  corrections. The flick/place decision (`feel.dock`) judges the *finger's* recent
  speed, not the body's.
- **Fresh pieces hold before they can exit** (arrival ~900ms, a deal's rain ~1500ms) —
  without the hold, an arriving tile caromed straight back out and two open boards
  ping-ponged one tile forever.
- **On a real phone, size from the real viewport**: `height:100dvh` on the body and a
  refit on `visualViewport` resize — mobile browser chrome changes the visible height
  without a window resize.
- **Phone geometry comes from `phone-profiles.js` — never a hardcoded viewport.** The
  one home for what a handset's VISIBLE screen is (browser bars subtracted); the Room
  bench racks at it and the suite opens phone pages at it, `standard` by default. The
  chrome-less 844 is the comparison case, not the truth — a layout passing only there
  is the classroom-photos bug again. Engine differences (refresh rate, touch, real
  Safari) cannot be emulated at all: remove the dependence instead, as above.

## 7. Testing a playground game

- Expose a debug handle (`window.__bs` style): the world, `state()`, the entry points
  a test needs (`deal`, `bank`, a wire-level `throw`), and a `read` that re-derives
  what `place()` skips (place fires no onArrange).
- Drive deterministically: `place()` for arrangements, `addPiece` probes (find them
  again by a unique `hue`), `loose()` to see the table, `slotBox()` to aim at real
  coordinates.
- **Release mid-motion inside ONE evaluate** — a separate `drop()` call one frame after
  the last `move()` lets the spring brake the tile and reads as a slow release.
- **Let the rain settle before aiming a shot** — a falling loose tile between the shot
  and its target absorbs the hit, and the check flakes.
- **Prove every new check by reverting its fix** before trusting it. Flipping a
  slider's `value` attribute is NOT a revert — a range input clamps to min/max; flip
  the constructor value.
- Suites: `--only=battlescrabble` for the worked example, `bench,playground` when the
  bench or bench-kit moved, `qbench` when `hub-table.js` moved (the toss round rides
  it).

## 8. Ship

`ship-it` owns the how. The one rule that bites here: **`hub-table.js` and
`hub-buzzer.js` are under `game-hub/`** — touching them means a cache-stamp bump even
though you were "only working in the playground".
