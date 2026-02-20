# Plan: SWA → App Service + ACR + Cosmos DB Migration

**TL;DR**: Replace the SWA managed functions runtime (broken MI sidecar) with a single App Service container running Express. Keep Cosmos DB, all data layer code, and the existing auth contract (`x-ms-client-principal`, `/.auth/*`) intact via App Service Easy Auth. The 10 Azure Functions handlers stay **unmodified** via a thin adapter layer that translates Express request/response to the Functions signature. New Bicep modules for ACR + App Service replace the SWA module. CI/CD switches from `Azure/static-web-apps-deploy` to Docker build + ACR push + App Service deploy.

## Key Design Decisions

- **D28**: Replace SWA with App Service for Linux Containers + ACR (SWA MI sidecar `expires_on` bug makes Cosmos MI auth impossible; App Service MI is battle-tested)
- **D29**: Use Express adapter pattern — wrap existing Azure Functions handlers without modifying them (preserve all 126 passing tests, zero risk to business logic)
- **D30**: App Service Easy Auth with GitHub OAuth (same `/.auth/me`, `/.auth/login/github`, `x-ms-client-principal` contract — frontend and API auth code unchanged)

---

## Steps

### Step 1 — Express server + adapter layer (new files)

1. Create `api/server.js` — Express entry, mounts all API routes under `/api/*`, serves static files from `src/`, SPA fallback for hash router, security headers middleware (ported from `staticwebapp.config.json` `globalHeaders`)
2. Create `api/shared/adapter.js` — `adapt(handler)` function that wraps each Azure Functions handler: translates Express `req` (plain object headers, `req.query`, `req.body`) to match the Functions `request` API (`headers.get()`, `query.get()`, `request.json()`, `request.method`), and converts the `{ status, jsonBody }` return to `res.status().json()`
3. Register all 13 routes in `server.js` by importing handlers from the 10 existing function files — **zero edits to function files themselves**

Route mapping (from existing `app.http()` declarations):

| Function file                           | Route                       | Methods                |
| --------------------------------------- | --------------------------- | ---------------------- |
| `health.js` → `handleHealth`            | `/api/health`               | GET                    |
| `teams.js` → handler                    | `/api/teams`                | GET, POST, PUT, DELETE |
| `teams-assign.js` → handler             | `/api/teams/assign`         | POST                   |
| `scores.js` → handler                   | `/api/scores`               | GET, POST              |
| `attendees.js` → `getAttendees`         | `/api/attendees`            | GET                    |
| `attendees.js` → handler                | `/api/attendees/me`         | GET, POST              |
| `awards.js` → handler                   | `/api/awards`               | GET, POST, PUT         |
| `submissions.js` → handler              | `/api/submissions`          | GET                    |
| `submissions.js` → `validateSubmission` | `/api/submissions/validate` | POST                   |
| `upload.js` → handler                   | `/api/upload`               | POST                   |
| `flags.js` → handler                    | `/api/flags`                | GET, PUT               |
| `rubrics.js` → handler                  | `/api/rubrics`              | GET, POST              |
| `rubrics.js` → `getActiveRubric`        | `/api/rubrics/active`       | GET                    |

### Step 2 — Container setup (new files)

4. Create `Dockerfile` — Node.js 20 Alpine, copy `src/` + `api/` + `package*.json`, install production deps, expose port 8080, `CMD ["node", "api/server.js"]`
5. Create `.dockerignore` — exclude `node_modules`, `test-results`, `agent-output`, `docs`, `.github`, `infra`
6. Update `api/package.json` — add `express` dependency, add `"start": "node server.js"` script; keep `@azure/functions` as-is (handlers still import from it for types, but the adapter bypasses the Functions runtime). Actually — the handlers import `app` from `@azure/functions` and call `app.http()` at module load. We need to either: (a) **refactor** each handler to export the functions without calling `app.http()`, or (b) create a **mock** `@azure/functions` module that captures registrations. **Option (a) is cleaner** — extract the handler functions into named exports and move the `app.http()` calls out.
7. Update `package.json` (root) — remove `@azure/static-web-apps-cli`, `swa start` script; add `"start": "node api/server.js"`, Docker-based dev scripts

