import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    attendees: {
      list: vi.fn(),
      bulkImport: vi.fn(),
    },
  },
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => true),
}));

import { renderAttendeeBulkEntry } from "./AttendeeBulkEntry.js";
import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

describe("AttendeeBulkEntry", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows access denied for non-admin users", async () => {
    isAdmin.mockReturnValue(false);

    await renderAttendeeBulkEntry(container, {
      userRoles: ["authenticated"],
    });

    expect(container.textContent).toContain("Access Denied");
  });

  it("renders bulk input form and attendee table", async () => {
    isAdmin.mockReturnValue(true);
    api.attendees.list.mockResolvedValue([
      {
        rowKey: "alice",
        displayName: "Alice Smith",
        teamName: "Team Alpha",
        partitionKey: "claimed",
      },
    ]);

    await renderAttendeeBulkEntry(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe(
      "Attendee Management",
    );
    expect(container.querySelector("h3").textContent).toBe("Bulk Import");
    expect(container.querySelector("#bulk-input")).toBeTruthy();
    expect(container.querySelector("#bulk-import-btn")).toBeTruthy();
    expect(container.textContent).toContain("1 registered");
    expect(container.textContent).toContain("Alice Smith");
  });

  it("shows attendee count in header", async () => {
    isAdmin.mockReturnValue(true);
    api.attendees.list.mockResolvedValue([
      { rowKey: "a1", displayName: "Alice", partitionKey: "claimed" },
      { rowKey: "a2", displayName: "Bob", partitionKey: "unclaimed" },
      { rowKey: "a3", displayName: "Carol", partitionKey: "claimed" },
    ]);

    await renderAttendeeBulkEntry(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("3 registered");
  });

  it("shows unclaimed badge for unclaimed attendees", async () => {
    isAdmin.mockReturnValue(true);
    api.attendees.list.mockResolvedValue([
      { rowKey: "a1", displayName: "Alice", partitionKey: "unclaimed" },
    ]);

    await renderAttendeeBulkEntry(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Unclaimed");
    expect(container.querySelector(".badge-pending")).toBeTruthy();
  });

  it("shows empty table when no attendees exist", async () => {
    isAdmin.mockReturnValue(true);
    api.attendees.list.mockResolvedValue([]);

    await renderAttendeeBulkEntry(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("No attendees yet");
  });

  it("shows error when API fails", async () => {
    isAdmin.mockReturnValue(true);
    api.attendees.list.mockRejectedValue(new Error("Connection refused"));

    await renderAttendeeBulkEntry(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Failed to load attendees");
    expect(container.textContent).toContain("Connection refused");
  });
});
