#!/bin/bash
# PreToolUse guard — blocks git-save.sh if memory files haven't been updated

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only act on git-save.sh calls
if [[ "$COMMAND" != *"git-save.sh"* ]]; then
  exit 0
fi

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Check if plan.md or observations.md have been modified (staged, unstaged, or new)
PLAN_CHANGED=$(git -C "$PROJECT_DIR" status --porcelain -- memory/plan.md 2>/dev/null)
OBS_CHANGED=$(git -C "$PROJECT_DIR" status --porcelain -- memory/observations.md 2>/dev/null)

if [ -z "$PLAN_CHANGED" ] && [ -z "$OBS_CHANGED" ]; then
  echo "BLOCKED: memory/plan.md and memory/observations.md have not been updated since the last commit."
  echo "Update both memory files before running git save — even if just to confirm they are current."
  exit 2
fi

exit 0
