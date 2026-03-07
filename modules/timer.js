window.Modules = window.Modules || {};

// Timer module — renders in the top bar.
// Waits for 'start' event, then counts down from state.timeLeft.
// Emits 'time-up' when done. Stops on 'round-end'.
window.Modules['timer'] = {
  zone: 'top',

  render(state) {
    return `
      <div class="mod-timer">
        <span class="mod-timer-display">${state.timeLeft}</span>
        <span class="mod-timer-label">seconds</span>
      </div>
    `;
  },

  init(el, state, events) {
    const display = el.querySelector('.mod-timer-display');
    let interval  = null;

    function tick() {
      state.timeLeft--;
      display.textContent = state.timeLeft;
      if (state.timeLeft <= 10) display.classList.add('urgent');
      if (state.timeLeft <= 0) {
        clearInterval(interval);
        interval = null;
        events.emit('time-up');
      }
    }

    events.on('start',     () => { interval = setInterval(tick, 1000); });
    events.on('round-end', () => { clearInterval(interval); interval = null; });
  }
};
