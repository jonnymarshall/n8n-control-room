#!/usr/bin/env bash
#
# Read-only. Lists every non-empty `Workflow Lock` across the three tables that
# use the claim: Episodes, Thumbnails and Publications. Prints the record, its
# current status, the lock value and how long the lock has existed.
#
# Why this exists: on 2026-11-27 Airtable returned HTTP 500 for seven minutes and
# every view-triggered workflow failed before its claim. There were no locks to
# clear, but proving that meant querying three tables by hand. This is the one
# command for that check, and for the morning after any incident.
#
# A non-empty lock means a run owns the row or died. Do NOT clear one without
# checking the execution first; see `n8n_workflow_readmes/CONVENTIONS.md`.
#
# Exit codes:
#   0  no locks (clean)
#   1  at least one lock found (it may be a live run; read the age first)
#   2  the query failed
#
# Reads from .env: AIRTABLE_PAT_TOKEN
#
# Usage:
#   ./scripts/query/workflow-locks.sh
#   ./scripts/query/workflow-locks.sh --json
#   ./scripts/query/workflow-locks.sh --quiet    # only print when locks exist

set -euo pipefail

JSON=0
QUIET=0
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON=1; shift ;;
    --quiet) QUIET=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 2; }

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

if [ -z "${AIRTABLE_PAT_TOKEN:-}" ]; then
  echo "ERROR: AIRTABLE_PAT_TOKEN not set in $ENV_FILE" >&2
  exit 2
fi
export AIRTABLE_PAT_TOKEN JSON QUIET

python3 - <<'PY'
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE_ID = "app8Xw9Tq0XLjhmp9"
TOKEN = os.environ["AIRTABLE_PAT_TOKEN"]
AS_JSON = os.environ.get("JSON") == "1"
QUIET = os.environ.get("QUIET") == "1"

TABLES = [
    {
        "table": "Episodes",
        "id": "tbl3uYLIvtB9APZp6",
        "name": ["fldYVimbhGfgFZF1X", "fldVUH8a3zxuNqlo1"],
        "status": ["fldUkNtr7lXG5s9DB"],
        "lock": ["fldM4aHJ0qhD1CQBp"],
    },
    {
        "table": "Thumbnails",
        "id": "tblkcASzE4DXlxokO",
        "name": ["fldwPl9acEIOQwZFo"],
        "status": ["fldnDETY3KUqpAD3K"],
        "lock": ["fldoZVty3fmmjuCVV"],
    },
    {
        "table": "Publications",
        "id": "tbllWUvhNolvdk3uw",
        "name": ["fldcjXb1d1TpvkWTx"],
        "status": ["fldAXyXSJrTnk9IQh"],
        "lock": ["fldTDmYOUu0Kfx7AU"],
    },
]


def fetch(table):
    fields = table["name"] + table["status"] + table["lock"]
    params = [
        ("filterByFormula", "{Workflow Lock}!=''"),
        ("pageSize", "100"),
    ]
    params += [("fields[]", f) for f in fields]
    records = []
    offset = None
    while True:
        q = list(params)
        if offset:
            q.append(("offset", offset))
        url = f"https://api.airtable.com/v0/{BASE_ID}/{table['id']}?{urllib.parse.urlencode(q)}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = json.load(resp)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:500]
            print(f"Airtable {table['table']} query failed: HTTP {e.code} {detail}", file=sys.stderr)
            raise SystemExit(2)
        except Exception as e:
            print(f"Airtable {table['table']} query failed: {e}", file=sys.stderr)
            raise SystemExit(2)
        records.extend(body.get("records", []))
        offset = body.get("offset")
        if not offset:
            break
    return records


def pick(fields, ids):
    return " ".join(str(fields.get(i, "")).strip() for i in ids if str(fields.get(i, "")).strip())


def age_seconds(lock):
    value = str(lock or "").strip()
    stamp = value.rsplit(" ", 1)[-1] if " " in value else value
    if not stamp:
        return None
    try:
        if stamp.endswith("Z"):
            stamp = stamp[:-1] + "+00:00"
        when = datetime.fromisoformat(stamp)
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return max(0, int((datetime.now(timezone.utc) - when).total_seconds()))
    except ValueError:
        return None


def human_age(seconds):
    if seconds is None:
        return "unknown age"
    if seconds < 60:
        return "<1m"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m"
    hours, minutes = divmod(minutes, 60)
    if hours < 24:
        return f"{hours}h {minutes}m" if minutes else f"{hours}h"
    days, hours = divmod(hours, 24)
    return f"{days}d {hours}h" if hours else f"{days}d"


locks = []
for table in TABLES:
    for record in fetch(table):
        fields = record.get("fields", {})
        lock = str(fields.get(table["lock"][0], "") or "").strip()
        if not lock:
            continue
        seconds = age_seconds(lock)
        locks.append({
            "table": table["table"],
            "name": pick(fields, table["name"]) or "(unnamed)",
            "status": pick(fields, table["status"]) or "(none)",
            "lock": lock,
            "age_seconds": seconds,
            "age": human_age(seconds),
        })

locks.sort(key=lambda r: r["age_seconds"] if r["age_seconds"] is not None else 10**12, reverse=True)

if AS_JSON:
    print(json.dumps(locks, indent=2))
    sys.exit(1 if locks else 0)

if QUIET and not locks:
    sys.exit(0)

print(f"Workflow Lock audit · base {BASE_ID}")
if not locks:
    print("No Workflow Lock is set on Episodes, Thumbnails or Publications.")
    sys.exit(0)

for table in TABLES:
    rows = [r for r in locks if r["table"] == table["table"]]
    print()
    print(table["table"])
    if not rows:
        print("  (none)")
        continue
    for r in rows:
        print(f"  {r['name']}")
        print(f"    status: {r['status']}")
        print(f"    lock:   {r['lock']}")
        print(f"    age:    {r['age']}")

print()
print(f"{len(locks)} lock(s) found. Check the execution before clearing any of them.")
sys.exit(1)
PY
