# Contributing

Docs and code in this repo should describe the gateway that actually
boots from `src/server.ts`, not a generic Node template.

## Setup

```bash
git clone https://github.com/donny-devops/node-ts-api-gateway.git
cd node-ts-api-gateway
cp .env.example .env
npm ci
npm test
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) is Node **22.x**, `npm ci`, `npm run build`,
`npm test`. A committed `package-lock.json` is required.

## Constraints that commonly break PRs

- **Fastify plugin major must match.** Local plugins still pass
  `{ fastify: '4.x' }`. Dependabot [#31](https://github.com/donny-devops/node-ts-api-gateway/pull/31)
  moved `fastify` to `^5.12.1` and some `@fastify/*` packages to 5-line
  majors. [#29](https://github.com/donny-devops/node-ts-api-gateway/pull/29)
  had pinned Fastify 4 because 5 would not load those plugins. Do not
  merge further Fastify majors without either updating the local plugins
  or pinning Fastify back to 4.x.
- **ESM.** `"type": "module"` and TypeScript `module: NodeNext`. Use
  `.js` specifiers in imports (see existing files).
- **Config compiles with src.** `tsconfig.json` `rootDir` is `.` and
  `include` is `src` + `config`. Keep `config/gateway.ts` in that set.
- **Tests are Vitest**, not Jest. Current coverage is
  `test/sanitise.test.ts` (pure functions, no listening server).
  `NODE_ENV=test` prevents `app.listen()`.
- **Do not document unused knobs as live.** `OTEL_*` is config-only.
  `RATE_LIMIT_AUTH_*` / `RATE_LIMIT_PER_ROUTE` are parsed and unused.
  `gateway_auth_failures_total` / `gateway_rate_limit_hits_total` are
  registered and never incremented.

## Workflow

1. Branch from `main`: `git checkout -b docs/your-change` (or `fix/` / `feat/`).
2. Match existing TypeScript style and plugin-registration order in
   `src/server.ts` if you add middleware — order is load-bearing.
3. Add Vitest coverage for new sanitise/auth/ddos behavior.
4. Update README when you change public paths, env vars, or upstream
   routing.
5. Open a pull request. Default review owner is `@donny-devops`
   (`CODEOWNERS`).

### PR description

- What changed and why
- How to test (`npm ci && npm test && npm run build`)
- Related issues (`Fixes #123`)
- Breaking changes (Fastify major, public path list, env var names)

## Reporting issues

Include Node version, `npm ci` vs `npm install`, whether Redis was
running, request method/path, status code, and logs with secrets
removed. Security reports go through [SECURITY.md](SECURITY.md) — do
not open a public issue for a gateway bypass.

Questions and non-security help: [SUPPORT.md](SUPPORT.md).
