/* ================= Experimental question forms =================
   Forms being tried out, before any game can see them.

   **This file is loaded by the prompt lab and by nothing else.** A game loads
   `game-hub/hub-kit.js` and never loads this, so a form written here cannot reach
   a board however long it sits around — which is what makes experimenting free.

   **Graduating a form is moving its block into `hub-kit.js`.** The code does not
   change, because what is written here is already the shared contract:

     Kit.prompt.register('name', {
       games:['jeopardy','race'],          // omit for "suits every board"
       render(mount, item){ … },           // build elements; bare text = declined
       reveal(mount, item){ … return ms }  // answer in place; 0 = declined
     });

   That compatibility is **checked, not intended**: the `promptlab` suite drops
   this whole file into a real hub page and asserts every form in it draws on a
   live Jeopardy clue card. So a form added here is proved portable the day it is
   written, and a form that quietly depends on something only the lab has fails
   immediately rather than at graduation.

   Add a sample for each form in SAMPLES below — that is what the check renders,
   and a form with no sample cannot be proved.
   =============================================================== */
(function(){
  'use strict';
  const Kit = window.HubKit;
  if(!Kit || !Kit.prompt) return;


  /* ---- real or fake ----
     A spelling to admit or reject, from the Learning-games 'Bouncer' prototype.
     The interesting half is the room voting admit/reject before the reveal, which
     is exactly the kind of thing this lane exists to try. */
  Kit.prompt.register('realfake', {
    render(mount, item){
      const text = String((item && item.text) || '');
      const word = text.replace(/^.*?:\s*/, '').trim();
      if(!word || /\s/.test(word)){ mount.textContent = text; return; }
      const lead = document.createElement('span');
      lead.className = 'prompt-lead';
      lead.textContent = 'Real word, or not?';
      const chip = document.createElement('span');
      chip.className = 'prompt-link';
      chip.textContent = word;
      mount.appendChild(lead); mount.appendChild(chip);
    },
    reveal(mount, item){
      const chip = mount.querySelector('.prompt-link');
      const answer = String((item && item.answer) || '').trim();
      if(!chip || !answer) return 0;
      const real = /^(real|yes|true)$/i.test(answer);
      chip.classList.add(real ? 'filled' : 'blank');
      const out = document.createElement('span');
      out.className = 'prompt-made';
      out.textContent = real ? 'a real spelling' : 'not a word — reject it';
      mount.appendChild(out);
      return 560;
    }
  });

  /* One or more samples per form, in the shape every bank uses. The lab lists
     these, and the compatibility check renders them on a real clue card. */
  window.LabForms = {
    samples: {
      bridge: [
        { type:'bridge', text:'FIRE -> ___ -> SHOP', answer:'work' },
        { type:'bridge', text:'NEWS -> ___ -> WORM', answer:'paper' },
        { type:'bridge', text:'SUN -> ___ -> LIGHT', answer:'day' }
      ],
      realfake: [
        { type:'realfake', text:'Admit or reject: receive', answer:'real' },
        { type:'realfake', text:'Admit or reject: recieve', answer:'fake' }
      ]
    }
  };
})();
