/* ================= Content bank — A2 · Grammar & Vocabulary Review =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   Built for Flip from a teacher's A2 Grammar and Vocabulary Test, one column per
   section of the test, a step harder than the test itself: phrasal verbs, weather
   collocations, weather nouns / verbs / adjectives, animal body parts, pets / farm /
   wild animals, saying years, and something / anywhere / nobody. Each column rises
   from a recognition question at $100 to a sentence the room must build at $500.

   Every Connections decoy set is a coherent group of its own (machines against daily
   routine, HEAVY against STRONG, adjectives against their nouns, paws against hooves,
   farm against wild, years said with "oh" against years that are not, places against
   people). Every Multiple Choice has one answer a careful teacher would defend —
   2002 offers "two thousand and two" and no "twenty oh two", and 2010 is not asked,
   because both of its spoken forms are right. Every Multiple Choice and Connections
   clue carries `physics:true`, because mixed columns have no content-screen
   Tap/Flick toggle. Jeopardy only, deliberately — Flip flattens these columns into
   its pool and deals 25 of the 35. */
window.UNITS.push({
  id: 'a2-review',
  label: 'A2 · Grammar & Vocabulary Review',
  card: { num:'A2', title:'Grammar & Vocabulary Review',
          blurb:'Phrasal verbs, weather, animals, saying years, and something / anywhere / nobody.',
          sections:'A2' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    A2: 'A2 review · phrasal verbs, weather, animals, years, something / anywhere'
  },

  jeopardyCategories: [
    { id:'a2-phrasal', section:'A2', name:'Phrasal Verbs', clues:[
      { v:100, q:"'My alarm ___ at six this morning, but I stayed in bed.' Which phrasal verb fits?", physics:true,
        choice:{ options:["went off","went out","gave up","tried on"], answer:"went off" } },
      { v:200, q:"Which four phrasal verbs do we use with lights and machines? (The other four are about your day.)", physics:true,
        group:{ pick:["turn on","turn off","switch on","switch off"], with:["wake up","get up","go out","come home"] } },
      { v:300, q:"'Can you look ___ my cat while I'm on holiday?' Take care of. (5 letters)",
        anagram:{ word:"after" } },
      { v:400, q:"'Ben ___ smoking two years ago.' He stopped, and he has never started again.", physics:true,
        choice:{ options:["gave up","gave in","went off","took off"], answer:"gave up" } },
      { v:500, q:"Put the words in order. Careful: the phrasal verb splits around 'these shoes'.",
        scramble:{ sentence:"Can I try these shoes on before I buy them" } }
    ]},
    { id:'a2-weather-adj', section:'A2', name:'Weather Collocations', clues:[
      { v:100, q:"'The ___ winds blew the roof off the shed.' Which adjective goes with 'winds'?", physics:true,
        choice:{ options:["strong","heavy","thick","bright"], answer:"strong" } },
      { v:200, q:"Which four words go with HEAVY? (The other four go with STRONG.)", physics:true,
        group:{ pick:["rain","snow","traffic","bag"], with:["wind","coffee","tea","accent"] } },
      { v:300, q:"'It's hard to cycle up these ___ hills.' Going up very sharply. (5 letters)",
        anagram:{ word:"steep" } },
      { v:400, q:"Three of these are natural English. Which one is NOT?", physics:true,
        choice:{ options:["high rain","high winds","thick fog","bright sunshine"], answer:"high rain" } },
      { v:500, q:"Put the winds in order, from no wind at all to the strongest.",
        order:{ scale:["calm","breeze","gale","storm","hurricane"],
                low:"no wind at all", high:"the strongest wind there is",
                gloss:{ calm:"no wind. The trees don't move.",
                        breeze:"a light, pleasant wind.",
                        gale:"a very strong wind. Hard to walk against.",
                        storm:"strong wind with heavy rain, often thunder.",
                        hurricane:"the strongest storm. It can destroy buildings." } } }
    ]},
    { id:'a2-weather-words', section:'A2', name:'Rain, Rainy or Rains?', clues:[
      { v:100, q:"'It's a ___ day. Take your umbrella!' Which word fits?", physics:true,
        choice:{ options:["rainy","rain","rains","raining"], answer:"rainy" } },
      { v:200, q:"Which four are adjectives? (The other four are nouns.)", physics:true,
        group:{ pick:["sunny","cloudy","foggy","windy"], with:["sunshine","cloud","fog","wind"] } },
      { v:300, q:"'I saw a flash of ___ in the sky, and then I heard the thunder.' (9 letters)",
        anagram:{ word:"lightning" } },
      { v:400, q:"Which sentence is correct?", physics:true,
        choice:{ options:["It snows a lot here in winter.","It snowy a lot here in winter.","It's snow a lot here in winter.","It snowing a lot here in winter."],
                 answer:"It snows a lot here in winter." } },
      { v:500, q:"Put the words in order: why the drive was so slow.",
        scramble:{ sentence:"It was so foggy that we couldn't see the road" } }
    ]},
    { id:'a2-body', section:'A2', name:'Animal Body Parts', clues:[
      { v:100, q:"Which animal has hard hooves at the ends of its legs?", physics:true,
        choice:{ options:["a horse","a cat","a duck","a shark"], answer:"a horse" } },
      { v:200, q:"Which four animals have paws? (The other four have hooves.)", physics:true,
        group:{ pick:["dog","cat","bear","lion"], with:["horse","cow","sheep","goat"] } },
      { v:300, q:"'Seals and penguins use their ___ to swim.' (8 letters)",
        anagram:{ word:"flippers" } },
      { v:400, q:"'Ducks have webbed ___ that help them swim.' Which word fits?", physics:true,
        choice:{ options:["feet","fins","paws","wings"], answer:"feet" } },
      { v:500, q:"Put the words in order: how you know a dog is pleased to see you.",
        scramble:{ sentence:"When dogs are happy they often wag their tails" } }
    ]},
    { id:'a2-animals', section:'A2', name:'Pets, Farm & Wild', clues:[
      { v:100, q:"'A hamster that lives with a family is a ___.' Which word fits?", physics:true,
        choice:{ options:["pet","farm animal","wild animal","sea animal"], answer:"pet" } },
      { v:200, q:"Which four are farm animals? (The other four are wild.)", physics:true,
        group:{ pick:["hen","pig","donkey","goose"], with:["fox","deer","wolf","eagle"] } },
      { v:300, q:"'In spring the farm is full of baby sheep, called ___.' (5 letters)",
        anagram:{ word:"lambs" } },
      { v:400, q:"In Ireland, which of these is usually a WILD animal, not a pet or a farm animal?", physics:true,
        choice:{ options:["a fox","a rabbit","a goat","a goldfish"], answer:"a fox" } },
      { v:500, q:"Put the words in order: what my uncle does for a living.",
        scramble:{ sentence:"My uncle keeps sheep and goats on his farm" } }
    ]},
    { id:'a2-years', section:'A2', name:'Saying Years', clues:[
      { v:100, q:"How do we say the year 1999?", physics:true,
        choice:{ options:["nineteen ninety-nine","one thousand nine ninety-nine","nineteen nine nine","one nine nine nine"],
                 answer:"nineteen ninety-nine" } },
      { v:200, q:"How do we say the year 2002?", physics:true,
        choice:{ options:["two thousand and two","twenty-two","two hundred and two","two zero zero two"],
                 answer:"two thousand and two" } },
      { v:300, q:"Which four years do we say with 'oh' in the middle, like 1905 = 'nineteen oh five'?", physics:true,
        group:{ pick:["1905","1807","1603","1701"], with:["1950","1870","1630","1710"] } },
      { v:400, q:"Put the words in order: a famous first in history.",
        scramble:{ sentence:"The first plane flew in nineteen oh three" } },
      { v:500, q:"How do we say the year 1066?", physics:true,
        choice:{ options:["ten sixty-six","one thousand sixty-six","ten six six","one oh six six"],
                 answer:"ten sixty-six" } }
    ]},
    { id:'a2-something', section:'A2', name:'Something, Anywhere, Nobody', clues:[
      { v:100, q:"'I can hear a voice. ___ is outside.' Which word fits?", physics:true,
        choice:{ options:["Somebody","Anybody","Nobody","Nothing"], answer:"Somebody" } },
      { v:200, q:"'We were tired, so we didn't go ___ last night.' Which word fits?", physics:true,
        choice:{ options:["anywhere","somewhere","nowhere","everywhere"], answer:"anywhere" } },
      { v:300, q:"Which four words are about PLACES? (The other four are about people.)", physics:true,
        group:{ pick:["somewhere","anywhere","nowhere","everywhere"], with:["somebody","anybody","nobody","everybody"] } },
      { v:400, q:"Which sentence is correct?", physics:true,
        choice:{ options:["I didn't see anybody at the party.","I didn't see nobody at the party.","I saw anybody at the party.","I didn't saw anybody at the party."],
                 answer:"I didn't see anybody at the party." } },
      { v:500, q:"Put the words in order: the house was empty.",
        scramble:{ sentence:"I checked every room but there was nobody there" } }
    ]}
  ]
});
