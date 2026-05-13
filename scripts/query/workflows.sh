#!/usr/bin/env bash
#
# Lists all workflows in your n8n instance with id, name, active state,
# and updated time. Useful for cleanup audits.
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
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

WF=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows")

WF="$WF" python3 <<'PY'
import json, os
data = json.loads(os.environ["WF"])
items = data if isinstance(data, list) else (data.get("data") or [])
items.sort(key=lambda w: (not w.get("active"), w.get("updatedAt") or ""), reverse=True)
fmt = "  {:<10}  {:<22}  {:<19}  {}"
print(fmt.format("active?", "id", "updated", "name"))
print("  " + "-" * 90)
for w in items:
    print(fmt.format(
        "ACTIVE" if w.get("active") else "inactive",
        w.get("id", "")[:22],
        (w.get("updatedAt") or "")[:19].replace("T", " "),
        w.get("name", ""),
    ))
print(f"\nTotal: {len(items)} workflow(s)")
PY

unset N8N_API_KEY
