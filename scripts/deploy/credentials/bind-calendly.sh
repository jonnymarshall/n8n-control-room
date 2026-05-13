#!/usr/bin/env bash
#
# Patches the Calendly → Gmail workflow to use API-key auth and binds the
# credential created by create-calendly-credential.sh.
#
# Reads from .env:
#   N8N_URL                  - base URL of your n8n instance
#   N8N_API_KEY              - your n8n REST API key
#   CALENDLY_CREDENTIAL_ID   - the ID printed by create-calendly-credential.sh
#
# Usage: ./scripts/bind-calendly-credential.sh

set -euo pipefail

WORKFLOW_ID="VPjMyEdiiEobpskU"
NODE_NAME="Calendly Event"

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
: "${CALENDLY_CREDENTIAL_ID:?CALENDLY_CREDENTIAL_ID not set in .env (run create-calendly-credential.sh first)}"

# n8n's public API doesn't expose GET /credentials/:id, so we use the name we
# created the credential with in create-calendly-credential.sh. The id is what
# actually resolves the credential at runtime; name is for display only.
CRED_NAME="Calendly PAT (n8n control room)"
echo "==> Using credential: $CRED_NAME ($CALENDLY_CREDENTIAL_ID)"

echo "==> Fetching current workflow..."
WORKFLOW_JSON=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

echo "==> Patching $NODE_NAME node (authentication=apiKey, bind credential)..."
PATCHED=$(WORKFLOW_JSON="$WORKFLOW_JSON" \
  CRED_ID="$CALENDLY_CREDENTIAL_ID" \
  CRED_NAME="$CRED_NAME" \
  NODE_NAME="$NODE_NAME" \
  python3 <<'PY'
import json, os, sys

wf = json.loads(os.environ["WORKFLOW_JSON"])
cred_id = os.environ["CRED_ID"]
cred_name = os.environ["CRED_NAME"]
target = os.environ["NODE_NAME"]

found = False
for n in wf.get("nodes", []):
    if n.get("name") == target:
        n.setdefault("parameters", {})["authentication"] = "apiKey"
        n["credentials"] = {"calendlyApi": {"id": cred_id, "name": cred_name}}
        found = True
        break

if not found:
    sys.stderr.write(f"ERROR: node '{target}' not found in workflow\n")
    sys.exit(1)

# n8n's PUT only accepts these fields; strip the rest.
allowed = {"name", "nodes", "connections", "settings", "staticData"}
out = {k: v for k, v in wf.items() if k in allowed}
# settings is required even if empty
out.setdefault("settings", {})
print(json.dumps(out))
PY
)

echo "==> Pushing updated workflow back to n8n..."
curl -sS -f \
  -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data "$PATCHED" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID" \
  > /dev/null

echo
echo "SUCCESS — Calendly node now uses API-key auth bound to credential $CALENDLY_CREDENTIAL_ID"
echo "Open: $N8N_URL/workflow/$WORKFLOW_ID"

unset PATCHED WORKFLOW_JSON N8N_API_KEY CALENDLY_CREDENTIAL_ID
