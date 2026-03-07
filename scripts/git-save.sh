#!/bin/bash
# git-save.sh — commit everything and regenerate MEMORY.md

set -e

MESSAGE="${1:-update}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR"

# Stage all changes
git add -A

# Commit
git commit -m "$MESSAGE

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# Regenerate MEMORY.md from last 10 commits
MEMORY_FILE="$PROJECT_DIR/memory/MEMORY.md"

cat > "$MEMORY_FILE" << 'HEADER'
# Engishism — Memory

## Recent Git Saves
HEADER

git log --oneline -10 --pretty=format:"- %ad — %s" --date=short >> "$MEMORY_FILE"
echo "" >> "$MEMORY_FILE"

# Stage the updated MEMORY.md and amend
git add memory/MEMORY.md
git commit --amend --no-edit

echo "Git save complete."
