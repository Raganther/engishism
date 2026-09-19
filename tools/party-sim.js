#!/usr/bin/env node
/* Flip Party, played by robots, many times over
   ============================================

   One person cannot tell whether a board is fair by playing it once. This runs
   Flip Party on the room bench with Autopilot phones of NAMED skill, N games in a
   row, and prints the numbers that say whether the comeback rules are doing their
   job: did the lead change hands, how far apart were first and last at the end,
   did the weakest ever beat the strongest, and was the winner still in doubt when
   five cards were left.

       NODE_PATH=$(npm root -g) node tools/party-sim.js
       NODE_PATH=$(npm root -g) node tools/party-sim.js --games=10 --skills=90,70,40,40
       NODE_PATH=$(npm root -g) node tools/party-sim.js --rules='{"steal":0.3,"catchUp":1}' --out=/tmp/runs.json

   --games=N          how many games (default 3)
   --skills=a,b,c     one number per phone, 0..100: how often that student is right
                      (default 90,70,40,40). A weaker one is slower too — the bench's rule
   --unit=id          the content unit (default the first with a Jeopardy pool)
   --rules=JSON       any of Flip Party's RULES to override (steal, catchUp, twists, decay…)
   --out=file         write every game's full log as JSON
   --port=N           relay port (default 8141)
   --headed           watch it play

   Nothing here is a fake: the relay, the host page and every phone are the real
   pages, driven through the same handles a person uses on the bench
   (`?skills=`, `?auto=1`, `HubEnv.rules`, `HubEnv.deal`, `HubEnv.log`). The clocks
   are shortened through `HubEnv.rules`, which is why a game takes about a minute. */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('\n  Playwright not found. Try:\n    NODE_PATH=$(npm root -g) node tools/party-sim.js\n'); process.exit(2); }

const arg = (k, d) => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const GAMES = Math.max(1, Number(arg('games', 3)) || 3);
const SKILLS = String(arg('skills', '90,70,40,40')).split(',').map(Number).filter(n => Number.isFinite(n));
const UNIT = arg('unit', '');
const RULES = JSON.parse(arg('rules', '{}'));
const OUT = arg('out', '');
const PORT = Number(arg('port', 8141)) || 8141;
const HEADED = process.argv.includes('--headed');
/* Fast clocks: the question still has to outlast the slowest robot (speed 1 → up to ~3s). */
const FAST = { secs: 5, reveal: 0.3, standings: 0.3, gift: 1.5, boxOpen: 0.3 };

const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function playOne(browser, n){
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  const url = `http://127.0.0.1:${PORT}/playground/phone-bench.html?board=${encodeURIComponent('flip-party.html?spectate=1')}` +
              `&skills=${SKILLS.join(',')}&auto=1&speed=1`;
  await page.goto(url);
  for (let t = 0; t < 80 && !(await page.locator('#code').inputValue()); t++) await sleep(250);
  if (!(await page.locator('#code').inputValue())) throw new Error('no room code — is the relay up?');
  for (let i = 0; i < SKILLS.length; i++) { await page.locator('#add').click(); await sleep(350); }
  const host = fn => page.evaluate(fn => { const w = document.getElementById('stage-frame').contentWindow; return w.HubEnv ? (new Function('HubEnv', 'return (' + fn + ')(HubEnv)'))(w.HubEnv) : null; }, fn.toString());
  for (let t = 0; t < 60; t++) { const k = await host(E => E.teams().length); if (k >= SKILLS.length) break; await sleep(250); }
  const names = await page.evaluate(() => phones.map(p => p.name));
  const skillOf = {}; names.forEach((nm, i) => { skillOf[nm] = SKILLS[i % SKILLS.length]; });
  await page.evaluate(([rules, unit]) => { const w = document.getElementById('stage-frame').contentWindow; w.HubEnv.rules(rules); w.HubEnv.deal(unit || undefined); }, [Object.assign({}, FAST, RULES), UNIT]);
  const started = Date.now();
  let phase = '';
  while (Date.now() - started < 8 * 60 * 1000) {
    await sleep(500);
    const st = await host(E => { const g = E.state(); return g ? { phase: g.phase, left: g.cards.filter(c => !c.used).length } : null; });
    if (st) phase = st.phase;
    if (phase === 'end') break;
  }
  const log = await host(E => E.log());
  await page.close();
  if (phase !== 'end') throw new Error('game ' + n + ' did not finish (phase ' + phase + ')' + (errors.length ? '; page errors: ' + errors.join(' | ') : ''));
  log.skills = skillOf;
  log.errors = errors;
  return log;
}

