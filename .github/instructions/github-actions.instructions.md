---
applyTo: ".github/workflows/*.yml,.github/workflows/*.yaml"
description: "Standards for GitHub Actions workflows in this repository"
---

# GitHub Actions Workflow Standards

Standards for creating and maintaining CI/CD workflows in this repository.

## Project Conventions

### Runner and Node.js

- **Runner**: `ubuntu-latest` for all jobs
- **Node.js**: Version `20` with `npm` caching
- **Dependencies**: `npm ci` (not `npm install`)

### Permissions

- Set `permissions` at workflow level (least privilege)
- Default: `contents: read`
- Add write permissions only when needed

### Triggers

- **PR validation**: Trigger on `pull_request` to `main`
- **Post-merge**: Trigger on `push` to `main`
- **Path filters**: Use `paths:` to scope workflows to relevant files
- **Manual**: Include `workflow_dispatch` for on-demand runs

### Action Versions

- Pin to **major version tags** (e.g., `@v4`), not `@main` or `@latest`
- Use current versions:

| Action                      | Version |
| --------------------------- | ------- |
| `actions/checkout`          | `@v4`   |
| `actions/setup-node`        | `@v4`   |
| `actions/upload-artifact`   | `@v4`   |
| `actions/download-artifact` | `@v4`   |
| `actions/cache`             | `@v4`   |

### Naming and Structure

- **Workflow file**: Descriptive kebab-case (e.g., `ci.yml`, `deploy.yml`)
- **Workflow `name`**: Human-readable title
- **Job `name`**: Clear, concise label
- **Step `name`**: Descriptive action (e.g., "Run Vitest tests")

### Concurrency

Use `concurrency` to prevent duplicate runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Deployment

Azure Static Web Apps deployment uses the official action:

```yaml
- uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    action: "upload"
    app_location: "/src"
    api_location: "/api"
    output_location: ""
```

## Security

- Use OIDC for Azure authentication where possible (no long-lived secrets)
- Use `permissions: contents: read` as the default
- Enable Dependabot for action version updates
- Never print secrets or tokens in workflow logs

## Patterns to Avoid

| Anti-Pattern                    | Solution                                   |
| ------------------------------- | ------------------------------------------ |
| Pinning to `@main` or `@latest` | Use `@v4` major version tags               |
| `npm install` in CI             | Use `npm ci` for deterministic installs    |
| Missing `permissions` block     | Always declare least-privilege permissions |
| Broad triggers (no path filter) | Scope with `paths:` to relevant files      |
| `actions/upload-artifact@v3`    | Use `@v4` (v3 is deprecated)               |
