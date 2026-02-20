import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    submissions: { list: vi.fn() },
  },
}));

// auth.js no longer used by SubmissionStatus — no mock needed

import { renderSubmissionStatus } from "./SubmissionStatus.js";
import { api } from "../services/api.js";

describe("SubmissionStatus", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows sign-in message when no user", async () => {
    await renderSubmissionStatus(container, undefined);

    expect(container.textContent).toContain("Sign In Required");
  });

  it("renders submission history table", async () => {
    api.submissions.list.mockResolvedValue([
      {
        partitionKey: "team-01",
        teamName: "Team01",
        status: "approved",
        submittedAt: "2026-02-16T10:00:00Z",
        reason: "",
      },
      {
        partitionKey: "team-02",
        teamName: "Team02",
        status: "rejected",
        submittedAt: "2026-02-16T11:00:00Z",
        reason: "Invalid scores",
      },
    ]);

    await renderSubmissionStatus(container, {
      userRoles: ["authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Submission Status");
    expect(container.textContent).toContain("Team01");
    expect(container.textContent).toContain("Team02");
    expect(container.textContent).toContain("approved");
    expect(container.textContent).toContain("rejected");
    expect(container.textContent).toContain("Invalid scores");
    // submittedBy (GitHub username) must not appear in the UI
    expect(container.textContent).not.toContain("alice");
    expect(container.textContent).not.toContain("bob");
    expect(container.querySelector("th")).not.toBeNull();
    // Column header should not include "Submitted By"
    const headers = [...container.querySelectorAll("th")].map(
      (t) => t.textContent,
    );
    expect(headers).not.toContain("Submitted By");
  });

  it("shows empty state when no submissions", async () => {
    api.submissions.list.mockResolvedValue([]);

    await renderSubmissionStatus(container, {
      userRoles: ["authenticated"],
    });

    expect(container.textContent).toContain("No submissions found");
  });

  it("renders table headers correctly", async () => {
    api.submissions.list.mockResolvedValue([
      {
        partitionKey: "team-1",
        teamName: "Team Alpha",
        status: "pending",
        submittedBy: "alice",
        timestamp: "2026-02-16T10:00:00Z",
      },
    ]);

    await renderSubmissionStatus(container, {
      userRoles: ["authenticated"],
    });

    const headers = Array.from(container.querySelectorAll("th")).map(
      (th) => th.textContent,
    );
    expect(headers).toContain("Team");
    expect(headers).toContain("Status");
    expect(headers).not.toContain("Submitted By");
    expect(headers).toContain("Date");
    expect(headers).toContain("Notes");
  });

  it("shows error when API fails", async () => {
    api.submissions.list.mockRejectedValue(new Error("Timeout"));

    await renderSubmissionStatus(container, {
      userRoles: ["authenticated"],
    });

    expect(container.textContent).toContain("Failed to load submissions");
    expect(container.textContent).toContain("Timeout");
  });
});
