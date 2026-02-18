@description('Name of the Virtual Network.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

// ──────────────────────────────────────────────────────────────────────────────
// Virtual Network via AVM — two subnets:
//   snet-swa    : SWA VNet integration (no delegation required for Standard SWA)
//   snet-sql-pe : SQL Private Endpoint placement
// ──────────────────────────────────────────────────────────────────────────────

module vnet 'br/public:avm/res/network/virtual-network:0.7.0' = {
  name: 'virtual-network'
  params: {
    name: name
    location: location
    tags: tags
    addressPrefixes: [
      '10.0.0.0/16'
    ]
    subnets: [
      {
        name: 'snet-swa'
        addressPrefix: '10.0.1.0/24'
        // No subnet delegation needed — Azure Static Web Apps Standard uses VNet
        // integration without requiring a delegated subnet on the caller's VNet.
      }
      {
        name: 'snet-sql-pe'
        addressPrefix: '10.0.2.0/24'
        // Private endpoint network policies must be disabled for PE placement
        privateEndpointNetworkPolicies: 'Disabled'
        privateLinkServiceNetworkPolicies: 'Disabled'
      }
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Resource ID of the Virtual Network.')
output vnetId string = vnet.outputs.resourceId

@description('Name of the Virtual Network.')
output vnetName string = vnet.outputs.name

@description('Resource ID of the SWA integration subnet.')
output swaSubnetId string = vnet.outputs.subnetResourceIds[0]

@description('Resource ID of the SQL Private Endpoint subnet.')
output sqlPeSubnetId string = vnet.outputs.subnetResourceIds[1]
