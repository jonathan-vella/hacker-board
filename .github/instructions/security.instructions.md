---
description: 'Security and OWASP best practices for all code'
applyTo: '**'
---

# Secure Coding and OWASP Guidelines

Ensure all code is secure by default. When in doubt, choose the more secure option.

## A01: Broken Access Control

- Enforce Principle of Least Privilege — default to most restrictive permissions
- Deny by Default — access only granted with explicit allow rules
- Validate all incoming URLs to prevent SSRF
- Sanitize file paths to prevent directory traversal attacks

## A02: Cryptographic Failures

- Use strong, modern algorithms (Argon2/bcrypt for hashing, AES-256 for encryption)
- Always default to HTTPS for network requests
- Never hardcode secrets — use environment variables or secret stores

```javascript
// GOOD: Load from environment
const apiKey = process.env.API_KEY;
```

## A03: Injection

- Use parameterized queries — never string-concatenate user input into queries
- Sanitize command-line input
- Prevent XSS: use `.textContent` over `.innerHTML`; sanitize HTML with DOMPurify when needed

## A05: Security Misconfiguration

- Disable verbose error messages in production
- Set security headers: Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options
- Use up-to-date dependencies; run `npm audit` regularly

## A07: Authentication Failures

- Generate new session IDs on login to prevent session fixation
- Configure cookies with `HttpOnly`, `Secure`, and `SameSite=Strict`
- Implement rate limiting for authentication endpoints

## A08: Data Integrity Failures

- Avoid deserializing untrusted data without validation
- Use JSON over binary formats for data from untrusted sources

## General

- Be explicit about security mitigations in comments when non-obvious
- Explain risks when identifying vulnerabilities during review
