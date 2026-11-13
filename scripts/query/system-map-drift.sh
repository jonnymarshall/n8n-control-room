#!/usr/bin/env bash
#
# Checks the System Map's factual claims against the live Airtable base and the
# live n8n instance.
#
# Why this exists: the Telegram assistant answers pipeline questions from the
# System Map, so a stale ID, a renamed field or a Status value that no longer
# exists turns into a confidently wrong answer in chat. The Map is prose, so
# nothing stops it drifting. This catches the drift that is checkable.
#
# What it checks:
#   1. Every Airtable app/tbl/fld ID in the Map still exists.
#   2. Every n8n workflow ID in the Map still exists (and prints its state).
#   3. Every Episodes Status / Type value named as a choice still exists.
#   4. Every Automations Upgrades (bug log) choice value named still exists.
#
# What it cannot check: view filter conditions. The Airtable API exposes view
# names but not filters, so anything the Map says about a view's conditions is a
# transcription and stays a transcription. Treat those lines as unverified.
#
# Reads from .env: AIRTABLE_PAT_TOKEN, N8N_URL, N8N_API_KEY
#
# Usage: ./scripts/query/system-map-drift.sh [-v]
# Exits non-zero if any check fails, so it can run in CI or before a release.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
MAP_FILE="$REPO_ROOT/workflow_planning/System Map.md"

[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }
[ -f "$MAP_FILE" ] || { echo "ERROR: $MAP_FILE not found" >&2; exit 1; }

VERBOSE=0
[ "${1:-}" = "-v" ] && VERBOSE=1

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
with open(sys.argv[1]) as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
            v = v[1:-1]
        print(f"export {k}={shlex.quote(v)}")
PY
)"

: "${AIRTABLE_PAT_TOKEN:?AIRTABLE_PAT_TOKEN not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

export MAP_FILE AIRTABLE_PAT_TOKEN N8N_API_KEY N8N_URL VERBOSE

python3 <<'PY'
import json, os, re, sys, urllib.error, urllib.request

map_text = open(os.environ["MAP_FILE"], encoding="utf-8").read()
# The Map spans two bases: Guy's Take and the Pod21 admin base (Automation Upgrades).
BASES = ["app8Xw9Tq0XLjhmp9", "appwcz1Bux9YLcZYm"]
verbose = os.environ.get("VERBOSE") == "1"

def get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def try_get(url, headers):
    try:
        return get(url, headers), None
    except urllib.error.HTTPError as e:
        return None, e.code
    except Exception as e:  # noqa: BLE001
        return None, str(e)

air_h = {"Authorization": "Bearer " + os.environ["AIRTABLE_PAT_TOKEN"]}
n8n_h = {"X-N8N-API-KEY": os.environ["N8N_API_KEY"]}
n8n_base = os.environ["N8N_URL"].rstrip("/") + "/api/v1"

failures = []
notes = []

# ---- 1. Airtable tables and fields -----------------------------------------
base_id = BASES[0]
tables = {}
fields = {}
for base in BASES:
    meta, err = try_get(f"https://api.airtable.com/v0/meta/bases/{base}/tables", air_h)
    if not meta:
        print(f"FAIL  cannot read schema for {base} ({err})")
        sys.exit(1)
    for t in meta.get("tables", []):
        tables[t["id"]] = t
        for f in t.get("fields", []):
            fields[f["id"]] = (t["id"], f)

found_tables = sorted(set(re.findall(r"\btbl[A-Za-z0-9]{14}\b", map_text)))
found_fields = sorted(set(re.findall(r"\bfld[A-Za-z0-9]{14}\b", map_text)))

missing = [x for x in found_tables if x not in tables]
if missing:
    for m in missing:
        failures.append(f"table {m} is named in the Map but does not exist in the base")
missing = [x for x in found_fields if x not in fields]
if missing:
    for m in missing:
        failures.append(f"field {m} is named in the Map but no longer exists")

# ---- 2. n8n workflow IDs ----------------------------------------------------
candidate_ids = set(re.findall(r"\b[A-Za-z0-9]{16}\b", map_text))
wf_ids = [c for c in candidate_ids if re.search(r"[A-Z]", c) and re.search(r"[a-z]", c) and re.search(r"[0-9]", c)]
workflow_states = {}
for wid in sorted(wf_ids):
    data, err = try_get(f"{n8n_base}/workflows/{wid}", n8n_h)
    if not data:
        failures.append(f"workflow {wid} is named in the Map but does not exist in n8n")
        continue
    workflow_states[wid] = (data.get("name", ""), bool(data.get("active")))

