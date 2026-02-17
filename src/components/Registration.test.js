import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    attendees: {
      me: vi.fn(),
      updateMe: vi.fn(),
    },
  },
}));

vi.mock("../services/auth.js", () => ({
  getUsername: vi.fn(() => "octocat"),
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

  it("renders registration form for new user", async () => {
    const notFound = new Error("Not found");
    notFound.status = 404;
    api.attendees.me.mockRejectedValue(notFound);

    await renderRegistration(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("h2").textContent).toBe("Registration");
    const usernameInput = container.querySelector("#reg-username");
    expect(usernameInput).toBeTruthy();
    expect(usernameInput.value).toBe("octocat");
    expect(usernameInput.readOnly).toBe(true);
    expect(container.querySelector("#reg-displayname")).toBeTruthy();
    expect(container.querySelector("#reg-email")).toBeTruthy();
    expect(container.querySelector('button[type="submit"]').textContent).toBe(
      "Register",
    );
  });

  it("pre-fills form for existing user", async () => {
    api.attendees.me.mockResolvedValue({
      displayName: "Mona Lisa",
      email: "mona@github.com",
      teamName: "Team Alpha",
    });

    await renderRegistration(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("#reg-displayname").value).toBe("Mona Lisa");
    expect(container.querySelector("#reg-email").value).toBe("mona@github.com");
    expect(container.textContent).toContain("Team Alpha");
    expect(container.querySelector('button[type="submit"]').textContent).toBe(
      "Update Profile",
    );
  });

  it("shows error when API fails to load profile", async () => {
    api.attendees.me.mockRejectedValue(new Error("Server error"));

    await renderRegistration(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Failed to load profile");
    expect(container.textContent).toContain("Server error");
  });

  it("validates display name is required on submit", async () => {
    const notFound = new Error("Not found");
    notFound.status = 404;
    api.attendees.me.mockRejectedValue(notFound);

    await renderRegistration(container, { userRoles: ["authenticated"] });

    container.querySelector("#reg-displayname").value = "";
    container
      .querySelector("#reg-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(container.textContent).toContain("Display name is required");
  });
});
