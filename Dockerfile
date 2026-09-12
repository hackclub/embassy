# =============================================================================
# Hack Club Passport / Embassy - Production Dockerfile
# Multi-stage build for minimal production image
# Note: Prisma 7 generates the client to `generated/prisma` (see schema.prisma),
# NOT node_modules/.prisma. All COPY stages below reflect that.
# =============================================================================

# Stage 1: Base image
FROM oven/bun:1.4-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat ca-certificates

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Stage 2b: Production-only dependencies for the runner image
FROM base AS runner-deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Stage 3: Generate Prisma client (new generator: output = generated/prisma)
FROM base AS prisma
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY generated ./generated
# DATABASE_URL is required at config-load time even for generate; never used to connect
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN bunx prisma generate

# Stage 4: Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=prisma /app/generated ./generated
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
RUN bun run build

# Stage 5: Production runner
FROM base AS runner
ENV NODE_ENV=production

# curl is needed by the docker-compose healthcheck
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./

# Prisma CLI + runtime deps only (standalone output excludes node_modules;
# devDependencies like eslint/typescript never ship in the runner image)
COPY --from=runner-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "bun node_modules/prisma/build/index.js migrate deploy && exec bun server.js"]
