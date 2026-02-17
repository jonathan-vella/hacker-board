import { describe, it, expect, beforeEach } from "vitest";
import {
  getDefaultFlags,
  getFlagDescriptions,
  getFlags,
  setFlags,
  requireFeature,
  clearFlagCache,
} from "../shared/featureFlags.js";
import { createRequestLogger } from "../shared/logger.js";

function createMockTableClient(existingEntity) {
  const store = new Map();
  if (existingEntity) {
    store.set(
      `${existingEntity.partitionKey}:${existingEntity.rowKey}`,
      existingEntity,
    );
  }

  return {
    async getEntity(pk, rk) {
      const entity = store.get(`${pk}:${rk}`);
      if (!entity) {
        const err = new Error("Not found");
        err.statusCode = 404;
        throw err;
      }
      return entity;
    },
    async upsertEntity(entity) {
      store.set(`${entity.partitionKey}:${entity.rowKey}`, entity);
    },
  };
}

describe("shared/featureFlags", () => {
  beforeEach(() => {
    clearFlagCache();
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

  it("getFlags returns defaults when no entity exists (404)", async () => {
    const client = createMockTableClient();
    const flags = await getFlags(client);
    expect(flags).toEqual(getDefaultFlags());
  });

  it("getFlags reads stored values from table", async () => {
    const entity = {
      partitionKey: "config",
      rowKey: "featureFlags",
      SUBMISSIONS_ENABLED: false,
      REGISTRATION_OPEN: "false",
    };
    const client = createMockTableClient(entity);
    const flags = await getFlags(client);
    expect(flags.SUBMISSIONS_ENABLED).toBe(false);
    expect(flags.REGISTRATION_OPEN).toBe(false);
    expect(flags.AWARDS_VISIBLE).toBe(true);
  });

  it("getFlags caches results (second call does not hit table)", async () => {
    const entity = {
      partitionKey: "config",
      rowKey: "featureFlags",
      SUBMISSIONS_ENABLED: false,
    };
    const client = createMockTableClient(entity);

    const first = await getFlags(client);
    expect(first.SUBMISSIONS_ENABLED).toBe(false);

    entity.SUBMISSIONS_ENABLED = true;
    const second = await getFlags(client);
    expect(second.SUBMISSIONS_ENABLED).toBe(false);
  });

  it("clearFlagCache forces fresh read", async () => {
    const client = createMockTableClient({
      partitionKey: "config",
      rowKey: "featureFlags",
      SUBMISSIONS_ENABLED: false,
    });

    await getFlags(client);
    clearFlagCache();

    client.getEntity = async () => ({
      partitionKey: "config",
      rowKey: "featureFlags",
      SUBMISSIONS_ENABLED: true,
    });
    const flags = await getFlags(client);
    expect(flags.SUBMISSIONS_ENABLED).toBe(true);
  });

  it("setFlags merges with current and upserts", async () => {
    const client = createMockTableClient();
    const result = await setFlags(client, { SUBMISSIONS_ENABLED: false });
    expect(result.SUBMISSIONS_ENABLED).toBe(false);
    expect(result.REGISTRATION_OPEN).toBe(true);
  });

  it("setFlags ignores unknown flag names", async () => {
    const client = createMockTableClient();
    const result = await setFlags(client, { UNKNOWN_FLAG: true });
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

  it("extracts user from client principal header", () => {
    const principal = { userDetails: "testuser", userRoles: ["authenticated"] };
    const encoded = Buffer.from(JSON.stringify(principal)).toString("base64");
    const headers = new Map([["x-ms-client-principal", encoded]]);
    const req = { headers };

    const log = createRequestLogger(req);
    expect(log.user).toBe("testuser");
  });

  it("falls back to anonymous on invalid header", () => {
    const headers = new Map([["x-ms-client-principal", "not-valid-base64!!!"]]);
    const req = { headers };

    const log = createRequestLogger(req);
    expect(log.user).toBe("anonymous");
  });
});
