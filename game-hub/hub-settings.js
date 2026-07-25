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
   (variants:[{value,label}] — several interchangeable implementations of one
   feature, see hub-kit.js) and 'text'.
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

  function onChange(fn){ listeners.push(fn); }
  function setContext(game){ context = game || null; }

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

  /* One control builder for both scopes. `game` is null on the master tab. */
  function buildControl(d, game){
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
      const opts = d.type==='variant' ? (d.variants||[]) : (d.options||[]);
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
        }
        row.appendChild(text);
        row.appendChild(buildControl(d, game));
        body.appendChild(row);
      });
    });
  }

  function render(){ renderTabs(); renderBody(); }

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

  return { register, get, set, clearOverride, hasOverride, onChange,
           mount, open, close, resetAll, setContext,
           get storageAvailable(){ return storageOK; } };
})();
