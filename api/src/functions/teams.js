import { app } from "@azure/functions";
import { query } from "../../shared/db.js";
import { errorResponse } from "../../shared/errors.js";
import { createRequestLogger } from "../../shared/logger.js";

async function getTeams() {
  const result = await query(
    "SELECT teamName, teamNumber, teamMembers, createdAt FROM dbo.Teams ORDER BY teamNumber",
  );
  const teams = result.recordset.map((row) => ({
    teamName: row.teamName,
    teamNumber: row.teamNumber,
    teamMembers: JSON.parse(row.teamMembers || "[]"),
    createdAt: row.createdAt,
  }));
  return { jsonBody: teams };
}

async function createTeam(request) {
  const body = await request.json();
  const { teamName, teamMembers = [] } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  // Derive teamNumber from current max
  const maxResult = await query(
    "SELECT ISNULL(MAX(teamNumber), 0) + 1 AS nextNum FROM dbo.Teams",
  );
  const teamNumber = maxResult.recordset[0].nextNum;
  const now = new Date().toISOString();

  try {
    await query(
      `INSERT INTO dbo.Teams (teamName, teamNumber, teamMembers, createdAt)
       VALUES (@teamName, @teamNumber, @teamMembers, @createdAt)`,
      {
        teamName,
        teamNumber,
        teamMembers: JSON.stringify(teamMembers),
        createdAt: now,
      },
    );
  } catch (err) {
    // SQL unique constraint violation code 2627 / 2601
    if (err.number === 2627 || err.number === 2601) {
      return errorResponse(
        "TEAM_EXISTS",
        `Team '${teamName}' already exists`,
        409,
      );
    }
    throw err;
  }

  return {
    status: 201,
    jsonBody: { teamName, teamNumber, teamMembers, createdAt: now },
  };
}

async function updateTeam(request) {
  const body = await request.json();
  const { teamName, teamMembers } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const exists = await query(
    "SELECT 1 AS found FROM dbo.Teams WHERE teamName = @teamName",
    { teamName },
  );

  if (exists.recordset.length === 0) {
    return errorResponse(
      "TEAM_NOT_FOUND",
      `Team '${teamName}' does not exist`,
      404,
    );
  }

  const updatedAt = new Date().toISOString();
  await query(
    `UPDATE dbo.Teams
        SET teamMembers = @teamMembers, updatedAt = @updatedAt
      WHERE teamName = @teamName`,
    { teamMembers: JSON.stringify(teamMembers || []), updatedAt, teamName },
  );

  return {
    jsonBody: { teamName, teamMembers: teamMembers || [], updatedAt },
  };
}

async function deleteTeam(request) {
  const body = await request.json();
  const { teamName } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
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

  // Delete child scores first, then the team (no CASCADE DELETE configured)
  await query("DELETE FROM dbo.Scores WHERE teamId = @teamId", { teamId });
  await query("DELETE FROM dbo.Teams WHERE id = @teamId", { teamId });

  return { status: 204 };
}

app.http("teams", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  route: "teams",
  handler: async (request, context) => {
    const log = createRequestLogger(request);
    log.info(`teams.${request.method}`);
    try {
      let result;
      switch (request.method) {
        case "GET":
          result = await getTeams(request, context);
          break;
        case "POST":
          result = await createTeam(request, context);
          break;
        case "PUT":
          result = await updateTeam(request, context);
          break;
        case "DELETE":
          result = await deleteTeam(request, context);
          break;
        default:
          result = {
            status: 405,
            jsonBody: {
              error: {
                code: "METHOD_NOT_ALLOWED",
                message: "Method not allowed",
              },
            },
          };
      }
      log.done(`teams.${request.method}`, { status: result.status || 200 });
      return result;
    } catch (err) {
      log.error(`teams.${request.method}`, { error: err.message });
      throw err;
    }
  },
});

const TABLE_NAME = "Teams";

async function getTeams() {
  const client = getTableClient(TABLE_NAME);
  const teams = [];

  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'team'" },
  })) {
    teams.push({
      teamName: entity.rowKey,
      teamMembers: JSON.parse(entity.teamMembers || "[]"),
      createdAt: entity.createdAt,
    });
  }

  return { jsonBody: teams };
}

async function createTeam(request) {
  const body = await request.json();
  const { teamName, teamMembers = [] } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const client = getTableClient(TABLE_NAME);

  try {
    await client.createEntity({
      partitionKey: "team",
      rowKey: teamName,
      teamMembers: JSON.stringify(teamMembers),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return errorResponse(
        "TEAM_EXISTS",
        `Team '${teamName}' already exists`,
        409,
      );
    }
    throw err;
  }

  return {
    status: 201,
    jsonBody: {
      teamName,
      teamMembers,
      createdAt: new Date().toISOString(),
    },
  };
}

async function updateTeam(request) {
  const body = await request.json();
  const { teamName, teamMembers } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const client = getTableClient(TABLE_NAME);

  try {
    await client.getEntity("team", teamName);
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

  const updated = {
    partitionKey: "team",
    rowKey: teamName,
    teamMembers: JSON.stringify(teamMembers || []),
    updatedAt: new Date().toISOString(),
  };

  await client.updateEntity(updated, "Merge");

  return {
    jsonBody: {
      teamName,
      teamMembers: teamMembers || [],
      updatedAt: updated.updatedAt,
    },
  };
}

async function deleteTeam(request) {
  const body = await request.json();
  const { teamName } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const client = getTableClient(TABLE_NAME);

  try {
    await client.deleteEntity("team", teamName);
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

  const scoresClient = getTableClient("Scores");
  for await (const entity of scoresClient.listEntities({
    queryOptions: { filter: `PartitionKey eq '${teamName}'` },
  })) {
    await scoresClient.deleteEntity(entity.partitionKey, entity.rowKey);
  }

  return { status: 204 };
}

app.http("teams", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  route: "teams",
  handler: async (request, context) => {
    const log = createRequestLogger(request);
    log.info(`teams.${request.method}`);
    try {
      let result;
      switch (request.method) {
        case "GET":
          result = await getTeams(request, context);
          break;
        case "POST":
          result = await createTeam(request, context);
          break;
        case "PUT":
          result = await updateTeam(request, context);
          break;
        case "DELETE":
          result = await deleteTeam(request, context);
          break;
        default:
          result = {
            status: 405,
            jsonBody: {
              error: {
                code: "METHOD_NOT_ALLOWED",
                message: "Method not allowed",
              },
            },
          };
      }
      log.done(`teams.${request.method}`, { status: result.status || 200 });
      return result;
    } catch (err) {
      log.error(`teams.${request.method}`, { error: err.message });
      throw err;
    }
  },
});
