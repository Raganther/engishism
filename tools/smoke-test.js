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

async function startGame(page, gameTitle, { sections = 1, unit = 'Unit 5', keepIntro = false } = {}){
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

  await page.locator('.m-option', { hasText: right }).first().click(); await page.waitForTimeout(350);
  check('correct answer scores 100', (await scores(page))[0] === '100', (await scores(page)).join('/'));
  check('correct option is marked', await page.locator('.m-option.right').count() === 1);

  await page.locator('#m-next').click(); await page.waitForTimeout(350);
  check('turn passes to team 2', /team 2/i.test(await page.locator('#m-turn').innerText()));

  checkClean(page);
  await page.close();
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
    const bar   = document.getElementById('scorebar').getBoundingClientRect();
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
      underBar: Math.round(Math.max(0, Math.max(...kids.map(e => e.getBoundingClientRect().bottom)) - bar.top)),
      clipped: clipped.length,
      clippedSample: clipped.length ? (clipped[0].className || clipped[0].tagName) + ' "' +
                     clipped[0].textContent.trim().slice(0, 18) + '"' : '',
      tiny: tiny.length,
      tinySample: tiny.length ? Math.round(parseFloat(getComputedStyle(tiny[0]).fontSize)) + 'px' : '',
      chrome: Math.round(document.querySelector('header').getBoundingClientRect().height + bar.height)
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
        check(at + ': nothing under the team bar', r.underBar === 0, r.underBar + 'px');
        check(at + ': nothing off the right edge', r.offRight === 0, r.offRight + 'px');
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

  // ⚙ opens on the tab for whatever is being played
  await startGame(page, 'Jeopardy', { sections:3 });
  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  check('gear opens on the current game\'s tab',
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
  await page.locator('#m-options .m-option').first().click();
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
  check('the four games are registered', shape.ids.length === 4, shape.ids.join(','));
  check('settings tab labels come from the registry',
        shape.titles.length === shape.ids.length, shape.titles.join(','));
  ['load','hasBank','renderContent','startButton','start','fit','deal','tension','onResize','onTimerEnd']
    .forEach(h => check('the contract exposes ' + h + '()', shape.hooks.indexOf(h) !== -1));

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

  // and it inherits the shared furniture without asking for any of it
  const inherits = await page.evaluate(() => ({
    skin:    document.body.classList.contains('theme-gameshow'),
    teambar: !!document.getElementById('scorebar'),
    timer:   !!document.getElementById('tmr-display'),
    banner:  !!document.getElementById('result-card'),
    kit:     typeof window.HubKit.fitToScreen === 'function'
  }));
  check('a new game inherits the skin, team bar, timer, banner and kit',
        Object.values(inherits).every(Boolean), JSON.stringify(inherits));

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
        chrome: Math.round(rect('header').height + rect('#scorebar').height),
        shortest: Math.round(Math.min(...opts.map(o => o.height)))
      };
    });

    check(`${vp.name}: four options are on screen`, r.options === 4, String(r.options));
    check(`${vp.name}: no option overlaps another`, r.optOverlap === 0, r.optOverlap + ' pairs');
    check(`${vp.name}: the ladder does not cover the answers`, !r.ladderOverOptions);
    check(`${vp.name}: the options stay inside their grid`, r.spill === 0, r.spill + 'px past it');
    check(`${vp.name}: every option keeps its full height`, r.shortest >= 40, r.shortest + 'px');
    check(`${vp.name}: nothing runs off the right edge`, r.offRight === 0, r.offRight + 'px');
    // An absolute cap, not a fraction of the viewport: the header and team bar
    // cost the same pixels whatever the screen, and on the shortest handset a
    // fraction would pass at 33% while stealing 40% of a 560px screen. This was
    // 323px — header 146 + team bar 177 — before the handset tier existed.
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
async function testCompetition(browser){
  section('Competitive dynamics');

  const activeTeam = page => page.evaluate(() =>
    [...document.querySelectorAll('.team')].findIndex(e => e.classList.contains('active')));
  const openFirstClue = async page => {
    await page.locator('#board .tile:not(.used)').first().click(); await page.waitForTimeout(500);
    await page.locator('#reveal-btn').click(); await page.waitForTimeout(200);
  };

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
  await page.locator('.m-option', { hasText: wrong }).first().click(); await page.waitForTimeout(900);
  check('a missed rung is offered to the other team',
        /steal it for 50/i.test(await page.locator('#m-hint').innerText()),
        await page.locator('#m-hint').innerText());
  await page.locator('.m-option', { hasText: right }).first().click(); await page.waitForTimeout(900);
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
  await opt.first().click();
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
  await page.evaluate(() => localStorage.removeItem('engishism.gamehub.settings'));
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

  /* A team that buzzed and missed must not be able to buzz straight back in — that
     is a retry, not a steal, and it leaves the other team nothing to win. */
  await host.waitForTimeout(700);
  const next = await currentRaceAnswer(host);
  check('a fresh sentence armed the buzzers again', !(await bruno.locator('#buzzer').isDisabled()));
  await bruno.locator('#buzzer').click(); await host.waitForTimeout(500);
  await host.locator('.race-word')
            .filter({ hasNotText: new RegExp('^' + next + '$','i') }).first().click();
  await host.waitForTimeout(600);

  await bruno.locator('#buzzer').click(); await host.waitForTimeout(600);
  check('the team that missed cannot buzz back in',
        !(await host.locator('#buzzer-chip').innerText()).includes('Bruno'),
        (await host.locator('#buzzer-chip').innerText()).replace(/\n/g,' '));
  await alina.locator('#buzzer').click(); await host.waitForTimeout(600);
  check('but the other team can still take the steal',
        (await host.locator('#buzzer-chip').innerText()).includes('Alina'),
        (await host.locator('#buzzer-chip').innerText()).replace(/\n/g,' '));

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
    millionaire: testMillionaire, fit: testBoardFitAcrossScreens, phone: testPhoneLayout,
    settings: testSettings, scoping: testPerGameSettings, migration: testSettingsMigration,
    variants: testFlipVariants, winroute: testWinRouteVariants, gameshow: testGameShow, gsjeopardy: testGameShowJeopardy, gsblockbusters: testGameShowBlockbusters, gsrace: testGameShowRace, idents: testIdentsAreDistinct, registry: testGameRegistry, prompts: testPromptTypes, content: testContentIntegrity, defaultlook: testDefaultLook, jfinish: testJeopardyFinish, competition: testCompetition,
    buzzers: testBuzzers,
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
