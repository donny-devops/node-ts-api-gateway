/**
 * auth.ts — JWT authentication & request context middleware
 *
 * Verifies Bearer tokens on all non-public paths. Extracts user identity
 * and injects it into the request context for downstream logging.
 *
 * Public paths (no auth required) are configured via config.jwt.publicPaths.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../../config/gateway.js';

const { publicPaths } = config.jwt;

function isPublicPath(url: string): boolean {
  return publicPaths.some(p => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'));
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // @fastify/jwt is registered in server.ts with the secret.
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(request.url)) return;

    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'A valid Bearer token is required.',
      });
    }
  });

  // Attach userId to every request (null for unauthenticated public paths).
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    try {
      const decoded = request.user as Record<string, unknown> | undefined;
      (request as FastifyRequest & { userId: string | null }).userId =
        (decoded?.sub ?? decoded?.userId ?? null) as string | null;
    } catch {
      (request as FastifyRequest & { userId: string | null }).userId = null;
    }
  });
};

export default fp(authPlugin, { name: 'auth', fastify: '4.x' });
