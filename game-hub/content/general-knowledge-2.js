/* ================= Content bank — B1–B2 · General Knowledge 2 =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   The second general-knowledge board for Flip, a step harder than the first. Same
   shape — five columns, each two Multiple Choice, two Connections and one Drag the
   Letters, rising in value — so the three fastest rounds alone fill a 5 × 5 board.
   Harder means the knowledge sits one layer down (a date, a plural, a prime, a
   region rather than a city) and the Connections decoys are closer to the pick
   set (EU members against European non-members, British words against their
   American twins, energy units against length units). Every decoy set is a
   coherent group of its own, and every column still asks Italy in English last,
   where the language is hardest.

   No clue gives away another in its own column, and no prompt repeats the first
   board's. Every Multiple Choice and Connections clue carries `physics:true`
   (mixed columns have no content-screen toggle). Jeopardy only, deliberately —
   Flip flattens these columns into its pool. */
window.UNITS.push({
  id: 'general-knowledge-2',
  label: 'B1–B2 · General Knowledge 2',
  card: { num:'B1–B2', title:'General Knowledge 2',
          blurb:'A harder quiz night in English: history, science and numbers, words and languages, the world, and Italy. Twenty-five questions in the three fastest rounds — a full Flip board.',
          sections:'GK2' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    GK2: 'General knowledge 2 · history, science, words, the world and Italy — harder'
  },

  jeopardyCategories: [
    { id:'gk2-history', section:'GK2', name:'History & Dates', clues:[
      { v:100, q:"In which year did the Berlin Wall come down?", physics:true,
        choice:{ options:["1979","1985","1989","1991"], answer:"1989" } },
      { v:200, q:"Four of these were Roman emperors; four were Greek philosophers. Find the four emperors.", physics:true,
        group:{ pick:["Augustus","Nero","Hadrian","Trajan"], with:["Socrates","Plato","Aristotle","Pythagoras"] } },
      { v:300, q:"'The ___ was the movement in art and learning that began in Florence in the 1400s.' (11 letters)",
        anagram:{ word:"renaissance" } },
      { v:400, q:"Who was the first person to walk on the Moon?", physics:true,
        choice:{ options:["Yuri Gagarin","Neil Armstrong","Buzz Aldrin","John Glenn"], answer:"Neil Armstrong" } },
      { v:500, q:"Four of these were invented before the year 1500; four were invented after. Find the four from before 1500.", physics:true,
        group:{ pick:["paper","the compass","gunpowder","the printing press"], with:["the telescope","the steam engine","the telephone","the bicycle"] } }
    ]},
    { id:'gk2-science', section:'GK2', name:'Science & Numbers', clues:[
      { v:100, q:"Which planet is closest to the Sun?", physics:true,
        choice:{ options:["Mercury","Venus","Mars","Earth"], answer:"Mercury" } },
      { v:200, q:"Four of these numbers are prime; four are not. Find the four primes.", physics:true,
        group:{ pick:["2","13","29","31"], with:["9","15","21","27"] } },
      { v:300, q:"'___ is the force that keeps the planets in orbit around the Sun.' (7 letters)",
        anagram:{ word:"gravity" } },
      { v:400, q:"How many chromosomes does a typical human cell have?", physics:true,
        choice:{ options:["23","42","46","64"], answer:"46" } },
      { v:500, q:"Four of these units measure energy or power; four measure length. Find the four for energy or power.", physics:true,
        group:{ pick:["joule","watt","calorie","kilowatt-hour"], with:["metre","mile","inch","light-year"] } }
    ]},
    { id:'gk2-words', section:'GK2', name:'Words & Languages', clues:[
      { v:100, q:"Which language has the most native speakers in the world?", physics:true,
        choice:{ options:["English","Spanish","Mandarin Chinese","Hindi"], answer:"Mandarin Chinese" } },
      { v:200, q:"Four of these countries have Spanish as an official language; four have Portuguese. Find the four with Spanish.", physics:true,
        group:{ pick:["Mexico","Argentina","Colombia","Peru"], with:["Brazil","Angola","Mozambique","Portugal"] } },
      { v:300, q:"'A word that reads the same forwards and backwards, like 'level', is a ___.' (10 letters)",
        anagram:{ word:"palindrome" } },
      { v:400, q:"Which is the correct plural of 'crisis'?", physics:true,
        choice:{ options:["crisises","crises","crisi","crisis's"], answer:"crises" } },
      { v:500, q:"Four of these are British English words; four are the American words for the same things. Find the four British words.", physics:true,
        group:{ pick:["lorry","flat","holiday","lift"], with:["truck","apartment","vacation","elevator"] } }
    ]},
    { id:'gk2-world', section:'GK2', name:'The World, Harder', clues:[
      { v:100, q:"Which is the smallest country in the world?", physics:true,
        choice:{ options:["Monaco","Vatican City","San Marino","Malta"], answer:"Vatican City" } },
      { v:200, q:"Four of these countries are in the European Union; four are in Europe but not in the EU. Find the four in the EU.", physics:true,
        group:{ pick:["Croatia","Ireland","Finland","Slovenia"], with:["the United Kingdom","Switzerland","Serbia","Iceland"] } },
      { v:300, q:"'Mount ___ is the highest mountain in the world.' (7 letters)",
        anagram:{ word:"everest" } },
      { v:400, q:"Which country has the largest population in the world today?", physics:true,
        choice:{ options:["China","India","the USA","Indonesia"], answer:"India" } },
      { v:500, q:"Four of these cities are on the Mediterranean Sea; four are capitals that are not. Find the four on the Mediterranean.", physics:true,
        group:{ pick:["Barcelona","Marseille","Naples","Athens"], with:["Lisbon","Paris","Madrid","Berlin"] } }
    ]},
    { id:'gk2-italy', section:'GK2', name:'Italy in English, Harder', clues:[
      { v:100, q:"In which century did Dante write the Divine Comedy?", physics:true,
        choice:{ options:["the 12th","the 14th","the 16th","the 18th"], answer:"the 14th" } },
      { v:200, q:"Four of these are Italian regions; four are Italian cities. Find the four regions.", physics:true,
        group:{ pick:["Umbria","Molise","Basilicata","Marche"], with:["Bologna","Turin","Palermo","Genoa"] } },
      { v:300, q:"'Shakespeare wrote The ___ of Venice.' A person who buys and sells goods. (8 letters)",
        anagram:{ word:"merchant" } },
      { v:400, q:"What is the English name of the volcano near Naples that buried Pompeii?", physics:true,
        choice:{ options:["Etna","Vesuvius","Stromboli","Vulcano"], answer:"Vesuvius" } },
      { v:500, q:"Four of these English words come from Italian music; four come from Italian food. Find the four from music.", physics:true,
        group:{ pick:["soprano","tempo","opera","solo"], with:["espresso","pasta","gelato","salami"] } }
    ]}
  ]
});
