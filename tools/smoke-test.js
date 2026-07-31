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

async function startGame(page, gameTitle, { sections = 1, unit = 'Unit 5', keepIntro = false, raceMode = null } = {}){
  // callers may already be mid-game; walk back to the unit screen first
  const newGame = page.locator('#new-game-btn');
  if (await newGame.isVisible().catch(()=>false)){ await newGame.click(); await page.waitForTimeout(180); }
  const changeUnit = page.locator('#change-unit');
  if (await changeUnit.isVisible().catch(()=>false)){ await changeUnit.click(); await page.waitForTimeout(180); }

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
  /* Race's mode is a radio on the content screen, so it has to be chosen *before*
     Start — setting it afterwards silently does nothing, and a test that did so was
     asserting about head-to-head while believing it was testing timed rounds. It
     passed on the broken build, which is the only way that mistake announces itself. */
  if (raceMode){
    const radio = page.locator(`#race-mode input[value="${raceMode}"]`);
    if (await radio.count()) await radio.check();
    await page.waitForTimeout(120);
  }
  await start.click();
  await page.waitForTimeout(420);
  // game show is the default now, so a title sequence may be sitting over the board.
  // Every test that starts a game wants to be *in* the game, so skip past it.
  if (!keepIntro && await page.locator('#intro-overlay.on').count()){
    await page.keyboard.press('Space');
    await page.waitForTimeout(320);
  }
}

const scores = page => page.locator('.team .score').allInnerTexts();

function checkClean(page, who){
  const w = who ? who + ' ' : '';
  check(w + 'nothing thrown', page.__errors.length === 0, page.__errors[0]);
  check(w + 'no console errors', page.__console.length === 0, page.__console[0]);
}

/* Nothing may cross the floor, and the page must never scroll while playing.
   The floor is the top of the team bar while the bar is a fixed strip, and the
   bottom of the viewport when it is not. The bar has now been in both places and
   this test needed no edit either time, because it asks Kit.floorTop() rather than
   restating the fact — which is the whole reason floorTop() exists. */
async function boardFits(page, selector){
  return page.evaluate(sel => {
    const els = [...document.querySelectorAll(sel)];
    if (!els.length) return { ok:false, why:'no elements' };
    const floor  = window.HubKit.floorTop();
    const lowest = Math.max(...els.map(e => e.getBoundingClientRect().bottom));
    return {
      ok: lowest <= floor + 1 && document.body.scrollHeight <= window.innerHeight,
      why: 'lowest=' + Math.round(lowest) + ' floor=' + Math.round(floor) +
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
  // the answer now appears either in the blank or on the answer line, depending on
  // whether it is the word the sentence was missing — assert that it is visible
  // somewhere, not which element happens to carry it
  check('answer reveals', await answerIsShowing(page));
  await page.locator('#correct-btn').click();
  await page.waitForFunction(() => document.getElementById('clue-modal').style.display === 'none', null, { timeout:6000 });
  const after = await scores(page);
  check('correct answer scores the tile value', parseInt(after[0], 10) === value, after.join('/'));
  check('spent tile keeps its value', (await page.locator('.tile.used').first().innerText()).includes(String(value)));

  // a spent tile reopens for review and must not score again
  await page.locator('.tile.used').first().click(); await page.waitForTimeout(1400);
  check('review shows the answer already', await answerIsShowing(page));
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

  // the board is laid out from the hexagons' rendered width, which is a vw clamp —
  // measuring it behind a hidden screen once made them overlap by 21px
  const spacing = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.hex')];
    const a = h[0].getBoundingClientRect(), b = h[1].getBoundingClientRect();
    return { w: Math.round(a.width), step: Math.round(b.left - a.left) };
  });
  check('hexes are spaced wider than they are drawn', spacing.step > spacing.w,
        'hex ' + spacing.w + 'px, step ' + spacing.step + 'px');

  await page.locator('.hex').first().click(); await page.waitForTimeout(1300);
  check('clue opens', (await page.locator('#clue-text').innerText()).length > 0);
  await claimForTeam(page, 0);
  await page.waitForFunction(() => document.getElementById('clue-modal').style.display === 'none', null, { timeout:6000 });
  check('claim awards a point', (await scores(page))[0] === '1', (await scores(page)).join('/'));
  check('hex is marked claimed', await page.locator('.hex.claimed-gold').count() === 1);

  // a resize repositions rather than rebuilding, so a claim must survive it
  await page.setViewportSize({ width:1280, height:720 }); await page.waitForTimeout(400);
  check('a claim survives a resize', await page.locator('.hex.claimed-gold').count() === 1);
  const after = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.hex')];
    const a = h[0].getBoundingClientRect(), b = h[1].getBoundingClientRect();
    return { w: Math.round(a.width), step: Math.round(b.left - a.left) };
  });
  check('still spaced correctly after a resize', after.step > after.w,
        'hex ' + after.w + 'px, step ' + after.step + 'px');

  /* A completed line used to do nothing at all — the teacher had to spot it. Row 0
     runs the full width of the board, so claiming it out is a genuine yellow
     left-to-right win. [0,0] is already gold from the claim above. */
  for (const c of [1, 2, 3, 4]) await claimHexAt(page, 0, c, 0);
  await page.waitForTimeout(2400);          // trace animation, then the banner lands

  const win = await page.evaluate(() => ({
    banner: document.getElementById('result-modal').classList.contains('on'),
    title:  document.getElementById('result-title').textContent,
    sub:    document.getElementById('result-sub').textContent,
    tone:   document.getElementById('result-card').className,
    route:  [...document.querySelectorAll('.hex.route')].map(h => h.dataset.row + ',' + h.dataset.col).sort(),
    dimmed: document.getElementById('hexwrap').classList.contains('route-shown'),
    boardBottom: Math.round(document.getElementById('hexwrap').getBoundingClientRect().bottom),
    cardTop:     Math.round(document.getElementById('result-card').getBoundingClientRect().top)
  }));
  check('a completed line raises the winner banner', win.banner);
  check('the banner names the winning team', /Team 1 wins/.test(win.title), win.title);
  check('the banner says which way it was won', /Left to right in 5/.test(win.sub), win.sub);
  check('the banner takes the winner\'s colour', win.tone === 'tone-gold', win.tone);
  check('the winning route is marked', win.route.join(' ') === '0,0 0,1 0,2 0,3 0,4', win.route.join(' '));
  check('the rest of the board dims', win.dimmed);
  // the banner must never cover the route it just lit up
  check('the board clears the banner', win.boardBottom < win.cardTop,
        'board ends ' + win.boardBottom + ', banner starts ' + win.cardTop);

  await page.locator('.hex[data-row="2"][data-col="0"]').click({ force: true });
  await page.waitForTimeout(400);
  check('the board stops taking clicks once won',
        await page.evaluate(() => getComputedStyle(document.getElementById('clue-modal')).display) === 'none');

  await page.locator('#result-actions button.primary').click();
  await page.waitForTimeout(600);
  const fresh = await page.evaluate(() => ({
    route:   document.querySelectorAll('.hex.route').length,
    claimed: document.querySelectorAll('.hex.claimed-gold, .hex.claimed-silver').length,
    locked:  document.getElementById('hexwrap').classList.contains('won'),
    lifted:  document.getElementById('play-blockbusters').style.transform
  }));
  check('New board clears the route and the claims',
        fresh.route === 0 && fresh.claimed === 0 && !fresh.locked && !fresh.lifted,
        JSON.stringify(fresh));
  check('New board keeps the scores', (await scores(page))[0] === '5', (await scores(page)).join('/'));

  checkClean(page);
  await page.close();
}

