/**
 * metrics.ts — Prometheus metric definitions
 *
 * All counters/histograms used across the gateway are defined here so they
 * are registered once and importable anywhere without re-registering.
 *
 * Scraped by Grafana via Prometheus at GET /metrics.
 */

import client, { Registry } from 'prom-client';
import { config } from '../../config/gateway.js';

export const register = new Registry();

// Attach default Node.js metrics (CPU, memory, event-loop lag, etc.)
client.collectDefaultMetrics({
  register,
  labels: config.metrics.defaultLabels,
});

// ── HTTP request metrics ──────────────────────────────────────────────────────

export const httpRequestsTotal = new client.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total HTTP requests processed by the gateway',
  labelNames: ['method', 'route', 'status_code', 'upstream'] as const,
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name:    'gateway_http_request_duration_seconds',
  help:    'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'upstream'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestBytes = new client.Histogram({
  name:    'gateway_http_request_bytes',
  help:    'HTTP request payload size in bytes',
  labelNames: ['method', 'route'] as const,
  buckets: [100, 1_000, 10_000, 100_000, 1_000_000],
  registers: [register],
});

export const httpResponseBytes = new client.Histogram({
  name:    'gateway_http_response_bytes',
  help:    'HTTP response payload size in bytes',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [100, 1_000, 10_000, 100_000, 1_000_000],
  registers: [register],
});

// ── Security metrics ──────────────────────────────────────────────────────────

export const ddosBlocked = new client.Counter({
  name: 'gateway_ddos_blocked_total',
  help: 'Requests blocked by DDoS/flood protection',
  labelNames: ['reason'] as const,
  registers: [register],
});

export const sanitiseEvents = new client.Counter({
  name: 'gateway_sanitise_mutations_total',
  help: 'Number of request fields mutated by the sanitiser',
  labelNames: ['field_scope'] as const,  // body | query
  registers: [register],
});

export const rateLimitHits = new client.Counter({
  name: 'gateway_rate_limit_hits_total',
  help: 'Number of requests rejected by rate limiting',
  labelNames: ['route'] as const,
  registers: [register],
});

export const authFailures = new client.Counter({
  name: 'gateway_auth_failures_total',
  help: 'Number of authentication failures',
  labelNames: ['reason'] as const,
  registers: [register],
});

// ── Upstream metrics ──────────────────────────────────────────────────────────

export const upstreamErrors = new client.Counter({
  name: 'gateway_upstream_errors_total',
  help: 'Number of upstream service errors',
  labelNames: ['upstream', 'status_code'] as const,
  registers: [register],
});

export const activeConnections = new client.Gauge({
  name: 'gateway_active_connections',
  help: 'Number of currently active HTTP connections',
  registers: [register],
});

// ── Named export bundle ───────────────────────────────────────────────────────

export const metrics = {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestBytes,
  httpResponseBytes,
  ddosBlocked,
  sanitiseEvents,
  rateLimitHits,
  authFailures,
  upstreamErrors,
  activeConnections,
};
