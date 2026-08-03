# Classroom Game Hub — MVP System Requirements

**Version:** 0.4
**Author:** Alistair
**Date:** August 2026
**Purpose:** Proof-of-concept demonstration to academic management

## Status at v0.4

v0.3 described skins hosting rounds as a direction with one caller. It has a second
caller now, and the thing that changed in the thinking is bigger than the feature.

**The reframe: this is a classroom session container, not a quiz engine.** What the hub
actually provides is teams, scores, turns, a projected surface, a timer, and thirty
connected handsets that can each be put into a different state. A *game show* is one
thing you can do with that. Everything built so far has been question-shaped, and
nothing in the container requires it to be — see §3.10.

**Built since v0.3:**

| | |
|---|---|
| Round hosts | **2** — Jeopardy and Blockbusters. A host is four declared facts in `ROUND_HOSTS`, not a per-game adapter |
| Evidence | Blockbusters cost **no change to any of the five rounds**, which is what F3.8.13 was after. One caller was only ever a guess about an API |
| Settings | `jGroupWho` → `roundWho`, `jRound_<id>` → `round_<id>`, moved to the shared `Questions` group and offered to every host, with a migration for stored overrides |
| Content gate | Blockbusters' bank splits the way Jeopardy's already did — the round is asked its own rules, the bank's tidiness stays with the host |
| Lab board | gained a hexagon board: `LB1` (18 items, six of them rounds) and `LB2` (rounds only) |

**What is NOT yet true, and matters most:**

- **No round has ever been played from a class-facing unit.** Units 4 and 5 carry
  **zero** round fields between them, so rounds exist only on the Lab board. The
  capability is in the engine everywhere; the content is nowhere. This is now the
  single largest gap between what is built and what a class would meet.
- **The clue card's action strip is hub-owned but holds buttons from three tiers**
  (hub, skin and round), listed by hand in the skeleton — and **a round can therefore
  have exactly one button**. See §3.9.
- **Persistent per-player round state (F3.8.8) is worth more than the two remaining
  hosts.** It is what roles, information gaps, hands of cards and personal scorecards
  all need, and the relay is most of the way there already. Re-prioritised in the
  build order.
- **Still nothing has been run in front of a class.** Unchanged since v0.2, and the
  count of guessed numbers keeps rising.

## Status at v0.3

v0.2 described a system of **games with content**. What has been built since is a
system of **skins hosting questions**, and that is a different enough idea to be
stated up front rather than left to be inferred from a changelog.

**The distinction that changed everything:** a *game show* is now a skin — a board
with question slots, which owns geometry, scoring and turns. A **round** is a question
that is *played*: the card the projector draws, what the handsets are put into, how
several students' taps become one team answer, and whether that answer is right. A
game show calls a round by name and inherits all four. §3.8 is the new architecture
section; §3.7's three layers are now four.

**Built since v0.2:**

| | |
|---|---|
| Games | 5 — Bingo joined the four, consuming an existing bank through a predicate rather than a bank of its own |
| Rounds | 5 — grouping (Connections), ordering (Word Thermometer), multiple choice, anagram and word order (both dragged on the handsets). One registry, `Kit.round` |
| Question forms | 6 on the shipped shelf (`Kit.prompt`): gap, anagram, odd one out, error fix, word order, word bridge |
| Workshop | `playground/question-bench.html` — a round's card and a rack of real handsets on one screen, and now a content editor that loads, edits and exports categories |
| Lab board | `game-hub-lab.html` — 11 categories, one question type each, deliberately not loaded by the class-facing hub |
| Regression | ~50 suites; the content gate now asks each round for its own rules rather than holding a copy |

**What is NOT yet true, and matters most:**

- **Rounds play in two game shows.** Jeopardy and Blockbusters both host them, and a
  host is now four declared facts in `ROUND_HOSTS` rather than an adapter — but
  Millionaire, Race and Bingo still cannot host one, and the last two are blocked on
  F3.8.8/F3.8.9 rather than on effort.
- **Phone logic still lives in the game shows**, all five of them. `phoneRound()`
  exists precisely because two of them wanted the handsets at once.
- **Content is still four hand-authored banks per unit.** §3.2's per-game model is
  intact and is now the main authoring cost.
- **None of it has been run in front of a class.** Unchanged from v0.2, and now
  covering considerably more guessed numbers.

## Status at v0.2

v0.1 was written before anything was built. Enough has shipped that the honest thing
is to say which parts of this document are specification and which are description.

**Built and working:**

| | |
|---|---|
| Games | Jeopardy, Blockbusters, Race to the Board, Millionaire (4 of the 3–5 in §1.3; **Bullseye not built**) |
| Units | **2** — Unit 5 (Fairness) and Unit 4 (Consciousness), against §1.3's planned 1. Both complete across all four sections |
| Content | **565 items.** Unit 5: 319 across 5A–5D. Unit 4: 246 across 4A–4D. Both units carry all four games |
| Beyond spec | Per-game settings panel (§4.4b), phone buzzers (§4.4c), game show mode (§4.4d), content-integrity gate (§4.4a), a 240-check regression suite |

**Not yet true of any of it:** none of this has been run in front of a class. Every
"untrialled" note in §4.4b–d still stands, and §1.4's success criteria are all
unverified.

**What changed structurally since v0.1:** the engine grew a **layered architecture**
with a game registry (§3.7). v0.1 had no architecture section at all, which is why
adding the fourth game cost more than the third.

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
  → **Four built** (all but Bullseye). Authoring cost is now measured, and four is
  the honest answer — see §9.2.
