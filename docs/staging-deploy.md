# FUPE staging deploy (same VPS as prod)

Step-by-step checklist to run **staging** beside production on one droplet:

| Host | Role | Upstream |
|------|------|----------|
| `staging.fupe.app` | Next.js | `127.0.0.1:3003` |
| `api-staging.fupe.app` | Nest API | `127.0.0.1:3002` |
| (internal) | Postgres + AGE | `127.0.0.1:5434` |

**Prod stays alone:** `fupe.app` / `api.fupe.app` → `:3001` / `:3000` / Postgres `:5433`.

Assumes prod is already live per [`production-deploy.md`](./production-deploy.md).

Replace placeholders:

| Placeholder | Example |
|-------------|---------|
| `PROD_ROOT` | `/root/fupe` |
| `STAGING_ROOT` | `/root/fupe-staging` |
| `YOUR_VPS_IP` | droplet IPv4 |
| `STAGING_DB_PASSWORD` | `openssl rand -hex 24` |
| `STAGING_JWT_SECRET` | `openssl rand -hex 32` |
| `STAGING_FIRST_PARTY` | `openssl rand -hex 32` |

---

## 0. Before you start

- [ ] Prod is healthy (`https://fupe.app`, `https://api.fupe.app/health`)
- [ ] You can SSH to the VPS as the deploy user (often `root`)
- [ ] Droplet has enough RAM for a second AGE + two Node processes (`free -h` — aim for ≥1 GiB free; stop staging when idle if tight)
- [ ] Stripe **Test** mode still available (staging uses test keys + a separate webhook)

---

## 1. DNS (Cloudflare)

In Cloudflare → **fupe.app** → **DNS**:

- [ ] A record `staging` → `YOUR_VPS_IP` → **Proxied**
- [ ] A record `api-staging` → `YOUR_VPS_IP` → **Proxied**
- [ ] Caching: bypass cache for `api-staging.fupe.app/*` (same idea as `api`)

Check (expect Cloudflare IPs publicly; origin IP only in DNS UI):

```bash
dig +short staging.fupe.app
dig +short api-staging.fupe.app
```

- [ ] Records resolve

---

## 2. Staging Postgres (port 5434)

From **`PROD_ROOT`** (compose file lives with the monorepo; container is independent):

```bash
cd PROD_ROOT
# Use the staging compose file from the repo (after git pull), or create it:
# docker compose -f docker-compose.staging.yml up -d
```

Expected file: [`docker-compose.staging.yml`](../docker-compose.staging.yml) — maps **`127.0.0.1:5434:5432`**, volume `fupe_pgdata_staging`, DB/user `fupe`.

- [ ] Set `POSTGRES_PASSWORD` in that file (or an override) to `STAGING_DB_PASSWORD` — **not** the prod password
- [ ] Start it:

```bash
cd PROD_ROOT
docker compose -f docker-compose.staging.yml up -d
docker compose -f docker-compose.staging.yml exec -T postgres-staging pg_isready -U fupe -d fupe
```

- [ ] `pg_isready` succeeds
- [ ] Confirm prod still on 5433: `ss -lntp | grep -E '5433|5434'`

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

- [ ] `STAGING_ROOT` exists and is a full checkout
- [ ] You will only `git pull` / rebuild staging **inside** `STAGING_ROOT`

---

## 4. Staging env files

### 4a. API — `STAGING_ROOT/services/api/.env`

- [ ] Create from example and edit:

```bash
cd STAGING_ROOT
cp services/api/.env.example services/api/.env
nano services/api/.env
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

# Stripe TEST mode (separate webhook secret — §8)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_DEVELOPER=price_...
# STRIPE_WEBHOOK_SECRET=whsec_...   # fill after §8
```

Checklist:

- [ ] `PORT=3002`
- [ ] `DATABASE_URL` uses **5434** and staging password
- [ ] `JWT_SECRET` ≠ prod
- [ ] `FIRST_PARTY_LOOKUP_SECRET` ≠ prod (or at least intentional)
- [ ] `AUTO_VERIFY_EMAIL=false`
- [ ] No live `sk_live_` keys here

### 4b. Web — `STAGING_ROOT/apps/web/.env.production`

```bash
nano apps/web/.env.production
```

```bash
API_URL=http://127.0.0.1:3002
PORT=3003
NEXT_PUBLIC_SITE_URL=https://staging.fupe.app
FIRST_PARTY_LOOKUP_SECRET=STAGING_FIRST_PARTY
NEXT_PUBLIC_SUPPORT_URL=https://buy.stripe.com/test_...
```

