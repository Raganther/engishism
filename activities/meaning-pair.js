window.Activities = window.Activities || {};

// Shows sentence A, then reveals B on first button click,
// then reveals the explanation note on second click.
window.Activities['meaning-pair'] = {
  render(c) {
    return `
      <div class="slide meaning-pair">
        <p class="pair-prompt">What's the difference?</p>
        <p class="sentence a"><strong>a</strong>&ensp;${c.a}</p>
        <p class="sentence b"><strong>b</strong>&ensp;${c.b}</p>
        <p class="pair-note">${c.note}</p>
        <button class="reveal-btn">Show B</button>
      </div>
    `;
  },

  init(el) {
    const btn       = el.querySelector('.reveal-btn');
    const sentenceB = el.querySelector('.sentence.b');
    const note      = el.querySelector('.pair-note');
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
  }
};
