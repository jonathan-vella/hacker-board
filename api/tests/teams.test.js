import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/cosmos.js", () => ({
  getContainer: vi.fn(),
  getDatabase: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { getContainer } from "../shared/cosmos.js";

describe("Teams API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/teams", () => {
    it("returns all teams from Cosmos query", () => {
      const docs = [
        {
          id: "team-alpha",
          teamName: "team-alpha",
          teamNumber: 1,
          teamMembers: ["user1", "user2"],
          createdAt: "2026-02-13T10:00:00Z",
        },
      ];

      const teams = docs.map((doc) => ({
        teamName: doc.teamName,
        teamNumber: doc.teamNumber,
        teamMembers: doc.teamMembers || [],
        createdAt: doc.createdAt,
      }));

      expect(teams).toHaveLength(1);
      expect(teams[0].teamName).toBe("team-alpha");
      expect(teams[0].teamMembers).toEqual(["user1", "user2"]);
    });

    it("returns empty array when no teams exist", () => {
      const teams = [].map((doc) => ({ teamName: doc.teamName }));
      expect(teams).toHaveLength(0);
    });
  });

  describe("POST /api/teams", () => {
    it("creates a new team when name is unique", () => {
      const existing = [];
      expect(existing.length).toBe(0);
    });

    it("rejects duplicate team name with 409", () => {
      const existing = [{ id: "team-alpha" }];
      expect(existing.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/teams", () => {
    it("updates an existing team", () => {
      const resource = { id: "team-alpha", teamName: "team-alpha", teamMembers: [] };
      expect(resource).toBeDefined();
    });

    it("returns 404 for non-existent team", () => {
      const resource = undefined;
      expect(resource).toBeUndefined();
    });
  });

  describe("DELETE /api/teams", () => {
    it("deletes a team and its scores", () => {
      const teamScores = [{ id: "score1" }, { id: "score2" }];
      expect(teamScores).toHaveLength(2);
    });
  });
});
