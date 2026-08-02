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
    'L4': "L4 · Grouping — a clue the whole room plays at once",
    'L5': "L5 · Ordering — a scale the room fills in, weakest first",
    'L6': "L6 · Multiple choice — four options, the plain control case",
    'L7': "L7 · Anagram — the letters dragged into boxes on every handset",
    'L8': "L8 · Word order — the sentence dragged into place on every handset",
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
    { id:'lab-group', section:'L4', name:'Connections', clues:[
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
    { id:'lab-order', section:'L5', name:'Word Thermometer', clues:[
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
    { id:'lab-choice', section:'L6', name:'Multiple Choice', clues:[
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
    { id:'lab-anagram-round', section:'L7', name:'Drag the Letters', clues:[
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
    { id:'lab-scramble-round', section:'L8', name:'Drag the Words', clues:[
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
});
