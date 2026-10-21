#!/usr/bin/env bash
#
# Adds the "Scheduling" option to the Episodes.Status single-select in the
# Guy's Take base, without disturbing the existing choices.
#
# Used by the Calendly Scheduling workflow: an episode moves to Status =
# "Scheduling" when a Calendly meeting poll for it is created, and to
# "Scheduled" when the poll is booked.
#
# Idempotent: re-running is a no-op once the choice exists.
#
# Reads from .env: AIRTABLE_PAT_TOKEN
#
# Usage: ./scripts/deploy/schema/add-scheduling-status.sh

set -euo pipefail

BASE_ID="app8Xw9Tq0XLjhmp9"
TABLE_ID="tbl3uYLIvtB9APZp6"
FIELD_ID="fldUkNtr7lXG5s9DB"   # Episodes.Status
TITLE_FIELD_ID="fldVUH8a3zxuNqlo1"   # Episodes.Title
NEW_CHOICE="Scheduling"

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

: "${AIRTABLE_PAT_TOKEN:?AIRTABLE_PAT_TOKEN not set in .env}"

export BASE_ID TABLE_ID FIELD_ID TITLE_FIELD_ID NEW_CHOICE AIRTABLE_PAT_TOKEN

python3 <<'PY'
import json, os, urllib.request, urllib.error

base = os.environ["BASE_ID"]
table = os.environ["TABLE_ID"]
field = os.environ["FIELD_ID"]
title_field = os.environ["TITLE_FIELD_ID"]
new_choice = os.environ["NEW_CHOICE"]
token = os.environ["AIRTABLE_PAT_TOKEN"]

def call(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "n8n-control-room/1.0",
    })
    try:
        res = urllib.request.urlopen(req)
        return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")

def status_choice_names():
    code, body = call("GET", f"https://api.airtable.com/v0/meta/bases/{base}/tables")
    if code != 200:
        print(f"ERROR: reading tables returned HTTP {code}:\n{body}")
        raise SystemExit(1)
    for t in body.get("tables", []):
        if t.get("id") == table:
            for f in t.get("fields", []):
                if f.get("id") == field:
                    return [c.get("name") for c in (f.get("options") or {}).get("choices") or []]
    print("ERROR: could not find the Status field in the Episodes table")
    raise SystemExit(1)

print("==> Reading current Episodes.Status choices...")
names = status_choice_names()
print("    current:", ", ".join(names))

if new_choice in names:
    print(f"==> '{new_choice}' already exists — nothing to do.")
    raise SystemExit(0)

# Airtable's metadata API cannot add select choices. The supported workaround:
# create a throwaway record whose Status uses the new value with typecast=true,
# which makes Airtable create the option, then delete the record.
print(f"==> Creating '{new_choice}' via a throwaway record (typecast)...")
url = f"https://api.airtable.com/v0/{base}/{table}?typecast=true"
code, body = call("POST", url, {"fields": {title_field: "__schema_probe__", field: new_choice}})
if code not in (200, 201):
    print(f"ERROR: creating the probe record returned HTTP {code}:\n{body}")
    raise SystemExit(1)
record_id = body["id"]
print(f"    probe record: {record_id}")

code, body = call("DELETE", f"https://api.airtable.com/v0/{base}/{table}/{record_id}")
if code not in (200, 201):
    print(f"ERROR: deleting the probe record returned HTTP {code}:\n{body}")
    print(f"    !! manually delete record {record_id} from Episodes")
    raise SystemExit(1)
print("    probe record deleted")

names = status_choice_names()
print("SUCCESS — choices now:", ", ".join(names))
if new_choice not in names:
    print("WARNING: the choice is not visible in the schema yet (Airtable can lag); re-run to confirm.")
PY
