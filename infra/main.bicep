targetScope = 'resourceGroup'

// ──────────────────────────────────────────────────────────────────────────────
// Parameters
// ──────────────────────────────────────────────────────────────────────────────

@description('Project name used in resource naming.')
param projectName string = 'hacker-board'

@allowed(['dev', 'staging', 'prod'])
@description('Deployment environment.')
param environment string = 'prod'

@description('Primary Azure region for all resources.')
param location string = 'westeurope'

@description('Resource owner identifier.')
param owner string = 'microhack-agentic-infraops'

@description('Cost center code required by Azure Policy.')
param costCenter string = 'microhack-agentic-infraops'

@description('Technical contact email required by Azure Policy.')
param technicalContact string

@description('GitHub repository URL for Static Web App source linkage.')
param repositoryUrl string = 'https://github.com/jonathan-vella/hacker-board'

@description('GitHub repository branch for Static Web App.')
param repositoryBranch string = 'main'

@allowed(['all', 'foundation', 'application'])
@description('Deployment phase — use to deploy incrementally.')
param phase string = 'all'

@description('Deployment timestamp for unique nested deployment names. Prevents DeploymentActive collisions on retries.')
param deploymentTimestamp string = utcNow('yyyyMMddHHmmss')

// ──────────────────────────────────────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────────────────────────────────────

@description('Unique suffix derived from resource group ID for globally unique names.')
var uniqueSuffix = uniqueString(resourceGroup().id)

@description('All 9 tags required by JV-Enforce Resource Group Tags v3 Deny policy.')
var tags = {
  environment: environment
  owner: owner
  costcenter: costCenter
  application: projectName
  workload: projectName
  sla: '99.9%'
  'backup-policy': 'none'
  'maint-window': 'sat-02-06-utc'
  'technical-contact': technicalContact
}

// CAF naming with length constraints
var logAnalyticsName = 'log-${projectName}-${environment}'
var storageAccountName = 'st${take(replace(projectName, '-', ''), 8)}${take(environment, 3)}${take(uniqueSuffix, 6)}'
var appInsightsName = 'appi-${projectName}-${environment}'
var staticWebAppName = 'stapp-${projectName}-${environment}'

// ──────────────────────────────────────────────────────────────────────────────
// Phase 1: Foundation — Monitoring + Data
// ──────────────────────────────────────────────────────────────────────────────

module logAnalytics 'modules/log-analytics.bicep' = if (phase == 'all' || phase == 'foundation') {
  name: 'log-analytics-${deploymentTimestamp}'
  params: {
    name: logAnalyticsName
    location: location
    tags: tags
  }
}

module storage 'modules/storage.bicep' = if (phase == 'all' || phase == 'foundation') {
  name: 'storage-${deploymentTimestamp}'
  params: {
    name: storageAccountName
    location: location
    tags: tags
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Phase 2: Application — Compute + Observability
// ──────────────────────────────────────────────────────────────────────────────

module appInsights 'modules/app-insights.bicep' = if (phase == 'all' || phase == 'application') {
  name: 'app-insights-${deploymentTimestamp}'
  params: {
    name: appInsightsName
    location: location
    tags: tags
    workspaceResourceId: logAnalytics!.outputs.workspaceId
  }
}

module staticWebApp 'modules/static-web-app.bicep' = if (phase == 'all' || phase == 'application') {
  name: 'static-web-app-${deploymentTimestamp}'
  params: {
    name: staticWebAppName
    location: location
    tags: tags
    repositoryUrl: repositoryUrl
    repositoryBranch: repositoryBranch
    appInsightsConnectionString: appInsights!.outputs.connectionString
    storageAccountName: storage!.outputs.storageAccountName
  }
}

// RBAC: Grant the SWA managed identity "Storage Table Data Contributor" on the storage account
module storageRbac 'modules/storage-rbac.bicep' = if (phase == 'all' || phase == 'application') {
  name: 'storage-rbac-${deploymentTimestamp}'
  params: {
    storageAccountId: storage!.outputs.storageAccountId
    principalId: staticWebApp!.outputs.principalId
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Default hostname of the Static Web App.')
output staticWebAppUrl string = staticWebApp.?outputs.?defaultHostname ?? ''

@description('Name of the Static Web App resource.')
output staticWebAppName string = staticWebApp.?outputs.?staticWebAppName ?? ''

@description('Name of the Storage Account.')
output storageAccountName string = storage.?outputs.?storageAccountName ?? ''

@description('Application Insights connection string for app configuration.')
output appInsightsConnectionString string = appInsights.?outputs.?connectionString ?? ''
