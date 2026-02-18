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

@description('Email address (UPN) sent the SWA admin invitation. Also granted db_owner access in SQL via the post-deploy grant script.')
param adminEmail string

@description('Enable Private Endpoint for Azure SQL Server. When true, a VNet, Private Endpoint, Private DNS Zone, and in-VNet SQL grant script are created. Set to false for cost-saving dev deployments.')
param enablePrivateEndpoint bool = true

// ──────────────────────────────────────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────────────────────────────────────

var suffix = '${projectName}-${environment}'

var tags = {
  project: projectName
  environment: environment
  owner: owner
  costCenter: costCenter
  technicalContact: technicalContact
}

// ──────────────────────────────────────────────────────────────────────────────
// Deployment identity — UAMI used as the SQL Entra admin so the in-VNet
// deployment script can connect to SQL and grant db_owner to the SWA identity.
// Reference: https://learn.microsoft.com/azure/azure-sql/database/authentication-aad-configure
// PREREQUISITE: After first deploy, assign the SQL server's system-assigned
// managed identity the Entra ID "Directory Readers" role so it can resolve
// external principals (needed for CREATE USER ... FROM EXTERNAL PROVIDER).
// ──────────────────────────────────────────────────────────────────────────────

resource deploymentIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-deploy-${suffix}'
  location: location
  tags: tags
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

module sql 'modules/sql-server.bicep' = {
  name: 'sql-${deploymentTimestamp}'
  params: {
    name: 'sql-${suffix}'
    location: location
    tags: tags
    databaseName: 'hackerboard'
    // The UAMI is the SQL Entra admin so the sql-grant deployment script can
    // connect via managed identity and run DDL without a password or public access.
    administratorLogin: deploymentIdentity.name
    administratorObjectId: deploymentIdentity.properties.principalId
    administratorPrincipalType: 'Application'
  }
}

module vnet 'modules/vnet.bicep' = if (enablePrivateEndpoint) {
  name: 'vnet-${deploymentTimestamp}'
  params: {
    name: 'vnet-${suffix}'
    location: location
    tags: tags
  }
}

module privateDns 'modules/private-dns.bicep' = if (enablePrivateEndpoint) {
  name: 'private-dns-${deploymentTimestamp}'
  params: {
    location: 'global'
    tags: tags
    vnetId: vnet!.outputs.vnetId
  }
}

module sqlPrivateEndpoint 'modules/sql-private-endpoint.bicep' = if (enablePrivateEndpoint) {
  name: 'sql-pe-${deploymentTimestamp}'
  params: {
    name: 'pe-sql-${suffix}'
    location: location
    tags: tags
    sqlServerResourceId: sql.outputs.resourceId
    subnetResourceId: vnet!.outputs.sqlPeSubnetId
    privateDnsZoneResourceId: privateDns!.outputs.resourceId
  }
}

module sqlGrant 'modules/sql-grant.bicep' = if (enablePrivateEndpoint) {
  name: 'sql-grant-${deploymentTimestamp}'
  params: {
    location: location
    tags: tags
    deploymentIdentityId: deploymentIdentity.id
    scriptsSubnetId: vnet!.outputs.scriptsSubnetId
    sqlServerFqdn: sql.outputs.serverFqdn
    sqlDatabaseName: sql.outputs.databaseName
    swaName: staticWebApp.outputs.staticWebAppName
    operatorLogin: adminEmail
    deploymentTimestamp: deploymentTimestamp
  }
  dependsOn: [
    sqlPrivateEndpoint
    privateDns
  ]
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
    sqlServerFqdn: sql.outputs.serverFqdn
    sqlDatabaseName: sql.outputs.databaseName
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Default hostname of the deployed Static Web App.')
output swaHostname string = staticWebApp.outputs.defaultHostname

@description('Name of the Static Web App resource.')
output swaName string = staticWebApp.outputs.staticWebAppName

@description('Name of the deployment UAMI used as the SQL Entra admin.')
output deploymentIdentityName string = deploymentIdentity.name

@description('Principal ID of the deployment UAMI — used to identify it for Directory Readers role assignment.')
output deploymentIdentityPrincipalId string = deploymentIdentity.properties.principalId

@description('Principal ID of the SWA system-assigned managed identity.')
output swaPrincipalId string = staticWebApp.outputs.principalId

@description('Application Insights connection string.')
output appInsightsConnectionString string = appInsights.outputs.connectionString

@description('Fully-qualified domain name of the Azure SQL Server.')
output sqlServerFqdn string = sql.outputs.serverFqdn

@description('Name of the Azure SQL Database.')
output sqlDatabaseName string = sql.outputs.databaseName
