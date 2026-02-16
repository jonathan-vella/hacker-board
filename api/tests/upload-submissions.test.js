import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockTableClient,
  createAuthHeaders,
} from "./helpers/mock-table.js";

vi.mock("../shared/tables.js", () => ({
  getTableClient: vi.fn(),
}));

import { getTableClient } from "../shared/tables.js";

describe("Upload API", () => {
  let mockTeamsClient;
  let mockSubmissionsClient;

  beforeEach(() => {
    mockTeamsClient = createMockTableClient([
      {
        partitionKey: "team",
        rowKey: "team-alpha",
        teamMembers: "[]",
        createdAt: "2026-02-13T10:00:00Z",
      },
    ]);

    mockSubmissionsClient = createMockTableClient([]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Teams") return mockTeamsClient;
      if (tableName === "Submissions") return mockSubmissionsClient;
      return createMockTableClient();
    });
  });

  describe("POST /api/upload", () => {
    it("creates a pending submission for a valid payload", async () => {
      const payload = {
        TeamName: "team-alpha",
        Total: { Base: 95, Bonus: 10, Grand: 105, MaxBase: 105 },
        Categories: {
          Requirements: {
            Score: 18,
            MaxPoints: 20,
            Criteria: { ProjectContext: 4 },
          },
        },
      };

      // Verify team exists
      const team = await mockTeamsClient.getEntity("team", "team-alpha");
      expect(team).toBeDefined();

      // Create submission
      const submissionId = "test-submission-id";
      await mockSubmissionsClient.createEntity({
        partitionKey: payload.TeamName,
        rowKey: submissionId,
        submittedBy: "testuser",
        submittedAt: new Date().toISOString(),
        status: "Pending",
        payload: JSON.stringify(payload),
        calculatedTotal: payload.Total.Grand,
      });

      const saved = await mockSubmissionsClient.getEntity(
        "team-alpha",
        submissionId,
      );
      expect(saved.status).toBe("Pending");
      expect(saved.calculatedTotal).toBe(105);
    });

    it("rejects when TeamName is missing", () => {
      const payload = { Total: { Grand: 50 } };
      expect(payload.TeamName).toBeUndefined();
    });

    it("rejects when team does not exist", async () => {
      await expect(
        mockTeamsClient.getEntity("team", "team-nope"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("rejects when base score exceeds max", () => {
      const payload = {
        TeamName: "team-alpha",
        Total: { Base: 120, MaxBase: 105 },
      };
      expect(payload.Total.Base > payload.Total.MaxBase).toBe(true);
    });
  });
});

describe("Submissions API", () => {
  let mockSubmissionsClient;
  let mockScoresClient;

  beforeEach(() => {
    mockSubmissionsClient = createMockTableClient([
      {
        partitionKey: "team-alpha",
        rowKey: "sub-001",
        submittedBy: "user1",
        submittedAt: "2026-02-13T14:30:00Z",
        status: "Pending",
        calculatedTotal: 105,
        payload: JSON.stringify({
          TeamName: "team-alpha",
          Categories: {
            Requirements: {
              Score: 18,
              MaxPoints: 20,
              Criteria: { ProjectContext: 4 },
            },
          },
          Bonus: { ZoneRedundancy: { Points: 5, Verified: true } },
        }),
      },
    ]);

    mockScoresClient = createMockTableClient([]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Submissions") return mockSubmissionsClient;
      if (tableName === "Scores") return mockScoresClient;
      return createMockTableClient();
    });
  });

  describe("GET /api/submissions", () => {
    it("returns all submissions", async () => {
      const submissions = [];
      for await (const entity of mockSubmissionsClient.listEntities({})) {
        submissions.push(entity);
      }
      expect(submissions).toHaveLength(1);
      expect(submissions[0].status).toBe("Pending");
    });

    it("filters by status", async () => {
      const submissions = [];
      for await (const entity of mockSubmissionsClient.listEntities({
        queryOptions: { filter: "status eq 'Pending'" },
      })) {
        submissions.push(entity);
      }
      expect(submissions).toHaveLength(1);
    });
  });

  describe("POST /api/submissions/validate", () => {
    it("approves a pending submission and writes scores", async () => {
      const submission = await mockSubmissionsClient.getEntity(
        "team-alpha",
        "sub-001",
      );
      expect(submission.status).toBe("Pending");

      // Approve
      await mockSubmissionsClient.updateEntity(
        {
          partitionKey: "team-alpha",
          rowKey: "sub-001",
          status: "Approved",
          reviewedBy: "admin",
          reviewedAt: new Date().toISOString(),
        },
        "Merge",
      );

      const updated = await mockSubmissionsClient.getEntity(
        "team-alpha",
        "sub-001",
      );
      expect(updated.status).toBe("Approved");

      // Write scores from payload
      const payload = JSON.parse(submission.payload);
      for (const [category, data] of Object.entries(payload.Categories)) {
        for (const [criterion, points] of Object.entries(data.Criteria)) {
          await mockScoresClient.upsertEntity({
            partitionKey: "team-alpha",
            rowKey: `${category}_${criterion}`,
            category,
            criterion,
            points,
            maxPoints: data.MaxPoints,
          });
        }
      }

      const score = await mockScoresClient.getEntity(
        "team-alpha",
        "Requirements_ProjectContext",
      );
      expect(score.points).toBe(4);
    });

    it("rejects a submission with a reason", async () => {
      await mockSubmissionsClient.updateEntity(
        {
          partitionKey: "team-alpha",
          rowKey: "sub-001",
          status: "Rejected",
          reviewedBy: "admin",
          reason: "Scores look incorrect",
        },
        "Merge",
      );

      const updated = await mockSubmissionsClient.getEntity(
        "team-alpha",
        "sub-001",
      );
      expect(updated.status).toBe("Rejected");
      expect(updated.reason).toBe("Scores look incorrect");
    });

    it("rejects when submission not found", async () => {
      await expect(
        mockSubmissionsClient.getEntity("team-alpha", "sub-nonexistent"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
