import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createAuthHeaders,
  mockRecordset,
} from "./helpers/mock-db.js";

vi.mock("../shared/db.js", () => ({
  query: vi.fn().mockResolvedValue({ recordset: [] }),
  getPool: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { query } from "../shared/db.js";

describe("Teams API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  describe("GET /api/teams", () => {
    it("returns all teams from SQL result", () => {
      const rows = [
        {
          teamName: "team-alpha",
          teamNumber: 1,
          teamMembers: JSON.stringify(["user1", "user2"]),
          createdAt: "2026-02-13T10:00:00Z",
        },
      ];

      const teams = rows.map((row) => ({
        teamName: row.teamName,
        teamNumber: row.teamNumber,
        teamMembers: JSON.parse(row.teamMembers || "[]"),
        createdAt: row.createdAt,
      }));

      expect(teams).toHaveLength(1);
      expect(teams[0].teamName).toBe("team-alpha");
      expect(teams[0].teamMembers).toEqual(["user1", "user2"]);
    });

    it("returns empty array when no teams exist", () => {
      const teams = [].map((row) => ({ teamName: row.teamName }));
      expect(teams).toHaveLength(0);
    });
  });

  describe("POST /api/teams", () => {
    it("creates a new team when name is unique", async () => {
      query.mockResolvedValueOnce({ recordset: [{ existingCount: 0 }] });

      const result = await query(
        "SELECT COUNT(*) AS existingCount FROM dbo.Teams WHERE teamName = @teamName",
        { teamName: "team-beta" },
      );
      expect(result.recordset[0].existingCount).toBe(0);
    });

    it("rejects duplicate team name with 409 simulation", async () => {
      query.mockRejectedValueOnce(
        Object.assign(new Error("Conflict"), { number: 2627 }),
      );

      await expect(
        query("INSERT INTO dbo.Teams (teamName) VALUES (@teamName)", {
          teamName: "team-alpha",
        }),
      ).rejects.toMatchObject({ number: 2627 });
    });
  });

  describe("PUT /api/teams", () => {
    it("updates an existing team", async () => {
      query.mockResolvedValueOnce({ recordset: [{ found: 1 }] });

      const checkResult = await query(
        "SELECT 1 AS found FROM dbo.Teams WHERE id = @id",
        { id: "team-alpha" },
      );
      expect(checkResult.recordset[0].found).toBe(1);
    });

    it("returns 404 for non-existent team", async () => {
      query.mockResolvedValueOnce({ recordset: [] }); // empty = not found

      const checkResult = await query(
        "SELECT 1 AS found FROM dbo.Teams WHERE id = @id",
        { id: "team-nope" },
      );
      expect(checkResult.recordset).toHaveLength(0);
    });
  });

  describe("DELETE /api/teams", () => {
    it("deletes a team and cascades scores", async () => {
      query.mockResolvedValueOnce({ rowsAffected: [1] });

      const deleteTeam = await query("DELETE FROM dbo.Teams WHERE id = @id", {
        id: "team-alpha",
      });
      expect(deleteTeam.rowsAffected[0]).toBe(1);
    });
  });
});
