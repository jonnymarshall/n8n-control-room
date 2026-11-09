#!/usr/bin/env bash
#
# Pulls the live Airtable "System Map" row into workflow_planning/System Map.md,
# preserving the repo-only meta blockquote above the "# System Map" heading.
# This is the inverse of sync-system-map.sh, for the reconcile-first step when the
# live row has drifted ahead of the repo file.
#
# The Airtable row is what the Telegram assistant actually reads, so when the two
# disagree the row wins; pull it, then build changes on top of it.
#
# Reads from .env: AIRTABLE_PAT_TOKEN
#
# Usage: ./scripts/deploy/schema/pull-system-map.sh

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
prefix = "".join(lines[:start])

url = f"https://api.airtable.com/v0/{os.environ['BASE_ID']}/{os.environ['TABLE_ID']}/{os.environ['RECORD_ID']}"
req = urllib.request.Request(url, method="GET", headers={
    "Authorization": "Bearer " + os.environ["AIRTABLE_PAT_TOKEN"],
    "User-Agent": "n8n-control-room/1.0",
})
try:
    res = urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print(f"ERROR: HTTP {e.code}\n{e.read().decode(errors='replace')}")
    raise SystemExit(1)

content = json.loads(res.read())["fields"].get(os.environ["FIELD_NAME"], "")
with open(path, "w") as f:
    f.write(prefix + content.rstrip() + "\n")
print(f"pulled {len(content)} chars from the Airtable row into the repo file")
print(f"repo file now {len(prefix) + len(content) + 1} chars")
PY