### Step 3 — Refactor function files to export handlers (minimal edits)

8. Each of the 10 function files gets a small surgical edit: **export** the handler function(s) and **remove** the `app.http()` registration block at the bottom. The handler logic stays identical. Example for `health.js`:
   - Before: `async function handleHealth(request) { ... }` + `app.http("health", { handler: handleHealth })`
   - After: `export async function handleHealth(request) { ... }` (remove the `app.http` block and the `import { app }` line)
   - Files: `health.js`, `teams.js`, `teams-assign.js`, `scores.js`, `attendees.js`, `awards.js`, `submissions.js`, `upload.js`, `flags.js`, `rubrics.js`

9. Remove `api/host.json` — Azure Functions runtime config no longer needed
10. Remove `api/local.settings.json` — Azure Functions local settings no longer needed

### Step 4 — Auth (zero changes to runtime code)

11. **No changes** to `src/services/auth.js` — App Service Easy Auth provides the same `/.auth/me`, `/.auth/login/github`, `/.auth/logout` endpoints and the same `clientPrincipal` JSON shape
12. **No changes** to `api/shared/auth.js` — App Service Easy Auth injects the same `x-ms-client-principal` header
13. **No changes** to `api/shared/logger.js` — same header dependency
14. Replace `staticwebapp.config.json` — route-level role ACLs move to Express middleware (admin-only routes already enforce via `requireRole()` in each handler; the `staticwebapp.config.json` was defense-in-depth). The security headers move to Express middleware in `server.js`. The `navigationFallback` becomes an Express SPA fallback route. File becomes either deleted or repurposed as a simple JSON config the Express server reads.

### Step 5 — Bicep Infrastructure (major changes)

15. Create `infra/modules/acr.bicep` — ACR Basic tier using AVM module `br/public:avm/res/container-registry/registry`, system-assigned MI disabled (App Service pulls via `acrPull` role)
16. Create `infra/modules/app-service.bicep` — App Service Plan (B1 Linux) + Web App for Containers using AVM modules `br/public:avm/res/web/serverfarm` + `br/public:avm/res/web/site`; system-assigned MI enabled; app settings: `COSMOS_ENDPOINT`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `WEBSITES_PORT=8080`; configure `authsettingsV2` for GitHub OAuth (requires GitHub OAuth App client ID/secret as params); assign `acrPull` role on ACR to App Service MI
17. Update `infra/main.bicep` — replace `staticWebApp` module with `acr` + `appService` modules; update outputs from `swaHostname`/`swaName`/`swaPrincipalId` to `appServiceHostname`/`appServiceName`/`appServicePrincipalId`; pass `appServicePrincipalId` to `cosmosRbac` module instead of SWA's
18. Update `infra/modules/cosmos-rbac.bicep` — no structural change, just receives App Service MI `principalId` instead of SWA's (parameter name stays the same)
19. Update `infra/main.bicepparam` — add new params if needed (GitHub OAuth client ID, ACR name)
20. Rebuild `infra/azuredeploy.json` — `az bicep build --file infra/main.bicep --outfile infra/azuredeploy.json`
21. **No changes** to `infra/modules/cosmos-account.bicep`, `infra/modules/app-insights.bicep`, `infra/modules/log-analytics.bicep`

### Step 6 — CI/CD Pipeline

22. Replace `.github/workflows/deploy-swa.yml` with `.github/workflows/deploy-app.yml`:
    - **build-and-test** job: same (Node 20, `npm ci`, API tests, UI tests, audit)
    - **build-image** job: `docker build`, `docker push` to ACR (use `azure/docker-login@v2` + ACR credentials from secrets or OIDC)
    - **deploy** job: `az webapp config container set` to update App Service image
    - **smoke-test** job: same health check + API reachability, but against App Service URL
    - Remove `deploy-preview` and `close-pull-request` jobs (SWA-specific)
23. New GitHub secrets needed: `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD` (or use OIDC + federated credential)

