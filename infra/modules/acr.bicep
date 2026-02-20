@description('Name of the Azure Container Registry resource.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

// ──────────────────────────────────────────────────────────────────────────────
// Azure Container Registry via AVM — Standard tier; enables geo-replication and
// content trust if needed. Admin user and anonymous pull are disabled; App Service
// pulls via acrPull MI role assigned in app-service.bicep.
// ──────────────────────────────────────────────────────────────────────────────

module containerRegistry 'br/public:avm/res/container-registry/registry:0.10.0' = {
  name: 'container-registry'
  params: {
    name: name
    location: location
    tags: tags
    acrSku: 'Standard'
    publicNetworkAccess: 'Enabled'
    anonymousPullEnabled: false
    acrAdminUserEnabled: false
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Name of the Azure Container Registry resource.')
output acrName string = containerRegistry.outputs.name

@description('ACR login server FQDN (e.g., crhackerboardprod.azurecr.io).')
output acrLoginServer string = containerRegistry.outputs.loginServer

@description('Resource ID of the Azure Container Registry.')
output acrResourceId string = containerRegistry.outputs.resourceId
