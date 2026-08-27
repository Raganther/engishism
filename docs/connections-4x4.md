# True 4×4 Connections — a design for the physics grid where a row IS a group

**Status: design only. Not built.** Written the night Drag the Words got its `flick`
mode, when the question "can Connections get physics too?" turned out to have a longer
answer than yes.

## Why this exists

The hub already has a round called **Connections** (`grouping`), and it is *not* the game
its name evokes. It is **single-group**: "four of these belong together — find the four,"
with the rest as decoys (`group:{ pick:[…], with:[…] }`). One answer set, judged as a
plain unordered set. That round is good and stays.

What people mean by Connections — the NYT puzzle — is **16 words that split into four
hidden groups of four**. That is a different, harder lesson: not "spot the four that
match a category I already told you," but "discover the four categories at once, when
every word looks like it could belong to two of them." The overlap traps are the whole
point, and single-group content cannot express them.

It is also the one round where **matter.js physics would carry real meaning** rather than
decorate a tap. The rule this project holds (see the thermometer's `stack`, the anagram's
`flick`): physics earns its place only when the spatial thing the simulation exposes *is*
the answer. For a 4×4 grid, **which row a tile is in is which group it belongs to** —
row = group. Flicking a tile into a row is the act of claiming its category, the same way
dragging a word up the thermometer *is* ranking it. That is why this is worth building and
`choice` (a 1-of-4 pick with no spatial dimension) was not.

## What it is NOT

- Not a mode of `grouping`. The content model differs (four groups vs one), so bolting it
  onto `grouping` would fork every hook on `s.mode` and leave two content shapes fighting
  over one `claims()`. It is a **new round** (`connections`), leaving `grouping` intact.
  The two are siblings the way `anagram` and `scramble` are: shared helpers, separate
  files, separate content fields.
- Not a physics-only round. Like every physics round, it has a tap face (phones with no
  table, or a class with no phones) and a physics face, chosen by mode. Degradation is
  non-negotiable — a no-relay class must be able to play it teacher-judged on the card.

## Content model

A new item field, `connections`, carrying four labelled groups of four:

```js
{ text: "Find the four groups of four.",
  connections: {
    groups: [
      { label: "Ways of cooking",  words: ["grilled","steamed","roasted","fried"] },
      { label: "…done to vegetables", words: ["chopped","sliced","peeled","grated"] },
      { label: "Court roles",      words: ["judge","jury","witness","clerk"] },
      { label: "…verdicts",        words: ["guilty","acquitted","cleared","convicted"] }
    ]
  } }
```

Contrast today's `grouping`: `group:{ pick, with }` — one answer set plus decoys. Here
there are no decoys; **every word belongs to exactly one group**, and the difficulty is
the overlap between plausible groupings, not distractors.

`label` is what the group reveals *as* when solved (the teaching payoff — naming the
category is half the lesson). It is authored, not derived.

**Authoring constraints (`check` must enforce):**
- Exactly 4 groups of exactly 4 → 16 words. (A 3×3 or 5×5 variant is a later question;
  start fixed at 4×4, the shape the whole world knows.)
- All 16 words distinct (a word in two groups makes the union ambiguous — the same rule
  `grouping.check` already enforces across pick+with).
- 16 ≤ the relay's 20-option cap, so it arms whole. Good.
- The prompt must not name a group (gives away a category).
- **The overlap trap is the craft, and no check can catch it.** The doc for authors: at
  least one word in each group should *look* like it could join another group. That is
  what makes it Connections rather than four easy sorts. A person reads `material/` for it.

## Judging

Per-group **set membership**, order-insensitive within a group — the same primitive
`grouping.judge` already uses, run four times:

- A team's answer is an assignment of (some of the) 16 words to four rows/groups.
- A **group is solved** when a row holds exactly the 4 words of one authored group (any
  order). On solve, that group locks and reveals its `label`.
- The **round is solved** when all four groups are solved.
- **"One away"** (the NYT affordance — a guess of four that has exactly three from one
  group) is a *design choice to flag, not decide here*. It is a strong teaching signal
  ("you're close, one of these four is wrong") but it also makes the puzzle much easier
  and changes the pace. Recommend building it behind a setting (`connOneAway`, default
  on), so a class can try both. It is not needed for v1.

