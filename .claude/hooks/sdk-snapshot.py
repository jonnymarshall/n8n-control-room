#!/usr/bin/env python3
"""PostToolUse hook: refresh a workflow's .sdk.js snapshot after a successful push.

Mirror of .opencode/plugins/n8n-sdk-snapshot.js so the same thing happens under
Claude Code. The refresh used to be a written instruction only, and it was missed:
on 2026-10-23 three live workflows had changes that never reached their snapshots.

Reads the hook payload from stdin (tool_name, tool_input, tool_response), finds the
workflow id, runs scripts/deploy/workflows/snapshot-sdk.sh, and always exits 0.
A failed snapshot must never fail the push, so everything is fail-open.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2])
SNAPSHOT = ROOT / "scripts" / "deploy" / "workflows" / "snapshot-sdk.sh"
SDK_DIR = ROOT / "scripts" / "deploy" / "workflows"

PUSH_TOOLS = {
    "update_workflow",
    "update_partial_workflow",
    "update_full_workflow",
    "create_workflow",
    "create_workflow_from_code",
}


def workflow_id(payload):
    tool_input = payload.get("tool_input") or {}
    if isinstance(tool_input, dict):
        for key in ("workflowId", "id", "workflow_id"):
            if tool_input.get(key):
                return str(tool_input[key])
    blob = json.dumps(payload.get("tool_response") or payload.get("tool_result") or "")
    match = re.search(r'"(?:workflowId|id)"\s*:\s*"([A-Za-z0-9]+)"', blob)
    return match.group(1) if match else None


def push_failed(payload):
    blob = json.dumps(payload.get("tool_response") or payload.get("tool_result") or "")
    return re.search(r'"(?:success|saved)"\s*:\s*false', blob) is not None


def existing_slug(wf_id):
    """Reuse the workflow's current filename instead of slugifying the name again."""
    try:
        files = sorted(p for p in SDK_DIR.glob("*.sdk.js"))
    except OSError:
        return None
    pattern = re.compile(r"workflow\s*\(\s*[\"']" + re.escape(wf_id) + r"[\"']")
    for path in files:
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                head = handle.read(8192)
        except OSError:
            continue
        if f"Snapshot of live workflow {wf_id}" in head or pattern.search(head):
            return path.name[: -len(".sdk.js")]
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool = str(payload.get("tool_name") or "")
    tail = tool.split("__")[-1]
    if tail.startswith("n8n_"):
        tail = tail[len("n8n_"):]
    if tail not in PUSH_TOOLS:
        return 0
    if push_failed(payload):
        return 0

    wf_id = workflow_id(payload)
    if not wf_id:
        return 0
    if not SNAPSHOT.exists():
        return 0

    cmd = [str(SNAPSHOT), wf_id]
    slug = existing_slug(wf_id)
    if slug:
        cmd.append(slug)
    try:
        subprocess.run(
            cmd,
            cwd=str(ROOT),
            capture_output=True,
            timeout=60,
            check=False,
        )
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