- Content coverage of Unit 5, selectable by lesson section (5A / 5B / 5C / 5D)
  → **Complete, 5A–5D.** 5D (the opinion-essay lesson) was the last gap and turned out
  to suit the formats well: linkers make excellent Race tiles, and paragraph function
  is a fixed structure that tests cleanly in Jeopardy and Millionaire.
- Teacher-facing setup: choose game, choose content, play
- Runs on classroom display via projector or large screen

**Out of scope for MVP:**
- Content authoring UI (content is authored directly in the file)
- Additional units beyond Unit 5
  → **Departed from deliberately.** Unit 4 was added because a second unit is what
  turns "it works for this unit" into "it transfers", which is success criterion
  §1.4.3. Unit 4 began with Jeopardy and Blockbusters only — which was itself the
  point, since a unit adopts games one at a time (F3.7.4) — and now carries all four.
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

**Measured (Unit 5, four games, sections 5A–5C):**

| Bank | Items |
|---|---|
| Jeopardy | 70 (14 categories × 5) |
| Blockbusters | 60 |
| Race to the Board | 65 |
| Millionaire | 68 |
| **Total** | **263** |

The estimate held. 263 items for four games across three sections projects to roughly
**250–270 for a full four-game unit**, against the 236 predicted for five games — so
the per-game figures in the table above were slightly low, not the model. Useful
sub-measurements: Millionaire's ladder cost **36 questions** for one unit (the single
largest job, because every item needs three plausible distractors), and covering the
two Grammar Focus reference pages properly cost a further **47 items** across three
games. Race is the cheapest per item — no distractors are authored, because every other
word on the board is a real target word.

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

### 3.7 Layered architecture

v0.1 specified a content model but no architecture, and it showed: by the fourth game
there were nine places in the engine shaped like `if (activeGame === 'jeopardy')` —
board building, screen-fitting, the entrance animation, resize, timer expiry, the
content picker, the start button, unit loading, and the games-a-unit-offers list. A
new game had to be threaded into all nine by hand, and **nothing failed if you missed
one**. You would get a game that worked except for the two beats you forgot.

The system now has three layers and two axes that cut across them.

| Layer | Contains | Cost of changing it |
|---|---|---|
| **1 · Template** | Everything a game gets by existing: the skin, team bar, scoring, timer, clue card, end-of-round banner, sound, the shared kit, the content gate | Highest engineering risk — touches every game. This is what the regression suite exists for |
| **2 · Game** | Board logic, its stage's look, its own source of `--tension`. Free-form within the registry contract | Low risk, isolated |
| **3 · Content** | The banks — shaped per game (§3.2), organised per unit (§3.3) | Near-zero engineering risk, **highest cost in teacher hours** |

**Layer 1 is two things pointing in opposite directions**, and which one a feature
belongs to determines how it propagates:

- **Services a game calls** — `fitToScreen`, `applause`, `showResult`. Written once;
  every game inherits, including games that do not exist yet. A richer countdown clock
  is this kind of change: one widget, universal effect, no per-game work.
- **Hooks the engine calls** — `start()`, `fit()`, `tension()`, `onResize()`. Adding a
  new beat to the round lifecycle means every game *may* respond to it, and those that
  don't are silently fine.

**The registry (F3.7.1–3)** turns layer 2 from a convention into a contract:

```js
registerGame({
  id, title,
  card:  { icon, blurb, badge },        // the game-select card
  intro: { title, sub, accent },        // its title sequence, optional
  hasBank(unit),                        // does this unit offer it?
  load, renderContent, startButton, start, fit, deal, tension, onResize, onTimerEnd
});
```

| ID | Requirement | Priority |
|---|---|---|
| F3.7.1 | A game is added by registering it; the engine contains no per-game branching | Must |
| F3.7.2 | Every hook is optional and defaults to a no-op, so a partial game still runs | Must |
| F3.7.3 | A registered game inherits the whole of layer 1 without asking for any of it | Must |
| F3.7.4 | A unit may offer any subset of games (`hasBank`), so units adopt games one at a time | Must |
| F3.7.5 | Games should eventually be able to live in their own file, as units already do | Should |

**Two axes cut across all three layers:**

- **Variants and per-game settings.** A feature can ship several interchangeable
  implementations and let the teacher choose, per game, from that game's settings tab
  — `cardFlip` (layer 1), `bbWinRoute` (layer 2) and `theme` (layer 1 applied per
  game) all use one mechanism. *Shared by default, divergent by declaration.* This is
  the answer to "should this behave the same everywhere?" — it doesn't have to be
  decided once and for all.
- **Units.** Content is a **matrix of games × units**, not a list. Unit 4 offering only
  Jeopardy and Blockbusters is a supported state. The matrix grows in two independent
  directions, which is what makes the scaling argument in §1.4.3 concrete.

**Where the layering leaks.** Honesty matters more than tidiness here:

- `hub-engine.js` holds layer 1 *and* all four layer-2 games in one closure. The
  registry gives the contract; it does not yet give a file boundary (F3.7.5).
- Parts of layer 1 were generalised *from* particular games and still carry their
  assumptions: the banner's team tones are gold/silver, the team-chooser's `allow`
  parameter exists for Blockbusters' two-team geometry, and the clue card is used by
  only two of the four games.

Layer 1 is therefore best read as *what happens to be shared so far*, not *what is
inherently shared*. That is the correct state for a system at this stage, but it should
not be mistaken for a finished abstraction.

### 3.8 Skins and rounds — the architecture from v0.3

§3.7's three layers described *games with content*. The system has since split the
middle of that in two, and the split is the single most important thing in this
document.

```
GAME HUB      the container: units, teams, scores, timer, settings, phone room
GAME SHOW     a skin with question slots. Owns geometry, scoring, turns
ROUND         a question that is played: card + phone dynamic + judging
CONTENT       filed by topic; items declare which rounds they can serve
```

