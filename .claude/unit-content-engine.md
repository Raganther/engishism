Status: current | Epistemic: confirmed | Last verified: 2026-04-24

# Unit Content Engine

## Knowledge

Engishism now uses a Unit-first runtime as the primary classroom flow. The visible app entrypoint `app.html` loads `units/index.js`, individual unit files under `units/`, `engine/unit-app.js`, and `styles/whiteboard.css`.

The legacy topic, lesson, adapter, activity, module, and standalone files remain in the repo for reference and possible reuse, but they are not exposed by the rebuilt primary app shell.

The Unit model is the source of truth for new workbook-derived content. A unit contains metadata, grammar forms, rules, contrasts, common mistakes, practice pools, speaking prompts, image prompts, and generated asset references. Games declare the content capabilities they need and can be enabled when a unit provides those capabilities.

The first rebuilt vertical slice is `grammar-unit-1-present-continuous`, based on English Grammar in Use Unit 1 as a reference. Its generated classroom image sheet lives at `assets/images/units/unit-1-present-continuous/action-sheet.png`.

The first rebuilt game is Picture Choice. It reads `practice.imagePrompts`, crops the unit image sheet by column and row, shows one illustration at a time, presents four answer choices, marks correct/wrong answers, and advances through the prompt set.

The visual design target is an interactive whiteboard: large readable type, chunky magnetic cards, sticker-like buttons, bright high-contrast colours, and generated classroom illustrations as lesson assets rather than static UI screenshots.
