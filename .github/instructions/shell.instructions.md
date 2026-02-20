---
description: "Shell scripting best practices for bash scripts"
applyTo: "**/*.sh"
---

# Shell Scripting Guidelines

Instructions for writing clean, safe, and maintainable shell scripts.

## General Principles

- Write code that is clean, simple, and concise
- Add comments where helpful for understanding how the script works
- Use concise echo outputs to provide execution status
- Use shellcheck for static analysis when available
- Double-quote variable references (`"$var"`)
- Use `${var}` for clarity
- Avoid `eval`
- Use modern Bash features (`[[ ]]`, `local`, arrays)

## Error Handling and Safety

- Enable `set -euo pipefail` to fail fast on errors, catch unset
  variables, and surface pipeline failures
- Validate all required parameters before execution
- Provide clear error messages with context
- Use `trap` to clean up temporary resources on exit
- Declare immutable values with `readonly`
- Use `mktemp` for temporary files and clean up in trap handler

## Script Structure

- Start with shebang: `#!/usr/bin/env bash`
- Include a header comment explaining the script's purpose
- Define default values for all variables at the top
- Use functions for reusable code blocks
- Keep the main execution flow clean and readable

## Working with JSON

- Prefer `jq` for JSON parsing over `grep`/`awk`/string splitting
- Validate that required fields exist
- Quote jq filters to prevent shell expansion
- Use `--raw-output` when you need plain strings
- Treat parser errors as fatal
- Fail fast with a helpful message if `jq` is required but not
  installed

## Template

```bash
#!/usr/bin/env bash

# ============================================================
# Script Description Here
# ============================================================

set -euo pipefail

cleanup() {
    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup EXIT

readonly SCRIPT_NAME="$(basename "$0")"

RESOURCE_GROUP=""
TEMP_DIR=""

usage() {
    echo "Usage: $SCRIPT_NAME [OPTIONS]"
    echo "Options:"
    echo "  -g, --resource-group   Resource group (required)"
    echo "  -h, --help             Show this help"
    exit 0
}

validate_requirements() {
    if [[ -z "$RESOURCE_GROUP" ]]; then
        echo "Error: Resource group is required" >&2
        exit 1
    fi
}

main() {
    validate_requirements

    TEMP_DIR="$(mktemp -d)"

    echo "Script Execution Started"
    # Main logic here
    echo "Script Execution Completed"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

main "$@"
```
