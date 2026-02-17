import { describe, it, expect } from "vitest";
import {
  parseRubricMarkdown,
  RubricParseError,
} from "../shared/rubricParser.js";

const VALID_RUBRIC = `# Hackathon Rubric

## Innovation & Creativity

- Originality of idea - 10 points
- Creative use of technology - 10 points
- Problem-solving approach - 10 points

## Technical Implementation

- Code quality & organization - 10 points
- Functionality & completeness - 10 points
- Use of Azure services - 10 points

## Impact & Usefulness

- Real-world applicability - 10 points
- Scalability potential - 8 points
- User experience - 7 points

## Presentation & Demo

- Clarity of presentation - 10 points
- Live demo quality - 10 points

## Bonus Enhancements

- Uses AI/ML services - 5 points
- Open-source contribution - 5 points
- Accessibility compliance - 5 points
- CI/CD pipeline implemented - 5 points
- Documentation excellence - 5 points

## Grading Scale

- Exceptional - 95%
- Outstanding - 90%
- Excellent - 85%
- Very Good - 80%
- Good - 75%
- Above Average - 70%
- Average - 65%
- Satisfactory - 60%
`;

describe("rubricParser", () => {
  describe("valid rubric", () => {
    it("extracts categories with criteria and points", () => {
      const result = parseRubricMarkdown(VALID_RUBRIC);

      expect(result.categories).toHaveLength(4);
      expect(result.categories[0].name).toBe("Innovation & Creativity");
      expect(result.categories[0].maxPoints).toBe(30);
      expect(result.categories[0].criteria).toHaveLength(3);
      expect(result.categories[0].criteria[0]).toEqual({
        name: "Originality of idea",
        maxPoints: 10,
      });
    });

    it("extracts bonus items with points", () => {
      const result = parseRubricMarkdown(VALID_RUBRIC);

      expect(result.bonusItems).toHaveLength(5);
      expect(result.bonusItems[0]).toEqual({
        name: "Uses AI/ML services",
        points: 5,
      });
    });

    it("extracts grading scale with thresholds", () => {
      const result = parseRubricMarkdown(VALID_RUBRIC);

      expect(result.gradingScale).toHaveLength(8);
      expect(result.gradingScale[0]).toEqual({
        grade: "Exceptional",
        minPercent: 95,
      });
      expect(result.gradingScale[7]).toEqual({
        grade: "Satisfactory",
        minPercent: 60,
      });
    });

    it("calculates baseTotal from category max points", () => {
      const result = parseRubricMarkdown(VALID_RUBRIC);
      // 30 + 30 + 25 + 20 = 105
      expect(result.baseTotal).toBe(105);
    });

    it("calculates bonusTotal from bonus items", () => {
      const result = parseRubricMarkdown(VALID_RUBRIC);
      expect(result.bonusTotal).toBe(25);
    });

    it("validates baseTotal matches sum of category max points", () => {
      const result = parseRubricMarkdown(VALID_RUBRIC);
      const calculatedBase = result.categories.reduce(
        (sum, c) => sum + c.maxPoints,
        0,
      );
      expect(result.baseTotal).toBe(calculatedBase);
    });
  });

  describe("malformed rubric", () => {
    it("throws on empty input", () => {
      expect(() => parseRubricMarkdown("")).toThrow(RubricParseError);
    });

    it("throws on undefined input", () => {
      expect(() => parseRubricMarkdown(undefined)).toThrow(RubricParseError);
    });

    it("throws when no categories found", () => {
      expect(() => parseRubricMarkdown("Some text without headers")).toThrow(
        "No categories found",
      );
    });

    it("throws when category has no criteria", () => {
      const md = `## Empty Category\n\nNo bullet points here.\n\n## Has Criteria\n\n- Item - 10 points`;
      expect(() => parseRubricMarkdown(md)).toThrow("has no criteria");
    });
  });

  describe("alternative formats", () => {
    it("handles colon-separated criteria", () => {
      const md = `## Category One\n\n- Criterion A: 10 points\n- Criterion B: 5 pts`;
      const result = parseRubricMarkdown(md);
      expect(result.categories[0].criteria).toHaveLength(2);
      expect(result.categories[0].maxPoints).toBe(15);
    });

    it("handles parenthesized points", () => {
      const md = `## Category One\n\n- Criterion A (10)\n- Criterion B (5)`;
      const result = parseRubricMarkdown(md);
      expect(result.categories[0].maxPoints).toBe(15);
    });
  });
});
