@description('Name of the Log Analytics Workspace.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

// ──────────────────────────────────────────────────────────────────────────────
// Log Analytics Workspace via AVM
// ──────────────────────────────────────────────────────────────────────────────

module workspace 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  name: 'log-analytics-workspace'
  params: {
    name: name
    location: location
    tags: tags
    skuName: 'PerGB2018'
    dataRetention: 30
    dailyQuotaGb: '1'
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Resource ID of the Log Analytics Workspace.')
output workspaceId string = workspace.outputs.resourceId

@description('Name of the Log Analytics Workspace.')
output workspaceName string = workspace.outputs.name
