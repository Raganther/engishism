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
Phase: Selector mode working — composable architecture proven
- Engine has two modes: slideshow and selector
- 8 activity types: title-card, reveal-card, fill-blank, meaning-pair, sentence-complete, true-false, hot-seat, noughts-crosses
- All multi-item activities handle internal navigation (questions/pairs/stems arrays)
- onComplete callback wired across all activities — true contract for composability
- First lesson: lessons/unit-8a.js (Unit 8A — Gerunds & Infinitives, 8 selector cards)
- Two lessons working: unit-8a.js and unit-6-scandi-successes.js
- Lesson generation pipeline proven: photo → Claude + prompt template → lesson file
- Prompt template at: docs/lesson-prompt.md
- Next: lesson picker (load any lesson without editing index.html), or more activity types

## Constraints
- Must work on a standard classroom TV/browser — no exotic dependencies
- No internet required during class (fully offline capable)
- Teacher controls everything — students do not touch the device
- Keep the UI readable at distance (large fonts, high contrast)
