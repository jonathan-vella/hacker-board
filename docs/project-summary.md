# HackerBoard — Project Summary

![Type](https://img.shields.io/badge/Type-Project%20Summary-blue)
![Status](https://img.shields.io/badge/Status-Live-brightgreen)
![Updated](https://img.shields.io/badge/Updated-2026--02--23-lightgrey)

Consolidated reference for architecture decisions, governance constraints, and deployment history. Replaces the `agent-output/` artefacts produced during the agentic build workflow.

---

## Table of Contents

- [What Was Built](#what-was-built)
- [Architecture Decisions](#architecture-decisions)
- [Governance Constraints](#governance-constraints)
- [WAF Assessment](#waf-assessment)
- [Deployment History](#deployment-history)

---

## What Was Built

HackerBoard is a live, interactive hackathon scoring dashboard. A single Linux container (Node.js 20 Alpine, port 8080) serves both the vanilla JS SPA and an Express 5.x API. All application data lives in Azure Cosmos DB NoSQL (Serverless). Authentication uses GitHub OAuth via App Service Easy Auth.

### Final Stack

| Layer         | Technology                                                     |
| ------------- | -------------------------------------------------------------- |
| Frontend      | Vanilla JS SPA (ES2022+) — `src/index.html`                    |
| API           | Express 5.x adapter wrapping Azure Functions v4-style handlers |
| Container     | Docker — Node.js 20 Alpine, port 8080                          |
| Hosting       | Azure App Service for Linux Containers (S1)                    |
| Image storage | Azure Container Registry (Basic)                               |
| Database      | Azure Cosmos DB NoSQL (Serverless) — 6 containers              |
| Auth          | GitHub OAuth via App Service Easy Auth (`/.auth/*`)            |
| Identity      | Managed identity + `DefaultAzureCredential` for Cosmos DB      |
| Observability | Application Insights + Log Analytics (PerGB2018)               |
| Networking    | VNet (10.0.0.0/16) + Private Endpoint for Cosmos DB            |
| IaC           | Bicep (Azure Verified Modules) — `infra/main.bicep`            |
| CI/CD         | GitHub Actions → Docker → ACR → App Service (ACR CD webhook)   |

---

## Architecture Decisions

### ADR-0001: App Service + ACR (supersedes SWA)

**Decision**: Replace Azure Static Web Apps with App Service for Linux Containers + ACR.

**Why**: The SWA managed identity sidecar had an `expires_on` parsing bug that made Cosmos DB MI authentication unreliable (the token expiry was unparseable, causing 401 failures after the token aged). App Service managed identity is production-hardened and has no such defect.

**Trade-offs accepted**:

- Fixed S1 compute cost (~$13.14/month) versus SWA's managed Functions model
- ACR adds ~$5/month
- The Express adapter pattern preserved all 130 existing tests unchanged

**Rejected alternatives**: SWA with Functions (MI bug), Container Apps (~$30–50+/month), Azure SQL (governance conflict — local auth disabled by policy).

---

### ADR-0002: Dual Authentication (GitHub OAuth + Entra ID)

**Decision**: GitHub OAuth via App Service Easy Auth for all users. Entra ID identity used by the deploying user to assign the first admin app role.

**Why**: Event participants all have GitHub accounts. App Service Easy Auth provides the same `/.auth/*` contract as SWA built-in auth, so the frontend required zero changes. Admin role is enforced by the `ADMIN_USERS` app setting checked at request time in `api/shared/auth.js` — no Entra ID app role assignments required at runtime.

---

### ADR-0003: Cosmos DB RBAC-Only Access

**Decision**: Cosmos DB local authentication disabled (`disableLocalAuth: true`). App Service authenticates via `DefaultAzureCredential` + Cosmos DB Built-in Data Contributor role.

**Why**: Azure Policy `ModifyCosmosDBLocalAuth` (Modify effect) auto-disables local auth at the subscription. Connection strings would fail governance. The managed identity path is cleaner — no secrets to store, rotate, or leak.

---

### ADR-0004: Single-Region Deployment

**Decision**: Deploy to `centralus` only. No geo-replication, no Availability Zones.

**Why**: HackerBoard is an internal, short-lived event tool (hours to days of active use). The cost of multi-region Cosmos DB (requires Provisioned mode — no Serverless) and AZ-aware App Service plans is not justified. Accepted risk: RTO ~4h, RPO ~1h via Cosmos PITR.

---

## Governance Constraints

The subscription (`noalz`) has 21 policy assignments. Key constraints that affected Bicep templates:

| ID  | Policy                         | Effect | Impact on HackerBoard                                                                                                                                                        |
| --- | ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | MFA on resource write actions  | Deny   | Deployer must use MFA. CI/CD service principals are exempt.                                                                                                                  |
| B3  | Resource Group tag enforcement | Deny   | RG must have all 9 tags: `environment`, `owner`, `costcenter`, `application`, `workload`, `sla`, `backup-policy`, `maint-window`, `tech-contact`. `deploy.ps1` handles this. |
| B5  | Cosmos DB local auth disabled  | Modify | `disableLocalAuth: true` is set by policy automatically. Bicep also sets it explicitly to avoid drift.                                                                       |
| B7  | Cosmos DB public access        | Modify | `publicNetworkAccess: Disabled` enforced. Requires VNet + Private Endpoint.                                                                                                  |
| B8  | TLS 1.2 minimum                | Deny   | `minimalTlsVersion: 'Tls12'` set on all applicable resources.                                                                                                                |

The `deploy.ps1` script applies all 9 required resource group tags and runs the Bicep deployment, which satisfies all policy constraints at provision time.

---

## WAF Assessment

Assessment as of Phase 18 (App Service + ACR + Cosmos DB Serverless, centralus, single-region):

| Pillar                 | Score | Key strength                                     | Accepted gap                                |
| ---------------------- | ----- | ------------------------------------------------ | ------------------------------------------- |
| Security               | 8/10  | No secrets, RBAC-only Cosmos, dual auth, TLS 1.2 | Public App Service endpoint (no WAF/AFD)    |
| Reliability            | 7/10  | 99.9% SLA, Cosmos PITR (RPO 1h)                  | Single-region, no AZ support for Serverless |
| Performance            | 7/10  | Sub-10ms Cosmos reads at this data volume        | No CDN in front of static assets            |
| Cost Optimization      | 9/10  | ~$18.15/month — 98% under $50/day ceiling        | S1 fixed cost regardless of usage           |
| Operational Excellence | 7/10  | IaC + CI/CD + App Insights + structured logging  | No automated alert rules                    |

**Primary optimized pillar**: Cost Optimization.

---

## Deployment History

The infrastructure was first successfully deployed on **2026-02-21** as deployment `hacker-board-20260221-153137` (Incremental, Succeeded).

### Deployed Resources

| Resource                          | Name                              | SKU / Tier  |
| --------------------------------- | --------------------------------- | ----------- |
| Log Analytics Workspace           | `law-hacker-board-prod`           | PerGB2018   |
| Application Insights              | `appi-hacker-board-prod`          | web         |
| Cosmos DB Account (Serverless)    | `cosmos-hacker-board-prod`        | Serverless  |
| Cosmos DB Database + 6 Containers | `hackerboard`                     | —           |
| Virtual Network                   | `vnet-hacker-board-prod`          | 10.0.0.0/16 |
| Subnet (App, delegated)           | `snet-app`                        | 10.0.2.0/24 |
| Subnet (Private Endpoint)         | `snet-pe`                         | 10.0.1.0/24 |
| Private Endpoint                  | `pep-cosmos-hacker-board-prod`    | Sql         |
| Private DNS Zone                  | `privatelink.documents.azure.com` | global      |
| Container Registry                | `crhackerboardprod`               | Basic       |
| App Service Plan                  | `asp-hacker-board-prod`           | S1 Linux    |
| Web App for Containers            | `app-hacker-board-prod`           | Linux       |
| Cosmos DB RBAC assignments        | Built-in Data Contributor × 3     | —           |

> **Why S1 and not P1v3**: The subscription had zero PremiumV3 quota in `centralus`. S1 Standard fully supports regional VNet integration.

### Key Outputs

| Output             | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| App Service URL    | `https://app-hacker-board-prod.azurewebsites.net`           |
| ACR Login Server   | `crhackerboardprod.azurecr.io`                              |
| Cosmos DB Endpoint | `https://cosmos-hacker-board-prod.documents.azure.com:443/` |
| Resource Group     | `rg-hacker-board-prod` (centralus)                          |
| Subscription       | `noalz` (`00858ffc-dded-4f0f-8bbf-e17fff0d47d9`)            |

---

[← Back to Documentation](README.md)
