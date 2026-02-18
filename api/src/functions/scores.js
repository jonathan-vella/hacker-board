import { app } from "@azure/functions";
import { query } from "../../shared/db.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

async function getScores(request) {
  const teamFilter = request.query.get("team");

  if (teamFilter) {
    const result = await query(
      `SELECT s.category, s.criterion, s.points, s.maxPoints, s.timestamp
         FROM dbo.Scores s
         JOIN dbo.Teams t ON t.id = s.teamId
        WHERE t.teamName = @teamName`,
      { teamName: teamFilter },
    );
    return {
      jsonBody: result.recordset.map((row) => ({
        teamName: teamFilter,
        category: row.category,
        criterion: row.criterion,
        points: row.points,
        maxPoints: row.maxPoints,
        timestamp: row.timestamp,
      })),
    };
  }

  // No filter — return leaderboard aggregated by team
  const result = await query(
    `SELECT t.teamName,
            SUM(CASE WHEN s.category <> 'Bonus' THEN s.points ELSE 0 END) AS baseScore,
            SUM(CASE WHEN s.category = 'Bonus'  THEN s.points ELSE 0 END) AS bonusScore,
            SUM(CASE WHEN s.category <> 'Bonus' THEN s.maxPoints ELSE 0 END) AS maxBaseScore
       FROM dbo.Teams t
       LEFT JOIN dbo.Scores s ON s.teamId = t.id
      GROUP BY t.teamName
      ORDER BY (SUM(s.points)) DESC`,
  );

  const leaderboard = result.recordset.map((row) => {
    const base = row.baseScore || 0;
    const bonus = row.bonusScore || 0;
    const maxBase = row.maxBaseScore || 105;
    return {
      teamName: row.teamName,
      baseScore: base,
      bonusScore: bonus,
      totalScore: base + bonus,
      maxBaseScore: maxBase,
      percentage: maxBase > 0 ? Math.round((base / maxBase) * 10000) / 100 : 0,
      grade: calculateGrade(base, maxBase),
    };
  });

  return {
    jsonBody: { leaderboard, lastUpdated: new Date().toISOString() },
  };
}

function calculateGrade(base, maxBase) {
  if (maxBase === 0) return "N/A";
  const pct = (base / maxBase) * 100;
  if (pct >= 90) return "OUTSTANDING";
  if (pct >= 80) return "EXCELLENT";
  if (pct >= 70) return "GOOD";
  if (pct >= 60) return "SATISFACTORY";
  return "NEEDS IMPROVEMENT";
}

async function postScores(request) {
  const body = await request.json();
  const { teamName, scores: scoreItems, bonus, overrideReason } = body;

  if (!teamName) {
    return errorResponse("VALIDATION_ERROR", "Missing teamName");
  }
  if (!overrideReason) {
    return errorResponse("VALIDATION_ERROR", "Missing overrideReason");
  }

  const teamRow = await query(
    "SELECT id FROM dbo.Teams WHERE teamName = @teamName",
    { teamName },
  );
  if (teamRow.recordset.length === 0) {
    return errorResponse(
      "TEAM_NOT_FOUND",
      `Team '${teamName}' does not exist`,
      404,
    );
  }

  const teamId = teamRow.recordset[0].id;
  const principal = getClientPrincipal(request);
  const scoredBy = principal?.userDetails || "admin";
  const now = new Date().toISOString();
  let scoresUpserted = 0;
  let bonusUpserted = 0;

  if (scoreItems && Array.isArray(scoreItems)) {
    for (const item of scoreItems) {
      if (item.points > item.maxPoints) {
        return errorResponse(
          "SCORE_EXCEEDS_MAX",
          `Points (${item.points}) exceed maxPoints (${item.maxPoints}) for ${item.category}/${item.criterion}`,
        );
      }
      // MERGE = upsert on (teamId, category, criterion)
      await query(
        `MERGE dbo.Scores AS target
         USING (SELECT @teamId AS teamId, @category AS category, @criterion AS criterion) AS src
            ON target.teamId = src.teamId AND target.category = src.category AND target.criterion = src.criterion
         WHEN MATCHED THEN
           UPDATE SET points = @points, maxPoints = @maxPoints, scoredBy = @scoredBy,
                      overrideReason = @overrideReason, timestamp = @timestamp
         WHEN NOT MATCHED THEN
           INSERT (teamId, category, criterion, points, maxPoints, scoredBy, overrideReason, timestamp)
           VALUES (@teamId, @category, @criterion, @points, @maxPoints, @scoredBy, @overrideReason, @timestamp);`,
        {
          teamId,
          category: item.category,
          criterion: item.criterion,
          points: item.points,
          maxPoints: item.maxPoints,
          scoredBy,
          overrideReason,
          timestamp: now,
        },
      );
      scoresUpserted++;
    }
  }

  if (bonus && Array.isArray(bonus)) {
    for (const item of bonus) {
      await query(
        `MERGE dbo.Scores AS target
         USING (SELECT @teamId AS teamId, @category AS category, @criterion AS criterion) AS src
            ON target.teamId = src.teamId AND target.category = src.category AND target.criterion = src.criterion
         WHEN MATCHED THEN
           UPDATE SET points = @points, maxPoints = @maxPoints, scoredBy = @scoredBy,
                      overrideReason = @overrideReason, timestamp = @timestamp
         WHEN NOT MATCHED THEN
           INSERT (teamId, category, criterion, points, maxPoints, scoredBy, overrideReason, timestamp)
           VALUES (@teamId, @category, @criterion, @points, @maxPoints, @scoredBy, @overrideReason, @timestamp);`,
        {
          teamId,
          category: "Bonus",
          criterion: item.enhancement,
          points: item.verified ? item.points : 0,
          maxPoints: item.points,
          scoredBy,
          overrideReason,
          timestamp: now,
        },
      );
      bonusUpserted++;
    }
  }

  const totalResult = await query(
    "SELECT ISNULL(SUM(points), 0) AS newTotal FROM dbo.Scores WHERE teamId = @teamId",
    { teamId },
  );

  return {
    jsonBody: {
      teamName,
      scoresUpserted,
      bonusUpserted,
      newTotal: totalResult.recordset[0].newTotal,
    },
  };
}

