#!/usr/bin/env sh
# Idempotent bootstrap for a Cloudflare Workers API repo. Safe to re-run.
# The skill fills __DB_NAME__ (must match d1_databases[].database_name in wrangler.jsonc).
set -eu

DB_NAME="__DB_NAME__"
API_DIR="apps/api"

# 1. Deps (frozen = reproducible; fails if lockfile drifted)
pnpm install --frozen-lockfile

# 2. Instance configs: copy from the committed .example ONLY if missing.
#    Re-run = no-op (never clobbers a filled-in wrangler.jsonc / .dev.vars).
[ -f "$API_DIR/wrangler.jsonc" ] || cp "$API_DIR/wrangler.jsonc.example" "$API_DIR/wrangler.jsonc"
[ -f "$API_DIR/.dev.vars" ]      || cp "$API_DIR/.dev.vars.example" "$API_DIR/.dev.vars"

# 3. D1: create only if absent. A new DB prints a database_id — paste it into wrangler.jsonc.
if ! wrangler d1 list | grep -q "$DB_NAME"; then
  wrangler d1 create "$DB_NAME"
  echo "→ New D1 created. Paste its database_id into $API_DIR/wrangler.jsonc"
  echo "  (d1_databases[].database_id), then re-run this script."
  exit 0
fi

# 4. Apply migrations to the LOCAL D1 only (safe; --remote lives in the deploy step).
wrangler d1 migrations apply "$DB_NAME" --local

echo "setup done. Next: confirm database_id + secrets in $API_DIR/wrangler.jsonc, then 'pnpm dev'."
