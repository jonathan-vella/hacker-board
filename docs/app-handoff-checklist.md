# App Handoff Checklist — HackerBoard

<!-- markdownlint-disable MD060 -->

![Type](https://img.shields.io/badge/Type-Checklist-blue)
![Status](https://img.shields.io/badge/Status-Ready-brightgreen)
![Audience](https://img.shields.io/badge/Audience-Dev%20%2B%20Platform%20Team-green)

> Step-by-step instructions to deploy HackerBoard to the provisioned Azure App Service + ACR infrastructure and verify it is running correctly.

## Problem, Users, Value

| Item        | Summary                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Manual JSON handling and script-only scoring are hard to operate consistently during a live microhack.                                               |
| **Users**   | **Team members** submit only their own team scores. **Admins** validate submissions and can manually adjust published scores.                        |
| **Value**   | This handoff ensures the deployed app enforces role-safe submission and review, reducing facilitator overhead while keeping score changes auditable. |

---

## Prerequisites

> [!NOTE]
> Resource names below are deployment-specific examples for the `prod` environment. Replace with values from your own deployment if you used different parameters.

- [ ] Azure CLI installed and authenticated (`az login`)
- [ ] Docker installed and running locally
- [ ] GitHub CLI installed and authenticated (`gh auth login`)
- [ ] Access to subscription `noalz` (`00858ffc-dded-4f0f-8bbf-e17fff0d47d9`)
- [ ] Access to resource group `rg-hacker-board-prod` (Contributor role)
- [ ] Infrastructure provisioned via `infra/deploy.ps1` (see [Deployment Guide](deployment-guide.md))

## Deployed Infrastructure Reference

| Resource             | Name                                              | Type / SKU       |
| -------------------- | ------------------------------------------------- | ---------------- |
| Resource Group       | `rg-hacker-board-prod`                            | — (9 tags req'd) |
| Container Registry   | `crhackerboardprod`                               | ACR Basic        |
| App Service Plan     | `asp-hacker-board-prod`                           | B1 Linux         |
| Web App (Containers) | `app-hacker-board-prod`                           | Linux Container  |
| App URL              | `https://app-hacker-board-prod.azurewebsites.net` | —                |
| Cosmos DB            | `cosmos-hacker-board-prod`                        | NoSQL Serverless |
| Database             | `hackerboard`                                     | 6 containers     |
| App Insights         | `appi-hacker-board-prod`                          | —                |
| Log Analytics        | `law-hacker-board-prod`                           | PerGB2018        |
| Entra ID App         | `app-hacker-board-prod`                           | App Registration |

---

## Phase 1: Build and Push Container Image

### 1.1 — Authenticate to ACR

```bash
az acr login --name crhackerboardprod
```

### 1.2 — Build the Image

From the repository root:

```bash
docker build -t crhackerboardprod.azurecr.io/hacker-board:latest .
```

### 1.3 — Push to ACR

```bash
docker push crhackerboardprod.azurecr.io/hacker-board:latest
```

Alternatively, build entirely in the cloud with ACR Tasks (no local Docker required):

```bash
az acr build \
  --registry crhackerboardprod \
  --image hacker-board:latest \
  .
```

### 1.4 — Restart App Service

Force App Service to pull the newly pushed image:

```bash
az webapp restart \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod
```

Verify the image is running:

```bash
az webapp show \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "state" -o tsv
# Expected: Running
```

---

## Phase 2: Configure GitHub Actions

### 2.1 — Create a CI/CD Service Principal

```bash
SP_JSON=$(az ad sp create-for-rbac \
  --name "sp-hacker-board-cicd" \
  --role Contributor \
  --scopes "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-hacker-board-prod" \
  --sdk-auth)
```

Grant the service principal the `acrPush` role:

```bash
SP_OID=$(az ad sp list --display-name sp-hacker-board-cicd --query "[0].id" -o tsv)
ACR_ID=$(az acr show --name crhackerboardprod -g rg-hacker-board-prod --query id -o tsv)
az role assignment create --assignee "$SP_OID" --role AcrPush --scope "$ACR_ID"
```

### 2.2 — Store the Secret in GitHub

```bash
gh secret set AZURE_CREDENTIALS \
  --body "$SP_JSON" \
  --repo jonathan-vella/hacker-board
```

### 2.3 — Trigger the First CI/CD Run

```bash
# Manual trigger via GitHub CLI
gh workflow run "Build & Deploy" --repo jonathan-vella/hacker-board

# Monitor the run
gh run watch --repo jonathan-vella/hacker-board
```

---

## Phase 3: Verify App Service Configuration

### 3.1 — Verify App Settings

```bash
az webapp config appsettings list \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  -o table
```

Expected settings (set by `deploy.ps1`):

| Setting                                 | Expected Value                                              |
| --------------------------------------- | ----------------------------------------------------------- |
| `COSMOS_ENDPOINT`                       | `https://cosmos-hacker-board-prod.documents.azure.com:443/` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | InstrumentationKey=...                                      |
| `WEBSITE_PORT`                          | `8080`                                                      |

### 3.2 — Verify Easy Auth

```bash
az webapp auth show \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "properties.{enabled:enabled,unauthenticatedAction:globalValidation.unauthenticatedClientAction}" \
  -o table
```

Expected: `enabled = true`, `unauthenticatedAction = RedirectToLoginPage`.

### 3.3 — Verify Managed Identity Role Assignments

```bash
APP_MI=$(az webapp identity show \
  --name app-hacker-board-prod \
  -g rg-hacker-board-prod \
  --query principalId -o tsv)

# Cosmos DB RBAC role
az cosmosdb sql role assignment list \
  --account-name cosmos-hacker-board-prod \
  -g rg-hacker-board-prod \
  --query "[?principalId=='${APP_MI}'].roleDefinitionId" -o tsv

# ACR pull role
az role assignment list --assignee "$APP_MI" --role AcrPull -o table
```

---

## Phase 4: Configure User Roles

> **Default admin**: The Entra user who ran `deploy.ps1` is automatically assigned the `admin` Entra ID app role — no extra steps required for the deploying user.

### Verify Default Admin Access

1. Navigate to `https://app-hacker-board-prod.azurewebsites.net` and sign in with the deploying Entra account
2. Admin-only routes (`/#/review`, `/#/rubrics`, `/#/flags`, `/#/attendees`, `/#/assign`) should be accessible
3. The navigation bar should show admin links

### Invite Additional Admins

Additional admins are managed through Entra ID app role assignments:

```bash
APP_SP_OID=$(az ad sp list --display-name app-hacker-board-prod --query "[0].id" -o tsv)
ADMIN_ROLE_ID=$(az ad app list --display-name app-hacker-board-prod \
  --query "[0].appRoles[?value=='admin'].id | [0]" -o tsv)
USER_OID=$(az ad user show --id "organizer@contoso.com" --query id -o tsv)

az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/${APP_SP_OID}/appRoleAssignments" \
  --body "{\"principalId\":\"${USER_OID}\",\"resourceId\":\"${APP_SP_OID}\",\"appRoleId\":\"${ADMIN_ROLE_ID}\"}"
```

---

## Phase 5: Smoke Tests

### 5.1 — Authentication Flow

- [ ] Navigate to `https://app-hacker-board-prod.azurewebsites.net`
- [ ] Verify redirect to GitHub login via `/.auth/login/github`
- [ ] Login and verify redirect back to the app
- [ ] Verify `/.auth/me` returns user claims and roles
- [ ] Verify logout via `/.auth/logout`

### 5.2 — API Endpoints

```bash
APP_URL="https://app-hacker-board-prod.azurewebsites.net"

curl -s "${APP_URL}/api/health" | python3 -m json.tool
```

- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] `GET /api/teams` returns 200 (empty array initially)
- [ ] `GET /api/scores` returns 200
- [ ] `GET /api/awards` returns 200
- [ ] `GET /api/attendees` returns 200
- [ ] `GET /api/flags` returns feature flag states
- [ ] `POST /api/teams` creates a team (admin role — include auth cookie)
- [ ] `PUT /api/flags` updates feature flags (admin role)
- [ ] `POST /api/upload` accepts JSON file for own team (member role)
- [ ] `GET /api/submissions?status=Pending` returns queue (admin role)

### 5.3 — Role Enforcement

- [ ] Member cannot access admin-only endpoints (returns 401/403)
- [ ] Unauthenticated requests are redirected to `/.auth/login/github`

### 5.4 — Resource Health

```bash
# App Service state
az webapp show --name app-hacker-board-prod -g rg-hacker-board-prod --query state -o tsv

# Cosmos DB RBAC assignments
az cosmosdb sql role assignment list \
  --account-name cosmos-hacker-board-prod \
  -g rg-hacker-board-prod \
  --query "length(@)" -o tsv

# App Insights receiving telemetry
az monitor app-insights metrics show \
  --app appi-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --metric requests/count \
  --interval PT1H \
  --query "value.\"requests/count\".sum"
```

---

## Phase 6: Optional Steps

### Seed Demo Data

```bash
# Set the Cosmos DB endpoint (uses DefaultAzureCredential)
export COSMOS_ENDPOINT="https://cosmos-hacker-board-prod.documents.azure.com:443/"
node scripts/seed-demo-data.js
```

### Custom Domain

```bash
az webapp config hostname add \
  --webapp-name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --hostname leaderboard.yourdomain.com
```

Create a CNAME record pointing `leaderboard.yourdomain.com` to `app-hacker-board-prod.azurewebsites.net`. App Service provisions a free managed SSL certificate automatically.

---

## Completion Checklist

| #   | Task                                                 | Owner         | Status |
| --- | ---------------------------------------------------- | ------------- | ------ |
| 1   | GitHub OAuth App created with correct callback URL   | Platform team | ⬜     |
| 2   | Infrastructure provisioned via `deploy.ps1`          | Platform team | ⬜     |
| 3   | Container image built and pushed to ACR              | Dev team      | ⬜     |
| 4   | App Service restarted and showing `Running`          | Dev team      | ⬜     |
| 5   | `AZURE_CREDENTIALS` GitHub secret set                | Dev team      | ⬜     |
| 6   | CI/CD pipeline passes (build + deploy + smoke test)  | Dev team      | ⬜     |
| 7   | App settings verified (`COSMOS_ENDPOINT` present)    | Platform team | ⬜     |
| 8   | Easy Auth active (GitHub redirect works)             | Dev team      | ⬜     |
| 9   | Default admin can access all admin routes            | Platform team | ⬜     |
| 10  | API smoke tests passed (health + teams + scores)     | Dev team      | ⬜     |
| 11  | Role enforcement validated (401 for member on admin) | Dev team      | ⬜     |
| 12  | Custom domain configured (optional)                  | Platform team | ⬜     |

---

## References

- [Deployment Guide](deployment-guide.md) — Full provisioning walkthrough
- [API Specification](api-spec.md) — API endpoint contracts
- [Admin Procedures](admin-procedures.md) — Role management and event runbook
- [App Scaffold](app-scaffold.md) — Project structure
- [Azure App Service Easy Auth](https://learn.microsoft.com/azure/app-service/overview-authentication-authorization)
- [Azure Container Registry](https://learn.microsoft.com/azure/container-registry/container-registry-get-started-docker-cli)

---

[← Back to Documentation](README.md)
