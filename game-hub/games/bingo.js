/* ================= Bingo — the fifth game, in its own file =================

   The second game extracted from the engine, and the one that shaped the
   contract: it is the only game whose per-player state the phone layer used to
   reach by name — dealt cards re-sent on room recovery, a latecomer dealt in on
   every roster push, a tap consumed before the shared reply path. Those are the
   `onRoomReady` / `onPlayers` / `onRoomForgot` / `onPhoneReply` hooks now, so a
   future game holding hands, roles or scorecards declares them instead of
   growing new by-name reach-ins.

   Same shape as `games/quickfire.js`, which is the model: registers into
   `window.HubGames`, declares its stage as `stageHTML`, reaches the engine
   through `window.HubEnv` inside hooks only, wires its DOM on first `load()`. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  /* The engine's lent capabilities — resolved at call time; the engine loads
     after this file, so `HubEnv` does not exist at parse. */
  const E = () => window.HubEnv;

  /* Bingo's settings (bingoCards, bingoPoints) are declared in
     game-hub/games/bingo-settings.js. Board stays the default and the fallback: no
     relay, no wifi, or phones banned that week and the game still runs. */

  /* The stage exists only after the engine injects it, so the two buttons are
     wired on the first `load` rather than at parse. */
  let wired = false;
  function wire(){
    if(wired) return;
    wired = true;
      document.getElementById('bingo-start').addEventListener('click', nextBingoCall);
      document.getElementById('bingo-skip').addEventListener('click', () => {
        // nobody had it: the word goes back in the bag rather than out of the game
        if(bingoCurrent) bingoQueue.push(bingoCurrent);
        bingoCurrent = null; bingoRunning = false;
        setBingoPrompt(null);
        setBingoMessage('Put back. Next word when you are ready.');
        document.getElementById('bingo-start').style.display = 'inline-block';
        document.getElementById('bingo-start').textContent   = '▶ Next word';
        document.getElementById('bingo-skip').style.display  = 'none';
        E().resetBuzzers();
        bingoTension();
      });  }

  /* Bingo is the fifth game and it was built as a test of the framework: how much
     of what the other four needed does a new board get for free? It consumes the
     **Blockbusters bank** rather than one of its own — the answers there are
     already single words with a clue each, which is exactly a bingo call — so both
     units gained a fifth game with no authoring at all. That is a preview of the
     pooled-content idea: a game declaring what it can consume, instead of a bank
     being written for it. */
  window.HubGames.register({
    id:'bingo', title:'Bingo',
    /* Fifth of the six — built-ins sit at 50, Quickfire at 60. This file loads
       before the engine, and without the number it would jump to the front. */
    order: 55,
    /* This is what bingo actually is: a card each. `bingoCards:'phones'` already
       deals one per student, so solo is the shape it was reaching for. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="30" height="30" rx="2"/><path d="M15 5 L15 35 M25 5 L25 35 M5 15 L35 15 M5 25 L35 25"/><path d="M7 17 L13 23 M13 17 L7 23" stroke-width="2.4"/><path d="M27 27 L33 33 M33 27 L27 33" stroke-width="2.4"/></svg>',
      blurb:'Every team gets a card of words. Read a clue &mdash; the first team to answer marks it off. Three in a row wins.',
      badge:'Best for: whole-class listening, everyone in at once' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'BINGO',
            sub:'Nine words each. Listen for yours. Three in a row.', accent:'#FF7AC8' },
    /* **Its own bank if the unit has one, Blockbusters' if not.** It began as
       "the same bank Blockbusters uses", which held for as long as that bank was
       single-word answers with a clue apiece — exactly what a bingo call is. A
       unit whose Blockbusters board is all *rounds* has none of those: a round
       hexagon carries no `answer` at all, so `bingoWordsIn` finds nothing and the
       game silently leaves the unit. `bingoBank` is where those calls live once
       the hexagons stop being them, and the fallback keeps every unit that has
       not been converted working untouched. */
    hasBank: u => bingoWordsIn(u.bingoBank || u.blockbustersBank || []).length >= BINGO_POOL,
    /* The room's beats — the three hooks this game forced onto the contract,
       replacing the phone layer reaching for its state by name. */
    onRoomReady(){ bingoDealHands(); },
    onPlayers(){ bingoDealHands(); },
    /* The relay restarted and forgot every card. The hands here are the
       originals — the host deals and judges — so the room gets the same cards
       back, marks and all, rather than fresh ones mid-game. */
    onRoomForgot(){
      if(E().room() && bingoHands.size){
        const out = {};
        bingoHands.forEach((h, id) => { out[id] = h.words.map(w => w.answer); });
        E().room().deal(out);
        bingoHands.forEach((h, id) => h.marked.forEach((m, i) => {
          if(m) E().room().mark(id, h.words[i].answer);
        }));
      }
    },
    /* A tap on a bingo card is a typed answer without the typing — judged per
       player, marks that player's own card, and is nobody's team answer. */
    onPhoneReply(r){ return bingoOnPhones() && onBingoTap(r); },
    load(u){ wire();
             BINGO_BANK          = u.bingoBank || u.blockbustersBank || [];
             BINGO_SECTION_NAMES = u.blockbustersSectionNames || {};
             BINGO_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => bingoWordsIn(BINGO_BANK),
    stageHTML: `
<div id="play-bingo">
  <div id="bingo-prompt"></div>
  <div id="bingo-bar">
    <div id="bingo-status"></div>
    <div class="bingo-actions">
      <button id="bingo-start">&#9654; First word</button>
      <button id="bingo-skip" style="display:none;">Nobody had it</button>
    </div>
  </div>
  <div id="bingo-cards"></div>
</div>`,
    renderContent: renderBingoContent,
    startButton:   bingoStartButton,
    /* Cards on phones needs a room even at `phoneMode: off` — the cards *are* the
       dynamic, so the mode has nothing to say about it. Same shape as Millionaire
       keeping a room open for Ask the class. */
    wantsVote:   () => bingoOnPhones(),
    roomNote:    () => bingoOnPhones() ? 'cards on phones' : null,
    /* With the cards in their hands the phones have a job already, so the mode does
       not get a say — nine words to tap is the dynamic. With the cards on the board
       this returns null and buzz / everyone-types / type-then-buzz work exactly as
       they do in the other games. */
    phoneRound(){
      if(!bingoOnPhones() || !bingoCurrent) return null;
      return { mode:'card',
               prompt: S.get('phonePrompt', 'bingo') ? (bingoCurrent.clue || bingoCurrent.prompt || '') : '',
               keepSpent:true };
    },
    expects:     () => (bingoCurrent && bingoCurrent.answer) || '',
    phonePrompt: () => (bingoCurrent && (bingoCurrent.clue || bingoCurrent.prompt)) || '',
    askingNow:   () => !!bingoCurrent && !bingoWon,
    /* Typed and correct marks their square, the way it claims a tile elsewhere. A
       word that is not on their card is still a right answer — the strip says so —
       but there is nothing to mark, so it pays nothing rather than declining. */
    onTypedWin(b){
      const card = bingoCards[b.team];
      if(!bingoCurrent || !card) return null;
      const ci = card.words.findIndex((w, i) => !card.marked[i] && w.answer === bingoCurrent.answer);
      return ci >= 0 ? (markBingoCell(b.team, ci) || 1) : 0;
    },
    start(){ startBingo(); },
    fit:      fitBingoCards,
    deal:     bingoDeal,
    tension(){ bingoTension(); },
    onResize: fitBingoCards
  });


  /* ================= BINGO =================
     The fifth game, and deliberately the first one written *after* the framework
     settled — so what it had to reach into is the measure of how well the framework
     ports. It scores, times, skins, fits, ends and talks to the phones through the
     shared layer; what it owns is a card, a call and a line.

     Its content is not its own. `blockbustersBank` is already a list of
     single-word answers with a clue each, which is exactly what a bingo call is,
     so both units gained this game with no authoring. */
  let BINGO_BANK = [], BINGO_SECTION_NAMES = {}, BINGO_TOPIC_NAMES = {};
  const BINGO_SIZE = 3;                 // 3x3 card, so a line is three
  const BINGO_POOL = 12;                // shared words in play: 9 per card + spares
  let bingoWords   = [];                // the words in play this round
  let bingoCards   = [];                // per team: { words:[…], marked:[bool…] }
  let bingoCurrent = null;              // the call on the table
  let bingoQueue   = [];
  let bingoWon     = null;
  let bingoRunning = false;

  /* A word can only be a bingo call if it is one word and unique in the round —
     two cells reading the same thing makes "mark it off" ambiguous. Same class of
     constraint as Race's board, and it lives with the game that needs it rather
     than in the content. */
  function bingoWordsIn(bank){
    const seen = new Set();
    return bank.filter(c => {
      const a = String(c.answer || '').trim();
      if(!a || /\s/.test(a)) return false;
      const k = a.toLowerCase();
      if(seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  function renderBingoContent(list, help){
    help.textContent = "Pick the topics that feed the cards. Every team gets nine of the same pool of words, so the same clue can be worth marking for more than one of them — the first to answer takes it.";
    E().groupCheckboxes(list, bingoWordsIn(BINGO_BANK), BINGO_TOPIC_NAMES, BINGO_SECTION_NAMES);
  }

  function bingoStartButton(btn){
    const total = bingoWordsIn(BINGO_BANK).filter(E().inPlay).length;
    E().startGate(btn, { picked: E().selectedContent().length > 0, total, need: BINGO_POOL,
      short: `Need ${BINGO_POOL} words`,
      ready: `Deal the cards — ${BINGO_POOL} of ${total} words` });
  }

  function startBingo(){
    const pool = E().shuffle(bingoWordsIn(BINGO_BANK).filter(E().inPlay));
    bingoWords = pool.slice(0, BINGO_POOL);
    dealBingoCards();
    bingoQueue   = E().shuffle(bingoWords.slice());
    bingoCurrent = null;
    bingoWon     = null;
    bingoRunning = false;
    bingoHands = new Map();
    if(bingoOnPhones()){ bingoDealHands(); renderBingoRoom(); }
    else buildBingoCards();
    setBingoMessage(bingoOnPhones()
      ? 'Cards are on the phones. Press First word when the class is ready.'
      : 'Press First word when the class is ready.');
    document.getElementById('bingo-start').style.display = 'inline-block';
    document.getElementById('bingo-skip').style.display  = 'none';
    document.getElementById('bingo-prompt').classList.remove('live');
    document.getElementById('bingo-prompt').textContent = '';
    E().syncBuzzRoom();
    E().timerSetDuration(30);
  }

  /* Every team gets nine of the same pool, shuffled — so the cards overlap and a
     call is usually live for more than one team, which is what makes it a race
     rather than a set of parallel solitaires. Re-dealt on a team being added or
     removed, because a card without a team is not a thing. */
  function dealBingoCards(){
    bingoCards = E().teams().map(() => {
      const words = E().shuffle(bingoWords.slice()).slice(0, BINGO_SIZE * BINGO_SIZE);
      return { words, marked: words.map(() => false) };
    });
  }

  /* The call goes out as a `card` round: every phone shows its own nine words and
     taps one. `phonePrompt` still decides whether the clue travels with it — off is
     arguably the better lesson, because then it is listening rather than reading. */
  function askBingoCards(w){
    if(!E().room()) return;
    bingoDealHands();
    // the shared path: `phoneRound` above tells it this is a card round
    E().askPhones(w.clue || w.prompt || '', 'bingo');
  }

  function buildBingoCards(){
    const wrap = document.getElementById('bingo-cards');
    wrap.innerHTML = '';
    if(bingoCards.length !== E().teams().length) dealBingoCards();
    E().teams().forEach((t, ti) => {
      const card = document.createElement('div');
      card.className = 'bingo-card';
      card.dataset.team = ti;
      const head = document.createElement('div');
      head.className = 'bingo-name';
      head.textContent = t.name;
      const grid = document.createElement('div');
      grid.className = 'bingo-grid';
      bingoCards[ti].words.forEach((w, ci) => {
        const cell = document.createElement('button');
        cell.className = 'bingo-cell' + (bingoCards[ti].marked[ci] ? ' marked' : '');
        cell.type = 'button';
        cell.textContent = w.answer;
        cell.dataset.team = ti; cell.dataset.cell = ci;
        cell.addEventListener('click', () => onBingoCell(ti, ci));
        grid.appendChild(cell);
      });
      card.appendChild(head); card.appendChild(grid);
      wrap.appendChild(card);
    });
    fitBingoCards();
  }

  function setBingoMessage(txt){
    document.getElementById('bingo-status').textContent = txt;
  }

  function setBingoPrompt(item){
    const el = document.getElementById('bingo-prompt');
    el.innerHTML = '';
    if(!item){ el.classList.remove('live'); return; }
    el.classList.add('live');
    const sec = document.createElement('span'); sec.className = 'bingo-sec';
    sec.textContent = item.section || '';
    const body = document.createElement('span'); body.className = 'bingo-clue';
    // the shared renderer, so a gap fill or an anagram draws here exactly as it
    // does on the other four boards — this game wrote no prompt code at all
    E().drawPrompt(body, { text:item.clue || item.prompt, answer:item.answer, type:item.type }, 'bingo');
    el.appendChild(sec); el.appendChild(body);
  }

  /* A call is only worth making while somebody could still mark it — which is the
     cards on the board, or the cards in their hands, depending on where they are. */
  function bingoLiveFor(word){
    const held = bingoOnPhones() ? [...bingoHands.values()] : bingoCards;
    return held.some(c => c.words.some((w, i) => !c.marked[i] && w.answer === word.answer));
  }


  /* A word stays in the bag while anybody could still use it, so a call nobody took
     comes round again rather than being spent. Without this a class of thirty runs
     out of calls long before anybody has a line. */
  function bingoRequeue(word){
    if(word && bingoLiveFor(word) && bingoQueue.indexOf(word) === -1) bingoQueue.push(word);
  }

  function nextBingoCall(){
    bingoRequeue(bingoCurrent);
    while(bingoQueue.length){
      const w = bingoQueue.shift();
      if(bingoLiveFor(w)){
        bingoCurrent = w;
        bingoRunning = true;
        setBingoPrompt(w);
        setBingoMessage('Who has it? Click the word on their card.');
        document.getElementById('bingo-start').style.display = 'none';
        document.getElementById('bingo-skip').style.display  = 'inline-block';
        if(bingoOnPhones()){
          askBingoCards(w);
          /* On phones a call is not a race: everybody holding that word marks it,
             so the call stays open and the teacher moves on when the room has had
             long enough. On the board it *is* a race — one team gets the square —
             so there the call closes as soon as somebody takes it. */
          document.getElementById('bingo-start').style.display = 'inline-block';
          document.getElementById('bingo-start').textContent   = '▶ Next word';
          document.getElementById('bingo-skip').style.display  = 'none';
          setBingoMessage('Everyone who has it, tap it. Next word when you are ready.');
        } else {
          E().askPhones(w.clue || w.prompt || '', 'bingo');
        }
        E().Sound.play('reveal');
        bingoTension();
        return;
      }
    }
    // everything on every card is marked and nobody has a line
    bingoCurrent = null; bingoRunning = false;
    setBingoPrompt(null);
    setBingoMessage('Every word has gone and no one has a line.');
    document.getElementById('bingo-skip').style.display = 'none';
    bingoFinish({ type:'blocked' });
  }

  /* ---- cards in their hands ----
     The board version is two to four cards a class shares and watches; this gives
     every student their own, which is what bingo actually is and what fixes the
     weakness it shares with Blockbusters — two people play and the rest watch.

     Three rules it is built on:
     - **The host deals and the host judges.** The relay stores a card so a phone
       that drops off the wifi gets it back with its marks, but it is never told
       which word the clue means, exactly as it is never told a typed answer.
     - **A tap is a typed answer without the typing**, so it arrives through the
       same path as `write` and is judged by `K.answer.judge` against `expects()`.
     - **A student's line scores for their team**, so the team bar and everything
       hanging off it stays true rather than needing a parallel system. */
  let bingoHands = new Map();   // playerId -> { name, team, words:[…], marked:[…] }

  function bingoOnPhones(){
    return window.HubGames.active() === 'bingo' && S.get('bingoCards', 'bingo') === 'phones';
  }

  function bingoDealHands(){
    if(!bingoOnPhones() || !E().room() || !bingoWords.length) return;
    const roster = E().room().players();
    const out = {};
    let dealt = 0;
    roster.forEach(p => {
      if(bingoHands.has(p.id)){
        // already holding a card: keep it, or a late joiner would reshuffle the room
        const h = bingoHands.get(p.id);
        h.name = p.name; h.team = p.team;
        return;
      }
      const words = E().shuffle(bingoWords.slice()).slice(0, BINGO_SIZE * BINGO_SIZE);
      bingoHands.set(p.id, { name:p.name, team:p.team, words, marked:words.map(()=>false) });
      out[p.id] = words.map(w => w.answer);
      dealt++;
    });
    if(dealt) E().room().deal(out);
    renderBingoRoom();
  }

  /* A tap, judged. Right marks their square and scores for their team; wrong costs
     nothing but a moment, the same trade the typing race makes. */
  function onBingoTap(r){
    if(!bingoOnPhones() || !bingoCurrent || bingoWon) return false;
    const hand = bingoHands.get(r.id);
    if(!hand) return false;
    const verdict = K.answer.judge(r.value, bingoCurrent.answer);
    const ok = verdict === 'right' || (verdict === 'close' && !S.get('typeStrict', 'bingo'));
    if(!ok){
      E().room().nope(r.id, r.value);
      E().notePhoneMiss(hand.name, hand.team, r.value, verdict);
      return true;
    }
    const i = hand.words.findIndex((w, n) => !hand.marked[n] && w.answer === bingoCurrent.answer);
    if(i === -1){ E().room().nope(r.id, r.value); return true; }
    hand.marked[i] = true;
    E().room().mark(r.id, hand.words[i].answer);
    const paid = E().award(hand.team, Number(S.get('bingoPoints', 'bingo')) || 1,
                       { why:'bingo square · ' + hand.name }) || 1;
    E().notePhoneScore(hand.name, hand.team, r.value, paid);
    E().Sound.play('claim');
    const line = bingoHandLine(hand);
    if(line){ bingoFinishHand(r.id, hand, line); return true; }
    renderBingoRoom();
    bingoTension();
    return true;
  }

  function bingoHandLine(hand){
    return bingoLines().find(line => line.every(i => hand.marked[i])) || null;
  }

  function bingoFinishHand(id, hand, line){
    bingoWon = { type:'win', player:id, hand, line, team:hand.team };
    bingoRunning = false;
    renderBingoRoom();          // the winning card's own progress was a call behind
    document.getElementById('bingo-skip').style.display  = 'none';
    document.getElementById('bingo-start').style.display = 'none';
    /* Disarm, don't reset. A reset clears the cards off every phone — and the first
       thing that happens after a line is the teacher reading it back off the
       winner's card, which is hard to do when their phone has just gone blank. The
       cards clear on New cards, which is where a new round starts. */
    E().clearFloor();
    if(E().room()) E().room().disarm();
    const lit = document.getElementById('play-bingo').classList.contains('lit');
    if(lit){ E().Sound.fanfare(); setTimeout(() => E().Sound.applause(2400), 620); }
    else E().Sound.play('clear');
    E().showResult({
      eyebrow:'Bingo',
      title: hand.name + ' has a line!',
      // the teacher reads the card back, which is what bingo has always done and is
      // a speaking beat rather than dead time
      sub:   'Playing for ' + (E().teams()[hand.team] ? E().teams()[hand.team].name : 'their team') +
             ' — check the card: ' + line.map(i => hand.words[i].answer).join(', '),
      tone:  hand.team === 0 ? 'gold' : 'silver',
      actions:[{ label:'New cards', primary:true, onPick:bingoPlayAgain },
               { label:'Leave it up', onPick:function(){} }]
    });
  }

  /* With thirty cards there is nothing useful to draw of them, so the board shows
     what the room needs: how many have it, and who is one square away. */
  function renderBingoRoom(){
    const wrap = document.getElementById('bingo-cards');
    if(!bingoOnPhones()){ return; }
    wrap.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'bingo-room';
    const hands = [...bingoHands.values()];
    if(!hands.length){
      panel.innerHTML = '<p class="bingo-room-note">Cards are dealt as students join. ' +
                        'Nobody has one yet.</p>';
      wrap.appendChild(panel);
      return;
    }
    const close = hands.map(h => ({ h, best: Math.max.apply(null,
      bingoLines().map(l => l.filter(i => h.marked[i]).length)) }))
      .sort((a, b) => b.best - a.best);
    const head = document.createElement('div');
    head.className = 'bingo-room-head';
    head.textContent = hands.length + (hands.length === 1 ? ' card in play' : ' cards in play');
    panel.appendChild(head);
    const list = document.createElement('div');
    list.className = 'bingo-room-list';
    close.slice(0, 12).forEach(({ h, best }) => {
      const chip = document.createElement('span');
      chip.className = 'bingo-room-chip team-' + Math.min(h.team, 3) + (best >= BINGO_SIZE - 1 ? ' hot' : '');
      chip.textContent = h.name + ' · ' + best + '/' + BINGO_SIZE;
      list.appendChild(chip);
    });
    panel.appendChild(list);
    wrap.appendChild(panel);
    fitBingoCards();
  }

  /* A test hook, not a game feature: the answer to the call is deliberately not in
     the DOM (the class has to work it out), so a scripted round has no other way to
     know which square is the right one. */
  // a test hook: the re-ask path is what a reconnection triggers, and it is the
  // one that used to replace a card with a buzzer
  window.__reask = function(){ E().reaskPhones(); };
  window.__bingoAnswer = function(){ return bingoCurrent ? bingoCurrent.answer : null; };
  window.__bingoProbe = function(){
    if(!bingoCurrent || !bingoCards[0]) return -1;
    return bingoCards[0].words.findIndex((w, i) => !bingoCards[0].marked[i] && w.answer === bingoCurrent.answer);
  };

  function onBingoCell(ti, ci){
    if(bingoWon) return;
    const card = bingoCards[ti];
    if(!card || card.marked[ci]) return;
    if(!bingoCurrent){ setBingoMessage('Press First word to make a call.'); return; }
    if(card.words[ci].answer !== bingoCurrent.answer){
      // a wrong square costs nothing — the call stays up and another team can take it
      const el = document.querySelector(`.bingo-cell[data-team="${ti}"][data-cell="${ci}"]`);
      if(el){ el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 420); }
      E().Sound.play('wrong');
      return;
    }
    markBingoCell(ti, ci);
  }

  function markBingoCell(ti, ci){
    const card = bingoCards[ti];
    card.marked[ci] = true;
    const el = document.querySelector(`.bingo-cell[data-team="${ti}"][data-cell="${ci}"]`);
    if(el) el.classList.add('marked');
    const paid = E().award(ti, Number(S.get('bingoPoints', 'bingo')) || 1, { why:'bingo square' });
    E().markRun(ti, true);
    E().Sound.play('claim');
    E().setActiveTeam(ti); E().renderScorebar();
    const line = bingoLine(ti);
    if(line){ bingoFinish({ type:'win', team:ti, line }); return paid; }
    bingoCurrent = null; bingoRunning = false;
    setBingoPrompt(null);
    setBingoMessage('Marked. Next word when you are ready.');
    document.getElementById('bingo-start').style.display = 'inline-block';
    document.getElementById('bingo-start').textContent   = '▶ Next word';
    document.getElementById('bingo-skip').style.display  = 'none';
    E().resetBuzzers();
    bingoTension();
    return paid;
  }

  /* Rows, columns and both diagonals of a BINGO_SIZE square, worked out from the
     size rather than written down — the same reason Blockbusters' adjacency comes
     from BB_ROWS. Change the card to 4x4 and the win logic follows. */
  function bingoLines(){
    const n = BINGO_SIZE, out = [];
    for(let r = 0; r < n; r++) out.push(Array.from({length:n}, (_, c) => r*n + c));
    for(let c = 0; c < n; c++) out.push(Array.from({length:n}, (_, r) => r*n + c));
    out.push(Array.from({length:n}, (_, i) => i*n + i));
    out.push(Array.from({length:n}, (_, i) => i*n + (n-1-i)));
    return out;
  }
  function bingoLine(ti){
    const card = bingoCards[ti];
    if(!card) return null;
    return bingoLines().find(line => line.every(i => card.marked[i])) || null;
  }
  // how close the nearest team is to a line, as 0..1 — the tension source
  function bingoBest(){
    let best = 0;
    bingoCards.forEach(card => {
      bingoLines().forEach(line => {
        const got = line.filter(i => card.marked[i]).length;
        if(got > best) best = got;
      });
    });
    return best;
  }

  function bingoFinish(outcome){
    bingoWon = outcome;
    bingoRunning = false;
    document.getElementById('bingo-skip').style.display  = 'none';
    document.getElementById('bingo-start').style.display = 'none';
    E().resetBuzzers();
    if(outcome.type !== 'win'){
      E().Sound.play('end');
      E().showResult({ eyebrow:'Bingo', title:'Cards full', sub:'Every word has gone without a line.',
                   actions:[{ label:'New cards', primary:true, onPick:bingoPlayAgain }] });
      return;
    }
    outcome.line.forEach(i => {
      const el = document.querySelector(`.bingo-cell[data-team="${outcome.team}"][data-cell="${i}"]`);
      if(el) el.classList.add('line');
    });
    const lit = document.getElementById('play-bingo').classList.contains('lit');
    if(lit){ E().Sound.fanfare(); setTimeout(() => E().Sound.applause(2400), 620); }
    else E().Sound.play('clear');
    E().showResult({
      eyebrow:'Bingo',
      title: ((E().teams()[outcome.team] && E().teams()[outcome.team].name) || 'Team') + ' has a line!',
      sub:   'Three in a row.',
      tone:  outcome.team === 0 ? 'gold' : 'silver',
      actions:[{ label:'New cards', primary:true, onPick:bingoPlayAgain },
               { label:'Leave it up', onPick:function(){} }]
    });
  }

  function bingoPlayAgain(){
    hideResult();
    bingoHands = new Map();
    if(E().room()) E().room().reset();
    document.querySelectorAll('#bingo-cards .bingo-cell.line').forEach(el => el.classList.remove('line'));
    document.getElementById('bingo-start').textContent = '▶ First word';
    startBingo();
    bingoDeal();
  }

  function fitBingoCards(){
    const wrap = document.getElementById('bingo-cards');
    if(!wrap || !document.getElementById('play-bingo').offsetParent) return;
    // the shared fit: no per-game measuring of the header and the team bar
    K.fitToScreen(wrap, { min:120, gap:12, floor:true });
  }

  function bingoDeal(){
    if(bingoOnPhones()) return;      // nothing on the board to deal in
    const cells = [...document.querySelectorAll('#bingo-cards .bingo-cell')];
    cells.forEach(el => { el.style.removeProperty('animation'); void el.offsetWidth; });
    cells.forEach((el, i) => {
      const card = +el.dataset.team, cell = +el.dataset.cell;
      // stagger across the card, not down the DOM: four cards of nine is 36 cells
      el.style.animation = `bingoDeal .34s ${(card * 40 + cell * 26)}ms both`;
    });
  }

  function bingoTension(){
    E().stageTension('bingo', () => {
      // one square off a line is as tense as this board gets
      const best = bingoOnPhones()
        ? [...bingoHands.values()].reduce((m, h) => Math.max(m,
            ...bingoLines().map(l => l.filter(i => h.marked[i]).length)), 0)
        : bingoBest();
      return { t: Math.max(0, Math.min(1, (best - 1) / (BINGO_SIZE - 1))),
               live: !!(bingoRunning && bingoCurrent && !bingoWon) };
    });
  }

})();
