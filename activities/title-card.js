window.Activities = window.Activities || {};

window.Activities['title-card'] = {
  render(c) {
    return `
      <div class="slide title-card">
        ${c.unit ? `<p class="unit-label">${c.unit}</p>` : ''}
        <h1 class="heading">${c.heading}</h1>
        ${c.subheading ? `<p class="subheading">${c.subheading}</p>` : ''}
      </div>
    `;
  },
  init(el, c, { onComplete }) {}
};
