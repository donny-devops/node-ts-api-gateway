/**
 * Integration tests for the request-context plugin.
 *
 * Verifies that every incoming request gets a transactionId, startTime,
 * sanitisedFields array, blocked flag, and a resolved clientIp.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import requestContextPlugin from '../src/plugins/requestContext.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(requestContextPlugin);

  // Expose all context fields through a test route.
  app.get('/ctx', async (request: FastifyRequest) => {
    return {
      transactionId:   request.transactionId,
      startTimeType:   typeof request.startTime,
      sanitisedFields: request.sanitisedFields,
      blocked:         request.blocked,
      blockReason:     request.blockReason,
      upstream:        request.upstream,
      clientIp:        request.clientIp,
    };
  });

  await app.ready();
  return app;
}

describe('requestContext plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets transactionId as a UUID string', async () => {
    const res  = await app.inject({ method: 'GET', url: '/ctx' });
    const body = JSON.parse(res.body);
    expect(typeof body.transactionId).toBe('string');
    expect(body.transactionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates a unique transactionId per request', async () => {
    const [r1, r2] = await Promise.all([
      app.inject({ method: 'GET', url: '/ctx' }),
      app.inject({ method: 'GET', url: '/ctx' }),
    ]);
    expect(JSON.parse(r1.body).transactionId).not.toBe(
      JSON.parse(r2.body).transactionId,
    );
  });

  it('sets startTime as bigint', async () => {
    const res  = await app.inject({ method: 'GET', url: '/ctx' });
    const body = JSON.parse(res.body);
    // typeof bigint is the string 'bigint'
    expect(body.startTimeType).toBe('bigint');
  });

  it('initialises sanitisedFields as an empty array', async () => {
    const res  = await app.inject({ method: 'GET', url: '/ctx' });
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.sanitisedFields)).toBe(true);
    expect(body.sanitisedFields).toHaveLength(0);
  });

  it('initialises blocked as false', async () => {
    const res  = await app.inject({ method: 'GET', url: '/ctx' });
    const body = JSON.parse(res.body);
    expect(body.blocked).toBe(false);
  });

  it('initialises blockReason as null', async () => {
    const res  = await app.inject({ method: 'GET', url: '/ctx' });
    const body = JSON.parse(res.body);
    expect(body.blockReason).toBeNull();
  });

  it('initialises upstream as null', async () => {
    const res  = await app.inject({ method: 'GET', url: '/ctx' });
    const body = JSON.parse(res.body);
    expect(body.upstream).toBeNull();
  });

  it('resolves clientIp from X-Real-IP header', async () => {
    const res  = await app.inject({
      method:  'GET',
      url:     '/ctx',
      headers: { 'x-real-ip': '1.2.3.4' },
    });
    expect(JSON.parse(res.body).clientIp).toBe('1.2.3.4');
  });

  it('resolves clientIp from X-Forwarded-For header (first entry)', async () => {
    const res  = await app.inject({
      method:  'GET',
      url:     '/ctx',
      headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' },
    });
    expect(JSON.parse(res.body).clientIp).toBe('5.6.7.8');
  });

  it('prefers X-Real-IP over X-Forwarded-For', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/ctx',
      headers: {
        'x-real-ip':       '1.1.1.1',
        'x-forwarded-for': '2.2.2.2',
      },
    });
    expect(JSON.parse(res.body).clientIp).toBe('1.1.1.1');
  });

  it('falls back to socket remoteAddress when no IP headers present', async () => {
    const res  = await app.inject({ method: 'GET', url: '/ctx' });
    const body = JSON.parse(res.body);
    // Fastify's inject sets remoteAddress to '127.0.0.1' or similar.
    expect(typeof body.clientIp).toBe('string');
    expect(body.clientIp.length).toBeGreaterThan(0);
  });
});
