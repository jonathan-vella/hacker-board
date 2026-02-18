import { app } from "@azure/functions";
import { query } from "../../shared/db.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import { getFlags, requireFeature } from "../../shared/featureFlags.js";
import {
  parseRubricMarkdown,
  RubricParseError,
} from "../../shared/rubricParser.js";
import { randomUUID } from "node:crypto";

async function getRubrics() {
  const result = await query(
    `SELECT id AS rubricId, name, version, baseTotal, bonusTotal, isActive, createdBy, createdAt
       FROM dbo.Rubrics
      ORDER BY createdAt DESC`,
  );
  return {
    jsonBody: result.recordset.map((row) => ({
      rubricId: row.rubricId,
      name: row.name,
      version: row.version,
      baseTotal: row.baseTotal,
      bonusTotal: row.bonusTotal,
      isActive: row.isActive === true || row.isActive === 1,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    })),
  };
}

async function getActiveRubric() {
  const result = await query(
    `SELECT id AS rubricId, name, version, categories, bonusItems, gradingScale,
            baseTotal, bonusTotal, createdBy, createdAt
       FROM dbo.Rubrics
      WHERE isActive = 1`,
  );

  if (result.recordset.length === 0) {
    return errorResponse(
      "RUBRIC_NOT_FOUND",
      "No active rubric configured",
      404,
    );
  }

  const row = result.recordset[0];
  return {
    jsonBody: {
      rubricId: row.rubricId,
      name: row.name,
      version: row.version,
      categories: JSON.parse(row.categories || "[]"),
      bonus: JSON.parse(row.bonusItems || "[]"),
      gradingScale: JSON.parse(row.gradingScale || "[]"),
      baseTotal: row.baseTotal,
      bonusTotal: row.bonusTotal,
      isActive: true,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    },
  };
}

async function createRubric(request) {
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

  const rubricId = randomUUID();
  const createdBy = principal?.userDetails || "admin";

  if (activate) {
    await query("UPDATE dbo.Rubrics SET isActive = 0 WHERE isActive = 1");
  }

  await query(
    `INSERT INTO dbo.Rubrics
       (id, name, version, baseTotal, bonusTotal, isActive, categories, bonusItems,
        gradingScale, sourceMarkdown, createdBy, createdAt)
     VALUES
       (@id, @name, 1, @baseTotal, @bonusTotal, @isActive, @categories, @bonusItems,
        @gradingScale, @sourceMarkdown, @createdBy, @createdAt)`,
    {
      id: rubricId,
      name,
      baseTotal: parsedRubric.baseTotal,
      bonusTotal: parsedRubric.bonusTotal,
      isActive: activate ? 1 : 0,
      categories: JSON.stringify(parsedRubric.categories),
      bonusItems: JSON.stringify(parsedRubric.bonusItems),
      gradingScale: JSON.stringify(parsedRubric.gradingScale),
      sourceMarkdown,
      createdBy,
      createdAt: new Date().toISOString(),
    },
  );

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

app.http("rubrics", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "rubrics",
  handler: async (request, context) => {
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
  },
});

app.http("rubrics-active", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "rubrics/active",
  handler: getActiveRubric,
});

const TABLE_NAME = "Rubrics";

async function getRubrics(request, context) {
  const client = getTableClient(TABLE_NAME);
  const rubrics = [];

  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'rubric'" },
  })) {
    rubrics.push({
      rubricId: entity.rowKey,
      name: entity.name,
      version: entity.version,
      baseTotal: entity.baseTotal,
      bonusTotal: entity.bonusTotal,
      isActive: entity.isActive || false,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
    });
  }

  // Sort by createdAt descending
  rubrics.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { jsonBody: rubrics };
}

async function getActiveRubric(request, context) {
  const client = getTableClient(TABLE_NAME);

  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'rubric'" },
  })) {
    if (entity.isActive) {
      return {
        jsonBody: {
          rubricId: entity.rowKey,
          name: entity.name,
          version: entity.version,
          categories: JSON.parse(entity.categories || "[]"),
          bonus: JSON.parse(entity.bonusItems || "[]"),
          gradingScale: JSON.parse(entity.gradingScale || "[]"),
          baseTotal: entity.baseTotal,
          bonusTotal: entity.bonusTotal,
          isActive: true,
          createdBy: entity.createdBy,
          createdAt: entity.createdAt,
        },
      };
    }
  }

  return errorResponse("RUBRIC_NOT_FOUND", "No active rubric configured", 404);
}

async function createRubric(request, context) {
  const flagsClient = getTableClient("Config");
  const flags = await getFlags(flagsClient);
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

  if (!name) {
    return errorResponse("VALIDATION_ERROR", "Missing rubric name");
  }

  if (!sourceMarkdown) {
    return errorResponse("VALIDATION_ERROR", "Missing sourceMarkdown content");
  }

  try {
    parsedRubric = parseRubricMarkdown(sourceMarkdown);
  } catch (err) {
    if (err instanceof RubricParseError) {
      return errorResponse("RUBRIC_PARSE_ERROR", err.message);
    }
    throw err;
  }

  const client = getTableClient(TABLE_NAME);
  const rubricId = randomUUID();
  const createdBy = principal?.userDetails || "admin";

  // Deactivate previous active rubric if activating this one
  if (activate) {
    for await (const entity of client.listEntities({
      queryOptions: { filter: "PartitionKey eq 'rubric'" },
    })) {
      if (entity.isActive) {
        await client.updateEntity(
          { partitionKey: "rubric", rowKey: entity.rowKey, isActive: false },
          "Merge",
        );
      }
    }
  }

  await client.upsertEntity({
    partitionKey: "rubric",
    rowKey: rubricId,
    name,
    version: 1,
    baseTotal: parsedRubric.baseTotal,
    bonusTotal: parsedRubric.bonusTotal,
    isActive: activate,
    categories: JSON.stringify(parsedRubric.categories),
    bonusItems: JSON.stringify(parsedRubric.bonusItems),
    gradingScale: JSON.stringify(parsedRubric.gradingScale),
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

app.http("rubrics", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "rubrics",
  handler: async (request, context) => {
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
  },
});

app.http("rubrics-active", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "rubrics/active",
  handler: getActiveRubric,
});
