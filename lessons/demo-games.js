window.LESSON = {
  title: "New Games — Demo",
  mode: "selector",
  slides: [

    // ── Anagram ───────────────────────────────────────────────
    {
      label: "Anagram — Vocabulary",
      type: "anagram",
      content: {
        words: [
          { scrambled: "DNUGRE",    answer: "GERUND",       hint: "A verb form used as a noun (-ing)" },
          { scrambled: "ISOMNINA",  answer: "INSOMNIA",     hint: "Inability to sleep" },
          { scrambled: "QSOBUUIIT", answer: "UBIQUITOUS",   hint: "Found everywhere" },
          { scrambled: "ATDIRSCTDE", answer: "DISTRACTED",  hint: "Unable to concentrate" },
          { scrambled: "HEOSTDO",   answer: "SOOTHED",      hint: "Calmed or comforted" }
        ]
      }
    },

    // ── Call My Bluff ─────────────────────────────────────────
    {
      label: "Call My Bluff — Vocabulary",
      type: "call-my-bluff",
      content: {
        items: [
          {
            word: "UBIQUITOUS",
            definitions: [
              "Relating to the study of rare birds",
              "Present, appearing, or found everywhere",
              "Extremely difficult to understand"
            ],
            answer: 1
          },
          {
            word: "DEFENESTRATION",
            definitions: [
              "The act of throwing someone or something out of a window",
              "A formal process for removing errors from software",
              "An ancient Roman architectural technique"
            ],
            answer: 0
          },
          {
            word: "SYCOPHANT",
            definitions: [
              "A type of large tropical tree",
              "Someone who studies ancient languages",
              "A person who flatters powerful people to gain advantage"
            ],
            answer: 2
          }
        ]
      }
    },

    // ── Odd One Out ───────────────────────────────────────────
    {
      label: "Odd One Out — Word Class",
      type: "odd-one-out",
      content: {
        items: [
          {
            words: ["running", "swimming", "quickly", "sleeping"],
            odd: "quickly",
            reason: '"quickly" is an adverb — the others are gerunds (verb + -ing used as nouns)'
          },
          {
            words: ["happiness", "freedom", "beautiful", "knowledge"],
            odd: "beautiful",
            reason: '"beautiful" is an adjective — the others are abstract nouns'
          },
          {
            words: ["rarely", "never", "always", "soon"],
            odd: "soon",
            reason: '"soon" is a time adverb — the others are frequency adverbs'
          },
          {
            words: ["despite", "although", "however", "nevertheless"],
            odd: "despite",
            reason: '"despite" is a preposition (+ noun) — the others are conjunctions or adverbs'
          }
        ]
      }
    },

    // ── Missing Vowels ────────────────────────────────────────
    {
      label: "Missing Vowels — Grammar Terms",
      type: "missing-vowels",
      content: {
        items: [
          { display: "GRND",    answer: "GERUND",       hint: "Verb + -ing used as a noun" },
          { display: "NFNTV",   answer: "INFINITIVE",   hint: "The base form of a verb (to + verb)" },
          { display: "PSSV",    answer: "PASSIVE",      hint: "When the subject receives the action" },
          { display: "DVRB",    answer: "ADVERB",       hint: "Modifies a verb, adjective, or other adverb" },
          { display: "CNNCTN",  answer: "CONJUNCTION",  hint: "Joins clauses (and, but, although...)" },
          { display: "PRPSTN",  answer: "PREPOSITION",  hint: "Shows relationship (in, on, despite...)" }
        ]
      }
    }

  ]
};
