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

```bash
# Git save
./scripts/git-save.sh "subject" "body"

# Deploy (push to GitHub Pages)
git push
```

**Live URL:** https://raganther.github.io/engishism/

## Architecture
- Stack: HTML, CSS, vanilla JS (no build step — keep it simple and TV-friendly)
- Entry point: index.html — landing page (links to all tools)
- App entry point: app.html — the main presenter view
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
- 16 activity types total: all originals + anagram, call-my-bluff, odd-one-out, missing-vowels, jeopardy, countdown, millionaire
- Persistent session bar (engine/session.js) sits above all screens — always visible
- Session bar: team names (inline editable), colour-coded scores, +/− buttons, add/remove teams, reset
- Session state lives in window.Session — teacher-driven scoring, separate from per-activity modules
- Navigation inverted: topic picker first → game type picker → play (all 15 types shown, unavailable ones greyed out)
- Session scoring wired: click a team to select it, all activity point events route to that team
- 7 lessons: unit-6-scandi-successes, unit-8a, teamwork, negotiation-skills, technology-problems, money-present-perfect, demo-games
- teamwork.js + negotiation-skills.js: all 15 game types fully populated from handout PDFs
- Deployed to GitHub Pages: https://raganther.github.io/engishism/
- Standalone team building activities (separate from main app):
  - desert-island.html — 15 survival items, KEEP/LOSE vote, expert reveal
  - bunker.html — 15 people candidates, 8 bunker spaces, ethical debate + council reveal
- Landing page at index.html — links to app.html and all standalone activities
- Standalone activities: desert-island.html, bunker.html, it-helpdesk.html, scam-or-legit.html
- Lesson generation pipeline: photo → Claude + lesson-prompt.md → lesson file → register in lessons/index.js
- Next: more lessons from handouts, or new standalone games

## Constraints
- Must work on a standard classroom TV/browser — no exotic dependencies
- No internet required during class (fully offline capable)
- Teacher controls everything — students do not touch the device
- Keep the UI readable at distance (large fonts, high contrast)
