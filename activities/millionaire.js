window.Activities = window.Activities || {};

// content.questions = [{ question, options: [str,str,str,str], answer: 0|1|2|3 }, ...]
window.Activities['millionaire'] = {
  render(c) {
    const VALUES = [
      '£100','£200','£300','£500','£1,000',
      '£2,000','£4,000','£8,000','£16,000','£32,000',
      '£64,000','£125,000','£250,000','£500,000','£1,000,000'
    ];
    const qCount = c.questions.length;
    const vals   = VALUES.slice(0, qCount);

    // Ladder: highest value at top, lowest at bottom
    const ladder = [...vals].reverse().map((v, ri) => {
      const qi = qCount - 1 - ri;
      return `<div class="mm-rung" data-qi="${qi}">${v}</div>`;
    }).join('');

    return `
      <div class="slide millionaire">
        <div class="mm-main"></div>
        <div class="mm-ladder">${ladder}</div>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const VALUES = [
      '£100','£200','£300','£500','£1,000',
      '£2,000','£4,000','£8,000','£16,000','£32,000',
      '£64,000','£125,000','£250,000','£500,000','£1,000,000'
    ];
    const LABELS = ['A', 'B', 'C', 'D'];
    const qCount = c.questions.length;
    const vals   = VALUES.slice(0, qCount);
    const main   = el.querySelector('.mm-main');

    // Mark safe levels at ~1/3 and ~2/3 of total questions
    const safe1 = Math.floor(qCount / 3);
    const safe2 = Math.floor((2 * qCount) / 3);
    const safeIndices = qCount >= 6 ? [safe1, safe2] : qCount >= 3 ? [Math.floor(qCount / 2)] : [];
    safeIndices.forEach(i => {
      const rung = el.querySelector(`.mm-rung[data-qi="${i}"]`);
      if (rung) rung.classList.add('safe');
    });

    let fiftyUsed = false;

    function getGuaranteed(qi) {
      const reached = safeIndices.filter(i => i < qi);
      return reached.length ? vals[reached[reached.length - 1]] : '£0';
    }

    function updateLadder(qi) {
      el.querySelectorAll('.mm-rung').forEach(r => r.classList.remove('current'));
      const rung = el.querySelector(`.mm-rung[data-qi="${qi}"]`);
      if (rung) rung.classList.add('current');
    }

    function renderQuestion(qi) {
      const q     = c.questions[qi];
      const value = vals[qi] || `Q${qi + 1}`;

      const options = q.options.map((opt, i) => `
        <button class="mm-option" data-index="${i}">
          <span class="mm-opt-label">${LABELS[i]}</span>
          <span class="mm-opt-text">${opt}</span>
        </button>
      `).join('');

      main.innerHTML = `
        <div class="mm-top">
          <button class="mm-fifty${fiftyUsed ? ' used' : ''}">50/50</button>
          <span class="mm-progress">${qi + 1} / ${qCount}</span>
          <button class="mm-walk">Walk Away</button>
        </div>
        <p class="mm-value">${value}</p>
        <p class="mm-question">${q.question}</p>
        <div class="mm-options">${options}</div>
        <button class="mm-reveal hidden">Final Answer</button>
      `;

      updateLadder(qi);

      const optBtns   = main.querySelectorAll('.mm-option');
      const revealBtn = main.querySelector('.mm-reveal');
      const fiftyBtn  = main.querySelector('.mm-fifty');
      const walkBtn   = main.querySelector('.mm-walk');
      let selected    = null;

      // Select an option
      optBtns.forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.disabled) return;
          optBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selected = parseInt(btn.dataset.index);
          revealBtn.classList.remove('hidden');
        });
      });

      // Final answer — reveal
      revealBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (selected === null) return;
        revealBtn.classList.add('hidden');
        optBtns.forEach(b => b.disabled = true);

        optBtns.forEach(btn => {
          const idx = parseInt(btn.dataset.index);
          if (idx === q.answer)                     btn.classList.add('correct');
          if (idx === selected && idx !== q.answer) btn.classList.add('wrong');
        });

        if (selected === q.answer) {
          el.querySelector(`.mm-rung[data-qi="${qi}"]`).classList.add('won');
          if (qi + 1 >= qCount) {
            setTimeout(() => showEnd(true, vals[qCount - 1]), 1400);
          } else {
            setTimeout(() => renderQuestion(qi + 1), 1400);
          }
        } else {
          setTimeout(() => showEnd(false, getGuaranteed(qi)), 1400);
        }
      });

      // 50/50 lifeline
      fiftyBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (fiftyUsed) return;
        fiftyUsed = true;
        fiftyBtn.classList.add('used');

        const wrongIdxs = [0,1,2,3]
          .filter(i => i !== q.answer)
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);

        wrongIdxs.forEach(i => {
          const btn = main.querySelector(`.mm-option[data-index="${i}"]`);
          btn.classList.add('removed');
          btn.disabled = true;
          if (selected === i) {
            btn.classList.remove('selected');
            selected = null;
            revealBtn.classList.add('hidden');
          }
        });
      });

      // Walk away
      walkBtn.addEventListener('click', e => {
        e.stopPropagation();
        showEnd(false, qi > 0 ? vals[qi - 1] : '£0', true);
      });
    }

    function showEnd(won, amount, walkedAway = false) {
      const title = won ? 'WINNER!' : walkedAway ? 'Walked Away' : 'Game Over';
      main.innerHTML = `
        <div class="mm-endscreen">
          <p class="mm-end-title">${title}</p>
          <p class="mm-end-amount">${amount}</p>
          <button class="mm-done">Done &#10003;</button>
        </div>
      `;
      main.querySelector('.mm-done').addEventListener('click', e => {
        e.stopPropagation();
        onComplete();
      });
    }

    renderQuestion(0);
  }
};
