---
description: "Code review guidelines with priority tiers, security checks, and structured comment formats"
applyTo: "**/*.{js,mjs,cjs,html,css,bicep}"
---

# Code Review Instructions

Structured code review guidelines for this repository. These complement
the language-specific instructions already in place:

- **Bicep**: `bicep.instructions.md` (AVM-first, naming, security)
- **Security**: `security.instructions.md` (OWASP, access control)
- **Accessibility**: `accessibility.instructions.md` (WCAG 2.2 AA)
- **HTML/CSS**: `html-css-style.instructions.md` (color, layout)
- **API**: `azure-functions-api.instructions.md` (Functions v4 patterns)

When reviewing code, apply these general guidelines **in addition to**
the language-specific rules. Language-specific instructions take
precedence on any conflicting point.

## Review Language

When performing a code review, respond in **English**.

## Review Priorities

When performing a code review, prioritize issues in the following order:

### CRITICAL (Block merge)

- **Security**: Vulnerabilities, exposed secrets, authentication/authorization issues
- **Correctness**: Logic errors, data corruption risks, race conditions
- **Breaking Changes**: API contract changes without versioning
- **Data Loss**: Risk of data loss or corruption

### IMPORTANT (Requires discussion)

- **Code Quality**: Severe violations of SOLID principles, excessive duplication
- **Test Coverage**: Missing tests for critical paths or new functionality
- **Performance**: Obvious performance bottlenecks (N+1 queries, memory leaks)
- **Architecture**: Significant deviations from established patterns
- **Accessibility**: WCAG 2.2 AA violations

### SUGGESTION (Non-blocking improvements)

- **Readability**: Poor naming, complex logic that could be simplified
- **Optimization**: Performance improvements without functional impact
- **Best Practices**: Minor deviations from conventions
- **Documentation**: Missing or incomplete comments/documentation

## General Review Principles

When performing a code review, follow these principles:

1. **Be specific**: Reference exact lines, files, and provide concrete examples
2. **Provide context**: Explain WHY something is an issue and the potential impact
3. **Suggest solutions**: Show corrected code when applicable, not just what's wrong
4. **Be constructive**: Focus on improving the code, not criticizing the author
5. **Recognize good practices**: Acknowledge well-written code and smart solutions
6. **Be pragmatic**: Not every suggestion needs immediate implementation
7. **Group related comments**: Avoid multiple comments about the same topic

## Code Quality Standards

When performing a code review, check for:

### Clean Code

