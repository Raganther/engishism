---
name: new-round
description: Add a question round to the Engishism Game Hub — a question that is *played* rather than merely drawn, like Connections (find the group) or an ordering scale. Use this whenever the user wants a new question dynamic involving phones, teams assembling an answer together, or judging that happens without the teacher clicking. Also use it when carrying a playground bench game into a game show, or when a question type needs to work in more than one game.
---

# Adding a question round

A **round** is a question the room *plays*: it arms handsets, collects from several
students at once, and decides for itself when it has been answered. It lives in one
file under `game-hub/rounds/`, is authored on `playground/question-bench.html`, and
any game show can then call it by name.

## 1. First: is it a round, or a form?

Get this wrong and you will fight the wrong contract for a session.

| It is a **form** (`Kit.prompt`) if… | It is a **round** (`Kit.round`) if… |
|---|---|
| it draws a prompt and answers it in place | it arms the phones, or collects from them |
| the class watches, the teacher clicks | teams do something *simultaneously* |
| `render` / `reveal` and you are done | something has to decide when the answer settled |

Gap fill, anagram, odd one out, word bridge are forms — six of them, none with a
phone. Connections is a round. If in doubt, ask whether the question has a *moment
where it becomes answered* that no one clicked: that is a round.

## 2. What a round contains — and what it must not

```js
HubKit.round.register('ordering', {
  label: 'Word Thermometer',
  field: 'order',                 // the item field you own; hosts carry it through
  claims(item),                   // does this authored item want me?
  setup(item, ctx),               // item -> the round's own state, or null
  check(item),                    // WHY an authored item is unusable, as sentences
  render(mount, s, ctx),          // the card — the projector's view
  reveal(mount, s, ctx),          // show the answer
  arm(s, ctx),                    // what the handsets are put into
  read(replies, s, ctx),          // the room's replies -> one answer per team
  judge(answer, s, team, ctx),    // {verdict, hits, done}
  accept(answer, s, team, ctx),   // commit, when being right is not yet the end
  saidOf(who, r, s),              // how a wrong answer is described
  modes: [...],                   // the ways it can be played, if more than one
  settleMs: 700
});
```

**Everything except `setup` and `render` is optional.** A simple round draws a card
and stops.

**A round must never contain scoring, turns, timers, the board, or a tile.** Those
belong to the host. Jeopardy pays a tile and passes a turn when the round says a
team has it; the bench pays nothing at all. A round holding one of them can only
ever live in one game, which defeats the entire point.

**`ctx` is what the host lends you** — `{teams, sizes, teamName, prompt, team, mode,
forTeam, onPick, roster, verdict, again}`. It is passed in rather than reached for,
because the bench has no team bar and the hub does. `roster` is who is in the room
(`[{id, name, team}]`, read fresh like `sizes`) — the information gap deals a view
per player from it. `verdict(id, verdict, note, coolMs)` tells one phone how its
typed word was received; only `'wrong'` reopens the handset's box, so a retryable
near-miss is sent as `wrong` with a note and a short cooldown. `again()` is "re-arm
the phones and redraw me" — for a round that advances on its own clock (Word Drop's
landing) rather than on a reply; bench-only so far, so guard it and fall back to
teacher clicks. `arm()` may return null: nothing left to ask, the host disarms.

**A round's state must carry `chosen: [], picks: {}, need: 1` even if it uses none
of them** — the bench's shared plumbing (Check button, teacher pick cap) reads them
off every state and crashes on a state without them. Word Drop found this.

## 2b. The lane standard — do not draw your own team progress

Any round where an answer builds up draws the same picture on the card: **a lane
per team, present from the moment the round opens, blank cells filling in**. That
is `Kit.round.lanes(mount, ctx, {kind, progressed, lane(t)})` — it owns which
teams show (all of them, or only the scoped one), the order, the colour, the team
name, the agree chip and the count; your `lane(t)` returns only
`{cells:[{text, got, cls, colour}], count, agree, full}`. Styling: the shared
`.rlanes` block in `hub-rounds.css`, plus a small `.rlanes-<kind>` modifier if
your empty cell needs a different look. Four rounds hand-wrote this before it was
a shelf and every rule change was a four-file edit — do not start a fifth copy.

