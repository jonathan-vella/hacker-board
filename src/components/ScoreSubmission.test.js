import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    teams: { list: vi.fn() },
    scores: { override: vi.fn() },
    upload: vi.fn(),
  },
}));

vi.mock("../services/rubric.js", () => ({
  getActiveRubric: vi.fn(),
  getGradeClass: vi.fn(() => "grade-good"),
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => false),
}));

vi.mock("../services/notifications.js", () => ({
  showToast: vi.fn(),
}));

import { renderScoreSubmission } from "./ScoreSubmission.js";
import { api } from "../services/api.js";
import { getActiveRubric } from "../services/rubric.js";

const mockRubric = {
  rowKey: "r1",
  name: "Test Rubric",
  isActive: true,
  baseTotal: 100,
  bonusTotal: 10,
  categories: [
    {
      name: "Security",
      maxPoints: 50,
      criteria: [
        { name: "IAM", maxPoints: 30 },
        { name: "Network", maxPoints: 20 },
      ],
    },
    {
      name: "Reliability",
      maxPoints: 50,
      criteria: [
        { name: "Backup", maxPoints: 25 },
        { name: "Monitoring", maxPoints: 25 },
      ],
    },
  ],
  bonus: [{ name: "Extra Credit", points: 10 }],
  gradingScale: [
    { grade: "OUTSTANDING", minPercent: 90 },
    { grade: "GOOD", minPercent: 60 },
    { grade: "NEEDS IMPROVEMENT", minPercent: 0 },
  ],
};

describe("ScoreSubmission", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows sign-in message when no user", async () => {
    await renderScoreSubmission(container, undefined);

    expect(container.textContent).toContain("Sign In Required");
  });

  it("shows 'no active rubric' when none exists", async () => {
    getActiveRubric.mockResolvedValue(undefined);
    api.teams.list.mockResolvedValue([]);

    await renderScoreSubmission(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("No Active Rubric");
  });

  it("renders dynamic form from active rubric", async () => {
    getActiveRubric.mockResolvedValue(mockRubric);
    api.teams.list.mockResolvedValue([{ teamName: "Team Alpha" }]);

    await renderScoreSubmission(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("h2").textContent).toContain("Submit Score");
    expect(container.textContent).toContain("Security");
    expect(container.textContent).toContain("IAM");
    expect(container.textContent).toContain("Network");
    expect(container.textContent).toContain("Reliability");
    expect(container.textContent).toContain("Backup");
    expect(container.textContent).toContain("Monitoring");
  });

  it("renders bonus items from rubric", async () => {
    getActiveRubric.mockResolvedValue(mockRubric);
    api.teams.list.mockResolvedValue([{ teamName: "Team Alpha" }]);

    await renderScoreSubmission(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Bonus Points");
    expect(container.textContent).toContain("Extra Credit");
  });

  it("renders team dropdown with available teams", async () => {
    getActiveRubric.mockResolvedValue(mockRubric);
    api.teams.list.mockResolvedValue([
      { teamName: "Team Alpha" },
      { teamName: "Team Beta" },
    ]);

    await renderScoreSubmission(container, { userRoles: ["authenticated"] });

    const select = container.querySelector("#team-select");
    expect(select).toBeTruthy();
    const options = select.querySelectorAll("option");
    expect(options.length).toBeGreaterThanOrEqual(3); // placeholder + 2 teams
  });

  it("has number inputs for each criterion", async () => {
    getActiveRubric.mockResolvedValue(mockRubric);
    api.teams.list.mockResolvedValue([{ teamName: "Team Alpha" }]);

    await renderScoreSubmission(container, { userRoles: ["authenticated"] });

    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs).toHaveLength(4); // IAM, Network, Backup, Monitoring
  });
});
