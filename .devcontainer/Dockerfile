# Multi-arch base: mcr.microsoft.com/devcontainers/javascript-node publishes
# manifests for both linux/amd64 and linux/arm64.
FROM mcr.microsoft.com/devcontainers/javascript-node:22-bookworm

# Azure Functions Core Tools v4 — installs the arch-appropriate package
RUN curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/microsoft.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
       > /etc/apt/sources.list.d/azure-functions.list \
    && apt-get update \
    && apt-get install -y azure-functions-core-tools-4 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Azurite (Azure Storage emulator) — pure JS, runs on any arch
RUN su node -c "npm install -g azurite"

# Azure Static Web Apps CLI
RUN su node -c "npm install -g @azure/static-web-apps-cli"
