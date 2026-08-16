# Engishism — ESL Classroom Presentation App

Web-based games for ESL teachers to present English lessons on a classroom TV.
Pure HTML/CSS/vanilla JS, **no build step**, fully offline-capable, deployed to
GitHub Pages. Teacher-driven and class-facing — students don't touch the device.

- **Live:** https://raganther.github.io/engishism/
- **Repo:** public (GitHub Pages serves from `main`) — pushing to `main` deploys.

## How this file works — memory, not history
This `CLAUDE.md` is loaded automatically at the start of every session, so it is the
project's **memory**: what is true now, and the rules a change has to obey. The repo is
re-cloned fresh each session (the workspace is ephemeral), so **anything worth keeping
must be committed and pushed.**

**Four homes, and putting things in the wrong one is what made this file unreadable.**
It reached 6,700 lines in August 2026 — 5,000 of them a changelog going back to the
first reskin — because every lesson from every fix landed here.

| What you have | Where it goes |
|---|---|
| A rule that constrains today's work, a trap that can still be walked into, the state of a thing as it stands | **this file** |
| A procedure — the checklist for doing a kind of job | a skill in `.claude/skills/` |
| What happened and the evidence: a fixed bug, suite counts, the three wrong diagnoses before the right one | `docs/log.md` |
| What a real class did | `docs/feedback.md` |

**The test for a line in this file: would a session tomorrow act differently for having
read it?** If not it is history, and history goes in `docs/log.md`, which is never
loaded. **Current status is capped** at what shipped in the last session or two plus
what is live and unproven; when it overflows, the oldest entries are distilled to one
line or moved to the log. A memory that is mostly changelog gets skimmed — and the
rules get skimmed with it, which is the same failure as a hook that fires every time.

At the end of a work session, update **Current status** / **Next** below, append the
detail to `docs/log.md`, and commit.

**Where is the work, actually — ask GitHub, never the local ref.** The workspace is
re-cloned every session and a clone is a *photograph*: `origin/main` in it is
whatever the remote said when the snapshot was taken, and it never updates on its
own. A session opened from a stale snapshot read its own `origin/main`, found an old
commit, and reported a whole day of shipped work as missing and a fixed-and-deployed
bug as still live. Nothing was wrong with the repository — it was describing a
photograph as the view out of the window, confidently, about the one thing a teacher
acts on. **`tools/where-are-we.js` runs at session start and settles it**, and the
rule behind it is worth keeping even when the hook is not there: to say what is
deployed, `git ls-remote origin refs/heads/main` or a fresh `git fetch`. `git log
origin/main` on a fresh clone answers a question about yesterday.

**Six hooks, and each exists because a thing that is nobody's job does not
happen.** `tools/shelf.js` fires before any edit to shared code and says what is
already on the shelf *and what has been written three times*; `tools/memory-check.js`
fires before a `git commit` and, **only when this file is not in it**, names what is
being committed and asks whether it is a memory event; `tools/suite-check.js` fires
before a smoke run and, **only when that run is long**, says how many minutes it will
cost and what would justify it; `tools/where-are-we.js` runs at session start and
says where `origin/main` really is, asked of GitHub rather than of the clone; and
`tools/which-skill.js` fires before an edit — through the edit tools **or through
Bash**, since most surgery here is `sed -i` and heredocs — and names the skill that
covers that file, or says **no skill covers it**, which is the case to tell the user
about before starting; and `tools/skill-check.js` closes that loop at the other end,
firing on a `git commit` that changed a skill's territory and asking **once per skill
per session, and never when that skill is already in the commit**, whether the
checklist actually held — it also runs `check-syntax`, because "the check that always
runs" was a convention and conventions lose. None of them blocks. The silence is the
design: a
reminder that fires every time is one you stop reading, so each can speak only in the
case it was written for.

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
**Read this before designing anything.** It is the agreed direction, written up in full
as `docs/game-hub-requirements.md` §3.8–§3.10.

**This is a classroom session container, not a quiz engine.** What it provides is teams,
scores, turns, a projected surface, a timer, and thirty handsets that can each be put
into a *different* state. A game show is one thing you can do with that. Everything
built so far is question-shaped and nothing in the container requires it to be — see
"What the container makes possible" below.

```
GAME HUB      the container: units, teams, scores, timer, settings, phone room
GAME SHOW     a skin with question slots. Owns geometry, scoring, turns
ROUND         a question that is played: card + phone dynamic + judging
CONTENT       filed by topic; items declare which rounds they can serve
```

