# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:25-alpine AS builder

WORKDIR /build

COPY package*.json tsconfig.json ./
RUN npm ci --include=dev

COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:25-alpine AS runtime

RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /build/dist ./dist

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
