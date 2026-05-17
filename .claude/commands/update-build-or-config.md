---
name: update-build-or-config
description: Workflow command scaffold for update-build-or-config in node-ts-api-gateway.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-build-or-config

Use this workflow when working on **update-build-or-config** in `node-ts-api-gateway`.

## Goal

Updates build, lint, test, or CI configuration files to change tooling or quality gates.

## Common Files

- `eslint.config.js`
- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `tsconfig.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or add the relevant configuration file (e.g., eslint.config.js, vitest.config.ts, .github/workflows/ci.yml, tsconfig.json).
- Commit with a 'build' or 'fix' message describing the config change.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.