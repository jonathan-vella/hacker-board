import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    teams: { list: vi.fn() },
    scores: { list: vi.fn(), override: vi.fn() },
  },
}));

vi.mock("../services/rubric.js", () => ({
  getActiveRubric: vi.fn(),
  getGradeClass: vi.fn(() => "grade-good"),
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => true),
}));

vi.mock("../services/notifications.js", () => ({
  showToast: vi.fn(),
}));

import { renderQuickScore } from "./QuickScore.js";
import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";
import { getActiveRubric } from "../services/rubric.js";

describe("QuickScore", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("shows access denied for non-admin users", async () => {
    isAdmin.mockReturnValue(false);

    await renderQuickScore(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Access Denied");
  });

  it("shows message when no active rubric", async () => {
    isAdmin.mockReturnValue(true);
    getActiveRubric.mockResolvedValue(undefined);
    api.teams.list.mockResolvedValue([]);

    await renderQuickScore(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("No Active Rubric");
  });

  it("renders scoring form with team selector and categories", async () => {
    isAdmin.mockReturnValue(true);
    getActiveRubric.mockResolvedValue({
      categories: [
        {
          name: "Requirements",
          maxPoints: 20,
          criteria: [
            { name: "Project Context", maxPoints: 4 },
            { name: "Scope Definition", maxPoints: 4 },
          ],
        },
      ],
      bonus: [{ name: "Zone Redundancy", points: 5 }],
      baseTotal: 20,
      bonusTotal: 5,
    });
    api.teams.list.mockResolvedValue([
      { teamName: "Team Alpha" },
      { teamName: "Team Beta" },
    ]);

    await renderQuickScore(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Quick Score");
    expect(container.querySelector("#qs-team")).toBeTruthy();
    const options = container.querySelectorAll("#qs-team option");
    expect(options).toHaveLength(3);
    expect(container.querySelectorAll(".qs-category")).toHaveLength(2);
    expect(container.querySelector("#qs-0-0")).toBeTruthy();
    expect(container.querySelector("#qs-bonus-0")).toBeTruthy();
  });

  it("renders no teams message when no teams exist", async () => {
    isAdmin.mockReturnValue(true);
    getActiveRubric.mockResolvedValue({
      categories: [
        {
          name: "Requirements",
          maxPoints: 20,
          criteria: [{ name: "A", maxPoints: 20 }],
        },
      ],
      baseTotal: 20,
      bonusTotal: 0,
    });
    api.teams.list.mockResolvedValue([]);

    await renderQuickScore(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("No Teams");
  });

  it("shows error when API fails", async () => {
    isAdmin.mockReturnValue(true);
    getActiveRubric.mockRejectedValue(new Error("Network error"));
    api.teams.list.mockRejectedValue(new Error("Network error"));

    await renderQuickScore(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Failed to load");
  });
});
