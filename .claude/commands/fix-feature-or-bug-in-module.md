---
name: fix-feature-or-bug-in-module
description: Workflow command scaffold for fix-feature-or-bug-in-module in node-ts-api-gateway.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /fix-feature-or-bug-in-module

Use this workflow when working on **fix-feature-or-bug-in-module** in `node-ts-api-gateway`.

## Goal

Fixes or improves a specific feature or module by modifying its main implementation file.

## Common Files

- `src/middleware/auth.ts`
- `src/plugins/requestContext.ts`
- `src/server.ts`
- `src/middleware/ddos.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify the module or feature with the issue.
- Edit the main implementation file in src/ (e.g., src/middleware/auth.ts, src/plugins/requestContext.ts, src/server.ts, src/middleware/ddos.ts).
- Commit with a 'fix' message describing the change.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.