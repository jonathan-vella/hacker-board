import { getContainer } from "../../shared/cosmos.js";
import { getClientPrincipal, requireRole } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { getFlags, requireFeature } from "../../shared/featureFlags.js";
import { createRequestLogger } from "../../shared/logger.js";
import { randomUUID } from "node:crypto";

export async function postUpload(request, context) {
  const log = createRequestLogger(request);
  log.info("upload.POST");

  const denied = requireRole(request, "admin");
  if (denied) return denied;

  const flags = await getFlags();
  const disabled = requireFeature(flags, "SUBMISSIONS_ENABLED");
  if (disabled) {
    log.warn("upload.POST", { blocked: "SUBMISSIONS_ENABLED" });
    return disabled;
  }

  const principal = getClientPrincipal(request);

  const body = await request.json();

  if (!body.TeamName) {
    return errorResponse("VALIDATION_ERROR", "Missing TeamName field");
  }

  // Verify team exists
  const teamsContainer = getContainer("teams");
  try {
    await teamsContainer.item(body.TeamName, body.TeamName).read();
  } catch (err) {
    if (err.code === 404) {
      return errorResponse(
        "TEAM_NOT_FOUND",
        `Team '${body.TeamName}' does not exist. Create it first via POST /api/teams.`,
        404,
      );
    }
    throw err;
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
  const submissionsContainer = getContainer("submissions");

  await submissionsContainer.items.create({
    id: submissionId,
    teamId: body.TeamName,
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
