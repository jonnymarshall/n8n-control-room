#!/usr/bin/env bash
#
# Bookings query tool for AI agents.
#
# Hits the n8n Public API webhook to retrieve the bookings list. Same flag
# surface as the admin-side query/bookings.sh — your AI agent can call this
# script with the same arguments it would use locally.
#
# Configure once (in your shell, in .env in the same directory, or in the
# AI agent's environment):
#
#   AGENT_TOKEN   - the bearer token issued to you (from your admin)
#   N8N_API_URL   - the webhook URL given to you by your admin
#                   (e.g. https://your-n8n-host.example.com/webhook/api)
#
# Usage:
#   ./bookings.sh                          # compact table, all rows (most recent first)
#   ./bookings.sh status=booked            # filter by status
#   ./bookings.sh invitee_email=x@y.com    # filter by attendee
#   ./bookings.sh --all                    # verbose vertical layout (every column)
#   ./bookings.sh --json                   # raw JSON dump (for programmatic agents)
#   ./bookings.sh --recent 5               # 5 most recent bookings

set -euo pipefail

# Load .env in the same directory if present.
if [ -f "$(dirname "$0")/.env" ]; then
  eval "$(python3 - "$(dirname "$0")/.env" <<'PY'
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
fi

: "${AGENT_TOKEN:?AGENT_TOKEN not set — put it in .env next to this script, or export it}"
: "${N8N_API_URL:?N8N_API_URL not set — put it in .env next to this script, or export it}"

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"action":"list_bookings"}' \
  "$N8N_API_URL")

if [ "$CODE" != "200" ]; then
  echo "ERROR: API returned HTTP $CODE" >&2
  echo "Response body:" >&2
  sed 's/^/    /' "$TMP" >&2
  exit 1
fi

ARGS="$*" RESPONSE_FILE="$TMP" python3 <<'PY'
import json, os, sys

with open(os.environ["RESPONSE_FILE"]) as f:
    data = json.load(f)

# Server wraps rows in a "rows" key (Respond to Webhook responseKey).
rows = data.get("rows") if isinstance(data, dict) else data
if not isinstance(rows, list):
    rows = [rows] if rows else []

# Parse args.
verbose, as_json, recent_n, filters = False, False, None, {}
tokens = os.environ["ARGS"].split(); i = 0
while i < len(tokens):
    t = tokens[i]
    if t == "--all": verbose = True
    elif t == "--json": as_json = True
    elif t == "--recent":
        if i + 1 >= len(tokens) or not tokens[i+1].isdigit():
            sys.stderr.write("ERROR: --recent requires an integer\n"); sys.exit(1)
        recent_n = int(tokens[i+1]); i += 1
    elif "=" in t:
        k, v = t.split("=", 1); filters[k.strip()] = v.strip()
    i += 1

def matches(r):
    for k, v in filters.items():
        if str(r.get(k, "")) != v: return False
    return True

matched = [r for r in rows if matches(r)]
matched.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
if recent_n is not None:
    matched = matched[:recent_n]

def cell(row, field):
    v = row.get(field)
    if v is None: return ""
    if field.endswith("_time") or field.endswith("_at"):
        s = str(v)
        if len(s) >= 16 and s[10] == "T": return s[:10] + " " + s[11:16]
    return str(v)

if as_json:
    print(json.dumps(matched, indent=2, default=str))
    sys.exit(0)

print(f"Total rows: {len(rows)}")
if filters: print(f"Filters:    {filters}")
print(f"Matched:    {len(matched)}")
print()

if not matched:
    print("(no matches)"); sys.exit(0)

if verbose:
    all_keys, seen = [], set()
    for r in matched:
        for k in r.keys():
            if k not in seen: seen.add(k); all_keys.append(k)
    kw = max(len(k) for k in all_keys)
    for i, r in enumerate(matched, 1):
        print(f"--- row {i} ---")
        for k in all_keys:
            print(f"  {k.ljust(kw)}  {cell(r, k)}")
        print()
else:
    FIELDS = ["status", "invitee_name", "invitee_email", "event_type_name", "start_time", "cancellation_reason"]
    rendered = [{f: cell(r, f) for f in FIELDS} for r in matched]
    widths = {f: max(len(f), max((len(r[f]) for r in rendered), default=0)) for f in FIELDS}
    header = "  ".join(f.ljust(widths[f]) for f in FIELDS)
    print(header); print("-" * len(header))
    for r in rendered:
        print("  ".join(r[f][:60].ljust(widths[f]) for f in FIELDS))
PY
