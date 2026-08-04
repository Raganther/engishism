/* New English File 5th edition — Unit 1
   =====================================

   **The second coursebook in the app, and the first content authored with rounds
   from the start rather than added to afterwards.** Units 4 and 5 are Cambridge
   Empower C1; this is a different book at a lower level, so it is its own unit
   rather than another section inside one of theirs. The label says which book,
   because "Unit 1" on a card next to "Unit 4" would otherwise read as the same
   series.

   1A is food and cooking (present simple vs continuous, action and non-action
   verbs); 1B is family (future forms). Both carry the whole spread — the
   vocabulary, the grammar focus, the pronunciation point and the functional
   language — because an audit of Unit 5 found the Grammar Focus pages nearly
   missed, and the format does not remind you.

   **Rounds are in every game that can host one**, which is what makes this unit
   different from 4 and 5. Jeopardy gets a Connections and a Word Thermometer
   column per section; Blockbusters mixes round hexagons in with the ordinary ones
   so you cannot tell from the board which you are taking; Millionaire's whole bank
   becomes Multiple Choice when a rung opens. Race has no round, because its
   scattered words already are the board. */
window.UNITS.push({
  id: 'nef-1',
  label: 'New English File 5th ed · Unit 1 · Food & Family',
  card: { num:'Unit 1', title:'Food & Family',
          blurb:'Food and cooking, present simple & continuous, family, future forms (1A–1B). Rounds throughout.',
          sections:'1A–1B' },
  intro: "Choose a template. You'll pick the content next — mix and match 1A and 1B.",

  jeopardySectionLabels: {
    '1A': '1A · How we eat — food, cooking, present simple & continuous',
    '1B': '1B · Happy families — family, future forms'
  },

  topicNames: {
    '1A-vocab':   '1A · Food & cooking',
    '1A-grammar': '1A · Present simple & continuous',
    '1B-vocab':   '1B · Family',
    '1B-grammar': '1B · Future forms'
  },

  /* Jeopardy — categories stay grouped by section in array order, or the content
     screen prints a section heading twice. Every category carries all five values:
     a category short of one is not a narrower column, it is a crash. */
  jeopardyCategories: [
    { id:'nef1-describing-food', section:'1A', name:'Describing Food', clues:[
      {v:100, q:"Not cooked at all — sushi is made with ___ fish.", a:"raw"},
      {v:200, q:"Kept at below zero until you need it: '___ peas'.", a:"frozen"},
      {v:300, q:"Sold in a metal can rather than fresh: '___ tomatoes'.", a:"tinned"},
      {v:400, q:"Full of chilli and pepper — the opposite of mild.", a:"spicy"},
      {v:500, q:"Made with much less cream and butter than usual: '___ yogurt'.", a:"low-fat"},
    ]},
    { id:'nef1-in-the-kitchen', section:'1A', name:'In the Kitchen', clues:[
      {v:100, q:"Cooked over direct heat on bars: '___ squid'.", a:"grilled"},
      {v:200, q:"Cooked over boiling water, never in it: '___ green beans'.", a:"steamed"},
      {v:300, q:"Cooked in the oven in its own fat: '___ chicken'.", a:"roast"},
      {v:400, q:"Cooked in hot oil in a pan.", a:"fried"},
      {v:500, q:"Chewed food is broken down here before it reaches the stomach.", a:"the mouth"},
    ]},
    { id:'nef1-compound-nouns', section:'1A', name:'Compound Nouns', clues:[
      {v:100, q:"The machine that makes your espresso: a ___ machine.", a:"coffee"},
      {v:200, q:"How much glucose is in you after a meal: blood ___.", a:"sugar"},
      {v:300, q:"What a doctor measures with a cuff on your arm: blood ___.", a:"pressure"},
      {v:400, q:"The illness the article links to chewing too fast: ___ disease.", a:"heart"},
      {v:500, q:"Professor Hayashi researches in the faculty of ___ science.", a:"sports"},
    ]},
    { id:'nef1-simple-or-continuous', section:'1A', name:'Simple or Continuous?', clues:[
      {v:100, q:"Habit, so simple: 'I ___ (have) toast every morning.'", a:"have"},
      {v:200, q:"Right now, so continuous: 'Be quiet — I ___ (cook).'", a:"am cooking"},
      {v:300, q:"Correct it: 'I am wanting a coffee.'", a:"I want a coffee"},
      {v:400, q:"'Have' changes meaning: 'I ___ lunch at the moment' is fine, but 'I ___ a car' is not.", a:"am having / am having"},
      {v:500, q:"Why is 'I'm loving this' acceptable in the interview but not in an exam?", a:"it is a deliberate, informal use of a non-action verb"},
    ]},
    { id:'nef1-connections-1a', section:'1A', name:'Connections', clues:[
      {v:100, q:"Four of these are ways of cooking food. The others happen before it. Find the four.",
        group:{ pick:["grilled","steamed","roasted","fried"],
                with:["chopped","sliced","peeled","grated"] }},
      {v:200, q:"Four of these come from milk. Find the four.",
        group:{ pick:["cheese","butter","yogurt","cream"],
                with:["tofu","hummus","olives","lentils"] }},
      {v:300, q:"Four of these describe food you should throw away. Find the four.",
        group:{ pick:["stale","mouldy","rotten","sour"],
                with:["ripe","crisp","tender","juicy"] }},
      {v:400, q:"Four of these are meals. Find the four.",
        group:{ pick:["breakfast","brunch","lunch","supper"],
                with:["recipe","menu","portion","helping"] }},
      {v:500, q:"Four of these are non-action verbs — they are almost never continuous. Find the four.",
        group:{ pick:["know","believe","own","prefer"],
                with:["chew","chop","swallow","stir"] }},
    ]},
    { id:'nef1-thermometer-1a', section:'1A', name:'Word Thermometer', clues:[
      {v:100, q:"Put these in order — mildest first.",
        order:{ scale:["mild","warm","hot","spicy","fiery"],
                low:"a baby could eat it", high:"you need a glass of milk",
                gloss:{ mild:"no heat at all — the safe option on a menu.",
                        warm:"gently heated, not about chilli.",
                        hot:"the everyday word, and it means two things at once.",
                        spicy:"full of chilli and pepper on purpose.",
                        fiery:"so hot it is a challenge rather than a meal." } }},
      {v:200, q:"Put these in order — freshest first.",
        order:{ scale:["fresh","ripe","overripe","stale","rotten"],
                low:"picked this morning", high:"put it in the bin",
                gloss:{ fresh:"just made or just picked.",
                        ripe:"ready to eat — the best moment.",
                        overripe:"just past it, still edible.",
                        stale:"dry and old — used of bread.",
                        rotten:"gone bad completely." } }},
      {v:300, q:"Put these in order — least cooked first.",
        order:{ scale:["raw","rare","medium","well-done","burnt"],
                low:"straight from the fridge", high:"nobody wanted this",
                gloss:{ raw:"not cooked at all.",
                        rare:"barely cooked, still red inside.",
                        medium:"pink in the middle.",
                        "well-done":"cooked all the way through.",
                        burnt:"cooked too long — black." } }},
      {v:400, q:"Put these in order — weakest feeling first.",
        order:{ scale:["loathe","dislike","tolerate","like","adore"],
                low:"you would leave the table", high:"you would queue for it",
                gloss:{ loathe:"hate strongly — a formal, heavy word.",
                        dislike:"the polite way to say you do not like it.",
                        tolerate:"you will eat it, without enthusiasm.",
                        like:"the plain, unmarked word.",
                        adore:"love it — deliberately over the top." } }},
      {v:500, q:"Put these in order — smallest amount first.",
        order:{ scale:["mouthful","snack","meal","feast","banquet"],
                low:"one bite", high:"a whole hall of people eating",
                gloss:{ mouthful:"as much as fits in your mouth at once.",
                        snack:"small, between meals.",
                        meal:"breakfast, lunch or dinner.",
                        feast:"a very large meal for an occasion.",
                        banquet:"a formal feast, often for many people." } }},
    ]},

    /* Three more round types for 1A, so a board can be built entirely from played
       questions or mixed with the read-out ones. Drag the Letters needs a word with
       no space or hyphen in it and a clue that does not contain the answer — the
       round checks both, and the second is the one a reader misses. */
    { id:'nef1-drag-letters-1a', section:'1A', name:'Drag the Letters', clues:[
      {v:100, q:"Slice this purple vegetable and it stains everything it touches.",
        anagram:{ word:"beetroot" }},
      {v:200, q:"Minced meat in skins, fried or grilled for breakfast.",
        anagram:{ word:"sausages" }},
      {v:300, q:"What a huge lunch takes away before dinner.",
        anagram:{ word:"appetite" }},
      {v:400, q:"Chewing slowly is said to be good for this.",
        anagram:{ word:"digestion" }},
      {v:500, q:"Someone who cannot take dairy is lactose this.",
        anagram:{ word:"intolerant" }},
    ]},
    /* Every sentence here repeats a word on purpose — 'a lot of', 'she', 'the'. A
       repeated word is the case this round is really built around, because every
       pick in the app is keyed by its text and the first copy would otherwise stand
       for all of them. */
    { id:'nef1-drag-words-1a', section:'1A', name:'Drag the Words', clues:[
      {v:100, q:"Put the words in order — someone describing their diet.",
        scramble:{ sentence:"I eat a lot of vegetables and a lot of fruit" }},
      {v:200, q:"Put the words in order — why she cannot come to the phone.",
        scramble:{ sentence:"She is having lunch at the moment so she cannot answer" }},
      {v:300, q:"Put the words in order — the advice from the article.",
        scramble:{ sentence:"The best time to eat the vegetables is at the start" }},
      {v:400, q:"Put the words in order — disagreeing politely.",
        scramble:{ sentence:"I know what you mean but I do not agree with you" }},
      {v:500, q:"Put the words in order — a morning habit.",
        scramble:{ sentence:"He always drinks his coffee before he eats anything" }},
    ]},
    { id:'nef1-choice-1a', section:'1A', name:'Multiple Choice', clues:[
      {v:100, q:"Which one is a way of cooking rather than a way of preparing?",
        choice:{ options:["roasting","chopping","peeling","grating"], answer:"roasting" }},
      {v:200, q:"Which sentence is correct English?",
        choice:{ options:["I am having lunch right now.","I am having a car.",
                          "I have lunch right now.","I having lunch right now."],
                 answer:"I am having lunch right now." }},
      {v:300, q:"Which word describes bread that has gone dry and hard?",
        choice:{ options:["stale","sour","raw","tinned"], answer:"stale" }},
      {v:400, q:"'I ___ this cake.' Which is standard written English?",
        choice:{ options:["love","am loving","loves","am love"], answer:"love" }},
      {v:500, q:"Which pair are both non-action verbs?",
        choice:{ options:["know and believe","chew and swallow",
                          "stir and chop","fry and grill"], answer:"know and believe" }},
    ]},
    { id:'nef1-family-ties', section:'1B', name:'Family Ties', clues:[
      {v:100, q:"Your brothers and sisters, in one word.", a:"siblings"},
      {v:200, q:"Your father's new wife, who is not your mother.", a:"stepmother"},
      {v:300, q:"Your sister's husband, or your husband's brother.", a:"brother-in-law"},
      {v:400, q:"Someone with no brothers or sisters at all: an ___ child.", a:"only"},
      {v:500, q:"Your grandfather's father.", a:"great-grandfather"},
    ]},
    { id:'nef1-kinds-of-family', section:'1B', name:'Kinds of Family', clues:[
      {v:100, q:"Parents and children only, nobody else: your ___ family.", a:"immediate"},
      {v:200, q:"Aunts, uncles, cousins and grandparents too: your ___ family.", a:"extended"},
      {v:300, q:"Two families joined when their parents got together: a ___ family.", a:"blended"},
      {v:400, q:"Grandparents, parents and children under one roof: a ___ family.", a:"multi-generational"},
      {v:500, q:"Living together as a couple without being married: a ___ couple.", a:"cohabiting"},
    ]},
    { id:'nef1-future-forms', section:'1B', name:'Future Forms', clues:[
      {v:100, q:"An arrangement with a time and a place: 'I ___ (see) my grandparents on Sunday.'", a:"am seeing"},
      {v:200, q:"A plan you have already decided: 'I ___ look for a job.'", a:"am going to"},
      {v:300, q:"An offer made at the moment of speaking: '___ I make you a cup of tea?'", a:"Shall"},
      {v:400, q:"A prediction from evidence you can see: 'Look at those clouds — it ___ rain.'", a:"is going to"},
      {v:500, q:"A promise: 'Don't worry, I ___ tell anyone.'", a:"won't"},
    ]},
    { id:'nef1-saying-it-politely', section:'1B', name:'Saying It Politely', clues:[
      {v:100, q:"Agree in three words: 'I ___ with that.'", a:"agree"},
      {v:200, q:"Disagree without sounding rude: 'I don't ___ you're right.'", a:"think"},
      {v:300, q:"Refuse a personal question politely: 'I'd ___ not talk about that.'", a:"rather"},
      {v:400, q:"Neither agree nor disagree: 'I think it ___.'", a:"depends"},
      {v:500, q:"Soften a refusal before you give it: '___, I'd rather not.'", a:"I'm sorry"},
    ]},
    { id:'nef1-connections-1b', section:'1B', name:'Connections', clues:[
      {v:100, q:"Four of these are family by marriage rather than by blood. Find the four.",
        group:{ pick:["stepmother","stepson","mother-in-law","brother-in-law"],
                with:["nephew","niece","cousin","grandson"] }},
      {v:200, q:"Four of these point to the future. Find the four.",
        group:{ pick:["tomorrow","soon","shortly","eventually"],
                with:["yesterday","previously","formerly","recently"] }},
      {v:300, q:"Four of these mean you completely agree. Find the four.",
        group:{ pick:["absolutely","exactly","definitely","precisely"],
                with:["hardly","barely","scarcely","rarely"] }},
      {v:400, q:"Four of these describe a large household. Find the four.",
        group:{ pick:["extended","multi-generational","blended","crowded"],
                with:["only","single","immediate","nuclear"] }},
      {v:500, q:"Four of these are children of the same parents. Find the four.",
        group:{ pick:["siblings","brothers","sisters","twins"],
                with:["cousins","in-laws","ancestors","descendants"] }},
    ]},
    { id:'nef1-thermometer-1b', section:'1B', name:'Word Thermometer', clues:[
      {v:100, q:"Put these in order — youngest first.",
        order:{ scale:["baby","toddler","child","teenager","adult"],
                low:"cannot walk yet", high:"can vote",
                gloss:{ baby:"under one, carried everywhere.",
                        toddler:"just walking — roughly one to three.",
                        child:"school age.",
                        teenager:"thirteen to nineteen, and the word says so.",
                        adult:"legally grown up." } }},
      {v:200, q:"Put these in order — least close first.",
        order:{ scale:["stranger","acquaintance","friend","relative","sibling"],
                low:"you have never met", high:"you grew up together",
                gloss:{ stranger:"somebody you do not know at all.",
                        acquaintance:"you have met, but you are not friends.",
                        friend:"chosen, not given.",
                        relative:"family, but not immediate.",
                        sibling:"your brother or sister." } }},
      {v:300, q:"Put these in order — least certain first.",
        order:{ scale:["never","unlikely","possibly","probably","definitely"],
                low:"it will not happen", high:"it is already arranged",
                gloss:{ never:"ruled out completely.",
                        unlikely:"probably not, but not impossible.",
                        possibly:"it could go either way.",
                        probably:"more likely than not.",
                        definitely:"no doubt at all." } }},
      {v:400, q:"Put these in order — oldest generation first.",
        order:{ scale:["great-grandparent","grandparent","parent","child","grandchild"],
                low:"four generations back", high:"the newest arrival",
                gloss:{ "great-grandparent":"your grandparent's parent.",
                        grandparent:"your parent's parent.",
                        parent:"your mother or father.",
                        child:"their son or daughter.",
                        grandchild:"your child's child." } }},
      {v:500, q:"Put these in order — earliest stage first.",
        order:{ scale:["meet","date","engagement","marriage","divorce"],
                low:"you do not know them yet", high:"it is legally over",
                gloss:{ meet:"the first time, however it happens.",
                        date:"going out together.",
                        engagement:"you have agreed to marry.",
                        marriage:"the legal commitment.",
                        divorce:"the legal end of it." } }},
    ]},
    { id:'nef1-drag-letters-1b', section:'1B', name:'Drag the Letters', clues:[
      {v:100, q:"Children who share the same two parents.",
        anagram:{ word:"siblings" }},
      {v:200, q:"The son of your brother or of your sister.",
        anagram:{ word:"nephew" }},
      {v:300, q:"Somebody in your family tree from four hundred years ago.",
        anagram:{ word:"ancestor" }},
      {v:400, q:"Everyone who lives at one address, counted together.",
        anagram:{ word:"household" }},
      {v:500, q:"Everybody born at roughly the same time as each other.",
        anagram:{ word:"generation" }},
    ]},
    { id:'nef1-drag-words-1b', section:'1B', name:'Drag the Words', clues:[
      {v:100, q:"Put the words in order — an arrangement for the weekend.",
        scramble:{ sentence:"I am seeing my cousin and my aunt on Sunday" }},
      {v:200, q:"Put the words in order — news about the family.",
        scramble:{ sentence:"My sister is going to have a baby in the spring" }},
      {v:300, q:"Put the words in order — a promise.",
        scramble:{ sentence:"Do not worry because I will not tell anyone about it" }},
      {v:400, q:"Put the words in order — who lives where.",
        scramble:{ sentence:"My brother and my sister both live with my parents" }},
      {v:500, q:"Put the words in order — refusing a question politely.",
        scramble:{ sentence:"I would rather not talk about that if you do not mind" }},
    ]},
    { id:'nef1-choice-1b', section:'1B', name:'Multiple Choice', clues:[
      {v:100, q:"Which one is family by marriage rather than by blood?",
        choice:{ options:["mother-in-law","niece","cousin","grandson"], answer:"mother-in-law" }},
      {v:200, q:"Which sentence describes an arrangement rather than a plan?",
        choice:{ options:["I'm meeting her at four.","I'm going to look for a job.",
                          "I'll probably call her.","I want to see her soon."],
                 answer:"I'm meeting her at four." }},
      {v:300, q:"Which reply politely closes a topic down?",
        choice:{ options:["I'd rather not say.","Mind your own business.",
                          "Why do you want to know?","I'm not telling you."],
                 answer:"I'd rather not say." }},
      {v:400, q:"Which word describes a household with three generations in it?",
        choice:{ options:["multi-generational","blended","immediate","cohabiting"],
                 answer:"multi-generational" }},
      {v:500, q:"'Look at that queue — we ___ be waiting an hour.' Which fits best?",
        choice:{ options:["are going to","will have","shall","would"], answer:"are going to" }},
    ]},
  ],

  /* Blockbusters — an ordinary hexagon needs a one-word answer beginning with its
     letter, because the letter is how a team says which square it is attacking.
     A round hexagon still carries a letter for exactly that reason, and no answer
     at all: a grouping set has four and a scale has five, so the initial rule has
     nothing to match against. They are filed in with the ordinary ones on purpose
     — a hexagon does not announce what it holds. */
  blockbustersBank: [
    {section:'1A', topic:'1A-vocab', letter:'R', clue:"Not cooked — how sushi fish is served.", answer:"Raw"},
    {section:'1A', topic:'1A-vocab', letter:'S', clue:"Full of chilli — the opposite of mild.", answer:"Spicy"},
    {section:'1A', topic:'1A-vocab', letter:'T', clue:"Sold in a metal can rather than fresh.", answer:"Tinned"},
    {section:'1A', topic:'1A-vocab', letter:'F', clue:"Kept below zero until you cook it.", answer:"Frozen"},
    {section:'1A', topic:'1A-vocab', letter:'G', clue:"Cooked over direct heat on metal bars.", answer:"Grilled"},
    {section:'1A', topic:'1A-vocab', letter:'S', clue:"Cooked over boiling water but never in it.", answer:"Steamed"},
    {section:'1A', topic:'1A-vocab', letter:'B', clue:"Cooked in water at a hundred degrees.", answer:"Boiled"},
    {section:'1A', topic:'1A-vocab', letter:'S', clue:"A sea creature with eight arms, often grilled.", answer:"Squid"},
    {section:'1A', topic:'1A-vocab', letter:'B', clue:"A dark red root vegetable, often served with tuna.", answer:"Beetroot"},
    {section:'1A', topic:'1A-vocab', letter:'J', clue:"What raspberries become in a jar.", answer:"Jam"},
    {section:'1A', topic:'1A-vocab', letter:'S', clue:"Something small you eat between meals.", answer:"Snack"},
    {section:'1A', topic:'1A-vocab', letter:'T', clue:"A hot meal you order and carry home.", answer:"Takeaway"},
    {section:'1A', topic:'1A-vocab', letter:'A', clue:"If nuts make you ill, you are this to them.", answer:"Allergic"},
    {section:'1A', topic:'1A-vocab', letter:'I', clue:"Milk does not make you ill, but it disagrees with you: lactose ___.", answer:"Intolerant"},
    {section:'1A', topic:'1A-vocab', letter:'P', clue:"Meat, fish, eggs and tofu are all this.", answer:"Protein"},
    {section:'1A', topic:'1A-vocab', letter:'F', clue:"What vegetables contain that fills you up.", answer:"Fibre"},
    {section:'1A', topic:'1A-vocab', letter:'D', clue:"The process that turns a meal into energy.", answer:"Digestion"},
    {section:'1A', topic:'1A-vocab', letter:'A', clue:"Your desire to eat — protein reduces it.", answer:"Appetite"},
    {section:'1A', topic:'1A-vocab', letter:'C', clue:"Four of these are drinks. Find the four.",
      group:{ pick:["coffee","juice","smoothie","cordial"], with:["cutlery","saucer","kettle","napkin"] }},
    {section:'1A', topic:'1A-vocab', letter:'P', clue:"Put these in order — smallest portion first.",
      order:{ scale:["taste","bite","portion","plateful","banquet"],
              low:"barely anything", high:"a table full",
              gloss:{ taste:"a tiny amount, to try it.",
                      bite:"one mouthful.",
                      portion:"one person's share.",
                      plateful:"as much as the plate holds.",
                      banquet:"a formal feast." } }},

    {section:'1B', topic:'1B-vocab', letter:'S', clue:"One word for your brothers and sisters.", answer:"Siblings"},
    {section:'1B', topic:'1B-vocab', letter:'N', clue:"Your brother's son.", answer:"Nephew"},
    {section:'1B', topic:'1B-vocab', letter:'N', clue:"Your sister's daughter.", answer:"Niece"},
    {section:'1B', topic:'1B-vocab', letter:'C', clue:"Your aunt's child.", answer:"Cousin"},
    {section:'1B', topic:'1B-vocab', letter:'T', clue:"Two children born on the same day to the same mother.", answer:"Twins"},
    {section:'1B', topic:'1B-vocab', letter:'A', clue:"A family member from long ago that you are descended from.", answer:"Ancestor"},
    {section:'1B', topic:'1B-vocab', letter:'H', clue:"Everyone living together under one roof.", answer:"Household"},
    {section:'1B', topic:'1B-vocab', letter:'G', clue:"Grandparents, parents and children are three of these.", answer:"Generations"},
    {section:'1B', topic:'1B-vocab', letter:'A', clue:"Taken permanently into a family that did not give birth to you.", answer:"Adopted"},
    {section:'1B', topic:'1B-vocab', letter:'S', clue:"Your mother's new husband.", answer:"Stepfather"},
    {section:'1B', topic:'1B-vocab', letter:'R', clue:"Any member of your family, near or distant.", answer:"Relative"},
    {section:'1B', topic:'1B-vocab', letter:'W', clue:"A woman whose husband has died.", answer:"Widow"},
    {section:'1B', topic:'1B-vocab', letter:'F', clue:"Four of these are ways of talking about the future. Find the four.",
      group:{ pick:["will","shall","going","soon"], with:["was","did","ago","yesterday"] }},
    {section:'1B', topic:'1B-vocab', letter:'A', clue:"Four of these mean you agree. Find the four.",
      group:{ pick:["absolutely","exactly","true","right"], with:["hardly","rarely","barely","scarcely"] }},
    {section:'1B', topic:'1B-vocab', letter:'C', clue:"Order these guesses — weakest first.",
      order:{ scale:["might","could","should","will","must"],
              low:"barely a chance", high:"you would bet on it",
              gloss:{ might:"a small possibility.",
                      could:"possible, no more than that.",
                      should:"expected, if nothing goes wrong.",
                      will:"a straight prediction.",
                      must:"the only explanation that fits." } }},
  ],

  blockbustersSectionNames: {
    '1A': '1A · Food & cooking (20 clues)',
    '1B': '1B · Family & the future (15 clues)'
  },

  /* Race — the answers become tiles on the board, so every one is a single word and
     no two are the same. The prompts are gapped sentences, which is the shape this
     game suits and the reason its bank shares no prompt with any other. */
  raceBank: [
    {section:'1A', topic:'1A-vocab', prompt:"I never eat meat that is still ___ in the middle.", answer:"Raw"},
    {section:'1A', topic:'1A-vocab', prompt:"This curry is far too ___ for me — I need water.", answer:"Spicy"},
    {section:'1A', topic:'1A-vocab', prompt:"We had ___ salmon with lemon and herbs.", answer:"Grilled"},
    {section:'1A', topic:'1A-vocab', prompt:"The beans are ___, so they keep all their colour.", answer:"Steamed"},
    {section:'1A', topic:'1A-vocab', prompt:"I bought a ___ of raspberry jam at the market.", answer:"Jar"},
    {section:'1A', topic:'1A-vocab', prompt:"He is a very good ___ — everything he makes is excellent.", answer:"Cook"},
    {section:'1A', topic:'1A-vocab', prompt:"I'm ___ to peanuts, so I have to read every label.", answer:"Allergic"},
    {section:'1A', topic:'1A-vocab', prompt:"Vegetables contain a lot of ___, which fills you up.", answer:"Fibre"},
    {section:'1A', topic:'1A-vocab', prompt:"Eating slowly is better for your ___.", answer:"Digestion"},
    {section:'1A', topic:'1A-grammar', prompt:"Be quiet — I ___ having my lunch.", answer:"Am"},
    {section:'1A', topic:'1A-grammar', prompt:"She ___ coffee every single morning without fail.", answer:"Drinks"},
    {section:'1A', topic:'1A-grammar', prompt:"I ___ what you mean, but I still disagree.", answer:"Know"},

    {section:'1B', topic:'1B-vocab', prompt:"My ___ are both younger than me — one brother, one sister.", answer:"Siblings"},
    {section:'1B', topic:'1B-vocab', prompt:"My sister's son is my ___.", answer:"Nephew"},
    {section:'1B', topic:'1B-vocab', prompt:"My uncle's daughter is my ___.", answer:"Cousin"},
    {section:'1B', topic:'1B-vocab', prompt:"They have no children of their own, so they ___ a little girl.", answer:"Adopted"},
    {section:'1B', topic:'1B-vocab', prompt:"Three ___ live in that house: the grandparents, the parents and the kids.", answer:"Generations"},
    {section:'1B', topic:'1B-vocab', prompt:"After my father remarried, I had a ___ and two stepbrothers.", answer:"Stepmother"},
    {section:'1B', topic:'1B-grammar', prompt:"I ___ my grandparents on Sunday — it's all arranged.", answer:"Seeing"},
    {section:'1B', topic:'1B-grammar', prompt:"Look at those clouds — it's ___ to rain.", answer:"Going"},
    {section:'1B', topic:'1B-grammar', prompt:"Don't worry, I ___ tell anybody. I promise.", answer:"Won't"},
    {section:'1B', topic:'1B-grammar', prompt:"___ I make you a cup of tea?", answer:"Shall"},
    {section:'1B', topic:'1B-grammar', prompt:"I'd ___ not talk about that, if you don't mind.", answer:"Rather"},
    {section:'1B', topic:'1B-grammar', prompt:"I don't agree — I think it ___ on the situation.", answer:"Depends"},
  ],

  raceSectionNames: {
    '1A': '1A · Food, cooking & present tenses (12 words)',
    '1B': '1B · Family & future forms (12 words)'
  },

  /* Millionaire — the ladder is per team and runs 1 to 8, so every section needs at
     least two questions at every rung or two teams meet the identical question on
     the way up. Every one of these becomes a Multiple Choice round when its rung
     opens: the bank is unchanged, and the game builds the round from
     {answer, distractors} as the question opens. */
  millionaireBank: [
    {section:'1A', topic:'1A-vocab', level:1, prompt:"Which word means 'not cooked'?", answer:"raw", distractors:["ripe","rare","rich"]},
    {section:'1A', topic:'1A-vocab', level:1, prompt:"Which one is a way of cooking?", answer:"grilling", distractors:["chopping","peeling","grating"]},
    {section:'1A', topic:'1A-vocab', level:2, prompt:"Which adjective goes with 'sausages' in the phrase from the book?", answer:"hot", distractors:["warm","burning","heated"]},
    {section:'1A', topic:'1A-vocab', level:2, prompt:"Which word describes bread that has gone dry and old?", answer:"stale", distractors:["sour","rotten","mouldy"]},
    {section:'1A', topic:'1A-vocab', level:3, prompt:"If dairy disagrees with you but does not make you ill, you are lactose ___.", answer:"intolerant", distractors:["allergic","resistant","sensitive"]},
    {section:'1A', topic:'1A-vocab', level:3, prompt:"Which compound noun means the force of blood against your arteries?", answer:"blood pressure", distractors:["blood sugar","blood count","blood test"]},
    {section:'1A', topic:'1A-grammar', level:4, prompt:"Which sentence is correct?", answer:"I want a coffee.", distractors:["I am wanting a coffee.","I do wanting a coffee.","I am want a coffee."]},
    {section:'1A', topic:'1A-grammar', level:4, prompt:"Which verb is a non-action verb?", answer:"believe", distractors:["chew","stir","swallow"]},
    {section:'1A', topic:'1A-grammar', level:5, prompt:"'I ___ breakfast at seven every day.' Which fits?", answer:"have", distractors:["am having","do have","having"]},
    {section:'1A', topic:'1A-grammar', level:5, prompt:"'Don't call me at one — I ___ lunch then.' Which fits?", answer:"will be having", distractors:["have","am have","will have had"]},
    {section:'1A', topic:'1A-vocab', level:6, prompt:"According to the article, which should you eat first?", answer:"vegetables", distractors:["bread","rice","potatoes"]},
    {section:'1A', topic:'1A-vocab', level:6, prompt:"Which word means your desire to eat?", answer:"appetite", distractors:["digestion","nutrition","portion"]},
    {section:'1A', topic:'1A-grammar', level:7, prompt:"Why can a chef say 'I'm loving this'?", answer:"it is a deliberate informal use of a non-action verb", distractors:["'love' is always an action verb","the continuous is required after 'I'","it describes a permanent state"]},
    {section:'1A', topic:'1A-vocab', level:7, prompt:"Which is the most formal way to say you eat less of something?", answer:"reduce your intake", distractors:["cut down","cut back","go easy on"]},
    {section:'1A', topic:'1A-vocab', level:8, prompt:"The article says chewing longer helped people to do what?", answer:"burn more calories", distractors:["eat more food","chew less often","digest more slowly"]},
    {section:'1A', topic:'1A-grammar', level:8, prompt:"Which pair shows 'have' changing meaning?", answer:"I have a car / I'm having lunch", distractors:["I have lunch / I'm having lunch","I have a car / I have a bike","I'm having a car / I have a car"]},

    {section:'1B', topic:'1B-vocab', level:1, prompt:"Which word means your brothers and sisters?", answer:"siblings", distractors:["cousins","relatives","in-laws"]},
    {section:'1B', topic:'1B-vocab', level:1, prompt:"Your sister's son is your ___.", answer:"nephew", distractors:["niece","cousin","grandson"]},
    {section:'1B', topic:'1B-vocab', level:2, prompt:"A child with no brothers or sisters is an ___ child.", answer:"only", distractors:["single","alone","adopted"]},
    {section:'1B', topic:'1B-vocab', level:2, prompt:"Your father's new wife is your ___.", answer:"stepmother", distractors:["mother-in-law","godmother","grandmother"]},
    {section:'1B', topic:'1B-vocab', level:3, prompt:"Which family includes aunts, uncles and cousins?", answer:"extended", distractors:["immediate","blended","nuclear"]},
    {section:'1B', topic:'1B-vocab', level:3, prompt:"Two families joined when the parents got together make a ___ family.", answer:"blended", distractors:["extended","multi-generational","cohabiting"]},
    {section:'1B', topic:'1B-grammar', level:4, prompt:"'I ___ my grandparents on Sunday' — it is already arranged. Which fits?", answer:"am seeing", distractors:["will see","see","would see"]},
    {section:'1B', topic:'1B-grammar', level:4, prompt:"Which one is an offer?", answer:"Shall I make you a cup of tea?", distractors:["I'm making tea at six.","I'm going to make tea.","I make tea every day."]},
    {section:'1B', topic:'1B-grammar', level:5, prompt:"'Look at those clouds — it ___ rain.' Which fits best?", answer:"is going to", distractors:["will","shall","is raining"]},
    {section:'1B', topic:'1B-grammar', level:5, prompt:"Which sentence is a promise?", answer:"I won't tell anyone.", distractors:["I'm not telling anyone at the party.","I'm going to tell her tomorrow.","I never tell anyone."]},
    {section:'1B', topic:'1B-vocab', level:6, prompt:"Which word describes a couple living together but not married?", answer:"cohabiting", distractors:["blended","extended","immediate"]},
    {section:'1B', topic:'1B-vocab', level:6, prompt:"A household with grandparents, parents and children is ___.", answer:"multi-generational", distractors:["single-parent","nuclear","immediate"]},
    {section:'1B', topic:'1B-grammar', level:7, prompt:"Which is the politest way to refuse a personal question?", answer:"I'd rather not talk about that.", distractors:["That's none of your business.","I won't answer that.","Why do you want to know?"]},
    {section:'1B', topic:'1B-grammar', level:7, prompt:"Which phrase neither agrees nor disagrees?", answer:"I think it depends.", distractors:["I agree with that.","I don't think you're right.","That's true."]},
    {section:'1B', topic:'1B-grammar', level:8, prompt:"Which one is a plan rather than an arrangement?", answer:"I'm going to look for a job.", distractors:["I'm meeting her at four.","I'm flying on Tuesday.","I'm having dinner with them tonight."]},
    {section:'1B', topic:'1B-vocab', level:8, prompt:"Which word means a person you are descended from?", answer:"ancestor", distractors:["descendant","relative","heir"]},
  ],

  millionaireSectionNames: {
    '1A': '1A · Food, cooking & present tenses (16 questions)',
    '1B': '1B · Family & future forms (16 questions)'
  }
});
