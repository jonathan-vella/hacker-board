@description('Name of the Virtual Network.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('VNet address space.')
param addressPrefix string = '10.0.0.0/16'

// ──────────────────────────────────────────────────────────────────────────────
// Virtual Network with two subnets via AVM:
// - snet-pe: Private Endpoint subnet for Cosmos DB
// - snet-app: App Service VNet integration (delegated to Microsoft.Web/serverFarms)
// Required by B7 governance constraint (Cosmos DB Private Endpoint).
// ──────────────────────────────────────────────────────────────────────────────

module virtualNetwork 'br/public:avm/res/network/virtual-network:0.7.2' = {
  name: 'virtual-network'
  params: {
    name: name
    location: location
    tags: tags
    addressPrefixes: [
      addressPrefix
    ]
    subnets: [
      {
        name: 'snet-pe'
        addressPrefix: '10.0.1.0/24'
      }
      {
        name: 'snet-app'
        addressPrefix: '10.0.2.0/24'
        delegation: 'Microsoft.Web/serverFarms'
      }
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Resource ID of the Virtual Network.')
output vnetId string = virtualNetwork.outputs.resourceId

@description('Name of the Virtual Network.')
output vnetName string = virtualNetwork.outputs.name

@description('Resource ID of the Private Endpoint subnet (snet-pe).')
output snetPeId string = virtualNetwork.outputs.subnetResourceIds[0]

@description('Resource ID of the App Service integration subnet (snet-app).')
output snetAppId string = virtualNetwork.outputs.subnetResourceIds[1]
