# FUPE staging deploy (same VPS as prod)

Step-by-step checklist to run **staging** beside production on one droplet:


| Host                   | Role           | Upstream         |
| ---------------------- | -------------- | ---------------- |
| `staging.fupe.app`     | Next.js        | `127.0.0.1:3003` |
| `api-staging.fupe.app` | Nest API       | `127.0.0.1:3002` |
| (internal)             | Postgres + AGE | `127.0.0.1:5434` |


**Prod stays alone:** `fupe.app` / `api.fupe.app` → `:3001` / `:3000` / Postgres `:5433`.

Assumes prod is already live per `[production-deploy.md](./production-deploy.md)`.

Replace placeholders:


| Placeholder           | Example                |
| --------------------- | ---------------------- |
| `PROD_ROOT`           | `/root/fupe`           |
| `STAGING_ROOT`        | `/root/fupe-staging`   |
| `YOUR_VPS_IP`         | droplet IPv4           |
| `STAGING_DB_PASSWORD` | `openssl rand -hex 24` |
| `STAGING_JWT_SECRET`  | `openssl rand -hex 32` |
| `STAGING_FIRST_PARTY` | `openssl rand -hex 32` |


---

## 0. Before you start

- [x] Prod is healthy (`https://fupe.app`, `https://api.fupe.app/health`)
- [x] You can SSH to the VPS as the deploy user (often `root`)
- [x] Droplet has enough RAM for a second AGE + two Node processes (`free -h` — aim for ≥1 GiB free; stop staging when idle if tight)
- [x] Stripe **Test** mode still available (staging uses test keys + a separate event destination)

---

## 1. DNS (Cloudflare)

In Cloudflare → **fupe.app** → **DNS**:

- [x] A record `staging` → `YOUR_VPS_IP` → **Proxied**
- [x] A record `api-staging` → `YOUR_VPS_IP` → **Proxied**
- [x] Caching: bypass cache for `api-staging.fupe.app/*` (same idea as `api`)

Check (expect Cloudflare IPs publicly; origin IP only in DNS UI):

```bash
dig +short staging.fupe.app
dig +short api-staging.fupe.app
```

- [x] Records resolve

---

## 2. Staging Postgres (port 5434)

From `PROD_ROOT` (compose file lives with the monorepo; container is independent):

```bash
cd PROD_ROOT
# Use the staging compose file from the repo (after git pull), or create it:
# docker compose -f docker-compose.staging.yml up -d
```

Expected file: `[docker-compose.staging.yml](../docker-compose.staging.yml)` — maps `127.0.0.1:5434:5432`, volume `fupe_pgdata_staging`, DB/user `fupe`.

- [x] Set `POSTGRES_PASSWORD` in that file (or an override) to `STAGING_DB_PASSWORD` — **not** the prod password
- [x] Start it:

```bash
cd PROD_ROOT
# Always use -p fupe-staging so PROD_ROOT vs STAGING_ROOT don't fight over the name
docker compose -p fupe-staging -f docker-compose.staging.yml up -d
docker compose -p fupe-staging -f docker-compose.staging.yml exec -T postgres-staging \
  pg_isready -U fupe -d fupe
```

If you later see `Conflict … /fupe-postgres-staging is already in use`, the container already exists — **do not remove it** (that’s your staging data). Start it and continue:

```bash
docker start fupe-postgres-staging
docker exec fupe-postgres-staging pg_isready -U fupe -d fupe
```

- [x] `pg_isready` succeeds
- [x] Confirm prod still on 5433: `ss -lntp | grep -E '5433|5434'`

---

## 3. Staging code tree

Next bakes `API_URL` at build time — **do not** share prod’s `.next` with staging.

```bash
# Sibling clone (simple)
git clone <YOUR_GIT_REMOTE> STAGING_ROOT
cd STAGING_ROOT
git checkout main   # or the branch you want to test
```

Or worktree from prod:

