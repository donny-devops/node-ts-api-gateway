/**
 * Unit tests for the input sanitisation logic.
 * These run without a live Fastify server — pure function tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { sanitiseValue, sanitisePayload } from '../src/middleware/sanitise.js';
import sanitisePlugin from '../src/middleware/sanitise.js';
import requestContextPlugin from '../src/plugins/requestContext.js';

describe('sanitiseValue', () => {
  it('strips XSS script tags from strings', () => {
    const mutated: string[] = [];
    const result = sanitiseValue('<script>alert("xss")</script>hello', 'field', mutated);
    expect(result).not.toContain('<script>');
    expect(mutated).toContain('field');
  });

  it('strips SQL injection patterns', () => {
    const mutated: string[] = [];
    const result = sanitiseValue("1' OR '1'='1", 'query', mutated) as string;
    expect(result).not.toMatch(/OR.*=/i);
    expect(mutated).toContain('query');
  });

  it('strips path traversal sequences', () => {
    const mutated: string[] = [];
    const result = sanitiseValue('../../etc/passwd', 'path', mutated) as string;
    expect(result).not.toContain('../');
    expect(mutated).toContain('path');
  });

  it('strips URL-encoded path traversal sequences', () => {
    const mutated: string[] = [];
    const result = sanitiseValue('%2e%2e%2fetc%2fpasswd', 'path', mutated) as string;
    expect(result).not.toMatch(/%2e%2e/i);
    expect(mutated).toContain('path');
  });

  it('strips SELECT SQL keyword', () => {
    const mutated: string[] = [];
    const result = sanitiseValue('SELECT * FROM users', 'q', mutated) as string;
    expect(result).not.toMatch(/SELECT/i);
    expect(mutated).toContain('q');
  });

  it('strips DROP TABLE SQL keyword', () => {
    const mutated: string[] = [];
    const result = sanitiseValue("'; DROP TABLE users; --", 'q', mutated) as string;
    expect(result).not.toMatch(/DROP/i);
  });

  it('strips UNION SELECT SQL pattern', () => {
    const mutated: string[] = [];
    const result = sanitiseValue("' UNION SELECT null,null--", 'q', mutated) as string;
    expect(result).not.toMatch(/UNION/i);
  });

  it('strips XSS img onerror attribute', () => {
    const mutated: string[] = [];
    const result = sanitiseValue('<img src=x onerror=alert(1)>', 'f', mutated) as string;
    expect(result).not.toContain('onerror');
  });

  it('truncates strings exceeding maxStringLength', () => {
    const mutated: string[] = [];
    const longStr = 'a'.repeat(20_000);
    const result = sanitiseValue(longStr, 'big', mutated) as string;
    expect(result.length).toBeLessThanOrEqual(10_000);
    expect(mutated).toContain('big');
  });

  it('does not truncate strings at exactly maxStringLength', () => {
    const mutated: string[] = [];
    const exact = 'a'.repeat(10_000);
    const result = sanitiseValue(exact, 'exact', mutated) as string;
    expect(result.length).toBe(10_000);
    expect(mutated).toHaveLength(0);
  });

  it('passes clean strings without mutation', () => {
    const mutated: string[] = [];
    const result = sanitiseValue('Hello World!', 'clean', mutated);
    expect(result).toBe('Hello World!');
    expect(mutated).toHaveLength(0);
  });

  it('recursively sanitises nested objects', () => {
    const mutated: string[] = [];
    const result = sanitiseValue(
      { user: { name: '<script>bad</script>' } },
      '',
      mutated,
    ) as Record<string, Record<string, string>>;
    expect(result.user.name).not.toContain('<script>');
    expect(mutated.length).toBeGreaterThan(0);
  });

  it('records dot-separated path for nested object keys', () => {
    const mutated: string[] = [];
    sanitiseValue({ a: { b: '<script>' } }, 'root', mutated);
    expect(mutated.some(f => f.includes('a') && f.includes('b'))).toBe(true);
  });

  it('records indexed path for array elements', () => {
    const mutated: string[] = [];
    sanitiseValue(['clean', '<script>bad</script>'], 'arr', mutated);
    expect(mutated.some(f => f.includes('[1]'))).toBe(true);
  });

  it('recursively sanitises arrays', () => {
    const mutated: string[] = [];
    const result = sanitiseValue(['clean', '<img onerror=alert(1)>'], '', mutated) as string[];
    expect(result[1]).not.toContain('onerror');
  });

  it('passes through numbers and booleans unchanged', () => {
    const mutated: string[] = [];
    expect(sanitiseValue(42, 'n', mutated)).toBe(42);
    expect(sanitiseValue(true, 'b', mutated)).toBe(true);
    expect(mutated).toHaveLength(0);
  });

  it('passes through null unchanged', () => {
    const mutated: string[] = [];
    expect(sanitiseValue(null, 'n', mutated)).toBeNull();
    expect(mutated).toHaveLength(0);
  });

  it('passes through undefined unchanged', () => {
    const mutated: string[] = [];
    expect(sanitiseValue(undefined, 'u', mutated)).toBeUndefined();
    expect(mutated).toHaveLength(0);
  });
});

describe('sanitisePayload', () => {
  it('returns blocked=false for clean payloads', () => {
    const result = sanitisePayload({ username: 'alice', age: 30 });
    expect(result.blocked).toBe(false);
    expect(result.mutatedFields).toHaveLength(0);
  });

  it('records mutated field paths', () => {
    const result = sanitisePayload({ search: '<script>x</script>' });
    expect(result.mutatedFields.length).toBeGreaterThan(0);
    expect(result.sanitised).toBeDefined();
  });

  it('returns reason=null (blocking is decided upstream)', () => {
    const result = sanitisePayload({ x: '<script>' });
    expect(result.reason).toBeNull();
  });

  it('sanitises nested payload fields', () => {
    const result = sanitisePayload({ user: { bio: '<script>hack</script>' } });
    const sanitised = result.sanitised as { user: { bio: string } };
    expect(sanitised.user.bio).not.toContain('<script>');
    expect(result.mutatedFields.length).toBeGreaterThan(0);
  });

  it('handles empty object without error', () => {
    expect(() => sanitisePayload({})).not.toThrow();
    expect(sanitisePayload({}).blocked).toBe(false);
  });

  it('handles array payloads', () => {
    const result = sanitisePayload(['<script>xss</script>', 'clean']);
    const sanitised = result.sanitised as string[];
    expect(sanitised[0]).not.toContain('<script>');
  });
});

// ── Sanitise plugin — Content-Type blocking ───────────────────────────────────

describe('sanitise plugin — Content-Type guard', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(requestContextPlugin);
    await app.register(sanitisePlugin);
    app.post('/echo', async (req) => ({ body: req.body }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts application/json content type', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ hello: 'world' }),
    });
    expect(res.statusCode).toBe(200);
  });

  it('blocks disallowed content type with 415', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/echo',
      headers: { 'content-type': 'text/xml' },
      payload: '<root/>',
    });
    expect(res.statusCode).toBe(415);
    expect(JSON.parse(res.body).error).toBe('Unsupported Media Type');
  });

  it('sanitises XSS in request body and returns clean data', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: '<script>evil()</script>alice' }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).body as { name: string };
    expect(body.name).not.toContain('<script>');
  });
});
