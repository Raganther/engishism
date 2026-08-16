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

/* ---- a skill's `covers:` must point at files that exist ----
   Each skill declares which files are its business, and `tools/which-skill.js`
   reads those declarations to say whether there is a procedure for what is about to
   change. A path that gets renamed leaves the skill silently covering nothing — the
   hook would go quiet on exactly the files it was written for, and quiet is
   indistinguishable from "no skill needed". Globs are skipped; a literal path is
   checked. */
(function checkSkillCovers(){
  const dir = path.join(ROOT, '.claude/skills');
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(name => {
    const f = path.join(dir, name, 'SKILL.md');
    if (!fs.existsSync(f)) return;
    const fm = fs.readFileSync(f, 'utf8').split(/^---$/m)[1] || '';
    let inCovers = false;
    fm.split('\n').forEach(line => {
      if (/^covers:\s*$/.test(line)) { inCovers = true; return; }
      if (!inCovers) return;
      const m = line.match(/^\s+-\s+(.+?)\s*$/);
      if (!m){ if (line.trim()) inCovers = false; return; }
      const g = m[1].replace(/^["']|["']$/g, '');
      if (g.indexOf('*') !== -1) return;                 // a glob covers whatever matches
      if (!fs.existsSync(path.join(ROOT, g)))
        problems.push(`.claude/skills/${name} covers ${g}, which does not exist — the skill now covers nothing there`);
    });
  });
})();

/* ---- a skill must not name a symbol the code no longer has ----
   The `covers:` check above catches a *file* being renamed. This catches the other
   half, which is the one that has actually cost time: a skill naming a function or a
   setting that has since been renamed away. **Nothing else can catch it** — a skill is
   a markdown file and nothing reads it but a model, so a stale one is confidently
   wrong rather than obviously broken.

   The recorded case: `phoneMode` became `round_default` one morning and three skills
   still named it that afternoon. `phone-debug` was the damaging one, because it hands
   you `HubSettings.get('phoneMode', …)` as the *first* thing to run when phones
   misbehave — so the next person gets `undefined` and concludes the setting does not
   exist, while chasing a phone bug, which is when a wrong lead costs most.

   **How it can be this crude and still be quiet.** A backticked word that appears
   nowhere in ~30k lines of source is almost never English — it is a dead symbol. Run
   over the ten skills as written it found exactly two, both real (`jGroupStamp`, lost
   in the adapter rename; `migratePhoneModes`, folded into `migrateDefaultRound`) and
   nothing false. If it ever does misfire, the fix is to take the backticks off a word
   that was never a symbol.

   **Two limits, both stated rather than pretended away.** It asks whether a string
   appears *anywhere* in the code, so a historical comment naming a symbol that was
   later renamed will mask it — this file is skipped for exactly that reason, since the
   paragraph above names two dead symbols as its own examples and passed itself on the
   first run. And it says nothing about a member that moved: `Kit.round.thing` is judged
   on `Kit`. */
(function checkSkillSymbols(){
  const dir = path.join(ROOT, '.claude/skills');
  if (!fs.existsSync(dir)) return;
  /* Every file a skill could plausibly be describing, read once. */
  const src = [];
  const SELF = path.resolve(__filename);
  const walk = d => fs.readdirSync(d, {withFileTypes:true}).forEach(e => {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'material') return;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|css|html)$/.test(e.name) && path.resolve(p) !== SELF)
      src.push(fs.readFileSync(p, 'utf8'));
  });
  walk(ROOT);
  const all = src.join('\n');

  fs.readdirSync(dir).forEach(name => {
    const f = path.join(dir, name, 'SKILL.md');
    if (!fs.existsSync(f)) return;
    const body = fs.readFileSync(f, 'utf8');
    const seen = new Set();
    (body.match(/`[A-Za-z][A-Za-z0-9_.]{3,}`/g) || []).forEach(tok => {
      const word = tok.slice(1, -1);
      if (seen.has(word)) return;
      seen.add(word);
      /* Compare the root, so `Kit.round.crowdMeter` is judged on `Kit` existing —
         a member that moved is a different and much noisier question. */
      const root = word.split('.')[0];
      if (all.indexOf(root) === -1)
        problems.push(`.claude/skills/${name} names \`${word}\`, which appears nowhere in the source — renamed, or the skill describes something that no longer exists`);
    });
  });
})();

