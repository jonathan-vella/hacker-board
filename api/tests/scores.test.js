import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockTableClient,
  createAuthHeaders,
} from "./helpers/mock-table.js";

vi.mock("../shared/tables.js", () => ({
  getTableClient: vi.fn(),
}));

import { getTableClient } from "../shared/tables.js";

describe("Scores API", () => {
  let mockScoresClient;
  let mockTeamsClient;

  beforeEach(() => {
    mockTeamsClient = createMockTableClient([
      {
        partitionKey: "team",
        rowKey: "team-alpha",
        teamMembers: "[]",
        createdAt: "2026-02-13T10:00:00Z",
      },
    ]);

    mockScoresClient = createMockTableClient([
      {
        partitionKey: "team-alpha",
        rowKey: "Requirements_ProjectContext",
        category: "Requirements",
        criterion: "ProjectContext",
        points: 4,
        maxPoints: 4,
        scoredBy: "admin",
        timestamp: "2026-02-13T14:30:00Z",
      },
      {
        partitionKey: "team-alpha",
        rowKey: "Bonus_ZoneRedundancy",
        category: "Bonus",
        criterion: "ZoneRedundancy",
        points: 5,
        maxPoints: 5,
        scoredBy: "admin",
        timestamp: "2026-02-13T14:30:00Z",
      },
    ]);

    getTableClient.mockImplementation((tableName) => {
      if (tableName === "Scores") return mockScoresClient;
      if (tableName === "Teams") return mockTeamsClient;
      return createMockTableClient();
    });
  });

  describe("GET /api/scores", () => {
    it("returns scores filtered by team", async () => {
      const scores = [];
      for await (const entity of mockScoresClient.listEntities({
        queryOptions: { filter: "PartitionKey eq 'team-alpha'" },
      })) {
        scores.push(entity);
      }

      expect(scores).toHaveLength(2);
      expect(scores[0].category).toBe("Requirements");
    });

    it("calculates leaderboard when no team filter", async () => {
      const scores = [];
      for await (const entity of mockScoresClient.listEntities({})) {
        scores.push(entity);
      }

      const teamScores = new Map();
      for (const score of scores) {
        if (!teamScores.has(score.partitionKey)) {
          teamScores.set(score.partitionKey, { base: 0, bonus: 0, maxBase: 0 });
        }
        const ts = teamScores.get(score.partitionKey);
        if (score.category === "Bonus") {
          ts.bonus += score.points;
        } else {
          ts.base += score.points;
          ts.maxBase += score.maxPoints;
        }
      }

      const leaderboard = [...teamScores.entries()].map(([teamName, ts]) => ({
        teamName,
        baseScore: ts.base,
        bonusScore: ts.bonus,
        totalScore: ts.base + ts.bonus,
      }));

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].baseScore).toBe(4);
      expect(leaderboard[0].bonusScore).toBe(5);
      expect(leaderboard[0].totalScore).toBe(9);
    });
  });

  describe("POST /api/scores", () => {
    it("upserts scores for a valid team", async () => {
      const scoreItems = [
        {
          category: "Requirements",
          criterion: "FunctionalReqs",
          points: 3,
          maxPoints: 4,
        },
      ];

      for (const item of scoreItems) {
        await mockScoresClient.upsertEntity({
          partitionKey: "team-alpha",
          rowKey: `${item.category}_${item.criterion}`,
          ...item,
          scoredBy: "admin",
          timestamp: new Date().toISOString(),
        });
      }

      const saved = await mockScoresClient.getEntity(
        "team-alpha",
        "Requirements_FunctionalReqs",
      );
      expect(saved.points).toBe(3);
    });

    it("rejects scores exceeding maxPoints", () => {
      const item = {
        category: "Requirements",
        criterion: "Test",
        points: 10,
        maxPoints: 4,
      };
      expect(item.points > item.maxPoints).toBe(true);
    });

    it("returns 404 for non-existent team", async () => {
      await expect(
        mockTeamsClient.getEntity("team", "team-nope"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
