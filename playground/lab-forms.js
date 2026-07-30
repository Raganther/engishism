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

  /* ---- word bridge ----
     A chain of compounds with one link missing: `FIRE -> ___ -> SHOP` is answered
     by `work`, because firework and workshop both exist. The links are separated
     by `->` and exactly one of them is the blank.

     It would suit every board if graduated — the answer is a single ordinary word,
     so a hexagon can key it by its initial and a Race tile can hold it, and
     Millionaire's four options are candidate links you still have to test against
     both neighbours rather than a give-away. That is why `games` is omitted.

     The reveal is the point of the form: the answer lands, and then each pair is
     named as the compound it makes, because the answer alone doesn't explain
     itself. Two compounds is what a bridge is; a chain with more blanks would be a
     different question and is declined rather than half-drawn. */
  Kit.prompt.register('bridge', {
    render(mount, item){
      const text  = String((item && item.text) || '');
      const links = text.split(/\s*->\s*/).map(s => s.trim()).filter(Boolean);
      const slots = links.filter(l => /^_{2,}$/.test(l));
      if(links.length < 3 || slots.length !== 1){ mount.textContent = text; return; }
      const row = document.createElement('span');
      row.className = 'prompt-bridge';
      links.forEach((link, i)=>{
        if(i){
          const join = document.createElement('span');
          join.className = 'prompt-join';
          join.textContent = '+';
          row.appendChild(join);
        }
        const box = document.createElement('span');
        const blank = /^_{2,}$/.test(link);
        box.className = 'prompt-link' + (blank ? ' blank' : '');
        box.textContent = blank ? '?' : link;
        row.appendChild(box);
      });
      mount.appendChild(row);
    },
    reveal(mount, item){
      const row = mount.querySelector('.prompt-bridge');
      const slot = row && row.querySelector('.prompt-link.blank');
      const answer = String((item && item.answer) || '').trim();
      if(!slot || !answer) return 0;
      if(/\s/.test(answer) || answer.length > 20) return 0;   // a link is one word
      slot.textContent = answer;
      slot.classList.remove('blank');
      slot.classList.add('filled');
      const words = [...row.querySelectorAll('.prompt-link')].map(b => b.textContent.trim());
      const made = [];
      for(let i = 1; i < words.length; i++) made.push((words[i-1] + words[i]).toLowerCase());
      const out = document.createElement('span');
      out.className = 'prompt-made';
      out.textContent = made.join(' · ');
      mount.appendChild(out);
      return 760;
    }
  });

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
