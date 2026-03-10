(function () {

  const TEAM_COLORS  = ['var(--blue)', '#f85149', 'var(--green)', 'var(--accent)'];
  const TEAM_NAMES   = ['Team A', 'Team B', 'Team C', 'Team D'];

  // ── Theme cycling ───────────────────────────────────────────
  const THEMES = ['dark', 'neon', 'arcade', 'tropical', 'candy', 'fire', 'chalk'];
  function nextTheme() {
    const current = document.documentElement.dataset.theme || 'dark';
    const next    = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    const btn = SessionBar.el && SessionBar.el.querySelector('.sb-theme');
    if (btn) btn.title = next;
  }

  // ── Timer state (persists across session bar re-renders) ────
  const TIMER_DURATION = 30;
  let timerLeft       = TIMER_DURATION;
  let timerRunning    = false;
  let timerInterval   = null;
  let spacebarHandler = null;

  function toggleTimer() {
    if (timerRunning) {
      timerRunning = false;
      clearInterval(timerInterval);
      timerInterval = null;
    } else {
      if (timerLeft <= 0) return;
      timerRunning = true;
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(timerTick, 100);
    }
    const playBtn = SessionBar.el && SessionBar.el.querySelector('.sb-tbar-play');
    if (playBtn) playBtn.textContent = timerRunning ? '⏸' : '▶';
  }

  function resetTimer() {
    timerRunning = false;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerLeft = TIMER_DURATION;
    const fill = document.getElementById('timer-fill');
    const time = SessionBar.el && SessionBar.el.querySelector('.sb-tbar-time');
    const play = SessionBar.el && SessionBar.el.querySelector('.sb-tbar-play');
    if (fill) { fill.style.width = '100%'; fill.style.background = 'hsl(120, 85%, 50%)'; }
    if (time) { time.textContent = TIMER_DURATION; time.classList.remove('urgent'); }
    if (play) play.textContent = '▶';
  }

  function timerTick() {
    timerLeft = Math.max(0, timerLeft - 0.1);
    const pct  = timerLeft / TIMER_DURATION;
    const hue  = Math.round(pct * 120);   // 120 = green → 60 = yellow → 0 = red
    const fill = document.getElementById('timer-fill');
    const time = SessionBar.el.querySelector('.sb-tbar-time');
    if (fill) {
      fill.style.width      = (pct * 100) + '%';
      fill.style.background = `hsl(${hue}, 85%, 50%)`;
    }
    if (time) {
      time.textContent = Math.ceil(timerLeft);
      time.classList.toggle('urgent', timerLeft <= 10);
    }
    if (timerLeft <= 0) {
      timerRunning = false;
      clearInterval(timerInterval);
      timerInterval = null;
      const play = SessionBar.el && SessionBar.el.querySelector('.sb-tbar-play');
      if (play) play.textContent = '▶';
    }
  }

  // ── Session state ───────────────────────────────────────────
  window.Session = {
    teams:      ['Team A', 'Team B'],
    scores:     { 'Team A': 0, 'Team B': 0 },
    activeTeam: 0,

    award(team, value) {
      if (this.scores[team] === undefined) return;
      this.scores[team] += (value || 1);
      SessionBar.updateScore(team);
    },

    deduct(team, value) {
      if (this.scores[team] === undefined) return;
      this.scores[team] -= (value || 1);
      SessionBar.updateScore(team);
    }
  };

  // ── Bar renderer ────────────────────────────────────────────
  const SessionBar = window.SessionBar = {
    el: null,

    init() {
      this.el = document.getElementById('session-bar');
      this.render();
    },

    render() {
      const teams = window.Session.teams;

      const cards = teams.map((team, i) => {
        const color    = TEAM_COLORS[i] || 'var(--text)';
        const isActive = i === window.Session.activeTeam;
        return `
          <div class="sb-team${isActive ? ' sb-active' : ''}" data-team="${i}">
            <span class="sb-name"
                  contenteditable="true"
                  spellcheck="false"
                  data-name="${team}"
                  style="color:${color}">${team}</span>
            <span class="sb-score" style="color:${color}">${window.Session.scores[team] || 0}</span>
            <button class="sb-btn sb-minus" data-team="${i}" title="−1">−</button>
            <button class="sb-btn sb-plus"  data-team="${i}" title="+1">+</button>
            ${teams.length > 1 ? `<button class="sb-btn sb-remove" data-team="${i}" title="Remove">×</button>` : ''}
          </div>
        `;
      }).join('');

      this.el.innerHTML = `
        ${cards}
        <div class="sb-actions">
          ${teams.length < 4 ? '<button class="sb-add">+ Team</button>' : ''}
          <button class="sb-reset" title="Reset all scores">↺</button>
          <button class="sb-theme">◑ ${document.documentElement.dataset.theme || 'dark'}</button>
          <div class="sb-timer">
            <span class="sb-tbar-time${timerLeft <= 10 ? ' urgent' : ''}">${Math.ceil(timerLeft)}</span>
            <button class="sb-tbar-play" title="Play / Pause (Space)">${timerRunning ? '⏸' : '▶'}</button>
            <button class="sb-tbar-reset" title="Reset timer">↺</button>
          </div>
        </div>
      `;

      this.bindEvents();
    },

    bindEvents() {
      const el  = this.el;
      const ses = window.Session;

      // Select active team
      el.querySelectorAll('.sb-team').forEach(card => {
        card.addEventListener('click', () => {
          window.Session.activeTeam = parseInt(card.dataset.team);
          el.querySelectorAll('.sb-team').forEach(c => c.classList.remove('sb-active'));
          card.classList.add('sb-active');
        });
      });

      // +1 / −1
      el.querySelectorAll('.sb-plus, .sb-minus').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx  = parseInt(btn.dataset.team);
          const team = ses.teams[idx];
          const dir  = btn.classList.contains('sb-plus') ? 1 : -1;
          ses.scores[team] = (ses.scores[team] || 0) + dir;
          this.updateScore(team);
        });
      });

      // Remove team
      el.querySelectorAll('.sb-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx  = parseInt(btn.dataset.team);
          const team = ses.teams[idx];
          ses.teams.splice(idx, 1);
          delete ses.scores[team];
          this.render();
        });
      });

      // Add team
      const addBtn = el.querySelector('.sb-add');
      if (addBtn) {
        addBtn.addEventListener('click', e => {
          e.stopPropagation();
          const next = TEAM_NAMES.find(n => !ses.teams.includes(n))
                    || `Team ${ses.teams.length + 1}`;
          ses.teams.push(next);
          ses.scores[next] = 0;
          this.render();
        });
      }

      // Theme cycle
      el.querySelector('.sb-theme').addEventListener('click', e => {
        e.stopPropagation();
        nextTheme();
      });

      // Reset scores
      el.querySelector('.sb-reset').addEventListener('click', e => {
        e.stopPropagation();
        ses.teams.forEach(t => { ses.scores[t] = 0; });
        this.render();
      });

      // Timer — play/pause
      el.querySelector('.sb-tbar-play').addEventListener('click', e => {
        e.stopPropagation();
        toggleTimer();
      });

      // Timer — reset
      el.querySelector('.sb-tbar-reset').addEventListener('click', e => {
        e.stopPropagation();
        resetTimer();
      });

      // Spacebar — toggle timer (not when typing in a team name)
      if (spacebarHandler) document.removeEventListener('keydown', spacebarHandler);
      spacebarHandler = e => {
        if (e.code !== 'Space') return;
        if (document.activeElement && document.activeElement.isContentEditable) return;
        e.preventDefault();
        toggleTimer();
      };
      document.addEventListener('keydown', spacebarHandler);

      // Inline name editing
      el.querySelectorAll('.sb-name').forEach(nameEl => {
        nameEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
        });

        nameEl.addEventListener('blur', () => {
          const oldName = nameEl.dataset.name;
          const newName = nameEl.textContent.trim() || oldName;
          if (newName !== oldName) {
            const idx = ses.teams.indexOf(oldName);
            if (idx !== -1) {
              ses.teams[idx]      = newName;
              ses.scores[newName] = ses.scores[oldName] || 0;
              delete ses.scores[oldName];
            }
          }
          this.render();
        });
      });
    },

    updateScore(team) {
      const idx     = window.Session.teams.indexOf(team);
      const color   = TEAM_COLORS[idx] || 'var(--text)';
      const scoreEl = this.el.querySelector(`.sb-team[data-team="${idx}"] .sb-score`);
      if (!scoreEl) return;
      scoreEl.textContent = window.Session.scores[team];
      scoreEl.style.color = color;
      scoreEl.classList.add('bumped');
      setTimeout(() => scoreEl.classList.remove('bumped'), 350);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    SessionBar.init();
    const fill = document.getElementById('timer-fill');
    if (fill) { fill.style.width = '100%'; fill.style.background = 'hsl(120, 85%, 50%)'; }
  });

})();
