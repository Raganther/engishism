# Active Plan — Session Scoring: Selected Team Routes All Points
Started: 2026-03-08

## Goal
The session bar gets a "selected team" concept. One team is active at a time.
All point events from any activity are automatically routed to the selected team.
Teacher taps a team in the bar to select it before/during a game.

## Steps

1. [ ] **Session bar — add selected team state**
   - `window.Session.activeTeam` — index of currently selected team (default: 0)
   - Clicking a team card selects it (highlights it visually)
   - Selected team has a distinct style (bright border, slightly larger score, or glow)
   - Re-render or update class on click (no full re-render needed)

2. [ ] **Engine — intercept activity point events**
   - In `renderActivity()` in engine.js, after activity.init() runs, add:
     `events.on('point', ({ value }) => window.Session.award(window.Session.activeTeam, value))`
   - This routes ALL point events from ANY activity to the selected team automatically
   - No changes to any activity files

3. [ ] **Session bar — update score display**
   - `Session.award()` already calls `SessionBar.updateScore(team)` — should work as-is
   - Verify the bump animation fires correctly when points come from activity events

4. [ ] **Clean up per-activity modules (optional, deferred)**
   - The scoreboard and teams modules are now redundant for session play
   - Leave them as-is for now — they still work for standalone activity use
   - Revisit after seeing the session flow in action

5. [ ] **Test across multiple activities**
   - Select Team A → play Jeopardy → claim a cell → verify session score increments
   - Switch activity → select Team B → play hot-seat → verify points route correctly
   - Verify reset clears everything

## Notes
- activeTeam is an index (0, 1, 2...) not a name — names can change via inline editing
- Session.award(teamIndex, value) needs to resolve index → name internally
- The engine's renderActivity() is the single interception point — clean, no activity changes needed
- Per-activity scoreboard module can still run in parallel (it reads local state) — not harmful
