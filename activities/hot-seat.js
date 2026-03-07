window.Activities = window.Activities || {};

window.Activities['hot-seat'] = {
  render(c) {
    return `
      <div class="slide hot-seat">
        <p class="hs-label">HOT SEAT</p>
        <p class="hs-word">&#8212;</p>
        <p class="hs-timer">${c.time}</p>
        <div class="hs-controls">
          <button class="hs-btn" id="hs-start">Start</button>
          <button class="hs-btn" id="hs-next" disabled>Next &#8250;</button>
        </div>
        <p class="hs-tally">Words: <span id="hs-tally">0</span> / ${c.words.length}</p>
      </div>
    `;
  },

  init(el, c, { onComplete, state, events }) {
    const wordEl   = el.querySelector('.hs-word');
    const timerEl  = el.querySelector('.hs-timer');
    const startBtn = el.querySelector('#hs-start');
    const nextBtn  = el.querySelector('#hs-next');
    const tallyEl  = el.querySelector('#hs-tally');

    const words = [...c.words].sort(() => Math.random() - 0.5);
    let index    = 0;
    let timeLeft = c.time;
    let interval = null;
    let tally    = 0;

    function showWord() {
      wordEl.textContent = index < words.length ? words[index] : '\u2014';
      if (index >= words.length) nextBtn.disabled = true;
    }

    function end() {
      clearInterval(interval);
      interval = null;
      wordEl.textContent    = "Time\u2019s up!";
      wordEl.style.color    = 'var(--accent)';
      nextBtn.disabled      = true;
      startBtn.disabled     = true;
      onComplete({ score: tally });
    }

    // If timer module is present — hide internal timer, defer countdown to module
    if (state.hasTimerModule) {
      timerEl.style.display = 'none';
      startBtn.addEventListener('click', e => {
        e.stopPropagation();
        showWord();
        nextBtn.disabled  = false;
        startBtn.disabled = true;
        events.emit('start');
      });
      events.on('time-up', end);

    } else {
      // No timer module — run internal countdown
      function tick() {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 10) timerEl.classList.add('urgent');
        if (timeLeft <= 0) { end(); events.emit('round-end'); }
      }

      startBtn.addEventListener('click', e => {
        e.stopPropagation();
        showWord();
        nextBtn.disabled  = false;
        startBtn.disabled = true;
        events.emit('start');
        interval = setInterval(tick, 1000);
      });
    }

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      tally++;
      tallyEl.textContent = tally;
      // Fire point event — scoreboard module will pick this up
      events.emit('point', { team: state.currentTeam });
      index++;
      showWord();
    });
  }
};
