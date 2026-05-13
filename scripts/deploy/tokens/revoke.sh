#!/usr/bin/env bash
#
# Revokes all tokens belonging to a client (sets revoked=true on every row
# with the given client_name). The Public API workflow rejects revoked tokens
# at auth time. Rows are not deleted, so the audit trail is preserved.
#
# Usage: ./scripts/deploy/tokens/revoke.sh <client_name>
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <client_name>" >&2
  exit 1
fi
CLIENT_NAME="$1"

ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
path = sys.argv[1]
with open(path) as f:
    for lineno, raw in enumerate(f, 1):
        line = raw.strip()
        if not line or line.startswith("#"): continue
        if "=" not in line: continue
        key, val = line.split("=", 1)
        key = key.strip(); val = val.strip()
        if (len(val) >= 2) and ((val[0] == val[-1]) and val[0] in ("'", '"')):
            val = val[1:-1]
        print(f"export {key}={shlex.quote(val)}")
PY
)"

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

TABLE_ID=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/data-tables" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin); items = d if isinstance(d, list) else (d.get('data') or [])
for t in items:
    if t.get('name') == 'api_tokens':
        print(t['id']); break
")
[ -n "$TABLE_ID" ] || { echo "ERROR: api_tokens table not found" >&2; exit 1; }

PAYLOAD=$(CLIENT_NAME="$CLIENT_NAME" python3 <<'PY'
import json, os
print(json.dumps({
    "filter": {
        "filters": [{"columnName": "client_name", "condition": "eq", "value": os.environ["CLIENT_NAME"]}]
    },
    "data": {"revoked": True},
}))
PY
)

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
  -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows")

if [ "$CODE" != "200" ] && [ "$CODE" != "201" ] && [ "$CODE" != "204" ]; then
  echo "ERROR: update returned HTTP $CODE" >&2
  sed 's/^/    /' "$TMP" >&2
  echo "  Note: if 405/404, n8n's PATCH/rows endpoint may differ; fall back to revoking via UI." >&2
  exit 1
fi

echo "==> Revoked all tokens for client: $CLIENT_NAME"
echo "    (Rows stay in api_tokens with revoked=true for audit.)"

unset PAYLOAD N8N_API_KEY
