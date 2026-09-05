#!/usr/bin/env bash
# Production rebuild on the VPS: install → migrate → build → restart systemd.
# Run after you've already git pull'd.
# Usage (from repo root, usually as root):
#   ./rebuild.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "${ROOT}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: $0"
  echo "Expects you to have already run git pull. Then: install, migrate, build, restart."
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

echo "==> Repo: ${ROOT}"

echo "==> Ensure Postgres is up"
docker compose up -d postgres
docker compose exec -T postgres pg_isready -U fupe -d fupe >/dev/null

load_database_url

echo "==> pnpm install"
pnpm install

echo "==> db:migrate"
pnpm db:migrate

echo "==> Build API"
pnpm --filter @fupe/api build

echo "==> Build web"
pnpm --filter @fupe/web build

echo "==> Restart systemd units"
systemctl restart fupe-api fupe-web
systemctl --no-pager --full status fupe-api fupe-web || true

echo "==> Health checks"
sleep 2
curl -sf "http://127.0.0.1:3000/health" && echo
curl -sf -o /dev/null -w "web HTTP %{http_code}\n" "http://127.0.0.1:3001/"

echo "==> Done"
