#!/usr/bin/env node
/* Which skills has this session actually opened?
   ==============================================

   A `PostToolUse` hook on Skill, Read and Bash. It does one thing: when a skill's
   own file is opened — through the Skill tool, through Read, or through a shell
   read like `cat`/`sed -n`/`head` — it writes that skill's name into a per-session
   marker file. It prints nothing and never blocks.

   **Why this exists.** `which-skill.js` names the procedure that covers a file, and
   for a whole session that was enough to be ignored: the reminder was printed and
   the work carried on from memory, and the cost was a second copy of the twist
   arithmetic that had to be extracted afterwards. The user's decision was that a
   covered file should not be editable until its skill has been read in the session.
   A gate needs to know what was read, and nothing recorded it. This is the record;
   the gate itself lives in `which-skill.js`, which is where the covering is known.

   **Derived, never listed.** A skill counts as opened when the name on the Skill
   call, or the path under `.claude/skills/`, names a directory that holds a
   SKILL.md — so a skill written next month is recognised by existing. The marker is
   the same shape `which-skill.js` already uses: the temp dir, keyed by session id,
   so it dies with the session exactly as the workspace does. */
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT   = path.resolve(__dirname, '..');
const SKILLS = path.join(ROOT, '.claude', 'skills');

function skillNames(){
  try { return fs.readdirSync(SKILLS).filter(d => fs.existsSync(path.join(SKILLS, d, 'SKILL.md'))); }
  catch (e) { return []; }
}

/* The marker file both hooks share — one name per line. */
function markerFile(sessionId){
  return path.join(os.tmpdir(), 'engishism-skill-read-' + String(sessionId || 'nosession').replace(/[^\w-]/g, ''));
}

/* Which skills a tool call opened, if any. */
function openedBy(hook){
  const names = skillNames();
  const input = hook.tool_input || {};
  const tool  = String(hook.tool_name || '');
  const found = new Set();
  if (tool === 'Skill'){
    /* `plugin:skill` names a plugin's skill, not one of ours; the bare name is ours. */
    const n = String(input.skill || '').split(':').pop();
    if (names.indexOf(n) !== -1) found.add(n);
  }
  const paths = [];
  if (tool === 'Read' && input.file_path) paths.push(String(input.file_path));
  if (tool === 'Bash' && input.command){
    /* A read verb somewhere in the command, and a skill file named in it. A write to
       the skill file (an edit) is not a read of it — `sed -i` and `>` do not count. */
    const cmd = String(input.command);
    const reads = /\b(cat|sed\s+-n|head|tail|less|more|bat)\b/.test(cmd) && !/sed\s+-i|>\s*[^&]/.test(cmd);
    if (reads) (cmd.match(/\.claude\/skills\/[\w-]+\/SKILL\.md/g) || []).forEach(p => paths.push(p));
  }
  paths.forEach(p => {
    const m = p.replace(/\\/g, '/').match(/\.claude\/skills\/([\w-]+)\/SKILL\.md$/);
    if (m && names.indexOf(m[1]) !== -1) found.add(m[1]);
  });
  return [...found];
}

module.exports = { markerFile, openedBy };

if (require.main === module){
  let buf = '';
  process.stdin.on('data', d => buf += d);
  process.stdin.on('end', () => {
    let hook = {};
    try { hook = JSON.parse(buf || '{}'); } catch (e) {}
    const opened = openedBy(hook);
    if (!opened.length) return process.exit(0);
    const file = markerFile(hook.session_id);
    let have = [];
    try { have = fs.readFileSync(file, 'utf8').split('\n'); } catch (e) {}
    const fresh = opened.filter(n => have.indexOf(n) === -1);
    if (fresh.length){ try { fs.appendFileSync(file, fresh.join('\n') + '\n'); } catch (e) {} }
    process.exit(0);
  });
}
