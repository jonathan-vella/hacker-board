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
    buildProperties: {
      appLocation: 'src'
      apiLocation: 'api'
      outputLocation: ''
    }
    managedIdentities: {
      systemAssigned: true
    }
    appSettings: {
      APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
      AZURE_STORAGE_ACCOUNT_NAME: storageAccountName
    }
  }
}

// NOTE: Azure SWA defaults deploymentAuthPolicy to "DeploymentToken".
// The ARM/Bicep schema does NOT expose this property — it can only be
// changed via REST API PATCH and requires a GitHub PAT (repositoryToken)
// in the same request body.
//
// After provisioning, run once to enable OIDC deployments:
//   ./scripts/configure-swa-auth.sh --rg-name <RG> --github-token <PAT>
//
// Or switch manually: Portal → SWA → Settings → Configuration →
// Deployment configuration → select "GitHub".

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
