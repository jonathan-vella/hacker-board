import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";
import { requireRole } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { createRequestLogger } from "../../shared/logger.js";
import {
  getFlags,
  setFlags,
  getFlagDescriptions,
  clearFlagCache,
} from "../../shared/featureFlags.js";

async function handleFlags(request) {
  const log = createRequestLogger(request);
  log.info(`flags.${request.method}`);
  const configClient = getTableClient("Config");

  if (request.method === "GET") {
    const flags = await getFlags(configClient);
    const descriptions = getFlagDescriptions();
    return {
      status: 200,
      jsonBody: { flags, descriptions },
    };
  }

  if (request.method === "PUT") {
    const denied = requireRole(request, "admin");
    if (denied) return denied;

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Request body must be a JSON object of flag names and boolean values",
      );
    }

    clearFlagCache();
    const updated = await setFlags(configClient, body);
    return {
      status: 200,
      jsonBody: { flags: updated },
    };
  }

  return errorResponse("METHOD_NOT_ALLOWED", "Use GET or PUT", 405);
}

app.http("flags", {
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  route: "flags",
  handler: handleFlags,
});
