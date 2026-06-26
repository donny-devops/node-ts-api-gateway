import 'dotenv/config';

import { z } from 'zod';

const upstreamSchema = z.array(
  z.object({
    prefix: z.string().min(1).startsWith('/'),
    target: z.string().url(),
  }),
);

type Upstream = z.infer<typeof upstreamSchema>[number];

function parseInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new Error(`${name} must be an integer`);
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function parseFloatValue(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }
  return parsed;
}

function parseCsv(name: string, fallback: string): string[] {
  return (process.env[name] ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUpstreams(): Upstream[] {
  const fallback: Upstream[] = [
    { prefix: '/api/users', target: 'http://user-service:8080' },
    { prefix: '/api/products', target: 'http://product-service:8080' },
    { prefix: '/api/orders', target: 'http://order-service:8080' },
  ];

  const raw = process.env.UPSTREAMS;
  if (!raw) return fallback;

  try {
    return upstreamSchema.parse(JSON.parse(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown parse error';
    throw new Error(`UPSTREAMS must be a JSON array of { prefix, target } entries: ${message}`);
  }
}

export const config = {
  server: {
    host: process.env.HOST ?? '0.0.0.0',
    port: parseInteger('PORT', 3000),
    trustProxy: process.env.TRUST_PROXY === 'true',
  },

  upstreams: parseUpstreams(),

  jwt: {
    secret: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET environment variable is required for security') })(),
    issuer: process.env.JWT_ISSUER ?? 'api-gateway',
    expiresIn: process.env.JWT_EXPIRES ?? '1h',
    publicPaths: parseCsv('JWT_PUBLIC_PATHS', '/health,/metrics,/ready'),
  },

  rateLimit: {
    global: {
      max: parseInteger('RATE_LIMIT_GLOBAL_MAX', 500),
      timeWindowMs: parseInteger('RATE_LIMIT_GLOBAL_WINDOW', 60_000),
    },
    auth: {
      max: parseInteger('RATE_LIMIT_AUTH_MAX', 10),
      timeWindowMs: parseInteger('RATE_LIMIT_AUTH_WINDOW', 60_000),
    },
    perRoute: JSON.parse(process.env.RATE_LIMIT_PER_ROUTE ?? '{}') as Record<string, unknown>,
  },

  ddos: {
    requestsPerSecond: parseInteger('DDOS_RPS', 100),
    burstMultiplier: parseFloatValue('DDOS_BURST', 2.0),
    banDurationMs: parseInteger('DDOS_BAN_MS', 300_000),
    slowlorisTimeoutMs: parseInteger('DDOS_SLOWLORIS', 5_000),
    maxPayloadBytes: parseInteger('MAX_PAYLOAD_BYTES', 1_048_576),
  },

  sanitise: {
    stripXss: process.env.SANITISE_XSS !== 'false',
    stripSqlPatterns: process.env.SANITISE_SQL !== 'false',
    stripPathTraversal: process.env.SANITISE_PATH !== 'false',
    maxStringLength: parseInteger('MAX_STRING_LEN', 10_000),
    allowedContentTypes: parseCsv(
      'ALLOWED_CT',
      'application/json,application/x-www-form-urlencoded',
    ),
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || null,
    port: parseInteger('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInteger('REDIS_DB', 0),
    keyPrefix: 'gw:',
  },

  elk: {
    enabled: process.env.ELK_ENABLED === 'true',
    node: process.env.ELASTICSEARCH_URL ?? 'http://elasticsearch:9200',
    index: process.env.ELK_INDEX ?? 'gateway-transactions',
    apiKey: process.env.ELASTICSEARCH_API_KEY,
    flushBytes: parseInteger('ELK_FLUSH_BYTES', 1_048_576),
    flushInterval: parseInteger('ELK_FLUSH_INTERVAL', 5_000),
  },

  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    path: process.env.METRICS_PATH ?? '/metrics',
    defaultLabels: {
      service: 'api-gateway',
      env: process.env.NODE_ENV ?? 'development',
    },
  },

  otel: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'api-gateway',
    exporterUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317',
  },
} as const;

export type GatewayConfig = typeof config;
