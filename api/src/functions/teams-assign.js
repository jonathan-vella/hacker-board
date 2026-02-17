import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";
import { errorResponse } from "../../shared/errors.js";
import { randomInt } from "node:crypto";

const TABLE_NAME = "Attendees";

async function assignTeams(request, context) {
  const body = await request.json();
  const { teamCount } = body;

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
