/* ================= Content bank — B1–B2 · Inventions & the passive =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   The passive voice taught on the topic it was made for: nearly every sentence
   anyone writes about an invention is passive, because what matters is the thing
   rather than the person. So the grammar and the general knowledge are the same
   questions — a column is named for its language point, in the 4B shape (five
   clues at $100–$500, the round rising: $100 Multiple Choice → $200 Connections →
   $300 Drag the Letters → $400 Word Thermometer → $500 Drag the Words), and what
   every clue is ABOUT is inventions: who made what, when, what things are made
   from, and how a product gets from an idea to a shop.

   **$400 follows 4B's rule — a scale where one exists, a form where it does not.**
   Three columns have a real cline (two of them chronological, which is the honest
   shape for a topic made of dates and stages); "By Whom?" has none, so it takes the
   Have/Get shape of two Drag the Words sentences, deliberately contrasting the two
   cases a student has to choose between — the agent named, and the agent dropped
   because nobody in particular did it. "Been Done" takes an error-fix instead,
   which is what a wrong auxiliary actually needs.

   **No clue gives away another in its own column.** The trap is a $100 whose answer
   is the $300 anagram, or a $200 tile that names it; every column was checked for
   it, which is why "Was It Invented?" asks for `built` at $300 rather than the
   `invented` its $100 hands over.

   Jeopardy only, deliberately — a unit shows only the games it has a bank for.
   Every Multiple Choice and Connections clue carries `physics:true`, because the
   content screen's Tap/Flick toggle only appears on a row of one round type and
   every column here is mixed; the flag on the item is how a mixed column reaches
   the flick face. Every clue states its own context, so a teacher who has not
   planned the lesson can still play it. */
