#!/usr/bin/env bash
#
# Writes (or refreshes) the local .sdk.js copy of a live n8n workflow.
#
# Every workflow in this repo has a `.sdk.js` file under scripts/deploy/workflows/.
# The live server is the source of truth; the .sdk.js file is the reviewable
# snapshot kept in git. Run this after any change that lands in n8n, and
# immediately after creating a new workflow.
#
# The output is a faithful snapshot (node parameters and settings verbatim from
# live), in the same shape as the other snapshot files here. There is no local
# @n8n/workflow-sdk install, so this file cannot be compiled here; it exists to
# be read and diffed.
#
# Usage:
#   ./scripts/deploy/workflows/snapshot-sdk.sh <workflow_id>
#   ./scripts/deploy/workflows/snapshot-sdk.sh <workflow_id> <slug>   # e.g. agentmail-episode-scheduling
#
# Check coverage across the whole instance with scripts/query/sdk-coverage.sh.
#
# Reads from .env: N8N_URL, N8N_API_KEY

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <workflow_id> [slug]" >&2
  exit 1
fi
WORKFLOW_ID="$1"
SLUG="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$(cd "$SCRIPT_DIR/../../.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

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

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

WF_JSON="$(curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows/$WORKFLOW_ID")" || {
  echo "ERROR: could not fetch workflow $WORKFLOW_ID from $N8N_URL" >&2
  exit 1
}

WF_JSON="$WF_JSON" WORKFLOW_ID="$WORKFLOW_ID" SLUG="$SLUG" OUT_DIR="$SCRIPT_DIR" python3 <<'PY'
import datetime, json, os, re, sys

wf = json.loads(os.environ["WF_JSON"])
wf_id = os.environ["WORKFLOW_ID"]
name = wf.get("name") or wf_id

slug = os.environ["SLUG"].strip()
if not slug:
    s = name
    # Drop the program prefix, matching the existing files (BA: Guy's Take Script
    # Generation -> guys-take-script-generation).
    for prefix in ("BA - ", "BA: ", "BA ", "Pod21 - ", "Pod21: ", "Pod21 — ",
                   "pod21 - ", "pod21: ", "pod21 — "):
        if s.lower().startswith(prefix.lower()):
            s = s[len(prefix):]
            break
    s = s.replace(" > ", "-").replace(">", "-")
    s = s.replace("'", "").replace("\u2019", "")   # Guy's -> Guys, not Guy-s
    s = s.replace("&", " ")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    slug = s

path = os.path.join(os.environ["OUT_DIR"], f"{slug}.sdk.js")

NODE_FLAGS = ["disabled", "notes", "notesInFlow", "onError", "retryOnFail", "maxTries",
              "waitBetweenTries", "continueOnFail", "alwaysOutputData", "executeOnce", "webhookId"]

def emit_node(n):
    out = {
        "id": n.get("id"),
        "name": n.get("name"),
        "type": n.get("type"),
        "typeVersion": n.get("typeVersion"),
        "position": n.get("position"),
    }
    for flag in NODE_FLAGS:
        if n.get(flag) not in (None, False, ""):
            out[flag] = n[flag]
    out["parameters"] = n.get("parameters") or {}
    if n.get("credentials"):
        out["credentials"] = {k: {"id": v.get("id"), "name": v.get("name")}
                              for k, v in n["credentials"].items()}
    return json.dumps(out, ensure_ascii=False)

nodes = sorted(wf.get("nodes") or [],
               key=lambda n: tuple((n.get("position") or [0, 0])[:2]))
lines = [f"  {emit_node(n)}" for n in nodes]

conns = []
for source, outputs in (wf.get("connections") or {}).items():
    for output_index, branch in enumerate(outputs.get("main") or []):
        for link in (branch or []):
            target = link.get("node")
            if not target:
                continue
            target_index = link.get("index") or 0
            if target_index:
                conns.append(f"  ['{source}', {output_index}, '{target}', {target_index}]")
            else:
                conns.append(f"  ['{source}', {output_index}, '{target}']")

settings = wf.get("settings") or {}
IDENT = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
setting_lines = ",\n".join(
    f"  {k if IDENT.match(k) else json.dumps(k)}: {json.dumps(v)}" for k, v in settings.items())

var = re.sub(r"[^A-Za-z0-9]+", " ", slug).strip()
var = var.split()[0].lower() + "".join(w.capitalize() for w in var.split()[1:]) if var else "workflowDoc"
if not re.match(r"^[A-Za-z_]", var):
    var = "wf" + var

today = datetime.date.today().isoformat()

doc = f"""import {{ workflow, node, trigger }} from '@n8n/workflow-sdk';

// Snapshot of live workflow {wf_id}, fetched {today}.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh {wf_id} {slug}
const liveNodes = [
{',\n'.join(lines)}
];

// Node types that start an execution. Everything else is a regular step.
const TRIGGER_TYPES = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.formTrigger',
  'n8n-nodes-base.airtableTrigger',
  'n8n-nodes-base.telegramTrigger',
  'n8n-nodes-base.gmailTrigger',
  'n8n-nodes-base.executeWorkflowTrigger'
]);

const nodesByName = {{}};
for (const live of liveNodes) {{
  const {{ type, typeVersion, credentials, ...config }} = live;
  if (credentials) {{
    config.credentials = Object.fromEntries(
      Object.entries(credentials).map(([credentialType, reference]) => [credentialType, {{ id: reference.id, name: reference.name }}])
    );
  }}
  nodesByName[live.name] = (TRIGGER_TYPES.has(type) ? trigger : node)({{
    type,
    version: typeVersion,
    config,
    output: [{{}}]
  }});
}}

// [source, sourceOutputIndex, target, targetInputIndex?]
const connections = [
{',\n'.join(conns)}
];

const {var} = workflow(
  {json.dumps(wf_id)},
  {json.dumps(name)}
){('.settings({\n' + setting_lines + '\n})') if settings else ''};

for (const live of liveNodes) {var}.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {{
  {var}.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}}

export default {var};
"""

with open(path, "w") as f:
    f.write(doc)

print(f"wrote {path}")
print(f"nodes: {len(nodes)}  connections: {len(conns)}")
PY

echo "Now diff it against the old copy before committing."
