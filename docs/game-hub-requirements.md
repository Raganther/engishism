# Classroom Game Hub — MVP System Requirements

**Version:** 0.1 (draft for review)
**Author:** Alistair
**Date:** July 2026
**Purpose:** Proof-of-concept demonstration to academic management

---

## 1. Purpose and scope

### 1.1 Problem statement

Coursebook units end with review and extension pages, but revision in class typically
means working through those pages as exercises. This is low-energy, individual, and
does not exploit the fact that most classrooms now have a projector or large display.

Teachers who want game-based revision currently either buy generic quiz tools that
know nothing about the coursebook, or hand-build materials for each unit — which is
time-consuming and not reusable.

### 1.2 Proposed solution

A single, self-contained application that holds the target language of a coursebook
unit as structured data, and presents it through several game formats. The teacher
selects which parts of the unit to revise and which game to play; the application
builds the game from the selected content.

### 1.3 MVP scope

The MVP covers **one unit (Unit 5) of Cambridge Empower C1**, taught by the author in
the week of the demonstration. This provides a real classroom test rather than a
hypothetical one.

**In scope:**
- 3–5 game formats. Current candidates, all Tier 1 or Tier 2 per §3.6:
  Jeopardy, Blockbusters, Race to the Board, Millionaire, Bullseye.
  Final count depends on measured authoring cost (§3.4, §9.2).
- Content coverage of Unit 5, selectable by lesson section (5A / 5B / 5C / 5D)
- Teacher-facing setup: choose game, choose content, play
- Runs on classroom display via projector or large screen

**Out of scope for MVP:**
- Content authoring UI (content is authored directly in the file)
- Additional units beyond Unit 5
- Any data persistence (scores, saved games, history)
- Student devices / individual logins
- Accounts, cloud sync, or backend services
- Accessibility audit (noted as future work, see §8)

### 1.4 Success criteria

The MVP succeeds if:

1. It runs a full revision lesson on Unit 5 without technical failure.
2. The academic manager can see that the games test *the unit's actual target
   language*, not generic English.
3. The manager can see how the same approach would extend to other units.
4. Setup for a given game takes under 30 seconds of teacher time in class.

---

## 2. Users and context

### 2.1 Primary user

The **teacher**, operating the application from the classroom machine. The teacher is
the only person who touches the interface.

### 2.2 Secondary users

**Students**, who see the display but do not interact with the software directly.
They respond verbally, or physically at the board, depending on the game.

### 2.3 Operating context

- Classroom with projector or large display, typically 16:9
- Teacher's laptop or a fixed classroom PC
- Class sizes of roughly 8–16 students, split into 2–4 teams
- Revision slot at the end of a unit, typically 20–40 minutes
- Possibility of no internet connection — the application must not depend on it

---

## 3. Content model

### 3.1 Design principle

Each game has **its own content set**, authored specifically for that game's format
and covering all four lesson sections. Content is still separated from presentation —
a game's questions live in data, not in its display code — but content is not shared
between games.

### 3.2 Rationale: per-game content over a shared bank

An earlier draft proposed one shared bank with every question reusable in every game.
This was rejected. Game formats impose incompatible shapes on content:

| Format | Requires |
|---|---|
| Jeopardy | Any question + answer pair |
| Blockbusters | Answer is a single word; its first letter is the clue |
| Connecting wall | Items that group into sets of four; single items are meaningless alone |
| Tap-the-word race | A prompt plus plausible on-screen distractors |

Forcing one item to serve all of these produces items that fit each format poorly.
Authoring per game instead means each item **exploits** its format: a Blockbusters
clue can be written so the initial letter is a genuine hint; a wall's groups can be
built around a real conceptual distinction such as collocation or register.

This also has pedagogical value. A student revising 5B in two different games meets
the same target language from two different angles, rather than meeting an identical
question in a new wrapper. Varied retrieval is better recall practice than repetition.

**Cost:** authoring effort scales with the number of games rather than being amortised
across them. Five games covering four sections means twenty small content sets to
write and keep coherent. This is a known and accepted tradeoff; §9 requires that the
real cost be measured during Unit 5 authoring rather than estimated.

### 3.3 Structure

Each game owns a content set, internally organised by lesson section:

```
CONTENT = {
  jeopardy: {
    "5A": [ ...items shaped for Jeopardy... ],
    "5B": [ ... ],
    "5C": [ ... ],
    "5D": [ ... ]
  },
  blockbusters: {
    "5A": [ ...items shaped for Blockbusters... ],
    ...
  },
  ...
}
```

Item shape is defined per game, since each format needs different fields. Common
fields across all games:

