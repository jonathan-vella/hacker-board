@description('Name of the Application Insights resource.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('Resource ID of the Log Analytics Workspace for data linkage.')
param workspaceResourceId string

// ──────────────────────────────────────────────────────────────────────────────
// Application Insights via AVM
// ──────────────────────────────────────────────────────────────────────────────

module appInsights 'br/public:avm/res/insights/component:0.7.1' = {
  name: 'application-insights'
  params: {
    name: name
    location: location
    tags: tags
    kind: 'web'
    applicationType: 'web'
    workspaceResourceId: workspaceResourceId
    retentionInDays: 30
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Application Insights connection string (use instead of deprecated instrumentation key).')
output connectionString string = appInsights.outputs.connectionString

@description('Resource ID of the Application Insights resource.')
output appInsightsId string = appInsights.outputs.resourceId
