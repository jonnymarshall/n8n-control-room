#!/usr/bin/env bash
#
# Issues a new bearer token for a client (person or bot) and inserts it into
# the 'api_tokens' data table. Prints the token (only time it's shown — save it!).
#
# Usage: ./scripts/deploy/tokens/issue.sh <client_name>
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <client_name>" >&2
  echo "  e.g. $0 guy            (a person)" >&2
  echo "       $0 clients-ai     (a bot)" >&2
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
WEBHOOK_URL="$N8N_URL/webhook/api"

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

TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

PAYLOAD=$(CLIENT_NAME="$CLIENT_NAME" TOKEN="$TOKEN" NOW="$NOW" python3 <<'PY'
import json, os
print(json.dumps({"data": [{
    "token":       os.environ["TOKEN"],
    "client_name": os.environ["CLIENT_NAME"],
    "created_at":  os.environ["NOW"],
    "revoked":     False,
}]}))
PY
)

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
  -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows")

if [ "$CODE" != "200" ] && [ "$CODE" != "201" ]; then
  echo "ERROR: insert returned HTTP $CODE" >&2
  sed 's/^/    /' "$TMP" >&2
  exit 1
fi

echo
echo "==> ISSUED token for client: $CLIENT_NAME"
echo
echo "    AGENT_TOKEN='$TOKEN'"
echo
echo "(Save this — it's only displayed once. Re-running this script with the same"
echo " client_name issues a NEW token; the old one stays valid until revoked.)"
echo
echo "Quick test:"
echo "    ./scripts/query/public-api-test.sh '$TOKEN'"
echo
echo "Or via curl:"
echo "    curl -sS -X POST '$WEBHOOK_URL' \\"
echo "         -H 'Authorization: Bearer $TOKEN' \\"
echo "         -H 'Content-Type: application/json' \\"
echo "         -d '{\"action\":\"list_bookings\"}'"

unset PAYLOAD TOKEN N8N_API_KEY
