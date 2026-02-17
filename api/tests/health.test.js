import { describe, it, expect, vi, beforeEach } from "vitest";

const REQUIRED_TABLES = [
  "Teams",
  "Attendees",
  "Scores",
  "Awards",
  "Submissions",
  "Rubrics",
  "Config",
];

function createMockListClient(shouldFail = false) {
  return {
    listEntities: () => ({
      next: shouldFail
        ? () => Promise.reject(new Error("Table not found"))
        : () => Promise.resolve({ done: true }),
    }),
  };
}

async function runHealthCheck(getTableClient) {
  const started = Date.now();
  const tables = {};
  let healthy = true;

  for (const name of REQUIRED_TABLES) {
    try {
      const client = getTableClient(name);
      const iter = client.listEntities({ queryOptions: { top: 1 } });
      await iter.next();
      tables[name] = "ok";
    } catch (err) {
      tables[name] = `error: ${err.message}`;
      healthy = false;
    }
  }

  return {
    status: healthy ? 200 : 503,
    jsonBody: {
      status: healthy ? "healthy" : "degraded",
      tables,
      uptime: process.uptime(),
      duration: Date.now() - started,
    },
  };
}

describe("health endpoint", () => {
  it("returns 200 with healthy status when all tables respond", async () => {
    const getTableClient = () => createMockListClient(false);

    const result = await runHealthCheck(getTableClient);

    expect(result.status).toBe(200);
    expect(result.jsonBody.status).toBe("healthy");
    expect(result.jsonBody.tables.Teams).toBe("ok");
    expect(result.jsonBody.tables.Config).toBe("ok");
    expect(Object.keys(result.jsonBody.tables)).toHaveLength(7);
    expect(typeof result.jsonBody.uptime).toBe("number");
    expect(typeof result.jsonBody.duration).toBe("number");
  });

  it("returns 503 with degraded status when a table fails", async () => {
    let callCount = 0;
    const getTableClient = () => {
      callCount++;
      return createMockListClient(callCount === 3);
    };

    const result = await runHealthCheck(getTableClient);

    expect(result.status).toBe(503);
    expect(result.jsonBody.status).toBe("degraded");
    expect(result.jsonBody.tables.Scores).toContain("error");
  });

  it("checks all 7 required tables", async () => {
    const getTableClient = () => createMockListClient(false);

    const result = await runHealthCheck(getTableClient);
    const tableNames = Object.keys(result.jsonBody.tables);

    expect(tableNames).toContain("Teams");
    expect(tableNames).toContain("Attendees");
    expect(tableNames).toContain("Scores");
    expect(tableNames).toContain("Awards");
    expect(tableNames).toContain("Submissions");
    expect(tableNames).toContain("Rubrics");
    expect(tableNames).toContain("Config");
  });

  it("reports individual table errors without failing healthy tables", async () => {
    const getTableClient = (name) =>
      createMockListClient(name === "Awards" || name === "Config");

    const result = await runHealthCheck(getTableClient);

    expect(result.status).toBe(503);
    expect(result.jsonBody.tables.Teams).toBe("ok");
    expect(result.jsonBody.tables.Awards).toContain("error");
    expect(result.jsonBody.tables.Config).toContain("error");
    expect(result.jsonBody.tables.Scores).toBe("ok");
  });
});
