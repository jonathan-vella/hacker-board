---
description: 'Self-explanatory code commenting guidelines'
applyTo: '**'
---

# Self-explanatory Code Commenting

**Core Principle:** Write code that speaks for itself. Comment only when necessary to explain WHY, not WHAT.

## Avoid These Comment Types

- **Obvious comments:** `let counter = 0; // Initialize counter to zero`
- **Redundant comments:** Restating what the code already says
- **Dead code comments:** Don't comment out code — delete it (use git history)
- **Changelog comments:** Don't maintain history in comments — use git
- **Divider comments:** Avoid decorative separator comments

## Write These Comment Types

- **Complex business logic:** Explain WHY this specific calculation or approach
- **Non-obvious algorithms:** Explain the algorithm choice and reasoning
- **Regex patterns:** Explain what the pattern matches
- **API constraints or gotchas:** Document external system limitations
- **Configuration constants:** Explain the source or reasoning for magic numbers

## Decision Framework

Before writing a comment, ask:
1. Is the code self-explanatory? → No comment needed
2. Would a better name eliminate the need? → Refactor instead
3. Does this explain WHY, not WHAT? → Good comment
4. Will this help future maintainers? → Good comment

## Annotations

Use standard annotations for actionable items:

```javascript
// TODO: Replace with proper auth after security review
// FIXME: Memory leak — investigate connection pooling
// HACK: Workaround for library bug v2.1.0 — remove after upgrade
// NOTE: Assumes UTC timezone for all calculations
// SECURITY: Validate input before using in query
```

## Public API Documentation

Use JSDoc for exported/public functions with `@param`, `@returns`, and a description.
