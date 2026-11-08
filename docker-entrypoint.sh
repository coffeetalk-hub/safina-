#!/bin/sh
set -e

# Railway mounts volumes as root at start-up. Hand the storage directory to the
# unprivileged user, then continue as that user.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$STORAGE_DIR"
  chown -R node:node "$STORAGE_DIR"
  exec gosu node "$0" "$@"
fi

node_modules/.bin/prisma migrate deploy

if [ "$ALLOW_DEMO_SEED" = "true" ]; then
  echo "[entrypoint] ALLOW_DEMO_SEED=true: loading demo data with published passwords"
  node_modules/.bin/tsx prisma/seed.ts
else
  node_modules/.bin/tsx prisma/bootstrap.ts
fi

exec "$@"
