window.TOPIC_PACK = {
  id: 'present-simple',
  title: 'Present Simple',
  category: 'grammar',
  level: 'A2-B1',
  tags: ['grammar', 'core tense'],
  vocabulary: [
    {
      term: 'habit',
      hint: 'something you do regularly',
      definition: 'something you do often or regularly',
      bluffs: ['a plan for one special day only', 'a mistake in spelling'],
    },
    {
      term: 'routine',
      hint: 'the usual order of things you do',
      definition: 'the usual series of actions you do every day or every week',
      bluffs: ['a sudden surprise at work', 'a question about the past'],
    },
    {
      term: 'usually',
      hint: 'most of the time',
      definition: 'in most situations or on most occasions',
      bluffs: ['never at any time', 'only in the future'],
    },
    {
      term: 'always',
      hint: 'every time',
      definition: 'on every occasion, without exception',
      bluffs: ['for one short time only', 'in a quiet voice'],
    },
    {
      term: 'sometimes',
      hint: 'not always, but on some occasions',
      definition: 'on some occasions but not all',
      bluffs: ['in alphabetical order', 'very quickly'],
    },
    {
      term: 'never',
      hint: 'at no time',
      definition: 'not at any time',
      bluffs: ['every single day', 'after a long delay'],
    },
    {
      term: 'schedule',
      hint: 'a plan of times and activities',
      definition: 'a plan showing times for events or activities',
      bluffs: ['a person who checks homework', 'a kind of office chair'],
    },
    {
      term: 'fact',
      hint: 'something that is true',
      definition: 'a statement that is true and can be checked',
      bluffs: ['a form used for job interviews', 'a guess with no meaning'],
    },
  ],
  examples: [
    { sentence: 'I drink coffee every morning.', focus: 'daily routine' },
    { sentence: 'She works in a bank.', focus: 'third person singular' },
    { sentence: 'They do not watch TV at lunch.', focus: 'negative form' },
    { sentence: 'Water boils at 100 degrees Celsius.', focus: 'general truth' },
  ],
  revealItems: [
    { label: 'Use', example: 'Use the present simple for habits, routines, and general truths.' },
    { label: 'Affirmative', example: 'I work / You work / He works / She works / They work.' },
    { label: 'Negative', example: 'I do not work / He does not work.' },
    { label: 'Questions', example: 'Do you work here? / Does she work here?' },
    { label: 'Time words', example: 'often, usually, sometimes, never, every day' },
  ],
  questions: {
    multipleChoice: [
      {
        question: 'Which sentence is correct?',
        options: ['She work in a bank.', 'She works in a bank.', 'She is work in a bank.', 'She working in a bank.'],
        answer: 1,
        explanation: 'Use -s with third person singular.',
      },
      {
        question: 'Which sentence talks about a routine?',
        options: ['I am eating lunch now.', 'I eat lunch at 12 every day.', 'I ate lunch at 12 yesterday.', 'I have eaten lunch already.'],
        answer: 1,
        explanation: 'Present simple often describes repeated habits.',
      },
      {
        question: 'Choose the correct negative sentence.',
        options: ['He do not like coffee.', 'He does not like coffee.', 'He is not like coffee.', 'He not likes coffee.'],
        answer: 1,
        explanation: 'Use does not with he/she/it.',
      },
      {
        question: 'Which question is correct?',
        options: ['Do she live near here?', 'Does she lives near here?', 'Does she live near here?', 'Is she live near here?'],
        answer: 2,
        explanation: 'Use does + base verb.',
      },
      {
        question: 'Which sentence shows a general truth?',
        options: ['The sun rises in the east.', 'The sun is rising in the east now.', 'The sun rose in the east.', 'The sun has risen in the east.'],
        answer: 0,
        explanation: 'General truths often use the present simple.',
      },
      {
        question: 'Choose the best word: I _____ go to the gym on Mondays.',
        options: ['am', 'does', 'usually', 'did'],
        answer: 2,
        explanation: 'Usually is a frequency adverb used with routines.',
      },
      {
        question: 'Which sentence is correct?',
        options: ['They doesn’t play football.', 'They don’t play football.', 'They not play football.', 'They aren’t play football.'],
        answer: 1,
        explanation: 'Use don’t with they.',
      },
      {
        question: 'Choose the correct sentence.',
        options: ['My brother watch TV after dinner.', 'My brother watches TV after dinner.', 'My brother is watch TV after dinner.', 'My brother watched TV after dinner every day.'],
        answer: 1,
        explanation: 'Third person singular takes watches.',
      },
      {
        question: 'Which sentence is about now, not a routine?',
        options: ['I read before bed every night.', 'She usually walks to school.', 'We are studying now.', 'He drinks tea in the morning.'],
        answer: 2,
        explanation: 'Present continuous shows an action happening now.',
      },
      {
        question: 'Choose the correct word order.',
        options: ['I always am tired on Fridays.', 'I am tired always on Fridays.', 'I am always tired on Fridays.', 'Always I am tired on Fridays.'],
        answer: 2,
        explanation: 'Frequency adverbs usually go after be.',
      },
    ],
    trueFalse: [
      {
        statement: 'We usually use the present simple to talk about habits and routines.',
        answer: true,
        explanation: 'It is common for everyday actions and repeated behaviour.',
      },
      {
        statement: 'With he, she, and it, the main verb usually ends in -s or -es.',
        answer: true,
        explanation: 'Example: she works, he watches, it goes.',
      },
      {
        statement: 'We use does in questions with they.',
        answer: false,
        explanation: 'Use do with I, you, we, they.',
      },
      {
        statement: 'The present simple can describe general truths.',
        answer: true,
        explanation: 'Example: Water boils at 100 degrees Celsius.',
      },
      {
        statement: 'Never means every day.',
        answer: false,
        explanation: 'Never means at no time.',
      },
    ],
    openEnded: [
      {
        prompt: 'Talk about your morning routine.',
        hint: 'daily routine',
        answer: 'I get up at 7, make breakfast, and go to work.',
      },
      {
        prompt: 'Make a sentence about a general truth.',
        hint: 'fact',
        answer: 'Water boils at 100 degrees Celsius.',
      },
      {
        prompt: 'Ask your partner about their weekend habits.',
        hint: 'question form',
        answer: 'What do you usually do on Saturdays?',
      },
      {
        prompt: 'Make a negative sentence with he.',
        hint: 'doesn’t',
        answer: 'He doesn’t like noisy cafes.',
      },
      {
        prompt: 'Make a sentence with usually.',
        hint: 'frequency adverb',
        answer: 'She usually walks to school.',
      },
    ],
  },
  fillBlanks: [
    { sentence: 'I [wake up] at 7 o’clock every day.', note: 'daily routine', options: ['wake up', 'wakes up', 'woke up'] },
    { sentence: 'She [works] in a small office.', note: 'third person singular', options: ['work', 'works', 'working'] },
    { sentence: 'He [doesn\'t like] coffee.', note: 'negative form', options: ['doesn\'t like', 'don\'t like', 'isn\'t like'] },
    { sentence: 'We [play] football on Fridays.', note: 'habit', options: ['play', 'plays', 'played'] },
    { sentence: '[Do] they live near the school?', note: 'question form', options: ['Do', 'Does', 'Did'] },
    { sentence: 'My brother [watches] TV after dinner.', note: 'third person singular', options: ['watch', 'watches', 'watching'] },
  ],
  pairs: [
    {
      a: 'She works in a bank.',
      b: 'She is working in a bank.',
      note: 'A describes her usual job. B describes something happening around now.',
    },
    {
      a: 'He doesn’t like coffee.',
      b: 'He don’t like coffee.',
      note: 'A is correct. Use doesn’t with he/she/it.',
    },
    {
      a: 'Do they live near here?',
      b: 'Does they live near here?',
      note: 'Use do with they, not does.',
    },
    {
      a: 'I always arrive early.',
      b: 'I am always arrive early.',
      note: 'A is correct. Do not use am before the base verb here.',
    },
  ],
  oddOneOut: [
    {
      words: ['always', 'usually', 'sometimes', 'yesterday'],
      odd: 'yesterday',
      reason: 'The first three are common present simple frequency words. Yesterday usually goes with past time.',
    },
    {
      words: ['do', 'does', 'don’t', 'went'],
      odd: 'went',
      reason: 'The first three are present simple auxiliaries. Went is past simple.',
    },
    {
      words: ['routine', 'habit', 'schedule', 'lightning'],
      odd: 'lightning',
      reason: 'The first three relate to repeated daily patterns. Lightning does not.',
    },
    {
      words: ['works', 'plays', 'watches', 'did'],
      odd: 'did',
      reason: 'The first three are third person present simple verb forms. Did is past simple.',
    },
  ],
  jeopardyCategories: [
    {
      name: 'Use',
      questions: [
        { value: 200, question: 'What do we use the present simple for?', answer: 'Habits, routines, and general truths.' },
        { value: 400, question: 'Give one example of a general truth.', answer: 'Example: Water boils at 100 degrees Celsius.' },
        { value: 600, question: 'Which tense do we often use for daily routines?', answer: 'The present simple.' },
        { value: 800, question: 'Name one frequency adverb used with the present simple.', answer: 'Always / usually / sometimes / never.' },
      ],
    },
    {
      name: 'He / She / It',
      questions: [
        { value: 200, question: 'What do we add to many verbs with he/she/it?', answer: '-s or -es.' },
        { value: 400, question: 'Correct this: She work in a bank.', answer: 'She works in a bank.' },
        { value: 600, question: 'Correct this: My brother watch TV after dinner.', answer: 'My brother watches TV after dinner.' },
        { value: 800, question: 'Why do we say "he goes" but not "he go"?', answer: 'Because third person singular takes the present simple ending.' },
      ],
    },
    {
      name: 'Questions',
      questions: [
        { value: 200, question: 'Which auxiliary do we use with they?', answer: 'Do.' },
        { value: 400, question: 'Correct this: Does they live near here?', answer: 'Do they live near here?' },
        { value: 600, question: 'Make a present simple question about weekend habits.', answer: 'Example: What do you usually do on weekends?' },
        { value: 800, question: 'What is the base verb in this question: Does she work here?', answer: 'Work.' },
      ],
    },
    {
      name: 'Negatives',
      questions: [
        { value: 200, question: 'What is the negative form with he?', answer: 'He doesn’t ...' },
        { value: 400, question: 'Correct this: He don’t like coffee.', answer: 'He doesn’t like coffee.' },
        { value: 600, question: 'Make a negative sentence with they.', answer: 'Example: They don’t watch TV at lunch.' },
        { value: 800, question: 'Why is "He isn’t like coffee" wrong?', answer: 'Because present simple negatives use does not, not is not.' },
      ],
    },
  ],
  scenarioCards: [
    {
      title: 'New Routine',
      scenario: 'A student wants to describe their daily morning routine in English.',
      verdict: 'USE PRESENT SIMPLE',
      verdictStyle: 'success',
      reveal: 'A regular daily routine fits the present simple.',
      details: ['Use time phrases such as every day or usually.', 'Use the base verb with I/you/we/they.'],
      hook: 'I usually ... before school.',
    },
    {
      title: 'Right Now',
      scenario: 'A student is talking about what their brother is doing at this moment.',
      verdict: 'NOT PRESENT SIMPLE',
      verdictStyle: 'warning',
      reveal: 'An action happening now usually needs the present continuous, not the present simple.',
      details: ['Present simple = routine.', 'Present continuous = now or temporary action.'],
      hook: 'He is ... right now.',
    },
    {
      title: 'General Truth',
      scenario: 'A teacher wants to explain a scientific fact to the class.',
      verdict: 'USE PRESENT SIMPLE',
      verdictStyle: 'success',
      reveal: 'General truths and facts often use the present simple.',
      details: ['Examples: Water boils at 100°C. The sun rises in the east.'],
      hook: 'A fact I know is ...',
    },
    {
      title: 'Question Form',
      scenario: 'A learner wants to ask about a friend’s weekend habits.',
      verdict: 'USE DO / DOES QUESTION',
      verdictStyle: 'success',
      reveal: 'Use do or does to form present simple questions.',
      details: ['Do you ... ?', 'Does she ... ?'],
      hook: 'What do you usually do on Sundays?',
    },
    {
      title: 'Third Person Mistake',
      scenario: 'A learner says: "My father drive to work every day."',
      verdict: 'NEEDS A FIX',
      verdictStyle: 'danger',
      reveal: 'With he/she/it, many verbs need -s in the present simple.',
      details: ['Correct form: My father drives to work every day.'],
      hook: 'He / She / It + verb-s',
    },
  ],
  fluencyTree: {
    title: 'Talking About Daily Routines',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'A',
        options: [
          { text: 'What time do you usually get up?', next: 'n2' },
          { text: 'Do you have the same routine every day?', next: 'n2' },
        ],
      },
      n2: {
        speaker: 'B',
        options: [
          { text: 'I usually get up at seven.', next: 'n3' },
          { text: 'Yes, more or less. I follow a similar routine each day.', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'A',
        options: [
          { text: 'What do you do after breakfast?', next: 'n4' },
          { text: 'Do you walk to work or school?', next: 'n4' },
        ],
      },
      n4: {
        speaker: 'B',
        options: [
          { text: 'I usually check my messages and leave the house.', next: 'n5' },
          { text: 'I usually take the bus because it is faster.', next: 'n5' },
        ],
      },
      n5: {
        speaker: 'A',
        options: [
          { text: 'That sounds organised.', next: null },
          { text: 'Your routine sounds busy.', next: null },
        ],
      },
    },
  },
  discussionPrompts: [
    'What do you usually do before work or school?',
    'Which habits help you have a good day?',
  ],
};
