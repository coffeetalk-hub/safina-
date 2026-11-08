# Railway builds this image automatically when it finds a Dockerfile in the repo.
FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates gosu \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
# `npm ci` runs `prisma generate`, which needs the schema.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && rm -rf .next/cache
RUN npm prune --omit=dev --no-audit --no-fund

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_DIR=/data/storage
COPY --from=build --chown=node:node /app/package.json /app/tsconfig.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/messages ./messages
# prisma/ and src/ are needed at start-up for migrations and first-run setup.
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src ./src
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
