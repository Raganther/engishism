// Event bus factory — create one per activity session.
// Keeps events scoped to the current game. No bleed between activities.
window.createEventBus = function () {
  const listeners = {};

  return {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    emit(event, data) {
      (listeners[event] || []).forEach(fn => fn(data || {}));
    },
    clear() {
      Object.keys(listeners).forEach(k => { listeners[k] = []; });
    }
  };
};
