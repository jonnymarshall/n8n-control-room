#!/usr/bin/env python3
"""Blocks the agent from merging its own pull requests (Claude Code side).

The rule: the AGENT creates the PR, JONNY merges it. Never merge yourself.
"I'm ready to merge this" is readiness, not the go-ahead. The go-ahead is one of
"merge it", "merge the PR", "go ahead and merge", "you can merge".

Why this exists
---------------
The rule was documented only in the `no-auto-merge` skill, which an agent has to
choose to load. On 2026-10-21 an agent read "I'm ready to merge this" as
authorisation and ran `gh pr merge 15 --merge`, so the rule is now enforced in code.
The identical check for opencode lives in `.opencode/plugins/merge-guard.js`.

Covers
------
- `gh pr merge`
- the REST merge endpoint via `gh api ... /pulls/<n>/merge`
- `git push` whose refspec targets main/master, including a bare `git push`
  while main is checked out

Not blocked: local syncs such as `git merge --ff-only origin/main`; the push check
covers publishing to main.

Fail-open: unparseable input or an unreadable git state allows the command. A
confirmed merge attempt is the only thing that blocks.
"""

import json
import re
import subprocess
import sys

MERGE_RULE = (
    "The rule is: the agent creates the PR and Jonny merges it. "
    "Report the PR URL and stop. Do not merge, and do not treat a permission "
    "prompt as his instruction."
)


def emit_deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": (
            f"Blocked by the merge guard: {reason}\n{MERGE_RULE}\n"
            "Enforced by .claude/hooks/merge-guard.py and "
            ".opencode/plugins/merge-guard.js."
        ),
    }}))
    sys.exit(0)


def current_branch():
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=2,
        )
        return out.stdout.strip() if out.returncode == 0 else ""
    except Exception:
        return ""


def segments(cmd):
    return [s.strip() for s in re.split(r"\n|&&|\|\||;|\|", cmd or "") if s.strip()]


# Remove regions that are data, not commands: heredoc bodies (commit messages, PR
# bodies) and single-quoted spans. Without this, `git commit -m 'never run gh pr
# merge'` would block, and so would half the commit messages that explain this rule.
def strip_text_regions(cmd):
    s = re.sub(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?\n\s*\2\b", "", cmd or "")
    return re.sub(r"'[^']*'", "''", s)


def is_protected_ref(ref):
    dest = ref.split(":")[-1] if ":" in ref else ref
    return bool(re.match(r"^(refs/heads/)?(main|master)$", dest.strip()))


def merge_attempt(segment, branch):
    if re.search(r"\bgh\s+pr\s+merge\b", segment):
        return "`gh pr merge` merges a pull request"

    if re.search(r"\bgh\s+api\b", segment) and re.search(r"/pulls/[^\s\"']*/merge\b", segment):
        return "the GitHub API merge endpoint merges a pull request"

    push = re.search(r"\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*push\b(.*)$", segment)
    if push:
        tokens = re.findall(r"'[^']*'|\"[^\"]*\"|\S+", push.group(1) or "")
        positional = [t.strip("'\"") for t in tokens if t and not t.startswith("-")]
        refspecs = positional[1:]
        if not refspecs:
            if branch in ("main", "master"):
                return f"`git push` with no refspec pushes the checked-out {branch} branch"
            return ""
        for ref in refspecs:
            if is_protected_ref(ref):
                return f"`git push` sends commits straight to {ref.split(':')[-1]}"

    return ""


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return  # unparseable -> allow

    if str(payload.get("tool_name", "")).lower() != "bash":
        return

    cmd = strip_text_regions((payload.get("tool_input") or {}).get("command") or "")
    if not cmd:
        return

    branch = current_branch() if re.search(r"\bgit\s+[^\n]*\bpush\b", cmd) else ""
    for segment in segments(cmd):
        reason = merge_attempt(segment, branch)
        if reason:
            emit_deny(reason)


if __name__ == "__main__":
    main()
