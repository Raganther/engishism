# Engishism — Topic Pack Generation Prompt

Copy everything below this line and paste it into Claude with either:
- a textbook page image, or
- a direct topic brief such as "present perfect review" or "jobs vocabulary for B1 learners"

---

I am building reusable topic packs for an ESL classroom app called Engishism.

Your job is to produce a single topic pack that can later be adapted into different game formats.

Output ONLY the raw JS file. No explanation, no markdown code fences.

## Output format

```js
window.TOPIC_PACK = {
  id: "topic-slug",
  title: "Topic Title",
  category: "grammar|vocabulary|functional-language",
  level: "A2|B1|B2",
  tags: ["tag-1", "tag-2"],
  vocabulary: [ ... ],
  examples: [ ... ],
  questions: {
    multipleChoice: [ ... ],
    trueFalse: [ ... ],
    openEnded: [ ... ]
  },
  fillBlanks: [ ... ],
  pairs: [ ... ],
  discussionPrompts: [ ... ]
};
```

## Rules

1. This is a **topic pack**, not a lesson file. Do not output `window.LESSON`.
2. Do not output game-specific slides such as `type: "fill-blank"` or `type: "hot-seat"`.
3. Fill the content buckets with reusable teaching data.
4. Prefer content that can support multiple games later.
5. Use short, clear, classroom-ready language suitable for ESL learners.

## Bucket shapes

### vocabulary
Use objects shaped like:

```js
{
  term: "already",
  hint: "sooner than expected",
  definition: "before now, sooner than expected",
  bluffs: ["wrong definition 1", "wrong definition 2"]
}
```

Include 8–12 entries where possible.

### examples

```js
{
  sentence: "She has already finished the report.",
  focus: "already"
}
```

Include 2–5 examples.

### questions.multipleChoice

```js
{
  question: "Which sentence is correct?",
  options: ["A", "B", "C", "D"],
  answer: 1,
  explanation: "short reason"
}
```

### questions.trueFalse

```js
{
  statement: "You use since with a starting point.",
  answer: true,
  explanation: "Example: since Monday."
}
```

Include 4–6 items where possible.

### questions.openEnded

```js
{
  prompt: "Complete the sentence: I have never ...",
  hint: "life experience",
  answer: "I have never tried scuba diving."
}
```

Include 4–6 items where possible.

### fillBlanks

```js
{
  sentence: "She has [already finished] the report.",
  note: "already",
  options: ["already finish", "already finished", "finishes already"]
}
```

Include 4–6 items where possible. Mark the answer in square brackets.
`options` is optional but useful when the topic should generate a multiple-choice fill-blank activity. If included, provide 3–4 plausible choices and include the correct answer exactly as it appears in brackets.

### pairs

```js
{
  a: "Sentence A",
  b: "Sentence B",
  note: "contrast explanation"
}
```

This bucket may be empty if the topic does not naturally need meaning contrasts.

### discussionPrompts

Array of short speaking prompts such as:

```js
[
  "What is something you have achieved this year?",
  "What kind of workplace suits you best?"
]
```

## Quality bar

- Avoid repetitive or low-value filler.
- Keep definitions and explanations short enough for classroom use.
- Make wrong definitions believable but clearly incorrect.
- Keep answers valid for B1 ESL teaching unless I specify another level.