### Step 7 — Scripts

24. Update `infra/deploy.ps1` — replace SWA-specific post-deploy steps (`az staticwebapp appsettings`, SWA invite) with App Service equivalents (`az webapp config appsettings`, Easy Auth config); update output variable names
25. Update or delete `scripts/configure-swa-auth.sh` — replaced by Easy Auth config in Bicep
26. Update `scripts/invite-admin.sh` — SWA role invitations are replaced by App Service Easy Auth role claims (roles come from Entra ID app roles, not SWA invitations)

### Step 8 — Tests

27. Update `api/tests/health.test.js` and other test files — mock adjustments for the removed `app.http()` import; handler function imports change from side-effect imports to named imports
28. Verify all 126 tests still pass after the function file refactors (Step 3)
29. Add a new test for the adapter layer (`adapt()` function)
30. Run `npm run test:all` locally before committing

### Step 9 — Documentation

31. Update `docs/backlog.md` — add Phase 18 (App Service Migration), decisions D28-D30, new session notes, update Current Status table
32. Update `docs/app-prd.md` — Architecture Context section (replace SWA diagram with App Service + ACR + Cosmos)
33. Update `docs/deployment-guide.md` — new deployment steps for App Service
34. Update `docs/app-handoff-checklist.md` — replace SWA wiring steps
35. Update `docs/app-scaffold.md` — updated project structure (new files)
36. Update `.github/copilot-instructions.md` — Tech Stack, API Conventions, Project Structure sections

### Step 10 — Pre-requisites (manual, outside code)

37. **Create a GitHub OAuth App** — needed for App Service Easy Auth GitHub provider (Settings → Developer Settings → OAuth Apps). Provides `clientId` and `clientSecret`. Callback URL: `https://<app-service-name>.azurewebsites.net/.auth/login/github/callback`
38. **Store GitHub OAuth secret** — as App Service app setting or Key Vault reference

---

## File Impact Matrix

| File                                 | Action        | Reason                                        |
| ------------------------------------ | ------------- | --------------------------------------------- |
| `api/server.js`                      | **CREATE**    | Express entry point                           |
| `api/shared/adapter.js`              | **CREATE**    | Wraps Functions handlers for Express          |
| `Dockerfile`                         | **CREATE**    | Container build                               |
| `.dockerignore`                      | **CREATE**    | Exclude non-runtime files                     |
| `infra/modules/acr.bicep`            | **CREATE**    | ACR Basic                                     |
| `infra/modules/app-service.bicep`    | **CREATE**    | App Service Plan + Web App                    |
| `api/src/functions/*.js` (10 files)  | **MODIFY**    | Export handlers, remove `app.http()`          |
| `api/package.json`                   | **MODIFY**    | Add `express`, update scripts                 |
| `package.json` (root)                | **MODIFY**    | Remove SWA CLI, update scripts                |
| `infra/main.bicep`                   | **MODIFY**    | Replace SWA with ACR + App Service            |
| `infra/main.bicepparam`              | **MODIFY**    | New params                                    |
| `infra/azuredeploy.json`             | **REBUILD**   | From updated Bicep                            |
| `infra/deploy.ps1`                   | **MODIFY**    | Replace SWA commands                          |
| `.github/workflows/deploy-swa.yml`   | **REPLACE**   | New `deploy-app.yml`                          |
| `staticwebapp.config.json`           | **DELETE**    | Replaced by Express middleware + Easy Auth    |
| `api/host.json`                      | **DELETE**    | Functions runtime config                      |
| `api/local.settings.json`            | **DELETE**    | Functions local settings                      |
| `infra/modules/static-web-app.bicep` | **DELETE**    | Replaced by `app-service.bicep`               |
| `scripts/configure-swa-auth.sh`      | **DELETE**    | Replaced by Easy Auth Bicep config            |
| `scripts/invite-admin.sh`            | **MODIFY**    | Update for App Service roles                  |
| `api/shared/cosmos.js`               | **NO CHANGE** | `DefaultAzureCredential` works on App Service |
| `api/shared/auth.js`                 | **NO CHANGE** | Same `x-ms-client-principal` header           |
| `api/shared/logger.js`               | **NO CHANGE** | Same header dependency                        |
| `api/shared/errors.js`               | **NO CHANGE** | No SWA dependency                             |
| `api/shared/featureFlags.js`         | **NO CHANGE** | No SWA dependency                             |
| `api/shared/rubricParser.js`         | **NO CHANGE** | No SWA dependency                             |
| `src/services/auth.js`               | **NO CHANGE** | Same `/.auth/*` endpoints                     |
| `src/services/api.js`                | **NO CHANGE** | Relative `/api` paths work same-origin        |
| `src/**` (all frontend)              | **NO CHANGE** | Served as static files                        |
| `infra/modules/cosmos-account.bicep` | **NO CHANGE** | Keep as-is                                    |
| `infra/modules/cosmos-rbac.bicep`    | **NO CHANGE** | Same interface, different caller              |
| `infra/modules/app-insights.bicep`   | **NO CHANGE** | Keep as-is                                    |
| `infra/modules/log-analytics.bicep`  | **NO CHANGE** | Keep as-is                                    |
| Docs (6 files)                       | **MODIFY**    | Update SWA → App Service references           |
| Test files (8 API + 12 UI)           | **MODIFY**    | Update imports for exported handlers          |

