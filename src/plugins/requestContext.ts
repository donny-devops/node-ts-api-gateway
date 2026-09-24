/**
 * requestContext.ts — Initialises per-request context fields
 *
 * Runs as the very first onRequest hook so all subsequent middleware and
 * logging can rely on these fields being present.
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';

const requestContextPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.transactionId   = uuidv4();
    request.startTime       = process.hrtime.bigint();
    request.sanitisedFields = [];
    request.blocked         = false;
    request.blockReason     = null;
    request.upstream        = null;

    // Resolve real client IP — respects X-Forwarded-For when trustProxy is on.
    const realIp = request.headers['x-real-ip'];
    const forwarded = request.headers['x-forwarded-for'];
    const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
    const forwardedValue = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    request.clientIp =
      realIpValue ?? forwardedValue ?? request.socket.remoteAddress ?? 'unknown';

    // Attach transactionId to every pino log line from this request.
    request.log = request.log.child({ transactionId: request.transactionId });
  });

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('x-transaction-id', request.transactionId);
  });
};

export default fp(requestContextPlugin, { name: 'request-context', fastify: '4.x' });
