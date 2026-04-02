/**
 * Unit tests for the input sanitisation logic.
 * These run without a live Fastify server — pure function tests.
 */

import { describe, it, expect } from 'vitest';
import { sanitiseValue, sanitisePayload } from '../src/middleware/sanitise.js';

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

  it('truncates strings exceeding maxStringLength', () => {
    const mutated: string[] = [];
    const longStr = 'a'.repeat(20_000);
    const result = sanitiseValue(longStr, 'big', mutated) as string;
    expect(result.length).toBeLessThanOrEqual(10_000);
    expect(mutated).toContain('big');
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
});
