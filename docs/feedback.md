# Classroom & test feedback log

One entry per real run — a class, or a deliberate test session with real handsets.
**This file is the raw record; `CLAUDE.md` gets the distilled lessons.** When a run
is reported in chat, the entry is appended here *first*, then bugs and decisions
flow into Current status as they are fixed or decided.

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
