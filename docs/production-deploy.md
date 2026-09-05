# FUPE production deploy (VPS)

Step-by-step runbook to put **fupe.app** live on one VPS: Docker for Postgres+Apache AGE, Node for the Nest API and Next.js web, nginx on the origin, **Cloudflare** as DNS + reverse proxy in front.

Assumes you already:

- Own **`fupe.app`** with DNS on **Cloudflare** (proxied / orange-cloud is fine)
- Have a VPS with SSH access and **Docker CE** installed
- Have cloned this repo onto the VPS
- Have Stripe **Test mode** Payment Link(s) ready (live payments wait until the site is up)

---

## 0. Target layout

| Piece | Where it runs | Public URL |
|-------|---------------|------------|
| Cloudflare | DNS + CDN / TLS edge | what the world hits |
| Postgres + AGE | Docker (`fupe-postgres`) | **not public** — localhost only |
| Nest API | Node on port **3000** | `https://api.fupe.app` |
| Next.js web | Node on port **3001** | `https://fupe.app` (+ `www`) |
| nginx | ports 80/443 on the VPS | origin behind Cloudflare |

Browser calls stay same-origin (`/api/...` via Next rewrites). Mobile and Stripe webhooks should hit **`api.fupe.app`** directly so request bodies are not altered by Next.

Traffic path: **visitor → Cloudflare → VPS nginx → Node**.

Replace placeholders everywhere:

| Placeholder | Example |
|-------------|---------|
| `YOUR_USER` | `ubuntu` or `deploy` |
| `/home/YOUR_USER/fupe` | path where you cloned the repo |
| `YOUR_VPS_IP` | droplet public IPv4 (Cloudflare **origin** / DNS content) |
| `STRONG_DB_PASSWORD` | long random password |
| `STRONG_JWT_SECRET` | `openssl rand -hex 32` |

---

## 1. DNS (Cloudflare)

In Cloudflare → **fupe.app** → **DNS** → create:

| Type | Name | Content | Proxy status |
|------|------|---------|--------------|
| A | `@` | `YOUR_VPS_IP` | **Proxied** (orange cloud) |
| A | `www` | `YOUR_VPS_IP` | **Proxied** |
| A | `api` | `YOUR_VPS_IP` | **Proxied** |

### Cloudflare dashboard (do this once)

| Setting | Value |
|---------|--------|
| SSL/TLS → Overview | **Full (strict)** — after origin has a valid cert (§11). Until then use **Full** only if you temporarily run a self-signed/origin cert; never leave **Flexible** long-term (Cloudflare HTTPS → origin HTTP breaks cookies/redirects and is insecure). |
| SSL/TLS → Edge Certificates → Always Use HTTPS | **On** |
| Caching → Cache Rules | Bypass cache for `api.fupe.app` and for `fupe.app/api/*` (API must not be cached) |

Optional but useful: **SSL/TLS → Origin Server → Create certificate** (we use this in §11).

### What `dig` should show

With the orange cloud on, public DNS returns **Cloudflare anycast IPs**, not your VPS. That is correct:

```bash
dig +short fupe.app A
# e.g. 172.67.x.x / 104.21.x.x  ← Cloudflare, NOT YOUR_VPS_IP
dig +short www.fupe.app A
dig +short api.fupe.app A
```

To confirm the **origin** record without the proxy:

- Cloudflare DNS UI → click the record → content should be `YOUR_VPS_IP`, or
- Temporarily set the record to **DNS only** (grey cloud), `dig` again (should show `YOUR_VPS_IP`), then turn **Proxied** back on.

Do **not** wait for `dig` to return `YOUR_VPS_IP` while proxied — it never will.

SSH still uses the real IP (or a separate grey-cloud `ssh` hostname if you add one):

```bash
ssh YOUR_USER@YOUR_VPS_IP
```

---

## 2. SSH in and confirm Docker

```bash
ssh YOUR_USER@YOUR_VPS_IP

docker --version
docker compose version
cd /home/YOUR_USER/fupe   # or wherever the clone lives
git status
git pull
```

If `docker` needs sudo every time, either use `sudo` below or add your user to the `docker` group and re-login:

```bash
sudo usermod -aG docker "$USER"
# log out and back in, then: docker ps
```

---

