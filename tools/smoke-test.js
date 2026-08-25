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
/* What a real handset's visible screen is — the ONE home, shared with the Room
   bench. Phone pages under test open at PHONES.standard (browser bars already
   subtracted), never at a chrome-less 844 the classroom will not see. */
const PHONES = require(path.join(REPO, 'playground', 'phone-profiles.js')).PHONE_PROFILES;

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
  await page.goto(BASE + (openHub.shell || '/game-hub.html'));
  await page.waitForTimeout(350);
  /* **The standings screen covers the board between questions, so it is off here for
     the same reason `cardFlip` and `intro` are** — it is presentation standing
     between a check and the thing it is checking, and a suite that played a question
     and then clicked a tile found the click intercepted by a modal it never asked
     for. The checks that are *about* the standings turn it back on. */
  await page.evaluate(() => window.HubSettings.set('roundWinBanner', false)).catch(()=>{});
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

/* **`innerText()` on a locator that matches nothing waits thirty seconds and then
   throws — and the throw happens while the *argument* to `check` is being built, so
   it takes every remaining check in that suite with it.** A missing element should
   be one red check, not an abort: `qbench` lost sixty checks for two builds because
   one selector went stale.

   `allInnerTexts()` resolves immediately with `[]` rather than waiting for a match,
   so this reports absence in milliseconds and can never throw. Reach for it whenever
   a check is asking *whether* something is drawn; keep `innerText()` for reading an
   element the test has already established is there. */
const textOf = async loc => (await loc.allInnerTexts()).join(' ').trim();

/* **Poll for a thing to become true; never sleep for it.** A fixed wait is how a
   check turns into a coin toss — a tap on a handset has to reach the relay, come
   back to the board and redraw it, and the number of milliseconds that passes on a
   quiet machine is the number that fails under load. This returns as soon as the
   condition holds and gives up honestly, so the check that follows still reports
   what it actually saw rather than throwing. */
const until = async (fn, ms = 4000, step = 120) => {
  const stop = Date.now() + ms;
  for(;;){
    if (await fn()) return true;
    if (Date.now() > stop) return false;
    await new Promise(r => setTimeout(r, step));
  }
};

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

/* **Some behaviour only exists on a plain question, and the class-facing units no
   longer have any.** Phone modes (buzz / write / type) and Jeopardy's steal both
   belong to a question the *teacher* runs: a round arms the handsets itself and
   owns its own verdict, so neither can fire on a board where every clue is a
   round. Units 4 and 5 became all-rounds, and these two suites started timing out
   waiting for a buzzer and a claim chooser that correctly never appear.

   The Lab board is the durable home for them. It is a mixing desk with one
   question type per category — eight plain, five rounds — and it is deliberately
   not class-facing, so it will not be converted out from under a test. */
async function openLabHub(browser, viewport){
  openHub.shell = '/game-hub-lab.html';
  try { return await openHub(browser, viewport); }
  finally { openHub.shell = null; }
}

/* Blockbusters awards through its own two buttons today; after the shared team
   chooser lands it will be team chips instead. Accept either, so this test spans
   the refactor rather than needing a rewrite mid-way. */
