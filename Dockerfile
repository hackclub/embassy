FROM oven/bun:1.4-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat ca-certificates

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS runner-deps
COPY package.json /tmp/app-package.json
RUN bun -e 'const p = await Bun.file("/tmp/app-package.json").json(); await Bun.write("/cli/package.json", JSON.stringify({ name: "prisma-cli", private: true, dependencies: { prisma: p.dependencies.prisma } }));' \
 && cd /cli && bun install

FROM base AS prisma
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY generated ./generated
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN bunx prisma generate

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=prisma /app/generated ./generated
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
RUN bun run build

FROM base AS runner
ENV NODE_ENV=production

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./
COPY --from=runner-deps --chown=nextjs:nodejs /cli/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "bun node_modules/prisma/build/index.js migrate deploy && exec bun server.js"]
