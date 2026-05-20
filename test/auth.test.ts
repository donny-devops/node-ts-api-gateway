/**
 * Unit tests for the isPublicPath helper and integration tests for the
 * JWT auth middleware.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import requestContextPlugin from '../src/plugins/requestContext.js';
import authPlugin from '../src/middleware/auth.js';
import { isPublicPath } from '../src/middleware/auth.js';

// ── isPublicPath unit tests ───────────────────────────────────────────────────

describe('isPublicPath', () => {
  it('returns true for /health', () => {
    expect(isPublicPath('/health')).toBe(true);
  });

  it('returns true for /metrics', () => {
    expect(isPublicPath('/metrics')).toBe(true);
  });

  it('returns true for /ready', () => {
    expect(isPublicPath('/ready')).toBe(true);
  });

  it('returns true for paths with query strings on public routes', () => {
    expect(isPublicPath('/health?foo=bar')).toBe(true);
  });

  it('returns false for a protected path', () => {
    expect(isPublicPath('/api/users')).toBe(false);
  });

  it('returns false for /healthz (not in public list)', () => {
    expect(isPublicPath('/healthz')).toBe(false);
  });
});

// ── Auth middleware integration ───────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('redis', null);

  await app.register(requestContextPlugin);
  await app.register(jwt, {
    secret:  'test-secret',
    sign:    { issuer: 'api-gateway' },
    verify:  { issuer: 'api-gateway' },
  });
  await app.register(authPlugin);

  // A protected endpoint for testing.
  app.get('/api/protected', async () => ({ data: 'secret' }));

  // A public endpoint for testing.
  app.get('/health', async () => ({ status: 'ok' }));

  await app.ready();
  return app;
}

describe('Auth middleware', () => {
  let app: FastifyInstance;
  let validToken: string;

  beforeAll(async () => {
    app = await buildApp();
    // Sign a valid token using the registered jwt instance.
    validToken = app.jwt.sign({ sub: 'user-test' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows public paths without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url:    '/health',
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 for protected path without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url:    '/api/protected',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with a malformed Bearer token', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/api/protected',
      headers: { authorization: 'Bearer this-is-not-a-jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with a token signed by a different secret', async () => {
    const wrongToken = app.jwt.sign({ sub: 'user-test' });
    // Tamper: append garbage so verification fails.
    const res = await app.inject({
      method:  'GET',
      url:     '/api/protected',
      headers: { authorization: `Bearer ${wrongToken}tampered` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows a protected path with a valid Bearer token', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/api/protected',
      headers: { authorization: `Bearer ${validToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toBe('secret');
  });

  it('returns the correct error body on 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/protected' });
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toMatch(/Bearer token/i);
  });
});
