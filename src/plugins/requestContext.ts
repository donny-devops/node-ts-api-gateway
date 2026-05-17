/**
 * requestContext.ts — Initialises per-request context fields.
 *
 * Runs as the first onRequest hook so all later middleware and logging can rely
 * on these fields being present.
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';

const requestContextPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.transactionId = uuidv4();
    request.startTime = process.hrtime.bigint();
    request.sanitisedFields = [];
    request.blocked = false;
    request.blockReason = null;
    request.upstream = null;

    request.clientIp = (
      request.headers['x-real-ip']
      ?? (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? request.socket.remoteAddress
      ?? 'unknown'
    );

    request.log = request.log.child({ transactionId: request.transactionId });
  });
};

export default fp(requestContextPlugin, { name: 'request-context', fastify: '4.x' });
