# ADR-0003: Cosmos DB RBAC-Only Access — No Private Endpoints, No Connection Strings

> **Status**: **Updated** (Phase 18 — App Service Migration)
> **Date**: 2026-02-19 · **Updated**: 2026-02-20
> **Deciders**: jonathan-vella (deployer / first admin)
> **WAF Phase**: Step 2 — Architecture Assessment
> **Related Decisions**: ADR-0001 (serverless stack — superseded by D28), ADR-0002 (authentication — superseded by D30)
> **Governance Driver**: Policy `ModifyCosmosDBLocalAuth` (Modify effect — auto-applies `disableLocalAuth: true`)

> [!NOTE]
> **Updated for Phase 18**: The RBAC-only decision remains unchanged. The managed identity source changed from SWA system-assigned MI to **App Service system-assigned MI** (D28). All references below reflect the current architecture.

## Context

HackerBoard's API layer (Azure Functions) must authenticate to Cosmos DB. There are two broad approaches: **credential-based** (connection string or primary key stored in app settings) and **identity-based** (managed identity + Entra ID RBAC, no stored credentials). Separately, network access to the Cosmos DB account can be restricted via either a VNet + private endpoint or left on the public endpoint with authentication-layer controls.

Two governance constraints limit the available options:

1. **`ModifyCosmosDBLocalAuth`** (Modify effect): Auto-applies `disableLocalAuth: true` to any Cosmos DB account in the subscription. This makes credential-based access impossible — even if a connection string were configured, it would be rejected at the service level.
2. **`sys.mfa-write`** (Deny effect): Resource write operations require MFA — deployer must authenticate with MFA during provisioning.

The original SQL-based implementation used a connection string in app settings and a private endpoint + VNet to restrict database network access. Neither approach is viable with Cosmos DB Serverless under governance constraints.

## Decision

Use **managed identity (Entra ID RBAC) as the sole authentication path** to Cosmos DB, with **public endpoint access**:

- App Service system-assigned managed identity receives the `Cosmos DB Built-in Data Contributor` role (`00000000-0000-0000-0000-000000000002`) scoped to the Cosmos DB account
- API code uses `DefaultAzureCredential` from `@azure/identity` — no connection strings anywhere in app settings or code
- `disableLocalAuth: true` is set explicitly in Bicep (and enforced by governance policy regardless)
- Private endpoints are **not** used — Cosmos DB account is accessible over its public HTTPS endpoint, with access controlled exclusively by Entra ID RBAC
- No VNet integration, no NAT Gateway, no private DNS zones

## Alternatives Considered

| Option                                                       | Pros                                                                     | Cons                                                                                                                                            | WAF Impact                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **A — Managed identity + RBAC, public endpoint** ✅ Selected | No secrets; governance-compliant; zero credential rotation; no VNet cost | Public endpoint (compensated by RBAC)                                                                                                           | Security: ↑↑, Cost: ↑↑, Operations: ↑        |
| **B — Managed identity + RBAC + private endpoint**           | Defense-in-depth: both identity and network controls                     | ~$7–10/month per private endpoint; requires VNet, subnet, private DNS zone; adds ~3 Bicep modules; no benefit for low-sensitivity internal tool | Security: ↑↑↑, Cost: ↓↓, Operations: ↓       |
| **C — Connection string in app settings**                    | Simple configuration; familiar pattern                                   | Blocked by governance policy `ModifyCosmosDBLocalAuth` — local auth is auto-disabled; connection string would be rejected at runtime            | Security: ↓↓, Governance: ❌ BLOCKED         |
| **D — Connection string in Key Vault + Key Vault reference** | Secrets not in plain app settings                                        | Still uses local auth — blocked by governance; adds Key Vault cost (~$5/month) and complexity; no benefit if local auth is disabled             | Security: ↓, Governance: ❌ BLOCKED, Cost: ↓ |

**Why B was rejected**: Private endpoint cost (~$7–10/month) represents approximately 77–110% of the entire estimated monthly spend (~$9.01/month). For an internal, short-lived event tool with no sensitive customer data, network isolation provides diminishing security returns — Entra ID RBAC provides equivalent access control at the identity layer. This can be revisited if the tool is adapted for higher-sensitivity workloads.

**Why C and D were rejected**: Both rely on Cosmos DB local authentication, which is auto-disabled by governance policy. These options are architecturally blocked, not just inadvisable.

## Consequences

### Positive