**A game show is a skin.** Jeopardy's tiles, Blockbusters' honeycomb, Millionaire's
ladder — those are context, geometry and scoring around a **question slot**. What goes
in the slot is a round, called by name.

**A round is four things at once**, which is why it is a tier and not a helper: the card
the projector draws, what the handsets are put into, how several students' taps become
one team answer, and whether that answer is right.

**The question bench is the workshop, not a layer.** Rounds are built on
`playground/question-bench.html` because a phone dynamic cannot be judged from the phone
— what it produces lands on the card. Game shows call the **registry**, never the bench.

**Every question in the app is a round.** An ordinary question — a gap fill, a
definition, a word transformation — is handled by `game-hub/rounds/default.js`, whose
four modes are the old `phoneMode` values. Its setting is `round_default`, built by the
same loop that builds `round_grouping` from a round's own `modes`; a round may declare a
`modeSetting` saying how its row should be registered, and saying nothing gets the
shaped-round wording.
- **What the default round does not own.** It declares no `field` and no `claims`, so
  `Kit.round.of(item)` still returns null for an ordinary question. Deliberate and
  load-bearing — the content-screen chip, the clue path and the content gate all read
  `of()`, and a default round that claimed every item would push every gap fill through
  a `render()` that does not exist. **The card for an ordinary question belongs to
  `Kit.prompt`.** What this round owns is the room.
- **`Kit.round.authored()` is the rounds you can write a question for** — everything
  except those declaring `internal: true`. `ids()` is still every round, which is what
  the settings loop wants; the workshops want the narrower list.
- **Still open (F3.8.17):** `typeCooldown`, `typeStrict` and `phoneOneEach` are
  registered globally rather than as the default round's own tuning. A tidy-up.
- **Not transitional, because "remove the phone settings" reads wider than it is:**
  `buzzers` and `buzzerRelay` are hub infrastructure (whether a room exists, and where —
  no round can own that), `bbTeamVote` is Blockbusters' skin asking which *hexagon*, and
  `mLifelines` and `bingoCards` belong to their skins.

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

### Build order — what is left
Six of the eight steps are done: Blockbusters as a second host, round content in a
class-facing unit, the default round, Millionaire hosting Multiple Choice, `ctx.keep`
(round state that outlives one question), and the declarative action strip. Both
contract additions that were open are built — `ctx.keep`, and a round handed a `mount`
other than the card. `docs/log.md` has each one, and why the ordering changed twice.

7. **Bingo extracted onto the bingo round**, then **Race extracted.** Working games with
   a lot of tested behaviour, last on purpose: there is nothing left to learn from
   extracting them that a third host would not teach more cheaply. Race needs more than
   a mount — its answers *are* the board, not a panel on it.
8. ~~**Content filing** — the tagged pool and the query (§3.11).~~ **Decided against,
   for now.** Asked for and withdrawn in the same conversation once the shape was clear:
   it is a different product from §1.2, it migrates 565 items, and nothing here has met
   a class. **Content stays in per-game banks inside a unit file.** What was wanted from
   it — that new content reuses the established question shapes so the phones behave
   identically every time — is the `author-content` skill instead, a fraction of the
   work for the actual requirement. The pool reasoning is kept in §3.11 because it will
   come back.

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

**It drifted three ways at once**, because a category name is a hand-typed string in a
content file and nothing stops a second name for a round that already has one — the same
defect class as every hand-kept list here, one tier down.

**Two names that are deliberately not the id.** `anagram` is a round **and** a question
form, and the bench had to namespace them (`r:anagram` / `f:anagram`) after the round
silently shadowed the form. Calling the round *Drag the Letters* in every interface keeps
the two apart where a teacher can see them, while the id stays `anagram` for the code.
`scramble` is the same story against the `word order` form.

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
   and the worst to run on paper. **Built**, and the step turned out to be fifteen
   relay lines.

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

**Four of those six need state that outlives a question**, which is why `ctx.keep` was
built before any of them. And the test worth running is Just a Minute: if a format with
*no questions in it* works in this container, "Game Hub" is the wrong name for what has
been built.

