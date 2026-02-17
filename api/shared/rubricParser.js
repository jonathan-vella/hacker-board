// Parses rubric markdown into structured JSON.
// Expected format: H2 headers for categories, bullet lists for criteria with point values,
// bonus section, and grading scale.

const CATEGORY_HEADER_RE = /^##\s+(.+)/;
const CRITERION_RE =
  /^[-*]\s+(.+?)(?:\s*[-–—]\s*|\s*:\s*|\s*\()\s*(\d+)\s*(?:points?|pts?|max)?\s*\)?/i;
const BONUS_RE =
  /^[-*]\s+(.+?)(?:\s*[-–—]\s*|\s*:\s*|\s*\()\s*(\d+)\s*(?:points?|pts?|bonus)?\s*\)?/i;
const GRADE_RE =
  /^[-*]\s+(.+?)(?:\s*[-–—]\s*|\s*:\s*)\s*(\d+)%?\s*(?:and above|minimum|\+|or higher)?/i;

export function parseRubricMarkdown(markdown) {
  if (!markdown || typeof markdown !== "string") {
    throw new RubricParseError("Rubric markdown content is required");
  }

  const lines = markdown.split("\n").map((l) => l.trim());
  const categories = [];
  const bonusItems = [];
  const gradingScale = [];

  let currentSection = undefined;
  let currentCategory = undefined;
  let inBonus = false;
  let inGrading = false;

  for (const line of lines) {
    if (!line) continue;

    const headerMatch = line.match(CATEGORY_HEADER_RE);
    if (headerMatch) {
      const title = headerMatch[1].trim();
      const lowerTitle = title.toLowerCase();

      if (lowerTitle.includes("bonus") || lowerTitle.includes("enhancement")) {
        inBonus = true;
        inGrading = false;
        currentCategory = undefined;
        continue;
      }

      if (
        lowerTitle.includes("grading") ||
        lowerTitle.includes("scale") ||
        lowerTitle.includes("grade")
      ) {
        inGrading = true;
        inBonus = false;
        currentCategory = undefined;
        continue;
      }

      // Skip non-category headers like title or intro
      if (
        lowerTitle.includes("rubric") &&
        categories.length === 0 &&
        !currentCategory
      ) {
        continue;
      }

      inBonus = false;
      inGrading = false;
      currentCategory = { name: title, maxPoints: 0, criteria: [] };
      categories.push(currentCategory);
      continue;
    }

    if (inGrading) {
      const gradeMatch = line.match(GRADE_RE);
      if (gradeMatch) {
        gradingScale.push({
          grade: gradeMatch[1].trim(),
          minPercent: parseInt(gradeMatch[2], 10),
        });
      }
      continue;
    }

    if (inBonus) {
      const bonusMatch = line.match(BONUS_RE);
      if (bonusMatch) {
        bonusItems.push({
          name: bonusMatch[1].trim(),
          points: parseInt(bonusMatch[2], 10),
        });
      }
      continue;
    }

    if (currentCategory) {
      const criterionMatch = line.match(CRITERION_RE);
      if (criterionMatch) {
        const points = parseInt(criterionMatch[2], 10);
        currentCategory.criteria.push({
          name: criterionMatch[1].trim(),
          maxPoints: points,
        });
        currentCategory.maxPoints += points;
      }
    }
  }

  if (categories.length === 0) {
    throw new RubricParseError("No categories found in rubric markdown");
  }

  const baseTotal = categories.reduce((sum, c) => sum + c.maxPoints, 0);
  const bonusTotal = bonusItems.reduce((sum, b) => sum + b.points, 0);

  // Validate that each category has at least one criterion
  for (const category of categories) {
    if (category.criteria.length === 0) {
      throw new RubricParseError(`Category '${category.name}' has no criteria`);
    }

    // Validate maxPoints matches sum of criteria
    const criteriaSum = category.criteria.reduce(
      (sum, c) => sum + c.maxPoints,
      0,
    );
    if (criteriaSum !== category.maxPoints) {
      throw new RubricParseError(
        `Category '${category.name}' maxPoints (${category.maxPoints}) does not match criteria sum (${criteriaSum})`,
      );
    }
  }

  // Sort grading scale by minPercent descending
  gradingScale.sort((a, b) => b.minPercent - a.minPercent);

  return {
    categories,
    bonusItems,
    gradingScale,
    baseTotal,
    bonusTotal,
  };
}

export class RubricParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "RubricParseError";
  }
}
