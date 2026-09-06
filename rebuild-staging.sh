#!/usr/bin/env bash
# Staging rebuild on the VPS: install → migrate → build → restart staging systemd.
# Run from the STAGING repo root (e.g. /root/fupe-staging) after git pull.
# Usage:
#   ./rebuild-staging.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "${ROOT}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: $0"
  echo "Expects staging tree + services/api/.env (DATABASE_URL → :5434)."
  echo "Restarts fupe-api-staging and fupe-web-staging only."
  exit 0
fi

load_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return
  fi
  local file
  for file in "${ROOT}/services/api/.env" "${ROOT}/.env"; do
    if [[ -f "$file" ]]; then
      DATABASE_URL="$(grep -E '^DATABASE_URL=' "$file" | head -1 | cut -d= -f2-)"
      if [[ -n "${DATABASE_URL}" ]]; then
        export DATABASE_URL
        echo "Using DATABASE_URL from ${file}"
        return
      fi
    fi
  done
  echo "ERROR: DATABASE_URL is not set and was not found in services/api/.env or .env" >&2
  exit 1
}

echo "==> Staging repo: ${ROOT}"

load_database_url

if [[ "${DATABASE_URL}" != *":5434"* && "${DATABASE_URL}" != *"5434/"* ]]; then
  echo "WARNING: DATABASE_URL does not look like staging port 5434:" >&2
  echo "  ${DATABASE_URL}" >&2
  echo "Aborting to avoid migrating production. Export the correct URL or fix services/api/.env." >&2
  exit 1
fi

echo "==> Ensure staging Postgres is up (if compose file present)"
if [[ -f "${ROOT}/docker-compose.staging.yml" ]]; then
  docker compose -f docker-compose.staging.yml up -d
  docker compose -f docker-compose.staging.yml exec -T postgres-staging pg_isready -U fupe -d fupe >/dev/null
elif [[ -f "${ROOT}/../fupe/docker-compose.staging.yml" ]]; then
  # Sibling layout: staging tree next to prod that owns the compose file
  true
else
  echo "(No docker-compose.staging.yml in this tree — assuming postgres-staging already running)"
fi

echo "==> pnpm install"
pnpm install

echo "==> db:migrate (staging)"
pnpm db:migrate

echo "==> Build API"
pnpm --filter @fupe/api build

echo "==> Build web"
pnpm --filter @fupe/web build

echo "==> Restart staging systemd units"
systemctl restart fupe-api-staging fupe-web-staging
systemctl --no-pager --full status fupe-api-staging fupe-web-staging || true

echo "==> Health checks"
sleep 2
curl -sf "http://127.0.0.1:3002/health" && echo
curl -sf -o /dev/null -w "web HTTP %{http_code}\n" "http://127.0.0.1:3003/"

echo "==> Done (staging). Prod units were not restarted."
