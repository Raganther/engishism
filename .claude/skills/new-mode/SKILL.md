---
name: new-mode
description: Add a game mode or ruleset to the Engishism Game Hub — a named bundle of settings like Jeopardy's "Classic" rules, a team mode, or any variation on how an existing game plays. Use this whenever the user wants a game to play a different way, mentions modes, rulesets, variations, presets, "play it like the show", or asks for a dynamic that changes scoring, turns, or what the phones do. Also use it when a new option needs to appear in the settings panel or the Lab drawer.
---

# Adding a mode

## The word means three things — check you are in the right skill

| Term | Values | Scope | Skill |
|---|---|---|---|
| **Ruleset** | Classic · Hub · Together | a whole game show | **this one** |
| **Round mode** | first · agree · climb · race | one question | `new-round` |
| **Phone mode** | off · buzz · write · type | one ordinary question | neither — it is a registered variant |

They nest rather than compete: a ruleset **writes** the other two, so `classic` setting
`phoneMode: buzz` is the mechanism working, not a conflict. The settings panel already
labels this one **Rules** (`jRules`), and that is the word to prefer in anything a
teacher reads.

**A ruleset is a named bundle of settings, not a second code path.** That is the whole
idea, and it is what keeps them cheap: Jeopardy's Classic rules are three switches
and a preset, not a parallel implementation of Jeopardy.

If you find yourself writing `if (mode === 'team') { … } else { … }` around game
logic, stop — that branch is a setting that has not been registered yet.

## 0. First: is it the *game's* mode, or the *round's*?

A **round** declares its own ways of being played, and the host turns them into a
settings row by itself:

```js
K.round.register('ordering', {
  modes: [ { value:'climb', label:'One ladder — the whole room fills it together' },
           { value:'race',  label:'A ladder each — teams race to finish theirs first' } ]
});
```

The hub registers `round_<id>` from that at init — in the shared `Questions` group,
and offered to every board in `ROUND_HOSTS` — so **a round's modes need nothing
in this procedure** — no `S.register` call, no preset, no panel edit. The bench builds
a dropdown from the same declaration. Neither host ever learns what a mode *means*.

Use this skill for a mode that belongs to the **game show** — how it scores, whose
turn it is, what its board does. Use `new-round` for one that belongs to the question.

## 1. Break the mode into switches

Ask what actually differs, and register one setting per difference. Each should be
independently useful, because teachers will want them separately.

Jeopardy Classic decomposes into: a hidden wager tile, a final wager round, and
wrong answers costing the value. All three are useful alone. "Classic" is the name
for having all three on.

## 2. Register the settings

The panel and the Lab drawer build their own rows — **there is no markup to edit.**

```js
S.register({ id:'jDeduct', group:'Jeopardy', type:'toggle', default:false,
             games:['jeopardy'],
             label:'Wrong answers cost the value',
             help:'One line on what it does, and when a teacher would want it.' });
```

- `type` is `toggle`, `select` (`options:[{value,label}]`), `range`
  (`{min,max,step,unit}`, stores a **number**), `variant`
  (`variants:[{value,label,games?}]`) or `text`.
- `games:'*'` for anything that applies to every board — **never a literal list**
  unless the exclusion is real, and then say why in a comment. A list is a snapshot
  of the games that existed when it was written, and the next game silently misses
  out.
- Naming `games` is what makes a setting per-game overridable: the panel grows an
  *All games* tab plus one per game, and the Lab shows just this game's rows.
- Reach for `range` when the mode needs a **weight** — points per square, a
  cooldown, an off-turn fraction. Those numbers are classroom questions, not source
  code questions, and a teacher tuning them mid-round is exactly what the Lab is for.

Read the value with the game: `S.get('jDeduct', 'jeopardy')`.

## 3. Add the preset

```js
const J_PRESETS = {
  hub:     { jDailyDoubles:0, jFinalRound:false, jDeduct:false },
  classic: { jDailyDoubles:1, jFinalRound:true,  jDeduct:true  }
};
let jApplyingPreset = false;
S.onChange(id => {
  if(id !== 'jRules' || jApplyingPreset) return;
  const preset = J_PRESETS[S.get('jRules', 'jeopardy')];
  if(!preset) return;
  jApplyingPreset = true;
  Object.keys(preset).forEach(k => S.set(k, preset[k], 'jeopardy'));
  jApplyingPreset = false;
});
```

