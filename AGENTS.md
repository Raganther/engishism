# Engishism — ESL Classroom Presentation App

## What it is
A web-based slideshow application for ESL teachers to present English lessons on a classroom TV. Built in HTML/CSS/vanilla JS (no build step), it delivers interactive games, grammar drills, and vocabulary activities. Teacher-driven, class-facing — students don't touch the device. Deployed to GitHub Pages.

## Session Start
Read in order on every cold start:
1. .claude/memory/gitlog.md — recent git saves
2. .claude/strategies/research-roadmap.md — open questions, ideas, in-progress work, and monitoring items
3. Domain files — on demand via "read when X" triggers below

Read on demand only:
- .claude/harness-v4.md — read when editing project memory, roadmap, domain files, or AGENTS.md
- .claude/strategies/research-roadmap.md — read when planning work, continuing open items, or resolving questions
- .claude/procedures/_index.md — scan at plan creation for relevant how-to patterns
- .claude/activities/schemas.md — read when writing or editing lesson files
- .claude/lesson-pipeline.md — read when creating a new lesson or modifying the generation process
- .claude/unit-content-engine.md — read when working on the rebuilt Unit-first runtime, unit schemas, or game capability adapters
- .claude/school-exploration.md — read when discussing school admin tools or teaching automation
- .claude/activity-feedback.md — read when working on any activity type, adding features, or reviewing feedback
- docs/topic-pack-prompt.md — read when generating or editing topic packs
- docs/dev.md — read when exploring ideas or backlog

## Run Commands

```bash
# Git save
./scripts/git-save.sh "subject" "body"

# Deploy (push to GitHub Pages)
git push
```

**Live URL:** https://raganther.github.io/engishism/

## Architecture
- Stack: HTML, CSS, vanilla JS — no build step, fully offline capable
- Entry point: index.html — landing page for the rebuilt Unit-first app
- App entry point: app.html — new Unit-first classroom runtime
- New runtime: engine/unit-app.js — chooses a unit, shows compatible games, and runs the selected game from unit content
- Unit registry: units/index.js + unit files under units/ — source of truth for workbook-derived content
- Unit model: metadata, grammar forms/rules/contrasts/mistakes, practice pools, speaking prompts, image prompts, and generated asset references
- Game capability model: games declare required content buckets and enable themselves when a unit can power them
- Primary visual system: styles/whiteboard.css — interactive whiteboard metaphor with magnetic cards and large classroom-TV UI
- Legacy runtime: engine/engine.js, lessons/, topics/, adapters/, activities/, modules/, and standalone HTML activities remain in the repo but are hidden from the primary UI

## Current Status
- Primary runtime has 1 rebuilt unit: grammar-unit-1-present-continuous
- Primary runtime has 1 rebuilt game: Picture Choice
- Unit 1 uses a generated classroom action sheet at assets/images/units/unit-1-present-continuous/action-sheet.png
- Legacy runtime still contains 18 activity types, 5 topic packs, 10 lessons, and 4 standalone activities, but these are not exposed by the rebuilt app shell
- New lesson/content generation target: grammar workbook unit → rich unit file → game capability adapters
- Memory system: Harness v4.2 — AGENTS.md for navigation, roadmap for unresolved work, domain files for confirmed knowledge
- Next: expand the Unit-first schema and add more games that can consume the same unit content

## Constraints
- Before starting any update, new feature, or bug fix — scan the domain file list above and read any relevant files first
- Open questions, ideas, and in-progress work belong in .claude/strategies/research-roadmap.md
- Domain files must contain confirmed knowledge only; do not add `## Open Questions`, `## Plan`, or `## Research` sections
- Must work on a standard classroom TV/browser — no exotic dependencies
- No internet required during class (fully offline capable)
- Teacher controls everything — students do not touch the device
- Keep the UI readable at distance (large fonts, high contrast)
