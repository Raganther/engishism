# Engishism — Lesson Generation Prompt

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
Sentences with a missing word or phrase. Teacher clicks the blank to reveal.
Mark the answer in the sentence using [square brackets].
```js
{
  label: "Short name for selector menu",
  type: "fill-blank",
  content: {
    questions: [
      { sentence: "She enjoys [being read to] in bed.", note: "passive gerund" }
    ]
  }
}
```
- Aim for 4–8 questions.
- `note` is the grammar label (e.g. "to + infinitive"). Optional but helpful.
- One blank per sentence is ideal. Multiple blanks are supported: use [bracket] for each.

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
