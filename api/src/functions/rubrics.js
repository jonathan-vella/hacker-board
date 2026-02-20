import { getContainer } from "../../shared/cosmos.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { getFlags, requireFeature } from "../../shared/featureFlags.js";
import {
  parseRubricMarkdown,
  RubricParseError,
} from "../../shared/rubricParser.js";
import { randomUUID } from "node:crypto";

export async function getRubrics() {
  const container = getContainer("rubrics");
  const { resources } = await container.items
    .query(
      "SELECT c.id AS rubricId, c.name, c.version, c.baseTotal, c.bonusTotal, c.isActive, c.createdBy, c.createdAt FROM c ORDER BY c.createdAt DESC",
    )
    .fetchAll();

  return {
    jsonBody: resources.map((doc) => ({
      rubricId: doc.rubricId,
      name: doc.name,
      version: doc.version,
      baseTotal: doc.baseTotal,
      bonusTotal: doc.bonusTotal,
      isActive: doc.isActive === true,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
    })),
  };
}

export async function getActiveRubric() {
  const container = getContainer("rubrics");
  const { resources } = await container.items
    .query("SELECT * FROM c WHERE c.isActive = true")
    .fetchAll();

  if (resources.length === 0) {
    return errorResponse(
      "RUBRIC_NOT_FOUND",
      "No active rubric configured",
      404,
    );
  }

  const doc = resources[0];
  return {
    jsonBody: {
      rubricId: doc.id,
      name: doc.name,
      version: doc.version,
      categories: doc.categories || [],
      bonus: doc.bonusItems || [],
      gradingScale: doc.gradingScale || [],
      baseTotal: doc.baseTotal,
      bonusTotal: doc.bonusTotal,
      isActive: true,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
    },
  };
}

export async function createRubric(request) {
  const flags = await getFlags();
  const disabled = requireFeature(flags, "RUBRIC_UPLOAD_ENABLED");
  if (disabled) return disabled;

  const principal = getClientPrincipal(request);
  const contentType = request.headers.get("content-type") || "";
  let name, sourceMarkdown, activate, parsedRubric;

  if (contentType.includes("text/markdown")) {
    sourceMarkdown = await request.text();
    name = "Uploaded Rubric";
    activate = true;
  } else {
    const body = await request.json();
    name = body.name;
    sourceMarkdown = body.sourceMarkdown;
    activate = body.activate !== false;
  }

  if (!name) return errorResponse("VALIDATION_ERROR", "Missing rubric name");
  if (!sourceMarkdown)
    return errorResponse("VALIDATION_ERROR", "Missing sourceMarkdown content");

  try {
    parsedRubric = parseRubricMarkdown(sourceMarkdown);
  } catch (err) {
    if (err instanceof RubricParseError) {
      return errorResponse("RUBRIC_PARSE_ERROR", err.message);
    }
    throw err;
  }

  const container = getContainer("rubrics");
  const rubricId = randomUUID();
  const createdBy = principal?.userDetails || "admin";

  // Deactivate previous active rubric
  if (activate) {
    const { resources: activeRubrics } = await container.items
      .query("SELECT * FROM c WHERE c.isActive = true")
      .fetchAll();

    for (const rubric of activeRubrics) {
      rubric.isActive = false;
      await container.item(rubric.id, rubric.id).replace(rubric);
    }
  }

  await container.items.create({
    id: rubricId,
    name,
    version: 1,
    baseTotal: parsedRubric.baseTotal,
    bonusTotal: parsedRubric.bonusTotal,
    isActive: activate,
    categories: parsedRubric.categories,
    bonusItems: parsedRubric.bonusItems,
    gradingScale: parsedRubric.gradingScale,
    sourceMarkdown,
    createdBy,
    createdAt: new Date().toISOString(),
  });

  return {
    status: 201,
    jsonBody: {
      rubricId,
      name,
      baseTotal: parsedRubric.baseTotal,
      bonusTotal: parsedRubric.bonusTotal,
      isActive: activate,
      categoriesCount: parsedRubric.categories.length,
      bonusCount: parsedRubric.bonusItems.length,
      message: activate ? "Rubric created and activated" : "Rubric created",
    },
  };
}

export async function handleRubrics(request, context) {
  switch (request.method) {
    case "GET":
      return getRubrics(request, context);
    case "POST":
      return createRubric(request, context);
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
