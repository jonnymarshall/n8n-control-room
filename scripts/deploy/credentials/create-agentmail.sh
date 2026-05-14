#!/usr/bin/env bash
#
# Creates an httpHeaderAuth credential in n8n that authenticates as AgentMail.
# Header: Authorization: Bearer $AGENTMAIL_API_KEY
#
# Reads from .env:
#   N8N_URL               - base URL of your n8n instance
#   N8N_API_KEY           - n8n REST API key (from /settings/api)
#   AGENTMAIL_API_KEY     - AgentMail API token (starts with am_)
#
# Usage: ./scripts/deploy/credentials/create-agentmail.sh

set -euo pipefail

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
: "${AGENTMAIL_API_KEY:?AGENTMAIL_API_KEY not set in .env}"

echo "==> Discovering httpHeaderAuth credential schema..."
curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/credentials/schema/httpHeaderAuth" \
  | sed 's/^/    /'
echo

PAYLOAD=$(AGENTMAIL_API_KEY="$AGENTMAIL_API_KEY" python3 <<'PY'
import json, os
print(json.dumps({
  "name": "AgentMail (n8n control room)",
  "type": "httpHeaderAuth",
  "data": {
    "name": "Authorization",
    "value": "Bearer " + os.environ["AGENTMAIL_API_KEY"]
  }
}))
PY
)

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
echo "    AGENTMAIL_CREDENTIAL_ID='$CRED_ID'"

unset PAYLOAD AGENTMAIL_API_KEY N8N_API_KEY
