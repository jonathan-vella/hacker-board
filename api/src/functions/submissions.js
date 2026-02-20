import { getContainer } from "../../shared/cosmos.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

export async function getSubmissions(request) {
  const statusFilter = request.query.get("status");
  const teamFilter = request.query.get("team");
  const container = getContainer("submissions");

  let queryText =
    "SELECT c.id AS submissionId, c.teamId AS teamName, c.submittedAt, c.status, c.calculatedTotal, c.reviewedAt, c.reason FROM c WHERE 1=1";
  const parameters = [];

  if (statusFilter) {
    queryText += " AND c.status = @status";
    parameters.push({ name: "@status", value: statusFilter });
  }
  if (teamFilter) {
    queryText += " AND c.teamId = @teamId";
    parameters.push({ name: "@teamId", value: teamFilter });
  }
  queryText += " ORDER BY c.submittedAt DESC";

  const { resources } = await container.items
    .query({ query: queryText, parameters })
    .fetchAll();

  return {
    jsonBody: resources.map((doc) => ({
      submissionId: doc.submissionId,
      teamName: doc.teamName,
      submittedAt: doc.submittedAt,
      status: doc.status,
      calculatedTotal: doc.calculatedTotal,
      reviewedAt: doc.reviewedAt,
      reason: doc.reason,
    })),
  };
}

export async function validateSubmission(request) {
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

  const container = getContainer("submissions");

  // Find the submission by id (cross-partition query)
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: submissionId }],
    })
    .fetchAll();

  if (resources.length === 0) {
    return errorResponse(
      "SUBMISSION_NOT_FOUND",
      `Submission '${submissionId}' not found`,
      404,
    );
  }

  const submission = resources[0];
  const principal = getClientPrincipal(request);
  const reviewedBy = principal?.userDetails || "admin";
  const now = new Date().toISOString();
  const newStatus = action === "approve" ? "Approved" : "Rejected";

  submission.status = newStatus;
  submission.reviewedBy = reviewedBy;
  submission.reviewedAt = now;
  submission.reason = reason || "";

  await container.item(submission.id, submission.teamId).replace(submission);

  // On approval, write scores from the stored payload
  if (action === "approve" && submission.payload) {
    const payload = JSON.parse(submission.payload);
    const scoresContainer = getContainer("scores");
    const teamName = submission.teamId;

    if (payload.Categories) {
      for (const [category, data] of Object.entries(payload.Categories)) {
        if (data.Criteria) {
          for (const [criterion, points] of Object.entries(data.Criteria)) {
            await scoresContainer.items.upsert({
              id: `${teamName}_${category}_${criterion}`,
              teamId: teamName,
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
        await scoresContainer.items.upsert({
          id: `${teamName}_Bonus_${enhancement}`,
          teamId: teamName,
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
      teamName: submission.teamId,
      status: newStatus,
      reviewedBy,
      reviewedAt: now,
    },
  };
}
