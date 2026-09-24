import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/server.js';

describe('Auth Middleware', () => {
  beforeAll(async () => {
    await app.ready();
  });

  it('allows access to public routes without Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
  });

  it('blocks protected routes with 401 when no token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/profile',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('Bearer token is required');
  });

  it('blocks protected routes with 401 when an invalid token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/profile',
      headers: {
        authorization: 'Bearer bad.token.value',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Unauthorized');
  });

  it('verifies valid JWT token and passes auth check', async () => {
    // Generate valid signed JWT token using gateway Fastify JWT instance
    const token = app.jwt.sign({ sub: 'user_42', role: 'admin' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/profile',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    // The auth check passes (does not return 401 Unauthorized).
    expect(res.statusCode).not.toBe(401);
  });
});
