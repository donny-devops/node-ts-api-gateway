import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../../config/gateway.js';

export function isPublicPath(url: string): boolean {
  const path = url.split('?')[0];
  return config.jwt.publicPaths.some(p => path === p || path.startsWith(p + '/'));
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
};

export default fp(authPlugin, { name: 'auth', fastify: '5.x' });
