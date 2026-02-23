<#
.SYNOPSIS
    Deploys hacker-board Azure infrastructure using Bicep templates.

.DESCRIPTION
    Provisions App Service for Linux Containers + Azure Container Registry (ACR),
    Azure Cosmos DB NoSQL (Serverless) with Private Endpoint, VNet integration,
    Log Analytics, and Application Insights.
    Easy Auth (GitHub OAuth) is configured via Bicep authSettingsV2. Admin role
    injection uses the ADMIN_USERS env var. Authentication to Cosmos DB uses
    DefaultAzureCredential (managed identity) — no connection strings or access
    keys, satisfying the ModifyCosmosDBLocalAuth governance policy.

.PARAMETER ResourceGroupName
    Name of the resource group. Default: rg-hacker-board-prod

.PARAMETER Location
    Azure region for all resources. Default: centralus

.PARAMETER Environment
    Deployment environment (dev, staging, prod). Default: prod

.PARAMETER Owner
    Resource owner identifier. Default: agentic-infraops

.PARAMETER CostCenter
    Cost center code required by Azure Policy.

.PARAMETER TechnicalContact
    Technical contact email required by Azure Policy.

.PARAMETER AdminEmail
    UPN of the first admin (informational only, logged during deploy).
    Not passed to Bicep templates.

.PARAMETER GitHubOAuthClientId
    GitHub OAuth App client ID for Easy Auth. Required.

.PARAMETER GitHubOAuthClientSecret
    GitHub OAuth App client secret for Easy Auth. Required.


.PARAMETER ContainerImage
    Container image reference (repo:tag). Default: hacker-board:latest

.PARAMETER AdminUsers
    Comma-separated admin identities in provider:username format
    (e.g. "github:octocat,aad:admin@co.com"). Required — determines
    who gets the admin role in the application.

.PARAMETER WhatIf
    Run what-if preview without deploying.

.EXAMPLE
    ./deploy.ps1 -CostCenter "microhack" -TechnicalContact "team@contoso.com" -AdminEmail "admin@contoso.com" -GitHubOAuthClientId "abc" -GitHubOAuthClientSecret "xyz"

.EXAMPLE
    ./deploy.ps1 -WhatIf -CostCenter "microhack" -TechnicalContact "team@contoso.com" -GitHubOAuthClientId "abc" -GitHubOAuthClientSecret "xyz"
#>

[CmdletBinding()]
param(
    # Leave empty to be prompted interactively; pass explicitly in CI/CD.
    [string]$ResourceGroupName = '',
    [string]$Location = 'centralus',

    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'prod',

    # Project name used in resource naming. Change only if forking the project.
    [string]$ProjectName = 'hacker-board',

    [string]$Owner = 'agentic-infraops',

    # Leave empty to be prompted interactively; required in CI/CD.
    [string]$CostCenter = '',

    # Leave empty to be prompted interactively; required in CI/CD.
    [string]$TechnicalContact = '',

    [string]$AdminEmail = '',   # Auto-detected from az account show when not provided

    [Parameter(Mandatory)]
    [string]$GitHubOAuthClientId,

    [Parameter(Mandatory)]
    [string]$GitHubOAuthClientSecret,

    # Leave empty to be prompted interactively; required in CI/CD.
    # Format: 'github:<username>' or 'aad:<email>'
    [string]$AdminUsers = '',

    [string]$ContainerImage = 'hacker-board:latest',

    # Optional suffix override. Leave empty (default) so Bicep derives a
    # deterministic suffix from uniqueString(resourceGroup().id) — same RG
    # always produces the same suffix, ensuring repeatable re-deploys.
    [string]$UniqueSuffix = '',

    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      HackerBoard - Azure Deployment    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Pre-flight checks ────────────────────────────────────────────────────────

Write-Host "🔍 Pre-flight checks..." -ForegroundColor Yellow

try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host "  ✅ Logged in as: $($account.user.name)" -ForegroundColor Green
    Write-Host "  ✅ Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
}
catch {
    Write-Host "  ❌ Not logged into Azure. Run 'az login --use-device-code' first." -ForegroundColor Red
    exit 1
}

