# API Specification — HackerBoard

![Type](https://img.shields.io/badge/Type-API%20Spec-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Runtime](https://img.shields.io/badge/Runtime-Node.js%2020-green)
![Auth](https://img.shields.io/badge/Auth-GitHub%20OAuth-orange)

> All endpoints are managed Azure Functions behind the SWA reverse proxy.
> Base URL: `https://purple-bush-029df9903.4.azurestaticapps.net/api`
> Machine-readable spec: [openapi.yaml](openapi.yaml) · [Swagger UI](swagger-ui.html)

---

## Authentication Context

Every API request includes the SWA authentication context automatically. Access the caller's identity in Node.js:

```javascript
function getClientPrincipal(req) {
  const header = req.headers["x-ms-client-principal"];
  if (!header) return null;
  const encoded = Buffer.from(header, "base64");
  return JSON.parse(encoded.toString("ascii"));
}

// Returns:
// {
//   "identityProvider": "github",
//   "userId": "<unique-id>",
//   "userDetails": "<github-username>",
//   "userRoles": ["authenticated", "member"]
// }
```

---

## Endpoints

### `GET /api/teams`

Retrieve all teams.

| Property   | Value                             |
| ---------- | --------------------------------- |
| **Auth**   | `authenticated` (`admin` + `member`) |
| **Method** | GET                               |

**Response `200 OK`:**

```json
[
  {
    "teamName": "team-alpha",
    "teamMembers": ["user1", "user2", "user3"],
    "createdAt": "2026-02-13T10:00:00Z"
  }
]
```

---

### `POST /api/teams`

Create a new team.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only |
| **Method** | POST          |

**Request Body:**

```json
{
  "teamName": "team-alpha",
  "teamMembers": ["user1", "user2", "user3"]
}
```

**Response `201 Created`:**

```json
{
  "teamName": "team-alpha",
  "teamMembers": ["user1", "user2", "user3"],
  "createdAt": "2026-02-13T10:00:00Z"
}
```

**Errors:**

| Status | Condition           |
| ------ | ------------------- |
| `400`  | Missing `teamName`  |
| `409`  | Team already exists |

---

### `PUT /api/teams`

Update an existing team.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only |
| **Method** | PUT           |

**Request Body:**

```json
{
  "teamName": "team-alpha",
  "teamMembers": ["user1", "user2", "user3", "user4"]
}
```

**Response `200 OK`:** Updated team object.

---

### `DELETE /api/teams`

Delete a team and all associated scores.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only |
| **Method** | DELETE        |

**Request Body:**

```json
{
  "teamName": "team-alpha"
}
```

**Response `204 No Content`**

---

### `GET /api/scores`

Retrieve scores. Supports optional query parameters for filtering.

| Property   | Value                             |
| ---------- | --------------------------------- |
| **Auth**   | `authenticated` (`admin` + `member`) |
| **Method** | GET                               |

**Query Parameters:**

| Parameter  | Type   | Description                           |
| ---------- | ------ | ------------------------------------- |
| `team`     | string | Filter by team name (optional)        |
| `category` | string | Filter by scoring category (optional) |

**Response `200 OK`:**

```json
[
  {
    "teamName": "team-alpha",
    "category": "Requirements",
    "criterion": "ProjectContext",
    "points": 4,
    "maxPoints": 4,
    "scoredBy": "facilitator1",
    "timestamp": "2026-02-13T14:30:00Z"
  }
]
```

**Leaderboard Summary (when no filters):**

<details>
<summary>Sample leaderboard summary response</summary>

```json
{
  "leaderboard": [
    {
      "teamName": "team-alpha",
      "baseScore": 95,
      "bonusScore": 15,
      "totalScore": 110,
      "maxBaseScore": 105,
      "percentage": 90.48,
      "grade": "OUTSTANDING",
      "awards": ["BestOverall"]
    }
  ],
  "lastUpdated": "2026-02-13T15:00:00Z"
}
```

</details>

---

### `POST /api/scores`

Admin-only manual score override for a team. Upserts individual criterion scores.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only  |
| **Method** | POST          |

**Request Body:**

```json
{
  "teamName": "team-alpha",
  "overrideReason": "Manual correction after review",
  "scores": [
    {
      "category": "Requirements",
      "criterion": "ProjectContext",
      "points": 4,
      "maxPoints": 4
    },
    {
      "category": "Requirements",
      "criterion": "FunctionalRequirements",
      "points": 3,
      "maxPoints": 4
    }
  ],
  "bonus": [
    {
      "enhancement": "ZoneRedundancy",
      "points": 5,
      "verified": true
    },
    {
      "enhancement": "ManagedIdentities",
      "points": 5,
      "verified": true
    }
  ]
}
```

**Response `200 OK`:**

```json
{
  "teamName": "team-alpha",
  "scoresUpserted": 2,
  "bonusUpserted": 2,
  "newTotal": 95
}
```

**Errors:**

| Status | Condition                                 |
| ------ | ----------------------------------------- |
| `400`  | Points exceed maxPoints for any criterion |
| `400`  | Unknown category or criterion name        |
| `404`  | Team not found                            |

---

### `GET /api/submissions`

Retrieve submission queue for admin review.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only  |
| **Method** | GET           |

**Query Parameters:**

| Parameter | Type   | Description                               |
| --------- | ------ | ----------------------------------------- |
| `status`  | string | `Pending`, `Approved`, `Rejected`         |
| `team`    | string | Optional team filter                      |

**Response `200 OK`:**

```json
[
  {
    "submissionId": "f833513e-7a56-4295-b3dc-58ba6ff8d5a9",
    "teamName": "team-alpha",
    "submittedBy": "user1",
    "submittedAt": "2026-02-13T14:30:00Z",
    "status": "Pending",
    "calculatedTotal": 113
  }
]
```

---

### `POST /api/submissions/validate`

Approve or reject a pending submission.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only  |
| **Method** | POST          |

**Request Body:**

```json
{
  "submissionId": "f833513e-7a56-4295-b3dc-58ba6ff8d5a9",
  "action": "approve",
  "reason": ""
}
```

**Rules:**

- `action` must be `approve` or `reject`
- `reason` is required when `action` is `reject`
- `approve` normalizes the submitted payload into the `Scores` table

**Response `200 OK`:**

```json
{
  "submissionId": "f833513e-7a56-4295-b3dc-58ba6ff8d5a9",
  "teamName": "team-alpha",
  "status": "Approved",
  "reviewedBy": "admin-user",
  "reviewedAt": "2026-02-13T15:00:00Z"
}
```

**Errors:**

| Status | Condition                            |
| ------ | ------------------------------------ |
| `400`  | Invalid action                       |
| `400`  | Reject action missing reason         |
| `404`  | Submission not found                 |

---

### `GET /api/awards`

Retrieve all award assignments.

| Property   | Value                             |
| ---------- | --------------------------------- |
| **Auth**   | `authenticated` (`admin` + `member`) |
| **Method** | GET                               |

**Response `200 OK`:**

```json
[
  {
    "category": "BestOverall",
    "teamName": "team-alpha",
    "assignedBy": "facilitator1",
    "timestamp": "2026-02-13T16:00:00Z"
  }
]
```

---

### `POST /api/awards`

Assign an award to a team. Upserts (one team per award category).

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only |
| **Method** | POST          |

**Request Body:**

```json
{
  "category": "BestOverall",
  "teamName": "team-alpha"
}
```

**Valid Award Categories:**

- `BestOverall`
- `SecurityChampion`
- `CostOptimizer`
- `BestArchitecture`
- `SpeedDemon`

**Response `200 OK`:** Award object with `assignedBy` populated from auth context.

**Errors:**

| Status | Condition              |
| ------ | ---------------------- |
| `400`  | Invalid award category |
| `404`  | Team not found         |

---

### `GET /api/attendees`

Retrieve all attendee registrations. **Admin only** for full list.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only |
| **Method** | GET           |

**Response `200 OK`:**

```json
[
  {
    "gitHubUsername": "user1",
    "firstName": "Jane",
    "surname": "Doe",
    "teamNumber": 1,
    "registeredAt": "2026-02-13T09:00:00Z",
    "updatedAt": "2026-02-13T09:00:00Z"
  }
]
```

---

### `GET /api/attendees/me`

Retrieve the current user's own registration.

| Property   | Value                             |
| ---------- | --------------------------------- |
| **Auth**   | `authenticated` (`admin` + `member`) |
| **Method** | GET                               |

**Response `200 OK`:** Single attendee object.

**Response `404 Not Found`:** User has not registered yet.

---

### `POST /api/attendees/me`

Register or update the current user's profile.

| Property   | Value                             |
| ---------- | --------------------------------- |
| **Auth**   | `authenticated` (`admin` + `member`) |
| **Method** | POST                              |

**Request Body:**

```json
{
  "firstName": "Jane",
  "surname": "Doe",
  "teamNumber": 1
}
```

**Response `201 Created`** (new) or **`200 OK`** (update).

**Errors:**

| Status | Condition                           |
| ------ | ----------------------------------- |
| `400`  | Missing required fields             |
| `400`  | `teamNumber` not a positive integer |

---

### `POST /api/attendees/bulk`

Bulk-import attendee names. Creates Attendee records with blank
`gitHubUsername` (to be claimed via self-service login).

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only  |
| **Method** | POST          |

**Request Body:**

```json
{
  "attendees": [
    { "firstName": "Jane", "surname": "Doe" },
    { "firstName": "John", "surname": "Smith" }
  ]
}
```

**Response `201 Created`:**

```json
{
  "created": 2,
  "duplicates": 0,
  "attendees": [
    { "firstName": "Jane", "surname": "Doe", "id": "doe-jane" },
    { "firstName": "John", "surname": "Smith", "id": "smith-john" }
  ]
}
```

**Errors:**

| Status | Condition                               |
| ------ | --------------------------------------- |
| `400`  | Empty attendees array                   |
| `400`  | Missing firstName or surname in any row |

---

### `POST /api/teams/assign`

Randomly assign all unassigned attendees to N teams using a
Fisher-Yates shuffle.

| Property   | Value         |
| ---------- | ------------- |
| **Auth**   | `admin` only  |
| **Method** | POST          |

**Request Body:**

```json
{
  "teamCount": 5
}
```

**Response `200 OK`:**

```json
{
  "teams": [
    {
      "teamName": "Team 1",
      "members": [
        { "firstName": "Jane", "surname": "Doe", "gitHubUsername": null },
        { "firstName": "John", "surname": "Smith", "gitHubUsername": "jsmith" }
      ]
    }
  ],
  "totalAttendees": 10,
  "teamCount": 5
}
```

**Errors:**

| Status | Condition                                |
| ------ | ---------------------------------------- |
| `400`  | `teamCount` not a positive integer       |
| `400`  | No attendees registered to assign        |
| `400`  | `teamCount` exceeds number of attendees  |

---

### `POST /api/upload`

Submit a `score-results.json` payload for admin validation.

| Property         | Value              |
| ---------------- | ------------------ |
| **Auth**         | `member` only      |
| **Method**       | POST               |
| **Content-Type** | `application/json` |

**Request Body:** The full JSON output from `Score-Team.ps1`:

<details>
<summary>Sample `score-results.json` payload</summary>

```json
{
  "TeamName": "team-alpha",
  "Timestamp": "2026-02-13T12:00:00Z",
  "Categories": {
    "Requirements": {
      "Score": 18,
      "MaxPoints": 20,
      "Criteria": {
        "ProjectContext": 4,
        "FunctionalRequirements": 4,
        "NFRs": 4,
        "Compliance": 3,
        "Budget": 3
      }
    },
    "Architecture": {
      "Score": 22,
      "MaxPoints": 25,
      "Criteria": {
        "CostEstimation": 5,
        "ReliabilityPatterns": 5,
        "SecurityControls": 4,
        "ScalabilityApproach": 4,
        "ServiceSelection": 4
      }
    }
  },
  "Bonus": {
    "ZoneRedundancy": { "Points": 5, "Verified": true },
    "PrivateEndpoints": { "Points": 0, "Verified": false },
    "MultiRegionDR": { "Points": 0, "Verified": false },
    "ManagedIdentities": { "Points": 5, "Verified": true }
  },
  "ShowcaseScore": 8,
  "Total": {
    "Base": 95,
    "Bonus": 10,
    "Showcase": 8,
    "Grand": 113,
    "MaxBase": 105
  },
  "Grade": "OUTSTANDING"
}
```

</details>

**Behavior:**

- Caller team is resolved from `Attendees` profile
- `TeamName` in payload must match caller team
- API stores payload in `Submissions` with `Pending` status
- No writes to `Scores` happen until admin approval

**Response `202 Accepted`:**

```json
{
  "submissionId": "f833513e-7a56-4295-b3dc-58ba6ff8d5a9",
  "teamName": "team-alpha",
  "status": "Pending",
  "message": "Submission received and queued for admin validation"
}
```

**Errors:**

| Status | Condition                          |
| ------ | ---------------------------------- |
| `400`  | Invalid JSON structure             |
| `400`  | Missing `TeamName` field           |
| `403`  | Payload team does not match caller team |
| `400`  | Score values exceed max points     |
| `404`  | Team not found (create team first) |

---

### `GET /api/rubrics`

List all rubric configurations (most recent first).

| Property   | Value                             |
| ---------- | --------------------------------- |
| **Auth**   | `authenticated` (`admin` + `member`) |
| **Method** | GET                               |

**Response `200 OK`:**

```json
[
  {
    "rubricId": "a1b2c3d4-...",
    "name": "Azure InfraOps Microhack 2026",
    "eventName": "Partner Summit Q1",
    "version": 1,
    "baseTotal": 105,
    "bonusTotal": 25,
    "isActive": true,
    "createdBy": "admin-user",
    "createdAt": "2026-01-15T10:00:00Z"
  }
]
```

---

### `POST /api/rubrics`

Upload and parse a new rubric from Markdown content.

| Property         | Value                 |
| ---------------- | --------------------- |
| **Auth**         | `admin` only          |
| **Method**       | POST                  |
| **Content-Type** | `text/markdown` or `application/json` |

**Request Body (Markdown upload):**

Raw Markdown content of the rubric file with `Content-Type: text/markdown`.

**Request Body (JSON — pre-parsed):**

```json
{
  "name": "Azure InfraOps Microhack 2026",
  "eventName": "Partner Summit Q1",
  "sourceMarkdown": "# My Rubric\n\n## Categories\n...",
  "activate": true
}
```

When `activate` is `true`, the new rubric becomes the active rubric and any
previously active rubric is deactivated.

**Response `201 Created`:**

```json
{
  "rubricId": "a1b2c3d4-...",
  "name": "Azure InfraOps Microhack 2026",
  "baseTotal": 105,
  "bonusTotal": 25,
  "isActive": true,
  "categoriesCount": 8,
  "bonusCount": 4,
  "message": "Rubric created and activated"
}
```

**Errors:**

| Status | Condition                                    |
| ------ | -------------------------------------------- |
| `400`  | Markdown could not be parsed into valid rubric |
| `400`  | Missing rubric name                          |
| `400`  | No categories found in parsed rubric         |
| `400`  | Category max points do not sum correctly     |

---

### `GET /api/rubrics/active`

Retrieve the currently active rubric configuration (full JSON).

| Property   | Value                             |
| ---------- | --------------------------------- |
| **Auth**   | `authenticated` (`admin` + `member`) |
| **Method** | GET                               |

**Response `200 OK`:**

<details>
<summary>Sample active rubric response</summary>

```json
{
  "rubricId": "a1b2c3d4-...",
  "name": "Azure InfraOps Microhack 2026",
  "version": 1,
  "categories": [
    {
      "name": "Requirements & Planning",
      "maxPoints": 20,
      "criteria": [
        { "name": "Project context complete", "maxPoints": 4 },
        { "name": "Functional requirements", "maxPoints": 4 },
        { "name": "NFRs (SLA, RTO, RPO)", "maxPoints": 4 },
        { "name": "Compliance identified", "maxPoints": 4 },
        { "name": "Budget stated", "maxPoints": 4 }
      ]
    }
  ],
  "bonus": [
    { "name": "Zone Redundancy", "points": 5, "inputType": "checkbox" },
    { "name": "Private Endpoints", "points": 5, "inputType": "checkbox" },
    { "name": "Multi-Region DR", "points": 10, "inputType": "checkbox" },
    { "name": "Managed Identities", "points": 5, "inputType": "checkbox" }
  ],
  "gradingScale": [
    { "minPercentage": 90, "grade": "OUTSTANDING", "emoji": "🏆" },
    { "minPercentage": 80, "grade": "EXCELLENT", "emoji": "🥇" },
    { "minPercentage": 70, "grade": "GOOD", "emoji": "🥈" },
    { "minPercentage": 60, "grade": "SATISFACTORY", "emoji": "🥉" },
    { "minPercentage": 0, "grade": "NEEDS IMPROVEMENT", "emoji": "📚" }
  ],
  "awards": [
    { "key": "BestOverall", "label": "Best Overall", "emoji": "🏆" },
    { "key": "SecurityChampion", "label": "Security Champion", "emoji": "🛡️" },
    { "key": "CostOptimizer", "label": "Cost Optimizer", "emoji": "💰" },
    { "key": "BestArchitecture", "label": "Best Architecture", "emoji": "📐" },
    { "key": "SpeedDemon", "label": "Speed Demon", "emoji": "🚀" }
  ],
  "baseTotal": 105,
  "bonusTotal": 25,
  "isActive": true,
  "createdBy": "admin-user",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

</details>

**Errors:**

| Status | Condition                    |
| ------ | ---------------------------- |
| `404`  | No active rubric configured  |

---

## Table Storage Key Design

| Table       | PartitionKey    | RowKey                     | Access Pattern                           |
| ----------- | --------------- | -------------------------- | ---------------------------------------- |
| Teams       | `"team"`        | Team name                  | All teams in one partition for fast list |
| Attendees   | GitHub username | `"profile"`                | Direct lookup by username                |
| Attendees   | `"unclaimed"`  | `"{surname}-{firstName}"` | Unclaimed attendees from bulk import     |
| Scores      | Team name       | `"{Category}_{Criterion}"` | All scores for a team in one partition   |
| Submissions | Team name       | Submission GUID            | Queue and audit trail by team            |
| Awards      | `"award"`       | Award category             | All awards in one partition              |
| Rubrics     | `"rubric"`      | Rubric GUID                | All rubrics in one partition             |

### Why This Design

- **Teams**: Fixed PK allows efficient `PartitionKey eq 'team'` query for leaderboard
- **Attendees**: Username as PK enables O(1) lookup for `/.auth/me` → profile resolution.
  Bulk-imported (unclaimed) attendees use PK `"unclaimed"` until a
  GitHub user claims them during login.
- **Scores**: Team as PK groups all scores together; RK pattern enables category filtering
- **Submissions**: Keeps pending and reviewed payloads with reviewer audit metadata
- **Awards**: Fixed PK with 5 known RKs — always a point query
- **Rubrics**: Fixed PK with GUID RKs; query `isActive eq true` to find current rubric

---

## Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "error": {
    "code": "TEAM_NOT_FOUND",
    "message": "Team 'team-alpha' does not exist. Create it first via POST /api/teams."
  }
}
```

**Standard Error Codes:**

| Code                | HTTP Status | Description                         |
| ------------------- | ----------- | ----------------------------------- |
| `VALIDATION_ERROR`  | 400         | Request body failed validation      |
| `TEAM_NOT_FOUND`    | 404         | Referenced team does not exist      |
| `TEAM_EXISTS`       | 409         | Team with this name already exists  |
| `INVALID_CATEGORY`  | 400         | Unknown scoring category            |
| `INVALID_AWARD`     | 400         | Unknown award category              |
| `SCORE_EXCEEDS_MAX` | 400         | Points exceed maximum for criterion |
| `TEAM_SCOPE_VIOLATION` | 403      | Member attempted cross-team submit  |
| `SUBMISSION_NOT_FOUND` | 404      | Submission ID does not exist        |
| `RUBRIC_PARSE_ERROR`   | 400      | Markdown could not be parsed into valid rubric |
| `RUBRIC_NOT_FOUND`     | 404      | No active rubric configured         |
| `UNAUTHORIZED`      | 401         | Missing or invalid auth context     |
| `FORBIDDEN`         | 403         | Insufficient role for operation     |

---

## References

- [app-prd.md](./app-prd.md) — Product requirements with full feature descriptions
- [staticwebapp.config.json](./staticwebapp.config.json) — Route and auth configuration
- [SWA API Documentation](https://learn.microsoft.com/azure/static-web-apps/apis-functions)
- [Azure Tables SDK for JS](https://learn.microsoft.com/javascript/api/@azure/data-tables/)
- [SWA Authentication Context](https://learn.microsoft.com/azure/static-web-apps/user-information)

---
[← Back to Documentation](README.md)
