# HackerBoard Architecture Migration Plan

## SWA + Azure Functions → App Service for Linux (Containers) + Express.js

### Context

After three failed deployments caused by VNet-injected ACI (deploymentScript) issues — missing storage accounts, Azure Files mount failures, containers stuck in "Waiting to run" — we are migrating the entire architecture away from Azure Static Web Apps + Azure Functions to Azure App Service for Linux with custom containers.

### Design Decisions

| ID  | Decision                                             | Rationale                                                                      |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| D23 | App Service for Linux with custom container from ACR | Eliminates SWA limitations, gives full control over runtime                    |
| D24 | Azure Container Registry (Basic SKU)                 | Private registry for container images                                          |
| D25 | Express.js as API runtime                            | Lightweight, well-known, replaces Azure Functions v4                           |
| D26 | Easy Auth (built-in) for GitHub OAuth                | Same `x-ms-client-principal` header pattern as SWA — minimal auth code changes |
| D27 | Container startup script for SQL schema migration    | Eliminates ACI deploymentScript entirely                                       |
| D28 | Single container serving both static files and API   | Simplifies deployment, reduces cost, single App Service Plan                   |
| D29 | Private endpoints remain mandatory (D22 preserved)   | SQL Private Endpoint + VNet integration for App Service                        |

---

## Phase 1 — Containerization (Steps 1–3)

### Step 1: Create `server.js` (Express entry point)

- **File**: `server.js` (root)
- **Action**: CREATE
- **Details**:
  - Import Express, serve static files from `src/`
  - Mount all API routes under `/api/`
  - Port from `process.env.PORT || 8080`
  - Add security headers middleware (CSP, HSTS, X-Content-Type-Options) — migrated from `staticwebapp.config.json`
  - Add `/.auth/*` pass-through (Easy Auth handles these at the platform level)
  - SPA fallback: serve `src/index.html` for all non-API, non-static routes
  - Import and run `scripts/migrate-schema.js` on startup (before listening)
- **Verification**: `node server.js` starts and serves `src/index.html` on `http://localhost:8080`

### Step 2: Create `Dockerfile`

- **File**: `Dockerfile` (root)
- **Action**: CREATE
- **Details**:
  - Base: `node:20-slim`
  - `WORKDIR /app`
  - Copy `package.json`, `package-lock.json` → `npm ci --omit=dev`
  - Copy `server.js`, `src/`, `api/`, `scripts/`, `templates/`
  - `EXPOSE 8080`
  - `ENV PORT=8080`
  - `CMD ["node", "server.js"]`
- **Verification**: `docker build -t hacker-board .` succeeds

### Step 3: Create `.dockerignore`

- **File**: `.dockerignore` (root)
- **Action**: CREATE
- **Details**:
  ```
  node_modules
  .git
  .github
  docs
  infra
  test-results
  *.md
  !templates/*.md
  .env*
  ```
- **Verification**: Build context excludes unnecessary files

---

## Phase 2 — API Conversion: Azure Functions → Express Routes (Steps 4–10)

### Step 4: Create Express router barrel file

- **File**: `api/routes/index.js`
- **Action**: CREATE
- **Details**:
  - Import all route modules
  - Export a single Express Router that mounts all sub-routes
  - Maintain exact same URL paths as current Azure Functions (`/api/health`, `/api/teams`, etc.)

### Step 5: Convert `health.js`

- **File**: `api/src/functions/health.js` → `api/routes/health.js`
- **Action**: CREATE new, mark old for deletion
- **Details**:
  - Replace `app.http('health', { ... handler })` with `router.get('/health', handler)`
  - Convert `request` (Azure HttpRequest) → Express `req`
  - Convert `return { status, jsonBody }` → `res.status().json()`
  - Keep all business logic identical

### Step 6: Convert `teams-assign.js`

- **File**: `api/routes/teams.js`
- **Action**: CREATE
- **Details**:
  - `POST /api/teams/assign` → `router.post('/teams/assign', handler)`
  - `GET /api/teams` → `router.get('/teams', handler)`
  - `GET /api/teams/:id` → `router.get('/teams/:id', handler)`
  - Extract auth checks via `requireAuth` / `requireRole` middleware (from `api/shared/auth.js`)

