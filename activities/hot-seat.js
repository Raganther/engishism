window.Activities = window.Activities || {};

window.Activities['hot-seat'] = {
  render(c) {
    return `
      <div class="slide hot-seat">
        <p class="hs-label">HOT SEAT</p>
        <p class="hs-word">—</p>
        <p class="hs-timer">${c.time}</p>
        <div class="hs-controls">
          <button class="hs-btn" id="hs-start">Start</button>
          <button class="hs-btn" id="hs-next" disabled>Next ›</button>
        </div>
        <p class="hs-tally">Score: <span id="hs-tally">0</span> / ${c.words.length}</p>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const wordEl   = el.querySelector('.hs-word');
    const timerEl  = el.querySelector('.hs-timer');
    const startBtn = el.querySelector('#hs-start');
    const nextBtn  = el.querySelector('#hs-next');
    const tallyEl  = el.querySelector('#hs-tally');

    // Shuffle words so it's different each time
    const words = [...c.words].sort(() => Math.random() - 0.5);
    let index    = 0;
    let timeLeft = c.time;
    let interval = null;
    let tally    = 0;

    function showWord() {
      wordEl.textContent = index < words.length ? words[index] : '—';
      if (index >= words.length) nextBtn.disabled = true;
    }

    function end() {
      clearInterval(interval);
      wordEl.textContent = "Time's up!";
      wordEl.style.color = 'var(--accent)';
      nextBtn.disabled   = true;
      startBtn.disabled  = true;
      onComplete({ score: tally });
    }

    function tick() {
      timeLeft--;
      timerEl.textContent = timeLeft;
      if (timeLeft <= 10) timerEl.classList.add('urgent');
      if (timeLeft <= 0) end();
    }

    startBtn.addEventListener('click', e => {
      e.stopPropagation();
      showWord();
      nextBtn.disabled  = false;
      startBtn.disabled = true;
      interval = setInterval(tick, 1000);
    });

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      tally++;
      tallyEl.textContent = tally;
      index++;
      showWord();
    });
  }
};
