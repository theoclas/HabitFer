#!/bin/sh
set -e

if [ "${PRISMA_DB_PUSH:-true}" = "true" ]; then
  echo "Applying Prisma schema (db push)..."
  npx prisma db push --skip-generate
fi

exec "$@"
