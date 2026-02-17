import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";

const REQUIRED_TABLES = [
  "Teams",
  "Attendees",
  "Scores",
  "Awards",
  "Submissions",
  "Rubrics",
  "Config",
];

async function handleHealth(_request) {
  const started = Date.now();
  const tables = {};
  let healthy = true;

  for (const name of REQUIRED_TABLES) {
    try {
      const client = getTableClient(name);
      const iter = client.listEntities({ queryOptions: { top: 1 } });
      await iter.next();
      tables[name] = "ok";
    } catch (err) {
      tables[name] = `error: ${err.message}`;
      healthy = false;
    }
  }

  return {
    status: healthy ? 200 : 503,
    jsonBody: {
      status: healthy ? "healthy" : "degraded",
      tables,
      uptime: process.uptime(),
      duration: Date.now() - started,
    },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: handleHealth,
});
