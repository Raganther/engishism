window.Activities = window.Activities || {};

// content.questions = [{ sentence, note }, ...]
// Blanks marked as [answer] in sentence string.
window.Activities['fill-blank'] = {
  render(c) {
    const items = c.questions.map((q, i) => {
      const withBlanks = q.sentence.replace(
        /\[([^\]]+)\]/g,
        `<span class="blank" data-answer="$1">_____</span>`
      );
      return `
        <div class="multi-item ${i === 0 ? 'active' : ''}">
          ${q.note ? `<p class="form-note">${q.note}</p>` : ''}
          <p class="sentence">${withBlanks}</p>
        </div>
      `;
    }).join('');

    return `
      <div class="slide fill-blank">
        ${items}
        <p class="hint">tap a blank to reveal</p>
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
    const hint    = el.querySelector('.hint');
    let current   = 0;

    // Attach blank listeners for all items upfront
    el.querySelectorAll('.blank').forEach(blank => {
      blank.addEventListener('click', e => {
        e.stopPropagation();
        blank.textContent = blank.dataset.answer;
        blank.classList.add('revealed');
        const allRevealed = [...items[current].querySelectorAll('.blank')]
          .every(b => b.classList.contains('revealed'));
        if (allRevealed) hint.classList.add('hidden');
      });
    });

    function showItem(i) {
      items.forEach(item => item.classList.remove('active'));
      items[i].classList.add('active');
      hint.classList.remove('hidden');
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
