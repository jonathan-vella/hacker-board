import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getContainer } from "../../shared/cosmos.js";
import { getClientPrincipal } from "../../shared/auth.js";
import { errorResponse } from "../../shared/errors.js";
import {
  parseRubricMarkdown,
  RubricParseError,
} from "../../shared/rubricParser.js";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "..", "..", "templates");

// Extract the H1 title from a rubric markdown file
function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : undefined;
}

export async function listTemplates() {
  const files = await readdir(TEMPLATES_DIR);
  const templates = [];

  for (const file of files) {
    if (!file.endsWith(".md") || file.startsWith("GENERATE-")) continue;
    const slug = file.replace(/\.md$/, "");
    const md = await readFile(join(TEMPLATES_DIR, file), "utf8");
    const title = extractTitle(md);

    try {
      const parsed = parseRubricMarkdown(md);
      templates.push({
        slug,
        name: title || slug,
        baseTotal: parsed.baseTotal,
        bonusTotal: parsed.bonusTotal,
        categoriesCount: parsed.categories.length,
      });
    } catch {
      // Skip templates that fail to parse
    }
  }

  return { jsonBody: templates };
}

export async function activateTemplate(request) {
  const slug = request.params?.slug;
  if (!slug || /[/\\]/.test(slug)) {
    return errorResponse("VALIDATION_ERROR", "Invalid template name");
  }

  const filePath = join(TEMPLATES_DIR, `${slug}.md`);
  let sourceMarkdown;
  try {
    sourceMarkdown = await readFile(filePath, "utf8");
  } catch {
    return errorResponse(
      "TEMPLATE_NOT_FOUND",
      `Template '${slug}' not found`,
      404,
    );
  }

  let parsedRubric;
  try {
    parsedRubric = parseRubricMarkdown(sourceMarkdown);
  } catch (err) {
    if (err instanceof RubricParseError) {
      return errorResponse("RUBRIC_PARSE_ERROR", err.message);
    }
    throw err;
  }

  const principal = getClientPrincipal(request);
  const createdBy = principal?.userDetails || "admin";
  const name = extractTitle(sourceMarkdown) || slug;
  const container = getContainer("rubrics");

  // Deactivate all current rubrics
  const { resources: activeRubrics } = await container.items
    .query("SELECT * FROM c WHERE c.isActive = true")
    .fetchAll();

  for (const rubric of activeRubrics) {
    rubric.isActive = false;
    await container.item(rubric.id, rubric.id).replace(rubric);
  }

  const rubricId = randomUUID();
  await container.items.create({
    id: rubricId,
    name,
    version: 1,
    baseTotal: parsedRubric.baseTotal,
    bonusTotal: parsedRubric.bonusTotal,
    isActive: true,
    categories: parsedRubric.categories,
    bonusItems: parsedRubric.bonusItems,
    gradingScale: parsedRubric.gradingScale,
    sourceMarkdown,
    templateSlug: slug,
    createdBy,
    createdAt: new Date().toISOString(),
  });

  return {
    status: 201,
    jsonBody: {
      rubricId,
      name,
      templateSlug: slug,
      baseTotal: parsedRubric.baseTotal,
      bonusTotal: parsedRubric.bonusTotal,
      isActive: true,
      categoriesCount: parsedRubric.categories.length,
      message: `Template '${name}' activated`,
    },
  };
}
