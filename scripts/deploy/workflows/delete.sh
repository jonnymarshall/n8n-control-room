#!/usr/bin/env bash
#
# Deletes a workflow from n8n. Prompts for confirmation.
#
# Usage: ./scripts/deploy/workflows/delete.sh <workflow_id> [<workflow_id> ...]
#        ./scripts/deploy/workflows/delete.sh -y <workflow_id> ...   # skip confirm
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

SKIP_CONFIRM=0
if [ "${1:-}" = "-y" ]; then
  SKIP_CONFIRM=1
  shift
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 [-y] <workflow_id> [<workflow_id> ...]" >&2
  exit 1
fi

ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

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

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

for WORKFLOW_ID in "$@"; do
  # Look up the name first so the user sees what they're about to delete.
  NAME=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$WORKFLOW_ID" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name",""))' 2>/dev/null || echo "<unknown>")

  echo "==> $WORKFLOW_ID  \"$NAME\""

  if [ "$SKIP_CONFIRM" = "0" ]; then
    read -p "    delete? [y/N] " ANS
    if [ "$ANS" != "y" ] && [ "$ANS" != "Y" ]; then
      echo "    skipped"
      continue
    fi
  fi

  TMP=$(mktemp)
  CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
    -X DELETE \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")
  if [ "$CODE" = "200" ] || [ "$CODE" = "204" ]; then
    echo "    deleted"
  else
    echo "    FAILED (HTTP $CODE)" >&2
    sed 's/^/        /' "$TMP" >&2
  fi
  rm -f "$TMP"
done

unset N8N_API_KEY
