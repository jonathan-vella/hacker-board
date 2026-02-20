/**
 * Adapter layer that translates Express req/res to the Azure Functions v4
 * request/response contract. This allows all existing function handlers to
 * run unchanged under Express.
 *
 * Azure Functions v4 request contract:
 *   - request.method (string)
 *   - request.query.get(name) → returns string | null
 *   - request.headers.get(name) → returns string | null
 *   - request.json() → Promise<object>
 *   - request.text() → Promise<string>
 *
 * Functions handler return contract:
 *   - { status?: number, jsonBody?: any, body?: string }
 */

/**
 * Wraps an Azure Functions v4 handler so it can serve as Express middleware.
 * @param {Function} handler - Azure Functions handler (request, context?) => { status, jsonBody }
 * @returns {Function} Express route handler (req, res)
 */
export function adapt(handler) {
  return async (req, res) => {
    const functionsRequest = toFunctionsRequest(req);
    const context = { log: console.log, invocationId: req.id || "express" };

    try {
      const result = await handler(functionsRequest, context);
      const status = result?.status || 200;

      if (result?.jsonBody !== undefined) {
        res.status(status).json(result.jsonBody);
      } else if (result?.body !== undefined) {
        res.status(status).send(result.body);
      } else {
        res.status(status).end();
      }
    } catch (err) {
      console.error("Unhandled handler error:", err);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  };
}

/**
 * Translates an Express request into an object matching the Azure Functions
 * v4 HttpRequest interface (the subset used by HackerBoard handlers).
 */
function toFunctionsRequest(req) {
  let bodyConsumed = false;
  const rawBody = req.body !== undefined ? JSON.stringify(req.body) : undefined;

  return {
    method: req.method,

    url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

    query: new Map(Object.entries(req.query || {})),

    headers: new Map(
      Object.entries(req.headers || {}).map(([k, v]) => [
        k.toLowerCase(),
        String(v),
      ]),
    ),

    params: req.params || {},

    async json() {
      if (bodyConsumed) throw new Error("Body already consumed");
      bodyConsumed = true;
      return req.body;
    },

    async text() {
      if (bodyConsumed) throw new Error("Body already consumed");
      bodyConsumed = true;
      return rawBody || "";
    },
  };
}
