using 'main.bicep'

param projectName = 'hacker-board'
param environment = 'prod'
param location = 'centralus'

// Tag values — update to match your organisation before deploying.
param owner = 'your-team-name'
param costCenter = 'your-cost-center'
// param technicalContact = 'you@company.com'   // REQUIRED — no default; pass via deploy.ps1 or override here
param application = 'hacker-board'
param workload = 'web-app'
param sla = 'non-production'
param backupPolicy = 'none'
param maintWindow = 'any'

// Fallback used only on first-ever infra deploy before CI/CD has run.
// Every subsequent deploy, the GitHub Actions workflow calls
// `az webapp config container set` with the exact commit SHA tag —
// so this value is immediately overridden and never used in practice.
param containerImage = 'hacker-board:latest'

// REQUIRED — no default. Comma-separated admin identities.
// Format: 'github:<username>' or 'aad:<email>'
// Examples: 'github:alice'  |  'github:alice,github:bob'  |  'aad:admin@company.com'
// Supply at deploy time via deploy.ps1 (prompted interactively) or override here.
// param adminUsers = 'github:<your-github-username>'

// uniqueSuffix — leave commented out to use the auto-derived value
// uniqueString(resourceGroup().id) → same RG always produces the same suffix → repeatable re-deploys.
// Override only when you need a specific 3-13 character alphanumeric suffix.
// param uniqueSuffix = 'abc123'

// gitHubOAuthClientId and gitHubOAuthClientSecret are @secure() —
// supply at deploy time via deploy.ps1 parameters, never commit secrets
