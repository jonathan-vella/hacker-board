# HackerBoard — Copilot Custom Instructions

## Project Overview

HackerBoard is a live, interactive hackathon scoring dashboard built on **Azure App Service for Linux Containers** with **Azure Container Registry (ACR)** and an **Express adapter layer** (Node.js 20+) for the API, plus **Azure Cosmos DB NoSQL (Serverless)** for persistence. Authentication uses **GitHub OAuth** via App Service Easy Auth (same `/.auth/*` contract) and **Microsoft Entra ID** (first admin = deployer, via automated app role assignment).

## Tech Stack

- **Frontend**: Vanilla JavaScript SPA (ES2022+, no framework), single `index.html`
- **API**: Express 5.x adapter wrapping Azure Functions v4-style handlers, Node.js 20+, ESM modules
- **Storage**: Azure Cosmos DB NoSQL (Serverless) via `@azure/cosmos` SDK + `@azure/identity` `DefaultAzureCredential`
- **Auth**: GitHub OAuth via App Service Easy Auth (`.auth/` endpoints); Entra ID for admin roles; RBAC via managed identity
- **IaC**: Bicep (Azure Verified Modules where available)
- **CI/CD**: GitHub Actions → Docker build → ACR push → App Service deploy
- **Container**: Docker (Node.js 20 Alpine), port 8080

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

- Each API endpoint lives in its own file under `api/src/functions/` — handlers export named functions
- `api/server.js` is the Express entry point; `api/shared/adapter.js` wraps handlers for Express compatibility
- Handlers follow the Azure Functions v4 request/response contract (Map-based query/headers, async json()/text())
- Validate all inputs; return structured JSON error responses
- Never hardcode secrets; use environment variables or Azure Key Vault references
- Use the Cosmos DB SDK via `getContainer(name)` from `api/shared/cosmos.js` for all data access
- Use `container.items.query()` with parameterized queries — never string-interpolate user input
- Cosmos DB local auth is disabled by governance policy — always use `DefaultAzureCredential`

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
- **After every edit to any `infra/*.bicep` file, always rebuild the compiled ARM template:**
  ```bash
  az bicep build --file infra/main.bicep --outfile infra/azuredeploy.json
  ```
  The Portal "Deploy to Azure" button reads `azuredeploy.json` — it will show stale defaults if this step is skipped. Always commit both `main.bicep` and `azuredeploy.json` together.

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
│   ├── agents/           # 9 agent definitions (.agent.md)
│   ├── skills/           # 4 skill definitions (SKILL.md)
│   ├── instructions/     # File-type-specific coding rules
│   ├── workflows/        # GitHub Actions CI/CD
│   └── copilot-instructions.md  # This file
├── api/
│   ├── server.js          # Express entry point (13 API routes, security headers, static files)
│   ├── src/functions/    # API endpoint handlers (exported functions, Functions v4 contract)
│   ├── shared/           # Shared helpers (adapter, auth, cosmos, errors, logger)
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

| Agent                   | Step | Role                                                         |
| ----------------------- | ---- | ------------------------------------------------------------ |
| 01-Conductor            | Hub  | Orchestrates all agents through the 10-step workflow         |
| 02-Requirements         | 1    | Azure project requirements gathering                         |
| 10-Task Planner         | 2    | Codebase research, phased task planning, dependency analysis |
| 03-Architect            | 3    | WAF review, Azure architecture decisions, cost estimation    |
| 11-UX Designer          | 4a   | JTBD, user journeys, accessibility review                    |
| 04-Design               | 4b   | Diagrams, ADRs (parallel with 4a)                            |
| 05-Code Planner         | 5    | Application-level code planning, structured implementation   |
| 09-Security Reviewer    | 6    | OWASP Top 10, Zero Trust code review                         |
| 06-Bicep Planner        | 7    | Machine-readable Bicep implementation plans, AVM evaluation  |
| 07-Bicep Code Generator | 8    | Near-production-ready Bicep templates, validates and lints   |
| 08-Deploy               | 9    | Azure deployment execution via deploy.ps1                    |
| 04-Design (as-built)    | 10   | As-built documentation + diagrams (via docs-writer skill)    |
| 12-Diagnose             | Aux  | Azure resource health diagnostics and remediation guidance   |

### Skill Conventions

Skills live in `.github/skills/{name}/SKILL.md`. Each skill:

- Has YAML frontmatter with `name`, `description`, and `license`
- Defines reusable capabilities invokable by agents or directly by users
- Includes trigger phrases and step-by-step workflows

| Skill             | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| azure-diagrams    | Azure architecture diagrams via Python `diagrams` + Graphviz |
| docs-writer       | Documentation maintenance, staleness checks                  |
| git-commit        | Conventional commits, diff-aware messages                    |
| github-operations | Issues, PRs, Actions via MCP/gh CLI                          |

### Instruction Files

Instruction files in `.github/instructions/` provide file-type-specific rules. They use `applyTo` globs to auto-activate:

| File                                         | Applies To                     |
| -------------------------------------------- | ------------------------------ |
| `accessibility.instructions.md`              | `*.html, *.css, *.js`          |
| `agent-research-first.instructions.md`       | `**/*.agent.md`                |
| `azure-functions-api.instructions.md`        | `api/**/*.js, api/**/*.json`   |
| `bicep.instructions.md`                      | `*.bicep, *.bicepparam`        |
| `code-comments.instructions.md`              | All files                      |
| `code-review.instructions.md`                | `*.js, *.html, *.css, *.bicep` |
| `docs.instructions.md`                       | `docs/**/*.md`                 |
| `execution-plan.instructions.md`             | `**/*.{js,html,css,bicep}`     |
| `github-actions.instructions.md`             | `.github/workflows/*.yml`      |
| `html-css-style.instructions.md`             | `*.html, *.css, *.js`          |
| `markdown.instructions.md`                   | `**/*.md`                      |
| `security.instructions.md`                   | All files                      |
| `shell.instructions.md`                      | `**/*.sh`                      |
| `update-docs-on-code-change.instructions.md` | `**/*.{js,html,css,bicep,sh}`  |

## Documentation

- All project docs live in `docs/` — follow standards in `.github/instructions/docs.instructions.md`
- Use shields.io badges for status, type, and tech metadata at the top of doc files
- Use tables over bullet lists for inventories and structured data
- Use Mermaid diagrams for architecture and workflow visualization
- Add a `← Back to Documentation` footer link pointing to `docs/README.md` on each doc page
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
