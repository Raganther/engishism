#!/usr/bin/env node
/* Where is the work, actually?
   ===========================

   A `SessionStart` hook. It asks **GitHub**, not the local clone, where `main` is,
   and says whether this checkout matches it.

   **Why this exists.** The workspace is re-cloned for every session, and a clone is
   a photograph: `origin/main` in it is whatever the remote said at the moment the
   snapshot was taken, and it does not update on its own. A session opened from a
   stale snapshot read its own `origin/main`, found an old commit, and reported that
   a whole day's shipped work was missing and that the live site still had a bug that
   had in fact been fixed and deployed. Nothing was wrong with the repository; the
   session was reading a photograph and describing it as the view out of the window.

   That is a bad failure because it is *confident* and it is about the one thing a
   teacher acts on — whether the fix is live. It also cannot be caught by reading
   more carefully: the local ref genuinely says what it says.

   **The rule it enforces:** to state what is deployed, ask the remote. `git
   ls-remote` and `git fetch` take a second; `git log origin/main` takes none and can
   be a day out of date.

   Never blocks, never fails a session. No network, or a repo without a remote, is
   said plainly rather than guessed at. */
'use strict';
const { execSync } = require('child_process');

const run = (cmd, ms) => {
  try { return execSync(cmd, { stdio:['ignore','pipe','ignore'], timeout: ms || 8000 })
                .toString().trim(); }
  catch (e) { return null; }
};

const lines = [];
const remote = run('git remote get-url origin');
if (!remote){
  lines.push('No `origin` remote — nothing to compare against.');
} else {
  /* Ask GitHub. `ls-remote` is the cheap authoritative question; the fetch is what
     makes the answer usable locally. If the network is out, say so — a silent
     failure here would leave the stale ref looking authoritative, which is the whole
     bug this exists to stop. */
  const tip = (run('git ls-remote origin refs/heads/main', 12000) || '').split(/\s+/)[0];
  if (!tip){
    lines.push('**Could not reach the remote.** Anything this session says about what is');
    lines.push('deployed is a guess until `git ls-remote origin refs/heads/main` succeeds.');
    lines.push('Do not report the state of `main` from the local ref — it is a snapshot.');
  } else {
    run('git fetch origin --prune', 25000);
    const short = s => (s || '').slice(0, 7);
    const head  = run('git rev-parse HEAD') || '';
    const subj  = run('git log -1 --format=%s ' + tip) || '(not in this clone yet)';
    const behind = run('git rev-list --count HEAD..' + tip);
    const ahead  = run('git rev-list --count ' + tip + '..HEAD');

    lines.push('origin/main on GitHub is **' + short(tip) + '** — ' + subj);
    if (head === tip){
      lines.push('This checkout is exactly that. Nothing is unshipped.');
    } else {
      if (Number(behind) > 0)
        lines.push('**This checkout is ' + behind + ' commit(s) BEHIND origin/main.** Anything you');
      if (Number(behind) > 0)
        lines.push('remember about "what is live" from a previous session may be stale.');
      if (Number(ahead) > 0)
        lines.push('**' + ahead + ' commit(s) here are NOT on origin/main** — not deployed.');
      lines.push('HEAD is ' + short(head) + '.');
    }
    lines.push('');
    lines.push('Pages and Render both build from `main`, so that commit *is* what a class');
    lines.push('gets today. **To say what is deployed, ask the remote** — `git ls-remote`');
    lines.push('or a fresh `git fetch`. `git log origin/main` on a fresh clone is a');
    lines.push('photograph taken when the workspace was made, and a session has already');
    lines.push('reported a day of shipped work as missing by trusting it.');
    lines.push('');
    lines.push('**What exists now is asked, never remembered:** `node tools/shelf.js` (every');
    lines.push('shared helper) · `node tools/question-types.js` (every round and form).');
    lines.push('`dev.html` is the same derived truth for a browser. All three read the');
    lines.push('registries at the moment you ask; prose in any file can be stale.');
  }
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart',
                        additionalContext: lines.join('\n') }
}));
