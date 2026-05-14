#!/usr/bin/env bash
#
# Creates a Calendly API-key credential in n8n from CALENDLY_PAT in .env.
#
# Reads from .env: N8N_URL, N8N_API_KEY, CALENDLY_PAT
#
# Usage: ./scripts/deploy/credentials/create-calendly.sh
#
# Prints the new credential ID on success. Save that ID — the next step uses it.

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

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

: "${CALENDLY_PAT:?CALENDLY_PAT not set in .env}"
: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

echo "==> Discovering calendlyApi credential schema..."
SCHEMA=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/credentials/schema/calendlyApi")
echo "$SCHEMA" | sed 's/^/    /'
echo

# n8n calendlyApi expects field "apiKey"
PAYLOAD=$(CALENDLY_PAT="$CALENDLY_PAT" python3 -c '
import json, os
print(json.dumps({
  "name": "Calendly PAT (n8n control room)",
  "type": "calendlyApi",
  "data": {"apiKey": os.environ["CALENDLY_PAT"]}
}))
')

echo "==> Creating credential in n8n..."
RESPONSE=$(curl -sS -f \
  -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data "$PAYLOAD" \
  "$N8N_URL/api/v1/credentials")

CRED_ID=$(echo "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo
echo "SUCCESS"
echo "Credential ID: $CRED_ID"
echo
echo "Add this line to .env so the next step can bind it:"
echo "    CALENDLY_CREDENTIAL_ID=$CRED_ID"

unset PAYLOAD CALENDLY_PAT N8N_API_KEY