```
{
  section:  "5A" | "5B" | "5C" | "5D"
  prompt:   question or clue text        [required]
  answer:   expected answer              [required]
  note:     teacher-facing note          [optional]
}
```

Game-specific additions are documented alongside each game in §4.4.

### 3.4 Content volume

Each game needs enough items per section that any section selection can fill a full
board, with enough surplus that repeat plays differ.

| Game | Items per round | Minimum per section | Section total (×4) |
|---|---|---|---|
| Jeopardy | 25 (5 categories × 5) | 15 | 60 |
| Blockbusters | 18 (fixed 5/4/5/4 board) | 10 | 40 |
| Race to the Board | 10–15 | 10 | 40 |
| Millionaire | 8–10 per team ladder | 12 | 48 |
| Bullseye | 12–15 | 12 (4 per difficulty tier) | 48 |

**Requirement:** every game must be playable from a **single lesson section**. A
teacher who has taught only 5B must be able to revise only 5B. Where a format cannot
be filled from one section — Jeopardy's 25-tile board in particular — the game must
either scale its board down or state a clear minimum selection.

**Authoring total.** Five games at these minimums is roughly **236 items** for one
unit. This is the figure that determines whether the approach scales to the rest of
the coursebook, and it is the single most important number to validate during Unit 5
authoring (§9.1). If it proves too costly, the lever is **fewer games**, not thinner
content per game — three well-populated games demonstrate the concept better than five
sparse ones.

### 3.5 Content authoring

For the MVP, content is authored directly in the source file by the author. No
authoring interface is required. The structure must be readable enough that a
non-programmer could see how to add an item, since this supports the extensibility
argument in the demonstration.

Because each game owns its content, adding a new game is a self-contained task: write
its content set, write its display logic, register it in the game menu. Nothing in the
existing games needs to change. This is the main architectural benefit of the per-game
model and is worth demonstrating explicitly.

---

### 3.6 Content-fit analysis: how well each format generalises

A game is only worth building if it will work for units beyond the one it was built
for. Formats differ sharply in how much they constrain the content they need. This
analysis should be repeated against any new unit before committing to author for it.

**Tier 1 — content-agnostic. Will fit any unit.**

| Game | Requires | Why it generalises |
|---|---|---|
| Jeopardy | Question + answer | Imposes nothing on content; categories are author-defined |
| Millionaire | Question + 1 correct + 3 distractors | Any teachable point can be framed as multiple choice |
| Bullseye (risk tiers) | Questions tagged by difficulty | Difficulty tiers are assigned by the author, not dictated by content |
| Race to the Board | Target word set + selecting prompts | Every unit has a vocabulary set |

**Tier 2 — mildly constrained. Fits most units; check first.**

| Game | Requires | Where it struggles |
|---|---|---|
| Blockbusters | Single-word answers with useful initial letters | Units built on multi-word grammar structures. Prompting for the head word of a phrase is contrived. |
| Anagram sprint | Single words worth spelling | Units whose target language is phrasal rather than lexical |

**Tier 3 — content-dependent. Assess per unit; may not be viable.**

| Game | Requires | Where it fails |
|---|---|---|
| Connecting wall | 16 items grouping four ways on a real linguistic property, with deliberate ambiguity | Units without enough groupable items. Falling back on topic-based groups ("words from the reading") is pedagogically thin and unsatisfying to solve. |
| Family Fortunes | Prompts with several defensible answers | Units built on discrete grammar points with single right answers |
| Pointless | Multiple acceptable answers, each with a plausible obscurity score | As above, plus significantly higher authoring cost |

**Design consequence.** The reusable asset is not "a game" but **a game engine plus a
content specification** — a documented statement of what content the game needs, so a
teacher can assess a new unit against it before authoring. Each game in §4.4 therefore
documents its required content fields and authoring constraints.

**MVP consequence.** The MVP should be weighted toward Tier 1, so the claim "this
approach transfers to any unit in the coursebook" is defensible with minimal caveats.
Tier 3 formats are strong games and worth building eventually, but they weaken the
generalisation argument if presented as core.

---

## 4. Functional requirements

### 4.1 Navigation

| ID | Requirement | Priority |
|---|---|---|
| F1.1 | Teacher selects a game from a visual menu of available games | Must |
| F1.2 | Teacher selects which lesson sections (5A–5D) to include | Must |
| F1.3 | Teacher can return to game selection without reloading | Must |
| F1.4 | Teacher can reset the current game to a fresh board | Must |
| F1.5 | Application indicates when a selection has too few items for the chosen game | Must |
| F1.6 | Each game shows which skill or objective it practises | Should |

### 4.2 Content selection

