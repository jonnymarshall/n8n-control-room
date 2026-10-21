#!/usr/bin/env bash
#
# Audits that every live n8n workflow has a local .sdk.js copy.
#
# Rule (AGENTS.md): a workflow is not finished until its .sdk.js snapshot exists
# in scripts/deploy/workflows/. The live server stays the source of truth, but the
# snapshot is what gets reviewed, diffed and committed, so a missing one means the
# workflow can be changed with nothing in git recording what it does.
#
# A snapshot is matched to a workflow by the id inside it (workflow('<id>', ...)),
# not by filename, so renames don't create false alarms.
#
# Exit codes: 0 = every non-archived workflow has a snapshot,
#             1 = at least one is missing (or a snapshot points at a dead id).
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
SDK_DIR="$REPO_ROOT/scripts/deploy/workflows"
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

WORKFLOWS="$(python3 - "$N8N_URL" "$N8N_API_KEY" <<'PY'
import json, sys, urllib.request

url, key = sys.argv[1], sys.argv[2]
out, cursor = [], None
while True:
    q = "?limit=250" + (f"&cursor={cursor}" if cursor else "")
    req = urllib.request.Request(url.rstrip("/") + "/api/v1/workflows" + q,
                                 headers={"X-N8N-API-KEY": key})
    with urllib.request.urlopen(req) as r:
        page = json.load(r)
    out.extend(page.get("data", []))
    cursor = page.get("nextCursor")
    if not cursor:
        break
print(json.dumps(out))
PY
)"

WORKFLOWS="$WORKFLOWS" SDK_DIR="$SDK_DIR" python3 <<'PY'
import glob, json, os, re, sys

workflows = json.loads(os.environ["WORKFLOWS"])
sdk_dir = os.environ["SDK_DIR"]

# Snapshot identity: `workflow('<id or slug>', '<display name>', ...)`. Older files
# use a slug instead of the workflow id, so match on either the id or the exact name.
SNAPSHOT_RE = re.compile(r"""workflow\(\s*(['"])(?P<key>.+?)\1\s*,\s*(['"])(?P<name>.+?)\3""")

snapshots = {}   # key (id or slug) -> filename
snapshot_names = {}  # display name -> filename
for path in sorted(glob.glob(os.path.join(sdk_dir, "*.sdk.js"))):
    with open(path) as f:
        m = SNAPSHOT_RE.search(f.read())
    if not m:
        continue
    filename = os.path.basename(path)
    snapshots[m.group("key")] = filename
    snapshot_names[m.group("name")] = filename

live_ids = {w["id"]: w for w in workflows}
live_names = {w["name"]: w for w in workflows}
missing, stale = [], []

for wf in sorted(workflows, key=lambda w: w["name"].lower()):
    if wf.get("isArchived"):
        continue
    if wf["id"] in snapshots or wf["name"] in snapshot_names:
        continue
    missing.append(wf)

for key, filename in snapshots.items():
    if key in live_ids:
        continue
    name = next((n for n, f in snapshot_names.items() if f == filename), None)
    if name in live_names:
        continue
    stale.append((key, filename))

if missing:
    print("MISSING a .sdk.js snapshot:")
    for wf in missing:
        state = "active" if wf.get("active") else "inactive"
        print(f"  {wf['id']}  [{state}]  {wf['name']}")
    print("\nFix: scripts/deploy/workflows/snapshot-sdk.sh <workflow_id>")
else:
    active_count = len([w for w in workflows if not w.get("isArchived")])
    print(f"OK - every non-archived workflow has a snapshot ({active_count} checked).")

if stale:
    print("\nSnapshot points at a workflow that no longer exists:")
    for key, filename in stale:
        print(f"  {key}  {filename}")

sys.exit(1 if (missing or stale) else 0)
PY
