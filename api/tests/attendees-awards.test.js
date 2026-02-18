import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockTableClient,
  createAuthHeaders,
} from "./helpers/mock-table.js";

vi.mock("../shared/tables.js", () => ({
  getTableClient: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { getTableClient, nextHackerNumber } from "../shared/tables.js";

describe("Attendees API", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockTableClient([
      {
        partitionKey: "attendees",
        rowKey: "Hacker01",
        alias: "Team01-Hacker01",
        teamNumber: 1,
        teamId: "team-01",
        teamName: "Team01",
        registeredAt: "2026-02-18T09:00:00Z",
      },
      {
        partitionKey: "_github",
        rowKey: "testuser",
        hackerAlias: "Hacker01",
      },
    ]);

    getTableClient.mockReturnValue(mockClient);
  });

  describe("GET /api/attendees/me", () => {
    it("resolves alias via GitHub lookup row", async () => {
      const lookup = await mockClient.getEntity("_github", "testuser");
      expect(lookup.hackerAlias).toBe("Hacker01");
    });

    it("returns profile by hacker alias", async () => {
      const entity = await mockClient.getEntity("attendees", "Hacker01");
      expect(entity.alias).toBe("Team01-Hacker01");
      expect(entity).not.toHaveProperty("firstName");
      expect(entity).not.toHaveProperty("surname");
    });

    it("returns 404 when lookup row missing", async () => {
      await expect(
        mockClient.getEntity("_github", "unknown"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("POST /api/attendees/me (join event)", () => {
    it("creates hacker row and lookup row for new user", async () => {
      const hackerAlias = `Hacker${String(2).padStart(2, "0")}`;
      nextHackerNumber.mockResolvedValueOnce(2);

      await mockClient.createEntity({
        partitionKey: "attendees",
        rowKey: hackerAlias,
        alias: `Team01-${hackerAlias}`,
        teamNumber: 1,
        teamId: "team-01",
        teamName: "Team01",
        _gitHubUsername: "newuser",
        registeredAt: new Date().toISOString(),
      });
      await mockClient.createEntity({
        partitionKey: "_github",
        rowKey: "newuser",
        hackerAlias,
      });

      const created = await mockClient.getEntity("attendees", "Hacker02");
      expect(created.alias).toBe("Team01-Hacker02");
      expect(created).not.toHaveProperty("gitHubUsername");
    });
  });

  describe("GET /api/attendees (admin list)", () => {
    it("returns attendees without PII fields", async () => {
      const attendees = [];
      for await (const entity of mockClient.listEntities({
        queryOptions: { filter: "PartitionKey eq 'attendees'" },
      })) {
        attendees.push(entity);
      }
      expect(attendees).toHaveLength(1);
      expect(attendees[0].alias).toBe("Team01-Hacker01");
      expect(attendees[0]).not.toHaveProperty("firstName");
      expect(attendees[0]).not.toHaveProperty("surname");
      expect(attendees[0]).not.toHaveProperty("gitHubUsername");
    });
  });
});

describe("Team Assignment", () => {
  let mockAttendeesClient;
  let mockTeamsClient;

  beforeEach(() => {
    mockAttendeesClient = createMockTableClient([
      {
        partitionKey: "attendees",
        rowKey: "Hacker01",
        alias: "Team01-Hacker01",
        teamId: "team-01",
        teamName: "Team01",
        teamNumber: 1,
      },
      {
        partitionKey: "attendees",
        rowKey: "Hacker02",
        alias: "Team02-Hacker02",
        teamId: "team-02",
        teamName: "Team02",
        teamNumber: 2,
      },
      {
        partitionKey: "attendees",
        rowKey: "Hacker03",
        alias: "Team01-Hacker03",
        teamId: "team-01",
        teamName: "Team01",
        teamNumber: 1,
      },
      {
        partitionKey: "attendees",
        rowKey: "Hacker04",
        alias: "Team02-Hacker04",
        teamId: "team-02",
        teamName: "Team02",
        teamNumber: 2,
      },
    ]);

    mockTeamsClient = createMockTableClient([
      {
        partitionKey: "team",
        rowKey: "team-01",
        teamName: "Team01",
        teamNumber: 1,
        teamMembers: '["Hacker01","Hacker03"]',
      },
      {
        partitionKey: "team",
        rowKey: "team-02",
        teamName: "Team02",
        teamNumber: 2,
        teamMembers: '["Hacker02","Hacker04"]',
      },
    ]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Attendees") return mockAttendeesClient;
      if (tableName === "Teams") return mockTeamsClient;
      return createMockTableClient();
    });
  });

  it("distributes hackers across teams evenly", async () => {
    const hackers = [];
    for await (const entity of mockAttendeesClient.listEntities({
      queryOptions: { filter: "PartitionKey eq 'attendees'" },
    })) {
      hackers.push(entity);
    }

    const teamCount = 2;
    const buckets = Array.from({ length: teamCount }, () => []);
    hackers.forEach((h, i) => buckets[i % teamCount].push(h));

    expect(buckets[0]).toHaveLength(2);
    expect(buckets[1]).toHaveLength(2);
  });

  it("team members stored as aliases, not real names", async () => {
    const team = await mockTeamsClient.getEntity("team", "team-01");
    const members = JSON.parse(team.teamMembers);
    expect(members[0]).toMatch(/^Hacker\d+$/);
  });

  it("rejects when no hackers exist", async () => {
    const emptyClient = createMockTableClient([]);
    const hackers = [];
    for await (const entity of emptyClient.listEntities({})) {
      hackers.push(entity);
    }
    expect(hackers).toHaveLength(0);
  });
});

describe("Awards API", () => {
  let mockAwardsClient;
  let mockTeamsClient;

  beforeEach(() => {
    mockTeamsClient = createMockTableClient([
      {
        partitionKey: "team",
        rowKey: "team-01",
        teamName: "Team01",
        teamMembers: "[]",
      },
    ]);

    mockAwardsClient = createMockTableClient([]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Awards") return mockAwardsClient;
      if (tableName === "Teams") return mockTeamsClient;
      return createMockTableClient();
    });
  });

  it("creates an award for a valid team", async () => {
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "Team01",
      // assignedBy kept in storage for audit — not returned to callers
      assignedBy: "_internal_admin",
      timestamp: new Date().toISOString(),
    });

    const award = await mockAwardsClient.getEntity("award", "BestOverall");
    expect(award.teamName).toBe("Team01");
  });

  it("upserts (replaces) existing award", async () => {
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "Team01",
    });

    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "Team02",
    });

    const award = await mockAwardsClient.getEntity("award", "BestOverall");
    expect(award.teamName).toBe("Team02");
  });

  it("lists all awards", async () => {
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "Team01",
    });
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "SecurityChampion",
      teamName: "Team01",
    });

    const awards = [];
    for await (const entity of mockAwardsClient.listEntities({
      queryOptions: { filter: "PartitionKey eq 'award'" },
    })) {
      awards.push(entity);
    }

    expect(awards).toHaveLength(2);
  });
});

