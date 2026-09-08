/* Grammar pack — Present & Future (elementary)
   =============================================

   A standalone grammar unit for a different, lower-level class than the Empower
   C1 units. Three Jeopardy columns, one per language point — present simple with
   the third person, present continuous, and "be going to" for plans and
   predictions — each a MIXED column in the 4B shape: five clues at $100–$500,
   the round type rising in difficulty ($100 Multiple Choice → $200 Connections →
   $300 Drag the Letters → $400 → $500 Drag the Words).

   The $400 slot follows the 4B rule "a scale where one exists, a form where it
   does not": present simple has a natural scale (frequency, never → always) so it
   is a Word Thermometer; present continuous and going-to have none, so each is an
   error-correction, which is exactly what a verb-form fix teaches.

   **Jeopardy only, deliberately** — a unit shows only the games it has a bank
   for, and this exists for one grammar lesson. Elementary vocabulary throughout,
   and every clue states its own context so a teacher who has not seen a syllabus
   can still play it. */
window.UNITS.push({
  id: 'grammar-1',
  label: 'Grammar · Present & Future (elementary)',
  card: { num:'Grammar', title:'Present & Future',
          blurb:'Present simple (he/she/it), present continuous, and be going to for plans & predictions. Elementary. Mixed rounds throughout.',
          sections:'GR' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    'GR': 'Grammar · Present simple, present continuous & going to'
  },

  jeopardyCategories: [
    { id:'gr-present-simple', section:'GR', name:'Present Simple: he/she/it', clues:[
      {v:100, q:"Every morning she ___ to work by bus. Which is correct?",
        choice:{ options:["goes","go","going","gos"], answer:"goes" }},
      {v:200, q:"Four of these are correct 'he / she / it' forms. Find the four.",
        group:{ pick:["plays","goes","watches","studies"],
                with:["play","go","watch","study"] }},
      {v:300, q:"'My brother ___ TV every evening.' The he/she/it form of 'watch'. (7 letters)",
        anagram:{ word:"watches" }},
      {v:400, q:"Put these in order — least often first.",
        order:{ scale:["never","rarely","sometimes","often","always"],
                low:"almost 0% of the time", high:"almost 100% of the time",
                gloss:{ never:"not at any time — 0%.",
                        rarely:"almost never — once in a while.",
                        sometimes:"now and then — about half the time.",
                        often:"a lot of the time.",
                        always:"every time — 100%." } }},
      {v:500, q:"Put the words in order — what she does every morning.",
        scramble:{ sentence:"She always drinks coffee in the morning" }},
    ]},
    { id:'gr-present-continuous', section:'GR', name:'Present Continuous: right now', clues:[
      {v:100, q:"Be quiet! The baby ___ . Which is correct?",
        choice:{ options:["is sleeping","sleeps","sleeping","is sleep"], answer:"is sleeping" }},
      {v:200, q:"Four of these are correctly spelled -ing forms. Find the four.",
        group:{ pick:["running","swimming","making","sitting"],
                with:["runing","swiming","makeing","siting"] }},
      {v:300, q:"'Look — it's ___ outside! Take an umbrella.' The -ing form of 'rain'. (7 letters)",
        anagram:{ word:"raining" }},
      {v:400, q:"Correct it: 'Look! The dog *run* after the cat right now.'",
        a:"is running", type:"errorfix"},
      {v:500, q:"Put the words in order — what he is doing now.",
        scramble:{ sentence:"He is reading a book right now" }},
    ]},
    { id:'gr-going-to', section:'GR', name:'Be Going To: plans', clues:[
      {v:100, q:"'Why have you got your coat?' 'I ___ walk the dog.' Which is correct?",
        choice:{ options:["am going to","going to","go to","will to"], answer:"am going to" }},
      {v:200, q:"Four of these use 'going to' correctly. Find the four.",
        group:{ pick:["I'm going to","she's going to","they're going to","we're going to"],
                with:["I going to","she go to","they going to","we's going to"] }},
      {v:300, q:"'Look at those black clouds! It's ___ to rain.' The word after 'is'. (5 letters)",
        anagram:{ word:"going" }},
      {v:400, q:"Correct it: 'Look at the sky! It *going to* rain soon.'",
        a:"is going to", type:"errorfix"},
      {v:500, q:"Put the words in order — a plan for tonight.",
        scramble:{ sentence:"We are going to watch a film tonight" }},
    ]},
  ]
});