# Validate real ARM token (az account show can succeed with stale cached metadata)
az account get-access-token --resource https://management.azure.com/ --output none 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Azure CLI token expired or missing from MSAL cache." -ForegroundColor Red
    Write-Host "     Run 'az login --use-device-code' in this terminal, then retry." -ForegroundColor Yellow
    Write-Host "     Note: 'az account show' may succeed even when tokens are invalid." -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✅ ARM token validated" -ForegroundColor Green

# Auto-detect deployer UPN if not explicitly provided
if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
    $AdminEmail = az account show --query 'user.name' --output tsv 2>&1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($AdminEmail)) {
        Write-Host "  ⚠️  Could not detect logged-in user UPN." -ForegroundColor Yellow
        $AdminEmail = ''
    } else {
        Write-Host "  ✅ AdminEmail auto-detected: $AdminEmail" -ForegroundColor Green
    }
}

$bicepVersion = az bicep version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Bicep CLI not found. Run 'az bicep install'." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Bicep: $bicepVersion" -ForegroundColor Green

# ── Interactive prompts (skipped when values are supplied as parameters) ───────

Write-Host ""
Write-Host "⚙️  Deployment Configuration" -ForegroundColor Yellow

# Resource group — prompt when empty; default rg-hacker-board
if ([string]::IsNullOrWhiteSpace($ResourceGroupName)) {
    if ([Environment]::UserInteractive) {
        $rgDefault = 'rg-hacker-board'
        $rgInput = Read-Host "  Resource group name [press Enter for '$rgDefault']"
        $ResourceGroupName = if ([string]::IsNullOrWhiteSpace($rgInput)) { $rgDefault } else { $rgInput.Trim() }
    } else {
        $ResourceGroupName = 'rg-hacker-board'
        Write-Host "  ℹ️  Non-interactive: ResourceGroupName defaulted to '$ResourceGroupName'" -ForegroundColor Yellow
    }
}
Write-Host "  ✅ Resource group: $ResourceGroupName" -ForegroundColor Green

