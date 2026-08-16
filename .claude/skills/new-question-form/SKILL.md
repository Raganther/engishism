---
name: new-question-form
description: Add a question form to the Engishism Game Hub — a new way a question is *asked*, like a gap fill, anagram, odd-one-out, error correction or word bridge. Use this whenever the user wants a new kind of question, a new prompt dynamic, an interactive puzzle inside a clue, or asks why a typed item renders as plain text. Also use it when trying a question idea on the question bench before it reaches the games.
covers:
  - "game-hub/hub-kit.js"
  - "playground/lab-forms.js"
---

# Adding a question form

A form is **how a question is asked**, not what it asks about. It renders a prompt
and answers it in place. Every game draws its prompts through `Kit.prompt`, so a
form written once reaches all of them — including games that do not exist yet.

**The item shape never changes.** `{text, answer, type?}` is what every bank already
stores, and a form parses what it needs out of the prompt it is given. If a form
wants a new content *field*, stop: that is a different kind of change, and it
migrates 565 items.

## First: is it a form at all, or a round?

`Kit.prompt` is a **rendering** contract — `render` and `reveal`, nothing else. No
time, no turns, no phones, no scoring. If the idea needs any of those it is a
**round**, and no amount of pushing will make it fit here:

| It is a form if… | It is a round if… |
|---|---|
| it draws a prompt and answers it in place | it arms the phones, or collects from them |
| the class watches, the teacher clicks | teams do something *simultaneously* |
| `render`/`reveal` and you are done | it has to decide when the answer has settled |

**Rounds have their own tier and their own procedure** — one file under
`game-hub/rounds/`, registered with `Kit.round`, built on
`playground/question-bench.html`. Use the **`new-round`** skill; do not try to bend
a round into this contract.

Budget honestly. `reveal:[…]` (Story Reveal) was cheap because Jeopardy already had
hints costing clue value. `group:{pick, with}` (the grouping clue) was ~330 lines
with its own state, arming, settle and judge before it was extracted into a round
file. **Budget against the second, not the first** — though the two rounds written
since cost one file each, because the registry now carries the item field for you
(declare `field` on the round; nobody edits a whitelist any more).

## The two stages — know which one you are in

| Stage | Where it is registered | Who can see it |
|---|---|---|
| **Experimental** | `playground/lab-forms.js` | the lab only — **it cannot reach a game** |
| **In the kit** | `game-hub/hub-kit.js` | every game, the moment a bank item carries its type |

Games load `hub-kit.js` and never load `lab-forms.js`, so the isolation is
structural rather than a convention to remember. **Graduating is moving the
registration block from one file to the other — the code itself does not change**,
because what you write in the lab file is already the shared contract.

**Portability is checked every run.** The `forms` suite drops `lab-forms.js`
into a real hub page, starts Jeopardy, and asserts every form it registers draws
*and* reveals on a live clue card. It iterates whatever the file registers, so a
new form is covered without editing the check — and a form that quietly depends on
something only the bench has fails the day it is written, not at graduation. Give
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
declining form leaves **no element children**. The question bench says so in its
verdict line for exactly this reason — “… looked at this and declined” — so when a
form "does nothing", look there before debugging the renderer.

`reveal` declines too, and the existing forms show what for: an answer over ~26
characters, alternatives (`forbidden / not permitted`), or one carrying a teacher's
note (`he was made REDUNDANT (adjective)`). Those belong on the answer line.

## 3. Style it in `hub.css`

Put the rules beside the other `.prompt-*` blocks, and **add the game-show variant
in the skin block** — a form styled only for the DCU theme goes invisible on a lit
board (navy on navy). Check both themes.

## 4. Prove it on the bench

Open `playground/question-bench.html`, pick the form from the menu — it is grouped
under **Question forms**, and a lab-only one under *lab only, can reach no game* —
then draw and reveal. Then **Ask the room** with a phone (or the room bench): a form
that reads well on a projector can still be unanswerable from a handset. The bench
needs no code change to list a new form; it asks the registry.

The bench is also where you author the items, which is the step that decides whether
the form exists at all — write a few, watch the verdict line, and export.

## 5. Test it

Add to `testPromptTypes` in `tools/smoke-test.js`, both directions:

- it draws what it should, and the answer is **not** on screen before reveal;
- `reveal` lands it and returns a duration;
- a prompt that does not fit **declines to plain text**;
- if it names `games`, a board it does not suit gets plain text.

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=prompts,forms,qbench,content
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
