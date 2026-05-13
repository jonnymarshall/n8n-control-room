#!/usr/bin/env bash
#
# Quick smoke test for the Public API webhook. POSTs {"action":"list_bookings"}
# and prints the raw HTTP status + response body, no formatting.
#
# Useful for verifying the API works end-to-end after deploys, or for
# isolating whether a client-side issue is in the wrapper or the API itself.
#
# Token source (in order of precedence):
#   1. First CLI argument:    ./scripts/query/public-api-test.sh <token>
#   2. AGENT_TOKEN env var:    AGENT_TOKEN=xxx ./scripts/query/public-api-test.sh
#   3. AGENT_TOKEN in .env:    add  AGENT_TOKEN='xxx'  to .env
#
# Other env vars (optional):
#   N8N_API_URL  - full webhook URL; defaults to "$N8N_URL/webhook/api"
#   ACTION       - defaults to "list_bookings"
#
# Reads from .env: N8N_URL, AGENT_TOKEN

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
  eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
with open(sys.argv[1]) as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1); k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'): v = v[1:-1]
        print(f"export {k}={shlex.quote(v)}")
PY
)"
fi

# CLI arg wins over env / .env.
if [ $# -ge 1 ]; then
  AGENT_TOKEN="$1"
fi

if [ -z "${AGENT_TOKEN:-}" ] || [ "$AGENT_TOKEN" = "<PASTE_YOUR_TOKEN_HERE>" ]; then
  cat >&2 <<EOF
ERROR: no token provided.

Set one of:
  - Pass as argument:  ./scripts/query/public-api-test.sh <token>
  - Export in shell:   export AGENT_TOKEN='your-token'
  - Add to .env:       AGENT_TOKEN='your-token'

To mint a new token:
  ./scripts/deploy/tokens/issue.sh <agent_name>

To see existing tokens (masked):
  ./scripts/query/api-tokens.sh
EOF
  exit 1
fi

if [ -z "${N8N_API_URL:-}" ]; then
  : "${N8N_URL:?N8N_URL not set in .env (or pass N8N_API_URL directly)}"
  URL="$N8N_URL/webhook/api"
else
  URL="$N8N_API_URL"
fi
ACTION="${ACTION:-list_bookings}"

echo "==> POST $URL"
echo "    Authorization: Bearer ${AGENT_TOKEN:0:6}…${AGENT_TOKEN: -4}  (length=${#AGENT_TOKEN})"
echo "    body: {\"action\":\"$ACTION\"}"
echo

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"action\":\"$ACTION\"}" \
  "$URL")

echo "==> HTTP $CODE"
echo
# Pretty-print JSON if possible, otherwise raw.
if python3 -c "import json,sys; json.load(open('$TMP'))" 2>/dev/null; then
  python3 -m json.tool < "$TMP"
else
  cat "$TMP"
  echo
fi

unset AGENT_TOKEN
