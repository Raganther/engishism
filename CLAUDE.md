# Engishism — ESL Classroom Presentation App

## What it is
A web-based slideshow application for ESL teachers to present English lessons on a classroom TV. Built in HTML/CSS/vanilla JS (no build step), it delivers interactive games, grammar drills, and vocabulary activities. Teacher-driven, class-facing — students don't touch the device. Deployed to GitHub Pages.

## Session Start
Read in order on every cold start:
1. .claude/memory/gitlog.md — recent git saves
2. .claude/memory/observations.md — active work + staging
3. Domain files — on demand via "read when X" triggers below

Read on demand only:
- .claude/procedures/_index.md — scan at plan creation for relevant how-to patterns
- .claude/activities/schemas.md — read when writing or editing lesson files
- .claude/lesson-pipeline.md — read when creating a new lesson or modifying the generation process
- .claude/school-exploration.md — read when discussing school admin tools or teaching automation
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
- Navigation flow: topic picker → game type picker → play
- ACTIVITY_CATALOG in engine.js — single source of truth for all 18 activity types (names, descriptions, SVG icons)
- LESSON_INDEX in lessons/index.js — registry of all lessons with `types: []` for picker filtering
- Session bar (engine/session.js): persistent top bar — team names (editable), colour-coded scores, +/− buttons, timer controls
- Session state: window.Session — teacher-driven scoring, teams support (up to 4)
- Event bus (engine/events.js): scoped per activity session
- Module system: timer, scoreboard, teams snap onto any activity via `modules` field
- Theme system: styles/themes.css — 7 themes (dark, neon, arcade, tropical, candy, fire, chalk), persisted to localStorage

## Current Status
- 18 activity types: title-card, reveal-card, fill-blank, meaning-pair, sentence-complete, true-false, hot-seat, noughts-crosses, anagram, call-my-bluff, odd-one-out, missing-vowels, jeopardy, countdown, millionaire, scenario-cards, fluency-tree, countdown
- 9 lessons: unit-6-scandi-successes, unit-8a, teamwork, negotiation-skills, technology-problems, money-present-perfect, creating-a-cv, at-work, demo-games
- 4 standalone activities: desert-island.html, bunker.html, it-helpdesk.html, scam-or-legit.html
- Lesson generation pipeline: photo → Claude + docs/lesson-prompt.md → lesson file → register in lessons/index.js
- Fluency tree prompt: docs/fluency-tree-prompt.md — standalone prompt for generating branching conversations
- Memory system: v3 harness — domain-first write order, no plan.md
- Next: more lessons from handouts, or new standalone games

## Constraints
- Before starting any update, new feature, or bug fix — scan the domain file list above and read any relevant files first
- Must work on a standard classroom TV/browser — no exotic dependencies
- No internet required during class (fully offline capable)
- Teacher controls everything — students do not touch the device
- Keep the UI readable at distance (large fonts, high contrast)
