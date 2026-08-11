/* ================= Game Hub — settings registry =================
   One place to add a feature switch. A feature registers itself:

     HubSettings.register({
       id:'sound', group:'Sound', type:'toggle', default:true,
       games:['jeopardy','blockbusters','race','millionaire'],
       label:'Sound effects', help:'Short tones for right and wrong answers.'
     });

   ...then reads it with HubSettings.get('sound', game). The panel builds itself
   from whatever has been registered, so a new feature gets its switch for free —
   there is no panel markup to keep in step.

   MASTER + PER-GAME
   A setting that names `games` can be overridden for one game without disturbing
   the others: the master value is the default every game follows, and a game only
   departs from it when explicitly overridden. Settings with no `games` are global
   and have no per-game rows (relay addresses and the like — infrastructure, not
   presentation).

   Storage: `id` holds the master value, `id@game` holds an override. Values from
   before per-game existed are already master values under the same keys, so
   nothing needs migrating.

   Types: 'toggle' (boolean), 'select' (options:[{value,label}]), 'variant'
   (variants:[{value,label,games?}] — several interchangeable implementations of
   one feature, see hub-kit.js; a variant may name the games it suits) and 'text'.
   Values persist per device where storage is allowed; a browser that blocks it on
   file:// falls back to in-memory, which stays correct for the session. */
