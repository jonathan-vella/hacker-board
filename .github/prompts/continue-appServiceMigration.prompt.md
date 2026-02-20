# Continue App Service Migration — Phase 18.5–18.9

## Context

You are continuing the SWA → App Service + ACR migration (Phase 18) from a previous session.
**Read `docs/backlog.md` Session Handoff Notes (2026-02-20)** for full context on what was completed.

## Completed (18.1–18.4)

| Step | What | Status |
|------|------|--------|
| 18.1 | `api/shared/adapter.js` + `api/server.js` (Express 5.2.1, 13 routes, security headers) | ✅ |
| 18.2 | All 10 function files refactored (exports added, `app.http()` removed), `host.json` + `local.settings.json` deleted | ✅ |
| 18.3 | `Dockerfile`, `.dockerignore`, `api/package.json` (express added, @azure/functions removed), root `package.json` updated | ✅ |
| 18.4 | `infra/modules/acr.bicep`, `infra/modules/app-service.bicep`, `infra/main.bicep` updated, `infra/main.bicepparam` updated, `azuredeploy.json` rebuilt — zero errors | ✅ |

### Key Decisions
- **D28**: App Service for Linux Containers + ACR (replaces SWA)
- **D29**: Express adapter wraps existing Functions handlers unchanged
- **D30**: App Service Easy Auth for GitHub OAuth — same `/.auth/*` contract

### Key Technical Details
- AVM `web/site:0.21.0` uses `configs` array (not `appSettingsKeyValuePairs`/`authSettingV2Configuration`)
- Easy Auth + app settings configured via `configs: [{ name: 'appsettings', ... }, { name: 'authsettingsV2', ... }]`
- `acrPull` role assignment uses `siteName` for deterministic GUID (BCP120 workaround)
- Express 5.2.1, Node.js 20 Alpine, port 8080
- See `agent-output/hacker-board/04-implementation-plan.md` for full Bicep plan (699 lines)

## Remaining Work (execute in order)

### Phase 18.5 — CI/CD Pipeline
- Create `.github/workflows/deploy-app.yml`:
  - Docker build → ACR push → App Service deploy → smoke test (`/api/health`)
  - Trigger: push to `main` (paths: `api/**`, `src/**`, `Dockerfile`)
  - Use `azure/docker-login@v2` + `azure/webapps-deploy@v3`
  - ACR: `crhackerboardprod.azurecr.io`, image: `hacker-board`
  - App Service: `app-hacker-board-prod`
- Delete `.github/workflows/deploy-swa.yml`

### Phase 18.6 — Scripts
- Update `infra/deploy.ps1` — replace SWA output references with App Service equivalents
  - `swaHostname` → `appServiceHostname`, `swaName` → `appServiceName`
  - Add `gitHubOAuthClientId` and `gitHubOAuthClientSecret` as required params
  - Remove SWA deployment token retrieval
- Delete `scripts/configure-swa-auth.sh` (replaced by Easy Auth Bicep config)
- Update `scripts/invite-admin.sh` — update for App Service roles if needed

### Phase 18.7 — Tests
- Run `npm run test:all` to verify current state (should pass ~126-130 tests)
- Update any test imports if needed for exported handler functions
- Create `api/tests/adapter.test.js` — test the `adapt()` function
- Run `npm run test:all` again to confirm

### Phase 18.8 — Documentation
- Update `docs/app-prd.md` — Architecture Context (SWA → App Service + ACR)
- Update `docs/deployment-guide.md` — App Service deployment steps
- Update `docs/app-handoff-checklist.md` — replace SWA wiring
- Update `docs/app-scaffold.md` — updated project structure
- Update `.github/copilot-instructions.md` — Tech Stack, API Conventions
- Update `docs/backlog.md` — session handoff notes

### Phase 18.9 — Cleanup
- Delete `staticwebapp.config.json`
- Delete `infra/modules/static-web-app.bicep`

### Security Review
- Delegate to `09-Security Reviewer` agent for OWASP/Zero Trust review of all changes

### Post-Migration
- Deploy infrastructure (`08-Deploy` agent)
- Push first container image to ACR
- Configure GitHub OAuth App callback URL: `https://app-hacker-board-prod.azurewebsites.net/.auth/login/github/callback`
- Validate E2E (Phase 15 protocol)

## How to Execute

You are a conductor. Orchestrate using subagents:
- **18.5 CI/CD**: Implement directly (single workflow file + deletion)
- **18.6 Scripts**: Implement directly after reading current `deploy.ps1`
- **18.7 Tests**: Run tests, create adapter test, run again
- **18.8 Docs**: Delegate to docs-writer skill or implement directly
- **18.9 Cleanup**: Simple deletions
- **Security**: Delegate to `09-Security Reviewer` subagent
- **Deploy**: Delegate to `08-Deploy` subagent