### Step 7: Convert `scores.js`

- **File**: `api/routes/scores.js`
- **Action**: CREATE
- **Details**:
  - `POST /api/scores` → `router.post('/scores', handler)`
  - `GET /api/scores/leaderboard` → `router.get('/scores/leaderboard', handler)`
  - All parameterized SQL queries preserved as-is

### Step 8: Convert `submissions.js`

- **File**: `api/routes/submissions.js`
- **Action**: CREATE
- **Details**:
  - `POST /api/submissions` → `router.post('/submissions', handler)`
  - `GET /api/submissions` → `router.get('/submissions', handler)`
  - `PATCH /api/submissions/:id/review` → `router.patch('/submissions/:id/review', handler)`
  - File upload handling: replace Azure Functions body parsing with `express.json()` middleware

### Step 9: Convert remaining endpoints

- **Files**: `api/routes/attendees.js`, `api/routes/awards.js`, `api/routes/flags.js`, `api/routes/rubrics.js`
- **Action**: CREATE each
- **Details**:
  - Same conversion pattern as above
  - `attendees.js`: GET/POST /api/attendees
  - `awards.js`: GET/POST /api/awards
  - `flags.js`: GET /api/flags
  - `rubrics.js`: GET/POST /api/rubrics

### Step 10: Create Express error-handling middleware

- **File**: `api/middleware/errorHandler.js`
- **Action**: CREATE
- **Details**:
  - Catch-all error handler: `(err, req, res, next) => { ... }`
  - Map `AppError` (from `api/shared/errors.js`) to structured JSON responses
  - Log errors via `api/shared/logger.js`
  - Never expose stack traces in production

---

## Phase 3 — SQL Schema Migration at Startup (Steps 11–12)

### Step 11: Create `scripts/migrate-schema.js`

- **File**: `scripts/migrate-schema.js`
- **Action**: CREATE
- **Details**:
  - Read `api/schema/init.sql`
  - Connect to Azure SQL using `api/shared/db.js` (DefaultAzureCredential)
  - Execute the idempotent DDL script
  - Log success/failure
  - Called from `server.js` before `app.listen()`
  - Includes retry logic (3 attempts, exponential backoff)
  - Grants `db_owner` to the App Service managed identity (replaces sql-grant.bicep logic)

### Step 12: Update `api/shared/db.js`

- **File**: `api/shared/db.js`
- **Action**: MODIFY
- **Details**:
  - Export a `runMigration(sqlFilePath)` helper alongside existing `query()` function
  - Ensure connection pool is initialized before first query
  - No changes to auth mechanism (DefaultAzureCredential stays)

---

## Phase 4 — Bicep Infrastructure Rewrite (Steps 13–19)

### Step 13: Create `infra/modules/container-registry.bicep`

- **File**: `infra/modules/container-registry.bicep`
- **Action**: CREATE
- **Details**:
  - Use AVM `br/public:avm/res/container-registry/registry` if available, otherwise raw resource
  - Basic SKU, admin disabled
  - System-assigned managed identity
  - `acrPull` role assignment for App Service managed identity
  - Output: `loginServer`, `registryName`

### Step 14: Create `infra/modules/app-service.bicep`

- **File**: `infra/modules/app-service.bicep`
- **Action**: CREATE
- **Details**:
  - App Service Plan: Linux, B1 SKU (or configurable parameter)
  - Web App: Linux container from ACR image
  - System-assigned managed identity
  - VNet integration (subnet delegation `Microsoft.Web/serverFarms`)
  - App settings:
    - `AZURE_SQL_SERVER` — SQL FQDN
    - `AZURE_SQL_DATABASE` — database name
    - `APPLICATIONINSIGHTS_CONNECTION_STRING`
    - `DOCKER_REGISTRY_SERVER_URL` — ACR login server
    - `WEBSITES_PORT=8080`
  - Easy Auth configuration (GitHub OAuth provider)
  - `alwaysOn: true`
  - HTTPS only
  - Output: `principalId`, `defaultHostName`, `resourceId`

### Step 15: Modify `infra/modules/vnet.bicep`