async function claimHexAt(page, r, c, team){
  await page.locator(`.hex[data-row="${r}"][data-col="${c}"]`).click();
  await page.waitForTimeout(1300);
  await claimForTeam(page, team);
  await page.waitForFunction(() => document.getElementById('clue-modal').style.display === 'none',
                             null, { timeout:6000 });
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

/* The answer is visible either answered in place by whatever form the question is,
   or printed on the clue card's answer line — both count. Keyed on the shared
   `.prompt-revealed` marker rather than the gap type's own class, so a new form is
   covered without editing this. */
const answerIsShowing = async page =>
  (await page.locator('#clue-answer').isVisible()) ||
  (await page.locator('#clue-text.prompt-revealed').count()) > 0;

/* Don't reconstruct the sentence — render each candidate through the same registry
   the engine used and compare. Rebuilding it as `prompt.replace(/___+/g,'?')`
   hard-coded the gap type's placeholder, so it silently found nothing the moment a
   question was drawn any other way. */
const currentRaceAnswer = page => page.evaluate(() => {
  const s = document.querySelector('#race-prompt .race-sentence'); if (!s) return null;
  const probe = document.createElement('div');
  for (const u of window.UNITS){
    for (const i of (u.raceBank || [])){
      window.HubKit.prompt.render(probe, { text:i.prompt, answer:i.answer, type:i.type }, 'race');
      if (probe.textContent === s.textContent) return i.answer;
    }
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

  /* The show's beat: a click is the team saying a letter, and nothing is revealed
     until the host asks. What makes it worth a test rather than a flourish is that
     it must be *reversible* — the room shouting "no, C!" has to be able to land. */
  const wrongFirst = await page.evaluate(r =>
    ([...document.querySelectorAll('#m-options .m-option:not(.removed)')]
      .find(x => x.dataset.opt !== r) || {}).dataset.opt || null, right);
  await page.locator('.m-option', { hasText: wrongFirst }).first().click(); await page.waitForTimeout(200);
  /* Still the locked colour with the pointer resting on it. `:hover:not(:disabled)`
     out-specifies `.picked`, so the option the teacher just clicked went back to
     looking merely hovered — while they were looking straight at it. */
  /* Compare hovered-and-picked against hovered-and-not-picked, not against a resting
     option: a hovered option always differs from an unhovered one, so that pair passed
     on the broken build. The claim is that hovering does not overwrite the lock. */
  const paintOf = sel => page.evaluate(s => {
    const e = document.querySelector(s);
    return getComputedStyle(e).backgroundImage + '|' + getComputedStyle(e).backgroundColor;
  }, sel);
  await page.locator('.m-option:not(.picked):not(.removed)').first().hover();
  await page.waitForTimeout(120);
  const hoveredPlain = await paintOf('.m-option:not(.picked):not(.removed)');
  await page.locator('.m-option.picked').hover(); await page.waitForTimeout(120);
  const hoveredPicked = await paintOf('.m-option.picked');
  check('the locked option keeps its colour under the pointer',
        hoveredPicked !== hoveredPlain, hoveredPicked + '  vs  ' + hoveredPlain);
  check('picking an option locks it in without revealing',
        await page.locator('.m-option.picked').count() === 1 &&
        await page.locator('.m-option.right').count() === 0 &&
        await page.locator('#m-final').isVisible(),
        await page.locator('#m-hint').innerText());
  check('nothing is scored until the answer is final', (await scores(page))[0] === '0',
        (await scores(page)).join('/'));

  await page.locator('.m-option', { hasText: right }).first().click(); await page.waitForTimeout(200);
  check('picking another option moves the lock rather than answering',
        await page.locator('.m-option.picked').count() === 1 &&
        (await page.locator('.m-option.picked').getAttribute('data-opt')) === right,
        await page.locator('.m-option.picked').getAttribute('data-opt'));

  await page.locator('#m-final').click(); await page.waitForTimeout(350);
  check('correct answer scores 100', (await scores(page))[0] === '100', (await scores(page)).join('/'));
  check('correct option is marked', await page.locator('.m-option.right').count() === 1);
  check('the lock clears on the reveal', await page.locator('.m-option.picked').count() === 0);
  check('and "Final answer?" goes away with it', !(await page.locator('#m-final').isVisible()));

  await page.locator('#m-next').click(); await page.waitForTimeout(350);
  check('turn passes to team 2', /team 2/i.test(await page.locator('#m-turn').innerText()));

  /* Ask the class, with no phones: the teacher taps hands, and then has to be able
     to play the question. Counting used to be the only state — a click always added
     a hand — and the one way out also wiped the numbers the team was deciding on. */
  await page.locator('.lifeline[data-life="class"]').click(); await page.waitForTimeout(300);
  check('asking the class starts a hand count', await page.locator('#m-done-count').isVisible());
  await page.locator('#m-options .m-option').nth(1).click();
  await page.locator('#m-options .m-option').nth(1).click(); await page.waitForTimeout(200);
  check('tapping an option counts a hand rather than answering',
        (await page.locator('.m-votes').allInnerTexts())[1] === '2' &&
        !(await page.locator('#m-next').isVisible()),
        (await page.locator('.m-votes').allInnerTexts()).join('/'));

  await page.locator('#m-done-count').click(); await page.waitForTimeout(250);
  check('done counting keeps the numbers on screen',
        (await page.locator('.m-votes').allInnerTexts())[1] === '2',
        (await page.locator('.m-votes').allInnerTexts()).join('/'));
  const right2 = await currentMillionaireAnswer(page);
  await playMillionaireOption(page, page.locator('.m-option', { hasText: right2 }));
  await page.waitForTimeout(400);
  check('and the question can then actually be answered',
        await page.locator('#m-next').isVisible(),
        await page.locator('#m-hint').innerText());

  checkClean(page);
  await page.close();
}

/* Answering is two beats now, not one: a click nominates and "Final answer?" reveals.
   Every test that just wants the question *played* goes through here, so the tests
   assert outcomes and stay indifferent to whether the confirm step is switched on.
   `locator` picks the option; anything the caller passes must resolve to one button. */
async function playMillionaireOption(page, locator){
  await locator.first().click();
  await page.waitForTimeout(150);
  const final = page.locator('#m-final');
  if(await final.isVisible()) await final.click();
}

/* The question on screen is *rendered*, not printed: Kit.prompt draws a `___` as a
   real blank showing '?'. So match the way Race's lookup does, against the prompt
   with its gaps normalised — comparing to the raw string silently found nothing. */
const currentMillionaireAnswer = page => page.evaluate(() => {
  const q = document.getElementById('m-question').textContent;
  for (const u of window.UNITS){
    const hit = (u.millionaireBank||[]).find(i =>
      i.prompt === q || i.prompt.replace(/___+/g, '?') === q);
    if (hit) return hit.answer;
  }
  return null;
});

/* Ask the engine which games exist rather than listing them here. A hard-coded
   list is how a fifth game silently goes untested — the same failure the registry
   was built to end — so the layout contract finds the game, the way hasBank() and
   the content gate already do. Anything that registers is covered the day it does. */
const registeredGames = page => page.evaluate(() =>
  window.HubGames.ids().map(id => ({
    id, title: window.HubGames.get(id).title, stage: window.HubGames.get(id).stage })));

/* The layout contract every game owes the room, whatever its board is made of.
   Measured against the stage the registry names, so no per-game selector is
   needed and none can drift. */
async function stageReport(page, stage){
  return page.evaluate(sel => {
    const stageEl = document.getElementById(sel);
    if (!stageEl) return { missing:true };
    const floor = window.HubKit.floorTop();
    const kids  = [...stageEl.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
    // text that its own box cuts off: the box clips, and the content is wider
    const clipped = kids.filter(e => {
      const cs = getComputedStyle(e);
      if (!/hidden|clip/.test(cs.overflowX) && !/hidden|clip/.test(cs.overflowY)) return false;
      if (!e.textContent.trim()) return false;
      return e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2;
    });
    const withText = kids.filter(e =>
      [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    const tiny = withText.filter(e => parseFloat(getComputedStyle(e).fontSize) < 11);
    return {
      missing:false,
      offRight: Math.round(Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
      underBar: Math.round(Math.max(0, Math.max(...kids.map(e => e.getBoundingClientRect().bottom)) - floor)),
      clipped: clipped.length,
      clippedSample: clipped.length ? (clipped[0].className || clipped[0].tagName) + ' "' +
                     clipped[0].textContent.trim().slice(0, 18) + '"' : '',
      tiny: tiny.length,
      tinySample: tiny.length ? Math.round(parseFloat(getComputedStyle(tiny[0]).fontSize)) + 'px' : '',
      /* Chrome is whatever vertical space the board does not get: the header above
         it plus anything below the floor. Written this way it survived the team bar
         moving into the header and back out again — `innerHeight - floor` is the
         bar's height when there is a strip and zero when there is not. */
      chrome: Math.round(document.querySelector('header').getBoundingClientRect().height +
                         (window.innerHeight - floor)),
      header: Math.round(document.querySelector('header').getBoundingClientRect().height)
    };
  }, stage);
}

async function testBoardFitAcrossScreens(browser){
  section('Every registered game fits a computer screen');
  const probe = await openHub(browser);
  const games = await registeredGames(probe);
  await probe.close();

  for (const vp of [{width:1280,height:720},{width:1920,height:1080}]){
    for (const g of games){
      for (const sections of [1, 'all']){
        const page = await openHub(browser, vp);
        await startGame(page, g.title, { sections });
        const r = await stageReport(page, g.stage);
        const at = `${g.title} @ ${vp.width}x${vp.height} (${sections === 'all' ? 'all' : '1'} section)`;
        if (r.missing){ check(at + ': stage exists', false, g.stage + ' not found'); await page.close(); continue; }
        check(at + ': nothing below the floor', r.underBar === 0, r.underBar + 'px');
        check(at + ': nothing off the right edge', r.offRight === 0, r.offRight + 'px');
        /* The team bar moved into the header on the condition that the strip did
           not grow to hold it — the timer, Lab and New game paid for the room. A
           cap rather than an exact number, because the title wraps by unit name. */
        check(at + ': the header strip did not grow', r.header <= 120, r.header + 'px');
        check(at + ': no text is cut off', r.clipped === 0, r.clipped + '× e.g. ' + r.clippedSample);
        await page.close();
      }
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

  /* The trap this covers: change a value on "All games" while a per-game override
     already exists and nothing on the master row said so — the master read Off,
     a game kept its own value of On, and there was no way to see why short of
     clicking through every tab. The master row must name the game and jump to it. */
  await page.evaluate(() => {
    window.HubSettings.set('musicBed', 'off');
    window.HubSettings.set('musicBed', 'normal', 'millionaire');
  });
  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  await page.locator('.settings-tab', { hasText:'All games' }).click(); await page.waitForTimeout(150);
  const masterRow = page.locator('.settings-row', { hasText:'Think-music drone' });
  check('the master row names the game overriding it',
        /overridden in millionaire/i.test(await masterRow.innerText()),
        await masterRow.innerText());
  await masterRow.locator('.settings-undo').click(); await page.waitForTimeout(200);
  check('clicking the name jumps straight to that game\'s tab',
        (await page.locator('.settings-tab.on').innerText()).toLowerCase() === 'millionaire');
  check('and the row there confirms the override, matching what the master claimed',
        /set for this game/i.test(await page.locator('.settings-row', { hasText:'Think-music drone' }).innerText()));
  await page.locator('.settings-undo', { hasText:/match all games/i }).click(); await page.waitForTimeout(200);
  await page.locator('.settings-tab', { hasText:'All games' }).click(); await page.waitForTimeout(150);
  check('clearing the override removes the master-row warning',
        !/overridden/i.test(await masterRow.innerText()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);

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

async function testPerGameSettings(browser){
  section('Per-game settings');
  const page = await openHub(browser);

  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  const tabs = await page.locator('.settings-tab').allInnerTexts();
  check('a tab per game plus All games', tabs.length >= 5, tabs.join('|'));
  const masterRows = await page.locator('.settings-row').count();
  await page.locator('.settings-tab', { hasText:'Jeopardy' }).click(); await page.waitForTimeout(200);
  const jeoRows = await page.locator('.settings-row').count();
  check('a game tab shows only what applies to it', jeoRows > 0 && jeoRows < masterRows,
        jeoRows + ' of ' + masterRows);
  check('nothing is overridden to begin with',
        (await page.locator('.settings-state').allInnerTexts()).every(t => /matching/i.test(t)));
  await page.locator('#settings-close').click();

  // the whole point: off in one game, untouched in another
  await page.evaluate(() => window.HubSettings.set('cardFlip', 'off', 'blockbusters'));
  await page.reload(); await page.waitForTimeout(400);
  const read = g => page.evaluate(x => window.HubSettings.get('cardFlip', x), g);
  const master = await page.evaluate(() => window.HubSettings.get('cardFlip'));
  check('override survives reload', await read('blockbusters') === 'off');
  check('the other game is unaffected', await read('jeopardy') === master, await read('jeopardy'));
  check('the master value is unaffected', master !== 'off', master);

  // and it changes behaviour, not just storage
  await startGame(page, 'Blockbusters', { sections:'all' });
  await page.locator('.hex').first().click(); await page.waitForTimeout(150);
  check('override actually suppresses the animation',
        await page.evaluate(() => document.getElementById('clue-card').getAnimations().length) === 0);
  check('the card still opens', await page.locator('#clue-modal').isVisible());
  await page.locator('#skip-btn').click(); await page.waitForTimeout(300);

  await page.evaluate(() => window.HubSettings.clearOverride('cardFlip', 'blockbusters'));
  check('clearing an override falls back to master', await read('blockbusters') === master);

  // ⚙ during play opens the drawer for that game; the panel is one click further
  await startGame(page, 'Jeopardy', { sections:3 });
  await page.locator('#settings-btn').click(); await page.waitForTimeout(300);
  check('gear during play opens the drawer for the game being played',
        await page.locator('#lab-drawer.on').count() === 1 &&
        /jeopardy/i.test(await page.locator('#lab-title').innerText()),
        await page.locator('#lab-title').innerText());
  await page.locator('#lab-all').click(); await page.waitForTimeout(250);
  check('and its All games button lands the panel on that game\'s tab',
        /jeopardy/i.test(await page.locator('.settings-tab.on').innerText()));
  await page.locator('#settings-close').click();

  checkClean(page);
  await page.close();
}

/* Settings written before per-game scoping existed are flat keys. They are master
   values under the same names, so they must keep working untouched. */
/* The winning route ships as variants for the same reason the card flip does — so
   another way of showing it is a register() call, not a rewrite. Each must actually
   mark the route; only the animation differs. */
async function testWinRouteVariants(browser){
  section('Winning route variants');
  const page = await openHub(browser);
  const names = await page.evaluate(() => window.HubKit.anim.names('winRoute'));
  check('several route animations are registered', names.length >= 3, names.join(','));

  for (const name of names){
    await page.evaluate(n => window.HubSettings.set('bbWinRoute', n, 'blockbusters'), name);
    await startGame(page, 'Blockbusters', { sections:'all' });
    for (const c of [0,1,2,3,4]) await claimHexAt(page, 0, c, 0);
    await page.waitForTimeout(2500);
    const got = await page.evaluate(() => ({
      route:  document.querySelectorAll('.hex.route').length,
      banner: document.getElementById('result-modal').classList.contains('on')
    }));
    check(name + ': marks all five route hexes', got.route === 5, got.route + ' marked');
    check(name + ': the banner still lands', got.banner);
    await page.locator('#result-actions button.primary').click(); await page.waitForTimeout(400);
  }

  // reduced motion must not skip the answer, only the movement
  const reduced = await browser.newContext({ reducedMotion:'reduce' });
  const rp = await reduced.newPage();
  await rp.goto(page.url());
  await rp.waitForTimeout(300);
  await rp.evaluate(() => window.HubSettings.set('bbWinRoute', 'trace', 'blockbusters'));
  await startGame(rp, 'Blockbusters', { sections:'all' });
  for (const c of [0,1,2,3,4]) await claimHexAt(rp, 0, c, 0);
  await rp.waitForTimeout(1200);
  check('reduced motion still shows the route',
        await rp.locator('.hex.route').count() === 5 &&
        await rp.locator('#result-modal.on').count() === 1);
  await reduced.close();

  await page.evaluate(() => window.HubSettings.clearOverride('bbWinRoute', 'blockbusters'));
  checkClean(page);
  await page.close();
}

/* The game show skin is a second look for the same markup. What matters is that it
   is genuinely opt-in (the DCU default must be untouched), that it comes off when
   you leave the game, and that the title sequence can always be got out of. */
async function testGameShow(browser){
  section('Game show mode');
  const page = await openHub(browser);

  // game show is the default, so what needs guarding is that DCU still strips it
  await page.evaluate(() => { window.HubSettings.set('theme','dcu','millionaire');
                              window.HubSettings.set('intro','off','millionaire'); });
  await startGame(page, 'Millionaire', { sections:'all' });
  check('DCU strips the skin completely',
        await page.evaluate(() => !document.body.classList.contains('theme-gameshow') &&
                                  !document.getElementById('play-millionaire').classList.contains('lit')));
  check('and plays no title sequence', await page.locator('#intro-overlay.on').count() === 0);

  await page.evaluate(() => {
    window.HubSettings.set('theme', 'gameshow', 'millionaire');
    window.HubSettings.set('intro', 'every', 'millionaire');
  });
  await startGame(page, 'Millionaire', { sections:'all', keepIntro:true });
  check('the skin goes on with the game', await page.evaluate(() => document.body.classList.contains('theme-gameshow')));
  check('the title sequence plays', await page.locator('#intro-overlay.on').count() === 1);
  check('the title sequence names the game',
        (await page.locator('#intro-title').textContent()).trim() === 'MILLIONAIRE');

  // Escape belongs to the settings panel, so it must not double as the skip key
  await page.keyboard.press('Escape'); await page.waitForTimeout(220);
  check('Escape does not skip the titles', await page.locator('#intro-overlay.on').count() === 1);
  await page.keyboard.press('Space'); await page.waitForTimeout(280);
  check('any other key skips the titles', await page.locator('#intro-overlay.on').count() === 0);

  // one number drives the lights and the music, and it climbs with the ladder
  const low = await page.evaluate(() => document.getElementById('play-millionaire').style.getPropertyValue('--tension'));
  check('the stage is lit and starts slack', parseFloat(low) === 0, low);
  for (let i = 0; i < 8; i++){
    const next = page.locator('#m-next');
    if (await next.isVisible().catch(()=>false)){ await next.click(); await page.waitForTimeout(240); continue; }
    if (!(await answerCorrectly(page))) break;
    if (parseFloat(await tension(page)) >= 0.28) break;
  }
  const high = await tension(page);
  check('tension climbs with the rung', parseFloat(high) > parseFloat(low), low + ' → ' + high);

  // the skin now covers the setup screens too, so leaving a game must NOT strip it
  await page.locator('#new-game-btn').click(); await page.waitForTimeout(300);
  check('the skin stays on the setup screens',
        await page.evaluate(() => document.body.classList.contains('theme-gameshow')));
  check('but the play stage is no longer lit',
        await page.evaluate(() => !document.getElementById('play-millionaire').classList.contains('lit')));

  // "once per session" must mean once
  await page.evaluate(() => window.HubSettings.set('intro', 'once', 'millionaire'));
  await startGame(page, 'Millionaire', { sections:'all', keepIntro:true });
  await page.keyboard.press('Space'); await page.waitForTimeout(250);
  await startGame(page, 'Millionaire', { sections:'all', keepIntro:true });
  check('once per session plays it once', await page.locator('#intro-overlay.on').count() === 0);

  await page.evaluate(() => window.HubSettings.set('intro', 'off', 'millionaire'));
  await startGame(page, 'Millionaire', { sections:'all', keepIntro:true });
  check('off means off', await page.locator('#intro-overlay.on').count() === 0);

  // the whole skin runs on the Web Audio bed; muting must not break the game
  await page.evaluate(() => window.HubSettings.set('sound', false));
  await startGame(page, 'Millionaire', { sections:'all' });
  await playMillionaireOption(page, page.locator('#m-options .m-option'));
  await page.waitForTimeout(1200);
  check('muted, the game still scores', (await page.locator('#m-hint').innerText()).length > 0);

  await page.evaluate(() => {
    window.HubSettings.clearOverride('theme', 'millionaire');
    window.HubSettings.clearOverride('intro', 'millionaire');
    window.HubSettings.clearOverride('mLifelines', 'millionaire');
    window.HubSettings.set('sound', true);
  });
  checkClean(page);
  await page.close();
}

/* Jeopardy's ident. Same skin machinery, a different signature: a starfield board
   that deals itself in, and tension driven by what's at stake on the tile in play
   rather than by a ladder. */
async function testGameShowJeopardy(browser){
  section('Game show — Jeopardy');
  const page = await openHub(browser);
  const stress = () => page.evaluate(() =>
    document.getElementById('play-jeopardy').style.getPropertyValue('--tension'));

  await page.evaluate(() => window.HubSettings.set('theme','dcu','jeopardy'));
  await startGame(page, 'Jeopardy', { sections:'all' });
  check('DCU strips the skin completely',
        await page.evaluate(() => !document.getElementById('play-jeopardy').classList.contains('lit')));

  await page.evaluate(() => {
    window.HubSettings.set('theme', 'gameshow', 'jeopardy');
    window.HubSettings.set('intro', 'every', 'jeopardy');
  });
  await startGame(page, 'Jeopardy', { sections:'all', keepIntro:true });
  check('the titles name this game',
        (await page.locator('#intro-title').textContent()).trim() === 'JEOPARDY');
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  check('the board deals itself in', await page.locator('#board.dealing').count() === 1);
  /* A flat stagger over this board runs for three seconds with the class waiting on
     it; the diagonal caps the wave at rows+columns. Assert the thing that actually
     matters — how long the deal takes — rather than a step count, which moves every
     time a category is added. */
  const deal = await page.evaluate(() => {
    const kids = [...document.getElementById('board').children];
    const step = Math.max(...kids.map(k => +k.style.getPropertyValue('--i') || 0));
    const cs   = getComputedStyle(kids[kids.length-1]);
    return { step, cells: kids.length, ms: step * parseFloat(cs.animationDelay) / (step || 1) * step };
  });
  check('the deal is a diagonal wave, not a queue', deal.step < deal.cells / 2,
        deal.step + ' steps for ' + deal.cells + ' cells');
  check('and the whole board is dealt inside a second',
        deal.step * 46 + 420 <= 1400, Math.round(deal.step * 46 + 420) + 'ms');
  await page.waitForTimeout(1500);
  check('the stage is lit', await page.evaluate(() => document.getElementById('play-jeopardy').classList.contains('lit')));

  // what is at stake drives the lights: the cheapest tile is the coolest moment
  const rest = await stress();
  await page.locator('#board .tile', { hasText:/^\$100$/ }).first().click();
  await page.waitForTimeout(1350);
  const low = await stress();
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(160);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(1700);
  await page.locator('#board .tile:not(.used)', { hasText:/^\$500$/ }).first().click();
  await page.waitForTimeout(1350);
  const high = await stress();
  check('a dearer tile raises the tension', parseFloat(high) > parseFloat(low),
        'rest ' + rest + ', $100 ' + low + ', $500 ' + high);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(160);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(1700);
  check('the lights drop back once the card is away', parseFloat(await stress()) < parseFloat(high));

  await page.evaluate(() => {
    window.HubSettings.clearOverride('theme', 'jeopardy');
    window.HubSettings.clearOverride('intro', 'jeopardy');
  });
  checkClean(page);
  await page.close();
}

/* Blockbusters' ident. Its tension has no ladder and no tile value behind it —
   it is how close anybody is to a finished line, which is the thing this game
   actually gets tense about. */
async function testGameShowBlockbusters(browser){
  section('Game show — Blockbusters');
  const page = await openHub(browser);
  const stress = () => page.evaluate(() =>
    document.getElementById('play-blockbusters').style.getPropertyValue('--tension'));

  await page.evaluate(() => window.HubSettings.set('theme','dcu','blockbusters'));
  await startGame(page, 'Blockbusters', { sections:'all' });
  check('DCU strips the skin completely',
        await page.evaluate(() => !document.getElementById('play-blockbusters').classList.contains('lit')));

  await page.evaluate(() => {
    window.HubSettings.set('theme', 'gameshow', 'blockbusters');
    window.HubSettings.set('intro', 'every', 'blockbusters');
  });
  await startGame(page, 'Blockbusters', { sections:'all', keepIntro:true });
  check('the titles name this game',
        (await page.locator('#intro-title').textContent()).trim() === 'BLOCKBUSTERS');
  await page.keyboard.press('Space'); await page.waitForTimeout(180);
  check('the honeycomb assembles itself', await page.locator('#hexwrap.dealing').count() === 1);
  await page.waitForTimeout(1500);
  check('the stage is lit', await page.evaluate(() => document.getElementById('play-blockbusters').classList.contains('lit')));
  check('an untouched board is slack', parseFloat(await stress()) === 0, await stress());

  // blue walks down the middle; every hex it takes should raise the temperature
  const seen = [];
  for (const r of [0,1,2]){
    await claimHexAt(page, r, 2, 1);
    await page.waitForTimeout(900);            // the lights change once the card lands
    seen.push(parseFloat(await stress()));
  }
  check('tension climbs as a line comes into reach',
        seen[0] > 0 && seen[1] > seen[0] && seen[2] > seen[1], seen.join(' → '));
  check('one hex from a win is as tense as it gets', seen[2] === 1, String(seen[2]));

  await claimHexAt(page, 3, 2, 1);
  await page.waitForTimeout(2600);
  const win = await page.evaluate(() => {
    const first = document.querySelector('.hex.route');
    return {
      banner: document.getElementById('result-modal').classList.contains('on'),
      route:  document.querySelectorAll('.hex.route').length,
      glow:   first ? getComputedStyle(first).filter : '',
      border: getComputedStyle(document.getElementById('result-card')).borderTopColor
    };
  });
  check('the winning route still lights up under the skin', win.route === 4 && win.banner,
        JSON.stringify(win));
  // the skin's own hex rules out-specify .route unless the route rules are scoped too
  check('the skin does not cancel the route glow', /drop-shadow/.test(win.glow), win.glow);
  // and setting border-color on the themed card would paint a blue win gold
  check('the banner takes the winning team\'s colour', win.border === 'rgb(0, 160, 223)', win.border);

  await page.evaluate(() => {
    window.HubSettings.clearOverride('theme', 'blockbusters');
    window.HubSettings.clearOverride('intro', 'blockbusters');
  });
  checkClean(page);
  await page.close();
}

/* Race's ident. Its tension is the only one of the four with two ingredients: how
   much of the board is gone, and whether a race is live this second. */
async function testGameShowRace(browser){
  section('Game show — Race to the Board');
  const page = await openHub(browser);
  const stress = () => page.evaluate(() =>
    document.getElementById('play-race').style.getPropertyValue('--tension'));

  await page.evaluate(() => window.HubSettings.set('theme','dcu','race'));
  await startGame(page, 'Race to the Board', { sections:'all' });
  check('DCU strips the skin completely',
        await page.evaluate(() => !document.getElementById('play-race').classList.contains('lit')));

  await page.evaluate(() => {
    window.HubSettings.set('theme', 'gameshow', 'race');
    window.HubSettings.set('intro', 'every', 'race');
  });
  await startGame(page, 'Race to the Board', { sections:'all', keepIntro:true });
  check('the titles name this game',
        (await page.locator('#intro-title').textContent()).trim() === 'RACE TO THE BOARD');
  // four words at the shared 11vw cap would run off the screen. Measure only once
  // the slam has landed: it holds at scale(2.4) through its delay, so a rect taken
  // early reports the title two and a half times its real width.
  await page.waitForTimeout(1400);
  const title = await page.evaluate(() => ({
    w: Math.round(document.getElementById('intro-title').getBoundingClientRect().width),
    vw: window.innerWidth
  }));
  check('a four-word title still fits the screen', title.w < title.vw, title.w + ' of ' + title.vw);

  // the deal starts when the titles end, and lasts 1.6s — check it promptly
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  check('the words fly in', await page.locator('#race-words.dealing').count() === 1);
  await page.waitForTimeout(1500);
  check('the stage is lit', await page.evaluate(() => document.getElementById('play-race').classList.contains('lit')));

  const idle = parseFloat(await stress());
  check('an untouched board with no sentence up is slack', idle === 0, String(idle));
  await page.locator('#race-start').click(); await page.waitForTimeout(600);
  const live = parseFloat(await stress());
  check('a live sentence lifts the lights on its own', live > idle, idle + ' → ' + live);
  check('and marks the stage as running', await page.locator('#play-race.running').count() === 1);

  for (let i = 0; i < 3; i++){
    const word = await currentRaceAnswer(page);
    if (!word) break;
    await page.locator('.race-word', { hasText: new RegExp('^' + word + '$','i') }).first().click();
    await page.waitForTimeout(220);
    if (await page.locator('#race-claim .claim-team').first().isVisible().catch(()=>false))
      await page.keyboard.press('1');
    await page.waitForTimeout(700);
  }
  const later = parseFloat(await stress());
  check('clearing the board raises it further', later > live, live + ' → ' + later);

  await page.evaluate(() => {
    window.HubSettings.clearOverride('theme', 'race');
    window.HubSettings.clearOverride('intro', 'race');
  });
  checkClean(page);
  await page.close();
}

/* ---- content integrity ----
   The banks have constraints that no amount of engine testing would catch, and
   breaking one produces a board that looks fine and plays wrong: a Blockbusters
   answer whose initial doesn't match its hexagon, two Race items competing for
   one tile, a Millionaire rung with no question behind it.

   It also enforces the rule per-game authoring exists for (spec §3.2): **no prompt
   may appear in two banks**. An audit found 21 copy-pasted across 2-4 banks, nearly
   all word transformations added during the vary-the-forms pass. Sharing an *answer*
   between games is the design working; sharing a *prompt* is the thing it avoids.
   Runs over every unit loaded in the hub, so a new unit is checked for free. */
async function testContentIntegrity(browser){
  section('Content integrity');
  const page = await openHub(browser);

  const report = await page.evaluate(() => {
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
    const out = [];
    (window.UNITS || []).forEach(u => {
      const id = u.id || '?';
      const banks = { jeopardy:[], blockbusters:[], race:[], millionaire:[] };
      (u.jeopardyCategories||[]).forEach(c => c.clues.forEach(x => banks.jeopardy.push({ p:x.q, a:x.a, section:c.section })));
      (u.blockbustersBank||[]).forEach(x => banks.blockbusters.push({ p:x.clue, a:x.answer, section:x.section, letter:x.letter }));
      (u.raceBank||[]).forEach(x => banks.race.push({ p:x.prompt, a:x.answer, section:x.section }));
      (u.millionaireBank||[]).forEach(x => banks.millionaire.push({ p:x.prompt, a:x.answer, section:x.section, level:x.level, distractors:x.distractors }));

      // a prompt in two banks
      const where = new Map();
      Object.keys(banks).forEach(b => banks[b].forEach(i => {
        const k = norm(i.p); if(!where.has(k)) where.set(k, new Set()); where.get(k).add(b);
      }));
      where.forEach((set, k) => { if(set.size > 1)
        out.push({kind:'dupe', msg:id + ': prompt in ' + [...set].join(' + ') + ' — "' + k.slice(0,60) + '"'}); });

      // Jeopardy: equal-length categories, sections contiguous (or a heading prints twice)
      const cats = u.jeopardyCategories || [];
      const lens = new Set(cats.map(c => c.clues.length));
      if(cats.length && lens.size > 1) out.push({kind:'jeopardy', msg:id + ': categories differ in length — ' + [...lens].join('/')});
      const secs = cats.map(c => c.section);
      secs.forEach((s, i) => { if(i && s !== secs[i-1] && secs.slice(0, i).indexOf(s) !== -1)
        out.push({kind:'jeopardy', msg:id + ': jeopardy section ' + s + ' is not contiguous'}); });

      // Blockbusters: one word, and the hexagon's letter is its initial
      banks.blockbusters.forEach(i => {
        if(/\s/.test(String(i.a).trim())) out.push({kind:'blockbusters', msg:id + ': answer is not one word — ' + i.a});
        if(String(i.a)[0].toUpperCase() !== String(i.letter).toUpperCase())
          out.push({kind:'blockbusters', msg:id + ': letter ' + i.letter + ' does not match ' + i.a});
      });

      // Race: answers become tiles, so one word and never repeated
      const tiles = new Set();
      banks.race.forEach(i => {
        if(/\s/.test(String(i.a).trim())) out.push({kind:'race', msg:id + ': answer is not one word — ' + i.a});
        const k = norm(i.a);
        if(tiles.has(k)) out.push({kind:'race', msg:id + ': answer would need two tiles — ' + i.a});
        tiles.add(k);
      });

      // Millionaire: three real distractors, and every rung reachable in every section
      banks.millionaire.forEach(i => {
        if(!i.distractors || i.distractors.length !== 3)
          out.push({kind:'millionaire', msg:id + ': needs 3 distractors — "' + String(i.p).slice(0,40) + '"'});
        if(i.distractors && i.distractors.indexOf(i.a) !== -1)
          out.push({kind:'millionaire', msg:id + ': distractor repeats the answer — "' + String(i.p).slice(0,40) + '"'});
        if(!(i.level >= 1 && i.level <= 8)) out.push({kind:'millionaire', msg:id + ': level out of range — ' + i.level});
      });
      const mSecs = [...new Set(banks.millionaire.map(i => i.section))];
      mSecs.forEach(s => {
        const have = new Set(banks.millionaire.filter(i => i.section === s).map(i => i.level));
        for(let r = 1; r <= 8; r++) if(!have.has(r)) out.push({kind:'millionaire', msg:id + ': ' + s + ' has no rung ' + r});
      });

      // the content screen quotes these counts, so they must not drift
      [['blockbustersSectionNames', banks.blockbusters],
       ['raceSectionNames',         banks.race],
       ['millionaireSectionNames',  banks.millionaire]].forEach(([key, arr]) => {
        Object.keys(u[key] || {}).forEach(sec => {
          const m = String(u[key][sec]).match(/\((\d+)/);
          if(!m) return;
          const actual = arr.filter(i => i.section === sec).length;
          if(actual !== +m[1])
            out.push({kind:'counts', msg:id + ': ' + key + ' ' + sec + ' says ' + m[1] + ' but the bank holds ' + actual});
        });
      });
    });
    return { problems: out, units: (window.UNITS||[]).length };
  });

  const of = k => report.problems.filter(p => p.kind === k);
  const first = k => (of(k)[0] || {}).msg;
  check('every unit loaded', report.units > 0, report.units + ' units');
  check('no prompt appears in two banks',        !of('dupe').length,         first('dupe'));
  check('Blockbusters answers are one word, keyed by their initial',
        !of('blockbusters').length, first('blockbusters'));
  check('Race answers are one word and unique enough to be tiles',
        !of('race').length,         first('race'));
  check('Millionaire has 3 distractors and every rung in every section',
        !of('millionaire').length,  first('millionaire'));
  check('Jeopardy categories are equal length and grouped by section',
        !of('jeopardy').length,     first('jeopardy'));
  check('the counts on the content screen match the banks',
        !of('counts').length,       first('counts'));

  if(report.problems.length) console.log('    ' + report.problems.length + ' problem(s):\n      ' +
    report.problems.slice(0, 14).map(p => p.msg).join('\n      '));

  checkClean(page);
  await page.close();
}

/* Game show is what a teacher gets without touching a setting, and it now covers
   the setup screens as well as the boards. Both are easy to regress silently: a
   default flipped back, or a screen left unskinned so the app flashes white between
   choosing a unit and playing. */
/* ---- topic picking ----
   Jeopardy always offered named categories; the other three offered only "5A",
   which bundled 25 crime words with 9 relative pronouns and no way to pick the
   half you taught. Items now carry a `topic` and the picker groups on it.

   The assertion that matters most is the last one: every bank filter must select
   on the same key the picker hands out. One filter was left keyed to `section`
   and the ladder silently drew from nothing. */
async function testTopicPicking(browser){
  section('Topic picking');
  const page = await openHub(browser);
  await page.evaluate(() => window.HubSettings.set('intro','off'));

  const openPicker = async game => {
    // reload rather than walk back: the content screen has no route to the game
    // list, and settings live in storage so nothing is lost by starting over
    await page.goto(BASE + '/game-hub.html'); await page.waitForTimeout(300);
    await page.getByText('Unit 5', { exact:false }).first().click(); await page.waitForTimeout(180);
    await page.locator('h3:visible', { hasText: game }).first().click(); await page.waitForTimeout(250);
    return page.locator('#content-list .cat-check').allInnerTexts();
  };

  for (const game of ['Race to the Board', 'Blockbusters', 'Millionaire']){
    const rows = await openPicker(game);
    /* Not every game splits every section: Blockbusters has no relative-clause
       topic because its answers must be single words keyed to a hexagon letter,
       and a pronoun cannot be that. So assert the general property — some section
       offers two strands — rather than naming one that only suits two games. */
    const bySection = {};
    rows.forEach(r => { const m = r.match(/(\d[A-D])/); if(m) bySection[m[1]] = (bySection[m[1]]||0) + 1; });
    check(game + ': at least one section is split into its two strands',
          Object.values(bySection).some(n => n > 1), rows.join(' / '));
    check(game + ': each topic shows how much is in it',
          rows.every(r => /\(\d+\)/.test(r)), rows.find(r => !/\(\d+\)/.test(r)) || '');
  }

  /* Pick one narrow topic and confirm the game either builds from exactly that
     topic or refuses with a reason — never builds an empty board. */
  await openPicker('Race to the Board');
  await page.locator('#content-list .cat-check', { hasText:'Relative clauses' }).locator('input').check();
  await page.waitForTimeout(200);
  const narrow = await page.locator('#start-btn').innerText();
  check('one small topic is refused with a reason, not silently broken',
        await page.locator('#start-btn').isDisabled() && /need|add/i.test(narrow), narrow);

  await page.locator('#content-list .cat-check', { hasText:'Crime & justice' }).locator('input').check();
  await page.waitForTimeout(200);
  check('adding a second topic makes it playable',
        !(await page.locator('#start-btn').isDisabled()), await page.locator('#start-btn').innerText());
  await page.locator('#start-btn').click(); await page.waitForTimeout(900);
  const words = (await page.locator('.race-word').allInnerTexts()).map(w => w.toLowerCase());
  check('the board is built only from the topics ticked', words.length > 0 && await page.evaluate(ws => {
    const want = new Set(['5A-grammar','5A-vocab']);
    // look the word up in the unit being played only — Race answers are unique
    // within a unit but not across them, so searching every unit finds the wrong
    // item and calls a perfectly good board foreign
    const u = window.UNITS.find(x => x.id === 'unit-5');
    return ws.every(w => {
      const hit = (u.raceBank||[]).find(i => i.answer.toLowerCase() === w);
      return !hit || want.has(hit.topic);
    });
  }, words), words.slice(0,6).join(','));

  /* Millionaire is the one that failed silently: its per-rung filter was keyed to
     section while the picker handed out topics, so the ladder drew from nothing. */
  await openPicker('Millionaire');
  const boxes = page.locator('#content-list input');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  await page.waitForTimeout(250);
  await page.locator('#start-btn').click(); await page.waitForTimeout(900);
  check('Millionaire still fills a ladder when picked by topic',
        await page.locator('.m-option').count() === 4,
        String(await page.locator('.m-option').count()));

  checkClean(page);
  await page.close();
}

async function testDefaultLook(browser){
  section('Default look');
  const page = await openHub(browser);

  check('game show is the default', await page.evaluate(() => window.HubSettings.get('theme')) === 'gameshow');
  check('the very first screen is already skinned',
        await page.evaluate(() => document.body.classList.contains('theme-gameshow')));

  // the icons preview each game's mechanic, so every card must actually be moving
  await page.getByText('Unit 5', { exact:false }).first().click();
  await page.waitForTimeout(300);
  const icons = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.game-card').forEach(c => {
      out[c.dataset.game] = [...c.querySelectorAll('.game-icon *')]
        .map(k => getComputedStyle(k).animationName).filter(n => n !== 'none').length;
    });
    return out;
  });
  Object.keys(icons).forEach(g =>
    check(g + "'s icon animates", icons[g] > 0, icons[g] + ' animated parts'));

  // walking the whole setup flow must never drop back to the white theme
  const themed = () => page.evaluate(() => document.body.classList.contains('theme-gameshow'));
  await page.locator('h3:visible', { hasText:'Jeopardy' }).first().click();
  await page.waitForTimeout(250);
  check('the section-picking screen stays skinned', await themed());
  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  check('the settings panel is skinned too',
        await page.evaluate(() => getComputedStyle(document.getElementById('settings-card')).backgroundColor)
          !== 'rgb(255, 255, 255)');
  await page.locator('#settings-close').click(); await page.waitForTimeout(150);

  // and DCU still turns the whole thing off, everywhere
  await page.evaluate(() => window.HubSettings.set('theme', 'dcu'));
  await page.waitForTimeout(250);
  check('choosing DCU unskins the setup screens', !(await themed()));
  await page.evaluate(() => window.HubSettings.set('theme', 'gameshow'));
  await page.waitForTimeout(200);
  check('and switching back re-skins them without a reload', await themed());

  checkClean(page);
  await page.close();
}

/* ---- the game registry ----
   The promise is that a new game declares itself once and inherits everything
   shared, with no engine edits. That is only true if it is true, so this test
   registers a throwaway fifth game at runtime and checks what it gets for free —
   and, just as importantly, that omitting the optional hooks doesn't throw. */
async function testGameRegistry(browser){
  section('Game registry');
  const page = await openHub(browser);

  const shape = await page.evaluate(() => ({
    ids: window.HubGames.ids(),
    titles: Object.keys(window.HUB_GAME_TITLES),
    hooks: window.HubGames.hooksOf('jeopardy')
  }));
  /* Not a count. A hard-coded four failed the day a fifth game was added, which is
     the one thing this suite should never do — the registry is the source of truth
     and the test's job is that the built-ins are all in it. */
  ['jeopardy','blockbusters','race','millionaire','bingo']
    .forEach(id => check(id + ' is registered', shape.ids.indexOf(id) !== -1, shape.ids.join(',')));
  check('settings tab labels come from the registry',
        shape.titles.length === shape.ids.length, shape.titles.join(','));
  ['load','hasBank','renderContent','startButton','start','fit','deal','tension','onResize','onTimerEnd']
    .forEach(h => check('the contract exposes ' + h + '()', shape.hooks.indexOf(h) !== -1));
  /* The phone half of the contract. These were `if (activeGame === …)` chains in
     four functions until a fifth game proved they had to be hooks: every phone
     dynamic reaches every board through exactly these. */
  ['expects','phonePrompt','askingNow','buzzEntitled','onBuzzTaken','onTypedWin','wantsVote','onVoteReply','roomNote','phoneRound']
    .forEach(h => check('the phone contract exposes ' + h + '()', shape.hooks.indexOf(h) !== -1));
  /* And it has to be answered, not merely present: a game that leaves these at
     their defaults has idle phones, which is a correct state but not a wired one. */
  const answered = await page.evaluate(() => {
    const out = {};
    window.HubGames.ids().forEach(id => {
      const g = window.HubGames.get(id);
      out[id] = ['expects','phonePrompt','askingNow'].filter(h => g[h].toString().indexOf("return ''") === -1
                                                              && g[h].toString().indexOf('return false') === -1).length;
    });
    return out;
  });
  Object.keys(answered).forEach(id => check(id + ' answers the phone contract itself',
    answered[id] === 3, id + ': ' + answered[id] + '/3'));

  // a bare-minimum game: an id and a bank, nothing else
  const bare = await page.evaluate(() => {
    window.HubGames.register({
      id:'testgame', title:'Test Game',
      card:{ icon:'<svg class="game-icon" viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="24"/></svg>',
             blurb:'A game that implements nothing.', badge:'Best for: proving the defaults' },
      hasBank: u => !!(u.jeopardyCategories || []).length
    });
    window.HubGames.renderCards();
    return {
      registered: window.HubGames.ids().indexOf('testgame') !== -1,
      titled: window.HUB_GAME_TITLES.testgame,
      card: !!document.querySelector('.game-card[data-game="testgame"]')
    };
  });
  check('a new game registers with only an id and a bank', bare.registered);
  check('and gets a settings tab label', bare.titled === 'Test Game');
  check('and a card on the game screen', bare.card);

  // the no-op defaults must survive being driven
  const drove = await page.evaluate(() => {
    const g = window.HubGames.get('testgame');
    try {
      g.load({}); g.renderContent(document.createElement('div'), document.createElement('div'));
      g.startButton(document.createElement('button'));
      g.start(); g.fit(); g.deal(); g.tension(); g.onResize(); g.onTimerEnd();
      return 'ok';
    } catch(e){ return String(e); }
  });
  check('every unimplemented hook is a safe no-op', drove === 'ok', drove);

  /* ---- the template reaches a game registered *after* the settings block ----
     Every shared setting used to be registered with `games: gameIds()`, which is a
     snapshot taken when the settings ran — near the top of hub-engine.js, before a
     fifth game existed. So Bingo was silently absent from phoneMode, phonePrompt,
     theme, intro and sound: its ⚙ and its Lab were quietly narrower than every
     other game's, and because no phone mode could be set for it, no room ever
     opened and the join code never appeared. Reported as "the new game's format is
     different". `games:'*'` asks the registry instead, so this is now true for a
     game registered at any point — which is what `testgame` proves here, having
     registered long after the settings did. */
  const SHARED = ['phoneMode','phonePrompt','sound','soundVolume','theme','intro'];
  const offered = await page.evaluate(list => {
    const out = {};
    window.HubGames.ids().forEach(g => {
      const host = document.createElement('div');
      window.HubSettings.renderFor(host, g);
      out[g] = list.filter(id => !!host.querySelector('[data-setting="' + id + '"]'));
    });
    return out;
  }, SHARED);
  Object.keys(offered).forEach(g => {
    check(g + ' is offered every shared setting',
          offered[g].length === SHARED.length,
          g + ': ' + offered[g].join(',') + ' (want ' + SHARED.join(',') + ')');
  });

  // and it inherits the shared furniture without asking for any of it
  const inherits = await page.evaluate(() => ({
    skin:    document.body.classList.contains('theme-gameshow'),
    teambar: !!document.getElementById('scorebar'),
    timer:   !!document.getElementById('tmr-display'),
    banner:  !!document.getElementById('result-card'),
    kit:     typeof window.HubKit.fitToScreen === 'function',
    floor:   typeof window.HubKit.floorTop === 'function'
  }));
  check('a new game inherits the skin, team bar, timer, banner and kit',
        Object.values(inherits).every(Boolean), JSON.stringify(inherits));

  /* Where the team bar lives is a layer-1 fact every game depends on, so pin it.
     It is a fixed strip under the board — the header is the teacher's instruments,
     the bar is the game's state and the room reads it. What matters is not the
     choice but that `Kit.floorTop()` agrees with it: every board sizes itself to
     that number, so a bar the floor does not know about is a bar the boards run
     underneath. */
  const barPlace = await page.evaluate(() => {
    const bar = document.getElementById('scorebar');
    const hdr = document.querySelector('header');
    return { belowHeader: !hdr.contains(bar),
             fixed: getComputedStyle(bar).position === 'fixed',
             atTheFoot: Math.abs(bar.getBoundingClientRect().bottom - window.innerHeight) < 1,
             floorIsTheBar: Math.abs(window.HubKit.floorTop() -
                                     bar.getBoundingClientRect().top) < 1 };
  });
  check('the team bar is a fixed strip under the board, and the floor knows it',
        Object.values(barPlace).every(Boolean), JSON.stringify(barPlace));

  checkClean(page);
  await page.close();
}

/* ---- question forms ----
   Kit.prompt makes a question's *form* something every game can draw, the way
   Kit.anim did for animations. The two properties worth guarding are the ones that
   make it adoptable: content authored before it existed must render unchanged, and
   a type must be able to say which games it suits. */
async function testPromptTypes(browser){
  section('Question forms');
  const page = await openHub(browser);

  check('a type registry exists', await page.evaluate(() => typeof window.HubKit.prompt.register) === 'function');
  check('the gap form is registered',
        (await page.evaluate(() => window.HubKit.prompt.types())).indexOf('gap') !== -1);

  // an unlabelled prompt containing ___ is recognised without being labelled, which
  // is what lets hundreds of existing items gain a real blank with no edits
  const inferred = await page.evaluate(() => {
    const el = document.createElement('div');
    window.HubKit.prompt.render(el, { text:'The jury returned a ___ of not guilty.', answer:'verdict' });
    return { type: el.dataset.promptType, blanks: el.querySelectorAll('.prompt-gap').length };
  });
  check('an untyped prompt with ___ is drawn as a gap', inferred.type === 'gap' && inferred.blanks === 1,
        JSON.stringify(inferred));

  const plain = await page.evaluate(() => {
    const el = document.createElement('div');
    const t = window.HubKit.prompt.render(el, { text:'The formal word for a crime.', answer:'offence' });
    return { t, text: el.textContent, blanks: el.querySelectorAll('.prompt-gap').length };
  });
  check('a prompt with no gap still renders as plain text',
        plain.t === null && plain.blanks === 0 && /formal word/.test(plain.text), JSON.stringify(plain));

  // filling: one blank takes the answer; two blanks and two words take one each
  const fills = await page.evaluate(() => {
    const run = (text, answer) => {
      const el = document.createElement('div');
      window.HubKit.prompt.render(el, { text, answer });
      const ms = window.HubKit.prompt.reveal(el, { text, answer });
      return { ms, out: el.textContent };
    };
    return {
      one:  run("being 'held in ___'.", 'custody'),
      two:  run("You ___ ___ be early tomorrow!", 'had better'),
      same: run("it slipped my ___ and it crossed my ___", 'Mind'),
      long: run("Correct it: 'He was made redundancy.' ___", 'he was made REDUNDANT (adjective)')
    };
  });
  check('one blank takes the whole answer', /held in custody/.test(fills.one.out), fills.one.out);
  check('two blanks and two words take one each', /You had better be early/.test(fills.two.out), fills.two.out);
  check('two blanks and one word repeat it', (fills.same.out.match(/Mind/g) || []).length === 2, fills.same.out);
  check('an answer too long for a blank is declined, not crammed in',
        fills.long.ms === 0, 'returned ' + fills.long.ms);

  // a type can rule itself out of a game whose board would give it away
  const gated = await page.evaluate(() => {
    window.HubKit.prompt.register('testonly', {
      games: ['jeopardy'],
      render(mount){ mount.textContent = 'RENDERED'; }
    });
    const yes = document.createElement('div'), no = document.createElement('div');
    window.HubKit.prompt.render(yes, { type:'testonly', text:'x' }, 'jeopardy');
    window.HubKit.prompt.render(no,  { type:'testonly', text:'x' }, 'millionaire');
    return { yes: yes.textContent, no: no.textContent,
             suitsJ: window.HubKit.prompt.suits('testonly','jeopardy'),
             suitsM: window.HubKit.prompt.suits('testonly','millionaire') };
  });
  check('a type renders in a game it suits', gated.yes === 'RENDERED' && gated.suitsJ);
  check('and falls back to text in one it does not', gated.no === 'x' && !gated.suitsM,
        JSON.stringify(gated));

  /* Each form draws the task rather than describing it: scattered letters mean
     unscramble, chips mean pick the odd one, a struck word means find the mistake.
     Assert the shape, the answer landing, and — for each — that it declines to
     plain text rather than rendering nonsense when the item isn't shaped for it. */
  const forms = await page.evaluate(() => {
    const run = (item, game) => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const type = window.HubKit.prompt.render(el, item, game);
      const before = { type, tiles: el.querySelectorAll('.prompt-tile').length,
                       chips: el.querySelectorAll('.prompt-chip').length,
                       errors: el.querySelectorAll('.prompt-error').length,
                       text: el.textContent };
      const ms = window.HubKit.prompt.reveal(el, item);
      const after = { ms, text: el.textContent, marked: el.classList.contains('prompt-revealed'),
                      odd: el.querySelectorAll('.prompt-chip.odd').length,
                      dim: el.querySelectorAll('.prompt-chip.belongs').length,
                      fixed: el.querySelectorAll('.prompt-error.fixed').length };
      el.remove();
      return { before, after };
    };
    return {
      anagram:  run({ type:'anagram', text:'The jury decision.', answer:'verdict' }, 'jeopardy'),
      anaLong:  run({ type:'anagram', text:'A long one.', answer:'beyond a doubt' }, 'jeopardy'),
      anaGated: run({ type:'anagram', text:'Given away by the options.', answer:'verdict' }, 'millionaire'),
      odd:      run({ type:'oddoneout', text:'Which does NOT belong: verdict / jury / sabbatical',
                      answer:'sabbatical' }, 'jeopardy'),
      oddBad:   run({ type:'oddoneout', text:'No candidates here at all.', answer:'x' }, 'jeopardy'),
      err:      run({ type:'errorfix', text:'You *must to* wear a helmet.', answer:'must' }, 'jeopardy'),
      errBad:   run({ type:'errorfix', text:'Nothing is marked in this one.', answer:'must' }, 'jeopardy')
    };
  });

  check('an anagram scatters the answer\'s letters',
        forms.anagram.before.tiles === 7 && forms.anagram.before.text.indexOf('verdict') === -1,
        JSON.stringify(forms.anagram.before));
  check('and the letters land in order on reveal',
        forms.anagram.after.ms > 0 && /verdict/i.test(forms.anagram.after.text.replace(/\s+/g,'')),
        forms.anagram.after.text);
  check('an answer that is not one word declines to plain text',
        forms.anaLong.before.tiles === 0 && forms.anaLong.before.type === 'anagram',
        JSON.stringify(forms.anaLong.before));
  check('and Millionaire never gets an anagram to give away',
        forms.anaGated.before.tiles === 0, JSON.stringify(forms.anaGated.before));

  check('odd one out draws its candidates as chips', forms.odd.before.chips === 3,
        String(forms.odd.before.chips));
  check('and reveal lights one and stands the others down',
        forms.odd.after.ms > 0 && forms.odd.after.odd === 1 && forms.odd.after.dim === 2,
        JSON.stringify(forms.odd.after));
  check('a prompt with no candidates falls back to plain text',
        forms.oddBad.before.chips === 0 && forms.oddBad.after.ms === 0,
        JSON.stringify(forms.oddBad.before));

  check('error correction marks the wrong words', forms.err.before.errors === 1,
        forms.err.before.text);
  check('and swaps them for the right one', forms.err.after.ms > 0 &&
        forms.err.after.fixed === 1 && /You must wear/.test(forms.err.after.text),
        forms.err.after.text);
  check('an unmarked prompt is left as plain text',
        forms.errBad.before.errors === 0 && forms.errBad.after.ms === 0,
        JSON.stringify(forms.errBad.before));

  /* Anything presenting the set of forms — the prompt lab does — has to be able to
     ask what they are rather than carrying a list that goes stale. */
  const info = await page.evaluate(() => ({
    gap:  window.HubKit.prompt.info('gap'),
    ana:  window.HubKit.prompt.info('anagram'),
    none: window.HubKit.prompt.info('nosuchform')
  }));
  check('a form describes the boards it suits, null meaning all',
        info.gap && info.gap.games === null &&
        info.ana && info.ana.games.indexOf('jeopardy') !== -1 && info.none === null,
        JSON.stringify(info));

  /* Sentence scramble: the words of the answer, out of order. The form that tests
     word order, which is the one thing a gap fill structurally cannot ask. */
  const scr = await page.evaluate(() => {
    const item = { type:'scramble', text:'Word order:',
                   answer:'The law that was recently passed makes no sense' };
    const el = document.createElement('div'); document.body.appendChild(el);
    window.HubKit.prompt.render(el, item, 'jeopardy');
    const asked = [...el.querySelectorAll('.prompt-word')].map(w=>w.textContent).join(' ');
    const ms = window.HubKit.prompt.reveal(el, item);
    const landed = [...el.querySelectorAll('.prompt-word')].map(w=>w.textContent).join(' ');
    const inRace = document.createElement('div');
    window.HubKit.prompt.render(inRace, item, 'race');
    const short = document.createElement('div');
    window.HubKit.prompt.render(short, { type:'scramble', text:'x', answer:'two words' }, 'jeopardy');
    el.remove();
    return { asked, landed, ms, target:item.answer,
             raceChips: inRace.querySelectorAll('.prompt-word').length,
             shortChips: short.querySelectorAll('.prompt-word').length };
  });
  check('a scramble breaks the sentence into words',
        scr.asked.split(' ').length === 9, scr.asked);
  check('and never hands back the sentence already in order',
        scr.asked !== scr.target, scr.asked);
  check('reveal puts every word back in the right place',
        scr.ms > 0 && scr.landed === scr.target, scr.landed);
  check('a sentence answer is not offered to Race, whose answers are board tiles',
        scr.raceChips === 0);
  check('and too short a sentence declines to plain text', scr.shortChips === 0);

  check('every form that answered in place set the shared marker',
        forms.anagram.after.marked && forms.odd.after.marked && forms.err.after.marked);

  // the switch turns all of it back into plain sentences
  const off = await page.evaluate(() => {
    window.HubSettings.set('promptForms', false);
    return window.HubSettings.get('promptForms', 'jeopardy');
  });
  check('the question forms can be switched off', off === false);
  await page.evaluate(() => window.HubSettings.set('promptForms', true));

  // and the whole point: it works on the real content, in a real game
  await startGame(page, 'Jeopardy', { sections:'all' });
  let opened = false;
  for (const tile of (await page.locator('.tile:not(.used)').all()).slice(0, 14)){
    await tile.click(); await page.waitForTimeout(1250);
    if (await page.locator('#clue-text .prompt-gap').count()){
      await page.locator('#reveal-btn').click(); await page.waitForTimeout(600);
      const filled = await page.locator('#clue-text .prompt-gap.filled').count();
      const dupe   = await page.locator('#clue-answer').isVisible();
      check('a real clue fills its blank on reveal', filled === 1, filled + ' filled');
      check('and the answer line stands down rather than repeating it', !dupe);
      opened = true;
      await page.locator('#correct-btn').click(); await page.waitForTimeout(1500);
      break;
    }
    await page.locator('#close-btn').click(); await page.waitForTimeout(1400);
  }
  check('a gapped clue was found in the bank', opened);

  checkClean(page);
  await page.close();
}

/* Every game now has an ident, and they must stay distinct — one accent reused
   twice would make two games look like the same show. */
async function testIdentsAreDistinct(browser){
  section('Idents');
  const page = await openHub(browser);
  const idents = await page.evaluate(() => {
    const out = {};
    ['jeopardy','blockbusters','race','millionaire'].forEach(g=>{
      out[g] = window.HubSettings.variantsFor('theme', g).map(v=>v.value);
    });
    return out;
  });
  Object.keys(idents).forEach(g=>
    check(g + ' can be switched to game show mode', idents[g].indexOf('gameshow') !== -1,
          idents[g].join(',')));
  checkClean(page);
  await page.close();
}

/* A cleared Jeopardy board used to do nothing at all — the same gap Blockbusters
   had. This is theme-independent: the banner appears either way. */
async function testJeopardyFinish(browser){
  section('Jeopardy — board cleared');
  const page = await openHub(browser);
  await startGame(page, 'Jeopardy', { sections:3 });

  const total = await page.locator('#board .tile').count();
  for (let i = 0; i < total; i++){
    const tile = page.locator('#board .tile:not(.used)').first();
    if (!(await tile.count())) break;
    await tile.click(); await page.waitForTimeout(1250);
    await page.locator('#reveal-btn').click(); await page.waitForTimeout(140);
    // alternate right and wrong so the two teams do not finish level
    await page.locator(i % 3 === 0 ? '#wrong-btn' : '#correct-btn').click();
    await page.waitForTimeout(1450);
    /* A wrong answer no longer burns the tile on its own — it offers the room a
       steal, and the card stays up until someone takes it or the teacher declines.
       Decline it here so this suite keeps testing what it is for: that a board
       played to the end raises the banner. */
    const declineSteal = page.locator('#skip-btn');
    if (await declineSteal.isVisible().catch(()=>false)){
      await declineSteal.click(); await page.waitForTimeout(1200);
    }
  }
  await page.waitForTimeout(700);
  const fin = await page.evaluate(() => ({
    unused: document.querySelectorAll('#board .tile:not(.used)').length,
    banner: document.getElementById('result-modal').classList.contains('on'),
    title:  document.getElementById('result-title').textContent,
    sub:    document.getElementById('result-sub').textContent
  }));
  check('every tile was played', fin.unused === 0, fin.unused + ' left');
  check('a cleared board raises the banner', fin.banner);
  check('the banner declares a result', /wins|tie/i.test(fin.title), fin.title);
  check('the banner gives the final score', /\$\d/.test(fin.sub), fin.sub);

  checkClean(page);
  await page.close();
}

/* A phone is a preview device, not the projected board, but it has to be usable:
   a teacher checks a lesson on the way in. This is here because it shipped broken —
   Kit.fitToScreen forced #m-main to a height the content could not fit in, the
   option grid's rows collapsed under their own content, and the ladder painted
   straight through answers B, C and D. Overlap is the assertion, because "it
   scrolls" is fine on a handset and "you cannot read option C" is not. */
async function testPhoneLayout(browser){
  section('Usable on a phone');

  /* Same contract as the desktop suite, asked of whatever the registry holds, so
     a fifth game is covered the day it registers rather than the day someone
     remembers to add it here. Jeopardy is why this is not Millionaire-only: it
     passed every fit assertion while being unreadable, because "does not overflow"
     and "can be read" are different properties. */
  const probe = await openHub(browser);
  const games = await registeredGames(probe);
  await probe.close();

  for (const g of games){
    const page = await browser.newPage({
      viewport:{ width:390, height:844 }, deviceScaleFactor:2, isMobile:true, hasTouch:true });
    page.__errors = []; page.__console = [];
    page.on('pageerror', e => page.__errors.push(String(e)));
    await page.goto(BASE + '/game-hub.html');
    await page.waitForTimeout(350);
    await startGame(page, g.title, { sections:'all' });
    const r = await stageReport(page, g.stage);
    check(`${g.title} @ 390x844: no text is cut off`, r.clipped === 0,
          r.clipped + '× e.g. ' + r.clippedSample);
    /* Deliberately no minimum type size here. A handset is read at arm's length,
       so 10px on Race's words and 10.9px on Millionaire's ladder strip are fine;
       the legibility floor that matters is the projected screen, and that is a
       content decision (pick fewer sections) rather than a layout one. Asserting
       it here would only have taught us to loosen it. */
    check(`${g.title} @ 390x844: chrome leaves the board its space`, r.chrome <= 200, r.chrome + 'px');
    await page.close();
  }

  // 360x560 is the squeeze case: a small Android with the browser's own chrome
  // taking a bite. The content genuinely cannot fit, which is what `floor:true`
  // on Kit.fitToScreen is for — it hands the height back rather than forcing one.
  for (const vp of [{ width:390, height:844, name:'390x844' },
                    { width:375, height:667, name:'375x667' },
                    { width:360, height:560, name:'360x560' }]){
    const page = await browser.newPage({
      viewport:{ width:vp.width, height:vp.height }, deviceScaleFactor:2, isMobile:true, hasTouch:true });
    page.__errors = []; page.__console = [];
    page.on('pageerror', e => page.__errors.push(String(e)));
    await page.goto(BASE + '/game-hub.html');
    await page.waitForTimeout(350);
    await startGame(page, 'Millionaire', { sections:'all' });

    const r = await page.evaluate(() => {
      const rect = s => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
      const overlap = (a, b) => a && b &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1 &&
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1;
      const opts = [...document.querySelectorAll('.m-option')].map(e => e.getBoundingClientRect());
      let optOverlap = 0;
      for (let i = 0; i < opts.length; i++)
        for (let j = i + 1; j < opts.length; j++) if (overlap(opts[i], opts[j])) optOverlap++;
      /* Measure the options themselves, never their container: when the grid rows
         collapsed, #m-options stayed a 50px box while its four options overflowed
         320px past it. Comparing the ladder to that box saw no overlap and called
         a game you literally could not read "fine". */
      const box = rect('#m-options');
      return {
        options: opts.length,
        optOverlap,
        spill: Math.round(Math.max(0, Math.max(...opts.map(o => o.bottom)) - box.bottom)),
        ladderOverOptions: opts.some(o => overlap(rect('#m-ladder'), o)),
        offRight: Math.round(Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
        // header above the board, plus anything below the floor — see stageReport
        chrome: Math.round(rect('header').height + (window.innerHeight - window.HubKit.floorTop())),
        shortest: Math.round(Math.min(...opts.map(o => o.height)))
      };
    });

    check(`${vp.name}: four options are on screen`, r.options === 4, String(r.options));
    check(`${vp.name}: no option overlaps another`, r.optOverlap === 0, r.optOverlap + ' pairs');
    check(`${vp.name}: the ladder does not cover the answers`, !r.ladderOverOptions);
    check(`${vp.name}: the options stay inside their grid`, r.spill === 0, r.spill + 'px past it');
    check(`${vp.name}: every option keeps its full height`, r.shortest >= 40, r.shortest + 'px');
    check(`${vp.name}: nothing runs off the right edge`, r.offRight === 0, r.offRight + 'px');
    // An absolute cap, not a fraction of the viewport: the chrome costs the same
    // pixels whatever the screen, and on the shortest handset a fraction would pass
    // at 33% while stealing 40% of a 560px screen. It was 323px — header 146 + team
    // bar 177 — before the handset tier existed; the tier brought it to 200, and the
    // compact bar the header move bought keeps it there now the bar is back below.
    check(`${vp.name}: chrome leaves the board its space`,
          r.chrome <= 200, r.chrome + 'px of ' + vp.height);
    checkClean(page, vp.name);
    await page.close();
  }
}

/* ---- competitive dynamics ----
   Every mechanic is asserted in BOTH switch positions. "Off reproduces exactly what
   the app did before" is the promise that lets a teacher try these mid-term without
   risking a lesson, so it is the more important half of each pair. */
/* ---- the clue card floats, and moves ----
   It used to sit behind a 90%-opaque backdrop across the whole screen, so opening a
   clue hid the thing the room was playing on: the tiles already taken, the hexagons
   still open, the score. Now it floats. Two properties come with that and both are
   easy to lose: the board must be *visible* but not *clickable*, and a card that
   covers the one tile you need to see must be movable. */
async function testFloatingCard(browser){
  section('The clue card floats over the board');
  const page = await openHub(browser, { width:1280, height:720 });
  await page.evaluate(() => { window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off'); });
  await startGame(page, 'Jeopardy', { sections:'all' });
  await page.locator('#board .tile').nth(5).click(); await page.waitForTimeout(900);

  const look = await page.evaluate(() => {
    const m = document.getElementById('clue-modal');
    const bg = getComputedStyle(m).backgroundColor;
    const clear = bg === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(bg) || /, 0\)$/.test(bg);
    return { clear, bg,
             layerIgnoresClicks: getComputedStyle(m).pointerEvents === 'none',
             cardTakesClicks: getComputedStyle(document.getElementById('clue-card')).pointerEvents === 'auto',
             boardNotClickable: getComputedStyle(document.getElementById('screen-play')).pointerEvents === 'none' };
  });
  check('there is no backdrop over the board', look.clear, look.bg);
  check('the layer does not eat clicks, only the card does',
        look.layerIgnoresClicks && look.cardTakesClicks, JSON.stringify(look));
  /* Visible is not the same as live. Every control that matters while a clue is up
     is on the card, and the scrim was what stopped a stray click opening a second
     clue over the first — so that has to be kept by other means. */
  check('the board behind is visible but not clickable', look.boardNotClickable);

  const card = page.locator('#clue-card');
  const before = await card.boundingBox();
  await page.mouse.move(before.x + before.width/2, before.y + 30);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width/2 - 260, before.y + 30 + 140, { steps:10 });
  await page.mouse.up(); await page.waitForTimeout(150);
  const after = await card.boundingBox();
  check('the card can be dragged out of the way',
        Math.round(after.x - before.x) === -260 && Math.round(after.y - before.y) === 140,
        Math.round(after.x - before.x) + ',' + Math.round(after.y - before.y));
  /* Written to `translate`, not `transform`: the flip animates transform through the
     Web Animations API, and a drag in the same property would be wiped by the next
     keyframe — or would fight the landing. */
  /* The drag must not be written into `transform`: the flip animates that property
     through the Web Animations API, so an offset living there would be wiped by the
     next keyframe. They are separate longhands and compose. Asserted by reading the
     drag back out of `translate` rather than by the absence of a transform — the
     flip legitimately leaves one behind. */
  check('the offset lives in translate, so it cannot fight the flip',
        /-?\d+px/.test(await page.evaluate(() => document.getElementById('clue-card').style.translate)),
        await page.evaluate(() => document.getElementById('clue-card').style.translate + ' | transform: ' +
                                  document.getElementById('clue-card').style.transform));

  // dragged hard off-screen, some of it must stay reachable
  const r = await card.boundingBox();
  await page.mouse.move(r.x + r.width/2, r.y + 30);
  await page.mouse.down(); await page.mouse.move(-4000, -4000, { steps:8 }); await page.mouse.up();
  await page.waitForTimeout(150);
  const off = await card.boundingBox();
  check('it cannot be thrown off the screen entirely',
        off.x + off.width >= 60 && off.y + off.height >= 60,
        Math.round(off.x + off.width) + ',' + Math.round(off.y + off.height));

  // a press on a control is a press, not the start of a drag
  await page.evaluate(() => { document.getElementById('clue-card').style.translate = ''; });
  await page.waitForTimeout(120);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(300);
  check('a button on the card still works rather than dragging it',
        await page.locator('#clue-answer').isVisible());

  await page.locator('#correct-btn').click(); await page.waitForTimeout(1000);
  check('the board is live again once the clue is gone',
        await page.evaluate(() => getComputedStyle(document.getElementById('screen-play')).pointerEvents) === 'auto');
  await page.locator('#board .tile').nth(9).click(); await page.waitForTimeout(900);
  const next = await card.boundingBox();
  check('and the next clue arrives centred, not where the last one was dragged',
        Math.abs((next.x + next.width/2) - 640) < 3, Math.round(next.x + next.width/2) + '');
  checkClean(page);
  await page.close();
}

/* ---- who the points belong to ----
   Three modes, three different answers, and the difference is the whole point of
   having modes at all. */
async function testTurnsAndPoints(browser){
  section('Turns and points across the phone modes');

  const openJeopardy = async (mode) => {
    const page = await openHub(browser);
    await page.evaluate(m => {
      window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
      window.HubSettings.set('buzzers', true); window.HubSettings.set('phoneMode', m, 'jeopardy');
    }, mode);
    await startGame(page, 'Jeopardy', { sections:'all' });
    await page.waitForTimeout(700);
    const chip = await page.locator('#buzzer-chip').innerText().catch(()=>'');
    return { page, code:(chip.match(/CODE\s+(\d{5})/i)||[])[1] };
  };
  const join = async (code, name, team) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(200);
    await p.fill('#code', code); await p.fill('#name', name);
    await p.locator('.teams button').nth(team).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(500);
    return p;
  };
  const turn   = pg => pg.evaluate(() => [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active')));
  const scores = pg => pg.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent));

  /* `write`: the whole room answers, so nobody won the question — "keep the board"
     is a reward for winning it, and applying it here left one team picking every
     tile for the entire game. */
  const w = await openJeopardy('write');
  check('the first team is on turn', await turn(w.page) === 0);
  await w.page.locator('#board .tile').first().click(); await w.page.waitForTimeout(700);
  await w.page.locator('#reveal-btn').click(); await w.page.waitForTimeout(200);
  await w.page.locator('#correct-btn').click(); await w.page.waitForTimeout(900);
  check('when everyone types, the turn moves on its own', await turn(w.page) === 1, String(await turn(w.page)));
  checkClean(w.page, 'write turns');
  await w.page.close();

  /* `buzz`: the buzz says who *wants* the floor. The answer is spoken in the room,
     so the teacher still marks it — the phone cannot hear it. */
  const z = await openJeopardy('buzz');
  if (z.code){
    const ben = await join(z.code, 'Ben', 1);
    await z.page.locator('#board .tile').first().click(); await z.page.waitForTimeout(800);
    await ben.locator('#buzzer').click(); await z.page.waitForTimeout(700);
    check('a buzz highlights the team that got in', await turn(z.page) === 1, String(await turn(z.page)));
    check('but nothing is scored yet — the answer is still in the room',
          (await scores(z.page)).every(v => v === '0'), (await scores(z.page)).join('/'));
    await z.page.locator('#reveal-btn').click(); await z.page.waitForTimeout(200);
    await z.page.locator('#correct-btn').click(); await z.page.waitForTimeout(900);
    check('and the teacher marking it pays the team that buzzed',
          (await scores(z.page))[1] !== '0', (await scores(z.page)).join('/'));
    check('phone had no errors', ben.__errors.length === 0, ben.__errors[0]);
    await ben.close();
  }
  checkClean(z.page, 'buzz turns');
  await z.page.close();

  /* `type`: the student produced the answer in writing and the host judged it, so
     there is nothing left to confirm. Race had this from the start; the tile games
     did not, so the same student doing the same thing scored on one board and
     waited for a click on the other. */
  const t = await openJeopardy('type');
  if (t.code){
    const ana = await join(t.code, 'Ana', 1);
    await t.page.locator('#board .tile').first().click(); await t.page.waitForTimeout(800);
    const answer = await t.page.evaluate(() => document.getElementById('clue-answer').textContent);
    await ana.fill('#reply', answer); await t.page.waitForTimeout(150);
    await ana.locator('#buzzer').click(); await t.page.waitForTimeout(1000);
    check('a typed answer highlights the team that produced it', await turn(t.page) === 1, String(await turn(t.page)));
    check('and scores it without waiting for a click',
          (await scores(t.page))[1] !== '0', (await scores(t.page)).join('/'));
    check('the clue closes, like any answered clue',
          await t.page.evaluate(() => document.getElementById('clue-modal').style.display === 'none'));
    check('phone had no errors', ana.__errors.length === 0, ana.__errors[0]);
    await ana.close();
  }
  checkClean(t.page, 'type turns');
  await t.page.close();
}

/* ---- the phone offers the teams that exist ----
   The join screen used to hard-code two buttons, so a class split into four could
   only pick from the first half — and a team renamed to something the room answers
   to still read "Team 2" on every handset. */
async function testPhoneTeams(browser){
  section('Phones know the real teams');
  const host = await openHub(browser);
  await host.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
    window.HubSettings.set('buzzers', true); window.HubSettings.set('phoneMode','buzz','jeopardy');
    document.getElementById('add-team-btn').click();
    document.getElementById('add-team-btn').click();
  });
  await host.waitForTimeout(200);
  const names = ['Lions','Tigers','Bears','Wolves'];
  for (let i = 0; i < names.length; i++){
    await host.locator('.team .tname').nth(i).fill(names[i]);
    await host.locator('.team .tname').nth(i).dispatchEvent('change');
  }
  await startGame(host, 'Jeopardy', { sections:'all' });
  await host.waitForTimeout(900);
  const chip = await host.locator('#buzzer-chip').innerText().catch(()=>'');
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('a room opens', !!code, chip.replace(/\n/g,' '));
  if (code){
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(200);
    await p.fill('#code', code); await p.waitForTimeout(900);
    const offered = await p.locator('.teams button').allInnerTexts();
    check('the phone offers every team, by the name the teacher gave it',
          offered.join('/').toLowerCase() === names.join('/').toLowerCase(), offered.join('/'));
    await p.fill('#name','Ana');
    await p.locator('.teams button').nth(2).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(600);
    check('and joining the third team lands on the third team',
          /bears/i.test(await p.locator('#who').innerText()), await p.locator('#who').innerText());

    /* Renaming mid-lesson has to reach the handset: the name on the phone is how a
       student knows which score on the board is theirs. */
    await host.locator('.team .tname').nth(2).fill('Grizzlies');
    await host.locator('.team .tname').nth(2).dispatchEvent('change');
    await host.waitForTimeout(800);
    check('a rename reaches the phones that already joined',
          /grizzlies/i.test(await p.locator('#who').innerText()), await p.locator('#who').innerText());

    await host.locator('#board .tile').first().click(); await host.waitForTimeout(700);
    await p.locator('#buzzer').click(); await host.waitForTimeout(700);
    check('and a buzz from that phone selects that team, not one of the first two',
          await host.evaluate(() => [...document.querySelectorAll('.team')]
            .findIndex(e => e.classList.contains('active'))) === 2);
    /* The seat can be walked away from — the phone changes hands, or the student
       picked the wrong team. Without the escape, a phone holding a seat in the
       current room can never reach the name-and-team screen again: the resume
       rejoins it on every load, QR scan included. */
    await p.locator('#rejoin').click(); await p.waitForTimeout(300);
    const back = await p.evaluate(() => ({
      join: document.getElementById('screen-join').classList.contains('active'),
      code: document.getElementById('code').value,
      name: document.getElementById('name').value,
      seat: localStorage.getItem('engishism.seat')
    }));
    check('"Not you?" returns to the join form, code and name kept, seat forgotten',
          back.join && back.code === code && back.name === 'Ana' && back.seat === null,
          JSON.stringify(back));
    await p.locator('.teams button').nth(0).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(600);
    check('and joining again on a different team lands there',
          /lions/i.test(await p.locator('#who').innerText()),
          await p.locator('#who').innerText());

    check('phone had no errors', p.__errors.length === 0, p.__errors[0]);
    await p.close();

    /* A team added mid-lesson has to reach a phone still sitting on the join
       screen too — that list used to be fetched once per code and never again,
       so a fifth team was only pickable by students who had not opened the page
       yet. The screen re-asks every 4s while it is up. */
    const late = await browser.newPage({ viewport:{ width:390, height:844 } });
    await late.goto(BASE + '/join.html'); await late.waitForTimeout(200);
    await late.fill('#code', code); await late.waitForTimeout(400);
    await host.evaluate(() => document.getElementById('add-team-btn').click());
    await late.waitForTimeout(5200);
    const offered2 = await late.locator('.teams button').count();
    check('a team added while a student is still on the join screen becomes pickable',
          offered2 === 5, String(offered2));
    await late.close();
  }
  checkClean(host, 'phone teams');
  await host.close();
}

/* ---- one strip, every game, every mode ----
   Where a student's name appeared used to depend on the game *and* the mode: a buzz
   went on the room chip (replacing the join address the class was still reading), a
   typed answer went into the clue card in Jeopardy, under the sentence in Race,
   under the question in Millionaire. Four layouts for one idea, and three of them
   moved the board while they filled. The strip is the standard: same element, same
   place, fixed height. */
async function testPhoneStrip(browser){
  section('The phone strip is the same in every game');

  const openRoom = async (game, mode, opts) => {
    const page = await openHub(browser);
    await page.evaluate(m => {
      window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
      window.HubSettings.set('buzzers', true);
      window.HubGames.ids().forEach(g => window.HubSettings.set('phoneMode', m, g));
    }, mode);
    await startGame(page, game, Object.assign({ sections:'all' }, opts || {}));
    await page.waitForTimeout(900);
    const chip = await page.locator('#buzzer-chip').innerText().catch(()=>'');
    return { page, code:(chip.match(/CODE\s+(\d{5})/i)||[])[1] };
  };
  const join = async (code, name, team) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(250);
    await p.fill('#code', code); await p.fill('#name', name);
    await p.locator('.teams button').nth(team).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(500);
    return p;
  };
  const stageTop = pg => pg.evaluate(() => {
    const ids = window.HubGames.ids().map(id => window.HubGames.get(id).stage);
    const on = ids.map(id => document.getElementById(id)).find(el => el && el.offsetParent);
    return on ? Math.round(on.getBoundingClientRect().top) : null;
  });

  /* The room's identity and what the room is doing are two different facts, and the
     chip used to swap the first out for the second — so the moment one student
     buzzed, the class still typing the code lost it off the screen. */
  const z = await openRoom('Jeopardy', 'buzz');
  check('a room opens', !!z.code, z.code || 'none');
  if (z.code){
    const ben = await join(z.code, 'Ben', 1);
    await z.page.waitForTimeout(300);
    const top0 = await stageTop(z.page);
    await z.page.locator('#board .tile').first().click(); await z.page.waitForTimeout(800);
    await ben.locator('#buzzer').click(); await z.page.waitForTimeout(700);
    const chip = await z.page.locator('#buzzer-chip').innerText();
    const strip = await z.page.locator('#phone-bar').innerText();
    check('the buzz appears in the strip', /Ben/.test(strip), strip.replace(/\n/g,' '));
    check('and the chip still shows the room, so late joiners can still get in',
          /CODE\s+/i.test(chip) && !/Ben/.test(chip), chip.replace(/\n/g,' '));
    check('the board did not move when the class did something',
          (await stageTop(z.page)) === top0, top0 + ' -> ' + await stageTop(z.page));
    check('phone had no errors', ben.__errors.length === 0, ben.__errors[0]);
    await ben.close();
  }
  checkClean(z.page, 'strip buzz');
  await z.page.close();

  /* A full class typing is the case that used to grow the panel and squeeze the
     board. The strip holds its height and scrolls instead. */
  const w = await openRoom('Race to the Board', 'write');
  if (w.code){
    const phones = [];
    for (let i = 0; i < 4; i++) phones.push(await join(w.code, 'P' + i, i % 2));
    await w.page.locator('#race-start').click(); await w.page.waitForTimeout(800);
    const before = await stageTop(w.page);
    const h0 = await w.page.evaluate(() => Math.round(document.getElementById('phone-bar').getBoundingClientRect().height));
    for (const p of phones){ await p.fill('#reply', 'answer'); await p.locator('#send').click(); await p.waitForTimeout(200); }
    await w.page.waitForTimeout(800);
    const h1 = await w.page.evaluate(() => Math.round(document.getElementById('phone-bar').getBoundingClientRect().height));
    check('four answers do not make the strip taller', h0 === h1, h0 + ' -> ' + h1);
    check('and the board stays exactly where it was',
          (await stageTop(w.page)) === before, before + ' -> ' + await stageTop(w.page));
    check('every answer is in there', /P0: answer/.test(await w.page.locator('#phone-bar').innerText()));
    for (const p of phones){ check('phone had no errors', p.__errors.length === 0, p.__errors[0]); await p.close(); }
  }
  checkClean(w.page, 'strip write');
  await w.page.close();

  /* "It just moved on with no indication who got it right." A typed answer scores
     automatically, and Race deals the next sentence immediately — so anything shown
     only while the buzz was live was gone before the room could read it. */
  for (const [game, click] of [['Race to the Board', null], ['Jeopardy', '#board .tile'],
                               ['Blockbusters', '#hexwrap .hex']]){
    const t = await openRoom(game, 'type');
    if (t.code){
      const ana = await join(t.code, 'Ana', 1);
      await t.page.waitForTimeout(300);
      let answer;
      if (game === 'Race to the Board'){
        await t.page.locator('#race-start').click(); await t.page.waitForTimeout(800);
        answer = await currentRaceAnswer(t.page);
      } else {
        await t.page.locator(click).first().click(); await t.page.waitForTimeout(900);
        answer = await t.page.evaluate(() => document.getElementById('clue-answer').textContent);
      }
      await ana.fill('#reply', answer); await t.page.waitForTimeout(150);
      await ana.locator('#buzzer').click(); await t.page.waitForTimeout(1400);
      const strip = await t.page.locator('#phone-bar').innerText();
      check(game + ': the strip names who got it', /Ana/.test(strip), strip.replace(/\n/g,' '));
      check(game + ': and what it was worth', /\+\d/.test(strip), strip.replace(/\n/g,' '));
      check(game + ': the points actually landed',
            (await t.page.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent)))[1] !== '0');
      check('phone had no errors', ana.__errors.length === 0, ana.__errors[0]);
      await ana.close();
    }
    checkClean(t.page, 'strip type ' + game);
    await t.page.close();
  }

  /* And the phone says which room it is in, all lesson — a student on the wrong
     code, or drifting into next door's game, had no way to tell. */
  const r = await openRoom('Jeopardy', 'buzz');
  if (r.code){
    const ana = await join(r.code, 'Ana', 0);
    check('the phone shows its room number',
          (await ana.locator('#room').innerText()).includes(r.code),
          await ana.locator('#room').innerText());
    await ana.close();
  }
  checkClean(r.page, 'room number');
  await r.page.close();
}

/* ---- Blockbusters with more than two teams ----
   The board is two-sided — yellow crosses, blue descends — so a third team has no
   route to win by. Four teams play it as two alliances: everyone answers and scores
   their own points, the hexagon takes their side's colour, and the line belongs to
   a side. With two teams every one of these is the identity, which is the property
   that matters: the two-team game is untouched. */
async function testBlockbustersTeams(browser){
  section('Blockbusters with four teams');
  const page = await openHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
    document.getElementById('add-team-btn').click();
    document.getElementById('add-team-btn').click();
  });
  await page.waitForTimeout(200);
  const names = ['Lions','Tigers','Bears','Wolves'];
  for (let i = 0; i < names.length; i++){
    await page.locator('.team .tname').nth(i).fill(names[i]);
    await page.locator('.team .tname').nth(i).dispatchEvent('change');
  }
  await startGame(page, 'Blockbusters', { sections:'all' });
  await page.waitForTimeout(900);

  const legend = await page.locator('#legend').innerText();
  check('the legend says who is playing each colour',
        /Lions/.test(legend) && /Bears/.test(legend) && /Tigers/.test(legend) && /Wolves/.test(legend),
        legend.replace(/\n/g,' | '));

  await page.locator('#hexwrap .hex').first().click(); await page.waitForTimeout(900);
  const offered = await page.locator('#clue-claim button').allInnerTexts();
  check('the answer card offers every team, not the first two',
        offered.length === 4, offered.join('/').replace(/\n/g,' '));

  await page.locator('#clue-claim button', { hasText:'Bears' }).first().click();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    scores: [...document.querySelectorAll('.team .score')].map(e => e.textContent),
    hex: document.querySelector('#hexwrap .hex').className,
    turn: [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active'))
  }));
  check('the points go to the team that answered', after.scores[2] === '1', after.scores.join('/'));
  /* Bears are the third team, so they play yellow — the hexagon has to take the
     side's colour, because a line is made of sides and there is no third colour a
     win could be made of. */
  check('the hexagon takes that team\'s side colour', /claimed-gold/.test(after.hex), after.hex);
  check('and the turn moves on within the alliance', after.turn === 2, String(after.turn));

  /* ---- the board after a reset ----
     A won board is scaled down to sit above the banner, and `#play-blockbusters`
     carries a 350ms transform transition — so "New board" cleared the scale and laid
     the hexes out one frame later, mid-transition, measuring them at 0.84 of their
     real size through `getBoundingClientRect()`. They were spaced for a 92px hex and
     rendered at 110. A resize fixed it, which is why leaving the game and coming
     back looked fine and made it read as a rendering glitch rather than a
     measurement one. */
  const geom = pg => pg.evaluate(() => {
    const hx = [...document.querySelectorAll('#hexwrap .hex')];
    const row0 = hx.filter(h => h.dataset.row === '0').map(h => Math.round(h.getBoundingClientRect().left));
    return { wrap: Math.round(document.getElementById('hexwrap').getBoundingClientRect().width),
             step: row0.length > 1 ? row0[1] - row0[0] : 0,
             hex:  Math.round(hx[0].getBoundingClientRect().width) };
  });
  const fresh = await geom(page);
  check('a fresh board spaces the hexagons wider than they are',
        fresh.step > fresh.hex, JSON.stringify(fresh));

  // yellow takes the whole top row — left to right, which is a win. Bears already
  // hold col 0 from the claim above, and Bears are a yellow-side team.
  for (let c = 1; c < 5; c++){
    await page.locator('#hexwrap .hex[data-row="0"][data-col="' + c + '"]').click();
    await page.waitForTimeout(450);
    await page.locator('#clue-claim button').first().click();
    await page.waitForTimeout(650);
  }
  await page.waitForTimeout(3600);
  check('a completed line ends the round',
        /wins/i.test(await page.locator('#result-card').innerText().catch(()=>'')),
        (await page.locator('#result-card').innerText().catch(()=>'none')).replace(/\n/g,' '));

  await page.locator('#result-card button', { hasText:'New board' }).click();
  await page.waitForTimeout(1500);
  const reset = await geom(page);
  check('and the new board is laid out exactly like a fresh one',
        reset.wrap === fresh.wrap && reset.step === fresh.step,
        JSON.stringify(reset) + ' vs ' + JSON.stringify(fresh));
  check('so the hexagons are not overlapping', reset.step > reset.hex,
        'step ' + reset.step + ' vs hex ' + reset.hex);

  /* ---- teams could be added and never removed ----
     A class that split four ways one lesson carried four teams into the next. The
     index is a team's identity in three other places, so this is more than a splice.
  */
  await page.evaluate(() => { for (let i = 0; i < 3; i++) document.getElementById('add-team-btn').click(); });
  await page.waitForTimeout(200);
  check('above two teams, each one can be removed',
        await page.locator('.team .tdel').count() === 7, String(await page.locator('.team .tdel').count()));
  page.on('dialog', d => d.accept());
  await page.locator('.team').nth(1).locator('.plus').click();
  await page.waitForTimeout(100);
  await page.locator('.team').nth(1).locator('.tdel').click();
  await page.waitForTimeout(300);
  check('removing one takes it off the bar',
        await page.locator('.team').count() === 6, String(await page.locator('.team').count()));
  check('and the names that are left are the right ones',
        !(await page.locator('#scorebar').innerText()).includes('Tigers'),
        (await page.locator('#scorebar').innerText()).replace(/\n/g,' '));
  while (await page.locator('.team .tdel').count()){
    await page.locator('.team .tdel').first().click(); await page.waitForTimeout(150);
  }
  check('two is the floor — every board is built for two sides',
        await page.locator('.team').count() === 2, String(await page.locator('.team').count()));
  check('and the remove buttons go away at the floor',
        await page.locator('.team .tdel').count() === 0);

  checkClean(page);
  await page.close();
}

