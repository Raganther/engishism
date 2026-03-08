window.LESSON = {
  title: "New Games — Demo",
  mode: "selector",
  slides: [

    // ── Jeopardy ──────────────────────────────────────────────
    {
      label: "Jeopardy — Grammar & Vocabulary",
      type: "jeopardy",
      modules: ["scoreboard", "teams"],
      content: {
        teams: ["Team A", "Team B"],
        categories: [
          {
            name: "Gerunds",
            questions: [
              { value: 100, question: "What verb form follows 'enjoy'?",
                answer: "Gerund (-ing). e.g. I enjoy swimming." },
              { value: 200, question: "Make a sentence using 'there's no point'.",
                answer: "e.g. There's no point worrying about it." },
              { value: 300, question: "What is a 'perfect gerund'? Give an example.",
                answer: "having + past participle. e.g. I remember having met her before." },
              { value: 400, question: "Difference: 'I stopped to smoke' vs 'I stopped smoking'.",
                answer: "First = stopped in order to smoke. Second = quit smoking." }
            ]
          },
          {
            name: "Vocabulary",
            questions: [
              { value: 100, question: "What does 'ubiquitous' mean?",
                answer: "Present or found everywhere. e.g. Smartphones are ubiquitous." },
              { value: 200, question: "Use 'diversify' in a sentence.",
                answer: "e.g. The company decided to diversify into new markets." },
              { value: 300, question: "What does 'went bust' mean?",
                answer: "Went bankrupt — ran out of money. e.g. LEGO nearly went bust in 2015." },
              { value: 400, question: "Explain 'a lightbulb moment' and give an example.",
                answer: "A sudden great idea. e.g. The flatpack idea was a lightbulb moment." }
            ]
          },
          {
            name: "Odd One Out",
            questions: [
              { value: 100, question: "Odd one out: RUN / SWIM / QUICKLY / SLEEP",
                answer: "QUICKLY — it's an adverb. The others are verbs." },
              { value: 200, question: "Odd one out: HAPPINESS / BEAUTIFUL / FREEDOM / KNOWLEDGE",
                answer: "BEAUTIFUL — it's an adjective. The others are abstract nouns." },
              { value: 300, question: "Odd one out: ALTHOUGH / DESPITE / HOWEVER / UNLESS",
                answer: "DESPITE — it's a preposition (+ noun). The others are conjunctions or adverbs." },
              { value: 400, question: "Odd one out: RARELY / NEVER / SOON / ALWAYS",
                answer: "SOON — it's a time adverb. The others are frequency adverbs." }
            ]
          }
        ]
      }
    },

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
