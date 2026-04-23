window.TOPIC_PACK = {
  id: 'present-continuous',
  title: 'Present Continuous',
  category: 'grammar',
  level: 'A2-B1',
  tags: ['grammar', 'core tense', 'actions now'],
  vocabulary: [
    {
      term: 'happening now',
      hint: 'in progress at this moment',
      definition: 'taking place at the moment of speaking',
      bluffs: ['finished yesterday', 'a regular weekly habit'],
    },
    {
      term: 'in progress',
      hint: 'started but not finished',
      definition: 'started and still continuing',
      bluffs: ['planned but not started', 'done many years ago'],
    },
    {
      term: 'temporary',
      hint: 'for a short time',
      definition: 'not permanent; lasting for a limited time',
      bluffs: ['true forever', 'happening every year on the same date'],
    },
    {
      term: 'at the moment',
      hint: 'now',
      definition: 'now or around now',
      bluffs: ['every morning', 'before last weekend'],
    },
    {
      term: 'these days',
      hint: 'around this time in life',
      definition: 'during the current period, not necessarily this second',
      bluffs: ['only yesterday', 'at exactly midnight'],
    },
    {
      term: 'currently',
      hint: 'now',
      definition: 'at the present time',
      bluffs: ['a long time ago', 'only after the lesson ends'],
    },
    {
      term: 'change',
      hint: 'become different',
      definition: 'to become different over time',
      bluffs: ['to repeat the same action every day', 'to stop before starting'],
    },
    {
      term: 'improve',
      hint: 'get better',
      definition: 'to become better',
      bluffs: ['to become worse on purpose', 'to copy a sentence exactly'],
    },
    {
      term: 'increase',
      hint: 'go up',
      definition: 'to become larger in number or amount',
      bluffs: ['to become hidden', 'to ask a question politely'],
    },
    {
      term: 'decrease',
      hint: 'go down',
      definition: 'to become smaller in number or amount',
      bluffs: ['to become louder', 'to start speaking faster'],
    },
  ],
  examples: [
    { sentence: 'She is talking to a customer right now.', focus: 'action happening now' },
    { sentence: 'We are learning present continuous this week.', focus: 'current period' },
    { sentence: 'I am staying with my cousin until Friday.', focus: 'temporary situation' },
    { sentence: 'Your pronunciation is improving.', focus: 'change in progress' },
  ],
  revealItems: [
    { label: 'Form', example: 'am / is / are + verb-ing' },
    { label: 'Now', example: 'She is answering an email right now.' },
    { label: 'Around now', example: 'He is studying English this year.' },
    { label: 'Temporary', example: 'They are living in a hotel this week.' },
    { label: 'Change', example: 'The weather is getting colder.' },
    { label: 'Negative', example: 'I am not listening to music.' },
  ],
  questions: {
    multipleChoice: [
      {
        question: 'Which sentence is correct?',
        options: ['She is drive to work.', 'She driving to work.', 'She is driving to work.', 'She drives to work now.'],
        answer: 2,
        explanation: 'Use is + verb-ing for an action happening now.',
      },
      {
        question: 'Choose the correct negative sentence.',
        options: ['I not listening.', 'I am not listening.', 'I do not listening.', 'I am not listen.'],
        answer: 1,
        explanation: 'The negative form is am/is/are + not + verb-ing.',
      },
      {
        question: 'Which sentence talks about a temporary situation?',
        options: ['She works in a bank every day.', 'She is working in a cafe this week.', 'Water boils at 100 degrees.', 'I usually walk to work.'],
        answer: 1,
        explanation: 'This week shows a situation around now, not a permanent fact.',
      },
      {
        question: 'Choose the best question.',
        options: ['What you are doing?', 'What are you doing?', 'What do you doing?', 'What are you do?'],
        answer: 1,
        explanation: 'Question order is am/is/are + subject + verb-ing.',
      },
      {
        question: 'Which sentence describes a change in progress?',
        options: ['Prices are increasing.', 'Prices increase every year.', 'Prices increased last month.', 'Prices have increased recently.'],
        answer: 0,
        explanation: 'Are increasing shows a change happening now.',
      },
      {
        question: 'Choose the correct form: They _____ lunch at the moment.',
        options: ['have', 'are having', 'is having', 'having'],
        answer: 1,
        explanation: 'Use are with they.',
      },
      {
        question: 'Which time phrase often goes with the present continuous?',
        options: ['every Monday', 'last night', 'at the moment', 'in 2018'],
        answer: 2,
        explanation: 'At the moment means now.',
      },
      {
        question: 'Choose the correct sentence.',
        options: ['The weather is changing.', 'The weather changing.', 'The weather are changing.', 'The weather changes now.'],
        answer: 0,
        explanation: 'The weather is singular, so use is changing.',
      },
      {
        question: 'Which sentence means the action is not finished?',
        options: ['I finished the report.', 'I am writing the report.', 'I write reports every Friday.', 'I wrote the report yesterday.'],
        answer: 1,
        explanation: 'Am writing means the action is in progress.',
      },
      {
        question: 'Choose the correct question: _____ English this year?',
        options: ['Are you study', 'Do you studying', 'Are you studying', 'You are studying'],
        answer: 2,
        explanation: 'Use are + subject + verb-ing.',
      },
    ],
    trueFalse: [
      {
        statement: 'We form the present continuous with am, is, or are plus verb-ing.',
        answer: true,
        explanation: 'Example: I am working, she is studying, they are waiting.',
      },
      {
        statement: 'The present continuous is only for actions happening this exact second.',
        answer: false,
        explanation: 'It can also describe things happening around now, such as this week or this year.',
      },
      {
        statement: 'We can use the present continuous for temporary situations.',
        answer: true,
        explanation: 'Example: I am staying with friends this week.',
      },
      {
        statement: 'She are working is a correct sentence.',
        answer: false,
        explanation: 'Use is with she: She is working.',
      },
      {
        statement: 'Getting better and becoming easier can describe changes in progress.',
        answer: true,
        explanation: 'These expressions often use the present continuous.',
      },
      {
        statement: 'At the moment is a useful time phrase for present continuous.',
        answer: true,
        explanation: 'It means now.',
      },
    ],
    openEnded: [
      {
        prompt: 'Say what you are doing right now.',
        hint: 'I am ...',
        answer: 'I am sitting in class and practising English.',
      },
      {
        prompt: 'Ask someone what they are doing this weekend.',
        hint: 'What are you ...?',
        answer: 'What are you doing this weekend?',
      },
      {
        prompt: 'Make a negative sentence about now.',
        hint: 'am not / is not / are not',
        answer: 'I am not using my phone right now.',
      },
      {
        prompt: 'Describe a change in your English.',
        hint: 'getting / improving',
        answer: 'My speaking is getting better.',
      },
      {
        prompt: 'Say what someone in the room is wearing.',
        hint: 'is wearing',
        answer: 'She is wearing a blue jacket.',
      },
      {
        prompt: 'Ask why someone is laughing.',
        hint: 'Why are you ...?',
        answer: 'Why are you laughing?',
      },
    ],
  },
  fillBlanks: [
    { sentence: 'I [am trying] to finish this exercise.', note: 'I + am + verb-ing', options: ['am trying', 'try', 'am try', 'trying'] },
    { sentence: 'She [is talking] to the teacher at the moment.', note: 'she + is + verb-ing', options: ['is talking', 'talks', 'are talking', 'is talk'] },
    { sentence: 'We [are learning] a new grammar point this week.', note: 'we + are + verb-ing', options: ['are learning', 'learn', 'is learning', 'are learn'] },
    { sentence: 'The situation [is getting] better.', note: 'change in progress', options: ['is getting', 'gets', 'are getting', 'getting'] },
    { sentence: 'They [are not listening] to the instructions.', note: 'negative form', options: ['are not listening', 'do not listening', 'are not listen', 'not listening'] },
    { sentence: '[Are] you enjoying the course?', note: 'question form', options: ['Are', 'Do', 'Is', 'Have'] },
    { sentence: 'He [is staying] with friends until Monday.', note: 'temporary situation', options: ['is staying', 'stays', 'are staying', 'is stay'] },
    { sentence: 'Prices [are increasing] in many cities.', note: 'change in progress', options: ['are increasing', 'increase', 'is increasing', 'are increase'] },
  ],
  pairs: [
    {
      a: 'She works in a restaurant.',
      b: 'She is working in a restaurant this week.',
      note: 'A is a regular job or fact. B is a temporary situation around now.',
    },
    {
      a: 'He is studying right now.',
      b: 'He studies every evening.',
      note: 'A is happening now. B is a routine.',
    },
    {
      a: 'The company is growing.',
      b: 'The company grows vegetables.',
      note: 'A describes a change in progress. B describes what the company does.',
    },
    {
      a: 'They are not speaking to each other.',
      b: 'They do not speak Spanish.',
      note: 'A describes current behaviour. B describes ability or general fact.',
    },
  ],
  oddOneOut: [
    {
      words: ['now', 'at the moment', 'right now', 'every day'],
      odd: 'every day',
      reason: 'The first three point to now. Every day usually points to a routine.',
    },
    {
      words: ['am working', 'is studying', 'are waiting', 'works'],
      odd: 'works',
      reason: 'The first three are present continuous forms. Works is present simple.',
    },
    {
      words: ['getting', 'becoming', 'improving', 'yesterday'],
      odd: 'yesterday',
      reason: 'The first three can describe changes in progress. Yesterday is a past time word.',
    },
    {
      words: ['temporary', 'current', 'in progress', 'permanent'],
      odd: 'permanent',
      reason: 'The first three connect to present continuous use. Permanent means lasting for a long time.',
    },
  ],
  jeopardyCategories: [
    {
      name: 'Form',
      questions: [
        { value: 200, question: 'What three helping verbs do we use in the present continuous?', answer: 'Am, is, and are.' },
        { value: 400, question: 'Complete: I ___ working.', answer: 'I am working.' },
        { value: 600, question: 'Correct this: She are studying.', answer: 'She is studying.' },
        { value: 800, question: 'Make a present continuous question with "you / listen".', answer: 'Are you listening?' },
      ],
    },
    {
      name: 'Use',
      questions: [
        { value: 200, question: 'Do we use present continuous for actions happening now or finished past actions?', answer: 'Actions happening now.' },
        { value: 400, question: 'Give one sentence about something happening in the classroom now.', answer: 'Example: The teacher is speaking.' },
        { value: 600, question: 'What kind of situation is this: I am living with my aunt this month?', answer: 'A temporary situation.' },
        { value: 800, question: 'Why is this present continuous: My English is improving?', answer: 'It describes a change in progress.' },
      ],
    },
    {
      name: 'Time Words',
      questions: [
        { value: 200, question: 'Name one time phrase that means now.', answer: 'Now / right now / at the moment.' },
        { value: 400, question: 'Which fits better: I am studying English ___ year.', answer: 'This year.' },
        { value: 600, question: 'Does "every Monday" usually fit present continuous or present simple?', answer: 'Present simple.' },
        { value: 800, question: 'Make a sentence with "these days".', answer: 'Example: I am learning a lot these days.' },
      ],
    },
    {
      name: 'Fix It',
      questions: [
        { value: 200, question: 'Fix it: They is waiting.', answer: 'They are waiting.' },
        { value: 400, question: 'Fix it: I am not listen.', answer: 'I am not listening.' },
        { value: 600, question: 'Fix it: Are she working today?', answer: 'Is she working today?' },
        { value: 800, question: 'Fix it: What you are doing?', answer: 'What are you doing?' },
      ],
    },
  ],
  discussionPrompts: [
    'What are you working on these days?',
    'What is changing in your city at the moment?',
    'What are people in your family doing this week?',
    'What skill are you trying to improve?',
  ],
};
