#!/usr/bin/env node
/* Did the procedure hold?
   ======================

   A `PreToolUse` hook on Bash, firing on `git commit`. It closes the other end of the
   loop `which-skill.js` opens: that one hands you the checklist **before** an edit,
   this one asks — once, at the only moment the answer is known — whether the checklist
   was actually any good.

   **The gap it exists for.** A skill is a markdown file and nothing reads it but a
   model, so a stale one is *confidently wrong* rather than obviously broken. Worse than
   stale is **wrong**: a skill that recommends the thing that causes a bug will keep
   causing it, and every occurrence looks correct, because the checklist blessed it.
   Nothing anywhere prompted anybody to notice. The recorded case is `phoneMode`
   becoming `round_default` one morning with three skills still naming it that
   afternoon, `phone-debug` worst of all, because it hands you that setting as the
   *first* thing to run when phones misbehave.

   **What is automatic here is the question, never the answer** — and that distinction
   is the design rather than a shortcoming. Judging whether a checklist would have
   prevented a bug is a judgement, and the thing making it is the thing that just made
   the mistake; a skill rewritten with nobody reading the diff is exactly how wrong
   advice gets in and never leaves. So this makes the question unavoidable and leaves
   the answer to a person.

   **A skill is not a changelog, which is the trap this has to avoid being.** If every
   bug fix appends a rule, a skill is eight hundred lines of trivia within a month and
   nobody reads it — the same failure as a reminder that fires every time, and it would
   *cause* the rot it is meant to prevent. Most of what gets learned in this project is
   a fact about its **state** ("Blockbusters hosts rounds now") rather than a
   **procedure**, and state belongs in CLAUDE.md — while the *story* of how it got
   there belongs in the commit message, which is this project's only history. So the
   note routes three ways, and "change nothing" is the expected answer.

   **It also runs `check-syntax`**, because "the check that always runs" was a
   convention and conventions lose. Two seconds, and it is the only mechanical guard a
   skill has: a skill naming a symbol the code no longer contains fails it.

   Silence, as everywhere here: nothing on a commit that touches no covered file, and
   nothing about a skill whose own file is already in the commit — that one has been
   updated, which is the whole point. Once per skill per session otherwise. It never
   blocks. */
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFileSync } = require('child_process');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SKILLS = path.join(ROOT, '.claude', 'skills');

const git = args => {
  try {
    return execFileSync('git', ['-C', ROOT].concat(args), {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) { return []; }
};

/* The same reader `which-skill.js` uses. Hand-rolled because frontmatter is a handful
   of lines and a YAML dependency in a project whose whole point is that it has none
   would be a poor trade. */
function skills(){
  let dirs = [];
  try { dirs = fs.readdirSync(SKILLS).filter(d =>
    fs.existsSync(path.join(SKILLS, d, 'SKILL.md'))); } catch (e) { return []; }
  return dirs.map(name => {
    const fm = (fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8')
                  .split(/^---$/m)[1] || '');
    const globs = [];
    let inCovers = false;
    fm.split('\n').forEach(line => {
      if (/^covers:\s*$/.test(line)) { inCovers = true; return; }
      if (!inCovers) return;
      const m = line.match(/^\s+-\s+(.+?)\s*$/);
      if (m) globs.push(m[1].replace(/^["']|["']$/g, ''));
      else if (line.trim()) inCovers = false;
    });
    return { name, globs };
  });
}

const matches = (glob, rel) => {
  const rx = new RegExp('^' + glob.split('*').map(s =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
  return rx.test(rel);
};

const NOT_CODE = /\.(md|json|txt|png|jpg|jpeg|svg|webp|ico|woff2?)$/i;

let buf = '';
process.stdin.on('data', d => buf += d);
process.stdin.on('end', () => {
  let hook = {};
  try { hook = JSON.parse(buf || '{}'); } catch (e) {}
  const cmd = (hook.tool_input || {}).command || '';

  /* Matched anywhere, not as a prefix — this project commits with
     `git add -A && git commit …`, so a prefix rule would never fire. */
  if (!/\bgit\s+commit\b/.test(cmd)) return process.exit(0);

  let files = git(['diff', '--cached', '--name-only']);
  if (/\bcommit\b[^&|;]*\s-[a-zA-Z]*a/.test(cmd) || /--all\b/.test(cmd))
    files = files.concat(git(['diff', '--name-only']));
  files = [...new Set(files)];
  if (!files.length) return process.exit(0);

  const out = [];

  /* ---- the mechanical half ---------------------------------------------------
     `check-syntax` is the one check that costs nothing and catches what a person
     cannot: a malformed CSS comment that silently deletes every rule after it, and a
     skill naming a symbol that no longer exists anywhere. It has always been described
     as the check that *always* runs, and until now that was a thing to remember. */
  try {
    /* Both streams piped: `check-syntax` reports its problems on **stderr**, and the
       first version of this ignored that and reported nothing at all — a guard that
       silently never fires, which is worse than no guard. Found by sentinel; there is
       no way to see it by reading. */
    execFileSync('node', [path.join(ROOT, 'tools', 'check-syntax.js')],
                 { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const said = String((e.stdout || '') + (e.stderr || '')).trim();
    if (said) out.push('**`check-syntax` fails on this tree — fix it before the commit.**',
                       '', said, '');
  }

  /* ---- the judgement half ----------------------------------------------------- */
  const code = files.filter(f => !NOT_CODE.test(f));
  const all  = skills();
  /* A skill already being edited in this commit needs no prompting: that *is* the
     loop closing, and asking about it would be the reminder that fires every time. */
  const updated = new Set(files
    .map(f => (f.match(/^\.claude\/skills\/([^/]+)\/SKILL\.md$/) || [])[1])
    .filter(Boolean));

  const touched = all.filter(s =>
    !updated.has(s.name) && code.some(f => s.globs.some(g => matches(g, f))));

  const seen = path.join(os.tmpdir(),
    'engishism-procedure-' + String(hook.session_id || 'nosession').replace(/[^\w-]/g, ''));
  const already = () => { try { return fs.readFileSync(seen, 'utf8').split('\n'); }
                          catch (e) { return []; } };
  const ask = touched.filter(s => already().indexOf(s.name) === -1);
  ask.forEach(s => { try { fs.appendFileSync(seen, s.name + '\n'); } catch (e) {} });

  if (ask.length){
    out.push(
      'This commit changes ' +
        ask.map(s => '**' + s.name + '**').join(' and ') + "'s territory.",
      '',
      '**Did the checklist hold?** If this commit fixed a bug, one question, three answers:',
      '',
      '  · It would have caught this, or there was no bug — **change nothing.** Usual case.',
      '  · It would NOT have caught it and the lesson is *general* — the skill gains a rule.',
      '  · It would NOT have caught it and what you learned is a fact about this project',
      '    rather than a procedure — that is **CLAUDE.md**, not the skill, and only if it',
      '    is TRUE NOW. The story of what happened goes in this commit message.',
      '',
      'And the fourth, rarest and worth stopping for: **the skill told you to do the thing',
      'that caused the bug.** Wrong advice is confidently wrong and nothing else can find',
      'it — fix the skill in this commit.',
      '',
      'A skill is not a changelog. If every fix appends a rule it is eight hundred lines',
      'nobody reads within a month, which is the rot this exists to prevent. Say which of',
      'the four it was in one line, then carry on.',
      '',
      'Said once per skill per session, and never for a skill already in the commit.'
    );
  }

  if (!out.length) return process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: out.join('\n') }
  }));
});
