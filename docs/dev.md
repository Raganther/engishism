# Engishism — Dev Notes

## Ideas Backlog

### Lesson / Game Types (to explore)
- Vocabulary flashcard reveal (word + image/definition, teacher controls pace)
- Fill-in-the-blank grammar drill (sentence shown, gap revealed on click)
- Word scramble — students call out the answer, teacher clicks to reveal
- Matching game — two columns, connect pairs
- Multiple choice quiz — options on screen, teacher reveals correct answer
- Dialogue builder — display a conversation with blanks, practice target structure
- Pronunciation focus — word/phrase displayed large, stress marks, IPA optional
- Timer challenge — word/phrase on screen with countdown
- Team scoreboard — track points across activities

### UX / Presentation Ideas
- Fullscreen mode for TV display
- Slide deck model: linear sequence with prev/next navigation
- Keyboard shortcuts for teacher (spacebar = next, arrow keys)
- Each "activity" is a slide type, assembled into a lesson deck
- Lesson files could be JSON — teacher configures content, app renders it
- Dark/light theme toggle for room lighting conditions

### Architecture Ideas
- Single HTML file per lesson? Or one app + JSON lesson files?
- Slide type registry: `{ 'flashcard': FlashcardSlide, 'quiz': QuizSlide, ... }`
- Each slide type = self-contained module with render() and optional interact()

## Completed Plans
None yet.
