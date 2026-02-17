import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    teams: { assign: vi.fn() },
  },
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => true),
}));

import { renderTeamAssignment } from "./TeamAssignment.js";
import { isAdmin } from "../services/auth.js";

describe("TeamAssignment", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows access denied for non-admin users", async () => {
    isAdmin.mockReturnValue(false);

    await renderTeamAssignment(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Access Denied");
  });

  it("renders assignment form for admin", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Team Assignment");
    expect(container.querySelector("#team-count")).toBeTruthy();
    expect(container.querySelector("#assign-btn")).toBeTruthy();
    expect(container.textContent).toContain("Fisher-Yates");
  });

  it("defaults team count to 4", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    const input = container.querySelector("#team-count");
    expect(input.value).toBe("4");
    expect(input.min).toBe("2");
    expect(input.max).toBe("20");
  });

  it("has accessible labels on inputs", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    const input = container.querySelector("#team-count");
    expect(input.getAttribute("aria-label")).toBeTruthy();
    const label = container.querySelector('label[for="team-count"]');
    expect(label).toBeTruthy();
  });

  it("has feedback and preview areas", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("#assign-feedback")).toBeTruthy();
    expect(container.querySelector("#assign-preview")).toBeTruthy();
  });
});
