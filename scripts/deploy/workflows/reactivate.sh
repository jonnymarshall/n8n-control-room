#!/usr/bin/env bash
#
# Deactivates then reactivates the Calendly workflow via n8n's REST API.
# Forces the Calendly Trigger to re-register its webhook subscriptions.
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

WORKFLOW_ID="VPjMyEdiiEobpskU"

ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"
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
            sys.stderr.write(f"WARN: {path}:{lineno} no '=' — skipping\n")
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if (len(val) >= 2) and ((val[0] == val[-1]) and val[0] in ("'", '"')):
            val = val[1:-1]
        print(f"export {key}={shlex.quote(val)}")
PY
)"

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

call_api() {
  local method="$1" path="$2"
  local tmp; tmp=$(mktemp); local code
  code=$(curl -sS -o "$tmp" -w "%{http_code}" \
    -X "$method" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Accept: application/json" \
    "$N8N_URL$path")
  echo "    HTTP $code"
  sed 's/^/        /' "$tmp"
  rm -f "$tmp"
  [ "$code" = "200" ] || return 1
}

echo "==> Deactivating workflow..."
call_api POST "/api/v1/workflows/$WORKFLOW_ID/deactivate" || true

echo
echo "==> Activating workflow..."
call_api POST "/api/v1/workflows/$WORKFLOW_ID/activate"

echo
echo "Re-run ./scripts/list-calendly-webhooks.sh to confirm subscriptions are registered."

unset N8N_API_KEY
