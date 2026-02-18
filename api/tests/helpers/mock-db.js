import { vi } from "vitest";

/**
 * Creates a mock for the db.js module.
 * Usage in test files:
 *   vi.mock("../shared/db.js", () => createMockDb());
 *   import { query } from "../shared/db.js";
 *   query.mockResolvedValue({ recordset: [...] });
 */
export function createMockDb() {
  return {
    query: vi.fn().mockResolvedValue({ recordset: [] }),
    getPool: vi.fn().mockResolvedValue({}),
    nextHackerNumber: vi.fn().mockResolvedValue(1),
  };
}

/** Wraps rows in mssql result format */
export function mockRecordset(rows) {
  return { recordset: rows };
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