## 3. Firewall (SSH + HTTP/HTTPS for Cloudflare)

Cloudflare connects to your VPS on **80 and/or 443**. Keep those open to the world for now (simplest). Optionally later restrict 80/443 to [Cloudflare IP ranges](https://www.cloudflare.com/ips/) only — do **not** do that until HTTPS on the origin works, or you can lock yourself out of Certbot/debugging.

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Do **not** open 3000, 3001, or 5433 to the world. Prefer SSHing to `YOUR_VPS_IP` directly (not via a proxied hostname).

---

## 4. Install Node 20 + pnpm

```bash
# Node 20 via NodeSource (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should be v20.x

# pnpm (matches packageManager in package.json)
sudo npm install -g pnpm@9.15.0
pnpm -v
```

---

## 5. Harden Postgres before first start

**Important:** set a strong password *before* the first `docker compose up`. Changing it later on an existing volume is painful.

Edit `docker-compose.yml` on the VPS:

1. Change `POSTGRES_PASSWORD` from `fupe_dev` to `STRONG_DB_PASSWORD`.
2. Bind the port to localhost only (so AGE is not reachable from the internet):

```yaml
ports:
  - "127.0.0.1:5433:5432"
```

Full service block should look like:

```yaml
services:
  postgres:
    image: apache/age:latest
    container_name: fupe-postgres
    restart: unless-stopped
    ports:
      - "127.0.0.1:5433:5432"
    environment:
      POSTGRES_USER: fupe
      POSTGRES_PASSWORD: STRONG_DB_PASSWORD
      POSTGRES_DB: fupe
    volumes:
      - fupe_pgdata:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fupe -d fupe"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  fupe_pgdata:
```

Start DB:

```bash
cd /home/YOUR_USER/fupe
docker compose up -d postgres
docker compose ps
docker compose logs -f postgres   # Ctrl+C when healthy
```

---

## 6. Install deps + run migrations

```bash
cd /home/YOUR_USER/fupe
pnpm install

export DATABASE_URL="postgresql://fupe:STRONG_DB_PASSWORD@127.0.0.1:5433/fupe"
pnpm db:migrate
```

That applies all SQL under `packages/db/migrations` (demo/seed data included).

---

## 7. Optional — import your local database instead of (or after) empty migrate

Use this if you want accounts, edits, and ingest progress from your laptop.

### On your Mac (export)

```bash
cd /Users/schneidan/Sites/fupe
docker exec fupe-postgres pg_dump -U fupe -d fupe -Fc -f /tmp/fupe.dump
docker cp fupe-postgres:/tmp/fupe.dump ./fupe-$(date +%Y%m%d).dump
scp ./fupe-YYYYMMDD.dump YOUR_USER@YOUR_VPS_IP:/home/YOUR_USER/
```

### On the VPS (restore)

If you already ran migrations/seeds and want a clean restore:

```bash
# Wipe the container volume (DESTROYS server DB data)
cd /home/YOUR_USER/fupe
docker compose down -v
# Re-apply password + localhost bind in docker-compose.yml if needed
docker compose up -d postgres
# wait until healthy
docker compose exec postgres pg_isready -U fupe -d fupe

docker cp /home/YOUR_USER/fupe-YYYYMMDD.dump fupe-postgres:/tmp/fupe.dump
docker compose exec -T postgres pg_restore -U fupe -d fupe --clean --if-exists /tmp/fupe.dump
```

Notes:

- A normal `pg_dump -Fc` of the `fupe` database does **not** change the server login password. Use the same `POSTGRES_PASSWORD` / `DATABASE_URL` password you set in compose.
- `pg_restore` may print non-fatal warnings (extensions, ownership). That’s OK if queries work afterward.
- **Apache AGE OID repair (required after logical restore):** `pg_restore` assigns new schema OIDs, so Cypher can fail with `graph with oid … does not exist` even when `fupe_graph."Entity"` has rows. Remap the catalog:

```bash
docker compose exec -T postgres psql -U fupe -d fupe -v ON_ERROR_STOP=1 <<'SQL'
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

- After restore + OID repair, run `pnpm db:migrate` so any newer migrations apply (cursors/data are preserved).

---

## 8. Environment files (production)

You need **two** files on the VPS. The root `.env.example` is for local monorepo convenience — **do not rely on it in production**.

| File | Used by | Must exist on VPS? |
|------|---------|-------------------|
| `services/api/.env` | Nest API (`pnpm start:prod`, systemd) | **Yes** |
| `apps/web/.env.production` | Next build + `pnpm start` / systemd | **Yes** |
| Repo root `.env` | Optional — only if you want `pnpm db:migrate` / ingest to pick up `DATABASE_URL` without exporting it | Nice to have |
| `apps/web/.env.local` | Local Next only | **No** (skip on VPS) |

`127.0.0.1` for the **database and internal API** is correct on the VPS (same machine). What must **not** stay as localhost are public URLs: site, CORS, Stripe redirects.

Generate secrets once:

```bash
openssl rand -hex 32   # → paste as JWT_SECRET
# DB password: same value you put in docker-compose.yml POSTGRES_PASSWORD
```

### 8a. API — `services/api/.env`

```bash
cd /home/YOUR_USER/fupe
cp services/api/.env.example services/api/.env
nano services/api/.env
```

Replace the whole file with this template (fill every `CHANGE_ME` / paste your secrets):

```bash
# --- required ---
DATABASE_URL=postgresql://fupe:CHANGE_ME_DB_PASSWORD@127.0.0.1:5433/fupe
PORT=3000
NODE_ENV=production
JWT_SECRET=CHANGE_ME_JWT_SECRET
CORS_ORIGIN=https://fupe.app,https://www.fupe.app
NEXT_PUBLIC_SITE_URL=https://fupe.app

# --- Stripe Test mode (live keys later) ---
STRIPE_SECRET_KEY=sk_test_CHANGE_ME
STRIPE_PRICE_DEVELOPER=price_CHANGE_ME
# STRIPE_PRICE_BUSINESS=price_CHANGE_ME
# Add after §12 webhook is created:
# STRIPE_WEBHOOK_SECRET=whsec_CHANGE_ME

REQUIRE_API_KEY=false
LOOKUP_IP_RATE_LIMIT_PER_MIN=60
AUTH_IP_RATE_LIMIT_PER_MIN=20
MAX_ACTIVE_API_KEYS_PER_USER=5
# Same value in apps/web/.env.production — first-party IMAGE (camera) without a paid API key
FIRST_PARTY_LOOKUP_SECRET=CHANGE_ME_LONG_RANDOM
# Leave unset in prod (defaults off). Set true only if you need them:
# ENABLE_SWAGGER=true
# ENABLE_GRAPHQL=true

# --- email: Resend (verify fupe.app in Resend dashboard first) ---
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_CHANGE_ME
EMAIL_FROM=FUPE <noreply@fupe.app>
# While testing locally without mail: EMAIL_PROVIDER=console
AUTO_VERIFY_EMAIL=false
# One-shot: grants admin only if no admin exists yet — then remove this line
# BOOTSTRAP_ADMIN_EMAIL=CHANGE_ME_YOUR_EMAIL@example.com
# BOOTSTRAP_MODERATOR_EMAIL=CHANGE_ME_YOUR_EMAIL@example.com

# --- optional ---
OPEN_FOOD_FACTS_URL=https://world.openfoodfacts.org/api/v2/product
# OPENAI_API_KEY=
# OPENAI_VISION_MODEL=gpt-4o-mini
# WHISPER_MODEL=whisper-1
```

Checklist for this file:

- [ ] `DATABASE_URL` password matches `docker-compose.yml` `POSTGRES_PASSWORD`
- [ ] Host is `127.0.0.1:5433` (not a public hostname)
- [ ] `NODE_ENV=production` (not `development`)
- [ ] `JWT_SECRET` is a long random string (not `change-me-in-production`)
- [ ] `FIRST_PARTY_LOOKUP_SECRET` set and mirrored on web (IMAGE gate)
- [ ] `EMAIL_PROVIDER` is `resend` or `smtp` (not `console`); `AUTO_VERIFY_EMAIL=false`
- [ ] `BOOTSTRAP_ADMIN_EMAIL` unset after you have an admin
- [ ] `CORS_ORIGIN` and `NEXT_PUBLIC_SITE_URL` use `https://fupe.app` (no `localhost:3001`)
- [ ] Stripe test keys filled if you want `/developers` billing + footer later
- [ ] Unset `BOOTSTRAP_ADMIN_EMAIL` once you already have an admin account

### 8b. Web — `apps/web/.env.production`

Next bakes `NEXT_PUBLIC_*` and `API_URL` (rewrites) in at **build** time. Create this **before** `pnpm --filter @fupe/web build`.

```bash
nano apps/web/.env.production
```

```bash
API_URL=http://127.0.0.1:3000

# Same value as services/api FIRST_PARTY_LOOKUP_SECRET (server-only; not NEXT_PUBLIC_)
FIRST_PARTY_LOOKUP_SECRET=CHANGE_ME_SAME_AS_API

# Public site URL (metadata, absolute links)
NEXT_PUBLIC_SITE_URL=https://fupe.app

# Footer "keep the lights on" — Stripe Payment Link (Test mode OK)
NEXT_PUBLIC_SUPPORT_URL=https://buy.stripe.com/test_CHANGE_ME
```

Checklist:

- [ ] `API_URL` is `http://127.0.0.1:3000` (loopback; nginx/Cloudflare handle public HTTPS)
- [ ] `FIRST_PARTY_LOOKUP_SECRET` matches the API env (IMAGE camera lookup)
- [ ] `NEXT_PUBLIC_SITE_URL` is `https://fupe.app` (not `:3001`)
- [ ] Payment link set (or omit `NEXT_PUBLIC_SUPPORT_URL` to hide the footer line)
- [ ] After any change to this file → **rebuild** web (`pnpm --filter @fupe/web build`) then restart `fupe-web`

### 8c. Optional root `.env` (migrations / ingest on the VPS)

```bash
nano /home/YOUR_USER/fupe/.env
```

```bash
DATABASE_URL=postgresql://fupe:CHANGE_ME_DB_PASSWORD@127.0.0.1:5433/fupe
```

Or export it when you migrate:

```bash
export DATABASE_URL="postgresql://fupe:CHANGE_ME_DB_PASSWORD@127.0.0.1:5433/fupe"
pnpm db:migrate
```

### 8d. Sanity grep (no leftover localhost *public* URLs)

```bash
cd /home/YOUR_USER/fupe
grep -nE 'localhost:3001|NODE_ENV=development|fupe_dev|change-me' \
  services/api/.env apps/web/.env.production .env 2>/dev/null || true
```

Expect:

- **OK:** `127.0.0.1:5433` and `127.0.0.1:3000` (internal)
- **Bad:** `localhost:3001`, `NODE_ENV=development`, `fupe_dev`, `change-me` JWT

None of these files are committed (gitignored). Keep a copy in a password manager.

---

## 9. Build API + web

```bash
cd /home/YOUR_USER/fupe
pnpm --filter @fupe/api build
pnpm --filter @fupe/web build
```

Quick smoke (leave these running in two SSH sessions, or use the systemd units in the next section):

```bash
# Session A
cd /home/YOUR_USER/fupe/services/api
pnpm start:prod

# Session B
cd /home/YOUR_USER/fupe/apps/web
pnpm start
```

From the VPS:

```bash
curl -s http://127.0.0.1:3000/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/
curl -s -X POST http://127.0.0.1:3000/api/v1/lookup \
  -H 'Content-Type: application/json' \
  -d '{"type":"TEXT","query":"Panera"}'
```

Stop those manual processes before enabling systemd (`Ctrl+C`).

---

## 10. systemd — keep API and web running

### API unit

```bash
sudo nano /etc/systemd/system/fupe-api.service
```

```ini
[Unit]
Description=FUPE Nest API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/fupe/services/api
EnvironmentFile=/home/YOUR_USER/fupe/services/api/.env
ExecStart=/usr/bin/pnpm start:prod
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Web unit

```bash
sudo nano /etc/systemd/system/fupe-web.service
```

```ini
[Unit]
Description=FUPE Next.js web
After=network.target fupe-api.service

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/fupe/apps/web
EnvironmentFile=/home/YOUR_USER/fupe/apps/web/.env.production
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

If `which pnpm` is not `/usr/bin/pnpm`, put the real path in `ExecStart`.

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fupe-api fupe-web
sudo systemctl status fupe-api fupe-web
sudo journalctl -u fupe-api -f   # Ctrl+C when healthy
```

Ensure Postgres starts on boot:

```bash
cd /home/YOUR_USER/fupe
docker compose up -d postgres
# docker restart policy is already unless-stopped
```

---

## 11. nginx + TLS (origin behind Cloudflare)

With Cloudflare proxied, visitors terminate TLS at Cloudflare. Your VPS still needs a cert so you can set SSL mode to **Full (strict)**.

**Recommended:** Cloudflare **Origin CA** certificate (trusted only by Cloudflare — perfect for orange-cloud origins).  
**Alternatives:** Let’s Encrypt via DNS-01 (below), or temporarily grey-cloud for HTTP-01 Certbot.

```bash
sudo apt install -y nginx
sudo mkdir -p /etc/ssl/cloudflare
```

### 11a. Create an Origin Certificate (Cloudflare dashboard)

1. **SSL/TLS → Origin Server → Create certificate**
2. Hostnames: `fupe.app`, `*.fupe.app` (covers `www` + `api`)
3. Validity: 15 years is fine
4. Copy the **PEM certificate** and **Private key** onto the VPS:

```bash
sudo nano /etc/ssl/cloudflare/fupe.pem    # paste certificate
sudo nano /etc/ssl/cloudflare/fupe.key    # paste private key
sudo chmod 640 /etc/ssl/cloudflare/fupe.key
sudo chown root:www-data /etc/ssl/cloudflare/fupe.key
```

Then set Cloudflare **SSL/TLS → Overview** to **Full (strict)**.

### 11b. Site config

```bash
sudo nano /etc/nginx/sites-available/fupe
```

```nginx
# Real client IP from Cloudflare (optional but useful for logs)
# Full IP list: https://www.cloudflare.com/ips/
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;

# Redirect www → apex
server {
    listen 80;
    listen [::]:80;
    server_name www.fupe.app;
    return 301 https://fupe.app$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.fupe.app;

    ssl_certificate     /etc/ssl/cloudflare/fupe.pem;
    ssl_certificate_key /etc/ssl/cloudflare/fupe.key;

    return 301 https://fupe.app$request_uri;
}

# Web
server {
    listen 80;
    listen [::]:80;
    server_name fupe.app;
    return 301 https://fupe.app$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name fupe.app;

    ssl_certificate     /etc/ssl/cloudflare/fupe.pem;
    ssl_certificate_key /etc/ssl/cloudflare/fupe.key;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Cloudflare already terminated HTTPS — tell Next the original scheme
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }
}

