import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => false),
  getUsername: vi.fn(() => "testuser"),
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
import { isAdmin } from "../services/auth.js";

describe("Navigation", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("header");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("renders basic nav links for authenticated user", () => {
    const user = { userRoles: ["authenticated"], userDetails: "testuser" };
    renderNavigation(container, user);

    expect(container.querySelector(".app-logo").textContent).toBe(
      "HackerBoard",
    );
    expect(container.querySelector('[href="#/leaderboard"]')).toBeTruthy();
    expect(container.querySelector('[href="#/awards"]')).toBeTruthy();
    expect(container.querySelector('[href="#/submit"]')).toBeTruthy();
  });

  it("shows admin-only links when user is admin", () => {
    isAdmin.mockReturnValue(true);
    const user = {
      userRoles: ["admin", "authenticated"],
      userDetails: "admin",
    };
    renderNavigation(container, user);

    expect(container.querySelector('[href="#/review"]')).toBeTruthy();
    expect(container.querySelector('[href="#/rubrics"]')).toBeTruthy();
    expect(container.querySelector('[href="#/flags"]')).toBeTruthy();
  });

  it("hides admin links for regular users", () => {
    isAdmin.mockReturnValue(false);
    const user = { userRoles: ["authenticated"], userDetails: "member" };
    renderNavigation(container, user);

    expect(container.querySelector('[href="#/review"]')).toBeNull();
    expect(container.querySelector('[href="#/rubrics"]')).toBeNull();
    expect(container.querySelector('[href="#/flags"]')).toBeNull();
  });

  it("includes theme toggle button", () => {
    const user = { userRoles: ["authenticated"], userDetails: "testuser" };
    renderNavigation(container, user);

    const toggle = container.querySelector("#theme-toggle");
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-label")).toContain("dark mode");
  });

  it("includes search input", () => {
    const user = { userRoles: ["authenticated"], userDetails: "testuser" };
    renderNavigation(container, user);

    const search = container.querySelector("#global-search");
    expect(search).toBeTruthy();
    expect(search.getAttribute("aria-label")).toBeTruthy();
  });

  it("includes mobile menu toggle with aria attributes", () => {
    const user = { userRoles: ["authenticated"], userDetails: "testuser" };
    renderNavigation(container, user);

    const btn = container.querySelector("#mobile-menu-btn");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-controls")).toBe("main-nav-list");
  });
});
