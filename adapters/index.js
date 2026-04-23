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

  root.GameAdapters = {
    'fill-blank': {
      canAdapt(topic) {
        return Array.isArray(topic.fillBlanks) && topic.fillBlanks.length >= 4;
      },
      build(topic) {
        return {
          label: `${topic.title} Fill in the Blank`,
          type: 'fill-blank',
          content: {
            questions: pick(topic.fillBlanks, Math.min(6, topic.fillBlanks.length)).map(item => ({
              sentence: item.sentence,
              note: item.note || '',
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
  };
})();
