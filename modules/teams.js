window.Modules = window.Modules || {};

// Teams module — renders in the bottom bar.
// Shows whose turn it is. Button to pass to next team.
// Emits 'team-change' when team rotates.
window.Modules['teams'] = {
  zone: 'bottom',

  render(state) {
    return `
      <div class="mod-teams">
        <button class="teams-nav-btn" id="teams-prev">&#9664;</button>
        <span class="teams-current">${state.teams[0]}&rsquo;s turn</span>
        <button class="teams-nav-btn" id="teams-next">Next team &#9654;</button>
      </div>
    `;
  },

  init(el, state, events) {
    const label = el.querySelector('.teams-current');

    function updateLabel() {
      label.textContent = `${state.teams[state.currentTeam]}\u2019s turn`;
    }

    el.querySelector('#teams-next').addEventListener('click', e => {
      e.stopPropagation();
      state.currentTeam = (state.currentTeam + 1) % state.teams.length;
      updateLabel();
      events.emit('team-change', { team: state.teams[state.currentTeam], index: state.currentTeam });
    });

    el.querySelector('#teams-prev').addEventListener('click', e => {
      e.stopPropagation();
      state.currentTeam = (state.currentTeam - 1 + state.teams.length) % state.teams.length;
      updateLabel();
      events.emit('team-change', { team: state.teams[state.currentTeam], index: state.currentTeam });
    });
  }
};
