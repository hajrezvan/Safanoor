# Runtime image — run `npm run build` on the host first, then:
#   docker build -t safanoor:phase0 .
#   docker run --rm -p 3000:3000 -e RUN_SEED=true -v safanoor_data:/data safanoor:phase0

FROM node:24-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 nextjs \
    && mkdir -p /data \
    && chown -R nextjs:nodejs /data

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/data/app.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
COPY drizzle ./drizzle
COPY docker ./docker

# Full packages (standalone copies lack binding.gyp / native sources)
COPY node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY node_modules/argon2 ./node_modules/argon2
COPY node_modules/drizzle-orm ./node_modules/drizzle-orm

RUN rm -rf node_modules/better-sqlite3/build node_modules/better-sqlite3/prebuilds \
    && npx --yes node-gyp rebuild --directory=node_modules/better-sqlite3 \
    && rm -rf node_modules/argon2/build \
    && chmod +x docker/entrypoint.sh \
    && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["/app/docker/entrypoint.sh"]