# API (mobile + Stripe webhooks)
server {
    listen 80;
    listen [::]:80;
    server_name api.fupe.app;
    return 301 https://api.fupe.app$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.fupe.app;

    ssl_certificate     /etc/ssl/cloudflare/fupe.pem;
    ssl_certificate_key /etc/ssl/cloudflare/fupe.key;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }
}
```

> If `$http_x_forwarded_proto` is empty in logs, fall back to `proxy_set_header X-Forwarded-Proto https;` while Cloudflare SSL is Full/strict.

Enable and test:

```bash
sudo ln -sf /etc/nginx/sites-available/fupe /etc/nginx/sites-enabled/fupe
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Confirm from your laptop (should hit Cloudflare, then origin):

```bash
curl -sI https://fupe.app | head -20
curl -s https://api.fupe.app/health
```

### 11c. Alternative — Let’s Encrypt while still proxied

HTTP-01 Certbot often fails or is awkward behind the orange cloud. Prefer either:

**A. DNS-01 (stays proxied)**

```bash
sudo apt install -y certbot python3-certbot-dns-cloudflare
# Create a Cloudflare API token with Zone.DNS Edit for fupe.app
sudo nano /root/.secrets/cloudflare.ini
# dns_cloudflare_api_token = YOUR_TOKEN
sudo chmod 600 /root/.secrets/cloudflare.ini

sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d fupe.app -d www.fupe.app -d api.fupe.app
```