async function claimForTeam(page, index){
  /* **A live round owns the verdict**, so the claim chooser stands down while one
     is open and comes back on Reveal — otherwise the chooser would be a second way
     to award the same hexagon. Every hexagon in the converted units is a round now,
     so the teacher's path to a claim runs through Reveal, and this helper has to
     take it too. It was written when a hexagon was a plain clue and the chooser was
     simply there. */
  /* `:visible`, not merely present: the chooser's chips stay in the DOM and are
     hidden, so counting them found five buttons nobody could click. */
  const chips = page.locator('.claim-team:visible');
  if (!(await chips.count()) && await page.locator('#reveal-btn:visible').count()){
    await page.locator('#reveal-btn').click();
    await page.waitForTimeout(600);
  }
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
  check('four options offered', await page.locator('.mc-opt').count() === 4);
  const fit = await boardFits(page, '.mc-opt');
  check('stage is on screen', fit.ok, fit.why);

  // 50:50 must remove two wrong options and never the right one
  const right = await currentMillionaireAnswer(page);
  await page.locator('.lifeline[data-life="fifty"]').click(); await page.waitForTimeout(250);
  check('50:50 removes two options', await page.locator('.mc-opt.removed').count() === 2);
  const removedRight = await page.locator(`.mc-opt.removed[data-word="${right}"]`).count();
  check('50:50 keeps the correct option', removedRight === 0);
  check('50:50 is spent', await page.locator('.lifeline[data-life="fifty"]').isDisabled());

  /* The show's beat: a click is the team saying a letter, and nothing is revealed
     until the host asks. What makes it worth a test rather than a flourish is that
     it must be *reversible* — the room shouting "no, C!" has to be able to land. */
  const wrongFirst = await page.evaluate(r =>
    ([...document.querySelectorAll('#m-options .mc-opt:not(.removed)')]
      .find(x => x.dataset.word !== r) || {}).dataset.word || null, right);
  await page.locator(`.mc-opt[data-word="${wrongFirst}"]`).click(); await page.waitForTimeout(200);
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
  await page.locator('.mc-opt:not(.chosen):not(.removed)').first().hover();
  await page.waitForTimeout(120);
  const hoveredPlain = await paintOf('.mc-opt:not(.chosen):not(.removed)');
  await page.locator('.mc-opt.chosen').hover(); await page.waitForTimeout(120);
  const hoveredPicked = await paintOf('.mc-opt.chosen');
  check('the locked option keeps its colour under the pointer',
        hoveredPicked !== hoveredPlain, hoveredPicked + '  vs  ' + hoveredPlain);
  check('picking an option locks it in without revealing',
        await page.locator('.mc-opt.chosen').count() === 1 &&
        await page.locator('.mc-opt.right').count() === 0 &&
        await page.locator('#m-final').isVisible(),
        await page.locator('#m-hint').innerText());
  check('nothing is scored until the answer is final', (await scores(page))[0] === '0',
        (await scores(page)).join('/'));

  await page.locator(`.mc-opt[data-word="${right}"]`).click(); await page.waitForTimeout(200);
  check('picking another option moves the lock rather than answering',
        await page.locator('.mc-opt.chosen').count() === 1 &&
        (await page.locator('.mc-opt.chosen').getAttribute('data-word')) === right,
        await page.locator('.mc-opt.chosen').getAttribute('data-word'));

  /* The round holds a beat between the answer landing and the tile paying, so the
     room sees which one it was — `J_GROUP_TAKE_MS`. Millionaire inherits it, which
     is the same pause the show's own "lock it in, then pay it off" already had. */
  await page.locator('#m-final').click(); await page.waitForTimeout(1400);
  check('correct answer scores 100', (await scores(page))[0] === '100', (await scores(page)).join('/'));
  check('correct option is marked', await page.locator('.mc-opt.right').count() === 1);
  check('the lock clears on the reveal', await page.locator('.mc-opt.chosen').count() === 0);
  check('and "Final answer?" goes away with it', !(await page.locator('#m-final').isVisible()));

  await page.locator('#m-next').click(); await page.waitForTimeout(350);
  check('turn passes to team 2', /team 2/i.test(await page.locator('#m-turn').innerText()));

  /* **Ask the class with no phones is not offered, and says why.** It used to turn
     the options into a tally pad for hands in the air. Now that every question is a
     multiple choice *round*, the room votes on its handsets all the way through and
     the lifeline reveals counts the board is already holding — so with no relay
     there is genuinely nothing to reveal.

     That is a real loss against the hands-in-the-air version, and the honest trade
     for the round owning the room. A disabled control reads as broken, so it carries
     the reason: the phones half is covered in the `phonemodes` suite. */
  const ask = page.locator('.lifeline[data-life="class"]');
  check('with no relay, Ask the class is not offered', await ask.isDisabled());
  check('and it says why rather than looking broken',
        /no phones/i.test(await ask.getAttribute('title') || ''),
        await ask.getAttribute('title'));
  /* Tapping an option is answering again, with no tally mode to fall into — which
     was the dead end this block was originally written for: counting used to be the
     only state a click could mean. */
  const right2 = await currentMillionaireAnswer(page);
  await playMillionaireOption(page, page.locator(`.mc-opt[data-word="${right2}"]`));
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
  if(await final.isVisible() && !(await final.isDisabled())) await final.click();
  /* The round holds a beat between the answer landing and the board paying, so the
     room sees which option it was. Returning before it lands made every caller of
     this helper read the score one question behind. */
  await page.waitForTimeout(1200);
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
  await page.evaluate(() => window.HubSettings.open()); await page.waitForTimeout(250);
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
    window.HubSettings.set('phonePrompt', false);
    window.HubSettings.set('phonePrompt', true, 'millionaire');
  });
  await page.evaluate(() => window.HubSettings.open()); await page.waitForTimeout(250);
  await page.locator('.settings-tab', { hasText:'All games' }).click(); await page.waitForTimeout(150);
  const masterRow = page.locator('.settings-row', { hasText:'Show the question on the phones' });
  /* **Asserted on the marker and the game's name, not on the sentence.** This asked
     for the words "overridden in millionaire" and had been red since that line was
     deliberately reworded — a game can differ because a teacher set it *or* because
     it registered its own default, so the row says "Has its own value in …" and
     carries a comment saying why it must not say "overridden". Pinning prose pins
     the wrong thing: what this check is about is that the master row does not
     silently reach a game it cannot change, and that there is a way to get there. */
  check('the master row names the game overriding it',
        await masterRow.locator('.settings-state.overridden').count() === 1 &&
        (await textOf(masterRow.locator('.settings-state.overridden .settings-undo')))
          .toLowerCase().includes('millionaire'),
        (await textOf(masterRow)).replace(/\n/g,' · '));
  await masterRow.locator('.settings-undo').click(); await page.waitForTimeout(200);
  check('clicking the name jumps straight to that game\'s tab',
        (await page.locator('.settings-tab.on').innerText()).toLowerCase() === 'millionaire');
  check('and the row there confirms the override, matching what the master claimed',
        /set for this game/i.test(await page.locator('.settings-row', { hasText:'Show the question on the phones' }).innerText()));
  await page.locator('.settings-undo', { hasText:/match all games/i }).click(); await page.waitForTimeout(200);
  await page.locator('.settings-tab', { hasText:'All games' }).click(); await page.waitForTimeout(150);
  check('clearing the override removes the master-row warning',
        !/overridden/i.test(await masterRow.innerText()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);

  await page.evaluate(() => window.HubSettings.open()); await page.waitForTimeout(200);
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

  await page.evaluate(() => window.HubSettings.open()); await page.waitForTimeout(250);
  const tabs = await page.locator('.settings-tab').allInnerTexts();
  check('a tab per game plus All games', tabs.length >= 5, tabs.join('|'));
  const masterRows = await page.locator('.settings-row').count();
  await page.locator('.settings-tab', { hasText:'Jeopardy' }).click(); await page.waitForTimeout(200);
  const jeoRows = await page.locator('.settings-row').count();
  check('a game tab shows only what applies to it', jeoRows > 0 && jeoRows < masterRows,
        jeoRows + ' of ' + masterRows);
  /* A game may be *registered* with its own default (Jeopardy's multiple choice
     starts on all-agree) — that is not an override, and the row says so in its
     own words. What this check pins is that a fresh device carries nothing a
     teacher has set. */
  check('nothing is overridden to begin with',
        (await page.locator('.settings-state').allInnerTexts()).every(t => /matching|own default/i.test(t)));
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
  await playMillionaireOption(page, page.locator('#m-options .mc-opt'));
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
/* The audit itself, lifted out of the suite so it can be run against more than one
   page. It walks `window.UNITS`, so a unit is checked by being loaded — which is
   the property that matters, and the reason the Lab shell is now opened too: the
   Lab unit is deliberately absent from `game-hub.html`, so for two sessions it was
   authored with no gate on it at all. */
const UNIT_AUDIT = () => {
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
    const ROUNDS = (window.HubKit && window.HubKit.round) || { of:()=>null };
    const out = [];
    (window.UNITS || []).forEach(u => {
      const id = u.id || '?';
      const banks = { jeopardy:[], blockbusters:[], race:[], millionaire:[] };
      (u.jeopardyCategories||[]).forEach(c => c.clues.forEach(x => banks.jeopardy.push({ p:x.q, a:x.a, section:c.section })));
      (u.blockbustersBank||[]).forEach(x => banks.blockbusters.push({ p:x.clue, a:x.answer, section:x.section, letter:x.letter, round:!!ROUNDS.of(x) }));
      (u.raceBank||[]).forEach(x => banks.race.push({ p:x.prompt, a:x.answer, section:x.section,
                                                      round: !!window.HubKit.round.of(x) }));
      (u.millionaireBank||[]).forEach(x => banks.millionaire.push({ p:x.prompt, a:x.answer, section:x.section, level:x.level, distractors:x.distractors }));

      // a prompt in two banks
      const where = new Map();
      Object.keys(banks).forEach(b => banks[b].forEach(i => {
        const k = norm(i.p); if(!where.has(k)) where.set(k, new Set()); where.get(k).add(b);
      }));
      where.forEach((set, k) => { if(set.size > 1)
        out.push({kind:'dupe', msg:id + ': prompt in ' + [...set].join(' + ') + ' — "' + k.slice(0,60) + '"'}); });

      /* **Every round's own rules, asked of the round.** These were a per-round
         block here — needs two options, no duplicate steps, an answer that is
         actually one of the options — which is knowledge the round already has and
         the bench's editor needed too. Two callers, so it moved onto the shelf as
         `check(item)`; this asks the registry, so a round written next month is
         audited without this file being edited. The same move as `fields()`.

         What stays here is what is Jeopardy's rather than the round's: `a` and
         `type` are *this bank's* field names, and no round should ever learn that
         Jeopardy calls an answer `a`. */
      (u.jeopardyCategories||[]).forEach(c => c.clues.forEach(x => {
        const hit = ROUNDS.of(x); if(!hit) return;
        const tag = id + ': "' + String(x.q).slice(0, 40) + '"';
        /* Normalised first, exactly as `jShowClue` does it: a round is handed
           `{text, …}` and has never learned that this bank calls a prompt `q`.
           Checking the raw item would report every clue as missing its question. */
        const item = Object.assign({}, x, { text:x.q });
        (hit.def.check(item) || []).forEach(m =>
          out.push({kind:hit.id, msg:tag + ' \u2014 ' + m}));
        if(x.a) out.push({kind:hit.id, msg:tag + ' \u2014 carries an `a` as well as a ' + hit.id + '; the answer is in the round'});
        if(x.type) out.push({kind:hit.id, msg:tag + ' \u2014 carries type "' + x.type + '" as well as a ' + hit.id});
      }));

      // Jeopardy: equal-length categories, sections contiguous (or a heading prints twice)
      const cats = u.jeopardyCategories || [];
      const lens = new Set(cats.map(c => c.clues.length));
      if(cats.length && lens.size > 1) out.push({kind:'jeopardy', msg:id + ': categories differ in length — ' + [...lens].join('/')});
      const secs = cats.map(c => c.section);
      secs.forEach((s, i) => { if(i && s !== secs[i-1] && secs.slice(0, i).indexOf(s) !== -1)
        out.push({kind:'jeopardy', msg:id + ': jeopardy section ' + s + ' is not contiguous'}); });
      /* Every category must show a name: its own, or — for a round category — the
         round's label, which the engine derives (categoryName) so the redundant copies
         can be dropped from content. A category that resolves to neither renders a
         blank heading, which is how a stripped name would fail silently. */
      cats.forEach(c => {
        const hit = c.clues && c.clues[0] ? ROUNDS.of(c.clues[0]) : null;
        if(!(c.name || (hit && hit.def && hit.def.label)))
          out.push({kind:'jeopardy', msg:id + ': category ' + c.id + ' has no name and no round to derive one'});
      });

      /* Blockbusters, the same two-part split the Jeopardy block above makes: a
         round is asked its own rules, and this bank's own tidiness stays here.

         **A hexagon that opens a round has no initial to match.** A grouping set
         has four answers and an ordering scale has five, so the one-word rule and
         the letter rule are asked of ordinary clues only. What every hexagon still
         owes is a `letter`, because that is the hexagon's *name* — how a team says
         which one they are attacking, and what the picking vote counts — and it is
         a label rather than a promise about the answer. */
      (u.blockbustersBank||[]).forEach(x => {
        const tag = id + ': "' + String(x.clue).slice(0, 40) + '"';
        if(!String(x.letter || '').trim())
          out.push({kind:'blockbusters', msg:tag + ' — no letter; a hexagon has to be nameable'});
        const hit = ROUNDS.of(x);
        if(!hit) return;
        // normalised first, exactly as `openBlockbustersClue` does it — a round has
        // never learned that this bank calls a prompt `clue`
        const item = Object.assign({}, x, { text:x.clue });
        (hit.def.check(item) || []).forEach(m =>
          out.push({kind:hit.id, msg:tag + ' — ' + m}));
        if(x.answer) out.push({kind:hit.id, msg:tag + ' — carries an `answer` as well as a ' + hit.id + '; the answer is in the round'});
        if(x.type) out.push({kind:hit.id, msg:tag + ' — carries type "' + x.type + '" as well as a ' + hit.id});
      });
      banks.blockbusters.forEach(i => {
        if(i.round) return;
        if(/\s/.test(String(i.a).trim())) out.push({kind:'blockbusters', msg:id + ': answer is not one word — ' + i.a});
        if(String(i.a)[0].toUpperCase() !== String(i.letter).toUpperCase())
          out.push({kind:'blockbusters', msg:id + ': letter ' + i.letter + ' does not match ' + i.a});
      });

      /* Race: an *ordinary* answer becomes a tile, so one word and never repeated.
         A round item has no single answer — it puts nothing on the board and is
         played on the handsets — so the tile rules do not apply to it, exactly as
         Blockbusters' one-word-and-initial rules stand down for a round hexagon.
         Its own shape is checked by the round's `check(item)` above. */
      const tiles = new Set();
      banks.race.forEach(i => {
        if(i.round) return;
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
};

/* Only for the check's wording — the rules are the round's, this is prose. An id
   with no entry simply reads as itself, so a new round needs nothing here. */
const ROUND_LABELS = {
  grouping:'grouping clues are well formed',
  ordering:'ordering clues are well formed, and every step is glossed',
  choice:'multiple choice clues are well formed, and every answer is one of its options'
};

async function testContentIntegrity(browser){
  section('Content integrity');
  const page = await openHub(browser);
  const report = await page.evaluate(UNIT_AUDIT);

  /* The Lab board, behind its own shell. It is not lesson content and never reaches
     a class, but it is authored by hand like everything else and its grouping clues
     have constraints no engine check would catch. */
  const lab = await browser.newPage({ viewport:{ width:1280, height:720 } });
  lab.__errors = []; lab.__console = [];
  lab.on('pageerror', e => lab.__errors.push(String(e)));
  await lab.goto(BASE + '/game-hub-lab.html'); await lab.waitForTimeout(350);
  const labReport = await lab.evaluate(UNIT_AUDIT);
  report.problems = report.problems.concat(labReport.problems);

  const of = k => report.problems.filter(p => p.kind === k);
  const first = k => (of(k)[0] || {}).msg;
  check('every unit loaded', report.units > 0, report.units + ' units');
  check('the Lab unit is checked too, behind its own shell',
        labReport.units === 1, labReport.units + ' units on the lab shell');
  /* The one thing that must stay true of that shell: it does not put the Lab in
     front of a class. Asserted on the hub, not on the lab page. */
  check('and the Lab unit is not on the ordinary hub',
        !(await page.evaluate(() => (window.UNITS||[]).some(u => u.id === 'unit-lab'))));
  /* One check per registered round, asked of the registry rather than listed here —
     so a round written next month is audited the day it ships, with this file
     untouched. The rules themselves live on the round as `check(item)`, which is the
     same rulebook the bench's editor reads: an author and the gate disagreeing about
     what a valid question is would be worse than neither existing. */
  const roundIds = await lab.evaluate(() => window.HubKit.round.ids());
  check('every registered round is audited, not a list kept by hand',
        roundIds.length >= 3, roundIds.join(','));
  roundIds.forEach(rid =>
    check(ROUND_LABELS[rid] || (rid + ' clues are well formed'), !of(rid).length, first(rid)));
  await lab.close();
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
    /* A teacher cannot otherwise tell a clue the room *plays* on their phones from
       one the teacher reveals, and those are two different lessons. Every row says
       which, on every board — the chip is derived from the items, so a category can
       never claim to hold rounds it does not. */
    check(game + ': every row says whether it holds questions or rounds',
          rows.every(r => /QUESTION|ROUND|MIXED/i.test(r)), rows.find(r => !/QUESTION|ROUND|MIXED/i.test(r)) || '');
  }

  /* Units 4 and 5 carry no round fields at all, so every row there is an ordinary
     question — and the Lab board is where the other two answers live. Asserting both
     is what stops the chip being a constant that happens to read right. */
  {
    const p2 = await browser.newPage({ viewport:{ width:1280, height:900 } });
    await p2.goto(BASE + '/game-hub-lab.html'); await p2.waitForTimeout(400);
    await p2.evaluate(() => window.HubSettings.set('intro','off'));
    await p2.getByText('Lab', { exact:false }).first().click(); await p2.waitForTimeout(220);
    await p2.locator('h3:visible', { hasText:'Jeopardy' }).first().click(); await p2.waitForTimeout(300);
    const kindOf = async name => p2.evaluate(n => {
      const row = [...document.querySelectorAll('#content-list .cat-check')]
        .find(r => new RegExp(n, 'i').test((r.querySelector('.name')||{}).textContent || ''));
      return row ? ((row.querySelector('.kind')||{}).textContent || '(none)') : '(no row)';
    }, name);
    check('a round category is labelled as a round, with the round named',
          /^Round · Connections$/.test(await kindOf('Connections')), await kindOf('Connections'));
    check('and an ordinary category is labelled a question',
          /^Question$/.test(await kindOf('Gap Fill')), await kindOf('Gap Fill'));
    /* A round can be **derived** rather than authored: Millionaire's items carry
       `{answer, distractors}` and no round field at all, so the chip has to ask the
       game how it reads its own bank (`asRound`). Without that a whole ladder of
       rounds reported as ordinary questions, which is how it was found. */
    // `#back-to-games` — `#new-game-btn` lives on the play screen and is not up yet
    await p2.locator('#back-to-games').click(); await p2.waitForTimeout(220);
    await p2.locator('h3:visible', { hasText:'Millionaire' }).first().click(); await p2.waitForTimeout(300);
    const lm = await p2.evaluate(() => [...document.querySelectorAll('#content-list .cat-check')]
      .map(r => (r.querySelector('.kind')||{}).textContent || '(none)'));
    check('a derived round is labelled a round, not a question',
          lm.length > 0 && lm.every(t => /^Round · /.test(t)), lm.join(' / '));

    /* Blockbusters' LB1 deliberately mixes twelve ordinary clues with six rounds, so
       it is the only place the third state appears. */
    await p2.locator('#back-to-games').click(); await p2.waitForTimeout(220);
    await p2.locator('h3:visible', { hasText:'Blockbusters' }).first().click(); await p2.waitForTimeout(300);
    const bb = await p2.evaluate(() => [...document.querySelectorAll('#content-list .cat-check')]
      .map(r => (r.querySelector('.kind')||{}).textContent || '(none)'));
    check('a mixed section says how many of it are rounds',
          bb.some(t => /^Mixed · \d+ rounds$/.test(t)), bb.join(' / '));
    check('and a rounds-only section says so without naming one',
          bb.some(t => /^Rounds · \d+ types$/.test(t)), bb.join(' / '));
    await p2.close();
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
        await page.locator('.mc-opt').count() === 4,
        String(await page.locator('.mc-opt').count()));

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
  await page.evaluate(() => window.HubSettings.open()); await page.waitForTimeout(250);
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
  const SHARED = ['round_default','phonePrompt','sound','soundVolume','theme','intro'];
  const offered = await page.evaluate(list => {
    const out = {};
    window.HubGames.ids().forEach(g => {
      const host = document.createElement('div');
      window.HubSettings.renderOnce(host, g);
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

  /* Anything presenting the set of forms — the question bench does — has to be able to
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
/* ---- the standings, between questions ----
   The screen that replaced the winner banner. What is worth pinning is not that it
   draws — that is one selector — but the three things it exists to say: everybody is
   on it whether they scored or not, the gain is this question's rather than a total,
   and the arrows are movement rather than decoration. The last one needs a competitor
   to genuinely overtake another, which the first version of this check forgot to
   arrange: the same team won twice, nothing moved, and it read as the arrows being
   broken when they were correct. */
async function testStandings(browser){
  section('The standings between questions');
  const page = await openLabHub(browser);
  await page.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off'); S.set('buzzers', false);
    S.set('roundWinBanner', true);
  });
  await startGame(page, 'Jeopardy', { sections:'all', unit:'Lab' });
  await page.evaluate(() => window.HubTeams && window.HubTeams.ensure(4));
  await page.waitForTimeout(300);

  /* The teacher's own path — no phones — so this is also the no-relay case. */
  const playTile = async () => {
    const tiles = page.locator('#board .tile:not(.used)');
    const n = await tiles.count();
    for (let k = 0; k < n; k++){
      await tiles.nth(n - 1 - k).click(); await page.waitForTimeout(600);
      if (await page.locator('#clue-group.round-choice').count()) break;
      const c = page.locator('#close-btn');
      if (await c.isVisible().catch(()=>false)){ await c.click(); await page.waitForTimeout(350); }
    }
    const right = await page.evaluate(() => {
      const shown = (document.getElementById('clue-text').textContent||'')
                      .replace(/\s+/g,' ').trim().toLowerCase();
      const cats = (window.UNITS||[]).flatMap(u => u.jeopardyCategories||[]);
      for (const c of cats) for (const cl of (c.clues||[]))
        if (cl.choice && shown.indexOf(String(cl.q).replace(/\s+/g,' ').trim().toLowerCase().slice(0,28)) !== -1)
          return cl.choice.answer;
      return null;
    });
    if (!right) return false;
    await page.locator('#clue-group .mc-opt[data-word="' + right.replace(/"/g,'\\"') + '"]').click();
    await page.waitForTimeout(200);
    await page.locator('#group-btn').click(); await page.waitForTimeout(900);
    const rv = page.locator('#reveal-btn');
    if (await rv.isVisible().catch(()=>false)){ await rv.click(); await page.waitForTimeout(700); }
    const cl = page.locator('#close-btn');
    if (await cl.isVisible().catch(()=>false)){ await cl.click(); await page.waitForTimeout(900); }
    return true;
  };
  const rowsOf = () => page.evaluate(() =>
    [...document.querySelectorAll('#standings-rows .st-row')].map(r => ({
      place: r.querySelector('.st-place').textContent.trim(),
      move:  r.querySelector('.st-move').textContent.trim(),
      name:  r.querySelector('.st-name').textContent.trim(),
      pts:   Number(r.querySelector('.st-pts').textContent.trim()),
      gain:  r.querySelector('.st-gain').textContent.trim(),
      took:  r.classList.contains('took')
    })));

  check('a question can be played', await playTile());
  check('the standings come up on their own',
        await page.locator('#standings-modal.on').count() === 1);
  const r1 = await rowsOf();
  check('every competitor is on it, not only the ones who scored',
        r1.length === 4, 'n=' + r1.length);
  check('the one that took it is marked', r1.some(r => r.took));
  check('and carries what this question paid', r1.some(r => /^\+\d+$/.test(r.gain)));
  check('no arrows the first time — nobody rose from nowhere',
        r1.every(r => r.move === '\u00b7'), r1.map(r => r.move).join(''));
  await page.locator('#standings-go').click(); await page.waitForTimeout(350);
  check('Continue puts it away',
        await page.locator('#standings-modal.on').count() === 0);

  /* Somebody has to actually overtake, or the arrows have nothing to say. */
  const plus = page.locator('#scorebar .team').nth(1).locator('button', { hasText:'+' });
  for (let i = 0; i < 12; i++){ await plus.click(); await page.waitForTimeout(35); }
  check('a second question can be played', await playTile());
  const r2 = await rowsOf();
  const up = r2.find(r => r.move === '\u25b2'), down = r2.find(r => r.move === '\u25bc');
  check('the one that was overtaken shows a fall, the one that passed it a rise',
        !!up && !!down && up.pts > down.pts,
        r2.map(r => r.name + r.move).join(' '));
  check('and the gain is this question only, not the running total',
        !!down && down.gain !== '' && Number(down.gain.slice(1)) < down.pts,
        JSON.stringify(r2.map(r => ({ n:r.name, p:r.pts, g:r.gain }))));
  await page.locator('#standings-go').click(); await page.waitForTimeout(300);

  /* Sixteen individuals: the case the old in-stage leaderboard could not hold. */
  await page.evaluate(() => {
    window.HubSettings.set('roster','solo');
    window.HubTeams.ensure(16);
  });
  await page.waitForTimeout(400);
  check('a question with sixteen playing', await playTile());
  const box = await page.locator('#standings-card').boundingBox();
  check('the card is on screen at 1280x720 with sixteen',
        box && box.y >= 0 && box.y + box.height <= 720,
        JSON.stringify(box && { y:Math.round(box.y), h:Math.round(box.height) }));
  const drawn = (await rowsOf()).length;
  check('and everybody is either drawn or counted in the tail',
        drawn === 16 || (await page.locator('.st-more').count()) === 1,
        'drawn=' + drawn);

  check('no uncaught errors', page.__errors.length === 0, page.__errors.slice(0,2).join(' | '));
  await page.close();

  /* ---- a team is placed by its last student, not its keenest ----
     **The one rule in all of this that nothing else would catch.** In `agree` mode a
     round only produces a team's answer once every member has committed, so the
     arrival stamp lands when the team *agreed*. If it landed on the first tap
     instead, a team with one fast thumb would beat a team of two who genuinely
     worked it out — which is precisely the behaviour `agree` exists to stop, and it
     would be invisible on any board with one handset per team.

     Team 1 has two phones and taps first-but-incomplete; Team 2 has one phone and
     answers outright in between. Team 2 must come first. */
  const tp = await openLabHub(browser);
  await tp.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('buzzers', true); S.set('roundWinBanner', false);
    S.set('round_choice', 'agree', 'jeopardy');
  });
  await startGame(tp, 'Jeopardy', { sections:'all', unit:'Lab' });
  const tcode = (((await tp.locator('#buzzer-chip').innerText().catch(()=>'')) || '')
                  .match(/CODE\s+(\d{5})/i) || [])[1];
  check('a room opens for the timing check', !!tcode, tcode || 'none');
  if (tcode){
    const seat = async (name, team) => {
      const ph = await browser.newPage({ viewport:{ width:390, height:844 } });
      await ph.goto(BASE + '/join.html'); await ph.waitForTimeout(220);
      await ph.fill('#code', tcode); await ph.fill('#name', name);
      await ph.locator('.teams button').nth(team).click();
      await ph.locator('#join-btn').click(); await ph.waitForTimeout(420);
      return ph;
    };
    const a1 = await seat('Ana', 0), a2 = await seat('Abe', 0), b1 = await seat('Bea', 1);
    await tp.waitForTimeout(500);
    const tiles = tp.locator('#board .tile:not(.used)');
    const tn = await tiles.count();
    for (let k = 0; k < tn; k++){
      await tiles.nth(tn - 1 - k).click(); await tp.waitForTimeout(600);
      if (await tp.locator('#clue-group.round-choice').count()) break;
      const c = tp.locator('#close-btn');
      if (await c.isVisible().catch(()=>false)){ await c.click(); await tp.waitForTimeout(340); }
    }
    const ans = await tp.evaluate(() => {
      const shown = (document.getElementById('clue-text').textContent||'')
                      .replace(/\s+/g,' ').trim().toLowerCase();
      const cats = (window.UNITS||[]).flatMap(u => u.jeopardyCategories||[]);
      for (const c of cats) for (const cl of (c.clues||[]))
        if (cl.choice && shown.indexOf(String(cl.q).replace(/\s+/g,' ').trim().toLowerCase().slice(0,28)) !== -1)
          return cl.choice.answer;
      return null;
    });
    const tapOpt = async (ph, word) => {
      const n = await ph.locator('#opts button').count();
      for (let i = 0; i < n; i++){
        const t = (await ph.locator('#opts button').nth(i).innerText()).trim();
        if (t.toLowerCase() === String(word).toLowerCase()){
          await ph.locator('#opts button').nth(i).click({ timeout:2500 }).catch(()=>{});
          return true;
        }
      }
      return false;
    };
    if (ans){
      await tapOpt(a1, ans);              // half of Team 1 — not yet an answer
      await tp.waitForTimeout(1600);
      await tapOpt(b1, ans);              // Team 2 answers outright
      await tp.waitForTimeout(1600);
      await tapOpt(a2, ans);              // Team 1 completes, later
      await tp.waitForTimeout(1600);
      const places = await tp.evaluate(() => window.HubKit.round.results.list()
                       .map(r => ({ who:r.who, place:r.place })));
      check('the team that agreed later is placed later, however early one member tapped',
            places.length === 2 && places[0].who === 1 && places[1].who === 0,
            JSON.stringify(places));
    } else {
      check('the timing check found an answer to drive', false, 'no choice clue');
    }
    for (const ph of [a1, a2, b1]) await ph.close();
  }
  await tp.close();
}

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
      const opts = [...document.querySelectorAll('.mc-opt')].map(e => e.getBoundingClientRect());
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
    /* The Lab board, and L1/L2 specifically: `round_default` is what the phones do
       when **no round owns them**, so this suite needs plain clues. See the note on
       `openLabHub` — the class-facing units have none left. */
    const page = await openLabHub(browser);
    await page.evaluate(m => {
      window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
      window.HubSettings.set('buzzers', true); window.HubSettings.set('round_default', m, 'jeopardy');
    }, mode);
    await startGame(page, 'Jeopardy', { sections:3, unit:'Lab' });
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
  /* The Lab board, the documented home for behaviour that only exists on a plain
     clue: the buzz this test drives is `round_default`, and Units 4 and 5 are
     all-rounds now, so a tile there arms the handsets itself and `#buzzer` never
     shows — the same stale-check class `turns`, `competition` and `phonemodes`
     already paid for. */
  const host = await openLabHub(browser);
  await host.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
    window.HubSettings.set('buzzers', true); window.HubSettings.set('round_default','buzz','jeopardy');
    document.getElementById('add-team-btn').click();
    document.getElementById('add-team-btn').click();
  });
  await host.waitForTimeout(200);
  const names = ['Lions','Tigers','Bears','Wolves'];
  for (let i = 0; i < names.length; i++){
    await host.locator('.team .tname').nth(i).fill(names[i]);
    await host.locator('.team .tname').nth(i).dispatchEvent('change');
  }
  await startGame(host, 'Jeopardy', { sections:'all', unit:'Lab' });
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
      window.HubGames.ids().forEach(g => window.HubSettings.set('round_default', m, g));
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

  /* The Lab board's plain categories. The steal and the deduction belong to a
     question the teacher runs — a live round owns its own verdict and offers no
     steal, which is correct and is why these timed out once the class-facing
     units became all-rounds. See `openLabHub`. */

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
    const pg = await openLabHub(browser);
    await pg.evaluate(() => {
      const S = window.HubSettings;
      S.set('cardFlip','off'); S.set('intro','off'); S.set('sound',false);
      S.set('jRules','classic','jeopardy');       // writes stealFullValue on
      S.set('jDailyDoubles', 0, 'jeopardy');      // an ordinary first tile
      S.set('jDeduct', false, 'jeopardy');        // isolate what the steal pays
      S.set('round_default','off','jeopardy');
    });
    await startGame(pg, 'Jeopardy', { sections:3, unit:'Lab' });
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
  let page = await openLabHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('cardFlip', 'off'); window.HubSettings.set('intro', 'off');
    window.HubSettings.set('stealOnWrong', true, 'jeopardy');
  });
  await startGame(page, 'Jeopardy', { sections:3, unit:'Lab' });
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
  page = await openLabHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('cardFlip', 'off'); window.HubSettings.set('intro', 'off');
    window.HubSettings.set('stealOnWrong', false, 'jeopardy');
    window.HubSettings.set('keepControl', false, 'jeopardy');
  });
  await startGame(page, 'Jeopardy', { sections:3, unit:'Lab' });
  const before = await activeTeam(page);
  await openFirstClue(page);
  await page.locator('#wrong-btn').click(); await page.waitForTimeout(1300);
  check('switched off, a miss closes the question', !(await page.locator('#clue-modal').isVisible()));
  check('switched off, a miss burns the tile', await page.locator('#board .tile.used').count() === 1);
  check('switched off, a miss passes the turn', await activeTeam(page) !== before);
  check('and nothing was scored', (await scores(page)).every(v => v === '0'), (await scores(page)).join('/'));

  // ---- keep control, both ways
  await page.evaluate(() => window.HubSettings.set('keepControl', false, 'jeopardy'));
  await startGame(page, 'Jeopardy', { sections:3, unit:'Lab' });
  const heldBefore = await activeTeam(page);
  await openFirstClue(page);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(1300);
  check('with keep-control off, a correct answer hands over', await activeTeam(page) !== heldBefore);

  await page.evaluate(() => window.HubSettings.set('keepControl', true, 'jeopardy'));
  await startGame(page, 'Jeopardy', { sections:3, unit:'Lab' });
  const keptBefore = await activeTeam(page);
  await openFirstClue(page);
  await page.locator('#correct-btn').click(); await page.waitForTimeout(1300);
  check('with it on, the team keeps the board', await activeTeam(page) === keptBefore);
  checkClean(page, 'steal off');
  await page.close();

  // ---- streak: three in a row for one team
  page = await openLabHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('cardFlip', 'off'); window.HubSettings.set('intro', 'off');
    window.HubSettings.set('keepControl', true, 'jeopardy');
    window.HubSettings.set('streak', true, 'jeopardy');
  });
  await startGame(page, 'Jeopardy', { sections:3, unit:'Lab' });
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
  /* Millionaire keeps Unit 5: its ladder needs every rung covered and the Lab's
       Millionaire section is a single one. Its steal is the *rung's* value, which a
       round host pays out normally, so it never depended on a plain question. */
    await startGame(page, 'Millionaire', { sections:'all', unit:'Unit 5' });
  const right = await currentMillionaireAnswer(page);
  const wrong = await page.evaluate(r => {
    const b = [...document.querySelectorAll('#m-options .mc-opt')].find(x => x.dataset.word !== r);
    return b ? b.dataset.word : null;
  }, right);
  await playMillionaireOption(page, page.locator(`.mc-opt[data-word="${wrong}"]`));
  await page.waitForTimeout(900);
  check('a missed rung is offered to the other team',
        /steal it for 50/i.test(await page.locator('#m-hint').innerText()),
        await page.locator('#m-hint').innerText());
  /* The stealing team gets the same two beats, not a shortcut — the steal reopens
     the question rather than resuming a half-answered one. */
  await playMillionaireOption(page, page.locator('.mc-opt', { hasText: right }));
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
  const opt = page.locator('#m-options .mc-opt[data-word="' + answer.replace(/"/g,'\\"') + '"]');
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
    master: window.HubSettings.get('round_default'),
    race:   window.HubSettings.get('round_default','race'),
    mill:   window.HubSettings.get('round_default','millionaire'),
    jeo:    window.HubSettings.get('round_default','jeopardy'),
    left:   Object.keys(JSON.parse(localStorage.getItem('engishism.gamehub.settings')))
              .filter(k => /^phone(Write|Vote|BuzzGames|Mode)/.test(k))
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
  await page.evaluate(() => window.HubSettings.set('round_default','off','race'));
  await page.reload(); await page.waitForTimeout(400);
  check('a mode chosen after the migration survives a reload',
        await page.evaluate(() => window.HubSettings.get('round_default','race')) === 'off');

  /* `vote` shipped as a phoneMode value, so it is in real localStorage — and a value
     naming a variant that no longer exists is the worst kind: nothing matches it, so
     the phones go quiet while the panel still claims a dynamic is running. */
  await page.evaluate(() => localStorage.setItem('engishism.gamehub.settings',
    JSON.stringify({ phoneMode:'vote', 'phoneMode@millionaire':'vote',
                     'phoneMode@race':'buzz' })));
  await page.reload(); await page.waitForTimeout(400);
  const vm = await page.evaluate(() => ({
    master: window.HubSettings.get('round_default'),
    mill:   window.HubSettings.get('round_default','millionaire'),
    race:   window.HubSettings.get('round_default','race')
  }));
  check('a mode that no longer exists becomes off, not a dead value',
        vm.master === 'off' && vm.mill === 'off', JSON.stringify(vm));
  check('and a mode that still exists is left alone', vm.race === 'buzz', vm.race);
  check('vote is no longer offered as something the phones do',
        await page.evaluate(() => window.HubSettings.variantsFor('round_default','millionaire')
          .every(v => v.value !== 'vote')));

  /* F3.8.16: `phoneMode` itself became `round_default`, so a third generation of
     stored value has to survive. The same two traps as every migration before it —
     the old key being present is the signal, and dropping it is what makes this run
     once — but with one addition worth pinning: a *per-game override* is what a
     teacher set deliberately, and it is the thing a careless migration loses while
     the master value looks fine. */
  await page.evaluate(() => localStorage.setItem('engishism.gamehub.settings',
    JSON.stringify({ phoneMode:'write', 'phoneMode@jeopardy':'buzz',
                     'phoneMode@bingo':'type' })));
  await page.reload(); await page.waitForTimeout(400);
  const dr = await page.evaluate(() => ({
    master: window.HubSettings.get('round_default'),
    jeo:    window.HubSettings.get('round_default','jeopardy'),
    bingo:  window.HubSettings.get('round_default','bingo'),
    race:   window.HubSettings.get('round_default','race'),
    left:   Object.keys(JSON.parse(localStorage.getItem('engishism.gamehub.settings')))
              .filter(k => /^phoneMode/.test(k))
  }));
  check('the old phone mode becomes the default round\'s mode',
        dr.master === 'write', JSON.stringify(dr));
  check('and every per-game override comes with it',
        dr.jeo === 'buzz' && dr.bingo === 'type', JSON.stringify(dr));
  check('a game that never had an override still follows the master',
        dr.race === 'write', dr.race);
  check('the old key is dropped, so a later choice cannot be overwritten',
        dr.left.length === 0, dr.left.join(','));
  await page.evaluate(() => window.HubSettings.set('round_default','off','jeopardy'));
  await page.reload(); await page.waitForTimeout(400);
  check('and a mode chosen after that migration survives a reload',
        await page.evaluate(() => window.HubSettings.get('round_default','jeopardy')) === 'off');

  /* The row a teacher sees must be the same row it always was — this is meant to be
     invisible to them. It is built from the round's own `modes` now, so what is
     asserted is that the round declares all four and that the row still sits with
     the other phone switches rather than under Questions with the shaped rounds. */
  const row = await page.evaluate(() => {
    const S = window.HubSettings;
    return { values: S.variantsFor('round_default','jeopardy').map(v => v.value),
             mill:   S.variantsFor('round_default','millionaire').map(v => v.value) };
  });
  check('the default round offers the four phone dynamics',
        ['off','buzz','write','type'].every(v => row.values.indexOf(v) !== -1),
        JSON.stringify(row.values));
  check('and Millionaire is still refused the typing race, as before',
        row.mill.indexOf('type') === -1, JSON.stringify(row.mill));

  await page.evaluate(() => localStorage.removeItem('engishism.gamehub.settings'));
  checkClean(page);
  await page.close();
}

/* The board carries no settings UI of its own any more — the gear, the clue-card
   Tune pill and the docked drawer were removed when settings moved to the room
   bench. The registry stays (the bench edits it through the frame); this asserts
   the on-board entrances are gone, and that the panel *logic* the bench renders is
   still correct — tested by rendering a game's view into a throwaway host with
   `renderFor`, the same call the bench makes. */
async function testLabDrawer(browser){
  section('The board has no settings UI — the panel logic lives in the bench');
  const page = await openHub(browser);
  check('no gear button on the board', await page.locator('#settings-btn').count() === 0);
  check('no docked drawer', await page.locator('#lab-drawer').count() === 0);
  check('no separate Lab button', await page.locator('#lab-btn').count() === 0);
  check('no Tune pill on the clue card', await page.locator('#clue-tune').count() === 0);

  await startGame(page, 'Race to the Board', { sections:'all' });
  await page.waitForTimeout(300);
  // the L key used to toggle the drawer; it must do nothing now
  await page.keyboard.press('l'); await page.waitForTimeout(150);
  check('the L key opens nothing',
        await page.locator('#lab-drawer').count() === 0 &&
        !(await page.locator('#settings-modal').isVisible()));

  /* A game's view carries that game's switches and not another game's, and the
     phone dynamic is one picker — rendered into a host, not read off any on-board UI. */
  const view = await page.evaluate(() => {
    const host = document.createElement('div'); document.body.appendChild(host);
    window.HubSettings.renderOnce(host, 'race');
    const labels = [...host.querySelectorAll('.settings-row')].map(r => r.textContent).join(' | ');
    const modeSel = host.querySelectorAll('[data-setting="round_default"]');
    const out = {
      rows: host.querySelectorAll('.settings-row').length,
      hasOwn: /re-scatter|round length/i.test(labels),
      notOther: !/lifelines/i.test(labels),
      onePicker: modeSel.length === 1 && modeSel[0].tagName === 'SELECT'
    };
    host.remove();
    return out;
  });
  check('a game view carries that game\'s switches', view.rows > 0 && view.hasOwn, String(view.rows));
  check('and not one that belongs to another game only', view.notOther);
  check('the phone dynamic is one picker, not a row of switches', view.onePicker);

  /* A change through the registry is an override scoped to that game, not the others. */
  const before = await page.evaluate(() => window.HubSettings.get('round_default'));
  await page.evaluate(() => window.HubSettings.set('round_default','write','race'));
  check('a change is scoped to this game',
        await page.evaluate(() => window.HubSettings.get('round_default','race')) === 'write');
  check('and leaves every other game alone',
        await page.evaluate(() => window.HubSettings.get('round_default')) === before,
        String(await page.evaluate(() => window.HubSettings.get('round_default'))));

  /* The ruleset leads a game's settings and every row a bundle touches says what the
     chosen mode set it to — checked on Jeopardy, the game that has a ruleset. */
  const rules = await page.evaluate(() => {
    window.HubSettings.set('jRules','classic','jeopardy');
    const host = document.createElement('div'); document.body.appendChild(host);
    window.HubSettings.renderOnce(host, 'jeopardy');
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

  /* Folding: a group header closes its rows and opens them again — exercised in a
     host, so the fold works with no on-board panel. */
  const fold = await page.evaluate(() => {
    const host = document.createElement('div'); document.body.appendChild(host);
    window.HubSettings.renderOnce(host, 'jeopardy');
    const sel = '.settings-groupbody';
    const open0 = host.querySelectorAll(sel + ':not(.closed)').length;
    const header = host.querySelector('.settings-group.foldable');
    header.click();
    const open1 = host.querySelectorAll(sel + ':not(.closed)').length;
    header.click();
    const open2 = host.querySelectorAll(sel + ':not(.closed)').length;
    host.remove();
    return { open0, open1, open2 };
  });
  check('a group header folds its rows away', fold.open1 === fold.open0 - 1, JSON.stringify(fold));
  check('and unfolds them again', fold.open2 === fold.open0);

  await page.evaluate(() => window.HubSettings.clearOverride('round_default','race'));
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
  await page.evaluate(() => window.HubSettings.open()); await page.waitForTimeout(300);
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
                              window.HubSettings.set('round_default', 'buzz', 'race'); });
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

  /* `armed()` already polls and gives up honestly, so a slow relay is one red check —
     but the *click* on the next line then throws on a disabled button and takes the
     rest of the suite with it, which is the abort pattern this file has paid for
     twice. Seen once under a nine-suite sequential run and never standalone, so it is
     load rather than a defect; guarded so the difference stays visible either way. */
  const stealArmed = await armed(bruno);
  check('the steal re-opens the buzzers', stealArmed);
  if (stealArmed){ await bruno.locator('#buzzer').click(); await host.waitForTimeout(600); }
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
  await host.evaluate(() => window.HubSettings.set('round_default', 'buzz', 'race'));
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

  /* `lab:true` opens the Lab shell and its plain categories. **`round_default` is
     what the phones do when no round owns them, and the class-facing units have no
     plain questions left** — every Jeopardy clue in Units 4 and 5 is a round now, so
     a board opened there arms the handsets with the round and `write`/`buzz` can
     never fire. This suite went red at its third check and *threw*, taking the other
     sixty with it, which is why the Millionaire checks further down had not run for
     two builds. Same move `turns` and `competition` already made — see `openLabHub`. */
  const openRoom = async (game, prefs, opts) => {
    const o = opts || {};
    const host = await (o.lab ? openLabHub(browser) : openHub(browser));
    await host.evaluate(p => {
      window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
      window.HubSettings.set('buzzers', true);
      Object.keys(p).forEach(k => { if(k !== '__g') window.HubSettings.set(k, p[k], p.__g); });
    }, prefs);
    await startGame(host, game, Object.assign({ sections:o.lab ? 3 : 'all' },
                                              o.lab ? { unit:'Lab' } : {}, o));
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
  const w = await openRoom('Jeopardy', { __g:'jeopardy', round_default:'write', phoneOneEach:true },
                           { lab:true });
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
  const v = await openRoom('Millionaire', { __g:'millionaire', round_default:'off' });
  check('a room opens for Ask the class even with the phones idle', !!v.code, v.code || 'none');
  if (v.code){
    /* **The default round says `off` and the phones are busy anyway, which is
       correct.** Millionaire draws every question through the multiple choice round
       now, so the round owns the handsets and the default round never gets a look
       in — `off` describes what an *ordinary* question does, and there are none
       here. That is the whole point of a round, and it is why the two checks that
       used to live here (a chip reading "votes only", a phone idle until the
       lifeline) were asserting a Millionaire that no longer exists. They failed for
       two builds without being noticed, because `phonemodes` was not in the set run
       when the ladder became a round. */
    const ana = await join(v.code, 'Ana', 0), ben = await join(v.code, 'Ben', 1);
    await v.host.waitForTimeout(400);
    check('the round arms the phones itself, whatever the default round is set to',
          await ana.locator('#opts button').count() === 4,
          String(await ana.locator('#opts button').count()));
    /* And the lifeline has to be reachable, which is the bug this rewrite found.
       It disables itself when there is no room to reveal counts from, and
       Millionaire deals its first question inside `start()` — before the room's code
       has come back. Nothing repainted it when the room arrived, so Ask the class
       sat greyed out saying there were no phones, over a room the class had joined.
       Blockbusters' vote button had been fixed for exactly this a session earlier,
       one line above in the same handler. */
    check('and Ask the class is reachable once the room is up',
          !(await v.host.locator('.lifeline[data-life="class"]').isDisabled()),
          await v.host.locator('.lifeline[data-life="class"]').getAttribute('title'));
    await v.host.locator('.lifeline[data-life="class"]').click(); await v.host.waitForTimeout(700);
    check('the phone offers the four options', await ana.locator('#opts button').count() === 4);
    await ana.locator('#opts button').first().click(); await v.host.waitForTimeout(300);
    await ben.locator('#opts button').first().click(); await v.host.waitForTimeout(600);
    check('the votes land on the board',
          (await v.host.locator('.mc-votes').allInnerTexts())[0] === '2',
          (await v.host.locator('.mc-votes').allInnerTexts()).join('/'));
    /* And the board stays answerable. With phones voting there are no hands to tap,
       so turning the options into a tally pad only dead-ends the round: the counts
       arrive over the wire and the teacher's next click is the team's answer.

       **The tally pad is gone entirely now, not merely relabelled.** This asked for
       the button to read "Done voting" — the wording it had while the lifeline
       borrowed the handsets and had to hand them back. There is no borrowing, so
       there is nothing to close, and the control is not offered at all. */
    check('there is no tally pad to dead-end in',
          !(await v.host.locator('#m-done-count').isVisible()),
          await textOf(v.host.locator('#m-done-count')) || '(hidden)');
    /* Answer it correctly on purpose. Clicking whichever option the shuffle put
       first made this a coin toss: a wrong one is legitimately answered *and* then
       handed to the other team by stealOnWrong, which reopens the question — so
       there is no "Next team" and the reveal classes are cleared again. Neither
       outcome is a bug, and neither is what this check is about. */
    const vAnswer = await currentMillionaireAnswer(v.host);
    await playMillionaireOption(v.host,
      v.host.locator('#m-options .mc-opt[data-word="' + vAnswer.replace(/"/g,'\\"') + '"]'));
    await v.host.waitForTimeout(500);
    check('clicking an option answers instead of adding a phantom hand',
          await v.host.locator('#m-next').isVisible(),
          await v.host.locator('#m-hint').innerText());
    for (const p of [ana, ben]) await p.close();
  }
  checkClean(v.host, 'voting');
  await v.host.close();

  /* **Ask the class stopped borrowing the phones, and these checks had not noticed.**
     They asserted a buzzer being taken away by the vote and handed back when it
     closed — the shape the lifeline had when it ran a second poll of its own. It does
     not: the round already asks the room on every question, so the lifeline reveals
     the counts the board is holding and the handsets are never disturbed. Running a
     second vote against them was two dynamics arming one phone, which is the bug that
     change was made to remove.

     So what is pinned now is that the handsets do **not** move. `round_default:'buzz'`
     again on purpose: it is the value that used to produce the borrowing. */
  const vb = await openRoom('Millionaire', { __g:'millionaire', round_default:'buzz' });
  if (vb.code){
    const ana = await join(vb.code, 'Ana', 0);
    await vb.host.waitForTimeout(500);
    const beforeOpts = await ana.locator('#opts button').allInnerTexts();
    check('the round has the phones before the lifeline',
          beforeOpts.length === 4 && !(await ana.locator('#buzzer').isVisible()),
          beforeOpts.join('|'));
    /* **Answer it wrongly on purpose**, the same coin toss the block above already
       pays for: one phone is the whole of its team, so a right answer wins the
       question outright and there is no live round left to say anything about. Which
       option the shuffle put first is not the test. */
    const vbRight = await currentMillionaireAnswer(vb.host);
    const vbWrong = beforeOpts.filter(o => o !== vbRight);
    /* The class votes *first*, which is the order the room actually runs in: the
       round asks on every question, and the lifeline is spent to see what came back.
       Spending it against a room that has said nothing reveals nothing, which is the
       one case that would say nothing about the borrowing either way. */
    await ana.locator('#opts button', { hasText:new RegExp('^' + vbWrong[0]
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
    await vb.host.waitForTimeout(600);
    check('the board holds the votes without showing them',
          (await vb.host.locator('.mc-votes').count()) === 0,
          (await vb.host.locator('.mc-votes').allInnerTexts()).join('/'));
    await vb.host.locator('.lifeline[data-life="class"]').click(); await vb.host.waitForTimeout(700);
    /* A count is drawn on an option somebody chose and nowhere else, so one vote is
       one tag reading "1" — asserting four would be asserting a row of zeroes that
       are deliberately not drawn. */
    check('Ask the class reveals them without touching the handsets',
          (await ana.locator('#opts button').allInnerTexts()).join('|') === beforeOpts.join('|') &&
          (await vb.host.locator('.mc-votes').allInnerTexts()).join('/') === '1',
          (await ana.locator('#opts button').allInnerTexts()).join('|') + ' · counts ' +
          (await vb.host.locator('.mc-votes').allInnerTexts()).join('/'));
    /* And the student is not spent for the rest of the question. The old flow
       disarmed the room for the length of the vote, which is exactly the cost the
       reveal-only version removes — so a change of mind still lands. The strip names
       the *team* and what it is saying, not the student, once a round owns the room. */
    const second = vbWrong[1];
    await ana.locator('#opts button', { hasText:new RegExp('^' + second
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
    await until(async () => (await textOf(vb.host.locator('#phone-bar'))).includes(second));
    check('and a phone can still change its mind while the counts are up',
          (await textOf(vb.host.locator('#phone-bar'))).includes(second),
          (await textOf(vb.host.locator('#phone-bar'))).replace(/\n/g,' ') + ' · wanted ' + second);
    check('phone had no errors', ana.__errors.length === 0, ana.__errors[0]);
    await ana.close();
  }
  checkClean(vb.host, 'ask the class leaves the phones alone');
  await vb.host.close();

  // ---- buzzing for the floor in a tile game
  const bz = await openRoom('Jeopardy', { __g:'jeopardy', round_default:'buzz' }, { lab:true });
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

  /* ---- there is no buzz to win in Millionaire any more ----
     This was three blocks driving `mBuzzRole`'s three values, and they had been red
     — and *throwing*, on a `#buzzer` that is never drawn — since the ladder became a
     round host. The setting is retired (see the note where it is dropped in
     `hub-engine.js`), so what is worth pinning is the state that replaced it: the
     round owns the handsets for the whole of a live question, whatever the default
     round is set to. Asserted with `round_default:'buzz'` deliberately — that is the
     setting that used to produce a buzzer here, so this fails if a rung ever stops
     hosting its round. */
  const mTurn = host => host.evaluate(() =>
    [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active')));

  const nb = await openRoom('Millionaire', { __g:'millionaire', round_default:'buzz' });
  if (nb.code){
    const before = await mTurn(nb.host);
    const bea    = await join(nb.code, 'Bea', before === 0 ? 1 : 0);
    await nb.host.waitForTimeout(600);
    check('the round owns the handsets, so a rung offers options rather than a buzzer',
          await bea.locator('#opts button').count() === 4 &&
          !(await bea.locator('#buzzer').isVisible()),
          String(await bea.locator('#opts button').count()) + ' options');
    /* The turn order is the reason `mBuzzRole` existed at all — the ladder is per
       team so everyone gets a full arc, and nothing a handset does may take that
       off the team on turn. Still true, now because there is no buzz rather than
       because a setting refused it. Answered wrongly on purpose: a right answer from
       the only phone on a team ends the question, and what happens after that is the
       ladder's business rather than this check's. */
    const nbRight = await currentMillionaireAnswer(nb.host);
    const nbWrong = (await bea.locator('#opts button').allInnerTexts())
      .find(o => o !== nbRight);
    await bea.locator('#opts button', { hasText:new RegExp('^' + nbWrong
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
    await nb.host.waitForTimeout(700);
    check('and a handset answering does not move the turn',
          await mTurn(nb.host) === before, 'turn moved to ' + await mTurn(nb.host));
    check('phone had no errors', bea.__errors.length === 0, bea.__errors[0]);
    await bea.close();
  }
  checkClean(nb.host, 'millionaire has no buzz');
  await nb.host.close();

  /* ---- Race timed rounds ask the phones too ----
     This was `if(raceMode==='h2h')`, so half of Race ignored phoneMode entirely and
     the phones sat idle whatever the teacher had picked. */
  const rt = await openRoom('Race to the Board', { __g:'race', round_default:'buzz' },
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
  const q = await openRoom('Jeopardy', { __g:'jeopardy', round_default:'write' });
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
  const rw = await openRoom('Race to the Board', { __g:'race', round_default:'write' });
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
     never reached them. It also never called askPhones at all.

     **That bug is still worth pinning; the text box it used to be pinned with is
     not.** The ladder hosts a round, so `round_default` never gets a look in here and
     the handsets get the round's four options rather than a reply field. What the
     race between the deal and the room's code decides is the same either way: does
     the first question of the game reach a phone at all. */
  const mw = await openRoom('Millionaire', { __g:'millionaire', round_default:'write' });
  if (mw.code){
    const ana = await join(mw.code, 'Ana', 0);
    await mw.host.waitForTimeout(700);
    check('Millionaire asks the room when it deals a question',
          await ana.locator('#opts button').count() === 4,
          String(await ana.locator('#opts button').count()));
    check('and the question travels with it',
          (await textOf(ana.locator('#qtext'))).length > 0);
    /* The strip names the team and what it is saying rather than the student, once a
       round owns the room — so this reads back the option that was tapped. A wrong
       one on purpose: a right answer from the only phone on a team wins the question
       and the strip then names the payout instead, which is a different check. */
    const mwRight = await currentMillionaireAnswer(mw.host);
    const picked = (await ana.locator('#opts button').allInnerTexts())
      .find(o => o !== mwRight);
    await ana.locator('#opts button', { hasText:new RegExp('^' + picked
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
    await until(async () => (await textOf(mw.host.locator('#phone-bar'))).includes(picked));
    check('the answers land in the standard strip, the same one every game uses',
          (await textOf(mw.host.locator('#phone-bar'))).includes(picked),
          (await textOf(mw.host.locator('#phone-bar'))).replace(/\n/g,' ') + ' · wanted ' + picked);
    await ana.close();
  }
  checkClean(mw.host, 'millionaire typing');
  await mw.host.close();

  /* Students trickle in. One who joins mid-question has to arrive into that
     question rather than watch a blank screen until the next one. */
  const late = await openRoom('Jeopardy', { __g:'jeopardy', round_default:'write' }, { lab:true });
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
  const lesson = await openRoom('Jeopardy', { __g:'jeopardy', round_default:'buzz' });
  if (lesson.code){
    const dee = await join(lesson.code, 'Dee', 0);
    await lesson.host.waitForTimeout(400);

    await lesson.host.locator('#new-game-btn').click(); await lesson.host.waitForTimeout(400);
    check('leaving a game does not throw the class out',
          await dee.locator('#screen-play').isVisible());

    await lesson.host.evaluate(() => window.HubSettings.set('round_default','buzz','race'));
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
    await lesson.host.evaluate(() => window.HubSettings.set('round_default','buzz','race'));
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

  /* ---- a room of individuals: every phone is its own competitor ----
     **The bug this catches made a question unfinishable for one student**, and it
     recurred because it was fixed at the reader rather than at the seam. `seat` is
     one-way — the relay updates its record and tells the phone, but pushes no roster
     to the host — so `players()` went on reporting the team each handset *joined*
     with. In solo nobody picks a team, so several phones read as competitor 0, and a
     share is `ceil(need/size)`: the competitor the host double-counted was told two
     words was its lot, on a four-word answer.

     Joined with no team param on purpose. That is what the solo join screen and the
     bench rack both do, and passing one would hide the bug entirely. The cap is read
     off the handset rather than from any internal, because what a student can hold
     is the thing that actually matters. */
  /* Built inline rather than through `openRoom`: Connections is the ninth category
     on the Lab board and `startGame` ticks the first N, so it has to be picked by
     name. Three is the minimum the board will build from. */
  const solo = { host: await openLabHub(browser) };
  await solo.host.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('cardFlip','off'); S.set('buzzers', true);
    S.set('roundWinBanner', false); S.set('roster','solo');
  });
  await solo.host.getByText('Lab', { exact:false }).first().click();
  await solo.host.waitForTimeout(220);
  await solo.host.locator('h3:visible', { hasText:'Jeopardy' }).first().click();
  await solo.host.waitForTimeout(220);
  await solo.host.locator('#content-list label', { hasText:'Connections' }).first().locator('input').check();
  const soloBoxes = solo.host.locator('#content-list label input');
  for (let i = 0, added = 0; i < await soloBoxes.count() && added < 2; i++){
    const b = soloBoxes.nth(i);
    if (!(await b.isChecked())){ await b.check(); added++; }
  }
  await solo.host.locator('#start-btn').click();
  await solo.host.waitForTimeout(800);
  solo.code = ((await solo.host.locator('#buzzer-chip').innerText().catch(()=>'')).match(/CODE\s+(\d{5})/i)||[])[1];

  check('a room of individuals opens', !!solo.code, solo.code || 'none');
  if (solo.code){
    const soloJoin = async name => {
      const p = await browser.newPage({ viewport:{ width:390, height:844 } });
      p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
      await p.goto(BASE + '/join.html?code=' + solo.code + '&name=' + name + '&auto=1');
      await p.waitForTimeout(450);
      return p;
    };
    /* **All at once, and that is the assertion.** The first version of this joined
       them one at a time and passed on the broken build, which is exactly how the
       bug got through a fix and a check and was reported a second time. Simultaneous
       joins fire a roster push each, every push replaces the host's player list
       wholesale, and a phone whose seat has not yet reached the relay comes back on
       team 0 with the local write discarded — so the room believes several people
       share one competitor and each is told half the answer is their share. Ten,
       because the race needs enough phones in flight to open the gap. */
    const crowd = await Promise.all(
      ['Ana','Ben','Carla','Dan','Eva','Finn','Gia','Hugo','Iris','Jo'].map(soloJoin));
    await solo.host.waitForTimeout(2500);

    const col = await solo.host.evaluate(() =>
      [...document.querySelectorAll('#board .cat-header')]
        .findIndex(h => /Connections/i.test(h.textContent)));
    await solo.host.locator('#board .tile').nth(col).click();
    await solo.host.waitForTimeout(900);

    /* Tap everything and see what sticks — the handset says the cap out loud when
       you go past it, and what it *keeps* is the cap however it was worded. */
    const caps = [];
    for (const p of crowd){
      const opts = p.locator('#opts button');
      const n = await opts.count();
      for (let i = 0; i < n; i++){ await opts.nth(i).click(); await p.waitForTimeout(60); }
      caps.push(await p.locator('#opts button.on, #opts button.picked, #opts button[aria-pressed="true"]').count());
    }
    check('every individual can hold the whole answer, not half of it',
          caps.length > 0 && caps.every(c => c === caps[0]) && caps[0] === 4,
          'caps=' + caps.join(','));
    for (const p of crowd){ check('phone had no errors', p.__errors.length === 0, p.__errors[0]); await p.close(); }
  }
  checkClean(solo.host, 'individuals');
  await solo.host.close();
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
    window.HubSettings.set('round_default','type','race');
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
    race: window.HubSettings.variantsFor('round_default','race').map(v=>v.value),
    mill: window.HubSettings.variantsFor('round_default','millionaire').map(v=>v.value)
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
    window.HubSettings.set('round_default','off','blockbusters');
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
    window.HubSettings.set('round_default','off','blockbusters');
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
                              window.HubSettings.set('round_default', 'buzz', 'race');
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

  /* The room says which instance of itself is speaking. Rooms live in the relay's
     memory and the deployed relay restarts on every push, so a reconnecting host
     can be handed a brand-new empty room wearing the old code — and the hub's
     "stay quiet, the room already knows" memories are all lies against it. The
     epoch on `ready` is how the hub tells the two apart: same room, same epoch. */
  const epochOf = s => (s.match(/"epoch":"([a-z0-9]+)"/) || [])[1];
  const epoch1 = epochOf(seen);
  check('ready names the room instance it comes from', !!epoch1,
        seen.replace(/\n/g,' ').slice(0,160));

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

  /* ---- the teacher kicks a phantom ----
     A handset that dies without closing its connection stays on the roster,
     inflating its team's size — which breaks every share and every all-agree
     gate, and nothing else can remove it. The kick is the way out. The phone is
     told before it is cut, so a live one kicked by mistake knows what happened
     rather than showing "reconnecting…" over a room it is no longer in. */
  let ghostSeen = '';
  const ghost = await stream('room=' + code + '&id=ghost1&name=Ghost&team=0');
  if (ghost.res) ghost.res.on('data', c => ghostSeen += c);
  await wait(400);
  check('the phantom is on the roster',
        /Ghost/.test((seen.match(/"players":\[[^\]]*\]/g) || []).pop() || ''));
  await post({ type:'kick', room:code, id:'ghost1' });
  await wait(500);
  check('a kicked phone is told, then cut', /event: kicked/.test(ghostSeen),
        ghostSeen.replace(/\n/g,' ').slice(-120));
  check('and the host sees it leave',
        /event: leave/.test(seen) &&
        !/Ghost/.test((seen.match(/"players":\[[^\]]*\]/g) || []).pop() || ''),
        (seen.match(/"players":\[[^\]]*\]/g) || []).pop());
  check('kicking a phone that is not there is not an error',
        (await post({ type:'kick', room:code, id:'nobody' })).status === 200);

  /* ---- a team removed on the host renumbers the phones ----
     A team's index is its identity on both ends, and it used to shift only on
     the board: every joined phone kept the number it joined under, and the first
     live class paid a win to a team that no longer existed. */
  let p1seen = '', p2seen = '';
  const p1 = await stream('room=' + code + '&id=pp1&name=Pia&team=1');
  const p2 = await stream('room=' + code + '&id=pp2&name=Quinn&team=2');
  if (p1.res) p1.res.on('data', c => p1seen += c);
  if (p2.res) p2.res.on('data', c => p2seen += c);
  await wait(400);
  await post({ type:'remap', room:code, removed:1 });
  await wait(500);
  check('a phone on the removed team lands on team 0',
        /event: team\ndata: \{"team":0\}/.test(p1seen), p1seen.replace(/\n/g,' ').slice(-90));
  check('a phone above it shifts down one',
        /event: team\ndata: \{"team":1\}/.test(p2seen), p2seen.replace(/\n/g,' ').slice(-90));
  check('and the host gets the renumbered roster',
        /"pp2","name":"Quinn","team":1/.test(seen.replace(/\s/g,'').match(/"players":\[[^\]]*\]/g)?.pop() || '') ||
        /Quinn/.test((seen.match(/"players":\[[^\]]*"team":1[^\]]*\]/g) || []).pop() || ''),
        (seen.match(/"players":\[[^\]]*\]/g) || []).pop());
  if (p1.req) p1.req.destroy();
  if (p2.req) p2.req.destroy();

  /* ---- two hub tabs on one room ----
     Only one host stream may be live, and the newest wins. Ending the loser
     silently makes it look like a network drop, so its EventSource reconnects —
     which ends the winner, which reconnects, forever. Every one of those `ready`
     events re-asks the phones, so the whole room's buzzers flicker on and off
     while every connection is technically fine. That is what the second flicker
     report turned out to be, after the reconnect fix had ruled out the first. */
  const h2 = await stream('role=host&room=' + code);
  let seen2 = '';
  if (h2.res) h2.res.on('data', c => seen2 += c);
  await wait(400);
  check('the replaced host is told, not just cut off', /event: replaced/.test(seen),
        seen.replace(/\n/g,' ').slice(-120));
  /* An ordinary reconnect must keep the epoch, or every reconnect would look like
     a dead room and re-arm the phones — which is the flicker this suite exists
     to keep dead. */
  check('the same living room reports the same epoch on a reconnect',
        !!epoch1 && epochOf(seen2) === epoch1, epochOf(seen2) + ' vs ' + epoch1);
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
  await page.evaluate(() => window.HubSettings.set('round_default', 'buzz', 'bingo'));
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
    window.HubSettings.set('round_default', 'buzz', 'bingo');
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
  /* Not showing a room, which is what "no relay" actually has to mean. The chip
     says `connecting…` first and settles on `phones off` only after the retries run
     out — a relay that is merely asleep is the common failure, so giving up in the
     first second was the wrong behaviour to pin. What the page owes with no relay is
     that it stays playable and never claims a room nobody can join. */
  check('no relay: the chip never shows a room code',
        !/\d{5}/.test(await solo.locator('#room-chip').innerText()),
        await solo.locator('#room-chip').innerText());
  for (const w of ['decision','mistake','noise','progress'])
    await solo.locator('#grid .tile[data-word="'+w+'"]').click();
  await solo.locator('#submit-btn').click(); await solo.waitForTimeout(400);
  check('and the game still plays', await solo.locator('.solved-group').count() === 1);
  check('no errors without a relay', solo.__errors.length === 0, solo.__errors[0]);
  await solo.close();

  check('host page had no errors', page.__errors.length === 0, page.__errors[0]);
  await page.close();
}

/* ---- the playground: Word Thermometer ----
   The bench's second game, and the reason the shelf grew. It shares teams, the
   clock, the mistake budget and the vote-leader with Connections through
   bench-kit.js — so this suite is also what proves the extraction is real rather
   than a second copy under a new name. The answer here is a *sequence*, not a set,
   which is what made it worth building second: two genuinely different callers
   shape a shared API, two near-identical ones only flatter it. */
async function testThermometer(browser){
  section('Playground: Word Thermometer');
  const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
  page.__errors = []; page.on('pageerror', e => page.__errors.push(String(e)));
  // ?p=1 pins the anger scale: annoyed < irritated < angry < livid < furious < incensed
  await page.goto(BASE + '/playground/thermometer.html?p=1'); await page.waitForTimeout(900);

  check('six slots and six words in the pool',
        await page.locator('#slots .slot').count() === 6 &&
        await page.locator('#pool .word-btn').count() === 6);
  check('the coldest slot is the one open, and it says so',
        await page.locator('#slots .slot.open').getAttribute('data-rank') === '1' &&
        /coldest/i.test(await page.locator('#slots .slot.open').innerText()),
        await page.locator('#slots .slot.open').innerText());
  check('the poles are named so the direction is never guessed',
        /annoyed/i.test(await page.locator('#pole-low').innerText()) &&
        /furious/i.test(await page.locator('#pole-high').innerText()));
  /* The shared team bar, drawn by bench-kit and not by this page. */
  check('two teams from the shelf, first on turn',
        await page.locator('.team-chip').count() === 2 &&
        /Team 1/.test(await page.locator('.team-chip.active').innerText()));
  check('and the shared mistake budget is on screen',
        await page.locator('#dots .dot').count() === 4 &&
        await page.locator('#dots .dot.spent').count() === 0);
  /* A projected board a class has to scroll is a board nobody can play. Six slots,
     a pool, the team bar and the dots all have to sit inside 720px — the first
     build was 167px over and cut the mistake dots off the bottom, which the
     numbers found only because the screenshot was taken. */
  const fit = await page.evaluate(() => ({
    scroll: document.body.scrollHeight, inner: window.innerHeight,
    dotsBottom: Math.round(document.querySelector('#dots').getBoundingClientRect().bottom)
  }));
  check('the whole board fits a projector without scrolling',
        fit.scroll <= fit.inner && fit.dotsBottom <= fit.inner,
        JSON.stringify(fit));

  const chip = await page.locator('#room-chip').innerText();
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('a room opens on its own', !!code, chip);

  if(code){
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html?code=' + code + '&name=Ana&team=0&auto=1');
    await p.waitForTimeout(900);
    check('the phone is asked which word comes next, from the pool',
          await p.locator('#opts button').count() === 6 &&
          /which comes next/i.test(await p.locator('#qtext').innerText()),
          await p.locator('#qtext').innerText());

    await p.locator('#opts button', { hasText:/^annoyed$/ }).click();
    await page.waitForTimeout(700);
    /* Advisory, exactly as in Connections: the vote lands on the word and the
       leader is ringed, and the board does not move until the teacher clicks. */
    check('the vote lands on the word and rings the leader',
          await page.locator('#pool .word-btn[data-word="annoyed"] .votes').innerText() === '1' &&
          await page.locator('#pool .word-btn[data-word="annoyed"]').evaluate(
            b => b.classList.contains('hot')));
    check('but the board has not moved — the teacher still clicks',
          await page.locator('#slots .slot.filled').count() === 0 &&
          await page.locator('#pool .word-btn').count() === 6);

    // the teacher clicks it: the slot locks, the team scores, the same team goes again
    await page.locator('#pool .word-btn[data-word="annoyed"]').click();
    await page.waitForTimeout(600);
    check('a correct click locks the slot and teaches the word',
          await page.locator('#slots .slot.filled').count() === 1 &&
          /annoyed/i.test(await page.locator('#slots .slot.filled').innerText()) &&
          /mildly bothered/i.test(await page.locator('#slots .slot.filled').innerText()),
          await page.locator('#slots .slot.filled').innerText());
    check('the team scores through the shared bar and keeps the turn',
          /Team 1/.test(await page.locator('.team-chip.active').innerText()) &&
          /1/.test(await page.locator('.team-chip.active .score').innerText()));
    check('and the open slot moves down the scale',
          await page.locator('#slots .slot.open').getAttribute('data-rank') === '2');
    check('the phone is re-asked on the shorter pool',
          await p.locator('#opts button').count() === 5,
          String(await p.locator('#opts button').count()));

    /* A wrong click: the word stays available, a mistake goes, and the turn passes
       — and the vote passes with it, which is the rule Connections established and
       the shared bar now enforces for both games through onTurn. */
    await page.locator('#pool .word-btn[data-word="incensed"]').click();
    await page.waitForTimeout(700);
    check('a wrong click spends a mistake and leaves the word in the pool',
          await page.locator('#dots .dot.spent').count() === 1 &&
          await page.locator('#pool .word-btn[data-word="incensed"]').count() === 1 &&
          await page.locator('#slots .slot.filled').count() === 1);
    check('the turn passes', /Team 2/.test(await page.locator('.team-chip.active').innerText()),
          await page.locator('.team-chip.active').innerText());
    check('and the vote passes with it — Ana is told who is choosing now',
          /choosing/i.test(await p.locator('#state').innerText()),
          await p.locator('#state').innerText());

    check('phone had no errors', p.__errors.length === 0, p.__errors[0]);
    await p.close();
  }

  /* Reveal-one gives a word away without spending a mistake: nobody got it wrong,
     and a class that cannot separate livid from furious learns more from being
     shown than from four wrong guesses. */
  const spentBefore = await page.locator('#dots .dot.spent').count();
  await page.locator('#skip-btn').click(); await page.waitForTimeout(500);
  check('revealing one costs the point, not a mistake',
        await page.locator('#slots .slot.filled').count() === 2 &&
        await page.locator('#dots .dot.spent').count() === spentBefore,
        String(await page.locator('#dots .dot.spent').count()));

  // finish the scale off and check the lesson lands
  for(let i = 0; i < 6; i++){
    if(await page.locator('#skip-btn').isDisabled()) break;
    await page.locator('#skip-btn').click(); await page.waitForTimeout(220);
  }
  check('completing the scale unlocks the lesson',
        await page.locator('.lesson').count() === 1 &&
        /incensed/i.test(await page.locator('.lesson').innerText()),
        (await page.locator('.lesson').innerText() || '').slice(0, 80));
  /* Lower-cased before comparing: the words are laid out with `text-transform`,
     so innerText comes back shouting while the DOM text does not. */
  check('and every slot is filled in the authored order',
        (await page.locator('#slots .slot .word').allInnerTexts()).join('<').toLowerCase()
          === 'annoyed<irritated<angry<livid<furious<incensed',
        (await page.locator('#slots .slot .word').allInnerTexts()).join('<'));

  check('host page had no errors', page.__errors.length === 0, page.__errors[0]);
  await page.close();

  /* ---- race: one ladder per team ----
     A shared board makes a race you have to read a scoreboard to follow. Side by
     side, the climb *is* the picture. It is also the first round in the project
     where the *question* differs by team rather than only the rules: each side's
     pool has diverged, so each phone is offered its own remaining words through
     the relay's `optionsByTeam`. */
  const race = await browser.newPage({ viewport:{ width:1280, height:720 } });
  race.__errors = []; race.on('pageerror', e => race.__errors.push(String(e)));
  await race.goto(BASE + '/playground/thermometer.html?p=1'); await race.waitForTimeout(900);
  await race.locator('#play-mode').selectOption('race'); await race.waitForTimeout(700);

  check('a race draws one ladder per team, on the same scale',
        await race.locator('.ladder').count() === 2 &&
        await race.locator('.ladder .slot').count() === 12 &&
        !(await race.locator('#board-turns').isVisible()));
  /* Everything a race removes the recovery path for is removed with it — the same
     shape Connections paid for with its round clock, which disarms every handset
     and leaves a race with nothing on screen able to act. */
  check('and stands down the turn, the budget, the teacher\'s button and the clock',
        !(await race.locator('#status-row').isVisible()) &&
        !(await race.locator('#skip-btn').isVisible()) &&
        !(await race.locator('#vote-secs').isVisible()) &&
        await race.locator('.team-chip.active').count() === 0);
  /* Still a projected board: four ladders have to fit as well as two. */
  const rfit = await race.evaluate(() => ({
    scroll: document.body.scrollHeight, inner: window.innerHeight,
    clipped: [...document.querySelectorAll('.ladder .slot')]
      .filter(w => w.scrollWidth > w.clientWidth + 1).length
  }));
  check('the ladders fit a projector with nothing clipped',
        rfit.scroll <= rfit.inner && rfit.clipped === 0, JSON.stringify(rfit));

  const rcode = ((await race.locator('#room-chip').innerText()).match(/CODE\s+(\d{5})/i)||[])[1];
  check('the race opens its own room', !!rcode, rcode || 'none');

  if(rcode){
    const rjoin = async (name, team) => {
      const ph = await browser.newPage({ viewport:{ width:390, height:844 } });
      ph.__errors = []; ph.on('pageerror', e => ph.__errors.push(String(e)));
      await ph.goto(BASE + '/join.html?code=' + rcode + '&name=' + name + '&team=' + team + '&auto=1');
      await ph.waitForTimeout(900);
      return ph;
    };
    const one = await rjoin('Ana', 0), two = await rjoin('Ben', 1);
    check('every team is asked at once, not only the team on turn',
          await two.locator('#opts button').count() === 6 &&
          !/choosing/i.test(await two.locator('#state').innerText()),
          await two.locator('#state').innerText());
    check('and no clock reaches the handsets',
          (await one.locator('#round-clock').innerText()).trim() === '' &&
          (await two.locator('#round-clock').innerText()).trim() === '');

    /* A team's guess is drawn in the rung it is aimed at, on *their* ladder —
       which is what replaces a shared pool of tiles with dots on it. */
    await two.locator('#opts button', { hasText:/^incensed$/ }).click();
    await race.waitForTimeout(450);
    check('a team\'s guess appears in its own ladder, and nobody else\'s',
          /incensed/i.test(await race.locator('.ladder[data-team="1"] .slot.open .pending').innerText()) &&
          await race.locator('.ladder[data-team="0"] .slot.open .pending').count() === 0,
          await race.locator('.ladder[data-team="1"] .slot.open .pending').innerText());

    // Ana climbs three rungs; each correct answer moves only her ladder
    for(const w of ['annoyed','irritated','angry']){
      await one.locator('#opts button', { hasText: new RegExp('^' + w + '$') }).click();
      await race.waitForTimeout(1100);
    }
    check('a right answer climbs that team\'s ladder, with no teacher click',
          (await race.locator('.ladder h2 .climb').allInnerTexts()).join('|') === '3/6|0/6',
          (await race.locator('.ladder h2 .climb').allInnerTexts()).join('|'));
    check('and scores it, while the other team is untouched',
          (await race.locator('.team-chip .score').allInnerTexts()).join('/') === '3/0',
          (await race.locator('.team-chip .score').allInnerTexts()).join('/'));
    check('a wrong answer costs nothing but the time',
          await race.locator('#dots .dot.spent').count() === 0);

    /* The pools have diverged, so the two handsets are being offered different
       words — the first round whose *question* differs by team. Asserted on the
       counts, because that is the thing that used to be impossible. */
    check('each team is offered its own remaining words, not the room\'s',
          await one.locator('#opts button').count() === 3 &&
          await two.locator('#opts button').count() === 6,
          await one.locator('#opts button').count() + ' vs ' +
          await two.locator('#opts button').count());
    check('and a team is never offered a word it has already placed',
          await one.locator('#opts button', { hasText:/^annoyed$/ }).count() === 0 &&
          await two.locator('#opts button', { hasText:/^annoyed$/ }).count() === 1);

    check('race phones had no errors', one.__errors.length === 0 && two.__errors.length === 0,
          one.__errors[0] || two.__errors[0]);
    await one.close(); await two.close();
  }
  check('the race board had no errors', race.__errors.length === 0, race.__errors[0]);
  await race.close();

  /* Degradation is non-negotiable for every playground page: no relay must leave
     the board fully playable teacher-only. */
  const solo = await browser.newPage({ viewport:{ width:1280, height:720 } });
  solo.__errors = []; solo.on('pageerror', e => solo.__errors.push(String(e)));
  await solo.goto(BASE + '/playground/thermometer.html?p=1&relay=http://127.0.0.1:9');
  await solo.waitForTimeout(700);
  /* Not showing a room, which is what "no relay" actually has to mean. The chip
     says `connecting…` first and settles on `phones off` only after the retries run
     out — a relay that is merely asleep is the common failure, so giving up in the
     first second was the wrong behaviour to pin. What the page owes with no relay is
     that it stays playable and never claims a room nobody can join. */
  check('no relay: the chip never shows a room code',
        !/\d{5}/.test(await solo.locator('#room-chip').innerText()),
        await solo.locator('#room-chip').innerText());
  await solo.locator('#pool .word-btn[data-word="annoyed"]').click(); await solo.waitForTimeout(400);
  check('and the game still plays', await solo.locator('#slots .slot.filled').count() === 1);
  check('no errors without a relay', solo.__errors.length === 0, solo.__errors[0]);
  await solo.close();
}

/* ---- the playground: Story Reveal ----
   The bench's third game, and the first to use *typed* answers rather than a
   vote — so it is also the first to exercise `Kit.answer.judge` out here: right,
   close and wrong, with a spelling tolerance that scales with the word. Two
   verdicts would have made "produced the word but mis-spelled it" and "did not
   know it" the same fact about a student, which they are not. */
async function testStoryReveal(browser){
  section('Playground: Story Reveal');
  const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
  page.__errors = []; page.on('pageerror', e => page.__errors.push(String(e)));
  await page.goto(BASE + '/playground/story-reveal.html?p=1'); await page.waitForTimeout(900);

  check('three clues, one revealed, the rest held back but visible',
        await page.locator('.clue').count() === 3 &&
        await page.locator('.clue:not(.hidden)').count() === 1 &&
        /still to come/i.test(await page.locator('.clue.hidden').first().innerText()),
        await page.locator('.clue.hidden').first().innerText());
  check('the round opens at full value',
        /worth 5 points/i.test(await page.locator('#worth').innerText()),
        await page.locator('#worth').innerText());
  check('teams and the turn come from the shelf',
        await page.locator('.team-chip').count() === 2 &&
        /Team 1/.test(await page.locator('.team-chip.active').innerText()));
  const sfit = await page.evaluate(() => ({
    scroll: document.body.scrollHeight, inner: window.innerHeight }));
  check('the board fits a projector without scrolling',
        sfit.scroll <= sfit.inner, JSON.stringify(sfit));

  const chip = await page.locator('#room-chip').innerText();
  const code = (chip.match(/CODE\s+(\d{5})/i)||[])[1];
  check('a room opens on its own', !!code, chip);

  if(code){
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/join.html?code=' + code + '&name=Ana&team=0&auto=1');
    await p.waitForTimeout(900);
    /* A typed round, not a vote: there is nothing to choose between, the student
       has to produce the word. */
    check('the phone gets a box to type in, not a list to pick from',
          await p.locator('#opts button').count() === 0 &&
          await p.locator('#reply').isVisible());
    check('and the clue itself is the prompt on the handset',
          /lost their job/i.test(await p.locator('#qtext').innerText()),
          await p.locator('#qtext').innerText());

    /* Wrong: shown on the board with what they actually typed, because a miss is
       the most useful thing on that strip — and in turns it passes the turn. */
    await p.fill('#reply', 'dismissed'); await p.locator('#send').click();
    await page.waitForTimeout(700);
    check('a wrong answer is shown with the word they typed',
          await page.locator('.reply.wrong').count() === 1 &&
          /dismissed/.test(await page.locator('.reply').first().innerText()),
          await page.locator('.reply').first().innerText());
    check('and in turns it passes the turn',
          /Team 2/.test(await page.locator('.team-chip.active').innerText()),
          await page.locator('.team-chip.active').innerText());

    /* The whole reason this game was worth building third: a misspelling is its
       own verdict. `redundent` is one letter out of nine, so it is `close` —
       reported as nearly, and it does NOT take the word. */
    await page.locator('.team-chip').first().click(); await page.waitForTimeout(500);
    await p.fill('#reply', 'redundent'); await p.locator('#send').click();
    await page.waitForTimeout(700);
    check('a misspelling is its own verdict, not just a miss',
          await page.locator('.reply.close').count() === 1 &&
          /nearly/i.test(await page.locator('.reply.close').innerText()),
          await page.locator('.reply.close').innerText());
    check('and being close does not take the word or score it',
          (await page.locator('.team-chip .score').allInnerTexts()).join('/') === '0/0' &&
          await page.locator('.lesson').count() === 0);

    /* Another clue makes it easier and worth a point less — the decision the whole
       game turns on. */
    await page.locator('#clue-btn').click(); await page.waitForTimeout(600);
    check('a further clue costs a point and reaches the handsets',
          /worth 4 points/i.test(await page.locator('#worth').innerText()) &&
          await page.locator('.clue:not(.hidden)').count() === 2 &&
          /three hundred staff/i.test(await p.locator('#qtext').innerText()),
          await page.locator('#worth').innerText() + ' | ' + await p.locator('#qtext').innerText());

    await p.fill('#reply', 'Redundant'); await p.locator('#send').click();
    await page.waitForTimeout(700);
    check('the right answer takes it, at what the round is now worth',
          (await page.locator('.team-chip .score').allInnerTexts()).join('/') === '4/0' &&
          /Ana got it/i.test(await page.locator('.message').innerText()),
          await page.locator('.message').innerText());
    check('and the lesson lands with it',
          await page.locator('.lesson').count() === 1 &&
          /made redundant/i.test(await page.locator('.lesson').innerText()));
    check('phone had no errors', p.__errors.length === 0, p.__errors[0]);
    await p.close();
  }
  check('host page had no errors', page.__errors.length === 0, page.__errors[0]);
  await page.close();

  /* A race takes the turn and the clock away, for the reason the other two bench
     games each paid for separately. */
  const race = await browser.newPage({ viewport:{ width:1280, height:720 } });
  race.__errors = []; race.on('pageerror', e => race.__errors.push(String(e)));
  await race.goto(BASE + '/playground/story-reveal.html?p=1'); await race.waitForTimeout(900);
  await race.locator('#play-mode').selectOption('race'); await race.waitForTimeout(600);
  check('a race stands down the turn and the clock',
        await race.locator('.team-chip.active').count() === 0 &&
        !(await race.locator('#vote-secs').isVisible()));
  check('but the teacher keeps the clue controls in either mode',
        await race.locator('#clue-btn').isVisible() &&
        await race.locator('#reveal-btn').isVisible());
  check('the race board had no errors', race.__errors.length === 0, race.__errors[0]);
  await race.close();

  // degradation: a dead relay leaves the board fully playable, teacher-only
  const solo = await browser.newPage({ viewport:{ width:1280, height:720 } });
  solo.__errors = []; solo.on('pageerror', e => solo.__errors.push(String(e)));
  await solo.goto(BASE + '/playground/story-reveal.html?p=1&relay=http://127.0.0.1:9');
  await solo.waitForTimeout(700);
  /* Not showing a room, which is what "no relay" actually has to mean. The chip
     says `connecting…` first and settles on `phones off` only after the retries run
     out — a relay that is merely asleep is the common failure, so giving up in the
     first second was the wrong behaviour to pin. What the page owes with no relay is
     that it stays playable and never claims a room nobody can join. */
  check('no relay: the chip never shows a room code',
        !/\d{5}/.test(await solo.locator('#room-chip').innerText()),
        await solo.locator('#room-chip').innerText());
  await solo.locator('#clue-btn').click(); await solo.waitForTimeout(300);
  await solo.locator('#reveal-btn').click(); await solo.waitForTimeout(300);
  check('and the game still plays',
        await solo.locator('.clue:not(.hidden)').count() === 2 &&
        await solo.locator('.lesson').count() === 1);
  check('no errors without a relay', solo.__errors.length === 0, solo.__errors[0]);
  await solo.close();
}

/* ---- a grouping clue, on the Lab board ----
   Connections carried into a tile, and the first dynamic off the question bench
   that is a *round* rather than a form: eight words, four that belong together,
   assembled from the phones and judged before the tile scores.

   The Lab board had no coverage at all until this suite — the Reveal categories
   shipped last session untested — so this drives the shell as well as the round.

   Two of these checks were proved against the reverted fix and say so where they
   are; the rest are the loop itself. */
async function testGroupingClue(browser){
  section('Jeopardy: a grouping clue');

  /* The Lab unit lives behind its own shell, deliberately — `game-hub.html` does
     not load it, so nothing here can reach a class. Categories are ticked by name
     rather than by position: `startGame` ticks the first N, which would never
     reach the ninth. */
  const openLab = async (cats, opts) => {
    const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
    page.__errors = []; page.__console = [];
    page.on('pageerror', e => page.__errors.push(String(e)));
    page.on('console', m => {
      if (m.type() === 'error' && !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)/.test(m.text()))
        page.__console.push(m.text());
    });
    await page.goto(BASE + '/game-hub-lab.html' + ((opts||{}).query || ''));
    await page.waitForTimeout(400);
    await page.evaluate(p => {
      window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
      window.HubSettings.set('buzzers', !!p.phones);
      /* Off for the same reason the two above are: the standings cover the board
         between questions, and a check that plays a question and then clicks a tile
         finds the click intercepted by a modal it never asked for. The `standings`
         suite is where that screen is actually covered. */
      window.HubSettings.set('roundWinBanner', false);
    }, { phones: !!(opts||{}).phones });
    await page.getByText('Lab', { exact:false }).first().click();
    await page.waitForTimeout(220);
    await page.locator('h3:visible', { hasText:'Jeopardy' }).first().click();
    await page.waitForTimeout(220);
    for (const name of cats)
      await page.locator('#content-list label', { hasText:name }).first().locator('input').check();
    await page.waitForTimeout(150);
    await page.locator('#start-btn').click();
    await page.waitForTimeout(600);
    if (await page.locator('#intro-overlay.on').count()){
      await page.keyboard.press('Space'); await page.waitForTimeout(300);
    }
    return page;
  };
  /* The board is a CSS grid, so a tile's column is its position within the row —
     there is no data-col to ask for. Row 0 is $100. */
  const openTile = async (page, cat, row) => {
    const at = await page.evaluate(name => {
      const heads = [...document.querySelectorAll('#board .cat-header')];
      return { col: heads.findIndex(h => new RegExp(name,'i').test(h.textContent)), n: heads.length };
    }, cat);
    await page.locator('#board .tile').nth(at.n * row + at.col).click();
    await page.waitForTimeout(500);
  };
  const codeOf = async page =>
    ((await page.locator('#buzzer-chip').innerText().catch(()=>'')).match(/CODE\s+(\d{5})/i)||[])[1];
  const join = async (code, name, team) => {
    const p = await browser.newPage({ viewport:{ width:390, height:844 } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(`${BASE}/join.html?code=${code}&name=${name}&team=${team}&auto=1`);
    await p.waitForTimeout(600);
    return p;
  };
  const tap = async (p, words) => {
    for (const w of words){
      await p.locator('#opts button', { hasText:new RegExp('^'+w+'$') }).first().click();
      await p.waitForTimeout(120);
    }
  };
  const words   = page => page.locator('#clue-group .gword').allInnerTexts();
  const scoresOf= page => page.locator('.team .score').allInnerTexts();
  /* **A won round no longer takes itself off screen.** The card holds the answer and
     the winning team until the teacher closes it — reported from a real board, where
     the tile flipped away within a second of the four lighting up and the room was
     left with no answer and no idea who took it. So the payout rides on the Close
     press, which is why every "did it score" check below has to make it. The button
     names the team it is about to pay, which is the assertion worth making here
     rather than in each of them. */
  /* **And a right answer no longer ends the question either** (`roundOpenToAll`), so
     there are two presses now rather than one: Reveal is what ends an open round —
     it hands over to the ordinary take beat — and Close is what pays. Written as one
     helper because every "did it score" check below needs both, and a check that
     forgot the first would report "nothing scored" for a board working perfectly. */
  const closeWonRound = async page => {
    const rv = page.locator('#reveal-btn');
    if (await rv.isVisible().catch(()=>false)){ await rv.click(); await page.waitForTimeout(900); }
    const btn = page.locator('#close-btn');
    check('a won round waits for the teacher, naming who it pays',
          /^Close — .+ takes it$/.test((await btn.innerText()).trim()),
          (await btn.innerText()).trim());
    await btn.click();
    await page.waitForTimeout(1800);
  };

  /* ---------- the content is on the board at all ---------- */
  let page = await openLab(['Connections','Anagram','Gap Fill'], { phones:true });
  check('the Lab board offers the grouping category',
        (await page.locator('#board .cat-header').allInnerTexts()).some(t => /Connections/i.test(t)));

  await openTile(page, 'Connections', 1);          // $200 — the courtroom set
  const eight = await words(page);
  check('opening the tile draws the whole set of words',
        eight.length === 8 && eight.includes('verdict') && eight.includes('sabbatical'),
        eight.join('|'));
  check('and the answer is not on the card yet',
        !(await page.locator('#clue-answer').isVisible()));
  /* The answer is *derived* from `group.pick` — these clues carry no `a`, because
     two copies of one fact are two things that can drift. */
  check('the answer line is derived from the set',
        /verdict/.test(await page.locator('#clue-answer').innerText()) &&
        /acquittal/.test(await page.locator('#clue-answer').innerText()),
        await page.locator('#clue-answer').innerText());

  const code = await codeOf(page);
  check('a room is open for it', !!code);

  if (code){
    /* ---------- the phones ---------- */
    const ana = await join(code, 'Ana', 0);
    const bo  = await join(code, 'Bo',  0);
    await page.waitForTimeout(800);
    const opts = await ana.locator('#opts button').allInnerTexts();
    check('every phone gets the whole set to choose from, not a buzzer',
          opts.length === 8 && !(await ana.locator('#buzzer').isVisible()),
          opts.join('|'));
    /* The share, and it is the mechanic rather than a detail: four words assembled
       by two phones is two each, so the team has to agree. */
    check('two phones on a team hold two words each',
          /Choose 2\b/i.test(await ana.locator('#opts ~ *, .hint, body').first().innerText()
                              .catch(()=>'')) ||
          /2/.test(await ana.evaluate(() => document.body.innerText.match(/Choose \d/)?.[0] || '')),
          await ana.evaluate(() => document.body.innerText.match(/Choose \d[^\n]*/)?.[0] || '(none)'));
    check('and the board says the same share out loud',
          /2 phones, 2 each/.test(await page.locator('.rlanes').innerText()),
          await page.locator('.rlanes').innerText());

    /* ---------- a wrong four costs nothing but the time ---------- */
    await tap(ana, ['verdict','jury']);
    await tap(bo,  ['sabbatical','overtime']);
    await page.waitForTimeout(1400);
    check('a wrong four is named and refused',
          /not a group/i.test(await page.locator('.group-say').innerText()),
          await page.locator('.group-say').innerText());
    check('and it costs nothing — the tile is still on the table',
          (await scoresOf(page)).join('/') === '0/0' &&
          await page.locator('#clue-group').count() === 1,
          (await scoresOf(page)).join('/'));

    /* ---------- a stray buzz must not replace the round ----------
       The relay locks the room on the first buzz whoever sent it, and the engine's
       refusal path re-armed a *buzzer* — the code meant to recover from a stray
       buzz would have replaced the grouping round with the very thing the game had
       said it did not want. Proved against the reverted fix: this check and the one
       below it both fail on the old build. */
    await ana.evaluate(() => window.HubPlayer && window.HubPlayer.buzz());
    await page.waitForTimeout(900);
    const after = await ana.locator('#opts button').allInnerTexts();
    check('a stray buzz leaves the room in the grouping round, not on a buzzer',
          after.length === 8 && !(await ana.locator('#buzzer').isVisible()),
          after.join('|') || '(no options — it armed a buzzer)');
    check('and the words on the handset are still the clue’s',
          after.includes('verdict') && after.includes('overtime'), after.join('|'));

    /* ---------- the right four takes the tile ---------- */
    await tap(ana, ['verdict','jury']);          // the buzz cleared the picks
    await tap(bo,  ['testimony','acquittal']);
    await page.waitForTimeout(1100);
    /* **The four stay dark while the question is still open, and that is the whole
       point of holding it open on this round.** Grouping lights them at `done`, which
       is its own reveal — the four *are* the answer, so lighting them the moment one
       team has it would hand it to everybody still hunting. With the question held
       open they keep hunting and can find the same four independently, which is the
       dynamic; the light comes when the teacher ends it. */
    check('the four stay dark while other teams are still hunting',
          await page.locator('#clue-group .gword.right').count() === 0,
          String(await page.locator('#clue-group .gword.right').count()));
    await page.waitForTimeout(1800);
    /* Reveal ends the open round; the four light there, before Close takes the card
       away — which is the order the room sees it in. */
    await page.locator('#reveal-btn').click();
    await page.waitForTimeout(900);
    check('the four that belong are lit once the question is over',
          await page.locator('#clue-group .gword.right').count() === 4,
          String(await page.locator('#clue-group .gword.right').count()));
    await closeWonRound(page);
    check('the tile scores to the team that found it',
          (await scoresOf(page)).join('/') === '200/0', (await scoresOf(page)).join('/'));
    check('and the strip names them with what it paid',
          /\+200/.test(await page.locator('#phone-bar').innerText()),
          await page.locator('#phone-bar').innerText().then(t=>t.replace(/\n/g,' ')));
    /* Leaving eight words up and tappable is what "not asking them at all" did to
       the Daily Double: indistinguishable from broken, and a phone still holding a
       live control for a question that has gone. Asserted on what is *offered*, not
       on the DOM — `standDown` hides the list rather than emptying it, which is the
       handset's business and not a fact this round should be pinning. */
    check('the round ends on the handsets when the tile is taken',
          !(await ana.locator('#opts').isVisible()) &&
          /waiting for the teacher/i.test(await ana.locator('#state').innerText().catch(()=>'')),
          await ana.evaluate(() => document.body.innerText.replace(/\n+/g,' / ').slice(0,120)));
    check('phones had no errors', ana.__errors.length === 0 && bo.__errors.length === 0,
          ana.__errors[0] || bo.__errors[0]);
    await ana.close(); await bo.close();
  }
  checkClean(page, 'lab board');
  await page.close();

  /* ---------- no phones at all ----------
     Degradation is not optional anywhere in this app, and a clue the teacher cannot
     play without a relay would be the first place it broke. */
  page = await openLab(['Connections','Anagram','Gap Fill'], { phones:false });
  await openTile(page, 'Connections', 0);          // $100 — the anger set
  check('with no room, the words are still on the card',
        (await words(page)).length === 8);
  const btn = page.locator('#group-btn');
  check('and the teacher gets a button to judge their own set',
        await btn.isVisible() && await btn.isDisabled(),
        await btn.innerText().catch(()=>'(missing)'));
  const pickOnBoard = async list => {
    for (const w of list){
      await page.locator(`#clue-group .gword[data-word="${w}"]`).click();
      await page.waitForTimeout(80);
    }
  };
  await pickOnBoard(['livid','furious','grateful','serene']);
  check('four clicked words enable it', !(await btn.isDisabled()),
        await btn.innerText());
  await btn.click(); await page.waitForTimeout(500);
  check('a wrong set is refused and costs nothing',
        /not a group/i.test(await page.locator('.group-say').innerText()) &&
        (await scoresOf(page)).join('/') === '0/0');
  /* A wrong check releases the selection — otherwise the next click deselects
     instead of choosing — so this starts from empty rather than swapping two out. */
  await page.waitForTimeout(500);
  check('a wrong check releases the words, ready for another go',
        await page.locator('#clue-group .gword.chosen').count() === 0,
        String(await page.locator('#clue-group .gword.chosen').count()));
  await pickOnBoard(['livid','furious','incensed','irate']);
  await btn.click(); await page.waitForTimeout(1600);
  await closeWonRound(page);
  check('and the right set takes the tile for the team on turn',
        (await scoresOf(page)).join('/') === '100/0', (await scoresOf(page)).join('/'));
  checkClean(page, 'no-phones board');
  await page.close();

  /* ---------- an ordinary clue is untouched ----------
     Every other category on this board runs through the same card, so the cheapest
     way to know the round has not leaked into them is to play one. */
  page = await openLab(['Anagram','Gap Fill','Word Bridge'], { phones:false });
  await openTile(page, 'Gap Fill', 0);
  check('a clue with no group draws no word set',
        await page.locator('#clue-group').count() === 0 &&
        !(await page.locator('#group-btn').isVisible()));
  check('and reveals normally',
        await page.locator('#reveal-btn').isVisible());
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(300);
  check('with the usual Correct / Wrong pair',
        await page.locator('#correct-btn').isVisible() &&
        await page.locator('#wrong-btn').isVisible());
  checkClean(page, 'ordinary clue');
  await page.close();

  /* ---------- who plays it is a switch ----------
     The whole room racing is the Connections dynamic and the default; the team on
     turn alone is the ordinary Jeopardy contract. Scoping reaches three places at
     once — the relay stores the team, an unentitled phone shows the question with
     no controls, and a reply that arrives anyway is dropped — so the check is that
     the other team's handset can see the clue and not answer it. */
  page = await openLab(['Connections','Anagram','Gap Fill'], { phones:true });
  // `roundWho`, not `jGroupWho` — a round is hosted by two boards now, so its
  // switches are in the shared Questions group and carry no game in their ids
  await page.evaluate(() => window.HubSettings.set('roundWho', 'turn', 'jeopardy'));
  await openTile(page, 'Connections', 1);
  const turnCode = await codeOf(page);
  if (turnCode){
    const on  = await join(turnCode, 'Cal', 0);      // the team on turn
    const off = await join(turnCode, 'Di',  1);      // the other team
    await page.waitForTimeout(800);
    check('scoped to the turn: that team gets the words',
          await on.locator('#opts button').count() === 8,
          String(await on.locator('#opts button').count()));
    check('and the other team sees the question with nothing to tap',
          await off.locator('#opts button').count() === 0 &&
          /court|belong/i.test(await off.locator('#qtext').innerText().catch(()=>'')),
          await off.locator('#qtext').innerText().catch(()=>'(none)'));
    check('phones had no errors', on.__errors.length === 0 && off.__errors.length === 0,
          on.__errors[0] || off.__errors[0]);
    await on.close(); await off.close();
  }
  checkClean(page, 'scoped round');
  await page.close();

  /* ---------- a miss has no rebound and no bill ----------
     Both follow from one fact: nobody held the floor. The steal exists so a team
     shut out of a question gets it when the team holding it misses, and `jDeduct`
     charges the team that missed — but every team was assembling this clue at once,
     so `missed` is only "whoever happened to be on turn". Checked with both
     switches deliberately on, which is what the `classic` ruleset writes. */
  page = await openLab(['Connections','Anagram','Gap Fill'], { phones:false });
  await page.evaluate(() => {
    window.HubSettings.set('stealOnWrong', true, 'jeopardy');
    window.HubSettings.set('jDeduct', true, 'jeopardy');
  });
  await openTile(page, 'Connections', 1);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(300);
  /* Reveal answers it on the board — the four light up where they stand, which is
     the thing worth seeing. It also ends the round, and that is the trap: Correct
     and Wrong only exist *after* Reveal, so anything below that asked "is the round
     still live?" would find it closed and let the steal and the deduction back in.
     They ask "was this a grouping clue?" instead. */
  check('Reveal lights the four on the card',
        await page.locator('#clue-group .gword.right').count() === 4 &&
        !(await page.locator('#group-btn').isVisible()),
        String(await page.locator('#clue-group .gword.right').count()));
  await page.locator('#wrong-btn').click();  await page.waitForTimeout(900);
  check('a missed grouping clue offers no steal',
        !(await page.locator('#clue-claim button').count()) &&
        !(await page.locator('#clue-modal').isVisible()),
        String(await page.locator('#clue-claim button').count()));
  check('and nobody is charged for it',
        (await scoresOf(page)).join('/') === '0/0', (await scoresOf(page)).join('/'));
  /* The same two switches on an ordinary clue on the same board, or this would
     pass by having quietly broken the steal for everything. */
  await openTile(page, 'Gap Fill', 1);
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(250);
  await page.locator('#wrong-btn').click();  await page.waitForTimeout(400);
  check('an ordinary clue on the same board still offers one',
        await page.locator('#clue-claim button').count() > 0,
        String(await page.locator('#clue-claim button').count()));
  checkClean(page, 'miss');
  await page.close();

  /* ---------- a Daily Double on a grouping tile ----------
     Two dynamics that contradict each other on the face of it: a Daily Double
     belongs to the team that found it, a grouping clue is the whole room at once.
     The phones are what a Daily Double excludes, not the words — without the round
     the tile opened on an instruction with nothing to pick from, and the wager was
     unanswerable. `jCorrect` already pays a Daily Double to whoever found it, so
     the teacher-click path needed nothing else. */
  page = await openLab(['Connections','Anagram','Gap Fill'], { phones:false });
  await page.evaluate(() => window.HubSettings.set('jDailyDoubles', 1, 'jeopardy'));
  await page.waitForTimeout(200);
  // plant one deliberately on a grouping tile rather than waiting for chance
  const planted = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('#board .cat-header')];
    const col = heads.findIndex(h => /Connections/i.test(h.textContent));
    const tiles = [...document.querySelectorAll('#board .tile')];
    tiles.forEach(t => delete t.dataset.dd);
    const t = tiles[heads.length * 2 + col];      // $300
    t.dataset.dd = '1';
    return !!t.dataset.dd;
  });
  check('a Daily Double can be planted on a grouping tile', planted);
  await page.locator('#board .tile').nth(
    (await page.evaluate(() => document.querySelectorAll('#board .cat-header').length)) * 2 +
    (await page.evaluate(() => [...document.querySelectorAll('#board .cat-header')]
        .findIndex(h => /Connections/i.test(h.textContent))))).click();
  await page.waitForTimeout(500);
  check('it opens on the wager, not on the words',
        await page.locator('#wager-panel').isVisible() &&
        await page.locator('#clue-group').count() === 0);
  await page.locator('#wager-ok').click(); await page.waitForTimeout(500);
  check('and once the bet is in, the words are there to play',
        (await words(page)).length === 8 &&
        await page.locator('#group-btn').isVisible(),
        String((await words(page)).length));
  for (const w of ['dismissed','sacked','redundant','discharged']){
    await page.locator(`#clue-group .gword[data-word="${w}"]`).click();
    await page.waitForTimeout(70);
  }
  await page.locator('#group-btn').click(); await page.waitForTimeout(1600);
  await closeWonRound(page);
  check('the wager pays the team that found it',
        Number((await scoresOf(page))[0]) > 0, (await scoresOf(page)).join('/'));
  checkClean(page, 'daily double');
  await page.close();

  /* ---------- the second round, on the real board ----------
     The whole return on the extraction: a round written as one file, playable in a
     game show with no engine change. And the thing grouping never had to model —
     **a right answer is progress, not an ending** — which if defaulted wrongly pays
     the tile four rungs early. */
  page = await openLab(['Word Thermometer','Anagram','Gap Fill'], { phones:false });
  /* This block drives the *climb* lesson — one shared ladder, a rung at a time.
     Jeopardy's own default is a ladder each now (`modeDefaults` in ROUND_HOSTS),
     so the mode under test is stated rather than inherited. */
  await page.evaluate(() => window.HubSettings.set('round_ordering', 'climb', 'jeopardy'));
  await openTile(page, 'Word Thermometer', 0);
  check('an ordering clue draws its ladder on a Jeopardy card',
        await page.locator('#clue-group .ord-rung').count() === 5 &&
        await page.locator('#clue-group .ord-cap').count() === 2,
        String(await page.locator('#clue-group .ord-rung').count()));
  check('and asks for one rung at a time, not the whole scale',
        /Check it/i.test(await page.locator('#group-btn').innerText()),
        await page.locator('#group-btn').innerText());
  const climb = async w => {
    await page.locator(`#clue-group .gword[data-word="${w}"]`).click();
    await page.waitForTimeout(90);
    await page.locator('#group-btn').click();
    await page.waitForTimeout(600);      // long enough for a wrong pick to be released
  };
  await climb('annoyed');
  check('a right rung locks in and the tile is NOT yet paid',
        await page.locator('#clue-group .ord-rung.filled').count() === 1 &&
        (await scoresOf(page)).join('/') === '0/0',
        (await scoresOf(page)).join('/'));
  await climb('furious');
  check('a wrong rung costs nothing and the ladder holds',
        await page.locator('#clue-group .ord-rung.filled').count() === 1 &&
        /not that one/i.test(await page.locator('#clue-group .group-say').innerText()),
        await page.locator('#clue-group .group-say').innerText());
  for(const w of ['irritated','angry','livid','furious']) await climb(w);
  await page.waitForTimeout(1500);
  await closeWonRound(page);
  check('and only the last rung pays the tile',
        (await scoresOf(page)).join('/') === '100/0', (await scoresOf(page)).join('/'));
  checkClean(page, 'ordering clue');
  await page.close();

  /* ---------- a round with more than one button ----------
     The action strip was a hand-listed skeleton and `group-btn` is one element, so
     a round could have exactly one button — the single thing that blocked round
     designs outright. A round declares `actions`/`press` now, and the ordering
     climb is what proves it rather than describes it: **a class that cannot
     separate *livid* from *furious* learns more from being shown than from four
     wrong guesses**, which the bench thermometer has always offered and the round
     never could.

     Driven on the board rather than on the bench because what could break is the
     wiring at the host — where the buttons are mounted, whether a press re-asks the
     handsets, and whether the strip still clears. */
  page = await openLab(['Word Thermometer','Anagram','Gap Fill'], { phones:false });
  await page.evaluate(() => window.HubSettings.set('round_ordering', 'climb', 'jeopardy'));
  await openTile(page, 'Word Thermometer', 0);
  const strip = () => page.evaluate(() => ({
    own: [...document.querySelectorAll('#round-actions button')]
           .map(b => ({ id:b.dataset.action, label:b.textContent, off:b.disabled })),
    /* Mounted beside the commit button rather than written into the skeleton, which
       is what lets a fourth host have it without markup of its own. */
    after: document.getElementById('round-actions')?.previousElementSibling?.id || null,
    commit: document.getElementById('group-btn').textContent
  }));
  let s = await strip();
  /* The button is `hint` now, not the round's own `show`. Same beat and the same
     wiring — what changed is that giving away one part of the answer turned out to
     be every round's problem, so the strip builds the button from the round's
     `hint`/`hintsLeft` rather than each round declaring one and five of them
     writing the same thing five ways. */
  check('a round can put its own button in the strip, beside the host’s commit',
        s.own.length === 1 && s.own[0].id === 'hint' && s.after === 'group-btn' &&
        /Check it/i.test(s.commit), JSON.stringify(s));
  await page.locator('#round-actions button[data-action="hint"]').click();
  await page.waitForTimeout(500);
  check('pressing it fills the rung and prints the gloss, and scores nobody',
        await page.locator('#clue-group .ord-rung.filled').count() === 1 &&
        /shown:\s*annoyed/i.test(await page.locator('#clue-group .group-say').innerText()) &&
        (await scoresOf(page)).join('/') === '0/0',
        (await scoresOf(page)).join('/') + ' · ' +
        await page.locator('#clue-group .group-say').innerText());
  /* It must never be able to end the round: with one rung left there is one word
     left, so it teaches nothing — and a round ending with nobody having answered is
     a question about scoring, which is not the round's to answer. */
  for(let i = 0; i < 3; i++){
    await page.locator('#round-actions button[data-action="hint"]').click();
    await page.waitForTimeout(350);
  }
  s = await strip();
  check('and it stands down on the last rung rather than ending the round',
        s.own[0].off === true &&
        await page.locator('#clue-group .ord-rung.filled').count() === 4 &&
        (await scoresOf(page)).join('/') === '0/0',
        JSON.stringify(s.own) + ' · ' + (await scoresOf(page)).join('/'));
  /* The strip used to be cleared from a hand-typed list of ids. Nothing would have
     complained if the round's own buttons were left off it — they would simply have
     outlived the question, which is how `wager-ok` was missed for as long as it has
     existed. */
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(700);
  check('revealing clears the round’s buttons with the rest of the strip',
        (await strip()).own.length === 0, JSON.stringify((await strip()).own));
  checkClean(page, 'a round’s own button');
  await page.close();

  /* **A race gets a hint too now, and it is about the scale rather than any team's
     ladder** — reported as the thermometer having no hint at all, because Jeopardy
     defaults this round to a race. Placing a word would hand it to one team or to
     all of them, so it does not place one: it names which word sits at a position on
     the scale, which is one fact about the question that four lanes can be told at
     once, and each team still has to drag it onto their own ladder. */
  page = await openLab(['Word Thermometer','Anagram','Gap Fill'], { phones:false });
  await page.evaluate(() => window.HubSettings.set('round_ordering', 'race', 'jeopardy'));
  await openTile(page, 'Word Thermometer', 0);
  check('a race offers the hint, and nothing else',
        await page.locator('#round-actions button').count() === 1 &&
        await page.locator('#round-actions button[data-action="hint"]').count() === 1,
        String(await page.locator('#round-actions button').count()));
  await page.locator('#round-actions button[data-action="hint"]').click();
  await page.waitForTimeout(400);
  /* Marked in the pool with its position, never placed on anybody's ladder — that
     is the whole difference between this hint and the climb's. */
  check('and it names a position on the scale without filling a rung',
        await page.locator('#clue-group .ord-pool .gword.hinted').count() === 1 &&
        await page.locator('#clue-group .ord-rung.filled').count() === 0,
        (await page.locator('#clue-group .group-say').innerText().catch(()=>'')).trim());
  await page.close();

  /* Every round on this board offers a hint now, so the old "a round that declares
     nothing has no buttons" case has no example left on the Lab board — the point
     it was making is asked of the registry instead, where it is the real rule: the
     strip builds the button from `hint`, so a round without one offers nothing. */
  page = await openLab(['Connections','Anagram','Gap Fill'], { phones:false });
  await openTile(page, 'Connections', 0);
  check('the host’s commit button is untouched by the round having its own',
        /Check these 4 \(0\/4\)/.test(await page.locator('#group-btn').innerText()),
        await page.locator('#group-btn').innerText());
  check('a round that declares no hint is offered no button at all',
        await page.evaluate(() => {
          const K = window.HubKit;
          const def = Object.assign({}, K.round.get('grouping'), { hint:null });
          const st  = K.round.get('grouping').setup(K.round.get('grouping').sample);
          return K.round.actions(def, st, {}).filter(a => !a.primary).length === 0;
        }));
  await page.close();

  /* ---------- a multiple choice clue ----------
     The third round, and the one that proves the contract holds for something
     ordinary rather than something that shaped it. **The engine gained nothing to
     host this** — the normaliser asks `Kit.round.fields()`, the tile asks
     `Kit.round.of()`, and ⚙ builds its mode row from `modes` — so the assertion
     worth making is that a plain question plays exactly like any other tile. */
  page = await openLab(['Multiple Choice','Anagram','Gap Fill'], { phones:false });
  await openTile(page, 'Multiple Choice', 0);
  check('a multiple choice clue draws its options on a Jeopardy card, lettered',
        await page.locator('#clue-group .mc-opt').count() === 4 &&
        (await page.locator('#clue-group .mc-letter').allInnerTexts()).join('') === 'ABCD',
        (await page.locator('#clue-group .mc-letter').allInnerTexts()).join(''));
  /* Degradation is the rule, not a fallback: a teacher with a dead relay has to be
     able to play the clue, and this is the whole of it. */
  const pick = async w => {
    await page.locator(`#clue-group .gword[data-word="${w}"]`).click();
    await page.waitForTimeout(90);
    await page.locator('#group-btn').click();
    await page.waitForTimeout(600);
  };
  await pick('give');
  check('a wrong option costs nothing and the clue stays live',
        (await scoresOf(page)).join('/') === '0/0' &&
        /not that one/i.test(await page.locator('#clue-group .group-say').innerText()),
        await page.locator('#clue-group .group-say').innerText());
  await pick('pass');
  await page.waitForTimeout(1500);
  await closeWonRound(page);
  /* Unlike an ordering climb, being right *is* the ending here — so the tile pays
     on the first correct answer. That is the host's `done !== false` default doing
     its job for a round that never had to think about progress. */
  check('and the right one takes the tile outright, first time',
        (await scoresOf(page)).join('/') === '100/0', (await scoresOf(page)).join('/'));
  checkClean(page, 'multiple choice clue');
  await page.close();

  /* ---------- the same round on a second board ----------
     The measurement the whole tier rests on. Five rounds were *shaped* by Jeopardy,
     so of course they fitted it; a shelf with one caller is a guess about an API.
     Blockbusters hosts them with no change to any round, which is the difference
     between a tier and one game's helper.

     Driven through the hexagons rather than through `ROUND_HOSTS` directly, because
     what could break is the wiring at the board — the normalisation carrying the
     round's field across, the host being named before `setup` reads the ctx, and
     the claim chooser standing down while the round owns the verdict. */
  /* **Through the shared opener, which is what stops this rotting again.** This block
     built its own page — a third copy of the same eight lines in one suite — so the
     preferences the harness switches off never reached it, and the standings screen
     that arrived between questions covered the board it was about to click. Whatever
     the harness turns off, it turns off here too, by not being written twice. */
  page = await openLabHub(browser);
  await page.evaluate(() => {
    window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
    window.HubSettings.set('buzzers', true);
  });
  await page.getByText('Lab', { exact:false }).first().click(); await page.waitForTimeout(220);
  await page.locator('h3:visible', { hasText:'Blockbusters' }).first().click();
  await page.waitForTimeout(220);
  // LB1 alone is exactly 18 items, so every one of them is on the board
  await page.locator('#content-list input').first().check(); await page.waitForTimeout(150);
  await page.locator('#start-btn').click(); await page.waitForTimeout(700);
  if (await page.locator('#intro-overlay.on').count()){
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
  }
  /* **This only works because every LB1 clue is dealt, and nothing was saying so.**
     The board holds 18 hexagons; if LB1 ever grows past that, the deal becomes a
     sample and any clue named below is present only some of the time — three checks
     then fail at random and read as a broken round rather than as drifted content.
     So the precondition is asserted rather than assumed, and it names the real cause
     when it goes. */
  check('every LB1 clue is on the board, so a named one is always dealt',
        await page.evaluate(() => {
          const u = (window.UNITS || []).find(x => (x.blockbustersBank || [])
                      .some(i => i.section === 'LB1'));
          const n = (u.blockbustersBank || []).filter(i => i.section === 'LB1').length;
          return { items:n, hexes:document.querySelectorAll('.hex').length };
        }).then(r => r.items === r.hexes),
        JSON.stringify(await page.evaluate(() => ({
          items:((window.UNITS || []).find(x => (x.blockbustersBank || [])
                   .some(i => i.section === 'LB1')).blockbustersBank || [])
                   .filter(i => i.section === 'LB1').length,
          hexes:document.querySelectorAll('.hex').length }))));

  /* Open the hexagon carrying a given clue. The board shuffles, and a letter is a
     *name* rather than a key — two hexagons may share one — so it is found by its
     clue rather than by its letter.

     It closes whatever is open before it starts. A caller that revealed a clue and
     did not close it left the card up, so the first hexagon this clicked did nothing
     and the loop burned an iteration reading the *previous* clue — harmless until the
     day the previous clue happens to match, which would open nothing and report true. */
  /* **Close by whichever button is actually there.** Skip is hidden once a round has
     been won and is waiting for Close — `hideAllActionButtons` takes it away — so
     reaching for Skip by name threw the moment a card could outlive its own answer.
     The card is the thing being closed; which button does it is the board's business. */
  const shutCard = async () => {
    for (const id of ['#skip-btn', '#close-btn']){
      if (await page.locator(id + ':visible').count()){
        await page.locator(id).click({ force:true });
        await page.waitForTimeout(300);
        return true;
      }
    }
    return false;
  };
  const openHex = async want => {
    if (await page.locator('#clue-modal:visible').count()) await shutCard();
    const total = await page.locator('.hex').count();
    for (let i = 0; i < total; i++){
      const hex = page.locator('.hex').nth(i);
      if (await hex.evaluate(h => h.classList.contains('claimed-gold') ||
                                  h.classList.contains('claimed-silver'))) continue;
      await hex.click({ force:true }); await page.waitForTimeout(320);
      if (new RegExp(want, 'i').test(await textOf(page.locator('#clue-text')))) return true;
      await shutCard();
    }
    return false;
  };
  const claimVisible = () => page.evaluate(() =>
    getComputedStyle(document.getElementById('clue-claim')).visibility === 'visible');

  check('a hexagon opens a round', await openHex('Which verb goes with'));
  check('and the round draws its own card, not a plain clue',
        await page.locator('#clue-group .gword').count() === 4,
        String(await page.locator('#clue-group .gword').count()));
  /* The letter is the hexagon's name and stays on the topline whatever is behind
     it — it is how a team says which square they are attacking, and what the
     picking vote counts. */
  check('the hexagon keeps its letter on the topline',
        /^[A-Z]$/.test((await page.locator('#clue-topline').innerText()).trim()),
        await page.locator('#clue-topline').innerText());
  /* Blockbusters scores by claiming, so the chooser is a second way to award the
     same hexagon. A live round owns the verdict, so it stands down. */
  check('the team chooser stands down while the round is live', !(await claimVisible()));
  /* By `data-word`, not by text: an option carries its A/B/C/D letter in the same
     element, which is a card-side affordance so a teacher can say "who went for B?"
     out loud. The phones get the words alone. */
  await page.locator('#clue-group .gword[data-word="serve"]').click();
  await page.waitForTimeout(120);
  await page.locator('#group-btn').click(); await page.waitForTimeout(2400);
  /* The hexagon is claimed out of `roundHost.win`, which now runs on the Close
     press — so on this board too the card holds the answer up until the teacher
     takes it down, and the claim lands with it. */
  await closeWonRound(page);
  check('a correct round claims the hexagon and scores it',
        await page.locator('.hex.claimed-gold, .hex.claimed-silver').count() === 1 &&
        Number((await scoresOf(page))[0]) > 0,
        (await scoresOf(page)).join('/'));

  check('a second round type plays on the same board', await openHex('things a court does'));
  await page.locator('#reveal-btn').click(); await page.waitForTimeout(700);
  check('Reveal lights the four and hands the chooser back',
        await page.locator('#clue-group .gword.right').count() === 4 &&
        await claimVisible(),
        String(await page.locator('#clue-group .gword.right').count()));

  check('an ordinary letter clue on the same board is untouched',
        await openHex('twelve jurors') &&
        await page.locator('#clue-group').count() === 0 &&
        await claimVisible());

  /* ---------- and the replies come back in ----------
     The half that shipped broken. Arming the handsets and never routing what they
     send is **silent**: the phones look right, the card looks right, and every tap
     lands on the floor. Blockbusters declared `phoneRound()` and left `onVoteReply`
     feeding only its hexagon-picking vote, so a thermometer never lit up.

     Driven from a real handset rather than by calling the hook, because what broke
     was the wiring between the two ends and nothing else would have noticed. */
  const bbCode = await codeOf(page);
  check('a room is open on the hexagon board', !!bbCode, String(bbCode));
  if (bbCode){
    const cy = await join(bbCode, 'Cy', 0);
    check('a hexagon round opens an ordering ladder', await openHex('lightest first'),
          await page.locator('#clue-text').innerText());
    await page.waitForTimeout(900);
    check('the handset is asked the round, not a buzzer',
          (await cy.locator('#opts button').count()) >= 4 &&
          !(await cy.locator('#buzzer').isVisible()),
          String(await cy.locator('#opts button').count()));
    /* One tap, the cold end of the scale. One phone on the team is the whole team,
       so it is unanimous by itself and the rung lands. */
    await tap(cy, ['a caution']);
    await page.waitForTimeout(1400);
    // a word that has landed is an `.ord-word` inside a rung — an empty rung has none
    check('a tap on the phone lands on the card',
          await page.locator('#clue-group .ord-word').count() >= 1,
          (await page.locator('#clue-group').innerText()).replace(/\s+/g,' ').slice(0, 90));
    check('and the phone had no errors', cy.__errors.length === 0, cy.__errors.join('|'));
    await cy.close();
  }
  checkClean(page, 'blockbusters hosting a round');
  await page.close();

  /* The ladder plus its pool plus the buttons is the tallest thing any round has
     put on a clue card, and empty rungs sized like full ones pushed it past both
     edges at 1280x720. Measured on the $500 clue, whose words are the longest. */
  for (const vp of [{ width:1280, height:720, tag:'a projector' },
                    { width:390,  height:844, tag:'a handset' }]){
    const p2 = await openLab(['Word Thermometer','Anagram','Gap Fill'], { phones:false });
    // the shared ladder is the tall case being measured — state it, as above
    await p2.evaluate(() => window.HubSettings.set('round_ordering', 'climb', 'jeopardy'));
    await p2.setViewportSize({ width:vp.width, height:vp.height });
    await p2.waitForTimeout(250);
    await openTile(p2, 'Word Thermometer', 4);
    const m = await p2.evaluate(() => {
      const card = document.getElementById('clue-card').getBoundingClientRect();
      const acts = document.getElementById('clue-actions').getBoundingClientRect();
      const rungs = [...document.querySelectorAll('#clue-group .ord-rung')]
                      .map(e => e.getBoundingClientRect());
      return { rungs: rungs.length,
               below: rungs.filter(r => r.bottom > card.bottom - 1).length,
               top: Math.round(card.top), bottom: Math.round(card.bottom),
               vh: window.innerHeight,
               actionsOn: acts.bottom <= window.innerHeight && acts.top >= 0 };
    });
    check(`ordering on ${vp.tag}: the whole card is on screen`,
          m.top >= 0 && m.bottom <= m.vh && !m.below, JSON.stringify(m));
    check(`ordering on ${vp.tag}: and the buttons are reachable`, m.actionsOn, JSON.stringify(m));
    await p2.close();
  }

  /* ---------- it fits, on both screens ----------
     The `fit` and `phone` suites ask every registered game about its *stage*; a clue
     card is not a stage and neither of them opens one, so a set of words that
     overflowed the card would pass both. Checked on the $500 clue, whose eight words
     are the longest in the category, and on a handset as well as a projector because
     a teacher checks a lesson on their phone. */
  for (const vp of [{ width:1280, height:720, tag:'a projector' },
                    { width:390,  height:844, tag:'a handset' }]){
    const p = await openLab(['Connections','Anagram','Gap Fill'], { phones:false });
    await p.setViewportSize({ width:vp.width, height:vp.height });
    await p.waitForTimeout(250);
    await openTile(p, 'Connections', 4);
    const m = await p.evaluate(() => {
      const card  = document.getElementById('clue-card');
      const r     = card.getBoundingClientRect();
      const chips = [...document.querySelectorAll('#clue-group .gword')].map(e => e.getBoundingClientRect());
      const acts  = document.getElementById('clue-actions').getBoundingClientRect();
      return { chips: chips.length,
               below: chips.filter(c => c.bottom > r.bottom - 1).length,
               past:  chips.filter(c => c.right  > r.right  - 1).length,
               clipped: card.scrollHeight > card.clientHeight + 1,
               actionsOn: acts.bottom <= window.innerHeight && acts.top >= 0 };
    });
    check(`on ${vp.tag}: the words stay inside the card`,
          m.chips === 8 && !m.below && !m.past && !m.clipped, JSON.stringify(m));
    check(`on ${vp.tag}: and the buttons are still reachable`, m.actionsOn, JSON.stringify(m));
    checkClean(p, vp.tag);
    await p.close();
  }
}

/* ---- the question bench ----
   The card and its phones on one screen. It matters more than it looks: this is the
   **second caller** of `Kit.round`, and a shelf with one caller is a guess rather
   than an API. What this suite really asserts is that the card a class meets and
   the card you tune are the same code — so it checks the round is drawn here by the
   registry, not by the page, and that a tap on a real handset lands on it. */
async function testQuestionBench(browser){
  section('Playground: the question bench');
  const page = await browser.newPage({ viewport:{ width:1500, height:900 } });
  page.__errors = []; page.__console = [];
  page.on('pageerror', e => page.__errors.push(String(e)));
  page.on('console', m => {
    /* A racked handset asks to vibrate on a tap, and Chromium refuses it until the
       frame has been touched by a real finger. That is the simulation being a
       simulation, not the phone misbehaving. */
    if (m.type() === 'error' &&
        !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)|navigator\.vibrate/.test(m.text()))
      page.__console.push(m.text());
  });
  await page.goto(BASE + '/playground/question-bench.html'); await page.waitForTimeout(1200);

  /* The bench card mirrors the hub clue card's own metrics — `#clue-text` resolves
     to 1.7rem on a 1280 board and `#clue-back` leaves 636px of content inside a
     720px card (hub.css). Everything a round draws is sized in em off that base,
     so a bench card at the page's default 16px drew every tile 40% smaller and a
     word tray that was one row here was two on the projector — reported as the
     two cards being formatted differently, which is precisely what this page must
     never be. Pinned as numbers because the bench cannot load hub.css to share
     the rule; if the clue card's geometry changes, this check is what says the
     bench no longer matches. */
  const mirror = await page.evaluate(() => {
    const round = document.getElementById('card-round');
    const frame = document.getElementById('card-frame');
    const inner = frame.clientWidth - parseFloat(getComputedStyle(frame).paddingLeft)
                                    - parseFloat(getComputedStyle(frame).paddingRight);
    return { font: getComputedStyle(round).fontSize, inner: Math.round(inner) };
  });
  check('the card carries the clue card’s type size', mirror.font === '27.2px', mirror.font);
  check('and the clue card’s content width', mirror.inner === 636, String(mirror.inner));

  /* The menu is the registry asked, never a list kept in step by hand — the same
     discipline the fit and phone suites use, so a round written next month
     appears here without this page or this check being edited. */
  /* Both registries, because the bench is one workshop for both kinds of question
     now: a **round** is one the class plays (card + phones + judging) and a **form**
     is a way of writing one (render and reveal, no phones at all). They keep their
     own registries, which is right — what was wrong was a workshop each, since a
     teacher with an idea should not have to know which category it falls into
     before knowing which page to open. */
  const groups = await page.evaluate(() =>
    [...document.querySelectorAll('#type-pick optgroup')].map(g => ({
      label: g.label, opts: [...g.querySelectorAll('option')].map(o => o.value) })));
  const listed = groups.reduce((a, g) => a.concat(g.opts), []);
  /* `authored()`, not `ids()` — the rounds you can write a question for. The default
     round wraps an ordinary question, so it has no card to draw and no fields to edit,
     and offering it here would open a blank page on the author. It registers first, so
     it would also have become the bench's opening type. The menu asks the narrower
     list; this asks the same one, or it would be testing a rule nobody wants. */
  const ids    = await page.evaluate(() => window.HubKit.round.authored());
  const forms  = await page.evaluate(() => window.HubKit.prompt.types());
  /* **Namespaced, because the two registries can hold the same name.** `anagram` is
     both — a form that draws scattered letters and re-sorts them on reveal, and a
     round where every handset drags them into boxes. Keyed by name alone the round
     shadowed the form completely and the form became unreachable from the menu,
     which is the exact failure the prompt lab was built to stop. Expect the pairing
     to recur: a round is often the played version of a form. */
  check('every registered round is in the menu',
        ids.length > 0 && ids.every(id => listed.indexOf('r:' + id) !== -1),
        listed.join('|') + ' vs ' + ids.join('|'));
  check('and every registered question form is too',
        forms.length > 0 && forms.every(t => listed.indexOf('f:' + t) !== -1),
        listed.join('|') + ' vs ' + forms.join('|'));
  const clash = ids.filter(id => forms.indexOf(id) !== -1);
  check('a name held by both registries appears twice, once as each',
        clash.length > 0 &&
        clash.every(n => listed.indexOf('r:' + n) !== -1 && listed.indexOf('f:' + n) !== -1),
        'shared names: ' + (clash.join(',') || 'none') + ' | ' + listed.join('|'));
  /* A form in the kit is live in every game the day a bank item carries its type;
     a lab form can reach no game at all. `bridge` shipped invisibly once because
     that difference was not said out loud anywhere, so the menu says it. Derived
     from what the two files register, never a literal list — naming a form here is
     how the forms suite came to fail the day one graduated. */
  const kit = await page.evaluate(() => window.IN_THE_KIT || []);
  const labOnly = forms.filter(t => kit.indexOf(t) === -1);
  const kitGroup = groups.find(g => /in the kit/i.test(g.label));
  const labGroup = groups.find(g => /lab only/i.test(g.label));
  check('the menu separates forms that are in the kit from experimental ones',
        !!kitGroup && !!labGroup && kit.every(t => kitGroup.opts.indexOf('f:' + t) !== -1),
        JSON.stringify(groups.map(g => g.label)));
  check('and no experimental form is offered as if a game could draw it',
        labOnly.length > 0 && labOnly.every(t => labGroup && labGroup.opts.indexOf('f:' + t) !== -1),
        labOnly.join('|') + ' vs ' + JSON.stringify(labGroup));
  check('the card draws the whole set of words',
        await page.locator('#card-round .gword').count() === 8);
  /* The card is drawn from `hub-rounds.css`, which this page loads instead of
     `hub.css` — if that ever stopped being true the words would be unstyled text. */
  const styled = await page.evaluate(() => {
    const g = document.querySelector('#card-round .gword');
    const cs = getComputedStyle(g);
    return { cols: getComputedStyle(document.querySelector('.group-words')).gridTemplateColumns,
             border: cs.borderTopWidth, radius: cs.borderTopLeftRadius };
  });
  check('two columns, the same shape as the handset',
        styled.cols.split(' ').length === 2 && styled.border !== '0px',
        JSON.stringify(styled));

  const chip = await page.locator('#room-chip').innerText();
  const code = (chip.match(/(\d{5})/)||[])[1];
  check('a room opens on its own', !!code, chip.replace(/\n/g,' '));

  if(code){
    /* The card's width before any phone exists. Everything below is measured
       against it, because **the card giving up width is the one thing this page
       must never do** — a card that changes size when a handset is added is not the
       card a class meets, and the entire value of the bench is that it is. */
    const cardBefore = await page.evaluate(() =>
      Math.round(document.getElementById('card-frame').getBoundingClientRect().width));

    for(let i = 0; i < 4; i++){
      await page.locator('#add-phone').click(); await page.waitForTimeout(1100);
    }
    await page.waitForTimeout(600);
    check('real handsets rack up beside the card',
          await page.locator('.phone .clip iframe').count() === 4);

    const shape = await page.evaluate(() => {
      const card = document.getElementById('card-frame').getBoundingClientRect();
      const ed   = document.getElementById('editor').getBoundingClientRect();
      const rows = [...document.querySelectorAll('.rack-row')];
      return { card:Math.round(card.width), editor:Math.round(ed.width),
               rows:rows.length, perRow: rows.map(r => r.children.length),
               wide: document.body.scrollWidth > window.innerWidth };
    });
    check('the card keeps its width when phones are added — they shrink, it does not',
          shape.card === cardBefore, cardBefore + ' -> ' + shape.card);
    /* A row per team, not one row of everything: the rack reads the way the room
       does. Four phones across two teams is two rows of two. */
    check('phones are grouped by team, side by side within a team',
          shape.rows === 2 && shape.perRow.join(',') === '2,2',
          JSON.stringify(shape));
    /* A race keeps every word on the card. Each team has placed different ones, so
       removing a word because *some* team used it makes the card lie to the rest —
       and filtering by the teacher's own lane made the list shrink as Team 1
       climbed, which reads as words vanishing for no reason anybody can see. */
    /* The editor sits under the card and no wider. Spanning the page pushed the
       rack over and made three inputs the widest thing on screen, which is the
       wrong emphasis: the card is the subject, these are its controls. */
    check('the editor sits under the card, not across the page',
          shape.editor <= shape.card + 2, JSON.stringify(shape));
    check('and nothing runs off the right edge', !shape.wide, JSON.stringify(shape));

    check('the cap is twenty, not four — more phones can still be racked',
          !(await page.locator('#add-phone').isDisabled()) &&
          /\+ phone \(4\)/.test(await page.locator('#add-phone').innerText()),
          await page.locator('#add-phone').innerText());
    /* The room bench's lesson, one level down: a scaled phone still has to be laid
       out at a real handset's width, or the bench shows a layout no phone shows. */
    const inner = await page.evaluate(() => {
      const f = document.querySelector('.phone .clip iframe');
      return { w: f.getBoundingClientRect().width, attr: f.offsetWidth,
               cols: f.contentWindow.getComputedStyle(
                       f.contentDocument.getElementById('opts')).gridTemplateColumns };
    });
    check('and are laid out at a handset width, then scaled',
          inner.attr === 390 && inner.w < 390, JSON.stringify(inner));
    check('so the phone shows the two columns a real one does',
          inner.cols.split(' ').length === 2, inner.cols);

    const frames = page.frames().filter(f => /join\.html/.test(f.url()));
    const tap = async (f, words) => {
      for(const w of words){
        await f.locator('#opts button', { hasText:new RegExp('^'+w+'$') }).first().click();
        await f.waitForTimeout(120);
      }
    };
    /* The words come from the round's own sample rather than a copy here. The
       bench opens on `read(sample)` now, so a suite carrying its own list is a
       second source that goes stale the day the sample is edited — which is
       exactly what happened when the editor stopped being a hand-kept table. */
    const set = await page.evaluate(() => {
      const g = Kit.round.get('grouping').sample.group;
      return { pick: g.pick.slice(), decoy: g.with.slice() };
    });
    // seats alternate teams, so frames 0 and 2 are both Team 1 — the union of
    // their picks is that team's answer
    await tap(frames[0], set.pick.slice(0, 2));
    await tap(frames[2], set.decoy.slice(0, 2));
    await page.waitForTimeout(1400);
    check('a wrong set is named on the card',
          /not a group/i.test(await page.locator('#card-round .group-say').innerText()),
          await page.locator('#card-round .group-say').innerText());
    check('and the board says the share out loud',
          /2 phones, 2 each/.test(await page.locator('#card-round .rlanes').innerText()),
          await page.locator('#card-round .rlanes').innerText());

    await tap(frames[2], set.decoy.slice(0, 2));          // drop them
    await page.waitForTimeout(300);
    /* This asserts the take-path — a right set ENDS the question and lights its four
       words — which is `roundOpenToAll` off ("restores the race"), a real supported
       mode rather than the default. Open-to-all keeps the room open on a right answer
       and so lights nothing here; that is its own branch and not what this check is
       about. Read live in ctx(), so setting it at master scope reaches the next settle;
       restored after, since the pages that follow share this context's storage. */
    await page.evaluate(() => S.set('roundOpenToAll', false));
    await tap(frames[2], set.pick.slice(2, 4));
    await page.waitForTimeout(1500);
    check('the right set is taken and the four light up',
          await page.locator('#card-round .gword.right').count() === 4 &&
          /has it/i.test(await page.locator('#card-round .group-say').innerText()),
          await page.locator('#card-round .group-say').innerText());
    await page.evaluate(() => S.set('roundOpenToAll', true));
    /* No score anywhere on this page, and that is the contract rather than an
       omission: a round has no points, no turn and no clock. */
    check('and nothing on the bench scored it',
          await page.locator('.score, .team-chip').count() === 0);
  }
  /* Last, because racking a fifth phone on plain http is exactly what stops taps
     arriving — the thing this warning is about — so anything after it would be
     testing the limit rather than the round. Over HTTP/1.1 a browser allows six
     connections per origin and the board's own stream is one of them; the deployed
     site is HTTP/2, where streams share a connection and none of it applies. The
     bench says which situation you are in rather than pretending one number is
     true everywhere. */
  await page.locator('#add-phone').click(); await page.waitForTimeout(900);
  check('past four racked phones on plain http, the bench warns rather than lying',
        await page.locator('#rack-warn').isVisible() &&
        /six connections per origin/i.test(await page.locator('#rack-warn').innerText()),
        await page.locator('#rack-warn').innerText().catch(()=>'(hidden)'));
  checkClean(page, 'question bench');
  await page.close();

  /* ---------- teams, and the rack grouped by them ----------
     A round can give each team its own board, so the bench has to be able to make
     more than two — and the rack reads the way the room does, a row per team, so
     which handsets belong together is visible at a glance. */
  const tm = await browser.newPage({ viewport:{ width:1500, height:950 } });
  tm.__errors = []; tm.__console = [];
  tm.on('pageerror', e => tm.__errors.push(String(e)));
  tm.on('console', m => {
    if (m.type() === 'error' &&
        !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)|navigator\.vibrate/.test(m.text()))
      tm.__console.push(m.text());
  });
  await tm.goto(BASE + '/playground/question-bench.html'); await tm.waitForTimeout(1300);
  await tm.locator('#type-pick').selectOption('r:ordering'); await tm.waitForTimeout(500);
  await tm.locator('#mode-pick').selectOption('race'); await tm.waitForTimeout(700);
  check('the rack starts with a row per team', await tm.locator('.rack-row').count() === 2);
  await tm.locator('#add-team').click(); await tm.waitForTimeout(800);
  await tm.locator('#add-team').click(); await tm.waitForTimeout(800);
  check('teams can be added, and a new team gets a lane and a row',
        await tm.locator('.rack-row').count() === 4 &&
        await tm.locator('.ord-lane').count() === 4,
        (await tm.locator('.rack-row').count()) + ' rows, ' +
        (await tm.locator('.ord-lane').count()) + ' lanes');
  check('and it stops at four, which is where a clue card stops being readable',
        await tm.locator('#add-team').isDisabled());
  const tmCode = ((await tm.locator('#room-chip').innerText()).match(/(\d{5})/)||[])[1];
  if(tmCode){
    for(let i = 0; i < 4; i++){
      await tm.locator('#add-phone').click(); await tm.waitForTimeout(1000);
    }
    await tm.waitForTimeout(700);
    /* Evenly, so a race actually has two sides to it — all the phones on one team
       tests nothing. */
    const spread = await tm.evaluate(() =>
      [...document.querySelectorAll('.rack-row')].map(r => r.children.length));
    check('phones fill the teams evenly and land in their own team’s row',
          spread.join(',') === '1,1,1,1', spread.join(','));
    check('and every row is labelled with its team',
          await tm.locator('.rack-label').count() === 4);
  }
  checkClean(tm, 'bench teams');
  await tm.close();

  /* ---------- the second round, and both its modes ----------
     This is the real test of the contract. Grouping shaped it; ordering is the one
     that finds out whether the shape was right — a sequence is not a set, and a
     right answer is progress rather than an ending. Both of those are new here. */
  const ord = await browser.newPage({ viewport:{ width:1500, height:950 } });
  ord.__errors = []; ord.__console = [];
  ord.on('pageerror', e => ord.__errors.push(String(e)));
  ord.on('console', m => {
    if (m.type() === 'error' &&
        !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)|navigator\.vibrate/.test(m.text()))
      ord.__console.push(m.text());
  });
  await ord.goto(BASE + '/playground/question-bench.html'); await ord.waitForTimeout(1300);
  await ord.locator('#type-pick').selectOption('r:ordering'); await ord.waitForTimeout(800);

  /* The picker is built from what the round declares, so the bench never learns what
     a mode means — a round with one way to play gets no picker at all. */
  check('a round with two ways to play offers both',
        await ord.locator('#mode-pick').isVisible() &&
        await ord.locator('#mode-pick option').count() === 2,
        (await ord.locator('#mode-pick option').allInnerTexts()).join(' | '));
  check('the ladder is drawn with a rung per step and both ends named',
        await ord.locator('.ord-rung').count() === 5 &&
        await ord.locator('.ord-cap').count() === 2,
        String(await ord.locator('.ord-rung').count()));
  check('and the next rung is marked, since the room fills it cold end first',
        await ord.locator('.ord-rung.next').count() === 1);

  const ordCode = ((await ord.locator('#room-chip').innerText()).match(/(\d{5})/)||[])[1];
  if(ordCode){
    await ord.locator('#add-phone').click(); await ord.waitForTimeout(1100);
    await ord.locator('#add-phone').click(); await ord.waitForTimeout(1300);
    const of0 = ord.frames().filter(f => /join\.html/.test(f.url()))[0];
    const tapW = async (fr, w) => {
      await fr.locator('#opts button', { hasText:new RegExp('^'+w+'$') }).first().click();
      await fr.waitForTimeout(150);
    };
    /* Climb: one tap, and — the thing grouping never had to model — **a right
       answer is progress, not the end**. Scoring on the first correct rung would
       have paid a tile four rungs early. */
    await tapW(of0, 'annoyed'); await ord.waitForTimeout(1300);
    check('climb: a right word locks its rung and the round keeps going',
          await ord.locator('.ord-rung.filled').count() === 1 &&
          !(await ord.locator('.group-say.good').count()),
          await ord.locator('.group-say').innerText().catch(()=>'-'));
    await tapW(of0, 'furious'); await ord.waitForTimeout(1300);
    check('climb: a wrong word costs nothing and the ladder holds',
          await ord.locator('.ord-rung.filled').count() === 1 &&
          /not that one/i.test(await ord.locator('.group-say').innerText()),
          await ord.locator('.group-say').innerText());

    /* A ladder each, racing. This is the mode that needed the one relay feature
       nothing had ever used: **each team is asked a different question**, because
       each has placed different words and so has a different set left. */
    await ord.locator('#mode-pick').selectOption('race'); await ord.waitForTimeout(1300);
    check('a race gives every team its own ladder',
          await ord.locator('.ord-lane').count() === 2 &&
          await ord.locator('.ord-who').count() === 2,
          String(await ord.locator('.ord-lane').count()));
    /* Named once above and below the lanes, not per lane: the two ends belong to the
       question, and four copies of them is three copies of noise. */
    check('and the two ends of the scale are named once, not per lane',
          await ord.locator('.ord-cap').count() === 2);

    const fr = ord.frames().filter(f => /join\.html/.test(f.url()));
    await tapW(fr[0], 'annoyed'); await ord.waitForTimeout(1200);
    await tapW(fr[0], 'irritated'); await ord.waitForTimeout(1200);
    await tapW(fr[1], 'annoyed'); await ord.waitForTimeout(1200);
    check('each team climbs its own ladder independently',
          await ord.locator('.ord-lane').nth(0).locator('.ord-rung.filled').count() === 2 &&
          await ord.locator('.ord-lane').nth(1).locator('.ord-rung.filled').count() === 1,
          (await ord.locator('.ord-lane').nth(0).locator('.ord-rung.filled').count()) + '/' +
          (await ord.locator('.ord-lane').nth(1).locator('.ord-rung.filled').count()));
    /* **The list never shrinks, and each phone is told its own settled words.** It
       used to be the other way round — each side was offered only what it had left —
       and a class of sixteen found what that costs: every box below a placed word
       shuffled up under a thumb mid-question, and a reconnecting phone came back
       with a shorter list and no record of its own ladder. Both handsets hold the
       whole pool now; what differs is which of them are marked done, which is this
       team's own progress and nobody else's. */
    check('the whole pool stays on both handsets, however far each has climbed',
          await fr[0].locator('#opts button').count() === 5 &&
          await fr[1].locator('#opts button').count() === 5,
          (await fr[0].locator('#opts button').count()) + ' vs ' +
          (await fr[1].locator('#opts button').count()));
    check('and each phone is marked with its own team’s placed words',
          await fr[0].locator('#opts button.done').count() === 2 &&
          await fr[1].locator('#opts button.done').count() === 1,
          (await fr[0].locator('#opts button.done').count()) + ' vs ' +
          (await fr[1].locator('#opts button.done').count()));
    /* The card is the reference list of what is in play — every word stays on it
       while teams climb, because each has placed different ones and removing a word
       because *some* team used it makes the card lie to the rest. */
    check('and the card keeps every word while teams climb',
          await ord.locator('.ord-pool .gword').count() === 5,
          String(await ord.locator('.ord-pool .gword').count()));
    for(const w of ['angry','livid','furious']){ await tapW(fr[0], w); await ord.waitForTimeout(1100); }
    check('and the first ladder finished takes the question',
          /has it/i.test(await ord.locator('.group-say').innerText()) &&
          await ord.locator('.ord-who.won').count() === 1,
          await ord.locator('.group-say').innerText());
  }
  checkClean(ord, 'ordering bench');
  await ord.close();

  /* ---------- the whole team, or nobody ----------
     A rung used to land on whatever most of a team had said, so three students could
     carry a fourth who was never asked to commit — and on a two-phone team it meant
     one playing and one watching. Two phones on one team is the smallest arrangement
     that can tell the difference, and a majority of one out of two is exactly what
     the old code would have accepted. */
  const una = await browser.newPage({ viewport:{ width:1500, height:950 } });
  una.__errors = []; una.__console = [];
  una.on('pageerror', e => una.__errors.push(String(e)));
  una.on('console', m => {
    if (m.type() === 'error' &&
        !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)|navigator\.vibrate/.test(m.text()))
      una.__console.push(m.text());
  });
  await una.goto(BASE + '/playground/question-bench.html'); await una.waitForTimeout(1300);
  await una.locator('#type-pick').selectOption('r:ordering'); await una.waitForTimeout(800);
  const unaCode = ((await una.locator('#room-chip').innerText()).match(/(\d{5})/)||[])[1];
  if(unaCode){
    // four phones, two teams — the bench seats them alternately, so 0 and 2 are one team
    for(let i = 0; i < 4; i++){
      await una.locator('#add-phone').click(); await una.waitForTimeout(1000);
    }
    await una.waitForTimeout(800);
    const uf = una.frames().filter(f => /join\.html/.test(f.url()));
    const tapW = async (fr, w) => {
      await fr.locator('#opts button', { hasText:new RegExp('^'+w+'$') }).first().click();
      await fr.waitForTimeout(150);
    };

    await tapW(uf[0], 'annoyed'); await una.waitForTimeout(1400);
    check('climb: one of a team of two is not the team, so the rung holds',
          await una.locator('.ord-rung.filled').count() === 0,
          String(await una.locator('.ord-rung.filled').count()));
    /* The count is what stops that reading as a broken board. It is also the whole
       teaching move: the room can see which of them still has to be talked round. */
    check('and the card says how far off agreeing they are',
          /1\/2/.test(await una.locator('.group-tally').innerText()),
          await una.locator('.group-tally').innerText().catch(()=>'(none)'));
    /* Being split is not being wrong. A verdict here would tell off a team that has
       done nothing but disagree, which is the part of the lesson worth having. */
    /* Asked of the *text*, not of the element. `.group-say` is always in the DOM
       now — it reserves its row so that a message appearing cannot make the card
       jump under the room — so counting it would say "there is a verdict" on every
       card ever drawn. */
    check('and being short of agreement draws no verdict at all',
          !(await una.locator('.group-say').innerText().catch(()=>'')).trim(),
          await una.locator('.group-say').innerText().catch(()=>'(none)'));

    await tapW(uf[2], 'annoyed'); await una.waitForTimeout(1400);
    check('climb: the rung lands the moment the whole team has it',
          await una.locator('.ord-rung.filled').count() === 1,
          String(await una.locator('.ord-rung.filled').count()));

    /* A ladder each, same rule. The count moves onto the team's own lane label,
       because a count inside a rung makes that rung taller than the others and the
       lanes stop lining up — the bug the equal-height rungs were written to kill. */
    await una.locator('#mode-pick').selectOption('race'); await una.waitForTimeout(1400);
    await tapW(uf[0], 'annoyed'); await una.waitForTimeout(1400);
    check('race: one of two holds the lane, and the lane label carries the count',
          await una.locator('.ord-lane').nth(0).locator('.ord-rung.filled').count() === 0 &&
          /1\/2/.test(await una.locator('.ord-lane').nth(0).locator('.ord-agree').innerText()),
          await una.locator('.ord-lane').nth(0).locator('.ord-who').innerText().catch(()=>'-'));
    /* The leading word still shows while they argue — a team one vote short must not
       look like a team that has done nothing. */
    check('and the word they are converging on is already on the rung',
          /annoyed/i.test(await una.locator('.ord-lane').nth(0)
                                   .locator('.ord-rung.guessing').innerText()),
          await una.locator('.ord-lane').nth(0).locator('.ord-rung.next').innerText().catch(()=>'-'));
    await tapW(uf[2], 'annoyed'); await una.waitForTimeout(1400);
    check('race: and it lands when the second phone agrees',
          await una.locator('.ord-lane').nth(0).locator('.ord-rung.filled').count() === 1,
          String(await una.locator('.ord-lane').nth(0).locator('.ord-rung.filled').count()));

    /* The teacher is never locked out by a phone in a drawer. Their answer does not
       come through `read()`, so it is not gated — with one handset silent the round
       would otherwise be unfinishable and only Reveal would get out of it. */
    await tapW(uf[1], 'annoyed'); await una.waitForTimeout(1200);
    const lane1 = await una.locator('.ord-lane').nth(1).locator('.ord-rung.filled').count();
    await una.locator('#for-team').selectOption('1'); await una.waitForTimeout(300);
    await una.locator('#card-round .gword[data-word="annoyed"]').click();
    await una.waitForTimeout(200);
    await una.locator('#check-btn').click(); await una.waitForTimeout(600);
    check('a half-agreed team can still be moved on by the teacher',
          lane1 === 0 &&
          await una.locator('.ord-lane').nth(1).locator('.ord-rung.filled').count() === 1,
          lane1 + ' -> ' +
          (await una.locator('.ord-lane').nth(1).locator('.ord-rung.filled').count()));

    /* **A dead phone must not freeze its team.** The gate is against the roster, so
       a team of two sitting at 1/2 is unanimous the moment the second handset drops
       off — and nothing else would ever say so, because a leaver sends no reply.
       Team 3 is empty, so a phone is moved there first to make a two-phone team. */
    await una.locator('#add-team').click(); await una.waitForTimeout(700);
    await una.locator('#mode-pick').selectOption('climb'); await una.waitForTimeout(1200);
    const uf2 = una.frames().filter(f => /join\.html/.test(f.url()));
    const w2 = (await una.locator('.ord-pool .gword').first().getAttribute('data-word'));
    await tapW(uf2[1], w2); await una.waitForTimeout(1300);
    const before = await una.locator('.group-tally').innerText().catch(()=>'');
    // the other handset on that team goes away entirely
    await una.evaluate(() => {
      const f = [...document.querySelectorAll('.phone')][3];
      if(f) f.remove();
    });
    await una.waitForTimeout(2200);
    check('a phone dropping out shrinks its team rather than freezing it',
          /1\/2/.test(before) &&
          !/1\/2/.test(await una.locator('.group-tally').innerText().catch(()=>'')),
          before.replace(/\n/g,' ') + '  ->  ' +
          (await una.locator('.group-tally').innerText().catch(()=>'(gone)')).replace(/\n/g,' '));
  }
  checkClean(una, 'ordering unanimity');
  await una.close();

  /* ---------- the third round: plain multiple choice ----------
     The one that proves the contract holds for something ordinary. Grouping and
     ordering *shaped* it, so of course they fit; this was written against it
     unchanged, and the whole integration into the game show is a `<script>` line. */
  const mc = await browser.newPage({ viewport:{ width:1500, height:950 } });
  mc.__errors = []; mc.__console = [];
  mc.on('pageerror', e => mc.__errors.push(String(e)));
  mc.on('console', m => {
    if (m.type() === 'error' &&
        !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)|navigator\.vibrate/.test(m.text()))
      mc.__console.push(m.text());
  });
  await mc.goto(BASE + '/playground/question-bench.html'); await mc.waitForTimeout(1300);
  await mc.locator('#type-pick').selectOption('r:choice'); await mc.waitForTimeout(800);
  check('the card draws every option, lettered',
        await mc.locator('#card-round .mc-opt').count() === 4 &&
        (await mc.locator('#card-round .mc-letter').allInnerTexts()).join('') === 'ABCD',
        (await mc.locator('#card-round .mc-letter').allInnerTexts()).join(''));
  /* Two columns, the shape a handset lays four short options out in — the card and
     the phone have to read as the same question, not two versions of it. */
  check('in two columns, the same shape as the handset',
        (await mc.evaluate(() => getComputedStyle(
           document.querySelector('.mc-options')).gridTemplateColumns)).split(' ').length === 2);
  /* Authors put the answer first and a class works that out in about two questions. */
  check('the options are shuffled rather than drawn in authored order',
        await mc.evaluate(() => {
          const def = window.HubKit.round.get('choice');
          const item = { text:'q', choice:{ options:['a','b','c','d','e','f','g','h'], answer:'a' } };
          const seen = new Set();
          for(let i=0;i<40;i++) seen.add(def.setup(item, {}).options.join(''));
          return seen.size > 1;
        }));
  /* A typo in the answer is the one defect a reader cannot catch — the clue looks
     completely normal and is simply impossible to get right. `setup` refusing it is
     what turns it into a visible "not complete" instead. */
  check('an answer that is not one of the options refuses to build at all',
        await mc.evaluate(() => {
          const def = window.HubKit.round.get('choice');
          return def.setup({ text:'q', choice:{ options:['a','b'], answer:'zzz' } }, {}) === null &&
                 def.setup({ text:'q', choice:{ options:['a','b'], answer:'B' } }, {}) !== null;
        }));

  const mcCode = ((await mc.locator('#room-chip').innerText()).match(/(\d{5})/)||[])[1];
  if(mcCode){
    for(let i = 0; i < 4; i++){
      await mc.locator('#add-phone').click(); await mc.waitForTimeout(1000);
    }
    await mc.waitForTimeout(800);
    const mf = mc.frames().filter(f => /join\.html/.test(f.url()));
    check('the handsets are offered the four options, in the card’s own order',
          await mf[0].locator('#opts button').count() === 4 &&
          (await mf[0].locator('#opts button').allInnerTexts()).join('|') ===
          (await mc.locator('#card-round .gw-text').allInnerTexts()).join('|'),
          (await mf[0].locator('#opts button').allInnerTexts()).join('|'));

    /* The answer is deliberately not exposed on the page — the card is what a class
       sees — so the verdict is read off the card rather than compared against it. */
    const wrongWord = (await mc.locator('#card-round .gw-text').allInnerTexts())
      .find(w => w !== 'pass');
    await mf[0].locator('#opts button', { hasText:new RegExp('^'+wrongWord+'$') }).first().click();
    await mc.waitForTimeout(1500);
    check('a wrong answer is named and costs nothing — the card is still live',
          /not that one/i.test(await mc.locator('#card-round .group-say').innerText()) &&
          await mc.locator('#card-round .gword.right').count() === 0,
          await mc.locator('#card-round .group-say').innerText());
    /* **Nothing on an option says who went for it.** A dot in a team's colour on
       the option that team picked is the class reading each other's answers off the
       projector, which is the opposite of what a multiple choice asks. Where each
       team is up to goes in the lanes below — the same picture Connections and the
       two drag rounds draw — and a lane cell is a *person*, filled when they have
       answered, never what they answered. */
    check('no option says who picked it',
          await mc.locator('#card-round .gdot').count() === 0 &&
          await mc.locator('#card-round .mc-opt.held').count() === 0,
          String(await mc.locator('#card-round .gdot').count()));
    check('and a lane per team shows how many have answered, not what',
          await mc.locator('#card-round .rlanes-mc .rlane').count() >= 1 &&
          await mc.locator('#card-round .rlanes-mc .rl-cell.got').count() >= 1 &&
          (await mc.locator('#card-round .rlanes-mc .rl-cell').allInnerTexts()).join('') === '',
          String(await mc.locator('#card-round .rlanes-mc .rlane').count()));

    await mf[1].locator('#opts button', { hasText:/^pass$/ }).first().click();
    await mc.waitForTimeout(1500);
    check('the right answer takes the question outright — no progress to make',
          /has it/i.test(await mc.locator('#card-round .group-say').innerText()),
          await mc.locator('#card-round .group-say').innerText());
    check('and nothing on the bench scored it',
          await mc.locator('.score, .team-chip').count() === 0);

    /* `agree` mode, the same rule the thermometer plays by and for the same reason:
       on a four-phone team a race is won by the fastest thumb and the other three
       never commit to anything. */
    await mc.locator('#mode-pick').selectOption('agree'); await mc.waitForTimeout(1400);
    const mf2 = mc.frames().filter(f => /join\.html/.test(f.url()));
    const word = (await mc.locator('#card-round .gw-text').allInnerTexts())[0];
    await mf2[0].locator('#opts button', { hasText:new RegExp('^'+word+'$') }).first().click();
    await mc.waitForTimeout(1500);
    /* **The fraction is on the lane header, not in a tally of its own.** Multiple
       Choice joined the lane standard and lost `.group-tally` with it: a count beside
       the boxes says what the boxes already say, and in `agree` mode the header
       carries `1/2` next to the team's name. This check went on asking for the old
       element for two builds — and because a bare `innerText()` on nothing *throws*,
       it took the rest of the suite down rather than going red on its own. */
    check('agree: one of a team of two is not the team, so nothing is judged',
          !(await textOf(mc.locator('#card-round .group-say'))) &&
          /\b1\/2\b/.test(await textOf(mc.locator('#card-round .rlanes-mc .rl-agree'))),
          await textOf(mc.locator('#card-round .rlanes-mc .rl-who')) || '(no lanes)');
    await mf2[2].locator('#opts button', { hasText:new RegExp('^'+word+'$') }).first().click();
    await mc.waitForTimeout(1500);
    check('agree: and it is judged the moment the whole team agrees',
          !!(await textOf(mc.locator('#card-round .group-say'))),
          await textOf(mc.locator('#card-round .group-say')) || '(none)');
  }
  checkClean(mc, 'multiple choice bench');
  await mc.close();

  /* ---------- authoring, not just trying ----------
     The bench held one throwaway question and forgot it on reload, so it could be
     used to iterate a question *type* and never to write content — which is the job
     the moment a type is finished.

     It clears its own storage at both ends. Every page in this suite shares one
     browser context, so a bank left behind would be loaded by the next check and
     the sample it expects would silently not be there. */
  const au = await browser.newPage({ viewport:{ width:1500, height:1000 } });
  au.__errors = []; au.__console = [];
  au.on('pageerror', e => au.__errors.push(String(e)));
  au.on('console', m => {
    if (m.type() === 'error' &&
        !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)|navigator\.vibrate|favicon/.test(m.text()))
      au.__console.push(m.text());
  });
  await au.goto(BASE + '/playground/question-bench.html'); await au.waitForTimeout(1300);
  await au.evaluate(() => { try{ localStorage.removeItem('engishism.bench.bank'); }catch(e){} });
  await au.reload(); await au.waitForTimeout(1300);

  /* The round's own rulebook, read live — the same `check(item)` the content gate
     runs, so an author and the gate can never disagree about what a valid question
     is. The message has to name the defect, not just refuse: "not complete" is
     exactly what this replaces. */
  await au.locator('#type-pick').selectOption('r:choice'); await au.waitForTimeout(500);
  check('a well formed question says so',
        /ready/i.test(await au.locator('#ed-verdict').innerText()),
        await au.locator('#ed-verdict').innerText());
  await au.locator('#ed-with').fill('zzz'); await au.waitForTimeout(400);
  check('and a broken one says what is wrong, in the round’s own words',
        /not one of the options/i.test(await au.locator('#ed-verdict').innerText()),
        (await au.locator('#ed-verdict').innerText()).replace(/\n/g,' | '));

  /* A round trip rather than a blank page: a category that already exists can be
     loaded, edited and exported back. The list asks the registry which clues are
     rounds, so a unit that gains one appears without this page being edited. */
  const cats = await au.locator('#q-load option').allInnerTexts();
  check('categories that already exist can be loaded',
        cats.filter(t => /\(\d+\)$/.test(t)).length >= 3, cats.join(' / '));
  const therm = cats.find(t => /Thermometer/.test(t));
  await au.locator('#q-load').selectOption({ label:therm }); await au.waitForTimeout(900);
  check('loading a category brings its questions and picks its type',
        await au.locator('#q-at').innerText() === '1 / 5' &&
        await au.locator('#type-pick').inputValue() === 'r:ordering',
        (await au.locator('#q-at').innerText()) + ' ' + (await au.locator('#type-pick').inputValue()));
  /* The editor has three fields and an ordering item has four things in it — the
     glosses have no field at all. Without carrying them forward, loading a category
     and saving it back would strip the teaching off every step, silently. A round
     trip that loses data is worse than no round trip. */
  check('and a round trip does not strip what the editor has no field for',
        await au.evaluate(() => Object.keys((bank[0].order || {}).gloss || {}).length) === 5,
        String(await au.evaluate(() => Object.keys((bank[0].order || {}).gloss || {}).length)));

  await au.locator('#q-next').click(); await au.waitForTimeout(600);
  await au.reload(); await au.waitForTimeout(1400);
  check('the set survives a reload — there is no save button to forget',
        await au.locator('#q-at').innerText() === '1 / 5' &&
        await au.locator('#type-pick').inputValue() === 'r:ordering',
        (await au.locator('#q-at').innerText()) + ' ' + (await au.locator('#type-pick').inputValue()));

  /* Out again as a Jeopardy category, because that is the one thing that can consume
     these today. Asserted on the shape a unit file actually needs — a `v` per clue
     and the round's own field — since a paste that does not parse is the whole
     feature failing quietly. */
  const dumped = await au.evaluate(() => exportText());
  check('and comes out as a category that drops straight into a unit',
        /\{v:100, q:/.test(dumped) && /\{v:500, q:/.test(dumped) &&
        /order:\{/.test(dumped) && /gloss/.test(dumped),
        dumped.split('\n').slice(2,4).join(' '));

  await au.evaluate(() => { try{ localStorage.removeItem('engishism.bench.bank'); }catch(e){} });
  checkClean(au, 'bench authoring');
  await au.close();

  /* Degradation, which every playground page owes: no relay leaves the card fully
     playable teacher-only. */
  const solo = await browser.newPage({ viewport:{ width:1280, height:900 } });
  solo.__errors = []; solo.on('pageerror', e => solo.__errors.push(String(e)));
  await solo.goto(BASE + '/playground/question-bench.html?relay=http://127.0.0.1:9');
  await solo.waitForTimeout(900);
/* Not showing a room, which is what "no relay" actually has to mean. The chip
     says `connecting…` first and settles on `phones off` only after the retries run
     out — a relay that is merely asleep is the common failure, so giving up in the
     first second was the wrong behaviour to pin. What the page owes with no relay is
     that it stays playable and never claims a room nobody can join. */
  check('no relay: the chip never shows a room code',
        !/\d{5}/.test(await solo.locator('#room-chip').innerText()),
        await solo.locator('#room-chip').innerText());
  /* And so does the button, which is the same fact and used to disagree with it.
     `addPhone` returns silently with no room, so an enabled button swallowed the
     click and nothing happened anywhere — reported as "I click add phone and no
     phone appears", which is exactly what it did, on the GitHub Pages copy where
     there is no relay behind the page at all. A control that cannot work says so. */
  check('and so does the + phone button, rather than swallowing the click',
        await solo.locator('#add-phone').isDisabled() &&
        /no relay|connecting/i.test(await solo.locator('#add-phone').innerText()),
        await solo.locator('#add-phone').innerText());
  check('but the card is still drawn',
        await solo.locator('#card-round .gword').count() === 8);
  // the answer, asked of the round rather than copied here — see the note above
  const soloPick = await solo.evaluate(() => Kit.round.get('grouping').sample.group.pick.slice());
  for(const w of soloPick){
    await solo.locator(`#card-round .gword[data-word="${w}"]`).click();
    await solo.waitForTimeout(70);
  }
  await solo.locator('#check-btn').click(); await solo.waitForTimeout(400);
  check('and the teacher can still answer it by clicking',
        await solo.locator('#card-round .gword.right').count() === 4,
        String(await solo.locator('#card-round .gword.right').count()));
  check('no errors without a relay', solo.__errors.length === 0, solo.__errors[0]);
  await solo.close();

  /* ---------- the other kind of question ----------
     A form is render-and-reveal and owns no phone dynamic, so the round furniture
     stands down rather than sitting there dead — a disabled Check button reads as
     broken. Driven over whatever `Kit.prompt` holds, so a form registered next
     month is covered without this check being edited. */
  const fp = await browser.newPage({ viewport:{ width:1400, height:950 } });
  fp.__errors = []; fp.on('pageerror', e => fp.__errors.push(String(e)));
  await fp.goto(BASE + '/playground/question-bench.html'); await fp.waitForTimeout(1200);
  const allForms = await fp.evaluate(() => window.HubKit.prompt.types());
  const drewAll = [];
  for(const t of allForms){
    await fp.locator('#type-pick').selectOption('f:' + t); await fp.waitForTimeout(320);
    drewAll.push(await fp.evaluate(t => ({
      type: t,
      /* The form draws into the prompt itself, which is what a game does — the form
         *is* the question's wording, so there is no second element to fill. */
      kids:   document.getElementById('card-prompt').children.length,
      round:  document.getElementById('card-round').children.length,
      check:  getComputedStyle(document.getElementById('check-btn')).display,
      third:  getComputedStyle(document.getElementById('ed-with')).display,
      strip:  getComputedStyle(document.getElementById('form-replies')).display
    }), t));
  }
  check('every form in the kit draws its sample on the bench card',
        drewAll.length > 0 && drewAll.every(r => r.kids > 0),
        JSON.stringify(drewAll.filter(r => !r.kids)));
  check('and leaves the round slot empty, which is the visible difference',
        drewAll.every(r => r.round === 0), JSON.stringify(drewAll.filter(r => r.round)));
  check('a form hides the round furniture rather than leaving it dead',
        drewAll.every(r => r.check === 'none' && r.third === 'none'),
        JSON.stringify(drewAll.filter(r => r.check !== 'none' || r.third !== 'none')));
  check('and shows where typed answers will land',
        drewAll.every(r => r.strip !== 'none'), JSON.stringify(drewAll.filter(r => r.strip === 'none')));

  /* The styling is the point of the move out of `hub.css`: a playground page cannot
     load that file, so before this the letters ran together as one line of text and
     the bench misreported the one thing it exists to show. */
  await fp.locator('#type-pick').selectOption('f:anagram'); await fp.waitForTimeout(350);
  const tiles = await fp.evaluate(() => {
    const t = document.querySelector('#card-prompt .prompt-tile');
    if(!t) return null;
    const cs = getComputedStyle(t);
    return { display:getComputedStyle(t.parentElement).display, border:cs.borderTopWidth };
  });
  check('a form is styled on the bench, not just drawn',
        !!tiles && tiles.display === 'flex' && parseFloat(tiles.border) >= 2,
        JSON.stringify(tiles));

  await fp.locator('#reveal-btn').click(); await fp.waitForTimeout(800);
  /* Whitespace-stripped, because an anagram's letters are one element each and
     `innerText` puts a newline between them — the answer is on the card as
     V·E·R·D·I·C·T, which is the form working, not failing. */
  const revealed = (await fp.locator('#card-prompt').innerText()).replace(/\s+/g, '');
  check('reveal lands the answer and the answer line stands down',
        await fp.evaluate(() => getComputedStyle(document.getElementById('card-answer')).display) === 'none' &&
        /verdict/i.test(revealed),
        revealed);

  /* The one failure a form has, and it is invisible without being said: a form that
     looks at a prompt, finds it is not shaped for it, and prints plain text. That is
     the intended behaviour and it is indistinguishable on screen from the type having
     done nothing — which is exactly how it gets reported as a bug. */
  await fp.locator('#type-pick').selectOption('f:oddoneout'); await fp.waitForTimeout(300);
  await fp.locator('#ed-q').fill('No slash separators anywhere in this one');
  await fp.waitForTimeout(350);
  check('a form that declines says so, rather than looking like it did nothing',
        /declined/i.test(await fp.locator('#ed-verdict').innerText()),
        await fp.locator('#ed-verdict').innerText());

  /* A bank calls the prompt `q` and the answer `a`, and neither a round nor a form
     has ever learned that. Exporting `answer:` would produce a category that loads
     without complaint and shows an empty answer line on every clue in it. */
  await fp.locator('#type-pick').selectOption('f:anagram'); await fp.waitForTimeout(350);
  const out = await fp.evaluate(() => {
    const old = window.prompt; window.prompt = () => 'Forms';
    let t = ''; try{ t = exportText(); }catch(e){ t = 'THREW ' + e.message; }
    window.prompt = old; return t;
  });
  check('a form exports in the bank’s own names, q and a',
        /\bq:/.test(out) && /\n\s+a:/.test(out) && !/answer:/.test(out), out.slice(0, 240));
  check('and carries the type, or the form would never draw in a game',
        /type:"anagram"/.test(out), out.slice(0, 240));
  check('no errors on the form path', fp.__errors.length === 0, fp.__errors[0]);
  await fp.close();
}

/* ---- the anagram round ----
   The first round grown out of a question *form*, and the first with a phone
   interaction the relay had never carried: `arrange`, where every handset drags
   the letters into boxes. What is worth checking is not the drag itself so much as
   the two things around it — that the form it grew out of still exists and still
   behaves as a form, and that duplicate letters work, since keying a tile by its
   text is what makes SENTENCE impossible to spell. */
async function testAnagramRound(browser){
  section('Jeopardy: the anagram round');

  const openLab = async (cats, opts) => {
    const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
    page.__errors = []; page.__console = [];
    page.on('pageerror', e => page.__errors.push(String(e)));
    page.on('console', m => {
      if (m.type() === 'error' && !/ERR_CONNECTION_RESET|fonts\.(googleapis|gstatic)/.test(m.text()))
        page.__console.push(m.text());
    });
    await page.goto(BASE + '/game-hub-lab.html');
    await page.waitForTimeout(400);
    await page.evaluate(p => {
      window.HubSettings.set('intro','off'); window.HubSettings.set('cardFlip','off');
      window.HubSettings.set('buzzers', !!p.phones);
      /* Off for the same reason the two above are: the standings cover the board
         between questions, and a check that plays a question and then clicks a tile
         finds the click intercepted by a modal it never asked for. The `standings`
         suite is where that screen is actually covered. */
      window.HubSettings.set('roundWinBanner', false);
    }, { phones: !!(opts||{}).phones });
    await page.getByText('Lab', { exact:false }).first().click();
    await page.waitForTimeout(220);
    await page.locator('h3:visible', { hasText:'Jeopardy' }).first().click();
    await page.waitForTimeout(220);
    for (const name of cats)
      await page.locator('#content-list label', { hasText:name }).first().locator('input').check();
    await page.waitForTimeout(150);
    await page.locator('#start-btn').click();
    await page.waitForTimeout(600);
    if (await page.locator('#intro-overlay.on').count()){
      await page.keyboard.press('Space'); await page.waitForTimeout(300);
    }
    return page;
  };
  const openTile = async (page, cat, row) => {
    const at = await page.evaluate(name => {
      const heads = [...document.querySelectorAll('#board .cat-header')];
      return { col: heads.findIndex(h => new RegExp(name,'i').test(h.textContent)), n: heads.length };
    }, cat);
    await page.locator('#board .tile').nth(at.n * row + at.col).click();
    await page.waitForTimeout(500);
  };

  /* Taking a round *closes the card itself* — the tile has been paid and there is
     nothing left to look at — so Close is only there when the clue is still open.
     Clicking it unconditionally is what hung the first run of this suite. */
  /* **Deliberately does not press Reveal.** An open round needs Reveal to end it, but
     on an *ordinary* clue Reveal swaps Close out for Correct/Wrong — so revealing here
     unconditionally left every plain card open, and the next tile click was
     intercepted by the modal. The one caller that needs the take beat presses Reveal
     itself, right where it is asserting the take. */
  const closeCard = async (page) => {
    if(await page.locator('#close-btn:visible').count()){
      await page.locator('#close-btn').click();
    }
    await page.waitForTimeout(450);
  };

  /* ---------- the engine hosts it without having learned anything ---------- */
  let page = await openLab(['Drag the Letters', 'Anagram', 'Gap Fill']);
  check('the Lab board offers the anagram round as its own category',
        await page.locator('#board .cat-header', { hasText:'Drag the Letters' }).count() === 1);

  await openTile(page, 'Drag the Letters', 0);          // $100 — VERDICT
  const tiles = await page.locator('#clue-card .ana-tile').count();
  const boxes = await page.locator('#clue-card .ana-box').count();
  check('a tile opens the round: a tray of letters and a box for each',
        tiles === 7 && boxes === 7, tiles + ' tiles, ' + boxes + ' boxes');
  /* The letters are scrambled, or it is not a puzzle. `setup` re-scrambles until it
     is not the word itself, which on a short word comes up often enough to matter. */
  const shown = (await page.locator('#clue-card .ana-tile').allInnerTexts()).join('');
  check('and they are scrambled rather than in order', shown !== 'VERDICT', shown);
  check('the clue is the definition, never the word',
        !/verdict/i.test(await page.locator('#clue-text').innerText()),
        await page.locator('#clue-text').innerText());

  /* ---------- the teacher's path, which every round owes ---------- */
  const clickLetters = async (word) => {
    const used = [];
    for(const ch of word){
      const at = await page.evaluate(([c, done]) => {
        const els = [...document.querySelectorAll('#clue-card .ana-tile')];
        return els.findIndex((e, i) => e.textContent === c && done.indexOf(i) === -1);
      }, [ch, used]);
      used.push(at);
      await page.locator('#clue-card .ana-tile').nth(at).click();
      await page.waitForTimeout(90);
    }
  };
  await clickLetters('VERDICT');
  check('the teacher can spell it by clicking, with no relay at all',
        await page.locator('#clue-card .ana-box.filled').count() === 7,
        String(await page.locator('#clue-card .ana-box.filled').count()));
  const before = (await page.locator('.team .score').allInnerTexts())[0];
  await page.locator('#group-btn').click(); await page.waitForTimeout(1500);
  /* **The card holds until the teacher closes it, and Close is what pays.** A won
     round used to flip away within a second of the letters landing, which left the
     room with no answer on screen and no idea who took it. So the payout is read
     after the close, not before it. */
  check('a won round waits, with the answer and the winner still up',
        await page.locator('#clue-card .ana-box.right').count() === 7 &&
        /^Close — .+ takes it$/.test((await page.locator('#close-btn').innerText()).trim()),
        (await page.locator('#close-btn').innerText()).trim());
  await closeCard(page);
  const after = (await page.locator('.team .score').allInnerTexts())[0];
  check('and a correct arrangement pays the tile',
        before !== after, before + ' -> ' + after);

  /* ---------- duplicate letters, which is what this round is built around ----------
     SENTENCE has three Es and two Ns. Keyed by text — which is how every other
     pick in this app works — the first E would stand for all three and the word
     could never be assembled. The card gives each tile a token instead. */
  await openTile(page, 'Drag the Letters', 3);          // $400 — SENTENCE
  const dup = await page.locator('#clue-card .ana-tile').allInnerTexts();
  check('a word with repeated letters puts a tile out for each one',
        dup.filter(c => c === 'E').length === 3 && dup.length === 8,
        dup.join(''));
  await clickLetters('SENTENCE');
  const filled = await page.locator('#clue-card .ana-box').allInnerTexts();
  check('and all three can be placed independently',
        filled.join('') === 'SENTENCE', filled.join(''));
  /* Asserted on the payout, which now lands on the Close press rather than on the
     check — a won round holds the card up until the teacher takes it down. */
  const dupBefore = (await page.locator('.team .score').allInnerTexts())[0];
  await page.locator('#group-btn').click(); await page.waitForTimeout(1500);
  await closeCard(page);
  check('so a repeated-letter word can actually be answered, and pays',
        (await page.locator('.team .score').allInnerTexts())[0] !== dupBefore,
        dupBefore + ' -> ' + (await page.locator('.team .score').allInnerTexts())[0]);

  /* A wrong arrangement says how close it was, which is the only useful thing to
     say about one — "four of seven are in the right place" is actionable. */
  await closeCard(page);
  await openTile(page, 'Drag the Letters', 1);          // $200 — BAIL
  await clickLetters('BALI');
  await page.locator('#group-btn').click(); await page.waitForTimeout(600);
  check('a wrong arrangement is told how many letters are in place',
        /letters are in the right place/i.test(
          await page.locator('#clue-card .group-say').innerText().catch(()=>'')),
        await page.locator('#clue-card .group-say').innerText().catch(()=>'—'));

  /* ---------- the form it grew out of is untouched ----------
     A round claiming `type:'anagram'` would have silently converted the eight items
     already authored in Units 4 and 5, which is the one thing a new round must
     never do. The two are keyed by different fields and both are on this board. */
  await closeCard(page);
  await openTile(page, 'Anagram', 0);
  check('the anagram *form* still draws as a form, not as the round',
        await page.locator('#clue-card .prompt-tile').count() > 0 &&
        await page.locator('#clue-card .ana-box').count() === 0,
        (await page.locator('#clue-card .prompt-tile').count()) + ' form tiles, ' +
        (await page.locator('#clue-card .ana-box').count()) + ' round boxes');
  checkClean(page, 'lab board');
  await page.close();

  /* ---------- the card fits, at both sizes ----------
     Neither `fit` nor `phone` opens a clue card, so a tray running off the edge
     would pass both of them. */
  for(const vp of [{ width:1280, height:720 }, { width:390, height:844 }]){
    const p2 = await openLab(['Drag the Letters', 'Anagram', 'Gap Fill']);
    await p2.setViewportSize(vp); await p2.waitForTimeout(400);
    await openTile(p2, 'Drag the Letters', 2);          // $300 — SABBATICAL, ten letters
    const box = await p2.evaluate(() => {
      const c = document.getElementById('clue-card').getBoundingClientRect();
      const els = [...document.querySelectorAll('#clue-card .ana-tile, #clue-card .ana-box')];
      return {
        right: Math.max(...els.map(e => e.getBoundingClientRect().right)),
        bottom: Math.max(...els.map(e => e.getBoundingClientRect().bottom)),
        cr: c.right, cb: c.bottom, w: window.innerWidth, h: window.innerHeight
      };
    });
    check('the tray and boxes stay inside the card at ' + vp.width + 'x' + vp.height,
          box.right <= box.cr + 1 && box.bottom <= box.cb + 1, JSON.stringify(box));
    check('and the card stays on screen at ' + vp.width + 'x' + vp.height,
          box.cr <= box.w + 1 && box.cb <= box.h + 1, JSON.stringify(box));
    await p2.close();
  }

  /* ---------- the room, which is the whole reason this is a round ---------- */
  const live = await openLab(['Drag the Letters', 'Anagram', 'Gap Fill'], { phones:true });
  const code = ((await live.locator('#buzzer-chip').innerText().catch(()=>'')).match(/CODE\s+(\d{5})/i)||[])[1];
  check('the board opens a room for it', !!code,
        await live.locator('#buzzer-chip').innerText().catch(()=>'—'));
  if(code){
    await live.evaluate(() => window.HubSettings.set('round_default','buzz'));
    const ph = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
    ph.__errors = []; ph.on('pageerror', e => ph.__errors.push(String(e)));
    await ph.goto(BASE + '/join.html?code=' + code + '&name=Ana&team=0&auto=1');
    await ph.waitForTimeout(700);
    await openTile(live, 'Drag the Letters', 0);        // VERDICT
    await ph.waitForTimeout(900);

    /* The round drives the handsets itself through `phoneRound()`, so the mode the
       teacher happens to have set is overridden — exactly as Bingo's cards are. */
    check('the round puts every handset into the drag puzzle, whatever the phone mode is',
          await ph.locator('.ana-tile').count() === 7 &&
          await ph.locator('.ana-slot').count() === 7,
          (await ph.locator('.ana-tile').count()) + ' tiles, ' +
          (await ph.locator('.ana-slot').count()) + ' slots');
    /* **One row each, whatever the word's length.** A fixed minimum width wrapped
       seven letters to six-and-one on a 390px handset, which reads as a mistake
       rather than as a word — and the stray box on its own line is where a thumb
       aims first. Asserted on the *rows*, not the widths: the tiles are allowed to
       shrink, and a ten-letter word at 29px is the intended answer rather than a
       failure. Checked here at seven, and the ladder of lengths lives on the Lab
       board ($300 is ten letters). */
    const rowsOf = await ph.evaluate(() => {
      const tops = sel => new Set([...document.querySelectorAll(sel)]
        .map(e => Math.round(e.getBoundingClientRect().top))).size;
      const all = [...document.querySelectorAll('.ana-slot,.ana-tile')];
      return { slots: tops('.ana-slot'), tiles: tops('.ana-tile'),
               right: Math.max(...all.map(e => e.getBoundingClientRect().right)),
               vw: window.innerWidth };
    });
    check('the whole word stays on one row on a handset, boxes and tray alike',
          rowsOf.slots === 1 && rowsOf.tiles === 1, JSON.stringify(rowsOf));
    check('and nothing runs off the right edge',
          rowsOf.right <= rowsOf.vw + 1, JSON.stringify(rowsOf));

    const handTray = (await ph.locator('#ana-tray').innerText()).replace(/\s/g,'');
    const cardTray = (await live.locator('#clue-card .ana-tile').allInnerTexts()).join('');
    check('and the tray in the hand is the tray on the wall, in the same order',
          handTray === cardTray, handTray + ' vs ' + cardTray);

    /* Read off the card rather than out of the engine: the round's state is a
       closure variable and exposing one for a test would be the test changing the
       thing it measures. The answer line carries the word (hidden until reveal) and
       the tray *is* the pool. */
    const word = (await live.locator('#clue-answer').innerText()).trim().toUpperCase();
    const pool = await live.locator('#clue-card .ana-tile').allInnerTexts();
    const drag = async (ti, si) => {
      const t = await ph.locator('.ana-tile').nth(ti).boundingBox();
      const s = await ph.locator('.ana-slot').nth(si).boundingBox();
      await ph.mouse.move(t.x + t.width/2, t.y + t.height/2);
      await ph.mouse.down();
      await ph.mouse.move(s.x + s.width/2, s.y + s.height/2, { steps:8 });
      await ph.mouse.up();
      await ph.waitForTimeout(180);
    };
    /* A wrongly placed letter must never reach the projector — the lane is the
       answer populating, not the team's spelling attempts. Probed before the
       correct letters go in, then taken back out (a tap on a full box empties). */
    const wrongIdx = pool.findIndex(c => c !== word[0]);
    await drag(wrongIdx, 0);
    await live.waitForTimeout(800);
    check('a wrong placement lights nothing on the card',
          await live.evaluate(() => {
            const minis = [...document.querySelectorAll('#clue-card .rlane .rl-cell')];
            return minis.length > 0 && minis.every(m => !m.textContent.trim());
          }));
    await ph.locator('#ana-slots .ana-slot').first().click();
    await ph.waitForTimeout(300);

    const used = [];
    for(let i = 0; i < 3; i++){
      const idx = pool.findIndex((c, j) => c === word[i] && used.indexOf(j) === -1);
      used.push(idx); await drag(idx, i);
    }
    await live.waitForTimeout(900);
    check('dragging on the handset moves the letter into the box',
          (await ph.locator('#ana-slots').innerText()).replace(/\s/g,'') === word.slice(0,3),
          (await ph.locator('#ana-slots').innerText()).replace(/\s/g,''));
    /* The lane is the answer populating: the three correctly placed letters show
       in their own positions, the rest stay blank. The first live class saw each
       team's furthest *attempt* instead — several half-wrong sequences at once, a
       wall of jumbled words — and the rule that replaced it is that only a
       correctly positioned letter ever reaches the projector. */
    check('and the board shows how far that team has got',
          /3 of \d/i.test(await live.locator('#clue-card .rlanes').innerText().catch(()=>'')),
          (await live.locator('#clue-card .rlanes').innerText().catch(()=>'—')).replace(/\n/g,' '));
    check('as the correctly placed letters, in place, and nothing else',
          await live.evaluate(w => {
            const lane = document.querySelector('#clue-card .rlane');
            const txt = lane ? [...lane.querySelectorAll('.rl-cell')].map(m => m.textContent.trim()) : [];
            return txt.length > 0 &&
                   txt.slice(0, 3).join('') === w.slice(0, 3) &&
                   txt.slice(3).every(x => !x);
          }, word));

    /* A tap fills the next empty box. Not a nicety: dragging on a phone misses, and
       a letter that will not move because the thumb travelled four pixels reads as
       a broken round. */
    const tapIdx = pool.findIndex((c, j) => c === word[3] && used.indexOf(j) === -1);
    used.push(tapIdx);
    const tb = await ph.locator('.ana-tile').nth(tapIdx).boundingBox();
    await ph.mouse.click(tb.x + tb.width/2, tb.y + tb.height/2);
    await ph.waitForTimeout(400);
    check('a tap fills the next empty box, for a thumb that misses',
          (await ph.locator('#ana-slots').innerText()).replace(/\s/g,'') === word.slice(0,4),
          (await ph.locator('#ana-slots').innerText()).replace(/\s/g,''));

    const scoreBefore = (await live.locator('.team .score').allInnerTexts())[0];
    for(let i = 4; i < word.length; i++){
      const idx = pool.findIndex((c, j) => c === word[i] && used.indexOf(j) === -1);
      used.push(idx); await drag(idx, i);
    }
    await live.waitForTimeout(1600);
    /* The question is held open for the rest of the room, so Reveal is what ends it;
       the Close button names who it pays only once it has. */
    if(await live.locator('#reveal-btn:visible').count()){
      await live.locator('#reveal-btn').click();
      await live.waitForTimeout(800);
    }
    check('finishing the word holds the card up for the room to read',
          /^Close — .+ takes it$/.test((await live.locator('#close-btn').innerText()).trim()),
          (await live.locator('#close-btn').innerText()).trim());
    await closeCard(live);
    check('finishing the word takes the tile and scores it',
          (await live.locator('.team .score').allInnerTexts())[0] !== scoreBefore,
          scoreBefore + ' -> ' + (await live.locator('.team .score').allInnerTexts())[0]);
    check('phone had no errors', ph.__errors.length === 0, ph.__errors[0]);
    await ph.close();
  }
  checkClean(live, 'live lab board');
  await live.close();

  /* ---------- what the round says about a bad item ----------
     Read straight off the registry, which is the same `check` the content gate and
     the bench editor run — one rulebook, so an author and the gate can never
     disagree about what a valid question is. */
  const audit = await browser.newPage();
  await audit.goto(BASE + '/playground/question-bench.html'); await audit.waitForTimeout(900);
  const said = await audit.evaluate(() => {
    const r = window.HubKit.round.get('anagram');
    return {
      giveaway: r.check({ text:'the verdict a jury delivers', anagram:{ word:'verdict' } }),
      tooLong:  r.check({ text:'a long one', anagram:{ word:'incomprehensible' } }),
      spaces:   r.check({ text:'two words', anagram:{ word:'not guilty' } }),
      noClue:   r.check({ text:'', anagram:{ word:'verdict' } }),
      fine:     r.check({ text:'the decision a jury delivers', anagram:{ word:'verdict' } })
    };
  });
  check('a clue containing its own answer is called out',
        /gives it away/i.test((said.giveaway||[]).join(' ')), JSON.stringify(said.giveaway));
  check('a word longer than a handset can arrange is called out',
        /most a handset/i.test((said.tooLong||[]).join(' ')), JSON.stringify(said.tooLong));
  check('a word with a space in it is called out',
        /cannot be a tile/i.test((said.spaces||[]).join(' ')), JSON.stringify(said.spaces));
  check('an anagram with no clue is called out',
        /needs a clue/i.test((said.noClue||[]).join(' ')), JSON.stringify(said.noClue));
  check('and a good one says nothing at all', (said.fine||[]).length === 0, JSON.stringify(said.fine));
  await audit.close();
}

/* ---- the question forms ----
   A form is the smaller of the two kinds of question: render and reveal, no time,
   no turns, no phones. It used to have a page of its own — `prompt-lab.html`,
   retired once the question bench grew the same menu — so what is left here is the
   part that was never about that page: the **isolation** between a form that has
   graduated into the kit and one that has not, and the **portability** of an
   experimental form into a real game. Plus the one thing on the bench a round has
   no equivalent for: a form's replies, typed and judged. */
async function testQuestionForms(browser){
  section('The question forms: isolation, portability, the room');
  const page = await browser.newPage({ viewport:{ width:1400, height:950 } });
  page.__errors = []; page.on('pageerror', e => page.__errors.push(String(e)));
  await page.goto(BASE + '/playground/question-bench.html'); await page.waitForTimeout(1100);

  /* ---- the two stages, asked rather than named ----
     A form written in the lab file must NOT be able to reach a game: a game loads
     hub-kit.js and never loads `lab-forms.js`, so an experimental form exists only
     on the bench until its registration is *moved* into the kit — which is what
     graduating means, and it is a file move rather than a rewrite.

     This used to name `bridge` as the experimental one, and the day it graduated
     the check failed for the right reason with the wrong message — the same "a
     literal list is a photograph of what existed when the line was written" bug
     the game registry keeps paying for, met in a test. So it derives the two sets:
     whatever the bench registers beyond what a hub page holds is experimental by
     definition, and none of it may be reachable from a game. */
  const hub = await openHub(browser);
  const hubForms = await hub.evaluate(() => window.HubKit.prompt.types());
  const benchForms = await page.evaluate(() => window.HubKit.prompt.types());
  const labOnlyForms = benchForms.filter(t => hubForms.indexOf(t) === -1);
  check('the bench is holding at least one experimental form to isolate',
        labOnlyForms.length > 0, labOnlyForms.join(',') || 'none');
  check('and no experimental form can reach a game',
        labOnlyForms.every(t => hubForms.indexOf(t) === -1),
        'kit: ' + hubForms.join(',') + ' | lab-only: ' + labOnlyForms.join(','));

  /* ---- compatibility, proved rather than intended ----
     Every experimental form must be portable into the hub the day it is written,
     or "we'll graduate it later" is a promise nobody checked. So the whole forms
     file is dropped into a real hub page and each form is asked to draw on a
     **live Jeopardy clue card** — the element a graduated form would actually
     render into. Driven by what the file registers, so a form added to
     lab-forms.js next month is covered without this check being edited, and one
     that quietly depends on something only the bench has fails immediately. */
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
  check('every experimental form is registered by the file the bench loads',
        port.length >= 2, JSON.stringify(port.map(p=>p.type)));
  port.forEach(r => {
    check('\u201c' + r.type + '\u201d draws on a real clue card, so it is portable today',
          r.drawn === r.type && r.built > 0, JSON.stringify(r));
    check('and answers itself there', r.ms > 0, JSON.stringify(r));
  });

  /* ---- which boards a form suits ----
     The form's own declaration, read rather than restated. Not every form survives
     every board — an anagram in Millionaire is given away by its four options, an
     odd one out in Race by the board — and an author who cannot see that writes a
     question that cannot work where they meant to use it. */
  await page.locator('#type-pick').selectOption('f:bridge'); await page.waitForTimeout(300);
  check('picking a form draws its sample at board size',
        await page.locator('#card-prompt .prompt-link').count() === 3,
        String(await page.locator('#card-prompt .prompt-link').count()));
  check('and says which boards it suits',
        /every board/i.test(await page.locator('#suits').innerText()),
        await page.locator('#suits').innerText());
  await page.locator('#type-pick').selectOption('f:anagram'); await page.waitForTimeout(300);
  check('a form that suits only some boards names them, rather than claiming all',
        /jeopardy/i.test(await page.locator('#suits').innerText()) &&
        !/every board/i.test(await page.locator('#suits').innerText()),
        await page.locator('#suits').innerText());
  check('and a lab-only form says no game can draw it yet',
        await (async ()=>{
          await page.locator('#type-pick').selectOption('f:' + labOnlyForms[0]);
          await page.waitForTimeout(300);
          return /lab only/i.test(await page.locator('#suits').innerText());
        })(),
        await page.locator('#suits').innerText());

  await page.locator('#type-pick').selectOption('f:bridge'); await page.waitForTimeout(300);
  check('the answer is not on screen before it is revealed',
        !/\bwork\b/i.test(await page.locator('#card-prompt').innerText()),
        await page.locator('#card-prompt').innerText());

  /* ---- the room ----
     A form owns no phone dynamic — that is what makes it a form — so the bench
     supplies the only one that suits any question at all: everyone types, judged
     on the host by `Kit.answer.judge` exactly as a game judges it. The relay never
     learns the answer, so it can never be asked for it. */
  const chip = await page.locator('#room-chip').innerText();
  const code = (chip.match(/(\d{5})/)||[])[1];
  check('the bench opens a room for a form as well as for a round', !!code, chip);
  if(code){
    const ph = await browser.newPage({ viewport:{ width:390, height:844 } });
    ph.__errors = []; ph.on('pageerror', e => ph.__errors.push(String(e)));
    await ph.goto(BASE + '/join.html?code=' + code + '&name=Ana&team=0&auto=1');
    await ph.waitForTimeout(800);
    await page.locator('#ask-btn').click(); await ph.waitForTimeout(900);
    check('asking the room puts the form\u2019s question on the handset',
          /FIRE/i.test(await ph.locator('#qtext').innerText()),
          await ph.locator('#qtext').innerText());
    await ph.fill('#reply', 'work');
    await ph.locator('#send').click(); await page.waitForTimeout(900);
    check('and the typed answer comes back judged, by name',
          /ana/i.test(await page.locator('#reply-list').innerText()) &&
          /right/.test(await page.locator('#reply-list').innerText()),
          await page.locator('#reply-list').innerText());
    /* Three verdicts, not two: "produced the word but mis-spelled it" is a
       different fact about a student from "did not know it", and the bench has to
       be *wired* to `Kit.answer.judge` to say so — `BenchKit.judge` once reached
       for a global that did not exist and fell silently through to an exact match,
       downgrading every near miss to a flat wrong.

       On `anagram`, whose answer is seven letters: tolerance scales with length and
       is **zero under five**, so no misspelling of the bridge's four-letter `work`
       could ever come back `close`. Re-asked first, because an `answer` round is
       one reply per phone — the handset is spent until the room is asked again,
       which is the mode working rather than a fault. */
    await page.locator('#type-pick').selectOption('f:anagram'); await page.waitForTimeout(400);
    await page.locator('#ask-btn').click(); await ph.waitForTimeout(900);
    await ph.fill('#reply', 'verdct');
    await ph.locator('#send').click(); await page.waitForTimeout(900);
    check('a near miss is its own verdict, not a flat wrong',
          /close|nearly/i.test(await page.locator('#reply-list').innerText()),
          await page.locator('#reply-list').innerText());
    check('phone had no errors', ph.__errors.length === 0, ph.__errors[0]);
    await ph.close();
  }
  check('bench had no errors', page.__errors.length === 0, page.__errors[0]);
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

  /* ---- a racked phone is a real handset, scaled ----
     The board renders at a projector's logical 1280 and is scaled to the pane,
     because a board re-fitting itself to a 500px pane is not the board under
     test. The phones were laid out at the rack column's width instead — 264px,
     leaving join.html 220px for its options, under the 288px two columns need. So
     a sixteen-word vote appeared here as one long scrolling list while every real
     handset showed two columns: the bench misreporting the one thing it exists to
     show. Asserted on the *inner* width and the resulting layout, not on the card,
     since it is the page inside that has to be a phone. */
  const rack = await bench.frameLocator('.phone iframe').first().locator('#opts').evaluate(o => ({
    inner: window.innerWidth,
    cols: getComputedStyle(o).gridTemplateColumns.split(' ').length,
    opts: o.querySelectorAll('button').length,
    scrolls: o.scrollHeight > o.clientHeight + 1,
    offscreen: [...o.querySelectorAll('button')]
      .filter(x => x.getBoundingClientRect().bottom > window.innerHeight + 1).length
  }));
  check('a racked phone lays out at a real handset width, not the rack column\'s',
        rack.inner === 390, JSON.stringify(rack));
  check('so the sixteen words come out in two columns here too, without scrolling',
        rack.opts === 16 && rack.cols === 2 && !rack.scrolls && rack.offscreen === 0,
        JSON.stringify(rack));

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
    w.HubSettings.set('round_default','buzz','jeopardy');
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
  /* **Whatever the tile put in their hand**, not a buzzer specifically. This clicked
     `#buzzer` and had been throwing on it since Units 4 and 5 became all-rounds — a
     round arms the handsets itself, so the button is there but disabled and hidden
     behind the round's own controls. What the bench exists to prove is that a tap on
     a racked phone reaches the board it is sitting next to, and that is true of
     either dynamic; which one is on screen is the board's business. */
  const benchPhone = hub.frameLocator('.phone iframe').first();
  const roundOpt = benchPhone.locator('#opts button').first();
  if (await roundOpt.count()) await roundOpt.click();
  else await benchPhone.locator('#buzzer').click();
  await hub.waitForTimeout(1200);
  check('a tap from a bench phone reaches the hub board',
        /ana/i.test(await textOf(hubFrame.locator('#phone-bar'))),
        (await textOf(hubFrame.locator('#phone-bar'))).replace(/\n/g,' ') || '(empty)');

  /* ---- a room of individuals has no rows ----
     Reported from the bench: switching the board to solo left the rack drawing team
     headers, so a header reading "Ana" sat over a row holding Ana, Ben and Carla.
     The roster is people in solo, so the board's "team names" *are* names — the rack
     has to read the room's `solo` flag rather than infer anything from the list.

     Driven as a switch under a live rack rather than by opening the bench into solo,
     because that is the case with something to lose: the flattening is done with
     `display:contents` precisely so no iframe is re-parented, and re-parenting one
     reloads it and drops its stream. The marks are how that is proved — a reloaded
     frame comes back without one. */
  const rackShape = () => hub.evaluate(() => {
    const ph = [...document.querySelectorAll('.phone')];
    const rows = {};
    ph.forEach(p => { const t = Math.round(p.getBoundingClientRect().top);
                      rows[t] = (rows[t] || 0) + 1; });
    return { display: getComputedStyle(document.getElementById('rack')).display,
             heads: [...document.querySelectorAll('.team-col h2')]
                      .filter(h => getComputedStyle(h).display !== 'none').length,
             rows: Object.keys(rows).length, phones: ph.length };
  });
  /* **The second phone goes on a different side, and that is what makes the round-trip
     checks mean anything.** With both handsets on team 0 a scrambled restore still
     lands them both on team 0, so the assertion passes on the broken build — which it
     did, until this line. A test that cannot fail on its bug is not yet a test. */
  await hub.locator('#team-pick').selectOption('1');
  await hub.locator('#add').click(); await hub.waitForTimeout(1200);
  const teamShape = await rackShape();
  check('in teams the rack draws a row per team, headed',
        teamShape.heads >= 1, JSON.stringify(teamShape));
  let marked = 0;
  for (const f of hub.frames().filter(f => /join\.html/.test(f.url())))
    await f.evaluate(i => { window.__benchMark = i; }, marked++);

  /* Read off the handsets rather than off the host, because the host's own record of
     a player's team is deliberately stale (`seat` does not come back to it) — which
     is exactly what made the first attempt at the fix below do nothing at all. */
  const pills = async () => {
    const out = [];
    for (const f of hub.frames().filter(f => /join\.html/.test(f.url())))
      out.push((await f.locator('#who').innerText().catch(()=>'?')).replace(/\s+/g,' ').trim());
    return out;
  };
  const beforeSolo = await pills();
  check('in teams each handset carries its own side',
        beforeSolo.length > 0 && beforeSolo.every(p => /team \d/i.test(p)),
        JSON.stringify(beforeSolo));

  await hub.evaluate(() => document.getElementById('stage-frame')
                             .contentWindow.HubSettings.set('roster','solo'));
  // the bench re-reads the room on a 4s poll; wait for the shape rather than guess
  await until(async () => (await rackShape()).heads === 0, 12000);
  const soloShape = await rackShape();
  check('in solo it flattens to one grid with no team headers at all',
        soloShape.heads === 0 && soloShape.display === 'grid' &&
        soloShape.rows === 1 && soloShape.phones === teamShape.phones,
        JSON.stringify(soloShape));
  check('and the team picker goes with them — there is nothing to pick',
        !(await hub.locator('#team-pick').isVisible()));
  const marks = [];
  for (const f of hub.frames().filter(f => /join\.html/.test(f.url())))
    marks.push(await f.evaluate(() => window.__benchMark).catch(()=>null));
  check('no phone was re-parented, so every stream survived the switch',
        marks.length === marked && marks.every(m => m != null),
        JSON.stringify(marks));

  /* ---- and the way back puts everybody where they were ----
     **The worst kind of bug this project has had: silent, and it scores for the
     wrong side.** Solo seats every handset into its own competitor, which overwrites
     the team its student chose. Coming back to teams left each phone holding that
     *index*, now pointing at whatever team sits there — four phones went 1/1/2/2 →
     solo → 2/3/4/1 with nothing on any screen saying so.

     Read off the handsets rather than off the host, because the host's own record of
     a player's team is deliberately stale (`seat` does not come back to it) — which
     is exactly what made the first attempt at the fix do nothing. */
  /* No *team name* in a room of individuals — there are no sides to be on. A
     colour is a different fact now: since the identity-chip work each solo phone
     wears its competitor's own colour (join.html's paintWho sets `--team` in
     both rooms), so asserting an empty `--team` pinned the pre-change picture
     and this check could never pass again. The tag is the rule that survives. */
  check('in solo a handset carries no side at all',
        (await pills()).every(p => !/team \d/i.test(p)),
        JSON.stringify(await pills()));

  /* **The roster follows the phones in solo, both ways.** It only ever grew: a phone
     that left kept its row, which is right for a student whose battery dies and wrong
     as a general rule — seven handsets on the bench, five removed, and the board still
     listed everybody. What the original rule protects is a *score*, so that is what it
     keeps now; a competitor who never scored goes with the phone. */
  const barRows = () => hub.evaluate(() => document.getElementById('stage-frame')
                                             .contentWindow.HubTeams.count());
  const soloWas  = await barRows();
  const nameOf   = () => hub.locator('.phone .head b').allInnerTexts();
  const hadNames = await nameOf();
  await hub.locator('#add').click();
  await until(async () => await barRows() === soloWas + 1, 12000);
  check('a phone joining in solo adds a competitor to the bar',
        await barRows() === soloWas + 1, soloWas + ' → ' + await barRows());
  /* **Remove the one just added, by name.** Neither `first()` nor `last()` finds it:
     in solo the rack is flattened with `display:contents`, so DOM order still follows
     the team columns the phones were added under and the newest card is in the middle.
     Removing somebody else leaves a different set of handsets for the round-trip
     checks below, which then compare two different rooms. */
  const added = (await nameOf()).find(n => hadNames.indexOf(n) === -1);
  await hub.locator('.phone').filter({ hasText: added }).locator('.head button').click();
  /* **It waits for the question to end, and the wait is the point.** A competitor's
     index is its identity in a live round's per-team state — the ladders, the picks,
     the agreement counts — so closing the gap under an open question hands one
     student's ladder to whoever sat below them. Scores are safe either way (they ride
     the competitor and move with it, and a scored competitor is never dropped), but
     the round's own state does not move, so the tidy-up waits for the moment that
     state stops existing. A card is open here, left up by the buzz check above. */
  await hub.waitForTimeout(2500);
  check('a phone leaving mid-question keeps its row until the question is over',
        await barRows() === soloWas + 1, soloWas + 1 + ' → ' + await barRows());
  const pressInStage = id => hub.evaluate(which => {
    const w = document.getElementById('stage-frame').contentWindow;
    const b = w.document.getElementById(which);
    if(b && b.offsetParent !== null){ b.click(); return true; }
    return false;
  }, id);
  await pressInStage('reveal-btn');
  await hub.waitForTimeout(700);
  for(const id of ['close-btn','wrong-btn','skip-btn']) if(await pressInStage(id)) break;
  await until(async () => await barRows() === soloWas, 12000);
  check('and removing one takes it away again, once the card is down',
        await barRows() === soloWas, soloWas + 1 + ' → ' + await barRows());

  await hub.evaluate(() => document.getElementById('stage-frame')
                             .contentWindow.HubSettings.set('roster','teams'));
  await until(async () => (await pills()).every(p => /team \d/i.test(p)), 12000);
  check('and coming back from solo puts every handset on the side it started on',
        JSON.stringify(await pills()) === JSON.stringify(beforeSolo),
        JSON.stringify(await pills()) + ' · started ' + JSON.stringify(beforeSolo));

  /* **A second round trip, because the first one passing is not the same as the
     mechanism being right.** Reported as "flip back and forth and eventually they
     all turn blue", and it was true: one trip worked and the next left every handset
     on Team 1. Three wrong diagnoses went by before the cause turned up on the
     *handset* — it zeroed its own team on the way into solo, so the relay, which only
     tells a phone its team when its own record changes, had nothing to say when the
     board restored it. One trip cannot see that; two can. */
  for (const mode of ['solo','teams'])
    await hub.evaluate(m => document.getElementById('stage-frame')
                              .contentWindow.HubSettings.set('roster', m), mode);
  await until(async () => (await pills()).every(p => /team \d/i.test(p)), 12000);
  check('and it still holds after flipping again — the record is not re-derived',
        JSON.stringify(await pills()) === JSON.stringify(beforeSolo),
        JSON.stringify(await pills()) + ' · started ' + JSON.stringify(beforeSolo));

  /* **The bench and the board must agree about how many teams there are**, in both
     directions. `HubTeams.ensure` only grew, so 4×4 then 3×3 left the board on four
     while the rack drew three — the bench disagreeing with the board it exists to
     mirror. Driven through the preset buttons rather than by calling `size` directly,
     because the wiring between them is the thing that was broken. */
  /* Out of the game first, because refusing to shrink *while one is running* is the
     rule rather than a fault — a team can be holding points somebody earned. Setting
     the room up is something you do between games, which is where this belongs. */
  await hub.frameLocator('#stage-frame').locator('#new-game-btn').click();
  await hub.waitForTimeout(600);
  /* And wait for the *bench* to know the room is back in teams. It re-reads the room
     on a 4s poll, and in solo a preset is deliberately a head count rather than a
     division — so pressing one too early tests the other branch and reads as a
     failure of this one. */
  await until(async () => !/individuals/.test(await textOf(hub.locator('#status'))), 12000);
  const boardTeams = () => hub.evaluate(() => document.getElementById('stage-frame')
                                                .contentWindow.HubTeams.count());
  const rackCols   = () => hub.evaluate(() => document.querySelectorAll('.team-col').length);
  const agreed = [];
  for (const [label, want] of [['3×3', 3], ['2×2', 2], ['4×4', 4]]){
    await hub.locator('#bar-layouts button', { hasText: label }).click();
    await until(async () => await boardTeams() === want, 15000);
    agreed.push(label + ':' + (await boardTeams()) + '/' + (await rackCols()));
  }
  check('a classroom-division preset sets the board’s team count exactly, both ways',
        agreed.join(' ') === '3×3:3/3 2×2:2/2 4×4:4/4', agreed.join(' '));

  /* ---- the tune pane: the rules board beside the board ----
     The rows are the board's own settings rows rendered through the frame
     (`renderOnce`, the HubTeams reach-in pattern), so a row here and a row in
     the ⚙ drawer cannot disagree. What the pane itself owes: an edit is a real
     per-game override, and the state line tells a default from a customization. */
  /* A tab per registered game **plus the All-games master tab** — the pane has
     rendered ids+1 since the day it existed (the same shape as the ⚙ drawer),
     and the first cut of this check counted ids alone, so it was born red and
     never once able to pass. The master tab is asserted by name so a count that
     drifts is told apart from a master tab that vanished. */
  check('the tune pane is open with a tab per registered game',
        await hub.locator('#tune-pane').isVisible() &&
        /all games/i.test((await hub.locator('#tune-tabs button').allInnerTexts())[0] || '') &&
        await hub.locator('#tune-tabs button').count() ===
          await hub.evaluate(() => document.getElementById('stage-frame')
                                    .contentWindow.HubGames.ids().length) + 1,
        (await hub.locator('#tune-tabs button').allInnerTexts()).join(' '));
  await until(async () =>
    await hub.locator('#tune-body [data-setting="round_anagram"]').count() === 1, 8000);
  const tuneRow = hub.locator('#tune-body [data-setting="round_anagram"]')
    .locator('xpath=ancestor::div[contains(@class,"settings-row")]');
  await hub.locator('#tune-body [data-setting="round_anagram"]').selectOption('first');
  await hub.waitForTimeout(700);
  const overrideNow = () => hub.evaluate(() =>
    JSON.parse(localStorage.getItem('engishism.gamehub.settings') || '{}')['round_anagram@jeopardy']);
  check('an edit in the pane is a real per-game override', await overrideNow() === 'first',
        String(await overrideNow()));
  check('and its state line says so',
        /set for this game/i.test(await tuneRow.locator('.settings-state').innerText()),
        await tuneRow.locator('.settings-state').innerText());
  await tuneRow.locator('.settings-undo').click();
  await hub.waitForTimeout(700);
  check('reset puts the game back on its default', await overrideNow() === undefined,
        String(await overrideNow()));

  check('the hub bench had no errors', hub.__errors.length === 0, hub.__errors[0]);
  await hub.close();

  /* ---- the bench must not take a live lesson's room ----
     **A teaching hub remembers its room code per device for six hours**, on purpose:
     reloading the page is the first thing anyone does when something looks wrong, and
     without the memory a reload would mint a new code and throw the whole class out
     mid-lesson. But a board opened *inside the bench* is the same origin and read the
     same stored code — so it connected to the very same room, and the relay allows one
     host and the newest wins. Opening the bench during a lesson quietly replaced the
     real board on its own room, while its chip went on showing the code.

     **One browser context deliberately**, because that is the whole mechanism.
     `browser.newPage()` gives each page its own storage, which is exactly why nothing
     in this suite could ever have caught this — two tabs of one browser is the case
     that matters and the one the harness does not produce by default. */
  const shared = await browser.newContext({ viewport:{ width:1400, height:900 } });
  const codeIn = t => (String(t).match(/(\d{5})/) || [])[1];
  const teach  = await shared.newPage();
  await teach.goto(BASE + '/game-hub.html'); await teach.waitForTimeout(700);
  await teach.evaluate(() => { window.HubSettings.set('buzzers', true);
                               window.HubSettings.set('intro','off'); });
  await teach.reload();
  await until(async () => !!codeIn(await textOf(teach.locator('#buzzer-chip'))), 15000);
  const lesson = codeIn(await textOf(teach.locator('#buzzer-chip')));
  check('a teaching hub opens a room', !!lesson, String(lesson));

  await teach.reload();
  await until(async () => !!codeIn(await textOf(teach.locator('#buzzer-chip'))), 15000);
  check('and keeps it across a reload, so a class is not thrown out mid-lesson',
        codeIn(await textOf(teach.locator('#buzzer-chip'))) === lesson,
        lesson + ' → ' + codeIn(await textOf(teach.locator('#buzzer-chip'))));

  const rig = await shared.newPage();
  await rig.goto(BASE + '/playground/phone-bench.html?board=../game-hub.html');
  await until(async () => /^\d{4,6}$/.test(await rig.locator('#code').inputValue()), 15000);
  check('a bench board mints its own room instead of taking the lesson’s',
        await rig.locator('#code').inputValue() !== lesson,
        'bench ' + await rig.locator('#code').inputValue() + ' · lesson ' + lesson);
  check('and the lesson still has the room it opened',
        codeIn(await textOf(teach.locator('#buzzer-chip'))) === lesson,
        codeIn(await textOf(teach.locator('#buzzer-chip'))) + ' · was ' + lesson);
  await shared.close();
}

/* ---- the answer clock ----
   Classic gives a team seconds on the floor once it buzzes in. Started by the buzz,
   never by the clue opening — the teacher reads aloud at their own pace and the
   pressure belongs on the team that claimed the right to answer. Soft at the end:
   klaxon and a pulse, and the buttons stay the teacher's. The phones watch the same
   countdown, sent as a duration with the lock so no clock comparison is needed. */
async function testAnswerClock(browser){
  section('Jeopardy: the answer clock');
  /* **The Lab board, because the answer clock only exists on a plain question.** It
     starts when a team takes the *floor*, and a round never gives anybody the floor
     — it arms every handset at once. Every Jeopardy clue in Units 4 and 5 is a round
     now, so a tile opened there leaves `#buzzer` present and disabled, and this suite
     hung thirty seconds on it and then threw, taking its last five checks with it.
     Same move `phonemodes`, `turns` and `competition` already made. */
  const host = await openLabHub(browser);
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
    window.HubSettings.set('round_default','buzz','jeopardy');
    window.HubSettings.set('jAnswerSeconds', 5, 'jeopardy');
  });
  await startGame(host, 'Jeopardy', { sections: 3, unit: 'Lab' });
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
    fin: window.HubSettings.get('jFinalQuestion','jeopardy'),
    ded: window.HubSettings.get('jDeduct','jeopardy')
  }));
  /* The preset *writes* the switches rather than shadowing them, so the rows in ⚙
     always say what is actually going to happen and a teacher can change one
     afterwards without the preset quietly lying about it.

     **The final question is no longer one of them** — deactivated after the first
     ef-2a class (it confused the room and swallowed the winner screen), so Classic
     writes the Daily Double and the deduction and leaves `jFinalQuestion` at its
     own default, off. The feature itself still runs when the toggle is chosen —
     the final-clue block below drives it by setting it explicitly. */
  check('the preset sets the rules it stands for, and leaves the final question off',
        wrote.dd === 1 && !wrote.fin && wrote.ded === true, JSON.stringify(wrote));
  /* ---- what the phones do is part of the mode ----
     It was missing from the bundles at first, and that read from the room as the
     phone setting "overriding" the mode. It was not overriding anything: the mode
     had no opinion, so the row kept whatever it had last. A mode that describes how
     a round is played and says nothing about thirty handsets describes half of it. */
  const phones = await page.evaluate(() => {
    const S = window.HubSettings, out = {};
    ['hub','classic','together'].forEach(m => {
      S.set('jRules', m, 'jeopardy');
      out[m] = S.get('round_default', 'jeopardy');
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
    window.HubSettings.renderOnce(host, 'jeopardy');
    const el = host.querySelector('[data-setting="round_default"]');
    return el ? (el.value || '') : 'no row';
  });
  check('and the row in the panel shows what the mode chose', shown === 'write', shown);
  await page.evaluate(() => window.HubSettings.set('jRules','classic','jeopardy'));
  await page.evaluate(() => window.HubSettings.set('jRules','hub','jeopardy'));
  const back = await page.evaluate(() => ({
    dd:  window.HubSettings.get('jDailyDoubles','jeopardy'),
    fin: window.HubSettings.get('jFinalQuestion','jeopardy'),
    ded: window.HubSettings.get('jDeduct','jeopardy')
  }));
  check('and the hub preset puts them back',
        back.dd === 0 && back.fin === false && back.ded === false, JSON.stringify(back));

  await page.evaluate(() => {
    const S = window.HubSettings;
    S.set('jDailyDoubles',1,'jeopardy'); S.set('jDeduct',true,'jeopardy');
    S.set('jFinalQuestion',false,'jeopardy'); S.set('stealOnWrong',false,'jeopardy');
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
  checkClean(page);
  await page.close();

  /* The show takes the value off you. Off by default here — a class 500 down in the
     first two minutes stops trying — but it has to work when it is on. Driven on the
     Lab board: the class-facing units are all-rounds now, and on a round clue the
     deduction stands down deliberately (the whole room was playing, so `missed` is
     only whoever happened to be on turn — the same fact that stands the steal down).
     A plain clue is the only place this rule can fire. See `openLabHub`. */
  {
    const dpg = await openLabHub(browser);
    await dpg.evaluate(() => {
      const S = window.HubSettings;
      S.set('cardFlip','off'); S.set('intro','off'); S.set('sound',false);
      S.set('jDailyDoubles',0,'jeopardy'); S.set('jDeduct',true,'jeopardy');
      S.set('jFinalQuestion',false,'jeopardy'); S.set('stealOnWrong',false,'jeopardy');
      S.set('round_default','off','jeopardy');
    });
    await startGame(dpg, 'Jeopardy', { sections:3, unit:'Lab' });
    await dpg.waitForTimeout(600);
    const before = await dpg.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent));
    await dpg.locator('#board .tile:not(.used)').first().click(); await dpg.waitForTimeout(500);
    const worth = await dpg.evaluate(() => {
      const t = document.getElementById('clue-topline').textContent;
      const m = t.match(/\$(\d+)/); return m ? Number(m[1]) : 0;
    });
    const onTurn = await dpg.evaluate(() =>
      [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active')));
    await dpg.locator('#reveal-btn').click(); await dpg.waitForTimeout(250);
    await dpg.locator('#wrong-btn').click(); await dpg.waitForTimeout(700);
    const after = await dpg.evaluate(() => [...document.querySelectorAll('.team .score')].map(e => e.textContent));
    check('a wrong answer costs the value when the rule is on',
          Number(after[onTurn]) === Number(before[onTurn]) - worth,
          before.join('/') + ' -> ' + after.join('/') + ' (clue $' + worth + ', team ' + onTurn + ')');
    checkClean(dpg);
    await dpg.close();
  }

  /* ---- the final clue ----
     The reason the show never feels decided early: everyone bets what they like, so
     last place can win from there and nobody has left the room by the last five
     minutes. Driven here end to end, because every beat of it is new. */
  const fin = await openHub(browser);
  await fin.evaluate(() => {
    const S = window.HubSettings;
    S.set('intro','off'); S.set('sound',false); S.set('cardFlip','off');
    S.set('jRules','classic','jeopardy');
    S.set('jFinalQuestion',true,'jeopardy');  // chosen knowingly — Classic no longer writes it
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
        (await fin.evaluate(() => window.HubSettings.get('round_default','jeopardy'))) === 'buzz');

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
  for (const [game, sections, id] of [['Jeopardy', 4, 'jeopardy'],
                                      ['Blockbusters', 'all', 'blockbusters'],
                                      ['Race to the Board', 'all', 'race'],
                                      ['Millionaire', 'all', 'millionaire'],
                                      ['Bingo', 'all', 'bingo']]){
    const page = await openHub(browser);
    await page.evaluate(() => {
      const S = window.HubSettings;
      S.set('intro','off'); S.set('sound',false); S.set('buzzers',true);
      S.set('round_default','off');            // the default: nothing during a question
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
    /* Honest about what will happen: a room to join, and whatever this board has
       actually put in the class's hands.

       **Asked of the game rather than matched against a list of phrases.** This was
       `/idle here|votes only|cards on phones/`, and it had been red since the
       Millionaire ladder became a round host: `round_default:'off'` describes what
       an *ordinary* question does, and there are none left on that board, so its
       chip correctly reads "pick an answer" instead. A fixed set of wordings is the
       hand-kept list this project keeps paying for — a board that grows a new note
       next month would fail here for being new. The game declares its own note, so
       the check reads that and asserts the chip agrees with it. */
    const own = await page.evaluate(g => {
      const def = window.HubGames.get(g);
      return (def && def.roomNote && def.roomNote()) || null;
    }, id);
    /* Two things, and deliberately not a third: a note is drawn at all, and where
       the game declares one it is the game's own words. What the engine falls back
       to when a game declares nothing ("votes only" against "idle here") is left
       alone on purpose — restating that expression here would be a second copy of it
       that could drift, which is the thing the phrase list was already guilty of. */
    check(game + ': and says what the phones are for rather than promising a dynamic',
          !!(await textOf(page.locator('#buzzer-chip .buzz-idle'))) &&
          (!own || chip.text.toLowerCase().includes(String(own).toLowerCase())),
          chip.text + '  · the game says: ' + (own || '(nothing of its own)'));
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

/* ---------- Battle Scrabble — the playground's multiplayer half ----------
   Board + two phones on the real relay, all three the real pages. The phones
   are full game pages acting as relay clients (not join.html), so what is
   asserted is the wire the room actually uses: join order on the circle, a
   banked score reaching the standings, a throw landing on the right
   neighbour and shaking their board, the crown at time-up, a reconnect
   keeping its seat — and, the hard requirement, the plain URL still being
   the solo game with no room chrome at all. */
async function testBattleScrabble(browser){
  section('Battle Scrabble');
  const board = await browser.newPage({ viewport:{ width:1280, height:720 } });
  board.__errors = []; board.on('pageerror', e => board.__errors.push(String(e)));
  await board.goto(BASE + '/playground/battle-scrabble-board.html');
  await until(async () => await board.evaluate(() => !!(window.__bsb && window.__bsb.host())), 10000);
  const code = await board.evaluate(() => String(window.__bsb.host().code));
  check('the board hosts a room', /^\d{4,6}$/.test(code), code);

  /* The joinPath proof: the QR and the printed URL must point at the game
     page, never join.html — a phone scanning the board has to land in Battle
     Scrabble. */
  await board.locator('#room-chip').click();
  await board.waitForTimeout(200);
  const joinUrl = await board.evaluate(() => (document.getElementById('join-url') || {}).textContent || '');
  check('the QR sends phones to the game page, not join.html',
        /playground\/battle-scrabble\.html/.test(joinUrl), joinUrl);
  // the panel is #join-panel (class 'on') and left open it eats the Start click
  await board.evaluate(() => { const m = document.getElementById('join-panel'); if(m) m.classList.remove('on'); });

  async function phone(name){
    const p = await browser.newPage({ viewport:{ width: PHONES.standard.w, height: PHONES.standard.h } });
    p.__errors = []; p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(BASE + '/playground/battle-scrabble.html?code=' + code);
    await p.waitForTimeout(300);
    await p.fill('#j-name', name);
    await p.click('#j-go');
    await until(async () => await p.evaluate(() => window.__bs.connected()), 8000);
    return p;
  }
  const A = await phone('Anna');
  const B = await phone('Ben');
  await until(async () => await board.evaluate(() => window.__bsb.seats.length) === 2, 8000);
  check('both phones take a seat on the circle, in join order',
        await board.evaluate(() => window.__bsb.seats.map(id => window.__bsb.players[id].name).join(',')) === 'Anna,Ben',
        await board.evaluate(() => JSON.stringify(window.__bsb.seats.map(id => window.__bsb.players[id].name))));
  check('a joined phone waits in the lobby, not playing',
        !(await A.evaluate(() => window.__bs.state().playing)));

  /* Start with a game length that is NOT the phone slider's default, so the
     phones showing it proves the room seeded their clocks, not the slider. */
  await board.locator('#settings-slot select').selectOption('180');
  await board.locator('#start').click();
  await until(async () => await A.evaluate(() => window.__bs.state().playing), 8000);
  await until(async () => await B.evaluate(() => window.__bs.state().playing), 8000);
  const aSecs = await A.evaluate(() => window.__bs.state().secsLeft);
  check('the board\'s clock seeds every phone', aSecs > 170 && aSecs <= 180, String(aSecs));
  check('and each phone knows its neighbours by name',
        await A.evaluate(() => { const s = window.__bs.state(); return s.nbL + '/' + s.nbR; }) === 'Ben/Ben');

  /* Live words: Ben spells; the board's chip and Anna's edge tag both show
     the word, lit once it is real — that is how you know who to target.
     Checked BEFORE any tile is thrown: an arrived shot tile can knock a
     freshly placed word apart (the game working), which would race this. */
  const wordB = await B.evaluate(() => {
    const w = (window.__bs.state().hints[0] || '').toUpperCase();
    w.split('').forEach((ch, i) => window.__bs.world.place(i, ch));
    window.__bs.read();
    return w;
  });
  check('Ben has a word to spell for the live check', wordB.length >= 3, wordB);
  const liveOnBoard = await until(async () =>
    await board.evaluate(() => window.__bsb.players[window.__bsb.seats[1]].live) === wordB, 6000);
  check('the board shows the word Ben is spelling', liveOnBoard,
        String(await board.evaluate(() => window.__bsb.players[window.__bsb.seats[1]].live)));
  const litOnA = await until(async () => await A.evaluate(w =>
    ['l', 'r'].some(s => document.getElementById('nbword-' + s).textContent === w &&
                         document.getElementById('nb-' + s).classList.contains('lit')), wordB), 6000);
  check('and Anna\'s edge tag lights up with it', litOnA,
        await A.evaluate(() => document.getElementById('nbword-l').textContent + '/' +
                               document.getElementById('nbword-r').textContent));

  /* The main screen mirrors every grid: Ben's word, placed on his row 0, must
     appear letter-for-letter in his panel on the board — data first, then the
     drawn cells, lit gold since it is a valid word. */
  const gridMirror = await until(async () =>
    (await board.evaluate(() => String(window.__bsb.players[window.__bsb.seats[1]].grid || ''))).indexOf(wordB) === 0, 6000);
  check('the board mirrors Ben\'s grid', gridMirror,
        await board.evaluate(() => String(window.__bsb.players[window.__bsb.seats[1]].grid || '').slice(0, 12)));
  check('and Ben\'s panel draws the word, lit as valid', await board.evaluate(w => {
    const el = document.querySelector('.panel[data-id="' + window.__bsb.seats[1] + '"]');
    if(!el) return false;
    const cells = el.querySelectorAll('.cell');
    return w.split('').every((ch, i) => cells[i].textContent === ch && cells[i].classList.contains('ok'));
  }, wordB));

  // clear Ben's board again, so the throw checks below meet an unslotted grid
  await B.evaluate(() => window.__bs.deal([]));
  await B.waitForTimeout(300);

  /* A bank on one phone reaches the board's standings. Driven through the
     same place-and-read path the solo suite uses. */
  const hintA = await A.evaluate(() => window.__bs.state().hints.slice(-1)[0] || window.__bs.state().hints[0]);
  if(hintA){
    await A.evaluate(w => { w.toUpperCase().split('').forEach((ch, i) => window.__bs.world.place(i, ch)); window.__bs.read(); }, hintA);
    await A.waitForTimeout(200);
    await A.evaluate(() => window.__bs.bank());
  }
  await until(async () => await board.evaluate(() =>
    window.__bsb.players[window.__bsb.seats[0]].score) > 0, 8000);
  check('a banked word lands on the board\'s standings', true);

  /* The throw: Anna's right neighbour is Ben. The tile itself travels now —
     it leaves Anna's rack and arrives on Ben's board as a real usable piece;
     nothing on Ben's board resets. */
  const bRackBefore = await B.evaluate(() => window.__bs.state().rack.length);
  const rackBefore = await A.evaluate(() => window.__bs.state().rack.length);
  const threw = await A.evaluate(() => window.__bs.throw('R'));
  check('a throw is accepted while a neighbour exists', /^[A-Z]$/.test(String(threw)), String(threw));
  const arrived = await until(async () =>
    await B.evaluate(() => window.__bs.state().rack.length) === bRackBefore + 1, 8000);
  check('the thrown tile crosses to the target and joins their rack', arrived,
        await B.evaluate(() => window.__bs.state().rack.join('')));
  check('as the same letter that left the thrower',
        await B.evaluate(() => window.__bs.state().rack.slice(-1)[0]) === threw,
        threw + ' vs rack ' + await B.evaluate(() => window.__bs.state().rack.join('')));
  check('and the target is told who threw it',
        /anna threw you/i.test(await B.locator('#status').innerText()),
        await B.locator('#status').innerText());
  check('the thrown tile is spent — no replacement until the next bank',
        await A.evaluate(() => window.__bs.state().rack.length) === rackBefore - 1);

  /* The hint strip only ever shows words the current rack can spell — a
     thrown-away letter must take any hint that needed it with it. Driven
     through the REAL path (grab a rack tile, flick it out the open edge →
     onExit → throwOut), not the wire helper, which spends the rack itself.
     Several throws maximise the chance a hinted letter leaves; the multiset
     test mirrors the page's own canSpell. */
  let hintsFresh = true, thrown = 0;
  for(let th = 0; th < 3 && hintsFresh; th++){
    const before = await A.evaluate(() => window.__bs.state().rack.length);
    if(before <= 4) break;                       // the edge closes at MIN_WORD; keep headroom
    await A.evaluate(x => {
      const W = window.__bs.world, h = document.getElementById('stage').offsetHeight;
      W.grab(91, x, h - 25);                     // nearest loose piece in the pile
      W.move(91, -400, Math.round(h * 0.5));     // drag the anchor off the open edge
    }, 100 + th * 90);
    await A.waitForTimeout(150);                 // real frames carry the held tile left
    await A.evaluate(() => window.__bs.world.drop(91));
    const left = await until(async () =>
      await A.evaluate(() => window.__bs.state().rack.length) < before, 4000);
    if(!left) continue;                          // grabbed nothing / it stayed — try again
    thrown++;
    hintsFresh = await A.evaluate(() => {
      const s = window.__bs.state();
      return s.hints.every(w => {
        const pool = {};
        s.rack.forEach(ch => { pool[ch] = (pool[ch] || 0) + 1; });
        return w.toUpperCase().split('').every(ch => (pool[ch] = (pool[ch] || 0) - 1) >= 0);
      });
    });
  }
  check('a thrown-out tile keeps the hint strip spellable', hintsFresh && thrown > 0,
        JSON.stringify({ thrown, hintsFresh }));

  /* The tray lip: the open edge used to run the full height of the screen,
     and a resting tile nudged along the floor drifted out to a neighbour
     without ever being thrown. The bottom of each open edge is a wall the
     height of the pile band now — this tile slides at the floor toward the
     open edge and must still be on the board a beat later. */
  await A.evaluate(() => {
    const W = window.__bs.world, h = document.getElementById('stage').offsetHeight;
    W.addPiece('L', { x: 45, y: h - 28, vx: -14, vy: 0, hue: '#445566' });
  });
  await A.waitForTimeout(900);
  check('a resting tile cannot drift out through the open edge',
        await A.evaluate(() => !!window.__bs.world.loose().find(z => z.hue === '#445566')),
        'the tile left the world');

  /* The open edge: a tile flicked off the side mid-air travels too — no drop
     point needed — and it arrives wearing its own colour. Driven by spawning
     a fast leftward piece inside Anna's open left edge (both her neighbours
     are Ben, so the receiver is known). */
  const bBefore2 = await B.evaluate(() => window.__bs.state().rack.length);
  /* A flick can clip one of Anna's own resting tiles and stall short of the
     edge — real physics, not a defect — so try up to three lanes; any one
     crossing proves the mechanic. `>=` because a stalled tile may still drift
     out later and arrive as a second Q. */
  let flew = false;
  for(let lane = 0; lane < 3 && !flew; lane++){
    await A.evaluate(y => window.__bs.world.addPiece('Q', { x: 70, y, vx: -55, vy: 0, hue: '#123456' }), 40 + lane * 60);
    flew = await until(async () =>
      await B.evaluate(() => window.__bs.state().rack.length) >= bBefore2 + 1, 4000);
  }
  check('a tile flicked off the open edge travels mid-air', flew,
        await B.evaluate(() => window.__bs.state().rack.join('')));
  check('and arrives wearing its own colour',
        await B.evaluate(() => window.__bs.world.loose().some(p => p.ch === 'Q' && p.hue === '#123456')),
        JSON.stringify(await B.evaluate(() => window.__bs.world.loose())));

  /* Time-up: the phones end on their own clocks (driven directly here) and
     the board crowns the leader from the last reported scores. */
  await A.evaluate(() => window.__bs.endGame());
  await B.evaluate(() => window.__bs.endGame());
  await board.evaluate(() => window.__bsb.hurry(1));
  await until(async () => (await board.locator('#banner').innerText()).length > 0, 10000);
  check('the board crowns the leader at time-up',
        /anna/i.test(await board.locator('#banner').innerText()),
        await board.locator('#banner').innerText());
  check('a phone in a room waits for the board\'s rematch',
        await A.evaluate(() => document.getElementById('again').style.display === 'none'));

  /* A reconnect keeps its seat: same localStorage id, same slot, and the
     board's sync corrects the replayed clock. */
  await board.locator('#start').click();          // a fresh game so B rejoins mid-play
  await until(async () => await A.evaluate(() => window.__bs.state().playing), 8000);
  await B.reload();
  await B.waitForTimeout(400);
  await B.fill('#j-name', 'Ben');
  await B.click('#j-go');
  await until(async () => await B.evaluate(() => window.__bs.connected() && window.__bs.state().playing), 10000);
  check('a reloaded phone resumes the same seat',
        await board.evaluate(() => window.__bsb.seats.length) === 2,
        String(await board.evaluate(() => window.__bsb.seats.length)));
  const bLeft = await B.evaluate(() => window.__bs.state().secsLeft);
  check('and its clock is synced to the board, not the replayed arm',
        bLeft > 0 && bLeft <= 182, String(bLeft));

  /* The cap: the board seats four. Cara and Dan fill the room; Eve is told it
     is full, stood down (whatever the relay's armed replay started), and never
     seated. */
  const C = await phone('Cara');
  const D = await phone('Dan');
  await until(async () => await board.evaluate(() => window.__bsb.seats.length) === 4, 8000);
  check('a third and fourth player take seats',
        await board.evaluate(() => window.__bsb.seats.length) === 4,
        String(await board.evaluate(() => window.__bsb.seats.length)));
  const E = await browser.newPage({ viewport:{ width: PHONES.standard.w, height: PHONES.standard.h } });
  E.__errors = []; E.on('pageerror', e => E.__errors.push(String(e)));
  await E.goto(BASE + '/playground/battle-scrabble.html?code=' + code);
  await E.waitForTimeout(300);
  await E.fill('#j-name', 'Eve');
  await E.click('#j-go');
  const toldFull = await until(async () => await E.evaluate(() => !!window.__bs.state().full), 8000);
  check('a fifth phone is told the room is full', toldFull);
  check('and is never seated or left playing',
        await board.evaluate(() => window.__bsb.seats.length) === 4 &&
        !(await E.evaluate(() => window.__bs.state().playing)));
  check('the fifth phone threw nothing', E.__errors.length === 0, E.__errors.join(' | '));
  await C.close(); await D.close(); await E.close();

  /* The hard requirement: a plain URL is the solo game — playing at once, no
     join chrome, no zones. Degradation is stage 1 itself. */
  const solo = await browser.newPage({ viewport:{ width: PHONES.standard.w, height: PHONES.standard.h } });
  solo.__errors = []; solo.on('pageerror', e => solo.__errors.push(String(e)));
  await solo.goto(BASE + '/playground/battle-scrabble.html');
  await solo.waitForTimeout(800);
  check('a plain URL plays solo at once', await solo.evaluate(() => window.__bs.state().playing));
  check('with no join strip and no neighbour tags',
        await solo.evaluate(() =>
          !document.getElementById('joinbar').classList.contains('on') &&
          !document.getElementById('nb-l').classList.contains('on')));
  check('a loose tile is the same size as a slot square',
        await solo.evaluate(() => Math.abs(window.__bs.world.tileSize() - window.__bs.world.slotBox(0).w) < 0.6),
        await solo.evaluate(() => window.__bs.world.tileSize() + ' vs ' + window.__bs.world.slotBox(0).w));
  /* The squares are WIDTH-driven, not squeezed by a proportional height
     budget — the first classroom photos showed real phones (shorter stage,
     browser chrome) with tiny unreadable tiles while the bench looked fine.
     The solo page above already runs at PHONES.standard (the realistic
     profile); the second page checks the smallest handset in the roster. */
  check('grid squares stay readable at the standard phone profile',
        await solo.evaluate(() => window.__bs.world.slotBox(0).w) >= 45,
        String(await solo.evaluate(() => window.__bs.world.slotBox(0).w)));
  const short = await browser.newPage({ viewport:{ width: PHONES.small.w, height: PHONES.small.h } });
  short.__errors = []; short.on('pageerror', e => short.__errors.push(String(e)));
  await short.goto(BASE + '/playground/battle-scrabble.html');
  await short.waitForTimeout(800);
  check('and on the smallest profile in the roster',
        await short.evaluate(() => window.__bs.world.slotBox(0).w) >= 40,
        String(await short.evaluate(() => window.__bs.world.slotBox(0).w)));
  /* Tile MASS is screen-independent: Body.scale scales mass with area, so
     bigger squares on a bigger phone made every tile heavier and the drag
     spring — tuned once — sagged and wobbled under a finger. normalizeMass
     pins every loose tile to a 34px tile's weight; these two pages have
     different square sizes, so equal masses prove the pin. */
  const mA = await solo.evaluate(() => window.__bs.world.tileMass());
  const mB = await short.evaluate(() => window.__bs.world.tileMass());
  check('a tile weighs the same on every screen size', mA > 0 && Math.abs(mA - mB) < 0.01,
        mA.toFixed(3) + ' vs ' + mB.toFixed(3));
  /* The Tune panel is DERIVED: one slider per dial in the shelf's registry,
     seeded from the world's live feel — the page repeats no default. A dial
     declared on the shelf must appear here with nothing edited; a hand-typed
     slider drifting from the registry is the bug this pins. */
  check('the Tune panel builds itself from the shelf dial registry',
        await solo.evaluate(() => {
          const D = window.HubKit.table.dials, f = window.__bs.world.feel();
          return D.length >= 10 && D.every(d => {
            const el = document.getElementById('s-' + d.k);
            return el && Math.abs(parseFloat(el.value) - f[d.k]) < 1e-6;
          });
        }),
        await solo.evaluate(() =>
          window.HubKit.table.dials.map(d => d.k + ':' + (document.getElementById('s-' + d.k) || {}).value).join(' ')));
  await short.close();

  /* Save makes the current feel this DEVICE's default: a fresh table on the
     same origin inherits it on the next load, and Reset clears the save and
     walks the world back to the code defaults. */
  await solo.evaluate(() => {
    window.__bs.world.setFeel({ gravity: 1.55 });
    document.getElementById('dial-save').click();
  });
  await solo.reload();
  await solo.waitForTimeout(900);
  check('a Saved feel is inherited by the next table on this device',
        Math.abs(await solo.evaluate(() => window.__bs.world.feel().gravity) - 1.55) < 1e-9,
        String(await solo.evaluate(() => window.__bs.world.feel().gravity)));
  await solo.evaluate(() => document.getElementById('dial-reset').click());
  check('and Reset dials clears the save and restores the code defaults',
        await solo.evaluate(() =>
          window.__bs.world.feel().gravity === window.HubKit.table.dials.find(d => d.k === 'gravity').def &&
          !localStorage.getItem('engishism.tableFeel')),
        String(await solo.evaluate(() => window.__bs.world.feel().gravity)));

  /* Opening the Tune drawer SHRINKS the stage — before the resize clamp,
     every pile tile sat below the new floor, outside the walls, and fell
     forever: "tiles disappear when I press Tune". The world must keep every
     loose tile inside its new bounds through the shrink and back. */
  const looseBefore = await solo.evaluate(() => window.__bs.world.loose().length);
  await solo.evaluate(() => document.getElementById('btn-tune').click());
  await solo.waitForTimeout(700);
  const drawerOpen = await solo.evaluate(() => {
    const h = document.getElementById('stage').offsetHeight;
    return { n: window.__bs.world.loose().length,
             inside: window.__bs.world.loose().every(p => p.y <= h + 1) };
  });
  await solo.evaluate(() => document.getElementById('btn-tune').click());
  await solo.waitForTimeout(400);
  check('opening the Tune drawer never eats a loose tile',
        drawerOpen.n === looseBefore && drawerOpen.inside &&
        await solo.evaluate(() => window.__bs.world.loose().length) === looseBefore,
        JSON.stringify({ before: looseBefore, open: drawerOpen }));

  /* A loose tile may never REST inside the grid: settled flat on a docked
     tile it sits a few px off the cell centre and reads as a broken dock —
     a classroom screenshot showed a word column wearing two such imposters.
     Deterministic: mint a tile lying exactly on top of a docked one; the
     sweep must kick it inward and it tumbles home to the pile. */
  await solo.evaluate(() => {
    window.__bs.deal([]);
    const W = window.__bs.world;
    W.addPiece('K', { x: 200, y: 500 });
    W.place(16, 'K');
    const s = W.slotBox(16);
    W.addPiece('V', { x: s.x, y: s.y - s.w, hue: '#111199' });
  });
  /* until(), not a fixed wait: the imposter must SETTLE on the docked tile
     (its bounces decay for ~a second) before the sweep sees it as resting,
     then fall clear — a fixed sample raced that chain and once caught the
     tile mid-fall. Out of the CELLS is the bar — below the last row's bottom
     edge; the pile heap can stack 2-3 tiles high by this point, so "a full
     tile below the grid" was stricter than the pile itself. */
  const imposterGone = await until(async () => await solo.evaluate(() => {
    const W = window.__bs.world;
    const q = W.loose().find(z => z.hue === '#111199');
    const last = W.cells().length - 1;
    return !!q && q.y > W.slotBox(last).y + W.slotBox(last).w / 2 + 2;
  }), 6000);
  check('a loose tile cannot rest on the grid — it tumbles to the pile', imposterGone,
        await solo.evaluate(() => JSON.stringify(window.__bs.world.loose().find(z => z.hue === '#111199'))));

  /* A knock DURING the dock glide: the knock frees the slot while the tween
     still runs, and a tick on slots[null] threw — which killed the page's
     whole rAF loop, freezing the game with no error on screen. The shelf now
     defends in depth (the knock clears the tween, the tick guards its slot,
     step() recovers from any throw and SAYS so on the console) — so the
     check listens for both pageerrors and the recovery log: a clean run has
     neither, and the loop keeps ticking. */
  const conErrs = [];
  solo.on('console', m => { if(m.type() === 'error') conErrs.push(m.text()); });
  const errsBefore = solo.__errors.length;
  await solo.evaluate(async () => {
    const W = window.__bs.world;
    const s = W.slotBox(20);
    W.addPiece('G', { x: s.x, y: s.y + 90 });
    W.grab(87, s.x, s.y + 90);
    W.move(87, s.x, s.y);
    await new Promise(r => setTimeout(r, 400));   // settle over the slot; the finger track goes stale = a slow release
    W.drop(87);                                    // the 0.2s glide starts
    W.addPiece('S', { x: s.x - 120, y: s.y, vx: 30, vy: 0, shot: true });   // lands its hit inside the glide
  });
  await solo.waitForTimeout(800);
  const stillFalling = await solo.evaluate(async () => {
    const W = window.__bs.world;
    W.addPiece('Y', { x: 60, y: 60, hue: '#118811' });
    const y0 = W.loose().find(z => z.hue === '#118811').y;
    await new Promise(r => setTimeout(r, 500));
    return W.loose().find(z => z.hue === '#118811').y - y0;
  });
  check('a knock during the dock glide leaves the physics loop alive',
        solo.__errors.length === errsBefore && conErrs.length === 0 && stillFalling > 50,
        JSON.stringify({ errs: solo.__errors.slice(errsBefore).join('|'),
                         con: conErrs.join('|').slice(0, 90), fell: Math.round(stillFalling) }));

  /* Docked means CENTRED, enforced rather than trusted: real handsets have
     shown docked tiles stranded a few px off their slots (a frozen loop was
     one cause; a classroom screenshot proved at least one more). Displace a
     docked body directly — standing in for whatever strands one — and the
     re-seat sweep must put it back on centre within a beat. */
  /* nudge and measure in ONE evaluate — the sweep runs on the page's rAF and
     can re-seat between two separate evaluates, which read as "never nudged" */
  const nudged = await solo.evaluate(() => {
    const W = window.__bs.world;
    W.addPiece('Z', { x: 200, y: 500 });
    W.place(30, 'Z');
    W._nudgeDocked(30);
    const s = W.slotBox(30), b = W.pieceAt(30);
    return Math.round(Math.hypot(b.x - s.x, b.y - s.y));
  });
  await solo.waitForTimeout(700);
  const reseated = await solo.evaluate(() => {
    const W = window.__bs.world, s = W.slotBox(30), b = W.pieceAt(30);
    return +Math.hypot(b.x - s.x, b.y - s.y).toFixed(2);
  });
  check('a docked tile that drifts off its slot is re-seated on centre',
        nudged >= 7 && reseated < 0.5, JSON.stringify({ nudged, reseated }));

  /* The grid: an across word and a down word sharing their first letter are
     both live at once, and one BANK press cashes the pair. The letters are
     minted with addPiece so the check does not depend on the random rack. */
  await solo.evaluate(() => {
    window.__bs.deal([]);
    const W = window.__bs.world;
    'CATOW'.split('').forEach(ch => W.addPiece(ch, { x: 200, y: 520 }));
    const C = Math.round(Math.sqrt(W.cells().length));   // the grid's own width — the test follows the page's COLS
    W.place(0, 'C'); W.place(1, 'A'); W.place(2, 'T');   // row 0 across: CAT
    W.place(C, 'O'); W.place(2 * C, 'W');                // column 0 down: C-O-W
    window.__bs.read();
  });
  check('an across word and a down word are both live',
        await solo.evaluate(() => window.__bs.state().words.slice().sort().join('+')) === 'CAT+COW',
        await solo.evaluate(() => JSON.stringify(window.__bs.state().words)));
  const scoreBefore = await solo.evaluate(() => window.__bs.state().score);
  await solo.evaluate(() => window.__bs.bank());
  const afterBank = await solo.evaluate(() => window.__bs.state());
  check('one press banks both words', afterBank.banked >= 2 && afterBank.score > scoreBefore,
        JSON.stringify({ banked: afterBank.banked, score: afterBank.score }));

  /* The dock threshold: a tile carried to a square and released still docks;
     one released mid-flick flies on — otherwise every throw over the grid's
     grid was sucked into whatever empty space it passed. Both driven through
     grab/move/drop, the real gesture path. */
  await solo.evaluate(() => {
    const W = window.__bs.world, h = document.getElementById('stage').offsetHeight;
    W.addPiece('J', { x: 200, y: Math.round(h * 0.85) });
    W.grab(77, 200, Math.round(h * 0.85));
    const box = W.slotBox(20);
    W.move(77, box.x, box.y);
  });
  await solo.waitForTimeout(600);            // let the spring settle the piece over the slot
  await solo.evaluate(() => window.__bs.world.drop(77));
  const docked = await until(async () =>
    await solo.evaluate(() => window.__bs.world.cells()[20]) === 'J', 4000);
  check('a slow release over a square still docks', docked,
        await solo.evaluate(() => JSON.stringify(window.__bs.world.cells())));
  /* Deterministic flick: pull the spring anchor far across the grid and step
     the world synchronously so the tile is released at full chase speed —
     the same state a finger mid-flick leaves it in. */
  await solo.evaluate(() => {
    const W = window.__bs.world, h = document.getElementById('stage').offsetHeight;
    W.addPiece('X', { x: 350, y: Math.round(h * 0.5) });
    W.grab(78, 350, Math.round(h * 0.5));
    W.move(78, 30, Math.round(h * 0.5) - 60);
    W.step(); W.step(); W.step();
    W.drop(78);
  });
  await solo.waitForTimeout(600);
  check('a fast release flies instead of docking',
        await solo.evaluate(() => window.__bs.world.cells().indexOf('X') === -1 &&
                                  window.__bs.world.loose().some(p => p.ch === 'X')),
        await solo.evaluate(() => JSON.stringify(window.__bs.world.cells())));

  /* The throw rides the FINGER's velocity. The drag damper brakes the held
     body, so a real flick releases with a fast gesture track and a nearly
     still body — the day the damper went up, every real flick died at the
     release point while this suite's stepped-body flick stayed green. Here
     the body is never stepped (velocity ~0) while the gesture history records
     a violent rightward flick: the tile must leave with the gesture's speed
     and direction, read in the same evaluate before physics touches it. */
  const flungVx = await solo.evaluate(() => {
    const W = window.__bs.world, h = document.getElementById('stage').offsetHeight;
    W.addPiece('F', { x: 60, y: Math.round(h * 0.75), hue: '#0e0e0e' });
    W.grab(79, 60, Math.round(h * 0.75));
    W.move(79, 120, Math.round(h * 0.75));
    W.move(79, 200, Math.round(h * 0.75));
    W.drop(79);
    const p = W.loose().find(q => q.hue === '#0e0e0e');
    return p ? p.vx : 0;
  });
  check('a flick with a braked body still flies with the finger velocity',
        flungVx > 8, String(flungVx));

  /* Real-time physics: step() advances by wall clock, not by call count — a
     120Hz screen's doubled frames must not run the game at double speed (a
     held tile whipped into a spin was the symptom on a real phone). A burst
     of synchronous calls earns at most the capped few updates; real elapsed
     time advances normally. The probe tile is found by its unique hue. */
  const fall = await solo.evaluate(() => {
    const W = window.__bs.world;
    /* x=200, NOT the right edge: the probe must fall clear to the pile, and
       the dock check above parked a static J in the grid's rightmost column
       (slot 20 = row 2, col 6 at 7 wide) — a probe dropped over that column
       lands on the stack and reads as "never fell". */
    W.addPiece('Y', { x: 200, y: 60, hue: '#0f0f0f' });
    const at = () => W.loose().find(p => p.hue === '#0f0f0f').y;
    const y0 = at();
    for(let i = 0; i < 30; i++) W.step();
    return at() - y0;
  });
  check('a burst of synchronous steps advances by time, not by call count',
        fall >= 0 && fall < 60, String(fall));
  await solo.waitForTimeout(700);
  const fell = await solo.evaluate(() => {
    const p = window.__bs.world.loose().find(p2 => p2.hue === '#0f0f0f');
    return p ? p.y : -1;
  });
  check('while real elapsed time falls the same tile normally', fell > 200, String(fell));

  /* The knock rule, deterministically: a shot tile fired in at slot height
     must punch a slotted letter out — the word breaks physically, nothing is
     deleted. Driven on the solo page so no relay timing is in the loop. */
  await solo.evaluate(() => {
    const w = (window.__bs.state().hints[0] || '').toUpperCase();
    w.split('').forEach((ch, i) => window.__bs.world.place(i, ch));
    window.__bs.read();
  });
  const wordBefore = await solo.evaluate(() => window.__bs.world.read());
  /* Let the redeal's rain fall clear of row 0 first — a falling loose tile
     between the shot and the word absorbs the hit. Then aim along row 0 from
     just right of the word's last letter, close enough that gravity cannot
     drop the shot under the row before impact. */
  await solo.waitForTimeout(1300);
  await solo.evaluate(() => {
    const W = window.__bs.world;
    const words = window.__bs.state().words;
    const n = words[0] ? words[0].length : 3;
    const box = W.slotBox(n - 1);
    W.addPiece('Z', { x: box.x + box.w * 2, y: box.y, vx: -30, vy: 0, hue: '#E2603B', shot: true });
  });
  const knocked = await until(async () =>
    (await solo.evaluate(() => window.__bs.world.read())).length < wordBefore.length, 6000);
  check('a fast incoming tile knocks a slotted letter out of the word',
        wordBefore.length >= 3 && knocked,
        'before "' + wordBefore + '" after "' + await solo.evaluate(() => window.__bs.world.read()) + '"');

  /* ---- the phone bench racks the game page, not join.html ----
     The board declares what its phones run (`window.HubPhonePage`, beside
     HubHost) and the bench follows: a racked phone must be this game,
     auto-joined via ?auto=1 — never a generic join.html that receives the
     board's arm and cannot play it. One check proves the declaration, the
     follow, and the auto-join. */
  const bench = await browser.newPage({ viewport:{ width:1500, height:950 } });
  bench.__errors = []; bench.on('pageerror', e => bench.__errors.push(String(e)));
  await bench.goto(BASE + '/playground/phone-bench.html?board=battle-scrabble-board.html');
  await until(async () => /^\d{4,6}$/.test(await bench.locator('#code').inputValue()), 12000);
  await bench.locator('#add').click();
  await bench.waitForTimeout(400);
  const rackSrc = await bench.evaluate(() =>
    (document.querySelector('.phone iframe') || {}).getAttribute('src'));
  check('the bench racks the game page the board declared',
        /battle-scrabble\.html/.test(rackSrc || ''), String(rackSrc));
  // the -board page also matches nothing here: the phone frame alone is battle-scrabble.html
  const phoneFrame = () => bench.frames().find(f => /battle-scrabble\.html/.test(f.url()));
  const benchJoined = await until(async () => {
    try{
      const f = phoneFrame();
      return !!(f && await f.evaluate(() => !!(window.__bs && window.__bs.connected())));
    }catch(e){ return false; }   // a frame mid-navigation detaches under evaluate
  }, 10000);
  check('and the racked phone joins the board\'s room by itself', benchJoined);
  check('bench threw nothing', bench.__errors.length === 0, bench.__errors.join(' | '));
  await bench.close();

  check('board threw nothing', board.__errors.length === 0, board.__errors.join(' | '));
  check('phones threw nothing', A.__errors.length === 0 && B.__errors.length === 0 && solo.__errors.length === 0,
        [].concat(A.__errors, B.__errors, solo.__errors).join(' | '));
  await A.close(); await B.close(); await solo.close(); await board.close();
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
    variants: testFlipVariants, winroute: testWinRouteVariants, gameshow: testGameShow, gsjeopardy: testGameShowJeopardy, gsblockbusters: testGameShowBlockbusters, gsrace: testGameShowRace, idents: testIdentsAreDistinct, registry: testGameRegistry, prompts: testPromptTypes, content: testContentIntegrity, topics: testTopicPicking, defaultlook: testDefaultLook, jfinish: testJeopardyFinish, standings: testStandings, competition: testCompetition, lab: testLabDrawer, range: testRangeSetting,
    battlescrabble: testBattleScrabble,
    buzzers: testBuzzers, phonemodes: testPhoneModes, teamvote: testTeamVote,
    typetobuzz: testTypeToBuzz, judging: testAnswerJudging,
    degradation: testDegradation, file: testFileProtocol,
    reconnect: testRelayReconnect, phonebingo: testPhoneBingo,
    classic: testJeopardyClassic, joinbar: testJoinAlwaysThere,
    together: testJeopardyTogether, jclock: testAnswerClock,
    playground: testPlaygroundConnections, bench: testPhoneBench,
    forms: testQuestionForms, anagram: testAnagramRound, thermometer: testThermometer,
    storyreveal: testStoryReveal, grouping: testGroupingClue,
    qbench: testQuestionBench
  };
  const toRun = onlyArg ? onlyArg.split(',').map(s => s.trim()).filter(k => suites[k])
                        : Object.keys(suites);
  if (onlyArg && !toRun.length){
    console.error('  unknown --only= value. Available: ' + Object.keys(suites).join(', '));
    process.exit(2);
  }
  /* Per suite, not around the loop. One suite throwing used to abort every suite
     after it in the list — and the totals printed anyway, so a run that covered
     three suites read exactly like a run that covered ten. Silent truncation is
     worse than a failure: it was believed twice before being noticed, both times
     because `phonemodes` carries a deliberately-red check that *throws*. A suite
     that throws now fails by name and the rest still run. */
  for (const key of toRun){
    try { await suites[key](browser); }
    catch (e) {
      failed++; failures.push(key + ' threw: ' + (e && e.message));
      console.log('\n  THREW in ' + key + '  ' + (e && e.message));
    }
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
