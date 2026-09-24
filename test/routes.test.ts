import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/server.js';
import { CircuitBreakerRegistry } from '../src/services/circuitBreaker.js';

describe('Gateway Ingress and Security Hardening', () => {
  beforeAll(async () => {
    await app.ready();
  });

  it('assigns unique X-Request-ID to every incoming request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });

  it('enforces Helmet security headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('includes rate limit headers in response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('serves Swagger documentation on /docs and /docs/json without requiring auth', async () => {
    const docHtml = await app.inject({
      method: 'GET',
      url: '/docs/',
    });
    expect([200, 302]).toContain(docHtml.statusCode);

    const docJson = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    expect(docJson.statusCode).toBe(200);
    const spec = JSON.parse(docJson.body);
    expect(spec.openapi).toBeDefined();
    expect(spec.info.title).toBe('Node TypeScript API Gateway');
  });

  it('short-circuits and fails fast with 503 when circuit breaker is OPEN', async () => {
    const target = 'http://order-service:8080';
    const breaker = CircuitBreakerRegistry.getBreaker(target);

    // Trip the breaker to OPEN
    for (let i = 0; i < breaker.options.failureThreshold; i++) {
      breaker.recordFailure();
    }
    expect(breaker.getState()).toBe('OPEN');

    // Authenticated request to an upstream whose circuit breaker is tripped
    const token = app.jwt.sign({ sub: 'user_cb_test', role: 'user' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/orders/list',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Service Unavailable');
    expect(body.message).toContain('Circuit breaker is OPEN');
    expect(body.state).toBe('OPEN');
    expect(res.headers['retry-after']).toBeDefined();

    // Reset breaker so it doesn't affect other tests
    breaker.reset();
  });
});
