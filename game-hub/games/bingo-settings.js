/* ---- Bingo's settings, declared apart from the game ----
   Self-registers into `window.HubSettings` on load. Board stays the default and the
   fallback: no relay, no wifi, or phones banned that week and the game still runs. */
window.registerBingoSettings = function(S){
  S.register({ id:'bingoCards', group:'Bingo', type:'variant', default:'board', games:['bingo'],
    label:'Where the cards live',
    help:'On the board is one card per team, shared. On the phones is one card per student.',
    variants:[
      {value:'board',  label:'On the board — one card per team'},
      {value:'phones', label:'On the phones — one card each'}
    ] });

  S.register({ id:'bingoPoints', group:'Bingo', type:'range', default:1,
    min:1, max:5, step:1, unit:' pts', games:['bingo'],
    label:'Points per square',
    help:'What marking a word off is worth. A line ends the round whatever this is.' });
};

if(window.HubSettings) window.registerBingoSettings(window.HubSettings);
