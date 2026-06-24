#!/usr/bin/env python3
"""Guard against clobbering Jonny's manual n8n edits when Claude pushes SDK code.

Problem
-------
Claude edits workflows from local `*.sdk.js` files and pushes them with
`mcp__n8n-mcp__update_workflow`. If Jonny edited the same workflow by hand in the
n8n UI since Claude last touched it, that push silently overwrites his changes.

How this guard works (optimistic-concurrency / "have I seen the latest?")
-------------------------------------------------------------------------
A tiny ledger (`.claude/n8n-sync-state.json`) records, per workflow id, the
`updatedAt` timestamp n8n reported the LAST time Claude synced that workflow
(either pushed it or pulled it via get_workflow_details). That recorded value is
Claude's "local reference point".

- PreToolUse on `update_workflow`: fetch the workflow's CURRENT `updatedAt` from
  the n8n REST API and compare it to the ledger baseline. If n8n is newer than
  the baseline, someone (Jonny) edited it out of band -> DENY the push and tell
  Claude to pull current state (get_workflow_details) and reconcile first.
- PostToolUse on `update_workflow` / `create_workflow_from_code`: record the new
  `updatedAt` as the baseline (so Claude's own push doesn't trip the next check).
- PostToolUse on `get_workflow_details`: record the current `updatedAt` as the
  baseline. Pulling a workflow means Claude has now SEEN the latest version, so
  this clears a stale-baseline block and lets the reconciled re-push through.

Why a ledger instead of comparing the local .sdk.js file's mtime (as Jonny
suggested): the .sdk.js files don't embed their workflow id, and git checkouts
reset file mtimes -- both make file-mtime comparison unreliable. The ledger keys
off the workflow id and stores n8n's own timestamp, which is exactly the "last
update I'm aware of vs. what's live on n8n" comparison Jonny asked for, done
robustly.

Fail-open: if creds are missing or n8n is unreachable, the push is ALLOWED (work
shouldn't be blocked by a flaky network) but a note is surfaced so Claude knows
the guard didn't run. A confirmed conflict is the only thing that blocks.

Only the n8n MCP write path is covered. Direct REST `PUT /workflows/{id}` from
shell scripts (e.g. install-public-api.sh) bypasses this guard.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
LEDGER_PATH = os.path.join(HERE, "..", "n8n-sync-state.json")
ENV_PATH = os.path.join(REPO_ROOT, ".env")

# n8n's updatedAt can lag a push by a fraction of a second / round to whole
# seconds; only treat n8n as "ahead" if it's newer than the baseline by more
# than this many seconds, to avoid false conflicts on Claude's own writes.
GRACE_SECONDS = 5


# ── small helpers ────────────────────────────────────────────────────────────
def emit_pre(decision=None, reason=None, context=None):
    """Emit a PreToolUse hook result. decision='deny' blocks the tool call."""
    out = {"hookEventName": "PreToolUse"}
    if decision:
        out["permissionDecision"] = decision
        out["permissionDecisionReason"] = reason or ""
    if context:
        out["additionalContext"] = context
    print(json.dumps({"hookSpecificOutput": out}))


def emit_post(context):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": context,
    }}))


def load_env():
    """Parse N8N_URL / N8N_API_KEY from .env. Never prints values."""
    url = os.environ.get("N8N_URL")
    key = os.environ.get("N8N_API_KEY")
    if url and key:
        return url.rstrip("/"), key
    try:
        with open(ENV_PATH, "r") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k == "N8N_URL" and not url:
                    url = v
                elif k == "N8N_API_KEY" and not key:
                    key = v
    except OSError:
        pass
    if url:
        url = url.rstrip("/")
    return url, key


def fetch_updated_at(base_url, api_key, workflow_id):
    """GET the workflow and return (updatedAt_str, name) or raise."""
    req = urllib.request.Request(
        "%s/api/v1/workflows/%s" % (base_url, workflow_id),
        headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=6) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("updatedAt"), data.get("name")


def parse_ts(s):
    if not s:
        return None
    s = s.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def load_ledger():
    try:
        with open(LEDGER_PATH, "r") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_baseline(workflow_id, updated_at, name, how):
    ledger = load_ledger()
    ledger[str(workflow_id)] = {
        "updatedAt": updated_at,
        "name": name,
        "syncedVia": how,
        "syncedAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        with open(LEDGER_PATH, "w") as fh:
            json.dump(ledger, fh, indent=2, sort_keys=True)
    except OSError:
        pass


def workflow_id_from(tool_input, tool_response):
    """update/get put it in tool_input.workflowId; create returns a new id."""
    if isinstance(tool_input, dict):
        for k in ("workflowId", "id", "workflow_id"):
            if tool_input.get(k):
                return str(tool_input[k])
    # create_workflow_from_code: dig the id out of the response payload.
    blob = tool_response
    if isinstance(blob, (dict, list)):
        blob = json.dumps(blob)
    if isinstance(blob, str):
        import re
        m = re.search(r'"(?:workflowId|id)"\s*:\s*"([A-Za-z0-9]+)"', blob)
        if m:
            return m.group(1)
    return None


# ── PreToolUse: block a push that would clobber a newer n8n version ───────────
def handle_pre(data):
    tool_input = data.get("tool_input") or {}
    workflow_id = workflow_id_from(tool_input, None)
    if not workflow_id:
        return  # nothing to check (e.g. create has no id yet) -> allow silently

    base_url, api_key = load_env()
    if not base_url or not api_key:
        emit_pre(context=(
            "n8n-sync-guard: N8N_URL/N8N_API_KEY not found, so the manual-edit "
            "safety check could NOT run for workflow %s. Push allowed, but if "
            "Jonny may have edited it by hand, pull it first with "
            "get_workflow_details to be safe." % workflow_id))
        return

    try:
        current_updated, name = fetch_updated_at(base_url, api_key, workflow_id)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError) as e:
        emit_pre(context=(
            "n8n-sync-guard: couldn't reach n8n to verify workflow %s (%s). Push "
            "allowed (fail-open); the manual-edit check did not run."
            % (workflow_id, type(e).__name__)))
        return

    ledger = load_ledger()
    entry = ledger.get(workflow_id)
    if not entry or not entry.get("updatedAt"):
        # First time Claude touches this workflow under the guard: no baseline to
        # compare against. Allow, and the PostToolUse will record the new state.
        emit_pre(context=(
            "n8n-sync-guard: no sync baseline yet for workflow %s (%s); allowing "
            "this push and recording its state. Future manual edits by Jonny "
            "WILL be detected before the next push." % (workflow_id, name or "?")))
        return

    base_ts = parse_ts(entry.get("updatedAt"))
    curr_ts = parse_ts(current_updated)
    if base_ts is None or curr_ts is None:
        # Can't compare reliably -> don't block, just note.
        emit_pre(context=(
            "n8n-sync-guard: couldn't compare timestamps for workflow %s; push "
            "allowed without the manual-edit check." % workflow_id))
        return

    drift = (curr_ts - base_ts).total_seconds()
    if drift > GRACE_SECONDS:
        emit_pre(decision="deny", reason=(
            "STOP — workflow %s (\"%s\") was modified on n8n AFTER Claude last "
            "synced it.\n"
            "  • Claude's last-known version (baseline): %s\n"
            "  • Live on n8n now:                       %s\n"
            "This almost always means Jonny edited it by hand in the n8n UI. "
            "Pushing this SDK code now would OVERWRITE those manual changes.\n\n"
            "Do this first:\n"
            "  1. Call get_workflow_details({workflowId: \"%s\"}) to see the live "
            "version (this also refreshes the sync baseline).\n"
            "  2. Diff it against your local .sdk.js and merge Jonny's manual "
            "changes into your code.\n"
            "  3. Then re-run update_workflow — it will be allowed once you've "
            "pulled the latest.\n"
            "If you're certain you want to overwrite the live version anyway, "
            "tell Jonny what manual changes will be lost and get the OK before "
            "forcing the push." % (
                workflow_id, entry.get("name") or "?",
                entry.get("updatedAt"), current_updated, workflow_id)))
        return

    # In sync (n8n not ahead of baseline) -> allow silently.


# ── PostToolUse: record the latest n8n state as the new baseline ─────────────
def handle_post(data):
    tool_input = data.get("tool_input") or {}
    tool_response = data.get("tool_response")
    workflow_id = workflow_id_from(tool_input, tool_response)
    if not workflow_id:
        return

    base_url, api_key = load_env()
    if not base_url or not api_key:
        return  # can't record; PreToolUse already warns when creds are missing

    tool_name = data.get("tool_name", "")
    how = "pull" if "get_workflow_details" in tool_name else "push"
    try:
        updated_at, name = fetch_updated_at(base_url, api_key, workflow_id)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError):
        return
    if updated_at:
        save_baseline(workflow_id, updated_at, name, how)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    event = data.get("hook_event_name") or data.get("hookEventName")
    if event == "PreToolUse":
        handle_pre(data)
    elif event == "PostToolUse":
        handle_post(data)


if __name__ == "__main__":
    main()
