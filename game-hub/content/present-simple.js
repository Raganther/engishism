/* Present Simple — A2
   ===================

   A standalone grammar unit for an A2 class, the partner of `present-continuous`.
   Six Jeopardy columns, one per language point — spelling the he/she/it form,
   routines and how often (frequency words and where they go), questions and
   negatives with do/does, facts & timetables, and two on hobbies.

   **Same round set as the General Knowledge and Present Continuous units.** Only
   the three physics (Matter.js / `Kit.table`) rounds a room plays fastest —
   Multiple Choice, Connections and Drag the Letters — two Multiple Choice, two
   Connections and one Drag the Letters per column, rising in value ($100
   easiest). Every Multiple Choice and Connections clue carries `physics:true`, the
   only way a mixed column reaches the flick face; Drag the Letters needs no flag.
   Fills a Flip board cleanly, since Flip flattens the columns into its pool.

   Every Connections decoy set is a coherent group of its own — a discrimination:
   -es against -s, -ies against a kept -y, frequency words against points in time,
   "usually" before the main verb (and after be) against the wrong place, does
   against do, facts against the same verbs happening now, state verbs against
   action verbs. A2 vocabulary throughout, every clue states its own context, and
   no prompt repeats one in `grammar-1` or `present-continuous`.

   **The two Hobbies columns carry a class worksheet's vocabulary** (Teach-This,
   "Hobbies Board Game") — its twelve free-time verbs (read, swim, run, watch TV,
   play football, listen to music, draw, cook, sing, dance, travel, shop) in
   original sentences, not the sheet's own, because the repo is public. They add
   the collocations the sheet leans on: play / go / do, and listen to / watch.

   Jeopardy only, deliberately — a unit shows only the games it has a bank for. */
