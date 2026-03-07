# Engishism — Dev Notes

## Ideas Backlog

### Game Types — Priority Picks
Highest ESL value vs build effort. Build these next.

| Game | Effort | Good for |
|---|---|---|
| **Anagram** | Low | Spelling, vocabulary recall |
| **Call My Bluff** | Low | Vocabulary depth — 3 definitions, one real, students vote |
| **Jeopardy** | Medium | Any content — categories × point values, team claims squares |
| **Countdown (letters)** | Medium | Spelling — 9 letters, 30s, make the longest word |
| **Blockbuster** | High | Vocabulary — hex grid, teams connect their side |
| **Millionaire** | High | Any — progressive difficulty, 50/50 lifeline |

### Game Types — Full Brainstorm

**Dead simple (display + reveal):**
- Anagram — scrambled word, click to reveal
- Call My Bluff — 3 definitions, one real, vote then reveal
- Odd One Out — 4 words, one doesn't belong, click to reveal + reason
- Missing vowels — word with vowels removed (e.g. DSCRCTD), guess and reveal

**TV show formats:**
- Jeopardy — grid of categories × values, answer in the form of a question
- Countdown — 9 letters on screen, 30s timer, make the longest word
- Millionaire — progressive questions, 50/50 lifeline, increasing stakes
- Blockbuster — hex grid, teams connect their sides, word starts with hex letter
- Only Connect — find the connection between 4 items (advanced)
- Catchphrase — reveal a phrase progressively (word by word or letter by letter)

**Classroom staples:**
- Bingo — vocabulary bingo card, teacher reads definitions/clues
- Taboo — word + 3 forbidden words, describe without using them, timer
- Pictionary — progressive reveal of a clue, students guess
- Word Chain — last letter of one word = first letter of next

### Activity Types — Already Built
- title-card, reveal-card, fill-blank, meaning-pair, sentence-complete
- true-false, hot-seat, noughts-crosses

### Modules — Already Built
- timer, scoreboard, teams

### Module Ideas — Future
- buzzer — on-screen buzz-in button per team (phone integration later)
- lives — teams lose a life for wrong answers
- progress — visual progress bar through an activity

### UX / Presentation Ideas
- Fullscreen button (F key or button)
- Lesson picker — DONE
- Dark/light theme toggle for room lighting
- Keyboard shortcut cheat sheet overlay (press ?)
- Sound effects — correct answer chime, timer warning, win sound

### Architecture Ideas — Future
- Phone/Kahoot-style student interaction (slide type gets multiplayer flag + backend)
- Teacher-facing lesson builder UI
- Claude integration: photo → lesson file auto-generation — DONE (docs/lesson-prompt.md)

### Phone / Multiplayer Interaction (Kahoot-style)

**How it works:**
Teacher's laptop runs a tiny local Node.js server. Everyone connects over classroom WiFi.
Server sits in the middle — pushes questions to the teacher's screen, receives answers from phones.
Real-time two-way communication via WebSockets.

**What's needed:**
- `server.js` — ~100 lines of Node.js (Express + WebSocket). Teacher runs `node server.js` before class.
- Student view — simple mobile-friendly page, just big answer buttons. Served by the same server.
- QR code on teacher's screen — students scan to join (avoids typing IP addresses).

**Protocol:**
```
Server → phones:   { type: "question", options: ["A","B","C","D"] }
Phones → server:   { type: "answer", student: "name", choice: "B" }
Server → teacher:  { type: "results", data: { A:2, B:5, C:1, D:0 } }
```

**How it fits the existing architecture:**
One flag on a slide activates phone mode. Engine connects to server instead of running standalone.
Activity receives answers via the existing event bus — doesn't know or care where they came from.
```js
{ type: "multiple-choice", multiplayer: true, modules: ["scoreboard"], content: { ... } }
```

**Practical concerns:**
- School WiFi can be restrictive — may need hotspot fallback
- Phones falling asleep mid-game
- Student identity — name entry or anonymous?
- Teacher needs to run a server command before class (low friction but a new step)

**When to build:**
After the core game library is solid (8-10 good games). Architecture is already designed for it.
Estimated effort: one weekend for a basic working version.

## Completed Plans
- Engine v1: slideshow mode, 5 activity types (2026-03-07)
- Simple games proof of concept: true-false, hot-seat, noughts-crosses (2026-03-07)
- Selector mode + onComplete composable interface (2026-03-07)
- Multi-item activities: grouped questions per activity type (2026-03-07)
- Composable module system: timer, scoreboard, teams + event bus (2026-03-07)
- Lesson picker: manifest + dynamic loading, no more editing index.html (2026-03-07)
