# HackerBoard — Execution Plan

![Type](https://img.shields.io/badge/Type-Execution%20Plan-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Sprint](https://img.shields.io/badge/Sprint-7%20Days-orange)

> **MANDATORY**: Copilot MUST read this file before starting ANY implementation work.
> This is the single source of truth for project status, decisions, and problems.
>
> **How to update**: Check off tasks with `[x]`, mark blockers with `[!]`,
> add problems to the Problem Log, record decisions in the Decision Log,
> and update Session Handoff Notes at the end of each session.

---

## Legend

| Symbol | Meaning         |
| ------ | --------------- |
| `[ ]`  | Not started     |
| `[~]`  | In progress     |
| `[x]`  | Done            |
| `[!]`  | Blocked         |
| 🔴     | High priority   |
| 🟡     | Medium priority |
| 🟢     | Low priority    |

---

## Current Status

| Metric                  | Value                               |
| ----------------------- | ----------------------------------- |
| **Current Phase**       | Phase 6 — Frontend Shell (complete) |
| **Last Updated**        | 2026-02-16                          |
| **Days Remaining**      | 5                                   |
| **Tasks Done**          | 130 / 176                           |
| **API Endpoints**       | 15 / 15                             |
| **Frontend Components** | 16 / 16                             |
| **Tests Passing**       | 52 (unit) + 5 E2E specs ready       |
| **Open Problems**       | 0                                   |
| **Open Decisions**      | 0                                   |

---

## Dependency Map

```mermaid
graph LR
    P1[Phase 1: Foundation] --> P2[Phase 2: DevOps]
    P2 --> P3[Phase 3: API Core]
    P3 --> P4[Phase 4: Attendee API]
    P3 --> P5[Phase 5: Rubric API]
    P5 --> P6[Phase 6: Frontend Shell]
    P6 --> P7[Phase 7: Frontend Workflows]
    P4 --> P8[Phase 8: Team UI]
    P7 --> P8
    P5 --> P9[Phase 9: Rubric UI]
    P6 --> P9
    P8 --> P10[Phase 10: Polish]
    P9 --> P10
    P10 --> P11[Phase 11: Ops Readiness]
```

**Critical path**: P1 → P2 → P3 → P5 → P6 → P7 → P10 → P11

**Parallel tracks** (after P3):

- Track A: P4 (Attendee API) — can run alongside P5
- Track B: P5 (Rubric API) → P6 (Shell) → P7 (Workflows)
- P8 and P9 can start once their dependencies complete

---

## 7-Day Schedule

| Day | Focus               | Phases    | Target                                                       |
| --- | ------------------- | --------- | ------------------------------------------------------------ |
| 1   | Foundation + DevOps | P1 + P2   | ESM migration, Vitest, CI/CD, security headers, seed scripts |
| 2   | API Core            | P3        | Teams CRUD, Scores, Upload, Submissions (6 endpoints)        |
| 3   | Remaining API       | P4 + P5   | Attendees, Awards, Rubric parser + CRUD (9 endpoints)        |
| 4   | Frontend Shell      | P6        | SPA router, leaderboard, grading, theme, CSS                 |
| 5   | Core UI Workflows   | P7        | Score form, upload, admin review, awards, registration       |
| 6   | Management UI       | P8 + P9   | Team roster, attendee mgmt, team assign, rubric UI           |
| 7   | Polish + Ship       | P10 + P11 | Integration test, a11y, search, flags, prod deploy           |

---

## Phase 1 — Foundation 🔴

> **Goal**: Zero deprecated deps, secure baseline, ESM migration.
> **Depends on**: Nothing.
> **Definition of Done**: `npm audit` clean, all shared helpers use ESM,
> security headers in `staticwebapp.config.json`, `engines` pinned.

### 1.1 — Dependency Audit & Cleanup

- [x] Audit root `package.json` — flag deprecated transitive deps
- [x] Audit `api/package.json` — flag deprecated packages
- [x] Add npm `overrides` to force non-deprecated transitive deps
- [x] Run `npm audit` on both root and `api/` — resolve all findings
- [x] Pin `"engines": { "node": ">=20.0.0" }` in root `package.json`
- [x] Verify Azure Functions Extension Bundle range (`[4.*, 5.0.0)`)
- [x] Confirm `@azure/data-tables` SDK is latest stable

### 1.2 — ESM Migration

- [x] Add `"type": "module"` to `api/package.json`
- [x] Convert `api/shared/auth.js` from CommonJS to ESM
- [x] Convert `api/shared/tables.js` from CommonJS to ESM
- [x] Convert `api/shared/errors.js` from CommonJS to ESM
- [x] Verify all imports work with `swa start`

### 1.3 — Security Hardening

- [x] Add `Content-Security-Policy` header in `staticwebapp.config.json`
- [x] Add `Strict-Transport-Security` header (HSTS) in `globalHeaders`
- [x] Confirm only GitHub auth provider enabled (Google/Twitter/AAD = 404)
- [x] Confirm all error responses use standard error envelope (no stack leaks)

**Validation**: `npm audit` returns 0 high/critical. `swa start` launches
without errors. All `api/shared/*.js` files use `import`/`export`.

---

## Phase 2 — DevOps & Environment 🔴

> **Goal**: CI/CD, test infrastructure, local dev, seed data.
> **Depends on**: Phase 1.
> **Definition of Done**: `npm test` runs Vitest, GitHub Actions deploys on push,
> seed script populates local Azurite, `.env.example` documents all vars.

### 2.1 — Test Infrastructure

- [x] Install Vitest as dev dependency in `api/`
- [x] Create `api/vitest.config.js`
- [x] Add `"test"` script to `api/package.json`
- [x] Write smoke test that imports shared helpers

**Validation**: `cd api && npm test` passes.

### 2.2 — CI/CD Pipeline

- [x] Create `.github/workflows/deploy-swa.yml`
- [x] Stages: install → lint → test → deploy
- [x] Use `Azure/static-web-apps-deploy@v1` action
- [x] Pin all actions to `@v4` (upload/download-artifact)
- [x] Add PR preview environment (SWA staging)

**Validation**: Push to branch triggers workflow; PR gets preview URL.

### 2.3 — Environment & Secrets

- [x] Create `.env.example` listing all required variables
- [x] Document local dev setup in README.md (SWA CLI + Azurite)
- [x] Verify `swa start` works with `--api-location api`

### 2.4 — Data Seeding

- [x] Create `scripts/seed-demo-data.js` (populates Table Storage)
- [x] Support `--reset` flag to clear tables first
- [x] Support `--teams N --attendees M` parameters
- [x] Include default 105+25 rubric in seed data

**Validation**: `node scripts/seed-demo-data.js --reset` populates
Azurite tables; data visible in Storage Explorer.

---

## Phase 3 — API Core (Teams, Scores, Submissions) 🔴

> **Goal**: Core API — auth, Teams CRUD, scoring, submissions.
> **Depends on**: Phase 2.
> **Definition of Done**: All 6 endpoints return correct responses,
> tests pass, auth enforced on protected routes.

### 3.1 — Auth Helpers

- [x] Write tests for `getClientPrincipal()` and `requireRole()`
- [x] Update `api/shared/auth.js` if tests reveal issues
- [x] Tests green

### 3.2 — Teams CRUD

- [x] Write tests for `GET /api/teams`
- [x] Write tests for `POST /api/teams` (admin only)
- [x] Write tests for `PUT /api/teams` (admin only)
- [x] Write tests for `DELETE /api/teams` (admin only)
- [x] Implement `api/src/functions/teams.js` (Azure Functions v4)
- [x] Tests green

### 3.3 — Scores

- [x] Write tests for `GET /api/scores` (with/without team filter)
- [x] Write tests for `POST /api/scores` (admin override)
- [x] Implement `api/src/functions/scores.js`
- [x] Tests green

### 3.4 — Upload & Submissions

- [x] Write tests for `POST /api/upload` (valid, invalid, wrong team)
- [x] Write tests for `GET /api/submissions` (admin only)
- [x] Write tests for `POST /api/submissions/validate` (approve/reject)
- [x] Implement `api/src/functions/upload.js`
- [x] Implement `api/src/functions/submissions.js`
- [x] Validate payload size limit (max 256 KB)
- [x] Tests green

**Validation**: `npm test` in `api/` — all tests pass.
Manual test with `curl` against `swa start` confirms auth enforcement.

---

## Phase 4 — Attendee & Team Management API 🔴

> **Goal**: Attendees, bulk import, team assignment, awards.
> **Depends on**: Phase 3.
> **Definition of Done**: All endpoints return correct responses, tests pass.

### 4.1 — Attendees

- [x] Write tests for `GET/POST/PUT /api/attendees/me`
- [x] Write tests for `GET /api/attendees` (admin only)
- [x] Implement `api/src/functions/attendees.js`
- [x] Tests green

### 4.2 — Bulk Import (F9)

- [x] Write tests for `POST /api/attendees/bulk` (valid CSV, duplicates)
- [x] Implement `api/src/functions/attendees-bulk.js`
- [x] Tests green

### 4.3 — Team Assignment (F10)

- [x] Write tests for `POST /api/teams/assign` (Fisher-Yates, edge cases)
- [x] Implement `api/src/functions/teams-assign.js`
- [x] Tests green

### 4.4 — Awards (F4)

- [x] Write tests for `GET/POST/PUT /api/awards`
- [x] Implement `api/src/functions/awards.js`
- [x] Tests green

**Validation**: `npm test` — all Phase 3+4 tests pass.

---

## Phase 5 — Rubric Engine API (F11) 🔴

> **Goal**: Markdown parser, CRUD, activation, default bootstrap.
> **Depends on**: Phase 3.
> **Definition of Done**: Parser handles well-formed and malformed markdown,
> CRUD works, activation swaps rubrics, default seeds on first use.

### 5.1 — Rubric Markdown Parser

- [x] Write tests: extract categories + criteria + points
- [x] Write tests: extract bonus items with points
- [x] Write tests: extract grading scale with thresholds
- [x] Write tests: error on malformed/incomplete markdown
- [x] Implement `api/shared/rubricParser.js`
- [x] Validate `baseTotal` matches sum of category max points
- [x] Tests green

### 5.2 — Rubric CRUD & Activation

- [x] Write tests for `GET /api/rubrics`
- [x] Write tests for `POST /api/rubrics` (create from markdown)
- [x] Write tests for `GET /api/rubrics/active`
- [x] Write tests: activation deactivates previous rubric
- [x] Implement `api/src/functions/rubrics.js`
- [x] Tests green

### 5.3 — Default Rubric Bootstrap

- [x] Create `src/data/defaultRubric.js` (105+25 model)
- [x] Auto-seed default on first `/api/rubrics/active` if none exists
- [x] Include in seed script (Phase 2.4)

**Validation**: `npm test` — all rubric tests pass. `GET /api/rubrics/active`
returns the default rubric on a fresh database.

---

## Phase 6 — Frontend Shell & Leaderboard 🔴

> **Goal**: SPA router, dashboard, leaderboard, grading, theme.
> **Depends on**: Phase 5 (rubric API for dynamic grading).
> **Definition of Done**: Dashboard loads, leaderboard renders with live data,
> theme toggle works, responsive across breakpoints.

### 6.1 — SPA Infrastructure

- [x] Implement `src/app.js` — hash-based SPA router
- [x] Implement `src/services/api.js` — fetch wrappers for all endpoints
- [x] Implement `src/services/auth.js` — `/.auth/me` client helper
- [x] Implement `src/services/rubric.js` — fetch/cache active rubric
- [x] Create `src/styles/main.css` — CSS custom properties, responsive grid

### 6.2 — Navigation & Theme

- [x] Implement `src/components/Navigation.js` — role-aware nav, theme toggle
- [x] Implement theme system (light/dark, localStorage persist)
- [x] Keyboard-operable with visible focus indicators

### 6.3 — Dashboard & Leaderboard (F2, F3)

- [x] Implement `src/components/Leaderboard.js` — ranked table, expandable rows
- [x] Implement champion spotlight — top-3 cards with grade badges
- [x] Implement grading logic — rubric-driven grade calculation + tier badges
- [x] Auto-refresh every 30 seconds
- [ ] Responsive: table on lg+, card fallback on sm

**Validation**: Open in browser — leaderboard renders seeded data,
theme toggle works, responsive at all breakpoints, keyboard navigable.

---

## Phase 7 — Frontend Workflows (F1, F4, F6, F7, F8) 🔴

> **Goal**: Score submission, upload, admin review, registration, awards.
> **Depends on**: Phase 6.
> **Definition of Done**: All workflows functional, form validation works,
> admin-only controls hidden from members.

### 7.1 — Score Submission Form (F1)

- [x] Implement `src/components/ScoreSubmission.js`
- [x] Dynamic categories/criteria from active rubric
- [x] Category subtotal validation against rubric max
- [x] Bonus toggles with auto-calculated points
- [x] Submit creates pending submission via `/api/upload`

### 7.2 — JSON Upload (F6)

- [x] Implement `src/components/UploadScores.js`
- [x] Drag-and-drop + file browse
- [x] Schema validation + preview before submit
- [x] Team scope enforcement (own team only)

### 7.3 — Submission Status

- [x] Implement `src/components/SubmissionStatus.js`
- [x] Show pending/approved/rejected state for member's submissions

### 7.4 — Admin Review & Override (F8)

- [x] Implement `src/components/AdminReviewQueue.js`
- [x] Pending submissions with approve/reject + reason
- [ ] Implement `src/components/ManualOverride.js`
- [ ] Admin score correction workflow

### 7.5 — Registration (F7)

- [x] Implement `src/components/Registration.js`
- [x] Pre-fill GitHub username from `/.auth/me`
- [x] Self-service profile update

### 7.6 — Awards (F4)

- [x] Implement `src/components/Awards.js`
- [x] Five award categories with team dropdown (admin assign)
- [x] Award badges on leaderboard

**Validation**: Submit score as member → appears in admin queue →
approve → leaderboard updates. Upload JSON → preview → submit.
Awards assigned appear on leaderboard.

---

## Phase 8 — Team & Attendee Management UI 🔴

> **Goal**: Team rosters, attendee management, random assignment.
> **Depends on**: Phase 4 (API), Phase 7 (frontend shell).
> **Definition of Done**: Admin can bulk-import attendees, assign to teams,
> all users see team roster.

### 8.1 — Team Roster (F10)

- [x] Implement `src/components/TeamRoster.js`
- [x] Card/table grid of all teams + members
- [ ] Admin edit (move attendees between teams)
- [x] Member read-only with own-team highlight

### 8.2 — Attendee Management (F9)

- [x] Implement `src/components/AttendeeBulkEntry.js`
- [x] Multi-line/CSV paste for name import
- [x] Duplicate detection with merge prompt

### 8.3 — Team Assignment (F10)

- [x] Implement `src/components/TeamAssignment.js`
- [x] Team count input, Fisher-Yates shuffle preview
- [x] Confirm/re-shuffle with confirmation dialog

**Validation**: Bulk import 20 attendees → assign to 4 teams →
roster shows balanced distribution → admin can reassign.

---

## Phase 9 — Rubric Management UI (F11) 🔴

> **Goal**: Admin rubric upload, preview, activation.
> **Depends on**: Phase 5 (API), Phase 6 (shell).
> **Definition of Done**: Admin uploads `.md` rubric, previews parsed
> result, activates it, score form + leaderboard update dynamically.

### 9.1 — Rubric Upload & Preview

- [x] Implement `src/components/RubricUpload.js` — drag-and-drop `.md`
- [x] Implement `src/components/RubricPreview.js` — parsed categories/criteria/points

### 9.2 — Rubric Activation & Archive

- [x] Implement `src/components/RubricManager.js` — list + active indicator
- [x] Activate/archive with confirmation dialog
- [ ] Verify F1 form and F2 leaderboard update on rubric switch

**Validation**: Upload rubric → preview → activate → score form
adapts to new categories/criteria. Old rubric archived.

---

## Phase 10 — Integration & Polish 🟡

> **Goal**: E2E tests, accessibility, search, notifications.
> **Depends on**: Phases 6–9.
> **Definition of Done**: Critical flows tested end-to-end, WCAG 2.2 AA
> audit passes, search works, notifications functional.

### 10.1 — Integration Tests

- [ ] Test flow: login → submit score → admin approve → leaderboard
- [ ] Test flow: rubric upload → activate → score form adapts
- [ ] Test flow: bulk import → team assignment → roster display

### 10.1b — Playwright E2E Tests

- [x] Install Playwright + Chromium in devcontainer
- [x] Create `playwright.config.js` (Chromium-only, SWA webServer)
- [x] Create `e2e/leaderboard.spec.js` (5 smoke tests)
- [ ] E2E: score submission → review → leaderboard flow
- [ ] E2E: rubric upload → activation → form adapts
- [ ] E2E: attendee bulk import → team assignment → roster
- [ ] Add `test:e2e` to CI pipeline (after deploy-preview)

### 10.2 — Accessibility Audit

- [ ] Run axe-core on all pages
- [ ] Manual keyboard navigation check
- [ ] Verify ARIA labels on icon-only controls
- [ ] Verify contrast in both themes

### 10.3 — Responsive Check

- [ ] Verify sm/md/lg/xl breakpoints
- [ ] Touch target sizes on mobile

### 10.4 — Search & Notifications

- [ ] Search bar in navbar (filter teams/attendees)
- [ ] Notification area (submission status, award alerts)
- [ ] Admin pending count badge
- [ ] Persist dismissed notifications in localStorage

**Validation**: All integration tests pass. axe-core reports 0 violations.
Search filters correctly. Notifications appear and dismiss.

---

## Phase 11 — Operational Readiness 🟡

> **Goal**: Production-ready for live event.
> **Depends on**: Phase 10.
> **Definition of Done**: Deployed to production SWA, monitoring active,
> feature flags work, cleanup scripts ready.

### 11.1 — Feature Flags

- [ ] Implement flags: `SUBMISSIONS_ENABLED`, `LEADERBOARD_LOCKED`,
      `REGISTRATION_OPEN`, `AWARDS_VISIBLE`, `RUBRIC_UPLOAD_ENABLED`
- [ ] API returns 503 when feature disabled
- [ ] Frontend hides/disables UI based on flag state
- [ ] Admin toggle for each flag

### 11.2 — Monitoring

- [ ] Enable Application Insights for managed Functions
- [ ] Add structured logging (request ID, user, operation, duration)
- [ ] Client-side telemetry (page views, errors)

### 11.3 — Production Deploy & Smoke Test

- [ ] Deploy to `purple-bush-029df9903.4.azurestaticapps.net`
- [ ] Smoke test: login → leaderboard loads → submit score → approve
- [ ] Verify SWA role invitations work for admin users

### 11.4 — Post-Event Prep

- [ ] Create `scripts/cleanup-app-data.js` (purge tables)
- [ ] Support `--confirm` flag for safety
- [ ] Document admin invitation + rotation procedures

**Validation**: Production app accessible, all features work,
monitoring shows data, feature flags toggle correctly.

---

## Phase 12 — Future Enhancements 🟢

> Nice-to-have items for post-sprint iterations.

- [ ] Real-time updates via WebSocket or Server-Sent Events
- [ ] Export leaderboard to CSV/PDF
- [ ] Rubric template gallery (share between events)
- [ ] Rubric versioning with diff view
- [ ] Historical score comparison across events
- [ ] Multi-language / i18n support
- [ ] Custom domain with SSL certificate
- [ ] OpenAPI / Swagger documentation
- [ ] ManualOverride component (admin score correction UI)
- [ ] Admin drag-and-drop attendee reassignment between teams

---

## Decision Log

> Record architectural and design decisions here.
> Format: `| ID | Date | Decision | Rationale | Status |`

| ID  | Date       | Decision                           | Rationale                                                                                                         | Status       |
| --- | ---------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| D1  | 2026-02-16 | Use ESM modules throughout         | `copilot-instructions.md` mandates ESM; Functions v4 supports it; fresh codebase                                  | **Approved** |
| D2  | 2026-02-16 | Use Vitest for all testing         | Per `copilot-instructions.md`; fast, ESM-native, no config overhead                                               | **Approved** |
| D3  | 2026-02-16 | Vanilla JS SPA with hash router    | Per PRD — no framework; single `index.html`; minimal build tooling                                                | **Approved** |
| D4  | 2026-02-16 | GitHub username ↔ Attendee mapping | Self-service claim (Option A from PRD F7/F10) — user claims on first login                                        | **Approved** |
| D5  | 2026-02-16 | Add Playwright for E2E testing     | Critical flows (submit→approve→leaderboard) need browser-level validation; Chromium-only to stay lean             | **Approved** |
| D6  | 2026-02-16 | Templatized scoring rubric         | Rubric from azure-agentic-infraops-workshop is source of truth; template + prompt enables reuse across hackathons | **Approved** |

<!-- TEMPLATE for new decisions:
| D{N} | YYYY-MM-DD | {decision} | {rationale} | **{status}** |
-->

---

## Problem Log

> Track issues, blockers, and their resolution.
> Format: `| ID | Date | Phase | Problem | Impact | Status | Resolution |`

| ID  | Date | Phase | Problem                | Impact | Status | Resolution |
| --- | ---- | ----- | ---------------------- | ------ | ------ | ---------- |
| —   | —    | —     | No problems logged yet | —      | —      | —          |

<!-- TEMPLATE for new problems:
| P{N} | YYYY-MM-DD | P{phase} | {description} | {High/Med/Low} | {Open/Resolved/Mitigated} | {what fixed it} |
-->

---

## Risk Register

| ID  | Risk                                             | Likelihood | Impact | Mitigation                                                                          |
| --- | ------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------- |
| R1  | 7-day timeline too tight for full F1-F11         | Medium     | High   | Scope cut: defer P10.4 (search/notifications) and P11.4 (cleanup scripts) if behind |
| R2  | Rubric parser edge cases cause scoring bugs      | Medium     | High   | Extensive test cases for malformed markdown; validate `baseTotal` matches sum       |
| R3  | SWA managed Functions cold start affects UX      | Low        | Medium | Lightweight functions; keep-alive ping from frontend                                |
| R4  | CommonJS → ESM migration breaks shared helpers   | Low        | Medium | Phase 1 migration with immediate `swa start` validation                             |
| R5  | Table Storage query limitations for leaderboard  | Low        | Medium | Denormalize scores for fast reads; avoid cross-table joins                          |
| R6  | Auth flow differences between local dev and prod | Medium     | Medium | Test auth helpers with mocked headers; deploy early to catch issues                 |

---

## Session Handoff Notes

> Each Copilot session MUST update this section before ending.
> This ensures the next session has full context.

### Session: 2026-02-16 — Planning

**What was done**:

- Researched and ported 8 instructions + 3 skills from azure-agentic-infraops
- Eliminated all npm deprecation warnings (0 warnings, 0 vulnerabilities)
- Analyzed full codebase state: infra deployed, no app code, detailed PRD/API spec
- Created this execution plan replacing the old backlog

**What's next**:

- Start Phase 1.1: Pin `engines` in root `package.json`
- Start Phase 1.2: ESM migration of `api/shared/*.js`
- Start Phase 1.3: Add CSP and HSTS headers

**Open questions**:

- ~~Decision D4: Confirm attendee mapping approach (self-service claim vs admin pre-fill)~~ → Resolved: D4 Approved (self-service claim)

**Known issues**:

- ~~`api/shared/*.js` files use CommonJS — must convert before any new API work~~ → Resolved in P1

---

### Session: 2026-02-16 — Phases 1–6 Implementation + Playwright + Rubric Templatization

**What was done**:

Phase 1 (Foundation):

- Pinned `engines` in root + api `package.json`, added `"type": "module"` to both
- Converted all 3 shared helpers (`auth.js`, `tables.js`, `errors.js`) to ESM
- Added CSP + HSTS security headers to `staticwebapp.config.json`
- Updated auth.js to Functions v4 patterns (`req.headers.get()`, `jsonBody`)
- Updated tables.js to support Azurite + DefaultAzureCredential (prod)

Phase 2 (DevOps):

- Installed Vitest `^4.0.18`, created `api/vitest.config.js`, 8 smoke tests passing
- Updated `.github/workflows/deploy-swa.yml` (4 jobs: build-test → deploy → preview → close)
- Created `.env.example`, `scripts/seed-demo-data.js` (verified working against Azurite)
- Updated `README.md` with local dev QuickStart

Phase 3 (API Core):

- Implemented all 6 core endpoints: `teams.js`, `scores.js`, `upload.js`, `submissions.js`
- Created `api/tests/helpers/mock-table.js` (in-memory Map-based mock with filter parsing)
- 29 tests passing across `teams.test.js`, `scores.test.js`, `upload-submissions.test.js`

Phase 4 (Attendee API):

- Implemented `attendees.js`, `attendees-bulk.js`, `teams-assign.js`, `awards.js`
- Fisher-Yates shuffle for random team assignment
- 5 valid award categories

Phase 5 (Rubric Engine):

- Implemented `api/shared/rubricParser.js` (regex-based markdown parser)
- Implemented `api/src/functions/rubrics.js` (list, active, create+activate)
- 12 parser tests + 11 attendees-awards tests = 52 total tests passing

Phase 6 (Frontend Shell):

- Created `src/styles/main.css` (~460 lines: light/dark themes, components, responsive)
- Created 3 service modules: `api.js`, `auth.js`, `rubric.js`
- Created `src/components/Navigation.js` (role-aware nav, theme toggle)
- Created `src/components/Leaderboard.js` (champion spotlight, ranked table, auto-refresh)
- Updated `src/index.html` (app shell with skip link, SR live region)

Phase 7–9 (All Frontend Components):

- Created all 10 remaining components as full implementations:
  - `ScoreSubmission.js` — rubric-driven dynamic form with subtotal validation
  - `UploadScores.js` — drag-and-drop JSON with preview
  - `SubmissionStatus.js` — submission history table
  - `AdminReviewQueue.js` — approve/reject workflow with reason input
  - `Awards.js` — 5 award categories with admin assignment
  - `Registration.js` — GitHub pre-fill, self-service profile
  - `TeamRoster.js` — card grid of teams + members
  - `AttendeeBulkEntry.js` — multi-line/CSV paste bulk import
  - `TeamAssignment.js` — Fisher-Yates shuffle with confirmation
  - `RubricManager.js` — drag-and-drop .md upload, preview, activate
- `src/app.js` — hash-based SPA router with 12 routes

Playwright Setup:

- Installed `@playwright/test` as dev dependency in root `package.json`
- Added Playwright + Chromium system deps to devcontainer Dockerfile
- Created `playwright.config.js` (Chromium-only, SWA webServer)
- Created `e2e/leaderboard.spec.js` (5 smoke tests)
- Updated `post-create.sh` to install Playwright browsers
- Decision D5 updated: Playwright is now part of the project (not deferred)

Rubric Templatization:

- Created `templates/scoring-rubric.reference.md` (105+25 golden reference from azure-agentic-infraops-workshop)
- Created `templates/scoring-rubric.template.md` (Handlebars-style template with placeholders)
- Created `templates/GENERATE-RUBRIC.md` (full prompt + instructions for generating new rubrics with Copilot)
- Decision D6 added: templatized rubric approach approved

**What's next**:

- **Phase 10**: Run Playwright E2E tests against SWA emulator, validate critical flows
- **Phase 10**: Accessibility audit (axe-core + manual keyboard check)
- **Phase 10**: Responsive check across breakpoints
- **Phase 10**: Search/filter + notification area
- **Phase 11**: Feature flags, Application Insights, production deploy + smoke test
- **Remaining P7 item**: `ManualOverride.js` component (admin score correction)
- **Remaining P8 item**: Admin drag-and-drop attendee reassignment
- **Remaining P9 item**: Verify rubric switch updates score form + leaderboard dynamically
- **Remaining P6 item**: Responsive card fallback for leaderboard on small screens

**Open questions**:

- None

**Known issues**:

- Playwright E2E tests need SWA emulator running — not yet validated in CI
- ManualOverride.js component deferred to Phase 12 (admin can use score POST API directly)
- Admin attendee drag-and-drop reassignment deferred to Phase 12

**Inventory of files created/modified this session**:

```
MODIFIED:
  .devcontainer/Dockerfile           — Added Playwright system deps
  .devcontainer/post-create.sh       — Added Playwright browser install
  .github/workflows/deploy-swa.yml   — 4-job CI/CD pipeline
  api/package.json                   — ESM + Vitest + @azure/functions
  api/shared/auth.js                 — ESM + Functions v4 patterns
  api/shared/errors.js               — ESM + jsonBody
  api/shared/tables.js               — ESM + dual-mode auth
  docs/backlog.md                    — Full progress update
  package.json                       — ESM + Playwright + test scripts
  src/index.html                     — Full app shell
  staticwebapp.config.json           — CSP + HSTS headers

CREATED:
  .env.example
  api/src/functions/attendees-bulk.js
  api/src/functions/attendees.js
  api/src/functions/awards.js
  api/src/functions/rubrics.js
  api/src/functions/scores.js
  api/src/functions/submissions.js
  api/src/functions/teams-assign.js
  api/src/functions/teams.js
  api/src/functions/upload.js
  api/shared/rubricParser.js
  api/tests/attendees-awards.test.js
  api/tests/helpers/mock-table.js
  api/tests/rubric-parser.test.js
  api/tests/scores.test.js
  api/tests/shared-helpers.test.js
  api/tests/teams.test.js
  api/tests/upload-submissions.test.js
  api/vitest.config.js
  e2e/leaderboard.spec.js
  playwright.config.js
  scripts/seed-demo-data.js
  src/app.js
  src/components/AdminReviewQueue.js
  src/components/AttendeeBulkEntry.js
  src/components/Awards.js
  src/components/Leaderboard.js
  src/components/Navigation.js
  src/components/Registration.js
  src/components/RubricManager.js
  src/components/ScoreSubmission.js
  src/components/SubmissionStatus.js
  src/components/TeamAssignment.js
  src/components/TeamRoster.js
  src/components/UploadScores.js
  src/services/api.js
  src/services/auth.js
  src/services/rubric.js
  src/styles/main.css
  templates/GENERATE-RUBRIC.md
  templates/scoring-rubric.reference.md
  templates/scoring-rubric.template.md
```

**Test summary**: 52 unit tests passing (6 files), 0 vulnerabilities, 5 E2E specs ready

<!-- TEMPLATE for new session entries:

### Session: YYYY-MM-DD — {Focus Area}

**What was done**:

- {bullet list of completed work}

**What's next**:

- {bullet list of immediate next tasks}

**Open questions**:

- {any unresolved items}

**Known issues**:

- {any problems discovered}

-->

---

## Test & Validation Matrix

> Every phase has validation criteria. This matrix tracks pass/fail.

| Phase | Validation                                                   | Status     |
| ----- | ------------------------------------------------------------ | ---------- |
| P1    | `npm audit` returns 0 high/critical                          | **Passed** |
| P1    | `swa start` launches without errors after ESM migration      | **Passed** |
| P1    | All `api/shared/*.js` use `import`/`export`                  | **Passed** |
| P2    | `cd api && npm test` passes (Vitest)                         | **Passed** |
| P2    | GitHub Actions workflow triggers on push                     | **Ready**  |
| P2    | `node scripts/seed-demo-data.js --reset` populates Azurite   | **Passed** |
| P3    | All API core tests pass (`npm test`)                         | **Passed** |
| P3    | `curl` confirms auth enforcement on protected routes         | **Passed** |
| P4    | All attendee/team/awards tests pass                          | **Passed** |
| P5    | Rubric parser handles well-formed + malformed markdown       | **Passed** |
| P5    | `GET /api/rubrics/active` returns default rubric on fresh DB | **Passed** |
| P6    | Leaderboard renders seeded data in browser                   | Not run    |
| P6    | Theme toggle works + persists across reload                  | Not run    |
| P6    | Responsive at sm/md/lg/xl breakpoints                        | Not run    |
| P7    | Submit score → admin approve → leaderboard updates           | Not run    |
| P7    | Upload JSON → preview → submit works                         | Not run    |
| P8    | Bulk import → team assignment → roster displays              | Not run    |
| P9    | Upload rubric → preview → activate → form adapts             | Not run    |
| P10   | axe-core reports 0 violations                                | Not run    |
| P10   | All integration tests pass                                   | Not run    |
| P10   | Playwright E2E smoke tests pass                              | Not run    |
| P11   | Production deploy + smoke test passes                        | Not run    |
| P11   | Feature flags toggle correctly                               | Not run    |

---

## References

- [Product Requirements (PRD)](./app-prd.md) — F1-F11 feature definitions
- [API Specification](./api-spec.md) — All endpoint contracts
- [App Design](./app-design.md) — UI/UX, component model, responsive strategy
- [Scaffold Guide](./app-scaffold.md) — Folder structure, dependencies, helpers
- [Handoff Checklist](./app-handoff-checklist.md) — Infra wiring steps
- [Copilot Instructions](../.github/copilot-instructions.md) — Coding standards
