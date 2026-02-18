@description('Azure region for deployment.')
param location string = 'global'

@description('Resource tags.')
param tags object

@description('Resource ID of the Virtual Network to link the Private DNS Zone to.')
param vnetId string

// ──────────────────────────────────────────────────────────────────────────────
// Private DNS Zone for Azure SQL via AVM
// ──────────────────────────────────────────────────────────────────────────────

module privateDnsZone 'br/public:avm/res/network/private-dns-zone:0.7.1' = {
  name: 'private-dns-zone'
  params: {
    #disable-next-line no-hardcoded-env-urls  // Required: Azure SQL private DNS zone name is a fixed platform value
    name: 'privatelink.database.windows.net'
    location: location
    tags: tags
    virtualNetworkLinks: [
      {
        name: 'vnet-link-hackerboard'
        registrationEnabled: false
        virtualNetworkResourceId: vnetId
      }
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Resource ID of the Private DNS Zone.')
output resourceId string = privateDnsZone.outputs.resourceId

@description('Name of the Private DNS Zone.')
output name string = privateDnsZone.outputs.name
