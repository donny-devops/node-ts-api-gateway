```markdown
# node-ts-api-gateway Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns used in the `node-ts-api-gateway` TypeScript project. You'll learn about file naming conventions, import/export styles, commit message formatting, and how to write and run tests. This guide is ideal for contributors looking to maintain consistency and quality in the codebase.

## Coding Conventions

### File Naming
- **PascalCase** is used for file names.
  - Example: `ApiGateway.ts`, `UserController.ts`

### Import Style
- **Relative imports** are preferred.
  - Example:
    ```typescript
    import { UserService } from './UserService';
    ```

### Export Style
- **Named exports** are used throughout the codebase.
  - Example:
    ```typescript
    export function handleRequest() { /* ... */ }
    export const API_VERSION = 'v1';
    ```

### Commit Messages
- **Conventional commit style** is used.
- Prefixes like `docs` are common.
- Example:
  ```
  docs: update API usage documentation
  ```

## Workflows

### Code Contribution
**Trigger:** When adding new features or fixing bugs  
**Command:** `/contribute`

1. Create a new branch for your work.
2. Follow the coding conventions for file naming, imports, and exports.
3. Write or update tests in files matching `*.test.*`.
4. Use conventional commit messages (e.g., `docs: update README`).
5. Submit a pull request for review.

### Documentation Update
**Trigger:** When updating or adding documentation  
**Command:** `/update-docs`

1. Edit the relevant documentation files.
2. Use a commit message starting with `docs:`.
3. Push your changes and open a pull request.

## Testing Patterns

- Test files follow the pattern: `*.test.*` (e.g., `ApiGateway.test.ts`).
- The specific testing framework is **unknown**, but tests should be colocated with or near the code they test.
- Example test file:
  ```typescript
  // ApiGateway.test.ts
  import { handleRequest } from './ApiGateway';

  describe('handleRequest', () => {
    it('should return a valid response', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command         | Purpose                                   |
|-----------------|-------------------------------------------|
| /contribute     | Steps for contributing code               |
| /update-docs    | Steps for updating documentation          |
```
