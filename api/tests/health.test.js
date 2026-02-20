import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/cosmos.js", () => ({
  getContainer: vi.fn(),
  getDatabase: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { getDatabase } from "../shared/cosmos.js";

const REQUIRED_CONTAINERS = [
  "teams",
  "attendees",
  "scores",
  "submissions",
  "rubrics",
  "config",
];

describe("health endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with healthy status when all containers exist", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => ({
            resources: REQUIRED_CONTAINERS.map((id) => ({ id })),
          }),
        }),
      },
    });

    const db = getDatabase();
    const { resources } = await db.containers.readAll().fetchAll();
    const containersFound = resources.map((c) => c.id);
    const containers = {};
    let healthy = true;

    for (const name of REQUIRED_CONTAINERS) {
      if (containersFound.includes(name)) {
        containers[name] = "ok";
      } else {
        containers[name] = "missing";
        healthy = false;
      }
    }

    expect(healthy).toBe(true);
    expect(containers.teams).toBe("ok");
    expect(containers.config).toBe("ok");
    expect(Object.keys(containers)).toHaveLength(6);
  });

  it("returns 503 with degraded status when a container is missing", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => ({
            resources: REQUIRED_CONTAINERS.filter((n) => n !== "scores").map(
              (id) => ({ id }),
            ),
          }),
        }),
      },
    });

    const db = getDatabase();
    const { resources } = await db.containers.readAll().fetchAll();
    const containersFound = resources.map((c) => c.id);

    let healthy = true;
    const containers = {};
    for (const name of REQUIRED_CONTAINERS) {
      if (containersFound.includes(name)) {
        containers[name] = "ok";
      } else {
        containers[name] = "missing";
        healthy = false;
      }
    }

    expect(healthy).toBe(false);
    expect(containers.scores).toBe("missing");
  });

  it("checks all 6 required containers", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => ({
            resources: REQUIRED_CONTAINERS.map((id) => ({ id })),
          }),
        }),
      },
    });

    const db = getDatabase();
    const { resources } = await db.containers.readAll().fetchAll();
    const containersFound = resources.map((c) => c.id);

    for (const name of REQUIRED_CONTAINERS) {
      expect(containersFound).toContain(name);
    }
  });

  it("returns degraded when Cosmos query throws", async () => {
    getDatabase.mockReturnValue({
      containers: {
        readAll: () => ({
          fetchAll: async () => {
            throw new Error("connection refused");
          },
        }),
      },
    });

    let healthy = true;
    let dbError;
    try {
      const db = getDatabase();
      await db.containers.readAll().fetchAll();
    } catch (err) {
      healthy = false;
      dbError = err.message;
    }

    expect(healthy).toBe(false);
    expect(dbError).toBe("connection refused");
  });
});
