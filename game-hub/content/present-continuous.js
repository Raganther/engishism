/* Present Continuous — A2
   =======================

   A standalone grammar unit for an A2 (elementary/pre-intermediate) class, above
   the single elementary column in `grammar-1` and its own lesson. Four Jeopardy
   columns, one per language point — spelling the -ing form, present continuous
   against present simple ("now" vs "every day"), questions & negatives, and
   describing a scene ("Look! / Listen!").

   **Same round set as the General Knowledge units, and the same reasons.** Only the
   three physics (Matter.js / `Kit.table`) rounds a room plays fastest — Multiple
   Choice, Connections and Drag the Letters — two Multiple Choice, two Connections
   and one Drag the Letters per column, rising in value ($100 easiest). Every
   Multiple Choice and Connections clue carries `physics:true`: those two rounds
   vote by default, and the content screen's Tap/Flick toggle only appears on a row
   of ONE round type, so on a mixed column the flag on the item is how the clue
   reaches the flick face. Drag the Letters is a physics round already, so it needs
   no flag. This also fills a Flip board cleanly, since Flip flattens these columns
   into its pool.

   Every Connections decoy set is a coherent group of its own — a discrimination,
   not a spotting exercise: correct spellings against their common misspelling,
   "now" actions against the same verbs as a routine, present-continuous short
   answers (be) against present-simple ones (do). A2 vocabulary throughout, every
   clue states its own context, and no prompt repeats one in `grammar-1`.

   Jeopardy only, deliberately — a unit shows only the games it has a bank for. */
window.UNITS.push({
  id: 'present-continuous',
  label: 'Grammar · Present Continuous (A2)',
  card: { num:'A2', title:'Present Continuous',
          blurb:'Present continuous for A2 in the three fastest rounds — Multiple Choice, Connections and Drag the Letters. Spelling the -ing form, now vs every day, questions & negatives, and what is happening.',
          sections:'PC' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    'PC': 'Present Continuous (A2)'
  },

  jeopardyCategories: [
    { id:'pc-spelling', section:'PC', name:'Spelling: the -ing form', clues:[
      {v:100, q:"To make the present continuous you add -ing. Which spelling of 'sit' is correct?", physics:true,
        choice:{ options:["sitting","siting","siteing","sitin"], answer:"sitting" }},
      {v:200, q:"Four of these -ing forms are spelled correctly; four have the common mistake. Find the four correct ones.", physics:true,
        group:{ pick:["running","making","swimming","writing"],
                with:["runing","makeing","swiming","writeing"] }},
      {v:300, q:"'The cat is ___ in the sun on the wall.' The -ing form of 'lie' (l-i-e becomes -y-i-n-g). (5 letters)",
        anagram:{ word:"lying" }},
      {v:400, q:"Which is the correct -ing form of 'have'? (drop the -e)", physics:true,
        choice:{ options:["having","haveing","haing","havng"], answer:"having" }},
      {v:500, q:"Four of these DOUBLE the last letter before -ing; four drop the -e. Find the four that double.", physics:true,
        group:{ pick:["stopping","running","swimming","sitting"],
                with:["making","having","writing","dancing"] }},
    ]},

    { id:'pc-now-vs-everyday', section:'PC', name:'Now or Every Day?', clues:[
      {v:100, q:"'Usually I walk to school, but today I ___ the bus because it's raining.' Which is correct?", physics:true,
        choice:{ options:["am taking","take","takes","taking"], answer:"am taking" }},
      {v:200, q:"Four of these describe RIGHT NOW, not every day. Find the four.", physics:true,
        group:{ pick:["He is sleeping","They are eating","She is studying","We are watching TV"],
                with:["He sleeps late","They eat at eight","She studies hard","We watch films"] }},
      {v:300, q:"'Listen! The baby ___ next door.' The -ing form of 'cry'. (6 letters)",
        anagram:{ word:"crying" }},
      {v:400, q:"'My grandmother usually reads in the evening, but tonight she ___ television.' Which is correct?", physics:true,
        choice:{ options:["is watching","watches","watch","watching"], answer:"is watching" }},
      {v:500, q:"Four of these time words go with the present continuous (now). Find the four.", physics:true,
        group:{ pick:["now","at the moment","right now","today"],
                with:["every day","usually","on Mondays","twice a week"] }},
    ]},

    { id:'pc-questions', section:'PC', name:'Questions & Negatives', clues:[
      {v:100, q:"Make it a question: 'They are working today.' → '___ they working today?'", physics:true,
        choice:{ options:["Are","Do","Is","Be"], answer:"Are" }},
      {v:200, q:"Four of these questions and negatives are correct; four are wrong. Find the four correct ones.", physics:true,
        group:{ pick:["Is he coming?","They aren't listening","Are you leaving?","She isn't working"],
                with:["Does he coming?","They don't listening","Do you leaving?","She not working"] }},
      {v:300, q:"'She isn't ___ today — she's at home in bed.' The -ing form of 'work'. (7 letters)",
        anagram:{ word:"working" }},
      {v:400, q:"Choose the correct negative: 'The children ___ to me!'", physics:true,
        choice:{ options:["aren't listening","don't listening","isn't listening","not listening"], answer:"aren't listening" }},
      {v:500, q:"Four of these short answers use the present continuous correctly. Find the four.", physics:true,
        group:{ pick:["Yes, I am","No, she isn't","Yes, they are","No, we aren't"],
                with:["Yes, I do","No, she doesn't","Yes, they do","No, we don't"] }},
    ]},

    { id:'pc-scene', section:'PC', name:"Look! What's Happening?", clues:[
      {v:100, q:"'Look! That dog ___ into the river!' Which is correct?", physics:true,
        choice:{ options:["is jumping","jumps","jumping","is jump"], answer:"is jumping" }},
      {v:200, q:"Four of these describe the weather RIGHT NOW. Find the four.", physics:true,
        group:{ pick:["It's snowing","It's raining","The sun is shining","The wind is blowing"],
                with:["It snows in winter","It rains a lot here","The sun shines in July","The wind blows hard"] }},
      {v:300, q:"'Be careful — you ___ on my foot!' The -ing form of 'stand'. (8 letters)",
        anagram:{ word:"standing" }},
      {v:400, q:"'Look at the sky! That plane ___ very low.' Which is correct?", physics:true,
        choice:{ options:["is flying","flies","fly","flying"], answer:"is flying" }},
      {v:500, q:"Four of these describe a photo of a beach right now. Find the four.", physics:true,
        group:{ pick:["A girl is swimming","Two boys are playing","A dog is running","A man is sleeping"],
                with:["A girl swims here","Two boys play here","A dog runs here","A man sleeps here"] }},
    ]},
  ]
});
