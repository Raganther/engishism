window.LESSON = {
  title: "New Games — Demo",
  mode: "selector",
  slides: [

    // ── Millionaire ───────────────────────────────────────────
    {
      label: "Millionaire — Grammar & Vocab",
      type: "millionaire",
      content: {
        questions: [
          {
            question: "Which sentence uses a gerund correctly?",
            options: [
              "I enjoy to swim in the sea.",
              "I enjoy swimming in the sea.",
              "I enjoy swim in the sea.",
              "I enjoy swam in the sea."
            ],
            answer: 1
          },
          {
            question: "What does 'ubiquitous' mean?",
            options: [
              "Extremely rare and precious",
              "Present or found everywhere",
              "Difficult to understand",
              "Related to water"
            ],
            answer: 1
          },
          {
            question: "Which word is an abstract noun?",
            options: ["quickly", "run", "beautiful", "freedom"],
            answer: 3
          },
          {
            question: "What form follows 'you'd better'?",
            options: [
              "Infinitive without 'to'",
              "Gerund (-ing form)",
              "Past participle",
              "Infinitive with 'to'"
            ],
            answer: 0
          },
          {
            question: "What does IKEA stand for?",
            options: [
              "International Kitchens, Electronics and Appliances",
              "Ingvar Kamprad Elmtaryd Agunnaryd",
              "It's a made-up word with no meaning",
              "In Keeping Everything Affordable"
            ],
            answer: 1
          }
        ]
      }
    },

    // ── Countdown ─────────────────────────────────────────────
    {
      label: "Countdown — Letters",
      type: "countdown",
      content: { time: 30 }
    },

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

    // ── Fluency Tree ──────────────────────────────────────────
    {
      label: "Fluency Tree — Food Experiences",
      type: "fluency-tree",
      content: {
        title: "Food Experiences",
        start: "a1",
        nodes: {

          // ── Turn 1: A opens ───────────────────────────────
          "a1": {
            speaker: "A",
            options: [
              { text: "Have you ever eaten something really unusual?", next: "b1" },
              { text: "Are you a picky eater or do you like trying new things?", next: "b1" },
              { text: "What's the most adventurous food you've ever tried?", next: "b1" }
            ]
          },

          // ── Turn 2: B responds ────────────────────────────
          "b1": {
            speaker: "B",
            options: [
              { text: "Yes! I tried snails once — in France.", next: "a2-yes" },
              { text: "I ate insects at a street market in Thailand.", next: "a2-yes" },
              { text: "Not really. I tend to stick to food I know.", next: "a2-no" }
            ]
          },

          // ── Turn 3a: A follows up (B said yes) ───────────
          "a2-yes": {
            speaker: "A",
            options: [
              { text: "Wow! Were you nervous before trying it?", next: "b2-yes" },
              { text: "What were they like?", next: "b2-yes" },
              { text: "Would you eat it again?", next: "b2-yes" }
            ]
          },

          // ── Turn 3b: A follows up (B said no) ────────────
          "a2-no": {
            speaker: "A",
            options: [
              { text: "Is there anything you'd never try, even if someone dared you?", next: "b2-no" },
              { text: "Has anyone ever tried to get you to eat something you refused?", next: "b2-no" },
              { text: "Do you think you'll always be that way, or might you change?", next: "b2-no" }
            ]
          },

          // ── Turn 4a: B elaborates (adventurous) ──────────
          "b2-yes": {
            speaker: "B",
            options: [
              { text: "A bit nervous, yes — but curious more than scared.", next: "a3" },
              { text: "They were surprisingly good, actually. Really garlicky.", next: "a3" },
              { text: "Once was enough, honestly. The texture was too strange.", next: "a3" }
            ]
          },

          // ── Turn 4b: B elaborates (cautious) ─────────────
          "b2-no": {
            speaker: "B",
            options: [
              { text: "Raw fish, probably. I can't get past the texture.", next: "a3" },
              { text: "My friends once made me try durian. I hated it.", next: "a3" },
              { text: "I think I'm getting more adventurous as I get older, actually.", next: "a3" }
            ]
          },

          // ── Turn 5: A wraps up ────────────────────────────
          "a3": {
            speaker: "A",
            options: [
              { text: "I know what you mean. I used to be the same.", next: "b3" },
              { text: "That's fair enough. Food is really personal, isn't it.", next: "b3" },
              { text: "Ha! I've had a similar experience.", next: "b3" }
            ]
          },

          // ── Turn 6: B closes ──────────────────────────────
          "b3": {
            speaker: "B",
            options: [
              { text: "Exactly. Have you ever eaten anything really unusual?", next: null },
              { text: "What about you — are you adventurous with food?", next: null },
              { text: "Yeah, food says a lot about where you're from, doesn't it.", next: null }
            ]
          }

        }
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
