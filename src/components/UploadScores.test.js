import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    upload: vi.fn(),
  },
}));

import { renderUploadScores } from "./UploadScores.js";

describe("UploadScores", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows sign-in message when no user", async () => {
    await renderUploadScores(container, undefined);

    expect(container.textContent).toContain("Sign In Required");
  });

  it("renders drop zone and file input for authenticated user", async () => {
    await renderUploadScores(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("h2").textContent).toBe(
      "Upload Scores (JSON)",
    );
    expect(container.querySelector("#drop-zone")).toBeTruthy();
    expect(container.querySelector("#file-input")).toBeTruthy();
    expect(container.textContent).toContain("Drag & drop");
  });

  it("has accessible drop zone with keyboard support", async () => {
    await renderUploadScores(container, { userRoles: ["authenticated"] });

    const dropZone = container.querySelector("#drop-zone");
    expect(dropZone.getAttribute("role")).toBe("button");
    expect(dropZone.getAttribute("tabindex")).toBe("0");
    expect(dropZone.getAttribute("aria-label")).toBeTruthy();
  });

  it("hides preview area by default", async () => {
    await renderUploadScores(container, { userRoles: ["authenticated"] });

    const previewArea = container.querySelector("#preview-area");
    expect(previewArea.style.display).toBe("none");
  });

  it("has submit and cancel buttons in preview area", async () => {
    await renderUploadScores(container, { userRoles: ["authenticated"] });

    expect(container.querySelector("#submit-upload")).toBeTruthy();
    expect(container.querySelector("#cancel-upload")).toBeTruthy();
  });

  it("has feedback area with accessible live region", async () => {
    await renderUploadScores(container, { userRoles: ["authenticated"] });

    const feedback = container.querySelector("#upload-feedback");
    expect(feedback).toBeTruthy();
    expect(feedback.getAttribute("role")).toBe("alert");
    expect(feedback.getAttribute("aria-live")).toBe("polite");
  });
});