/* ---- what one game says ---- */
function measure(log){
  const E = log.entries, fin = log.final;
  const skill = r => log.skills[r.name];
  let leader = null, changes = 0;
  E.forEach(e => {
    const top = e.standings.filter(r => r.place === 1);
    if (top.length === 1 && top[0].id !== leader) { if (leader) changes++; leader = top[0].id; }
  });
  const first = fin[0], last = fin[fin.length - 1];
  const gapShare = first.pts ? (first.pts - last.pts) / first.pts : 0;
  const strongest = fin.slice().sort((a, b) => skill(b) - skill(a))[0];
  const weakest = fin.slice().sort((a, b) => skill(a) - skill(b))[0];
  const weakAbove = weakest.place < strongest.place;
  const at5 = E.filter(e => e.left >= 5).pop();
  let doubt = null, leaderAt5Won = null;
  if (at5) {
    const rows = at5.standings;
    const gap = rows[0].pts - (rows[1] ? rows[1].pts : 0);
    /* In doubt: second place could still catch first on face value alone — five cards
       at the card's worth, before catch-up, doubles or a steal help them further. */
    doubt = gap <= 5 * log.rules.worth;
    leaderAt5Won = rows[0].id === first.id;
  }
  const twists = E.filter(e => e.twist && e.twist !== 'plain' && e.right !== null).length;   // cards with a twist on the back
  return { winner: first.name, winnerSkill: skill(first), changes, gapShare, weakAbove, doubt, leaderAt5Won, twists,
           places: fin.map(r => ({ name: r.name, skill: skill(r), pts: r.pts, place: r.place })), secs: Math.round(E[E.length - 1].at / 1000) };
}

(async () => {
  const relay = spawn(process.execPath, [path.join(ROOT, 'tools', 'buzzer-relay.js')], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  await sleep(900);
  const browser = await chromium.launch({ headless: !HEADED });
  const logs = [], stats = [];
  try {
    console.log(`Flip Party × ${GAMES} · class ${SKILLS.join('/')}${Object.keys(RULES).length ? ' · rules ' + JSON.stringify(RULES) : ''}`);
    for (let n = 1; n <= GAMES; n++) {
      const log = await playOne(browser, n);
      const m = measure(log);
      logs.push(log); stats.push(m);
      console.log(`  game ${n}: ${m.winner} (${m.winnerSkill}%) won · lead changed ${m.changes}× · gap ${(m.gapShare * 100).toFixed(0)}% · ` +
                  `weakest above strongest: ${m.weakAbove ? 'yes' : 'no'} · in doubt at 5 left: ${m.doubt == null ? '?' : m.doubt ? 'yes' : 'no'} · ` +
                  m.places.map(p => `${p.name} ${p.pts}`).join(', ') + (log.errors.length ? ' · PAGE ERRORS ' + log.errors.length : ''));
    }
  } finally {
    await browser.close(); relay.kill();
  }
  const n = stats.length, mean = f => stats.reduce((a, s) => a + f(s), 0) / n;
  const pct = f => Math.round(100 * stats.filter(f).length / n) + '%';
  console.log('');
  console.log(`  lead changes per game      ${mean(s => s.changes).toFixed(1)}  (min ${Math.min(...stats.map(s => s.changes))}, max ${Math.max(...stats.map(s => s.changes))})`);
  console.log(`  first-to-last gap at end   ${(100 * mean(s => s.gapShare)).toFixed(0)}% of the winner's score`);
  console.log(`  weakest finished above strongest   ${pct(s => s.weakAbove)}`);
  console.log(`  winner in doubt with 5 cards left  ${pct(s => s.doubt)}`);
  console.log(`  leader at 5 left went on to win    ${pct(s => s.leaderAt5Won)}`);
  const wins = {}; stats.forEach(s => { const k = s.winnerSkill + '%'; wins[k] = (wins[k] || 0) + 1; });
  console.log(`  wins by skill              ${Object.keys(wins).sort((a, b) => parseInt(b) - parseInt(a)).map(k => k + ' ×' + wins[k]).join('  ')}`);
  console.log(`  twists played per game     ${mean(s => s.twists).toFixed(1)} · a game took ${mean(s => s.secs).toFixed(0)}s`);
  if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ skills: SKILLS, rules: RULES, games: logs, stats }, null, 1)); console.log(`  full logs → ${OUT}`); }
})().catch(e => { console.error('party-sim failed:', e.message || e); process.exit(1); });
