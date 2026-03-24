# Activity Schemas — Engishism

Confirmed data shapes for all 18 activity types. Use this as the reference when writing new lessons.
Last verified: 2026-03-24 (from at-work.js, creating-a-cv.js, teamwork.js).

---

## title-card
```js
{
  type: "title-card",
  content: {
    unit: "",           // unit number string, or empty
    heading: "",        // lesson title
    subheading: ""      // e.g. "Grammar & Vocabulary — B1"
  }
}
```

---

## reveal-card
```js
{
  type: "reveal-card",
  content: {
    heading: "",        // section title
    items: [
      { label: "", example: "" }   // label = word/phrase, example = full sentence
    ]
  }
}
```

---

## fill-blank
```js
{
  type: "fill-blank",
  content: {
    questions: [
      { sentence: "The answer is [in brackets].", note: "explanation of why" }
    ]
  }
}
```
**Rule:** answers go inside [square brackets] in the sentence. No separate `answer` field.

---

## meaning-pair
```js
{
  type: "meaning-pair",
  content: {
    pairs: [
      { a: "", b: "", note: "contrast explanation" }
    ]
  }
}
```

---

## true-false
```js
{
  type: "true-false",
  content: {
    questions: [
      { statement: "", answer: true|false, explanation: "" }
    ]
  }
}
```

---

## sentence-complete
```js
{
  type: "sentence-complete",
  content: {
    stems: [
      { stem: "Sentence starter...", hint: "what to add", answer: "e.g. full example answer" }
    ]
  }
}
```
**Common mistake:** do NOT use `options[]` — this type uses `stems[]`.

---

## hot-seat
```js
{
  type: "hot-seat",
  content: {
    words: ["word1", "word2", ...],   // 8–12 words
    time: 60                           // seconds per word
  }
}
```

---

## fluency-tree
```js
{
  type: "fluency-tree",
  content: {
    title: "",
    start: "n1",          // ID of first node
    nodes: {
      "n1": {
        speaker: "A",     // "A" or "B"
        options: [
          { text: "What the speaker says.", next: "n2" }  // next: node ID or null (end)
        ]
      }
      // ...
    }
  }
}
```
**Merge rule:** when paths branch (e.g. n3-loves, n3-dislikes, n3-student), they must all converge to a single merge node (e.g. n5-merge). The merge node's options MUST be universal — they must work naturally regardless of which path B just came from. Test: "does this question make sense after any of the paths?" If yes, it's a valid bridge. Never reference the specific path taken in a merge node.

**End nodes:** leaf options use `next: null` to signal conversation end.

---

## noughts-crosses
```js
{
  type: "noughts-crosses",
  content: {
    teams: ["Team X", "Team O"],
    cells: [
      { question: "", answer: "" }    // exactly 9 cells (3×3 grid)
    ]
  }
}
```

---

## anagram
```js
{
  type: "anagram",
  content: {
    words: [
      { scrambled: "DERMAGIN", answer: "DREAMING", hint: "what the word means" }
    ]
  }
}
```
**Note:** `scrambled` is the jumbled uppercase version. Usually 6–8 words.

---

## call-my-bluff
```js
{
  type: "call-my-bluff",
  content: {
    items: [
      {
        word: "WORD",
        definitions: ["false def 1", "true def", "false def 2"],   // exactly 3
        answer: 0|1|2    // index of the correct definition
      }
    ]
  }
}
```
**Usually 3 items per slide.**

---

## odd-one-out
```js
{
  type: "odd-one-out",
  content: {
    items: [
      {
        words: ["word1", "word2", "word3", "word4"],   // exactly 4
        odd: "word4",
        reason: "explanation of why it doesn't fit"
      }
    ]
  }
}
```

---

## missing-vowels
```js
{
  type: "missing-vowels",
  content: {
    items: [
      { display: "RWRDNG", answer: "REWARDING", hint: "what the word means" }
    ]
  }
}
```
**Note:** `display` is the word with all vowels (A E I O U) removed, uppercase.

---

## jeopardy
```js
{
  type: "jeopardy",
  content: {
    categories: [
      {
        name: "Category Name",
        questions: [
          { value: 200, question: "", answer: "" },
          { value: 400, question: "", answer: "" },
          { value: 600, question: "", answer: "" },
          { value: 800, question: "", answer: "" }
        ]
      }
      // exactly 4 categories
    ]
  }
}
```
**Standard setup:** 4 categories × 4 questions at 200/400/600/800. Teams claim via window.Session.

---

## millionaire
```js
{
  type: "millionaire",
  content: {
    questions: [
      {
        question: "",
        options: ["A", "B", "C", "D"],   // exactly 4
        answer: 0|1|2|3                  // index of correct option
      }
      // exactly 10 questions, increasing difficulty
    ]
  }
}
```

---

## countdown
```js
{
  type: "countdown",
  content: { time: 30 }    // seconds (30 is default for free speaking)
}
```
**Purpose:** free speaking prompt with a visible timer. No question content — teacher sets the topic verbally.

---

## scenario-cards
```js
{
  type: "scenario-cards",
  content: {
    cards: [
      {
        title: "",
        scenario: "",                    // the situation to discuss
        verdict: "",                     // short ruling
        verdictStyle: "warning"|"danger"|"success"|"neutral",
        reveal: "",                      // explanation shown after verdict
        details: ["bullet 1", "bullet 2", "bullet 3"],
        hook: ""                         // useful phrase to teach
      }
    ]
  }
}
```
**verdictStyle colours:** success=green, warning=amber, danger=red, neutral=grey.
**Typical:** 5–6 cards per slide.

---

## Summary — 18 types

| Type | Key fields |
|---|---|
| title-card | unit, heading, subheading |
| reveal-card | heading, items[]{label, example} |
| fill-blank | questions[]{sentence (answers in [brackets]), note} |
| meaning-pair | pairs[]{a, b, note} |
| true-false | questions[]{statement, answer: bool, explanation} |
| sentence-complete | stems[]{stem, hint, answer} |
| hot-seat | words[], time |
| fluency-tree | title, start, nodes{}{speaker, options[]{text, next}} |
| noughts-crosses | teams[], cells[]{question, answer} — 9 cells |
| anagram | words[]{scrambled, answer, hint} |
| call-my-bluff | items[]{word, definitions[3], answer: 0-2} |
| odd-one-out | items[]{words[4], odd, reason} |
| missing-vowels | items[]{display, answer, hint} |
| jeopardy | categories[4]{name, questions[4]{value, question, answer}} |
| millionaire | questions[10]{question, options[4], answer: 0-3} |
| countdown | time |
| scenario-cards | cards[]{title, scenario, verdict, verdictStyle, reveal, details[], hook} |
