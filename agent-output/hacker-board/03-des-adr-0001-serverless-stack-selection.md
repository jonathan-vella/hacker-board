# ADR-0001: Serverless Stack — SWA Standard + Cosmos DB NoSQL Serverless

> **Status**: **Superseded** by D28 (Phase 18 — App Service + ACR Migration)
> **Date**: 2026-02-19 · **Superseded**: 2026-02-20
> **Deciders**: jonathan-vella (deployer / first admin)
> **WAF Phase**: Step 2 — Architecture Assessment
> **Related Decisions**: ADR-0002 (authentication), ADR-0003 (security access model), ADR-0004 (single-region)
> **Superseded By**: D28 — Replace SWA with App Service for Linux Containers + ACR (see [04-implementation-plan.md](04-implementation-plan.md))

> [!WARNING]
> **This ADR is superseded.** The SWA managed identity sidecar `expires_on` bug made Cosmos DB MI authentication unreliable. Decision D28 replaces SWA with Azure App Service for Linux Containers + Azure Container Registry. Option E (App Service B1) — previously rejected here — was selected after the SWA MI defect was confirmed as a platform limitation. See [04-implementation-plan.md](04-implementation-plan.md) for the replacement architecture.

## Context

HackerBoard requires a persistent, interactive scoring dashboard for hackathon events. The workload has three characteristics that dominate the architectural choice:

1. **Burst-then-idle usage** — heavy API traffic during a hackathon event (hours to days), then near-zero usage for weeks or months between events
2. **Low concurrent user count** — ≤50 users at peak; ≤200 documents across the busiest containers
3. **Cost sensitivity** — mandate to minimize monthly cost; $50/day ceiling but target as close to zero as possible

The original implementation used Azure SQL (with `mssql` SDK) and Azure Table Storage, both of which incur fixed compute/provisioning costs regardless of usage. A governance audit also found that local auth on Cosmos DB is auto-disabled by policy (`ModifyCosmosDBLocalAuth`), making managed identity the only supported authentication path.

## Decision

Adopt a **fully serverless architecture**:

- **Frontend**: Azure Static Web Apps (Standard) — globally distributed CDN delivery of the vanilla JS SPA
- **API**: Azure Functions (Node.js 20+) — managed by SWA, no separate Function App or App Service Plan
- **Database**: Azure Cosmos DB NoSQL (Serverless) — consumption-based RU billing; zero idle cost; `disableLocalAuth: true` enforced by governance
- **Observability**: Application Insights (workspace-based) + Log Analytics (PerGB2018 free tier)

This replaces Azure SQL (`mssql` SDK) and removes the VNet, private endpoints, and private DNS zones that existed only to support the SQL private endpoint.

## Alternatives Considered

| Option                                         | Pros                                                                            | Cons                                                                                                       | WAF Impact                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **A — SWA + Cosmos DB Serverless** ✅ Selected | Zero idle cost; managed Functions included in SWA; RBAC-native; schema-flexible | Cold starts after idle; single-region only for Cosmos DB Serverless; no AZ support                         | Cost: ↑↑, Security: ↑, Reliability: →, Performance: → |
| **B — SWA + Cosmos DB Provisioned (100 RU/s)** | Consistent latency; no cold starts                                              | ~$5.80/month idle cost; over-provisioned for ≤50 users                                                     | Cost: ↓, Reliability: ↑                               |
| **C — SWA + Azure SQL (keep existing)**        | Familiar schema; strong relational queries                                      | Fixed compute cost ~$5/month minimum; local auth governance conflict; mssql SDK requires connection string | Security: ↓ (local auth), Cost: ↓                     |
| **D — Azure Container Apps + Cosmos DB**       | Full control of runtime; AZ support possible                                    | Significant cost increase (~$30–50/month minimum); operational overhead; out of scope for event tool       | Cost: ↓↓, Operations: ↓                               |
| **E — Azure App Service (B1) + Cosmos DB**     | Familiar model; no cold start                                                   | Fixed ~$13/month compute regardless of usage; requires separate Function App                               | Cost: ↓, Operations: ↓                                |

**Why B was rejected**: The additional $5.80/month for consistent throughput is not justified — the workload's burst pattern means provisioned RUs would be wasted 95% of the time.

**Why C was rejected**: Azure SQL requires a connection string (local auth), which conflicts with the governance policy `ModifyCosmosDBLocalAuth` pattern of disabling local auth. More importantly, the architecture migration to Cosmos DB is already decision D23 in the project backlog.

