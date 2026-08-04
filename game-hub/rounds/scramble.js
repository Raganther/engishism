/* ================= The word order round =================
   A sentence with its words shuffled, and a slot for each. The room drags the
   words into order.

   **The second round grown out of a question form, and the first that cost almost
   nothing** — which is the point of having built the anagram one first. `arrange`
   already existed as a phone mode, the relay already carried it, and the handset
   already reported the order things were placed in. What is here is a round file
   and a layout that suits words rather than letters. Budget the next one against
   this, not against the anagram.

   As with the anagram, the **form it grew out of is untouched**: `Kit.prompt`'s
   `scramble` still draws the words and re-sorts them on reveal, for a board with no
   phones, and the five items already authored keep behaving exactly as they did.
   The two are keyed by different fields:

     { text:'Word order:', type:'scramble', answer:'The witness has retracted it' }  form
     { text:'Word order:', scramble:{ sentence:'The witness has retracted it' } }    round

   **Repeated words are the same problem repeated letters were**, and are solved the
   same way: `the` appears twice in most C1 sentences, every pick in this app is
   keyed by its text, so the card gives each chip a token (`the#4`, drawn as `the`)
   and the handset keys by slot. `judge` strips the token so both arrive in one
   shape. Author a sentence with a repeated word before believing any change here. */
