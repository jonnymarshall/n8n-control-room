#!/usr/bin/env bash
#
# Renames a workflow in n8n.
#
# Usage: ./scripts/deploy/workflows/rename.sh <workflow_id> "<new name>"
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <workflow_id> \"<new name>\"" >&2
  exit 1
fi
WORKFLOW_ID="$1"
NEW_NAME="$2"

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

WF=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

PATCHED=$(WF="$WF" NEW_NAME="$NEW_NAME" python3 <<'PY'
import json, os
wf = json.loads(os.environ["WF"])
wf["name"] = os.environ["NEW_NAME"]
allowed = {"name", "nodes", "connections", "settings", "staticData"}
out = {k: v for k, v in wf.items() if k in allowed}
settings_allowed = {
    "saveExecutionProgress", "saveManualExecutions",
    "saveDataErrorExecution", "saveDataSuccessExecution",
    "executionTimeout", "errorWorkflow", "timezone", "executionOrder",
}
out["settings"] = {k: v for k, v in (out.get("settings") or {}).items() if k in settings_allowed}
print(json.dumps(out))
PY
)

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
  -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data "$PATCHED" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

if [ "$CODE" != "200" ]; then
  echo "ERROR: PUT returned HTTP $CODE" >&2
  sed 's/^/    /' "$TMP" >&2
  exit 1
fi

echo "==> Renamed workflow $WORKFLOW_ID → \"$NEW_NAME\""
echo "    $N8N_URL/workflow/$WORKFLOW_ID"

unset PATCHED WF N8N_API_KEY
