#!/usr/bin/env bash
set -euo pipefail

# Install root-level dependencies (SWA CLI dev dep)
npm install

# Install API dependencies
cd api && npm install && cd ..

# Create Azurite data directory
mkdir -p .azurite

# Seed local API settings if they don't exist
if [ ! -f api/local.settings.json ]; then
  cat > api/local.settings.json <<'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
EOF
fi

echo "✔ Dev container ready — run 'npm start' to launch the SWA emulator."
