import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    scores: { list: vi.fn() },
    awards: { list: vi.fn() },
    teams: { list: vi.fn() },
  },
}));

vi.mock("../services/rubric.js", () => ({
  getGradeClass: vi.fn((grade) => `grade-${grade.toLowerCase().replace(/\s+/g, "-")}`),
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

  it("renders champion spotlight and ranked table with scores", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [
        { teamName: "Alpha", baseScore: 80, bonusScore: 10, totalScore: 90, percentage: 86, grade: "EXCELLENT" },
        { teamName: "Beta", baseScore: 70, bonusScore: 5, totalScore: 75, percentage: 72, grade: "GOOD" },
      ],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("h2").textContent).toBe("Champions Spotlight");
    expect(container.querySelectorAll(".champion-card")).toHaveLength(2);
    expect(container.querySelector(".leaderboard-table")).toBeTruthy();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Beta");
  });

  it("shows award badges next to winning teams", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [
        { teamName: "Alpha", baseScore: 80, bonusScore: 10, totalScore: 90, percentage: 86, grade: "EXCELLENT" },
      ],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([
      { teamName: "Alpha", category: "BestOverall" },
    ]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("BestOverall");
  });

  it("shows empty state when no scores exist", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("No scores");
  });

  it("shows error message when API fails", async () => {
    api.scores.list.mockRejectedValue(new Error("Network failure"));

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Failed to load leaderboard");
    expect(container.textContent).toContain("Network failure");
  });

  it("renders mobile card fallback section", async () => {
    api.scores.list.mockResolvedValue({
      leaderboard: [
        { teamName: "Alpha", baseScore: 80, bonusScore: 10, totalScore: 90, percentage: 86, grade: "EXCELLENT" },
      ],
      lastUpdated: new Date().toISOString(),
    });
    api.awards.list.mockResolvedValue([]);

    await renderLeaderboard(container, { userRoles: ["authenticated"] });

    expect(container.querySelector(".leaderboard-cards")).toBeTruthy();
    expect(container.querySelector(".leaderboard-card")).toBeTruthy();
  });
});
