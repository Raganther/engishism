# Observations — Engishism
Running insights from the current phase. Graduate to confirmed knowledge when settled.

---

## Hooks & memory system (2026-03-24)
The project was missing its full memory system infrastructure from the start:
- No `.claude/` directory — no hooks, no settings.json, no domain knowledge files
- No `memory/observations.md` — insights never captured formally
- OpenBrain audit was never triggered (no PostToolUse hook)
- PreToolUse guard was never enforced (no guard hook)

All three hooks and the domain knowledge layer are being added now (2026-03-24). First real graduate: activity schemas → `.claude/activities/schemas.md`.

**Still uncertain:** Whether the PreToolUse git-save-guard will cause friction in practice (e.g. when plan.md is genuinely stable and doesn't need updating). May need to refine the guard logic over time.

---

## Activity schema stability (2026-03-24) — GRADUATED
All 18 activity type schemas confirmed and stable. Graduated to `.claude/activities/schemas.md`.

The fluency-tree merge rule is the most subtle schema constraint: every branching path must converge to a single node whose options work universally (i.e. make sense whether B came from the loves/dislikes/student path). Bridge nodes fail when they reference the specific path just taken. This rule is documented in the schemas reference.

---

## Lesson generation pipeline (2026-03-24)
Pipeline is proven and documented in `docs/lesson-prompt.md`. The main failure mode is schema errors — wrong field names, missing required fields, or using options[] instead of stems[] etc. The schemas reference file should prevent this.

Nine lessons exist: unit-6-scandi-successes, unit-8a, teamwork, negotiation-skills, technology-problems, money-present-perfect, creating-a-cv, at-work, demo-games. The CLAUDE.md still says 8 — needs updating on next git save.
