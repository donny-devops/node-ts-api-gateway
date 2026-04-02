/**
 * sanitise.ts — Input sanitisation middleware
 *
 * Protects upstream services from:
 *   - XSS payloads in JSON/form bodies and query strings
 *   - SQL injection patterns
 *   - Path traversal sequences (../../etc/passwd)
 *   - Oversized string values
 *   - Disallowed Content-Type headers
 *
 * Mutated fields are recorded on the request object so they can be logged
 * in the transaction record without storing the original malicious payload.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import xss from 'xss';
import type { SanitiseResult } from '../types/index.js';
import { config } from '../../config/gateway.js';

const cfg = config.sanitise;

// ── Patterns ──────────────────────────────────────────────────────────────────

/** Classic SQL injection fingerprints — not a replacement for parameterised queries. */
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|HAVING|GROUP\s+BY)\b)/gi,
  /('|--|;|\/\*|\*\/|xp_|0x[0-9a-f]{2,})/gi,
  /\b(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi,
];

const PATH_TRAVERSAL_RE = /(\.\.[/\\]|%2e%2e[%2f%5c]|\.\.%[0-9a-f]{2})/gi;

// ── Core sanitise logic ───────────────────────────────────────────────────────

export function sanitiseValue(value: unknown, path: string, mutated: string[]): unknown {
  if (typeof value === 'string') {
    let out = value;

    if (cfg.stripXss) {
      const cleaned = xss(out, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] });
      if (cleaned !== out) { mutated.push(path); out = cleaned; }
    }

    if (cfg.stripSqlPatterns) {
      let sqlCleaned = out;
      for (const re of SQL_PATTERNS) {
        sqlCleaned = sqlCleaned.replace(re, '');
      }
      if (sqlCleaned !== out) { mutated.push(path); out = sqlCleaned; }
    }

    if (cfg.stripPathTraversal && PATH_TRAVERSAL_RE.test(out)) {
      mutated.push(path);
      out = out.replace(PATH_TRAVERSAL_RE, '');
    }

    if (out.length > cfg.maxStringLength) {
      mutated.push(path);
      out = out.slice(0, cfg.maxStringLength);
    }

    return out;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => sanitiseValue(item, `${path}[${i}]`, mutated));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitiseValue(v, path ? `${path}.${k}` : k, mutated);
    }
    return result;
  }

  return value;
}

export function sanitisePayload(input: unknown): SanitiseResult {
  const mutatedFields: string[] = [];
  const sanitised = sanitiseValue(input, '', mutatedFields);
  return { sanitised, mutatedFields, blocked: false, reason: null };
}

// ── Content-Type guard ────────────────────────────────────────────────────────

function isAllowedContentType(ct: string | undefined): boolean {
  if (!ct) return true; // GET/HEAD/DELETE typically have no body
  const base = ct.split(';')[0].trim().toLowerCase();
  return cfg.allowedContentTypes.some(allowed => base.startsWith(allowed));
}

// ── Fastify plugin ────────────────────────────────────────────────────────────

const sanitisePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Block disallowed content types.
    const ct = request.headers['content-type'];
    if (request.body !== undefined && !isAllowedContentType(ct)) {
      request.blocked = true;
      request.blockReason = `Disallowed Content-Type: ${ct}`;
      return reply.status(415).send({
        error: 'Unsupported Media Type',
        message: `Content-Type '${ct}' is not permitted.`,
      });
    }

    // Sanitise body.
    if (request.body) {
      const result = sanitisePayload(request.body);
      if (result.mutatedFields.length > 0) {
        request.sanitisedFields.push(...result.mutatedFields.map(f => `body.${f}`));
        (request as FastifyRequest & { body: unknown }).body = result.sanitised;
        request.log.warn(
          { transactionId: request.transactionId, mutatedFields: result.mutatedFields },
          'sanitise: body fields mutated',
        );
      }
    }

    // Sanitise query string.
    if (request.query && typeof request.query === 'object') {
      const result = sanitisePayload(request.query);
      if (result.mutatedFields.length > 0) {
        request.sanitisedFields.push(...result.mutatedFields.map(f => `query.${f}`));
        (request as FastifyRequest & { query: unknown }).query = result.sanitised;
        request.log.warn(
          { transactionId: request.transactionId, mutatedFields: result.mutatedFields },
          'sanitise: query fields mutated',
        );
      }
    }
  });
};

export default fp(sanitisePlugin, { name: 'sanitise', fastify: '4.x' });
