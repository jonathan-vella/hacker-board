---
description: "MANDATORY: Read the execution plan before ANY implementation work"
applyTo: "**/*.{js,mjs,cjs,html,css,bicep}"
---

# Execution Plan Reference

**MANDATORY**: Before starting ANY implementation task, read `docs/backlog.md`.

This file is the single source of truth for:

- Current project status and active phase
- Task dependencies (what must be done before your current task)
- Open problems and blockers
- Architectural decisions already made
- Test and validation requirements for each phase

## Before You Code

1. Read `docs/backlog.md` — check the **Current Status** table
2. Find the task you are about to work on — verify it is not blocked
3. Check the **Decision Log** — respect approved decisions
4. Check the **Problem Log** — avoid known issues

## After You Code

1. Mark completed tasks with `[x]` in `docs/backlog.md`
2. Update the **Current Status** counters
3. Log any new problems in the **Problem Log**
4. Log any new decisions in the **Decision Log**
5. Run the phase's **Validation** checks
6. Update the **Test & Validation Matrix** with pass/fail
7. Update **Session Handoff Notes** at the end of the session

## Conductor Checkpoints

When working within the Conductor's orchestrated workflow, additional
checkpoints apply at each approval gate:

1. **Before each gate**: Verify all Output Contract deliverables are complete
2. **At each gate**: Wait for explicit human approval before proceeding
3. **After each gate**: Confirm the next agent's Input Contract is satisfied
4. **Between steps**: Update `docs/backlog.md` with step completion status

The Conductor workflow steps map to execution plan phases:

| Conductor Step | Execution Plan Action                    |
| -------------- | ---------------------------------------- |
| Step 1: Plan   | Read backlog, verify task is not blocked |
| Step 2: Arch   | Check Decision Log for prior decisions   |
| Step 4: Impl   | Follow phase validation checks           |
| Step 5: Review | Check Problem Log for known issues       |
| Step 7: Docs   | Update backlog and session handoff notes |
