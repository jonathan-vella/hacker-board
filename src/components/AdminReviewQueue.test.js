import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    submissions: {
      list: vi.fn(),
      validate: vi.fn(),
    },
  },
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => true),
}));

vi.mock("../services/notifications.js", () => ({
  showToast: vi.fn(),
}));

import { renderAdminReviewQueue } from "./AdminReviewQueue.js";
import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

describe("AdminReviewQueue", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows access denied for non-admin users", async () => {
    isAdmin.mockReturnValue(false);

    await renderAdminReviewQueue(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Access Denied");
  });

  it("shows empty state when no pending submissions", async () => {
    isAdmin.mockReturnValue(true);
    api.submissions.list.mockResolvedValue([]);

    await renderAdminReviewQueue(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Review Queue");
    expect(container.textContent).toContain("No pending submissions");
  });

  it("renders pending submissions with approve/reject buttons", async () => {
    isAdmin.mockReturnValue(true);
    api.submissions.list.mockResolvedValue([
      {
        rowKey: "sub-1",
        partitionKey: "team-1",
        teamName: "Team Alpha",
        timestamp: "2026-02-16T10:00:00Z",
        payload: { total: 85 },
      },
      {
        rowKey: "sub-2",
        partitionKey: "team-2",
        teamName: "Team Beta",
        timestamp: "2026-02-16T11:00:00Z",
        payload: { total: 72 },
      },
    ]);

    await renderAdminReviewQueue(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Team Alpha");
    expect(container.textContent).toContain("Team Beta");
    expect(container.textContent).toContain("2 pending");
    expect(container.querySelectorAll(".action-approve")).toHaveLength(2);
    expect(container.querySelectorAll(".action-reject")).toHaveLength(2);
  });

  it("shows payload details in expandable section", async () => {
    isAdmin.mockReturnValue(true);
    api.submissions.list.mockResolvedValue([
      {
        rowKey: "sub-1",
        partitionKey: "team-1",
        teamName: "Team Alpha",
        timestamp: "2026-02-16T10:00:00Z",
        payload: { total: 85 },
      },
    ]);

    await renderAdminReviewQueue(container, {
      userRoles: ["admin", "authenticated"],
    });

    const details = container.querySelector("details");
    expect(details).toBeTruthy();
    expect(details.querySelector("summary").textContent).toContain(
      "View payload",
    );
  });

  it("shows error when API fails", async () => {
    isAdmin.mockReturnValue(true);
    api.submissions.list.mockRejectedValue(new Error("Network error"));

    await renderAdminReviewQueue(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Failed to load queue");
    expect(container.textContent).toContain("Network error");
  });
});
