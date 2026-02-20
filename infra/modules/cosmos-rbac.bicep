@description('Name of the existing Cosmos DB account to assign access to.')
param cosmosAccountName string

@description('Principal ID of the identity that will receive the Data Contributor role.')
param principalId string

// ──────────────────────────────────────────────────────────────────────────────
// Cosmos DB SQL Role Assignment
// Assigns the Cosmos DB Built-in Data Contributor role (ID: 00000000-...0002)
// to the provided principal. This role grants read/write on all containers
// without allowing account-level management operations (least privilege).
//
// NOTE: Cosmos DB SQL role assignments are NOT standard Azure RBAC — they are
// data-plane roles scoped to the Cosmos DB account and managed separately from
// Azure IAM role assignments.
// ──────────────────────────────────────────────────────────────────────────────

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource dataContributorAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  // Deterministic GUID scoped to account + principal + role, making this idempotent.
  name: guid(cosmosAccount.id, principalId, '00000000-0000-0000-0000-000000000002')
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: principalId
    scope: cosmosAccount.id
  }
}
