# Tier-3 item #2 — extracting the four in-closure games (plan, not yet done)

Status: **deferred, wants eyes-on-screen verification.** This note is the
code-grounded plan so the next session (or a class-side run) can execute it.

## Why deferred rather than done overnight

The sizing recon called Millionaire/Race "near-mechanical." Reading the code
disproved that for the *engine coupling*, not the line-moving. Engine layer-1
reaches directly into a game's private, index-aligned per-team state to keep it
aligned across roster changes:

- `removeTeam` (hub-engine.js ~1955): `mState.splice(i, 1)` and `bbSideAt = [0,0]`.
- `newGame` (~2147) and the solo prune (~7385): `mState.length = 0`.
- `voteLive()` (~7721): `return mVoting || bbVoting` — reads two games' private flags.

`mVoting` is **dead** (declared, set false in five places, never set true since the
round took over the room) — a `voteLive()` simplification to `bbVoting` is a free
side-cleanup, but touches Blockbusters so verify together.

The correct extraction replaces those pokes with a **declared hook** — the axiom-3
pattern — not by leaving a tentacle or exposing the state on HubEnv:

```
onTeamsChanged(i)   // i>=0: a team at index i was removed (splice my per-team arrays)
                    // i<0 : the roster was replaced/cleared (reset my per-team arrays)
```

Engine fires `hook('onTeamsChanged', i)` at the three sites above; Millionaire splices
/ clears `mState`, Blockbusters resets `bbSideAt`. Default no-op. This is shared-surface
work with its own blast radius, and its critical case — *the ladder staying with the
right team when a team is removed mid-game* — is a roster scenario the smoke suite does
not cover. Per CLAUDE.md that verification needs a real device or the hand-written
phone-scale drive. Hence: do it with the screen in front of you, and add a
prove-by-reverting check for the roster case.

## Order (from the entanglement recon)

Two pairs. **Millionaire and Race** are round-on-own-stage, no clue card. **Blockbusters
and Jeopardy** are fused at the shared clue card via `modalMode`/`clueClaim` — do **B4
first** (promote the clue-card branches onto declared ROUND_HOSTS surfaces), then those
two fall out. Suggested sequence: Millionaire → Race → B4 → Blockbusters → Jeopardy.

## HubEnv additions each extracted game needs (mapped against the current surface)

Already on HubEnv (free): award, ledgerNote, markRun, roundCommit/End/Of/Open,
roundForPhones/Live/OnReplies, revealOpenRound, roundDone, drawPrompt, askPhones,
armBuzzers/resetBuzzers, showResult/Standings/standingsWanted, notePhoneScore/Miss,
groupCheckboxes/sectionHeading/contentRow/groupOf/inPlay/shuffle, selectedContent(),
teams(), teamName, nextTurn, Roster, activeTeam()/setActiveTeam, room()(=buzzHost),
syncBuzzRoom, reaskPhones, clearFloor, renderScorebar, themeOf, motionOK, Sound,
stageTension, startGate, timer*, asChoiceRound.

**Millionaire** also needs added to HubEnv: `renderRound`, `currentPhonePrompt`,
`roundState` (getter — it mutates `.chosen`/`.hidden`, reads `.options`/`.answer`/`.shown`),
`setClueItem(item)` (it must set `currentClueItem`, whose `.text` the shared round
re-ask paths at 4706/4788/4998/5033 read). Keep `mAsRound` in the engine as the shared
`asChoiceRound` (Quickfire also uses it — one home). Card `order: 53` so it keeps its
slot ahead of bingo(55)/quickfire(60) once it loads before the engine. Move the three
Millionaire-group settings (mLifelines, mFinalAnswer, mConferSeconds) into the file;
leave the shared Competition settings (stealOnWrong, stealFullValue) in the engine.
Add its `<script>` between hub-games.js and hub-engine.js in all four shells.

**Race** ≈6 shared: `currentClueItem`(set), `buzzWinner` (reads it directly — expose a
`floorWinner()` on HubEnv), `phoneRaces`, `roundClue`, plus globals. No per-team parallel
array, so likely *no* onTeamsChanged coupling — may be the genuinely cleanest.

**Blockbusters/Jeopardy** gated on B4. They co-own the ~400-line clue-card flip machinery
(5492-5871) and the `modalMode`/`clueClaim`-dispatch (clueClaim.onPick branches
jeopardy→jTakeSteal vs claimHex; reveal/wrong/close/skip handlers branch on modalMode).
B4 turns those branches into declared host methods, after which each game's opener/claim
moves with it.

## Per-game footprints (recon)

- Millionaire ~495 lines: register 333-386, host 514-547, skeleton 1682-1704,
  content/start 3589-3593/3648-3657, core 6373-6741. bank vars 1852-1854.
- Race ~575: register 267-331, host 559-575, skeleton 1614-1681, core 7890-8301.
- Blockbusters ~820: register 197-265, host 484-513, skeleton+content 1609-1658,
  core 3701-4306, clue+claim 5436-5490/6307-6371.
- Jeopardy ~1050 (scattered ~10 regions): register 120-195, host 431-483, board/hints/
  wager 2853-3332, clue/steal/final 5338-6305, co-owns the flip machinery.
