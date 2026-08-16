#!/usr/bin/env node
/* Is there a written procedure for what you are about to change?
   ==============================================================

   A `PreToolUse` hook on Write and Edit. It names the skill that covers the file
   being touched — and, when **no skill covers it**, says so out loud, because that
   is the case the user asked to be told about before any work starts.

   **Why this exists.** `.claude/skills/` holds eight checklists — the project's
   *procedures*, as CLAUDE.md is its *memory*. Nothing made anyone open one. They
   were used when the task happened to be recognised and skipped when it did not,
   and the cost is not hypothetical: a whole session was spent tuning rounds and
   deploying without opening `tune-round` or `ship-it`, and `ship-it` opens by
   saying the default is no test suite — which is exactly the rule that session
   spent two and a half hours breaking. The procedure that would have prevented the
   mistake existed and nothing put it in front of anybody.

   **What "covers" means, and why it is not a list in here.** Each skill declares
   its own territory in its frontmatter (`covers:`), so a skill written next month
   claims its files by existing — the same move `question-types.js` makes for
   rounds and `shelf.js` for shelves. A list of paths kept in this file would be
   the hand-kept list this project has paid for more than any other defect.

   **How often it speaks, which is the whole design question.** A reminder that
   fires on every edit is one nobody reads by the third day; this project has
   written that down twice and both other PreToolUse hooks obey it. So:

   Both cases are spoken **once per session** — a covered file once per skill, an
   uncovered one once per file. The user's ask was to be told *first*, before work
   starts on something with no written procedure, and once is what "first" means.
   Saying it on every edit to `hub-engine.js` would make it wallpaper by lunchtime,
   which is the failure mode this project has already written down twice.

   It never blocks. Every other hook here hands back context and trusts the reader;
   a hook that refused an edit would be the first thing in this project to stop
   work rather than inform it. */
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT   = path.resolve(__dirname, '..');
const SKILLS = path.join(ROOT, '.claude', 'skills');

/* Files that are notes, scratch or fixtures rather than the app. Changing these
   needs no procedure and warning about them would be the noise that kills the
   signal. */
const IGNORE = /(^|\/)(node_modules|\.git|material)\//;
const NOT_CODE = /\.(md|json|txt|png|jpg|jpeg|svg|webp|ico|woff2?)$/i;

/* Read every skill's declared territory. Frontmatter is a handful of lines and a
   hand-rolled reader is enough — pulling in a YAML parser for `covers:` would be a
   dependency in a project whose whole point is that it has none. */
function skills(){
  let dirs = [];
  try { dirs = fs.readdirSync(SKILLS).filter(d =>
    fs.existsSync(path.join(SKILLS, d, 'SKILL.md'))); } catch (e) { return []; }
  return dirs.map(name => {
    const src = fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8');
    const fm  = (src.split(/^---$/m)[1] || '');
    const globs = [];
    let inCovers = false;
    fm.split('\n').forEach(line => {
      if (/^covers:\s*$/.test(line)) { inCovers = true; return; }
      if (inCovers){
        /* Quoted, always: a bare `*.html` is a YAML *alias reference*, not a
           string, and an unquoted one silently broke `ship-it`'s frontmatter — the
           description vanished and the loader fell back to the file's heading. */
        const m = line.match(/^\s+-\s+(.+?)\s*$/);
        if (m) globs.push(m[1].replace(/^["']|["']$/g, ''));
        else if (line.trim()) inCovers = false;
      }
    });
    const one = (src.match(/^description:\s*(.+)$/m) || [])[1] || '';
    return { name, globs, blurb: one.split(/(?<=\.)\s/)[0] };
  });
}

/* A glob with one `*`, which is all the declarations need. Anchored at both ends so
   `*.html` means a page at the root, not any html anywhere. */
const matches = (glob, rel) => {
  const rx = new RegExp('^' + glob.split('*').map(s =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
  return rx.test(rel);
};

let buf = '';
process.stdin.on('data', d => buf += d);
process.stdin.on('end', () => {
  let hook = {};
  try { hook = JSON.parse(buf || '{}'); } catch (e) {}
  const file = (hook.tool_input || {}).file_path || '';
  if (!file) return process.exit(0);

  const rel = path.relative(ROOT, path.resolve(file));
  /* Outside the repo entirely — a scratch drive in the temp dir, most often. */
  if (!rel || rel.startsWith('..')) return process.exit(0);
  if (IGNORE.test(rel) || NOT_CODE.test(rel)) return process.exit(0);

  const all = skills();
  const hits = all.filter(s => s.globs.some(g => matches(g, rel)));

  /* Said once per skill per session for a covered file, always for an uncovered
     one. The marker lives in the temp dir keyed by session, so it dies with the
     session exactly as the workspace does. */
  const seen = path.join(os.tmpdir(),
    'engishism-skill-' + String(hook.session_id || 'nosession').replace(/[^\w-]/g, ''));
  const already = () => { try { return fs.readFileSync(seen, 'utf8').split('\n'); }
                          catch (e) { return []; } };
  const remember = k => { try { fs.appendFileSync(seen, k + '\n'); } catch (e) {} };

  let note;
  if (hits.length){
    const key = hits.map(s => s.name).join('+');
    if (already().indexOf(key) !== -1) return process.exit(0);
    remember(key);
    note = [
      'There is a written procedure for ' + rel + '.',
      '',
      ...hits.map(s => '  · **' + s.name + '** — ' + s.blurb),
      '',
      hits.length > 1
        ? 'Read whichever fits — they open by saying how to tell each other apart.'
        : 'Load it before going further: Skill(' + hits[0].name + ').',
      'These are the checklists this project wrote down so the same mistakes stop',
      'being made from memory. Said once per skill per session, not every edit.'
    ].join('\n');
  } else {
    if (already().indexOf('!' + rel) !== -1) return process.exit(0);
    remember('!' + rel);
    note = [
      '**No skill covers ' + rel + '.**',
      '',
      'The eight in `.claude/skills/` are: ' + all.map(s => s.name).sort().join(', ') + '.',
      'None of them declares this file.',
      '',
      '**Tell the user before going further.** They asked to be informed when a',
      'change falls outside the written procedures. Say plainly what is being',
      'changed and that there is no checklist for it, and let them decide whether',
      'to go ahead or whether a skill should exist for this first.',
      'Said once per file per session, so this is the moment.',
      '',
      'If a skill *should* have covered it, the fix is a line in that skill\'s own',
      '`covers:` list rather than anything in the hook.'
    ].join('\n');
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: note }
  }));
});
