window.LESSON = {
  title: "Unit 8A — Gerunds & Infinitives",
  mode: "selector",
  slides: [

    // ── Title ─────────────────────────────────────────────────
    {
      type: "title-card",
      content: {
        unit: "8A",
        heading: "It's No Use Trying to Go to Sleep",
        subheading: "Gerunds & Infinitives"
      }
    },

    // ── Reference ─────────────────────────────────────────────
    {
      label: "Four Forms to Know",
      type: "reveal-card",
      content: {
        heading: "Four forms to know",
        items: [
          { label: "to + infinitive",        example: "It's easy to fall asleep." },
          { label: "infinitive without to",   example: "You'd better sleep now." },
          { label: "gerund  (verb + -ing)",   example: "I enjoy sleeping." },
          { label: "to + passive infinitive", example: "It's easy to be distracted." },
          { label: "to + perfect infinitive", example: "I'm glad to have slept well." },
          { label: "passive gerund",          example: "I enjoy being soothed." },
          { label: "perfect gerund",          example: "I remember having slept here." }
        ]
      }
    },

    // ── Fill in the Blank ──────────────────────────────────────
    {
      label: "Gap Fill — Gerund Forms",
      type: "fill-blank",
      content: {
        questions: [
          { sentence: "Enjoy [being soothed] to sleep by music.",
            note: "passive gerund" },
          { sentence: "It's easy [to be distracted] by background noises.",
            note: "to + passive infinitive" },
          { sentence: "Go to work without [having had] eight hours' sleep.",
            note: "perfect gerund" },
          { sentence: "Be pleasantly surprised [to have slept] all night long.",
            note: "to + perfect infinitive" }
        ]
      }
    },

    // ── Meaning Pairs ──────────────────────────────────────────
    {
      label: "Spot the Difference",
      type: "meaning-pair",
      content: {
        pairs: [
          { a: "He got out of bed without saying a word.",
            b: "He got out of bed without having said a word.",
            note: "A = during the action &ensp;|&ensp; B = before / completed action" },
          { a: "He seems to sleep well.",
            b: "He seems to have slept well.",
            note: "A = general habit &ensp;|&ensp; B = specific past occasion" },
          { a: "My daughter likes reading in bed.",
            b: "My daughter likes being read to in bed.",
            note: "A = active (she reads) &ensp;|&ensp; B = passive (someone reads to her)" },
          { a: "I'd like to wake up at 8:30.",
            b: "I'd like to be woken up at 8:30.",
            note: "A = active &ensp;|&ensp; B = passive (by alarm / someone else)" }
        ]
      }
    },

    // ── Sentence Complete ──────────────────────────────────────
    {
      label: "Complete the Sentence",
      type: "sentence-complete",
      content: {
        stems: [
          { stem: "I've got to get up at 4:00 to go to the airport, so I may as well ...",
            hint: "+ infinitive without to",
            answer: "get up now / stay awake" },
          { stem: "If you don't feel tired, there's no point ...",
            hint: "+ gerund (-ing)",
            answer: "going to bed / trying to sleep" },
          { stem: "You can't carry on sleeping only two hours a night. You'd better ...",
            hint: "+ infinitive without to",
            answer: "see a doctor / change your habits" },
          { stem: "What a disaster! I went into the exam without having ...",
            hint: "+ past participle",
            answer: "studied / prepared / slept properly" },
          { stem: "When I feel tired, I really don't enjoy being ...",
            hint: "+ past participle",
            answer: "disturbed / kept awake / interrupted" },
          { stem: "If you can't sleep, just accept it. It's no use ...",
            hint: "+ gerund (-ing)",
            answer: "worrying about it / fighting it / getting frustrated" }
        ]
      }
    },

    // ── True / False ───────────────────────────────────────────
    {
      label: "True / False — Grammar Rules",
      type: "true-false",
      content: {
        questions: [
          { statement: "You use a gerund (verb + -ing) after 'enjoy'.",
            answer: true,
            explanation: "e.g. I enjoy reading. / She enjoys being soothed to sleep." },
          { statement: "'I'd like to wake up' and 'I'd like to be woken up' mean the same thing.",
            answer: false,
            explanation: "The first is active. The second is passive — someone or something wakes you." },
          { statement: "'He seems to have slept well' refers to a specific past occasion.",
            answer: true,
            explanation: "The perfect infinitive (to have + past participle) refers back to a completed action." }
        ]
      }
    },

    // ── Hot Seat (no modules) ──────────────────────────────────
    {
      label: "Hot Seat — Unit 8A Vocabulary",
      type: "hot-seat",
      content: {
        words: [
          "distracted", "soothed", "irritated", "segmented",
          "attribute", "dwindled", "ubiquitous", "insomnia",
          "catastrophic", "conscious"
        ],
        time: 60
      }
    },

    // ── Noughts & Crosses ──────────────────────────────────────
    {
      label: "Noughts & Crosses — Grammar Review",
      type: "noughts-crosses",
      content: {
        teams: ["Team X", "Team O"],
        cells: [
          { question: "Give an example using 'enjoy' + gerund.",
            answer: "I enjoy being soothed to sleep by music." },
          { question: "What form follows 'there's no point'?",
            answer: "Gerund (-ing): There's no point going to bed early." },
          { question: "Difference: 'seems to sleep well' vs 'seems to have slept well'?",
            answer: "First = general habit. Second = a specific past occasion." },
          { question: "Make a sentence with 'without having'.",
            answer: "e.g. I went to the exam without having studied." },
          { question: "What form follows 'you'd better'?",
            answer: "Infinitive without to: You'd better see a doctor." },
          { question: "What's a passive gerund? Give an example.",
            answer: "Verb + being + past participle: I enjoy being read to." },
          { question: "Complete: 'It's no use ___' — what form?",
            answer: "Gerund: It's no use worrying about it." },
          { question: "Difference: 'I'd like to wake up' vs 'I'd like to be woken up'?",
            answer: "Active vs passive. Second = by alarm or another person." },
          { question: "Use 'to have slept' in a sentence.",
            answer: "e.g. I'm glad to have slept for eight hours." }
        ]
      }
    },

    // ── Module demo ────────────────────────────────────────────
    {
      label: "Hot Seat + Timer + Scoreboard + Teams",
      type: "hot-seat",
      modules: ["scoreboard", "timer", "teams"],
      content: {
        words: [
          "distracted", "soothed", "irritated", "segmented",
          "attribute", "dwindled", "ubiquitous", "insomnia",
          "catastrophic", "conscious"
        ],
        time: 60,
        teams: ["Team A", "Team B"]
      }
    }

  ]
};
