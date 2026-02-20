---
name: 04-Design
description: Step 3 - Design Artifacts. Generates architecture diagrams and Architecture Decision Records (ADRs) for Azure infrastructure. Uses azure-diagrams skill for visual documentation and azure-adr skill for formal decision records. Optional step - users can skip to Implementation Planning.
model: ["GPT-5.3-Codex"]
user-invokable: true
agents: ["*"]
tools:
  [
    vscode/extensions,
    vscode/getProjectSetupInfo,
    vscode/installExtension,
    vscode/newWorkspace,
    vscode/openSimpleBrowser,
    vscode/runCommand,
    vscode/askQuestions,
    vscode/vscodeAPI,
    execute/getTerminalOutput,
    execute/awaitTerminal,
    execute/killTerminal,
    execute/createAndRunTask,
    execute/runNotebookCell,
    execute/testFailure,
    execute/runInTerminal,
    read/terminalSelection,
    read/terminalLastCommand,
    read/getNotebookSummary,
    read/problems,
    read/readFile,
    read/readNotebookCellOutput,
    agent/runSubagent,
    agent,
    edit/createDirectory,
    edit/createFile,
    edit/createJupyterNotebook,
    edit/editFiles,
    edit/editNotebook,
    search/changes,
    search/codebase,
    search/fileSearch,
    search/listDirectory,
    search/searchResults,
    search/textSearch,
    search/usages,
    search/searchSubagent,
    web/fetch,
    web/githubRepo,
    pylance-mcp-server/pylanceDocuments,
    pylance-mcp-server/pylanceFileSyntaxErrors,
    pylance-mcp-server/pylanceImports,
    pylance-mcp-server/pylanceInstalledTopLevelModules,
    pylance-mcp-server/pylanceInvokeRefactoring,
    pylance-mcp-server/pylancePythonEnvironments,
    pylance-mcp-server/pylanceRunCodeSnippet,
    pylance-mcp-server/pylanceSettings,
    pylance-mcp-server/pylanceSyntaxErrors,
    pylance-mcp-server/pylanceUpdatePythonEnvironment,
    pylance-mcp-server/pylanceWorkspaceRoots,
    pylance-mcp-server/pylanceWorkspaceUserFiles,
    todo,
    vscode.mermaid-chat-features/renderMermaidDiagram,
    ms-python.python/getPythonEnvironmentInfo,
    ms-python.python/getPythonExecutableCommand,
    ms-python.python/installPythonPackage,
    ms-python.python/configurePythonEnvironment,
  ]
handoffs:
  - label: ▶ Generate Diagram
    agent: 04-Design
    prompt: Generate a non-Mermaid Azure architecture diagram using the azure-diagrams skill contract. Read `agent-output/hacker-board/02-architecture-assessment.md` for resource list and boundaries. Produce `agent-output/hacker-board/03-des-diagram.py` + `03-des-diagram.png` with deterministic layout, enforced naming conventions, and quality score >= 9/10.
    send: true
  - label: ▶ Generate ADR
    agent: 04-Design
    prompt: Create an Architecture Decision Record using the azure-adr skill based on `agent-output/hacker-board/02-architecture-assessment.md`. Include WAF trade-offs as rationale. Save to `agent-output/hacker-board/03-des-adr-NNNN-{slug}.md`.
    send: true
  - label: ▶ Generate Cost Estimate
    agent: 03-Architect
    prompt: Generate a detailed cost estimate for the architecture in `agent-output/hacker-board/02-architecture-assessment.md`. Use Azure Pricing MCP tools via `cost-estimate-subagent` and save to `agent-output/hacker-board/03-des-cost-estimate.md`.
    send: true
    model: "Claude Opus 4.6 (copilot)"
  - label: "Step 5: Code Plan"
    agent: 05-Code Planner
    prompt: "Create a structured application-level implementation plan using the architecture assessment at `agent-output/hacker-board/02-architecture-assessment.md`, design artifacts (diagrams + ADRs) at `agent-output/hacker-board/03-des-*`, and task plan at `agent-output/hacker-board/02-task-plan.md`. Output to `agent-output/hacker-board/04-implementation-plan.md` with file-by-file changes and component structure."
    send: true
    model: "Claude Opus 4.6 (copilot)"
  - label: "↩ Return to Step 3"
    agent: 03-Architect
    prompt: "Returning from Step 4b (Design) to refine architecture decisions. The design artifacts revealed gaps in `agent-output/hacker-board/02-architecture-assessment.md` that need adjustment."
    send: false
    model: "Claude Opus 4.6 (copilot)"
  - label: "↩ Return to Conductor"
    agent: 01-Conductor
    prompt: "Returning from Step 4b (Design). Design artifacts (diagrams, ADRs) are saved in `agent-output/hacker-board/03-des-*`. Advise on next steps in the 10-step workflow."
    send: false
