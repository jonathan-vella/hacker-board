import { api } from "./api.js";

let cachedRubric;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

export async function getActiveRubric() {
  const now = Date.now();
  if (cachedRubric && now - cacheTimestamp < CACHE_TTL) {
    return cachedRubric;
  }

  try {
    cachedRubric = await api.rubrics.active();
    cacheTimestamp = now;
    return cachedRubric;
  } catch (err) {
    if (err.status === 404) return undefined;
    throw err;
  }
}

export function getGrade(percentage, rubric) {
  if (!rubric?.gradingScale) {
    return getDefaultGrade(percentage);
  }

  for (const tier of rubric.gradingScale) {
    if (percentage >= tier.minPercent) {
      return tier.grade;
    }
  }
  return "NEEDS IMPROVEMENT";
}

function getDefaultGrade(percentage) {
  if (percentage >= 90) return "OUTSTANDING";
  if (percentage >= 80) return "EXCELLENT";
  if (percentage >= 70) return "GOOD";
  if (percentage >= 60) return "SATISFACTORY";
  return "NEEDS IMPROVEMENT";
}

export function getGradeClass(grade) {
  const normalized = grade.toUpperCase().replace(/\s+/g, "-");
  const classMap = {
    OUTSTANDING: "grade-outstanding",
    EXCEPTIONAL: "grade-outstanding",
    EXCELLENT: "grade-excellent",
    GOOD: "grade-good",
    SATISFACTORY: "grade-satisfactory",
    "NEEDS-IMPROVEMENT": "grade-needs-improvement",
  };
  return classMap[normalized] || "grade-satisfactory";
}

export function clearRubricCache() {
  cachedRubric = undefined;
  cacheTimestamp = 0;
}
