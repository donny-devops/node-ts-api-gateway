/**
 * observability.ts — Response lifecycle hook that records metrics and ships
 *                    the transaction to the centralised logging pipeline.
 *
 * Runs onResponse (after reply is sent) so latency measurements are accurate
 * and do not delay the HTTP response to the client.
 *
 * Metrics flow:  Gateway → Prometheus → Grafana
 * Log flow:      Gateway → pino-elasticsearch → Elasticsearch → Kibana/Grafana
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { metrics, register } from '../services/metrics.js';
import { logTransaction } from '../services/transactionLogger.js';
import { config } from '../../config/gateway.js';
import type { TransactionRecord } from '../types/index.js';

const observabilityPlugin: FastifyPluginAsync = async (fastify) => {

  // ── Prometheus /metrics endpoint ─────────────────────────────────────────
  if (config.metrics.enabled) {
    fastify.get(config.metrics.path, async (_req, reply) => {
      reply.type('text/plain; version=0.0.4; charset=utf-8');
      return register.metrics();
    });
  }

  // ── Active connection tracking ────────────────────────────────────────────
  fastify.addHook('onRequest', async () => {
    metrics.activeConnections.inc();
  });

  // ── Per-request metrics + transaction log ─────────────────────────────────
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    metrics.activeConnections.dec();

    const latencyMs   = Number(process.hrtime.bigint() - request.startTime) / 1_000_000;
    const route       = request.routeOptions?.url ?? request.url.split('?')[0];
    const statusCode  = reply.statusCode;
    const upstream    = request.upstream ?? 'none';
    const method      = request.method;

    const labels = { method, route, status_code: String(statusCode), upstream };

    metrics.httpRequestsTotal.inc(labels);
    metrics.httpRequestDuration.observe(
      { method, route, status_code: String(statusCode), upstream },
      latencyMs / 1000,
    );

    const reqBytes  = parseInt(request.headers['content-length'] ?? '0', 10);
    const respBytes = parseInt(reply.getHeader('content-length') as string ?? '0', 10);

    metrics.httpRequestBytes.observe({ method, route }, reqBytes);
    metrics.httpResponseBytes.observe({ method, route, status_code: String(statusCode) }, respBytes);

    if (request.sanitisedFields.length > 0) {
      const bodyCount  = request.sanitisedFields.filter(f => f.startsWith('body')).length;
      const queryCount = request.sanitisedFields.filter(f => f.startsWith('query')).length;
      if (bodyCount  > 0) metrics.sanitiseEvents.inc({ field_scope: 'body' },  bodyCount);
      if (queryCount > 0) metrics.sanitiseEvents.inc({ field_scope: 'query' }, queryCount);
    }

    if (statusCode >= 500 && upstream !== 'none') {
      metrics.upstreamErrors.inc({ upstream, status_code: String(statusCode) });
    }

    // Build tags for searchability in Kibana/Grafana.
    const tags: string[] = [];
    if (request.blocked)                    tags.push('blocked');
    if (request.sanitisedFields.length > 0) tags.push('sanitised');
    if (statusCode >= 400)                   tags.push('error');
    if (statusCode >= 500)                   tags.push('server-error');
    if (latencyMs > 2000)                    tags.push('slow');

    const record: TransactionRecord = {
      transactionId:   request.transactionId,
      timestamp:       new Date().toISOString(),
      requestId:       request.id,
      method,
      url:             request.url,
      routePath:       route,
      clientIp:        request.clientIp,
      userAgent:       (request.headers['user-agent'] ?? '') as string,
      userId:          (request as FastifyRequest & { userId?: string | null }).userId ?? null,
      statusCode,
      latencyMs:       Math.round(latencyMs),
      requestBytes:    reqBytes,
      responseBytes:   respBytes,
      upstream:        request.upstream,
      blocked:         request.blocked,
      blockReason:     request.blockReason,
      sanitisedFields: request.sanitisedFields,
      tags,
    };

    logTransaction(record);
  });
};

export default fp(observabilityPlugin, { name: 'observability', fastify: '4.x' });