**A round is four things at once**, and that is why it is a tier rather than a helper:
the card the projector draws, what the handsets are put into, how several students'
taps become one team answer, and whether that answer is right. A game show calls it by
name and gets all four.

**What a round must never contain: scoring, turns, timers, the board, a tile.** Those
belong to whatever is hosting it — Jeopardy pays a tile and passes a turn when the
round says a team has it; the question bench pays nothing at all. A round that knew
about points could only ever live in one game, which defeats the entire purpose. When
something you want to tune is missing from the bench, that is the boundary telling you
it belongs to the host.

**Where a round is built: `playground/question-bench.html`.** Not in a game. A phone
dynamic cannot be judged from the phone — what it produces lands on the card — and two
browser tabs never show cause and effect at once. The bench draws the card *through
the registry*, the same code a Jeopardy tile runs, with a rack of real handsets beside
it. It is a **workshop, not a runtime**: game shows call the round registry, never the
bench.

#### The direction: game shows become skins

Today all five games carry their own phone handling, and they fight over the handsets —
`phoneRound()` exists precisely because Bingo's cards and Jeopardy's grouping clue both
wanted them. **The target is that all phone logic lives in rounds**, and a game show is
a skin that provides context, geometry and scoring around a question slot. That removes
the conflict class rather than managing it.

| ID | Requirement | Priority |
|---|---|---|
| F3.8.1 | A round is registered once and any game show can call it by name | Must |
| F3.8.2 | A round contains no scoring, turn, timer, tile or board logic | Must |
| F3.8.3 | Every round hook past `setup` and `render` is optional | Must |
| F3.8.4 | A round declares its own item field; hosts carry it through by asking the registry, never by a whitelist | Must |
| F3.8.5 | A round declares what makes an authored item invalid (`check`); the content gate and the bench editor both read that one rulebook | Must |
| F3.8.6 | A round must be fully playable with no relay — the teacher clicks and judges | Must |
| F3.8.7 | Phone behaviour should live in the round, not the game show | Should |
| F3.8.8 | A round may hold state that outlives one question (for a game like Bingo, where a card persists across many calls) | Should — **not built** |
| F3.8.9 | A round may be given the stage as its mount, not only the clue card (for a game like Race, where the answers are the board) | Should — **not built** |

#### Which skins can host which rounds

The constraint is **contention, not answer shape**. A round wants the card and the
phones; a skin conflicts only if it already owns one of them.

| Skin | Owns the card? | Owns the phones? | Can host any round? |
|---|---|---|---|
| Jeopardy | no — a tile opens one | no | **yes** — built |
| Blockbusters | no — a hexagon opens one | no | **yes** — built |
| Millionaire | no — a rung opens one | no | **yes** — not built |
| Bingo | no | **yes** — every phone holds a card | card-only rounds, teacher-judged |
| Race | **yes** — the scattered words *are* the board | no | needs F3.8.9 |

**Blockbusters is not restricted to one-word answers**, and is now the second host.
The hexagon's letter appears in its display, the clue card's topline and the
hexagon-picking vote; the win condition is a search over which hexagons are *claimed*
and never reads it. The letter is an affordance of the skin — the hexagon's **name**,
which is how a team says which square they are attacking — not a structural
requirement, so the rule that an answer begins with it is asked of ordinary clues only.

| ID | Requirement | Priority |
|---|---|---|
| F3.8.14 | A game show hosts a round by declaring what it contributes (settings scope, modal mode, stage, whose turn, what winning pays) — never by an adapter that repeats the round's own logic | Must |
| F3.8.15 | A skin's own way of awarding a question stands down while a round is live; the round owns the verdict | Must |

**Bingo can still host a round**, card-only. Every round already supports a no-relay
path (F3.8.6), which is exactly the behaviour needed when the skin owns the handsets.

#### Content, revisited

§3.2 argued for per-game banks and that argument still holds for *answer shape* —
Blockbusters needs a one-word answer keyed by its initial, Race needs unique single
words. What v0.3 adds is that **not all content is convertible**: a grouping set or an
ordering scale cannot be derived from a gap-fill sentence. So content divides in two:

- **Shareable** — a word, its definition, its unit and section. Serves gap fill,
  Blockbusters, Race, Bingo and multiple choice.
- **Bespoke** — a grouping, a scale. Authored for one round by nature.

The target is therefore not one universal pool but **one filing system**: content filed
by *topic* (a lesson is a topic; nobody teaches "all my Connections"), with each item
declaring which rounds it can serve. A bespoke item simply declares one.

#### Rules that keep the tiers pluggable

| ID | Requirement | Priority |
|---|---|---|
| F3.8.10 | The dependency arrow points one way: `playground/` may load `game-hub/`, never the reverse | Must |
| F3.8.11 | A shared module takes what it needs as parameters and hands back data — no globals, no assumptions about the host's DOM | Must |
| F3.8.12 | Capability is declared, never special-cased. No list of games or rounds kept in step by hand | Must |
| F3.8.13 | Nothing is extracted onto a shared shelf until a second caller exists, and the first caller is rewired in the same change | Must |

F3.8.13 is not style. A shelf with one caller is a guess about an API; rewiring the
first caller is what proves the extraction was behaviour-neutral.

#### Build order

1. ~~**Blockbusters hosts a round.**~~ **Done in v0.4.** A second host and a non-tile
   geometry, at the cost of no change to any of the five rounds — which is the
   evidence F3.8.13 was after. A host is now four declared facts in `ROUND_HOSTS`
   (`game`, `modal`, `stage`, `turn()`, `win()`) rather than a per-game adapter.
   The hexagon letter turned out to be the hexagon's **name** — its face, the clue
   topline, and the picking vote's options — and never a constraint: `bbOutcome()`
   searches *claimed* hexagons and has never read it. "The answer starts with the
   letter shown" was a rule about the bank, so it is asked of ordinary clues only.
