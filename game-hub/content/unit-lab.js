/* ================= Content bank — the LAB unit =================
   Data only, same shape as unit-4.js and unit-5.js — but this one is **not loaded
   by game-hub.html**. It is reachable only through `game-hub-lab.html`, which is
   the point: it exists to try question dynamics inside the real game-show engine
   without any of it appearing in front of a class.

   **One question type per category.** That is the whole design of this board. A
   category is Jeopardy's unit of choice, so making each one a single form turns the
   section screen into a mixing desk: pick three forms, play a board, and judge how
   each performs against the others in the same round. Mixed categories cannot
   answer that — you never know whether a clue landed because of its form or its
   content, and every clue here is drawn from the same small vocabulary field on
   purpose so the only thing that varies is *how it was asked*.

   What is here, and what is not:
   - **Six form categories** — gap, anagram, odd one out, error fix, word order,
     word bridge. All six are on the shipped `Kit.prompt` shelf, so a clue carrying
     `type:` draws itself and reveals itself with no engine change.
   - **Two reveal categories** — the question bench's Story Reveal dynamic, carried
     across as `reveal:[…]` layers that cost a slice of the tile. Not a form: this
     is a *round* shape, and it only ported cheaply because the hub already had
     hints costing clue value.
   - **Five round categories** — grouping (`group:{pick, with}`), ordering
     (`order:{scale, low, high, gloss}`), multiple choice
     (`choice:{options, answer}`), anagram (`anagram:{word}`) and word order
     (`scramble:{sentence}`). The last two are the *played* versions of the `anagram`
     and `scramble` forms above, and both are on this board on purpose: same
     vocabulary, and the only thing that differs is whether the class calls the
     answer out or every handset drags it into place. These are *rounds* in the full sense: they arm
     every phone, collect what several students do at once, and judge it when it
     settles. Grouping needed real engine work; ordering and multiple choice needed
     none at all, which is what the round registry was extracted for.
   - **Multiple choice is the control case.** It is the dullest question type here on
     purpose: if a form does not beat four options on a clue drawn from the same
     vocabulary, it is not earning the code it costs.

   Authoring rules that bit, in order of how much time they cost:
   - **A $100 tile affords exactly one layer.** A hint costs a minimum of $50
     against a $50 floor, so author one layer at $100 and two from $200 up — a
     second on a cheap tile can never be paid for and is never seen.
   - **Every category needs all five values.** Jeopardy indexes tiles by row, so a
     category short of one is not a smaller column, it is a crash.
   - **Write reveal layers hardest-first**: definition, then the word in use, then
     its shape. That ordering is what makes spending a slice of the tile a decision.
   - **The separators are load-bearing.** `/` between odd-one-out candidates,
     `*asterisks*` around the words to correct, `->` between bridge links with
     exactly one `___`. Get one wrong and the form declines to plain text rather
     than rendering nonsense — which is the intended failure, but it looks like the
     type did nothing.
   - **No prompt may repeat across banks** (the content gate enforces it).
   - **A grouping clue's decoys must themselves be a group.** Eight words split
     4/4 is what makes it a real discrimination; eight words where four obviously
     belong and four are noise is a spotting exercise. Every `with` list here is a
     second coherent set, which is Connections' whole trick. The gate checks the
     count and the overlap, but it cannot check that — read it.

   To play it: game-hub-lab.html → Lab → Jeopardy → tick the sections you want to
   compare. Hints are switched on for you by the shell, or the reveal clues have
   nothing to reveal. */
