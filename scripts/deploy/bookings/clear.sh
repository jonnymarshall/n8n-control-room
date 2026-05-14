#!/usr/bin/env bash
#
# Wipes every row from the `bookings` data table.
#
# Why this is a multi-step ritual:
#   The n8n public REST API does not expose row-level DELETE on data tables —
#   only GET (list) and POST (insert) are allowed on /api/v1/data-tables/{id}/rows.
#   The only way to delete rows is via the Data Table node's `deleteRows`
#   operation inside a workflow. So this script:
#
#     1. Builds a one-shot workflow:  Webhook -> Data Table deleteRows -> Respond
#     2. POSTs it to n8n and activates it (registers the webhook URL).
#     3. Calls the webhook (with a few retries while n8n wires it up).
#     4. Deletes the one-shot workflow.
#     5. Verifies the table is empty.
#
# Nothing persists on the n8n server after a successful run.
#
# Usage:
#   ./scripts/deploy/bookings/clear.sh        # prompts for confirmation
#   ./scripts/deploy/bookings/clear.sh -y     # skip confirmation
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

TABLE_NAME="bookings"
SKIP_CONFIRM=0
[ "${1:-}" = "-y" ] && SKIP_CONFIRM=1

ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
path = sys.argv[1]
with open(path) as f:
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

echo "==> Looking up bookings table..."
DISCOVERY=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/data-tables" \
  | TABLE_NAME="$TABLE_NAME" python3 -c '
import json, os, sys
target = os.environ["TABLE_NAME"]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else (data.get("data") or [])
for t in items:
    if t.get("name") == target:
        print(t["id"]); print(t.get("projectId", "")); sys.exit(0)
sys.exit(1)
')
TABLE_ID=$(echo "$DISCOVERY" | sed -n 1p)
PROJECT_ID=$(echo "$DISCOVERY" | sed -n 2p)
[ -n "$TABLE_ID" ] || { echo "ERROR: '$TABLE_NAME' table not found" >&2; exit 1; }
echo "    table: $TABLE_NAME ($TABLE_ID)"

echo "==> Counting current rows..."
ROW_COUNT=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows" \
  | python3 -c '
import json, sys
data = json.load(sys.stdin)
rows = data if isinstance(data, list) else (data.get("data") or data.get("items") or [])
print(len(rows))
')
echo "    $ROW_COUNT row(s) currently in $TABLE_NAME"

if [ "$ROW_COUNT" = "0" ]; then
  echo "Nothing to do — table is already empty."
  exit 0
fi

if [ "$SKIP_CONFIRM" != "1" ]; then
  echo
  echo "About to DELETE all $ROW_COUNT row(s) from the '$TABLE_NAME' table."
  read -r -p "Type 'yes' to continue: " ANSWER
  [ "$ANSWER" = "yes" ] || { echo "Aborted."; exit 1; }
fi

PATH_TOKEN=$(python3 -c 'import uuid; print(uuid.uuid4())')
WEBHOOK_ID=$(python3 -c 'import uuid; print(uuid.uuid4())')
WEBHOOK_PATH="admin-clear-bookings/$PATH_TOKEN"
WORKFLOW_NAME="One-shot: Clear Bookings ($(date -u +%Y%m%dT%H%M%SZ))"

