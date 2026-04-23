window.Activities = window.Activities || {};

// content.questions = [{ sentence, note }, ...]
// Blanks marked as [answer] in sentence string.
window.Activities['fill-blank'] = {
  render(c) {
    if (c.mode === 'multiple-choice') {
      const items = c.questions.map((q, i) => {
        const withBlank = q.sentence.replace(
          /\[([^\]]+)\]/,
          `<span class="blank blank-choice" data-answer="$1">_____</span>`
        );
        const options = (q.options || []).map(option => `
          <button class="fb-option" data-option="${option}">${option}</button>
        `).join('');

        return `
          <div class="multi-item ${i === 0 ? 'active' : ''}">
            ${q.note ? `<p class="form-note">${q.note}</p>` : ''}
            <p class="sentence">${withBlank}</p>
            <div class="fb-options">${options}</div>
            <p class="hint">choose the best answer</p>
          </div>
        `;
      }).join('');

      return `
        <div class="slide fill-blank fill-blank-v2">
          ${items}
          <div class="multi-nav">
            <span class="multi-counter">1 / ${c.questions.length}</span>
            <button class="multi-next">Next &#8594;</button>
          </div>
        </div>
      `;
    }

    const items = c.questions.map((q, i) => {
      const withBlanks = q.sentence.replace(
        /\[([^\]]+)\]/g,
        `<span class="blank" data-answer="$1">_____</span>`
      );
      return `
        <div class="multi-item ${i === 0 ? 'active' : ''}">
          ${q.note ? `<p class="form-note">${q.note}</p>` : ''}
          <p class="sentence">${withBlanks}</p>
        </div>
      `;
    }).join('');

    return `
      <div class="slide fill-blank">
        ${items}
        <p class="hint">tap a blank to reveal</p>
        <div class="multi-nav">
          <span class="multi-counter">1 / ${c.questions.length}</span>
          <button class="multi-next">Next &#8594;</button>
        </div>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    if (c.mode === 'multiple-choice') {
      const items = el.querySelectorAll('.multi-item');
      const counter = el.querySelector('.multi-counter');
      const nextBtn = el.querySelector('.multi-next');
      let current = 0;

      function resetItem(item) {
        item.querySelectorAll('.fb-option').forEach(option => {
          option.disabled = false;
          option.classList.remove('correct', 'wrong', 'selected');
        });

        const blank = item.querySelector('.blank-choice');
        blank.textContent = '_____';
        blank.classList.remove('revealed');

        const hint = item.querySelector('.hint');
        hint.classList.remove('fb-feedback-correct', 'fb-feedback-wrong');
        hint.textContent = 'choose the best answer';
      }

      items.forEach(item => {
        const blank = item.querySelector('.blank-choice');
        const answer = blank.dataset.answer;
        const hint = item.querySelector('.hint');

        item.querySelectorAll('.fb-option').forEach(option => {
          option.addEventListener('click', e => {
            e.stopPropagation();

            if (option.disabled) return;

            const choice = option.dataset.option;
            const correctBtn = [...item.querySelectorAll('.fb-option')]
              .find(btn => btn.dataset.option === answer);

            item.querySelectorAll('.fb-option').forEach(btn => {
              btn.disabled = true;
              btn.classList.remove('selected');
            });

            option.classList.add('selected');
            blank.textContent = answer;
            blank.classList.add('revealed');

            if (choice === answer) {
              option.classList.add('correct');
              hint.textContent = 'Correct';
              hint.classList.add('fb-feedback-correct');
            } else {
              option.classList.add('wrong');
              if (correctBtn) correctBtn.classList.add('correct');
              hint.textContent = 'Not quite - correct answer revealed';
              hint.classList.add('fb-feedback-wrong');
            }
          });
        });
      });

      function showItem(i) {
        items.forEach(item => item.classList.remove('active'));
        items[i].classList.add('active');
        resetItem(items[i]);
        counter.textContent = `${i + 1} / ${c.questions.length}`;
        nextBtn.textContent = i === c.questions.length - 1 ? 'Done \u2713' : 'Next \u2192';
      }

      nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (current < c.questions.length - 1) {
          current++;
          showItem(current);
        } else {
          onComplete();
        }
      });

      showItem(0);
      return;
    }

    const items   = el.querySelectorAll('.multi-item');
    const counter = el.querySelector('.multi-counter');
    const nextBtn = el.querySelector('.multi-next');
    const hint    = el.querySelector('.hint');
    let current   = 0;

    // Attach blank listeners for all items upfront
    el.querySelectorAll('.blank').forEach(blank => {
      blank.addEventListener('click', e => {
        e.stopPropagation();
        blank.textContent = blank.dataset.answer;
        blank.classList.add('revealed');
        const allRevealed = [...items[current].querySelectorAll('.blank')]
          .every(b => b.classList.contains('revealed'));
        if (allRevealed) hint.classList.add('hidden');
      });
    });

    function showItem(i) {
      items.forEach(item => item.classList.remove('active'));
      items[i].classList.add('active');
      hint.classList.remove('hidden');
      counter.textContent = `${i + 1} / ${c.questions.length}`;
      nextBtn.textContent = i === c.questions.length - 1 ? 'Done \u2713' : 'Next \u2192';
    }

    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (current < c.questions.length - 1) {
        current++;
        showItem(current);
      } else {
        onComplete();
      }
    });
  }
};