(window.UNITS = window.UNITS || []).push({
  id: "unit-lab",
  label: "Lab · question dynamics",
  card: { num: "Lab", title: "Question dynamics",
          blurb: "One question type per category, so forms can be mixed and compared in a real game show. Not lesson content.",
          sections: "L1–L8" },
  intro: "A test board, not a lesson. Each category is a single question type — pick the ones you want to compare.",

  jeopardySectionLabels: {
    'L1': "L1 · Word-level forms (anagram, bridge, odd one out)",
    'L2': "L2 · Sentence-level forms (gap, error fix, word order)",
    'L3': "L3 · Reveal — a clue that costs to open further",
    'L4': "L4 · Connections — a clue the whole room plays at once",
    'L5': "L5 · Word Thermometer — a scale the room fills in, weakest first",
    'L6': "L6 · Multiple Choice — four options, the plain control case",
    'L7': "L7 · Drag the Letters — the letters dragged into boxes on every handset",
    'L8': "L8 · Drag the Words — the sentence dragged into place on every handset",
  },

  jeopardyCategories: [
    /* ---------- L1 · word-level forms ---------- */
    { id:'lab-anagram', section:'L1', name:'Anagram', clues:[
      {v:100, q:"Unscramble: the decision a jury delivers.", a:"Verdict", type:"anagram"},
      {v:200, q:"Unscramble: a long, planned break from work.", a:"Sabbatical", type:"anagram"},
      {v:300, q:"Unscramble: kept in prison awaiting trial.", a:"Custody", type:"anagram"},
      {v:400, q:"Unscramble: a formal accusation, nothing proved yet.", a:"Allegation", type:"anagram"},
      {v:500, q:"Unscramble: cleared of a charge by a court.", a:"Acquitted", type:"anagram"},
    ]},
    { id:'lab-bridge', section:'L1', name:'Word Bridge', clues:[
      {v:100, q:"FIRE -> ___ -> SHOP", a:"work", type:"bridge"},
      {v:200, q:"CASE -> ___ -> WORK", a:"load", type:"bridge"},
      {v:300, q:"COURT -> ___ -> MATE", a:"room", type:"bridge"},
      {v:400, q:"WITNESS -> ___ -> STAND", a:"box", type:"bridge"},
      {v:500, q:"OVER -> ___ -> LOAD", a:"time", type:"bridge"},
    ]},
    { id:'lab-odd', section:'L1', name:'Odd One Out', clues:[
      {v:100, q:"Which does NOT belong: verdict / jury / sabbatical / testimony", a:"sabbatical", type:"oddoneout"},
      {v:200, q:"Which does NOT belong: promoted / redundant / dismissed / sacked", a:"promoted", type:"oddoneout"},
      {v:300, q:"Which does NOT belong: annoyed / livid / furious / delighted", a:"delighted", type:"oddoneout"},
      {v:400, q:"Which does NOT belong: perhaps / possibly / undoubtedly / conceivably", a:"undoubtedly", type:"oddoneout"},
      {v:500, q:"Which does NOT belong: purchase / assist / depart / mate", a:"mate", type:"oddoneout"},
    ]},

    /* ---------- L2 · sentence-level forms ---------- */
    { id:'lab-gap', section:'L2', name:'Gap Fill', clues:[
      {v:100, q:"He was held in ___ for six weeks before the hearing.", a:"custody"},
      {v:200, q:"Three hundred staff were made ___ when the plant closed.", a:"redundant"},
      {v:300, q:"The jury returned a ___ of not guilty after four days.", a:"verdict"},
      {v:400, q:"She took a six-month ___ to finish her book.", a:"sabbatical"},
      {v:500, q:"The committee voted ___ to approve the proposal.", a:"unanimously"},
    ]},
    { id:'lab-errorfix', section:'L2', name:'Error Fix', clues:[
      {v:100, q:"You *must to* wear a helmet on site.", a:"must", type:"errorfix"},
      {v:200, q:"She *were made* redundant last year.", a:"was made", type:"errorfix"},
      {v:300, q:"He *have been* working here since March.", a:"has been", type:"errorfix"},
      {v:400, q:"The jury *have returned* a verdict yesterday.", a:"returned", type:"errorfix"},
      {v:500, q:"I look forward to *hear* from you.", a:"hearing", type:"errorfix"},
    ]},
    { id:'lab-scramble', section:'L2', name:'Word Order', clues:[
      {v:100, q:"Word order:", a:"The jury returned a verdict of not guilty", type:"scramble"},
      {v:200, q:"Word order:", a:"Three hundred staff were made redundant", type:"scramble"},
      {v:300, q:"Word order:", a:"He was held in custody before the trial", type:"scramble"},
      {v:400, q:"Word order:", a:"She took a sabbatical to finish her book", type:"scramble"},
      {v:500, q:"Word order:", a:"The committee voted unanimously to approve it", type:"scramble"},
    ]},

    /* ---------- L3 · the Story Reveal dynamic ----------
       Every clue carries `reveal`. The prompt is deliberately thin — the definition
       alone, which is the hardest layer — and the tile pays full only if the room
       gets it from that. Two layers each, and nothing below $200, because a $100
       tile cannot afford a second. */
    { id:'lab-reveal-work', section:'L3', name:'Reveal · At work', clues:[
      /* $100 carries ONE layer, not two: a hint costs a $50 minimum against a $50
         floor, so a second could never be afforded and would sit there unseen. */
      {v:100, q:"A long, planned break from work — usually to study or travel.",
        a:"sabbatical",
        reveal:["Ten letters, begins with S. It shares a root with “Sabbath”."]},
      {v:200, q:"Someone who has lost their job — through no fault of their own.",
        a:"redundant",
        reveal:["He was one of three hundred made ___ when the plant closed.",
                "Nine letters, begins with R. The noun is “redundancy”."]},
      {v:300, q:"Keeping putting off something you know you should be doing.",
        a:"procrastinate",
        reveal:["I always ___ when the deadline is still weeks away.",
                "Thirteen letters, begins with P. The noun ends in -ation."]},
      {v:400, q:"Having far more to deal with than you can manage.",
        a:"overwhelmed",
        reveal:["She felt completely ___ by the number of emails waiting.",
                "Eleven letters, begins with O. Almost always passive: to *be* ___ *by* something."]},
      {v:500, q:"Formally moved to a more senior job.",
        a:"promoted",
        reveal:["After four years he was ___ to head of department.",
                "Eight letters, begins with P. The noun is “promotion”."]},
    ]},
    { id:'lab-reveal-law', section:'L3', name:'Reveal · Crime & justice', clues:[
      {v:100, q:"Kept in prison while still awaiting trial.",
        a:"custody",
        reveal:["Seven letters, begins with C. Also used of children after a divorce."]},
      {v:200, q:"A decision everybody agreed on — nobody against.",
        a:"unanimous",
        reveal:["The vote was ___: all twelve members backed it.",
                "Nine letters, begins with U. Stress on the second syllable: u-NAN-i-mous."]},
      {v:300, q:"A formal accusation, made before anything has been proved.",
        a:"allegation",
        reveal:["They made an ___ of fraud against him.",
                "Ten letters, begins with A. The verb is “allege”."]},
      {v:400, q:"Cleared of a charge by a court.",
        a:"acquitted",
        reveal:["The jury ___ her on all counts.",
                "Nine letters, begins with A. The noun is “acquittal”."]},
      {v:500, q:"The formal evidence a witness gives in court.",
        a:"testimony",
        reveal:["Her ___ was the only thing linking him to the scene.",
                "Nine letters, begins with T. The verb is “testify”."]},
    ]},

    /* ---------- L4 · the Connections dynamic ----------
       `group:{pick, with}` and nothing else — no `a`, because the answer *is* the
       set and writing it twice is two facts that can drift (the same mistake as a
       hexagon showing `U` over an answer beginning with I). The engine joins the
       two lists, shuffles them, and derives the answer line from `pick`.

       Eight words, four to find. The four decoys are a coherent group of their own
       in every clue here: courtroom against workplace, sacked against hired,
       hedging against certainty. That is what makes it a discrimination rather than
       a spotting exercise, and it is the one authoring rule the gate cannot check.

       Unlike every other category on this board these clues are worth the same
       whatever the tile — a set of four is a set of four — so the difficulty is in
       how close the two groups sit, not in how much is being asked for. */
    { id:'lab-group', section:'L4', clues:[
      {v:100, q:"Four of these mean the same as “very angry”. Find the four.",
        group:{ pick:["livid","furious","incensed","irate"],
                with:["grateful","content","serene","cautious"] }},
      {v:200, q:"Four of these belong in a courtroom. Find the four.",
        group:{ pick:["verdict","jury","testimony","acquittal"],
                with:["sabbatical","promotion","redundancy","overtime"] }},
      {v:300, q:"Four of these mean “let go from a job”. Find the four.",
        group:{ pick:["dismissed","sacked","redundant","discharged"],
                with:["promoted","appointed","recruited","hired"] }},
      {v:400, q:"Four of these hedge a claim — they say you are not certain. Find the four.",
        group:{ pick:["perhaps","possibly","arguably","conceivably"],
                with:["undoubtedly","certainly","definitely","unquestionably"] }},
      /* The hardest kind, and the reason the category tops out here: every one of
         the eight is a courtroom word, so the semantic field gives nothing away and
         only the compound works. */
      {v:500, q:"Four of these follow “court” to make a word or phrase. Find the four.",
        group:{ pick:["room","case","order","martial"],
                with:["bench","trial","judge","verdict"] }},
    ]},

    /* ---------- L5 · the Word Thermometer dynamic ----------
       `order:{scale, low, high, gloss}` and nothing else — the scale *is* the
       answer, written cold-end first because that is the order it gets filled in.

       Grouping asks *does this belong?*; this asks *how much?*, which is the harder
       question and the one C1 students actually plateau on. They have "angry" and
       "furious"; the distance between *irritated* and *livid* is what they are short
       of, and no gap fill can teach it because the whole point is the comparison.

       **The gloss is the teaching**, not decoration: it prints as a word locks into
       its rung, which is the one moment the room is looking straight at it. Author
       one for every word or the round is a sorting exercise.

       Five words a rung, deliberately: four is too easy to guess by elimination and
       six will not fit a clue card above the buttons. */
    { id:'lab-order', section:'L5', clues:[
      {v:100, q:"Put these in order — mildest first.",
        order:{ scale:["annoyed","irritated","angry","livid","furious"],
                low:"mildly bothered", high:"absolutely raging",
                gloss:{ annoyed:"mildly put out — the everyday one.",
                        irritated:"nagging, repeated: something keeps doing it.",
                        angry:"the plain, unmarked word.",
                        livid:"so angry you have gone quiet.",
                        furious:"visibly, loudly out of control." } }},
      {v:200, q:"Put these requests in order — most direct first.",
        order:{ scale:["Give me","Can you","Could you","Would you mind","I was wondering whether"],
                low:"blunt", high:"very polite",
                gloss:{ "Give me":"an order, not a request. Only among close friends.",
                        "Can you":"neutral and everyday; fine with colleagues.",
                        "Could you":"one step softer — the safe default at work.",
                        "Would you mind":"asks permission rather than for the thing.",
                        "I was wondering whether":"maximum distance; use with strangers and bad news." } }},
      {v:300, q:"Put these in order — least certain first.",
        order:{ scale:["conceivably","possibly","probably","almost certainly","undoubtedly"],
                low:"barely a guess", high:"no doubt at all",
                gloss:{ conceivably:"it is not impossible — barely a claim at all.",
                        possibly:"a real but open possibility.",
                        probably:"more likely than not; the everyday hedge.",
                        "almost certainly":"you would bet on it.",
                        undoubtedly:"no room left for doubt." } }},
      {v:400, q:"Put these in order — least often first.",
        order:{ scale:["hardly ever","occasionally","fairly often","frequently","invariably"],
                low:"almost never", high:"every single time",
                gloss:{ "hardly ever":"close to never, but not never.",
                        occasionally:"now and then, with gaps.",
                        "fairly often":"more than sometimes, less than usually.",
                        frequently:"a regular pattern.",
                        invariably:"without exception — a strong claim." } }},
      {v:500, q:"Put this praise in order — faintest first.",
        order:{ scale:["adequate","satisfactory","commendable","outstanding","exemplary"],
                low:"damning with faint praise", high:"the highest praise there is",
                gloss:{ adequate:"it will do. In a report this is a warning.",
                        satisfactory:"meets the standard and no more.",
                        commendable:"genuinely worth remarking on.",
                        outstanding:"stands out from everything around it.",
                        exemplary:"so good it becomes the example others follow." } }},
    ]},

    /* ---------- L6 · plain multiple choice ----------
       `choice:{options, answer}` and nothing else. The dullest question type on the
       board, here on purpose: it is the control the other nine are compared against.
       If a form does not beat four options on a clue drawn from the same vocabulary,
       it is not earning the code it costs.

       **The answer is written out as the option, never as a letter or a number.**
       The options are shuffled per clue — authors put the answer first and a class
       works that out in about two questions — so a letter could not survive, and an
       index is off by one forever the first time somebody writes 1 meaning the
       first. Written as the word, a typo matches nothing and the card says the
       question is incomplete rather than marking the wrong answer right.

       **Four options, and the distractors have to be real.** Three obviously wrong
       ones make a question that tests nothing; every decoy here is a word a C1
       student might genuinely reach for, which is what makes the choice a piece of
       language work rather than a coin toss. */
    { id:'lab-choice', section:'L6', clues:[
      {v:100, q:"Which verb goes with 'a sentence', when a judge delivers one?",
        choice:{ options:["pass","make","do","give"], answer:"pass" }},
      {v:200, q:"Which one means a decision has been overturned on appeal?",
        choice:{ options:["quashed","dismissed","adjourned","suspended"], answer:"quashed" }},
      {v:300, q:"Which is the formal one you would write in a report?",
        choice:{ options:["subsequently","after that","later on","then"],
                 answer:"subsequently" }},
      {v:400, q:"Which word means made to leave a job because the work no longer exists?",
        choice:{ options:["redundant","dismissed","resigned","suspended"],
                 answer:"redundant" }},
      {v:500, q:"Only one of these can precede 'to the letter'. Which?",
        choice:{ options:["followed","obeyed","kept","held"], answer:"followed" }},
    ]},

    /* ---------- L7 · the anagram round ----------
       The played version of the `anagram` *form* in L1, which is why the two sit on
       one board: same subject, same vocabulary field, and the only thing that
       differs is whether the class shouts the word at the teacher or every handset
       arranges it. Play both in a round and the comparison is the point.

       The clue is the definition and never the word — an anagram whose own clue
       contains the answer gives itself away, and the round's `check` says so.
       $400 and $500 carry **repeated letters** deliberately: three Es and a double
       S are the case both ends of this round are built around, and a board with
       only distinct-letter words would never exercise it. */
    { id:'lab-anagram-round', section:'L7', clues:[
      {v:100, q:"the decision a jury delivers", anagram:{ word:'verdict' }},
      {v:200, q:"money paid so somebody can be released before a trial",
        anagram:{ word:'bail' }},
      {v:300, q:"a period of leave from work, often to study",
        anagram:{ word:'sabbatical' }},
      {v:400, q:"the punishment a court hands down",
        anagram:{ word:'sentence' }},
      {v:500, q:"the facts and objects put before a court to prove something",
        anagram:{ word:'evidence' }},
    ]},

    /* ---------- L8 · the word order round ----------
       The played version of the `scramble` *form* in L2, sitting on the same board
       for the same reason the two anagrams do: identical sentences-worth of
       grammar, and the only difference is whether the class calls the order out or
       every handset builds it.

       **Every one of these repeats a word** — three `the`s in the $300 — because a
       repeated word is what breaks a picker keyed by text, and a bank of sentences
       that all happened to have distinct words would never exercise it. The prompt
       must never quote the sentence; the round's `check` says so. */
    { id:'lab-scramble-round', section:'L8', clues:[
      {v:100, q:"Put the words in order.",
        scramble:{ sentence:'The jury reached the verdict after four hours' }},
      {v:200, q:"Order the words to make a sentence.",
        scramble:{ sentence:'He was released on bail before the trial' }},
      {v:300, q:"Rebuild the sentence.",
        scramble:{ sentence:'The judge told the jury to ignore the remark' }},
      {v:400, q:"Put these in the right order.",
        scramble:{ sentence:'The appeal against the sentence was dismissed' }},
      {v:500, q:"Order the words.",
        scramble:{ sentence:'The witness whose evidence convicted him has retracted it' }},
    ]},
  ],

  /* ================= THE HEXAGON BOARD =================
     Blockbusters hosting rounds, which is the second board to do it and therefore
     the first evidence that the round tier is a shelf rather than one game's
     helper. Jeopardy alone was a guess about an API.

     **The letter is the hexagon's name, not a promise about the answer.** It is
     what a team says to pick a square ("we'll take R") and what the picking vote
     counts; the win condition searches *claimed* hexagons and has never read it.
     So a hexagon can open a grouping set with four answers or a scale with five,
     and the letter still does its whole job. What is gone is only the rule that
     the answer had to begin with it — a rule about the bank, never about the
     board.

     The mix is the point rather than a compromise. A board of eighteen rounds is
     exhausting and would tell you nothing about what a round *costs* against an
     ordinary clue; a board with six of them in it means a team picking `R` does
     not know whether they are getting a one-word definition or Connections, and
     the surprise is what the geometry buys you that a Jeopardy category cannot —
     a Jeopardy column announces its question type in its heading.

     Two sections so they can be compared: LB1 mixes, LB2 is rounds only, which is
     the version to play when tuning a round rather than a lesson. */
  /* ================= THE LADDER =================
     Millionaire draws every question through the **multiple choice round** now, so
     this bank exists to put the third round host on the same board as the other two
     — one place to try a round and compare how the three skins hold it.

     Sixteen items: **two at every rung**, because the ladder is per team and with one
     question a rung both teams meet the identical question on the way up. Graded 1→8
     on purpose: the round is the same at every rung, so the only thing that varies is
     how hard the discrimination is. Authored as `{prompt, answer, distractors, level}`
     like every other Millionaire bank — the round is derived at runtime and the bank
     never learns it. */
  millionaireSectionNames: {
    'LM1': "LM1 · Multiple choice round — a full ladder, two questions a rung",
  },

  millionaireBank: [
    {section:'LM1', level:1, prompt:"Someone who sees a crime happen is a ___.", answer:"witness",
      distractors:["juror","suspect","warden"]},
    {section:'LM1', level:1, prompt:"The group of twelve who decide a verdict are the ___.", answer:"jury",
      distractors:["bench","panel","bailiffs"]},
    {section:'LM1', level:2, prompt:"Which word means 'found not guilty'?", answer:"acquitted",
      distractors:["convicted","charged","detained"]},
    {section:'LM1', level:2, prompt:"Which word means 'let go because the job no longer exists'?", answer:"redundant",
      distractors:["dismissed","suspended","demoted"]},
    {section:'LM1', level:3, prompt:"Which verb goes with 'a crime'?", answer:"commit",
      distractors:["perform","conduct","execute"]},
    {section:'LM1', level:3, prompt:"Which verb goes with 'an appeal'?", answer:"lodge",
      distractors:["place","post","submit"]},
    {section:'LM1', level:4, prompt:"Which is the formal way to refuse a claim outright?", answer:"repudiate",
      distractors:["turn down","knock back","wave off"]},
    {section:'LM1', level:4, prompt:"Which is the formal word for a planned break from work?", answer:"sabbatical",
      distractors:["breather","time out","gap"]},
    {section:'LM1', level:5, prompt:"Which one means 'so angry you have gone quiet'?", answer:"livid",
      distractors:["annoyed","irritated","peeved"]},
    {section:'LM1', level:5, prompt:"Which one is the *weakest* claim?", answer:"conceivably",
      distractors:["probably","almost certainly","undoubtedly"]},
    {section:'LM1', level:6, prompt:"'The evidence was ___' — which means it settled the matter?", answer:"conclusive",
      distractors:["circumstantial","anecdotal","contested"]},
    {section:'LM1', level:6, prompt:"Which describes a sentence held over you unless you offend again?", answer:"suspended",
      distractors:["custodial","concurrent","consecutive"]},
    {section:'LM1', level:7, prompt:"To ___ a statement is to take it back publicly.", answer:"retract",
      distractors:["retort","retain","refute"]},
    {section:'LM1', level:7, prompt:"Which means 'apparently, but perhaps not really'?", answer:"ostensibly",
      distractors:["demonstrably","incontestably","manifestly"]},
    {section:'LM1', level:8, prompt:"A decision made with nobody against it is ___.", answer:"unanimous",
      distractors:["undisputed","unequivocal","unilateral"]},
    {section:'LM1', level:8, prompt:"Held up as the standard for everybody else, work is ___.", answer:"exemplary",
      distractors:["commendable","creditable","serviceable"]},
  ],

  blockbustersSectionNames: {
    'LB1': "LB1 · Mixed board — most hexagons are ordinary, six open a round",
    'LB2': "LB2 · Rounds only — every hexagon opens one",
  },

  blockbustersBank: [
    /* ---------- LB1 · the mixed board ----------
       Twelve ordinary clues, so one section fills the 5/4/5/4 board on its own and
       the six rounds land among them unannounced. Every answer here is one word
       whose initial is its letter, which is the ordinary Blockbusters contract and
       is still enforced for clues that have an answer at all. */
    {section:'LB1', letter:'V', clue:"What twelve jurors return at the end of a trial.", answer:"Verdict"},
    {section:'LB1', letter:'C', clue:"Held by the police or a court, before any trial has happened.", answer:"Custody"},
    {section:'LB1', letter:'A', clue:"A formal accusation, with nothing proved yet.", answer:"Allegation"},
    {section:'LB1', letter:'T', clue:"A witness's sworn account, given under oath.", answer:"Testimony"},
    {section:'LB1', letter:'S', clue:"A long, planned break from work — often to study.", answer:"Sabbatical"},
    {section:'LB1', letter:'R', clue:"Let go because the job itself no longer exists.", answer:"Redundant"},
    {section:'LB1', letter:'B', clue:"Money left with a court so an accused person can go home.", answer:"Bail"},
    {section:'LB1', letter:'P', clue:"Moved up to a more senior job.", answer:"Promoted"},
    {section:'LB1', letter:'L', clue:"So angry you have gone quiet.", answer:"Livid"},
    {section:'LB1', letter:'H', clue:"A feeling about something, on very little evidence.", answer:"Hunch"},
    {section:'LB1', letter:'W', clue:"To take back something you said publicly.", answer:"Withdraw"},
    {section:'LB1', letter:'E', clue:"Serving as the model others should follow.", answer:"Exemplary"},

    /* The six that open a round. The letter is chosen to sit naturally on the board
       rather than to encode anything — except the anagram, where the answer really
       is one word and the initial can honestly be its own. */
    {section:'LB1', letter:'F', clue:"Four of these are things a court does. Find the four.",
      group:{ pick:["convict","acquit","sentence","adjourn"],
              with:["promote","recruit","dismiss","appoint"] }},
    {section:'LB1', letter:'G', clue:"Four of these describe work that has ended badly. Find the four.",
      group:{ pick:["sacked","dismissed","redundant","discharged"],
              with:["seconded","promoted","tenured","shortlisted"] }},
    {section:'LB1', letter:'O', clue:"Put these sentences in order — lightest first.",
      order:{ scale:["a caution","a fine","community service","a suspended sentence","a custodial sentence"],
              low:"barely a punishment", high:"prison",
              gloss:{ "a caution":"a formal warning on your record and nothing more.",
                      "a fine":"money, and the matter is closed.",
                      "community service":"unpaid work — time, not money.",
                      "a suspended sentence":"prison, held over you unless you offend again.",
                      "a custodial sentence":"prison, starting now." } }},
    {section:'LB1', letter:'M', clue:"Which verb goes with “a sentence”?",
      choice:{ options:["serve","do","make","take"], answer:"serve" }},
    {section:'LB1', letter:'D', clue:"Unscramble: to say publicly that an earlier statement was wrong.",
      anagram:{ word:"Retract" }},
    {section:'LB1', letter:'N', clue:"Build the sentence from these words.",
      scramble:{ sentence:'The jury was sent home for the night' }},

    /* ---------- LB2 · rounds only ----------
       Eighteen would be a lot to author and a lot to play; this is deliberately
       short of a full board, so it is picked *alongside* LB1 rather than instead of
       it — which is also the honest way to try a round, with ordinary clues around
       it for contrast. Every round type the registry holds appears at least once,
       so registering a seventh is the only thing this section will ever need. */
    {section:'LB2', letter:'C', clue:"Four of these leave you room to be wrong. Find the four.",
      group:{ pick:["arguably","ostensibly","seemingly","reportedly"],
              with:["indisputably","categorically","demonstrably","conclusively"] }},
    {section:'LB2', letter:'K', clue:"Four of these can follow “breach of”. Find the four.",
      group:{ pick:["contract","trust","the peace","confidence"],
              with:["custody","tenure","evidence","counsel"] }},
    {section:'LB2', letter:'T', clue:"Order these claims — weakest first.",
      order:{ scale:["it is conceivable","there is a chance","it is likely","it is all but certain","it is beyond doubt"],
              low:"barely a claim", high:"no room left to argue",
              gloss:{ "it is conceivable":"you are admitting it is not impossible, and no more.",
                      "there is a chance":"a real possibility, still open.",
                      "it is likely":"you would expect it; the everyday hedge.",
                      "it is all but certain":"you would bet on it and say so.",
                      "it is beyond doubt":"a claim you are staking your credibility on." } }},
    {section:'LB2', letter:'S', clue:"Put this feedback in order — most damning first.",
      order:{ scale:["unacceptable","disappointing","adequate","commendable","exemplary"],
              low:"a formal problem", high:"the model others follow",
              gloss:{ unacceptable:"a warning in writing; this is a process, not an opinion.",
                      disappointing:"below what was expected of *you* specifically.",
                      adequate:"it met the bar and nothing more — faint praise.",
                      commendable:"genuinely good, and said in public.",
                      exemplary:"held up as the standard for everybody else." } }},
    {section:'LB2', letter:'P', clue:"Which word completes “to ___ an allegation”, meaning to deny it flatly?",
      choice:{ options:["refute","refuse","reject","revoke"], answer:"refute" }},
    {section:'LB2', letter:'A', clue:"Which of these is the formal one?",
      choice:{ options:["notwithstanding","even so","all the same","anyway"], answer:"notwithstanding" }},
    {section:'LB2', letter:'I', clue:"Unscramble: found not guilty and formally released.",
      anagram:{ word:"Acquitted" }},
    {section:'LB2', letter:'U', clue:"Unscramble: agreed by every single member, with nobody against.",
      anagram:{ word:"Unanimous" }},
    {section:'LB2', letter:'W', clue:"Put this sentence back together.",
      scramble:{ sentence:'The witness told the court that the letter was not his' }},
    {section:'LB2', letter:'B', clue:"Arrange these words into a sentence.",
      scramble:{ sentence:'She was released on bail on the day of the hearing' }},
  ],

  /* ---- Race to the Board ----------------------------------------------------
     **Both kinds of item in one bank, which is the whole point of this section.**
     An ordinary item puts its answer on the board as a tile a student runs up and
     touches; a round item has no single answer, so it puts nothing on the board and
     is played on the handsets while the board waits. Mixing them is a burst of
     running broken by a question the whole room assembles — and this is the only
     place to find out whether that rhythm works or ruins the game. */
  raceSectionNames: {
    'LR1': 'LR1 · Race — words to touch and rounds to play (11)',
  },
  raceBank: [
    {section:'LR1', topic:'LR1-mixed', prompt:"The jury returned a ___ of not guilty.", answer:"verdict"},
    {section:'LR1', topic:'LR1-mixed', prompt:"He was held in ___ until the trial began.", answer:"custody"},
    {section:'LR1', topic:'LR1-mixed', prompt:"She was granted ___ and went home that evening.", answer:"bail"},
    {section:'LR1', topic:'LR1-mixed', prompt:"The court heard the ___ from three witnesses.", answer:"evidence"},
    {section:'LR1', topic:'LR1-mixed', prompt:"They lodged an ___ against the sentence.", answer:"appeal"},
    {section:'LR1', topic:'LR1-mixed', prompt:"The judge passed a five-year ___.", answer:"sentence"},
    {section:'LR1', topic:'LR1-mixed', prompt:"He entered a ___ of not guilty.", answer:"plea"},
    /* **No option may be a word on the board.** Every ordinary answer in this
       section is scattered as a tile, so an option that matches one hands the class
       a free tile and reads as a mistake. The gate cannot catch it — it is about
       what else is in the bank, not about the item. */
    {section:'LR1', topic:'LR1-mixed', prompt:"Which word means the court let you go?",
      choice:{ options:["acquitted","convicted","charged","remanded"], answer:"acquitted" }},
    /* Same rule as the choice item above, and it is the one this section is easiest
       to get wrong: none of these eight may be a word scattered on the board, or the
       round is quietly pointing at the answer to somebody else's sentence. */
    {section:'LR1', topic:'LR1-mixed', prompt:"Four of these mean breaking the law. Find the four.",
      group:{ pick:["offence","crime","violation","breach"], with:["defence","witness","hearing","juror"] }},
    /* **The bingo round on a board that is not Bingo**, which is the whole point of
       it being a round: a card in every hand, persisting across all twelve calls,
       inside a game of Race. No word here is a tile on this board. */
    {section:'LR1', topic:'LR1-mixed', prompt:"Bingo — listen for your words.",
      bingo:{ calls:[
        { clue:"The twelve who decide.",                    answer:"jury" },
        { clue:"Formally accused of a crime.",              answer:"charged" },
        { clue:"Found not guilty and released.",            answer:"acquitted" },
        { clue:"Found guilty by a court.",                  answer:"convicted" },
        { clue:"A punishment paid in money.",               answer:"fine" },
        { clue:"The lawyer who argues against you.",        answer:"prosecutor" },
        { clue:"Someone who saw what happened.",            answer:"witness" },
        { clue:"The room where a trial is held.",           answer:"courtroom" },
        { clue:"Time served instead of prison, at home.",   answer:"probation" },
        { clue:"The person accused, standing in the dock.", answer:"defendant" },
        { clue:"What a guilty person may show afterwards.", answer:"remorse" },
        { clue:"A written promise to appear in court.",     answer:"summons" }
      ] }},
    {section:'LR1', topic:'LR1-mixed', prompt:"Rank these from the weakest claim to the firmest.",
      order:{ scale:["doubt","suspect","believe","know","certain"],
              low:"barely a hunch", high:"beyond question",
              gloss:{ doubt:"you lean against it.", suspect:"a feeling with little behind it.",
                      believe:"you would say it out loud.", know:"you could show why.",
                      certain:"there is nothing left to argue." } }},
  ],
});
