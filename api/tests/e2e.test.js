/**
 * End-to-end API integration tests.
 *
 * These tests spin up the real Express app and exercise every route through
 * HTTP, mocking only the two external I/O boundaries (Cosmos DB and
 * Application Insights) so no Azure connectivity is required in CI.
 *
 * Coverage:
 *   GET  /api/health               – healthy + degraded paths
 *   GET  /api/me                   – unauthenticated, authenticated, admin
 *   GET  /api/teams                – list teams
 *   POST /api/teams                – create team (auth, validation, duplicate)
 *   PUT  /api/teams                – update team (auth, 404)
 *   DELETE /api/teams              – delete team (auth)
 *   POST /api/teams/assign         – random assignment (auth)
 *   GET  /api/attendees            – list attendees
 *   GET  /api/attendees/me         – profile lookup
 *   POST /api/attendees/me         – self-register (idempotent)
 *   DELETE /api/attendees          – delete attendee (auth)
 *   POST /api/attendees/move       – move attendee (auth)
 *   GET  /api/scores               – list scores (optional team filter)
 *   POST /api/scores               – override score (auth, validation)
 *   GET  /api/awards               – list awards
 *   POST /api/awards               – assign award (auth, validation)
 *   GET  /api/submissions          – list submissions (status/team filters)
 *   POST /api/submissions/validate – approve/reject (auth, validation)
 *   POST /api/upload               – bulk upload (auth)
 *   GET  /api/flags                – feature flags
 *   PUT  /api/flags                – update flags (auth)
 *   GET  /api/rubrics              – list rubrics
 *   GET  /api/rubrics/active       – active rubric
 *   GET  /api/rubrics/templates    – list templates
 *   Security headers               – present on every response
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any app imports so Vitest hoists them
// ---------------------------------------------------------------------------

vi.mock("../shared/telemetry.js", () => ({ default: {} }));

vi.mock("../shared/featureFlags.js", () => ({
  getFlags: vi
    .fn()
    .mockResolvedValue({ showAwards: true, registrationOpen: true }),
  setFlags: vi.fn().mockResolvedValue({ showAwards: false }),
  getFlagDescriptions: vi
    .fn()
    .mockReturnValue({ showAwards: "Show awards tab" }),
  clearFlagCache: vi.fn(),
  requireFeature: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../shared/cosmos.js", () => ({
  getContainer: vi.fn(),
  getDatabase: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import {
  getContainer,
  getDatabase,
  nextHackerNumber,
} from "../shared/cosmos.js";
import { createApp } from "../app.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_DB_CONTAINERS = [
  "teams",
  "attendees",
  "scores",
  "submissions",
  "rubrics",
  "config",
];

/** Encode an Easy Auth principal object as the x-ms-client-principal header value. */
function encodePrincipal(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

const USER_PRINCIPAL = {
  identityProvider: "github",
  userId: "u1",
  userDetails: "testuser",
  userRoles: ["anonymous", "authenticated"],
};

const ADMIN_PRINCIPAL = {
  identityProvider: "github",
  userId: "u2",
  userDetails: "testadmin",
  userRoles: ["anonymous", "authenticated", "admin"],
};

const USER_HEADER = encodePrincipal(USER_PRINCIPAL);
const ADMIN_HEADER = encodePrincipal(ADMIN_PRINCIPAL);

/** Build a minimal mock container with configurable per-test behaviour. */
function makeMockContainer(overrides = {}) {
  return {
    items: {
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      }),
      create: vi.fn().mockResolvedValue({ resource: { id: "new-id" } }),
      upsert: vi.fn().mockResolvedValue({ resource: { id: "upserted" } }),
    },
    item: vi.fn().mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: undefined }),
      replace: vi.fn().mockResolvedValue({ resource: {} }),
      delete: vi.fn().mockResolvedValue({}),
    }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// App instance
// ---------------------------------------------------------------------------

let app;

beforeAll(() => {
  // Make testadmin an admin via env var
  process.env.ADMIN_USERS = "github:testadmin";
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Security headers
// ===========================================================================

describe("Security headers", () => {
  it("every API response includes required security headers", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => ({
            resources: REQUIRED_DB_CONTAINERS.map((id) => ({ id })),
          }),
        }),
      },
    });

    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age/);
    expect(res.headers["content-security-policy"]).toMatch(/default-src/);
    expect(res.headers["referrer-policy"]).toBeDefined();
  });
});

