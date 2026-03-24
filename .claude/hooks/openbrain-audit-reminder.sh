#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
if [[ "$COMMAND" != *"git-save.sh"* ]]; then
  exit 0
fi
echo "Git save complete. OpenBrain audit required:"
echo "1. Review what was just committed."
echo "2. Propose any OpenBrain candidates — category, content, and why it passes the cross-project filter."
echo "3. Wait for user approval before writing anything."
echo "4. If no candidates, state that explicitly."
echo "Do not proceed with other work until the audit is complete."
exit 0
