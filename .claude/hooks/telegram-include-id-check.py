#!/usr/bin/env python3
"""PostToolUse lint for n8n Telegram send nodes built via the n8n MCP SDK.

Rule (see memory `telegram-include-record-id`): every Telegram message a
workflow sends about an episode/record MUST surface that record's unique ID
(for Guy's Take, the `episodeId` -> `BA-xxxx`), so Jonny's replies have a
unique anchor and the Airtable Assistant knows which record a reply refers to.
The convention is to wrap the ID in a <code>...</code> block so it's tap-to-copy.

This hook scans the SDK code on every `create_workflow_from_code` /
`update_workflow` call, finds Telegram **send** nodes (`n8n-nodes-base.telegram`,
NOT the `telegramTrigger`), and warns when a node's `text` / `caption` does not
appear to include a record-ID reference.

Soft reminder only (never blocks); occasional false positives are acceptable and
easily verified. Reads the standard PostToolUse hook JSON on stdin.
"""
import json
import re
import sys

# A message is considered compliant if its text/caption contains any of these
# (case-insensitive): an episode/record id field reference, a literal {ID}
# placeholder, a `.id` expression tail, or a <code> block that wraps an id token.
ID_SIGNAL = re.compile(
    r"(?:episode|record)\s*_?id"   # episodeId / recordId / record id / record_id
    r"|\{ID\}"                      # Airtable {ID} field in a formula/expression
    r"|\.id\b"                      # generic .id }} expression tail
    r"|<code>[^<]*\bid\b",          # <code> block that names an id
    re.IGNORECASE,
)

# Telegram operations that emit a user-facing message we care about.
MESSAGE_OPS = ("sendMessage", "sendPhoto", "sendDocument", "sendVideo", "sendAnimation")


def message_fields(block):
    """Yield (field, value) for each text:/caption: expr(...) or string in a block."""
    # expr("...") or expr('...') form
    for m in re.finditer(
        r"\b(text|caption)\s*:\s*expr\(\s*(['\"])(.*?)\2\s*\)", block, re.DOTALL
    ):
        yield m.group(1), m.group(3)
    # plain string form: text: '...'  (skip ones already captured as expr)
    for m in re.finditer(
        r"\b(text|caption)\s*:\s*(['\"])(.*?)\2", block, re.DOTALL
    ):
        # crude guard: if it was an expr(...) the char before the quote is '('
        start = m.start(2)
        if start > 0 and block[start - 1] == "(":
            continue
        yield m.group(1), m.group(3)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return

    tool_input = data.get("tool_input") or {}
    code = tool_input.get("code")
    if not isinstance(code, str) or "n8n-nodes-base.telegram'" not in code:
        return

    warnings = []
    # Walk each Telegram send node. Slice a forward window covering its params.
    for m in re.finditer(r"n8n-nodes-base\.telegram'", code):
        block = code[m.start():m.start() + 2000]

        # Only message-bearing operations (skip answerCallbackQuery toasts, etc.).
        op_match = re.search(r"operation\s*:\s*['\"]([^'\"]+)['\"]", block)
        op = op_match.group(1) if op_match else None
        # If no explicit operation, the telegram node defaults to sendMessage.
        if op is not None and op not in MESSAGE_OPS:
            continue

        name_match = re.search(r"name\s*:\s*['\"]([^'\"]+)['\"]", block)
        node_name = name_match.group(1) if name_match else "(unnamed Telegram node)"

        for field, value in message_fields(block):
            if not ID_SIGNAL.search(value):
                snippet = value[:60].replace("\n", " ")
                warnings.append(
                    'Telegram node "%s" (%s) sends a message with no record ID. '
                    'Add the episode/record ID (for Guy\'s Take: '
                    '<code>{{ ...episodeId }}</code> with a || \'no-id\' fallback) so '
                    'replies have a unique anchor. Message starts: "%s..."'
                    % (node_name, field, snippet)
                )
            break  # one field per node is enough to judge

    if not warnings:
        return

    seen = set()
    unique = [w for w in warnings if not (w in seen or seen.add(w))]
    msg = "Telegram include-record-ID check:\n- " + "\n- ".join(unique)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": msg,
        }
    }))


if __name__ == "__main__":
    main()