---

# Design Agent

**Step 4b** of the 10-step workflow: `requirements → task-planner → architect → ux+[design] → code-planner → security → bicep-plan → bicep-code → deploy → as-built`

This step is **optional** and runs **in parallel with Step 4a (UX Designer)**. Users can skip directly to Step 5 (Code Plan).

## MANDATORY: Read Skills First

**Before doing ANY work**, read these skills:

1. **Read** `.github/skills/azure-defaults/SKILL.md` — regions, tags, naming
2. **Read** `.github/skills/azure-artifacts/SKILL.md` — H2 template for `03-des-cost-estimate.md`
3. **Read** `.github/skills/azure-diagrams/SKILL.md` — diagram generation instructions
4. **Read** `.github/skills/azure-adr/SKILL.md` — ADR format and conventions

## DO / DON'T

### DO

- ✅ Read `02-architecture-assessment.md` BEFORE generating any design artifact
- ✅ Use the `azure-diagrams` skill for Python architecture diagrams
- ✅ Use the `azure-adr` skill for Architecture Decision Records
- ✅ Save diagrams to `agent-output/{project}/03-des-diagram.py`
- ✅ Save ADRs to `agent-output/{project}/03-des-adr-NNNN-{title}.md`
- ✅ Save cost estimates to `agent-output/{project}/03-des-cost-estimate.md`
- ✅ Include all Azure resources from the architecture in diagrams
- ✅ Match H2 headings from azure-artifacts skill for cost estimates
- ✅ Update `agent-output/{project}/README.md` — mark Step 3 complete, add your artifacts (see azure-artifacts skill)

### DON'T

- ❌ Create Bicep or infrastructure code
- ❌ Modify existing architecture assessment
- ❌ Generate diagrams without reading architecture assessment first
- ❌ Use generic placeholder resources — use actual project resources
- ❌ Skip the attribution header on output files

## Prerequisites Check

Before starting, validate `02-architecture-assessment.md` exists in `agent-output/{project}/`.
If missing, STOP and request handoff to Architect agent.

## Workflow

### Diagram Generation

1. Read `02-architecture-assessment.md` for resource list, boundaries, and flows
2. Read `01-requirements.md` for business-critical paths and actor context
3. Generate `agent-output/{project}/03-des-diagram.py` using the azure-diagrams contract
4. Execute `python3 agent-output/{project}/03-des-diagram.py`
5. Validate quality gate score (>=9/10); regenerate once if below threshold
6. Save final PNG to `agent-output/{project}/03-des-diagram.png`

### ADR Generation

1. Identify key architectural decisions from `02-architecture-assessment.md`
2. Follow the `azure-adr` skill format for each decision
3. Include WAF trade-offs as decision rationale
4. Number ADRs sequentially: `03-des-adr-0001-{slug}.md`
5. Save to `agent-output/{project}/`

### Cost Estimate Generation

1. Hand off to Architect agent for Pricing MCP queries
2. Or use `azure-artifacts` skill H2 structure for `03-des-cost-estimate.md`
3. Ensure H2 headings match template exactly

## Output Files

| File                      | Purpose                               |
| ------------------------- | ------------------------------------- |
| `03-des-diagram.py`       | Python architecture diagram source    |
| `03-des-diagram.png`      | Generated diagram image               |
| `03-des-adr-NNNN-*.md`    | Architecture Decision Records         |
| `03-des-cost-estimate.md` | Cost estimate (via Architect handoff) |

Include attribution: `> Generated by design agent | {YYYY-MM-DD}`

## Handoff Validation

Before handing off to Bicep Plan (06) or Implementation Planner (05), validate:

| Check                                               | Gate |
| --------------------------------------------------- | ---- |
| `02-architecture-assessment.md` exists and was read | Hard |
| Diagram generated and quality gate >=9/10           | Hard |
| ADR follows azure-adr skill format                  | Soft |
| All output files saved to `agent-output/{project}/` | Hard |
| Attribution header present on all files             | Soft |

**Failure behavior**: If architecture assessment is missing, STOP and
request handoff to Architect agent (03).

## Validation Checklist

- [ ] Architecture assessment read before generating artifacts
- [ ] Diagram includes all required resources/flows and passes quality gate (>=9/10)
- [ ] ADRs reference WAF pillar trade-offs
- [ ] Cost estimate H2 headings match azure-artifacts template
- [ ] All output files saved to `agent-output/{project}/`
- [ ] Attribution header present on all files