/* ---- the join screen with a class split more than two ways ----
   The team buttons were a flex row, so six teams on a 360px handset got 50px each
   and the last of them sat off the edge of the screen — a student on Sharks could
   not pick Sharks. */
async function testJoinTeams(browser){
  section('The join screen with six teams');
  for (const w of [320, 360, 390]){
    const ph = await browser.newPage({ viewport:{ width:w, height:780 } });
    await ph.goto(BASE + '/join.html'); await ph.waitForTimeout(250);
    const r = await ph.evaluate(() => {
      const host = document.querySelector('.teams'); host.innerHTML = '';
      ['Lions','Tigers','Bears','Wolves','Falcons','Sharks'].forEach(n => {
        const b = document.createElement('button'); b.textContent = n; host.appendChild(b);
      });
      const bs = [...host.querySelectorAll('button')];
      return { off: bs.filter(b => b.getBoundingClientRect().right > window.innerWidth + 1).length,
               clipped: bs.filter(b => b.scrollWidth > b.clientWidth + 1).length,
               page: document.documentElement.scrollWidth - window.innerWidth };
    });
    check(w + 'px: every team is on the screen', r.off === 0, JSON.stringify(r));
    check(w + 'px: and none of the names are cut off', r.clipped === 0, JSON.stringify(r));
    check(w + 'px: and the page does not scroll sideways', r.page <= 0, String(r.page));
    await ph.close();
  }

  /* The remembered seat must not outrank a scanned code. A seat stored from a
     previous lesson auto-rejoined over the QR's ?code=, which skipped the
     name-and-team screen entirely and put the student in the old room — buzz
     button up, deaf to every team change in the room they had actually scanned.
     `resumed` is window.HubPlayer existing: joinRoom() creates it whether or not
     the room answers, so it marks the auto-join path having run, no relay needed. */
  const seatPage = async (url) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    await p.goto(BASE + '/join.html');
    await p.evaluate(() => localStorage.setItem('engishism.seat',
      JSON.stringify({ code:'11111', name:'Zoe', team:1, id:'seat-test' })));
    await p.goto(BASE + url); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({
      joinShown: document.getElementById('screen-join').classList.contains('active'),
      resumed:   !!window.HubPlayer,
      code:      document.getElementById('code').value,
      name:      document.getElementById('name').value,
      seat:      localStorage.getItem('engishism.seat')
    }));
    await p.close();
    return r;
  };
  let r = await seatPage('/join.html?code=22222');
  check('a scanned code that differs from the remembered seat shows the join screen',
        r.joinShown && !r.resumed, JSON.stringify(r));
  check('…holding the scanned code, not the remembered one', r.code === '22222', r.code);
  check('…with the name remembered', r.name === 'Zoe', r.name);
  check('…and the stale seat forgotten', r.seat === null, String(r.seat));
  r = await seatPage('/join.html?code=11111');
  check('a scanned code matching the seat still resumes it', r.resumed, JSON.stringify(r));
  r = await seatPage('/join.html');
  check('and a plain reload still resumes the seat', r.resumed, JSON.stringify(r));
}

