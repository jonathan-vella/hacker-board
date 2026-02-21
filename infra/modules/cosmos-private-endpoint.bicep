@description('Name of the Private Endpoint resource.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('Resource ID of the subnet for the Private Endpoint (snet-pe).')
param subnetId string

@description('Resource ID of the Cosmos DB account to connect via Private Endpoint.')
param cosmosAccountId string

@description('Resource ID of the Virtual Network for DNS zone linking.')
param vnetId string

// ──────────────────────────────────────────────────────────────────────────────
// Private DNS Zone for Cosmos DB NoSQL API
// Resolves *.documents.azure.com to private IPs within the VNet.
// ──────────────────────────────────────────────────────────────────────────────

module privateDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.0' = {
  name: 'cosmos-private-dns-zone'
  params: {
    name: 'privatelink.documents.azure.com'
    tags: tags
    virtualNetworkLinks: [
      {
        virtualNetworkResourceId: vnetId
        registrationEnabled: false
      }
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Private Endpoint for Cosmos DB — routes Cosmos traffic over the VNet
// Uses groupId 'Sql' for the Cosmos DB NoSQL (SQL) API.
// ──────────────────────────────────────────────────────────────────────────────

module privateEndpoint 'br/public:avm/res/network/private-endpoint:0.11.1' = {
  name: 'cosmos-private-endpoint'
  params: {
    name: name
    location: location
    tags: tags
    subnetResourceId: subnetId
    privateLinkServiceConnections: [
      {
        name: '${name}-connection'
        properties: {
          privateLinkServiceId: cosmosAccountId
          groupIds: [
            'Sql'
          ]
        }
      }
    ]
    privateDnsZoneGroup: {
      privateDnsZoneGroupConfigs: [
        {
          privateDnsZoneResourceId: privateDnsZone.outputs.resourceId
        }
      ]
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Resource ID of the Private Endpoint.')
output privateEndpointId string = privateEndpoint.outputs.resourceId

@description('Resource ID of the Private DNS Zone.')
output privateDnsZoneId string = privateDnsZone.outputs.resourceId
