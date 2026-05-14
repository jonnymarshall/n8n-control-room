#!/usr/bin/env bash
#
# Lists AgentMail inboxes for your account. Use the printed inbox_id and add it
# to .env as AGENTMAIL_INBOX_ID for downstream scripts.
#
# Reads from .env: AGENTMAIL_API_KEY
#
# Usage: ./scripts/query/agentmail-inboxes.sh

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

# Robust .env loader — parses KEY=VALUE lines without invoking the shell on
# the values. Avoids the "syntax error near unexpected token" trap when a
# value contains <, >, &, ;, spaces, etc.
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
        # strip matching outer quotes if present
        if (len(val) >= 2) and ((val[0] == val[-1]) and val[0] in ("'", '"')):
            val = val[1:-1]
        print(f"export {key}={shlex.quote(val)}")
PY
)"

: "${AGENTMAIL_API_KEY:?AGENTMAIL_API_KEY not set in .env}"

echo "==> Fetching inboxes..."
echo "    auth header: Authorization: Bearer ${AGENTMAIL_API_KEY:0:4}...${AGENTMAIL_API_KEY: -4} (length=${#AGENTMAIL_API_KEY})"
TMP_BODY=$(mktemp)
trap 'rm -f "$TMP_BODY"' EXIT

HTTP_CODE=$(curl -sS \
  -o "$TMP_BODY" \
  -w "%{http_code}" \
  -H "Authorization: Bearer $AGENTMAIL_API_KEY" \
  -H "Accept: application/json" \
  "https://api.agentmail.to/v0/inboxes?limit=50")

echo "    HTTP $HTTP_CODE, $(wc -c <"$TMP_BODY" | tr -d ' ') bytes"
echo "    raw response:"
sed 's/^/        /' "$TMP_BODY"
echo

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: non-200 response — see body above" >&2
  exit 1
fi

echo "Inboxes:"
python3 - "$TMP_BODY" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
items = data.get("inboxes") or data.get("items") or data.get("data") or []
if not items and isinstance(data, list):
    items = data
if not items:
    print("    (none — you'll need to create one at https://agentmail.to)")
    print()
    print("Raw response for debugging:")
    print(json.dumps(data, indent=2))
    sys.exit(0)
for i, ib in enumerate(items, 1):
    print(f"    [{i}] inbox_id: {ib.get('inbox_id')}")
    print(f"        email:    {ib.get('email')}")
    print(f"        created:  {ib.get('created_at')}")
    print()
print("Pick one and add to .env:")
print(f"    AGENTMAIL_INBOX_ID={items[0].get('inbox_id')}")
PY

unset AGENTMAIL_API_KEY
