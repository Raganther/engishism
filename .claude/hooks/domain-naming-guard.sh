#!/bin/bash
# PreToolUse guard — enforces lowercase-hyphenated naming for .claude/*.md files

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only check .md files under .claude/
if [[ "$FILE_PATH" != *"/.claude/"* ]] || [[ "$FILE_PATH" != *.md ]]; then
  exit 0
fi

# Exempt paths: hooks/, memory/, settings*, openbrain-category, _index.md, procedures/, agents/, activities/
BASENAME=$(basename "$FILE_PATH")
RELPATH="${FILE_PATH#*/.claude/}"
if [[ "$RELPATH" == hooks/* ]] || [[ "$RELPATH" == memory/* ]] || [[ "$RELPATH" == procedures/* ]] || [[ "$RELPATH" == agents/* ]] || [[ "$RELPATH" == activities/* ]] || [[ "$BASENAME" == settings* ]] || [[ "$BASENAME" == "openbrain-category" ]] || [[ "$BASENAME" == "_index.md" ]]; then
  exit 0
fi

# Check naming convention: lowercase letters, digits, hyphens only; must start with lowercase letter
NAME="${BASENAME%.md}"
if ! echo "$NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
  echo "BLOCKED: Domain file name '$BASENAME' violates naming convention."
  echo "Names must be lowercase-hyphenated: ^[a-z][a-z0-9-]*\\.md$"
  echo "No uppercase letters, underscores, spaces, or leading digits."
  exit 2
fi

exit 0
