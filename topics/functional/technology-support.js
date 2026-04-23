window.TOPIC_PACK = {
  id: 'technology-support',
  title: 'Technology Support',
  category: 'functional-language',
  level: 'B1',
  tags: ['functional-language', 'technology'],
  vocabulary: [
    {
      term: 'password',
      hint: 'secret word used to log in',
      definition: 'a secret set of letters or numbers used to access a system',
      bluffs: ['a machine for printing photos', 'a cable that charges a projector'],
    },
    {
      term: 'browser',
      hint: 'program used to open websites',
      definition: 'software used to access and view web pages',
      bluffs: ['a small battery inside a keyboard', 'an online meeting invitation'],
    },
    {
      term: 'update',
      hint: 'new version of software',
      definition: 'a newer version of software installed to improve or fix it',
      bluffs: ['a physical button that turns on Wi-Fi', 'a printed list of passwords'],
    },
    {
      term: 'crash',
      hint: 'when a program stops working suddenly',
      definition: 'a sudden failure that makes software stop working',
      bluffs: ['a careful way of typing a report', 'a locked folder on the desktop'],
    },
    {
      term: 'signal',
      hint: 'strength of a connection',
      definition: 'the quality or strength of a network connection',
      bluffs: ['the color of a warning light', 'the first screen after you log in'],
    },
    {
      term: 'charger',
      hint: 'device used to give power to a battery',
      definition: 'equipment used to recharge a battery',
      bluffs: ['software that blocks pop-up ads', 'a digital calendar reminder'],
    },
    {
      term: 'restart',
      hint: 'turn off and on again',
      definition: 'to stop and start a device again',
      bluffs: ['to move files into a new folder', 'to make the screen brighter'],
    },
    {
      term: 'attachment',
      hint: 'file sent with an email',
      definition: 'a file added to an email message',
      bluffs: ['the hidden password on a router', 'a note written during a meeting'],
    },
    {
      term: 'printer',
      hint: 'machine that puts documents on paper',
      definition: 'a device that produces documents on paper',
      bluffs: ['an app used to open spreadsheets', 'the sound made by a broken laptop'],
    },
    {
      term: 'router',
      hint: 'box that provides internet to devices',
      definition: 'a device that directs internet traffic to connected devices',
      bluffs: ['an office worker who sorts printed reports', 'a code used for copying files'],
    },
  ],
  examples: [
    { sentence: 'My browser keeps crashing when I open that website.', focus: 'describe a problem' },
    { sentence: 'Have you tried restarting the router?', focus: 'support suggestion' },
  ],
  questions: {
    multipleChoice: [],
    trueFalse: [
      {
        statement: 'Restarting a device means turning it off and on again.',
        answer: true,
        explanation: 'This is a common first troubleshooting step.',
      },
      {
        statement: 'An attachment is a machine that prints documents.',
        answer: false,
        explanation: 'An attachment is a file sent with an email.',
      },
      {
        statement: 'A weak signal can make the internet connection unstable.',
        answer: true,
        explanation: 'Poor signal strength often causes connection problems.',
      },
      {
        statement: 'A password should be shared with every colleague.',
        answer: false,
        explanation: 'Passwords should be kept private.',
      },
      {
        statement: 'An update can fix bugs in software.',
        answer: true,
        explanation: 'Updates often improve stability and security.',
      },
    ],
    openEnded: [
      {
        prompt: 'What should you ask first when someone cannot log in?',
        hint: 'support question',
        answer: 'I would ask if they are using the correct password.',
      },
      {
        prompt: 'Complete the sentence: The printer is not working, so ...',
        hint: 'support suggestion',
        answer: 'The printer is not working, so I will check the cable and restart it.',
      },
      {
        prompt: 'Describe what a router does.',
        hint: 'device function',
        answer: 'A router sends the internet connection to different devices.',
      },
      {
        prompt: 'Complete the sentence: If the browser crashes, ...',
        hint: 'problem solving',
        answer: 'If the browser crashes, try closing it and opening it again.',
      },
      {
        prompt: 'Give one reason to install an update.',
        hint: 'software support',
        answer: 'An update can fix bugs or improve security.',
      },
      {
        prompt: 'Complete the sentence: I cannot open the attachment because ...',
        hint: 'email issue',
        answer: 'I cannot open the attachment because the file format is unsupported.',
      },
    ],
  },
  fillBlanks: [
    { sentence: 'Please [restart] the router and try again.', note: 'common support action' },
    { sentence: 'I cannot log in because I forgot my [password].', note: 'login problem' },
    { sentence: 'The program [crashes] every time I open it.', note: 'software failure' },
    { sentence: 'Can you send the file as an email [attachment]?', note: 'email vocabulary' },
    { sentence: 'The Wi-Fi [signal] is too weak in this room.', note: 'connection quality' },
    { sentence: 'My laptop needs a [charger] because the battery is empty.', note: 'power supply' },
  ],
  pairs: [],
  discussionPrompts: [
    'What is the most common tech problem in a classroom?',
    'Which tech support phrase do you use most often?',
  ],
};
