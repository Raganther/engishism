/* ---- Quickfire's settings, declared apart from the game ----
   The game's id is `kahoot` (its settings scope to it). All classroom questions rather
   than design ones — every one is a guess until a class has met them. Self-registers into
   `window.HubSettings` on load. */
window.registerQuickfireSettings = function(S){
  S.register({ id:'kQuestions', group:'Quickfire', type:'range', default:15,
    min:5, max:30, step:1, unit:'', games:['kahoot'],
    label:'Questions in a run',
    help:'The run ends after this many. Fewer if the sections you picked hold fewer.' });
  S.register({ id:'kSeconds', group:'Quickfire', type:'range', default:20,
    min:5, max:60, step:5, unit:'s', games:['kahoot'],
    label:'Seconds per question',
    help:'How long the room has to read the question and answer it. The clock is the whole game here.' });
  S.register({ id:'kPoints', group:'Quickfire', type:'range', default:100,
    min:20, max:500, step:20, unit:'', games:['kahoot'],
    label:'Points for a right answer',
    help:'What an instant answer pays. One that arrives as the clock dies pays half, and everything in between scales.' });
};

if(window.HubSettings) window.registerQuickfireSettings(window.HubSettings);
