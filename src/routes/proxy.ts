/**
 * proxy.ts — Dynamic upstream proxy registration
 *
 * Each entry in config.upstreams creates a prefix-matched reverse proxy route.
 * The upstream URL is recorded on the request object for transaction logging.
 */

import type { FastifyInstance } from 'fastify';
import proxy from '@fastify/http-proxy';
import { config } from '../../config/gateway.js';

export async function registerProxyRoutes(fastify: FastifyInstance): Promise<void> {
  for (const upstream of config.upstreams) {
    const { prefix, target } = upstream as { prefix: string; target: string };

    fastify.register(proxy, {
      upstream:   target,
      prefix,
      rewritePrefix: prefix,
      http2:     false,
      // Tag the request with its upstream before proxying so the onResponse
      // hook can attach it to the transaction record.
      preHandler: async (request) => {
        request.upstream = target;
      },
    });

    fastify.log.info(`Proxy: ${prefix} → ${target}`);
  }
}
