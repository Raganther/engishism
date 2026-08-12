/* English File — Unit 2A · Spend or save?
   ========================================

   Authored from the user's photographed pages (18–21) for a team-mode class run:
   the money quiz and vocabulary, the o/or pronunciation spread's word list, the
   "no-spend year" article (Michelle McGagh), the present perfect vs past simple
   grammar focus, the Have you ever…? speaking verbs, and the "Hi Mum and Dad"
   WhatsApp-scam reading with its highlighted vocabulary (scam, suspicious, fake,
   block, report, requesting, fallen for, gains).

   **Jeopardy only, deliberately** — this unit exists for one lesson's team-mode
   test, and a unit only shows the games it has a bank for. Other banks can join
   later without touching these categories.

   Three round categories (Connections, Drag the Letters, Drag the Words, plus a
   Multiple Choice column for the scam reading) against three plain-form columns,
   so the phones are earning their place without every tile being a production. */
window.UNITS.push({
  id: 'ef-2a',
  label: 'English File · Unit 2A · Spend or save? (Money)',
  card: { num:'Unit 2A', title:'Spend or save?',
          blurb:'Money verbs, bills & the bank, present perfect vs past simple, the no-spend year, the WhatsApp scam. Rounds throughout.',
          sections:'2A' },
  intro: "Choose a template. You'll pick the content next.",

  jeopardySectionLabels: {
    '2A': '2A · Spend or save? — money, present perfect & past simple'
  },

  jeopardyCategories: [
    { id:'ef2a-money-verbs', section:'2A', name:'Money Verbs', clues:[
      {v:100, q:"Could I ___ twenty pounds from you? I'll pay you back tomorrow.", a:"borrow"},
      {v:200, q:"She ___ me £50 last month and I still owe it to her.", a:"lent"},
      {v:300, q:"Correct it: I *spended* far too much in the sales last weekend.", a:"spent", type:"errorfix"},
      {v:400, q:"Which does NOT belong: earn / inherit / win / waste", a:"waste — the other three are ways money arrives", type:"oddoneout"},
      {v:500, q:"We can't ___ a holiday abroad this year — flights cost too much.", a:"afford"},
    ]},
    { id:'ef2a-bills-bank', section:'2A', name:'Bills & the Bank', clues:[
      {v:100, q:"Have you paid the phone ___ yet?", a:"bill"},
      {v:200, q:"The ___ is the big loan you take out to buy a house.", a:"mortgage"},
      {v:300, q:"I took out a ___ from the bank to buy my car.", a:"loan"},
      {v:400, q:"Which does NOT belong: note / coin / cash / receipt", a:"receipt — the other three are money itself", type:"oddoneout"},
      {v:500, q:"£3 for one coffee? It really isn't ___ it.", a:"worth"},
    ]},
    { id:'ef2a-pp-vs-ps', section:'2A', name:'Perfect or Past?', clues:[
      {v:100, q:"Have you paid the electricity bill ___? It arrived last week.", a:"yet"},
      {v:200, q:"I've ___ ordered the trainers — the page is still open on my laptop.", a:"just"},
      {v:300, q:"Correct it: I *have seen* our gas bill yesterday — it's enormous.", a:"saw", type:"errorfix"},
      {v:400, q:"Correct it: We *didn't pay* the house insurance yet.", a:"haven't paid", type:"errorfix"},
      {v:500, q:"Which does NOT go with the present perfect: just / already / yet / ago", a:"ago — it says exactly when, so it takes the past simple", type:"oddoneout"},
    ]},
    { id:'ef2a-connections', section:'2A', name:'Connections', clues:[
      {v:100, q:"Four of these are ways money can ARRIVE. Find the four.",
        group:{ pick:["earn","inherit","win","borrow"],
                with:["spend","waste","lend","donate"] }},
      {v:200, q:"Four of these are things Michelle gave up in her no-spend year. Find the four.",
        group:{ pick:["clothes","flights","cosmetics","drinks"],
                with:["broadband","gas","electricity","food"] }},
      {v:300, q:"Four of these go with the PRESENT PERFECT. Find the four.",
        group:{ pick:["just","yet","already","ever"],
                with:["yesterday","ago","last week","in 2019"] }},
      {v:400, q:"Four of these are what a SCAMMER does. Find the four.",
        group:{ pick:["trick","pretend","request","pressure"],
                with:["block","report","check","ignore"] }},
      {v:500, q:"Four of these are monthly bills. Find the four.",
        group:{ pick:["gas","electricity","broadband","rent"],
                with:["takeaway","taxi","cinema","haircut"] }},
    ]},
    { id:'ef2a-drag-letters', section:'2A', name:'Drag the Letters', clues:[
      {v:100, q:"to take money that you must pay back",
        anagram:{ word:"borrow" }},
      {v:200, q:"to have enough money for something",
        anagram:{ word:"afford" }},
      {v:300, q:"to receive money from a relative who has died",
        anagram:{ word:"inherit" }},
      {v:400, q:"the big loan you take out to buy a house",
        anagram:{ word:"mortgage" }},
      {v:500, q:"describes a message that makes you feel something is wrong",
        anagram:{ word:"suspicious" }},
    ]},
    { id:'ef2a-drag-words', section:'2A', name:'Drag the Words', clues:[
      {v:100, q:"Rebuild the question:",
        scramble:{ sentence:"Have you paid the phone bill yet" }},
      {v:200, q:"Rebuild the sentence:",
        scramble:{ sentence:"My brother lent me some money last week" }},
      {v:300, q:"Rebuild the sentence:",
        scramble:{ sentence:"I have never won any money in a lottery" }},
      {v:400, q:"Rebuild the sentence:",
        scramble:{ sentence:"She saved for six months to pay the deposit" }},
      {v:500, q:"Rebuild the scammer's message:",
        scramble:{ sentence:"Could you please transfer five hundred pounds to this account" }},
    ]},
    { id:'ef2a-the-scam', section:'2A', name:'The Scam', clues:[
      {v:100, q:"Which word means a clever and dishonest plan for making money?",
        choice:{ options:["scam","loan","deposit","bargain"], answer:"scam" }},
      {v:200, q:"A message from an unknown number asks you for money. What does WhatsApp say to do?",
        choice:{ options:["block or report it","send a small amount","save the number","reply and ask why"], answer:"block or report it" }},
      {v:300, q:"A ___ job offer is not what it appears to be.",
        choice:{ options:["fake","formal","full-time","fair"], answer:"fake" }},
      {v:400, q:"'Requesting money' means ___ money.",
        choice:{ options:["asking for","paying back","winning","wasting"], answer:"asking for" }},
      {v:500, q:"If you have 'fallen for' a scam, you have been ___.",
        choice:{ options:["tricked","blocked","charged","promoted"], answer:"tricked" }},
    ]},
  ]
});
