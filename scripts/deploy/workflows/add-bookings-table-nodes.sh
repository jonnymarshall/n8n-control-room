#!/usr/bin/env bash
#
# Inserts two n8n Data Table nodes into the Calendly workflow:
#   - "Upsert Booking Row"    on the Booked branch (before the email)
#   - "Update Booking Cancelled" on the Canceled branch (before the email)
# Both reference the 'bookings' table by name. Run the bookings-setup workflow
# in the n8n UI first to provision the table.
#
# Reads from .env: N8N_URL, N8N_API_KEY
#
# Usage: ./scripts/add-bookings-table-nodes.sh

set -euo pipefail

WORKFLOW_ID="VPjMyEdiiEobpskU"
TABLE_NAME="bookings"

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

echo "==> Discovering '$TABLE_NAME' data-table id + project id..."
TABLES_JSON=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/data-tables")

DISCOVERY=$(TABLES_JSON="$TABLES_JSON" TABLE_NAME="$TABLE_NAME" python3 <<'PY'
import json, os, sys

target = os.environ["TABLE_NAME"]
data = json.loads(os.environ["TABLES_JSON"])
items = data if isinstance(data, list) else (data.get("data") or data.get("items") or data.get("tables") or [])

for t in items:
    if t.get("name") == target:
        print(t["id"])
        print(t.get("projectId") or "")
        sys.exit(0)

sys.stderr.write(f"ERROR: no data table named {target!r}\n")
sys.exit(1)
PY
)
TABLE_ID=$(echo "$DISCOVERY" | sed -n 1p)
PROJECT_ID=$(echo "$DISCOVERY" | sed -n 2p)
echo "    table id:   $TABLE_ID"
echo "    project id: $PROJECT_ID"

echo "==> Fetching current workflow..."
WF=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

echo "==> Building updated workflow with data-table nodes..."
PATCHED=$(WF="$WF" TABLE_NAME="$TABLE_NAME" TABLE_ID="$TABLE_ID" PROJECT_ID="$PROJECT_ID" python3 <<'PY'
import json, os, sys, uuid

wf = json.loads(os.environ["WF"])
table = os.environ["TABLE_NAME"]
table_id = os.environ["TABLE_ID"]
project_id = os.environ["PROJECT_ID"]
table_url = f"/projects/{project_id}/datatables/{table_id}"

# Helper: an n8n expression referencing the Calendly trigger output, so the
# expressions work no matter which preceding node feeds into us.
def cal(path):
    return "={{ $('Calendly Event').item.json." + path + " }}"

# Derive invitee/event UUIDs from the URI tails.
invitee_id_expr = "={{ $('Calendly Event').item.json.payload.uri.split('/').pop() }}"
event_id_expr   = "={{ $('Calendly Event').item.json.payload.scheduled_event.uri.split('/').pop() }}"

# Booking columns. Cancellation fields are omitted entirely — on INSERT they
# default to NULL; on UPDATE (rebook of same invitee_id) the prior cancellation
# data stays put (rare edge case, can be tightened later).
booking_value = {
    "invitee_id":          invitee_id_expr,
    "event_id":            event_id_expr,
    "event_type_name":     cal("payload.scheduled_event.name"),
    "invitee_name":        cal("payload.name"),
    "invitee_email":       cal("payload.email"),
    "invitee_timezone":    cal("payload.timezone"),
    "start_time":          cal("payload.scheduled_event.start_time"),
    "end_time":            cal("payload.scheduled_event.end_time"),
    "location_type":       cal("payload.scheduled_event.location?.type"),
    "location_value":      "={{ $('Calendly Event').item.json.payload.scheduled_event.location?.join_url || $('Calendly Event').item.json.payload.scheduled_event.location?.location || '' }}",
    "host_name":           "={{ $('Calendly Event').item.json.payload.scheduled_event.event_memberships?.[0]?.user_name || '' }}",
    "host_email":          "={{ $('Calendly Event').item.json.payload.scheduled_event.event_memberships?.[0]?.user_email || '' }}",
    "status":              "booked",
    "booked_at":           cal("payload.created_at"),
    "reschedule_url":      cal("payload.reschedule_url"),
    "cancel_url":          cal("payload.cancel_url"),
}

# Cancellation columns (only the cancellation-related fields — preserves
# original booking data via the row's existing values).
cancel_value = {
    "invitee_id":          invitee_id_expr,
    "status":              "cancelled",
    "cancelled_at":        cal("payload.cancellation?.created_at"),
    "canceler_type":       cal("payload.cancellation?.canceler_type"),
    "canceled_by":         cal("payload.cancellation?.canceled_by"),
    "cancellation_reason": cal("payload.cancellation?.reason"),
}

# Resource Mapper uses "dateTime" for date-typed columns (despite the table
# itself storing the type as "date" in the n8n API). String stays "string".
ALL_COLUMNS = [
    ("invitee_id", "string"), ("event_id", "string"),
    ("event_type_name", "string"), ("invitee_name", "string"),
    ("invitee_email", "string"), ("invitee_timezone", "string"),
    ("start_time", "dateTime"), ("end_time", "dateTime"),
    ("location_type", "string"), ("location_value", "string"),
    ("host_name", "string"), ("host_email", "string"),
    ("status", "string"), ("booked_at", "dateTime"),
    ("cancelled_at", "dateTime"), ("canceler_type", "string"),
    ("canceled_by", "string"), ("cancellation_reason", "string"),
    ("reschedule_url", "string"), ("cancel_url", "string"),
]
# Schema entries match the shape n8n's UI produces (no canBeUsedToMatch; has readOnly/removed).
FULL_SCHEMA = [
    {
        "id": name,
        "displayName": name,
        "required": False,
        "defaultMatch": False,
        "display": True,
        "type": t,
        "readOnly": False,
        "removed": False,
    }
    for name, t in ALL_COLUMNS
]

def dt_node(name, operation, value, position):
    # This n8n version uses Filters (Must Match + conditions) for BOTH upsert
    # and update, not the legacy "Columns to Match On" mechanism. So filters
    # is required for both; matchingColumns is left empty (matches UI behaviour).
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "type": "n8n-nodes-base.dataTable",
        "typeVersion": 1.1,
        "position": position,
        "parameters": {
            "operation": operation,
            "dataTableId": {
                "__rl": True,
                "value": table_id,
                "mode": "list",
                "cachedResultName": table,
                "cachedResultUrl": table_url,
            },
            "matchType": "allConditions",
            "filters": {
                "conditions": [{
                    "keyName": "invitee_id",
                    "condition": "eq",
                    "keyValue": invitee_id_expr,
                }],
            },
            "columns": {
                "mappingMode": "defineBelow",
                "value": value,
                "matchingColumns": [],
                "schema": FULL_SCHEMA,
                "attemptToConvertTypes": False,
                "convertFieldsToString": False,
            },
            "options": {},
        },
    }