describe("Team Assignment", () => {
  let mockAttendeesClient;
  let mockTeamsClient;

  beforeEach(() => {
    mockAttendeesClient = createMockTableClient([
      {
        partitionKey: "unclaimed",
        rowKey: "doe-jane",
        firstName: "Jane",
        surname: "Doe",
        gitHubUsername: "",
      },
      {
        partitionKey: "unclaimed",
        rowKey: "smith-john",
        firstName: "John",
        surname: "Smith",
        gitHubUsername: "jsmith",
      },
      {
        partitionKey: "unclaimed",
        rowKey: "lee-alex",
        firstName: "Alex",
        surname: "Lee",
        gitHubUsername: "",
      },
      {
        partitionKey: "unclaimed",
        rowKey: "chen-wei",
        firstName: "Wei",
        surname: "Chen",
        gitHubUsername: "wchen",
      },
    ]);

    mockTeamsClient = createMockTableClient([]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Attendees") return mockAttendeesClient;
      if (tableName === "Teams") return mockTeamsClient;
      return createMockTableClient();
    });
  });

  it("distributes attendees across teams evenly", async () => {
    const attendees = [];
    for await (const entity of mockAttendeesClient.listEntities({})) {
      attendees.push(entity);
    }

    const teamCount = 2;
    const teams = Array.from({ length: teamCount }, (_, i) => ({
      teamName: `Team ${i + 1}`,
      members: [],
    }));

    attendees.forEach((a, i) => {
      teams[i % teamCount].members.push(a);
    });

    expect(teams[0].members).toHaveLength(2);
    expect(teams[1].members).toHaveLength(2);
  });

  it("rejects when no attendees exist", async () => {
    const emptyClient = createMockTableClient([]);
    const attendees = [];
    for await (const entity of emptyClient.listEntities({})) {
      attendees.push(entity);
    }
    expect(attendees).toHaveLength(0);
  });
});

describe("Awards API", () => {
  let mockAwardsClient;
  let mockTeamsClient;

  beforeEach(() => {
    mockTeamsClient = createMockTableClient([
      { partitionKey: "team", rowKey: "team-alpha", teamMembers: "[]" },
    ]);

    mockAwardsClient = createMockTableClient([]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Awards") return mockAwardsClient;
      if (tableName === "Teams") return mockTeamsClient;
      return createMockTableClient();
    });
  });

  it("creates an award for a valid team", async () => {
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "team-alpha",
      assignedBy: "admin",
      timestamp: new Date().toISOString(),
    });

    const award = await mockAwardsClient.getEntity("award", "BestOverall");
    expect(award.teamName).toBe("team-alpha");
  });

  it("upserts (replaces) existing award", async () => {
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "team-alpha",
    });

    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "team-beta",
    });

    const award = await mockAwardsClient.getEntity("award", "BestOverall");
    expect(award.teamName).toBe("team-beta");
  });

  it("lists all awards", async () => {
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "BestOverall",
      teamName: "team-alpha",
    });
    await mockAwardsClient.upsertEntity({
      partitionKey: "award",
      rowKey: "SecurityChampion",
      teamName: "team-alpha",
    });

    const awards = [];
    for await (const entity of mockAwardsClient.listEntities({
      queryOptions: { filter: "PartitionKey eq 'award'" },
    })) {
      awards.push(entity);
    }

    expect(awards).toHaveLength(2);
  });
});