2. **Round content in a class-facing unit.** Rounds have never been played outside the
   Lab, because Units 4 and 5 carry no round fields between them. Grouping and ordering
   for 5A/5B is the cheapest way to close the largest gap in this document, and it is
   authoring rather than engineering.
3. **F3.8.8 — persistent per-player round state.** Moved ahead of the remaining hosts:
   most of §3.10 is blocked on it, and the relay already does the hard half.
4. **Millionaire hosts the multiple choice round.** No contract change, and it deletes
   Millionaire's private option rendering — the same question drawn twice in the
   codebase today. Still cheap; simply no longer the most *valuable* next thing.
5. **F3.9.1/F3.9.2** — the action strip becomes declarative, so a round may contribute
   more than one button.
6. **F3.8.9** (the stage as a mount), then **Bingo extracted**, then **Race
   extracted** — smaller first.
7. **Content filing.** Beside the existing banks, migrating a unit at a time.

**What changed in the ordering, and why.** v0.3 put the two remaining hosts first, on
the reasoning that the pattern should be proved on cheap cases before anything working
is touched. Blockbusters proved it — at the cost of no change to any round — so the
question is settled and the remaining hosts are now merely more of the same. What
replaced them at the top is the two things that are *not* more of the same: content a
class would actually meet, and the one contract addition that unlocks a category rather
than a game.

Bingo and Race still come last, and for the original reason: they are working games
with a great deal of tested behaviour, and there is nothing left to learn from
extracting them that a third host would not teach more cheaply.

**F3.8.8 has moved up.** It was a *Should* behind two hosts; it is now the thing most
of §3.10 is blocked on, and the relay is already most of the way there — it persists a
bingo card and its marks per player, across a reconnection, keyed to a remembered seat.
What is missing is exposing that to rounds. On the evidence it buys more than
Millionaire and Race hosting rounds combined.

### 3.9 The container — what owns what

A recurring question, and getting it wrong costs a refactor: when something is added to
the experience, which tier does it belong to?

**The rule: who would still be correct if you swapped the tier below it out?**

| Tier | Owns | Test |
|---|---|---|
| **Hub container** | teams, scores, the timer widget, the phone room, settings, the clue card *as a surface*, the phone strip | true whatever game is on screen |
| **Game show skin** | geometry, turns, what a question is worth, what winning is, the ending | true for this board, whatever question is in the slot |
| **Round** | the card's contents, the phone dynamic, merging several students into one answer, judging | true wherever it is hosted — which is what makes it portable |

**The clue card is not inside any stage.** `#clue-modal` is a sibling of every
`#play-<game>`, which is why `openClueCard` has to set `--tension` on it by hand rather
than inheriting it. It is a hub surface that skins borrow, not part of a skin.

**How team data reaches a round: `ctx`, handed in, never reached for.**
`{teams, sizes, teamName, prompt, team, mode, forTeam, onPick}`. `sizes` — how many
handsets are on each team — is what lets a round hold a rung until everyone on a team
agrees, and what sets each player's share of a multi-part answer. It is read **fresh at
call time**, which is why `read`, `judge` and `accept` all take it: students join and
drop all lesson, and a size the round was told once is a lie by the third question.
This is also exactly why the question bench works — it has no team bar, so it passes
its own `ctx` and no round can tell the difference.

**"The timer" is three clocks, and conflating them has bitten before.**

| Clock | Tier | Why it is separate |
|---|---|---|
| Header countdown | hub — the teacher's instrument | they set it; nothing else may overwrite it |
| Jeopardy's answer clock | skin — starts on the buzz, not on the clue opening | a clock that reset the header timer on every buzz would destroy what the teacher set |
| A round's own clock | round — sent once as a *duration* with the arm | so no handset ever has to agree the time with anybody |

#### Where the code does not match the model

The clue card's action strip is hub-owned, and correctly so — but it holds buttons
belonging to three different tiers, listed by hand in the skeleton:

