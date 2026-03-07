window.Activities = window.Activities || {};

window.Activities['true-false'] = {
  render(c) {
    const verdict = c.answer ? 'TRUE' : 'FALSE';
    return `
      <div class="slide true-false">
        <p class="tf-statement">${c.statement}</p>
        <button class="reveal-btn">Reveal answer</button>
        <div class="tf-answer">
          <span class="tf-verdict ${c.answer ? 'true' : 'false'}">${verdict}</span>
          ${c.explanation ? `<p class="tf-explanation">${c.explanation}</p>` : ''}
        </div>
      </div>
    `;
  },

  init(el) {
    const btn    = el.querySelector('.reveal-btn');
    const answer = el.querySelector('.tf-answer');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      answer.classList.add('visible');
      btn.style.display = 'none';
    });
  }
};
