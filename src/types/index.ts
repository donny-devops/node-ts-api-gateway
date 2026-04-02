import type { FastifyRequest } from 'fastify';

export interface TransactionRecord {
  transactionId: string;
  timestamp:     string;
  requestId:     string;
  method:        string;
  url:           string;
  routePath:     string;
  clientIp:      string;
  userAgent:     string;
  userId:        string | null;
  statusCode:    number;
  latencyMs:     number;
  requestBytes:  number;
  responseBytes: number;
  upstream:      string | null;
  blocked:       boolean;
  blockReason:   string | null;
  sanitisedFields: string[];
  tags:          string[];
}

export interface DDoSState {
  ip:            string;
  windowStart:   number;
  count:         number;
  bannedUntil:   number | null;
}

export interface SanitiseResult {
  sanitised:    unknown;
  mutatedFields: string[];
  blocked:      boolean;
  reason:       string | null;
}

export interface RateLimitInfo {
  limit:     number;
  remaining: number;
  reset:     number;
}

declare module 'fastify' {
  interface FastifyRequest {
    transactionId:   string;
    startTime:       bigint;
    clientIp:        string;
    sanitisedFields: string[];
    blocked:         boolean;
    blockReason:     string | null;
    upstream:        string | null;
  }
}
