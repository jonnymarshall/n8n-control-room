#!/usr/bin/env bash
#
# Builds and deploys the "Public API" workflow into n8n.
# This is a one-off install — re-running it is safe (will replace the existing
# Public API workflow if it exists, preserving the webhookId so URLs stay stable).
#
# After running this:
#   1. Run ./scripts/deploy/tokens/issue.sh <agent-name> to mint a token.
#   2. Activate the workflow in the n8n UI (toggle Active on).
#   3. Test: curl -H "Authorization: Bearer $TOKEN" -d '{"action":"list_bookings"}' \
#            "$N8N_URL/webhook/api"
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

WORKFLOW_NAME="Public API"
WEBHOOK_PATH="api"

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

echo "==> Discovering table IDs..."
TABLES_JSON=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/data-tables")
DISCOVERY=$(TABLES_JSON="$TABLES_JSON" python3 <<'PY'
import json, os, sys
data = json.loads(os.environ["TABLES_JSON"])
items = data if isinstance(data, list) else (data.get("data") or [])
want = {"api_tokens", "bookings"}
found = {}
for t in items:
    if t.get("name") in want:
        found[t["name"]] = {"id": t["id"], "projectId": t.get("projectId", "")}
for name in ("api_tokens", "bookings"):
    if name not in found:
        sys.stderr.write(f"ERROR: data table '{name}' missing — run its setup workflow first\n")
        sys.exit(1)
    print(found[name]["id"])
    print(found[name]["projectId"])
PY
)
API_TOKENS_ID=$(echo "$DISCOVERY" | sed -n 1p)
API_TOKENS_PROJECT=$(echo "$DISCOVERY" | sed -n 2p)
BOOKINGS_ID=$(echo "$DISCOVERY" | sed -n 3p)
BOOKINGS_PROJECT=$(echo "$DISCOVERY" | sed -n 4p)
echo "    api_tokens: $API_TOKENS_ID (project $API_TOKENS_PROJECT)"
echo "    bookings:   $BOOKINGS_ID (project $BOOKINGS_PROJECT)"

echo "==> Checking for existing Public API workflow..."
EXISTING_ID=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data if isinstance(data, list) else (data.get('data') or [])
for w in items:
    if w.get('name') == '$WORKFLOW_NAME':
        print(w['id']); break
")

EXISTING_WEBHOOK_ID=""
if [ -n "$EXISTING_ID" ]; then
  echo "    found existing workflow $EXISTING_ID — will update in place"
  EXISTING_WEBHOOK_ID=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$EXISTING_ID" \
    | python3 -c "
import json, sys
wf = json.load(sys.stdin)
for n in wf.get('nodes', []):
    if n.get('type') == 'n8n-nodes-base.webhook':
        print(n.get('webhookId', '')); break
")
  [ -n "$EXISTING_WEBHOOK_ID" ] && echo "    preserving webhookId $EXISTING_WEBHOOK_ID (URL stays stable)"
fi

