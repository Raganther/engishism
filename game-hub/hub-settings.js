/* ================= Game Hub — settings registry =================
   One place to add a feature toggle. A feature registers itself:

     HubSettings.register({
       id:'sound', group:'Sound', type:'toggle', default:true,
       label:'Sound effects', help:'Short tones for right and wrong answers.'
     });

   ...then reads it with HubSettings.get('sound'). The settings panel builds
   itself from whatever has been registered, so a new feature gets its switch
   for free — there is no panel markup to keep in step.

   Types: 'toggle' (boolean) and 'select' (options:[{value,label}]).
   Values persist per device where storage is allowed; a browser that blocks it
   on file:// just falls back to in-memory, which stays correct for the session. */
window.HubSettings = (function(){
  'use strict';

  const STORE_KEY = 'engishism.gamehub.settings';
  const defs = [];          // registration order = panel order
  const byId = Object.create(null);
  const listeners = [];
  let values = {};
  let storageOK = true;

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

  function register(def){
    if(byId[def.id]) return def.id;          // registering twice is a no-op
    defs.push(def);
    byId[def.id] = def;
    if(!(def.id in values)) values[def.id] = def.default;
    return def.id;
  }

  function get(id){
    const d = byId[id];
    if(!d) return undefined;
    const v = values[id];
    return (v===undefined || v===null) ? d.default : v;
  }

  function set(id, v){
    if(!byId[id]) return;
    values[id] = v;
    save();
    listeners.forEach(fn=>{ try{ fn(id, v); }catch(e){} });
  }

  function onChange(fn){ listeners.push(fn); }

  function resetAll(){
    defs.forEach(d=>{ values[d.id] = d.default; });
    save();
    defs.forEach(d=>listeners.forEach(fn=>{ try{ fn(d.id, values[d.id]); }catch(e){} }));
  }

  /* ---------- panel ---------- */
  let panel=null, body=null;

  function buildPanel(){
    panel = document.createElement('div');
    panel.id = 'settings-modal';
    panel.innerHTML =
      '<div id="settings-card">' +
        '<div id="settings-head"><h2>Settings</h2>' +
        '<button id="settings-close" type="button">Close</button></div>' +
        '<div id="settings-body"></div>' +
        '<div id="settings-foot">' +
          '<span class="settings-note"></span>' +
          '<button id="settings-reset" type="button">Reset to defaults</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    body = panel.querySelector('#settings-body');

    panel.querySelector('#settings-close').addEventListener('click', close);
    panel.querySelector('#settings-reset').addEventListener('click', ()=>{ resetAll(); renderBody(); });
    panel.addEventListener('click', e=>{ if(e.target===panel) close(); });
    panel.querySelector('.settings-note').textContent = storageOK
      ? 'Saved on this device — your choices are remembered next lesson.'
      : "This browser won't let the page save settings from a file, so these last for this session only.";
  }

  function renderBody(){
    body.innerHTML='';
    const groups=[];
    defs.forEach(d=>{ if(!groups.includes(d.group||'General')) groups.push(d.group||'General'); });

    groups.forEach(g=>{
      const h=document.createElement('div');
      h.className='settings-group'; h.textContent=g;
      body.appendChild(h);

      defs.filter(d=>(d.group||'General')===g).forEach(d=>{
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

        if(d.type==='select'){
          const sel=document.createElement('select');
          sel.className='settings-select';
          (d.options||[]).forEach(o=>{
            const op=document.createElement('option');
            op.value=String(o.value); op.textContent=o.label;
            if(String(get(d.id))===String(o.value)) op.selected=true;
            sel.appendChild(op);
          });
          sel.addEventListener('change', ()=>{
            const opt=(d.options||[]).find(o=>String(o.value)===sel.value);
            set(d.id, opt ? opt.value : sel.value);
          });
          row.appendChild(sel);
        } else {
          const wrap=document.createElement('label');
          wrap.className='settings-switch';
          const cb=document.createElement('input');
          cb.type='checkbox'; cb.checked=!!get(d.id);
          cb.addEventListener('change', ()=> set(d.id, cb.checked));
          const track=document.createElement('span');
          track.className='switch-track';
          wrap.appendChild(cb); wrap.appendChild(track);
          row.appendChild(wrap);
        }

        body.appendChild(row);
      });
    });
  }

  function open(){ if(!panel) return; renderBody(); panel.style.display='flex'; }
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

  return { register, get, set, onChange, mount, open, close, resetAll,
           get storageAvailable(){ return storageOK; } };
})();
