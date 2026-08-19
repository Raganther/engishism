# Game extraction — status and handoff

**Where we are:** four of the four originals were the goal; **three are done**
(Millionaire, Race, Blockbusters), **Jeopardy is the last one left in `hub-engine.js`.**
Everything below is written so a fresh context window can finish Jeopardy.

## Done and live on `main`

Session commits (all merged to main, all verified green before merge):

| Commit | What |
|---|---|
| `8847982` | #1 mispay fix — re-put a live round on the roster when a team is removed mid-question (the `roundRebuildForRoster` in removeTeam) |
| `87887ca` `149bab4` | B4 — clue-card `activeGame`/`modalMode` name-branches → declared game hooks (`cardGlow`, `onClueReveal`, `onRoundReveal`, `onClaimPick`) |
| `01d8617` | Millionaire → `game-hub/games/millionaire.js` |
| `b7e8758` | Race → `game-hub/games/race.js` |
| `e68ea4f` | CLAUDE.md — dropped the "nothing else until a class has met it" gate |
| `8ac9b14` | Blockbusters → `game-hub/games/blockbusters.js` |

`hub-engine.js`: **8455 → 6618 lines.** Games now in their own files: bingo, quickfire,
millionaire, race, blockbusters. Card stamp is at `20260818j`.

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

## Jeopardy — the last extraction

**~1000 lines, scattered across ~10 regions, and it is the substrate the clue card was
built around** — so the untangling, not the line-moving, is the work. Do a focused recon
first (like the Blockbusters one), then build.

### Footprint (current line numbers, will drift)
- register `id:'jeopardy'` ~121; `ROUND_HOSTS.jeopardy` (now the only host entry, ~343)
- `= JEOPARDY =` board block ~2501: buildJeopardyBoard, jDeal, jValueRange, jTension,
  fitJeopardyBoard, fitCategoryHeadings, categoryName, jTogether/jClass*/renderClassLine
  (together mode), jHint*/renderHintButton, jPlantDailyDoubles, the wager
  (jWager/openWager/closeWager/renderWager/jMaxWager)
- clue+steal+final ~4364: openJeopardyClue, jShowClue, jClockStart/Stop, jOfferSteal/
  jDeclineSteal/jTakeSteal, jCorrect (~5005), jFlash, jAfterClue, the Final sequence
  (jFinalPlayers, jStartFinal, jFinalNextBet, jFinalAsk, jFinalSettle), jFinish (~5224),
  jFinishTogether (~5251)
- content/start: renderJeopardyContent, jeopardyStartButton
- settings: the `group:'Jeopardy'` set + the Classic ruleset (jRules) and its members
  (jDeduct, keepControl is Competition-shared, jAnswerSeconds, jHints, jWager toggle,
  daily-doubles, together) — move the Jeopardy-group ones, leave shared-group ones
- state vars: `modalMode`, `currentTile`, `currentClueValue` are declared together near
  the SHARED CLUE MODAL section. **`modalMode`/`currentTile` are shared (stay, exposed).
  `currentClueValue` is Jeopardy's — it moves, and shared readers must be checked** (the
  cardGlow hook already reads it via the game; `roundPaySlot`/the wrong-btn deduct read
  it in the engine).

### The untangling that is left (the actual hard part)
These are the shared clue-card things still written Jeopardy-first. B4 handled the
review-independent ones; these remain:

1. **The reveal / wrong / close / skip button handlers are Jeopardy's, living in shared
   code.** reveal-btn already calls `gameDef(activeGame).onClueReveal()` (B4). But
   wrong-btn (the deduction, jSteal, jDoubleTeam, jAfterClue, nextTurn) and close-btn
   (jTension restore, closeWager, roundWin) and skip-btn (jDeclineSteal) are Jeopardy
   logic. When Jeopardy leaves they must either move into the game (the game wires them
   in `wire()` on its own #reveal-btn/#wrong-btn/#close-btn/#skip-btn — but those are the
   *shared* card buttons) **or** route through hooks. Decide: are these buttons the clue
   card's (shared, route to hooks) or Jeopardy's (move the listeners)? Blockbusters used
   the skip button too, via `onClaimPick(null)` — so the buttons are shared and the
   *behaviour* is the game's. Likely answer: add `onClueWrong`/`onClueClose` hooks the
   shared handlers call, the way `onClueReveal` already works.
2. **`modalMode==='review'`.** Jeopardy has a review mode (replay a played clue, score
   nothing). The close-btn's `modalMode==='jeopardy'||'review'` and openJeopardyClue's
   `modalMode = review ? 'review' : 'jeopardy'` are the only places 'review' lives.
   `activeGame`/`roundHost` do not carry it. Give 'review' a declared home — simplest is
   a `reviewMode` boolean the game sets alongside `setModalMode`, or let Jeopardy keep
   'review' as one of its own modalMode values (it sets modalMode via HubEnv anyway).
3. **`jHints` gate** (`modalMode==='jeopardy'`) is inside Jeopardy's own hint code — moves
   with the game, becomes trivially true.
4. **`let roundHost = ROUND_HOSTS.jeopardy`** is the engine's default host. After Jeopardy
   leaves, ROUND_HOSTS is populated entirely from game files at init — the default
   initialiser must not name jeopardy. Check `roundHost`'s declaration and the
   `if(d && d.roundHost && !ROUND_HOSTS[g])` merge still seeds it.
5. **`modalMode='jeopardy'` as the assumed baseline** — grep every remaining `modalMode`
   read after the move; each should be either a game-internal check (moves out) or a
   shared handler that now routes through a hook.

### Verify
`--only=jeopardy,gsjeopardy,jfinish,classic,together,jclock,competition,card,registry,
fit,phone,gameshow` (Jeopardy has the most sub-suites — Final, Classic ruleset, Together
mode, the answer clock). Confirm Blockbusters' steal/claim and the clue card stay green,
since Jeopardy leaving must not disturb the surface Blockbusters now depends on.

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