window.HubSettings = (function(){
  'use strict';

  const STORE_KEY = 'engishism.gamehub.settings';
  const defs = [];          // registration order = panel order
  const byId = Object.create(null);
  const listeners = [];
  let values = {};
  let storageOK = true;
  let context = null;       // which game's tab the panel opens on

  function load(){
    try{
      const raw = window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ storageOK=false; return {}; }
  }
  function save(){
    if(!storageOK) return;
    try{ window.localStorage.setItem(STORE_KEY, JSON.stringify(values)); }
    catch(e){ storageOK=false; }
  }

  values = load();

  const key = (id, game) => game ? id + '@' + game : id;

  /* `games:'*'` means every game there is, resolved when asked rather than when the
     setting was registered. That distinction is not academic: the settings block
     runs once, near the top of hub-engine.js, and a game registered after it was
     silently missing from every shared setting's list — no phone modes, no theme
     row, no sound row, so the fifth game's ⚙ and Lab were quietly narrower than
     every other game's and no room ever opened for it. The snapshot was the bug;
     asking the registry each time is the fix, and it cannot happen again whatever
     order a sixth game registers in. */
  function gamesOf(d){
    if(d.games === '*'){
      const all = (window.HubGames && window.HubGames.ids) ? window.HubGames.ids() : [];
      return all.slice();
    }
    return Array.isArray(d.games) ? d.games : [];
  }
  const scoped = d => gamesOf(d).length > 0;

  function register(def){
    if(byId[def.id]) return def.id;          // registering twice is a no-op
    defs.push(def);
    byId[def.id] = def;
    if(!(def.id in values)) values[def.id] = def.default;
    return def.id;
  }

  /* Override for this game if one is set, otherwise the game's own registered
     default if it has one, otherwise the master value, otherwise whatever the
     feature registered as its default.

     `defaults: {game: value}` on a definition is how a skin gets its own starting
     point — Jeopardy is team-based, so its multiple choice round starts on "all
     agree" while the master stays "first team". It ranks below a teacher's
     override and *above* the master, deliberately: a game registered with its own
     default does not follow the master, and pretending it did would make the
     master row a control that silently does nothing for that game. The panel says
     which games have their own value, so nothing is silent. */
  function get(id, game){
    const d = byId[id];
    if(!d) return undefined;
    if(game && scoped(d)){
      const o = values[key(id, game)];
      if(o !== undefined && o !== null) return o;
      if(d.defaults && d.defaults[game] != null) return d.defaults[game];
    }
    const v = values[id];
    return (v===undefined || v===null) ? d.default : v;
  }

  function set(id, v, game){
    const d = byId[id];
    if(!d) return;
    values[key(id, game && scoped(d) ? game : null)] = v;
    save();
    listeners.forEach(fn=>{ try{ fn(id, v, game || null); }catch(e){} });
  }

  function clearOverride(id, game){
    if(!game) return;
    delete values[key(id, game)];
    save();
    listeners.forEach(fn=>{ try{ fn(id, get(id, game), game); }catch(e){} });
  }

  function hasOverride(id, game){
    return !!game && values[key(id, game)] !== undefined && values[key(id, game)] !== null;
  }

  /* Variants can name the games they suit, so a hexagon animation is never offered
     for a board with no hexagons. Unnamed variants suit every game. */
  function variantsFor(id, game){
    const d = byId[id];
    if(!d || !Array.isArray(d.variants)) return [];
    if(!game) return d.variants.slice();
    return d.variants.filter(v => !Array.isArray(v.games) || v.games.indexOf(game) !== -1);
  }

  function onChange(fn){ listeners.push(fn); }
  function setContext(game){ context = game || null; }

  /* ---------- migration ----------
     A setting that gets replaced leaves values behind under keys nothing reads
     any more, and a per-game override is exactly the thing a teacher would have
     set deliberately — so it must not be lost silently. `raw()` hands the stored
     value over by its full key (`id` or `id@game`) so the feature that replaced
     it can translate; `drop()` clears the dead keys so the translation runs once.
     Neither goes through the registry, because the old id is no longer in it. */
  function raw(k){ return values[k]; }
  function drop(keys){
    let touched = false;
    keys.forEach(k => { if(k in values){ delete values[k]; touched = true; } });
    if(touched) save();
    return touched;
  }

  function resetAll(){
    Object.keys(values).forEach(k=>{ if(k.indexOf('@') !== -1) delete values[k]; });
    defs.forEach(d=>{ values[d.id] = d.default; });
    save();
    defs.forEach(d=>listeners.forEach(fn=>{ try{ fn(d.id, values[d.id], null); }catch(e){} }));
  }

  /* A ruleset picker can carry its bundles (`presets: {name: {id: value}}`), or a
     game can attach them after the fact with describePresets — J_PRESETS is
     defined further down hub-engine.js than the settings block, so the attachment
     has to be able to arrive late. The panel uses it two ways: the picker is
     hoisted into its own "Ruleset" section at the top of that game's view, and
     every row a bundle touches says what the chosen ruleset sets it to. Advisory
     only — a mode *writes* the switches, it never holds them, so the control
     beside the note is always the truth. */
  function describePresets(id, presets){ if(byId[id]) byId[id].presets = presets; }
  function presetPickerFor(game){
    return defs.find(d => d.presets && scoped(d) && gamesOf(d).indexOf(game) !== -1) || null;
  }
  function optionLabel(d, v){
    const opts = d.type==='variant' ? (d.variants||[]) : (d.options||[]);
    const o = opts.find(o => String(o.value) === String(v));
    // labels here read "Classic — as the show plays it"; the note wants the name
    return o ? String(o.label).split(' — ')[0] : String(v);
  }
  function displayValue(d, v){
    if(d.type==='toggle' || typeof v === 'boolean') return v ? 'on' : 'off';
    if(d.type==='select' || d.type==='variant') return optionLabel(d, v);
    return String(v) + (d.unit || '');
  }

  /* ---------- panel ---------- */
  let panel=null, body=null, tabsEl=null, activeTab='master';
  const collapsed = new Set();   // groups folded shut, per session — not worth persisting
  let forMount = null;           // the drawer's mount, so a change re-renders it too

  // every game any registered setting mentions, in first-registered order
  function gameTabs(){
    const seen = [];
    defs.forEach(d=>{ if(scoped(d)) gamesOf(d).forEach(g=>{ if(!seen.includes(g)) seen.push(g); }); });
    return seen;
  }
  function gameLabel(g){
    return (window.HUB_GAME_TITLES && window.HUB_GAME_TITLES[g]) ||
           g.charAt(0).toUpperCase() + g.slice(1);
  }

  function buildPanel(){
    panel = document.createElement('div');
    panel.id = 'settings-modal';
    panel.innerHTML =
      '<div id="settings-card">' +
        '<div id="settings-head"><h2>Settings</h2>' +
        '<button id="settings-close" type="button">Close</button></div>' +
        '<div id="settings-tabs"></div>' +
        '<div id="settings-body"></div>' +
        '<div id="settings-foot">' +
          '<span class="settings-note"></span>' +
          '<button id="settings-reset" type="button">Reset to defaults</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    body   = panel.querySelector('#settings-body');
    tabsEl = panel.querySelector('#settings-tabs');

    panel.querySelector('#settings-close').addEventListener('click', close);
    panel.querySelector('#settings-reset').addEventListener('click', ()=>{ resetAll(); render(); });
    panel.addEventListener('click', e=>{ if(e.target===panel) close(); });
    const note = storageOK
      ? 'Saved on this device — your choices are remembered next lesson.'
      : "This browser won't let the page save settings from a file, so these last for this session only.";
    // the build stamp makes a stale cached copy visible instead of silent
    panel.querySelector('.settings-note').textContent =
      note + (window.HUB_BUILD ? '  ·  Build ' + window.HUB_BUILD : '');
  }

  function renderTabs(){
    tabsEl.innerHTML='';
    const tabs = [['master','All games']].concat(gameTabs().map(g=>[g, gameLabel(g)]));
    tabs.forEach(([id,label])=>{
      const b=document.createElement('button');
      b.className='settings-tab' + (id===activeTab ? ' on' : '');
      b.textContent=label;
      b.addEventListener('click', ()=>{ activeTab=id; render(); });
      tabsEl.appendChild(b);
    });
  }

  /* Every control carries the id it writes to. The panel doesn't need it — it
     holds the definition in a closure — but anything looking *at* the panel does:
     a test, and the Lab drawer's own "what did I just change?" reading. Without
     it the only handle on a control is the label text, which is prose. */
  function buildControl(d, game){
    const el = makeControl(d, game);
    if(el) el.setAttribute('data-setting', d.id);
    return el;
  }

  /* One control builder for both scopes. `game` is null on the master tab. */
  function makeControl(d, game){
    const value = get(d.id, game);

    if(d.type==='text'){
      const inp=document.createElement('input');
      inp.type='text'; inp.className='settings-input';
      inp.value = value || '';
      inp.placeholder = d.placeholder || '';
      inp.addEventListener('change', ()=> set(d.id, inp.value.trim(), game));
      return inp;
    }
    if(d.type==='select' || d.type==='variant'){
      const opts = d.type==='variant' ? variantsFor(d.id, game) : (d.options||[]);
      const sel=document.createElement('select');
      sel.className='settings-select';
      opts.forEach(o=>{
        const op=document.createElement('option');
        op.value=String(o.value); op.textContent=o.label;
        if(String(value)===String(o.value)) op.selected=true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', ()=>{
        const opt=opts.find(o=>String(o.value)===sel.value);
        set(d.id, opt ? opt.value : sel.value, game);
        if(game) render();          // refresh the matching-master state
      });
      return sel;
    }
    if(d.type==='range'){
      /* A weight you tune rather than a choice you make: cooldowns, points, the
         length of a round. Prototyping needs these movable from the interface,
         not from the source. */
      const box=document.createElement('span');
      box.className='settings-range';
      const out=document.createElement('output');
      const inp=document.createElement('input');
      inp.type='range';
      inp.min = d.min === undefined ? 0 : d.min;
      inp.max = d.max === undefined ? 10 : d.max;
      inp.step = d.step || 1;
      inp.value = value;
      const show = v => out.textContent = v + (d.unit || '');
      show(value);
      inp.addEventListener('input', ()=> show(inp.value));
      inp.addEventListener('change', ()=>{
        const v = d.step && String(d.step).indexOf('.') !== -1 ? parseFloat(inp.value) : parseInt(inp.value,10);
        set(d.id, v, game); if(game) render();
      });
      box.appendChild(inp); box.appendChild(out);
      return box;
    }
    const wrap=document.createElement('label');
    wrap.className='settings-switch';
    const cb=document.createElement('input');
    cb.type='checkbox'; cb.checked=!!value;
    cb.addEventListener('change', ()=>{ set(d.id, cb.checked, game); if(game) render(); });
    const track=document.createElement('span');
    track.className='switch-track';
    wrap.appendChild(cb); wrap.appendChild(track);
    return wrap;
  }

  /* One row, wherever it is drawn — the panel's game tabs and the in-game drawer
     are the same rows on purpose, so a control can never behave differently
     depending on which door the teacher came through. `game` is null only on the
     All games tab. */
  function buildRow(d, game){
    const row=document.createElement('div');
    row.className='settings-row';

    const text=document.createElement('div');
    text.className='settings-text';
    const lab=document.createElement('div');
    lab.className='settings-label'; lab.textContent=d.label;
    text.appendChild(lab);
    if(d.help){
      const hp=document.createElement('div');
      hp.className='settings-help'; hp.textContent=d.help;
      text.appendChild(hp);
    }
    /* What the chosen ruleset does to this row — why the value is what it is, and
       what picking the mode again would write back. */
    if(game && !d.presets){
      const picker = presetPickerFor(game);
      const bundle = picker && picker.presets[String(get(picker.id, game))];
      if(bundle && (d.id in bundle)){
        const pn=document.createElement('div');
        pn.className='settings-preset-note';
        pn.textContent = optionLabel(picker, get(picker.id, game)) +
                         ' sets this to ' + displayValue(d, bundle[d.id]);
        text.appendChild(pn);
      }
    }
    // on a game's view, say plainly whether this game is following the default
    if(game){
      const ownDefault = !!(d.defaults && d.defaults[game] != null);
      const state=document.createElement('div');
      state.className='settings-state';
      if(hasOverride(d.id, game)){
        state.classList.add('overridden');
        state.textContent='Set for this game · ';
        const undo=document.createElement('button');
        undo.type='button'; undo.className='settings-undo';
        /* Undoing an override returns to whatever ranks next — for a game with a
           registered default of its own, that is its default, not the master, and
           the button must not claim otherwise. */
        undo.textContent = ownDefault ? 'back to this game’s default' : 'match All games';
        undo.addEventListener('click', ()=>{ clearOverride(d.id, game); render(); });
        state.appendChild(undo);
      } else {
        /* "Matching All games" would be a lie for a game registered with its own
           default — it is not following the master and never was. */
        state.textContent = ownDefault ? 'This game’s own default' : 'Matching All games';
      }
      text.appendChild(state);
    } else if(scoped(d)){
      /* On the master tab, changing this value silently does nothing for a game
         that already has its own — and there was no way to tell, which is
         exactly the trap that cost a real debugging session: "All games" was
         set to Off and the drone kept playing, because whichever game had been
         played with the panel open (it opens on the current game's tab) had
         quietly picked up its own value the first time a control was touched
         there. Naming the game and linking straight to its tab turns that from
         a silent mismatch into one click to fix. */
      /* A game with a registered default of its own is not following the master
         either — leaving it off this list would recreate the same silent-mismatch
         trap for exactly the games most likely to differ. */
      const overriding = gamesOf(d).filter(g => hasOverride(d.id, g) ||
                                               (d.defaults && d.defaults[g] != null));
      if(overriding.length){
        const state=document.createElement('div');
        state.className='settings-state overridden';
        /* "Has its own value", not "overridden" — a game can differ because a
           teacher set it *or* because it registered its own default, and this
           line's job is only to say the master row does not reach it. */
        state.appendChild(document.createTextNode(
          (overriding.length === 1 ? 'Has its own value in ' : overriding.length + ' games have their own value: ')));
        overriding.forEach((g, i)=>{
          if(i) state.appendChild(document.createTextNode(', '));
          const jump=document.createElement('button');
          jump.type='button'; jump.className='settings-undo';
          jump.textContent=gameLabel(g);
          jump.addEventListener('click', ()=>{ activeTab=g; render(); });
          state.appendChild(jump);
        });
        text.appendChild(state);
      }
    }
    row.appendChild(text);
    row.appendChild(buildControl(d, game));
    return row;
  }

  /* The groups, ordered by where the reader is standing. On a game's view the
     ruleset leads, then the game's own switches, then the shared machinery; on
     All games the shared groups lead. "Own" is derived, not named — a group is a
     game's own when everything in it belongs to exactly one game — so a sixth
     game's group sorts itself without appearing in any list here. Headers fold,
     because thirty-nine rows is a wall whichever order they come in. */
  const SHARED_GROUP_ORDER = ['Competition','Questions','Phones','Clue card','Presentation','Sound'];

  function renderRows(mount, game, shown){
    if(game){
      const pickers = shown.filter(d => d.presets);
      if(pickers.length){
        const h=document.createElement('div');
        h.className='settings-group settings-ruleset';
        h.textContent='Ruleset';
        mount.appendChild(h);
        pickers.forEach(d => mount.appendChild(buildRow(d, game)));
        shown = shown.filter(d => !d.presets);
      }
    }
    const groups=[];
    shown.forEach(d=>{ const g=d.group||'General'; if(!groups.includes(g)) groups.push(g); });
    const isOwn = g => shown.filter(d=>(d.group||'General')===g).every(d => gamesOf(d).length===1);
    const own = groups.filter(isOwn);
    const shared = groups.filter(g => !own.includes(g))
      .sort((a,b)=>{ const i=SHARED_GROUP_ORDER.indexOf(a), j=SHARED_GROUP_ORDER.indexOf(b);
                     return (i===-1?99:i)-(j===-1?99:j); });
    (game ? own.concat(shared) : shared.concat(own)).forEach(g=>{
      const h=document.createElement('div');
      h.className='settings-group foldable' + (collapsed.has(g)?' closed':'');
      h.textContent=g;
      const wrap=document.createElement('div');
      wrap.className='settings-groupbody' + (collapsed.has(g)?' closed':'');
      h.addEventListener('click', ()=>{
        collapsed.has(g) ? collapsed.delete(g) : collapsed.add(g);
        h.classList.toggle('closed'); wrap.classList.toggle('closed');
      });
      mount.appendChild(h);
      shown.filter(d=>(d.group||'General')===g).forEach(d=> wrap.appendChild(buildRow(d, game)));
      mount.appendChild(wrap);
    });
  }

  function renderBody(){
    body.innerHTML='';
    const game = activeTab==='master' ? null : activeTab;
    const shown = game ? defs.filter(d=>scoped(d) && gamesOf(d).indexOf(game)!==-1) : defs;

    if(game){
      const intro=document.createElement('p');
      intro.className='settings-intro';
      intro.textContent = 'These apply to ' + gameLabel(game) +
        ' only. Anything left alone follows the All games setting.';
      body.appendChild(intro);
    }
    renderRows(body, game, shown);
  }

  function render(){
    renderTabs(); renderBody();
    // the drawer shows the same rows, so a change made anywhere repaints it too
    if(forMount && forMount.mount && forMount.mount.isConnected)
      renderInto(forMount.mount, forMount.game, forMount.opts);
  }

  /* Render one game's settings into any element — used by the in-game drawer,
     which deliberately shows *only* the game being played. The full panel exists
     to see everything at once; this exists to change one thing mid-round without
     hunting through tabs for other games' switches. */
  function renderFor(mount, game, opts){
    forMount = { mount, game, opts };
    renderInto(mount, game, opts);
  }
  function renderInto(mount, game, opts){
    if(!mount) return;
    const o = opts || {};
    mount.innerHTML = '';
    const shown = defs.filter(d => scoped(d) && gamesOf(d).indexOf(game) !== -1 &&
                                   (!o.groups || o.groups.indexOf(d.group || 'General') !== -1) &&
                                   (!o.only || o.only.indexOf(d.id) !== -1));
    renderRows(mount, game, shown);
    if(!shown.length){
      const none=document.createElement('p');
      none.className='settings-intro';
      none.textContent = 'Nothing to tune for this game yet.';
      mount.appendChild(none);
    }
  }

  function open(){
    if(!panel) return;
    // land on the tab for whatever is being played, so ⚙ during a game shows that
    // game's settings without hunting for them
    const tabs = gameTabs();
    activeTab = (context && tabs.indexOf(context)!==-1) ? context : 'master';
    render();
    panel.style.display='flex';
  }
  function close(){ if(panel) panel.style.display='none'; }

  /* Adds the gear button to `container` and the panel to <body>. Called by the
     engine once its skeleton is in the DOM (the skeleton overwrites innerHTML,
     so the button can't be created before that). `onClick` lets the engine route
     the button — during play it opens the docked drawer instead of the panel, so
     there is one settings entrance whose form suits the moment. */
  function mount(container, onClick){
    if(!panel) buildPanel();
    if(container && !container.querySelector('#settings-btn')){
      const btn=document.createElement('button');
      btn.id='settings-btn'; btn.type='button';
      btn.title='Settings'; btn.setAttribute('aria-label','Settings');
      btn.textContent='⚙';
      btn.addEventListener('click', onClick || open);
      container.insertBefore(btn, container.firstChild);
    }
    document.addEventListener('keydown', e=>{
      if(e.key==='Escape' && panel && panel.style.display==='flex') close();
    });
  }

  /* A one-off render that does NOT claim `forMount` — the drawer's live re-render
     slot. The tune chip on the clue card renders through this, or opening a card
     would silently stop the drawer updating on changes. */
  function renderOnce(mount, game, opts){ renderInto(mount, game, opts); }

  /* The settings that declared themselves quick-tunable (`quick:true` on their
     registration) — what the card's tune chip shows. Derived, never a hand-kept
     list of ids, for the same reason `games:'*'` asks the registry: a list typed
     into the chip goes stale the day the next setting matters. */
  function quickIds(game){
    return defs.filter(d => d.quick && scoped(d) && gamesOf(d).indexOf(game) !== -1)
               .map(d => d.id);
  }

  return {
    renderFor, renderOnce, quickIds, register, get, set, clearOverride, hasOverride, onChange, variantsFor,
           raw, drop, mount, open, close, resetAll, setContext, describePresets,
           get storageAvailable(){ return storageOK; } };
})();
