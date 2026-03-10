window.Activities = window.Activities || {};

// content.categories = [{ name, questions: [{ value, question, answer }, ...] }, ...]
window.Activities['jeopardy'] = {
  render(c) {
    const cols = c.categories.length;

    const headers = c.categories.map(cat =>
      `<div class="jp-header">${cat.name}</div>`
    ).join('');

    const maxQ = Math.max(...c.categories.map(cat => cat.questions.length));
    let cells = '';
    for (let qi = 0; qi < maxQ; qi++) {
      c.categories.forEach((cat, ci) => {
        const q = cat.questions[qi];
        cells += q
          ? `<button class="jp-cell" data-cat="${ci}" data-qi="${qi}">${q.value}</button>`
          : `<div class="jp-cell jp-cell-empty"></div>`;
      });
    }

    return `
      <div class="slide jeopardy">
        <div class="jp-grid" style="grid-template-columns: repeat(${cols}, 1fr)">
          ${headers}
          ${cells}
        </div>
        <div class="jp-panel hidden"></div>
      </div>
    `;
  },

  init(el, c, { onComplete, state, events }) {
    const grid    = el.querySelector('.jp-grid');
    const panel   = el.querySelector('.jp-panel');
    const claimed = new Map();
    const total   = c.categories.reduce((sum, cat) => sum + cat.questions.length, 0);

    function showGrid() {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      grid.classList.remove('hidden');
      if (claimed.size >= total) onComplete();
    }

    function showQuestion(ci, qi) {
      const cat = c.categories[ci];
      const q   = cat.questions[qi];
      const key = `${ci}-${qi}`;

      const sessionTeams = (window.Session && window.Session.teams && window.Session.teams.length)
        ? window.Session.teams
        : state.teams;

      const claimBtns = sessionTeams.map((t, ti) =>
        `<button class="jp-claim" data-team="${ti}">${t} +${q.value}</button>`
      ).join('');

      panel.innerHTML = `
        <p class="jp-cat-label">${cat.name}</p>
        <p class="jp-value-label">${q.value}</p>
        <p class="jp-q-text">${q.question}</p>
        <button class="reveal-btn jp-reveal">Reveal answer</button>
        <p class="jp-answer">${q.answer}</p>
        <div class="jp-claim-bar">${claimBtns}</div>
        <button class="jp-back">&larr; Back</button>
      `;

      grid.classList.add('hidden');
      panel.classList.remove('hidden');

      panel.querySelector('.jp-reveal').addEventListener('click', e => {
        e.stopPropagation();
        panel.querySelector('.jp-answer').classList.add('visible');
        e.target.style.display = 'none';
      });

      panel.querySelectorAll('.jp-claim').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const teamIdx  = parseInt(btn.dataset.team);
          const teamName = sessionTeams[teamIdx];
          claimed.set(key, teamIdx);

          const cell = el.querySelector(`.jp-cell[data-cat="${ci}"][data-qi="${qi}"]`);
          cell.classList.add(`jp-claimed-${teamIdx}`);
          cell.textContent = '';
          cell.disabled = true;

          if (window.Session && teamName) {
            window.Session.award(teamName, q.value);
          } else {
            events.emit('point', { value: q.value });
          }
          showGrid();
        });
      });

      panel.querySelector('.jp-back').addEventListener('click', e => {
        e.stopPropagation();
        showGrid();
      });
    }

    el.querySelectorAll('.jp-cell:not(.jp-cell-empty)').forEach(cell => {
      cell.addEventListener('click', e => {
        e.stopPropagation();
        const ci  = parseInt(cell.dataset.cat);
        const qi  = parseInt(cell.dataset.qi);
        if (!claimed.has(`${ci}-${qi}`)) showQuestion(ci, qi);
      });
    });
  }
};
