---
name: harness
description: Write or fix something that watches the project rather than being part of it — a smoke-test check, the syntax check, a Claude Code hook, or one of the derived inventory tools. Use this whenever a suite check goes red and may have gone stale rather than caught a bug, when a check needs adding for a behaviour that just changed, when a suite aborts or reports fewer checks than it holds, when a red needs proving pre-existing, or when adding or tuning anything under .claude/settings.json and tools/. Also use it when a test passes on a build you know is broken.
covers:
  - "tools/*.js"
---

# The harness — what watches the project

## Are you in the right skill?

| You want | Skill |
|---|---|
| The relay, `join.html` or `hub-buzzer.js` behaving oddly | `phone-debug` |
| `tools/buzzer-relay.js` — under `tools/`, but it is the app | `phone-debug` |
| To decide *whether* to run a suite at all, or to deploy | `ship-it` |
| A change to something all five games share | `shared-surface` |
| **To write or fix a check, a hook, or a derived inventory tool** | **this one** |

**Two kinds of thing live here and they fail in opposite directions.**

- **A check** asserts the app behaves. Its failure mode is **lying** — going stale and
  confidently describing a picture that was deliberately replaced. A green-looking
  partial run is how the next one gets through.
- **A hook or an inventory tool** informs the author. Its failure mode is **noise** —
  firing so often that it stops being read by the third day.

Everything below follows from those two sentences.

## 1. A check that cannot fail on its bug is not yet a check

**Prove it by reverting.** Keep the check, undo the fix, watch it go red. This is not a
nicety; checks have passed on the broken build repeatedly here:

- The sixteen-phone join check **joined phones one at a time**, and the bug only appears
  when they arrive together. It passed on the broken build and shipped. `Promise.all`
  made it fail by name.
- A phone layout check compared the ladder against `#m-options`, whose box had collapsed
  to 50px while its contents overflowed 259px past it — so it saw no collision and
  called an unreadable game fine.
- A two-phone team check had both phones on team 0, so a scrambled restore still landed
  them both on team 0 and the assertion passed. The second phone joins a different side
  now.

**Pin the fact, not the prose.** A settings check asserted a whole sentence and went red
the day the wording was deliberately improved — with a comment above the code explaining
why it had to change. Assert the marker and the game's name.

**Pin the rule, not timing that was traded away.** The bench asserted a handset's row
disappears *promptly*; the roster fix deliberately defers that until the question closes.
It is two checks now, one for each half of the rule — the row stays while the question is
open, and goes the moment the card is down. **Pinning the old timing pinned the bug.**

## 2. Content conversion is what makes a check stale here

Six suites have gone red for one reason: they drove a **plain clue** on a class-facing
unit that has since become all-rounds, so the buzzer, the claim chooser or the deduction
they waited for correctly never appears. `turns`, `competition`, `phonemodes`, `jclock`,
`classic` and `phoneteams` all made the same move.

**The Lab board is the documented home for behaviour that only exists on a plain clue.**
`game-hub-lab.html` runs the same engine and the same five games; its eight plain
categories are not class-facing, so they will not be converted out from under a test.
`openRoom` takes `{lab:true}`.

**Re-run the shared set after content work, not just the gate.** Two suites sat red for
several commits because the content gate was re-run and the shared set was not.

## 3. The abort — one throw takes the rest of the suite with it

`.innerText()` on a locator matching nothing **waits thirty seconds and then throws**,
and the throw happens while the argument to `check` is being built — so it takes every
remaining check in that suite. `phonemodes` was running **2 checks of 80** and printing
"2 passed, 2 failed" as though that were the whole of it.

- **`textOf()` is on the shelf.** `allInnerTexts()` resolves immediately with `[]`, so
  absence is one red check in milliseconds. Reach for it whenever a check asks *whether*
  something is drawn.
- **Clicking a button that is absent or disabled throws too.** This project has paid for
  that pattern four times — `strip`, `bbteams`, `phoneteams`, and a Race steal check that
  went red under load and then took its whole suite. Guard the click.
- The runner fails a suite **by name** and runs the rest now. **A red total is
  trustworthy; a green-looking partial is not — check which sections actually ran.**

## 4. Do not guess a number; ask for a condition

- **`until(fn)` rather than a sleep.** A tap has to reach the relay, come back and redraw
  the board, and any figure you pick is a coin toss on a loaded machine.
- **Do not tap whatever the shuffle put first.** Two checks passed or failed on the deal,
  because a right answer from the only phone on a team wins the question outright. Pick a
  *wrong* option on purpose.
- **Ask the registry, never a list.** `HubGames.ids()` for the stage to assert against,
  `Kit.round.get(id).sample` for the bench's opening question. A suite that breaks when
  you add a game is the opposite of what a suite is for — and a check holding its own
  copy of a sample drifted from the real one within a day.
- **Assert the precondition.** `openHex` counts the hexes rather than assuming 18, so if
  the bank outgrows the board the suite says so by name instead of failing three checks
  at random.

## 5. Load, isolation and the things Playwright does not model

