# Active Plan — Module System (Timer, Scoreboard, Teams)
Started: 2026-03-07

## Goal
Add a composable module layer to the engine. Any activity can opt in to any
combination of modules (timer, scoreboard, teams) without those features being
baked into the activity itself.

## Architecture

### Three new pieces
1. **Event bus** — tiny pub/sub. Activities fire events, modules listen.
2. **Shared state** — `{ teams, scores, timeLeft }` passed to all participants.
3. **Module zones** — HTML regions where modules render (top bar, bottom bar).

### Interfaces

Activity init gains state + events:
```js
init(el, content, { onComplete, state, events })
// Fire: events.emit('point', { team: 0 })
// Fire: events.emit('round-end')
```

Module interface:
```js
window.Modules['timer'] = {
  render(state) { return '<html>'; },
  init(el, state, events) { /* countdown, emit 'time-up' */ }
}
```

Lesson slide opts in:
```js
{
  type: "hot-seat",
  modules: ["teams", "timer", "scoreboard"],
  content: { words: [...], time: 60, teams: ["Team A", "Team B"] }
}
```

### Layout
```
┌──────────────────────────────┐
│  module-bar-top              │  ← timer, scoreboard
├──────────────────────────────┤
│  slide-container             │  ← activity (unchanged)
├──────────────────────────────┤
│  module-bar-bottom           │  ← team award buttons
└──────────────────────────────┘
```

## Build order

### Step 1 — Foundations
1. [ ] engine/events.js — simple emit/on event bus
2. [ ] Add module-bar-top + module-bar-bottom zones to index.html
3. [ ] Add module zone CSS to main.css
4. [ ] Update engine.js — detect `modules` field, build shared state,
        load + init each module, pass state+events to activity init()

### Step 2 — Modules
5. [ ] modules/timer.js — countdown display, emits 'time-up', reads state.timeLeft
6. [ ] modules/scoreboard.js — team scores display, listens for 'point' events
7. [ ] modules/teams.js — which team's turn, prev/next team button, emits 'team-change'

### Step 3 — Wire up a demo
8. [ ] Update hot-seat.js — emit 'point' on Next click (instead of internal tally only)
9. [ ] Remove baked-in timer from hot-seat — let Timer module handle it
10. [ ] Add a demo slide to unit-8a.js using all three modules
11. [ ] Test: timer counts down, scoreboard updates, teams track

### Step 4 — Tidy
12. [ ] Update docs/lesson-prompt.md — add modules field to schemas
13. [ ] Git save

## Notes
- Existing activities without `modules` field continue to work exactly as before
- Backward compatible — the modules field is purely opt-in
- Do NOT refactor all activities yet — prove the model on hot-seat first
- The event bus is the critical piece — get it right before building modules