| ID | Requirement | Priority |
|---|---|---|
| F2.1 | Sections are individually selectable via checkboxes | Must |
| F2.2 | Item count for the current selection is displayed before starting | Must |
| F2.3 | Items are shuffled so repeat plays differ | Must |
| F2.4 | Selection persists when switching games within a session | Could |

### 4.3 Gameplay — common

| ID | Requirement | Priority |
|---|---|---|
| F3.1 | Question text is legible from the back of a classroom | Must |
| F3.2 | Answer is hidden until the teacher reveals it | Must |
| F3.3 | Teacher controls all progression; nothing advances on a timer unless the game requires it | Must |
| F3.4 | Used or claimed items are visually distinct from unused ones | Must |
| F3.5 | Team scores can be adjusted manually by the teacher | Must |
| F3.6 | Team names are editable | Should |

### 4.4 Gameplay — per game

**Jeopardy**
- Grid of categories × point values
- Clicking a tile shows the question; teacher reveals the answer
- Used tiles are marked spent
- Manual scoring for 2–4 teams
- Content fields: `category`, `value`, `prompt`, `answer`

**Blockbusters**
- Fixed 5/4/5/4 hexagon board (18 hexes)
- Each hexagon shows the answer's first letter
- Two teams; one connects left–right, the other top–bottom
- Teacher assigns each hexagon to a team on a correct answer
- Content fields: `letter`, `prompt`, `answer`
- Authoring note: answers should be single words, and clues written so the initial
  letter meaningfully narrows the possibilities

**Connecting wall**
- 16 tiles, four hidden groups of four
- Students identify groups; teacher confirms
- Solved groups lock and are colour-coded
- Content fields: `groupLabel`, `items[4]`, `explanation`
- Authoring note: groups should share a real linguistic property — collocation,
  register, word class — not merely topic. At least one group should be a plausible
  trap for another.

**Tap-the-word race** *(kinaesthetic)*
- Target words displayed scattered on screen
- A prompt appears; a student comes to the board and taps the matching word
- Correct taps highlight; incorrect taps are indicated but not penalised
- Optional timer for competitive rounds
- Content fields: `prompt`, `answer`, `distractors[]`
- Authoring note: distractors must be plausible for the prompt, otherwise the game
  tests reading speed rather than language knowledge

**Who Wants to Be a Millionaire — teams variation**
- Teams take turns; each climbs its own ladder of 8–10 questions of rising difficulty
- Four options shown per question; teacher reveals the correct one
- Safe havens at set levels (e.g. Q5), so a late mistake does not wipe out a team's
  score and disengage them for the rest of the game
- Three lifelines, each usable once per team:
  - **50:50** — removes two wrong options
  - **Ask the Class** — the rest of the room votes; result shown as an on-screen bar
    chart. Keeps non-answering teams engaged and gives the teacher a live read on
    whole-class understanding.
  - **Confer** — 30 seconds to consult another team
- Content fields: `prompt`, `answer`, `distractors[3]`, `difficulty`
- Authoring note: distractors should target predictable learner errors — a false
  friend, a common collocation slip, a plausible-but-wrong tense — rather than being
  obviously absurd. The wrong options are where the teaching happens.

**Bullseye — risk-tier quiz**
- Team chooses a difficulty tier *before* seeing the question: safe (1 point),
  risky (3), reckless (5)
- Question is drawn from the chosen tier; correct answers score that tier's value
- Optional variant: an incorrect answer at a higher tier deducts points, sharpening
  the risk decision
- Content fields: `prompt`, `answer`, `difficulty` (1–3)
- Rationale: the strategic layer generates discussion between teammates about what
  they collectively know, which is itself useful retrieval practice. Fits any content,
  since difficulty tiers are assigned by the author.

**Optional additional games — for later selection**

Not committed for the MVP. Listed so the choice is deliberate rather than default.
Tier ratings refer to §3.6.

| Game | Tier | Mechanic | Strengths | Costs |
|---|---|---|---|---|
| Connecting wall | 3 | 16 tiles, find four groups of four | Makes students articulate *why* items relate; high C1 value; strong visual impact | Needs genuinely groupable content; hardest to author well |
| Family Fortunes | 3 | Guess ranked hidden answers to an open prompt | High energy; rewards breadth of vocabulary | Needs prompts with several defensible answers |
| Pointless | 3 | Obscure correct answers score best | Rewards reaching past the obvious word — valuable at C1 | Every acceptable answer needs a plausible score assigned |
| Wheel of Fortune / Hangman | 2 | Reveal a hidden phrase letter by letter | Very cheap to author; ideal for fixed expressions and idioms | Slow per item; better as a short closer than a full activity |
| Anagram sprint | 2 | Unscramble a target word against the clock | Cheapest of all to author; tests spelling and word form, which no other game here does | Pedagogically thin; little beyond form recognition |
| Countdown letters round | — | Build the longest word from random letters | Good warmer | **Not recommended**: content-free, so it does not revise the unit and does not support the pitch |

