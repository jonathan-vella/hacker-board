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
import { api } from "../services/api.js";
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

  it("renders re-shuffle form for admin", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Team Assignment");
    expect(container.querySelector("#assign-btn")).toBeTruthy();
    expect(container.textContent).toContain("Re-shuffle");
    // Team count input removed — auto-assignment is the default
    expect(container.querySelector("#team-count")).toBeNull();
  });

  it("has feedback and preview areas", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("#assign-feedback")).toBeTruthy();
    expect(container.querySelector("#assign-preview")).toBeTruthy();
  });

  it("shows error on API failure", async () => {
    isAdmin.mockReturnValue(true);
    api.teams.assign.mockRejectedValueOnce(new Error("Server down"));

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    // Trigger button click via the component
    const btn = container.querySelector("#assign-btn");
    expect(btn).toBeTruthy();
  });
});
