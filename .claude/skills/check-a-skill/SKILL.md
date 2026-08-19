---
name: check-a-skill
description: Test whether one of this project's own skills actually gives good advice, by replaying a real past bug against it. Use this when a skill is suspected of being stale or wrong, when a bug fix suggests the checklist that covered it should have caught it, when writing or editing a skill, and when asked to audit or review the procedures. Also use it before trusting a long skill nobody has followed end to end.
covers:
  - ".claude/skills/*/SKILL.md"
---

# Checking a skill

A skill fails in two ways and only one of them is mechanical.

**Stale** is a skill naming something the code no longer has. That half is solved and
automatic — the symbol assertion in the syntax check greps every backticked token
against the whole source, the covers assertion checks every literal path still exists,
and the dev-page assertion checks the links both ways. Run it and believe it.

**Wrong** is a skill whose every word is true and which never asks a question it should
ask. Nothing can find that. It is confidently wrong rather than obviously broken, it
blesses the mistake each time it is followed, and the reader has no reason to doubt it.
Everything below is for that half.

## The rehearsal — prove it by reverting

The project already demands this of a check: *a check that cannot fail on its bug is
not yet a check*. A skill is a check on a person, so it gets the same treatment.

1. **Pick a bug in the skill's own territory.** Derive the list rather than hunting —
   match each commit's files against the `covers:` globs, which is the matching the
   commit hook already does. Prefer one with a symptom a teacher reported, because that
   is the input a real reader gets.
2. **Fairness grep, before anything else.** If the skill already holds the lesson, the
   rehearsal proves nothing and will read as a pass. Grep the skill for the words of the
   fix. Grep the memory too — it is injected into every reader and cannot be withheld.
   A leak there makes the run easy in a way the result will not show.
3. **Freeze the tree at the commit before the fix.** A worktree, detached, outside the
   project. Copy the skill's own file in beside it, so today's wording is what is being
   tested rather than the wording of that day.
4. **Hand a fresh reader two things and nothing else** — the symptom in the teacher's
   own words, and the skill. Forbid the history explicitly, and say that a negative
   result is more valuable than a positive one, or the report comes back flattering.
5. **Verify the claims before believing them.** The reader is doing the job the skill
   failed at; its diagnosis is a lead, not a finding. Read the lines it cites.

## Three traps, each already paid for

- **The memory leaks into every reader and you cannot stop it.** It is loaded as project
  instructions, so "do not read it" is not enforceable. It has pulled a reader away from
  the answer once and could as easily pull one toward it. Check what it says about the
  bug at step 2 and state the leak in the result rather than pretending isolation.
- **Check the lesson against the live tree before writing it down.** Both bugs in the
  first two rehearsals were long fixed, and one of the two general rules would have
  described a fault that no longer exists. A skill states what is true now; a rule
  written from a frozen tree can be false the day it is added.
- **A reader that finds the right line can still walk away from it.** Watch for the
  moment a diagnosis is abandoned rather than only for the conclusion — that moment is
  the missing step, and it is what the new line has to address.
- **A fix lands where the code changed, which is not the same as whose job it was.**
  Matching commits to `covers:` finds candidates, not cases: a phone bug is repaired in
  the engine and looks like the engine's, and the reader then correctly leaves for the
  skill that owns phones — a routing table working, not a checklist tested. **Read the
  symptom and ask which skill a person would open**, and if the answer is a different
  one, the case is void. Throw it out before spending the run rather than scoring it.

## What the result means

The same four answers the commit hook asks for, and **the first is the usual one**:

- it would have caught this → **change nothing**
- it missed it and the lesson is general → **the skill gains a rule**
- it missed it and the lesson is a fact about the project → **the memory, not the skill**
- it told the reader to do the thing that caused the bug → **fix the skill, and say so**

**One test decides whether a lesson belongs on the page: does it name a file, a line or
a number? Then it does not go on.** The fix itself is dead information — the line moves,
the number changes, and it only ever helped once. What goes on is the question that
would have been asked about code nobody has seen yet. The bound was eight and should
have been sixty; what is worth writing is *check a bound against the roster and check
what the fall-through asserts*.

**And a skill is not a changelog.** If every bug appends a rule it is eight hundred
lines nobody reads within a month, which is the rot this exists to prevent. Adding is
the rare outcome.

## Which skills are worth rehearsing

**Derived, not listed** — bug density and blast radius, both of which the history knows.
Match commits to `covers:` globs and count. High counts on shared code earn a run;
a page that barely touches code has little to get wrong.

**The limit worth stating: a skill whose files have never carried a bug cannot be
rehearsed at all.** There is nothing to replay. That is not a pass — it is no result,
and saying so is the honest report. But confirm it against the real history before
believing it, and **count fixes, not commits**: a territory can be nothing but
extraction commits that *moved* code into its files — no lesson to replay in any of
them — while one genuine fix hides among them, and that one is the case. The clone is
shallow, so `git fetch --unshallow` first; a page declared bug-free off the photograph
in a fresh clone is a page nobody looked past.

## Before you finish

The syntax check, always — a new skill must be linked from the dev page and every
backticked token must exist, and both fail by name. Then the same restraint as
everywhere: one sentence added is a good outcome, and none is a better one than a
paragraph nobody will read.
