import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    teams: { list: vi.fn() },
    attendees: { list: vi.fn() },
  },
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => true),
}));

import { renderTeamRoster } from "./TeamRoster.js";
import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

describe("TeamRoster", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("renders teams with their members", async () => {
    api.teams.list.mockResolvedValue([
      { rowKey: "team-1", name: "Team Alpha" },
      { rowKey: "team-2", name: "Team Beta" },
    ]);
    api.attendees.list.mockResolvedValue([
      { rowKey: "a1", displayName: "Alice", teamName: "Team Alpha" },
      { rowKey: "a2", displayName: "Bob", teamName: "Team Alpha" },
      { rowKey: "a3", displayName: "Carol", teamName: "Team Beta" },
    ]);

    await renderTeamRoster(container, { userRoles: ["admin", "authenticated"] });

    expect(container.querySelector("h2").textContent).toBe("Team Roster");
    expect(container.textContent).toContain("Team Alpha");
    expect(container.textContent).toContain("2 members");
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).toContain("Team Beta");
    expect(container.textContent).toContain("1 member");
    expect(container.textContent).toContain("Carol");
  });

  it("shows empty state when no teams exist", async () => {
    api.teams.list.mockResolvedValue([]);
    api.attendees.list.mockResolvedValue([]);

    await renderTeamRoster(container, { userRoles: ["admin", "authenticated"] });

    expect(container.textContent).toContain("No teams created yet");
  });

  it("shows error when API fails", async () => {
    api.teams.list.mockRejectedValue(new Error("Connection lost"));

    await renderTeamRoster(container, { userRoles: ["admin", "authenticated"] });

    expect(container.textContent).toContain("Failed to load teams");
    expect(container.textContent).toContain("Connection lost");
  });

  it("shows teams with no members", async () => {
    api.teams.list.mockResolvedValue([
      { rowKey: "team-1", name: "Empty Team" },
    ]);
    api.attendees.list.mockResolvedValue([]);

    await renderTeamRoster(container, { userRoles: ["admin", "authenticated"] });

    expect(container.textContent).toContain("Empty Team");
    expect(container.textContent).toContain("No members assigned");
  });
});
