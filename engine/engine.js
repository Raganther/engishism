(function () {
  const lesson     = window.LESSON;
  const activities = window.Activities;
  const mods       = window.Modules || {};
  const mode       = lesson.mode || 'slideshow';

  const container = document.getElementById('slide-container');
  const counter   = document.getElementById('slide-counter');
  const btnPrev   = document.getElementById('btn-prev');
  const btnNext   = document.getElementById('btn-next');
  const btnMenu   = document.getElementById('btn-menu');
  const barTop    = document.getElementById('module-bar-top');
  const barBottom = document.getElementById('module-bar-bottom');

  // ── Shared state builder ───────────────────────────────────
  function buildState(slide) {
    const c      = slide.content || {};
    const teams  = c.teams || ['Team A', 'Team B'];
    const scores = {};
    teams.forEach(t => scores[t] = 0);
    return {
      teams,
      scores,
      timeLeft:       c.time || 60,
      currentTeam:    0,
      hasTimerModule: !!(slide.modules && slide.modules.includes('timer')),
    };
  }

  // ── Clear module bars ──────────────────────────────────────
  function clearModuleBars() {
    barTop.innerHTML    = '';
    barBottom.innerHTML = '';
    barTop.classList.add('hidden');
    barBottom.classList.add('hidden');
  }

  // ── Core render ────────────────────────────────────────────
  function renderActivity(slide, onComplete) {
    clearModuleBars();

    const activity = activities[slide.type];
    if (!activity) {
      container.innerHTML = `<p style="color:red;font-size:2rem">Unknown type: "${slide.type}"</p>`;
      return;
    }

    // Fresh event bus + state for this activity
    const events = window.createEventBus();
    const state  = buildState(slide);

    // Render activity HTML
    container.innerHTML = activity.render(slide.content);

    // Load + init modules
    if (slide.modules && slide.modules.length) {
      slide.modules.forEach(name => {
        const mod = mods[name];
        if (!mod) { console.warn(`Module "${name}" not found`); return; }

        const bar = mod.zone === 'bottom' ? barBottom : barTop;
        bar.classList.remove('hidden');

        const wrapper = document.createElement('div');
        wrapper.className = `module module-${name}`;
        wrapper.innerHTML = mod.render(state);
        bar.appendChild(wrapper);
        mod.init(wrapper, state, events);
      });
    }

    // Init activity — passes state + events alongside onComplete
    activity.init(container, slide.content, {
      onComplete: onComplete || function () {},
      state,
      events,
    });
  }

  // ── SLIDESHOW MODE ─────────────────────────────────────────
  if (mode !== 'selector') {
    let current = 0;
    btnMenu.style.display = 'none';

    function go(dir) {
      const next = current + dir;
      if (next < 0 || next >= lesson.slides.length) return;
      current = next;
      renderActivity(lesson.slides[current], () => go(1));
      counter.textContent = `${current + 1} / ${lesson.slides.length}`;
      btnPrev.disabled    = current === 0;
      btnNext.disabled    = current === lesson.slides.length - 1;
    }

    btnPrev.addEventListener('click', () => go(-1));
    btnNext.addEventListener('click', () => go(1));
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft')                   { e.preventDefault(); go(-1); }
    });

    go(0);
    return;
  }

  // ── SELECTOR MODE ──────────────────────────────────────────
  function formatType(type) { return type.replace(/-/g, ' '); }

  function autoLabel(slide) {
    const c = slide.content;
    switch (slide.type) {
      case 'title-card':        return c.heading;
      case 'reveal-card':       return c.heading;
      case 'fill-blank':        return `${c.questions.length} questions`;
      case 'true-false':        return `${c.questions.length} statements`;
      case 'hot-seat':          return `${c.words.length} words \u00b7 ${c.time}s`;
      case 'noughts-crosses':   return `${c.cells.length} questions`;
      case 'meaning-pair':      return `${c.pairs.length} pairs`;
      case 'sentence-complete': return `${c.stems.length} sentences`;
      default:                  return slide.type;
    }
  }

  function escHandler(e) { if (e.key === 'Escape') showMenu(); }

  function showMenu() {
    document.removeEventListener('keydown', escHandler);
    clearModuleBars();
    btnMenu.style.display = 'none';
    btnPrev.style.display = 'none';
    btnNext.style.display = 'none';
    counter.textContent   = '';

    const tiles = lesson.slides.map((slide, i) => {
      const label   = slide.label || autoLabel(slide);
      const hasMods = slide.modules && slide.modules.length;
      return `
        <button class="sel-tile${hasMods ? ' has-modules' : ''}" data-index="${i}">
          <span class="sel-type">${formatType(slide.type)}</span>
          <span class="sel-label">${label}</span>
          ${hasMods ? `<span class="sel-mods">${slide.modules.join(' \u00b7 ')}</span>` : ''}
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="selector">
        <h1 class="sel-title">${lesson.title}</h1>
        <div class="sel-grid">${tiles}</div>
      </div>
    `;

    container.querySelectorAll('.sel-tile').forEach(tile => {
      tile.addEventListener('click', () => launch(parseInt(tile.dataset.index)));
    });
  }

  function launch(index) {
    const slide = lesson.slides[index];
    btnPrev.style.display = 'none';
    btnNext.style.display = 'none';
    btnMenu.style.display = '';
    counter.textContent   = slide.label || formatType(slide.type);

    document.addEventListener('keydown', escHandler);
    renderActivity(slide, showMenu);
  }

  btnMenu.addEventListener('click', showMenu);
  showMenu();
})();
