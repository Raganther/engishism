#!/bin/bash
# PreToolUse guard — blocks git-save.sh unless all checks pass (v3)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only act on git-save.sh calls
if [[ "$COMMAND" != *"git-save.sh"* ]]; then
  exit 0
fi

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ERRORS=""

# CHECK 1: observations.md must have been modified (v3: no plan.md)
OBS_CHANGED=$(git -C "$PROJECT_DIR" status --porcelain -- .claude/memory/observations.md 2>/dev/null)
if [ -z "$OBS_CHANGED" ]; then
  ERRORS="$ERRORS\nCHECK 1 FAILED: .claude/memory/observations.md has not been modified. Update it before running git save."
fi

# CHECK 2: new files in .claude/ must be listed in CLAUDE.md
# Exempt: hooks/, procedures/, agents/, memory/, settings*, openbrain-category, activities/
NEW_CLAUDE_FILES=$(git -C "$PROJECT_DIR" status --porcelain -- .claude/ 2>/dev/null | grep '^?' | awk '{print $2}' | grep -v -E '(hooks/|procedures/|agents/|memory/|settings|openbrain-category|activities/)' | grep '\.md$')
if [ -n "$NEW_CLAUDE_FILES" ]; then
  for f in $NEW_CLAUDE_FILES; do
    BASENAME=$(basename "$f")
    if ! grep -q "$BASENAME" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
      ERRORS="$ERRORS\nCHECK 2 FAILED: New domain file '$f' not listed in CLAUDE.md."
    fi
  done
fi

# CHECK 3: core memory files must be listed in CLAUDE.md (v3: no plan.md)
for CORE_FILE in "observations.md" "gitlog.md"; do
  if ! grep -q "$CORE_FILE" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
    ERRORS="$ERRORS\nCHECK 3 FAILED: $CORE_FILE not listed in CLAUDE.md."
  fi
done

# CHECK 4: new procedure files must be in _index.md
if [ -d "$PROJECT_DIR/.claude/procedures" ]; then
  NEW_PROCS=$(git -C "$PROJECT_DIR" status --porcelain -- .claude/procedures/ 2>/dev/null | grep '^?' | awk '{print $2}' | grep '\.md$' | grep -v '_index.md')
  if [ -n "$NEW_PROCS" ]; then
    for f in $NEW_PROCS; do
      BASENAME=$(basename "$f")
      if ! grep -q "$BASENAME" "$PROJECT_DIR/.claude/procedures/_index.md" 2>/dev/null; then
        ERRORS="$ERRORS\nCHECK 4 FAILED: New procedure '$f' not listed in .claude/procedures/_index.md."
      fi
    done
  fi
fi

# CHECK 5: domain files written this session must have Epistemic: and Last verified: headers
MODIFIED_DOMAIN_FILES=$(git -C "$PROJECT_DIR" status --porcelain -- .claude/ 2>/dev/null | grep -E '^[AM\?]' | awk '{print $2}' | grep '\.md$' | grep -v -E '(hooks/|procedures/|memory/|activities/|_index)')
if [ -n "$MODIFIED_DOMAIN_FILES" ]; then
  for f in $MODIFIED_DOMAIN_FILES; do
    FULL_PATH="$PROJECT_DIR/$f"
    if [ -f "$FULL_PATH" ]; then
      if ! grep -q 'Epistemic:' "$FULL_PATH" 2>/dev/null; then
        ERRORS="$ERRORS\nCHECK 5 FAILED: Domain file '$f' missing 'Epistemic:' header."
      fi
      if ! grep -q 'Last verified:' "$FULL_PATH" 2>/dev/null; then
        ERRORS="$ERRORS\nCHECK 5 FAILED: Domain file '$f' missing 'Last verified:' header."
      fi
    fi
  done
fi

if [ -n "$ERRORS" ]; then
  echo "BLOCKED — git-save-guard checks failed:"
  echo -e "$ERRORS"
  exit 2
fi

exit 0