### Where this ends up — a tagged pool and a query (§3.11)
**Agreed direction, nothing built, and build-order item 8 defers it.** Today a teacher
picks a unit, then a game, then sections. The target is: pick a **skin**, pick **what to
practise** — present perfect, crime vocabulary, chapter 6 — and the skin fills itself
from a tagged pool.

**The one decision that changes the data model: two tag axes, and only one is
authored.** What an item is *about* (present perfect, §5B, C1) is authored — a human
knows it. What *shape* it is (one word? four options? a scale of five?) is **derived
from the item's own fields**, never labelled on it. `Kit.round.of()` and `hasBank()`
already work this way. Hand-labelling `games:[…]` onto an item is the same
list-kept-in-step-by-hand defect this project has paid for four times. **Tag what a
human knows, derive what the data knows.**

**Three things that would be discovered late.** A tag query returns a *flat* set with no
notion of a rung, so either items carry an authored difficulty or Jeopardy and
Millionaire stop grading. **The gate inverts** — "no prompt in two banks" is exactly
wrong for a pool, where one item is queried many times, so it must be rewritten *in the
same change* as the migration and never switched off between the two models. And two
generated items about one word, worded differently, both land and a board can draw both;
nothing catches that today.

**The honest one:** this is a different product from §1.2, and the largest risk is
opportunity cost — a classroom run is what would say which of these were ever needed.

### A picture of the whole — brainstormed, nothing agreed (§3.12)
**Not a specification, and it carries no requirement IDs.** It exists because every
other section here describes a *mechanism* and none of them says what the thing is for
on a Thursday morning — so it is a yardstick to check small decisions against, not a
plan to build.

The sketch: a **run sheet** (a session is a sequence — warm-up, main game, speaking beat,
exit ticket — with teams and scores carried across, which the container already does and
nothing uses); the teacher **never types a query** but picks "what's next", "what we just
did", "what went wrong"; the teacher's **phone is the remote**, because the app assumes
you are at the laptop and in Race you are explicitly not; and a **diagnostic** that
remembers what the class got wrong and feeds it back into the query.

**The diagnostic is a scope decision, not a feature** — §1.3 puts data persistence out of
scope, and this would be the first thing holding data about *named students*. The narrow
version dodges nearly all of it: **store what was missed, not who missed it.**

**What any of them could quietly break:** it still works with **no relay and no
internet** (F3.8.6); setup stays **under 30 seconds** (§1.4.4 — and a run sheet, a query
and a review queue are all *more* screens before a game starts, so each must remove setup
rather than add configuration); and **the teacher decides** — suggest Monday's warm-up,
never build it silently.

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

**No prompt may appear in two banks.** Same *answer* in several games is the design
working (spaced retrieval from different angles); same *prompt* is the thing per-game
authoring exists to avoid, and an audit once found 21 copy-pasted across 2–4 banks. Each
game keeps the shape it suits — transformations in Jeopardy's "Change the Word",
definitions in Blockbusters, gapped sentences in Race, four-option discriminations in
Millionaire. This is **enforced**, not a convention:
```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=content
```
`testContentIntegrity` runs over every unit in `window.UNITS`, so a new unit is
checked for free. It catches the things no engine test can: a duplicated prompt, a
Blockbusters answer whose initial doesn't match its hexagon, two Race items competing
for one tile, a Millionaire rung with no question behind it, and section labels whose
counts have drifted from the bank. **It found eight real defects in Unit 4 the day it
was written** — including a hexagon showing `U` whose answer was *Irresistible*.

Two things learned filling the last gaps:
- **The writing lesson is as gameable as any other section**, once you stop treating it
  as "an essay". The linkers are vocabulary (and make excellent Race tiles, like the
  relative pronouns), and the paragraph functions are a fixed, testable structure. 5D
  was skipped for months on the assumption it wouldn't fit; that was wrong.
- **A ladder needs two questions per rung, not one.** Millionaire's ladder is *per
  team*, so with one question per rung both teams meet the identical question on the
  way up.

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
smoke test pinning that. A setting that declares `byRoster:true` also keeps a second
value for rooms of individuals under `…!solo` — a change made while a solo room is up
writes that key and touches nothing a team room reads, and individuals follow the
team-room value until explicitly set apart. Every `round_<id>` row declares it.

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
**A skill declares the files it covers, and a hook names it before you edit them.**
`covers:` in each skill's own frontmatter is the territory it claims, so a skill
written next month is picked up with nothing else edited — the same move
`question-types.js` makes for rounds. `tools/which-skill.js` reads those
declarations before any Write or Edit — **and before a Bash command that writes to
a project file**, because the large majority of editing here is `sed -i` and
`python3` heredocs, and a hook watching only the two edit tools was silent for
nearly a whole session's changes. Best-effort on the Bash side by nature: a shell
command is not a structured edit. It says which procedure applies, once per skill
per session; when **nothing** covers the file it says so instead, once per
file, because a change with no written procedure is one the user asked to hear
about before it starts.

