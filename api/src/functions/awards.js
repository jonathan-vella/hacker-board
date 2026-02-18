import { app } from "@azure/functions";
import { query } from "../../shared/db.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

const VALID_CATEGORIES = [
  "BestOverall",
  "SecurityChampion",
  "CostOptimizer",
  "BestArchitecture",
  "SpeedDemon",
];

async function getAwards() {
  const result = await query(
    `SELECT a.category, t.teamName, a.timestamp
       FROM dbo.Awards a
       JOIN dbo.Teams t ON t.id = a.teamId
      ORDER BY a.category`,
  );
  return {
    jsonBody: result.recordset.map((row) => ({
      category: row.category,
      teamName: row.teamName,
      timestamp: row.timestamp,
    })),
  };
}

async function postAward(request) {
  const body = await request.json();
  const { category, teamName } = body;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return errorResponse(
      "INVALID_AWARD",
      `Invalid award category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
    );
  }
  if (!teamName) {
    return errorResponse("VALIDATION_ERROR", "Missing teamName");
  }

  const teamRow = await query(
    "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
    { teamName },
  );
  if (teamRow.recordset.length === 0) {
    return errorResponse(
      "TEAM_NOT_FOUND",
      `Team '${teamName}' does not exist`,
      404,
    );
  }

  const teamId = teamRow.recordset[0].id;
  const principal = getClientPrincipal(request);
  const assignedBy = principal?.userDetails || "admin";
  const now = new Date().toISOString();

  await query(
    `MERGE dbo.Awards AS target
     USING (SELECT @category AS category) AS src ON target.category = src.category
     WHEN MATCHED THEN
       UPDATE SET teamId = @teamId, assignedBy = @assignedBy, timestamp = @timestamp
     WHEN NOT MATCHED THEN
       INSERT (category, teamId, assignedBy, timestamp)
       VALUES (@category, @teamId, @assignedBy, @timestamp);`,
    { category, teamId, assignedBy, timestamp: now },
  );

  return {
    jsonBody: { category, teamName, assignedBy, timestamp: now },
  };
}

app.http("awards", {
  methods: ["GET", "POST", "PUT"],
  authLevel: "anonymous",
  route: "awards",
  handler: async (request, context) => {
    switch (request.method) {
      case "GET":
        return getAwards(request, context);
      case "POST":
      case "PUT":
        return postAward(request, context);
      default:
        return {
          status: 405,
          jsonBody: {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Method not allowed",
            },
          },
        };
    }
  },
});

const TABLE_NAME = "Awards";
const VALID_CATEGORIES = [
  "BestOverall",
  "SecurityChampion",
  "CostOptimizer",
  "BestArchitecture",
  "SpeedDemon",
];

async function getAwards(request, context) {
  const client = getTableClient(TABLE_NAME);
  const awards = [];

  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'award'" },
  })) {
    awards.push({
      category: entity.rowKey,
      teamName: entity.teamName,
      // assignedBy kept in storage for audit; not returned to clients
      timestamp: entity.timestamp,
    });
  }

  return { jsonBody: awards };
}

async function postAward(request, context) {
  const body = await request.json();
  const { category, teamName } = body;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return errorResponse(
      "INVALID_AWARD",
      `Invalid award category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
    );
  }

  if (!teamName) {
    return errorResponse("VALIDATION_ERROR", "Missing teamName");
  }

  // Verify team exists
  const teamsClient = getTableClient("Teams");
  try {
    await teamsClient.getEntity("team", teamName);
  } catch (err) {
    if (err.statusCode === 404) {
      return errorResponse(
        "TEAM_NOT_FOUND",
        `Team '${teamName}' does not exist`,
        404,
      );
    }
    throw err;
  }

  const principal = getClientPrincipal(request);
  const assignedBy = principal?.userDetails || "admin";
  const client = getTableClient(TABLE_NAME);

  const entity = {
    partitionKey: "award",
    rowKey: category,
    teamName,
    assignedBy,
    timestamp: new Date().toISOString(),
  };

  await client.upsertEntity(entity);

  return {
    jsonBody: {
      category,
      teamName,
      assignedBy,
      timestamp: entity.timestamp,
    },
  };
}

async function updateAward(request, context) {
  return postAward(request, context);
}

app.http("awards", {
  methods: ["GET", "POST", "PUT"],
  authLevel: "anonymous",
  route: "awards",
  handler: async (request, context) => {
    switch (request.method) {
      case "GET":
        return getAwards(request, context);
      case "POST":
      case "PUT":
        return postAward(request, context);
      default:
        return {
          status: 405,
          jsonBody: {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Method not allowed",
            },
          },
        };
    }
  },
});
