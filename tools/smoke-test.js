#!/usr/bin/env node
/* ================= Game Hub — smoke test =================
   Drives every game in a real browser and checks the things that have actually
   broken before: boards running off the screen, the card flip landing wrong,
   settings not persisting, buzzers not degrading when the relay is missing.

       node tools/smoke-test.js              # starts its own relay, runs everything
       node tools/smoke-test.js --url=…      # test a deployed copy instead
       node tools/smoke-test.js --keep-open  # leave the browser open on failure

   Playwright has to be resolvable. If it is installed globally:
       NODE_PATH=$(npm root -g) node tools/smoke-test.js

   Exit code is 0 only if every check passed, so this is safe to gate a push on.
================================================================================ */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.error('\n  Playwright not found. Try:\n    NODE_PATH=$(npm root -g) node tools/smoke-test.js\n');
  process.exit(2);
}

const args      = process.argv.slice(2);
const urlArg    = (args.find(a => a.startsWith('--url=')) || '').split('=')[1];
const onlyArg   = (args.find(a => a.startsWith('--only=')) || '').split('=')[1];
const keepOpen  = args.includes('--keep-open');
const PORT      = 8123;
const BASE      = urlArg || `http://127.0.0.1:${PORT}`;
const REPO      = path.resolve(__dirname, '..');

/* ---------- tiny runner ---------- */
let passed = 0, failed = 0, group = '';
const failures = [];

function section(name){ group = name; console.log('\n' + name); }
function check(name, ok, detail){
  if (ok) { passed++; console.log('  ok    ' + name); }
  else {
    failed++; failures.push(group + ' → ' + name + (detail ? '  [' + detail + ']' : ''));
    console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : ''));
  }
}

/* ---------- navigation helpers, shared by every test ---------- */
async function openHub(browser, viewport){
  const page = await browser.newPage({ viewport: viewport || { width:1366, height:768 } });
  page.__errors  = [];   // uncaught exceptions — never acceptable
  page.__console = [];   // console errors, mostly network; expected in some tests
  page.on('pageerror', e => page.__errors.push(String(e)));
  page.on('console', m => {
    // the Google Fonts request always fails in a sandbox; it is not our problem
    if (m.type() === 'error' && !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)/.test(m.text()))
      page.__console.push(m.text());
  });
  await page.goto(BASE + '/game-hub.html');
  await page.waitForTimeout(350);
  return page;
}

async function startGame(page, gameTitle, { sections = 1, unit = 'Unit 5' } = {}){
  await page.getByText(unit, { exact:false }).first().click();
  await page.waitForTimeout(180);
  await page.locator('h3:visible', { hasText: gameTitle }).first().click();
  await page.waitForTimeout(180);
  const boxes = page.locator('#content-list input');
  const total = await boxes.count();
  const want  = sections === 'all' ? total : Math.min(sections, total);
  const start = page.locator('#start-btn');
  for (let i = 0; i < want; i++) await boxes.nth(i).check();
  await page.waitForTimeout(120);
  // keep ticking until the game is willing to start (Jeopardy needs three categories,
  // Millionaire needs every rung covered) rather than hard-coding each minimum here
  for (let i = want; i < total && await start.isDisabled(); i++){
    await boxes.nth(i).check();
    await page.waitForTimeout(80);
  }
  await start.click();
  await page.waitForTimeout(420);
}

const scores = page => page.locator('.team .score').allInnerTexts();

function checkClean(page, who){
  const w = who ? who + ' ' : '';
  check(w + 'nothing thrown', page.__errors.length === 0, page.__errors[0]);
  check(w + 'no console errors', page.__console.length === 0, page.__console[0]);
}

