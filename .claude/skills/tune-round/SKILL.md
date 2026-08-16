---
name: tune-round
description: Change how an existing round or game plays — add a parameter, a threshold, a cooldown, a switch, or make something behave differently for teams than for a room of individuals. Use this whenever the user wants to tune, adjust, tweak or experiment with a round that already exists (Connections, Word Thermometer, Multiple Choice, the drag rounds, Bingo), wants a new option in the settings panel, mentions individual vs team defaults, or asks to try a variation without building a new round. Also use it when extracting something two rounds now share onto the shelf.
covers:
  - "game-hub/rounds/*.js"
  - "game-hub/hub-rounds.js"
  - "game-hub/hub-settings.js"
  - "game-hub/hub-kit.js"
  - "playground/bench-kit.js"
---

# Tuning a round that already exists

## Are you in the right skill?

| You want | Skill |
|---|---|
| A question type that does not exist yet | `new-round` |
| A new way a prompt is *drawn* (gap fill, anagram) | `new-question-form` |
| A named bundle of switches ("play it like the show") | `new-mode` |
| A whole new board | `new-game` |
| **A parameter, threshold, cooldown or switch on something that exists** | **this one** |
| **The same round to play differently for individuals than for teams** | **this one** |

**If you are about to write `if (solo) { … } else { … }` inside a round, stop.** That
branch is a setting that has not been registered yet, and the round is the wrong tier
to hold it — see §2.

## 1. The three steps, and they are the same every time

```js
// 1. register it, next to the other round settings in hub-engine.js
S.register({ id:'groupCooldown', group:'Questions', type:'range',
             default: 3, min:0, max:15, step:1, unit:'s',
             quick: true,          // → the TUNE pill on the card + the bench tune pane
             byRoster: true,       // → teams and individuals keep separate values
             games: ROUND_GAMES,
             label:'Wait after a wrong answer',
             help:'One line a teacher can act on.' });

// 2. lend it on the ctx — one line in roundCtx()
groupCooldown: Number(S.get('groupCooldown', activeGame)) || 0,

// 3. the round reads it, and treats absent as its own sensible default
const cool = c.groupCooldown == null ? 3 : c.groupCooldown;
```

**The round never learns whether the room is teams or individuals.** It reads a number
off `ctx`; the fork happens entirely above it in the settings layer. That is what makes
`byRoster` cost one word, and it is why the question bench — which has no settings at
all — still behaves sensibly.

## 2. Four decisions, in order

**a. Which tier owns it?** The test: *who would still be correct if you swapped the tier
below out?*

| It is… | if it… | Example |
|---|---|---|
| the **round's** | changes this question — the card, the phones, the judging | how many hints, what a wrong answer says |
| the **host's** (skin) | decides what something is *worth*, or whose turn it is | value decay, the podium shares, `speed()` |
| the **container's** | is true whatever game is on screen | whether a room exists, the roster mode |

**A round may not score.** That is the one rule keeping rounds portable, so anything
about points — a stake, a decay, a penalty in points — is a **host** fact declared beside
`worth()` and `speed()`, never a field in the round. If the thing you want is "this
answer is worth less now", it does not go in the round.

**b. Should it fork by room type — `byRoster: true`?** Ask whether the right answer
genuinely differs between three teams and sixteen individuals.

- **Yes** for anything that behaves identically in both rooms but *should* not.
  `roundOpenToAll` is the worked example: with three teams the race for the tile is the
  game; with sixteen individuals the same rule locks fifteen people out of a question
  they are half way through.
- **No** for anything already scoped by a live fact. `crowdReveal` gates on room size —
  more than five competitors — so ordinary team play never meets it, and a fork would be
  storage nothing reads. **Check for an existing gate before forking.**

Individuals **follow the team-room value until set apart**, so nothing moves for anybody
until a solo room chooses. Nothing needs migrating.

**c. Should it be `quick: true`?** True if a teacher would plausibly change it *between
two questions* while judging whether it feels right. That is what puts it on the card's
TUNE pill and in the room bench's tune pane. Everything experimental should be.

**d. What does *absent* mean?** The shelf treats **absent as the default and 0/false as
off**, deliberately — that is what lets the question bench inherit sensible behaviour
with no wiring. Write `c.thing == null ? DEFAULT : c.thing`, never `c.thing || DEFAULT`,
or an explicit 0 silently becomes the default and a teacher's "off" does nothing.