/* ---- the relay tells a joining phone the same things it tells an armed one ----
   **The bug class this guards has bitten three times.** What reaches a handset is
   built from a hand-typed list of keys, and it is written out *twice* — once in the
   `armed` push and once in the `joined` payload a reconnecting or late phone gets.
   Add a field to one and forget the other and nothing anywhere complains: the round
   works perfectly for everyone who was in the room when the question opened, and
   silently misses the students whose wifi dropped. `optionsByTeam` was lost on a
   re-ask, `promptByPlayer` nearly went the same way, and `done` was one edit from
   it. A person cannot be relied on to keep two lists in step — this can.

   The two payloads differ on purpose in a few places, and those are named: `reopen`
   is a fact about *this* arm, and the join carries who you are and what the room is
   doing, which an arm has no reason to repeat. Anything else appearing in one and
   not the other is the defect. */
(function checkRelayPayloads(){
  const rel = 'tools/buzzer-relay.js';
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return;
  const src = fs.readFileSync(file, 'utf8');
  const between = (from, to) => {
    const a = src.indexOf(from);
    if (a === -1) return '';
    const b = src.indexOf(to, a);
    return b === -1 ? '' : src.slice(a, b);
  };
  const arm  = between("toEachPlayer(room, 'armed'", '}));');
  const join = between("pushEvent(res, 'joined', {", '});');
  if (!arm || !join) return problems.push(`${rel}: cannot find the armed/joined payloads to compare`);
  const keys = t => new Set((t.match(/([a-zA-Z]+)\s*:/g) || []).map(k => k.replace(/\s*:$/, '')));
  const a = keys(arm), j = keys(join);
  /* Deliberately in one and not the other. Everything else is an oversight. */
  const armOnly  = new Set(['reopen']);
  const joinOnly = new Set(['armed','id','locked','solo','teams','yours','name','team']);
  const missingFromJoin = [...a].filter(k => !j.has(k) && !armOnly.has(k));
  const missingFromArm  = [...j].filter(k => !a.has(k) && !joinOnly.has(k));
  if (missingFromJoin.length)
    problems.push(`${rel}: the arm sends ${missingFromJoin.join(', ')} but a joining phone is never told — a reconnect loses it`);
  if (missingFromArm.length)
    problems.push(`${rel}: the join sends ${missingFromArm.join(', ')} but an arm does not — the two payloads have drifted`);
})();

/* ---- the cache stamp: one value, or the phone gets a mix of two builds ----
   Found, not listed. This was four hand-typed shells and it had already drifted
   once: the playground pages sat two days stale outside it, which read as the
   bench being broken rather than as a stale asset. Every stamped page is found
   by search now. The date shape in the pattern is load-bearing — classic.html
   carries ?v=picture and ?v=unit1, which are content selectors, and a looser
   pattern would drag them in as a false disagreement. */
const stamps = new Set();
const stamped = [];
walk('.', '.html').forEach(rel => {
  if (rel.indexOf('node_modules') !== -1) return;
  const hits = fs.readFileSync(path.join(ROOT, rel), 'utf8').match(/\?v=20[0-9]{6}[a-z]*/g) || [];
  if (hits.length) stamped.push(rel);
  hits.forEach(v => stamps.add(v));
});
if (stamps.size > 1)
  problems.push(`cache stamp disagrees across ${stamped.length} stamped pages: ${[...stamps].join(' ')}`);

if (problems.length){
  console.error('  ' + problems.length + ' problem' + (problems.length > 1 ? 's' : '') + ':');
  problems.forEach(p => console.error('    · ' + p));
  process.exit(1);
}
console.log(`  syntax ok — ${stamps.size ? [...stamps][0] : 'no stamp found'}`);
