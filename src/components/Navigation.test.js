import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => false),
  getMyAlias: vi.fn(async () => "Team03-Hacker07"),
  loginUrl: vi.fn(() => "/.auth/login/github"),
  logoutUrl: vi.fn(() => "/.auth/logout"),
}));

vi.mock("../services/api.js", () => ({
  api: {
    submissions: { list: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("../services/notifications.js", () => ({
  updatePendingBadge: vi.fn(),
}));

import { renderNavigation } from "./Navigation.js";
import { isAdmin, getMyAlias } from "../services/auth.js";

describe("Navigation", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("header");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("renders basic nav links for authenticated user", async () => {
    const user = { userRoles: ["authenticated"], userDetails: "testuser" };
    await renderNavigation(container, user);

    expect(container.querySelector(".app-logo").textContent).toBe(
      "HackerBoard",
    );
    expect(container.querySelector('[href="#/leaderboard"]')).toBeTruthy();
    expect(container.querySelector('[href="#/awards"]')).toBeTruthy();
    expect(container.querySelector('[href="#/submit"]')).toBeTruthy();
  });

  it("shows alias instead of GitHub username", async () => {
    const user = { userRoles: ["authenticated"], userDetails: "octocat" };
    await renderNavigation(container, user);

    expect(container.textContent).toContain("Team03-Hacker07");
    expect(container.textContent).not.toContain("octocat");
  });

  it("shows admin-only links when user is admin", async () => {
    isAdmin.mockReturnValue(true);
    const user = {
      userRoles: ["admin", "authenticated"],
      userDetails: "admin",
    };
    await renderNavigation(container, user);

    expect(container.querySelector('[href="#/review"]')).toBeTruthy();
    expect(container.querySelector('[href="#/rubrics"]')).toBeTruthy();
    expect(container.querySelector('[href="#/flags"]')).toBeTruthy();
  });

  it("hides admin links for regular users", async () => {
    isAdmin.mockReturnValue(false);
    const user = { userRoles: ["authenticated"], userDetails: "member" };
    await renderNavigation(container, user);

    expect(container.querySelector('[href="#/review"]')).toBeNull();
    expect(container.querySelector('[href="#/rubrics"]')).toBeNull();
  });

  it("does not show attendees bulk-entry link", async () => {
    const user = { userRoles: ["admin", "authenticated"] };
    await renderNavigation(container, user);

    // Course bulk entry link removed per anonymization plan
    expect(container.querySelector('[href="#/attendees"]')).toBeNull();
  });
});
