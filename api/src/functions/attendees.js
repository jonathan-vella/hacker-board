import { getContainer, nextHackerNumber } from "../../shared/cosmos.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { randomUUID } from "node:crypto";

const DEFAULT_TEAM_COUNT = 6;

async function getTeamsSortedBySize() {
  const teamsContainer = getContainer("teams");
  const { resources: teams } = await teamsContainer.items
    .query(
      "SELECT c.id, c.teamName, c.teamNumber, c.teamMembers FROM c ORDER BY c.teamNumber",
    )
    .fetchAll();

  if (teams.length === 0) {
    await seedDefaultTeams();
    return getTeamsSortedBySize();
  }

  const attendeesContainer = getContainer("attendees");
  const enriched = [];
  for (const team of teams) {
    const { resources } = await attendeesContainer.items
      .query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.teamId = @teamId",
        parameters: [{ name: "@teamId", value: team.id }],
      })
      .fetchAll();
    enriched.push({ ...team, memberCount: resources[0] || 0 });
  }

  enriched.sort(
    (a, b) => a.memberCount - b.memberCount || a.teamNumber - b.teamNumber,
  );
  return enriched;
}

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

async function addMemberToTeam(teamId, hackerAlias) {
  const container = getContainer("teams");
  const { resource } = await container.item(teamId, teamId).read();
  const members = resource.teamMembers || [];
  members.push(hackerAlias);
  resource.teamMembers = members;
  await container.item(teamId, teamId).replace(resource);
}

export async function getAttendees() {
  const container = getContainer("attendees");
  const { resources } = await container.items
    .query(
      "SELECT c.hackerAlias, c.hackerNumber, c.teamId, c.teamName, c.registeredAt FROM c ORDER BY c.hackerNumber",
    )
    .fetchAll();

  return {
    jsonBody: resources.map((doc) => ({
      alias: doc.hackerAlias,
      teamNumber: doc.hackerNumber,
      teamId: doc.teamId,
      teamName: doc.teamName,
      registeredAt: doc.registeredAt,
    })),
  };
}

export async function getMyProfile(request) {
  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const gitHubUsername = principal.userDetails;
  const container = getContainer("attendees");
  const { resources } = await container.items
    .query({
      query:
        "SELECT c.hackerAlias, c.hackerNumber, c.teamId, c.teamName, c.registeredAt FROM c WHERE c.gitHubUsername = @gitHubUsername",
      parameters: [{ name: "@gitHubUsername", value: gitHubUsername }],
    })
    .fetchAll();

  if (resources.length === 0) {
    return errorResponse("NOT_FOUND", "User has not registered yet", 404);
  }

  const doc = resources[0];
  return {
    jsonBody: {
      alias: doc.hackerAlias,
      teamNumber: doc.hackerNumber,
      teamId: doc.teamId,
      teamName: doc.teamName,
      registeredAt: doc.registeredAt,
    },
  };
}

export async function joinEvent(request) {
  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const gitHubUsername = principal.userDetails;
  const container = getContainer("attendees");

  // Idempotent — return existing registration
  const { resources: existing } = await container.items
    .query({
      query:
        "SELECT c.hackerAlias, c.hackerNumber, c.teamId, c.teamName, c.registeredAt FROM c WHERE c.gitHubUsername = @gitHubUsername",
      parameters: [{ name: "@gitHubUsername", value: gitHubUsername }],
    })
    .fetchAll();

  if (existing.length > 0) {
    const doc = existing[0];
    return {
      status: 200,
      jsonBody: {
        alias: doc.hackerAlias,
        teamNumber: doc.hackerNumber,
        teamId: doc.teamId,
        teamName: doc.teamName,
        registeredAt: doc.registeredAt,
      },
    };
  }

  const hackerNumber = await nextHackerNumber();

  const teams = await getTeamsSortedBySize();
  const assignedTeam = teams[0];

  // Per-team numbering: count existing members + 1
  const memberCount = assignedTeam.memberCount || 0;
  const perTeamNumber = memberCount + 1;
  const fullAlias = `${assignedTeam.teamName}-Hacker${String(perTeamNumber).padStart(2, "0")}`;
  const now = new Date().toISOString();

  await container.items.create({
    id: randomUUID(),
    hackerAlias: fullAlias,
    hackerNumber,
    teamId: assignedTeam.id,
    teamName: assignedTeam.teamName,
    gitHubUsername,
    registeredAt: now,
  });

  await addMemberToTeam(assignedTeam.id, fullAlias);

  return {
    status: 201,
    jsonBody: {
      alias: fullAlias,
      teamNumber: assignedTeam.teamNumber,
      teamId: assignedTeam.id,
      teamName: assignedTeam.teamName,
      registeredAt: now,
    },
  };
}

export async function handleAttendeesMe(request, context) {
  if (request.method === "GET") {
    return getMyProfile(request, context);
  }
  return joinEvent(request, context);
}