async function testCompetition(browser){
  section('Competitive dynamics');

  const activeTeam = page => page.evaluate(() =>
    [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active')));
  const openFirstClue = async page => {
    await page.locator('#board .tile:not(.used)').first().click(); await page.waitForTimeout(500);
    await page.locator('#reveal-btn').click(); await page.waitForTimeout(200);
  };

  /* ---- the classic rebound: full value, as the show pays it ----
     `stealFullValue` (written on by the classic ruleset) makes the steal earn what
     the clue was worth. Shown and paid are asserted together, because a card
     offering one number and award() paying another is the card lying to the room. */
  {
    const pg = await openHub(browser);
    await pg.evaluate(() => {
      const S = window.HubSettings;
      S.set('cardFlip','off'); S.set('intro','off'); S.set('sound',false);
      S.set('jRules','classic','jeopardy');       // writes stealFullValue on
      S.set('jDailyDoubles', 0, 'jeopardy');      // an ordinary first tile
      S.set('jDeduct', false, 'jeopardy');        // isolate what the steal pays
      S.set('phoneMode','off','jeopardy');
    });
    await startGame(pg, 'Jeopardy', { sections:3 });
    await openFirstClue(pg);
    await pg.locator('#wrong-btn').click(); await pg.waitForTimeout(400);
    check('classic offers the steal at the full value',
          /steal for 100\b/.test(await pg.locator('#clue-topline').innerText()),
          await pg.locator('#clue-topline').innerText());
    await pg.locator('#clue-claim .claim-team').first().click(); await pg.waitForTimeout(250);
    check('and claiming it starts the answer clock',
          await pg.locator('#clue-clock').count() === 1);
    await pg.locator('#reveal-btn').click(); await pg.waitForTimeout(200);
    await pg.locator('#correct-btn').click(); await pg.waitForTimeout(900);
    check('and it pays what it offered',
          (await scores(pg))[1] === '100', (await scores(pg)).join('/'));
    checkClean(pg, 'full-value steal');
    await pg.close();
  }

  // ---- steal on, in Jeopardy
  let page = await openHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('cardFlip', 'off'); window.HubSettings.set('intro', 'off');
    window.HubSettings.set('stealOnWrong', true, 'jeopardy');
  });
  await startGame(page, 'Jeopardy', { sections:3 });
  await openFirstClue(page);
  await page.locator('#wrong-btn').click(); await page.waitForTimeout(400);

  check('a miss keeps the question up instead of burning it',
        await page.locator('#clue-modal').isVisible());
  check('the team that missed it is not offered the steal',
        await page.locator('#clue-claim .claim-team').count() === 1,
        String(await page.locator('#clue-claim .claim-team').count()));
  check('the card says what the steal is worth',
        /steal for 50/.test(await page.locator('#clue-topline').innerText()),
        await page.locator('#clue-topline').innerText());
  check('and the answer is put away again so it can still be earned',
        await page.locator('#clue-text .prompt-gap.filled').count() === 0 &&
        !(await page.locator('#clue-answer').isVisible()));

  await page.locator('#clue-claim .claim-team').first().click(); await page.waitForTimeout(250);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(200);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(900);
  check('a steal scores half the tile', (await scores(page))[1] === '50', (await scores(page)).join('/'));

  // a second miss on the same clue has nowhere left to go, so it closes as before
  await openFirstClue(page);
  await page.locator('#wrong-btn').click(); await page.waitForTimeout(400);
  await page.locator('#clue-claim .claim-team').first().click(); await page.waitForTimeout(250);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(200);
  await page.locator('#wrong-btn').click(); await page.waitForTimeout(1300);
  check('a second miss ends the question rather than going round the table',
        !(await page.locator('#clue-modal').isVisible()));
  checkClean(page, 'steal on');
  await page.close();

  // ---- steal off: exactly the old behaviour
  page = await openHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('cardFlip', 'off'); window.HubSettings.set('intro', 'off');
    window.HubSettings.set('stealOnWrong', false, 'jeopardy');
    window.HubSettings.set('keepControl', false, 'jeopardy');
  });
  await startGame(page, 'Jeopardy', { sections:3 });
  const before = await activeTeam(page);
  await openFirstClue(page);
  await page.locator('#wrong-btn').click(); await page.waitForTimeout(1300);
  check('switched off, a miss closes the question', !(await page.locator('#clue-modal').isVisible()));
  check('switched off, a miss burns the tile', await page.locator('#board .tile.used').count() === 1);
  check('switched off, a miss passes the turn', await activeTeam(page) !== before);
  check('and nothing was scored', (await scores(page)).every(v => v === '0'), (await scores(page)).join('/'));

  // ---- keep control, both ways
  await page.evaluate(() => window.HubSettings.set('keepControl', false, 'jeopardy'));
  await startGame(page, 'Jeopardy', { sections:3 });
  const heldBefore = await activeTeam(page);
  await openFirstClue(page);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(1300);
  check('with keep-control off, a correct answer hands over', await activeTeam(page) !== heldBefore);

  await page.evaluate(() => window.HubSettings.set('keepControl', true, 'jeopardy'));
  await startGame(page, 'Jeopardy', { sections:3 });
  const keptBefore = await activeTeam(page);
  await openFirstClue(page);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(1300);
  check('with it on, the team keeps the board', await activeTeam(page) === keptBefore);
  checkClean(page, 'steal off');
  await page.close();

  // ---- streak: three in a row for one team
  page = await openHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('cardFlip', 'off'); window.HubSettings.set('intro', 'off');
    window.HubSettings.set('keepControl', true, 'jeopardy');
    window.HubSettings.set('streak', true, 'jeopardy');
  });
  await startGame(page, 'Jeopardy', { sections:3 });
  const paid = [];
  for (let i = 0; i < 3; i++){
    const tile = page.locator('#board .tile:not(.used)').first();
    const value = parseInt((await tile.innerText()).replace(/\D/g, ''), 10);
    await tile.click(); await page.waitForTimeout(450);
    await page.locator('#reveal-btn').click(); await page.waitForTimeout(180);
    const was = parseInt((await scores(page))[0], 10);
    await page.locator('#correct-btn').click(); await page.waitForTimeout(1200);
    paid.push({ value, gained: parseInt((await scores(page))[0], 10) - was });
  }
  check('the first answer of a run pays face value', paid[0].gained === paid[0].value,
        JSON.stringify(paid[0]));
  check('the second pays one and a half', paid[1].gained === paid[1].value * 1.5,
        JSON.stringify(paid[1]));
  check('the third pays double', paid[2].gained === paid[2].value * 2, JSON.stringify(paid[2]));
  checkClean(page, 'streak');
  await page.close();

  // ---- Millionaire hands a missed rung to the other team
  page = await openHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('intro', 'off');
    window.HubSettings.set('stealOnWrong', true, 'millionaire');
  });
  await startGame(page, 'Millionaire', { sections:'all' });
  const right = await currentMillionaireAnswer(page);
  const wrong = await page.evaluate(r => {
    const b = [...document.querySelectorAll('#m-options .m-option')].find(x => x.dataset.opt !== r);
    return b ? b.dataset.opt : null;
  }, right);
  await playMillionaireOption(page, page.locator('.m-option', { hasText: wrong }));
  await page.waitForTimeout(900);
  check('a missed rung is offered to the other team',
        /steal it for 50/i.test(await page.locator('#m-hint').innerText()),
        await page.locator('#m-hint').innerText());
  /* The stealing team gets the same two beats, not a shortcut — the steal reopens
     the question rather than resuming a half-answered one. */
  await playMillionaireOption(page, page.locator('.m-option', { hasText: right }));
  await page.waitForTimeout(900);
  check('and the stealing team banks half the rung',
        (await scores(page))[1] === '50', (await scores(page)).join('/'));
  checkClean(page, 'millionaire steal');
  await page.close();
}

const tension = page =>
  page.evaluate(() => document.getElementById('play-millionaire').style.getPropertyValue('--tension'));

/* Clicking options at random and hoping made this test flaky — one in four, and a
   run that got unlucky reported the feature broken. The answer isn't in the DOM
   before it is given (deliberately), so look the prompt up in the loaded content
   bank instead and climb the ladder deterministically. */
async function answerCorrectly(page){
  // one lookup, not a second copy of it: this had its own raw-string version and
  // silently stopped finding anything the moment Kit.prompt started rendering `___`
  // as a blank, which read as "tension never climbs" rather than "lookup broke"
  const answer = await currentMillionaireAnswer(page);
  if (!answer) return false;
  const opt = page.locator('#m-options .m-option[data-opt="' + answer.replace(/"/g,'\\"') + '"]');
  if (!(await opt.count())) return false;
  await playMillionaireOption(page, opt);
  await page.waitForTimeout(900);
  return true;
}

async function testSettingsMigration(browser){
  section('Old settings still apply');
  const page = await openHub(browser);
  await page.evaluate(() => localStorage.setItem('engishism.gamehub.settings',
    JSON.stringify({ sound:false, soundVolume:'loud', raceRoundSeconds:90 })));
  await page.reload(); await page.waitForTimeout(400);
  const got = await page.evaluate(() => ({
    sound:  window.HubSettings.get('sound','race'),
    volume: window.HubSettings.get('soundVolume','jeopardy'),
    round:  window.HubSettings.get('raceRoundSeconds','race')
  }));
  check('a pre-scoping value is read as the master', got.sound === false, JSON.stringify(got));
  check('and applies to every game', got.volume === 'loud' && got.round === 90, JSON.stringify(got));

  /* The three phone booleans became one `phoneMode`. A per-game override is
     exactly what a teacher sets deliberately, so it must be translated rather
     than silently ignored — and the dead keys must go, or the translation runs
     again over a choice since changed. */
  await page.evaluate(() => localStorage.setItem('engishism.gamehub.settings',
    JSON.stringify({ phoneWrite:true,
                     'phoneBuzzGames@race':true,
                     'phoneVote@millionaire':true })));
  await page.reload(); await page.waitForTimeout(400);
  const ph = await page.evaluate(() => ({
    master: window.HubSettings.get('phoneMode'),
    race:   window.HubSettings.get('phoneMode','race'),
    mill:   window.HubSettings.get('phoneMode','millionaire'),
    jeo:    window.HubSettings.get('phoneMode','jeopardy'),
    left:   Object.keys(JSON.parse(localStorage.getItem('engishism.gamehub.settings')))
              .filter(k => /^phone(Write|Vote|BuzzGames)/.test(k))
  }));
  check('an old master phone switch becomes the mode', ph.master === 'write', JSON.stringify(ph));
  check('and an old per-game one becomes that game\'s mode',
        ph.race === 'buzz', JSON.stringify(ph));
  /* `phoneVote` translates to nothing at all: voting stopped being a mode and became
     what Ask the class does with whatever room is open, so the teacher who had only
     that switched on wants no per-question dynamic — and still gets the vote. */
  check('the old vote switch leaves no mode behind, because voting is not one',
        ph.mill === 'write', ph.mill);
  check('a game with no override still follows the master', ph.jeo === 'write', ph.jeo);
  check('the replaced keys are cleared, so it runs once', ph.left.length === 0, ph.left.join(','));

  /* Once translated, a later choice must stand: reloading again cannot resurrect
     the old value, because there is nothing left to translate from. */
  await page.evaluate(() => window.HubSettings.set('phoneMode','off','race'));
  await page.reload(); await page.waitForTimeout(400);
  check('a mode chosen after the migration survives a reload',
        await page.evaluate(() => window.HubSettings.get('phoneMode','race')) === 'off');

  /* `vote` shipped as a phoneMode value, so it is in real localStorage — and a value
     naming a variant that no longer exists is the worst kind: nothing matches it, so
     the phones go quiet while the panel still claims a dynamic is running. */
  await page.evaluate(() => localStorage.setItem('engishism.gamehub.settings',
    JSON.stringify({ phoneMode:'vote', 'phoneMode@millionaire':'vote',
                     'phoneMode@race':'buzz' })));
  await page.reload(); await page.waitForTimeout(400);
  const vm = await page.evaluate(() => ({
    master: window.HubSettings.get('phoneMode'),
    mill:   window.HubSettings.get('phoneMode','millionaire'),
    race:   window.HubSettings.get('phoneMode','race')
  }));
  check('a mode that no longer exists becomes off, not a dead value',
        vm.master === 'off' && vm.mill === 'off', JSON.stringify(vm));
  check('and a mode that still exists is left alone', vm.race === 'buzz', vm.race);
  check('vote is no longer offered as something the phones do',
        await page.evaluate(() => window.HubSettings.variantsFor('phoneMode','millionaire')
          .every(v => v.value !== 'vote')));

  await page.evaluate(() => localStorage.removeItem('engishism.gamehub.settings'));
  checkClean(page);
  await page.close();
}

/* ---- the Lab drawer ----
   Settings for one game, reachable without leaving the board. The point is
   comparing iterations *between rounds*, so the thing to assert is that it shows
   the active game's switches and nothing else, that changing one there writes a
   per-game override rather than the master, and that it cannot be left open over
   a screen it does not belong to. */
async function testLabDrawer(browser){
  section('Settings drawer — one gear, whose form suits the moment');
  const page = await openHub(browser);
  await page.evaluate(() => window.HubSettings.set('intro','off'));

  /* One entrance. Before a game the gear is the full panel; during play it is the
     docked drawer for the game being played — same registry, same rows. The
     separate Lab button is gone. */
  check('there is no separate Lab button any more',
        await page.locator('#lab-btn').count() === 0);
  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  check('before a game, the gear opens the full panel',
        await page.locator('#settings-modal').isVisible() &&
        await page.locator('#lab-drawer.on').count() === 0);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);

  await startGame(page, 'Race to the Board', { sections:'all' });
  await page.waitForTimeout(400);

  await page.locator('#settings-btn').click(); await page.waitForTimeout(300);
  check('during play, the same gear opens the docked drawer',
        await page.locator('#lab-drawer.on').count() === 1 &&
        !(await page.locator('#settings-modal').isVisible()));
  check('titled with the game being played',
        /race to the board/i.test(await page.locator('#lab-title').innerText()),
        await page.locator('#lab-title').innerText());

  const rows = await page.locator('#lab-body .settings-row').count();
  check('it carries that game\'s switches', rows > 0, String(rows));
  const labels = (await page.locator('#lab-body .settings-row').allInnerTexts()).join(' | ');
  check('including one this game has and another game does not',
        /re-scatter|round length/i.test(labels), labels.slice(0,160));
  check('and not one that belongs to a different game only',
        !/lifelines/i.test(labels), labels.slice(0,160));

  /* Changing it here is an override for this game, not a change to every game —
     otherwise trying an idea mid-round quietly rewrites the other three. */
  const before = await page.evaluate(() => window.HubSettings.get('phoneMode'));
  const modeSel = page.locator('#lab-body [data-setting="phoneMode"]');
  check('the phone dynamic is one picker, not a row of switches',
        await modeSel.count() === 1 && await modeSel.evaluate(e => e.tagName) === 'SELECT',
        String(await modeSel.count()));
  await modeSel.selectOption('write'); await page.waitForTimeout(200);
  check('a change in the lab is scoped to this game',
        await page.evaluate(() => window.HubSettings.get('phoneMode','race')) === 'write');
  check('and leaves every other game alone',
        await page.evaluate(() => window.HubSettings.get('phoneMode')) === before,
        String(await page.evaluate(() => window.HubSettings.get('phoneMode'))));

  /* A drawer you cannot see past is a drawer you cannot use mid-round: the header
     holds New game, the timer and ⚙, the team bar holds the ± score buttons, and
     a full-height panel covered all of them. This failed the first time it ran. */
  const clear = async (sel) => {
    const [box, drawer] = await Promise.all([
      page.locator(sel).boundingBox(), page.locator('#lab-drawer').boundingBox()
    ]);
    return !!box && !!drawer && (box.y + box.height <= drawer.y + 1 || box.y >= drawer.y + drawer.height - 1);
  };
  check('the header stays reachable with the drawer open', await clear('#new-game-btn'));
  check('so does the timer', await clear('#timer-widget'));
  check('and the team bar', await clear('#scorebar'));

  /* And the board gives up the width rather than hiding under the panel — the
     first version covered two of Millionaire's four options, which makes the
     drawer useless for the thing it is for: changing a rule and watching the
     next question play under it. Measured on the stage the registry names, and
     on its contents, because a stage whose box stops at the drawer can still
     have children overflowing past it. */
  const drawerBox = await page.locator('#lab-drawer').boundingBox();
  const over = await page.evaluate(edge => {
    const stage = window.HubGames.get('race').stage;   // an element id, not a selector
    const root = document.getElementById(stage);
    if(!root) return ['no stage'];
    return [root, ...root.querySelectorAll('*')]
      .filter(el => { const r = el.getBoundingClientRect();
                      return r.width > 4 && r.height > 4 && r.right > edge + 2; })
      .slice(0,3).map(el => el.className + ' ' + Math.round(el.getBoundingClientRect().right));
  }, drawerBox.x);
  check('the board re-fits into what is left, rather than hiding under it',
        over.length === 0, over.join(' | '));

  await page.keyboard.press('l'); await page.waitForTimeout(250);
  check('L closes it', await page.locator('#lab-drawer.on').count() === 0);
  await page.keyboard.press('l'); await page.waitForTimeout(250);
  check('and opens it again', await page.locator('#lab-drawer.on').count() === 1);

  /* The rare cross-game edit mid-round: the drawer hands over to the full panel,
     already on this game's tab. */
  await page.locator('#lab-all').click(); await page.waitForTimeout(250);
  check('"All games" hands over to the full panel',
        await page.locator('#settings-modal').isVisible() &&
        await page.locator('#lab-drawer.on').count() === 0);
  check('landing on the tab for the game being played',
        /race/i.test(await page.locator('.settings-tab.on').innerText()),
        await page.locator('.settings-tab.on').innerText());
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);

  /* Leaving the board must take the drawer with it — a panel about Race hanging
     over the game-select screen is a bug the user would meet immediately. */
  await page.keyboard.press('l'); await page.waitForTimeout(250);
  await page.locator('#new-game-btn').click(); await page.waitForTimeout(400);
  check('leaving the play screen closes it', await page.locator('#lab-drawer.on').count() === 0);

  /* The ruleset leads a game's settings, and every row a bundle touches says what
     the chosen mode set it to — advisory beside the control, which stays the
     truth. Checked on Jeopardy, the game that has a ruleset. */
  const rules = await page.evaluate(() => {
    window.HubSettings.set('jRules','classic','jeopardy');
    const host = document.createElement('div');
    document.body.appendChild(host);
    window.HubSettings.renderFor(host, 'jeopardy');
    const out = {
      first:  (host.querySelector('.settings-group')||{textContent:''}).textContent,
      note10: /Classic sets this to 10s/.test(host.textContent),
      noteOn: /Classic sets this to on/.test(host.textContent)
    };
    host.remove();
    window.HubSettings.set('jRules','hub','jeopardy');
    return out;
  });
  check('the ruleset section leads the game view', rules.first === 'Ruleset', rules.first);
  check('and rows the ruleset governs say what it set them to',
        rules.note10 && rules.noteOn, JSON.stringify(rules));

  /* Folding: a group header closes its rows and opens them again. */
  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  const firstFold = page.locator('#settings-body .settings-group.foldable').first();
  const bodySel = '#settings-body .settings-groupbody';
  const openBodies = await page.locator(bodySel + ':not(.closed)').count();
  await firstFold.click(); await page.waitForTimeout(150);
  check('a group header folds its rows away',
        await page.locator(bodySel + ':not(.closed)').count() === openBodies - 1);
  await firstFold.click(); await page.waitForTimeout(150);
  check('and unfolds them again',
        await page.locator(bodySel + ':not(.closed)').count() === openBodies);
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.HubSettings.clearOverride('phoneMode','race'));
  checkClean(page);
  await page.close();
}

/* A weight is only tunable if it can be tuned — `type:'range'` is the control that
   makes "change the weights" a slider rather than an edit to the source. */
async function testRangeSetting(browser){
  section('Tunable weights');
  const page = await openHub(browser);
  const has = await page.evaluate(() => {
    window.HubSettings.register({ id:'__testWeight', group:'Competition', type:'range',
      default:2, min:1, max:5, step:0.5, unit:'×', games:window.HubGames.ids(),
      label:'Test weight', help:'Only registered by the smoke test.' });
    return window.HubSettings.get('__testWeight');
  });
  check('a range setting reads its default', has === 2, String(has));
  await page.locator('#settings-btn').click(); await page.waitForTimeout(300);
  const box = page.locator('[data-setting="__testWeight"]');
  const input = box.locator('input[type=range]');
  check('it renders as a slider', await input.count() === 1);
  check('with its bounds from the registration',
        await input.getAttribute('min') === '1' && await input.getAttribute('max') === '5',
        (await input.getAttribute('min')) + '-' + (await input.getAttribute('max')));
  check('and reads its value back before it is touched',
        /^2×/.test((await box.innerText()).trim()), (await box.innerText()).trim());
  await input.fill('4'); await input.dispatchEvent('input'); await input.dispatchEvent('change');
  await page.waitForTimeout(200);
  /* A weight arriving as the string "4" would compare, concatenate and multiply
     wrongly everywhere it is used — the whole reason for a typed control. */
  check('dragging it stores a number, not a string',
        await page.evaluate(() => window.HubSettings.get('__testWeight')) === 4,
        JSON.stringify(await page.evaluate(() => window.HubSettings.get('__testWeight'))));
  check('and says where it now sits', /^4×/.test((await box.innerText()).trim()),
        (await box.innerText()).trim());
  await page.locator('#settings-close').click();
  checkClean(page);
  await page.close();
}

