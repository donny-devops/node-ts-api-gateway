import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/server.js';

describe('Health and Gateway Status Routes', () => {
  beforeAll(async () => {
    await app.ready();
  });

  it('GET /health returns 200 and liveness status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /ready returns readiness check response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect([200, 503]).toContain(res.statusCode);
    const body = JSON.parse(res.body);
    expect(['ready', 'degraded']).toContain(body.status);
    expect(body.checks).toBeDefined();
    expect(body.checks.redis).toBeDefined();
  });

  it('GET /gateway/status returns metadata, upstreams and rate limit configuration', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/gateway/status',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('online');
    expect(body.version).toBe('1.0.0');
    expect(Array.isArray(body.upstreams)).toBe(true);

    const prefixes = body.upstreams.map((u: { prefix: string }) => u.prefix);
    expect(prefixes).toContain('/api/users');
    expect(prefixes).toContain('/api/products');
    expect(prefixes).toContain('/api/orders');
    expect(prefixes).toContain('/api/payments');
    expect(prefixes).toContain('/api/notifications');

    expect(body.rateLimits).toBeDefined();
    expect(body.rateLimits.global).toBeDefined();
    expect(body.features.ddosProtection).toBe(true);
    expect(body.features.jwtAuth).toBe(true);
  });
});
