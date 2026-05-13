#!/usr/bin/env bash
#
# Lists tokens in the api_tokens table. Token values are masked
# (first 6 + last 4 chars) so the output is safe in logs.
#
# Usage:
#   ./scripts/query/api-tokens.sh                 # all
#   ./scripts/query/api-tokens.sh active          # only revoked=false
#   ./scripts/query/api-tokens.sh client=guy      # by client_name
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
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

TABLE_ID=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/data-tables" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin); items = d if isinstance(d, list) else (d.get('data') or [])
for t in items:
    if t.get('name') == 'api_tokens':
        print(t['id']); break
")
[ -n "$TABLE_ID" ] || { echo "ERROR: api_tokens table not found" >&2; exit 1; }

ROWS=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows")

ARGS="$*" ROWS="$ROWS" python3 <<'PY'
import json, os, sys

data = json.loads(os.environ["ROWS"])
rows = data if isinstance(data, list) else (data.get("data") or data.get("items") or [])

args = os.environ["ARGS"].split()
only_active = "active" in args
client_filter = None
for a in args:
    if a.startswith("client="):
        client_filter = a.split("=", 1)[1]

def mask(token):
    if not token or len(token) < 12:
        return "***"
    return token[:6] + "…" + token[-4:]

matched = []
for r in rows:
    if only_active and r.get("revoked"):
        continue
    if client_filter and r.get("client_name") != client_filter:
        continue
    matched.append(r)

matched.sort(key=lambda r: (bool(r.get("revoked")), -1 * int(((r.get("created_at") or "").replace("-", "").replace(":", "").replace("T", "").replace("Z", "")[:14]) or 0)))

print(f"Total: {len(rows)}   Matched: {len(matched)}")
print()
if not matched:
    print("(no matches)")
    sys.exit(0)

fmt = "  {:<18}  {:<20}  {:<10}  {}"
print(fmt.format("client_name", "token (masked)", "revoked", "created_at"))
print("  " + "-" * 78)
for r in matched:
    print(fmt.format(
        str(r.get("client_name") or ""),
        mask(r.get("token") or ""),
        "REVOKED" if r.get("revoked") else "active",
        str(r.get("created_at") or "")[:19].replace("T", " "),
    ))
PY

unset N8N_API_KEY
