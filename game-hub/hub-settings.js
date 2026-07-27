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
  const scoped = d => Array.isArray(d.games) && d.games.length > 0;

  function register(def){
    if(byId[def.id]) return def.id;          // registering twice is a no-op
    defs.push(def);
    byId[def.id] = def;
    if(!(def.id in values)) values[def.id] = def.default;
    return def.id;
  }

  /* Override for this game if one is set, otherwise the master value, otherwise
     whatever the feature registered as its default. */
  function get(id, game){
    const d = byId[id];
    if(!d) return undefined;
    if(game && scoped(d)){
      const o = values[key(id, game)];
      if(o !== undefined && o !== null) return o;
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

  /* ---------- panel ---------- */
  let panel=null, body=null, tabsEl=null, activeTab='master';

  // every game any registered setting mentions, in first-registered order
  function gameTabs(){
    const seen = [];
    defs.forEach(d=>{ if(scoped(d)) d.games.forEach(g=>{ if(!seen.includes(g)) seen.push(g); }); });
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

  function renderBody(){
    body.innerHTML='';
    const game = activeTab==='master' ? null : activeTab;
    const shown = game ? defs.filter(d=>scoped(d) && d.games.indexOf(game)!==-1) : defs;

    if(game){
      const intro=document.createElement('p');
      intro.className='settings-intro';
      intro.textContent = 'These apply to ' + gameLabel(game) +
        ' only. Anything left alone follows the All games setting.';
      body.appendChild(intro);
    }

    const groups=[];
    shown.forEach(d=>{ if(!groups.includes(d.group||'General')) groups.push(d.group||'General'); });

    groups.forEach(g=>{
      const h=document.createElement('div');
      h.className='settings-group'; h.textContent=g;
      body.appendChild(h);

      shown.filter(d=>(d.group||'General')===g).forEach(d=>{
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
        // on a game tab, say plainly whether this game is following the default
        if(game){
          const state=document.createElement('div');
          state.className='settings-state';
          if(hasOverride(d.id, game)){
            state.classList.add('overridden');
            state.textContent='Set for this game · ';
            const undo=document.createElement('button');
            undo.type='button'; undo.className='settings-undo';
            undo.textContent='match All games';
            undo.addEventListener('click', ()=>{ clearOverride(d.id, game); render(); });
            state.appendChild(undo);
          } else {
            state.textContent='Matching All games';
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
          const overriding = d.games.filter(g => hasOverride(d.id, g));
          if(overriding.length){
            const state=document.createElement('div');
            state.className='settings-state overridden';
            state.appendChild(document.createTextNode(
              (overriding.length === 1 ? 'Overridden in ' : overriding.length + ' games have their own value: ')));
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
        body.appendChild(row);
      });
    });
  }

  function render(){ renderTabs(); renderBody(); }

  /* Render one game's settings into any element — used by the in-game Lab drawer,
     which deliberately shows *only* the game being played. The ⚙ panel exists to
     see everything at once; this exists to change one thing mid-round without
     hunting through tabs for other games' switches. */
  function renderFor(mount, game, opts){
    if(!mount) return;
    const o = opts || {};
    mount.innerHTML = '';
    const shown = defs.filter(d => scoped(d) && d.games.indexOf(game) !== -1 &&
                                   (!o.groups || o.groups.indexOf(d.group || 'General') !== -1));
    const groups = [];
    shown.forEach(d => { const g = d.group || 'General'; if(!groups.includes(g)) groups.push(g); });
    groups.forEach(g=>{
      const h=document.createElement('div');
      h.className='settings-group'; h.textContent=g;
      mount.appendChild(h);
      shown.filter(d => (d.group||'General') === g).forEach(d=>{
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
        row.appendChild(text);
        row.appendChild(buildControl(d, game));
        mount.appendChild(row);
      });
    });
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
     so the button can't be created before that). */
  function mount(container){
    if(!panel) buildPanel();
    if(container && !container.querySelector('#settings-btn')){
      const btn=document.createElement('button');
      btn.id='settings-btn'; btn.type='button';
      btn.title='Settings'; btn.setAttribute('aria-label','Settings');
      btn.textContent='⚙';
      btn.addEventListener('click', open);
      container.insertBefore(btn, container.firstChild);
    }
    document.addEventListener('keydown', e=>{
      if(e.key==='Escape' && panel && panel.style.display==='flex') close();
    });
  }

  return {
    renderFor, register, get, set, clearOverride, hasOverride, onChange, variantsFor,
           raw, drop, mount, open, close, resetAll, setContext,
           get storageAvailable(){ return storageOK; } };
})();
