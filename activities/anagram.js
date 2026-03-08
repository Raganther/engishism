window.Activities = window.Activities || {};

// content.words = [{ scrambled, answer, hint? }, ...]
window.Activities['anagram'] = {
  render(c) {
    const items = c.words.map((w, i) => `
      <div class="multi-item ${i === 0 ? 'active' : ''}">
        <p class="ana-label">Unscramble</p>
        <p class="ana-scrambled">${w.scrambled}</p>
        <button class="reveal-btn ana-reveal">Reveal</button>
        <div class="ana-answer">
          <p class="ana-word">${w.answer}</p>
          ${w.hint ? `<p class="ana-hint">${w.hint}</p>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="slide anagram">
        ${items}
        <div class="multi-nav">
          <span class="multi-counter">1 / ${c.words.length}</span>
          <button class="multi-next">Next &#8594;</button>
        </div>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const items   = el.querySelectorAll('.multi-item');
    const counter = el.querySelector('.multi-counter');
    const nextBtn = el.querySelector('.multi-next');
    let current   = 0;

    items.forEach(item => {
      const btn    = item.querySelector('.ana-reveal');
      const answer = item.querySelector('.ana-answer');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        answer.classList.add('visible');
        btn.style.display = 'none';
      });
    });

    function showItem(i) {
      items.forEach(item => item.classList.remove('active'));
      items[i].classList.add('active');
      counter.textContent = `${i + 1} / ${c.words.length}`;
      nextBtn.textContent = i === c.words.length - 1 ? 'Done \u2713' : 'Next \u2192';
    }

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (current < c.words.length - 1) {
        current++;
        showItem(current);
      } else {
        onComplete();
      }
    });
  }
};
