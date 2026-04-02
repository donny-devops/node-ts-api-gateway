/**
 * ddos.ts — DDoS & flood protection middleware
 *
 * Multi-layer protection:
 *   1. Per-IP sliding-window request counter (stored in Redis)
 *   2. IP ban list with configurable expiry (Redis SET with TTL)
 *   3. Slowloris / request-stall detection via Fastify's connectionTimeout
 *   4. Payload size enforcement
 *   5. Header anomaly detection (missing/suspicious User-Agent)
 *
 * Redis is used so bans are shared across gateway replicas in a cluster.
 * If Redis is unavailable the middleware degrades gracefully to in-process
 * counters (single-node only).
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { Redis } from 'ioredis';
import { config } from '../../config/gateway.js';
import { metrics } from '../services/metrics.js';

const cfg = config.ddos;

const BAN_KEY    = (ip: string) => `${config.redis.keyPrefix}ban:${ip}`;
const WINDOW_KEY = (ip: string) => `${config.redis.keyPrefix}rps:${ip}`;

// ── In-process fallback counters (used when Redis is down) ────────────────────

const localCounters = new Map<string, { count: number; windowStart: number }>();

function localIncrement(ip: string, windowMs: number): number {
  const now   = Date.now();
  const entry = localCounters.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    localCounters.set(ip, { count: 1, windowStart: now });
    return 1;
  }
  entry.count++;
  return entry.count;
}

// ── Core check ────────────────────────────────────────────────────────────────

async function isBanned(redis: Redis | null, ip: string): Promise<boolean> {
  if (!redis) return false;
  const val = await redis.get(BAN_KEY(ip));
  return val !== null;
}

async function incrementAndCheck(redis: Redis | null, ip: string): Promise<boolean> {
  const windowMs  = 1000; // 1-second sliding window for RPS
  const threshold = cfg.requestsPerSecond * cfg.burstMultiplier;

  let count: number;

  if (redis) {
    try {
      const multi  = redis.multi();
      const now    = Date.now();
      const winKey = WINDOW_KEY(ip);
      multi.zadd(winKey, now, `${now}-${Math.random()}`);
      multi.zremrangebyscore(winKey, '-inf', now - windowMs);
      multi.zcard(winKey);
      multi.expire(winKey, 5);
      const results = await multi.exec();
      count = (results?.[2]?.[1] as number) ?? 0;
    } catch {
      count = localIncrement(ip, windowMs);
    }
  } else {
    count = localIncrement(ip, windowMs);
  }

  return count > threshold;
}

async function banIp(redis: Redis | null, ip: string, durationMs: number): Promise<void> {
  if (!redis) return;
  await redis.set(BAN_KEY(ip), '1', 'PX', durationMs);
}

// ── Header anomaly heuristics ─────────────────────────────────────────────────

const SUSPICIOUS_UA = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i,
  /python-requests\/[01]\./i, /go-http-client\/1\.0/i,
];

function isSuspiciousRequest(request: FastifyRequest): string | null {
  const ua = request.headers['user-agent'] ?? '';

  if (!ua) return 'missing User-Agent';

  for (const re of SUSPICIOUS_UA) {
    if (re.test(ua)) return `suspicious User-Agent: ${ua.slice(0, 60)}`;
  }

  // Reject requests with no Host header (RFC 7230 §5.4)
  if (!request.headers.host) return 'missing Host header';

  return null;
}

// ── Fastify plugin ────────────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

const ddosPlugin: FastifyPluginAsync = async (fastify) => {
  // Payload size guard — registered before any body parsing.
  fastify.addContentTypeParser('*', { bodyLimit: cfg.maxPayloadBytes }, (_req, payload, done) => {
    let data = Buffer.alloc(0);
    let size = 0;

    payload.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > cfg.maxPayloadBytes) {
        done(new Error(`Payload exceeds ${cfg.maxPayloadBytes} bytes`), undefined);
        return;
      }
      data = Buffer.concat([data, chunk]);
    });

    payload.on('end', () => done(null, data));
    payload.on('error', done);
  });

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip  = request.clientIp;
    const redis: Redis | null = (fastify as typeof fastify & { redis: Redis | null }).redis ?? null;

    // ── 1. Ban list check ────────────────────────────────────────────────
    if (await isBanned(redis, ip)) {
      request.blocked    = true;
      request.blockReason = 'IP banned (DDoS)';
      metrics.ddosBlocked.inc({ reason: 'banned' });
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Your IP has been temporarily blocked due to excessive requests.',
        retryAfter: Math.ceil(cfg.banDurationMs / 1000),
      });
    }

    // ── 2. Header anomaly check ──────────────────────────────────────────
    const anomaly = isSuspiciousRequest(request);
    if (anomaly) {
      request.blocked    = true;
      request.blockReason = anomaly;
      metrics.ddosBlocked.inc({ reason: 'suspicious_header' });
      request.log.warn({ ip, reason: anomaly, transactionId: request.transactionId }, 'ddos: suspicious request blocked');
      return reply.status(400).send({ error: 'Bad Request', message: 'Request rejected by security policy.' });
    }

    // ── 3. RPS flood check ────────────────────────────────────────────────
    if (await incrementAndCheck(redis, ip)) {
      await banIp(redis, ip, cfg.banDurationMs);
      request.blocked    = true;
      request.blockReason = 'RPS flood — IP banned';
      metrics.ddosBlocked.inc({ reason: 'rps_flood' });
      request.log.warn({ ip, transactionId: request.transactionId }, 'ddos: IP banned for RPS flood');
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Request rate exceeded. Your IP has been temporarily blocked.',
        retryAfter: Math.ceil(cfg.banDurationMs / 1000),
      });
    }
  });
};

export default fp(ddosPlugin, { name: 'ddos', fastify: '4.x' });