| Button | Really belongs to |
|---|---|
| Reveal, Close, Skip | **hub** — any question can be revealed and closed |
| Correct / Wrong | **Jeopardy** — Blockbusters scores by claiming and has no Correct |
| `clue-claim` | **Blockbusters** (and Jeopardy's steal) |
| `hint-btn`, `wager-ok` | **Jeopardy** — hints cost tile value, wagers are Daily Doubles |
| `group-btn` | **the round** — its label comes from the round's own cap |

So the hub's skeleton currently knows what a Daily Double is. It works, because
`hideAllActionButtons()` clears the lot and each opener shows what it wants — but it is
the same shape as every other defect this project has paid for: a hard-coded list that
a new thing has to be threaded into by hand.

**The concrete cost today: a round can have exactly one button.** `group-btn` is a
single element in the skeleton, so a round wanting two actions has nowhere to put the
second.

| ID | Requirement | Priority |
|---|---|---|
| F3.9.1 | The clue card's action strip is a hub-owned *surface*; the hub, the skin and the round each declare what they contribute to it, rather than the skeleton listing every button | Should — **not built** |
| F3.9.2 | A round may contribute more than one action | Should — **not built** |
| F3.9.3 | A round is handed its host's team state as a snapshot read at call time, and never reads team state directly | Must — built |

### 3.10 Beyond question games — what the container makes possible

Everything built so far is question-shaped. Nothing in the container requires that, and
two properties are doing more work than they appear to:

1. **Scoring need not be right or wrong.** The team bar takes arbitrary points from
   anything — a peer vote, a change of opinion, rarity, time survived.
2. **Every handset can be shown something different.** The relay already does
   `optionsByTeam`, per-player shares, and per-player bingo cards. That is one step
   from an **information gap**, which is among the highest-value techniques in ESL
   methodology and the most awkward to run on paper.

Three axes, in rough order of cost:

**Axis 1 — new skins.** A skin is geometry plus what a question is worth, so every
existing round works in one the day it is registered. Candidates: an **Only Connect
wall** (the grouping round already *is* the wall), **territory conquest** on a 2D grid,
an **escape room** (a chain of locks — a narrative spine for a revision hour rather
than twenty disconnected questions), a **track/board race** where luck flattens the gap
between strong and weak teams, and **Pointless**, where the class votes and the
*rarest* correct answer wins. Pointless is worth singling out: it rewards depth and
obscurity rather than speed and confidence, which is a different student from the one
every current format rewards, and it is only possible because of the phones.

**Axis 2 — new rounds**, which work in every skin present and future: an **auction**
(bid before seeing the question), **call my bluff** (teams write fake definitions, the
class votes — student-generated content), **error hunt** (tap the wrong words in a
paragraph), a **continuum** (place an opinion on a scale — a discussion starter rather
than a question), **prediction** (guess before a reading, scored after), and
**justify it**, an open answer peer-rated by the room.

**Justify it is structurally important**: it would be the first round the board cannot
judge, where the *room* judges instead. Everything in Axis 3 depends on the round
contract surviving that.

**Axis 3 — formats that are not games shows at all.**

| Format | What the handsets do | Why it is worth building |
|---|---|---|
| **Just a Minute** | the class **buzzes to challenge** hesitation, repetition, deviation | the buzzer inverted: not "I know it" but "I am listening critically". Real fluency practice, and it uses what is already built |
| **Information gap / negotiation** | each team's phones carry *different* facts | the classic ESL technique, miserable on paper, trivial here. The largest single win available |
| **Secret roles** | a private instruction per handset | produces accusation, defence and hedging — precisely C1 register work |
| **Debate with a measured swing** | vote a position, argue, **re-vote** | the score is how many minds changed, making persuasion competitive without being right/wrong |
| **Card decks and drilling** | a private "did you know it?" self-report | not a game — a live diagnostic of what is actually shaky. Possibly the highest teaching value here |
| **Describe and guess** | the word goes to **one** phone; everyone else types | already flagged in §4.4 as the highest language value and least code of the Race variations; it generalises |

**Four of those six need one thing: state that outlives a question.** That is F3.8.8,
which is why it moved up the build order. It converts roughly half of this section from
"not possible" to "an afternoon's work".

**The test worth running:** if **Just a Minute** works in this container — a format
with no questions in it at all — then "Game Hub" is the wrong name for what has been
built, and §1.2's description of the product needs rewriting rather than extending.

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
- **Winning the round — as built.** The engine now detects a completed line itself
  rather than leaving the teacher to spot it, lights the route up, and raises a
  banner naming the winner. Decisions taken:
  - **An edge is the board's extreme, not the end of a row.** The short rows are
    inset by half a hexagon, so counting their end hexes as edges would let yellow
    "win" with a line floating in the middle of the board touching neither side.
    Restricting yellow's entry and exit to the long rows also restores the real
    game's asymmetry: yellow needs 5 hexes, blue 4.
  - **A blocked board is a real ending.** When neither team can reach its far side
    even using every unclaimed hex, the round is called there. Mostly this catches
    a board short of clues, where no route was ever possible — better said at once
    than discovered after eighteen questions.
  - **The round ends on a win.** Remaining hexes stop taking clicks; *New board*
    reshuffles the same sections, *Leave it up* dismisses the banner and leaves the
    route on screen to talk through. Scores carry over either way, consistent with
    the shared team bar.
  - **A banner, not a full-screen modal**, because the point of the moment is the
    route lit up behind it. On a shallow screen the board scales down to stay clear
    of it — it is the only board of the four not already sized to fit.

**Connecting wall**
- 16 tiles, four hidden groups of four
- Students identify groups; teacher confirms
- Solved groups lock and are colour-coded
- Content fields: `groupLabel`, `items[4]`, `explanation`
- Authoring note: groups should share a real linguistic property — collocation,
  register, word class — not merely topic. At least one group should be a plausible
  trap for another.

**Race to the Board** *(kinaesthetic)* — **built**, Unit 5
- Target words displayed scattered on screen
- A gapped sentence appears; a student comes to the board and touches the matching word
- Correct taps highlight and score +1; incorrect taps flash red but are not penalised,
  and the missed sentence returns to the queue to be asked again later
- Two ways to run it, chosen on the content screen:
  - **Head-to-head (default)** — both teams send a student at once and the first to
    touch the right word scores. No clock; the game ends when the board is cleared.
    A wrong touch leaves the sentence up so the other team can steal it.
  - **Timed team rounds** — one team at a time against the header timer (60s default);
    the round ends when the clock runs out and the board passes to the next team.
- Words are spread across the whole field rather than a centred block, and the board
  **re-scatters after every claim**, so position can't be memorised. The top strip is
  reserved for the sentence, which also keeps every word within reach of a student
  standing at a wall-mounted projection
- Content fields: `section`, `prompt` (with `___` marking the gap), `answer`
- **Distractors are not authored.** The board *is* the distractor set: every word on
  screen is a real target word from the selected sections, which guarantees the
  plausibility §3.2 requires and removes the largest authoring cost in the format.
  See the note below on where this departs from §3.2.
- Authoring note: write the prompt as a **gapped sentence**, not a definition, so the
  item tests collocation and word form in context. This is deliberately a different
  angle from Jeopardy's Q&A and Blockbusters' definitions, which preserves §3.2's
  varied-retrieval argument even though the target language overlaps.

*Projector note.* A projected screen is not a touchscreen. The student touches the
projected word; the **teacher clicks that word on the laptop** to register it. The
engine therefore cannot know *who* touched first. Timed rounds sidestep this — it always
knows whose round it is — while head-to-head asks the teacher for that one bit: click the
word, then click the team or press its number key (`1`–`9`).

*Rejected: the split board.* Giving each team its own copy of the word field on its own
half of the screen would encode the team in the click position and remove the extra
input. It was rejected because halving the width drops the words below the legibility
floor in F5.1, and it changes the activity from a race for the same word into two
parallel hunts.

*Departure from §3.2.* §3.2 assumed this format needed authored distractors and listed
it as a reason to reject a shared bank. Deriving the distractors from the sibling
answers removes that cost without sharing items between games: the race bank is still
its own content set, authored in its own shape. The rest of §3.2 stands.

**Who Wants to Be a Millionaire — teams variation** — **built**, Unit 5

*As built, and where it departs from the design below.*

- **Parallel ladders, interleaved turns.** This settles §9.5. Each team climbs its
  own eight rungs and the turn passes after every question, so each team gets a
  full arc without anyone sitting out for eight questions in a row — which is what
  a one-team-at-a-time run would cost in a 20–40 minute slot.
- **Additive scoring, so no safe havens.** The design below wanted safe havens so a
  late mistake could not wipe a team out. Never taking points away solves that more
  simply: a correct answer banks the rung's value, a wrong one costs only the turn,
  and the team tries that rung again with a different question next time round. It
  also keeps this game consistent with the shared team bar that every other game
  feeds.
- **Ladder:** 100, 200, 300, 500, 800, 1200, 1600, 2000 — the same order of
  magnitude as a Jeopardy board, so mixing games in one lesson doesn't distort the
  scores.
- **Lifelines** are one use each per team, and switchable off entirely.
  **Ask the Class** is a show of hands the teacher tallies on screen by tapping the
  options — the phone layer (§4.4c) does not do voting yet, and this works with no
  devices at all. **Confer** simply runs the header timer.
- Content minimum is met at **12 questions per section**, every section covering all
  eight rungs, so a single section fills a ladder (§3.4) and repeat plays differ.

*Original design:*
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

### 4.4a Content integrity — enforced, not assumed

§3.1 requires per-game content and §3.2 argues the case; neither was checked, and
both had quietly drifted. Two audits found:

- **21 prompts copy-pasted across 2–4 banks**, nearly all word transformations added
  during the question-form work. Sharing an *answer* between games is the design
  working — a student meets `custody` as a Blockbusters definition, a Race gap and a
  Millionaire discrimination. Sharing a *prompt* is precisely what §3.2 rejects.
- **The unit's own Grammar Focus pages were nearly absent.** 5A relative clauses had
  three items that genuinely tested a relative pronoun, all in one Jeopardy category.

| ID | Requirement | Priority |
|---|---|---|
| F4a.1 | No prompt appears in more than one game's bank | Must |
| F4a.2 | A Blockbusters answer is one word and its hexagon shows that word's initial | Must |
| F4a.3 | Race answers are single words, unique within the bank (they become tiles) | Must |
| F4a.4 | Every Millionaire section covers all eight rungs, three distractors each | Must |
| F4a.5 | Jeopardy categories are equal length and grouped by section | Must |
| F4a.6 | Section labels on the content screen match what the banks hold | Should |
| F4a.7 | Both Grammar Focus pages are covered by at least two games | Should |

Enforced by `testContentIntegrity` in `tools/smoke-test.js`, which runs over every
unit loaded, so a new unit is checked without writing a new test. It found eight
defects in Unit 4 on the day it was written, including a hexagon showing `U` whose
answer was *Irresistible*.

**Which game suits which grammar point** is a real authoring decision, not a
formality. Relative pronouns make ideal Race tiles — one word each, none repeating,
so all nine sit on the board and choosing between them is a genuine discrimination.
Millionaire suits them because Grammar Focus 5A exercise b is *already* written as a
four-way choice, so the book's own distractors transfer intact. Blockbusters is the
wrong home for them: single-word answers keyed by an initial make **W** ambiguous
across who/whom/whose/where/when/why, so the letter hinders instead of helping.

### 4.4b Settings — built

Features are switchable rather than fixed, so a teacher can turn off anything that
doesn't suit the class or the room. The panel (⚙ in the header) is generated from a
registry: a feature declares its own switch when it registers, so the panel never has
to be edited by hand and no feature can ship without one.

| ID | Requirement | Priority |
|---|---|---|
| F4b.1 | Every optional behaviour is toggleable from one panel | Must |
| F4b.2 | The panel is built from registered features, not hand-written markup | Must |
| F4b.3 | Choices are remembered between lessons on the same machine | Should |
| F4b.4 | A single reset restores every default | Should |

*Departure from §1.3.* "No data persistence" was listed out of scope, meaning scores,
saved boards and history — that still holds. Teacher **preferences** are persisted to
`localStorage`, because a setting that has to be re-chosen every lesson is worse than
no setting. Nothing about a game in progress is saved, and where a browser blocks
storage the app degrades to session-only and says so in the panel.

### 4.4d Game show mode — built for all four games, untrialled

An alternative **skin**, chosen per game in that game's settings tab: `dcu` (the
default, unchanged) or `gameshow`. Dark stage, chase lights, a title sequence,
think music, and lighting that tightens as the stakes rise.

