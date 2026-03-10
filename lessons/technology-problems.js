window.LESSON = {
  title: "Technology & Problem Solving",
  mode: "selector",
  slides: [

    // ── Title ─────────────────────────────────────────────────
    {
      type: "title-card",
      content: {
        unit: "",
        heading: "Technology & Problem Solving",
        subheading: "Identifying and Clarifying Problems"
      }
    },

    // ── Discussion Questions ───────────────────────────────────
    {
      label: "Technology — Discussion Questions",
      type: "reveal-card",
      content: {
        heading: "Technology Discussion",
        items: [
          { label: "What springs to mind when you hear the word 'technology'?", example: "Think about devices, systems, apps, or changes in how we live." },
          { label: "Is technology a good or a bad thing?", example: "Give at least one reason and a specific example to support your view." },
          { label: "What new technology could you not live without? Why?", example: "What would change if you suddenly didn't have it?" },
          { label: "Has technology made us more impatient? Give an example.", example: "Think about how you react when something is slow or doesn't work." },
          { label: "What things would you never let technology replace?", example: "Are there areas of life where humans must stay in charge?" },
          { label: "Has technology made our lives better than our grandparents' lives?", example: "Consider health, communication, work and free time." },
          { label: "Do you always trust technology? Has it ever let you down?", example: "Describe a specific moment when it failed you." },
          { label: "'Technology is the knack of arranging the world so we don't have to experience it.' — Max Frisch. Do you agree?", example: "What does 'not having to experience it' mean to you?" }
        ]
      }
    },

    // ── Gap Fill — Phrases ─────────────────────────────────────
    {
      label: "Gap Fill — Identifying & Clarifying Phrases",
      type: "fill-blank",
      content: {
        questions: [
          { sentence: "Before I contact IT support, let me make sure I [understand] the problem correctly.", note: "clarifying" },
          { sentence: "The [main] concern is that the school's wifi keeps disconnecting during lessons.", note: "identifying" },
          { sentence: "So, [what] you're saying is that the app crashes every time you try to open a file?", note: "clarifying" },
          { sentence: "Could you [explain] the issue again? I want to make sure we report it correctly.", note: "clarifying" },
          { sentence: "The challenge we need to [address] is the slow loading speed of the school website.", note: "identifying" },
          { sentence: "Do you [mean] that the printer only works for some students and not others?", note: "clarifying" },
          { sentence: "It seems like something is [wrong] with the school's internet connection this morning.", note: "identifying" },
          { sentence: "Just to [clarify], the problem is that the app freezes when you try to upload files.", note: "clarifying" },
          { sentence: "We seem to be [facing] a problem with students logging in to the new online system.", note: "identifying" },
          { sentence: "It appears there's an [issue] regarding access to the shared class folder.", note: "identifying" }
        ]
      }
    },

    // ── Meaning Pairs — Identify vs Clarify ───────────────────
    {
      label: "Meaning Pairs — Identify vs Clarify",
      type: "meaning-pair",
      content: {
        pairs: [
          {
            a: "It seems like something is wrong with the wifi.",
            b: "So, what you're saying is that the wifi isn't connecting?",
            note: "A = identifies the problem  |  B = clarifies by paraphrasing — use A first, then B in response"
          },
          {
            a: "The main concern is that students can't access the online exam.",
            b: "Could you explain the issue again? Is it all students or just some?",
            note: "A = names the issue  |  B = asks for more detail to narrow it down"
          },
          {
            a: "We seem to be facing a problem with the new printer.",
            b: "Let me make sure I understand — it won't print at all, or only certain documents?",
            note: "A = signals a problem exists  |  B = checks which specific aspect needs solving"
          },
          {
            a: "The challenge we need to address is the outdated classroom software.",
            b: "Do you mean that it won't open new file types, or that it crashes frequently?",
            note: "A = frames the challenge  |  B = clarifies which symptom is actually the problem"
          }
        ]
      }
    },

    // ── True / False — Correct Word Choice ────────────────────
    {
      label: "True / False — Which Word Is Correct?",
      type: "true-false",
      content: {
        questions: [
          { statement: "'It appears IT'S an issue with the wifi signal.' — IT'S is the correct word here.", answer: false, explanation: "The correct word is THERE'S. 'It appears there's an issue' — 'there's' = 'there is', describing something that exists." },
          { statement: "'My main CONCERN is the slow internet speed.' — CONCERN is the natural word here.", answer: true, explanation: "Correct. 'Concern' is the target language. 'Anxiety' is similar but unnatural in this professional context." },
          { statement: "'The challenge we need to DEAL is the broken printer.' — DEAL is the correct word here.", answer: false, explanation: "The correct word is ADDRESS. 'The challenge we need to ADDRESS is...' — 'deal' needs a preposition: 'deal with'." },
          { statement: "'It seems like something is INCORRECT with the projector.' — INCORRECT is the better choice here.", answer: false, explanation: "The natural word is WRONG. 'Something is wrong with...' is the standard phrase. 'Incorrect' refers to answers, not faults." },
          { statement: "'We seem to be FACING a problem with the air conditioning.' — FACING means experiencing or confronting.", answer: true, explanation: "Correct. 'Facing a problem' means you are currently confronted by or dealing with that problem." }
        ]
      }
    },

    // ── Sentence Complete ──────────────────────────────────────
    {
      label: "Sentence Complete — Apply the Phrases",
      type: "sentence-complete",
      content: {
        stems: [
          { stem: "The main concern with our school's technology is...", hint: "identify a specific real problem", answer: "slow internet / outdated devices / unreliable wifi / difficulty accessing shared files" },
          { stem: "It appears there's an issue with...", hint: "name the specific technology", answer: "the printer / the wifi / the login system / the file sharing platform" },
          { stem: "Just to clarify, the problem is that...", hint: "restate the problem precisely", answer: "you can't connect to the network / the file won't open / the programme crashes on startup" },
          { stem: "We seem to be facing a problem with...", hint: "who or what is affected?", answer: "students logging in / accessing the shared drive / the video conferencing software" },
          { stem: "Could you explain the issue again? I need to know whether...", hint: "what specific detail do you need?", answer: "it affects all students or just some / it happens on all devices or just one" },
          { stem: "So, what you're saying is that...", hint: "paraphrase a technology problem", answer: "the wifi works for some websites but not others / the printer receives jobs but never actually prints" }
        ]
      }
    },

    // ── Hot Seat ──────────────────────────────────────────────
    {
      label: "Hot Seat — Key Vocabulary",
      type: "hot-seat",
      content: {
        words: ["understand", "main", "explain", "address", "mean", "wrong", "clarify", "facing", "issue", "concern"],
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
          { question: "Which word completes: 'The ___ concern is...'?", answer: "Main. 'The main concern is...' is a phrase used to identify a problem." },
          { question: "Name a phrase used to CLARIFY a problem.", answer: "'Just to clarify...' / 'So, what you're saying is...' / 'Do you mean that...?' / 'Let me make sure I understand...' / 'Could you explain again?'" },
          { question: "'Just to clarify...' — does this identify or clarify a problem?", answer: "Clarify. It restates the problem to check understanding." },
          { question: "Complete: 'We seem to be ___ a problem with the printer.'", answer: "Facing. 'We seem to be facing a problem' = experiencing or confronting a problem." },
          { question: "'There's' or 'It's'? — 'It appears ___ an issue with the wifi.'", answer: "There's. 'It appears there's an issue' = 'there is an issue'." },
          { question: "Complete: 'Let me make sure I ___.'", answer: "Understand. 'Let me make sure I understand' is a clarifying phrase." },
          { question: "Name a phrase used to IDENTIFY a problem.", answer: "'The main concern is...' / 'It appears there's an issue...' / 'We seem to be facing...' / 'It seems something is wrong...' / 'The challenge we need to address...'" },
          { question: "Complete: 'Could you ___ the issue again?'", answer: "Explain. 'Could you explain the issue again?' requests clarification." },
          { question: "'Concern' or 'Anxiety'? — 'My main ___ is the internet speed.'", answer: "Concern. In professional communication, 'concern' is the natural, correct word." }
        ]
      }
    },

    // ── Millionaire ───────────────────────────────────────────
    {
      label: "Millionaire — Phrases Quiz",
      type: "millionaire",
      content: {
        questions: [
          {
            question: "Which word completes: 'The main ___ is the slow network'?",
            options: ["issue", "problem", "concern", "worry"],
            answer: 2
          },
          {
            question: "What does an 'identifying problems' phrase do?",
            options: ["Asks the other person a question", "Signals that a problem exists", "Offers a solution to the problem", "Requests that someone repeat themselves"],
            answer: 1
          },
          {
            question: "Which phrase is used to CLARIFY a problem?",
            options: ["The main concern is...", "We seem to be facing a problem...", "So, what you're saying is...", "It appears there's an issue..."],
            answer: 2
          },
          {
            question: "Complete: 'It appears ___ an issue regarding the wifi.'",
            options: ["its", "there's", "its a", "it has"],
            answer: 1
          },
          {
            question: "Which word is WRONG: 'The challenge we need to DEAL with is...'",
            options: ["challenge", "deal", "need", "with"],
            answer: 1
          },
          {
            question: "Which two phrases BOTH identify a problem?",
            options: ["'The main concern...' & 'Just to clarify...'", "'It appears there's an issue...' & 'The challenge we need to address...'", "'Do you mean that...?' & 'The main concern is...'", "'So, what you're saying...' & 'The challenge we need...'"],
            answer: 1
          },
          {
            question: "A colleague describes a problem. Which phrase summarises what they said?",
            options: ["It appears there's an issue...", "The main concern is...", "So, what you're saying is...", "The challenge we need to address..."],
            answer: 2
          }
        ]
      }
    },

    // ── Jeopardy ──────────────────────────────────────────────
    {
      label: "Jeopardy — Technology & Phrases",
      type: "jeopardy",
      content: {
        categories: [
          {
            name: "Identify",
            questions: [
              { value: 200, question: "Name one phrase used to IDENTIFY a problem.", answer: "Any of: 'The main concern is...' / 'It appears there's an issue with...' / 'We seem to be facing a problem with...' / 'It seems like something is wrong with...' / 'The challenge we need to address is...'" },
              { value: 400, question: "Which word completes: 'The challenge we need to ___ is...'?", answer: "Address. 'The challenge we need to address is...' — meaning to deal with or tackle." },
              { value: 600, question: "True or False: 'We seem to be facing a problem' is used to clarify a problem.", answer: "False — it identifies a problem by signalling that one exists." },
              { value: 800, question: "In the phrase 'The main ___ is...' — what word fills the blank, and what function does the phrase serve?", answer: "CONCERN. The phrase identifies a problem — it signals that a specific issue needs attention." }
            ]
          },
          {
            name: "Clarify",
            questions: [
              { value: 200, question: "Name one phrase used to CLARIFY a problem.", answer: "Any of: 'Just to clarify...' / 'So, what you're saying is...' / 'Do you mean that...?' / 'Let me make sure I understand...' / 'Could you explain the issue again?'" },
              { value: 400, question: "Complete: 'Let me make sure I ___'", answer: "Understand. 'Let me make sure I understand' — checking comprehension of the problem." },
              { value: 600, question: "True or False: 'Could you explain the issue again?' is a clarifying phrase.", answer: "True — it requests more information to better understand the problem." },
              { value: 800, question: "'So, what you're saying is...' — what does this phrase ask the speaker to do?", answer: "Confirm or agree with a paraphrase of what they said. It shows the listener has understood and wants to check accuracy." }
            ]
          },
          {
            name: "Word Choice",
            questions: [
              { value: 200, question: "'It appears ___ an issue.' — which word: IT'S or THERE'S?", answer: "There's. 'It appears there's an issue' = 'there is an issue'." },
              { value: 400, question: "'My main ___ is...' — which word: CONCERN or ANXIETY?", answer: "Concern. 'Anxiety' sounds unnatural in professional problem-solving language." },
              { value: 600, question: "'The challenge we need to ___ is...' — which word: DEAL or ADDRESS?", answer: "Address. 'Deal' requires a preposition: 'deal with'. 'Address' works directly: 'address the issue'." },
              { value: 800, question: "'Something is ___ with the system' — which is more natural: INCORRECT or WRONG? Why?", answer: "Wrong. 'Something is wrong with...' is the idiomatic phrase for faults and problems. 'Incorrect' is used for answers and information." }
            ]
          },
          {
            name: "Technology",
            questions: [
              { value: 200, question: "A colleague says: 'It won't connect to the internet, but other devices can.' Identify the problem using a target phrase.", answer: "'It seems like something is wrong with [your device's] network settings' or 'It appears there's an issue with [the connection on this specific device].'" },
              { value: 400, question: "In a meeting, people can see you but can't hear you. What is the likely problem?", answer: "The wrong microphone is selected in the meeting app settings, or the microphone is muted / disabled." },
              { value: 600, question: "A document 'has disappeared'. Using target language, identify the challenge.", answer: "'The challenge we need to address is locating where the file was actually saved — it may be in a temporary or unexpected folder.'" },
              { value: 800, question: "A printer 'receives the job but never prints'. Clarify this problem using a target phrase.", answer: "'Just to clarify, the problem is that the print queue has a stuck job that is blocking all new requests.' or 'So, what you're saying is that the printer accepts the job but the page never comes out?'" }
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
          { scrambled: "GORWN",   answer: "WRONG",   hint: "Something is ___ with the system" },
          { scrambled: "SSUEI",   answer: "ISSUE",   hint: "There's an ___ regarding..." },
          { scrambled: "GNIFAC",  answer: "FACING",  hint: "We seem to be ___ a problem" },
          { scrambled: "NAILPEX", answer: "EXPLAIN", hint: "Could you ___ the issue again?" },
          { scrambled: "SERDADS", answer: "ADDRESS", hint: "The challenge we need to ___" },
          { scrambled: "YFIRACL", answer: "CLARIFY", hint: "Just to ___, the problem is..." },
          { scrambled: "CRONCEN", answer: "CONCERN", hint: "My main ___ is..." }
        ]
      }
    },

    // ── Call My Bluff ─────────────────────────────────────────
    {
      label: "Call My Bluff — Key Words",
      type: "call-my-bluff",
      content: {
        items: [
          {
            word: "CLARIFY",
            definitions: [
              "To make a problem worse by trying to solve it too quickly",
              "To make something easier to understand by explaining it more clearly",
              "To officially document and file a technical support complaint"
            ],
            answer: 1
          },
          {
            word: "ADDRESS (a problem)",
            definitions: [
              "To write an email to the person responsible for fixing the problem",
              "To find the original location where the technical fault occurred",
              "To take direct action in order to deal with a problem"
            ],
            answer: 2
          },
          {
            word: "CONCERN",
            definitions: [
              "The formal interest a manager shows when reviewing a staff complaint",
              "A worry, problem or issue that requires attention",
              "A technical term in IT reports for a recurring software fault"
            ],
            answer: 1
          },
          {
            word: "FACING (a problem)",
            definitions: [
              "Physically turning toward a screen to check for visible errors",
              "Refusing to acknowledge that a problem exists and moving on",
              "Experiencing or confronting a difficult situation or challenge"
            ],
            answer: 2
          }
        ]
      }
    },

    // ── Odd One Out ───────────────────────────────────────────
    {
      label: "Odd One Out — Phrases & Functions",
      type: "odd-one-out",
      content: {
        items: [
          {
            words: ["The main concern is...", "We seem to be facing...", "So, what you're saying is...", "It appears there's an issue..."],
            odd: "So, what you're saying is...",
            reason: "The others all IDENTIFY a problem — this one CLARIFIES by paraphrasing what someone said"
          },
          {
            words: ["Do you mean that...?", "Let me make sure I understand...", "The challenge we need to address...", "Could you explain again?"],
            odd: "The challenge we need to address...",
            reason: "The others all CLARIFY a problem — this one IDENTIFIES what needs to be dealt with"
          },
          {
            words: ["clarify", "explain", "understand", "crash"],
            odd: "crash",
            reason: "The others are communication verbs used to check understanding — 'crash' is what technology does when it fails"
          },
          {
            words: ["wifi", "printer", "password", "concern"],
            odd: "concern",
            reason: "The others are technology items — 'concern' is a target language keyword used when identifying problems"
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
          { display: "CLRFY",   answer: "CLARIFY",    hint: "Make something easier to understand" },
          { display: "DDRSS",   answer: "ADDRESS",    hint: "Deal with or tackle a problem" },
          { display: "CNCRN",   answer: "CONCERN",    hint: "A worry or issue" },
          { display: "XPLN",    answer: "EXPLAIN",    hint: "Make something clear by giving details" },
          { display: "FCNG",    answer: "FACING",     hint: "Experiencing or confronting a problem" },
          { display: "NDRSTND", answer: "UNDERSTAND", hint: "Grasp the meaning of something" },
          { display: "TCHNLGY", answer: "TECHNOLOGY", hint: "The topic of this lesson" }
        ]
      }
    },

    // ── IT Helpdesk — Scenario Cards ───────────────────────────
    {
      label: "IT Helpdesk — 8 Tickets",
      type: "scenario-cards",
      content: {
        cards: [
          {
            title: 'Nothing works since this morning',
            scenario: '"My laptop was fine yesterday, but since I switched it on this morning, nothing works properly. The internet is very slow and one of my programmes crashed twice. I haven\'t changed anything."',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: 'A system update installed overnight is still processing in the background, consuming memory and network bandwidth.',
            details: [
              'IDENTIFY: "It appears there\'s an issue with a background process — possibly an overnight system update that hasn\'t finished installing."',
              'CLARIFY: "Just to clarify, the problem is that the system is running slowly because all its resources are being used by the update."'
            ],
            hook: null
          },
          {
            title: 'The printer is lying to me',
            scenario: '"The printer says it\'s ready and online but when I press print, absolutely nothing happens. I\'ve tried three times — I can hear it make a noise but nothing comes out. I\'ve checked and the paper is definitely in the tray."',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: 'The print queue has a stuck job from a previous session that is blocking all new print requests.',
            details: [
              'IDENTIFY: "It seems like something is wrong with your print queue — a stuck job from earlier is blocking everything else."',
              'CLARIFY: "So, what you\'re saying is that the printer receives the job and makes a noise, but the page never actually comes out?"'
            ],
            hook: null
          },
          {
            title: 'My password stopped working',
            scenario: '"I tried to log in and it said my password was wrong. But I know it\'s right — I use it every day. I tried three times and then it locked me out completely. I can\'t get into anything."',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: 'The password expired automatically overnight and the system locked the account after three failed attempts with the old password.',
            details: [
              'IDENTIFY: "The main concern is that your account has been locked — most likely because your password expired and triggered an automatic security lockout."',
              'CLARIFY: "Let me make sure I understand — you entered the same password you always use, but the system said it was incorrect each time?"'
            ],
            hook: null
          },
          {
            title: 'My document has disappeared',
            scenario: '"I was working on a really important document all day yesterday and now I can\'t find it anywhere. I definitely saved it — I remember clicking save at the end. It was right there on my desktop. Now it\'s just gone."',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: 'The file was saved to a temporary auto-recovery location rather than the intended folder. The desktop shortcut may have been accidentally removed.',
            details: [
              'IDENTIFY: "The challenge we need to address is locating where the file was actually saved — it may be in a temporary or unexpected folder rather than the desktop."',
              'CLARIFY: "Could you explain the issue again? When you clicked save, did you use Save or Save As? And do you remember which folder was shown in the save dialogue?"'
            ],
            hook: null
          },
          {
            title: "They can see me but can't hear me",
            scenario: '"I joined the online meeting and everyone could see my face on the screen perfectly. But nobody could hear me speaking at all. I tried speaking louder and moving closer to the laptop but it didn\'t make any difference."',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: 'The wrong audio input device is selected in the meeting application settings. The microphone is muted or a different input (e.g. headset) is selected instead of the built-in microphone.',
            details: [
              'IDENTIFY: "We seem to be facing a problem with your microphone settings — the meeting app appears to be using the wrong audio input device."',
              'CLARIFY: "Do you mean that your microphone works in other applications, or does the sound problem happen in every programme you try?"'
            ],
            hook: null
          },
          {
            title: 'My screen is impossible to read',
            scenario: '"I moved to a different desk today and I can\'t see my screen properly at all. It\'s either too bright or there\'s a terrible reflection from the window. I\'ve tried moving my chair but it\'s still a problem every time I look at the screen."',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: 'The screen brightness is not set correctly for the new environment, and auto-brightness is disabled. The screen angle is creating glare from overhead or window lighting.',
            details: [
              'IDENTIFY: "It appears there\'s an issue with your screen settings — the brightness level isn\'t adapted to your new workspace, and the angle may be causing glare."',
              'CLARIFY: "So, what you\'re saying is that you\'ve tried adjusting your position, but you\'re still unable to see clearly because of the brightness or reflection?"'
            ],
            hook: null
          },
          {
            title: 'A strange message keeps appearing',
            scenario: '"Every time I open a specific programme, a box pops up with a message and some numbers in it. I always just click OK and then it seems to work fine. But the exact same box comes back every single time I open the programme."',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: 'The software is generating an error code on startup because it needs updating or has a version conflict with the current operating system.',
            details: [
              'IDENTIFY: "The main concern is that the software is generating a recurring error code on startup — most likely because it needs updating or has a version conflict."',
              'CLARIFY: "Let me make sure I understand — the programme works normally after you click OK, but the exact same error message appears every time you open it?"'
            ],
            hook: null
          },
          {
            title: "The wifi works — but also doesn't",
            scenario: '"I\'m connected to the wifi and the connection bar is full. Some websites load completely fine. But other websites just don\'t load at all, or they take forever. I don\'t understand — why do some work and others don\'t?"',
            verdict: '🔍 Identified',
            verdictStyle: 'warning',
            reveal: "Certain websites are being blocked by the school's network firewall or content filter. The internet connection itself is working normally.",
            details: [
              'IDENTIFY: "It seems like something is wrong with your network access permissions — the wifi is connected but certain sites appear to be filtered or blocked."',
              'CLARIFY: "Could you explain the issue again? Can you give me an example of a site that works and one that doesn\'t — that will help us identify whether it\'s a firewall issue."'
            ],
            hook: null
          }
        ]
      }
    }

  ]
};
