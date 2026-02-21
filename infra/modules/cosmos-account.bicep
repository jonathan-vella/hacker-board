@description('Name of the Cosmos DB account.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

// ──────────────────────────────────────────────────────────────────────────────
// Cosmos DB Account (Serverless) + Database + Containers via AVM
// Governance: ModifyCosmosDBLocalAuth policy auto-sets disableLocalAuth=true.
// We set it explicitly so Bicep what-if/plan matches the desired state.
// ──────────────────────────────────────────────────────────────────────────────

module cosmosAccount 'br/public:avm/res/document-db/database-account:0.18.0' = {
  name: 'cosmos-account'
  params: {
    name: name
    location: location
    tags: tags
    databaseAccountOfferType: 'Standard'
    capabilitiesToAdd: [
      'EnableServerless'
    ]
    disableLocalAuthentication: true
    enableAutomaticFailover: false
    minimumTlsVersion: 'Tls12'
    networkRestrictions: {
      publicNetworkAccess: 'Disabled'
    }
    failoverLocations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    sqlDatabases: [
      {
        name: 'hackerboard'
        containers: [
          {
            name: 'teams'
            paths: [ '/id' ]
          }
          {
            name: 'attendees'
            paths: [ '/teamId' ]
          }
          {
            name: 'scores'
            paths: [ '/teamId' ]
          }
          {
            name: 'submissions'
            paths: [ '/teamId' ]
          }
          {
            name: 'rubrics'
            paths: [ '/id' ]
          }
          {
            name: 'config'
            paths: [ '/id' ]
          }
        ]
      }
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('HTTPS endpoint of the Cosmos DB account.')
output accountEndpoint string = cosmosAccount.outputs.endpoint

@description('Name of the Cosmos DB account.')
output accountName string = cosmosAccount.outputs.name

@description('Resource ID of the Cosmos DB account.')
output resourceId string = cosmosAccount.outputs.resourceId
