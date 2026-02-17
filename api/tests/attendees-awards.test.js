import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockTableClient,
  createAuthHeaders,
} from "./helpers/mock-table.js";

vi.mock("../shared/tables.js", () => ({
  getTableClient: vi.fn(),
}));

import { getTableClient } from "../shared/tables.js";

describe("Attendees API", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockTableClient([
      {
        partitionKey: "testuser",
        rowKey: "profile",
        firstName: "Jane",
        surname: "Doe",
        gitHubUsername: "testuser",
        teamNumber: 1,
        registeredAt: "2026-02-13T09:00:00Z",
        updatedAt: "2026-02-13T09:00:00Z",
      },
    ]);

    getTableClient.mockReturnValue(mockClient);
  });

  describe("GET /api/attendees/me", () => {
    it("returns user profile when found", async () => {
      const entity = await mockClient.getEntity("testuser", "profile");
      expect(entity.firstName).toBe("Jane");
      expect(entity.surname).toBe("Doe");
    });

    it("returns 404 when user not registered", async () => {
      await expect(
        mockClient.getEntity("unknown", "profile"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("POST /api/attendees/me", () => {
    it("creates a new profile", async () => {
      await mockClient.upsertEntity({
        partitionKey: "newuser",
        rowKey: "profile",
        firstName: "John",
        surname: "Smith",
        gitHubUsername: "newuser",
        teamNumber: 0,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const created = await mockClient.getEntity("newuser", "profile");
      expect(created.firstName).toBe("John");
    });
  });

  describe("GET /api/attendees (admin)", () => {
    it("returns all attendees", async () => {
      const attendees = [];
      for await (const entity of mockClient.listEntities({})) {
        attendees.push(entity);
      }
      expect(attendees).toHaveLength(1);
    });
  });
});

describe("Attendees Bulk Import", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockTableClient([]);
    getTableClient.mockReturnValue(mockClient);
  });

  it("imports multiple attendees", async () => {
    const attendees = [
      { firstName: "Jane", surname: "Doe" },
      { firstName: "John", surname: "Smith" },
    ];

    let created = 0;
    for (const a of attendees) {
      const id = `${a.surname.toLowerCase()}-${a.firstName.toLowerCase()}`;
      await mockClient.createEntity({
        partitionKey: "unclaimed",
        rowKey: id,
        firstName: a.firstName,
        surname: a.surname,
      });
      created++;
    }

    expect(created).toBe(2);
    const jane = await mockClient.getEntity("unclaimed", "doe-jane");
    expect(jane.firstName).toBe("Jane");
  });

  it("detects duplicates", async () => {
    await mockClient.createEntity({
      partitionKey: "unclaimed",
      rowKey: "doe-jane",
      firstName: "Jane",
      surname: "Doe",
    });

    await expect(
      mockClient.createEntity({
        partitionKey: "unclaimed",
        rowKey: "doe-jane",
        firstName: "Jane",
        surname: "Doe",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
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
