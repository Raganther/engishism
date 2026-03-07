window.Activities = window.Activities || {};

// Sentence stem + grammar hint. Click reveal to show a model answer.
window.Activities['sentence-complete'] = {
  render(c) {
    return `
      <div class="slide sentence-complete">
        <p class="stem">${c.stem}</p>
        ${c.hint ? `<p class="stem-hint">${c.hint}</p>` : ''}
        <div class="answer">${c.answer}</div>
        <button class="reveal-btn">Reveal answer</button>
      </div>
    `;
  },

  init(el) {
    const btn    = el.querySelector('.reveal-btn');
    const answer = el.querySelector('.answer');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      answer.classList.add('visible');
      btn.style.display = 'none';
    });
  }
};
