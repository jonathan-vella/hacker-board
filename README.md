# HackerBoard

![HackerBoard hero banner](assets/readme-banner.svg)

Serverless microhack scoring dashboard — Azure Static Web Apps + managed Functions + Azure SQL Database.

![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Node](https://img.shields.io/badge/Node.js-20+-green)
![Azure](https://img.shields.io/badge/Azure-Static%20Web%20Apps-blue)
![Auth](https://img.shields.io/badge/Auth-GitHub%20OAuth-orange)
![DB](https://img.shields.io/badge/DB-Azure%20SQL%20Basic-0078D4)
![Docs](https://img.shields.io/badge/Docs-Polished-6f42c1)

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fjonathan-vella%2Fhacker-board%2Fmain%2Finfra%2Fazuredeploy.json)

## What It Does

Teams submit scores through a web form or JSON upload. Admins review and approve
submissions before they appear on the public leaderboard. The app also handles
attendee registration, random team assignment, and award presentation — all behind
GitHub OAuth.

## Architecture

```text
Azure Static Web Apps (Standard)
├── SPA Frontend (src/)
├── Managed Azure Functions (api/)
│   └── Node.js 20 LTS
├── GitHub OAuth (built-in SWA auth)
└── Azure SQL Database (Basic DTU)
    ├── Teams, Attendees, Scores
    ├── Submissions, Awards, Rubrics, Config
    └── Entra ID auth (no SQL passwords)
```

## Quick Start

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Set env vars for local SQL Server (e.g. Docker or Azure SQL)
export SQL_CONNECTION_STRING="Server=localhost;Database=hackerboard;..."

# Deploy schema (idempotent)
node scripts/deploy-schema.js

# Seed demo data
node scripts/seed-demo-data.js --reset

# Start local dev server (emulates auth + routing)
swa start src --api-location api

# Open http://localhost:4280
```

### Run Tests

```bash
cd api && npm test
```

### Prerequisites

- Node.js 20+
- [SWA CLI](https://github.com/Azure/static-web-apps-cli): `npm install -g @azure/static-web-apps-cli`
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4
- SQL Server (local Docker or Azure SQL) with `SQL_CONNECTION_STRING` env var

## Deploy Infrastructure

```powershell
cd infra
./deploy.ps1 `
  -CostCenter "microhack" `
  -TechnicalContact "team@contoso.com"
```

The deploying user (`az login` identity) is automatically configured as the
application administrator and assigned as the Microsoft Entra administrator
on the Azure SQL server. The script also runs the SQL schema migration automatically.

Alternatively, use the **Deploy to Azure** button in this README to deploy
via the Azure Portal — set `adminEmail` and `sqlAdminObjectId` to the deploying user's details.

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
├── .github/workflows/deploy-swa.yml   # CI/CD to Azure SWA
├── api/                                # Managed Azure Functions (Node.js)
├── src/                                # SPA Frontend
├── infra/                              # Bicep IaC templates + deploy script
│   ├── main.bicep                      # Root template
│   ├── deploy.ps1                      # Deployment script
│   └── modules/                        # AVM-based modules
├── docs/                               # Design docs, API spec, backlog
├── staticwebapp.config.json            # Auth, routes, security headers
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

Estimated cost: **~$9.05/month** (West Europe).

| Resource       | SKU           | Purpose               |
| -------------- | ------------- | --------------------- |
| Static Web App | Standard      | Frontend + Functions  |
| Azure SQL DB   | Basic (5 DTU) | Relational data store |
| App Insights   | —             | Telemetry             |
| Log Analytics  | PerGB2018     | Centralized logging   |

## License

MIT
