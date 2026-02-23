# HackerBoard — Requirements

![Type](https://img.shields.io/badge/Type-Requirements-blue)
![Status](https://img.shields.io/badge/Status-Final-brightgreen)
![Updated](https://img.shields.io/badge/Updated-2026--02--23-lightgrey)

---

## Table of Contents

- [What HackerBoard Does](#what-hackerboard-does)
- [Who Uses It](#who-uses-it)
- [Features](#features)
- [Non-Functional Requirements](#non-functional-requirements)
- [Data & Storage](#data--storage)
- [Security Requirements](#security-requirements)
- [Infrastructure Requirements](#infrastructure-requirements)

---

## What HackerBoard Does

HackerBoard is a live, interactive hackathon scoring dashboard designed for MicroHack-style events. It replaces manual JSON file scoring with a browser-based submission and review workflow backed by a persistent leaderboard.

**Core workflow:**

1. Admin creates teams and uploads or defines a scoring rubric
2. Attendees register and are assigned to teams
3. Teams submit their scores via a form or JSON file upload
4. Admins review pending submissions — approve, reject with reason, or manually override
5. Approved scores appear on the live leaderboard, ranked and graded
6. Admin assigns award categories to teams
7. Leaderboard auto-refreshes every 30 seconds throughout the event

---

## Who Uses It

| Role          | Description                                                                                 | Typical Count |
| ------------- | ------------------------------------------------------------------------------------------- | ------------- |
| **Admin**     | Event facilitator. Manages teams, rubric, attendees, validates submissions, assigns awards. | 1–3           |
| **Member**    | Hackathon participant. Submits own team's scores, views leaderboard and team roster.        | 20–50         |
| **Anonymous** | Not supported. All routes require GitHub OAuth login.                                       | 0             |

Admins are identified by the `ADMIN_USERS` app setting configured at deploy time (e.g. `github:octocat`). All authenticated users who are not in that list are treated as Members.

---

## Features

All 11 features are required for a functioning event. None are optional.

| #   | Feature                            | Who      | Description                                                                                                                                                                     |
| --- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Team Score Submission Form         | Member   | Submit scores for own team across all rubric categories (8 base + 4 bonus). Validates totals against maximums. Saves as pending until approved.                                 |
| F2  | Live Leaderboard                   | Everyone | Ranked table sorted by total score (descending). Auto-refreshes every 30s. Expandable rows show category breakdown. Mobile-responsive.                                          |
| F3  | Grading Display                    | Everyone | Grade computed as `(baseScore / 105) × 100`. Colour-coded tier badges: Outstanding / Excellent / Good / Satisfactory / Needs Improvement.                                       |
| F4  | Award Categories                   | Admin    | Admin assigns one of 5 award types (Best Overall, Security Champion, Cost Optimizer, Best Architecture, Speed Demon) to teams. Badges appear on leaderboard.                    |
| F5  | GitHub OAuth Authentication        | Everyone | All routes require sign-in. GitHub OAuth via App Service Easy Auth (`/.auth/login/github`). Role determined by `ADMIN_USERS` setting.                                           |
| F6  | JSON Score Upload                  | Member   | Upload `score-results.json` for own team. Schema validated. Preview before submit. Pending until admin approval.                                                                |
| F7  | Attendee Registration              | Everyone | Authenticated users complete a profile (alias-based, anonymised). Profile links to team. Admins see all profiles.                                                               |
| F8  | Admin Validation & Manual Override | Admin    | Review queue shows all pending submissions. Approve writes to Scores container. Reject requires a reason. Approved scores can be manually overridden.                           |
| F9  | Attendee Bulk Entry                | Admin    | Paste a multi-line or CSV list of attendee names before the event. Creates records in the Attendees container in bulk.                                                          |
| F10 | Random Team Assignment             | Admin    | Fisher-Yates shuffle distributes registered attendees across teams. Shows preview before confirming. Re-shuffle available. Team Roster page visible to all authenticated users. |
| F11 | Configurable Rubric Templates      | Admin    | Upload a Markdown rubric file. Parsed into structured config (categories, bonus, grading thresholds, awards). Only one active rubric at a time. Drives F1/F2/F3/F6 dynamically. |

---

## Non-Functional Requirements

| Area             | Target                               | Notes                                                                 |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------- |
| Availability     | 99.9% during events                  | App Service SLA; single-region accepted for event tool                |
| Response time    | < 2s p95 for API calls               | Cosmos DB single-digit ms reads; Express adds < 50ms overhead         |
| Concurrent users | ≤ 50 simultaneous                    | B1/S1 App Service is sufficient; Cosmos Serverless scales linearly    |
| Monthly cost     | < $25/month                          | Actual: ~$18.15/month (S1 + ACR Basic + Cosmos Serverless)            |
| Data retention   | Event duration + 30 days             | No automated purge — manual cleanup via `scripts/cleanup-app-data.js` |
| Recovery time    | RTO 4h, RPO 1h                       | Cosmos DB continuous backup (PITR)                                    |
| Authentication   | GitHub OAuth required for all routes | `/api/health` is excluded                                             |
| Secrets          | Zero stored secrets                  | Managed identity for Cosmos DB; no connection strings                 |

---

## Data & Storage

All data stored in **Azure Cosmos DB NoSQL (Serverless)** — database `hackerboard`, 6 containers:

| Container     | Contents                                     | Partition Key |
| ------------- | -------------------------------------------- | ------------- |
| `teams`       | Team names, scores, award assignments        | `/id`         |
| `attendees`   | Participant profiles (anonymised aliases)    | `/id`         |
| `scores`      | Approved score records per team              | `/teamId`     |
| `submissions` | Pending, approved, and rejected submissions  | `/teamId`     |
| `rubrics`     | Rubric configurations (one active at a time) | `/id`         |
| `flags`       | Feature flag settings                        | `/id`         |

Data is stored in Central US only. There is no geo-replication (Serverless mode does not support it).

---

## Security Requirements

| Requirement                   | Implementation                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Authentication on all routes  | App Service Easy Auth; unauthenticated requests redirected to GitHub login                                       |
| Role-based access             | `ADMIN_USERS` app setting; checked per-request in `api/shared/auth.js`                                           |
| No connection strings         | `DefaultAzureCredential` (managed identity) for Cosmos DB                                                        |
| Cosmos DB local auth disabled | `disableLocalAuth: true` enforced by governance policy + Bicep                                                   |
| TLS 1.2+                      | Enforced on App Service and all Azure services                                                                   |
| No hardcoded secrets          | GitHub OAuth client secret passed as parameter to `deploy.ps1` at deploy time; stored as App Service app setting |
| XSS prevention                | `.textContent` used throughout; DOMPurify where HTML is needed                                                   |
| Input sanitisation            | Parameterised Cosmos DB queries; no string interpolation of user input                                           |
| Security headers              | CSP, HSTS, X-Content-Type-Options, X-Frame-Options set in `api/server.js`                                        |

---

## Infrastructure Requirements

| Requirement        | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Azure subscription | Any subscription with App Service, ACR, and Cosmos DB available       |
| Region             | `centralus` (default, configurable via `-Location` parameter)         |
| Azure CLI          | Authenticated with valid ARM token; MFA required for write operations |
| Bicep CLI          | `az bicep install`                                                    |
| Docker             | Required for initial image build and push                             |
| PowerShell 7+      | Required to run `infra/deploy.ps1`                                    |
| GitHub OAuth App   | Required before deploying — provides client ID and secret             |
| Governance tags    | Resource group must carry 9 mandatory tags (applied by `deploy.ps1`)  |

---

[← Back to Documentation](README.md)
