window.LESSON = {
  title: "Unit 1 — Present Continuous",
  mode: "selector",
  slides: [

    // ── Title ─────────────────────────────────────────────────
    {
      type: "title-card",
      content: {
        unit: "Unit 1",
        heading: "Present Continuous",
        subheading: "Actions now · Temporary situations · Changes in progress"
      }
    },

    // ── Grammar Reference ─────────────────────────────────────
    {
      label: "Reference — Present Continuous",
      type: "reveal-card",
      content: {
        heading: "Present Continuous",
        items: [
          { label: "Form", example: "am / is / are + verb-ing" },
          { label: "Now", example: "She is answering an email right now." },
          { label: "Around now", example: "He is studying English this year." },
          { label: "Temporary", example: "They are living in a hotel this week." },
          { label: "Change", example: "The weather is getting colder." },
          { label: "Negative", example: "I am not listening to music." }
        ]
      }
    },

    // ── Picture Choice ────────────────────────────────────────
    {
      label: "Picture Choice — What's Happening?",
      type: "picture-choice",
      content: {
        questions: [
          {
            image: { src: "assets/images/lessons/unit-1-present-continuous-actions.png", col: 0, row: 0, cols: 3, rows: 2, alt: "A woman taking a picture" },
            prompt: "Choose the best sentence.",
            options: ["She is taking a picture.", "She is tying her shoelace.", "She takes a picture every day.", "She is hiding behind a tree."],
            answer: 0,
            explanation: "Correct: She is taking a picture."
          },
          {
            image: { src: "assets/images/lessons/unit-1-present-continuous-actions.png", col: 1, row: 0, cols: 3, rows: 2, alt: "A man tying his shoelace" },
            prompt: "Choose the best sentence.",
            options: ["He ties his shoelace every morning.", "He is tying his shoelace.", "He is scratching his head.", "He is crossing the road."],
            answer: 1,
            explanation: "Correct: He is tying his shoelace."
          },
          {
            image: { src: "assets/images/lessons/unit-1-present-continuous-actions.png", col: 2, row: 0, cols: 3, rows: 2, alt: "A woman crossing the road" },
            prompt: "Choose the best sentence.",
            options: ["She is waving to a friend.", "She crosses the road on Mondays.", "She is crossing the road.", "She is taking a picture."],
            answer: 2,
            explanation: "Correct: She is crossing the road."
          },
          {
            image: { src: "assets/images/lessons/unit-1-present-continuous-actions.png", col: 0, row: 1, cols: 3, rows: 2, alt: "A man scratching his head" },
            prompt: "Choose the best sentence.",
            options: ["He is hiding behind a tree.", "He is tying his shoelace.", "He scratches his head every day.", "He is scratching his head."],
            answer: 3,
            explanation: "Correct: He is scratching his head."
          },
          {
            image: { src: "assets/images/lessons/unit-1-present-continuous-actions.png", col: 1, row: 1, cols: 3, rows: 2, alt: "A child hiding behind a tree" },
            prompt: "Choose the best sentence.",
            options: ["The child is hiding behind a tree.", "The child is waving to a friend.", "The child hides behind a tree every day.", "The child is taking a picture."],
            answer: 0,
            explanation: "Correct: The child is hiding behind a tree."
          },
          {
            image: { src: "assets/images/lessons/unit-1-present-continuous-actions.png", col: 2, row: 1, cols: 3, rows: 2, alt: "A person waving to a friend" },
            prompt: "Choose the best sentence.",
            options: ["She is crossing the road.", "She is waving to a friend.", "She waves to a friend every morning.", "She is scratching her head."],
            answer: 1,
            explanation: "Correct: She is waving to a friend."
          }
        ]
      }
    },

    // ── Gap Fill ──────────────────────────────────────────────
    {
      label: "Gap Fill — Present Continuous",
      type: "fill-blank",
      content: {
        mode: "multiple-choice",
        questions: [
          { sentence: "I [am trying] to finish this exercise.", note: "I + am + verb-ing", options: ["am trying", "try", "am try", "trying"] },
          { sentence: "She [is talking] to the teacher at the moment.", note: "she + is + verb-ing", options: ["is talking", "talks", "are talking", "is talk"] },
          { sentence: "We [are learning] a new grammar point this week.", note: "we + are + verb-ing", options: ["are learning", "learn", "is learning", "are learn"] },
          { sentence: "The situation [is getting] better.", note: "change in progress", options: ["is getting", "gets", "are getting", "getting"] },
          { sentence: "They [are not listening] to the instructions.", note: "negative form", options: ["are not listening", "do not listening", "are not listen", "not listening"] },
          { sentence: "[Are] you enjoying the course?", note: "question form", options: ["Are", "Do", "Is", "Have"] },
          { sentence: "He [is staying] with friends until Monday.", note: "temporary situation", options: ["is staying", "stays", "are staying", "is stay"] },
          { sentence: "Prices [are increasing] in many cities.", note: "change in progress", options: ["are increasing", "increase", "is increasing", "are increase"] }
        ]
      }
    },

    // ── Meaning Pairs ─────────────────────────────────────────
    {
      label: "Meaning Pairs — Now or Usually?",
      type: "meaning-pair",
      content: {
        pairs: [
          {
            a: "She works in a restaurant.",
            b: "She is working in a restaurant this week.",
            note: "A is a regular job or fact. B is a temporary situation around now."
          },
          {
            a: "He is studying right now.",
            b: "He studies every evening.",
            note: "A is happening now. B is a routine."
          },
          {
            a: "The company is growing.",
            b: "The company grows vegetables.",
            note: "A describes a change in progress. B describes what the company does."
          },
          {
            a: "They are not speaking to each other.",
            b: "They do not speak Spanish.",
            note: "A describes current behaviour. B describes ability or general fact."
          }
        ]
      }
    },

    // ── Sentence Complete ─────────────────────────────────────
    {
      label: "Sentence Complete — Speaking Practice",
      type: "sentence-complete",
      content: {
        stems: [
          { stem: "Right now, I am...", hint: "say what you are doing", answer: "Right now, I am sitting in class and practising English." },
          { stem: "This week, we are...", hint: "current period", answer: "This week, we are learning the present continuous." },
          { stem: "My English is...", hint: "change in progress", answer: "My English is getting better." },
          { stem: "The teacher is not...", hint: "negative form", answer: "The teacher is not writing on the board." },
          { stem: "Are you...?", hint: "question form", answer: "Are you enjoying the lesson?" },
          { stem: "Someone in this room is...", hint: "describe a visible action", answer: "Someone in this room is wearing a black jacket." }
        ]
      }
    },

    // ── True / False ──────────────────────────────────────────
    {
      label: "True / False — Rules",
      type: "true-false",
      content: {
        questions: [
          { statement: "We form the present continuous with am, is, or are plus verb-ing.", answer: true, explanation: "Example: I am working, she is studying, they are waiting." },
          { statement: "The present continuous is only for actions happening this exact second.", answer: false, explanation: "It can also describe things happening around now, such as this week or this year." },
          { statement: "We can use the present continuous for temporary situations.", answer: true, explanation: "Example: I am staying with friends this week." },
          { statement: "She are working is a correct sentence.", answer: false, explanation: "Use is with she: She is working." },
          { statement: "Getting better and becoming easier can describe changes in progress.", answer: true, explanation: "These expressions often use the present continuous." },
          { statement: "At the moment is a useful time phrase for present continuous.", answer: true, explanation: "It means now." }
        ]
      }
    },

    // ── Hot Seat ──────────────────────────────────────────────
    {
      label: "Hot Seat — Present Continuous Words",
      type: "hot-seat",
      modules: ["scoreboard", "timer", "teams"],
      content: {
        words: ["HAPPENING NOW", "IN PROGRESS", "TEMPORARY", "AT THE MOMENT", "THESE DAYS", "CURRENTLY", "CHANGE", "IMPROVE", "INCREASE", "DECREASE"],
        time: 60
      }
    },

    // ── Noughts & Crosses ─────────────────────────────────────
    {
      label: "Noughts & Crosses — Review",
      type: "noughts-crosses",
      content: {
        teams: ["Team X", "Team O"],
        cells: [
          { question: "Complete: I ___ trying to work.", answer: "am — I am trying to work." },
          { question: "Correct this: She are studying.", answer: "She is studying." },
          { question: "Make a question with 'you / listen'.", answer: "Are you listening?" },
          { question: "Which is temporary: 'He lives in Rome' or 'He is living in Rome this month'?", answer: "He is living in Rome this month." },
          { question: "Give one time phrase for present continuous.", answer: "Now, right now, at the moment, this week, these days." },
          { question: "Complete: The weather ___ changing.", answer: "is — The weather is changing." },
          { question: "Make a negative sentence with 'they / speak'.", answer: "They are not speaking." },
          { question: "What does 'in progress' mean?", answer: "Started but not finished." },
          { question: "Give a sentence about something happening in this room now.", answer: "Example: The teacher is speaking." }
        ]
      }
    },

    // ── Millionaire ───────────────────────────────────────────
    {
      label: "Millionaire — Present Continuous",
      type: "millionaire",
      content: {
        questions: [
          {
            question: "Which sentence is correct?",
            options: ["She is drive to work.", "She driving to work.", "She is driving to work.", "She drives to work now."],
            answer: 2
          },
          {
            question: "Choose the correct negative sentence.",
            options: ["I not listening.", "I am not listening.", "I do not listening.", "I am not listen."],
            answer: 1
          },
          {
            question: "Which sentence talks about a temporary situation?",
            options: ["She works in a bank every day.", "She is working in a cafe this week.", "Water boils at 100 degrees.", "I usually walk to work."],
            answer: 1
          },
          {
            question: "Choose the best question.",
            options: ["What you are doing?", "What are you doing?", "What do you doing?", "What are you do?"],
            answer: 1
          },
          {
            question: "Which sentence describes a change in progress?",
            options: ["Prices are increasing.", "Prices increase every year.", "Prices increased last month.", "Prices have increased recently."],
            answer: 0
          },
          {
            question: "Choose the correct form: They _____ lunch at the moment.",
            options: ["have", "are having", "is having", "having"],
            answer: 1
          },
          {
            question: "Which time phrase often goes with the present continuous?",
            options: ["every Monday", "last night", "at the moment", "in 2018"],
            answer: 2
          },
          {
            question: "Choose the correct sentence.",
            options: ["The weather is changing.", "The weather changing.", "The weather are changing.", "The weather changes now."],
            answer: 0
          },
          {
            question: "Which sentence means the action is not finished?",
            options: ["I finished the report.", "I am writing the report.", "I write reports every Friday.", "I wrote the report yesterday."],
            answer: 1
          },
          {
            question: "Choose the correct question: _____ English this year?",
            options: ["Are you study", "Do you studying", "Are you studying", "You are studying"],
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
      label: "Jeopardy — Present Continuous",
      type: "jeopardy",
      modules: ["scoreboard", "teams"],
      content: {
        teams: ["Team A", "Team B"],
        categories: [
          {
            name: "Form",
            questions: [
              { value: 200, question: "What three helping verbs do we use in the present continuous?", answer: "Am, is, and are." },
              { value: 400, question: "Complete: I ___ working.", answer: "I am working." },
              { value: 600, question: "Correct this: She are studying.", answer: "She is studying." },
              { value: 800, question: "Make a present continuous question with 'you / listen'.", answer: "Are you listening?" }
            ]
          },
          {
            name: "Use",
            questions: [
              { value: 200, question: "Do we use present continuous for actions happening now or finished past actions?", answer: "Actions happening now." },
              { value: 400, question: "Give one sentence about something happening in the classroom now.", answer: "Example: The teacher is speaking." },
              { value: 600, question: "What kind of situation is this: I am living with my aunt this month?", answer: "A temporary situation." },
              { value: 800, question: "Why is this present continuous: My English is improving?", answer: "It describes a change in progress." }
            ]
          },
          {
            name: "Time Words",
            questions: [
              { value: 200, question: "Name one time phrase that means now.", answer: "Now / right now / at the moment." },
              { value: 400, question: "Which fits better: I am studying English ___ year.", answer: "This year." },
              { value: 600, question: "Does 'every Monday' usually fit present continuous or present simple?", answer: "Present simple." },
              { value: 800, question: "Make a sentence with 'these days'.", answer: "Example: I am learning a lot these days." }
            ]
          },
          {
            name: "Fix It",
            questions: [
              { value: 200, question: "Fix it: They is waiting.", answer: "They are waiting." },
              { value: 400, question: "Fix it: I am not listen.", answer: "I am not listening." },
              { value: 600, question: "Fix it: Are she working today?", answer: "Is she working today?" },
              { value: 800, question: "Fix it: What you are doing?", answer: "What are you doing?" }
            ]
          }
        ]
      }
    },

    // ── Anagram ───────────────────────────────────────────────
    {
      label: "Anagram — Key Words",
      type: "anagram",
      content: {
        words: [
          { scrambled: "PHANEPNIG", answer: "HAPPENING", hint: "taking place now" },
          { scrambled: "SROGSPER", answer: "PROGRESS", hint: "movement forward or continuing action" },
          { scrambled: "PMTROEARY", answer: "TEMPORARY", hint: "not permanent" },
          { scrambled: "RENTCUR", answer: "CURRENT", hint: "happening now" },
          { scrambled: "NACHGE", answer: "CHANGE", hint: "become different" },
          { scrambled: "IMRVOPE", answer: "IMPROVE", hint: "get better" },
          { scrambled: "NERISCAE", answer: "INCREASE", hint: "go up" },
          { scrambled: "DEERCSEA", answer: "DECREASE", hint: "go down" }
        ]
      }
    },

    // ── Call My Bluff ─────────────────────────────────────────
    {
      label: "Call My Bluff — Grammar Words",
      type: "call-my-bluff",
      content: {
        items: [
          {
            word: "TEMPORARY",
            definitions: ["true forever", "not permanent; lasting for a limited time", "finished before the lesson started"],
            answer: 1
          },
          {
            word: "IN PROGRESS",
            definitions: ["started and still continuing", "planned but not started", "repeated every Monday"],
            answer: 0
          },
          {
            word: "CURRENTLY",
            definitions: ["a long time ago", "only after the weekend", "at the present time"],
            answer: 2
          },
          {
            word: "IMPROVE",
            definitions: ["to become louder", "to become better", "to copy a sentence exactly"],
            answer: 1
          }
        ]
      }
    },

    // ── Odd One Out ───────────────────────────────────────────
    {
      label: "Odd One Out — Grammar Groups",
      type: "odd-one-out",
      content: {
        items: [
          {
            words: ["now", "at the moment", "right now", "every day"],
            odd: "every day",
            reason: "The first three point to now. Every day usually points to a routine."
          },
          {
            words: ["am working", "is studying", "are waiting", "works"],
            odd: "works",
            reason: "The first three are present continuous forms. Works is present simple."
          },
          {
            words: ["getting", "becoming", "improving", "yesterday"],
            odd: "yesterday",
            reason: "The first three can describe changes in progress. Yesterday is a past time word."
          },
          {
            words: ["temporary", "current", "in progress", "permanent"],
            odd: "permanent",
            reason: "The first three connect to present continuous use. Permanent means lasting for a long time."
          }
        ]
      }
    },

    // ── Missing Vowels ────────────────────────────────────────
    {
      label: "Missing Vowels — Key Words",
      type: "missing-vowels",
      content: {
        items: [
          { display: "HPPNNG", answer: "HAPPENING", hint: "taking place now" },
          { display: "PRGRSS", answer: "PROGRESS", hint: "movement forward or continuing action" },
          { display: "TMPRRY", answer: "TEMPORARY", hint: "not permanent" },
          { display: "CRRNTLY", answer: "CURRENTLY", hint: "at the present time" },
          { display: "CHNG", answer: "CHANGE", hint: "become different" },
          { display: "MPRV", answer: "IMPROVE", hint: "get better" },
          { display: "NCRS", answer: "INCREASE", hint: "go up" },
          { display: "DCRS", answer: "DECREASE", hint: "go down" }
        ]
      }
    },

    // ── Scenario Cards ────────────────────────────────────────
    {
      label: "Scenario Cards — Choose the Tense",
      type: "scenario-cards",
      content: {
        cards: [
          {
            title: "The Phone Call",
            scenario: "Your friend calls and asks, 'Can you talk?' You are in the middle of dinner.",
            verdict: "Use present continuous",
            verdictStyle: "success",
            reveal: "Say: I am having dinner right now. The action is happening now.",
            details: ["am + verb-ing", "right now", "not finished"],
            hook: "What else could you say if you are busy now?"
          },
          {
            title: "The Temporary Job",
            scenario: "Your usual job is in an office, but this week you are helping in a cafe.",
            verdict: "Use present continuous",
            verdictStyle: "success",
            reveal: "Say: I am working in a cafe this week. It is temporary.",
            details: ["is + verb-ing", "this week", "temporary situation"],
            hook: "What temporary thing are you doing these days?"
          },
          {
            title: "The Daily Routine",
            scenario: "You want to explain that you drink coffee every morning.",
            verdict: "Use present simple",
            verdictStyle: "warning",
            reveal: "Say: I drink coffee every morning. This is a routine, not an action in progress.",
            details: ["every morning", "habit", "present simple"],
            hook: "Give one routine sentence about your morning."
          },
          {
            title: "The Improving Skill",
            scenario: "Your speaking was difficult before, but now it is becoming better.",
            verdict: "Use present continuous",
            verdictStyle: "success",
            reveal: "Say: My speaking is improving. This describes a change in progress.",
            details: ["is + verb-ing", "change", "getting better"],
            hook: "What skill is improving for you?"
          },
          {
            title: "The Permanent Home",
            scenario: "Your parents have lived in the same city for many years and it is their normal home.",
            verdict: "Use present simple",
            verdictStyle: "warning",
            reveal: "Say: My parents live in Madrid. This is a permanent situation.",
            details: ["permanent", "general fact", "present simple"],
            hook: "How is this different from 'They are living in Madrid this month'?"
          },
          {
            title: "The Noisy Class",
            scenario: "You hear a lot of noise outside the room and want to ask about it.",
            verdict: "Use present continuous",
            verdictStyle: "success",
            reveal: "Ask: What is happening? The noise is happening now.",
            details: ["question form", "is + subject + verb-ing", "now"],
            hook: "Make two more questions about things happening now."
          }
        ]
      }
    },

    // ── Fluency Tree ──────────────────────────────────────────
    {
      label: "Fluency Tree — What Are You Doing These Days?",
      type: "fluency-tree",
      content: {
        title: "What Are You Doing These Days?",
        start: "n1",
        nodes: {
          n1: {
            speaker: "A",
            options: [
              { text: "What are you working on these days?", next: "n2-work" },
              { text: "Are you studying anything interesting at the moment?", next: "n2-study" },
              { text: "How is your English changing these days?", next: "n2-change" }
            ]
          },
          "n2-work": {
            speaker: "B",
            options: [
              { text: "I am preparing a presentation for work.", next: "n3-follow" },
              { text: "I am helping a colleague with a difficult project.", next: "n3-follow" }
            ]
          },
          "n2-study": {
            speaker: "B",
            options: [
              { text: "I am learning how to speak more naturally.", next: "n3-follow" },
              { text: "I am practising grammar because I make small mistakes.", next: "n3-follow" }
            ]
          },
          "n2-change": {
            speaker: "B",
            options: [
              { text: "My listening is getting better, but speaking is still hard.", next: "n3-follow" },
              { text: "I am becoming more confident in meetings.", next: "n3-follow" }
            ]
          },
          "n3-follow": {
            speaker: "A",
            options: [
              { text: "That sounds useful. Are you enjoying it?", next: "n4-enjoy" },
              { text: "What is the most difficult part right now?", next: "n4-difficult" },
              { text: "Why are you focusing on that at the moment?", next: "n4-reason" }
            ]
          },
          "n4-enjoy": {
            speaker: "B",
            options: [
              { text: "Yes, I am enjoying it because I can see progress.", next: "n5-close" },
              { text: "Not always, but I am trying to stay motivated.", next: "n5-close" }
            ]
          },
          "n4-difficult": {
            speaker: "B",
            options: [
              { text: "I am finding the speed difficult.", next: "n5-close" },
              { text: "I am struggling with confidence when I speak.", next: "n5-close" }
            ]
          },
          "n4-reason": {
            speaker: "B",
            options: [
              { text: "Because I am using English more at work now.", next: "n5-close" },
              { text: "Because I am planning to travel soon.", next: "n5-close" }
            ]
          },
          "n5-close": {
            speaker: "A",
            options: [
              { text: "Good luck. It sounds like you are making progress.", next: null },
              { text: "Keep going. You are improving little by little.", next: null }
            ]
          }
        }
      }
    }

  ]
};
