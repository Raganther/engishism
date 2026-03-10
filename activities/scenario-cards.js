window.Activities = window.Activities || {};

// content.cards = [{
//   title:        str,
//   scenario:     str,
//   verdict:      str,          // e.g. "🚨 SCAM" or "✓ LEGIT"
//   verdictStyle: str,          // 'danger' | 'success' | 'warning' | 'neutral'
//   reveal:       str,          // explanation text shown with verdict
//   details:      [str, ...],   // optional — bullet points (red flags, model phrases, etc.)
//   hook:         str,          // optional — speaking / grammar prompt
// }]

window.Activities['scenario-cards'] = {

  render(c) {
    const gridCards = c.cards.map((card, i) => `
      <button class="sc-card" data-index="${i}">
        <div class="sc-card-title">${card.title}</div>
        <div class="sc-card-snippet">${card.scenario.slice(0, 90)}${card.scenario.length > 90 ? '…' : ''}</div>
        <div class="sc-done-mark">✓</div>
      </button>
    `).join('');

    const detailPanels = c.cards.map((card, i) => {
      const hasDetails = (card.details && card.details.length) || card.hook;
      const detailItems = (card.details && card.details.length)
        ? `<ul class="sc-details">${card.details.map(d => `<li>${d}</li>`).join('')}</ul>`
        : '';
      const hookEl = card.hook
        ? `<div class="sc-hook">${card.hook}</div>`
        : '';
      return `
        <div class="sc-detail-view hidden" data-index="${i}">
          <div class="sc-detail-title">${card.title}</div>
          <div class="sc-scenario">${card.scenario}</div>
          <div class="sc-verdict-wrap hidden">
            <div class="sc-badge sc-badge-${card.verdictStyle || 'neutral'}">${card.verdict}</div>
            <p class="sc-reveal-text">${card.reveal || ''}</p>
          </div>
          <div class="sc-details-wrap hidden">
            ${detailItems}${hookEl}
          </div>
          <div class="sc-actions">
            <button class="reveal-btn sc-btn-verdict">Reveal Verdict</button>
            ${hasDetails ? '<button class="reveal-btn sc-btn-details hidden">Show Details</button>' : ''}
            <button class="sc-btn-back">← Back</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="slide scenario-cards">
        <div class="sc-grid-view">
          <div class="sc-grid">${gridCards}</div>
          <div class="sc-grid-footer">
            <span class="sc-progress"></span>
            <button class="sc-btn-done">Done ✓</button>
          </div>
        </div>
        ${detailPanels}
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const gridView    = el.querySelector('.sc-grid-view');
    const cardBtns    = el.querySelectorAll('.sc-card');
    const detailViews = el.querySelectorAll('.sc-detail-view');
    const progress    = el.querySelector('.sc-progress');
    const btnDone     = el.querySelector('.sc-btn-done');
    let doneCount     = 0;

    function updateProgress() {
      progress.textContent = `${doneCount} / ${c.cards.length} done`;
    }

    function showGrid() {
      gridView.classList.remove('hidden');
      detailViews.forEach(d => d.classList.add('hidden'));
    }

    function showDetail(i) {
      gridView.classList.add('hidden');
      detailViews.forEach(d => d.classList.add('hidden'));
      detailViews[i].classList.remove('hidden');
    }

    cardBtns.forEach((btn, i) => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        showDetail(i);
      });
    });

    detailViews.forEach((detail, i) => {
      const btnVerdict  = detail.querySelector('.sc-btn-verdict');
      const btnDetails  = detail.querySelector('.sc-btn-details');
      const verdictWrap = detail.querySelector('.sc-verdict-wrap');
      const detailsWrap = detail.querySelector('.sc-details-wrap');
      const btnBack     = detail.querySelector('.sc-btn-back');

      btnVerdict.addEventListener('click', e => {
        e.stopPropagation();
        verdictWrap.classList.remove('hidden');
        btnVerdict.style.display = 'none';
        if (btnDetails) btnDetails.classList.remove('hidden');
      });

      if (btnDetails) {
        btnDetails.addEventListener('click', e => {
          e.stopPropagation();
          detailsWrap.classList.remove('hidden');
          btnDetails.style.display = 'none';
        });
      }

      btnBack.addEventListener('click', e => {
        e.stopPropagation();
        if (!verdictWrap.classList.contains('hidden') &&
            !cardBtns[i].classList.contains('sc-done')) {
          cardBtns[i].classList.add('sc-done');
          doneCount++;
          updateProgress();
        }
        // reset for next visit
        verdictWrap.classList.add('hidden');
        if (detailsWrap) detailsWrap.classList.add('hidden');
        if (btnDetails) {
          btnDetails.classList.add('hidden');
          btnDetails.style.display = '';
        }
        btnVerdict.style.display = '';
        showGrid();
      });
    });

    btnDone.addEventListener('click', e => {
      e.stopPropagation();
      onComplete();
    });

    updateProgress();
  }
};
