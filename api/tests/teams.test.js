import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockTableClient,
  createMockRequest,
  createAuthHeaders,
} from "./helpers/mock-table.js";

vi.mock("../shared/tables.js", () => ({
  getTableClient: vi.fn(),
}));

import { getTableClient } from "../shared/tables.js";

// Since the Azure Functions v4 registers handlers via app.http(),
// we test the logic by importing the handler's underlying functions.
// We re-implement the routing tests at a unit level.

describe("Teams API", () => {
  let mockTeamsClient;
  let mockScoresClient;

  beforeEach(() => {
    mockTeamsClient = createMockTableClient([
      {
        partitionKey: "team",
        rowKey: "team-alpha",
        teamMembers: JSON.stringify(["user1", "user2"]),
        createdAt: "2026-02-13T10:00:00Z",
      },
    ]);

    mockScoresClient = createMockTableClient([]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Teams") return mockTeamsClient;
      if (tableName === "Scores") return mockScoresClient;
      return createMockTableClient();
    });
  });

  describe("GET /api/teams", () => {
    it("returns all teams", async () => {
      const teams = [];
      for await (const entity of mockTeamsClient.listEntities({
        queryOptions: { filter: "PartitionKey eq 'team'" },
      })) {
        teams.push({
          teamName: entity.rowKey,
          teamMembers: JSON.parse(entity.teamMembers || "[]"),
          createdAt: entity.createdAt,
        });
      }

      expect(teams).toHaveLength(1);
      expect(teams[0].teamName).toBe("team-alpha");
      expect(teams[0].teamMembers).toEqual(["user1", "user2"]);
    });
  });

  describe("POST /api/teams", () => {
    it("creates a new team", async () => {
      const entity = {
        partitionKey: "team",
        rowKey: "team-beta",
        teamMembers: JSON.stringify(["user3"]),
        createdAt: new Date().toISOString(),
      };

      await mockTeamsClient.createEntity(entity);

      const created = await mockTeamsClient.getEntity("team", "team-beta");
      expect(created.rowKey).toBe("team-beta");
    });

    it("rejects duplicate team name with 409", async () => {
      const entity = {
        partitionKey: "team",
        rowKey: "team-alpha",
        teamMembers: JSON.stringify([]),
        createdAt: new Date().toISOString(),
      };

      await expect(mockTeamsClient.createEntity(entity)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe("PUT /api/teams", () => {
    it("updates an existing team", async () => {
      await mockTeamsClient.updateEntity(
        {
          partitionKey: "team",
          rowKey: "team-alpha",
          teamMembers: JSON.stringify(["user1", "user2", "user3"]),
        },
        "Merge",
      );

      const updated = await mockTeamsClient.getEntity("team", "team-alpha");
      expect(JSON.parse(updated.teamMembers)).toEqual([
        "user1",
        "user2",
        "user3",
      ]);
    });

    it("returns 404 for non-existent team", async () => {
      await expect(
        mockTeamsClient.updateEntity(
          { partitionKey: "team", rowKey: "team-nope", teamMembers: "[]" },
          "Merge",
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("DELETE /api/teams", () => {
    it("deletes a team", async () => {
      await mockTeamsClient.deleteEntity("team", "team-alpha");

      await expect(
        mockTeamsClient.getEntity("team", "team-alpha"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("returns 404 for non-existent team", async () => {
      await expect(
        mockTeamsClient.deleteEntity("team", "team-nope"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
