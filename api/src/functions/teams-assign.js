import { getContainer } from "../../shared/cosmos.js";
import { errorResponse } from "../../shared/errors.js";
import { randomInt } from "node:crypto";

export async function assignTeams(request) {
  const { teamCount } = await request.json();

  if (!teamCount || !Number.isInteger(teamCount) || teamCount < 1) {
    return errorResponse(
      "VALIDATION_ERROR",
      "teamCount must be a positive integer",
    );
  }

  const attendeesContainer = getContainer("attendees");
  const { resources: attendees } = await attendeesContainer.items
    .query("SELECT c.id, c.firstName, c.surname, c.gitHubUsername FROM c")
    .fetchAll();

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

  const teamsContainer = getContainer("teams");

  for (let t = 0; t < teamCount; t++) {
    const teamName = `team-${t + 1}`;
    const now = new Date().toISOString();
    const teamMembers = teams[t].members.map(
      (m) => m.gitHubUsername || `${m.firstName} ${m.surname}`,
    );

    await teamsContainer.items.upsert({
      id: teamName,
      teamName,
      teamNumber: t + 1,
      teamMembers,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update each attendee's team assignment
  for (let i = 0; i < attendees.length; i++) {
    const teamIndex = i % teamCount;
    const teamName = `team-${teamIndex + 1}`;
    const attendee = attendees[i];

    try {
      const { resource } = await attendeesContainer
        .item(attendee.id, teamName)
        .read();
      if (resource) {
        resource.teamId = teamName;
        resource.teamNumber = teamIndex + 1;
        await attendeesContainer.item(attendee.id, teamName).replace(resource);
      }
    } catch {
      // Attendee partition may differ — read by id cross-partition and update
      const { resources } = await attendeesContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.id = @id",
          parameters: [{ name: "@id", value: attendee.id }],
        })
        .fetchAll();

      if (resources.length > 0) {
        const doc = resources[0];
        const oldTeamId = doc.teamId;
        // Delete from old partition, create in new partition
        try {
          await attendeesContainer.item(doc.id, oldTeamId).delete();
        } catch {
          /* ignore */
        }
        doc.teamId = teamName;
        doc.teamNumber = teamIndex + 1;
        await attendeesContainer.items.create(doc);
      }
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