- **File**: `infra/modules/vnet.bicep`
- **Action**: MODIFY
- **Details**:
  - Remove `snet-swa` and `snet-scripts` subnets
  - Add `snet-app` subnet with `Microsoft.Web/serverFarms` delegation
  - Keep `snet-sql-pe` unchanged
  - Remove `Microsoft.Storage` service endpoint (no longer needed)
  - Update outputs

### Step 16: Modify `infra/main.bicep`

- **File**: `infra/main.bicep`
- **Action**: MAJOR REWRITE
- **Details**:
  - Remove: `staticWebApp` module, `sqlGrant` module, `deploymentIdentity` (UAMI)
  - Add: `containerRegistry` module, `appService` module
  - Wire App Service MI as SQL Entra admin (replaces UAMI)
  - Wire ACR → App Service `acrPull` role
  - Wire VNet `snet-app` → App Service VNet integration
  - Wire App Insights connection string → App Service
  - Update all parameter references
  - Keep: `logAnalytics`, `appInsights`, `sql`, `vnet`, `privateDns`, `sqlPrivateEndpoint`

### Step 17: Modify `infra/main.bicepparam`

- **File**: `infra/main.bicepparam`
- **Action**: MODIFY
- **Details**:
  - Remove SWA-specific parameters
  - Add: `containerImage` (default: initial placeholder), `appServiceSkuName` (default: 'B1')
  - Keep: SQL, VNet, PE parameters

### Step 18: Delete `infra/modules/static-web-app.bicep`

- **File**: `infra/modules/static-web-app.bicep`
- **Action**: DELETE

### Step 19: Delete `infra/modules/sql-grant.bicep`

- **File**: `infra/modules/sql-grant.bicep`
- **Action**: DELETE

---

## Phase 5 — Deployment Script Rewrite (Step 20)

### Step 20: Rewrite `infra/deploy.ps1`

- **File**: `infra/deploy.ps1`
- **Action**: MAJOR REWRITE
- **Details**:
  - Pre-flight checks: az CLI, Docker, bicep
  - Step 1: Deploy Bicep (infra)
  - Step 2: `az acr build` — build & push container image to ACR
  - Step 3: Update App Service container image tag
  - Step 4: Restart App Service
  - Step 5: Wait for healthy response from `/api/health`
  - Step 6: Grant App Service MI `db_owner` on SQL (via `az sql` or inline SQL)
  - Remove all SWA-specific logic (token, `az staticwebapp` commands)
  - Remove ACI/deploymentScript logic
  - Keep: resource group creation, parameter handling, error handling

---

## Phase 6 — CI/CD Workflow Rewrite (Step 21)

### Step 21: Rewrite `.github/workflows/deploy-swa.yml`

- **File**: `.github/workflows/deploy-swa.yml` → rename to `deploy.yml`
- **Action**: MAJOR REWRITE
- **Details**:
  - Trigger: push to `main`, PR to `main`
  - Jobs:
    1. **build-test**: `npm ci`, `npm run test:all`, lint
    2. **build-image**: `az acr build` to push image (on push to main only)
    3. **deploy-infra**: `az deployment group create` with Bicep
    4. **deploy-app**: Update App Service container image, restart
    5. **smoke-test**: Hit `/api/health`, verify 200
  - Secrets needed: `AZURE_CREDENTIALS` (service principal), `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
  - Remove: `Azure/static-web-apps-deploy@v1` action
  - Add: `azure/login@v2`, `az acr build`, `az webapp config container set`

---

## Phase 7 — Auth Configuration (Steps 22–23)

### Step 22: Register GitHub OAuth App

- **Action**: MANUAL (document steps)
- **Details**:
  - Go to GitHub Settings → Developer Settings → OAuth Apps → New
  - Homepage URL: `https://<app-service-name>.azurewebsites.net`
  - Callback URL: `https://<app-service-name>.azurewebsites.net/.auth/login/github/callback`
  - Note Client ID and Client Secret

### Step 23: Configure Easy Auth on App Service

- **Action**: Bicep or `az webapp auth` CLI
- **Details**:
  - Provider: GitHub
  - Client ID from step 22
  - Client Secret stored in App Settings (or Key Vault reference)
  - Unauthenticated action: AllowAnonymous (app handles auth per-route)
  - Token store: enabled

