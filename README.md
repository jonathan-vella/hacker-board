# HackerBoard

![HackerBoard hero banner](assets/readme-banner.svg)

Microhack scoring dashboard — App Service for Linux Containers + ACR + Express + Cosmos DB NoSQL Serverless.

![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Node](https://img.shields.io/badge/Node.js-20+-green)
![Azure](https://img.shields.io/badge/Azure-App%20Service%20%2B%20ACR-blue)
![Auth](https://img.shields.io/badge/Auth-GitHub%20OAuth-orange)
![DB](https://img.shields.io/badge/DB-Cosmos%20DB%20NoSQL-0078D4)
![Docs](https://img.shields.io/badge/Docs-Polished-6f42c1)

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fjonathan-vella%2Fhacker-board%2Fmain%2Finfra%2Fazuredeploy.json)

## What It Does

Teams submit scores through a web form or JSON upload. Admins review and approve
submissions before they appear on the public leaderboard. The app also handles
attendee registration, random team assignment, and award presentation — all behind
GitHub OAuth.

## Architecture

```text
App Service for Linux Containers (B1)
├── SPA Frontend (src/)
├── Express 5.x API adapter (api/server.js)
│   └── Node.js 20 — port 8080
├── GitHub OAuth + Entra ID (App Service Easy Auth)
└── Azure Cosmos DB NoSQL (Serverless)
    ├── Teams, Attendees, Scores
    ├── Submissions, Awards, Rubrics, Flags
    └── Entra ID RBAC — no connection strings

Azure Container Registry (Basic) ← docker push
GitHub Actions → ACR → App Service (rolling deploy)
```

## Quick Start

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Seed demo data (requires COSMOS_ENDPOINT env var pointing to emulator or cloud)
node scripts/seed-demo-data.js --reset

# Start local dev server (serves frontend + API on port 8080)
cd api && npm start

# Open http://localhost:8080
```

Or run the full container:

```bash
docker build -t hacker-board:local .
docker run -p 8080:8080 -e COSMOS_ENDPOINT=https://localhost:8081 hacker-board:local
```

### Run Tests

```bash
npm run test:all
```

### Prerequisites

- Node.js 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for container builds)
- [Azure Cosmos DB Emulator](https://learn.microsoft.com/azure/cosmos-db/how-to-develop-emulator) or a cloud Cosmos DB endpoint

## Deploy Infrastructure

```powershell
cd infra
./deploy.ps1 `
  -CostCenter "microhack" `
  -TechnicalContact "team@contoso.com"
```

The deploying user (`az login` identity) is automatically configured as the
application administrator via Entra ID app roles.

Alternatively, use the **Deploy to Azure** button in this README to deploy
via the Azure Portal — set `GitHubOAuthClientId` and `GitHubOAuthClientSecret`
from your GitHub OAuth App.

See [docs/deployment-guide.md](docs/deployment-guide.md) for the full
end-to-end deployment guide (infra, OIDC, secrets, roles, table creation,
smoke testing). For the legacy pre-deploy checklist, see
[docs/app-handoff-checklist.md](docs/app-handoff-checklist.md).

## Features

| #   | Feature                       | Role   |
| --- | ----------------------------- | ------ |
| F1  | Team Score Submission Form    | Member |
| F2  | Live Leaderboard              | All    |
| F3  | Grading Display               | All    |
| F4  | Award Categories              | Admin  |
| F5  | GitHub OAuth Authentication   | All    |
| F6  | JSON Score Upload             | Member |
| F7  | Attendee Registration         | All    |
| F8  | Admin Validation & Override   | Admin  |
| F9  | Attendee Bulk Entry           | Admin  |
| F10 | Random Team Assignment        | Admin  |
| F11 | Configurable Rubric Templates | Admin  |

## API Endpoints

| Endpoint                    | Methods             | Auth          |
| --------------------------- | ------------------- | ------------- |
| `/api/teams`                | GET, POST, PUT, DEL | admin (write) |
| `/api/teams/assign`         | POST                | admin         |
| `/api/scores`               | GET, POST           | admin (write) |
| `/api/attendees`            | GET                 | admin         |
| `/api/attendees/me`         | GET, POST           | authenticated |
| `/api/attendees/bulk`       | POST                | admin         |
| `/api/awards`               | GET, POST, PUT      | admin (write) |
| `/api/upload`               | POST                | member        |
| `/api/submissions`          | GET                 | admin         |
| `/api/submissions/validate` | POST                | admin         |
| `/api/rubrics`              | GET, POST           | admin (write) |
| `/api/rubrics/active`       | GET                 | authenticated |

Full schemas in [docs/api-spec.md](docs/api-spec.md).

## Project Structure

```text
├── .github/workflows/deploy-app.yml   # GitHub Actions — Docker build → ACR → App Service
├── api/                                # Express 5.x API server (Node.js 20+)
│   └── server.js                       # Entry point: 13 routes + security headers
├── src/                                # SPA Frontend (vanilla JS, ES2022+)
├── Dockerfile                          # Node.js 20 Alpine container image
├── infra/                              # Bicep IaC templates + deploy script
│   ├── main.bicep                      # Root template
│   ├── deploy.ps1                      # Deployment script
│   └── modules/                        # AVM-based modules (ACR, App Service, Cosmos DB)
├── docs/                               # Design docs, API spec, backlog
└── README.md
```

## Documentation

| Document                                                       | Purpose                                               |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| [docs/app-prd.md](docs/app-prd.md)                             | Product requirements (F1-11)                          |
| [docs/api-spec.md](docs/api-spec.md)                           | Full API specification                                |
| [docs/openapi.yaml](docs/openapi.yaml)                         | OpenAPI 3.0 spec ([Swagger UI](docs/swagger-ui.html)) |
| [docs/app-design.md](docs/app-design.md)                       | UI/UX design + components                             |
| [docs/app-scaffold.md](docs/app-scaffold.md)                   | Folder structure guide                                |
| [docs/app-handoff-checklist.md](docs/app-handoff-checklist.md) | Infrastructure wiring                                 |
| [docs/admin-procedures.md](docs/admin-procedures.md)           | Admin runbook + role management                       |
| [docs/agents-and-skills.md](docs/agents-and-skills.md)         | AI agents, skills, orchestration                      |
| [docs/backlog.md](docs/backlog.md)                             | Project backlog + milestones                          |

## Infrastructure

Estimated cost: **~$15/month** (Central US, assuming low traffic).

| Resource           | SKU        | Purpose              |
| ------------------ | ---------- | -------------------- |
| App Service Plan   | B1 Linux   | Container hosting    |
| Container Registry | Basic      | Docker image storage |
| Cosmos DB NoSQL    | Serverless | All application data |
| App Insights       | —          | Telemetry            |
| Log Analytics      | PerGB2018  | Centralized logging  |

## License

MIT
