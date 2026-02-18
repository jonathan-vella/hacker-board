---
description: "Infrastructure as Code best practices for Azure Bicep templates"
applyTo: "**/*.bicep,**/*.bicepparam"
---

# Bicep Development Best Practices

## Quick Reference

| Rule          | Standard                                                            |
| ------------- | ------------------------------------------------------------------- |
| Region        | `westeurope` (SWA), `swedencentral` (other resources)               |
| Unique suffix | `var uniqueSuffix = uniqueString(resourceGroup().id)` in main.bicep |
| AVM first     | **MANDATORY** — Use Azure Verified Modules where available          |
| Tags          | Environment, ManagedBy, Project, Owner on ALL resources             |

## Naming Conventions

### Identifiers

- Use lowerCamelCase for all names (parameters, variables, resources, modules)
- Use resource type descriptive symbolic names (e.g., `storageAccount` not `storageAccountName`)
- Avoid using `name` in a symbolic name — it represents the resource, not the resource's name
- Avoid distinguishing variables and parameters by suffixes

### Resource Name Patterns

| Resource       | Max | Pattern                       | Example               |
| -------------- | --- | ----------------------------- | --------------------- |
| Storage        | 24  | `st{project}{env}{suffix}`    | `sthkboarddev7xk2`    |
| Key Vault      | 24  | `kv-{project}-{env}-{suffix}` | `kv-hkboard-dev-abc1` |
| Static Web App | 40  | `swa-{project}-{env}`         | `swa-hkboard-dev`     |

## Unique Names (CRITICAL)

```bicep
// main.bicep — Generate once, pass to ALL modules
var uniqueSuffix = uniqueString(resourceGroup().id)

module storage 'modules/storage.bicep' = {
  params: { uniqueSuffix: uniqueSuffix }
}

// Every module must accept uniqueSuffix and use it in resource names
var storageName = 'st${take(projectName, 10)}${environment}${take(uniqueSuffix, 6)}'
```

## Structure and Declaration

- Always declare parameters at the top of files with `@description` decorators
- Use latest stable API versions for all resources
- Specify minimum and maximum character length for naming parameters
- Set default values that are safe for test environments (low-cost tiers)
- Use `@allowed` decorator sparingly to avoid blocking valid deployments

## Parameters

```bicep
@description('Azure region for all resources.')
@allowed(['westeurope', 'swedencentral', 'northeurope'])
param location string = 'westeurope'

@description('Unique suffix for resource naming.')
@minLength(5)
param uniqueSuffix string
```

## Variables

- Variables automatically infer type from the resolved value
- Use variables to contain complex expressions instead of embedding
  them directly in resource properties

## Resource References

- Use symbolic names instead of `reference()` or `resourceId()` functions
- Create dependencies through symbolic names (`resourceA.id`) not explicit `dependsOn`
- Use the `existing` keyword to access properties from other resources

## Security Defaults (MANDATORY)

```bicep
// Storage
supportsHttpsTrafficOnly: true
minimumTlsVersion: 'TLS1_2'
allowBlobPublicAccess: false
allowSharedKeyAccess: false
```

- Never include secrets or keys in outputs
- Use resource properties directly in outputs

## Module Outputs (MANDATORY)

```bicep
// Every module must output BOTH ID and Name
output resourceId string = resource.id
output resourceName string = resource.name
```

## Azure Verified Modules (AVM)

**MANDATORY: Use AVM modules for ALL resources where an AVM module exists.**

Raw Bicep is only permitted when no AVM module exists AND user
explicitly approves. Document the rationale.

```bicep
// Use AVM
module staticWebApp 'br/public:avm/res/web/static-site:0.5.0' = {
  params: { name: swaName, location: location, tags: tags }
}
```

### AVM Workflow

1. **Check AVM availability**: https://aka.ms/avm/index
2. **If AVM exists**: Use `br/public:avm/res/{service}/{resource}:{version}`
3. **If no AVM**: Ask user before proceeding with raw Bicep
4. **Pin versions**: Always pin to specific AVM version
5. **Lint**: Always run `bicep lint` after making changes

## Child Resources

- Avoid excessive nesting of child resources
- Use `parent` property or nesting instead of constructing resource
  names for child resources

## Patterns to Avoid

| Anti-Pattern           | Problem      | Solution                        |
| ---------------------- | ------------ | ------------------------------- |
| Hardcoded names        | Collisions   | Use `uniqueString()` suffix     |
| Missing `@description` | Poor docs    | Document all parameters         |
| Explicit `dependsOn`   | Unnecessary  | Use symbolic references         |
| Raw Bicep (no AVM)     | Policy drift | Use AVM modules or get approval |

## Validation Commands

Run these in order after every Bicep change:

```bash
# 1. Lint for style and correctness
bicep lint infra/main.bicep

# 2. Rebuild the compiled ARM template — MANDATORY before committing
#    The Portal "Deploy to Azure" button reads azuredeploy.json, not main.bicep.
#    Skipping this causes stale parameter defaults in the Portal.
az bicep build --file infra/main.bicep --outfile infra/azuredeploy.json

# 3. Optional: validate against a real resource group
az deployment group what-if --resource-group rg-example --template-file infra/azuredeploy.json
```

> **Rule**: Always commit `main.bicep` and `azuredeploy.json` together. Never commit one without the other.
