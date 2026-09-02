# @fupe/ingest

ETL package for loading corporate ownership data into FUPE (PostgreSQL + Apache AGE).

## Layout

```
src/
  sources/     fetch per provider (Wikidata + Open Food Facts live; others stubbed)
  normalize/   name / entity cleanup
  load/        MERGE Entity / edges / Citation + ingestion_runs audit
  pipeline.ts  fetch → load
  cli.ts       `pnpm ingest` entrypoint
```

## Can this run on cron?

**Yes.** Each run is idempotent (`MERGE` upserts) and returns a cursor:

| Source | Advance with | Stop when |
|--------|--------------|-----------|
| `wikidata` | `--offset` (+ `--limit`) | `metadata.exhausted` |
| `open-food-facts` | `--page` (+ `--limit`) | `metadata.exhausted` |

Typical backfill loop (shell):

```bash
OFFSET=0
while true; do
  OUT=$(pnpm ingest --source wikidata --region US --limit 50 --offset $OFFSET)
  echo "$OUT"
  echo "$OUT" | grep -q 'exhausted\|Source page exhausted' && break
  OFFSET=$((OFFSET + 50))
  sleep 2   # be polite to Wikidata
done
```

Phase **4.4** will add scheduled refresh + diff logging; until then, cron the CLI yourself.

## CLI

```bash
pnpm db:up   # Postgres required for non-dry-run

pnpm ingest --source wikidata --region US --limit 25 --dry-run
pnpm ingest --source wikidata --region US --limit 25 --offset 0
pnpm ingest --source open-food-facts --region US --page 1 --limit 25
pnpm ingest --help
```

| Flag | Description |
|------|-------------|
| `--source` / `-s` | Source id |
| `--region` / `-r` | `US`, `GB`, `EU`, … |
| `--dry-run` | Fetch only — no DB writes |
| `--limit` | Page size (default 50) |
| `--offset` | Wikidata SPARQL offset |
| `--page` | Open Food Facts page (1-based) |
| `--database-url` | Override `DATABASE_URL` |

## Sources (Phase 4.2)

| Id | Status | What it loads |
|----|--------|----------------|
| `wikidata` | **Live** | P749 parent-org edges; PE/VC typed via P31 |
| `open-food-facts` | **Live** | Products + brand entities + `MANUFACTURED_BY` |
| `sec-edgar` | Stub (P1) | — |
| `companies-house` | Stub (P1) | — |
| `opencorporates` | Stub (P2) | License review required |

## Programmatic

```ts
import { runIngest } from '@fupe/ingest';

await runIngest({ source: 'wikidata', region: 'US', limit: 50, offset: 0 });
```