---

## Phase 8 — Cleanup (Steps 24–28)

### Step 24: Delete `staticwebapp.config.json`

- Security headers → Express middleware in `server.js`
- Route rules → Express routing
- Auth config → Easy Auth

### Step 25: Delete `api/host.json`

- Azure Functions host config — no longer needed

### Step 26: Delete `api/src/functions/*.js` (all 10 files)

- Replaced by `api/routes/*.js`

### Step 27: Remove `@azure/functions` from `api/package.json`

- Add `express` dependency instead

### Step 28: Delete `infra/modules/static-web-app.bicep` and `infra/modules/sql-grant.bicep`

- Already noted in Phase 4; ensure both are removed

---

## Phase 9 — Package Updates (Step 29)

### Step 29: Update `package.json` files

- **Root `package.json`**:
  - Add `"start": "node server.js"`
  - Update `"test:all"` if needed
  - Add `express` as dependency (move from api if consolidating)

- **`api/package.json`**:
  - Remove `@azure/functions`
  - Add `express` (if keeping api as separate package)
  - Update `"main"` entry point
  - Keep: `mssql`, `@azure/identity`, `applicationinsights`

---

## Phase 10 — Documentation Updates (Steps 30–35)

### Step 30: Update `docs/backlog.md`

- Record decisions D23–D29
- Reset Phase 15/16 tasks for new architecture
- Mark ACI-related issues as resolved (architecture pivot)
- Update session handoff notes

### Step 31: Update `docs/deployment-guide.md`

- Replace SWA deployment instructions with App Service + ACR workflow
- Document Docker build process
- Document Easy Auth configuration
- Document GitHub OAuth App registration

### Step 32: Update `docs/app-design.md`

- Replace architecture diagram (SWA → App Service)
- Update component descriptions
- Document Express.js API layer

### Step 33: Update `docs/api-spec.md`

- No URL changes (all `/api/*` paths preserved)
- Note runtime change from Azure Functions to Express.js
- Update auth documentation if needed

### Step 34: Update `docs/app-prd.md`

- Update tech stack section
- Update deployment architecture section

### Step 35: Update `docs/e2e-validation.md`

- Replace SWA-specific validation steps
- Add container health check validation
- Add ACR image validation
- Update smoke test URLs

---

## Phase 11 — Testing & Validation (Steps 36–39)

### Step 36: Run existing API tests

- `cd api && npm test`
- Tests should pass since business logic is unchanged
- May need minor updates for Express request/response mocks vs Azure Functions

### Step 37: Run existing frontend tests

- `npm run test:ui`
- Should pass with zero changes (frontend is portable)

### Step 38: Local Docker validation

- `docker build -t hacker-board .`
- `docker run -p 8080:8080 -e AZURE_SQL_SERVER=... hacker-board`
- Verify: `curl http://localhost:8080/api/health` returns 200
- Verify: `curl http://localhost:8080` returns index.html

### Step 39: Full E2E deployment

- Run updated `deploy.ps1`
- Verify all infrastructure created
- Verify container running in App Service
- Verify `/api/health` returns 200
- Verify GitHub OAuth login flow works
- Verify leaderboard loads data
- Run smoke tests from CI/CD

---

## File Inventory Summary

### Files to CREATE (8 new files)

| File                                     | Purpose                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `server.js`                              | Express entry point, static serving, SPA fallback, security headers |
| `Dockerfile`                             | Container image definition                                          |
| `.dockerignore`                          | Build context exclusions                                            |
| `api/routes/index.js`                    | Express router barrel                                               |
| `api/routes/health.js`                   | Health endpoint (Express)                                           |
| `api/routes/teams.js`                    | Teams endpoints (Express)                                           |
| `api/routes/scores.js`                   | Scores endpoints (Express)                                          |
| `api/routes/submissions.js`              | Submissions endpoints (Express)                                     |
| `api/routes/attendees.js`                | Attendees endpoints (Express)                                       |
| `api/routes/awards.js`                   | Awards endpoints (Express)                                          |
| `api/routes/flags.js`                    | Feature flags endpoint (Express)                                    |
| `api/routes/rubrics.js`                  | Rubrics endpoints (Express)                                         |
| `api/middleware/errorHandler.js`         | Express error-handling middleware                                   |
| `scripts/migrate-schema.js`              | SQL schema migration at container startup                           |
| `infra/modules/container-registry.bicep` | ACR Bicep module                                                    |
| `infra/modules/app-service.bicep`        | App Service Bicep module                                            |

