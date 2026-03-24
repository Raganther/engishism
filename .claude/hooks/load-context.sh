#!/bin/bash
# SessionStart hook — surfaces dynamic project state for Engishism

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== Engishism — Session Context ==="
echo "Date: $(date '+%Y-%m-%d')"
echo "Branch: $(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null)"
echo "Live URL: https://raganther.github.io/engishism/"
echo ""
echo "Uncommitted changes:"
CHANGES=$(git -C "$PROJECT_DIR" status --short 2>/dev/null)
if [ -n "$CHANGES" ]; then
  echo "$CHANGES" | head -20
else
  echo "  (none — working tree clean)"
fi
echo ""
echo "Cold start — read these files in order:"
echo "  memory/MEMORY.md     — recent git saves"
echo "  memory/plan.md       — active plan"
echo "  memory/observations.md — running insights"
echo ""
echo "On demand only:"
echo "  docs/dev.md          — ideas and backlog"
echo "  .claude/activities/schemas.md — activity type schemas (lesson writing reference)"
