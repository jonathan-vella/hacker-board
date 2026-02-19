import { app } from "@azure/functions";
import { query } from "../../shared/db.js";

const REQUIRED_TABLES = [
  "Teams",
  "Attendees",
  "Scores",
  "Awards",
  "Submissions",
  "Rubrics",
  "Config",
];

async function handleHealth(request) {
  const started = Date.now();
  let healthy = true;
  let tablesFound = [];
  let dbError;

  try {
    const result = await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = DB_NAME()`,
    );
    tablesFound = result.recordset.map((r) => r.TABLE_NAME);
  } catch (err) {
    healthy = false;
    dbError = err.message;
  }

  const tables = {};
  for (const name of REQUIRED_TABLES) {
    if (dbError) {
      tables[name] = `error: ${dbError}`;
    } else if (tablesFound.includes(name)) {
      tables[name] = "ok";
    } else {
      tables[name] = "missing";
      healthy = false;
    }
  }

  const diagnostics =
    request.query.get("diag") === "1"
      ? {
          identityEndpoint: !!process.env.IDENTITY_ENDPOINT,
          identityHeader: !!process.env.IDENTITY_HEADER,
          msiEndpoint: !!process.env.MSI_ENDPOINT,
          msiSecret: !!process.env.MSI_SECRET,
          azureClientId: !!process.env.AZURE_CLIENT_ID,
          sqlServerFqdn: process.env.SQL_SERVER_FQDN ?? "(unset)",
          sqlDatabaseName: process.env.SQL_DATABASE_NAME ?? "(unset)",
          connectionString: !!process.env.SQL_CONNECTION_STRING,
          nodeVersion: process.version,
        }
      : undefined;

  return {
    status: healthy ? 200 : 503,
    jsonBody: {
      status: healthy ? "healthy" : "degraded",
      tables,
      uptime: process.uptime(),
      duration: Date.now() - started,
      ...(diagnostics && { diagnostics }),
    },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: handleHealth,
});
