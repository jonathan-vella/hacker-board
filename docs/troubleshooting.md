# HackerBoard — Troubleshooting

![Type](https://img.shields.io/badge/Type-Troubleshooting-blue)
![Updated](https://img.shields.io/badge/Updated-2026--02--23-lightgrey)

---

## Table of Contents

- [Deployment Issues](#deployment-issues)
- [Authentication Issues](#authentication-issues)
- [Application Errors](#application-errors)
- [CI/CD Issues](#cicd-issues)
- [Cosmos DB Issues](#cosmos-db-issues)
- [Diagnostics Commands](#diagnostics-commands)

---

## Deployment Issues

### `deploy.ps1` fails — "Not logged into Azure"

```
❌ Not logged into Azure. Run 'az login --use-device-code' first.
```

**Fix**: Run `az login --use-device-code` and complete the browser authentication. Ensure MFA is satisfied — the subscription governance policy requires it for write operations.

---

### `deploy.ps1` fails — "ARM token expired"

```
❌ Azure CLI token expired or missing from MSAL cache.
```

**Fix**: `az account show` may report success even when the ARM token is stale. Run `az login --use-device-code` again to refresh the full token. Then retry.

---

### Deployment fails — Resource group tag policy denied

```
RequestDisallowedByPolicy: Resource was disallowed by policy.
```

**Cause**: The subscription has a Deny policy requiring 9 mandatory tags on new resource groups. The `deploy.ps1` script sets all 9 tags automatically. If you ran Bicep or `az group create` manually, the tags were missing.

**Fix**: Always deploy via `deploy.ps1`. It passes all required tags:
`environment`, `owner`, `costcenter`, `application`, `workload`, `sla`, `backup-policy`, `maint-window`, `tech-contact`.

---

### Deployment fails — PremiumV3 quota

```
Deployment failed — No hardware for size Premium_V3 in centralus
```

**Cause**: The subscription has zero P1v3 quota in `centralus`.

**Fix**: The Bicep template uses S1 (Standard), not P1v3. Verify `infra/modules/app-service.bicep` has:

```bicep
skuName: 'S1'
```

If you modified the template to use P1v3, revert it.

---

### App Service shows container start error after deploy

**Cause**: No container image exists in ACR yet. App Service cannot start without an image.

**Fix**: Build and push the image (Step 3 of the deployment guide):

```bash
az acr build --registry crhackerboardprod --image hacker-board:latest .
```

Then restart the app:

```bash
az webapp restart --name app-hacker-board-prod --resource-group rg-hacker-board-prod
```

---

## Authentication Issues

### GitHub OAuth redirects fail / "Redirect URI mismatch"

**Cause**: The callback URL registered in the GitHub OAuth App does not match the App Service hostname exactly.

**Fix**: Go to your GitHub OAuth App settings and verify the **Authorization callback URL** is:

```
https://app-hacker-board-prod.azurewebsites.net/.auth/login/github/callback
```

If using a custom domain, the callback must match that domain — not the `.azurewebsites.net` address.

---

### Users get redirected to sign-in on every page load

**Cause**: The App auth session cookie is not being set. Common reasons:

- Browser is blocking third-party cookies
- Clock skew between client and server > 5 minutes

**Fix**: Check browser cookie settings. The auth cookie requires `SameSite=Lax` — ensure the browser is not in a mode that blocks it. Verify `/api/health` returns 200 (app is running) before testing OAuth.

---

### Admin user cannot access admin pages

**Cause**: The user's GitHub username is not in the `ADMIN_USERS` app setting, or it was entered with the wrong format.

**Fix**: The format must be `github:<username>` (lowercase, exact match). Verify the app setting:

```bash
az webapp config appsettings list \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "[?name=='ADMIN_USERS']"
```

To update, re-run `deploy.ps1` with the corrected `-AdminUsers` value.

---

## Application Errors

### `/api/health` returns 500

**Cause**: The app is running but cannot connect to Cosmos DB.

**Diagnosis**:

```bash
# Check Cosmos RBAC assignments
az cosmosdb sql role assignment list \
  --account-name cosmos-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "length(@)"

# Check COSMOS_ENDPOINT app setting is present
az webapp config appsettings list \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "[?name=='COSMOS_ENDPOINT']"
```

**Fix**: If RBAC assignments are missing, re-run `deploy.ps1` — it reassigns them. If `COSMOS_ENDPOINT` is missing, re-run `deploy.ps1`.

---

### `/api/health` returns 503 or connection timeout

**Cause**: Container is still starting up (cold start, or pulling a new image).

**Fix**: Wait 60 seconds and retry. Check logs:

```bash
az webapp log tail \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod
```

If the container keeps restarting, check for application errors in the logs.

---

### Cosmos DB connection refused / `ECONNREFUSED`

**Cause**: The Private Endpoint or VNet integration is not routing correctly.

**Diagnosis**:

```bash
# Check Private Endpoint provisioning state
az network private-endpoint show \
  --name pep-cosmos-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "provisioningState"

# Check VNet integration
az webapp vnet-integration list \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod
```

Both should return `Succeeded` / show an integration. If not, re-run `deploy.ps1` to reconcile.

---

### `disableLocalAuth` is not `true` after deploy

**Cause**: The `ModifyCosmosDBLocalAuth` governance policy applies asynchronously — there may be a delay of a few minutes after resource creation before it remediates.

**Fix**: Wait 5 minutes and check again:

```bash
az cosmosdb show \
  --name cosmos-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "disableLocalAuth"
```

The Bicep template also sets this explicitly. If it remains `false` after 10 minutes, re-run `deploy.ps1`.

---

## CI/CD Issues

### Workflow fails — `AZURE_CREDENTIALS` error

**Cause**: The `AZURE_CREDENTIALS` GitHub secret is missing, malformed, or the service principal is expired.

**Fix**: Re-create the service principal and update the secret:

```bash
SP_JSON=$(az ad sp create-for-rbac \
  --name "sp-hacker-board-cicd" \
  --role Contributor \
  --scopes "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-hacker-board-prod" \
  --sdk-auth)

gh secret set AZURE_CREDENTIALS \
  --repo jonathan-vella/hacker-board \
  --body "$SP_JSON"
```

---

### Workflow fails — ACR push denied

**Cause**: The service principal is missing the `AcrPush` role on the ACR.

**Fix**:

```bash
SP_CLIENT_ID="<service-principal-client-id>"
ACR_ID=$(az acr show --name crhackerboardprod -g rg-hacker-board-prod --query id -o tsv)

az role assignment create \
  --assignee "$SP_CLIENT_ID" \
  --role AcrPush \
  --scope "$ACR_ID"
```

---

### Workflow fails — Trivy CVE block

**Cause**: Trivy detected HIGH severity CVEs in the application dependencies.

**Fix**:

```bash
# In the api/ directory
cd api && npm audit fix

# In the root (front-end dependencies)
npm audit fix
```

Push the fix to `main` to trigger a new build. If the vulnerability has no fix yet, review and apply `npm audit fix --force` with care, or add a Trivy suppression with justification.

---

## Cosmos DB Issues

### API calls succeed but data is not appearing

**Cause**: The Cosmos DB database or containers were not created by the deployment.

**Diagnosis**:

```bash
az cosmosdb sql database list \
  --account-name cosmos-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "[].name"

az cosmosdb sql container list \
  --account-name cosmos-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --database-name hackerboard \
  --query "[].name"
```

Expected containers: `teams`, `attendees`, `scores`, `submissions`, `rubrics`, `flags`.

**Fix**: If containers are missing, re-run `deploy.ps1`.

---

## Diagnostics Commands

Quick reference for common checks:

```bash
# App Service state
az webapp show \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "{state:state,defaultHostName:defaultHostName}"

# Stream live logs
az webapp log tail \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod

# Cosmos DB RBAC
az cosmosdb sql role assignment list \
  --account-name cosmos-hacker-board-prod \
  --resource-group rg-hacker-board-prod

# Cosmos DB public access
az cosmosdb show \
  --name cosmos-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "{disableLocalAuth:disableLocalAuth,publicNetworkAccess:publicNetworkAccess}"

# App settings
az webapp config appsettings list \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod \
  --query "[].{name:name}" --output table

# Force restart
az webapp restart \
  --name app-hacker-board-prod \
  --resource-group rg-hacker-board-prod
```

---

[← Back to Documentation](README.md)
