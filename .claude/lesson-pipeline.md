Status: current | Epistemic: confirmed | Last verified: 2026-04-22

# Lesson Generation Pipeline

## Knowledge

### Legacy lesson pipeline
The older `window.LESSON` pipeline is preserved for legacy files but is no longer the primary app flow.

### Legacy pipeline steps
1. Photograph or screenshot a textbook page
2. Paste into Claude alongside the prompt template (`docs/lesson-prompt.md`)
3. Claude outputs a raw JS file — `window.LESSON = { title, mode: "selector", slides: [...] }`
4. Save as `lessons/<slug>.js`
5. Register in `lessons/index.js` — add an entry to `LESSON_INDEX` with `id`, `title`, `tag`, and `types: []` array listing every activity type used

### Prompt templates
- `docs/lesson-prompt.md` — full lesson generation (photo → multi-activity lesson file). Includes all schema shapes inline and examples of good lesson structures.
- `docs/fluency-tree-prompt.md` — standalone fluency tree generation (topic → branching conversation). Use when adding a fluency-tree to an existing lesson or creating one from scratch without a textbook source.

### Known failure modes
- **Schema errors** are the main problem. Wrong field names (e.g. `options[]` instead of `stems[]` for sentence-complete), missing required fields, wrong array lengths (noughts-crosses needs exactly 9 cells, call-my-bluff needs exactly 3 definitions). The schemas domain file (`.claude/activities/schemas.md`) prevents this when referenced.
- **Fluency tree merge violations** — merge nodes whose options only make sense after one incoming path. The merge rule is the most subtle constraint: every option at a merge point must work regardless of which path was taken. Documented in both schemas.md and fluency-tree-prompt.md.

### Lesson count and registry
Legacy lessons remain registered in `lessons/index.js`, but the rebuilt primary app does not expose the legacy lesson picker.

### New unit-first target
New workbook-derived content should be represented as rich Unit files under `units/`, with metadata, grammar content, practice pools, image prompts, and asset references. Games should consume those unit buckets through capability checks rather than duplicating content into hand-built lesson slides.

### Source material
Handout PDFs/DOCXs live in `material/`. Not all have been converted to lessons yet.
