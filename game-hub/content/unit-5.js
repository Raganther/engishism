/* ================= Content bank — Empower C1 Unit 5: Fairness =================
   Data only. Consumed by game-hub/hub-engine.js via window.UNIT.
   Authored from material/empower-c1-unit-5/ (pp.55-66 + Grammar/Vocab Focus). */
(window.UNITS = window.UNITS || []).push({
  id: "unit-5",
  label: "Cambridge Empower C1 · Unit 5 · Fairness",
  card: { num: "Unit 5", title: "Fairness", blurb: "Crime & justice, relative clauses, employment, obligation, recalling & speculating, opinion essays (5A–5D).", sections: "5A–5D" },
  intro: "Choose a template. You'll pick the content next — mix and match any of 5A–5D.",

  jeopardySectionLabels: {
    '5A': "5A · A place where you have to look over your shoulder",
    '5B': "5B · It's essential to have the right qualifications",
    '5C': "5C · I'd hazard a guess",
    '5D': "5D · It's a way of making the application process more efficient",
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
    /* Word order, which neither of the other two 5A grammar categories can ask.
       A gap fill hands the student a finished sentence and asks for the pronoun;
       only a scramble asks where the clause interrupts the main clause, whether
       the preposition fronts, and where the commas fall — the actual C1 difficulty
       on p146. Sentences are the book's own, put back out of order. */
    { id:'rel-sentence-order', section:'5A', name:'Sentence Order', clues:[
      {v:100, type:'scramble', q:"Word order — defining clause with 'that':", a:"The law that was recently passed makes no sense"},
      {v:200, type:'scramble', q:"Word order — the clause interrupts the main clause:", a:"The officer who arrested him has since retired"},
      {v:300, type:'scramble', q:"Word order — preposition before 'whom':", a:"The witness to whom we spoke has disappeared"},
      {v:400, type:'scramble', q:"Word order — non-defining, so mind the commas:", a:"Halden prison, which opened in 2010, is humane"},
      {v:500, type:'scramble', q:"Word order — 'of which' in formal writing:", a:"The prison, the walls of which are covered in art"},
    ]},
    /* The second half of Grammar Focus 5A (p146). The first category covers who /
       where / defining-vs-non-defining; this one takes the parts a C1 class actually
       gets wrong — whom after a preposition, whose, which for a whole clause, the
       fixed formal phrases, and the multi-word-verb trap the book flags explicitly. */
    { id:'which-or-whom', section:'5A', name:'Which or Whom?', clues:[
      {v:100, q:"Object pronoun for people in formal writing: 'the woman ___ I met at the party'.", a:"whom"},
      {v:200, q:"Possessive relative pronoun: 'the elderly woman ___ bag was taken'.", a:"whose"},
      {v:300, q:"Which word refers back to the whole clause? 'She lied on her form, ___ was a bad sign.'", a:"which"},
      {v:400, q:"Finish the formal phrase: 'the guilty person has been found, in ___ ___ you are free to go'.", a:"which case"},
      {v:500, q:"Correct it: 'The children after whom I look are very naughty.'", a:"the children who I look after (keep the particle with the verb)"},
    ]},
    { id:'change-the-word', section:'5A', name:'Change the Word', clues:[
      {v:100, q:"Change the verb 'to convict' into the noun for the court's decision.", a:"conviction"},
      {v:200, q:"Change 'crime' into the word for the person who commits one.", a:"criminal"},
      {v:300, q:"Change 'guilt' into the adjective a court uses in its verdict.", a:"guilty"},
      {v:400, q:"Change the verb 'to prosecute' into the noun for the lawyers doing it.", a:"the prosecution"},
      {v:500, q:"Change 'rehabilitate' into the noun for the whole process.", a:"rehabilitation"},
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
    { id:'spot-the-error', section:'5B', name:'Spot the Error', clues:[
      {v:100, q:"Correct it: 'You must to wear a helmet on site.'", a:"you must wear (no 'to' after a modal)"},
      {v:200, q:"Correct it: 'She is obliged for provide safety gear.'", a:"obliged TO provide"},
      {v:300, q:"Correct it: 'It isn't permitted bringing food into the lab.'", a:"permitted TO BRING"},
      {v:400, q:"Correct it: 'You haven't to pay tax on that.'", a:"you don't have to pay"},
      {v:500, q:"Correct it: 'He was made redundancy last year.'", a:"he was made REDUNDANT (adjective)"},
    ]},
    /* The distinction Grammar Focus 5B (p147) is built around — must imposes an
       obligation, have to describes one somebody else imposed — plus the parts of
       the page nothing else tested: must has no past, had better, be supposed to. */
    { id:'must-or-have-to', section:'5B', name:'Must or Have To?', clues:[
      {v:100, q:"Which one describes a rule somebody else made — 'must' or 'have to'?", a:"have to (must imposes the rule yourself)"},
      {v:200, q:"Imposing an obligation on yourself: 'I really ___ organise my time better'.", a:"must"},
      {v:300, q:"'Must' has no past. Put it in the past: 'I must go on a business trip.'", a:"I had to go"},
      {v:400, q:"Urgent advice, two words: 'You ___ ___ be early tomorrow!'", a:"had better"},
      {v:500, q:"What the rules say: 'The Finance Director is ___ ___ authorise all major spending.'", a:"supposed to"},
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
    { id:'odd-one-out', section:'5C', name:'Odd One Out', clues:[
      {v:100, q:"Which is NOT about remembering? recall / remember / hazard / memory", a:"hazard (it's for guessing)"},
      {v:200, q:"Which shows you are SURE? I'd hazard a guess / I'd say roughly / no doubt / I'm not certain", a:"no doubt"},
      {v:300, q:"Which is NOT a real expression? it slipped my mind / it crossed my mind / it fell out of my mind", a:"it fell out of my mind"},
      {v:400, q:"Which adjective does NOT go with 'memory'? vague / painful / lasting / heavy", a:"heavy"},
      {v:500, q:"Which does NOT introduce something you recall? if my memory serves / what stands out in my mind / I'd hazard a guess", a:"I'd hazard a guess (that's speculating)"},
    ]},
    /* 5D, Skills for Writing (pp.64-65). The writing lesson is as gameable as any
       other section once you stop treating it as "an essay": the linkers are
       vocabulary, and the paragraph functions are a fixed, testable structure. */
    { id:'essay-structure', section:'5D', name:'Essay Structure', clues:[
      {v:100, q:"Which paragraph outlines the topic and gets the reader interested?", a:"the introduction"},
      {v:200, q:"What do paragraphs 2 and 3 of an opinion essay do?", a:"present each side of the argument"},
      {v:300, q:"What belongs in the last paragraph of an opinion essay?", a:"the writer's balanced opinion of both sides"},
      {v:400, q:"Name one good way to open an essay introduction.", a:"facts and figures / a surprising statement / outlining the issue"},
      {v:500, q:"Which must NOT go in a conclusion: a course of action, a summary, or new information?", a:"new information"},
    ]},
    { id:'linking-addition', section:'5D', name:'Linking: Addition', clues:[
      {v:100, q:"One-word linker meaning 'in addition', used to start a new sentence.", a:"moreover / furthermore"},
      {v:200, q:"Complete: '___ addition, they complain that companies go trawling.'", a:"In"},
      {v:300, q:"Which joins two ideas inside ONE sentence — 'as well as' or 'in addition'?", a:"as well as"},
      {v:400, q:"Which two-word phrase marks your single most important argument?", a:"above all"},
      {v:500, q:"Start with 'Beyond': 'Employers research applicants online and also contact referees.'", a:"Beyond researching applicants online, employers contact referees"},
    ]},
  ],

  blockbustersBank: [
    /* ---- typed forms: the shape of the question is the task (Kit.prompt) ---- */
    {section:'5A', type:'anagram', letter:'V', clue:"Unscramble: the decision a jury delivers.", answer:"Verdict"},
    {section:'5B', type:'anagram', letter:'W', clue:"Unscramble: the money paid for a week's work.", answer:"Wages"},
    {section:'5C', type:'anagram', letter:'H', clue:"Unscramble: a guess based on very little evidence.", answer:"Hunch"},
    {section:'5D', type:'anagram', letter:'C', clue:"Unscramble: the paragraph that closes an essay.", answer:"Conclusion"},
    {section:'5A', type:'oddoneout', letter:'S', clue:"Which does NOT belong: verdict / jury / sabbatical", answer:"Sabbatical"},
    {section:'5B', type:'oddoneout', letter:'T', clue:"Which does NOT belong: salary / bonus / testimony", answer:"Testimony"},
    {section:'5C', type:'oddoneout', letter:'B', clue:"Which does NOT belong: reckon / suspect / burgle", answer:"Burgle"},
    {section:'5D', type:'oddoneout', letter:'A', clue:"Which does NOT belong: however / moreover / arrest", answer:"Arrest"},
    /* ---- 5A: crime & justice (single-word answers) ---- */
    {section:'5A', letter:'F', clue:"A financial crime of deception for personal gain.", answer:"Fraud"},
    {section:'5A', letter:'M', clue:"The most serious crime — unlawful killing.", answer:"Murder"},
    {section:'5A', letter:'C', clue:"Held before trial: held in ___.", answer:"Custody"},
    {section:'5A', letter:'T', clue:"'He gave ___ against his former business partner' — a witness's sworn account.", answer:"Testimony"},
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
    {section:'5B', letter:'P', clue:"Leave for the new father, as opposed to maternity leave.", answer:"Paternity"},
    {section:'5B', letter:'M', clue:"A ___ requirement is one you absolutely MUST meet.", answer:"Mandatory"},
    {section:'5B', letter:'O', clue:"'You are ___ to wear protective clothing' — formal strong obligation (be ___).", answer:"Obliged"},
    {section:'5B', letter:'Q', clue:"The training and certificates a job requires.", answer:"Qualifications"},
    /* Phrase-box exponents from Grammar Focus 5B (p147). Relative clauses are
       deliberately NOT here: single-word answers keyed by an initial make W
       ambiguous across who / whom / whose / where / when / why, which would make
       the letter a hindrance rather than the clue it is meant to be. */
    {section:'5B', letter:'F', clue:"'Visitors are ___ to bring food into the building' — formal refusal of permission.", answer:"Forbidden"},
    {section:'5B', letter:'E', clue:"'How can she be ___ to be in two places at once?' — mild obligation.", answer:"Expected"},
    {section:'5B', letter:'S', clue:"'I was ___ to read the report by today' — what the rules said I'd do.", answer:"Supposed"},
    {section:'5B', letter:'A', clue:"'It is ___ to wear protective clothing' — formal advice, not an order.", answer:"Advisable"},

    /* ---- 5C: recalling & speculating (single-word answers) ---- */
    {section:'5C', letter:'M', clue:"'If my ___ serves me correctly…'", answer:"Memory"},
    {section:'5C', letter:'I', clue:"A belief you held that turned out to be wrong — you were 'under' one.", answer:"Impression"},
    {section:'5C', letter:'H', clue:"'I'd ___ a guess that…' — make a rough estimate.", answer:"Hazard"},
    {section:'5C', letter:'G', clue:"'I'd hazard a ___ that…'", answer:"Guess"},
    {section:'5C', letter:'S', clue:"To ___ out is to be the one detail you remember most vividly.", answer:"Stands"},
    {section:'5C', letter:'P', clue:"'___ nothing goes wrong, we'll be finished by six' — assuming, without checking.", answer:"Presuming"},
    {section:'5C', letter:'D', clue:"'No ___ you heard that from…' — a confident assumption.", answer:"Doubt"},
    {section:'5C', letter:'R', clue:"To ___ something is to bring a past event back to mind.", answer:"Recall"},
    {section:'5C', letter:'S', clue:"To ___ is to guess about something you're not sure of.", answer:"Speculate"},

    /* ---- 5D: opinion essays & linking (single-word answers) ---- */
    {section:'5D', letter:'M', clue:"A one-word linker meaning 'in addition', used to start a new sentence.", answer:"Moreover"},
    {section:'5D', letter:'F', clue:"Another one-word linker meaning 'what is more' — often the final point.", answer:"Furthermore"},
    {section:'5D', letter:'B', clue:"'___, time saved is money saved' — adds a reinforcing point.", answer:"Besides"},
    {section:'5D', letter:'A', clue:"'___ all' — the phrase marking your most important argument.", answer:"Above"},
    {section:'5D', letter:'P', clue:"'In ___' — a linker that narrows to one specific case.", answer:"Particular"},
    {section:'5D', letter:'I', clue:"The paragraph that outlines the topic and catches the reader's interest.", answer:"Introduction"},
    {section:'5D', letter:'C', clue:"The final paragraph, where you give your balanced opinion.", answer:"Conclusion"},
    {section:'5D', letter:'B', clue:"A good conclusion gives a ___ opinion of both arguments.", answer:"Balanced"},
    {section:'5D', letter:'T', clue:"Employers going '___' are actively hunting for negative posts.", answer:"Trawling"},
    {section:'5D', letter:'D', clue:"To treat someone unfairly because of their age or medical history.", answer:"Discriminate"},
    {section:'5D', letter:'P', clue:"Applicants have voiced ___ concerns about social media checks.", answer:"Privacy"},
    {section:'5D', letter:'S', clue:"The ___ process is how a company chooses between applicants.", answer:"Selection"},
    {section:'5D', letter:'T', clue:"Checks need to be fair and ___ — open and easy to see.", answer:"Transparent"},
    {section:'5D', letter:'G', clue:"'___ or laws' are needed to restrict what employers may research.", answer:"Guidelines"},
    {section:'5C', letter:'M', clue:"'It's slipped my ___' — I've forgotten it.", answer:"Mind"},

    /* ---- added later: transformations and opposites, to vary the clue types ---- */
    {section:'5A', letter:'C', clue:"The formal record that a court has found you guilty.", answer:"Conviction"},
    {section:'5A', letter:'C', clue:"The adjective in both '___ record' and '___ damage'.", answer:"Criminal"},
    {section:'5A', letter:'I', clue:"The opposite of a guilty verdict.", answer:"Innocent"},
    {section:'5A', letter:'A', clue:"Change the noun 'accusation' into the past participle: 'he was ___ of fraud'.", answer:"Accused"},
    {section:'5B', letter:'R', clue:"Change the adjective 'redundant' into the noun for the job cuts.", answer:"Redundancy"},
    {section:'5B', letter:'O', clue:"Change the verb 'oblige' into the noun for a duty you must fulfil.", answer:"Obligation"},
    {section:'5B', letter:'P', clue:"Change the verb 'permit' into the noun for official approval.", answer:"Permission"},
    {section:'5B', letter:'M', clue:"Give another word for 'compulsory' — something you absolutely must do.", answer:"Mandatory"},
    {section:'5C', letter:'S', clue:"Change the verb 'to speculate' into the noun.", answer:"Speculation"},
    {section:'5C', letter:'A', clue:"Change the verb 'assume' into the noun for something taken for granted.", answer:"Assumption"},
    {section:'5C', letter:'I', clue:"Change the verb 'impress' into the noun used in 'I was under the ___'.", answer:"Impression"},
    {section:'5C', letter:'V', clue:"Which adjective describes a memory that is unclear or hazy?", answer:"Vague"},
  ],

  blockbustersSectionNames: {
    '5A':'5A · Crime & justice (24 clues)',
    '5B':'5B · Employment & obligation (26 clues)',
    '5C':'5C · Recalling & speculating (16 clues)',
    '5D':'5D · Opinion essays & linking (16 clues)',
  },

  /* ---- Race to the Board ----------------------------------------------------
     Gapped sentences, not definitions. The words themselves are on screen, so
     the prompt tests collocation and word form in context — a different angle on
     the same target language from Jeopardy's Q&A and Blockbusters' definitions.
     Distractors are not authored: every other word on the board is a real target
     word from the selected sections, so wrong taps are still teachable.
     Fields: section, prompt (use ___ for the gap), answer (one word). */
  raceBank: [
    {section:'5B', type:'errorfix', prompt:"Correct it: 'Helmets are *compulsary* on this site.'", answer:"Compulsory"},
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

    /* Relative pronouns as board tiles — the format Grammar Focus 5A fits best of
       all four games. Every pronoun is one word and none repeats, so each gets its
       own tile and the whole set sits on the board at once: you read the sentence,
       a student has to pick the right pronoun out of the nine plausible ones.
       That is a genuinely harder discrimination than a gap fill on paper, where
       only one or two would ever be candidates. */
    {section:'5A', prompt:"The officer ___ arrested him has since retired.", answer:"Who"},
    {section:'5A', prompt:"The witness ___ the police interviewed has disappeared.", answer:"Whom"},
    {section:'5A', prompt:"It's up to the person ___ job it is to arrange the transport.", answer:"Whose"},
    {section:'5A', prompt:"She lied on her interview form, ___ was a bad sign.", answer:"Which"},
    {section:'5A', prompt:"Take me somewhere ___ I can relax for a few days.", answer:"Where"},
    {section:'5A', prompt:"The 1930s was the time ___ organised crime flourished.", answer:"When"},
    {section:'5A', prompt:"Does anyone know the reason ___ crime is so high here?", answer:"Why"},
    {section:'5A', prompt:"___ stole my lunch from the fridge is in big trouble.", answer:"Whoever"},
    {section:'5A', prompt:"You're free to choose ___ position you want.", answer:"Whatever"},

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
    /* The rest of the p147 phrase box. On the board these sit alongside 'Mandatory',
       'Required' and 'Obliged', so picking the right one is a register and strength
       judgement, not a recall test — which is exactly what the page is teaching. */
    {section:'5B', prompt:"Visitors are not ___ to bring food into the building.", answer:"Permitted"},
    {section:'5B', prompt:"Members of the public are ___ to go beyond this point.", answer:"Forbidden"},
    {section:'5B', prompt:"Applicants are ___ to arrive ten minutes before their interview.", answer:"Expected"},
    {section:'5B', prompt:"I was ___ to read the report by today, but I didn't have time.", answer:"Supposed"},
    {section:'5B', prompt:"It is ___ to wear protective clothing in the workshop.", answer:"Advisable"},
    {section:'5B', prompt:"It is ___ to have the right qualifications for this job.", answer:"Essential"},
    {section:'5B', prompt:"We're not ___ to wear jeans to work.", answer:"Allowed"},
    {section:'5B', prompt:"I have no ___ but to hand in my notice.", answer:"Choice"},

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
    /* ---- added later: transformations, opposites and collocation, so the board
           isn't only gapped sentences. Answers are deliberately new words — two
           identical tiles on one board would be unplayable. ---- */
    {section:'5A', prompt:"He already had a previous ___ for fraud when he was arrested again.", answer:"Conviction"},
    {section:'5A', prompt:"What is the opposite of a guilty verdict?", answer:"Innocent"},
    {section:'5A', prompt:"He has no ___ record — this is his first offence.", answer:"Criminal"},
    {section:'5A', prompt:"Give the formal word for a crime or illegal act.", answer:"Offence"},
    {section:'5B', prompt:"Under the contract we are under no ___ to refund the deposit.", answer:"Obligation"},
    {section:'5B', prompt:"You'll need written ___ from the landlord before you start work.", answer:"Permission"},
    {section:'5B', prompt:"Correct the error: 'He was made redundancy last year.'", answer:"Redundant"},
    {section:'5B', prompt:"Retail, transport and energy are each one of these parts of the economy.", answer:"Sector"},
    {section:'5C', prompt:"The report is pure ___ — there's no evidence for any of it.", answer:"Speculation"},
    {section:'5C', prompt:"The whole plan rests on the ___ that prices will keep falling.", answer:"Assumption"},
    {section:'5C', prompt:"I've only a ___ memory of the meeting — it was years ago.", answer:"Vague"},
    {section:'5C', prompt:"Which noun completes both 'it slipped my ___' and 'it crossed my ___'?", answer:"Mind"},

    /* ---- 5D: opinion essays & linking ----
       The linkers make good tiles for the same reason the relative pronouns did:
       one word each, none repeating, and choosing between 'Moreover' and 'Besides'
       is a real judgement rather than a recall test. */
    {section:'5D', prompt:"___, social media also tells applicants about the company they're applying to.", answer:"Moreover"},
    {section:'5D', prompt:"___, checks need to be made that employers' decisions are fair.", answer:"Furthermore"},
    {section:'5D', prompt:"___ actively seeking negative posts, the system lets employers discriminate.", answer:"Besides"},
    {section:'5D', prompt:"___ all, employers claim the process becomes more efficient.", answer:"Above"},
    {section:'5D', prompt:"In ___, I understand applicants' concerns about 'trawling'.", answer:"Particular"},
    {section:'5D', prompt:"___ researching applicants online, employers contact previous employers.", answer:"Beyond"},
    {section:'5D', prompt:"The ___ outlines the topic and gets the reader interested.", answer:"Introduction"},
    {section:'5D', prompt:"The ___ states your final, balanced opinion of both sides.", answer:"Conclusion"},
    {section:'5D', prompt:"A good essay ending gives a ___ opinion rather than a one-sided one.", answer:"Balanced"},
    {section:'5D', prompt:"Applicants object to employers ___ for negative information about them.", answer:"Trawling"},
    {section:'5D', prompt:"Some fear that employers will ___ against them on the basis of age.", answer:"Discriminate"},
    {section:'5D', prompt:"Job applicants have voiced ___ concerns about these checks.", answer:"Privacy"},
    {section:'5D', prompt:"Companies examine profiles for information to use in the ___ process.", answer:"Selection"},
    {section:'5D', prompt:"Employers' decisions need to be fair and ___.", answer:"Transparent"},
  ],

  /* ---- Millionaire ----------------------------------------------------------
     Four options, rising difficulty. `level` 1-8 maps to the rungs of the ladder;
     each section carries 12 so a single section fills a ladder and repeat plays
     still differ (§3.4).
     Authoring note (§4.4): the distractors are the teaching. Each wrong option is
     a mistake this class would plausibly make — a real word with the wrong
     meaning, a wrong collocation, or a form error — never obvious filler.
     Fields: section, level, prompt, answer, distractors[3]. */
  millionaireBank: [
    /* ---- typed forms: error correction, marked with *asterisks* ---- */
    {section:'5A', type:'errorfix', level:3, prompt:"Correct the error: 'He was *accused for* the robbery.'",
      answer:"accused of", distractors:["accused with","accused by","accused on"]},
    {section:'5B', type:'errorfix', level:4, prompt:"Correct the error: 'You *must to* wear protective clothing.'",
      answer:"must", distractors:["must to be","have must","must been"]},
    {section:'5C', type:'errorfix', level:5, prompt:"Correct the error: 'I *reckon to be* she is right.'",
      answer:"reckon", distractors:["reckon to","reckoning","reckons to"]},
    /* ---- 5A: crime & justice, relative clauses ---- */
    {section:'5A', level:1, prompt:"Someone who saw the crime happen is called a ___.",
      answer:"witness", distractors:["suspect","juror","victim"]},
    {section:'5A', level:2, prompt:"The twelve ordinary citizens who decide guilt are the ___.",
      answer:"jury", distractors:["bench","panel","tribunal"]},
    {section:'5A', level:2, prompt:"He was held in ___ for three months before the trial.",
      answer:"custody", distractors:["captivity","arrest","seizure"]},
    {section:'5A', level:3, prompt:"Unpaid work given instead of prison: ___ service.",
      answer:"community", distractors:["public","social","civil"]},
    {section:'5A', level:3, prompt:"The lawyers who try to prove the accused is guilty are the ___.",
      answer:"prosecution", distractors:["prosecutor","defence","plaintiff"]},
    {section:'5A', level:4, prompt:"Which word means helping offenders return to normal life in society?",
      answer:"rehabilitation", distractors:["retribution","restitution","probation"]},
    {section:'5A', level:4, prompt:"'Solitary ___' — kept apart from all other prisoners.",
      answer:"confinement", distractors:["isolation","detention","seclusion"]},
    {section:'5A', level:5, prompt:"'She has a solid ___' — proof that she was somewhere else.",
      answer:"alibi", distractors:["testimony","defence","affidavit"]},
    {section:'5A', level:5, prompt:"The court's final decision on guilt is the ___.",
      answer:"verdict", distractors:["sentence","penalty","appeal"]},
    {section:'5A', level:6, prompt:"Complete formally: 'The prison, ___ are covered in murals, opened in 2010.'",
      answer:"the walls of which", distractors:["which walls","whose the walls","the walls which"]},
    {section:'5A', level:7, prompt:"Complete formally: 'Some of the inmates, ___ have committed serious crimes, work in the kitchen.'",
      answer:"many of whom", distractors:["many of who","many of them","many whom"]},
    {section:'5A', level:8, prompt:"Which term means hiding where illegally-earned money came from?",
      answer:"money laundering", distractors:["money washing","money cleaning","money bleaching"]},

    /* Relative clauses, Grammar Focus 5A (p146). This is the game the page suits
       best: exercise b is already written as a four-way choice, so the distractors
       are the book's own — 'to who' for 'to whom', 'few of who' for 'few of whom'.
       Every wrong option here is an error a C1 class actually makes, which is the
       authoring rule for this bank. */
    {section:'5A', level:1, prompt:"'Florida is the only place ___ I want to live.'",
      answer:"that", distractors:["wherever","what","whom"]},
    {section:'5A', level:2, prompt:"'Give me one good reason ___ I should believe you.'",
      answer:"why", distractors:["which","what","how"]},
    {section:'5A', level:3, prompt:"'It's up to the person ___ job it is to sort out the transport.'",
      answer:"whose", distractors:["what","which","who's"]},
    {section:'5A', level:4, prompt:"'The emergency number is 999, ___ is easy to remember.'",
      answer:"which", distractors:["that","what","whom"]},
    {section:'5A', level:5, prompt:"'Mrs Jackson, ___ we are very grateful, has agreed to speak.'",
      answer:"to whom", distractors:["to who","whose","that"]},
    {section:'5A', level:6, prompt:"'We recruited some younger staff, ___ had any experience.'",
      answer:"few of whom", distractors:["few of who","few of which","few of whose"]},
    {section:'5A', level:7, prompt:"Which sentence is correct?",
      answer:"The victim, who we cannot name, is recovering.",
      distractors:["The victim, that we cannot name, is recovering.",
                   "The victim, we cannot name, is recovering.",
                   "The victim, what we cannot name, is recovering."]},
    {section:'5A', level:8, prompt:"Which sentence is correct?",
      answer:"Stealing from the kitchen is something which we will not put up with.",
      distractors:["Stealing from the kitchen is something with which we will not put up.",
                   "Stealing from the kitchen is something up with which we will not put.",
                   "Stealing from the kitchen is something which we will not put up with it."]},

    /* ---- 5B: employment, pay & benefits, obligation ---- */
    {section:'5B', level:1, prompt:"Flexible working hours are known as ___.",
      answer:"flexitime", distractors:["flexihours","freetime","flexiwork"]},
    {section:'5B', level:2, prompt:"A long paid career break, often six months, is a ___.",
      answer:"sabbatical", distractors:["furlough","secondment","sabbath"]},
    {section:'5B', level:2, prompt:"Leave for new fathers is ___ leave.",
      answer:"paternity", distractors:["maternity","parental","fraternity"]},
    {section:'5B', level:3, prompt:"Job cuts that make workers lose their jobs are called ___.",
      answer:"redundancies", distractors:["dismissals","resignations","retirements"]},
    {section:'5B', level:3, prompt:"Pay linked to how well you do your job is ___-related pay.",
      answer:"performance", distractors:["production","productive","performing"]},
    {section:'5B', level:4, prompt:"'Safety training is ___' — you absolutely must do it.",
      answer:"mandatory", distractors:["mandated","obliged","compulsive"]},
    {section:'5B', level:4, prompt:"'Under the contract we are ___ to start work at 8:00.'",
      answer:"obliged", distractors:["obligated","obliging","obligatory"]},
    {section:'5B', level:5, prompt:"'You'll be ___ to hold a diving certificate for this job.'",
      answer:"required", distractors:["requested","requisite","demanded"]},
    {section:'5B', level:5, prompt:"The training and certificates a job demands are your ___.",
      answer:"qualifications", distractors:["qualities","credentials","competences"]},
    {section:'5B', level:6, prompt:"Complete formally: 'Visitors are not ___ to bring food into the building.'",
      answer:"permitted", distractors:["permissible","allowance","admitted"]},
    {section:'5B', level:7, prompt:"'You ___ have to pay tax on it' — meaning it isn't necessary.",
      answer:"don't", distractors:["mustn't","can't","shouldn't"]},
    {section:'5B', level:8, prompt:"'You ___ to get some experience first' — mild advice, not an obligation.",
      answer:"ought", distractors:["must","have","should"]},

    /* Obligation, necessity and permission — Grammar Focus 5B (p147). The choices
       come from the page's own practice exercises, so the wrong options are the
       ones the book deliberately contrasts: needn't vs mustn't, should vs ought
       (which needs 'to'), was supposed to vs had to. */
    {section:'5B', level:1, prompt:"'Maria ___ keep her promotion a secret until it's officially announced.'",
      answer:"must", distractors:["will","would","may"]},
    {section:'5B', level:2, prompt:"'You ___ bring a towel for the pool — they provide them free of charge.'",
      answer:"needn't", distractors:["mustn't","can't","shouldn't"]},
    {section:'5B', level:3, prompt:"'Pilots are ___ to get a medical exam every six months.'",
      answer:"required", distractors:["essential","obligatory","necessary"]},
    {section:'5B', level:4, prompt:"'When we lived in the village, we ___ drive for miles to reach a supermarket.'",
      answer:"had to", distractors:["must","were allowed to","ought to"]},
    {section:'5B', level:5, prompt:"'Tony ___ be taking care of that, but he's so lazy.'",
      answer:"should", distractors:["ought","had better","must"]},
    {section:'5B', level:6, prompt:"'The match ___ begin at 7:00, but heavy rain delayed the start.'",
      answer:"was supposed to", distractors:["had to","was required to","must have"]},
    {section:'5B', level:7, prompt:"Which is the most formal way of stating the rule?",
      answer:"Visitors are forbidden to bring food into the building.",
      distractors:["Visitors mustn't bring food into the building.",
                   "Visitors can't bring food into the building.",
                   "Visitors shouldn't bring food into the building."]},
    {section:'5B', level:8, prompt:"Rewrite with 'choice': 'The only option I have is to cancel the trip.'",
      answer:"I have no choice but to cancel the trip.",
      distractors:["I have no choice to cancel the trip.",
                   "I have no choice but cancelling the trip.",
                   "I haven't any choice but cancel the trip."]},

    /* ---- 5C: recalling & speculating ---- */
    {section:'5C', level:1, prompt:"'It's ___ my mind' — I've forgotten it.",
      answer:"slipped", distractors:["slid","escaped","dropped"]},
    {section:'5C', level:2, prompt:"Which phrase means the same as 'if I remember rightly'?",
      answer:"if my memory serves me correctly", distractors:["if my memory stands me correctly","if my memory holds me right","if my memory works correctly"]},
    {section:'5C', level:2, prompt:"'I'd ___ a guess that it cost about two thousand euros.'",
      answer:"hazard", distractors:["risk","chance","hazardous"]},
    {section:'5C', level:3, prompt:"'That evening ___ out in my mind more than any other.'",
      answer:"stands", distractors:["sticks","holds","comes"]},
    {section:'5C', level:3, prompt:"'I was under the ___ that the meeting had been cancelled.'",
      answer:"impression", distractors:["assumption","expression","impact"]},
    {section:'5C', level:4, prompt:"Which phrase introduces something you assume the listener already knows?",
      answer:"no doubt", distractors:["no wonder","no question","without fail"]},
    {section:'5C', level:4, prompt:"Which expression introduces something you are recalling, with slight uncertainty?",
      answer:"If my memory serves me correctly", distractors:["I'd hazard a guess","No doubt you heard","Presuming you're right"]},
    {section:'5C', level:5, prompt:"'___ a guess, I'd say she's about forty.'",
      answer:"Hazarding", distractors:["Hazard","Hazarded","Hazardly"]},
    {section:'5C', level:5, prompt:"Which phrase signals a guess rather than a memory?",
      answer:"I'd hazard a guess that…", distractors:["If my memory serves me correctly…","What stands out in my mind is…","I distinctly remember…"]},
    {section:'5C', level:6, prompt:"'There's no point ___ about what might have happened.'",
      answer:"speculating", distractors:["speculate","to speculate","speculation"]},
    {section:'5C', level:7, prompt:"Which of these is NOT used for recalling?",
      answer:"I'd hazard a guess", distractors:["If my memory serves me","What stands out in my mind","I think I remember"]},
    {section:'5C', level:8, prompt:"'I was under the impression that…' suggests the speaker…",
      answer:"believed something that may not be true", distractors:["is certain of a fact","is recalling it exactly","is asking a question"]},
    /* ---- added later: transformation, error correction, collocation, register and
           stress, so the ladder isn't only gapped sentences ---- */
    {section:'5A', level:2, prompt:"Which word means a court's formal finding that someone is guilty?",
      answer:"conviction", distractors:["indictment","acquittal","testimony"]},
    {section:'5A', level:3, prompt:"Which sentence is correct?",
      answer:"He was accused of fraud.", distractors:["He was accused for fraud.","He was accused with fraud.","He was accused on fraud."]},
    {section:'5A', level:4, prompt:"Which word does NOT belong with the others?",
      answer:"sabbatical", distractors:["verdict","jury","testimony"]},
    {section:'5A', level:5, prompt:"Which verb goes with 'a sentence', meaning to undergo the punishment?",
      answer:"serve", distractors:["make","do","take"]},
    {section:'5A', level:6, prompt:"Which is the correct formal version?",
      answer:"the prisoners, many of whom reoffend", distractors:["the prisoners, many of who reoffend","the prisoners that many reoffend","the prisoners which many of them reoffend"]},
    {section:'5B', level:2, prompt:"'We are under no ___ to accept their offer.'",
      answer:"obligation", distractors:["obliged","obligatory","obliging"]},
    {section:'5B', level:3, prompt:"Which sentence is correct?",
      answer:"You must wear a helmet.", distractors:["You must to wear a helmet.","You must wearing a helmet.","You must worn a helmet."]},
    {section:'5B', level:4, prompt:"'She received a generous ___ payment when her job was cut.'",
      answer:"redundancy", distractors:["severance","redundant","redundancies"]},
    {section:'5B', level:5, prompt:"Which sentence is correct?",
      answer:"He was made redundant.", distractors:["He was made redundancy.","He was made a redundant.","He was done redundant."]},
    {section:'5B', level:6, prompt:"Which is the most formal way of refusing permission?",
      answer:"Visitors are not permitted to bring food.", distractors:["Visitors can't bring food.","Visitors mustn't bring food.","Visitors aren't allowed food."]},
    {section:'5C', level:2, prompt:"'The article was dismissed as idle ___.'",
      answer:"speculation", distractors:["speculating","speculative","speculator"]},
    {section:'5C', level:3, prompt:"Which one does NOT show uncertainty?",
      answer:"No doubt", distractors:["I'd hazard a guess","I'm not entirely sure","Presumably"]},
    {section:'5C', level:4, prompt:"Which adjective does NOT go with 'memory'?",
      answer:"heavy", distractors:["vague","painful","lasting"]},
    {section:'5C', level:5, prompt:"'You're making a lot of ___ there.'",
      answer:"assumptions", distractors:["assumes","assuming","presumptions"]},
    {section:'5C', level:6, prompt:"Which sentence is correct?",
      answer:"If my memory serves me correctly…", distractors:["If my memory serves me correct…","If my memory serves to me correctly…","If my memory is serving me correct…"]},
    {section:'5C', level:7, prompt:"Which syllable carries the main stress in 're-ha-bi-li-ta-tion'?",
      answer:"the 5th — TA", distractors:["the 1st — re","the 3rd — bi","the 6th — tion"]},

    /* ---- 5D: opinion essays & linking ----
       Four options suit this section particularly well: the linkers differ by
       *where they can sit in a sentence*, not by meaning, so the wrong options are
       real errors rather than different words. */
    {section:'5D', level:1, prompt:"Which linker adds an idea in a NEW sentence?",
      answer:"In addition,", distractors:["as well as","in addition to","beyond"]},
    {section:'5D', level:2, prompt:"'___, time saved is money saved.'",
      answer:"Besides", distractors:["Beyond","As well as","In addition to"]},
    {section:'5D', level:3, prompt:"Which phrase marks your single most important argument?",
      answer:"Above all", distractors:["In particular","What's more","In addition"]},
    {section:'5D', level:4, prompt:"What is the job of an opinion essay's introduction?",
      answer:"To outline the topic and interest the reader",
      distractors:["To state your final opinion","To present one side of the argument",
                   "To summarise the key points"]},
    {section:'5D', level:5, prompt:"Which must NOT appear in a conclusion?",
      answer:"Interesting new information",
      distractors:["A balanced opinion of both sides","A brief summary of key points",
                   "A possible course of action"]},
    {section:'5D', level:6, prompt:"'___ researching the applicant online, employers contact previous employers.'",
      answer:"Beyond", distractors:["Besides that","Moreover","Furthermore"]},
    {section:'5D', level:7, prompt:"Which sentence uses the linker correctly?",
      answer:"As well as being a valuable tool for employers, social media informs applicants.",
      distractors:["As well as it is a valuable tool, social media informs applicants.",
                   "In addition being a valuable tool, social media informs applicants.",
                   "Moreover being a valuable tool, social media informs applicants."]},
    {section:'5D', level:8, prompt:"'It is standard to search criminal records ___ the methods mentioned above.'",
      answer:"in addition to", distractors:["in addition of","in addition with","in addition than"]},

    /* A second question at every 5D rung, and the two 5C rungs that had only one.
       The ladder is per team, so with one question per rung both teams meet the
       identical question on the way up. */
    {section:'5D', level:1, prompt:"Which one-word linker starts a new sentence and means 'what is more'?",
      answer:"Furthermore", distractors:["As well as","Beyond","In addition to"]},
    {section:'5D', level:2, prompt:"'___, as well as being useful to employers, social media informs applicants.'",
      answer:"Moreover", distractors:["Whereas","However","Nevertheless"]},
    {section:'5D', level:3, prompt:"Which linker narrows from a general point to one specific case?",
      answer:"In particular", distractors:["In general","In addition","In short"]},
    {section:'5D', level:4, prompt:"Which is NOT a good way to open an essay introduction?",
      answer:"Stating your own final opinion",
      distractors:["Referring to facts and figures","Making a surprising statement",
                   "Clearly outlining the issue"]},
    {section:'5D', level:5, prompt:"How many paragraphs does the model opinion essay use?",
      answer:"four — intro, one side, the other side, conclusion",
      distractors:["three — intro, argument, conclusion","two — for and against",
                   "five — intro, three arguments, conclusion"]},
    {section:'5D', level:6, prompt:"Which spelling is correct in 'Besides / Beside actively seeking posts…'?",
      answer:"Besides", distractors:["Beside","Besides of","Beside from"]},
    {section:'5D', level:7, prompt:"Which word means employers actively hunting for bad information?",
      answer:"trawling", distractors:["trailing","tracking","trialling"]},
    {section:'5D', level:8, prompt:"Which sentence is correctly punctuated?",
      answer:"Moreover, employers claim the process is more efficient.",
      distractors:["Moreover employers claim the process is more efficient.",
                   "Moreover; employers claim the process is more efficient.",
                   "Moreover: employers claim the process is more efficient."]},

    {section:'5C', level:1, prompt:"Which phrase introduces something you are remembering?",
      answer:"What stands out in my mind…",
      distractors:["I'd hazard a guess…","I'm presuming…","No doubt…"]},
    {section:'5C', level:8, prompt:"Which is the most tentative way of putting it?",
      answer:"I'd hazard a guess that it was around 2015.",
      distractors:["It was around 2015.","I'm certain it was 2015.",
                   "It was definitely about 2015."]},
  ],

  millionaireSectionNames: {
    '5A':'5A · Crime, justice & relative clauses (26 questions)',
    '5B':'5B · Employment & obligation (26 questions)',
    '5C':'5C · Recalling & speculating (21 questions)',
    '5D':'5D · Opinion essays & linking (16 questions)',
  },

  raceSectionNames: {
    '5A':'5A · Crime, justice & relative clauses (25 words)',
    '5B':'5B · Employment & obligation (25 words)',
    '5C':'5C · Recalling & speculating (16 words)',
    '5D':'5D · Opinion essays & linking (14 words)',
  },
});
