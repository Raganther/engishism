/* ================= hub-brand.js — the app's name and mark =================
   **The app is Huddle; the school's identity is a skin it can wear.** One registry
   of brands, each a name and a way of drawing its mark into an element, read by
   every surface that shows one: the hub header, the phone's entry screen and its
   between-rounds standby, and the front door. Which brand is on is the `brand`
   setting (Presentation); the board hands it to the phones in the join URL
   (`?brand=`), because a phone shows its mark before it has joined any room and
   the URL is the one thing it has at that moment.

   **This file is the one home of the tile palette.** The seven hues the physics
   deals tiles in (`Kit.table.hues`) are the brand's colours — the mark is six of
   them spelling the name — so they live here, with no dependency on the physics
   shelf: the front door draws the mark without loading Matter. `hub-table.js`
   reads them from here and keeps a literal only as a fallback for a page loaded
   without this file.

   No dependencies. Injects its own style once, because the mark is drawn on pages
   that share no stylesheet (join.html carries its own CSS). */
(function(){
  'use strict';
  const HUES = ['#00A0DF','#F5C542','#E2603B','#6FB04A','#B36FD1','#3BB0A8','#E86FA0'];
  const INK  = '#101318';   // the tiles' fixed dark ink — readable on every hue

  const CSS = `
.brand-tiles{ display:inline-flex; gap:.16em; align-items:center; vertical-align:middle;
  font-family:'Space Grotesk', system-ui, sans-serif; font-weight:800; letter-spacing:.02em; }
.brand-tile{ display:inline-flex; align-items:center; justify-content:center; width:1.35em; height:1.35em;
  border-radius:.24em; border:.07em solid rgba(0,0,0,.22); color:${INK}; line-height:1;
  box-shadow:0 .08em .18em rgba(0,0,0,.28); }
/* A lean each way, the way dealt tiles settle — never dead straight. */
.brand-tile:nth-child(odd){ transform:rotate(-3deg); }
.brand-tile:nth-child(even){ transform:rotate(2.5deg); }
.brand-lockup{ display:inline-flex; gap:.5em; align-items:center; vertical-align:middle; }
.brand-inline b{ font-weight:700; letter-spacing:.03em; }
.bm-relay{ font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:.5em; letter-spacing:.18em;
  text-transform:uppercase; color:#12263F; background:#FFC20E; padding:.15em .6em; border-radius:999px; }
`;
  function ensureStyle(){
    if(document.getElementById('hub-brand-style')) return;
    const st = document.createElement('style');
    st.id = 'hub-brand-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  const BRANDS = {
    huddle: {
      label: 'Huddle',
      name:  'Huddle',
      mark(el, o){
        const wrap = document.createElement('span');
        wrap.className = 'brand-tiles';
        'HUDDLE'.split('').forEach((ch, i) => {
          const t = document.createElement('span');
          t.className = 'brand-tile';
          t.style.background = HUES[i % HUES.length];
          t.textContent = ch;
          wrap.appendChild(t);
        });
        el.appendChild(wrap);
        if(o.relay) el.appendChild(relayPill());
      }
    },
    dcu: {
      label: 'DCU International Academy',
      name:  'DCU International Academy',
      /* `lockup` is the stacked wordmark the phone wears (DCU beside a two-line
         "International Academy"); without it the inline one the hub header wears. */
      mark(el, o){
        if(o.lockup){
          const wrap = document.createElement('span');
          wrap.className = 'brand-lockup';
          const a = document.createElement('span'); a.className = 'bm-dcu'; a.textContent = 'DCU';
          const b = document.createElement('span'); b.className = 'bm-ia'; b.innerHTML = 'International<br>Academy';
          wrap.appendChild(a); wrap.appendChild(b);
          el.appendChild(wrap);
        } else {
          const wrap = document.createElement('span');
          wrap.className = 'brand-inline';
          const b = document.createElement('b'); b.textContent = 'DCU';
          wrap.appendChild(b);
          wrap.appendChild(document.createTextNode(' International Academy'));
          el.appendChild(wrap);
        }
        if(o.relay) el.appendChild(relayPill());
      }
    }
  };
  function relayPill(){
    const p = document.createElement('span');
    p.className = 'bm-relay'; p.textContent = 'Relay';
    return p;
  }

  function ids(){ return Object.keys(BRANDS); }
  function get(id){ return BRANDS[id] || BRANDS.huddle; }
  /* Draw a brand's mark into `el`, replacing what was there. `opts`: `lockup`
     (the stacked form), `relay` (the phone's pill after the mark). */
  function mark(el, id, opts){
    if(!el) return null;
    ensureStyle();
    const b = get(id);
    el.innerHTML = '';
    el.dataset.brand = BRANDS[id] ? id : 'huddle';
    el.setAttribute('aria-label', b.name);
    b.mark(el, opts || {});
    return el;
  }

  window.HubBrand = { hues: HUES.slice(), ink: INK, ids, get, mark };
})();
