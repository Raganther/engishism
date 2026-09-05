/* ---- Jeopardy's settings, declared apart from the game ----
   The rows in Jeopardy's group, plus the Rules ruleset and its preset-applier — all pure
   `S` manipulation, so they live here where the question bench can load them without any
   of the board's logic. The behaviour these drive (the board, the wager, Together mode,
   hints, the answer clock) stays in games/jeopardy.js. The shared steal
   (stealOnWrong/stealFullValue), keepControl and phonePrompt are app-wide, in
   hub-app-settings.js. Self-registers into `window.HubSettings` on load. */
window.registerJeopardySettings = function(S){
  S.register({ id:'jRules', group:'Jeopardy', type:'variant', default:'hub', games:['jeopardy'],
    label:'Rules',
    help:'A whole way of playing, including what the phones do. Picking one writes the switches below — so they always say what will actually happen, and you can still change any of them afterwards.',
    variants:[
      {value:'hub',      label:'Hub — nothing is ever taken away'},
      {value:'classic',  label:'Classic — as the show plays it'},
      {value:'together', label:'Together — the class against the board'}
    ] });

  S.register({ id:'jTogether', group:'Jeopardy', type:'toggle', default:false, games:['jeopardy'],
    label:'The class plays as one',
    help:'Every team\'s points count toward a single class total, and the round ends against a target rather than by ranking the teams.' });

  S.register({ id:'jTarget', group:'Jeopardy', under:'jTogether', type:'range', default:60,
    min:0, max:100, step:5, unit:'%', games:['jeopardy'],
    label:'Target to beat',
    help:'How much of the board the class is aiming for. 0 turns the target off and the class simply collects what it can.' });

  S.register({ id:'jHints', group:'Jeopardy', type:'toggle', default:false, games:['jeopardy'],
    label:'Class can buy a hint',
    help:'A stuck class can buy the first letter, then the length. Each hint costs part of what the clue is worth — progress traded, not points taken.' });

  S.register({ id:'jHintCost', group:'Jeopardy', under:'jHints', type:'range', default:30,
    min:10, max:50, step:10, unit:'%', games:['jeopardy'],
    label:'What a hint costs',
    help:'Each hint takes this much off the value of the clue it is used on.' });

  S.register({ id:'jDailyDoubles', group:'Jeopardy', adv:true, type:'range', default:0,
    min:0, max:3, step:1, unit:' hidden', games:['jeopardy'],
    label:'Daily Doubles',
    help:'Tiles that hide a wager instead of a value. The team that finds one bets before seeing the clue, and answers it alone.' });

  S.register({ id:'jFinalQuestion', group:'Jeopardy', adv:true, type:'toggle', default:false, games:['jeopardy'],
    label:'Final clue',
    help:'When the board clears, every team bets what they like on one last clue. A team in last place can still win, so nobody gives up early.' });

  S.register({ id:'jDeduct', group:'Jeopardy', adv:true, type:'toggle', default:false, games:['jeopardy'],
    label:'Wrong answers cost the value',
    help:'As the show does it — and scores can go negative. Off by default: a class that goes 500 down early stops trying.' });

  S.register({ id:'jAnswerSeconds', group:'Jeopardy', adv:true, type:'range', default:0,
    min:0, max:30, step:5, unit:'s', games:['jeopardy'],
    label:'Answer clock',
    help:'Seconds to answer once a team takes the floor (buzzes in). Time up is a klaxon, not a verdict — the teacher still marks it. 0 = no clock.' });

  /* ---- the classic rules preset ----
     `jRules` sets all three switches at once, because "play it like the show" is one
     decision. Choosing a preset *writes* the switches rather than shadowing them, so the
     rows always say what will happen. */
  const J_PRESETS = {
    // the plain game: the teacher marks, the phones sit out
    hub:     { jDailyDoubles:0, jDeduct:false,
               jTogether:false, jHints:false, round_default:'off',
               stealOnWrong:true, stealFullValue:false, keepControl:true, jAnswerSeconds:0 },
    // the show is a race for the floor, so that is what the handsets are for
    classic: { jDailyDoubles:1, jDeduct:true,
               jTogether:false, jHints:false, round_default:'buzz',
               stealOnWrong:true, stealFullValue:true, keepControl:true, jAnswerSeconds:10 },
    // everything that sets one team against another is off; the class plays as one
    together:{ jDailyDoubles:0, jDeduct:false,
               jTogether:true,  jHints:true, round_default:'write',
               stealOnWrong:false, stealFullValue:false, keepControl:false, jAnswerSeconds:0 }
  };
  S.describePresets('jRules', J_PRESETS);
  let jApplyingPreset = false;
  S.onChange(id => {
    if(id !== 'jRules' || jApplyingPreset) return;
    const preset = J_PRESETS[S.get('jRules', 'jeopardy')];
    if(!preset) return;
    jApplyingPreset = true;
    Object.keys(preset).forEach(k => S.set(k, preset[k], 'jeopardy'));
    jApplyingPreset = false;
  });
};

if(window.HubSettings) window.registerJeopardySettings(window.HubSettings);