async function testFlipVariants(browser){
  section('Card animation variants');
  const page = await openHub(browser);
  const names = await page.evaluate(() => window.HubKit.anim.names('cardFlip'));
  check('several animations are registered', names.length >= 3, names.join(','));

  /* The card is the one overlay the skin never covered: a lit board opened a white
     DCU card. Assert both directions, because the skin has twice silently cancelled
     something it was supposed to leave alone. */
  const look = async theme => {
    await page.evaluate(t => { window.HubSettings.set('theme', t); window.HubSettings.set('cardFlip','off'); }, theme);
    await startGame(page, 'Jeopardy', { sections:3 });
    await page.locator('.tile').first().click(); await page.waitForTimeout(400);
    const out = await page.evaluate(() => ({
      back:  getComputedStyle(document.getElementById('clue-back')).backgroundImage,
      front: getComputedStyle(document.getElementById('clue-front')).backgroundImage
    }));
    await page.locator('#close-btn').click(); await page.waitForTimeout(300);
    return out;
  };
  const gs  = await look('gameshow');
  const dcu = await look('dcu');
  check('the clue card is skinned in game show mode', gs.back !== 'none' && gs.front !== 'none',
        gs.back.slice(0, 40));
  check('and is left alone in DCU', dcu.back === 'none' && dcu.front === 'none', dcu.back.slice(0, 40));
  await page.evaluate(() => window.HubSettings.set('theme', 'gameshow'));

  for (const name of names){
    await page.evaluate(n => window.HubSettings.set('cardFlip', n), name);
    await startGame(page, 'Jeopardy', { sections:3 });
    const tile = page.locator('.tile').first();
    await tile.click(); await page.waitForTimeout(120);
    const running = await page.evaluate(() => document.getElementById('clue-card').getAnimations().length);
    check(name + ': animates', running === 1, running + ' animations');

    /* The value face must never be on screen once it has turned away from the room,
       or it is painted mirrored — "$100" reading backwards, which shipped for
       months because the only thing that ever hid it was the .flipped class, and
       that arrives after the turn is over. Sample the turn rather than trusting
       backface-visibility, which was culling the wrong face of the two. */
    const bad = await page.evaluate(async () => {
      const card  = document.getElementById('clue-card');
      const front = document.getElementById('clue-front');
      const back  = document.getElementById('clue-back');
      let mirrored = 0, blank = 0;
      for(let i = 0; i < 30; i++){
        const m = new DOMMatrixReadOnly(getComputedStyle(card).transform);
        const deg = Math.atan2(-m.m13, m.m11) * 180 / Math.PI;
        const fv = getComputedStyle(front).visibility === 'visible';
        const bv = getComputedStyle(back).visibility === 'visible';
        if(Math.abs(deg) > 91 && fv && !card.classList.contains('flipped')) mirrored++;
        if(!fv && !bv) blank++;                       // neither face on screen
        await new Promise(r => setTimeout(r, 40));
      }
      return { mirrored, blank };
    });
    check(name + ': the value never shows mirrored', bad.mirrored === 0, bad.mirrored + ' frames');
    check(name + ': a face is on screen throughout', bad.blank === 0, bad.blank + ' blank frames');

    await page.waitForTimeout(1800);
    check(name + ': lands on the clue face', await page.locator('#clue-card.flipped').count() === 1);
    check(name + ': the clue is readable', (await page.locator('#clue-text').innerText()).length > 0);
    await page.locator('#close-btn').click();
    await page.waitForFunction(() => document.getElementById('clue-modal').style.display === 'none', null, { timeout:8000 });
    check(name + ': closes cleanly', true);
  }

  // morph reads the shape of whatever was clicked, so the card genuinely starts as
  // a hexagon in Blockbusters and as the tile's own corner radius in Jeopardy
  await page.evaluate(() => window.HubSettings.set('cardFlip', 'morph'));
  await startGame(page, 'Blockbusters', { sections:'all' });
  const hexClip = await page.evaluate(() => getComputedStyle(document.querySelector('.hex')).clipPath);
  await page.locator('.hex').first().click(); await page.waitForTimeout(140);
  const mid = await page.evaluate(() => getComputedStyle(document.getElementById('clue-front')).clipPath);
  check('morph: the card starts as a polygon in Blockbusters', mid.indexOf('polygon') === 0, mid);
  check('morph: mid-flight it is neither the hexagon nor the rectangle',
        mid !== hexClip && !/100% 0%.*100% 100%/.test(mid), mid);
  await page.waitForTimeout(1700);
  const done = await page.evaluate(() => getComputedStyle(document.getElementById('clue-front')).clipPath);
  check('morph: it finishes as the full rectangle',
        /50% 0%.*100% 0%.*100% 100%/.test(done), done);
  check('morph: the flip still completes', await page.locator('#clue-card.flipped').count() === 1);
  await page.locator('#skip-btn').click(); await page.waitForTimeout(1700);

  // same variant, a board with no polygon: falls back to the corner radius
  await startGame(page, 'Jeopardy', { sections:3 });
  await page.locator('.tile').first().click(); await page.waitForTimeout(160);
  const r = await page.evaluate(() => ({
    tile: parseFloat(getComputedStyle(document.querySelector('.tile')).borderRadius),
    live: parseFloat(getComputedStyle(document.getElementById('clue-front')).borderRadius)
  }));
  check('morph: a plain tile morphs its corner radius instead', r.live > r.tile, JSON.stringify(r));
  await page.waitForTimeout(1700);
  await page.locator('#close-btn').click(); await page.waitForTimeout(1700);

  // a variant restricted to one game must not be offered to another, and must not
  // be silently used if it somehow gets selected
  const filtered = await page.evaluate(() => {
    window.HubSettings.register({ id:'__probe', type:'variant', default:'a',
      games:['jeopardy','blockbusters'], label:'probe',
      variants:[{value:'a'}, {value:'b', games:['blockbusters']}] });
    return { jeo: window.HubSettings.variantsFor('__probe','jeopardy').map(v=>v.value),
             bb:  window.HubSettings.variantsFor('__probe','blockbusters').map(v=>v.value),
             all: window.HubSettings.variantsFor('__probe').map(v=>v.value) };
  });
  check('a game-restricted variant is hidden from other games',
        filtered.jeo.join() === 'a' && filtered.bb.join() === 'a,b' && filtered.all.join() === 'a,b',
        JSON.stringify(filtered));

  // 'off' must skip animating entirely but still open
  await page.evaluate(() => window.HubSettings.set('cardFlip', 'off'));
  await startGame(page, 'Jeopardy', { sections:3 });
  await page.locator('.tile').first().click(); await page.waitForTimeout(150);
  check('off: nothing animates',
        await page.evaluate(() => document.getElementById('clue-card').getAnimations().length) === 0);
  check('off: the card still opens', await page.locator('#clue-modal').isVisible());
  await page.evaluate(() => window.HubSettings.resetAll());

  checkClean(page);
  await page.close();
}

async function testBuzzers(browser){
  section('Phone buzzers');
  const host = await openHub(browser);
  // 'buzzers' is the infrastructure switch; phoneMode is what the phones are asked
  // to *do*, and it decides in every game now — Race no longer buzzes by default
  await host.evaluate(() => { window.HubSettings.set('buzzers', true);
                              window.HubSettings.set('phoneMode', 'buzz', 'race'); });
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
  /* Who buzzed is on the strip, not the chip: the chip is the room's identity and a
     class is still reading the join address off it while the first student buzzes. */
  check('the winner is shown on the host', (await host.locator('#phone-bar').innerText()).includes('Bruno'));
  check('the loser is locked out', await alina.locator('#buzzer').isDisabled());

  const answer = await currentRaceAnswer(host);
  await host.locator('.race-word', { hasText: new RegExp('^' + answer + '$','i') }).first().click();
  await host.waitForTimeout(600);
  check('a buzz scores its team with no chooser', await host.locator('#race-claim').isVisible() === false);
  check('the buzzing team got the point', (await scores(host))[1] === '1', (await scores(host)).join('/'));

  /* A team that buzzed and missed must not be able to buzz straight back in — that
     is a retry, not a steal, and it leaves the other team nothing to win. */
  await host.waitForTimeout(700);
  const next = await currentRaceAnswer(host);
  /* Wait for the arm to actually reach the phone rather than assuming it has.
     The relay pushes over SSE, so "the host re-armed" and "this handset's button
     is live again" are not the same instant — clicking on that gap made this test
     fail on timing while the feature was working correctly. */
  const armed = async (phone, who) => {
    try { await phone.locator('#buzzer:not([disabled])').waitFor({ timeout: 8000 }); return true; }
    catch(e){ return false; }
  };
  check('a fresh sentence armed the buzzers again', await armed(bruno));
  await bruno.locator('#buzzer').click(); await host.waitForTimeout(500);
  await host.locator('.race-word')
            .filter({ hasNotText: new RegExp('^' + next + '$','i') }).first().click();
  await host.waitForTimeout(600);

  check('the steal re-opens the buzzers', await armed(bruno));
  await bruno.locator('#buzzer').click(); await host.waitForTimeout(600);
  check('the team that missed cannot buzz back in',
        !(await host.locator('#phone-bar').innerText()).includes('Bruno'),
        (await host.locator('#phone-bar').innerText()).replace(/\n/g,' '));
  await armed(alina);
  await alina.locator('#buzzer').click(); await host.waitForTimeout(600);
  check('but the other team can still take the steal',
        (await host.locator('#phone-bar').innerText()).includes('Alina'),
        (await host.locator('#phone-bar').innerText()).replace(/\n/g,' '));

  /* A live buzz must survive the room being re-asked. `reaskPhones` runs on every
     `ready` from the relay — which is every reconnection of the host's stream, not
     just the first — and re-arming clears the winner, so a student's buzz was being
     thrown away and the buzzers quietly reopened. On school wifi that is not an edge
     case, it is what a dropped connection does. Driven here through a settings
     change, which reaches the same path deliberately: changing a dynamic in the Lab
     mid-question must not take the floor off whoever is standing on it either. */
  await host.evaluate(() => window.HubSettings.set('phoneMode', 'buzz', 'race'));
  await host.waitForTimeout(700);
  check('re-asking the room does not throw away a live buzz',
        (await host.locator('#phone-bar').innerText()).includes('Alina'),
        (await host.locator('#phone-bar').innerText()).replace(/\n/g,' '));
  check('and the phone that lost the race is still locked out',
        await bruno.locator('#buzzer').isDisabled());

  for (const p of [alina, bruno]) { check('phone had no errors', p.__errors.length === 0, p.__errors[0]); await p.close(); }
  checkClean(host, 'host');
  await host.close();
}

/* ---- phones: the prototype modes ----
   The channel can ask the room three different things: race for the floor (buzz),
   pick one (vote), or type it (answer). Each is asserted end to end with real
   phones, plus the two properties that make them safe to leave in: switched off
   nothing changes, and with no relay the games play exactly as before. */
