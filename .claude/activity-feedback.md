Status: current | Epistemic: confirmed | Last verified: 2026-04-22

# Activity Feedback & Design Notes

Reference for how each activity works from the teacher's perspective, design decisions, and feedback. Schemas (data shapes) are in `.claude/activities/schemas.md` — this file covers behaviour and UX.

## Knowledge

### title-card
**How it works:** Static slide displaying unit number, heading, and subheading. No interaction — teacher advances manually.
**Teacher use:** Always first slide. Sets the topic for the class.
**Scoring:** None.
**Feedback:** (none yet)

---

### reveal-card
**How it works:** Static reference card showing a list of items with labels and examples. All items visible at once — no progressive reveal.
**Teacher use:** Grammar rule summaries, vocabulary lists, form tables. Teacher talks through each item.
**Scoring:** None.
**Feedback:** (none yet)

---

### fill-blank
**How it works:** Sentences with blanks (marked as `[answer]` in content). Teacher taps a blank to reveal the answer. Internal navigation: Next button steps through questions, final item shows "Done ✓".
**Teacher use:** Grammar drills, vocabulary in context. Teacher reads the sentence, class guesses, then teacher reveals.
**Scoring:** None (no team claim mechanism).
**Feedback:** (none yet)

---

### picture-choice
**How it works:** One picture prompt appears at a time with multiple sentence choices. Teacher or class selects an answer; the chosen button is marked correct or wrong, the correct option is highlighted, and the teacher advances with Next.
**Teacher use:** Picture-based grammar or vocabulary checks. Good for present continuous action pictures where students match an image to a sentence.
**Scoring:** None.
**Feedback:** (none yet)

---

### meaning-pair
**How it works:** Two sentences (A and B) shown side by side. Three-stage reveal: sentence A visible → click "Show B" → click "Show note" (explanation of the difference). Internal navigation between pairs.
**Teacher use:** Active/passive contrasts, tense differences, meaning nuances. Teacher reads A, class discusses, then reveals B and explanation.
**Scoring:** None.
**Feedback:** (none yet)

---

### sentence-complete
**How it works:** A sentence stem shown with an optional hint (e.g. "+ gerund"). Students complete it verbally. Teacher clicks "Reveal answer" to show a model answer. Internal navigation between stems.
**Teacher use:** Open-ended grammar practice. The hint constrains the form; the model answer gives one example.
**Scoring:** None.
**Feedback:** (none yet)

---

### true-false
**How it works:** A statement displayed. Students decide true or false. Teacher clicks "Reveal answer" to show the verdict (TRUE/FALSE badge) and an explanation. Internal navigation between questions.
**Teacher use:** Grammar rules, vocabulary facts, comprehension checks. Good for quick-fire whole-class response.
**Scoring:** None.
**Feedback:** (none yet)

---

### hot-seat
**How it works:** One student sits with back to the TV. Words appear one at a time on screen. The class describes each word without saying it. Start button begins the round, Next button advances words and awards a point. Timer counts down (internal timer or via timer module). "Time's up!" ends the round.
**Teacher use:** Vocabulary review. High energy. Works best with 8–12 words.
**Scoring:** Yes — fires `point` event per word guessed. Routes to session bar via `events.emit('point')`. Words are shuffled randomly each play.
**Feedback:** (none yet)

---

### noughts-crosses
**How it works:** 3×3 grid of numbered squares. Click a square to see its question. "Reveal" shows the answer. Two claim buttons (Team X / Team O) let the teacher award the square. Win detection highlights three-in-a-row and announces the winner.
**Teacher use:** Review game mixing question types. Teams take turns picking squares and answering. Good end-of-lesson activity.
**Scoring:** Yes — win detection fires `onComplete` with winner. No per-square point events (winning is the reward).
**Feedback:** (none yet)

---

### anagram
**How it works:** Scrambled uppercase word displayed. Students guess. Teacher clicks "Reveal" to show the answer and optional hint. Internal navigation between words.
**Teacher use:** Spelling and vocabulary recall. Quick and low-prep.
**Scoring:** None.
**Feedback:** (none yet)

---

