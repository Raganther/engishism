/* ================= Content bank — B2 · Advertising & persuasion =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNITS.

   Written for **Flip** first, which is why one rule here is stricter than anywhere
   else in the project. Flip shuffles every selected clue into one pool and deals
   twenty-five of them face down, so a board can hold any two clues from this pack at
   once — which means **no clue may give away any other clue in the whole unit**, not
   merely in its own column. On a Jeopardy board the columns are separate and the rule
   is per-column; here it is per-pack, and every anagram answer (campaign, manipulate,
   claim, slogan, refund) was checked against every other prompt, option list, word set
   and gloss in the file.

   Five columns of five, which is exactly a 5×5 Flip board with every column ticked.
   Each column is a MIXED column in the 4B shape — the round type rising with the value
   ($100 Multiple Choice → $200 Connections → $300 Drag the Letters → $400 Word
   Thermometer → $500 Drag the Words) — so the pack plays as Jeopardy too, where the
   rise means something. **$400 follows the 4B rule: a scale where one exists, a form
   where it does not.** Four columns have a real cline; "Sounds Better Than It Is" is
   grammar and has none (a cline of comparatives is arguable, and an arguable scale
   marks a reasonable answer wrong), so it takes an error-fix, which is exactly what a
   double comparative needs.

   **The topic is chosen for what it lets a class argue about.** Advertising is the one
   subject where the target language and critical thinking are the same lesson: "up to
   50% off" is a vocabulary item and a trick at the same time, and a student who can say
   why it promises almost nothing has understood the grammar and the persuasion
   together. So the pack is deliberately weighted toward what a claim actually commits
   to — the hedges, the incomplete comparatives, the small print — rather than toward
   naming kinds of advert.

   **Every Multiple Choice and Connections clue carries `physics:true`** — the flag the
   content screen's Tap/Flick toggle writes onto a row's items — because that toggle
   only appears on a row whose five clues are one round, and every column here is mixed.
   So the whole pack opens on the physics face.

   B2, with a few stretch items held back to $300–$500 (extortionate, daylight robbery,
   storyboard, manipulate). Every clue states its own context, so a teacher who has not
   planned the lesson can still play it. */