// nothing may sit under the team bar, and the page must never scroll while playing
async function boardFits(page, selector){
  return page.evaluate(sel => {
    const els = [...document.querySelectorAll(sel)];
    if (!els.length) return { ok:false, why:'no elements' };
    const barTop = document.getElementById('scorebar').getBoundingClientRect().top;
    const lowest = Math.max(...els.map(e => e.getBoundingClientRect().bottom));
    return {
      ok: lowest <= barTop + 1 && document.body.scrollHeight <= window.innerHeight,
      why: 'lowest=' + Math.round(lowest) + ' barTop=' + Math.round(barTop) +
           ' scrollH=' + document.body.scrollHeight + ' innerH=' + window.innerHeight
    };
  }, selector);
}

/* ---------- the tests ---------- */

async function testJeopardy(browser){
  section('Jeopardy');
  const page = await openHub(browser);
  await startGame(page, 'Jeopardy', { sections: 3 });

  const tiles = await page.locator('.tile').count();
  check('board builds', tiles > 0, tiles + ' tiles');

  const fit = await boardFits(page, '.tile');
  check('whole board is on screen', fit.ok, fit.why);

  // right answer scores the tile value
  const tile = page.locator('.tile').nth(1);
  const value = parseInt((await tile.innerText()).replace(/\D/g, ''), 10);
  await tile.click(); await page.waitForTimeout(1300);
  check('front face shows the tile value',
        (await page.locator('#clue-front-text').textContent()).includes(String(value)));
  check('card rests on the clue face', await page.locator('#clue-card.flipped').count() === 1);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(200);
  check('answer reveals', await page.locator('#clue-answer').isVisible());
  await page.locator('#correct-btn').click();
  await page.waitForFunction(() => document.getElementById('clue-modal').style.display === 'none', null, { timeout:6000 });
  const after = await scores(page);
  check('correct answer scores the tile value', parseInt(after[0], 10) === value, after.join('/'));
  check('spent tile keeps its value', (await page.locator('.tile.used').first().innerText()).includes(String(value)));

  // a spent tile reopens for review and must not score again
  await page.locator('.tile.used').first().click(); await page.waitForTimeout(1400);
  check('review shows the answer already', await page.locator('#clue-answer').isVisible());
  check('review offers no scoring', await page.locator('#correct-btn').isVisible() === false);
  await page.locator('#close-btn').click(); await page.waitForTimeout(1300);
  check('review changed no score', (await scores(page))[0] === after[0]);

  checkClean(page);
  await page.close();
}

async function testBlockbusters(browser){
  section('Blockbusters');
  const page = await openHub(browser);
  await startGame(page, 'Blockbusters', { sections: 'all' });

  check('board builds 18 hexes', await page.locator('.hex').count() === 18);
  const fit = await boardFits(page, '.hex');
  check('whole board is on screen', fit.ok, fit.why);

  await page.locator('.hex').first().click(); await page.waitForTimeout(1300);
  check('clue opens', (await page.locator('#clue-text').innerText()).length > 0);
  await claimForTeam(page, 0);
  await page.waitForFunction(() => document.getElementById('clue-modal').style.display === 'none', null, { timeout:6000 });
  check('claim awards a point', (await scores(page))[0] === '1', (await scores(page)).join('/'));
  check('hex is marked claimed', await page.locator('.hex.claimed-gold').count() === 1);

  checkClean(page);
  await page.close();
}

/* Blockbusters awards through its own two buttons today; after the shared team
   chooser lands it will be team chips instead. Accept either, so this test spans
   the refactor rather than needing a rewrite mid-way. */
async function claimForTeam(page, index){
  const chips = page.locator('.claim-team');
  if (await chips.count() > index) { await chips.nth(index).click(); return; }
  await page.locator(index === 0 ? '#gold-btn' : '#silver-btn').click();
}

