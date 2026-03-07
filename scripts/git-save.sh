#!/bin/bash
# git-save.sh — commit everything and regenerate MEMORY.md
# Usage: ./scripts/git-save.sh "subject" "body"

set -e

SUBJECT="${1:-update}"
BODY="${2:-}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR"

# Stage all changes
git add -A

# Commit with subject + optional body
if [ -n "$BODY" ]; then
  git commit -m "$SUBJECT

$BODY

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
else
  git commit -m "$SUBJECT

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
fi

# Regenerate MEMORY.md from last 8 commits
MEMORY_FILE="$PROJECT_DIR/memory/MEMORY.md"

cat > "$MEMORY_FILE" << 'HEADER'
# Engishism — Memory

## Recent Git Saves
HEADER

git log --oneline -8 --pretty=format:"- %ad — %s" --date=short >> "$MEMORY_FILE"
echo "" >> "$MEMORY_FILE"

# Stage the updated MEMORY.md and amend
git add memory/MEMORY.md
git commit --amend --no-edit

echo "Git save complete."
