#!/usr/bin/env node
/* What is already on the shared shelves, asked of the code rather than listed.
   ===========================================================================

   Run it before writing anything shared:

     node tools/shelf.js

   **Why a tool and not a paragraph.** Every shared thing in this project exists
   because the same code got written twice, and the reason it got written twice
   is that nobody looked first. A list of shelf contents typed into a skill would
   be a list kept in step by hand — the defect this project has paid for more
   than any other — so this *loads the registries and asks them*, exactly as
   `tools/question-types.js` does. A helper added next month appears here with
   nobody editing anything.

   It doubles as a hook: given the hook's JSON on stdin, it prints nothing unless
   a round or a kit file is being edited, and then hands the inventory back as
   context. See `.claude/settings.json`.

   Loads the registries only — `hub-kit.js`, `hub-rounds.js` and `rounds/*.js`
   are data-only. `hub-engine.js` is deliberately not loaded: it injects a whole
   application. `bench-kit.js` is read as text, because it is a playground file
   that wants a browser; its shelf is one plain object literal at the end. */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');

/* Which files are "shared code", for the hook's purposes: a round, the round
   shelf itself, the game shelf, or the bench shelf. Editing any of these is a
   moment to know what already exists. */
const WATCHED = /(game-hub\/rounds\/|game-hub\/hub-rounds\.js|game-hub\/hub-kit\.js|playground\/bench-kit\.js)/;

const noop = () => {};
const el = () => ({ style:{ setProperty:noop }, dataset:{},
                    classList:{ add:noop, remove:noop, toggle:noop, contains:()=>false },
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

function load(rel){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel }); return true; }
  catch (e) { return false; }
}

load('game-hub/hub-kit.js');
load('game-hub/hub-rounds.js');
try {
  fs.readdirSync(path.join(ROOT, 'game-hub/rounds'))
    .filter(f => f.endsWith('.js')).sort()
    .forEach(f => load('game-hub/rounds/' + f));
} catch (e) {}

const Kit = sandbox.window.HubKit;

/* A function's *shape* is the useful half — "lanes(mount, ctx, opts)" tells you
   whether it fits before you read it. Taken from the source text, because a
   Function's own toString is the whole body. */
function signature(file, name){
  try {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const m = src.match(new RegExp('(?:^|\\n)\\s*(?:function\\s+)?' + name + '\\s*\\(([^)]*)\\)'));
    return m ? name + '(' + m[1].replace(/\s+/g, ' ').trim() + ')' : name;
  } catch (e) { return name; }
}

function roundShelf(){
  if (!Kit || !Kit.round) return [];
  /* The registry's own keys, minus the lookup functions — what is left is the
     shelf a round calls. Derived, so a helper added later shows up untouched. */
  const lookups = ['register','get','ids','authored','checkItem','fields','of'];
  /* **A shelf item is not always a function**, and filtering to functions alone made
     two of them invisible — `clock` and `results` are small objects with methods, the
     same shape `Kit.anim` and `Kit.prompt` have one tier up. The tool that exists to
     stop the next person rewriting something was silently not listing it. Read the
     same way `gameShelf` already does. */
  return Object.keys(Kit.round)
    .filter(k => lookups.indexOf(k) === -1 &&
                 (typeof Kit.round[k] === 'function' ||
                  (Kit.round[k] && typeof Kit.round[k] === 'object')))
    .map(k => typeof Kit.round[k] === 'function'
                ? signature('game-hub/hub-rounds.js', k)
                : k + ' · ' + Object.keys(Kit.round[k]).join(', '));
}

function gameShelf(){
  if (!Kit) return [];
  return Object.keys(Kit).filter(k => k !== 'round')
    .map(k => typeof Kit[k] === 'function' ? signature('game-hub/hub-kit.js', k)
                                           : k + ' · ' + Object.keys(Kit[k] || {}).join(', '));
}

/* The bench shelf is a browser file, so it is read rather than run: its exports
   are one `return { … }` at the end of the module. */
function benchShelf(){
  try {
    const src = fs.readFileSync(path.join(ROOT, 'playground/bench-kit.js'), 'utf8');
    const m = src.match(/return\s*\{([^}]*)\};\s*\}\)\(\);?\s*$/);
    if (!m) return [];
    return m[1].split(',').map(s => s.split(':')[0].trim()).filter(Boolean);
  } catch (e) { return []; }
}

/* Every hook a round may declare, asked of the registry's own defaults — so a
   hook added to the contract appears here for free. */
function roundHooks(){
  if (!Kit || !Kit.round) return [];
  try {
    const probe = Kit.round.register('__probe__', {});
    const keys = Object.keys(probe);
    delete Kit.round.get('__probe__');       // registered into a local map; harmless either way
    return keys;
  } catch (e) { return []; }
}

/* ---------- what has already been written more than once ----------
   **The half this tool was missing.** Listing what is on the shelf answers "does
   this exist?", which is no help at all when the thing does not exist *yet* and has
   instead been copied into five rounds. That is exactly how the end-of-round block
   sat duplicated until it produced one bug in three rounds at once, with this hook
   firing on every edit and correctly reporting a shelf the code was not on.

   Deliberately dumb: strip the comments, normalise the whitespace, slide a window
   of four lines, and report any window that shows up in three or more round files.
   It finds copied blocks whatever shape they are in, it cannot be fooled by a
   renamed variable being called something else, and it has no idea what the code
   means — which is the right amount of cleverness for something whose only job is
   to say "look here". Overlapping windows are merged so one copied block is one
   line of report rather than twenty. */
