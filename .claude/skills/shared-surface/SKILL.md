---
name: shared-surface
description: Change something every game inherits — the phone strip, the team bar, the header, the timer, the clue card as a surface, the standings screen, scoring and the award path, the settings plumbing, or the shared styling in hub.css. Use this whenever the change is in hub-engine.js outside one game's own block, whenever a fix would apply to all five boards at once, when adding a hook every game may answer or a service every game may call, when something appears above a board and the layout has to give way, or when a component needs to read correctly under the game-show skin as well as DCU. Also use it before running a test suite on a shared change, since this is the one place where the blast radius earns one.
covers:
  - "game-hub/hub-engine.js"
  - "game-hub/hub.css"
---

# Changing something every game inherits

## Are you in the right skill?

| You want | Skill |
|---|---|
| A question type that does not exist yet | `new-round` |
| A parameter, threshold or switch on a round that works | `tune-round` |
| A new way a prompt is *drawn* | `new-question-form` |
| A named bundle of switches | `new-mode` |
| A whole new board | `new-game` |
| The phones or the relay misbehaving | `phone-debug` |
| Committing, pushing, or "it didn't deploy" | `ship-it` |
| **Something true whatever game is on screen** | **this one** |

The test in one line: **who would still be correct if you swapped the tier below it
out?** A change that stays right when the round is replaced, and stays right when the
*board* is replaced, is this tier.

| Tier | Owns |
|---|---|
| **Hub container** | teams, scores, the timer widget, the phone room, settings, the clue card *as a surface*, the standings screen, the phone strip, **the record of who answered and when** |
| **Game show skin** | geometry, turns, what a question is worth, what winning is, the ending |
| **Round** | the card's contents, the phone dynamic, merging several students into one answer, judging |

