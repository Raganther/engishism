/* Present Continuous — A2
   =======================

   A standalone grammar unit for an A2 (elementary/pre-intermediate) class, above
   the single elementary column in `grammar-1` and its own lesson. Four Jeopardy
   columns, one per language point — spelling the -ing form, present continuous
   against present simple ("now" vs "every day"), questions & negatives, and
   describing a scene ("Look! / Listen!") — each a MIXED column in the 4B shape:
   five clues at $100–$500, the round type rising in difficulty
   ($100 Multiple Choice → $200 Connections → $300 Drag the Letters → $400 a form →
   $500 Drag the Words).

   The $400 slot follows the 4B rule "a scale where one exists, a form where it does
   not": the present continuous has no scale, so each $400 is an error-correction (a
   verb-form fix is exactly what teaches the point) or, in the last column, an
   odd-one-out that discriminates the continuous from the simple.

   **Jeopardy only, deliberately** — a unit shows only the games it has a bank for,
   and this exists for one grammar lesson. A2 vocabulary throughout, every clue
   states its own context so a teacher who has not seen a syllabus can still play it,
   and no prompt repeats one in `grammar-1`'s present-continuous column. */
window.UNITS.push({
  id: 'present-continuous',
  label: 'Grammar · Present Continuous (A2)',
  card: { num:'A2', title:'Present Continuous',
          blurb:'Present continuous for A2: spelling the -ing form, now vs every day, questions & negatives, and describing what is happening. Jeopardy, mixed rounds.',
          sections:'PC' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    'PC': 'Present Continuous (A2)'
  },

  jeopardyCategories: [
    { id:'pc-spelling', section:'PC', name:'Spelling: the -ing form', clues:[
      {v:100, q:"To make the present continuous you add -ing. Which spelling of 'sit' is correct?",
        choice:{ options:["sitting","siting","siteing","sitin"], answer:"sitting" }},
      {v:200, q:"Four of these -ing forms are spelled correctly. Find the four.",
        group:{ pick:["running","making","swimming","writing"],
                with:["runing","makeing","swiming","writeing"] }},
      {v:300, q:"'The cat is ___ in the sun on the wall.' The -ing form of 'lie' (l-i-e becomes -y-i-n-g). (5 letters)",
        anagram:{ word:"lying" }},
      {v:400, q:"Correct it: 'My dad is *makeing* a cake for my birthday.' (drop the -e before -ing)",
        a:"making", type:"errorfix"},
      {v:500, q:"Put the words in order — say what she is doing.",
        scramble:{ sentence:"She is writing a letter to her friend" }},
    ]},

    { id:'pc-now-vs-everyday', section:'PC', name:'Now or Every Day?', clues:[
      {v:100, q:"'Usually I walk to school, but today I ___ the bus because it's raining.' Which is correct?",
        choice:{ options:["am taking","take","takes","taking"], answer:"am taking" }},
      {v:200, q:"Four of these describe RIGHT NOW, not every day. Find the four.",
        group:{ pick:["He is sleeping","They are eating","She is studying","We are watching TV"],
                with:["He sleeps late","They eat at eight","She studies hard","We watch films"] }},
      {v:300, q:"'Listen! The baby ___ next door.' The -ing form of 'cry'. (6 letters)",
        anagram:{ word:"crying" }},
      {v:400, q:"Correct it: 'Every day my sister *is going* to the gym after work.' (a routine = present simple)",
        a:"goes", type:"errorfix"},
      {v:500, q:"Put the words in order — say what is happening now.",
        scramble:{ sentence:"At the moment we are waiting for the bus" }},
    ]},

    { id:'pc-questions', section:'PC', name:'Questions & Negatives', clues:[
      {v:100, q:"Make it a question: 'They are working today.' → '___ they working today?'",
        choice:{ options:["Are","Do","Is","Be"], answer:"Are" }},
      {v:200, q:"Four of these questions and negatives are correct. Find the four.",
        group:{ pick:["Is he coming?","They aren't listening","Are you leaving?","She isn't working"],
                with:["Does he coming?","They don't listening","Do you leaving?","She not working"] }},
      {v:300, q:"'She isn't ___ today — she's at home in bed.' The -ing form of 'work'. (7 letters)",
        anagram:{ word:"working" }},
      {v:400, q:"Correct it: 'What *you are* doing with my phone?' (question word order)",
        a:"are you", type:"errorfix"},
      {v:500, q:"Put the words in order to make a question.",
        scramble:{ sentence:"Why are you wearing my jacket" }},
    ]},

    { id:'pc-scene', section:'PC', name:"Look! What's Happening?", clues:[
      {v:100, q:"'Look! That dog ___ into the river!' Which is correct?",
        choice:{ options:["is jumping","jumps","jumping","is jump"], answer:"is jumping" }},
      {v:200, q:"Four of these describe the weather RIGHT NOW. Find the four.",
        group:{ pick:["It's snowing","It's raining","The sun is shining","The wind is blowing"],
                with:["It snows in winter","It rains a lot here","The sun shines in July","The wind blows hard"] }},
      {v:300, q:"'Be careful — you ___ on my foot!' The -ing form of 'stand'. (8 letters)",
        anagram:{ word:"standing" }},
      {v:400, q:"Which one is NOT happening now: is cooking / cooks / is cleaning / is washing",
        a:"cooks — it is present simple, so it means every day, not now", type:"oddoneout"},
      {v:500, q:"Put the words in order — describe the picture.",
        scramble:{ sentence:"A man is taking a photo of the bridge" }},
    ]},
  ]
});
