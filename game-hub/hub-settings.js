/* ================= Game Hub — settings registry =================
   One place to add a feature switch. A feature registers itself:

     HubSettings.register({
       id:'sound', group:'Sound', type:'toggle', default:false,
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

  /* ---------- team rooms vs rooms of individuals ----------
     A setting that declares `byRoster:true` keeps a second value for rooms of
     individuals, because team rules and whole-class rules are two different
     lessons being developed separately. The room type scopes the key the way
     the game already does: a change made while a solo room is up writes `…!solo`
     and touches nothing a team room reads, and a solo room **follows the
     team-room value until explicitly set apart** — the same
     follows-until-overridden shape as game-vs-master, so nothing needed
     migrating and a setting adopts the fork by declaring one word. The roster
     is read raw rather than through get() because the `roster` def registers
     later than this file loads, and raw is correct at every moment. */
  const SOLO_SUF = '!solo';
  const soloNow = () => values['roster'] === 'solo';
  const forked  = d => !!(d && d.byRoster);

  /* ---------- which round is open ----------
     Not a scope. **No setting forks by round**: two axes is what a teacher can
     hold in their head, a third read as complicated the moment it was in front of
     one, and "every round inherits the game's value" is the rule. Settings are
     scoped by game and by room type, full stop.

     What survives is the *fact*, because something genuinely asks for it: the room
     bench opens its rules band on the question that is up, and the board is the
     only thing that knows a card is open. Announced at the two seams where the
     engine's own `roundId` moves, so this is a report rather than a second copy.
     Keep it read-only from outside; if a scope is ever wanted again the history
     holds one that worked. */
  let openRound = null;
  function setRound(id){ openRound = id || null; }
  function roundNow(){ return openRound; }

  const liveKey = (d, id, game) =>
    (forked(d) && soloNow()) ? key(id, game) + SOLO_SUF : key(id, game);

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

  /* One editable value per setting. **There is no teacher-set per-game override any
     more** — the whole app is tuned from one place (the question bench), so a shared
     setting has a single value and cannot disagree with itself across surfaces.

     Two scopes survive, because they are rules rather than knobs:
     - the **room-type fork** (`byRoster` → `id!solo`): team rooms and rooms of
       individuals are two different lessons, so a forked setting keeps a second
       value for solo rooms and follows the team-room value until set apart.
     - a **registered per-game default** (`defaults: {game: value}`): how a skin
       starts — Jeopardy's multiple-choice round begins on "all agree", `roundPay`
       is Podium for Jeopardy. It is baked into the game (read here, not editable),
       ranks *above* the master, and is what keeps a game's own rules unchanged
       while the master is the one value everything else shares. The panel names the
       games that carry their own default, so a master row that one shadows is never
       silently inert. */
  function get(id, game){
    const d = byId[id];
    if(!d) return undefined;
    /* A solo room's own choice outranks everything; with none made, the solo
       room inherits whatever the team-room chain below resolves to. */
    if(forked(d) && soloNow()){
      const sm = values[id + SOLO_SUF];
      if(sm !== undefined && sm !== null) return sm;
    }
    if(game && scoped(d) && d.defaults && d.defaults[game] != null)
      return d.defaults[game];
    const v = values[id];
    return (v===undefined || v===null) ? d.default : v;
  }

  /* A write always lands on the one shared value (its solo fork in a room of
     individuals). The `game` argument is ignored — kept in the signature so the
     ~80 `set(id, v, game)` call sites and the ruleset applier compile unchanged;
     a per-game key is never written again. */
  function set(id, v, game){
    const d = byId[id];
    if(!d) return;
    values[liveKey(d, id, null)] = v;
    save();
    listeners.forEach(fn=>{ try{ fn(id, v, null); }catch(e){} });
  }

  /* Clearing and asking "was this set" now mean the one live scope — the master, or
     its solo fork in a room of individuals. `clearOverride` is kept for the reset
     paths and the tests; `hasOverride`'s only live consumer is `roundModeOf`, which
     asks it solely inside a solo room (to leave a deliberate solo choice alone). The
     `game` argument is ignored in both. */
  function clearOverride(id, game){
    delete values[liveKey(byId[id], id, null)];
    save();
    listeners.forEach(fn=>{ try{ fn(id, get(id, null), null); }catch(e){} });
  }

  function hasOverride(id, game){
    /* In a team room this is the master key, seeded at register() and so always
       present — meaningless there, and `roundModeOf` never calls it there. In a solo
       room `liveKey` resolves to `id!solo`, which is *not* seeded, so this is true
       only when the teacher set a solo value. That is the fact the downgrade wants. */
    const v = values[liveKey(byId[id], id, null)];
    return v !== undefined && v !== null;
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
  // vestigial: the flat panel has no per-game tab to land on. Kept as a no-op so the
  // two hub-engine callers (⚙ open/close) compile without change.
  function setContext(){}

  /* ---------- migration ----------
     A setting that gets replaced leaves values behind under keys nothing reads
     any more, and a per-game override is exactly the thing a teacher would have
     set deliberately — so it must not be lost silently. `raw()` hands the stored
     value over by its full key (`id` or `id@game`) so the feature that replaced
     it can translate; `drop()` clears the dead keys so the translation runs once.
     Neither goes through the registry, because the old id is no longer in it. */
  function raw(k){ return values[k]; }
  /* Every stored key, for a migration that has to find keys by *shape* rather than
     by name — a retired scope leaves one per game per round, and listing those by
     hand would be the list this project keeps paying for. Read-only: `drop` is how
     they go. */
  function keys(){ return Object.keys(values); }
  function drop(keys){
    let touched = false;
    keys.forEach(k => { if(k in values){ delete values[k]; touched = true; } });
    if(touched) save();
    return touched;
  }

  function resetAll(){
    Object.keys(values).forEach(k=>{
      if(k.indexOf('@') !== -1 || k.indexOf(SOLO_SUF) !== -1) delete values[k];
    });
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
    // game null → the flat panel: return the app's ruleset picker whatever it scopes to
    if(game == null) return defs.find(d => d.presets) || null;
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

  /* ---------- panel ----------
     One flat panel, no per-game tabs: every setting is edited once, from the
     question bench (the app's single settings surface) or this on-demand panel
     (the tests and `open()` reach it). The game hub board and the room bench carry
     no settings UI. */
  let panel=null, body=null;
  const collapsed = new Set();   // groups folded shut, per session — not worth persisting
  const advOpen   = new Set();   // which groups have their Advanced fold open, per session

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
        '<div id="settings-body"></div>' +
        '<div id="settings-foot">' +
          '<span class="settings-note"></span>' +
          '<button id="settings-reset" type="button">Reset to defaults</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    body   = panel.querySelector('#settings-body');

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
       what picking the mode again would write back. One flat panel, so the picker
       is found game-agnostically (there is a single ruleset picker in the app). */
    if(!d.presets){
      const picker = presetPickerFor(null);
      const bundle = picker && picker.presets[String(get(picker.id, null))];
      if(bundle && (d.id in bundle)){
        const pn=document.createElement('div');
        pn.className='settings-preset-note';
        pn.textContent = optionLabel(picker, get(picker.id, null)) +
                         ' sets this to ' + displayValue(d, bundle[d.id]);
        text.appendChild(pn);
      }
    }
    /* The one flat panel edits a single value per setting. The only state a row
       still owns to declare is the master row that a baked per-game default
       shadows — naming those games so a control that does not reach them is never
       silently inert. A room of individuals is a whole-panel fact (the roster), not
       a per-row one, so a forked setting's solo value is edited here like any
       other and needs no per-row wording. */
    const shadowed = scoped(d)
      ? gamesOf(d).filter(g => d.defaults && d.defaults[g] != null)
      : [];
    if(shadowed.length){
      const state=document.createElement('div');
      state.className='settings-state overridden';
      state.textContent =
        (shadowed.length === 1 ? 'Has its own fixed value in ' : shadowed.length + ' games have their own fixed value: ') +
        shadowed.map(gameLabel).join(', ');
      text.appendChild(state);
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
  /* Within a group the shape is derived from the defs, never listed:
     - a row that declares `under:'parentId'` is a child — drawn indented right after
       its parent and greyed (`settings-inert`) while the parent is off, zero, or set
       to something other than its `when` value. A slider whose effect a teacher cannot
       see is exactly what made the panel read as noise.
     - a row that declares `adv:true` sinks below a foldable "Advanced" divider, so the
       everyday settings lead and the fine-tuning is one click away, not a wall.
     A new setting joins the shape by declaring one of those words. */
  function parentLive(child, game){
    const pv = get(child.under, game);
    if(child.when != null) return String(pv) === String(child.when);
    return pv !== false && pv !== 'off' && pv !== 0 && pv !== '' && pv != null;
  }
  function emitRows(box, list, all, game){
    list.forEach(d=>{
      box.appendChild(buildRow(d, game));
      all.filter(c => c.under === d.id).forEach(c=>{
        const row = buildRow(c, game);
        row.classList.add('settings-child');
        if(!parentLive(c, game)) row.classList.add('settings-inert');
        box.appendChild(row);
      });
    });
  }
  function emitGroup(wrap, rows, gName, game){
    const ids = new Set(rows.map(d => d.id));
    // an orphan child (its parent scoped out of this view) falls back to a top-level row
    const topLevel = rows.filter(d => !d.under || !ids.has(d.under));
    emitRows(wrap, topLevel.filter(d => !d.adv), rows, game);
    const adv = topLevel.filter(d => d.adv);
    if(!adv.length) return;
    const open = advOpen.has(gName);
    const h = document.createElement('div');
    h.className = 'settings-advanced foldable' + (open ? '' : ' closed');
    h.textContent = 'Advanced';
    const box = document.createElement('div');
    box.className = 'settings-groupbody' + (open ? '' : ' closed');
    h.addEventListener('click', ()=>{
      advOpen.has(gName) ? advOpen.delete(gName) : advOpen.add(gName);
      h.classList.toggle('closed'); box.classList.toggle('closed');
    });
    wrap.appendChild(h);
    emitRows(box, adv, rows, game);
    wrap.appendChild(box);
  }

  const SHARED_GROUP_ORDER = ['Competition','Questions','Phones','Clue card','Presentation','Sound'];

  function renderRows(mount, game, shown){
    // the ruleset picker leads its own section, above every group
    const pickers = shown.filter(d => d.presets);
    if(pickers.length){
      const h=document.createElement('div');
      h.className='settings-group settings-ruleset';
      h.textContent='Ruleset';
      mount.appendChild(h);
      pickers.forEach(d => mount.appendChild(buildRow(d, game)));
      shown = shown.filter(d => !d.presets);
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
      emitGroup(wrap, shown.filter(d=>(d.group||'General')===g), g, game);
      mount.appendChild(wrap);
    });
  }

  function renderBody(){
    body.innerHTML='';
    // one flat view — every setting, the globals included, edited once
    renderRows(body, null, defs);
  }

  function render(){
    /* The panel is built lazily — a board that never opened it has no `panel` or
       `body`. But the control builders are shared with `renderOnce` (the question
       bench embeds them), and a select change, range change or reset each call
       render() after writing — which threw on every interaction from the bench,
       after the value had already landed, so the write worked and the page error
       was the only symptom. An embedder repaints itself through `onChange`; the
       panel repaints only if it exists. */
    if(!panel || !body) return;
    renderBody();
  }

  function renderInto(mount, game, opts){
    if(!mount) return;
    const o = opts || {};
    mount.innerHTML = '';
    /* One flat view. `game` is accepted for signature compatibility (callers pass
       null) but no longer slices the panel — every setting, the globals included,
       is shown and edited once. `groups`/`only` still filter, for an embedder that
       wants a subset. */
    const shown = defs.filter(d =>
      (!o.groups || o.groups.indexOf(d.group || 'General') !== -1) &&
      (!o.only || o.only.indexOf(d.id) !== -1));
    renderRows(mount, null, shown);
    if(!shown.length){
      const none=document.createElement('p');
      none.className='settings-intro';
      none.textContent = 'Nothing to tune yet.';
      mount.appendChild(none);
    }
  }

  function open(){
    /* The board no longer mounts a gear, so the panel is not built at load. It is
       still available on demand — the tests reach it this way — so build it the
       first time it is opened. One flat view, no tab to land on. */
    if(!panel) buildPanel();
    if(!panel) return;
    render();
    panel.style.display='flex';
  }
  function close(){ if(panel) panel.style.display='none'; }

  /* Render every setting into any element the caller owns (the question bench's
     Tune pane). `game` is accepted but ignored — one flat view. Distinct from the
     panel because it writes into a host the caller owns, not <body>. */
  function renderOnce(mount, game, opts){ renderInto(mount, game, opts); }

  /* The settings that declared themselves quick-tunable (`quick:true`). Derived,
     never a hand-kept list of ids, for the same reason `games:'*'` asks the
     registry: a list typed out goes stale the day the next setting matters. A game
     may be named to narrow to that game's quick settings; null gives them all. */
  function quickIds(game){
    return defs.filter(d => d.quick && (game == null || (scoped(d) && gamesOf(d).indexOf(game) !== -1)))
               .map(d => d.id);
  }

  return {
    renderOnce, quickIds, register, get, set, clearOverride, hasOverride, onChange, variantsFor,
           raw, keys, drop, open, close, resetAll, setContext, setRound, roundNow, describePresets,
           get storageAvailable(){ return storageOK; } };
})();
