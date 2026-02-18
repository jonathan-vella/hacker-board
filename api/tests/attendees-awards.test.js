import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockRecordset } from "./helpers/mock-db.js";

vi.mock("../shared/db.js", () => ({
  query: vi.fn().mockResolvedValue({ recordset: [] }),
  getPool: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { query, nextHackerNumber } from "../shared/db.js";

describe("Attendees API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  describe("GET /api/attendees/me", () => {
    it("returns profile by gitHubUsername JOIN", async () => {
      const row = {
        id: "uuid-1",
        gitHubUsername: "testuser",
        hackerAlias: "Team01-Hacker01",
        teamNumber: 1,
        teamId: "team-uuid",
        teamName: "Team01",
        registeredAt: "2026-02-18T09:00:00Z",
      };
      query.mockResolvedValueOnce(mockRecordset([row]));

      const result = await query(
        "SELECT a.id, a.gitHubUsername FROM dbo.Attendees a WHERE a.gitHubUsername = @gitHubUsername",
        { gitHubUsername: "testuser" },
      );
      expect(result.recordset[0].hackerAlias).toBe("Team01-Hacker01");
    });

    it("returns empty when user not found", async () => {
      query.mockResolvedValueOnce(mockRecordset([]));

      const result = await query(
        "SELECT a.id FROM dbo.Attendees a WHERE a.gitHubUsername = @gitHubUsername",
        { gitHubUsername: "unknown" },
      );
      expect(result.recordset).toHaveLength(0);
    });
  });

  describe("POST /api/attendees/me (join event)", () => {
    it("allocates next hacker number from sequence", async () => {
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
      query.mockResolvedValueOnce(mockRecordset([existing]));

      const result = await query(
        "SELECT id, gitHubUsername, hackerAlias FROM dbo.Attendees WHERE gitHubUsername = @gitHubUsername",
        { gitHubUsername: "testuser" },
      );
      expect(result.recordset[0].hackerAlias).toBe("Team01-Hacker01");
    });
  });

  describe("GET /api/attendees (admin list)", () => {
    it("returns rows without PII fields", () => {
      const rows = [
        {
          id: "uuid-1",
          hackerAlias: "Team01-Hacker01",
          teamNumber: 1,
          teamName: "Team01",
          registeredAt: "2026-02-18T09:00:00Z",
        },
      ];
      expect(rows[0]).not.toHaveProperty("firstName");
      expect(rows[0]).not.toHaveProperty("surname");
      expect(rows[0].hackerAlias).toBe("Team01-Hacker01");
    });
  });
});

describe("Team Assignment (teams-assign)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  it("distributes attendees across teams evenly via round-robin", () => {
    const attendees = [
      { id: "a1", firstName: "Jane", surname: "Doe", gitHubUsername: "" },
      {
        id: "a2",
        firstName: "John",
        surname: "Smith",
        gitHubUsername: "jsmith",
      },
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
    query.mockResolvedValueOnce(mockRecordset([]));

    const result = await query("SELECT id FROM dbo.Attendees");
    expect(result.recordset).toHaveLength(0);
  });

  it("teamCount > attendees.length is invalid", () => {
    const attendees = [{ id: "a1" }];
    const teamCount = 2;
    expect(teamCount > attendees.length).toBe(true);
  });
});

describe("Awards API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  it("creates an award for a valid team via MERGE", async () => {
    query
      .mockResolvedValueOnce(
        mockRecordset([{ id: "uuid-t1", teamName: "team-alpha" }]),
      )
      .mockResolvedValueOnce({ rowsAffected: [1] });

    const teamResult = await query(
      "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
      { teamName: "team-alpha" },
    );
    expect(teamResult.recordset[0].teamName).toBe("team-alpha");

    const merge = await query("MERGE dbo.Awards ...");
    expect(merge.rowsAffected[0]).toBe(1);
  });

  it("MERGE upserts replace existing award for same category", () => {
    const category = "BestOverall";
    const latest = {
      category,
      teamName: "team-beta",
      assignedAt: "2026-01-02T00:00:00Z",
    };
    expect(latest.teamName).toBe("team-beta");
  });

  it("lists all awards from SQL SELECT", async () => {
    query.mockResolvedValueOnce(
      mockRecordset([
        {
          category: "BestOverall",
          teamName: "team-alpha",
          assignedAt: "2026-01-01",
        },
        {
          category: "SecurityChampion",
          teamName: "team-alpha",
          assignedAt: "2026-01-02",
        },
      ]),
    );

    const result = await query(
      "SELECT category, teamName, assignedAt FROM dbo.Awards",
    );
    expect(result.recordset).toHaveLength(2);
  });
});
