---
description: 'Node.js Azure Functions API patterns'
applyTo: 'api/**/*.js,api/**/*.json'
---

## Azure Functions Guidance

- Use `async/await` for all asynchronous code
- Use Node.js v20+ built-in modules instead of external packages whenever possible
- Always use Node.js async functions, like `node:fs/promises` instead of `fs` to avoid blocking the event loop
- Ask before adding any extra dependencies to the project
- The API is built using Azure Functions using `@azure/functions@4` package
- Each endpoint should have its own function file
- When making changes to the API, make sure to update documentation accordingly

## Node.js / JavaScript Standards

- Use JavaScript with ES2022 features and Node.js 20+ ESM modules
- Keep the code simple and maintainable
- Use descriptive variable and function names
- Do not add comments unless absolutely necessary — the code should be self-explanatory
- Never use `null`, always use `undefined` for optional values
- Prefer functions over classes

## Error Handling

- Return structured JSON error responses with appropriate HTTP status codes
- Use consistent error response format: `{ error: { code, message } }`
- Log errors for debugging but never expose stack traces to clients

## Security

- Validate and sanitize all input data
- Use parameterized queries / safe SDK methods — no string concatenation for queries
- Never hardcode secrets; use environment variables
- Check authentication via `x-ms-client-principal` header from Static Web Apps auth

## Testing

- Use Vitest for testing
- Write tests for all new features and bug fixes
- Ensure tests cover edge cases and error handling
- Never change the original code to make it easier to test
