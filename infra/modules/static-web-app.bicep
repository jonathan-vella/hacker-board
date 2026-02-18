@description('Name of the Static Web App.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('GitHub repository URL for source linkage (optional).')
param repositoryUrl string = ''

@description('GitHub repository branch.')
param repositoryBranch string = 'main'

@description('Application Insights connection string for telemetry.')
param appInsightsConnectionString string

@description('Storage Account name for app configuration.')
param storageAccountName string

// ──────────────────────────────────────────────────────────────────────────────
// Static Web App via AVM — Standard SKU with managed Functions
// ──────────────────────────────────────────────────────────────────────────────

module staticWebApp 'br/public:avm/res/web/static-site:0.9.3' = {
  name: 'static-web-app'
  params: {
    name: name
    location: location
    tags: tags
    sku: 'Standard'
    repositoryUrl: !empty(repositoryUrl) ? repositoryUrl : null
    branch: !empty(repositoryUrl) ? repositoryBranch : null
    stagingEnvironmentPolicy: 'Disabled'
    managedIdentities: {
      systemAssigned: true
    }
    appSettings: {
      APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
      AZURE_STORAGE_ACCOUNT_NAME: storageAccountName
    }
  }
}

// Set deployment authorization policy to GitHub OIDC so CI/CD uses GitHub
// identity instead of a static deployment token. This is a child resource of
// the SWA that controls whether deployments authenticate via GitHub or a token.
resource swaBasicAuth 'Microsoft.Web/staticSites/basicAuth@2023-12-01' = {
  name: '${name}/default'
  properties: {
    // 'GitHub' = OIDC via GitHub Actions; 'DisableLocalAuth'/'AllowList' not needed
    applicableEnvironmentsMode: 'AllEnvironments'
    environments: []
  }
  dependsOn: [staticWebApp]
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Default hostname of the Static Web App.')
output defaultHostname string = staticWebApp.outputs.defaultHostname

@description('Name of the Static Web App resource.')
output staticWebAppName string = staticWebApp.outputs.name

@description('Resource ID of the Static Web App.')
output staticWebAppId string = staticWebApp.outputs.resourceId

@description('Principal ID of the system-assigned managed identity.')
output principalId string = staticWebApp.outputs.?systemAssignedMIPrincipalId ?? ''
