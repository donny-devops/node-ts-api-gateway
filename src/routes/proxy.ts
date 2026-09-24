/**
 * proxy.ts — Dynamic upstream proxy registration
 *
 * Each entry in config.upstreams creates a prefix-matched reverse proxy route.
 * The upstream URL is recorded on the request object for transaction logging.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import proxy from '@fastify/http-proxy';
import { config } from '../../config/gateway.js';
import { CircuitBreakerRegistry } from '../services/circuitBreaker.js';

export async function registerProxyRoutes(fastify: FastifyInstance): Promise<void> {
  for (const upstream of config.upstreams) {
    const { prefix, target } = upstream as { prefix: string; target: string };
    const breaker = CircuitBreakerRegistry.getBreaker(target);

    fastify.register(proxy, {
      upstream:   target,
      prefix,
      rewritePrefix: prefix,
      http2:     false,
      // Tag the request with its upstream and enforce circuit breaker preHandler check.
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        request.upstream = target;

        if (!breaker.canExecute()) {
          reply.header('retry-after', Math.ceil(breaker.options.resetTimeoutMs / 1000));
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: `Circuit breaker is OPEN for upstream: ${target}. Request failed fast.`,
            upstream: target,
            state: breaker.getState(),
            retryAfter: Math.ceil(breaker.options.resetTimeoutMs / 1000),
          });
        }
      },
    });

    fastify.log.info(`Proxy: ${prefix} → ${target} (circuit breaker enabled)`);
  }
}
