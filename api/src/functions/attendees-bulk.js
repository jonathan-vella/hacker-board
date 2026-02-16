import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";
import { errorResponse } from "../../shared/errors.js";

const TABLE_NAME = "Attendees";

async function bulkImport(request, context) {
  const body = await request.json();
  const { attendees } = body;

  if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
    return errorResponse("VALIDATION_ERROR", "Empty attendees array");
  }

  const client = getTableClient(TABLE_NAME);
  let created = 0;
  let duplicates = 0;
  const results = [];

  for (const attendee of attendees) {
    if (!attendee.firstName || !attendee.surname) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Missing firstName or surname in row: ${JSON.stringify(attendee)}`,
      );
    }

    const id = `${attendee.surname.toLowerCase()}-${attendee.firstName.toLowerCase()}`;

    try {
      await client.createEntity({
        partitionKey: "unclaimed",
        rowKey: id,
        firstName: attendee.firstName,
        surname: attendee.surname,
        gitHubUsername: "",
        teamNumber: 0,
        registeredAt: new Date().toISOString(),
      });
      created++;
      results.push({
        firstName: attendee.firstName,
        surname: attendee.surname,
        id,
      });
    } catch (err) {
      if (err.statusCode === 409) {
        duplicates++;
      } else {
        throw err;
      }
    }
  }

  return {
    status: 201,
    jsonBody: { created, duplicates, attendees: results },
  };
}

app.http("attendees-bulk", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "attendees/bulk",
  handler: bulkImport,
});