async function testRace(browser){
  section('Race to the Board');
  const page = await openHub(browser);
  await startGame(page, 'Race to the Board', { sections: 'all' });

  const words = await page.locator('.race-word').count();
  check('board builds', words > 0 && words <= 18, words + ' words');
  const overlaps = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.race-word')].map(e => e.getBoundingClientRect());
    let n = 0;
    for (let i=0;i<r.length;i++) for (let j=i+1;j<r.length;j++)
      if (!(r[i].right<r[j].left||r[j].right<r[i].left||r[i].bottom<r[j].top||r[j].bottom<r[i].top)) n++;
    return n;
  });
  check('no words overlap', overlaps === 0, overlaps + ' overlapping pairs');
  const fit = await boardFits(page, '.race-word');
  check('all words are on screen', fit.ok, fit.why);

  await page.locator('#race-start').click(); await page.waitForTimeout(300);
  const answer = await currentRaceAnswer(page);
  check('a sentence is showing', !!answer, String(answer));

  // wrong touch must leave the sentence up so the other team can steal
  const before = await page.locator('#race-prompt .race-sentence').innerText();
  await page.locator('.race-word').filter({ hasNotText: new RegExp('^' + answer + '$','i') }).first().click();
  await page.waitForTimeout(300);
  check('wrong touch keeps the sentence up',
        (await page.locator('#race-prompt .race-sentence').innerText()) === before);

  // correct touch asks who got there first, then scores that team
  await page.locator('.race-word', { hasText: new RegExp('^' + answer + '$','i') }).first().click();
  await page.waitForTimeout(300);
  check('asks which team touched first', await page.locator('#race-claim').isVisible());
  await page.keyboard.press('2'); await page.waitForTimeout(350);
  check('number key scores the right team', (await scores(page))[1] === '1', (await scores(page)).join('/'));

  checkClean(page);
  await page.close();
}

const currentRaceAnswer = page => page.evaluate(() => {
  const s = document.querySelector('#race-prompt .race-sentence'); if (!s) return null;
  for (const u of window.UNITS){
    const hit = (u.raceBank||[]).find(i => i.prompt.replace(/___+/g,'?') === s.textContent);
    if (hit) return hit.answer;
  }
  return null;
});

async function testMillionaire(browser){
  section('Millionaire');
  const page = await openHub(browser);
  await startGame(page, 'Millionaire', { sections: 1 });

  check('ladder has 8 rungs', await page.locator('.m-rung').count() === 8);
  check('four options offered', await page.locator('.m-option').count() === 4);
  const fit = await boardFits(page, '.m-option');
  check('stage is on screen', fit.ok, fit.why);

  // 50:50 must remove two wrong options and never the right one
  const right = await currentMillionaireAnswer(page);
  await page.locator('.lifeline[data-life="fifty"]').click(); await page.waitForTimeout(250);
  check('50:50 removes two options', await page.locator('.m-option.removed').count() === 2);
  const removedRight = await page.locator('.m-option.removed', { hasText: right }).count();
  check('50:50 keeps the correct option', removedRight === 0);
  check('50:50 is spent', await page.locator('.lifeline[data-life="fifty"]').isDisabled());

  await page.locator('.m-option', { hasText: right }).first().click(); await page.waitForTimeout(350);
  check('correct answer scores 100', (await scores(page))[0] === '100', (await scores(page)).join('/'));
  check('correct option is marked', await page.locator('.m-option.right').count() === 1);

  await page.locator('#m-next').click(); await page.waitForTimeout(350);
  check('turn passes to team 2', /team 2/i.test(await page.locator('#m-turn').innerText()));

  checkClean(page);
  await page.close();
}

const currentMillionaireAnswer = page => page.evaluate(() => {
  const q = document.getElementById('m-question').textContent;
  for (const u of window.UNITS){
    const hit = (u.millionaireBank||[]).find(i => i.prompt === q);
    if (hit) return hit.answer;
  }
  return null;
});

async function testBoardFitAcrossScreens(browser){
  section('Boards fit every screen');
  for (const vp of [{width:1280,height:720},{width:1920,height:1080}]){
    for (const [game, sel, sections] of [['Jeopardy','.tile',1], ['Jeopardy','.tile','all'],
                                         ['Race to the Board','.race-word','all'],
                                         ['Millionaire','.m-option','all']]){
      const page = await openHub(browser, vp);
      await startGame(page, game, { sections });
      const fit = await boardFits(page, sel);
      check(`${game} @ ${vp.width}x${vp.height} (${sections === 'all' ? 'all' : sections} section)`, fit.ok, fit.why);
      await page.close();
    }
  }
}

