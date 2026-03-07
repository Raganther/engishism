window.Activities = window.Activities || {};

// Sentence with [answer] markers. Click a blank to reveal it.
// Supports multiple blanks per sentence.
window.Activities['fill-blank'] = {
  render(c) {
    const withBlanks = c.sentence.replace(
      /\[([^\]]+)\]/g,
      `<span class="blank" data-answer="$1">_____</span>`
    );

    return `
      <div class="slide fill-blank">
        ${c.note ? `<p class="form-note">${c.note}</p>` : ''}
        <p class="sentence">${withBlanks}</p>
        <p class="hint">tap a blank to reveal</p>
      </div>
    `;
  },

  init(el) {
    const blanks = el.querySelectorAll('.blank');
    const hint   = el.querySelector('.hint');

    blanks.forEach(blank => {
      blank.addEventListener('click', e => {
        e.stopPropagation();
        blank.textContent = blank.dataset.answer;
        blank.classList.add('revealed');

        // Hide hint once all blanks revealed
        const allRevealed = [...blanks].every(b => b.classList.contains('revealed'));
        if (allRevealed) hint.classList.add('hidden');
      });
    });
  }
};