```bash
cd PROD_ROOT
git worktree add STAGING_ROOT main
```

- [x] `STAGING_ROOT` exists and is a full checkout
- [x] You will only `git pull` / rebuild staging **inside** `STAGING_ROOT`

---

## 4. Staging env files

### 4a. API — `STAGING_ROOT/services/api/.env`

- [ ] Create from example and edit:

```bash
cd STAGING_ROOT
cp services/api/.env.example services/api/.env
vi services/api/.env
```

Minimum:

```bash
NODE_ENV=production
PORT=3002
DATABASE_URL=postgresql://fupe:STAGING_DB_PASSWORD@127.0.0.1:5434/fupe
JWT_SECRET=STAGING_JWT_SECRET
CORS_ORIGIN=https://staging.fupe.app
NEXT_PUBLIC_SITE_URL=https://staging.fupe.app
FIRST_PARTY_LOOKUP_SECRET=STAGING_FIRST_PARTY
REQUIRE_API_KEY=false
LOOKUP_IP_RATE_LIMIT_PER_MIN=60

EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...          # can reuse prod Resend key
EMAIL_FROM=FUPE Staging <noreply@fupe.app>
AUTO_VERIFY_EMAIL=false

# Stripe TEST mode (separate event-destination secret — §8)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_DEVELOPER=price_...
# STRIPE_WEBHOOK_SECRET=whsec_...   # fill after §8b

# Vision for IMAGE (logos / storefronts / packaging) — without this, OCR-only fallback is weak
# OPENAI_API_KEY=sk-...
# OPENAI_VISION_MODEL=gpt-4o-mini
```

Checklist:

- [x] `PORT=3002`
- [x] `DATABASE_URL` uses **5434** and staging password
- [x] `JWT_SECRET` ≠ prod
- [x] `FIRST_PARTY_LOOKUP_SECRET` ≠ prod (or at least intentional)
- [x] `AUTO_VERIFY_EMAIL=false`
- [x] No live `sk_live_` keys here
- [ ] `OPENAI_API_KEY` set if you want strong IMAGE (logo/storefront) results
### 4b. Web — `STAGING_ROOT/apps/web/.env.production`

```bash
vi apps/web/.env.production
```

```bash
API_URL=http://127.0.0.1:3002
PORT=3003
NEXT_PUBLIC_SITE_URL=https://staging.fupe.app
FIRST_PARTY_LOOKUP_SECRET=STAGING_FIRST_PARTY
NEXT_PUBLIC_SUPPORT_URL=https://buy.stripe.com/test_...
```

- [x] `API_URL` points at **3002** (loopback)
- [x] `FIRST_PARTY_LOOKUP_SECRET` matches staging API
- [x] `PORT=3003`

---

## 5. Migrate + first build

```bash
cd STAGING_ROOT
export DATABASE_URL="postgresql://fupe:STAGING_DB_PASSWORD@127.0.0.1:5434/fupe"
pnpm install
pnpm db:migrate
pnpm --filter @fupe/api build
pnpm --filter @fupe/web build
```

- [x] Migrate applied against **5434** only (double-check `DATABASE_URL` before running)
- [x] API and web builds succeed

Empty staging (migrate / seed only) is enough to bring the stack up. For a realistic graph (thousands of entities), use **§5b**.

---

## 5b. Optional — scrubbed prod dump → staging

Goal: copy the **ownership graph** (and related relational data) from prod into staging **without** real emails, usable password hashes, live API key material, or Stripe customer IDs.

**Rules**

- Restore only into `fupe-postgres-staging` (`:5434`).
- Never `pg_restore` into `fupe-postgres` / `:5433`.
- Re-run the scrub (**D**) every time you refresh from prod — don’t skip it.

### Why scrub?

A raw prod dump includes account emails, `password_hash`, verify/reset tokens, API key rows, Stripe ids, and audit/usage logs. Staging is for experiments; treat it as semi-public.

