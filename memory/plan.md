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
1. [ ] Get concrete lesson content from textbook (image or grammar point from Alistair)
2. [ ] Design 2-3 activity types from that real content
3. [ ] Build engine shell — index.html + engine.js + registry.js
4. [ ] Build first activity type (flashcard or fill-blank)
5. [ ] Write first lesson JSON file from real content
6. [ ] Test end-to-end: open index.html, load lesson, navigate slides
7. [ ] Add second activity type to prove the plug-in model works

## Later (not MVP)
- Kahoot-style student phone interaction (slide type gets `multiplayer` flag + backend)
- Teacher-facing lesson builder UI
- Claude integration: photo of textbook → auto-generate lesson JSON

## Notes
- Fully offline, fully static — no server, no build step
- TV-optimized: large fonts, high contrast, readable at distance
- Teacher controls everything via keyboard (spacebar/arrows)
