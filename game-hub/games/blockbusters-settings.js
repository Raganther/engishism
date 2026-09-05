/* ---- Blockbusters' settings, declared apart from the game ----
   Its own rows only; the shared keepControl (Competition) and bbTeamVote (Phones) are
   app-wide, in hub-app-settings.js. Self-registers into `window.HubSettings` on load. */
window.registerBlockbustersSettings = function(S){
  S.register({ id:'bbWinRoute', group:'Blockbusters', adv:true, type:'variant', default:'trace',
    games:['blockbusters'],
    label:'Winning route', help:'How the completed line is shown when a team connects its two edges.',
    variants:[{value:'trace', label:'Light up along the route'},
              {value:'pulse', label:'Flash the whole route at once'},
              {value:'off',   label:'Just mark it — no animation'}] });

  S.register({ id:'bbEdges', group:'Blockbusters', adv:true, type:'toggle', default:true,
    games:['blockbusters'],
    label:'Team edges around the board',
    help:'Yellow teeth down the sides and blue along the top and bottom, so which way each team has to connect is on the board itself.' });
};

if(window.HubSettings) window.registerBlockbustersSettings(window.HubSettings);
