/**
 * server.ts — API Gateway entry point
 *
 * Plugin registration order matters:
 *   1. requestContext    — assigns transactionId, startTime, clientIp
 *   2. helmet            — security headers
 *   3. cors              — CORS policy
 *   4. rateLimit         — per-client rate limiting (Redis-backed)
 *   5. jwt               — verifies Bearer tokens
 *   6. ddos              — RPS flood detection & IP banning
 *   7. sanitise          — XSS / SQLi / path-traversal stripping
 *   8. observability     — Prometheus metrics + transaction log shipping
 *   9. proxy routes      — reverse proxy to upstream services
 *  10. health routes     — /health + /ready
 */

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import formbody from '@fastify/formbody';
import { Redis } from 'ioredis';

import { config } from '../config/gateway.js';
import requestContextPlugin from './plugins/requestContext.js';
import observabilityPlugin from './plugins/observability.js';
import ddosPlugin from './middleware/ddos.js';
import sanitisePlugin from './middleware/sanitise.js';
import authPlugin from './middleware/auth.js';
import { registerProxyRoutes } from './routes/proxy.js';
import { registerHealthRoutes } from './routes/health.js';

// ── Redis client ──────────────────────────────────────────────────────────────

let redis: Redis | null = null;

if (config.redis.host) {
  redis = new Redis({
    host:       config.redis.host,
    port:       config.redis.port,
    password:   config.redis.password,
    db:         config.redis.db,
    keyPrefix:  config.redis.keyPrefix,
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  redis.on('error', (err) => {
    console.error('[redis] connection error — rate limiting degrades to in-process:', err.message);
  });

  await redis.connect().catch((err) => {
    console.warn('[redis] failed to connect on start — continuing without Redis:', err.message);
    redis = null;
  });
}

// ── Fastify instance ──────────────────────────────────────────────────────────

export const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    serializers: {
      req:  (req)  => ({ method: req.method, url: req.url, id: req.id }),
      res:  (res)  => ({ statusCode: res.statusCode }),
      err:  (err)  => ({ type: err.constructor.name, message: err.message, stack: err.stack }),
    },
  },
  trustProxy:         config.server.trustProxy,
  connectionTimeout:  config.ddos.slowlorisTimeoutMs,
  bodyLimit:          config.ddos.maxPayloadBytes,
  requestIdHeader:    'x-request-id',
  requestIdLogLabel:  'requestId',
  genReqId:           () => crypto.randomUUID(),
});

// Expose Redis on the fastify instance for plugins.
app.decorate('redis', redis);

// ── Plugin registration ───────────────────────────────────────────────────────

// 1. Request context (must be first)
await app.register(requestContextPlugin);

// 2. Helmet — security headers
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc:  ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy:   true,
  crossOriginOpenerPolicy:     true,
  crossOriginResourcePolicy:   { policy: 'same-origin' },
  dnsPrefetchControl:          { allow: false },
  frameguard:                  { action: 'deny' },
  hidePoweredBy:               true,
  hsts:                        { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen:                    true,
  noSniff:                     true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy:              { policy: 'no-referrer' },
  xssFilter:                   true,
});

// 3. CORS
await app.register(cors, {
  origin:      config.cors.origin,
  credentials: config.cors.credentials,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
});

// 4. Form body parser
await app.register(formbody);

// 5. Rate limiting
await app.register(rateLimit, {
  max:         config.rateLimit.global.max,
  timeWindow:  config.rateLimit.global.timeWindowMs,
  redis:       redis ?? undefined,
  keyGenerator: (req) => req.clientIp,
  errorResponseBuilder: (_req, ctx) => ({
    error:      'Too Many Requests',
    message:    `Rate limit exceeded. Try again in ${Math.ceil(ctx.ttl / 1000)}s.`,
    retryAfter: Math.ceil(ctx.ttl / 1000),
  }),
  addHeaders: {
    'x-ratelimit-limit':     true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset':     true,
    'retry-after':           true,
  },
});

// 6. JWT
await app.register(jwt, {
  secret:  config.jwt.secret,
  sign:    { issuer: config.jwt.issuer, expiresIn: config.jwt.expiresIn },
  verify:  { issuer: config.jwt.issuer },
});

// 7. DDoS protection
await app.register(ddosPlugin);

// 8. Input sanitisation
await app.register(sanitisePlugin);

// 9. Auth (JWT verification per-route)
await app.register(authPlugin);

// 10. Observability (metrics + transaction logging)
await app.register(observabilityPlugin);

// ── Routes ────────────────────────────────────────────────────────────────────

await registerHealthRoutes(app);
await registerProxyRoutes(app);

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal} — shutting down…`);
  await app.close();
  if (redis) await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  try {
    await app.listen({ host: config.server.host, port: config.server.port });
    app.log.info(`Gateway listening on ${config.server.host}:${config.server.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
