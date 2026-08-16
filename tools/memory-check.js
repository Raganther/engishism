#!/usr/bin/env node
/* Is the project's memory being kept up to date?
   =============================================

   `CLAUDE.md` is this project's memory: it is re-read at the start of every session
   and the workspace is thrown away, so **a decision that is not written there did not
   happen**. The failure mode is not dramatic — nothing breaks, the commit lands, and
   three sessions later somebody re-derives a thing that was already settled, or
   re-introduces a bug whose reasoning was in somebody's head.

   So this runs as a `PreToolUse` hook on Bash, notices a `git commit`, and hands back
   a note naming what is about to be committed.

   **It stays silent when `CLAUDE.md` is already staged**, which is the whole design.
   A reminder that fires on every commit is one you stop reading by the third day —
   the same lesson as the duplication report in `shelf.js`, and as every "are you
   sure?" anybody has ever clicked through. This one can only fire when the memory
   genuinely has not been touched, so it is always at least a fair question.

   It never blocks. It has no idea whether the change is worth recording; only the
   person writing it does. */
'use strict';
const { execFileSync } = require('child_process');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = args => {
  try {
    return execFileSync('git', ['-C', ROOT].concat(args), {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) { return []; }
};

let buf = '';
process.stdin.on('data', d => buf += d);
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = (JSON.parse(buf || '{}').tool_input || {}).command || ''; } catch (e) {}

  /* Matched anywhere in the command, not as a prefix: the way this project actually
     commits is `git add -A && git commit …`, so a prefix rule would never fire. */
  if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);

  /* What is actually going in. `-a`/`--all` sweeps up tracked changes that were
     never staged, so ask for those too rather than reporting an empty commit. */
  let files = git(['diff', '--cached', '--name-only']);
  if (/\bcommit\b[^&|;]*\s-[a-zA-Z]*a/.test(cmd) || /--all\b/.test(cmd))
    files = files.concat(git(['diff', '--name-only']));
  files = [...new Set(files)];

  if (!files.length) process.exit(0);                       // nothing to say anything about
  if (files.some(f => /(^|\/)CLAUDE\.md$/.test(f))) process.exit(0);   // already being updated

  /* Where this project's decisions live. A commit that only moves content or docs
     is usually not a memory event; one that changes the engine, a round, a tool or
     a skill usually is. Said as an observation rather than a rule, because the tool
     cannot read the change and the person can. */
  const decisive = files.filter(f =>
    /^(game-hub|tools|playground|engine)\//.test(f) || /^\.claude\/skills\//.test(f));

  const shown = files.slice(0, 12).map(f => '  · ' + f);
  if (files.length > 12) shown.push('  · …and ' + (files.length - 12) + ' more');

  const note = [
    'CLAUDE.md is NOT in this commit. What is:',
    ...shown,
    '',
    decisive.length
      ? (decisive.length + (decisive.length === 1 ? ' of these is' : ' of these are')
         + ' code, tooling or a skill — where this project keeps its decisions.')
      : 'None of these are code or tooling.',
    '',
    'CLAUDE.md is the project memory: the workspace is thrown away and it is re-read',
    'at the start of every session, so anything not written there did not happen.',
    'It holds only what is TRUE NOW. Update it in this commit if the change involved —',
    '  · a decision, or a decision reversed, and why',
    '  · a contract that changed, or something now on a shelf',
    '  · a trap that can still be walked into',
    '  · anything the Current status or Next sections now describe wrongly',
    '',
    'The story — what broke, the evidence, the suite counts, the diagnoses that were',
    'wrong first — goes in docs/log.md, which no session loads. That split is what',
    'keeps the memory readable: it reached 6,700 lines when three quarters of it had',
    'become a changelog, and the rules got skimmed along with the history.',
    '',
    'A mechanical change — content, a rename, a stamp bump, a typo — needs nothing.',
    'This note cannot tell which it is; it only knows the memory was not touched.'
  ].join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: note }
  }));
});
