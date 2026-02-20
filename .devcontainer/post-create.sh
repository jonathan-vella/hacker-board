#!/usr/bin/env bash
set -euo pipefail

# ─── Progress Tracking ────────────────────────────────────────────────────────

TOTAL_STEPS=6
CURRENT_STEP=0
SETUP_START=$(date +%s)
STEP_START=0
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

step_start() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    STEP_START=$(date +%s)
    printf "\n [%d/%d] %s %s\n" "$CURRENT_STEP" "$TOTAL_STEPS" "$1" "$2"
}

step_done() {
    local elapsed=$(( $(date +%s) - STEP_START ))
    [[ $elapsed -lt 0 ]] && elapsed=0
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "        ✅ %s (%ds)\n" "${1:-Done}" "$elapsed"
}

step_warn() {
    local elapsed=$(( $(date +%s) - STEP_START ))
    [[ $elapsed -lt 0 ]] && elapsed=0
    WARN_COUNT=$((WARN_COUNT + 1))
    printf "        ⚠️  %s (%ds)\n" "${1:-Completed with warnings}" "$elapsed"
}

step_fail() {
    local elapsed=$(( $(date +%s) - STEP_START ))
    [[ $elapsed -lt 0 ]] && elapsed=0
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "        ❌ %s (%ds)\n" "${1:-Failed}" "$elapsed"
}

# ─── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 🏄 HackerBoard — Dev Container Setup"
echo "    $TOTAL_STEPS steps · $(date '+%H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Tee all output to a log file for post-hoc debugging
exec 1> >(tee -a ~/.devcontainer-install.log)
exec 2>&1

# ─── Step 1: Root npm dependencies ───────────────────────────────────────────

step_start "📦" "Installing root npm dependencies..."
if npm install --loglevel=warn 2>&1 | tail -3; then
    npm audit fix --silent 2>/dev/null || true
    step_done "Root packages installed"
else
    step_warn "npm install had issues, continuing"
fi

# ─── Step 2: API npm dependencies ────────────────────────────────────────────

step_start "📦" "Installing api/ npm dependencies..."
if (cd api && npm install --loglevel=warn 2>&1 | tail -3); then
    step_done "API packages installed"
else
    step_warn "api npm install had issues, continuing"
fi

# ─── Step 3: Directories & seed configs ──────────────────────────────────────

step_start "📁" "Creating directories and seeding config files..."

mkdir -p .azurite

git config --global --add safe.directory "${PWD}" 2>/dev/null || true
git config --global core.autocrlf input 2>/dev/null || true

if [[ ! -f api/local.settings.json ]]; then
    cat > api/local.settings.json <<'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
EOF
    step_done ".azurite/ created, local.settings.json seeded, git configured"
else
    step_done ".azurite/ created, local.settings.json already exists, git configured"
fi

# ─── Step 4: PowerShell Az modules ───────────────────────────────────────────

step_start "🔧" "Installing Azure PowerShell modules..."
if command -v pwsh &>/dev/null; then
    pwsh -NoProfile -Command "
        \$ErrorActionPreference = 'SilentlyContinue'
        Set-PSRepository -Name PSGallery -InstallationPolicy Trusted

        \$modules = @('Az.Accounts', 'Az.Resources', 'Az.ManagedServiceIdentity')
        \$toInstall = \$modules | Where-Object { -not (Get-Module -ListAvailable -Name \$_) }

        if (\$toInstall.Count -eq 0) {
            Write-Host '        All Az modules already installed'
            exit 0
        }

        Write-Host \"        Installing \$(\$toInstall.Count) module(s): \$(\$toInstall -join ', ')\"
        \$jobs = \$toInstall | ForEach-Object {
            Start-Job -ScriptBlock {
                param(\$m)
                Install-Module -Name \$m -Scope CurrentUser -Force -AllowClobber \`
                    -SkipPublisherCheck -ErrorAction SilentlyContinue
            } -ArgumentList \$_
        }
        \$jobs | Wait-Job -Timeout 120 | Out-Null
        \$jobs | Remove-Job -Force
    " && step_done "Az.Accounts, Az.Resources, Az.ManagedServiceIdentity installed" \
      || step_warn "PowerShell module installation incomplete — re-run pwsh manually"
else
    step_fail "pwsh not found — rebuild the container to apply the PowerShell feature"
fi

# ─── Step 5: Azure CLI configuration ─────────────────────────────────────────

step_start "☁️ " "Configuring Azure CLI defaults..."
if az config set defaults.location=eastus --only-show-errors 2>/dev/null; then
    az config set auto-upgrade.enable=no --only-show-errors 2>/dev/null || true
    step_done "Default region: eastus, auto-upgrade: off"
else
    step_warn "Azure CLI config skipped (not authenticated yet — run 'az login')"
fi

# ─── Step 6: Final verification ──────────────────────────────────────────────

step_start "🔍" "Verifying tool installations..."
echo ""
printf "        %-16s %s\n" "Node.js:"    "$(node --version 2>/dev/null || echo '❌ not found')"
printf "        %-16s %s\n" "npm:"        "$(npm --version 2>/dev/null || echo '❌ not found')"
printf "        %-16s %s\n" "Azure CLI:"  "$(az --version 2>/dev/null | head -1 || echo '❌ not found')"
printf "        %-16s %s\n" "Bicep:"      "$(az bicep version 2>/dev/null | head -1 || echo '❌ not found')"
printf "        %-16s %s\n" "Functions:"  "$(func --version 2>/dev/null || echo '❌ not found')"
printf "        %-16s %s\n" "GitHub CLI:" "$(gh --version 2>/dev/null | head -1 || echo '❌ not found')"
printf "        %-16s %s\n" "PowerShell:" "$(pwsh --version 2>/dev/null || echo '❌ not found — rebuild container')"
printf "        %-16s %s\n" "Graphviz:"   "$(dot -V 2>&1 | head -1 || echo '❌ not found')"
printf "        %-16s %s\n" "Python:"     "$(python3 --version 2>/dev/null || echo '❌ not found')"
echo ""
step_done "All verifications complete"

# ─── Summary ─────────────────────────────────────────────────────────────────

TOTAL_ELAPSED=$(( $(date +%s) - SETUP_START ))
MINUTES=$((TOTAL_ELAPSED / 60))
SECS=$((TOTAL_ELAPSED % 60))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $FAIL_COUNT -eq 0 && $WARN_COUNT -eq 0 ]]; then
    printf " ✅ Setup complete! %d/%d steps passed (%dm %ds)\n" \
        "$PASS_COUNT" "$TOTAL_STEPS" "$MINUTES" "$SECS"
elif [[ $FAIL_COUNT -eq 0 ]]; then
    printf " ⚠️  Setup complete with warnings: %d passed, %d warnings (%dm %ds)\n" \
        "$PASS_COUNT" "$WARN_COUNT" "$MINUTES" "$SECS"
else
    printf " ❌ Setup finished with errors: %d passed, %d warnings, %d failed (%dm %ds)\n" \
        "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT" "$MINUTES" "$SECS"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " 📝 Next steps:"
echo "    1. Authenticate:  az login --use-device-code"
echo "    2. Run tests:     npm run test:all"
echo "    3. Start local:   npm start  (SWA emulator on :4280)"
echo "    4. Deploy:        cd infra && pwsh deploy.ps1 -WhatIf -CostCenter x -TechnicalContact y"
echo ""