### 4.5 Display

| ID | Requirement | Priority |
|---|---|---|
| F5.1 | Layout is legible at 1280×720 and above | Must |
| F5.2 | Layout adapts to window size without breaking | Must |
| F5.3 | Colour scheme has sufficient contrast for projection in a lit room | Must |
| F5.4 | No element requires hover to be understood — projectors have no cursor for students | Should |

---

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| N1 | Single HTML file, no installation, no build step |
| N2 | Runs offline with no network dependency |
| N3 | Runs in current Chrome, Edge, Firefox and Safari |
| N4 | Opens and is ready to use within 5 seconds |
| N5 | No user data collected or transmitted |
| N6 | Source is commented well enough for another developer to extend |

---

## 6. Assumptions

- One teacher operates the application; no multi-user coordination is needed.
- The classroom has a working display and the teacher can open a local file on it.
- Students respond verbally or at the board; they do not need devices.
- The teacher is the arbiter of correct answers, including partial or alternative
  answers the software does not know about.
- A revision lesson is the primary use case; the games follow teaching rather than
  replacing it.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Content authoring is slow, making other units expensive to add | High | Per-game content multiplies authoring work by the number of games. Measure actual time spent on Unit 5 and report it honestly rather than estimating. If the cost proves prohibitive, reducing the number of games is the lever, not reducing quality per game. |
| Twenty separate content sets drift in quality or coverage | Medium | Author section by section rather than game by game, so all games are checked against the same lesson material while it is fresh |
| Games entertain but do not produce measurable learning | High | Frame as revision and recall practice; be explicit that it supplements rather than replaces |
| Technical failure during the demonstration | Medium | Rehearse on the actual classroom machine; have a board pre-built before presenting |
| Relationship to the coursebook publisher's copyright | Medium | Items are original questions targeting the same language points, not reproductions of coursebook text. Suitable for internal classroom use; would need review before any wider distribution. See §8. |
| Board layouts break on unfamiliar screen sizes | Low | Test at classroom resolution ahead of the demonstration |

---

## 8. Known limitations and future work

Deliberately excluded from the MVP, but worth raising with management as the
natural next steps:

- **Content authoring interface** so teachers can add their own units without editing code
- **Coverage of remaining units** — the MVP proves one unit; the value case depends on scale
- **Persistence** of scores or saved boards across lessons
- **Accessibility**: colour-blind-safe team colours, keyboard navigation, screen-reader
  support. The current Gold/Silver team colours in particular need review.
- **Copyright position** if the tool is ever shared beyond the school
- **Student-device mode** for individual or pair practice outside class

---

## 9. Open questions

1. **What is the realistic authoring time per unit?** This is the number management
   will care about most, and it is currently unknown. Under the per-game content model
   it is also the number most likely to be underestimated. Unit 5 authoring should be
   timed, broken down per game, and reported as measured fact.
2. **How many games can the MVP sustain?** The spec says 3–5. The lower bound may be
   the honest answer once authoring cost is measured. Three well-populated games
   demonstrate the concept better than five thin ones.
3. **Which games best suit Unit 5's content?** Deferred until the content is known.
   Blockbusters in particular (Tier 2, §3.6) should be checked against Unit 5's target
   language before authoring: if the unit is built on multi-word structures rather than
   single-word vocabulary, the format will fight the content.
4. **Should Bullseye penalise wrong answers at higher tiers?** Deducting points sharpens
   the risk decision but can demoralise a trailing team. Decide after one classroom run.
5. **Is Millionaire's team format better as parallel ladders or a single shared ladder
   with teams alternating?** Parallel gives every team a full arc; shared is faster and
   keeps all eyes on one board. Worth trialling both in the Unit 5 lesson.
6. **Should any Tier 3 game (§4.4, optional list) be built for the demonstration?**
   The connecting wall has the highest pedagogical value of any format considered, but
   the weakest generalisation guarantee. Building it as an explicitly conditional
   "works when the unit suits it" example may demonstrate judgement rather than
   inconsistency — but only if there is authoring capacity left after the Tier 1 games.
7. Should section selection allow finer granularity than 5A–5D — for example,
   individual exercises — if a lesson covers only part of a section?
8. Should Jeopardy scale its board down when only one section is selected, or state a
   minimum of two sections? (See §3.4.)
