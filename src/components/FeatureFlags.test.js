import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    flags: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => true),
}));

import { renderFeatureFlags } from "./FeatureFlags.js";
import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

const mockFlagResponse = {
  flags: {
    SUBMISSIONS_ENABLED: true,
    LEADERBOARD_LOCKED: false,
    REGISTRATION_OPEN: true,
    AWARDS_VISIBLE: true,
    RUBRIC_UPLOAD_ENABLED: false,
  },
  descriptions: {
    SUBMISSIONS_ENABLED: "Allow score submissions",
    LEADERBOARD_LOCKED: "Lock the leaderboard",
    REGISTRATION_OPEN: "Allow new registrations",
    AWARDS_VISIBLE: "Show awards on leaderboard",
    RUBRIC_UPLOAD_ENABLED: "Allow rubric uploads",
  },
};

describe("FeatureFlags", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows access denied for non-admin users", async () => {
    isAdmin.mockReturnValue(false);

    await renderFeatureFlags(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Access Denied");
    expect(container.querySelector('a[href="#/leaderboard"]')).toBeTruthy();
  });

  it("renders all flag toggles for admin", async () => {
    isAdmin.mockReturnValue(true);
    api.flags.get.mockResolvedValue(mockFlagResponse);

    await renderFeatureFlags(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Feature Flags");
    const checkboxes = container.querySelectorAll("input[data-flag]");
    expect(checkboxes).toHaveLength(5);
  });

  it("checks enabled flags and unchecks disabled flags", async () => {
    isAdmin.mockReturnValue(true);
    api.flags.get.mockResolvedValue(mockFlagResponse);

    await renderFeatureFlags(container, {
      userRoles: ["admin", "authenticated"],
    });

    const submissionsCheckbox = container.querySelector(
      'input[data-flag="SUBMISSIONS_ENABLED"]',
    );
    const rubricCheckbox = container.querySelector(
      'input[data-flag="RUBRIC_UPLOAD_ENABLED"]',
    );
    expect(submissionsCheckbox.checked).toBe(true);
    expect(rubricCheckbox.checked).toBe(false);
  });

  it("shows ON/OFF badges matching flag state", async () => {
    isAdmin.mockReturnValue(true);
    api.flags.get.mockResolvedValue(mockFlagResponse);

    await renderFeatureFlags(container, {
      userRoles: ["admin", "authenticated"],
    });

    const badges = container.querySelectorAll(".flag-badge");
    const onBadges = Array.from(badges).filter((b) =>
      b.classList.contains("flag-on"),
    );
    const offBadges = Array.from(badges).filter((b) =>
      b.classList.contains("flag-off"),
    );
    expect(onBadges).toHaveLength(3);
    expect(offBadges).toHaveLength(2);
  });

  it("renders Save and Reset buttons", async () => {
    isAdmin.mockReturnValue(true);
    api.flags.get.mockResolvedValue(mockFlagResponse);

    await renderFeatureFlags(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("#save-flags-btn")).toBeTruthy();
    expect(container.querySelector("#reset-flags-btn")).toBeTruthy();
  });

  it("shows error when flags fail to load", async () => {
    isAdmin.mockReturnValue(true);
    api.flags.get.mockRejectedValue(new Error("Server down"));

    await renderFeatureFlags(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Failed to load feature flags");
  });
});
