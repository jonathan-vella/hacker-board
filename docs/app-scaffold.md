# App Scaffolding Guide — HackerBoard

![Type](https://img.shields.io/badge/Type-Guide-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Runtime](https://img.shields.io/badge/Runtime-Node.js%2020-green)
![Platform](https://img.shields.io/badge/Platform-App%20Service%20%2B%20ACR-purple)

> Reference folder structure and setup guide for the hacker-board application repository.
> This is a template — adapt the frontend framework choice to your team's preference.

---

## Folder Structure

```text
hacker-board/
├── .devcontainer/
│   ├── devcontainer.json            # Dev container config (extensions, ports)
│   ├── Dockerfile                   # Container image
│   └── post-create.sh               # Post-create setup script
├── .github/
│   ├── agents/                      # 12 VS Code custom agents (prefixed 01–12)
│   │   ├── 01-conductor.agent.md            # Master orchestrator
│   │   ├── 02-requirements.agent.md         # Azure project requirements
│   │   ├── 03-architect.agent.md            # WAF architecture review
│   │   ├── 04-design.agent.md               # Diagrams, ADRs, cost estimates
│   │   ├── 05-implementation-planner.agent.md # Structured implementation plans
│   │   ├── 06-bicep-plan.agent.md           # Bicep IaC planning, AVM eval
│   │   ├── 07-bicep-code.agent.md           # Near-production Bicep templates
│   │   ├── 08-deploy.agent.md               # Azure deployment execution
│   │   ├── 09-security-reviewer.agent.md    # OWASP & Zero Trust review
│   │   ├── 10-task-planner.agent.md         # Research & dependency analysis
│   │   ├── 11-ux-designer.agent.md          # UX/UI & accessibility review
│   │   └── 12-diagnose.agent.md             # Azure resource diagnostics
│   ├── instructions/                # 14 file-type-specific coding rules
│   ├── skills/                      # 3 reusable skills
│   │   ├── docs-writer/SKILL.md
│   │   ├── git-commit/SKILL.md
│   │   └── github-operations/SKILL.md
│   ├── workflows/
│   │   └── deploy-app.yml           # GitHub Actions CI/CD
│   └── copilot-instructions.md      # Global Copilot custom instructions
├── .vscode/
│   └── extensions.json              # Recommended VS Code extensions
├── api/                             # Express 5.x API server (Node.js 20+, ESM)
│   ├── server.js                    # Express entry point (routes + security headers)
│   ├── package.json                 # API dependencies
│   ├── vitest.config.js             # API test config
│   ├── shared/                      # Shared helpers
│   │   ├── adapter.js               # adapt() wrapper — Functions v4 → Express
│   │   ├── auth.js                  # getClientPrincipal(), requireRole()
│   │   ├── cosmos.js                # getContainer() factory (DefaultAzureCredential)
│   │   ├── errors.js                # Structured error response builder
│   │   ├── featureFlags.js          # Feature flag reader
│   │   ├── logger.js                # Structured logging
│   │   └── rubricParser.js          # Markdown → rubric JSON parser
│   ├── src/functions/               # Route handlers (1 per file, Functions v4 contract)
│   │   ├── attendees.js             # GET /api/attendees, GET/POST /api/attendees/me
│   │   ├── attendees-bulk.js        # POST /api/attendees/bulk (F9)
│   │   ├── awards.js                # GET/POST/PUT /api/awards (F4)
│   │   ├── flags.js                 # GET/PUT /api/flags
│   │   ├── rubrics.js               # GET/POST /api/rubrics, GET /api/rubrics/active (F11)
│   │   ├── scores.js                # GET/POST /api/scores
│   │   ├── submissions.js           # GET /api/submissions, POST /api/submissions/validate
│   │   ├── teams.js                 # GET/POST/PUT/DELETE /api/teams
│   │   ├── teams-assign.js          # POST /api/teams/assign (F10)
│   │   └── upload.js                # POST /api/upload (F6)
│   └── tests/                       # API unit tests (Vitest)
│       ├── helpers/mock-table.js    # Shared table mock
│       ├── attendees-awards.test.js
│       ├── feature-flags.test.js
│       ├── rubric-parser.test.js
│       ├── scores.test.js
│       ├── shared-helpers.test.js
│       ├── teams.test.js
│       └── upload-submissions.test.js
├── docs/                            # Project documentation
│   ├── README.md                    # Documentation hub
│   ├── api-spec.md                  # API endpoint contracts
│   ├── openapi.yaml                 # OpenAPI 3.0 specification
│   ├── swagger-ui.html              # Interactive API explorer
│   ├── app-prd.md                   # Product requirements (F1–F11)
│   ├── app-design.md                # UI/UX design + component model
│   ├── app-scaffold.md              # This file — folder structure guide
│   ├── app-handoff-checklist.md     # Infrastructure wiring steps
│   ├── admin-procedures.md          # Admin runbook + role management
│   ├── agents-and-skills.md         # AI agent inventory & orchestration
│   └── backlog.md                   # Execution plan, decisions, tracking
├── infra/                           # Bicep IaC (Azure Verified Modules)
│   ├── main.bicep                   # Root template
│   ├── main.bicepparam              # Parameter file
│   ├── main.json                    # ARM export
│   ├── azuredeploy.json             # One-click deploy template
│   ├── deploy.ps1                   # Deployment script
│   └── modules/                     # AVM-based sub-modules
│       ├── acr.bicep                # Azure Container Registry (Basic)
│       ├── app-insights.bicep       # Application Insights
│       ├── app-service.bicep        # App Service Plan + Web App (Containers)
│       ├── cosmos-account.bicep     # Cosmos DB account (Serverless, no local auth)
│       ├── cosmos-rbac.bicep        # Cosmos DB RBAC role assignment
│       └── log-analytics.bicep      # Log Analytics workspace
├── scripts/                         # Utility scripts
│   ├── seed-demo-data.js            # Seed tables with demo data
│   └── cleanup-app-data.js          # Reset tables between events
├── src/                             # SPA Frontend (vanilla JS, ES2022+)
│   ├── index.html                   # Entry point
│   ├── app.js                       # Hash router + app shell
│   ├── components/                  # UI components (async functions)
│   │   ├── AdminReviewQueue.js      # Admin submission triage
│   │   ├── AttendeeBulkEntry.js     # F9: Admin bulk attendee import
│   │   ├── Awards.js                # F4: Award display + assignment
│   │   ├── FeatureFlags.js          # Admin feature flag toggles
│   │   ├── Leaderboard.js           # F2/F3: Ranked team table
│   │   ├── Navigation.js            # Nav bar with role-aware links
│   │   ├── Registration.js          # F7: Attendee profile form
│   │   ├── RubricManager.js         # F11: Rubric list + upload + preview
│   │   ├── ScoreSubmission.js       # F1: Team score submission form
│   │   ├── SubmissionStatus.js      # Member submission status
│   │   ├── TeamAssignment.js        # F10: Random team assignment
│   │   ├── TeamRoster.js            # F10: Team ↔ attendee grid
│   │   └── UploadScores.js          # F6: Own-team JSON upload
│   ├── services/                    # API clients and utilities
│   │   ├── api.js                   # fetch() wrappers for /api/*
│   │   ├── auth.js                  # /.auth/me client helper
│   │   ├── notifications.js         # Toast notification service
│   │   ├── rubric.js                # Rubric fetch, parse, cache
│   │   └── telemetry.js             # App Insights telemetry client
│   └── styles/
│       └── main.css                 # Global styles + theme variables
├── templates/                       # Scoring rubric templates
│   ├── GENERATE-RUBRIC.md           # Prompt for generating rubrics
│   ├── scoring-rubric.template.md   # Blank rubric template
│   └── scoring-rubric.reference.md  # Reference rubric (105+25 pts)
├── .env.example                     # Environment variable template
├── .gitignore
├── Dockerfile                       # Node.js 20 Alpine container image
├── package.json                     # Root dependencies + scripts
├── vitest.config.js                 # Frontend DOM test config (happy-dom)
└── README.md                        # Repository README
```

---

## Key Files Explained

### `api/server.js` — Express Entry Point

Registers security headers (CSP, HSTS, X-Content-Type-Options), mounts static files from `src/`, and wires all 13 API routes via the `adapt()` helper. Listens on `process.env.PORT || 8080`.

### `api/package.json` — API Dependencies

```json
{
  "name": "hacker-board-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "server.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@azure/cosmos": "^4.2.0",
    "@azure/identity": "^4.9.0",
    "express": "^5.2.1"
  },
  "devDependencies": {
    "vitest": "^4.0.18"
  }
}
```

### `api/shared/auth.js` — Auth Helpers

```javascript
export function getClientPrincipal(req) {
  const header = req.headers.get("x-ms-client-principal");
  if (!header) return undefined;
  const decoded = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

export function requireRole(req, role) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userRoles.includes(role)) {
    return {
      status: 403,
      jsonBody: {
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      },
    };
  }
  return undefined;
}
```

### `api/shared/cosmos.js` — Cosmos DB Client Factory

```javascript
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const COSMOS_ENDPOINT = process.env.COSMOS_DB_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_DB_KEY;
const DATABASE_NAME = "hackerboard";

let client;

function getClient() {
  if (!client) {
    // Local dev: use emulator key; production: Entra ID RBAC (no keys)
    client = COSMOS_KEY
      ? new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY })
      : new CosmosClient({
          endpoint: COSMOS_ENDPOINT,
          aadCredentials: new DefaultAzureCredential(),
        });
  }
  return client;
}

export function getContainer(containerName) {
  return getClient().database(DATABASE_NAME).container(containerName);
}
```

### Express Route Handler Pattern

Each endpoint is a named export function following the Azure Functions v4 request/response contract, wrapped by `adapt()` in `api/server.js`:

```javascript
import { requireRole } from "../../shared/auth.js";
import { getContainer } from "../../shared/cosmos.js";

export async function teamsGet(req, context) {
  const container = getContainer("teams");
  const { resources } = await container.items
    .query("SELECT * FROM c")
    .fetchAll();
  return { jsonBody: resources };
}
```

In `api/server.js`, routes are registered using the `adapt()` wrapper:

```javascript
import { adapt } from "./shared/adapter.js";
import { teamsGet } from "./src/functions/teams.js";

router.get("/api/teams", adapt(teamsGet));
```

> App Service Easy Auth intercepts unauthenticated requests before they reach Express — route handlers can trust that `x-ms-client-principal` is always present for protected routes.

---

## Local Development

### Prerequisites

- Node.js 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for container builds)
- [Azure Cosmos DB Emulator](https://learn.microsoft.com/azure/cosmos-db/how-to-develop-emulator) or a cloud Cosmos DB endpoint

> All prerequisites are pre-installed in the dev container (`.devcontainer/`).

### Setup

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Seed demo data (requires COSMOS_ENDPOINT env var)
node scripts/seed-demo-data.js --reset

# Run locally with Node.js (serves frontend + API on port 8080)
cd api && npm start
```

Alternatively, run the full container locally:

```bash
docker build -t hacker-board:local .
docker run -p 8080:8080 \
  -e COSMOS_ENDPOINT=https://localhost:8081 \
  -e PORT=8080 \
  hacker-board:local
```

The Express server:

- Serves the frontend SPA from `src/` as static files
- Routes `/api/*` to the registered handler functions
- Reads `x-ms-client-principal` for auth (set by App Service Easy Auth in production)

### Environment Variables for Local Dev

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

For local Cosmos DB emulator, set in your `.env`:

```bash
COSMOS_ENDPOINT=https://localhost:8081
# Emulator master key (public, safe for local dev only)
COSMOS_DB_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==
PORT=8080
```

In production, `COSMOS_ENDPOINT` is set as an App Service application setting — no key is used (DefaultAzureCredential + Managed Identity RBAC).

---

## Frontend Framework Options

The scaffold above uses vanilla JS for simplicity. For a richer developer experience, consider:

| Framework                 | Build Output      | Docker `COPY` source |
| ------------------------- | ----------------- | -------------------- |
| Vanilla JS/HTML           | `src/` (no build) | `src`                |
| React (Vite)              | `dist/`           | `dist`               |
| Svelte (SvelteKit static) | `build/`          | `build`              |
| Vue (Vite)                | `dist/`           | `dist`               |

Adjust the `COPY` path in the `Dockerfile` and the `output_location` in the GitHub Actions workflow accordingly.

---

## `package.json` Scripts (Root)

```json
{
  "scripts": {
    "start": "cd api && npm start",
    "build": "echo 'No build step for vanilla JS'",
    "test": "cd api && npm test",
    "test:ui": "vitest run --config vitest.config.js",
    "test:all": "npm test && npm run test:ui",
    "lint": "echo 'Add ESLint configuration'"
  }
}
```

### Testing

| Suite              | Command              | Config                    | Environment |
| ------------------ | -------------------- | ------------------------- | ----------- |
| API unit tests     | `cd api && npm test` | `api/vitest.config.js`    | Node.js     |
| Frontend DOM tests | `npm run test:ui`    | `vitest.config.js` (root) | happy-dom   |
| All tests          | `npm run test:all`   | Both                      | Both        |

---

## Role and Scope Enforcement

Implement API authorization and validation with these invariants:

- `member` role can submit uploads only for their own team.
- Team identity is resolved server-side from attendee profile (`/.auth/me` + `Attendees`).
- `admin` role validates/rejects submissions and can manually override scores.
- Leaderboard totals read from approved score records only.

---

## References

- [app-prd.md](app-prd.md) — Product requirements
- [api-spec.md](api-spec.md) — Full API specification
- [app-design.md](app-design.md) — UI/UX design + component model
- [app-handoff-checklist.md](app-handoff-checklist.md) — Infrastructure wiring steps
- [admin-procedures.md](admin-procedures.md) — Admin runbook
- [agents-and-skills.md](agents-and-skills.md) — AI agent inventory
- [App Service Easy Auth](https://learn.microsoft.com/azure/app-service/overview-authentication-authorization)
- [Express 5.x Documentation](https://expressjs.com/en/5x/api.html)
- [Azure Cosmos DB SDK for Node.js](https://learn.microsoft.com/azure/cosmos-db/nosql/sdk-nodejs)

---

[← Back to Documentation](README.md)
