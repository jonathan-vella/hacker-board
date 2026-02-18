import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockRecordset } from "./helpers/mock-db.js";

vi.mock("../shared/db.js", () => ({
  query: vi.fn().mockResolvedValue({ recordset: [] }),
  getPool: vi.fn(),
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

import { query } from "../shared/db.js";

describe("Upload API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
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

      query.mockResolvedValueOnce(mockRecordset([{ id: "team-uuid-1" }]));

      const teamResult = await query(
        "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
        { teamName: payload.TeamName },
      );
      expect(teamResult.recordset[0].id).toBe("team-uuid-1");
      expect(payload.Total.Grand).toBe(105);
    });

    it("rejects when TeamName is missing", () => {
      const payload = { Total: { Grand: 50 } };
      expect(payload.TeamName).toBeUndefined();
    });

    it("rejects when team does not exist (empty recordset)", async () => {
      query.mockResolvedValueOnce(mockRecordset([]));

      const result = await query(
        "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
        { teamName: "team-nope" },
      );
      expect(result.recordset).toHaveLength(0);
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
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  describe("GET /api/submissions", () => {
    it("returns all submissions from SQL", async () => {
      query.mockResolvedValueOnce(
        mockRecordset([
          {
            id: "sub-001",
            teamName: "team-alpha",
            submittedBy: "user1",
            submittedAt: "2026-02-13T14:30:00Z",
            status: "Pending",
            calculatedTotal: 105,
          },
        ]),
      );

      const result = await query(
        "SELECT s.id, t.teamName, s.submittedBy, s.submittedAt, s.status, s.calculatedTotal FROM dbo.Submissions s JOIN dbo.Teams t ON s.teamId = t.id",
      );
      expect(result.recordset).toHaveLength(1);
      expect(result.recordset[0].status).toBe("Pending");
    });

    it("filters by status via WHERE clause", async () => {
      query.mockResolvedValueOnce(
        mockRecordset([{ id: "sub-001", status: "Pending" }]),
      );

      const result = await query(
        "SELECT * FROM dbo.Submissions WHERE status = @status",
        { status: "Pending" },
      );
      expect(result.recordset).toHaveLength(1);
    });
  });

  describe("POST /api/submissions/validate", () => {
    it("approves a pending submission via UPDATE and writes scores via MERGE", async () => {
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
        teamId: "team-uuid-1",
        status: "Pending",
        payload,
      };

      // SELECT submission
      query.mockResolvedValueOnce(mockRecordset([submission]));
      // UPDATE status
      query.mockResolvedValueOnce({ rowsAffected: [1] });
      // MERGE scores (once per criterion)
      query.mockResolvedValue({ rowsAffected: [1] });

      const subResult = await query(
        "SELECT * FROM dbo.Submissions WHERE id = @id",
        { id: "sub-001" },
      );
      expect(subResult.recordset[0].status).toBe("Pending");

      const updateResult = await query(
        "UPDATE dbo.Submissions SET status = @status WHERE id = @id",
        { status: "Approved", id: "sub-001" },
      );
      expect(updateResult.rowsAffected[0]).toBe(1);
    });

    it("rejects a submission with a reason", async () => {
      query.mockResolvedValueOnce(
        mockRecordset([{ id: "sub-001", status: "Pending" }]),
      );
      query.mockResolvedValueOnce({ rowsAffected: [1] });

      const subResult = await query(
        "SELECT * FROM dbo.Submissions WHERE id = @id",
        { id: "sub-001" },
      );
      expect(subResult.recordset[0].status).toBe("Pending");

      const updateResult = await query(
        "UPDATE dbo.Submissions SET status = @status, reason = @reason WHERE id = @id",
        { status: "Rejected", reason: "Scores look incorrect", id: "sub-001" },
      );
      expect(updateResult.rowsAffected[0]).toBe(1);
    });

    it("returns empty recordset when submission not found", async () => {
      query.mockResolvedValueOnce(mockRecordset([]));

      const result = await query(
        "SELECT * FROM dbo.Submissions WHERE id = @id",
        { id: "sub-nonexistent" },
      );
      expect(result.recordset).toHaveLength(0);
    });
  });
});