- **Zero credential surface**: No connection strings, no keys, no secrets to store, rotate, or accidentally leak
- **Governance-compliant by default**: Architecture satisfies `ModifyCosmosDBLocalAuth` policy constraint by design — no remediation drift possible
- **Least-privilege data plane**: `Cosmos DB Built-in Data Contributor` grants read/write on items; does not grant account management permissions
- **Simplified Bicep**: Eliminates VNet, subnet, private endpoint, and private DNS zone modules — reduces from ~15 to ~10 infrastructure resources
- **Cost savings**: Removing private endpoints saves ~$7–10/month, reducing estimated total from ~$16–19/month to ~$9.01/month
- **No Key Vault dependency**: Zero additional services to provision, monitor, or pay for

### Negative

- **Public endpoint**: Cosmos DB account is reachable over the internet by IP — mitigated by `disableLocalAuth: true` (no credential to brute-force) and RBAC (only the App Service managed identity principal can access data)
- **No network perimeter**: If the App Service managed identity were compromised, an attacker would have data-plane access to Cosmos DB from any network location — no VNet boundary to stop lateral movement
- **IP firewall not configured**: Cosmos DB `publicNetworkAccess` is enabled without IP allowlist — any IP can attempt to authenticate; only RBAC prevents access
- **Audit trail gap**: Cosmos DB data-plane operations are not logged to Log Analytics by default — diagnostic settings must be explicitly enabled to capture request logs

### Neutral

- `DefaultAzureCredential` in Functions works transparently in both local development (via `az login` token) and production (managed identity token) — no code-level environment branching required
- If a future compliance requirement mandates private endpoints, the migration path is well-understood: add a Bicep private endpoint module and restrict `publicNetworkAccess`

## WAF Pillar Analysis

| Pillar                    | Impact | Notes                                                                                                                                  |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 🔒 Security               | ↑↑     | No credentials to leak; RBAC-only access; governance policy enforces disableLocalAuth; public endpoint is an accepted, documented risk |
| 🔄 Reliability            | ↑      | Removing VNet eliminates a failure domain; managed identity tokens auto-refresh; no certificate or key expiry to cause outages         |
| ⚡ Performance            | ↑      | No VNet hop or private DNS resolution overhead; direct HTTPS to Cosmos DB public endpoint                                              |
| 💰 Cost Optimization      | ↑↑     | Saves ~$7–10/month vs. private endpoint option; largest cost avoidance in the architecture                                             |
| 🔧 Operational Excellence | ↑      | No credential rotation, no Key Vault policy management, no private DNS zone maintenance                                                |

## Compliance Considerations

- **GDPR**: Public endpoint is in `centralus` region (changed from `westeurope` in Phase 18); data at rest is encrypted by platform; data residency requirement satisfied regardless of endpoint type
- **OWASP A02 (Cryptographic Failures)**: Managed identity eliminates hardcoded secrets — satisfies the "never hardcode secrets" OWASP guideline
- **OWASP A01 (Broken Access Control)**: `Cosmos DB Built-in Data Contributor` scoped to a single account is least-privilege by design; admin users have no direct Cosmos DB access — only the managed identity does
- **Governance audit**: `ModifyCosmosDBLocalAuth` compliance status will show `Compliant` for this account since `disableLocalAuth: true` is set in Bicep

## Implementation Notes

- **Bicep role assignment**: Native Bicep `Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments`; set `roleDefinitionId: "00000000-0000-0000-0000-000000000002"` and `principalId: appService.outputs.appServicePrincipalId`
- **API code**: `api/shared/cosmos.js` exports a `getContainer(name)` helper using `new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() })`
- **Diagnostic settings**: Enable Cosmos DB diagnostic settings to send `DataPlaneRequests` and `QueryRuntimeStatistics` to the Log Analytics workspace — required for the operational monitoring gap identified in the WAF assessment
- **Local development**: Developers must run `az login` before starting the Express server; the `COSMOS_ENDPOINT` environment variable must be set but no key/connection string is needed
- **IP firewall (future)**: If heightened security is required, add `ipRules` to the Cosmos DB Bicep module to restrict access to known outbound IPs from App Service

---

| ⬅️ [03-des-adr-0002-dual-authentication.md](03-des-adr-0002-dual-authentication.md) | 🏠 [Project Index](README.md) | ➡️ [03-des-adr-0004-single-region-deployment.md](03-des-adr-0004-single-region-deployment.md) |
| ----------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
