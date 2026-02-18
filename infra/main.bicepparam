using 'main.bicep'

param projectName = 'hacker-board'
param environment = 'prod'
param location = 'westeurope'
param owner = 'agentic-infraops'
param costCenter = 'microhack'
param technicalContact = 'infraops-team@contoso.com'
param repositoryUrl = ''
param repositoryBranch = 'main'
// Required — set to the UPN/email of the operator to grant db_owner access in SQL
// and send the SWA admin invitation to
param adminEmail = 'admin@contoso.com'
param enablePrivateEndpoint = true
