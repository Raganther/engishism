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
    {
      id: 'sentence-builder',
      label: 'Sentence Builder',
      kicker: 'Word Order',
      description: 'Drag or tap word tiles into the correct sentence.',
      requires: ['sentenceBuilders'],
      canPlay(unit) {
        return Boolean(unit && unit.practice && Array.isArray(unit.practice.sentenceBuilders) && unit.practice.sentenceBuilders.length);
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

    if (gameId === 'sentence-builder') return renderSentenceBuilder(unitId, unit);

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

  function renderSentenceBuilder(unitId, unit) {
    const prompts = unit.practice.sentenceBuilders;
    let index = 0;
    let built = [];
    let selectedTile = null;
    let checked = false;
    let draggingItem = null;
    let pendingSnap = null;
    let suppressSlotClick = false;
    let pendingWordBankRects = null;

    renderShell(`
      <section class="game-shell sentence-builder-shell">
        <div class="game-topline">
          <button class="back-link" data-action="back-unit">← ${escapeHtml(unit.meta.title)}</button>
          <span class="game-progress"></span>
        </div>
        <div class="sentence-builder-game"></div>
      </section>
    `);

    const board = root.querySelector('.sentence-builder-game');
    const progress = root.querySelector('.game-progress');

    root.querySelector('[data-action="back-unit"]').addEventListener('click', () => {
      setRoute('unit', unitId);
      renderUnit(unitId);
    });

    function currentPrompt() {
      return prompts[index];
    }

    function isCorrect() {
      const answer = currentPrompt().answer;
      return built.length === answer.length && built.every((item, i) => item.word === answer[i]);
    }

    function remainingTiles() {
      const usedIds = new Set(built.map(item => item.id));
      return currentPrompt().words.map((word, wordIndex) => ({ id: `${wordIndex}-${word}`, word })).filter(item => !usedIds.has(item.id));
    }

    function draw() {
      const prompt = currentPrompt();
      const complete = checked;
      const correct = complete && isCorrect();
      const builtTiles = built.map((item, slotIndex) => {
        return `
          <button class="sentence-slot filled"
            data-slot="${slotIndex}"
            data-tile-id="${escapeHtml(item.id)}"
            data-word="${escapeHtml(item.word)}"
            draggable="false"
            ${complete ? 'disabled' : ''}>
            ${escapeHtml(item.word)}
          </button>
        `;
      }).join('');
      const tiles = remainingTiles().map(item => `
        <button class="word-tile${selectedTile && selectedTile.id === item.id ? ' selected' : ''}"
          data-tile-id="${escapeHtml(item.id)}"
          data-word="${escapeHtml(item.word)}"
          draggable="${complete ? 'false' : 'true'}"
          ${complete ? 'disabled' : ''}>
          ${escapeHtml(item.word)}
        </button>
      `).join('');
      const wordBank = complete
        ? '<div class="word-bank word-bank-placeholder" aria-hidden="true"></div>'
        : `<div class="word-bank" aria-label="Word tiles">${tiles}</div>`;

      progress.textContent = `${index + 1} / ${prompts.length}`;
      board.innerHTML = `
        <div class="builder-panel">
          <p class="eyebrow">Sentence Builder</p>
          <h1>${escapeHtml(prompt.clue)}</h1>
          <div class="sentence-slots sentence-dropzone" aria-label="Built sentence">
            ${builtTiles || '<div class="drop-hint">Drop words here</div>'}
          </div>
          ${wordBank}
          <div class="feedback ${complete ? 'visible' : ''} ${correct ? 'success' : 'error'}">
            ${complete ? escapeHtml(correct ? `Correct: ${prompt.sentence}` : `Not quite. ${prompt.explanation}`) : 'Tap words in order, or drag them into the sentence.'}
          </div>
          <div class="game-actions">
            <button class="secondary-action" data-action="clear">Clear</button>
            <button class="secondary-action" data-action="reveal">Reveal</button>
            <button class="primary-action" data-action="check">${complete ? (index === prompts.length - 1 ? 'Finish' : 'Next sentence →') : 'Check sentence'}</button>
          </div>
        </div>
      `;

      board.querySelectorAll('.word-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          if (checked) return;
          pendingWordBankRects = captureWordBankRects();
          const item = { id: tile.dataset.tileId, word: tile.dataset.word };
          built.push(item);
          selectedTile = null;
          draw();
        });

        tile.addEventListener('dragstart', event => {
          if (checked) return;
          const tileRect = tile.getBoundingClientRect();
          draggingItem = {
            id: tile.dataset.tileId,
            word: tile.dataset.word,
            source: 'bank',
            offsetX: event.clientX - tileRect.left,
            offsetY: event.clientY - tileRect.top,
            width: tileRect.width,
            height: tileRect.height,
          };
          tile.classList.add('dragging');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/json', JSON.stringify(draggingItem));
        });

        tile.addEventListener('dragend', () => {
          draggingItem = null;
          clearDragPreview();
        });
      });

      board.querySelectorAll('.sentence-slot').forEach(slot => {
        slot.addEventListener('click', () => {
          if (checked) return;
          if (suppressSlotClick) {
            suppressSlotClick = false;
            return;
          }
          const slotIndex = Number(slot.dataset.slot);
          if (built[slotIndex]) {
            built.splice(slotIndex, 1);
            draw();
          }
        });

        slot.addEventListener('pointerdown', event => {
          if (checked || !slot.dataset.word || event.button !== 0) return;
          startPlacedTileDrag(event, slot);
        });

        slot.addEventListener('dragstart', event => {
          if (checked || !slot.dataset.word) return;
          const slotRect = slot.getBoundingClientRect();
          draggingItem = {
            id: slot.dataset.tileId,
            word: slot.dataset.word,
            source: 'slot',
            slotIndex: Number(slot.dataset.slot),
            offsetX: event.clientX - slotRect.left,
            offsetY: event.clientY - slotRect.top,
            width: slotRect.width,
            height: slotRect.height,
          };
          slot.classList.add('dragging');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/json', JSON.stringify(draggingItem));
        });

        slot.addEventListener('dragend', () => {
          draggingItem = null;
          clearDragPreview();
        });
      });

      const sentenceDropzone = board.querySelector('.sentence-dropzone');
      if (sentenceDropzone) {
        sentenceDropzone.addEventListener('dragover', event => {
          if (checked) return;
          event.preventDefault();
          sentenceDropzone.classList.add('drag-over');
          showTilePlaceholder(sentenceDropzone, getInsertionIndex(sentenceDropzone, event));
        });

        sentenceDropzone.addEventListener('dragleave', event => {
          if (sentenceDropzone.contains(event.relatedTarget)) return;
          sentenceDropzone.classList.remove('drag-over');
          removeTilePlaceholder();
        });

        sentenceDropzone.addEventListener('drop', event => {
          if (checked) return;
          event.preventDefault();
          const raw = event.dataTransfer.getData('application/json');
          if (!raw) return;
          const item = JSON.parse(raw);
          const insertionIndex = getInsertionIndex(sentenceDropzone, event);
          sentenceDropzone.classList.remove('drag-over');
          clearDragPreview();

          if (item.source === 'slot') {
            built.splice(item.slotIndex, 1);
            built.splice(insertionIndex, 0, { id: item.id, word: item.word });
          } else {
            pendingWordBankRects = captureWordBankRects();
            built = built.filter(existing => existing.id !== item.id);
            built.splice(insertionIndex, 0, { id: item.id, word: item.word });
          }
          built = built.slice(0, currentPrompt().answer.length);
          pendingSnap = {
            id: item.id,
            x: event.clientX,
            y: event.clientY,
            offsetX: item.offsetX,
            offsetY: item.offsetY,
          };
          draw();
        });
      }

      const wordBankElement = board.querySelector('.word-bank');
      if (wordBankElement) {
        wordBankElement.addEventListener('dragover', event => {
          if (checked || !draggingItem || draggingItem.source !== 'slot') return;
          event.preventDefault();
          wordBankElement.classList.add('drag-over');
        });

        wordBankElement.addEventListener('dragleave', () => {
          wordBankElement.classList.remove('drag-over');
        });

        wordBankElement.addEventListener('drop', event => {
          if (checked) return;
          event.preventDefault();
          wordBankElement.classList.remove('drag-over');
          const raw = event.dataTransfer.getData('application/json');
          if (!raw) return;
          const item = JSON.parse(raw);
          if (item.source === 'slot') {
            pendingWordBankRects = captureWordBankRects();
            built.splice(item.slotIndex, 1);
            draw();
          }
        });
      }

      board.querySelector('[data-action="clear"]').addEventListener('click', () => {
        built = [];
        checked = false;
        selectedTile = null;
        draggingItem = null;
        pendingSnap = null;
        draw();
      });

      board.querySelector('[data-action="reveal"]').addEventListener('click', () => {
        built = prompt.answer.map((word, wordIndex) => ({ id: `reveal-${wordIndex}`, word }));
        checked = true;
        draw();
      });

      board.querySelector('[data-action="check"]').addEventListener('click', () => {
        if (!checked) {
          checked = true;
          draw();
          return;
        }

        if (index < prompts.length - 1) {
          index++;
          built = [];
          checked = false;
          selectedTile = null;
          draggingItem = null;
          pendingSnap = null;
          draw();
        } else {
          renderUnit(unitId);
        }
      });

      animatePendingSnap();
      animatePendingWordBankReflow();
    }

    function clearDragPreview() {
      board.querySelectorAll('.dragging').forEach(item => item.classList.remove('dragging'));
      const wordBankElement = board.querySelector('.word-bank');
      if (wordBankElement) wordBankElement.classList.remove('drag-over');
      const sentenceDropzone = board.querySelector('.sentence-dropzone');
      if (sentenceDropzone) sentenceDropzone.classList.remove('drag-over');
      removeTilePlaceholder();
    }

    function getInsertionIndex(dropzone, event) {
      const tiles = [...dropzone.querySelectorAll('.sentence-slot:not(.dragging)')];
      if (!tiles.length) return 0;
      let bestIndex = tiles.length;
      let bestDistance = Infinity;
      tiles.forEach((tile, index) => {
        const rect = tile.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = event.clientX < centerX ? index : index + 1;
        }
      });
      return bestIndex;
    }

    function showTilePlaceholder(dropzone, index) {
      if (!draggingItem) return;
      let placeholder = dropzone.querySelector('.tile-placeholder');
      if (!placeholder) {
        placeholder = document.createElement('span');
        placeholder.className = 'tile-placeholder';
      }
      if (placeholder.dataset.index === String(index)) return;
      const beforeRects = new Map([...dropzone.querySelectorAll('.sentence-slot:not(.dragging)')].map(tile => [tile, tile.getBoundingClientRect()]));
      placeholder.style.width = `${draggingItem.width || 92}px`;
      placeholder.style.height = `${draggingItem.height || 70}px`;
      placeholder.dataset.index = String(index);
      const tiles = [...dropzone.querySelectorAll('.sentence-slot:not(.dragging)')];
      dropzone.insertBefore(placeholder, tiles[index] || null);
      animateTrayReflow(beforeRects, dropzone);
    }

    function removeTilePlaceholder() {
      board.querySelectorAll('.tile-placeholder').forEach(placeholder => placeholder.remove());
    }

    function startPlacedTileDrag(event, slot) {
      const dropzone = board.querySelector('.sentence-dropzone');
      if (!dropzone) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = slot.getBoundingClientRect();
      const item = {
        id: slot.dataset.tileId,
        word: slot.dataset.word,
        source: 'slot',
        slotIndex: Number(slot.dataset.slot),
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      let active = false;
      let ghost = null;

      function beginDrag() {
        active = true;
        draggingItem = item;
        slot.classList.add('dragging');
        ghost = document.createElement('div');
        ghost.className = 'snap-ghost live-drag-ghost';
        ghost.textContent = item.word;
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        document.body.appendChild(ghost);
      }

      function moveGhost(moveEvent) {
        if (!ghost) return;
        ghost.style.left = `${moveEvent.clientX - item.offsetX}px`;
        ghost.style.top = `${moveEvent.clientY - item.offsetY}px`;
      }

      function onPointerMove(moveEvent) {
        const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (!active && distance > 6) beginDrag();
        if (!active) return;
        moveEvent.preventDefault();
        moveGhost(moveEvent);
        dropzone.classList.add('drag-over');
        showTilePlaceholder(dropzone, getInsertionIndex(dropzone, moveEvent));
      }

      function onPointerUp(upEvent) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        if (!active) return;
        upEvent.preventDefault();
        suppressSlotClick = true;
        const insertionIndex = getInsertionIndex(dropzone, upEvent);
        built.splice(item.slotIndex, 1);
        built.splice(insertionIndex, 0, { id: item.id, word: item.word });
        pendingSnap = {
          id: item.id,
          x: upEvent.clientX,
          y: upEvent.clientY,
          offsetX: item.offsetX,
          offsetY: item.offsetY,
        };
        if (ghost) ghost.remove();
        draggingItem = null;
        clearDragPreview();
        draw();
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    }

    function animateTrayReflow(beforeRects, dropzone) {
      dropzone.querySelectorAll('.sentence-slot:not(.dragging)').forEach(tile => {
        const before = beforeRects.get(tile);
        if (!before) return;
        const after = tile.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (!dx && !dy) return;
        tile.style.transition = 'none';
        tile.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          tile.style.transition = '';
          tile.style.transform = '';
        });
      });
    }

    function captureWordBankRects() {
      const wordBankElement = board.querySelector('.word-bank');
      if (!wordBankElement) return null;
      return new Map([...wordBankElement.querySelectorAll('.word-tile')].map(tile => [tile.dataset.tileId, tile.getBoundingClientRect()]));
    }

    function animatePendingWordBankReflow() {
      if (!pendingWordBankRects) return;
      const beforeRects = pendingWordBankRects;
      pendingWordBankRects = null;
      board.querySelectorAll('.word-bank .word-tile').forEach(tile => {
        const before = beforeRects.get(tile.dataset.tileId);
        if (!before) return;
        const after = tile.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (!dx && !dy) return;
        tile.style.transition = 'none';
        tile.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          tile.style.transition = '';
          tile.style.transform = '';
        });
      });
    }

    function animatePendingSnap() {
      if (!pendingSnap) return;
      const snap = pendingSnap;
      pendingSnap = null;
      const target = board.querySelector(`.sentence-slot.filled[data-tile-id="${CSS.escape(snap.id)}"]`);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const startX = snap.x - (snap.offsetX || rect.width / 2);
      const startY = snap.y - (snap.offsetY || rect.height / 2);
      const ghost = document.createElement('div');
      ghost.className = 'snap-ghost';
      ghost.textContent = target.textContent.trim();
      ghost.style.left = `${startX}px`;
      ghost.style.top = `${startY}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;

      target.classList.add('snap-target');
      document.body.appendChild(ghost);
      ghost.getBoundingClientRect();
      ghost.style.transform = `translate(${rect.left - startX}px, ${rect.top - startY}px) scale(1)`;

      ghost.addEventListener('transitionend', () => {
        ghost.remove();
        target.classList.remove('snap-target');
        target.classList.add('snap-landed');
        target.addEventListener('animationend', () => {
          target.classList.remove('snap-landed');
        }, { once: true });
      }, { once: true });
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
