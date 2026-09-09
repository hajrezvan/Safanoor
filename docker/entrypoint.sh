#!/bin/sh
set -e
export DATABASE_PATH="${DATABASE_PATH:-/data/app.db}"
mkdir -p "$(dirname "$DATABASE_PATH")"
cd /app
echo "Running migrations on $DATABASE_PATH ..."
node docker/migrate.mjs
if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding database..."
  node docker/seed.mjs
fi
exec node server.js