**Why D and E were rejected**: Both introduce fixed monthly compute costs that eliminate the primary cost advantage of the serverless approach.

## Consequences

### Positive

- **~98% cost reduction vs. ceiling**: Estimated ~$9.01/month (~$0.30/day) against a $50/day ceiling
- **Zero idle cost**: Cosmos DB Serverless charges only for RUs consumed — periods of zero usage cost $0
- **No secrets to manage**: Managed identity + `DefaultAzureCredential` eliminates all connection strings
- **Governance-compliant by default**: `disableLocalAuth: true` satisfies `ModifyCosmosDBLocalAuth` policy automatically
- **Simplified operations**: SWA includes managed Functions — no separate compute resource to monitor or scale
- **Schema flexibility**: Cosmos DB NoSQL allows rubric schema evolution without migrations

### Negative

- **Cold start latency**: Managed Functions (Node.js 20+) may take 1–3 seconds to initialize after idle periods — the `<500 ms p95` API target may be missed on the first post-idle request
- **No Availability Zone support**: Cosmos DB Serverless does not support AZ configuration or `enableAutomaticFailover`
- **Single-region only**: Reliable cross-region replication requires Provisioned mode — accepted risk for event tool
- **Application-side joins**: No native cross-container JOIN support; API code must join data from multiple containers
- **API migration required**: Existing `api/shared/db.js` uses `mssql` SDK and must be replaced with `@azure/cosmos` + `@azure/identity`

### Neutral

- `staticwebapp.config.json` security headers (CSP, HSTS) must be explicitly configured — this is best practice regardless of stack
- SWA Standard tier ($9.00/month flat) is the minimum viable tier for custom auth providers; Free tier cannot support the dual-provider requirement

## WAF Pillar Analysis

| Pillar                    | Impact | Notes                                                                                                                                |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 🔒 Security               | ↑      | Managed identity eliminates credential exposure; RBAC-only Cosmos DB access; no Key Vault required                                   |
| 🔄 Reliability            | →      | SWA CDN is multi-region; Cosmos DB PITR covers RPO=1h; single-region is accepted risk (see ADR-0004)                                 |
| ⚡ Performance            | →      | Sub-10ms Cosmos reads at this data volume; CDN delivers static assets from edge; cold start is a known gap                           |
| 💰 Cost Optimization      | ↑↑     | Serverless billing eliminates idle cost; SWA flat-rate includes Functions; savings ~98% vs budget ceiling                            |
| 🔧 Operational Excellence | ↑      | IaC (Bicep AVM modules) + CI/CD (GitHub Actions) + App Insights from day one; reduced attack/failure surface vs multi-resource model |

**Overall WAF Score (post-decision)**: Security 8/10 · Reliability 7/10 · Performance 7/10 · Cost 9/10 · Operations 7/10

## Compliance Considerations

- **GDPR**: All data stored in `centralus` region (changed from `westeurope` in Phase 18); Cosmos DB Serverless is fully compliant with applicable data residency policies
- **Governance**: `ModifyCosmosDBLocalAuth` policy auto-applies `disableLocalAuth: true` — architecture satisfies this constraint by design
- **MFA**: Deployer must authenticate via `az login` with MFA enforced by governance policy `sys.mfa-write` (Deny effect on resource writes without MFA)
- **9 mandatory RG tags**: Resource group must include all 9 required tags (Deny policy) — must be declared in `main.bicep` at provisioning time

## Implementation Notes

- **AVM Modules**: Use `br/public:avm/res/document-db/database-account:0.18.0` (Cosmos DB) and `br/public:avm/res/web/static-site:0.9.3` (SWA)
- **API code**: Replace `api/shared/db.js` (`mssql` → `@azure/cosmos`); replace `api/shared/auth.js` connection string handling with `DefaultAzureCredential`
- **Cold start mitigation**: Add `/api/health` endpoint and invoke it as a warm-up step before each hackathon event; optionally add a GitHub Actions scheduled workflow to keep Functions warm
- **Partition key design**: `/teamId` for `scores`, `submissions`, `attendees`; `/id` for `teams`, `rubrics`, `config` — avoids cross-partition fan-out for the most frequent queries
- **Remove**: `infra/modules/sql-server.bicep`, `sql-grant.bicep`, `sql-private-endpoint.bicep`, `vnet.bicep`, `private-dns.bicep`

---

| ⬅️ [02-architecture-assessment.md](02-architecture-assessment.md) | 🏠 [Project Index](README.md) | ➡️ [03-des-adr-0002-dual-authentication.md](03-des-adr-0002-dual-authentication.md) |
| ----------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
