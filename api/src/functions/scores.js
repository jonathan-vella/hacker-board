import { getContainer } from "../../shared/cosmos.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

export async function getScores(request) {
  const teamFilter = request.query.get("team");
  const scoresContainer = getContainer("scores");

  if (teamFilter) {
    const { resources } = await scoresContainer.items
      .query({
        query:
          "SELECT c.category, c.criterion, c.points, c.maxPoints, c.timestamp FROM c WHERE c.teamId = @teamId",
        parameters: [{ name: "@teamId", value: teamFilter }],
      })
      .fetchAll();

    return {
      jsonBody: resources.map((doc) => ({
        teamName: teamFilter,
        category: doc.category,
        criterion: doc.criterion,
        points: doc.points,
        maxPoints: doc.maxPoints,
        timestamp: doc.timestamp,
      })),
    };
  }

  // No filter — return leaderboard aggregated by team
  const teamsContainer = getContainer("teams");
  const { resources: teams } = await teamsContainer.items
    .query("SELECT c.id, c.teamName FROM c")
    .fetchAll();

  const leaderboard = [];

  for (const team of teams) {
    const { resources: scores } = await scoresContainer.items
      .query({
        query:
          "SELECT c.category, c.points, c.maxPoints FROM c WHERE c.teamId = @teamId",
        parameters: [{ name: "@teamId", value: team.id }],
      })
      .fetchAll();

    let baseScore = 0;
    let bonusScore = 0;
    let maxBaseScore = 0;

    for (const s of scores) {
      if (s.category === "Bonus") {
        bonusScore += s.points || 0;
      } else {
        baseScore += s.points || 0;
        maxBaseScore += s.maxPoints || 0;
      }
    }

    const maxBase = maxBaseScore || 105;
    leaderboard.push({
      teamName: team.teamName,
      baseScore,
      bonusScore,
      totalScore: baseScore + bonusScore,
      maxBaseScore: maxBase,
      percentage:
        maxBase > 0 ? Math.round((baseScore / maxBase) * 10000) / 100 : 0,
      grade: calculateGrade(baseScore, maxBase),
    });
  }

  leaderboard.sort((a, b) => b.totalScore - a.totalScore);

  // Auto-assign "Best Overall" award to the leading team
  if (leaderboard.length > 0 && leaderboard[0].totalScore > 0) {
    try {
      const configContainer = getContainer("config");
      await configContainer.items.upsert({
        id: "award_BestOverall",
        type: "award",
        category: "BestOverall",
        teamName: leaderboard[0].teamName,
        assignedBy: "system",
        assignedAt: new Date().toISOString(),
      });
    } catch {
      // Non-critical — don't fail the leaderboard response
    }
  }

  return {
    jsonBody: { leaderboard, lastUpdated: new Date().toISOString() },
  };
}

export function calculateGrade(base, maxBase) {
  if (maxBase === 0) return "N/A";
  const pct = (base / maxBase) * 100;
  if (pct >= 90) return "OUTSTANDING";
  if (pct >= 80) return "EXCELLENT";
  if (pct >= 70) return "GOOD";
  if (pct >= 60) return "SATISFACTORY";
  return "NEEDS IMPROVEMENT";
}

export async function postScores(request) {
  const body = await request.json();
  const { teamName, scores: scoreItems, bonus, overrideReason } = body;

  if (!teamName) {
    return errorResponse("VALIDATION_ERROR", "Missing teamName");
  }
  if (!overrideReason) {
    return errorResponse("VALIDATION_ERROR", "Missing overrideReason");
  }

  const teamsContainer = getContainer("teams");
  try {
    await teamsContainer.item(teamName, teamName).read();
  } catch (err) {
    if (err.code === 404) {
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
  const now = new Date().toISOString();
  const scoresContainer = getContainer("scores");
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
      await scoresContainer.items.upsert({
        id: `${teamName}_${item.category}_${item.criterion}`,
        teamId: teamName,
        category: item.category,
        criterion: item.criterion,
        points: item.points,
        maxPoints: item.maxPoints,
        scoredBy,
        overrideReason,
        timestamp: now,
      });
      scoresUpserted++;
    }
  }

  if (bonus && Array.isArray(bonus)) {
    for (const item of bonus) {
      await scoresContainer.items.upsert({
        id: `${teamName}_Bonus_${item.enhancement}`,
        teamId: teamName,
        category: "Bonus",
        criterion: item.enhancement,
        points: item.verified ? item.points : 0,
        maxPoints: item.points,
        scoredBy,
        overrideReason,
        timestamp: now,
      });
      bonusUpserted++;
    }
  }

  // Calculate new total
  const { resources: allScores } = await scoresContainer.items
    .query({
      query: "SELECT VALUE SUM(c.points) FROM c WHERE c.teamId = @teamId",
      parameters: [{ name: "@teamId", value: teamName }],
    })
    .fetchAll();

  return {
    jsonBody: {
      teamName,
      scoresUpserted,
      bonusUpserted,
      newTotal: allScores[0] || 0,
    },
  };
}

export async function handleScores(request, context) {
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
}
