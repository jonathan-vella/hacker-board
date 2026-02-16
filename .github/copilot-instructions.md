# HackerBoard — Copilot Custom Instructions

## Project Overview

HackerBoard is a live, interactive hackathon scoring dashboard built on **Azure Static Web Apps (Standard)** with **managed Azure Functions** (Node.js 20+) for the API layer and **Azure Table Storage** for persistence. Authentication uses the built-in GitHub OAuth provider.

## Tech Stack

- **Frontend**: Vanilla JavaScript SPA (ES2022+, no framework), single `index.html`
- **API**: Azure Functions v4 programming model, Node.js 20+, ESM modules
- **Storage**: Azure Table Storage via `@azure/data-tables` SDK
- **Auth**: Azure Static Web Apps built-in GitHub OAuth (`.auth/` endpoints)
- **IaC**: Bicep (Azure Verified Modules where available)
- **CI/CD**: GitHub Actions → Azure Static Web Apps deployment

## Coding Standards

- Use JavaScript with ES2022+ features and Node.js ESM modules
- Use `async/await` for all asynchronous code
- Prefer Node.js built-in modules (`node:fs/promises`, `node:crypto`, etc.) over external packages
- Ask before adding any new dependencies
- Never use `null`; use `undefined` for optional values
- Prefer functions over classes
- Write self-explanatory code; comment only to explain WHY, not WHAT
- Use descriptive variable and function names

## API Conventions

- Each API endpoint lives in its own file under `api/`
- Use Azure Functions v4 `@azure/functions` patterns
- Validate all inputs; return structured JSON error responses
- Never hardcode secrets; use environment variables or Azure Key Vault references
- Use parameterized queries / safe SDK methods — no string-interpolated queries

## Frontend Conventions

- Use semantic HTML (`header`, `nav`, `main`, `footer`, `section`, `article`)
- Follow WCAG 2.2 Level AA accessibility standards
- Use `.textContent` over `.innerHTML` to prevent XSS; sanitize with DOMPurify when HTML is needed
- Apply the 60-30-10 color rule (cool primary/secondary, hot accent)
- Ensure all interactive elements are keyboard operable with visible focus indicators

## Infrastructure Conventions

- Use lowerCamelCase for all Bicep names
- Declare parameters at the top with `@description` decorators
- Use latest stable API versions
- Use symbolic names for resource references (not `reference()` or `resourceId()`)
- Never output secrets in Bicep outputs
- Use Azure Verified Modules (`br/public:avm/res/...`) where available

## Security

- Follow OWASP Top 10 guidelines
- Deny by default for access control
- Always use HTTPS
- Set security headers (CSP, HSTS, X-Content-Type-Options)
- Never hardcode API keys, passwords, or connection strings
- Sanitize all user input to prevent injection attacks

## Testing

- Use Vitest for JavaScript/Node.js testing
- Write tests for all new features and bug fixes
- Never modify production code solely to make it easier to test
- **API tests**: `api/vitest.config.js` — runs with `cd api && npm test`
- **Frontend DOM tests**: `vitest.config.js` (root) — uses `happy-dom` environment, runs with `npm run test:ui`
- Run all tests: `npm run test:all`

## Project Structure

```
hacker-board/
├── .github/
│   ├── agents/           # 6 agent definitions (.agent.md)
│   ├── skills/           # 3 skill definitions (SKILL.md)
│   ├── instructions/     # File-type-specific coding rules
│   ├── workflows/        # GitHub Actions CI/CD
│   └── copilot-instructions.md  # This file
├── api/
│   ├── src/functions/    # Azure Functions v4 endpoints (1 file per endpoint)
│   ├── shared/           # Shared helpers (auth, errors, tables, logger)
│   └── tests/            # API unit tests (Vitest)
├── src/
│   ├── index.html        # SPA entry point
│   ├── app.js            # Hash router + app shell
│   ├── components/       # UI components (async functions, not classes)
│   ├── services/         # API client, auth, notifications, telemetry
│   └── styles/           # CSS
├── docs/                 # Project documentation (PRD, API spec, design, backlog)
├── infra/                # Bicep IaC (modules/ for sub-resources)
├── scripts/              # Utility scripts (seed data, cleanup)
└── templates/            # Scoring rubric templates
```

## Agents & Skills

### Agent Conventions

Agents live in `.github/agents/` as `{name}.agent.md` files. Each agent:

- Has YAML frontmatter with `name`, `description`, and `tools`
- Defines a specific role in the development workflow
- Should include Input/Output contracts for orchestrated handoffs

| Agent                  | Role                                         |
| ---------------------- | -------------------------------------------- |
| Task Planner           | Research, plan tasks, dependency analysis    |
| Implementation Planner | Structured implementation plans, refactoring |
| Azure Architect        | WAF review, Azure architecture decisions     |
| Bicep AVM Expert       | Bicep IaC with Azure Verified Modules        |
| Security Reviewer      | OWASP Top 10, Zero Trust code review         |
| UX Designer            | JTBD, user journeys, accessibility review    |

### Skill Conventions

Skills live in `.github/skills/{name}/SKILL.md`. Each skill:

- Has YAML frontmatter with `name`, `description`, and `license`
- Defines reusable capabilities invokable by agents or directly by users
- Includes trigger phrases and step-by-step workflows

| Skill             | Purpose                                     |
| ----------------- | ------------------------------------------- |
| docs-writer       | Documentation maintenance, staleness checks |
| git-commit        | Conventional commits, diff-aware messages   |
| github-operations | Issues, PRs, Actions via MCP/gh CLI         |

### Instruction Files

Instruction files in `.github/instructions/` provide file-type-specific rules. They use `applyTo` globs to auto-activate:

| File                                  | Applies To                     |
| ------------------------------------- | ------------------------------ |
| `accessibility.instructions.md`       | `*.html, *.css, *.js`          |
| `azure-functions-api.instructions.md` | `api/**/*.js, api/**/*.json`   |
| `bicep.instructions.md`               | `*.bicep, *.bicepparam`        |
| `code-comments.instructions.md`       | All files                      |
| `code-review.instructions.md`         | `*.js, *.html, *.css, *.bicep` |
| `docs.instructions.md`                | `docs/**/*.md`                 |
| `html-css-style.instructions.md`      | `*.html, *.css, *.js`          |
| `security.instructions.md`            | All files                      |

## Documentation

- All project docs live in `docs/` — follow standards in `.github/instructions/docs.instructions.md`
- Use shields.io badges for status, type, and tech metadata at the top of doc files
- Use tables over bullet lists for inventories and structured data
- Use Mermaid diagrams for architecture and workflow visualization
- Add `[← Back to Documentation](README.md)` navigation footer to each doc page
- Keep docs current: update when code changes (see `update-docs-on-code-change.instructions.md`)

## Execution Plan

- `docs/backlog.md` is the **single source of truth** for project status, task tracking, and decisions
- **Read `docs/backlog.md` before starting any implementation work**
- Check off tasks with `[x]`, mark blockers with `[!]`
- Record architectural decisions in the Decision Log
- Update Session Handoff Notes at the end of each session

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>
```

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `refactor` | Code refactor (no feature/fix) |
| `test`     | Add/update tests               |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |

Scopes: `api`, `ui`, `infra`, `docs`, `agents`, `skills`
