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
@allowed([
  'centralus'
  'eastus'
  'eastus2'
  'westus2'
  'westus3'
  'northeurope'
  'westeurope'
  'uksouth'
  'swedencentral'
  'eastasia'
  'southeastasia'
  'japaneast'
  'australiaeast'
  'southcentralus'
  'brazilsouth'
])
param location string = 'centralus'

@description('Resource owner email — also the first admin. Required by B3 tag policy.')
param owner string = 'agentic-infraops'

@description('Cost center code required by Azure Policy (tag: costcenter).')
param costCenter string = 'microhack'

@description('Technical contact email required by Azure Policy (tag: tech-contact).')
param technicalContact string = 'infraops-team@contoso.com'

@description('Application name for governance tagging (tag: application).')
param application string = 'hacker-board'

@description('Workload type for governance tagging (tag: workload).')
param workload string = 'web-app'

@description('SLA tier for governance tagging (tag: sla).')
param sla string = 'non-production'

@description('Backup policy for governance tagging (tag: backup-policy).')
param backupPolicy string = 'none'

@description('Maintenance window for governance tagging (tag: maint-window).')
param maintWindow string = 'any'

@description('Container image reference in repo:tag format for the Web App.')
param containerImage string = 'hacker-board:latest'

@secure()
@description('GitHub OAuth App client ID for Easy Auth. Supplied at deploy time — never committed.')
param gitHubOAuthClientId string = ''

@secure()
@description('GitHub OAuth App client secret for Easy Auth. Supplied at deploy time — never committed.')
param gitHubOAuthClientSecret string = ''

@description('Comma-separated admin identities in provider:username format (e.g. "github:octocat"). Required at deploy time — determines who gets the admin role.')
param adminUsers string

@description('UTC timestamp used to generate unique sub-deployment names. Prevents DeploymentActive conflicts on re-deploy.')
param deploymentTimestamp string = utcNow('yyyyMMddHHmmss')

// ──────────────────────────────────────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────────────────────────────────────

var suffix = '${projectName}-${environment}'

// ACR: alphanumeric only, 5-50 chars, CAF abbreviation 'cr'
var acrName = 'cr${replace(projectName, '-', '')}${environment}'

// App Service Plan: CAF abbreviation 'asp'
var aspName = 'asp-${suffix}'

// Web App: CAF abbreviation 'app'
var appName = 'app-${suffix}'

// All 9 governance tags required by B3 (JV-Enforce Resource Group Tags v3).
// Tag inheritance policy auto-propagates these from the RG to child resources.
var tags = {
  environment: environment
  owner: owner
  costcenter: costCenter
  application: application
  workload: workload
  sla: sla
  'backup-policy': backupPolicy
  'maint-window': maintWindow
  'tech-contact': technicalContact
}

// ──────────────────────────────────────────────────────────────────────────────
// Modules — deployed in dependency order
// D27: UAMI and deployment script removed — governance policy B6 blocks storage
// key auth required by ARM deployment scripts.
// ──────────────────────────────────────────────────────────────────────────────

// Phase 1: Observability foundation
module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'log-analytics-${deploymentTimestamp}'
  params: {
    name: 'law-${suffix}'
    location: location
    tags: tags
  }
}

module appInsights 'modules/app-insights.bicep' = {
  name: 'app-insights-${deploymentTimestamp}'
  params: {
    name: 'appi-${suffix}'
    location: location
    tags: tags
    workspaceResourceId: logAnalytics.outputs.workspaceId
  }
}

// Phase 2: Data layer — Cosmos DB Serverless
// disableLocalAuth: true is also enforced by ModifyCosmosDBLocalAuth policy.
module cosmosAccount 'modules/cosmos-account.bicep' = {
  name: 'cosmos-account-${deploymentTimestamp}'
  params: {
    name: 'cosmos-${suffix}'
    location: location
    tags: tags
  }
}

// Phase 3: Container Registry
module acr 'modules/acr.bicep' = {
  name: 'acr-${deploymentTimestamp}'
  params: {
    name: acrName
    location: location
    tags: tags
  }
}

// Phase 4: Compute — App Service with container + Easy Auth
module appService 'modules/app-service.bicep' = {
  name: 'app-service-${deploymentTimestamp}'
  params: {
    planName: aspName
    siteName: appName
    location: location
    tags: tags
    acrLoginServer: acr.outputs.acrLoginServer
    acrName: acr.outputs.acrName
    containerImage: containerImage
    cosmosEndpoint: cosmosAccount.outputs.accountEndpoint
    appInsightsConnectionString: appInsights.outputs.connectionString
    gitHubOAuthClientId: gitHubOAuthClientId
    gitHubOAuthClientSecret: gitHubOAuthClientSecret
    adminUsers: adminUsers
  }
}

// Phase 4: Data-plane RBAC — App Service MI gets Cosmos DB Built-in Data Contributor
module cosmosRbac 'modules/cosmos-rbac.bicep' = {
  name: 'cosmos-rbac-${deploymentTimestamp}'
  params: {
    cosmosAccountName: cosmosAccount.outputs.accountName
    principalId: appService.outputs.appServicePrincipalId
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Default hostname of the deployed Web App.')
output appServiceHostname string = appService.outputs.appServiceHostname

@description('Name of the Web App resource.')
output appServiceName string = appService.outputs.appServiceName

@description('Principal ID of the App Service system-assigned managed identity.')
output appServicePrincipalId string = appService.outputs.appServicePrincipalId

@description('ACR login server FQDN.')
output acrLoginServer string = acr.outputs.acrLoginServer

@description('Name of the Azure Container Registry resource.')
output acrName string = acr.outputs.acrName

@description('HTTPS endpoint of the Cosmos DB account.')
output cosmosEndpoint string = cosmosAccount.outputs.accountEndpoint

@description('Name of the Cosmos DB account.')
output cosmosAccountName string = cosmosAccount.outputs.accountName

// NOTE: appInsightsConnectionString intentionally omitted from outputs.
// It contains the instrumentation key, which would be visible in deployment
// history for anyone with read access to the resource group.