| ID | Requirement | Priority |
|---|---|---|
| F4d.1 | Game show is the default; the school-colours look stays available and unaltered | Must |
| F4d.2 | The skin applies to the whole app while playing, and is removed on leaving | Must |
| F4d.3 | The title sequence is skippable by any key or click, and capped at ~4s | Must |
| F4d.4 | Nothing flashes faster than 3Hz; no full-screen white strobe | Must |
| F4d.5 | Everything is disabled under `prefers-reduced-motion` | Must |
| F4d.6 | Audio remains synthesised — no files, so offline still holds | Must |
| F4d.7 | The intro can be set to once per session, every round, or never | Should |

Decisions taken:

- **The skin is app-wide but chosen per game**, and it covers the setup screens as
  well as the boards: a lit board reached through a white unit-picker loses the moment
  before it starts. Before a game is chosen there is no per-game value to read, so the
  master setting applies.
- **Game show became the default** once all four idents existed. This is a classroom
  presentation tool; the lit look is what makes a class sit up, so it should not be
  something a teacher has to go and find. DCU remains one switch away.
- **One number drives the atmosphere.** The rung a team is playing for becomes
  `--tension` (0–1) on the stage; CSS closes the spotlight and warms the wash, and
  the music bed takes its tempo and filter from the same value. The ladder was
  already the game's tension curve — this just plugs the lights into it.
