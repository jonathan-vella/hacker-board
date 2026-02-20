import { vi } from "vitest";

/**
 * Creates a mock for the cosmos.js module.
 * Usage in test files:
 *   vi.mock("../shared/cosmos.js", () => createMockCosmos());
 */
export function createMockCosmos() {
  return {
    getContainer: vi.fn().mockReturnValue({
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
        }),
        create: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({}),
      },
      item: vi.fn().mockReturnValue({
        read: vi.fn().mockResolvedValue({ resource: undefined }),
        replace: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      }),
    }),
    getDatabase: vi.fn().mockReturnValue({
      containers: {
        readAll: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
        }),
      },
    }),
    nextHackerNumber: vi.fn().mockResolvedValue(1),
  };
}

export function createMockRequest({
  method = "GET",
  body,
  query = {},
  headers = new Map(),
} = {}) {
  const queryMap = new Map(Object.entries(query));
  return {
    method,
    headers:
      headers instanceof Map ? headers : new Map(Object.entries(headers)),
    query: queryMap,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === "string" ? body : ""),
  };
}

export function createAuthHeaders(
  roles = ["authenticated"],
  username = "testuser",
) {
  const principal = {
    userId: "test-id",
    userDetails: username,
    userRoles: roles,
    identityProvider: "github",
  };
  const encoded = Buffer.from(JSON.stringify(principal)).toString("base64");
  return new Map([["x-ms-client-principal", encoded]]);
}

/** @deprecated Use createMockCosmos instead */
export function createMockDb() {
  return createMockCosmos();
}

/** @deprecated Cosmos returns resources array, not recordset */
export function mockRecordset(rows) {
  return { recordset: rows };
}