Point nginx `ssl_certificate` / `ssl_certificate_key` at `/etc/letsencrypt/live/fupe.app/fullchain.pem` and `privkey.pem`, then `sudo nginx -t && sudo systemctl reload nginx`.

**B. Temporary grey-cloud HTTP-01**

1. Cloudflare DNS → set `@`, `www`, `api` to **DNS only**
2. `sudo apt install -y certbot python3-certbot-nginx`
3. `sudo certbot --nginx -d fupe.app -d www.fupe.app -d api.fupe.app`
4. Turn **Proxied** back on
5. Set SSL mode to **Full (strict)**

---

## 12. Stripe (Test mode on the live domain)

You can process **test** payments on the real hostname while Stripe account activation is pending. Cloudflare in front is fine for Checkout and webhooks.

1. In Stripe Dashboard → **Test mode** → **Payment Links**  
   - After donation success URL: `https://fupe.app/thanks` (optional `?next=/browse` etc.)  
   - Cancel URL: `https://fupe.app`  
   - Developer Checkout success/cancel can stay `/developers?checkout=success` / `cancel`
2. Set `NEXT_PUBLIC_SUPPORT_URL` to the test Payment Link (rebuild web if you change it — see §14).
3. **Developers subscriptions:**  
   - `STRIPE_SECRET_KEY=sk_test_...`  
   - `STRIPE_PRICE_DEVELOPER=price_...`
