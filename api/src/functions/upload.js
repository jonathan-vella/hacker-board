import { app } from "@azure/functions";
import { query } from "../../shared/db.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { getFlags, requireFeature } from "../../shared/featureFlags.js";
import { createRequestLogger } from "../../shared/logger.js";
import { randomUUID } from "node:crypto";

async function postUpload(request, context) {
  const log = createRequestLogger(request);
  log.info("upload.POST");

  const flags = await getFlags();
  const disabled = requireFeature(flags, "SUBMISSIONS_ENABLED");
  if (disabled) {
    log.warn("upload.POST", { blocked: "SUBMISSIONS_ENABLED" });
    return disabled;
  }

  const principal = getClientPrincipal(request);
  if (!principal) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const body = await request.json();

  if (!body.TeamName) {
    return errorResponse("VALIDATION_ERROR", "Missing TeamName field");
  }

  const teamRow = await query(
    "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
    { teamName: body.TeamName },
  );
  if (teamRow.recordset.length === 0) {
    return errorResponse(
      "TEAM_NOT_FOUND",
      `Team '${body.TeamName}' does not exist. Create it first via POST /api/teams.`,
      404,
    );
  }

  if (body.Total && body.Total.Base > body.Total.MaxBase) {
    return errorResponse(
      "SCORE_EXCEEDS_MAX",
      `Base score (${body.Total.Base}) exceeds max (${body.Total.MaxBase})`,
    );
  }

  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > 256 * 1024) {
    return errorResponse("VALIDATION_ERROR", "Payload exceeds 256 KB limit");
  }

  const submissionId = randomUUID();
  const teamId = teamRow.recordset[0].id;

  await query(
    `INSERT INTO dbo.Submissions
       (id, teamId, submittedBy, submittedAt, status, payload, calculatedTotal)
     VALUES
       (@id, @teamId, @submittedBy, @submittedAt, 'Pending', @payload, @calculatedTotal)`,
    {
      id: submissionId,
      teamId,
      submittedBy: principal.userDetails,
      submittedAt: new Date().toISOString(),
      payload: JSON.stringify(body),
      calculatedTotal: body.Total?.Grand || 0,
    },
  );

  log.done("upload.POST", { submissionId, teamName: body.TeamName });

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

async function postUpload(request, context) {
  const log = createRequestLogger(request);
  log.info("upload.POST");

  const flags = await getFlags(getTableClient("Config"));
  const disabled = requireFeature(flags, "SUBMISSIONS_ENABLED");
  if (disabled) {
    log.warn("upload.POST", { blocked: "SUBMISSIONS_ENABLED" });
    return disabled;
  }

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

  log.done("upload.POST", { submissionId, teamName: body.TeamName });

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
