window.ENGISHISM_UNITS = window.ENGISHISM_UNITS || {};

window.ENGISHISM_UNITS['grammar-unit-1-present-continuous'] = {
  id: 'grammar-unit-1-present-continuous',
  source: {
    material: 'English Grammar in Use, Unit 1',
    note: 'Used as a grammar reference; classroom content is original.',
  },
  meta: {
    unit: 'Grammar Unit 1',
    title: 'Present Continuous',
    subtitle: 'I am doing',
    category: 'Grammar',
    level: 'A2-B1',
    classroomGoal: 'Students recognise and produce present continuous sentences for actions now, temporary situations, and changes in progress.',
    tags: ['present continuous', 'actions now', 'temporary situations', 'changes'],
  },
  assets: {
    actionSheet: {
      src: 'assets/images/units/unit-1-present-continuous/action-sheet.png',
      cols: 3,
      rows: 2,
      alt: 'Six present-continuous action scenes',
    },
  },
  grammar: {
    focus: 'Present continuous',
    form: [
      { label: 'Positive', pattern: 'subject + am / is / are + verb-ing', example: 'She is taking a picture.' },
      { label: 'Negative', pattern: 'subject + am / is / are + not + verb-ing', example: 'They are not listening.' },
      { label: 'Question', pattern: 'am / is / are + subject + verb-ing?', example: 'Are you enjoying the lesson?' },
    ],
    rules: [
      {
        label: 'Actions now',
        explanation: 'Use the present continuous for an action happening at the moment of speaking.',
        examples: ['He is tying his shoelace.', 'They are waiting outside.'],
      },
      {
        label: 'Around now',
        explanation: 'Use it for unfinished activities around the current period, even if they are not happening this exact second.',
        examples: ['We are learning present continuous this week.', 'She is studying English this year.'],
      },
      {
        label: 'Temporary situations',
        explanation: 'Use it when a situation is true for a limited time, not permanently.',
        examples: ['I am staying with my cousin until Friday.', 'He is working in a cafe this week.'],
      },
      {
        label: 'Changes in progress',
        explanation: 'Use it for changes that have started and are continuing.',
        examples: ['My pronunciation is improving.', 'Prices are increasing.'],
      },
    ],
    contrasts: [
      {
        a: 'She works in a restaurant.',
        b: 'She is working in a restaurant this week.',
        note: 'A is a regular job or fact. B is temporary around now.',
      },
      {
        a: 'He studies every evening.',
        b: 'He is studying right now.',
        note: 'A is a routine. B is happening now.',
      },
      {
        a: 'The company grows vegetables.',
        b: 'The company is growing.',
        note: 'A says what the company does. B says the company is getting bigger.',
      },
    ],
    commonMistakes: [
      { wrong: 'She are studying.', right: 'She is studying.', note: 'Use is with he, she, and it.' },
      { wrong: 'I am not listen.', right: 'I am not listening.', note: 'After am/is/are, use verb-ing.' },
      { wrong: 'What you are doing?', right: 'What are you doing?', note: 'In questions, put am/is/are before the subject.' },
      { wrong: 'He is work today.', right: 'He is working today.', note: 'Use verb-ing after is.' },
    ],
  },
  practice: {
    multipleChoice: [
      {
        question: 'Which sentence is correct?',
        options: ['She is drive to work.', 'She driving to work.', 'She is driving to work.', 'She drives to work now.'],
        answer: 2,
        explanation: 'Use is + verb-ing for an action happening now.',
      },
      {
        question: 'Choose the correct question.',
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
    ],
    fillBlanks: [
      { sentence: 'I [am trying] to finish this exercise.', note: 'I + am + verb-ing', options: ['am trying', 'try', 'am try', 'trying'] },
      { sentence: 'She [is talking] to the teacher at the moment.', note: 'she + is + verb-ing', options: ['is talking', 'talks', 'are talking', 'is talk'] },
      { sentence: 'We [are learning] a new grammar point this week.', note: 'we + are + verb-ing', options: ['are learning', 'learn', 'is learning', 'are learn'] },
      { sentence: 'The situation [is getting] better.', note: 'change in progress', options: ['is getting', 'gets', 'are getting', 'getting'] },
    ],
    speakingPrompts: [
      'What are you working on these days?',
      'What is changing in your city at the moment?',
      'What skill are you trying to improve?',
      'What are people in this room doing right now?',
    ],
    imagePrompts: [
      {
        id: 'taking-picture',
        image: { asset: 'actionSheet', col: 0, row: 0 },
        prompt: 'Choose the best present continuous sentence.',
        options: ['She is taking a picture.', 'She is tying her shoelace.', 'She takes a picture every day.', 'She is hiding behind a tree.'],
        answer: 0,
        feedback: 'Correct: She is taking a picture.',
      },
      {
        id: 'tying-shoelace',
        image: { asset: 'actionSheet', col: 1, row: 0 },
        prompt: 'Choose the best present continuous sentence.',
        options: ['He ties his shoelace every morning.', 'He is tying his shoelace.', 'He is scratching his head.', 'He is crossing the road.'],
        answer: 1,
        feedback: 'Correct: He is tying his shoelace.',
      },
      {
        id: 'crossing-road',
        image: { asset: 'actionSheet', col: 2, row: 0 },
        prompt: 'Choose the best present continuous sentence.',
        options: ['She is waving to a friend.', 'She crosses the road on Mondays.', 'She is crossing the road.', 'She is taking a picture.'],
        answer: 2,
        feedback: 'Correct: She is crossing the road.',
      },
      {
        id: 'scratching-head',
        image: { asset: 'actionSheet', col: 0, row: 1 },
        prompt: 'Choose the best present continuous sentence.',
        options: ['He is hiding behind a tree.', 'He is tying his shoelace.', 'He scratches his head every day.', 'He is scratching his head.'],
        answer: 3,
        feedback: 'Correct: He is scratching his head.',
      },
      {
        id: 'hiding-tree',
        image: { asset: 'actionSheet', col: 1, row: 1 },
        prompt: 'Choose the best present continuous sentence.',
        options: ['The child is hiding behind a tree.', 'The child is waving to a friend.', 'The child hides behind a tree every day.', 'The child is taking a picture.'],
        answer: 0,
        feedback: 'Correct: The child is hiding behind a tree.',
      },
      {
        id: 'waving-friend',
        image: { asset: 'actionSheet', col: 2, row: 1 },
        prompt: 'Choose the best present continuous sentence.',
        options: ['He is crossing the road.', 'He is waving to a friend.', 'He waves to a friend every morning.', 'He is scratching his head.'],
        answer: 1,
        feedback: 'Correct: He is waving to a friend.',
      },
    ],
  },
};
