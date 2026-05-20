/**
 * Unit tests for the transaction logger service.
 *
 * Spies on the pino logger to verify that logTransaction and logSecurityEvent
 * emit the correct structured fields — without actually writing to
 * stdout or Elasticsearch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transactionLog, logTransaction, logSecurityEvent } from '../src/services/transactionLogger.js';
import type { TransactionRecord } from '../src/types/index.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    transactionId:   'tx-abc-123',
    timestamp:       '2024-01-01T00:00:00.000Z',
    requestId:       'req-1',
    method:          'GET',
    url:             '/api/users?page=1',
    routePath:       '/api/users',
    clientIp:        '1.2.3.4',
    userAgent:       'Mozilla/5.0',
    userId:          null,
    statusCode:      200,
    latencyMs:       42,
    requestBytes:    0,
    responseBytes:   256,
    upstream:        'http://user-service:8080',
    blocked:         false,
    blockReason:     null,
    sanitisedFields: [],
    tags:            [],
    ...overrides,
  };
}

// ── logTransaction ────────────────────────────────────────────────────────────

describe('logTransaction', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(transactionLog, 'info').mockImplementation(() => transactionLog);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls transactionLog.info once', () => {
    logTransaction(makeRecord());
    expect(infoSpy).toHaveBeenCalledOnce();
  });

  it('sets event.kind to "event"', () => {
    logTransaction(makeRecord());
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.kind']).toBe('event');
  });

  it('sets event.category to "web"', () => {
    logTransaction(makeRecord());
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.category']).toBe('web');
  });

  it('sets event.outcome to "success" for 2xx status codes', () => {
    logTransaction(makeRecord({ statusCode: 200 }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.outcome']).toBe('success');
  });

  it('sets event.outcome to "failure" for 4xx status codes', () => {
    logTransaction(makeRecord({ statusCode: 404 }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.outcome']).toBe('failure');
  });

  it('sets event.outcome to "failure" for 5xx status codes', () => {
    logTransaction(makeRecord({ statusCode: 500 }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.outcome']).toBe('failure');
  });

  it('sets event.duration in nanoseconds (latencyMs × 1_000_000)', () => {
    logTransaction(makeRecord({ latencyMs: 5 }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.duration']).toBe(5_000_000);
  });

  it('includes http.request.method', () => {
    logTransaction(makeRecord({ method: 'POST' }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['http.request.method']).toBe('POST');
  });

  it('includes http.response.status_code', () => {
    logTransaction(makeRecord({ statusCode: 201 }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['http.response.status_code']).toBe(201);
  });

  it('includes client.ip', () => {
    logTransaction(makeRecord({ clientIp: '9.9.9.9' }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['client.ip']).toBe('9.9.9.9');
  });

  it('includes transactionId', () => {
    logTransaction(makeRecord({ transactionId: 'tx-xyz' }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>).transactionId).toBe('tx-xyz');
  });

  it('includes upstream', () => {
    logTransaction(makeRecord({ upstream: 'http://order-service:8080' }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>).upstream).toBe('http://order-service:8080');
  });

  it('includes blocked flag', () => {
    logTransaction(makeRecord({ blocked: true, blockReason: 'IP banned (DDoS)' }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>).blocked).toBe(true);
    expect((payload as Record<string, unknown>).blockReason).toBe('IP banned (DDoS)');
  });

  it('includes sanitisedFields array', () => {
    logTransaction(makeRecord({ sanitisedFields: ['body.name', 'query.search'] }));
    const [payload] = infoSpy.mock.calls[0];
    expect((payload as Record<string, unknown>).sanitisedFields).toEqual(['body.name', 'query.search']);
  });

  it('formats the log message with method, route, status, and latency', () => {
    logTransaction(makeRecord({ method: 'GET', routePath: '/api/orders', statusCode: 200, latencyMs: 13 }));
    const message = infoSpy.mock.calls[0][1] as string;
    expect(message).toContain('GET');
    expect(message).toContain('/api/orders');
    expect(message).toContain('200');
    expect(message).toContain('13ms');
  });
});

// ── logSecurityEvent ──────────────────────────────────────────────────────────

describe('logSecurityEvent', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(transactionLog, 'warn').mockImplementation(() => transactionLog);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls transactionLog.warn once', () => {
    logSecurityEvent('auth-failure', { ip: '1.2.3.4' });
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('passes the event name as the message', () => {
    logSecurityEvent('ip-banned', { ip: '5.6.7.8' });
    const message = warnSpy.mock.calls[0][1] as string;
    expect(message).toBe('ip-banned');
  });

  it('sets event.kind to "alert"', () => {
    logSecurityEvent('brute-force', {});
    const [payload] = warnSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.kind']).toBe('alert');
  });

  it('sets event.category to "authentication"', () => {
    logSecurityEvent('brute-force', {});
    const [payload] = warnSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['event.category']).toBe('authentication');
  });

  it('merges extra details into the log payload', () => {
    logSecurityEvent('rate-limit', { ip: '3.3.3.3', attempts: 10 });
    const [payload] = warnSpy.mock.calls[0];
    expect((payload as Record<string, unknown>).ip).toBe('3.3.3.3');
    expect((payload as Record<string, unknown>).attempts).toBe(10);
  });
});
