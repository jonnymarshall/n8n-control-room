#!/usr/bin/env bash
#
# Creates (and de-duplicates) the AgentMail webhook that feeds the
# "AgentMail Received > Episode Scheduling" n8n workflow.
#
# Subscribes the pod21@agentmail.to inbox to message.received events, pointing
# at the workflow's Webhook node.
#
# Idempotent: deletes any existing webhook whose url matches, then creates one.
#
# Reads from .env: AGENTMAIL_API_KEY, N8N_URL
#
# Usage: ./scripts/deploy/agentmail/create-webhook.sh

set -euo pipefail

INBOX="${AGENTMAIL_INBOX_ID:-pod21@agentmail.to}"
WEBHOOK_PATH="webhook/agentmail-scheduling"

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

: "${AGENTMAIL_API_KEY:?AGENTMAIL_API_KEY not set in .env}"
: "${N8N_URL:?N8N_URL not set in .env}"

URL="${N8N_URL%/}/${WEBHOOK_PATH}"
export URL INBOX AGENTMAIL_API_KEY

python3 <<'PY'
import json, os, urllib.request, urllib.error

key = os.environ["AGENTMAIL_API_KEY"]
url = os.environ["URL"]
inbox = os.environ["INBOX"]
api = "https://api.agentmail.to/v0/webhooks"

def call(method, u, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(u, data=data, method=method, headers={
        "Authorization": "Bearer " + key,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "n8n-control-room/1.0",
    })
    try:
        res = urllib.request.urlopen(req)
        return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")

print("callback:", url)
print("inbox:   ", inbox)

code, listing = call("GET", api)
if code != 200:
    print(f"ERROR: {code} listing webhooks:\n{listing}")
    raise SystemExit(1)
items = listing if isinstance(listing, list) else (listing.get("webhooks") or listing.get("data") or listing.get("items") or [])
for w in items:
    if w.get("url") == url:
        wid = w.get("webhook_id") or w.get("id")
        print("deleting stale webhook:", wid)
        dcode, dbody = call("DELETE", f"{api}/{wid}")
        if dcode not in (200, 204):
            print(f"ERROR: {dcode} deleting {wid}:\n{dbody}")
            raise SystemExit(1)

code, res = call("POST", api, {"url": url, "event_types": ["message.received"], "inbox_ids": [inbox]})
if code not in (200, 201):
    print(f"ERROR: {code} creating webhook:\n{res}")
    raise SystemExit(1)
w = res.get("webhook", res)
print("SUCCESS")
print("  id:        ", w.get("webhook_id") or w.get("id"))
print("  url:       ", w.get("url"))
print("  events:    ", w.get("event_types"))
print("  inbox_ids: ", w.get("inbox_ids"))
PY
