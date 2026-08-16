#!/usr/bin/env node
/* Is this test run worth the wall clock?
   =====================================

   A `PreToolUse` hook on Bash. It says nothing at all unless a *long* smoke run is
   about to start, and then it says how long, and asks whether this change is one of
   the three kinds that earn it.

   **Why this exists.** `CLAUDE.md` has said since it was written that the default is
   no test suite — the user is watching the real site on a real phone, and their eyes
   beat four minutes of robot. It was ignored anyway, session after session, until a
   day's work was mostly waiting: one full suite unasked (57 minutes), four twelve-
   suite passes (~80), and two runs started and then invalidated by editing files
   underneath them (~30, pure waste). A rule in prose loses to the pull of "let me
   just be sure"; a number in front of you at the moment you reach for it does not.

   **Why on Bash and not on Edit.** The temptation does not arrive while the code is
   being written, it arrives when the change is finished — so this fires where the
   decision is actually made, exactly as `memory-check.js` fires on `git commit`
   rather than on the edits that led to it. A reminder attached to every edit would
   be one nobody reads by the third day, which this project has written down twice.

   **Silence is the design, again.** A short run is cheap and often right, so this
   is incapable of firing on one. It only speaks for the runs that cost real time,
   which is the only case where the question is worth asking. It never blocks. */
'use strict';

/* Measured on this machine, not extrapolated — and the difference matters. A named
   set costs about 105s a suite (eleven suites came in at 20 minutes, which this
   predicts as 19). The *full* run does not scale that way: most of its 68 suites are
   tiny, so it lands at 57 minutes rather than the two hours a flat rate implies.
   A first version quoted 119 and would have talked me out of a run that was half
   that — an estimate wrong in the cautious direction is still wrong. */
const SECONDS_PER_SUITE = 105;
const FULL_SUITE_MINS   = 57;
/* Three suites is about five minutes, which is the line CLAUDE.md draws for asking
   first. At or under it, this stays quiet. */
const QUIET_AT_OR_UNDER = 3;

let buf = '';
process.stdin.on('data', d => buf += d);
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = (JSON.parse(buf || '{}').tool_input || {}).command || ''; } catch (e) {}

  /* Only a smoke run, and only one actually being *run*. Matched anywhere in the
     command rather than as a prefix, because the way this project runs it is
     `NODE_PATH=$(npm root -g) node tools/…` — but `node` has to be in front of it,
     or `git log -- tools/smoke-test.js` announces an hour of testing that nobody
     asked for. A mention is not an invocation, which is the same thing
     `which-skill.js` had to learn about commit messages. */
  if (!/\bnode\b[^|;&]*smoke-test\.js/.test(cmd)) return process.exit(0);
  /* Testing a deployed copy is a different job and usually deliberate. */
  if (/--url=/.test(cmd)) return process.exit(0);

  const only = (cmd.match(/--only=([^\s'"]+)/) || [])[1] || '';
  const named = only ? only.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (named.length && named.length <= QUIET_AT_OR_UNDER) return process.exit(0);

  const mins = named.length
    ? Math.max(1, Math.round(named.length * SECONDS_PER_SUITE / 60))
    : FULL_SUITE_MINS;
  const what = named.length ? (named.length + ' suites: ' + named.join(', '))
                            : 'THE FULL SUITE — every suite there is';

  const note = [
    'About to run ' + what + '.',
    'That is roughly ' + mins + ' minutes of waiting.',
    '',
    'CLAUDE.md: **the default is no test suite.** The user is watching the real site',
    'on a real phone and their eyes are faster than this. Small changes taking a long',
    'time is the thing that rule exists to fix.',
    '',
    'Run it anyway only if one of these is true — and if it is, say which:',
    '  · the user asked for a test run',
    '  · this is a big refactor or a change to something all five games share',
    '  · it is the phone or relay layer, which the user cannot check from one device',
    '',
    'Otherwise: check-syntax (2 seconds), bump the stamp, push, and tell the user',
    'plainly what went untested. That is the loop this project is built around.',
    '',
    'Two ways this has wasted time before, both avoidable:',
    '  · the full suite, run unasked — it costs the best part of an hour',
    '  · starting a run and then editing files, which voids it and costs it twice',
    '',
    'A short targeted run is not what this is about; it stays quiet under four suites.'
  ].join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: note }
  }));
});
