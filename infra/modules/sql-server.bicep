@description('Name of the SQL Server resource.')
param name string

@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('Name of the SQL Database.')
param databaseName string = 'hackerboard'

@description('Email or UPN of the Entra ID admin user/group for SQL Server administration.')
param administratorLogin string

@description('Object ID of the Entra ID admin user/group.')
param administratorObjectId string

// ──────────────────────────────────────────────────────────────────────────────
// SQL Server + Database via AVM
// ──────────────────────────────────────────────────────────────────────────────

module sqlServer 'br/public:avm/res/sql/server:0.14.0' = {
  name: 'sql-server'
  params: {
    name: name
    location: location
    tags: tags
    // Entra ID only — no SQL passwords
    administrators: {
      azureADOnlyAuthentication: true
      login: administratorLogin
      principalType: 'User'
      sid: administratorObjectId
      tenantId: tenant().tenantId
    }
    minimalTlsVersion: '1.2'
    managedIdentities: {
      systemAssigned: true
    }
    publicNetworkAccess: 'Disabled'
    databases: [
      {
        name: databaseName
        // Basic DTU — 5 DTU, 2 GB, ~$5/mo — sufficient for hackathon workloads
        sku: {
          name: 'Basic'
          tier: 'Basic'
          capacity: 5
        }
        maxSizeBytes: 2147483648 // 2 GB
        zoneRedundant: false
      }
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────────────────────────────────────

@description('Name of the SQL Server resource.')
output serverName string = sqlServer.outputs.name

@description('Fully-qualified domain name of the SQL Server.')
output serverFqdn string = sqlServer.outputs.fullyQualifiedDomainName

@description('Name of the SQL Database.')
output databaseName string = databaseName

@description('Resource ID of the SQL Server.')
output resourceId string = sqlServer.outputs.resourceId
