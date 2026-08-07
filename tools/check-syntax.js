#!/usr/bin/env node
/* Pre-flight: does it parse at all? Seconds, no browser, no dependencies.
   Run it before the smoke suite — it catches the class of mistake that makes a
   browser run *look* like a behaviour bug and sends you debugging the wrong thing.

   The CSS half is the reason this exists. A malformed comment silently deletes every
   rule after it: the parser skips to the next comment-close and there is no error
   anywhere, in the console or otherwise. An edit that left one paragraph outside its
   comment delimiters made the header behave exactly as though the rule had never been
   written, and cost a round of debugging the layout instead of the file. CSS has no
   compiler; this is it.

   Note the delimiters are spelled out in words above rather than written literally —
   a comment-close inside a comment ends it early, which is this same bug, and it bit
   this file on its first run. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const problems = [];

/* ---- JS: hand it to the engine that will run it ---- */
function checkJS(rel){
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  try {
    // the browser files are plain scripts, not modules — wrap so `return` at top
    // level would fail the same way it does in a browser
    new (require('vm').Script)(src, { filename: rel });
  } catch (e) {
    problems.push(`${rel}: ${e.message}`);
  }
}

/* ---- CSS: comments closed, braces balanced, nothing stranded at top level ---- */
function checkCSS(rel){
  const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let i = 0, line = 1, depth = 0, inComment = false, commentLine = 0;
  while (i < s.length){
    if (s[i] === '\n') line++;
    if (!inComment && s[i] === '/' && s[i+1] === '*'){ inComment = true; commentLine = line; i += 2; continue; }
    if (inComment && s[i] === '*' && s[i+1] === '/'){ inComment = false; i += 2; continue; }
    if (!inComment){
      if (s[i] === '{') depth++;
      else if (s[i] === '}'){ depth--; if (depth < 0) problems.push(`${rel}:${line}: unmatched }`); }
      // a `*/` outside a comment means an earlier one was re-opened by accident —
      // everything between was swallowed and silently dropped
      else if (s[i] === '*' && s[i+1] === '/') problems.push(`${rel}:${line}: stray */ — the rules above it were dropped`);
    }
    i++;
  }
  if (inComment) problems.push(`${rel}:${commentLine}: comment never closed — everything after it is dropped`);
  if (depth !== 0) problems.push(`${rel}: ${depth > 0 ? depth + ' unclosed {' : -depth + ' extra }'}`);
}

/* **Found, not listed.** This was eight hand-typed paths, and it had been wrong for
   as long as the rounds have existed: `hub-rounds.js`, every file in `rounds/`,
   `nef-1.js`, `unit-lab.js`, `bench-kit.js` and `hub-rounds.css` were all absent, so
   the one check that always runs was silently skipping the files most edited. Walk
   the directories instead — a file added next month is checked without anybody
   remembering. Same defect, same fix, as everywhere else in this project. */
function walk(dir, ext){
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name), ext)
                    : (e.name.endsWith(ext) ? [path.join(dir, e.name)] : []));
}
[...walk('game-hub', '.js'), ...walk('playground', '.js'), ...walk('tools', '.js')]
  .filter(f => f !== 'tools/check-syntax.js')      // it is running; it parsed
  .forEach(checkJS);
walk('game-hub', '.css').forEach(checkCSS);

/* ---- the dev hub names every skill, and only skills that exist ----
   The one hand-kept list left on that page, so it is checked rather than trusted:
   a skill added without a link is a skill nobody finds, and a link to a deleted
   skill is a dead end. Two seconds, and it fails by name. */
(function checkSkills(){
  const dir = path.join(ROOT, '.claude/skills');
  if (!fs.existsSync(dir)) return;
  const onDisk = fs.readdirSync(dir, { withFileTypes: true })
                   .filter(e => e.isDirectory()).map(e => e.name).sort();
  let page = '';
  try { page = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8'); } catch (e) { return; }
  const listed = (page.match(/SKILLS\s*=\s*\[([^\]]*)\]/) || [,''])[1]
                   .split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean).sort();
  if (!listed.length) return;                      // the page does not claim to list them
  onDisk.filter(s => listed.indexOf(s) === -1)
        .forEach(s => problems.push(`dev.html does not link the skill "${s}"`));
  listed.filter(s => onDisk.indexOf(s) === -1)
        .forEach(s => problems.push(`dev.html links "${s}", which is not a skill any more`));
})();

/* ---- a shell that loads any round must load them all ----
   The per-unit deep links carried a hand-typed list of round `<script>` tags and
   it had gone four rounds stale: `game-hub-unit4.html` and `-unit5.html` loaded
   only the first four, so anagram, scramble, infogap and drop content opened in
   them as **plain text with no error anywhere** — the round simply was not
   registered, so `Kit.round.of()` found nothing and the item read as an ordinary
   question. HTML cannot glob, so the list has to be written by hand; what it does
   not have to be is unchecked. */
(function checkRoundScripts(){
  const dir = path.join(ROOT, 'game-hub/rounds');
  if (!fs.existsSync(dir)) return;
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, '')).sort();
  walk('.', '.html').forEach(rel => {
    if (rel.indexOf('node_modules') !== -1) return;
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const has = [...new Set((src.match(/rounds\/([a-z0-9-]+)\.js/g) || [])
                   .map(m => m.replace(/rounds\/|\.js/g, '')))];
    if (!has.length) return;                        // this page hosts no rounds at all
    const missing = all.filter(r => has.indexOf(r) === -1);
    if (missing.length)
      problems.push(`${rel} loads some rounds but not ${missing.join(', ')} — that content will draw as plain text`);
  });
})();

/* ---- the cache stamp: one value, or the phone gets a mix of two builds ---- */
const shells = ['game-hub.html', 'game-hub-unit4.html', 'game-hub-unit5.html', 'join.html'];
const stamps = new Set();
shells.forEach(f => (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/\?v=[0-9a-z]+/g) || [])
                      .forEach(v => stamps.add(v)));
if (stamps.size > 1) problems.push(`cache stamp disagrees across the shells: ${[...stamps].join(' ')}`);

if (problems.length){
  console.error('  ' + problems.length + ' problem' + (problems.length > 1 ? 's' : '') + ':');
  problems.forEach(p => console.error('    · ' + p));
  process.exit(1);
}
console.log(`  syntax ok — ${stamps.size ? [...stamps][0] : 'no stamp found'}`);