### A. Dump production (on the VPS)

```bash
STAMP=$(date +%Y%m%d-%H%M)
DUMP="/root/backups/fupe-prod-for-staging-${STAMP}.dump"
mkdir -p /root/backups

docker exec fupe-postgres pg_dump -U fupe -d fupe -Fc -f /tmp/fupe-prod.dump
docker cp fupe-postgres:/tmp/fupe-prod.dump "$DUMP"
docker exec fupe-postgres rm -f /tmp/fupe-prod.dump
ls -lh "$DUMP"
```

- [x] Dump file exists and looks large enough (graph dumps are often tens–hundreds of MB)
- [x] Source container was `**fupe-postgres**`, not staging

### B. Stop staging app processes during restore

```bash
sudo systemctl stop fupe-api-staging fupe-web-staging
```

- [x] Staging Node units stopped
- [x] Prod `fupe-api` / `fupe-web` still running

### C. Restore into staging Postgres

Staging must be **empty of app schemas** before restore. If you already ran §5 `pnpm db:migrate` (or a previous restore), wipe the staging database first — `pg_restore --clean` does **not** reliably drop Apache AGE / `fupe_graph` objects, which produces `schema "fupe_graph" already exists` / `relation … already exists` errors and a half-merged DB.

```bash
# 1) Recreate an empty database inside the staging container
docker exec -i fupe-postgres-staging psql -U fupe -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
 WHERE datname = 'fupe' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS fupe;
CREATE DATABASE fupe OWNER fupe;
SQL

# 2) Copy dump + restore into the fresh DB
docker cp "$DUMP" fupe-postgres-staging:/tmp/fupe.dump

docker exec -i fupe-postgres-staging \
  pg_restore -U fupe -d fupe --no-owner --no-acl /tmp/fupe.dump
# Non-zero exit + extension warnings are common; trust the count query below.

docker exec fupe-postgres-staging rm -f /tmp/fupe.dump

docker exec -i fupe-postgres-staging psql -U fupe -d fupe -c \
  'SELECT count(*) AS users FROM public.users;'
```

If you still see floods of `already exists` **and** `users` is empty/tiny, the wipe didn’t take — confirm `fupe-api-staging` is stopped, re-run the `DROP DATABASE` block, then restore again.

- [x] Staging DB was dropped/recreated (or never migrated)
- [x] Restore targeted `fupe-postgres-staging`
- [x] `users` count looks populated (not empty seed-only)

### D. Scrub PII / secrets on staging only

This step **rewrites every user row** so staging is safe to share/experiment with:


| Field                              | What scrub does                                                        |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `email`                            | Becomes `user-<uuid>@staging.local` (fake; not deliverable mail)       |
| `password_hash`                    | Set to one shared bcrypt hash (see below)                              |
| verify / reset tokens              | Cleared                                                                |
| Stripe customer / subscription ids | Cleared (paid tiers become `admin_override` so keys still look “paid”) |
| `token_version`                    | Bumped so old prod JWTs are useless                                    |
| API keys                           | Marked revoked                                                         |
| usage / webhook / audit tables     | Truncated                                                              |


**Default password after scrub:** the literal string `password`  
(hash `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`).

If prod had an admin, that account is renamed to `**admin@staging.local**` so you have an obvious login. Sign in on staging web with:

- Email: `admin@staging.local`  
- Password: `password`

Then either leave it (staging-only) or set a stronger password using one of the options below.

> **Why not “forgot password” right after scrub?**  
> Resend cannot deliver to `@staging.local`. To use email reset, first point the admin row at a real inbox (option 3).

