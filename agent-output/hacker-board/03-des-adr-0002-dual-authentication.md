# ADR-0002: Dual-Provider Authentication via SWA Built-In Auth

> **Status**: **Superseded** by D30 (Phase 18 — App Service Easy Auth)
> **Date**: 2026-02-19 · **Superseded**: 2026-02-20
> **Deciders**: jonathan-vella (deployer / first admin)
> **WAF Phase**: Step 2 — Architecture Assessment
> **Related Decisions**: ADR-0001 (serverless stack), ADR-0003 (Cosmos DB RBAC-only access)
> **Superseded By**: D30 — App Service Easy Auth for GitHub OAuth (same `/.auth/*` contract, see [04-implementation-plan.md](04-implementation-plan.md))

> [!WARNING]
> **This ADR is superseded.** Authentication moved from SWA built-in auth to App Service Easy Auth (D30). The `/.auth/*` endpoints and `x-ms-client-principal` header contract remain identical. `staticwebapp.config.json` route protection is replaced by Easy Auth `globalValidation` in Bicep `authsettingsV2`. See [04-implementation-plan.md](04-implementation-plan.md) for details.

## Context

HackerBoard has two distinct identity populations with different access needs and different IdP affiliations:

1. **Hackathon participants / team members** — external users who may not have a Microsoft Entra ID account; need frictionless registration and score submission during a time-limited event
2. **Admins / deployers** — Microsoft employees or event organizers who already have Entra ID accounts; need elevated privileges to manage rubrics, approve submissions, and configure the event

The original design used a single-provider model (GitHub OAuth only), which did not support automated admin role assignment or Entra ID-based governance enforcement. A separate requirement emerged from governance: the first deployer must be automatically assigned the `admin` app role via a Bicep deployment script so that no manual portal steps are required after `deploy.ps1` runs.

## Decision

Configure **two authentication providers** via SWA built-in auth (`.auth/` endpoints):

1. **GitHub OAuth** — for team members; zero friction (no Entra ID account required); role: `member`
2. **Microsoft Entra ID** — for admins/deployers; automated app role assignment via Bicep deployment script; role: `admin`

Role assignment is managed at two levels:

- **SWA application roles** (`admin` / `member`): controlled via SWA role invitations (GitHub users) or Entra ID app role assignment (deployment script)
- **Azure RBAC** (`Cosmos DB Built-in Data Contributor`): assigned to SWA system-assigned managed identity — not to individual users

Entra ID app registration is created automatically by a Bicep `deploymentScript` resource using a User-Assigned Managed Identity with Graph API permissions — eliminating all manual portal configuration.

## Alternatives Considered

| Option                                                      | Pros                                                                                                    | Cons                                                                                                       | WAF Impact                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **A — GitHub OAuth + Entra ID (dual-provider)** ✅ Selected | Zero friction for participants; automated admin setup; SWA Standard supports exactly 2 custom providers | SWA Standard required (unavailable on Free tier)                                                           | Security: ↑, Operations: ↑, Cost: →         |
| **B — Entra ID only (single-provider)**                     | All users in one directory; stronger MFA enforcement                                                    | Requires Entra ID guest accounts for all participants; high friction for external hackathon attendees      | Security: ↑↑, Reliability: ↑, Operations: ↓ |
| **C — GitHub OAuth only**                                   | Simplest configuration; works on SWA Free tier                                                          | No path for Entra ID-based automated admin assignment; governance MFA policy cannot be enforced            | Security: ↓, Operations: ↓                  |
| **D — Custom JWT / Auth0**                                  | Full control of identity flows                                                                          | Significant implementation complexity; external dependency; cost; not aligned with Azure-native governance | Security: ?, Operations: ↓↓, Cost: ↓        |
| **E — SWA managed identity only (no user auth)**            | Simplest for API-to-API                                                                                 | Not applicable — UI requires user identity for role-based UI and scoring attribution                       | N/A                                         |

**Why B was rejected**: Requiring Entra ID guest accounts for all hackathon participants creates administrative overhead and significant friction — participants may not have or want a Microsoft account.

