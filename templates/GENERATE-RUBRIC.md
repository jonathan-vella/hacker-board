# Generate Scoring Rubric for a New Hackathon

Use this prompt with GitHub Copilot (or any LLM) to generate a HackerBoard-compatible
scoring rubric for a new hackathon event. The output will be a Markdown file that can
be uploaded directly to HackerBoard's Rubric Manager.

---

## Prompt

Copy everything below the line and paste it into Copilot Chat, replacing the
`{placeholders}` with your hackathon-specific details.

---

```text
You are a hackathon scoring rubric designer. Generate a scoring rubric in Markdown
format that is compatible with the HackerBoard scoring dashboard.

## Hackathon Details

- **Hackathon Name**: {e.g., Azure Agentic InfraOps Microhack}
- **Focus Area**: {e.g., Azure infrastructure automation with AI agents}
- **Duration**: {e.g., 4 hours, 1 day, 2 days}
- **Team Size**: {e.g., 3-5 people}
- **Target Audience**: {e.g., Cloud Solution Architects, DevOps Engineers}
- **Framework Alignment**: {e.g., Azure Well-Architected Framework (WAF)}

## Scoring Structure

Follow these MANDATORY rules:

1. **Base total MUST be 105 points** (or justify a different total)
2. **Bonus points MUST be 25 points max** (or justify a different total)
3. Categories should have 3-8 criteria each
4. Each criterion MUST have an integer point value
5. The sum of all criteria in a category MUST equal the category total
6. At most ONE category may be manually scored (e.g., a presentation/showcase)
7. Include a grading scale with 5 tiers (Outstanding ≥90%, Excellent ≥80%,
   Good ≥70%, Satisfactory ≥60%, Needs Improvement <60%)
8. Include 3-5 bonus items that reward going beyond requirements

## Categories to Include

{Describe 6-10 categories with approximate point weights. For example:}

1. **Requirements & Planning** (~20 pts) — quality of requirements gathering
2. **Architecture Design** (~25 pts) — solution architecture quality
3. **Implementation Quality** (~25 pts) — code/IaC quality
4. **Deployment Success** (~10 pts) — successful deployment to cloud
5. **Testing** (~5 pts) — load/integration testing
6. **Documentation** (~5 pts) — operations documentation
7. **Diagnostics** (~5 pts) — monitoring and troubleshooting
8. **Showcase/Presentation** (~10 pts) — team presentation (manual scoring)

## Bonus Items to Consider

{List bonus achievements that demonstrate excellence:}

- Zone Redundancy implementation
- Private Endpoints usage
- Multi-Region DR setup
- Managed Identities (no connection strings)
- CI/CD Pipeline automation

## Output Format

Generate the rubric as a single Markdown file with these EXACT sections in order:

1. Title with hackathon name
2. Important notice (single source of truth callout)
3. Scoring Overview table (Category | Points | Automated?)
4. Detailed Criteria — one H3 section per category with a criteria table
5. Bonus Points table (Enhancement | Points | Verification)
6. Score Sheet (empty scoring grid for facilitators)
7. Grading Scale table (Percentage | Grade with emoji)
8. Award Categories table (5 standard awards)

### Critical Format Rules for HackerBoard Parser

The rubric Markdown MUST follow these patterns so the HackerBoard parser can extract
categories, criteria, points, bonus items, and grading scale:

- Categories use `### N. Category Name (XX pts)` headings
- Criteria use `| Criterion Name | Points |` table rows
- Bonus items use `| Enhancement Name | +Points | Verification |` table rows
- Grading scale uses `| ≥XX% | Grade |` or `| <XX% | Grade |` table rows

### Reference Rubric

Use this as the structural reference (the "golden template"):

<attached_file>
templates/scoring-rubric.reference.md
</attached_file>

Adapt the CONTENT (categories, criteria names, point distributions) for the new
hackathon while keeping the STRUCTURE identical.
```

---

## Usage Instructions

1. **Copy the prompt** above (from `You are a hackathon scoring rubric designer...`
   to the end)
2. **Fill in the `{placeholders}`** with your hackathon-specific details
3. **Attach the reference rubric** — either paste it inline or reference
   `templates/scoring-rubric.reference.md`
4. **Run the prompt** in GitHub Copilot Chat (or any LLM)
5. **Review the output** — verify point totals add up correctly
6. **Upload to HackerBoard** — Go to Rubrics → Upload → paste/drop the `.md` file
7. **Activate** — the parser will extract categories, criteria, and grading scale

## Validation Checklist

After generating, verify:

- [ ] Base total matches sum of all category points
- [ ] Each category's criteria sum equals the category total
- [ ] Bonus total matches sum of all bonus items
- [ ] Max total = base total + bonus total
- [ ] Grading scale has exactly 5 tiers with correct thresholds
- [ ] At most 1 manually-scored category
- [ ] All criteria tables follow `| Name | Points |` format
- [ ] All bonus items follow `| Name | +Points | Verification |` format
- [ ] Category headings follow `### N. Name (XX pts)` format
