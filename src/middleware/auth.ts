import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

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

export default authPlugin;