4. **Webhook (Test mode):**  
   - Endpoint URL: `https://api.fupe.app/api/v1/billing/webhook`  
   - Events: at least  
     `checkout.session.completed`,  
     `customer.subscription.updated`,  
     `customer.subscription.deleted`,  
     `invoice.paid`,  
     `invoice.payment_failed`  
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET=whsec_...` in `services/api/.env`  
   - `sudo systemctl restart fupe-api`

If webhook delivery fails with timeouts, check Cloudflare **Security** isn’t challenging Stripe (usually fine). Keep cache bypassed on `api.fupe.app`.

### Lookup rate limits (API + Cloudflare)

The Nest API applies an in-process IP throttle on `/lookup` (default **60 req/min/IP**, override with `LOOKUP_IP_RATE_LIMIT_PER_MIN`). IMAGE lookups require either a Developer/Business API key **or** header `X-Fupe-First-Party` matching `FIRST_PARTY_LOOKUP_SECRET` (web injects this via `/api/image-lookup`; mobile via `--dart-define`).

Optional Cloudflare hardening (dashboard → Security → WAF / Rate limiting):

- Rate limit rule on `api.fupe.app/api/v1/lookup*` (e.g. 60–120 / min per IP)
- Keep `api.fupe.app` **cache bypass** (API responses must not be cached)

When Stripe unlocks live mode later: create **live** Payment Link + prices + webhook, swap `sk_test_` → `sk_live_`, update `NEXT_PUBLIC_SUPPORT_URL`, rebuild web, restart services.

---

## 13. Smoke checklist (browser)

- [ ] `https://fupe.app` loads (padlock OK; Cloudflare SSL = Full strict)
- [ ] Favicon looks correct (hard-refresh; if stuck, Cloudflare → Caching → **Purge Everything**)
- [ ] Homepage search: **Panera** → YES / PE chain
- [ ] `/browse` lists entities
- [ ] Footer shows “If you found this useful…” and Payment Link opens Stripe Checkout (test card `4242…`)
- [ ] Register / login works (`AUTO_VERIFY_EMAIL=true` for now)
- [ ] `/developers` → create API key
- [ ] `https://api.fupe.app/api/docs` opens Swagger
- [ ] `https://api.fupe.app/health` returns OK
- [ ] Legal pages under `/legal/*` load (needed for store forms)
- [ ] Response headers show `cf-ray` (confirms traffic is going through Cloudflare)

