/**
 * health.ts — Liveness and readiness endpoints
 *
 * /health  — liveness probe (always 200 if process is running)
 * /ready   — readiness probe (checks Redis connectivity)
 */

import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', uptime: process.uptime() });
  });

  fastify.get('/ready', async (_req, reply) => {
    const redis: Redis | null = (fastify as typeof fastify & { redis: Redis | null }).redis ?? null;

    let redisOk = true;
    if (redis) {
      try {
        await redis.ping();
      } catch {
        redisOk = false;
      }
    }

    const status = redisOk ? 'ready' : 'degraded';
    return reply.status(redisOk ? 200 : 503).send({
      status,
      checks: {
        redis: redisOk ? 'ok' : 'unreachable',
      },
    });
  });
}