**Why C was rejected**: GitHub-only auth cannot support the automated first-admin assignment pattern required by the deployment script, and prevents Entra ID governance policies from applying to admin operations.

**Why D was rejected**: Custom auth introduces an external service dependency, increases cost, and moves away from the Azure-native governance model.

## Consequences

### Positive

- **Zero-friction participant onboarding**: GitHub OAuth sign-in requires no pre-provisioning; participants self-register during the event
- **Automated admin provisioning**: Bicep `deploymentScript` creates the Entra ID app registration and assigns the deployer to the `admin` app role — zero manual portal steps after `deploy.ps1`
- **Governance-aligned**: Entra ID path inherits MFA enforcement from `sys.mfa-write` governance policy; admin operations meet the Deny-without-MFA requirement
- **No secrets exchanged at user level**: SWA `.auth/` endpoints handle OAuth flows internally; the API never sees or stores user credentials
- **Role isolation**: `admin` and `member` roles are enforced at the SWA routing layer — unauthorized routes return 401 before reaching Functions

### Negative

- **SWA Standard required**: Custom auth providers are not available on the Free tier; this locks in the $9.00/month SWA cost
- **Entra ID app registration management**: App registration must be kept in sync with deployed SWA instance (handled by deployment script, but re-deployment must manage this)
- **GitHub OAuth token refresh**: SWA manages GitHub token lifecycle; session timeout behavior during long hackathon events should be validated
- **Two identity stores**: Admins and members exist in different directories — unified user audit log requires correlation across GitHub OAuth logs and Entra ID sign-in logs

### Neutral

- SWA Standard supports exactly 2 custom auth providers — exactly matching the dual-provider requirement; no room for a third provider without architectural change
- `staticwebapp.config.json` must define `allowedRoles` for all routes to enforce deny-by-default access control

## WAF Pillar Analysis

| Pillar                    | Impact | Notes                                                                                                   |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 🔒 Security               | ↑      | MFA enforced for Entra ID (admin) path; no credential storage; role-based route protection at SWA layer |
| 🔄 Reliability            | →      | SWA manages OAuth flows; no self-hosted auth service to maintain or fail                                |
| ⚡ Performance            | →      | Auth tokens validated at SWA edge; negligible latency impact on API calls                               |
| 💰 Cost Optimization      | →      | Included in SWA Standard flat rate; no additional cost for auth                                         |
| 🔧 Operational Excellence | ↑      | Automated Entra ID app registration eliminates manual setup step; deployment is fully repeatable        |

## Compliance Considerations

- **MFA enforcement**: Entra ID sign-in path is subject to `sys.mfa-write` governance policy (Deny effect) — admin operations require MFA by governance constraint
- **GDPR**: GitHub OAuth returns minimal user profile (username, avatar); SWA aliases prevent PII leakage into application data (F11 anonymization)
- **Session handling**: SWA manages OAuth session tokens via `HttpOnly`, `Secure` cookies — satisfies OWASP A07 session management requirements

## Implementation Notes

- **SWA auth config**: Define `identityProviders.gitHub` and `identityProviders.azureActiveDirectory` in `staticwebapp.config.json`
- **Deployment script**: `infra/modules/entra-app.bicep` uses `br/public:avm/res/resources/deployment-script:0.5.2`; runs `az ad app create`, creates `admin` app role, assigns deployer principal
- **User-Assigned MI**: Must have `Application.ReadWrite.All` and `AppRoleAssignment.ReadWrite.All` Graph API permissions granted before deployment
- **Route protection**: All `/api/*` routes must declare `allowedRoles: ["admin", "member"]` in `staticwebapp.config.json`; admin-only routes declare `allowedRoles: ["admin"]`
- **Testing**: Verify session persistence across the typical 4–8 hour hackathon event window; validate GitHub OAuth token refresh behaviour

---

| ⬅️ [03-des-adr-0001-serverless-stack-selection.md](03-des-adr-0001-serverless-stack-selection.md) | 🏠 [Project Index](README.md) | ➡️ [03-des-adr-0003-cosmos-db-rbac-access-model.md](03-des-adr-0003-cosmos-db-rbac-access-model.md) |
| ------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
