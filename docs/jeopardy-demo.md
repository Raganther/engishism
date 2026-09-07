# Jeopardy demonstration

Use the [relay-hosted board](https://engishism-buzzer.onrender.com/game-hub.html?fresh=20260907a). Open it a few minutes early: the free Render service can sleep while idle. The GitHub Pages copy has no phone relay.

## Set up two or three individual players

1. On the teacher's computer, open the [question bench](https://engishism-buzzer.onrender.com/playground/question-bench.html?fresh=20260907a) and expand **Tune**.
2. Choose **Individuals — everyone against everyone** under Competition.
3. Choose **Supportive — nothing is ever taken away** under Ruleset. If it is already selected, select Classic and then Supportive to apply the complete bundle again.
4. Turn **Phone buzzers** on. Leave **Final clue** off for the short demonstration. Close the bench.
5. Open the board, choose your unit, choose Jeopardy, and select three categories for a short demonstration (three to six keeps a projected board readable).
6. Each person scans **Show QR** or opens the join address displayed by the board, enters the room code and their own name. Wait until all names appear before opening a tile.

## Play

- Each phone has its own score. Interactive rounds let everyone finish. A completed phone says **Complete** and cannot score twice.
- Jeopardy uses its existing podium scoring: the first three finishers score, with awards rounded to the board's 50-point step. On a 100-point clue the normal awards are 100, 50, 50.
- Wrong submissions do not deduct points in Supportive mode. The phone briefly waits, then allows another attempt.
- On ordinary questions, buzz first and answer aloud; the teacher judges the answer. Category control passes on instead of staying with the winner.
- When the room is ready, use **Reveal answer**, then the closing/scoring control shown on the card. Do not rush past the discussion just because one phone finishes first.
- A refreshed phone resumes its saved identity and committed answer. Unsent work survives a connection reconnect in the same page; a full page reload cannot restore work that was never sent.

Keep the teacher's board open for the session. If a phone loses its connection, let it reconnect or refresh that phone before restarting the whole room.

## Validation and limits

The audit exercises the actual relay using three independent browser storage contexts and mobile-sized, touch-enabled Chromium pages. It covers simultaneous joins, independent scoring, tap and physics rounds, full sixteen-word Connections messages, failed delivery and retry, stale replies, wrong-answer correction, phone reloads, Information Gap, and cross-tab settings.

The wider browser suite covers the other games, content integrity, offline fallback, reconnects, roster changes, layout, and game endings. The hidden-table drawing failure has a direct regression check. See `tools/audit-jeopardy.js` and `tools/smoke-test.js` for repeatable checks.

These are automated browser checks, not a physical handset rehearsal. The available WebKit runtime did not start successfully on this Mac, so Safari/iPhone compatibility is not independently certified by this audit. Before the meeting, play one question using the actual phones and Wi-Fi you will use.