**A skill cannot correct itself, and only one thing guards it.** Nothing reads a skill
but a model, so a stale one is *confidently wrong* rather than obviously broken — the
recorded case is `phoneMode` becoming `round_default` one morning and three skills
still naming it that afternoon, `phone-debug` worst of all because it hands you that
setting as the **first** thing to run when phones misbehave. So `check-syntax` fails on
a skill naming a symbol that appears **nowhere in the source**: a backticked word absent
from ~30k lines is a dead symbol, not English. Run over the ten skills the day it was
written it found two and nothing false. **It catches a rename, never wrong advice** —
that half is still a person noticing. And its blind spot is that a historical comment
naming a renamed symbol masks it, which is why it skips its own file: the paragraph
explaining it names two dead symbols as examples and it passed itself on the first run.

`check-syntax` also asserts every literal path in a `covers:`
list still exists — a renamed file would otherwise leave a skill silently covering
nothing, and silence there is indistinguishable from "no procedure needed".

**Quote the globs.** A bare `*.html` in YAML is an *alias reference*, not a string:
it broke `ship-it`'s frontmatter the moment it was written, the description vanished
and the loader fell back to the file's first heading.

**They are named, not enforced — and that is deliberate.** The hook puts the right
checklist in front of you; it does not refuse the edit. Every hook here informs
rather than blocks, and this one is no different. What it removes is the excuse:
a whole session was spent tuning rounds and deploying without opening `tune-round`
or `ship-it`, and `ship-it` opens by saying the default is no test suite — which is
exactly the rule that session spent two and a half hours breaking.

`.claude/skills/` holds ten invocable checklists. This file is the project's
*memory*; those are its *procedures*, pulled up at the moment they are needed rather
than remembered from 2,500 lines. **Which one you want follows the tiers**: a skin is
`new-game`, a question that is played is `new-round`, a way of drawing a prompt is
`new-question-form`, a bundle of switches is `new-mode`, something every game inherits
is `shared-surface` — and **writing questions in the shapes that already exist is
`author-content`**, which is the one that gets used most, because the machinery is
finished and the content is the bottleneck.

**Six of the ten are "make a new thing"; `tune-round`, `shared-surface` and `harness`
are for changing things that already exist**, which is what most sessions actually do.
Every
parameter added to a round so far — `crowdReveal`, `crowdMeter`, `roundOpenToAll`, the
roster fork — is the same three-step move (register → lend on `ctx` → read in the
round), and it had no written home until that skill existed.

**`shared-surface` closed the largest hole, and the hook is what found it.** Asked
which skill covered the phone-strip commentator, the hook answered **"no skill covers
`game-hub/hub-engine.js`"** — the file holding every shared surface in the app, the one
where a mistake breaks five boards at once. `hub.css` was worse than uncovered: it was
declared by `ship-it`, so writing CSS handed you the *deploy* checklist. Three other
changes that same session were layer 1 and had no procedure either (the roster-drop
guard, addressing a verdict at the replier rather than the roster index, and what the
reveal bar counts). It is off `ship-it`'s `covers:` now, which stays the shells.
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
- **`tune-round`** — the tier above a bug fix and below a new round: adding a
  parameter, a threshold, a cooldown or a switch to something that already works.
  The three steps, the four decisions (which tier owns it · should it fork by room
  type · is it `quick` · what does *absent* mean), and the traps this project has
  actually paid for — the stuck default, a phone-side setting landing on the *next*
  question because an arm wipes every handset, and `p.team` not being the truth in a
  room of individuals. Carries the second-caller rule for extracting to the shelf.