**The layering leaks and you should know it before trusting it.** `hub-engine.js` holds
layer 1 *and* four of the games in one closure, so the boundary is conceptual rather
than physical — being inside that file does not make a change shared. And parts of layer
1 were generalised *from* one game and still show it (`showResult`'s gold/silver tone,
`Kit.claimTeam`'s `allow`). Read layer 1 as "what happens to be shared so far", not
"what is inherently shared".

## 1. Two kinds of change, pointing opposite ways

**A service the game calls** — `Kit.fitToScreen`, `Sound.applause`, `showResult`,
`Kit.round.crowdMeter`. Write it once and every game inherits it, **including games that
do not exist yet**. This is the cheap, safe half.

**A hook the engine calls** — `start()`, `fit()`, `tension()`, `onResize()`,
`onRoomReady()`, `bank()`. Adding one means every game *may* now have to answer it. Two
rules that keep this from becoming a checklist nobody can finish:

- **Every hook is optional and defaults to a no-op**, so a game runs the moment it is
  registered and grows by filling hooks in.
- **A hook fires only while its game is active**, which is why not one of them checks
  `activeGame`.

If you are adding a hook, say in its comment what *absent* means — that sentence is the
whole contract for every game written afterwards.

## 2. Declare, never list

This is the single defect this project has paid for most, and it is almost always at
this tier. **Anything that names the games is a bug waiting for the next game.**

Paid for, each one:

- `games: gameIds()` on shared settings was **evaluated once**, so it was a photograph
  of the four games that existed then. Bingo registered afterwards and was silently
  absent from five settings — its ⚙ was narrower than every other game's, and with no
  phone mode available no room ever opened. `games:'*'` asks the registry when it
  matters.
- `hideAllActionButtons()` carried a hand-typed list of ids. `wager-ok` was never
  threaded into it, so a standing bet outlived every call. It asks the strip now.
- The `.lit` stage list and the `play-fit` list were both hard-coded; the second became
  a declared `fitsScreen` fact.
- Eleven `activeGame` branches in shared code became six declarations —  `bank()`,
  `nudgeStep`/`payStep`, `onSetting(id)`, `turnTeam()`, `teamDecor(i)`.
- The layout suites ask `HubGames.ids()` for the stage to assert against, which is why a
  fifth game is covered the day it calls `registerGame`.

So: before writing a `switch` on the game, ask what fact the game could declare instead.
The same applies to rounds — `ROUND_HOSTS` is four declared facts per board, and
`round_<id>` is built from each round's own `modes`.

**One more shape of the same rule.** Anything the *host* stores on a round's state
carries `host` in its name. `jGroupStamp` wrote itself as `jGroup.at`, the bingo round
already used `s.at` for which call it was reading, and the next `s.at++` produced `NaN`.
Two files writing different meanings into one field is a collision only a name prevents.

## 3. The surfaces, and the contract each one owes

**The phone strip is fixed height.** `#phone-bar` is as tall empty as full — what the
class does can never resize the board underneath it, and a full class scrolls sideways.
That contract is exactly what `repliesHost()` (a different parent per game) existed to
work around before the strip was one element in one place.

**A thing that is true *alongside* the headline is not another branch of it.** The
headline is five early-returning branches and only one can win. The cooling chips are
true whatever won, so `phoneBarHeadline()` returns the class and the chips are appended
after it. If your new state can coexist with an existing one, appending is the shape;
adding a sixth branch is how it starts fighting for the one slot.

**Anything that can occupy vertical space above a board owes that board a re-fit.** The
buzzer chip appears asynchronously and grows as phones join, and nothing re-fitted — so
Millionaire's last rung sat 19px off the bottom of an unscrollable page, found in class
rather than by any test. Measure around your own redraw and call `hook('onResize')` only
when the height actually moved. The room bench learned the same thing through a
`ResizeObserver`, because a pane narrowing is not a window resize.

**Or take it out of the flow entirely.** The reload chip, the phone nudge banner and the
standings are all fixed-position for one reason: they can appear mid-lesson, and a
banner taking layout space would push the board — or a student's letter tiles — under a
thumb mid-drag.

**A fact about the layout gets one home.** `Kit.floorTop()` exists because the bottom
edge of the board was written down in four places — the fit and three separate layout
assertions — so moving the team bar meant four right answers with nothing complaining if
you missed one. When it moved into the header and back out again, neither move needed a
single fit or assertion edited.

**A component cannot assume its host's background.** Quickfire's scoreboard drew
white-on-white under the game-show skin; the round card's palette was the light theme
hard-coded; the content screen's section headings were navy on near-black. In all three
every assertion passed and **the screenshot is what found it**. Any new surface needs its
`body.theme-gameshow` variant written in the same change, and needs looking at under
both themes.

**Set the palette, not the component.** A theme rule naming one round's classes is a bug
waiting for the next round — that is precisely how the ordering ladder inherited nothing
when it was written. `body.theme-gameshow` declares the card's custom properties, so a
round written next month is correct by construction. Defaults go as fallbacks *inside*
each `var()`, never as a declaration block on the component, or they out-specify
whatever the host sets on an ancestor.

**The clue card is not inside any stage.** `#clue-modal` is a sibling of every
`#play-<game>`, which is exactly why `openClueCard` has to set `--tension` on it by
hand, and why a rule hung off `#play-jeopardy.lit` never reached it.

**"The timer" is three clocks and conflating them has bitten before.** The header
countdown is the *hub's* — the teacher's instrument, and nothing may overwrite what they
set. Jeopardy's answer clock is the *skin's*, and starts on the buzz. A round's own clock
is the *round's*, sent once as a duration so no handset agrees the time with anybody.

**An interval should be self-stopping by construction.** The cooling ticker disarms
itself on every tick and the render arms it again only while a chip is live — so there
is no second place holding a timer that a question ending, a game changing and a room
closing would each have to remember to clear.

## 4. Settings and storage, at this tier

**The stuck default.** `register()` seeds every master value into `localStorage` the
first time a device runs the app, so **changing a `default:` in code never reaches a
browser that already ran the old build**. `roundOpenToAll` shipped `default:false` for
one build and was still off on the developer's own laptop weeks later, reading exactly
like a bug in the round. Changing a shipped default means migrating it (`S.raw` /
`S.drop`) or telling the teacher to flip it once.

**Replacing a setting is a migration, not a rename.** A per-game override is what a
teacher set deliberately. The two traps `migratePhoneModes` and `migrateRoundSettings`
both paid: the **old key being present is itself the signal** that nothing has chosen yet
(asking whether the new id is unset never fires, because `register()` seeded it), and
`drop()` is what makes the migration run once. String literals that are *storage keys of
old builds* must survive any rename — `'jGroupWho'` and `'jRound_'` are kept verbatim in
the migration for that reason.

**Check for an existing gate before forking a setting by room type.** `crowdReveal` gates
on room size, a count rather than a mode, so ordinary team play never meets it and
`byRoster` would be storage nothing reads.

## 5. CSS in hub.css — four ways a rule silently loses

CSS has no compiler and never reports that a rule lost, so all four of these look like
"the change did nothing" rather than like an error.

- **A malformed comment deletes every rule after it**, up to the next `*/`. This cost a
  debugging round on the team bar — the header behaved as though the rule had never been
  written. `node tools/check-syntax.js` stands in for the compiler; two seconds, always.
- **`@media` adds no specificity**, so a query written near the top of the file is beaten
  by an ordinary rule 50 lines below it. It reads exactly like the query not matching.
  Put responsive blocks at the end.
- **A shorthand from a more specific selector beats a longhand from a less specific
  one.** `padding` in a `.racing` rule silently replaced the longhand gutter the pool
  chips depended on, and nothing anywhere says so.
- **An id in the selector wins arguments you did not know you were having.**
  `#clue-actions button { border:none }` out-specifies a bare `#hint-btn`, so the outline
  those buttons were meant to have had never once been drawn; `:hover` out-specified
  `.picked`, so a locked-in answer kept its hover paint at exactly the moment a teacher
  was looking at it.

**And measure the right thing.** A rect is what is *painted*: `getBoundingClientRect()`
on a card mid-flip, or on a stage mid-transition, reports a fraction of the real width —
`offsetWidth` is the layout width and ignores ancestor transforms. Measure the elements,
never their container: the first phone check compared the ladder against a box that had
collapsed to 50px while its contents overflowed 259px past it, and called an unreadable
game fine.

## 6. Blast radius — the one place a suite earns itself

CLAUDE.md's default is **no test suite**, and it means it. This tier is the stated
exception, and it is still not the full suite:

> **Something all five games share** — one mistake breaks five boards at once and only
> the opened one gets noticed.

**Stop and say the risk in one line, then let the user choose.** Never test by habit and
never silently. If they want it, the matching set is about four minutes:

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js \
  --only=millionaire,fit,phone,card,turns,gameshow,lab,registry,competition > /tmp/run.txt
```

Add `,buzzers,phonemodes,reconnect,degradation,bench` if the change reaches the phones.
**Never pipe through `tail`** — that reports the pipe's exit code and makes a red run look
green. And **do not edit files while a run is going**: it voids the run and costs it
twice, which has already happened.

Two things about reds at this tier:

- **A stale check lies.** A suite that pinned the old picture goes red describing
  behaviour that was deliberately changed — this project has had five of those, and one
  of them hid sixty checks behind an abort. When a shared behaviour changes, **grep for
  the assumption** before re-running; three helpers comparing against a raw prompt broke
  together and were found one at a time across three full runs.
- **Prove a red is pre-existing rather than assuming.** `git worktree add <dir> <sha>` at
  the session's starting commit needs no stashing, leaves the working tree alone, and
  takes about a minute. Nine of eleven reds were cleared that way in one sitting.

## 7. Prove it, then ship it

**Reproduce before fixing.** Three wrong diagnoses in a row is the pattern here; the
fourth attempt printed a value and found it in five minutes. If you have guessed twice,
stop reasoning and print something.

**Prove it by reverting.** Keep the check, undo the fix, watch it go red. A check that
has never failed on the bug it was written for is not yet a test — and at this tier the
failure mode is worse than usual, because a shared change often **degrades quietly**
rather than erroring: the per-team lists capped at eight were perfect for the first eight
handsets in the room and silently wrong for everyone after, with no error anywhere.

**Look at it, do not only measure it.** Numbers said the ladder cleared the options by
22px; the screenshot showed a value stranded alone on a second row. Under both themes,
at 1280×720 and at 390×844.

Then:

1. `node tools/check-syntax.js` — two seconds, always.
2. **Bump the cache stamp** — anything under `game-hub/` needs it, or the browser serves
   the old file and the fix looks unshipped. The pattern and the reason the date shape is
   load-bearing are in `ship-it`.
3. Push, and **say plainly what went untested**.
4. Update `CLAUDE.md` if a decision was made — at this tier one usually was. The commit
   hook asks; it is right.
