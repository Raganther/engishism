/* ================= Content bank — B2 · Stereotypes & generalising =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   A standalone B2 pack for a discussion lesson on stereotypes — the level between
   the New English File units (A2–B1) and the Empower C1 units, which nothing else
   here covered. Five Jeopardy columns, each a MIXED column in the 4B shape: five
   clues at $100–$500, the round type rising in difficulty ($100 Multiple Choice →
   $200 Connections → $300 Drag the Letters → $400 Word Thermometer → $500 Drag the
   Words), and the $400 slot follows the 4B rule "a scale where one exists, a form
   where it does not" — four columns have a real cline, "Where They Come From" has
   none, so its $400 and $500 are two Drag the Words sentences (the Have/Get shape).

   **The one rule every question here is written under: no clue ever asks a student
   to match a trait to a group.** A question like "which nationality is famous for
   X" would make the game teach the stereotype, whatever the lesson around it says.
   So the target language is the language *about* stereotyping — how to generalise
   carefully, what the nouns mean, how to push back, what makes a belief stick, and
   what you can do to one. Every example sentence is about the mechanism, never
   about a named group. That also makes the pack safe to run in any classroom.

   **Jeopardy only, deliberately** — a unit shows only the games it has a bank for,
   and this exists for one discussion lesson. Every clue states its own context, so
   a teacher who has not planned the lesson can still play it.

   **The Multiple Choice and Connections clues carry `physics:true`** — the flag the
   content screen's Tap/Flick toggle writes onto a row's items — because the toggle
   only appears on a row whose five clues are one round, and every column here is
   mixed. So the whole pack opens on the physics face.

   B2, so the vocabulary is solid B2 with a few stretch items held back to $400–$500
   (deeply rooted, disprove, invariably). */
