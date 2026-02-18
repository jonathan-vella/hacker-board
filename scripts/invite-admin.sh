#!/usr/bin/env bash
# invite-admin.sh
# Invite a user as admin to the Azure Static Web App via GitHub OAuth.
#
# Usage:
#   ./scripts/invite-admin.sh --app <swa-name> --rg <resource-group> --email <github-email>
#
# Prerequisites:
#   az login                     — Azure CLI logged in
#   az extension add --name staticwebapp  — SWA extension installed
#
# Required arguments:
#   --app    Static Web App resource name
#   --rg     Resource group name
#   --email  GitHub email address of the user to invite
#
# Optional:
#   --role   Role to assign (default: admin). Use "member" for view-only.

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
ROLE="admin"
APP_NAME=""
RESOURCE_GROUP=""
EMAIL=""

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)   APP_NAME="$2";       shift 2 ;;
    --rg)    RESOURCE_GROUP="$2"; shift 2 ;;
    --email) EMAIL="$2";          shift 2 ;;
    --role)  ROLE="$2";           shift 2 ;;
    *)
      echo "❌  Unknown argument: $1"
      echo "Usage: $0 --app <swa-name> --rg <resource-group> --email <github-email> [--role admin|member]"
      exit 1
      ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$APP_NAME" || -z "$RESOURCE_GROUP" || -z "$EMAIL" ]]; then
  echo "❌  Missing required arguments."
  echo "Usage: $0 --app <swa-name> --rg <resource-group> --email <github-email> [--role admin|member]"
  exit 1
fi

if [[ "$ROLE" != "admin" && "$ROLE" != "member" ]]; then
  echo "❌  Invalid role: $ROLE. Must be 'admin' or 'member'."
  exit 1
fi

# ── Pre-flight ────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  HackerBoard — Invite Admin              ║"
echo "╚══════════════════════════════════════════╝"
echo "  SWA:    $APP_NAME"
echo "  RG:     $RESOURCE_GROUP"
echo "  Email:  $EMAIL"
echo "  Role:   $ROLE"
echo ""

if ! az account show --output none 2>/dev/null; then
  echo "❌  Not logged into Azure. Run 'az login --use-device-code' first."
  exit 1
fi

# Validate SWA extension is available
if ! az staticwebapp --help &>/dev/null; then
  echo "⚠️  SWA extension may not be installed. Running: az extension add --name staticwebapp"
  az extension add --name staticwebapp --yes
fi

# ── Invite ────────────────────────────────────────────────────────────────────
echo "📧 Generating invitation link..."

INVITE_URL=$(az staticwebapp users invite \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --authentication-provider GitHub \
  --user-details "$EMAIL" \
  --role "$ROLE" \
  --invitation-expiration-in-hours 24 \
  --query "properties.expirationDate" \
  --output tsv 2>/dev/null || true)

# The command returns the expiration date; get the full output as JSON for the link
RESULT=$(az staticwebapp users invite \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --authentication-provider GitHub \
  --user-details "$EMAIL" \
  --role "$ROLE" \
  --invitation-expiration-in-hours 24 \
  --output json)

INVITE_LINK=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('invitationUrl',''))" 2>/dev/null || echo "")

echo ""
echo "✅ Invitation created successfully!"
echo ""
echo "  Share this link with $EMAIL:"
if [[ -n "$INVITE_LINK" ]]; then
  echo "  $INVITE_LINK"
else
  echo "  (Check Azure Portal → Static Web Apps → $APP_NAME → Role Management)"
fi
echo ""
echo "  ⚠️  Link expires in 24 hours. The user must be logged into GitHub."
echo "  ℹ️  They will be granted the '$ROLE' role on acceptance."
echo ""
