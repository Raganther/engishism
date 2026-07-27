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

['game-hub/hub-engine.js', 'game-hub/hub-kit.js', 'game-hub/hub-settings.js',
 'game-hub/hub-buzzer.js', 'game-hub/content/unit-4.js', 'game-hub/content/unit-5.js',
 'tools/smoke-test.js', 'tools/buzzer-relay.js'].forEach(checkJS);
['game-hub/hub.css'].forEach(checkCSS);

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
