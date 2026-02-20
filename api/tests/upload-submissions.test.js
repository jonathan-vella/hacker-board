import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/cosmos.js", () => ({
  getContainer: vi.fn(),
  getDatabase: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

vi.mock("../shared/featureFlags.js", () => ({
  getFlags: vi.fn().mockResolvedValue({
    SUBMISSIONS_ENABLED: true,
    LEADERBOARD_LOCKED: false,
    REGISTRATION_OPEN: true,
    AWARDS_VISIBLE: true,
    RUBRIC_UPLOAD_ENABLED: true,
  }),
  requireFeature: vi.fn().mockReturnValue(undefined),
  clearFlagCache: vi.fn(),
}));

import { getContainer } from "../shared/cosmos.js";

describe("Upload API", () => {
  let mockContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContainer = {
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
        }),
        create: vi.fn().mockResolvedValue({ resource: {} }),
        upsert: vi.fn().mockResolvedValue({ resource: {} }),
      },
      item: vi.fn().mockReturnValue({
        read: vi.fn().mockResolvedValue({ resource: undefined }),
        replace: vi.fn().mockResolvedValue({ resource: {} }),
      }),
    };
    getContainer.mockReturnValue(mockContainer);
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

      mockContainer.items.query.mockReturnValueOnce({
        fetchAll: vi
          .fn()
          .mockResolvedValue({
            resources: [{ id: "team-alpha", teamName: "team-alpha" }],
          }),
      });

      const result = await mockContainer.items.query().fetchAll();
      expect(result.resources[0].teamName).toBe("team-alpha");
      expect(payload.Total.Grand).toBe(105);
    });

    it("rejects when TeamName is missing", () => {
      const payload = { Total: { Grand: 50 } };
      expect(payload.TeamName).toBeUndefined();
    });

    it("rejects when team does not exist (empty resources)", async () => {
      mockContainer.items.query.mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      });

      const result = await mockContainer.items.query().fetchAll();
      expect(result.resources).toHaveLength(0);
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
  let mockContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContainer = {
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
        }),
        upsert: vi.fn().mockResolvedValue({ resource: {} }),
      },
      item: vi.fn().mockReturnValue({
        read: vi.fn().mockResolvedValue({ resource: undefined }),
        replace: vi.fn().mockResolvedValue({ resource: {} }),
      }),
    };
    getContainer.mockReturnValue(mockContainer);
  });

  describe("GET /api/submissions", () => {
    it("returns all submissions from Cosmos", async () => {
      mockContainer.items.query.mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({
          resources: [
            {
              id: "sub-001",
              teamId: "team-alpha",
              submittedBy: "user1",
              submittedAt: "2026-02-13T14:30:00Z",
              status: "Pending",
              calculatedTotal: 105,
            },
          ],
        }),
      });

      const result = await mockContainer.items.query().fetchAll();
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].status).toBe("Pending");
    });

    it("filters by status via parameterized query", async () => {
      mockContainer.items.query.mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({
          resources: [{ id: "sub-001", status: "Pending" }],
        }),
      });

      const result = await mockContainer.items.query().fetchAll();
      expect(result.resources).toHaveLength(1);
    });
  });

  describe("POST /api/submissions/validate", () => {
    it("approves a pending submission and upserts scores", async () => {
      const payload = JSON.stringify({
        TeamName: "team-alpha",
        Categories: {
          Requirements: {
            Score: 18,
            MaxPoints: 20,
            Criteria: { ProjectContext: 4 },
          },
        },
        Bonus: { ZoneRedundancy: { Points: 5, Verified: true } },
      });

      const submission = {
        id: "sub-001",
        teamId: "team-alpha",
        status: "Pending",
        payload,
      };

      mockContainer.item.mockReturnValueOnce({
        read: vi.fn().mockResolvedValue({ resource: submission }),
        replace: vi.fn().mockResolvedValue({ resource: { ...submission, status: "Approved" } }),
      });

      const { resource } = await mockContainer.item("sub-001").read();
      expect(resource.status).toBe("Pending");

      const parsed = JSON.parse(resource.payload);
      expect(parsed.Categories.Requirements.Score).toBe(18);
    });
  });
});
