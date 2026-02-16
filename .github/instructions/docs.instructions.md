---
description: "Standards for user-facing documentation in the docs/ folder"
applyTo: "docs/**/*.md"
---

# Documentation Standards

Instructions for creating and maintaining user-facing documentation
in the `docs/` folder.

## Structure Requirements

### File Header

Every doc file should start with:

```markdown
# {Title}

> {One-line description of the document's purpose}
```

### Single H1 Rule

Each file has exactly ONE H1 heading (the title). Use H2+ for all
other sections.

### Link Style

- Use relative links for internal docs (e.g., `[API Spec](api-spec.md)`)
- Use reference-style links for external URLs
- No broken links — verify all relative links resolve to existing files

## Current Architecture

### Documentation Files

| File                            | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `docs/api-spec.md`              | API endpoint specifications         |
| `docs/app-design.md`            | Application design and architecture |
| `docs/app-prd.md`               | Product requirements document       |
| `docs/app-scaffold.md`          | Project scaffolding guide           |
| `docs/app-handoff-checklist.md` | Handoff and review checklist        |
| `docs/agents-and-skills.md`    | Agent/skill inventory, prompt guide |
| `docs/backlog.md`               | Feature backlog and task tracking   |
| `README.md`                     | Repo root README                    |

### Agents

| Agent                    | Purpose                               |
| ------------------------ | ------------------------------------- |
| `implementation-planner` | Structured implementation plans       |
| `azure-architect`        | WAF-based architecture review         |
| `bicep-avm`              | Bicep IaC with Azure Verified Modules |
| `security-reviewer`      | OWASP and Zero Trust code review      |
| `ux-designer`            | UX/UI design and accessibility        |
| `task-planner`           | Task research and dependency analysis |

## Content Principles

| Principle           | Application                               |
| ------------------- | ----------------------------------------- |
| **DRY**             | Single source of truth per topic          |
| **Current state**   | No historical context in main docs        |
| **Action-oriented** | Every section answers "how do I...?"      |
| **Minimal**         | If it doesn't help users today, remove it |

## Validation

When updating documentation:

- No broken internal links
- Markdown lint passes (120-char line limit)
- Agent and file counts match the actual filesystem
- Code examples are current and runnable
