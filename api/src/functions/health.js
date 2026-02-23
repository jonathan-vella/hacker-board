import { getDatabase } from "../../shared/cosmos.js";

const REQUIRED_CONTAINERS = [
  "teams",
  "attendees",
  "scores",
  "submissions",
  "rubrics",
  "config",
];

export async function handleHealth(request) {
  const started = Date.now();
  let healthy = true;
  let containersFound = [];
  let dbError;

  try {
    const db = getDatabase();
    const { resources } = await db.containers.readAll().fetchAll();
    containersFound = resources.map((c) => c.id);
  } catch (err) {
    healthy = false;
    dbError = err.message;
  }

  const containers = {};
  for (const name of REQUIRED_CONTAINERS) {
    if (dbError) {
      containers[name] = `error: ${dbError}`;
    } else if (containersFound.includes(name)) {
      containers[name] = "ok";
    } else {
      containers[name] = "missing";
      healthy = false;
    }
  }

  return {
    status: healthy ? 200 : 503,
    jsonBody: {
      status: healthy ? "healthy" : "degraded",
      containers,
      uptime: process.uptime(),
      duration: Date.now() - started,
      cosmosEndpoint: process.env.COSMOS_ENDPOINT ?? "(unset)",
      nodeVersion: process.version,
      buildSha: process.env.BUILD_SHA ?? "dev",
    },
  };
}