window.UNITS.push({
  id: 'stereotypes',
  label: 'B2 · Stereotypes & generalising',
  card: { num:'B2', title:'Stereotypes',
          blurb:'Generalising carefully, the words for a fixed idea, pushing back on a sweeping statement, where beliefs come from, and what you can do to one. Mixed rounds throughout.',
          sections:'ST' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    'ST': 'Stereotypes · talking about them without repeating them'
  },

  jeopardyCategories: [
    /* ---- 1 · hedging: how to make a claim about many people survive contact
            with the exceptions. The scale at $400 is frequency, which is the
            cleanest cline in the pack. ---- */
    { id:'st-hedging', section:'ST', name:'Generalising Carefully', clues:[
      {v:100, q:"'___, people are more polite face to face than online.' Which opening makes this a careful claim rather than an absolute one?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["Broadly speaking","Without exception","Every single time","In all cases"],
                 answer:"Broadly speaking" }},
      {v:200, q:"Four of these soften a claim; four state it as absolute. Find the four that soften it.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["tend to","on the whole","more often than not","broadly speaking"],
                with:["always","without exception","invariably","in every case"] }},
      {v:300, q:"'It is risky to ___ about a whole country from one holiday.' To make a broad claim from a few cases. (10 letters)",
        anagram:{ word:"generalise" }},
      {v:400, q:"Put these in order — least often first.",
        order:{ scale:["rarely","now and again","more often than not","as a rule","without exception"],
                low:"almost never", high:"every single time",
                gloss:{ rarely:"it happens, but hardly ever.",
                        'now and again':"occasionally, with long gaps.",
                        'more often than not':"just over half the time.",
                        'as a rule':"normally — this is what you expect.",
                        'without exception':"every time, with nothing left out." } }},
      {v:500, q:"Put the words in order — a claim with the hedge built in.",
        scramble:{ sentence:"On the whole people tend to judge others by appearances" }},
    ]},

    /* ---- 2 · the nouns. The $400 cline is the lesson itself: the same belief
            moving from a thought to an action. ---- */
    { id:'st-words', section:'ST', name:'The Words For It', clues:[
      {v:100, q:"A fixed idea about a whole group, held before you have met anyone in it. Which word is it?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["a stereotype","a memory","a coincidence","a fact"],
                 answer:"a stereotype" }},
      {v:200, q:"Four of these are words for a fixed idea; four name a group of people. Find the four that are ideas.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["stereotype","assumption","generalisation","cliché"],
                with:["minority","community","nationality","generation"] }},
      {v:300, q:"'She admitted that her ___ against people from the north was unfair.' A negative feeling formed in advance. (9 letters)",
        anagram:{ word:"prejudice" }},
      {v:400, q:"Put these in order — a thought first, an action last.",
        order:{ scale:["assumption","generalisation","stereotype","prejudice","discrimination"],
                low:"a guess in your head", high:"treating someone worse for it",
                gloss:{ assumption:"something you take to be true without checking.",
                        generalisation:"a claim about many people, made from a few.",
                        stereotype:"a fixed idea about a whole group.",
                        prejudice:"a negative feeling towards that group.",
                        discrimination:"acting on it — treating them worse." } }},
      {v:500, q:"Put the words in order — the definition itself.",
        scramble:{ sentence:"A stereotype is a fixed idea about a whole group" }},
    ]},

    /* ---- 3 · the functional language for disagreeing with a generalisation.
            The $400 cline is how hard you push, which mirrors 4C's tact work. ---- */
    { id:'st-pushback', section:'ST', name:'Pushing Back', clues:[
      {v:100, q:"'All teenagers are lazy.' What do we call a claim as broad as that?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["a sweeping statement","a fair point","a minor detail","an exception"],
                 answer:"a sweeping statement" }},
      {v:200, q:"Four of these challenge a generalisation; four accept it. Find the four that challenge it.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["not necessarily","it depends","there are exceptions","that is too broad"],
                with:["exactly","absolutely","that is true","fair enough"] }},
      {v:300, q:"'Most of them are, but there is always an ___.' The one the rule does not cover. (9 letters)",
        anagram:{ word:"exception" }},
      {v:400, q:"Put these in order — mildest disagreement first.",
        order:{ scale:["fair enough","up to a point","I'm not so sure","I'd have to disagree","that's simply not true"],
                low:"you accept it", high:"you reject it outright",
                gloss:{ 'fair enough':"you are going along with it.",
                        'up to a point':"partly true — you accept some of it.",
                        "I'm not so sure":"you are doubting it, without saying it is wrong.",
                        "I'd have to disagree":"you say plainly that you think it is wrong.",
                        "that's simply not true":"flat rejection, no softening at all." } }},
      {v:500, q:"Put the words in order — the reply to a sweeping statement.",
        scramble:{ sentence:"There are always exceptions to a statement that broad" }},
    ]},

    /* ---- 4 · collocations for where a belief comes from and why it lasts. No
            natural cline, so $400 and $500 are two Drag the Words sentences —
            the 4B Have/Get shape — one for the source, one for the staying
            power, each cued in its own prompt so they cannot be confused. ---- */
    { id:'st-source', section:'ST', name:'Where They Come From', clues:[
      {v:100, q:"'It is a ___ belief, but there is no evidence for it at all.' Which phrase means a lot of people hold it?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["widely held","narrow-minded","short-lived","self-made"],
                 answer:"widely held" }},
      {v:200, q:"Four of these describe an idea; four describe a person. Find the four that describe an idea.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["outdated","misleading","widely held","deeply rooted"],
                with:["open-minded","judgemental","tolerant","narrow-minded"] }},
      {v:300, q:"'The advert gives a ___ picture of who actually does this job.' It makes you believe something untrue. (10 letters)",
        anagram:{ word:"misleading" }},
      {v:400, q:"Put the words in order — where they come from.",
        scramble:{ sentence:"Films and adverts reinforce the stereotypes we grow up with" }},
      {v:500, q:"Put the words in order — why they last.",
        scramble:{ sentence:"These beliefs are deeply rooted and hard to shift" }},
    ]},

    /* ---- 5 · the verbs that act on a stereotype. The $200 set and the $400
            cline are the same fact twice: everything you can do to one sits
            somewhere between making it stronger and showing it is false. ---- */
    { id:'st-verbs', section:'ST', name:'What You Do To One', clues:[
      {v:100, q:"'Adverts like that only ___ the stereotype.' Which verb means to make it stronger?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["reinforce","challenge","disprove","question"],
                 answer:"reinforce" }},
      {v:200, q:"Four of these make a stereotype stronger; four weaken it. Find the four that weaken it.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["challenge","question","break down","disprove"],
                with:["reinforce","confirm","spread","repeat"] }},
      {v:300, q:"'Her job is to ___ the assumptions people bring with them.' To argue openly against an idea. (9 letters)",
        anagram:{ word:"challenge" }},
      {v:400, q:"Put these in order — strengthens it most first.",
        order:{ scale:["reinforce","repeat","question","challenge","disprove"],
                low:"you make it stronger", high:"you show it is false",
                gloss:{ reinforce:"you make the idea stronger than it was.",
                        repeat:"you pass it on unchanged.",
                        question:"you start to doubt it out loud.",
                        challenge:"you argue against it openly.",
                        disprove:"you show, with evidence, that it is false." } }},
      {v:500, q:"Put the words in order — what actually works.",
        scramble:{ sentence:"Meeting people is the best way to break down a stereotype" }},
    ]},
  ]
});
