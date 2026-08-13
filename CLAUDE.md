# Engishism — ESL Classroom Presentation App

Web-based games for ESL teachers to present English lessons on a classroom TV.
Pure HTML/CSS/vanilla JS, **no build step**, fully offline-capable, deployed to
GitHub Pages. Teacher-driven and class-facing — students don't touch the device.

- **Live:** https://raganther.github.io/engishism/
- **Repo:** public (GitHub Pages serves from `main`) — pushing to `main` deploys.

## How this file works (native, no harness)
This `CLAUDE.md` is loaded automatically at the start of every session, so it is
the project's memory. The repo is re-cloned fresh each session (the workspace is
ephemeral), so **anything worth keeping must be committed and pushed.** Continuity
= this file (kept current) + `git log` (what changed) + `docs/` (specs). At the
end of a work session, update the **Current status** / **Next** sections below and
commit. No roadmap file, no domain-file discipline required.

**Two hooks, and both exist because a thing that is nobody's job does not happen.**
`tools/shelf.js` fires before any edit to shared code and says what is already on
the shelf *and what has been written three times*; `tools/memory-check.js` fires
before a `git commit` and, **only when this file is not in it**, names what is
being committed and asks whether it is a memory event. Neither blocks. The silence
is the design: a reminder that fires every time is one you stop reading, so the
memory one can only speak when the memory genuinely has not been touched.

## How to talk to me
**Short. Plain words. Say the thing, then why, then stop.**
- Explain from the ground up — what the problem actually is — rather than naming it.
- No jargon. If a term is unavoidable, say what it means in the same sentence.
- Simple language, the way you'd explain it to a bright teenager.
- No walls of text. A long answer is usually a sign the thinking isn't finished.
- Don't list options I won't pursue. Give one recommendation.

## Run
```bash
git add -A && git commit -m "..."   # save
git push                            # deploy to GitHub Pages
```

**Bump the cache stamp whenever you change a file under `game-hub/`.** Every asset is
linked as `…?v=YYYYMMDDx`; without a bump, Chrome keeps serving the cached JS/CSS and a
fix looks like it never shipped (this has already cost one debugging round).

**Find the pages, never list them.** The instruction here used to name four shells by
hand and it drifted exactly as every hand-kept list in this project has: the four
`playground/` pages were never in it, so they sat two days stale while the hub moved on
— the question bench was serving round files from before the rounds were renamed, which
reads as the bench being broken rather than as a stale asset.
```bash
sed -i "s/?v=20[0-9]\{6\}[a-z]*/?v=20260804e/g" $(grep -rl '?v=20[0-9]\{6\}' --include=*.html . | grep -v node_modules)
```
**The date shape in that pattern is load-bearing**: `classic.html` carries `?v=picture`
and `?v=unit1`, which are content selectors and not build stamps, and a looser `?v=[0-9a-z]*`
rewrites them into a broken page. Match `20YYMMDD`, not "anything after `?v=`".
The engine reads its own `?v=` and exposes it as `window.HUB_BUILD`; the settings panel
footer shows it, so **"Build …" in ⚙ tells you which version is actually running.**

**The stamp busts the assets and nothing busts the shell — know this before debugging
a "it didn't deploy" report.** `game-hub.html` carries no stamp of its own, so a browser
holding the old shell asks for the *old* `?v=`, gets its own cached assets, and shows the
previous build with no error anywhere. It cost a round in July 2026: a phone showed the
pre-fix Millionaire 50 seconds after Pages finished building, and the deploy was fine.
Two tells that you are looking at a stale shell rather than a broken fix: raw `___` in a
prompt (means `Kit.prompt` isn't running at all) and ⚙ reporting the old build number.
The fix from the user's side is a query string on the page URL —
`game-hub.html?fresh=1` — which forces a fresh shell; in-app browsers (Facebook,
Instagram) hold it hardest and often ignore pull-to-refresh. **Not yet fixed properly:**
the shell should send `Cache-Control` of its own so a stale one cannot strand anybody
on old assets.

## Where this is going — skins hosting rounds
**Read this before designing anything.** It is the agreed direction, and several things
below describe a state it is deliberately moving away from. Written up in full as
`docs/game-hub-requirements.md` §3.8–§3.10.

**The reframe, agreed after Blockbusters became the second host: this is a classroom
session container, not a quiz engine.** What it provides is teams, scores, turns, a
projected surface, a timer, and thirty handsets that can each be put into a *different*
state. A game show is one thing you can do with that. Everything built so far has been
question-shaped and nothing in the container requires it to be — see "What the container
makes possible" below, and §3.10.

```
GAME HUB      the container: units, teams, scores, timer, settings, phone room
GAME SHOW     a skin with question slots. Owns geometry, scoring, turns
ROUND         a question that is played: card + phone dynamic + judging
CONTENT       filed by topic; items declare which rounds they can serve
```

**A game show is a skin.** Jeopardy's tiles, Blockbusters' honeycomb, Millionaire's
ladder — those are context, geometry and scoring around a **question slot**. What goes
in the slot is a round, called by name.

**A round is four things at once**, which is why it is a tier and not a helper: the
card the projector draws, what the handsets are put into, how several students' taps
become one team answer, and whether that answer is right.

**The question bench is the workshop, not a layer.** Rounds are built on
`playground/question-bench.html` because a phone dynamic cannot be judged from the
phone — what it produces lands on the card. Game shows call the **registry**, never
the bench.

**Every question in the app is a round — F3.8.16, built.** This was "the big move still
ahead" for three sessions and it is done. `phoneRound()` returning `null` used to mean
"there is no round here, so the phone *mode* decides", and that `or else` was the last
place in the app that believed a question might not be a round. An ordinary question — a
gap fill, a definition, a word transformation — is handled by `game-hub/rounds/default.js`,
whose four modes are the old `phoneMode` values, so what `phoneRoundNow()` returns is the
same shape either way and every caller downstream stopped needing to know which it got.

**`phoneMode` is `round_default`**, registered by the same loop that builds
`round_grouping` from a round's own `modes`. That loop grew no special case: a round may
declare a `modeSetting` saying how its row should be registered, and the default one says
it applies to all five games and belongs in the `Phones` group where a teacher has always
found it. Saying nothing still gets the shaped-round wording. **Nothing on screen moved**,
which was the point — the row reads "What the phones do" exactly as before.

**Three generations of stored value survive it**, oldest first, per-game overrides
included: the original three booleans, the retired `vote` value, then `phoneMode` itself.
Same two traps as every migration here — the old key being present *is* the signal that
nothing has chosen yet (asking whether the new id is unset never fires, because
`register()` seeds every master with its default), and `drop()` is what makes it run once.

**What the default round does not own.** It is a phone contract, not a card: it declares
no `field` and no `claims`, so `Kit.round.of(item)` still returns null for an ordinary
question. That is deliberate and load-bearing — the content-screen chip, the clue path and
the content gate all read `of()`, and a default round that claimed every item would report
every category in both units as holding rounds and push every gap fill through a
`render()` that does not exist. **The card for an ordinary question belongs to
`Kit.prompt`.** What this round owns is the room.

**`Kit.round.authored()` is the rounds you can write a question for** — everything except
the ones declaring `internal: true`. `ids()` is still every round, which is what the
settings loop wants. The workshops want the narrower list: the default round has no card
and no fields, so listing it in the question bench would open a blank page on an author,
and it registers first so it would have become the bench's opening type. Two callers, the
bench and `dev.html`, which is what makes it a shelf rather than a guess.

**Still open, and deliberately not done with it:** F3.8.17 — `typeCooldown`, `typeStrict`
and `phoneOneEach` are still registered globally rather than as the default round's own
tuning. The branch is gone, which was the point; these three are a tidy-up.

**What is not transitional, because "remove the phone settings" reads wider than it
is:** `buzzers` and `buzzerRelay` are hub infrastructure (whether a room exists, and
where — no round can own that), `bbTeamVote` is Blockbusters' skin asking which
*hexagon* to attack rather than a question dynamic at all, and `mLifelines` and
`bingoCards` belong to their skins. `round_<id>` is already built from the round's own
`modes` declaration, which is the pattern working.

### Which skins can host which rounds — contention, not answer shape
A round wants the card and the phones. A skin conflicts only if it already owns one.

| Skin | Owns the card? | Owns the phones? | Any round? |
|---|---|---|---|
| Jeopardy | no — a tile opens one | no | **yes, built** |
| Blockbusters | no — a hexagon opens one | no | **yes, built** |
| Millionaire | no — a rung opens one | no | **yes, built** (needed F3.8.9 — it has no card) |
| Bingo | no | **yes** — every phone holds a card | card-only, teacher-judged |
| Race | **yes** — the scattered words *are* the board | no | needs a stage mount |

**A host is four declared facts now, not an adapter.** `ROUND_HOSTS` in
`hub-engine.js` names, per board: which game's settings scope the round, which modal
mode it belongs to, which stage is lit, and what a team taking it is worth. Everything
else — the card, the phones, the merging, the judging — is the round's and is shared.
A third host is an entry in that table plus two calls where its clue opens.

**Blockbusters was not limited to one-word answers**, contrary to what the hexagon
suggests, and it is now the second host. The letter is the hexagon's **name** — its
display, the clue topline and the picking vote — and the win condition searches
*claimed* hexagons without ever reading it. So the rule that an answer begins with its
letter was about the *bank*, never the board: dropped for round clues, kept for
ordinary ones, and every hexagon still carries a letter because a team has to be able
to say which one they are attacking.

**Bingo can still host a round, card-only** — every round already owes a no-relay path
where the teacher clicks and judges, which is exactly the behaviour needed when the
skin owns the handsets.

### Two contract additions — both built now
- ~~**Round state that outlives one question**~~ — **built** as `ctx.keep`, the
  host's per-player store, proven by the bingo round (cards and marks surviving
  across calls and reconnects). The residual is the other direction: the Bingo
  *skin* has not adopted the bingo round yet.
- ~~**A round handed the stage as its mount**~~ — **built**, for Millionaire, which
  has no clue card. `mount` is a declared fact in `ROUND_HOSTS`. Race still needs more
  than this: its answers *are* the board, not a panel on it.

### Build order, and why this order
1. ~~**Blockbusters hosts a round.**~~ **Done** — a second host, a non-tile geometry,
   and it cost no change to any of the five rounds. See Current status.
2. ~~**Round content in a class-facing unit.**~~ **Done** — 5A of Unit 5 carries
   Connections and Word Thermometer in Jeopardy and Blockbusters, and the whole of
   New English File Unit 1 was authored with rounds from the start. See Current status.
   The gap it closed was the largest in the project: before this, no round had ever
   been playable outside the Lab board.
3. ~~**The default round.**~~ **Done** (F3.8.16) — unblocked by item 2 and taken
   immediately. See the top of this section.
4. ~~**Millionaire hosts the multiple choice round.**~~ **Done** — and it was *not*
   the "no contract change" job this list claimed. Millionaire has no clue card, so it
   needed **F3.8.9**, a round mounted somewhere other than the card. See Current
   status. It did delete the private option rendering, as predicted.
5. ~~**Round state that outlives one question** (the first contract addition
   above).~~ **Done** — `ctx.keep`, built with the bingo round. See Current status;
   the category of round designs it unblocks is now open.
6. ~~**The action strip becomes declarative** (F3.9.1/F3.9.2), so a round may have more
   than one button.~~ **Done** — a round declares `actions`/`press`, the commit button
   stays the host's because committing scores, and `hideAllActionButtons` stopped
   carrying a list. See Current status.
7. **A round handed the stage as its mount**, then **Bingo extracted**, then **Race
   extracted** — smaller first.
8. ~~**Content filing** — the tagged pool and the query (§3.11).~~ **Decided against,
   for now.** Asked for and then withdrawn in the same conversation once the shape was
   clear: it is a different product from §1.2, it migrates 565 items, and nothing here
   has met a class. **Content stays in per-game banks inside a unit file.** What was
   wanted from it — that new content reuses the established question shapes so the
   phones behave identically every time — is the `author-content` skill instead, which
   is a fraction of the work and delivers the actual requirement. The pool reasoning is
   kept in §3.11 because it will come back.

**What changed in the ordering, and why.** The old order put the two remaining hosts
first, so the pattern would be proved on cheap cases before anything working was
touched. **Blockbusters proved it** — at the cost of no change to any round — so that
question is settled and the remaining hosts are now merely more of the same. What
replaced them at the top is the two things that are *not*: content a class would
actually meet, and the one contract addition that unlocks a category rather than a
game. Bingo and Race still come last for the original reason — they are working games
with a lot of tested behaviour, and there is nothing left to learn from extracting them
that a third host would not teach more cheaply.

### Where a thing belongs — the container, the skin, or the round
A recurring question, and getting it wrong costs a refactor. **The rule: who would
still be correct if you swapped the tier below it out?**

| Tier | Owns | Test |
|---|---|---|
| **Hub container** | teams, scores, the timer widget, the phone room, settings, the clue card *as a surface*, the standings screen, the phone strip, **the record of who answered and when** | true whatever game is on screen |
| **Game show skin** | geometry, turns, what a question is worth, what winning is, the ending | true for this board, whatever question is in the slot |
| **Round** | the card's contents, the phone dynamic, merging several students into one answer, judging | true wherever it is hosted — which is what makes it portable |

**Who got there and when is the container's; what a position is *worth* is the
skin's.** That split is what makes 3-2-1 scoring expressible at all — `Kit.round.results`
records the order and the timing for everybody, and `PAY_RULES` turns it into points.
A round may not score, which is the one rule keeping it portable, so neither half can
live there. And a skin does not do its own arithmetic either: it **names** one of four
shared rules and declares two facts (`worth`, `step`). Five boards each writing their
own sums is the hand-kept list this project has paid for most, and it would put every
change to how a game feels behind a code edit rather than a settings row.

**The clue card is not inside any stage.** `#clue-modal` is a sibling of every
`#play-<game>`, which is exactly why `openClueCard` has to set `--tension` on it by
hand. It is a hub surface that skins borrow, not part of a skin.

**Team data reaches a round through `ctx`, handed in and never reached for** —
`{teams, sizes, teamName, prompt, team, mode, forTeam, onPick}`. It is read **fresh at
call time**, which is why `read`, `judge` and `accept` all take it: students join and
drop all lesson, and a size the round was told once is a lie by the third question.
That is also why the bench works — it has no team bar, passes its own `ctx`, and no
round can tell the difference.

**"The timer" is three clocks, and conflating them has bitten before:** the header
countdown is the *hub's* (the teacher's instrument — nothing may overwrite what they
set), Jeopardy's answer clock is the *skin's* (it starts on the buzz, not on the clue
opening), and a round's own clock is the *round's* (sent once as a duration with the
arm, so no handset ever agrees the time with anybody).

**The action strip — the round tier declares into it now (F3.9.1/F3.9.2, built).**
`#clue-actions` is hub-owned and correctly so, but the buttons in it belong to three
different tiers: Reveal/Close/Skip are the hub's, Correct/Wrong are *Jeopardy's*
(Blockbusters scores by claiming and has no Correct), `clue-claim` is Blockbusters',
`hint-btn` and `wager-ok` are Jeopardy's, and the commit button is the *host's*. The
concrete cost used to be that **a round could have exactly one button**, because
`group-btn` is a single element — the one thing that blocked round designs outright.

**The split that resolved it: committing *scores*, so the commit button can only ever
be the host's.** It pays a tile, a hexagon, a rung. What a round owns is anything that
changes its own question, and it declares those — `actions(state, ctx)` returning what
it wants *beside* the commit button, `press(id, state, ctx)` doing it. A round never
restates the commit button, which is why the six rounds that declare nothing needed no
change. `Kit.round.actions` builds the list (host's first) and `Kit.round.strip` draws
it; the hub and the question bench both call them, which is what makes it a shelf.

**The hint button is built by the strip, not declared by each round.** A round says
`hint()` and `hintsLeft()` — what one part of *its* answer is, which only it can know
— and `Kit.round.actions` makes the button. Five rounds hand-writing the same wording
and count is the hand-kept list this project has paid for most, one tier over. The
rules it enforces for all of them: never the last part (that is Reveal), `null` means
no button rather than a disabled one, and a hint may not score.

**`hideAllActionButtons()` stopped carrying a list of ids.** It asks the strip. The
list was hand-typed and a new button had to be threaded into it by hand with nothing
complaining if you missed one — and `wager-ok` never was, so a bet left standing
outlived every call to it. It does still put Close's wording back by hand, because a
won round renames it to say who it pays and this is the one call every opener makes. **The hub's and the skins' own buttons are still listed in
the skeleton**, which is correct: they are that tier's and each opener shows what it
wants. What is gone is the tier that had no way to declare at all.

### One name per round — the id is internal, the label is what people read
A round has an **id**, which is code (`group`, `order`, `choice`, `anagram`,
`scramble`), and a **label**, which is the only name a human should ever see. The
label lives in one place — the round's own `register()` — and everything else copies
it exactly: the category a board draws it in, the Lab section heading, the bench menu,
this file.

| id | label — use this everywhere |
|---|---|
| `group` | **Connections** |
| `order` | **Word Thermometer** |
| `choice` | **Multiple Choice** |
| `anagram` | **Drag the Letters** |
| `scramble` | **Drag the Words** |

**Why it drifted, and it drifted three ways at once.** A category name is a
hand-typed string in a content file, so nothing stops a second name for a round that
already has one. 5A's grouping category was authored as *Find the Four* — a perfectly
good name, and the second one, which is what makes it wrong. `anagram` and `scramble`
had a third variant each in their registry labels (*Anagram — drag the letters*). The
same class of defect as every hand-kept list this project has paid for, one tier down.

**Two names that are deliberately not the id.** `anagram` is a round **and** a
question form, and the bench already had to namespace them (`r:anagram` / `f:anagram`)
after the round silently shadowed the form. Calling the round *Drag the Letters* in
every interface keeps the two apart where a teacher can see them, while the id stays
`anagram` for the code. `scramble` is the same story against the `word order` form.

**Name by what the student does**, when a new round needs one — *Drag the Letters*
says more to a teacher scanning a selection screen than *Anagram* does. Connections
and Word Thermometer are the exceptions, kept because they were the names the bench
games were built and discussed under.

### "Mode" means three different things — say which one
The word is overloaded across the settings panel, the round registry and this file,
and it has already cost one conversation. **The interface is the one that gets it
right**: `jRules` is registered with `label:'Rules'`. It is the docs that drift.

| Say this | Values | Scope | What it actually is |
|---|---|---|---|
| **Ruleset** | Classic · Hub · Together | a whole game show | a named bundle of switches. Picking one **writes** the smaller settings, so every row still says what will happen |
| **Round mode** | first · agree · climb · race | one question | how that question is played. Declared by the round; the hub builds `round_<id>` from it |
| **Default-round mode** | off · buzz · write · type | one *ordinary* question | what the handsets do when no shaped round owns them. It is the **default round's** own mode, so it is `round_default` and is built by the row above rather than sitting beside it. Called `phoneMode` until F3.8.16 folded it in |

**They nest rather than compete.** A ruleset sets the other two: `classic` writes
`round_default: buzz`. So "which mode is in charge" is never a real question — the
ruleset is a shortcut that flips the smaller switches, and the switches are the truth.

**A related thing worth not re-deriving:** `first`/`agree` appear in three rounds, but
**the behaviour is already shared** — `Kit.round.poll({unanimous})` and
`Kit.round.agreement()` are on the shelf and choice and ordering both call them
(anagram carries a note on why its answer shape cannot use `poll`, and still uses
`agreement`). What is duplicated is only the **wording**: six hand-written labels for
two ideas, which drifted the moment they were written on different days — "First team
to spell it" / "First team with the right answer" / "First team to order it". A shared
list of mode definitions that rounds pick from would delete the six strings and change
no behaviour. Small, worth doing when next in those files, not a headline job — and
**do not go looking for duplicated logic, because there is none.**

### What the container makes possible — beyond question games
Two properties are doing more work than they look like, and they are what the
brainstormed direction rests on:
1. **Scoring need not be right or wrong.** The team bar takes arbitrary points from
   anything — a peer vote, a change of opinion, rarity, time survived.
2. **Every handset can be shown something different.** `optionsByTeam`, per-player
   shares, per-player bingo cards and now `promptByPlayer` — which is what made the
   **information gap round** buildable, among the highest-value techniques in ESL
   and the worst to run on paper. **Built** (see Current status); the step turned
   out to be fifteen relay lines.

Three axes, cheapest first. Full version in §3.10.
- **New skins** — every existing round works in one the day it registers. An **Only
  Connect wall** (the grouping round already *is* the wall), territory conquest, an
  **escape room** (a narrative spine for a revision hour), a track race where luck
  flattens the strong/weak gap, and **Pointless** — the class votes and the *rarest*
  correct answer wins, which rewards depth over speed and is only possible with phones.
- **New rounds** — auction, call my bluff (students write the content), error hunt,
  a continuum, prediction, and **justify it**: the first round the *room* judges rather
  than the board. Everything in the third axis depends on that one working.
- **Not game shows at all** — **Just a Minute** (the class buzzes to *challenge*, so the
  buzzer becomes critical listening), **information gap / negotiation**, **secret roles**
  (accusation and hedging — C1 register work), **debate scored on how many minds
  changed**, **card decks** as a live diagnostic of what is shaky, and **describe and
  guess**.

**Four of those six need state that outlives a question**, which is why F3.8.8 moved up
the build order. And the test worth running is Just a Minute: if a format with *no
questions in it* works in this container, "Game Hub" is the wrong name for what has
been built.

### Where this ends up — a tagged pool and a query (§3.11)
**Agreed direction, nothing built.** Today a teacher picks a unit, then a game, then
sections. The target is: pick a **skin**, pick **what to practise** — present perfect,
crime vocabulary, chapter 6 — and the skin fills itself from a tagged pool. Content is
authored per question type into that pool, increasingly with agent help, rather than per
game into four banks.

**The one decision that changes the data model: two tag axes, and only one is
authored.** What an item is *about* (present perfect, §5B, C1) is authored — a human
knows it. What *shape* it is (one word? four options? a scale of five?) is **derived
from the item's own fields**, never labelled on it. `Kit.round.of()` and `hasBank()`
already work this way. Hand-labelling `games:[…]` onto an item is the same list-kept-in-
step-by-hand defect this project has paid for four times. **Tag what a human knows,
derive what the data knows.**

**The three issues most likely to be discovered late**, out of the full list in §3.11:
- **Graded difficulty.** Jeopardy runs $100→$500 and Millionaire needs two questions at
  every rung in every section. A tag query returns a *flat* set with no notion of a
  rung, so either items carry an authored difficulty or the skins stop grading.
- **The gate inverts.** "No prompt in two banks" is exactly wrong for a pool, where one
  item is queried many times — so it must be rewritten *in the same change* as the
  migration, never switched off between the two models.
- **Paraphrase collision at scale.** The gate compares normalised prompts, so two
  generated items about one word, worded differently, both land and a board can draw
  both. Nothing catches it today.

**And the honest one:** this is a different product from §1.2, and the largest risk is
opportunity cost — nothing here has met a class yet, and the classroom run is what would
say which of these requirements were ever needed.

### A picture of the whole — brainstormed, nothing agreed (§3.12)
**Read the framing before the ideas.** §3.12 is explicitly *not* a specification and
carries no requirement IDs. It exists because every other section here describes a
*mechanism* and none of them says what the thing is for on a Thursday morning — so it is
a yardstick to check small decisions against, not a plan to build. The end product may
look nothing like it.

The sketch: a **run sheet** (a session is a sequence — warm-up, main game, speaking
beat, exit ticket — with teams and scores carried across, which the container already
does and nothing uses); the teacher **never types a query** but picks "what's next",
"what we just did", "what went wrong"; the teacher's **phone is the remote**, because
the app assumes you are at the laptop and in Race you are explicitly not; and a
**diagnostic** that remembers what the class got wrong and feeds it back into the query.

**The diagnostic is a scope decision, not a feature.** §1.3 puts data persistence out of
scope, and this would be the first thing holding data about *named students*. The narrow
version dodges nearly all of it: **store what was missed, not who missed it** — word
counts need no student identity and carry most of the teaching value.

**What every one of those ideas could quietly break**, which is why they are restated in
§3.12 rather than assumed: it still works with **no relay and no internet** (F3.8.6);
setup stays **under 30 seconds** (§1.4.4 — and a run sheet, a query and a review queue
are all *more* screens before a game starts, so each must remove setup rather than add
configuration); and **the teacher decides** — suggest Monday's warm-up, never build it
silently.

### Content: one filing system, not one pool
§3.2's per-game argument still holds for *answer shape*. What it missed is that **not
all content is convertible** — a grouping set or an ordering scale cannot be derived
from a gap-fill sentence. So content divides in two:
- **Shareable** — a word, its definition, its unit and section. Serves gap fill,
  Blockbusters, Race, Bingo, multiple choice.
- **Bespoke** — a grouping, a scale. Authored for one round by nature.

File by **topic** (a lesson is a topic; nobody teaches "all my Connections"), with each
item declaring which rounds it can serve. A bespoke item declares one. **Author ~20
items by hand before writing any code that consumes them** — if most C1 content turns
out bespoke, the change buys much less than it looks like it should.

### The rules that keep the tiers pluggable
- A round never contains scoring, turns, timers, the board or a tile.
- The dependency arrow points one way: `playground/` → `game-hub/`, **never back**.
  A shared module written in `playground/bench-kit.js` is unreachable from the hub.
- Shared modules take what they need as parameters and hand back data — no globals, no
  assumptions about the host's DOM. `Kit.vote` is the model: you pass it replies, it
  hands back counts, the transport stays the host's.
- **Declare, don't special-case.** No list of games or rounds kept in step by hand.
- **A second caller is what proves a shelf**, and the first caller is rewired in the
  same change. One caller is a guess about an API.

## Architecture — three generations coexist
1. **Classroom Game Hub (current focus).** The MVP demo. One consolidated app;
   flow is **choose unit → choose game → choose sections → play**.
   - `game-hub.html` — the app: loads every unit content file + the engine
     (linked from index.html). Units register into `window.UNITS`.
   - `game-hub-unit4.html`, `game-hub-unit5.html` — per-unit deep-links (load one
     unit; the engine auto-skips the unit-select step).
   - `game-hub/hub-engine.js` — all game logic + injected UI skeleton; renders the
     unit/game/section/play screens, the persistent team bar, and the timer.
   - `game-hub/hub-kit.js` — **shared kit: solve once, use anywhere.** Stateless
     services every game can call — `fitToScreen`, the `anim` variant registry, the
     `claimTeam` chooser, `passTurn`. Nothing here touches engine state; it all takes
     parameters, so a new game gets these for free.
   - `game-hub/hub-settings.js` — settings registry + panel (⚙ in the header).
     **Both must load before hub-engine.js** (the engine throws without either).
   - `game-hub/hub-buzzer.js` — phone-buzzer client, shared by the hub (host) and
     `join.html` (players). Optional; absent relay = absent feature, nothing breaks.
   - `tools/buzzer-relay.js` — zero-dependency Node relay **and** static server for
     buzzer lessons. `join.html` is the students' page. See `docs/buzzers.md`.
   - `game-hub/hub.css` — shared styling (DCU theme); the one place to restyle.
   - `game-hub/content/unit-4.js`, `unit-5.js`, `nef-1.js` — data-only content banks;
     **two coursebooks now**: Units 4 and 5 are Cambridge Empower C1, `nef-1` is New
     English File 5th ed Unit 1, and the unit label says which. A different book is a
     harder proof of §1.4.3 ("the same approach extends") than a second unit of the
     same one. Each does
     `window.UNITS.push({ id, label, card, jeopardy…, blockbusters… })`.
   - Games: **Jeopardy**, **Blockbusters**, **Race to the Board** and **Millionaire**.
     Per-game content
     model (content lives in data, separate from the engine). **Adding a unit = one
     content file + a `<script>` line in game-hub.html.** A unit only shows the games
     it has a bank for (`gamesFor()`), so units can adopt a new game one at a time.

2. **Unit-first whiteboard app (earlier rebuild, paused).**
   - `index.html` (landing) → `app.html` → `engine/unit-app.js`; 1 unit, 2 games
     (Picture Choice, Sentence Builder), shared `engine/interactions/tile-tray.js`.

3. **Legacy topic-first engine.**
   - `classic.html` → `engine/engine.js`; 18 activity types, topics, lessons, plus
     4 standalone team-building games (`bunker`, `desert-island`, `it-helpdesk`,
     `scam-or-legit`). Reachable via the landing page's "Classic games" link.

`index.html` links all three (Choose a unit / Game Hub / Classic games).

## Three layers, and where a change belongs
Everything below fits one of three layers plus two things that cut across all of them.
Knowing which you are touching tells you the blast radius before you start.

| Layer | What it is | Changing it costs |
|---|---|---|
| **1 · Template** | What every game gets by existing: the skin (chrome *and* setup screens), team bar, scoring, timer, clue card + flip variants, `showResult()`, all `Sound.*`, all `Kit.*`, the content gate | Highest engineering risk, touches everything — this is what the smoke suite is for |
| **2 · Game** | Board logic, stage CSS, its `tension()` source. Free-form within the registry contract | Low risk, isolated to one game |
| **3 · Content** | The banks — shaped per game (§3.2), organised per unit | Near-zero engineering risk, **highest cost in your hours** — 760 items across three units, two coursebooks |

**Layer 1 is really two things pointing opposite ways**, and the distinction matters
when adding a feature:
- **Services the game calls** — `Kit.fitToScreen`, `Sound.applause`, `showResult`.
  Write once, every game inherits, including games that don't exist yet. A richer
  clock is this kind of change.
- **Hooks the engine calls** — `start()`, `fit()`, `tension()`, `onResize()`. Adding a
  new beat to the round (`onTeamChange()`, say) means every game *may* respond.

**Two axes cut across all three layers:**
- **Variants + per-game settings.** `cardFlip` is layer 1, `bbWinRoute` is layer 2,
  `theme` is layer 1 applied per game — same mechanism, any of them overridable from
  that game's settings tab. Shared by default, divergent by declaration.
- **Units.** Content is a **matrix of games × units** with `hasBank()` at each
  intersection, so Unit 4 offering only Jeopardy and Blockbusters is a supported
  state, not a gap.

**Where the layering leaks — worth knowing before trusting it:** `hub-engine.js` holds
layer 1 *and* all four layer-2 games in one closure, so the boundary is conceptual, not
physical. And parts of layer 1 were generalised *from* specific games and still show it
— `showResult()`'s `tone` is gold/silver, `Kit.claimTeam`'s `allow` exists for
Blockbusters' two-team geometry, and the clue card is only used by Jeopardy and
Blockbusters. Read layer 1 as "what happens to be shared so far", not "what is
inherently shared".

## Adding a game — the registry
A game declares itself once and the engine drives it through that contract. There
used to be **nine** `if (activeGame === 'jeopardy')` branch points — build, fit,
curtain-up, resize, timer-expiry, content screen, start button — and a new game had
to be threaded into every one by hand, with nothing complaining if you missed one.

```js
registerGame({
  id:'bullseye', title:'Bullseye',
  card:  { icon:'<svg…>', blurb:'…', badge:'Best for: …' },
  intro: { eyebrow:'…', title:'BULLSEYE', sub:'…', accent:'#39E27A' },
  hasBank: u => (u.bullseyeBank||[]).length > 0,
  load(u){…}, renderContent(list, help){…}, startButton(btn){…},
  start(){…}, fit(){…}, deal(){…}, tension(){…}, onResize(){…}, onTimerEnd(){…}
});
```

**Every hook is optional and defaults to a no-op**, so a game runs the moment it is
registered and grows by filling hooks in — the checklist can't be half-finished.
Hooks only fire while their game is active, so none of them checks `activeGame`.

| Free, no code | One declaration | Genuinely per-game |
|---|---|---|
| skin (chrome + setup screens), team bar, scoring, timer, clue card + flip variants, `showResult()` banner, every `Sound.*`, every `Kit.*`, content-integrity gate, the phone strip, the layout contract | `card` (icon/blurb/badge), `intro` ident, `hasBank`, `fitsScreen`, the settings `games` arrays via `gameIds()`, **the phone contract's six hooks** | board logic, stage CSS, `tension()` source, content bank shape |

**Register before init, or the game is invisible.** `renderGameCards()` runs during
init, so a `registerGame` call placed after it leaves a game that is in
`HubGames.ids()`, passes `hasBank`, and has no card on the game screen. Nothing
errors. Keep registrations in the cluster at the top of `hub-engine.js`.

### The phone contract — what a game owes the room
Phones reach a board through six hooks, not through the engine knowing the game's
name. Declare them and the game inherits buzzing, everyone-types, type-then-buzz,
the class vote and the activity strip; leave them out and its phones are idle,
which is a correct state rather than a broken one.

```js
expects()        // what a typed answer is judged against
phonePrompt()    // what the handset shows
askingNow()      // is a question open right now
buzzEntitled(b)  // false refuses this buzz — the engine re-arms, see below
onBuzzTaken(b)   // somebody has the floor
onTypedWin(b)    // typed and correct: score it, return the points (null = it didn't)
wantsVote()      // does this game ever ask the room something
onVoteReply(all) // where the counts get painted
```

**Refusing a buzz is not ignoring one.** The relay locks the room on the *first*
buzz whoever sent it, so a phone that isn't entitled would hold the lock and the
team that is could never get in — `buzzEntitled` returning false makes the engine
re-arm, which clears it. Race's steal rule and Millionaire's `speaker` role are both
this, and were both written out by name in `onBuzz` until the fifth game proved the
point. **What it re-arms is `phoneRound()`'s answer, not a buzzer** — hard-coding
`armBuzzers` there meant the recovery from a stray buzz would replace a game's own
round with the thing it had just refused, which killed a grouping clue outright.

`window.HubGames.register(...)` is exposed so a game can eventually live in its own
file the way units do via `window.UNITS`; the four built-ins still declare themselves
inside `hub-engine.js` because their logic shares that closure. Moving them out is
mechanical and hasn't been done.

**A shared feature reaches every game, including future ones, by living in the
shared layer** — the header timer is one widget, so a richer clock is one change.
Where games should *diverge*, use a `variant` setting (`cardFlip`, `bbWinRoute`,
`theme` all do): register the implementations, list them as variants, and the panel
builds the per-game override rows itself. Shared by default, divergent by declaration.

## Solve once, use anywhere
**Ask the code what is already on the shelves before writing anything shared:**
```bash
node tools/shelf.js            # every Kit.round / Kit / BenchKit helper, with its shape
```
It loads the registries and lists them, so a helper added next month appears with
nobody editing anything — the same move `tools/question-types.js` makes for content.
**It also runs as a hook**: `.claude/settings.json` fires it before any edit to
`rounds/*.js`, `hub-rounds.js`, `hub-kit.js` or `bench-kit.js`, and it hands the
inventory back as context. Silent for every other file. It exists because the
expensive mistake in this project is never a hard bug — it is writing a second copy
of something that already exists, and the reason that happens is that nobody looked.

Anything more than one game needs lives in `hub-kit.js`, not in a game:

| Service | Replaces | Used by |
|---|---|---|
| `Kit.fitToScreen(el, {min,gap,floor})` | three separate header/team-bar measurements | Jeopardy, Race, Millionaire |
| `Kit.anim.register/get(feature,name)` | hard-coded animation keyframes | the clue card, and whatever comes next |
| `Kit.claimTeam({mount,onPick})` | Blockbusters' two buttons + Race's own bar | Blockbusters (`allow:[0,1]`), Race |
| `Kit.shapeOf(origin,target)` | animations assuming everything is a rectangle | the `morph` card animation |
| `Kit.passTurn(count,current)` | four ad hoc rotations | all four games |
| `Kit.prompt.register/render/reveal` | a question's *form* being a convention in how the prompt was worded | all four games |
| `Kit.answer.judge(typed, expected)` | `===` deciding whether a student produced the word | the typing race; any game that ever accepts typed input |
| `Kit.vote.open({options,team})` | Millionaire's Ask the class being the only way to ask the room to choose | Ask the class; Blockbusters' hexagon vote |

**Deliberately *not* on the shelf: the grouping round.** Its union-of-a-team's-picks
and its settle-with-a-memory are the same two ideas `BenchKit` holds one tier down,
so the pull to extract them is real — and it is one caller, which is a guess rather
than an API. It lives in `hub-engine.js` with Jeopardy's other clue mechanics until a
second board wants it; **rewiring the first caller is what proves an extraction**, and
there is nothing to rewire yet. Written so the move is mechanical when that happens.

### Question forms are a registry too
A question's *form* — gap fill, anagram, odd one out — used to exist only in how the
prompt happened to be worded; every game pushed the string through `textContent`, and
the one exception proved it (Race hand-rolled a `.gap` span in its own renderer).
`Kit.prompt` makes the form something any game can draw:

```js
Kit.prompt.register('anagram', {
  games:['jeopardy','blockbusters','race'],    // omit for "suits all"
  render(mount, item){…}, reveal(mount, item){…}
});
```

**Five forms are in the kit.** `gap` is inferred from `___`; the rest need an explicit
`type:` on the item, because inferring them would silently re-type the items authored
before they existed. Each parses what it needs out of the prompt, exactly as `gap`
reads `___`, so **the item shape stays `{text, answer, type}` and adding a form touches
no game and no content field** — only the authoring convention for its own prompts:

| Form | Author it like this | Suits | Reveal |
|---|---|---|---|
| `gap` | `"held in ___"` | all four | the answer drops into the blank |
| `anagram` | `"Unscramble: the decision a jury delivers."` + `answer:"Verdict"` | jeopardy, blockbusters | the letters re-sort into the answer |
| `scramble` | `"Word order:"` + a whole-sentence `answer` | jeopardy | the words re-sort into the sentence |
| `oddoneout` | `"Which does NOT belong: verdict / jury / sabbatical"` | jeopardy, blockbusters | the odd chip lights, the rest stand down |
| `errorfix` | `"You *must to* wear a helmet."` + `answer:"must"` | jeopardy, millionaire, race | the struck words swap for the answer |

Two more are **experimental**, in `playground/lab-forms.js` — `bridge`
(`"FIRE -> ___ -> SHOP"` + `answer:"work"`) and `realfake` (admit or reject a
spelling). They are not in the kit, so no game can draw them yet.

The separators are load-bearing: **`/` between odd-one-out candidates** (with an optional
lead-in before a `:`), **`*asterisks*` around the words to correct**, and **`->` between
bridge links, exactly one of them `___`**. Get them wrong and the form declines to plain
text rather than rendering nonsense — which is the intended failure, but it looks like
"the type did nothing", and `render()` still hands back the type because the form *ran*.
The tell is that a declining form leaves **no element children** — bare text — which is
how the question bench tells the two apart, in its verdict line.

**`bridge` would be the first form to suit every board** if graduated, and the reason is
worth keeping: its answer is one ordinary word, so a hexagon can key it by its initial
and a Race tile can hold it, while Millionaire's four options are candidate links you
still have to test against *both* neighbours rather than a give-away. The reveal names
the compounds (`firework · workshop`) because the answer alone doesn't explain itself.

**Millionaire never gets an anagram** — its four options hand you the letters. Race never
gets an odd-one-out — the board gives it away. That is what `games:[…]` is for, and the
smoke test asserts both directions.

**Density is the open problem, not the mechanism.** 24 typed items against 589 is
**4.1%**, so a Blockbusters board of 18 hexes expects ~1.6 of them and a Millionaire rung
(filtered by section *and* level) may go a whole game without one. Playing a real round
found the odd-one-out and never reached the anagram. If these forms are worth keeping,
the next step is more items, not more code — Millionaire needs the most because its
per-rung filtering makes three items nearly invisible.

Three properties that make it adoptable rather than a migration:
- **Untyped items still render.** A prompt containing `___` is recognised as a gap
  fill without being labelled one, so **336 of the 565 authored items gained a real
  blank with no content edits at all.** Anything else falls back to plain text.
- **A type names the games it suits.** Not every form survives every board — an
  anagram in Millionaire is given away by its own four options, odd-one-out in Race
  is given away by the board. Declare it rather than discover it.
- **`reveal()` returns how long it runs, or 0 if it declined.** An answer only belongs
  in a blank if it is the word the sentence is missing, so the gap type declines three
  kinds: over 26 characters, alternatives (`forbidden / not permitted`), and ones
  carrying a teacher's note (`he was made REDUNDANT (adjective)`). Those print on the
  answer line, which is what that line is for; when the blank *did* fill, the answer
  line stands down rather than showing the same word twice.
- **The blank's `?` is real text, not a CSS `::after`.** Race's original renderer put
  it in the DOM and that was right — a placeholder that only exists in CSS can't be
  read by anything inspecting the sentence, which broke a test the moment it moved.

Items arrive normalised as `{text, answer, type?}`, so the kit never learns that
Jeopardy calls it `q` and Blockbusters calls it `clue`.

**Interchangeable implementations.** A feature can ship several versions and let the
teacher choose. Register each, list them as `variants`, and the setting's value is the
name to look up:

```js
Kit.anim.register('cardFlip', 'rise', { open(card, origin, ms, h){…}, close(…){…} });
S.register({ id:'cardFlip', type:'variant', default:'grow-turn',
             variants:[{value:'rise', label:'Rise up — no 3D'}, …] });
```
A variant may name the games it suits (`{value:'x', games:['blockbusters']}`) and the
panel filters each tab accordingly; `currentFlip()` falls back to `grow-turn` rather
than silently doing nothing if a game is set to one it isn't offered.

Adding another is those two lines — no branching in game code, no panel edit. `h.at(deg)`
gives the transform landing the card on its origin; the helpers are **snapshotted before
the card's transform is touched**, because measuring after forces a reflow that delays
the start by about a frame.

`allow` on `claimTeam` exists because some boards are structurally two-team —
Blockbusters' yellow-across / blue-down geometry gives a third team nowhere to play — so
it is restricted there rather than generalised.

### Asking the room to choose
`Kit.vote` is the counting half of a vote — options, a live count against each, a
leader, and **who is entitled**. The transport is not in it (that is the engine's
room), so it takes replies as a parameter and hands back numbers. Two games use it
for opposite questions: Millionaire asks the whole class *what the answer is*,
Blockbusters asks **one team** *which hexagon to attack*.

`team` is why it is a service rather than four lines copied twice. A round can
belong to one side of the room, and that has to be true in three places at once —
the relay stores it, the phones that are not entitled show the question with no
controls (`turnTeam`, deliberately not `team`: the join payload already uses that
name for the player's own team, and the handset runs both through one handler), and
the count drops anything that arrives anyway. The third is not paranoia: a phone
that joined mid-vote, or one still holding the previous question, has been told
nothing.

**Where the numbers go is a content question, not a styling one.** Millionaire draws
its counts on the four options, which is exactly right there. Blockbusters cannot:
two hexagons routinely carry the same letter — a board of eighteen from a vocabulary
bank clusters on common initials — so one vote for `R` painted "1" on three
hexagons, which any room reads as three votes. The vote is for a *letter*, so the
letters are counted once in a strip beside the legend, and the board's job is to
show where that lands: every hexagon carrying the leading letter lights up. That is
also the honest picture — the team said R, there are three, the teacher picks which.

**The hexagon's `clip-path` crops an outline and a box-shadow away entirely**, so the
leading hex is marked with a `drop-shadow` filter and a fill change, the same reason
the winning route uses one. And in the game show skin the fill has to change: the
skin already glows violet, so a slightly bigger violet glow marks nothing.

## Screens: one layout contract, asked of whatever is registered
Every game owes the room the same three things, whatever its board is made of:
**nothing below the floor, nothing off the right edge, no text cut off.** The floor is
`Kit.floorTop()` — it was the top of the team bar until the bar moved into the header,
and the tests ask for it rather than restating it. That is
checked by the `fit` (computer) and `phone` (handset) suites, and neither carries a list
of games — both ask the engine:

```js
window.HubGames.ids().map(id => ({ id, title, stage: window.HubGames.get(id).stage }))
```

Assertions run against the **stage the registry names**, so there is no per-game selector
to drift and **a fifth game is covered the day it calls `registerGame`**. This is the
same move as `hasBank()` and the content gate: the check finds the game rather than
waiting to be told. CSS inheritance gives a new game the chrome; only this gives it the
guarantee — which is the difference worth understanding before adding a game.

**It earned itself immediately.** The hard-coded list it replaced had been passing for
months while Jeopardy's category headings were **cut off mid-word on the desktop** — 12
of them at 1280×720. The type was sized `1.05vw`, i.e. from the *viewport*, so it stayed
at 13.4px however narrow the column got, and a 16-category board gives each heading 51px.
`fitCategoryHeadings()` now measures the column actually rendered, on a canvas so it
costs no reflow, with the **longest word** as the constraint (spaces wrap, words cannot).
Two traps in that measurement:
- **Letter-spacing is em-based and canvas does not apply it.** The game show skin triples
  it to `0.09em`; across a ten-letter word that is 0.9em, a fifth of the column — the
  difference between fitting and clipping, not a rounding detail. Add it back per
  character.
- **The floor is a legibility floor, not a fitting one.** Sizing purely to fit reached
  8px: not clipped, not readable from the back of a room, and it *passed the assertion*.
  It is 10.5px now, with long words breaking instead. **16 categories at 1280px is still
  only 10.5px — the answer is picking fewer sections, not more CSS.**

### Handsets — a preview device, not the projected board
The app is for a classroom TV and that is not changing, but a teacher checks a lesson on
their phone. Two rules invert there, deliberately:
- **The board may scroll.** "Never scroll" exists because nobody can scroll a projected
  image mid-game. A phone in the hand is not that, and forcing the fit is what broke
  Millionaire.
- **Nothing is hidden, only compacted.** The timer and the scores are what a teacher
  reaches for. Chrome went 323px → 198px on a 390×844 screen (`@media` tiers at 760px
  and 480px), against a hard cap of 200 in the `phone` suite. **The cap is two pixels
  away, and the thing that eats it is another header button**: the Lab button cost 31px
  the day it was added, because `.header-right` wrapped onto a third row rather than
  overflowing. Measure the group, not the button — at 360px it has 332px to fill and the
  four controls came to 353. The timer gave up the difference; it is the biggest item
  there.

Three fixes worth not re-deriving:
- **`Kit.fitToScreen(el, {floor:true})`** hands the height back when the content genuinely
  cannot fit, rather than forcing one. Millionaire asks for it; Jeopardy and Race do not,
  because they *can* always be made to fit (one scales its type, the other re-scatters).
  Forcing a height collapsed the option grid's rows under their own content and the
  ladder painted straight through answers B, C and D.
- **`grid-auto-rows: minmax(min-content, 1fr)`** on `#m-options` is the structural
  guarantee a row can never shrink under its content. Without it the fix is only "there
  happens to be enough room now".
- **`--jcols` instead of an inline `repeat(n, 1fr)`.** The column count lives in a custom
  property so the stylesheet owns the track size; an inline style cannot be overridden by
  a media query. That is what lets a handset give Jeopardy fixed-width columns and scroll
  the board sideways — 16 categories across 390px is 22px a column, which fits by every
  measurement and is readable by none.

**Measure the elements, never their container.** The first version of the phone test
compared the ladder against `#m-options`, whose box had collapsed to 50px while its
options overflowed 259px past it — so it saw no collision and called an unreadable game
fine. It passed on the broken build. A layout assertion that has never failed on the bug
it was written for is not yet a test.

## Authoring content (keep the question forms mixed)
An audit of Unit 5 found **71% of all items were gap fills**, which the four different
boards had been disguising. Extra items were added rather than rewriting any, bringing
it to **55%**. When authoring, reach for these before another gap fill:

| Form | Example | Fits |
|---|---|---|
| Word transformation | "Change 'convict' into the noun for the court's decision." | all four |
| Error correction | "Correct it: 'You must to wear a helmet.'" | Jeopardy, Millionaire, Race |
| Odd one out | "Which does NOT belong: verdict / jury / sabbatical?" | Jeopardy, Millionaire |
| Register / formality | "Which is the formal version?" | Millionaire |
| Collocation | "Which verb goes with 'a sentence'?" | Millionaire |
| Opposite / definition | "The opposite of a guilty verdict." | Blockbusters, Race |

Extra items need **no engine change** — every game filters its bank by section and
shuffles, so more items simply means more variety per play. Three constraints:
**Blockbusters** answers are one word and `letter` must be its initial; **Race**
answers become board tiles, so they must be single words and never duplicate another
answer in that bank; **Jeopardy** categories must stay grouped by section in array
order or the content screen prints a section heading twice.

**Grammar Focus pages are content too, and they were nearly missed.** An audit found
5A relative clauses (p146) had **three** items that genuinely tested a relative
pronoun, all in one Jeopardy category — so playing any other game gave zero practice
on the unit's own grammar. 5B obligation (p147) fared better at 27. Both are now
covered across Jeopardy, Race and Millionaire. Two lessons worth keeping:
- **Jeopardy's named categories gave grammar a slot; the other three banks are flat
  lists, so authoring drifted to vocabulary.** When adding a unit, check the Grammar
  Focus pages explicitly — the format will not remind you.
- **Match the point to the format.** Relative pronouns are ideal Race tiles (one word
  each, none repeating, so all nine sit on the board and picking the right one is a
  real discrimination). Millionaire suits them because p146 exercise b is *already*
  written as a four-way choice, so the book's own distractors transfer. Blockbusters
  is the wrong home — single-word answers keyed by an initial make **W** ambiguous
  across who/whom/whose/where/when/why.

**No prompt may appear in two banks.** An audit found 21 prompts copy-pasted across
2–4 banks, nearly all word transformations added during the vary-the-forms pass —
the letter of that request, but it broke §3.2. Same *answer* in several games is the
design working (spaced retrieval from different angles); same *prompt* is the thing
per-game authoring exists to avoid. Each game now keeps the shape it suits —
transformations in Jeopardy's "Change the Word", definitions in Blockbusters, gapped
sentences in Race, four-option discriminations in Millionaire. This is now
**enforced**, not a convention:
```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=content
```
`testContentIntegrity` runs over every unit in `window.UNITS`, so a new unit is
checked for free. It catches the things no engine test can: a duplicated prompt, a
Blockbusters answer whose initial doesn't match its hexagon, two Race items competing
for one tile, a Millionaire rung with no question behind it, and section labels whose
counts have drifted from the bank. **It found eight real defects in Unit 4 the day it
was written** — including a hexagon showing `U` whose answer was *Irresistible*.

**Both units now carry all four games across all four sections.** Unit 5 is 319 items,
Unit 4 is 246 — **565 in total**. Two things learned filling the gaps:
- **The writing lesson was as gameable as any other section**, once you stop treating
  it as "an essay". The linkers are vocabulary (and make excellent Race tiles, like
  the relative pronouns), and the paragraph functions are a fixed, testable structure.
  5D was skipped for months on the assumption it wouldn't fit; that was wrong.
- **A ladder needs two questions per rung, not one.** Millionaire's ladder is *per
  team*, so with one question per rung both teams meet the identical question on the
  way up. Every section now carries at least two at every rung.

Still missing: Unit 5's pronunciation beyond one item, the p66 crime idioms, and
anything from the reading texts; Unit 4's p54 review page.

## Adding a feature (settings-first)
Every new feature gets a switch. Register it at the top of `hub-engine.js` and the
panel builds its own row — **there is no panel markup to edit**:

```js
S.register({ id:'myThing', group:'Race to the Board', type:'toggle', default:true,
             games:['race'],                       // which games it applies to
             label:'Human-readable name', help:'One line on what it does.' });
// then, wherever it matters — always pass the game:
if(S.get('myThing', activeGame)) { … }
```
**Naming `games` makes it per-game overridable.** The panel grows an *All games* tab
holding the master value plus one tab per game; a game follows the master until
explicitly overridden, and each row says which it is doing. ⚙ opens on the tab for
whatever is being played (`S.setContext`). Omit `games` for infrastructure that isn't
per-game — the buzzer relay address, for instance.

**A game can be registered with its own default** — `defaults:{jeopardy:'agree'}` on
the definition. It ranks below a teacher's override and *above* the master,
deliberately: such a game does not follow the master, and pretending it did would
make the All-games row a control that silently does nothing there. The rows say so
("This game's own default"; the master row lists it under "has its own value").
For round modes it is declared by the **host**, in `ROUND_HOSTS`, because the round
says what modes exist and the skin says which one its geometry wants. **Two ways to
say it, and the general one is the one to reach for:**
- **`teamMode:true`** — "this board is team-based, so give me whichever mode each
  round calls its whole-team one". The round declares which that is (`teamMode` on
  the round, `agree` wherever there is one). Jeopardy sets this, so a tile is always
  a team's answer rather than the fastest thumb's — **and a round registered next
  month lands on the right mode with no host edited.**
- **`modeDefaults:{ordering:'race'}`** — one named round, for a reason peculiar to
  that round. It outranks the ask above. Jeopardy has exactly one: ordering's modes
  are about *how many ladders*, not *who has to agree*.

That split exists because the first version was a per-round list on each host, which
a new round had to be added to by hand with nothing complaining if you missed it —
the defect class this project has paid for most. Quickfire and Millionaire declare
neither, so they keep first-tap-wins.

Storage: `id` is the master, `id@game` is an override. Settings written before scoping
existed are master values under the same keys, so nothing needed migrating — there is a
smoke test pinning that.

`type:'select'` takes `options:[{value,label}]`; `type:'range'` takes
`{min,max,step,unit}` and is what makes a **weight** tunable from the interface rather
than from the source — cooldowns, point values, round lengths. It stores a number, not
a string (a `step` with a decimal point parses as a float), because a weight arriving as
`"4"` compares and concatenates wrongly everywhere it is used. `S.onChange(fn)` is for
settings that should change what's already on screen without restarting the game. Values
persist in `localStorage` per device; a browser that blocks storage on `file://` silently
falls back to memory for the session (the panel says so).

**Every control carries `data-setting="id"`.** The panel doesn't need it — it holds the
definition in a closure — but anything looking *at* the panel does, and without it the
only handle on a control is its label, which is prose.

### One gear, two forms: the panel and the drawer
There is **one settings entrance** — ⚙ — and its form suits the moment: outside a
game it opens the full panel (tabs: All games + one per game); **during play it
opens the docked drawer** for the game being played (`L` also toggles it), whose
"All games" button hands over to the full panel for the rare cross-game edit. The
drawer is `S.renderFor(mount, game)` — the same `buildRow` the panel uses, filtered
to one game — so a new setting appears in both by being registered, and a change
made in the drawer is **an override for that game**, never the master, which is
what makes trying an idea mid-round safe. There is no separate Lab button any more.

**How a game's settings view is organised** (panel game tab and drawer alike):
the **Ruleset** section leads (any picker registered with `presets`, or handed them
via `S.describePresets(id, bundles)`), then the game's own groups, then the shared
ones in a fixed order (Competition, Questions, Phones, Clue card, Presentation,
Sound); on All games the shared groups lead instead. "Own" is derived — a group is
a game's own when everything in it names exactly one game — so a sixth game's group
sorts itself without being listed anywhere. Group headers fold (per session, not
persisted). **Every row a ruleset bundle touches carries a note** — "Classic sets
this to 10s" — advisory beside the control, which stays the truth; the mode writes
switches, it never holds them.

Three things it has to do, each of which was a bug first:
- **Stop short of the header.** It holds every control a teacher reaches for *while* the
  drawer is open — New game, the timer, ⚙, and now the ± score buttons too — and a
  full-height panel swallowed the lot. `fitLab()` measures both edges rather than
  assuming either; it already asked whether the team bar was `fixed` before subtracting
  it, which is why it needed no change when the bar moved.
- **Make the board give up the width rather than covering it.** `body.lab-open` insets
  the screen and `hook('onResize')` re-fits; without it the drawer hid two of
  Millionaire's four options, which defeats the point of changing a rule and watching the
  next question play under it. Dropped on handsets, where there is no width to give.
- **Stack its rows.** At 420px a variant's option text is a sentence, so label-beside-
  control squeezed the label to one word per line and still overflowed.

### Replacing a setting
`S.raw(key)` and `S.drop(keys)` exist for one job: a setting that gets replaced leaves
values behind under keys nothing reads any more, and **a per-game override is exactly
what a teacher set deliberately**, so it must be translated rather than silently ignored.
`migratePhoneModes` in `hub-engine.js` is the worked example — three booleans became one
`phoneMode` variant. Two traps it paid for:
- **The old key still being present *is* the signal that nothing has chosen yet.** Asking
  whether the new id is unset never fires on the master value, because `register()` seeds
  every master with its default.
- **`drop()` is what makes it run once**, and it runs before anyone can have picked a new
  value, so a later choice can't be overwritten.

## Skills — the procedures, separated from the history
`.claude/skills/` holds six invocable checklists. This file is the project's
*memory*; those are its *procedures*, pulled up at the moment they are needed rather
than remembered from 2,500 lines. **Which one you want follows the tiers**: a skin is
`new-game`, a question that is played is `new-round`, a way of drawing a prompt is
`new-question-form`, a bundle of switches is `new-mode` — and **writing questions in
the shapes that already exist is `author-content`**, which is the one that gets used
most, because the machinery is finished and the content is the bottleneck.
- **`author-content`** — writing questions, not code. Opens by running
  `tools/question-types.js`, because **the skill deliberately holds no list of
  question types**: a list typed into a markdown file goes stale the day a round is
  added, which is the defect class this project has paid for most. Carries what each
  game will not forgive, and the rules no check can make for you — a Connections
  decoy set has to be a coherent group of its own, an ordering scale has to have one
  defensible order, and a mistyped multiple-choice key reads perfectly normally.
- **`new-game`** — the two contracts, registration order, the layout rules, which
  suites cover a game for free, and the five-minute review for a game someone else
  wired up. Opens by saying a new game is a **skin**, not a question machine.
- **`new-mode`** — a mode is a named bundle of settings, never a second code path.
  The preset pattern, why a preset writes the switches rather than shadowing, and
  the first question: is this the game's mode or the *round's*, since a round
  declares its own and needs none of this.
- **`new-question-form`** — the two stages (lab-only vs in the kit) and why the
  isolation is structural, the render/reveal contract, declining rather than
  rendering nonsense, and the step that decides whether a form exists at all:
  authoring items for it.
- **`new-round`** — the tier above a form: a question the room *plays*. The
  form-or-round test, the contention rule for which skins can host it, `check(item)`
  and why the gate and the bench read one rulebook, and the two traps the grouping
  round paid for ("is a round clue" vs "is the round still live", and declaring
  `field` so the normaliser carries it).
- **`phone-debug`** — the six shapes every phone bug so far has taken, and the one
  question that separates them ("does the phone still show its room number?").

**The new-game review found a real defect the day it was written**: Bingo was
silently excluded from `type` mode because that variant's `games` list predated it,
while the Millionaire exclusion beside it had a stated reason. That is the argument
for the checklist in one line — the rule was already written down here, and was
still missed.

## The playground — prototypes with phones, outside the hub
`playground/` is the lane between the Learning-games repo's prototypes
(github.com/Raganther/Learning-games- — 16 solo word-game prototypes plus the
research catalog in `research/game-dynamics.md`) and the hub. A playground page is
a **standalone self-contained HTML file**: no `registerGame`, no hub engine, no hub
skin, zero risk to the teaching tool — but it borrows the **phone room** (`hub-buzzer.js`
+ the relay + `join.html`), which is game-agnostic and needs no phone-side changes
for vote/write/buzz/card dynamics. The deliberate rules:
- **Develop the game out fully here first**; port sub-dynamics into the hub loop
  only after a real classroom run. Three possible fates per game, decided later:
  stay a standalone class game, graduate whole via `registerGame`, or distil just
  its question dynamic into a `Kit.prompt` form.
- **Content lives in a marked block at the top of the file** (the prototypes'
  convention — teachers can edit it).
- **Degradation is non-negotiable**: no relay must leave the page fully playable
  teacher-only. The `playground` smoke suite asserts it.
- **Votes are advisory** (students never touch the device): they land on the board
  as counts, the teacher clicks.

**`bench-kit.js` — the middle tier, and the rule that governs it.** `hub-kit.js`
is what the *games* share; this is what the **question bench** shares. It exists
because the same code was written twice in two days: `openRoom` was nearly
byte-for-byte identical in `connections.html` and the prompt lab, and a third
question game would have made it three. It holds `BenchKit.room({mount, board,
on})` — the code, the chip, the join panel, the QR, the bench link, and
`window.HubHost` — and `BenchKit.settings(mount, defs, onChange)`, a toolbar that
builds itself from declarations, the same idea as `HubSettings` one tier down.

**The rule is: extract what is already duplicated, not what might be.** A
playground's value is that pages are allowed to be weird, and abstracting a
sandbox too early kills the thing it is for. **The second game is what moves
something onto the shelf, and Word Thermometer has now done exactly that**: it
needed teams, the clock, the mistake budget and the vote-leader, so all four moved
and Connections was rewired onto them in the same change. Rewiring the first game
is not optional — without it the "shelf" is a second copy under a new name, and
the 52 unchanged Connections checks are what prove it was behaviour-neutral.

| On the shelf | What it does |
|---|---|
| `BenchKit.room` | code, chip, join panel, QR, bench link, `window.HubHost` |
| `BenchKit.settings` | a toolbar that builds itself from declarations |
| `BenchKit.teams` | chips, add/rename, turn, scores, colours, `sizes(host)`, relay name push |
| `BenchKit.clock` | the board's countdown; `onEnd` so each game decides what expiry *means* |
| `BenchKit.mistakes` | the dots budget |
| `BenchKit.leading` | top-n options by vote — Connections wants 4, the thermometer wants 1 |
| `BenchKit.settle` | debounce + "already judged" memory, for a race with no teacher click |
| `BenchKit.modeSetting` / `racing` | the turns-vs-race declaration all three games share |
| `BenchKit.judge` | typed answers, through `HubKit.answer.judge` — right / close / wrong |
| `BenchKit.teamColour` | delegates to `hub-buzzer.js`, so the palette has one home |

**Still deliberately in Connections:** the per-team pick share (`shareFor`,
`shares`, `pushShares`, `teamPicks`) and race mode. The thermometer votes one word
per slot, so multi-pick still has one caller — it moves when a third game wants a
team to assemble a multi-part answer.

**Two things the second game taught immediately.** A shared component must not have
to know about one game's modes — `renderTeams` used to read `racing()` directly, so
the bar now takes `showTurn(false)` and a race says so rather than the bar guessing.
And **shadowing bites at the extraction seam**: `applyMode` had a local
`const clock = settings.el('vote-secs')`, which silently became a call on a
`<select>` the moment the shared countdown took that name.

Four tiers now, and knowing which one a thing belongs to is the whole discipline:
**the page** (Connections' 16-word board, the lab's form menu) · **the bench**
(`bench-kit.js` — room, settings, teams, clock) · **the round** (`Kit.round` +
`game-hub/rounds/*.js` — a question that is *played*, shared by the question bench
and every game show) · **the hub** (`Kit.prompt` forms, `registerGame`). Graduating
upward is the same two-stage isolation the question forms have.

**The round tier is the one a teacher's ideas travel on.** A question type is
authored and iterated on `question-bench.html` — card and phones side by side — and
a game show then calls it by name. That is why nothing in a round may know about
scoring, turns or tiles: those are the host's, and a round holding one could never
be plugged into a second game.

**`phone-bench.html` — the whole room on one screen.** The projected board on the
left, a rack of simulated handsets on the right; both are the **real pages in
iframes on the real relay** (phones self-join via `?auto=1&name=&team=`), so a tap
on a phone lands on the board exactly as it would in class. It exists because
**a phone dynamic cannot be judged from the phone** — what it produces lands on the
board, and testing across two tabs means never seeing cause and effect at once.
Works against any board, hub or playground, because it asks one question of
whatever it loaded: **`window.HubHost` — what room are you running?** That is now a
stated convention (the hub sets it beside `buzzHost`, the playground pages already
did), so the code is picked up automatically and never copied by hand, and the
bench needs to know nothing about which game is being played. `?board=…` opens one
straight away. Four rules paid for in advance:
- **A simulated phone never touches the seat** (`SIMULATED` guards `rememberSeat`
  and `resume` in join.html) — every iframe shares the page's localStorage, and the
  one seat key belongs to the real phone.
- **Phones are appended once and never re-parented** — moving an iframe reloads
  it, which drops its stream; only the column headers repaint on the team poll.
- **The board renders at a projector's logical width (1280) and is scaled to fit**,
  never past 1:1 — a board re-fitting itself to a 500px pane is not the board under
  test, and an upscaled one shows a size no room renders at.
- **And so does every racked phone — 390×844, scaled to the column.** The same rule,
  and it was missed on the phones for months: they were laid out at the rack
  column's 264px directly, which left `join.html` 220px for its options, under the
  288px two columns need. So a sixteen-word vote appeared on the bench as one long
  scrolling list with ten words below the fold, while every real handset showed two
  columns — **the bench misreporting the one thing it exists to show**, and reported
  as "can we stop having to scroll". A scaled element still occupies its full layout
  size, so the iframe needs a clip box with an explicit height or the card is 844px
  tall around 571px of picture. Asserted on the frame's *inner* width, not the card.
- **The phones follow the board's room.** A playground board mints a fresh code
  every time it loads, so re-opening the board left every racked phone in a room
  nobody was hosting — connected, showing a room number, and deaf to the board
  beside it. Reported as "Connections no longer interacts with the phones", and
  the tell was the phone's room number differing from the board's, exactly as
  `phone-debug` says. Re-pointing an iframe is a *deliberate* rejoin, which is a
  different thing from the incidental reload that re-parenting causes.
- **The stage re-fits on a `ResizeObserver`, not on window resize.** The pane
  narrows when a phone is added, which is not a window resize — without it the board
  kept the scale it opened with and was **clipped 115px off its right edge** the
  moment a phone appeared. The screenshot found that; the assertions had not,
  because they asked what the scale was and never whether the board still fitted.
  Same lesson as the hub's buzzer chip: *anything that changes size around a board
  owes it a re-fit.*
The `bench` suite drives all of it, including the hub as a board (start Jeopardy
inside the frame, buzz from a bench phone, assert it reaches `#phone-bar`).

**`prompt-lab.html` is retired — the bench does this now.** One workshop for both
kinds of question, three groups in one menu (rounds · forms in the kit · forms lab
only). See Current status. The paragraph below is why the lab was built and what
the bench inherited from it; the page itself is gone, and so is the `promptlab`
suite, whose surviving checks are the `forms` suite.

**What it was for.** A form could
only ever be met by finding a bank item that happened to carry its type, which is
why three of them sat at 4% of the content and a round could pass without meeting
one. The lab **lists whatever `Kit.prompt` holds** (`types()` + the new `info(type)`,
never a list kept in step by hand, so a form registered later appears for free),
draws it at board size against the hub's own stylesheet, reveals it, and reports
which of the three outcomes happened — drawn, *declined to plain text*, or no form
at all. **Ask the room** puts the same question on the handsets as an everyone-types
round and judges the replies with `Kit.answer.judge`, exactly as a game would. So a
form can be tried before a single bank item is authored for it. All of that is on
the question bench now; the `forms` suite covers it.

**A form has two stages, and the isolation is structural, not a convention.**
Experimental forms live in **`playground/lab-forms.js`**, which the lab loads and
**no game ever does** — a game loads `hub-kit.js` and nothing else. Registered in
`hub-kit.js` a form is live in every game the moment a bank item carries its type.
**Graduating is moving the block between the two files; the code does not change**,
because what is written in the lab file is already the shared contract. The lab's
menu groups the forms by stage (`In the kit` / `Lab only`), reading the set of kit
forms captured between the two `<script>` tags — the one moment the two are
distinguishable. This matters because *the playground page being separate does not
make the form separate*: `bridge` was written straight into the kit and was
therefore shipped, invisible only because no content used it. It lives in the lab
file now.

**Portability is checked, not intended.** The `forms` suite drops
`lab-forms.js` into a real hub page, starts Jeopardy, and asserts every form it
registers draws *and* reveals on a live clue card. It iterates whatever the file
registers, so a form added next month is covered without the check being edited,
and one that quietly depends on something only the lab has fails the day it is
written rather than at graduation. The procedure is
`.claude/skills/new-question-form`.

Current pages: **`connections.html`** — ESL Connections (find four groups of four;
groups encode collocations/phrasal verbs/spelling/register; solving a group unlocks
its mini-lesson). `?p=N` pins a puzzle (tests use `?p=1`). **Two ways to play the
same board**, picked from the toolbar — the first dynamic here to prove the
playground's point, that one board can host several:
- **Turns** — the team on turn votes one word each from their phones (team-scoped,
  counts badge the tiles, top four glow), the teacher locks in four tiles and
  submits; a wrong guess passes the turn and the vote moves with it; shared pool of
  four mistakes.
- **Race** — no turn: every team plays at once, and **a team's own four picks are
  its guess**, so the teacher never re-enters them. Each phone holds up to four
  words (`multi` on the arm) because a team of two could never assemble a group at
  one vote each; a team's selection is the **union** of its players' picks, which
  is what forces them to agree — six words up means dropping two. Both teams' picks
  sit on the board at once in team colours, with a live `n/4` per team. A set of
  exactly four is judged as soon as it settles (debounced, and remembered so a
  wrong four is not re-judged until it changes); a wrong four costs nothing but the
  time, because the race itself is the pressure. First team to a real group takes
  it, scores it, and the words leave the board for everybody.

## Source material & specs
- `material/empower-c1-unit-4/`, `material/empower-c1-unit-5/` — Cambridge Empower
  C1 workbook page scans (indexed by page/section) the game content is authored from.
- `docs/feedback.md` — **the classroom & test log, one entry per real run.** The raw
  record; this file gets the distilled lessons. When the user reports a run in chat,
  append the entry there *first* (template at the top), then move bugs and decisions
  into Current status as they resolve. The runs are the only data no suite can
  produce — do not let them live only in chat.
- `docs/game-hub-requirements.md` — the MVP spec (per-game content model, game tier
  analysis, success criteria). The key open metric: realistic authoring time per unit.
- `docs/design-reference.md` — DCU International Academy brand (navy/sky-blue/yellow/cream).
- `.claude/*.md` — older experimental domain notes (product vision, lesson pipeline,
  activity schemas). Reference only; not required reading.

## Current status
- **One wording for the two slot-round modes, and a mode row tells the truth in a
  solo room.** Asked as "shouldn't the defaults change between team and individual
  mode?" — they already did, at play time (`roundModeOf` downgrades a whole-team
  mode to the solo one, the teacher's override outranking it); what was wrong was
  the *display* and the *names*.
  - **`Kit.round.mode` — the shared pair.** `first`/`agree` appear in three
    rounds and were six hand-written labels for two ideas, drifted the day they
    were written ("to spell it" / "with the right answer" / "to order it"). The
    behaviour was always shared (`poll`/`agreement`); now the words are — choice,
    anagram and scramble pick `[K.round.mode.first, K.round.mode.agree]`, so
    every mode row reads identically and a teacher learns one vocabulary.
    Ordering keeps its own labels: its modes are genuinely different things.
  - **`stateNote` on a settings def** — an optional hook `buildRow` draws as an
    advisory line, evaluated at render time because the reason is a live fact
    about the room. The round rows use it: in a solo room a row stored on the
    whole-team mode says `A room of individuals — playing as "First team with
    the right answer takes it"`, mirroring `roundModeOf`'s conditions exactly
    (including standing down when the teacher explicitly overrode to the team
    mode, which really does play as agree in solo). Shows everywhere rows show:
    panel, drawer, TUNE pill, bench pane.
  - Proved on the bench: three rounds' selects read identically, zero notes in a
    teams room, three notes in solo naming the resolved mode, and one
    individual's tap taking an MC tile — the downgrade the note describes. 5/5;
    `qbench,anagram,settings,scoping,bench` 204/0. No stored value moved: ids
    (`first`/`agree`) are untouched, only labels changed.
- **The room bench has the rules board — a tune pane beside the projector.** Asked
  for by name: the bench is where all testing and tuning happens, and the only
  tuning entrances were inside the scaled board iframe (⚙, the card's TUNE pill) —
  small, and only reachable mid-question. The pane shows, for the game being
  played, every round's mode and the game's quick rules, each row saying whether
  it is the default or a customization, editable in place.
  - **The rows are the board's own settings rows**, rendered through the frame by
    `HubSettings.renderOnce` into bench-side mounts — the `HubTeams` reach-in
    pattern — so a row here and a row in the ⚙ drawer can never disagree, and a
    round or quick setting registered next month appears with nothing edited.
    `renderOnce` deliberately, never `renderFor`: that would steal the Lab
    drawer's single live-refresh slot.
  - **What you set here is what a real lesson gets, and that is the point.** The
    pane writes ordinary per-game overrides into the same stored settings the
    teaching hub reads, so bench tuning persists across sessions and into class.
    The pane's label says so. State lines tell "this game's own default" from
    "set for this game", with reset per row.
  - **One tab per game, derived from the registry**, with a dot on the one the
    board is playing; the tab follows the board's game (`HubGames.active()`, a
    new one-line export — `activeGame` was closure-private), and a hand-picked
    tab holds until the board changes game.
  - **The `.settings-*` styles are a declared mirror of hub.css**, scoped under
    `#tune-pane` — the bench cannot link hub.css whole (it restyles the page
    body), and the switch track is the load-bearing part: without it a toggle is
    an invisible checkbox. Same convention as the question bench's card metrics.
  - Open by default, toggled by a Tune button in the bar, remembered in
    `engishism.benchTune`. The board refits itself around the pane through the
    existing `ResizeObserver` — no wiring.
  - Driven end to end: the pane follows the board to Jeopardy, ordering shows its
    own default, flipping Drag the Letters to `first` from the pane writes
    `round_anagram@jeopardy`, flips the state line, and the very next drag card
    plays first-tap on a live handset; reset restores agree. 10/0 scratch;
    `bench` suite grew four checks, 48/0.
- **Solo seats survive a relay restart now — every deploy was silently collapsing
  a live solo room onto competitor 0.** Reported mid-test as "the card says Ana
  has it regardless of who gets it", one finisher per question, no late pays —
  right after a deploy, with the room number still matching (the host recreates
  its room under the same code).
  - **The cause was the epoch-recovery path missing one memory.** `roomForgot()`
    voids every told-the-room record — the last ask, the team names, the replies,
    the bingo hands — but not `soloSeatAt`, the map of which competitor each phone
    was last told. Rejoining phones re-register with their page-load team (0 for
    a bench rack), `seatSoloPlayers` trusts the stale map and re-sends nothing,
    and every answer from every phone arrives as competitor 0's. The "seat never
    comes back to the host" trap, met a third time.
  - **Why it hid**: with *unscored* competitors a mid-resync roster dip trips the
    drop path, which already clears the map — so the simple repro self-heals. A
    scored competitor is never dropped, so a room where people have points (any
    real lesson) has no accidental clear. The repro primes scores first for
    exactly this reason.
  - One line in `roomForgot()` (clear `soloSeatAt`; keep `soloSeat`, the host's
    own record of who owns which row). Proved both ways with a live
    kill-and-restart under three scored phones: broken build says "Ana has it"
    to Ben's answer with zero moves; fixed build names Ben and Cara and pays the
    late 2nd. The rename was innocent — diagnosed against it first.
  - **Noted, not fixed: the teams-mode analogue.** A phone reconnects with the
    team from its page-load stream params, not the side it was later moved to;
    the same audit is owed there.
- **The round adapter lost its `j` prefix — `jGroup*`/`jRound*` are `round*` now,
  and three misfiled handler blocks went home.** First prequel step of the skins
  split (three-seam plan, stage C). The ~750-line shared adapter every board calls
  wore Jeopardy's prefix because that is where the clue card grew up, which made
  shared code read as one game's and would have made every extraction look like it
  was taking Jeopardy with it.
  - **Pure rename, no behaviour**: `jGroup`→`roundState`, `jGroupLive`→`roundLive`,
    `jGroupOf/Open/Ctx/Take/End`→`roundOf/Open/Ctx/Take/End`, `jRoundDef/Id/Cap`→
    `roundDef/Id/Cap`, `jRoundPayout`→`roundPaySlot` (the name `roundPayout` was
    taken by the PAY_RULES sum), `jPayLate`→`roundPayLate`, `jOpenToAll`→
    `openToAllNow`, `renderJGroup(Button)`→`renderRound(Button)`.
  - **Two string literals deliberately kept**: `'jGroupWho'` and `'jRound_'+id` in
    `migrateRoundSettings` are *storage keys of old builds* — renaming them would
    orphan every teacher's saved override, the replace-a-setting trap.
  - **`roundCommit` moved beside the adapter** (it sat in the Jeopardy region);
    `#bb-ask` went to Blockbusters, `#k-commit`/`#k-next` to Quickfire, and the
    two Bingo buttons out of the bottom of the Race block. Function declarations
    hoist, so motion inside the closure costs nothing.
  - Skills checked for rot the same hour: `new-game`, `new-mode` and `new-round`
    all named the old symbols and were updated.
  - Proved behaviour-neutral: `grouping,qbench,millionaire,fit,phone,card,turns,
    gameshow,lab,registry,competition` **499/1**, and the one red is the known
    ordering-climb overflow (726px on a 720 board), unrelated and deliberately
    still red.
- **Every point movement says why — the score receipt, second stage of the
  three-seam plan.** The report used to *diff* scores and infer, which is exactly
  how an unexplained 600 stays unexplained: five paths bypassed `award()` entirely
  (the ± buttons, reset, Jeopardy's deduction, the final-clue wager), and the
  report only opened entries when a *round* opened, so a plain tile or a teacher's
  correction landed as an unexplained gain on someone else's row.
  - **`ledgerNote(team, delta, why)`** writes a move into the open report entry;
    with none open it opens a `between questions · <game>` entry, so nothing ever
    lands unattributed. **Noted before the score moves, always** — a note that has
    to open its own entry snapshots `before` as it opens, and a snapshot taken
    after the movement would swallow it, a false alarm made by the instrument.
  - **`award()` gained `opts.why`** and notes its own arithmetic — `· steal ½`,
    `· streak ×2` — because a report reader cannot re-derive a half from settings
    that may have changed since. The ten call sites name themselves: `tile 400`,
    `daily double bet`, `hexagon`, `rung 800`, `bingo square · Ana`, `word ·
    verdict`, and the late pay cites the record — `Podium · 2nd · 3.4s`.
  - **The five bypass paths note directly** (they stay outside `award`, which
    never subtracts by design): `teacher correction`, `points reset`, `wrong
    answer · deduction rule`, `final clue · bet won/lost`.
  - **The discrepancy check is exact now**: sum of a team's moves against its
    actual gain, red on mismatch — so anything that still bypasses the ledger
    names *itself*. Old entries without moves keep the expected-diff fallback.
    Quickfire's null-expected gap closes for free, since its moves carry the rule.
  - Driven on the Lab board with two handsets: a plain tile, both ± buttons, a
    deduction, an MC round paying a slot winner and a late 2nd, a reset — seven
    receipt lines, zero discrepancies, and a tampered move going red proves the
    check can fail. 9/9; `classic,standings,jeopardy` 65/0.
  - **This is the instrument the next class carries.** Clear the ledger before
    the game; if the 600 recurs, its receipt line names it.
- **A stale page announces itself — the reload chip, first stage of the agreed
  three-seam plan** (deploy seam · money seam · file seam — the plan came from a
  first-principles review; the receipt and the skins split are the next two).
  Twice in one session a "bug" was a browser running an old build in memory: the
  shell asks for the old `?v=`, gets its own cached assets, and ⚙'s build stamp
  agrees with the lie because it reports what the shell *asked for*.
  - **The page checks for itself** — its own stamp read off its script tags
    against a `cache:'no-store'` fetch of its own HTML. Both sides derived, so
    there is nothing new to keep in step. Once ~10s after load, then on returning
    to a visible tab, throttled to five minutes.
  - **Offers, never forces.** A fixed pill bottom-left: `new version · tap to
    reload`, the title naming both builds. Fixed-position on purpose — anything
    occupying layout space above a board owes it a re-fit, and this chip can
    appear mid-lesson.
  - **The tap navigates with `fresh=<new stamp>`**, existing params preserved —
    a *different URL* is what defeats an in-app browser's cache, where a plain
    reload hands back the same stale copy. The room memory is localStorage and
    survives untouched.
  - Lives at the bottom of `hub-buzzer.js` — the one file 9 of the 11 stamped
    pages load (`phone-bench.html` and `dev.html` are dev-only and skipped).
    Inert on `file://` (no server to be newer), under the suite
    (`HUB_BUILDWATCH_ANYWAY` opts in — the `?rack=auto` shape), on an unstamped
    page (no build to be stale against), and on an unreadable fetch (unknown is
    not stale).
  - **check-syntax's stamp check stopped carrying a list.** Four hand-typed
    shells had already drifted once; it walks every stamped page now (11 found),
    keeping the date-shaped pattern because `classic.html`'s `?v=picture` is a
    content selector. Proved both ways — a doctored playground stamp fails by
    name.
  - Driven end to end on the relay: stamp bumped on disk under a live page, chip
    up at the first look, tap navigating with params and room key intact, no chip
    once the stamps agree. 9/9.
- **The final question is off Classic's list — `jFinalQuestion`, default off, no
  bundle writes it.** The first ef-2a class met it by accident (Classic persisted
  from a test), it confused the room, paid everybody, and swallowed the winner
  screen. Renamed from `jFinalRound` so the values Classic wrote onto devices die
  with the old key (`drop`, the replace-a-setting pattern — a live key cannot be
  force-dropped without clearing a teacher's deliberate choice on every load; the
  id `jFinalClue` was taken by a function). The feature itself is intact behind
  the toggle; the suite drives it by setting it explicitly. `classic` 37/0.
- **The first ef-2a class came back with three bugs; two are fixed, the third has
  an instrument.** Team mode, Jeopardy, real phones. The reports: a team badged
  and paid 1st on Drag the Words that the room watched come last (they completed
  first but *wrong*); a team's completed word never showing on the card, twice;
  and 600 paid for 2nd place on a 500 card, mechanism unknown.
  - **The arrival stamp erased the order.** `jGroupStamp` keyed a team's answer on
    the **sorted** pick set — right for a set round, where re-ordering is the same
    answer, and exactly wrong for the drag rounds, where the order IS the answer:
    a wrong-order completion and the right order have the same sorted key, so the
    early stamp survived the fix and the record placed them 1st. The drag rounds
    declare **`ordered:true`** now and `jGroupKeyOf` skips the sort for them — the
    same key also feeds the settle memory, which had the same flaw (a second wrong
    order was never re-scolded). Proved with two live handsets: wrong-first team
    badged 2nd, right-first team 1st.
  - **Close inside the ~700ms take beat no longer skips the payout.** The win is
    payable the instant it lands (`jRoundWin` set before the beat, not by it); the
    beat is only the visual hold. The suite's own drive hit the old guard again
    before the fix did.
  - ~~**The drag rounds default to `first` on team boards**~~ — **shipped for one
    day and reverted at the user's decision after testing it.** In `first`, one
    phone's correct letters light the card immediately, which reads as the round
    ignoring the team; the user chose the agreement dynamic back as the default
    and accepts the cost it was traded against (in `agree`, a team that splits
    the spelling shows nothing until every member holds the whole word — the
    ef-2a report). Both trades are one tap apart now: the TUNE pill's mode row
    offers `first` per lesson. Proved back with two handsets on one team: one
    phone completing alone takes nothing, both completing takes it.
  - **The score report — `window.HubReport`, and a quiet "score report" button on
    the standings screen.** One ledger entry per question: scores as it opened,
    scores as the next opened, the results record and the expected payout when the
    slot paid. Actual gain vs expected per team, discrepancies in red — built to
    catch the unexplained 600, which is **still unreproduced**; the next class
    carries the instrument. Persisted in localStorage (`engishism.scoreReport`,
    capped 200), cleared only from the report screen. Verified live: the repro
    lesson's entry reads `Team 2: +100 (expected +100) · finished 1st at 5.6s`,
    zero discrepancies.
- **A third coursebook: `ef-2a.js` — English File Unit 2A "Spend or save?", authored
  from the user's photographed pages for a team-mode class run.** Jeopardy only,
  deliberately: the unit exists for one lesson's test and a unit only shows the
  games it has a bank for. Seven categories in section 2A — three plain-form
  columns (Money Verbs, Bills & the Bank, Perfect or Past? — gap/errorfix/
  oddoneout mixed) and four round columns (Connections, Drag the Letters, Drag
  the Words, and The Scam as Multiple Choice, from the "Hi Mum and Dad"
  WhatsApp-scam reading's own vocabulary). Covers the vocabulary, the grammar
  focus and both readings; the pronunciation spread has no column yet. Content
  gate 21/0; driven once in a browser (board builds, kind chips right, a
  Connections tile plays). **The questions themselves have not been looked at on
  the bench — the class run is the audit.**
- **The tune chip — the settings that matter for the open question, on the card
  that shows it.** Asked for because the settings view is long and mid-experiment
  the drawer is a filing cabinet: a small TUNE pill on the clue card unfolds the
  open round's own mode row plus every setting registered `quick:true`
  (`roundOpenToAll`, `crowdReveal`, `roundWinBanner` on day one). On by default,
  the user's call; `roundTune` hides it for a lesson.
  - **A shortcut to the drawer, not a second settings system.** The rows are the
    drawer's own `buildRow`, rendered through `S.renderOnce` — added precisely so
    the chip cannot steal `forMount`, the drawer's live-refresh slot — and a change
    is the same per-game override. The contents are derived twice over: the mode
    row is `round_<id>` of whatever round is open, and the rest come from
    `S.quickIds()` — a setting joins the chip by declaring, never by editing it.
  - **Inside `#clue-back`, not on `#clue-card`, and it shipped wrong first**: the
    card is a 3D flip context whose faces carry the counter-rotation, so a child
    of the card itself renders mirrored — the button read "ƎNUT". Everything
    readable lives on a face. The panel also carries the drawer's dark-surface
    text rules, because inside the face it inherits whatever the theme painted
    there (ghost-white-on-white under the game-show skin, screenshot-caught).
  - Hidden under 760px — no width, and nobody tunes a lesson from a handset.
    Verified on the Lab board: the thermometer's card lists its mode row first,
    and flipping it from the chip stores `round_ordering@jeopardy` exactly as the
    drawer would.
- **Blockbusters wears its team edges — `bbEdges`, continuous zig-zag ribbons
  following the hexagons' outer contour.** Asked for as formatting: the legend
  *says* yellow crosses left→right and blue descends, and the board itself never
  did. A yellow band down each side tracing the rows' in-and-out stagger, a blue
  chevron band along the top and the bottom tracing corner–tip–corner of each
  boundary hex.
  - **One div per band, clipped to a polygon the layout computes** — the inner
    path hugs the silhouette a breath off the faces, the outer path is the same
    points shifted out by the band thickness (0.18×hex). Traced from the same
    measured hex width the board is laid out from, so the bands re-place on every
    fit; `pointer-events:none`, quieter than a claimed hex (frame, not state).
  - **The first cut was separate teeth — small hexes beside each row — and the
    user's correction was explicit**: a line following the contours, not discrete
    markers. The side silhouette needed no geometry beyond each row's two left
    corners: a staggered row's corner is diagonally adjacent to its neighbour's,
    so joining the corner list gives the diagonals for free.
  - Toggle in the Blockbusters group, default on. The wrap grows by one band
    thickness of padding all round (627px of 720 at 1280×720, screenshot-checked).
  - **Trap paid on the way**: a `sed` renaming the test's CSS class also renamed
    its screenshot path, so the "after" look was the *before* image — diagnosed as
    the fix not working when the fix had never been looked at.
- **The standings shuffle — the screen opens on the old order and glides to the
  new.** Asked for by name: the arrows *describe* the movement, and what was wanted
  was the movement itself — for a beat the rows sit where they were before the
  question, old slot and old place number, then everything slides home.
  - **Pure display, FLIP-style.** The DOM is built in the *new* order as before;
    each row is translated back to its old slot (rects measured off the final
    layout, so the column flow needs no knowing), held 1000ms with transitions off
    (`#standings-rows.shuffling`), then released onto a 1400ms transform transition — slowed from 650ms on the user's first look.
    The old slot is the row's position sorted by `standingsRank` — the same record
    the arrows read — so nothing new is stored and nothing downstream can read the
    old arrangement as data. Old place numbers ride in the old slots and flip to
    the new ones at release. Arrows and gains stay visible throughout: the before
    picture annotated with what is about to happen.
  - **Guards, each one a paid-for lesson**: skipped when nothing moved and on the
    first showing (no previous ranking — nothing to arrive from);
    `prefers-reduced-motion` honoured in JS and CSS both; the release is
    sequence-guarded (the `resultSeq` lesson) so a stale timer cannot release a
    later shuffle early; and **skipped under `navigator.webdriver`** — the suite
    reads place numbers off the rows and for 0.9s they are deliberately old.
    `window.HUB_SHUFFLE_ANYWAY` opts a check in, the `?rack=auto` shape.
  - `standingsShuffle` toggle (Questions group, default on). Driven on the Lab
    board: first standings no shuffle (correct — nowhere to arrive from), an
    overtake shuffles — held frame screenshot shows the old order wearing old
    numbers with the arrows announcing the move, settled probe shows the new order,
    transforms cleared. **Found on the way, worth knowing: Close pressed inside the
    ~700ms take beat skips the payout** (`jGroupTake` defers `jRoundHold` and the
    timeout's `!jGroup` guard sees a closed card). Drove the check wrong before it
    drove it right; a teacher clicking Close within a second of the win would hit
    it too. Not fixed — noted.
- **The crowd reveal — what the room collectively knows fills in on the card,
  `Kit.round.crowdKnown`.** The user's own design, asked for after testing the crowd
  picture with 16 handsets: in team play a team's correct letters are readable off
  its lane and teams behind learn from teams ahead; above the lane ceiling that
  dynamic vanished with the lanes, and copying it directly would hand one fast
  player's answer to fifteen rivals. So the reveal is **collective**: a part of the
  answer fills in only once **≥X% of the room** has it — at
  which point it is nobody's secret. Self-balancing (easy parts surface, hard parts
  keep their value), and a live diagnostic of what the class does not know.
  - **Three rules, all in the shelf helper so no round re-derives them.** Big rooms
    only (>5 competitors — a count, never a mode; ordinary 2–4-team play is
    untouched, decided with the user). **Never the last part**, the hint button's
    own rule, and the cap counts hint-given parts too, so hints and the crowd can
    never jointly spell the whole answer (least-held parts dropped first). The
    threshold is the host's: `crowdReveal` range setting (Questions group, default
    40%, 0 = off, tunable mid-lesson from the drawer), lent through `jGroupCtx` as a
    fraction — **absent means the shelf's default, 0 means off**, which is what
    lets the bench inherit it with no wiring.
  - **Four rounds read it at render time; Multiple Choice is excluded
    structurally** (one part is the whole answer). The drag rounds count a position
    from `arrangement()`'s `got` against `mustHold`; grouping counts teams currently
    holding an in-group word; ordering's race counts teams past each rung — its
    lanes fill sequentially, so the revealed rungs are a prefix, drawn on **one
    shared reference ladder** above the crowd strip (`.ord-rung.hinted`, amber).
    Every revealed part wears the existing hint mark — given away, never earned
    green — so the card keeps one colour vocabulary.
  - **The share is of the whole room, not of whoever has started — and it shipped
    wrong for one build.** Divided by the starters, the first player to touch
    anything is 1 of 1 = 100%, so their first correct letter went straight on the
    wall — reported from a live 16-phone room within the hour ("Nico presses S and
    it fills immediately"). The denominator is `max(started, competitors)` now;
    `started` stays as the activity gate only.
  - Verified by fabricating a 16-solo state on a real Lab card: a 7/16 slot
    revealed, a 6/16 slot not, the reported single-starter case revealing nothing,
    a hint's slot counted toward the cap, all-held capped at need−1, and a 4-team
    room revealing nothing. **Live-handset verdict pending — the user is testing
    on the live site.**
- **Above the lane ceiling the card draws the crowd — `Kit.round.crowd`.** Reported
  from a 16-individual Drag the Letters on a real board: each finisher's name
  replaced the last on the say line, and five people having the answer left no list
  anywhere. Above five competitors the lanes correctly stood down, and what stood
  in for them was nothing.
  - **One picture of the room, two lines.** Who has *finished*, in order, wearing
    the same place pills the lanes wear (`1st Eva · 2nd Ana · 3rd Ben`, capped at
    five then `+N more done`) — and who is close, as counts
    (`Finn 5/7 · Gia 4/7 · +3 more`, capped at six). From `results.finished()` and
    the same `lane(t)` spec the lanes would have drawn, so **no round declares
    anything**: `lanes()` calls it itself above the ceiling, and ordering's race —
    sixteen squashed ladders before this — calls it by name in place of them. Two
    callers, the shelf rule.
  - **Counts only, never content — the decision made with the user before
    building.** In team play, reading a rival lane's letters is the copy dynamic;
    at sixteen individuals it hands the answer to fifteen rivals. So the crowd line
    says `5/8` and never which five. The other decided-not-built half: nothing
    special in solo below the ceiling — it is **a count, not a mode**, so three
    individuals still get real lanes and badges.
  - **The entry label is derived from the lane spec, not asked of the round**: a
    positional round (cells with gaps still open) reads `got/total`, a count string
    lends its first word, and a round with neither is just the name — which for
    Multiple Choice reads as "who has answered", the honest crowd fact there.
  - Verified by driving `lanes()` with a fake 16-strong roster on a real Lab card
    (screenshot, both lines correct). **Not yet driven end-to-end with 16 live
    handsets — the user is testing that on the live site.**
- **The card says who finished, in what order — `Kit.round.placeBadge`.** Asked for
  from a real board: the record knew who came first (`Kit.round.results`) and the
  card never said so — the say line names the first team only until the next event
  overwrites it, so the teacher was remembering the order mid-round and
  reconstructing it from the standings afterwards.
  - **Display only, one home.** A "1st / 2nd / 3rd" pill on a competitor's lane
    header the moment they *finish* (`results.finished()`, place among the
    finished), standing for the rest of the round and into the reveal. No round
    learned anything: `lanes()` appends it itself, so the five lane rounds got it
    for free, and ordering's race ladders — the one round drawing its own per-team
    header — call it by name. Two callers, which is what makes it a shelf.
  - **Its own class and its own `color`, deliberately**: it also sits in `.ord-who`,
    which carries the team colour inline, and a badge that turned team-coloured
    would read as belonging to a different vocabulary. First place gets the good
    pill; later places are quieter ink.
  - **Absent, never wrong, where the record is empty** — the question bench stamps
    no results, so no badge draws there. Wiring `results.open/note` into the bench
    is a known residual, with the crowd picture below.
  - Verified with one Playwright look at the Lab board (Multiple Choice, teacher
    path): `TEAM 1 · 1ST` on the finished lane, the other lane clean, say line
    intact. **No suite run, at the user's request — they test on the live site.**
  - **Agreed for the next pass, not built: the crowd picture.** Above five
    competitors the board stops drawing one picture per player and draws one
    picture of the room — a "who's close" strip (Drag the Letters: counts only,
    `Ana 5/7 · +12 more`, deliberately no letters at room scale) and one full-size
    shared scale with the field marked on it for the thermometer race. Decided
    with the user: counts-only, and the switch is **by size, above 5** — a count,
    not a mode, the same rule the lane cap already states.
- **The suite debt is paid, and the Classic deduction was never broken — its check
  was.** The full 19-suite set ran for the first time since the standings work:
  `standings, grouping, anagram, qbench, jeopardy, millionaire, turns, competition,
  card, classic, together, gameshow, fit, phone, registry, lab, scoping, settings,
  content` — **661/2**, and neither red is new, so the say-line fix and the ordering
  lockout fix shipped clean.
  - **The Classic red was the conversion trap, met a fifth time.** "A wrong answer
    costs the value" drove a "plain" tile on Unit 5, which is all-rounds now — and on
    a round clue the deduction *stands down deliberately*, from the same fact the
    steal does: the whole room was playing, so `missed` is only whoever happened to
    be on turn, and charging them charges the wrong people. The check is on the Lab
    board now, the documented home for behaviour that only exists on a plain clue
    (`turns`, `competition`, `phonemodes` and `jclock` all made the same move).
    `classic` **37/0**, which proves `jDeduct` fires exactly as registered.
  - **One red remains and it is the real one**: the ordering climb card at 726px on
    a 720 board, 6px over with the action strip on. A layout item, already under
    Next — not a stale test, so it stays red on purpose until the card-height work
    is done.
- **One team finishing its ladder is not the round finishing — the lockout had moved
  one tier down.** Two reports from a Word Thermometer race in team mode, one cause
  plus one thing left out.
  - **`done` means two different things to the two tiers, and it is one field on one
    object.** To a round it is "I have finished"; to the host `jGroupLive()` reads it
    as "this question is over". Ordering's `accept` set it the moment *one* team's
    lane filled, so the first finisher froze the card for everybody: replies stopped
    being read, the hints went, and every other team was locked out of a ladder they
    were half way up. **Exactly the lockout the open question exists to remove,
    expressed inside a round.**
  - **The host lends the rule, the round says which it means.** `ctx.openToAll` is a
    new fact on the ctx; ordering keeps `won` as the first to get there and simply
    stops ending the round. Only a round that one competitor can finish while others
    are still working needs to read it.
  - **A partial right answer has to re-ask the room, and the open branch forgot to.**
    The single-winner path always did — that is what refreshes each team's remaining
    pool — so a word a team had just placed stayed in their list on every handset and
    the round could not progress. Once after the loop rather than per team: an arm is
    room-wide and several teams can settle in one tick.
  - **The slot was being claimed by the first correct *rung*.** Nothing checked `done`
    before setting `hostTook`, so on an ordering race the tile went to whoever got the
    first word right rather than to whoever completed a ladder.
  - Driven with two handsets: five rungs climbed with the placed word leaving the
    phone each time (5→4→3→2→1 options), the card still open, then the second team
    climbing three rungs of its own.
  - **Drag the Words was reported alongside and does not reproduce** — three teams,
    one phone each, every lane fills and each team is named. The untested case is
    **two students on one team**, where `mustHold` in agree mode lights a word only
    once every member has placed it there; from the front of the room that reads as
    "the last word will not fill". Open question, not a fix.
  - ~~**The suite has not been re-run since the standings work.** That is the
    debt.~~ **Paid** — see the bullet at the top of Current status. 661/2, both
    reds accounted for.
- **A right answer says so again — recognising one and ending the question are two
  different things.** Reported from a Jeopardy team-mode board a day after the
  open-question change shipped: a team answers correctly and nothing anywhere says it
  was right. The round carried on, which is intended; the recognition had gone.
  - **The cause is that the two were one function.** `jGroupTake` set the line naming
    the team, played the sting, *and* paid the tile, stopped the settler and closed
    the card. Holding the question open meant it no longer ran on a right answer — so
    stopping the ending stopped the recognition with it. **The agreed change was only
    ever "don't lock the phones out" plus a shared record of order and timing; the
    rounds were to be untouched.** Half of one of them was.
  - **A second decision made it worse, and it was wrong on its own terms.** The branch
    deliberately suppressed the say line, on the reasoning that naming the winner
    leaks the answer to teams still working. It does not: no round prints *what* a
    team answered in a way that naming them adds to, and Connections already puts
    every team's picked words in its own lane whatever happens.
  - **How backwards it was:** the *second and later* right answers got a phone-strip
    note with their points. The **first** — the one taking the tile — got a sound and
    nothing else.
  - **Misses are judged before rights now**, so a right answer owns the say line when
    both settle in the same tick. "Team 2 has it" is the better headline than "Team 3
    — not that one", and with nothing taken until the teacher ends it the order costs
    nothing else.
  - **Quickfire is deliberately excluded.** It never named a team per answer — every
    competitor answers every question there, so a line and a sting each would be
    sixteen of them in twenty seconds. Its feedback is the strip and the standings.
  - **Connections needed a round-level fix; the other four did not.** Its only
    correctness mark is the four words lighting on the board, gated on `s.done` — the
    round being *over* — so it could never fire while the question stayed open. It
    marks the **lane** instead (`tone:'good'`, the same fact `choice` already
    declares). Marking the board would hand the answer to every team still hunting;
    a green lane says *they have it* and nothing about what it is. Multiple Choice
    (lane green), the thermometer (the rung fills) and the two drag rounds (letters
    and words landing in place) were all still working.
  - Driven with one handset on the Lab board: `Team 1 has it.` on both a Multiple
    Choice and a Connections tile, the question still open, the phone still live, one
    green lane and **zero** lit words. ~~**The suite has not been re-run**~~ —
    since re-run, clean; see the top of Current status.
  - **Still open, deliberately:** the phones. A handset has never had a per-team "you
    got it" — a taken round simply stood every phone down — so that is new ground
    rather than a regression, and a real teaching decision.
- **Position and time are a record, points come from a rule the board picks, and the
  standings are their own screen.** The second half of the open-question change, and
  the three tiers came out clean: the **round** says what a right answer is, one
  **shared record** says who got there and when, and the **skin** says what a position
  is worth.
  - **`Kit.round.results` — who got there, in what order, with how much clock left.**
    Before it the app knew who was first only as a yes/no and measured the time only
    to spend it immediately, so a board could pay "faster is worth more" and could not
    pay 3-2-1: **nothing anywhere ever saw that somebody came third.**
  - **Order comes from a stamp the host supplies, not from call order.** Several teams
    settle inside one tick, so the moment a reply landed and the moment it was judged
    are different numbers. The caller does sort before it iterates, so both would work
    today — and a caller added later that forgot would get silently wrong places,
    which is the kind of unfairness nobody in the room could ever explain.
  - **The teacher's own click carries no stamp and sorts *last*.** A plain counter put
    those clicks ahead of every phone answer, which is the wrong end and invisible
    until a teacher finishes a question the class had already half-answered.
  - **`done` separates getting a piece right from finishing**, which is what stops an
    ordering climb paying one question five times — once per rung.
  - **A team that must agree is placed by its last student, not its keenest.** That
    falls out of where `note` is called from — `read()` returns `poll().answers`, and
    a round only produces one once every member has committed, with the partial in
    `leading`. Pinned by a check rather than by a comment.
  - **`PAY_RULES`: winner takes all · podium · by the clock · everyone equal.** Written
    once each. **This is the answer to "how does each skin score differently", and it
    is deliberately not a function per game** — five boards each doing their own sums
    is the hand-kept list this project has paid for most, and it would leave a teacher
    unable to try a different feel without somebody editing code. A board names its
    starting rule through `defaults:{}` (Jeopardy podium, Quickfire clock) and holds
    no arithmetic at all. **A fifth rule goes in the table, never into a game.**
  - **The prize stays the board's.** `win()` still pays the tile, the hexagon, the
    rung — the rules decide points only. Quickfire is the one host that uses what the
    rule handed it, because it has no slot.
  - **Two host facts, not two mechanisms:** `worth(who)` is the base (per competitor,
    because a Millionaire rung differs for each of them) and `step()` is the board's
    own unit. The floor and the podium shares are *settings*, because those are what a
    teacher tunes and the unit is a property of the board.
  - **On a $100 tile the podium is 100/50/50**, because Jeopardy rounds every payout
    to 50 and has no smaller unit. The shares are working; the board cannot express
    them. Measured 500/300/150 on a $500 tile with three handsets, and 400/400/400 on
    `equal`.
  - **The standings screen is a sibling of every stage**, beside the clue card and the
    result banner — which is exactly what Quickfire's own leaderboard was not, and why
    it was squeezed and pushed that stage past 720px. Its measured-rows, four-column,
    "+N more" reasoning moved here and `#k-board` is gone, so every board gets it.
  - **It replaced the winner banner rather than following it.** One screen that names
    who took the question *and* shows everybody moving beats two back to back. It
    waits for the teacher rather than leaving on a timer: a table takes longer to read
    than a name.
  - **A running total cannot show movement, which is why this needed new state.** Two
    snapshots and nothing else — scores as the question opened (for the gain), places
    as it was last shown (for the arrows). Deliberately not a per-question log: nothing
    asks "what happened in question four", and a store nobody reads goes stale
    silently.
  - **`roundOpenToAll` is on by default now.** It shipped off for one build for an
    honest reason — a right answer that was not first scored nothing worth having.
    With the podium and the standings there is a reason to keep working after somebody
    else has it.
  - **Three bugs only the running code found.** The grid drew four teams as four
    *columns* because `grid-auto-flow:column` with no row template makes an implicit
    column per item — every assertion passed, because they asked what the rows said
    and not where they were. A backtick inside the injected HTML skeleton closed the
    template literal. And `standingsOpen` had to be beside `results.open()`, because a
    second call site is a second thing to forget.
  - **The standings cover the board, so the suite switches them off where it opens a
    page** — the same reason `cardFlip` and `intro` are off there. A suite that played
    a question and then clicked a tile found the click intercepted by a modal it never
    asked for. `openHub` was not enough: **`grouping` and `anagram` each build their
    own page** rather than going through it, so they needed the same line.
  - **The timing rule is proved rather than asserted, and it is the one thing here
    nothing else would have caught.** Two phones on one team, one tapping early and
    the other late, against a second team answering outright in between — the team
    that *agreed* later is placed later. Falsified by switching that round to
    first-tap-wins, where the order flips and the check goes red. `standings` 16/0.
  - **Not done:** no classroom run. Every number in it is a guess — the 60%/30% podium
    shares, the 50% floor, and above all whether a standings screen after *every*
    question is a good beat or an irritation. That last one is why it is a setting.
  - `standings, grouping, anagram, qbench, jeopardy, millionaire, turns, competition,
    card, classic, together, gameshow, fit, phone, registry, lab, scoping, settings,
    content` **661/2**, and both reds are the pre-existing pair proved by stashing:
    the ordering climb at 726px on a 720 board, and Classic's wrong-answer deduction
    not moving the score.
- **A right answer stops locking the room out, and the clock that decides what an
  answer is worth is one clock now.** Asked for as three things — every skin playable
  solo, points for how fast you were, and everyone able to finish rather than the
  first taking it — and reading the code said the first was already built and the
  other two were one change.
  - **All six skins already declared `solo: true`.** The exclusions were dropped a
    session earlier. Nothing to build, which is worth knowing before anybody plans it.
  - **`Kit.round.clock` — three private clocks were the same thirty lines.** Jeopardy's
    answer clock painting into the clue card, Quickfire's question clock painting onto
    its own stage, and a round's own clock sent to the handsets as a duration. That was
    tolerable while a clock only *said* how long was left; it stops being tolerable the
    moment a board scores by speed, because the number a team is paid from has to be
    the number the room is watching count down. Both callers rewired in the same
    change, which is what makes it a shelf.
  - **It decides nothing.** Expiry is a fact the room hears — one host ends its
    question on `onEnd`, the other pulses the card red and changes nothing, and both
    are correct. `fraction()` is 1 when nothing is running, so an untimed board pays
    face value and a curve can be asked for anywhere without every board first having
    to grow a clock.
  - **The curve is `roundValue`, and where it lives is the whole layering argument.**
    Not in a round — **a round may not score**, and a curve there would end its
    portability. Not on `Kit` either — what a question is worth is the *skin's*, and
    five games calling a shared helper by hand is the hand-kept list this project has
    paid for most. So the **host declares two facts** (`speed()` → `{floor, step}`,
    and `worth()`) and the shared settle path reads them. Quickfire's private `kValue`
    is gone and no game asks for any of it.
  - **`roundOpenToAll`: the first team still takes the slot, everybody else still
    finishes.** The slot is *held back* rather than paid at once — the tile,
    the turn, the banner and the ending are the ordinary take beat, run when the
    question actually ends (the teacher reveals, or their own Check decides it).
    Everyone else who gets there is paid `roundValue` of what the question is worth.
    Proved both ways on a board with two handsets: **off** gives `taps=pass/LOCKED OUT`
    and a final `[100, 0]`, **on** gives `pass/pass` and `[100, 50]`.
  - **It shipped on and the suite changed that, which is the suite doing its job.**
    Three games encode "a right answer takes the tile *now*" in their own assertions,
    because that is the beat those boards have always had — six checks went red, all
    of them describing behaviour rather than breaking. Holding the slot back is the
    right shape for the dynamic and it is still a change to a working game: it costs
    the teacher a press (Reveal, then Close, where a won round used to take itself),
    and no class has met it. **Off by default**, on from ⚙ during play, which is what
    the drawer is for. Every existing check passes with it off, which is the evidence
    that the shared change underneath is inert until it is asked for.
  - **The one real bug in it, and only the suite found it:** paying the right answers
    and returning skipped the miss loop, so a board holding its question open said
    *nothing* to a team that had just got it wrong — no shake, no "not that one", no
    strip note. A `scoreEach` board stays the deliberate exception: its clock is about
    to end the question for everybody.
  - **Who was first is deliberately not said out loud.** A say line naming them would
    tell thirty handsets that the answer they are still assembling is the one that team
    just sent. The lanes go on showing who has committed, which is what a teacher needs.
  - **With no clock running, late is worth the floor, flat**, which is every board but
    Quickfire: a tile is read out at the teacher's pace, so there is no fraction to
    decay against — what there is instead is "you got there, but not first".
  - **On a board that scores in single points there is nothing smaller than 1**, so a
    late right answer on Blockbusters or Race is worth the same 1. That is not the
    floor failing: what being first buys there is the *square*, which is what wins the
    game, and no number of points is that.
  - **The `jclock` suite had been running 4 checks of 13.** It opened a class-facing
    unit where every clue is a round now, so `#buzzer` sat present and disabled, and it
    hung thirty seconds and threw — taking its last nine checks. The Lab board, the
    same move `phonemodes`, `turns` and `competition` already made. 13/0.
  - **A test that cannot fail on its bug is not a test, met again.** The first version
    of the two-handset drive looked up the answer under the wrong bank key, so `right`
    was null, nobody tapped anything, and *the first two checks passed anyway* — on a
    question no one had answered.
  - **Two red checks left after it, both proved pre-existing by stashing.** The
    ordering climb at 726px on a 720 board, which already has its own item under Next
    — and a **new one**: `classic` says *a wrong answer costs the value when the rule
    is on* and the score does not move (`500/0 -> 500/0`, clue $100). Either `jDeduct`
    has stopped firing or the check has gone stale; it is not this change's doing.
    **Since resolved: the check had gone stale** — it drove a Unit 5 round clue,
    where the deduction stands down by design; see the top of Current status.
    `grouping, qbench, anagram, jeopardy, millionaire,
    turns, competition, card, classic, together` 376/2.
  - **Not done, and next:** the scoreboard is still inside `#play-kahoot` rather than
    a sibling of every stage, and `score` is still a running total with no history, so
    nothing can show a competitor rising or falling. **No classroom run**, and the
    floor of 0.5 is a guess.
- **The room bench was taking a live lesson's room, and the chip went on showing the
  code.** Asked as "should each bench and hub generate a new room number, so they do
  not get in each other's way" — the answer was yes, and it was not a precaution:
  reproduced first try, hub on `80873` and the bench's board on `80873`.
  - **The cause is a good rule meeting a case it was not written for.** The hub
    remembers its room code per *device* for six hours, so that reloading the page —
    the first thing anyone does when something looks wrong — does not mint a new code
    and throw the class out. A board opened inside the bench is the same origin, so it
    read the same stored code. The relay allows one host and the newest wins, so the
    real board was replaced on its own room while its chip still showed the number.
  - **A rig is not a lesson.** A bench board mints its own code every time and stores
    nothing; the teaching hub's memory is untouched. `bench=1` was already on the URL
    for the bench's own reasons and now means exactly this.
  - **Nothing in the suite could ever have caught it**, which is the reusable part.
    `browser.newPage()` gives every page its own storage, so two tabs of *one* browser
    — the case that matters — is the one the harness does not produce by default. The
    four new checks share a `browser.newContext()` deliberately.
  - Pinned in both directions: a hub keeps its room across a reload (the rule this
    must not break), and the bench's board differs from it. Proved by reverting —
    `bench 67855 · lesson 67855`. `bench` 44/0.
- **The solo roster only ever grew, so the bar could not follow the phones down.**
  Reported from the room bench: seven handsets racked, several removed, and the board
  still listed everybody — teams synced correctly by then, individuals did not.
  - **The rule it broke was a good one applied too widely.** "A phone that leaves
    keeps its seat" was written for a student whose battery dies mid-lesson, and it is
    right for exactly that. As a general rule it made the roster a one-way ratchet,
    and a bench that can only add is a bench that cannot mirror the room it exists to
    mirror.
  - **What that rule was actually protecting is a score, so that is what it keeps
    now.** A competitor holding points stays whatever their handset does, and their
    seat stays with them so they come back to the same row. One who never scored is
    not a lesson's work, it is clutter, and it goes with the phone. Never below the
    floor of two, which is where an empty room starts and returns to.
  - **Dropping a competitor invalidates every seat above it**, and `seat` never comes
    back to the host — so the map of what each phone was last told is a lie about all
    of them and is cleared rather than patched. Same "send unconditionally after a
    shift" the roster swap needed, met a second time.
  - Driven on the bench: 0 phones → 2 rows (the placeholders), +4 → 4 rows, remove 2 →
    2 rows, then a 2×2 preset → 4 rows. `bench` 40/0.
  - **The check nearly tested the wrong thing twice.** Removing "the first" phone took
    somebody else's, and removing "the last" did too — in solo the rack is flattened
    with `display:contents`, so DOM order still follows the columns the phones were
    added under and the newest card sits in the middle. It removes by name now.
- **Flipping teams↔solo repeatedly turned every phone blue, and the cause was on the
  handset.** The previous session's fix held for one round trip and lost it on the
  next — reported as "flip back and forth and eventually they all turn blue", and
  reproduced exactly: flip 2 correct, flip 4 collapsed onto Team 1.
  - **Three wrong diagnoses before the right one, and the pattern in them is the
    lesson.** Attempt one rebuilt the record of each student's side on every switch by
    reading the relay — which is the value *solo has just overwritten*. Attempt two
    recorded the first sighting and never rewrote it — but a join is processed in more
    than one step, so the first roster event a phone appears in can still carry team 0,
    and write-once made that zero permanent. **Both were re-deriving a student's own
    choice from a list the host itself writes to.**
  - **The relay names the joining player on its own event, and `hub-buzzer.js` was
    throwing that away.** `join` and `leave` both collapsed into one `players` emit, so
    the `{id, name, team}` the relay sends — the one moment a handset's team is
    unambiguously the student's choice — never reached the hub. It is carried through
    now; the seat path re-emits `join` with the roster alone and no `id`, which is
    exactly the difference worth keeping.
  - **And the actual bug was one line on the phone: `setSolo` zeroed its own `team`.**
    Harmless-looking, because solo draws no tag and no colour so nothing reads it
    there. What it did was make the handset disagree with the relay in a way only the
    handset knew — and **the relay tells a phone its team only when its own record
    changes**, so when the board restored the student to their side the relay saw the
    number it already held, sent nothing, and the phone stayed on 0. `team` is now
    written in exactly two places: the student picking a side, and a `team` event from
    the room.
  - **Found by instrumenting rather than by a fourth guess.** Printing `teamSeat` and
    the restore target showed the host doing everything right on every flip, which is
    what moved the search downstream. Three guesses is the point at which to stop
    reasoning and print something.
  - **A preset sets the board's team count exactly now, both directions.** `ensure`
    only ever grew, so 4×4 → 3×3 → 2×2 on the room bench left the board on four teams
    while the rack drew two — the bench disagreeing with the board it exists to
    mirror, which is the one thing it must never do. `HubTeams.size(n)` refuses to
    shrink over a running game or a team holding points **and says which**, because
    that reason belongs to a lesson in progress rather than to setting the room up.
    `removeTeam` keeps its own confirm for the human path: a dialog behind a remote
    control is nobody's idea of a question.
  - **The check that mattered most nearly did not work.** Both bench phones were on
    team 0, so a scrambled restore still landed them both on team 0 and the assertion
    passed on the broken build. The second phone joins a different side now. **A test
    that cannot fail on its bug is not yet a test**, met again.
  - Three checks in `bench`, all three proved by reverting the sources and keeping the
    tests. `bench` 38/0.
- **Going to solo and back scrambled the class across the teams, silently.** Reported
  as a cosmetic thing — every phone on the bench showing the *same* blue `TEAM 1` tag
  whatever row it sat in — and the tag was telling the truth. The phones really were on
  the wrong teams, so their answers would have scored for the wrong side.
  - **Solo seats every handset into its own competitor, which overwrites the team its
    student picked when they joined.** Coming back to teams left each phone holding
    that *index*, now pointing at whatever team happens to sit there. Reproduced
    exactly: four phones on 1/1/2/2 went to solo and came back on **2/3/4/1**.
  - **The board already keeps two rosters and swaps between them; the phones needed the
    same thing one layer out.** `teamSeat` remembers where each *player* was — by
    player id, never by index, for the same reason `soloSeat` is keyed that way — and
    the switch back re-seats everybody. Snapshotted on the way *out*, because in teams
    mode the relay's own record is the truth: the student chose it.
  - **Restored once, on the transition, and never continuously.** In teams mode the
    student owns which side they are on and may change it from their own phone, so a
    host re-asserting a team on every roster event would quietly overrule them.
  - **The first version of the fix did nothing, and the reason is worth keeping.** It
    only sent a seat "if it changed" — but `seat` does not come back to the host, so
    `p.team` there is still the value from the last *join*, which is the same number
    the fix was trying to restore. It concluded every phone was already right and sent
    nothing. The `soloSeatAt` map exists precisely because of that staleness and it
    was read as a general rule rather than as the note it is. **Send unconditionally
    on a one-off transition.**
  - **In solo a handset now carries no tag and no colour at all**, which is the user's
    call and also removes the class of bug: a colour means "this is the side you are
    on", and there are no sides. Nothing drawn is nothing that can be stale. The tag
    had been printing whatever competitor sat at this phone's index — somebody else's
    name, in confident blue.
  - Three checks in `bench`, and **both new ones were proved by reverting the fix while
    keeping the tests** — the round-trip one reports `BEN TEAM 2 · started BEN TEAM 1`,
    which is the bug in one line. `buzzers, phonemodes, joinbar, degradation, bench,
    qbench` 257/0.
  - **One flake found on the way, and it was load rather than a defect.** Race's steal
    check went red once inside a nine-suite sequential run and never standalone — the
    re-arm had not reached the handset within the 8s the poll allows. The check was
    left as it is; what was wrong is that the *click* on the next line then threw on a
    disabled button and took the rest of the suite, which is the abort pattern this
    file has now paid for three times. Guarded, so a slow relay costs one red check.
- **A room of individuals has no rows, and the room bench was drawing them anyway.**
  Reported from the bench: switching the board to solo left the rack grouping phones
  under headers, so a header reading **"Ana" sat over a row holding Ana, Ben and
  Carla**. Reproduced exactly before touching anything.
  - **The cause is that in solo the board's "team names" *are* names.** The roster is
    people, so `/buzzer/room` returns `["Ana","Ben","Carla"]` where it used to return
    `["Team 1","Team 2"]`, and the rack drew that list the only way it knew. **It
    cannot be inferred from the shape of the list** — "Ana, Ben" is a perfectly good
    pair of team names — so the bench reads the room's `solo` flag, which the relay
    has carried since the join screen stopped asking which team. No relay change.
  - **Flattened with `display:contents`, and that choice is the whole point.** Moving
    every phone into one container would have re-parented the iframes, and
    re-parenting an iframe reloads it and drops its stream — a switch mid-room is
    exactly when you least want thirty handsets to blink out. The columns stay where
    they are and stop generating boxes, so each `.phone` becomes a grid item of
    `#rack` itself. **Proved rather than asserted**: every racked handset is stamped
    before the switch and still carries its stamp after.
  - **The team picker goes with the rows**, because in solo the board seats a joining
    phone into its own competitor and anything picked here is overwritten a moment
    later — a control that is silently ignored is worse than an absent one. A preset
    becomes a **head count** rather than a division, and must *not* ask the board to
    grow its team bar: in solo the roster builds itself from whoever joins, so
    `HubTeams.ensure` would plant empty competitors nobody put there.
  - **The status line says `· individuals`**, so a rack with no headers reads as the
    room it is rather than as the headers having failed to draw. Same rule as a game
    card naming what it is not showing.
  - **The handset had the same slip, and only the screenshot showed it**: with no
    teams in the room it still offered "Not you? Change name **or team**", over a
    join screen that no longer asks for one. `setSolo` already hid the picker; it
    words the way back now too.
  - Four checks in the `bench` suite, driven as a switch under a live rack because
    that is the case with something to lose. `bench` 33/0.
- **The suite had stopped describing the app, and one stale selector was hiding
  sixty checks.** Five red checks, and **not one of them was a bug in the app** —
  every one was a check still asserting a picture that had been deliberately
  replaced. That is the whole finding: a test that goes stale does not merely stop
  helping, it **actively lies**, and a green-looking partial run is what lets the
  next one through.
  - **`phonemodes` was running 2 checks of 80.** It aborted at the third, on a
    Jeopardy `write` clue — Units 4 and 5 are all-rounds now, so the round arms the
    handsets and `round_default` correctly never gets a look in. **The suite had been
    reporting "2 passed, 2 failed" as though that were the whole of it.** The fix is
    the one already recorded for `turns` and `competition`: the Lab board, whose
    plain categories are not class-facing and so will not be converted out from under
    a test. `openRoom` takes `{lab:true}`. **80 passed, 0 failed.**
  - **`.innerText()` on a locator matching nothing waits thirty seconds and then
    throws — and the throw happens while the *argument to* `check` is being built,
    so it takes every remaining check in that suite with it.** That is the mechanism
    behind both aborts, and it is worth knowing before writing another check.
    `textOf()` is on the shelf now: `allInnerTexts()` resolves immediately with `[]`,
    so absence is one red check in milliseconds instead of an abort. Reach for it
    whenever a check asks *whether* something is drawn.
  - **The qbench tally: the element was genuinely gone, and correctly.** Multiple
    Choice joined the lane standard and lost `.group-tally` with it — in `agree` mode
    the fraction is on the lane header beside the team's name. Proved by driving the
    bench rather than by reading: four phones, two teams, one tap, and the card holds
    `Team 1 1/2` with no tally anywhere. The fraction is `.rl-agree` now rather than
    a bare `<small>`, because the only handle on it was a tag name.
  - **`openHex` was never the coin toss this file claimed.** LB1 is exactly 18 items
    and the board is exactly 18 hexagons, so every named clue *is* dealt; the note
    described a selection the test does not make. The real fragility was an **open
    card** — a caller that revealed a clue and left it up made the first hexagon
    click a no-op and the loop read the *previous* clue, which would have reported
    success the day that clue happened to match. It closes what is open, counts the
    hexes, and **asserts the precondition**: if LB1 outgrows the board the suite says
    so by name instead of failing three checks at random.
  - **`mBuzzRole` is retired.** It asked what a buzz wins in Millionaire, which was a
    real question while a rung was an ordinary clue. The ladder hosts a round: a live
    question puts four options in every hand, and between questions nothing is open
    and a buzz is refused. So it could not fire in either state, and **a control a
    teacher can pick that changes nothing reads as a broken game rather than as an
    absent feature.** Dropped with its stored per-game values, and both dead hooks
    (`buzzEntitled`, `onBuzzTaken`) went with it — a no-op is the correct state here
    and is now stated as one.
    - **What is *not* decided by removing it:** a buzz that picks who speaks for the
      team **before** the round takes the room. That is what `speaker` was always
      for, it is a new beat rather than that switch, and it needs a classroom
      question first — whether naming a speaker is wanted on this board at all.
  - **A fourth stale check, found on the way, in `settings`.** The master row's
    "overridden in millionaire" was reworded to "Has its own value in …" *with a
    comment saying why it must not say overridden* — a game can differ because a
    teacher set it or because it registered its own default. The check had been red
    since. It asserts the marker and the game's name now, not the sentence: **pinning
    prose pins the wrong thing.**
  - **Two sleeps that were coin tosses, and one that still is.** A tap has to reach
    the relay, come back and redraw the board, so `until(fn)` polls instead of
    guessing a number. And two checks tapped whichever option the shuffle put first —
    a right answer from the only phone on a team wins the question outright, so they
    passed or failed on the shuffle. They pick a wrong option on purpose now, which
    is the fix the block above them had already been given and documented.
  - **Two more of the same family, found by running the wider set and both proved
    pre-existing by stashing.** The `bench` suite threw clicking `#buzzer` on a racked
    phone — a hub tile opens a round, so the button is there and disabled; it taps
    whatever the tile actually put in the hand now. And `joinbar` asserted the chip
    against a **fixed list of phrases** (`idle here|votes only|cards on phones`),
    which Millionaire stopped matching when its ladder became a round host. It asks
    the game for its own `roomNote()` instead — and deliberately does *not* restate
    the engine's fallback for a game that declares none, because that would be a
    second copy of one expression, which is what the phrase list already was.
  - `phonemodes` 80/0, `settings, millionaire, registry, scoping, lab, card,
    gameshow, anagram` 181/0, `bench` 33/0, `joinbar, degradation` 30/0,
    `buzzers, reconnect, teamvote, phonebingo, typetobuzz, playground, qbench` clean,
    `qbench, grouping` 197/2 — **and both of those two are pre-existing**: the
    ordering climb at 726px on a 720 board (its own item under Next), and one
    `ERR_CERT_AUTHORITY_INVALID` from the sandbox proxy that did not reproduce on the
    previous run. Every fix above was proved against the base build by stashing,
    which is how the `settings`, `bench` and `joinbar` ones were shown not to be mine.
  - **With those, every red check named in this file is closed** except the climb
    card's overflow, which is a layout item rather than a stale test.
- **Bingo is the eighth round, and the contract addition it needed is built —
  `ctx.keep`, state that outlives one question.** Build-order item 5, and the thing
  most of "what the container makes possible" was waiting on. **Partly proved: the
  cards and the marks work on a board; advancing to the next call does not.**
  - **`ctx.keep` is the host's store, keyed by player id.** Every other hook is
    handed one question and forgets it, which is right for a question and wrong for
    anything a *student* carries — a card, a hand, a role, a personal scorecard.
    Keyed by player id because that is the only identity that survives a phone
    dropping off the wifi; scoped to the round type, so a bingo round keeps its cards
    across all its own calls; cleared when a game starts.
  - **`cardsByPlayer` on the arm is the wire half.** A round cannot send the relay
    its own messages, so the card and its marks ride the arm that was going anyway —
    and a round updates a mark by *re-arming*, which is why the `armed` payload
    carries the card now and not only `joined`. The relay's own `deal` path is
    unchanged and both go through one `dealCards`.
  - **One authored item is a whole game of bingo, not one call**, because a card is
    drawn from a pool and the pool is only knowable if the item holds every call. The
    pool is the answers, not a second list to keep in step.
  - **The board is not thirty cards.** It shows the call, which words have gone, and
    who is close — the only thing a projector can add when the card is in every hand.
    `Kit.round.lanes` is deliberately not used: a lane draws a team assembling one
    answer, and there is no assembling here.
  - **Proved on the Race board with two handsets**: each phone dealt its own nine
    words, the two cards differing; a tap on the called word marked it; the board
    read `Ana 1/9 Ben 0/9`, which is the mark coming back out of `keep`. The relay
    half is proved separately over raw HTTP, including a mark landing on a re-arm.
  - **The host was writing into the round's state under a name the round already
    owned.** Reported as Next call jumping straight to the end: pressing it once left
    the card reading "All 12 called". `jGroupStamp` — the arrival-order stamp added
    for the solo first-answer fix — stored itself as `jGroup.at`, and this round uses
    `s.at` for which call it is reading. The host quietly replaced a number with a
    map, and the next `s.at++` produced `NaN`.
    - **Nothing could have warned about it.** Two files writing different meanings
      into one field on one object is a collision only a name prevents, and it was
      invisible on the bench because the bench does not stamp arrivals.
    - **The rule, now stated: anything the *host* stores on a round's state carries
      `host` in its name** (`jGroup.hostAt`). A round's own fields are the round's to
      choose freely, which is the whole point of handing it a state object.
    - Found by printing `s.at` in `press` and `render` — the value came back as `{}`,
      which is not a thing any code in the round could produce.
  - **Played through on a board with two handsets**: twelve calls, each phone tapping
    when it held the called word, the counts climbing independently, and Ana lining
    up three at call four — `Ana has it`, one point, the round over and Race moving
    on. Also: `roundPress` re-asks the room through `currentClueItem`, which Race
    never set. Fixed on the way and not the cause.
  - **Bingo the skin still runs its own implementation.** Moving it onto the round is
    the second half of the job and is not started.
- **Every board hosts a round now — Race is the fifth host, and the audit found the
  other two were never the gap they looked like.**
  - **Millionaire and Quickfire already accepted any round.** Both call
    `jGroupOf(asRound(item))`, and `asRound` hands the item straight back when it
    carries no `distractors` — so an item with a `group:` or `order:` field would be
    hosted today. They only ever *see* Multiple Choice because that is all their
    banks hold. **Content, never wiring**, which is worth knowing before anybody
    plans work on it.
  - **Race was the one real gap, and it needed the mount rather than the card.**
    Race owns the card — the scattered words *are* the answer surface — so a round
    here gets `#race-round` under the prompt, the same declared fact Millionaire and
    Quickfire use. A host is still four facts plus two calls: `ROUND_HOSTS.race`,
    then `jGroupOf`/`jGroupOpen` where a prompt goes up.
  - **One bank, both kinds.** An ordinary item puts its answer on the board as a
    tile a student runs to touch; a round item has no single answer, so it
    contributes no tile and is played on the handsets while the board waits.
    `buildRaceBoard` splits them — the board from the words, the queue from
    everything — which is what lets the two mix at all.
  - **The content gate had to learn the same split.** It checked every race answer
    for one-word-and-unique and a round has none, so it reported "answer would need
    two tiles — undefined". Rounds stand down from the tile rules exactly as they do
    from Blockbusters' one-word-and-initial rules; their own shape is `check(item)`.
  - **`LR1` on the Lab board is the first mixed section** — seven words to touch and
    three rounds to play. **The rule no check can make for you: no word in a round
    may be a word on the board.** The first draft had a Connections set holding
    *appeal*, *verdict* and *custody*, all three of them tiles, so the round pointed
    at the answers to other sentences. The gate cannot catch it — it is about what
    else is in the bank rather than about the item.
  - **The round palette is declared once now, on `body.theme-gameshow`.** Only the
    clue card had ever set it, so a round on any *stage* fell back to the light theme
    defaults — Millionaire papered over it with its own gold block and the next two
    stages inherited nothing. Custom properties inherit, so a sixth stage is correct
    the day it exists. Same lesson as a theme naming one round's word tiles, one tier
    up.
  - **Bingo is the one board that still hosts none, and that is the design.** Every
    phone already holds a card; a round would be a second dynamic fighting for the
    same handsets. It could host one card-only with the teacher clicking, which is
    the no-relay path every round already owes — worth doing only if somebody wants
    it.
  - Driven on the relay: seven tiles on the board and none from the rounds, a round
    opening on the prompt strip, four options reaching a handset, the claim chooser
    standing down while it is live, and the card reading on the green track.
- **Solo plays first-tap-wins, each mode keeps its own roster, and a win goes to
  whoever was first rather than to the lowest index.** Three reports in one.
  - **A board's `teamMode` ask only means anything in a room of teams.** Jeopardy
    and Blockbusters say "give me whichever mode each round calls its whole-team
    one", which is right when a name is four students and nonsense when it is one
    person — "everyone on this competitor agrees" is satisfied by that person's
    single tap, so every round in solo was running under a rule that could not
    apply. Resolved in `jRoundMode` rather than at registration, because the roster
    mode is a live fact and a setting's default is computed once; a teacher's own
    override still wins. The handset says so: `First team with the right answer
    takes it` instead of `A team answers only when all of them agree`.
  - **"It won't switch back" was the roster, not the picker.** The setting, the
    radio and the bar all flipped correctly — what did not change was the *list*, so
    teams mode showed three competitors called Ana, Ben and Cara and looked exactly
    like the solo it had just left. A roster of people and a roster of teams are two
    different lists and neither can be derived from the other, so **both are kept
    and switching swaps between them**. Without it, going to solo binned whatever
    teams a teacher had set up and coming back left the class as competitors.
  - **The winner is the earliest right answer, not the lowest index.** `verdicts[0]`
    is object-key order, so two correct answers in one settle window paid whichever
    competitor sat higher up the bar. Invisible at three teams; at sixteen people it
    is arbitrary. Stamped with a counter rather than a clock — nothing needs to know
    how long ago, only what came before what — and the stamp moves only when an
    answer actually changes, so re-reading your own reply does not lose your place.
    **Not proved against the report.** Driving two correct answers back to back pays
    the earlier one on the *old* build too, because the settle fires before the
    second reply lands. The change is right on its own terms — index order is not
    arrival order — but whatever produced "the second player gets the points" is
    still unexplained, and the next thing to ask is what the two students actually
    did.
- **The room is open from the first screen, and teams-or-solo is decided before the
  board is built.** Reported as: you can switch to solo but not back during a game,
  and students can only join once a game is running.
  - **Switching back mid-game is not a bug that can be fixed, and the report said
    so.** The button flips and the label follows; what cannot happen is the thing a
    teacher means by it — sixteen people do not regroup into four teams without the
    roster being rebuilt, and rebuilding it bins a lesson's points. So it is asked
    **before** the game, on the content screen beside the other how-shall-we-run-it
    choices, and the bar's switch stands down while a board is on. A control that
    flips a label and changes nothing else is worse than no control.
  - **One definition, drawn twice** — `ROSTER_MODES` plus `rosterSwitch()` for the
    bar and `renderRosterPick()` for the setup screen. Two copies would be two
    things that could disagree about what the current mode is.
  - **`phonesWanted()` stopped requiring a game**, which is the whole of the join
    fix: a room only existed once a board was running, so the code appeared at the
    moment it stopped being useful. The class is walking in during unit and game
    selection, and they cannot join a room that does not exist. **This is the same
    reversal this file already records for `phoneMode: off`** — whether a room
    exists is a property of the lesson, what the phones do in a question is a
    property of the game, and conflating them hid the code both times.
  - **The chip moved out of `#screen-play`** to sit above every screen. Still in the
    flow rather than fixed, so the boards measure around it exactly as before.
  - **The setup chooser says what the room actually is** — "3 phones have joined — 3
    on the roster" — so the choice is made against the truth rather than a guess.
    Picking Individuals with phones already in seats them there and then.
  - **`.mode-title` stopped being `#race-mode .mode-title`.** There are two
    how-shall-we-run-it pickers on that screen now, and a class styled by naming one
    of its hosts fails silently — navy on near-black, exactly how the content
    screen's section headings became invisible.
  - Driven end to end: code on the wall from the unit screen, three phones join
    while the teacher picks, the chooser seats them, the bar switch is absent in
    play and back after New game. `joinbar, degradation` was 29/1, and **that one was
    pre-existing** — identical on the base build: it asserted Millionaire's chip says
    "idle here" with the mode off, and Millionaire always hosts a round now, so the
    chip correctly says "pick an answer" instead. ~~It belongs with the dead
    `mBuzzRole` item under Next.~~ **Both are closed** — the check asks the game for
    its own note rather than matching a list of phrases. 30/0.
- **Teams or Solo is a switch on the team bar.** Asked as "how do I change from team
  mode to solo mode", which is the question a control has failed to answer.
  - **It was in ⚙ and that was the wrong home twice over.** It is a room-wide fact,
    so it registered with no `games` and landed on the *All games* tab; and ⚙ during
    play opens the **drawer**, which is filtered to one game and therefore never
    showed it at all. Mid-lesson the path was: ⚙ → All games → Competition.
  - **The bar is where it belongs because the bar *is* the roster** — add, rename,
    remove and reset all live there, it is on every screen, and switching it changes
    what the bar itself shows, so cause and effect are in one place.
  - **Sticky to the left edge**, because the bar scrolls sideways and a class of
    sixteen would otherwise push the one control that changes what the bar is clean
    off the screen.
  - **`justify-content: safe center` fixed a bug that was already on screen.** A
    centred flex row that overflows is clipped at the *start*, so with sixteen names
    the first one was cut in half off the left edge and could not be scrolled back
    to. `safe` falls back to flex-start exactly when it would overflow — which is
    what the ≤760px query had been asking for by hand.
- **All six boards play solo, and three of the four exclusions were wrong.** They
  were asserted from memory rather than read, and reading the code disproved them.
  Nothing about team play changed: `roster` is one setting, teams is the default,
  and a board that suits both is offered in both.
  - **Millionaire draws one ladder, not one each** — `renderMillionaire` reads
    `mTeamState(active)`, so twenty-five people is twenty-five *stored* ladders and
    one on screen. The real caveat is pacing: turns rotate, so a big class answers
    rarely. A warning, not a broken board.
  - **Blockbusters already seats any number in two alliances** — `bbSideOf` is index
    parity and has done this since the board took more than two teams. Individuals
    need nothing new, and it is the one board where solo and team play are the same
    game: your points are yours, the line belongs to your half of the room.
  - **Race suits individuals better than teams** — two people at the screen is what
    it *is*. The rough edge is the claim chooser at sixteen chips, and phones in
    `type` mode remove it outright.
  - **Bingo and Quickfire were already declared.** So the honest count was six all
    along, and what the declaration is really for is the *caveat*, not the veto.
- **The Quickfire leaderboard sizes itself to the room it has.** Reported from a
  class of sixteen: three rows visible, three under the player bar — a leaderboard
  hiding the people it exists to show. The first version picked six rows a column in
  advance; it measures the gap between the question and `Kit.floorTop()` now, which
  is the floor that *moves* — the bar is taller with sixteen names on it than with
  two. Columns come out of the rows rather than the other way round, and when four
  columns still cannot hold the room it draws the top of the table and **`+N more`**
  rather than hiding the tail.
- **Lanes are capped at five, and the cap is a count rather than a mode.** The first
  version dropped them whenever the room was individuals, which was wrong twice
  over: five people is exactly when a lane each is worth having, and eight *teams*
  would be as unreadable as eight people. **Five is measured** — a Multiple Choice
  clue is 718px of a 720 board at five lanes and 754 at six, so six is the number
  that puts the card off the screen. A ceiling, not a comfortable figure.
- **What a round looks like in solo, which was the open question:** the phone strip
  is the picture. At sixteen it reads `16 of 16 · Ana: give · Ben: make · Lex: pass`
  — every person named with what they said, which beats a lane each at that size.
  Driven on the Lab board: sixteen individuals, a Multiple Choice tile, one right
  answer, `Cara has it`, `Close — Cara takes it`, and **Cara alone scores 100**.
  - **And that strip prints the answer on the wall, which predates solo.** Branch 4
    of `renderPhoneBar` shows `name: value` for every reply, so a multiple choice
    round has always been showing the room what everybody picked — including whoever
    got it right. Invisible at four teams, unmissable at sixteen people. Not fixed:
    showing what the room said is the whole point of that strip in `write` mode, so
    which rounds should hide it is a decision rather than a bug.
- **The roster builds itself from the phones, and Quickfire is the first solo board
  — steps 3 and 4.** A student opens the join page, types a name, and is a
  competitor: no team to pick, their own row on the leaderboard, their own score.
  - **`seat` is the relay's whole part** — the host names one phone's competitor,
    the relay sets it and tells that handset so the pill in their hand is right.
    `remap` already did this for everybody after a removal; this does it for one.
    ~10 lines, and the relay still learns nothing about what a competitor *is*.
  - **Keyed by player id → competitor id, never by index at either end.** A phone
    reconnects under the same player id, which is what makes a seat survive a
    dropped connection; a competitor's index shifts the moment one above it is
    removed, which is the bug that paid a Drag the Letters win to a team that no
    longer existed.
  - **A phone that leaves keeps its seat.** A student whose battery dies has still
    played and their score is a lesson's work. They come back to the same row.
  - **The first joiners take the two placeholder slots.** `auto` on a competitor
    means nobody chose that name; cleared the moment anyone renames one. Without it
    a room of six reads *Team 1 · Team 2 · Ana · Ben · Cara · Dan*, with two empty
    rows nobody put there.
  - **The join screen stops asking which team**, because in a room of individuals
    there is nothing to pick and whatever they chose would be overwritten a second
    later. The room says so (`solo` rides the names push and the join payload); the
    page never decides it. The team pill goes too when it would print the name the
    line above already says.
  - **No lanes in solo — `Kit.round.lanes` returns null.** A lane's whole job is a
    team building one answer out of several handsets: how many have committed,
    whether they agree. A competitor of one has neither question. Twenty-five lanes
    is also unreadable, and dropping them bought 137px back on the Quickfire stage.
  - **`onRoster` is a new hook on the game contract.** In team play the roster only
    changes between games; in individual play a student walking in late *is* a new
    competitor, mid-question. Quickfire's leaderboard is the first caller — without
    it a latecomer scored and never appeared. A no-op for every board that reads
    `teams` at draw time.
  - **The leaderboard became a wall rather than a list** — `--kcols` from the
    competitor count, six to a column, capped at four, filled column-first so first
    place is top-left. Same move as `--jcols` and `--ana-n`: CSS cannot count what it
    is laying out. **At 24 people it is 741px of a 720 board, which is better than
    5 people at 757** — the columns are working; what does not fit is the stage.
  - **Not fixed, and it is not solo's doing: Quickfire's stage overflows a 720 board
    whenever the phone chip is up.** Measured identical on the pre-change build
    (806px with lanes, both). `fitKahoot` asks for `floor:true`, so the board hands
    its height back rather than forcing one, and the scoreboard sits below what was
    fitted. Same family as the climb card.
  - **The team bar is redundant in solo on a board that draws its own leaderboard**,
    and it is roughly the overflow. Hiding it is a layer-1 change and was left alone.
  - Driven on the relay: five phones join with no picker, take the two placeholders
    and three new rows, get their own names, answer independently, and two score
    +80 each. **No classroom run.**
- **Individual play is a switch now — step 2, and the blocking question turned out
  to be already answered.** The note under Next said to decide what "everyone on
  the team agrees" means when a competitor is one person, before going further.
  Reading the code answered it: unanimity is `agreed >= size` and the size is the
  live roster's, so **a competitor of one is satisfied by that one answer, and no
  round needed changing at all.** That is the tier boundary being in the right
  place, and it is the whole reason this step was small.
  - **`roster` is a room-wide setting, deliberately not per game.** The roster
    persists across games and unit switches, so a lesson cannot be in teams on one
    board and individual on the next without the scoreboard being rebuilt under the
    class. Registered with no `games`, the same as the relay address.
  - **A board declares whether solo suits it** — `solo:true`, the same shape as
    `hasBank`, and **false by default** so a new board has to say it has thought
    about it. Jeopardy, Bingo and Quickfire take it. Millionaire draws a ladder each
    and thirty ladders is not a board; Blockbusters has exactly two routes across
    it; Race is two people physically at the screen. It is a fact about the
    *geometry*, never about the questions.
  - **A card that vanishes with nothing saying why is indistinguishable from a
    broken build**, so the game screen names what it is not showing and why.
  - **Blockbusters was missing `teamMode` and had been playing as though it were
    not a team game.** Jeopardy declared it, Blockbusters did not, so every round
    there fell to first-tap-wins — the fastest thumb on the side that is up answers
    while the rest of their alliance never commits. The same objection that put the
    declaration on Jeopardy. There was no reason for the two to differ, only an
    omission. **Ordering is not named as an exception here** the way it is on
    Jeopardy: only one side is at the board at a time, so a shared climb reads as
    the one ladder it is.
  - **Which boards host a round, checked rather than assumed** — the audit that
    prompted this. Jeopardy and Blockbusters host all five in the clue card;
    Millionaire and Quickfire host **Multiple Choice only**, and that is *content*
    rather than wiring (their bank is `{prompt, answer, distractors}` and the round
    is derived from it). Bingo hosts none by design — it owns the handsets. **Race
    hosts none and is the one real gap**, still waiting on the stage as a mount.
    There is no legacy rot: every difference above is a declaration.
  - **Not done, and next:** the roster built from the joined phones, and Quickfire
    as the first solo board. Until then solo is the teacher's own + Player button.
    The game-card blurbs still say "teams" in solo, which is a second string per
    game and was left alone.
- **A dragged tile is the size of the tile you picked up.** Reported for both drag
  rounds: a letter or a word warps the instant the thumb takes it. The ghost was
  appended to `document.body`, which put it **outside `#arrange`** — so in words
  mode none of the `#arrange.words` rules reached it and it took the *letters*
  sizing, `padding:0`, its content width rather than its column width, and
  uppercase. Four changes at once.
  - **Drawn inside `#arrange` now, and pinned off the tile it came from.** The pin
    has to be the element rather than a rule: a tray tile is as wide as its grid
    column and a slot as wide as its own, and no stylesheet can say that. Everything
    the pin does not cover — the face, the case, the padding — is inherited instead
    of guessed, which is the half that appending to `body` threw away.
  - **`scale(1.14)` went with it.** It was there to say *lifted*, and saying that by
    changing the size is the same complaint one step smaller. A shadow says it
    without moving anything.
- **Drag the Words breaks the sentence in the same places on the wall as in the
  hand.** Reported from a four-team board: the card wrapped a nine-word sentence
  six-and-three and the handsets wrapped it five-and-four, so the same question
  wore two shapes and a student looking up had to find their place again.
  - **Neither end was wrong — they were both wrapping, to different widths.** A
    clue card is 636px across and a phone is 390, so flex wrap can only ever agree
    by luck. Both rows at both ends are one grid of the same number of columns now.
  - **Four to a line at most, and the rule has one home.** `HubBuzzer.wordCols(n)`
    — the one file the board and the handset both load, exactly where the team
    palette lives and for the same reason. **It costs the relay nothing**, which is
    right: how a word is drawn is presentation, and the wire stays as ignorant as
    it can. The alternative was sending the count on the arm, which is a relay
    change, a key in the hand-typed `armed` payload, and a fact travelling that
    both ends could already work out from the word list they hold.
  - **Never an orphan.** Rows first, then the words spread evenly across them, so
    nine words are 3·3·3 and not 4·4·1. A box alone on a line reads as a mistake and
    is where a thumb aims first — the anagram row had already paid for that, and the
    old handset layout put a nine-word sentence at 2·2·2·2·1.
  - **A rect is what is *painted*, and the card opens by growing out of its tile.**
    Shipped broken for one push and reported straight back: the columns came out
    ~45px, every word lay on top of the next, and **any redraw at all — a hint, a
    word landing on a phone — snapped it into shape**, which is the tell. The
    re-measure below runs on the frame after the clue opens, and on that frame the
    whole card is still scaled down to a $100 tile, so every chip measured a
    fraction of its width. `offsetWidth` is the layout width and ignores every
    ancestor transform; the handset has always used it, which is why only the card
    was wrong. Measured with the flip on: 69px against the correct 121px.
    **And the reason the suite missed it is that the test harness sets
    `cardFlip:'off'`** — as does every layout check in this project. A measurement
    taken during an animation cannot be verified by a build that has no animation.
  - **The card's own measurement had never run on a board.** Jeopardy calls
    `jShowClue` and *then* `openClueCard`, so the modal is still `display:none` while
    the round renders and every rect reads 0 — the `ch` estimate is what has actually
    been shipping, and the bench measured properly, which is why the two differed
    there too. It measures again on the next frame now, guarded by `isConnected` so a
    stale frame from a discarded render does nothing.
  - **A word never wraps: `white-space:nowrap`, not `overflow-wrap`.** The first
    version let a word break, and a column one pixel short of its widest word then
    made that row taller than the rows beside it — the card changing height under the
    room, the exact bug three of last week's fixes were about. `convicted` split as
    `convicte`/`d` in a screenshot and no assertion saw it.
  - **The pool's type comes down to 0.85em, which is what pays for the third row.**
    Three rows of boxes where there were two costs ~150px, and a nine-word sentence
    with four teams then ran off a 720 board. The pool is not what the room reads —
    every word is already in every student's hand — so it gives way first, the same
    trade the thermometer's race made. Worst case measured at 1280x720 with four
    teams: 730 of 720, against 737 before the change. **Still over, and that is the
    same open card-height problem the climb has.**
  - **Boxes above the pool on the card now**, which is the handset's order. The
    phone has a reason — the word being dragged sits directly under where it goes —
    and the card had none, so it follows rather than differing for nothing.
  - **The handset had the shrinking-empty-box bug the card paid for last week**, and
    nobody had reported it because nobody watches two phones at once: an empty slot
    was `0.8rem`, so the first word to land in a row made that row taller. Quiet by
    opacity and weight, never by font-size.
  - Driven on the relay at 1280x720 and 390x844 over all five Lab sentences at two
    and four teams: identical row shapes at both ends every time, a drag still
    landing, and neither the shape nor the card height moving as words land.
- **A finished race shows how the race went, and a guess says what kind of guess it
  is.** Two reports from a four-team board.
  - **`reveal` was filling every lane with the right answer**, which wiped the one
    thing worth looking at when a round ends: how far each team actually got. Four
    identical ladders say nothing about a race won by one rung. A lane can only ever
    hold *correct* placements — `accept` pushes on a right answer and nothing else —
    so what is left standing is already a true picture, and the answer itself is on
    the card's own answer line where it always was. **A climb still fills itself in**,
    which is the opposite case: one ladder, and it *is* the answer.
  - **The guess rung had one state and needed three.** It is the only place a team's
    live proposal appears, and it said nothing about whether the team had settled on
    it or whether it was wrong. Now: **amber** when they have not agreed — being
    split is not being wrong, it is the argument this round exists for — **red** when
    they agree and it is not the word that comes next, and plain when it is simply
    the current proposal. Same two tones the other rounds' lanes use, so a teacher
    reads one vocabulary across all five.
  - **Derived, not stored.** "Wrong" is `leading[team]` against `scale[lane.length]`
    and "split" is `agreement()` — both already on hand at draw time, so no new state
    and nothing that can go stale. It gives away nothing the say line has not already
    said out loud, and it is what lets a team learn from a rival's dead end.
  - **A filled rung is green and nothing else.** It carried the team's colour on its
    border as well, which made one box argue with itself — green says *the room got
    this right*, and a second signal in the same border says *whose lane this is*, a
    question already answered once at the top of the lane where the name is.
  - Driven on the relay with three handsets: two on one team disagreeing (amber), a
    second team agreed on the wrong word (red), the right word landing, and the end
    state keeping one lane at one rung and the other empty.
- **The pool chips are one size, roomy, and the hint's number is out of the word's
  way.** Third attempt at the number, and the first two failed on the same thing —
  where the word actually is.
  - **The odd-sized chip was a row height, not a width.** Grid rows size to their own
    content, so the row holding a two-line phrase was taller than the row under it
    holding a one-line one, and the last chip looked like a mistake.
    `grid-auto-rows:1fr` makes every row equal to the tallest without reserving space
    that nothing needs when every word is short.
  - **The number went to the top-left corner**, which is the one place in a centred
    box the text never reaches. Inline it pushed every word right of its own centre;
    in a left gutter it sat *on* the word the moment a chip was only as wide as what
    it held — which is every chip in a race.
  - **And the gutter had never applied in a race at all.** The racing rule sets
    `padding` as a *shorthand* and is one class more specific, so it silently
    replaced the whole longhand. A shorthand from a more specific selector beats a
    longhand from a less specific one, and nothing anywhere says so.
  - **Uniformity has a price and it has to be paid by the right thing.** Every chip
    matching the tallest meant one three-line phrase set all five and pushed the card
    45px past a 720 board. Fewer, wider columns stop it wrapping that far; the pool's
    type comes down and the **rungs' goes up**, because in a race the pool is the
    teacher's control — each team's own words are on their handsets — and what the
    room reads is the ladders.
  - Worst case measured: a five-phrase scale with four teams, 708 of 720 on a
    projector and 591 of 660 on a laptop, every chip identical, no number touching a
    word.
- **The clue card fits a laptop, and the pool words are centred in their own boxes.**
  Both fell out of the previous fix, and the first is the more general problem.
  - **`#clue-card` is capped in width and has no cap on height at all**, and it is
    centred — so on a window shorter than a projector it runs off the bottom and
    takes its own buttons with it. Reported as the card going past the screen once
    four ladders made it taller. Nothing fires at the 720 a projector gives; below
    that it is the **chrome** that gives way rather than the question — 88px of card
    padding and 48px of prompt margin is generous at 720 and is the cheapest ~70px to
    hand back before any round shrinks its own type. 559px at every height from 660
    down to 560, where it was 625 and overflowing.
  - **Deliberately not a transform.** The card's `transform` belongs to the flip
    animation — the same reason dragging it writes `translate` — so fitting is done
    with padding and margin or not at all.
  - **A media query beat by source order, which CSS gives no warning about.** The
    block was written next to `#clue-modal` near the top and did nothing: `@media`
    adds no specificity, `#clue-back{padding:44px 40px}` sits 50 lines further down,
    and the later rule simply won. It reads exactly like the query not matching. It
    lives at the end of the file now.
  - **The invisible line in an empty rung is a race-only rule.** Applied to every
    mode it added ~65px to the climb — the tallest card in the app — for no gain,
    because a climb has one ladder and nothing to line up against.
  - **The number gutter was pushing every pool word off-centre.** Reserving it inline
    kept the chip from resizing when a hint numbered it, which was the point, but it
    took its space *before* the word. It is absolutely positioned in symmetric
    padding now: the word centres in the whole chip, the chip still never resizes.
    Measured equal to the pixel either side, before and after a hint.
- **The thermometer's ladders line up, and an empty rung is a box rather than a
  dotted hole.** Reported from a four-team board: the lanes drifted apart as teams
  filled rungs, so one team's *gossip* sat lower than another's.
  - **`min-height` cannot do this, and that is the whole cause.** It is a floor: a
    rung with a word in it is taller than the floor while an empty one sits exactly
    on it, so a lane that had filled two stacked shorter than the lane beside it.
    Every rung carries **one line box** now — an empty one holds a non-breaking
    space, invisible and exactly as tall as a word — so height is never a pixel
    guess and survives any change to the type size.
  - **`NEXT?` was the second cause**, at a smaller font than every other rung, which
    made its box shorter on its own. Same size as the rest now; it is marked out by
    its letters rather than by being a different height.
  - **Solid borders everywhere, including empty.** A dotted outline reads as a
    different kind of thing; an empty rung is the same box with nothing in it yet.
    Quiet is opacity and colour, never shape.
  - Proved with lanes at 0, 1, 2 and 3 filled: every rung top identical across four
    lanes, which is the state that drifted.
- **The memory is checked at the one moment it can be, and stays quiet otherwise.**
  `tools/memory-check.js` runs as a `PreToolUse` hook on Bash, notices a `git
  commit`, and names what is about to go in — **but only when `CLAUDE.md` is not
  among it.**
  - **The silence is the whole design.** A reminder that fires on every commit is
    one you stop reading by the third day, which is the same lesson as the
    duplication report and as every "are you sure?" anybody has ever clicked
    through. This one is structurally incapable of firing when the memory is
    already being updated, so it is always at least a fair question.
  - **Matched anywhere in the command, not as a prefix.** The way this project
    actually commits is `git add -A && git commit …`, so the hook's own `if`
    filter (`Bash(git commit*)`) would never have fired. Worth knowing before
    writing the next Bash hook.
  - It reads `--cached`, falls back to the working tree for `commit -a`, and says
    how many of the files are code, tooling or a skill — the places decisions live
    — rather than judging the change, which it cannot do and the author can. It
    never blocks.
  - **It found its own first target**: this file opened with *"No hooks, no roadmap
    file"*, which had been false since `shelf.js` was hooked.
  - Proved by sentinel — prefix the command, run a Bash call, read the file, strip
    the prefix. Three cases piped by hand first: not a commit (silent), a commit
    without `CLAUDE.md` (speaks), a commit with it (silent).
- **Ending a round went on the shelf, and the shelf tool learned to find what is
  copied.** The three bugs below were shared-tier bugs, but only two had shared-tier
  *fixes* — the third had to be made in five round files by hand, which is the same
  defect one tier down and would have shipped again in round six.
  - **`reveal` is a default now, not something each round writes.** It calls
    `Kit.round.finish(state)` — the round is over, the answer is out, the teacher's
    selection is finished with — and redraws the card. **Five rounds declare no
    `reveal` at all.** Ordering and Word Drop override it, and both call `finish`
    first: the ladder *is* the answer there, and the falling tile has a clock to stop.
  - **`finish` deliberately does not touch what the room did.** That is the whole
    bug it retires: three rounds cleared `picks`/`leading`/`votes`/`got` in their own
    `reveal`, which was invisible while a won card flipped away inside a second and
    became "the team list disappears the moment somebody wins" the day it stopped.
  - **`shuffle` was written out six times and `teamColour` five** — eleven copies of
    two helpers nobody would ever look for. Both on `Kit.round` now. 94 lines deleted
    across the seven round files against 24 added.
  - **`tools/shelf.js` finds duplication, which is the half it was missing.** Listing
    what is on the shelf answers "does this exist?", which is no help when the answer
    is "no, it has been copied into five rounds" — the hook fired on every one of
    those edits and correctly reported a shelf the code was not on. It now strips
    comments, slides a three-line window over the round files, and reports any run
    appearing in three or more of them.
    - **Three lines, not four**, because four missed `shuffle`: a nine-line helper
      survives stripping as three, and the window can be no longer than the smallest
      thing worth reporting.
    - **What it ignores is derived, not listed**: a state field, a *hook signature*
      (asked of the registry, so a hook added next month stops being reported with
      nothing edited), a call into `K.round` (the shelf working is the opposite of a
      finding), and the file preamble. Then it wants **two** lines of real logic —
      one is `const c = ctx || {};` at the top of every render, which is true and
      useless.
    - **Proved both ways**, which is the rule: run against the tree that had the bug
      it finds the `reveal` block in four files, `s.done = true; s.shown = true;
      s.chosen = [];` in four, and `shuffle` in six. Run against this tree it finds
      one thing — the three-line `render` preamble — and the report says in as many
      words that the tool has no taste and a finding is a question.
- **Three bugs the card-holds-open change introduced, all reported from a board and
  all now proved by reverting.** Two were mine outright; the third is a latent one of
  the same family that I could not reproduce on the exact clue.
  - **A hint wiped what the room had already sent.** `roundPress` re-armed the phones
    after every press, and an arm clears the relay's held replies and resets every
    handset. That was right for the one press it was written for — the ordering
    climb fills a rung, so the next question really is different — and wrong for
    every hint, which only changes the projector. Thirty students lost a half-built
    sentence to a letter appearing on a wall.
    - **A round says which it was**: `'card'` from `hint`/`press` means redraw me and
      leave the phones alone, anything else truthy means the question moved. Only
      ordering's climb returns the second.
    - **`Kit.round.press` was coercing the answer to a boolean**, so a round could not
      have said so even if it wanted to. It passes the value through now.
    - **The board looked fine while the phones were wiped**, which is why it was
      reported as a phone bug: the relay's replies were cleared but the card kept the
      picks it had already read, so only the handsets visibly lost anything. Proved by
      reverting — the phone's selection goes `["discharged"]` → `[]`.
  - **The team lanes vanished at the moment a team won.** `reveal()` in choice,
    anagram and scramble wiped `picks`/`leading`/`votes`/`got`, and all four renders
    drew lanes only while the round was live. Invisible for as long as a won card
    flipped away in under a second; now that it stays up until the teacher closes it,
    it took the picture off the screen at exactly the moment there was time to read
    it — and shrank the card doing so, which was a warp on top of the warps. The
    state survives and the lanes draw when the round is over. Reverted: 0 lanes then,
    2 now.
  - **The prompt has to be revealed *before* the round, not after.** The round's card
    is mounted inside `#clue-text` and `Kit.prompt.reveal` rewrites that element, so
    revealing the prompt second tore out the card that had just been drawn. The
    Reveal *button* has always had this order; the new win path had it backwards. It
    only bites on clues whose question form actually rewrites the prompt, which fits
    "*sometimes* the answer doesn't come up" — but the reported case was Drag the
    Words, whose prompts carry no blank, so the form declines and the card survived.
    **The likelier cause there is the hint wipe above**: a reset handset means the
    team never reaches unanimity and nothing happens at all. Fixed both; only the
    first is proved.
  - `roundHost.mount()` instead of `getElementById('clue-group')` on that path, which
    is what puts the card back when the prompt has just replaced everything inside
    `#clue-text`.
- **The clue card stops changing height mid-question.** Reported as the question box
  warping — on the first hint in some rounds, on every hint in others — and it turned
  out to be four different causes wearing one symptom. Measured before and after
  rather than eyeballed: the card's height across every hint, in all five rounds.
  - **The say line was the big one, and it was never about hints.** `.group-say` is
    the first thing to occupy its row, so the first *anything* — a hint, a wrong
    answer, a team taking it — grew the card. It is drawn even when empty now and
    holds its line. That was six identical copies across the rounds, so it went on
    the shelf as `Kit.round.say` in the same change.
  - **Reserved one line, not two, and only the ordering race gets two.** Reserving
    two everywhere was the first fix and cost ~25px on five cards that never need it.
    A race has no shared ladder to print a gloss in, so its own hint has to carry the
    word *and* its meaning, which wraps; every other message is short. The climb's
    hint stopped repeating the gloss it had just printed in the rung, which is what
    let it back down to one line.
  - **Multiple Choice hides the box rather than removing it.** Taking the element out
    re-flowed the grid and jumped the card a row on every hint — worse than the
    struck-out box it replaced. `visibility` empties the box and keeps its cell, and
    it keeps A/B/C/D where they were as a bonus.
  - **Drag the Words gives every slot one width, measured off the tray.** The handset
    learned this first, from the room bench, and for the same reason; the card never
    got it. The `ch` estimate alone was not enough — `ch` is the width of a zero and a
    proportional font's `w` is wider, so the longest word still overflowed its slot.
  - **A smaller font makes a shorter box, and `em` resolves against the element's own
    font-size.** The empty slot's number was `0.8em`, so the first word to land in a
    row made that row 9px taller. Pinning `min-height:1.65em` did *not* fix it — the
    shrunken slot got a shrunken minimum — which is the trap worth remembering. The
    number is quiet by opacity and weight now, never by size.
  - **The ordering pool reserves a gutter for a position number**, so a chip does not
    widen when it gets one — on a hint, and equally on the teacher's own click, which
    had been doing it since the round was written.
  - **Still moves, and it is not the hint's doing: the climb ladder.** Filling a rung
    is what the climb hint *does*, and `accept` pushes to `s.placed` identically on a
    right answer — so the card has always changed height there. A rung carrying a
    gloss is taller than one without, and the pool loses the word. Fixing it means
    reserving a gloss row on every rung, and that card is **already 713–728px tall on
    a 720px board**, so the real job is that overflow rather than the wobble.
- **A won round stays on screen until the teacher closes it, and every round has a
  hint.** Two reports from a real board, and the answer to both was the same one:
  neither is a round's feature, so all five inherit them.
  - **The card was flipping away within a second of the answer landing**, which left
    the room with no answer on screen and no idea who had taken it. The round paid
    itself the moment it was won *because* the class produced the answer and the host
    judged it — there was nothing left to confirm. But "nothing to confirm" is not
    "nothing to read", and only the second one was true.
  - **What waits is the payout, not the animation.** The alternative was to pay now
    and defer only the flip, which means splitting `closeModal` out of both hosts'
    `win()` and then re-running the board's after-work — a cleared Jeopardy board, a
    finished Blockbusters line — by hand from somewhere else. Deferring the whole
    thing keeps one path: **Close presses the same button the round used to press for
    itself**, so the tile, the turn, the banner and the ending all follow as before.
  - **It is the *host's* wait, not the round's**, which is why nothing in any of the
    five rounds changed for it. Derived from `mount === CARD_MOUNT` rather than named
    per game, so the two card boards get it and Millionaire and Quickfire — whose
    options stay on their own stage and have no card to hold — correctly do not.
    `roundWinClose` in ⚙ puts the old behaviour back.
  - **The residual, stated rather than hidden:** leaving the board without pressing
    Close loses the points. Close is the only button on screen, so the only way there
    is abandoning the play screen — which already scores nothing on an ordinary clue
    left open.
  - **`jGroupEnd` split in two.** Telling thirty handsets the question is over and
    taking the card down had only ever happened together; a card that outlives its own
    round separates them. The phones stand down the moment the answer is out — or the
    room holds a live-looking button for a question that has been decided — and the
    strip is deliberately *not* cleared, because who answered is what the teacher is
    about to read out.
  - **The hint is one part of the answer, given away, and pressing again gives the
    next.** What a "part" is could only ever be the round's: a word named as belonging
    to the group, a wrong option struck out, the next letter into its slot, the next
    word of the sentence, the next rung with its gloss. What the *button* is — its
    wording, its count, standing down when there is nothing left — is the same
    everywhere, so `Kit.round.actions` builds it from `hint()`/`hintsLeft()` and no
    round writes a button. A round declaring neither offers none, which is what the
    default round, the information gap and Word Drop correctly do.
  - **Never the last part**, in all five. Giving away the last one *is* the answer and
    Reveal is already that button — so Connections stops at three of four, a choice
    stops at two live options, and the drag rounds stop one short. Held back in
    `hintsLeft` rather than guarded downstream: what the button can do should be what
    it offers.
  - **The drag rounds fill a *random* empty slot, not the next one along.** Reported
    from the first look: filling left to right gives away more than one part, because
    `V E _ _` and *"The jury …"* are run-ups a class can guess the rest of, so the
    second hint is nearly free — and it is the same hint every replay. A random slot
    pins exactly one position and leaves the shape of the answer open. `hint` is a
    list of revealed indexes now rather than a count.
  - **The thermometer race got a hint too, and it is about the scale rather than any
    team's ladder.** It offered none at first, on the reasoning that placing a word
    would give it to one team or to all of them — true, and the answer is not to
    place it. Naming which word sits at position *n* is one fact about the question,
    identical for four lanes at once, and each team still has to drag it onto their
    own ladder. The pool marks it with its number and the card prints its gloss.
    Counted from the cold end, which is the end a scale is read from — deliberately
    not random, unlike the drag rounds, because a position on a scale only means
    anything in relation to the ones below it.
  - **`null` and `0` are different answers and the difference is whether the button
    exists.** `0` is offered-and-spent, drawn disabled. `null` is not-in-this-mode:
    the ordering race gives every team its own ladder, so a shown word would go either
    to one team or to all of them, and a disabled control there never had a meaning.
  - **Ordering's *Show this one* became the hint rather than sitting beside it.** It
    was the first thing to use the second slot in the strip and it was already this
    idea under its own name; a teacher should meet one affordance, not five.
  - **Multiple Choice takes the box off the card and leaves the phones alone**, which
    is 50:50's idea and deliberately not its mechanism — so it keeps its own list
    beside `hidden`. The two want opposite things at the two ends of the room: a
    struck-out box still costs a slot on the projector and the room still reads it,
    while re-arming thirty handsets would redraw four buttons as three under the
    thumbs mid-question and move the one somebody was about to tap. A student who
    then picks the option that has gone from the board has told the teacher
    something worth knowing. A *lifeline* is the other way round, and correctly so:
    it is spent, and watching two options leave your own handset is what it was
    spent on. The letters do not renumber, so "who went for C?" still means the same
    option after a hint, and Reveal puts every box back so the right one can light.
  - **A hint is marked as given, never as earned.** `--gw-hint` is a first-class card
    property beside `--gw-good`, because the obvious reach — `--gw-hot` — is near-white
    on the game-show card and on the bench, so a hinted word would have been
    indistinguishable from an untouched one. And it is deliberately not the
    right-answer green: painting a handed-over word as a correct one makes the board
    tell the room it got something it did not.
  - **Free, and that is a tier decision rather than a kindness.** A round may not
    score, so a hint that cost points would put scoring inside the round tier — the
    one thing that would stop a round being portable. Whether being helped costs
    points is the host's question and no host asks it yet.
  - **`Kit.round.press` went on the shelf with it**, dispatching `hint` to `hint()`
    and everything else to `press()`, with both callers — the hub and the question
    bench — rewired in the same change, so neither has to know the button was
    synthesised rather than declared.
  - Driven in a browser on the Lab board and on the bench: 22 checks over the hint in
    all five rounds, the win holding, Close paying, and the second host. `grouping,
    anagram` 141/0 after **ten suite checks were updated in the same change** — they
    pinned the old auto-pay, which is the behaviour that was asked to change, so a
    `closeWonRound` helper presses Close before every "did it score".
  - **No classroom run.** The thing to watch is whether Close becomes a click a
    teacher resents on a fast board — `roundWinClose` is there for that — and whether
    a hint that costs nothing gets pressed too early.
  - **Found on the way and not fixed, because it predates this:** the `qbench` suite
    throws on Multiple Choice in `agree` mode, waiting for a `.group-tally` that never
    appears on the bench. Identical on the base build (66/1 both ways). It is a real
    red check and it is somebody's next job.
- **Units 4 and 5 play as rounds — every Jeopardy clue and every Blockbusters
  hexagon.** 100 clues in 20 categories and 72 hexagons per unit, five round types
  per section. The ~175 simple question-and-answer items each of those two boards
  held are gone. NEF-1 is **not** converted, so it is the one unit left to compare
  against.
  - **Race and Millionaire are untouched, for opposite reasons.** Millionaire needs
    nothing — its ladder already builds a Multiple Choice round out of every rung
    when the question opens, so that bank was rounds before any of this, and
    Quickfire reads the same one. **Race cannot host a round at all**: its scattered
    words *are* the board, so it needs the stage as a mount, which is still on the
    build order. Deleting its bank would have taken the game out of the unit for
    nothing.
  - **`bingoBank` is new and is why Bingo survived.** A bingo call is a clue with
    one single-word answer; a round hexagon carries no answer at all, so
    `bingoWordsIn` finds nothing in an all-rounds bank and the game silently leaves
    the unit. The old calls moved there verbatim, and Bingo reads its own bank when
    a unit has one and falls back to `blockbustersBank` when it does not — so an
    unconverted unit is untouched by the change.
  - **The gate found 49 duplicated prompts on Unit 5's first pass and 5 on Unit
    4's.** The 49 were the Jeopardy sets copied straight into the Blockbusters
    bank, which is exactly what the per-game rule exists to stop; the difference
    between the two numbers is the whole return on authoring a different question
    per game rather than rewording one.
  - **The rule that matters most, and it was learned by breaking it: every word in
    an ordering scale should be the unit's own language.** Unit 5 was authored from
    its existing bank and has six scales — job security, seniority, attention,
    claim strength, commitment, reliability — that are plausible C1 English the
    unit never teaches. Unit 4 was authored from `material/empower-c1-unit-4/` and
    holds to it. **`author-content` §3 says read the pages first and that is the
    step that was skipped**; the gate cannot catch it, because sourcing is not form.
    An audit against the scans is outstanding on all three units.
- **One shape for every content screen, and the round type became an axis you can
  pick along.** Jeopardy grouped rows under section headings with no counts; every
  other board was a flat list with counts, no headings, and the section repeated
  inside each row — the same job, two layouts, and the markup written out twice.
  `contentRow` and `sectionHeading` are what both builders call now.
  - **`selectedContent.includes(groupOf(x))` was hand-copied in eight places**, so
    a second axis would have had to be threaded into all eight by hand. They call
    `inPlay` now, and a seventh game gets both axes by filtering with it.
  - The filter strip is built from the round types **actually in that game's bank
    for that unit**, and hides itself below two — Millionaire shows none, because
    every rung is already a Multiple Choice round and a filter that cannot narrow
    anything is a control that lies. Counts follow the filter.
  - **Jeopardy filters whole categories, never clue by clue**: the board indexes
    tiles by row, so a column short of one clue is `undefined` rather than shorter.
  - The section headings were `--navy` on the game-show skin — navy on near-black,
    reported as almost invisible. The skin styles every other part of that screen
    and missed this one line, which is what a theme naming classes one at a time
    will always eventually do.
- **A team is a competitor now — step 1 of individual play, and deliberately
  invisible.** The shape gained an `id`: an index is a competitor's identity
  everywhere today, which is why removing one is a special case rather than a
  splice and why the first live class paid a win to a team that no longer existed.
  A person must be matched to their handset across a reconnect and an index cannot
  do that. Nothing reads it yet.
  - **`Roster` is the one seam.** Everything that *reads* the roster keeps indexing
    the array — about sixty places, all staying, because a board looking up
    `roster[i].name` does not care what put it there. Only what *changes* it goes
    through `Roster`: add, the floor of two, the label. That is the sole difference
    between a room of teams and a room of people.
  - **Solo does not fit every game, and that is a declaration to make rather than a
    thing to discover.** Jeopardy, Quickfire and Bingo take it; Millionaire draws a
    ladder per competitor, Blockbusters' board has exactly two routes across it, and
    Race is two people physically at the screen. Same shape as Race and Bingo not
    hosting rounds.
  - **Still to decide before step 2:** what "everyone on the team agrees" means when
    a competitor is one person. `poll({unanimous})`, `mustHold` and every `agree`
    mode assume several handsets per competitor.
- **`?desktop=1` shows the projected layout on a handset** — it pins the viewport to
  1280 instead of the device width, so none of the phone tiers match. It gives the
  real *width* and not the real height: a portrait phone at a 1280 layout width
  reports ~2770px of height, so the board fits itself to that and the tiles stretch.
  For a true 1280x720 frame the room bench already does it properly.
- **A content conversion can break a suite silently, and did — twice.** `turns` and
  `competition` went red several commits before anyone noticed, because the content
  gate was re-run after converting and the shared set was not. The app was right:
  **phone modes and Jeopardy's steal only exist on a plain question**, since a round
  arms the handsets itself and owns its own verdict, so the tests were waiting for a
  buzzer and a claim chooser that correctly never appear. Both use the Lab board now
  — eight plain categories, and not class-facing, so it will not be converted out
  from under them. **Re-run the shared set after content work, not just the gate.**
- **Multiple choice joined the lane standard, and a finished lane says which of three
  things happened.** Reported from a real board, in two rounds.
  - **It was the last round drawing its own team progress**, and what it drew was a
    dot in each team's colour on the option that team had picked — the class reading
    each other's answers off the projector, which is the opposite of what a multiple
    choice asks. It calls `Kit.round.lanes` now, so all five named rounds draw the
    same picture. **A cell is a person, not an answer**: one box per handset, filled
    as that student commits, so the room sees a team is waiting on one more without
    seeing what anybody chose. No count beside the boxes — the boxes *are* the count,
    and in agree mode the header already carries a fraction.
  - **Green stopped being the default, which was the second report.** `full` washed a
    lane green the moment everybody had answered, so a team split three ways and a
    team agreed on the wrong option both read as the good outcome. `tone` on the lane
    spec now: **amber** everyone answered and not the same thing, **red** agreed and
    wrong, **green** agreed and right, nothing until they have all answered. A team
    that has stopped typing has not finished, and **amber is the interesting state**
    — it is the one there is something to say about. The drag rounds still set `full`
    and nothing else, which is what they always did.
  - Millionaire's Ask the class still puts counts on the options: the team has spent
    a lifeline to see exactly that, so it is not the same leak.
- **The room chip went under the clue card.** It was `z-index:51` against the card's
  50 — raised so a phantom phone could be kicked mid-clue — and drew a join address
  and a SHOW QR button straight across the clue's own topline. The raise was never
  what made it clickable: `#clue-modal` is `pointer-events:none` and only the card
  opts back in, so the chip takes clicks wherever the card is not covering it, and
  the card is centred at 720px so its ends always are. If the card is in the way, it
  drags.
- **Every arm tells the handsets how the question is being played** — "A team answers
  only when all of them agree", in the round's own words. A teacher sets one rule on
  one board and another on the next and cannot then remember which is running, and
  the phone is the one screen actually in the room's hands.
  - **Stamped at `register()`**, not in each round's `arm()`: eight call sites build
    an arm across the hub and the bench, and a round added next month would have to
    remember. The label is the round's own `modes` declaration, so it is the same
    string ⚙ and the bench dropdown show. A round with one way to play says nothing.
  - **The relay dropped it, and that is the reusable lesson.** The round stamped it
    and the handset was ready to draw it; `toEachPlayer(room, 'armed', …)` builds its
    payload from a **hand-typed list of keys**, so anything not named there never
    reaches a phone. This file already records the *hub* side of that bug being fixed
    twice — `optionsByTeam` silently dropped on a re-ask, `promptByPlayer` nearly —
    and the relay's outbound payload was never looked at. Sent on `armed` and on
    `joined`, cleared on disarm and reset.
- **A round can have more than one button — F3.9.1/F3.9.2, and the last tier with no
  way to declare into the action strip has one.** This was the single thing on the
  Next list blocking round designs outright: `group-btn` is one element, so a round
  wanting a second action had nowhere to put it. Written up under "Where a thing
  belongs"; the short form is `actions(state, ctx)` and `press(id, state, ctx)` on
  the round, `Kit.round.actions` / `Kit.round.strip` on the shelf.
  - **The split that resolved it is that committing *scores*.** It pays a tile, a
    hexagon, a rung — so the commit button can only ever be the host's, and a round
    never restates it. What a round declares is what changes its own *question*.
    That is why the six rounds declaring nothing needed no change at all, and why
    `press` may not score: if what you want is "this answer counts", that is the
    commit button and it is somebody else's.
  - **Three things went on the shelf and both hosts were rewired in the same
    change**, which is what makes it a shelf rather than a second copy under a new
    name. `Kit.round.cap` — the engine's `jRoundCap` and the bench's `capOf` were the
    same sum written twice. `Kit.round.actions` — so was the commit button's wording,
    **and the two had already drifted**: the bench had grown an `Answered` state the
    engine never got. `Kit.round.strip` draws them.
  - **`hideAllActionButtons()` stopped carrying a list of ids.** It asks the strip.
    The list was hand-typed, a new button had to be threaded into it by hand, and
    nothing complained if you missed one — `wager-ok` never was, so a bet left
    standing outlived every one of those calls. Exactly the defect class this project
    has paid for most, one tier over.
  - **The mount is created beside the commit button, not written into the skeleton** —
    the clue card's Check, Millionaire's "Final answer?", Quickfire's "Lock it in".
    The same move `CARD_MOUNT` makes for the card, so a fourth host gets it with no
    markup of its own.
  - **The round that proves it: ordering's climb gets *Show this one*.** A class that
    cannot separate *livid* from *furious* learns more from being shown than from four
    wrong guesses — the bench thermometer has had this since it was written and the
    round never could. It prints the word's gloss, which is the whole point; a word
    shown without one is a spoiler rather than a lesson.
    - **Climb only**, declared per mode: in a race every team has its own ladder, so
      showing a word gives it either to one team or to all of them.
    - **Never the last rung.** With one step left there is one word left, so it
      teaches nothing — and it would end the round with nobody having answered, which
      is a question about *scoring* and therefore not the round's to answer. Disabled
      there rather than guarded downstream: what the button can do should be what the
      button offers.
  - Driven in a browser on the bench and on the Lab board, and pinned by six checks
    in the `grouping` suite: two buttons with the round's mounted beside the host's,
    a press filling a rung and scoring nobody, standing down on the last rung, the
    strip clearing on Reveal, a race offering none, and a round that declares nothing
    reading exactly as before. `grouping,qbench` 189/0; the shared sweep over
    `qbench, grouping, anagram, card, gameshow, millionaire, fit, phone, turns, lab,
    registry, competition` 517/0 — including the Daily Double wager, which is what
    `hideAllActionButtons` no longer skipping `wager-ok` put at risk.
  - **No classroom run**, like everything else on that board. The thing to watch is
    whether a second button beside Check is read as an equal option under time — it
    is deliberately quieter, and that is a guess.
- **The shelves announce themselves, and the always-check stopped carrying a list.**
  Two tooling changes that exist because the expensive mistake here is never a hard
  bug — it is writing a second copy of something that already exists.
  - **`tools/shelf.js`** loads the registries and prints every `Kit.round` / `Kit` /
    `BenchKit` helper with its call shape, derived exactly as `question-types.js` is.
    **A `PreToolUse` hook in `.claude/settings.json`** runs it before any edit to
    `rounds/*.js`, `hub-rounds.js`, `hub-kit.js` or `bench-kit.js` and hands the
    inventory back as context; silent for every other file. Proven firing, then the
    sentinel removed. It catches "you are about to rewrite something that exists";
    it cannot catch "this round is *missing* what its twin has", which is the
    Drag the Words agree bug and still needs the question asked at fix time.
  - **`check-syntax.js` had its own hand-typed file list and it had been wrong for
    as long as the rounds have existed** — `hub-rounds.js`, every `rounds/*.js`,
    `nef-1.js`, `unit-lab.js`, `bench-kit.js` and `hub-rounds.css` were all absent,
    so the one check that always runs was skipping the files most edited. It walks
    the directories now. It also asserts `dev.html`'s skills list matches
    `.claude/skills/` in both directions.
  - **`dev.html` leads with the three entry points** — hub, question bench, room
    bench — then the six skills (descriptions *fetched from the skill files*, so
    the page cannot describe a skill wrongly) and the commands worth keeping.
    Everything else is behind one fold. Its round and form lists were already
    derived and picked up both new rounds on their own.
- **A round declares its own editor — the last hand-kept list a new round had to
  join is gone.** The question bench held a table with one hand-written row per
  round (labels, sample values, `build`/`read`), and a round missing its row
  opened on the *previous* type's sample saying "not complete yet" with nothing
  anywhere naming the gap. It caught two rounds in a row — the information gap
  and Word Drop, both in one session. `editor:{labelA, labelB, build, read}`
  lives on the round now, beside the `sample` it already carried, and the bench
  asks the registry the way the menu, the content gate and `question-types.js`
  already do.
  - **It was also a second copy of the sample values, and they had drifted** —
    the table said grouping was about a courtroom, the registry said it was
    about ways of cooking food. The starting fields are `read(sample)` now, so
    the sample lives once.
  - **A round that declares no editor still opens**, with generic labels rather
    than a blank page: wrong in its wording, never wrong in its behaviour.
  - `Kit.round.list` went on the shelf with it — three editors parse a
    comma-separated field. Verified across all seven rounds: right labels, two
    fields vs three, and a build/read round trip that keeps what the editor has
    no field for (ordering's per-word glosses).
  - **Making the sample authoritative moved the bench's opening question, and
    the suite was carrying its own copy of the old one.** qbench tapped
    `verdict` on a handset for a bench that now opens on the cooking-methods
    sample. The fix is the one this project keeps re-learning one tier over:
    the checks ask `Kit.round.get('grouping').sample` instead of holding a
    list, so the next sample edit costs nothing. qbench 93/0.
  - **A `; echo "exit: $?"` after the runner reports the *echo's* status**, not
    node's — the sibling of the `| tail` trap already recorded under "Before you
    push". The runner itself is honest: it counted the throw as a failure,
    named it, and exited 1. Read the printed total, never the wrapper's code.
- **One rack on both benches: layout presets, linked teams, sticky panes.**
  `BenchKit.layout` puts the standard classroom divisions (2×2 · 2×4 · 3×3 ·
  4×4 · no phones) on the question bench and the room bench as one-click
  presets, remembered across both, 4×4 the starting default; racks reconcile
  rather than rebuild so a phone in the right place keeps its stream, and the
  question bench gained the room bench's per-phone ×. A preset wider than the
  board's team bar grows it through the board's own + Team path
  (`window.HubTeams.ensure`, same-origin, **grow-only** — removing a team stays
  a human decision because a team can be holding points). Three traps paid for:
  a board embedded in the room bench must not auto-rack its own phones (the
  room doubles); **auto-rack is off under `navigator.webdriver`** (`?rack=auto`
  opts a test in) because sixteen unasked phones broke four suite checks *and*
  saturate a plain-http relay's six connections so replies silently stop; and
  the rack panes are sticky, because anchored panes stayed behind the scroll as
  a small window over a dead gap.
- **The lane standard is a shelf now — `Kit.round.lanes`, `mustHold`,
  `arrangement`.** Four rounds (anagram, scramble, infogap, grouping) each
  hand-wrote the team-lanes picture and it cost exactly what hand-copies cost:
  "all teams from the start" was a four-file edit, and the agree-gating fix
  lived in one drag round for days while the other lacked it. The lanes renderer
  owns which teams show, the colour, the name, the agree chip and the count; a
  round supplies only `lane(t) -> {cells, count, agree, full}` and an optional
  `.rlanes-<kind>` CSS modifier for its empty-cell look. `arrangement()` is the
  drag rounds' shared positional reader (gaps stay gaps, per-position counts,
  full-sequence tallies for agree). All four rounds rewired in the same change —
  the rewiring is what proves a shelf — and the ordering ladder and choice's
  option-anchored dots deliberately stay their own pattern. A rule change to the
  lanes is a one-file edit now, and a new round gets the standard by calling one
  function; the `new-round` skill says so instead of carrying the rules as prose.
- **Word Drop is the seventh round, and the first with graphics — a falling word
  the room steers by voting.** `game-hub/rounds/drop.js`: a word falls toward 2–4
  group bins (Tetris-shaped), everyone votes on their phones, the tile slides
  toward whatever the room is currently saying, and where it is when it lands is
  the room's answer. Each word falls a little faster. Co-op, class against the
  board — one tile cannot slide two ways, so a per-team race is a second
  iteration if the first earns it. Streak on the card, never points: rounds do
  not score.
  - **The vote steers, the landing judges — the first round where *time* closes
    the question.** Every other round settles when the replies settle. The round
    runs its own fall clock and asks the host for its next beat through
    **`ctx.again()`** ("re-arm the phones, redraw me"), the same voice `accept`
    uses to climb a ladder, with a timer as the trigger. Lent by the bench only;
    a host without it gets a teacher-clicked game — the bins are buttons and a
    click lands the tile now, which is also the no-relay path.
  - **A re-render must not restart the fall.** The bench redraws the card on
    every vote (that is how the steering shows), so the tile's position is
    computed from the fall's own start time on each render and the CSS
    transition covers only the remaining time.
  - **The bench's shared plumbing reads `chosen`/`need`/`picks` off every
    round's state** — a round that uses none of them still has to carry them or
    the draw crashes. Found by the round's own Playwright drive, not by any
    suite.
  - Arm is a plain vote with rethink, fresh per word (the last word's votes must
    not steer this one); `arm()` returning null now means "nothing left to ask"
    and the bench disarms on it. `prefers-reduced-motion` gets a static tile
    with a countdown instead of a fall.
  - Proven with Playwright: vote lights the bin and moves the tile, the landing
    verdicts by the leading vote, the next word arms itself, teacher click lands
    immediately, the game ends in a right/wrong summary and the phones stand
    down. **No classroom run; the fall times (9s→4s, −700ms per word) are
    guesses.** Bench-first: no game show hosts it yet, deliberately.
- **The information gap is the sixth round — the first to put a different prompt on
  every handset, which is the technique the whole direction section said was one
  step away.** `game-hub/rounds/infogap.js`: the author stars the key words of one
  sentence (`The jury *deliberated* … a *unanimous* verdict`, the errorfix
  convention); each phone on a team is dealt the sentence with a *different* starred
  word blanked and its teammates' words visible in caps, so the only way to fill
  your blank is to ask the people beside you. Typed answers, `Kit.answer.judge`,
  a wrong word told to ask the team, a near-miss told to fix the spelling — both
  sent as the `wrong` verdict, because that is the only one the handset reopens the
  box for, with the note carrying the difference. The card blanks every key word
  (the projector is the one screen nobody may read an answer off) and fills a lane
  per team, Drag the Words' rule: being copied is the cost of being ahead.
  - **`promptByPlayer` is the relay's part** — `{playerId: string}` on the arm,
    merged into the per-recipient `armed` payload and the join payload, falling
    through to the room-wide prompt for anyone not named. Keyed by player id
    because that is what survives a reconnect: the same phone gets the same view
    back. Carried unread, exactly as the relay never learns an answer. ~15 lines.
  - **What the build-order item 2 actually turned out to need was smaller than the
    item.** "Round state that outlives one question" was still unbuilt then
    (~~and still blocks Bingo-shaped ideas~~ — since built, as `ctx.keep`) — but
    the info gap only needed a per-player *prompt
    within* one question, and the per-recipient arm path already existed. Check
    what a round needs per player before concluding it is blocked.
  - **`ctx` lends two new things, both hosts:** `roster` (`[{id,name,team}]`, read
    fresh exactly as `sizes` is) and `verdict(id, verdict, note, coolMs)` — the
    round says how a typed word was received, the host owns the wire. Deal is
    derived from the roster deterministically (sorted ids, round-robin over the
    gaps), so `arm()` re-deals identically after any reconnect.
  - **The verbatim-carry promise was a hand-copied key list, and it had already
    gone stale.** `phoneRoundNow` and `askPhones` copied `multi, multiByTeam,
    holds, rethink, team` by name — `optionsByTeam` was never in the list, so a
    mid-round re-ask silently dropped the ordering race's per-team pools, and
    `promptByPlayer` would have died the same way. Both spread the round's own
    object now. The relay ignores what it does not know.
  - **The bench's `EDITORS` table is a hand-kept list a new round must join** —
    the one registration the registry does not do for you. Missed it first: the
    bench listed the round and opened it on the previous type's sample, saying
    "not complete yet" with nothing anywhere naming the actual gap.
  - Teams smaller than the gap count play the first gaps; larger teams double up,
    and then *each* of the doubled students has to produce the word. A team with
    no phones gets every gap on the card — the teacher clicks a blank as the class
    says its word, then Check, which is the no-relay path degradation demands.
  - Proven end to end with Playwright on the bench: four phones in two teams,
    views differing inside a team, a wrong word coached, two right words filling
    the lane and taking the question — plus a raw-HTTP relay test of the
    promptByPlayer fall-throughs. `qbench`, `grouping`, `anagram`, `buzzers`,
    `reconnect`: 248/0. **No classroom run yet**, and the numbers in it are
    guesses (cooldowns 1.5s/2.5s, caps 2–5 gaps, 180-char sentence).
  - ~~Not yet in any Lab or unit content~~ — **closed the day after**: NEF Unit 1
    carries an Information Gap category in both sections plus a hidden hexagon in
    each Blockbusters section (see below). The Lab board still has none, and
    Units 4/5 still carry no round content at all.
- **Four of the five classroom reports are fixed; the fifth was two bugs and one of
  them is fixed too.** Worked through with reproductions first, each proved against
  the broken build:
  - **A phantom phone can be kicked, and the room heals.** The relay only dropped a
    player on stream close, and a handset that dies without closing lingers —
    inflating its team's size, which locks Connections (a ghost on a team of 3
    makes the share 1 each; three phones can never assemble four) and makes every
    all-agree gate unreachable. The join lobby (SHOW QR) now lists every phone in
    its team colour with a remove control; the relay tells the phone first (a live
    one kicked by mistake sees why and can rejoin in two taps — and its seat is
    forgotten first, or a reload would resume straight back in), then runs the
    same leave path a stream close does, so shares recompute and replies re-read
    through the wiring that already existed. TCP keepalive on the streams
    (`setKeepAlive(true, 10s)`) makes the OS surface genuinely dead sockets in
    tens of seconds, for the phantoms nobody notices. **The room chip stays
    clickable while a clue is open** (same exception as the team bar, z-index 51
    over the card's 50) because mid-clue is exactly when a phantom is discovered.
  - **A round win has a winner's moment.** `roundWinBanner` (Questions group, on
    by default): after the take-beat pays, the shared `showResult` banner names
    the team and what it paid, lingers ~4s (`ROUND_WIN_LINGER_MS`, a guess like
    the 1.5s it fixes) and leaves by itself; the teacher's click outranks the
    timer, and a `resultSeq` guard stops a stale timer taking down a *later*
    banner (the game's final results, say). Offered only where a round has a slot
    one team takes — derived from the hosts' own `scoreEach` fact, so Quickfire
    is excluded structurally rather than by name.
  - **The anagram lanes are the answer populating — only correctly placed letters
    appear.** Three designs in two days, each fixing the last: the card first drew
    every team's furthest *attempt* (the class read several half-wrong sequences
    at once as a wall of jumbled words), then anonymous progress squares (no mess,
    but no information either — asked for by the user both times). The one that
    holds is Drag the Words' actual dynamic carried over: a lane shows the word's
    letters in their own positions as a team gets them right, so a rival's real
    progress is readable and worth stealing, and a wrong spelling never reaches
    the projector. **Which members must hold a letter for it to light follows the
    round's mode** — any member in a race, the whole team in agree — the same line
    the winning gate draws, with the same missing-roster fallback. This needed
    `read()` to keep replies *positional* (the wire format already was; the read
    compacted it), so gaps stay gaps and correctness is judged per slot. The
    handset is untouched. Pinned both ways in the `anagram` suite: the correct
    three show in place, a wrong placement lights nothing.
  - **Removing a team renumbers the phones — the wrong-team payout.** A team's
    index is its identity on both ends, and only the board's end shifted:
    reproduced by removing the middle of three teams, after which a win paid a
    team that no longer existed (and with other patterns, the wrong live team).
    `removeTeam` now sends `remap` to the relay, which renumbers its players
    (above the slot shifts down; on it lands on team 0), tells each moved phone —
    the pill repaints and the seat re-remembers — and refreshes the host through
    the same roster event a join uses, so cards, shares and replies all follow.
    **Adding or renaming teams was always safe**; only removal shifted indices.
    Whether the class also had students joined under the wrong team is still
    open — the phone's own pill is the tell.
  - **The smoke runner no longer truncates silently.** One suite throwing aborted
    every suite after it in the list — and the totals printed anyway, so a run
    covering three suites read exactly like a run covering ten. It was believed
    twice (the resume-fix run and the kick run) because `phonemodes` carries a
    deliberately-red check that *throws*. Suites now fail by name and the rest
    run. **A red total is trustworthy; a green-looking partial is not — check
    which sections actually ran.**
- **The bench card carries the clue card's own metrics now — the two were only
  ever the same code, not the same size.** Reported from the room bench: Drag the
  Words drew one row of words on the question bench and two on the projector.
  Both draw through the registry, but everything a round renders is sized in em
  off its host's base font, and the hosts differed: the hub's `#clue-text`
  resolves to 1.7rem on a 1280 board with 636px of content inside `#clue-back`,
  while the bench card gave the round the page's default 16px and 658px. So every
  tile was 40% smaller and the wrap points lied. The bench now pins the hub's
  numbers (`#card-prompt`/`#card-round` at 1.7rem, 40px side padding, 2px
  border), stated in a comment as mirrors of hub.css — it cannot load that file,
  which carries the whole hub theme — and the qbench suite asserts the pair, so
  if the clue card's geometry ever changes, the check says the bench stopped
  matching rather than nobody noticing. **The general rule: the bench is the
  source of truth for how a question reads, so anything the hub card sets that
  affects layout — base font, content width — the bench must set identically.**
- **A skin can have its own default for how a round is played.** Asked for from the
  bench: Jeopardy is team-based, so its Multiple Choice should start on "a team
  answers only when all of them agree" rather than first-tap-wins. Two declarations,
  no special case: `defaults:{game:value}` on a setting ranks below a teacher's
  override and above the master (see "Adding a feature"), and a host names which
  mode suits its board in `ROUND_HOSTS`, validated against the round's declared
  modes.
  - **It is one fact now, not a list per round.** Asked again for *every* round on
    Jeopardy — drag the letters should wait for the whole team too — and the
    obvious change was another entry in `modeDefaults` per round, which is the
    hand-kept list this project keeps paying for: a round written next month would
    play the wrong way on the board until somebody remembered. So the **round**
    declares which of its modes means the whole team commits (`teamMode:'agree'` on
    choice, anagram and scramble) and the **board** asks for whichever that is
    (`teamMode:true` on Jeopardy). Neither learns the other's business, and the
    next round arrives already correct.
  - **Ordering is the one named exception**, `modeDefaults:{ordering:'race'}`, which
    outranks the ask. Its modes are about *how many ladders* rather than *who has to
    agree* — reported as "only one ladder appears even when there are more teams",
    because on a team-vs-team board the shared climb reads as a single ladder.
  - The default round is untouched, and that is the property worth checking: it has
    four modes and no `teamMode`, so `round_default` — the old `phoneMode` — is not
    swept up by a board asking for team modes.
  Quickfire and Millionaire keep their races, and any host can differ with one line. The suite
  blocks that drive the *climb* lesson now state that mode explicitly rather than
  inheriting Jeopardy's default. The panel tells the truth
  about it in both directions — "This game's own default" on the game tab, "has its
  own value in Jeopardy" on the master row — because a game with its own default is
  a game the master row does not reach, which is the same silent-mismatch trap
  per-game overrides already paid for once.
- **The resume bug was never the phone's — the relay forgets every room on every
  push.** Last session's write-up said a resuming handset lands on "Waiting for the
  teacher" over a live round, and that `room.armed` "is only cleared by a buzz lock
  or a disarm, neither of which happened". Both observations were right: the room it
  happened in **no longer existed**. Rooms live in the relay's memory, the deployed
  relay restarts on every push, and a reconnecting hub silently recreates its room
  *empty* under the same code — then stays quiet, because `lastAsk`,
  `lastPushedTeams` and the rest all say the room already knows. Every phone that
  rejoined after that landed on "Waiting" until the next question opened — which is
  also why it always "worked again" by the time anyone looked closely, and why it
  haunted testing sessions specifically: that is when pushes happen every few
  minutes. A plain reload with the relay alive was never broken — checked on two
  rounds, quick and long disconnects, before finding this.
  - **The room announces which instance of itself is speaking** — an `epoch` minted
    when the room is created, carried on every `ready`. Same epoch is an ordinary
    reconnect: stay quiet, exactly as before, so the flicker fix is untouched (the
    `reconnect` suite pins both halves — `ready` carries an epoch, and a reconnect
    to a living room keeps it). A new epoch means the room knows nothing:
    `roomForgot()` voids every told-the-room memory, the ready handler's own
    `pushTeamNames` and `reaskPhones` then say everything again, and every bingo
    card is re-dealt from the host's own hands, marks included — same cards, not
    fresh ones, because the hands were always the originals.
  - **A phone now survives losing the race back.** EventSource retries *network*
    failures only; an HTTP error is final. After a restart the phones and the host
    race to reconnect, the host's first success recreates the room, and every phone
    that got there first was answered 404 and died — still saying "reconnecting…",
    which was a lie. `hub-buzzer.js` reopens a CLOSED stream itself, backed off; the
    relay re-sends full state on every connection, so nothing else was needed. The
    `replaced` path still closes for good, or two hub tabs would fight again.
    `joinRoom` now closes the previous client first, because a client that retries
    forever must not be abandoned still polling a dead room.
  - **Proved by restarting the relay mid-round**: on the old build the resumed phone
    *and* a fresh join both land on "Waiting for the teacher" with no puzzle; on
    this one both land back in the live arrangement.
- **Quickfire is the sixth game, and the first with no board at all.** A straight run
  of ~15 multiple choice questions against a clock. No geometry, no turns, no tiles —
  the only decisions in the room are made on the handsets.
  - **It wrote no question handling.** The Multiple Choice round draws the card, arms
    the phones, merges each team's taps and judges them. What is in the game is a
    sequence, a clock and a scoreboard. Second caller for F3.8.9 (a round mounted
    somewhere other than the clue card), which is what turns that from Millionaire's
    private exception into a declared fact.
  - **It authored no content.** It reads `millionaireBank`, already
    `{prompt, answer, distractors}`, so three units gained a sixth game with nothing
    written. Bingo did this first against `blockbustersBank`; two callers is a pattern.
  - **The one genuinely new thing is scoring by speed**, and it needed the shared
    settle path to grow a declaration. Every board until now had a slot one team
    takes, so the first right answer ended the question. A straight run has no slot:
    `scoreEach` on the host says every right team is paid for its own answer at its
    own speed. False everywhere else. The clock is read at `win()` time, so no round
    learned about time.
  - **Two things the screenshot caught and every assertion passed**: the scoreboard
    was off the bottom of the screen (the fit sized the stage, and the board sits
    below it), and it drew white-on-white under the game show skin. Same trap the
    round card paid for — a component cannot assume its host's background.
- **Three phone bugs, all found by playing it rather than by any check.**
  - **Opening a round now arms the room.** Four call sites opened a round and then
    separately had to remember to tell the handsets; nothing complained if one forgot.
    Quickfire forgot, and it reads as "the board shows four options and my phone says
    waiting for the teacher". Blockbusters had already shipped the mirror image.
    A host arms only when *no* round opened, as one expression, so it cannot be
    half-done. **Deliberately not solved by making `askPhones` idempotent** — the
    ordering climb and the Millionaire steal both re-arm the same question on purpose,
    and a guard there would silently turn them into no-ops.
  - **A phone was spent for the whole run after one answer.** `keepSpent` defaulted to
    true for any round that did not mention it, so the relay never cleared its list.
    Dormant for as long as it existed, because all five shaped rounds set
    `rethink:true` and the relay never marks a player spent when they may change their
    mind. Quickfire is the first round to ask for a locked-in answer, and the two
    together made a game that stops working after question one. **A default that has
    never been exercised is not a default that works.**
  - **Whether a tap is final is the skin's, not the round's.** `lockIn` on the host;
    the round honours it **except in `agree` mode**, where a final first tap would make
    it unplayable. The round protects its own contract rather than trusting the host.
- **Drag the Words draws a lane per team now, not a count.** The old code carried its
  reasoning inline — a sentence is too long to redraw per team — and playing it showed
  that was wrong in the way that matters: a number says *that* somebody is ahead and
  nothing about what they have. Two teams, two sentences completing side by side.
  **Only correct placements show, and that is the dynamic**: a team behind can read a
  word off a team ahead, so being in front costs something.
- **An arrangement did not survive a reconnect, and half of that is fixed.** Reported
  as "the sentence resets on the phone in Jeopardy but not on the bench" — the premise
  was right and the trigger was not a mistake. Placing every word wrong resets nothing;
  so does the teacher checking a wrong selection. What resets it is the handset
  reconnecting, which a real phone does constantly and an iframe on localhost never
  does. The relay had held each player's reply all along and the restore was written
  for `vote` only; it covers `arrange` now, and the wire format is positional so a gap
  comes back as a gap.
  - ~~**Still broken:** a handset that *resumes its seat* lands on "Waiting for the
    teacher"~~ — **resolved, and the resume path was innocent**: the trigger was the
    deployed relay restarting on every push and wiping the room. See the bullet at
    the top of Current status.
- **All five rounds are in both sections of New English File Unit 1** — six new
  Jeopardy categories, thirty clues, written through the `author-content` skill. The
  gate caught a fourteen-word sentence against a cap of twelve, which is what a handset
  can lay out in one row: a real constraint on how these are written.
- **Every question in the app is a round now — F3.8.16, and the last "is this a round
  or not" branch is gone.** Written up in full at the top of this file; the short form
  is that `game-hub/rounds/default.js` wraps an ordinary question, `phoneMode` became
  `round_default`, and the settings loop grew no special case because a round may now
  declare a `modeSetting` for how its own row is registered.
  - **Nothing on screen moved**, which was the whole target. The ⚙ row still reads
    "What the phones do", still sits with the phone switches, still offers the same
    four values. A teacher cannot tell.
  - **The migration is the part that was tested hardest**, because a broken one
    silently resets everybody's saved settings and looks exactly like a default. Three
    generations survive, per-game overrides included. Four new checks, and they are
    real passes rather than coincidences: each asserts a value that differs from what
    the setting would default to.
  - Migration 20/20, registry+scoping 58/58, settings+lab 56/56, qbench 91/0,
    content 18/18. The phone suites went 10 passed / 3 failed to 18 / 3.
  - **Found a real bug on the way, and it had shipped**: *Ask the class* disabled
    itself for the whole first question of every Millionaire game, saying there were no
    phones in a room the class had just joined. Millionaire deals its first question
    inside `start()`, before the room's code comes back, and nothing repainted the
    button. Blockbusters' vote button had been fixed for exactly this a session
    earlier, one line above in the same handler.
  - **Millionaire's buzz settings are dead, and that is an open decision rather than a
    defect to patch.** Its ladder became a round host last session, so `phoneRound()`
    always returns the round and `mBuzzRole` (speaker / floor / off) can never fire.
    A teacher picking "buzz for the floor" there gets four options on the phone.
    Confirmed as pre-existing by running the suite against the previous build. Three
    checks are **deliberately left red** describing it — rewriting them to pass would
    encode "the buzz is gone" as intended when nobody has decided that.
- **The first round content a class can play, and a second coursebook.**
  - **Unit 5 section 5A** gained a Connections and a Word Thermometer column in
    Jeopardy plus five round hexagons in Blockbusters. Before this, no round had ever
    been playable outside the Lab board — the largest gap in the project, closed.
  - **`game-hub/content/nef-1.js` — New English File 5th ed Unit 1**, 151 items,
    authored **with rounds from the start** rather than given them afterwards. A
    quarter of its Jeopardy content is played rather than read out. That is the
    difference worth measuring: 5A is rounds bolted onto a finished unit, this is not.
  - **Blockbusters' round hexagons are filed with the ordinary ones on purpose.** A
    Jeopardy column announces its type in the heading; a hexagon does not, so you take
    `R` without knowing whether it is a definition or five words to order.
  - **The gate caught the one defect eyes cannot**, twice: a section label whose count
    had drifted, and the same prompt written into two banks.
- **One name per round, and it had drifted three ways at once.** A round has an **id**,
  which is code, and a **label**, which is the only name a human should see — and the
  label had no single home, so a category name (a hand-typed string in a content file)
  could invent a second name for a round that already had one. `group` was
  *Connections* in the Lab and *Find the Four* in 5A; `anagram` and `scramble` each had
  a third variant in their registry labels. The table is under "One name per round".
- **`author-content` is the sixth skill, and `tools/question-types.js` is what keeps it
  from rotting.** The five existing skills all build *machinery*; none covered writing
  questions, which is the job that actually comes up now the machinery is finished.
  - **The skill holds no list of question types.** It runs the tool, which asks the
    registries — every round's label, blurb, item field, ways to play and sample shape,
    plus every form and the boards it suits. A round written next month appears in it
    with nobody editing anything.
  - That needed each round to **declare** its authoring shape rather than only describe
    it in a comment: a `sample` field on all five. The round now documents itself to
    code and not just to a reader.
  - The tool loads the registries under a minimal DOM stub. `hub-engine.js` is
    deliberately not loaded — it injects a whole application.
- **The skills rot silently, and three of them had within hours.** `phoneMode` became
  `round_default` in the morning and was still named in `new-game`, `new-mode` and
  `phone-debug` in the afternoon. `phone-debug` was the damaging one: it hands you
  `HubSettings.get('phoneMode', …)` as the *first* thing to run when phones misbehave,
  which now returns undefined — so the next person would have concluded the setting did
  not exist, while chasing a phone bug, which is when a wrong lead costs most.
  **Nothing mechanical can catch this**: a skill is a markdown file and nothing reads it
  but a model. Check the skills whenever the thing they describe changes.
- **The cache stamp instruction was a hand-kept list and it had drifted two days.** It
  named four shells; the four `playground/` pages were never in it, so the question
  bench was serving round files from before the rounds were renamed — which reads as
  the bench being broken rather than as a stale asset. It finds the pages by search
  now, and **the date shape in the pattern is load-bearing**: `classic.html` carries
  `?v=picture` and `?v=unit1`, which are content selectors, and the old looser pattern
  would have rewritten them into a broken page.
- **The content pool was asked for and then decided against in the same conversation**,
  once the shape was clear — see build order item 8. What was actually wanted from it
  is the `author-content` skill.
- **Millionaire draws every question through the multiple choice round, and it is
  the first round content a class can actually play.** All 52 Unit 5 items became
  rounds with **no content edit**: the bank stays `{prompt, answer, distractors,
  level}` and Millionaire normalises it into `{text, choice:{options, answer}}` when
  the question opens — the same move `jShowClue` makes turning `q` into `text`. The
  ladder still needs `level`, and the round never learns this bank's field names.
  - **It needed the contract addition the build order said it would not.**
    Millionaire has no clue card, so this is **F3.8.9 — a round handed a mount that
    is not the card**, which the spec listed as *not built*. Every `Kit.round` call
    site assumed `#clue-group` inside `#clue-text`, and the commit button gated on
    `modalMode`, which a game with no modal can never answer. Both are declared facts
    now (`mount`, `live`, `commit`), and the two card boards share a `CARD_MOUNT` and
    are behaviourally unchanged.
  - **`render(mount, …)` sets the class on the mount itself**, so `#m-options` *is*
    `.round-choice`. The first version of the stage CSS used a descendant selector
    and therefore did nothing at all — the options drew as enormous white boxes with
    the round's light-card palette on a dark stage. **The screenshot caught it and no
    assertion would have**, which is the rule about looking rather than measuring,
    met again.
  - **The lifelines were remapped, not dropped.** 50:50 sets the round's `hidden`
    list — narrowing a choice is a generic hint mechanic, not a Millionaire feature —
    so the two stay on screen struck through and leave the handsets entirely.
    **Ask the class no longer runs a second vote against the round's own**, which
    would have re-created the two-dynamics-one-handset bug by design: the room votes
    on every question now, and the lifeline reveals counts the board is already
    holding. Confer is untouched.
    - **With no relay it is disabled and says why.** There is nothing to reveal, and
      the old hands-in-the-air tally is gone. A real loss, and the honest trade for
      the round owning the room.
    - **A count, not team dots.** `ctx.countVotes` — on a tile the interesting fact
      is *which teams* went where; here it is *how many people* did.
  - **A single pick moves now rather than needing to be cleared first.** At a cap of
    one a full selection swallowed the click, so choosing B after A did nothing —
    which is exactly the show's "say the letter, then lock it in" beat, where moving
    the nomination is the point of the pause.
  - **A question ending reveals the round.** On a tile the card flips away and nobody
    needs telling; here the options stay on screen, so ending without revealing left
    four live-looking options and no answer.
  - **Who a teacher's answer scores for stayed `active`**, deliberately. Generalising
    it to the team on turn changed Blockbusters — arguably for the better, since with
    no phones `active` is whoever last touched a buzzer — but that is a behaviour
    change to a working game nobody asked for. `scorer` defaults to `active` and only
    Millionaire overrides it, because after a steal the question belongs to a team
    that is not `active`.
  - **This makes "no round has ever been played from a class-facing unit" false**,
    for Millionaire only. Jeopardy, Blockbusters and Race still carry no round content
    in Units 4 and 5, and Unit 4 has no Millionaire bank at all.
  - **On the Lab board too**, section `LM1` — sixteen items, two at every rung,
    added so all three round hosts sit on one board and a round can be tried in each
    of the three skins without changing page. It is also live in the class-facing hub
    (Units 4 and 5, 156 questions between them).
  - `millionaire` 20/20; `grouping,millionaire` 108/0; the broad run over `fit`,
    `phone`, `gameshow`, `registry`, `lab`, `scoping`, `turns` and `competition` was
    369/1 before the scoring decision above, and that one check was it.
- **The content screen says whether a tick box holds questions or rounds**, on every
  board. Reported as: choosing categories in Jeopardy, there is no way to tell a
  simple question from a round — and those are two different lessons, so choosing
  between them blind is choosing blind. Four states, in the question bench's own
  vocabulary: `Question` · `Round · Connections` · `Rounds · 5 types` ·
  `Mixed · 6 rounds`.
  - **A round can be *derived* rather than authored, and that was missed first
    time.** Millionaire's items carry `{answer, distractors}` and no round field at
    all — the round is built when the question opens — so asking the raw item
    reported a whole ladder of rounds as `Question`. The game declares how its bank
    becomes a round (`asRound`, identity by default) and the chip asks through it.
    One definition: Millionaire's own deal uses the same function, because two
    copies would be two things that could disagree about what a question is.
  - **Derived from the items, never labelled on the category.** `contentKind()` asks
    `Kit.round.of()` what each item wants, exactly as the clue path and the content
    gate do. A category that *declared* it held rounds would be a second copy of a
    fact its items already carry, and it would be wrong the first time somebody
    edited one. A round written next month labels its content here for free.
  - **One helper, every game show**, because all three content builders end up as
    `.cat-check` rows — Jeopardy picks named categories, the rest pick sections — and
    a teacher should not learn two vocabularies for one distinction.
  - **It makes the content gap visible.** Every row in Units 4 and 5 reads
    `Question`, because those units carry no round fields at all. That is the honest
    picture and it is now on screen rather than only in this file.
  - `sectionCheckboxes()` is dead code (defined, never called) and was left alone; it
    would need the same chip if anything ever calls it.
- **`dev.html` is the development hub — every link in the project on one page.**
  Built because "what is the URL for the thing we were working on" was being asked
  repeatedly, and the answer differs by origin. Linked from `index.html`.
  - **The lists are derived, never typed out.** Rounds come from `Kit.round.ids()`
    and forms from `Kit.prompt.types()`, so one written next month appears on its
    own. A hand-kept list of links rots exactly like a hand-kept list of games —
    the difference is that it rots *silently*, into a dead link nobody clicks until
    they need it. It loads the registries only: `hub-kit.js`, `hub-rounds.js` and
    `rounds/*.js` are data-only, so asking them what exists starts no game.
    `hub-engine.js` is deliberately **not** loaded — it injects a whole app.
  - **It says which copy you are looking at**, which is the confusion that cost two
    rounds this session: GitHub Pages has no relay behind it and neither does
    `file://`, so both are stated at the top rather than discovered when the phones
    will not join. Every card also prints its absolute URL, for copying.
  - **The bench takes `?type=` now** (`r:ordering`, `f:anagram`, or a bare name —
    `resolveType` already handled one). That is what makes a round or a form a real
    link rather than a name you then have to find in a menu. An explicit type
    outranks the remembered set and resets the item in hand to its sample, exactly
    as the menu's own change handler does.
- ~~**No round has ever been played from a class-facing unit**~~ — **closed, and it was
  the largest gap in the project while it stood.** Kept because the shape of it is worth
  not re-learning: the capability was in the engine *everywhere* and the content was
  nowhere, so nothing was broken and nothing worked. Jeopardy or Blockbusters would have
  hosted a round on Unit 5 the moment a Unit 5 clue carried one, and for two sessions
  none did. Unit 5's 5A and the whole of New English File Unit 1 carry them now; **Unit 4
  still carries none**, which is the remaining half of it.
  - **Worth knowing before reading a bug report about it.** Unit 5 *does* have
    `type:"anagram"` items — those are question **forms** (scattered letters on the
    card, no phones), not the anagram **round** (letter tiles dragged on every
    handset). The two sit side by side on the Lab board precisely so they can be
    compared, and they are easy to confuse from the outside.
  - **The Lab is not a different app**, which is the other thing that reads wrong from
    outside. `game-hub-lab.html` loads the same engine, the same five games and the
    same clue card as `game-hub.html`; the only difference is that it loads
    `unit-lab.js` instead of Units 4 and 5. A separate engine for testing would have
    proved nothing about the real one. It is reachable only from `index.html` and its
    own URL — deliberately no route to it from inside the hub, because Lab content is
    half-tuned by definition and a button is how one reaches a projector mid-lesson.
- **A hexagon opens a round now — Blockbusters is the second host, and it needed
  no change to any of the five rounds.** That is the whole measurement. A shelf
  with one caller is a guess about an API; the five rounds were *shaped* by
  Jeopardy, so of course they fitted it, and a second board was the only thing
  that could tell the difference between a tier and one game's helper. Eleven
  hexagons on the Lab board (`LB1` mixed, `LB2` rounds only).
  - **The letter was never a constraint — it is the hexagon's *name*.** Checked
    rather than assumed: it is used in exactly three places (the hexagon's face,
    the clue topline, and the picking vote's options), and `bbOutcome()` searches
    *claimed* hexagons without ever reading it. So "the answer starts with the
    letter shown" was a rule about the **bank**, not about the board — dropped for
    round clues, kept for ordinary ones, and enforced as before by the content
    gate for anything that has an answer at all.
  - **Every hexagon still carries a letter, and that is not sentiment.** It is how
    a team says which square they are attacking, and it is what `bbOpenLetters()`
    counts when the team on turn votes from their phones. Removing it would have
    broken the vote for a cosmetic gain. Keeping it makes the surprise the point:
    you take `R` and you do not know whether you are getting a one-word definition
    or Connections — which is what the geometry buys that a Jeopardy category
    cannot, because a column announces its question type in its heading.
  - **A host is four declared facts, not an adapter.** `ROUND_HOSTS` names, per
    board: which game's settings scope the round (`game`), which modal mode it
    belongs to (`modal`), which stage is lit so the sting only plays under the skin
    (`stage`), plus `turn()` and `win()`. Everything that used to say `'jeopardy'`
    by hand reads the table. **A third host is an entry in it** plus the two calls
    its clue path makes — `jGroupOf(item, '<host>')` and `jGroupOpen`.
  - **`win()` returns what it paid**, because the phone strip names the student
    *and* the amount, and a tile and a hexagon are worth completely different
    things. Blockbusters routes it to `claimHex`, which already did the colouring,
    the side advance, the turn and the win check — so a round pays out through the
    board's own claim path rather than beside it.
  - **The host is named at `jGroupOf`, not at `jGroupOpen`.** `setup` is handed a
    `ctx`, and the ctx is scoped to whichever board is asking — the mode, who is
    entitled, how many are on that team. Declaring it second would set the round up
    against the *previous* board, silently, and only on the second clue.
  - **A skin's own affordances have to stand down while a round is live.**
    Blockbusters scores by claiming, so the team chooser is a second way to award
    the same hexagon — it is hidden until the round is over and put back on Reveal.
    Jeopardy already had this shape (Correct and Wrong only exist after Reveal);
    the general rule is that **a live round owns the verdict**, so whatever the
    board's equivalent is has to give way.
  - **`ROUND_HOSTS` sits above the settings block so the games list is derived from
    it.** `games: gameIds()` was exactly this mistake once and it made the fifth
    game a second-class citizen. Everything the table references is either a
    hoisted function or read at call time, so it can be declared before any of it
    exists.
  - **Two settings stopped being Jeopardy's and were renamed rather than widened.**
    `jGroupWho` → `roundWho`, `jRound_<id>` → `round_<id>`, both in the shared
    `Questions` group and offered to both hosts. A shared setting carrying one
    game's initial in its id is a name that is wrong for as long as it exists — and
    **a per-game override is exactly what a teacher set deliberately**, so
    `migrateRoundSettings` translates them rather than leaving them under keys
    nothing reads. Same two traps as `migratePhoneModes`: the old key being present
    *is* the signal (asking whether the new id is unset never fires, because
    `register()` seeds every master with its default), and `drop()` is what makes
    it run once.
  - **The content gate splits the same way the Jeopardy block does**: the round is
    asked its own rules through `check(item)`, and what stays is this bank's
    tidiness — a round clue that also carries an `answer` or a `type`, and the
    letter every hexagon owes. The one-word and initial rules are asked of ordinary
    clues only, because a grouping set has four answers and a scale has five.
  - **The gate caught nine duplicated prompts the moment the bank was written**,
    which is the per-game authoring rule working exactly as intended — the Lab
    Jeopardy board already had "Rebuild the sentence" and "Put these in order —
    least certain first". Same *answer* in two games is spaced retrieval; same
    *prompt* is the thing the rule exists to stop.
  - **The replies have to come back in, not just go out — and that shipped broken.**
    Reported as "the phones activate, I can see the question card, but the thermometer
    ladder doesn't light up when I input the correct answer." `phoneRound()` was
    declared on Blockbusters and `onVoteReply` was not, so it still fed only the
    hexagon-picking vote: the room was armed correctly and every tap was dropped on
    the floor. **The failure is silent by construction** — both ends behave, and
    nothing anywhere says the two are not connected.
    - **The generalisable bit: a phone dynamic is two wires, and declaring one looks
      exactly like declaring both.** Anything that arms the handsets owes a path for
      what they send back. Jeopardy's pair sit two lines apart in its registration;
      Blockbusters' did not, and no check noticed because the new checks drove the
      *teacher's* path — clicking the card and pressing Check — which works whether
      or not a phone can reach it.
    - **`wantsVote` had the same hole**, so the chip read `idle here` over a room
      being asked a round. Both now ask `jGroupLive()` first, exactly as Jeopardy
      does; a vote and a round can never be open together anyway, because opening a
      hexagon ends the vote before the round starts.
    - Proved by reverting: the ladder stays empty with all five words in the pool,
      which is precisely the reported symptom.
  - **No suite of its own yet.** Verified by driving it in a browser: a choice
    round claiming its hexagon and scoring, a grouping round revealed and then
    claimed by hand, and an ordinary letter clue untouched — plus a screenshot at
    1280×720, because the card is drawn in the Blockbusters skin and nothing
    measured would have shown whether it read. The `blockbusters`, `grouping`,
    `card`, `gameshow`, `registry`, `lab`, `scoping` and `content` suites all pass
    unchanged, which is the evidence that nothing shared moved under them.
- **Word order is the second round grown out of a form, and it cost almost
  nothing — which is the point of having built the anagram one first.**
  `game-hub/rounds/scramble.js` — a shuffled sentence and a numbered slot for each
  word, dragged into order on every handset. Thirteenth category on the Lab board
  (`L8 · Drag the Words`).
  - **`arrange` needed no change at all.** The mode takes a list of strings and
    reports the order they were placed in; a word is only a longer string than a
    letter. The relay was untouched, the drag was untouched, and the handset needed
    a *layout* branch and nothing else. **Budget the next one against this, not
    against the anagram** — which is exactly what the anagram's own note said to
    expect, and is the first time that prediction has been tested.
  - **Words invert the anagram's layout rule.** Equal columns are right for letters,
    where every tile is one character wide; a sentence's words are all different
    lengths, so dividing the row equally makes `a` as wide as `retracted`. Words
    wrap and are sized to their content — the same split `#opts` already makes
    between a keypad and a list, and decided the same way, **by looking at how long
    the options are** rather than by being told which round is running.
  - **An empty slot shows its number.** A row of ten blank boxes tells a student
    nothing about which position they are filling. Letters keep blank boxes, because
    there the boxes spell the word and digits would be noise.
  - **Every slot is one fixed width — the widest word's, measured off the tray when
    the round is built.** This *reversed* an earlier decision ("slots grow as words
    land"), and the reversal was reported from the room bench: content-sized slots
    reflowed the row on every drop, so eight phones in different states showed
    eight different grids of boxes, which reads as the phones being formatted
    differently when they are the same page in the same state machine. The rule
    that survived from the first decision is the one that matters: **sizing each
    slot to its own word would give away the answer's shape** — one uniform width
    gives nothing away, because the tray under the boxes already shows every word.
    The ladder's rungs still never resize, for the ladder's own reason (lanes that
    must line up).
  - **A count per team, not the words.** A sentence per team will not fit on a clue
    card; what the room needs from the projector is who is close, and the teacher can
    read an actual attempt off that team's handsets.
  - **Judged case-insensitively**, because a sentence's first word is capitalised and
    a student who put it third has still put it third — marking that wrong on a
    capital letter would be marking the wrong thing.
  - **Repeated words are the repeated-letter problem again**, solved identically:
    `the` appears twice or three times in most C1 sentences. Every clue in `L8`
    repeats a word on purpose, for the same reason `$400` and `$500` in `L7` do.
  - **No suite of its own**, at the user's request — the fast content gate covers the
    authored clues (it asks the registry, so `check()` runs for free), and it was
    verified by hand in a browser: card, handset, one drag, and the board updating.
    The `anagram` suite is the model if it ever earns one.
- **Opening a room retries now, in the hub *and* on the bench — the common failure
  is a relay that is merely asleep.** Reported as "it says no relay and I can't
  select any phones for any question". Both ends attempted `newCode` **once** on
  load and, on failure, settled on `phones off` and never tried again: a hosted
  relay on a free plan spins down when idle and takes the better part of a minute
  to wake, so the *first* load of a lesson failed and the room stayed shut for the
  hour. The class cannot join a room that was never opened.
  - **Backed off, not hammered**, and it says `Connecting…` while trying — a room
    that is about to exist and one that never will are different facts, and only one
    of them is worth reloading for. Eight attempts over about a minute.
  - **The chip is the way back in**: out of attempts it reads `phones off · tap to
    retry`, and tapping it starts again. A dead end with nothing on screen saying
    what to do was the whole complaint.
  - **The hub's promise had no `.catch` at all**, so an unreachable relay threw and
    the chip kept whatever it had said before — not even the "no relay" message.
  - **One source for the state, because two labels for one fact is what started
    this.** `BenchKit.room` reports `connecting`/`ready`/`off` and the bench's
    `+ phone` button follows it, instead of reading `no relay` beside a chip reading
    `connecting…`.
  - **A page that can never have a relay says so at once, rather than trying.**
    The retry made the *GitHub Pages* copy worse before it made it better: it sat on
    `connecting…` for a minute on a page where a relay cannot exist, which is more
    misleading than the silence it replaced. The hub has known this since buzzers
    shipped (`buzzerProblem` names Pages and `file://` by hand); the bench never
    learned it. Both are stated immediately now — `no relay on GitHub Pages` /
    `opened as a file` — with the fix in the tooltip. An explicit `?relay=` is
    always tried, whatever the page is served from.
  - **The degradation checks were pinned to the wrong thing** and went red on the
    fix: they asserted the chip says `phones off` within a second. What a page with
    no relay actually owes is that it stays playable and never claims a room nobody
    can join, so they assert *that* now. Pinning the wording pinned the giving-up.
- **The anagram round: the first round grown out of a question *form*, and the
  first phone dynamic the relay had never carried.** `game-hub/rounds/anagram.js` —
  scrambled letters on the card, a row of empty boxes under them, and every handset
  dragging the letters into place. Twelfth category on the Lab board
  (`L7 · Drag the Letters`).
  - **The form it grew out of is untouched, and that is the load-bearing decision.**
    `Kit.prompt`'s `anagram` form still draws scattered letters and re-sorts them on
    reveal; a board with no phones wants exactly that. The round is keyed by a
    different field (`anagram:{word}` against `type:'anagram'`), so the **eight items
    already authored in Units 4 and 5 behave exactly as before**. A round claiming
    the form's own key would have silently converted shipped content a teacher has
    been using, which is the one thing a new round must never do. Both sit on the
    Lab board on purpose: same vocabulary, and the only difference is whether the
    class shouts the word or every handset arranges it.
  - **`arrange` is a new phone mode, and it is the first thing the relay has had to
    learn since bingo cards.** One string added to a whitelist — the reply is the
    same `|`-joined list in placement order that a multi-pick vote sends, so the
    relay carries it without interpreting it, exactly as its contract says. What
    differs is entirely what the handset *draws*.
  - **Duplicate letters are what this round is really built around.** `SENTENCE`
    has three Es. Every pick in this app is keyed by its **text** — `join.html`
    matched `myPicks.indexOf(x.textContent)` — so the first E would have stood for
    all three and the word could never be assembled at all. Two different fixes,
    because the two ends have different handles: the **card** gives each tile a
    token (`E#3`, drawn as `E`) and the **handset** keys by slot index. `judge`
    strips the token, so the teacher's clicks and the room's drags arrive as one
    shape and the phone never learns the token format exists. **Author a word with
    repeated letters before believing any change to this file**; `$400` and `$500`
    on the Lab board are there for that.
  - **A tap does the same job as a drag, and that is not a nicety.** Dragging on a
    small screen misses, and a letter that refuses to move because the thumb
    travelled four pixels reads as a broken round. A tap on a tray tile fills the
    first empty box; a tap on a full box empties it. Both gestures, one code path,
    separated by how far the pointer moved.
  - **The handset divides the row; it never wraps it.** A fixed minimum tile width
    wrapped a seven-letter word to six-and-one on a 390px screen, which reads as a
    mistake rather than as a word — and the stray box on its own line is exactly
    where a thumb aims first. Both rows are a grid of `n` equal columns now (`--n`
    set from the arm, because CSS cannot count the children it is laying out), so
    the word is one line at any length **and the tray sits under its own boxes** —
    the letter being dragged is directly below where it has to go. The tiles shrink
    instead: ten letters is 29px, which is the intended answer rather than a
    failure, so the check asserts the *row count* and not the width.
  - **Three things the drag needed that are not obvious.** `touch-action:none` or
    the browser claims the gesture as a scroll and `pointermove` stops arriving
    mid-drag. The tile that follows the finger carries `pointer-events:none`, or
    `elementFromPoint` returns the clone on every move and no box is ever found.
    And the tray keeps a letter that is in a box, greyed — removing it reflows the
    tray under the thumb mid-puzzle.
  - **The letters are *not* shared across a team's handsets**, which is what
    `Kit.round.shares` exists for and what grouping does. An arrangement is a
    sequence and a sequence cannot be merged: two students holding three letters
    each do not combine into a word — somebody decides the order, and the moment
    they do the other handset is a spectator. Same conclusion the ordering round
    reached about a scale.
  - **The bench menu had to namespace the two registries.** `anagram` is now a round
    *and* a form, and the bench's single flat menu keyed by name alone let the round
    shadow the form completely — the form became unreachable, which is the exact
    failure the prompt lab was built to stop. Menu values are `r:` / `f:` prefixed
    now, with a migration for anything stored under a bare name. **Expect the
    pairing to recur:** a round is often the played version of a form.
  - **A round with two editor fields needed no bench change at all**, because the
    form merge had already made that the editor's own declaration (`labelB:null`)
    rather than a question about what kind of thing was being edited. That is the
    return on writing it that way, a day later.
  - **`judge` says how close a wrong arrangement was** — "four of seven letters are
    in the right place" — because that is the only useful thing to say about a wrong
    order, and a flat "no" tells a class nothing to act on.
  - **`check` catches the giveaway a reader misses**: an anagram whose own clue
    contains the answer looks completely normal written down. Also spaces and
    hyphens (they cannot be a tile) and anything over 12 letters (the relay's `multi`
    cap, and past what a class reads off a projector).
  - `anagram` suite, 32 checks: the Lab board hosting it, the teacher's no-relay
    path, the repeated-letter word end to end, a wrong arrangement's verdict, the
    form still drawing as a form, the card fitting at 1280x720 **and** 390x844
    (neither `fit` nor `phone` opens a clue card), and a real handset dragging,
    tapping and finishing the word while the board shows the progress.
  - **Not yet met a class**, like everything else on that board — and the drag is
    the part most likely to feel wrong under a real thumb, because Chromium's
    device emulation is not one. That is the first thing to check in a lesson.
- **One workshop for both kinds of question — the forms moved onto the bench.**
  The bench listed the three rounds and nothing else, so the six question forms
  were only reachable from `prompt-lab.html`, a second page with its own menu, its
  own samples and its own room. Reported as *"I don't see the anagram in the
  question bench"* — which was correct, and the answer ("different workshop") is
  not one a teacher should have to know before deciding which link to click.
  - **The two tiers stay two tiers; it was the *workshops* that were wrong.** A
    **round** is a question the class plays — card, phone dynamic, merging several
    students' taps, judging. A **form** is a way of writing one — render and
    reveal, no time, no turns, no phones. They keep their own registries, which is
    right, and the menu asks both: three groups, *rounds* · *forms in the kit* ·
    *forms lab only*. Nothing is listed by hand, so a round or a form written next
    month appears without this page being edited.
  - **The kit/lab split had to come with them**, and it is the reason the bench now
    loads `lab-forms.js` behind the same two-script-tag capture the lab used. A kit
    form is live in every game the day a bank item carries its type; a lab form can
    reach no game at all. `bridge` shipped invisibly once because that difference
    was nowhere on screen, so the menu says it in the group label.
  - **A form's editor is derived, not listed.** Every form has the same item shape
    — `{text, answer, type}` — and always will, because that shape is the whole
    reason a form can be added without touching a game or a content field. Listing
    the six by hand would be a second registry kept in step with the real one.
    Two fields rather than three, said by the editor (`labelB:null`) rather than by
    asking what kind of question this is.
  - **The form styling had to leave `hub.css`, exactly as the round card's innards
    did, and for the same reason.** A playground page cannot load that file — it
    carries the whole hub theme — so every form drew on the bench with none of its
    rules: the anagram's letters ran into the prompt as one line of text. ~100
    lines moved to `hub-rounds.css`, which the hub and the bench both already load,
    with `--yellow` and `--glow` (which no bench page defines) as fallbacks
    **inside each `var()`, never a declaration block**. **The screenshot found this
    and the assertions had not** — every check passed on the unstyled build,
    because they asked whether elements were created and never whether they read.
  - **The phones go quiet for a form, and that is the honest picture.** A form owns
    no phone dynamic by definition, so the Check button and the third editor field
    stand down rather than sitting there dead — a disabled control reads as broken.
    What a form does get is the one dynamic that suits any question at all:
    everyone types, judged by `Kit.answer.judge`, in a strip under the card.
  - **The declining diagnostic came across, because it is the one failure a form
    has that is invisible.** A form that looks at a prompt, finds it is not shaped
    for it and prints plain text is *behaving correctly*, and is indistinguishable
    on screen from the type having done nothing — which is how it gets reported as
    a bug. `render()` cannot tell you which happened (it hands back the type
    whenever the form *ran*), so the tell is the absence of element children,
    measured on a detached node.
  - **The load menu keeps two different rules on purpose.** Any round category,
    whichever round is in hand, with the type following what you load — the
    workflow the bench has always had, and what the suite pins. Only the form in
    hand for a form, because 336 authored items are gap fills and a menu holding
    every category in both units is not a menu.
  - **`q` and `a` go back on at the export.** A bank calls the prompt `q` and the
    answer `a`; neither a round nor a form has ever learned that. Exporting
    `answer:` would produce a category that loads without complaint and shows an
    empty answer line on every clue in it.
  - **Which boards a form suits is on the bench too**, and it was the one thing the
    lab had that the merge missed. It is the form's own declaration, read rather
    than restated — an anagram in Millionaire is given away by its four options, an
    odd one out in Race by the board — and an author who cannot see it writes a
    question that cannot work where they meant to use it. A **round** shows nothing
    there, and that is correct rather than missing: which skins can host a round is
    a question about *contention* (a round wants the card and the phones; a skin
    conflicts only if it already owns one) rather than about answer shape.
  - **`prompt-lab.html` is retired.** The bench is a superset now, so the page was
    deleted and `index.html` and the room bench's picker repointed. The `promptlab`
    suite became **`forms`**, holding what was never about that page: the isolation
    between a kit form and a lab-only one, the portability check that drops
    `lab-forms.js` into a real hub page and draws every form on a live Jeopardy clue
    card, the suits line, and a form's replies typed and judged on a handset.
    **A form's phone path was nearly lost in the merge** — the first pass covered
    drawing and revealing on the bench and nothing else, and it was only writing the
    replacement suite that caught it.
  - **"+ phone" looked live and did nothing, on any page with no relay.** Reported
    against the merged bench and *not* caused by it — the button had never carried a
    disabled state, and `addPhone` returns silently when there is no room, so the
    click was swallowed with nothing said anywhere. It only surfaced now because the
    testing URL given was the **GitHub Pages copy, which has no relay behind it** —
    a fact this file already records for buzzers and which applies to every phone on
    every page. The chip beside it had said `phones off` the whole time; the button
    simply disagreed with it. It starts disabled and says `+ phone — no relay` now,
    and `ready` turns it on. *The room bench already got this right* ("open a board
    first, or type a room code"), which is what made the omission obvious once
    looked at.
  - **Two bad assumptions in my own new checks, both found by running them.** A
    phone is spent after one reply in an `answer` round, so a second verdict needs a
    re-ask — the mode working, not a fault. And `work` is four letters, where the
    spelling tolerance is **zero**, so no misspelling of it can ever come back
    *close*; the near-miss check had to move to a seven-letter answer. Neither would
    have been visible without the assertion failing.
- **The bench authors content now, not just question types.** It held one throwaway
  sample and forgot it on reload, so it could be used to iterate a *type* and never
  to write questions — which is the job the moment a type is finished. It now keeps
  a **set**: prev/next/add/duplicate/delete, persisted in `localStorage`, loadable
  from any category that already exists, and exportable as a Jeopardy category that
  pastes straight into a unit file.
  - **A round says why an item is wrong, not just that it is.** `check(item)` joins
    the round contract and returns sentences an author can read; `setup()` returning
    null already said *that* something was wrong. It went on the shelf rather than
    into the bench because the rules were about to exist twice — **the content gate
    had its own per-round block**, which is knowledge the round already has. The
    gate now asks the registry, so a round written next month is audited the day it
    ships with `smoke-test.js` untouched.
  - **The split: the round owns what makes the *question* invalid, the host owns
    what makes its own *bank* untidy.** "Needs at least two options" is the round's.
    "Also carries an `a` field" stays in the gate, because `a` is Jeopardy's word for
    an answer and no round should ever learn it. For the same reason the gate
    normalises `q`→`text` before checking, exactly as `jShowClue` does.
  - **There is no save button.** Every keystroke lands in the bank, because an editor
    with a live preview *and* a save button is one where the two disagree — and what
    you would lose is the question you were in the middle of. The card still redraws
    on Ask or on moving between questions: rebuilding it on each character would
    throw away a round the room was part-way through answering.
  - **A round trip must not lose what the editor has no field for.** The editor has
    three inputs and an ordering item has four things in it — the glosses have no
    input at all, so `build(text, a, b, prev)` carries them forward. Loading a
    category and exporting it back used to strip the teaching off every step,
    silently. Asserted.
  - **The export knows Jeopardy's shape, and that is allowed.** The bench is a
    *tool*, not a runtime module, so its output format costs the layering nothing —
    and a Jeopardy category is the only thing that can consume these today. When a
    neutral question pool exists this becomes the second exporter rather than a
    rewrite. Values are 100–500 by position, which is why five is the number the
    bench nudges you towards.
  - **Still missing for the stated goal**: nothing consumes a *pool*; content is
    still four hand-authored banks per unit. See the composability item under Next —
    that is the migration, and it is a project rather than a refactor.
- **Plain multiple choice is the third round, and it cost a `<script>` line.**
  `game-hub/rounds/choice.js` — a question and four answers, `choice:{options,
  answer}`. Eleventh category on the Lab board (`L6 · Multiple Choice`).
  **The engine gained nothing to host it**: the clue normaliser asks
  `Kit.round.fields()`, the tile asks `Kit.round.of()`, and ⚙ builds its mode row
  from `modes`. That is the whole return on the round registry, stated as a
  measurement rather than a claim.
  - **It is the control case, and that is why it is on the Lab board.** It is the
    dullest question type there on purpose: if a form does not beat four options on
    a clue drawn from the same vocabulary, it is not earning the code it costs.
  - **The two rounds before it *shaped* the contract, so of course they fitted.**
    This one was written against it unchanged, which is a different and better
    piece of evidence. The only thing it needed was already there.
  - **Two modes.** `first` — the first team with the right answer takes it, the
    standard quiz beat. `agree` — a team's answer only counts once every player on
    that team has picked the same option, exactly as the thermometer plays, and for
    the same reason: on a four-phone team a race is won by the fastest thumb and the
    other three never commit to anything.
  - **The answer is authored as the option itself, never a letter or an index.** The
    options are shuffled per clue — authors put the answer first and a class works
    that out in about two questions — so a letter could not survive, and an index is
    off by one forever the first time somebody writes 1 meaning the first. A typo
    then matches nothing and `setup` returns null, so the card says the question is
    incomplete rather than marking the wrong answer right. **This is the one defect a
    reader cannot catch** — a clue with a mistyped answer looks completely normal and
    is simply impossible to get right — so the content gate checks it by name.
  - **The letters are a card-side affordance only.** A/B/C/D is what lets a teacher
    say "who went for B?" out loud; the phones get the words, where a letter would
    be noise on a screen that is nothing but options. Card and handset carry the
    same four in the same order, asserted.
  - **`Kit.round.poll` and `Kit.round.agreement` came off the back of it**, because
    the tally-leading-unanimity trio was written twice in a day. The rule held:
    ordering was rewired onto them in the same change and its checks passed
    unchanged, which is what makes it a shelf rather than a second copy under a new
    name. What stays in each round is `valid(word, team)` — which words are legal
    differs completely (ordering rejects a word already on that team's ladder, a
    choice rejects anything that is not one of its four).
  - **The bench editor is a table now, not a chain of `if (type === …)`.** Two shapes
    were two branches and that was fine; the third is what turns it into a list kept
    in step with the registry by hand, which is the shape this project keeps paying
    for.
- **A question is a thing you can pick up and plug in now — `Kit.round`.** The
  grouping round used to be ~300 lines inside `hub-engine.js`; it is one file,
  `game-hub/rounds/grouping.js`, holding all four things a question type is: **the
  card the projector draws, what the handsets are put into, how several students'
  taps become one team answer, and whether that answer is right**. A game show calls
  it by name and gets all four.
  - **This is the tier above `Kit.prompt`, not a replacement for it.** `Kit.prompt`
    is a *rendering* contract — render and reveal, no time, no turns, no phones —
    and six question forms live there quite happily. A round is a question that is
    *played*. Every hook past `setup` and `render` is optional, so a simple type is
    two functions and Connections uses everything; that is the same "declare what
    you need" shape the game registry uses.
  - **What a round never contains: scoring, turns, timers, the board.** Jeopardy
    pays a tile and passes a turn when the round says a team has it; the bench pays
    nothing. A round that knew about points could only ever live in one game — and
    when something you want to tune is missing from the bench, that is the boundary
    telling you it belongs to the host.
  - **`playground/question-bench.html` is the second caller, and that is the point.**
    A shelf with one caller is a guess. The bench draws the card *through the
    registry* — the same code a Jeopardy tile runs — with a rack of real handsets
    beside it, so a question is authored and iterated where you can see the card and
    the phones react together. All 56 grouping checks passed unchanged across the
    extraction, which is what makes it a refactor rather than a rewrite.
  - **The card's styling had to leave `hub.css`.** A playground page cannot load that
    file to get the card — it carries the whole hub theme — so the card's innards are
    `game-hub/hub-rounds.css`, loaded by both. The game-show overrides ride along in
    it, scoped to `body.theme-gameshow`, which never matches on a bench page.
  - **A shared card cannot assume its host's background**, and only a second host
    proved it: the palette was the hub's light theme hard-coded, so on the dark bench
    the words rendered as white blocks — the round looking wrong in the one place it
    exists to be tuned. It reads six custom properties now, and **the defaults are
    fallbacks inside each `var()`, never a declaration block**: a declaration on the
    round's own element out-specifies anything the host sets on an ancestor, which is
    exactly how the first attempt failed and looked like the host being ignored.
  - **In a race the card keeps every word.** Each team has placed different ones, so
    removing a word because *some* team used it makes the card lie to the other
    three — and filtering by the teacher's own lane made the shared list shrink as
    Team 1 climbed, which reads as words vanishing for no reason anybody else can
    see. The card is the reference list of what is in play; each team's own remaining
    set is on their handsets. Only the teacher's own lane dims what it has used.
  - **The bench makes teams, and racks its phones a row per team.** A round can give
    each team its own board, so two was not enough to try one — and the rack now
    reads the way the room does: a labelled row per team, phones filling the teams
    evenly, so which handsets belong together is visible at a glance. Rows are added
    and never re-parented, because moving an iframe reloads it and drops its stream.
    Four teams is the cap, which is where a clue card stops being readable.
  - **Four to a row, and it is a divisor rather than a maximum.** Every row is sized
    as if it held four, so a team of two draws the same size as a team of four and
    simply leaves the space — sizing by whatever the busiest row happened to hold
    made handsets change size as teams filled up, which is exactly the instability
    the card is protected from and the rack should be too. Capped at 0.62: a phone
    drawn much bigger stops being something you glance at beside the card and starts
    competing with it. **Width divides, height scrolls** — constraining by height as
    well shrank every handset to the floor while a third of the pane sat empty, and a
    phone too small to read is a phone you cannot judge a dynamic from.
  - **The bench racks twenty phones, and the ceiling is the transport's — which is
    not the same everywhere.** Every live page holds one event stream open forever:
    the board's, plus one per racked handset. Over **HTTP/1.1** a browser allows six
    connections per origin, so at five phones that is six and the request carrying a
    tap has nothing left to travel on — **the phone marks the word, the board never
    hears it, and the round looks broken while both ends are behaving perfectly.**
    That is the local relay, and it was measured. Over **HTTP/2**, which the deployed
    site speaks, streams share one connection and none of it applies. The cap is
    twenty and the bench **says which situation you are in** rather than pretending
    one number is true everywhere. A class never meets any of it: thirty handsets are
    thirty separate browsers. *(This corrects an earlier note here that gave four as
    the ceiling — that was the local measurement generalised too far.)*
  - **The card never gives up width; the phones do.** Adding a handset used to
    squeeze the card, which defeats the whole page: a card that changes size when you
    rack a phone is not the card a class meets. The card is drawn at a projector's
    720px and *scaled* — the room bench's rule applied to a card rather than a board,
    because re-laying it out narrower reflows the words into a layout no projector
    renders. The editor sits under it at the same width rather than spanning the
    page, which was pushing the rack over.
  - **Still deliberately separate: `playground/connections.html`.** The full 16-word,
    four-group game is not a question card — it is a whole game that happens to share
    a mechanic, and forcing it through the round contract would change a working page
    to prove a point the bench already proves. The shared pieces it could adopt
    (`Kit.round.shares`, `Kit.round.settle`) duplicate `BenchKit`'s by four lines; that
    is a smaller problem than a refactor nobody asked for.
- **Ordering is the second round, and the contract held.** `game-hub/rounds/
  ordering.js` — Word Thermometer as a clue: five words on a scale, a ladder on the
  card, and the room puts them in order. One file, **no engine change to host it**,
  which is the whole return on the extraction. Ninth… tenth category on the Lab
  board (`L5 · Word Thermometer`), and it plays on the bench and in Jeopardy from
  the same code.
  - **Two ways to play it, both real lessons.** `climb` fills one shared ladder a
    rung at a time from the cold end — everyone votes on what comes next, it locks,
    its gloss prints as it lands, so a five-word scale is five teachable moments.
    `race` gives **every team its own ladder, side by side**, and the first team to
    finish theirs takes the question. The picker is built from what the round
    *declares* (`modes`), so neither the bench nor the hub learns what a mode means;
    the hub turns it into a ⚙ row automatically.
  - **The race needed the last unused thing on the relay.** Each team has placed
    different words, so each has a different set left — which means **each team must
    be asked a different question**. That is `optionsByTeam`, built for the
    thermometer's bench game and used by nothing until now. A team not named falls
    through to the room-wide list, so nothing else in the app is affected.
  - **The ladder is the picture, which is the whole reason for a lane each.** You can
    see who is two rungs up without reading a scoreboard, and a team's next answer
    appears in the rung it is aimed at — so the room watches it land or shake rather
    than reading a verdict afterwards. Fits a projector at two, three and four teams
    (152px a lane at four), asserted at each.
  - **The game-show skin now sets the card's *palette* rather than one round's word
    tiles.** It restyled `.gword` directly, so the second round inherited nothing and
    the ordering ladder's empty rungs kept the light theme's border on a dark card —
    invisible. Any round drawn in that card is now correct by construction, including
    ones not written yet. **A theme that names one round's classes is a bug waiting
    for the next round**, the same shape as every other list that named what it
    should have asked.
  - **A sequence is not a set, and that is what the second round was for.** Grouping
    merges a team's phones with a union — four words from four handsets are one
    answer. An order cannot be merged: two students tapping different words do not
    combine into a third. That is what killed the first "everyone submits a whole
    order" mode and replaced it with a lane each: a race asks one rung at a time, so
    nothing has to be merged and every team argues out loud instead.
  - **The whole team, or nobody — a rung waits for unanimity.** It used to land on
    whatever *most* of a team had said, so three students could carry a fourth who
    was never asked to commit, and on a two-phone team it meant one playing and one
    watching. Every player on the team now has to pick the same word. Both modes,
    because the reason is the same in each.
    - **Being split is not being wrong**, so it draws no verdict at all — no shake,
      no "not that one". A team that disagrees has done the interesting part; telling
      them off for it is the opposite of the lesson.
    - **What the card shows instead is the count**, and it goes on the *team's label*
      — the lane header in a race, a tally chip on a shared ladder. Never on a rung:
      a count inside the `next` rung makes that one rung two lines tall, the lanes
      stop lining up, and the ladder lurches again. Same bug, one grid over.
    - **The leading word still shows while they argue.** `picks` is the team's agreed
      answer and is the only thing judged; `leading` is what most of them are saying
      and is what the card draws. Collapsing them back into one field is exactly how
      a majority would quietly start winning rungs again.
    - **The card says where they disagree, not just that they do.** Every word a team
      has a vote on carries that team's dot; the one they lead with is filled. A
      tally reading `1/2` with nothing showing what the other student wants tells the
      room it is stuck without telling it what to argue about.
    - **Three ways it must never lock up**, all checked. With no count to be
      unanimous against (`sizes[t]` is 0 — no relay, or nobody counted yet) the
      leading vote lands exactly as before, so a missing number can never freeze a
      round. The teacher's own Check never goes through `read()`, so one phone in a
      drawer does not make a clue unfinishable. And **a phone that drops out shrinks
      its team rather than freezing it** — see below.
    - **A leaver who never voted was the one case nothing recomputed.** The gate is
      against the roster, so a team of three sitting at 2 is unanimous the moment the
      third handset drops off. The relay already had half of this: a *held* reply
      leaves with the phone holding it, so a leaver who had voted triggers a
      `response` and the round re-judges. A leaver who never voted sends nothing, and
      both hosts only ever re-read the room when a reply arrives — so the roster
      shrank and the team stayed stuck, with only the teacher's Check to get out of
      it. Both hosts now re-read the replies they already hold when the roster
      changes: **nothing new has arrived, what changed is the room they are being
      read against.** Proved by reverting — the tally sits at `1/2` after the handset
      is gone.
    - **Rejoining needed no work at all**, which is worth knowing before anybody
      builds it twice. The phone stores its seat (code, name, team *and player id*)
      in `localStorage`, so a reload or a dropped connection comes back to the same
      room, the same team and the same identity — which is why a bingo card survives
      one. A QR for a different room outranks the seat, and "Not you?" forgets it;
      both are deliberate.
    - **`read`, `judge` and `accept` take `ctx` now**, like every other hook already
      did. They were the odd ones out and it showed the moment a round needed to know
      how many students are on a team. Stashing the size in the round's own state
      from `arm()` would have worked and would have been a lie — the size is the
      host's live fact, not something the round was told once.
  - **A right answer is not always an ending, and defaulting that wrongly is silent.**
    A grouping card is over the moment a team has the set; an ordering climb has four
    more rungs. `judge` returns `done`, and the host treats **`done !== false`** as
    the end — a round that has never had to think about progress says nothing, and
    saying nothing must mean the ordinary case. Defaulting the other way made a
    correct grouping card report *"yes, keep going"* and never pay out.
  - **The normalisation whitelist bit again, exactly as written down.** `order` was
    not in it, so the clue drew as plain text with nothing anywhere saying why —
    the same failure `reveal` had when Story Reveal shipped. It is not a whitelist
    now: each round declares the item field it owns and `Kit.round.fields()` is
    asked, so **a round added later is carried through without anybody remembering.**
  - **Nothing new was needed from the phones.** A handset already sends its taps in
    the order they were made, so a sequence is expressible with no drag-and-drop and
    no `join.html` change at all.
  - **Empty rungs cost 44px each to say nothing** and pushed a five-step ladder past
    both edges of a 1280x720 clue card. Making them a thin line bought the height
    back and cost the thing the ladder is *for*: as each word landed the rungs above
    resized, so the column shifted and progress read as the ladder lurching rather
    than filling — and with a lane each, no two teams' rungs lined up with one
    another. **A ladder whose rungs move is not a ladder.** Every rung is the same
    box now, filled or not, differing only in opacity; the height comes back from
    making *every* rung shorter, which costs type size and nothing structural. The
    card is asserted on screen at 1280x720 and 390x844, which neither `fit` nor
    `phone` would have caught because neither opens a clue card.
  - **A wrong check now releases the teacher's words.** Leaving them selected meant
    the next click deselected instead of choosing, so a second attempt silently did
    nothing — worst on a climb, where one word is the whole answer and the button
    just sat there disabled.
- **A grouping clue: Connections inside a Jeopardy tile, and the first bench dynamic
  that needed real engine work.** Eight words on the clue card, four that belong
  together; every phone in the room is armed with a multi-pick selection, a team's
  answer is the **union of its players' picks**, and a set of four is judged the
  moment it settles. First team to a real group takes the tile and it scores
  normally. Ninth category on the Lab board (`L4 · Connections`).
  - **Story Reveal ported cheaply and this did not, and the difference is the whole
    lesson.** Reveal landed on `jHints`/`jHintCost`, which was already the same
    mechanic. Grouping had nothing to land on: it is ~330 lines in `hub-engine.js`
    with its own state, arming, settle and judge, where Reveal was a field name in a
    whitelist. `Kit.prompt` could never have held it — that is `render`/`reveal`, no
    time, no turns, no phones. **Budget the next dynamic against this one, not
    against Reveal.**
  - **Nothing on the phone side had to be built.** `multiByTeam` and multi-pick were
    grown for Connections' race and used by nothing in the hub; the share
    (`ceil(4/size)`, so two phones hold two words each) is the mechanic rather than
    a detail, and being over your share is a state, not an error. This is the first
    thing to prove that the relay work generalised.
  - **`phoneRound()` now carries what it returns instead of interpreting it.** It
    was `{mode, prompt, options, keepSpent}` — a whitelist that silently dropped
    `multi`, `multiByTeam`, `holds`, `rethink` and `team`, so a game could ask for a
    round the relay already supported and get a plain vote. Carried through
    verbatim now, exactly as the relay carries them without reading them.
    `undefined` drops out of the JSON, so Bingo's arm is unchanged on the wire.
  - **Refusing a buzz re-armed a *buzzer*, which is the bug this shape keeps
    producing.** The recovery path in `onBuzz` hard-coded `armBuzzers` — written
    when the only dynamics were the phone modes — so a stray buzz during a grouping
    round would have been "recovered" by replacing the round with the very thing the
    game had said it did not want, leaving the class unable to finish the clue at
    all. It asks `phoneRound()` now. **Anything that names the shared dynamic is a
    bug waiting for the next game**, same as `gameIds()` and the `.lit` stage list.
  - **`jGroupWho` is the switch, and it is the only one worth having.** *(Renamed
    `roundWho` when Blockbusters became a second host — see the top of Current
    status.)* Whether the
    whole class races for the tile or it belongs to the team on turn is a *teaching*
    decision — a choice between iterations, which is what a variant is for — where
    the settle delay and the eight-words-four-to-find are guessed numbers that want
    a classroom run, not a slider. Scoping costs one line because `team` on the arm
    already reaches all three places it has to: the relay stores it, an unentitled
    phone shows the question with no controls, and a reply that arrives anyway is
    dropped.
  - **A wrong four costs nothing but the time**, as in Connections' race: the other
    team is the pressure, and a class charged for a guess stops guessing. The right
    answer is resolved before any wrong one, because two teams can settle in the
    same tick and arrival order put *"not a group"* on screen after the tile had
    already gone.
  - **`jGroupClue()` and `jGroupLive()` are different questions, and mixing them is a
    live trap.** The first is "this clue is a grouping clue", true until the card
    closes; the second is "the round is still being played", which stops the moment
    it is taken or revealed. Correct and Wrong only exist *after* Reveal, so the two
    guards below asked the first — written against the second they would have looked
    right, passed a casual read, and silently let both rules back in.
  - **Nobody held the floor, and two of Jeopardy's rules assume somebody did.** The
    steal exists so a team shut out of a question gets it when the team holding it
    misses; `jDeduct` charges the team that missed. On a clue every team was
    assembling at once there is nobody to exclude and nobody to charge — `missed`
    is only "whoever happened to be on turn", and on a Classic board that team was
    docked **$200 for a clue the whole room was playing**. Both stand down now, from
    the one fact rather than two special cases.
  - **The teacher can play it with no relay at all** — click four words on the card
    and Check. Not a fallback; degradation is the rule, and this is the first hub
    clue that would have broken it. It then did a second job for free: **a Daily
    Double on a grouping tile** looked like two contradictory dynamics, but what a
    Daily Double excludes is the *phones*, not the words — the finding team names
    their four aloud and the teacher clicks them, and `jCorrect` was already routing
    a Daily Double's payout to whoever found it. Without the round the tile opened
    on an instruction with nothing to pick from and the wager was unanswerable.
  - **Two CSS rules that had never applied, both found by looking rather than
    measuring.** (1) The game-show styling was hung off `#play-jeopardy.lit`, but the
    clue card sits *outside* the stage — which is exactly why `openClueCard` has to
    set `--tension` on it by hand — so it reached nothing; `.clue-hint` had the same
    dead selector and had never applied since hints shipped. Both are scoped to
    `#clue-card` now. (2) `#clue-actions button` sets `border:none` and
    out-specifies a bare `#hint-btn` or `#group-btn` (1,0,1 against 1,0,0), so the
    outline those two secondary buttons are meant to have was never drawn; the
    parent id is in the selector to win that. **CSS has no way to say a rule lost**,
    so both of these looked merely plain rather than broken, and no assertion would
    ever have caught either.
  - **The Lab board had no test coverage at all** until this — the Reveal categories
    shipped untested last session. `grouping` suite (56 checks) drives the round,
    the no-phones path, both settings of `roundWho`, the Daily Double, a miss under
    Classic's rules, an ordinary
    clue on the same card, and the card's own fit at 1280x720 and 390x844 — neither
    `fit` nor `phone` opens a clue card, so a set of words overflowing it would have
    passed both. The content gate now opens the Lab shell too, so those nine
    categories are finally audited. **Five of the fixes above were proved by
    reverting them and watching the right check go red**, which is how the `-200/0`
    was found rather than reasoned about.
- **The Lab board is a mixing desk: one question type per category.** A category is
  Jeopardy's unit of choice, so making each one a single form turns the section
  screen into a way of comparing them — pick three forms, play a board, and judge
  each against the others in the same round. **Eleven categories over six sections**:
  six forms (gap, anagram, odd one out, error fix, word order, **word bridge**),
  two Reveal, and three rounds — **grouping**, **ordering** and **multiple choice**.
  Every clue is drawn from the same small vocabulary field on purpose, so the only
  thing that varies is *how it was asked*. **Multiple choice is the control**: a form
  that cannot beat four options on the same vocabulary is not earning its code.
  - **`bridge` graduated the day a bank actually used it**, which is what it had
    been waiting for since it was written — a form with no content is a form the
    class never meets. The move was the documented one: the block out of
    `playground/lab-forms.js` and into `hub-kit.js`, no rewrite, and `hub.css`
    already carried its styling.
  - **Every category needs all five values.** Jeopardy indexes tiles by row, so a
    category short of one is not a narrower column — it is
    `Cannot read properties of undefined`. Four-clue reveal categories crashed the
    board build.
  - **A $100 tile affords exactly one reveal layer**, so author one at $100 and two
    from $200 up. Eight categories × 5 fits 1280×720 exactly.
  - **The forms suite named `bridge` as the experimental form**, so graduating
    it failed the check for the right reason with the wrong message. It derives the
    two sets now — whatever the lab file registers beyond what the kit holds is
    experimental *by definition*. The same "a literal list is a photograph" bug the
    game registry keeps paying for, met in a test this time.
- **The first question dynamic has been carried from the bench into a game show.**
  `game-hub-lab.html` + `game-hub/content/unit-lab.js` — a Lab unit **not loaded by
  `game-hub.html`**, so it is reachable only from its own shell and never appears in
  front of a class. Story Reveal was the port: a clue opens terse and each authored
  layer costs a slice of what the tile pays. Same engine, same clue card, same
  scoring, same phones — a special engine would have proved nothing about the real
  one. Verified live: $200 → $150 → $100 across two layers, then the button stands
  down because the clue has no third.
  - **These dynamics are not question forms, and that is the headline.** `Kit.prompt`
    is a *rendering* contract — `render`/`reveal`, no time, no turns, no phones. A
    bench dynamic is a **round**. Reveal ported cheaply only because the hub already
    had `jHints`/`jHintCost`, which is the same mechanic. **Grouping has since been
    built as a real mini-round** (see above) and cost what that predicted;
    **ordering is still open**, and is the harder one.
  - **The normalisation is a whitelist, and that is the real friction.** A clue
    becomes `{text, answer, type, reveal, group}` on open so the kit never learns
    Jeopardy calls a prompt `q` — so `reveal` was silently dropped once and the hint
    button never appeared. **Anything an author adds to an item is invisible
    downstream until it is named there.** `group` was added to it deliberately as
    the first line of the next dynamic, which is what that warning was for.
  - **An authored reveal belongs to the clue, not to a ruleset.** Hints were gated
    behind `together`, where a generated spelling hint is a cooperative crutch. A
    layer somebody wrote is how the clue was *written*, so it is offered on a
    competitive board too — still behind `jHints`, and items without `reveal` are
    exactly as gated as before.
  - **A $100 tile affords one layer, not two.** Hints cost a minimum of $50 against
    a $50 floor, so cheap tiles run out. Arguably right, but author two layers only
    from $200 up or the second is never seen.
- **Story Reveal is the third bench game, and the first that is typed.** A word
  behind three clues — definition, then the word in use, then its shape — revealed
  one at a time, worth a point less each time. Teams **type**; the board judges.
  - **A misspelling is its own verdict.** Every other bench round is a vote, where
    an answer is a choice; this is the first where a student *produces* the word,
    so `HubKit.answer.judge` finally has a caller out here. `redundent` shows as
    **nearly** in amber and does not take the word — "produced it but mis-spelled
    it" is a different fact about a student from "did not know it".
  - **The guard hid the wiring mistake.** `BenchKit.judge` reached for `window.Kit`,
    which does not exist — the hub aliases `HubKit` to `Kit` inside its own closure
    — so it fell silently through to an exact match and downgraded every near miss
    to a flat wrong. **A guard that hides a wiring error is worse than none**;
    `judge.full()` now says which one is running.
  - **The reply strip belongs to the word, not the round.** A wrong answer passes
    the turn, which re-asks the phones within a frame, and `askPhones` was clearing
    the strip — so what the class typed vanished as it was typed. Exactly the bug
    the hub's `lastScored` already paid for, met again one tier down.
  - **The third caller moved the mode picker onto the shelf.** All three games had
    declared turns-vs-race identically; that is `BenchKit.modeSetting` now, with
    each game naming its own modes (*a ladder each*, *both teams at once*,
    *anyone can answer*). What a mode *means* stays in the game, as it must.
- **The thermometer's race is one ladder per team, and it needed a new thing from
  the relay.** Two teams, two ladders; four teams, four — all climbing the same
  scale side by side, so **the climb is the picture** and a class can see who is
  two rungs up without reading a scoreboard. A shared board was the first build and
  it made a race you had to be told the result of.
  - **Each team's pool diverges, so each team's phones must be asked a different
    question.** That is `optionsByTeam` on the relay — the *second* thing a round
    carries per team, and the first where the **question** differs rather than the
    rules. It rides the per-recipient `armed` payload built for the pick shares, and
    falls through to the room-wide `options` for any team not named, so every
    existing game is untouched.
  - **A team's guess is drawn in the rung it is aimed at**, on their own ladder, in
    italic until it settles. That is what replaced a shared pool with dots on it:
    you watch each side's next answer appear where it will land, then lock or shake.
  - **Independent ladders removed a bug rather than adding one.** With a shared slot
    both teams could settle in the same tick and the wrong verdict could land after
    the right one; with a ladder each, no team's answer can end another's round.
  - Fits a projector at two, three and four teams (1280×720, nothing clipped) — the
    suite asserts it, because column width is what a fourth team costs.
- **The thermometer races too, and the third shared piece came out of it.**
  Picked from the toolbar like Connections'.
  - **A race over a *sequence* is not a race over a *set*.** Connections settles on
    a team's four; this settles on a team's leading word. Both need the same pair —
    debounce, because a team's answer arrives from several phones one at a time,
    and a memory, or a team sitting on a wrong answer is told off again on every
    stray reply. That pair is `BenchKit.settle` now, and **Connections was rewired
    onto it in the same change** — the second caller is what made it a service
    rather than one game's helper.
  - **The right answer is resolved before any wrong one.** Both teams can settle in
    the same tick, and taking them in arrival order put *"Team 2: not that one"* on
    screen **after** Team 1 had already won the slot — the board announcing the
    wrong headline for a question that had moved on.
  - **Everything a race removes the recovery path for is removed with it** — the
    turn, the mistake budget, `Reveal this one`, and the clock. That last one is
    Connections' lesson applied without having to re-learn it: expiry disarms every
    handset, and a race has no teacher control left to recover with.
  - `lockIn(word, team)` is one definition for a slot filling, whoever decided it —
    teacher click, settled race vote, or a reveal (`team == null`, so nobody
    scores). Two paths disagreeing about scoring is the bug that shape invites.
- **The bench has a second game, and the shelf grew because of it.**
  `playground/thermometer.html` — Word Thermometer: order words along a scale
  (`annoyed → irritated → angry → livid → furious → incensed`), slots filling from
  the cold end, the team on turn voting on their phones for the next one and the
  teacher clicking. Right keeps the turn, wrong spends a mistake and passes it,
  finishing unlocks the mini-lesson. **Five scales** — anger, formality of requests,
  certainty, frequency, praise — each with a per-word gloss that prints when the
  word locks in, which is what turns a right answer into a taught one.
  - **The answer is a *sequence*, not a set**, which is why this was the right
    second game: two genuinely different callers shape a shared API, two
    near-identical ones only flatter it. `BenchKit.leading(votes, n)` exists in
    that shape precisely because Connections wants four and this wants one.
  - **Four things moved onto the shelf and Connections moved with them** — see
    "The playground" for the table and the two lessons the seam taught.
  - **`Reveal this one` costs the point, not a mistake.** A class that cannot
    separate *livid* from *furious* learns more from being shown than from four
    wrong guesses, and nobody got it wrong, so the budget is untouched.
  - **It fits a projector, and only the screenshot said so.** The first build was
    **167px over** at 1280×720 and cut the mistake dots off the bottom; the slots
    are sized `clamp(36px, 5.4vh, 56px)` now and the suite pins `scrollHeight <=
    innerHeight` *and* the dots' bottom edge. Connections is still 63px over —
    known, not fixed, and the reason the check lives on the new game rather than
    being made a bench-wide rule today.
  - Linked from `index.html` and offered in the room bench's board picker.
    `thermometer` suite, 24 checks including the no-relay degradation every
    playground page owes.
- **Connections plays two ways, and the bench grew a middle tier.** The board can
  now be played as **turns** (unchanged) or as a **race** — no turn, both teams at
  once, each team's picks live on the projector in its own colour, and a team's own
  four *is* its guess, so the teacher never re-enters it. See "The playground" for
  the mechanics and why each phone holds up to four rather than one.
  - **A team's answer is the union of its players' picks**, which is what makes a
    small team possible *and* what forces the negotiation: six words up means
    agreeing which two to drop.
  - **A set of four is judged when it settles**, debounced — four picks arriving
    from four phones would otherwise be judged three times on the way up — and
    remembered per team, so a wrong four is not re-judged until it changes.
  - **The clock stands down in a race, and that was a dead end rather than a
    preference.** The round clock disarms every handset when it expires; turns mode
    recovers because the teacher still has Submit, but a race hides Submit — so on
    the **default 60s** a race board reached one minute with no phone able to tap
    and no control on screen to click, and only Restart got out of it. The clock
    now goes the way the mistake dots and Submit already do, on the board *and* on
    the handsets: a race's pressure is the other team, which is the same reason a
    wrong four costs nothing there. **The general shape: a control that a mode
    removes the recovery path for has to be removed with it** — the two race checks
    were proved against the reverted fix.
  - **A player's share of the four comes from their team's size.** One phone holds
    all four, two hold two each, four hold one each (`ceil(4/size)`). One room-wide
    cap could not say that, because teams are not the same size — and a team of
    four each holding four words is not a negotiation, it is four separate answers.
    It is a *share*, not a quota: a team holding five between them is over and has
    to talk one of them down, which is the mechanic.
    - **`multi` is now per team on the relay** (`multiByTeam`), delivered on a
      per-recipient `armed` payload rather than one broadcast — the first thing a
      round carries that differs by team. Falls through to the room-wide `multi`
      for any team not named, so every existing game is untouched.
    - **A share that moves is pushed, never re-armed.** A fresh arm clears every
      handset's picks, so a latecomer walking in would wipe what the rest of the
      team had just agreed on — the same rule as the hub's "a re-ask never cancels
      what is in progress". `host.shares([…])` moves the cap and leaves the picks.
    - **Being over your share is a state, not an error.** Nothing is stripped: the
      handset says "Drop 1 — it is 1 each now" and refuses to add. Forcing a trim
      would take a word off a student who did nothing wrong.
  - **A held reply leaves with the phone that holds it.** A dropped phone's picks
    used to sit in `room.responses` forever, still counted toward its team's union,
    with nobody able to drop them — the team was simply stuck. But a *typed* answer
    must stay, because the teacher wants to see what the class wrote even from a
    handset that died. So the host declares which kind of round it is (`holds` on
    the arm) rather than the relay guessing, and the leave path recomputes the
    tally and tells the host. **The distinction is holding versus having given.**
  - **The highlight is neutral; only the dots carry the team.** The pick ring took
    the colour of whichever team grabbed a word *first*, which paints a contested
    word as one team's and leaves the other's dot reading as a footnote on somebody
    else's pick. Both sets have to be equally legible — a team reading what the
    other side is assembling is what makes the race a language task rather than a
    speed one. The teacher's own click is a neutral dashed outline for the same
    reason: on a race board nothing is theirs to lock in. Asserted as a property
    (two words held by different teams look identical), so restyling the ring
    cannot quietly re-encode the team in it.
  - **One team palette, in `hub-buzzer.js`.** A team's colour has to be the same
    fact on the projector and in the hand, so it lives in the one file both ends
    load rather than in two lists kept in step — and it costs the relay nothing,
    which is right, since a colour is presentation. The handset paints its team
    pill, its join-screen swatches and its held words with it, so a student matches
    the colour in their hand to the dots on the board without being told which are
    theirs. The hub's own team bar has not adopted it yet.
  - **Race has no ending but solving all four.** Turns mode has the mistake budget;
    a race that stalls on the last group runs until somebody gets it. A whole-game
    clock — "as many groups as you can in 90 seconds" — is the obvious candidate
    and would reuse the setting that just stood down, but it invents a third
    guessed number on top of the two the classroom run is meant to settle. Open,
    deliberately.
  - **`playground/bench-kit.js` is the new tier**: what every *question game*
    shares, as `hub-kit.js` is what every *game* shares. It exists because
    `openRoom` had already been written twice in two days. Teams and the round are
    deliberately still in Connections — one caller is a guess, not an API. The rule
    and the three tiers are in "The playground".
- **The bench's phones are real handsets now, scaled — they were 264px wide.**
  Reported as "each form lists each word underneath it, which means you have to
  scroll down". The two-column layout was working: it just cannot fit two 140px
  columns into the 220px `join.html` had inside a 264px rack column, so the bench
  showed a layout no phone shows and ten of sixteen words sat below the fold. The
  board had had the fix since the bench was written (render at the projector's
  logical width, scale to the pane); the phones never got it. **A scaled thing
  still occupies its full layout size**, so the iframe needed a clip box with an
  explicit height. The two checks were proved against the reverted build —
  `inner:264, cols:1, scrolls:true, offscreen:10`.
  - ~~**The bare bench opens empty and that reads as broken.**~~ **Fixed, and the
    default board changed with it: a bare bench now opens the real hub** —
    `game-hub.html`, unit choice and all — because the bench's job is testing
    rounds *inside the game hub environment*, so the board it opens should be the
    page a class meets. The hub leads the picker; anything that skips a step
    (the Lab, a unit deep-link) says so in its label. **Not when `?code=` was
    given**: that is the bench being used as a rack of phones against a board
    running somewhere else, and a board opened here would mint its own room and
    drag the phones off the one named — the code-only path stays board-less,
    which the `bench` suite already drives.
- **Question forms have a rig now, and a sixth form to prove it.** *(The rig was
  `playground/prompt-lab.html`, since retired — the question bench does all of this
  now. Kept because the reasoning is what the bench inherited.)* It
  lists every registered form, draws and reveals it at board size,
  and pushes the same question to phones — see "The playground". It exists because
  a form previously had nowhere to be seen: you had to find a bank item carrying
  its type, which is the same reason density is the open problem. The menu asks
  `Kit.prompt.types()`/`info()`, so **a form written next month appears in it
  without the lab being touched**.
  - **`bridge` is the new form** — `FIRE -> ___ -> SHOP` answered by `work` — and
    the **first that suits every board**, because its answer is one ordinary word.
    The reveal names the compounds it built, since the answer alone doesn't explain
    itself. See the forms table for the authoring convention.
  - **A form that declines is not a form that did nothing**, and `render()` cannot
    tell you which happened — it returns the type whenever the form *ran*. The
    absence of element children is the tell, and the lab reports it; that
    distinction was a bug in the lab before it was a line in the docs.
  - **A form now has two stages, because a separate *page* is not a separate
    *form*.** Experimental forms live in `playground/lab-forms.js`, which no game
    loads; `hub-kit.js` is the shipped shelf. Graduating is moving the block.
    `bridge` went straight into the kit at first — shipped, invisible only for
    want of content — and has been pulled back to the lab file, which is where a
    form being experimented with belongs. **Portability is proved, not promised:**
    the suite drops the lab file into a real hub page and asserts every form in it
    draws and reveals on a live Jeopardy clue card, iterating whatever the file
    registers so future forms are covered for free.
    `.claude/skills/new-question-form` is the procedure.
- **The room bench: the board and its phones on one screen.** `playground/
  phone-bench.html` now carries the **projected board too**, not just the
  handsets — because a phone dynamic can only be judged by what it does to the
  board, and two tabs never show cause and effect together. Any board works
  (hub or playground) because the bench asks `window.HubHost` what room the page
  is running — **a stated convention now, on the hub as well** — so the code is
  never copied by hand. See "The playground" for the four rules it pays up front
  (seat isolation, no iframe re-parenting, projector-width scaling capped at 1:1,
  and the `ResizeObserver` re-fit that a screenshot caught and the assertions had
  missed). `bench` suite covers it, hub board included.
- **The playground exists, and Connections is its first game.** `playground/
  connections.html` (linked from index.html) — see "The playground" section for
  the rules of this lane. Ported from the Learning-games prototype with its five
  puzzles intact; classroom-adapted with teams, turn rotation and team-scoped
  phone voting over the existing relay, phones untouched. The `playground` suite
  (15 checks) drives the whole loop including a phone and the no-relay
  degradation. Next candidates the user likes: story reveal, emoji idioms, word
  bridges, word thermometer, close words, double agents, perfect partners.
- **One settings entrance, and the game view is organised.** The separate Lab
  button is gone: ⚙ during play opens the docked drawer for the game being played
  (`L` still toggles it; Escape closes it), everywhere else the full panel; the
  drawer's "All games" button hands over to the panel for cross-game edits. Panel
  game tabs and the drawer are now literally the same rows (`buildRow`), so a
  control cannot behave differently depending on the door. Organisation: Ruleset
  section first (pickers registered with `presets` / `S.describePresets`), then the
  game's own groups, then shared groups in a fixed order; All games leads with the
  shared groups instead; headers fold. Rows a ruleset bundle touches say what the
  chosen mode set them to ("Classic sets this to 10s") — advisory, because a mode
  writes switches rather than holding them. The two phone groups merged into one
  `Phones` group. `lab` suite covers the routing, the handover, the ruleset
  section, the notes and the folding; `scoping` pins the drawer-for-the-game
  behaviour that replaced "⚙ opens on the current game's tab".
- **Classic has an answer clock, started by the buzz.** `jAnswerSeconds` (Jeopardy
  group, 0 = off; the `classic` preset writes 10, `hub` and `together` write 0)
  gives the team on the floor that many seconds. Decisions worth keeping:
  - **The buzz starts it, never the clue opening** — the teacher reads aloud at
    their own pace, and the pressure belongs on the team that claimed the right to
    answer. A steal claim restarts it (`jTakeSteal`), a typed buzz never starts it
    (the word is judged the instant it arrives — nothing left to time).
  - **Time up is a fact, not a verdict**: klaxon, a two-beat red pulse on the card
    (`overtime`), and the buttons stay exactly as they were. The teacher controls
    everything is the app's constraint, and auto-marking wrong mid-sentence would
    fight it.
  - **Its own countdown on the clue card, not the header timer** — that widget is
    the teacher's instrument, and a clock that reset it on every buzz would
    overwrite whatever they had set. (The final clue does borrow the header timer,
    which is right there: one clock for one all-room beat, started once.)
  - **The phones watch the same countdown as a duration, not a deadline** — sent
    once with the relay's `locked` event, counted down from receipt, so phone
    clocks never need agreeing with anybody. Display only; the host expires it. A
    late joiner gets what is *left*, computed on the relay where the lock was
    stamped. Stops on `armed`/`disarmed`/`judged`/`reset`.
  - `jclock` suite covers the whole beat: preset writes, buzz starts, clue-open
    doesn't, expiry flags without deciding, reveal retires it, phone follows.
- **Classic pays the rebound in full.** Asked as "turn steal off, the show doesn't
  have it" — the show *does* (a missed clue opens to the other contestants), what
  differed was the price: ours paid half, the show pays full. `stealFullValue`
  (Competition group, default off, games jeopardy+millionaire — the two that score
  in values; a hex or a word has nothing to halve) is written on by `classic` and
  off by `hub`/`together`. The card's "steal for X" and Millionaire's hint read the
  same setting as `award()`, because shown and paid must agree — the `competition`
  suite asserts offer, payout and the answer clock starting on the steal claim.
- **A scanned code outranks the remembered seat.** Reported as "the QR skips the
  name-and-team screen and goes straight to the button". The seat memory
  (`engishism.seat`) auto-rejoined on load without comparing its stored code to the
  `?code=` the QR just put in the URL — so a phone that had ever joined a room
  auto-joined *that* room, skipped the join screen, and sat deaf to every team
  change in the room actually scanned. The URL code is an explicit statement of
  which room the phone belongs in: when it differs from the seat, the seat is last
  lesson's — forget it, keep the name, show the join screen. Same code (or no code
  in the URL) still resumes, which is the reload-mid-lesson feature working.
  - **The join screen's team list now re-asks every 4s while it is up.** It was
    fetched once per code, so a team added after the page loaded was only pickable
    by students who had not opened it yet. Joined phones already got pushes over
    the stream; the join screen has no stream, so it polls.
  - **A matching code still resumes — so the play screen carries the way out.**
    The first report survived the fix, because the phone's seat was for the *same*
    room the QR named: resume ran by design, and a phone holding a seat in the
    current room could never reach the name-and-team screen again by any path.
    "Not you? Change name or team" on the play screen forgets the seat, closes the
    stream and returns to the join form with the code and name still filled.
  - All three checks live in `jointeams`/`phoneteams` and the first two were
    proved against the reverted fix (3 checks fail on the old build).
- **Jeopardy has a third ruleset: `together`, the class against the board.** Every
  other mode sets teams against each other; this one sets the room against a number,
  for a group competition makes anxious rather than sharp. Written from the
  `new-mode` skill, which is what it was written to be tested by.
  - **The scores pool at the display and at the ending, not in `award()`.** Teams
    still hold their own points — the team bar is the app's spine — but the game is
    played and finished against one class total. That is what keeps this a mode
    rather than a second scoring system.
  - **The target is a share of what the board is actually worth** (`jTarget`, 60% by
    default), so a teacher never has to invent a number, and it re-reads correctly
    for any board size.
  - **Hints are the cooperative mechanic**, and they cost *the clue*, not the class:
    a first letter, then the length, each taking a slice off what that clue pays.
    Being stuck gets a way out that is not failure, and deciding whether to spend is
    itself a conversation.
  - **Costed in 50s, because `award()` rounds to 50s.** A hint leaving $349 on the
    card and then paying $350 is the card telling the room something untrue; the
    check asserts shown and paid are identical.
  - **The preset switches *off* everything that pits teams against each other** —
    steal, keep-the-board, Daily Doubles, deduction. A preset that only ever adds
    would leave a steal running under a cooperative round.
- **A mode picked mid-board has to reach the board.** Reported from a full Classic
  playthrough: "no Daily Double ever appeared." The switch said 1 and the board had
  none — **the modes only appear in the Lab, and the Lab only exists once a game is
  running**, so picking Classic wrote the setting after the board had already been
  built and planted. Planting is now re-runnable and hooked to the setting.
  - **It plants among the tiles still unplayed**, which is what makes a mid-round
    change honest: a Daily Double is hidden, so one appearing on an unplayed tile is
    indistinguishable from one that was always there — while a tile the room has
    already answered must never become one, or a clue they have seen would pay a
    wager.
  - The general lesson: **a setting that is read once, at build time, is not a
    setting the Lab can change.** Anything a teacher may pick mid-round needs a path
    from `S.onChange` back to the board.
- **The final clue owns the phones; a Daily Double asks nobody.** Two beats of
  Classic where the mode is the wrong answer, both fixed through the contract rather
  than by special-casing the phone layer.
  - **The final clue is the one moment every team answers at once**, privately,
    against the clock — a buzzer hands the last question of the game to one thumb.
    `phoneRound()` returns a `write` round while it runs, so the beat differs while
    the mode stays `buzz`, and the check asserts exactly that pair.
  - **A Daily Double belongs to the team that found it**, so no question is open to
    the room. That is `askingNow()` returning false during the bet — which is what
    stops a reconnection re-arming the buzzers mid-wager, a latent bug of the same
    shape as the flicker.
  - **Not asking the phones is not the same as telling them nothing.** The first
    version simply skipped `askPhones`, which left the *previous* question on every
    handset with a dead button — indistinguishable from broken, and a phone still
    armed from that clue could buzz in mid-wager. It disarms now, which says the true
    thing: nothing here is open to you.
  - **Refusing a buzz has two shapes, and the difference is whether a question is
    live.** Re-arming is right when one is — it clears the relay's lock so the team
    that *is* entitled can get in. It is wrong when nothing is open at all, because
    it puts the buzzers back for a question nobody may answer. `onBuzz` now disarms
    in that case instead.
  - **The steal and keep-the-board are written into the presets too**, because the
    show does both and a ruleset that leaves them to whatever was set last is only
    describing part of itself.
- **What the phones do is part of a mode, not a separate decision.** Reported as
  "the modes have no control over the phones — `What the phones do` still controls
  them". It was not overriding anything: `phoneMode` was simply missing from the
  bundles, so the row kept whatever it had last. A mode that describes how a round
  is played and says nothing about thirty handsets describes half of it. Hub is
  `off` (the teacher marks), Classic is `buzz` (the show is a race for the floor),
  Together is `write` (a clue pays what the class produced). **Written, not
  shadowed** — the row in ⚙ still says what will actually happen, and a teacher can
  change it afterwards without the mode contradicting them.
- **A room now exists whenever phones are switched on — a deliberate reversal.**
  Reported twice, once for Bingo and once for Jeopardy, both as "the code line is
  missing in this game". Neither was about the game: `phoneMode` was `off`, and
  `off` used to mean **no room at all**, so there was no code on screen and a class
  cannot join a room that does not exist.
  - **Two facts were being conflated.** *Whether a room exists* is a property of the
    lesson — the teacher wants phones today. *What the phones do during a question*
    is the mode, and `off` is a perfectly good answer to that.
  - "Off means no room" was written to keep "Nothing — phones idle" honest, but the
    chip already says `idle here`, so nothing pretends otherwise. Exceptions had
    been carved out for Millionaire's lifelines and Bingo's cards; this makes the
    rule the exception's shape rather than the other way round.
  - The `joinbar` suite asserts it across **all five games**, so the next game
    inherits it.
- **Jeopardy plays as the show plays it, if you ask it to.** Three rules the TV
  game has that this board never did, each its own switch, all three set at once by
  `jRules` — because "play it like the show" is one decision a teacher makes, not
  three.
  - **Daily Double.** A hidden tile, planted at build time and weighted towards the
    bottom of the board (one on a $100 clue is worth nothing to find). It opens on
    a **bet placed before the clue is drawn**, capped at the show's rule — your
    score or the biggest clue on the board, whichever is greater. The team that
    found it answers alone: no phones, no steal.
  - **Nothing on the tile may give it away**, so it is `dataset` rather than a class
    — no stylesheet can leak it by accident, and the check asserts a Daily Double
    tile is identical to every other one.
  - **The final clue.** The board clearing no longer ends the game: the category is
    named, every team in credit bets what it likes, one clue goes up, and it settles
    **lowest score first** as the show does it. A team in last can win from there,
    which is the whole reason it exists — the smoke test drives exactly that case.
  - **Wrong answers can cost the value**, negative scores and all. Off by default:
    a class 500 down in the first two minutes stops trying, which is the opposite of
    what any of this is for.
  - **A preset writes the switches rather than shadowing them**, so the rows in ⚙
    always say what will actually happen and a teacher can change one afterwards
    without the preset quietly lying. That is the general shape for modes — a mode
    is a named bundle of settings, not a second code path.
- **A mode and a game's own dynamic were fighting over the same handset.**
  Reported as "when I select buzz mode a button appears on the phone screen" while
  playing Bingo with the cards on phones. `phoneMode` says what a phone does during
  a question, which is right for a board every phone is *watching* — but a bingo
  card in the hand already is the dynamic, and a buzzer over the top of it is not a
  choice between iterations, it is two things arming the same phone. Worse, the two
  disagreed *asynchronously*: the card round armed first and any reconnect re-asked
  with the mode, so the buzzer arrived a moment later and replaced the card.
  - **`phoneRound()` joins the contract**: a game returning `{mode, prompt, options}`
    owns the round, `null` (the default, and what four of the five games always
    want) means the mode decides.
  - **One definition, so arming and re-asking cannot disagree** — `phoneRoundNow()`
    is what both consult. That was the actual defect; the conflict was visible only
    because the two paths answered the question differently.
  - **With the cards on the board the mode matters again**, and the check asserts
    both directions — buzz is a buzzer there, and is refused a card round.
- **A setting's `games` list was a snapshot, so the fifth game was a second-class
  citizen.** Reported as "the new game's format is different — the join code only
  appears if I pick the phone option". Every shared setting registered with
  `games: gameIds()`, which is **evaluated once**, in the settings block near the
  top of `hub-engine.js` — a photograph of the four games that existed then. Bingo
  registered after it and was silently absent from `phoneMode`, `phonePrompt`,
  `theme`, `intro` and both sound settings: its ⚙ and its Lab were quietly narrower
  than every other game's, and with no phone mode available no room ever opened, so
  the join chip never appeared.
  - **`games:'*'` asks the registry when it matters** instead of holding a list, so
    this is now true for a game registered at any point.
  - **The check registers a bare game *after* everything has loaded** and asserts it
    is offered every shared setting — reverting one setting to `gameIds()` fails it.
  - The contract itself was fine; what leaked was *configuration*. Same shape as the
    `.lit` stage list and the `play-fit` list: **anything that names the games is a
    bug waiting for the next game.**
- **Bingo puts a card in every student's hand.** `bingoCards` picks where the cards
  live: `board` (one per team, shared, the default and the fallback) or `phones`
  (one per student). The phone version is what bingo actually is, and it is the fix
  for the weakness it shares with Blockbusters — two people play and the rest watch.
  - **The relay now holds state that outlives a question.** Everything else it does
    is per-question and forgotten; a card has to survive the next call *and* a phone
    dropping off the wifi. It stores the card and the marks — **but the host deals
    them and the host judges every tap**, so the relay still never learns which word
    the clue means, exactly as it never learns a typed answer.
  - **A tap is a typed answer without the typing**, so it arrives through the
    existing `respond` path and is judged by `Kit.answer.judge` against `expects()`.
    Marking, scoring, the strip naming who got it and the banner were all free.
  - **A call stays open on phones and closes on the board**, and that is the game
    rather than an inconsistency: everyone holding the word marks it, so the teacher
    moves on when the room has had long enough. A word nobody took goes back in the
    bag (`bingoRequeue`) or a class of thirty runs out of calls before anyone lines
    up.
  - **A student's line scores for their team**, so the team bar stays true and you
    get individual engagement without losing class-vs-class.
  - **The board shows the room, not thirty cards**: how many are in play and who is
    one square away, with the near-winners lit.
  - **The winning card stays on the phone.** Ending the round *disarms* rather than
    resets, because the first thing that happens after a line is the teacher reading
    it back off the winner's handset.
  - **The phone remembers its seat** (`localStorage`), so a reload rejoins the same
    room under the **same id** — which is what makes the card come back with its
    marks. A new id would have been dealt a second card and stranded the first. It
    also ends the retype-the-code-mid-round problem for every game.
  - `roomNote()` joined the contract because the chip said `votes only` over a game
    where every phone holds a card.
- **The buzzer flickering on and off was two bugs, and the second one was the
  visible one.** Reported from a real round; the phone kept its room number
  throughout, which is what said the connection was fine and the *armed state* was
  cycling.
  - **Two hub tabs on one room fight forever.** Only one host stream may be live and
    the newest wins — but ending the loser silently is indistinguishable from a
    network drop, so its `EventSource` reconnects, which ends the winner, which
    reconnects. **Every one of those `ready` events re-asks the phones**, and an
    `arm` resets the button on every handset. The relay now sends a `replaced`
    event before ending the stream and the client closes for good.
  - **A re-ask that changes nothing now says nothing.** This is the general fix and
    it does not depend on knowing why `ready` repeated: an `arm` is not free — it
    clears the relay's lock and its collected responses, and resets the handset — so
    the engine remembers what the room was last told and stays quiet if it still
    holds. Re-asking is for telling a room that came back *what is being asked*.
  - The first fix (below) was real and shipped, but it was **not** what the room was
    seeing. Worth remembering: *the phone keeping its room number* was the detail
    that separated the two.
- **A reconnecting phone was being thrown out of the room it had just rejoined.**
  Reported from a real round as "the buzzer oscillates between on and off, like
  it's disconnecting and reconnecting" — it was, in a loop. An event stream
  re-registers the phone under the same id, but the **old stream's `close` fires
  after the new one is stored**, and the handler deleted by id without checking
  whether the stream closing was still the live one. So the phone that had just
  come back was removed, found itself out of the room, reconnected, and was removed
  again. **The host stream has had this guard since it was written; the player path
  never did** — one line apart, and only the host's was ever exercised by a test.
  The `reconnect` suite drives it over raw HTTP, because the race is between two
  connections and a browser's `EventSource` will not let a test hold both.
- **The phone contract: six hooks, and the branch points are gone.** Buzzing,
  everyone-types, type-then-buzz and the class vote used to reach a board through
  `if (activeGame === …)` chains inside four functions — `expectedAnswer`,
  `currentPhonePrompt`, `reaskPhones`'s liveness check and `onBuzz`. **The phone
  layer now has zero of them** (32 `activeGame` branches across the engine became
  21, and none of the survivors are in the phone code). A game declares:

  | Hook | What it answers |
  |---|---|
  | `expects()` | what a typed answer is judged against |
  | `phonePrompt()` | what the handset shows |
  | `askingNow()` | is a question open right now |
  | `buzzEntitled(b)` | `false` refuses this buzz — the engine re-arms |
  | `onBuzzTaken(b)` | somebody has the floor |
  | `onTypedWin(b)` | typed and correct: score it, return the points (`null` = didn't) |
  | `wantsVote()` / `onVoteReply(all)` | the vote half — whether the game ever asks the room, and where the counts are painted |
| `roomNote()` | what the chip says when a game wants a room without a phone mode |
| `phoneRound()` | the game drives the phones itself (Bingo's cards, Jeopardy's grouping clue); `null` = **the default round** handles it, which is what an ordinary question gets. `null` no longer means "no round here" — there is always one. **Everything** it returns beyond `{mode, prompt, options}` is **carried to the relay verbatim, not interpreted** — the whole object is spread, never a key list, because the key list it used to be had already silently dropped `optionsByTeam` on re-asks and would have dropped `promptByPlayer` — so a game can use a round shape the engine has never heard of |

  - **Every hook defaults to a no-op**, so a game that declares none has idle
    phones — a visible, correct state rather than a half-wired one.
  - **Refusing is not ignoring**, and that fact now lives in one place: the relay
    locks the room on the *first* buzz whoever sent it, so a phone that isn't
    entitled would hold the lock and keep the entitled team out. Race's steal rule
    and Millionaire's `speaker` role are both `buzzEntitled` returning false.
  - **`onTypedWin` returns what it paid**, so the engine can name the student on the
    strip without knowing what scoring means on that board — a tile, a hexagon, a
    word, a bingo square.
  - The registry suite asserts both that the hooks exist **and that every game
    answers them itself**, so a sixth game with idle phones fails rather than
    quietly shipping.
- **Bingo — the fifth game, built as a test of the framework.** 3x3 cards per team
  from a shared 12-word pool; read the clue, the first team to answer marks it off,
  three in a row wins. It has **no bank of its own** — it consumes
  `blockbustersBank` through a predicate (single-word, unique answers with a clue
  each), so **both units gained a fifth game with zero authoring**. That is the
  pooled-content idea working in miniature, on real content.
  - **172 of 173 shared checks covered it without being told it exists**, because
    `fit`, `phone`, `gameshow` and `lab` ask the registry rather than carrying a
    list. The one failure was a test asserting *four* games are registered — now
    registry-driven, since a suite that breaks when you add a game is the opposite
    of what it is for.
  - **A game registered after init is invisible.** Bingo registered fine, appeared
    in `HubGames.ids()`, and never got a card, because `renderGameCards()` had
    already run. Silent, and it cost a debugging round: **registration order is
    load-bearing and nothing says so.**
  - Two lists that were hard-coded became registry-driven on the spot: clearing
    `.lit` from every stage, and which boards get `body.play-fit` (now a
    `fitsScreen` flag, false only for Blockbusters).
- **A re-ask was destroying answers the room had already given.** The rule that
  protects a live buzz — *re-asking means "the room came back, tell it what is being
  asked", never "cancel what is in progress"* — had no equivalent for `write`, where
  nobody takes the floor. The relay clears its responses on `arm`, and `ready`
  arrives on **every reconnection of the host's stream**, so two of four answers
  vanished. It looked like the strip losing them; the host had asked twice. A class
  on school wifi reconnects all lesson, so this is the normal case, not the edge one.
- **Three bugs from the first real run of the four-team build.**
  - **A reset board overlapped its own hexagons.** The won board is scaled down to
    sit above the banner, and `#play-blockbusters` carries a **350ms transform
    transition** — so "New board" cleared the scale and laid out one frame later,
    mid-transition, measuring the hexes at 0.84 of their real size through
    `getBoundingClientRect()`. They were spaced for a 92px hex and rendered at 110.
    `offsetWidth` is the layout width and ignores ancestor transforms *and* the
    hexes' own deal animation. **A resize fixed it, which is exactly why leaving the
    game and coming back looked fine** — and why it read as a rendering glitch
    rather than a measurement one. Same lesson as `naturalRect()` on the card flip:
    **a rect is what is painted, not what is laid out.**
  - **Teams could be added and never removed**, so a class that split four ways one
    lesson carried four teams into the next. A team's *index* is its identity in
    three other places — `active`, Millionaire's per-team `mState`, and `bbSideAt` —
    so `removeTeam` is not a splice. Two is the floor: every board is built for at
    least two sides, and the buttons disappear there. Points are a lesson's work, so
    removing a team that has any asks first.
  - **Six teams ran off the side of the join screen.** The team buttons were a flex
    row, so on a 360px handset each got 50px and the last sat past the edge — a
    student on Sharks could not pick Sharks. It is a wrapping grid now; checked at
    320/360/390px.
- **One strip for everything the class does — `#phone-bar`.** Where a student's name
  appeared used to depend on the game *and* the mode: a buzz went on the room chip
  (replacing the join address the class was still reading), a typed answer went into
  the clue card in Jeopardy, under the sentence in Race, under the question in
  Millionaire. Four layouts for one idea, and three of them moved the board as they
  filled. It is now one element, in one place, in every game.
  - **Fixed height is the contract.** It is as tall empty as full, so what the class
    does can never resize the board underneath; a full class scrolls sideways. That
    is what `repliesHost()` — which picked a different parent per game — existed to
    work around, and it is gone.
  - **The chip is the room's identity, the strip is the room's activity.** They are
    two facts and the chip used to swap the first out for the second, so one buzz
    took the join address off screen while the class was still typing it in.
  - **It outlives the question.** Race re-arms within a frame of a word being
    claimed, so anything shown only while the buzz was live was gone before the room
    could read it — which is exactly "it just moved on with no indication who got it
    right". `lastScored` stands until the next question is asked.
  - Five states, one per thing that can be true: somebody has the floor, somebody
    just scored (`+points`), somebody missed, the room is answering, or nothing yet.
- **Blockbusters seats more than two teams, as two alliances.** The board is
  structurally two-sided — yellow crosses, blue descends — so a third team has no
  route to win by, and the answer card was hard-coded to the first two teams. Now
  every team appears on it and scores its own points; `bbSideOf` (index parity) says
  which colour their hexagon takes, and the *line* belongs to a side.
  - **With two teams every part of this is the identity**, so the two-team game is
    untouched — that is the property that made it safe to do at all.
  - Within a side the teams rotate (`bbSideAt`), including when the side keeps the
    board, so one student on an alliance cannot answer every question.
  - The legend names who is playing each colour and underlines whoever is up; with
    two teams that repeats the team bar, with four it is the only place that says
    whether Lions or Bears is on.
- **The phone says which room it is in**, all lesson. A student who joined on the
  wrong code, or drifted into the class next door's game, had no way to tell —
  every screen after joining looked identical whichever room it was.
- **A buzz was being thrown away by the room reconnecting**, and it had been there
  the whole time the phones have existed. `reaskPhones()` runs on every `ready` from
  the relay — which is **every reconnection of the host's stream, not just the
  first** — and it re-arms, which clears `buzzWinner`. So a student buzzed, and
  moments later their buzz vanished and the buzzers reopened. On school wifi that is
  not an edge case, it is what a dropped connection does; it just never looked like
  a bug because the room simply went back to being open.
  - The rule is the same one the vote already had: **re-asking means "the room came
    back, tell it what is being asked", never "cancel what is in progress"**. It now
    declines while anybody holds the floor, and the relay still holds the lock, so a
    phone reconnecting mid-buzz is told who got in.
  - The regression test drives it through a **settings change** rather than a
    reconnect, deliberately: that reaches the same path, and changing a dynamic in
    the Lab mid-question must not take the floor off whoever is standing on it
    either. Proved by reverting the fix — three checks fail, including one that had
    been failing for other reasons and was read as a Race steal problem.
- **The clue card floats over the board instead of blacking it out.** It carried a
  90%-opaque backdrop across the whole screen, so opening a clue hid the thing the
  room was playing on — which tiles were gone, which hexagons were still open, the
  score. No scrim now, and **the card can be dragged** by grabbing anywhere that
  isn't a control.
  - **The drag is written to `translate`, never `transform`.** The flip animates
    transform through the Web Animations API, so an offset in the same property is
    wiped by the next keyframe or fights the landing. They are separate longhands
    and compose, so a card can be dragged mid-flip and still land on its tile.
  - **Visible and clickable are different requests.** The scrim was also what
    stopped a stray click opening a second clue over the first, so `body.clue-open`
    drops pointer events on the play screen — the card and the team bar keep theirs,
    because correcting a score mid-clue is a real thing a teacher does.
  - The offset resets on every open: an old drag was a decision about the previous
    question, and the opening animation has to land on its own tile.
- **The team bar is back under the board; the timer stays in the header.** The
  header is the teacher's instruments; the bar is the game's state and the room
  reads it. It keeps the compact styling it grew while it lived in the header, so
  the strip costs ~37px rather than the 84px it did originally.
  - **`Kit.floorTop()` earned itself twice now.** The bar has moved out of the
    boards' way and back again, and neither move needed a single fit or layout
    assertion edited — they all ask for the floor rather than restating where it is.
- **Who the points belong to, per mode.** The three phone modes answer that question
  differently and now actually do:
  - **`write`** — the whole room answers, so nobody won the question. `keepControl`
    is a reward for winning it, so applying it here left one team picking every tile
    for a whole game. The turn rotates instead.
  - **`buzz`** — the buzz says who wants the floor and highlights that team; the
    answer is spoken in the room, so the teacher still marks it. Unchanged, and now
    pinned by a test.
  - **`type`** — the student produced the answer in writing and the host judged it,
    so **it scores automatically**, to that team, in every game. Race had this from
    the start; the tile games did not, so the same student doing the same thing
    scored on one board and waited for a click on the other.
- **The phones offer the teams that exist.** The join screen hard-coded two buttons,
  so a class split into four could only pick from the first half, and a team renamed
  to something the room answers to still read "Team 2" on every handset. The phone
  asks the relay (`GET /buzzer/room?code=…`, team names only) as soon as there is a
  code to ask about, and `pushTeamNames` now runs from `renderScorebar` — the one
  place that runs on any change to the list — skipping when nothing moved, because
  that render also fires on every point scored.
- **The bench picks the hexagon.** Blockbusters' real weakness was never the board,
  it was that two students play and the rest watch. The team on turn now chooses its
  next hexagon on their phones — `Team picks` in the legend row asks them, their
  votes land in a strip beside it, and every hexagon carrying the leading letter
  lights up. Setting `bbTeamVote`, on by default; no room, no button.
  - **Advisory on purpose.** The teacher still clicks the hexagon. Students never
    touch the device is the app's constraint everywhere, and a vote that opened a
    clue by itself would make a mis-tap unrecoverable.
  - **A vote can belong to one team**, which is new and reaches three places: the
    relay stores it, the phones that are not entitled show the question with no
    controls, and `Kit.vote` drops what arrives anyway — see "Asking the room to
    choose". Millionaire's Ask the class went onto the same service, so there is one
    implementation rather than two.
  - **Opening a hexagon ends the vote**, before `askPhones`, or the clue's arm is
    immediately overwritten by a vote nobody is still taking.
  - **A vote is a negotiation, so a player can move it.** `rethink` on the arm
    lets a phone tap another option and have its reply replace the first — the
    relay keys replies by player id, so the tally follows and nothing is
    double-counted. Without it the first tap was final, which is a submission,
    not a team agreeing on something. `spent` is not set for a rethink round, so
    a reload comes back able to change its mind too — and the join payload
    carries `yours`, this phone's current choice, so it comes back *showing* it.
  - **A round can carry a clock**, sent once as a duration with the arm and
    counted down on each handset from receipt, so no phone ever compares clocks
    with anybody; a phone joining mid-round is told what is **left**, computed on
    the relay where the round was stamped. Expiry is a fact, not a verdict: the
    phones stop taking taps and say so, the board says so, and **the teacher still
    clicks** — the same rule as Jeopardy's answer clock.
  - **A vote you have to scroll is a vote you cannot make.** Sixteen options fit
    no handset as full-width rows, and choosing between things means seeing them
    at once — so more than six word-length options lay out as **two columns**
    (`.opts.compact`), which fits all sixteen on a 360×640 phone with nothing off
    screen. The minimum column is 140px, not 100: three columns on a 390px phone
    broke `consequently` mid-letter, which is worse than a longer list. And the
    prompt for a list like that is a **label** — "Pick a word" — because every
    line of instruction is a line of words pushed off the screen.
  - The relay's option cap was **6, now 20**: right for a question with four answers,
    wrong for "which letter is still on the board". The phone lays short options out
    as a keypad rather than a list, so the cap is what fits a hand.
- **Voting is not a mode — it is what Ask the class does with whatever room is
  open.** `vote` was one of `phoneMode`'s values, which made it a *choice against*
  buzzing and typing: a Millionaire round could have a class that buzzes or a class
  that votes, never both, and the vote was unreachable unless the teacher had set
  that one value. But the two answer different questions. **A mode says what a phone
  is for during a question; the lifeline borrows every phone in the room for the few
  seconds it runs, then gives them back.** So `phoneMode` is now `off` / `buzz` /
  `write` / `type` and the lifeline votes whenever `buzzHost` exists — including at
  `off`, which is what a teacher who has never opened ⚙ is running.
  - **`off` had to stop meaning "no room".** `phonesWanted()` returned false at
    `off`, so the room a vote needs would not exist — and one opened *by* the
    lifeline is a room nobody has joined, with a class that cannot scan a code while
    the question is on screen. Millionaire now keeps a room open whenever lifelines
    are on, and the chip says `votes only` rather than `idle here`, which would read
    as "don't bother joining" to a room about to be asked something.
  - **The borrowing ends as explicitly as it starts**, and that is what `mVoting` is
    for — distinct from `mCounting` (the board behaves oppositely: a click answers)
    and from `mTally` (the counts outlive the vote being open). **Done voting** hands
    the phones back via `askPhones`; without it a class set to buzz lost its buzzer
    for the rest of the question the moment a lifeline was used. Answering closes it
    too. `reaskPhones()` declines while a vote is live, or a phone joining mid-vote
    would replace four options with a buzzer on every handset and only the votes
    already cast would count.
  - **`off` is a state to put the phones *into*, not the absence of one.** Now that a
    room outlives the mode, `askPhones` disarms at `off` — otherwise closing a vote,
    or leaving a game that was buzzing, left thirty handsets showing a live button
    for a question that had gone.
  - **A value naming a variant that no longer exists is worse than a wrong one** —
    nothing matches it, so the phones go quiet while the panel still claims a dynamic
    is running. `migrateVoteMode` rewrites any stored `vote` to `off`. It needs no
    dropped key to run once: after it, nothing reads `vote` and nothing can write it.
  - Changing `phoneMode` or `mLifelines` now re-syncs the room on the spot rather
    than at the next game, which is the point of the Lab. Never a drop — the room is
    the lesson's, and switching a dynamic must not make thirty people rejoin.
- **A comment can ship without the line it describes.** `nextRacePrompt()` still read
  `if(raceMode==='h2h') askPhones(…)` under a paragraph explaining that timed rounds
  ask too — the previous commit's prose landed and its one-line change did not, and
  the suite caught it only because a *different* test run happened to include it.
  Fixed; timed rounds ask now.
- **Anything above the board must re-fit it, and the buzzer chip wasn't.** The chip
  sits *in* the layout above the stage, and it changes height on its own schedule:
  opening a room is asynchronous, so it appears **after** the board has been fitted,
  and it grows again as phones join and as buzzers go live. Nothing re-fitted, so the
  board kept the height it had when the chip wasn't there and everything below was
  pushed 19px off the bottom — Millionaire's "Final answer?" and the last rung of the
  ladder — with `body.play-fit`'s `overflow:hidden` making it unscrollable. Found in
  class, not by a test. `renderBuzzChip` now measures around its own redraw and calls
  `hook('onResize')` only when the height actually moved. The replies panel already
  did this (`repliesHost`); the chip is the same case and was simply missed — **so the
  rule is the layout, not the widget: anything that can occupy vertical space above a
  board owes it a re-fit.**
- **Hover was out-specifying the locked-in answer.** `.m-option:hover:not(:disabled)`
  beats `.m-option.picked` on specificity, so the option a teacher had just clicked
  kept its hover paint for as long as the pointer stayed on it — which is precisely
  when they are looking at it. Both hover rules now carry `:not(.picked)`. The check
  compares **hovered-and-picked against hovered-and-not-picked**: comparing a picked
  option against a resting one passed on the broken build, because a hovered option
  always differs from an unhovered one.
- **The team bar rides in the header now, not across the bottom of the board.** It
  was `position:fixed` at the foot of the screen and covered the one thing a
  classroom display cannot spare. It now sits in `.header-right` beside the timer,
  styled to match it, above the geo-band. **Measured, not assumed** (Millionaire,
  1280×720): chrome 163px → **80px**, and the header itself went 94px → 80px, so the
  board gained 83px and the strip got *smaller*. On a 390px handset chrome went
  185px → 139px. The timer, Lab and New game each gave up a few pixels to pay for it.
  - **`Kit.floorTop()` is the one definition of the bottom edge**, and it exists
    because this fact was written down in four places — the fit, and three separate
    layout assertions — so moving the bar meant four right answers and any one could
    be missed. It returns the bar's top only while the bar is actually `fixed`, and
    the viewport bottom otherwise. `fitToScreen`, `showResult`'s clearance and every
    layout test ask it.
  - **Nothing in the header may wrap; everything shrinks.** Wrapping is precisely how
    the strip grew — title 384px + cluster 883px is 45px over, so the cluster dropped
    to a second row and the header went 72px → 130px. The title absorbs the whole
    shrink (`flex:1 1 auto`) and the cluster none (`flex:0 0 auto`); the eyebrow
    ellipsises, the bar scrolls sideways. Sharing the shrink even 20:1 still took 4px
    off the cluster, which was enough for the bar to clip its own Reset button.
  - **Below 1100px the cluster takes its own header row**, and below 760px the bar
    takes one within it. A percentage `flex-basis` on a child of a shrink-to-fit
    parent is circular — that threw the page **679px off its right edge** on a phone
    and read as "the bar overflows" when it was "the bar asked its parent how wide it
    was while the parent was asking the bar". `min-width:100%` breaks the loop.
  - **A malformed CSS comment silently deleted the rule that mattered** and cost a
    debugging round: an edit left a paragraph outside its `/* */`, the parser
    discarded everything up to the stray `*/`, and the header behaved as though the
    rule had never been written. CSS fails silently — there is no syntax error to
    see. If a rule appears to do nothing, check the comment above it before the rule.
- **Millionaire answers in two beats: pick, then "Final answer?".** A click nominates
  an option — yellow, pulsing, nothing revealed and nothing scored — and the reveal
  waits for the button. Until then another click *moves* the nomination and any
  lifeline throws it away, which is the point: the pause is where the room gets to
  talk the team out of it. Setting `mFinalAnswer` (Millionaire group, default on);
  off restores the old one-click reveal. Implementation note: `onOptionClick` now only
  nominates, and `revealMillionaire(opt)` holds everything that used to follow it —
  so the steal path, which reopens the question, gets both beats for free.
- **A buzz means whatever `mBuzzRole` says it means, in Millionaire.** The tile games
  (Jeopardy, Blockbusters) already let a buzz pick the answering team; Millionaire's
  ladder is per-team with a fixed turn order so every team gets a full arc, and
  "fastest thumb wins" cuts against that on purpose. Three behaviours, all offered:
  `speaker` (default) — the buzz picks who answers for the team already on turn, and
  a buzz from the other team is refused and the room re-armed so the entitled team can
  still get in; `floor` — whoever buzzes first takes the question onto their own
  ladder, like the tile games; `off` — the buzz is shown on the chip and changes
  nothing, which is what buzzing in Millionaire did before this setting existed.
- **Race timed rounds now actually ask the phones.** `nextRacePrompt()` had
  `if(raceMode==='h2h') askPhones(...)`, so a timed round ignored `phoneMode`
  entirely — picking "everyone types" for a timed round left the phones idle with
  nothing saying why. Timed rounds ask now too; `raceCanTry()` restricts a timed
  round's buzz to the team whose round it is, so a phone on the bench can't steal a
  word off someone else's score.
- **Deployed.** The build stamp is in the three shells and `join.html`; ⚙ reports
  whichever one is actually running, which is how a stale shell announces itself.
- **The settings drawer is how a dynamic gets tried.** ⚙ during play (or `L`) opens
  the docked drawer for the game being played, without leaving the board — see "One
  gear, two forms" above. It exists because prototyping was the bottleneck:
  comparing two ideas meant ⚙ → find the right tab → change → close → restart, and
  by then the round was over. Everything registered shows up in it for free, so the
  next dynamic is a `S.register` call and nothing else.
- **Works on a phone as well as a computer**, and both are enforced by the layout
  contract above rather than assumed — see "Screens: one layout contract". Jeopardy
  scrolls sideways on a handset with legible columns; Millionaire's ladder is a
  horizontal strip; chrome is 198px instead of 323px. **Verified only in Chromium's
  device emulation** — real handset browser chrome (URL bar, gesture area) shrinks the
  visible height further and changes it as you scroll, which nothing here models.
- Game Hub MVP live as **one consolidated app** (`game-hub.html`): choose unit →
  game → sections → play. **3 units across two coursebooks** (Empower C1 Unit 4
  Consciousness and Unit 5 Fairness; New English File 5th ed Unit 1 Food & Family),
  **4 games** (Jeopardy, Blockbusters, Race to the Board, Millionaire), shared engine,
  DCU-branded. 3 of the 4 are spec Tier 1 — content-agnostic, so they transfer to any
  unit, which is what makes the "this scales to the coursebook" claim defensible.
- **Race to the Board** (Unit 5 only so far, 48 prompts across 5A–5C): target words
  scattered across the screen, teacher reads a **gapped sentence**, a student runs to
  the projector screen and touches the word, teacher clicks it on the laptop.
  **Two modes**, picked on the content screen:
  - **Head-to-head (default)** — both teams at the board, first touch wins. The engine
    can't know who touched, so after a correct click you say who got it: click the team
    chip or press `1`/`2`. Wrong touch = red flash, sentence stays up so the other team
    can steal. No clock; ends when the board is cleared.
  - **Timed team rounds** — one team per 60s round, then the board passes on. Wrong tap
    advances and the sentence returns to the queue later.
  - Board caps at 18 words and **re-scatters after every claim** so position can't be
    memorised; a jittered-grid layout guarantees no overlap and shrinks the type
    (`--rs`) if the field is too small. Claimed words carry the team's colour.
    **One word per cell is not sufficient on its own** — two things broke it once
    the banks grew longer words. The ±1.5° tilt makes a 288px-wide tile ~8px
    *taller* than its layout box (the growth is proportional to **width**, so it is
    the long words that collide vertically), and unrestricted jitter lets one word
    sit hard against its cell's right edge and the next hard against the following
    cell's left edge. Cells are now sized to the **rotated** box and a 12px gutter
    is withheld from the jitter. Verified over 240 randomised scatters at four sizes.
  **Distractors aren't authored** — every other word on the board is a real target
  word from the selection. Spec §4.4 updated to match as-built.
- **Millionaire** (Unit 5 only, 52 questions across 5A–5C): four
  options, rising difficulty, teams take turns. Decisions taken, all recorded in
  spec §4.4:
  - **Parallel ladders, interleaved turns** — settles the open question in §9.5.
    Each team climbs its own 8 rungs (100/200/300/500/800/1200/1600/2000) so
    everyone gets a full arc, but the turn passes every question so nobody sits out.
  - **Additive scoring, so no safe havens.** §4.4 wanted safe havens to stop a late
    mistake wiping a team out; never deducting solves it more simply and keeps the
    shared team bar consistent. Wrong = lose the turn, retry that rung later with a
    different question.
  - **Lifelines**, one use each per team, switchable off: **50:50** (state lives on
    `mCurrent.removed`, so a re-render can't wipe it), **Ask the class**, and
    **Confer** (runs the header timer).
    **Counting is not the same as having counts** — `mCounting` vs `mTally`, and
    conflating them dead-ended the round in class. While the teacher taps hands a
    click adds a hand; once the count is in, a click has to *answer*, or the votes
    sit on screen with no way to play them. Two consequences: with phones voting
    there is no tapping at all, so the board is never a tally pad; and **Done
    counting keeps the numbers**, because they are what the team is deciding on.
    **Ask the class is a phone vote whenever there is a room** — not a `phoneMode`
    to pick, see Current status — and hands in the air when there isn't.
  - Every section covers all 8 rungs, so one section fills a ladder (§3.4).
- **Persistent shared team bar** on every screen: team names + points survive
  moving between games, units, and setup screens (nothing resets on navigation).
  Both games feed one score — Jeopardy awards the tile value to the selected team;
  Blockbusters awards +1 per claimed hex to Yellow/Blue (teams[0]/[1]).
- **Blockbusters knows when someone has won.** A completed line used to do nothing
  at all. `bbOutcome()` runs after every claim: BFS over the honeycomb for a
  connected route, then the winning hexes light up and a banner names the team.
  - **Adjacency comes from `BB_ROWS`, not hard-coded.** A row is inset by
    `(widest − size)/2` columns — exactly what the layout does with `startX` — so a
    hex's position across the board is `inset + col`, and two hexes touch at a
    distance of 1 within a row or ½ between rows. Change the board shape and the
    win logic follows.
  - **An edge is the board's extreme, not the end of a row.** Counting a short row's
    end hex as an edge let yellow "win" with a line floating mid-board touching
    neither side. Restricting yellow to the long rows also restores the real game's
    asymmetry — yellow needs 5 hexes, blue 4.
  - **Blocked is an ending too**: when neither team can reach its far side even
    using every unclaimed hex. Mostly catches a board short of clues.
  - **The glow is the winning team's colour.** The board sits on a white page, so a
    white halo is invisible and a brightness flash on yellow just washes it out.
    `BB_GLOW` in the engine and `.hex.route.claimed-*` in the CSS must stay in step.
  - The route animation is a **variant** (`bbWinRoute`: `trace` / `pulse` / `off`),
    registered in `Kit.anim` under `winRoute`. Each takes the glow colour and
    returns how long it will run, so the banner waits for it to land.
  - `showResult({eyebrow,title,sub,tone,actions,onShow,onHide})` is the shared
    end-of-round banner — the next game that reaches an ending writes no markup.
    It's a banner, not a modal, so the board stays visible; Blockbusters is the one
    board not sized to fit the screen, so `bbFitAroundBanner()` scales it into
    what's left rather than letting the banner cover the route it just lit.
  **↺ Reset points** zeroes scores but keeps names; +/- for manual correction;
  rename + add-team; active-team / whose-turn highlight.
- Teacher **countdown timer** in the header on the play screen (start/pause, reset,
  ±15s, red under 10s).
- **Boards fit the screen — never scroll.** Jeopardy (`fitJeopardyBoard`) and Race
  (`scatterRaceWords`) measure the space left between the header and `Kit.floorTop()`
  and size themselves to it, scaling their type down if needed; `body.play-fit` drops
  the body padding while they're up. Both re-fit on resize.
  **`Kit.fitToScreen` subtracts ancestor bottom padding**, because that padding sits
  *below* the element and so is space the element still needs. Skipping it slid Race's
  last row 3px under the team bar the moment the game-show stage added its own
  padding — visible at 1280×720 only, which is why this is measured rather than
  covered by a bigger fudge factor. Jeopardy tiles used to
  take their height from a fixed 3:2 aspect ratio, so fewer categories meant taller
  tiles and up to 1400px of hidden board — don't reintroduce a fixed aspect ratio.
  Blockbusters is the same lesson in a different disguise: `layoutBlockbustersBoard()`
  spaces the hexes from their **rendered** width (a `vw` clamp), so it must run after
  `showScreen('screen-play')` — measuring behind a hidden screen returned 0, fell back
  to a hard-coded 90px step, and the hexes overlapped by 21px at 1440px wide. Building
  and laying out are separate, and positions come from `data-row`/`data-col`, so a
  resize repositions without rebuilding and claimed hexes keep their colour.
- **Phones — run one class, learned one thing.** Students open `join.html` (or scan the
  QR), enter a 5-digit room code + name + team. Everyone connected first time; the
  dynamic itself was the problem — a room of buzzers **just makes everyone mash the
  button as fast as possible**, which is a reflex test, not a language one. So what the
  phones do is now **one `phoneMode` variant, not several toggles**: `off` / `buzz` /
  `write` / `type`. They began as independent booleans and immediately contradicted each
  other — with typing and buzzing both on, one had to silently win, decided by a
  hard-coded precedence nobody could see. **A dynamic is a choice between iterations**,
  which is a variant. `phonePrompt` decides whether the question appears on the handset
  at all (off keeps their eyes on the board), and `phoneOneEach` stops the fastest thumbs
  owning it.
  - In **Race to the Board head-to-head** a sentence arms the buzzers; the first buzz
    takes the floor and *carries the team*, so a correct word scores automatically and the
    "who touched it first?" chooser never appears. Wrong word = no penalty, buzzers
    re-open for a steal.
  - **The mode decides in every game — including Race, which used to be exempt.**
    Race head-to-head opened a room and armed buzzers *whatever the setting said*, a
    leftover from when buzzers were a Race-only feature. That made "Nothing — phones
    idle" a lie in the one game phones were actually used in, and made every other
    mode unreachable there. **Behaviour change:** Race now needs `phoneMode` set to
    `buzz` (or `type`) before phones do anything, the same as the other three.
  - **Every mode reaches every game through `askPhones`, and that took a bug to
    establish.** Race armed a buzzer *directly*, so `phoneMode` had no effect on the
    one game phones were actually being used in — picking "everyone types" kept
    handing the room a buzzer. Millionaire never called `askPhones` at all. Two
    things that had to follow:
    - **The replies panel goes where the question is.** It was hard-coded to the clue
      card, which Race and Millionaire do not have, so those games collected answers
      and the room saw nothing. `repliesHost()` picks the card when a clue is open and
      the game's own question area otherwise, and the board re-fits, because thirty
      answers is several rows of panel.
    - **Opening a room is asynchronous.** Millionaire deals its first question inside
      `start()`, before the code has come back — so that question was asked before
      there was anybody to ask. `reaskPhones()` runs when the room is ready.
  - **One room per lesson, not per game.** A room used to be torn down with the game,
    because that is where its code happened to be created — so changing games minted a
    new 5-digit code and the whole class had to rejoin, rescan and retype their names
    mid-lesson. There are two different things and only one of them is "close":
    **park** (nothing for the phones in *this* game — disarm, keep everyone joined,
    and the chip says `idle here` rather than showing a live-looking code above a room
    with nothing to do) and **drop** (the feature is switched off or the relay address
    changed, which is the only thing that ends a room). Leaving a game parks.
  - **A student who joins mid-question lands in it.** The relay sends the room's live
    state with the `joined` event and the phone runs the same path an arm does.
    Students trickle in — late, wrong WiFi, locked phone — so "you see nothing until
    the next question" is the common case, not the edge case.
  - **The teacher sees what was typed, right or wrong** — the strip carries the name,
    the word in quotes, and a verdict. A miss is the most useful thing on it: who is
    nearly there, and how, is exactly what you would want mid-round. It survives the
    re-arm for the same reason. **Everything the class does goes in that one strip**,
    the same one in every game — see Current status.
  - **`type` is the answer to that class.** The student writes the word, *then* buzzes:
    the button is dead until the box has something in it, so the race is to **produce**
    the word while still reading the board. Judged on the host and only there — the relay
    never learns the answer, so it can never be asked for it. Three decisions, all
    switchable:
    - **A miss costs time, not points** (`typeCooldown`, default 3s). That phone alone
      waits it out while the room stays open, which is why the re-arm is a **`reopen`**:
      a plain arm clears the box, and clearing it throws away the half-word somebody else
      was racing to finish.
    - **Three verdicts, not two.** `Kit.answer.judge` returns `right` / `close` / `wrong`;
      `close` takes the floor and tells the phone to check its spelling, unless
      `typeStrict` is on. "Produced the word but mis-spelled it" is a different fact
      about a student from "didn't know it", and the room should hear it differently.
      Tolerance scales with length (0 under 5 letters, 1, then 2 from 9), and **no two
      answers in either Race bank are within it** — a smoke check, because a collision
      would hand somebody the wrong word.
    - **The phone does not spell it for them** — `autocorrect`, `autocapitalize` and
      `spellcheck` are all off, or the handset finishes the word.
    - **In Race the typed word is the claim**: the student named it, so it scores without
      the teacher clicking. A plain buzz still needs the click, because a raised thumb
      doesn't say which word they meant. Not offered in Millionaire, for the same reason
      it never gets an anagram — four options hand you the word.
    - **A verdict has to outlive the next question.** Race re-arms the instant a word is
      claimed, so "Yes!" lasted about a frame; it now holds for 1.5s over anything the
      next arm wants to say.
  - Phones never talk to the laptop directly — school WiFi blocks that. Both ends
    connect out to `tools/buzzer-relay.js`, the same shape as Kahoot.
  - **The relay serves the site too, deliberately**: an https GitHub Pages page may not
    talk to a plain-http LAN relay (mixed content). So the relay's own address is the
    one to use in class — for the hub *and* the join page.
  - **Deploying it is the intended setup** (`Dockerfile` + `render.yaml`, Render
    blueprint): one https origin serves hub + join + relay, nothing runs on the
    classroom laptop, and it survives WiFi that blocks phone→laptop traffic.
    Running `node tools/buzzer-relay.js` locally is the no-account alternative.
    **Buzzers can never work from the GitHub Pages URL** — no relay behind it; the
    bar says so explicitly.
  - **Everything degrades**: buzzers off, relay dead, or WiFi gone → the hub behaves
    exactly as before with the manual chips / `1`-`2` keys. Verified for all three.
- **Game show mode is the default**, on all four games *and* the setup screens.
  `theme` is a variant setting (`gameshow` | `dcu`); `body.theme-gameshow` is applied
  by `applyTheme()` from `showScreen`, so it covers unit-select, game-select and
  section-select too — a lit board reached through a white setup screen loses the
  moment before it starts. `themeOf()` resolves to the active game's setting once one
  is chosen and the **master** value before that. DCU is one switch away and is pure
  override — nothing in the base stylesheet changed.
  - `.lit` marks *a stage being played* and is cleared on leaving the play screen, or
    a stale one lights up again the next time that panel is shown.
  - **The game-selector icons animate what their game does** — Jeopardy's tiles light
    along the diagonal, Blockbusters' inner hex pulses inside the outer, Race's bars
    run left-to-right, Millionaire's ladder climbs. Pure CSS on the existing SVG
    children keyed off `.game-card[data-game]`, so there is no new markup and adding
    a game's icon animation is one rule. Hover speeds up only that card's icon.
  - **`--tension` is the whole idea.** `mTension()` turns the rung the team is
    playing for into one 0–1 number on `#play-millionaire`; the CSS reads it to
    close the spotlight in and pull the wash from blue towards red, and the
    think-music bed reads it for tempo and filter. One number, both halves of the
    atmosphere. Adding a mood to some other beat = another CSS rule, no new state.
  - **Sound is still all synthesised** (offline). New: `Sound.bedStart/bedSet/bedStop`
    (a looping bed with an LFO heartbeat — it plays only under a live unanswered
    question, so it never runs while the teacher reads out a result),
    `Sound.applause` (filtered white noise, not a sample), `Sound.fanfare`
    (detuned sawtooth through a lowpass), plus `lock` / `klaxon` / `sting` voices.
    Original riffs, deliberately not the shows' own music.
  - **Title sequence**: `INTROS[game]` holds the copy and accent colour, `runIntro()`
    plays one shared sequence and resolves when it ends *or* is skipped. Adding
    Jeopardy's ident is an entry in `INTROS`, not another animation. It plays over
    the finished board, so skipping drops you into a game already running.
    `intro` setting: once per session (default) / every round / off.
  - **Nothing flashes faster than ~1.5Hz** and no flash is full-screen white — this
    is projected at students whose medical histories you don't have. Every animation
    in the skin is switched off under `prefers-reduced-motion`, which also shortens
    the intro to a still card rather than removing it.
  - Escape is deliberately *not* the skip key — it belongs to the settings panel.
  - **Each game gets its own signature, not one sparkle applied four times.**
    Millionaire: gold, chase lights down both sides, a spotlight closing in.
    Jeopardy: blue starfield, gold-on-navy tiles, a board that **deals itself in**
    on the diagonal (`jDeal`). Blockbusters: violet honeycomb lattice — violet
    because yellow and blue are *game state* on that board and both have to stay
    legible — with the hexes assembling themselves (`bbDeal`). Race: floodlit green
    track with lane markings, words flying in, and a **starting pistol** the moment
    a sentence goes up (`Sound.crack` — the same noise buffer as the applause, but
    the envelope is the whole sound: 3ms of attack through a highpass).
  - **`--tension` is one contract fed from three different places**, which is the
    whole trick: Millionaire's rung; Jeopardy's *value at stake* over a floor that
    rises as the board empties; Blockbusters' **distance to a finished line**
    (`bbStepsToWin` — Dijkstra, your hexes free, unclaimed cost the question you'd
    have to answer, the opponent's are walls; one hex from a win reads 1.0); and
    Race's **board cleared plus whether a race is live this second** — the only one
    with two ingredients, because a sentence going up is when students leave their
    chairs. A fifth game needs a new source, not new plumbing.
  - **Stagger on `row+col`, never DOM order**: a 12×6 Jeopardy board is 72 cells,
    and a flat stagger runs for 3 seconds with the class waiting on it.
  - **`--title-vw`** exists because a four-word title at the shared 11vw cap runs
    off the screen. When measuring the title in a test, wait for the slam to land:
    it holds at `scale(2.4)` through its delay, so an early rect reports it two and
    a half times its real width.
  - **Two specificity traps, both already paid for.** `body.theme-gameshow
    #play-blockbusters.lit .hex.claimed-gold` out-specifies `.hex.route.claimed-gold`,
    so the skin silently cancelled the winning-route glow until the route rules were
    scoped to `.lit` too. And setting `border-color` on the themed `#result-card`
    out-specifies `.tone-silver`, painting a blue team's winner banner gold. Both
    have smoke-test checks.
- **A cleared Jeopardy board now ends the game** — `jFinish()` ranks the teams,
  handles a tie, and raises the shared `showResult()` banner. Theme-independent;
  the game-show skin just adds the fanfare and applause on top. Same gap
  Blockbusters had.
- **The clue card is skinned and flips correctly.** It had *zero* game show rules, so
  a lit board opened a white DCU card; the value face now takes the Jeopardy tile's own
  gradient, so the card reads as that tile rising off the board. It sits outside the
  stage and so cannot inherit `--tension` — `openClueCard` sets it, and a `$500` clue
  arrives hotter than a `$100`. DCU is untouched, and a check asserts both directions.
- **Settings panel** (⚙ in the header, Esc or click-away to close), built from a
  registry so a new feature's switch appears by registering it — see "Adding a
  feature" above. Currently: sound on/off, volume, race re-scatter, race round
  length, race section tag. Saved per device; **Reset to defaults** restores all.
- **Sound effects** — synthesised with Web Audio (no audio files, so offline still
  works): rising tone for right, buzz for wrong, chime on a Blockbusters claim,
  fanfare on a cleared board, low tone when a timed round expires, a swoop on the
  card flip and a chime on the answer reveal.
- **Card animation** is a **variant** setting, per game, switchable mid-game:
  **`morph`** (the default) reads the shape of whatever was clicked via `Kit.shapeOf`
  and unfolds from it — a genuine hexagon in Blockbusters, the tile's own corner
  radius in Jeopardy, and any future board shape for free. `grow-turn` is the previous
  behaviour, `turn-only` has no travel, `rise` avoids 3D entirely (the fallback if a
  machine stutters), `off` opens instantly. Registered in `Kit.anim`.
  Two things that will bite: **clip-path is animated on the two faces, not the card** —
  on an element with `transform-style:preserve-3d` it flattens the 3D and kills the
  flip; and the shape is measured **against a face**, because the corner rounding lives
  there, so measuring the card would morph the corners square.
- **Card flip** (Jeopardy + Blockbusters): clicking a tile grows the clue card out of
  that tile and turns it over — front face carries the tile's own `$400` / letter,
  back carries the clue. Uses the Web Animations API against the live element rects
  (`openClueCard` / `closeModal` in hub-engine.js), so it lands on the right tile at
  any board size. Shape: **grow at full value, then turn** (open, 1150ms); answer →
  **550ms hold**, turn back to the value at full size, hold, then settle into the tile
  (close, 1000ms). `flipSpeed` scales all three. Four things that will bite if touched:
  - **Ease each keyframe segment, not the whole run.** One curve across the lot makes
    the early phase rush and the hold on the value vanish.
  - **Rotation segments must be `linear`.** An eased turn puts peak angular speed
    exactly at the edge-on point, where the projected width collapses — so the card
    snaps through. Constant rate roughly halved the worst per-frame jump (206px → 85px).
  - **The closing animation needs `fill:'forwards'`.** Without it the card reverts to
    full size for one frame before the modal hides, which reads as "it warps back in".
    The landing segment must also *decelerate*; an accelerating curve there was the
    other half of that complaint.
  - **The faces are swapped explicitly, not by `backface-visibility`.** That guard was
    real but inactive for the whole animation — `.flipped` is added in `onfinish`,
    after the turn is over — so captured frame by frame the value was painted
    **mirrored from about 100° to 180°** on every variant, ~135ms each time a clue
    opened. Hiding it then exposed what it had been covering: the clue face was not
    painted during the turn either, so the card went **blank for four frames**.
    `backface-visibility` was culling the face that should have shown while leaving
    the one that should not, so it is gone from both faces. `guardFace()` swaps them
    at the edge-on frame; each variant declares `edgeOn:{open,close}`, and the guard
    **takes its timing from the animation the variant returned**, because `turn-only`
    runs at `ms*0.8` and `rise` at `ms*0.5` and a fixed figure left one mirrored frame.
    Separate z planes (`translateZ(2px)`) and the `.flipped` rule both stay.
  - Measure with `naturalRect()`, never a live `getBoundingClientRect()` — a rotated
    card reports its *projected* box, and the maths then lands it off its tile.
  Honours the `cardFlip` setting **and** `prefers-reduced-motion`; with either off it
  opens instantly, exactly as before.
- **Spent Jeopardy tiles keep their value, faded, and stay clickable** — clicking one
  reopens the clue with the answer already showing, marked "· review" in the topline,
  with no scoring buttons. Nothing about the game state changes.
- DCU reskin: light theme, geometric band, uppercase grotesk, game-card icons.
- To change unit mid-session: game screen → "New game" → "Change unit".

## Next
**The agreed direction and its build order are at the top of this file** — see "Where
this is going: skins hosting rounds", and `docs/game-hub-requirements.md` §3.8–§3.10
for the full version with requirement IDs. The short form, in order:

0aa. **Teach with the open questions and the standings, and settle the guesses.** The
   whole of the position-and-time work is untested against a class, and it changes the
   *feel* of every board rather than adding a feature to one. Three things to watch,
   in order of how likely they are to be wrong:
   - **Does a standings screen after every question drag?** It is the beat most likely
     to be an irritation on a fast board. `roundWinBanner` turns it off; the honest
     answer might be "only on Quickfire" or "only every few questions".
   - **Is the podium worth having, or does `equal` teach better?** The whole argument
     for holding a question open is that the room keeps working; if second place at
     60% still feels like losing, `equal` is one tap away and is the real test of it.
   - **Does the extra press cost too much?** An open round needs Reveal then Close
     where a won round used to take itself. `roundOpenToAll` off puts the old race
     back.
   **Nothing else here should be built until that lesson has happened** — the numbers
   (60/30 shares, 0.5 floor) are guesses, and a classroom is the only thing that can
   say whether they are the right ones.
   **Status: the first team-mode lesson ran (2026-08-12, ef-2a — see
   `docs/feedback.md`) but the Classic-ruleset accident dominated it**, so none of
   the three questions above got a clean read. The rerun with ruleset = Hub, the
   drag rounds on `first` and a cleared score-report ledger is the one that counts.
0. ~~**Individual play — steps 2 to 5.**~~ **Done, all of it** — the roster
   switch on the setup screen, the roster built from joined phones, all six boards
   declared solo (three of the four assumed exclusions were wrong), and the whole
   solo display layer on top: place badges, the crowd picture, the crowd reveal.
   See Current status. What remains solo-flavoured is tuning, not building.
0b. **Convert NEF-1, and audit the ordering scales against the scans.** NEF-1 is the
   one unit still carrying simple questions on Jeopardy and Blockbusters. The audit
   is the more important half: Unit 5 has six scales built from English the unit
   never teaches, and no check can catch that — only reading the pages can.
0c. ~~**Fix resume — a reconnecting handset lands on "Waiting for the teacher".**~~
   **Done** — and the phone was innocent: the deployed relay restarts on every push
   and forgets every room, and the hub never re-told the new room the question. See
   the top of Current status.
1. ~~**Teach a lesson with it.**~~ **Done — the first live class ran (2026-08-05),
   with rounds on real phones.** Five reports came back; **all five are addressed**
   — see "Four of the five classroom reports are fixed" at the top of Current
   status. The one open thread: whether Drag the Letters' wrong-team payout also
   involved students joined under the wrong team (the index-shift half is fixed;
   ask whether teams were removed mid-lesson, and watch the phones' team pills in
   the next class). Every fix is a first classroom iteration — the winner banner's
   4s, the progress lanes, the kick flow all await a second lesson's verdict.
2. **Judge Word Drop, then decide whether it gets a host.** It is bench-only on
   purpose: no game show can run its fall clock, because `ctx.again()` is lent by
   the question bench and nothing else. Play it, judge the fall times (9s→4s,
   −700ms a word, all guesses), and if it earns its place the host work is
   `again()` in `jGroupCtx` plus content. If it does not, delete it — a round
   nobody authors for never meets a class, so the cost of being wrong is zero.
3. ~~**Round state that outlives one question.**~~ **Done** — `ctx.keep`, built
   and proven with the bingo round (see Current status). Roles, hands of cards and
   personal scorecards are now buildable; the residual is Bingo-the-skin adopting
   the bingo round.
4. ~~**The declarative action strip** (F3.9.1/F3.9.2), so a round may have more than
   one button.~~ **Done** — see Current status. ~~The stage-as-mount for Race~~ is
   also **done** (Race is the fifth host). What is left of the extraction ladder is
   **Bingo-the-skin onto the bingo round**, then **Race extracted** — working games,
   last on purpose.
4a. ~~**`openHex` in the `grouping` suite is a coin toss.**~~ **Done** — and the
   premise was wrong, which is the useful half. LB1 is exactly 18 items and the board
   is exactly 18 hexagons, so every named clue *is* dealt; the note's "18 from the 28
   in LB1+LB2" described a selection the test does not make. The real fragility was
   an open card: a caller that revealed a clue and left it up made the first hexagon
   click a no-op and the loop read the *previous* clue. It closes what is open before
   it starts, counts the hexes rather than assuming 18, and **the precondition is now
   asserted** — if LB1 ever outgrows the board the suite says so by name instead of
   failing three checks at random.
4b. ~~**A red check in `qbench`**~~ — **Done**, and it was a stale selector rather
   than a missing element. See Current status.
5. ~~**Decide what Millionaire's buzz settings are for.**~~ **Retired** — see Current
   status. What is *not* decided: a buzz that picks who speaks for the team **before**
   the round takes the room, which is what `speaker` was always for and is a new beat
   rather than that switch. Still open, and it needs a classroom question first —
   whether naming a speaker is a thing a teacher wants on this board at all.
6. ~~**Content filing by topic**~~ — **decided against for now**, see build order item 8.
   Content stays in per-game banks; the `author-content` skill delivers what was wanted
   from it.

**The three that are worth building for what they'd prove**, rather than for what they
are — see "What the container makes possible":
- ~~**An information gap round**~~ — **built** (see Current status), and it did not
  drag persistent per-player state into existence after all: `promptByPlayer` within
  one question was the whole need. Still to do: content in a Lab category and a real
  unit, and a classroom run.
- **Word Spy** — offered, not built, and the user liked the shape: every phone shows
  the same secret word except one, which shows a near neighbour (everyone "beach",
  the spy "swimming pool"); each student says one sentence about their word, then the
  room votes on who the spy is. It is a deal plus a vote, both on the shelf, and it
  only became buildable when `promptByPlayer` shipped. Highest speaking-per-minute of
  anything on the list, and about a third of what Word Drop cost.
- **An Only Connect wall** — nearly free, because the grouping round already *is* the
  wall. The cheapest possible test of whether a new skin costs what Blockbusters did.
- **Just a Minute** — a format with no questions in it at all. If that works in this
  container, "Game Hub" is the wrong name for what has been built, and §1.2 of the
  spec needs rewriting rather than extending.

Everything below is either a known gap or a question a classroom run has to answer.
- **Nothing on the bench or in the Lab has met a class, and the guessed numbers are
  piling up.** The 700ms settle and the 4-mistake budget from the bench, Story
  Reveal's 5→3 drop, and now the grouping clue's 700ms take-beat and its
  eight-words-four-to-find. Eight may be too many to read from the back of a room;
  the only way to find out is to play it.
- **Type-then-buzz has never met a class.** It is built, switchable and tested, but every
  number in it is a guess: 3 seconds for a miss, one letter of tolerance at five letters,
  spelling forgiven by default. Run it against plain `buzz` from the Lab between rounds —
  that is what the drawer is for. The specific unknowns: whether thirty phones typing
  kills the pace, whether the cooldown feels like a punishment or a pause, and whether
  students look at the board at all once there is a box in their hand.
- **The shell can strand a user on old assets.** `game-hub.html` carries no cache stamp
  of its own, so a browser holding it loads the previous build silently — see "Run".
  Give the shell a `Cache-Control` meta of its own. Small, and it removes a whole class
  of "it didn't deploy" confusion.
- **More typed items, especially Millionaire's.** The three new question forms work but
  sit at 4.1% of the content, so a round can pass without meeting one. Mechanism done,
  content thin — see "Question forms are a registry too".
- **A phone check on a real handset**, not Chromium emulation. Jeopardy sideways-scroll
  is the part most likely to feel wrong under a thumb.
- **Content filing is a project rather than a refactor**, and it is last in the build
  order for that reason. Today each game has its own bank shape (`jeopardyBank`,
  `blockbustersBank`, `raceBank`, `millionaireBank`) and the content gate *enforces* no
  shared prompts — deliberate, because answer shape genuinely differs (Blockbusters
  needs a one-word answer whose initial matches its hexagon, Race needs unique single
  words, Millionaire needs four options).
  - **It is a filing system, not one pool** — see the direction section at the top.
    Some content is shareable (a word and its definition); a grouping set and an
    ordering scale are **bespoke by nature** and cannot be derived from anything else.
    An earlier draft of this note claimed one universal pool; that was wrong.
  - **Author ~20 items by hand before writing any code that consumes them.** If most
    C1 content turns out bespoke rather than shareable, the change buys far less than
    the halved-authoring-cost claim suggests — and that claim is what the demo pitch
    rests on, so it is worth measuring rather than assuming.
  - It migrates 565 items when it happens, so the gate goes first.
- **Jeopardy at 16 categories is legible, not comfortable** (10.5px headings at 1280px).
  Either cap the categories per board or nudge the teacher toward fewer sections on the
  content screen. Not a CSS problem.
- **Buzzers need a real class.** Only ever driven by scripted browsers. Unknowns:
  latency on real handsets, whether the school WiFi allows the LAN route at all
  (one-minute test in `docs/buzzers.md`), and whether phones are a net win or a
  behaviour problem. Not wired into Jeopardy/Blockbusters yet — picking which team
  answers a tile is the obvious next use.
- **Sound is a first pass** — five synthesised cues. Worth checking on real classroom
  speakers; if they're thin, the fix is a richer envelope, not sample files (offline).
- **Race to the Board — head-to-head + full-screen scatter shipped; awaiting a real
  classroom run.** Variations discussed but not built, roughly in priority order:
  **relay** (each team lines up, one student per sentence — stops the two fastest
  students owning the game), **wager** (call 1 or 3 points before hearing the sentence),
  **class vs. the clock** (no teams, one shared score), **sweep** rounds ("touch *all*
  the words to do with punishment"), **director & toucher** (one student directs another
  by language alone — highest speaking value of the lot), and further prompt types that
  reuse the same mechanic for free: definition, word-form change, collocation, odd one
  out, error correction, pronunciation/stress. Deliberately not built: continuous drifting
  words — the teacher has to click a moving target while a student shadows the beam.
- Author Unit 4's race + millionaire banks (4A–4D); Unit 4 still shows only
  Jeopardy + Blockbusters.
- **Millionaire authoring cost is now measurable**: 36 four-option questions for one
  unit — the single biggest content job so far, and the number to quote when asked
  what a unit costs.
- **The phone dynamics still to try**, now that a vote is a shared service and can
  belong to one team: a **confidence wager** in Jeopardy (1/2/3 before the clue turns
  over, paid at that multiple — a vote, quiet, and individual rather than a race);
  **buzzers to pick which team answers a tile**; an **exit ticket** at the end-of-round
  banner, which would be one `onFinish` hook plus `write` mode and would reach every
  game including future ones; and **personal scorecards**, the big one, because it
  means the relay holds state across questions.
- **The Race "director" dynamic is the highest language value and the least code** —
  the sentence goes only to the seated students' phones, never the board, so they
  have to talk the runner onto the word without saying it. Worth running verbally in
  one lesson before building anything.
- Measure authoring cost per unit (the number the demo pitch hinges on). Race is the
  cheapest data point so far: 36 prompts, no distractors.
- Fill Unit 4's Jeopardy gap — the card claims 4A–4D but only 4A/4B have categories.
- Small wins: "steal" in Blockbusters (wrong → other team claims); self-host fonts
  for true offline — also what a chunkier display face for the game-show wordmarks
  would need.
- **Game show mode is now on all four games and has never been in front of a class.**
  That is the gap: check the music bed isn't fighting the teacher's voice on the
  classroom speakers, whether the title sequence is still welcome by the fourth
  round (the once-per-session default is a guess, not evidence), and whether the
  lights lift the energy or tip a class over. Adding a fifth game's ident is its
  name in `theme`'s and `intro`'s `games` arrays, an `INTROS` entry, its stage rules
  in the skin block of `hub.css`, and a source for `--tension`.
- ~~Product-line decision: is the Game Hub now the product, with #2/#3 as legacy?~~
  **Decided (2026-08-05): yes.** The three workflows are the product — the hub to
  play a class, the question bench to make rounds, the room bench to test them in
  the hub with simulated phones — and `index.html` leads with them. Generations 2
  and 3 are labelled "Older" on the landing page and kept, not deleted: `classic`
  still holds the four team-building games, which exist nowhere else, and keeping
  them costs nothing.

## Constraints
- No build step; must run by opening a file. Fully offline (use `<script src>`,
  not `fetch`, which browsers block on `file://`).
- Works on a standard classroom TV/browser; large fonts, high contrast, readable at distance.
- Teacher controls everything; students never touch the device. (Race to the Board is
  the one game students are physically involved in — they touch the *projected image*,
  which isn't a touchscreen, so the teacher still does every click.)
- Repo is **public** — don't commit anything that shouldn't be internet-visible.

## Before you push — ship it, the user looks at it
**The default is: no test suite.** The tests open a real browser and play the games,
which is worth it when nobody is watching the screen. But the user *is* watching — on
the real site, on a real phone. For most changes their eyes are faster and better than
four minutes of robot. **Small changes taking a long time is the thing this is fixing.**

**The loop, every time:**
1. Make the change.
2. `node tools/check-syntax.js` — 2 seconds, always run it (see below for why).
3. Bump the cache stamp, or the browser serves the old file and the fix looks unshipped.
4. Commit and push. The site is live in ~40s.
5. The user looks, screenshots, says what's wrong.

**Three cases where I stop and ask first.** Say the risk in one line and let the user
choose — never test by habit, and never silently:
- **Something all five games share** — `hub-kit.js`, `hub-engine.js`'s shared half, the
  header, the team bar, the clue card, settings, the fit, `hub.css` outside one stage.
  One mistake breaks five boards at once and only the opened one gets noticed.
- **Phones or the relay** — `hub-buzzer.js`, `buzzer-relay.js`, `join.html`. The user
  cannot check this alone; it needs a second device, and the suite fakes thirty in
  seconds.
- **Content in bulk** — 20 seconds, and it catches what eyes cannot: the same prompt
  copied into two banks, an answer whose initial doesn't match its hexagon.

Everything else — one game's board, one stage's CSS, a new setting, docs, this file —
just push.

**What this costs, honestly:** some breaks don't show on the screen being looked at.
That is the accepted trade. Say so when it's likely, rather than reaching for the suite.

**If a test is run, match it to what changed** — a 25-minute gate is one that gets
skipped or truncated, which is worse than a small one that runs.

| What you changed | Run this | Costs |
|---|---|---|
| **Content** (a bank, a unit file) | `--only=content` | ~20s |
| **One game's own logic** (board, its `tension()`, its stage CSS) | `--only=<game>` | ~40s |
| **Shared layer 1** — `hub-kit.js`, the header, the team bar, the clue card, `hub.css` outside one stage, settings, the fit | `--only=millionaire,fit,phone,card,turns,gameshow,lab,registry,competition` | ~4 min |
| **A playground page** (`playground/*.html`, `bench-kit.js`, `lab-forms.js`) | `--only=playground,forms,bench,qbench` | ~1 min |
| **A question round** (`hub-rounds.js`, `hub-rounds.css`, `rounds/*.js`) | `--only=qbench,grouping,anagram,card,gameshow` | ~4 min |
| **The Lab board** (`unit-lab.js`, `game-hub-lab.html`, a clue that runs a round) | `--only=grouping,content,jeopardy,card` | ~2 min |
| **Phones / relay** — `hub-buzzer.js`, `buzzer-relay.js`, `join.html` | add `,buzzers,phonemodes,teamvote,phoneteams,degradation,reconnect,playground,bench` | +6 min |
| **Before a lesson you will actually teach from**, or on request | the full suite | ~25 min |

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=millionaire,fit,phone   # the usual
NODE_PATH=$(npm root -g) node tools/smoke-test.js                                # 51 suites
```

The suite drives the games in a real browser and checks what has actually broken
before: boards running off screen, text cut off, the flip landing on the wrong tile,
settings not persisting, buzzers not degrading when the relay is gone. It starts its
own relay and exits non-zero on any failure. `--url=` tests a deployed copy instead.

**The one check that always runs, because it costs 2 seconds:**
```bash
node tools/check-syntax.js          # JS parses, CSS comments/braces balance
```
A malformed CSS comment **silently deletes every rule after it** — the parser skips to
the next `*/` and there is no error anywhere. That cost a debugging round on the team
bar: the header behaved as though the rule had never been written. CSS has no compiler
to catch this, so this stands in for one. It is the one break the user's eyes would
not catch either, because the page looks merely plain rather than broken.

**Push straight to `main`.** Render redeploys in ~40s and GitHub Pages follows, so the
phone can check it immediately. Bump the cache stamp or the phone will not see it.

**Do not pipe it through `tail` in a way that swallows the exit code** — `node … | tail`
reports the *pipe's* status, so a red run looks green. Redirect to a file instead; you
also get progress while it runs, which `tail` denies you for 15 minutes.

**When a shared behaviour changes, grep for the assumption before re-running.** Three
separate helpers in the suite compared `#m-question`'s text against the raw prompt, and
`Kit.prompt` rendering `___` as a blank broke all three. They were found one at a time
across three full runs, because each was treated as a one-off. The lesson is *search
for the duplicate*, not *run everything* — three full runs did not find them any faster
than one grep would have. Better still, give the fact **one home** so it cannot be
duplicated: that is what `Kit.floorTop()` is, after the same thing happened again with
the bottom of the board written down in four places.

## Verifying UI changes
**Normally the user does this** — see the section above. What follows applies when a
check has been agreed, or when something is being debugged.

Playwright + Chromium are available (global `playwright`, browser at
`/opt/pw-browsers`). Open a hub via `file://…` and exercise it.

**Screenshot it, don't only measure it.** Numbers said Millionaire's ladder cleared the
options by 22px; the screenshot showed `100` stranded alone on a second row reading
`200…2000` then `100`. Both facts were true — the assertion was answering a question
nobody had asked. A layout change is not verified until it has been looked at, at the
size it broke.

**Prove a new layout test fails on the bug it was written for**, by reverting the fix and
re-running. Twice this session a test passed on the broken build: once measuring a
container instead of the elements overflowing it, once because a different change had
already freed enough room. The second case also showed a "fix" that did nothing —
`floor:true` never fired until a 360×560 viewport was added, and only then earned
its place.

What the agent can and cannot check: stills, layout and text, yes. **Motion is not
visible to it** — animation is inferred from computed styles and timings, never watched.
**Audio is entirely unverifiable**; every `Sound.*` claim in this file rests on the code
being correct, not on anyone having heard it.
