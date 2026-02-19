# HackerBoard — E2E Deployment Validation

![Type](https://img.shields.io/badge/Type-Test%20Protocol-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Platform](https://img.shields.io/badge/Platform-Azure%20Static%20Web%20Apps-0078D4)

> Shared test protocol for validating both supported deployment paths: **Path A** (`deploy.ps1`) and **Path B** (Deploy to Azure button). Each path runs in its own disposable resource group.

## Disposable Resource Groups

| Path | Resource Group Pattern  | Deployment Method                     |
| ---- | ----------------------- | ------------------------------------- |
| A    | `hb-e2e-ps-<yyyyMMdd>`  | `infra/deploy.ps1`                    |
| B    | `hb-e2e-btn-<yyyyMMdd>` | ARM button → `infra/azuredeploy.json` |

## Required Evidence Per Run

Each path run MUST capture:

| Artifact                | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| Deployment ID/name      | Azure deployment name (e.g., `hacker-board-20260218-143022`)          |
| Provisioning outputs    | `swaHostname`, `swaName`, `sqlServerFqdn`, `sqlDatabaseName`          |
| Schema migration result | Exit code + output of `node scripts/deploy-schema.js`                 |
| Health check response   | `curl -fsS https://<swaHostname>/api/health` — must return `200`      |
| Teams endpoint response | `curl -i https://<swaHostname>/api/teams` — must return `200`, no 5xx |
| Role access validation  | Unauthenticated request to admin route → must return `401`/`403`      |
| Teardown confirmation   | `az group delete --name <rg> --yes --no-wait` + confirmation          |

## Preflight Gate (Both Paths)

Before executing any path, verify:

- [ ] `infra/main.bicep` compiles cleanly: `az bicep build --file infra/main.bicep`
- [ ] `infra/azuredeploy.json` is in sync with `main.bicep` (rebuild if changed)
- [ ] Required parameters are available: `costCenter`, `technicalContact`
- [ ] Azure CLI is authenticated with Contributor access to target subscription (`az login`)
- [ ] The signed-in identity is the intended app admin and SQL Entra administrator

## SQL Private Endpoint — Test Environment Constraint

When `enablePrivateEndpoint=true`, schema migration requires connectivity inside the VNet. For E2E test environments:

- Set `enablePrivateEndpoint=false` in both disposable test RGs
- Use `--parameters enablePrivateEndpoint=false` in Path A's `deploy.ps1` invocation
- This is expected behavior; private endpoints are for production only

## Path Execution Commands

### Path A — deploy.ps1

```powershell
$date = Get-Date -Format 'yyyyMMdd'
./infra/deploy.ps1 `
  -ResourceGroupName "hb-e2e-ps-$date" `
  -CostCenter "microhack" `
  -TechnicalContact "you@contoso.com" `
  -Environment dev
```

> The signed-in `az login` identity is automatically the app admin and SQL Entra administrator.
> Schema migration runs automatically unless `-SkipSchema` is passed.

### Path B — Deploy Button

1. Navigate to `README.md` and click **Deploy to Azure**
2. Fill parameters: `costCenter`, `technicalContact`, `enablePrivateEndpoint=false`; set `adminEmail` and `sqlAdminObjectId` to the deploying user's email and Entra OID
3. After ARM deployment completes, collect outputs from Azure Portal
4. Run `node scripts/deploy-schema.js` manually (set `SQL_SERVER_FQDN` and `SQL_DATABASE_NAME` from portal outputs)

> **Tip**: Find the deploying user's Entra Object ID with:
>
> ```bash
> az ad signed-in-user show --query id -o tsv
> ```

## Runtime Smoke Checks (Both Paths)

```bash
export APP_URL=https://<swaHostname>

# Health
curl -fsS $APP_URL/api/health

# Teams (unauthenticated — list is public)
curl -i $APP_URL/api/teams

# Admin route access control (expect 401)
curl -i $APP_URL/api/scores -X POST -H "Content-Type: application/json" -d '{}'
```

## Test Matrix

| Check                                     | Path A (PS) | Path B (Button) |
| ----------------------------------------- | ----------- | --------------- |
| Provisioning success                      |             |                 |
| All outputs present                       |             |                 |
| Schema migration success                  |             |                 |
| App deployment success                    |             |                 |
| `/api/health` → 200                       |             |                 |
| `/api/teams` → 200, no 5xx                |             |                 |
| Deploying user has `admin` access         |             |                 |
| Deploying user is SQL Entra administrator |             |                 |
| Admin route → 401 unauthenticated         |             |                 |
| `admin`/`member` role behaviour           |             |                 |
| Teardown complete                         |             |                 |

## Teardown

```bash
# After run — preserve logs/artifacts before deletion if the run failed
az group delete --name <rg-name> --yes --no-wait

# Only if data was seeded into a shared environment
node scripts/cleanup-app-data.js
```

---

[← Back to Documentation](README.md) | [Deployment Guide](deployment-guide.md) | [Backlog](backlog.md)
