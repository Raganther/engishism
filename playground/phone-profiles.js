/* ================= Phone profiles — what a real handset's screen is =================
   The ONE home for phone geometry. The Room bench racks its simulated handsets at
   these sizes and the smoke suite opens its phone pages at them — a hardcoded
   phone viewport anywhere else is the bug this file exists to end.

   Width × height are the VISIBLE CSS pixels — the browser chrome (URL bar, system
   nav) is already subtracted. That subtraction is the whole point: the bench spent
   weeks modelling a phone as a chrome-less 390×844 rectangle, which no student's
   handset is, and the first classroom photos showed a grid two-thirds the size the
   bench promised. `standard` is the DEFAULT everywhere: the realistic case, not
   the flattering one. `full` is the no-chrome comparison (a PWA, or the old bench
   assumption) — useful to look at, never the truth to design against.

   The numbers are representative, not per-device gospel; when a classroom photo
   disagrees, this file is where the correction lands, once.

   Dual-export: browser pages get window.PHONE_PROFILES, the node suite requires
   this file directly. */
(function(root){
  const PROFILES = {
    small:    { w: 360, h: 640, label: 'Small phone · bars shown' },
    standard: { w: 390, h: 664, label: 'Standard phone · bars shown (default)' },
    tall:     { w: 390, h: 740, label: 'Standard phone · bar collapsed' },
    full:     { w: 390, h: 844, label: 'Full screen · no chrome (comparison only)' }
  };
  PROFILES.DEFAULT = 'standard';
  root.PHONE_PROFILES = PROFILES;
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
