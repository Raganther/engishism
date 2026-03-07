# Active Plan — Engine Foundation
Started: 2026-03-07

## Goal
Build a modular, composable ESL lesson engine. One engine, many pluggable activity types. Content (JSON) is always separate from logic (JS).

## Architecture Contract
- Lesson = ordered list of slides
- Slide = type + content
- Type = self-contained activity module (flashcard, quiz, fill-blank, etc.)
- Engine = loads lesson, navigates slides, renders current type via registry
- Registry = single file mapping type names to activity modules

## File Structure (target)
```
index.html          — engine shell (never changes)
engine/
  engine.js         — load lesson, navigate, call registry
  registry.js       — { 'flashcard': Flashcard, 'quiz': Quiz, ... }
activities/
  flashcard.js      — one file per activity type
  quiz.js
lessons/
  [unit].json       — content only, no logic
styles/
  main.css          — TV-optimized base styles
```

## Steps
1. [x] Get concrete lesson content from textbook (Unit 8A — Gerunds & Infinitives)
2. [x] Design activity types from real content
3. [x] Build engine shell — index.html + engine.js
4. [x] Build 4 activity types: title-card, reveal-card, fill-blank, meaning-pair, sentence-complete
5. [x] Write first lesson file from real content (lessons/unit-8a.js)
6. [x] Test end-to-end: open index.html, navigate all 16 slides, check interactions
7. [x] Fix any issues found during testing — none found, working well
8. [ ] Add second lesson to prove the plug-in model works

## Later (not MVP)
- Kahoot-style student phone interaction (slide type gets `multiplayer` flag + backend)
- Teacher-facing lesson builder UI
- Claude integration: photo of textbook → auto-generate lesson JSON

## Notes
- Fully offline, fully static — no server, no build step
- TV-optimized: large fonts, high contrast, readable at distance
- Teacher controls everything via keyboard (spacebar/arrows)