// ===========================================================================
// GET /api/health
// ===========================================================================

describe("GET /api/health", () => {
  it("returns 200 and healthy when all containers present", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => ({
            resources: REQUIRED_DB_CONTAINERS.map((id) => ({ id })),
          }),
        }),
      },
    });

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.containers.teams).toBe("ok");
    expect(res.body.containers.config).toBe("ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("buildSha");
  });

  it("returns 503 and degraded when a container is missing", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => ({
            resources: REQUIRED_DB_CONTAINERS.filter((n) => n !== "scores").map(
              (id) => ({ id }),
            ),
          }),
        }),
      },
    });

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.containers.scores).toBe("missing");
  });

  it("returns 503 when Cosmos is unreachable", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => {
            throw new Error("Connection refused");
          },
        }),
      },
    });

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
  });
});

// ===========================================================================
// GET /api/me
// ===========================================================================

describe("GET /api/me", () => {
  it("returns null principal when no auth header", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body.clientPrincipal).toBeNull();
  });

  it("returns decoded principal for authenticated user", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("x-ms-client-principal", USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.clientPrincipal.userDetails).toBe("testuser");
    expect(res.body.clientPrincipal.userRoles).toContain("authenticated");
    expect(res.body.clientPrincipal.userRoles).not.toContain("admin");
  });

  it("injects admin role from ADMIN_USERS env var", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("x-ms-client-principal", ADMIN_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.clientPrincipal.userRoles).toContain("admin");
  });

  it("returns null for a malformed principal header", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("x-ms-client-principal", "not-valid-base64!!");
    expect(res.status).toBe(200);
    expect(res.body.clientPrincipal).toBeNull();
  });
});

// ===========================================================================
// GET /api/teams
// ===========================================================================

describe("GET /api/teams", () => {
  it("returns empty array when no teams exist (and seeds defaults)", async () => {
    const container = makeMockContainer();
    // First call (read) returns empty; subsequent seeding calls return void
    container.items.query.mockReturnValueOnce({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    // After seed, second call returns seeded teams
    container.items.query.mockReturnValueOnce({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          {
            id: "Team01",
            teamName: "Team01",
            teamNumber: 1,
            teamMembers: [],
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    });
    container.items.create.mockResolvedValue({ resource: {} });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns list of teams with expected fields", async () => {
    const docs = [
      {
        id: "Team01",
        teamName: "Team01",
        teamNumber: 1,
        teamMembers: ["alice"],
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "Team02",
        teamName: "Team02",
        teamNumber: 2,
        teamMembers: [],
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: docs }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ teamName: "Team01", teamNumber: 1 });
    expect(res.body[0]).toHaveProperty("teamMembers");
  });
});

// ===========================================================================
// POST /api/teams
// ===========================================================================

describe("POST /api/teams", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app)
      .post("/api/teams")
      .send({ teamName: "NewTeam" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 when teamName is missing", async () => {
    const res = await request(app)
      .post("/api/teams")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when team name already exists", async () => {
    const container = makeMockContainer();
    // Check for existing returns a hit
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [{ id: "NewTeam" }] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .post("/api/teams")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ teamName: "NewTeam" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TEAM_EXISTS");
  });

  it("creates a new team successfully", async () => {
    const container = makeMockContainer();
    container.items.query
      // exists check → empty
      .mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      })
      // max team number → 1
      .mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({ resources: [{ teamNumber: 1 }] }),
      });
    container.items.create.mockResolvedValue({
      resource: { id: "NewTeam", teamName: "NewTeam", teamNumber: 2 },
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .post("/api/teams")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ teamName: "NewTeam" });
    expect(res.status).toBe(201);
    expect(res.body.teamName).toBe("NewTeam");
  });
});

// ===========================================================================
// PUT /api/teams
// ===========================================================================

describe("PUT /api/teams", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app)
      .put("/api/teams")
      .send({ teamName: "Team01" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when team does not exist", async () => {
    const container = makeMockContainer();
    container.item.mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: undefined }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .put("/api/teams")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ teamName: "Ghost" });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// DELETE /api/teams
// ===========================================================================

describe("DELETE /api/teams", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app)
      .delete("/api/teams")
      .send({ teamName: "Team01" });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// POST /api/teams/assign
// ===========================================================================

describe("POST /api/teams/assign", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app).post("/api/teams/assign");
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// GET /api/attendees
// ===========================================================================

