window.Activities = window.Activities || {};

// content.title  = display name
// content.start  = 'node-id'
// content.nodes  = {
//   'id': {
//     speaker: 'A' | 'B' | string,   ← who is speaking this turn
//     options: [{ text: str, next: 'id' | null }]
//   }
// }
// A node with no options is an end node.
window.Activities['fluency-tree'] = {
  render(c) {
    return `
      <div class="slide fluency-tree">
        <div class="ft-thread"></div>
        <div class="ft-turn">
          <div class="ft-turn-speaker"></div>
          <div class="ft-turn-options"></div>
        </div>
      </div>
    `;
  },

  init(el, c, { onComplete }) {
    const threadEl  = el.querySelector('.ft-thread');
    const speakerEl = el.querySelector('.ft-turn-speaker');
    const optionsEl = el.querySelector('.ft-turn-options');

    function addToThread(speaker, text) {
      const bubble = document.createElement('div');
      const side   = speaker === 'B' ? 'ft-side-b' : 'ft-side-a';
      bubble.className = `ft-line ${side}`;
      bubble.innerHTML = `<span class="ft-speaker-tag">${speaker}</span><span class="ft-said">${text}</span>`;
      threadEl.appendChild(bubble);
      threadEl.scrollTop = threadEl.scrollHeight;
    }

    function showNode(id) {
      const node = c.nodes[id];
      if (!node || !node.options || node.options.length === 0) {
        speakerEl.textContent = '';
        optionsEl.innerHTML   = '';
        const done = document.createElement('button');
        done.className   = 'ft-done';
        done.innerHTML   = 'Done &#10003;';
        done.addEventListener('click', e => { e.stopPropagation(); onComplete(); });
        optionsEl.appendChild(done);
        return;
      }

      speakerEl.textContent = node.speaker;
      speakerEl.dataset.speaker = node.speaker;
      optionsEl.innerHTML = '';

      node.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className   = `ft-option ft-opt-${node.speaker === 'B' ? 'b' : 'a'}`;
        btn.textContent = opt.text;
        btn.addEventListener('click', e => {
          e.stopPropagation();
          addToThread(node.speaker, opt.text);
          if (!opt.next || !c.nodes[opt.next]) {
            showNode(null);
          } else {
            showNode(opt.next);
          }
        });
        optionsEl.appendChild(btn);
      });
    }

    showNode(c.start);
  }
};
