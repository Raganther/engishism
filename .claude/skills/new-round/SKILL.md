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
  claims(item),              // does this authored item want me?
  setup(item),               // item -> the round's own state, or null
  render(mount, s, ctx),     // the card — the projector's view
  reveal(mount, s, ctx),     // show the answer
  arm(s, ctx),               // what the handsets are put into
  read(replies, s),          // the room's replies -> one answer per team
  judge(answer, s),          // {verdict:'right'|'wrong'|'incomplete', hits}
  saidOf(who, r, s),         // how a wrong answer is described
  settleMs: 700
});
```

**Everything except `setup` and `render` is optional.** A simple round draws a card
and stops.

**A round must never contain scoring, turns, timers, the board, or a tile.** Those
belong to the host. Jeopardy pays a tile and passes a turn when the round says a
team has it; the bench pays nothing at all. A round holding one of them can only
ever live in one game, which defeats the entire point.

**`ctx` is what the host lends you** — `{teams, sizes, teamName, prompt, team,
onPick}`. It is passed in rather than reached for, because the bench has no team bar
and the hub does.

## 3. The card must not assume its host's background

The hub's clue card is light by default and dark under the game-show skin; the
question bench is dark always. So the palette is **custom properties with fallbacks
inside each `var()`** — never a declaration block on the round's own element, which
out-specifies anything the host set on an ancestor. That mistake looks exactly like
the host being ignored, and it is what made the first grouping card render as white
blocks on the bench.

Styles go in `game-hub/hub-rounds.css`, not `hub.css`. A playground page cannot load
`hub.css` to get the card — it carries the whole hub theme.

## 4. Build it on the bench, not in a game

`playground/question-bench.html` shows the card and a rack of real handsets on one
screen. **A question dynamic cannot be judged from the phone** — what it produces
lands on the card — and two browser tabs never show cause and effect at once.

The menu asks `Kit.round.ids()`, so a round appears there the moment it is
registered. Nothing to edit.

## 5. Wiring it into a game show

The host writes an adapter, and it should be thin. Jeopardy's is ~160 lines and
every one of them is about *Jeopardy*: where the card is mounted, what winning is
worth, what happens to the tile. If your adapter is doing anything a second game
would also have to do, that thing belongs in the round.

Two traps the grouping round paid for:

- **Add the field to the clue normalisation first.** `jShowClue` builds
  `{text, answer, type, reveal, group}` — a whitelist. Anything an author adds to an
  item is invisible downstream until it is named there, and the symptom is your
  feature simply never appearing, with nothing anywhere saying why.
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