Two companions:
- `Kit.round.mustHold(mode, ctx, t)` — how many members must hold a thing for it
  to light: any member in a race, the whole team in agree, and a missing roster
  count falls back to "any" rather than freezing the lane.
- `Kit.round.arrangement(replies, {need, clean, wordAt, legal, sizes, mode})` —
  the reader for any round whose reply is a *sequence* (drag rounds). Positional
  — gaps stay gaps, compacting slid words into boxes nobody filled — with
  per-position counts for the lanes and full-sequence tallies for agree mode.
  For single-pick replies use `Kit.round.poll` as ever.

**Declare an `editor` and the workshop builds itself.** `{labelA, labelB,
build(text, a, b, prev), read(item)}` on your round, beside `sample` — the bench
asks the registry, and the starting values are `read(sample)`, so the sample
lives once. `labelB:null` gives two fields instead of three. If your item holds
something the three fields cannot express (ordering's per-word glosses), carry it
forward from `prev` in `build` — a round trip that silently strips data is worse
than no round trip. Declare nothing and you still get a generic editor rather
than a blank page, wrong only in its wording.

*(This was a hand-kept table in the bench until it had caught two rounds in a
row — the symptom being a round that opens on the previous type's sample saying
"not complete yet", with nothing naming the gap.)*

**Read it fresh; never stash it.** That is why `read`, `judge` and `accept` all take it
too. Students join and drop all lesson, so `ctx.sizes` — how many handsets are on each
team — is a live fact of the host's, and a size your round was told once at `arm()` is
a lie by the third question. Stashing it would work and would be wrong in a way nothing
would catch.

## 2c. Your own buttons — declare them, don't reach for the strip

**The commit button is the host's and everything beside it is yours.** Committing
*scores* — it pays a tile, a hexagon, a rung — so a round could never own that one;
what a round owns is anything that changes its own question. Declare them:

```js
actions(state, ctx){ return [{ id:'show', label:'Show this one', disabled:state.done }]; }
press(id, state, ctx){ if(id === 'show'){ …; return true; } return false; }
```

`Kit.round.actions` puts the host's commit button at the head of the list and yours
after it; `Kit.round.strip` draws them. Returning truthy from `press` tells the host
to redraw the card and re-ask the handsets, which is what it owes you after your
question has moved under them. Style with the shared `.round-action` block in
`hub-rounds.css` — deliberately quieter than the commit button, because these change
the question and that one ends it.

Three rules:
- **Never score in `press`.** If what you want is "this answer counts", that is the
  commit button and it is the host's.
- **Declare per mode.** Ordering offers *Show this one* on a shared ladder and not in
  a race, where showing a word would give it either to one team or to all of them.
- **A button that could end the round is a scoring question**, so it is not yours.
  Ordering's disables on the last rung rather than being guarded downstream — what
  the button can do should be what the button offers.

*(Until F3.9.1/F3.9.2 a round had exactly one button, because `group-btn` is one
element and the strip was a hand-listed skeleton. That was the single thing blocking
round designs outright.)*

## 3. The card must not assume its host's background

The hub's clue card is light by default and dark under the game-show skin; the
question bench is dark always. So the palette is **custom properties with fallbacks
inside each `var()`** — never a declaration block on the round's own element, which
out-specifies anything the host set on an ancestor. That mistake looks exactly like
the host being ignored, and it is what made the first grouping card render as white
blocks on the bench.

Styles go in `game-hub/hub-rounds.css`, not `hub.css`. A playground page cannot load
`hub.css` to get the card — it carries the whole hub theme.

## 3b. Which skins can host it — contention, not answer shape

A round wants **the card** and **the phones**. A skin can host it unless it already
owns one of those. This is the whole rule; there is no list of compatible games.

| Skin | Owns the card? | Owns the phones? | Any round? |
|---|---|---|---|
| Jeopardy | no | no | **yes, built** |
| Blockbusters | no | no | **yes, built** |
| Millionaire | no | no | **yes, built** (F3.8.9 — mounted on its stage, it has no card) |
| Bingo | no | **yes** — every phone holds a card | card-only, teacher-judged |
| Race | **yes** — the scattered words *are* the board | no | needs a stage mount |

Do **not** assume a board with one-word answers can only host word-shaped rounds.
Blockbusters' hexagon letter turned out to be the hexagon's **name** — its display,
the clue topline and the picking vote — and never a constraint: the win condition
searches *claimed* hexagons and has never read it. Dropping the rule that the answer
begins with the letter cost nothing on the board and unlocked every round; the letter
is still on every hexagon, because a team has to be able to say which one they want.

**One addition is not built yet**, and a round needing it is blocked: state that
outlives one question (Bingo's card persists across many calls). Before concluding
your round needs it, check what it actually needs *per player* — the information
gap looked blocked on it and only needed a per-player **prompt**, which the arm
already carries: `promptByPlayer: {id: string}` rides the relay's per-recipient
payload, keyed by player id so a reconnect keeps its view, built from `ctx.roster`
in `arm()`. About fifteen relay lines, not a contract change.

## 3c. `check(item)` — say why, not just no

`setup` returning null says *that* something is wrong. `check` says *what*, as
sentences an author reads. **The content gate and the bench editor both call it**, so
there is one rulebook rather than two that can disagree.

The split: **the round owns what makes the question invalid; the host owns what makes
its own bank untidy.** "Needs at least two options" is yours. "Also carries an `a`
field" is Jeopardy's — `a` is that bank's word for an answer and no round should ever
learn it.

Write the message an author can act on. The multiple choice round's best line is
*"the answer is not one of the options — nobody could ever get this right"*, because
that defect is invisible to a reader.

## 4. Build it on the bench, not in a game

`playground/question-bench.html` shows the card and a rack of real handsets on one
screen. **A question dynamic cannot be judged from the phone** — what it produces
lands on the card — and two browser tabs never show cause and effect at once.

The menu asks `Kit.round.ids()`, so a round appears there the moment it is
registered. Nothing to edit.

## 5. Wiring it into a game show

The adapter is shared, and a host is now four declared facts rather than a second
copy of it. `ROUND_HOSTS` in `hub-engine.js`:

```js
blockbusters: {
  game:'blockbusters', modal:'blockbusters', stage:'play-blockbusters',
  turn: () => bbTeamOnTurn(),          // whose round it is when it is scoped
  win:  team => claimHex(team) || 1    // what taking it is worth here; returns what it paid
}
```

**Jeopardy and Blockbusters both host rounds, and a third board is an entry in that
table** — plus the two calls the board itself makes when a clue opens:
`jGroupOf(item, '<host>')` before `askPhones`, and `jGroupOpen` if it found one.

You should not need to touch a round to add a host. Blockbusters cost no change to
any of the five, which is the evidence that the tier is a shelf rather than one
game's helper — one caller was only ever a guess about an API.

**A skin's own affordances have to stand down while a round is live.** Blockbusters
scores by claiming, so its team chooser is a second way to award the same hexagon;
it is hidden until the round is over and put back on Reveal, exactly as Jeopardy's
Correct and Wrong only exist after Reveal. Whatever your board's equivalent is, a
live round owns the verdict.

Two traps the grouping round paid for:

- **Declare `field`, and the normalisation carries it for you.** This used to be a
  hand-kept whitelist in `jShowClue` and it silently dropped a feature twice —
  `reveal` when Story Reveal shipped, `order` the day ordering was written, both times
  the symptom being the feature simply never appearing with nothing saying why. The
  host asks `Kit.round.fields()` now, so **the only thing you must do is declare
  `field` on the round.** Forget it and you are back to the same silent failure.
- **"Is this a round clue" and "is the round still live" are different questions.**
  Correct/Wrong only exist *after* Reveal, so anything that runs on the wrong path —
  a steal, a deduction — must ask the first. Asking the second looks right, reads
  right, and silently lets the rules back in.

## 6. Rules a round inherits from the room

- **A wrong answer costs nothing but the time.** The other team is the pressure, and
  a class charged for a guess stops guessing.
- **Resolve the right answer before any wrong one.** Two teams can settle in the same
  tick, and arrival order puts "not a group" on screen after the other team already
  won.
- **The share is the mechanic.** `Kit.round.shares(need, sizes)` — four words across
  two phones is two each, and being over your share is a state to talk about, not an
  error to strip.
- **Degradation is not optional.** No relay must leave the round playable by the
  teacher clicking. The bench suite checks it; so should yours.

## 7. Before you push

```bash
node tools/check-syntax.js
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=qbench,grouping,card,gameshow
```

Screenshot the card on the bench *and* in the game show. The two must look like the
same question — if they do not, something is drawing it twice.
