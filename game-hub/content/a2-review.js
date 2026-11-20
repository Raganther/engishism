/* ================= Content bank — A2 · Grammar & Vocabulary Review =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   Built for Flip from a teacher's A2 Grammar and Vocabulary Test, one column per
   section of the test, AT the test's level: the same words, short sentences and
   short instructions an A2 class can read alone. Four round types only — Multiple
   Choice, Connections, Drag the Letters and Drag the Words — so every card is
   judged from the phones.

   Every Connections decoy set is a group of its own (on/off verbs against the rest,
   weather against places, adjectives against nouns, animals with wings against
   without, farm against wild, 1900s against 2000s, people against things). 2010 is
   not asked, because both of its spoken forms are right. Every Multiple Choice and
   Connections clue carries `physics:true`, because mixed columns have no
   content-screen Tap/Flick toggle. Jeopardy only, deliberately — Flip flattens
   these columns into its pool and deals 25 of the 35. */
window.UNITS.push({
  id: 'a2-review',
  label: 'A2 · Grammar & Vocabulary Review',
  card: { num:'A2', title:'Grammar & Vocabulary Review',
          blurb:'Phrasal verbs, weather, animals, years, and something / anywhere / nobody.',
          sections:'A2' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    A2: 'A2 review · phrasal verbs, weather, animals, years, something / nobody'
  },

  jeopardyCategories: [
    { id:'a2-phrasal', section:'A2', name:'Phrasal Verbs', clues:[
      { v:100, q:"My alarm ___ at six.", physics:true,
        choice:{ options:["went off","tried on","looked after","gave up"], answer:"went off" } },
      { v:200, q:"Find the 4 verbs with ON or OFF.", physics:true,
        group:{ pick:["turn on","turn off","try on","go off"], with:["wake up","give up","look after","go out"] } },
      { v:300, q:"I looked ___ my friend's cat. (5 letters)",
        anagram:{ word:"after" } },
      { v:400, q:"Ben ___ smoking two years ago.", physics:true,
        choice:{ options:["gave up","went out","woke up","turned on"], answer:"gave up" } },
      { v:500, q:"Make the sentence.",
        scramble:{ sentence:"Please turn off the TV" } }
    ]},
    { id:'a2-weather-adj', section:'A2', name:'Strong, Heavy, Thick', clues:[
      { v:100, q:"We got wet in the ___ rain.", physics:true,
        choice:{ options:["heavy","steep","bright","high"], answer:"heavy" } },
      { v:200, q:"Find the 4 about the weather.", physics:true,
        group:{ pick:["heavy rain","strong wind","thick fog","bright sun"], with:["steep hill","high mountain","tall tree","deep sea"] } },
      { v:300, q:"It's hard to cycle up this ___ hill. (5 letters)",
        anagram:{ word:"steep" } },
      { v:400, q:"I can't see the road. The fog is very ___.", physics:true,
        choice:{ options:["thick","steep","high","bright"], answer:"thick" } },
      { v:500, q:"Make the sentence.",
        scramble:{ sentence:"The mountain is very high" } }
    ]},
    { id:'a2-weather-words', section:'A2', name:'Rain or Rainy?', clues:[
      { v:100, q:"It's a ___ day.", physics:true,
        choice:{ options:["rainy","rain","rains","rained"], answer:"rainy" } },
      { v:200, q:"Find the 4 adjectives. (It's a ___ day.)", physics:true,
        group:{ pick:["sunny","cloudy","windy","snowy"], with:["sun","cloud","wind","snow"] } },
      { v:300, q:"I heard loud ___ in the storm. (7 letters)",
        anagram:{ word:"thunder" } },
      { v:400, q:"It often ___ here in winter.", physics:true,
        choice:{ options:["snows","snowy","snow","snowing"], answer:"snows" } },
      { v:500, q:"Make the sentence.",
        scramble:{ sentence:"The sun is shining today" } }
    ]},
    { id:'a2-body', section:'A2', name:'Animal Body Parts', clues:[
      { v:100, q:"Birds use their ___ to fly.", physics:true,
        choice:{ options:["wings","fins","paws","hooves"], answer:"wings" } },
      { v:200, q:"Find the 4 animals with wings.", physics:true,
        group:{ pick:["bird","duck","bee","bat"], with:["dog","cat","horse","cow"] } },
      { v:300, q:"A happy dog wags its ___. (4 letters)",
        anagram:{ word:"tail" } },
      { v:400, q:"A shark has ___ to help it swim.", physics:true,
        choice:{ options:["fins","wings","paws","hooves"], answer:"fins" } },
      { v:500, q:"Make the sentence.",
        scramble:{ sentence:"A cat has soft paws" } }
    ]},
    { id:'a2-animals', section:'A2', name:'Pets, Farm & Wild', clues:[
      { v:100, q:"Which animal is a pet?", physics:true,
        choice:{ options:["a hamster","a lion","a cow","a tiger"], answer:"a hamster" } },
      { v:200, q:"Find the 4 farm animals.", physics:true,
        group:{ pick:["cow","pig","sheep","goat"], with:["lion","tiger","bear","elephant"] } },
      { v:300, q:"A farmer keeps a ___ for milk. (3 letters)",
        anagram:{ word:"cow" } },
      { v:400, q:"Which animal is a wild animal?", physics:true,
        choice:{ options:["a lion","a dog","a cat","a sheep"], answer:"a lion" } },
      { v:500, q:"Make the sentence.",
        scramble:{ sentence:"We have a dog and a cat" } }
    ]},
    { id:'a2-years', section:'A2', name:'Saying Years', clues:[
      { v:100, q:"How do we say 1990?", physics:true,
        choice:{ options:["nineteen ninety","one nine nine zero","nineteen nine","one thousand ninety"], answer:"nineteen ninety" } },
      { v:200, q:"How do we say 2002?", physics:true,
        choice:{ options:["two thousand and two","twenty-two","two hundred and two","two zero zero two"], answer:"two thousand and two" } },
      { v:300, q:"Find the 4 years from the 1900s.", physics:true,
        group:{ pick:["nineteen oh five","nineteen fifty","nineteen eighty","nineteen ninety-nine"],
                with:["two thousand and two","two thousand and five","twenty twenty","twenty twenty-five"] } },
      { v:400, q:"1905 = nineteen oh ___ (4 letters)",
        anagram:{ word:"five" } },
      { v:500, q:"Make the sentence.",
        scramble:{ sentence:"I was born in nineteen ninety-nine" } }
    ]},
    { id:'a2-something', section:'A2', name:'Somebody, Nothing, Anywhere', clues:[
      { v:100, q:"The room is empty. ___ is there.", physics:true,
        choice:{ options:["Nobody","Somebody","Anybody","Something"], answer:"Nobody" } },
      { v:200, q:"I'm hungry. I want ___ to eat.", physics:true,
        choice:{ options:["something","somebody","anywhere","nowhere"], answer:"something" } },
      { v:300, q:"Find the 4 words for people.", physics:true,
        group:{ pick:["somebody","anybody","nobody","everybody"], with:["something","anything","nothing","everything"] } },
      { v:400, q:"Is there ___ in your bag?", physics:true,
        choice:{ options:["anything","anywhere","nowhere","somewhere"], answer:"anything" } },
      { v:500, q:"Make the sentence.",
        scramble:{ sentence:"Let's go somewhere warm" } }
    ]}
  ]
});
