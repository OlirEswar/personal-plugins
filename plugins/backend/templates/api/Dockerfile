# Production image. Node runs the TypeScript sources directly, so there is no build stage.
#   docker build -t api .
#   docker run --rm --env-file .env.production -p 8787:8787 api                       # the API (+ job worker)
#   docker run --rm --env-file .env.production api node src/db/migrate.ts             # release step: migrations
#   docker run --rm --env-file .env.production -e RUN_WORKER=false ... / node src/worker.ts   # split worker
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787

# Dependencies first so they're cached between code changes. Runtime dependencies only.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY src ./src
COPY drizzle ./drizzle

# SQLite only: the database file lives here; mount a persistent volume at /app/data.
RUN mkdir -p /app/data && chown node:node /app/data
USER node

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/health/live || exit 1

CMD ["node", "src/index.ts"]
