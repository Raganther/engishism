window.Activities = window.Activities || {};

// content.pairs = [{ a, b, note }, ...]
window.Activities['meaning-pair'] = {
  render(c) {
    const items = c.pairs.map((p, i) => `
      <div class="multi-item ${i === 0 ? 'active' : ''}">
        <p class="pair-prompt">What's the difference?</p>
        <p class="sentence a"><strong>a</strong>&ensp;${p.a}</p>
        <p class="sentence b"><strong>b</strong>&ensp;${p.b}</p>
        <p class="pair-note">${p.note}</p>
        <button class="reveal-btn mp-reveal">Show B</button>
      </div>
    `).join('');

    return `
      <div class="slide meaning-pair">
        ${items}
        <div class="multi-nav">
          <span class="multi-counter">1 / ${c.pairs.length}</span>
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
      const btn       = item.querySelector('.mp-reveal');
      const sentenceB = item.querySelector('.sentence.b');
      const note      = item.querySelector('.pair-note');
      let stage = 0;

      btn.addEventListener('click', e => {
        e.stopPropagation();
        stage++;
        if (stage === 1) {
          sentenceB.classList.add('visible');
          btn.textContent = 'Show note';
        } else {
          note.classList.add('visible');
          btn.style.display = 'none';
        }
      });
    });

    function showItem(i) {
      items.forEach(item => item.classList.remove('active'));
      items[i].classList.add('active');
      counter.textContent = `${i + 1} / ${c.pairs.length}`;
      nextBtn.textContent = i === c.pairs.length - 1 ? 'Done \u2713' : 'Next \u2192';
    }

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (current < c.pairs.length - 1) {
        current++;
        showItem(current);
      } else {
        onComplete();
      }
    });
  }
};
