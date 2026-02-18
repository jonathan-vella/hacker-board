import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { createRequestLogger } from "../../shared/logger.js";

const TABLE_NAME = "Teams";
const DEFAULT_TEAM_COUNT = 6;

/** Seeds Team01–Team06 when no teams exist. */
async function seedDefaultTeams(client) {
  for (let i = 1; i <= DEFAULT_TEAM_COUNT; i++) {
    const n = String(i).padStart(2, "0");
    await client.createEntity({
      partitionKey: "team",
      rowKey: `team-${n}`,
      teamName: `Team${n}`,
      teamNumber: i,
      teamMembers: "[]",
      createdAt: new Date().toISOString(),
    });
  }
}

async function getTeams(request, context) {
  const client = getTableClient(TABLE_NAME);
  const teams = [];

  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'team'" },
  })) {
    teams.push({
      teamName: entity.teamName || entity.rowKey,
      teamNumber: entity.teamNumber || 0,
      teamMembers: JSON.parse(entity.teamMembers || "[]"),
      createdAt: entity.createdAt,
    });
  }

  // Auto-seed default teams when the event has no teams yet
  if (teams.length === 0) {
    await seedDefaultTeams(client);
    for await (const entity of client.listEntities({
      queryOptions: { filter: "PartitionKey eq 'team'" },
    })) {
      teams.push({
        teamName: entity.teamName || entity.rowKey,
        teamNumber: entity.teamNumber || 0,
        teamMembers: JSON.parse(entity.teamMembers || "[]"),
        createdAt: entity.createdAt,
      });
    }
  }

  return { jsonBody: teams };
}

/** Adds a new team auto-named Team{N+1} where N is the current max team number. */
async function createTeam(request, context) {
  const client = getTableClient(TABLE_NAME);

  // Determine the next team number
  let maxNumber = 0;
  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'team'" },
  })) {
    const n = entity.teamNumber || 0;
    if (n > maxNumber) maxNumber = n;
  }

  const next = maxNumber + 1;
  const n = String(next).padStart(2, "0");
  const teamName = `Team${n}`;
  const rowKey = `team-${n}`;

  try {
    await client.createEntity({
      partitionKey: "team",
      rowKey,
      teamName,
      teamNumber: next,
      teamMembers: "[]",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return errorResponse("TEAM_EXISTS", `Team '${teamName}' already exists`, 409);
    }
    throw err;
  }

  return {
    status: 201,
    jsonBody: {
      teamName,
      teamNumber: next,
      teamMembers: [],
      createdAt: new Date().toISOString(),
    },
  };
}

async function deleteTeam(request, context) {
  const body = await request.json();
  const { teamName } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const client = getTableClient(TABLE_NAME);

  // Resolve by teamName field to find rowKey
  let rowKey;
  let memberCount = 0;
  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'team'" },
  })) {
    if ((entity.teamName || entity.rowKey) === teamName) {
      rowKey = entity.rowKey;
      memberCount = JSON.parse(entity.teamMembers || "[]").length;
      break;
    }
  }

  if (!rowKey) {
    return errorResponse("TEAM_NOT_FOUND", `Team '${teamName}' does not exist`, 404);
  }

  if (memberCount > 0) {
    return errorResponse(
      "TEAM_NOT_EMPTY",
      `Cannot delete '${teamName}' — it has ${memberCount} member(s). Reassign members first.`,
      409,
    );
  }

  await client.deleteEntity("team", rowKey);

  // Also delete associated scores
  const scoresClient = getTableClient("Scores");
  for await (const entity of scoresClient.listEntities({
    queryOptions: { filter: `PartitionKey eq '${teamName}'` },
  })) {
    await scoresClient.deleteEntity(entity.partitionKey, entity.rowKey);
  }

  return { status: 204 };
}

app.http("teams", {
  methods: ["GET", "POST", "DELETE"],
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
        case "DELETE":
          result = await deleteTeam(request, context);
          break;
        default:
          result = {
            status: 405,
            jsonBody: {
              error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
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

async function getTeams(request, context) {
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

async function createTeam(request, context) {
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

async function updateTeam(request, context) {
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

async function deleteTeam(request, context) {
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

  // Also delete associated scores
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
