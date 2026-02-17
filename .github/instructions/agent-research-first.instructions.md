---
description: "MANDATORY research-before-implementation requirements for all agents"
applyTo: "**/*.agent.md,**/.github/skills/**/SKILL.md"
---

# Agent Research Requirements

**MANDATORY: All agents MUST perform thorough research before implementation.**

This instruction enforces a "research-first" pattern to ensure complete,
one-shot execution without missing context or requiring multiple iterations.

## Pre-Implementation Research Checklist

Before creating ANY output files or making changes, agents MUST:

- [ ] **Search workspace** for existing patterns and similar code
- [ ] **Read relevant files** — existing code, templates, docs
- [ ] **Query documentation** via MCP tools (Azure docs, best practices)
- [ ] **Validate inputs** — confirm all required context exists
- [ ] **Achieve 80% confidence** before proceeding to implementation

## Research Workflow Pattern

### Step 1: Context Gathering (REQUIRED)

Use read-only tools to gather context without making changes:

```text
- semantic_search: Find related code, patterns, and documentation
- grep_search: Search for specific terms, resource names, patterns
- read_file: Read existing code, configuration files, docs
- list_dir: Explore project structure
- file_search: Find files by name or glob pattern
```

### Step 2: Validation Gate (REQUIRED)

Before implementation, confirm:

1. **Required inputs exist** — referenced files and context are present
2. **Standards understood** — coding conventions and project patterns reviewed
3. **No duplication** — proposed changes don't duplicate existing code
4. **Guidance obtained** — relevant documentation queried

### Step 3: Confidence Assessment

Only proceed when you have **80% confidence** in your understanding of:

- What needs to be created or modified
- Where files should be located
- What format and structure to use
- What patterns and conventions apply

**If confidence is below 80%**: Delegate autonomous research to a subagent,
or ASK the user for clarification rather than assuming.

## Delegation Pattern for Deep Research

When extensive research is needed, delegate to a subagent:

```markdown
MANDATORY: Run a subagent tool, instructing the agent to work autonomously
without pausing for user feedback, to gather comprehensive context
and return findings.
```

## Enforcement Rules

**DO:**

- Research BEFORE creating files
- Read existing code BEFORE generating output
- Query docs BEFORE recommending approaches
- Check existing patterns BEFORE creating new ones
- Validate inputs BEFORE proceeding to next step
- Ask for clarification when confidence is low

**DO NOT:**

- Skip research to "save time"
- Assume requirements without verification
- Create output without reading existing patterns first
- Proceed with missing context from previous workflow steps
- Make up information when uncertain

## Per-Agent Research Focus

| Agent                      | Primary Research Focus                                  |
| -------------------------- | ------------------------------------------------------- |
| **HackerBoard Conductor**  | Backlog status, workflow step sequencing, gate readiness |
| **Implementation Planner** | Existing code, patterns, dependency analysis            |
| **Azure Architect**        | Azure services, WAF pillars, SKU recommendations        |
| **Bicep AVM Expert**       | AVM availability, naming conventions, security defaults |
| **Security Reviewer**      | OWASP patterns, auth flows, input validation            |
| **UX Designer**            | Accessibility, user journeys, existing UI patterns      |
| **Task Planner**           | Backlog, dependencies, phased execution planning        |

## Conductor Workflow Awareness

When operating within the Conductor's 7-step workflow, agents receive
structured handoff inputs from the preceding step. Research requirements
still apply — agents must validate handoff inputs and cross-reference
with the codebase before producing output.

**Before accepting a handoff**: Verify the Input Contract is satisfied
by checking that all expected artifacts and context exist.

**Before producing a handoff**: Verify the Output Contract is satisfied
by confirming all required deliverables are complete and validated.
