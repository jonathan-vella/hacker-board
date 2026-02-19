@description('Azure region for deployment.')
param location string

@description('Resource tags.')
param tags object

@description('Resource ID of the User-Assigned Managed Identity that runs the deployment script. This identity must be set as the SQL Server Entra admin so it can execute DDL.')
param deploymentIdentityId string

@description('Resource ID of the scripts subnet (must have Microsoft.ContainerInstance/containerGroups delegation).')
param scriptsSubnetId string

@description('FQDN of the Azure SQL Server (resolved via private DNS inside the VNet).')
param sqlServerFqdn string

@description('Name of the SQL Database.')
param sqlDatabaseName string

@description('Name of the Static Web App resource. Its system-assigned managed identity is granted db_owner.')
param swaName string

@description('Entra UPN/email of the human operator to also grant db_owner. Leave empty to skip.')
param operatorLogin string = ''

@description('UTC timestamp used for a unique deployment script resource name.')
param deploymentTimestamp string

@description('Principal ID (object ID) of the deployment UAMI — used for RBAC on the scripts storage account.')
param deploymentIdentityPrincipalId string

// ──────────────────────────────────────────────────────────────────────────────
// Deployment Script — runs inside the VNet so it can reach the SQL private
// endpoint without enabling public SQL access.
//
// Responsibilities (all idempotent):
//   1. Run api/schema/init.sql  — creates/migrates all tables
//   2. CREATE USER + ALTER ROLE db_owner for the SWA managed identity
//   3. CREATE USER + ALTER ROLE db_owner for the human operator (adminEmail)
//
// The SQL server's 'Directory Readers' Entra role is assigned automatically in
// main.bicep via the Microsoft.Graph extension before this script runs.
// ──────────────────────────────────────────────────────────────────────────────

var schemaSqlB64 = loadFileAsBase64('../../api/schema/init.sql')

// Storage account for the deployment script's file share.
// Required when container settings include subnetIds (VNet integration).
// Name is deterministic per resource group to survive re-deploys.
var scriptsStorageName = 'stgrant${uniqueString(resourceGroup().id)}'

resource scriptsStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: scriptsStorageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    // No VNet restriction on this storage account — VNet-injected ACI mounts
    // Azure Files via its own infrastructure path, which is blocked by subnet
    // VNet rules even with AzureServices bypass. This account holds only
    // ephemeral deployment script artifacts and is protected by RBAC (UAMI only).
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Storage File Data Privileged Contributor — lets the UAMI access the file share
// without a storage access key (key-free, managed identity RBAC auth).
resource scriptsStorageRbac 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(scriptsStorage.id, deploymentIdentityPrincipalId, '69566ab7-960f-475b-8e7c-b3118f30c6bd')
  scope: scriptsStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69566ab7-960f-475b-8e7c-b3118f30c6bd')
    principalId: deploymentIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource sqlGrantScript 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'sql-grant-${deploymentTimestamp}'
  location: location
  tags: tags
  kind: 'AzureCLI'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${deploymentIdentityId}': {}
    }
  }
  properties: {
    azCliVersion: '2.70.0'
    retentionInterval: 'PT1H'
    timeout: 'PT15M'
    // Run the ACI container in the VNet so it resolves SQL via the private endpoint.
    // storageAccountSettings is required when subnetIds is specified.
    storageAccountSettings: {
      storageAccountName: scriptsStorage.name
    }
    containerSettings: {
      subnetIds: [
        { id: scriptsSubnetId }
      ]
    }
    environmentVariables: [
      { name: 'SQL_FQDN', value: sqlServerFqdn }
      { name: 'SQL_DB', value: sqlDatabaseName }
      { name: 'SWA_NAME', value: swaName }
      { name: 'OPERATOR_LOGIN', value: operatorLogin }
      // Schema DDL base64-encoded at Bicep compile time — decoded in the script.
      // Using base64 avoids escaping issues with heredocs and special characters.
      { name: 'SCHEMA_SQL_B64', value: schemaSqlB64 }
    ]
    // 1. Install mssql-tools18 (sqlcmd) — needs outbound internet from the ACI.
    // 2. Decode the schema SQL and run it (idempotent: all DDL uses IF NOT EXISTS).
    // 3. Grant db_owner to the SWA system-assigned identity and the operator.
    //    -G flag tells sqlcmd to use Azure Active Directory auth; inside ACI with
    //    the UAMI attached, sqlcmd automatically picks up the managed identity token.
    scriptContent: '''
      #!/bin/bash
      set -euo pipefail

      echo "=== Installing sqlcmd (mssql-tools18) ==="
      curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/mspkg.gpg
      echo "deb [arch=amd64 signed-by=/usr/share/keyrings/mspkg.gpg] \
        https://packages.microsoft.com/ubuntu/22.04/prod jammy main" \
        > /etc/apt/sources.list.d/mspkg.list
      apt-get update -qq
      ACCEPT_EULA=Y apt-get install -yqq mssql-tools18 unixodbc-dev
      export PATH="$PATH:/opt/mssql-tools18/bin"
      sqlcmd -? 2>&1 | head -1

      SQLCMD="sqlcmd -S tcp:${SQL_FQDN},1433 -d ${SQL_DB} -G -No"

      echo "=== Running schema migration ==="
      base64 -d <<< "${SCHEMA_SQL_B64}" > /tmp/schema.sql
      $SQLCMD -i /tmp/schema.sql

      echo "=== Granting db_owner to SWA managed identity ==="
      cat > /tmp/grant.sql << SQLEOF
      IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${SWA_NAME}')
        CREATE USER [${SWA_NAME}] FROM EXTERNAL PROVIDER;
      ALTER ROLE db_owner ADD MEMBER [${SWA_NAME}];
      PRINT 'db_owner granted to ${SWA_NAME}';
      SQLEOF
      $SQLCMD -i /tmp/grant.sql

      if [ -n "${OPERATOR_LOGIN}" ]; then
        echo "=== Granting db_owner to operator ==="
        cat > /tmp/grant_op.sql << SQLEOF
      IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${OPERATOR_LOGIN}')
        CREATE USER [${OPERATOR_LOGIN}] FROM EXTERNAL PROVIDER;
      ALTER ROLE db_owner ADD MEMBER [${OPERATOR_LOGIN}];
      PRINT 'db_owner granted to ${OPERATOR_LOGIN}';
      SQLEOF
        $SQLCMD -i /tmp/grant_op.sql
      fi

      echo "=== All SQL steps complete ==="
      printf '{"status":"success","schemaApplied":true,"swaGranted":"%s","operatorGranted":"%s"}' \
        "${SWA_NAME}" "${OPERATOR_LOGIN}" \
        > "$AZ_SCRIPTS_OUTPUT_PATH"
    '''
  }
  dependsOn: [
    scriptsStorageRbac
  ]
}

@description('Outputs from the SQL grant deployment script.')
output grantOutput object = sqlGrantScript.properties.outputs
