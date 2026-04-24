(function () {
  const root = document.getElementById('unit-app');
  const unitIndex = window.ENGISHISM_UNIT_INDEX || [];
  const units = window.ENGISHISM_UNITS || {};

  const games = [
    {
      id: 'picture-choice',
      label: 'Picture Choice',
      kicker: 'Visual Grammar',
      description: 'One illustration at a time. Pick the sentence that matches.',
      requires: ['imagePrompts'],
      canPlay(unit) {
        return Boolean(unit && unit.practice && Array.isArray(unit.practice.imagePrompts) && unit.practice.imagePrompts.length);
      },
    },
  ];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getUnits() {
    return unitIndex
      .map(meta => ({ meta, unit: units[meta.id] }))
      .filter(item => item.unit);
  }

  function setRoute(view, unitId, gameId) {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (unitId) params.set('unit', unitId);
    if (gameId) params.set('game', gameId);
    history.pushState({ view, unitId, gameId }, '', `${location.pathname}?${params.toString()}`);
  }

  function readRoute() {
    const params = new URLSearchParams(location.search);
    return {
      view: params.get('view') || 'units',
      unitId: params.get('unit'),
      gameId: params.get('game'),
    };
  }

  function renderShell(content) {
    root.innerHTML = `
      <div class="wb-app">
        <header class="wb-header">
          <button class="wb-brand" data-action="home" aria-label="Back to units">
            <span class="wb-brand-mark">E</span>
            <span>
              <strong>Engishism</strong>
              <small>Classroom Whiteboard</small>
            </span>
          </button>
          <div class="wb-header-note">Unit-first lessons. Games plug into content.</div>
        </header>
        <main class="wb-main">${content}</main>
      </div>
    `;

    root.querySelector('[data-action="home"]').addEventListener('click', () => {
      setRoute('units');
      renderUnits();
    });
  }

  function renderUnits() {
    const cards = getUnits().map(({ meta, unit }) => {
      const playable = games.filter(game => game.canPlay(unit));
      return `
        <button class="unit-card magnet-card" data-unit="${meta.id}">
          <span class="card-kicker">${escapeHtml(meta.unit)}</span>
          <span class="card-title">${escapeHtml(meta.title)}</span>
          <span class="card-desc">${escapeHtml(meta.summary)}</span>
          <span class="card-meta">${escapeHtml(meta.level)} · ${playable.length} game${playable.length === 1 ? '' : 's'} ready</span>
        </button>
      `;
    }).join('');

    renderShell(`
      <section class="wb-hero">
        <div>
          <p class="eyebrow">Choose a unit</p>
          <h1>Build games from lesson content.</h1>
          <p class="hero-copy">Workbook units become structured grammar, examples, prompts, and illustrations. Games read the unit and turn it into classroom practice.</p>
        </div>
        <div class="hero-board" aria-hidden="true">
          <div class="mini-card blue">rules</div>
          <div class="mini-card orange">pictures</div>
          <div class="mini-card green">games</div>
        </div>
      </section>
      <section class="unit-grid" aria-label="Available units">${cards}</section>
      <section class="legacy-note">
        Legacy lessons and standalone activities are preserved in the repo, but hidden from this rebuilt classroom flow.
      </section>
    `);

    root.querySelectorAll('[data-unit]').forEach(card => {
      card.addEventListener('click', () => {
        setRoute('unit', card.dataset.unit);
        renderUnit(card.dataset.unit);
      });
    });
  }

  function renderUnit(unitId) {
    const unit = units[unitId];
    if (!unit) return renderUnits();

    const gameCards = games.map(game => {
      const playable = game.canPlay(unit);
      return `
        <button class="game-card magnet-card${playable ? '' : ' disabled'}" data-game="${game.id}" ${playable ? '' : 'disabled'}>
          <span class="card-kicker">${escapeHtml(game.kicker)}</span>
          <span class="card-title">${escapeHtml(game.label)}</span>
          <span class="card-desc">${escapeHtml(game.description)}</span>
          <span class="card-meta">${playable ? 'Ready for this unit' : 'Needs more content'}</span>
        </button>
      `;
    }).join('');

    const rules = unit.grammar.rules.map(rule => `
      <article class="rule-chip">
        <h3>${escapeHtml(rule.label)}</h3>
        <p>${escapeHtml(rule.explanation)}</p>
      </article>
    `).join('');

    const forms = unit.grammar.form.map(form => `
      <li>
        <strong>${escapeHtml(form.label)}</strong>
        <span>${escapeHtml(form.pattern)}</span>
      </li>
    `).join('');

    renderShell(`
      <button class="back-link" data-action="back-units">← Units</button>
      <section class="unit-stage">
        <div class="unit-copy">
          <p class="eyebrow">${escapeHtml(unit.meta.unit)} · ${escapeHtml(unit.meta.level)}</p>
          <h1>${escapeHtml(unit.meta.title)}</h1>
          <p>${escapeHtml(unit.meta.classroomGoal)}</p>
        </div>
        <div class="unit-preview" style="background-image:url('${escapeHtml(unit.assets.actionSheet.src)}')" aria-label="${escapeHtml(unit.assets.actionSheet.alt)}"></div>
      </section>
      <section class="content-panel">
        <div>
          <h2>Form</h2>
          <ul class="form-list">${forms}</ul>
        </div>
        <div>
          <h2>Core rules</h2>
          <div class="rule-grid">${rules}</div>
        </div>
      </section>
      <section>
        <div class="section-heading">
          <p class="eyebrow">Choose a game</p>
          <h2>Games that can use this unit</h2>
        </div>
        <div class="game-grid">${gameCards}</div>
      </section>
    `);

    root.querySelector('[data-action="back-units"]').addEventListener('click', () => {
      setRoute('units');
      renderUnits();
    });

    root.querySelectorAll('[data-game]').forEach(card => {
      card.addEventListener('click', () => {
        setRoute('game', unitId, card.dataset.game);
        renderGame(unitId, card.dataset.game);
      });
    });
  }

  function resolveImage(unit, prompt) {
    const image = prompt.image || {};
    const asset = unit.assets[image.asset];
    const cols = asset.cols || 1;
    const rows = asset.rows || 1;
    const x = cols > 1 ? (image.col || 0) * (100 / (cols - 1)) : 0;
    const y = rows > 1 ? (image.row || 0) * (100 / (rows - 1)) : 0;
    return {
      src: asset.src,
      alt: asset.alt,
      size: `${cols * 100}% ${rows * 100}%`,
      position: `${x}% ${y}%`,
    };
  }

  function renderGame(unitId, gameId) {
    const unit = units[unitId];
    const game = games.find(item => item.id === gameId);
    if (!unit || !game || !game.canPlay(unit)) return renderUnit(unitId);

    const prompts = unit.practice.imagePrompts;
    let index = 0;
    let selected = null;

    renderShell(`
      <section class="game-shell">
        <div class="game-topline">
          <button class="back-link" data-action="back-unit">← ${escapeHtml(unit.meta.title)}</button>
          <span class="game-progress"></span>
        </div>
        <div class="picture-game"></div>
      </section>
    `);

    const board = root.querySelector('.picture-game');
    const progress = root.querySelector('.game-progress');

    root.querySelector('[data-action="back-unit"]').addEventListener('click', () => {
      setRoute('unit', unitId);
      renderUnit(unitId);
    });

    function draw() {
      const prompt = prompts[index];
      const img = resolveImage(unit, prompt);
      const complete = selected !== null;
      const options = prompt.options.map((option, optionIndex) => {
        let state = '';
        if (complete && optionIndex === prompt.answer) state = ' correct';
        else if (complete && optionIndex === selected) state = ' wrong';
        return `<button class="answer-tile${state}" data-answer="${optionIndex}" ${complete ? 'disabled' : ''}>${escapeHtml(option)}</button>`;
      }).join('');

      progress.textContent = `${index + 1} / ${prompts.length}`;
      board.innerHTML = `
        <div class="picture-frame">
          <div class="picture-crop" role="img" aria-label="${escapeHtml(img.alt)}"
            style="background-image:url('${escapeHtml(img.src)}');background-size:${img.size};background-position:${img.position};">
          </div>
        </div>
        <div class="question-panel">
          <p class="eyebrow">Picture Choice</p>
          <h1>${escapeHtml(prompt.prompt)}</h1>
          <div class="answer-grid">${options}</div>
          <div class="feedback ${complete ? 'visible' : ''}">
            ${complete ? escapeHtml(prompt.feedback) : 'Ask the class first, then tap an answer.'}
          </div>
          <div class="game-actions">
            <button class="secondary-action" data-action="restart">Restart</button>
            <button class="primary-action" data-action="next">${index === prompts.length - 1 ? 'Finish' : 'Next picture'} →</button>
          </div>
        </div>
      `;

      board.querySelectorAll('[data-answer]').forEach(button => {
        button.addEventListener('click', () => {
          selected = Number(button.dataset.answer);
          draw();
        });
      });

      board.querySelector('[data-action="restart"]').addEventListener('click', () => {
        index = 0;
        selected = null;
        draw();
      });

      board.querySelector('[data-action="next"]').addEventListener('click', () => {
        if (index < prompts.length - 1) {
          index++;
          selected = null;
          draw();
        } else {
          renderUnit(unitId);
        }
      });
    }

    draw();
  }

  window.addEventListener('popstate', () => start());

  function start() {
    const route = readRoute();
    if (route.view === 'game' && route.unitId && route.gameId) return renderGame(route.unitId, route.gameId);
    if (route.view === 'unit' && route.unitId) return renderUnit(route.unitId);
    renderUnits();
  }

  start();
})();
