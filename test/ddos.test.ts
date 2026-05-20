/**
 * Tests for the DDoS protection middleware.
 *
 * Unit tests cover the pure helper functions (isSuspiciousRequest,
 * localIncrement). Integration tests cover the Fastify plugin hooks
 * for suspicious User-Agent detection via HTTP injection.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import requestContextPlugin from '../src/plugins/requestContext.js';
import ddosPlugin, { isSuspiciousRequest, localIncrement } from '../src/middleware/ddos.js';

// ── isSuspiciousRequest unit tests ────────────────────────────────────────────

describe('isSuspiciousRequest', () => {
  function headers(ua?: string, host?: string): { headers: Record<string, string> } {
    const h: Record<string, string> = {};
    if (ua   !== undefined) h['user-agent'] = ua;
    if (host !== undefined) h['host']       = host;
    return { headers: h };
  }

  it('returns null for a normal request', () => {
    expect(isSuspiciousRequest(headers('Mozilla/5.0', 'example.com'))).toBeNull();
  });

  it('returns a reason string for missing User-Agent', () => {
    const result = isSuspiciousRequest(headers(undefined, 'localhost'));
    expect(result).not.toBeNull();
    expect(result).toMatch(/user-agent/i);
  });

  it('returns a reason string for empty User-Agent string', () => {
    const result = isSuspiciousRequest(headers('', 'localhost'));
    expect(result).not.toBeNull();
  });

  it('detects sqlmap User-Agent', () => {
    expect(isSuspiciousRequest(headers('sqlmap/1.7 stable', 'h'))).not.toBeNull();
  });

  it('detects nikto User-Agent', () => {
    expect(isSuspiciousRequest(headers('Nikto/2.1.6', 'h'))).not.toBeNull();
  });

  it('detects nmap User-Agent', () => {
    expect(isSuspiciousRequest(headers('nmap scripting engine', 'h'))).not.toBeNull();
  });

  it('detects masscan User-Agent', () => {
    expect(isSuspiciousRequest(headers('masscan/1.0', 'h'))).not.toBeNull();
  });

  it('detects zgrab User-Agent', () => {
    expect(isSuspiciousRequest(headers('zgrab/0.x', 'h'))).not.toBeNull();
  });

  it('detects old python-requests/0.x User-Agent', () => {
    expect(isSuspiciousRequest(headers('python-requests/0.14', 'h'))).not.toBeNull();
  });

  it('detects old go-http-client/1.0 User-Agent', () => {
    expect(isSuspiciousRequest(headers('Go-http-client/1.0', 'h'))).not.toBeNull();
  });

  it('does NOT flag python-requests/2.x as suspicious', () => {
    expect(isSuspiciousRequest(headers('python-requests/2.31.0', 'localhost'))).toBeNull();
  });

  it('returns a reason for missing Host header', () => {
    const result = isSuspiciousRequest(headers('Mozilla/5.0'));
    expect(result).not.toBeNull();
    expect(result).toMatch(/host/i);
  });

  it('includes truncated UA in the reason string', () => {
    const ua = 'sqlmap/' + 'x'.repeat(100);
    const result = isSuspiciousRequest(headers(ua, 'h'));
    expect(result).not.toBeNull();
    expect((result as string).length).toBeLessThan(120);
  });
});

// ── localIncrement unit tests ─────────────────────────────────────────────────

describe('localIncrement', () => {
  it('starts at 1 for a new IP', () => {
    expect(localIncrement('new-ip-1', 1000)).toBe(1);
  });

  it('increments on subsequent calls within the window', () => {
    const ip = 'new-ip-2';
    localIncrement(ip, 5000);
    const count = localIncrement(ip, 5000);
    expect(count).toBe(2);
  });

  it('resets counter after window expiry', async () => {
    const ip = 'new-ip-3';
    localIncrement(ip, 1);   // windowMs = 1ms
    await new Promise(r => setTimeout(r, 10)); // wait > 1ms
    const count = localIncrement(ip, 1);
    expect(count).toBe(1);   // reset
  });
});

// ── Plugin integration — suspicious UA blocked ────────────────────────────────

describe('DDoS plugin — suspicious User-Agent via HTTP', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.decorate('redis', null);
    await app.register(requestContextPlugin);
    await app.register(ddosPlugin);
    app.get('/ping', async () => ({ pong: true }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a request with a normal User-Agent', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/ping',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; test)', host: 'localhost' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).pong).toBe(true);
  });

  it('blocks a request with sqlmap User-Agent (400)', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/ping',
      headers: { 'user-agent': 'sqlmap/1.7.8#stable', host: 'localhost' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Bad Request');
  });

  it('blocks a request with nikto User-Agent (400)', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/ping',
      headers: { 'user-agent': 'Nikto/2.1.6', host: 'localhost' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('blocks a request with nmap User-Agent (400)', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/ping',
      headers: { 'user-agent': 'nmap scripting engine', host: 'localhost' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('blocks a request with masscan User-Agent (400)', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/ping',
      headers: { 'user-agent': 'masscan/1.0 (https://github.com/robertdavidgraham/masscan)', host: 'localhost' },
    });
    expect(res.statusCode).toBe(400);
  });
});
