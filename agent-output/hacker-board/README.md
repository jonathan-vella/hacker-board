# HackerBoard — Agent Output

![Project](https://img.shields.io/badge/Project-HackerBoard-blue)
![Status](https://img.shields.io/badge/Status-Phase%2018%20Complete-brightgreen)

> Agent-generated artifacts for the HackerBoard infrastructure deployment.

---

## Workflow Progress

| Step   | Name             | Agent               | Status       | Artifacts                                                        |
| ------ | ---------------- | ------------------- | ------------ | ---------------------------------------------------------------- |
| **01** | **Requirements** | **Requirements**    | **Complete** | [01-requirements.md](01-requirements.md)                         |
| **02** | **Architecture** | **Azure Architect** | **Complete** | [02-architecture-assessment.md](02-architecture-assessment.md)   |
| **03** | **Design**       | **Azure Architect** | **Complete** | ADRs + refreshed architecture diagram (updated 2026-02-20)       |
| **04** | **Bicep Plan**   | **Bicep Plan**      | **Complete** | See below                                                        |
| **05** | **Bicep Code**   | **Bicep Code**      | **Complete** | [05-implementation-reference.md](05-implementation-reference.md) |
| **06** | **Deploy**       | **Deploy**          | **Complete** | [06-deployment-summary.md](06-deployment-summary.md)             |
| 07     | As-Built         | —                   | Not started  | —                                                                |

---

## Step 1 Artifacts

| File                                     | Description                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| [01-requirements.md](01-requirements.md) | Consolidated requirements: F1–F11, NFRs, compliance, budget, operations |

---

## Step 2 Artifacts

| File                                                           | Description                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [02-architecture-assessment.md](02-architecture-assessment.md) | WAF 5-pillar assessment, SKU recommendations, cost estimate (~$9.01/month) |

---

## Step 3 Artifacts

### Architecture Diagram

| File                                     | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| [03-des-diagram.py](03-des-diagram.py)   | Python source — regenerate with `python3 03-des-diagram.py` |
| [03-des-diagram.png](03-des-diagram.png) | Design architecture diagram (App Service + ACR + Cosmos DB) |

### Architecture Decision Records

| File                                                                                             | Decision                                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [03-des-adr-0001-serverless-stack-selection.md](03-des-adr-0001-serverless-stack-selection.md)   | D23 — SWA Standard + Cosmos DB NoSQL Serverless (**Superseded by D28**) |
| [03-des-adr-0002-dual-authentication.md](03-des-adr-0002-dual-authentication.md)                 | D24 — Dual-provider auth via SWA built-in auth (**Superseded by D30**)  |
| [03-des-adr-0003-cosmos-db-rbac-access-model.md](03-des-adr-0003-cosmos-db-rbac-access-model.md) | D25/D26 — RBAC-only Cosmos DB access (Updated: App Service MI)          |
| [03-des-adr-0004-single-region-deployment.md](03-des-adr-0004-single-region-deployment.md)       | D27 — Single-region `centralus` (Updated from `westeurope`)             |

---

## Step 4 Artifacts

> **Updated for Phase 18.4** — App Service + ACR migration (replaces original Cosmos DB migration plan)

| File                                                             | Description                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [04-implementation-plan.md](04-implementation-plan.md)           | Phase 18.4 — App Service + ACR migration implementation plan (4 phases)        |
| [04-preflight-check.md](04-preflight-check.md)                   | AVM schema validation, pitfall analysis, advisory items — Step 4b (prior plan) |
| [04-governance-constraints.md](04-governance-constraints.md)     | Governance policy analysis (21 assignments, 2 mandatory adjustments)           |
| [04-governance-constraints.json](04-governance-constraints.json) | Machine-readable governance policy data                                        |
| [04-dependency-diagram.py](04-dependency-diagram.py)             | Python source for deployment dependency diagram (ACR + App Service)            |
| [04-dependency-diagram.png](04-dependency-diagram.png)           | Deployment dependency diagram (generated)                                      |
| [04-runtime-diagram.py](04-runtime-diagram.py)                   | Python source for runtime flow diagram (Express + Easy Auth + Cosmos)          |
| [04-runtime-diagram.png](04-runtime-diagram.png)                 | Runtime flow diagram (generated)                                               |

---

## Step 5 Artifacts

| File                                                             | Description                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [05-implementation-reference.md](05-implementation-reference.md) | Bicep code implementation reference — ACR + App Service + Easy Auth (Phase 18) |

---

## Step 6 Artifacts

| File                                                 | Description                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| [06-deployment-summary.md](06-deployment-summary.md) | Deployment summary — pending redeployment for App Service + ACR (Phase 18) |

---

← Back to [docs/README.md](../../docs/README.md)