- **A check that reads a *mid-flight* animation is inherently load-sensitive.** The morph
  card check sampled before it had started under 68 suites of contention; `variants` alone
  is 37/0 on the same build. Worth knowing before anybody chases it.
- **`browser.newPage()` gives every page its own storage.** Two tabs of *one* browser is
  the case that matters and the one the harness does not produce by default — the bench
  room-code bug could never have been caught without `browser.newContext()`.
- **`?auto=1` phones never store a seat** (every racked iframe shares one localStorage),
  so reloading one is a brand-new player and cannot model a reconnect at all. Join one
  through the real form for that.
- **Sixteen unasked phones saturate a plain-HTTP relay's six connections**, and replies
  silently stop arriving. That is why the benches open with an empty rack.
- **Chromium device emulation is not a thumb.** A drag is the one thing no check here has
  ever really tested.

## 6. Prove a red is pre-existing rather than assuming it

```bash
git worktree add /tmp/base <sha-at-session-start>
```

No stashing, leaves the working tree alone, about a minute. Nine of eleven reds in one
sitting were cleared this way — identical failures, identical detail strings.

## 7. Writing a hook

**Every hook here informs; none of them blocks.** A hook that refused an edit would be
the first thing in this project to stop work rather than inform it.

**Silence is the design, and it is the whole design.** Each hook can speak *only* in the
case it was written for, because a reminder that fires every time is one you stop
reading: `memory-check` only when `CLAUDE.md` is **not** in the commit, `suite-check`
only when the run is long, `which-skill` once per skill per session.

Four traps, each paid for:

- **Match anywhere in the command, not as a prefix.** This project commits with
  `git add -A && git commit …`, so a `Bash(git commit*)` filter would never have fired.
- **A mention is not an invocation.** `git log -- tools/smoke-test.js` tripped
  `suite-check`, and a commit message carrying a path and a `>` tripped `which-skill`.
  Guard on the thing actually being *run*, not on its name appearing.
- **Derive, never list.** `which-skill` was printing a hand-typed "the eight in
  `.claude/skills/`" — the defect it exists to prevent, in its own output.
- **A hook that shells out must pipe both streams.** `check-syntax` reports its problems
  on **stderr**, and the first version of `skill-check` piped stdout and ignored stderr —
  so a failing tree produced an empty note and the guard silently never fired. There is
  no way to see that by reading it.
- **Prove it by sentinel.** Prefix the command with a marker, make a real tool call, read
  the file, strip the marker. Piping JSON in by hand proves the branches; only a live
  call proves it is wired. **Strip the marker with an editor, not with
  `open(p,'w').write(open(p).read()…)`** — `'w'` truncates before the inner read runs,
  which emptied a 201-line skill in this very session. `git checkout HEAD -- <file>` is
  the way back.

## 8. `check-syntax` is the one that always runs

Two seconds, on every change, no exceptions. It stands in for the compiler CSS does not
have — **a malformed comment silently deletes every rule up to the next `*/`**, with no
error anywhere, and the page merely looks plain rather than broken.

What it does beyond parsing, and why each was added:

- **It walks directories rather than carrying a list.** Its hand-typed file list had been
  wrong for as long as the rounds existed, so the one check that always runs was skipping
  the files most edited.
- **It asserts both directions.** `dev.html`'s skill links against `.claude/skills/`; the
  relay's `armed` payload keys against the `joined` payload keys; every literal path in a
  `covers:` list against the filesystem. A one-directional assertion lets a renamed file
  leave a skill silently covering nothing.
- **It is the only thing that can catch a skill going stale.** A skill naming a symbol
  that appears nowhere in the source fails the check — a backticked word absent from
  ~30k lines is a dead symbol rather than English. This is the closest thing to a skill
  correcting itself, and it is not close: it catches a **rename**, never wrong advice.
- **Its blind spots are stated rather than assumed.** The payload parity check compares
  two hand-typed key lists, so it catches a field present in *one* and cannot catch one
  missing from **both** — `preview` reached the relay and never reached a phone. The
  symbol check asks whether a string appears *anywhere*, so a historical comment naming
  a renamed symbol masks it; the check skips its own file, because the paragraph
  explaining it names two dead symbols as examples and it passed itself on the first run.

## 9. Running it, and reporting it honestly

Read `ship-it` first for whether to run anything at all. When you do:

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=… > /tmp/run.txt
```

- **Never pipe through `tail`** — that reports the *pipe's* exit code, so a red run looks
  green. Redirect to a file; you also get progress while it runs.
- **`; echo "exit: $?"` after the runner reports the echo's status**, not node's. Read the
  printed total.
- **`pgrep -f smoke-test.js` matches the waiting shell itself**, so an `until ! pgrep`
  loop never finishes. Use `ps -eo args | grep "[s]moke-test"`.
- **Do not edit files while a run is going.** It voids the run and costs it twice; that
  has already happened for about thirty minutes in one day.
- **When a shared behaviour changes, grep for the assumption before re-running.** Three
  helpers compared a rendered prompt against the raw string and all three broke together;
  they were found one at a time across three full runs, which one grep would have done.

Then `node tools/check-syntax.js`, and update `CLAUDE.md` if a check taught you something
— a stale check is a decision the memory did not record.
