import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDefaultFlags,
  getFlagDescriptions,
  getFlags,
  setFlags,
  requireFeature,
  clearFlagCache,
} from "../shared/featureFlags.js";
import { createRequestLogger } from "../shared/logger.js";

vi.mock("../shared/db.js", () => ({
  query: vi.fn().mockResolvedValue({ recordset: [] }),
  getPool: vi.fn(),
  nextHackerNumber: vi.fn().mockResolvedValue(1),
}));

import { query } from "../shared/db.js";

describe("shared/featureFlags", () => {
  beforeEach(() => {
    clearFlagCache();
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
  });

  it("getDefaultFlags returns all 5 flags with expected defaults", () => {
    const flags = getDefaultFlags();
    expect(flags.SUBMISSIONS_ENABLED).toBe(true);
    expect(flags.LEADERBOARD_LOCKED).toBe(false);
    expect(flags.REGISTRATION_OPEN).toBe(true);
    expect(flags.AWARDS_VISIBLE).toBe(true);
    expect(flags.RUBRIC_UPLOAD_ENABLED).toBe(true);
    expect(Object.keys(flags)).toHaveLength(5);
  });

  it("getFlagDescriptions returns descriptions for all flags", () => {
    const descs = getFlagDescriptions();
    expect(Object.keys(descs)).toHaveLength(5);
    expect(descs.SUBMISSIONS_ENABLED).toContain("submit");
  });

  it("getFlags returns defaults when Config table has no rows", async () => {
    query.mockResolvedValueOnce({ recordset: [] });

    const flags = await getFlags();
    expect(flags).toEqual(getDefaultFlags());
  });

  it("getFlags reads stored values from Config table", async () => {
    query.mockResolvedValueOnce({
      recordset: [
        { configKey: "SUBMISSIONS_ENABLED", configValue: "false" },
        { configKey: "REGISTRATION_OPEN", configValue: "false" },
      ],
    });

    const flags = await getFlags();
    expect(flags.SUBMISSIONS_ENABLED).toBe(false);
    expect(flags.REGISTRATION_OPEN).toBe(false);
    expect(flags.AWARDS_VISIBLE).toBe(true);
  });

  it("getFlags caches results (second call does not hit db)", async () => {
    query.mockResolvedValueOnce({
      recordset: [{ configKey: "SUBMISSIONS_ENABLED", configValue: "false" }],
    });

    const first = await getFlags();
    expect(first.SUBMISSIONS_ENABLED).toBe(false);

    const second = await getFlags();
    expect(second.SUBMISSIONS_ENABLED).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("clearFlagCache forces fresh read", async () => {
    query.mockResolvedValueOnce({
      recordset: [{ configKey: "SUBMISSIONS_ENABLED", configValue: "false" }],
    });
    await getFlags();

    clearFlagCache();
    query.mockResolvedValueOnce({
      recordset: [{ configKey: "SUBMISSIONS_ENABLED", configValue: "true" }],
    });

    const flags = await getFlags();
    expect(flags.SUBMISSIONS_ENABLED).toBe(true);
  });

  it("setFlags merges with current and writes each flag via MERGE", async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    query.mockResolvedValue({ rowsAffected: [1] });

    const result = await setFlags({ SUBMISSIONS_ENABLED: false });
    expect(result.SUBMISSIONS_ENABLED).toBe(false);
    expect(result.REGISTRATION_OPEN).toBe(true);
  });

  it("setFlags ignores unknown flag names", async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    query.mockResolvedValue({ rowsAffected: [1] });

    const result = await setFlags({ UNKNOWN_FLAG: true });
    expect(result.UNKNOWN_FLAG).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(5);
  });

  it("requireFeature returns undefined when flag is enabled", () => {
    const flags = { SUBMISSIONS_ENABLED: true };
    expect(requireFeature(flags, "SUBMISSIONS_ENABLED")).toBeUndefined();
  });

  it("requireFeature returns 503 when flag is disabled", () => {
    const flags = { SUBMISSIONS_ENABLED: false };
    const result = requireFeature(flags, "SUBMISSIONS_ENABLED");
    expect(result.status).toBe(503);
    expect(result.jsonBody.error.code).toBe("FEATURE_DISABLED");
  });
});

describe("shared/logger", () => {
  it("creates a logger with requestId and user", () => {
    const req = { headers: new Map() };
    const log = createRequestLogger(req);
    expect(log.requestId).toBeDefined();
    expect(log.user).toBe("anonymous");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.done).toBe("function");
  });

  it("extracts username from x-ms-client-principal header", () => {
    const principal = { userDetails: "testuser", userRoles: ["authenticated"] };
    const encoded = Buffer.from(JSON.stringify(principal)).toString("base64");
    const req = { headers: new Map([["x-ms-client-principal", encoded]]) };
    const log = createRequestLogger(req);
    expect(log.user).toBe("testuser");
  });
});
