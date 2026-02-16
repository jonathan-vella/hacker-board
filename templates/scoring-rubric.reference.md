# Scoring Rubric — Reference Implementation

> [!IMPORTANT]
> This file is the **single source of truth** for all scoring values.
> The app PRD, challenge files, scripts, and all other docs MUST derive their
> point values and grading rules from this rubric. If a conflict exists
> elsewhere, this file wins.

> **105-point base + 25 bonus** | WAF-aligned | 🤖 Script-assisted + facilitator scoring

> **Note**: Challenge 8 (Partner Showcase) is scored manually by facilitators (0-10)
> using the `-ShowcaseScore` parameter.

---

## Scoring Overview

| Category                | Points  | Automated? |
| ----------------------- | ------- | ---------- |
| Requirements & Planning | 20      | ✅         |
| Architecture Design     | 25      | ✅         |
| Implementation Quality  | 25      | ✅         |
| Deployment Success      | 10      | ✅         |
| Load Testing            | 5       | ✅         |
| Documentation           | 5       | ✅         |
| Diagnostics             | 5       | ✅         |
| Partner Showcase        | 10      | 🧑‍⚖️ Manual  |
| **Base Total**          | **105** |            |
| **Bonus Points**        | +25     | ✅         |
| **Max Total**           | **130** |            |

---

## Detailed Criteria

### 1. Requirements & Planning (20 pts)

**File**: `agent-output/{team}/01-requirements.md`

| Criterion                | Points |
| ------------------------ | ------ |
| Project context complete | 4      |
| Functional requirements  | 4      |
| NFRs (SLA, RTO, RPO)     | 4      |
| Compliance identified    | 4      |
| Budget stated            | 4      |

### 2. Architecture Design (25 pts)

**File**: `agent-output/{team}/02-architecture-assessment.md`

| Criterion            | Points |
| -------------------- | ------ |
| Cost estimation      | 5      |
| Reliability patterns | 5      |
| Security controls    | 5      |
| Scalability approach | 5      |
| Service selection    | 5      |

### 3. Implementation Quality (25 pts)

**Files**: `infra/bicep/{team}/`

| Criterion          | Points |
| ------------------ | ------ |
| Bicep compiles     | 5      |
| Bicep lints clean  | 5      |
| Naming conventions | 5      |
| Security hardened  | 5      |
| Modular structure  | 5      |

### 4. Deployment Success (10 pts)

**Verification**: Azure Portal / CLI

| Criterion              | Points |
| ---------------------- | ------ |
| What-If executed       | 2      |
| Deployment succeeded   | 4      |
| Core resources running | 2      |
| Summary documented     | 2      |

### 5. Load Testing (5 pts)

**File**: `agent-output/{team}/05-load-test-results.md`

| Criterion          | Points |
| ------------------ | ------ |
| Test executed      | 2      |
| Targets documented | 1      |
| Results analyzed   | 2      |

### 6. Documentation (5 pts)

**Files**: `agent-output/{team}/07-ab-*.md`

| Criterion                 | Points |
| ------------------------- | ------ |
| Operations guide complete | 2      |
| Architecture documented   | 2      |
| Clear formatting          | 1      |

### 7. Diagnostics (5 pts)

**File**: `agent-output/{team}/07-ab-diagnostics-runbook.md`

| Criterion                    | Points |
| ---------------------------- | ------ |
| Troubleshooting steps clear  | 2      |
| Monitoring queries included  | 2      |
| Incident response documented | 1      |

### 8. Partner Showcase (10 pts)

**Scoring method**: Facilitator manually assigns 0-10

| Criterion               | Points |
| ----------------------- | ------ |
| Technical communication | 3      |
| Customer engagement     | 2      |
| Solution justification  | 2      |
| Team collaboration      | 2      |
| Active listening        | 1      |

---

## Bonus Points (+25 max)

| Enhancement        | Points | Verification                          |
| ------------------ | ------ | ------------------------------------- |
| Zone Redundancy    | +5     | P1v3+ SKU, `zoneRedundant: true`      |
| Private Endpoints  | +5     | PE resources in Bicep                 |
| Multi-Region DR    | +10    | Resources in 2+ regions               |
| Managed Identities | +5     | SystemAssigned, no connection strings |

---

## Score Sheet

| Team | Req | Arch | Impl | Deploy | Load | Docs | Diag | Show | Bonus | Total |
| ---- | --- | ---- | ---- | ------ | ---- | ---- | ---- | ---- | ----- | ----- |
| 1    | /20 | /25  | /25  | /10    | /5   | /5   | /5   | /10  |       | /105  |
| 2    | /20 | /25  | /25  | /10    | /5   | /5   | /5   | /10  |       | /105  |
| 3    | /20 | /25  | /25  | /10    | /5   | /5   | /5   | /10  |       | /105  |
| 4    | /20 | /25  | /25  | /10    | /5   | /5   | /5   | /10  |       | /105  |

---

## Grading Scale

Percentage is calculated from the 105-point base score.
Bonus points are additive to the total but do not affect the grade tier.

| Percentage | Grade                |
| ---------- | -------------------- |
| ≥90%       | 🏆 OUTSTANDING       |
| ≥80%       | 🥇 EXCELLENT         |
| ≥70%       | 🥈 GOOD              |
| ≥60%       | 🥉 SATISFACTORY      |
| <60%       | 📚 NEEDS IMPROVEMENT |

---

## Award Categories (Optional)

| Award                | Criteria         |
| -------------------- | ---------------- |
| 🏆 Best Overall      | Highest total    |
| 🛡️ Security Champion | Best security    |
| 💰 Cost Optimizer    | Best efficiency  |
| 📐 Best Architecture | Most WAF-aligned |
| 🚀 Speed Demon       | First to deploy  |