function duplication(){
  const dir = path.join(ROOT, 'game-hub', 'rounds');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.js$/.test(f)); } catch (e) { return []; }
  const strip = src => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\`])\/\/.*$/gm, '$1')
    .split('\n').map(l => l.trim().replace(/\s+/g, ' '))
    /* Short lines are structure — a lone `}` or `});` is in every file and means
       nothing. Eight characters is where a line starts being a decision. */
    .filter(l => l.length > 8);

  /* Three, not four. Four missed `shuffle` — a nine-line helper that survives
     stripping as three lines — which was copied into six round files, so the window
     has to be no longer than the smallest thing worth reporting. */
  const WIN = 3;
  /* **Four kinds of line are shared on purpose, and reporting them is noise.** A
     state field (`done: false`) is the state shape; a hook signature
     (`render(mount, s, ctx){`) is the *contract*, which every round is meant to
     match; a call into `K.round` is the shelf already working, which is the
     opposite of a finding; and the file preamble is the same in every module.

     The hook names come from the registry rather than a list here, so a hook added
     to the contract next month stops being reported without this file being
     touched — the same move the rest of the tool makes. */
  const hooks = new RegExp('^(' + (roundHooks().join('|') || 'x^') + ')\\s*\\(');
  const shared = l =>
       /^[A-Za-z_$][\w$]*\s*:/.test(l)                       // a state field
    || hooks.test(l)                                          // a hook signature
    || /\bK\.round\./.test(l)                                // the shelf, working
    || /^\(function\(\)|^'use strict'|^const K = window|^if\(!K/.test(l);
  /* Two lines of real logic, not one: one is `const c = ctx || {};` at the top of
     every render, which is true and useless. Two is a block worth looking at. */
  const worthIt = ls => ls.filter(l => !shared(l)).length >= 2;
  const seen = new Map();
  files.forEach(f => {
    const lines = strip(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (let i = 0; i + WIN <= lines.length; i++) {
      const run = lines.slice(i, i + WIN);
      if (!worthIt(run)) continue;
      const key = run.join(' | ');
      if (!seen.has(key)) seen.set(key, { where:new Set(), first:lines[i] });
      seen.get(key).where.add(f);
    }
  });

  /* One entry per (block, set of files), keyed on where it lives rather than on the
     text — twenty overlapping windows over one copied block are one finding. */
  const byPlace = new Map();
  seen.forEach((v, key) => {
    if (v.where.size < 3) return;
    const place = [...v.where].sort().join(', ');
    if (!byPlace.has(place)) byPlace.set(place, new Set());
    byPlace.get(place).add(v.first);
  });
  const out = [];
  byPlace.forEach((firsts, place) => {
    [...firsts].slice(0, 3).forEach(line => {
      out.push('  · ' + (line.length > 62 ? line.slice(0, 59) + '…' : line));
      out.push('      in ' + place);
    });
  });
  return out;
}

const rounds = roundShelf(), games = gameShelf(), bench = benchShelf(), hooks = roundHooks();
const dupes = duplication();

const report = [
  'SHARED SHELVES — check here before writing anything a second round might want.',
  '',
  'Kit.round — what a ROUND calls (game-hub/hub-rounds.js):',
  ...rounds.map(s => '  · ' + s),
  '',
  'Kit — what any GAME calls (game-hub/hub-kit.js):',
  ...games.map(s => '  · ' + s),
  '',
  'BenchKit — what a PLAYGROUND page calls (playground/bench-kit.js):',
  ...bench.map(s => '  · ' + s),
  '',
  'A round declares: ' + hooks.join(', '),
  '',
  (dupes.length
    ? ['WRITTEN THREE TIMES OR MORE — look at these before writing anything new:',
       '(The tool has no taste. A finding is a question, not an order — the three-line',
       ' preamble every render opens with is real and is not worth moving.)', ...dupes].join('\n')
    : 'Nothing is copied across three or more round files.'),
  '',
  'The rule: first caller writes it inside the round; the SECOND caller moves it',
  'here and rewires both in the same change. If you are about to write something',
  'listed above, call it instead.'
].join('\n');

/* Hook mode: read the tool call on stdin, stay silent unless shared code is
   being touched, and hand the inventory back as context rather than as noise.

   **What decides the mode is a tool call actually arriving, not the terminal.**
   Keying it on `isTTY` meant the documented command — `node tools/shelf.js` —
   printed *nothing at all* whenever it was run from a script or by an agent,
   which is the reader it was written for. It read as "the shelves are empty",
   which is the worst thing an inventory tool can say. So: parse stdin, and only
   behave as a hook if what arrived is a tool call. Anything else lists. */
if (process.stdin.isTTY || process.argv.indexOf('--list') !== -1) {
  console.log('\n' + report + '\n');
} else {
  let buf = '';
  process.stdin.on('data', d => buf += d);
  process.stdin.on('end', () => {
    let call = null;
    try { call = JSON.parse(buf); } catch (e) {}
    if (!call || !call.tool_input) return console.log('\n' + report + '\n');
    if (!WATCHED.test(call.tool_input.file_path || '')) process.exit(0);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: report }
    }));
  });
}
