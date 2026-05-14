#!/usr/bin/env bash
#
# Backfills the `bookings` data table with all upcoming (active, future) bookings
# from Calendly. Each invitee on each upcoming scheduled event becomes one row.
#
# Idempotent-ish:
#   The n8n public API can only INSERT rows (not upsert), so this script first
#   reads existing invitee_ids out of the bookings table and skips any invitee
#   it already has. Safe to re-run — re-running will only add newly-booked
#   future events.
#
# Schema mapping mirrors the live Calendly workflow's `Upsert Booking Row` node,
# so backfilled rows look identical to webhook-driven rows. Rows are written
# with status='booked' (this script does not import cancelled bookings).
#
# Usage:
#   ./scripts/deploy/bookings/backfill-from-calendly.sh
#   ./scripts/deploy/bookings/backfill-from-calendly.sh --dry-run    # show, don't write
#
# Reads from .env: N8N_URL, N8N_API_KEY, CALENDLY_PAT

set -euo pipefail

TABLE_NAME="bookings"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
path = sys.argv[1]
with open(path) as f:
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
: "${CALENDLY_PAT:?CALENDLY_PAT not set in .env}"

echo "==> Looking up '$TABLE_NAME' data table..."
TABLE_ID=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/data-tables" \
  | TABLE_NAME="$TABLE_NAME" python3 -c '
import json, os, sys
data = json.load(sys.stdin)
items = data if isinstance(data, list) else (data.get("data") or [])
for t in items:
    if t.get("name") == os.environ["TABLE_NAME"]:
        print(t["id"]); sys.exit(0)
sys.exit(1)
')
[ -n "$TABLE_ID" ] || { echo "ERROR: '$TABLE_NAME' table not found" >&2; exit 1; }
echo "    table: $TABLE_NAME ($TABLE_ID)"

echo "==> Fetching existing invitee_ids in $TABLE_NAME (to avoid duplicate inserts)..."
EXISTING_IDS=$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows" \
  | python3 -c '
import json, sys
data = json.load(sys.stdin)
rows = data if isinstance(data, list) else (data.get("data") or data.get("items") or [])
print("\n".join(str(r.get("invitee_id") or "") for r in rows if r.get("invitee_id")))
')
EXISTING_COUNT=$(printf '%s\n' "$EXISTING_IDS" | sed '/^$/d' | wc -l | tr -d ' ')
echo "    $EXISTING_COUNT existing row(s) — those invitee_ids will be skipped"

NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "==> Fetching upcoming Calendly bookings (min_start_time=$NOW_ISO)..."

# All the network + mapping work happens in Python because curling Calendly,
# walking pagination, joining events with their invitees, and shaping rows is
# much easier than the equivalent in bash.
ROWS_JSON=$(EXISTING_IDS="$EXISTING_IDS" NOW_ISO="$NOW_ISO" \
  CALENDLY_PAT="$CALENDLY_PAT" python3 <<'PY'
import json, os, sys, urllib.parse, urllib.request, urllib.error

PAT = os.environ["CALENDLY_PAT"]
NOW = os.environ["NOW_ISO"]
SKIP = {x for x in os.environ["EXISTING_IDS"].splitlines() if x.strip()}

def get(url):
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + PAT,
        "Accept": "application/json",
        "User-Agent": "n8n-control-room-backfill/1.0",
    })
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"Calendly HTTP {e.code} on {url}\n")
        sys.stderr.write("    " + e.read().decode(errors="replace") + "\n")
        raise SystemExit(1)

me = get("https://api.calendly.com/users/me")
user_uri = me["resource"]["uri"]
sys.stderr.write(f"    me: {user_uri}\n")

def paged(url):
    while url:
        page = get(url)
        for it in page.get("collection", []):
            yield it
        nxt = (page.get("pagination") or {}).get("next_page")
        url = nxt

