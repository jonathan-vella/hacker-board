<#
.SYNOPSIS
    Deploys hacker-board Azure infrastructure using Bicep templates.

.DESCRIPTION
    Provisions Azure Static Web App, Azure SQL Database (Basic DTU), Log Analytics,
    and Application Insights for the microhack HackerBoard app.
    After a successful deployment, optionally runs the SQL schema script and sends
    an admin invitation to the Static Web App.

.PARAMETER ResourceGroupName
    Name of the resource group. Default: rg-hacker-board-prod

.PARAMETER Location
    Azure region for all resources. Default: westeurope

.PARAMETER Environment
    Deployment environment (dev, staging, prod). Default: prod

.PARAMETER Owner
    Resource owner identifier. Default: agentic-infraops

.PARAMETER CostCenter
    Cost center code required by Azure Policy.

.PARAMETER TechnicalContact
    Technical contact email required by Azure Policy.

.PARAMETER SqlAdminObjectId
    Deprecated — no longer used. The deployment UAMI created by Bicep is the SQL
    Entra admin. Kept as an accepted parameter so existing scripts do not break.

.PARAMETER AdminEmail
    GitHub email address of the first admin to invite to the Static Web App.
    If provided, an invitation will be sent after deployment.

.PARAMETER SkipSchema
    Skip the post-deployment SQL schema migration step.

.PARAMETER RepositoryUrl
    GitHub repository URL for Static Web App linkage.

.PARAMETER WhatIf
    Run what-if preview without deploying.

.EXAMPLE
    ./deploy.ps1 -CostCenter "microhack" -TechnicalContact "team@contoso.com" -SqlAdminObjectId "<oid>"

.EXAMPLE
    ./deploy.ps1 -WhatIf -CostCenter "microhack" -TechnicalContact "team@contoso.com"
#>

[CmdletBinding()]
param(
    [string]$ResourceGroupName = 'rg-hacker-board-prod',
    [string]$Location = 'westeurope',

    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'prod',

    [string]$Owner = 'agentic-infraops',

    [Parameter(Mandatory)]
    [string]$CostCenter,

    [Parameter(Mandatory)]
    [string]$TechnicalContact,

    [string]$SqlAdminObjectId = '',
    [string]$AdminEmail = '',
    [switch]$SkipSchema,
    [string]$RepositoryUrl = '',
    [string]$RepositoryBranch = 'main',
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

$bicepVersion = az bicep version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Bicep CLI not found. Run 'az bicep install'." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Bicep: $bicepVersion" -ForegroundColor Green

# ── Validate templates ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "📋 Validating Bicep templates..." -ForegroundColor Yellow

$templateFile = Join-Path $PSScriptRoot 'main.bicep'
$paramFile = Join-Path $PSScriptRoot 'main.bicepparam'

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
        "workload=hacker-board" `
        "sla=99.9%" `
        "backup-policy=none" `
        "maint-window=sat-02-06-utc" `
        "technical-contact=$TechnicalContact" `
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
    '--parameters', "projectName=hacker-board"
    '--parameters', "environment=$Environment"
    '--parameters', "location=$Location"
    '--parameters', "owner=$Owner"
    '--parameters', "costCenter=$CostCenter"
    '--parameters', "technicalContact=$TechnicalContact"
    '--parameters', "repositoryUrl=$RepositoryUrl"
    '--parameters', "repositoryBranch=$RepositoryBranch"
)
if ($AdminEmail -ne '') {
    $deployParams += @('--parameters', "adminEmail=$AdminEmail")
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
        if ($o.swaHostname.value) {
            Write-Host "     SWA URL:      https://$($o.swaHostname.value)"
        }
        if ($o.swaName.value) {
            Write-Host "     SWA Name:     $($o.swaName.value)"
        }
        if ($o.sqlServerFqdn.value) {
            Write-Host "     SQL Server:   $($o.sqlServerFqdn.value)"
        }
        if ($o.sqlDatabaseName.value) {
            Write-Host "     SQL DB:       $($o.sqlDatabaseName.value)"
        }
        if ($o.deploymentIdentityName.value) {
            Write-Host "     Deploy UAMI:  $($o.deploymentIdentityName.value)  (SQL Entra admin)"
        }
        if ($o.deploymentIdentityPrincipalId.value) {
            Write-Host "     UAMI OID:     $($o.deploymentIdentityPrincipalId.value)  ← assign Directory Readers in Entra ID" -ForegroundColor Yellow
        }
    }

    # ── Post-deploy: SQL schema + grants ─────────────────────────────────────
    # Schema migration and db_owner grants run automatically inside the VNet
    # via an Azure Container Instance (Bicep deploymentScript in sql-grant.bicep).
    # No public SQL access is needed — everything runs behind the private endpoint.
    Write-Host ""
    Write-Host "  🗃️  SQL schema migration and SWA db_owner grant are handled" -ForegroundColor Green
    Write-Host "     automatically by the sql-grant Bicep deployment script." -ForegroundColor Green
    Write-Host "  ⚠️  PREREQUISITE: The SQL server's managed identity must have" -ForegroundColor Yellow
    Write-Host "     the Entra ID 'Directory Readers' role assigned — otherwise" -ForegroundColor Yellow
    Write-Host "     CREATE USER FROM EXTERNAL PROVIDER will fail." -ForegroundColor Yellow
    if ($o -and $o.deploymentIdentityPrincipalId.value) {
        Write-Host "     Assign: Portal → Entra ID → Roles → Directory Readers → Add member" -ForegroundColor Yellow
        Write-Host "             Object ID: $($o.deploymentIdentityPrincipalId.value)" -ForegroundColor Yellow
    }

    # ── Post-deploy: Admin invitation ────────────────────────────────────────
    if ($AdminEmail -ne '' -and $o -and $o.swaName.value) {
        Write-Host ""
        Write-Host "  📧 Sending admin invitation to $AdminEmail..." -ForegroundColor Yellow
        $scriptRoot = Split-Path -Parent $PSScriptRoot
        bash "$scriptRoot/scripts/invite-admin.sh" `
            --app "$($o.swaName.value)" `
            --rg "$ResourceGroupName" `
            --email "$AdminEmail"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Admin invitation sent" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Admin invitation failed — run invite-admin.sh manually" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "ℹ️  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Assign 'Directory Readers' Entra ID role to the SQL server managed identity"
Write-Host "     (needed so 'CREATE USER FROM EXTERNAL PROVIDER' can resolve principals)"
Write-Host "  2. Re-run: az deployment group create ... (the sql-grant script will then succeed)"
Write-Host "  3. Set AZURE_STATIC_WEB_APPS_API_TOKEN in GitHub repo secrets then push to main"
Write-Host "  4. Accept the admin invitation in your email (expires in 24 hours)"
Write-Host "  5. To add more admins: ./scripts/invite-admin.sh --app <name> --rg <rg> --email <email>"
Write-Host ""