## 3. Traps, each one paid for

**The stuck default.** `register()` seeds every master value into `localStorage` the
first time a device runs the app. So **changing a `default:` in code never reaches a
browser that has already run the old build** — the key is present, and the new default
is ignored forever. `roundOpenToAll` shipped `default:false` for one build and was still
off on the developer's own laptop weeks later, which read exactly like a bug in the
round. If you change a default that has already shipped, you must migrate it (`S.raw` /
`S.drop`, see `new-mode`) or tell the user to flip it once by hand.

**A phone-side setting lands on the *next* question, not this one.** Anything that
changes what the handset shows rides on the arm, and **an arm clears every handset's
picks and the relay's held replies**. So never re-arm to apply a settings change
mid-question — that throws away what thirty students were half way through typing. Board-
side and judging-side settings (a threshold, a cooldown length, a colour) do apply
immediately. Say which kind it is when you tell the user how to test it.

**`ctx` is read fresh at call time, never stashed.** Students join and drop all lesson,
so a size the round was told once is a lie by the third question. That is why `read`,
`judge` and `accept` all take `ctx`.

**A cache of somebody else's index needs a stated invalidation point.** This is the
single most expensive rule in the project — five bugs in six days, every one a copy of a
competitor index going stale, and every one fixed at the reader so the next one came
back. The reflex fix ("use ids instead") is wrong: the stable id already exists where it
matters. There are exactly **three** caches — `players` in `hub-buzzer.js`, `soloSeatAt`
and `teamSeat` in `hub-engine.js` — and `CLAUDE.md` carries the table saying what
invalidates each. **A fourth cache needs a fourth row.**

The worked example: `seat` is one-way, so the host's player list held each handset's
*join-time* team. In a solo room nobody picks a team, so several phones read as
competitor 0, `sizes` double-counted one competitor, and a share of `ceil(need/size)`
told that student two words was their lot on a four-word answer. **Fix it at the seam,
not at the reader** — there were four readers, and only one of them had been noticed.

**A gate written in one round is written in four.** `crowdMeter` is a shelf function but
`if(!s.done) K.round.crowdMeter(…)` is copied into grouping, anagram, scramble and
ordering. Changing *when* something shows is four edits with nothing complaining if you
miss one. Changing a *host setting* reaches every round for free. Know which you are
doing before you promise the user it propagates.

## 4. Extracting to the shelf — only on the second caller

**One caller is a guess about an API.** Write it inside the round first. When a second
round wants the same thing, move it to `Kit.round` **and rewire the first caller in the
same change** — that rewiring is what proves it is a shelf rather than a second copy
under a new name.

Before writing anything shared, run:

```bash
node tools/shelf.js          # every Kit.round / Kit / BenchKit helper, and what is copied 3+ times
```

It also fires automatically as a hook before any edit to `rounds/*.js`, `hub-rounds.js`,
`hub-kit.js` or `bench-kit.js`. **Read what it prints** — the expensive mistake in this
project is never a hard bug, it is writing a second copy of something that already
exists.

Two things that are shared *by construction* and are not a choice: anything on the
handset (there is one `join.html`) and anything on the wire (there is one relay).

## 5. Prove it, then ship it

**Reproduce before fixing.** Two bugs this project has chased were diagnosed by reading
and both diagnoses were wrong; the third attempt reproduced it in five minutes. If you
have guessed twice, stop reasoning and print something.

**Prove a fix by reverting it.** A check that has never failed on the bug it was written
for is not yet a test. Keep the check, undo the fix, watch it go red.

**Look at it, do not only measure it.** Numbers said the ladder cleared the options by
22px; the screenshot showed a value stranded alone on a second row.

Then:

1. `node tools/check-syntax.js` — two seconds, always.
2. **Bump the cache stamp** if anything under `game-hub/` changed, or the browser serves
   the old file and the fix looks unshipped.
3. Run the suite that matches what you touched — a round change is
   `--only=qbench,grouping,anagram,card,gameshow`. Redirect to a file; **never pipe
   through `tail`**, which reports the pipe's exit code and makes a red run look green.
4. Update `CLAUDE.md` if a decision was made. The commit hook asks; it is right.
