# Engishism — Lesson Generation Prompt

Legacy workflow: this prompt generates full lesson files. The newer topic-first pipeline uses `docs/topic-pack-prompt.md` to generate reusable topic packs.

Copy everything below this line and paste it into Claude along with a photo of the textbook page.

---

I am building a lesson for an ESL classroom app called Engishism. I will give you a textbook image. Your job is to read the page and produce a lesson JS file using the content from that page.

Output ONLY the JS file. No explanation, no markdown code fences, just the raw JS.

## Output format

```
window.LESSON = {
  title: "Unit X — Topic Name",
  mode: "selector",
  slides: [ ... ]
};
```

## Rules

1. Always start with a `title-card` slide.
2. Choose 3–5 activity types that suit the content. Do not use all of them every time.
3. Each activity should feel purposeful — it should practice something specific from the page.
4. Use the exact schemas below. Do not invent new fields.

---

## Available activity types

### title-card
Displays the unit title. Always first.
```js
{
  type: "title-card",
  content: {
    unit: "8A",
    heading: "Main title of the lesson",
    subheading: "Grammar point or topic"
  }
}
```

---

### reveal-card
A reference card. Use for grammar rules, key vocabulary lists, or form tables.
All items shown at once — no interaction.
```js
{
  label: "Short name for selector menu",
  type: "reveal-card",
  content: {
    heading: "Card heading",
    items: [
      { label: "Term or form", example: "Example sentence." }
    ]
  }
}
```

---

### fill-blank
Sentences with a missing word or phrase. Can be open reveal or multiple-choice.
Mark the answer in the sentence using [square brackets].
```js
{
  label: "Short name for selector menu",
  type: "fill-blank",
  content: {
    mode: "multiple-choice",
    questions: [
      {
        sentence: "She enjoys [being read to] in bed.",
        note: "passive gerund",
        options: ["read", "to read", "being read to"]
      }
    ]
  }
}
```
- Aim for 4–8 questions.
- `note` is the grammar label (e.g. "to + infinitive"). Optional but helpful.
- One blank per sentence is ideal. Multiple blanks are supported: use [bracket] for each.
- Omit `mode` and `options` if you want the legacy teacher-reveal version.
- For `mode: "multiple-choice"`, include 3–4 options and make the distractors plausible.

---

### meaning-pair
Two sentences that look similar but mean something different. Teacher reveals B, then the explanation.
Use for active/passive, tense differences, or meaning contrasts.
```js
{
  label: "Short name for selector menu",
  type: "meaning-pair",
  content: {
    pairs: [
      {
        a: "She likes reading in bed.",
        b: "She likes being read to in bed.",
        note: "A = active (she reads)  |  B = passive (someone reads to her)"
      }
    ]
  }
}
```
- Aim for 3–5 pairs.

---

### sentence-complete
A sentence stem the students must complete. Teacher reveals a model answer.
Use for open-ended grammar practice.
```js
{
  label: "Short name for selector menu",
  type: "sentence-complete",
  content: {
    stems: [
      {
        stem: "There's no point ...",
        hint: "+ gerund (-ing)",
        answer: "going to bed / trying to sleep"
      }
    ]
  }
}
```
- Aim for 4–8 stems.
- `hint` shows the grammar form required. Keep it short.
- `answer` can offer 2–3 acceptable options separated by /.

---

### true-false
A statement students decide is true or false. Teacher reveals verdict + explanation.
Use for grammar rules, vocabulary facts, or comprehension checks.
```js
{
  label: "Short name for selector menu",
  type: "true-false",
  content: {
    questions: [
      {
        statement: "You use a gerund after 'enjoy'.",
        answer: true,
        explanation: "e.g. I enjoy reading. / She enjoys being soothed."
      }
    ]
  }
}
```
- Aim for 3–6 questions.
- Mix true and false — do not make them all one or the other.

---

### hot-seat
One student sits with their back to the screen. The class describes each word without saying it.
Use for key vocabulary from the page.
```js
{
  label: "Short name for selector menu",
  type: "hot-seat",
  content: {
    words: ["distracted", "soothed", "insomnia", "segmented"],
    time: 60
  }
}
```
- Include 8–12 words.
- Use vocabulary that is teachable — words students can describe or mime.
- `time` is seconds. 60 is standard.

---

### noughts-crosses
3×3 grid. Teams answer questions to claim squares. First to get three in a row wins.
Use as a review game — mix question types from the whole lesson.
```js
{
  label: "Short name for selector menu",
  type: "noughts-crosses",
  content: {
    teams: ["Team X", "Team O"],
    cells: [
      { question: "Give an example of a passive gerund.", answer: "e.g. I enjoy being read to." }
    ]
  }
}
```
- Must have exactly 9 cells.
- Questions should be answerable in one sentence.
- Mix grammar questions, vocabulary, and example sentences.

---

### fluency-tree
A branching two-person conversation. Teacher clicks which line each speaker says each turn.
Paths diverge based on choices and can merge later. Both A and B have options every turn.

```js
{
  label: "Short name for selector menu",
  type: "fluency-tree",
  content: {
    title: "Topic name",
    start: "n1",
    nodes: {
      "n1": {
        speaker: "A",
        options: [
          { text: "Option A says...", next: "n2a" },
          { text: "Alternative A says...", next: "n2b" }
        ]
      },
      "n2a": {
        speaker: "B",
        options: [
          { text: "B responds to n2a path...", next: "n3" }
        ]
      },
      "n2b": {
        speaker: "B",
        options: [
          { text: "B responds to n2b path...", next: "n3" }
        ]
      },
      "n3": {
        speaker: "A",
        options: [
          { text: "...", next: null }
        ]
      }
    }
  }
}
```

**CRITICAL RULE — merge nodes:** When two or more different nodes point to the same next node (paths merging), the responses at that merge node MUST make sense regardless of which previous line was just spoken. Write neutral, universal bridge responses at merge points — not responses that only work for one specific path. If you cannot write a response that fits all incoming paths, split the merge into separate nodes instead.

- Aim for 5–7 turns total per conversation path.
- Give each speaker 2–3 options per turn.
- Paths should branch at least once per speaker side.
- End nodes have `options: []` or `next: null` on all options.
- Keep language at natural spoken register — contractions, short sentences, real reactions.

---

## Example of a good lesson

A good lesson for a grammar page might look like:
1. `title-card` — unit and topic
2. `reveal-card` — the grammar forms as a reference table
3. `fill-blank` — 4–6 sentences from the page practising the forms
4. `sentence-complete` — open-ended practice using the same structures
5. `hot-seat` — key vocabulary from the reading text
6. `noughts-crosses` — mixed review of grammar and vocabulary

A vocabulary page might look like:
1. `title-card`
2. `reveal-card` — word list with definitions
3. `true-false` — test understanding of word meanings
4. `hot-seat` — describe the words
5. `noughts-crosses` — use the words in context

Now give me the textbook image and I will generate the lesson file.