```bash
docker exec -i fupe-postgres-staging psql -U fupe -d fupe -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

UPDATE public.users SET
  email = 'user-' || id::text || '@staging.local',
  password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  email_verify_token = NULL,
  email_verify_expires_at = NULL,
  password_reset_token = NULL,
  password_reset_expires_at = NULL,
  stripe_customer_id = NULL,
  stripe_subscription_id = NULL,
  subscription_status = CASE
    WHEN subscription_tier IN ('developer', 'business') THEN 'admin_override'
    ELSE subscription_status
  END,
  token_version = COALESCE(token_version, 0) + 1;

UPDATE public.users
   SET email = 'admin@staging.local',
       role = 'admin',
       email_verified_at = COALESCE(email_verified_at, now()),
       trust_score = GREATEST(trust_score, 100)
 WHERE id = (
   SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
 );

UPDATE public.api_keys SET revoked_at = COALESCE(revoked_at, now());

TRUNCATE public.api_usage_log;
TRUNCATE public.api_key_daily_usage;
TRUNCATE public.stripe_webhook_log;
TRUNCATE public.admin_audit_log;

COMMIT;

SELECT email, role, subscription_tier
  FROM public.users
 ORDER BY role DESC, email
 LIMIT 20;
SQL
```

#### Optional — use your own staging password (no global `bcrypt` install)

FUPE’s API package already depends on `bcrypt`. After `pnpm install` in the staging tree, generate a hash from **that** `node_modules` (not a bare `node -e` from `/root`):

```bash
cd STAGING_ROOT/services/api
# confirm the module resolves:
node -e "console.log(require.resolve('bcrypt'))"

# generate (replace the password string):
node -e "require('bcrypt').hash('YOUR_STAGING_PASSWORD', 10).then(console.log)"
```

Copy the printed `$2b$10$…` string, then either:

**A)** Paste it into the scrub `password_hash = '…'` line and re-run the scrub SQL, or  

**B)** One-off update after scrub (keeps emails as-is):

```bash
docker exec -i fupe-postgres-staging psql -U fupe -d fupe -v ON_ERROR_STOP=1 <<'SQL'
UPDATE public.users
   SET password_hash = '$2b$10$PASTE_YOUR_HASH_HERE',
       token_version = COALESCE(token_version, 0) + 1
 WHERE email = 'admin@staging.local';
SQL
```

If `require('bcrypt')` still fails, run install in that package first:

```bash
cd STAGING_ROOT
pnpm install
cd services/api && node -e "require('bcrypt').hash('YOUR_STAGING_PASSWORD', 10).then(console.log)"
```

#### Optional — real email for admin (so Resend / forgot-password works)

```bash
docker exec -i fupe-postgres-staging psql -U fupe -d fupe -c \
  "UPDATE public.users SET email = 'you@example.com' WHERE email = 'admin@staging.local';"
```

Then use staging `/forgot-password` or sign in with `password` and proceed.

- [x] Scrub ran on **staging** (`ON_ERROR_STOP` succeeded)
- [x] No real-world emails left (unless you intentionally set admin to yours):  
  ```
  `SELECT email FROM public.users WHERE email NOT LIKE '%@staging.local';`
  ```
- [ ] You can sign in (`admin@staging.local` / `password`, or your custom hash / real email)

### E. Apache AGE OID repair (required after logical restore)

`pg_restore` remaps schema OIDs; without this, Cypher fails with `graph with oid … does not exist` even when entity tables have rows.

```bash
docker exec -i fupe-postgres-staging psql -U fupe -d fupe -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
ALTER TABLE ag_catalog.ag_label DROP CONSTRAINT IF EXISTS fk_graph_oid;
UPDATE ag_catalog.ag_label l
SET graph = n.oid::integer
FROM ag_catalog.ag_graph g
JOIN pg_catalog.pg_namespace n ON n.nspname = g.name
WHERE l.graph = g.graphid AND g.name = 'fupe_graph' AND g.graphid <> n.oid;
UPDATE ag_catalog.ag_graph g
SET graphid = n.oid::integer, namespace = n.oid
FROM pg_catalog.pg_namespace n
WHERE n.nspname = g.name AND g.name = 'fupe_graph' AND g.graphid <> n.oid;
ALTER TABLE ag_catalog.ag_label
  ADD CONSTRAINT fk_graph_oid
  FOREIGN KEY (graph) REFERENCES ag_catalog.ag_graph(graphid);
COMMIT;
SELECT * FROM cypher('fupe_graph', $$ MATCH (e:Entity) RETURN count(e) $$) AS (c agtype);
SQL
```

