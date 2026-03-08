window.Activities = window.Activities || {};

// content.items = [{ display: str, answer: str, hint?: str }, ...]
window.Activities['missing-vowels'] = {
  render(c) {
    const items = c.items.map((item, i) => `
      <div class="multi-item ${i === 0 ? 'active' : ''}">
        <p class="mv-prompt">What's the word? (Vowels removed)</p>
        <p class="mv-display">${item.display}</p>
        <button class="reveal-btn mv-reveal">Reveal</button>
        <div class="mv-answer">
          <p class="mv-word">${item.answer}</p>
          ${item.hint ? `<p class="mv-hint">${item.hint}</p>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="slide missing-vowels">
        ${items}
        <div class="multi-nav">
          <span class="multi-counter">1 / ${c.items.length}</span>
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
      const btn    = item.querySelector('.mv-reveal');
      const answer = item.querySelector('.mv-answer');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        answer.classList.add('visible');
        btn.style.display = 'none';
      });
    });

    function showItem(i) {
      items.forEach(item => item.classList.remove('active'));
      items[i].classList.add('active');
      counter.textContent = `${i + 1} / ${c.items.length}`;
      nextBtn.textContent = i === c.items.length - 1 ? 'Done \u2713' : 'Next \u2192';
    }

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (current < c.items.length - 1) {
        current++;
        showItem(current);
      } else {
        onComplete();
      }
    });
  }
};
