using 'main.bicep'

param projectName = 'hacker-board'
param environment = 'prod'
param location = 'centralus'
param owner = 'agentic-infraops'
param costCenter = 'microhack'
param technicalContact = 'jonathan@lordofthecloud.eu'
param application = 'hacker-board'
param workload = 'web-app'
param sla = 'non-production'
param backupPolicy = 'none'
param maintWindow = 'any'

// Container image (updated by CI/CD after first push)
param containerImage = 'hacker-board:latest'

// Comma-separated admin identities: "github:username" or "aad:email"
// Override at deploy time for your environment
param adminUsers = 'github:jonathan-vella'

// gitHubOAuthClientId and gitHubOAuthClientSecret are @secure() —
// supply at deploy time via --parameters override, never commit secrets
