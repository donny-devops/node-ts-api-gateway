import 'dotenv/config';

export const config = {
  server: {
    host: process.env.HOST ?? '0.0.0.0',
    port: parseInt(process.env.PORT ?? '3000', 10),
    trustProxy: process.env.TRUST_PROXY === 'true',
  },

  // ── Upstream services routed through the gateway ──────────────────────────
  upstreams: JSON.parse(process.env.UPSTREAMS ?? JSON.stringify([
    { prefix: '/api/users',    target: 'http://user-service:8080'    },
    { prefix: '/api/products', target: 'http://product-service:8080' },
    { prefix: '/api/orders',   target: 'http://order-service:8080'   },
  ])),

  // ── JWT ───────────────────────────────────────────────────────────────────
  jwt: {
    secret:            process.env.JWT_SECRET ?? 'change-me-in-production',
    issuer:            process.env.JWT_ISSUER  ?? 'api-gateway',
    expiresIn:         process.env.JWT_EXPIRES ?? '1h',
    publicPaths:       (process.env.JWT_PUBLIC_PATHS ?? '/health,/metrics,/ready').split(',').map(s => s.trim()),
  },

  // ── Rate limiting (per-client, sliding window via Redis) ─────────────────
  rateLimit: {
    global: {
      max:             parseInt(process.env.RATE_LIMIT_GLOBAL_MAX  ?? '500',  10),
      timeWindowMs:    parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW ?? '60000', 10),
    },
    auth: {
      max:             parseInt(process.env.RATE_LIMIT_AUTH_MAX    ?? '10',   10),
      timeWindowMs:    parseInt(process.env.RATE_LIMIT_AUTH_WINDOW ?? '60000', 10),
    },
    perRoute: JSON.parse(process.env.RATE_LIMIT_PER_ROUTE ?? '{}'),
  },

  // ── DDoS / flood protection ───────────────────────────────────────────────
  ddos: {
    requestsPerSecond:   parseInt(process.env.DDOS_RPS         ?? '100',  10),
    burstMultiplier:     parseFloat(process.env.DDOS_BURST     ?? '2.0'),
    banDurationMs:       parseInt(process.env.DDOS_BAN_MS      ?? '300000', 10),  // 5 min
    slowlorisTimeoutMs:  parseInt(process.env.DDOS_SLOWLORIS   ?? '5000',  10),
    maxPayloadBytes:     parseInt(process.env.MAX_PAYLOAD_BYTES ?? '1048576', 10), // 1 MB
  },

  // ── Input sanitisation ────────────────────────────────────────────────────
  sanitise: {
    stripXss:            process.env.SANITISE_XSS     !== 'false',
    stripSqlPatterns:    process.env.SANITISE_SQL     !== 'false',
    stripPathTraversal:  process.env.SANITISE_PATH    !== 'false',
    maxStringLength:     parseInt(process.env.MAX_STRING_LEN ?? '10000', 10),
    allowedContentTypes: (process.env.ALLOWED_CT ?? 'application/json,application/x-www-form-urlencoded,multipart/form-data').split(',').map(s => s.trim()),
  },

  // ── CORS ──────────────────────────────────────────────────────────────────
  cors: {
    origin:      process.env.CORS_ORIGIN       ?? '*',
    credentials: process.env.CORS_CREDENTIALS  === 'true',
  },

  // ── Redis (rate limiting store + ban list) ────────────────────────────────
  redis: {
    host:     process.env.REDIS_HOST     ?? 'localhost',
    port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    db:       parseInt(process.env.REDIS_DB   ?? '0', 10),
    keyPrefix: 'gw:',
  },

  // ── Observability — Elasticsearch / OpenSearch (ELK) ─────────────────────
  elk: {
    enabled:  process.env.ELK_ENABLED === 'true',
    node:     process.env.ELASTICSEARCH_URL ?? 'http://elasticsearch:9200',
    index:    process.env.ELK_INDEX         ?? 'gateway-transactions',
    apiKey:   process.env.ELASTICSEARCH_API_KEY,
    flushBytes:  parseInt(process.env.ELK_FLUSH_BYTES ?? '1048576', 10),
    flushInterval: parseInt(process.env.ELK_FLUSH_INTERVAL ?? '5000', 10),
  },

  // ── Observability — Prometheus / Grafana ─────────────────────────────────
  metrics: {
    enabled:     process.env.METRICS_ENABLED !== 'false',
    path:        process.env.METRICS_PATH    ?? '/metrics',
    defaultLabels: {
      service:   'api-gateway',
      env:       process.env.NODE_ENV ?? 'development',
    },
  },

  // ── OpenTelemetry tracing ─────────────────────────────────────────────────
  otel: {
    enabled:      process.env.OTEL_ENABLED === 'true',
    serviceName:  process.env.OTEL_SERVICE_NAME  ?? 'api-gateway',
    exporterUrl:  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317',
  },
} as const;

export type GatewayConfig = typeof config;