- [x] Cypher `count(e)` returns a sensible number (e.g. ~6k if you restored full prod)

### F. Migrate + restart staging apps

**Order:** if `systemctl cat fupe-api-staging` fails, jump to **§6**, enable the units, then come back.

If the staging systemd units already exist (§6), prefer the helper — it installs, migrates (aborting unless `DATABASE_URL` looks like **:5434**), builds API + web, restarts **only** `fupe-api-staging` / `fupe-web-staging`, and curls staging health:

```bash
cd STAGING_ROOT
# Ensure services/api/.env has DATABASE_URL → …@127.0.0.1:5434/fupe
./rebuild-staging.sh
curl -sf http://127.0.0.1:3000/health && echo   # optional: confirm prod untouched
```

If units are **not** installed yet, do §6 first, then run `./rebuild-staging.sh`. (A bare `pnpm db:migrate` alone is only useful when you need schema catch-up without a rebuild.)

- [x] Staging migrate used **5434** (script refused a non-5434 URL)
- [x] Staging health OK; a TEXT lookup returns real entities
- [x] Prod health still OK

### G. Remove the unscoped dump

```bash
shred -u "$DUMP" 2>/dev/null || rm -f "$DUMP"
```

- [x] Local copy of the unscoped prod dump is gone (or only kept in your normal private backup store)

**Refreshing later:** repeat A→G when you want a newer graph. Always scrub.

---

## 6. systemd units

### 6a. API staging

```bash
sudo vi /etc/systemd/system/fupe-api-staging.service
```

```ini
[Unit]
Description=FUPE Nest API (staging)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/fupe-staging/services/api
EnvironmentFile=/root/fupe-staging/services/api/.env
ExecStart=/usr/bin/pnpm start:prod
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust `User=` / paths if your deploy user isn’t `root`.

- [x] Unit file saved

### 6b. Web staging

```bash
sudo vi /etc/systemd/system/fupe-web-staging.service
```

```ini
[Unit]
Description=FUPE Next.js web (staging)
After=network.target fupe-api-staging.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/fupe-staging/apps/web
EnvironmentFile=/root/fupe-staging/apps/web/.env.production
Environment=PORT=3003
# package.json start uses ${PORT:-3001} — PORT must be 3003 here (or EADDRINUSE on prod :3001)
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [x] Unit file saved

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fupe-api-staging fupe-web-staging
sudo systemctl status fupe-api-staging fupe-web-staging
curl -sf http://127.0.0.1:3002/health && echo
curl -sf -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:3003/
```

- [x] Both units active
- [x] Local health curls OK
- [x] Prod units still fine: `systemctl status fupe-api fupe-web`

---

## 7. nginx + TLS

### 7a. Origin certificate

If your Cloudflare Origin CA already includes `**fupe.app**` and `***.fupe.app**`, that covers `staging.fupe.app` and `api-staging.fupe.app` (one label under the apex). **Reuse the same PEM/key as prod** in the staging nginx server blocks — no new cert required.

Only create/recreate an Origin cert if the current one lists specific hostnames and does **not** include those names or a matching wildcard.

- [ ] Staging nginx points at the same Origin cert/key files as prod
- [ ] SSL/TLS mode still **Full (strict)**

### 7b. Server blocks

Prod lives at `/etc/nginx/sites-available/fupe` (enabled via `/etc/nginx/sites-enabled/fupe`). Put staging in a **separate** file so you don’t risk the prod blocks:

```bash
sudo vi /etc/nginx/sites-available/fupe-staging
```

Paste (reuse the same Origin cert paths as in `/etc/nginx/sites-available/fupe`):

```nginx
# HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name staging.fupe.app api-staging.fupe.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name staging.fupe.app;

    ssl_certificate     /etc/ssl/cloudflare/fupe.pem;      # match prod paths
    ssl_certificate_key /etc/ssl/cloudflare/fupe.key;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api-staging.fupe.app;

    ssl_certificate     /etc/ssl/cloudflare/fupe.pem;
    ssl_certificate_key /etc/ssl/cloudflare/fupe.key;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/fupe-staging /etc/nginx/sites-enabled/fupe-staging