- **`shared-surface`** — the tier above both of those: something *every* game inherits,
  which is `hub-engine.js` outside one game's block and `hub.css`. Opens with the swap
  test (who is still correct if you replace the tier below?) and the two directions a
  layer-1 change points — a **service** every game calls, including games not written
  yet, versus a **hook** every game may now have to answer. Then declare-never-list with
  the five it has cost, the contract each shared surface owes (the strip's fixed height,
  anything appearing above a board owing it a re-fit, a component never assuming its
  host's background, one home per layout fact), the four ways a CSS rule silently loses,
  and the fact that **this is the one tier where the blast radius earns a suite** — and
  still not the full one.
- **`harness`** — what watches the project rather than being part of it: the smoke
  suite, `check-syntax`, the hooks, the derived inventory tools. Opens by saying the
  two things here fail in opposite directions — **a check lies** when it goes stale and
  describes a picture that was deliberately replaced, **a hook goes unread** when it
  fires on everything. Then: prove a check by reverting it, the six suites that went
  stale on a content conversion and why the Lab board is their home, the thirty-second
  abort that takes a whole suite, polling instead of guessing a number, `git worktree`
  for proving a red is somebody else's, and the four traps a hook has paid for — match
  anywhere, a mention is not an invocation, derive never list, prove by sentinel.
- **`ship-it`** — the deploy seam. **Opens by saying the default is *no* test suite**,
  because the user is watching the real site and their eyes beat four minutes of robot;
  it names the three cases that stop and ask instead. Then the stamp (and why the date
  shape in the pattern is load-bearing), the stale-shell tells before anybody debugs a
  "it didn't deploy", which suite matches what changed, the `| tail` exit-code trap, the
  one red check that is not yours, and the merge.
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

**The question bench is the forms workshop too** — `prompt-lab.html` is retired. One
menu, three groups (rounds · forms in the kit · forms lab only), listing whatever
`Kit.prompt` holds (`types()` + `info(type)`, never a hand-kept list, so a form
registered later appears for free), drawn at board size against the hub's own
stylesheet, revealed, and reporting which of the three outcomes happened — drawn,
*declined to plain text*, or no form at all. **Ask the room** puts the same question on
the handsets as an everyone-types round and judges with `Kit.answer.judge`, exactly as a
game would, so a form can be tried before a single bank item is authored for it. It
exists because otherwise a form can only be met by finding a bank item that happens to
carry its type, which is why three of them sat at 4% of the content. The `forms` suite
covers it.

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

Current pages: **`connections.html`** (find four groups of four; groups encode
collocations/phrasal verbs/spelling/register; solving one unlocks its mini-lesson;
`?p=N` pins a puzzle, tests use `?p=1`) and **`thermometer.html`** (order words along a
scale). Both play **two ways from the toolbar** — the first proof of the playground's
point, that one board can host several dynamics:
- **Turns** — the team on turn votes from their phones, the teacher locks in and
  submits; a wrong guess passes the turn; a shared pool of four mistakes.
- **Race** — no turn, every team at once, and **a team's own picks are its guess**, so
  the teacher never re-enters them. A team's selection is the **union** of its players'
  picks, which is what forces them to agree — six words up means dropping two. A wrong
  guess costs nothing but time, because the race itself is the pressure. **Everything a
  race removes the recovery path for goes with it** — the turn, the mistake budget,
  Reveal, and the clock, since expiry disarms every handset and a race has no teacher
  control left to recover with.

## Source material & specs
- `material/empower-c1-unit-4/`, `material/empower-c1-unit-5/` — Cambridge Empower
  C1 workbook page scans (indexed by page/section) the game content is authored from.
- `docs/feedback.md` — **the classroom & test log, one entry per real run.** The raw
  record. When the user reports a run in chat, append the entry there *first* (template
  at the top); a bug it turns up becomes a line in Current status while it is open, and
  the story of fixing it lands in `docs/log.md`. The runs are the only data no suite can
  produce — do not let them live only in chat.
- `docs/game-hub-requirements.md` — the MVP spec (per-game content model, game tier
  analysis, success criteria). The key open metric: realistic authoring time per unit.
- `docs/design-reference.md` — DCU International Academy brand (navy/sky-blue/yellow/cream).
- `docs/log.md` — **the work log: what happened and why, newest first.** Never loaded
  into a session. This file is the memory; that one is the history, and it holds the
  detail behind every line of Current status — the evidence, the suite counts, the wrong
  diagnoses. Read it when the question is *"why did we do it that way?"*.
- `.claude/*.md` — older experimental domain notes (product vision, lesson pipeline,
  activity schemas). Reference only; not required reading.

## Current status
**Build `20260815a`.** Three coursebooks (Empower C1 Units 4 and 5, New English File
Unit 1, English File 2A) and ~760 authored items; six games; nine rounds; ten skills;
six hooks. **`docs/log.md` is the entry-by-entry history** — how each of those was
built and what it cost. What follows is only the state.

**Live and never tested against a class.** Everything of the last two weeks changes how
a board *feels* rather than adding a feature to one, and none of it has met a room:
- **The open question.** A right answer no longer locks the room out; who got there and
  when is recorded (`Kit.round.results`) and a skin names one of four `PAY_RULES`. The
  standings screen replaced the winner banner after every question. Every number in it
  is a guess — the 60/30 podium shares, the 0.5 floor, and above all whether standings
  after *every* question is a good beat or an irritation.
- **The commit beat in solo.** Individuals press Send; a wrong Send costs 3s escalating
  to 9s, and the room sees who is cooling. 3s and the ramp are guesses, which is why all
  three settings are `quick`.
- **The crowd instruments.** The reveal at 40% of the room, the anonymous meter filling
  toward it, the phone nudge when one lands, and `crowdLive` (off by default) letting
  the bar follow what the room is *thinking* rather than what it has sent.
- **The one class that has run** (2026-08-12, ef-2a, team mode) was dominated by a
  Classic-ruleset accident, so none of the above got a clean read — `docs/feedback.md`.
  **The rerun is the lesson that counts:** ruleset Hub, drag rounds on `agree`, the
  score-report ledger cleared first.

**Known red, deliberately.** The ordering climb card is 726px on a 720 board with the
action strip on — a layout item, not a stale check. The last full run was **1343/11**:
nine were proved pre-existing in a worktree at that session's starting commit (aborts in
`strip` and `bbteams`, Blockbusters' four-team answer card, three `Topic picking`
counts, two game-card icons), one was a load flake in the morph animation under 68
suites of contention, one is the climb.

