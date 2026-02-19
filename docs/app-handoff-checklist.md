# App Handoff Checklist — HackerBoard

<!-- markdownlint-disable MD060 -->

![Type](https://img.shields.io/badge/Type-Checklist-blue)
![Status](https://img.shields.io/badge/Status-Ready-brightgreen)
![Audience](https://img.shields.io/badge/Audience-Dev%20%2B%20Platform%20Team-green)

> Step-by-step instructions to wire a new application repository to the deployed Azure Static Web Apps infrastructure.

## Problem, Users, Value

| Item        | Summary                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Manual JSON handling and script-only scoring are hard to operate consistently during a live microhack.                                               |
| **Users**   | **Team members** submit only their own team scores. **Admins** validate submissions and can manually adjust published scores.                        |
| **Value**   | This handoff ensures the deployed app enforces role-safe submission and review, reducing facilitator overhead while keeping score changes auditable. |

---

## Prerequisites

> [!NOTE]
> Subscription IDs, storage account names, and SWA hostnames below are **deployment-specific examples**. Replace them with values from your own deployment artifacts.

- [ ] Azure CLI installed and authenticated (`az login`)
- [ ] GitHub CLI installed and authenticated (`gh auth login`)
- [ ] Access to subscription `noalz` (`00858ffc-dded-4f0f-8bbf-e17fff0d47d9`)
- [ ] Access to resource group `rg-hacker-board-prod` (Contributor role)
- [ ] A new GitHub repository for the app code (or an existing one)

## Deployed Infrastructure Reference

| Resource       | Name                                              | Type             |
| -------------- | ------------------------------------------------- | ---------------- |
| Resource Group | `rg-hacker-board-prod`                            | — (9 tags req’d) |
| Static Web App | `swa-hacker-board-prod`                           | Standard         |
| Cosmos DB      | `cosmos-hacker-board-prod`                        | NoSQL Serverless |
| Database       | `hackerboard`                                     | 6 containers     |
| App Insights   | `appi-hacker-board-prod`                          | —                |
| Log Analytics  | `law-hacker-board-prod`                           | PerGB2018        |
| SWA URL        | `https://<your-swa-hostname>.azurestaticapps.net` | —                |
| Entra ID App   | `app-hacker-board-prod`                           | App Registration |

---

## Phase 1: Repository Setup

### 1.1 — Create the App Repository

```bash
gh repo create <org>/hacker-board-app --public --clone
cd hacker-board-app
```

### 1.2 — Initialize Project Structure

See [app-scaffold.md](./app-scaffold.md) for the recommended folder layout. At minimum:

```text
├── src/                  # SPA frontend (React, Svelte, or vanilla)
├── api/                  # Azure Functions (Node.js, managed by SWA)
│   ├── teams/
│   ├── scores/
│   ├── awards/
│   ├── attendees/
│   └── upload/
├── staticwebapp.config.json
├── package.json
└── README.md
```

### 1.3 — Copy Configuration Files

Copy from this repo into the new app repo:

```bash
cp agent-output/hacker-board/app/staticwebapp.config.json <app-repo>/staticwebapp.config.json
```

---

## Phase 2: Link App Repo to Static Web App

### 2.1 — Get the SWA Deployment Token

```bash
az staticwebapp secrets list \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --query "properties.apiKey" -o tsv
```

Store this as a GitHub Actions secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`.

### 2.2 — Set the Secret in the App Repo

```bash
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN \
  --repo <org>/hacker-board-app \
  --body "<token-from-step-2.1>"
```

### 2.3 — Create GitHub Actions Workflow

Create `.github/workflows/deploy-swa.yml` in the app repo:

```yaml
name: Deploy to Azure Static Web Apps

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v4

      - name: Build and Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: /
          api_location: api
          output_location: dist

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close PR Environment
    steps:
      - name: Close Pull Request
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: close
```

> Adjust `app_location`, `api_location`, and `output_location` based on your framework's build output directory.

---

## Phase 3: Configure Authentication & Routing

### 3.1 — Deploy `staticwebapp.config.json`

The [staticwebapp.config.json](../staticwebapp.config.json) file in the repository root defines:

- GitHub as the only auth provider (Google/Twitter disabled)
- All routes require authentication (no anonymous access)
- Role-based route guards (admin vs member)
- SPA navigation fallback
- Custom error pages

Place this file at the **root** of your app repo (same level as `package.json`).

### 3.2 — Assign User Roles

> **Default admin**: The Entra user who ran the deployment is automatically
> configured with the `admin` role — no invitation step required for the deploying user.

To invite additional admins or team members, use the Azure Portal or CLI:

In the Azure Portal:

1. Navigate to `stapp-hacker-board-prod` → **Role management**
2. Invite additional facilitators with the `admin` role (optional)
3. Invite participants with the `member` role

Or via CLI:

```bash
# Invite an admin
az staticwebapp users invite \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --authentication-provider "github" \
  --user-details "<github-username>" \
  --role "admin" \
  --domain "<your-swa-hostname>.azurestaticapps.net"

# Invite a member
az staticwebapp users invite \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --authentication-provider "github" \
  --user-details "<github-username>" \
  --role "member" \
  --domain "<your-swa-hostname>.azurestaticapps.net"
```

---

## Phase 4: Configure Managed Identity & Storage Access

### 4.1 — Get the SWA Managed Identity

The SWA has a system-assigned managed identity created during deployment. Get its principal ID:

```bash
az staticwebapp show \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --query "identity.principalId" -o tsv
```

### 4.2 — Assign Storage Table Data Contributor Role

Shared key access is disabled on the storage account. The API Functions must use managed identity:

```bash
STORAGE_ID=$(az storage account show \
  --name "stteamleadpromn2ksi" \
  --resource-group "rg-hacker-board-prod" \
  --query "id" -o tsv)

PRINCIPAL_ID=$(az staticwebapp show \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --query "identity.principalId" -o tsv)

az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Storage Table Data Contributor" \
  --scope "$STORAGE_ID"
```

### 4.3 — Create Table Storage Tables

The storage account is deployed but tables must be created:

```bash
az storage table create --name Teams \
  --account-name "stteamleadpromn2ksi" \
  --auth-mode login

az storage table create --name Attendees \
  --account-name "stteamleadpromn2ksi" \
  --auth-mode login

az storage table create --name Scores \
  --account-name "stteamleadpromn2ksi" \
  --auth-mode login

az storage table create --name Awards \
  --account-name "stteamleadpromn2ksi" \
  --auth-mode login

az storage table create --name Submissions \
  --account-name "stteamleadpromn2ksi" \
  --auth-mode login

az storage table create --name Rubrics \
  --account-name "stteamleadpromn2ksi" \
  --auth-mode login
```

---

## Phase 5: Configure App Settings

### 5.1 — Set SWA Application Settings

These environment variables are available to the managed Functions at runtime:

```bash
az staticwebapp appsettings set \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --setting-names \
    STORAGE_ACCOUNT_NAME="stteamleadpromn2ksi" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=f3d2348a-616b-436d-9914-aab8e046a3ea;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/;LiveEndpoint=https://westeurope.livediagnostics.monitor.azure.com/;ApplicationId=e6b79597-68b9-44e7-83d1-20c2cfad6ecb"
```

### 5.2 — Verify Settings

```bash
az staticwebapp appsettings list \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod"
```

---

## Phase 6: Smoke Tests

### 6.1 — Authentication Flow

- [ ] Navigate to `https://<your-swa-hostname>.azurestaticapps.net`
- [ ] Verify redirect to GitHub login
- [ ] Login and verify redirect back to the app
- [ ] Verify `/.auth/me` returns user claims and roles
- [ ] Verify logout via `/.auth/logout`

### 6.2 — API Endpoints

- [ ] `GET /api/teams` returns 200 (empty array initially)
- [ ] `POST /api/teams` creates a team (admin role)
- [ ] `GET /api/scores` returns 200
- [ ] `POST /api/scores` performs manual score override (admin role)
- [ ] `GET /api/awards` returns 200
- [ ] `GET /api/attendees` returns 200
- [ ] `POST /api/upload` accepts JSON file for own team (member role)
- [ ] `GET /api/submissions?status=Pending` returns queue (admin role)
- [ ] `POST /api/submissions/validate` approves or rejects (admin role)
- [ ] `GET /api/rubrics` returns 200 (rubric listing)
- [ ] `POST /api/rubrics` uploads a rubric (admin role)
- [ ] `GET /api/rubrics/active` returns active rubric configuration
- [ ] `GET /api/flags` returns feature flag states
- [ ] `PUT /api/flags` updates feature flags (admin role)

### 6.3 — Role Enforcement

- [ ] Member cannot access admin-only endpoints (returns 401/403)
- [ ] Anonymous user is redirected to login (never sees content)

### 6.4 — Resource Health

```bash
# SWA endpoint reachability
curl -sI https://<your-swa-hostname>.azurestaticapps.net | head -5

# Storage account accessible
az storage table list \
  --account-name "stteamleadpromn2ksi" \
  --auth-mode login

# App Insights receiving telemetry
az monitor app-insights metrics show \
  --app "appi-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --metric "requests/count" \
  --interval PT1H
```

---

## Phase 7: Optional — Custom Domain

```bash
# Add custom domain
az staticwebapp hostname set \
  --name "stapp-hacker-board-prod" \
  --resource-group "rg-hacker-board-prod" \
  --hostname "leaderboard.yourdomain.com"
```

Requires a CNAME record pointing `leaderboard.yourdomain.com` → `<your-swa-hostname>.azurestaticapps.net`. SWA provisions a free managed SSL certificate automatically.

---

## Completion Checklist

| #   | Task                                         | Owner         | Status |
| --- | -------------------------------------------- | ------------- | ------ |
| 1   | App repo created                             | Dev team      | ✅     |
| 2   | SWA deployment token stored as GitHub secret | Dev team      | ⬜     |
| 3   | GitHub Actions workflow created              | Dev team      | ✅     |
| 4   | `staticwebapp.config.json` deployed          | Dev team      | ✅     |
| 5   | User roles assigned (admin/member)           | Platform team | ⬜     |
| 6   | Managed identity RBAC configured             | Platform team | ⬜     |
| 7   | Table Storage tables created                 | Platform team | ⬜     |
| 8   | App settings configured                      | Platform team | ⬜     |
| 9   | Auth smoke test passed                       | Dev team      | ⬜     |
| 10  | API smoke tests passed                       | Dev team      | ⬜     |
| 11  | Role enforcement validated                   | Dev team      | ⬜     |
| 12  | Custom domain configured (optional)          | Platform team | ⬜     |

---

## References

- [app-prd.md](./app-prd.md) — Product requirements
- [api-spec.md](./api-spec.md) — API specification
- [staticwebapp.config.json](../staticwebapp.config.json) — Auth and route config
- [app-scaffold.md](./app-scaffold.md) — Recommended project structure
- [SWA Deployment Docs](https://learn.microsoft.com/azure/static-web-apps/getting-started)
- [SWA GitHub Actions](https://learn.microsoft.com/azure/static-web-apps/build-configuration)
- [SWA Role Management](https://learn.microsoft.com/azure/static-web-apps/authentication-authorization#role-management)
- [Azure Table Storage SDK (JS)](https://learn.microsoft.com/javascript/api/@azure/data-tables/)

---

[← Back to Documentation](README.md)
