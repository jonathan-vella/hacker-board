import { randomUUID } from "node:crypto";

export function createRequestLogger(request) {
  const requestId = randomUUID();
  const startTime = Date.now();

  const user = extractUser(request);

  return {
    requestId,
    user,

    info(operation, data = {}) {
      log("INFO", requestId, user, operation, data, startTime);
    },

    warn(operation, data = {}) {
      log("WARN", requestId, user, operation, data, startTime);
    },

    error(operation, data = {}) {
      log("ERROR", requestId, user, operation, data, startTime);
    },

    done(operation, data = {}) {
      log(
        "INFO",
        requestId,
        user,
        operation,
        { ...data, completed: true },
        startTime,
      );
    },
  };
}

function extractUser(request) {
  try {
    const header = request.headers.get("x-ms-client-principal");
    if (!header) return "anonymous";
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    return decoded.userDetails || "anonymous";
  } catch {
    return "anonymous";
  }
}

function log(level, requestId, user, operation, data, startTime) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId,
    user,
    operation,
    durationMs: Date.now() - startTime,
    ...data,
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "ERROR":
      console.error(output);
      break;
    case "WARN":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}
