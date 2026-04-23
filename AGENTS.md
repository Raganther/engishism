# Engishism — ESL Classroom Presentation App

## What it is
A web-based slideshow application for ESL teachers to present English lessons on a classroom TV. Built in HTML/CSS/vanilla JS (no build step), it delivers interactive games, grammar drills, and vocabulary activities. Teacher-driven, class-facing — students don't touch the device. Deployed to GitHub Pages.

## Session Start
Read in order on every cold start:
1. .Codex/memory/gitlog.md — recent git saves
2. .Codex/strategies/research-roadmap.md — open questions, ideas, in-progress work, and monitoring items
3. Domain files — on demand via "read when X" triggers below

Read on demand only:
- .Codex/harness-v4.md — read when editing project memory, roadmap, domain files, or AGENTS.md
- .Codex/strategies/research-roadmap.md — read when planning work, continuing open items, or resolving questions
- .Codex/procedures/_index.md — scan at plan creation for relevant how-to patterns
- .Codex/activities/schemas.md — read when writing or editing lesson files
- .Codex/lesson-pipeline.md — read when creating a new lesson or modifying the generation process
- .Codex/school-exploration.md — read when discussing school admin tools or teaching automation
- .Codex/activity-feedback.md — read when working on any activity type, adding features, or reviewing feedback
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
- Entry point: index.html — landing page linking to app + standalone activities
- App entry point: app.html — the main presenter view
- Engine (engine/engine.js): two modes — slideshow (sequential slides) and selector (pick activities)
- Navigation flow: topic picker → compatible game type picker → play
- ACTIVITY_CATALOG in engine.js — single source of truth for all 18 activity types (names, descriptions, SVG icons)
- Topic system: TOPIC_INDEX + per-topic packs + GameAdapters generate playable slide data at runtime
- LESSON_INDEX in lessons/index.js — registry of all lessons with `types: []` for picker filtering
- Session bar (engine/session.js): persistent top bar — team names (editable), colour-coded scores, +/− buttons, timer controls
- Session state: window.Session — teacher-driven scoring, teams support (up to 4)
- Event bus (engine/events.js): scoped per activity session
- Module system: timer, scoreboard, teams snap onto any activity via `modules` field
- Theme system: styles/themes.css — 7 themes (dark, neon, arcade, tropical, candy, fire, chalk), persisted to localStorage

## Current Status
- 18 activity types: title-card, reveal-card, fill-blank, picture-choice, meaning-pair, sentence-complete, true-false, hot-seat, noughts-crosses, anagram, call-my-bluff, odd-one-out, missing-vowels, jeopardy, countdown, millionaire, scenario-cards, fluency-tree
- 5 topic packs: Present Simple, Present Continuous, Present Perfect, Jobs & Workplaces, Technology Support
- 10 lessons: unit-1-present-continuous, unit-6-scandi-successes, unit-8a, teamwork, negotiation-skills, technology-problems, money-present-perfect, creating-a-cv, at-work, demo-games
- 4 standalone activities: desert-island.html, bunker.html, it-helpdesk.html, scam-or-legit.html
- Topic adapters live in `adapters/index.js` for: fill-blank, true-false, sentence-complete, hot-seat, noughts-crosses, anagram, missing-vowels, call-my-bluff
- Lesson generation pipeline: photo → Codex + docs/lesson-prompt.md → lesson file → register in lessons/index.js
- Topic generation pipeline: prompt/image → Codex + docs/topic-pack-prompt.md → topic pack → `node scripts/validate-topics.js`
- Fluency tree prompt: docs/fluency-tree-prompt.md — standalone prompt for generating branching conversations
- Memory system: Harness v4.2 — AGENTS.md for navigation, roadmap for unresolved work, domain files for confirmed knowledge
- Next: expand topic packs, add more game adapters, or generate topic packs from handouts

## Constraints
- Before starting any update, new feature, or bug fix — scan the domain file list above and read any relevant files first
- Open questions, ideas, and in-progress work belong in .Codex/strategies/research-roadmap.md
- Domain files must contain confirmed knowledge only; do not add `## Open Questions`, `## Plan`, or `## Research` sections
- Must work on a standard classroom TV/browser — no exotic dependencies
- No internet required during class (fully offline capable)
- Teacher controls everything — students do not touch the device
- Keep the UI readable at distance (large fonts, high contrast)
