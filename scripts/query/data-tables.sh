#!/usr/bin/env bash
#
# Lists all n8n data tables visible to your API key.
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
path = sys.argv[1]
with open(path) as f:
    for lineno, raw in enumerate(f, 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip(); val = val.strip()
        if (len(val) >= 2) and ((val[0] == val[-1]) and val[0] in ("'", '"')):
            val = val[1:-1]
        print(f"export {key}={shlex.quote(val)}")
PY
)"

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

echo "==> Trying various data-table endpoints..."
for path in \
  "/api/v1/data-tables" \
  "/api/v1/data-stores" \
  "/api/v1/dataStores" \
  "/rest/data-tables" \
  "/rest/data-store/global"
do
  echo
  echo "    GET $path"
  TMP=$(mktemp)
  CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Accept: application/json" \
    "$N8N_URL$path")
  echo "    HTTP $CODE"
  if [ "$CODE" = "200" ]; then
    echo "    body:"
    sed 's/^/        /' "$TMP"
  fi
  rm -f "$TMP"
done

unset N8N_API_KEY
