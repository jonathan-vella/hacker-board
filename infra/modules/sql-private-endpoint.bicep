@description('Name of the Private Endpoint resource.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('Resource ID of the SQL Server to connect to.')
param sqlServerResourceId string

@description('Resource ID of the subnet for Private Endpoint placement (snet-sql-pe).')
param subnetResourceId string

@description('Resource ID of the Private DNS Zone for privatelink.database.windows.net.')
param privateDnsZoneResourceId string

// ──────────────────────────────────────────────────────────────────────────────
// SQL Server Private Endpoint via AVM
// ──────────────────────────────────────────────────────────────────────────────

module privateEndpoint 'br/public:avm/res/network/private-endpoint:0.11.0' = {
  name: 'sql-private-endpoint'
  params: {
    name: name
    location: location
    tags: tags
    subnetResourceId: subnetResourceId
    privateLinkServiceConnections: [
      {
        name: '${name}-connection'
        properties: {
          privateLinkServiceId: sqlServerResourceId
          groupIds: [
            'sqlServer'
          ]
        }
      }
    ]
    privateDnsZoneGroup: {
      name: 'sql-dns-group'
      privateDnsZoneGroupConfigs: [
        {
          name: 'sql-dns-config'
          privateDnsZoneResourceId: privateDnsZoneResourceId
        }
      ]
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Resource ID of the Private Endpoint.')
output resourceId string = privateEndpoint.outputs.resourceId

@description('Name of the Private Endpoint.')
output name string = privateEndpoint.outputs.name
