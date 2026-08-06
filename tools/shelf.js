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
  return Object.keys(Kit.round)
    .filter(k => lookups.indexOf(k) === -1 && typeof Kit.round[k] === 'function')
    .map(k => signature('game-hub/hub-rounds.js', k));
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

const rounds = roundShelf(), games = gameShelf(), bench = benchShelf(), hooks = roundHooks();

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
  'The rule: first caller writes it inside the round; the SECOND caller moves it',
  'here and rewires both in the same change. If you are about to write something',
  'listed above, call it instead.'
].join('\n');

/* Hook mode: read the tool call on stdin, stay silent unless shared code is
   being touched, and hand the inventory back as context rather than as noise. */
if (!process.stdin.isTTY && process.argv.indexOf('--list') === -1) {
  let buf = '';
  process.stdin.on('data', d => buf += d);
  process.stdin.on('end', () => {
    let file = '';
    try { file = (JSON.parse(buf || '{}').tool_input || {}).file_path || ''; } catch (e) {}
    if (!WATCHED.test(file)) process.exit(0);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: report }
    }));
  });
} else {
  console.log('\n' + report + '\n');
}
