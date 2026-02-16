import { app } from "@azure/functions";
import { getTableClient } from "../shared/tables.js";
import { getClientPrincipal } from "../shared/auth.js";
import { errorResponse } from "../shared/errors.js";

const TABLE_NAME = "Attendees";

async function getAttendees(request, context) {
  const client = getTableClient(TABLE_NAME);
  const attendees = [];

  for await (const entity of client.listEntities()) {
    attendees.push({
      gitHubUsername: entity.gitHubUsername || entity.partitionKey,
      firstName: entity.firstName,
      surname: entity.surname,
      teamNumber: entity.teamNumber,
      teamId: entity.teamId,
      registeredAt: entity.registeredAt,
      updatedAt: entity.updatedAt,
    });
  }

  return { jsonBody: attendees };
}

async function getMyProfile(request, context) {
  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const client = getTableClient(TABLE_NAME);
  try {
    const entity = await client.getEntity(principal.userDetails, "profile");
    return {
      jsonBody: {
        gitHubUsername: entity.partitionKey,
        firstName: entity.firstName,
        surname: entity.surname,
        teamNumber: entity.teamNumber,
        teamId: entity.teamId,
        registeredAt: entity.registeredAt,
        updatedAt: entity.updatedAt,
      },
    };
  } catch (err) {
    if (err.statusCode === 404) {
      return errorResponse("NOT_FOUND", "User has not registered yet", 404);
    }
    throw err;
  }
}

async function upsertMyProfile(request, context) {
  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const body = await request.json();
  const { firstName, surname, teamNumber } = body;

  if (!firstName || !surname) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Missing required fields: firstName, surname",
    );
  }

  if (
    teamNumber !== undefined &&
    (!Number.isInteger(teamNumber) || teamNumber < 1)
  ) {
    return errorResponse(
      "VALIDATION_ERROR",
      "teamNumber must be a positive integer",
    );
  }

  const client = getTableClient(TABLE_NAME);
  const now = new Date().toISOString();

  let isNew = false;
  try {
    await client.getEntity(principal.userDetails, "profile");
  } catch (err) {
    if (err.statusCode === 404) {
      isNew = true;
    } else {
      throw err;
    }
  }

  const entity = {
    partitionKey: principal.userDetails,
    rowKey: "profile",
    firstName,
    surname,
    gitHubUsername: principal.userDetails,
    teamNumber: teamNumber || 0,
    registeredAt: isNew ? now : undefined,
    updatedAt: now,
  };

  await client.upsertEntity(entity);

  return {
    status: isNew ? 201 : 200,
    jsonBody: {
      gitHubUsername: principal.userDetails,
      firstName,
      surname,
      teamNumber: teamNumber || 0,
      registeredAt: entity.registeredAt,
      updatedAt: now,
    },
  };
}

app.http("attendees", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "attendees",
  handler: getAttendees,
});

app.http("attendees-me", {
  methods: ["GET", "POST", "PUT"],
  authLevel: "anonymous",
  route: "attendees/me",
  handler: async (request, context) => {
    if (request.method === "GET") {
      return getMyProfile(request, context);
    }
    return upsertMyProfile(request, context);
  },
});
