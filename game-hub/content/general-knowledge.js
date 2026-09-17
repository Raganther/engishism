/* ================= Content bank — B1–B2 · General Knowledge =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   Written for Flip, and for Italian teenagers. Flip deals a square board from the
   Jeopardy clues a unit carries, and a teacher narrowing to the three rounds a
   room plays fastest — Multiple Choice, Connections, Drag the Letters — needs
   twenty-five of THOSE to fill a 5 × 5. Every unit before this one holds fifteen,
   so the board stepped down to nine. This bank is twenty-five of exactly those
   three: each column is two Multiple Choice, two Connections and one Drag the
   Letters, rising in value ($100 easiest).

   The knowledge is general and the English is the work: a B1 student answers from
   what they already know, in the other language. Every Connections decoy set is a
   coherent group of its own, with a trap that makes a group talk before it flicks
   (Milan among the capitals, the dolphin among the mammals, the computer among
   the Italian inventions — and NOT the telephone, which an Italian class would
   rightly claim for Meucci). The last column asks them to say Italy in English,
   which is where the language is hardest.

   No clue gives away another in its own column. Every Multiple Choice and
   Connections clue carries `physics:true`, because the content screen's Tap/Flick
   toggle only appears on a row of one round type and every column here is mixed.
   Jeopardy only, deliberately — Flip flattens these columns into its pool, and a
   unit shows only the games it has a bank for. */
window.UNITS.push({
  id: 'general-knowledge',
  label: 'B1–B2 · General Knowledge',
  card: { num:'B1–B2', title:'General Knowledge',
          blurb:'A quiz night in English: the world, science, screens, sport and Italy. Twenty-five questions in the three fastest rounds — built to fill a Flip board.',
          sections:'GK' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    GK: 'General knowledge · the world, science, screens, sport and Italy'
  },

  jeopardyCategories: [
    { id:'gk-world', section:'GK', name:'The World', clues:[
      { v:100, q:"Which is the largest country in the world by area?", physics:true,
        choice:{ options:["Russia","Canada","China","the USA"], answer:"Russia" } },
      { v:200, q:"Four of these are capital cities; four are famous cities that are not capitals. Find the four capitals.", physics:true,
        group:{ pick:["Madrid","Lisbon","Berlin","Vienna"], with:["Milan","Barcelona","Munich","Venice"] } },
      { v:300, q:"'The ___ is the largest hot desert in the world, across the north of Africa.' (6 letters)",
        anagram:{ word:"sahara" } },
      { v:400, q:"Which of these countries is NOT in the European Union?", physics:true,
        choice:{ options:["Norway","Portugal","Poland","Ireland"], answer:"Norway" } },
      { v:500, q:"Four of these countries are in South America; four are in Africa. Find the four in South America.", physics:true,
        group:{ pick:["Peru","Chile","Colombia","Uruguay"], with:["Kenya","Ghana","Morocco","Senegal"] } }
    ]},
    { id:'gk-science', section:'GK', name:'Science & the Body', clues:[
      { v:100, q:"How many bones does an adult human have, roughly?", physics:true,
        choice:{ options:["106","206","306","406"], answer:"206" } },
      { v:200, q:"Four of these are gases; four are metals. Find the four gases.", physics:true,
        group:{ pick:["oxygen","hydrogen","helium","nitrogen"], with:["iron","gold","copper","silver"] } },
      { v:300, q:"'Plants take in carbon ___ and give out oxygen.' The gas we breathe out. (7 letters)",
        anagram:{ word:"dioxide" } },
      { v:400, q:"What is the chemical symbol for gold?", physics:true,
        choice:{ options:["Au","Ag","Go","Gd"], answer:"Au" } },
      { v:500, q:"Four of these animals are mammals; four are reptiles. Find the four mammals.", physics:true,
        group:{ pick:["dolphin","bat","whale","elephant"], with:["crocodile","lizard","snake","turtle"] } }
    ]},
    { id:'gk-screens', section:'GK', name:'Screens & Songs', clues:[
      { v:100, q:"Which country makes the anime 'One Piece' and 'Naruto'?", physics:true,
        choice:{ options:["China","Japan","Korea","Thailand"], answer:"Japan" } },
      { v:200, q:"Four of these are Marvel heroes; four are DC heroes. Find the Marvel four.", physics:true,
        group:{ pick:["Iron Man","Thor","Spider-Man","Hulk"], with:["Batman","Superman","The Flash","Aquaman"] } },
      { v:300, q:"'The film won an ___ for Best Picture.' The golden statue given in Hollywood every year. (5 letters)",
        anagram:{ word:"oscar" } },
      { v:400, q:"Which streaming service made 'Stranger Things'?", physics:true,
        choice:{ options:["Netflix","Disney+","Prime Video","HBO"], answer:"Netflix" } },
      { v:500, q:"Four of these characters come from video games; four come from TV cartoons. Find the four from video games.", physics:true,
        group:{ pick:["Mario","Sonic","Pac-Man","Lara Croft"], with:["Homer Simpson","SpongeBob","Scooby-Doo","Peppa Pig"] } }
    ]},
    { id:'gk-sport', section:'GK', name:'Sport', clues:[
      { v:100, q:"How many players does a football team have on the pitch?", physics:true,
        choice:{ options:["9","10","11","12"], answer:"11" } },
      { v:200, q:"Four of these sports use a ball; four do not. Find the four WITHOUT a ball.", physics:true,
        group:{ pick:["swimming","cycling","fencing","skiing"], with:["tennis","rugby","volleyball","golf"] } },
      { v:300, q:"'Italy has won the World Cup four times, but ___ has won it five.' The country with the most wins. (6 letters)",
        anagram:{ word:"brazil" } },
      { v:400, q:"How often are the Summer Olympic Games held?", physics:true,
        choice:{ options:["every 2 years","every 3 years","every 4 years","every 5 years"], answer:"every 4 years" } },
      { v:500, q:"Four of these words come from tennis; four come from football. Find the four from tennis.", physics:true,
        group:{ pick:["ace","deuce","love","set"], with:["corner","offside","penalty","goalkeeper"] } }
    ]},
    { id:'gk-italy', section:'GK', name:'Italy in English', clues:[
      { v:100, q:"Which Italian scientist was the first to point a telescope at the night sky?", physics:true,
        choice:{ options:["Galileo","Da Vinci","Volta","Marconi"], answer:"Galileo" } },
      { v:200, q:"Four of these were invented by Italians; four were not. Find the Italian four.", physics:true,
        group:{ pick:["piano","battery","radio","espresso machine"], with:["computer","light bulb","television","aeroplane"] } },
      { v:300, q:"'Firenze is called ___ in English.' The city of the Renaissance. (8 letters)",
        anagram:{ word:"florence" } },
      { v:400, q:"What is the English name of the sea between Italy and Croatia?", physics:true,
        choice:{ options:["the Adriatic","the Tyrrhenian","the Ionian","the Ligurian"], answer:"the Adriatic" } },
      { v:500, q:"Four of these English words come from Italian; four come from French. Find the four from Italian.", physics:true,
        group:{ pick:["pizza","umbrella","balcony","volcano"], with:["café","ballet","chef","restaurant"] } }
    ]}
  ]
});
