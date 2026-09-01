#!/usr/bin/env node
/**
 * Drop and recreate the fupe database (development only).
 */
const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://fupe:fupe_dev@localhost:5433/fupe';

async function main() {
  const url = new URL(DATABASE_URL);
  const dbName = url.pathname.slice(1);
  url.pathname = '/postgres';

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();

  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName]
  );
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  console.log(`Database "${dbName}" recreated. Run: pnpm db:migrate`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