echo "==> Building workflow JSON..."
WORKFLOW_JSON=$(API_TOKENS_ID="$API_TOKENS_ID" API_TOKENS_PROJECT="$API_TOKENS_PROJECT" \
  BOOKINGS_ID="$BOOKINGS_ID" BOOKINGS_PROJECT="$BOOKINGS_PROJECT" \
  WEBHOOK_ID="$EXISTING_WEBHOOK_ID" WORKFLOW_NAME="$WORKFLOW_NAME" \
  WEBHOOK_PATH="$WEBHOOK_PATH" python3 <<'PY'
import json, os, uuid

api_tokens_id   = os.environ["API_TOKENS_ID"]
api_tokens_proj = os.environ["API_TOKENS_PROJECT"]
bookings_id     = os.environ["BOOKINGS_ID"]
bookings_proj   = os.environ["BOOKINGS_PROJECT"]
webhook_id      = os.environ.get("WEBHOOK_ID") or str(uuid.uuid4())
name            = os.environ["WORKFLOW_NAME"]
path            = os.environ["WEBHOOK_PATH"]

def nid(): return str(uuid.uuid4())

def rl(tid, tname, proj):
    return {
        "__rl": True,
        "value": tid,
        "mode": "list",
        "cachedResultName": tname,
        "cachedResultUrl": f"/projects/{proj}/datatables/{tid}",
    }

auth_conditions = [
    {"keyName": "token",   "condition": "eq", "keyValue": "={{ $json.token }}"},
    {"keyName": "revoked", "condition": "eq", "keyValue": "={{ $json.revoked }}"},
]

nodes = [
    {
        "id": nid(), "name": "Webhook",
        "type": "n8n-nodes-base.webhook", "typeVersion": 2.1,
        "position": [240, 300], "webhookId": webhook_id,
        "parameters": {
            "httpMethod": "POST", "path": path,
            "responseMode": "responseNode", "authentication": "none",
            "options": {},
        },
    },
    {
        "id": nid(), "name": "Extract Token",
        "type": "n8n-nodes-base.set", "typeVersion": 3.4,
        "position": [460, 300],
        "parameters": {
            "mode": "manual",
            "assignments": {
                "assignments": [
                    {"id": nid(), "name": "token",
                     "value": "={{ ($json.headers.authorization || '').replace(/^Bearer\\s+/i, '') }}",
                     "type": "string"},
                    {"id": nid(), "name": "revoked", "value": False, "type": "boolean"},
                ],
            },
            "includeOtherFields": True,
            "options": {},
        },
    },
    {
        "id": nid(), "name": "Token Valid",
        "type": "n8n-nodes-base.dataTable", "typeVersion": 1.1,
        "position": [680, 200],
        "parameters": {
            "operation": "rowExists",
            "dataTableId": rl(api_tokens_id, "api_tokens", api_tokens_proj),
            "matchType": "allConditions",
            "filters": {"conditions": auth_conditions},
        },
    },
    {
        "id": nid(), "name": "Token Invalid",
        "type": "n8n-nodes-base.dataTable", "typeVersion": 1.1,
        "position": [680, 460],
        "parameters": {
            "operation": "rowNotExists",
            "dataTableId": rl(api_tokens_id, "api_tokens", api_tokens_proj),
            "matchType": "allConditions",
            "filters": {"conditions": auth_conditions},
        },
    },
    {
        "id": nid(), "name": "Route Action",
        "type": "n8n-nodes-base.switch", "typeVersion": 3.4,
        "position": [900, 200],
        "parameters": {
            "rules": {
                "values": [{
                    "conditions": {
                        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 3},
                        "combinator": "and",
                        "conditions": [{
                            "id": nid(),
                            "leftValue": "={{ $('Webhook').item.json.body.action }}",
                            "rightValue": "list_bookings",
                            "operator": {"type": "string", "operation": "equals"},
                        }],
                    },
                    "renameOutput": True,
                    "outputKey": "list_bookings",
                }],
            },
            "options": {"fallbackOutput": "extra", "renameFallbackOutput": "unknown"},
        },
    },
    {
        "id": nid(), "name": "Get Bookings",
        "type": "n8n-nodes-base.dataTable", "typeVersion": 1.1,
        "position": [1120, 100],
        "parameters": {
            "operation": "get",
            "dataTableId": rl(bookings_id, "bookings", bookings_proj),
            "matchType": "anyCondition",
            "filters": {"conditions": []},
            "returnAll": True,
            "orderBy": True,
            "orderByColumn": "createdAt",
            "orderByDirection": "DESC",
        },
    },
    {
        "id": nid(), "name": "Pick Fields",
        "type": "n8n-nodes-base.code", "typeVersion": 2,
        "position": [1280, 100],
        "parameters": {
            "mode": "runOnceForAllItems",
            "language": "javaScript",
            "jsCode": (
                "const KEEP = [\n"
                "  'event_id', 'event_type_name',\n"
                "  'invitee_name', 'invitee_email', 'invitee_timezone',\n"
                "  'start_time', 'end_time',\n"
                "  'status',\n"
                "  'booked_at', 'cancelled_at',\n"
                "  'canceler_type', 'canceled_by', 'cancellation_reason',\n"
                "  'createdAt', 'updatedAt'\n"
                "];\n"
                "return $input.all().map(item => ({\n"
                "  json: Object.fromEntries(KEEP.map(k => [k, item.json[k] ?? null]))\n"
                "}));\n"
            ),
        },
    },
    {
        "id": nid(), "name": "Respond JSON",
        "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
        "position": [1440, 100],
        "parameters": {
            "respondWith": "allIncomingItems",
            "options": {"responseCode": 200, "responseKey": "rows"},
        },
    },
    {
        "id": nid(), "name": "Respond 400",
        "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
        "position": [1120, 320],
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify({ error: 'unknown action', action: $('Webhook').item.json.body?.action || null }) }}",
            "options": {"responseCode": 400},
        },
    },
    {
        "id": nid(), "name": "Respond 401",
        "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
        "position": [900, 460],
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify({ error: 'unauthorized' }) }}",
            "options": {"responseCode": 401},
        },
    },
]

