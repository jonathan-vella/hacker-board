# App Scaffolding Guide — HackerBoard

![Type](https://img.shields.io/badge/Type-Scaffold-blue)
![Runtime](https://img.shields.io/badge/Runtime-Node.js%2020-green)
![Platform](https://img.shields.io/badge/Platform-Azure%20SWA-purple)

> Reference folder structure and setup guide for the hacker-board application repository.
> This is a template — adapt the frontend framework choice to your team's preference.

---

## Recommended Folder Structure

```
hacker-board-app/
├── .github/
│   └── workflows/
│       └── deploy-swa.yml          # GitHub Actions CI/CD (see handoff checklist)
├── api/                             # Managed Azure Functions (Node.js)
│   ├── host.json                    # Functions host configuration
│   ├── package.json                 # API dependencies (@azure/data-tables, etc.)
│   ├── teams/
│   │   ├── function.json
│   │   └── index.js                 # GET/POST/PUT/DELETE /api/teams
│   ├── scores/
│   │   ├── function.json
│   │   └── index.js                 # GET/POST /api/scores (admin override writes)
│   ├── submissions/
│   │   ├── function.json
│   │   └── index.js                 # GET /api/submissions (admin queue)
│   ├── submissions-validate/
│   │   ├── function.json
│   │   └── index.js                 # POST /api/submissions/validate
│   ├── awards/
│   │   ├── function.json
│   │   └── index.js                 # GET/POST/PUT /api/awards
│   ├── attendees/
│   │   ├── function.json
│   │   └── index.js                 # GET /api/attendees (admin), GET/POST /api/attendees/me
│   ├── attendees-bulk/
│   │   ├── function.json
│   │   └── index.js                 # POST /api/attendees/bulk (admin bulk import, F9)
│   ├── teams-assign/
│   │   ├── function.json
│   │   └── index.js                 # POST /api/teams/assign (random assignment, F10)
│   ├── rubrics/
│   │   ├── function.json
│   │   └── index.js                 # GET/POST /api/rubrics, GET /api/rubrics/active (F11)
│   ├── upload/
│   │   ├── function.json
│   │   └── index.js                 # POST /api/upload (JSON score import)
│   └── shared/
│       ├── auth.js                  # getClientPrincipal(), requireRole() helpers
│       ├── tables.js                # TableClient factory (managed identity)
│       ├── errors.js                # Standardised error response builder
│       └── rubricParser.js          # Markdown → rubric JSON parser
├── src/                             # SPA Frontend
│   ├── index.html                   # Entry point
│   ├── styles/
│   │   └── main.css
│   ├── components/
│   │   ├── Leaderboard.js           # F2: Ranked team table
│   │   ├── ScoreSubmission.js       # F1: Team score submission form (member)
│   │   ├── TeamDetail.js            # Score breakdown per team
│   │   ├── SubmissionStatus.js      # Member submission status and history
│   │   ├── AdminReviewQueue.js      # F8: Admin approval/rejection queue
│   │   ├── ManualOverride.js        # F8: Admin manual score correction
│   │   ├── Awards.js                # F4: Award display + assignment (admin write)
│   │   ├── Registration.js          # F7: Attendee profile form
│   │   ├── AttendeeBulkEntry.js     # F9: Admin bulk attendee import
│   │   ├── TeamAssignment.js        # F10: Admin random team assignment
│   │   ├── TeamRoster.js            # F10: Team ↔ attendee display grid
│   │   ├── RubricManager.js         # F11: Admin rubric list + activate/archive
│   │   ├── RubricUpload.js          # F11: Drag-and-drop rubric.md upload
│   │   ├── RubricPreview.js         # F11: Parsed rubric preview before activation
│   │   ├── UploadScores.js          # F6: Own-team JSON upload
│   │   └── Navigation.js            # Nav bar with role-aware links
│   ├── services/
│   │   ├── api.js                   # fetch() wrappers for /api/* endpoints
│   │   ├── auth.js                  # /.auth/me client helper
│   │   └── rubric.js                # Rubric service (fetch active, parse, cache)
│   ├── data/
│   │   └── defaultRubric.js         # Default 105+25 rubric for first-use bootstrap
│   └── app.js                       # SPA router + app shell
├── staticwebapp.config.json         # Auth, routes, headers (from this repo)
├── package.json                     # Frontend dependencies + scripts
├── .gitignore
└── README.md
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
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@azure/data-tables": "^13.3.0",
    "@azure/identity": "^4.9.0"
  }
}
```

### `api/shared/auth.js` — Auth Helpers

```javascript
function getClientPrincipal(req) {
  const header = req.headers["x-ms-client-principal"];
  if (!header) return null;
  const encoded = Buffer.from(header, "base64");
  return JSON.parse(encoded.toString("ascii"));
}

function requireRole(req, role) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userRoles.includes(role)) {
    return {
      status: 403,
      body: {
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      },
    };
  }
  return null;
}

module.exports = { getClientPrincipal, requireRole };
```

### `api/shared/tables.js` — Table Client Factory

```javascript
const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME;
const credential = new DefaultAzureCredential();

function getTableClient(tableName) {
  const url = `https://${STORAGE_ACCOUNT}.table.core.windows.net`;
  return new TableClient(url, tableName, credential);
}

module.exports = { getTableClient };
```

### `api/teams/function.json` — Example Binding

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post", "put", "delete"],
      "route": "teams"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

> `authLevel: "anonymous"` is correct — SWA handles auth at the proxy layer via `staticwebapp.config.json`. Functions never receive unauthenticated traffic.

---

## Local Development

### Prerequisites

- Node.js 20+
- [Azure Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli): `npm install -g @azure/static-web-apps-cli`
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4

### Setup

```bash
# Clone and install
git clone <app-repo-url>
cd hacker-board-app

# Install frontend dependencies
npm install

# Install API dependencies
cd api && npm install && cd ..

# Run locally with SWA CLI (emulates auth + routing)
swa start src --api-location api
```

The SWA CLI:

- Serves the frontend from `src/`
- Proxies `/api/*` to locally running Azure Functions
- Emulates auth at `/.auth/login/github` (mock user context)
- Applies `staticwebapp.config.json` routing rules

### Environment Variables for Local Dev

Create `api/local.settings.json` (**do not commit**):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_ACCOUNT_NAME": "stteamleadpromn2ksi",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": ""
  }
}
```

Add to `.gitignore`:

```
api/local.settings.json
node_modules/
dist/
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
  "name": "hacker-board-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "swa start src --api-location api",
    "build": "echo 'No build step for vanilla JS'",
    "test": "echo 'No tests configured yet'",
    "lint": "echo 'Add ESLint configuration'"
  },
  "devDependencies": {
    "@azure/static-web-apps-cli": "^2.0.0"
  }
}
```

---

## Role and Scope Enforcement

Implement API authorization and validation with these invariants:

- `member` role can submit uploads only for their own team.
- Team identity is resolved server-side from attendee profile (`/.auth/me` + `Attendees`).
- `admin` role validates/rejects submissions and can manually override scores.
- Leaderboard totals read from approved score records only.

## Starter `README.md` for the App Repo

```markdown
# HackerBoard App

Microhack scoring dashboard — Azure Static Web Apps + managed Functions + Table Storage.

## Quick Start

\`\`\`bash
npm install
cd api && npm install && cd ..
swa start src --api-location api
\`\`\`

## Deployment

Pushes to `main` trigger automatic deployment via GitHub Actions.

## Documentation

- [Product Requirements](../../agent-output/hacker-board/app/app-prd.md)
- [API Specification](../../agent-output/hacker-board/app/api-spec.md)
- [Handoff Checklist](../../agent-output/hacker-board/app/app-handoff-checklist.md)
```

---

## References

- [app-prd.md](./app-prd.md) — Product requirements
- [api-spec.md](./api-spec.md) — Full API specification
- [app-handoff-checklist.md](./app-handoff-checklist.md) — Infrastructure wiring steps
- [staticwebapp.config.json](./staticwebapp.config.json) — Auth and route configuration
- [SWA CLI Documentation](https://azure.github.io/static-web-apps-cli/)
- [Azure Functions Node.js Developer Guide](https://learn.microsoft.com/azure/azure-functions/functions-reference-node)
- [Azure Tables SDK](https://learn.microsoft.com/javascript/api/@azure/data-tables/)
