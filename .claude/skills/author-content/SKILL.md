---
name: author-content
description: Write questions for the Engishism Game Hub — a new unit from coursebook pages, or more questions for a unit that already exists. Use this whenever the user supplies book pages, scans or photos and asks for content, wants a new unit added, wants more questions in a game, or asks for questions of a particular type. Also use it when checking content somebody else authored before it reaches a class.
covers:
  - "game-hub/content/*.js"
---

# Authoring content

Writing questions, not code. The machinery is finished; content is the bottleneck.

**The one rule this skill exists to enforce: every question must be one of the
shapes the code already knows.** Not a new shape, not a variation, not "close
enough". A question written in a shape nothing recognises draws as plain text with
no error anywhere — it looks like a bug in the game, and it will be reported as
one. The phones behave identically for every question of a given type precisely
because the type is a declared thing rather than a way of wording a prompt.

## 1. Ask the code what shapes exist. Do not guess, and do not trust this file.

```bash
node tools/question-types.js
```

It prints every round and every question form, with the exact item shape and the
per-game rules, read from the registries. **This skill deliberately contains no
list of question types.** A list typed here would go stale the day somebody adds a
round, and that is the single defect this project has paid for most often — a
hand-kept list nobody remembers to update, failing silently.

If the tool disagrees with anything below, the tool is right.

## 2. Know which of the two tiers you are writing for

The tool prints them separately and the difference is not cosmetic.

**A round is a question the class plays.** The card draws it, every handset is put
into it, several students' taps merge into one team answer, and it judges itself.
Connections, Word Thermometer, Multiple Choice, Drag the Letters, Drag the Words.

**A form is a way a question is drawn.** Render and reveal, nothing else — no
phones, no judging, the teacher marks it. A gap fill is a form.

Reach for a round when the question is worth the room's attention for a minute.
Reach for a form for the many short questions that carry a lesson's vocabulary.
**A unit of only rounds would be exhausting and a unit of only forms wastes the
phones.** Roughly a quarter rounds is what the most recent unit did.

## 3. Read the source before writing anything

The claim the whole project rests on is that the games test **the unit's actual
target language, not generic English** (§1.4.2). Content written from general
knowledge about the topic looks entirely plausible and breaks that claim silently.

So: read the supplied pages. Take the vocabulary the book teaches, in the book's
own groupings, and cover **every part of the lesson** — the vocabulary set, the
grammar focus, the pronunciation point and the functional language. An audit of
Unit 5 found the grammar pages nearly missed because the vocabulary is the obvious
thing and no format reminds you.

## 4. Where it goes

One file per unit: `game-hub/content/<unit>.js`, ending in `window.UNITS.push({…})`.
Copy the structure from `game-hub/content/nef-1.js`, which is the most recent and
was written with rounds included from the start.

Inside a unit, content is filed **per game** — `jeopardyCategories`,
`blockbustersBank`, `raceBank`, `millionaireBank`. That is deliberate (§3.2): the
formats need incompatible shapes, and a student meeting the same language from four
angles is better retrieval practice than meeting one question in four wrappers.
There is no shared pool, and adding one is not this skill's job.

A new unit also needs a `<script>` line in `game-hub.html` **and** in
`playground/question-bench.html`, or the bench cannot open the categories to
check them.

## 5. What each game will not forgive

The tool prints these; they are here because getting one wrong wastes a whole run.

- **Jeopardy** — every category needs **exactly five** clues at 100–500. A category
  short of one is not a narrower column, it is a crash. Categories stay grouped by
  section in array order or the section heading prints twice. **A column may carry a
  human `name` AND mix round types** — a clue's round is resolved from its own field
  when it opens, so `{name:'Have / Get Something Done', clues:[…choice…, …group…,
  …anagram…, …order…, …scramble…]}` is a valid column. Prefer naming a column by its
  **language point** and mixing rounds rising in difficulty ($100 easiest) over five
  clues of one round type; where a point has no scale, substitute a form (an
  error-fix teaches the causative or an inversion well). `ef2a-the-scam` in
  `content/ef-2a.js` is the precedent.
- **Blockbusters** — an ordinary answer is **one word beginning with its letter**.
  A round hexagon still carries a letter (it is how a team says which square they
  are attacking) and carries **no** answer, because a grouping set has four.
- **Race** — answers become tiles, so single words, none repeating.
- **Millionaire** — three distractors each, levels 1–8, **at least two questions at
  every level in every section**, or two teams meet the identical question climbing.
  Its bank becomes Multiple Choice rounds automatically; do not author `choice:`.
- **All of them** — no prompt may appear in two banks. Same *answer* in two games is
  the design working; same *prompt* is what per-game authoring exists to avoid.
  And the counts printed in section labels must match the banks.

## 6. The rules no check can make for you

The content gate catches form, never quality. These are yours:

- **A Connections decoy set must be a coherent group of its own.** Four cooking
  verbs against four random words is a spotting exercise. Four cooking verbs against
  four *preparation* verbs is a discrimination, which is the lesson.
- **An ordering scale must have one defensible order.** If two steps are arguable,
  the round marks a reasonable answer wrong and the class is right to be annoyed.
- **Gloss every ordering step.** It prints as the word lands, and it is what turns a
  right answer into a taught one.
- **Check the multiple choice answer key by hand.** A mistyped answer produces a
  question that is impossible to get right and reads perfectly normally. This is the
  one defect a proofreader cannot see.
- **Vary the question type.** An audit found 71% of Unit 5 was gap fills, because gap
  fills are the easiest thing to write. Set the target on the language point, not on
  the shape.
- **Every clue states its own context — a teacher who has not read the unit still
  plays it.** A Drag the Letters clue is a *gapped, cued sentence*, never a bare
  gloss: not `"the moment everything changed for her"` (who? what article?) but
  `"'It was only when she released her album that she had her ___.' The moment
  everything changed. (12 letters)"`. Grammar-led prompts name the pattern ("Complete
  with the causative…", "Correct the inversion…"). No "her" or "the article" without
  saying who or what. This is the difference between content that reads as a lesson to
  a manager or a supply teacher and content only its author can run.

## 7. Check it, then look at it

```bash
node tools/check-syntax.js
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=content
```

The content check takes ~20 seconds and catches what eyes cannot: a duplicated
prompt, a letter that does not match its answer, a rung with no question behind it,
a section label whose count has drifted. It runs every round's own `check()`, so a
round added next month audits its content for free.

Then **bump the cache stamp** — content lives under `game-hub/content/`, so a change
needs one. The command (and why the date shape is load-bearing) is in `ship-it`.

Finally, say what cannot be checked: **nobody has looked at the questions.** Point
the user at the question bench, which draws a real card at board size with real
handsets beside it — `playground/question-bench.html`, load the category. Whether
eight words read from the back of a room is a judgement, not an assertion.

## Do not

- Invent a question shape. If the question you want does not fit anything the tool
  printed, that is a request for a **new round** (`.claude/skills/new-round`), which
  is a code change and a separate job.
- Hand-label which games an item suits. Which round an item wants is derived from
  its own fields, and which game can host it is derived from that.
- Author `choice:` into a Millionaire bank — the game builds the round from
  `{answer, distractors}` when the rung opens.
- Add coursebook scans to `material/`. The repo is public, and §7 of the spec draws
  the line at original questions rather than reproductions.
