# ADR-0004: Single-Region Deployment

> **Status**: **Updated** (Phase 18 — Region changed from `westeurope` to `centralus`)
> **Date**: 2026-02-19 · **Updated**: 2026-02-20
> **Deciders**: jonathan-vella (deployer / first admin)
> **WAF Phase**: Step 2 — Architecture Assessment
> **Related Decisions**: ADR-0001 (serverless stack — superseded by D28)

## Context

HackerBoard requires a primary deployment region. Two factors bear on this choice:

1. **Data residency**: The subscription has the EU GDPR 2016/679 audit policy (`60a5fd56...`) assigned — hackathon participant data (even anonymized aliases) must remain within the EU to satisfy the policy intent and minimize compliance risk
2. **Reliability vs. cost trade-off**: Multi-region deployments (active-active or active-passive) improve availability and reduce RTO/RPO, but add cost, operational complexity, and are architecturally incompatible with Cosmos DB Serverless (which is single-region only)

The workload is also non-production in nature: a short-lived event tool used during hackathons with a 30-day data retention policy, a 4-hour RTO, and a 1-hour RPO. This characterisation affects the acceptable risk threshold for regional availability.

## Decision

Deploy to **`centralus` as a single region** with no failover region and no cross-region replication:

- All Azure resources provisioned in `centralus`
- Cosmos DB Serverless operates in single-region mode (`locations: [{ locationName: centralus, failoverPriority: 0 }]`)
- App Service serves both static assets and API from `centralus`
- RTO (4 hours) and RPO (1 hour) met by: Cosmos DB continuous PITR (7-day) and Bicep IaC re-provisioning from Git
- No secondary region, no Azure Traffic Manager, no geo-replication

## Alternatives Considered

| Option                                                                       | Pros                                                                           | Cons                                                                                                                         | WAF Impact                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **A — `centralus` single-region** ✅ Selected                                | No added cost; compatible with Cosmos DB Serverless; RTO/RPO met by IaC + PITR | Regional outage = full outage; no automatic failover                                                                         | Cost: ↑↑, Reliability: ↓ (accepted)     |
| **B — `westeurope` primary + `northeurope` passive (Cosmos DB Provisioned)** | RPO near-zero; automatic failover for Cosmos DB                                | Requires Provisioned mode (~$11.60/month for 100 RU/s × 2 regions); extra SWA deployment; Traffic Manager; ~3× cost increase | Cost: ↓↓, Reliability: ↑↑               |
| **C — `swedencentral` single-region**                                        | Newer Azure region; typically lower carbon footprint                           | Slightly higher latency for Western European users; not the existing subscription default                                    | Cost: →, Reliability: →                 |
| **D — `uksouth` single-region**                                              | Lower latency for UK-based events                                              | Post-Brexit data residency considerations for EU GDPR; not the subscription default                                          | Cost: →, Reliability: →, Compliance: ⚠️ |

**Why B was rejected**: Switching to Cosmos DB Provisioned Throughput to enable multi-region destroys the core cost benefit of the serverless architecture — monthly cost would increase from ~$9.01 to ~$30–50+. For a tool used during events with a 4-hour RTO acceptable to stakeholders, this cost is not justified.

**Why C was rejected**: `swedencentral` is a valid alternative but `centralus` is the current deployment region reflected in all Bicep parameter files and governance tag values. Migrating adds churn with no meaningful benefit.

**Why D was rejected**: UK South introduces data residency ambiguity post-Brexit — `centralus` was selected for Cosmos DB availability and service parity.

## Consequences

### Positive

- **Data residency**: `centralus` selected for Cosmos DB Serverless availability and full service parity; all participant data remains in-region
- **Zero multi-region cost**: No Traffic Manager, no secondary region compute, no geo-replication egress charges
- **Compatible with Cosmos DB Serverless**: Serverless mode is single-region by design — this decision is architecturally consistent
- **SWA CDN compensates at the static layer**: Even in a single-region deployment, SWA delivers HTML/CSS/JS from global CDN PoPs — the 99.9% SLA for static asset availability is not degraded by single-region backend
- **Simple IaC**: Single `location` parameter throughout all Bicep modules — no conditional multi-region logic

### Negative

- **Single point of regional failure**: A `centralus` outage (rare but possible) results in full application unavailability — no automatic failover
- **4-hour RTO is manual**: Recovery requires a deployer to re-run `deploy.ps1` from Git + restore Cosmos DB PITR — no automated failover process
- **1-hour RPO via PITR only**: Data written in the last hour before an outage could be lost if the Cosmos DB service itself is affected — PITR restores to a point, not to zero data loss
- **Cosmos DB Serverless cannot be upgraded to multi-region in-place**: If the reliability requirement changes, the database must be recreated in Provisioned mode — a migration, not a configuration change

### Neutral

- `centralus` SLA for Cosmos DB is 99.999% for reads and 99.99% for writes (multi-master) — in practice, single-region `centralus` downtime is rare and short
- The 4-hour RTO is not driven by architecture limitations but by the non-production nature of the workload — stakeholders have accepted this risk explicitly

## WAF Pillar Analysis

| Pillar                    | Impact | Notes                                                                                                                      |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| 🔒 Security               | →      | Region choice has no meaningful security impact; EU GDPR data residency is satisfied                                       |
| 🔄 Reliability            | ↓      | Explicit accepted trade-off: single-region removes automatic failover; RTO=4h is intentionally relaxed; PITR covers RPO=1h |
| ⚡ Performance            | →      | App Service serves both static assets and API from `centralus` — no CDN but acceptable latency for target users            |
| 💰 Cost Optimization      | ↑↑     | Avoids multi-region compute, Traffic Manager, and Cosmos DB Provisioned throughput costs                                   |
| 🔧 Operational Excellence | ↑      | Single region simplifies monitoring, alerting, and deployment pipelines; no cross-region coordination required             |

## Compliance Considerations

- **Data residency**: `centralus` (Iowa, US) — selected for Cosmos DB Serverless availability; all participant data stored in-region
- **Data lifecycle**: 30-day data retention post-event enforced by `scripts/cleanup-app-data.js` — regional choice does not affect the retention obligation
- **PITR**: Cosmos DB continuous backup retains 7-day PITR window — satisfies the 1-hour RPO for recovery within the same region

## Implementation Notes

- **Parameter file**: `infra/main.bicepparam` sets `location = 'centralus'`; this single parameter propagates to all modules — no per-module region override needed
- **Governance tags**: `DataResidency: centralus` should be included in the resource group tags to document the data residency decision for compliance reporting
- **Recovery runbook**: Document the `deploy.ps1` re-run procedure and Cosmos DB PITR restore steps as an event-day runbook — the 4-hour RTO is only achievable if the deployer knows the recovery process before an outage
- **Future migration path**: If reliability requirements increase (e.g., SLA upgrade to 99.95%), the migration path is: (1) recreate Cosmos DB in Provisioned mode with multi-region `locations` array, (2) migrate data, (3) add a secondary App Service deployment with Traffic Manager

---

| ⬅️ [03-des-adr-0003-cosmos-db-rbac-access-model.md](03-des-adr-0003-cosmos-db-rbac-access-model.md) | 🏠 [Project Index](README.md) | ➡️ [04-implementation-plan.md](04-implementation-plan.md) |
| --------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
