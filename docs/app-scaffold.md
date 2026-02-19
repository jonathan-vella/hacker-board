# App Scaffolding Guide — HackerBoard

![Type](https://img.shields.io/badge/Type-Guide-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Runtime](https://img.shields.io/badge/Runtime-Node.js%2020-green)
![Platform](https://img.shields.io/badge/Platform-Azure%20SWA-purple)

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
│   ├── agents/                      # 7 VS Code custom agents
│   │   ├── hackerboard-conductor.agent.md   # Master orchestrator
│   │   ├── task-planner.agent.md            # Research & dependency analysis
│   │   ├── azure-architect.agent.md         # WAF architecture review
│   │   ├── implementation-planner.agent.md  # Structured implementation plans
│   │   ├── security-reviewer.agent.md       # OWASP & Zero Trust review
│   │   ├── ux-designer.agent.md             # UX/UI & accessibility review
│   │   └── bicep-avm.agent.md               # Bicep IaC with AVM
│   ├── instructions/                # 14 file-type-specific coding rules
│   ├── skills/                      # 3 reusable skills
│   │   ├── docs-writer/SKILL.md
│   │   ├── git-commit/SKILL.md
│   │   └── github-operations/SKILL.md
│   ├── workflows/
│   │   └── deploy-swa.yml           # GitHub Actions CI/CD
│   └── copilot-instructions.md      # Global Copilot custom instructions
├── .vscode/
│   └── extensions.json              # Recommended VS Code extensions
├── api/                             # Azure Functions v4 (Node.js 20+, ESM)
│   ├── host.json                    # Functions host configuration
│   ├── package.json                 # API dependencies
│   ├── vitest.config.js             # API test config
│   ├── shared/                      # Shared helpers
│   │   ├── auth.js                  # getClientPrincipal(), requireRole()
│   │   ├── errors.js                # Structured error response builder
│   │   ├── featureFlags.js          # Feature flag reader
│   │   ├── logger.js                # Structured logging
│   │   ├── rubricParser.js          # Markdown → rubric JSON parser
│   │   └── tables.js                # TableClient factory (conn string or MI)
│   ├── src/functions/               # v4 HTTP-triggered functions (1 per file)
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
│       ├── app-insights.bicep
│       ├── log-analytics.bicep
│       ├── static-web-app.bicep
│       └── storage.bicep
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
├── package.json                     # Root dependencies + scripts
├── staticwebapp.config.json         # Auth, routes, security headers
├── vitest.config.js                 # Frontend DOM test config (happy-dom)
└── README.md                        # Repository README
```

---

## Key Files Explained

### `api/host.json` — Functions Host Config

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

### `api/package.json` — API Dependencies

```json
{
  "name": "hacker-board-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/functions/*.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@azure/cosmos": "^4.2.0",
    "@azure/functions": "^4.11.2",
    "@azure/identity": "^4.9.0"
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

### Azure Functions v4 Endpoint Pattern

Each endpoint uses the v4 programming model — a single file registers one or more HTTP triggers:

```javascript
import { app } from "@azure/functions";
import { requireRole } from "../../shared/auth.js";
import { getContainer } from "../../shared/cosmos.js";

app.http("teams-get", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "teams",
  handler: async (req, context) => {
    const container = getContainer("teams");
    const { resources } = await container.items
      .query("SELECT * FROM c")
      .fetchAll();
    return { jsonBody: resources };
  },
});
```

> `authLevel: "anonymous"` is correct — SWA handles auth at the proxy layer via `staticwebapp.config.json`. Functions never receive unauthenticated traffic for protected routes.

---

## Local Development

### Prerequisites

- Node.js 20+
- [Azure Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli): `npm install -g @azure/static-web-apps-cli`
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4
- [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) for local blob/queue storage (Functions runtime)
- [Azure Cosmos DB Emulator](https://learn.microsoft.com/azure/cosmos-db/how-to-develop-emulator) for local Cosmos DB

> All prerequisites are pre-installed in the dev container (`.devcontainer/`).

### Setup

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Start Cosmos DB emulator (or use cloud endpoint)
# See: https://learn.microsoft.com/azure/cosmos-db/how-to-develop-emulator

# Seed demo data
node scripts/seed-demo-data.js --reset

# Run locally with SWA CLI (emulates auth + routing)
swa start src --api-location api
```

The SWA CLI:

- Serves the frontend from `src/`
- Proxies `/api/*` to locally running Azure Functions
- Emulates auth at `/.auth/login/github` (mock user context)
- Applies `staticwebapp.config.json` routing rules

### Environment Variables for Local Dev

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Create `api/local.settings.json` (**do not commit**):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_ENDPOINT": "https://localhost:8081",
    "COSMOS_DB_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
  }
}
```

---

## Frontend Framework Options

The scaffold above uses vanilla JS for simplicity. For a richer developer experience, consider:

| Framework                 | Build Output      | `output_location` for SWA |
| ------------------------- | ----------------- | ------------------------- |
| Vanilla JS/HTML           | `src/` (no build) | `src`                     |
| React (Vite)              | `dist/`           | `dist`                    |
| Svelte (SvelteKit static) | `build/`          | `build`                   |
| Vue (Vite)                | `dist/`           | `dist`                    |

Adjust the `output_location` in your GitHub Actions workflow and SWA config accordingly.

---

## `package.json` Scripts (Root)

```json
{
  "scripts": {
    "start": "swa start src --api-location api",
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
- [SWA CLI Documentation](https://azure.github.io/static-web-apps-cli/)
- [Azure Functions Node.js Developer Guide](https://learn.microsoft.com/azure/azure-functions/functions-reference-node)
- [Azure Tables SDK](https://learn.microsoft.com/javascript/api/@azure/data-tables/)

---

[← Back to Documentation](README.md)
