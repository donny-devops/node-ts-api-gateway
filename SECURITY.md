# Security Policy

## Supported Versions

Security updates are provided for the actively maintained `main` branch and the latest tagged release.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| latest stable release | Yes |
| older releases | No |

## Reporting a Vulnerability

Please do not open public issues for API gateway vulnerabilities.

Report privately through GitHub private vulnerability reporting if enabled, or contact the maintainer directly.

Please include:

- affected route, middleware, dependency, or workflow
- reproduction steps or proof of concept
- expected vs. actual security behavior
- logs with secrets removed
- suggested mitigation, if available

## Scope

In scope:

- authentication or JWT validation bypasses
- authorization or tenant-isolation flaws
- unsafe rate limiting or request validation gaps
- SSRF, injection, path traversal, or unsafe proxy behavior
- dependency or CI/CD supply-chain risks
- sensitive information exposed through logs, headers, or errors

Out of scope:

- scanner-only findings without a practical exploit path
- denial-of-service without realistic impact
- downstream deployment changes outside the project defaults

## Security Expectations

- Do not commit secrets, tokens, or private keys.
- Use least-privilege runtime credentials.
- Validate and sanitize all external input.
- Keep dependency review and security scanning enabled on pull requests.
- Prefer short-lived credentials and GitHub Actions OIDC for deployments.
