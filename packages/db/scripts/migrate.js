#!/usr/bin/env node
/**
 * Apply pending SQL migrations to a running PostgreSQL + AGE instance.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://fupe:fupe_dev@localhost:5433/fupe';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MAX_RETRIES = 30;
const RETRY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry() {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = new Client({ connectionString: DATABASE_URL });
    try {
      await client.connect();
      if (attempt > 1) {
        console.log(`Connected to database (attempt ${attempt}).`);
      }
      return client;
    } catch (err) {
      lastError = err;
      await client.end().catch(() => {});
      if (attempt < MAX_RETRIES) {
        process.stdout.write(
          `Waiting for database... (${attempt}/${MAX_RETRIES})\r`,
        );
        await sleep(RETRY_MS);
      }
    }
  }

  console.error('\nCould not connect to PostgreSQL.');
  console.error(`  URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.error(`  Error: ${lastError.message}`);
  console.error('\nTroubleshooting:');
  console.error('  1. Start the database:  pnpm db:up');
  console.error('  2. If the container is crash-looping, reset the volume:');
  console.error('       docker compose down -v && pnpm db:up');
  console.error('  3. Then run migrations:  pnpm db:migrate');
  console.error(
    '  4. FUPE uses port 5433 by default (5432 is often taken by a local Postgres).',
  );
  process.exit(1);
}

async function main() {
  const client = await connectWithRetry();

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await client.query(
    'SELECT filename FROM public.schema_migrations ORDER BY filename',
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`  apply ${file}`);
    try {
      // AGE graph operations (LOAD 'age', create_graph, etc.) cannot run inside
      // a transaction — they will fail with ResourceOwnerEnlarge errors.
      await client.query(sql);
      await client.query(
        'INSERT INTO public.schema_migrations (filename) VALUES ($1)',
        [file],
      );
    } catch (err) {
      console.error(`\nMigration failed: ${file}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
