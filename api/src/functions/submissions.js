import { app } from "@azure/functions";
import { query } from "../../shared/db.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

async function getSubmissions(request) {
  const statusFilter = request.query.get("status");
  const teamFilter = request.query.get("team");

  let sql = `SELECT s.id AS submissionId, t.teamName, s.submittedAt, s.status,
            s.calculatedTotal, s.reviewedAt, s.reason
       FROM dbo.Submissions s
       JOIN dbo.Teams t ON t.id = s.teamId
      WHERE 1=1`;
  const params = {};

  if (statusFilter) {
    sql += " AND s.status = @status";
    params.status = statusFilter;
  }
  if (teamFilter) {
    sql += " AND t.teamName = @teamName";
    params.teamName = teamFilter;
  }
  sql += " ORDER BY s.submittedAt DESC";

  const result = await query(sql, params);
  return {
    jsonBody: result.recordset.map((row) => ({
      submissionId: row.submissionId,
      teamName: row.teamName,
      submittedAt: row.submittedAt,
      status: row.status,
      calculatedTotal: row.calculatedTotal,
      reviewedAt: row.reviewedAt,
      reason: row.reason,
    })),
  };
}

async function validateSubmission(request) {
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

  const subResult = await query(
    `SELECT s.id, s.teamId, t.teamName, s.status, s.payload, s.submittedBy
       FROM dbo.Submissions s
       JOIN dbo.Teams t ON t.id = s.teamId
      WHERE s.id = @submissionId`,
    { submissionId },
  );

  if (subResult.recordset.length === 0) {
    return errorResponse(
      "SUBMISSION_NOT_FOUND",
      `Submission '${submissionId}' not found`,
      404,
    );
  }

  const submission = subResult.recordset[0];
  const principal = getClientPrincipal(request);
  const reviewedBy = principal?.userDetails || "admin";
  const now = new Date().toISOString();
  const newStatus = action === "approve" ? "Approved" : "Rejected";

  await query(
    `UPDATE dbo.Submissions
        SET status = @status, reviewedBy = @reviewedBy, reviewedAt = @reviewedAt, reason = @reason
      WHERE id = @submissionId`,
    {
      status: newStatus,
      reviewedBy,
      reviewedAt: now,
      reason: reason || "",
      submissionId,
    },
  );

  // On approval, write scores from the stored payload into Scores table (in a single transaction)
  if (action === "approve" && submission.payload) {
    const payload = JSON.parse(submission.payload);

    if (payload.Categories) {
      for (const [category, data] of Object.entries(payload.Categories)) {
        if (data.Criteria) {
          for (const [criterion, points] of Object.entries(data.Criteria)) {
            await query(
              `MERGE dbo.Scores AS target
               USING (SELECT @teamId AS teamId, @category AS category, @criterion AS criterion) AS src
                  ON target.teamId = src.teamId AND target.category = src.category AND target.criterion = src.criterion
               WHEN MATCHED THEN
                 UPDATE SET points = @points, maxPoints = @maxPoints, scoredBy = @scoredBy, timestamp = @timestamp
               WHEN NOT MATCHED THEN
                 INSERT (teamId, category, criterion, points, maxPoints, scoredBy, timestamp)
                 VALUES (@teamId, @category, @criterion, @points, @maxPoints, @scoredBy, @timestamp);`,
              {
                teamId: submission.teamId,
                category,
                criterion,
                points,
                maxPoints: data.MaxPoints || 0,
                scoredBy: submission.submittedBy,
                timestamp: now,
              },
            );
          }
        }
      }
    }

    if (payload.Bonus) {
      for (const [enhancement, data] of Object.entries(payload.Bonus)) {
        await query(
          `MERGE dbo.Scores AS target
           USING (SELECT @teamId AS teamId, @category AS category, @criterion AS criterion) AS src
              ON target.teamId = src.teamId AND target.category = src.category AND target.criterion = src.criterion
           WHEN MATCHED THEN
             UPDATE SET points = @points, maxPoints = @maxPoints, scoredBy = @scoredBy, timestamp = @timestamp
           WHEN NOT MATCHED THEN
             INSERT (teamId, category, criterion, points, maxPoints, scoredBy, timestamp)
             VALUES (@teamId, @category, @criterion, @points, @maxPoints, @scoredBy, @timestamp);`,
          {
            teamId: submission.teamId,
            category: "Bonus",
            criterion: enhancement,
            points: data.Verified ? data.Points : 0,
            maxPoints: data.Points,
            scoredBy: submission.submittedBy,
            timestamp: now,
          },
        );
      }
    }
  }

  return {
    jsonBody: {
      submissionId,
      teamName: submission.teamName,
      status: newStatus,
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
      submittedAt: entity.submittedAt,
      status: entity.status,
      calculatedTotal: entity.calculatedTotal,
      // submittedBy / reviewedBy kept in storage for audit; not returned to clients
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
