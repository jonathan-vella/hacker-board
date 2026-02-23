# HackerBoard — Application Functionality

![Type](https://img.shields.io/badge/Type-Functionality%20Guide-blue)
![Audience](https://img.shields.io/badge/Audience-Event%20Admins-orange)
![Updated](https://img.shields.io/badge/Updated-2026--02--23-lightgrey)

Walkthrough of every feature from the perspective of an event admin running a MicroHack.

---

## Table of Contents

- [Event Workflow at a Glance](#event-workflow-at-a-glance)
- [Authentication & Roles](#authentication--roles)
- [Before the Event — Setup](#before-the-event--setup)
- [During the Event](#during-the-event)
- [API Endpoints Reference](#api-endpoints-reference)
- [Feature Flags](#feature-flags)

---

## Event Workflow at a Glance

```
Before the event:
  1. Upload rubric → 2. Create teams → 3. Bulk-add attendees → 4. Assign attendees to teams

During the event:
  5. Participants sign in and submit scores (form or JSON upload)
  6. Admin reviews and approves submissions
  7. Leaderboard updates automatically

End of event:
  8. Admin assigns award categories → 9. Final leaderboard displayed
```

---

## Authentication & Roles

All HackerBoard routes require GitHub sign-in. Users are redirected to `/.auth/login/github` automatically when unauthenticated.

The `/.auth/me` endpoint returns the signed-in user's GitHub identity (username, display name, claims). The Express middleware reads the `ADMIN_USERS` app setting at each request to determine role.

### Roles

| Role   | How it is assigned                                                              | Capabilities                                                                 |
| ------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Admin  | GitHub username listed in the `ADMIN_USERS` app setting (e.g. `github:octocat`) | All features, including review queue and overrides                           |
| Member | Any authenticated user not in `ADMIN_USERS`                                     | Submit scores and JSON upload for own team only; view leaderboard and roster |

**Adding an admin during the event**: Re-run `deploy.ps1` with the updated `-AdminUsers` value. The change takes effect immediately — no restart needed.

---

## Before the Event — Setup

### 1. Upload the Scoring Rubric (F11)

The rubric drives the entire scoring system — categories, maximums, bonus items, grading thresholds, and award types all come from the active rubric. Set this up first.

1. Open the **Admin → Rubric** page
2. Upload a Markdown rubric file (see `templates/scoring-rubric.template.md` for the expected format)
3. The rubric is parsed automatically. Preview the parsed categories and confirm
4. Click **Set as Active** — this activates the rubric for submissions

Only one rubric can be active at a time. Activating a new one deactivates the current one. Existing scores are unaffected.

The rubric defines:

- **Categories** with display names, maximum scores
- **Bonus items** (e.g. "deployed to Azure") with point values
- **Grading thresholds** (e.g. Outstanding ≥ 90, Excellent ≥ 75, …)
- **Award categories** available for admin assignment
- **Maximum base score** used for grade calculation (`(baseScore / max) × 100`)

---

### 2. Create Teams (F2, F10)

There are two ways to get teams into the system:

**Option A — Create teams manually**

1. Open **Admin → Teams**
2. Enter a team name and click **Add Team**
3. Repeat for each team (typical hackathon: 4–10 teams)

**Option B — Teams are created automatically** when attendees are assigned (random assignment creates teams based on count and size).

---

### 3. Bulk-Add Attendees (F9)

Before the event, enter the attendee list so participants can register immediately on arrival.

1. Open **Admin → Attendees → Bulk Entry**
2. Paste a list of names (one per line, or comma-separated)
3. Click **Import** — records are created in the Attendees container

Attendees who have not yet registered (signed in) will appear as pending.

---

### 4. Assign Attendees to Teams (F10)

1. Open **Admin → Teams → Assign**
2. Confirm the number of teams
3. Click **Shuffle** — the Fisher-Yates algorithm distributes all registered attendees evenly
4. Review the preview and click **Confirm** (or **Reshuffle** to re-randomise)

The Team Roster page (`/roster`) is visible to all authenticated users so participants can see which team they are on.

---

## During the Event

### Participant: Register Profile (F7)

When a participant first signs in with GitHub, they are prompted to complete their profile:

- Set a display alias (can be anonymised — real name is not required)
- The profile is automatically linked to their assigned team (if bulk entry was done)

Participants without a team assignment can be manually assigned by an admin.

---

### Participant: Submit Scores (F1)

1. Navigate to **Submit Scores**
2. The active rubric categories are displayed with score inputs and maximums
3. Enter scores for each category and bonus items
4. Total is calculated in real time and validated against the rubric maximum
5. Click **Submit** — the submission is saved as **Pending**

Participants can only submit for their own team. Multiple submissions by the same team are allowed — each creates a new pending submission for admin review.

---

### Participant: JSON Upload (F6)

Participants who ran automated scoring tools can upload results directly:

1. Navigate to **Upload Scores**
2. Select the `score-results.json` file
3. The schema is validated and a preview is shown
4. Click **Confirm** — saved as Pending for admin review

The JSON schema requires the same fields as the submission form. The rubric's structure determines what fields are expected.

---

### Admin: Review Submissions (F8)

1. Open **Admin → Review Queue**
2. All Pending submissions are listed with team name, submitter, score breakdown, and timestamp
3. For each submission, choose:
   - **Approve** — writes the score to the Scores container; appears on leaderboard immediately
   - **Reject** — requires a rejection reason; the submitting team is notified
4. To correct an already-approved score, click **Override** and enter the corrected values

The review queue shows the count of pending submissions in the navigation badge so it is always visible.

---

### Live Leaderboard (F2, F3)

The leaderboard at `/` is visible to all authenticated users:

- Ranked by total approved score (highest first)
- Grade and colour-coded tier badge per team
- Award badges shown inline (if assigned)
- Click a team row to expand the category breakdown
- Auto-refreshes every 30 seconds

The leaderboard uses only **approved** scores. Revoked or rejected submissions do not appear.

---

### Admin: Assign Awards (F4)

1. Open **Admin → Awards**
2. For each award category, select a team from the dropdown
3. Click **Assign** — the award badge appears on the leaderboard immediately

Five award categories are available (defined by the active rubric):

| Award             | Typical criteria                       |
| ----------------- | -------------------------------------- |
| Best Overall      | Highest total score                    |
| Security Champion | Best security implementation           |
| Cost Optimizer    | Most cost-efficient Azure architecture |
| Best Architecture | Best design choices and WAF alignment  |
| Speed Demon       | Fastest to complete all challenges     |

Awards can be reassigned at any time before the final leaderboard is announced.

---

### Grading Scale (F3)

The grade computation uses the active rubric's maximum base score:

```
grade = (approvedBaseScore / rubricMaxBaseScore) × 100
```

| Tier              | Default Range |
| ----------------- | ------------- |
| Outstanding       | ≥ 90          |
| Excellent         | ≥ 75          |
| Good              | ≥ 60          |
| Satisfactory      | ≥ 45          |
| Needs Improvement | < 45          |

Thresholds are configurable in the rubric.

---

## API Endpoints Reference

All API routes require authentication. Write operations on team/score/attendee/award/rubric data require the Admin role.

| Endpoint                    | Methods             | Auth required | Purpose                                 |
| --------------------------- | ------------------- | ------------- | --------------------------------------- |
| `/api/health`               | GET                 | None          | Health check (used by CI/CD smoke test) |
| `/api/teams`                | GET, POST, PUT, DEL | Admin (write) | Manage teams                            |
| `/api/teams/assign`         | POST                | Admin         | Random team assignment                  |
| `/api/scores`               | GET, POST           | Admin (write) | Read and write approved scores          |
| `/api/attendees`            | GET                 | Admin         | List all attendees                      |
| `/api/attendees/me`         | GET, POST           | Authenticated | Get or update own profile               |
| `/api/attendees/bulk`       | POST                | Admin         | Bulk import attendee names              |
| `/api/awards`               | GET, POST, PUT      | Admin (write) | Manage award assignments                |
| `/api/upload`               | POST                | Member+       | JSON score upload                       |
| `/api/submissions`          | GET                 | Admin         | List all submissions                    |
| `/api/submissions/validate` | POST                | Admin         | Approve or reject a submission          |
| `/api/rubrics`              | GET, POST           | Admin (write) | List or upload rubrics                  |
| `/api/rubrics/active`       | GET                 | Authenticated | Get the currently active rubric         |
| `/api/feature-flags`        | GET, POST           | Admin (write) | Read and update feature flag settings   |

Full schemas and request/response bodies: [api-spec.md](api-spec.md) | [Swagger UI](swagger-ui.html)

---

## Feature Flags

Runtime feature flags can be toggled without redeploying. Access via **Admin → Feature Flags** in the UI, or `GET /api/feature-flags`.

Feature flags are stored in the `flags` Cosmos DB container. Changes take effect on the next request.

---

[← Back to Documentation](README.md)