---

## 14. Redeploy after code changes

From the repo on the VPS (pull yourself, then rebuild):

```bash
cd /root/fupe   # or your clone path
git pull
./rebuild.sh
```

`rebuild.sh` runs: ensure Postgres → `pnpm install` → migrate → build API + web → `systemctl restart fupe-api fupe-web` → health curls. It reads `DATABASE_URL` from `services/api/.env` (or root `.env`) if not already exported.

Manual equivalent:

```bash
cd /home/YOUR_USER/fupe
git pull
pnpm install
export DATABASE_URL="postgresql://fupe:STRONG_DB_PASSWORD@127.0.0.1:5433/fupe"
pnpm db:migrate
pnpm --filter @fupe/api build
pnpm --filter @fupe/web build
sudo systemctl restart fupe-api fupe-web
sudo systemctl status fupe-api fupe-web
```

If you change `NEXT_PUBLIC_*` or `API_URL`, you **must** rebuild the web app (included in `./rebuild.sh`).

---

## 15. Daily database backups

```bash
mkdir -p /home/YOUR_USER/backups
nano /home/YOUR_USER/bin/fupe-backup.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M)
OUT="/home/YOUR_USER/backups/fupe-${STAMP}.dump"
docker exec fupe-postgres pg_dump -U fupe -d fupe -Fc -f /tmp/fupe.dump
docker cp fupe-postgres:/tmp/fupe.dump "$OUT"
# keep 14 days
find /home/YOUR_USER/backups -name 'fupe-*.dump' -mtime +14 -delete
```

