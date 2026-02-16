import { describe, it, expect } from "vitest";
import { getClientPrincipal, requireRole } from "../shared/auth.js";
import { errorResponse } from "../shared/errors.js";
import { getTableClient } from "../shared/tables.js";

describe("shared/auth", () => {
  it("returns undefined when no header present", () => {
    const req = { headers: new Map() };
    expect(getClientPrincipal(req)).toBeUndefined();
  });

  it("decodes a valid client principal", () => {
    const principal = {
      userId: "abc123",
      userDetails: "testuser",
      userRoles: ["authenticated", "admin"],
      identityProvider: "github",
    };
    const encoded = Buffer.from(JSON.stringify(principal)).toString("base64");
    const headers = new Map([["x-ms-client-principal", encoded]]);
    const req = { headers };

    const result = getClientPrincipal(req);
    expect(result).toEqual(principal);
  });

  it("requireRole returns undefined when role is present", () => {
    const principal = { userRoles: ["authenticated", "admin"] };
    const encoded = Buffer.from(JSON.stringify(principal)).toString("base64");
    const headers = new Map([["x-ms-client-principal", encoded]]);
    const req = { headers };

    expect(requireRole(req, "admin")).toBeUndefined();
  });

  it("requireRole returns 403 when role is missing", () => {
    const principal = { userRoles: ["authenticated"] };
    const encoded = Buffer.from(JSON.stringify(principal)).toString("base64");
    const headers = new Map([["x-ms-client-principal", encoded]]);
    const req = { headers };

    const result = requireRole(req, "admin");
    expect(result).toEqual({
      status: 403,
      jsonBody: {
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      },
    });
  });

  it("requireRole returns 403 when no principal", () => {
    const req = { headers: new Map() };
    const result = requireRole(req, "admin");
    expect(result.status).toBe(403);
  });
});

describe("shared/errors", () => {
  it("returns a structured error response with default status", () => {
    const result = errorResponse("INVALID_INPUT", "Bad data");
    expect(result).toEqual({
      status: 400,
      jsonBody: { error: { code: "INVALID_INPUT", message: "Bad data" } },
    });
  });

  it("accepts a custom status code", () => {
    const result = errorResponse("NOT_FOUND", "Not here", 404);
    expect(result.status).toBe(404);
  });
});

describe("shared/tables", () => {
  it("getTableClient is a function", () => {
    expect(typeof getTableClient).toBe("function");
  });
});
