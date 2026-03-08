window.Modules = window.Modules || {};

// Scoreboard module — renders in the top bar.
// Shows score per team. +1 buttons for manual award.
// Also listens for 'point' events fired by activities.
window.Modules['scoreboard'] = {
  zone: 'top',

  render(state) {
    const cols = state.teams.map(team => `
      <div class="score-col">
        <p class="score-team">${team}</p>
        <p class="score-val" data-team="${team}">0</p>
        <button class="score-btn" data-team="${team}">+1</button>
      </div>
    `).join('');

    return `<div class="mod-scoreboard">${cols}</div>`;
  },

  init(el, state, events) {
    function addPoint(team, value) {
      if (typeof team === 'number') team = state.teams[team];
      if (!state.scores[team] && state.scores[team] !== 0) return;
      state.scores[team] += (value || 1);
      const val = el.querySelector(`.score-val[data-team="${team}"]`);
      if (val) {
        val.textContent = state.scores[team];
        val.classList.add('scored');
        setTimeout(() => val.classList.remove('scored'), 400);
      }
    }

    // Manual +1 buttons
    el.querySelectorAll('.score-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        addPoint(btn.dataset.team);
      });
    });

    // Programmatic points from activities
    events.on('point', ({ team, value }) => addPoint(team, value));
  }
};
