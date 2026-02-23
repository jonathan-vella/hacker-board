import { getContainer } from "../../shared/cosmos.js";
import { requireRole } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { randomInt } from "node:crypto";

export async function assignTeams(request) {
  const denied = requireRole(request, "admin");
  if (denied) return denied;

  const attendeesContainer = getContainer("attendees");
  const teamsContainer = getContainer("teams");

  const [{ resources: attendees }, { resources: teams }] = await Promise.all([
    attendeesContainer.items
      .query("SELECT c.id, c.hackerAlias, c.teamId FROM c")
      .fetchAll(),
    teamsContainer.items
      .query(
        "SELECT c.id, c.teamName, c.teamNumber FROM c ORDER BY c.teamNumber",
      )
      .fetchAll(),
  ]);

  if (attendees.length === 0) {
    return errorResponse(
      "VALIDATION_ERROR",
      "No attendees registered to assign",
    );
  }

  if (teams.length === 0) {
    return errorResponse("VALIDATION_ERROR", "No teams exist to assign to");
  }

  // Fisher-Yates shuffle
  for (let i = attendees.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [attendees[i], attendees[j]] = [attendees[j], attendees[i]];
  }

  // Build new assignment map: teamIndex -> member aliases
  // Filter out attendees with no alias (legacy data without hackerAlias) to
  // avoid populating teamMembers with undefined values.
  const assignableAttendees = attendees.filter((a) => a.hackerAlias);

  const teamMembersMap = new Map(teams.map((t) => [t.id, []]));
  assignableAttendees.forEach((attendee, index) => {
    const team = teams[index % teams.length];
    teamMembersMap.get(team.id).push(attendee.hackerAlias);
  });

  const now = new Date().toISOString();

  // Update each team's memberlist
  for (const team of teams) {
    const members = teamMembersMap.get(team.id);
    const { resource } = await teamsContainer.item(team.id, team.id).read();
    resource.teamMembers = members;
    resource.updatedAt = now;
    await teamsContainer.item(team.id, team.id).replace(resource);
  }

  // Partition key is /teamId — moving an attendee to another team requires
  // delete + recreate since Cosmos DB does not allow changing partition keys in place.
  for (let i = 0; i < assignableAttendees.length; i++) {
    const team = teams[i % teams.length];
    const attendee = assignableAttendees[i];

    if (attendee.teamId === team.id) continue;

    try {
      const { resource: fullDoc } = await attendeesContainer
        .item(attendee.id, attendee.teamId)
        .read();

      if (fullDoc) {
        await attendeesContainer.item(attendee.id, attendee.teamId).delete();
        const { _rid, _self, _etag, _attachments, _ts, ...cleanDoc } = fullDoc;
        await attendeesContainer.items.create({
          ...cleanDoc,
          teamId: team.id,
          teamName: team.teamName,
        });
      }
    } catch {
      // Cross-partition fallback: the attendee's teamId in the query result may
      // be stale or from legacy data (e.g. old format "team-1" vs "Team01").
      // Locate the document by id, then delete+recreate in the correct partition.
      try {
        const { resources: found } = await attendeesContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: attendee.id }],
          })
          .fetchAll();

        if (found.length > 0) {
          const doc = found[0];
          const { _rid, _self, _etag, _attachments, _ts, ...cleanDoc } = doc;
          await attendeesContainer.item(doc.id, doc.teamId).delete();
          await attendeesContainer.items.create({
            ...cleanDoc,
            teamId: team.id,
            teamName: team.teamName,
          });
        }
      } catch {
        // If the fallback also fails, skip this attendee — data may be corrupted
      }
    }
  }

  return {
    jsonBody: {
      teams: teams.map((t) => ({
        teamName: t.teamName,
        members: teamMembersMap.get(t.id),
      })),
      totalHackers: assignableAttendees.length,
      teamCount: teams.length,
    },
  };
}
