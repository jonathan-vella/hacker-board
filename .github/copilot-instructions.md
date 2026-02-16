# HackerBoard — Copilot Custom Instructions

## Project Overview

HackerBoard is a live, interactive hackathon scoring dashboard built on **Azure Static Web Apps (Standard)** with **managed Azure Functions** (Node.js 20+) for the API layer and **Azure Table Storage** for persistence. Authentication uses the built-in GitHub OAuth provider.

## Tech Stack

- **Frontend**: Vanilla JavaScript SPA (ES2022+, no framework), single `index.html`
- **API**: Azure Functions v4 programming model, Node.js 20+, ESM modules
- **Storage**: Azure Table Storage via `@azure/data-tables` SDK
- **Auth**: Azure Static Web Apps built-in GitHub OAuth (`.auth/` endpoints)
- **IaC**: Bicep (Azure Verified Modules where available)
- **CI/CD**: GitHub Actions → Azure Static Web Apps deployment

## Coding Standards

- Use JavaScript with ES2022+ features and Node.js ESM modules
- Use `async/await` for all asynchronous code
- Prefer Node.js built-in modules (`node:fs/promises`, `node:crypto`, etc.) over external packages
- Ask before adding any new dependencies
- Never use `null`; use `undefined` for optional values
- Prefer functions over classes
- Write self-explanatory code; comment only to explain WHY, not WHAT
- Use descriptive variable and function names

## API Conventions

- Each API endpoint lives in its own file under `api/`
- Use Azure Functions v4 `@azure/functions` patterns
- Validate all inputs; return structured JSON error responses
- Never hardcode secrets; use environment variables or Azure Key Vault references
- Use parameterized queries / safe SDK methods — no string-interpolated queries

## Frontend Conventions

- Use semantic HTML (`header`, `nav`, `main`, `footer`, `section`, `article`)
- Follow WCAG 2.2 Level AA accessibility standards
- Use `.textContent` over `.innerHTML` to prevent XSS; sanitize with DOMPurify when HTML is needed
- Apply the 60-30-10 color rule (cool primary/secondary, hot accent)
- Ensure all interactive elements are keyboard operable with visible focus indicators

## Infrastructure Conventions

- Use lowerCamelCase for all Bicep names
- Declare parameters at the top with `@description` decorators
- Use latest stable API versions
- Use symbolic names for resource references (not `reference()` or `resourceId()`)
- Never output secrets in Bicep outputs
- Use Azure Verified Modules (`br/public:avm/res/...`) where available

## Security

- Follow OWASP Top 10 guidelines
- Deny by default for access control
- Always use HTTPS
- Set security headers (CSP, HSTS, X-Content-Type-Options)
- Never hardcode API keys, passwords, or connection strings
- Sanitize all user input to prevent injection attacks

## Testing

- Use Vitest for JavaScript/Node.js testing
- Write tests for all new features and bug fixes
- Never modify production code solely to make it easier to test
