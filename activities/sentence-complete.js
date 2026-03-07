window.Activities = window.Activities || {};

// content.stems = [{ stem, hint, answer }, ...]
window.Activities['sentence-complete'] = {
  render(c) {
    const items = c.stems.map((s, i) => `
      <div class="multi-item ${i === 0 ? 'active' : ''}">
        <p class="stem">${s.stem}</p>
        ${s.hint ? `<p class="stem-hint">${s.hint}</p>` : ''}
        <div class="answer">${s.answer}</div>
        <button class="reveal-btn sc-reveal">Reveal answer</button>
      </div>
    `).join('');

    return `
      <div class="slide sentence-complete">
        ${items}
        <div class="multi-nav">
          <span class="multi-counter">1 / ${c.stems.length}</span>
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
      const btn    = item.querySelector('.sc-reveal');
      const answer = item.querySelector('.answer');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        answer.classList.add('visible');
        btn.style.display = 'none';
      });
    });

    function showItem(i) {
      items.forEach(item => item.classList.remove('active'));
      items[i].classList.add('active');
      counter.textContent = `${i + 1} / ${c.stems.length}`;
      nextBtn.textContent = i === c.stems.length - 1 ? 'Done \u2713' : 'Next \u2192';
    }

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (current < c.stems.length - 1) {
        current++;
        showItem(current);
      } else {
        onComplete();
      }
    });
  }
};