sudo nginx -t && sudo systemctl reload nginx
```

- [x] File at `/etc/nginx/sites-available/fupe-staging` (+ enabled symlink)
- [x] `ssl_certificate*` paths match prod
- [x] `nginx -t` OK
- [x] `https://staging.fupe.app` loads
- [x] `https://api-staging.fupe.app/health` OK
- [x] Prod URLs unchanged

---

## 8. Stripe (Test mode on staging)

Staging uses the **same Stripe Test mode account** as prod for keys/prices, but a **separate event destination** (and `whsec_`) so deliveries hit `api-staging`, not prod.

Toggle **Test mode** on in the Dashboard before every step below.

### 8a. Keys & prices (reuse Test catalog)

No new products required if prod Test mode already has a Developer price:

- [x] `STRIPE_SECRET_KEY=sk_test_...` in staging API `.env` (same test secret as prod is OK)
- [x] `STRIPE_PRICE_DEVELOPER=price_...` (same Test price id is OK)
- [x] Footer link optional: `NEXT_PUBLIC_SUPPORT_URL=https://buy.stripe.com/test_...` in staging web `.env.production` (can reuse the Test Payment Link)

To create/find a price: Dashboard → **Product catalog** → product → copy `price_…`.  
Payment Links (footer donations): **Payment links** → **+ New** → pick product or “Customers choose what to pay” → set after-payment URL if offered → copy `https://buy.stripe.com/test_…`.

### 8b. Event destination (Workbench → Webhooks)

Stripe’s old “Add endpoint” flow is now **event destinations**. Prod’s destination (name e.g. `FUPE prod API (test)`, URL `https://api.fupe.app/api/v1/billing/webhook`) stays as-is — you should end with **two** Test-mode destinations.

