Status: current | Epistemic: confirmed | Last verified: 2026-04-22

# Harness v4.2 - Engishism Memory & Knowledge Convention

This project follows the Harness v4.2 knowledge convention adapted from the shared template at `/Users/alistairelliman/DEV/template/.claude/harness-v4.md`.

The core convention is tool-agnostic: it works in Codex, Claude Code, or any future coding agent as long as the files are read and maintained. Claude Code-specific hooks may exist in this repo, but they are not the authority. The Markdown structure is the authority.

## Knowledge

### The three layers

**Domain files** hold confirmed, settled knowledge per topic. They do not contain speculative content, in-progress plans, or open questions. Each domain file owns one topic and must include a `## Knowledge` section.

**Roadmap** (`.claude/strategies/research-roadmap.md`) is the single staging layer for everything unresolved: open questions, ideas, in-progress experiments, monitoring items, and future work. When a roadmap item is settled, promote the confirmed fact to the relevant domain file and move or remove the roadmap item.

**`CLAUDE.md`** is the stable navigation map and table of contents. It should contain project orientation, run commands, architecture summary, current status, and "read when X" triggers. It should not hold volatile planning state.

Session continuity is carried by `.claude/memory/gitlog.md` plus rich save/commit messages. The old `.claude/memory/observations.md` file is retired.

### Knowledge lifecycle

```text
conversation -> roadmap (add open question / idea)
             -> roadmap status updated (validated / rejected / monitoring)
             -> settled fact promoted to relevant domain file
             -> roadmap item moved to resolved history or deleted
```

Domain files never receive speculative content directly. Everything unresolved belongs in the roadmap first.

### Write order

```text
Roadmap (add/update unresolved items)
-> Domain files (promote settled items)
-> CLAUDE.md (only if navigation, architecture, commands, or domain file list changed)
-> git save / commit with a useful message
```

When working in Claude Code, prefer `./scripts/git-save.sh` if available and current. In Codex or plain shell sessions, follow the same file discipline manually.

### Read order

```text
CLAUDE.md
-> .claude/memory/gitlog.md
-> .claude/strategies/research-roadmap.md when planning or continuing open work
-> domain files on demand via CLAUDE.md read triggers
```

### Domain file format

```markdown
Status: current | Epistemic: confirmed | Last verified: YYYY-MM-DD

# [Title]

## Knowledge

Confirmed facts only. No open questions, no to-dos, no speculative content.
```

Rules:
- `Status | Epistemic | Last verified` header is mandatory.
- `## Knowledge` is mandatory.
- Do not use `## Plan`, `## Open Questions`, or `## Research` sections in domain files.
- Do not leave placeholder text in empty sections.

### CLAUDE.md read trigger format

Every important domain or strategy file should be listed in `CLAUDE.md` with a trigger:

```markdown
- .claude/activities/schemas.md - read when writing or editing lesson files
- .claude/strategies/research-roadmap.md - read when planning work or resolving open questions
```

The trigger tells future sessions when to load the file without being told explicitly.

### Hooks

Existing `.claude/hooks/*` files were designed for Claude Code. They can remain as helpful automation for Claude Code sessions, but Codex does not automatically enforce them.

Manual checks before saving:
1. Domain files have `Epistemic:` and `Last verified:` headers.
2. Domain files contain `## Knowledge`.
3. Domain files do not contain `## Open Questions`, `## Plan`, or `## Research`.
4. Unresolved work is in `.claude/strategies/research-roadmap.md`.
5. New domain files are referenced from `CLAUDE.md`.
6. `CLAUDE.md` changes explain navigation, commands, architecture, or file index changes.

### Naming conventions

- Harness spec: `.claude/harness-v4.md`
- Roadmap: `.claude/strategies/research-roadmap.md`
- Domain files: lowercase hyphenated Markdown where practical
- Activity schemas: `.claude/activities/schemas.md`
- Procedures: `.claude/procedures/`, indexed in `.claude/procedures/_index.md`
- Memory files: `.claude/memory/`

### Maintaining this file

Update this file whenever the project knowledge convention changes. If the layer model, read/write order, or enforcement rules change, bump the harness version and update `Last verified`.
