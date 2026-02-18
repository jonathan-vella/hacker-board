import { app } from "@azure/functions";
import { query } from "../../shared/db.js";
import { errorResponse } from "../../shared/errors.js";
import { randomInt } from "node:crypto";

async function assignTeams(request) {
  const { teamCount } = await request.json();

  if (!teamCount || !Number.isInteger(teamCount) || teamCount < 1) {
    return errorResponse(
      "VALIDATION_ERROR",
      "teamCount must be a positive integer",
    );
  }

  const attendeesResult = await query(
    `SELECT id, firstName, surname, gitHubUsername FROM dbo.Attendees`,
  );
  const attendees = attendeesResult.recordset;

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

  const teams = Array.from({ length: teamCount }, (_, t) => ({
    teamName: `Team ${t + 1}`,
    members: [],
  }));

  attendees.forEach((attendee, index) => {
    teams[index % teamCount].members.push({
      firstName: attendee.firstName,
      surname: attendee.surname,
      gitHubUsername: attendee.gitHubUsername || undefined,
    });
  });

  for (let t = 0; t < teamCount; t++) {
    const teamName = `team-${t + 1}`;
    const teamMembers = JSON.stringify(
      teams[t].members.map(
        (m) => m.gitHubUsername || `${m.firstName} ${m.surname}`,
      ),
    );
    const now = new Date().toISOString();

    await query(
      `MERGE dbo.Teams AS target
       USING (SELECT @teamName AS teamName) AS source ON target.teamName = source.teamName
       WHEN MATCHED THEN
         UPDATE SET teamMembers = @teamMembers, updatedAt = @updatedAt
       WHEN NOT MATCHED THEN
         INSERT (teamName, teamNumber, teamMembers, createdAt, updatedAt)
         VALUES (@teamName, @teamNumber, @teamMembers, @createdAt, @createdAt);`,
      {
        teamName,
        teamNumber: t + 1,
        teamMembers,
        createdAt: now,
        updatedAt: now,
      },
    );
  }

  // Update each attendee's team assignment
  for (let i = 0; i < attendees.length; i++) {
    const teamIndex = i % teamCount;
    const teamName = `team-${teamIndex + 1}`;
    const teamResult = await query(
      `SELECT id FROM dbo.Teams WHERE teamName = @teamName`,
      { teamName },
    );
    if (teamResult.recordset.length > 0) {
      await query(
        `UPDATE dbo.Attendees SET teamId = @teamId, teamNumber = @teamNumber WHERE id = @id`,
        {
          teamId: teamResult.recordset[0].id,
          teamNumber: teamIndex + 1,
          id: attendees[i].id,
        },
      );
    }
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
