import { getContainer } from "../../shared/cosmos.js";
import { errorResponse } from "../../shared/errors.js";
import { createRequestLogger } from "../../shared/logger.js";

const DEFAULT_TEAM_COUNT = 6;

async function seedDefaultTeams() {
  const container = getContainer("teams");
  for (let i = 1; i <= DEFAULT_TEAM_COUNT; i++) {
    const n = String(i).padStart(2, "0");
    const teamName = `Team${n}`;
    try {
      await container.items.create({
        id: teamName,
        teamName,
        teamNumber: i,
        teamMembers: [],
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err.code !== 409) throw err;
    }
  }
}

export async function getTeams() {
  const container = getContainer("teams");
  const { resources } = await container.items
    .query(
      "SELECT c.id, c.teamName, c.teamNumber, c.teamMembers, c.createdAt FROM c ORDER BY c.teamNumber",
    )
    .fetchAll();

  if (resources.length === 0) {
    await seedDefaultTeams();
    return getTeams();
  }

  return {
    jsonBody: resources.map((doc) => ({
      teamName: doc.teamName,
      teamNumber: doc.teamNumber,
      teamMembers: doc.teamMembers || [],
      createdAt: doc.createdAt,
    })),
  };
}

export async function createTeam(request) {
  const body = await request.json();
  const { teamName, teamMembers = [] } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const container = getContainer("teams");

  // Check for duplicate team name
  const { resources: existing } = await container.items
    .query({
      query: "SELECT c.id FROM c WHERE c.teamName = @teamName",
      parameters: [{ name: "@teamName", value: teamName }],
    })
    .fetchAll();

  if (existing.length > 0) {
    return errorResponse(
      "TEAM_EXISTS",
      `Team '${teamName}' already exists`,
      409,
    );
  }

  // Derive teamNumber from current max
  const { resources: maxResult } = await container.items
    .query("SELECT VALUE MAX(c.teamNumber) FROM c")
    .fetchAll();
  const teamNumber = (maxResult[0] || 0) + 1;
  const now = new Date().toISOString();

  const doc = {
    id: teamName,
    teamName,
    teamNumber,
    teamMembers,
    createdAt: now,
  };

  await container.items.create(doc);

  return {
    status: 201,
    jsonBody: { teamName, teamNumber, teamMembers, createdAt: now },
  };
}

export async function updateTeam(request) {
  const body = await request.json();
  const { teamName, teamMembers } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const container = getContainer("teams");

  try {
    const { resource: existing } = await container
      .item(teamName, teamName)
      .read();
    if (!existing) throw { code: 404 };

    const updatedAt = new Date().toISOString();
    existing.teamMembers = teamMembers || [];
    existing.updatedAt = updatedAt;

    await container.item(teamName, teamName).replace(existing);

    return {
      jsonBody: { teamName, teamMembers: teamMembers || [], updatedAt },
    };
  } catch (err) {
    if (err.code === 404) {
      return errorResponse(
        "TEAM_NOT_FOUND",
        `Team '${teamName}' does not exist`,
        404,
      );
    }
    throw err;
  }
}

export async function deleteTeam(request) {
  const body = await request.json();
  const { teamName } = body;

  if (!teamName || typeof teamName !== "string") {
    return errorResponse("VALIDATION_ERROR", "Missing or invalid teamName");
  }

  const container = getContainer("teams");

  try {
    await container.item(teamName, teamName).read();
  } catch (err) {
    if (err.code === 404) {
      return errorResponse(
        "TEAM_NOT_FOUND",
        `Team '${teamName}' does not exist`,
        404,
      );
    }
    throw err;
  }

  // Delete child scores for this team
  const scoresContainer = getContainer("scores");
  const { resources: teamScores } = await scoresContainer.items
    .query({
      query: "SELECT c.id FROM c WHERE c.teamId = @teamId",
      parameters: [{ name: "@teamId", value: teamName }],
    })
    .fetchAll();

  for (const score of teamScores) {
    await scoresContainer.item(score.id, teamName).delete();
  }

  await container.item(teamName, teamName).delete();

  return { status: 204 };
}

export async function handleTeams(request, context) {
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
}
