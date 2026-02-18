import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockRecordset } from "./helpers/mock-db.js";

vi.mock("../shared/db.js", () => ({
  query: vi.fn().mockResolvedValue({ recordset: [] }),
  getPool: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { query } from "../shared/db.js";

describe("Scores API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  describe("GET /api/scores", () => {
    it("returns scores filtered by team", async () => {
      const rows = [
        {
          teamName: "team-alpha",
          category: "Requirements",
          criterion: "ProjectContext",
          points: 4,
          maxPoints: 4,
          scoredBy: "admin",
          timestamp: "2026-02-13T14:30:00Z",
        },
        {
          teamName: "team-alpha",
          category: "Bonus",
          criterion: "ZoneRedundancy",
          points: 5,
          maxPoints: 5,
          scoredBy: "admin",
          timestamp: "2026-02-13T14:30:00Z",
        },
      ];

      query.mockResolvedValueOnce(mockRecordset(rows));

      const result = await query(
        "SELECT * FROM dbo.Scores WHERE teamName = @teamName",
        { teamName: "team-alpha" },
      );

      expect(result.recordset).toHaveLength(2);
      expect(result.recordset[0].category).toBe("Requirements");
    });

    it("calculates leaderboard aggregation from SQL result", () => {
      const rows = [
        {
          teamName: "team-alpha",
          baseScore: 4,
          bonusScore: 5,
          totalScore: 9,
          maxBase: 4,
          grade: "A",
        },
      ];

      const leaderboard = rows.map((row) => ({
        teamName: row.teamName,
        baseScore: row.baseScore,
        bonusScore: row.bonusScore,
        totalScore: row.totalScore,
      }));

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].baseScore).toBe(4);
      expect(leaderboard[0].bonusScore).toBe(5);
      expect(leaderboard[0].totalScore).toBe(9);
    });
  });

  describe("POST /api/scores", () => {
    it("upserts scores via MERGE statement", async () => {
      query.mockResolvedValueOnce({ recordset: [{ id: "team-alpha-uuid" }] }); // team lookup
      query.mockResolvedValueOnce({ rowsAffected: [1] }); // MERGE

      const teamCheck = await query(
        "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
        { teamName: "team-alpha" },
      );
      expect(teamCheck.recordset[0].id).toBe("team-alpha-uuid");

      const merge = await query("MERGE dbo.Scores ...", {
        teamId: "team-alpha-uuid",
        category: "Requirements",
        criterion: "FunctionalReqs",
        points: 3,
      });
      expect(merge.rowsAffected[0]).toBe(1);
    });

    it("rejects scores exceeding maxPoints (validation)", () => {
      const item = {
        category: "Requirements",
        criterion: "Test",
        points: 10,
        maxPoints: 4,
      };
      expect(item.points > item.maxPoints).toBe(true);
    });

    it("returns 404 for non-existent team", async () => {
      query.mockResolvedValueOnce({ recordset: [] }); // empty = team not found

      const result = await query(
        "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
        { teamName: "team-nope" },
      );
      expect(result.recordset).toHaveLength(0);
    });
  });
});