window.UNITS.push({
  id: 'inventions',
  label: 'B1–B2 · Inventions & the passive',
  card: { num:'B1–B2', title:'Inventions',
          blurb:'The passive voice on the topic it was made for: what was invented when, what things are made from, when to name who did it, and how an idea reaches a shop. Mixed rounds throughout.',
          sections:'IN' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    'IN': 'Inventions · the passive voice, and who made what'
  },

  jeopardyCategories: [
    /* ---- 1 · was/were + past participle, the tense the whole topic is written
            in. The $400 is a real chronology, so the scale is general knowledge
            and the ordering is not arguable at that spacing. ---- */
    { id:'in-past', section:'IN', name:'Was It Invented?', clues:[
      {v:100, q:"'The telephone ___ by Alexander Graham Bell in 1876.' Which one completes it?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["was invented","was invent","were invented","is invented"],
                 answer:"was invented" }},
      {v:200, q:"Four of these are passive; four are active. Find the four that are passive.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["was invented","were designed","was discovered","were produced"],
                with:["invented it","designed them","discovered them","produced it"] }},
      {v:300, q:"'The printing press was ___ in Germany around 1440.' The past participle of 'build'. (5 letters)",
        anagram:{ word:"built" }},
      {v:400, q:"Put these in order — the oldest invention first.",
        order:{ scale:["printing press","steam engine","telephone","television","internet"],
                low:"invented first", high:"invented most recently",
                gloss:{ 'printing press':"Germany, around 1440 — the oldest here by three centuries.",
                        'steam engine':"the early 1700s, and what started the industrial age.",
                        telephone:"patented in 1876.",
                        television:"first demonstrated in the 1920s.",
                        internet:"the first network was connected in 1969." } }},
      {v:500, q:"Put the words in order — what the first computers were like.",
        scramble:{ sentence:"Early computers were made from thousands of glass valves" }},
    ]},

    /* ---- 2 · is/are + past participle, for what is true now. The $200 sets the
            two tenses against each other, which is the choice a student actually
            gets wrong; the $400 is the order a product is made in. ---- */
    { id:'in-present', section:'IN', name:'Is It Made?', clues:[
      {v:100, q:"'Paper ___ from wood.' Which one completes it?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["is made","is make","are made","makes"],
                 answer:"is made" }},
      {v:200, q:"Four of these are about now; four are about the past. Find the four about now.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["is made","are grown","is produced","are recycled"],
                with:["was made","were grown","was produced","were recycled"] }},
      {v:300, q:"'Glass bottles are ___ down and made into new ones.' Turned to liquid by heat. (6 letters)",
        anagram:{ word:"melted" }},
      {v:400, q:"Put these in order — the first stage of making something first.",
        order:{ scale:["design","raw materials","manufacture","packaging","delivery"],
                low:"before anything is made", high:"it reaches the shop",
                gloss:{ design:"somebody draws it before anything is bought.",
                        'raw materials':"the wood, metal or plastic it will be made from.",
                        manufacture:"the factory actually makes it.",
                        packaging:"it is boxed so it survives the journey.",
                        delivery:"it is taken to the shops." } }},
      {v:500, q:"Put the words in order — where chocolate comes from.",
        scramble:{ sentence:"Chocolate is made from beans that are grown in West Africa" }},
    ]},

    /* ---- 3 · the agent. No cline exists for "should you name who did it", so
            $400 and $500 are the Have/Get shape: two sentences, one with the
            agent named and one without, each cued in its own prompt. That pair
            IS the lesson — a student who can say why the second drops it has
            understood what the passive is for. ---- */
    { id:'in-agent', section:'IN', name:'By Whom?', clues:[
      {v:100, q:"'The telephone was invented ___ Alexander Graham Bell.' Which word introduces the person who did it?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["by","from","with","of"], answer:"by" }},
      {v:200, q:"Four of these are people; four are things people made or found. Find the four people.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["Edison","Bell","Curie","Gutenberg"],
                with:["telephone","penicillin","printing press","light bulb"] }},
      {v:300, q:"'The person who makes something new is called the ___.' (8 letters)",
        anagram:{ word:"inventor" }},
      {v:400, q:"Put the words in order — the person is named.",
        scramble:{ sentence:"The first light bulb was developed by Thomas Edison" }},
      {v:500, q:"Put the words in order — nobody in particular did it, so no name.",
        scramble:{ sentence:"Millions of plastic bottles are thrown away every single day" }},
    ]},

    /* ---- 4 · the passive after an auxiliary or a modal — has been, can be,
            must be. No scale (a cline of modals is arguable, and an arguable
            scale marks a reasonable answer wrong), so $400 is an error-fix,
            which is exactly what a wrong auxiliary needs. ---- */
    { id:'in-modal', section:'IN', name:'Been Done', clues:[
      {v:100, q:"'Smartphones ___ used by billions of people since 2007.' Which one completes it?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["have been","have","has been","are been"],
                 answer:"have been" }},
      {v:200, q:"Four of these are correct after a modal; four are wrong. Find the four that are correct.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["can be recycled","must be tested","should be replaced","will be launched"],
                with:["can be recycle","must tested","should be replace","will launched"] }},
      {v:300, q:"'An old phone should be ___ rather than thrown away.' Used a second time. (6 letters)",
        anagram:{ word:"reused" }},
      {v:400, q:"Correct the passive: 'The new model *was launch* last week.'",
        a:"was launched", type:"errorfix"},
      {v:500, q:"Put the words in order — what to do with old batteries.",
        scramble:{ sentence:"Old batteries must be taken to a recycling centre" }},
    ]},

    /* ---- 5 · the verbs the topic runs on, and the one distinction students
            get wrong every time: you invent what did not exist and you discover
            what did. The $200 set is that distinction; the $400 is the road from
            an idea to a shop. ---- */
    { id:'in-verbs', section:'IN', name:'Words For Inventing', clues:[
      {v:100, q:"Fleming did not make penicillin — he found it by chance in 1928. Which verb describes what he did?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["discovered","invented","manufactured","designed"],
                 answer:"discovered" }},
      {v:200, q:"Four of these mean to make something that never existed; four mean to find something that already did. Find the four that mean to make.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["invent","design","develop","build"],
                with:["discover","find","uncover","spot"] }},
      {v:300, q:"'You must ___ an invention to stop other companies copying it.' Register it legally. (6 letters)",
        anagram:{ word:"patent" }},
      {v:400, q:"Put these in order — the earliest stage first.",
        order:{ scale:["idea","design","prototype","production","launch"],
                low:"it only exists in somebody's head", high:"anyone can buy it",
                gloss:{ idea:"somebody thinks of it, and nothing exists yet.",
                        design:"it is drawn and worked out properly.",
                        prototype:"the first one is built, to see whether it works.",
                        production:"the factory starts making them in numbers.",
                        launch:"it goes on sale." } }},
      {v:500, q:"Put the words in order — what happens before a product is sold.",
        scramble:{ sentence:"A prototype is tested many times before it is sold" }},
    ]},
  ]
});
