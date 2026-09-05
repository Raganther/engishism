/* ================= Millionaire — extracted from the engine into its own file =================

   Four options, rising difficulty. Every team climbs its **own** ladder and turns
   alternate: parallel ladders give each team a full arc, and interleaving the turns
   means nobody sits out for eight questions the way a one-team-at-a-time run would.
   Scoring is additive — a right answer banks that rung's value and nothing is ever
   taken away; a wrong answer costs the turn, and the team tries that rung again with
   a different question next time round.

   **Second of the four originals to leave `hub-engine.js`** (Quickfire and Bingo were
   already out). It is the cleanest to move: no clue card, no `modalMode`, its own
   stage. It reaches the engine only through `window.HubEnv` — inside hooks, never at
   parse, because this file loads before the engine. The one piece of engine coupling
   it could not carry alone is the per-team ladder being re-aligned when the roster
   changes: that is now a declared `onTeamsChanged` hook the engine fires, rather than
   the engine reaching into `mState` by name. */
(function(){
  'use strict';
  const K = window.HubKit;
  const S = window.HubSettings;
  /* The engine's lent capabilities — resolved at call time, because the engine loads
     after this file and `HubEnv` does not exist yet at parse. */
  const E = () => window.HubEnv;

  let MILLIONAIRE_BANK          = [];
  let MILLIONAIRE_SECTION_NAMES = {};
  let MILLIONAIRE_TOPIC_NAMES   = {};

  // scores in hundreds: corrections nudge by 100, payouts round to 50
  const NUDGE_STEP = 100, PAY_STEP = 50;
  const M_LADDER = [100, 200, 300, 500, 800, 1200, 1600, 2000];

  let mState   = [];     // per team: {rung, used:Set<prompt>, lifelines:{}}
  let mCurrent = null;   // {q, options[], team}
  let mAnswered = false;
  /* `mTally` is a boolean: true once Ask the class has run, which spends the lifeline
     and keeps its counts on the options. */
  let mTally   = null;
  let mCounting = false;
  /* A phone vote is open. Distinct from `mCounting` (the board behaves oppositely) and
     from `mTally` (the votes outlive the vote being open). */
  let mVoting = false;
  /* The option said out loud but not locked in — reversible until "Final answer?". */
  let mPicked  = null;

  /* This board's round-host entry — merged into the engine's ROUND_HOSTS at its init,
     so the shared adapter never learns the table gained a row from a file. */
  const HOST = {
    game:'millionaire', stage:'play-millionaire',
    /* No clue card: the options are the stage. A round handed a mount that is not the
       card (F3.8.9). */
    mount: () => document.getElementById('m-options'),
    commit:'m-final',
    /* A question is on screen and has not been answered. */
    live: () => !!mCurrent && !mAnswered,
    /* The team the question was dealt to — which is not `active` after a steal, and
       the steal is precisely when the difference matters. */
    turn: () => (mCurrent ? mCurrent.team : E().activeTeam()),
    scorer: () => (mCurrent ? mCurrent.team : E().activeTeam()),
    win:  team => mPayRung(team),
    /* The rung the team being paid is standing on — read per team, because every
       competitor climbs its own ladder and "what this question is worth" is a
       different number for each of them. */
    worth: team => M_LADDER[Math.min(mTeamState(team == null ? E().activeTeam() : team).rung,
                                     M_LADDER.length - 1)],
    // the board's payout unit, its own PAY_STEP (see Jeopardy's host)
    step:  () => PAY_STEP,
    /* The class votes on every question, so the counts exist from the first tap.
       Holding them back is what leaves Ask the class worth spending. */
    hideVotes: () => !mTally,
    /* Ask the class is about the whole room, not which team said what — one team
       answers at a time here anyway. */
    countVotes: () => true,
    commitText: () => 'Final answer?',
    repaint: () => mSayHint(),
    autoCommit: () => !S.get('mFinalAnswer', 'millionaire'),
    /* On this board a wrong answer ends the go — the steal, then the rung stands. */
    miss: team => mMissed(team)
  };

  /* Millionaire's weights (mLifelines, mFinalAnswer, mConferSeconds) are declared in
     game-hub/games/millionaire-settings.js; the shared Competition switches it reads
     (stealOnWrong, stealFullValue) are app-wide, in hub-app-settings.js. */

  /* The lifeline, final and next buttons exist only after the engine injects the
     stage, so they are wired on the first `load` rather than at parse. */
  let wired = false;
  function wire(){
    if(wired) return;
    wired = true;
    document.querySelectorAll('#m-lifelines .lifeline').forEach(btn=>{
      btn.addEventListener('click', ()=>useLifeline(btn.dataset.life));
    });
    document.getElementById('m-final').addEventListener('click', E().roundCommit);
    document.getElementById('m-next').addEventListener('click', ()=>{
      E().timerStop();
      E().setActiveTeam(K.passTurn(E().teams().length, E().activeTeam()));
      E().renderScorebar();
      nextMillionaireQuestion();
    });
    /* Done counting stops the *counting* and deliberately keeps the numbers: they are
       what the team is deciding on. */
    document.getElementById('m-done-count').addEventListener('click', ()=>{
      const wasVoting = mVoting;
      mCounting = false;
      mVoting   = false;
      /* Give the phones back — without this a class set to buzz lost the buzzer the
         moment a lifeline was used; the borrowing has to end as explicitly as it started. */
      if(wasVoting && mCurrent && !mAnswered) E().askPhones(E().currentPhonePrompt(), 'millionaire');
      renderMillionaire();
    });
  }

  window.HubGames.register({
    id:'millionaire', title:'Millionaire',
    /* After the four originals that sit at 50 (Jeopardy/Blockbusters/Race still in the
       engine), before Bingo(55) and Quickfire(60) — this file loads before the engine,
       and without the number it would jump to the front of every card row and tab. */
    order: 53,
    /* **It draws one ladder, not one per competitor** — `renderMillionaire` reads
       `mTeamState(active)`, so twenty-five people is twenty-five *stored* ladders and
       one on screen. Turns rotate, so with a big class each person answers rarely — a
       pacing warning, not a broken board, and the card says so. */
    solo: true,
    card:{
      icon:'<svg class="game-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 34 L8 26"/><path d="M16 34 L16 20"/><path d="M24 34 L24 14"/><path d="M32 34 L32 7"/><path d="M4 34 L36 34"/></svg>',
      blurb:'Four options, rising difficulty. Teams climb their own ladder, with 50:50, Ask the class and Confer to spend.',
      badge:'Best for: spotting the near-miss answer' },
    intro:{ eyebrow:'Cambridge Empower C1', title:'MILLIONAIRE',
            sub:'Eight rungs. One team at a time. No safety net.', accent:'#FFC83D' },
    hasBank: u => (u.millionaireBank||[]).length > 0,
    load(u){ wire();
             MILLIONAIRE_BANK          = u.millionaireBank || [];
             MILLIONAIRE_SECTION_NAMES = u.millionaireSectionNames || {};
             MILLIONAIRE_TOPIC_NAMES   = u.topicNames || {}; },
    bank: () => MILLIONAIRE_BANK,
    nudgeStep: NUDGE_STEP, payStep: PAY_STEP,
    renderContent: renderMillionaireContent,
    startButton:   millionaireStartButton,
    roundHost: HOST,
    stageHTML: `
      <!-- Millionaire. A round on its own stage (#m-options), not the clue card.
           Declared here and injected by the engine — an external game does not edit
           the skeleton. -->
      <div id="play-millionaire">
        <div id="m-bar">
          <div id="m-turn"></div>
          <div id="m-lifelines">
            <button class="lifeline" data-life="fifty">50:50</button>
            <button class="lifeline" data-life="class">Ask the class</button>
            <button class="lifeline" data-life="confer">Confer</button>
          </div>
        </div>
        <div id="m-main">
          <div id="m-stage">
            <div id="m-question"></div>
            <div id="m-options"></div>
            <div id="m-foot">
              <span id="m-hint"></span>
              <button id="m-final" style="display:none;">Final answer?</button>
              <button id="m-next" style="display:none;">Next team</button>
              <button id="m-done-count" style="display:none;">Done counting</button>
            </div>
          </div>
          <div id="m-ladder"></div>
        </div>
      </div>`,
    start(){ buildMillionaire();
             E().timerSetDuration(Number(S.get('mConferSeconds', 'millionaire')) || 30); },
    expects:     () => (mCurrent && mCurrent.q && mCurrent.q.answer) || '',
    phonePrompt: () => (mCurrent && mCurrent.q && mCurrent.q.prompt) || '',
    askingNow:   () => !!(mCurrent && !mAnswered),
    /* No buzz hooks: the ladder hosts a round, so a live question puts the four options
       in every hand and there is no buzzer to be entitled to. Both default to a no-op. */
    /* Every question is a round, so the handsets are the round's for the whole of it. */
    phoneRound(){ return E().roundForPhones(); },
    asRound:     q => E().asChoiceRound(q),
    /* Ask the class disables itself with no room to reveal from, and this board deals
       its first question inside `start()` — before the code has come back. */
    onRoomReady(){ renderMillionaire(); },
    wantsVote:   () => E().roundLive() || !!S.get('mLifelines', 'millionaire'),
    roomNote:    () => E().roundLive() ? 'pick an answer' : null,
    onVoteReply(all){ if(E().roundLive()) E().roundOnReplies(all); },
    /* **The ladder is a parallel array keyed by team index**, so a team removed or a
       roster replaced would leave it pointing at the wrong side — the index-shift bug
       the engine used to fix by reaching into `mState` by name. It now hands the game
       the change and the game re-aligns its own state: `i>=0` a team was removed,
       `i<0` the roster was replaced. Fires only while this board is active, which is
       the only time the ladder is on screen; on the next entry `start()` rebuilds it. */
    onTeamsChanged(i){ if(i >= 0) mState.splice(i, 1); else mState.length = 0; },
    fit:      fitMillionaire,
    tension(){ mTension(); },
    onResize: fitMillionaire
  });

  function renderMillionaireContent(list, help){
    help.textContent = "Pick the topics that feed the ladder. Each team climbs its own eight rungs, taking turns, and the questions get harder as they go.";
    E().groupCheckboxes(list, MILLIONAIRE_BANK, MILLIONAIRE_TOPIC_NAMES, MILLIONAIRE_SECTION_NAMES);
  }

  function millionaireStartButton(btn){
    const pool = MILLIONAIRE_BANK.filter(E().inPlay);
    const rungs = new Set(pool.map(q=>q.level));
    const missing = M_LADDER.map((_,i)=>i+1).filter(l=>!rungs.has(l));
    const chosen = E().selectedContent();
    btn.disabled = chosen.length===0 || missing.length>0;
    btn.textContent = chosen.length===0 ? 'Select at least one section'
      : missing.length ? `Not enough for a full ladder — nothing at level ${missing.join(', ')}`
      : `Build ladder — ${pool.length} questions across 8 rungs`;
  }

  function mTeamState(i){
    if(!mState[i]) mState[i] = { rung:0, used:new Set(), lifelines:{ fifty:true, class:true, confer:true } };
    return mState[i];
  }

  function buildMillionaire(){
    mState = []; mCurrent = null; mAnswered = false; mTally = null; mCounting = false;
    mVoting = false; mPicked = null;
    E().teams().forEach((t,i)=>mTeamState(i));
    E().setActiveTeam(0);
    E().renderScorebar();
    nextMillionaireQuestion();
  }

  function pickQuestion(team){
    const st   = mTeamState(team);
    const rung = Math.min(st.rung, M_LADDER.length-1);
    const pool = MILLIONAIRE_BANK.filter(q=>E().selectedContent().includes(E().groupOf(q)) && q.level === rung+1);
    if(!pool.length) return null;
    const fresh = pool.filter(q=>!st.used.has(q.prompt));
    return E().shuffle((fresh.length ? fresh : pool).slice())[0];
  }

  function nextMillionaireQuestion(){
    mAnswered = false; mTally = null; mCounting = false; mVoting = false; mPicked = null;
    const active = E().activeTeam();
    const teams  = E().teams();
    const st = mTeamState(active);

    if(st.rung >= M_LADDER.length){       // this team has topped out
      renderMillionaire();
      showMillionaireMessage((teams[active] ? teams[active].name : 'Team') + ' has cleared the ladder!');
      E().Sound.bedStop();
      if(document.getElementById('play-millionaire').classList.contains('lit')){
        E().Sound.fanfare(); setTimeout(()=>E().Sound.applause(2600), 700);
      } else {
        E().Sound.play('clear');
      }
      return;
    }
    const q = pickQuestion(active);
    if(!q){
      renderMillionaire();
      showMillionaireMessage('No question left at this level for the sections you picked.');
      return;
    }
    st.used.add(q.prompt);
    mCurrent = { q, team:active };
    /* **Normalised into a round, not migrated in the bank.** The item stays
       `{prompt, answer, distractors, level}` and the round has never learned that this
       bank calls a prompt `prompt`. The round shuffles the options. */
    const item = E().asChoiceRound(q);
    E().setClueItem(item);
    const found = E().roundOf(item, 'millionaire');
    E().roundEnd();
    const opened = found ? E().roundOpen(found) : null;
    renderMillionaire();
    /* Only when no round opened, because opening one has already armed the room. */
    if(!opened) E().askPhones(q.prompt, 'millionaire');
  }

  function showMillionaireMessage(text){
    E().roundEnd();
    document.getElementById('m-question').textContent = text;
    document.getElementById('m-options').innerHTML = '';
    document.getElementById('m-hint').textContent = '';
    document.getElementById('m-next').style.display = 'inline-block';
    document.getElementById('m-done-count').style.display = 'none';
    document.getElementById('m-final').style.display = 'none';
  }

  function renderMillionaire(){
    const active = E().activeTeam();
    const teams  = E().teams();
    const turnEl = document.getElementById('m-turn');
    const st = mTeamState(active);
    const rung = Math.min(st.rung, M_LADDER.length-1);
    turnEl.textContent = (teams[active] ? teams[active].name : 'Team') +
                         ' · playing for ' + M_LADDER[rung];

    // lifelines belong to the team whose turn it is
    document.querySelectorAll('#m-lifelines .lifeline').forEach(btn=>{
      const on = S.get('mLifelines', 'millionaire');
      btn.style.display = on ? 'inline-block' : 'none';
      const needsRoom = btn.dataset.life === 'class' && !E().room();
      btn.disabled = !on || !st.lifelines[btn.dataset.life] || !mCurrent || mAnswered || needsRoom;
      btn.title = needsRoom ? 'No phones in the room — nothing to reveal' : '';
      btn.classList.toggle('spent', !st.lifelines[btn.dataset.life]);
    });

    renderLadder();
    mTension();          // one place keeping the lights and the music in step
    if(!mCurrent) return;

    E().drawPrompt(document.getElementById('m-question'),
                      { text:mCurrent.q.prompt, answer:mCurrent.q.answer, type:mCurrent.q.type },
                      'millionaire');
    /* **The options are the multiple choice round now**, drawn into this game's own
       stage rather than a clue card — the whole of F3.8.9, and it cost one `mount`
       fact in the host. */
    E().renderRound();

    mSayHint();
    document.getElementById('m-next').style.display = 'none';
    document.getElementById('m-done-count').style.display = 'none';
    /* `m-final` is the round's commit button now, shown and worded by the shared
       renderer — setting it here as well is how the two would disagree. */
  }

  /* ---- how tense it should feel right now ----
     The ladder holds the only number this needs: rung 0 of 8 is a warm-up, rung 7 is
     the last question of the night. Nothing here runs unless the game show skin is on. */
  function mTension(){
    E().stageTension('millionaire', () => {
      const st = mTeamState(E().activeTeam());
      return { t: Math.min(st.rung, M_LADDER.length-1) / (M_LADDER.length-1),
               live: !!(mCurrent && !mAnswered) };
    });
  }

  /* A short light wash over the stage. Capped well under 3Hz and skipped for reduced
     motion: a projected full-screen strobe is not a risk worth taking for a flourish. */
  function mFlash(kind){
    const stage = document.getElementById('play-millionaire');
    if(!stage.classList.contains('lit') || !E().motionOK()) return;
    stage.classList.remove('flash-right','flash-wrong');
    void stage.offsetWidth;                        // restart the animation
    stage.classList.add(kind === 'right' ? 'flash-right' : 'flash-wrong');
    setTimeout(()=>stage.classList.remove('flash-right','flash-wrong'), 900);
  }

  /* Same rule as the other boards: fill the screen, never scroll. */
  function fitMillionaire(){
    K.fitToScreen(document.getElementById('m-main'), { min:260, gap:12, floor:true });
  }

  function renderLadder(){
    const active = E().activeTeam();
    const wrap = document.getElementById('m-ladder');
    wrap.innerHTML = '';
    for(let i = M_LADDER.length - 1; i >= 0; i--){
      const row = document.createElement('div');
      row.className = 'm-rung';
      const st = mTeamState(active);
      if(i < st.rung)  row.classList.add('cleared');
      if(i === st.rung) row.classList.add('here');
      const n = document.createElement('span'); n.className='m-rung-n'; n.textContent = i+1;
      const v = document.createElement('span'); v.className='m-rung-v'; v.textContent = M_LADDER[i];
      row.appendChild(n); row.appendChild(v);
      wrap.appendChild(row);
    }
  }

  /* The line under the options. Its own function because a nomination refreshes it
     without redrawing the whole board. */
  function mSayHint(){
    if(!mCurrent || mAnswered) return;
    const nom = mNominated();
    document.getElementById('m-hint').textContent =
      nom      ? 'Locked on ' + nom + ' — or pick another option to change it.'
      : mTally ? 'The class has voted — their picks are on the options.'
      : '';
  }

  /* What the team has nominated, read off the round rather than kept beside it. */
  function mNominated(){ const rs = E().roundState(); return (rs && rs.chosen && rs.chosen[0]) || null; }

  /* Everything a question ending does to the board, whichever way it ended. */
  function mEndQuestion(){
    /* **Show which one was right.** The options stay on screen for the rest of the
       beat, so ending without revealing leaves four live-looking options and no
       answer. `revealOpenRound` also clears the lock, which stops the nomination
       outliving the question it belonged to. */
    E().revealOpenRound();
    mAnswered = true;
    mVoting = false; mCounting = false;
    document.getElementById('m-done-count').style.display = 'none';
    document.getElementById('m-final').style.display = 'none';
    E().renderScorebar();
    renderLadder();
    // the ladder now shows the new rung lit, so the stage has to agree
    mTension();
    document.querySelectorAll('#m-lifelines .lifeline').forEach(b=>b.disabled = true);
    document.getElementById('m-next').style.display = 'inline-block';
  }

  /* The round says a team has it; this says what that is worth here. Called through
     `HOST.win`, and it returns what it paid because the phone strip names the student
     and the amount. */
  function mPayRung(team){
    const st = mTeamState(team);
    const value = M_LADDER[Math.min(st.rung, M_LADDER.length - 1)];
    const paid = E().award(team, value, { steal: !!(mCurrent && mCurrent.stolen),
                                          why: 'rung ' + value });
    E().markRun(team, true);
    st.rung += 1;
    document.getElementById('m-hint').textContent = '+' + paid;
    if(document.getElementById('play-millionaire').classList.contains('lit') &&
       st.rung >= M_LADDER.length - 1) setTimeout(()=>E().Sound.applause(1600), 300);
    mEndQuestion();
    return paid;
  }

  /* A wrong answer on this board is not free — the one place Millionaire genuinely
     differs from every other host: it ends the go. Offer the rung to the next team
     once, otherwise reveal and move on. Returns true either way. */
  function mMissed(team){
    E().markRun(team, false);
    const st = mTeamState(team);
    const teams = E().teams();
    const others = teams.map((_, i) => i).filter(i => i !== team);
    if(S.get('stealOnWrong', 'millionaire') && mCurrent && !mCurrent.stolen && others.length){
      mCurrent.stolen = true;
      mCurrent.team   = others[0];
      const rs = E().roundState(); if(rs) rs.chosen = [];
      document.getElementById('m-hint').textContent =
        (teams[mCurrent.team] ? teams[mCurrent.team].name : 'The other team') +
        ' can steal it for ' + Math.round(M_LADDER[Math.min(st.rung, M_LADDER.length-1)] /
                                          (S.get('stealFullValue','millionaire') ? 1 : 2));
      if(document.getElementById('play-millionaire').classList.contains('lit')){
        E().Sound.play('klaxon'); mFlash('wrong');
      } else E().Sound.play('wrong');
      E().renderRound();
      E().renderScorebar();
      /* The question now belongs to the other team, so the room is asked again. */
      E().askPhones(mCurrent.q.prompt, 'millionaire');
      return true;
    }
    if(document.getElementById('play-millionaire').classList.contains('lit')){
      E().Sound.play('klaxon'); mFlash('wrong');
    } else E().Sound.play('wrong');
    E().Sound.bedStop();
    document.getElementById('m-hint').textContent = 'No points — same rung next time round.';
    mEndQuestion();
    return true;
  }

  /* ---- lifelines ---- */
  function useLifeline(kind){
    const st = mTeamState(E().activeTeam());
    if(!mCurrent || mAnswered || !st.lifelines[kind]) return;
    st.lifelines[kind] = false;
    /* Reaching for a lifeline is reconsidering, so it throws away the nomination —
       which also means 50:50 can never remove the option currently locked on. */
    mPicked = null;

    if(kind === 'fifty'){
      /* Two wrong options out of play. `hidden` is the round's — "narrow the choice"
         is a generic hint mechanic — so they stay on screen struck through and leave
         the handsets entirely. */
      const rs = E().roundState();
      if(rs){
        const wrong = rs.options.filter(o => o !== rs.answer);
        rs.hidden = E().shuffle(wrong.slice()).slice(0, 2);
        E().renderRound();
        if(E().room()) E().askPhones(mCurrent.q.prompt, 'millionaire');
      }
      E().Sound.play('reveal');
    } else if(kind === 'class'){
      /* **The class has already voted.** The round asks the room on every question, so
         this no longer borrows the phones and runs a second vote against them. It
         reveals the counts the round is holding, which is what makes it still worth
         spending. With no relay there is nothing to reveal, so the button is not
         offered — see `renderMillionaire`. */
      mTally = true;
      E().Sound.play('reveal');
      renderMillionaire();
    } else if(kind === 'confer'){
      E().timerSetDuration(Number(S.get('mConferSeconds', 'millionaire')) || 30);
      E().timerReset(); E().timerStart();
    }
    renderMillionaire();
  }
})();
