#!/usr/bin/env bash
#
# Syncs the repo's System Map into the live Airtable "System Map" row that the
# Telegram assistant reads.
#
# Takes everything in workflow_planning/System Map.md from the "# System Map"
# heading to the end of the file (i.e. the agent-facing content, excluding the
# repo-only meta blockquotes at the top) and writes it to the Prompt field of the
# System Map row.
#
# The repo file is the authoring source; the Airtable row is what the assistant
# actually reads. Run this after editing the repo file so the two stay identical.
#
# Reads from .env: AIRTABLE_PAT_TOKEN
#
# Usage: ./scripts/deploy/schema/sync-system-map.sh

set -euo pipefail

BASE_ID="app8Xw9Tq0XLjhmp9"
TABLE_ID="tblhG1nw2P1k3CBVU"
RECORD_ID="rectaPZklELz63WEJ"
FIELD_NAME="Prompt"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
MAP_FILE="$REPO_ROOT/workflow_planning/System Map.md"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }
[ -f "$MAP_FILE" ] || { echo "ERROR: $MAP_FILE not found" >&2; exit 1; }

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
: "${AIRTABLE_PAT_TOKEN:?AIRTABLE_PAT_TOKEN not set in .env}"

export BASE_ID TABLE_ID RECORD_ID FIELD_NAME MAP_FILE AIRTABLE_PAT_TOKEN

python3 <<'PY'
import json, os, urllib.request, urllib.error

path = os.environ["MAP_FILE"]
with open(path) as f:
    lines = f.readlines()

start = next((i for i, l in enumerate(lines) if l.startswith("# System Map")), None)
if start is None:
    print("ERROR: no '# System Map' heading found in the repo file")
    raise SystemExit(1)
content = "".join(lines[start:]).rstrip() + "\n"

url = f"https://api.airtable.com/v0/{os.environ['BASE_ID']}/{os.environ['TABLE_ID']}/{os.environ['RECORD_ID']}"
body = json.dumps({"fields": {os.environ["FIELD_NAME"]: content}}).encode()
req = urllib.request.Request(url, data=body, method="PATCH", headers={
    "Authorization": "Bearer " + os.environ["AIRTABLE_PAT_TOKEN"],
    "Content-Type": "application/json",
    "User-Agent": "n8n-control-room/1.0",
})
try:
    res = urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print(f"ERROR: HTTP {e.code}\n{e.read().decode(errors='replace')}")
    raise SystemExit(1)

saved = json.loads(res.read())["fields"].get(os.environ["FIELD_NAME"], "")
print(f"wrote {len(content)} chars; read back {len(saved)} chars")
print("SUCCESS" if saved[:40] == content[:40] else "WARNING: read-back differs")
PY