async function testPhoneModes(browser){
  section('Phones — ask the room');

  const openRoom = async (game, prefs, opts) => {
    const host = await openHub(browser);
    await host.evaluate(p => {
      window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
      window.HubSettings.set('buzzers', true);
      Object.keys(p).forEach(k => { if(k !== '__g') window.HubSettings.set(k, p[k], p.__g); });
    }, prefs);
    await startGame(host, game, Object.assign({ sections:'all' }, opts || {}));
    await host.waitForTimeout(700);
    const chip = await host.locator('#buzzer-chip').innerText().catch(()=>'');
    return { host, code:(chip.match(/CODE\s+(\d{5})/i)||[])[1] };
  };
  const join = async (code, name, team) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(250);
    await p.fill('#code', code); await p.fill('#name', name);
    await p.locator('.teams button').nth(team).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(500);
    return p;
  };

  // ---- typing: the whole class answers, not one student
  const w = await openRoom('Jeopardy', { __g:'jeopardy', phoneMode:'write', phoneOneEach:true });
  check('a room opens for a game that wants phones', !!w.code, w.code || 'none');
  if (w.code){
    const ana = await join(w.code, 'Ana', 0), ben = await join(w.code, 'Ben', 1);
    await w.host.waitForTimeout(400);
    await w.host.locator('#board .tile').first().click(); await w.host.waitForTimeout(800);
    check('the question reaches the phone',
          (await ana.locator('#qtext').innerText()).trim().length > 0);
    check('the phone becomes a text box, not a buzzer',
          await ana.locator('#write').isVisible() && !(await ana.locator('#buzzer').isVisible()));
    for (const [p, t] of [[ana,'custody'],[ben,'prison']]){
      await p.fill('#reply', t); await p.locator('#send').click(); await p.waitForTimeout(350);
    }
    await w.host.waitForTimeout(700);
    const replies = await w.host.locator('#phone-bar').innerText();
    check('every answer comes back with who wrote it',
          /Ana: custody/.test(replies) && /Ben: prison/.test(replies), replies.replace(/\n/g,' | '));
    check('a student who has answered cannot answer twice',
          await ana.locator('#reply').isDisabled());
    for (const p of [ana, ben]){ check('phone had no errors', p.__errors.length === 0, p.__errors[0]); await p.close(); }
  }
  checkClean(w.host, 'typing');
  await w.host.close();

  /* ---- voting: Ask the class as a real poll ----
     Not a mode any more — the lifeline borrows whatever room is open. So this runs
     with the phones set to do *nothing* during a question, which is both the
     hardest case (the room has to exist before anyone asks for it) and the one a
     teacher who has not touched the settings actually gets. */
  const v = await openRoom('Millionaire', { __g:'millionaire', phoneMode:'off' });
  check('a room opens for Ask the class even with the phones idle', !!v.code, v.code || 'none');
  if (v.code){
    check('and the chip says the phones are for voting, not that they are useless',
          /votes only/i.test(await v.host.locator('#buzzer-chip').innerText()),
          (await v.host.locator('#buzzer-chip').innerText()).replace(/\n/g,' '));
    const ana = await join(v.code, 'Ana', 0), ben = await join(v.code, 'Ben', 1);
    await v.host.waitForTimeout(400);
    check('the phone is idle until the lifeline is used',
          !(await ana.locator('#opts').isVisible()) && await ana.locator('#buzzer').isDisabled());
    await v.host.locator('.lifeline[data-life="class"]').click(); await v.host.waitForTimeout(700);
    check('the phone offers the four options', await ana.locator('#opts button').count() === 4);
    await ana.locator('#opts button').first().click(); await v.host.waitForTimeout(300);
    await ben.locator('#opts button').first().click(); await v.host.waitForTimeout(600);
    check('the votes land on the board',
          (await v.host.locator('.m-votes').allInnerTexts())[0] === '2',
          (await v.host.locator('.m-votes').allInnerTexts()).join('/'));
    /* And the board stays answerable. With phones voting there are no hands to tap,
       so turning the options into a tally pad only dead-ends the round: the counts
       arrive over the wire and the teacher's next click is the team's answer. The
       button is there, but it closes the vote — it is not a tally pad. */
    check('the vote is closed, not counted, when the phones are doing it',
          (await v.host.locator('#m-done-count').innerText()).trim() === 'Done voting',
          await v.host.locator('#m-done-count').innerText());
    /* Answer it correctly on purpose. Clicking whichever option the shuffle put
       first made this a coin toss: a wrong one is legitimately answered *and* then
       handed to the other team by stealOnWrong, which reopens the question — so
       there is no "Next team" and the reveal classes are cleared again. Neither
       outcome is a bug, and neither is what this check is about. */
    const vAnswer = await currentMillionaireAnswer(v.host);
    await playMillionaireOption(v.host,
      v.host.locator('#m-options .m-option[data-opt="' + vAnswer.replace(/"/g,'\\"') + '"]'));
    await v.host.waitForTimeout(500);
    check('clicking an option answers instead of adding a phantom hand',
          await v.host.locator('#m-next').isVisible(),
          await v.host.locator('#m-hint').innerText());
    for (const p of [ana, ben]) await p.close();
  }
  checkClean(v.host, 'voting');
  await v.host.close();

  /* The borrowing has to end as explicitly as it starts. A class set to buzz for
     the floor must get its buzzer back when the vote closes — otherwise using a
     lifeline silently costs the room its dynamic for the rest of the question. */
  const vb = await openRoom('Millionaire', { __g:'millionaire', phoneMode:'buzz' });
  if (vb.code){
    const ana = await join(vb.code, 'Ana', 0);
    await vb.host.waitForTimeout(500);
    check('the phone is a buzzer while the question is live',
          await ana.locator('#buzzer').isVisible() && !(await ana.locator('#opts').isVisible()));
    await vb.host.locator('.lifeline[data-life="class"]').click(); await vb.host.waitForTimeout(700);
    check('the vote borrows the buzzer',
          await ana.locator('#opts').isVisible() && !(await ana.locator('#buzzer').isVisible()));
    await vb.host.locator('#m-done-count').click(); await vb.host.waitForTimeout(700);
    /* Visibility, not the option buttons: the vote leaves its four buttons in the
       phone's DOM and only hides them, so counting them says nothing about what the
       student is looking at. */
    check('and closing the vote gives it back',
          !(await ana.locator('#opts').isVisible()) &&
          await ana.locator('#buzzer').isVisible() &&
          !(await ana.locator('#buzzer').isDisabled()),
          await ana.locator('#state').innerText().catch(()=>''));
    check('the counts stay on the board after the vote closes',
          (await vb.host.locator('.m-votes').count()) === 4);
    check('phone had no errors', ana.__errors.length === 0, ana.__errors[0]);
    await ana.close();
  }
  checkClean(vb.host, 'vote hands the phones back');
  await vb.host.close();

  // ---- buzzing for the floor in a tile game
  const bz = await openRoom('Jeopardy', { __g:'jeopardy', phoneMode:'buzz' });
  if (bz.code){
    const ben = await join(bz.code, 'Ben', 1);
    await bz.host.waitForTimeout(400);
    await bz.host.locator('#board .tile').first().click(); await bz.host.waitForTimeout(800);
    check('the phone arms as a buzzer', !(await ben.locator('#buzzer').isDisabled()));
    await ben.locator('#buzzer').click(); await bz.host.waitForTimeout(600);
    check('buzzing picks that team to answer',
          await bz.host.evaluate(() =>
            [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active'))) === 1);
    await ben.close();
  }
  checkClean(bz.host, 'buzzing');
  await bz.host.close();

  /* ---- what a buzz wins in Millionaire ----
     Its ladder is per team and its turn order is fixed so everyone gets a full arc,
     so "fastest thumb wins" is not automatically the right answer here. All three
     answers are offered; each has to actually do what its label says. */
  const mTurn = host => host.evaluate(() =>
    [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active')));

  // speaker: the buzz names who answers for the team already on turn, and a phone
  // from the other team cannot take the turn off them
  const sp = await openRoom('Millionaire', { __g:'millionaire', phoneMode:'buzz', mBuzzRole:'speaker' });
  if (sp.code){
    const before = await mTurn(sp.host);
    const other  = await join(sp.code, 'Bea', before === 0 ? 1 : 0);
    await sp.host.waitForTimeout(500);
    await other.locator('#buzzer').click(); await sp.host.waitForTimeout(700);
    check('speaker: a buzz from off-turn does not take the turn',
          await mTurn(sp.host) === before, 'turn moved to ' + await mTurn(sp.host));
    /* And it must re-arm rather than swallow the buzz: the relay locks the room on
       the first buzz whoever sent it, so a refused phone left holding the lock would
       keep the team that *is* entitled from ever getting in. */
    const onTurn = await join(sp.code, 'Ali', before);
    await sp.host.waitForTimeout(500);
    check('speaker: the room re-armed, so the team on turn can still buzz',
          !(await onTurn.locator('#buzzer').isDisabled()));
    await onTurn.locator('#buzzer').click(); await sp.host.waitForTimeout(600);
    check('speaker: their buzz is the one that shows',
          (await sp.host.locator('#phone-bar').innerText()).includes('Ali'),
          (await sp.host.locator('#phone-bar').innerText()).replace(/\n/g,' '));
    for (const p of [other, onTurn]) await p.close();
  }
  checkClean(sp.host, 'millionaire buzz speaker');
  await sp.host.close();

  // floor: whoever buzzes first takes the question, on their own ladder
  const fl = await openRoom('Millionaire', { __g:'millionaire', phoneMode:'buzz', mBuzzRole:'floor' });
  if (fl.code){
    const before = await mTurn(fl.host);
    const want   = before === 0 ? 1 : 0;
    const bea    = await join(fl.code, 'Bea', want);
    await fl.host.waitForTimeout(500);
    await bea.locator('#buzzer').click(); await fl.host.waitForTimeout(700);
    check('floor: a buzz takes the question for that team',
          await mTurn(fl.host) === want, 'turn is ' + await mTurn(fl.host) + ', wanted ' + want);
    check('floor: and the board says so', (await fl.host.locator('#m-turn').innerText()).length > 0);
    await bea.close();
  }
  checkClean(fl.host, 'millionaire buzz floor');
  await fl.host.close();

  // off: the buzz is shown and changes nothing — what it did before the setting
  const bo = await openRoom('Millionaire', { __g:'millionaire', phoneMode:'buzz', mBuzzRole:'off' });
  if (bo.code){
    const before = await mTurn(bo.host);
    const bea    = await join(bo.code, 'Bea', before === 0 ? 1 : 0);
    await bo.host.waitForTimeout(500);
    await bea.locator('#buzzer').click(); await bo.host.waitForTimeout(700);
    check('off: the buzz shows on the chip',
          (await bo.host.locator('#phone-bar').innerText()).includes('Bea'),
          (await bo.host.locator('#phone-bar').innerText()).replace(/\n/g,' '));
    check('off: and the turn is untouched', await mTurn(bo.host) === before);
    await bea.close();
  }
  checkClean(bo.host, 'millionaire buzz off');
  await bo.host.close();

  /* ---- Race timed rounds ask the phones too ----
     This was `if(raceMode==='h2h')`, so half of Race ignored phoneMode entirely and
     the phones sat idle whatever the teacher had picked. */
  const rt = await openRoom('Race to the Board', { __g:'race', phoneMode:'buzz' },
                            { raceMode:'timed' });
  if (rt.code){
    /* Prove the mode took before asserting anything about it. Head-to-head's status
       line reads "first touch wins"; timed rounds never do. Without this the test
       below silently ran in h2h — where phones have always worked — and passed on
       the very build it was written to catch. */
    check('the timed round really is timed',
          !/first touch/i.test(await rt.host.locator('#race-status').innerText()),
          await rt.host.locator('#race-status').innerText());
    const ana = await join(rt.code, 'Ana', 0);
    await rt.host.locator('#race-start').click(); await rt.host.waitForTimeout(900);
    check('a timed Race round arms the phones as well',
          !(await ana.locator('#buzzer').isDisabled()),
          'buzzer still disabled');
    await ana.close();
  }
  checkClean(rt.host, 'race timed phones');
  await rt.host.close();

  /* The join lobby: a QR that carries the code, so a class scans in rather than
     typing a 5-digit code and a URL. The encoder is vendored, so this also proves
     hub-qr.js is actually being loaded by the shells. */
  const q = await openRoom('Jeopardy', { __g:'jeopardy', phoneMode:'write' });
  if (q.code){
    check('the QR encoder is loaded, not fetched',
          await q.host.evaluate(() => typeof window.qrcode) === 'function');
    await q.host.locator('#buzzer-chip').click(); await q.host.waitForTimeout(400);
    check('the chip opens a join lobby', await q.host.locator('#join-modal.on').count() === 1);
    check('with a QR drawn in it', await q.host.locator('#join-qr svg').count() === 1);
    check('and the code shown for anyone who cannot scan',
          (await q.host.locator('#join-code').innerText()).trim() === q.code);

    // scanning is just opening that URL
    const url = BASE + '/join.html?code=' + q.code;
    const scanned = await browser.newPage({ viewport:{ width:390, height:844 } });
    scanned.__errors = []; scanned.on('pageerror', e => scanned.__errors.push(String(e)));
    await scanned.goto(url); await scanned.waitForTimeout(400);
    check('a scanned link fills the code in', await scanned.locator('#code').inputValue() === q.code);
    check('and takes the code field out of the way',
          !(await scanned.locator('#code').isVisible()));
    check('leaving only the name to type', await scanned.locator('#name').isVisible());
    await scanned.fill('#name', 'Ana');
    await scanned.locator('.teams button').nth(0).click();
    await scanned.locator('#join-btn').click(); await scanned.waitForTimeout(600);
    check('a scanned student reaches the game', await scanned.locator('#screen-play').isVisible());
    check('scanned phone had no errors', scanned.__errors.length === 0, scanned.__errors[0]);
    await scanned.close();
  }
  checkClean(q.host, 'join lobby');
  await q.host.close();

  /* Race armed a buzzer directly instead of going through askPhones, so picking
     "everyone types" for Race silently kept handing the room a buzzer — the mode
     had no effect on the one game phones were actually used in. */
  const rw = await openRoom('Race to the Board', { __g:'race', phoneMode:'write' });
  if (rw.code){
    const ana = await join(rw.code, 'Ana', 0), ben = await join(rw.code, 'Ben', 1);
    await rw.host.locator('#race-start').click(); await rw.host.waitForTimeout(900);
    check('Race honours the mode instead of always buzzing',
          await ana.locator('#reply').isVisible() && !(await ana.locator('#buzzer').isVisible()));
    for (const [p, t] of [[ana,'compulsory'],[ben,'banned']]){
      await p.fill('#reply', t); await p.locator('#send').click(); await p.waitForTimeout(300);
    }
    await rw.host.waitForTimeout(800);
    /* The answers used to be drawn wherever the game had room — a card Race has not
       got, or under its sentence, which re-flowed the board as the class typed. One
       strip now, in the same place in every game. */
    const shown = await rw.host.locator('#phone-bar').innerText().catch(()=>'');
    check('and the answers appear on the board, not on a card it has not got',
          /Ana: compulsory/.test(shown) && /Ben: banned/.test(shown), shown.replace(/\n/g,' | '));
    check('in the standard strip, not inside the stage',
          await rw.host.locator('#play-race #phone-bar').count() === 0 &&
          await rw.host.locator('#phone-bar').count() === 1);
    for (const p of [ana, ben]) await p.close();
  }
  checkClean(rw.host, 'race typing');
  await rw.host.close();

  /* Millionaire deals its first question inside start(), and opening the room is a
     fetch — so that question was asked before there were any phones to ask, and
     never reached them. It also never called askPhones at all. */
  const mw = await openRoom('Millionaire', { __g:'millionaire', phoneMode:'write' });
  if (mw.code){
    const ana = await join(mw.code, 'Ana', 0);
    await mw.host.waitForTimeout(700);
    check('Millionaire asks the room when it deals a question',
          await ana.locator('#reply').isVisible());
    check('and the question travels with it',
          (await ana.locator('#qtext').innerText()).trim().length > 0);
    await ana.fill('#reply', 'furthermore'); await ana.locator('#send').click();
    await mw.host.waitForTimeout(700);
    check('the answers land in the standard strip, the same one every game uses',
          /Ana: furthermore/i.test(await mw.host.locator('#phone-bar').innerText().catch(()=>'')),
          await mw.host.locator('#phone-bar').innerText().catch(()=>'none'));
    await ana.close();
  }
  checkClean(mw.host, 'millionaire typing');
  await mw.host.close();

  /* Students trickle in. One who joins mid-question has to arrive into that
     question rather than watch a blank screen until the next one. */
  const late = await openRoom('Jeopardy', { __g:'jeopardy', phoneMode:'write' });
  if (late.code){
    await late.host.locator('#board .tile').first().click(); await late.host.waitForTimeout(800);
    const cara = await join(late.code, 'Cara', 0);
    await late.host.waitForTimeout(600);
    check('a student joining mid-question arrives into it',
          await cara.locator('#reply').isVisible() &&
          (await cara.locator('#qtext').innerText()).trim().length > 0,
          await cara.locator('#qtext').innerText());
    await cara.fill('#reply','custody'); await cara.locator('#send').click();
    await late.host.waitForTimeout(600);
    check('and their answer counts like anyone else\'s',
          /Cara: custody/.test(await late.host.locator('#phone-bar').innerText().catch(()=>'')));
    await cara.close();
  }
  checkClean(late.host, 'late joiner');
  await late.host.close();

  /* ---- one room per lesson ----
     The room used to be torn down with the game, because that is where its code was
     created — so changing games minted a new code and thirty students had to
     rejoin, rescan and retype their names mid-lesson. A lesson is two or three
     games; the room has to outlive all of them. */
  const lesson = await openRoom('Jeopardy', { __g:'jeopardy', phoneMode:'buzz' });
  if (lesson.code){
    const dee = await join(lesson.code, 'Dee', 0);
    await lesson.host.waitForTimeout(400);

    await lesson.host.locator('#new-game-btn').click(); await lesson.host.waitForTimeout(400);
    check('leaving a game does not throw the class out',
          await dee.locator('#screen-play').isVisible());

    await lesson.host.evaluate(() => window.HubSettings.set('phoneMode','buzz','race'));
    await startGame(lesson.host, 'Race to the Board', { sections:'all' });
    await lesson.host.waitForTimeout(900);
    const after = (await lesson.host.locator('#buzzer-chip').innerText().catch(()=>''));
    check('and the next game keeps the same code',
          new RegExp('CODE\\s+' + lesson.code).test(after), after.replace(/\n/g,' | '));
    check('so the phone is still in the room it joined',
          (await lesson.host.locator('#buzzer-chip').innerText()).includes('1'),
          after.replace(/\n/g,' | '));

    // and it still works, which is the only thing that proves the room is live
    await lesson.host.locator('#race-start').click(); await lesson.host.waitForTimeout(700);
    await dee.locator('#buzzer:not([disabled])').waitFor({ timeout:8000 }).catch(()=>{});
    await dee.locator('#buzzer').click(); await lesson.host.waitForTimeout(600);
    check('a phone that never rejoined can still buzz',
          (await lesson.host.locator('#phone-bar').innerText()).includes('Dee'),
          (await lesson.host.locator('#phone-bar').innerText()).replace(/\n/g,' | '));

    /* A game that does not use phones parks the room rather than ending it: the
       class stays joined, and the chip says the phones are idle here instead of
       showing a live-looking code above a room with nothing to do.

       Blockbusters only qualifies with its team vote switched off — with it on the
       board *does* want the phones, and the chip has to say which of those two
       states it is in. Both are asserted, because the chip was right by accident
       until a room could outlive the mode: every game with the mode off used to
       park, and parking is what redrew the chip. */
    await lesson.host.evaluate(() => window.HubSettings.set('bbTeamVote', false, 'blockbusters'));
    await lesson.host.locator('#new-game-btn').click(); await lesson.host.waitForTimeout(300);
    await startGame(lesson.host, 'Blockbusters', { sections:'all' });
    await lesson.host.waitForTimeout(700);
    const parked = await lesson.host.locator('#buzzer-chip').innerText().catch(()=>'');
    check('a game with phones off keeps the room and says so',
          new RegExp('CODE\\s+' + lesson.code).test(parked) && /idle here/i.test(parked),
          parked.replace(/\n/g,' | '));
    await lesson.host.evaluate(() => window.HubSettings.set('bbTeamVote', true, 'blockbusters'));
    await lesson.host.waitForTimeout(500);
    const voting = await lesson.host.locator('#buzzer-chip').innerText().catch(()=>'');
    check('and switching the team vote on says the phones are wanted after all',
          /votes only/i.test(voting), voting.replace(/\n/g,' | '));
    check('and the phone is told the teacher has moved on',
          /waiting/i.test(await dee.locator('#state').innerText()),
          await dee.locator('#state').innerText());

    /* And it outlives the page, not just the game. Reloading the hub is the
       standard fix for a stale shell and the first thing anyone tries when
       something looks wrong — minting a new code there would throw the class out
       for the one reason they would never guess. */
    await lesson.host.reload(); await lesson.host.waitForTimeout(500);
    await lesson.host.evaluate(() => window.HubSettings.set('phoneMode','buzz','race'));
    await startGame(lesson.host, 'Race to the Board', { sections:'all' });
    await lesson.host.waitForTimeout(900);
    const reloaded = await lesson.host.locator('#buzzer-chip').innerText().catch(()=>'');
    check('and it survives the teacher reloading the page',
          new RegExp('CODE\\s+' + lesson.code).test(reloaded), reloaded.replace(/\n/g,' | '));

    check('phone had no errors', dee.__errors.length === 0, dee.__errors[0]);
    await dee.close();
  }
  checkClean(lesson.host, 'one room per lesson');
  await lesson.host.close();

  /* ---- switched off: a room, and nothing to do in it ----
     This used to assert *no room at all*, which is the rule that was reversed —
     it cost the class the join address entirely, and a room nobody can join is
     no use to anybody. What `off` still has to mean is that no phone is armed
     during a question, which is what the arming checks below are for. */
  const off = await openHub(browser);
  await off.evaluate(() => { window.HubSettings.set('intro','off'); window.HubSettings.set('buzzers', true); });
  await startGame(off, 'Jeopardy', { sections:3 });
  await off.waitForTimeout(900);
  check('with the phones set to nothing there is still a room to join',
        await off.locator('#buzzer-chip').isVisible(),
        await off.locator('#buzzer-chip').innerText().catch(()=>'hidden'));
  check('and the chip says the phones are idle rather than promising a dynamic',
        /idle here/i.test(await off.locator('#buzzer-chip').innerText()),
        await off.locator('#buzzer-chip').innerText());
  /* Race used to be exempt in the other direction: it *armed buzzers* whatever the
     setting said, which made "Nothing" a lie in the one game phones were used in
     and made every other mode unreachable there. The room is fine; arming is not. */
  await startGame(off, 'Race to the Board', { sections:'all' });
  await off.waitForTimeout(900);
  await off.locator('#race-start').click(); await off.waitForTimeout(500);
  check('and Race still arms nobody when the mode is off',
        await off.evaluate(() => !document.body.dataset.armed) &&
        /idle here/i.test(await off.locator('#buzzer-chip').innerText()),
        await off.locator('#buzzer-chip').innerText());
  check('the game plays exactly as it does with no relay at all',
        await off.locator('#race-prompt .race-sentence').isVisible());
  checkClean(off, 'switched off');
  await off.close();
}

/* ---- type it, then buzz ----
   The dynamic a real class asked for: a buzzer on its own is a reflex test, so the
   student has to *produce* the word before the button does anything. Driven with
   two real handsets against the relay, because the three properties that make it
   work are all timing: a wrong answer costs seconds and not points, the question
   stays open for everybody else while one phone waits out its miss, and a phone
   that was mid-word when somebody else guessed wrong does not lose what it typed. */
async function testTypeToBuzz(browser){
  section('Type it, then buzz');

  const host = await openHub(browser);
  await host.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
    window.HubSettings.set('buzzers', true);
    window.HubSettings.set('phoneMode','type','race');
    window.HubSettings.set('typeCooldown', 2, 'race');
  });
  await startGame(host, 'Race to the Board', { sections:'all' });
  await host.waitForTimeout(800);
  const chip = await host.locator('#buzzer-chip').innerText().catch(()=>'');
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('a room opens for the typing race', !!code, code || 'none');
  if(!code){ await host.close(); return; }

  const join = async (name, team) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html?code=' + code); await p.waitForTimeout(250);
    await p.fill('#name', name);
    await p.locator('.teams button').nth(team).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(500);
    return p;
  };
  const ana = await join('Ana', 0), ben = await join('Ben', 1);
  await host.waitForTimeout(500);

  // a sentence goes up: both phones get a box, and the button is dead until they write
  await host.locator('#race-start').click(); await host.waitForTimeout(700);
  const answer = await currentRaceAnswer(host);
  check('a sentence is up', !!answer, String(answer));
  check('the phone is a box and a buzzer, not one or the other',
        await ana.locator('#reply').isVisible() && await ana.locator('#buzzer').isVisible());
  check('the phone is not spelling it for them',
        await ana.locator('#reply').getAttribute('autocorrect') === 'off' &&
        await ana.locator('#reply').getAttribute('spellcheck') === 'false');
  check('the button does nothing until a word is typed',
        await ana.locator('#buzzer').isDisabled());

  // Ben types the wrong word and buzzes: no floor, no points, and a wait
  await ben.fill('#reply', 'nonsenseword');
  await ben.waitForTimeout(150);
  check('typing arms the button', !(await ben.locator('#buzzer').isDisabled()));
  await ben.locator('#buzzer').click(); await host.waitForTimeout(700);
  const missChip = (await host.locator('#phone-bar').innerText()).replace(/\n/g,' ');
  check('the teacher sees what was written', /nonsenseword/i.test(missChip), missChip);
  check('a wrong answer costs no points',
        (await scores(host)).every(v => v === '0'), (await scores(host)).join('/'));
  check('and the phone is told to wait', /\d/.test(await ben.locator('#buzzer').innerText()),
        await ben.locator('#buzzer').innerText());

  /* The point of a per-player cooldown: everyone else is still racing. Ana was
     mid-word when Ben missed, and must not have lost it. */
  await ana.fill('#reply', 'hal');
  await host.waitForTimeout(400);
  check('the room stays open for everyone else',
        !(await ana.locator('#buzzer').isDisabled()));
  check('and a phone mid-word keeps what it typed',
        await ana.locator('#reply').inputValue() === 'hal',
        await ana.locator('#reply').inputValue());

  // Ana types it correctly: the floor, the point, and the word claimed without a click
  await ana.fill('#reply', answer);
  await ana.locator('#buzzer').click(); await host.waitForTimeout(900);
  check('the typed word scores without the teacher clicking it',
        (await scores(host))[0] === '1', (await scores(host)).join('/'));
  check('and the phone is told it got it',
        await ana.evaluate(() => document.body.dataset.verdict) === 'right',
        await ana.evaluate(() => document.body.dataset.verdict));
  /* Race arms the next sentence the instant a word is claimed, so a verdict that
     did not outlive it would be a message nobody could read. */
  check('and can still read that a second later',
        /got it/i.test(await ana.locator('#state').innerText()),
        await ana.locator('#state').innerText());

  /* Spelling. Off (the default) a near miss still takes the floor and the phone is
     told to check it — the word was produced. On, only the exact word counts. This
     is the setting most likely to be argued about, so both directions are pinned. */
  await host.waitForTimeout(900);
  const next = await currentRaceAnswer(host);
  const typo = next ? next.slice(0, -1) + (next.slice(-1) === 'x' ? 'y' : 'x') : '';
  check('a fresh sentence is up to try a typo on', !!next && next.length >= 5, String(next));
  if(next && next.length >= 5){
    await ben.locator('#reply:not([disabled])').waitFor({ timeout:8000 }).catch(()=>{});
    await ben.fill('#reply', typo);
    await ben.locator('#buzzer').click(); await host.waitForTimeout(900);
    check('a near miss still takes the floor', (await scores(host))[1] === '1',
          (await scores(host)).join('/'));
    check('and the phone is told to check its spelling',
          /spelling/i.test(await ben.locator('#state').innerText()) &&
          await ben.evaluate(() => document.body.dataset.verdict) === 'close',
          await ben.locator('#state').innerText());

    await host.evaluate(() => window.HubSettings.set('typeStrict', true, 'race'));
    await host.waitForTimeout(900);
    const third = await currentRaceAnswer(host);
    if(third && third.length >= 5){
      const typo3 = third.slice(0, -1) + (third.slice(-1) === 'x' ? 'y' : 'x');
      const before = await scores(host);
      await ana.locator('#reply:not([disabled])').waitFor({ timeout:8000 }).catch(()=>{});
      await ana.fill('#reply', typo3);
      await ana.locator('#buzzer').click(); await host.waitForTimeout(900);
      check('with exact spelling on, the same near miss scores nothing',
            (await scores(host)).join('/') === before.join('/'),
            before.join('/') + ' → ' + (await scores(host)).join('/'));
    }
  }

  for(const p of [ana, ben]){ check('phone had no errors', p.__errors.length === 0, p.__errors[0]); await p.close(); }
  checkClean(host, 'typing race');
  await host.close();
}

/* The judgement itself, away from the wires. Three verdicts rather than two,
   because "produced the word but mis-spelled it" is a different fact about a
   student from "did not know it", and the room should hear it differently. */
async function testAnswerJudging(browser){
  section('Judging a typed answer');
  const page = await openHub(browser);
  const r = await page.evaluate(() => {
    const j = window.HubKit.answer.judge;
    return {
      exact:    j('verdict', 'verdict'),
      spaced:   j('  Verdict. ', 'verdict'),
      article:  j('the verdict', 'verdict'),
      accent:   j('cafe', 'café'),
      typo:     j('verdct', 'verdict'),
      longTypo: j('incarcaration', 'incarceration'),
      short:    j('jurt', 'jury'),
      other:    j('sentence', 'verdict'),
      empty:    j('', 'verdict')
    };
  });
  check('the word itself is right', r.exact === 'right');
  check('so is the word with punctuation and case around it', r.spaced === 'right', r.spaced);
  check('an article does not make it wrong', r.article === 'right', r.article);
  check('nor does an accent', r.accent === 'right', r.accent);
  check('one letter out is close, not wrong', r.typo === 'close', r.typo);
  check('a long word forgives two', r.longTypo === 'close', r.longTypo);
  /* Short words get no tolerance on purpose: one letter in a four-letter word is
     usually a different word, not a slip, and accepting it would hand the floor to
     somebody who typed something else. */
  check('a short word forgives nothing', r.short === 'wrong', r.short);
  check('a different word is wrong', r.other === 'wrong', r.other);
  check('and nothing typed is wrong', r.empty === 'wrong', r.empty);

  /* The tolerance is only safe while no two answers on one board are within it —
     otherwise "close" could hand somebody the wrong word. Checked over the real
     banks, so authoring a near-collision fails here rather than in a classroom. */
  const clash = await page.evaluate(() => {
    const j = window.HubKit.answer.judge, out = [];
    (window.UNITS||[]).forEach(u => {
      const words = [...new Set((u.raceBank||[]).map(i => i.answer))];
      for(let a=0;a<words.length;a++) for(let b=a+1;b<words.length;b++)
        if(j(words[a], words[b]) !== 'wrong') out.push(u.id + ': ' + words[a] + ' ~ ' + words[b]);
    });
    return out;
  });
  check('no two words on a Race board are within the tolerance',
        clash.length === 0, clash.slice(0,3).join(' | '));

  /* Where the dynamic is offered is a judgement, and it is declared rather than
     discovered — the same call as never giving Millionaire an anagram. */
  const where = await page.evaluate(() => ({
    race: window.HubSettings.variantsFor('phoneMode','race').map(v=>v.value),
    mill: window.HubSettings.variantsFor('phoneMode','millionaire').map(v=>v.value)
  }));
  check('typing to buzz is offered where the board hides the word',
        where.race.indexOf('type') !== -1, where.race.join(','));
  check('and not where four options hand it over',
        where.mill.indexOf('type') === -1, where.mill.join(','));
  checkClean(page);
  await page.close();
}

/* ---- the bench picks the hexagon ----
   Blockbusters' weakness is that two students play and the rest watch, so the team
   on turn chooses its next hexagon on their phones. Two properties are the whole
   feature and both were bugs first: only the team on turn may vote, and a letter is
   counted once however many hexagons happen to carry it. */
async function testTeamVote(browser){
  section('Blockbusters — the team picks the hexagon');

  /* Kit.vote is the shared service under both this and Ask the class, so its rules
     are asserted directly rather than inferred from two boards. */
  const page0 = await openHub(browser);
  const kit = await page0.evaluate(() => {
    const v = window.HubKit.vote.open({ options:['A','B','C'], team:1 });
    const before = JSON.stringify(v.apply([{team:0, value:'A'}, {team:1, value:'B'}]));
    v.apply([{team:1, value:'B'}, {team:1, value:'B'}, {team:1, value:'ZZ'}]);
    const lead = v.leader();
    const tie = window.HubKit.vote.open({ options:['A','B'] });
    tie.apply([{team:0, value:'A'}, {team:1, value:'B'}]);
    return { before, lead, tied: tie.leader().tied, total: v.total(),
             empty: window.HubKit.vote.open({ options:['A'] }).leader() };
  });
  check('a vote counts only the team it belongs to',
        JSON.parse(kit.before).A === 0 && JSON.parse(kit.before).B === 1, kit.before);
  check('a reply naming something not on the ballot is dropped', kit.total === 2, String(kit.total));
  check('the leader is the option in front', kit.lead && kit.lead.option === 'B', JSON.stringify(kit.lead));
  check('a draw says so rather than picking one', kit.tied === true);
  check('and no votes at all is no leader, not a zero', kit.empty === null, JSON.stringify(kit.empty));
  checkClean(page0, 'kit vote');
  await page0.close();

  // ---- on the board, with the phones otherwise idle
  const host = await openHub(browser);
  await host.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
    window.HubSettings.set('buzzers', true);
    window.HubSettings.set('phoneMode','off','blockbusters');
  });
  await startGame(host, 'Blockbusters', { sections:'all' });
  await host.waitForTimeout(900);
  const chip = await host.locator('#buzzer-chip').innerText().catch(()=>'');
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('a room opens for the vote even with the phones idle', !!code, chip.replace(/\n/g,' '));
  check('the button offers it to the team on turn',
        /picks/i.test(await host.locator('#bb-ask').innerText()),
        await host.locator('#bb-ask').innerText());

  if (code){
    const join = async (name, team) => {
      const p = await browser.newPage({ viewport:{ width:390, height:844 } });
      p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
      await p.goto(BASE + '/join.html'); await p.waitForTimeout(200);
      await p.fill('#code', code); await p.fill('#name', name);
      await p.locator('.teams button').nth(team).click();
      await p.locator('#join-btn').click(); await p.waitForTimeout(500);
      return p;
    };
    const ana = await join('Ana', 0), cara = await join('Cara', 0), ben = await join('Ben', 1);
    await host.waitForTimeout(400);
    await host.locator('#bb-ask').click(); await host.waitForTimeout(800);

    const letters = await ana.locator('#opts button').allInnerTexts();
    check('the team on turn gets the letters still on the board', letters.length > 4, letters.join(''));
    check('and every letter is offered once, not once per hexagon',
          new Set(letters).size === letters.length, letters.join('/'));
    /* The other side of the room is watching, not choosing — and is told whose
       choice it is rather than shown a dead button. */
    check('the team not on turn has nothing to press',
          await ben.locator('#opts').isVisible() === false &&
          await ben.locator('#buzzer').isVisible() === false);
    check('and is told who is choosing',
          /choosing/i.test(await ben.locator('#state').innerText()),
          await ben.locator('#state').innerText());

    const pick = letters[0];
    for (const p of [ana, cara]){
      await p.locator('#opts button', { hasText:new RegExp('^' + pick + '$') }).first().click();
      await host.waitForTimeout(300);
    }
    await host.waitForTimeout(500);
    /* The count is per *letter*. Painting it on the hexagons instead read as three
       votes for one, because a board of eighteen clusters on common initials —
       so the numbers are counted once and the board shows where they land. */
    check('both votes land on one letter',
          (await host.locator('#bb-tally').innerText()).trim() === pick + ' 2',
          await host.locator('#bb-tally').innerText());
    const lit = await host.locator('#hexwrap .hex.pick').count();
    const same = await host.evaluate(l => [...document.querySelectorAll('#hexwrap .hex')]
      .filter(h => h.dataset.letter === l).length, pick);
    check('and every hexagon carrying it lights up', lit === same && lit >= 1, lit + ' of ' + same);

    /* A phone from the other team cannot vote even if it tries: it is told, the
       relay drops it, and the kit would not count it either. */
    /* Not a click — the button is not there to click. This sends the vote the way a
       handset that had been told nothing would send it, which is what the relay's
       team gate is actually for: a phone that joined mid-round, or one still
       holding the last question. */
    await ben.evaluate(l => window.HubPlayer && window.HubPlayer.respond(l), pick).catch(()=>{});
    await host.waitForTimeout(400);
    check('a vote from the other team changes nothing',
          (await host.locator('#bb-tally').innerText()).trim() === pick + ' 2',
          await host.locator('#bb-tally').innerText());

    await host.locator('#bb-ask').click(); await host.waitForTimeout(600);
    check('closing keeps the numbers — the team is about to play them',
          await host.locator('#bb-tally').isVisible());
    check('and the phones are handed back',
          await ana.locator('#opts').isVisible() === false);

    await host.locator('#hexwrap .hex.pick').first().click(); await host.waitForTimeout(900);
    check('opening the chosen hexagon ends the vote',
          await host.locator('#bb-tally').isVisible() === false);
    check('and the clue is up', (await host.locator('#clue-text').innerText()).trim().length > 0);

    for (const p of [ana, cara, ben]){
      check('phone had no errors', p.__errors.length === 0, p.__errors[0]);
      await p.close();
    }
  }
  checkClean(host, 'team vote');
  await host.close();

  // ---- switched off, and with no relay at all: no button, no change
  const off = await openHub(browser);
  await off.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
    window.HubSettings.set('buzzers', true);
    window.HubSettings.set('bbTeamVote', false, 'blockbusters');
    window.HubSettings.set('phoneMode','off','blockbusters');
  });
  await startGame(off, 'Blockbusters', { sections:'all' });
  await off.waitForTimeout(900);
  /* The vote being off means no *button*, not no room — a room exists whenever
     phones are switched on, so the class can still join and the chip still says
     what is (not) happening. */
  check('switched off, there is no button to ask the team with',
        await off.locator('#bb-ask').isVisible() === false);
  check('but the room is still there to join',
        await off.locator('#buzzer-chip').isVisible() &&
        /idle here/i.test(await off.locator('#buzzer-chip').innerText()),
        await off.locator('#buzzer-chip').innerText().catch(()=>'hidden'));
  await off.locator('#hexwrap .hex').first().click(); await off.waitForTimeout(1300);
  check('and the game plays exactly as before',
        (await off.locator('#clue-text').innerText()).trim().length > 0);
  checkClean(off, 'team vote off');
  await off.close();
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
                              window.HubSettings.set('phoneMode', 'buzz', 'race');
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

/* ---- a phone that reconnects must stay in the room ----
   Reported from a real round: "the button on the phone oscillates between being on
   and off, like it's disconnecting then reconnecting." It was. An event stream
   re-registers the phone under the same id, but the *old* stream's close arrives
   afterwards — and the close handler deleted by id without checking whether the
   stream being closed was still the live one. So the phone that had just come back
   was removed, found itself out of the room, reconnected, and was removed again.
   The host stream had this guard from the start; the player path never did.

   Driven over raw HTTP rather than through a browser: the race is between two
   connections and a browser's EventSource will not let a test hold both. */
async function testRelayReconnect(){
  section('A phone reconnecting keeps its place');
  const http = require('http');
  const post = (body) => new Promise(r => {
    const d = JSON.stringify(body);
    const q = http.request({ port:PORT, path:'/buzzer/send', method:'POST',
      headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(d) } },
      res => { let o=''; res.on('data',c=>o+=c); res.on('end',()=>r({ status:res.statusCode, body:o })); });
    q.on('error', () => r({ status:0, body:'' }));
    q.write(d); q.end();
  });
  const stream = (qs) => new Promise(r => {
    const q = http.get({ port:PORT, path:'/buzzer/stream?' + qs }, res => r({ res, req:q }));
    q.on('error', () => r({ res:null, req:q }));
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const code = '54321';
  const host = await stream('role=host&room=' + code);
  let seen = '';
  if (host.res) host.res.on('data', c => seen += c);
  await wait(300);

  const a = await stream('room=' + code + '&id=abc&name=Ana&team=0');
  await wait(250);
  const b = await stream('room=' + code + '&id=abc&name=Ana&team=0');   // same phone, new stream
  await wait(200);
  a.req.destroy();                       // the old one closes *after* the new one registered
  await wait(600);

  const roster = (seen.match(/"players":\[[^\]]*\]/g) || []).pop() || '';
  check('the reconnected phone is still in the room', /Ana/.test(roster), roster || 'empty');
  check('and the host is not told it left', !/event: leave/.test(seen));

  await post({ type:"arm", room:code, mode:'buzz', prompt:'test' });
  await wait(200);
  const buzz = await post({ type:"buzz", room:code, id:'abc' });
  check('and it can still buzz', buzz.status === 200 && !/not in room/.test(buzz.body),
        buzz.status + ' ' + buzz.body);

  // a phone that really does leave is still removed
  b.req.destroy();
  await wait(500);
  const after = (seen.match(/"players":\[[^\]]*\]/g) || []).pop() || '';
  check('a phone that actually leaves is dropped', !/Ana/.test(after), after || 'empty');

  /* ---- two hub tabs on one room ----
     Only one host stream may be live, and the newest wins. Ending the loser
     silently makes it look like a network drop, so its EventSource reconnects —
     which ends the winner, which reconnects, forever. Every one of those `ready`
     events re-asks the phones, so the whole room's buzzers flicker on and off
     while every connection is technically fine. That is what the second flicker
     report turned out to be, after the reconnect fix had ruled out the first. */
  const h2 = await stream('role=host&room=' + code);
  await wait(400);
  check('the replaced host is told, not just cut off', /event: replaced/.test(seen),
        seen.replace(/\n/g,' ').slice(-120));
  if (h2.req) h2.req.destroy();

  if (host.req) host.req.destroy();
}

/* ---- bingo with a card in every hand ----
   The board version is two to four cards a class shares and watches; this is what
   bingo actually is — everyone holding their own card, which is the fix for the
   weakness it shares with Blockbusters (two play, the rest watch). It is also the
   first thing here that keeps per-player state between questions, which is why the
   card lives in the relay as well as on the host. */
async function testPhoneBingo(browser){
  section('Bingo with a card in every hand');
  const page = await openHub(browser);
  await page.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('buzzers',true);
    S.set('bingoCards','phones','bingo');
  });
  await page.reload(); await page.waitForTimeout(400);
  await startGame(page, 'Bingo', { sections:'all' });
  await page.waitForTimeout(1100);
  const chip = await page.locator('#buzzer-chip').innerText().catch(()=>'');
  const code = (chip.match(/CODE\s+(\d{5})/i) || [])[1];
  check('a room opens even with the phone mode off', !!code, chip.replace(/\n/g,' '));
  /* "votes only" is what the chip used to say for any game that wanted a room
     without a mode — over a game where every phone holds a card, that is just
     wrong, and the chip is what a class reads when deciding whether to join. */
  check('and the chip says what the phones are actually for',
        /cards on phones/i.test(chip), chip.replace(/\n/g,' '));
  if (!code){ await page.close(); return; }

  const join = async (name, team) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(200);
    await p.fill('#code', code); await p.fill('#name', name);
    await p.locator('.teams button').nth(team).click();
    await p.locator('#join-btn').click(); await p.waitForTimeout(500);
    return p;
  };
  const ana = await join('Ana', 0);
  const ben = await join('Ben', 1);
  await page.waitForTimeout(800);

  check('every phone is dealt its own card',
        await ana.locator('#card button').count() === 9 &&
        await ben.locator('#card button').count() === 9);
  const aw = await ana.locator('#card button').allInnerTexts();
  const bw = await ben.locator('#card button').allInnerTexts();
  check('and the cards are not the same card', aw.join('|') !== bw.join('|'));
  check('the board tracks the room rather than drawing thirty cards',
        /2 cards in play/i.test(await page.locator('#bingo-cards').innerText()),
        (await page.locator('#bingo-cards').innerText()).replace(/\n/g,' | '));

  // a call: everyone holding the word may mark it, so it stays open
  await page.locator('#bingo-start').click(); await page.waitForTimeout(700);
  const answer = await page.evaluate(() => window.__bingoAnswer());
  check('a call goes out', !!answer);
  check('the phones are told to tap, not to buzz',
        /tap the word/i.test(await ana.locator('#state').innerText()),
        await ana.locator('#state').innerText());
  check('and the buzzer is out of the way',
        await ana.evaluate(() => getComputedStyle(document.getElementById('buzzer')).display) === 'none');

  // a wrong tap costs nothing and the card stays live
  const wrongAt = aw.findIndex(w => w !== answer);
  await ana.locator('#card button').nth(wrongAt).click(); await page.waitForTimeout(700);
  check('a wrong tap marks nothing', await ana.locator('#card button.marked').count() === 0);
  check('and it costs no points',
        (await page.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent)))
          .every(v => v === '0'));
  check('but the teacher sees who tried what',
        /Ana/.test(await page.locator('#phone-bar').innerText()),
        (await page.locator('#phone-bar').innerText()).replace(/\n/g,' '));

  /* The reconnect case is the whole reason the card is stored in the relay: a
     phone that drops off the wifi mid-round has to come back to its own card with
     its own marks, not a blank one. */
  const holder = aw.indexOf(answer) >= 0 ? { p:ana, i:aw.indexOf(answer), team:0 }
                                         : { p:ben, i:bw.indexOf(answer), team:1 };
  if (holder.i >= 0){
    await holder.p.locator('#card button').nth(holder.i).click();
    await page.waitForTimeout(800);
    check('the right tap marks that square', await holder.p.locator('#card button.marked').count() === 1);
    const scores = await page.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent));
    check('and scores for that student\'s team', scores[holder.team] !== '0', scores.join('/'));
    check('and the board shows their progress',
          /1\/3/.test(await page.locator('#bingo-cards').innerText()),
          (await page.locator('#bingo-cards').innerText()).replace(/\n/g,' | '));

    await holder.p.reload(); await holder.p.waitForTimeout(1200);
    check('a phone that drops off comes back to its own card, marks and all',
          await holder.p.locator('#card button').count() === 9 &&
          await holder.p.locator('#card button.marked').count() === 1,
          await holder.p.locator('#card button').count() + ' cells, ' +
          await holder.p.locator('#card button.marked').count() + ' marked');
  }

  /* ---- the cards win over the mode ----
     Reported: "when I select buzz mode a button appears on the phone screen". It
     did — `phoneMode` and the card round were two dynamics fighting over the same
     handset, and every reconnect handed the phone a buzzer over the top of its own
     card. A mode is a choice between iterations; a game that *is* the phone
     dynamic is not one of the choices, so Bingo owns the round while the cards are
     in their hands. */
  await page.evaluate(() => window.HubSettings.set('phoneMode', 'buzz', 'bingo'));
  await page.waitForTimeout(600);
  if (await page.locator('#bingo-start').isVisible()){
    await page.locator('#bingo-start').click(); await page.waitForTimeout(700);
  }
  check('picking buzz does not put a buzzer over the card',
        await ana.evaluate(() => getComputedStyle(document.getElementById('buzzer')).display) === 'none',
        await ana.locator('#state').innerText());
  check('the card is still what the phone is showing',
        await ana.locator('#card button').count() === 9 &&
        /tap the word/i.test(await ana.locator('#state').innerText()),
        await ana.locator('#state').innerText());

  /* And a reconnect must not change its mind either — that is the path that made
     the buzzer appear a moment after the card, rather than instead of it. */
  await page.evaluate(() => { if (window.__reask) window.__reask(); });
  await page.waitForTimeout(600);
  check('and a re-ask leaves the card alone',
        await ana.evaluate(() => getComputedStyle(document.getElementById('buzzer')).display) === 'none' &&
        await ana.locator('#card button').count() === 9);

  /* With the cards on the board the mode matters again, and buzz means buzz. */
  await page.evaluate(() => {
    window.HubSettings.set('bingoCards', 'board', 'bingo');
    window.HubSettings.set('phoneMode', 'buzz', 'bingo');
  });
  await page.waitForTimeout(400);
  await startGame(page, 'Bingo', { sections:'all', fresh:false }).catch(()=>{});
  await page.waitForTimeout(900);
  if (await page.locator('#bingo-start').isVisible()){
    await page.locator('#bingo-start').click(); await page.waitForTimeout(800);
  }
  check('cards on the board hands the mode back — buzz is a buzzer again',
        await ana.evaluate(() => getComputedStyle(document.getElementById('buzzer')).display) !== 'none',
        await ana.locator('#state').innerText());

  for (const p of [ana, ben]){
    check('phone had no errors', p.__errors.length === 0, p.__errors[0]);
    await p.close();
  }
  checkClean(page);
  await page.close();
}

/* ---- the playground: Connections ----
   The playground is the lane between the Learning-games prototypes and the hub:
   a standalone page that borrows only the phone room. This drives the classroom
   loop — teacher clicks, team votes advisory on the tiles, turn passes on a
   miss — and the degradation rule: no relay must mean a fully playable page. */
