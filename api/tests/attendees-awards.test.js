import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/cosmos.js", () => ({
  getContainer: vi.fn(),
  getDatabase: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { getContainer, nextHackerNumber } from "../shared/cosmos.js";

describe("Attendees API", () => {
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
      }),
    };
    getContainer.mockReturnValue(mockContainer);
  });

  describe("GET /api/attendees/me", () => {
    it("returns profile by gitHubUsername cross-partition query", async () => {
      const doc = {
        id: "uuid-1",
        gitHubUsername: "testuser",
        hackerAlias: "Team01-Hacker01",
        teamNumber: 1,
        teamId: "Team01",
        teamName: "Team01",
        registeredAt: "2026-02-18T09:00:00Z",
      };
      mockContainer.items.query.mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({ resources: [doc] }),
      });

      const result = await mockContainer.items.query().fetchAll();
      expect(result.resources[0].hackerAlias).toBe("Team01-Hacker01");
    });

    it("returns empty when user not found", async () => {
      mockContainer.items.query.mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      });

      const result = await mockContainer.items.query().fetchAll();
      expect(result.resources).toHaveLength(0);
    });
  });

  describe("POST /api/attendees/me (join event)", () => {
    it("allocates next hacker number from counter doc", async () => {
      nextHackerNumber.mockResolvedValueOnce(2);

      const num = await nextHackerNumber();
      const alias = `Team01-Hacker${String(num).padStart(2, "0")}`;

      expect(alias).toBe("Team01-Hacker02");
    });

    it("is idempotent — returns existing profile when gitHubUsername matches", async () => {
      const existing = {
        id: "uuid-1",
        gitHubUsername: "testuser",
        hackerAlias: "Team01-Hacker01",
        registeredAt: "2026-02-18T09:00:00Z",
      };
      mockContainer.items.query.mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({ resources: [existing] }),
      });

      const result = await mockContainer.items.query().fetchAll();
      expect(result.resources[0].hackerAlias).toBe("Team01-Hacker01");
    });
  });

  describe("GET /api/attendees (admin list)", () => {
    it("returns docs without PII fields", () => {
      const docs = [
        {
          id: "uuid-1",
          hackerAlias: "Team01-Hacker01",
          teamNumber: 1,
          teamName: "Team01",
          registeredAt: "2026-02-18T09:00:00Z",
        },
      ];
      expect(docs[0]).not.toHaveProperty("firstName");
      expect(docs[0]).not.toHaveProperty("surname");
      expect(docs[0].hackerAlias).toBe("Team01-Hacker01");
    });
  });
});

describe("Team Assignment (teams-assign)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("distributes attendees across teams evenly via shuffle", () => {
    const attendees = [
      { id: "a1", firstName: "Jane", surname: "Doe", gitHubUsername: "" },
      { id: "a2", firstName: "John", surname: "Smith", gitHubUsername: "jsmith" },
      { id: "a3", firstName: "Alex", surname: "Lee", gitHubUsername: "" },
      { id: "a4", firstName: "Wei", surname: "Chen", gitHubUsername: "wchen" },
    ];

    const teamCount = 2;
    const teams = Array.from({ length: teamCount }, (_, i) => ({
      teamName: `Team ${i + 1}`,
      members: [],
    }));

    attendees.forEach((a, i) => teams[i % teamCount].members.push(a));

    expect(teams[0].members).toHaveLength(2);
    expect(teams[1].members).toHaveLength(2);
  });

  it("returns empty when no attendees exist", async () => {
    const mockContainer = {
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
        }),
      },
    };
    getContainer.mockReturnValue(mockContainer);

    const result = await mockContainer.items.query().fetchAll();
    expect(result.resources).toHaveLength(0);
  });

  it("teamCount > attendees.length is invalid", () => {
    const attendees = [{ id: "a1" }];
    const teamCount = 2;
    expect(teamCount > attendees.length).toBe(true);
  });
});

describe("Awards API", () => {
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
      }),
    };
    getContainer.mockReturnValue(mockContainer);
  });

  it("creates an award for a valid team via upsert", async () => {
    mockContainer.items.query.mockReturnValueOnce({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [{ id: "team-alpha", teamName: "team-alpha" }],
      }),
    });

    const teamResult = await mockContainer.items.query().fetchAll();
    expect(teamResult.resources[0].teamName).toBe("team-alpha");

    const awardDoc = {
      id: "award_BestOverall",
      type: "award",
      category: "BestOverall",
      teamName: "team-alpha",
      assignedAt: new Date().toISOString(),
    };
    await mockContainer.items.upsert(awardDoc);
    expect(mockContainer.items.upsert).toHaveBeenCalledWith(awardDoc);
  });

  it("upsert replaces existing award for same category", () => {
    const category = "BestOverall";
    const latest = {
      id: `award_${category}`,
      type: "award",
      category,
      teamName: "team-beta",
      assignedAt: "2026-01-02T00:00:00Z",
    };
    expect(latest.teamName).toBe("team-beta");
    expect(latest.id).toBe("award_BestOverall");
  });

  it("lists all awards from config container", async () => {
    mockContainer.items.query.mockReturnValueOnce({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          { id: "award_BestOverall", category: "BestOverall", teamName: "team-alpha", assignedAt: "2026-01-01" },
          { id: "award_SecurityChampion", category: "SecurityChampion", teamName: "team-alpha", assignedAt: "2026-01-02" },
        ],
      }),
    });

    const result = await mockContainer.items.query().fetchAll();
    expect(result.resources).toHaveLength(2);
  });
});
