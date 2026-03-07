# Active Plan — Simple Games (Proof of Concept)
Started: 2026-03-07

## Goal
Prove the modular framework works by building 3 simple games as activity modules.
No engine changes. Each game = one file, one schema, plug in and go.

## Games to build (in order)

### 1. True / False
Simplest possible. Statement on screen. Students call it. Click to reveal.
- No timer, no teams, no scoring
- Proves: display + reveal pattern works for game content

Schema:
```js
{ type: "true-false",
  content: {
    statement: "You use a gerund after 'enjoy'.",
    answer: true,
    explanation: "Enjoy + gerund: I enjoy reading."
  }
}
```

### 2. Hot Seat
Big word on screen. One student faces away. Teammates describe. Timer counts down.
- Needs: a countdown timer (self-contained inside the activity)
- No scoring for MVP — teacher keeps score mentally
- Proves: timer pattern works

Schema:
```js
{ type: "hot-seat",
  content: {
    words: ["distracted", "segmented", "attribute", "filter down"],
    time: 60
  }
}
```

### 3. Noughts & Crosses
3×3 grid of questions. Teams take turns. Answer correctly to claim a square.
- Teacher clicks a cell to reveal the question, clicks again to mark O or X
- Needs: team labels (hardcoded Team A / Team B for now)
- Proves: stateful grid interaction works

Schema:
```js
{ type: "noughts-crosses",
  content: {
    teams: ["Team A", "Team B"],
    cells: [
      { question: "Use 'enjoy' + gerund in a sentence.", answer: "I enjoy reading." },
      // × 9
    ]
  }
}
```

## Steps
1. [ ] Build true-false.js + add to lessons/unit-8a.js to test
2. [ ] Build hot-seat.js + add to lessons/unit-8a.js to test
3. [ ] Build noughts-crosses.js + add to lessons/unit-8a.js to test
4. [ ] Verify all three load, render, and interact correctly
5. [ ] Git save

## Notes
- Each game is one file in activities/
- One line added to index.html to load it
- Engine does not change
- Keep UI minimal — this is proof of concept, not polish