Note what judging does **not** read: the column a tile sits in, or the order of tiles
within a row. Only "which four words share a row." This is what lets the physics face
ignore intra-row position entirely (below).

## The three tiers

**Tap face (phones, or no phones).** Reuse `grouping`'s proven machinery almost whole:
- Each phone is a multi-pick vote; a team's answer is the **union** of its players' picks
  (`Kit.round.arrangement` is for *sequences*; grouping's plain union in `read` is the
  right primitive here — a group is a set). Extend union-per-group: a phone assigns picks
  to a group slot, four unions per team instead of one.
- `arm`'s `multiByTeam: Kit.round.shares(need, sizes)` already splits a pick budget across
  a team's handsets. For 16 words / N phones that is the same split, now over four groups.
- No phones → the teacher taps the 16 words on the card into four groups, teacher-judged
  (grouping's `chosen`/`onPick` path, widened to four buckets).

**Physics face (a mode, `mode:'grid'` or `'sort'`).** A `Kit.table` **4-row bar grid**:
`slots({ cols:4, rows:4, bar:true, labels:[…] })`. Each phone (or the board with no
phones) flicks each of its tiles into the row for the group it believes it belongs to.
- **Row = group. Column within a row is irrelevant** (judge ignores it), so a student
  drops a tile anywhere in the right row.
- The 16 tiles start as a loose pile (the shelf's pile band); the grid fills as they land.
- Reveal: a solved row locks flat and shows its `label` (the physics stops for that row).
- This is the fourth `Kit.table` caller with a board face — see extraction below.

**Board card + lanes.** The card shows the 4×4 grid forming (physics) or the four group
buckets filling (tap). Team lanes via `Kit.round.lanes` — one lane per team, four cells
of "groups solved," the same standard every played round draws. A solved group shows its
label; an open one shows a count.

## Prerequisite: extract the board-face card table

The board-face physics wiring — create `<canvas class="toss-canvas">`, `K.table({onArrange})`,
`slots(...)` before `setPieces`, pointer events through `table.pt`, a self-stopping rAF
loop, a `window.__x` test handle, and the reuse-live-table / teardown-on-reveal guards —
is now **copied verbatim in three rounds** (anagram flick, ordering stack, scramble flick).
CLAUDE.md's deferred-extraction trigger ("a third physics-card round") is already met.

This grid would be the **fourth** copy, and its `onArrange` is the most complex yet
(four independent row-judges). **Do the extraction first**, as its own focused change with
the round suite: a `Kit.round.cardTable(mount, s, { slots, labels, pieces, judge, upright })`
helper that owns the boilerplate and takes the per-round differences (slot shape, the
verdict function, the reveal teardown) as parameters. Rewire anagram/ordering/scramble onto
it in the same change (two are shipped — this is why it wants the suite, not an overnight
run). Then this round is built on the helper from line one, not as a fifth copy.

## Build order (when this is picked up)

1. **Extract `Kit.round.cardTable`**, rewire the three existing physics rounds, prove
   behaviour-neutral with their probes + the round suite. (Its own commit.)
2. **New round `connections`**: content field + `check`, tap face (union-per-group,
   reusing grouping's helpers), board card + lanes.
3. **Physics `grid` mode** on `Kit.round.cardTable`: the 4-row bar grid, row-as-group.
4. **Content**: author one 4×4 bank per unit that has the vocabulary for it, with real
   overlap traps, sourced against `material/`. This is the expensive part (hours, not
   engineering) and the one no check validates.
5. **`connOneAway` setting** (default on), if the classroom wants the near-miss signal.

## Open questions only a classroom answers

- **Does a 4×4 grid read at the back of the room?** 16 word tiles on a projector is dense;
  the thermometer's single ladder was already near the limit. May need larger type, fewer
  groups, or the tap face as the real classroom mode with physics reserved for tablets.
- **Do 16 tiles overwhelm a phone?** Battle Scrabble's 7×7 works, but that is one player's
  own grid; here 16 shared tiles plus flick physics on a 390px screen is untested.
- **Does row-as-group actually teach better than tap-to-select?** The whole reason to A/B
  it. If the physics is just a slower way to make the same four sets, it is decoration and
  the tap face wins — exactly the verdict `choice` got, and the honest possible outcome
  here too. Build it to find out, not on faith.
- **Does "one away" help or trivialise?** The setting exists so a class decides.
