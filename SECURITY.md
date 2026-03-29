# Security Policy for node-ts-api-gateway

This repository hosts a Node.js/TypeScript API gateway for routing, auth, and microservices orchestration. Security focuses on API hardening, secrets management, and supply chain protection.

## Supported Versions

Use `main` or tagged releases. Node.js LTS recommended.

| Version | Node.js | Supported     |
|---------|---------|---------------|
| `main`  | >=20    | ✅ Yes        |
| `v*`    | >=20    | ✅ Yes        |
| Older   | -       | ❌ No         |

## Reporting a Vulnerability

- **Private advisories**: [GitHub Security Advisory](https://github.com/donny-devops/node-ts-api-gateway/security/advisories/new).
- **Email**: donny.dev@outlook.com
- Triage: 7 days. Patches: Critical (7 days), High (14 days).
- Avoid public issues/PRs for vulns.

## Security Guidance for Users/Contributors

- **Runtime**: Validate/sanitize inputs (zod/joi), rate-limit (express-rate-limit), Helmet for headers. [web:35][web:41]
- **Auth**: JWT/OIDC with short expiry, no secrets in code. Use env vars/secrets manager.
- **Dependencies**: `npm audit`, renovate/Snyk for updates. Pin in `package-lock.json`.
- **CI/CD**: Pin actions to SHA, read-only permissions, OIDC for cloud. [cite:5]
- **Gateway Specific**: CORS strict, block SSRF (validate URLs/DNS), HTTPS enforced. [web:38][web:41]
- **Scanning**: Enable Dependabot/CodeQL. Branch protection required.

## Scope

Covers code in this repo only. Production deployments need additional hardening (WAF, monitoring). No warranties.
