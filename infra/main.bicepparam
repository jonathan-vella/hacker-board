using 'main.bicep'

param projectName = 'hacker-board'
param environment = 'prod'
param location = 'westeurope'
param owner = 'agentic-infraops'
param costCenter = 'microhack'
param technicalContact = 'infraops-team@contoso.com'
param repositoryUrl = ''
param repositoryBranch = 'main'
// Required — set to the UPN of the Entra ID user/group that will administer SQL
param adminEmail = 'admin@contoso.com'
// Required — set to the Object ID of the Entra ID user/group
param sqlAdminObjectId = '00000000-0000-0000-0000-000000000000'
param enablePrivateEndpoint = true