(function(){
  'use strict';
  const K = window.HubKit;
  if(!K || !K.round){ console.error('scramble.js needs hub-rounds.js loaded first'); return; }

  const colourOf = i => (window.HubBuzzer && window.HubBuzzer.teamColour)
                        ? window.HubBuzzer.teamColour(i) : '';
  const bare = x => String(x == null ? '' : x).replace(/#\d+$/, '');
  const norm = x => bare(x).trim().toLowerCase();
  const MIN = 3;
  /* The relay caps `multi` at 12, so a longer sentence could not be armed — and
     twelve chips is already past what a handset lays out without becoming fiddly. */
  const MAX = 12;

  const wordsOf = str => String(str || '').trim().split(/\s+/).filter(Boolean);

  K.round.register('scramble', {
    label: 'Drag the Words',
    blurb: 'A shuffled sentence, and a slot for each word.',

    modes: [
      { value:'first', label:'First team to order it takes it' },
      { value:'agree', label:'A team answers only when all of them order it the same' }
    ],

    /* Declared, not only described above, so `tools/question-types.js` can print it. */
    sample: { text:"Put the words in order.",
              scramble:{ sentence:"The jury reached the verdict after four hours" } },
    field: 'scramble',

    claims(item){ return !!(item && item.scramble && item.scramble.sentence); },

    setup(item, ctx){
      const sc = item && item.scramble;
      if(!sc) return null;
      const sentence = String(sc.sentence || '').trim();
      const words = wordsOf(sentence);
      if(words.length < MIN || words.length > MAX) return null;
      const chips = words.map((w, i) => ({ w, id: w + '#' + i }));
      /* Re-shuffled until it is not the sentence itself. On a short sentence the
         shuffle lands on the answer often enough to be worth the loop, and a
         "scramble" that is already in order is not a puzzle. */
      let pool = shuffle(chips.slice());
      for(let n = 0; n < 12 && pool.map(c => c.w).join(' ') === sentence; n++)
        pool = shuffle(chips.slice());
      return {
        text:  String((item && item.text) || 'Put the words in order.'),
        sentence,
        words,
        answer: sentence,
        pool,
        need:  words.length,
        mode:  (ctx && ctx.mode === 'agree') ? 'agree' : 'first',
        chosen: [],
        picks: {}, leading: {}, votes: {}, by: {},
        say: '', shown: false, done: false
      };
    },

    /* ---------- the projector's view ----------
       The slots read as a sentence forming, left to right, and they are allowed to
       grow as words land — which is the opposite of the ordering ladder's rule that
       every rung is the same box. The reason is what the thing *is*: a ladder is a
       column several teams are compared down, so a rung that resizes makes the
       lanes stop lining up; a sentence is one line being built, and a slot sized to
       the word it will hold would give away the answer's shape before anybody
       placed anything. */
    render(mount, s, ctx){
      const c = ctx || {};
      mount.innerHTML = '';
      mount.className = 'round-scramble' + (s.mode === 'agree' ? ' agreeing' : '');

      const held = s.chosen.slice();

      const line = document.createElement('div');
      line.className = 'scr-line';
      for(let i = 0; i < s.need; i++){
        const b = document.createElement('div');
        b.className = 'scr-slot';
        const tok = held[i];
        if(tok){
          b.classList.add('filled');
          b.textContent = bare(tok);
          if(c.onPick && !s.shown) b.addEventListener('click', ()=> c.onPick(tok));
        }else{
          // a number, not an empty box: on a line of ten it is the only way to see
          // which slot is which without counting from the left every time
          b.textContent = String(i + 1);
          b.classList.add('empty');
        }
        if(s.shown){ b.className = 'scr-slot filled right'; b.textContent = s.words[i]; }
        line.appendChild(b);
      }

      const tray = document.createElement('div');
      tray.className = 'scr-tray';
      s.pool.forEach(t=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gword scr-chip';
        b.dataset.word = t.id;
        b.textContent = t.w;
        if(held.indexOf(t.id) !== -1 || s.shown) b.classList.add('spent');
        if(c.onPick && !s.shown && held.indexOf(t.id) === -1)
          b.addEventListener('click', ()=> c.onPick(t.id));
        tray.appendChild(b);
      });

      mount.appendChild(tray);
      mount.appendChild(line);

      /* What each team has built. A sentence is too long to redraw per team on a
         clue card, so this is a count rather than the words — the teacher can read
         one team's actual attempt off their handsets, and what the room needs from
         the projector is who is close. */
      const lanes = Object.keys(s.leading).map(Number)
        .filter(t => (s.leading[t] || []).length);
      if(lanes.length && !s.shown){
        const wrap = document.createElement('div');
        wrap.className = 'scr-teams';
        lanes.sort((a,b)=>a-b).forEach(t=>{
          const chip = document.createElement('span');
          chip.className = 'scr-who';
          chip.style.borderColor = colourOf(t);
          chip.textContent = (c.teamName ? c.teamName(t) : ('Team ' + (t + 1))) + ' ';
          const n = document.createElement('small');
          const ag = s.mode === 'agree' ? K.round.agreement(s, c, t) : null;
          n.textContent = (s.leading[t] || []).length + '/' + s.need +
                          (ag ? ' · ' + ag.agreed + '/' + ag.size + ' agree' : '');
          if(ag && ag.all) chip.classList.add('all');
          chip.appendChild(n);
          wrap.appendChild(chip);
        });
        mount.appendChild(wrap);
      }

      if(s.say){
        const say = document.createElement('div');
        say.className = 'group-say' + (s.done ? ' good' : '');
        say.textContent = s.say;
        mount.appendChild(say);
      }
    },

    reveal(mount, s, ctx){
      s.done = true; s.shown = true; s.chosen = [];
      s.picks = {}; s.leading = {}; s.votes = {};
      this.render(mount, s, ctx);
      return 0;
    },

    /* ---------- the handsets ----------
       The same `arrange` mode the anagram uses, unchanged — it takes a list of
       strings and reports the order they were placed in, and a word is only a
       longer string than a letter. That it needed nothing new is the whole return
       on having built the anagram round first. */
    arm(s, ctx){
      const c = ctx || {};
      return {
        mode:    'arrange',
        prompt:  c.prompt === false ? 'Put the words in order' : (s.text || 'Put the words in order'),
        options: s.pool.map(t => t.w),
        multi:   s.need,
        holds:   true,
        rethink: true,
        team:    (c.team === 0 || Number(c.team) > 0) ? Number(c.team) : null
      };
    },

    read(replies, s, ctx){
      const sizes = (ctx && ctx.sizes) || [];
      const tally = {}, said = {}, by = {}, best = {};
      (replies || []).forEach(r=>{
        const t = Number(r && r.team) || 0;
        const seq = String((r && r.value) == null ? '' : r.value)
                      .split('|').map(x => bare(x)).filter(Boolean);
        // words this sentence does not have: a stale reply from a previous clue
        if(!fits(seq, s.words)) return;
        said[t] = (said[t] || 0) + 1;
        by[t] = r.name;
        if(!best[t] || seq.length > best[t].length) best[t] = seq;
        if(seq.length !== s.need) return;
        const box = tally[t] || (tally[t] = {});
        const key = seq.join(' ');
        box[key] = (box[key] || 0) + 1;
      });
      const picks = {}, leading = {}, votes = {};
      Object.keys(best).forEach(t => { leading[t] = best[t]; });
      Object.keys(tally).forEach(t=>{
        const box  = tally[t];
        const lead = Object.keys(box).sort((a,b)=> box[b] - box[a])[0];
        if(lead == null) return;
        const agreed = box[lead];
        votes[t] = { for:box, said:said[t] || 0, agreed };
        const size = Number(sizes[t]) || 0;
        if(s.mode !== 'agree' || !size || agreed >= size) picks[t] = lead.split(' ');
      });
      s.leading = leading; s.votes = votes; s.by = by;
      return picks;
    },

    judge(answer, s){
      const seq = (answer || []).map(bare);
      if(seq.length !== s.need) return { verdict:'incomplete', hits:0 };
      /* Compared case-insensitively, because a sentence's first word is capitalised
         and a student who put it third has still put it third — marking that wrong
         on a capital letter would be marking the wrong thing. */
      const right = seq.map(w => w.toLowerCase()).join(' ') === s.sentence.toLowerCase();
      const hits = seq.reduce((n, w, i) => n + (norm(w) === norm(s.words[i]) ? 1 : 0), 0);
      return { verdict: right ? 'right' : 'wrong', hits };
    },

    saidOf(who, r, s){
      if(!r || r.verdict === 'incomplete') return who + ': not finished yet.';
      return who + ': not it — ' + (r.hits || 0) + ' of ' + s.need + ' words are in the right place.';
    },

    check(item){
      const sc = (item && item.scramble) || {};
      const raw = String(sc.sentence || '').trim();
      const bad = [];
      if(!raw) return ['Needs a sentence to shuffle.'];
      const words = wordsOf(raw);
      if(words.length < MIN)
        bad.push('“' + raw + '” is ' + words.length + ' word' + (words.length === 1 ? '' : 's') +
                 ' — ' + MIN + ' is the least that has an order to get wrong.');
      if(words.length > MAX)
        bad.push('“' + raw + '” is ' + words.length + ' words; ' + MAX +
                 ' is the most a handset can arrange.');
      /* The one a reader misses, exactly as the anagram's giveaway clue is: a prompt
         that quotes the sentence it is asking for hands over the answer, and looks
         completely ordinary written down. */
      const text = String((item && item.text) || '').trim();
      if(text && text.toLowerCase().indexOf(raw.toLowerCase()) !== -1)
        bad.push('The prompt contains the sentence itself, which gives it away.');
      return bad;
    },

    settleMs: 700
  });

  /* Every word in the sequence is one this sentence actually has, counted rather
     than merely present — so three `the`s are rejected against a sentence holding
     two. Case-insensitive, because the first word arrives capitalised. */
  function fits(seq, words){
    if(!seq.length || seq.length > words.length) return false;
    const left = {};
    words.forEach(w => { const k = norm(w); left[k] = (left[k] || 0) + 1; });
    return seq.every(w => (left[norm(w)] = (left[norm(w)] || 0) - 1) >= 0);
  }

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
})();
