import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    scores: { list: vi.fn() },
    awards: { list: vi.fn() },
    teams: { list: vi.fn() },
  },
}));

vi.mock("../services/rubric.js", () => ({
  getGradeClass: vi.fn(
    (grade) => `grade-${grade.toLowerCase().replace(/\s+/g, "-")}`,
  ),
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => false),
}));

import { renderLeaderboard } from "./Leaderboard.js";
import { api } from "../services/api.js";

describe("Leaderboard", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("renders leaderboard with ranked card rows", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [
        {
          teamName: "Alpha",
          baseScore: 80,
          bonusScore: 10,
          totalScore: 90,
          percentage: 86,
          grade: "EXCELLENT",
        },
        {
          teamName: "Beta",
          baseScore: 70,
          bonusScore: 5,
          totalScore: 75,
          percentage: 72,
          grade: "GOOD",
        },
      ],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("h2").textContent).toBe("Leaderboard");
    expect(container.querySelectorAll(".lb-row")).toHaveLength(2);
    expect(container.querySelector(".lb-list")).toBeTruthy();
    expect(container.querySelector(".lb-rank-badge--1")).toBeTruthy();
    expect(container.querySelector(".lb-rank-badge--2")).toBeTruthy();
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Beta");
  });

  it("renders team avatar with initials and award badges", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [
        {
          teamName: "Alpha",
          baseScore: 80,
          bonusScore: 10,
          totalScore: 90,
          percentage: 86,
          grade: "EXCELLENT",
        },
      ],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([
      { teamName: "Alpha", category: "BestOverall" },
    ]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("BestOverall");
    expect(container.querySelector(".lb-team-avatar")).toBeTruthy();
    expect(container.querySelector(".lb-team-award")).toBeTruthy();
  });

  it("shows empty state when no scores exist", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("No scores submitted yet");
    expect(container.querySelector(".lb-empty")).toBeTruthy();
  });

  it("shows error message when API fails", async () => {
    api.scores.list.mockRejectedValue(new Error("Network failure"));

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Failed to load leaderboard");
    expect(container.textContent).toContain("Network failure");
  });

  it("renders last update timestamp", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [
        {
          teamName: "Alpha",
          baseScore: 80,
          bonusScore: 10,
          totalScore: 90,
          percentage: 86,
          grade: "EXCELLENT",
        },
      ],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.querySelector(".lb-updated")).toBeTruthy();
    expect(container.textContent).toContain("Last update:");
  });
});
