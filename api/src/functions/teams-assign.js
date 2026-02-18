import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";
import { errorResponse } from "../../shared/errors.js";
import { randomInt } from "node:crypto";

const TABLE_NAME = "Attendees";

/**
 * Admin endpoint: randomly reassigns all registered hackers across existing teams.
 * Uses Fisher-Yates shuffle and round-robin distribution.
 */
async function reassignTeams(request, context) {
  const attendeesClient = getTableClient(TABLE_NAME);
  const teamsClient = getTableClient("Teams");

  // Load all hacker rows (not lookup or meta rows)
  const hackers = [];
  for await (const entity of attendeesClient.listEntities({
    queryOptions: { filter: "PartitionKey eq 'attendees'" },
  })) {
    hackers.push({
      hackerAlias: entity.rowKey,
      currentTeamId: entity.teamId,
    });
  }

  if (hackers.length === 0) {
    return errorResponse("VALIDATION_ERROR", "No registered hackers to assign");
  }

  // Load all teams
  const teams = [];
  for await (const entity of teamsClient.listEntities({
    queryOptions: { filter: "PartitionKey eq 'team'" },
  })) {
    teams.push({
      rowKey: entity.rowKey,
      teamName: entity.teamName || entity.rowKey,
      teamNumber: entity.teamNumber || 0,
    });
  }

  if (teams.length === 0) {
    return errorResponse("VALIDATION_ERROR", "No teams exist to assign hackers to");
  }

  // Fisher-Yates shuffle
  for (let i = hackers.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [hackers[i], hackers[j]] = [hackers[j], hackers[i]];
  }

  // Clear all team member lists
  for (const team of teams) {
    await teamsClient.updateEntity(
      { partitionKey: "team", rowKey: team.rowKey, teamMembers: "[]" },
      "Merge",
    );
  }

  // Round-robin assign and update each hacker row
  for (let i = 0; i < hackers.length; i++) {
    const team = teams[i % teams.length];
    const { hackerAlias } = hackers[i];
    const fullAlias = `${team.teamName}-${hackerAlias}`;

    await attendeesClient.updateEntity(
      {
        partitionKey: "attendees",
        rowKey: hackerAlias,
        teamNumber: team.teamNumber,
        teamId: team.rowKey,
        teamName: team.teamName,
        alias: fullAlias,
      },
      "Merge",
    );
  }

  // Rebuild each team's member list
  const teamMemberMap = new Map(teams.map((t) => [t.rowKey, []]));
  for (let i = 0; i < hackers.length; i++) {
    const team = teams[i % teams.length];
    teamMemberMap.get(team.rowKey).push(hackers[i].hackerAlias);
  }

  for (const team of teams) {
    const members = teamMemberMap.get(team.rowKey);
    await teamsClient.updateEntity(
      {
        partitionKey: "team",
        rowKey: team.rowKey,
        teamMembers: JSON.stringify(members),
      },
      "Merge",
    );
  }

  const result = teams.map((t) => ({
    teamName: t.teamName,
    members: teamMemberMap.get(t.rowKey),
  }));

  return {
    jsonBody: {
      teams: result,
      totalHackers: hackers.length,
      teamCount: teams.length,
    },
  };
}

app.http("teams-assign", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "teams/assign",
  handler: reassignTeams,
});

  if (!teamCount || !Number.isInteger(teamCount) || teamCount < 1) {
    return errorResponse(
      "VALIDATION_ERROR",
      "teamCount must be a positive integer",
    );
  }

  const client = getTableClient(TABLE_NAME);
  const attendees = [];

  for await (const entity of client.listEntities()) {
    attendees.push({
      partitionKey: entity.partitionKey,
      rowKey: entity.rowKey,
      firstName: entity.firstName,
      surname: entity.surname,
      gitHubUsername: entity.gitHubUsername || "",
    });
  }

  if (attendees.length === 0) {
    return errorResponse(
      "VALIDATION_ERROR",
      "No attendees registered to assign",
    );
  }

  if (teamCount > attendees.length) {
    return errorResponse(
      "VALIDATION_ERROR",
      "teamCount exceeds number of attendees",
    );
  }

  // Fisher-Yates shuffle
  for (let i = attendees.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [attendees[i], attendees[j]] = [attendees[j], attendees[i]];
  }

  // Create teams and assign attendees
  const teamsClient = getTableClient("Teams");
  const teams = [];

  for (let t = 0; t < teamCount; t++) {
    teams.push({
      teamName: `Team ${t + 1}`,
      members: [],
    });
  }

  attendees.forEach((attendee, index) => {
    const teamIndex = index % teamCount;
    teams[teamIndex].members.push({
      firstName: attendee.firstName,
      surname: attendee.surname,
      gitHubUsername: attendee.gitHubUsername || undefined,
    });
  });

  // Save teams and update attendee records
  for (let t = 0; t < teamCount; t++) {
    const teamName = `team-${t + 1}`;
    await teamsClient.upsertEntity({
      partitionKey: "team",
      rowKey: teamName,
      teamName: teams[t].teamName,
      teamMembers: JSON.stringify(
        teams[t].members.map(
          (m) => m.gitHubUsername || `${m.firstName} ${m.surname}`,
        ),
      ),
      createdAt: new Date().toISOString(),
    });
  }

  // Update attendee team assignments
  for (let i = 0; i < attendees.length; i++) {
    const teamIndex = i % teamCount;
    await client.upsertEntity({
      partitionKey: attendees[i].partitionKey,
      rowKey: attendees[i].rowKey,
      teamNumber: teamIndex + 1,
      teamId: `team-${teamIndex + 1}`,
    });
  }

  return {
    jsonBody: {
      teams,
      totalAttendees: attendees.length,
      teamCount,
    },
  };
}

app.http("teams-assign", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "teams/assign",
  handler: assignTeams,
});
