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
   - **One grouping category** — Connections inside a tile, as `group:{pick, with}`.
     This one is a *round* in the full sense: it arms every phone with a multi-pick
     selection, collects each team's picks as a union, and judges a set of four the
     moment it settles. Nothing on the shipped shelf could do that, so it is the
     first dynamic carried over that needed new engine work rather than a field.
   - **The thermometer is NOT here yet.** Ordering needs a clue whose answer is a
     *sequence*, which the grouping round deliberately does not model — a set has no
     order and judging one is a comparison, not a walk.

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
          sections: "L1–L4" },
  intro: "A test board, not a lesson. Each category is a single question type — pick the ones you want to compare.",

  jeopardySectionLabels: {
    'L1': "L1 · Word-level forms (anagram, bridge, odd one out)",
    'L2': "L2 · Sentence-level forms (gap, error fix, word order)",
    'L3': "L3 · Reveal — a clue that costs to open further",
    'L4': "L4 · Grouping — a clue the whole room plays at once",
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
    { id:'lab-group', section:'L4', name:'Find the Four', clues:[
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
  ],
});
