window.Activities = window.Activities || {};

// A reference card listing items with labels + examples.
// No interaction — all items shown at once.
window.Activities['reveal-card'] = {
  render(c) {
    const items = c.items.map(item => `
      <li class="item">
        <span class="item-label">${item.label}</span>
        <span class="item-example">${item.example}</span>
      </li>
    `).join('');

    return `
      <div class="slide reveal-card">
        <h2 class="card-heading">${c.heading}</h2>
        <ul class="items">${items}</ul>
      </div>
    `;
  },
  init() {}
};
