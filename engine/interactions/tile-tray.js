(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function createTileTray(options) {
    const root = options.root;
    const items = options.items || [];
    let placed = (options.placed || []).map(item => ({ ...item }));
    const disabled = Boolean(options.disabled);
    const labels = {
      tray: 'Tile tray',
      bank: 'Tiles',
      empty: 'Drop tiles here',
      ...(options.labels || {}),
    };
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

    let draggingItem = null;
    let pendingSnap = null;
    let suppressPlacedClick = false;
    let pendingBankRects = null;

    function emitChange(nextPlaced) {
      placed = nextPlaced.map(item => ({ ...item }));
      draw();
      onChange(placed.map(item => ({ ...item })));
    }

    function remainingTiles() {
      const usedIds = new Set(placed.map(item => item.id));
      return items.filter(item => !usedIds.has(item.id));
    }

    function draw() {
      const placedTiles = placed.map((item, index) => `
        <button class="tile-tray__tile tile-tray__placed sentence-slot filled"
          data-slot="${index}"
          data-tile-id="${escapeHtml(item.id)}"
          data-word="${escapeHtml(item.word)}"
          draggable="false"
          ${disabled ? 'disabled' : ''}>
          ${escapeHtml(item.word)}
        </button>
      `).join('');

      const bankTiles = remainingTiles().map(item => `
        <button class="tile-tray__tile tile-tray__bank-tile word-tile"
          data-tile-id="${escapeHtml(item.id)}"
          data-word="${escapeHtml(item.word)}"
          draggable="${disabled ? 'false' : 'true'}"
          ${disabled ? 'disabled' : ''}>
          ${escapeHtml(item.word)}
        </button>
      `).join('');

      root.innerHTML = `
        <div class="tile-tray">
          <div class="tile-tray__dropzone sentence-slots sentence-dropzone" aria-label="${escapeHtml(labels.tray)}">
            ${placedTiles || `<div class="tile-tray__empty drop-hint">${escapeHtml(labels.empty)}</div>`}
          </div>
          <div class="tile-tray__bank word-bank${disabled ? ' word-bank-placeholder' : ''}" aria-label="${escapeHtml(labels.bank)}" ${disabled ? 'aria-hidden="true"' : ''}>
            ${disabled ? '' : bankTiles}
          </div>
        </div>
      `;

      bindBankTiles();
      bindPlacedTiles();
      bindDropzone();
      bindBank();
      animatePendingSnap();
      animatePendingBankReflow();
    }

    function bindBankTiles() {
      root.querySelectorAll('.tile-tray__bank-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          if (disabled) return;
          pendingBankRects = captureBankRects();
          emitChange([...placed, { id: tile.dataset.tileId, word: tile.dataset.word }]);
        });

        tile.addEventListener('dragstart', event => {
          if (disabled) return;
          const rect = tile.getBoundingClientRect();
          draggingItem = {
            id: tile.dataset.tileId,
            word: tile.dataset.word,
            source: 'bank',
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            width: rect.width,
            height: rect.height,
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
    }

    function bindPlacedTiles() {
      root.querySelectorAll('.tile-tray__placed').forEach(tile => {
        tile.addEventListener('click', () => {
          if (disabled) return;
          if (suppressPlacedClick) {
            suppressPlacedClick = false;
            return;
          }
          const nextPlaced = [...placed];
          nextPlaced.splice(Number(tile.dataset.slot), 1);
          emitChange(nextPlaced);
        });

        tile.addEventListener('pointerdown', event => {
          if (disabled || !tile.dataset.word || event.button !== 0) return;
          startPlacedTileDrag(event, tile);
        });
      });
    }

    function bindDropzone() {
      const dropzone = root.querySelector('.tile-tray__dropzone');
      if (!dropzone) return;

      dropzone.addEventListener('dragover', event => {
        if (disabled) return;
        event.preventDefault();
        dropzone.classList.add('drag-over');
        showTilePlaceholder(dropzone, getInsertionIndex(dropzone, event));
      });

      dropzone.addEventListener('dragleave', event => {
        if (dropzone.contains(event.relatedTarget)) return;
        dropzone.classList.remove('drag-over');
        removeTilePlaceholder();
      });

      dropzone.addEventListener('drop', event => {
        if (disabled) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData('application/json');
        if (!raw) return;
        const item = JSON.parse(raw);
        const insertionIndex = getInsertionIndex(dropzone, event);
        dropzone.classList.remove('drag-over');
        clearDragPreview();
        const nextPlaced = moveItemIntoTray(item, insertionIndex);
        pendingSnap = {
          id: item.id,
          x: event.clientX,
          y: event.clientY,
          offsetX: item.offsetX,
          offsetY: item.offsetY,
        };
        emitChange(nextPlaced);
      });
    }

    function bindBank() {
      const bank = root.querySelector('.tile-tray__bank');
      if (!bank) return;

      bank.addEventListener('dragover', event => {
        if (disabled || !draggingItem || draggingItem.source !== 'slot') return;
        event.preventDefault();
        bank.classList.add('drag-over');
      });

      bank.addEventListener('dragleave', () => {
        bank.classList.remove('drag-over');
      });

      bank.addEventListener('drop', event => {
        if (disabled) return;
        event.preventDefault();
        bank.classList.remove('drag-over');
        const raw = event.dataTransfer.getData('application/json');
        if (!raw) return;
        const item = JSON.parse(raw);
        if (item.source !== 'slot') return;
        pendingBankRects = captureBankRects();
        const nextPlaced = [...placed];
        nextPlaced.splice(item.slotIndex, 1);
        emitChange(nextPlaced);
      });
    }

    function moveItemIntoTray(item, insertionIndex) {
      let nextPlaced = [...placed];
      if (item.source === 'slot') {
        nextPlaced.splice(item.slotIndex, 1);
        nextPlaced.splice(insertionIndex, 0, { id: item.id, word: item.word });
      } else {
        pendingBankRects = captureBankRects();
        nextPlaced = nextPlaced.filter(existing => existing.id !== item.id);
        nextPlaced.splice(insertionIndex, 0, { id: item.id, word: item.word });
      }
      return nextPlaced.slice(0, items.length);
    }

    function clearDragPreview() {
      root.querySelectorAll('.dragging').forEach(item => item.classList.remove('dragging'));
      const bank = root.querySelector('.tile-tray__bank');
      if (bank) bank.classList.remove('drag-over');
      const dropzone = root.querySelector('.tile-tray__dropzone');
      if (dropzone) dropzone.classList.remove('drag-over');
      removeTilePlaceholder();
    }

    function getInsertionIndex(dropzone, event) {
      const tiles = [...dropzone.querySelectorAll('.tile-tray__placed:not(.dragging)')];
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
        placeholder.className = 'tile-tray__placeholder tile-placeholder';
      }
      if (placeholder.dataset.index === String(index)) return;
      const beforeRects = new Map([...dropzone.querySelectorAll('.tile-tray__placed:not(.dragging)')].map(tile => [tile, tile.getBoundingClientRect()]));
      placeholder.style.width = `${draggingItem.width || 92}px`;
      placeholder.style.height = `${draggingItem.height || 60}px`;
      placeholder.dataset.index = String(index);
      const tiles = [...dropzone.querySelectorAll('.tile-tray__placed:not(.dragging)')];
      dropzone.insertBefore(placeholder, tiles[index] || null);
      animateTrayReflow(beforeRects, dropzone);
    }

    function removeTilePlaceholder() {
      root.querySelectorAll('.tile-placeholder').forEach(placeholder => placeholder.remove());
    }

    function startPlacedTileDrag(event, tile) {
      const dropzone = root.querySelector('.tile-tray__dropzone');
      if (!dropzone) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = tile.getBoundingClientRect();
      const item = {
        id: tile.dataset.tileId,
        word: tile.dataset.word,
        source: 'slot',
        slotIndex: Number(tile.dataset.slot),
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
        tile.classList.add('dragging');
        ghost = document.createElement('div');
        ghost.className = 'tile-tray__ghost snap-ghost live-drag-ghost';
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
        const bank = root.querySelector('.tile-tray__bank');
        if (bank && isPointInside(moveEvent, bank)) {
          bank.classList.add('drag-over');
          dropzone.classList.remove('drag-over');
          removeTilePlaceholder();
        } else {
          if (bank) bank.classList.remove('drag-over');
          dropzone.classList.add('drag-over');
          showTilePlaceholder(dropzone, getInsertionIndex(dropzone, moveEvent));
        }
      }

      function onPointerUp(upEvent) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        if (!active) return;
        upEvent.preventDefault();
        suppressPlacedClick = true;
        const bank = root.querySelector('.tile-tray__bank');
        if (bank && isPointInside(upEvent, bank)) {
          pendingBankRects = captureBankRects();
          const nextPlaced = [...placed];
          nextPlaced.splice(item.slotIndex, 1);
          if (ghost) ghost.remove();
          draggingItem = null;
          clearDragPreview();
          emitChange(nextPlaced);
          return;
        }
        const insertionIndex = getInsertionIndex(dropzone, upEvent);
        const nextPlaced = [...placed];
        nextPlaced.splice(item.slotIndex, 1);
        nextPlaced.splice(insertionIndex, 0, { id: item.id, word: item.word });
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
        emitChange(nextPlaced);
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    }

    function isPointInside(event, element) {
      const rect = element.getBoundingClientRect();
      return event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
    }

    function animateTrayReflow(beforeRects, dropzone) {
      dropzone.querySelectorAll('.tile-tray__placed:not(.dragging)').forEach(tile => {
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

    function captureBankRects() {
      const bank = root.querySelector('.tile-tray__bank');
      if (!bank) return null;
      return new Map([...bank.querySelectorAll('.tile-tray__bank-tile')].map(tile => [tile.dataset.tileId, tile.getBoundingClientRect()]));
    }

    function animatePendingBankReflow() {
      if (!pendingBankRects) return;
      const beforeRects = pendingBankRects;
      pendingBankRects = null;
      root.querySelectorAll('.tile-tray__bank .tile-tray__bank-tile').forEach(tile => {
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
      const target = root.querySelector(`.tile-tray__placed[data-tile-id="${CSS.escape(snap.id)}"]`);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const startX = snap.x - (snap.offsetX || rect.width / 2);
      const startY = snap.y - (snap.offsetY || rect.height / 2);
      const ghost = document.createElement('div');
      ghost.className = 'tile-tray__ghost snap-ghost';
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

    return {
      update(nextOptions = {}) {
        placed = (nextOptions.placed || placed).map(item => ({ ...item }));
        draw();
      },
      destroy() {
        root.innerHTML = '';
      },
    };
  }

  window.EngishismTileTray = {
    create: createTileTray,
  };
})();