describe("GET /api/attendees", () => {
  it("returns list of attendees with non-PII fields only", async () => {
    const docs = [
      {
        hackerAlias: "Team01-Hacker01",
        hackerNumber: 1,
        teamId: "Team01",
        teamName: "Team01",
        gitHubUsername: "alice",
        registeredAt: "2026-02-01T10:00:00Z",
      },
    ];
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: docs }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/attendees");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).not.toHaveProperty("firstName");
    expect(res.body[0]).not.toHaveProperty("surname");
    expect(res.body[0]).toHaveProperty("alias");
    expect(res.body[0].alias).toBe("Team01-Hacker01");
  });
});

// ===========================================================================
// GET /api/attendees/me
// ===========================================================================

describe("GET /api/attendees/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/attendees/me");
    expect(res.status).toBe(401);
  });

  it("returns attendee profile when found", async () => {
    const doc = {
      id: "uuid-1",
      gitHubUsername: "testuser",
      hackerAlias: "Team01-Hacker01",
      hackerNumber: 1,
      teamId: "Team01",
      teamName: "Team01",
      registeredAt: "2026-02-01T10:00:00Z",
    };
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [doc] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .get("/api/attendees/me")
      .set("x-ms-client-principal", USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.alias).toBe("Team01-Hacker01");
    expect(res.body.teamName).toBe("Team01");
  });

  it("returns null profile when user not registered", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .get("/api/attendees/me")
      .set("x-ms-client-principal", USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.registered).toBe(false);
  });
});

// ===========================================================================
// POST /api/attendees/me (self-register)
// ===========================================================================

describe("POST /api/attendees/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).post("/api/attendees/me");
    expect(res.status).toBe(401);
  });

  it("registers a new attendee and returns alias", async () => {
    nextHackerNumber.mockResolvedValueOnce(3);

    const teamsContainer = makeMockContainer();
    teamsContainer.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          { id: "Team01", teamName: "Team01", teamNumber: 1, memberCount: 0 },
        ],
      }),
    });
    teamsContainer.item.mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: { id: "Team01", teamName: "Team01", teamMembers: [] },
      }),
      replace: vi.fn().mockResolvedValue({}),
    });

    const attendeesContainer = makeMockContainer();
    // Not already registered
    attendeesContainer.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    attendeesContainer.items.create.mockResolvedValue({
      resource: {
        hackerAlias: "Team01-Hacker03",
        teamName: "Team01",
        registeredAt: new Date().toISOString(),
      },
    });

    getContainer.mockImplementation((name) =>
      name === "teams" ? teamsContainer : attendeesContainer,
    );

    const res = await request(app)
      .post("/api/attendees/me")
      .set("x-ms-client-principal", USER_HEADER);
    expect(res.status).toBe(201);
    expect(res.body.alias).toMatch(/Hacker/);
  });
});

// ===========================================================================
// DELETE /api/attendees
// ===========================================================================

describe("DELETE /api/attendees", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app)
      .delete("/api/attendees")
      .send({ alias: "alice" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when attendee not found", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .delete("/api/attendees")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ alias: "ghost" });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/attendees/move
// ===========================================================================

describe("POST /api/attendees/move", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app)
      .post("/api/attendees/move")
      .send({ alias: "alice", toTeam: "Team02" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when alias or toTeam is missing", async () => {
    const res = await request(app)
      .post("/api/attendees/move")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ alias: "alice" });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// GET /api/scores
// ===========================================================================

describe("GET /api/scores", () => {
  it("returns all scores", async () => {
    const docs = [
      {
        id: "s1",
        teamId: "Team01",
        category: "Requirements",
        points: 4,
        maxPoints: 4,
        timestamp: "2026-02-01T10:00:00Z",
      },
    ];
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: docs }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/scores");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("leaderboard");
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  it("accepts optional team query parameter", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/scores?team=Team01");
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// POST /api/scores
// ===========================================================================

describe("POST /api/scores", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app)
      .post("/api/scores")
      .send({
        teamId: "Team01",
        category: "Requirements",
        criterion: "ProjectContext",
        points: 4,
        maxPoints: 4,
      });
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// GET /api/awards
// ===========================================================================

describe("GET /api/awards", () => {
  it("returns awards list", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          {
            category: "BestOverall",
            teamName: "Team01",
            assignedBy: "admin",
            assignedAt: "2026-02-01T00:00:00Z",
          },
        ],
      }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/awards");
    expect(res.status).toBe(200);
    expect(res.body[0].category).toBe("BestOverall");
  });
});

// ===========================================================================
// POST /api/awards
// ===========================================================================

describe("POST /api/awards", () => {
  it("returns 400 for invalid award category", async () => {
    const res = await request(app)
      .post("/api/awards")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ category: "FakeCategory", teamName: "Team01" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when teamName is missing", async () => {
    const res = await request(app)
      .post("/api/awards")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ category: "BestOverall" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when team does not exist", async () => {
    const container = makeMockContainer();
    container.item.mockReturnValue({
      read: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("Not found"), { code: 404 }),
        ),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .post("/api/awards")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ category: "BestOverall", teamName: "GhostTeam" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TEAM_NOT_FOUND");
  });

  it("assigns award successfully", async () => {
    const teamsContainer = makeMockContainer();
    teamsContainer.item.mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: { id: "Team01" } }),
    });
    const configContainer = makeMockContainer();
    configContainer.items.upsert.mockResolvedValue({ resource: {} });
    getContainer.mockImplementation((name) =>
      name === "teams" ? teamsContainer : configContainer,
    );

    const res = await request(app)
      .post("/api/awards")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ category: "BestOverall", teamName: "Team01" });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe("BestOverall");
    expect(res.body.teamName).toBe("Team01");
  });
});

