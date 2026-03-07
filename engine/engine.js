(function () {
  const lesson     = window.LESSON;
  const activities = window.Activities;

  let current = 0;

  const container = document.getElementById('slide-container');
  const counter   = document.getElementById('slide-counter');
  const btnPrev   = document.getElementById('btn-prev');
  const btnNext   = document.getElementById('btn-next');

  function render(index) {
    const slide    = lesson.slides[index];
    const activity = activities[slide.type];

    if (!activity) {
      container.innerHTML = `<p style="color:red;font-size:2rem">Unknown activity type: "${slide.type}"</p>`;
      return;
    }

    container.innerHTML = activity.render(slide.content);
    activity.init(container, slide.content);

    counter.textContent  = `${index + 1} / ${lesson.slides.length}`;
    btnPrev.disabled     = index === 0;
    btnNext.disabled     = index === lesson.slides.length - 1;
  }

  function go(dir) {
    const next = current + dir;
    if (next < 0 || next >= lesson.slides.length) return;
    current = next;
    render(current);
  }

  btnPrev.addEventListener('click', () => go(-1));
  btnNext.addEventListener('click', () => go(1));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft')                   { e.preventDefault(); go(-1); }
  });

  render(0);
})();
