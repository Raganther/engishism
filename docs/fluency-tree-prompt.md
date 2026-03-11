# Fluency Tree — Generation Prompt

Copy everything below this line and paste into Claude with your topic description.

---

I am building a fluency practice activity for an ESL classroom app. I will give you a topic and context. Your job is to write a branching two-person conversation as a `fluency-tree` slide.

Output ONLY the JS object for the slide — no explanation, no markdown fences, just the raw object starting with `{`.

## What a fluency tree is

Two speakers (A and B) take turns. Each turn, the teacher picks which line the speaker says by clicking a button. The chosen line appears in a chat thread. Paths branch based on choices and can merge later.

## Output format

```js
{
  label: "Short name for the selector menu",
  type: "fluency-tree",
  content: {
    title: "Topic name",
    start: "n1",
    nodes: {
      "n1": {
        speaker: "A",
        options: [
          { text: "...", next: "n2a" },
          { text: "...", next: "n2b" },
          { text: "...", next: "n2c" }
        ]
      },
      ...
    }
  }
}
```

## Rules

### Structure
1. Alternate speakers: A, B, A, B... Start with A.
2. Each turn: 2–3 options per speaker. Both speakers branch — not just one side.
3. Aim for 6–8 turns total per path (3–4 per speaker).
4. The conversation should feel like a real spoken exchange — natural register, contractions, short sentences, genuine reactions.

### Branching
5. A's first turn should branch into at least 2 meaningfully different directions (e.g. enthusiastic vs. cautious).
6. B should also branch — different responses lead to different sub-paths.
7. Paths can merge later, but only if the merge rule below is followed.

### ⚠️ CRITICAL — Merge node rule
When two or more nodes point to the same `next` node (paths merging), the options at that merge node **MUST make sense regardless of which previous line was just spoken**.

**Wrong:** A says "That's fair enough" — only works if B was negative.
**Wrong:** A says "I know what you mean" — only works if B agreed.
**Right:** A says "Food is so personal, isn't it" — works after any B response.
**Right:** A says "Ha! I've had a similar experience" — works after any B response.
**Right:** A says "Really? I wouldn't have expected that" — works after most B responses.

If you cannot write options that fit ALL incoming paths at a merge point, split the merge into separate nodes instead.

### Endings
8. A node with `options: []` is an end node — it shows "Conversation complete."
9. Alternatively, set `next: null` on the last option to end there.
10. End on a natural closing move: a turn-back question, a summary statement, or a sign-off.

### Content
11. Options should model real functional language for the topic — phrases students can actually steal and use.
12. Include variety: questions, statements, reactions, follow-ups, hedges.
13. Avoid options that are too similar — each choice should take the conversation somewhere genuinely different.
14. Language level: B2 (upper-intermediate) unless specified otherwise.

## Example of a good branch

```
A: "Have you ever worked in a team that really didn't get along?"
  → "Yes — it was exhausting. Everyone had a different agenda."   → path: conflict
  → "Not seriously. I've been pretty lucky with my teams."        → path: positive
  → "Once. There was one person who just refused to cooperate."   → path: one-person-problem

[conflict path]
B: "What did you do about it?"
  → "Tried to stay out of it and just focus on my own work."
  → "I actually spoke to the manager about it."
  → "Honestly? I started looking for a new job."

[merge back at A's next turn — must work after any B reply above]
A:
  → "It's tough, isn't it. You can't force people to work well together."   ✓ works for all
  → "I think those situations teach you a lot about yourself, actually."    ✓ works for all
  → "Did it ever get resolved, or did it just drag on?"                     ✓ works for all
```

---

Now describe the topic and context for the conversation, and I will generate the fluency tree.