async function testPlaygroundConnections(browser){
  section('Playground: Connections');
  const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
  page.__errors = []; page.on('pageerror', e => page.__errors.push(String(e)));
  await page.goto(BASE + '/playground/connections.html?p=1'); await page.waitForTimeout(900);

  check('16 tiles on the board', await page.locator('#grid .tile').count() === 16);
  check('two teams to start, first on turn',
        await page.locator('.team-chip').count() === 2 &&
        /Team 1/.test(await page.locator('.team-chip.active').innerText()));

  const chip = await page.locator('#room-chip').innerText();
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('a room opens on its own', !!code, chip);

  if(code){
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(250);
    await p.fill('#code', code); await p.fill('#name','Ana');
    await p.locator('#join-btn').click(); await p.waitForTimeout(700);

    // the phone landed in the live vote round: 16 words to choose one from
    const opts = await p.locator('#opts button').count();
    check('the phone offers the sixteen words', opts === 16, String(opts));
    /* **A vote you have to scroll is a vote you cannot make**: choosing between
       options means seeing them at the same time, and sixteen full-width rows fit
       no handset. Many words become two columns. Measured on the elements, not the
       container — a list whose box fits while its children overflow it is exactly
       the bug that passed a container-based check once before. */
    const fit = await p.evaluate(() => {
      const o = document.getElementById('opts');
      const btns = [...o.querySelectorAll('button')];
      return { cols: getComputedStyle(o).gridTemplateColumns.split(' ').length,
               scrolls: o.scrollHeight > o.clientHeight + 1,
               offscreen: btns.filter(b => b.getBoundingClientRect().bottom > window.innerHeight + 1).length,
               broken: btns.filter(b => b.scrollWidth > b.clientWidth + 1).length };
    });
    check('sixteen words fit on the handset without scrolling',
          !fit.scrolls && fit.offscreen === 0, JSON.stringify(fit));
    check('in two columns, with no word broken mid-letter',
          fit.cols === 2 && fit.broken === 0, JSON.stringify(fit));
    /* The prompt is a label here, not the question — "Pick a word", not three
       lines of rules. Every line of instruction is a line of words pushed off. */
    const prompt = await p.locator('#qtext').innerText();
    check('and the instruction is short enough to leave room for them',
          prompt.length <= 24, prompt);
    await p.locator('#opts button', { hasText:/^decision$/i }).click();
    await page.waitForTimeout(600);
    check('the vote lands on the tile, advisory',
          await page.locator('#grid .tile[data-word="decision"] .votes').innerText() === '1');

    /* ---- the vote is a negotiation, not a submission ----
       A team argues its way to one answer, so a player must be able to move their
       vote. The relay keys replies by player, so a second tap replaces the first
       and the tally follows; before this the first tap was final and there was
       nothing left to negotiate with. */
    check('the phone says the pick can be changed',
          /change/i.test(await p.locator('#state').innerText()),
          await p.locator('#state').innerText());
    await p.locator('#opts button', { hasText:/^homework$/ }).click();
    await page.waitForTimeout(600);
    check('changing the vote moves it on the board',
          await page.locator('#grid .tile[data-word="decision"] .votes').count() === 0 &&
          await page.locator('#grid .tile[data-word="homework"] .votes').innerText() === '1');
    check('and the handset stays open rather than locking on the first tap',
          await p.locator('#opts button:disabled').count() === 0);
    await p.locator('#opts button', { hasText:/^decision$/ }).click();
    await page.waitForTimeout(500);

    /* ---- the round clock ----
       Sent once as a duration and counted down from receipt, so no phone ever
       compares clocks with anybody. Display plus a local stop; the host decides
       what expiry means. */
    check('the phone shows the time left',
          /^\d+s$/.test((await p.locator('#round-clock').innerText()).trim()),
          await p.locator('#round-clock').innerText());
    const late = await browser.newPage({ viewport:{ width:390, height:844 } });
    await late.goto(BASE + '/join.html?code=' + code + '&name=Zoe&team=0&auto=1');
    await late.waitForTimeout(900);
    const leftFor = Number((await late.locator('#round-clock').innerText()).replace(/\D/g,''));
    check('and a phone joining mid-round is told what is *left*, not the full time',
          leftFor > 0 && leftFor < 60, String(leftFor));
    await late.close();

    // expiry, driven with a short round so the suite does not wait a minute
    await page.evaluate(() => window.HubHost.arm('Pick a word', {
      mode:'vote', options:['alpha','beta'], team:0, rethink:true, secs:2 }));
    await p.waitForTimeout(3200);
    check('when time runs out the phone says so and stops taking taps',
          /time/i.test(await p.locator('#round-clock').innerText()) &&
          await p.locator('#opts button:disabled').count() === 2,
          await p.locator('#round-clock').innerText());
    // put the real question back for the rest of the run
    await page.evaluate(() => askPhones());
    await p.waitForTimeout(700);

    // teacher locks in the MAKE group — the team scores and keeps the turn
    // (tiles are picked by data-word: a vote badge joins the tile's text, so
    //  matching on the text passed before the first vote and never after)
    for (const w of ['decision','mistake','noise','progress'])
      await page.locator('#grid .tile[data-word="'+w+'"]').click();
    await page.locator('#submit-btn').click(); await page.waitForTimeout(500);
    check('a solved group shows its mini-lesson',
          await page.locator('.solved-group').count() === 1 &&
          /make a mistake/i.test(await page.locator('.solved-group .gnote').innerText()));
    check('the solving team scores and keeps the turn',
          /Team 1/.test(await page.locator('.team-chip.active').innerText()) &&
          /1/.test(await page.locator('.team-chip.active .score').innerText()));

    // a wrong four passes the turn — and the vote passes with it
    for (const w of ['homework','laundry','dishes','fun'])
      await page.locator('#grid .tile[data-word="'+w+'"]').click();
    await page.locator('#submit-btn').click(); await page.waitForTimeout(600);
    check('a near miss says one away', /one away/i.test(await page.locator('.message').innerText()),
          await page.locator('.message').innerText());
    check('and the turn passes', /Team 2/.test(await page.locator('.team-chip.active').innerText()));
    check('a phone not on the team on turn is told who is choosing',
          /choosing/i.test(await p.locator('#state').innerText()),
          await p.locator('#state').innerText());

    /* Both playground boards offer the bench the same way: with themselves loaded
       as the board, so the phones sit beside the game rather than in a tab of
       their own. Passing only the code left you with handsets and nothing to
       watch them act on. */
    await page.locator('#room-chip').click(); await page.waitForTimeout(300);
    check('the join panel offers the bench with this board loaded',
          /board=connections\.html/.test(await page.locator('#bench-link').getAttribute('href')),
          await page.locator('#bench-link').getAttribute('href'));
    await page.locator('#join-panel').click({ position:{ x:5, y:5 } }); await page.waitForTimeout(200);

    check('phone had no errors', p.__errors.length === 0, p.__errors[0]);
    await p.close();
  }

  /* ---- race: both teams at once, and the board settles it ----
     The other way the same board can be played. No turn, both teams' picks on the
     projector at the same time, and a team's own four *is* its guess — the teacher
     never re-enters it, which is the whole point of the mode. Each phone holds up
     to four because a team of two could never assemble a group one vote each. */
  const race = await browser.newPage({ viewport:{ width:1280, height:820 } });
  race.__errors = []; race.on('pageerror', e => race.__errors.push(String(e)));
  await race.goto(BASE + '/playground/connections.html?p=1'); await race.waitForTimeout(900);
  await race.locator('#play-mode').selectOption('race'); await race.waitForTimeout(500);
  const rcode = ((await race.locator('#room-chip').innerText()).match(/CODE\s+(\d{5})/i)||[])[1];
  check('the race opens its own room', !!rcode, rcode || 'none');
  check('and the turns-only controls stand down',
        !(await race.locator('#status-row').isVisible()) &&
        !(await race.locator('#controls-row').isVisible()));
  /* The clock is one of them, and it was a dead end rather than a preference.
     Expiry disarms every handset; turns mode recovers because the teacher still
     has Submit, but a race hides Submit — so on the *default* 60s a race board
     reached one minute with no phone able to tap and no control on screen to
     click, and only Restart got out of it. A race's pressure is the other team,
     which is the same reason a wrong four costs nothing there. */
  check('and so does the clock, which a race has nothing to end',
        !(await race.locator('#vote-secs').isVisible()) &&
        (await race.locator('#vote-clock').innerText()).trim() === '',
        await race.locator('#vote-clock').innerText());
  if(rcode){
    const join = async (name, team) => {
      const ph = await browser.newPage({ viewport:{ width:390, height:844 } });
      ph.__errors = []; ph.on('pageerror', e => ph.__errors.push(String(e)));
      await ph.goto(BASE + '/join.html?code=' + rcode + '&name=' + name + '&team=' + team + '&auto=1');
      await ph.waitForTimeout(800);
      return ph;
    };
    const one = await join('Ana', 0), two = await join('Ben', 1);
    check('every team is asked at once, not only the team on turn',
          /choose 4/i.test(await two.locator('#state').innerText()),
          await two.locator('#state').innerText());
    /* The handsets have to agree with the board about there being no clock — the
       phone counts its own copy down from a duration sent with the arm, so a board
       that stood the clock down while still sending `secs` would disarm the room
       from the phone side and look exactly like the bug that was fixed. */
    check('and no round clock reaches their phones either',
          (await one.locator('#round-clock').innerText()).trim() === '' &&
          (await two.locator('#round-clock').innerText()).trim() === '',
          await one.locator('#round-clock').innerText());

    await two.locator('#opts button', { hasText:/^homework$/ }).click();
    await two.locator('#opts button', { hasText:/^laundry$/ }).click();
    for (const w of ['decision','mistake','noise'])
      await one.locator('#opts button', { hasText: new RegExp('^'+w+'$') }).click();
    await race.waitForTimeout(700);
    check('both teams\' picks show on the board at the same time',
          await race.locator('#grid .tile[data-word="decision"] .pick-dot').count() === 1 &&
          await race.locator('#grid .tile[data-word="laundry"] .pick-dot').count() === 1);
    check('and each team is counted toward its four, by name',
          /Team 1 3\/4/.test(await race.locator('#vote-text').innerText()) &&
          /Team 2 2\/4/.test(await race.locator('#vote-text').innerText()),
          await race.locator('#vote-text').innerText());
    /* One phone holding four is a whole answer, which is what lets a small team
       play — and tapping a held word again drops it. */
    check('a phone can hold several words and drop one again',
          await one.locator('#opts button.picked').count() === 3);
    await one.locator('#opts button', { hasText:/^noise$/ }).click(); await race.waitForTimeout(400);
    check('dropping one takes it off the board too',
          await race.locator('#grid .tile[data-word="noise"] .pick-dot').count() === 0);
    await one.locator('#opts button', { hasText:/^noise$/ }).click();

    await one.locator('#opts button', { hasText:/^progress$/ }).click();
    await race.waitForTimeout(1800);
    check('completing a real group wins it for that team, with no teacher click',
          await race.locator('.solved-group').count() === 1 &&
          /Team 1/i.test(await race.locator('.solved-group .gname').innerText()),
          await race.locator('.solved-group .gname').innerText());
    check('the team scores it', (await race.locator('.team-chip .score').allInnerTexts()).join('/') === '1/0',
          (await race.locator('.team-chip .score').allInnerTexts()).join('/'));
    check('the won words leave the board for everybody',
          await race.locator('#grid .tile').count() === 12,
          String(await race.locator('#grid .tile').count()));
    check('and a fresh round is armed on what is left',
          await one.locator('#opts button').count() === 12,
          String(await one.locator('#opts button').count()));

    /* ---- the ring is neutral, the dots carry who ----
       It used to take the colour of whichever team grabbed the word *first*, which
       paints a contested word as one team's and leaves the other team's dot
       reading as a footnote on somebody else's pick. Both sets have to be equally
       legible: a team reading what the other side is assembling is what makes the
       race a language task rather than a speed one. Asserted as a property — two
       words held by *different* teams look the same — rather than against a hex
       code, so restyling the ring cannot quietly re-encode the team in it. */
    await one.locator('#opts button', { hasText:/^dishes$/ }).click();
    await two.locator('#opts button', { hasText:/^break$/ }).click();
    await race.waitForTimeout(700);
    const rings = await race.evaluate(() => {
      const look = w => {
        const t = document.querySelector('#grid .tile[data-word="' + w + '"]');
        return { ring: getComputedStyle(t).boxShadow,
                 dots: [...t.querySelectorAll('.pick-dot')].map(d => getComputedStyle(d).backgroundColor) };
      };
      return { a: look('dishes'), b: look('break') };
    });
    check('a word held by either team gets the same neutral ring',
          rings.a.ring === rings.b.ring && rings.a.ring !== 'none',
          JSON.stringify(rings));
    check('and the team is said by the dot, which is not that ring',
          rings.a.dots.length === 1 && rings.b.dots.length === 1 &&
          rings.a.dots[0] !== rings.b.dots[0] &&
          rings.a.ring.indexOf(rings.a.dots[0]) === -1,
          JSON.stringify(rings));
    /* The same palette reaches the handset — a student matches the colour in their
       hand to the dots on the board without being told which are theirs. It lives
       in hub-buzzer.js because that is the one file both ends load. */
    /* Null-guarded rather than dereferenced: on a build without the team pill this
       threw, which aborts the whole block — so the checks after it never reported
       and a real regression would hide behind one stack trace. A layout assertion
       that cannot fail cleanly is not much of an assertion. */
    const paint = await one.evaluate(() => {
      const bg = sel => { const e = document.querySelector(sel);
                          return e ? getComputedStyle(e).backgroundColor : null; };
      const want = (window.HubBuzzer && HubBuzzer.teamColour)
        ? (c => 'rgb(' + [0,2,4].map(i=>parseInt(c.substr(i,2),16)).join(', ') + ')')
          (HubBuzzer.teamColour(0).replace('#',''))
        : null;
      return { pill: bg('.who .tteam'), held: bg('#opts button.picked'), want };
    });
    check('the phone carries its own team colour, from the shared palette',
          !!paint.want && paint.pill === paint.want && paint.held === paint.want,
          JSON.stringify(paint));

    /* ---- a player's share of the four comes from their team's size ----
       Four words assembled by four phones is one word each; by two phones it is
       two each. One room-wide cap could not express that, because teams are not
       the same size — and a team of four each holding four words is not a
       negotiation, it is four separate answers. */
    check('one phone on a team holds the whole four',
          /Team 1 1\/4 · 1 phone, 4 each/.test(await race.locator('#vote-text').innerText()),
          await race.locator('#vote-text').innerText());
    const three = await join('Cara', 0);
    await race.waitForTimeout(900);
    check('a second phone on the team halves the share, live',
          /Team 1 1\/4 · 2 phones, 2 each/.test(await race.locator('#vote-text').innerText()) &&
          /Choose 2/.test(await three.locator('#state').innerText()),
          await race.locator('#vote-text').innerText() + ' | ' + await three.locator('#state').innerText());
    /* The share moving must not wipe the round. A fresh arm clears every handset's
       picks, so a latecomer walking in would throw away what the rest of the team
       had just agreed on — the same rule as the hub's "a re-ask never cancels what
       is in progress". The cap is pushed on its own instead. */
    check('and the phone already holding a word keeps it',
          await one.locator('#opts button.picked').count() === 1 &&
          await race.locator('#grid .tile[data-word="dishes"] .pick-dot').count() === 1);
    // fill this phone's share, then try to exceed it
    await one.locator('#opts button', { hasText:/^exercise$/ }).click();
    await one.locator('#opts button', { hasText:/^laundry$/ }).click();
    await race.waitForTimeout(500);
    check('the cap refuses a word past the share and says so',
          await one.locator('#opts button.picked').count() === 2 &&
          /2 is the most/.test(await one.locator('#state').innerText()),
          await one.locator('#state').innerText());

    /* Two more join, so the share halves again *under* a phone already holding its
       old one. Nothing is taken off it: forcing a trim would drop a word from a
       student who did nothing wrong, and the team talking one of them down is the
       whole mechanic. So being over is a state, and the handset names it. */
    const four = await join('Dan', 0), five = await join('Eve', 0);
    await race.waitForTimeout(1200);
    check('four phones on a team is one word each',
          /Team 1 2\/4 · 4 phones, 1 each/.test(await race.locator('#vote-text').innerText()),
          await race.locator('#vote-text').innerText());
    check('and a phone left over its new share keeps its words and is told to drop one',
          await one.locator('#opts button.picked').count() === 2 &&
          /Drop 1 — it is 1 each now/.test(await one.locator('#state').innerText()),
          await one.locator('#state').innerText());

    /* ---- a phone that drops takes its picks with it ----
       A reply here is a state the phone is *holding*, not an answer it has given.
       Left behind, a student who walks out mid-round goes on occupying words of
       their team's four for the rest of the game with nobody able to drop them —
       the team is simply stuck. A typed answer is the other case and stays put,
       which is why the host declares which it is on the arm. */
    await one.close();
    await race.waitForTimeout(1200);
    check('a dropped phone\'s words leave the board with it',
          await race.locator('#grid .tile[data-word="dishes"] .pick-dot').count() === 0 &&
          await race.locator('#grid .tile[data-word="exercise"] .pick-dot').count() === 0,
          await race.locator('#vote-text').innerText());
    check('and its team gets the share back',
          /Team 1 0\/4 · 3 phones, 2 each/.test(await race.locator('#vote-text').innerText()),
          await race.locator('#vote-text').innerText());
    /* The other team is untouched by any of it — a drop is one team's business. */
    check('while the other team is left exactly as it was',
          /Team 2 1\/4/.test(await race.locator('#vote-text').innerText()) &&
          await race.locator('#grid .tile[data-word="break"] .pick-dot').count() === 1,
          await race.locator('#vote-text').innerText());

    check('race phones had no errors',
          one.__errors.length === 0 && two.__errors.length === 0 && three.__errors.length === 0,
          one.__errors[0] || two.__errors[0] || three.__errors[0]);
    await two.close(); await three.close(); await four.close(); await five.close();
  }
  check('the race board had no errors', race.__errors.length === 0, race.__errors[0]);
  await race.close();

  // degradation: a dead relay leaves the page fully playable, teacher-only
  const solo = await browser.newPage({ viewport:{ width:1280, height:720 } });
  solo.__errors = []; solo.on('pageerror', e => solo.__errors.push(String(e)));
  await solo.goto(BASE + '/playground/connections.html?p=1&relay=http://127.0.0.1:9'); await solo.waitForTimeout(700);
  check('no relay: the chip says phones off', /phones off/i.test(await solo.locator('#room-chip').innerText()));
  for (const w of ['decision','mistake','noise','progress'])
    await solo.locator('#grid .tile[data-word="'+w+'"]').click();
  await solo.locator('#submit-btn').click(); await solo.waitForTimeout(400);
  check('and the game still plays', await solo.locator('.solved-group').count() === 1);
  check('no errors without a relay', solo.__errors.length === 0, solo.__errors[0]);
  await solo.close();

  check('host page had no errors', page.__errors.length === 0, page.__errors[0]);
  await page.close();
}

/* ---- the prompt lab ----
   The question forms had nowhere to be seen: a form could only be met by finding a
   bank item that happened to carry its type, which is why three of them sat at 4%
   of the content. The lab lists whatever the registry holds — never a list kept in
   step by hand — draws it at board size, and puts the same question on phones. */
async function testPromptLab(browser){
  section('Playground: the prompt lab');
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  page.__errors = []; page.on('pageerror', e => page.__errors.push(String(e)));
  await page.goto(BASE + '/playground/prompt-lab.html'); await page.waitForTimeout(800);

  /* The menu is the registry asked, so a form registered later appears without the
     lab being edited — the same discipline the fit and phone suites use on games. */
  const listed = await page.locator('#form-pick option').allInnerTexts();
  const registered = await page.evaluate(() => window.HubKit.prompt.types());
  check('every registered form is in the menu',
        registered.every(t => listed.some(l => l.indexOf(t) === 0)),
        listed.join(' | ') + '  vs  ' + registered.join(','));
  check('and a form registered after this page was written would be too',
        await page.evaluate(() => {
          window.HubKit.prompt.register('__labtest', { render(m){ m.textContent='x'; } });
          const before = document.querySelectorAll('#form-pick option').length;
          document.getElementById('form-pick').dispatchEvent(new Event('change'));
          return window.HubKit.prompt.types().indexOf('__labtest') !== -1 && before > 0;
        }));

  /* Two stages, and the isolation between them is the point: a form written in the
     lab must NOT be able to reach a game. Games load hub-kit.js and never load this
     page, so an experimental form exists only here until its registration is moved
     into the kit — which is what "graduating" means, and it is a file move, not a
     rewrite. Proved in both directions rather than asserted. */
  const stages = await page.evaluate(() => ({
    labOnly: window.HubKit.prompt.types().indexOf('realfake') !== -1,
    groups:  [...document.querySelectorAll('#form-pick optgroup')].map(g => g.label),
    inKitGroup: [...document.querySelectorAll('#form-pick optgroup')]
      .find(g => /in the kit/i.test(g.label))?.textContent || '',
    labGroup: [...document.querySelectorAll('#form-pick optgroup')]
      .find(g => /lab only/i.test(g.label))?.textContent || ''
  }));
  check('the lab separates forms that are in the kit from experimental ones',
        stages.groups.length === 2 && /gap/.test(stages.inKitGroup) &&
        /bridge/.test(stages.labGroup) && /realfake/.test(stages.labGroup),
        JSON.stringify(stages));

  const hub = await openHub(browser);
  const hubForms = await hub.evaluate(() => window.HubKit.prompt.types());
  check('an experimental form cannot reach a game',
        hubForms.indexOf('bridge') === -1 && hubForms.indexOf('realfake') === -1,
        hubForms.join(','));

  /* ---- compatibility, proved rather than intended ----
     Every experimental form must be portable into the hub the day it is written,
     or "we'll graduate it later" is a promise nobody checked. So the lab's whole
     forms file is dropped into a real hub page and each form is asked to draw on
     a **live Jeopardy clue card** — the element a graduated form would actually
     render into. It is driven by what the file registers, so a form added to
     lab-forms.js next month is covered without this check being edited, and one
     that quietly depends on something only the lab has fails immediately. */
  await hub.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
  });
  await startGame(hub, 'Jeopardy', { sections:3 });
  await hub.locator('#board .tile').first().click(); await hub.waitForTimeout(500);
  await hub.addScriptTag({ path: 'playground/lab-forms.js' });
  const port = await hub.evaluate(() => {
    const samples = (window.LabForms || {}).samples || {};
    const card = document.getElementById('clue-text');
    return Object.keys(samples).map(type => {
      const item = samples[type][0];
      const drawn = window.HubKit.prompt.render(card, item, 'jeopardy');
      const built = card.children.length;                 // bare text = declined
      const ms = window.HubKit.prompt.reveal(card, item);
      return { type, drawn, built, ms };
    });
  });
  await hub.close();
  check('every experimental form is registered by the file the lab loads',
        port.length >= 2, JSON.stringify(port.map(p=>p.type)));
  port.forEach(r => {
    check('“' + r.type + '” draws on a real clue card, so it is portable today',
          r.drawn === r.type && r.built > 0, JSON.stringify(r));
    check('and answers itself there', r.ms > 0, JSON.stringify(r));
  });

  await page.locator('#form-pick').selectOption('bridge'); await page.waitForTimeout(250);
  check('picking a form draws its sample at board size',
        await page.locator('#prompt-text .prompt-link').count() === 3);
  check('and says which boards it suits',
        /every board/i.test(await page.locator('#suits').innerText()),
        await page.locator('#suits').innerText());
  check('the answer is not on screen before it is revealed',
        !/work/i.test(await page.locator('#prompt-text').innerText()),
        await page.locator('#prompt-text').innerText());

  await page.locator('#reveal-btn').click(); await page.waitForTimeout(300);
  check('reveal lands the answer in the prompt',
        await page.locator('#prompt-text .prompt-link.filled').count() === 1);
  /* Exactly the rule every game follows: the separate answer line stands down when
     the answer landed in the prompt itself, rather than showing the word twice. */
  check('and the answer line stands down when the form managed it',
        !(await page.locator('#answer-line').isVisible()));
  check('the lab says how the form was drawn, not just that it was',
        /bridge/.test(await page.locator('#meta-drawn').innerText()),
        await page.locator('#meta-drawn').innerText());

  /* A form that declines prints plain text — the intended failure, and on screen
     it is indistinguishable from "the type did nothing", because `render` hands
     back the type whenever the form *ran*. The lab has to tell the two apart. */
  const labDecline = await page.evaluate(() => {
    SAMPLES.push({ type:'bridge', text:'no chain in this one at all', answer:'x' });
    renderItemPick();
    const sel = document.getElementById('item-pick');
    sel.value = String(sel.options.length - 1);
    draw();
    return { drawn: document.getElementById('meta-drawn').textContent,
             kids: document.getElementById('prompt-text').children.length };
  });
  check('a form that declined is reported as declined, not as drawn',
        /declined/i.test(labDecline.drawn) && labDecline.kids === 0,
        JSON.stringify(labDecline));

  // the same question, on the handsets, judged on the host as a game judges it
  const chip = await page.locator('#room-chip').innerText();
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('the lab opens a room of its own', !!code, chip);

  /* The chip opens the room *here*, and offers the bench with this page as its
     board. It used to jump to a single handset in another tab, which is the wrong
     move for a rig whose point is watching several phones against the board at
     once — you lost sight of the thing the phones were acting on. */
  await page.locator('#room-chip').click(); await page.waitForTimeout(300);
  check('clicking the code opens the room panel rather than jumping to one phone',
        await page.locator('#join-panel.on').count() === 1 &&
        (await page.locator('#join-code').innerText()) === code,
        await page.locator('#join-code').innerText());
  check('and it offers the bench with this board loaded, not just a code',
        /board=prompt-lab\.html/.test(await page.locator('#bench-link').getAttribute('href')),
        await page.locator('#bench-link').getAttribute('href'));
  await page.locator('#join-panel').click({ position:{ x:5, y:5 } }); await page.waitForTimeout(200);
  if(code){
    const ph = await browser.newPage({ viewport:{ width:390, height:844 } });
    ph.__errors = []; ph.on('pageerror', e => ph.__errors.push(String(e)));
    await ph.goto(BASE + '/join.html?code=' + code + '&name=Ana&team=0&auto=1');
    await ph.waitForTimeout(700);
    await page.locator('#form-pick').selectOption('bridge'); await page.waitForTimeout(200);
    await page.locator('#ask-btn').click(); await ph.waitForTimeout(700);
    check('asking the room puts the question on the handset',
          /FIRE/i.test(await ph.locator('#qtext').innerText()),
          await ph.locator('#qtext').innerText());
    await ph.fill('#reply', 'work');
    await ph.locator('#send').click(); await page.waitForTimeout(700);
    check('and the typed answer comes back judged, by name',
          /ana/i.test(await page.locator('#reply-list').innerText()) &&
          /right/.test(await page.locator('#reply-list').innerText()),
          await page.locator('#reply-list').innerText());
    check('phone had no errors', ph.__errors.length === 0, ph.__errors[0]);
    await ph.close();
  }
  check('lab had no errors', page.__errors.length === 0, page.__errors[0]);
  await page.close();
}

/* ---- the phone bench ----
   Simulated handsets for testing phone dynamics without a class: every "phone" is
   the real join.html in an iframe on the real relay, so nothing is mocked. The two
   properties that matter: a simulated phone must never touch the browser's
   remembered seat (all iframes share one localStorage, and the seat belongs to the
   real phone), and phones rack up under their team without ever being re-parented
   (moving an iframe reloads it, which would drop its stream). */
