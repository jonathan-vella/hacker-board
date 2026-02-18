targetScope = 'resourceGroup'

// ──────────────────────────────────────────────────────────────────────────────
// Parameters
// ──────────────────────────────────────────────────────────────────────────────

@description('Project name used in resource naming.')
param projectName string = 'hacker-board'

@allowed(['dev', 'staging', 'prod'])
@description('Deployment environment.')
param environment string = 'prod'

@description('Primary Azure region for all resources. Must be a region where Azure Static Web Apps is available.')
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
param location string = 'westeurope'

@description('Resource owner identifier.')
param owner string = 'imperial-infraops'

@description('Cost center code required by Azure Policy.')
param costCenter string = 'CC-DEATHSTAR'

@description('Technical contact email required by Azure Policy.')
param technicalContact string = 'darth.vader@empire.gov'

@description('GitHub repository URL for Static Web App source linkage.')
param repositoryUrl string = 'https://github.com/jonathan-vella/hacker-board'

@description('GitHub repository branch for Static Web App.')
param repositoryBranch string = 'main'

@description('UTC timestamp used to generate unique sub-deployment names. Prevents DeploymentActive conflicts on re-deploy.')
param deploymentTimestamp string = utcNow('yyyyMMddHHmmss')

// ──────────────────────────────────────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────────────────────────────────────

var suffix = '${projectName}-${environment}'

// Storage account names: max 24 chars, lowercase alphanumeric only.
// uniqueString scopes to the resource group so re-deploys to the same RG always
// produce the same name (idempotent), while different RGs get different names.
var storageAccountName = take(replace('st${projectName}${environment}${uniqueString(resourceGroup().id)}', '-', ''), 24)

var tags = {
  project: projectName
  environment: environment
  owner: owner
  costCenter: costCenter
  technicalContact: technicalContact
}

// ──────────────────────────────────────────────────────────────────────────────
// Modules
// ──────────────────────────────────────────────────────────────────────────────

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

module storage 'modules/storage.bicep' = {
  name: 'storage-${deploymentTimestamp}'
  params: {
    name: storageAccountName
    location: location
    tags: tags
  }
}

module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'static-web-app-${deploymentTimestamp}'
  params: {
    name: 'swa-${suffix}'
    location: location
    tags: tags
    repositoryUrl: repositoryUrl
    repositoryBranch: repositoryBranch
    appInsightsConnectionString: appInsights.outputs.connectionString
    storageAccountName: storage.outputs.storageAccountName
  }
}

module storageRbac 'modules/storage-rbac.bicep' = {
  name: 'storage-rbac-${deploymentTimestamp}'
  params: {
    storageAccountId: storage.outputs.storageAccountId
    principalId: staticWebApp.outputs.principalId
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Default hostname of the deployed Static Web App.')
output swaHostname string = staticWebApp.outputs.defaultHostname

@description('Name of the Static Web App resource.')
output swaName string = staticWebApp.outputs.staticWebAppName

@description('Application Insights connection string.')
output appInsightsConnectionString string = appInsights.outputs.connectionString

@description('Name of the Storage Account.')
output storageAccountName string = storage.outputs.storageAccountName
