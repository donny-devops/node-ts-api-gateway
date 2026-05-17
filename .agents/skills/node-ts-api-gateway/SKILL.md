```markdown
# node-ts-api-gateway Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the key development patterns, coding conventions, and common workflows for contributing to the `node-ts-api-gateway` project. This TypeScript codebase uses the Fastify framework to build an API gateway, following clear conventions for file structure, code style, and commit messages. You'll learn how to fix features, update configurations, and write tests in a way that fits seamlessly with the existing project.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `requestContext.ts`, `ddos.ts`

### Import Style
- Use **relative imports** for internal modules.
  ```typescript
  import authMiddleware from './auth';
  import requestContext from '../plugins/requestContext';
  ```

### Export Style
- Use **default exports** for modules.
  ```typescript
  export default function ddosProtection() { /* ... */ }
  ```

### Commit Messages
- Follow **conventional commit** types.
- Common prefixes: `fix`, `build`, `test`
- Keep messages concise (~53 characters on average).
  - Example: `fix: correct auth middleware token validation`

## Workflows

### Fix Feature or Bug in Module
**Trigger:** When you need to fix a bug or improve logic in a specific module (e.g., authentication, middleware, plugins, server).
**Command:** `/fix-module`

1. Identify the module or feature with the issue.
2. Edit the main implementation file in `src/` (e.g., `src/middleware/auth.ts`, `src/plugins/requestContext.ts`, `src/server.ts`, `src/middleware/ddos.ts`).
3. Commit your changes with a `fix` message describing what you changed.
   ```bash
   git commit -m "fix: handle expired tokens in auth middleware"
   ```

### Update Build or Config
**Trigger:** When you want to add or update project tooling, linting, testing, or CI/CD configuration.
**Command:** `/update-config`

1. Edit or add the relevant configuration file:
   - `eslint.config.js`
   - `vitest.config.ts`
   - `.github/workflows/ci.yml`
   - `tsconfig.json`
2. Commit your changes with a `build` or `fix` message describing the config change.
   ```bash
   git commit -m "build: update CI workflow for Node 18"
   ```

## Testing Patterns

- Test files follow the pattern: `*.test.*` (e.g., `auth.test.ts`).
- The specific test framework is not detected, but typical test files are written in TypeScript.
- Place test files alongside or near the modules they test.
- Example test file name: `src/middleware/auth.test.ts`

## Commands

| Command        | Purpose                                                      |
|----------------|--------------------------------------------------------------|
| /fix-module    | Fix or improve a feature/module implementation               |
| /update-config | Update build, lint, test, or CI/CD configuration             |
```
