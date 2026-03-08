(function () {
  const activities = window.Activities;
  const mods       = window.Modules || {};

  const container  = document.getElementById('slide-container');
  const counter    = document.getElementById('slide-counter');
  const btnLessons = document.getElementById('btn-lessons');
  const btnPrev    = document.getElementById('btn-prev');
  const btnNext    = document.getElementById('btn-next');
  const btnMenu    = document.getElementById('btn-menu');
  const barTop     = document.getElementById('module-bar-top');
  const barBottom  = document.getElementById('module-bar-bottom');

  const ACTIVITY_CATALOG = [
    { type: 'title-card',        label: 'Title Card',        desc: 'Lesson title slide' },
    { type: 'reveal-card',       label: 'Reveal Card',       desc: 'Reference list — labels with examples' },
    { type: 'fill-blank',        label: 'Fill in the Blank', desc: 'Gap-fill sentences, click to reveal' },
    { type: 'meaning-pair',      label: 'Meaning Pair',      desc: 'Compare two sentences — spot the difference' },
    { type: 'sentence-complete', label: 'Sentence Complete', desc: 'Open-ended sentence stems, reveal a model answer' },
    { type: 'true-false',        label: 'True / False',      desc: 'Statements to judge, reveal verdict + explanation' },
    { type: 'hot-seat',          label: 'Hot Seat',          desc: 'Timed word-description game' },
    { type: 'noughts-crosses',   label: 'Noughts & Crosses', desc: 'Q&A grid — teams claim squares' },
    { type: 'anagram',           label: 'Anagram',           desc: 'Unscramble the letters to find the word' },
    { type: 'call-my-bluff',     label: 'Call My Bluff',     desc: '3 definitions, one real — class votes' },
    { type: 'odd-one-out',       label: 'Odd One Out',       desc: '4 words, one doesn\'t belong — reveal + reason' },
    { type: 'missing-vowels',    label: 'Missing Vowels',    desc: 'Word with vowels removed — guess and reveal' },
  ];

  // ── Helpers ────────────────────────────────────────────────
  function hideAll() {
    [btnLessons, btnPrev, btnNext, btnMenu].forEach(b => b.style.display = 'none');
    counter.textContent = '';
    clearModuleBars();
  }

  function clearModuleBars() {
    barTop.innerHTML    = '';
    barBottom.innerHTML = '';
    barTop.classList.add('hidden');
    barBottom.classList.add('hidden');
  }

  function buildState(slide) {
    const c     = slide.content || {};
    const teams = c.teams || ['Team A', 'Team B'];
    const scores = {};
    teams.forEach(t => scores[t] = 0);
    return {
      teams, scores,
      timeLeft:       c.time || 60,
      currentTeam:    0,
      hasTimerModule: !!(slide.modules && slide.modules.includes('timer')),
    };
  }

  function renderActivity(slide, onComplete) {
    clearModuleBars();

    const activity = activities[slide.type];
    if (!activity) {
      container.innerHTML = `<p style="color:red;font-size:2rem">Unknown type: "${slide.type}"</p>`;
      return;
    }

    const events = window.createEventBus();
    const state  = buildState(slide);

    container.innerHTML = activity.render(slide.content);

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

    activity.init(container, slide.content, {
      onComplete: onComplete || function () {},
      state, events,
    });
  }

  // ── Activity picker (home screen) ──────────────────────────
  function showActivityPicker() {
    hideAll();

    const index = window.LESSON_INDEX || [];
    const tiles = ACTIVITY_CATALOG.map(a => {
      const count = index.filter(l => l.types && l.types.includes(a.type)).length;
      const empty = count === 0;
      return `
        <button class="sel-tile act-tile${empty ? ' act-empty' : ''}" data-type="${a.type}">
          <span class="act-label">${a.label}</span>
          <span class="act-desc">${a.desc}</span>
          <span class="act-count${empty ? ' none' : ''}">${empty ? 'No lessons yet' : count + ' lesson' + (count > 1 ? 's' : '')}</span>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="selector">
        <h1 class="sel-title">Activities</h1>
        <div class="sel-grid">${tiles}</div>
      </div>
    `;

    container.querySelectorAll('.act-tile:not(.act-empty)').forEach(tile => {
      tile.addEventListener('click', () => showActivityLessons(tile.dataset.type));
    });
  }

  function showActivityLessons(type) {
    hideAll();
    btnLessons.style.display = '';

    const index    = window.LESSON_INDEX || [];
    const activity = ACTIVITY_CATALOG.find(a => a.type === type);
    const matched  = index.filter(l => l.types && l.types.includes(type));

    const tiles = matched.map(l => `
      <button class="sel-tile" data-id="${l.id}">
        ${l.tag ? `<span class="sel-type">${l.tag}</span>` : ''}
        <span class="sel-label">${l.title}</span>
      </button>
    `).join('');

    container.innerHTML = `
      <div class="selector">
        <h1 class="sel-title">${activity.label}</h1>
        <p class="sel-desc">${activity.desc}</p>
        <div class="sel-grid">${tiles}</div>
      </div>
    `;

    container.querySelectorAll('.sel-tile').forEach(tile => {
      tile.addEventListener('click', () => loadLesson(tile.dataset.id));
    });
  }

  function loadLesson(id) {
    container.innerHTML = `<p class="loading-msg">Loading\u2026</p>`;

    // Remove any previously injected lesson script
    const old = document.querySelector('script[data-lesson]');
    if (old) old.remove();
    window.LESSON = null;

    const script = document.createElement('script');
    script.src          = `lessons/${id}.js`;
    script.dataset.lesson = id;
    script.onload  = () => startLesson();
    script.onerror = () => {
      container.innerHTML = `<p style="color:red;font-size:1.5rem">Could not load: ${id}</p>`;
    };
    document.head.appendChild(script);
  }

  // ── Start lesson ───────────────────────────────────────────
  function startLesson() {
    const lesson = window.LESSON;
    if (!lesson) return;

    // Show "← Lessons" only when a picker is available
    if (window.LESSON_INDEX) {
      btnLessons.style.display = '';
    }

    if ((lesson.mode || 'slideshow') === 'selector') {
      startSelectorMode(lesson);
    } else {
      startSlideshowMode(lesson);
    }
  }

  // ── Selector mode ──────────────────────────────────────────
  function startSelectorMode(lesson) {
    function formatType(t) { return t.replace(/-/g, ' '); }

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
        case 'anagram':           return `${c.words.length} words`;
        case 'call-my-bluff':     return `${c.items.length} words`;
        case 'odd-one-out':       return `${c.items.length} sets`;
        case 'missing-vowels':    return `${c.items.length} words`;
        default:                  return slide.type;
      }
    }

    function escHandler(e) { if (e.key === 'Escape') showMenu(); }

    function showMenu() {
      document.removeEventListener('keydown', escHandler);
      hideAll();
      if (window.LESSON_INDEX) btnLessons.style.display = '';

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
      hideAll();
      if (window.LESSON_INDEX) btnLessons.style.display = '';
      btnMenu.style.display = '';
      counter.textContent   = lesson.slides[index].label || formatType(lesson.slides[index].type);
      document.addEventListener('keydown', escHandler);
      renderActivity(lesson.slides[index], showMenu);
    }

    btnMenu.addEventListener('click', showMenu);
    showMenu();
  }

  // ── Slideshow mode ─────────────────────────────────────────
  function startSlideshowMode(lesson) {
    let current  = 0;
    let active   = true;

    btnPrev.style.display = '';
    btnNext.style.display = '';

    function go(dir) {
      if (!active) return;
      const next = current + dir;
      if (next < 0 || next >= lesson.slides.length) return;
      current = next;
      renderActivity(lesson.slides[current], () => go(1));
      counter.textContent = `${current + 1} / ${lesson.slides.length}`;
      btnPrev.disabled    = current === 0;
      btnNext.disabled    = current === lesson.slides.length - 1;
    }

    function keyHandler(e) {
      if (!active) { document.removeEventListener('keydown', keyHandler); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft')                   { e.preventDefault(); go(-1); }
    }

    btnPrev.addEventListener('click', () => go(-1));
    btnNext.addEventListener('click', () => go(1));
    document.addEventListener('keydown', keyHandler);

    // Clean up when returning to picker
    btnLessons.addEventListener('click', () => { active = false; }, { once: true });

    go(0);
  }

  // ── Entry point ────────────────────────────────────────────
  btnLessons.addEventListener('click', showActivityPicker);

  if (window.LESSON_INDEX) {
    showActivityPicker();
  } else if (window.LESSON) {
    startLesson();
  } else {
    container.innerHTML = `<p style="color:var(--muted);font-size:1.5rem">No lesson loaded.</p>`;
  }

})();
