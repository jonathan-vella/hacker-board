# HackerBoard — Governance Constraints

![Step](https://img.shields.io/badge/Step-04-blue)
![Type](https://img.shields.io/badge/Type-Governance%20Constraints-purple)
![Status](https://img.shields.io/badge/Status-Revised-yellow)
![Agent](https://img.shields.io/badge/Agent-Bicep%20Plan-orange)

> **Generated**: 2026-02-19 | **Revised**: 2026-02-20 | **Subscription**: noalz (`00858ffc-dded-4f0f-8bbf-e17fff0d47d9`)
> **Tenant**: Lord of the Cloud (`2d04cb4c-999b-4e60-a3a7-e8993edc768b`)
> **Total Policy Assignments**: 21 (9 management group scope, 12 subscription/RG scope)

---

## Table of Contents

- [Discovery Summary](#discovery-summary)
- [Blockers (Deny Effect)](#blockers-deny-effect)
- [Warnings (Audit / AuditIfNotExists)](#warnings-audit--auditifnotexists)
- [Auto-Remediation (Modify / DeployIfNotExists)](#auto-remediation-modify--deployifnotexists)
- [Informational (Disabled / No Impact)](#informational-disabled--no-impact)
- [HackerBoard Impact Analysis](#hackerboard-impact-analysis)
- [Required Adjustments](#required-adjustments)

---

## Discovery Summary

| Metric                           | Value                                                  |
| -------------------------------- | ------------------------------------------------------ |
| **Discovery Method**             | REST API (`Microsoft.Authorization/policyAssignments`) |
| **Management Group Assignments** | 9 (inherited from root tenant MG)                      |
| **Subscription Assignments**     | 6 (subscription scope)                                 |
| **Resource Group Assignments**   | 6 (ArcBox RG only — not relevant)                      |
| **Deny Policies**                | 6 blockers requiring action                            |
| **Audit Policies**               | 44+ (warnings only, no deployment blockers)            |
| **Modify/Deploy Policies**       | 27 auto-remediation rules                              |
| **Status**                       | COMPLETE                                               |

---

## Blockers (Deny Effect)

These policies **will block deployments** if not satisfied. Each must be addressed in Bicep templates.

### B1 — MFA Enforcement on Resource Write Actions

| Field            | Value                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Assignment**   | `sys.mfa-write`                                                                    |
| **Display Name** | Microsoft Azure Multi Factor Authentication Enforcement for Resource Write Actions |
| **Scope**        | Management Group (tenant root)                                                     |
| **Effect**       | **Deny**                                                                           |
| **Impact**       | All resource create/update operations require MFA-authenticated caller             |

**Action Required**: Deployer must authenticate with MFA before running `az deployment`. CI/CD service principals are exempt (they don't use MFA). No Bicep change needed — operational requirement.

### B2 — MFA Enforcement on Resource Delete Actions

| Field            | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| **Assignment**   | `sys.mfa-delete`                                                                    |
| **Display Name** | Microsoft Azure Multi Factor Authentication Enforcement for Resource Delete Actions |
| **Scope**        | Management Group (tenant root)                                                      |
| **Effect**       | **AuditAction** (audit only, NOT Deny)                                              |
| **Impact**       | Delete operations logged but not blocked                                            |

**Action Required**: None — audit only.

### B3 — Resource Group Tag Enforcement (CRITICAL)

| Field            | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| **Assignment**   | `b1ad1a690a5148ec8707ff17`                                       |
| **Display Name** | JV-Enforce Resource Group Tags v3                                |
| **Scope**        | Management Group (tenant root)                                   |
| **Effect**       | **Deny**                                                         |
| **Impact**       | Resource group creation DENIED if missing ANY of 9 required tags |

**Required Tags** (all 9 mandatory on resource group):

| #   | Tag Key         | Description             | HackerBoard Value            |
| --- | --------------- | ----------------------- | ---------------------------- |
| 1   | `environment`   | Deployment stage        | `production`                 |
| 2   | `owner`         | Resource owner          | `jonathan@lordofthecloud.eu` |
| 3   | `costcenter`    | Billing allocation      | _(user-defined)_             |
| 4   | `application`   | Application name        | `hacker-board`               |
| 5   | `workload`      | Workload type           | `web-app`                    |
| 6   | `sla`           | Service level agreement | `non-production`             |
| 7   | `backup-policy` | Backup requirements     | `none`                       |
| 8   | `maint-window`  | Maintenance window      | `any`                        |
| 9   | `tech-contact`  | Technical contact       | `jonathan@lordofthecloud.eu` |

**Action Required**: Bicep `resource group` definition MUST include all 9 tags. Deployment will fail without them.

**Exempted RG name patterns**: `AzureBackupRG*`, `ResourceMover*`, `databricks-rg*`, `NetworkWatcherRG`, `microsoft-network`, `LogAnalyticsDefaultResources`, `rg-amba-*`, `DynamicsDeployments*`, `MC_myResourceGroup*`

### B4 — Block Classic (ASM) Resource Types

| Field            | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| **Assignment**   | `918465337cff47588b23a6e9`                             |
| **Display Name** | Block Azure RM Resource Creation                       |
| **Scope**        | Management Group (tenant root)                         |
| **Effect**       | **Deny** (conditional on `ringValue` tag)              |
| **Impact**       | Blocks Classic compute, network, and storage resources |

**Action Required**: None — HackerBoard uses only ARM resources (SWA, Cosmos DB, Functions). No classic resources involved.

### B6 — Storage Account Key-Based Auth Deny (DISCOVERED IN DEPLOYMENT)

| Field            | Value                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Assignment**   | MCAPSGovDeployPolicies → `ModifyStorageAccountLocalAuth` + Deny policy                                               |
| **Display Name** | Storage Account — Disable Key-Based Authentication                                                                   |
| **Scope**        | Management Group (tenant root)                                                                                       |
| **Effect**       | **Deny** (blocks key-based auth on storage accounts)                                                                 |
| **Impact**       | `Microsoft.Resources/deploymentScripts` cannot be used — ARM runtime creates a backing storage account with key auth |

**Action Required**: **CRITICAL**. ARM deployment scripts (`Microsoft.Resources/deploymentScripts`) require a hidden storage account with key-based authentication for their runtime. This governance policy denies key-based auth on **all** storage accounts in the subscription with no exemptions. Therefore:

- **Deployment scripts are completely unusable** in this subscription
- Any logic previously in deployment scripts must move to `deploy.ps1` (pre/post-deployment step)
- This is a **hard architectural constraint** — cannot be worked around within Bicep

**Resolution (D27)**: The Entra ID app registration (formerly `entra-app.bicep`) is moved to a post-deployment step in `deploy.ps1`, using the deployer’s own MFA-authenticated Graph token.

### B7 — Cosmos DB Private Endpoint Required (USER-REPORTED)

| Field            | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| **Assignment**   | User-reported governance constraint                                             |
| **Display Name** | Cosmos DB must use Private Endpoint                                             |
| **Scope**        | Organizational policy                                                           |
| **Effect**       | **Deny** (Cosmos DB without private endpoint is non-compliant)                  |
| **Impact**       | Cosmos DB account must disable public network access and use a private endpoint |

**Action Required**: **CRITICAL**. Cosmos DB must be accessed exclusively through a private endpoint. This requires:

- A **Virtual Network** with two subnets: one for the private endpoint, one for App Service VNet integration
- A **Private DNS Zone** (`privatelink.documents.azure.com`) linked to the VNet
- A **Private Endpoint** connecting Cosmos DB to the VNet subnet
- **App Service VNet integration** so the app can resolve and reach the Cosmos DB private endpoint
- Cosmos DB `publicNetworkAccess` set to `Disabled`

**Resolution (D31)**: Add networking layer (VNet + Private Endpoint + Private DNS) and integrate App Service into the VNet. This changes the architecture from public-endpoint Cosmos to fully private connectivity.

### B5 — MCAPSGov Deny Policies (Policy Set — 11 rules)

| Field          | Value                          |
| -------------- | ------------------------------ |
| **Assignment** | `MCAPSGovDenyPolicies`         |
| **Scope**      | Management Group (tenant root) |
| **Effect**     | **Deny** (various)             |

**Individual rules and HackerBoard relevance**:

| Rule                              | Target            | Blocks HackerBoard?                     |
| --------------------------------- | ----------------- | --------------------------------------- |
| Block VM SKUs (H/M/N series)      | VMs               | No — no VMs                             |
| AKS Limit Node Count              | AKS               | No — no AKS                             |
| VMSS Limit Node Count             | VMSS              | No — no VMSS                            |
| OpenAI Block Provisioned Capacity | OpenAI            | No — no OpenAI                          |
| Sentinel Commitment Deny          | Sentinel          | No — no Sentinel                        |
| **Azure SQL AAD-Only Auth**       | **SQL Servers**   | **No — using Cosmos DB instead of SQL** |
| SQL MI AAD-Only Auth              | SQL MI            | No — no SQL MI                          |
| Not Allowed Resource Types        | Classic resources | No — ARM only                           |
| Key Vault HSM Purge Protection    | KV HSM            | No — no KV HSM                          |

**Action Required**: None — no HackerBoard resource types are blocked by this policy set.

---

## Warnings (Audit / AuditIfNotExists)

These policies **log compliance findings** but do NOT block deployments.

### Compliance Frameworks (Subscription Scope)

| Assignment                | Framework               | Effect                 | Impact                                                               |
| ------------------------- | ----------------------- | ---------------------- | -------------------------------------------------------------------- |
| `60a5fd56...`             | EU GDPR 2016/679        | Audit                  | Compliance reporting only                                            |
| `0c8e19ce...`             | PCI DSS v4              | Audit                  | Compliance reporting only                                            |
| `Azure_Security_Baseline` | Azure Security Baseline | Audit/AuditIfNotExists | Compliance reporting; DDoS protection disabled; FTPS checks disabled |

### MCAPSGov Audit Policies (44 rules)

| Key Rules Relevant to HackerBoard | Effect           |
| --------------------------------- | ---------------- |
| Defender Security Contact         | Audit            |
| Defender Storage Accounts         | Audit            |
| Logging/Diagnostics Settings      | AuditIfNotExists |
| Function Apps Diagnostic Settings | AuditIfNotExists |

**Action Required**: None for deployment. Address audit findings post-deployment for compliance posture.

### ASC (Defender for Cloud) Policies

| Assignment                    | Description                | Effect            |
| ----------------------------- | -------------------------- | ----------------- |
| DataProtectionSecurityCenter  | Data protection monitoring | AuditIfNotExists  |
| OpenSourceRelationalDatabases | Open-source DB protection  | AuditIfNotExists  |
| SqlVmAndArcSqlServers         | SQL VM/Arc protection      | DeployIfNotExists |

**Action Required**: None — Cosmos DB is not targeted by SQL-specific Defender policies.

---

## Auto-Remediation (Modify / DeployIfNotExists)

These policies **automatically modify** resources after deployment. Plan for their effects.

### Tag Inheritance (Modify)

| Field            | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| **Assignment**   | `558bced8a4e7433e8662e202`                                |
| **Display Name** | JV - Inherit Multiple Tags from Resource Group            |
| **Scope**        | Management Group (tenant root)                            |
| **Effect**       | **Modify**                                                |
| **Impact**       | Auto-copies 9 tags from resource group to child resources |

**Inherited Tags**: `environment`, `owner`, `costcenter`, `application`, `workload`, `sla`, `backup-policy`, `maint-window`, `tech-contact`

**Action Required**: Bicep does NOT need to specify tags on individual resources — the policy auto-propagates from the resource group. However, **the resource group MUST have all 9 tags** (enforced by B3).

### Cosmos DB Local Auth Disable (Modify)

| Field            | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| **Assignment**   | MCAPSGovDeployPolicies → `ModifyCosmosDBLocalAuth`        |
| **Display Name** | SFI-ID4.2.3 Cosmos DB - Safe Secrets Standard             |
| **Scope**        | Management Group (tenant root)                            |
| **Effect**       | **Modify**                                                |
| **Impact**       | Auto-sets `disableLocalAuth = true` on Cosmos DB accounts |

**Action Required**: **CRITICAL for HackerBoard**. This policy will disable Cosmos DB access keys/connection strings. The API layer **MUST use Microsoft Entra ID (RBAC) authentication** with managed identity — NOT connection strings or access keys.

### Storage Account Anonymous Access (Modify)

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| **Assignment** | MCAPSGovDeployPolicies → `ModifyAllowBlobAnonymousAccess` |
| **Effect**     | **Modify**                                                |
| **Impact**     | Sets `allowBlobPublicAccess = false` on storage accounts  |

**Action Required**: None — HackerBoard uses Cosmos DB, not Blob Storage.

### Storage Account Local Auth Disable (Modify + Deny)

| Field          | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| **Assignment** | MCAPSGovDeployPolicies → `ModifyStorageAccountLocalAuth`                       |
| **Effect**     | **Modify** + complementary **Deny**                                            |
| **Impact**     | Disables key-based auth on all storage accounts; blocks creation with key auth |

**Action Required**: **CRITICAL for deployment architecture**. This policy prevents `Microsoft.Resources/deploymentScripts` from functioning because the ARM runtime creates a backing storage account that requires key-based auth. See B6 above.

### MCAPSGov Deploy Policies — Other Auto-Remediation

| Rule                                   | Target          | HackerBoard Impact           |
| -------------------------------------- | --------------- | ---------------------------- |
| Enable Managed Identity on VMs         | VMs             | None — no VMs                |
| Storage Account Disable Local Auth     | Storage         | None — no Storage Account    |
| EventHub/ServiceBus Disable Local Auth | Messaging       | None                         |
| Guest Configuration for Windows        | Windows VMs     | None                         |
| New Resource Group Deploy              | Resource Groups | Auto-applies baseline config |
| CSPM SubPlans Enable                   | Defender        | Auto-enables security plans  |

---

## Informational (Disabled / No Impact)

| Policy                                           | Setting                        | Note                           |
| ------------------------------------------------ | ------------------------------ | ------------------------------ |
| Azure Security Baseline — DDoS Protection        | Disabled                       | Not enforced                   |
| Azure Security Baseline — FTPS for Function Apps | Disabled                       | Not enforced                   |
| Azure Security Baseline — FTPS for Web Apps      | Disabled                       | Not enforced                   |
| ArcBox policies (6 assignments)                  | RG-scoped to `rg-arcbox-swc01` | Does not affect HackerBoard RG |

---

## HackerBoard Impact Analysis

### Resources Planned

| Resource                       | Type                                                            | Affected By Policies?                                                  |
| ------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Resource Group                 | `Microsoft.Resources/subscriptions/resourceGroups`              | **YES** — B3 (9 required tags)                                         |
| App Service (Linux Container)  | `Microsoft.Web/sites`                                           | No blockers; tag inheritance auto-applies; needs VNet integration (B7) |
| Cosmos DB Account (Serverless) | `Microsoft.DocumentDB/databaseAccounts`                         | **YES** — local auth DISABLED + **private endpoint required** (B7)     |
| Cosmos DB SQL Database         | `Microsoft.DocumentDB/databaseAccounts/sqlDatabases`            | Inherits from account                                                  |
| Cosmos DB Containers (6)       | `Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers` | Inherits from account                                                  |
| Virtual Network (NEW)          | `Microsoft.Network/virtualNetworks`                             | **YES** — required for private endpoint (B7)                           |
| Private Endpoint (NEW)         | `Microsoft.Network/privateEndpoints`                            | **YES** — required for Cosmos DB private connectivity (B7)             |
| Private DNS Zone (NEW)         | `Microsoft.Network/privateDnsZones`                             | **YES** — required for private endpoint DNS resolution (B7)            |

> **Removed from plan** (D27): Deployment Script (`Microsoft.Resources/deploymentScripts`) — blocked by B6 (storage key auth deny).
> Entra ID app registration moved to `deploy.ps1` post-deployment step.

---

## Required Adjustments

### 1. Resource Group Tags (Bicep Change — MANDATORY)

The resource group **must** include all 9 tags or deployment fails. Bicep template must define:

```bicep
resource rg 'Microsoft.Resources/subscriptions/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: {
    environment: environmentTag       // e.g., 'production'
    owner: ownerTag                   // e.g., 'jonathan@lordofthecloud.eu'
    costcenter: costcenterTag         // e.g., 'hackathon'
    application: 'hacker-board'
    workload: 'web-app'
    sla: slaTag                       // e.g., 'non-production'
    'backup-policy': 'none'
    'maint-window': 'any'
    'tech-contact': techContactTag    // e.g., 'jonathan@lordofthecloud.eu'
  }
}
```

### 2. Cosmos DB — Entra ID RBAC Authentication (Architecture Change — MANDATORY)

The `ModifyCosmosDBLocalAuth` policy **will auto-disable connection strings/keys** on any Cosmos DB account. The application **must** use Entra ID RBAC:

**Bicep changes**:

- Enable system-assigned managed identity on the Static Web App
- Assign `Cosmos DB Built-in Data Contributor` role to the SWA managed identity
- Set `disableLocalAuth: true` explicitly in Bicep (align with policy)

**API code changes**:

- Use `@azure/identity` `DefaultAzureCredential` instead of connection strings
- Initialize Cosmos DB client with `ManagedIdentityCredential` or `DefaultAzureCredential`

```javascript
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  aadCredentials: credential,
});
```

### 3. Deployment Scripts Blocked — Move to deploy.ps1 (Architecture Change — MANDATORY)

The B6 governance policy blocks key-based auth on all storage accounts. Since `Microsoft.Resources/deploymentScripts` requires a backing storage account with key auth, **deployment scripts are completely unusable** in this subscription.

**Resolution (D27)**: Move Entra ID app registration logic from `entra-app.bicep` to `deploy.ps1`:

- Remove `modules/entra-app.bicep` from Bicep templates
- Remove `deploymentIdentity` UAMI from `main.bicep` (only existed for the deployment script)
- Add Entra app registration as a post-deployment step in `deploy.ps1`, using the deployer’s own Graph token
- The deployer’s credentials are already MFA-authenticated (required by B1)

### 4. MFA Requirement (Operational — No Code Change)

The deployer must authenticate with MFA before running deployments. This is an operational requirement, not a code change. CI/CD pipelines using service principals are unaffected.

### 5. Cosmos DB Private Endpoint + VNet Integration (Architecture Change — MANDATORY)

Cosmos DB must be accessed exclusively via private endpoint (B7). This requires a full networking layer:

**New Bicep modules**:

- `modules/networking.bicep` — VNet with two subnets:
  - `snet-pe` — for Private Endpoint (no delegations)
  - `snet-app` — for App Service VNet integration (delegated to `Microsoft.Web/serverFarms`)
- `modules/cosmos-private-endpoint.bicep` — Private Endpoint + Private DNS Zone + VNet link

**Bicep changes to existing modules**:

- `modules/cosmos-account.bicep` — set `publicNetworkAccess: 'Disabled'`
- `modules/app-service.bicep` — add `virtualNetworkSubnetId` for VNet integration

**Naming** (CAF conventions):

| Resource               | Name                              |
| ---------------------- | --------------------------------- |
| Virtual Network        | `vnet-hacker-board-prod`          |
| PE Subnet              | `snet-pe`                         |
| App Integration Subnet | `snet-app`                        |
| Private Endpoint       | `pep-cosmos-hacker-board-prod`    |
| Private DNS Zone       | `privatelink.documents.azure.com` |

### 6. No Code Changes Required For

- Classic resource block — not using any classic resources
- VM SKU restrictions — no VMs
- SQL AAD-only auth — using Cosmos DB, not SQL
- Storage blob anonymous access — not using Blob Storage
- ArcBox policies — scoped to a different resource group

---

> **Bottom Line**: Four mandatory adjustments are needed:
>
> 1. **9 required tags on resource group** (Bicep template change)
> 2. **Cosmos DB must use Entra ID RBAC** (no connection strings — architecture + code change)
> 3. **Deployment scripts cannot be used** — B6 policy blocks storage key auth (move Entra app registration to `deploy.ps1`)
> 4. **Cosmos DB must use a Private Endpoint** — requires VNet, Private DNS Zone, Private Endpoint, and App Service VNet integration (B7 — architecture + Bicep change)
>
> Everything else either doesn't apply to HackerBoard or is auto-remediated.

---

← Back to [agent-output/hacker-board](../README.md)
