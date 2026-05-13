#!/usr/bin/env bash
#
# Dumps the parameters of every node in the Calendly workflow, so we can see
# the exact JSON shape n8n stored when a node was added via the UI.
#
# Useful for reverse-engineering Resource Mapper / Resource Locator structures
# that our scripts can't get past the public-API validator.
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

WORKFLOW_ID="VPjMyEdiiEobpskU"

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
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
            continue
        key, val = line.split("=", 1)
        key = key.strip(); val = val.strip()
        if (len(val) >= 2) and ((val[0] == val[-1]) and val[0] in ("'", '"')):
            val = val[1:-1]
        print(f"export {key}={shlex.quote(val)}")
PY
)"

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

WF=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

WF="$WF" python3 <<'PY'
import json, os
wf = json.loads(os.environ["WF"])
for n in wf.get("nodes", []):
    name = n.get("name")
    typ = n.get("type")
    print("=" * 70)
    print(f"  {name}    ({typ}  v{n.get('typeVersion')})")
    print("=" * 70)
    print(json.dumps(n.get("parameters", {}), indent=2))
    print()
PY

unset N8N_API_KEY
