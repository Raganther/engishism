(function () {
  const root = window;

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pick(list, count) {
    return shuffle(list).slice(0, count);
  }

  function flattenVocabulary(topic) {
    return (topic.vocabulary || []).filter(item => item && item.term);
  }

  function uniqueStrings(list) {
    return [...new Set((list || []).filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
  }

  function plainSentence(sentence) {
    return String(sentence || '').replace(/\[([^\]]+)\]/g, '$1');
  }

  function extractBracketAnswer(sentence) {
    const match = String(sentence || '').match(/\[([^\]]+)\]/);
    return match ? match[1] : plainSentence(sentence);
  }

  function scrambleWord(word) {
    const letters = String(word || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .split('');

    if (letters.length < 4) return letters.join('');

    let attempt = letters.join('');
    for (let i = 0; i < 8; i++) {
      const shuffled = shuffle(letters).join('');
      if (shuffled !== attempt) return shuffled;
    }
    return letters.slice().reverse().join('');
  }

  function removeVowels(word) {
    return String(word || '')
      .toUpperCase()
      .replace(/[AEIOU]/g, '')
      .replace(/[^A-Z]/g, '');
  }

  function looksShortAnswer(answer) {
    return String(answer || '').trim().split(/\s+/).length <= 4;
  }

  function regularPastBase(word) {
    const base = String(word || '').trim();
    if (!/ed$/i.test(base)) return null;
    if (/ied$/i.test(base)) return `${base.slice(0, -3)}y`;
    if (/ed$/i.test(base)) return base.slice(0, -2);
    return null;
  }

  function regularPastForms(word) {
    const base = regularPastBase(word);
    if (!base) return [];
    const forms = [base];
    if (/y$/i.test(base)) forms.push(`${base.slice(0, -1)}ies`);
    else if (/(s|sh|ch|x|z|o)$/i.test(base)) forms.push(`${base}es`);
    else forms.push(`${base}s`);
    return forms;
  }

  function auxiliaryAlternatives(word) {
    const lower = String(word || '').toLowerCase();
    const map = {
      do: ['does', 'did'],
      does: ['do', 'did'],
      did: ['do', 'does'],
      is: ['are', 'was'],
      are: ['is', 'were'],
      was: ['is', 'were'],
      were: ['are', 'was'],
      has: ['have', 'had'],
      have: ['has', 'had'],
      had: ['has', 'have'],
    };
    return map[lower] || [];
  }

  function mutateAnswer(answer) {
    const base = String(answer || '').trim();
    if (!base) return [];

    const variants = [];
    const lower = base.toLowerCase();
    const words = base.split(/\s+/);

    if (words.length > 1) return [];

    if (auxiliaryAlternatives(base).length) {
      variants.push(...auxiliaryAlternatives(base));
      return uniqueStrings(variants).filter(item => item.toLowerCase() !== lower);
    }

    if (/\bdoes not\b/.test(lower)) variants.push(base.replace(/does not/i, 'do not'));
    if (/\bdo not\b/.test(lower)) variants.push(base.replace(/do not/i, 'does not'));
    if (/\bhas\b/.test(lower)) variants.push(base.replace(/\bhas\b/i, 'have'));
    if (/\bhave\b/.test(lower)) variants.push(base.replace(/\bhave\b/i, 'has'));
    if (/\bis\b/.test(lower)) variants.push(base.replace(/\bis\b/i, 'are'));
    if (/\bare\b/.test(lower)) variants.push(base.replace(/\bare\b/i, 'is'));

    if (/ied$/i.test(base) || /ed$/i.test(base)) variants.push(...regularPastForms(base));
    else if (/ies$/i.test(base)) variants.push(base.replace(/ies$/i, 'y'));
    else if (/es$/i.test(base)) variants.push(base.replace(/es$/i, ''));
    else if (/s$/i.test(base) && !/ss$/i.test(base)) variants.push(base.replace(/s$/i, ''));
    else if (/y$/i.test(base)) variants.push(`${base.slice(0, -1)}ies`);
    else if (/^[A-Za-z]+$/.test(base)) variants.push(`${base}s`, `${base}ed`);

    return uniqueStrings(variants).filter(item => item.toLowerCase() !== lower);
  }

  function vocabularyDistractors(topic, answer) {
    return uniqueStrings(
      flattenVocabulary(topic)
        .map(item => item.term)
        .filter(term => String(term).toLowerCase() !== String(answer).toLowerCase())
    );
  }

  function fallbackDistractors(topic, item) {
    return uniqueStrings(
      (topic.fillBlanks || [])
        .filter(other => other !== item)
        .map(other => extractBracketAnswer(other.sentence))
    );
  }

  function buildFillBlankOptions(topic, item) {
    const answer = extractBracketAnswer(item.sentence);
    const explicit = uniqueStrings(item.options || []);
    if (explicit.includes(answer) && explicit.length >= 3) {
      return shuffle(explicit);
    }

    if (!looksShortAnswer(answer)) return null;

    const mutated = mutateAnswer(answer);
    const lexicalPool = topic.category === 'vocabulary'
      ? vocabularyDistractors(topic, answer)
      : [];
    const fallbackPool = topic.category === 'vocabulary'
      ? fallbackDistractors(topic, item)
      : [];

    const pool = uniqueStrings([
      ...mutated,
      ...lexicalPool,
      ...fallbackPool,
    ]).filter(option => option.toLowerCase() !== answer.toLowerCase());

    const options = uniqueStrings([answer, ...pool]).slice(0, 4);
    return options.length >= 3 ? shuffle(options) : null;
  }

  function buildNcCells(topic) {
    const cells = [];

    (topic.questions && topic.questions.openEnded || []).forEach(item => {
      cells.push({
        question: item.prompt,
        answer: item.answer,
      });
    });

    (topic.questions && topic.questions.trueFalse || []).forEach(item => {
      cells.push({
        question: `${item.statement} True or false?`,
        answer: `${item.answer ? 'True' : 'False'}${item.explanation ? ` - ${item.explanation}` : ''}`,
      });
    });

    (topic.fillBlanks || []).forEach(item => {
      cells.push({
        question: `Complete: ${plainSentence(item.sentence).replace(extractBracketAnswer(item.sentence), '_____')}`,
        answer: extractBracketAnswer(item.sentence),
      });
    });

    return cells.slice(0, 9);
  }

  function revealItems(topic) {
    if (Array.isArray(topic.revealItems) && topic.revealItems.length) return topic.revealItems;
    return (topic.examples || []).map(item => ({
      label: item.focus || topic.title,
      example: item.sentence,
    }));
  }

  root.GameAdapters = {
    'title-card': {
      canAdapt(topic) {
        return !!(topic && topic.title);
      },
      build(topic) {
        return {
          label: `${topic.title} Title Card`,
          type: 'title-card',
          content: {
            unit: '',
            heading: topic.title,
            subheading: `${topic.category || 'Topic'} — ${topic.level || ''}`.trim(),
          },
        };
      },
    },

    'reveal-card': {
      canAdapt(topic) {
        return revealItems(topic).length >= 3;
      },
      build(topic) {
        return {
          label: `${topic.title} Reference`,
          type: 'reveal-card',
          content: {
            heading: topic.title,
            items: revealItems(topic).slice(0, 6),
          },
        };
      },
    },

    'fill-blank': {
      canAdapt(topic) {
        return Array.isArray(topic.fillBlanks) && topic.fillBlanks.length >= 4;
      },
      build(topic) {
        const questions = pick(topic.fillBlanks, Math.min(6, topic.fillBlanks.length)).map(item => ({
          sentence: item.sentence,
          note: item.note || '',
          options: buildFillBlankOptions(topic, item),
        }));

        const allChoiceReady = questions.every(item => Array.isArray(item.options) && item.options.length >= 3);

        return {
          label: `${topic.title} Fill in the Blank`,
          type: 'fill-blank',
          content: {
            mode: allChoiceReady ? 'multiple-choice' : undefined,
            questions: questions.map(item => ({
              sentence: item.sentence,
              note: item.note || '',
              ...(allChoiceReady ? { options: item.options } : {}),
            })),
          },
        };
      },
    },

    'true-false': {
      canAdapt(topic) {
        return !!(topic.questions && Array.isArray(topic.questions.trueFalse) && topic.questions.trueFalse.length >= 3);
      },
      build(topic) {
        return {
          label: `${topic.title} True / False`,
          type: 'true-false',
          content: {
            questions: pick(topic.questions.trueFalse, Math.min(5, topic.questions.trueFalse.length)).map(item => ({
              statement: item.statement,
              answer: item.answer,
              explanation: item.explanation || '',
            })),
          },
        };
      },
    },

    'sentence-complete': {
      canAdapt(topic) {
        return !!(topic.questions && Array.isArray(topic.questions.openEnded) && topic.questions.openEnded.length >= 4);
      },
      build(topic) {
        return {
          label: `${topic.title} Sentence Complete`,
          type: 'sentence-complete',
          content: {
            stems: pick(topic.questions.openEnded, Math.min(5, topic.questions.openEnded.length)).map(item => ({
              stem: item.prompt,
              hint: item.hint || '',
              answer: item.answer,
            })),
          },
        };
      },
    },

    'hot-seat': {
      canAdapt(topic) {
        return flattenVocabulary(topic).length >= 8;
      },
      build(topic) {
        return {
          label: `${topic.title} Hot Seat`,
          type: 'hot-seat',
          content: {
            words: pick(flattenVocabulary(topic), Math.min(10, flattenVocabulary(topic).length)).map(item => item.term.toUpperCase()),
            time: 60,
          },
        };
      },
    },

    'noughts-crosses': {
      canAdapt(topic) {
        return buildNcCells(topic).length >= 9;
      },
      build(topic) {
        return {
          label: `${topic.title} Noughts & Crosses`,
          type: 'noughts-crosses',
          content: {
            teams: ['Team X', 'Team O'],
            cells: pick(buildNcCells(topic), 9),
          },
        };
      },
    },

    'anagram': {
      canAdapt(topic) {
        return flattenVocabulary(topic).filter(item => item.term.replace(/[^A-Za-z]/g, '').length >= 4).length >= 6;
      },
      build(topic) {
        return {
          label: `${topic.title} Anagram`,
          type: 'anagram',
          content: {
            words: pick(
              flattenVocabulary(topic).filter(item => item.term.replace(/[^A-Za-z]/g, '').length >= 4),
              Math.min(6, flattenVocabulary(topic).length)
            ).map(item => ({
              scrambled: scrambleWord(item.term),
              answer: item.term.toUpperCase(),
              hint: item.hint || item.definition || '',
            })),
          },
        };
      },
    },

    'missing-vowels': {
      canAdapt(topic) {
        return flattenVocabulary(topic).filter(item => removeVowels(item.term).length >= 3).length >= 6;
      },
      build(topic) {
        return {
          label: `${topic.title} Missing Vowels`,
          type: 'missing-vowels',
          content: {
            items: pick(
              flattenVocabulary(topic).filter(item => removeVowels(item.term).length >= 3),
              Math.min(6, flattenVocabulary(topic).length)
            ).map(item => ({
              display: removeVowels(item.term),
              answer: item.term.toUpperCase(),
              hint: item.hint || item.definition || '',
            })),
          },
        };
      },
    },

    'call-my-bluff': {
      canAdapt(topic) {
        return flattenVocabulary(topic).filter(item => item.definition && Array.isArray(item.bluffs) && item.bluffs.length >= 2).length >= 3;
      },
      build(topic) {
        return {
          label: `${topic.title} Call My Bluff`,
          type: 'call-my-bluff',
          content: {
            items: pick(
              flattenVocabulary(topic).filter(item => item.definition && Array.isArray(item.bluffs) && item.bluffs.length >= 2),
              4
            ).map(item => {
              const definitions = shuffle([item.definition, item.bluffs[0], item.bluffs[1]]);
              return {
                word: item.term.toUpperCase(),
                definitions,
                answer: definitions.indexOf(item.definition),
              };
            }),
          },
        };
      },
    },

    'meaning-pair': {
      canAdapt(topic) {
        return Array.isArray(topic.pairs) && topic.pairs.length >= 3;
      },
      build(topic) {
        return {
          label: `${topic.title} Meaning Pair`,
          type: 'meaning-pair',
          content: {
            pairs: pick(topic.pairs, Math.min(4, topic.pairs.length)).map(item => ({
              a: item.a,
              b: item.b,
              note: item.note || '',
            })),
          },
        };
      },
    },

    'odd-one-out': {
      canAdapt(topic) {
        return Array.isArray(topic.oddOneOut) && topic.oddOneOut.length >= 3;
      },
      build(topic) {
        return {
          label: `${topic.title} Odd One Out`,
          type: 'odd-one-out',
          content: {
            items: pick(topic.oddOneOut, Math.min(4, topic.oddOneOut.length)).map(item => ({
              words: item.words,
              odd: item.odd,
              reason: item.reason,
            })),
          },
        };
      },
    },

    'millionaire': {
      canAdapt(topic) {
        return !!(topic.questions && Array.isArray(topic.questions.multipleChoice) && topic.questions.multipleChoice.length >= 10);
      },
      build(topic) {
        return {
          label: `${topic.title} Millionaire`,
          type: 'millionaire',
          content: {
            questions: topic.questions.multipleChoice.slice(0, 10).map(item => ({
              question: item.question,
              options: item.options,
              answer: item.answer,
            })),
          },
        };
      },
    },

    'jeopardy': {
      canAdapt(topic) {
        return Array.isArray(topic.jeopardyCategories)
          && topic.jeopardyCategories.length === 4
          && topic.jeopardyCategories.every(cat => Array.isArray(cat.questions) && cat.questions.length === 4);
      },
      build(topic) {
        return {
          label: `${topic.title} Jeopardy`,
          type: 'jeopardy',
          content: {
            categories: topic.jeopardyCategories.map(cat => ({
              name: cat.name,
              questions: cat.questions.map(q => ({
                value: q.value,
                question: q.question,
                answer: q.answer,
              })),
            })),
          },
        };
      },
    },

    'countdown': {
      canAdapt(topic) {
        return true;
      },
      build(topic) {
        return {
          label: `${topic.title} Countdown`,
          type: 'countdown',
          content: { time: 30 },
        };
      },
    },

    'scenario-cards': {
      canAdapt(topic) {
        return Array.isArray(topic.scenarioCards) && topic.scenarioCards.length >= 4;
      },
      build(topic) {
        return {
          label: `${topic.title} Scenarios`,
          type: 'scenario-cards',
          content: {
            cards: topic.scenarioCards.slice(0, 6).map(card => ({
              title: card.title,
              scenario: card.scenario,
              verdict: card.verdict,
              verdictStyle: card.verdictStyle,
              reveal: card.reveal,
              details: card.details,
              hook: card.hook,
            })),
          },
        };
      },
    },

    'fluency-tree': {
      canAdapt(topic) {
        return !!(topic.fluencyTree && topic.fluencyTree.start && topic.fluencyTree.nodes);
      },
      build(topic) {
        return {
          label: `${topic.title} Fluency Tree`,
          type: 'fluency-tree',
          content: {
            title: topic.fluencyTree.title || topic.title,
            start: topic.fluencyTree.start,
            nodes: topic.fluencyTree.nodes,
          },
        };
      },
    },
  };
})();