// ===========================================================================
// GET /api/submissions
// ===========================================================================

describe("GET /api/submissions", () => {
  it("returns all submissions", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          {
            submissionId: "sub-1",
            teamName: "Team01",
            status: "pending",
            submittedAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/submissions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("accepts status and team query filters", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get(
      "/api/submissions?status=pending&team=Team01",
    );
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// POST /api/submissions/validate
// ===========================================================================

describe("POST /api/submissions/validate", () => {
  it("returns 400 when submissionId is missing", async () => {
    const res = await request(app)
      .post("/api/submissions/validate")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ action: "approve" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid action value", async () => {
    const res = await request(app)
      .post("/api/submissions/validate")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ submissionId: "sub-1", action: "ignore" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when rejecting without a reason", async () => {
    const res = await request(app)
      .post("/api/submissions/validate")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ submissionId: "sub-1", action: "reject" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when submission not found", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app)
      .post("/api/submissions/validate")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ submissionId: "ghost", action: "approve" });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/upload
// ===========================================================================

describe("POST /api/upload", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app).post("/api/upload").send({ scores: [] });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// GET /api/flags
// ===========================================================================

describe("GET /api/flags", () => {
  it("returns flags and descriptions", async () => {
    const res = await request(app).get("/api/flags");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("flags");
    expect(res.body).toHaveProperty("descriptions");
    expect(res.body.flags.showAwards).toBe(true);
  });
});

// ===========================================================================
// PUT /api/flags
// ===========================================================================

describe("PUT /api/flags", () => {
  it("returns 403 without admin auth", async () => {
    const res = await request(app)
      .put("/api/flags")
      .send({ showAwards: false });
    expect(res.status).toBe(403);
  });

  it("updates flags when admin authenticated", async () => {
    const res = await request(app)
      .put("/api/flags")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send({ showAwards: false });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("flags");
  });

  it("returns 400 for non-object body", async () => {
    const res = await request(app)
      .put("/api/flags")
      .set("x-ms-client-principal", ADMIN_HEADER)
      .send("not-json-object");
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// GET /api/rubrics
// ===========================================================================

describe("GET /api/rubrics", () => {
  it("returns rubrics list", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          {
            id: "r1",
            name: "Default Rubric",
            isActive: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/rubrics");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ===========================================================================
// GET /api/rubrics/active
// ===========================================================================

describe("GET /api/rubrics/active", () => {
  it("returns 404 when no active rubric exists", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/rubrics/active");
    expect(res.status).toBe(404);
  });

  it("returns active rubric when found", async () => {
    const container = makeMockContainer();
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          { id: "r1", name: "Default", isActive: true, criteria: [] },
        ],
      }),
    });
    getContainer.mockReturnValue(container);

    const res = await request(app).get("/api/rubrics/active");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("rubricId");
  });
});

// ===========================================================================
// GET /api/rubrics/templates
// ===========================================================================

describe("GET /api/rubrics/templates", () => {
  it("returns template list", async () => {
    const res = await request(app).get("/api/rubrics/templates");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
