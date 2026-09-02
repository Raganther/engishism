#!/usr/bin/env node
/* What question types exist, asked of the code rather than written down.
   ======================================================================

   Run it before authoring anything:

     node tools/question-types.js

   **Why this is a tool and not a paragraph in a skill.** A list of question types
   typed into a markdown file is a list kept in step by hand, which is the defect
   this project has paid for more than any other — `games: gameIds()`, the `.lit`
   stage list, the normalisation whitelist, the cache-stamp instruction that named
   four files and missed the four playground pages. A round written next month must
   appear here without anybody remembering, so this reads the registries: every
   round is asked its own label, blurb, item field, modes and sample, and every
   question form is asked which boards it suits.

   It loads the registries only — `hub-kit.js`, `hub-rounds.js` and `rounds/*.js`
   are data-only files that register and return, exactly as `dev.html` relies on.
   `hub-engine.js` is deliberately not loaded: it injects a whole application. */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');

/* The smallest DOM these files need to *load*. They only touch the real thing
   inside render/reveal, which nothing here calls — so a stub that never pretends
   to lay anything out is honest, and a file that started needing more would fail
   loudly here rather than quietly drawing nothing in a game. */
const noop = () => {};
const el = () => ({ style:{}, dataset:{}, classList:{ add:noop, remove:noop, toggle:noop, contains:()=>false },
                    appendChild:noop, removeChild:noop, setAttribute:noop, getAttribute:()=>null,
                    addEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[],
                    children:[], childNodes:[], innerHTML:'', textContent:'' });
const sandbox = {
  console,
  document: { createElement: el, createElementNS: el, body: el(),
              getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
              addEventListener: noop, head: el() },
  navigator: { userAgent: 'node' },
  setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const load = rel => {
  const file = path.join(ROOT, rel);
  try { vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: rel }); }
  catch (e) { console.error('could not load ' + rel + ' — ' + e.message); process.exit(1); }
};

load('game-hub/hub-kit.js');
load('game-hub/hub-rounds.js');
fs.readdirSync(path.join(ROOT, 'game-hub/rounds'))
  .filter(f => f.endsWith('.js')).sort()
  .forEach(f => load('game-hub/rounds/' + f));

const Kit = sandbox.window.HubKit;
if (!Kit || !Kit.round) { console.error('the registries did not load'); process.exit(1); }

const line = s => console.log(s);
const rule = () => line('─'.repeat(72));

line('');
line('ROUNDS — a question the class PLAYS. Card, phones, judging.');
line('These are the only shapes new content may be authored in.');
rule();

Kit.round.authored().forEach(id => {
  const d = Kit.round.get(id);
  line('');
  line('  ' + (d.label || id) + '   (id: ' + id + ')');
  if (d.blurb) line('  ' + d.blurb);
  line('  item field:  ' + (d.field || '—'));
  if (d.modes && d.modes.length)
    line('  ways to play: ' + d.modes.map(m => m.value).join(' · ') +
         '   (the teacher picks in ⚙, per game)');
  line('  shape:');
  JSON.stringify(d.sample || { '(no sample declared)': true }, null, 2)
    .split('\n').forEach(l => line('    ' + l));
});

line('');
line('');
line('QUESTION FORMS — a way a question is DRAWN. No phones, no judging.');
line('Use these when the question does not need the room to play it.');
rule();

const suits = t => {
  const info = Kit.prompt.info ? Kit.prompt.info(t) : null;
  const g = info && info.games;
  return g && g.length ? g.join(', ') : 'all boards';
};
(Kit.prompt.types() || []).forEach(t => {
  const info = Kit.prompt.info ? Kit.prompt.info(t) : null;
  const label = info && info.label && info.label !== t ? '  "' + info.label + '"' : '';
  line('  ' + t.padEnd(12) + ' suits: ' + suits(t) + label);
});

line('');
rule();
line('Authoring rules per game, and the check that enforces them:');
line('  NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=content');
line('');
line('  Jeopardy      every category needs exactly 5 clues, values 100–500,');
line('                and categories stay grouped by section in array order.');
line('  Blockbusters  an ordinary answer is ONE word starting with its letter.');
line('                A round hexagon still needs a letter and carries no answer.');
line('  Race          answers are single words, unique within the race bank.');
line('  Millionaire   3 distractors each, levels 1–8, at least 2 per level per');
line('                section, or two teams meet the same question climbing.');
line('  Every game    no prompt may appear in two banks, and the counts printed');
line('                in the section labels must match the banks.');
line('');
