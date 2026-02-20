# HackerBoard — E2E Deployment Validation

![Type](https://img.shields.io/badge/Type-Test%20Protocol-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Platform](https://img.shields.io/badge/Platform-App%20Service%20%2B%20ACR-0078D4)

> Shared test protocol for validating both supported deployment paths: **Path A** (`deploy.ps1`) and **Path B** (Deploy to Azure button). Each path runs in its own disposable resource group.

## Disposable Resource Groups

| Path | Resource Group Pattern  | Deployment Method                     |
| ---- | ----------------------- | ------------------------------------- |
| A    | `hb-e2e-ps-<yyyyMMdd>`  | `infra/deploy.ps1`                    |
| B    | `hb-e2e-btn-<yyyyMMdd>` | ARM button → `infra/azuredeploy.json` |

## Required Evidence Per Run

Each path run MUST capture:

| Artifact                | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| Deployment ID/name      | Azure deployment name (e.g., `hacker-board-20260218-143022`)                 |
| Provisioning outputs    | `appServiceHostname`, `acrLoginServer`, `cosmosEndpoint`                     |
| Container image SHA     | Output of `docker push` or `az acr build` confirming image push succeeded    |
| Health check response   | `curl -fsS https://<appServiceHostname>/api/health` — must return `200`      |
| Teams endpoint response | `curl -i https://<appServiceHostname>/api/teams` — must return `200`, no 5xx |
| Role access validation  | Unauthenticated request to admin route → must return `401`/`403`             |
| Teardown confirmation   | `az group delete --name <rg> --yes --no-wait` + confirmation                 |

## Preflight Gate (Both Paths)

Before executing any path, verify:

- [ ] `infra/main.bicep` compiles cleanly: `az bicep build --file infra/main.bicep`
- [ ] `infra/azuredeploy.json` is in sync with `main.bicep` (rebuild if changed)
- [ ] Required parameters are available: `costCenter`, `technicalContact`
- [ ] Azure CLI is authenticated with Contributor access to target subscription (`az login`)
- [ ] The signed-in identity is the intended app admin and SQL Entra administrator

## Container Image — Test Environment Note

For E2E test environments you must push a container image to ACR before App Service can start:

```bash
# Build and push using ACR Tasks (no local Docker required)
az acr build --registry <acrLoginServer> --image hacker-board:latest .

# Then restart App Service to pull the latest image
az webapp restart --name app-hacker-board-prod --resource-group <rg>
```

If the container image is never pushed, App Service will return `503` from the default "No image" placeholder page.

## Path Execution Commands

### Path A — deploy.ps1

```powershell
$date = Get-Date -Format 'yyyyMMdd'
./infra/deploy.ps1 `
  -ResourceGroupName "hb-e2e-ps-$date" `
  -CostCenter "microhack" `
  -TechnicalContact "you@contoso.com" `
  -GitHubOAuthClientId "<github-oauth-app-client-id>" `
  -GitHubOAuthClientSecret "<github-oauth-app-client-secret>" `
  -Environment dev
```

> The signed-in `az login` identity is automatically the app admin via Entra ID app role assignment.
> After provisioning, push a container image to ACR and restart the App Service (see above).

### Path B — Deploy Button

1. Navigate to `README.md` and click **Deploy to Azure**
2. Fill parameters: `costCenter`, `technicalContact`, `GitHubOAuthClientId`,
   `GitHubOAuthClientSecret` (from your GitHub OAuth App)
3. After ARM deployment completes, collect outputs from Azure Portal:
   `appServiceHostname`, `acrLoginServer`, `cosmosEndpoint`
4. Push a container image to ACR and restart the App Service

> **Tip**: Find the deploying user's Entra Object ID with:
>
> ```bash
> az ad signed-in-user show --query id -o tsv
> ```

## Runtime Smoke Checks (Both Paths)

```bash
export APP_URL=https://<appServiceHostname>

# Health
curl -fsS $APP_URL/api/health

# Teams (unauthenticated — list is public)
curl -i $APP_URL/api/teams

# Admin route access control (expect 401)
curl -i $APP_URL/api/scores -X POST -H "Content-Type: application/json" -d '{}'
```

## Test Matrix

| Check                                        | Path A (PS) | Path B (Button) |
| -------------------------------------------- | ----------- | --------------- |
| Provisioning success                         |             |                 |
| All outputs present                          |             |                 |
| Container image pushed to ACR                |             |                 |
| App Service pulls image + starts (200)       |             |                 |
| `/api/health` → 200                          |             |                 |
| `/api/teams` → 200, no 5xx                   |             |                 |
| Deploying user has `admin` access            |             |                 |
| Easy Auth GitHub OAuth login succeeds        |             |                 |
| Admin route → 401 unauthenticated            |             |                 |
| `admin`/`member` role behaviour              |             |                 |
| Cosmos DB RBAC — no connection string errors |             |                 |
| Teardown complete                            |             |                 |

## Teardown

```bash
# After run — preserve logs/artifacts before deletion if the run failed
az group delete --name <rg-name> --yes --no-wait

# Only if data was seeded into a shared environment
node scripts/cleanup-app-data.js
```

---

[← Back to Documentation](README.md) | [Deployment Guide](deployment-guide.md) | [Backlog](backlog.md)