**Known and not fixed** — each of these is somebody's next job:
- **The clue card covers the phone strip.** On Jeopardy and Blockbusters the cooling
  countdown sits behind the card for exactly the seconds it describes. Pre-existing and
  true of every strip state, but the countdown is the first feature whose whole value is
  being read *during* a question. The precedent is `#buzzer-chip` at z-index 51 over the
  card's 50 — which would draw across the card's own topline, so it wants a decision
  rather than a reflex.
- **An index is not an identity.** Every round keys its per-team state by index.
  `dropDepartedSolo` standing down while `roundLive()` makes that *unable to bite*
  rather than right; keying by the competitor id every competitor already carries is the
  real answer, and it touches every round.
- **The relay's per-player declaration waits for its second caller.** Adding one
  per-player fact is seven hand edits in four places, and the easiest to miss is the
  join payload — which fails only for students whose wifi dropped. The reliability half
  is already taken (`check-syntax` compares the arm and join key sets), so what is left
  is maintainability. **The trigger is the next round that wants a new per-player fact**,
  not before — designing it now would shape an API from three callers for a fourth that
  does not exist.
- **The shell has no `Cache-Control` of its own**, so a stale shell can strand a browser
  on old assets with no error anywhere. See "Run" for the tells.

**Content.** NEF-1 is the one unit still carrying simple questions on Jeopardy and
Blockbusters. Unit 5's six ordering scales are plausible C1 English the unit never
teaches — an audit against `material/` is owed on all three units, and **no check can
catch it**, because sourcing is not form.

## Next
**The direction and its build order are at the top of this file.** This is what is
actually next, in order.

1. **Teach with it, and settle the guesses.** Nothing else here should be built until a
   class has met the open question and the standings — see Current status. Three things
   to watch, likeliest to be wrong first:
   - **Does a standings screen after every question drag?** `roundWinBanner` turns it
     off; the honest answer might be "only on Quickfire", or "only every few questions".
   - **Is the podium worth having, or does `equal` teach better?** The whole argument for
     holding a question open is that the room keeps working. If second place at 60% still
     feels like losing, `equal` is one tap away and is the real test of it.
   - **Does the extra press cost too much?** An open round needs Reveal then Close where
     a won round used to take itself. `roundOpenToAll` off puts the old race back.
2. **Convert NEF-1 to rounds, and audit the ordering scales against the scans.** The
   audit is the more important half.
