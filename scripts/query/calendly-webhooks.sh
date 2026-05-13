#!/usr/bin/env bash
#
# Lists all Calendly webhook subscriptions for your user, so you can verify
# which events are registered (especially invitee.created vs invitee.canceled).
#
# Reads from .env: CALENDLY_PAT

set -euo pipefail

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

: "${CALENDLY_PAT:?CALENDLY_PAT not set in .env}"

echo "==> Fetching your Calendly identity..."
ME=$(curl -sS -f \
  -H "Authorization: Bearer $CALENDLY_PAT" \
  "https://api.calendly.com/users/me")

USER_URI=$(echo "$ME" | python3 -c 'import json,sys; print(json.load(sys.stdin)["resource"]["uri"])')
ORG_URI=$(echo "$ME" | python3 -c 'import json,sys; print(json.load(sys.stdin)["resource"]["current_organization"])')

echo "    user URI: $USER_URI"
echo "    org  URI: $ORG_URI"
echo

echo "==> Fetching webhook subscriptions (scope=user)..."
USER_URI="$USER_URI" ORG_URI="$ORG_URI" CALENDLY_PAT="$CALENDLY_PAT" python3 <<'PY'
import os, urllib.parse, urllib.request, urllib.error, json

token = os.environ["CALENDLY_PAT"]
params = urllib.parse.urlencode({
    "organization": os.environ["ORG_URI"],
    "user":         os.environ["USER_URI"],
    "scope":        "user",
})
url = "https://api.calendly.com/webhook_subscriptions?" + params
print("    GET " + url)
req = urllib.request.Request(url, headers={
    "Authorization": "Bearer " + token,
    "User-Agent": "n8n-control-room/1.0 (curl-compatible)",
    "Accept": "application/json",
})

try:
    raw = urllib.request.urlopen(req).read()
except urllib.error.HTTPError as e:
    print("    HTTP " + str(e.code) + " " + e.reason)
    print("    response body:")
    try:
        body = e.read().decode()
    except Exception:
        body = "<unreadable>"
    for line in body.splitlines() or [body]:
        print("        " + line)
    raise SystemExit(1)

data = json.loads(raw)
subs = data.get("collection", [])

if not subs:
    print("    (no webhook subscriptions found)")
    print("    -> workflow is not activated, or activation never registered a webhook")
    raise SystemExit

for s in subs:
    print("    callback: " + str(s.get("callback_url")))
    print("    state:    " + str(s.get("state")))
    print("    events:   " + str(s.get("events")))
    print("    scope:    " + str(s.get("scope")))
    print("    created:  " + str(s.get("created_at")))
    print("    uri:      " + str(s.get("uri")))
    print()
PY

unset CALENDLY_PAT