window.UNITS.push({
  id: 'present-simple',
  label: 'Grammar · Present Simple (A2)',
  card: { num:'A2', title:'Present Simple',
          blurb:'Present simple for A2 in the three fastest rounds — Multiple Choice, Connections and Drag the Letters. He/she/it spelling, routines and how often, questions & negatives with do/does, facts & timetables, and hobbies & free time.',
          sections:'PS' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    'PS': 'Present Simple (A2)'
  },

  jeopardyCategories: [
    { id:'ps-spelling', section:'PS', name:'Spelling: he / she / it', clues:[
      {v:100, q:"'My dad ___ the car every Sunday.' The he/she/it form of 'wash'. Which is correct?", physics:true,
        choice:{ options:["washes","washs","washies","wash"], answer:"washes" }},
      {v:200, q:"Four of these add -ES for he/she/it; four just add -S. Find the four that add -es.", physics:true,
        group:{ pick:["catches","fixes","misses","pushes"],
                with:["reads","drives","cooks","walks"] }},
      {v:300, q:"'My sister ___ English and French at university.' The he/she/it form of 'study' (-y becomes -ies). (7 letters)",
        anagram:{ word:"studies" }},
      {v:400, q:"'She ___ two brothers and a sister.' The he/she/it form of 'have'. Which is correct?", physics:true,
        choice:{ options:["has","haves","have","hass"], answer:"has" }},
      {v:500, q:"Four of these change -y to -IES; four keep the -y and add -s. Find the four that change to -ies.", physics:true,
        group:{ pick:["flies","cries","tries","carries"],
                with:["plays","buys","says","enjoys"] }},
    ]},

    { id:'ps-routines', section:'PS', name:'Routines & How Often', clues:[
      {v:100, q:"'I ___ up at seven o'clock every morning.' Which is correct?", physics:true,
        choice:{ options:["get","gets","getting","am get"], answer:"get" }},
      {v:200, q:"Four of these words tell you HOW OFTEN something happens. Find the four.", physics:true,
        group:{ pick:["always","usually","sometimes","never"],
                with:["yesterday","tomorrow","last week","next year"] }},
      {v:300, q:"'We ___ go to the cinema — not once this year!' The frequency word that means 0% of the time. (5 letters)",
        anagram:{ word:"never" }},
      {v:400, q:"Where does the frequency word go? Choose the correct sentence.", physics:true,
        choice:{ options:["She is always late","She always is late","Always she is late","She is late always"], answer:"She is always late" }},
      {v:500, q:"Four of these have 'usually' in the right place (before the main verb, after 'be'). Find the four.", physics:true,
        group:{ pick:["I usually walk","He is usually tired","They usually eat","We are usually busy"],
                with:["I walk usually","He usually is tired","They eat usually","We usually are busy"] }},
    ]},

    { id:'ps-questions', section:'PS', name:'Questions & Negatives: do / does', clues:[
      {v:100, q:"Make it a question: 'She lives in Dublin.' → '___ she live in Dublin?'", physics:true,
        choice:{ options:["Does","Do","Is","Lives"], answer:"Does" }},
      {v:200, q:"Four of these present simple sentences are correct; four have a mistake with do/does. Find the four correct ones.", physics:true,
        group:{ pick:["Does he like tea?","I don't eat meat","Do they work here?","She doesn't drive"],
                with:["Does he likes tea?","I not eat meat","Do they works here?","She don't drive"] }},
      {v:300, q:"'Where does your sister ___?' — 'In Cork. She has a small flat there.' After 'does' the verb has no -s. (4 letters)",
        anagram:{ word:"live" }},
      {v:400, q:"Choose the correct negative: 'My brother ___ coffee — he only drinks tea.'", physics:true,
        choice:{ options:["doesn't drink","don't drink","doesn't drinks","not drink"], answer:"doesn't drink" }},
      {v:500, q:"Four of these take DOES in a question ('Does ___ like it?'); four take DO. Find the four that take does.", physics:true,
        group:{ pick:["she","it","your dad","Tom"],
                with:["you","they","we","your parents"] }},
    ]},

    { id:'ps-facts', section:'PS', name:'Facts & Timetables', clues:[
      {v:100, q:"'Water ___ at 100 degrees.' A fact that is always true. Which is correct?", physics:true,
        choice:{ options:["boils","is boiling","boil","boiling"], answer:"boils" }},
      {v:200, q:"Four of these are facts that are always true, not things happening now. Find the four.", physics:true,
        group:{ pick:["The sun rises in the east","Water freezes at 0°C","Bees make honey","Birds have wings"],
                with:["The sun is rising now","The lake is freezing","The bees are flying","The birds are singing"] }},
      {v:300, q:"'The train to Galway ___ at 8.15 every morning.' The he/she/it form of 'leave'. (6 letters)",
        anagram:{ word:"leaves" }},
      {v:400, q:"'The shop ___ at nine and closes at six.' A timetable. Which is correct?", physics:true,
        choice:{ options:["opens","open","is opening","opening"], answer:"opens" }},
      {v:500, q:"Four of these verbs describe STATES, not actions — we don't usually use them with -ing. Find the four.", physics:true,
        group:{ pick:["like","know","want","need"],
                with:["run","eat","write","play"] }},
    ]},

    { id:'ps-hobbies', section:'PS', name:'Hobbies & Free Time', clues:[
      {v:100, q:"'My friends and I ___ football after school on Fridays.' Which is correct?", physics:true,
        choice:{ options:["play","go","do","make"], answer:"play" }},
      {v:200, q:"Four of these go with PLAY; four go with GO. Find the four that go with play.", physics:true,
        group:{ pick:["football","tennis","the guitar","computer games"],
                with:["swimming","shopping","running","dancing"] }},
      {v:300, q:"'I ___ pictures of animals in my free time — I love art.' The verb for making a picture with a pencil. (4 letters)",
        anagram:{ word:"draw" }},
      {v:400, q:"'After dinner we ___ TV for an hour.' Which verb goes with TV?", physics:true,
        choice:{ options:["watch","look","see","watching"], answer:"watch" }},
      {v:500, q:"Four of these go with LISTEN TO; four go with WATCH. Find the four that go with listen to.", physics:true,
        group:{ pick:["music","the radio","a podcast","songs"],
                with:["TV","a film","a football match","videos"] }},
    ]},

    { id:'ps-hobbies-he', section:'PS', name:'Hobbies: He / She', clues:[
      {v:100, q:"'My sister ___ in the sea every summer.' Which is correct?", physics:true,
        choice:{ options:["swims","swim","swimming","is swim"], answer:"swims" }},
      {v:200, q:"Four of these he/she sentences are correct; four are missing the -s. Find the four correct ones.", physics:true,
        group:{ pick:["She dances","He cooks","She travels","He shops"],
                with:["She dance","He cook","She travel","He shop"] }},
      {v:300, q:"'Mum loves music — she ___ in a choir every Tuesday.' The he/she/it form of 'sing'. (5 letters)",
        anagram:{ word:"sings" }},
      {v:400, q:"'My dad ___ to other countries for his job.' The he/she/it form of 'travel'. Which is correct?", physics:true,
        choice:{ options:["travels","travel","travelles","travelling"], answer:"travels" }},
      {v:500, q:"Four of these go with DO ('She does ___ on Mondays'); four go with PLAY. Find the four that go with do.", physics:true,
        group:{ pick:["yoga","karate","gymnastics","judo"],
                with:["chess","tennis","the piano","cards"] }},
    ]},
  ]
});
