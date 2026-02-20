---
description: "Documentation and content creation standards for markdown files"
applyTo: "**/*.md"
---

# Markdown Documentation Standards

Standards for creating consistent, accessible, and well-structured
markdown documentation.

## General Instructions

- Use ATX-style headings (`##`, `###`) — never use H1 (`#`) in content
  (reserved for document title)
- Limit line length to 120 characters where practical
- Use LF line endings
- Include meaningful alt text for all images
- Each file has exactly ONE H1 heading (the title). Use H2+ for all
  other sections

## Content Structure

| Element     | Rule                                     | Example                     |
| ----------- | ---------------------------------------- | --------------------------- |
| Headings    | Use `##` for H2, `###` for H3, avoid H4+ | `## Section Title`          |
| Lists       | Use `-` for unordered, `1.` for ordered  | `- Item one`                |
| Code blocks | Use fenced blocks with language          | ` ```javascript `           |
| Links       | Descriptive text, valid URLs             | `[Azure docs](https://...)` |
| Tables      | Align columns, include headers           | See examples below          |

## Code Blocks

Specify the language after opening backticks for syntax highlighting:

````markdown
```javascript
const app = require("@azure/functions");
```
````

Never omit the language specifier on fenced code blocks.

## Line Length Guidelines

When lines exceed 120 characters:

1. **Sentences**: Break after punctuation (period, comma, em-dash)
2. **Lists**: Break after the list marker or continue on next line
   with indentation
3. **Links**: Break before `[` or use reference-style links for long URLs
4. **Code spans**: If unavoidable, use a code block instead

## Callout Types

Use GitHub-flavored callouts for emphasis:

```markdown
> [!NOTE]
> Informational — background context

> [!TIP]
> Best practice recommendation

> [!IMPORTANT]
> Critical requirement

> [!WARNING]
> Security or reliability concern

> [!CAUTION]
> Data loss risk or irreversible action
```

## Collapsible Sections

Use for lengthy content (tables >10 rows, code examples, appendix):

```markdown
<details>
<summary>Detailed Configuration</summary>

| Setting | Value |
| ------- | ----- |
| ...     | ...   |

</details>
```

## Lists and Formatting

- Use `-` for bullet points (not `*` or `+`)
- Use `1.` for numbered lists (auto-increment)
- Indent nested lists with 2 spaces
- Add blank lines before and after lists

## Tables

- Include header row with alignment
- Keep columns aligned for readability
- Use tables for structured comparisons

```markdown
| Resource | Purpose    | Example        |
| -------- | ---------- | -------------- |
| Storage  | Table data | `stcontosodev` |
```

## Links and References

- Use descriptive link text (not "click here")
- Verify all links are valid and accessible
- Prefer relative paths for internal links

```markdown
<!-- GOOD -->

See the [API specification](docs/api-spec.md) for endpoint details.

<!-- BAD -->

Click [here](docs/api-spec.md) for more info.
```

## Patterns to Avoid

| Anti-Pattern              | Problem                | Solution                   |
| ------------------------- | ---------------------- | -------------------------- |
| H1 in content             | Conflicts with title   | Use H2 (`##`) as top level |
| Deep nesting (H4+)        | Hard to navigate       | Restructure content        |
| Long lines (>120 chars)   | Poor readability       | Break at natural clauses   |
| Missing code language     | No syntax highlighting | Specify language           |
| "Click here" links        | Poor accessibility     | Use descriptive text       |
| Inconsistent list markers | Messy appearance       | Use `-` consistently       |