connections = {
    "Webhook": {"main": [[{"node": "Extract Token", "type": "main", "index": 0}]]},
    "Extract Token": {
        "main": [[
            {"node": "Token Valid", "type": "main", "index": 0},
            {"node": "Token Invalid", "type": "main", "index": 0},
        ]],
    },
    "Token Valid":   {"main": [[{"node": "Route Action", "type": "main", "index": 0}]]},
    "Token Invalid": {"main": [[{"node": "Respond 401",  "type": "main", "index": 0}]]},
    "Route Action": {
        "main": [
            [{"node": "Get Bookings", "type": "main", "index": 0}],
            [{"node": "Respond 400",  "type": "main", "index": 0}],
        ],
    },
    "Get Bookings": {"main": [[{"node": "Pick Fields", "type": "main", "index": 0}]]},
    "Pick Fields":  {"main": [[{"node": "Respond JSON", "type": "main", "index": 0}]]},
}

print(json.dumps({"name": name, "nodes": nodes, "connections": connections, "settings": {}}))
PY
)

if [ -n "$EXISTING_ID" ]; then
  echo "==> PUT updating existing workflow $EXISTING_ID..."
  TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
  CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    --data "$WORKFLOW_JSON" \
    "$N8N_URL/api/v1/workflows/$EXISTING_ID")
  if [ "$CODE" != "200" ]; then
    echo "ERROR: PUT returned HTTP $CODE" >&2
    sed 's/^/    /' "$TMP" >&2
    exit 1
  fi
  WORKFLOW_ID="$EXISTING_ID"
else
  echo "==> POST creating new workflow..."
  TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
  CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    --data "$WORKFLOW_JSON" \
    "$N8N_URL/api/v1/workflows")
  if [ "$CODE" != "200" ] && [ "$CODE" != "201" ]; then
    echo "ERROR: POST returned HTTP $CODE" >&2
    sed 's/^/    /' "$TMP" >&2
    exit 1
  fi
  WORKFLOW_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" < "$TMP")
fi

echo
echo "SUCCESS"
echo "    workflow ID:  $WORKFLOW_ID"
echo "    workflow URL: $N8N_URL/workflow/$WORKFLOW_ID"
echo "    webhook URL:  $N8N_URL/webhook/$WEBHOOK_PATH"
echo
echo "Next steps:"
echo "    1. ./scripts/deploy/tokens/issue.sh <agent-name>"
echo "    2. Activate the workflow in the UI (or via reactivate-workflow.sh after updating it for this ID)"

# Persist the workflow ID + webhook URL for downstream scripts.
echo "$WORKFLOW_ID" > "$(cd "$(dirname "$0")/../../.." && pwd)/.public-api-workflow-id"

unset WORKFLOW_JSON N8N_API_KEY