async function testSettings(browser){
  section('Settings');
  const page = await openHub(browser);
  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  check('panel opens', await page.locator('#settings-modal').isVisible());
  check('rows are generated from the registry', await page.locator('.settings-row').count() >= 5);

  await page.evaluate(() => window.HubSettings.set('sound', false));
  await page.reload(); await page.waitForTimeout(400);
  check('a changed setting survives reload', await page.evaluate(() => window.HubSettings.get('sound')) === false);

  await page.locator('#settings-btn').click(); await page.waitForTimeout(200);
  await page.locator('#settings-reset').click(); await page.waitForTimeout(250);
  check('reset restores the default', await page.evaluate(() => window.HubSettings.get('sound')) === true);

  // a setting that changes behaviour actually changes behaviour
  await page.evaluate(() => window.HubSettings.set('raceRescatter', false));
  await page.locator('#settings-close').click();
  await startGame(page, 'Race to the Board', { sections: 1 });
  await page.locator('#race-start').click(); await page.waitForTimeout(300);
  const pos = () => page.evaluate(() => [...document.querySelectorAll('.race-word')].map(e => e.style.left + ',' + e.style.top).join(';'));
  const before = await pos();
  const answer = await currentRaceAnswer(page);
  await page.locator('.race-word', { hasText: new RegExp('^' + answer + '$','i') }).first().click();
  await page.waitForTimeout(200);
  await page.keyboard.press('1'); await page.waitForTimeout(350);
  check('re-scatter off leaves the words where they were', (await pos()) === before);

  checkClean(page);
  await page.close();
}

async function testBuzzers(browser){
  section('Phone buzzers');
  const host = await openHub(browser);
  await host.evaluate(() => window.HubSettings.set('buzzers', true));
  await startGame(host, 'Race to the Board', { sections: 1 });
  await host.waitForTimeout(700);

  const chip = await host.locator('#buzzer-chip').innerText().catch(() => '');
  const code = (chip.match(/CODE\s+(\d{5})/i) || [])[1];
  check('a room opens and shows a code', !!code, chip.replace(/\n/g,' '));
  if (!code){ await host.close(); return; }

  const join = async (name, team) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(250);
    await p.fill('#code', code); await p.fill('#name', name);
    await p.locator('.teams button').nth(team).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(500);
    return p;
  };
  const alina = await join('Alina', 0);
  const bruno = await join('Bruno', 1);
  await host.waitForTimeout(500);
  check('host counts both phones', (await host.locator('#buzzer-chip').innerText()).includes('2'));

  await host.locator('#race-start').click(); await host.waitForTimeout(600);
  check('buzzers arm when a sentence goes up', !(await alina.locator('#buzzer').isDisabled()));

  await bruno.locator('#buzzer').click(); await host.waitForTimeout(600);
  check('the winner is shown on the host', (await host.locator('#buzzer-chip').innerText()).includes('Bruno'));
  check('the loser is locked out', await alina.locator('#buzzer').isDisabled());

  const answer = await currentRaceAnswer(host);
  await host.locator('.race-word', { hasText: new RegExp('^' + answer + '$','i') }).first().click();
  await host.waitForTimeout(600);
  check('a buzz scores its team with no chooser', await host.locator('#race-claim').isVisible() === false);
  check('the buzzing team got the point', (await scores(host))[1] === '1', (await scores(host)).join('/'));

  for (const p of [alina, bruno]) { check('phone had no errors', p.__errors.length === 0, p.__errors[0]); await p.close(); }
  checkClean(host, 'host');
  await host.close();
}