- [x] Open **[Workbench → Webhooks](https://dashboard.stripe.com/test/workbench/webhooks)** (or Dashboard → **Developers** → **Webhooks**); confirm **Test mode**
- [x] **Add destination** / **Create destination**
- [x] **Events from:** **Your account** (not Connected accounts)
- [x] **API version:** leave the account default unless you know you need otherwise
- [x] **Payload / format:** **Snapshot events** (full classic `Event` with `data.object`) — do **not** choose **Thin events** (Nest uses `constructEvent` + types like `checkout.session.completed`)
- [x] Select events, then **Continue**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [x] **Destination type:** **Webhook** / **Webhook endpoint** (HTTPS) — skip EventBridge, Azure, CLI, other clouds
- [x] **Name:** `FUPE staging API (test)`
- [x] **Description:** `Nest billing on api-staging.fupe.app — Developers Checkout + subscription lifecycle. Separate destination/secret from prod.`
- [x] **Endpoint URL:** `https://api-staging.fupe.app/api/v1/billing/webhook`
- [x] **Create destination** → open it → **Reveal** / copy **Signing secret** (`whsec_…`)
- [x] Set staging `services/api/.env` → `STRIPE_WEBHOOK_SECRET=whsec_...` (must **not** be prod’s `whsec_`)
- [x] `sudo systemctl restart fupe-api-staging`
- [x] After a test Checkout, Workbench shows successful deliveries to the staging destination

---

## 9. Smoke checklist

- [x] `https://staging.fupe.app` — padlock, branding
- [x] Homepage lookup (e.g. Panera)
- [x] Register / login / verify email (Resend)
- [x] Forgot / reset password
- [x] `/developers` — create API key
- [x] Checkout (test card `4242…`) → success UX; event destination updates tier
- [ ] IMAGE lookup via site (first-party secret + optional `OPENAI_API_KEY` for vision)
- [ ] BARCODE: camera / photo / manual digits
- [ ] VOICE: mic listens and shows interim transcript
- [x] Admin login still works if you bootstrap a staging admin
- [x] Confirm you did **not** break `https://fupe.app`

Mobile (optional):

```bash
flutter run --dart-define=API_URL=https://api-staging.fupe.app \
  --dart-define=FIRST_PARTY_LOOKUP_SECRET=STAGING_FIRST_PARTY
```

- [ ] Mobile against staging API works

---

## 10. Day-to-day deploy

On the VPS:

```bash
cd STAGING_ROOT
git pull
./rebuild-staging.sh
```

`[rebuild-staging.sh](../rebuild-staging.sh)` (from staging repo root): install → migrate (staging `DATABASE_URL`) → build → restart `fupe-api-staging` / `fupe-web-staging` → curl `:3002` / `:3003`.

- [x] Script exists and is executable (`chmod +x rebuild-staging.sh`)
- [x] Never run staging migrate with prod `DATABASE_URL`
- [x] Prod deploys stay in `PROD_ROOT` with `./rebuild.sh`

---

## 11. Ops hygiene

- [ ] Staging journald logs: `journalctl -u fupe-api-staging -f`
- [ ] Optional: exclude staging DB from prod backup cron, or add a separate small backup
- [ ] Optional: Cloudflare Access / Basic auth on `staging.fupe.app` if you don’t want it public
- [ ] When idle / low RAM: `sudo systemctl stop fupe-web-staging fupe-api-staging` (Postgres staging can stay up)

---

## Troubleshooting


| Symptom                             | Check                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Staging web calls prod API          | Rebuild web after setting `API_URL=http://127.0.0.1:3002`                                                                |
| Migrate hit prod                    | `echo $DATABASE_URL` — must be `:5434`                                                                                   |
| 502 on staging hosts                | `systemctl status fupe-*-staging`; nginx `proxy_pass` ports                                                              |
| Web staging crash-loop              | `journalctl -u fupe-web-staging -n 50`; **EADDRINUSE :3001** → set `PORT=3003` (start script uses `${PORT:-3001}`)       |
| 526 SSL                             | Origin cert missing staging hostnames; Full (strict)                                                                     |
| IMAGE 401 on staging                | `FIRST_PARTY_LOOKUP_SECRET` mismatch web ↔ API                                                                           |
| IMAGE weak / “could not identify”   | Set `OPENAI_API_KEY` on staging API; confirm web uses `/api/image-lookup` not raw Nest                                  |
| OOM / slow VPS                      | Stop staging units; avoid full prod restore on staging while building                                                    |
| Cypher OID error after restore      | Re-run §5b E (AGE OID repair) on **staging**                                                                             |
| `already exists` during restore     | Staging wasn’t empty — §5b C: `DROP DATABASE fupe` / recreate, then restore again                                        |
| `Conflict … fupe-postgres-staging`  | Container already exists — `docker start fupe-postgres-staging`; do **not** `rm` it                                      |
| Real emails on staging              | Re-run §5b D scrub; confirm container is staging                                                                         |
| Stripe 400 / no tier after Checkout | Workbench → Webhooks → staging destination deliveries; `STRIPE_WEBHOOK_SECRET` must match **staging** `whsec_`, not prod |


---

## Done when

- [ ] Staging and prod both reachable on their hostnames
- [ ] Separate DB, secrets, systemd units, Stripe event destination
- [ ] You can `./rebuild-staging.sh` without touching prod