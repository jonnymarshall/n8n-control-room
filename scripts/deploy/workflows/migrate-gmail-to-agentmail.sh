#!/usr/bin/env bash
#
# Replaces the two Gmail nodes in the Calendly workflow with HTTP Request
# nodes that POST to AgentMail's send-message endpoint.
#
# Reads from .env:
#   N8N_URL                   - base URL of your n8n instance
#   N8N_API_KEY               - n8n REST API key
#   AGENTMAIL_CREDENTIAL_ID   - id of the httpHeaderAuth credential we created
#   AGENTMAIL_INBOX_ID        - the AgentMail inbox to send from
#
# Hardcoded inputs (edit if you need different workflow / credential):
#   WORKFLOW_ID   - the Calendly workflow we deployed earlier
#   CRED_NAME     - the credential display name (must match what's in n8n)

set -euo pipefail

WORKFLOW_ID="VPjMyEdiiEobpskU"
CRED_NAME="AgentMail (n8n control room)"

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

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"
: "${AGENTMAIL_CREDENTIAL_ID:?AGENTMAIL_CREDENTIAL_ID not set in .env}"
: "${AGENTMAIL_INBOX_ID:?AGENTMAIL_INBOX_ID not set in .env}"

echo "==> Fetching current workflow ($WORKFLOW_ID)..."
WF=$(curl -sS -f \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

echo "==> Rewriting Gmail nodes → AgentMail HTTP Request nodes..."
PATCHED=$(WF="$WF" \
  CRED_ID="$AGENTMAIL_CREDENTIAL_ID" \
  CRED_NAME="$CRED_NAME" \
  INBOX_ID="$AGENTMAIL_INBOX_ID" \
  python3 <<'PY'
import json, os, sys

wf = json.loads(os.environ["WF"])
cred_id = os.environ["CRED_ID"]
cred_name = os.environ["CRED_NAME"]
inbox_id = os.environ["INBOX_ID"]

url = f"https://api.agentmail.to/v0/inboxes/{inbox_id}/messages/send"

# Reference the Calendly trigger explicitly — there are now data-table nodes
# between the Switch and these HTTP nodes, so $json points at the data-table
# output, not the Calendly payload. $('Calendly Event').item.json reaches
# back to the trigger regardless of intermediate nodes.
P = "$('Calendly Event').item.json.payload"

confirm_subject = (
    'Confirmed: {{ ' + P + '.scheduled_event.name }} on '
    '{{ DateTime.fromISO(' + P + '.scheduled_event.start_time).toFormat("LLL d") }}'
)
where_line = (
    "<li><strong>Where:</strong> {{ " + P + ".scheduled_event.location?.join_url ? "
    "'<a href=\"' + " + P + ".scheduled_event.location.join_url + '\">' + "
    + P + ".scheduled_event.location.join_url + '</a>' : "
    "(" + P + ".scheduled_event.location?.location || 'See your calendar invite for details') }}</li>"
)
confirm_html = (
    '<p>Hi {{ ' + P + '.name }},</p>'
    '<p>Your booking is confirmed. Here are the details:</p>'
    '<ul>'
    '<li><strong>Event:</strong> {{ ' + P + '.scheduled_event.name }}</li>'
    "<li><strong>When:</strong> {{ DateTime.fromISO(" + P + ".scheduled_event.start_time).toFormat(\"EEEE, LLLL d, yyyy 'at' h:mm a ZZZZ\") }}</li>"
    + where_line +
    '</ul>'
    '<p>Need to make changes? '
    '<a href="{{ ' + P + '.reschedule_url }}">Reschedule</a> or '
    '<a href="{{ ' + P + '.cancel_url }}">cancel</a>.</p>'
    '<p>Looking forward to it!</p>'
)
cancel_subject = 'Canceled: {{ ' + P + '.scheduled_event.name }}'
cancel_intro = (
    "{{ " + P + ".cancellation?.canceler_type == 'host' ? "
    "'This booking was canceled by ' + (" + P + ".cancellation?.canceled_by || 'the host') + '.' : "
    "(" + P + ".cancellation?.canceler_type == 'invitee' ? "
    "'Your cancellation has been confirmed.' : 'Your booking has been canceled.') }}"
)
cancel_reason_line = (
    "{{ " + P + ".cancellation?.reason ? "
    "'<li><strong>Reason:</strong> ' + " + P + ".cancellation.reason + '</li>' : '' }}"
)
cancel_html = (
    '<p>Hi {{ ' + P + '.name }},</p>'
    '<p>' + cancel_intro + '</p>'
    '<ul>'
    '<li><strong>Event:</strong> {{ ' + P + '.scheduled_event.name }}</li>'
    "<li><strong>Was scheduled for:</strong> {{ DateTime.fromISO(" + P + ".scheduled_event.start_time).toFormat(\"EEEE, LLLL d, yyyy 'at' h:mm a ZZZZ\") }}</li>"
    + cancel_reason_line +
    '</ul>'
    '<p>Want to pick a new time? <a href="{{ ' + P + '.reschedule_url }}">Grab a new slot here</a>.</p>'
    '<p>Hope to see you soon.</p>'
)

def http_node(template_node, subject, html_body):
    """Build a replacement HTTP Request node, preserving id/position from the original."""
    return {
        "id": template_node.get("id"),
        "name": template_node["name"],
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": template_node.get("position", [840, 300]),
        "parameters": {
            "method": "POST",
            "url": url,
            "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "sendBody": True,
            "contentType": "json",
            "specifyBody": "keypair",
            "bodyParameters": {
                "parameters": [
                    {"name": "to",      "value": "={{ " + P + ".email }}"},
                    {"name": "subject", "value": "=" + subject},
                    {"name": "html",    "value": "=" + html_body},
                ],
            },
            "options": {},
        },
        "credentials": {
            "httpHeaderAuth": {"id": cred_id, "name": cred_name},
        },
    }

found_confirm = False
found_cancel = False
new_nodes = []
for n in wf.get("nodes", []):
    if n.get("name") == "Send Booking Confirmation":
        new_nodes.append(http_node(n, confirm_subject, confirm_html))
        found_confirm = True
    elif n.get("name") == "Send Cancellation Notice":
        new_nodes.append(http_node(n, cancel_subject, cancel_html))
        found_cancel = True
    else:
        new_nodes.append(n)

missing = []
if not found_confirm: missing.append("Send Booking Confirmation")
if not found_cancel:  missing.append("Send Cancellation Notice")
if missing:
    sys.stderr.write(f"ERROR: did not find these node(s): {missing}\n")
    sys.exit(1)

wf["nodes"] = new_nodes

allowed = {"name", "nodes", "connections", "settings", "staticData"}
out = {k: v for k, v in wf.items() if k in allowed}

# n8n's public API rejects unknown keys inside `settings`. Filter to the
# documented allowlist and drop everything else (n8n re-fills defaults).
settings_allowed = {
    "saveExecutionProgress", "saveManualExecutions",
    "saveDataErrorExecution", "saveDataSuccessExecution",
    "executionTimeout", "errorWorkflow", "timezone", "executionOrder",
}
out["settings"] = {k: v for k, v in (out.get("settings") or {}).items() if k in settings_allowed}

print(json.dumps(out))
PY
)

echo "==> Pushing updated workflow..."
TMP_RESP=$(mktemp)
trap 'rm -f "$TMP_RESP"' EXIT

HTTP_CODE=$(curl -sS \
  -o "$TMP_RESP" \
  -w "%{http_code}" \
  -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data "$PATCHED" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: PUT returned HTTP $HTTP_CODE" >&2
  echo "Response body:" >&2
  sed 's/^/    /' "$TMP_RESP" >&2
  echo >&2
  echo "Patched payload (first 2KB):" >&2
  echo "$PATCHED" | head -c 2048 | sed 's/^/    /' >&2
  echo >&2
  exit 1
fi

echo
echo "SUCCESS — both email nodes now POST to AgentMail."
echo "Open: $N8N_URL/workflow/$WORKFLOW_ID"

unset WF PATCHED N8N_API_KEY AGENTMAIL_CREDENTIAL_ID
