# Setup

I want you to wire my n8n MCP into this coding agent, following this exact workflow.

1. First, ask me to paste the MCP JSON from my n8n instance at `/settings/mcp`.
2. If you do not already know which coding agent host/client this is from context, ask me that too in the same message. Examples: OpenCode CLI, Claude Desktop, Cursor, VS Code extension, Continue.
3. After I paste the JSON, inspect the existing local config and, if needed, the official config schema/docs for this coding agent before editing anything. Do not assume the n8n JSON shape matches this agent's config format. Translate it correctly into the host's config format.
4. Add the n8n MCP entry to the correct config file, but keep the bearer token as the literal placeholder `(leftanglebracket)YOUR_ACCESS_TOKEN_HERE(rightanglebracket)` instead of asking me to paste the real token into chat.
5. If you have file access, make the config change directly. If you do not, give me the exact minimal edit I need to make in the exact file path.
6. Verify the config syntax after the change and tell me the exact absolute path of the config file.
7. Then give me exactly one copy-paste terminal command that uses the absolute path to that config file and replaces only `(leftanglebracket)YOUR_ACCESS_TOKEN_HERE(rightanglebracket)` in place. The command must:
prompt me with `Paste n8n access token:`
hide the token while I type
not require me to paste the token into chat
clear any temporary shell variable afterward
8. If my environment is macOS/Linux with `zsh` or `bash`, prefer this command pattern and fill in the real absolute path:
`read -r -s "?Paste n8n access token: " TOKEN && printf '\\n' && TOKEN="$TOKEN" perl -0pi -e 's/(leftanglebracket)YOUR_ACCESS_TOKEN_HERE(rightanglebracket)/$ENV{TOKEN}/g' "/absolute/path/to/config" && unset TOKEN`
9. If my environment is different, adapt the command appropriately but keep the same behavior.
10. After giving me the command, instruct me to run it in my terminal and enter my token when prompted, then restart or reload the coding agent so the new MCP is picked up.
11. Do not print, log, or ask me to paste the real token into chat. Do not invent config fields. If anything is unclear, ask one concise clarification question before editing.