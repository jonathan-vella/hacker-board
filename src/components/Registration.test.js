import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    attendees: {
      me: vi.fn(),
      join: vi.fn(),
    },
  },
}));

import { renderRegistration } from "./Registration.js";
import { api } from "../services/api.js";

describe("Registration", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows sign-in message when no user", async () => {
    await renderRegistration(container, undefined);

    expect(container.textContent).toContain("Sign In Required");
  });

  it("renders Join Event button for new user", async () => {
    const notFound = new Error("Not found");
    notFound.status = 404;
    api.attendees.me.mockRejectedValue(notFound);

    await renderRegistration(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("h2").textContent).toBe("Join Event");
    expect(container.querySelector("#join-btn")).toBeTruthy();
    // No name or email inputs
    expect(container.querySelector("#reg-displayname")).toBeNull();
    expect(container.querySelector("#reg-email")).toBeNull();
    expect(container.querySelector("#reg-username")).toBeNull();
  });

  it("shows alias for already-registered user", async () => {
    api.attendees.me.mockResolvedValue({
      alias: "Team03-Hacker07",
      teamName: "Team03",
      teamNumber: 3,
    });

    await renderRegistration(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Team03-Hacker07");
    expect(container.textContent).toContain("Team03");
    // No join button when already registered
    expect(container.querySelector("#join-btn")).toBeNull();
  });

  it("shows error when API fails to load profile", async () => {
    api.attendees.me.mockRejectedValue(new Error("Server error"));

    await renderRegistration(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Failed to load");
    expect(container.textContent).toContain("Server error");
  });
});
