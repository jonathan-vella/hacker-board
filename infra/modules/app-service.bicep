@description('Name of the App Service Plan.')
param planName string

@description('Name of the Web App.')
param siteName string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('ACR login server FQDN for container image pull.')
param acrLoginServer string

@description('ACR resource name for acrPull role assignment scope.')
param acrName string

@description('Container image reference in repo:tag format.')
param containerImage string

@description('HTTPS endpoint of the Cosmos DB account for data access.')
param cosmosEndpoint string

@description('Application Insights connection string for telemetry.')
param appInsightsConnectionString string

@secure()
@description('GitHub OAuth App client ID for Easy Auth. Supplied at deploy time — never committed.')
param gitHubOAuthClientId string

@secure()
@description('GitHub OAuth App client secret for Easy Auth. Supplied at deploy time — never committed.')
param gitHubOAuthClientSecret string

@description('Comma-separated admin identities in provider:username format (e.g. "github:octocat"). Injected as ADMIN_USERS app setting.')
param adminUsers string

// ──────────────────────────────────────────────────────────────────────────────
// 2a. App Service Plan — Premium v3 P1V3 Linux via AVM
// ──────────────────────────────────────────────────────────────────────────────

module appServicePlan 'br/public:avm/res/web/serverfarm:0.7.0' = {
  name: 'app-service-plan'
  params: {
    name: planName
    location: location
    tags: tags
    kind: 'Linux'
    reserved: true
    skuName: 'P1v3'
    skuCapacity: 1
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2b. Web App for Linux Containers via AVM — Easy Auth (GitHub), MI, TLS 1.2
// AVM web/site:0.21.0 uses `configs` array for app settings and auth config
// instead of top-level `appSettingsKeyValuePairs` / `authSettingV2Configuration`.
// ──────────────────────────────────────────────────────────────────────────────

module webApp 'br/public:avm/res/web/site:0.21.0' = {
  name: 'web-app'
  params: {
    name: siteName
    location: location
    tags: tags
    kind: 'app,linux,container'
    serverFarmResourceId: appServicePlan.outputs.resourceId
    managedIdentities: {
      systemAssigned: true
    }
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${containerImage}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
    }
    configs: [
      {
        name: 'appsettings'
        properties: {
          COSMOS_ENDPOINT: cosmosEndpoint
          APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
          WEBSITES_PORT: '8080'
          DOCKER_REGISTRY_SERVER_URL: 'https://${acrLoginServer}'
          GITHUB_OAUTH_CLIENT_SECRET: gitHubOAuthClientSecret
          ADMIN_USERS: adminUsers
        }
      }
      {
        name: 'authsettingsV2'
        properties: {
          platform: {
            enabled: true
            runtimeVersion: '~1'
          }
          globalValidation: {
            // requireAuthentication:false + AllowAnonymous: unauthenticated requests
            // reach the SPA, which renders the Login.js landing page. Must be false
            // so Easy Auth doesn't block /api/me (the principal header endpoint).
            requireAuthentication: false
            unauthenticatedClientAction: 'AllowAnonymous'
            excludedPaths: ['/api/health']
          }
          identityProviders: {
            gitHub: {
              registration: {
                clientId: gitHubOAuthClientId
                clientSecretSettingName: 'GITHUB_OAUTH_CLIENT_SECRET'
              }
            }
          }
          login: {
            tokenStore: {
              // Easy Auth session cookies depend on the token store being enabled.
              // The SPA reads principal data from /api/me (X-MS-CLIENT-PRINCIPAL
              // header) rather than /.auth/me, so token store durability is not
              // critical — only sign-in flow completion.
              enabled: true
            }
          }
        }
      }
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2c. ACR Pull Role Assignment — App Service MI can pull images, no admin creds
// ──────────────────────────────────────────────────────────────────────────────

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  // Use siteName (compile-time known) instead of MI principalId (runtime-only) for deterministic GUID
  name: guid(acr.id, siteName, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: webApp.outputs.?systemAssignedMIPrincipalId ?? ''
    principalType: 'ServicePrincipal'
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Default hostname of the Web App (*.azurewebsites.net).')
output appServiceHostname string = webApp.outputs.defaultHostname

@description('Name of the Web App resource.')
output appServiceName string = webApp.outputs.name

@description('Principal ID of the Web App system-assigned managed identity.')
output appServicePrincipalId string = webApp.outputs.?systemAssignedMIPrincipalId ?? ''

@description('Resource ID of the Web App.')
output appServiceResourceId string = webApp.outputs.resourceId

@description('Resource ID of the App Service Plan.')
output appServicePlanId string = appServicePlan.outputs.resourceId
