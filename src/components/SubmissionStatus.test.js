import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    submissions: { list: vi.fn() },
  },
}));

vi.mock("../services/auth.js", () => ({
  getUsername: vi.fn(() => "testuser"),
}));

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
        partitionKey: "team-1",
        teamName: "Team Alpha",
        status: "approved",
        submittedBy: "alice",
        timestamp: "2026-02-16T10:00:00Z",
        reason: "",
      },
      {
        partitionKey: "team-2",
        teamName: "Team Beta",
        status: "rejected",
        submittedBy: "bob",
        timestamp: "2026-02-16T11:00:00Z",
        reason: "Invalid scores",
      },
    ]);

    await renderSubmissionStatus(container, {
      userRoles: ["authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Submission Status");
    expect(container.textContent).toContain("Team Alpha");
    expect(container.textContent).toContain("Team Beta");
    expect(container.textContent).toContain("approved");
    expect(container.textContent).toContain("rejected");
    expect(container.textContent).toContain("Invalid scores");
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
    expect(headers).toContain("Submitted By");
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
