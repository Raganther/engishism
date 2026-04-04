#!/bin/bash
# git-save.sh — commit everything, regenerate gitlog, push if remote configured
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

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
else
  git commit -m "$SUBJECT

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
fi

# Regenerate gitlog.md from last 8 commits
GITLOG_FILE="$PROJECT_DIR/.claude/memory/gitlog.md"

cat > "$GITLOG_FILE" << 'HEADER'
# Engishism — Git Log

## Last 8 Saves
HEADER

git log --oneline -8 --pretty=format:"- %ad — %s" --date=short >> "$GITLOG_FILE"
echo "" >> "$GITLOG_FILE"

# Observation age warnings
OBS_FILE="$PROJECT_DIR/.claude/memory/observations.md"
if [ -f "$OBS_FILE" ]; then
  FOURTEEN_DAYS_AGO=$(date -v-14d '+%Y-%m-%d' 2>/dev/null || date -d '14 days ago' '+%Y-%m-%d' 2>/dev/null)
  if [ -n "$FOURTEEN_DAYS_AGO" ]; then
    STALE=$(grep -E '## .+ \([0-9]{4}-[0-9]{2}-[0-9]{2}\)' "$OBS_FILE" | while read -r line; do
      DATE=$(echo "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
      if [ -n "$DATE" ] && [[ "$DATE" < "$FOURTEEN_DAYS_AGO" ]]; then
        echo "  WARNING: stale observation — $line"
      fi
    done)
    if [ -n "$STALE" ]; then
      echo ""
      echo "Observation age warnings (>14 days):"
      echo "$STALE"
    fi
  fi
fi

# Stage the updated gitlog and amend
git add .claude/memory/gitlog.md
git commit --amend --no-edit

# Push if remote configured (warn but don't block on failure)
if git remote get-url origin &>/dev/null; then
  git pull --rebase 2>/dev/null || echo "WARNING: pull --rebase failed (non-blocking)"
  git push 2>/dev/null || echo "WARNING: push failed (non-blocking)"
fi

echo "Git save complete."
