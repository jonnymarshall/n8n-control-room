#!/usr/bin/env bash
#
# Read-only Fountain API queries. Wraps the endpoints documented in
# api_specs/Fountain/ so a caller never has to touch .env directly.
#
# Usage:
#   ./scripts/query/fountain.sh                     # list feeds
#   ./scripts/query/fountain.sh feeds
#   ./scripts/query/fountain.sh feed   <feed_id>
#   ./scripts/query/fountain.sh feed-stats <feed_id>
#   ./scripts/query/fountain.sh items  <feed_id>
#   ./scripts/query/fountain.sh item   <feed_id> <item_id>
#   ./scripts/query/fountain.sh item-stats <feed_id> <item_id>
#   ./scripts/query/fountain.sh get    <path>       # raw GET against /v1/<path>
#
# Reads from .env: FOUNTAIN_API_KEY
# Read-only: every call is a GET. No writes are issued from this script.

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

eval "$(python3 - "$ENV_FILE" <<'PY'
import re, shlex, sys
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
with open(sys.argv[1]) as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1); k = k.strip(); v = v.strip()
        if not IDENT.match(k): continue
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'): v = v[1:-1]
        print(f"export {k}={shlex.quote(v)}")
PY
)"

: "${FOUNTAIN_API_KEY:?FOUNTAIN_API_KEY not set in .env}"

BASE="https://api.fountain.fm/v1"

CMD="${1:-feeds}"
shift || true

case "$CMD" in
  feeds)      PATH_="/feeds" ;;
  feed)       : "${1:?usage: fountain.sh feed <feed_id>}";        PATH_="/feeds/$1" ;;
  feed-stats) : "${1:?usage: fountain.sh feed-stats <feed_id>}";  PATH_="/feeds/$1/stats" ;;
  items)      : "${1:?usage: fountain.sh items <feed_id>}";       PATH_="/feeds/$1/items" ;;
  item)       : "${1:?usage: fountain.sh item <feed_id> <item_id>}"
              : "${2:?usage: fountain.sh item <feed_id> <item_id>}"; PATH_="/feeds/$1/items/$2" ;;
  item-stats) : "${1:?usage: fountain.sh item-stats <feed_id> <item_id>}"
              : "${2:?usage: fountain.sh item-stats <feed_id> <item_id>}"; PATH_="/feeds/$1/items/$2/stats" ;;
  get)        : "${1:?usage: fountain.sh get <path>}"; PATH_="/${1#/}" ;;
  *) echo "ERROR: unknown command '$CMD' (try: feeds, feed, feed-stats, items, item, item-stats, get)" >&2; exit 2 ;;
esac

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY" \
  "$BASE$PATH_")

echo "==> GET $BASE$PATH_  ->  HTTP $CODE"

if python3 -c "import json; json.load(open('$TMP'))" 2>/dev/null; then
  python3 -m json.tool < "$TMP"
else
  cat "$TMP"; echo
fi

unset FOUNTAIN_API_KEY
