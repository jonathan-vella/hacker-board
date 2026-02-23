import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    teams: {
      list: vi.fn().mockResolvedValue([]),
      assign: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    attendees: {
      list: vi.fn().mockResolvedValue([]),
      remove: vi.fn(),
      move: vi.fn(),
    },
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
    vi.clearAllMocks();
    api.teams.list.mockResolvedValue([]);
    api.attendees.list.mockResolvedValue([]);
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows access denied for non-admin users", async () => {
    isAdmin.mockReturnValue(false);

    await renderTeamAssignment(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Access Denied");
  });

  it("renders team management page for admin", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Team Management");
    expect(container.querySelector("#reshuffle-btn")).toBeTruthy();
    expect(container.querySelector("#add-team-btn")).toBeTruthy();
    expect(container.querySelector("#new-team-name")).toBeTruthy();
  });

  it("has feedback area", async () => {
    isAdmin.mockReturnValue(true);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("#action-feedback")).toBeTruthy();
  });

  it("shows team cards when teams exist", async () => {
    isAdmin.mockReturnValue(true);
    api.teams.list.mockResolvedValue([
      { teamName: "Team01", teamNumber: 1, teamMembers: [] },
    ]);

    await renderTeamAssignment(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Team01");
    expect(container.querySelector("[data-action='delete-team']")).toBeTruthy();
  });
});
