import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

async function getSubmissions(request, context) {
  const client = getTableClient("Submissions");
  const statusFilter = request.query.get("status");
  const teamFilter = request.query.get("team");

  const filters = [];
  if (statusFilter) {
    filters.push(`status eq '${statusFilter}'`);
  }
  if (teamFilter) {
    filters.push(`PartitionKey eq '${teamFilter}'`);
  }

  const queryOptions =
    filters.length > 0 ? { filter: filters.join(" and ") } : {};
  const submissions = [];

  for await (const entity of client.listEntities({ queryOptions })) {
    submissions.push({
      submissionId: entity.rowKey,
      teamName: entity.partitionKey,
      submittedBy: entity.submittedBy,
      submittedAt: entity.submittedAt,
      status: entity.status,
      calculatedTotal: entity.calculatedTotal,
      reviewedBy: entity.reviewedBy,
      reviewedAt: entity.reviewedAt,
      reason: entity.reason,
    });
  }

  return { jsonBody: submissions };
}

async function validateSubmission(request, context) {
  const body = await request.json();
  const { submissionId, action, reason } = body;

  if (!submissionId) {
    return errorResponse("VALIDATION_ERROR", "Missing submissionId");
  }

  if (!action || !["approve", "reject"].includes(action)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "action must be 'approve' or 'reject'",
    );
  }

  if (action === "reject" && !reason) {
    return errorResponse(
      "VALIDATION_ERROR",
      "reason is required when rejecting a submission",
    );
  }

  const principal = getClientPrincipal(request);
  const submissionsClient = getTableClient("Submissions");

  // Find the submission by scanning (submissionId is the rowKey)
  let submission;
  for await (const entity of submissionsClient.listEntities()) {
    if (entity.rowKey === submissionId) {
      submission = entity;
      break;
    }
  }

  if (!submission) {
    return errorResponse(
      "SUBMISSION_NOT_FOUND",
      `Submission '${submissionId}' not found`,
      404,
    );
  }

  const now = new Date().toISOString();
  const reviewedBy = principal?.userDetails || "admin";

  await submissionsClient.updateEntity(
    {
      partitionKey: submission.partitionKey,
      rowKey: submission.rowKey,
      status: action === "approve" ? "Approved" : "Rejected",
      reviewedBy,
      reviewedAt: now,
      reason: reason || "",
    },
    "Merge",
  );

  // On approval, write scores to the Scores table
  if (action === "approve" && submission.payload) {
    const payload = JSON.parse(submission.payload);
    const scoresClient = getTableClient("Scores");
    const teamName = submission.partitionKey;

    if (payload.Categories) {
      for (const [category, data] of Object.entries(payload.Categories)) {
        if (data.Criteria) {
          for (const [criterion, points] of Object.entries(data.Criteria)) {
            await scoresClient.upsertEntity({
              partitionKey: teamName,
              rowKey: `${category}_${criterion}`,
              category,
              criterion,
              points,
              maxPoints: data.MaxPoints || 0,
              scoredBy: submission.submittedBy,
              timestamp: now,
            });
          }
        }
      }
    }

    if (payload.Bonus) {
      for (const [enhancement, data] of Object.entries(payload.Bonus)) {
        await scoresClient.upsertEntity({
          partitionKey: teamName,
          rowKey: `Bonus_${enhancement}`,
          category: "Bonus",
          criterion: enhancement,
          points: data.Verified ? data.Points : 0,
          maxPoints: data.Points,
          scoredBy: submission.submittedBy,
          timestamp: now,
        });
      }
    }
  }

  return {
    jsonBody: {
      submissionId,
      teamName: submission.partitionKey,
      status: action === "approve" ? "Approved" : "Rejected",
      reviewedBy,
      reviewedAt: now,
    },
  };
}

app.http("submissions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "submissions",
  handler: getSubmissions,
});

app.http("submissions-validate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "submissions/validate",
  handler: validateSubmission,
});
