window.TOPIC_PACK = {
  id: 'jobs-and-workplaces',
  title: 'Jobs & Workplaces',
  category: 'vocabulary',
  level: 'B1',
  tags: ['vocabulary', 'careers'],
  vocabulary: [
    {
      term: 'accountant',
      hint: 'works with company money and financial records',
      definition: 'a person who prepares and checks financial records',
      bluffs: ['a person who repairs office chairs', 'a person who trains actors'],
    },
    {
      term: 'designer',
      hint: 'creates the look of products, clothes, or graphics',
      definition: 'a person who plans the form or appearance of something',
      bluffs: ['a person who writes legal contracts', 'a person who drives a delivery van'],
    },
    {
      term: 'manager',
      hint: 'leads a team or department',
      definition: 'a person who controls and organizes the work of a team or business',
      bluffs: ['a person who paints buildings for a living', 'a person who checks passports at airports'],
    },
    {
      term: 'intern',
      hint: 'a trainee working for experience',
      definition: 'a student or recent graduate working to gain practical experience',
      bluffs: ['a permanent director of a company', 'a customer who buys office equipment'],
    },
    {
      term: 'deadline',
      hint: 'the latest time to finish something',
      definition: 'the final time or date by which something must be completed',
      bluffs: ['the first meeting of every morning', 'a speech given at a job interview'],
    },
    {
      term: 'salary',
      hint: 'regular money from your job',
      definition: 'a fixed amount of money paid regularly for work',
      bluffs: ['a short unpaid break at work', 'a list of job applicants'],
    },
    {
      term: 'promotion',
      hint: 'moving to a higher position',
      definition: 'the act of being given a more important job or rank',
      bluffs: ['a meeting to introduce new staff', 'a warning for arriving late'],
    },
    {
      term: 'colleague',
      hint: 'someone you work with',
      definition: 'a person who works in the same organization as you',
      bluffs: ['a person who interviews you for a job', 'a machine that prints labels'],
    },
    {
      term: 'contract',
      hint: 'official work agreement',
      definition: 'a legal agreement between employer and employee',
      bluffs: ['a room where managers eat lunch', 'the final stage of retirement'],
    },
    {
      term: 'shift',
      hint: 'a fixed period when you work',
      definition: 'a period of time during which a worker does their job',
      bluffs: ['a formal letter of complaint', 'a training course for drivers'],
    },
  ],
  examples: [
    { sentence: 'The manager asked the intern to update the schedule.', focus: 'workplace roles' },
    { sentence: 'She got a promotion after finishing the project early.', focus: 'career progress' },
  ],
  questions: {
    multipleChoice: [],
    trueFalse: [
      {
        statement: 'A colleague is someone who works in the same company as you.',
        answer: true,
        explanation: 'A colleague is a co-worker.',
      },
      {
        statement: 'A salary is money you pay to your manager.',
        answer: false,
        explanation: 'A salary is money your employer pays you.',
      },
      {
        statement: 'A deadline is the latest time to finish work.',
        answer: true,
        explanation: 'Deadlines define when work is due.',
      },
      {
        statement: 'An intern is usually a very senior employee.',
        answer: false,
        explanation: 'An intern is usually a trainee or beginner.',
      },
      {
        statement: 'A shift can be a morning, afternoon, or night working period.',
        answer: true,
        explanation: 'It is a scheduled block of working time.',
      },
    ],
    openEnded: [
      {
        prompt: 'Name a job that works with numbers and money.',
        hint: 'career vocabulary',
        answer: 'An accountant.',
      },
      {
        prompt: 'Complete the sentence: My colleague helped me ...',
        hint: 'workplace action',
        answer: 'My colleague helped me finish the report on time.',
      },
      {
        prompt: 'Explain what a deadline is.',
        hint: 'definition',
        answer: 'A deadline is the latest time when work must be finished.',
      },
      {
        prompt: 'Complete the sentence: She got a promotion because ...',
        hint: 'cause and result',
        answer: 'She got a promotion because she led the project successfully.',
      },
      {
        prompt: 'Name one thing usually written in a contract.',
        hint: 'work agreement',
        answer: 'A contract often includes salary, hours, and responsibilities.',
      },
      {
        prompt: 'Complete the sentence: I work the night shift, so ...',
        hint: 'daily routine',
        answer: 'I work the night shift, so I sleep during the day.',
      },
    ],
  },
  fillBlanks: [
    { sentence: 'The [manager] leads the team.', note: 'job title' },
    { sentence: 'My [salary] is paid at the end of each month.', note: 'money from work' },
    { sentence: 'We must finish the project before the [deadline].', note: 'due date' },
    { sentence: 'An [intern] is learning practical skills at work.', note: 'trainee role' },
    { sentence: 'A [contract] explains the terms of the job.', note: 'work agreement' },
    { sentence: 'My [colleague] sits at the desk next to me.', note: 'co-worker' },
  ],
  pairs: [],
  discussionPrompts: [
    'Which job would you most like to try for a week?',
    'What makes a workplace enjoyable?',
  ],
};
