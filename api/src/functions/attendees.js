import { app } from "@azure/functions";
import { getTableClient, nextHackerNumber } from "../../shared/tables.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

const TABLE_NAME = "Attendees";
const TEAMS_TABLE = "Teams";

// Default teams auto-created for every new event
const DEFAULT_TEAM_COUNT = 6;

/**
 * Returns teams sorted by current member count (ascending).
 * Used to pick the smallest team for balanced auto-assignment.
 */
async function getTeamsSortedBySize() {
  const teamsClient = getTableClient(TEAMS_TABLE);
  const teams = [];
  for await (const entity of teamsClient.listEntities({
    queryOptions: { filter: "PartitionKey eq 'team'" },
  })) {
    const members = JSON.parse(entity.teamMembers || "[]");
    teams.push({
      rowKey: entity.rowKey,
      teamName: entity.teamName || entity.rowKey,
      teamNumber: entity.teamNumber || 0,
      memberCount: members.length,
    });
  }

  if (teams.length === 0) {
    await seedDefaultTeams(teamsClient);
    return getTeamsSortedBySize();
  }

  return teams.sort((a, b) => {
    if (a.memberCount !== b.memberCount) return a.memberCount - b.memberCount;
    // Stable tiebreaker: team number ascending
    return a.teamNumber - b.teamNumber;
  });
}

/** Seeds Team01–Team06 when no teams exist yet. */
async function seedDefaultTeams(teamsClient) {
  for (let i = 1; i <= DEFAULT_TEAM_COUNT; i++) {
    const n = String(i).padStart(2, "0");
    await teamsClient.createEntity({
      partitionKey: "team",
      rowKey: `team-${n}`,
      teamName: `Team${n}`,
      teamNumber: i,
      teamMembers: "[]",
      createdAt: new Date().toISOString(),
    });
  }
}

/** Adds a hacker alias to the teamMembers array for the given team. */
async function addMemberToTeam(teamsClient, teamRowKey, hackerAlias) {
  const entity = await teamsClient.getEntity("team", teamRowKey);
  const members = JSON.parse(entity.teamMembers || "[]");
  members.push(hackerAlias);
  await teamsClient.updateEntity(
    {
      partitionKey: "team",
      rowKey: teamRowKey,
      teamMembers: JSON.stringify(members),
    },
    "Merge",
  );
}

/** Returns the attendee row key (e.g. "Hacker07") for a GitHub username via lookup. */
async function resolveAlias(gitHubUsername) {
  const client = getTableClient(TABLE_NAME);
  try {
    const lookup = await client.getEntity("_github", gitHubUsername);
    return lookup.hackerAlias;
  } catch (err) {
    if (err.statusCode === 404) return undefined;
    throw err;
  }
}

async function getAttendees(request, context) {
  const client = getTableClient(TABLE_NAME);
  const attendees = [];

  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'attendees'" },
  })) {
    attendees.push({
      alias: entity.alias,
      teamNumber: entity.teamNumber,
      teamId: entity.teamId,
      teamName: entity.teamName,
      registeredAt: entity.registeredAt,
    });
  }

  return { jsonBody: attendees };
}

async function getMyProfile(request, context) {
  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const hackerAlias = await resolveAlias(principal.userDetails);
  if (!hackerAlias) {
    return errorResponse("NOT_FOUND", "User has not registered yet", 404);
  }

  const client = getTableClient(TABLE_NAME);
  const entity = await client.getEntity("attendees", hackerAlias);
  return {
    jsonBody: {
      alias: entity.alias,
      teamNumber: entity.teamNumber,
      teamId: entity.teamId,
      teamName: entity.teamName,
      registeredAt: entity.registeredAt,
    },
  };
}

async function joinEvent(request, context) {
  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const gitHubUsername = principal.userDetails;

  // Idempotent — return existing alias if already registered
  const existingAlias = await resolveAlias(gitHubUsername);
  if (existingAlias) {
    const client = getTableClient(TABLE_NAME);
    const entity = await client.getEntity("attendees", existingAlias);
    return {
      status: 200,
      jsonBody: {
        alias: entity.alias,
        teamNumber: entity.teamNumber,
        teamId: entity.teamId,
        teamName: entity.teamName,
        registeredAt: entity.registeredAt,
      },
    };
  }

  // Assign globally unique hacker number
  const hackerNumber = await nextHackerNumber();
  const hackerAlias = `Hacker${String(hackerNumber).padStart(2, "0")}`;

  // Pick the smallest team
  const teams = await getTeamsSortedBySize();
  const assignedTeam = teams[0];
  const fullAlias = `${assignedTeam.teamName}-${hackerAlias}`;

  const now = new Date().toISOString();
  const client = getTableClient(TABLE_NAME);
  const teamsClient = getTableClient(TEAMS_TABLE);

  // Write attendee row
  await client.createEntity({
    partitionKey: "attendees",
    rowKey: hackerAlias,
    alias: fullAlias,
    teamNumber: assignedTeam.teamNumber,
    teamId: assignedTeam.rowKey,
    teamName: assignedTeam.teamName,
    // GitHub username stored internally — never returned in API responses
    _gitHubUsername: gitHubUsername,
    registeredAt: now,
  });

  // Write reverse-lookup row so subsequent logins resolve instantly
  await client.createEntity({
    partitionKey: "_github",
    rowKey: gitHubUsername,
    hackerAlias,
  });

  // Add alias to the team's member list
  await addMemberToTeam(teamsClient, assignedTeam.rowKey, hackerAlias);

  return {
    status: 201,
    jsonBody: {
      alias: fullAlias,
      teamNumber: assignedTeam.teamNumber,
      teamId: assignedTeam.rowKey,
      teamName: assignedTeam.teamName,
      registeredAt: now,
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
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "attendees/me",
  handler: async (request, context) => {
    if (request.method === "GET") {
      return getMyProfile(request, context);
    }
    // POST = join event (idempotent)
    return joinEvent(request, context);
  },
});
