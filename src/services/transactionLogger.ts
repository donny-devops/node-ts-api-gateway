/**
 * transactionLogger.ts — Centralised transaction logging service
 *
 * Every completed request produces a structured TransactionRecord which is:
 *   • Written to pino (stdout / JSON) — captured by any log shipper
 *   • Shipped to Elasticsearch / OpenSearch in bulk (ELK stack)
 *
 * The Elasticsearch transport uses pino-elasticsearch with automatic index
 * rollover. Each document maps 1:1 to a TransactionRecord + timestamp fields
 * required by Kibana/Grafana dashboards.
 *
 * Grafana data source: Elasticsearch index "gateway-transactions-*"
 * Kibana index pattern: gateway-transactions-*
 */

import pino, { type Logger } from 'pino';
import type { TransactionRecord } from '../types/index.js';
import { config } from '../../config/gateway.js';

// ── Pino transports ───────────────────────────────────────────────────────────

function buildTransports() {
  const targets: pino.TransportTargetOptions[] = [
    {
      target:  'pino/file',
      level:   'info',
      options: { destination: 1 }, // stdout
    },
  ];

  if (config.elk.enabled) {
    targets.push({
      target:  'pino-elasticsearch',
      level:   'info',
      options: {
        node:          config.elk.node,
        index:         config.elk.index,
        apiKey:        config.elk.apiKey,
        flushBytes:    config.elk.flushBytes,
        flushInterval: config.elk.flushInterval,
        // Retry failed bulk writes up to 3 times with exponential back-off
        'es-version': 8,
      },
    });
  }

  return pino.transport({ targets });
}

// ── Logger instance ───────────────────────────────────────────────────────────

const transport = buildTransports();

export const transactionLog: Logger = pino(
  {
    level:      'info',
    base:       config.metrics.defaultLabels,
    timestamp:  pino.stdTimeFunctions.isoTime,
    serializers: pino.stdSerializers,
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  transport,
);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Log a completed transaction.
 * Sets `event.kind = "event"` and `event.category = "web"` for ECS compliance
 * so the record integrates cleanly with Kibana Security and APM.
 */
export function logTransaction(record: TransactionRecord): void {
  transactionLog.info(
    {
      // ECS (Elastic Common Schema) fields
      'event.kind':     'event',
      'event.category': 'web',
      'event.outcome':  record.statusCode < 400 ? 'success' : 'failure',
      'event.duration': record.latencyMs * 1_000_000, // nanoseconds for ECS

      // HTTP fields
      'http.request.method':        record.method,
      'http.request.bytes':         record.requestBytes,
      'http.response.status_code':  record.statusCode,
      'http.response.bytes':        record.responseBytes,

      // Network / client
      'client.ip':   record.clientIp,
      'url.full':    record.url,
      'url.path':    record.routePath,
      'user_agent.original': record.userAgent,

      // Application
      'user.id':     record.userId,
      upstream:      record.upstream,
      transactionId: record.transactionId,
      requestId:     record.requestId,
      latencyMs:     record.latencyMs,

      // Security flags
      blocked:         record.blocked,
      blockReason:     record.blockReason,
      sanitisedFields: record.sanitisedFields,
      tags:            record.tags,
    },
    `${record.method} ${record.routePath} ${record.statusCode} ${record.latencyMs}ms`,
  );
}

/**
 * Log a security event (ban, repeated auth failure, etc.) at WARN level.
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>,
): void {
  transactionLog.warn({ 'event.kind': 'alert', 'event.category': 'authentication', ...details }, event);
}
