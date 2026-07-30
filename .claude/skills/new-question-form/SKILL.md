---
name: new-question-form
description: Add a question form to the Engishism Game Hub — a new way a question is *asked*, like a gap fill, anagram, odd-one-out, error correction or word bridge. Use this whenever the user wants a new kind of question, a new prompt dynamic, an interactive puzzle inside a clue, or asks why a typed item renders as plain text. Also use it when trying a question idea in the prompt lab before it reaches the games.
---

# Adding a question form

A form is **how a question is asked**, not what it asks about. It renders a prompt
and answers it in place. Every game draws its prompts through `Kit.prompt`, so a
form written once reaches all of them — including games that do not exist yet.

**The item shape never changes.** `{text, answer, type?}` is what every bank already
stores, and a form parses what it needs out of the prompt it is given. If a form
wants a new content *field*, stop: that is a different kind of change, and it
migrates 565 items.

## The two stages — know which one you are in

| Stage | Where it is registered | Who can see it |
|---|---|---|
| **Experimental** | `playground/lab-forms.js` | the lab only — **it cannot reach a game** |
| **In the kit** | `game-hub/hub-kit.js` | every game, the moment a bank item carries its type |

Games load `hub-kit.js` and never load `lab-forms.js`, so the isolation is
structural rather than a convention to remember. **Graduating is moving the
registration block from one file to the other — the code itself does not change**,
because what you write in the lab file is already the shared contract.

**Portability is checked every run.** The `promptlab` suite drops `lab-forms.js`
into a real hub page, starts Jeopardy, and asserts every form it registers draws
*and* reveals on a live clue card. It iterates whatever the file registers, so a
new form is covered without editing the check — and a form that quietly depends on
something only the lab has fails the day it is written, not at graduation. Give
each form a sample in `LabForms.samples`; that is what the check renders, and a
form with no sample cannot be proved.

Start in the lab. A form is cheap to write and expensive to un-ship: once it is in
the kit, content may be authored against it.

## 1. Write it

```js
Kit.prompt.register('bridge', {
  games:['jeopardy','race'],            // omit entirely for "suits every board"
  render(mount, item){ … },             // draw the prompt
  reveal(mount, item){ … return ms; }   // answer it in place; 0 = declined
});
```

- **`render` builds elements.** Set `mount.textContent` *only* to decline (below).
- **`reveal` returns how long it runs**, so the caller can wait for it to land.
  Return `0` and the game falls back to printing the answer on its own line.
- **`games:[…]` is a declaration, not a hint.** An anagram in Millionaire is given
  away by its four options; odd-one-out in Race is given away by the board. Say so
  here rather than discovering it in a lesson.

## 2. Decline rather than render nonsense

A form is handed every item that names it, including ones whose prompt is not
shaped for it. Check first, and if it does not fit, print the plain text:

```js
if(links.length < 3 || slots.length !== 1){ mount.textContent = text; return; }
```

**A decline and a no-op look identical on screen**, and `render()` cannot tell you
which happened — it returns the type whenever the form *ran*. The tell is that a
declining form leaves **no element children**. The prompt lab reports the three
outcomes separately for exactly this reason; when a form "does nothing", look there
before debugging the renderer.

`reveal` declines too, and the existing forms show what for: an answer over ~26
characters, alternatives (`forbidden / not permitted`), or one carrying a teacher's
note (`he was made REDUNDANT (adjective)`). Those belong on the answer line.

## 3. Style it in `hub.css`

Put the rules beside the other `.prompt-*` blocks, and **add the game-show variant
in the skin block** — a form styled only for the DCU theme goes invisible on a lit
board (navy on navy). Check both themes.

## 4. Prove it in the lab

Open `playground/prompt-lab.html`, pick the form, draw and reveal. Then **Ask the
room** with a phone (or the room bench) — a form that reads well on a projector can
still be unanswerable from a handset. The lab needs no code change to list a new
form; it asks the registry.

## 5. Test it

Add to `testPromptTypes` in `tools/smoke-test.js`, both directions:

- it draws what it should, and the answer is **not** on screen before reveal;
- `reveal` lands it and returns a duration;
- a prompt that does not fit **declines to plain text**;
- if it names `games`, a board it does not suit gets plain text.

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=prompts,promptlab,content
```

Registering in the kit also means the shared gate:
`--only=millionaire,fit,phone,card,turns,gameshow,lab,registry,competition`.

## 6. The part that actually decides whether it exists

**Author items for it.** This is the failure mode of every form so far: three forms
sat at **4.1% of 589 items**, so a Blockbusters board of 18 expected ~1.6 of them
and a Millionaire rung could go a whole game without one. A form with no content is
a form the class never meets, and the smoke suite will happily pass with none.

Constraints when authoring: **Blockbusters** answers are one word whose initial
matches the hexagon; **Race** answers are single words, unique within the bank;
**Jeopardy** categories stay grouped by section in array order. And **no prompt may
appear in two banks** — `--only=content` enforces it.