- Descriptive and meaningful names for variables, functions, and classes
- Single Responsibility Principle: each function does one thing well
- DRY (Don't Repeat Yourself): no code duplication
- Functions should be small and focused (ideally < 20-30 lines)
- Avoid deeply nested code (max 3-4 levels)
- Avoid magic numbers and strings (use constants)
- Code should be self-documenting; comments only when necessary

### Examples

```javascript
// BAD: Poor naming and magic numbers
function calc(x, y) {
  if (x > 100) return y * 0.15;
  return y * 0.1;
}

// GOOD: Clear naming and constants
const PREMIUM_THRESHOLD = 100;
const PREMIUM_DISCOUNT_RATE = 0.15;
const STANDARD_DISCOUNT_RATE = 0.1;

function calculateDiscount(orderTotal, itemPrice) {
  const isPremiumOrder = orderTotal > PREMIUM_THRESHOLD;
  const discountRate = isPremiumOrder
    ? PREMIUM_DISCOUNT_RATE
    : STANDARD_DISCOUNT_RATE;
  return itemPrice * discountRate;
}
```

### Error Handling

- Proper error handling at appropriate levels
- Meaningful error messages
- No silent failures or ignored exceptions
- Fail fast: validate inputs early
- Use structured JSON error responses from API endpoints

### Examples

```javascript
// BAD: Silent failure and generic error
async function processScore(req) {
  try {
    const entity = await tableClient.getEntity(pk, rk);
    return entity;
  } catch {
    return undefined;
  }
}

// GOOD: Explicit error handling with structured response
async function processScore(req) {
  const { teamId, challengeId } = req.params;
  if (!teamId || !challengeId) {
    return {
      status: 400,
      jsonBody: { error: "teamId and challengeId are required" },
    };
  }

  try {
    return await tableClient.getEntity(teamId, challengeId);
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: `Score not found for team ${teamId}` },
      };
    }
    throw error;
  }
}
```

## Security Review

When performing a code review, check for security issues:

- **Sensitive Data**: No passwords, API keys, tokens, or PII in code or logs
- **Input Validation**: All user inputs are validated and sanitized
- **XSS Prevention**: Use `.textContent` over `.innerHTML`; sanitize with DOMPurify when needed
- **Authentication**: Proper authentication checks via SWA built-in auth
- **Authorization**: Verify user has permission to perform action
- **Dependency Security**: Check for known vulnerabilities in dependencies

### Examples

```javascript
// BAD: XSS vulnerability
element.innerHTML = userInput;

// GOOD: Safe text content
element.textContent = userInput;

// BAD: Exposed secret in code
const API_KEY = "sk_live_abc123xyz789";

// GOOD: Use environment variables
const API_KEY = process.env.API_KEY;
```

## Testing Standards

When performing a code review, verify test quality:

- **Coverage**: Critical paths and new functionality must have tests
- **Test Names**: Descriptive names that explain what is being tested
- **Test Structure**: Clear Arrange-Act-Assert pattern
- **Independence**: Tests should not depend on each other or external state
- **Assertions**: Use specific assertions, avoid generic assertTrue
- **Edge Cases**: Test boundary conditions, undefined values, empty collections

### Examples

```javascript
// BAD: Vague name and assertion
test("test1", () => {
  const result = calc(5, 10);
  expect(result).toBeTruthy();
});

// GOOD: Descriptive name and specific assertion
test("should return 10% discount for orders under threshold", () => {
  const orderTotal = 50;
  const itemPrice = 20;

  const discount = calculateDiscount(orderTotal, itemPrice);

  expect(discount).toBe(2.0);
});
```

## Performance Considerations

When performing a code review, check for performance issues:

- **Table Storage Queries**: Avoid scanning entire partitions; use proper partition/row keys
- **Caching**: Utilize caching for expensive or repeated operations
- **Resource Management**: Proper cleanup of connections and streams
- **Pagination**: Large result sets should be paginated
- **Frontend**: Minimize DOM operations, avoid layout thrashing

## Architecture and Design

When performing a code review, verify architectural principles:

- **Separation of Concerns**: Clear boundaries between API, storage, and frontend
- **Consistent Patterns**: Follow established patterns in the codebase
- **Loose Coupling**: Components should be independently testable
- **Functions over Classes**: Prefer functional patterns per project conventions
- **ESM Modules**: Use ES module imports, not CommonJS require

## Comment Format Template

When performing a code review, use this format for comments:

```markdown
**[PRIORITY] Category: Brief title**

Detailed description of the issue or suggestion.

**Why this matters:**
Explanation of the impact or reason for the suggestion.

**Suggested fix:**
[code example if applicable]
```

## Review Checklist

When performing a code review, systematically verify:

### Code Quality

- [ ] Code follows consistent style and conventions
- [ ] Names are descriptive and follow naming conventions
- [ ] Functions are small and focused
- [ ] No code duplication
- [ ] Error handling is appropriate
- [ ] No commented-out code or TODO without tickets

### Security

- [ ] No sensitive data in code or logs
- [ ] Input validation on all user inputs
- [ ] No XSS vulnerabilities (`.textContent` over `.innerHTML`)
- [ ] Authentication and authorization properly implemented
- [ ] Dependencies are up-to-date and secure

### Testing

- [ ] New code has appropriate test coverage
- [ ] Tests are well-named and focused
- [ ] Tests cover edge cases and error scenarios
- [ ] Tests are independent and deterministic

### Accessibility

- [ ] Semantic HTML used appropriately
- [ ] WCAG 2.2 Level AA compliance
- [ ] Keyboard navigation works for all interactive elements
- [ ] Color contrast meets minimum ratios

### Performance

- [ ] No obvious performance issues
- [ ] Efficient Table Storage queries
- [ ] Proper resource cleanup

### Architecture

- [ ] Follows established patterns and conventions
- [ ] Proper separation of concerns
- [ ] ESM modules used correctly
- [ ] API endpoints return structured JSON responses

## Project Context

This repository's primary tech stack:

- **Frontend**: Vanilla JavaScript SPA (ES2022+, no framework)
- **API**: Azure Functions v4, Node.js 20+, ESM modules
- **Storage**: Azure Table Storage via `@azure/data-tables`
- **Auth**: Azure Static Web Apps built-in GitHub OAuth
- **IaC**: Bicep (AVM-first)
- **CI/CD**: GitHub Actions
- **Testing**: Vitest
