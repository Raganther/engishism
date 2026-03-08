window.Activities = window.Activities || {};

// content = { time?: number }
// Generative — no pre-written questions. Teacher picks vowels/consonants, timer runs.
window.Activities['countdown'] = {
  render(c) {
    const time  = c.time || 30;
    const tiles = Array(9).fill(0).map(() => `<div class="cd-tile"></div>`).join('');

    return `
      <div class="slide countdown">
        <div class="cd-tiles">${tiles}</div>
        <p class="cd-timer hidden">${time}</p>
        <div class="cd-controls">
          <button class="cd-btn cd-vowel">Vowel</button>
          <button class="cd-btn cd-consonant">Consonant</button>
          <button class="cd-btn cd-new hidden">New Round</button>
          <button class="cd-btn cd-done hidden">Done &#10003;</button>
        </div>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const maxTime = c.time || 30;

    const VOWEL_POOL = (
      'AAAAAAAAAAA' +  // ×11
      'EEEEEEEEEEEEEEE' +  // ×15
      'IIIIIIIII' +  // ×9
      'OOOOOOOOO' +  // ×9
      'UUUUU'        // ×5
    ).split('');

    const CONSONANT_POOL = (
      'BB' + 'CCC' + 'DDDDDD' + 'FF' + 'GGG' + 'HH' + 'J' + 'K' +
      'LLLLL' + 'MMMM' + 'NNNNNNNN' + 'PPPP' + 'Q' +
      'RRRRRRRRR' + 'SSSSSSSSS' + 'TTTTTTTTT' + 'V' + 'W' + 'X' + 'YY' + 'Z'
    ).split('');

    function pick(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

    const tiles    = Array.from(el.querySelectorAll('.cd-tile'));
    const timerEl  = el.querySelector('.cd-timer');
    const vowelBtn = el.querySelector('.cd-vowel');
    const consBtn  = el.querySelector('.cd-consonant');
    const newBtn   = el.querySelector('.cd-new');
    const doneBtn  = el.querySelector('.cd-done');

    let letterCount = 0, vowelCount = 0;
    let timeLeft = maxTime, interval = null;

    function updateButtons() {
      vowelBtn.disabled = vowelCount >= 5 || letterCount >= 9;
      consBtn.disabled  = letterCount >= 9;
    }

    function addLetter(letter, type) {
      tiles[letterCount].textContent = letter;
      tiles[letterCount].classList.add('filled', type);
      letterCount++;
      if (type === 'vowel') vowelCount++;
      updateButtons();
      if (letterCount === 9) startRound();
    }

    function startRound() {
      vowelBtn.classList.add('hidden');
      consBtn.classList.add('hidden');
      timerEl.classList.remove('hidden');
      timeLeft = maxTime;
      timerEl.textContent = timeLeft;
      timerEl.classList.remove('urgent');
      timerEl.style.color = '';
      interval = setInterval(tick, 1000);
    }

    function tick() {
      timeLeft--;
      timerEl.textContent = timeLeft;
      if (timeLeft <= 10) timerEl.classList.add('urgent');
      if (timeLeft <= 0) endRound();
    }

    function endRound() {
      clearInterval(interval);
      interval = null;
      timerEl.textContent = "Time's up!";
      timerEl.classList.remove('urgent');
      timerEl.style.color = 'var(--accent)';
      newBtn.classList.remove('hidden');
      doneBtn.classList.remove('hidden');
    }

    function resetRound() {
      tiles.forEach(t => { t.textContent = ''; t.className = 'cd-tile'; });
      letterCount = 0;
      vowelCount  = 0;
      timerEl.classList.add('hidden');
      timerEl.style.color = '';
      timerEl.classList.remove('urgent');
      newBtn.classList.add('hidden');
      doneBtn.classList.add('hidden');
      vowelBtn.classList.remove('hidden');
      consBtn.classList.remove('hidden');
      updateButtons();
    }

    vowelBtn.addEventListener('click', e => { e.stopPropagation(); addLetter(pick(VOWEL_POOL), 'vowel'); });
    consBtn.addEventListener('click',  e => { e.stopPropagation(); addLetter(pick(CONSONANT_POOL), 'consonant'); });
    newBtn.addEventListener('click',   e => { e.stopPropagation(); resetRound(); });
    doneBtn.addEventListener('click',  e => { e.stopPropagation(); onComplete(); });
  }
};
