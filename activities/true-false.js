window.Activities = window.Activities || {};

// content.questions = [{ statement, answer, explanation }, ...]
window.Activities['true-false'] = {
  render(c) {
    const items = c.questions.map((q, i) => `
      <div class="multi-item ${i === 0 ? 'active' : ''}">
        <p class="tf-statement">${q.statement}</p>
        <button class="reveal-btn tf-reveal">Reveal answer</button>
        <div class="tf-answer">
          <span class="tf-verdict ${q.answer ? 'true' : 'false'}">${q.answer ? 'TRUE' : 'FALSE'}</span>
          ${q.explanation ? `<p class="tf-explanation">${q.explanation}</p>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="slide true-false">
        ${items}
        <div class="multi-nav">
          <span class="multi-counter">1 / ${c.questions.length}</span>
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
      const btn    = item.querySelector('.tf-reveal');
      const answer = item.querySelector('.tf-answer');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        answer.classList.add('visible');
        btn.style.display = 'none';
      });
    });

    function showItem(i) {
      items.forEach(item => item.classList.remove('active'));
      items[i].classList.add('active');
      counter.textContent = `${i + 1} / ${c.questions.length}`;
      nextBtn.textContent = i === c.questions.length - 1 ? 'Done \u2713' : 'Next \u2192';
    }

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (current < c.questions.length - 1) {
        current++;
        showItem(current);
      } else {
        onComplete();
      }
    });
  }
};