app.http("scores", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "scores",
  handler: async (request, context) => {
    switch (request.method) {
      case "GET":
        return getScores(request, context);
      case "POST":
        return postScores(request, context);
      default:
        return {
          status: 405,
          jsonBody: {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Method not allowed",
            },
          },
        };
    }
  },
});

const TABLE_NAME = "Scores";

async function getScores(request, context) {
  const client = getTableClient(TABLE_NAME);
  const teamFilter = request.query.get("team");

  const filters = [];
  if (teamFilter) {
    filters.push(`PartitionKey eq '${teamFilter}'`);
  }

  const queryOptions =
    filters.length > 0 ? { filter: filters.join(" and ") } : {};
  const scores = [];

  for await (const entity of client.listEntities({ queryOptions })) {
    scores.push({
      teamName: entity.partitionKey,
      category: entity.category,
      criterion: entity.criterion,
      points: entity.points,
      maxPoints: entity.maxPoints,
      // scoredBy kept in storage for audit; not returned to clients
      timestamp: entity.timestamp,
    });
  }

  if (!teamFilter) {
    const teamScores = new Map();
    for (const score of scores) {
      if (!teamScores.has(score.teamName)) {
        teamScores.set(score.teamName, { base: 0, bonus: 0, maxBase: 0 });
      }
      const ts = teamScores.get(score.teamName);
      if (score.category === "Bonus") {
        ts.bonus += score.points;
      } else {
        ts.base += score.points;
        ts.maxBase += score.maxPoints;
      }
    }

    const leaderboard = [...teamScores.entries()]
      .map(([teamName, ts]) => ({
        teamName,
        baseScore: ts.base,
        bonusScore: ts.bonus,
        totalScore: ts.base + ts.bonus,
        maxBaseScore: ts.maxBase || 105,
        percentage:
          ts.maxBase > 0 ? Math.round((ts.base / ts.maxBase) * 10000) / 100 : 0,
        grade: calculateGrade(ts.base, ts.maxBase),
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    return {
      jsonBody: {
        leaderboard,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  return { jsonBody: scores };
}

function calculateGrade(base, maxBase) {
  if (maxBase === 0) return "N/A";
  const pct = (base / maxBase) * 100;
  if (pct >= 90) return "OUTSTANDING";
  if (pct >= 80) return "EXCELLENT";
  if (pct >= 70) return "GOOD";
  if (pct >= 60) return "SATISFACTORY";
  return "NEEDS IMPROVEMENT";
}

async function postScores(request, context) {
  const body = await request.json();
  const { teamName, scores: scoreItems, bonus, overrideReason } = body;

  if (!teamName) {
    return errorResponse("VALIDATION_ERROR", "Missing teamName");
  }

  if (!overrideReason) {
    return errorResponse("VALIDATION_ERROR", "Missing overrideReason");
  }

  const teamsClient = getTableClient("Teams");
  try {
    await teamsClient.getEntity("team", teamName);
  } catch (err) {
    if (err.statusCode === 404) {
      return errorResponse(
        "TEAM_NOT_FOUND",
        `Team '${teamName}' does not exist`,
        404,
      );
    }
    throw err;
  }

  const principal = getClientPrincipal(request);
  const scoredBy = principal?.userDetails || "admin";
  const client = getTableClient(TABLE_NAME);
  let scoresUpserted = 0;
  let bonusUpserted = 0;

  if (scoreItems && Array.isArray(scoreItems)) {
    for (const item of scoreItems) {
      if (item.points > item.maxPoints) {
        return errorResponse(
          "SCORE_EXCEEDS_MAX",
          `Points (${item.points}) exceed maxPoints (${item.maxPoints}) for ${item.category}/${item.criterion}`,
        );
      }

      await client.upsertEntity({
        partitionKey: teamName,
        rowKey: `${item.category}_${item.criterion}`,
        category: item.category,
        criterion: item.criterion,
        points: item.points,
        maxPoints: item.maxPoints,
        scoredBy,
        overrideReason,
        timestamp: new Date().toISOString(),
      });
      scoresUpserted++;
    }
  }

  if (bonus && Array.isArray(bonus)) {
    for (const item of bonus) {
      await client.upsertEntity({
        partitionKey: teamName,
        rowKey: `Bonus_${item.enhancement}`,
        category: "Bonus",
        criterion: item.enhancement,
        points: item.verified ? item.points : 0,
        maxPoints: item.points,
        scoredBy,
        overrideReason,
        timestamp: new Date().toISOString(),
      });
      bonusUpserted++;
    }
  }

  // Calculate new total
  let newTotal = 0;
  for await (const entity of client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${teamName}'` },
  })) {
    newTotal += entity.points || 0;
  }

  return {
    jsonBody: {
      teamName,
      scoresUpserted,
      bonusUpserted,
      newTotal,
    },
  };
}

app.http("scores", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "scores",
  handler: async (request, context) => {
    switch (request.method) {
      case "GET":
        return getScores(request, context);
      case "POST":
        return postScores(request, context);
      default:
        return {
          status: 405,
          jsonBody: {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Method not allowed",
            },
          },
        };
    }
  },
});
