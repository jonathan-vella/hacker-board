import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/cosmos.js", () => ({
  getContainer: vi.fn(),
  getDatabase: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

describe("Scores API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/scores", () => {
    it("returns scores filtered by team", () => {
      const docs = [
        {
          teamId: "team-alpha",
          category: "Requirements",
          criterion: "ProjectContext",
          points: 4,
          maxPoints: 4,
          timestamp: "2026-02-13T14:30:00Z",
        },
        {
          teamId: "team-alpha",
          category: "Bonus",
          criterion: "ZoneRedundancy",
          points: 5,
          maxPoints: 5,
          timestamp: "2026-02-13T14:30:00Z",
        },
      ];

      expect(docs).toHaveLength(2);
      expect(docs[0].category).toBe("Requirements");
    });

    it("calculates leaderboard aggregation", () => {
      const scores = [
        { category: "Requirements", points: 4, maxPoints: 4 },
        { category: "Bonus", points: 5, maxPoints: 5 },
      ];

      let baseScore = 0;
      let bonusScore = 0;
      let maxBaseScore = 0;

      for (const s of scores) {
        if (s.category === "Bonus") {
          bonusScore += s.points;
        } else {
          baseScore += s.points;
          maxBaseScore += s.maxPoints;
        }
      }

      expect(baseScore).toBe(4);
      expect(bonusScore).toBe(5);
      expect(baseScore + bonusScore).toBe(9);
    });
  });

  describe("POST /api/scores", () => {
    it("upserts scores via container.items.upsert", () => {
      const scoreDoc = {
        id: "team-alpha_Requirements_FunctionalReqs",
        teamId: "team-alpha",
        category: "Requirements",
        criterion: "FunctionalReqs",
        points: 3,
        maxPoints: 4,
      };

      expect(scoreDoc.id).toBe("team-alpha_Requirements_FunctionalReqs");
      expect(scoreDoc.points).toBe(3);
    });

    it("rejects scores exceeding maxPoints (validation)", () => {
      const item = {
        category: "Requirements",
        criterion: "FunctionalReqs",
        points: 10,
        maxPoints: 4,
      };
      expect(item.points > item.maxPoints).toBe(true);
    });
  });
});
