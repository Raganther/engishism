# Classroom & test feedback log

One entry per real run — a class, or a deliberate test session with real handsets.
**This file is the raw record.** When a run is reported in chat, the entry is appended
here *first*. From there: a bug or a decision becomes a line in `CLAUDE.md`'s **Open**
section while it is unfinished, and leaves that section when it closes. The story of
fixing it — the evidence, the wrong diagnoses — goes in the commit message. `CLAUDE.md`
holds only what is true now; git log is the history.

Why it exists: the class runs are the only data this project has that no suite can
produce — whether a beat drags, whether a round is fun, what students actually do.
Chat messages evaporate; this does not.

**Entry template** (copy for each run):

```
## YYYY-MM-DD · <unit> · <game> · <teams/solo, N players, phones?>
**Setup:** build, settings that mattered (ruleset, modes, thresholds)
**What was played:**
**Worked:**
**Didn't:** (bugs → file an item; note status here when fixed)
**Student verdicts:**
**Open-question verdicts:** (the guessed numbers this run settled or didn't)
**Next:**
```

---

## 2026-09-15 · Advertising (B2) · Flip · first run of the new board
**Setup:** build 20260915b, defaults — 5×5, twists 40%, steal a third of the gap,
Swap on, last place picks.

**What was played:** the advertising pack on the new Flip board.

**Worked:** the board played; the Gift vote reached the phones.

**Didn't:**
- **You cannot see which cards carry a twist.** The twist only appeared once a card
  was opened, so "last place picks" was a coin flip rather than a decision, and the
  room could not see that the back rows are loaded — which is the shape of the whole
  game, kept secret from the people playing it. **Fixed**: a star on the face-down
  card says something is there and never what (`flipMarked`, on by default).
- **The twist was unreadable when it did appear** — gold-on-navy at 25px in the
  corner of a screen-wide card, beside the question, reading as a caption rather
  than an event. **Fixed**: the card wears the twist's colour and the topline is a
  band across it at ~42px, with the rule in plain English under it.
- **"No option to swap anything; I got a vote instead."** The vote is the Gift card
  working as designed. The Swap is one card in twenty-five and always in the last
  row, so it is reachable but easily never reached — and a Swap won by whoever is
  already top has nobody to trade with and correctly does nothing. Not reproduced as
  a fault: three dealt boards each carried exactly one Swap in row 5, and the chooser
  opens when a competitor below somebody wins it. The marker should make it findable.

**Student verdicts:** not recorded.

**Open-question verdicts:** none settled — the steal share (a third) and the twist
density (40%) still have not been read in front of a class, because the twists were
effectively invisible this run.

**Next:** re-run with the markers on and watch whether last place actually aims for
them, and whether the leader starts hoovering up marked cards to deny them.

---

## 2026-09-14 · Consciousness 4B (mixed rounds) · Jeopardy · class run
**Setup:** build 20260914c. The 4B mixed columns — Multiple Choice, Connections,
Drag the Letters, Word Thermometer, Drag the Words — on the physics faces, phones
in the room. Everyone-finishes on, podium pay.

**What was played:** the 4B board end to end.

**Worked:** the run got all the way through; nothing in the report is about a
round failing to play.

**Didn't:**
- **The wrong name on the winner pill.** The standings screen after a round
  sometimes named a different competitor from the one wearing the 1st-place badge
  on the lanes while the question was being played. *(Two places deciding one
  fact — see the fix.)*
- **Second and third won the same money.** On the low-value tiles the podium
  shares round onto the same grid step, so two places arrive at the board equal.
- **No timer on a question.** Nothing bounds how long a round runs; the teacher
  is the only clock, and a question that nobody can do just sits there.
- **Fourth onward gets nothing.** Podium pays three places, so in a room bigger
  than three most of the class finishes for zero — which is the thing that stops
  the slower half trying at all.

**Student verdicts:** not recorded this run.

**Open-question verdicts:** the podium shares (0.6 / 0.3) are settled as *wrong
in shape*, not just in value — three places is too few for a class of this size,
and equal payouts for distinct places is the part the room noticed. Untouched:
whether standings after every question drags, whether the crowd reveal at 40%
is right.

**Next:** re-run with the pay rule paying every finisher and a round timer set,
and read whether a bounded question changes the pace.

---

## 2026-08-12 · EF Unit 2A "Spend or save?" · Jeopardy · teams, real phones
**Setup:** first run of the ef-2a unit; team mode; Classic ruleset was ON by
accident (persisted from an earlier test — Daily Double, final clue and deduction
all active without anyone choosing them that day).

**What was played:** the seven 2A columns — three plain, Connections, both drag
rounds, The Scam (Multiple Choice).

**Worked:** the unit played end to end; Connections landed as the favourite.

**Didn't:**
- A team was badged and paid **1st on Drag the Words after the room watched them
  come last** — they completed first but *wrong*, and the arrival stamp keyed on
  the sorted word set, which cannot tell a wrong order from the right one.
  **Fixed** (`ordered:true` on the drag rounds; proved with two live handsets).
- A team's **completed word never showed on the card**, twice, in Drag the
  Letters — the `agree` mode only lights letters the whole team independently
  holds, so a team that split the spelling looked like it had done nothing.
  **Addressed**: drag rounds defaulted to `first` on team boards for one day —
  then reverted (2026-08-13) after the user tested it: one phone lighting the
  card alone read worse than the invisible-word cost. Default is `agree` again;
  `first` is one tap away on the card's TUNE pill when a class needs it.
- **600 paid for 2nd place on a 500 card** — mechanism unknown, not yet
  reproduced. The score report (standings screen → "score report") was built as
  the instrument; the next run carries it. *(Possibly compounded by the stamp bug
  and/or Classic's deduction — unconfirmed.)*
- The **final clue and Daily Double confused the class** — partly because nobody
  had chosen Classic that day, partly because the final clue is deliberately not
  a round and "gave everyone points" (every team bets and right answers win their
  bet). The final clue also occupied the end-of-game moment, so **no winner
  screen was seen** — the thing the class wanted most.

**Student verdicts:** Connections most fun · Drag the Words hardest · drag rounds
disliked "because hard" (largely the agree-mode cost — retest under `first`).

**Open-question verdicts:** none of the tuned numbers (podium shares, crowd
reveal 40%, standings beat) got a clean read — the ruleset accident dominated.

**Next:** re-run with ruleset = Hub, drag rounds on `first`, ledger cleared
before the game; read the score report after; watch for the 600.

---

## 2026-08-05 · Empower C1 · Jeopardy · teams, real phones (first-ever live class)
*(Reconstructed from CLAUDE.md — predates this log.)*

**Didn't:**
- A phantom phone inflated a team's size and locked all-agree gates → the kick
  control + TCP keepalive. **Fixed.**
- A round win had no winner's moment → `roundWinBanner` (now the standings
  screen). **Fixed.**
- Anagram lanes showed jumbled attempts → lanes show only correctly-placed
  letters. **Fixed.**
- Removing a team renumbered the phones and a win paid a team that no longer
  existed → `remap`. **Fixed.**
- The smoke runner truncated silently on a thrown suite. **Fixed.**

**Lesson that stuck:** every fix from this run was a first classroom iteration —
the second lesson's verdict is what confirms them.
