import { describe, it, expect, vi } from "vitest";
import { adapt } from "../shared/adapter.js";

describe("adapt()", () => {
  function mockRes() {
    const res = {
      statusCode: undefined,
      body: undefined,
      _json: undefined,
      status(code) {
        res.statusCode = code;
        return res;
      },
      json(data) {
        res._json = data;
        return res;
      },
      send(data) {
        res.body = data;
        return res;
      },
      end() {
        res.body = "";
        return res;
      },
    };
    return res;
  }

  function mockReq(overrides = {}) {
    return {
      method: "GET",
      protocol: "https",
      get: (h) => (h === "host" ? "localhost" : undefined),
      originalUrl: "/api/test?foo=bar",
      query: { foo: "bar" },
      headers: { "content-type": "application/json", "x-custom": "val" },
      params: {},
      body: undefined,
      id: "test-123",
      ...overrides,
    };
  }

  it("returns jsonBody from handler as JSON response", async () => {
    const handler = async () => ({ status: 200, jsonBody: { ok: true } });
    const middleware = adapt(handler);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json).toEqual({ ok: true });
  });

  it("defaults to status 200 when handler omits status", async () => {
    const handler = async () => ({ jsonBody: { data: "test" } });
    const middleware = adapt(handler);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json).toEqual({ data: "test" });
  });

  it("returns body as plain text when handler uses body instead of jsonBody", async () => {
    const handler = async () => ({ status: 201, body: "created" });
    const middleware = adapt(handler);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toBe("created");
  });

  it("calls res.end() when handler returns no body", async () => {
    const handler = async () => ({ status: 204 });
    const middleware = adapt(handler);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
  });

  it("catches handler errors and returns 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = async () => {
      throw new Error("boom");
    };
    const middleware = adapt(handler);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._json.error.code).toBe("INTERNAL_ERROR");
    consoleError.mockRestore();
  });

  it("translates Express query params to Map with .get()", async () => {
    let capturedRequest;
    const handler = async (request) => {
      capturedRequest = request;
      return { status: 200, jsonBody: {} };
    };
    const middleware = adapt(handler);
    const req = mockReq({ query: { page: "2", limit: "10" } });
    const res = mockRes();

    await middleware(req, res);

    expect(capturedRequest.query.get("page")).toBe("2");
    expect(capturedRequest.query.get("limit")).toBe("10");
    expect(capturedRequest.query.get("missing")).toBeUndefined();
  });

  it("translates Express headers to lowercase Map with .get()", async () => {
    let capturedRequest;
    const handler = async (request) => {
      capturedRequest = request;
      return { status: 200, jsonBody: {} };
    };
    const middleware = adapt(handler);
    const req = mockReq({
      headers: { "Content-Type": "application/json", Authorization: "Bearer abc" },
    });
    const res = mockRes();

    await middleware(req, res);

    expect(capturedRequest.headers.get("content-type")).toBe("application/json");
    expect(capturedRequest.headers.get("authorization")).toBe("Bearer abc");
  });

  it("provides async json() that returns parsed body", async () => {
    let capturedRequest;
    const handler = async (request) => {
      capturedRequest = request;
      const body = await request.json();
      return { status: 200, jsonBody: body };
    };
    const middleware = adapt(handler);
    const req = mockReq({ body: { name: "test-team" } });
    const res = mockRes();

    await middleware(req, res);

    expect(res._json).toEqual({ name: "test-team" });
  });

  it("provides async text() that returns stringified body", async () => {
    let capturedRequest;
    const handler = async (request) => {
      const text = await request.text();
      return { status: 200, body: text };
    };
    const middleware = adapt(handler);
    const req = mockReq({ body: { key: "value" } });
    const res = mockRes();

    await middleware(req, res);

    expect(res.body).toBe('{"key":"value"}');
  });

  it("throws when body is consumed twice", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = async (request) => {
      await request.json();
      await request.json();
      return { status: 200, jsonBody: {} };
    };
    const middleware = adapt(handler);
    const req = mockReq({ body: { data: 1 } });
    const res = mockRes();

    await middleware(req, res);

    // Handler threw, so adapter catches and returns 500
    expect(res.statusCode).toBe(500);
    consoleError.mockRestore();
  });

  it("sets method and url on the functions request", async () => {
    let capturedRequest;
    const handler = async (request) => {
      capturedRequest = request;
      return { status: 200, jsonBody: {} };
    };
    const middleware = adapt(handler);
    const req = mockReq({ method: "POST", originalUrl: "/api/teams" });
    const res = mockRes();

    await middleware(req, res);

    expect(capturedRequest.method).toBe("POST");
    expect(capturedRequest.url).toBe("https://localhost/api/teams");
  });
});
