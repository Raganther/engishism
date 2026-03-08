# Active Plan — Session Scoring: Selected Team Routes All Points
Started: 2026-03-08

## Goal
The session bar gets a "selected team" concept. One team is active at a time.
All point events from any activity are automatically routed to the selected team.
Teacher taps a team in the bar to select it before/during a game.

## Steps

1. [x] **Session bar — add selected team state**
2. [x] **Engine — intercept activity point events**
3. [x] **Session bar — update score display** (award() already calls updateScore + bump)
4. [ ] **Clean up per-activity modules (optional, deferred)**
5. [ ] **Test across multiple activities** — verify in browser next session

## Notes
- activeTeam is an index (0, 1, 2...) not a name — names can change via inline editing
- Session.award(teamIndex, value) needs to resolve index → name internally
- The engine's renderActivity() is the single interception point — clean, no activity changes needed
- Per-activity scoreboard module can still run in parallel (it reads local state) — not harmful
