# Round-first probe — what "Connections as its own game" exposed

**What it is.** `game-hub/games/connections.js` — a lab-only game (wired only into
`game-hub-lab.html`) that plays the `grouping` round as its own game with no board.
It is a diagnostic, not a shipped game: the badge says `PROBE · lab only`.

**Headline: it works, and the container already supports it.** Driven in the lab board
(`file://game-hub-lab.html`, headless Chromium), Connections runs a full loop with **no
board of its own** — pick sets → a grouping round opens on the shared clue card → assemble
the four by clicking words (no-phones teacher path) → Check judges it → the won card holds
("Close — Team 1 takes it") → Close pays → standings between questions → next question →
ending after four. Scores incremented 1→2→3→4. The only console error was
`ERR_CONNECTION_RESET` (no relay running headless) — i.e. the degradation path working,
teacher-only, no crash. So the round tier + the container are already dynamic enough to
host a round-first game. Nothing new was needed on `HubEnv`; the `onCard` fix from the
Jeopardy extraction held first time.

## The coupling it exposed, ranked by what a real round-first push would pay to fix

**1 — The open-card sequence has no shared entry point. (highest value)**
`openConnectionsClue` is ~12 hand-ordered steps copied almost verbatim from
`blockbusters.js` `openBlockbustersClue` and `jeopardy.js` `jShowClue`, with three
load-bearing ordering constraints (roundOf-before-roundOpen, prompt-before-round-reveal,
renderRoundButton-after-hideAllActionButtons). That is **three near-identical copies** of
the same choreography — well past the two-caller bar. A shared
`E().openRoundOnCard(item, host, opts)` would collapse them into one call and make a new
card-hosted round-game a few lines. This is the concrete "simpler way" the design
conversation was circling.

**2 — "Advance to the next question" is wired in two undeclared places.**
A sequence host on the card has to schedule the next question from **`win()`** (because
`roundPaySlot` pays through `win` but does not close or advance the card) *and* from
**`onClueClose()`** (the give-up / skip path). Neither is a declared "the slot resolved"
seam. A round-first host wants one `onSlotResolved(outcome)` hook instead of hiding
"advance" inside the pay function.

**3 — `modalMode` is an untyped free string.**
The host invents `'connections'`, writes it via `setModalMode`, and echoes it in `live()`.
It works, but nothing validates it — a typo silently breaks `live()`. Low harm while the
convention holds; if round-first hosts multiply, deriving `live()` from the host id (or a
tiny registry of legal modes) removes the footgun.

**4 — The clue-card buttons are one shared imperative pool.**
A self-judging round needs only Reveal (give up) + Close; Correct/Wrong/Skip/Claim are
hand-scored-tile machinery it must *actively not show* (`hideAllActionButtons` + per-button
`.style.display`). If reveal/mark became a **round-declared default** (the idea from the
design chat), a host would declare its button set instead of driving the DOM by hand.

**5 — Grouping has no content channel of its own. (lowest, it's content plumbing)**
The probe carries its own 4-item bank because grouping content normally rides a card
game's `bank()` plus the manual `K.round.fields()` copy. A real Connections game would
want a way to author grouping content that isn't nested inside another game's bank.

## What already worked cleanly (did NOT need touching)

- `onCard` (declared) — the won-round hold worked first try.
- The round tier — grouping's render / judge / teacher-pick / hint all ran untouched.
- The `HubEnv` surface — the probe used only existing members; nothing new exposed.
- Degradation — no relay → teacher-only stayed fully playable, no error surfaced to the room.

## Recommendation — the fork this feeds

Highest value, lowest risk: **extract `E().openRoundOnCard(item, host)` (finding 1) and
rewire jeopardy + blockbusters + this probe onto it** — three callers, real duplication,
and it de-risks every future card-hosted round. Finding 2 (`onSlotResolved`) rides along
naturally with it. Findings 3–5 are optional polish, taken per appetite. The probe can
stay lab-only as a living reference / regression canary, or be deleted once the extraction
lands — either way it has done its job: it turned the abstract "is the card too
Jeopardy-shaped?" into a seen, ranked list.
