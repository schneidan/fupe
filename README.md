# FUPE — Find Ultimate Parent Entity

Consumer transparency app that identifies corporate ownership chains and flags Private Equity (PE) backing for products, brands, and companies.

## Monorepo Structure

```
fupe/
├── apps/
│   ├── web/          # Next.js (App Router, Tailwind, TypeScript)
│   └── mobile/       # Flutter + ML Kit barcode scanning
├── services/
│   └── api/          # NestJS — GraphQL & REST
├── packages/
│   └── db/           # PostgreSQL + Apache AGE migrations
└── docker-compose.yml
```

## Quick Start

```bash
pnpm install
pnpm db:setup          # starts Docker Postgres + runs migrations
cp services/api/.env.example services/api/.env
pnpm --filter @fupe/api dev    # :3000
pnpm --filter @fupe/web dev    # :3001
```

> **Note:** FUPE Postgres runs on **port 5433** (not 5432) to avoid conflicts with a local Postgres install.

### Database troubleshooting

If `pnpm db:migrate` fails:

1. **Password auth failed** — you're likely hitting a different Postgres on port 5432. FUPE uses port **5433**. Ensure `DATABASE_URL` ends with `:5433/fupe`.

2. **Container crash-looping** — reset the Docker volume (wipes local DB data):
   ```bash
   pnpm db:reset-volume && pnpm db:setup
   ```

3. **Port already allocated** — another service owns 5433. Change the host port in `docker-compose.yml` and update `DATABASE_URL` to match.

## Unified Lookup API

**`POST /api/v1/lookup`**

| type | payload | behavior |
|------|---------|----------|
| `BARCODE` | `{ "type": "BARCODE", "gtin": "..." }` | Product lookup; falls back to Open Food Facts and auto-creates node |
| `TEXT` | `{ "type": "TEXT", "query": "Panera" }` | pg_trgm fuzzy search on Entity + Product names |
| `IMAGE` | multipart: `type=IMAGE`, `file=<image>` | Tesseract OCR → Vision API fallback → graph search |
| `VOICE` | `{ "type": "VOICE", "transcript": "..." }` or multipart with audio file | Whisper transcription → graph search |

**Response shape:**

```json
{
  "matched_item": "Panera Bread",
  "is_private_equity_owned": true,
  "ultimate_parent": { "name": "JAB Holding Company", "type": "PE_FIRM" },
  "ownership_chain": [
    { "name": "Panera Bread", "type": "BRAND" },
    { "name": "Panera Brands Inc.", "type": "SUBSIDIARY" },
    { "name": "JAB Holding Company", "type": "PE_FIRM" }
  ],
  "citations": [{ "title": "PE Database", "url": "https://..." }]
}
```

Traversal walks `OWNED_BY` and `PORTFOLIO_COMPANY_OF` edges up to **10 degrees** and flags `PE_FIRM` / `VC_FIRM` parents.

## Crowdsourcing (Wiki Model)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/v1/auth/register` | — | Create account |
| `POST /api/v1/auth/login` | — | Get JWT |
| `POST /api/v1/edits` | Bearer JWT | Submit ownership edit |
| `GET /api/v1/edits/queue` | Bearer JWT (trust > 50) | List pending edits |
| `PATCH /api/v1/edits/:id/review` | Bearer JWT (trust > 50) | Approve / reject |

**Trust rules:**
- `trust_score > 50` → edits auto-commit to graph + `audit_logs` + `wiki_revisions`
- `trust_score ≤ 50` → edits go to `edits_queue` (status `PENDING`)
- PE/VC ownership changes **require** a valid `citation_url`

## Database Schema

### Graph (`fupe_graph` via Apache AGE)
Nodes: `Entity`, `Product`, `Citation`  
Edges: `MANUFACTURED_BY`, `OWNED_BY`, `PORTFOLIO_COMPANY_OF`, `HAS_CITATION`

### Relational tables
- `users` — id, email, trust_score, created_at
- `edits_queue` — crowdsourced proposals (PENDING / APPROVED / REJECTED)
- `audit_logs` — immutable change history
- `wiki_revisions` — revision history per entity

See [packages/db/README.md](packages/db/README.md) for migration details.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Auth token signing key |
| `OPENAI_API_KEY` | Whisper + Vision OCR fallback (optional) |
| `OPEN_FOOD_FACTS_URL` | Barcode fallback API |

## Demo Data

Migration `003_seed_demo.sql` seeds the Panera Bread → JAB Holding ownership chain for testing:

```bash
pnpm db:migrate
# Then: POST /api/v1/lookup { "type": "TEXT", "query": "Panera Bread" }
```