# Find Switch & email node positions so the new nodes sit between them.
nodes_by_name = {n["name"]: n for n in wf.get("nodes", [])}
for required in ("Route by Event Type", "Send Booking Confirmation", "Send Cancellation Notice"):
    if required not in nodes_by_name:
        sys.stderr.write(f"ERROR: missing node '{required}' in workflow\n")
        sys.exit(1)

# Insert at ~halfway between Switch and the email nodes.
switch_pos  = nodes_by_name["Route by Event Type"].get("position", [544, 304])
confirm_pos = nodes_by_name["Send Booking Confirmation"].get("position", [848, 192])
cancel_pos  = nodes_by_name["Send Cancellation Notice"].get("position", [848, 420])

upsert_pos = [int((switch_pos[0] + confirm_pos[0]) / 2), confirm_pos[1]]
update_pos = [int((switch_pos[0] + cancel_pos[0])  / 2), cancel_pos[1]]

# Shift the email nodes right so all four sit on a horizontal row.
nodes_by_name["Send Booking Confirmation"]["position"] = [confirm_pos[0] + 240, confirm_pos[1]]
nodes_by_name["Send Cancellation Notice"]["position"]  = [cancel_pos[0]  + 240, cancel_pos[1]]

upsert_node = dt_node("Upsert Booking Row",       "upsert", booking_value, upsert_pos)
update_node = dt_node("Update Booking Cancelled", "update", cancel_value, update_pos)

# Replace nodes with these names if they already exist (prior failed runs
# may have left broken versions in place). Also drop the temp diagnostic
# "Upsert row(s)" node the user added when reverse-engineering the schema.
replacements = {n["name"]: n for n in (upsert_node, update_node)}
drop_names = {"Upsert row(s)"}

rebuilt = []
seen_replacements = set()
for n in wf["nodes"]:
    if n.get("name") in drop_names:
        continue
    if n.get("name") in replacements:
        # Preserve the existing node id and position so connections by name
        # keep working and the canvas layout doesn't shift unexpectedly.
        replacement = dict(replacements[n["name"]])
        replacement["id"] = n.get("id", replacement["id"])
        replacement["position"] = n.get("position", replacement["position"])
        rebuilt.append(replacement)
        seen_replacements.add(n["name"])
    else:
        rebuilt.append(n)
for name, node in replacements.items():
    if name not in seen_replacements:
        rebuilt.append(node)
wf["nodes"] = rebuilt

# Rewire connections: Switch → data-table node → email node.
connections = wf.setdefault("connections", {})
connections["Route by Event Type"] = {
    "main": [
        [{"node": "Upsert Booking Row",       "type": "main", "index": 0}],
        [{"node": "Update Booking Cancelled", "type": "main", "index": 0}],
    ]
}
connections["Upsert Booking Row"] = {
    "main": [[{"node": "Send Booking Confirmation", "type": "main", "index": 0}]]
}
connections["Update Booking Cancelled"] = {
    "main": [[{"node": "Send Cancellation Notice", "type": "main", "index": 0}]]
}

# Strip read-only fields & sanitise settings for the PUT.
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

echo "==> Pushing updated workflow..."
TMP_RESP=$(mktemp); trap 'rm -f "$TMP_RESP"' EXIT
HTTP_CODE=$(curl -sS -o "$TMP_RESP" -w "%{http_code}" \
  -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data "$PATCHED" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: PUT returned HTTP $HTTP_CODE" >&2
  echo "Response body:" >&2
  sed 's/^/    /' "$TMP_RESP" >&2
  exit 1
fi

echo
echo "SUCCESS — data-table nodes added."
echo "Open:    $N8N_URL/workflow/$WORKFLOW_ID"
echo "Next:    ./scripts/reactivate-workflow.sh   (re-register the Calendly webhook)"

unset WF PATCHED N8N_API_KEY
