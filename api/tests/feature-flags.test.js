import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/cosmos.js", () => {
  const mockItem = vi.fn().mockReturnValue({
    read: vi.fn().mockResolvedValue({ resource: undefined }),
  });
  const mockUpsert = vi.fn().mockResolvedValue({ resource: {} });
  const mockQuery = vi.fn().mockReturnValue({
    fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
  });

  return {
    getContainer: vi.fn().mockReturnValue({
      item: mockItem,
      items: { upsert: mockUpsert, query: mockQuery },
    }),
    getDatabase: vi.fn(),
    nextHackerNumber: vi.fn().mockResolvedValue(1),
  };
});

import { getContainer } from "../shared/cosmos.js";
import {
  getDefaultFlags,
  getFlagDescriptions,
  getFlags,
  setFlags,
  requireFeature,
  clearFlagCache,
} from "../shared/featureFlags.js";
import { createRequestLogger } from "../shared/logger.js";

describe("shared/featureFlags", () => {
  let mockContainer;

  beforeEach(() => {
    clearFlagCache();
    vi.clearAllMocks();

    mockContainer = {
      item: vi.fn().mockReturnValue({
        read: vi.fn().mockResolvedValue({ resource: undefined }),
      }),
      items: {
        upsert: vi.fn().mockResolvedValue({ resource: {} }),
      },
    };
    getContainer.mockReturnValue(mockContainer);
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

  it("getFlags returns defaults when config container has no docs", async () => {
    const flags = await getFlags();
    expect(flags).toEqual(getDefaultFlags());
  });

  it("getFlags reads stored values from config container", async () => {
    mockContainer.item.mockImplementation((key) => ({
      read: vi.fn().mockResolvedValue({
        resource:
          key === "SUBMISSIONS_ENABLED"
            ? { id: key, configValue: "false" }
            : key === "REGISTRATION_OPEN"
              ? { id: key, configValue: "false" }
              : undefined,
      }),
    }));

    const flags = await getFlags();
    expect(flags.SUBMISSIONS_ENABLED).toBe(false);
    expect(flags.REGISTRATION_OPEN).toBe(false);
    expect(flags.AWARDS_VISIBLE).toBe(true);
  });

  it("getFlags caches results (second call does not read again)", async () => {
    const readFn = vi.fn().mockResolvedValue({ resource: undefined });
    mockContainer.item.mockReturnValue({ read: readFn });

    await getFlags();
    const callCount = readFn.mock.calls.length;

    await getFlags();
    expect(readFn.mock.calls.length).toBe(callCount);
  });

  it("clearFlagCache forces fresh read", async () => {
    mockContainer.item.mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: { id: "SUBMISSIONS_ENABLED", configValue: "false" },
      }),
    });
    const first = await getFlags();
    expect(first.SUBMISSIONS_ENABLED).toBe(false);

    clearFlagCache();

    mockContainer.item.mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: { id: "SUBMISSIONS_ENABLED", configValue: "true" },
      }),
    });

    const second = await getFlags();
    expect(second.SUBMISSIONS_ENABLED).toBe(true);
  });

  it("setFlags merges with current and upserts each flag", async () => {
    const result = await setFlags({ SUBMISSIONS_ENABLED: false });
    expect(result.SUBMISSIONS_ENABLED).toBe(false);
    expect(result.REGISTRATION_OPEN).toBe(true);
  });

  it("setFlags ignores unknown flag names", async () => {
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
