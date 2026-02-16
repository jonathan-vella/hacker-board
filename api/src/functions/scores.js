import { app } from "@azure/functions";
import { getTableClient } from "../../shared/tables.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

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
      scoredBy: entity.scoredBy,
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
