# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- README and CONTRIBUTING now describe the ESM gateway in `src/`
  (plugin order, public paths, Redis fallback, compose/CI constraints)
  instead of a generic Express/Jest template.
- Documented the Fastify 4 plugin vs Fastify 5 dependency mismatch
  introduced when [#31](https://github.com/donny-devops/node-ts-api-gateway/pull/31)
  followed [#29](https://github.com/donny-devops/node-ts-api-gateway/pull/29).

### Fixed

- CI requires a committed `package-lock.json` (`npm ci` + `cache: npm`).
  Node in GitHub Actions is 22.x; the runtime image remains
  `node:20-alpine`. See [#29](https://github.com/donny-devops/node-ts-api-gateway/pull/29).

## Release Notes Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes and improvements
```

[Unreleased]: https://github.com/donny-devops/node-ts-api-gateway/compare/main...HEAD
