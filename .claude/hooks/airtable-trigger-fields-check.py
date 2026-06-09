#!/usr/bin/env python3
"""PostToolUse lint for n8n Airtable Trigger nodes built via the n8n MCP SDK.

Catches the two recurring Airtable-trigger failure modes:
  1. A restricted `Fields` list with a space after a comma. The node does NOT
     trim whitespace, so "Topic, Summary" -> [" Summary"] -> Airtable error
     `Unknown field name: " Summary"`.
  2. A restricted `Fields` list that omits the `triggerField` (e.g. "Last Modified
     Time"). When Fields is restricted Airtable returns only those fields, so the
     trigger cannot find its sort/cursor field -> `The Field "..." does not exist.`

Emits a PostToolUse additionalContext warning when it finds either. Soft reminder
(never blocks); occasional false positives are acceptable and easily verified.
Reads the standard PostToolUse hook JSON on stdin.
"""
import json
import re
import sys


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return

    tool_input = data.get("tool_input") or {}
    code = tool_input.get("code")
    if not isinstance(code, str) or "airtableTrigger" not in code:
        return

    trigger_fields = re.findall(r"triggerField\s*:\s*['\"]([^'\"]+)['\"]", code)
    fields_vals = re.findall(r"(?<![A-Za-z])fields\s*:\s*['\"]([^'\"]+)['\"]", code)

    warnings = []
    for fv in fields_vals:
        if re.search(r",\s", fv):
            warnings.append(
                'Airtable Trigger Fields list "%s" has a space after a comma. The node '
                'does NOT trim whitespace (" Summary" becomes an unknown field). Use commas '
                'with NO spaces, e.g. "Topic,Summary,Status,Last Modified Time".' % fv
            )
        parts = [p.strip() for p in fv.split(",")]
        for tf in trigger_fields:
            if tf not in parts:
                warnings.append(
                    'Airtable Trigger Fields list "%s" omits the trigger field "%s". When '
                    'Fields is restricted, Airtable returns only those fields and the trigger '
                    'cannot find its sort field. Add "%s" to the Fields list.' % (fv, tf, tf)
                )

    if not warnings:
        return

    # De-duplicate while preserving order.
    seen = set()
    unique = [w for w in warnings if not (w in seen or seen.add(w))]
    msg = "Airtable Trigger Fields check:\n- " + "\n- ".join(unique)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": msg,
        }
    }))


if __name__ == "__main__":
    main()
