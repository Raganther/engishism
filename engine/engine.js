(function () {
  const lesson     = window.LESSON;
  const activities = window.Activities;
  const mode       = lesson.mode || 'slideshow';

  const container = document.getElementById('slide-container');
  const counter   = document.getElementById('slide-counter');
  const btnPrev   = document.getElementById('btn-prev');
  const btnNext   = document.getElementById('btn-next');
  const btnMenu   = document.getElementById('btn-menu');

  function renderActivity(slide, onComplete) {
    const activity = activities[slide.type];
    if (!activity) {
      container.innerHTML = `<p style="color:red;font-size:2rem">Unknown type: "${slide.type}"</p>`;
      return;
    }
    container.innerHTML = activity.render(slide.content);
    activity.init(container, slide.content, { onComplete: onComplete || function () {} });
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
  function formatType(type) {
    return type.replace(/-/g, ' ');
  }

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

  function escHandler(e) {
    if (e.key === 'Escape') showMenu();
  }

  function showMenu() {
    document.removeEventListener('keydown', escHandler);
    btnMenu.style.display = 'none';
    btnPrev.style.display = 'none';
    btnNext.style.display = 'none';
    counter.textContent   = '';

    const tiles = lesson.slides.map((slide, i) => {
      const label = slide.label || autoLabel(slide);
      return `
        <button class="sel-tile" data-index="${i}">
          <span class="sel-type">${formatType(slide.type)}</span>
          <span class="sel-label">${label}</span>
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
