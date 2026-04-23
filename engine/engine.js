(function () {
  const activities = window.Activities || {};
  const mods = window.Modules || {};
  const adapters = window.GameAdapters || {};

  const container = document.getElementById('slide-container');
  const counter = document.getElementById('slide-counter');
  const btnLessons = document.getElementById('btn-lessons');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnMenu = document.getElementById('btn-menu');
  const barTop = document.getElementById('module-bar-top');
  const barBottom = document.getElementById('module-bar-bottom');

  const topicCache = {};
  const lessonCache = {};

  const ACTIVITY_CATALOG = (function () {
    function icon(inner) {
      return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    }
    return [
      {
        type: 'title-card', label: 'Title Card', desc: 'Lesson title slide',
        icon: icon('<rect x="6" y="5" width="28" height="30" rx="2"/><line x1="6" y1="14" x2="34" y2="14"/><line x1="11" y1="21" x2="29" y2="21"/><line x1="11" y1="27" x2="22" y2="27"/>')
      },
      {
        type: 'reveal-card', label: 'Reveal Card', desc: 'Reference list — labels with examples',
        icon: icon('<circle cx="10" cy="13" r="2" fill="currentColor" stroke="none"/><line x1="15" y1="13" x2="32" y2="13"/><circle cx="10" cy="21" r="2" fill="currentColor" stroke="none"/><line x1="15" y1="21" x2="32" y2="21"/><circle cx="10" cy="29" r="2" fill="currentColor" stroke="none"/><line x1="15" y1="29" x2="26" y2="29"/>')
      },
      {
        type: 'fill-blank', label: 'Fill in the Blank', desc: 'Gap-fill sentences, click to reveal',
        icon: icon('<line x1="3" y1="18" x2="13" y2="18"/><rect x="16" y="13" width="10" height="10" rx="1" stroke-dasharray="2,2"/><line x1="28" y1="18" x2="37" y2="18"/><line x1="3" y1="28" x2="20" y2="28"/>')
      },
      {
        type: 'meaning-pair', label: 'Meaning Pair', desc: 'Compare two sentences — spot the difference',
        icon: icon('<rect x="3" y="12" width="13" height="16" rx="2"/><rect x="24" y="12" width="13" height="16" rx="2"/><line x1="16" y1="20" x2="24" y2="20"/><polyline points="18,18 16,20 18,22"/><polyline points="22,18 24,20 22,22"/>')
      },
      {
        type: 'sentence-complete', label: 'Sentence Complete', desc: 'Open-ended sentence stems, reveal a model answer',
        icon: icon('<line x1="4" y1="15" x2="22" y2="15"/><line x1="4" y1="22" x2="16" y2="22"/><circle cx="22" cy="22" r="2" fill="currentColor" stroke="none"/><circle cx="28" cy="22" r="2" fill="currentColor" stroke="none"/><circle cx="34" cy="22" r="2" fill="currentColor" stroke="none"/>')
      },
      {
        type: 'true-false', label: 'True / False', desc: 'Statements to judge, reveal verdict + explanation',
        icon: icon('<line x1="20" y1="6" x2="20" y2="34" stroke-dasharray="2,3"/><polyline points="5,21 10,27 18,13"/><line x1="24" y1="13" x2="35" y2="27"/><line x1="35" y1="13" x2="24" y2="27"/>')
      },
      {
        type: 'hot-seat', label: 'Hot Seat', desc: 'Timed word-description game',
        icon: icon('<path d="M20 35 C11 35 8 26 13 20 C14 24 16 23 16 19 C16 13 18 9 20 4 C22 9 24 13 24 19 C24 23 26 24 27 20 C32 26 29 35 20 35 Z"/>')
      },
      {
        type: 'noughts-crosses', label: 'Noughts & Crosses', desc: 'Q&A grid — teams claim squares',
        icon: icon('<line x1="14" y1="5" x2="14" y2="35"/><line x1="26" y1="5" x2="26" y2="35"/><line x1="5" y1="14" x2="35" y2="14"/><line x1="5" y1="26" x2="35" y2="26"/><line x1="7" y1="7" x2="12" y2="12"/><line x1="12" y1="7" x2="7" y2="12"/><circle cx="20" cy="30" r="4"/>')
      },
      {
        type: 'millionaire', label: 'Millionaire', desc: 'Progressive questions — 50/50 lifeline, walk away',
        icon: icon('<polyline points="4,35 4,27 13,27 13,20 22,20 22,13 31,13 31,6 38,6"/>')
      },
      {
        type: 'countdown', label: 'Countdown', desc: '9 letters, 30 seconds — make the longest word',
        icon: icon('<rect x="3" y="4" width="6" height="8" rx="1"/><rect x="11" y="4" width="6" height="8" rx="1"/><rect x="19" y="4" width="6" height="8" rx="1"/><rect x="27" y="4" width="6" height="8" rx="1"/><circle cx="20" cy="29" r="9"/><line x1="20" y1="22" x2="20" y2="29"/><line x1="20" y1="29" x2="26" y2="29"/>')
      },
      {
        type: 'jeopardy', label: 'Jeopardy', desc: 'Categories × point values — teams claim squares',
        icon: icon('<rect x="3" y="4" width="10" height="10" rx="1"/><rect x="15" y="4" width="10" height="10" rx="1"/><rect x="27" y="4" width="10" height="10" rx="1"/><rect x="3" y="17" width="10" height="9" rx="1" fill="currentColor" stroke="none"/><rect x="15" y="17" width="10" height="9" rx="1"/><rect x="27" y="17" width="10" height="9" rx="1"/><rect x="3" y="29" width="10" height="9" rx="1"/><rect x="15" y="29" width="10" height="9" rx="1"/><rect x="27" y="29" width="10" height="9" rx="1" fill="currentColor" stroke="none"/>')
      },
      {
        type: 'anagram', label: 'Anagram', desc: 'Unscramble the letters to find the word',
        icon: icon('<path d="M8 13 C14 6 26 6 32 13"/><polyline points="28,8 32,13 27,16"/><path d="M32 27 C26 34 14 34 8 27"/><polyline points="12,32 8,27 13,24"/>')
      },
      {
        type: 'call-my-bluff', label: 'Call My Bluff', desc: '3 definitions, one real — class votes',
        icon: icon('<rect x="5" y="7" width="30" height="7" rx="2"/><rect x="5" y="17" width="30" height="7" rx="2"/><rect x="5" y="27" width="30" height="7" rx="2"/>')
      },
      {
        type: 'odd-one-out', label: 'Odd One Out', desc: '4 words, one doesn\'t belong — reveal + reason',
        icon: icon('<circle cx="7" cy="20" r="4"/><circle cx="17" cy="20" r="4"/><circle cx="27" cy="20" r="4"/><rect x="32" y="16" width="8" height="8" rx="1"/>')
      },
      {
        type: 'missing-vowels', label: 'Missing Vowels', desc: 'Word with vowels removed — guess and reveal',
        icon: icon('<rect x="3" y="14" width="7" height="12" rx="1"/><line x1="12" y1="26" x2="18" y2="26"/><rect x="20" y="14" width="7" height="12" rx="1"/><line x1="29" y1="26" x2="35" y2="26"/>')
      },
      {
        type: 'scenario-cards', label: 'Scenario Cards', desc: 'Card grid — click to reveal situation, verdict, and language model',
        icon: icon('<rect x="3" y="7" width="15" height="26" rx="2"/><rect x="22" y="7" width="15" height="26" rx="2"/><line x1="7" y1="13" x2="14" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/><line x1="26" y1="13" x2="33" y2="13"/><line x1="26" y1="17" x2="32" y2="17"/>')
      },
      {
        type: 'fluency-tree', label: 'Fluency Tree', desc: 'Branching conversation — click a response to follow the dialogue path',
        icon: icon('<circle cx="20" cy="8" r="4"/><line x1="20" y1="12" x2="20" y2="18"/><line x1="20" y1="18" x2="10" y2="24"/><line x1="20" y1="18" x2="30" y2="24"/><circle cx="10" cy="28" r="4"/><circle cx="30" cy="28" r="4"/>')
      },
    ];
  })();

  function getActivityMeta(type) {
    return ACTIVITY_CATALOG.find(item => item.type === type);
  }

  function formatType(type) {
    return String(type || '').replace(/-/g, ' ');
  }

  function autoLabel(slide) {
    const c = slide.content;
    switch (slide.type) {
      case 'title-card':        return c.heading;
      case 'reveal-card':       return c.heading;
      case 'fill-blank':        return `${c.questions.length} questions`;
      case 'true-false':        return `${c.questions.length} statements`;
      case 'hot-seat':          return `${c.words.length} words · ${c.time}s`;
      case 'noughts-crosses':   return `${c.cells.length} questions`;
      case 'meaning-pair':      return `${c.pairs.length} pairs`;
      case 'sentence-complete': return `${c.stems.length} sentences`;
      case 'millionaire':       return `${c.questions.length} questions`;
      case 'countdown':         return `${c.time || 30}s`;
      case 'jeopardy':          return `${c.categories.length} categories`;
      case 'anagram':           return `${c.words.length} words`;
      case 'call-my-bluff':     return `${c.items.length} words`;
      case 'odd-one-out':       return `${c.items.length} sets`;
      case 'missing-vowels':    return `${c.items.length} words`;
      case 'scenario-cards':    return `${c.cards.length} scenarios`;
      case 'fluency-tree':      return c.title || 'Conversation';
      default:                  return slide.type;
    }
  }

  function showLoading(message) {
    container.innerHTML = `<p class="loading-msg">${message}</p>`;
  }

  function clearModuleBars() {
    barTop.innerHTML = '';
    barBottom.innerHTML = '';
    barTop.classList.add('hidden');
    barBottom.classList.add('hidden');
  }

  function hideAll() {
    [btnLessons, btnPrev, btnNext, btnMenu].forEach(button => {
      button.style.display = 'none';
      button.onclick = null;
      button.disabled = false;
    });
    counter.textContent = '';
    clearModuleBars();
  }

  function setBackButton(label, handler) {
    btnLessons.textContent = label;
    btnLessons.style.display = '';
    btnLessons.onclick = handler;
  }

  function buildState(slide) {
    const c = slide.content || {};
    const teams = c.teams || ['Team A', 'Team B'];
    const scores = {};
    teams.forEach(team => { scores[team] = 0; });
    return {
      teams,
      scores,
      timeLeft: c.time || 60,
      currentTeam: 0,
      hasTimerModule: !!(slide.modules && slide.modules.includes('timer')),
    };
  }

  function renderActivity(slide, onComplete) {
    clearModuleBars();

    const activity = activities[slide.type];
    if (!activity) {
      container.innerHTML = `<p style="color:red;font-size:2rem">Unknown type: "${slide.type}"</p>`;
      return;
    }

    const events = window.createEventBus();
    const state = buildState(slide);

    container.innerHTML = activity.render(slide.content);

    if (slide.modules && slide.modules.length) {
      slide.modules.forEach(name => {
        const mod = mods[name];
        if (!mod) {
          console.warn(`Module "${name}" not found`);
          return;
        }
        const bar = mod.zone === 'bottom' ? barBottom : barTop;
        bar.classList.remove('hidden');
        const wrapper = document.createElement('div');
        wrapper.className = `module module-${name}`;
        wrapper.innerHTML = mod.render(state);
        bar.appendChild(wrapper);
        mod.init(wrapper, state, events);
      });
    }

    activity.init(container, slide.content, {
      onComplete: onComplete || function () {},
      state,
      events,
    });

    events.on('point', ({ value = 1 }) => {
      const team = window.Session.teams[window.Session.activeTeam];
      if (team) window.Session.award(team, value);
    });
  }

  function getTopicMeta(id) {
    return (window.TOPIC_INDEX || []).find(item => item.id === id);
  }

  function getLessonMeta(id) {
    return (window.LESSON_INDEX || []).find(item => item.id === id);
  }

  function loadTopic(id, onLoad) {
    const meta = getTopicMeta(id);
    if (!meta) {
      container.innerHTML = `<p style="color:red;font-size:1.5rem">Unknown topic: ${id}</p>`;
      return;
    }

    if (topicCache[id]) {
      window.TOPIC_PACK = topicCache[id];
      onLoad(topicCache[id], meta);
      return;
    }

    showLoading('Loading topic…');
    window.TOPIC_PACK = null;

    const old = document.querySelector('script[data-topic]');
    if (old) old.remove();

    const script = document.createElement('script');
    script.src = meta.path;
    script.dataset.topic = id;
    script.onload = () => {
      if (!window.TOPIC_PACK) {
        container.innerHTML = `<p style="color:red;font-size:1.5rem">Topic did not load: ${id}</p>`;
        return;
      }
      topicCache[id] = window.TOPIC_PACK;
      onLoad(topicCache[id], meta);
    };
    script.onerror = () => {
      container.innerHTML = `<p style="color:red;font-size:1.5rem">Could not load topic: ${id}</p>`;
    };
    document.head.appendChild(script);
  }

  function loadAllTopics(onLoad) {
    const metas = window.TOPIC_INDEX || [];
    const topics = [];

    function next(index) {
      if (index >= metas.length) {
        onLoad(topics);
        return;
      }
      loadTopic(metas[index].id, topic => {
        topics.push(topic);
        next(index + 1);
      });
    }

    next(0);
  }

  function loadLesson(id, onLoad) {
    const meta = getLessonMeta(id);
    if (!meta) {
      container.innerHTML = `<p style="color:red;font-size:1.5rem">Unknown lesson: ${id}</p>`;
      return;
    }

    if (lessonCache[id]) {
      window.LESSON = lessonCache[id];
      onLoad(lessonCache[id], meta);
      return;
    }

    showLoading('Loading lesson…');
    window.LESSON = null;

    const old = document.querySelector('script[data-lesson]');
    if (old) old.remove();

    const script = document.createElement('script');
    script.src = `lessons/${id}.js`;
    script.dataset.lesson = id;
    script.onload = () => {
      if (!window.LESSON) {
        container.innerHTML = `<p style="color:red;font-size:1.5rem">Lesson did not load: ${id}</p>`;
        return;
      }
      lessonCache[id] = window.LESSON;
      onLoad(lessonCache[id], meta);
    };
    script.onerror = () => {
      container.innerHTML = `<p style="color:red;font-size:1.5rem">Could not load lesson: ${id}</p>`;
    };
    document.head.appendChild(script);
  }

  function topicTile(meta) {
    return `
      <button class="sel-tile" data-id="${meta.id}">
        <span class="sel-type">${meta.category}</span>
        <span class="sel-label">${meta.title}</span>
        <span class="act-desc">${meta.summary}</span>
        <span class="act-count">${meta.level}${meta.tags && meta.tags.length ? ` · ${meta.tags.join(' · ')}` : ''}</span>
      </button>
    `;
  }

  function showTopicPicker() {
    hideAll();

    const tiles = (window.TOPIC_INDEX || []).map(topicTile).join('');

    container.innerHTML = `
      <div class="selector">
        <h1 class="sel-title">Topics</h1>
        <p class="sel-desc">Choose a topic first, then launch a compatible game.</p>
        <div class="sel-grid">${tiles}</div>
      </div>
    `;

    container.querySelectorAll('.sel-tile').forEach(tile => {
      tile.addEventListener('click', () => showTopicGames(tile.dataset.id));
    });
  }

  function topicAvailabilityText(activityMeta, topic) {
    const adapter = adapters[activityMeta.type];
    if (!adapter) return 'Topic adapter coming soon';
    if (!adapter.canAdapt(topic)) return 'Not enough topic data';
    return 'Ready';
  }

  function showTopicGames(topicId) {
    const topicMeta = getTopicMeta(topicId);
    if (!topicMeta) return;

    hideAll();
    setBackButton('← Topics', showTopicPicker);
    showLoading('Checking compatible games…');

    loadTopic(topicId, topic => {
      const tiles = ACTIVITY_CATALOG.map(activityMeta => {
        const adapter = adapters[activityMeta.type];
        const available = !!(adapter && adapter.canAdapt(topic));
        return `
          <button class="sel-tile act-tile${available ? '' : ' act-empty'}" data-type="${activityMeta.type}" ${available ? '' : 'disabled'}>
            <div class="act-icon">${activityMeta.icon}</div>
            <span class="act-label">${activityMeta.label}</span>
            <span class="act-desc">${activityMeta.desc}</span>
            <span class="act-count${available ? '' : ' none'}">${topicAvailabilityText(activityMeta, topic)}</span>
          </button>
        `;
      }).join('');

      container.innerHTML = `
        <div class="selector">
          <h1 class="sel-title">${topicMeta.title}</h1>
          <p class="sel-desc">${topicMeta.summary}</p>
          <div class="sel-grid">${tiles}</div>
        </div>
      `;

      container.querySelectorAll('.act-tile:not(.act-empty)').forEach(tile => {
        tile.addEventListener('click', () => {
          launchGeneratedActivity(topicMeta.id, tile.dataset.type, () => showTopicGames(topicMeta.id));
        });
      });
    });
  }

  function showAllGamesPicker() {
    hideAll();
    setBackButton('← Topics', showTopicPicker);
    showLoading('Loading game coverage…');

    loadAllTopics(topics => {
      const tiles = ACTIVITY_CATALOG.map(activityMeta => {
        const adapter = adapters[activityMeta.type];
        const count = adapter ? topics.filter(topic => adapter.canAdapt(topic)).length : 0;
        const available = count > 0;
        const badge = adapter ? `${count} topic${count === 1 ? '' : 's'}` : 'Topic adapter coming soon';
        return `
          <button class="sel-tile act-tile${available ? '' : ' act-empty'}" data-type="${activityMeta.type}" ${available ? '' : 'disabled'}>
            <div class="act-icon">${activityMeta.icon}</div>
            <span class="act-label">${activityMeta.label}</span>
            <span class="act-desc">${activityMeta.desc}</span>
            <span class="act-count${available ? '' : ' none'}">${badge}</span>
          </button>
        `;
      }).join('');

      container.innerHTML = `
        <div class="selector">
          <h1 class="sel-title">All Game Types</h1>
          <p class="sel-desc">Browse every game format, then choose a topic that can drive it.</p>
          <div class="sel-grid">${tiles}</div>
        </div>
      `;

      container.querySelectorAll('.act-tile:not(.act-empty)').forEach(tile => {
        tile.addEventListener('click', () => showGameTopics(tile.dataset.type));
      });
    });
  }

  function showGameTopics(type) {
    const activityMeta = getActivityMeta(type);
    const adapter = adapters[type];

    if (!activityMeta || !adapter) {
      showAllGamesPicker();
      return;
    }

    hideAll();
    setBackButton('← Games', showAllGamesPicker);
    showLoading('Finding matching topics…');

    loadAllTopics(topics => {
      const matches = topics
        .map(topic => ({ topic, meta: getTopicMeta(topic.id) }))
        .filter(item => item.meta && adapter.canAdapt(item.topic));

      const tiles = matches.map(item => topicTile(item.meta)).join('');

      container.innerHTML = `
        <div class="selector">
          <h1 class="sel-title">${activityMeta.label}</h1>
          <p class="sel-desc">Choose a topic that can generate this game.</p>
          <div class="sel-grid">${tiles}</div>
        </div>
      `;

      container.querySelectorAll('.sel-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          launchGeneratedActivity(tile.dataset.id, type, () => showGameTopics(type));
        });
      });
    });
  }

  function launchGeneratedActivity(topicId, type, returnHandler) {
    const topicMeta = getTopicMeta(topicId);
    const activityMeta = getActivityMeta(type);
    const adapter = adapters[type];

    if (!topicMeta || !activityMeta || !adapter) return;

    hideAll();
    setBackButton('← Games', returnHandler);
    showLoading('Building activity…');

    loadTopic(topicId, topic => {
      if (!adapter.canAdapt(topic)) {
        container.innerHTML = `<p style="color:red;font-size:1.5rem">This topic cannot generate ${activityMeta.label} yet.</p>`;
        return;
      }

      const slide = adapter.build(topic);
      counter.textContent = slide.label || `${activityMeta.label} · ${topicMeta.title}`;
      renderActivity(slide, returnHandler);
    });
  }

  function showLegacyLessonPicker() {
    hideAll();

    const index = window.LESSON_INDEX || [];
    const tiles = index.map(lesson => `
      <button class="sel-tile" data-id="${lesson.id}">
        ${lesson.tag ? `<span class="sel-type">${lesson.tag}</span>` : ''}
        <span class="sel-label">${lesson.title}</span>
        <span class="act-count">${lesson.types.length} activit${lesson.types.length === 1 ? 'y' : 'ies'}</span>
      </button>
    `).join('');

    container.innerHTML = `
      <div class="selector">
        <h1 class="sel-title">Curated Lessons</h1>
        <p class="sel-desc">Existing hand-built lesson packs.</p>
        <div class="sel-grid">${tiles}</div>
      </div>
    `;

    container.querySelectorAll('.sel-tile').forEach(tile => {
      tile.addEventListener('click', () => showLegacyLessonGames(tile.dataset.id));
    });
  }

  function showLegacyLessonGames(lessonId) {
    const lessonMeta = getLessonMeta(lessonId);
    if (!lessonMeta) return;

    hideAll();
    setBackButton('← Lessons', showLegacyLessonPicker);

    const tiles = ACTIVITY_CATALOG.map(activityMeta => {
      const available = lessonMeta.types.includes(activityMeta.type);
      return `
        <button class="sel-tile act-tile${available ? '' : ' act-empty'}" data-type="${activityMeta.type}" ${available ? '' : 'disabled'}>
          <div class="act-icon">${activityMeta.icon}</div>
          <span class="act-label">${activityMeta.label}</span>
          <span class="act-desc">${activityMeta.desc}</span>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="selector">
        <h1 class="sel-title">${lessonMeta.title}</h1>
        ${lessonMeta.tag ? `<p class="sel-desc">${lessonMeta.tag}</p>` : ''}
        <div class="sel-grid">${tiles}</div>
      </div>
    `;

    container.querySelectorAll('.act-tile:not(.act-empty)').forEach(tile => {
      tile.addEventListener('click', () => {
        launchLegacyLessonActivity(lessonId, tile.dataset.type, () => showLegacyLessonGames(lessonId));
      });
    });
  }

  function launchLegacyLessonActivity(lessonId, type, returnHandler, options) {
    const activityMeta = getActivityMeta(type);
    const directFirst = options && options.directFirst;

    hideAll();
    setBackButton('← Games', returnHandler);
    showLoading('Loading lesson activity…');

    loadLesson(lessonId, lesson => {
      const slides = lesson.slides.filter(slide => slide.type === type);
      if (slides.length === 0) {
        container.innerHTML = `<p style="color:red;font-size:1.5rem">No slides found for ${type}.</p>`;
        return;
      }

      function playSlide(slide) {
        hideAll();
        setBackButton('← Games', returnHandler);
        counter.textContent = slide.label || activityMeta.label || formatType(type);
        renderActivity(slide, returnHandler);
      }

      if (slides.length === 1 || directFirst) {
        playSlide(slides[0]);
        return;
      }

      const tiles = slides.map((slide, index) => {
        const label = slide.label || autoLabel(slide);
        const hasMods = slide.modules && slide.modules.length;
        return `
          <button class="sel-tile${hasMods ? ' has-modules' : ''}" data-index="${index}">
            <span class="sel-label">${label}</span>
            ${hasMods ? `<span class="sel-mods">${slide.modules.join(' · ')}</span>` : ''}
          </button>
        `;
      }).join('');

      container.innerHTML = `
        <div class="selector">
          <h1 class="sel-title">${activityMeta ? activityMeta.label : formatType(type)}</h1>
          <div class="sel-grid">${tiles}</div>
        </div>
      `;

      container.querySelectorAll('.sel-tile').forEach(tile => {
        tile.addEventListener('click', () => playSlide(slides[parseInt(tile.dataset.index, 10)]));
      });
    });
  }

  function startSelectorMode(lesson) {
    function showMenu() {
      hideAll();
      setBackButton('← Lessons', showLegacyLessonPicker);

      const tiles = lesson.slides.map((slide, index) => {
        const label = slide.label || autoLabel(slide);
        const hasMods = slide.modules && slide.modules.length;
        return `
          <button class="sel-tile${hasMods ? ' has-modules' : ''}" data-index="${index}">
            <span class="sel-type">${formatType(slide.type)}</span>
            <span class="sel-label">${label}</span>
            ${hasMods ? `<span class="sel-mods">${slide.modules.join(' · ')}</span>` : ''}
          </button>
        `;
      }).join('');

      container.innerHTML = `
        <div class="selector">
          <h1 class="sel-title">${lesson.title}</h1>
          <div class="sel-grid">${tiles}</div>
        </div>
      `;

      container.querySelectorAll('.sel-tile').forEach(tile => {
        tile.addEventListener('click', () => launch(parseInt(tile.dataset.index, 10)));
      });
    }

    function launch(index) {
      hideAll();
      setBackButton('← Lessons', showMenu);
      counter.textContent = lesson.slides[index].label || formatType(lesson.slides[index].type);
      renderActivity(lesson.slides[index], showMenu);
    }

    showMenu();
  }

  function startSlideshowMode(lesson) {
    let current = 0;

    hideAll();
    setBackButton('← Lessons', showLegacyLessonPicker);
    btnPrev.style.display = '';
    btnNext.style.display = '';

    function go(dir) {
      const next = current + dir;
      if (next < 0 || next >= lesson.slides.length) return;
      current = next;
      renderActivity(lesson.slides[current], () => go(1));
      counter.textContent = `${current + 1} / ${lesson.slides.length}`;
      btnPrev.disabled = current === 0;
      btnNext.disabled = current === lesson.slides.length - 1;
    }

    btnPrev.onclick = () => go(-1);
    btnNext.onclick = () => go(1);
    go(0);
  }

  function startLesson() {
    const lesson = window.LESSON;
    if (!lesson) return;
    if ((lesson.mode || 'slideshow') === 'selector') {
      startSelectorMode(lesson);
    } else {
      startSlideshowMode(lesson);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const initialView = params.get('view');

  if (initialView === 'lessons') {
    showLegacyLessonPicker();
  } else if (initialView === 'games') {
    showAllGamesPicker();
  } else if (window.TOPIC_INDEX) {
    showTopicPicker();
  } else if (window.LESSON) {
    startLesson();
  } else {
    container.innerHTML = `<p style="color:var(--muted);font-size:1.5rem">No content loaded.</p>`;
  }
})();
