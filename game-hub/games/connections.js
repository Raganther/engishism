/* ================= Connections — a round-first PROBE, not a shipped game =================

   **This is a diagnostic, wired only into `game-hub-lab.html`.** It asks one question:
   can a round stand as its own game with no board, and *what does it have to reach into
   the shared clue card for*? It plays the `grouping` (Connections) round in sequence —
   pick content, open a round on the shared card, judge it, next, ending — with no
   geometry of its own. Everything visible is drawn on the shared clue card via
   `E().cardMount()`; the stage is a bare panel that exists only so `roundHost.stage`
   resolves.

   It is modelled on `blockbusters.js` (the nearest card host — the open-card sequence is
   copied from it almost verbatim, on purpose: that duplication is the coupling the probe
   is meant to make visible) and `quickfire.js` (the thinnest sequence host).

   COUPLING THIS EXPOSES — read the inline `PROBE:` notes below, they are the findings:
   1. `modalMode` is an untyped free string this host invents ('connections') and echoes
      in `live()`. No registry of legal values.
   2. Opening a round on the card is a hand-ordered ~12-step choreography with three
      load-bearing ordering constraints — duplicated here, in jeopardy.js and in
      blockbusters.js. There is no `E().openRoundOnCard(item, host)` entry point.
   3. `K.round.fields()` must be hand-copied per clue or the round silently drops to text.
   4. The clue-card buttons are one shared imperative pool; a self-judging round needs
      almost none of them yet must still drive them.
   5. There is no "next question" seam for a sequence host on the card — `win()` has to
      close the card AND schedule the next question itself, and the give-up path needs a
      second seam (`onClueClose`). Grouping also has no content channel of its own, so
      this file carries its own bank. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  const E = () => window.HubEnv;

  const WORTH = 1;                 // a group is worth one point; the standings show movement

  let pool = [];                   // the questions this run, shuffled
  let at   = -1;                   // index into pool
  let current = null;              // the item on the card now
  let over = false;                // the run has ended

  /* PROBE 5 (content): grouping has no bank of its own — it normally rides a card game's
     bank and the K.round.fields() copy. A skinless host has nowhere to source it from, so
     the probe authors its own. Shape per content/unit-lab.js: {text, group:{pick,with}} —
     `pick` are the four that belong, `with` the four near-miss distractors. */
  const CONNECTIONS_BANK = [
    { section:'Feelings', text:'Four of these mean extremely happy. Find the four.',
      group:{ pick:['elated','ecstatic','jubilant','overjoyed'],
              with:['content','pleased','cheerful','glad'] } },
    { section:'Grammar', text:'Four of these nouns are uncountable. Find the four.',
      group:{ pick:['advice','luggage','furniture','information'],
              with:['suitcase','chair','suggestion','fact'] } },
    { section:'Business', text:'Four of these mean to reduce. Find the four.',
      group:{ pick:['slash','trim','lower','reduce'],
              with:['boost','raise','inflate','hike'] } },
    { section:'Vocabulary', text:'Four of these are strong (ungradable) adjectives. Find the four.',
      group:{ pick:['freezing','boiling','starving','furious'],
              with:['cold','hot','hungry','angry'] } }
  ];

  /* This board's round-host entry — merged into ROUND_HOSTS at engine init. The whole
     host is this ~10-line block; everything else in the file is either content or the
     card choreography the probe exists to expose. */
  const HOST = {
    game:'connections', stage:'play-connections',
    /* Draws its round into the shared clue card — declared as `onCard`, not inferred from
       mount identity (an external mount is a wrapper, never the engine's CARD_MOUNT). */
    mount: () => E().cardMount(), onCard: true, commit:'group-btn',
    /* PROBE 1: `live()` is the host echoing a free string it also wrote via setModalMode.
       Nothing validates 'connections' against anything. */
    live: () => E().modalMode() === 'connections',
    turn: () => E().activeTeam(),
    /* PROBE 5: the win seam. roundPaySlot() pays through this but does NOT close the card,
       so — exactly like jeopardy's jCorrect and blockbusters' claimHex — `win` must award,
       close the card, and schedule the next question. That is the sequence host's only
       "advance after a win" hook, and it is not declared anywhere: it is a side effect of
       the pay function. */
    win: team => {
      const paid = E().award(team, WORTH, { why:'connections' });
      E().closeModal(E().flipHoldMs(), nextConnections);
      return paid;
    },
    worth: () => WORTH, step: () => 1,
    /* Team-based: the four are a team's answer, so any round it hosts waits for the whole
       team rather than paying the fastest tap (degrades correctly in a solo room). */
    teamMode: true
  };

  window.HubGames.register({
    id:'connections', title:'Connections',
    order: 99,                    // sorts last; this is a probe, not a headline game
    solo: true,                   // grouping supports individuals; every phone finds the four
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="12" height="12" rx="2"/><rect x="23" y="5" width="12" height="12" rx="2"/><rect x="5" y="23" width="12" height="12" rx="2"/><rect x="23" y="23" width="12" height="12" rx="2"/></svg>',
      blurb:'Eight words, four belong together. The room finds the four. A round played as its own game — no board.',
      badge:'PROBE · lab only' },
    intro:{ eyebrow:'Round-first probe', title:'CONNECTIONS',
            sub:'Find the four that belong.', accent:'#C77DFF' },
    hasBank: () => CONNECTIONS_BANK.length > 0,
    fitsScreen: true,
    roundHost: HOST,
    /* A bare panel — no geometry. It exists only so `roundHost.stage` resolves for the
       engine's `.lit` show-skin lookups; everything is drawn on the shared clue card. */
    stageHTML: `<div id="play-connections"></div>`,
    load(){ /* content is self-contained; nothing to pull from the unit */ },
    bank: () => CONNECTIONS_BANK,
    renderContent: renderConnectionsContent,
    startButton:   connectionsStartButton,
    start(){ startConnections(); },
    /* Phone hooks — identical to the card games: the round IS the phone dynamic. */
    expects:     () => (E().clueItem() && E().clueItem().answer) || '',
    phonePrompt: () => (E().clueItem() && E().clueItem().text) || '',
    askingNow:   () => E().clueIsOpen(),
    buzzEntitled: () => !E().roundLive(),   // a grouping clue has no floor to take
    wantsVote:   () => E().roundLive(),
    roomNote:    () => E().roundLive() ? 'find the four' : null,
    onVoteReply(all){ E().roundOnReplies(all); },
    phoneRound(){ return E().roundForPhones(); },
    /* PROBE 4: a self-judging round needs none of Correct/Wrong. On reveal (the teacher
       gives up) it only wants Close — but it must still drive the shared button pool by
       hand to stop a stranded card. The shared reveal handler already lit the four via
       the round's own reveal; this just fixes the buttons. */
    onClueReveal(){
      document.getElementById('reveal-btn').style.display = 'none';
      document.getElementById('close-btn').style.display  = 'inline-block';
    },
    /* PROBE 5: the give-up / skip seam — the second place "advance" has to be wired,
       because the win seam (above) only covers a question that was taken. */
    onClueClose(){ E().closeModal(0, nextConnections); }
  });

  /* PROBE 5: one section per theme, picked like any content screen. */
  function renderConnectionsContent(list, help){
    help.textContent = 'Pick which sets to play. Each is eight words — four belong together.';
    E().groupCheckboxes(list, CONNECTIONS_BANK, {}, {});
  }
  function selectedConnections(){
    return CONNECTIONS_BANK.filter(i => E().selectedContent().includes(E().groupOf(i)));
  }
  function connectionsStartButton(btn){
    const n = selectedConnections().length;
    btn.disabled = !n;
    btn.textContent = n ? ('Play Connections — ' + n + (n === 1 ? ' round' : ' rounds')) : 'Pick at least one set';
  }

  function startConnections(){
    pool = E().shuffle(selectedConnections().slice());
    at = -1; over = false;
    nextConnections();
  }

  function nextConnections(){
    at++;
    if(at >= pool.length){ finishConnections(); return; }
    current = pool[at];
    openConnectionsClue(current);
  }

  /* PROBE 2: the open-card choreography — copied almost verbatim from
     `blockbusters.js` openBlockbustersClue, with the board-specific bits (the hexagon,
     the vote) dropped. The ordering below is load-bearing in three places and there is no
     shared helper for it. */
  function openConnectionsClue(bankItem){
    E().setCurrentTile(null);
    E().setModalMode('connections');                         // PROBE 1: invent + write the string
    document.getElementById('clue-topline').textContent = 'CONNECTIONS';
    document.getElementById('clue-section').textContent = bankItem.section || '';

    const item = { text:bankItem.text, type:bankItem.type };
    // PROBE 3: carry the round's authored fields across, or `group` never reaches setup
    K.round.fields().forEach(f => { if(bankItem[f] !== undefined) item[f] = bankItem[f]; });
    E().setClueItem(item);

    // roundOf BEFORE roundOpen — it names the host so setup's ctx is scoped to this board
    const rnd = E().roundOf(item, 'connections');
    if(rnd) item.answer = rnd.state.answer;                  // the answer is derived, not authored

    E().drawPrompt(document.getElementById('clue-text'), item, 'connections');
    E().roundEnd();                                          // stand the previous handsets down
    // opening the round arms the room; there is no ordinary-question fallback here
    if(!(rnd && E().roundOpen(rnd))) E().askPhones(bankItem.text, 'connections');

    const ansEl = document.getElementById('clue-answer');
    ansEl.style.display = 'none';
    ansEl.textContent = item.answer || '';

    E().hideAllActionButtons();
    document.getElementById('reveal-btn').style.display = 'inline-block';   // give up + reveal
    document.getElementById('close-btn').style.display  = 'inline-block';   // skip this one
    E().renderRoundButton();                                 // AFTER hideAllActionButtons — mints Check
    E().openClueCard(null);                                  // null origin: no tile to flip from
  }

  function finishConnections(){
    current = null; over = true;
    const rank = E().teams().map((t, i) => ({ i, name:t.name, pts:t.score }))
                            .sort((a, b) => b.pts - a.pts);
    const top = rank[0];
    if(!top) return;
    const tie = rank.filter(r => r.pts === top.pts);
    E().showResult({
      eyebrow: pool.length + (pool.length === 1 ? ' round' : ' rounds'),
      title:   tie.length > 1 ? 'A tie' : (top.name + ' wins'),
      sub:     tie.length > 1 ? tie.map(r => r.name).join(' and ') + ' — ' + top.pts + ' each'
                              : top.pts + (top.pts === 1 ? ' point' : ' points'),
      tone:    'gold',
      actions: [{ label:'New run', primary:true, onPick: startConnections }]
    });
  }
})();
