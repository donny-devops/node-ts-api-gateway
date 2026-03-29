# node-ts-api-gateway

A production-ready **TypeScript/Node.js API Gateway** built with Express. Features JWT authentication, Redis-backed rate limiting, Zod request validation, and structured error handling.

[![CI](https://github.com/donny-devops/node-ts-api-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/donny-devops/node-ts-api-gateway/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

## Features

- **JWT Authentication** — Bearer token validation with role-based access control
- **Rate Limiting** — `express-rate-limit` (in-memory; swap to Redis store for distributed deployments)
- **Request Validation** — Zod schemas on all routes, clean 400 error responses
- **Structured Error Handling** — Centralized `AppError` class; never leaks stack traces
- **TypeScript Strict Mode** — `noImplicitAny`, `strictNullChecks`, and all strict flags enabled
- **Full Test Suite** — Jest + Supertest with coverage reporting
- **Multi-stage Dockerfile** — Non-root user, health check, minimal runtime image

---

## Quick Start

```bash
git clone https://github.com/donny-devops/node-ts-api-gateway.git
cd node-ts-api-gateway
cp .env.example .env
# Edit .env — set a real JWT_SECRET (min 32 chars)

# Docker (recommended)
docker compose up -d

# Or local dev
npm install
npm run dev
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | None | Health check |
| `GET` | `/api/v1/items` | Bearer JWT | List all items |
| `POST` | `/api/v1/items` | Bearer JWT | Create item |
| `GET` | `/api/v1/items/:id` | Bearer JWT | Get item by ID |
| `PUT` | `/api/v1/items/:id` | Bearer JWT | Update item |
| `DELETE` | `/api/v1/items/:id` | Bearer JWT | Delete item |

### Generate a Test Token

```bash
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: 'user-1', email: 'test@example.com', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
console.log(token);
"
```

---

## Project Structure


---

## Development

```bash
npm run dev          # ts-node-dev with hot reload
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm test             # Jest
npm run test:coverage
npm run build        # Compile TypeScript
```

---

## License

MIT — see [LICENSE](LICENSE).
