window.Activities = window.Activities || {};

// content.items = [{ words: [str, str, str, str], odd: str, reason: str }, ...]
window.Activities['odd-one-out'] = {
  render(c) {
    const items = c.items.map((item, i) => {
      const wordEls = item.words.map(w => `
        <div class="ooo-word" data-word="${w}">${w}</div>
      `).join('');

      return `
        <div class="multi-item ${i === 0 ? 'active' : ''}">
          <p class="ooo-prompt">Which word doesn't belong?</p>
          <div class="ooo-grid">${wordEls}</div>
          <button class="reveal-btn ooo-reveal">Reveal</button>
          <p class="ooo-reason">${item.reason}</p>
        </div>
      `;
    }).join('');

    return `
      <div class="slide odd-one-out">
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

    items.forEach((item, i) => {
      const btn    = item.querySelector('.ooo-reveal');
      const words  = item.querySelectorAll('.ooo-word');
      const reason = item.querySelector('.ooo-reason');
      const odd    = c.items[i].odd;

      btn.addEventListener('click', e => {
        e.stopPropagation();
        words.forEach(w => {
          w.classList.add(w.dataset.word === odd ? 'odd' : 'not-odd');
        });
        reason.classList.add('visible');
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
