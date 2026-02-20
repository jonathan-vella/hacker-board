import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    awards: { list: vi.fn(), assign: vi.fn() },
    teams: { list: vi.fn() },
  },
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => false),
}));

import { renderAwards } from "./Awards.js";
import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

describe("Awards", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("renders all five award categories", async () => {
    api.awards.list.mockResolvedValue([]);
    api.teams.list.mockResolvedValue([]);

    await renderAwards(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("h2").textContent).toBe("Awards");
    expect(container.textContent).toContain("Best Overall");
    expect(container.textContent).toContain("Security Champion");
    expect(container.textContent).toContain("Cost Optimizer");
    expect(container.textContent).toContain("Best Architecture");
    expect(container.textContent).toContain("Speed Demon");
  });

  it("shows winning team for assigned awards", async () => {
    api.awards.list.mockResolvedValue([
      { category: "BestOverall", teamName: "Team Alpha" },
    ]);
    api.teams.list.mockResolvedValue([{ teamName: "Team Alpha" }]);

    await renderAwards(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Team Alpha");
  });

  it("shows 'Not yet awarded' for unassigned categories", async () => {
    api.awards.list.mockResolvedValue([]);
    api.teams.list.mockResolvedValue([]);

    await renderAwards(container, { userRoles: ["authenticated"] });

    const notYet = container.querySelectorAll("div");
    const texts = Array.from(notYet).map((d) => d.textContent);
    expect(texts.some((t) => t.includes("Not yet awarded"))).toBe(true);
  });

  it("shows team dropdown for admin users", async () => {
    isAdmin.mockReturnValue(true);
    api.awards.list.mockResolvedValue([]);
    api.teams.list.mockResolvedValue([
      { teamName: "Team Alpha" },
      { teamName: "Team Beta" },
    ]);

    await renderAwards(container, { userRoles: ["admin", "authenticated"] });

    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("hides assignment controls from non-admin users", async () => {
    isAdmin.mockReturnValue(false);
    api.awards.list.mockResolvedValue([]);
    api.teams.list.mockResolvedValue([]);

    await renderAwards(container, { userRoles: ["authenticated"] });

    expect(container.querySelectorAll("select")).toHaveLength(0);
  });
});