async function testPhoneBench(browser){
  section('Playground: the phone bench');
  const game = await browser.newPage({ viewport:{ width:1280, height:720 } });
  game.__errors = []; game.on('pageerror', e => game.__errors.push(String(e)));
  await game.goto(BASE + '/playground/connections.html?p=1'); await game.waitForTimeout(900);
  const code = ((await game.locator('#room-chip').innerText()).match(/CODE\s+(\d{5})/i)||[])[1];
  check('a game with a room is up', !!code);
  if(!code){ await game.close(); return; }

  const bench = await browser.newPage({ viewport:{ width:1400, height:900 } });
  bench.__errors = []; bench.on('pageerror', e => bench.__errors.push(String(e)));

  /* A dead code has to say so on the bench — it used to fail silently there and
     announce itself only inside every phone after the join attempt. */
  await bench.goto(BASE + '/playground/phone-bench.html?code=99999'); await bench.waitForTimeout(500);
  check('a code with no game behind it says so on the bench',
        /no game with code 99999/i.test(await bench.locator('#status').innerText()),
        await bench.locator('#status').innerText());
  check('and the team picker still offers the default pair',
        await bench.locator('#team-pick option').count() === 2);

  await bench.goto(BASE + '/playground/phone-bench.html?code=' + code);
  /* Somebody's real seat is already in this browser — the fake phones must
     neither inherit it nor overwrite it. */
  await bench.evaluate(() => localStorage.setItem('engishism.seat',
    JSON.stringify({ code:'11111', name:'Real', team:1, id:'real-seat' })));
  await bench.waitForTimeout(600);

  await bench.locator('#add').click();
  await bench.locator('#add').click();
  await bench.locator('#team-pick').selectOption('1');
  await bench.locator('#add').click();
  await bench.waitForTimeout(900);

  check('three phones racked in two team columns',
        await bench.locator('.phone').count() === 3 &&
        await bench.locator('.team-col').count() === 2);
  check('columns are titled with the room\'s team names',
        /^team 1\/team 2$/i.test((await bench.locator('.team-col h2').allInnerTexts()).join('/')),
        (await bench.locator('.team-col h2').allInnerTexts()).join('/'));
  check('the game sees all three join', /3 in/.test(await game.locator('#room-chip').innerText()),
        await game.locator('#room-chip').innerText());

  // a simulated phone is live: vote from the first frame, watch it land on the board
  const ph = bench.frameLocator('.phone iframe').first();
  await ph.locator('#opts button', { hasText:/^decision$/i }).click();
  await game.waitForTimeout(700);
  check('a tap inside a simulated phone lands on the board',
        await game.locator('#grid .tile[data-word="decision"] .votes').innerText() === '1');

  const seat = await bench.evaluate(() => JSON.parse(localStorage.getItem('engishism.seat')));
  check('the real phone\'s seat is untouched by three fake joins',
        seat && seat.id === 'real-seat' && seat.code === '11111', JSON.stringify(seat));

  // removing a phone takes it out of the room; an emptied column goes with it
  await bench.locator('.team-col[data-team="1"] .phone .head button').click();
  await bench.waitForTimeout(700);
  check('removing a phone removes its column when it was the last',
        await bench.locator('.team-col').count() === 1);
  check('and the room sees it leave', /2 in/.test(await game.locator('#room-chip').innerText()),
        await game.locator('#room-chip').innerText());

  check('bench had no errors', bench.__errors.length === 0, bench.__errors[0]);
  await bench.close();
  check('game page had no errors', game.__errors.length === 0, game.__errors[0]);
  await game.close();

  /* ---- the board, on the bench ----
     A phone dynamic cannot be judged from the phone: what it produces lands on
     the board. So the bench carries the board too — the real page in a frame,
     which also means the room code never has to be copied by hand. */
  const solo = await browser.newPage({ viewport:{ width:1500, height:950 } });
  solo.__errors = []; solo.on('pageerror', e => solo.__errors.push(String(e)));
  await solo.goto(BASE + '/playground/phone-bench.html?board=connections.html');
  await solo.waitForTimeout(1800);

  check('the board opens inside the bench', await solo.locator('#stage-frame').count() === 1);
  const picked = await solo.locator('#code').inputValue();
  check('and the bench picks up its room code by itself', /^\d{5}$/.test(picked), picked);
  /* Laid out at a projector's size and scaled to fit, rather than squeezed: a
     board re-fitting itself to a 500px pane is not the board under test. Never
     past 1:1 either — upscaling blurs it and shows a size no room renders at. */
  const stageAt = () => solo.evaluate(() => {
    const f = document.getElementById('stage-frame');
    return { logical: Number(f.width), scale: Number((f.style.transform.match(/[\d.]+/)||[0])[0]) };
  });
  let stage = await stageAt();
  check('the board is laid out at a projector\'s width',
        stage.logical === 1280, JSON.stringify(stage));
  check('and is never scaled up past 1:1',
        stage.scale > 0 && stage.scale <= 1, JSON.stringify(stage));
  await solo.setViewportSize({ width:1000, height:900 }); await solo.waitForTimeout(300);
  stage = await stageAt();
  check('on a narrower window it scales down to fit',
        stage.scale < 1, JSON.stringify(stage));
  await solo.setViewportSize({ width:1500, height:950 }); await solo.waitForTimeout(300);

  // a phone added here joins the board on the same page, and its tap lands there
  await solo.locator('#add').click(); await solo.waitForTimeout(1200);

  /* Adding a phone narrows the board's pane, and nothing was re-fitting the
     stage — so the board kept the scale it opened with and was clipped on the
     right the moment a phone appeared. Screenshots found this; the earlier
     assertions did not, because they only asked what the scale was, never
     whether the board still fitted its box. */
  const fits = await solo.evaluate(() => {
    const box = document.getElementById('stage-box').getBoundingClientRect();
    const f = document.getElementById('stage-frame').getBoundingClientRect();
    return { boxW: Math.round(box.width), shownW: Math.round(f.width), over: Math.round(f.right - box.right) };
  });
  check('the board still fits its pane once a phone is beside it',
        fits.over <= 1, JSON.stringify(fits));
  const board = solo.frameLocator('#stage-frame');
  check('the board counts the phone that the bench added',
        /1 in/.test(await board.locator('#room-chip').innerText()),
        await board.locator('#room-chip').innerText());
  const word = await solo.frameLocator('.phone iframe').first()
    .locator('#opts button').first().innerText();
  await solo.frameLocator('.phone iframe').first().locator('#opts button').first().click();
  await solo.waitForTimeout(700);
  check('and a tap on that phone lands on the board in the same window',
        await board.locator('#grid .tile[data-word="'+word.toLowerCase()+'"] .votes').innerText() === '1',
        word);

  /* ---- the board can change room under the phones ----
     A playground board mints a fresh code every time it loads, so pressing "Open
     board" again — or the page reloading — left every racked phone in a room
     nobody was hosting: connected, showing a room number, and deaf to the board
     beside it. Reported as "the game no longer interacts with the phones", and
     the tell was the phone's room number differing from the board's. */
  const roomBefore = await solo.locator('#code').inputValue();
  await solo.locator('#board-open').click(); await solo.waitForTimeout(2500);
  const roomAfter = await solo.locator('#code').inputValue();
  check('re-opening the board mints a new room', roomAfter !== roomBefore,
        roomBefore + ' → ' + roomAfter);
  const phoneRoom = await solo.frameLocator('.phone iframe').first().locator('#room').innerText();
  check('and the racked phone follows the board into it',
        phoneRoom.replace(/\D/g,'') === roomAfter, phoneRoom + ' vs ' + roomAfter);
  check('so the board counts it again',
        /1 in/.test(await solo.frameLocator('#stage-frame').locator('#room-chip').innerText()),
        await solo.frameLocator('#stage-frame').locator('#room-chip').innerText());

  check('the whole-room bench had no errors', solo.__errors.length === 0, solo.__errors[0]);
  await solo.close();

  /* The hub is just another board — it exposes the same `window.HubHost`, so the
     bench needs to know nothing about which game is being played. */
  const hub = await browser.newPage({ viewport:{ width:1500, height:950 } });
  hub.__errors = []; hub.on('pageerror', e => hub.__errors.push(String(e)));
  await hub.goto(BASE + '/playground/phone-bench.html?board=../game-hub.html');
  await hub.waitForTimeout(1500);
  const hubFrame = hub.frameLocator('#stage-frame');
  await hubFrame.locator('.unit-card').first().click(); await hub.waitForTimeout(300);
  await hubFrame.locator('h3:visible', { hasText:'Jeopardy' }).first().click(); await hub.waitForTimeout(300);
  await hub.evaluate(() => {
    const w = document.getElementById('stage-frame').contentWindow;
    w.HubSettings.set('intro','off');
    w.HubSettings.set('buzzers', true);
    w.HubSettings.set('phoneMode','buzz','jeopardy');
  });
  const boxes = hubFrame.locator('#content-list input');
  const n = await boxes.count();
  for(let i = 0; i < n && await hubFrame.locator('#start-btn').isDisabled(); i++) await boxes.nth(i).check();
  await hubFrame.locator('#start-btn').click(); await hub.waitForTimeout(2000);
  const hubCode = await hub.locator('#code').inputValue();
  check('the hub on the bench hands over its room the same way',
        /^\d{5}$/.test(hubCode), hubCode);
  await hub.locator('#add').click(); await hub.waitForTimeout(1200);
  await hubFrame.locator('#board .tile').first().click(); await hub.waitForTimeout(900);
  await hub.frameLocator('.phone iframe').first().locator('#buzzer').click();
  await hub.waitForTimeout(900);
  check('a buzz from a bench phone reaches the hub board',
        /ana/i.test(await hubFrame.locator('#phone-bar').innerText()),
        (await hubFrame.locator('#phone-bar').innerText()).replace(/\n/g,' '));
  check('the hub bench had no errors', hub.__errors.length === 0, hub.__errors[0]);
  await hub.close();
}

/* ---- the answer clock ----
   Classic gives a team seconds on the floor once it buzzes in. Started by the buzz,
   never by the clue opening — the teacher reads aloud at their own pace and the
   pressure belongs on the team that claimed the right to answer. Soft at the end:
   klaxon and a pulse, and the buttons stay the teacher's. The phones watch the same
   countdown, sent as a duration with the lock so no clock comparison is needed. */
async function testAnswerClock(browser){
  section('Jeopardy: the answer clock');
  const host = await openHub(browser);
  await host.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('buzzers', true);
  });
  const preset = await host.evaluate(() => {
    const S = window.HubSettings, out = {};
    S.set('jRules','classic','jeopardy');
    out.classic = S.get('jAnswerSeconds','jeopardy');
    out.classicSteal = S.get('stealFullValue','jeopardy');
    S.set('jRules','hub','jeopardy');
    out.hub = S.get('jAnswerSeconds','jeopardy');
    out.hubSteal = S.get('stealFullValue','jeopardy');
    return out;
  });
  check('classic turns the clock on and hub turns it back off',
        preset.classic === 10 && preset.hub === 0, JSON.stringify(preset));
  check('classic pays a steal in full and hub goes back to half',
        preset.classicSteal === true && preset.hubSteal === false, JSON.stringify(preset));

  await host.evaluate(() => {
    window.HubSettings.set('phoneMode','buzz','jeopardy');
    window.HubSettings.set('jAnswerSeconds', 5, 'jeopardy');
  });
  await startGame(host, 'Jeopardy', { sections: 3 });
  await host.waitForTimeout(900);
  const chip = await host.locator('#buzzer-chip').innerText().catch(()=>'');
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('a room opens', !!code, chip.replace(/\n/g,' '));
  if (code){
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html'); await p.waitForTimeout(250);
    await p.fill('#code', code); await p.fill('#name','Ana');
    await p.locator('#join-btn').click(); await p.waitForTimeout(500);

    await host.locator('#board .tile:not(.used)').first().click(); await host.waitForTimeout(700);
    check('the clue opening starts no clock',
          await host.locator('#clue-clock').count() === 0);
    await p.locator('#buzzer').click(); await host.waitForTimeout(700);
    const shown = await host.locator('#clue-clock').innerText().catch(()=>'');
    check('the buzz starts the clock on the card', /^[1-5]$/.test(shown), shown);
    check('and the phone watches the same countdown',
          /· [0-5]/.test(await p.locator('#state').innerText()),
          await p.locator('#state').innerText());

    await host.waitForTimeout(5600);
    check('time up flags the card without deciding anything',
          await host.evaluate(() => document.getElementById('clue-card').classList.contains('overtime')));
    check('and the teacher still holds the buttons',
          await host.locator('#reveal-btn').isVisible());
    check('the phone hears time called',
          /time!/.test(await p.locator('#state').innerText()),
          await p.locator('#state').innerText());

    await host.locator('#reveal-btn').click(); await host.waitForTimeout(300);
    check('revealing retires the clock',
          await host.locator('#clue-clock').count() === 0 &&
          !(await host.evaluate(() => document.getElementById('clue-card').classList.contains('overtime'))));
    check('phone had no errors', p.__errors.length === 0, p.__errors[0]);
    await p.close();
  }
  checkClean(host, 'answer clock');
  await host.close();
}

/* ---- Jeopardy, played as the show plays it ----
   Three things the TV game has that this board never did: a hidden tile you bet on
   before seeing the clue, a final clue everyone wagers on, and a wrong answer that
   costs you. `jRules` is the preset that turns all three on at once, because "play
   it like the show" is one decision a teacher makes rather than three. */
async function testJeopardyClassic(browser){
  section('Jeopardy: the classic rules');
  const page = await openHub(browser);
  await page.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('jRules','classic','jeopardy');
  });
  const wrote = await page.evaluate(() => ({
    dd:  window.HubSettings.get('jDailyDoubles','jeopardy'),
    fin: window.HubSettings.get('jFinalRound','jeopardy'),
    ded: window.HubSettings.get('jDeduct','jeopardy')
  }));
  /* The preset *writes* the switches rather than shadowing them, so the rows in ⚙
     always say what is actually going to happen and a teacher can change one
     afterwards without the preset quietly lying about it. */
  check('the preset sets the three rules it stands for',
        wrote.dd === 1 && wrote.fin === true && wrote.ded === true, JSON.stringify(wrote));
  /* ---- what the phones do is part of the mode ----
     It was missing from the bundles at first, and that read from the room as the
     phone setting "overriding" the mode. It was not overriding anything: the mode
     had no opinion, so the row kept whatever it had last. A mode that describes how
     a round is played and says nothing about thirty handsets describes half of it. */
  const phones = await page.evaluate(() => {
    const S = window.HubSettings, out = {};
    ['hub','classic','together'].forEach(m => {
      S.set('jRules', m, 'jeopardy');
      out[m] = S.get('phoneMode', 'jeopardy');
    });
    return out;
  });
  check('each ruleset says what the phones are for',
        phones.hub === 'off' && phones.classic === 'buzz' && phones.together === 'write',
        JSON.stringify(phones));
  /* And it writes rather than shadows, so the row a teacher reads is the truth and
     they can still change it afterwards without the mode contradicting them. */
  const shown = await page.evaluate(() => {
    const host = document.createElement('div');
    window.HubSettings.renderFor(host, 'jeopardy');
    const el = host.querySelector('[data-setting="phoneMode"]');
    return el ? (el.value || '') : 'no row';
  });
  check('and the row in the panel shows what the mode chose', shown === 'write', shown);
  await page.evaluate(() => window.HubSettings.set('jRules','classic','jeopardy'));
  await page.evaluate(() => window.HubSettings.set('jRules','hub','jeopardy'));
  const back = await page.evaluate(() => ({
    dd:  window.HubSettings.get('jDailyDoubles','jeopardy'),
    fin: window.HubSettings.get('jFinalRound','jeopardy'),
    ded: window.HubSettings.get('jDeduct','jeopardy')
  }));
  check('and the hub preset puts them back',
        back.dd === 0 && back.fin === false && back.ded === false, JSON.stringify(back));

  await page.evaluate(() => {
    const S = window.HubSettings;
    S.set('jDailyDoubles',1,'jeopardy'); S.set('jDeduct',true,'jeopardy');
    S.set('jFinalRound',false,'jeopardy'); S.set('stealOnWrong',false,'jeopardy');
  });
  await page.reload(); await page.waitForTimeout(400);
  await startGame(page, 'Jeopardy', { sections:4 });
  await page.waitForTimeout(900);

  const board = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#board .tile')];
    return { total: tiles.length,
             dd: tiles.filter(t => t.dataset.dd).length,
             // nothing may give it away: a Daily Double must look like every other tile
             looksSame: tiles.filter(t => t.dataset.dd)
                             .every(t => t.className === tiles[0].className) };
  });
  check('a Daily Double is hidden on the board', board.dd === 1, JSON.stringify(board));
  check('and nothing on the tile gives it away', board.looksSame);

  /* ---- picking the ruleset mid-board has to reach the board ----
     The modes only appear in the Lab, and the Lab only exists once a game is
     running — so choosing Classic mid-board set the switch to 1 and the board still
     had none, because planting happened at build time. Reported from a full
     playthrough as "no Daily Double ever appeared". */
  const mid = await openHub(browser);
  await mid.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('jRules','hub','jeopardy');
  });
  await mid.reload(); await mid.waitForTimeout(400);
  await startGame(mid, 'Jeopardy', { sections:4 });
  await mid.waitForTimeout(800);
  const ddOf = pg => pg.evaluate(() =>
    [...document.querySelectorAll('#board .tile')].filter(t => t.dataset.dd).length);
  check('a hub board has none', await ddOf(mid) === 0);
  // play a couple of clues first, so the re-plant has used tiles to avoid
  for (const k of [0, 1]){
    await mid.locator('#board .tile').nth(k).click(); await mid.waitForTimeout(300);
    if (await mid.locator('#reveal-btn').isVisible()){ await mid.locator('#reveal-btn').click(); await mid.waitForTimeout(150); }
    if (await mid.locator('#correct-btn').isVisible()){ await mid.locator('#correct-btn').click(); await mid.waitForTimeout(300); }
  }
  await mid.evaluate(() => window.HubSettings.set('jRules','classic','jeopardy'));
  await mid.waitForTimeout(500);
  check('picking Classic mid-board plants one', await ddOf(mid) === 1, String(await ddOf(mid)));
  /* A tile the room has already answered must never become one, or a clue they have
     seen would pay a wager. */
  check('and never on a clue that has already been played',
        await mid.evaluate(() => [...document.querySelectorAll('#board .tile')]
          .every(t => !(t.dataset.dd && t.classList.contains('used')))));
  checkClean(mid);
  await mid.close();

  const idx = await page.evaluate(() =>
    [...document.querySelectorAll('#board .tile')].findIndex(t => t.dataset.dd));
  await page.locator('#board .tile').nth(idx).click(); await page.waitForTimeout(700);
  check('finding it opens a bet, not a clue',
        await page.locator('#wager-panel').isVisible() &&
        !(await page.locator('#reveal-btn').isVisible()));
  /* A Daily Double belongs to the team that found it, so no question is open to the
     room — which is what stops a reconnection re-arming the buzzers mid-bet.
     `askingNow` is the one place that decides this. */
  check('and the room is not being asked anything while the bet is placed',
        (await page.evaluate(() => window.HubGames.get('jeopardy').askingNow())) === false);
  /* No race to win, so no buzz is entitled. Refusing here must *disarm* rather than
     re-arm — re-arming is for putting the floor back when a question is still open,
     and during a wager there is no question open to anybody. */
  check('and no buzz is entitled during the wager',
        (await page.evaluate(() => window.HubGames.get('jeopardy').buzzEntitled({team:1}))) === false);
  check('and the clue itself is not shown yet',
        await page.evaluate(() => getComputedStyle(document.getElementById('clue-text')).display) === 'none');
  const range = await page.locator('#wager-range').innerText();
  check('the ceiling is the score or the biggest clue, whichever is greater',
        /\$500/.test(range), range);

  await page.locator('#wager-quick button', { hasText:'Everything' }).click();
  await page.waitForTimeout(200);
  check('betting everything takes the maximum',
        (await page.locator('#wager-amount').innerText()) === '$500',
        await page.locator('#wager-amount').innerText());
  await page.locator('#wager-ok').click(); await page.waitForTimeout(600);
  check('locking it in shows the clue', await page.locator('#reveal-btn').isVisible());
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(300);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(800);
  const scores = await page.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent));
  check('the bet is what it pays, not the tile value', scores[0] === '500', scores.join('/'));

  /* The show takes the value off you. Off by default here — a class 500 down in the
     first two minutes stops trying — but it has to work when it is on. */
  const before = await page.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent));
  const plain = await page.evaluate(() =>
    [...document.querySelectorAll('#board .tile')].findIndex(t => !t.classList.contains('used')));
  await page.locator('#board .tile').nth(plain).click(); await page.waitForTimeout(500);
  const worth = await page.evaluate(() => {
    const t = document.getElementById('clue-topline').textContent;
    const m = t.match(/\$(\d+)/); return m ? Number(m[1]) : 0;
  });
  const onTurn = await page.evaluate(() =>
    [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active')));
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(250);
  await page.locator('#wrong-btn').click(); await page.waitForTimeout(700);
  const after = await page.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent));
  check('a wrong answer costs the value when the rule is on',
        Number(after[onTurn]) === Number(before[onTurn]) - worth,
        before.join('/') + ' -> ' + after.join('/') + ' (clue $' + worth + ', team ' + onTurn + ')');

  checkClean(page);
  await page.close();

  /* ---- the final clue ----
     The reason the show never feels decided early: everyone bets what they like, so
     last place can win from there and nobody has left the room by the last five
     minutes. Driven here end to end, because every beat of it is new. */
  const fin = await openHub(browser);
  await fin.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('jRules','classic','jeopardy');
    S.set('jDailyDoubles',0,'jeopardy');      // one thing at a time
    S.set('stealOnWrong',false,'jeopardy');
  });
  await fin.reload(); await fin.waitForTimeout(400);
  await startGame(fin, 'Jeopardy', { sections:3 });
  await fin.waitForTimeout(800);

  const tiles = await fin.locator('#board .tile').count();
  for (let k = 0; k < tiles; k++){
    await fin.locator('#board .tile').nth(k).click(); await fin.waitForTimeout(180);
    if (await fin.locator('#reveal-btn').isVisible()){ await fin.locator('#reveal-btn').click(); await fin.waitForTimeout(140); }
    const btn = (k % 3 === 2) ? '#wrong-btn' : '#correct-btn';
    if (await fin.locator(btn).isVisible()) { await fin.locator(btn).click(); await fin.waitForTimeout(240); }
  }
  await fin.waitForTimeout(800);
  check('clearing the board opens the final rather than ending the game',
        /one more clue/i.test(await fin.locator('#result-card').innerText().catch(()=>'')),
        (await fin.locator('#result-card').innerText().catch(()=>'none')).replace(/\n/g,' | '));
  check('and the category is named before anybody bets',
        /the category is/i.test(await fin.locator('#result-card').innerText()));

  const beforeFinal = await fin.evaluate(() =>
    [...document.querySelectorAll('.team .score')].map(e => Number(e.textContent)));
  await fin.locator('#result-card button', { hasText:'Take the bets' }).click();
  await fin.waitForTimeout(600);

  const caps = [];
  for (let t = 0; t < 4; t++){
    if (!(await fin.locator('#wager-ok').isVisible().catch(()=>false))) break;
    caps.push(await fin.locator('#wager-range').innerText());
    await fin.locator('#wager-quick button', { hasText:'Everything' }).click();
    await fin.waitForTimeout(120);
    await fin.locator('#wager-ok').click(); await fin.waitForTimeout(600);
  }
  check('every team with a score gets to bet', caps.length === beforeFinal.filter(v => v > 0).length,
        caps.length + ' bets for ' + beforeFinal.filter(v => v > 0).length + ' teams in credit');
  check('and no team can bet more than it has',
        caps.every((c, i) => c.indexOf('$' + beforeFinal.filter(v => v > 0)[i]) !== -1),
        caps.join(' / ') + ' vs ' + beforeFinal.join('/'));
  check('then the clue goes up', /final clue/i.test(await fin.locator('#clue-topline').innerText()),
        await fin.locator('#clue-topline').innerText());
  /* ---- the final clue is the one beat where everybody answers at once ----
     Classic sets the phones to buzz, which is right for a normal clue and wrong
     here: a buzzer hands the last question of the game to one thumb, when the whole
     mechanic is that every team writes privately against the clock. The game owns
     the round while it runs, the same way Bingo owns it while the cards are out. */
  const finalRound = await fin.evaluate(() => {
    const g = window.HubGames.get('jeopardy');
    return g.phoneRound ? g.phoneRound() : null;
  });
  check('every team writes the final, whatever the mode says',
        !!finalRound && finalRound.mode === 'write', JSON.stringify(finalRound));
  check('and the mode itself is still buzz, so it is the beat that differs',
        (await fin.evaluate(() => window.HubSettings.get('phoneMode','jeopardy'))) === 'buzz');

  await fin.locator('#reveal-btn').click(); await fin.waitForTimeout(400);
  /* Settled lowest score first, as the show does it — so the team that was behind
     is the first to find out, and the leader answers last knowing what it needs. */
  const order = [];
  for (let t = 0; t < 4; t++){
    if (!(await fin.locator('#correct-btn').isVisible().catch(()=>false))) break;
    order.push(await fin.locator('#clue-topline').innerText());
    // the team that was behind gets it right, the leader does not: last place wins
    await fin.locator(t === 0 ? '#correct-btn' : '#wrong-btn').click();
    await fin.waitForTimeout(450);
  }
  check('each team is settled in turn', order.length === caps.length, order.join(' | '));
  await fin.waitForTimeout(700);
  const afterFinal = await fin.evaluate(() =>
    [...document.querySelectorAll('.team .score')].map(e => Number(e.textContent)));
  const wasLast = beforeFinal.indexOf(Math.min.apply(null, beforeFinal.filter(v => v > 0)));
  check('betting everything and getting it right doubles that team',
        afterFinal[wasLast] === beforeFinal[wasLast] * 2,
        beforeFinal.join('/') + ' -> ' + afterFinal.join('/'));
  check('and a team in last can win from there',
        afterFinal[wasLast] === Math.max.apply(null, afterFinal),
        beforeFinal.join('/') + ' -> ' + afterFinal.join('/'));
  check('the banner says the final decided it',
        /final/i.test(await fin.locator('#result-card').innerText().catch(()=>'')),
        (await fin.locator('#result-card').innerText().catch(()=>'none')).replace(/\n/g,' | '));

  checkClean(fin);
  await fin.close();
}

/* ---- the join address is there whenever phones are switched on ----
   Reported twice, once for Bingo and once for Jeopardy, both as "the code line is
   missing in this game". Neither was about the game: the phone mode was `off`, and
   `off` used to mean *no room at all* — so there was no code, and a class cannot
   join a room that does not exist. Whether a room exists is a property of the
   lesson; what the phones do during a question is the mode, and `off` is a fine
   answer to that. The chip says `idle here`, so nothing is pretending. */
async function testJoinAlwaysThere(browser){
  section('The join address is always there');
  for (const [game, sections] of [['Jeopardy', 4], ['Blockbusters', 'all'],
                                  ['Race to the Board', 'all'], ['Millionaire', 'all'],
                                  ['Bingo', 'all']]){
    const page = await openHub(browser);
    await page.evaluate(() => {
      const S = window.HubSettings;
      S.set('intro','off'); S.set('sound',false); S.set('buzzers',true);
      S.set('phoneMode','off');            // the default: nothing during a question
    });
    await page.reload(); await page.waitForTimeout(400);
    await startGame(page, game, { sections });
    await page.waitForTimeout(1200);
    const chip = await page.evaluate(() => {
      const c = document.getElementById('buzzer-chip');
      return { shown: getComputedStyle(c).display !== 'none', text: c.textContent };
    });
    check(game + ': the chip is on screen with the mode off', chip.shown, chip.text);
    check(game + ': and it carries a code to join with', /code\s*\d{5}/i.test(chip.text), chip.text);
    /* Honest about what will happen: a room to join, and nothing to do in it yet.
       Bingo says its own thing when the cards are on phones. */
    check(game + ': and says the phones are idle rather than promising a dynamic',
          /idle here|votes only|cards on phones/i.test(chip.text), chip.text);
    checkClean(page);
    await page.close();
  }
}

/* ---- Together: the class against the board ----
   Every other ruleset sets teams against each other. This one sets the room against
   a number — for a group that competition makes anxious rather than sharp. The mode
   is a bundle of switches, so both directions have to hold: on, the rules apply;
   off, the competitive game is exactly as it was. */
async function testJeopardyTogether(browser){
  section('Jeopardy: together');
  const page = await openHub(browser);
  await page.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('jRules','together','jeopardy');
  });
  const on = await page.evaluate(() => {
    const g = k => window.HubSettings.get(k, 'jeopardy');
    return { tog:g('jTogether'), hints:g('jHints'), steal:g('stealOnWrong'),
             dd:g('jDailyDoubles'), ded:g('jDeduct'), keep:g('keepControl') };
  });
  /* Everything that sets one team against another is off — that *is* the mode, and
     a preset that only ever adds would leave a steal running under a cooperative
     round. */
  check('the preset turns the class into one side',
        on.tog === true && on.hints === true, JSON.stringify(on));
  check('and switches off everything that pits teams against each other',
        on.steal === false && on.dd === 0 && on.ded === false && on.keep === false,
        JSON.stringify(on));

  await page.evaluate(() => window.HubSettings.set('jRules','classic','jeopardy'));
  const off = await page.evaluate(() => ({
    tog: window.HubSettings.get('jTogether','jeopardy'),
    hints: window.HubSettings.get('jHints','jeopardy')
  }));
  check('and another preset puts the competitive game back',
        off.tog === false && off.hints === false, JSON.stringify(off));

  await page.evaluate(() => window.HubSettings.set('jRules','together','jeopardy'));
  await page.reload(); await page.waitForTimeout(400);
  await startGame(page, 'Jeopardy', { sections:3 });
  await page.waitForTimeout(900);

  const line = await page.locator('#j-class').innerText();
  check('the board shows one number for the room', /class \$0/i.test(line), line.replace(/\n/g,' | '));
  /* The target is a share of what is actually on the board rather than a figure a
     teacher has to invent — 3 categories of $100–$500 is $4,500, and 60% of that. */
  check('and a target worked out from what the board is worth',
        /target \$2700/i.test(line), line.replace(/\n/g,' | '));

  // a hint costs part of the clue, and what the card says is what it pays
  const rich = await page.evaluate(() =>
    [...document.querySelectorAll('#board .tile')].findIndex(t => /500/.test(t.textContent)));
  await page.locator('#board .tile').nth(rich).click(); await page.waitForTimeout(600);
  check('a stuck class can buy a hand', await page.locator('#hint-btn').isVisible());
  await page.locator('#hint-btn').click(); await page.waitForTimeout(300);
  check('the hint is a real clue about the word',
        /starts with [A-Z]/i.test(await page.locator('.clue-hint').innerText()),
        await page.locator('.clue-hint').innerText());
  const topline = await page.locator('#clue-topline').innerText();
  const shown = Number((topline.match(/\$(\d+)/) || [])[1]);
  check('and it comes out of what the clue is worth', shown === 350, topline);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(250);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(800);
  const paid = await page.evaluate(() =>
    [...document.querySelectorAll('.team .score')].map(e => Number(e.textContent)).reduce((a,b)=>a+b,0));
  /* Scoring rounds Jeopardy values to 50s, so a hint that leaves $349 on the card
     and then pays $350 is the card telling the room something untrue. */
  check('what the card said is exactly what it paid', paid === shown, paid + ' vs ' + shown);
  check('and the class line counts it',
        new RegExp('class \\$' + paid, 'i').test(await page.locator('#j-class').innerText()),
        (await page.locator('#j-class').innerText()).replace(/\n/g,' | '));

  // clear the rest of the board: the ending is about the room, not a ranking
  const tiles = await page.locator('#board .tile').count();
  for (let k = 0; k < tiles; k++){
    const t = page.locator('#board .tile').nth(k);
    if (await t.evaluate(el => el.classList.contains('used'))) continue;
    await t.click(); await page.waitForTimeout(170);
    if (await page.locator('#reveal-btn').isVisible()){ await page.locator('#reveal-btn').click(); await page.waitForTimeout(130); }
    if (await page.locator('#correct-btn').isVisible()){ await page.locator('#correct-btn').click(); await page.waitForTimeout(220); }
  }
  await page.waitForTimeout(900);
  const banner = await page.locator('#result-card').innerText().catch(()=>'none');
  check('the ending talks about the target, not a winner',
        /target|short|class scored/i.test(banner) && !/wins!/i.test(banner),
        banner.replace(/\n/g,' | '));

  checkClean(page);
  await page.close();

  /* The other direction: with the mode off, none of this is on screen and the
     competitive game is untouched. */
  const comp = await openHub(browser);
  await comp.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('jRules','hub','jeopardy');
  });
  await comp.reload(); await comp.waitForTimeout(400);
  await startGame(comp, 'Jeopardy', { sections:3 });
  await comp.waitForTimeout(800);
  check('with the mode off there is no class line',
        await comp.evaluate(() => getComputedStyle(document.getElementById('j-class')).display) === 'none');
  await comp.locator('#board .tile').first().click(); await comp.waitForTimeout(500);
  check('and no hint button over a competitive clue',
        await comp.locator('#hint-btn').isVisible() === false);
  checkClean(comp);
  await comp.close();
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
    millionaire: testMillionaire, fit: testBoardFitAcrossScreens, phone: testPhoneLayout,
    settings: testSettings, scoping: testPerGameSettings, migration: testSettingsMigration,
    card: testFloatingCard, turns: testTurnsAndPoints, phoneteams: testPhoneTeams,
    strip: testPhoneStrip, bbteams: testBlockbustersTeams, jointeams: testJoinTeams,
    variants: testFlipVariants, winroute: testWinRouteVariants, gameshow: testGameShow, gsjeopardy: testGameShowJeopardy, gsblockbusters: testGameShowBlockbusters, gsrace: testGameShowRace, idents: testIdentsAreDistinct, registry: testGameRegistry, prompts: testPromptTypes, content: testContentIntegrity, topics: testTopicPicking, defaultlook: testDefaultLook, jfinish: testJeopardyFinish, competition: testCompetition, lab: testLabDrawer, range: testRangeSetting,
    buzzers: testBuzzers, phonemodes: testPhoneModes, teamvote: testTeamVote,
    typetobuzz: testTypeToBuzz, judging: testAnswerJudging,
    degradation: testDegradation, file: testFileProtocol,
    reconnect: testRelayReconnect, phonebingo: testPhoneBingo,
    classic: testJeopardyClassic, joinbar: testJoinAlwaysThere,
    together: testJeopardyTogether, jclock: testAnswerClock,
    playground: testPlaygroundConnections, bench: testPhoneBench,
    promptlab: testPromptLab
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