events_url = "https://api.calendly.com/scheduled_events?" + urllib.parse.urlencode({
    "user": user_uri,
    "status": "active",
    "min_start_time": NOW,
    "count": "100",
    "sort": "start_time:asc",
})

events = list(paged(events_url))
sys.stderr.write(f"    {len(events)} upcoming active event(s) from Calendly\n")

rows = []
skipped_existing = 0
skipped_cancelled = 0
for ev in events:
    ev_uuid = ev["uri"].rsplit("/", 1)[-1]
    invitees_url = (
        "https://api.calendly.com/scheduled_events/" + ev_uuid + "/invitees?"
        + urllib.parse.urlencode({"status": "active", "count": "100"})
    )
    for inv in paged(invitees_url):
        # Defense in depth — even though we filtered status=active above.
        if inv.get("status") != "active":
            skipped_cancelled += 1
            continue
        inv_id = inv["uri"].rsplit("/", 1)[-1]
        if inv_id in SKIP:
            skipped_existing += 1
            continue
        loc = ev.get("location") or {}
        mems = ev.get("event_memberships") or []
        host = mems[0] if mems else {}
        rows.append({
            "invitee_id": inv_id,
            "event_id": ev_uuid,
            "event_type_name": ev.get("name") or "",
            "invitee_name": inv.get("name") or "",
            "invitee_email": inv.get("email") or "",
            "invitee_timezone": inv.get("timezone") or "",
            "start_time": ev.get("start_time"),
            "end_time": ev.get("end_time"),
            "location_type": loc.get("type") or "",
            "location_value": loc.get("join_url") or loc.get("location") or "",
            "host_name": host.get("user_name") or "",
            "host_email": host.get("user_email") or "",
            "status": "booked",
            "booked_at": inv.get("created_at"),
            "cancelled_at": None,
            "canceler_type": None,
            "canceled_by": None,
            "cancellation_reason": None,
            "reschedule_url": inv.get("reschedule_url") or "",
            "cancel_url": inv.get("cancel_url") or "",
        })

sys.stderr.write(f"    {len(rows)} new row(s) to insert "
                 f"(skipped {skipped_existing} already present, "
                 f"{skipped_cancelled} cancelled)\n")

print(json.dumps(rows))
PY
)

NEW_COUNT=$(printf '%s' "$ROWS_JSON" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
echo "    will insert: $NEW_COUNT row(s)"

if [ "$NEW_COUNT" = "0" ]; then
  echo "Nothing new to insert."
  exit 0
fi

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "DRY RUN — first 3 rows that would be inserted:"
  printf '%s' "$ROWS_JSON" | python3 -c '
import json, sys
rows = json.load(sys.stdin)
for r in rows[:3]:
    print(json.dumps(r, indent=2))
'
  exit 0
fi

echo "==> Inserting rows..."
INSERT_TMP=$(mktemp); trap 'rm -f "$INSERT_TMP"' EXIT
BODY=$(printf '%s' "$ROWS_JSON" | python3 -c 'import json,sys; print(json.dumps({"data": json.load(sys.stdin)}))')
CODE=$(curl -sS -o "$INSERT_TMP" -w "%{http_code}" -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  --data "$BODY" "$N8N_URL/api/v1/data-tables/$TABLE_ID/rows")
if [ "$CODE" != "200" ] && [ "$CODE" != "201" ]; then
  echo "ERROR: insert returned HTTP $CODE" >&2
  sed 's/^/    /' "$INSERT_TMP" >&2
  exit 1
fi

INSERTED=$(python3 -c '
import json, sys
data = json.load(sys.stdin)
rows = data if isinstance(data, list) else (data.get("data") or data.get("items") or data)
try: print(len(rows))
except TypeError: print("?")
' < "$INSERT_TMP")
echo "    inserted: $INSERTED row(s)"

echo
echo "SUCCESS — backfilled $INSERTED upcoming booking(s) into '$TABLE_NAME'."
echo "Run ./scripts/query/bookings.sh to see them."
