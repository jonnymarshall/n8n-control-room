#!/usr/bin/env bash
#
# Query the 'bookings' data table from the command line.
#
# Usage:
#   ./scripts/query-bookings.sh                          # compact table, all rows
#   ./scripts/query-bookings.sh status=booked            # only booked
#   ./scripts/query-bookings.sh status=cancelled         # only cancelled
#   ./scripts/query-bookings.sh invitee_email=jane@x.com # by attendee
#   ./scripts/query-bookings.sh --all                    # verbose: every column, vertical layout
#   ./scripts/query-bookings.sh --all status=cancelled   # filters + verbose
#   ./scripts/query-bookings.sh --json                   # raw JSON dump of matched rows
#   ./scripts/query-bookings.sh --recent 5               # 5 most recently written rows (sorted by createdAt desc)
#   ./scripts/query-bookings.sh --recent 10 --all        # combine with --all / filters as usual
#
# Filters are ANDed. Use one or many. Values are exact string match.
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

TABLE_NAME="bookings"

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

DISCOVERY=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/data-tables" \
  | TABLE_NAME="$TABLE_NAME" python3 -c '
import json, os, sys
target = os.environ["TABLE_NAME"]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else (data.get("data") or [])
for t in items:
    if t.get("name") == target:
        print(t["id"]); print(t.get("projectId", "")); sys.exit(0)
sys.exit(1)
')
TABLE_ID=$(echo "$DISCOVERY" | sed -n 1p)
PROJECT_ID=$(echo "$DISCOVERY" | sed -n 2p)

if [ -z "$TABLE_ID" ]; then
  echo "ERROR: table '$TABLE_NAME' not found" >&2
  exit 1
fi

# (Flags like --all / --json are handled in the Python block below;
# the bash side doesn't need to do anything with them here.)

ROWS_JSON=""
for path in \
  "/api/v1/data-tables/$TABLE_ID/rows" \
  "/api/v1/data-tables/$TABLE_ID/rows?take=500" \
  "/api/v1/data-tables/$TABLE_ID/rows?limit=500" \
  "/api/v1/data-tables/$TABLE_ID" \
  "/api/v1/projects/$PROJECT_ID/data-tables/$TABLE_ID/rows" \
  "/rest/data-tables/$TABLE_ID/rows"
do
  TMP=$(mktemp)
  CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Accept: application/json" \
    "$N8N_URL$path")
  if [ "$CODE" = "200" ]; then
    ROWS_JSON=$(cat "$TMP")
    echo "==> Rows endpoint: $path" >&2
    rm -f "$TMP"
    break
  fi
  echo "    tried $path -> HTTP $CODE" >&2
  rm -f "$TMP"
done

if [ -z "$ROWS_JSON" ]; then
  echo "ERROR: no rows endpoint matched. Showing one verbose attempt:" >&2
  curl -sS -v \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Accept: application/json" \
    "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows" 2>&1 | head -40 >&2
  exit 1
fi

ARGS="$*" ROWS_JSON="$ROWS_JSON" python3 <<'PY'
import json, os, sys

data = json.loads(os.environ["ROWS_JSON"])
rows = data if isinstance(data, list) else (data.get("data") or data.get("items") or [])

# Parse flags and filters from CLI args.
verbose = False
as_json = False
recent_n = None
filters = {}
tokens = os.environ["ARGS"].split()
i = 0
while i < len(tokens):
    tok = tokens[i]
    if tok == "--all":
        verbose = True
    elif tok == "--json":
        as_json = True
    elif tok == "--recent":
        if i + 1 >= len(tokens) or not tokens[i + 1].isdigit():
            sys.stderr.write("ERROR: --recent requires an integer (e.g. --recent 5)\n")
            sys.exit(1)
        recent_n = int(tokens[i + 1])
        i += 1
    elif "=" in tok:
        k, v = tok.split("=", 1)
        filters[k.strip()] = v.strip()
    i += 1

def matches(row, filters):
    for k, v in filters.items():
        if str(row.get(k, "")) != v:
            return False
    return True

matched = [r for r in rows if matches(r, filters)]

# Sort newest-first by createdAt (when n8n wrote the row), then optionally cap.
matched.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
if recent_n is not None:
    matched = matched[:recent_n]

def cell(row, field):
    v = row.get(field)
    if v is None:
        return ""
    if field.endswith("_time") or field.endswith("_at"):
        s = str(v)
        if len(s) >= 16 and s[10] == "T":
            return s[:10] + " " + s[11:16]
    return str(v)

if as_json:
    print(json.dumps(matched, indent=2, default=str))
    sys.exit(0)

print(f"Total rows: {len(rows)}")
if filters:
    print(f"Filters:    {filters}")
print(f"Matched:    {len(matched)}")
print()

if not matched:
    print("(no matches)")
    sys.exit(0)

if verbose:
    # Vertical layout — one row per record, every column on its own line.
    # Order columns by index if available, else by first-seen.
    all_keys = []
    seen = set()
    for r in matched:
        for k in r.keys():
            if k not in seen:
                seen.add(k); all_keys.append(k)
    key_width = max(len(k) for k in all_keys)
    for i, r in enumerate(matched, 1):
        print(f"--- row {i} ---")
        for k in all_keys:
            print(f"  {k.ljust(key_width)}  {cell(r, k)}")
        print()
else:
    FIELDS = ["status", "invitee_name", "invitee_email", "event_type_name", "start_time", "cancellation_reason"]
    rendered = [{f: cell(r, f) for f in FIELDS} for r in matched]
    widths = {f: max(len(f), max((len(r[f]) for r in rendered), default=0)) for f in FIELDS}
    header = "  ".join(f.ljust(widths[f]) for f in FIELDS)
    print(header)
    print("-" * len(header))
    for r in rendered:
        print("  ".join(r[f][:60].ljust(widths[f]) for f in FIELDS))
PY

unset N8N_API_KEY
