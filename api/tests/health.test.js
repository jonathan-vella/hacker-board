import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/db.js", () => ({
  query: vi.fn().mockResolvedValue({ recordset: [] }),
  getPool: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { query } from "../shared/db.js";

const REQUIRED_TABLES = [
  "Teams",
  "Attendees",
  "Scores",
  "Awards",
  "Submissions",
  "Rubrics",
  "Config",
];

describe("health endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  it("returns 200 with healthy status when all tables exist", async () => {
    query.mockResolvedValueOnce({
      recordset: REQUIRED_TABLES.map((TABLE_NAME) => ({ TABLE_NAME })),
    });

    const result = await query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = DB_NAME()",
    );

    const tablesFound = result.recordset.map((r) => r.TABLE_NAME);
    const tables = {};
    let healthy = true;

    for (const name of REQUIRED_TABLES) {
      if (tablesFound.includes(name)) {
        tables[name] = "ok";
      } else {
        tables[name] = "missing";
        healthy = false;
      }
    }

    expect(healthy).toBe(true);
    expect(tables.Teams).toBe("ok");
    expect(tables.Config).toBe("ok");
    expect(Object.keys(tables)).toHaveLength(7);
  });

  it("returns 503 with degraded status when a table is missing", async () => {
    query.mockResolvedValueOnce({
      recordset: REQUIRED_TABLES.filter((n) => n !== "Scores").map(
        (TABLE_NAME) => ({ TABLE_NAME }),
      ),
    });

    const result = await query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ...",
    );
    const tablesFound = result.recordset.map((r) => r.TABLE_NAME);

    let healthy = true;
    const tables = {};
    for (const name of REQUIRED_TABLES) {
      if (tablesFound.includes(name)) {
        tables[name] = "ok";
      } else {
        tables[name] = "missing";
        healthy = false;
      }
    }

    expect(healthy).toBe(false);
    expect(tables.Scores).toBe("missing");
  });

  it("checks all 7 required tables", async () => {
    query.mockResolvedValueOnce({
      recordset: REQUIRED_TABLES.map((TABLE_NAME) => ({ TABLE_NAME })),
    });

    const result = await query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ...",
    );
    const tablesFound = result.recordset.map((r) => r.TABLE_NAME);

    for (const name of REQUIRED_TABLES) {
      expect(tablesFound).toContain(name);
    }
  });

  it("returns degraded when SQL query throws", async () => {
    query.mockRejectedValueOnce(new Error("connection refused"));

    let healthy = true;
    let dbError;
    try {
      await query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ...");
    } catch (err) {
      healthy = false;
      dbError = err.message;
    }

    expect(healthy).toBe(false);
    expect(dbError).toContain("connection refused");
  });

  it("diagnostic mode exposes SQL env vars", () => {
    const diag = {
      sqlServerFqdn: process.env.SQL_SERVER_FQDN ?? "(unset)",
      sqlDatabaseName: process.env.SQL_DATABASE_NAME ?? "(unset)",
      connectionString: !!process.env.SQL_CONNECTION_STRING,
    };
    expect(diag.sqlServerFqdn).toBeDefined();
  });
});
