/**
 * Integration tests for /health and /ready routes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { registerHealthRoutes } from '../src/routes/health.js';

// ── Helper ────────────────────────────────────────────────────────────────────

async function buildApp(redisOverride?: Redis | null): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('redis', redisOverride ?? null);
  await registerHealthRoutes(app);
  await app.ready();
  return app;
}

// ── /health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('returns status: ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('includes uptime as a number', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = JSON.parse(res.body);
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ── /ready — no Redis configured ─────────────────────────────────────────────

describe('GET /ready (no Redis)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(null);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when redis is null', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
  });

  it('returns status: ready', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ready');
  });

  it('reports redis as ok when not configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    const body = JSON.parse(res.body);
    expect(body.checks.redis).toBe('ok');
  });
});

// ── /ready — Redis present but unreachable ────────────────────────────────────

describe('GET /ready (Redis unreachable)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Mock a Redis client whose ping() always rejects.
    const fakeRedis = {
      ping: async () => { throw new Error('connection refused'); },
    } as unknown as Redis;
    app = await buildApp(fakeRedis);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 503 when redis ping fails', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
  });

  it('returns status: degraded', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    const body = JSON.parse(res.body);
    expect(body.status).toBe('degraded');
  });

  it('reports redis as unreachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    const body = JSON.parse(res.body);
    expect(body.checks.redis).toBe('unreachable');
  });
});
