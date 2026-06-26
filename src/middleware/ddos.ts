/**
 * ddos.ts — DDoS and flood protection middleware.
 *
 * Multi-layer protection:
 *   1. Per-IP sliding-window request counter
 *   2. IP ban list with configurable expiry
 *   3. Slowloris protection via Fastify connectionTimeout
 *   4. Payload size enforcement via Fastify bodyLimit
 *   5. Header anomaly detection
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Redis } from 'ioredis';

import { config } from '../../config/gateway.js';
import { metrics } from '../services/metrics.js';

const cfg = config.ddos;

const BAN_KEY = (ip: string) => `${config.redis.keyPrefix}ban:${ip}`;
const WINDOW_KEY = (ip: string) => `${config.redis.keyPrefix}rps:${ip}`;

const localCounters = new Map<string, { count: number; windowStart: number }>();
const localBans = new Map<string, number>();

function localIncrement(ip: string, windowMs: number): number {
  const now = Date.now();
  const entry = localCounters.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    localCounters.set(ip, { count: 1, windowStart: now });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

async function isBanned(redis: Redis | null, ip: string): Promise<boolean> {
  if (!redis) {
    const bannedUntil = localBans.get(ip);
    if (!bannedUntil) return false;
    if (Date.now() >= bannedUntil) {
      localBans.delete(ip);
      return false;
    }
    return true;
  }
  const val = await redis.get(BAN_KEY(ip));
  return val !== null;
}

async function incrementAndCheck(redis: Redis | null, ip: string): Promise<boolean> {
  const windowMs = 1000;
  const threshold = cfg.requestsPerSecond * cfg.burstMultiplier;
  let count: number;

  if (redis) {
    try {
      const multi = redis.multi();
      const now = Date.now();
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
  if (!redis) {
    localBans.set(ip, Date.now() + durationMs);
    return;
  }
  await redis.set(BAN_KEY(ip), '1', 'PX', durationMs);
}

const SUSPICIOUS_UA = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /python-requests\/[01]\./i,
  /go-http-client\/1\.0/i,
];

function isSuspiciousRequest(request: FastifyRequest): string | null {
  const ua = request.headers['user-agent'] ?? '';
  if (!ua) return 'missing User-Agent';

  for (const re of SUSPICIOUS_UA) {
    if (re.test(ua)) return `suspicious User-Agent: ${String(ua).slice(0, 60)}`;
  }

  if (!request.headers.host) return 'missing Host header';
  return null;
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

const ddosPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.clientIp;
    const redis: Redis | null = fastify.redis ?? null;

    if (await isBanned(redis, ip)) {
      request.blocked = true;
      request.blockReason = 'IP banned (DDoS)';
      metrics.ddosBlocked.inc({ reason: 'banned' });
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Your IP has been temporarily blocked due to excessive requests.',
        retryAfter: Math.ceil(cfg.banDurationMs / 1000),
      });
    }

    const anomaly = isSuspiciousRequest(request);
    if (anomaly) {
      request.blocked = true;
      request.blockReason = anomaly;
      metrics.ddosBlocked.inc({ reason: 'suspicious_header' });
      request.log.warn(
        { ip, reason: anomaly, transactionId: request.transactionId },
        'ddos: suspicious request blocked',
      );
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Request rejected by security policy.',
      });
    }

    if (await incrementAndCheck(redis, ip)) {
      await banIp(redis, ip, cfg.banDurationMs);
      request.blocked = true;
      request.blockReason = 'RPS flood - IP banned';
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
