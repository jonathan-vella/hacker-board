#!/usr/bin/env bash

# ============================================================
# Configure SWA Deployment Auth Policy → GitHub (OIDC)
#
# Azure SWA defaults to "DeploymentToken" auth. This script
# switches it to "GitHub" so the CI/CD workflow can deploy
# via OIDC identity tokens without a deployment-token secret.
#
# The ARM/Bicep schema does NOT expose deploymentAuthPolicy as
# a writable property. The only programmatic route is an
# az rest PATCH that sends the policy AND a GitHub PAT in the
# same request body.
#
# Run once after initial infrastructure provisioning.
#
# Requires: az CLI (logged in), GitHub PAT with repo scope
# ============================================================

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"

# Defaults — override via flags or environment variables
SWA_NAME="${SWA_NAME:-swa-hacker-board-prod}"
RG_NAME="${RG_NAME:-}"
SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-}"
REPO_URL="${REPO_URL:-https://github.com/jonathan-vella/hacker-board}"
BRANCH="${BRANCH:-main}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} [OPTIONS]

Switch Azure Static Web App deployment auth from DeploymentToken to GitHub (OIDC).

Options:
  --swa-name NAME        SWA resource name       (default: ${SWA_NAME})
  --rg-name NAME         Resource group name      (required)
  --subscription ID      Azure subscription ID    (auto-detected if omitted)
  --github-token TOKEN   GitHub PAT with repo scope (or set GITHUB_TOKEN env var)
  --repo-url URL         GitHub repo URL          (default: ${REPO_URL})
  --branch NAME          Branch name              (default: ${BRANCH})
  -h, --help             Show this help

Environment Variables:
  GITHUB_TOKEN           GitHub PAT (alternative to --github-token)
  SWA_NAME, RG_NAME, SUBSCRIPTION_ID, REPO_URL, BRANCH
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --swa-name)      SWA_NAME="$2";        shift 2 ;;
    --rg-name)       RG_NAME="$2";         shift 2 ;;
    --subscription)  SUBSCRIPTION_ID="$2"; shift 2 ;;
    --github-token)  GITHUB_TOKEN="$2";    shift 2 ;;
    --repo-url)      REPO_URL="$2";        shift 2 ;;
    --branch)        BRANCH="$2";          shift 2 ;;
    -h|--help)       usage ;;
    *)               echo "Error: Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── Validate required inputs ────────────────────────────────
if [[ -z "${GITHUB_TOKEN}" ]]; then
  echo "Error: GitHub token required. Set GITHUB_TOKEN env var or use --github-token." >&2
  exit 1
fi

if [[ -z "${RG_NAME}" ]]; then
  echo "Error: Resource group name required. Use --rg-name." >&2
  exit 1
fi

if [[ -z "${SUBSCRIPTION_ID}" ]]; then
  SUBSCRIPTION_ID="$(az account show --query 'id' -o tsv)"
  echo "Auto-detected subscription: ${SUBSCRIPTION_ID}"
fi

# ── Build ARM resource URL ──────────────────────────────────
readonly RESOURCE_URL="https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}/providers/Microsoft.Web/staticSites/${SWA_NAME}?api-version=2024-04-01"

# ── Check current policy ────────────────────────────────────
echo "Checking current deployment auth policy for ${SWA_NAME}..."
CURRENT_POLICY="$(az rest --method GET --url "${RESOURCE_URL}" \
  --query 'properties.deploymentAuthPolicy' -o tsv 2>/dev/null || echo 'unknown')"
echo "  Current policy: ${CURRENT_POLICY}"

if [[ "${CURRENT_POLICY}" == "GitHub" ]]; then
  echo "Already set to GitHub — nothing to do."
  exit 0
fi

# ── PATCH to GitHub ─────────────────────────────────────────
echo "Switching deployment auth policy to GitHub..."
az rest --method PATCH --url "${RESOURCE_URL}" \
  --body "{
    \"properties\": {
      \"deploymentAuthPolicy\": \"GitHub\",
      \"repositoryToken\": \"${GITHUB_TOKEN}\",
      \"repositoryUrl\": \"${REPO_URL}\",
      \"branch\": \"${BRANCH}\"
    }
  }" --output none

# ── Verify ──────────────────────────────────────────────────
NEW_POLICY="$(az rest --method GET --url "${RESOURCE_URL}" \
  --query 'properties.deploymentAuthPolicy' -o tsv)"
echo "  New policy: ${NEW_POLICY}"

if [[ "${NEW_POLICY}" == "GitHub" ]]; then
  echo "Done — deployment auth policy is now GitHub (OIDC)."
else
  echo "Error: Policy is '${NEW_POLICY}', expected 'GitHub'." >&2
  exit 1
fi
