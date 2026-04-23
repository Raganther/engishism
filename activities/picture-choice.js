window.Activities = window.Activities || {};

// content.questions = [{
//   image: { src, col, row, cols, rows },
//   prompt: str,
//   options: [str, ...],
//   answer: number,
//   explanation: str
// }]
window.Activities['picture-choice'] = {
  render(c) {
    const questions = c.questions.map((q, i) => {
      const image = q.image || {};
      const cols = image.cols || 1;
      const rows = image.rows || 1;
      const x = cols > 1 ? (image.col || 0) * (100 / (cols - 1)) : 0;
      const y = rows > 1 ? (image.row || 0) * (100 / (rows - 1)) : 0;
      const options = q.options.map((option, optionIndex) => `
        <button class="pc-option" data-index="${optionIndex}">${option}</button>
      `).join('');

      return `
        <div class="multi-item pc-item ${i === 0 ? 'active' : ''}">
          <div class="pc-image"
            role="img"
            aria-label="${image.alt || q.prompt || 'Picture prompt'}"
            style="background-image:url('${image.src}');background-size:${cols * 100}% ${rows * 100}%;background-position:${x}% ${y}%;">
          </div>
          <p class="pc-prompt">${q.prompt || 'Choose the best sentence.'}</p>
          <div class="pc-options">${options}</div>
          <p class="pc-feedback"></p>
        </div>
      `;
    }).join('');

    return `
      <div class="slide picture-choice">
        ${questions}
        <div class="multi-nav">
          <span class="multi-counter">1 / ${c.questions.length}</span>
          <button class="multi-next">Next &#8594;</button>
        </div>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const items = el.querySelectorAll('.multi-item');
    const counter = el.querySelector('.multi-counter');
    const nextBtn = el.querySelector('.multi-next');
    let current = 0;

    function resetItem(item) {
      item.querySelectorAll('.pc-option').forEach(option => {
        option.disabled = false;
        option.classList.remove('correct', 'wrong', 'selected');
      });
      const feedback = item.querySelector('.pc-feedback');
      feedback.textContent = '';
      feedback.classList.remove('correct', 'wrong');
    }

    function showItem(index) {
      items.forEach(item => item.classList.remove('active'));
      items[index].classList.add('active');
      resetItem(items[index]);
      counter.textContent = `${index + 1} / ${c.questions.length}`;
      nextBtn.textContent = index === c.questions.length - 1 ? 'Done \u2713' : 'Next \u2192';
    }

    items.forEach((item, itemIndex) => {
      const question = c.questions[itemIndex];
      const answer = question.answer;
      const feedback = item.querySelector('.pc-feedback');

      item.querySelectorAll('.pc-option').forEach(option => {
        option.addEventListener('click', e => {
          e.stopPropagation();
          const chosen = Number(option.dataset.index);
          const correctOption = item.querySelector(`.pc-option[data-index="${answer}"]`);

          item.querySelectorAll('.pc-option').forEach(btn => {
            btn.disabled = true;
            btn.classList.remove('selected');
          });

          option.classList.add('selected');

          if (chosen === answer) {
            option.classList.add('correct');
            feedback.textContent = question.explanation || 'Correct';
            feedback.classList.add('correct');
          } else {
            option.classList.add('wrong');
            if (correctOption) correctOption.classList.add('correct');
            feedback.textContent = question.explanation || 'Not quite. The correct answer is highlighted.';
            feedback.classList.add('wrong');
          }
        });
      });
    });

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
  }
};
