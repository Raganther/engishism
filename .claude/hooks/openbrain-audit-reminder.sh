#!/bin/bash
# PostToolUse hook — fires after git-save.sh (v3)
# Enforces: domain-first triage, procedure extraction, OpenBrain audit, confirmation.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only fire for git-save.sh commands
if [[ "$COMMAND" != *"git-save.sh"* ]]; then
  exit 0
fi

echo "Git save complete. Four steps required before continuing:"
echo ""
echo "STEP 1 — Domain-first triage:"
echo ""
echo "a) Domain files modified/created this session — for each, state one of:"
echo "  CURRENT     — still accurate, no changes needed"
echo "  UPDATE      — partially changed: edit the file in place"
echo "  SUPERSEDED  — replaced by a better model: add 'Status: superseded' and note what replaced it"
echo "  INVALIDATED — wrong: remove or add 'Status: invalidated' with explanation"
echo ""
echo "b) Observations staging — for each entry in the Staging section, decide:"
echo "  CREATE-DOMAIN — confirmed enough to create a domain file now"
echo "  DELETE        — not worth keeping, remove it"
echo "Staging entries must not survive more than one session."
echo ""
echo "c) Reverse check — for each .claude/ file modified or created this session:"
echo "  - If someone reads only the domain file next session, will they know what we did? If no, update it."
echo ""
echo "State your triage explicitly before proceeding to Step 2."
echo ""
echo "STEP 2 — Procedure extraction:"
echo "Review the session's work. Ask: what reusable procedural pattern did we apply that isn't yet named as a procedure?"
echo "For each candidate, propose: name, when to apply, steps, example from this session."
echo "Wait for user approval before writing. If no candidates, state that explicitly."
echo ""
echo "STEP 3 — OpenBrain audit:"
echo "Review what was just committed. Propose confirmed/working things as OpenBrain candidates."
echo "Use the project name as category (check .claude/openbrain-category)."
echo "Run list_memories(category='<project>') first — for each candidate:"
echo "  - If it updates an existing entry: propose update_memory(id, new_content), not a new entry."
echo "  - If it is genuinely new: propose remember(content, category)."
echo "Wait for user approval before writing anything."
echo "If no candidates or updates, state that explicitly."
echo ""
echo "STEP 4 — Confirm completion."
echo "State that triage, procedure extraction, and OpenBrain audit are all done before resuming other work."

exit 0
