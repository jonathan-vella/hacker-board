# {{HACKATHON_NAME}} — Scoring Rubric

> [!IMPORTANT]
> This file is the **single source of truth** for all scoring values.
> The app PRD, challenge files, scripts, and all other docs MUST derive their
> point values and grading rules from this rubric. If a conflict exists
> elsewhere, this file wins.

> **{{BASE_TOTAL}}-point base + {{BONUS_TOTAL}} bonus** | {{FRAMEWORK_NAME}}-aligned | 🤖 Script-assisted + facilitator scoring

> **Note**: {{MANUAL_SCORING_NOTE}}

---

## Scoring Overview

| Category | Points | Automated? |
| -------- | ------ | ---------- |

{{#each CATEGORIES}}
| {{this.name}} | {{this.points}} | {{this.automated}} |
{{/each}}
| **Base Total** | **{{BASE_TOTAL}}** | |
| **Bonus Points** | +{{BONUS_TOTAL}} | ✅ |
| **Max Total** | **{{MAX_TOTAL}}** | |

---

## Detailed Criteria

{{#each CATEGORIES}}

### {{@index_1}}. {{this.name}} ({{this.points}} pts)

{{#if this.file_reference}}
**File**: `{{this.file_reference}}`
{{/if}}

{{#if this.scoring_method}}
**Scoring method**: {{this.scoring_method}}
{{/if}}

| Criterion | Points |
| --------- | ------ |

{{#each this.criteria}}
| {{this.name}} | {{this.points}} |
{{/each}}

{{/each}}

---

## Bonus Points (+{{BONUS_TOTAL}} max)

| Enhancement | Points | Verification |
| ----------- | ------ | ------------ |

{{#each BONUS_ITEMS}}
| {{this.name}} | +{{this.points}} | {{this.verification}} |
{{/each}}

---

## Score Sheet

| Team | {{#each CATEGORIES}}{{this.short_name}} | {{/each}}Bonus | Total |
| --- | {{#each CATEGORIES}}--- | {{/each}}--- | --- |
| 1 | {{#each CATEGORIES}}/{{this.points}} | {{/each}} | /{{BASE_TOTAL}} |
| 2 | {{#each CATEGORIES}}/{{this.points}} | {{/each}} | /{{BASE_TOTAL}} |
| 3 | {{#each CATEGORIES}}/{{this.points}} | {{/each}} | /{{BASE_TOTAL}} |
| 4 | {{#each CATEGORIES}}/{{this.points}} | {{/each}} | /{{BASE_TOTAL}} |

---

## Grading Scale

Percentage is calculated from the {{BASE_TOTAL}}-point base score.
Bonus points are additive to the total but do not affect the grade tier.

| Percentage | Grade                |
| ---------- | -------------------- |
| ≥90%       | 🏆 OUTSTANDING       |
| ≥80%       | 🥇 EXCELLENT         |
| ≥70%       | 🥈 GOOD              |
| ≥60%       | 🥉 SATISFACTORY      |
| <60%       | 📚 NEEDS IMPROVEMENT |

---

## Award Categories (Optional)

| Award                | Criteria                        |
| -------------------- | ------------------------------- |
| 🏆 Best Overall      | Highest total                   |
| 🛡️ Security Champion | Best security                   |
| 💰 Cost Optimizer    | Best efficiency                 |
| 📐 Best Architecture | Most {{FRAMEWORK_NAME}}-aligned |
| 🚀 Speed Demon       | First to deploy                 |
