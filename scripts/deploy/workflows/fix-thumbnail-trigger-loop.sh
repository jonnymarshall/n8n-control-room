#!/usr/bin/env bash
#
# Fixes the every-minute re-trigger loop in "BA: Guy's Take Thumbnail Artwork".
#
# Root cause: the "Approved Episode" trigger watches the Approved view, but the
# workflow only moves the episode OUT of that view at its very last node
# ("Mark Awaiting Pick"). Any failure before that — while earlier nodes have
# already bumped the episode's Last Modified Time (creating/deleting linked
# Thumbnails rows) — leaves the episode in the Approved view, so it re-fires
# every minute (and spams the Telegram notifier, which watches the same table).
#
# Fix: insert a "Mark Generating" node right after "Plan Generate" that sets the
# episode Status to "Generating Artwork" (typecast auto-creates the option),
# pulling it out of the Approved view immediately. Now a mid-run failure can't
# re-trigger; the episode just rests on "Generating Artwork" as a debug signal.
# The existing end-of-run "Mark Awaiting Pick" still sets the final status.
#
# Idempotent: re-running after success is a no-op.
#
# Reads from .env: N8N_URL, N8N_API_KEY
#
# Usage: ./scripts/deploy/workflows/fix-thumbnail-trigger-loop.sh

set -euo pipefail

WORKFLOW_ID="YyXiJ0lusoW7ynu9"

ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys, re
path = sys.argv[1]
ident = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
with open(path) as f:
    for lineno, raw in enumerate(f, 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip(); val = val.strip()
        if not ident.match(key):
            continue  # skip keys that are not valid shell identifiers (e.g. "n8n API [self]")
        if (len(val) >= 2) and ((val[0] == val[-1]) and val[0] in ("'", '"')):
            val = val[1:-1]
        print(f"export {key}={shlex.quote(val)}")
PY
)"

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

echo "==> Fetching current workflow..."
WF=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

echo "==> Inserting 'Mark Generating' node..."
PATCHED=$(WF="$WF" python3 <<'PY'
import json, os, sys, uuid

wf = json.loads(os.environ["WF"])
nodes_by_name = {n["name"]: n for n in wf.get("nodes", [])}

for required in ("Plan Generate", "Delete Old Thumbnails", "Mark Awaiting Pick", "Approved Episode"):
    if required not in nodes_by_name:
        sys.stderr.write(f"ERROR: missing node '{required}' — workflow shape changed\n")
        sys.exit(1)

if "Mark Generating" in nodes_by_name:
    sys.stderr.write("Already patched ('Mark Generating' exists) — nothing to do.\n")
    sys.exit(3)

# Clone the existing PATCH-episode node so we inherit its Airtable credential.
template = json.loads(json.dumps(nodes_by_name["Mark Awaiting Pick"]))

# If the template somehow lacks a credential binding, borrow one from any other
# Airtable-token HTTP node that has one (defensive — keeps the new node authed).
def has_cred(n):
    return bool(n.get("credentials"))
if not has_cred(template):
    for n in wf["nodes"]:
        if n.get("parameters", {}).get("nodeCredentialType") == "airtableTokenApi" and has_cred(n):
            template["credentials"] = n["credentials"]
            break

new_node = template
new_node["id"] = str(uuid.uuid4())
new_node["name"] = "Mark Generating"

pg  = nodes_by_name["Plan Generate"].get("position", [224, 128])
dot = nodes_by_name["Delete Old Thumbnails"].get("position", [448, 128])
new_node["position"] = [int((pg[0] + dot[0]) / 2), pg[1]]

params = new_node.setdefault("parameters", {})
params["url"] = ('=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/'
                 '{{ $("Plan Generate").item.json.episodeId }}')
params["jsonBody"] = '={{ { "fields": { "Status": "Generating Artwork" }, "typecast": true } }}'

wf["nodes"].append(new_node)

# Rewire: Plan Generate -> Mark Generating -> Delete Old Thumbnails
conns = wf.setdefault("connections", {})
conns["Plan Generate"]  = {"main": [[{"node": "Mark Generating",       "type": "main", "index": 0}]]}
conns["Mark Generating"] = {"main": [[{"node": "Delete Old Thumbnails", "type": "main", "index": 0}]]}

# Report credential status to stderr for confirmation.
cred = new_node.get("credentials")
sys.stderr.write(f"    new node credential: {'OK (' + list(cred.keys())[0] + ')' if cred else 'MISSING — Mark Generating will fail auth!'}\n")

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
) || { code=$?; [ "$code" = "3" ] && { echo "Nothing to do."; exit 0; }; exit "$code"; }

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
  sed 's/^/    /' "$TMP_RESP" >&2
  exit 1
fi

echo
echo "SUCCESS — 'Mark Generating' inserted; episode now leaves the Approved view immediately."
echo "Open: $N8N_URL/workflow/$WORKFLOW_ID"

unset WF PATCHED N8N_API_KEY