async function testDegradation(browser){
  section('Degrades without buzzers');

  // buzzers switched off — the manual chooser must still be there
  const off = await openHub(browser);
  await off.evaluate(() => window.HubSettings.set('buzzers', false));
  await startGame(off, 'Race to the Board', { sections: 1 });
  await off.locator('#race-start').click(); await off.waitForTimeout(300);
  const a1 = await currentRaceAnswer(off);
  await off.locator('.race-word', { hasText: new RegExp('^' + a1 + '$','i') }).first().click();
  await off.waitForTimeout(300);
  check('buzzers off → manual chooser appears', await off.locator('#race-claim').isVisible());
  await off.keyboard.press('1'); await off.waitForTimeout(300);
  check('buzzers off → keypress still scores', (await scores(off))[0] === '1');
  await off.close();

  // relay pointed somewhere dead — the game must still be playable
  const dead = await openHub(browser);
  await dead.evaluate(() => { window.HubSettings.set('buzzers', true);
                              window.HubSettings.set('buzzerRelay', 'http://127.0.0.1:9'); });
  await startGame(dead, 'Race to the Board', { sections: 1 });
  await dead.waitForTimeout(700);
  await dead.locator('#race-start').click(); await dead.waitForTimeout(300);
  check('dead relay → game still playable', await dead.locator('#race-prompt .race-sentence').isVisible());
  const a2 = await currentRaceAnswer(dead);
  await dead.locator('.race-word', { hasText: new RegExp('^' + a2 + '$','i') }).first().click();
  await dead.waitForTimeout(300);
  check('dead relay → falls back to the chooser', await dead.locator('#race-claim').isVisible());
  check('dead relay → nothing thrown', dead.__errors.length === 0, dead.__errors[0]);
  await dead.close();
}

async function testFileProtocol(browser){
  section('Runs from a file, offline');
  const page = await browser.newPage({ viewport:{ width:1366, height:768 } });
  const failedReqs = [];
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) failedReqs.push(r.url()); });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + REPO + '/game-hub.html');
  await page.waitForTimeout(500);
  check('engine runs', await page.evaluate(() => typeof window.HUB_BUILD === 'string'));
  check('units load', await page.evaluate(() => (window.UNITS||[]).length) > 0);
  check('no failed asset requests', failedReqs.length === 0, failedReqs[0]);
  check('no page errors', errs.length === 0, errs[0]);
  await page.close();
}

/* ---------- run ---------- */
async function main(){
  let relay = null;
  if (!urlArg){
    relay = spawn(process.execPath, [path.join(REPO, 'tools', 'buzzer-relay.js')],
                  { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 1200));
  }
  const browser = await chromium.launch();
  const started = Date.now();
  const suites = {
    jeopardy: testJeopardy, blockbusters: testBlockbusters, race: testRace,
    millionaire: testMillionaire, fit: testBoardFitAcrossScreens,
    settings: testSettings, buzzers: testBuzzers,
    degradation: testDegradation, file: testFileProtocol
  };
  const toRun = onlyArg ? onlyArg.split(',').map(s => s.trim()).filter(k => suites[k])
                        : Object.keys(suites);
  if (onlyArg && !toRun.length){
    console.error('  unknown --only= value. Available: ' + Object.keys(suites).join(', '));
    process.exit(2);
  }
  try {
    for (const key of toRun) await suites[key](browser);
  } catch (e) {
    failed++; failures.push('threw: ' + (e && e.message));
    console.log('\n  THREW  ' + (e && e.message));
  }
  if (!keepOpen || !failed) await browser.close();
  if (relay) relay.kill();

  console.log('\n' + '─'.repeat(56));
  console.log(`  ${passed} passed, ${failed} failed   (${((Date.now()-started)/1000).toFixed(1)}s)`);
  if (failures.length){
    console.log('\n  Failures:');
    failures.forEach(f => console.log('    · ' + f));
  }
  console.log('');
  process.exit(failed ? 1 : 0);
}

main();
