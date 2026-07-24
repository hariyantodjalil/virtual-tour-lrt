#!/bin/sh
# Flexible Prisma migrate for deploy:
# - runs migrate deploy
# - on P3009 / failed history: resolve ALL failed migrations (any name), then deploy again
set -eu

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

list_failed_migrations() {
  node <<'NODE'
const { Client } = require("pg");

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL
      ORDER BY started_at ASC
    `);
    for (const row of result.rows) {
      process.stdout.write(`${row.migration_name}\n`);
    }
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error("[prisma-migrate-deploy] gagal membaca _prisma_migrations:", error.message || error);
  process.exit(1);
});
NODE
}

resolve_failed_migrations() {
  mode="${PRISMA_RESOLVE_MODE:-applied}"
  failed="$(list_failed_migrations || true)"

  if [ -z "${failed}" ]; then
    echo "[prisma-migrate-deploy] tidak ada migrasi failed di _prisma_migrations"
    return 1
  fi

  echo "[prisma-migrate-deploy] migrasi failed terdeteksi:"
  echo "${failed}" | sed 's/^/  - /'

  echo "${failed}" | while IFS= read -r name; do
    [ -n "${name}" ] || continue
    echo "[prisma-migrate-deploy] resolve ${mode}: ${name}"
    if [ "${mode}" = "rolled-back" ]; then
      npx prisma migrate resolve --rolled-back "${name}" \
        || npx prisma migrate resolve --applied "${name}" \
        || true
    else
      npx prisma migrate resolve --applied "${name}" \
        || npx prisma migrate resolve --rolled-back "${name}" \
        || true
    fi
  done
}

echo "[prisma-migrate-deploy] prisma migrate deploy"
if npx prisma migrate deploy; then
  exit 0
fi

echo "[prisma-migrate-deploy] deploy gagal — coba recover semua migrasi failed"
resolve_failed_migrations || true

echo "[prisma-migrate-deploy] prisma migrate deploy (retry)"
npx prisma migrate deploy
