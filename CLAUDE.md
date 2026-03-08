# Engishism — ESL Classroom Presentation App

## What it is
A web-based slideshow application for ESL teachers to present English lessons on a classroom TV. Built in HTML/CSS/JS, it delivers interactive games, grammar drills, and vocabulary activities designed to be teacher-driven and class-facing. Currently in the early exploration and design phase — no code written yet.

## Session Start
Read in order on every cold start:
1. memory/MEMORY.md — recent changes
2. memory/plan.md — current active plan

Read on demand only:
- docs/dev.md — ideas and backlog

## Run Commands
None yet — project not scaffolded.

```bash
# Git save
./scripts/git-save.sh "message"
```

## Architecture
- Stack: HTML, CSS, vanilla JS (no build step — keep it simple and TV-friendly)
- Entry point: index.html — the main presenter view
- Slides rendered in-browser, no server required (static files)
- Module registry: TBD (likely a JS object mapping slide/game types to their renderers)

## Current Status
Phase: Activity picker home screen + 12 activity types
- Engine has two modes: slideshow and selector
- 12 activity types: title-card, reveal-card, fill-blank, meaning-pair, sentence-complete, true-false, hot-seat, noughts-crosses, anagram, call-my-bluff, odd-one-out, missing-vowels
- Home screen shows all activity types as cards — click to see lessons for that type
- LESSON_INDEX entries now include `types: []` array so the picker knows which lessons contain which activities
- ACTIVITY_CATALOG defined in engine — single source of truth for all type names/descriptions
- All multi-item activities handle internal navigation (questions/pairs/stems arrays)
- onComplete callback wired across all activities — true contract for composability
- 3 lessons: unit-8a.js, unit-6-scandi-successes.js, demo-games.js (demos all 4 new types)
- Lesson generation pipeline proven: photo → Claude + prompt template → lesson file
- Prompt template at: docs/lesson-prompt.md
- Module system working: timer, scoreboard, teams snap onto any activity via modules field
- Event bus (engine/events.js) scopes events per activity session
- Each activity card has a minimalist SVG icon (36×36, stroke-based, accent on hover)
- Icons defined inline in ACTIVITY_CATALOG via icon() helper in engine.js
- 13 activity types total — jeopardy added
- Jeopardy: categories × point values grid, full-screen question view, team claim buttons
- Scoreboard module updated to support variable point values via { team, value } in point events
- Next: countdown letters, or build real lesson content using existing activity types

## Constraints
- Must work on a standard classroom TV/browser — no exotic dependencies
- No internet required during class (fully offline capable)
- Teacher controls everything — students do not touch the device
- Keep the UI readable at distance (large fonts, high contrast)