```bash
chmod +x /home/YOUR_USER/bin/fupe-backup.sh
crontab -e
```

Add:

```cron
15 3 * * * /home/YOUR_USER/bin/fupe-backup.sh >> /home/YOUR_USER/backups/backup.log 2>&1
```

Copy dumps off-box occasionally (`scp` or object storage). Provider disk snapshots are a bonus, not a substitute.

---

## 16. Optional next (not required for first public page)

| Item | Notes |
|------|--------|
| Real email (Resend) | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM=FUPE <noreply@fupe.app>`; verify domain in Resend; set `AUTO_VERIFY_EMAIL=false` |
| Ingest cron on VPS | Same pattern as local: PATH must include node/pnpm; see `packages/ingest/README.md` |
| `REQUIRE_API_KEY=true` | Only after first-party clients send keys |
| Tighten UFW to Cloudflare IPs only | After origin TLS works — see [Cloudflare IPs](https://www.cloudflare.com/ips/) |
| Separate CDN / Vercel for web | Possible later; API+AGE stay on this VPS (you already have CF in front) |
| Live Stripe | After domain proves out and Stripe activates the account |

---

## 17. Common failures

| Symptom | Fix |
|---------|-----|
| `dig` shows 104.x / 172.x not VPS IP | Expected with orange cloud — check origin IP in Cloudflare DNS UI |
| 525 / 526 SSL errors | Cloudflare SSL mode vs origin cert mismatch — use Origin CA + **Full (strict)** |
| 521 Web server is down | nginx/Node down on VPS, or firewall blocking Cloudflare |
| 522 Connection timed out | VPS firewall / wrong origin IP in DNS content |
| Certbot HTTP-01 fails while proxied | Use Origin CA (§11a) or DNS-01 / temporary grey-cloud (§11c) |
| Stale HTML/favicon after deploy | Cloudflare → Caching → Purge; also hard-refresh browser |
| API responses look cached/wrong | Add Cache Rule: bypass `api.fupe.app` and `/api/*` |
| `password authentication failed` | `DATABASE_URL` password ≠ compose `POSTGRES_PASSWORD` |
| Web loads but lookups fail | `fupe-api` down; or `API_URL` wrong at **build** time — rebuild web |
| CORS errors from browser to `api.` | Add site origins to `CORS_ORIGIN` |
| Stripe webhook 400 | Wrong `STRIPE_WEBHOOK_SECRET`; or webhook pointed at web host instead of `api.fupe.app` |
| `env: node: No such file` in cron | Cron PATH missing Node — use full paths or `PATH=/usr/bin:...` |
| Out of memory on build | Use a 4+ GB RAM VPS, or add swap temporarily |

Add swap (if needed for builds):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Quick command index

```bash
# DB
docker compose up -d postgres
pnpm db:migrate

# Build
pnpm --filter @fupe/api build
pnpm --filter @fupe/web build

# Process control
sudo systemctl restart fupe-api fupe-web
sudo journalctl -u fupe-api -n 100 --no-pager
sudo journalctl -u fupe-web -n 100 --no-pager

# nginx / TLS
sudo nginx -t && sudo systemctl reload nginx
# If using Let's Encrypt instead of Origin CA:
# sudo certbot renew
```

When this checklist is green, paste your test Payment Link into `NEXT_PUBLIC_SUPPORT_URL` (if not already), confirm the footer, then move on to store listing URLs (`https://fupe.app/legal/privacy`, etc.).
