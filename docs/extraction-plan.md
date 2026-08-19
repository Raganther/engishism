# Game extraction — done

**All four originals are extracted.** Jeopardy — the last, and the game the shared clue
card was built around — now lives in `game-hub/games/jeopardy.js`. `hub-engine.js` is
layer 1 only; it registers no games. The pattern below is kept because it is how the next
card game gets built, not because anything is left to move.

`hub-engine.js`: **8455 → ~5490 lines.** Every game is in its own file: `jeopardy.js`,
`blockbusters.js`, `race.js`, `millionaire.js`, `quickfire.js`, `bingo.js`.

## What the Jeopardy extraction added to the shared layer

- **The clue card's buttons stay the engine's; their behaviour is the game's.** Reveal,
  Correct, Wrong, Close and Skip route to `onClueReveal` / `onClueCorrect` /
  `onClueWrong` / `onClueClose` / `onClaimPick(null)` — a card game with no such button
  (Blockbusters has no Correct/Wrong) declares none, and Close falls back to shutting the
  card.
- **`onFloorClear`** stops whatever answer clock a game runs (Jeopardy's `jAnswerSeconds`),
  called from `roundHold`, the reveal button, `closeModal` and `armBuzzers`.
- **`onScoreShown`** fires at the end of `renderScorebar`, so a game repaints anything it
  hangs off the scores (Jeopardy's Together class-total line) with no score-changing path
  remembering to call it.
- **`floorSeconds()`** — the answer-clock duration the relay hands the phone that takes
  the floor, declared by the game rather than switched on its name in `armBuzzers`.
- **`onCard: true`** on a card game's `roundHost`. This replaced two `roundHost.mount ===
  CARD_MOUNT` reference checks (`roundHolds`, the `roundWinClose` games list). An external
  file's `mount` is a wrapper around `E().cardMount()`, never the engine's own
  `CARD_MOUNT` reference, so the identity check silently failed — a won round auto-paid
  instead of waiting on the card. **The Blockbusters extraction had already tripped this
  latent; the same `onCard` fix repairs both card games.**
- **`currentClueValue`** stays engine-held (the standings report labels an entry with it)
  and is written by the game through `E().setClueValue`. `modalMode`'s `'review'` is just
  another Jeopardy-owned value on the shared string — the engine never branches on it.

## The extraction pattern (followed by all three)

An extracted game is `(function(){ 'use strict'; const K=window.HubKit; const
S=window.HubSettings; const E=()=>window.HubEnv; … })()`. It reaches the engine **only**
through `E().x`, resolved at call time (the engine loads *after* the game file). It:
- declares `roundHost: HOST` (merged into ROUND_HOSTS at engine init),
- declares `stageHTML` (the play stage — injected by the engine; content-screen chrome
  like `#…-rules` stays in the engine skeleton and the file only drives it),
- wires DOM listeners lazily in `wire()` on first `load()`,
- declares an `order` (Jeopardy should be **50** — it sits first),
- moves its game-GROUP settings into the file; shared-group settings (Competition,
  Phones) stay in the engine,
- adds a `<script>` between `hub-games.js` and `hub-engine.js` in **all four shells**
  (game-hub.html, -unit4, -unit5, -lab),
- replaces every engine→game poke of its private state with a **declared hook**
  (default no-op in hub-games.js).

**Process per game:** read every piece from the *actual* engine text (do not transcribe
settings from memory — that bit me once on Blockbusters), build the file, add HubEnv
members, untangle shared references, delete from engine bottom-to-top re-grepping each
piece fresh, run the dangling-symbol grep, add script tags, `check-syntax`, targeted
smoke, bump stamp, commit, merge, push.

## The HubEnv surface now exists (Jeopardy reuses it)

Because Blockbusters is a card game, HubEnv already lends the whole clue card. Jeopardy
needs almost nothing new here:
`openClueCard, closeModal, hideAllActionButtons, renderRoundButton, clueIsOpen,
cardMount, modalMode()/setModalMode, currentTile()/setCurrentTile, clueItem()/setClueItem,
clueClaimShow/clueClaimHide, flipHoldMs, askClass, parkBuzzRoom, activeGameId`, plus the
round adapter, scoring, surfaces, roster and `dealStagger`/`stageTension`/`startGate` from
the earlier games.

## Declared hooks that now exist (add to the list only if Jeopardy needs a new one)

`onTeamsChanged(i)` (roster re-align), `onClaimPick(i)` (chooser pick + `null`=skip),
`voteLive()`, `onRoomDrop()`, `onRoomSync()`, plus B4's `cardGlow/onClueReveal/
onRoundReveal`. Jeopardy already declares `cardGlow`, `onClueReveal`, `onClaimPick`
(currently `jSteal ? jTakeSteal(i) : null`) — these move into its file verbatim.

## Still owed a class (not blockers, per the CLAUDE.md change — just watch-items)
- Millionaire: removing a team mid-game keeps the ladders with the right teams
  (`onTeamsChanged`).
- Blockbusters: mid-game team removal (`onTeamsChanged` → bbSideAt), and the hexagon vote
  under a real relay (rewired through `voteLive`/`onRoomDrop`/`onRoomSync`).
- Race/Millionaire: normal play on a real board + phones.

## Other backlog (unchanged, low priority)
- C10 `HubBuzzer.roomInfo()` for join.html — phone-layer, needs a device.
- The `close-btn` review branch is the one bit of B4 deliberately left for the Jeopardy
  extraction (see untangling #2).