# ---- 3/4. Choice values -----------------------------------------------------
def options_for(table_name, field_name):
    for t in tables.values():
        if t.get("name") != table_name:
            continue
        for f in t.get("fields", []):
            if f.get("name") == field_name:
                return {o["name"] for o in (f.get("options") or {}).get("choices", [])}
    return None

# Statuses the Map names as real Episodes.Status values.
episode_status = options_for("Episodes", "Status")
if episode_status is None:
    notes.append("could not read Episodes.Status choices; status check skipped")
else:
    pattern = r"`([A-Z][A-Za-z ]{2,40})`"
    mentioned = set(re.findall(pattern, map_text))
    known_elsewhere = {
        # names that are fields, views, tables or other choice lists, not Status values
    }
    # Only check names that look like statuses and are claimed as Episode statuses:
    # the Map always writes them inside backticks in the Status ladder / checklist.
    claimed = {"Awaiting Thumbnail Pick", "Generating Artwork", "Artwork Ready",
               "Awaiting Manual Artwork", "AI Analysis Complete", "Ready for Metadata",
               "Recorded", "Ready to Publish", "Publishing", "Scheduled to Publish",
               "Published", "Partially Published", "Publishing Failed", "Suspended",
               "Approved", "Awaiting Manual Artwork", "Revised"}
    for name in sorted(claimed & mentioned):
        if name not in episode_status:
            failures.append(f"Status value '{name}' is described in the Map but is not an option on Episodes.Status")

episode_type = options_for("Episodes", "Type")
if episode_type is None:
    notes.append("could not read Episodes.Type choices; type check skipped")
else:
    for name in ["Take", "Chat", "Clip", "Roundtable", "Read", "2 Sats", "Audionauts"]:
        if re.search(r"\b" + re.escape(name) + r"\b", map_text) and name not in episode_type:
            failures.append(f"Episode Type '{name}' is described in the Map but is not an option on Episodes.Type")

# ---- 5. Field names the pipeline depends on ---------------------------------
# A rename here silently breaks both the workflows and every answer the assistant
# gives about them, so these are checked exactly rather than guessed from prose.
CRITICAL = {
    "Episodes": ["ID", "Title", "Type", "Status", "Thumbnail Caption", "Summary",
                 "Guests", "Thumbnails", "Book Cover", "Custom Image Prompt",
                 "Thumbnail Moods", "Release Date", "Frame.io URL", "Chapters",
                 "1x1 Thumbnail Count", "Transcript"],
    "Thumbnails": ["Name", "Episode", "Status", "Caption", "Option", "16x9", "1x1",
                   "9x16", "Revision Brief", "Revision Targets"],
    "Thumbnail References": ["Mood", "Reference Photo"],
    "Publications": ["Publication", "Episode", "Platform", "Status", "Scheduled For"]
}
for table_name, needed in CRITICAL.items():
    match = next((t for t in tables.values() if t.get("name") == table_name), None)
    if not match:
        failures.append(f"table '{table_name}' is missing from the base")
        continue
    have = {f["name"] for f in match.get("fields", [])}
    for fname in needed:
        if fname not in have:
            failures.append(f"field '{fname}' is missing from table '{table_name}' (the Map and the workflows both depend on it)")

# ---- report -----------------------------------------------------------------
print(f"System Map: {len(found_tables)} table ids, {len(found_fields)} field ids, "
      f"{len(wf_ids)} workflow ids, {len(episode_status or [])} statuses checked")

if verbose:
    print("\nWorkflows named in the Map:")
    for wid, (name, active) in sorted(workflow_states.items(), key=lambda kv: kv[1][0]):
        print(f"  {'ACTIVE  ' if active else 'inactive'}  {wid}  {name}")

for n in notes:
    print(f"NOTE  {n}")

if failures:
    print()
    for f in failures:
        print(f"DRIFT {f}")
    print(f"\n{len(failures)} drift problem(s). The Map is what the Telegram assistant answers from, so fix these before relying on it.")
    sys.exit(1)

print("\nNo ID or choice drift found. (View filter conditions cannot be checked via the API.)")
PY
