window.LESSON = {
  title: "Negotiation Skills",
  mode: "selector",
  slides: [

    // ── Title ─────────────────────────────────────────────────
    {
      type: "title-card",
      content: {
        unit: "",
        heading: "Negotiation Skills",
        subheading: "Finding Solutions That Work for Everyone"
      }
    },

    // ── Vocabulary Reference ──────────────────────────────────
    {
      label: "5 Key Negotiation Moves",
      type: "reveal-card",
      content: {
        heading: "How to Negotiate",
        items: [
          { label: "Propose",          example: '"What if we...?" / "How about we try...?"' },
          { label: "Counter",          example: '"I understand, but..." / "That\'s fair, however..."' },
          { label: "Compromise",       example: '"We could meet halfway." / "What if we take turns?"' },
          { label: "Accept",           example: '"That works for me." / "I think we can make that work."' },
          { label: "Decline politely", example: '"That doesn\'t quite work because..." / "I\'m not sure about that, but what if...?"' }
        ]
      }
    },

    // ── Gap Fill ──────────────────────────────────────────────
    {
      label: "Gap Fill — Negotiation Vocab",
      type: "fill-blank",
      content: {
        questions: [
          { sentence: "A good negotiator always [listens] carefully to the other side before responding.", note: "key skill" },
          { sentence: "When you [compromise], both sides give up something in order to gain something.", note: "give and take" },
          { sentence: "Offering an [incentive] — like help with setup — can persuade the other person to agree.", note: "a reward or exchange" },
          { sentence: "Finding a [solution] that works for both sides is the goal of any negotiation.", note: "the outcome" },
          { sentence: "When you make a [concession], you give up something to gain something else.", note: "giving something up" },
          { sentence: "A [mediator] is someone who helps two sides communicate and reach an agreement.", note: "a neutral third party" },
          { sentence: "It is important to [communicate] clearly and respectfully when negotiating.", note: "speaking and listening" }
        ]
      }
    },

    // ── Meaning Pairs ─────────────────────────────────────────
    {
      label: "Meaning Pairs — Negotiation Styles",
      type: "meaning-pair",
      content: {
        pairs: [
          {
            a: "I understand your point. What if we tried a different approach that works for both of us?",
            b: "My way or no way.",
            note: "A = empathetic proposal — opens dialogue  |  B = ultimatum — shuts it down immediately"
          },
          {
            a: "Could we split the cost evenly between everyone who comes?",
            b: "You're paying for everything. End of story.",
            note: "A = fair compromise  |  B = unreasonable demand — one builds agreement, one causes conflict"
          },
          {
            a: "What time works best for both of us? I'm flexible.",
            b: "The meeting is at 6pm. Be there.",
            note: "A = flexible proposal — invites cooperation  |  B = non-negotiable — no room for discussion"
          }
        ]
      }
    },

    // ── Sentence Complete ─────────────────────────────────────
    {
      label: "Sentence Complete — Role Plays",
      type: "sentence-complete",
      content: {
        stems: [
          { stem: "In the Chore Challenge, I could offer to...",                      hint: "swap / exchange",       answer: "swap chores / do something they want in return for help with mine" },
          { stem: "If friends disagree on which game to play, a compromise could be...", hint: "take turns / include", answer: "take turns choosing / include everyone's preferences by rotating" },
          { stem: "When planning a party with a limited budget, a fair solution might be...", hint: "split / share",  answer: "split the cost evenly / cover expenses in exchange for help with setup or cleanup" },
          { stem: "If a study group meets at a time that doesn't work for me, I could suggest...", hint: "alternative time / virtual", answer: "a different meeting time / meeting virtually online" },
          { stem: "A good way to start a negotiation is to say...",                   hint: "open question / proposal", answer: '"What if we...?" / "How about...?" / "I understand, but what if...?"' },
          { stem: "If the other person doesn't agree with my proposal, I would...",   hint: "listen / counter",      answer: "listen to their concerns and offer a counter-proposal / find a compromise" }
        ]
      }
    },

    // ── True / False ──────────────────────────────────────────
    {
      label: "True / False — Negotiation",
      type: "true-false",
      content: {
        questions: [
          { statement: "A good negotiator always gets exactly what they want.", answer: false, explanation: "Negotiation involves compromise — both sides usually give something up to reach an agreement." },
          { statement: "Listening carefully is an important negotiation skill.",  answer: true,  explanation: "Understanding the other side's needs helps you find a solution that works for everyone." },
          { statement: "A compromise means both sides give up something.",        answer: true,  explanation: "True compromise involves both parties adjusting their position — it's not one person winning." },
          { statement: "You should make an ultimatum at the very start of a negotiation.", answer: false, explanation: "Ultimatums shut down dialogue. Start with open proposals: 'What if we...?'" },
          { statement: "Negotiation skills are only useful in business situations.", answer: false, explanation: "The handout shows negotiations in everyday life: chores, parties, cars, study groups, sleepovers." },
          { statement: "Offering an incentive can help you reach an agreement.",  answer: true,  explanation: "e.g. 'I'll cover the cost if you help with setup' — an incentive gives the other person a reason to agree." }
        ]
      }
    },

    // ── Hot Seat ──────────────────────────────────────────────
    {
      label: "Hot Seat — Negotiation Vocabulary",
      type: "hot-seat",
      content: {
        words: ["Negotiate", "Compromise", "Incentive", "Concession", "Agreement", "Mediator", "Persuade", "Proposal", "Conflict", "Resolution", "Delegate", "Offer"],
        time: 60
      }
    },

    // ── Noughts & Crosses ─────────────────────────────────────
    {
      label: "Noughts & Crosses — Negotiation",
      type: "noughts-crosses",
      content: {
        teams: ["Team X", "Team O"],
        cells: [
          { question: "What does 'compromise' mean?",                              answer: "Both sides give up something to reach an agreement that works for everyone." },
          { question: "Give an example of an incentive from the handout.",         answer: "Offering treats for completing tasks / covering expenses in exchange for help with setup." },
          { question: "What is a mediator?",                                       answer: "Someone who helps two sides communicate and reach an agreement." },
          { question: "True or False: Good negotiators always get everything they want.", answer: "False — negotiation involves compromise from both sides." },
          { question: "In the Sleepover Struggle, name one negotiation strategy.", answer: "Limit the number of guests / offer a friend's house with more space." },
          { question: "What does 'concession' mean?",                              answer: "Giving up something in a negotiation in order to gain something else." },
          { question: "Name one scenario from the Negotiation handout.",           answer: "Chore Challenge / Game Night / Party Planning / Sleepover / Group Project / Study Group / Car Borrowing." },
          { question: "What is the goal of negotiation?",                          answer: "Finding a solution that works for both sides." },
          { question: "Give an example of a polite negotiation opener.",           answer: '"What if we...?" / "How about...?" / "I understand, but what if...?"' }
        ]
      }
    },

    // ── Millionaire ───────────────────────────────────────────
    {
      label: "Millionaire — Negotiation",
      type: "millionaire",
      content: {
        questions: [
          {
            question: "What does 'negotiate' mean?",
            options: ["To argue loudly until someone agrees", "To work with another person to find a solution", "To demand what you want", "To ignore a problem and move on"],
            answer: 1
          },
          {
            question: "What is a compromise?",
            options: ["Getting everything you want", "Giving up nothing and standing firm", "Both sides give something to reach an agreement", "Letting the other person win"],
            answer: 2
          },
          {
            question: "In the Chore Challenge, what is one thing you could offer?",
            options: ["Nothing — just demand help", "Swap chores or do something they want in exchange", "Refuse to negotiate", "Ask a teacher to decide for you"],
            answer: 1
          },
          {
            question: "What does a mediator do?",
            options: ["Takes one person's side", "Ends the negotiation immediately", "Helps two sides communicate and reach an agreement", "Makes all the decisions for both parties"],
            answer: 2
          },
          {
            question: "Which is the best negotiation opener?",
            options: ["'My way or no way'", "'What if we...?'", "'You have to do it'", "'I'm not talking about this'"],
            answer: 1
          },
          {
            question: "What is a 'concession'?",
            options: ["A written agreement signed by both sides", "Giving up something in order to gain something else", "Winning an argument convincingly", "Refusing to negotiate at all"],
            answer: 1
          },
          {
            question: "Which scenario from the handout involves negotiating a time conflict?",
            options: ["The Chore Challenge", "The Party Planning Problem", "The Study Group Struggle", "The Game Night Debate"],
            answer: 2
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
      label: "Jeopardy — Negotiation",
      type: "jeopardy",
      content: {
        categories: [
          {
            name: "Negotiation Vocab",
            questions: [
              { value: 200, question: "What does 'negotiate' mean?",          answer: "To work with another person to find a solution that works for both sides." },
              { value: 400, question: "What is an 'incentive'?",              answer: "Something offered to persuade someone to agree — e.g. a reward or exchange." },
              { value: 600, question: "What is a 'concession'?",              answer: "Giving up something in a negotiation in order to gain something else." },
              { value: 800, question: "What's the difference between a 'proposal' and an 'ultimatum'?", answer: "A proposal opens dialogue ('What if we...?') — an ultimatum closes it ('My way or no way')." }
            ]
          },
          {
            name: "Role Play Scenarios",
            questions: [
              { value: 200, question: "Which scenario involves two siblings sharing a family car?",           answer: "The Car Borrowing Battle." },
              { value: 400, question: "In the Party Planning Problem, why is negotiation needed?",            answer: "Some friends are unwilling to contribute financially to the party." },
              { value: 600, question: "What must the Group Project team do to ensure equal participation?",   answer: "Assign specific roles and responsibilities / offer incentives for completing tasks." },
              { value: 800, question: "Name TWO negotiation strategies from the Sleepover Struggle.",        answer: "Limit the number of guests / offer to move the sleepover to a house with more space." }
            ]
          },
          {
            name: "What Would You Say?",
            questions: [
              { value: 200, question: "How would you politely start a negotiation?",                   answer: '"What if we...?" / "How about...?" / "I understand, but what if...?"' },
              { value: 400, question: "How would you respond to an unreasonable demand?",              answer: '"I understand your point. What if we tried a different approach that works for both of us?"' },
              { value: 600, question: "How would you suggest sharing a party cost fairly?",            answer: '"Could we split the cost evenly between everyone who comes?"' },
              { value: 800, question: "How would you handle a scheduling conflict in a study group?",  answer: '"What if we found a time that works for everyone, or met virtually?"' }
            ]
          },
          {
            name: "True or False",
            questions: [
              { value: 200, question: "Good negotiators always get exactly what they want. True or False?",           answer: "False — negotiation involves compromise from both sides." },
              { value: 400, question: "Offering an incentive can help reach an agreement. True or False?",            answer: "True — e.g. 'I'll help with setup if you cover the cost.'" },
              { value: 600, question: "Ultimatums are a good way to start a negotiation. True or False?",            answer: "False — they shut down dialogue. Always start with open proposals." },
              { value: 800, question: "Negotiation skills are only useful in professional business settings. True or False?", answer: "False — the handout shows them in everyday life: chores, parties, cars, school." }
            ]
          }
        ]
      }
    },

    // ── Anagram ───────────────────────────────────────────────
    {
      label: "Anagram — Negotiation Words",
      type: "anagram",
      content: {
        words: [
          { scrambled: "NGOTIAETE",   answer: "NEGOTIATE",   hint: "Finding a solution with another person" },
          { scrambled: "MCPOOSMIRE",  answer: "COMPROMISE",  hint: "Both sides give something up" },
          { scrambled: "EITNCIVEN",   answer: "INCENTIVE",   hint: "Something offered to persuade" },
          { scrambled: "AIODTMRE",    answer: "MEDIATOR",    hint: "A neutral person who helps two sides agree" },
          { scrambled: "NOISENCOCS",  answer: "CONCESSION",  hint: "Giving up something to gain something else" },
          { scrambled: "EAMNERGTE",   answer: "AGREEMENT",   hint: "When both sides are satisfied with the outcome" }
        ]
      }
    },

    // ── Call My Bluff ─────────────────────────────────────────
    {
      label: "Call My Bluff — Negotiation",
      type: "call-my-bluff",
      content: {
        items: [
          {
            word: "CONCESSION",
            definitions: [
              "A small shop or stall found inside a sports stadium or cinema",
              "Giving up something in a negotiation in order to gain something else",
              "A formal written contract signed by both parties at the end of a deal"
            ],
            answer: 1
          },
          {
            word: "MEDIATOR",
            definitions: [
              "A type of herbal medicine used to reduce stress during conflict",
              "A person who helps two sides communicate and reach an agreement",
              "Someone who studies the influence of media on public opinion"
            ],
            answer: 1
          },
          {
            word: "INCENTIVE",
            definitions: [
              "A rare French perfume made from flowers and spices",
              "A punishment given for breaking the rules of an agreement",
              "Something offered to persuade someone to do something or agree"
            ],
            answer: 2
          },
          {
            word: "ULTIMATUM",
            definitions: [
              "The final stage of a scientific experiment before publishing results",
              "A last demand where failure to comply leads to serious consequences",
              "A polite negotiation technique used in international business meetings"
            ],
            answer: 1
          }
        ]
      }
    },

    // ── Odd One Out ───────────────────────────────────────────
    {
      label: "Odd One Out — Negotiation",
      type: "odd-one-out",
      content: {
        items: [
          {
            words: ["Negotiate", "Compromise", "Agree", "Demand"],
            odd: "Demand",
            reason: '"Demand" means insisting on something without flexibility — the others all involve finding mutual solutions'
          },
          {
            words: ["Listen", "Empathise", "Propose", "Interrupt"],
            odd: "Interrupt",
            reason: '"Interrupt" is a bad negotiation habit — the others are all positive negotiation skills'
          },
          {
            words: ["Compromise", "Solution", "Agreement", "Conflict"],
            odd: "Conflict",
            reason: '"Conflict" is the problem you\'re trying to solve — the others are all positive outcomes of negotiation'
          },
          {
            words: ["Chore Challenge", "Game Night Debate", "Sleepover Struggle", "Science Experiment"],
            odd: "Science Experiment",
            reason: "The others are all real scenarios from the Negotiation handout — Science Experiment is not"
          }
        ]
      }
    },

    // ── Missing Vowels ────────────────────────────────────────
    {
      label: "Missing Vowels — Negotiation",
      type: "missing-vowels",
      content: {
        items: [
          { display: "NGTT",    answer: "NEGOTIATE",   hint: "Finding a solution with another person" },
          { display: "CMPRMS",  answer: "COMPROMISE",  hint: "Both sides give something up" },
          { display: "NCNTV",   answer: "INCENTIVE",   hint: "Something offered to persuade" },
          { display: "MDTR",    answer: "MEDIATOR",    hint: "A neutral person who helps two sides agree" },
          { display: "CNCSN",   answer: "CONCESSION",  hint: "Giving up something to gain something else" },
          { display: "GRMNT",   answer: "AGREEMENT",   hint: "When both sides are satisfied" },
          { display: "PRPSL",   answer: "PROPOSAL",    hint: "An idea put forward in a negotiation" }
        ]
      }
    }

  ]
};