- [ ] `API_URL` points at **3002** (loopback)
- [ ] `FIRST_PARTY_LOOKUP_SECRET` matches staging API
- [ ] `PORT=3003`

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

- [ ] Migrate applied against **5434** only (double-check `DATABASE_URL` before running)
- [ ] API and web builds succeed

Optional later: restore a **scrubbed** prod dump into staging (never point migrate at prod by mistake).

---

## 6. systemd units

### 6a. API staging

```bash
sudo nano /etc/systemd/system/fupe-api-staging.service
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

- [ ] Unit file saved

### 6b. Web staging

```bash
sudo nano /etc/systemd/system/fupe-web-staging.service
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
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] Unit file saved

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fupe-api-staging fupe-web-staging
sudo systemctl status fupe-api-staging fupe-web-staging
curl -sf http://127.0.0.1:3002/health && echo
curl -sf -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:3003/
```

- [ ] Both units active
- [ ] Local health curls OK
- [ ] Prod units still fine: `systemctl status fupe-api fupe-web`

---

## 7. nginx + TLS

### 7a. Origin certificate

Cloudflare → SSL/TLS → **Origin Server** → Create certificate (or recreate) including:

- [ ] `staging.fupe.app`
- [ ] `api-staging.fupe.app`  
  (plus existing `fupe.app`, `www`, `api` if regenerating one cert)

Install cert/key on the VPS (same pattern as prod Origin CA).

- [ ] SSL/TLS mode still **Full (strict)**

### 7b. Server blocks

Add (or extend) nginx config — mirror prod, change names/ports:

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

    ssl_certificate     /etc/ssl/cloudflare/fupe.pem;      # your paths
    ssl_certificate_key /etc/ssl/cloudflare/fupe.key;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] `nginx -t` OK
- [ ] `https://staging.fupe.app` loads
- [ ] `https://api-staging.fupe.app/health` OK
- [ ] Prod URLs unchanged

---

## 8. Stripe test webhook (staging)

Stripe Dashboard → **Test mode** → Developers → Webhooks → Add endpoint:

- [ ] URL: `https://api-staging.fupe.app/api/v1/billing/webhook`
- [ ] Events: at least `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy signing secret → `STRIPE_WEBHOOK_SECRET=whsec_...` in staging API `.env`
- [ ] `sudo systemctl restart fupe-api-staging`

Keep the **prod** webhook on `https://api.fupe.app/...` (can also be test mode until live Stripe).

---

## 9. Smoke checklist

- [ ] `https://staging.fupe.app` — padlock, branding
- [ ] Homepage lookup (e.g. Panera)
- [ ] Register / login / verify email (Resend)
- [ ] Forgot / reset password
- [ ] `/developers` — create API key
- [ ] Checkout (test card `4242…`) → success UX; webhook updates tier
- [ ] IMAGE lookup via site (first-party secret)
- [ ] Admin login still works if you bootstrap a staging admin
- [ ] Confirm you did **not** break `https://fupe.app`

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

[`rebuild-staging.sh`](../rebuild-staging.sh) (from staging repo root): install → migrate (staging `DATABASE_URL`) → build → restart `fupe-api-staging` / `fupe-web-staging` → curl `:3002` / `:3003`.

- [ ] Script exists and is executable (`chmod +x rebuild-staging.sh`)
- [ ] Never run staging migrate with prod `DATABASE_URL`
- [ ] Prod deploys stay in `PROD_ROOT` with `./rebuild.sh`

---

## 11. Ops hygiene

- [ ] Staging journald logs: `journalctl -u fupe-api-staging -f`
- [ ] Optional: exclude staging DB from prod backup cron, or add a separate small backup
- [ ] Optional: Cloudflare Access / Basic auth on `staging.fupe.app` if you don’t want it public
- [ ] When idle / low RAM: `sudo systemctl stop fupe-web-staging fupe-api-staging` (Postgres staging can stay up)

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Staging web calls prod API | Rebuild web after setting `API_URL=http://127.0.0.1:3002` |
| Migrate hit prod | `echo $DATABASE_URL` — must be `:5434` |
| 502 on staging hosts | `systemctl status fupe-*-staging`; nginx `proxy_pass` ports |
| 526 SSL | Origin cert missing staging hostnames; Full (strict) |
| IMAGE 401 on staging | `FIRST_PARTY_LOOKUP_SECRET` mismatch web ↔ API |
| OOM / slow VPS | Stop staging units; avoid full prod restore on staging |

---

## Done when

- [ ] Staging and prod both reachable on their hostnames
- [ ] Separate DB, secrets, systemd units, Stripe webhook
- [ ] You can `./rebuild-staging.sh` without touching prod
