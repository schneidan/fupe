# @fupe/ingest

ETL package for loading corporate ownership data into FUPE (PostgreSQL + Apache AGE).

## Layout

```
src/
  sources/     fetch per provider (Wikidata + Open Food Facts live; others stubbed)
  normalize/   name / entity cleanup
  match/       entity dedupe + review queue
  load/        MERGE Entity / edges / Citation + ingestion_runs audit
  schedule/    cursor-backed cron runner + stale citation flagging
  pipeline.ts  fetch → load
  cli.ts       `pnpm ingest` / `pnpm ingest --schedule`
```

## Scheduled refresh (Phase 4.4)

```bash
pnpm db:migrate          # includes ingest_cursors
pnpm ingest:schedule     # polite defaults for ~40min cron
pnpm ingest --schedule --max-pages 1 --dry-run
```

| Flag | Default | Description |
|------|---------|-------------|
| `--max-pages` | `2` | Pages per source/region per run |
| `--page-size` / `--limit` | `25` | Records per page |
| `--stale-months` | `6` | Flag citations older than this |
| `--delay-ms` | `8000` | Pause between pages (be nice to Wikidata/OFF) |
| `--dry-run` | off | Fetch only; no cursor/stale writes |

Default jobs: Wikidata US + EU (offset), Open Food Facts US (page). Cursors live in `public.ingest_cursors`. When a source reports `exhausted`, the next run resets to the start for a refresh pass.

Each page logs a diff (`Δentities`, `Δcitations`, matched/queued). After pages, citations with `retrieved_at` older than N months are marked `stale` (shown as “may be outdated” in web/mobile).

Every-40-minutes cron (defaults are already polite — no flags needed):

```bash
*/40 * * * * cd /path/to/fupe && pnpm ingest:schedule
```

## Manual / backfill CLI

```bash
pnpm db:up

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
| `--schedule` | Run the cursor scheduler instead |

| Source | Advance with | Stop when |
|--------|--------------|-----------|
| `wikidata` | `--offset` (+ `--limit`) | `metadata.exhausted` |
| `open-food-facts` | `--page` (+ `--limit`) | `metadata.exhausted` |

## Sources (Phase 4.2)

| Id | Status | What it loads |
|----|--------|----------------|
| `wikidata` | **Live** | P749 parent-org edges; PE/VC typed via P31 |
| `open-food-facts` | **Live** | Products + brand entities + `MANUFACTURED_BY` |
| `sec-edgar` | Stub (P1) | — |
| `companies-house` | Stub (P1) | — |

Commercial databases (e.g. OpenCorporates) are **out of scope** for now — open sources + community only.

## Deduplication (Phase 4.3)

On load, each entity is matched against the graph:

1. `external_ids.wikidata` / `companies_house` exact → **auto-merge**
2. Exact `id` / `slug` → **auto-merge**
3. Equal normalized name key after stripping Inc./LLC/etc. → **auto-merge**
4. Fuzzy name is **review-only** (trigram + Jaccard + discriminator checks)

## Programmatic

```ts
import { runIngest, runSchedule } from '@fupe/ingest';

await runIngest({ source: 'wikidata', region: 'US', limit: 50, offset: 0 });
await runSchedule({ maxPages: 2, staleMonths: 6 });
```
