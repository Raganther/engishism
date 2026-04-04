#!/bin/bash
# SessionStart hook — surfaces dynamic project state for Engishism (v3)

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
echo "  .claude/memory/gitlog.md       — recent git saves"
echo "  .claude/memory/observations.md — active work + staging"
echo "  Domain files — on demand via 'read when X' triggers in CLAUDE.md"
echo ""
echo "On demand only:"
echo "  .claude/activities/schemas.md     — activity type schemas (lesson writing reference)"
echo "  .claude/procedures/_index.md      — scan at plan creation for relevant how-to patterns"
echo "  docs/dev.md                       — ideas and backlog"
