import { getContainer } from "../../shared/cosmos.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";

const VALID_CATEGORIES = [
  "BestOverall",
  "SecurityChampion",
  "CostOptimizer",
  "BestArchitecture",
  "SpeedDemon",
];

export async function getAwards() {
  const container = getContainer("config");
  const { resources } = await container.items
    .query("SELECT * FROM c WHERE c.type = 'award'")
    .fetchAll();

  return {
    jsonBody: resources.map((doc) => ({
      category: doc.category,
      teamName: doc.teamName,
      assignedBy: doc.assignedBy,
      assignedAt: doc.assignedAt,
    })),
  };
}

export async function postAward(request) {
  const body = await request.json();
  const { category, teamName } = body;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return errorResponse(
      "VALIDATION_ERROR",
      `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
    );
  }

  if (!teamName) {
    return errorResponse("VALIDATION_ERROR", "Missing teamName");
  }

  // Verify team exists
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
  const assignedBy = principal?.userDetails || "admin";
  const now = new Date().toISOString();

  const container = getContainer("config");
  await container.items.upsert({
    id: `award_${category}`,
    type: "award",
    category,
    teamName,
    assignedBy,
    assignedAt: now,
  });

  return {
    status: 201,
    jsonBody: {
      category,
      teamName,
      assignedBy,
      assignedAt: now,
    },
  };
}

export async function handleAwards(request, context) {
  switch (request.method) {
    case "GET":
      return getAwards(request, context);
    case "POST":
      return postAward(request, context);
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