- **The bed stops the moment a question is answered**, so it never plays under the
  teacher reading out a result.
- **Flashing is a safety constraint, not a taste one.** This is projected at a room
  of students whose medical histories the teacher does not have, so flashes are slow
  colour washes rather than strobes, and reduced motion removes them entirely.
- **Music is original.** Everything is synthesised from oscillators, so the cues are
  written in the spirit of a quiz show rather than reproduced from one.

- **Each game gets its own signature.** One sparkle applied to four games reads as
  one skin; four idents read as four shows. Millionaire is a closing spotlight and
  chase lights in gold; Jeopardy is a blue starfield with a board that deals itself
  in on the diagonal; Blockbusters is a violet honeycomb that assembles itself —
  violet because yellow and blue are *game state* on that board and both have to
  stay legible against the stage; Race is a floodlit green track with lane markings,
  the words flying in and a starting pistol on every sentence. They share the
  machinery, not the look.
- **`--tension` is one contract fed from three different places**, which is what
  keeps this from being a reskin. Millionaire takes it from the rung. Jeopardy takes
  it from what's at stake on the tile in play, over a floor that rises as the board
  empties — so a $500 late in a game is the hottest the board ever gets, which is
  what the show's lighting actually does. Blockbusters takes it from **how close
  anybody is to a finished line**: cheapest route to a win, where your own hexes are
  free, an unclaimed one costs the question you'd have to answer for it, and the
  other team's are walls. One hex from a line is full tension, and the board says so
  before the class has worked it out. Race is the only one with two ingredients —
  how much of the board is gone, and whether a race is live this second, because a
  sentence going up is the moment students leave their chairs. A fifth game needs a
  new source, not new plumbing.

Also closed here: **a cleared Jeopardy board now ends the game** with a winner banner
(`jFinish` → the shared `showResult`), handling a tie. That was §9's open "nothing
happens when the board is cleared" and is independent of the theme — the game-show
skin only adds the fanfare and applause on top.

Open: whether the bed competes with the teacher's voice on classroom speakers, and
whether the title sequence is still welcome by the fourth round of a lesson. Both
need a real class. Extending the skin to another game is a `games` entry, an `INTROS`
entry and a block of stage CSS — no engine change.

### 4.4c Phone buzzers — first draft, not yet trialled

§1.3 put "student devices" out of scope for the MVP, and for the demo that still
holds: the teacher drives everything and the games are complete without phones.
This is an **optional layer** built on top, because the "who got there first?"
problem in Race to the Board head-to-head has no good answer from one screen —
the engine can't see who touched the projected image, so the teacher has been
supplying that fact by hand.

| ID | Requirement | Priority |
|---|---|---|
| F4c.1 | Students join with a room code, no account and no install | Must |
| F4c.2 | The first buzz wins, judged at one place rather than on phone clocks | Must |
| F4c.3 | A buzz identifies the team, so a correct answer scores without the teacher deciding | Must |
| F4c.4 | With buzzers off, unreachable, or no network, every game behaves exactly as before | Must |
| F4c.5 | A wrong answer re-opens the buzzers so the other team can steal | Should |
| F4c.6 | The room survives a teacher page reload | Should |

**Architecture.** Phones cannot reach the teacher's laptop directly: school and
guest WiFi normally run client isolation. Both ends therefore connect *outbound*
to a relay, which is how Kahoot works and why Kahoot works in this building. The
relay is `tools/buzzer-relay.js` — no dependencies, no database, no accounts,
rooms held in memory only.

**Consequence for hosting.** A page served over https from GitHub Pages may not
talk to a plain-http relay on the local network. So for a buzzer lesson the relay
serves the site as well, and the hub is opened from the relay rather than from
Pages. Deploying the relay to an https host removes that restriction. Full
runbook in `docs/buzzers.md`.

**Cost.** This is the one part of the product that cannot work offline, which is
why it is strictly additive: it is switched off by default, and every failure mode
falls back to the existing manual flow rather than to a broken screen.

**Open.** No classroom run yet. Whether phones are pedagogically worth it — and
whether they are a behaviour problem in an ESL class — is unresolved, as is the
strategic question in §9: answer-selection on phones would put this in the same
category as Kahoot, where the coursebook-specific content is the only advantage.

### 4.5 Display

