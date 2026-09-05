/* ---- Millionaire's settings, declared apart from the game ----
   Its own three weights; the shared Competition switches it also reads (stealOnWrong,
   stealFullValue) are app-wide, in hub-app-settings.js. Self-registers into
   `window.HubSettings` on load. */
window.registerMillionaireSettings = function(S){
  S.register({ id:'mLifelines', group:'Millionaire', type:'toggle', default:true, games:['millionaire'],
    label:'Lifelines', help:'50:50, Ask the class, and Confer — one use each per team.' });
  S.register({ id:'mFinalAnswer', group:'Millionaire', type:'toggle', default:true, games:['millionaire'],
    label:'Final answer?',
    help:'A picked option locks in highlighted and waits for "Final answer?" before the reveal. The team can change their mind until then. Off reveals on the first click.' });
  S.register({ id:'mConferSeconds', group:'Millionaire', under:'mLifelines', type:'select', default:30, games:['millionaire'],
    label:'Confer time', help:'How long a team gets to consult when they use Confer.',
    options:[{value:30,label:'30 seconds'},{value:45,label:'45 seconds'},{value:60,label:'60 seconds'}] });
};

if(window.HubSettings) window.registerMillionaireSettings(window.HubSettings);
