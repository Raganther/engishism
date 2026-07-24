/* ================= Content bank — Empower C1 Unit 5: Fairness =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNIT.
   Authored from material/empower-c1-unit-5/ (pp.55-66 + Grammar/Vocab Focus). */
(window.UNITS = window.UNITS || []).push({
  id: "unit-5",
  label: "Cambridge Empower C1 · Unit 5 · Fairness",
  card: { num: "Unit 5", title: "Fairness", blurb: "Crime & justice, relative clauses, employment, obligation, recalling & speculating (5A–5C).", sections: "5A–5C" },
  intro: "Choose a template. You'll pick the content next — mix and match any of 5A–5C.",

  jeopardySectionLabels: {
    '5A': "5A · A place where you have to look over your shoulder",
    '5B': "5B · It's essential to have the right qualifications",
    '5C': "5C · I'd hazard a guess",
  },

  jeopardyCategories: [
    { id:'crime-justice', section:'5A', name:'Crime & Justice', clues:[
      {v:100, q:"Being kept in prison while awaiting trial: being 'held in ___'.", a:"custody"},
      {v:200, q:"'They made an ___ of fraud against him' — a formal accusation.", a:"an allegation"},
      {v:300, q:"Found by a court to have committed a crime: 'he's been ___ of murder'.", a:"convicted"},
      {v:400, q:"The formal evidence a witness gives in court.", a:"testimony"},
      {v:500, q:"'He ___ guilty to the crime' — he admitted it in court.", a:"pleaded"},
    ]},
    { id:'punishment', section:'5A', name:'Punishment & Rehab', clues:[
      {v:100, q:"Unpaid work done as a punishment: 'do ___ service'.", a:"community"},
      {v:200, q:"The most severe sentence: 'sentenced to life ___'.", a:"imprisonment"},
      {v:300, q:"Isolating a prisoner from all others: 'solitary ___'.", a:"confinement"},
      {v:400, q:"One-to-one or group sessions that support prisoners.", a:"counselling"},
      {v:500, q:"'Served a reduced sentence for good ___' — released early.", a:"behaviour"},
    ]},
    { id:'relative-clauses', section:'5A', name:'Relative Clauses', clues:[
      {v:100, q:"Relative pronoun for people: 'the officer ___ arrested him'.", a:"who"},
      {v:200, q:"Relative pronoun for a place: 'the prison ___ he was held'.", a:"where"},
      {v:300, q:"Defining or non-defining? 'Halden, which opened in 2010, is humane.'", a:"non-defining (extra info, uses commas)"},
      {v:400, q:"Complete (formal): 'the prison, the walls ___ which are covered in art'.", a:"of"},
      {v:500, q:"Make it formal: 'some of the prisoners, who have committed serious crimes' → 'some ___ ___ …'.", a:"of whom"},
    ]},
    { id:'employment', section:'5B', name:'Employment & Sectors', clues:[
      {v:100, q:"A distinct area of the economy, such as retail or transport: a ___.", a:"sector"},
      {v:200, q:"Banking and investment belong to the ___ sector.", a:"financial"},
      {v:300, q:"When jobs are cut and workers lose them: ___.", a:"redundancies"},
      {v:400, q:"Farming belongs to the ___ sector.", a:"agricultural"},
      {v:500, q:"Building houses and roads: the ___ sector.", a:"construction"},
    ]},
    { id:'pay-benefits', section:'5B', name:'Pay & Benefits', clues:[
      {v:100, q:"Flexible working hours are called ___.", a:"flexitime"},
      {v:200, q:"A long paid career break, often six months: a ___.", a:"sabbatical"},
      {v:300, q:"Pay linked to how well you do your job: ___-related pay.", a:"performance"},
      {v:400, q:"Leave for new fathers: ___ leave.", a:"paternity"},
      {v:500, q:"'Four ___ days' — days off a year with no reason needed.", a:"personal"},
    ]},
    { id:'obligation', section:'5B', name:'Obligation & Permission', clues:[
      {v:100, q:"Strong obligation from a rule (modal verb): 'you ___ wear a helmet'.", a:"must"},
      {v:200, q:"Formal necessity: 'you'll be ___ to have a diving qualification'.", a:"required"},
      {v:300, q:"Not allowed (formal): 'visitors are ___ to bring food into the building'.", a:"forbidden / not permitted"},
      {v:400, q:"Lack of obligation: 'you ___ have to pay tax on it' (it isn't necessary).", a:"don't"},
      {v:500, q:"Mild advice, not 'must': 'you ___ to get some experience first'.", a:"ought / should"},
    ]},
    { id:'recall-speculate', section:'5C', name:'Recall or Speculate?', clues:[
      {v:100, q:"Recalling or speculating? 'If my memory serves me correctly…'", a:"recalling"},
      {v:200, q:"Recalling or speculating? 'I'd hazard a guess that…'", a:"speculating"},
      {v:300, q:"Recalling or speculating? 'What stands out in my mind is…'", a:"recalling"},
      {v:400, q:"Recalling or speculating? 'I was under the impression that…'", a:"speculating"},
      {v:500, q:"Recalling or speculating? 'I think I remember her saying…'", a:"recalling"},
    ]},
    { id:'complete-expression', section:'5C', name:'Complete the Expression', clues:[
      {v:100, q:"'If my memory ___ me correctly…'", a:"serves"},
      {v:200, q:"'I'd ___ a guess that…'", a:"hazard"},
      {v:300, q:"'What ___ out in my mind is…'", a:"stands"},
      {v:400, q:"'I was under the ___ that you were writing another book.'", a:"impression"},
      {v:500, q:"'___ you're a technician, right?' — making an assumption.", a:"Presuming"},
    ]},
    { id:'meaning-match', section:'5C', name:'What Does It Mean?', clues:[
      {v:100, q:"'It's slipped my mind' means…", a:"I've forgotten it"},
      {v:200, q:"'I'd hazard a guess' means…", a:"I'll make a rough guess / estimate"},
      {v:300, q:"'No doubt you heard that from…' expresses…", a:"a confident assumption"},
      {v:400, q:"'If my memory serves me correctly' is used to…", a:"introduce something you're recalling (with slight uncertainty)"},
      {v:500, q:"'What stands out in my mind' refers to…", a:"the thing you remember most clearly"},
    ]},
  ],

  blockbustersBank: [
    /* ---- 5A: crime & justice (single-word answers) ---- */
    {section:'5A', letter:'F', clue:"A financial crime of deception for personal gain.", answer:"Fraud"},
    {section:'5A', letter:'M', clue:"The most serious crime — unlawful killing.", answer:"Murder"},
    {section:'5A', letter:'C', clue:"Held before trial: held in ___.", answer:"Custody"},
    {section:'5A', letter:'T', clue:"The formal evidence a witness gives in court.", answer:"Testimony"},
    {section:'5A', letter:'A', clue:"A claim that you were elsewhere when the crime happened.", answer:"Alibi"},
    {section:'5A', letter:'V', clue:"The court's decision: guilty or not guilty.", answer:"Verdict"},
    {section:'5A', letter:'J', clue:"The group of ordinary citizens who decide guilt.", answer:"Jury"},
    {section:'5A', letter:'W', clue:"Someone who saw the crime happen.", answer:"Witness"},
    {section:'5A', letter:'P', clue:"The lawyers trying to prove the accused is guilty.", answer:"Prosecution"},
    {section:'5A', letter:'S', clue:"The punishment a judge hands down.", answer:"Sentence"},
    {section:'5A', letter:'I', clue:"'Life ___' — being locked up for the rest of your life.", answer:"Imprisonment"},
    {section:'5A', letter:'R', clue:"Helping offenders return to normal life in society.", answer:"Rehabilitation"},
    {section:'5A', letter:'B', clue:"'___ from driving' — stopped from driving as a punishment.", answer:"Banned"},
    {section:'5A', letter:'L', clue:"Money ___ — hiding where illegally-earned cash came from.", answer:"Laundering"},
    {section:'5A', letter:'G', clue:"'Found ___ of the crime' — the opposite of innocent.", answer:"Guilty"},
    {section:'5A', letter:'D', clue:"The ___ lawyer argues on behalf of the accused.", answer:"Defence"},
    {section:'5A', letter:'O', clue:"The formal word for a crime or illegal act.", answer:"Offence"},
    {section:'5A', letter:'S', clue:"Kept apart from all other prisoners: '___ confinement'.", answer:"Solitary"},

    /* ---- 5B: employment & obligation (single-word answers) ---- */
    {section:'5B', letter:'F', clue:"Banking and investment belong to this sector.", answer:"Financial"},
    {section:'5B', letter:'A', clue:"Farming belongs to this sector.", answer:"Agricultural"},
    {section:'5B', letter:'C', clue:"Building houses and roads: this sector.", answer:"Construction"},
    {section:'5B', letter:'R', clue:"Shops and selling to customers: this sector.", answer:"Retail"},
    {section:'5B', letter:'M', clue:"Making goods in factories: this sector.", answer:"Manufacturing"},
    {section:'5B', letter:'T', clue:"Moving goods and people around: this sector.", answer:"Transport"},
    {section:'5B', letter:'E', clue:"Oil, gas and electricity: this sector.", answer:"Energy"},
    {section:'5B', letter:'P', clue:"Government-run services: the ___ sector.", answer:"Public"},
    {section:'5B', letter:'S', clue:"A distinct area of the economy.", answer:"Sector"},
    {section:'5B', letter:'R', clue:"Job cuts that make workers lose their jobs.", answer:"Redundancies"},
    {section:'5B', letter:'F', clue:"A benefit that lets you choose your own working hours.", answer:"Flexitime"},
    {section:'5B', letter:'S', clue:"A long paid career break, often six months.", answer:"Sabbatical"},
    {section:'5B', letter:'P', clue:"Leave for new fathers: ___ leave.", answer:"Paternity"},
    {section:'5B', letter:'M', clue:"A ___ requirement is one you absolutely MUST meet.", answer:"Mandatory"},
    {section:'5B', letter:'O', clue:"'You are ___ to wear protective clothing' — formal strong obligation (be ___).", answer:"Obliged"},
    {section:'5B', letter:'Q', clue:"The training and certificates a job requires.", answer:"Qualifications"},

    /* ---- 5C: recalling & speculating (single-word answers) ---- */
    {section:'5C', letter:'M', clue:"'If my ___ serves me correctly…'", answer:"Memory"},
    {section:'5C', letter:'I', clue:"'I was under the ___ that you were writing another book.'", answer:"Impression"},
    {section:'5C', letter:'H', clue:"'I'd ___ a guess that…' — make a rough estimate.", answer:"Hazard"},
    {section:'5C', letter:'G', clue:"'I'd hazard a ___ that…'", answer:"Guess"},
    {section:'5C', letter:'S', clue:"'What ___ out in my mind is…'", answer:"Stands"},
    {section:'5C', letter:'P', clue:"'___ you're a technician, right?' — making an assumption.", answer:"Presuming"},
    {section:'5C', letter:'D', clue:"'No ___ you heard that from…' — a confident assumption.", answer:"Doubt"},
    {section:'5C', letter:'R', clue:"To ___ something is to bring a past event back to mind.", answer:"Recall"},
    {section:'5C', letter:'S', clue:"To ___ is to guess about something you're not sure of.", answer:"Speculate"},
    {section:'5C', letter:'M', clue:"'It's slipped my ___' — I've forgotten it.", answer:"Mind"},
  ],

  blockbustersSectionNames: {
    '5A':'5A · Crime & justice (18 clues)',
    '5B':'5B · Employment & obligation (16 clues)',
    '5C':'5C · Recalling & speculating (10 clues)',
  },

  /* ---- Race to the Board ----------------------------------------------------
     Gapped sentences, not definitions. The words themselves are on screen, so
     the prompt tests collocation and word form in context — a different angle on
     the same target language from Jeopardy's Q&A and Blockbusters' definitions.
     Distractors are not authored: every other word on the board is a real target
     word from the selected sections, so wrong taps are still teachable.
     Fields: section, prompt (use ___ for the gap), answer (one word). */
  raceBank: [
    /* ---- 5A: crime & justice ---- */
    {section:'5A', prompt:"The jury returned a ___ of not guilty after six hours.", answer:"Verdict"},
    {section:'5A', prompt:"He was held in ___ for three months before the trial began.", answer:"Custody"},
    {section:'5A', prompt:"She has a solid ___ — she was at work when the robbery happened.", answer:"Alibi"},
    {section:'5A', prompt:"The ___ lawyer argued there was no evidence against her client.", answer:"Defence"},
    {section:'5A', prompt:"He was ___ of fraud and sentenced to two years.", answer:"Convicted"},
    {section:'5A', prompt:"The judge handed down a five-year ___.", answer:"Sentence"},
    {section:'5A', prompt:"The ___ called three witnesses to prove the case.", answer:"Prosecution"},
    {section:'5A', prompt:"Instead of prison, he was ordered to do 200 hours of ___ service.", answer:"Community"},
    {section:'5A', prompt:"The prison in Norway focuses on ___ rather than punishment.", answer:"Rehabilitation"},
    {section:'5A', prompt:"Her ___ in court contradicted what she had told the police.", answer:"Testimony"},
    {section:'5A', prompt:"He was ___ from driving for eighteen months.", answer:"Banned"},
    {section:'5A', prompt:"Prisoners who attack staff can be put in ___ confinement.", answer:"Solitary"},

    /* ---- 5B: employment, pay & obligation ---- */
    {section:'5B', prompt:"After twelve years at the firm she took a six-month ___ to travel.", answer:"Sabbatical"},
    {section:'5B', prompt:"___ means staff can choose when they start and finish work.", answer:"Flexitime"},
    {section:'5B', prompt:"The company announced 200 ___ after a sharp fall in sales.", answer:"Redundancies"},
    {section:'5B', prompt:"New fathers are entitled to two weeks' ___ leave.", answer:"Paternity"},
    {section:'5B', prompt:"Safety training is ___ — every employee has to complete it.", answer:"Mandatory"},
    {section:'5B', prompt:"You'll be ___ to hold a diving certificate for this role.", answer:"Required"},
    {section:'5B', prompt:"Employers are legally ___ to provide protective clothing.", answer:"Obliged"},
    {section:'5B', prompt:"Most of the jobs lost were in the ___ sector — factories and plants.", answer:"Manufacturing"},
    {section:'5B', prompt:"Banking, insurance and investment make up the ___ sector.", answer:"Financial"},
    {section:'5B', prompt:"She didn't have the right ___, so her application was rejected.", answer:"Qualifications"},
    {section:'5B', prompt:"Bonuses here are ___-related — the better you do, the more you earn.", answer:"Performance"},
    {section:'5B', prompt:"Schools and hospitals belong to the ___ sector.", answer:"Public"},

    /* ---- 5C: recalling & speculating ---- */
    {section:'5C', prompt:"If my ___ serves me correctly, we met at a conference in Berlin.", answer:"Memory"},
    {section:'5C', prompt:"If my memory ___ me correctly, it was a Tuesday in October.", answer:"Serves"},
    {section:'5C', prompt:"I'd ___ a guess that she's about forty.", answer:"Hazard"},
    {section:'5C', prompt:"I'd hazard a ___ that it cost around two thousand euros.", answer:"Guess"},
    {section:'5C', prompt:"What ___ out in my mind is how quiet the room went.", answer:"Stands"},
    {section:'5C', prompt:"I was under the ___ that you'd already left the company.", answer:"Impression"},
    {section:'5C', prompt:"No ___ you've heard the news already.", answer:"Doubt"},
    {section:'5C', prompt:"___ you're the technician, right? The server's through there.", answer:"Presuming"},
    {section:'5C', prompt:"Sorry, his name has completely ___ my mind.", answer:"Slipped"},
    {section:'5C', prompt:"I can't ___ exactly what she said, but it was something like that.", answer:"Recall"},
    {section:'5C', prompt:"It's pointless to ___ about what might have happened.", answer:"Speculate"},
    {section:'5C', prompt:"I think I ___ her saying she'd be late.", answer:"Remember"},
  ],

  raceSectionNames: {
    '5A':'5A · Crime & justice (12 words)',
    '5B':'5B · Employment & obligation (12 words)',
    '5C':'5C · Recalling & speculating (12 words)',
  },
});
