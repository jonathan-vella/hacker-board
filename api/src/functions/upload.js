import { app } from "@azure/functions";
import { getTableClient } from "../shared/tables.js";
import { getClientPrincipal } from "../shared/auth.js";
import { errorResponse } from "../shared/errors.js";
import { randomUUID } from "node:crypto";

async function postUpload(request, context) {
  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const body = await request.json();

  if (!body.TeamName) {
    return errorResponse("VALIDATION_ERROR", "Missing TeamName field");
  }

  // Verify team exists
  const teamsClient = getTableClient("Teams");
  try {
    await teamsClient.getEntity("team", body.TeamName);
  } catch (err) {
    if (err.statusCode === 404) {
      return errorResponse(
        "TEAM_NOT_FOUND",
        `Team '${body.TeamName}' does not exist. Create it first via POST /api/teams.`,
        404,
      );
    }
    throw err;
  }

  // Validate score totals
  if (body.Total && body.Total.Base > body.Total.MaxBase) {
    return errorResponse(
      "SCORE_EXCEEDS_MAX",
      `Base score (${body.Total.Base}) exceeds max (${body.Total.MaxBase})`,
    );
  }

  // Enforce max payload size (256 KB)
  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > 256 * 1024) {
    return errorResponse("VALIDATION_ERROR", "Payload exceeds 256 KB limit");
  }

  const submissionId = randomUUID();
  const submissionsClient = getTableClient("Submissions");

  await submissionsClient.createEntity({
    partitionKey: body.TeamName,
    rowKey: submissionId,
    submittedBy: principal.userDetails,
    submittedAt: new Date().toISOString(),
    status: "Pending",
    payload: JSON.stringify(body),
    calculatedTotal: body.Total?.Grand || 0,
  });

  return {
    status: 202,
    jsonBody: {
      submissionId,
      teamName: body.TeamName,
      status: "Pending",
      message: "Submission received and queued for admin validation",
    },
  };
}

app.http("upload", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "upload",
  handler: postUpload,
});
