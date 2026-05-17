/**
 * auth.ts — JWT authentication and request context middleware.
 *
 * Verifies Bearer tokens on all non-public paths. Public paths are configured
 * via config.jwt.publicPaths and may include a trailing wildcard, for example
 * /docs/*.
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { config } from '../../config/gateway.js';
import { metrics } from '../services/metrics.js';

function normalisePath(url: string): string {
  return url.split('?')[0] || '/';
}

function isPublicPath(url: string): boolean {
  const path = normalisePath(url);
  return config.jwt.publicPaths.some((publicPath) => {
    if (publicPath.endsWith('*')) {
      return path.startsWith(publicPath.slice(0, -1));
    }
    return path === publicPath;
  });
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(request.url)) return;

    try {
      await request.jwtVerify();
    } catch {
      metrics.authFailures.inc({ reason: 'invalid_or_missing_token' });
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'A valid Bearer token is required.',
      });
    }
  });

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const decoded = request.user as Record<string, unknown> | undefined;
    const userId = decoded?.sub ?? decoded?.userId ?? null;
    (request as FastifyRequest & { userId: string | null }).userId =
      typeof userId === 'string' ? userId : null;
  });
};

export { isPublicPath };
export default fp(authPlugin, { name: 'auth', fastify: '4.x' });