### Files to DELETE (5+ files)

| File                                 | Reason                                       |
| ------------------------------------ | -------------------------------------------- |
| `staticwebapp.config.json`           | SWA-specific; replaced by Express middleware |
| `api/host.json`                      | Azure Functions host config                  |
| `api/src/functions/*.js` (10 files)  | Replaced by `api/routes/*.js`                |
| `infra/modules/static-web-app.bicep` | Replaced by `app-service.bicep`              |
| `infra/modules/sql-grant.bicep`      | Replaced by `scripts/migrate-schema.js`      |

### Files to MODIFY (10+ files)

| File                               | Scope of Change                         |
| ---------------------------------- | --------------------------------------- |
| `infra/main.bicep`                 | Major rewrite — new modules, remove old |
| `infra/main.bicepparam`            | Update parameters                       |
| `infra/modules/vnet.bicep`         | Subnet changes                          |
| `infra/deploy.ps1`                 | Major rewrite — ACR + App Service flow  |
| `.github/workflows/deploy-swa.yml` | Major rewrite → `deploy.yml`            |
| `api/package.json`                 | Swap @azure/functions for express       |
| `api/shared/db.js`                 | Add `runMigration()` export             |
| `package.json` (root)              | Add start script, express dep           |
| `docs/backlog.md`                  | Record decisions, update phases         |
| `docs/deployment-guide.md`         | New deployment instructions             |
| `docs/app-design.md`               | New architecture diagram                |
| `docs/api-spec.md`                 | Runtime change note                     |
| `docs/e2e-validation.md`           | New validation steps                    |

### Files UNCHANGED (portable)

| File                                       | Why Portable                                       |
| ------------------------------------------ | -------------------------------------------------- |
| `api/shared/auth.js`                       | Easy Auth uses same `x-ms-client-principal` header |
| `api/shared/db.js`                         | DefaultAzureCredential works with App Service MI   |
| `api/shared/errors.js`                     | Pure utility                                       |
| `api/shared/featureFlags.js`               | Pure DB query                                      |
| `api/shared/logger.js`                     | Same header extraction                             |
| `api/shared/rubricParser.js`               | Pure utility                                       |
| `api/schema/init.sql`                      | Idempotent DDL                                     |
| `src/app.js`                               | Vanilla JS SPA                                     |
| `src/index.html`                           | Static HTML                                        |
| `src/components/*.js`                      | UI components                                      |
| `src/services/auth.js`                     | Uses `/.auth/*` paths (same in Easy Auth)          |
| `src/services/api.js`                      | Calls `/api/*` paths (unchanged)                   |
| `src/styles/main.css`                      | Pure CSS                                           |
| `infra/modules/sql-server.bicep`           | Unchanged                                          |
| `infra/modules/sql-private-endpoint.bicep` | Unchanged                                          |
| `infra/modules/private-dns.bicep`          | Unchanged                                          |
| `infra/modules/app-insights.bicep`         | Unchanged                                          |
| `infra/modules/log-analytics.bicep`        | Unchanged                                          |

---

## Execution Order (Recommended)

```
Phase 1 (Containerization)     → Steps 1-3
Phase 2 (API Conversion)       → Steps 4-10
Phase 3 (SQL Migration Script) → Steps 11-12
Phase 9 (Package Updates)      → Step 29
Phase 11a (Unit Tests)         → Steps 36-37
Phase 4 (Bicep Rewrite)        → Steps 13-19
Phase 5 (Deploy Script)        → Step 20
Phase 6 (CI/CD)                → Step 21
Phase 7 (Auth Config)          → Steps 22-23
Phase 8 (Cleanup)              → Steps 24-28
Phase 11b (Docker + E2E)       → Steps 38-39
Phase 10 (Documentation)       → Steps 30-35
```

Run unit tests (Phase 11a) after API conversion to catch regressions early, before tackling infrastructure changes.
