/* ================= Content bank — the LAB unit =================
   Data only, same shape as unit-4.js and unit-5.js — but this one is **not loaded
   by game-hub.html**. It is reachable only through `game-hub-lab.html`, which is
   the point: it exists to try question dynamics inside the real game-show engine
   without any of it appearing in front of a class.

   What it is for. The question bench (playground/) invents dynamics with phones;
   the hub runs game shows. This unit is the first attempt to carry one across —
   Story Reveal, where a clue opens terse and each extra layer costs a slice of what
   the tile pays. In Jeopardy that is `reveal:[…]` on an item plus the hint button
   the `jHints` setting already provides, so **no new game and no new engine path**:
   the same clue card, the same scoring, the same phones.

   Two things worth knowing before authoring more here:
   - **`reveal` is per item, not per bank.** An item without it falls back to the
     engine's generated spelling hints, so nothing already authored changed.
   - **Write the layers hardest-first.** The first should be answerable by a student
     who knows the word cold; the last should nearly give it away. That ordering is
     the whole game — it is what makes spending a slice of the tile a decision.

   To play it: game-hub-lab.html → Lab → Jeopardy. Turn `jHints` on in ⚙ (the Lab
   ruleset below does it for you) or the reveal clues have nothing to reveal. */
(window.UNITS = window.UNITS || []).push({
  id: "unit-lab",
  label: "Lab · question dynamics",
  card: { num: "Lab", title: "Question dynamics",
          blurb: "A test board for carrying question-bench dynamics into a game show. Not lesson content.",
          sections: "L1–L2" },
  intro: "A test board, not a lesson. Pick both sections to see every dynamic in one game.",

  jeopardySectionLabels: {
    'L1': "L1 · Reveal — a clue that costs to open further",
    'L2': "L2 · Forms — the question forms, one of each",
  },

  jeopardyCategories: [
    /* ---- L1: the Story Reveal port ----
       Every clue here carries `reveal`. The prompt is deliberately thin: it is the
       definition alone, which is the hardest layer, and the tile pays full only if
       the room gets it from that. Press the hint button and the next layer appears
       for a slice of the value, exactly as the bench game drops 5 → 4 → 3. */
    { id:'lab-reveal-people', section:'L1', name:'Reveal · People at work', clues:[
      {v:100, q:"Someone who has lost their job — through no fault of their own.",
        a:"redundant",
        reveal:["Three hundred staff were made ___ when the plant closed.",
                "Nine letters, begins with R. The noun is “redundancy”."]},
      {v:200, q:"A long, planned break from work — usually to study or travel.",
        a:"sabbatical",
        reveal:["She took a six-month ___ to finish her book.",
                "Ten letters, begins with S. It shares a root with “Sabbath”."]},
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

    { id:'lab-reveal-justice', section:'L1', name:'Reveal · Crime & justice', clues:[
      {v:100, q:"The decision a jury delivers at the end of a trial.",
        a:"verdict",
        reveal:["After four days, the jury returned a ___ of not guilty.",
                "Seven letters, begins with V. A jury *returns* it; a judge *passes* a sentence."]},
      {v:200, q:"A decision everybody agreed on — nobody against.",
        a:"unanimous",
        reveal:["The vote was ___: all twelve members backed it.",
                "Nine letters, begins with U. Stress on the second syllable: u-NAN-i-mous."]},
      {v:300, q:"Kept in prison while still awaiting trial.",
        a:"custody",
        reveal:["He was held in ___ for six weeks before the hearing.",
                "Seven letters, begins with C. Also used of children after a divorce."]},
      {v:400, q:"A formal accusation, made before anything has been proved.",
        a:"allegation",
        reveal:["They made an ___ of fraud against him.",
                "Ten letters, begins with A. The verb is “allege”, and the adverb “allegedly” is everywhere in news writing."]},
      {v:500, q:"Cleared of a charge by a court.",
        a:"acquitted",
        reveal:["The jury ___ her on all counts.",
                "Nine letters, begins with A. The noun is “acquittal”."]},
    ]},

    /* ---- L2: the question forms, one of each ----
       Not a new dynamic — this is the *existing* `Kit.prompt` shelf gathered onto
       one board, because the forms have never been seen together in a real game.
       Density is the open problem there (24 typed items in 589), so a category
       where every clue carries a type is the fastest way to judge whether they read
       well on a projector and whether the reveals land. */
    { id:'lab-forms-a', section:'L2', name:'Forms · Gap, anagram, odd one out', clues:[
      {v:100, q:"He was held in ___ before the trial.", a:"custody"},
      {v:200, q:"Unscramble: the decision a jury delivers.", a:"Verdict", type:"anagram"},
      {v:300, q:"Which does NOT belong: verdict / jury / sabbatical / testimony", a:"sabbatical", type:"oddoneout"},
      {v:400, q:"Unscramble: a long, planned break from work.", a:"Sabbatical", type:"anagram"},
      {v:500, q:"Which does NOT belong: promoted / redundant / dismissed / acquitted", a:"acquitted", type:"oddoneout"},
    ]},

    { id:'lab-forms-b', section:'L2', name:'Forms · Error fix & word order', clues:[
      {v:100, q:"You *must to* wear a helmet on site.", a:"must", type:"errorfix"},
      {v:200, q:"She *were made* redundant last year.", a:"was made", type:"errorfix"},
      {v:300, q:"Word order:", a:"The jury returned a verdict of not guilty", type:"scramble"},
      {v:400, q:"He *have been* working here since March.", a:"has been", type:"errorfix"},
      {v:500, q:"Word order:", a:"Three hundred staff were made redundant", type:"scramble"},
    ]},
  ],
});
