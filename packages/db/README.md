# FUPE Graph Schema

PostgreSQL database with the [Apache AGE](https://age.apache.org/) extension for OpenCypher graph queries.

## Graph: `fupe_graph`

### Nodes

| Label | Properties | Description |
|-------|-----------|-------------|
| `Entity` | `id`, `name`, `type`, `slug`, `country_codes`, `sector`, `aliases`, `source`, `updated_at` | Corporate entity. `type` ∈ `BRAND`, `SUBSIDIARY`, `PARENT_CORP`, `PE_FIRM`, `VC_FIRM` |
| `Product` | `gtin`, `name`, `category` | Consumer product identified by GTIN/UPC/EAN |
| `Citation` | `id`, `url`, `title` | Source citation for ownership claims |

### Relationships

| Edge | From → To | Properties |
|------|-----------|------------|
| `MANUFACTURED_BY` | Product → Entity | — |
| `OWNED_BY` | Entity → Entity | `percentage` (float, optional) |
| `PORTFOLIO_COMPANY_OF` | Entity → Entity | PE/VC portfolio link |
| `HAS_CITATION` | Entity → Citation | — |

### Example Cypher Queries

```cypher
-- Find ultimate parent of a brand
MATCH (brand:Entity {id: $brandId})-[:OWNED_BY*]->(parent:Entity)
WHERE parent.type IN ['PARENT_CORP', 'PE_FIRM']
RETURN parent
ORDER BY length(path) DESC
LIMIT 1

-- Product lookup by barcode
MATCH (p:Product {gtin: $gtin})-[:MANUFACTURED_BY]->(e:Entity)
OPTIONAL MATCH (e)-[:OWNED_BY*]->(owner:Entity)
RETURN p, e, collect(owner) AS ownership_chain

-- Flag PE-backed brands
MATCH (brand:Entity {type: 'BRAND'})-[:OWNED_BY*]->(pe:Entity {type: 'PE_FIRM'})
RETURN brand.name, pe.name AS pe_firm
```

## Running Migrations

```bash
# Start PostgreSQL + AGE (auto-runs migrations on first boot)
pnpm db:up

# Apply migrations to an existing database
pnpm db:migrate

# Reset database (dev only)
pnpm db:reset && pnpm db:migrate
```

### Migration files

| File | Description |
|------|-------------|
| `001_init_fupe_graph.sql` | Apache AGE graph, labels, indexes |
| `002_relational_tables.sql` | users, edits_queue, audit_logs, wiki_revisions |
| `003_seed_demo.sql` | Panera Bread → JAB Holding demo chain |
| `004_seed_fast_food.sql` | QSR PE portfolios (Roark, JAB, Blackstone) + independent chains |
| `005_entity_metadata.sql` | Entity metadata properties + `data_sources` / `ingestion_runs` tables |

## Relational Tables

### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | TEXT | Unique login |
| password_hash | TEXT | bcrypt hash |
| trust_score | INTEGER | 0–100; >50 auto-commits edits |
| created_at | TIMESTAMPTZ | Registration time |

### `edits_queue`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Submitter |
| target_node_id | TEXT | Graph entity ID |
| proposed_data | JSONB | Proposed changes |
| citation_url | TEXT | Required for PE/VC edits |
| status | ENUM | PENDING, APPROVED, REJECTED |

### `audit_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| entity_id | TEXT | Affected entity |
| previous_state | JSONB | State before edit |
| new_state | JSONB | State after edit |
| edited_by | UUID | User who made change |
| timestamp | TIMESTAMPTZ | When change occurred |

### `wiki_revisions`
Revision history mirror for wiki-style entity pages.

### `data_sources`
ETL source registry (`id`, `name`, `license`, `attribution_url`).

### `ingestion_runs`
Batch ingest audit log linked to `data_sources`.

## Connection

```
DATABASE_URL=postgresql://fupe:fupe_dev@localhost:5433/fupe
```
