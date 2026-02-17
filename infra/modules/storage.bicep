@description('Name of the Storage Account (max 24 chars, no hyphens).')
@maxLength(24)
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

// ──────────────────────────────────────────────────────────────────────────────
// Storage Account via AVM — with Table Service and 4 tables
// ──────────────────────────────────────────────────────────────────────────────

module storageAccount 'br/public:avm/res/storage/storage-account:0.31.0' = {
  name: 'storage-account'
  params: {
    name: name
    location: location
    tags: tags
    kind: 'StorageV2'
    skuName: 'Standard_LRS'
    allowSharedKeyAccess: false
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    tableServices: {
      tables: [
        { name: 'Teams' }
        { name: 'Attendees' }
        { name: 'Scores' }
        { name: 'Awards' }
        { name: 'Submissions' }
        { name: 'Rubrics' }
        { name: 'Config' }
      ]
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Resource ID of the Storage Account.')
output storageAccountId string = storageAccount.outputs.resourceId

@description('Name of the Storage Account.')
output storageAccountName string = storageAccount.outputs.name

@description('Primary table endpoint URL.')
output primaryTableEndpoint string = storageAccount.outputs.primaryBlobEndpoint
