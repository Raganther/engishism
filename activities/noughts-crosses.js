window.Activities = window.Activities || {};

window.Activities['noughts-crosses'] = {
  render(c) {
    const teams = c.teams || ['Team X', 'Team O'];

    const cells = c.cells.map((_, i) => `
      <div class="nc-cell" data-index="${i}">
        <span class="nc-cell-inner">${i + 1}</span>
      </div>
    `).join('');

    return `
      <div class="slide noughts-crosses">
        <div class="nc-layout">

          <div class="nc-grid">${cells}</div>

          <div class="nc-panel">
            <div class="nc-idle">
              <p class="nc-prompt">Select a square</p>
            </div>
            <div class="nc-active" style="display:none">
              <p class="nc-question"></p>
              <div class="nc-answer"></div>
              <div class="nc-actions">
                <button class="nc-claim" data-team="0">✗ &nbsp;${teams[0]}</button>
                <button class="reveal-btn" id="nc-reveal">Reveal</button>
                <button class="nc-claim" data-team="1">○ &nbsp;${teams[1]}</button>
              </div>
            </div>
          </div>

        </div>
        <div class="nc-win" style="display:none"></div>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const teams      = c.teams || ['Team X', 'Team O'];
    const board      = new Array(9).fill(null);
    const cellEls    = el.querySelectorAll('.nc-cell');
    const idle       = el.querySelector('.nc-idle');
    const active     = el.querySelector('.nc-active');
    const questionEl = el.querySelector('.nc-question');
    const answerEl   = el.querySelector('.nc-answer');
    const revealBtn  = el.querySelector('#nc-reveal');
    const claimBtns  = el.querySelectorAll('.nc-claim');
    const winEl      = el.querySelector('.nc-win');

    let selected = null;

    const LINES = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];

    function checkWin(team) {
      return LINES.some(line => line.every(i => board[i] === team));
    }

    function highlightWin(team) {
      const line = LINES.find(l => l.every(i => board[i] === team));
      if (line) line.forEach(i => cellEls[i].classList.add('win-cell'));
    }

    cellEls.forEach((cell, i) => {
      cell.addEventListener('click', e => {
        e.stopPropagation();
        if (board[i] !== null) return;

        cellEls.forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        selected = i;

        questionEl.textContent    = c.cells[i].question;
        answerEl.textContent      = c.cells[i].answer;
        answerEl.classList.remove('visible');
        revealBtn.style.display   = '';
        idle.style.display        = 'none';
        active.style.display      = '';
      });
    });

    revealBtn.addEventListener('click', e => {
      e.stopPropagation();
      answerEl.classList.add('visible');
      revealBtn.style.display = 'none';
    });

    claimBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (selected === null) return;

        const team = parseInt(btn.dataset.team);
        board[selected] = team;

        const inner = cellEls[selected].querySelector('.nc-cell-inner');
        inner.textContent = team === 0 ? '✗' : '○';
        cellEls[selected].classList.add(team === 0 ? 'claimed-x' : 'claimed-o');
        cellEls[selected].classList.remove('selected');

        selected = null;
        active.style.display = 'none';
        idle.style.display   = '';

        if (checkWin(team)) {
          highlightWin(team);
          winEl.textContent   = `${teams[team]} wins!`;
          winEl.style.display = '';
          onComplete({ winner: teams[team] });
        }
      });
    });
  }
};
