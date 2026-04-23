window.TOPIC_PACK = {
  id: 'present-perfect',
  title: 'Present Perfect',
  category: 'grammar',
  level: 'B1',
  tags: ['grammar', 'review'],
  vocabulary: [
    {
      term: 'already',
      hint: 'sooner than expected',
      definition: 'before now, sooner than expected',
      bluffs: ['at the same time every week', 'only after midnight'],
    },
    {
      term: 'yet',
      hint: 'used in questions and negatives about something unfinished',
      definition: 'up to now, often in questions and negatives',
      bluffs: ['in a very loud way', 'at the beginning of a sentence only'],
    },
    {
      term: 'recently',
      hint: 'a short time ago',
      definition: 'a short time ago or in the near past',
      bluffs: ['with very little effort', 'in the distant future'],
    },
    {
      term: 'since',
      hint: 'used with a starting point',
      definition: 'from a specific starting time until now',
      bluffs: ['for a limited number of minutes only', 'to compare two nouns'],
    },
    {
      term: 'for',
      hint: 'used with a period of time',
      definition: 'during a length of time',
      bluffs: ['after a finished time expression', 'only with locations'],
    },
    {
      term: 'experience',
      hint: 'something that has happened to you',
      definition: 'knowledge or events gained by doing or living through something',
      bluffs: ['a plan for next weekend', 'a short written apology'],
    },
    {
      term: 'achievement',
      hint: 'something successful you have done',
      definition: 'something good that you have succeeded in doing',
      bluffs: ['a problem with your computer', 'a person who gives advice'],
    },
    {
      term: 'unfinished',
      hint: 'not completed',
      definition: 'not completed or still continuing',
      bluffs: ['carefully organized by color', 'spoken by two people together'],
    },
  ],
  examples: [
    { sentence: 'I have visited London three times.', focus: 'life experience' },
    { sentence: 'She has already sent the email.', focus: 'already' },
    { sentence: 'We have lived here since 2021.', focus: 'since + point in time' },
    { sentence: 'They have worked together for six months.', focus: 'for + period of time' },
  ],
  questions: {
    multipleChoice: [],
    trueFalse: [
      {
        statement: 'You can use the present perfect to talk about life experience.',
        answer: true,
        explanation: 'Example: I have flown to Turkey twice.',
      },
      {
        statement: 'You use the present perfect with finished time words like yesterday.',
        answer: false,
        explanation: 'Finished times such as yesterday usually take the past simple.',
      },
      {
        statement: 'Since is usually followed by a starting point in time.',
        answer: true,
        explanation: 'Example: since Monday, since 2022.',
      },
      {
        statement: 'For is used with a duration such as three years.',
        answer: true,
        explanation: 'It describes a period of time.',
      },
      {
        statement: 'Yet is most common in positive statements.',
        answer: false,
        explanation: 'Yet is more common in negatives and questions.',
      },
    ],
    openEnded: [
      {
        prompt: 'Complete the sentence: I have never ...',
        hint: 'life experience',
        answer: 'I have never tried scuba diving.',
      },
      {
        prompt: 'Answer the question: Have you finished your homework yet?',
        hint: 'use already / not yet',
        answer: 'Yes, I have already finished it. / No, I have not finished it yet.',
      },
      {
        prompt: 'Complete the sentence: She has lived in Dublin ...',
        hint: 'since / for',
        answer: 'She has lived in Dublin for five years. / She has lived in Dublin since 2021.',
      },
      {
        prompt: 'Give a sentence about a recent action with just.',
        hint: 'present perfect',
        answer: 'I have just spoken to my manager.',
      },
      {
        prompt: 'Ask someone about travel experience.',
        hint: 'Have you ever...?',
        answer: 'Have you ever stayed in a five-star hotel?',
      },
      {
        prompt: 'Give a negative sentence with yet.',
        hint: 'present perfect negative',
        answer: 'They have not arrived yet.',
      },
    ],
  },
  fillBlanks: [
    { sentence: 'I have [worked] here for three years.', note: 'present perfect + for' },
    { sentence: 'She has [already finished] the report.', note: 'already' },
    { sentence: 'We have lived here [since 2022].', note: 'since + starting point' },
    { sentence: 'Have you done your homework [yet]?', note: 'yet in questions' },
    { sentence: 'They have [never visited] Japan.', note: 'life experience' },
    { sentence: 'He has [just called] me.', note: 'just + recent action' },
  ],
  pairs: [],
  discussionPrompts: [
    'What is something you have achieved this year?',
    'What is a place you have never visited but want to see?',
  ],
};
