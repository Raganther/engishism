/* ================= Content bank — B1–B2 · World Quiz =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   A general-knowledge board for an international room — no country's own syllabus
   behind it, so it is the one the public demo (`?demo=1`) deals. Same shape as the
   two General Knowledge boards: five columns, each two Multiple Choice, two
   Connections and one Drag the Letters, rising in value, so the three fastest
   rounds alone fill Flip's 5 × 5.

   The knowledge is general and the English is the work, and one column is English
   itself — a synonym, irregular past forms, an antonym, the present perfect with
   "since", silent letters — because a quiz night in English should ask a little
   about English.

   Every Connections decoy set is a coherent group of its own (rivers against
   mountain ranges, birds against mammals — the penguin and the ostrich are the
   trap, organs against bones, string against wind, Pixar against DreamWorks, court
   against field, card games against board games). Every Multiple Choice has one
   answer a careful adult would defend. No clue gives away another in its own
   column. Every Multiple Choice and Connections clue carries `physics:true`, because
   mixed columns have no content-screen Tap/Flick toggle. Jeopardy only, deliberately
   — Flip flattens these columns into its pool. */
window.UNITS.push({
  id: 'world-quiz',
  label: 'B1–B2 · World Quiz',
  card: { num:'B1–B2', title:'World Quiz',
          blurb:'A general-knowledge quiz night in English: the world, science and nature, the English language, screens and music, sport and games.',
          sections:'WQ' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    WQ: 'World quiz · the world, science, English, screens and sport'
  },

  jeopardyCategories: [
    { id:'wq-world', section:'WQ', name:'The World', clues:[
      { v:100, q:"What is the capital city of Australia?", physics:true,
        choice:{ options:["Canberra","Sydney","Melbourne","Perth"], answer:"Canberra" } },
      { v:200, q:"Which four are rivers?", physics:true,
        group:{ pick:["Nile","Amazon","Danube","Mississippi"], with:["Alps","Andes","Himalayas","Rockies"] } },
      { v:300, q:"'The ___ is the largest and deepest ocean on Earth.' (7 letters)",
        anagram:{ word:"pacific" } },
      { v:400, q:"Which of these countries is partly in Europe and partly in Asia?", physics:true,
        choice:{ options:["Turkey","Greece","Egypt","Iran"], answer:"Turkey" } },
      { v:500, q:"Which four cities are in the Southern Hemisphere?", physics:true,
        group:{ pick:["Auckland","Cape Town","Buenos Aires","Lima"], with:["Cairo","Tokyo","Toronto","Mumbai"] } }
    ]},
    { id:'wq-science', section:'WQ', name:'Science & Nature', clues:[
      { v:100, q:"Which planet is known as the Red Planet?", physics:true,
        choice:{ options:["Mars","Venus","Jupiter","Saturn"], answer:"Mars" } },
      { v:200, q:"Which four animals are birds?", physics:true,
        group:{ pick:["penguin","ostrich","eagle","owl"], with:["bat","whale","dolphin","kangaroo"] } },
      { v:300, q:"'At sea level, water boils at 100 degrees ___.' (7 letters)",
        anagram:{ word:"celsius" } },
      { v:400, q:"Which gas do plants take in from the air to make their food?", physics:true,
        choice:{ options:["carbon dioxide","oxygen","nitrogen","helium"], answer:"carbon dioxide" } },
      { v:500, q:"Which four are organs of the body?", physics:true,
        group:{ pick:["liver","lungs","heart","kidney"], with:["femur","skull","rib","pelvis"] } }
    ]},
    { id:'wq-english', section:'WQ', name:'The English Language', clues:[
      { v:100, q:"Which word means almost the same as 'happy'?", physics:true,
        choice:{ options:["cheerful","angry","tired","nervous"], answer:"cheerful" } },
      { v:200, q:"Which four past forms are irregular?", physics:true,
        group:{ pick:["went","saw","took","began"], with:["walked","played","wanted","stopped"] } },
      { v:300, q:"'A word with the opposite meaning, like cold for hot, is an ___.' (7 letters)",
        anagram:{ word:"antonym" } },
      { v:400, q:"Which sentence is correct?", physics:true,
        choice:{ options:["She has lived here since 2015.","She lives here since 2015.","She is living here since 2015.","She lived here since 2015."],
                 answer:"She has lived here since 2015." } },
      { v:500, q:"Which four words have a silent letter?", physics:true,
        group:{ pick:["knife","island","castle","wrist"], with:["planet","garden","window","basket"] } }
    ]},
    { id:'wq-screens', section:'WQ', name:'Screens & Music', clues:[
      { v:100, q:"Which band sang 'Hey Jude' and 'Let It Be'?", physics:true,
        choice:{ options:["The Beatles","The Rolling Stones","Queen","ABBA"], answer:"The Beatles" } },
      { v:200, q:"Which four instruments have strings?", physics:true,
        group:{ pick:["violin","guitar","harp","cello"], with:["flute","trumpet","clarinet","saxophone"] } },
      { v:300, q:"'In The Lion King, the young lion who becomes king is called ___.' (5 letters)",
        anagram:{ word:"simba" } },
      { v:400, q:"Bollywood is the film industry of which country?", physics:true,
        choice:{ options:["India","Pakistan","Nigeria","Brazil"], answer:"India" } },
      { v:500, q:"Which four are Pixar films?", physics:true,
        group:{ pick:["Toy Story","Up","Coco","Cars"], with:["Shrek","Madagascar","Kung Fu Panda","Trolls"] } }
    ]},
    { id:'wq-sport', section:'WQ', name:'Sport & Games', clues:[
      { v:100, q:"In which sport do players hit a shuttlecock?", physics:true,
        choice:{ options:["badminton","tennis","squash","table tennis"], answer:"badminton" } },
      { v:200, q:"Which four sports are played on a court?", physics:true,
        group:{ pick:["basketball","tennis","volleyball","squash"], with:["cricket","rugby","baseball","polo"] } },
      { v:300, q:"'In chess, the ___ can move only one square at a time, in any direction.' (4 letters)",
        anagram:{ word:"king" } },
      { v:400, q:"How many rings are there on the Olympic flag?", physics:true,
        choice:{ options:["4","5","6","7"], answer:"5" } },
      { v:500, q:"Which four are card games?", physics:true,
        group:{ pick:["poker","bridge","solitaire","blackjack"], with:["chess","Monopoly","Scrabble","backgammon"] } }
    ]}
  ]
});