# CostCenter — required by governance tag policy
if ([string]::IsNullOrWhiteSpace($CostCenter)) {
    if ([Environment]::UserInteractive) {
        Write-Host ""
        Write-Host "  ℹ️  CostCenter is a governance-required resource tag." -ForegroundColor Cyan
        Write-Host "     Example values: 'platform-team', 'hackathon-2026', 'microhack'" -ForegroundColor Cyan
        $CostCenter = ''
        while ([string]::IsNullOrWhiteSpace($CostCenter)) {
            $CostCenter = (Read-Host "  Cost center code").Trim()
        }
    } else {
        Write-Host "  ❌ -CostCenter is required. Pass it as a parameter for non-interactive (CI/CD) runs." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  ✅ CostCenter: $CostCenter" -ForegroundColor Green

# TechnicalContact — required by governance tag policy
if ([string]::IsNullOrWhiteSpace($TechnicalContact)) {
    if ([Environment]::UserInteractive) {
        Write-Host ""
        Write-Host "  ℹ️  TechnicalContact must be a valid email address — required by the governance tag policy." -ForegroundColor Cyan
        Write-Host "     Example: 'you@company.com'" -ForegroundColor Cyan
        $TechnicalContact = ''
        while ([string]::IsNullOrWhiteSpace($TechnicalContact)) {
            $TechnicalContact = (Read-Host "  Technical contact email").Trim()
        }
    } else {
        Write-Host "  ❌ -TechnicalContact is required. Pass it as a parameter for non-interactive (CI/CD) runs." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  ✅ TechnicalContact: $TechnicalContact" -ForegroundColor Green

# AdminUsers — determines who gets the Admin role inside the application
if ([string]::IsNullOrWhiteSpace($AdminUsers)) {
    if ([Environment]::UserInteractive) {
        Write-Host ""
        Write-Host "  ℹ️  AdminUsers sets who has the Admin role in the app (scores, teams, rubrics)." -ForegroundColor Cyan
        Write-Host "     Format: 'github:<username>' for GitHub users." -ForegroundColor Cyan
        Write-Host "     For multiple admins: 'github:alice,github:bob'" -ForegroundColor Cyan
        Write-Host "     For Entra ID users: 'aad:user@company.com'" -ForegroundColor Cyan
        $AdminUsers = ''
        while ([string]::IsNullOrWhiteSpace($AdminUsers)) {
            $AdminUsers = (Read-Host "  Admin identities").Trim()
        }
    } else {
        Write-Host "  ❌ -AdminUsers is required. Pass it as a parameter for non-interactive (CI/CD) runs." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  ✅ AdminUsers: $AdminUsers" -ForegroundColor Green

# ── Validate templates ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "📋 Validating Bicep templates..." -ForegroundColor Yellow

$templateFile = Join-Path $PSScriptRoot 'main.bicep'

if (-not (Test-Path $templateFile)) {
    Write-Host "  ❌ Template not found: $templateFile" -ForegroundColor Red
    exit 1
}

az bicep build --file $templateFile 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Bicep build failed. Fix errors before deploying." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Bicep build passed" -ForegroundColor Green

az bicep lint --file $templateFile 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️  Bicep lint warnings detected (non-blocking)" -ForegroundColor Yellow
}
else {
    Write-Host "  ✅ Bicep lint passed" -ForegroundColor Green
}

# ── Resource group with 9 required tags ───────────────────────────────────────

Write-Host ""
Write-Host "📦 Creating resource group: $ResourceGroupName..." -ForegroundColor Yellow

az group create `
    --name $ResourceGroupName `
    --location $Location `
    --tags `
        "environment=$Environment" `
        "owner=$Owner" `
        "costcenter=$CostCenter" `
        "application=hacker-board" `
        "workload=web-app" `
        "sla=non-production" `
        "backup-policy=none" `
        "maint-window=any" `
        "tech-contact=$TechnicalContact" `
    --output none

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Resource group creation failed. Check tag policy compliance." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Resource group ready with 9 required tags" -ForegroundColor Green

# ── Deployment parameters ─────────────────────────────────────────────────────

$deployParams = @(
    '--resource-group', $ResourceGroupName
    '--template-file', $templateFile
    '--parameters', "projectName=$ProjectName"
    '--parameters', "environment=$Environment"
    '--parameters', "location=$Location"
    '--parameters', "owner=$Owner"
    '--parameters', "costCenter=$CostCenter"
    '--parameters', "technicalContact=$TechnicalContact"
    '--parameters', "workload=web-app"
    '--parameters', "sla=non-production"
    '--parameters', "backupPolicy=none"
    '--parameters', "maintWindow=any"
    '--parameters', "containerImage=$ContainerImage"
    '--parameters', "gitHubOAuthClientId=$GitHubOAuthClientId"
    '--parameters', "gitHubOAuthClientSecret=$GitHubOAuthClientSecret"
    '--parameters', "adminUsers=$AdminUsers"
)

# Only pass uniqueSuffix when explicitly overridden. The Bicep default
# (uniqueString(resourceGroup().id)) produces a deterministic suffix from
# the RG — same RG = same names = repeatable re-deploys.
if (-not [string]::IsNullOrWhiteSpace($UniqueSuffix)) {
    $deployParams += @('--parameters', "uniqueSuffix=$UniqueSuffix")
    Write-Host "  ℹ️  Using custom uniqueSuffix: $UniqueSuffix" -ForegroundColor Yellow
}

# ── What-If preview ──────────────────────────────────────────────────────────

if ($WhatIf) {
    Write-Host ""
    Write-Host "🔍 Running what-if preview..." -ForegroundColor Yellow
    az deployment group what-if @deployParams --output table
    Write-Host ""
    Write-Host "ℹ️  What-if complete. No resources were modified." -ForegroundColor Cyan
    exit 0
}

# ── Deploy ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "🚀 Deploying all resources..." -ForegroundColor Yellow

$deployParams += @(
    '--name', "hacker-board-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    '--output', 'json'
)

$result = az deployment group create @deployParams 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Deployment failed:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

Write-Host "  ✅ Deployment completed successfully" -ForegroundColor Green
$deploymentResult = $result | ConvertFrom-Json

# ── Deployment results ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║       ✅ Deployment Complete            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📊 Deployment Results:" -ForegroundColor Cyan
Write-Host "  ┌─────────────────────────┬──────────────────────────────────────┐"
Write-Host "  │ Resource Group           │ $ResourceGroupName"
Write-Host "  │ Location                 │ $Location"
Write-Host "  │ Environment              │ $Environment"
Write-Host "  └─────────────────────────┴──────────────────────────────────────┘"

# Extract outputs from the deployment
if ($deploymentResult.properties.outputs) {
    $o = $deploymentResult.properties.outputs
    if ($o) {
        Write-Host ""
        Write-Host "  📌 Key Outputs:" -ForegroundColor Cyan
        if ($o.appServiceHostname.value) {
            Write-Host "     App URL:          https://$($o.appServiceHostname.value)"
        }
        if ($o.appServiceName.value) {
            Write-Host "     App Name:         $($o.appServiceName.value)"
        }
        if ($o.acrLoginServer.value) {
            Write-Host "     ACR Server:       $($o.acrLoginServer.value)"
        }
        if ($o.acrName.value) {
            Write-Host "     ACR Name:         $($o.acrName.value)"
        }
        if ($o.cosmosEndpoint.value) {
            Write-Host "     Cosmos Endpoint:  $($o.cosmosEndpoint.value)"
        }
        if ($o.cosmosAccountName.value) {
            Write-Host "     Cosmos Account:   $($o.cosmosAccountName.value)"
        }
        if ($o.vnetName.value) {
            Write-Host "     VNet Name:        $($o.vnetName.value)"
        }
        if ($o.privateEndpointId.value) {
            Write-Host "     Private Endpoint: $($o.privateEndpointId.value)"
        }

    }

    # ── Phase 5: Post-deploy verification ────────────────────────────────────

    Write-Host ""
    Write-Host "🔎 Phase 5: Post-deploy verification..." -ForegroundColor Yellow

    if ($o.appServiceName.value) {
        $webAppName = $o.appServiceName.value
        $appState = az webapp show `
            --name $webAppName `
            --resource-group $ResourceGroupName `
            --query "state" `
            --output tsv 2>&1
        if ($appState -eq 'Running') {
            Write-Host "  ✅ App Service: $webAppName (Running)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  App Service state: $appState" -ForegroundColor Yellow
        }
    }

    if ($o.acrName.value) {
        $acrResourceName = $o.acrName.value
        $acrState = az acr show `
            --name $acrResourceName `
            --resource-group $ResourceGroupName `
            --query "provisioningState" `
            --output tsv 2>&1
        if ($acrState -eq 'Succeeded') {
            Write-Host "  ✅ ACR: $acrResourceName (Succeeded)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  ACR provisioning state: $acrState" -ForegroundColor Yellow
        }
    }

    if ($o.cosmosAccountName.value) {
        $cosmosName = $o.cosmosAccountName.value
        $cosmosState = az cosmosdb show `
            --name $cosmosName `
            --resource-group $ResourceGroupName `
            --query "provisioningState" `
            --output tsv 2>&1
        if ($cosmosState -eq 'Succeeded') {
            Write-Host "  ✅ Cosmos DB account: $cosmosName (Succeeded)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Cosmos DB account state: $cosmosState" -ForegroundColor Yellow
        }

        $localAuthDisabled = az cosmosdb show `
            --name $cosmosName `
            --resource-group $ResourceGroupName `
            --query "disableLocalAuth" `
            --output tsv 2>&1
        if ($localAuthDisabled -eq 'true') {
            Write-Host "  ✅ disableLocalAuth: true (governance compliant)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  disableLocalAuth is not true — ModifyCosmosDBLocalAuth policy may still be remediating" -ForegroundColor Yellow
        }

        $rbacAssignments = az cosmosdb sql role assignment list `
            --account-name $cosmosName `
            --resource-group $ResourceGroupName `
            --query "length(@)" `
            --output tsv 2>&1
        if ([int]$rbacAssignments -gt 0) {
            Write-Host "  ✅ Cosmos DB RBAC: $rbacAssignments role assignment(s) found" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  No Cosmos DB SQL role assignments found — App Service MI may lack access" -ForegroundColor Yellow
        }
    }

    # App Service app settings verification
    if ($o.appServiceName.value) {
        $vnetIntegration = az webapp vnet-integration list `
            --name $o.appServiceName.value `
            --resource-group $ResourceGroupName `
            --query "length(@)" `
            --output tsv 2>&1
        if ([int]$vnetIntegration -gt 0) {
            Write-Host "  \u2705 App Service VNet integration: active" -ForegroundColor Green
        } else {
            Write-Host "  \u26a0\ufe0f  App Service VNet integration not detected" -ForegroundColor Yellow
        }
    }

    # Private Endpoint verification
    if ($o.cosmosAccountName.value) {
        $peState = az network private-endpoint list `
            --resource-group $ResourceGroupName `
            --query "[?contains(name,'cosmos')].provisioningState | [0]" `
            --output tsv 2>&1
        if ($peState -eq 'Succeeded') {
            Write-Host "  \u2705 Cosmos DB Private Endpoint: Succeeded" -ForegroundColor Green
        } elseif (-not [string]::IsNullOrEmpty($peState)) {
            Write-Host "  \u26a0\ufe0f  Cosmos DB Private Endpoint state: $peState" -ForegroundColor Yellow
        }
    }

    # Cosmos DB public network access verification
    if ($o.cosmosAccountName.value) {
        $publicAccess = az cosmosdb show `
            --name $o.cosmosAccountName.value `
            --resource-group $ResourceGroupName `
            --query "publicNetworkAccess" `
            --output tsv 2>&1
        if ($publicAccess -eq 'Disabled') {
            Write-Host "  \u2705 Cosmos DB publicNetworkAccess: Disabled (B7 compliant)" -ForegroundColor Green
        } else {
            Write-Host "  \u26a0\ufe0f  Cosmos DB publicNetworkAccess: $publicAccess" -ForegroundColor Yellow
        }
    }

    # App Service app settings verification (original)
    if ($o.appServiceName.value) {
        $cosmosEndpointSetting = az webapp config appsettings list `
            --name $o.appServiceName.value `
            --resource-group $ResourceGroupName `
            --query "[?name=='COSMOS_ENDPOINT'].value | [0]" `
            --output tsv 2>&1
        if (-not [string]::IsNullOrEmpty($cosmosEndpointSetting)) {
            Write-Host "  ✅ App Service setting COSMOS_ENDPOINT configured" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  COSMOS_ENDPOINT not found in App Service settings" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
$appUrl      = if ($o.appServiceHostname.value) { "https://$($o.appServiceHostname.value)" } else { '<app-url-from-outputs>' }
    $acrRegName  = if ($o.acrName.value) { $o.acrName.value } else { '<acr-name-from-outputs>' }

    Write-Host "ℹ️  Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Build and push container image to ACR:"
    Write-Host "     az acr build --registry $acrRegName --image hacker-board:latest ."
    Write-Host "  2. Set AZURE_CREDENTIALS in GitHub repo secrets, then push to main to trigger deploy-app.yml"
    Write-Host "  3. Configure GitHub OAuth App callback URL in your GitHub OAuth App:"
    Write-Host "     $appUrl/.auth/login/github/callback"
    Write-Host "  4. Verify: curl $appUrl/api/health"
Write-Host ""