echo "==> Building one-shot workflow JSON..."
WORKFLOW_JSON=$(TABLE_ID="$TABLE_ID" PROJECT_ID="$PROJECT_ID" TABLE_NAME="$TABLE_NAME" \
  WORKFLOW_NAME="$WORKFLOW_NAME" WEBHOOK_PATH="$WEBHOOK_PATH" WEBHOOK_ID="$WEBHOOK_ID" \
  python3 <<'PY'
import json, os, uuid

def nid(): return str(uuid.uuid4())

table_rl = {
    "__rl": True,
    "value": os.environ["TABLE_ID"],
    "mode": "list",
    "cachedResultName": os.environ["TABLE_NAME"],
    "cachedResultUrl": f"/projects/{os.environ['PROJECT_ID']}/datatables/{os.environ['TABLE_ID']}",
}

nodes = [
    {
        "id": nid(), "name": "Webhook",
        "type": "n8n-nodes-base.webhook", "typeVersion": 2.1,
        "position": [240, 300], "webhookId": os.environ["WEBHOOK_ID"],
        "parameters": {
            "httpMethod": "POST",
            "path": os.environ["WEBHOOK_PATH"],
            "responseMode": "responseNode",
            "authentication": "none",
            "options": {},
        },
    },
    {
        "id": nid(), "name": "Delete All Rows",
        "type": "n8n-nodes-base.dataTable", "typeVersion": 1.1,
        "position": [460, 300],
        "parameters": {
            "operation": "deleteRows",
            "dataTableId": table_rl,
            "matchType": "anyCondition",
            "filters": {
                "conditions": [
                    {"keyName": "id", "condition": "gte", "keyValue": "1"},
                ],
            },
        },
    },
    {
        "id": nid(), "name": "Respond JSON",
        "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
        "position": [680, 300],
        "parameters": {
            "respondWith": "allIncomingItems",
            "options": {"responseCode": 200, "responseKey": "deleted"},
        },
    },
]

connections = {
    "Webhook":         {"main": [[{"node": "Delete All Rows", "type": "main", "index": 0}]]},
    "Delete All Rows": {"main": [[{"node": "Respond JSON",    "type": "main", "index": 0}]]},
}

print(json.dumps({
    "name": os.environ["WORKFLOW_NAME"],
    "nodes": nodes,
    "connections": connections,
    "settings": {},
}))
PY
)

echo "==> Creating one-shot workflow..."
CREATE_TMP=$(mktemp)
CODE=$(curl -sS -o "$CREATE_TMP" -w "%{http_code}" -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  --data "$WORKFLOW_JSON" "$N8N_URL/api/v1/workflows")
if [ "$CODE" != "200" ] && [ "$CODE" != "201" ]; then
  echo "ERROR: workflow POST returned HTTP $CODE" >&2
  sed 's/^/    /' "$CREATE_TMP" >&2
  rm -f "$CREATE_TMP"
  exit 1
fi
WF_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" < "$CREATE_TMP")
rm -f "$CREATE_TMP"
echo "    workflow ID: $WF_ID"

cleanup() {
  echo "==> Cleaning up workflow $WF_ID..."
  curl -sS -o /dev/null -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$WF_ID/deactivate" || true
  curl -sS -o /dev/null -X DELETE -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$WF_ID" || true
}
trap cleanup EXIT

echo "==> Activating workflow (registers webhook)..."
ACT_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows/$WF_ID/activate")
[ "$ACT_CODE" = "200" ] || { echo "ERROR: activate returned HTTP $ACT_CODE" >&2; exit 1; }

echo "==> Calling webhook (with retries while n8n wires it up)..."
WEBHOOK_URL="$N8N_URL/webhook/$WEBHOOK_PATH"
HOOK_TMP=$(mktemp)
HOOK_CODE=""
for attempt in 1 2 3 4 5; do
  HOOK_CODE=$(curl -sS -o "$HOOK_TMP" -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" -d '{}' "$WEBHOOK_URL" || true)
  if [ "$HOOK_CODE" = "200" ]; then break; fi
  echo "    attempt $attempt: HTTP $HOOK_CODE — retrying in 1s"
  sleep 1
done
if [ "$HOOK_CODE" != "200" ]; then
  echo "ERROR: webhook call failed after retries (last HTTP $HOOK_CODE)" >&2
  sed 's/^/    /' "$HOOK_TMP" >&2
  rm -f "$HOOK_TMP"
  exit 1
fi
echo "    webhook responded HTTP 200"
echo "    response: $(head -c 200 "$HOOK_TMP")"
rm -f "$HOOK_TMP"

echo "==> Verifying table is now empty..."
LEFT=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows" \
  | python3 -c '
import json, sys
data = json.load(sys.stdin)
rows = data if isinstance(data, list) else (data.get("data") or data.get("items") or [])
print(len(rows))
')
echo "    $LEFT row(s) remaining"
if [ "$LEFT" != "0" ]; then
  echo "ERROR: deleteRows ran but $LEFT row(s) still present — inspect manually." >&2
  exit 1
fi

echo
echo "SUCCESS — '$TABLE_NAME' cleared (was $ROW_COUNT row(s), now 0)."
# (no `unset N8N_API_KEY` here — the EXIT trap still needs it for the deactivate/delete calls;
#  the variable dies when the shell process exits anyway.)
