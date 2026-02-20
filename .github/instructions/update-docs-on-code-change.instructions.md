---
description: "Trigger conditions for updating documentation when code changes"
applyTo: "**/*.{js,mjs,cjs,html,css,bicep,sh}"
---

# Update Documentation on Code Change

## Purpose

Detect when code changes require documentation updates. This instruction
complements the docs and markdown instructions for formatting standards.

## Trigger Conditions

Check if documentation updates are needed when any of these occur:

### Always Trigger

- New features or capabilities are added
- Breaking changes are introduced
- Installation or setup procedures change
- CLI commands or scripts are added/modified
- Dependencies or requirements change

### Check and Update If Applicable

- API endpoints, methods, or interfaces change
- Configuration options or environment variables are modified
- Code examples in documentation become outdated
- Bicep module structure changes (new modules, renamed parameters)
- Frontend components or pages are added/removed

## What to Update

### README.md (root)

Update when:

- Project structure changes
- New capabilities are introduced
- Setup or installation procedures change

### docs/api-spec.md

Update when:

- API endpoints are added, removed, or modified
- Request/response schemas change
- Authentication requirements change

### docs/app-design.md

Update when:

- Architecture changes (new services, storage patterns)
- Frontend design patterns change
- Authentication flow changes

### docs/backlog.md

Update when:

- Features are completed (mark as done)
- New features are planned (add items)
- Priorities shift

## Verification

After updating documentation:

1. Verify all relative links resolve to existing files
2. Check that code examples match current implementation
3. Ensure API spec matches actual endpoint behavior