**A preset writes the switches rather than shadowing them.** This matters more than
it looks: the rows underneath always say what is actually going to happen, and a
teacher can change one afterwards without the preset quietly lying about it. A mode
that hides its own settings is a mode nobody can debug in a lesson.

The guard flag stops the writes re-entering the handler.

## 4. If the mode changes what the phones do

`phoneMode` says what a phone does during a question. If your mode *is* the phone
dynamic — every student holding a card, a wager only they can see — declare
`phoneRound()` on the game instead of adding a `phoneMode` value. Returning a round
means the mode gets no say; returning `null` means it decides.

Two dynamics arming the same handset is invisible until a reconnect re-asks and
replaces one with the other, which is how it was found.

If the mode needs a room even with the mode off, say so via `wantsVote()` and give
the chip honest words with `roomNote()` — `votes only` over a game where every phone
holds a card is worse than saying nothing.

## 4b. Ask whether your switch contradicts a round

**The step most likely to be skipped, and the one that has already shipped a real bug
three times.** Nothing forces you to do it — there is no mechanism, only this list.

A ruleset never overrides a round directly: it writes settings, and `phoneRound()`
returning non-null means the round owns the handsets whatever `phoneMode` says. The
contradictions come from somewhere else — **a skin rule that assumes something a round
breaks.** Most game-show rules quietly assume *one team held the floor, and the teacher
judges the answer*. A round has neither: the whole room plays at once and the round
judges itself.

**The test, for every switch you register:**

> Does this assume one team held the floor, or that the teacher decides the verdict?

- **Yes** → it must stand down on a round clue: `if(jGroupClue()) return;`
- **No** → it is safe. Daily Doubles, a final round and hints all pass this.

What it looked like when it was missed:

| Switch | The bug |
|---|---|
| `jDeduct` | The whole room was assembling a grouping answer, so "the team that missed" was only whoever happened to be on turn — a Classic board **docked a team $200 for a clue everybody was playing** |
| `stealOnWrong` | A steal excludes the team that missed. Nobody had missed, because nobody had held the floor |
| `jDailyDoubles` | *Not* a contradiction, and worth knowing why: a Daily Double excludes the **phones**, not the words. The team names their four aloud and the teacher clicks them |

Both live guards are in `hub-engine.js` (the steal, and the deduction). `jAnswerSeconds`
needs none: it starts on a buzz, and `buzzEntitled` already refuses a buzz while a round
is live, so it can never start.

**Use `jGroupClue()`, not `jGroupLive()`.** The first is "this clue is a round", true
until the card closes. The second stops the moment the round is taken or revealed — and
a steal and a deduction both run *after* Reveal, so guarding on the second looks right,
reads right, and silently lets the rule back in.

The general form, which is the same rule the skins already follow:
**a live round owns the verdict, so whatever competes with it gives way.**

## 5. Mid-round changes should take effect now

The Lab exists so a teacher can try a rule between rounds without leaving the board.
If your setting should change what is already on screen, hook it:

```js
S.onChange(id => { if(id === 'myWeight' && activeGame === 'mygame') redrawSomething(); });
```

Never drop the phone room on a settings change — the room belongs to the lesson, and
switching a dynamic must not make thirty people rejoin.

## 6. Replacing an existing setting

A setting that gets replaced leaves values behind under keys nothing reads any more,
and **a per-game override is exactly what a teacher set deliberately** — so translate
it rather than ignoring it. `migratePhoneModes` in `hub-engine.js` is the worked
example. Two traps it paid for:

- **The old key still being present is the signal that nothing has chosen yet.**
  Asking whether the new id is unset never fires, because `register()` seeds every
  master with its default.
- **`S.drop(keys)` is what makes the migration run once**, and it runs before anyone
  can have picked a new value.

## 7. Verify

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=settings,scoping,migration,lab,range,registry
```

Then a suite for the mode itself. Assert two directions, because a mode is only
correct if it can also be turned off:

- with the preset on, the rules apply;
- with it off, the game plays exactly as it did before.

The Classic suite checks that the preset writes all three switches **and that the
other preset puts them back** — that pair catches a preset that only ever adds.

Bump the cache stamp, push to `main`, and record the decision in the **Current
status** section of `CLAUDE.md`, including anything you deliberately chose *not* to
copy from the source material. Jeopardy's negative scoring is off by default because
a class 500 down in the first two minutes stops trying; that reasoning is worth more
to the next reader than the code is.