window.UNITS.push({
  id: 'advertising',
  label: 'B2 · Advertising & persuasion',
  card: { num:'B2', title:'Advertising',
          blurb:'Where you see it, what it does to you, what the small print is hiding, the grammar of ad copy, and buying things you did not mean to buy. Mixed rounds throughout.',
          sections:'AD' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    'AD': 'Advertising · the language of persuasion, and what it hides'
  },

  jeopardyCategories: [
    /* ---- 1 · the media and the trade. The lightest column, and the one that gives
            a class the nouns it needs before it can argue about anything else. The
            $400 is the life of an advert, which is a real chronology and therefore
            not arguable at that spacing. ---- */
    { id:'ad-where', section:'AD', name:'Where You See It', clues:[
      {v:100, q:"'They rented a ___ on the motorway into the city.' A very large outdoor advertising board. Which one?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["billboard","jingle","brochure","pop-up"],
                 answer:"billboard" }},
      {v:200, q:"Four of these are adverts themselves; four are people involved in making or seeing one. Find the four adverts.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["commercial","pop-up","banner","sponsored post"],
                with:["copywriter","consumer","client","audience"] }},
      {v:300, q:"'The new ___ runs on television and social media for six weeks.' A set of adverts planned and released together. (8 letters)",
        anagram:{ word:"campaign" }},
      {v:400, q:"Put these in order — the earliest stage first.",
        order:{ scale:["brief","concept","storyboard","shoot","launch"],
                low:"the client says what they want", high:"the public finally sees it",
                gloss:{ brief:"the client explains what they want and what it has to do.",
                        concept:"the agency comes up with the idea.",
                        storyboard:"the idea is drawn out shot by shot before anything is filmed.",
                        shoot:"it is actually filmed.",
                        launch:"it goes out to the public." } }},
      {v:500, q:"Put the words in order — a definition worth knowing.",
        scramble:{ sentence:"Product placement is when a brand appears inside a film" }},
    ]},

    /* ---- 2 · the persuasion itself. The $200 is the distinction the whole topic
            turns on — what an advert wants you to FEEL against what it wants you to
            DO — and the $400 is the honesty cline, from telling you the facts to
            leading you somewhere untrue. ---- */
    { id:'ad-persuade', section:'AD', name:'What It Does To You', clues:[
      {v:100, q:"'The advert ___ young men aged 18 to 25.' Which verb means it is aimed specifically at them?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["targets","reaches","follows","meets"],
                 answer:"targets" }},
      {v:200, q:"Four of these are feelings an advert wants you to have; four are actions it wants you to take. Find the four feelings.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["envy","desire","fear","pride"],
                with:["click","subscribe","download","buy"] }},
      {v:300, q:"'Some people argue that adverts ___ children, because a child cannot see the intention behind them.' To control somebody unfairly, without their knowing. (10 letters)",
        anagram:{ word:"manipulate" }},
      {v:400, q:"Put these in order — the most honest first.",
        order:{ scale:["inform","suggest","persuade","exaggerate","mislead"],
                low:"you are given the facts", high:"you are led to believe something untrue",
                gloss:{ inform:"you are given the facts and left to decide.",
                        suggest:"it hints at a benefit without ever claiming it.",
                        persuade:"it argues openly that you should buy.",
                        exaggerate:"it makes the benefit sound bigger than it really is.",
                        mislead:"it leads you to believe something that is not true." } }},
      {v:500, q:"Put the words in order — how advertising actually works.",
        scramble:{ sentence:"Good advertising makes you feel something before you think" }},
    ]},

    /* ---- 3 · the small print, and the column the lesson is really for. The $100
            and the $200 are the same trick twice — a phrase that sounds like a
            promise and commits to nothing — and the $400 is what happens when
            somebody finally challenges one. ---- */
    { id:'ad-claims', section:'AD', name:'Read The Small Print', clues:[
      {v:100, q:"A shop window says 'Up to 50% off!'. What is it actually promising?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["50% off at most, and possibly far less","50% off everything in the shop","at least 50% off","50% off once you spend enough"],
                 answer:"50% off at most, and possibly far less" }},
      {v:200, q:"Four of these leave the advertiser a way out; four sound completely certain. Find the four that leave a way out.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["up to","may help","results may vary","in selected stores"],
                with:["guaranteed","proven","every single time","no exceptions"] }},
      {v:300, q:"'The company had to withdraw its ___ that the drink improved memory.' A statement that something is true, made without proof. (5 letters)",
        anagram:{ word:"claim" }},
      {v:400, q:"Put these in order — what happens first when an advert is challenged.",
        order:{ scale:["complaint","investigation","ruling","withdrawal","fine"],
                low:"somebody objects", high:"the company pays",
                gloss:{ complaint:"a member of the public objects to the advert.",
                        investigation:"the regulator looks into whether the advert is honest.",
                        ruling:"the regulator decides against the company.",
                        withdrawal:"the advert is taken off the air.",
                        fine:"the company is made to pay money." } }},
      {v:500, q:"Put the words in order — the advice this whole column gives.",
        scramble:{ sentence:"Always check what the small print does not say" }},
    ]},

    /* ---- 4 · the grammar of ad copy. Comparatives and superlatives are what
            advertising is written in, and the trap is the incomplete comparison —
            "50% more" than what? No defensible cline exists here (ordering
            comparatives is arguable), so $400 is an error-fix on the mistake an
            Italian speaker makes most: the double comparative. ---- */
    { id:'ad-grammar', section:'AD', name:'Sounds Better Than It Is', clues:[
      {v:100, q:"'Our new formula is ___ than ever.' Which one completes it?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["smoother","more smooth","smoothest","most smooth"],
                 answer:"smoother" }},
      {v:200, q:"Four of these adjectives add '-er' to compare; four need 'more' in front. Find the four that add '-er'.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["cheap","fast","bright","strong"],
                with:["effective","powerful","reliable","expensive"] }},
      {v:300, q:"'Just Do It' is the company's most famous ___.' A short phrase a brand repeats in every advert. (6 letters)",
        anagram:{ word:"slogan" }},
      {v:400, q:"Correct the comparative: 'This washing powder is *more cheaper* than the leading brand.'",
        a:"cheaper", type:"errorfix"},
      {v:500, q:"Put the words in order — a comparison with nothing to compare against.",
        scramble:{ sentence:"No other brand gives you whiter teeth in less time" }},
    ]},

    /* ---- 5 · the consumer's side, and the one column that is about regret. The
            $200 is the pair every B2 class needs and half of them get backwards; the
            $400 is the online buying chain, which is chronological and gives the
            class the verbs for the one thing they all do every week. ---- */
    { id:'ad-buying', section:'AD', name:'Buying And Regretting', clues:[
      {v:100, q:"'I only went in for milk and came out with a coat.' What do we call a purchase like that?",
        physics:true,   // opens on the flick face — four tiles, one slot
        choice:{ options:["an impulse buy","a receipt","a guarantee","a warranty"],
                 answer:"an impulse buy" }},
      {v:200, q:"Four of these mean you paid far too much; four mean you paid less than usual. Find the four that mean you paid too much.",
        physics:true,   // opens on the flick face — eight tiles, a row of four
        group:{ pick:["a rip-off","overpriced","extortionate","daylight robbery"],
                with:["a bargain","discounted","reduced","half price"] }},
      {v:300, q:"'You have fourteen days to ask for a ___ if you change your mind.' Your money back. (6 letters)",
        anagram:{ word:"refund" }},
      {v:400, q:"Put these in order — what you do first when you buy online.",
        order:{ scale:["browse","add to basket","checkout","delivery","return"],
                low:"you have decided nothing", high:"it goes back to the shop",
                gloss:{ browse:"you look without meaning to buy anything.",
                        'add to basket':"you choose it, but you have not paid.",
                        checkout:"you pay.",
                        delivery:"it arrives at your door.",
                        return:"you send it back because you changed your mind." } }},
      {v:500, q:"Put the words in order — a confession most of the class can make.",
        scramble:{ sentence:"I regret every subscription I have ever signed up for" }},
    ]},
  ]
});