| ID | Requirement | Priority |
|---|---|---|
| F5.1 | Layout is legible at 1280×720 and above | Must |
| F5.2 | Layout adapts to window size without breaking | Must |
| F5.5 | A game board is fully visible without scrolling, at any window size and any content selection — a teacher cannot scroll the projected image mid-game | Must |
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
- **Accessibility**: partially addressed, not audited. Team colours moved from
  gold/silver to the DCU yellow/blue pairing, which is colour-blind-safer, and the
  game-show skin holds a hard rule that nothing flashes faster than ~1.5Hz, no flash is
  full-screen white, and every animation is disabled under `prefers-reduced-motion` —
  this is projected at students whose medical histories the teacher does not have.
  **Still missing:** keyboard navigation and screen-reader support, and no audit by
  anyone qualified to do one.
- **Copyright position** if the tool is ever shared beyond the school
- **Student-device mode** for individual or pair practice outside class

---

## 9. Open questions

Four of the original eight are now settled by having built the thing. They are kept
here with their answers rather than deleted, because the reasoning is the useful part.

### Answered

1. **What is the realistic authoring time per unit?** — **Answered: ~250–270 items for
   a four-game unit.** Unit 5 is 263 across 5A–5C (breakdown in §3.4). The v0.1
   estimate of 236 for *five* games was slightly optimistic per game but right in
   shape. Millionaire is the most expensive format at 36 questions per unit, because
   each needs three plausible distractors; Race is the cheapest, because it authors no
   distractors at all.
2. **How many games can the MVP sustain?** — **Answered: four.** The lower bound in
   v0.1 turned out to be close to right. A fifth is affordable in engineering terms
   (§3.7 makes it cheap) but not in authoring terms until 5D and Unit 4's missing banks
   are done. Content, not code, is the constraint.
3. **Which games best suit Unit 5's content?** — **Answered, and the concern was
   justified.** Blockbusters does fight some of the content: its single-word answers
   keyed by an initial letter make relative pronouns unusable (**W** is ambiguous
   across who/whom/whose/where/when/why), so Unit 5's 5A grammar is carried by
   Jeopardy, Race and Millionaire instead. Race turned out to be the *best* home for
   relative pronouns — one word each, none repeating, so all nine sit on the board at
   once and choosing between them is a real discrimination.
5. **Millionaire: parallel ladders or one shared ladder?** — **Answered: parallel,
   with interleaved turns** (§4.4). Parallel gives every team a full arc; interleaving
   the turns means nobody sits out for eight questions. Safe havens were dropped in
   favour of never deducting points, which solves the same problem more simply.

### Still open

4. **Should Bullseye penalise wrong answers at higher tiers?** Moot until Bullseye is
   built, which is now unlikely for the demo (see Q2).
6. **Should any Tier 3 game be built for the demonstration?** Unchanged. The connecting
   wall still has the highest pedagogical value and the weakest generalisation
   guarantee. §3.7 has lowered the *engineering* cost of adding it; the authoring cost
   and the generalisation argument are untouched.
7. **Should section selection allow finer granularity than 5A–5D** — individual
   exercises, say — if a lesson covers only part of a section? Unchanged.
8. **Should Jeopardy scale its board down for one section, or state a minimum?**
   — **Partly answered in practice:** it states a minimum of 3 categories and the board
   sizes itself to whatever is chosen, so both halves happen. Whether 3 is the right
   floor is untested with a class.

### New since v0.1

9. **Does the atmosphere help or hinder?** Game show mode is now the default (§4.4d)
   and has never been in front of a class. Three specific unknowns: whether the music
   bed competes with the teacher's voice on classroom speakers; whether the title
   sequence is still welcome by the fourth round of a lesson (the once-per-session
   default is a guess, not evidence); and whether the lights lift a class's energy or
   tip it over. All three need one real lesson, not more building.
10. **Are phone buzzers a net gain?** (§4.4c) Never run with real handsets. Unknowns:
    latency, whether school WiFi permits it, and whether phones in hands are a
    behaviour cost that outweighs the fairness gain.
11. **Should the games live in their own files?** (F3.7.5) The registry contract makes
    it possible; the four built-ins still share one closure. Worth doing when a fifth
    game arrives, not before — the move is mechanical and the current arrangement is
    not costing anything yet.
12. **What is the second unit's authoring cost, now that the formats are settled?**
    Unit 5 was authored while the games were still changing shape. Unit 4's missing
    Race and Millionaire banks would give a clean measurement of steady-state cost,
    which is the number that actually projects across a coursebook.

### New since v0.2

13. **Does a round survive a skin it was not designed for?** Three rounds exist and all
    three play in Jeopardy, which is the host whose contract they were shaped against.
    Nothing is known about how they read on a hexagon or a ladder until Millionaire and
    Blockbusters host one (§3.8 build order, steps 1–2). Multiple choice is the least
    interesting case and therefore the right first one.
14. **Is a card-only round in Bingo worth having, or merely possible?** A grouping clue
    inside Bingo would be played by the teacher clicking, because the handsets already
    hold cards. That is coherent, but a round whose whole point is thirty students
    assembling an answer may lose its reason for existing when the phones are busy.
    A design question, not an engineering one.
15. **How is content filed once it serves several rounds?** §3.8 argues for filing by
    topic with items declaring which rounds they serve. Untested. The specific unknown
    is how many real items turn out to be shareable rather than bespoke — if most
    C1 content is bespoke, the filing change buys much less than §3.2's replacement
    would suggest. **Author ~20 items by hand before writing any consuming code.**
16. **Does the question bench change how content gets authored in practice?** It can
    now load, edit and export a category, and every question is drawn on the real card
    and pushed to real handsets before it is saved. Whether that actually shortens
    authoring, or simply makes it more pleasant, is unmeasured — and authoring time per
    unit is the number §1.4.3 rests on.
17. **What does a round cost to build, now that three exist?** Grouping cost ~330 lines
    and real engine work. Ordering cost one file and no engine change. Multiple choice
    cost one file and a `<script>` line. The trend is the argument for the registry,
    but three points is not a trend — the fourth round is the one that tests it.
