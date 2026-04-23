window.Activities = window.Activities || {};

// content.questions = [{ sentence, note }, ...]
// Blanks marked as [answer] in sentence string.
window.Activities['fill-blank'] = {
  render(c) {
    if (c.mode === 'multiple-choice' || c.mode === 'drag-drop') {
      const items = c.questions.map((q, i) => {
        const withBlank = q.sentence.replace(
          /\[([^\]]+)\]/,
          `<span class="blank blank-choice fb-dropzone" data-answer="$1">Drop here</span>`
        );
        const options = (q.options || []).map(option => `
          <button class="fb-option" data-option="${option}" draggable="true">${option}</button>
        `).join('');

        return `
          <div class="multi-item ${i === 0 ? 'active' : ''}">
            ${q.note ? `<p class="form-note">${q.note}</p>` : ''}
            <p class="sentence">${withBlank}</p>
            <div class="fb-options">${options}</div>
            <p class="hint">drag the correct answer into the blank</p>
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
    if (c.mode === 'multiple-choice' || c.mode === 'drag-drop') {
      const items = el.querySelectorAll('.multi-item');
      const counter = el.querySelector('.multi-counter');
      const nextBtn = el.querySelector('.multi-next');
      let current = 0;

      function resetItem(item) {
        item.querySelectorAll('.fb-option').forEach(option => {
          option.disabled = false;
          option.draggable = true;
          option.classList.remove('correct', 'wrong', 'selected', 'dragging');
        });

        const blank = item.querySelector('.blank-choice');
        blank.textContent = 'Drop here';
        blank.classList.remove('revealed', 'correct', 'wrong', 'drag-over');

        const hint = item.querySelector('.hint');
        hint.classList.remove('fb-feedback-correct', 'fb-feedback-wrong');
        hint.textContent = 'drag the correct answer into the blank';
      }

      items.forEach(item => {
        const blank = item.querySelector('.blank-choice');
        const answer = blank.dataset.answer;
        const hint = item.querySelector('.hint');
        let draggedOption = null;
        let selectedOption = null;

        function lockItem() {
          item.querySelectorAll('.fb-option').forEach(btn => {
            btn.disabled = true;
            btn.draggable = false;
            btn.classList.remove('dragging');
          });
        }

        function resolveChoice(choice) {
          const chosenBtn = [...item.querySelectorAll('.fb-option')]
            .find(btn => btn.dataset.option === choice);
          const correctBtn = [...item.querySelectorAll('.fb-option')]
            .find(btn => btn.dataset.option === answer);

          lockItem();
          if (chosenBtn) chosenBtn.classList.add('selected');

          blank.textContent = answer;
          blank.classList.add('revealed');
          blank.classList.remove('drag-over');

          if (choice === answer) {
            if (chosenBtn) chosenBtn.classList.add('correct');
            blank.classList.add('correct');
            hint.textContent = 'Correct';
            hint.classList.add('fb-feedback-correct');
          } else {
            if (chosenBtn) chosenBtn.classList.add('wrong');
            if (correctBtn) correctBtn.classList.add('correct');
            blank.classList.add('wrong');
            hint.textContent = 'Not quite - correct answer revealed';
            hint.classList.add('fb-feedback-wrong');
          }
        }

        item.querySelectorAll('.fb-option').forEach(option => {
          option.addEventListener('dragstart', e => {
            if (option.disabled) {
              e.preventDefault();
              return;
            }
            draggedOption = option;
            option.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', option.dataset.option);
          });

          option.addEventListener('dragend', () => {
            option.classList.remove('dragging');
            blank.classList.remove('drag-over');
          });

          option.addEventListener('click', e => {
            e.stopPropagation();
            if (option.disabled) return;

            item.querySelectorAll('.fb-option').forEach(btn => btn.classList.remove('selected'));
            option.classList.add('selected');
            selectedOption = option;
            hint.textContent = 'now drop it into the blank';
          });
        });

        blank.addEventListener('dragover', e => {
          if (!draggedOption || draggedOption.disabled) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          blank.classList.add('drag-over');
        });

        blank.addEventListener('dragleave', () => {
          blank.classList.remove('drag-over');
        });

        blank.addEventListener('drop', e => {
          if (!draggedOption || draggedOption.disabled) return;
          e.preventDefault();
          const choice = e.dataTransfer.getData('text/plain') || draggedOption.dataset.option;
          resolveChoice(choice);
          draggedOption = null;
          selectedOption = null;
        });

        blank.addEventListener('click', e => {
          e.stopPropagation();
          if (selectedOption && !selectedOption.disabled) {
            resolveChoice(selectedOption.dataset.option);
            selectedOption = null;
          }
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
