FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /app/data /app/.next/cache /app/scripts \
    && chown -R nextjs:nodejs /app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/backup-database.mjs ./scripts/backup-database.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate-sqlite-to-postgres.mjs ./scripts/migrate-sqlite-to-postgres.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start-server.mjs ./scripts/start-server.mjs
USER nextjs
EXPOSE 3000
CMD ["node", "scripts/start-server.mjs"]