3. **Judge Word Drop, then decide whether it gets a host.** Bench-only on purpose: no
   game show can run its fall clock, because `ctx.again()` is lent by the question bench
   and nothing else. Play it, judge the fall times (9s→4s, −700ms a word, all guesses).
   If it earns its place the host work is `again()` in `roundCtx` plus content; if not,
   delete it — a round nobody authors for never meets a class, so being wrong is free.
4. **Bingo the skin onto the bingo round, then Race extracted** — build-order item 7.
5. **A decision on the clue card covering the phone strip** — see Current status.

**Worth building for what they would prove**, rather than for what they are:
- **Word Spy** — every phone shows the same secret word except one, which shows a near
  neighbour (everyone "beach", the spy "swimming pool"); one sentence each, then the
  room votes on who the spy is. A deal plus a vote, both on the shelf, buildable since
  `promptByPlayer` shipped. Highest speaking-per-minute on the list and about a third of
  what Word Drop cost.
- **An Only Connect wall** — nearly free, because the grouping round already *is* the
  wall. The cheapest possible test of whether a new skin costs what Blockbusters did.
- **Just a Minute** — a format with no questions in it at all. If that works in this
  container, "Game Hub" is the wrong name for what has been built, and §1.2 of the spec
  needs rewriting rather than extending.

**Open questions only a classroom answers:**
- Whether thirty phones typing kills the pace in type-then-buzz, and whether the
  cooldown reads as a punishment or a pause.
- Whether the game-show music bed fights the teacher's voice on classroom speakers, and
  whether the title sequence is still welcome by the fourth round (once-per-session is a
  guess, not evidence).
- **A phone check on a real handset**, not Chromium emulation — real browser chrome
  changes the visible height as you scroll and nothing here models it. Jeopardy's
  sideways scroll is the part likeliest to feel wrong under a thumb.

**Known gaps, no urgency:**
- **More typed items, especially Millionaire's.** The newer question forms sit at 4.1%
  of the content, so a round can pass without meeting one, and Millionaire's per-rung
  filtering makes three items nearly invisible. Content, not code.
- **Jeopardy at 16 categories is legible, not comfortable** (10.5px headings at 1280px).
  Cap the categories per board or nudge the teacher toward fewer sections — not a CSS
  problem.
- Unit 4's race and millionaire banks (4A–4D); Unit 4's Jeopardy gap (only 4A/4B have
  categories); Unit 5's pronunciation, the p66 crime idioms, the reading texts.
- Self-host fonts for true offline — also what a chunkier display face for the
  game-show wordmarks would need. "Steal" in Blockbusters.
- **Race variations discussed and not built:** relay (one student per sentence), wager,
  class vs the clock, sweep rounds, and **director & toucher** — one student directs
  another by language alone, the highest speaking value of the lot and worth running
  verbally in one lesson before building anything.
- **Phone dynamics not tried:** a confidence wager in Jeopardy (1/2/3 before the clue
  turns over), an exit ticket on the end-of-round banner (one `onFinish` hook plus
  `write` mode, and it would reach every game), and personal scorecards.

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

**The rule, and it is a rule rather than a preference: run no test suite unless
the user asks for one.** Not "prefer not to" — don't. This was written as a default
and treated as a suggestion for weeks, and one day's work went: a full suite nobody
asked for (57 minutes), four twelve-suite passes (~80), and two runs started and then
voided by editing files underneath them (~30, pure waste). `tools/suite-check.js`
now says the number out loud before any long run, because a rule in prose loses to
"let me just be sure" and an hour on a clock does not.

**Three things that are banned outright**, all of which have cost real time: the
full suite unasked; starting a run and then continuing to edit; and anything over
five minutes without asking first.

**The one exception worth keeping** is a small hand-written drive for phone work at
class scale — sixteen handsets, three minutes. That is the only thing the user's own
eyes genuinely cannot do: the cap-at-eight bug was invisible below nine handsets and
perfect above none. Everything else — a board, a layout, one game's logic — they see
faster on a real phone than any of this measures.

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

**`pgrep -f <pattern>` matches the waiting shell itself**, because that process's own
command line contains the pattern — so `until ! pgrep -f smoke-test.js; do sleep 5; done`
never finishes, and reports a suite as still running ten minutes after it ended. Use
`ps -eo args | grep "[s]moke-test"` (the bracket stops the grep matching itself) or wait
on the task's own exit. The sibling of the `| tail` trap above: **the instrument was
wrong, not the thing being measured.**

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
