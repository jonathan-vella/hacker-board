targetScope = 'resourceGroup'

// ──────────────────────────────────────────────────────────────────────────────
// Parameters
// ──────────────────────────────────────────────────────────────────────────────

@description('Project name used in resource naming.')
param projectName string = 'hacker-board'

@allowed(['dev', 'staging', 'prod'])
@description('Deployment environment.')
param environment string = 'prod'

@description('Primary Azure region for all resources. Must be a region where Azure Static Web Apps is available.')
@allowed([
  'centralus'
  'eastus'
  'eastus2'
  'westus2'
  'westus3'
  'northeurope'
  'westeurope'
  'uksouth'
  'swedencentral'
  'eastasia'
  'southeastasia'
  'japaneast'
  'australiaeast'
  'southcentralus'
  'brazilsouth'
])
param location string = 'westeurope'

@description('Resource owner identifier.')
param owner string = 'imperial-infraops'

@description('Cost center code required by Azure Policy.')
param costCenter string = 'CC-DEATHSTAR'

@description('Technical contact email required by Azure Policy.')
param technicalContact string = 'darth.vader@empire.gov'

@description('GitHub repository URL for Static Web App source linkage.')
param repositoryUrl string = 'https://github.com/jonathan-vella/hacker-board'

@description('GitHub repository branch for Static Web App.')
param repositoryBranch string = 'main'