### call-my-bluff
**How it works:** A word displayed with three definitions (A, B, C). Class votes on which is real. Teacher clicks "Reveal" — correct definition highlighted green, wrong ones red. Internal navigation between items.
**Teacher use:** Vocabulary depth. Good for discussion — "why did you think B?" Usually 3 items per slide.
**Scoring:** None (could add team claim).
**Feedback:** (none yet)

---

### odd-one-out
**How it works:** Four words displayed. Students identify which doesn't belong. Teacher clicks "Reveal" — odd word highlighted, reason shown. Internal navigation between sets.
**Teacher use:** Vocabulary categories, collocations, semantic grouping. Good for discussion before reveal.
**Scoring:** None.
**Feedback:** (none yet)

---

### missing-vowels
**How it works:** A word displayed with all vowels removed (uppercase). Students guess the full word. Teacher clicks "Reveal" to show answer and optional hint. Internal navigation between items.
**Teacher use:** Spelling focus. Quick rounds. Can use as a warm-up.
**Scoring:** None.
**Feedback:** (none yet)

---

### jeopardy
**How it works:** Grid of categories × point values (4 categories, 4 questions at 200/400/600/800). Click a cell to see the question. "Reveal answer" shows it. Claim buttons for each team award the points directly to session bar via `Session.award()`. Claimed cells are colour-coded per team and disabled. Back button returns to grid without claiming. Game completes when all cells claimed.
**Teacher use:** Major review game. Works best with 2–4 teams. Categories should cover different aspects of the lesson.
**Scoring:** Yes — per-question points awarded to session teams. Uses `window.Session.teams` directly.
**Feedback:** (none yet)

---

### countdown
**How it works:** Generative — no pre-written content. Teacher clicks Vowel/Consonant buttons to build 9 random letters (max 5 vowels, weighted by English frequency). 30-second timer starts automatically when all 9 letters placed. "Time's up!" ends the round. "New Round" resets for another go. "Done" fires onComplete.
**Teacher use:** Spelling game. Students write the longest word they can from the 9 letters. Teacher-driven reveal (students share answers verbally). Letter frequency pools match the TV show distribution.
**Scoring:** None (teacher judges verbally).
**Feedback:** (none yet)

---

### millionaire
**How it works:** Progressive questions with increasing stakes (£100 → £1,000,000, scaled to question count). Select an option → "Final Answer" → reveal correct/wrong. 50/50 lifeline removes two wrong answers (one use). "Walk Away" ends with current winnings. Safe levels at ~1/3 and ~2/3 mark. Claim buttons after each correct answer and on end screen let teacher award points to a session team.
**Teacher use:** High-stakes review. 10 questions, increasing difficulty. Good for grammar or vocabulary where there's one correct answer. The walk-away mechanic adds tension.
**Scoring:** Yes — claim buttons after each question and on end screen. Awards monetary value as points via `Session.award()`.
**Feedback:** (none yet)

---

### scenario-cards
**How it works:** Card grid showing titles and scenario snippets. Click a card to see the full scenario. Three-stage reveal: scenario text → "Reveal Verdict" (coloured badge + explanation) → "Show Details" (bullet points + hook phrase). Back button marks the card as done (✓) and returns to grid. Progress counter shows done/total.
**Teacher use:** Discussion-driven. Each scenario prompts class debate before the verdict reveal. Hooks provide a language model or grammar prompt. Works for ethics, scams, workplace situations.
**Scoring:** None. The discussion is the point.
**Feedback:** (none yet)

---

### fluency-tree
**How it works:** Branching two-speaker conversation displayed as a chat thread. Each turn shows the current speaker and 2–3 response options as buttons. Teacher clicks a response → it appears as a chat bubble (A left-aligned, B right-aligned). Paths branch based on choices and can merge. End nodes show "Done ✓". Thread auto-scrolls as conversation grows.
**Teacher use:** Modelling natural conversation. Two students read the chosen lines, or the teacher drives it. The branching lets the class vote on direction. Key teaching moment: compare what different options lead to.
**Scoring:** None. Fluency practice, not competitive.
**Design constraint:** Merge nodes must have universal options that work regardless of incoming path (see merge rule in schemas.md).
**Feedback:** (none yet)
