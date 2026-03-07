# Active Plan — Selector Mode + Composable Activity Interface
Started: 2026-03-07

## Goal
Two things that belong together:
1. Add `onComplete` callback to the activity interface — makes every module truly composable
2. Build selector mode — teacher picks a game from a menu instead of navigating a slideshow

## Architecture changes

### Activity interface (small, foundational)
Every activity's `init()` gains a third argument:
```js
init(el, content, { onComplete })
```
- Non-game activities (fill-blank, etc.) accept it but don't call it
- Game activities call it when the game ends: `onComplete({ winner, score })`
- The caller (engine) decides what happens next — return to menu, auto-advance, etc.

### Engine: two modes
```
mode: "slideshow"  →  current behaviour (default if no mode set)
mode: "selector"   →  grid menu of all activities, click to launch, ESC to return
```
Lesson file sets: `window.LESSON = { mode: "selector", slides: [...] }`

### Nav bar changes
- Slideshow: prev / counter / next (unchanged)
- Selector menu: hidden
- Selector → game active: "← Menu" button only (ESC also works)

## Steps
1. [x] Update plan
2. [ ] Update index.html — add btn-menu
3. [ ] Rewrite engine.js — slideshow + selector modes, pass onComplete
4. [ ] Add selector CSS to main.css
5. [ ] Update all activity files — add onComplete to init() signature
6. [ ] true-false, hot-seat, noughts-crosses — call onComplete at game end
7. [ ] Update lessons/unit-8a.js — set mode: "selector", add labels to slides
8. [ ] Test — open index.html, verify selector renders, games launch and return

## Notes
- No server needed — all files still load via script tags
- autoLabel() in engine generates tile text from content if no label field set
- Backward compatible: lessons with no mode field default to slideshow
