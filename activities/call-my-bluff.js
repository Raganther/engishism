window.Activities = window.Activities || {};

// content.items = [{ word, definitions: [str, str, str], answer: 0|1|2 }, ...]
window.Activities['call-my-bluff'] = {
  render(c) {
    const labels = ['A', 'B', 'C'];
    const items = c.items.map((item, i) => {
      const defs = item.definitions.map((def, j) => `
        <div class="cmb-def" data-index="${j}">
          <span class="cmb-letter">${labels[j]}</span>
          <span class="cmb-text">${def}</span>
        </div>
      `).join('');

      return `
        <div class="multi-item ${i === 0 ? 'active' : ''}">
          <p class="cmb-word">${item.word}</p>
          <div class="cmb-defs">${defs}</div>
          <button class="reveal-btn cmb-reveal">Reveal</button>
        </div>
      `;
    }).join('');

    return `
      <div class="slide call-my-bluff">
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
      const btn    = item.querySelector('.cmb-reveal');
      const defs   = item.querySelectorAll('.cmb-def');
      const answerIdx = c.items[i].answer;

      btn.addEventListener('click', e => {
        e.stopPropagation();
        defs.forEach((def, j) => {
          def.classList.add(j === answerIdx ? 'correct' : 'wrong');
        });
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
