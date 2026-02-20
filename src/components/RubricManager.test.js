import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({
  api: {
    rubrics: {
      list: vi.fn(),
      create: vi.fn(),
      templates: vi.fn(),
      activateTemplate: vi.fn(),
    },
  },
}));

vi.mock("../services/auth.js", () => ({
  isAdmin: vi.fn(() => true),
}));

vi.mock("../services/rubric.js", () => ({
  clearRubricCache: vi.fn(),
}));

import { renderRubricManager } from "./RubricManager.js";
import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

describe("RubricManager", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("main");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  it("shows access denied for non-admin users", async () => {
    isAdmin.mockReturnValue(false);

    await renderRubricManager(container, { userRoles: ["authenticated"] });

    expect(container.textContent).toContain("Access Denied");
  });

  it("renders upload form and rubric list for admin", async () => {
    isAdmin.mockReturnValue(true);
    api.rubrics.list.mockResolvedValue([
      {
        rowKey: "r1",
        name: "Default Rubric",
        baseTotal: 105,
        bonusTotal: 25,
        isActive: true,
        createdAt: "2026-02-16T00:00:00Z",
      },
    ]);
    api.rubrics.templates.mockResolvedValue([
      {
        slug: "infraops-microhack",
        name: "InfraOps Microhack",
        baseTotal: 105,
        bonusTotal: 25,
        categoriesCount: 8,
      },
    ]);

    await renderRubricManager(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("h2").textContent).toBe("Rubric Management");
    expect(container.textContent).toContain("Event Templates");
    expect(container.querySelector("#rubric-drop")).toBeTruthy();
    expect(container.querySelector("#rubric-file")).toBeTruthy();
    expect(container.querySelector("#rubric-name")).toBeTruthy();
    expect(container.querySelector("#rubric-activate")).toBeTruthy();
    expect(container.querySelector("#rubric-submit")).toBeTruthy();
  });

  it("renders rubric table with active badge", async () => {
    isAdmin.mockReturnValue(true);
    api.rubrics.templates.mockResolvedValue([]);
    api.rubrics.list.mockResolvedValue([
      {
        rowKey: "r1",
        name: "Active Rubric",
        baseTotal: 105,
        bonusTotal: 25,
        isActive: true,
        createdAt: "2026-02-16T00:00:00Z",
      },
      {
        rowKey: "r2",
        name: "Old Rubric",
        baseTotal: 100,
        bonusTotal: 10,
        isActive: false,
        createdAt: "2026-02-15T00:00:00Z",
      },
    ]);

    await renderRubricManager(container, {
      userRoles: ["admin", "authenticated"],
    });

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(container.textContent).toContain("Active Rubric");
    expect(container.textContent).toContain("Old Rubric");
    expect(container.querySelector(".badge-approved").textContent).toBe(
      "Active",
    );
    expect(container.querySelector(".badge-pending").textContent).toBe(
      "Archived",
    );
  });

  it("shows empty table when no rubrics exist", async () => {
    isAdmin.mockReturnValue(true);
    api.rubrics.list.mockResolvedValue([]);
    api.rubrics.templates.mockResolvedValue([]);

    await renderRubricManager(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("No rubrics uploaded");
  });

  it("disables upload button by default", async () => {
    isAdmin.mockReturnValue(true);
    api.rubrics.list.mockResolvedValue([]);
    api.rubrics.templates.mockResolvedValue([]);

    await renderRubricManager(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.querySelector("#rubric-submit").disabled).toBe(true);
  });

  it("shows error when API fails", async () => {
    isAdmin.mockReturnValue(true);
    api.rubrics.list.mockRejectedValue(new Error("Service unavailable"));
    api.rubrics.templates.mockRejectedValue(new Error("Service unavailable"));

    await renderRubricManager(container, {
      userRoles: ["admin", "authenticated"],
    });

    expect(container.textContent).toContain("Failed to load rubrics");
    expect(container.textContent).toContain("Service unavailable");
  });

  it("renders template cards when templates are available", async () => {
    isAdmin.mockReturnValue(true);
    api.rubrics.list.mockResolvedValue([]);
    api.rubrics.templates.mockResolvedValue([
      {
        slug: "infraops-microhack",
        name: "InfraOps Microhack",
        baseTotal: 105,
        bonusTotal: 25,
        categoriesCount: 8,
      },
      {
        slug: "azure-migrate-wds",
        name: "Azure Migrate WDS",
        baseTotal: 100,
        bonusTotal: 15,
        categoriesCount: 6,
      },
    ]);

    await renderRubricManager(container, {
      userRoles: ["admin", "authenticated"],
    });

    const tplCards = container.querySelectorAll(".rubric-tpl-card");
    expect(tplCards).toHaveLength(2);
    expect(container.textContent).toContain("InfraOps Microhack");
    expect(container.textContent).toContain("Azure Migrate WDS");
    expect(container.querySelectorAll(".tpl-activate")).toHaveLength(2);
  });
});