## Governance Compliance

| Constraint                | Status    | Notes                                                         |
| ------------------------- | --------- | ------------------------------------------------------------- |
| B3 — 9 RG tags            | Compliant | Already in Bicep, tags auto-inherited                         |
| B5 — MCAPSGov deny        | Compliant | App Service + ACR not in deny list                            |
| B6 — Storage key auth     | Compliant | ACR uses Azure-managed storage, not customer storage accounts |
| Cosmos `disableLocalAuth` | Compliant | `DefaultAzureCredential` + MI, zero changes                   |
| ADJ-2 — Cosmos Entra RBAC | Compliant | Same RBAC model, different MI source                          |

## Verification

1. `npm run test:all` — all 126 tests pass after function refactors
2. `docker build -t hacker-board .` — container builds locally
3. `docker run -p 8080:8080 hacker-board` — health endpoint returns 200 (Cosmos will fail locally without MI, but Express + static files work)
4. `az bicep build --file infra/main.bicep --outfile infra/azuredeploy.json` — Bicep compiles clean
5. CI/CD pipeline: build → test → Docker push → deploy → smoke test passes
6. `curl https://<app>.azurewebsites.net/api/health` → 200 with all containers "ok"
7. `curl https://<app>.azurewebsites.net/.auth/me` → returns `clientPrincipal` (Easy Auth working)

## Estimated Effort

| Step                                     | Effort       | Risk                                              |
| ---------------------------------------- | ------------ | ------------------------------------------------- |
| Steps 1-3 (Express + adapter + refactor) | ~2 hours     | Low — adapter pattern preserves all handler logic |
| Step 4 (Auth — no changes)               | 0            | None                                              |
| Step 5 (Bicep)                           | ~2 hours     | Medium — new AVM modules, Easy Auth config        |
| Step 6 (CI/CD)                           | ~1 hour      | Low — standard Docker + App Service deploy        |
| Steps 7-8 (Scripts + tests)              | ~1 hour      | Low                                               |
| Step 9 (Docs)                            | ~1 hour      | Low                                               |
| Step 10 (GitHub OAuth App)               | ~15 min      | Low — manual setup                                |
| **Total**                                | **~7 hours** |                                                   |

## Decisions

- **D28**: Replace SWA with App Service for Linux Containers + ACR — SWA managed functions MI sidecar has `expires_on` parsing bug that makes Cosmos MI auth impossible after 8 failed CI/CD runs
- **D29**: Express adapter wraps existing Functions handlers unchanged — preserves all 126 tests, zero business logic modifications
- **D30**: App Service Easy Auth for GitHub OAuth — same `/.auth/*` endpoints and `x-ms-client-principal` contract, zero frontend/API auth code changes
