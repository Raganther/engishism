Status: current | Epistemic: working | Last verified: 2026-04-23

# Engishism Research Roadmap

Single staging layer for unresolved work, open questions, ideas, experiments, and monitoring items. Domain files hold confirmed knowledge only.

## Active

None.

## Open Questions

| Status | Topic | Question | Source |
|---|---|---|---|
| idea | School admin exploration | What is the school's biggest operational pain: scheduling, attendance tracking, lesson planning, or something else? | `.claude/school-exploration.md` |
| idea | School admin exploration | Are school workflows currently managed in software, spreadsheets, paper, or a mix? | `.claude/school-exploration.md` |
| idea | School admin exploration | Which track should be prototyped first: admin tooling or teaching automation? | `.claude/school-exploration.md` |
| idea | School admin exploration | Does textbook-to-activity automation make the current lesson generation pipeline obsolete, or complement it? | `.claude/school-exploration.md` |
| idea | School admin exploration | Is the school tooling concept a separate project or an extension of Engishism? | `.claude/school-exploration.md` |
| idea | Lesson pipeline | Should the prompt template include all current schemas inline, or reference `.claude/activities/schemas.md` and stay shorter? | `.claude/lesson-pipeline.md` |
| idea | Lesson pipeline | Would a validation script that checks lesson files against schemas catch errors before they reach the browser? | `.claude/lesson-pipeline.md` |
| idea | Activity UX | Should fill-blank, true-false, and other quiz types have optional team claim buttons like jeopardy and millionaire? | `.claude/activity-feedback.md` |
| idea | Activity UX | Should activities track which items have been revealed, so re-entering does not reset state? | `.claude/activity-feedback.md` |
| idea | Activity scoring | Is the current "no scoring on most activities" intentional, or should more activities integrate with the session bar? | `.claude/activity-feedback.md` |
| idea | Activity schemas | Should countdown accept an optional topic or prompt field, or is verbal-only the right design? | `.claude/activities/schemas.md` |

## Monitoring

None.

## Resolved

| Date | Topic | Resolution |
|---|---|---|
| 2026-04-23 | Unit 1 Present Continuous | Added a reusable Present Continuous topic pack from the grammar book, a curated Unit 1 lesson, project-local image asset, and a new `picture-choice` activity for one-image multiple-choice grammar practice. |
| 2026-04-23 | Topic-first architecture | Implemented topic-first runtime flow with topic packs, game adapters, topic validation, and legacy lesson fallback. |
| 2026-04-23 | Fill-blank v2 | Implemented backward-compatible multiple-choice mode for `fill-blank`; Present Simple now provides an explicit v2 example while weaker topic data falls back to open reveal mode. |
